#!/bin/sh
# This worktree's dev stack, in the background, on this worktree's ports.
#
#   ./dev up [--backend|--demo] [--web] [--all]
#   ./dev down                       stop everything this worktree started (the shared Postgres
#                                    stays up — the other worktrees use it)
#   ./dev restart [same flags]       bare: whatever `up` last asked for, including what has crashed
#   ./dev status                     this worktree
#   ./dev ls [--plain]               EVERY worktree on this machine, and what each is running
#   ./dev seed                       put the development accounts into this worktree's database:
#                                    the ordinary ones and the account that holds the admin role,
#                                    which is the only way into /admin. Replaces its own accounts,
#                                    so it is safe to re-run and leaves anything you made by hand.
#   ./dev test [args…]               the unit suites PLUS the store contract suite against this
#                                    worktree's own TEST database (`bun run test` leaves that suite
#                                    skipped, so `bun run check` never needs Docker)
#   ./dev logs [service]
#   ./dev db [up|down|psql|…]        the shared Postgres and this worktree's two databases in it
#   ./dev env | url
#   ./dev install [--check]          every tool this repo needs, on macOS or Linux. The one command
#                                    that runs before the checkout works, so it uses no bun.
#
# ─────────────────────────────────────────────────────────────────────────────────────────────
# WHY THIS EXISTS
#
# `bun run demo` and `bun run web` each hold a terminal, and with several worktrees checked out
# that is two windows per checkout — neither of which says which one it belongs to. This starts the
# same commands detached, one pidfile each, and can then answer what is running and on which port.
# It ADDS NOTHING to the derivation: every port and database still comes from `src/scripts/dev-env.ts`
# through `.env.worktree`, and this file computes none of them.
#
# STOPPING ONE KILLS THE TREE IT STARTED — the launching shell and the `bun` under it — and nothing
# else. It does that by walking `ppid` (`descendants` below), NOT by signalling a process group: a
# nohup'd command is not reliably a group leader, so a group kill silently signals the wrong thing
# or nothing. A pidfile is never trusted on its own either: the PID must still be running a command
# that looks like the service that wrote it, AND out of this worktree, or the file is stale and is
# removed rather than acted on. Without that check a recycled PID makes `./dev down` kill an
# unrelated program — or, worse, a sibling worktree's identical command.
# ─────────────────────────────────────────────────────────────────────────────────────────────
set -eu

cd "$(dirname "$0")/../.."

# The PHYSICAL path, because it is compared against what `lsof` reports for a running process, and
# `lsof` resolves symlinks while `cd` keeps the logical path. A worktree reached through a symlink
# would otherwise never match its own processes.
ROOT=$(pwd -P)
STATE=.dev
LOGS="$STATE/logs"
UP_LOCK="$STATE/up.lock"
# TWO APPLICATIONS. The backend — the API and `/start` — and the web application, which is its own
# process on its own port because the browser client and the API are separate things.
ALL_SERVICES="backend web"

die() { echo "dev: $*" >&2; exit 1; }

ensure_env() {
  [ -d node_modules ] || { echo '→ bun install'; bun install; }
  [ -f .env.worktree ] || { echo '→ deriving this worktree (bun src/scripts/dev-env.ts setup)'; bun src/scripts/dev-env.ts setup; }
}

main_worktree() {
  _m=$(git worktree list --porcelain | sed -n '1s/^worktree //p')
  if [ -d "$_m" ]; then (cd "$_m" && pwd -P); else echo "$_m"; fi
}

# `worktree.sh` falls back to slot 0 when `.env.worktree` is missing. In the MAIN worktree that is
# correct and silence is right — it IS slot 0. In a linked one it is a lie, and a loud one: every
# port answered would be the main worktree's.
#
# IT IS A REFUSAL AND NOT A WARNING because `./dev url` exists to be substituted, and a warning on
# stderr is invisible inside `$( )`. `up` derives first and never reaches this.
load_env() {
  if [ ! -f .env.worktree ] && [ "$ROOT" != "$(main_worktree)" ]; then
    die 'this worktree has no .env.worktree, so every port here would be the MAIN worktree'"'"'s. Run `./dev up` (or `./dev env`) first.'
  fi
  . ./src/scripts/worktree.sh
}

# ── The service table ────────────────────────────────────────────────────────────────────────

# RUN FROM THE REPO ROOT BY ENTRY PATH, not `--cwd`. bun loads `.env` from its working directory,
# so `bun run --cwd src/backend start` would look for `src/backend/.env` and find nothing — the
# server would come up on defaults, against no database and with no model key, which looks exactly
# like a configuration that was read and ignored.
#
# Each returns a command whose LAST process is the server, so the pidfile names something
# `svc_needle` can recognise. The web application builds before it serves, so its `exec` is the
# second half of an `&&` rather than the first word.
#
# `[ cond ] && echo A || echo B` is deliberately not used: if `echo A` ever fails (a closed log fd
# during shutdown is enough) the `||` arm runs too, and `svc_cmd` returns BOTH lines.
svc_cmd() {
  case "$1" in
    backend)
      if [ "${BACKEND_MODE:-real}" = demo ]; then
        echo 'exec bun src/backend/index.ts --demo'
      else
        echo 'exec bun src/backend/index.ts'
      fi ;;
    web) echo 'bun run web:build && exec bun src/frontend/server/index.ts' ;;
  esac
}

# What the process must show in `ps` for its pidfile to count. EACH ONE NAMES THE ENTRY FILE, not a
# word that appears in it: `bun` alone would match any bun this worktree happens to be running,
# including a test run started by hand.
svc_needle() {
  case "$1" in
    backend) echo 'src/backend/index\.ts' ;;
    web)     echo 'src/frontend/server/index\.ts' ;;
  esac
}

# EMPTY, NOT FATAL, when `load_env` has not run. `cmd_down` in an underived worktree stops services
# without it, and under `set -u` an unset port here would kill the first service and abort `down`
# with the rest still up.
svc_port() {
  case "$1" in
    backend) echo "${EAIT_BACKEND_PORT-}" ;;
    web)     echo "${EAIT_WEB_PORT-}" ;;
  esac
}

# A bound port is not a working service. `/health` on both rather than `/`, because the web
# application answers 404 at `/` until its bundle exists — and that build is one this very command
# is doing, so a check on `/` would call a still-building service dead.
svc_health() {
  case "$1" in
    backend) curl -sf -o /dev/null --max-time 3 "$EAIT_API_URL/health" ;;
    web)     curl -sf -o /dev/null --max-time 3 "$EAIT_WEB_URL/health" ;;
  esac
}

# How long each may take before it is worth saying something. The web application BUILDS before it
# serves, which is why these are not one number.
svc_timeout() {
  case "$1" in
    backend) echo 60 ;;
    web)     echo 120 ;;
  esac
}

# ── Processes ────────────────────────────────────────────────────────────────────────────────

pid_of() { cat "$STATE/$1.pid" 2>/dev/null || true; }

# WHOSE process it is, which a needle cannot answer.
#
# A needle says which SERVICE a pid is running, and every worktree runs the identical command. So a
# guard built on the needle alone does not cover the collision most likely to happen on this
# machine: worktree A's pidfile goes stale, the OS hands that number to worktree B's backend, and
# `./dev down` in A kills a live stack next door.
#
# Every service is started from this root, so the working directory is what tells two worktrees'
# identical commands apart. One `lsof` call, ~30 ms.
proc_in_worktree() {
  require_proc_tools
  _cwd=$(lsof -a -d cwd -p "$1" -Fn 2>/dev/null | sed -n 's/^n//p' | head -1)
  case "$_cwd" in "$ROOT"|"$ROOT"/*) return 0 ;; *) return 1 ;; esac
}

# THE TWO QUESTIONS ABOVE HAVE TO BE ASKABLE, and a machine without `ps` or `lsof` answers neither
# — silently, and with the same "no" a stale pidfile gives. `is_running_now` cannot tell those
# apart, so it would remove the pidfile and report the service stopped while it kept the port, with
# nothing left in the repo able to name the process again. A REFUSAL IS THE ONLY HONEST ANSWER: a
# pidfile may never be deleted on the strength of a question that was not asked.
#
# PRESENT IS NOT ENOUGH, so each is asked the exact question it is here for, about a process that
# certainly exists — this shell, which runs out of `$ROOT` by construction. Alpine's busybox `ps` is
# on PATH and rejects `-p`, and its `lsof` does not know `-Fn`: `command -v` calls both of those
# installed, and both answer nothing.
#
# ONCE PER COMMAND, NOT PER PIDFILE. The flag is set BEFORE the probes, which is also what stops
# `proc_in_worktree` here from asking itself.
_PROC_TOOLS=""
require_proc_tools() {
  [ -z "$_PROC_TOOLS" ] || return 0
  _PROC_TOOLS=asked
  if [ -z "$(ps -o command= -p $$ 2>/dev/null)" ]; then
    die 'no working `ps` — it cannot say what a pid is running, and a pidfile that cannot be checked is not a pidfile that is stale. Refusing rather than reporting a live service as stopped. Install it (`procps`; `procps-ng` on Fedora, Arch and Alpine), or: ./dev install'
  fi
  proc_in_worktree $$ || die 'no working `lsof` — it cannot say which worktree a pid is running out of, and a pidfile that cannot be checked is not a pidfile that is stale. Refusing rather than reporting a live service as stopped. Install `lsof`, or: ./dev install'
}

running_forget() { eval "unset _RUN_$1" 2>/dev/null || true; }

is_running() {
  eval "_cached=\${_RUN_$1-}"
  case "$_cached" in
    yes) return 0 ;;
    no)  return 1 ;;
  esac
  if is_running_now "$1"; then eval "_RUN_$1=yes"; return 0; fi
  eval "_RUN_$1=no"; return 1
}

is_running_now() {
  _pid=$(pid_of "$1")
  [ -n "$_pid" ] || return 1
  # BEFORE the first question, because the `&&` below short-circuits: a `ps` that cannot answer
  # never reaches `proc_in_worktree`, and the `rm -f` at the end of this function is why that
  # matters. No pidfile, no question, no refusal — hence after the check above.
  require_proc_tools
  # All three matter: alive, still running this service, and running it out of THIS worktree.
  if kill -0 "$_pid" 2>/dev/null \
     && ps -o command= -p "$_pid" 2>/dev/null | grep -qE "$(svc_needle "$1")" \
     && proc_in_worktree "$_pid"; then
    return 0
  fi
  rm -f "$STATE/$1.pid"
  return 1
}

start_service() {
  if is_running "$1"; then
    echo "  $1: already running (pid $(pid_of "$1"))"
    return 0
  fi
  mkdir -p "$LOGS"
  # `set -m` puts the child in its own process group.
  (
    set -m
    # `</dev/null` IS NOT REDUNDANT. GNU nohup redirects stdin from an unreadable file; BSD's, which
    # is what macOS ships, redirects stdout only — and a server that sees a TTY on stdin from a
    # background process group can take SIGTTOU or race your shell for keystrokes.
    nohup sh -c "$(svc_cmd "$1")" </dev/null >>"$LOGS/$1.log" 2>&1 &
    echo $! >"$STATE/$1.pid"
  )
  running_forget "$1"
  echo "  $1: started (log: $LOGS/$1.log)"
}

# Every process descended from $1, parents before children, ITSELF EXCLUDED.
#
# THIS IS NOT A PROCESS-GROUP KILL, deliberately. `kill -TERM -$pid` needs $pid to be a process
# GROUP id, and a nohup'd command's is not reliably one — `set -m` inside the `( … )` subshell above
# does not make it a group leader under dash. The group kill then fails on every service and a
# fallback that kills the launching shell alone leaves the server under it holding the port.
#
# `ps -eo pid,ppid` and awk, because the portable alternatives are not: macOS ships no `setsid`, and
# `pgrep -P` lists one generation. ONE SNAPSHOT, taken before anything is signalled — the moment the
# parent dies its children are reparented to init and the tree that named them is gone.
descendants() {
  _snap=$(ps -eo pid,ppid 2>/dev/null | awk 'NR > 1 { print $1, $2 }')
  _gen=$1
  _found=""
  # Bounded rather than `while [ -n "$_gen" ]`: a process tree cannot contain a cycle, but a
  # snapshot read while pids are being recycled is not something to loop on forever.
  _depth=0
  while [ -n "$_gen" ] && [ "$_depth" -lt 12 ]; do
    _next=$(echo "$_snap" | awk -v ps="$_gen" '
      BEGIN { n = split(ps, a, " "); for (i = 1; i <= n; i++) want[a[i]] = 1 }
      $2 in want && $1 != 1 { print $1 }')
    [ -n "$_next" ] || break
    _found="$_found $_next"
    _gen=$_next
    _depth=$((_depth + 1))
  done
  echo $_found
}

stop_service() {
  is_running "$1" || { rm -f "$STATE/$1.pid"; return 0; }
  _pid=$(pid_of "$1")
  _tree="$_pid $(descendants "$_pid")"
  for _p in $_tree; do kill -TERM "$_p" 2>/dev/null || true; done
  _waited=0
  while kill -0 "$_pid" 2>/dev/null && [ "$_waited" -lt 10 ]; do
    sleep 1
    _waited=$((_waited + 1))
  done
  # The leader first, then anything under it that did not take the hint. Checked with `kill -0`
  # rather than signalled blind, because these pids are seconds old and a recycled one is a
  # stranger's process.
  for _p in $_tree; do
    kill -0 "$_p" 2>/dev/null && kill -KILL "$_p" 2>/dev/null
  done
  true
  rm -f "$STATE/$1.pid"
  running_forget "$1"
  # THE SOCKET OUTLIVES THE WAIT ABOVE when the leader is a shell and the listener is the `bun`
  # under it: the leader exits first, so the wait returns while the child is still tearing down —
  # and `./dev restart` then reaches its own port pre-check, finds the port still LISTENing with no
  # pidfile naming it, and dies having stopped the stack it was restarting.
  _port=$(svc_port "$1")
  _waited=0
  while [ -n "$_port" ] && lsof -nP -iTCP:"$_port" -sTCP:LISTEN >/dev/null 2>&1 && [ "$_waited" -lt 5 ]; do
    sleep 1
    _waited=$((_waited + 1))
  done
  echo "  $1: stopped"
}

wait_for() {
  _timeout=$(svc_timeout "$1")
  _waited=0
  printf '  waiting for %s' "$1"
  until svc_health "$1"; do
    # A DEAD SERVICE IS NOT A SLOW ONE. Polling health alone spends the whole timeout on a backend
    # that exits in a second for want of a key, so a fully broken stack takes minutes to report
    # what was knowable immediately.
    _alive=$(pid_of "$1")
    if [ -n "$_alive" ] && ! kill -0 "$_alive" 2>/dev/null; then
      printf ' died on startup — see %s/%s.log\n' "$LOGS" "$1"
      return 1
    fi
    sleep 2
    _waited=$((_waited + 2))
    printf '.'
    if [ "$_waited" -ge "$_timeout" ]; then
      printf ' not healthy after %ss — see %s/%s.log\n' "$_timeout" "$LOGS" "$1"
      return 1
    fi
  done
  printf ' ok\n'
}

warn_branch_drift() { bun src/scripts/dev-env.ts branch-check || true; }

# ── Commands ─────────────────────────────────────────────────────────────────────────────────

# The service set a bare `./dev restart` brings back: what this invocation asked for UNIONED with
# what is already up.
#
# Written by `up` rather than read from the pidfiles, because a service that CRASHED has no pidfile
# and is exactly the one you want back. And a union rather than an overwrite, because overwriting
# would make `./dev up --demo` followed by `./dev up --web` record the web app alone, so a later
# bare restart silently drops the backend.
record() {
  mkdir -p "$STATE"
  _rec=""
  for svc in $ALL_SERVICES; do
    case " $SELECTED " in *" $svc "*) _rec="$_rec $svc"; continue ;; esac
    if is_running "$svc"; then _rec="$_rec $svc"; fi
  done
  printf '%s\n' "$_rec" >"$STATE/services"
}

# THE MODE IS WRITTEN ONLY WHEN THIS COMMAND ACTUALLY STARTS THE BACKEND. Rewriting it regardless
# would mean `./dev up --demo` then `./dev up --all` leaves `real` on disk while the demo backend
# keeps running, and the next bare `./dev restart` kills it and starts the REAL analyzer — billed
# calls against a real database — with nothing on screen saying the mode had changed.
record_backend_mode() {
  _want="${BACKEND_MODE:-real}"
  if is_running backend; then
    _have=$(cat "$STATE/backend.mode" 2>/dev/null || echo real)
    [ "$_have" = "$_want" ] && return 0
    if [ "$_want" = demo ]; then _flag=--demo; else _flag=--backend; fi
    echo "  backend: already running in $_have mode, left alone — \`./dev restart $_flag\` to switch"
  else
    printf '%s\n' "$_want" >"$STATE/backend.mode"
  fi
}

parse_flags() {
  SELECTED=""
  for arg in "$@"; do
    case "$arg" in
      --backend) SELECTED="$SELECTED backend"; BACKEND_MODE=real ;;
      # The demo backend: canned analyzer, in-memory store, no key and no database. Same port and
      # same pidfile as the real one, because two backends on one port is not a state worth having.
      --demo)    SELECTED="$SELECTED backend"; BACKEND_MODE=demo ;;
      # The web application. It needs a backend to talk to — its dev proxy points at this
      # worktree's — but it is not started with one, because the browser client and the API are
      # separate applications and either is worth running alone.
      --web)     SELECTED="$SELECTED web" ;;
      --all)     SELECTED="backend web" ;;
      *) die "unknown flag: $arg (use --backend/--demo/--web/--all)" ;;
    esac
  done
  # DEDUPED, because `--all --demo` otherwise selects the backend twice: the second `start_service`
  # runs after the first has been health-checked, so a backend that died on startup is started AGAIN
  # and the pidfile is overwritten — leaving the first process running and unnameable by `down`.
  _seen=""
  for svc in $SELECTED; do
    case " $_seen " in *" $svc "*) ;; *) _seen="$_seen $svc" ;; esac
  done
  SELECTED="${_seen# }"
}

cmd_up() {
  parse_flags "$@"
  do_up
}

# The half of `up` that acts on an already-resolved SELECTED/BACKEND_MODE, so `restart` can reuse it
# without spelling its own flags back out and parsing them again.
do_up() {
  # Two `./dev up` calls in one worktree within the same second both see the port free and both
  # write a pidfile; the second overwrites the first, so whichever process actually won the bind is
  # left with no pidfile naming it and `./dev down` can never stop it. One directory create is the
  # whole lock.
  mkdir -p "$STATE"
  mkdir "$UP_LOCK" 2>/dev/null || die "another \`./dev up\` is running here (or remove $UP_LOCK)"
  # INT AND TERM MUST ALSO STOP. With one handler on all three, Ctrl-C during a health wait runs the
  # trap, releases the lock, and then CARRIES ON — printing URLs while a second `./dev up` in this
  # worktree could take the lock it still needed, which is the double-start the lock exists to stop.
  trap 'rmdir "$UP_LOCK" 2>/dev/null || true' EXIT
  trap 'rmdir "$UP_LOCK" 2>/dev/null || true; exit 130' INT TERM

  ensure_env
  load_env
  echo "Slot $EAIT_SLOT — $EAIT_DB_NAME"
  warn_branch_drift

  # Refuse before starting anything rather than leaving half a stack up. `./dev ls` says which
  # worktree holds the port.
  for svc in $SELECTED; do
    if ! is_running "$svc" && lsof -nP -iTCP:"$(svc_port "$svc")" -sTCP:LISTEN >/dev/null 2>&1; then
      die "port $(svc_port "$svc") ($svc) is already taken by another process — ./dev ls"
    fi
  done

  # ONLY THE REAL BACKEND NEEDS A DATABASE. The demo one runs on an in-memory store with a canned
  # analyzer, and the web application never touches Postgres — starting Docker for them turns a
  # laptop with nothing set up into a failure, which is the exact case `--demo` exists for. A bare
  # `./dev up` still brings the infra up, because that is all it can usefully do.
  case " $SELECTED " in
    *" backend "*) if [ "${BACKEND_MODE:-real}" = real ]; then need_db=1; else need_db=0; fi ;;
    *) if [ -z "$SELECTED" ]; then need_db=1; else need_db=0; fi ;;
  esac
  if [ "$need_db" = 1 ]; then
    echo '→ Shared Postgres + this worktree'"'"'s database'
    sh src/scripts/db.sh up >/dev/null
  fi

  if [ -z "$SELECTED" ]; then
    echo '  (no services asked for — pass --backend/--demo/--web/--all)'
    return 0
  fi

  case " $SELECTED " in *" backend "*) record_backend_mode ;; esac
  record
  echo '→ Starting'
  for svc in $SELECTED; do start_service "$svc"; done

  echo '→ Health'
  _unhealthy=""
  for svc in $SELECTED; do wait_for "$svc" || _unhealthy="$_unhealthy $svc"; done

  # Only what was actually started, and only when it answered. Printing both URLs regardless would
  # advertise a web application that is not running; printing them after a failed health wait means
  # a command that started nothing ends on a URL, having exited 0.
  echo ''
  for svc in $SELECTED; do
    case " $_unhealthy " in *" $svc "*) continue ;; esac
    case "$svc" in
      backend) echo "backend  $EAIT_API_URL" ;;
      web)     echo "web app  $EAIT_WEB_URL" ;;
    esac
  done
  [ -z "$_unhealthy" ] || die "never came up:$_unhealthy — $LOGS has the reason"
}

cmd_down() {
  # A worktree that was never derived has no ports and therefore never started anything, so `down`
  # here is a no-op and must SAY so rather than refuse — otherwise such a worktree can never be
  # cleaned up.
  if [ ! -f .env.worktree ] && [ "$ROOT" != "$(main_worktree)" ]; then
    # STOP, do not merely forget. An env file deleted by hand leaves a live stack in exactly this
    # state, and `rm -f` on the pidfiles would report success while the backend kept the port and
    # the database. `stop_service` needs no env of its own: pidfile, needle and working directory
    # are all it reads.
    echo 'this worktree has not been derived — stopping anything its pidfiles still name'
    for svc in web backend; do stop_service "$svc"; done
    return 0
  fi
  load_env
  echo "Stopping slot $EAIT_SLOT — the shared Postgres stays up, other worktrees use it"
  for svc in web backend; do stop_service "$svc"; done
}

cmd_restart() {
  parse_flags "$@"
  if [ -z "$SELECTED" ]; then
    SELECTED=$(cat "$STATE/services" 2>/dev/null || true)
    BACKEND_MODE=$(cat "$STATE/backend.mode" 2>/dev/null || echo real)
    [ -n "$SELECTED" ] || die 'nothing to restart — start something first: ./dev up --all'
  fi
  load_env
  for svc in $SELECTED; do stop_service "$svc"; done
  do_up
}

cmd_status() {
  load_env
  echo "slot $EAIT_SLOT · $EAIT_DB_NAME"
  for svc in $ALL_SERVICES; do
    if ! is_running "$svc"; then
      echo "✗ $svc  $(svc_port "$svc")  not running"
    elif svc_health "$svc"; then
      echo "✓ $svc  $(svc_port "$svc")"
    else
      echo "· $svc  $(svc_port "$svc")  running, not answering yet"
    fi
  done
}

cmd_logs() {
  if [ -n "${1:-}" ]; then
    case " $ALL_SERVICES " in
      *" $1 "*) ;;
      *) die "unknown service: $1 (one of: $ALL_SERVICES)" ;;
    esac
    [ -f "$LOGS/$1.log" ] || die "$1 has not been started in this worktree yet"
    exec tail -f "$LOGS/$1.log"
  fi
  # An empty `.dev/logs` passes the UNEXPANDED glob to tail, which then reports a file called
  # `*.log` as missing — true, useless, and not what happened.
  set -- "$LOGS"/*.log
  [ -f "$1" ] || die 'nothing has been started in this worktree yet'
  exec tail -f "$@"
}

case "${1:-}" in
  up)      shift; cmd_up "$@" ;;
  down)    cmd_down ;;
  restart) shift; cmd_restart "$@" ;;
  status)  cmd_status ;;
  ls)      shift; exec bun src/scripts/dev-ls.ts "$@" ;;
  logs)    shift; cmd_logs "$@" ;;
  db)      shift; exec sh src/scripts/db.sh "$@" ;;
  # BEFORE `ensure_env`, deliberately: this is what puts bun on the machine, so it cannot be a
  # command that needs bun to have been there already.
  install) shift; exec sh src/scripts/install.sh "$@" ;;
  # NOT a service: it writes rows and exits. `ensure_env` first, because the database name is
  # derived from this worktree's slot and the seeder would otherwise write into slot 0's.
  seed)    shift; ensure_env; exec bun src/scripts/seed.ts "$@" ;;
  # THE ONLY PLACE `TEST_DATABASE_URL` IS SET, and it is set from the derivation, so the contract
  # suite cannot run against a database that missed the slot. It is deliberately not in
  # `package.json`: `bun run test` must keep passing with no Postgres — `bun run check` runs it, and
  # making that depend on Docker being up is not a trade this repo takes. The suite MIGRATES AND
  # WRITES, which is why it gets a database of its own rather than the one you develop against.
  #
  # `db.sh up` first for the same reason `seed` runs `ensure_env`: the database this names must
  # exist, and the app never creates one.
  test)
    shift
    ensure_env
    load_env
    sh src/scripts/db.sh up >/dev/null
    [ $# -gt 0 ] || set -- ./src
    echo "TEST_DATABASE_URL=$EAIT_TEST_DATABASE_URL"
    TEST_DATABASE_URL="$EAIT_TEST_DATABASE_URL" exec bun test "$@"
    ;;
  env)     shift; exec bun src/scripts/dev-env.ts "${1:-show}" ;;
  url)     load_env; echo "$EAIT_API_URL" ;;
  *)
    # The header of this file is the help, so there is one copy of it.
    awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"
    exit 1
    ;;
esac
