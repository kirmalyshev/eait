#!/bin/sh
# Give the database to a role that row-level security actually applies to.
#
# WHY THIS EXISTS. `POSTGRES_USER` is a SUPERUSER — that is what the image's initdb makes it — and a
# superuser bypasses row-level security whatever the policy says and whatever `force` says. The
# backend connecting as it would run against thirteen tables of policies that can refuse nothing:
# applied, visible in `pg_policies`, and inert. `store.pg.ts` says so out loud at boot, and this is
# the thing that stops it having to.
#
# So `eait` stays the superuser that initdb created and nothing connects as it but this script, and
# the backend connects as `eait_app`: an ordinary login role that OWNS the database — it has to, the
# backend creates its own tables — and is therefore subject to the policies, because they are
# FORCEd. This mirrors `src/scripts/db.sh`, which does the same thing for a development machine.
#
# NOT AN initdb SCRIPT, DELIBERATELY. `/docker-entrypoint-initdb.d` runs once, on an empty data
# directory, so on every already-deployed host it would do nothing at all and say nothing about it —
# the backend would go on connecting as a superuser and the policies would go on being decorative.
# This runs on every boot instead, and every statement in it is idempotent.
set -eu

: "${PGPASSWORD:?the superuser password}"
: "${EAIT__DEPLOY__APP_DB_PASSWORD:?the application role's password}"
DB="${POSTGRES_DB:-eait}"
SUPER="${POSTGRES_USER:-eait}"
APP=eait_app

# `db` is the service name in docker-compose.prod.yml; CI runs this same script against the
# Postgres it starts as a service container, which is on localhost. One script, so the role CI
# tests against is the role production gets.
#
# `-X` because this must not read anybody's `~/.psqlrc`. A developer running it with `\timing` on
# gets "eait_app\nTime: 0.287 ms" out of the `-tAc` ownership query below, which equals no role
# name, so the hand-over re-runs on every boot and writes shared catalogs every time.
psql() { command psql -X -v ON_ERROR_STOP=1 -h "${PGHOST:-db}" -p "${PGPORT:-5432}" -U "$SUPER" -q "$@"; }

echo "db-init: ensuring role $APP"
# `\gexec` rather than a DO block, so the password never goes anywhere near a string this script
# concatenates: `:'pw'` is quoted by psql itself, and a password containing a quote is a password
# and not a syntax error.
# THE ROLE NAME COMES THROUGH `-v app` TOO. The heredoc is single-quoted so the shell touches
# nothing in it, which also means `$APP` would not expand -- and hardcoding the name here while
# every statement below uses `$APP` means changing `APP` creates one role and then hands the
# database to a different, non-existent one. `:'app'` is the literal, `:"app"` the identifier, both
# quoted by psql.
psql -d "$DB" -v pw="$EAIT__DEPLOY__APP_DB_PASSWORD" -v app="$APP" <<'SQL'
select 'create role ' || quote_ident(:'app') || ' login nosuperuser nocreatedb nocreaterole'
 where not exists (select 1 from pg_roles where rolname = :'app')
\gexec
alter role :"app" with password :'pw';
SQL

# The DATABASE, asked before it is changed: `alter database … owner` writes shared catalogs, so two
# hosts doing it at once fail each other with "tuple concurrently deleted", and it is a one-time
# hand-over rather than something to redo on every boot.
owner=$(psql -tAc "select pg_get_userbyid(datdba) from pg_database where datname = '$DB'" -d postgres)
if [ "$owner" = "$APP" ]; then
  echo "db-init: $DB already owned by $APP"
else
  echo "db-init: handing $DB to $APP"
  psql -d postgres -c "alter database \"$DB\" owner to $APP"
fi

# And the TABLES, which are a separate question with a separate answer.
#
# NOT `reassign owned by $SUPER`, WHICH CANNOT WORK HERE. `POSTGRES_USER` is the role initdb
# bootstraps, and that role owns pinned system objects, so Postgres refuses the whole statement:
# "cannot reassign ownership of objects owned by role eait because they are required by the database
# system". It shipped, and CI is where it was caught — on a developer machine whose data directory
# predates the project's rename the superuser is NOT the bootstrap role, so the statement succeeds
# there and proves nothing about anywhere else.
#
# OUTSIDE THE BRANCH ABOVE, DELIBERATELY. `alter database … owner` commits on its own, so a run that
# got that far and then failed would be skipped forever after by the check — database handed over,
# every table still the superuser's, and the backend unable to alter its own tables on the next
# migration. The `<> '$APP'` filter is what makes running it every boot a no-op once it is done.
psql -d "$DB" <<SQL
select format('alter table %I.%I owner to %I', schemaname, tablename, '$APP')
  from pg_tables where schemaname = 'public' and tableowner <> '$APP'
\gexec
select format('alter sequence %I.%I owner to %I', schemaname, sequencename, '$APP')
  from pg_sequences where schemaname = 'public' and sequenceowner <> '$APP'
\gexec
SQL

echo "db-init: done"
