#!/bin/sh
# Per-worktree CONTAINER identity for parallel branch development. Writes into .env:
#
#   COMPOSE_PROJECT_NAME=eait-<branch>   separate compose project (containers, images, network
#                                        aliases) — without it, `docker compose up` in one
#                                        worktree silently replaces another's containers
#   PGDATABASE=eait                      THE database. One for the whole app, every branch.
#   PGDATABASE_TEST=eait_test            base name for throwaway test databases
#
#   sh scripts/compose-env.sh            # derive the container name from the current git branch
#   sh scripts/compose-env.sh <name>     # explicit instance name
#
# CONTAINERS are per-branch; DATA IS NOT. This script used to derive PGDATABASE=eait_<branch>
# too, and that was a data-loss bug: rebuilding the container from a checkout on another branch
# pointed the bot at a different (auto-created, empty) database, so every user was unknown and
# re-onboarded from scratch — silently, with the real data still sitting in the old database.
# User state must survive a branch switch, so the database name is fixed here and the two stale
# lines are rewritten on every run. openDb refuses to create a missing database, so a wrong
# PGDATABASE is now a loud boot failure instead of a fresh empty world.
#
# The cost of one shared database is real and accepted: a branch that runs a new migration
# migrates the database main is also using, and migrations are forward-only. Don't `make up` a
# branch carrying a destructive migration against data you care about.
#
# A parallel instance also needs its OWN TELEGRAM_BOT_TOKEN in this worktree's .env — Telegram
# allows one long-polling consumer per token; the second gets 409 Conflict and both degrade.
# Create a separate dev bot via @BotFather for each worktree you run simultaneously.
set -eu

DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "No .env at $ENV_FILE — create one first (cp .env.example .env, or ./scripts/setup.sh)." >&2
  exit 1
fi

if [ "$#" -ge 1 ]; then
  RAW="$1"
else
  RAW="$(git -C "$DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)"
fi

# Compose project names take dashes. Cut at 31 to stay well clear of the shell/docker limits
# the longest derived identifier would otherwise approach.
CLEAN="$(printf '%s' "$RAW" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g; s/^-*//; s/-*$//' | cut -c1-31)"
[ -n "$CLEAN" ] || CLEAN="main"
PROJECT="eait-$CLEAN"
# Fixed, on purpose — see the header. Not derived from the branch, ever.
DB_NAME="eait"
TEST_DB_NAME="eait_test"

# A .env written by the old branch-database version is repaired here rather than silently
# carried forward — say so, because the bot has been reading the other database until now.
PREV_DB="$(grep '^PGDATABASE=' "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2 || true)"
if [ -n "$PREV_DB" ] && [ "$PREV_DB" != "$DB_NAME" ]; then
  echo "NOTE: PGDATABASE was '$PREV_DB', repointing to '$DB_NAME' (one database for the whole app)."
  echo "      Any data written while it pointed at '$PREV_DB' lives THERE, not in '$DB_NAME'."
  echo "      Check before you assume it is gone:  sh scripts/db.sh psql $PREV_DB"
fi

# Rewrite atomically, preserving the 600 mode setup.sh uses (.env holds live secrets).
TMP="$ENV_FILE.tmp.$$"
grep -v -e '^COMPOSE_PROJECT_NAME=' -e '^PGDATABASE=' -e '^PGDATABASE_TEST=' "$ENV_FILE" > "$TMP" || true
# Guard against a missing trailing newline gluing our lines onto the last one.
[ ! -s "$TMP" ] || [ -z "$(tail -c 1 "$TMP")" ] || printf '\n' >> "$TMP"
{
  printf 'COMPOSE_PROJECT_NAME=%s\n' "$PROJECT"
  printf 'PGDATABASE=%s\n' "$DB_NAME"
  printf 'PGDATABASE_TEST=%s\n' "$TEST_DB_NAME"
} >> "$TMP"
chmod 600 "$TMP"
mv "$TMP" "$ENV_FILE"

echo "written to .env:"
echo "  COMPOSE_PROJECT_NAME=$PROJECT"
echo "  PGDATABASE=$DB_NAME"
echo "  PGDATABASE_TEST=$TEST_DB_NAME"
echo "Reminder: each parallel instance needs its own TELEGRAM_BOT_TOKEN (409 Conflict otherwise)."
