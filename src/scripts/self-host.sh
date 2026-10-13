#!/bin/sh
# Install and run eait on this machine, in Docker. One command, safe to run again.
#
#   curl -fsSL https://raw.githubusercontent.com/kirmalyshev/eait/main/src/scripts/self-host.sh | sh
#
# It clones (or fast-forwards) the repo, writes `.env.prod` once, and runs the repo's own
# `docker-compose.prod.yml` — the same stack `src/iac/` ships. There is no second stack here.
#
# Settings, all optional, read from the environment:
#   EAIT_DIR                       where the checkout lives         (default ~/eait)
#   EAIT_REF                       branch to run                    (default main)
#   EAIT_REPO                      git URL to clone                 (default the public repo)
#   EAIT_DOMAIN                    a public hostname whose DNS points here, for HTTPS on 80/443.
#                                  Unset: http://localhost:8080, reachable from this machine only.
#   EAIT_ACME_EMAIL                certificate expiry address; required with EAIT_DOMAIN
#   EAIT__BACKEND__LLM_API_KEY     the model key (OpenRouter by default); prompted for when unset
#   EAIT__BACKEND__TELEGRAM_BOT_TOKEN   optional; asked once, on the first run
#
# Secrets are read from the environment or the terminal with echo off, written to `.env.prod`
# (mode 600) and never printed or put in a command line. Re-running keeps every value already in
# `.env.prod` — generated database passwords above all, because changing one locks the backend out
# of its own Postgres — and only pulls code and rebuilds.
#
# POSIX sh, wrapped in main() so `curl | sh` parses the whole script before running any of it, and
# every external command reads /dev/null so none can swallow the rest of the script from stdin.
set -eu

die() { echo "self-host: $*" >&2; exit 1; }
say() { echo "==> $*"; }

# get FILE KEY — the value after the first `KEY=`, empty when absent.
get() { sed -n "s/^$2=//p" "$1" | head -n 1; }

# set FILE KEY VALUE — replace the first `KEY=` line. The value travels in the environment of awk,
# not its argv, so it never shows in `ps`.
set_var() {
  _tmp=$(mktemp "$1.XXXXXX")
  K="$2" V="$3" awk '
    BEGIN { k = ENVIRON["K"]; v = ENVIRON["V"] }
    !done && index($0, k "=") == 1 { print k "=" v; done = 1; next }
    { print }
    END { if (!done) print k "=" v }
  ' "$1" > "$_tmp" </dev/null
  mv "$_tmp" "$1"
}

# ask PROMPT — one line from the terminal with echo off, on stdout; empty when there is no terminal.
ask() {
  (: </dev/tty) 2>/dev/null || return 0
  printf '%s' "$1" >/dev/tty
  trap 'stty echo </dev/tty 2>/dev/null' EXIT INT TERM
  stty -echo </dev/tty
  IFS= read -r _v </dev/tty || _v=""
  stty echo </dev/tty
  trap - EXIT INT TERM
  printf '\n' >/dev/tty
  printf '%s' "$_v"
}

gen() { head -c 48 /dev/urandom | base64 | tr -d '\n=+/' | head -c 32; }

main() {
  EAIT_DIR=${EAIT_DIR:-$HOME/eait}
  EAIT_REF=${EAIT_REF:-main}
  EAIT_REPO=${EAIT_REPO:-https://github.com/kirmalyshev/eait.git}

  for c in git curl docker; do
    command -v "$c" >/dev/null 2>&1 || die "$c is not installed"
  done
  docker compose version >/dev/null 2>&1 </dev/null || die "docker compose v2 is missing (the legacy docker-compose binary is not enough)"
  docker info >/dev/null 2>&1 </dev/null || die "the docker daemon is not reachable — start it, or add this user to the docker group"

  say "code: $EAIT_REPO ($EAIT_REF) -> $EAIT_DIR"
  if [ -d "$EAIT_DIR/.git" ]; then
    git -C "$EAIT_DIR" pull --ff-only -q origin "$EAIT_REF" </dev/null \
      || die "could not fast-forward $EAIT_DIR — it has local changes or another branch checked out"
  else
    git clone -q --branch "$EAIT_REF" "$EAIT_REPO" "$EAIT_DIR" </dev/null
  fi
  cd "$EAIT_DIR"

  umask 077
  ENVF=.env.prod
  if [ ! -f "$ENVF" ]; then
    say "writing $ENVF (mode 600)"
    cp .env.prod.example "$ENVF"
    set_var "$ENVF" EAIT__DEPLOY__POSTGRES_PASSWORD "$(gen)"
    set_var "$ENVF" EAIT__DEPLOY__APP_DB_PASSWORD "$(gen)"
    if [ -n "${EAIT_DOMAIN:-}" ]; then
      [ -n "${EAIT_ACME_EMAIL:-}" ] || die "EAIT_DOMAIN needs EAIT_ACME_EMAIL, for certificate expiry notices"
      set_var "$ENVF" EAIT__DEPLOY__DOMAIN "$EAIT_DOMAIN"
      set_var "$ENVF" EAIT__DEPLOY__ACME_EMAIL "$EAIT_ACME_EMAIL"
      set_var "$ENVF" EAIT__BACKEND__PUBLIC_API_URL "https://$EAIT_DOMAIN"
      set_var "$ENVF" EAIT__BACKEND__PUBLIC_WEB_URL "https://$EAIT_DOMAIN"
    else
      # `http://` makes Caddy skip TLS for this one site; loopback + 8080 keeps it off the network
      # and off a port something else probably holds.
      set_var "$ENVF" EAIT__DEPLOY__DOMAIN "http://localhost"
      set_var "$ENVF" EAIT__DEPLOY__ACME_EMAIL "admin@localhost"
      set_var "$ENVF" EAIT__DEPLOY__BIND_ADDR "127.0.0.1"
      set_var "$ENVF" EAIT__DEPLOY__HTTP_PORT "8080"
      set_var "$ENVF" EAIT__BACKEND__PUBLIC_API_URL "http://localhost:8080"
      set_var "$ENVF" EAIT__BACKEND__PUBLIC_WEB_URL "http://localhost:8080"
    fi
    key=${EAIT__BACKEND__TELEGRAM_BOT_TOKEN:-}
    [ -n "$key" ] || key=$(ask "Telegram bot token from @BotFather (enter to skip): ")
    [ -z "$key" ] || set_var "$ENVF" EAIT__BACKEND__TELEGRAM_BOT_TOKEN "$key"
  fi

  if [ -z "$(get "$ENVF" EAIT__BACKEND__LLM_API_KEY)" ]; then
    key=${EAIT__BACKEND__LLM_API_KEY:-}
    [ -n "$key" ] || key=$(ask "OpenRouter API key (https://openrouter.ai/keys): ")
    [ -n "$key" ] || die "no model key: export EAIT__BACKEND__LLM_API_KEY, or run from a terminal"
    set_var "$ENVF" EAIT__BACKEND__LLM_API_KEY "$key"
  fi
  unset key

  say "building and starting the stack"
  docker compose -f docker-compose.prod.yml --env-file "$ENVF" up -d --build </dev/null

  domain=$(get "$ENVF" EAIT__DEPLOY__DOMAIN)
  port=$(get "$ENVF" EAIT__DEPLOY__HTTP_PORT)
  case "$domain" in
    http://*) host=localhost; scheme=http;  port=${port:-80};  shown=$(get "$ENVF" EAIT__BACKEND__PUBLIC_WEB_URL) ;;
    *)        host=$domain;   scheme=https; port=$(get "$ENVF" EAIT__DEPLOY__HTTPS_PORT); port=${port:-443}
              shown="https://$domain" ;;
  esac
  # Caddy answers an empty 200 to a Host it has no site for, so the request names the site and the
  # reply must be the backend's own `{"ok":true,...}` — not just any 200.
  url="$scheme://$host:$port/health"

  say "waiting for $url"
  i=0
  until curl -fsS --resolve "$host:$port:127.0.0.1" -m 5 "$url" </dev/null 2>/dev/null | grep -q '"ok":true'; do
    i=$((i + 1))
    if [ "$i" -ge 60 ]; then
      case "$domain" in
        http://*) die "no answer on $url after 3 minutes — docker compose -f $EAIT_DIR/docker-compose.prod.yml logs" ;;
        *)        echo "self-host: $domain does not answer yet — its DNS must point here for the certificate to issue" >&2; break ;;
      esac
    fi
    sleep 3
  done

  say "up: $shown"
  echo "    logs:    docker compose -f $EAIT_DIR/docker-compose.prod.yml logs -f"
  echo "    upgrade: run the same command again"
  echo "    stop:    docker compose -f $EAIT_DIR/docker-compose.prod.yml down"
}

main "$@"
