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
# `eait_test`, which are slot 0's and what this script used before slots existed.
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
  docker compose exec -T db psql -U "$_u" -d "$_d" "$@"
}

psql_maint() {
  psql_as eait eait "$@"
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
    docker compose exec -T db createdb -U eait "$1"
    echo "database $1 (created)"
  fi
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
    ensure_db "$DB"
    ensure_db "$TEST_DB"
    ;;
  create)
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
