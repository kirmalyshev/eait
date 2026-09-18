#!/bin/sh
# Everything this repo needs on the machine, installed once. macOS and Linux.
#
#   ./dev install              install whatever is missing
#   ./dev install --check      report only, change nothing (exit 1 if anything required is missing)
#
# ─────────────────────────────────────────────────────────────────────────────────────────────
# WHY THIS EXISTS, AND WHY IT IS PLAIN `sh`
#
# It is the ONE command that runs before the repo works, so it may not use anything the repo
# installs. No bun — `bun` is the first thing it puts on the machine. That is also why `dev.sh`
# dispatches `install` before `ensure_env`: every other subcommand may assume a working checkout,
# and this one is what makes the checkout work.
#
# EVERYTHING HERE IS PORTABLE, and that is a property of this repo rather than an achievement of
# this script. What lives here is a backend, a contract and a web application — TypeScript, bun and
# a Postgres in Docker. The private monorepo that carries this repository as a submodule also holds
# an iOS app, and its copy of this file installs Xcode, Maestro, a JDK and a compiler cache for it.
# None of that is installed here, because none of it can be used here.
#
# FOUR THINGS THAT LOOK INSTALLED AND ARE NOT
#
# 1. `bun` lands in ~/.bun/bin and its installer edits your PROFILE — the shell you are in still
#    cannot see it. This script puts it on PATH for its own later checks and tells you to re-open
#    the shell, because the next command you type would otherwise say `bun: command not found` on
#    a machine that has bun.
# 2. `docker` on PATH says nothing about a running daemon. `docker info` is the check; `db.sh`
#    fails on the daemon, not on the binary.
# 3. Compose v2 is a docker SUBCOMMAND. A machine carrying only the legacy `docker-compose` binary
#    passes every `command -v docker-compose` test and fails every `docker compose` call in
#    `db.sh`. The check has to be `docker compose version`.
# 4. `ps` on Alpine is BUSYBOX's, which is on PATH and rejects `-p` — the one flag `dev.sh` asks it
#    with. `command -v ps` there reports a tool that cannot answer a single question this repo has,
#    so the check is the question itself: `ps -o command= -p $$`.
# ─────────────────────────────────────────────────────────────────────────────────────────────
set -eu

# Resolved BEFORE the cd: `$0` is relative to the invoking directory, so `--help` read it from the
# wrong place after `cd` and exited non-zero with nothing printed.
SELF=$(cd "$(dirname "$0")" && pwd)/$(basename "$0")
cd "$(dirname "$0")/../.."

CHECK=0
for arg in "$@"; do
  case "$arg" in
    --check)   CHECK=1 ;;
    -h|--help)
      awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$SELF"
      exit 0
      ;;
    *) echo "install: unknown option $arg (try --help)" >&2; exit 1 ;;
  esac
done

OS=$(uname -s)

# Report lines are collected and printed together: a wall of install output with the verdict
# scattered through it is what makes people re-run this to find out whether it worked.
REPORT=""
MISSING=0
# Set when something was installed into a directory this shell's PATH does not carry. The closing
# line depends on it: `./dev up` runs `bun install` on its first command, so telling you to run it
# from the shell that just installed bun sends you into `bun: command not found`.
RESHELL=0
note() { REPORT="$REPORT$1
"; }
ok()   { note "  ok         $1"; }
did()  { note "  INSTALLED  $1"; }
skip() { note "  skipped    $1 — $2"; }
gone() { note "  MISSING    $1 — $2"; MISSING=$((MISSING + 1)); }

have() { command -v "$1" >/dev/null 2>&1; }
# Never fatal on its own. Every caller verifies the RESULT afterwards, and a package manager that
# fails should produce a line in the report, not a bare `set -e` exit with nothing printed — which
# is exactly what a missing `unzip` did before it was a prerequisite.
run()  { echo "→ $*"; "$@" || return 1; }

# The privilege escalation is named once. Root needs none; a machine with neither root nor sudo
# gets told the command rather than a permission error from inside a package manager.
SUDO=""
if [ "$(id -u)" != "0" ]; then
  if have sudo; then SUDO="sudo"; fi
fi

# ── Linux package manager ────────────────────────────────────────────────────────────────────
PM=""
if [ "$OS" = "Linux" ]; then
  for _p in apt-get dnf pacman zypper apk; do
    if have "$_p"; then PM="$_p"; break; fi
  done
fi

pm_install() {
  # $@ = the package names for the detected manager, already translated by the caller.
  if [ -z "$PM" ]; then
    gone "$1" "no supported package manager found (apt-get, dnf, pacman, zypper, apk)"
    return 1
  fi
  if [ -z "$SUDO" ] && [ "$(id -u)" != "0" ]; then
    gone "$1" "needs root and sudo is not available — run: $PM install $*"
    return 1
  fi
  case "$PM" in
    apt-get) run $SUDO env DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a apt-get update -qq \
             && run $SUDO env DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a apt-get install -y "$@" ;;
    dnf)     run $SUDO dnf install -y "$@" ;;
    pacman)  run $SUDO pacman -Syu --noconfirm "$@" ;;
    zypper)  run $SUDO zypper install -y "$@" ;;
    apk)     run $SUDO apk add "$@" ;;
  esac
}

# ── git, curl, unzip, bash, lsof, ps ─────────────────────────────────────────────────────────
# curl is not a nicety: it is how bun is installed, so it is checked before it.
# NEITHER IS unzip. bun's own installer shells out to it and stops with "unzip is required to
# install bun" — a bare Ubuntu image has curl available to install and no unzip, so bun failed at
# the one step this script exists to perform. NOR IS bash: that installer is `#!/usr/bin/env bash`,
# and Alpine ships only busybox ash, so bun cannot install there at all without it. macOS has both,
# so neither ever bites on a Mac.
# musl: bun's glibc binary needs these to relocate at all. Harmless anywhere else, so it is a
# single extra name on the one package manager that needs it rather than a branch in the loop.
if [ "$PM" = "apk" ]; then
  for _shim in gcompat libstdc++; do
    if [ "$CHECK" != "1" ]; then pm_install "$_shim" >/dev/null 2>&1 || true; fi
  done
fi

# lsof AND ps ARE HOW A PIDFILE IS CHECKED, and this script could produce a machine without either:
# `./dev down` there deleted the pidfile, reported success and left the backend holding the port,
# because a missing binary answers "no" to every question about a process and that is the same "no"
# a stale pidfile gives (#363). `dev.sh` now refuses instead, and points at this command — so this
# command has to be able to fix it. `pgrep` comes in the same package as `ps` and `down` uses it too.
have_tool() {
  case "$1" in
    # See note 6: presence is not the test, the flag `dev.sh` uses is.
    ps) ps -o command= -p $$ >/dev/null 2>&1 ;;
    *)  have "$1" ;;
  esac
}
# The package where it is not the tool's own name — `ps` and `pgrep` are one package under two
# spellings. Each verified in that distro's own container (Debian trixie, Fedora 41, openSUSE Leap
# 15.6, Alpine 3.21); Arch is the one not, for the same reason as docker's names below.
pkg_of() {
  case "$1" in
    ps) case "$PM" in dnf|pacman|apk) echo procps-ng ;; *) echo procps ;; esac ;;
    *)  echo "$1" ;;
  esac
}

for tool in git curl unzip bash lsof ps; do
  if have_tool "$tool"; then
    ok "$tool"
  elif [ "$CHECK" = "1" ]; then
    if have "$tool"; then
      gone "$tool" "on PATH, but it cannot answer what this repo asks it — install $(pkg_of "$tool")"
    else
      gone "$tool" "not installed"
    fi
  elif [ "$OS" = "Darwin" ]; then
    gone "$tool" "install the Xcode command line tools: xcode-select --install"
  else
    # Install THEN verify, like every other step here: on Alpine the package has to REPLACE a
    # busybox applet, and `did` straight after the command is the one shape that can report a tool
    # that is still the one that could not answer.
    if pm_install "$(pkg_of "$tool")"; then
      if have_tool "$tool"; then did "$tool"; else gone "$tool" "$(pkg_of "$tool") did not produce a working $tool"; fi
    fi
  fi
done

# ── bun ──────────────────────────────────────────────────────────────────────────────────────
# PRESENT IS NOT WORKING. bun's installer places a GLIBC binary on musl systems without complaint;
# on Alpine it then exits 127 with "Error relocating ... symbol not found", and a check that only
# asks `command -v bun` reports it INSTALLED with an empty version. `gcompat` and `libstdc++` are
# what make it run there — both verified in alpine:3.21, where bun answers 1.4.0 with them and 127
# without.
bun_version() { bun --version 2>/dev/null | head -1 | tr -d '[:space:]'; }
bun_works()   { case "$(bun_version)" in [0-9]*.[0-9]*) return 0 ;; *) return 1 ;; esac; }
# Pinned to the floor in package.json's `packageManager` rather than a literal here, so the two
# cannot disagree. `sed` and not bun, for the reason at the top of this file.
BUN_WANT=$(sed -n 's/.*"packageManager"[[:space:]]*:[[:space:]]*"bun@\([0-9.]*\)".*/\1/p' package.json)
[ -n "$BUN_WANT" ] || BUN_WANT="1.4.0"

if have bun && bun_works; then
  ok "bun $(bun_version) (repo wants >= $BUN_WANT)"
elif have bun; then
  gone "bun" "the binary is on PATH but does not run — on musl (Alpine) it needs: gcompat libstdc++"
elif [ -x "${BUN_INSTALL:-$HOME/.bun}/bin/bun" ]; then
  PATH="${BUN_INSTALL:-$HOME/.bun}/bin:$PATH"
  export PATH
  if bun_works; then
    RESHELL=1
    ok "bun $(bun_version) — installed but not on this shell's PATH yet"
  else
    gone "bun" "installed but it does not run — on musl (Alpine) it needs: gcompat libstdc++"
  fi
elif [ "$CHECK" = "1" ]; then
  gone "bun" "not installed"
else
  run sh -c 'curl -fsSL https://bun.sh/install | bash' || true
  PATH="${BUN_INSTALL:-$HOME/.bun}/bin:$PATH"
  export PATH
  if have bun && bun_works; then
    RESHELL=1
    did "bun $(bun_version) — RE-OPEN YOUR SHELL, or: export PATH=\"\$HOME/.bun/bin:\$PATH\""
  elif have bun; then
    gone "bun" "installed but it does not run — on musl (Alpine) it needs: gcompat libstdc++"
  else
    gone "bun" "the installer ran but bun is still not on PATH"
  fi
fi

# ── docker, and the compose v2 subcommand ────────────────────────────────────────────────────
# 0 = docker and compose v2 both work. 1 = no docker at all. 2 = docker, but no compose v2 — a
# DIFFERENT repair from a missing engine, and the common half-provisioned state on a machine that
# has only distro `docker.io`. Collapsing 2 into 0 made the caller take the no-op arm and print
# MISSING without ever installing the plugin it had just named.
docker_report() {
  if ! have docker; then
    return 1
  fi
  if ! docker compose version >/dev/null 2>&1; then
    return 2
  fi
  if docker info >/dev/null 2>&1; then
    ok "docker $(docker compose version --short 2>/dev/null | sed 's/^/(compose /;s/$/)/')"
  else
    # Not counted as missing: the daemon being stopped is a state, not an absent tool, and
    # `db.sh` says the same thing when it hits it.
    note "  ok         docker — installed, but the daemon is not running (start Docker and re-check)"
  fi
  return 0
}

docker_report || DOCKER_RC=$?
DOCKER_RC=${DOCKER_RC:-0}

if [ "$DOCKER_RC" = "0" ]; then
  :
elif [ "$CHECK" = "1" ]; then
  if [ "$DOCKER_RC" = "2" ]; then
    gone "docker compose" "the v2 plugin is missing — a legacy \`docker-compose\` binary does not satisfy \`db.sh\`"
  else
    gone "docker" "not installed"
  fi
elif [ "$DOCKER_RC" = "2" ]; then
  # The engine is fine. Install the plugin and nothing else.
  case "$PM" in
    apt-get) pm_install docker-compose-v2 || true ;;
    dnf)     pm_install docker-compose || true ;;
    pacman)  pm_install docker-compose || true ;;
    zypper)  pm_install docker-compose || true ;;
    apk)     pm_install docker-cli-compose || true ;;
    *)       gone "docker compose" "install the v2 plugin: https://docs.docker.com/compose/install/" ;;
  esac
  if docker compose version >/dev/null 2>&1; then
    did "docker compose $(docker compose version --short 2>/dev/null)"
  else
    gone "docker compose" "the v2 plugin is still missing — https://docs.docker.com/compose/install/"
  fi
elif [ "$OS" = "Darwin" ]; then
  if have brew; then
    run brew install --cask docker-desktop || true
    if ! docker_report; then gone "docker" "installed, but not working yet — open Docker Desktop once to finish setup"; fi
  else
    gone "docker" "install Docker Desktop: https://docs.docker.com/desktop/install/mac-install/"
  fi
else
  # THE COMPOSE PLUGIN IS NOT NAMED THE SAME THING TWICE. `docker-compose-plugin` is Docker's OWN
  # apt repository and is not in Ubuntu's — asking for it there fails the whole transaction with
  # "Unable to locate package", so the engine does not get installed either and the report reads
  # "install did not produce a working docker" on a machine where docker.io was available all
  # along. Ubuntu 24.04 ships compose v2 as `docker-compose-v2`. Each package is therefore
  # installed SEPARATELY: a name this distro spells differently costs its own line, not the engine.
  #
  # The names are what each distro actually publishes, checked in its own container rather than
  # assumed: Ubuntu `docker.io` + `docker-compose-v2`, Fedora `moby-engine` + `docker-compose` (it
  # has no `docker` package at all), Alpine `docker` + `docker-cli-compose`, openSUSE `docker` +
  # `docker-compose`. Arch is the one pair not verified here — no arm64 image to check it against.
  # QUIET: `pm_install` reports its own failure, and then the verdict below reports the tool's.
  # Counting both made one absent docker two MISSING lines and an inflated total.
  _q=$MISSING
  case "$PM" in
    apt-get) pm_install docker.io || true; pm_install docker-compose-v2 || true ;;
    dnf)     pm_install moby-engine || true; pm_install docker-compose || true ;;
    pacman)  pm_install docker || true; pm_install docker-compose || true ;;
    zypper)  pm_install docker || true; pm_install docker-compose || true ;;
    apk)     pm_install docker || true; pm_install docker-cli-compose || true ;;
    *)       : ;;
  esac
  MISSING=$_q
  if ! docker_report; then gone "docker" "the package manager did not produce a working docker — https://docs.docker.com/engine/install/"; fi
  # The group membership is the difference between `docker info` working for root and for you, and
  # it does not take effect until the next login. Saying so beats a permission denied later.
  if [ -n "${SUDO}${USER:-}" ] && ! docker info >/dev/null 2>&1; then
    note "           you may need: $SUDO usermod -aG docker \${USER:-\$(id -un)} — then log out and back in"
  fi
fi

# ── the repo's own dependencies ──────────────────────────────────────────────────────────────
if [ "$CHECK" = "1" ]; then
  if [ -d node_modules ]; then ok "node_modules"; else gone "node_modules" "run: bun install"; fi
elif have bun && bun_works; then
  # Install THEN verify, like every other step here. Reporting `ok` straight after the command is
  # the one shape that can exit 0 with the thing genuinely absent.
  if [ ! -d node_modules ]; then run bun install || true; fi
  if [ -d node_modules ]; then ok "node_modules"; else gone "node_modules" "bun install did not produce one — run it by hand and read the error"; fi
else
  gone "node_modules" "bun is not available yet — re-open your shell and run ./dev install again"
fi

# ── verdict ──────────────────────────────────────────────────────────────────────────────────
if [ "$CHECK" = "1" ]; then VERB=Checked; else VERB=Installed; fi
printf '\n%s on %s\n' "$VERB" "$OS"
printf '%s' "$REPORT"
if [ "$MISSING" -gt 0 ]; then
  printf '\n%d thing(s) still need you. Nothing above was guessed at — each line says what to run.\n' "$MISSING" >&2
  exit 1
fi
if [ "$RESHELL" = "1" ]; then
  printf '\nRE-OPEN YOUR SHELL first — what was just installed is not on this one'"'"'s PATH. Then: ./dev up --demo\n'
else
  printf '\nReady. Next: ./dev up --demo   (no database and no model key), or ./dev up --all\n'
fi
