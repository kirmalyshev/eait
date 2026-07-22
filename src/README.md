# src/

All bot logic lives here: domain code at this level, the Telegram adapter in `tg_bot/`.
Tests are co-located (`*.test.ts`, run with `bun test`).

## Key files

- `index.ts` — entrypoint: load config, hand off to `startBot`, and turn a startup failure into one readable line.
- `config.ts` — env → typed config; fails fast on missing required vars.
- `types.ts` — shared types (`Profile`, `MealAnalysis`, `MealRecord`, `DailyTotals`, `FoodTargets`, `Verdict`).
- `db.ts` — Postgres (`Bun.sql`): auto-created branch database + versioned migrations + typed queries.
- `targets.ts` — `targetsFor(profile)` and `parseRestrictions(text)`.
- `llm/provider.ts` — `LLMProvider` interface (thin transport).
- `llm/openrouter.ts` — OpenRouter impl (timeout + backoff).
- `llm/factory.ts` — `createProvider(config)`: `LLM_PROVIDER` → a provider; unknown value throws.
- `analyzer.ts` — builds the prompt, calls the provider, zod-validates the result; includes
  `routeText` (single LLM call deciding question/meal/correction intent with meal context).
- `onboarding.ts` — pure state machine `step(user, input, t)`.
- `settings.ts` — pure state machine for `/settings` (`settingsRoot`, `settingsStep`).
- `reply.ts` — `formatReply(meal, totals, targets, t)` for plain-text mode.
- `render.ts` — `renderMealCard(meal, totals, targets, t, opts?)` for Telegram Rich Messages
  (Bot API 10.1 HTML, used when a user's effective reply format is rich — `/settings` choice,
  else `REPLY_FORMAT`). `escapeHtml` on every LLM-supplied value.
- `i18n/` — locale registry, `resolveLang`, `translatorFor`, and the JSON catalogs.
- `tg_bot/bot.ts` — grammy glue: `createBot(deps)` (testable) + `startBot(config)`. See `tg_bot/README.md`.
- `tg_bot/albums.ts` — `AlbumBuffer<T>`: debounced flush for Telegram media groups.
- `tg_bot/rejections.ts` — `RejectionLog`: in-memory bounded log of "not food" reply ids.

## Adding a language

1. Copy `i18n/locales/en.json` to `i18n/locales/<code>.json` and translate the values.
2. Import it in `i18n/registry.ts` and add one `LOCALES` entry (`nativeName` is the /lang
   button label; `llmName` is the language name given to the model).
3. `bun test` — the parity tests name every key you missed, every placeholder you changed,
   and every plural category your language needs.

Nothing else changes: `Lang` widens from the registry, and the /lang picker is built from it.
