#!/bin/sh
# eait setup — the entrypoint for self-hosters. macOS and Linux.
#
#   ./scripts/setup.sh              interactive
#   ./scripts/setup.sh --help       usage
#
# Safe to re-run: it never overwrites an existing .env without asking, and every step is
# idempotent. Secrets are read without echoing and are never printed back.
#
# Non-interactive (CI, provisioning):
#   EAIT_NONINTERACTIVE=1 TELEGRAM_BOT_TOKEN=… OPENROUTER_API_KEY=… ./scripts/setup.sh
set -e

DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"

# ---------- output ----------

if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  B="$(printf '\033[1m')"; DIM="$(printf '\033[2m')"; R="$(printf '\033[0m')"
  GRN="$(printf '\033[32m')"; YEL="$(printf '\033[33m')"; RED="$(printf '\033[31m')"
else
  B=""; DIM=""; R=""; GRN=""; YEL=""; RED=""
fi

step() { printf '\n%s==>%s %s%s%s\n' "$GRN" "$R" "$B" "$1" "$R"; }
ok()   { printf '  %s✓%s %s\n' "$GRN" "$R" "$1"; }
warn() { printf '  %s!%s %s\n' "$YEL" "$R" "$1"; }
die()  { printf '\n%serror:%s %s\n' "$RED" "$R" "$1" >&2; exit 1; }
note() { printf '  %s%s%s\n' "$DIM" "$1" "$R"; }

usage() {
  cat <<'EOF'
eait setup — prepares a self-hosted instance.

  ./scripts/setup.sh          interactive setup
  ./scripts/setup.sh --help   this message

Steps: check prerequisites, install dependencies, verify the checkout, write .env,
optionally smoke-test the model, optionally install a background service.

Re-running is safe. An existing .env is never overwritten without asking.

Non-interactive:
  EAIT_NONINTERACTIVE=1 \
  TELEGRAM_BOT_TOKEN=… OPENROUTER_API_KEY=… [ALLOWED_USER_IDS=…] [TZ=…] \
  [GLOBAL_DAILY_ANALYSIS_CAP=…] [ADMIN_USER_ID=…] ./scripts/setup.sh

Skips prompts, writes .env from the environment, and does not install a service.
EOF
}

case "${1:-}" in
  -h|--help|help) usage; exit 0 ;;
  "") ;;
  *) usage; exit 1 ;;
esac

NONINTERACTIVE="${EAIT_NONINTERACTIVE:-}"

# `read -p` is not POSIX, so prompt with printf. Answer defaults to $2 on empty input.
ask() {
  _prompt="$1"; _default="$2"
  if [ -n "$_default" ]; then printf '  %s [%s]: ' "$_prompt" "$_default"
  else printf '  %s: ' "$_prompt"; fi
  read -r _answer || _answer=""
  [ -z "$_answer" ] && _answer="$_default"
  printf '%s' "$_answer"
}

# Same, but with terminal echo off — the value never appears on screen or in scrollback.
ask_secret() {
  printf '  %s: ' "$1"
  if [ -t 0 ]; then
    stty -echo 2>/dev/null || true
    read -r _answer || _answer=""
    stty echo 2>/dev/null || true
    printf '\n'
  else
    read -r _answer || _answer=""
  fi
  printf '%s' "$_answer"
}

confirm() { # confirm "question" -> 0 yes / 1 no. Default no.
  printf '  %s [y/N]: ' "$1"
  read -r _a || _a=""
  case "$_a" in [yY]|[yY][eE][sS]) return 0 ;; *) return 1 ;; esac
}

printf '%s\n' "${B}eait setup${R}"
note "$DIR"

# ---------- 1. prerequisites ----------

step "Checking prerequisites"

case "$(uname -s)" in
  Darwin) note "macOS detected" ;;
  Linux)  note "Linux detected" ;;
  *) die "unsupported OS: $(uname -s). macOS and Linux only." ;;
esac

if ! command -v bun >/dev/null 2>&1 && [ ! -x "$HOME/.bun/bin/bun" ]; then
  warn "bun is not installed."
  if [ -z "$NONINTERACTIVE" ] && confirm "Install bun now (curl https://bun.sh/install | bash)?"; then
    curl -fsSL https://bun.sh/install | bash || die "bun install failed"
    PATH="$HOME/.bun/bin:$PATH"; export PATH
  else
    die "bun is required. Install it: curl -fsSL https://bun.sh/install | bash"
  fi
fi
[ -x "$HOME/.bun/bin/bun" ] && PATH="$HOME/.bun/bin:$PATH" && export PATH
ok "bun $(bun --version)"

HAVE_DOCKER=""
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  HAVE_DOCKER=1
  ok "docker available"
else
  warn "docker is not available — the bot needs a reachable Postgres."
  warn "Either install docker (then 'sh scripts/db.sh up' runs one), or point PGHOST/PGPORT/"
  warn "PGUSER/PGPASSWORD in .env at a server you already have."
fi

# ---------- 2. dependencies ----------

step "Installing dependencies"
bun install >/dev/null 2>&1 || die "bun install failed — run 'bun install' to see why"
ok "dependencies installed"

# ---------- 3. database ----------

step "Postgres"
if [ -n "$HAVE_DOCKER" ]; then
  sh "$DIR/scripts/db.sh" up >/dev/null 2>&1 || die "could not start Postgres — run 'sh scripts/db.sh up' to see why"
  ok "shared dev Postgres up (sh scripts/db.sh {status|psql|down})"
else
  note "skipping — no docker; tests and the bot will use PG* from the environment"
fi

# ---------- 4. verify the checkout ----------

step "Verifying the checkout"
if bun test >/dev/null 2>&1; then
  ok "test suite passes"
else
  die "tests fail on a clean checkout — fix that before deploying. Run 'bun test' to see why. (The suite needs the Postgres from the previous step.)"
fi

# ---------- 5. configure ----------

step "Configuration"

WRITE_ENV=1
if [ -f .env ]; then
  if [ -n "$NONINTERACTIVE" ]; then
    warn ".env exists — keeping it (non-interactive)"; WRITE_ENV=0
  elif confirm ".env already exists. Replace it?"; then
    # -p preserves mode 600: the backup holds the same live secrets as the original, and cp
    # without it creates the copy under the ambient umask. Covered by .gitignore's .env.* rule.
    cp -p .env ".env.backup.$(date +%Y%m%d%H%M%S)"
    ok "existing .env backed up"
  else
    note "keeping the existing .env"; WRITE_ENV=0
  fi
fi

if [ "$WRITE_ENV" = "1" ]; then
  if [ -n "$NONINTERACTIVE" ]; then
    [ -n "${TELEGRAM_BOT_TOKEN:-}" ] || die "TELEGRAM_BOT_TOKEN is required in non-interactive mode"
    [ -n "${OPENROUTER_API_KEY:-}" ] || die "OPENROUTER_API_KEY is required in non-interactive mode"
    TOKEN="$TELEGRAM_BOT_TOKEN"; KEY="$OPENROUTER_API_KEY"
    ALLOWED="${ALLOWED_USER_IDS:-}"; ADMIN="${ADMIN_USER_ID:-}"
    ZONE="${TZ:-Europe/Berlin}"; CAP="${GLOBAL_DAILY_ANALYSIS_CAP:-}"
  else
    note "Telegram bot token — from @BotFather: send /newbot, then copy the token."
    note "Input is hidden."
    TOKEN="$(ask_secret 'TELEGRAM_BOT_TOKEN')"
    [ -n "$TOKEN" ] || die "a bot token is required"

    printf '\n'
    note "OpenRouter API key — https://openrouter.ai/keys (needs credit; vision is not free)."
    KEY="$(ask_secret 'OPENROUTER_API_KEY')"
    [ -n "$KEY" ] || die "an OpenRouter API key is required"

    printf '\n'
    note "Who may use this bot? Comma-separated Telegram user ids."
    note "Get yours from @userinfobot. LEAVE EMPTY = anyone who finds the bot can use it"
    note "and spend your API budget."
    ALLOWED="$(ask 'ALLOWED_USER_IDS' '')"

    printf '\n'
    if [ -z "$ALLOWED" ]; then
      note "The bot will be open. Set a daily ceiling on analyses across ALL users so a"
      note "stranger cannot run up your bill. Empty = unlimited."
      CAP="$(ask 'GLOBAL_DAILY_ANALYSIS_CAP' '100')"
    else
      CAP="$(ask 'GLOBAL_DAILY_ANALYSIS_CAP (empty = unlimited)' '')"
    fi

    printf '\n'
    note "Timezone decides when 'today' rolls over for daily totals."
    ZONE="$(ask 'TZ' "${TZ:-Europe/Berlin}")"

    printf '\n'
    note "Optional: the one Telegram id allowed to run /stats."
    ADMIN="$(ask 'ADMIN_USER_ID (optional)' '')"
  fi

  umask 077 # .env is secrets; never group/world readable
  cat > .env <<EOF
# Generated by scripts/setup.sh on $(date -u +%Y-%m-%dT%H:%M:%SZ)
TELEGRAM_BOT_TOKEN=$TOKEN
OPENROUTER_API_KEY=$KEY

ALLOWED_USER_IDS=$ALLOWED
GLOBAL_DAILY_ANALYSIS_CAP=$CAP

LLM_PROVIDER=openrouter
LLM_MODEL=x-ai/grok-4.5
LLM_TIMEOUT_MS=60000

# Postgres — defaults match the shared dev server from 'sh scripts/db.sh up'. The database
# is created on first boot; scripts/compose-env.sh points PGDATABASE at eait_<branch> per worktree.
PGHOST=127.0.0.1
PGPORT=5439
PGUSER=eait
PGPASSWORD=eait
PGDATABASE=eait

TZ=$ZONE
PER_USER_DAILY_PHOTO_CAP=50

ADMIN_USER_ID=$ADMIN
EOF
  ok ".env written (permissions 600)"
  if [ -z "$ALLOWED" ]; then
    if [ -n "$CAP" ]; then
      warn "bot is OPEN to anyone, capped at $CAP analyses/day"
    else
      warn "bot is OPEN to anyone with NO daily cap — anyone who finds it can spend your budget"
    fi
  else
    ok "access limited to: $ALLOWED"
  fi
fi

# ---------- 6. smoke test ----------

if [ -z "$NONINTERACTIVE" ]; then
  step "Model check"
  note "Sends one real image to the model to prove the key works and the model can see."
  note "This makes a billed API call."
  if confirm "Run it?"; then
    bun run smoke || warn "smoke test failed — check OPENROUTER_API_KEY, credit, and that LLM_MODEL is vision-capable"
  else
    note "skipped — run 'bun run smoke' later"
  fi
fi

# ---------- 7. service ----------

if [ -z "$NONINTERACTIVE" ]; then
  step "Run in the background?"
  note "Installs a service that starts on boot and restarts on crash"
  note "(launchd on macOS, a systemd user unit on Linux)."
  if confirm "Install it?"; then
    sh "$DIR/scripts/service.sh" install
    ok "use 'scripts/service.sh {status|logs|restart|stop}' from here on"
  else
    note "skipped — start manually with 'bun run start'"
  fi
fi

# ---------- done ----------

step "Done"
cat <<EOF
  Start it:      bun run start        (or: scripts/service.sh install, or: docker compose up -d)
  Postgres:      sh scripts/db.sh {up|status|psql|down}
  Then, in Telegram, message your bot: /start

  Docs:          docs/SELF_HOSTING.md
  Privacy:       docs/PRIVACY.md
EOF
