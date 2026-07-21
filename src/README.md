# src/

All bot logic lives here. Tests are co-located (`*.test.ts`, run with `bun test`).

## Key files

- `index.ts` — entrypoint: load config, open db, start bot.
- `config.ts` — env → typed config; fails fast on missing required vars.
- `types.ts` — shared types (`Profile`, `MealAnalysis`, `MealRecord`, `DailyTotals`, `FoodTargets`, `Verdict`).
- `db.ts` — `bun:sqlite`: PRAGMAs + `user_version` migrations + typed queries.
- `targets.ts` — `targetsFor(profile)` and `parseRestrictions(text)`.
- `llm/provider.ts` — `LLMProvider` interface (thin transport).
- `llm/openrouter.ts` — OpenRouter impl (timeout + backoff).
- `analyzer.ts` — builds the prompt, calls the provider, zod-validates the result.
- `onboarding.ts` — pure state machine `step(user, input)`.
- `reply.ts` — `formatReply(meal, totals, targets, lang)`.
- `bot.ts` — grammy glue: `createBot(deps)` (testable) + `startBot(config)`.
