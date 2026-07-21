# AGENTS.md — root

Orientation for any coding agent (or human) working in this repo.

## What this is

`eait` — a multi-user food-photo Telegram bot, personal tool for a small closed circle. Photo in → per-user meal analysis + daily totals out. Generalized from a single-user Pulse bot: profile-driven analysis instead of hard-coded thresholds, SQLite store, ephemeral images, provider abstraction.

## Stack & commands

- **Runtime:** TS/bun (`bun` 1.3+). Deps: `grammy`, `@grammyjs/runner`, `zod`; `bun:sqlite` is builtin.
- **Test:** `bun test` (tests co-located under `src/**/*.test.ts`).
- **Run:** `bun run start` (= `bun run src/index.ts`).

## Hard conventions (do not break)

- **No source code in the repo root.** Root holds only meta/config (`package.json`, `tsconfig.json`, `.env.example`, docs). All logic lives under `src/`.
- **Every first-level folder** (`src/`, `docs/`, `scripts/`) carries `AGENTS.md` + `CLAUDE.md` + `README.md`.
- **Provider swap:** the LLM sits behind `LLMProvider` (`src/llm/provider.ts`). Swap by setting `LLM_PROVIDER`; never inline a provider-specific call in `bot.ts`/`analyzer.ts`. The **analyzer owns the prompt + the zod-validated parse**; the provider is thin transport.
- **Ephemeral images:** a photo is downloaded to a temp file, analyzed, and **always deleted** (even on error). No raw image is ever persisted and no photo path is stored.
- **Per-user scoping:** every meal read/update is `WHERE id = ? AND user_id = ?`. Meal `id` is a UUID, never a timestamp. No cross-user reach.
- **Dates** are computed in **Europe/Berlin**, not UTC (daily-total midnight boundary).
- **Never log the bot token or any raw image bytes.**

## Where to add things

New logic → a focused file under `src/` (see `src/AGENTS.md`). Dev/ops helpers → `scripts/`. Design docs → `docs/`.
