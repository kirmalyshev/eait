# AGENTS.md — scripts/

Dev/ops helpers only — never imported by the bot runtime (`src/`). Safe to be a bit rough; keep them runnable with `bun run scripts/<name>.ts`.

- Scripts that hit the network or spend money (e.g. `smoke-openrouter.ts`) must say so at the top and require real env; they are **manual**, never wired into `bun test` or the bot.
- Don't put shared logic here that `src/` needs — that belongs under `src/`.
