# CLAUDE.md — root

@AGENTS.md

Claude Code specifics for this repo. The project conventions live in the imported `AGENTS.md` above; this file adds command shortcuts and guardrails.

## Commands

- `bun install` — materialize deps.
- `bun test` — full suite (co-located `src/**/*.test.ts`).
- `bun test src/db.test.ts` — a single file.
- `bun run start` — start the bot (needs a real `TELEGRAM_BOT_TOKEN`).

## Guardrails

- **Never log or print the bot token, the OpenRouter key, or any raw image bytes.** Config is loaded via `src/config.ts`; keep secrets in `.env` (gitignored).
- **Never persist a raw image** or store a photo path. Images are temp-file → analyze → delete, always.
- **Never widen a meal query** beyond `WHERE id = ? AND user_id = ?`.
- **Do not put source in the repo root** — all logic under `src/`.
- TDD: write the failing test, see it fail, implement, see it pass, commit. One logical change per commit.
