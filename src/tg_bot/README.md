# src/tg_bot/

The Telegram adapter — the only folder that knows about grammy. Everything under `src/` is
transport-agnostic; a second front end (CLI, web) would sit next to this folder, not inside it.

## Key files

- `bot.ts` — grammy glue: the `process*` functions (real logic, grammy-free),
  `createBot(deps)` (constructable with no live token — see the test), and `startBot(config)`
  (builds the provider, opens the db, runs the supervised poller, wires SIGTERM/SIGINT).
- `bot.test.ts` — co-located tests: temp db + fake provider + fake `send`.

## Surface

`startBot(config)` is what `src/index.ts` calls; it returns `{ db, stop }`.
`createBot(deps)` takes `{ db, provider, config }` and returns a grammy `Bot`.

## Handlers

| Update | Goes to |
|---|---|
| `/start`, onboarding text, onboarding callback | `processOnboarding` |
| `/me` | `meCard` |
| `/lang`, `lang_<code>` callback | `processLangPrompt` / `processLangChoice` |
| `/delete`, `delete_confirm`, `delete_cancel` | inline in `createBot` (db `deleteUser`) |
| `/stats` (admin only) | `statsCard` |
| photo | `processPhoto` |
| document (a photo sent uncompressed) | `processDocument` → `processPhoto` when `image/*` |
| `/settings`, `st:*` callbacks | `processSettingsOpen` / `processSettingsCallback` |
| `/help` | `helpText` |
| text replying to a meal | `processCorrection`, falling through to onboarding |
| any other text | `processOnboarding` (active users get the nudge) |

**Still not handled — these get no reply at all:** voice, video, sticker, and edited messages.
They pass the dedupe middleware and fall off the end.

## Verify

`bun test src/tg_bot/bot.test.ts`
