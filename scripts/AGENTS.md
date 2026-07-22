# AGENTS.md — scripts/

Dev/ops helpers only — never imported by the bot runtime (`src/`). Safe to be a bit rough; keep them runnable with `bun run scripts/<name>.ts`.

- Scripts that hit the network or spend money (`smoke-openrouter.ts`, `eval-meals.ts` — one billed vision call per fixture × run × model) must say so at the top and require real env; they are **manual**, never wired into `bun test` or the bot.
- Don't put shared logic here that `src/` needs — that belongs under `src/`. The inverse is allowed and used: `eval-meals.ts` imports its tested metric core from `src/eval.ts`.
- `db.sh` owns the shared dev Postgres (`up` before the first test run; `clean-test` sweeps leftover test databases). `compose-env.sh` stamps a worktree's identity into `.env` so parallel branches get distinct compose projects and databases.
- `service.sh` (launchd/systemd) and the Docker container are **mutually exclusive** supervisors — one long-polling consumer per bot token. On this machine prod is the container; see the root `AGENTS.md` deployment section before touching either.
- **Shell scripts are POSIX `sh`, not bash.** macOS ships bash 3.2; `read -p`, `${var,,}` and arrays are unavailable. CI runs `shellcheck -s sh` over `scripts/*.sh` and `.githooks/*`, and a finding fails the build.
- `setup.sh` runs on machines we never see and is most people's first contact with the project. Keep it idempotent, never let it overwrite `.env` silently, and never echo a secret.
