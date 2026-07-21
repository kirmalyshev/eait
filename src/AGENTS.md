# AGENTS.md — src/

All bot logic. Focused files, co-located tests. See the root `AGENTS.md` for project-wide invariants.

## Invariants that bite here

- **Meal queries** are always `WHERE id = ? AND user_id = ?`; meal `id` = `crypto.randomUUID()`. Never a timestamp, never cross-user.
- **The analyzer owns the prompt and the zod parse.** `llm/` is transport only — no prompt strings, no meal-schema knowledge in the provider.
- **Images are ephemeral.** The photo handler downloads to a temp file under `PHOTO_DIR`, reads bytes, and deletes the file in a `finally` — always, even on analysis error. No photo path is stored.
- **Dates** use `Europe/Berlin` (`berlinDate` in `db.ts`), not UTC.
- **Routing precedence** in `bot.ts`: command > active-onboarding-state input > reply-to-meal (correction) > nudge.
- **Idempotency:** `update_id` dedupe middleware; callbacks guard on expected state and always `answerCallbackQuery`.
- `createBot(deps)` must be constructable/testable with an injected db + fake provider and **no live token** (pass `botInfo` + an API transformer in tests).

## Where to add things

- New domain rule → its own file (like `targets.ts`), re-exported types from `types.ts` (defined once, consumed unchanged).
- New LLM backend → a new file under `llm/` implementing `LLMProvider`; wire it by `LLM_PROVIDER` in `config.ts`.

## Verify

`bun test` (or a single file, e.g. `bun test src/bot.test.ts`).
