# AGENTS.md — root

Orientation for any coding agent (or human) working in this repo.

## What this is

`eait` — a multi-user food-photo Telegram bot, personal tool for a small closed circle. Photo in → per-user meal analysis + daily totals out. Generalized from a single-user Pulse bot: profile-driven analysis instead of hard-coded thresholds, Postgres store (one database per branch), ephemeral images, provider abstraction.

## Stack & commands

- **Runtime:** TS/bun (`bun` 1.3+). Deps: `grammy`, `@grammyjs/runner`, `zod`, `i18next`; Postgres via the builtin `Bun.sql` client.
- **Install:** `bun install`.
- **Test:** `bun test` (co-located under `src/**/*.test.ts`; needs the shared dev Postgres: `sh scripts/db.sh up`); one file with `bun test src/db.test.ts`.
- **Typecheck:** `bun run typecheck` (`tsc --noEmit`). **Safety gate:** `bun run security`.
- **Run:** `bun run start` (= `bun run src/index.ts`, needs a real `TELEGRAM_BOT_TOKEN`).
- **Docker:** `make up` (= shared Postgres + build + start this worktree's bot container); `make down` stops the bot only; `make help` lists the rest. Per-worktree instances: `sh scripts/compose-env.sh` once (writes unique `COMPOSE_PROJECT_NAME` + `PGDATABASE=eait_<branch>` + `PGDATABASE_TEST` into `.env`), plus a distinct bot token per parallel instance — one long-polling consumer per token or Telegram returns 409.

## Hard conventions (do not break)

- **No source code in the repo root.** Root holds only meta/config (`package.json`, `tsconfig.json`, `.env.example`, docs). All logic lives under `src/`.
- **Every first-level folder** (`src/`, `docs/`, `scripts/`) carries `AGENTS.md` + `CLAUDE.md` + `README.md`, where `CLAUDE.md` is a symlink to that folder's `AGENTS.md`. Write guidance in `AGENTS.md` only; never replace a symlink with a real file. The same applies to any nested folder that is an architectural boundary with its own invariants (`src/tg_bot/`); single-concern leaf folders (`src/i18n/`, `src/llm/`) are covered by `src/AGENTS.md` instead.
- **Provider swap:** the LLM sits behind `LLMProvider` (`src/llm/provider.ts`), built in `src/llm/factory.ts` from `LLM_PROVIDER` (unknown value → startup error, never a silent fallback). Never inline a provider-specific call in `src/tg_bot/bot.ts`/`src/analyzer.ts`. The **analyzer owns the prompt + the zod-validated parse**; the provider is thin transport.
- **Ephemeral images:** photo bytes are fetched into memory, analyzed, and dropped. **No image is ever written to disk** and no photo path is stored.
- **Per-user scoping:** every meal read/update is `WHERE id = ? AND user_id = ?`. Meal `id` is a UUID, never a timestamp. No cross-user reach.
- **Dates** are computed in **Europe/Berlin**, not UTC (daily-total midnight boundary).
- **Never log or print the bot token, the OpenRouter key, or any raw image bytes.** Config is loaded via `src/config.ts`; secrets live in `.env` (gitignored).
- **Never widen a meal query** beyond `WHERE id = ? AND user_id = ?`.
- **TDD.** Write the failing test, watch it fail, implement, watch it pass, commit. One logical change per commit.

## Where to add things

New domain logic → a focused file under `src/` (see `src/AGENTS.md`). New command, callback, or handler → `src/tg_bot/` (see `src/tg_bot/AGENTS.md`). Dev/ops helpers → `scripts/`. Design docs → `docs/`.
