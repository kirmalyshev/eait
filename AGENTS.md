# AGENTS.md — root

Orientation for any coding agent (or human) working in this repo.

## What this is

`eait` — a multi-user food-photo Telegram bot, personal tool for a small closed circle. Photo (or album, or text description) in → per-user meal analysis + daily totals out; free text gets LLM Q&A over the diary. Generalized from a single-user Pulse bot: profile-driven analysis instead of hard-coded thresholds, Postgres store (ONE database, app-wide), ephemeral images, provider abstraction, rich-message or plain replies (`REPLY_FORMAT` default, per-user override in `/settings`).

## Stack & commands

- **Runtime:** TS/bun (`bun` 1.3+). Deps: `grammy`, `@grammyjs/runner`, `zod`, `i18next`; Postgres via the builtin `Bun.sql` client.
- **Install:** `bun install`.
- **Test:** `bun test` (co-located under `src/**/*.test.ts`; needs the shared dev Postgres: `sh scripts/db.sh up`); one file with `bun test src/db.test.ts`.
- **Typecheck:** `bun run typecheck` (`tsc --noEmit`). **Safety gate:** `bun run security`. `make check` runs test + typecheck + security.
- **Typecheck is a gate, not a suggestion.** bun executes TypeScript *without* checking it, so a type error is invisible to `bun test` and to the running bot until it crashes on live input — and several invariants here are carried only by the type system (the required `restrictions` argument on the meal renderers, the `satisfies` guards that make a new verdict dimension a compile error). It therefore runs in five places: the pre-commit hook, `make up`, `make deploy` (after the pull), `setup.sh`, and both CI workflows — the docker one gating the GHCR publish, since the image build would never notice.
- **Run:** `bun run start` (= `bun run src/index.ts`, needs a real `TELEGRAM_BOT_TOKEN`).
- **Docker:** `make up` (= shared Postgres + build + start this worktree's bot container); `make down` stops the bot only; `make help` lists the rest. Per-worktree instances: `sh scripts/compose-env.sh` once (writes a unique `COMPOSE_PROJECT_NAME` into `.env` and pins `PGDATABASE=eait`), plus a distinct bot token per parallel instance — one long-polling consumer per token or Telegram returns 409.

## Hard conventions (do not break)

- **No source code in the repo root.** Root holds only meta/config (`package.json`, `tsconfig.json`, `.env.example`, docs). All logic lives under `src/`.
- **Every first-level folder** (`src/`, `docs/`, `scripts/`) carries `AGENTS.md` + `CLAUDE.md` + `README.md`, where `CLAUDE.md` is a symlink to that folder's `AGENTS.md`. Write guidance in `AGENTS.md` only; never replace a symlink with a real file. The same applies to any nested folder that is an architectural boundary with its own invariants (`src/tg_bot/`); single-concern leaf folders (`src/i18n/`, `src/llm/`) are covered by `src/AGENTS.md` instead.
- **Mastra is the only LLM engine.** Every LLM call in the running bot goes through one Mastra agent (`src/llm/agent.ts`), reached via the ports in `src/llm/analyzePort.ts` (`AnalyzePhoto`, `RouteText`, `ClassifyRestrictions`) which `startBot` binds to it. `bot.ts` depends on those function types, never on an `Agent` — the engine depends on the capability, not the vendor. `LLM_PROVIDER`+`LLM_MODEL` become a model-router id in `src/llm/model.ts`, and an unknown provider is still a **startup error, never a silent fallback**. The **analyzer still owns the prompt + the zod schemas** (`SYSTEM`/`buildUserText`/`buildRouteText`/`buildClassifyText`/`MealAnalysisSchema`), and both engines import them verbatim so no prompt is ever authored twice. `provider.ts`/`factory.ts`/`openrouter.ts` are **dev-only** now — kept solely so `scripts/eval-meals.ts` and `scripts/parity-llm-paths.ts` have a second engine to measure against.
- **ONE database for the whole app, and the bot never creates it.** `PGDATABASE` is `eait` in every branch and worktree — `compose-env.sh` varies only `COMPOSE_PROJECT_NAME` (containers), never the database. It used to write `PGDATABASE=eait_<branch>`, and combined with `openDb`'s auto-create that was silent data loss: rebuilding the container from a checkout on another branch opened a brand-new empty database, so every user was unknown and re-onboarded from scratch, with the real rows still sitting in the old database and nothing in any log. `openDb` now refuses a missing database (`createIfMissing` is the bootstrap-only opt-in, used by `testutil.ts` and `migrate-sqlite-to-pg.ts`); `sh scripts/db.sh up|create` is what creates one. **Never derive a database name from the branch, and never re-add auto-create to a runtime path** — an empty database is indistinguishable from every user having been wiped. Accepted trade: a branch running a new migration migrates the database `main` uses too.
- **Ephemeral images:** photo bytes are fetched into memory, analyzed, and dropped. **No image is ever written to disk** and no photo path is stored.
- **Per-user scoping:** every meal read/update is `WHERE id = ? AND user_id = ?`. Meal `id` is a UUID, never a timestamp. No cross-user reach.
- **Dates** are computed in **Europe/Berlin**, not UTC (daily-total midnight boundary).
- **Never log or print the bot token, the OpenRouter key, or any raw image bytes.** Config is loaded via `src/config.ts`; secrets live in `.env` (gitignored).
- **Never widen a meal query** beyond `WHERE id = ? AND user_id = ?`.
- **TDD.** Write the failing test, watch it fail, implement, watch it pass, commit. One logical change per commit.

## Where to add things

New domain logic → a focused file under `src/` (see `src/AGENTS.md`). New command, callback, or handler → `src/tg_bot/` (see `src/tg_bot/AGENTS.md`). Dev/ops helpers → `scripts/`. Design docs → `docs/`.
