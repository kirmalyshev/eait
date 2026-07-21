# AGENTS.md — scripts/

Dev/ops helpers only — never imported by the bot runtime (`src/`). Safe to be a bit rough; keep them runnable with `bun run scripts/<name>.ts`.

- Scripts that hit the network or spend money (e.g. `smoke-openrouter.ts`) must say so at the top and require real env; they are **manual**, never wired into `bun test` or the bot.
- Don't put shared logic here that `src/` needs — that belongs under `src/`.
- **Shell scripts are POSIX `sh`, not bash.** macOS ships bash 3.2; `read -p`, `${var,,}` and arrays are unavailable. CI runs `shellcheck -s sh` over `scripts/*.sh` and `.githooks/*`, and a finding fails the build.
- `setup.sh` runs on machines we never see and is most people's first contact with the project. Keep it idempotent, never let it overwrite `.env` silently, and never echo a secret.
