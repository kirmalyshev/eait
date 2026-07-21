# AGENTS.md — src/tg_bot/

The Telegram layer. Everything grammy-shaped lives here; nothing else in `src/` imports it.
See `src/AGENTS.md` for the domain invariants and the root `AGENTS.md` for project-wide rules.

## Shape

`bot.ts` splits in two halves, and the split is the point:

- **`process*` functions** — grammy-free, unit-tested with a fake `send`, a temp db, and a fake
  provider. This is where logic belongs.
- **`createBot(deps)`** — thin grammy adapters that unwrap `ctx` and call a `process*`.

New behaviour goes in a `process*` function, not in a handler body.

Two handlers predate that rule and still hold logic inline: `/delete` (prompt + the
`delete_confirm`/`delete_cancel` callbacks) and the `/stats` admin gate. Both are consequently
untested. Don't copy the pattern, and prefer extracting them over adding a third.

## Invariants that bite here

- **Routing precedence:** command > reply-to-meal (correction) > onboarding text > nudge.
  `message:text` tries `processCorrection` first and only falls through when it returns `false`.
- **Idempotency:** the `update_id` dedupe middleware must stay **first** in the chain (crash
  redelivery safety), with `sequentialize(by user)` after it — one user's slow vision call must
  never block another's.
- **Images are in-memory only.** `processPhoto` takes a `getBytes()` thunk, hands the bytes to the
  analyzer, and drops them. No disk write, no photo path, ever.
- **`createBot(deps)` must be constructable with an injected db + fake provider and no live token**
  (tests pass `botInfo` + an API transformer).
- **`translatorFor(lang)`, never `i18n.changeLanguage()`.** The runner serves users concurrently,
  so a global language switch can render one user's locale into another's in-flight reply. Read the
  translator *before* a destructive action (`/delete` reads `t` before the row is deleted).
- **No user-facing copy in code.** Every reply goes through `t(...)`; copy lives in
  `src/i18n/locales/*.json`. Layout separators (`"\n"`, `", "`) stay in code.
- **The LLM restriction fallback lives here**, not in `onboarding.ts` — `step()` is a pure no-I/O
  state machine and must stay one.
- **Callbacks always `answerCallbackQuery()`** and ignore unknown data rather than storing it
  (`lang_<code>` is validated against the registry).
- **`bot.catch` stays.** A failed reply must never crash the process; `startBot`'s supervisor
  retries runner errors (e.g. a 409 during poller hand-off) instead of exiting.
- **Retry transient, exit on fatal.** `isFatalTelegramError` (401/404 — a dead or wrong token)
  ends the loop with a message naming the env var. Retrying a credential failure every 15s
  forever is indistinguishable from a network blip in the log; keep new codes on the right side
  of that line.

## Where to add things

- New command or callback → a `process*` function + a two-line grammy handler.
- New domain rule, db query, or prompt → `src/`, not here (`src/AGENTS.md`).
- New copy → a key in **every** `src/i18n/locales/*.json`; the parity test fails until they match.

## Verify

`bun test src/tg_bot/bot.test.ts` (or `bun test` for the suite).
