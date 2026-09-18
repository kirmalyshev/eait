#!/bin/sh
# Development database control. The backend creates TABLES; this creates the DATABASE.
#
# That split is deliberate. eait shipped auto-create-on-connect once and it was silent data loss: a
# container rebuilt from another branch opened a brand-new empty database, so every user was unknown
# and re-onboarded from scratch, with the real rows still in the old database and nothing in any
# log. An empty database is indistinguishable from every user having been wiped.
#
# ONE SERVER, TWO DATABASES PER WORKTREE. `docker-compose.yml` pins the compose project name so
# every worktree drives the same container; what makes them independent is the databases inside it,
# named after the branch by `src/scripts/dev-env.ts` and created here. The dev one is what the
# server runs against; the test one is what the store contract suite migrates and writes, and it is
# separate because `./dev seed` puts an admin in the dev one and two of that suite's assertions are
# about a database with no admin in it. Without `.env.worktree` these fall back to `eait` and
# `eait__test`, which are slot 0's and what this script used before slots existed.
#
#   sh src/scripts/db.sh [up|down|psql|create|drop|list|nuke]     (or: ./dev db …)
set -eu

cd "$(dirname "$0")/../.."

# The worktree's database name, if `./dev env` has been run. Not secret; see the header of the file.
#
# THROUGH `worktree.sh`, NOT FROM `.env.worktree` DIRECTLY, and that is not tidying: the `eait`
# fallback lives there, and this is the one script where a silent slot-0 fallback destroys data
# rather than merely confusing somebody — `db.sh drop` in a worktree that read nothing would drop
# SLOT 0'S DATABASE.
. ./src/scripts/worktree.sh
DB="$EAIT_DB_NAME"
TEST_DB="$EAIT_TEST_DB_NAME"

# One place that knows how to reach the server, so nothing below repeats the credentials.
psql_as() {
  _u=$1
  _d=$2
  shift 2
  # `-X`: never read a psqlrc. `\timing` in one turns every `-tAc` answer into two lines, and the
  # ownership check below compares the whole thing to a role name.
  docker compose exec -T db psql -X -U "$_u" -d "$_d" "$@"
}

psql_maint() {
  psql_as eait eait "$@"
}

# THE ROLE THE BACKEND CONNECTS AS, AND WHY IT IS NOT `eait`.
#
# `eait` is the image's POSTGRES_USER, which Postgres makes a SUPERUSER — and a superuser bypasses
# row-level security silently, `force` or no `force`. Every policy `store.pg.ts` creates would be
# decorative on this machine, and the test that proves a user cannot read another user's rows would
# pass for the wrong reason: not because the database refused, but because nothing was ever asked.
#
# So the backend and the tests connect as this role instead. It OWNS the worktree's database —
# it has to, the backend creates its own tables — and the policies are FORCEd, which is what makes
# an owner subject to them.
#
# MAINTENANCE STAYS ON `eait`: createdb, dropdb and `./dev db psql` are the admin shell, and an
# admin shell is meant to see everything.
APP_ROLE=eait_app
APP_PASSWORD=eait

# Cluster-wide, so every worktree shares this one role — and two `./dev up` calls in different
# worktrees can reach here at the same moment. `if not exists` would still race; the exception
# handler is what makes it idempotent rather than nearly idempotent.
#
# BOTH SQLSTATES, because they are not the same race. A `create role` for a name that is already
# there raises `duplicate_object`; two of them landing together lose to the unique index on
# `pg_authid.rolname` instead and raise `unique_violation` — which is precisely the concurrent case
# this handler is here for, and the one it used to let through.
ensure_app_role() {
  psql_maint -q -v ON_ERROR_STOP=1 -c "do \$\$
begin
  create role $APP_ROLE login password '$APP_PASSWORD' nosuperuser nocreatedb nocreaterole;
exception when duplicate_object or unique_violation then null;
end \$\$;"
  # THE PASSWORD, EVERY TIME, not only at creation. The role is cluster-wide and outlives any one
  # worktree, so one left over from an older checkout with a different password authenticates
  # nothing — and no `./dev db` subcommand would have repaired it. `src/iac/db-init.sh` sets it
  # unconditionally for the same reason.
  #
  # RETRIED, NOT GUARDED. This writes the SHARED `pg_authid`, so two worktrees running `./dev up` at
  # the same moment can lose to `tuple concurrently updated` — the race `own_database` sidesteps by
  # asking first, which is not available here: a SCRAM hash is salted, so it says nothing about the
  # password that produced it and there is no cheap "is it already right?". The statement is
  # idempotent, so one retry is the whole fix.
  psql_maint -q -v ON_ERROR_STOP=1 -c "alter role $APP_ROLE with password '$APP_PASSWORD'" ||
    psql_maint -q -v ON_ERROR_STOP=1 -c "alter role $APP_ROLE with password '$APP_PASSWORD'"
}

# Hand this worktree's database, and every table already inside it, to the app role.
#
# THE DATABASE IS ASKED ABOUT FIRST, AND SKIPPED WHEN IT IS DONE. `alter database … owner` writes
# shared catalogs, so two worktrees running it at the same moment — which is what `./dev up` in
# three checkouts is — fail each other with "tuple concurrently deleted".
#
# THE TABLES ARE NOT, and they are not `reassign owned` either. That statement is refused outright
# when the superuser is the one initdb bootstrapped, because that role owns pinned system objects
# ("cannot reassign ownership of objects owned by role … because they are required by the database
# system") — which is every fresh container and every fresh deploy, and is NOT this machine, whose
# data directory predates the project's rename. Per-object instead, filtered to what has not moved,
# so it is a no-op once done and safe on every boot; running it outside the check above is what
# stops a database that was handed over but whose tables were not from staying that way forever.
own_database() {
  _owner=$(psql_maint -tAc "select pg_get_userbyid(datdba) from pg_database where datname = '$1'" | tr -d ' \r')
  if [ "$_owner" != "$APP_ROLE" ]; then
    psql_maint -q -v ON_ERROR_STOP=1 -c "alter database \"$1\" owner to $APP_ROLE"
  fi
  psql_as eait "$1" -q -v ON_ERROR_STOP=1 <<SQL
select format('alter table %I.%I owner to %I', schemaname, tablename, '$APP_ROLE')
  from pg_tables where schemaname = 'public' and tableowner <> '$APP_ROLE'
\gexec
select format('alter sequence %I.%I owner to %I', schemaname, sequencename, '$APP_ROLE')
  from pg_sequences where schemaname = 'public' and sequenceowner <> '$APP_ROLE'
\gexec
-- AND THE FUNCTIONS. Replacing a function requires owning it, so a database whose app_user_id() and
-- app_unscoped() were created by another role -- a worktree that booted once on the old superuser
-- URL -- refuses the migration on every subsequent boot. This is the copy that runs on dev db up,
-- so it is the one that heals such a machine. (No backticks: unquoted heredoc.)
select format('alter function %I.%I(%s) owner to %I', n.nspname, p.proname,
                pg_get_function_identity_arguments(p.oid), '$APP_ROLE')
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.prokind = 'f'
   and pg_get_userbyid(p.proowner) <> '$APP_ROLE'
   -- NOT extension members: pgcrypto owns its functions, and reassigning one individually is not
   -- something to do behind the extension's back.
   and not exists (select 1 from pg_depend d
                    where d.objid = p.oid and d.classid = 'pg_proc'::regclass and d.deptype = 'e')
\gexec
SQL
}

db_exists() {
  psql_maint -lqt 2>/dev/null | cut -d'|' -f1 | tr -d ' ' | grep -qx "$1"
}

# One database, created if it is not there. Both names go through this, so neither can acquire a
# creation path of its own that the other lacks.
ensure_db() {
  if db_exists "$1"; then
    echo "database $1 (exists)"
  else
    docker compose exec -T db createdb -U eait -O "$APP_ROLE" "$1"
    echo "database $1 (created)"
  fi
  # Every time, not only on create: a database made before the app role existed is handed over here,
  # and that hand-over is the only thing between it and a backend that cannot migrate.
  own_database "$1"
}

# Every `Type YES` prompt reads through this. `read` fails on EOF, and under `set -e` a bare one
# kills the script BEFORE the comparison: a pipe, CI or a runner with stdin closed sees the prompt
# and then nothing, with an exit status it cannot tell from the operation failing halfway.
confirm_yes() {
  if ! IFS= read -r _confirm; then printf '\naborted (no input)\n' >&2; exit 1; fi
  [ "$_confirm" = "YES" ] || { echo "aborted"; exit 1; }
}

wait_ready() {
  _waited=0
  until docker compose exec -T db pg_isready -U eait -d eait >/dev/null 2>&1; do
    if [ "$_waited" -ge 60 ]; then
      printf '\npostgres did not become ready in 60s — is Docker running? (docker compose ps db)\n' >&2
      exit 1
    fi
    sleep 1
    _waited=$((_waited + 1))
  done
}

# WHOSE container it is. Compose names a project after the DIRECTORY unless the file pins it, so a
# container called `eait-db` started from some other checkout is invisible to a check that only
# knows our project name — and `docker compose up` then fails on a port clash rather than reusing
# it. Naming the owner is the difference between a puzzling error and an obvious one.
compose_project_of() {
  docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' "$1" 2>/dev/null || true
}

refuse_foreign_container() {
  owner="$(compose_project_of eait-db)"
  [ -n "$owner" ] || return 0
  [ "$owner" = "eait-dev" ] && return 0
  echo "The container 'eait-db' on this machine belongs to compose project '$owner'." >&2
  echo "This repository's is 'eait-dev'. Two projects cannot both own that name." >&2
  echo "" >&2
  echo "If that container is this same development database under an older project name," >&2
  echo "stop and remove it, then run this again — the volume 'eait-pgdata' keeps the rows:" >&2
  echo "" >&2
  echo "    docker rm -f eait-db" >&2
  exit 1
}

case "${1:-up}" in
  up)
    refuse_foreign_container
    docker compose up -d db
    wait_ready
    ensure_app_role
    ensure_db "$DB"
    ensure_db "$TEST_DB"
    ;;
  create)
    ensure_app_role
    ensure_db "$DB"
    ensure_db "$TEST_DB"
    ;;
  drop)
    # Destructive, so it asks. The seeded fixtures come back with `./dev seed`; anything you created
    # by hand in this database does not.
    #
    # `--yes` is for a caller that has ALREADY asked, naming this same database.
    if [ "${2:-}" != "--yes" ]; then
      printf 'This deletes the databases %s and %s and everything in them. Type YES to continue: ' "$DB" "$TEST_DB"
      confirm_yes
    fi
    # `create` is always reached through `up`; this is not, and against a stopped container `dropdb`
    # fails while the database the confirmation named is still there.
    refuse_foreign_container
    docker compose up -d db >/dev/null
    wait_ready
    # BOTH, because both were derived here and the confirmation above named both. Dropping the dev
    # one alone would leave a test database nothing in this worktree ever mentions again.
    for _d in "$DB" "$TEST_DB"; do
      docker compose exec -T db dropdb -U eait --if-exists "$_d"
      echo "dropped $_d"
    done
    ;;
  list)
    echo "databases on 127.0.0.1:5433 (this worktree uses: $DB, $TEST_DB)"
    psql_maint -lqt | cut -d'|' -f1 | tr -d ' ' | grep -v '^$' | sed 's/^/  /'
    ;;
  down)
    docker compose stop db
    ;;
  psql)
    # ANYTHING AFTER `psql` GOES TO psql. Without the passthrough `./dev db psql -c 'select 1'`
    # silently ignored the flag and opened an interactive session instead — which, with no TTY,
    # is a non-zero exit and no output, looking exactly like the query having failed.
    shift || true
    docker compose exec db psql -U eait -d "$DB" "$@"
    ;;
  nuke)
    # Destroys the volume — every worktree's databases, dev AND test, not just this worktree's.
    # Named `nuke` rather than `reset` so nobody types it by muscle memory.
    printf 'This deletes every dev and test database, for every worktree. Type YES to continue: '
    confirm_yes
    docker compose down -v
    ;;
  *)
    echo "usage: sh src/scripts/db.sh [up|down|psql|create|drop|list|nuke]" >&2
    exit 1
    ;;
esac
