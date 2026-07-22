#!/bin/sh
# Shared dev Postgres (docker-compose.infra.yml, fixed project `eait-infra`) — one server for
# every worktree, one database per branch. The bot auto-creates its branch database on boot;
# this script only manages the server.
#
#   sh scripts/db.sh up          # start (or reuse) the shared Postgres
#   sh scripts/db.sh down        # stop it (data survives in the pg-data volume)
#   sh scripts/db.sh status      # is it running?
#   sh scripts/db.sh psql [dbname]   # psql into a database (default: this worktree's PGDATABASE)
#   sh scripts/db.sh list        # list eait databases
#   sh scripts/db.sh clean-test  # drop leftover eait_test_* databases from crashed test runs
#   sh scripts/db.sh destroy     # down + DELETE the data volume (asks first)
set -eu

DIR="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE="docker compose -f $DIR/docker-compose.infra.yml -p eait-infra"

# This worktree's database, if compose-env.sh wrote one; server-default otherwise.
env_db() {
  grep '^PGDATABASE=' "$DIR/.env" 2>/dev/null | cut -d= -f2 || true
}

psql_in() {
  # $COMPOSE is intentionally word-split
  # shellcheck disable=SC2086
  $COMPOSE exec db psql -U eait -d "$1"
}

case "${1:-}" in
  up)
    $COMPOSE up -d --wait
    PORT="$(grep '^PGPORT=' "$DIR/.env" 2>/dev/null | cut -d= -f2 || true)"
    [ -n "$PORT" ] || PORT=5439
    echo "eait-infra Postgres up on 127.0.0.1:$PORT (databases are created on first use)."
    ;;
  down)
    $COMPOSE down
    ;;
  status)
    $COMPOSE ps
    ;;
  psql)
    DB="${2:-$(env_db)}"
    [ -n "$DB" ] || DB=eait
    # Same identifier charset the app enforces — the name is interpolated into SQL below.
    case "$DB" in
      *[!a-z0-9_]* | "") echo "invalid database name: $DB" >&2; exit 1 ;;
    esac
    # The branch database is normally born on the bot's first boot; create it here too so
    # `make psql` works on a branch whose bot has never run.
    $COMPOSE exec db psql -U eait -d eait -tAc "SELECT 1 FROM pg_database WHERE datname='$DB'" | grep -q 1 \
      || $COMPOSE exec db createdb -U eait "$DB"
    psql_in "$DB"
    ;;
  list)
    $COMPOSE exec db psql -U eait -d eait -tAc \
      "SELECT datname FROM pg_database WHERE datname LIKE 'eait%' ORDER BY datname"
    ;;
  clean-test)
    # LIKE with escaped underscores + the testutil.ts suffix (_<12 hex>): a plain
    # 'eait_test_%' would ALSO match the live branch database of a branch named test-* —
    # in LIKE, _ is a single-char wildcard — and FORCE-drop it.
    NAMES="$($COMPOSE exec db psql -U eait -d eait -tAc \
      "SELECT datname FROM pg_database WHERE datname LIKE 'eait\_test\_%' AND datname ~ '_[0-9a-f]{12}\$'")"
    if [ -z "$NAMES" ]; then
      echo "no eait_test_* databases to drop"
      exit 0
    fi
    for n in $NAMES; do
      $COMPOSE exec db psql -U eait -d eait -c "DROP DATABASE IF EXISTS \"$n\" WITH (FORCE)"
      echo "dropped $n"
    done
    ;;
  destroy)
    printf 'This DELETES all eait dev databases (volume eait-infra_pg-data). Type yes to continue: '
    read -r answer
    [ "$answer" = "yes" ] || { echo "aborted"; exit 1; }
    $COMPOSE down -v
    ;;
  *)
    echo "usage: sh scripts/db.sh {up|down|status|psql [db]|list|clean-test|destroy}" >&2
    exit 1
    ;;
esac
