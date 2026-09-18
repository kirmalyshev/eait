# This worktree's ports and database, for the shell scripts. SOURCED, never executed:
#
#   . ./src/scripts/worktree.sh                                          # from the repo root
#   EAIT_ROOT=/path/to/worktree . "$EAIT_ROOT/src/scripts/worktree.sh"   # from anywhere else
#
# A sourced POSIX script cannot find its own path — `$0` still names the caller — so the root is
# either the working directory or something the caller states. It is never guessed.
#
# `./dev env` writes `.env.worktree`; this fills in the slot-0 defaults when it has not been run, so
# a checkout that never heard of worktrees behaves exactly as a single checkout always did.
#
# Contains nothing secret, by construction: `src/scripts/dev-env.ts` keeps secrets out of
# `.env.worktree` precisely so this can be sourced without care.

if [ -f "${EAIT_ROOT:-.}/.env.worktree" ]; then
  . "${EAIT_ROOT:-.}/.env.worktree"
fi

EAIT_SLOT="${EAIT_SLOT:-0}"
# NOT a slot-0 value, because the branch is not derived from the slot — it is read from git and
# written into `.env.worktree` for a human to read and for `./dev env branch-check` to compare
# against. Empty here says "this worktree never derived", which is the truth; a branch name nobody
# looked up would not be.
EAIT_BRANCH="${EAIT_BRANCH:-}"
EAIT_BACKEND_PORT="${EAIT_BACKEND_PORT:-8787}"
# The web application, which is a different application from the backend and therefore a different
# port: the backend serves `/start` and the API, `src/frontend` serves the app at `/`.
EAIT_WEB_PORT="${EAIT_WEB_PORT:-8788}"
EAIT_WEB_URL="${EAIT_WEB_URL:-http://127.0.0.1:8788}"
EAIT_API_URL="${EAIT_API_URL:-http://127.0.0.1:8787}"
# Slot 0's database is `eait`, which is also the compose maintenance database. `db.sh drop` in a
# worktree that never derived would therefore drop slot 0's — see the header of that file.
EAIT_DB_NAME="${EAIT_DB_NAME:-eait}"
EAIT_DATABASE_URL="${EAIT_DATABASE_URL:-postgres://eait:eait@127.0.0.1:5433/$EAIT_DB_NAME}"
# The store contract suite's database — a SECOND database per worktree, because that suite migrates
# and writes and two of its assertions want no admin in the rows, which `./dev seed` puts in the dev
# one. Slot 0's is `eait_test`, the name the docs named before slots existed. The warning above now
# covers two names: `db.sh drop` in a worktree that never derived drops BOTH of slot 0's.
EAIT_TEST_DB_NAME="${EAIT_TEST_DB_NAME:-eait_test}"
EAIT_TEST_DATABASE_URL="${EAIT_TEST_DATABASE_URL:-postgres://eait:eait@127.0.0.1:5433/$EAIT_TEST_DB_NAME}"

export EAIT_SLOT EAIT_BRANCH EAIT_BACKEND_PORT EAIT_WEB_PORT EAIT_WEB_URL EAIT_API_URL \
       EAIT_DB_NAME EAIT_DATABASE_URL EAIT_TEST_DB_NAME EAIT_TEST_DATABASE_URL
