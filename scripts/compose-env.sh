#!/bin/sh
# Per-worktree identity for parallel branch development. Writes into .env:
#
#   COMPOSE_PROJECT_NAME=eait-<branch>   separate compose project (containers, images, network
#                                        aliases) — without it, `docker compose up` in one
#                                        worktree silently replaces another's containers
#   PGDATABASE=eait_<branch>             this branch's database on the shared dev Postgres
#   PGDATABASE_TEST=eait_test_<branch>   base name for this branch's throwaway test databases
#
#   sh scripts/compose-env.sh            # derive the name from the current git branch
#   sh scripts/compose-env.sh <name>     # explicit instance name
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

# Two spellings of the same name: compose project names take dashes, Postgres database names
# (validated as [a-z_][a-z0-9_]* in config.ts) take underscores.
CLEAN="$(printf '%s' "$RAW" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g; s/^-*//; s/-*$//' | cut -c1-40)"
[ -n "$CLEAN" ] || CLEAN="main"
PROJECT="eait-$CLEAN"
DB_NAME="eait_$(printf '%s' "$CLEAN" | tr '-' '_')"
TEST_DB_NAME="eait_test_$(printf '%s' "$CLEAN" | tr '-' '_')"

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
