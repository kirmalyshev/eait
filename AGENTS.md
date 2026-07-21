# AGENTS.md — root

Orientation for any coding agent (or human) working in this repo.

## What this is

`eait` — a multi-user food-photo Telegram bot, personal tool for a small closed circle. Photo in → per-user meal analysis + daily totals out. Generalized from a single-user Pulse bot: profile-driven analysis instead of hard-coded thresholds, SQLite store, ephemeral images, provider abstraction.

## Stack & commands

- **Runtime:** TS/bun (`bun` 1.3+). Deps: `grammy`, `@grammyjs/runner`, `zod`, `i18next`; `bun:sqlite` is builtin.
- **Install:** `bun install`.
- **Test:** `bun test` (tests co-located under `src/**/*.test.ts`); one file with `bun test src/db.test.ts`.
- **Typecheck:** `bun run typecheck` (`tsc --noEmit`).
- **Run:** `bun run start` (= `bun run src/index.ts`, needs a real `TELEGRAM_BOT_TOKEN`).

## Hard conventions (do not break)

- **No source code in the repo root.** Root holds only meta/config (`package.json`, `tsconfig.json`, `.env.example`, docs). All logic lives under `src/`.
- **Every first-level folder** (`src/`, `docs/`, `scripts/`) carries `AGENTS.md` + `CLAUDE.md` + `README.md`, where `CLAUDE.md` is a symlink to that folder's `AGENTS.md`. Write guidance in `AGENTS.md` only; never replace a symlink with a real file.
- **Provider swap:** the LLM sits behind `LLMProvider` (`src/llm/provider.ts`), built in `src/llm/factory.ts` from `LLM_PROVIDER` (unknown value → startup error, never a silent fallback). Never inline a provider-specific call in `src/tg_bot/bot.ts`/`src/analyzer.ts`. The **analyzer owns the prompt + the zod-validated parse**; the provider is thin transport.
- **Ephemeral images:** photo bytes are fetched into memory, analyzed, and dropped. **No image is ever written to disk** and no photo path is stored.
- **Per-user scoping:** every meal read/update is `WHERE id = ? AND user_id = ?`. Meal `id` is a UUID, never a timestamp. No cross-user reach.
- **Dates** are computed in **Europe/Berlin**, not UTC (daily-total midnight boundary).
- **Never log or print the bot token, the OpenRouter key, or any raw image bytes.** Config is loaded via `src/config.ts`; secrets live in `.env` (gitignored).
- **Never widen a meal query** beyond `WHERE id = ? AND user_id = ?`.
- **TDD.** Write the failing test, watch it fail, implement, watch it pass, commit. One logical change per commit.

## Where to add things

New logic → a focused file under `src/` (see `src/AGENTS.md`). Dev/ops helpers → `scripts/`. Design docs → `docs/`.
