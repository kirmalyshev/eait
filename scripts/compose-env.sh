#!/bin/sh
# Per-worktree docker compose identity. Writes COMPOSE_PROJECT_NAME=eait-<branch> into .env so
# parallel worktrees run as separate compose projects (separate containers, images, state)
# instead of silently replacing each other's containers on `docker compose up`.
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

# Compose project names must be lowercase [a-z0-9_-] and start alphanumeric.
NAME="$(printf '%s' "$RAW" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g; s/^-*//; s/-*$//' | cut -c1-40)"
[ -n "$NAME" ] || NAME="main"
PROJECT="eait-$NAME"

# Rewrite atomically, preserving the 600 mode setup.sh uses (.env holds live secrets).
TMP="$ENV_FILE.tmp.$$"
grep -v '^COMPOSE_PROJECT_NAME=' "$ENV_FILE" > "$TMP" || true
# Guard against a missing trailing newline gluing our line onto the last one.
[ ! -s "$TMP" ] || [ -z "$(tail -c 1 "$TMP")" ] || printf '\n' >> "$TMP"
printf 'COMPOSE_PROJECT_NAME=%s\n' "$PROJECT" >> "$TMP"
chmod 600 "$TMP"
mv "$TMP" "$ENV_FILE"

# Pre-create the bind-mount dir: if docker creates it on Linux it lands root-owned and the
# container's bun user cannot write the SQLite file.
mkdir -p "$DIR/data"

echo "COMPOSE_PROJECT_NAME=$PROJECT written to .env"
echo "Reminder: each parallel instance needs its own TELEGRAM_BOT_TOKEN (409 Conflict otherwise)."
