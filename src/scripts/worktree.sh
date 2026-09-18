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
# `eait_app`, not `eait`: the image's POSTGRES_USER is a SUPERUSER, and a superuser bypasses row
# level security whatever `force` says — the backend connecting as it would make every policy in
# store.pg.ts decorative. `src/scripts/db.sh` creates the role; `eait` stays the maintenance one.
# Kept identical to DEFAULT_PG_BASE_URL in src/scripts/dev-env.ts.
EAIT_DATABASE_URL="${EAIT_DATABASE_URL:-postgres://eait_app:eait@127.0.0.1:5433/$EAIT_DB_NAME}"
# The store contract suite's database — a SECOND database per worktree, because that suite migrates
# and writes and two of its assertions want no admin in the rows, which `./dev seed` puts in the dev
# one. Slot 0's is `eait__test`. The warning above now covers two names: `db.sh drop` in a worktree
# that never derived drops BOTH of slot 0's.
#
# FROM `EAIT_DB_NAME`, NOT FROM A LITERAL, and that is not tidying either. A `.env.worktree` written
# before this key existed sets the dev name and not this one — a file, so no default above fires —
# and a literal here would hand every such worktree SLOT 0'S test database while its dev database
# stayed its own. The silent slot-0 fallback, in the one command that migrates and writes.
# `%.57s` keeps the budget: 57 + `__test` is 63, and Postgres truncates a longer name to 63 with
# only a notice — which for a name already at 63 is the dev database, exactly.
EAIT_TEST_DB_NAME="${EAIT_TEST_DB_NAME:-$(printf '%.57s__test' "$EAIT_DB_NAME")}"
# Same server as the dev one by construction, so an overridden `EAIT_PG_BASE_URL` reaches both.
EAIT_TEST_DATABASE_URL="${EAIT_TEST_DATABASE_URL:-${EAIT_DATABASE_URL%/*}/$EAIT_TEST_DB_NAME}"

export EAIT_SLOT EAIT_BRANCH EAIT_BACKEND_PORT EAIT_WEB_PORT EAIT_WEB_URL EAIT_API_URL \
       EAIT_DB_NAME EAIT_DATABASE_URL EAIT_TEST_DB_NAME EAIT_TEST_DATABASE_URL
