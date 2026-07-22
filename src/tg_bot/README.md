# src/tg_bot/

The Telegram adapter — the only folder that knows about grammy. Everything under `src/` is
transport-agnostic; a second front end (CLI, web) would sit next to this folder, not inside it.

## Key files

- `bot.ts` — grammy glue: the `process*` functions (real logic, grammy-free),
  `createBot(deps)` (constructable with no live token — see the test), and `startBot(config)`
  (builds the provider, opens the db, runs the supervised poller, wires SIGTERM/SIGINT).
- `bot.test.ts` — co-located tests: temp db + fake provider + fake `send`.
- `albums.ts` — `AlbumBuffer<T>`: debounced per-key flush for Telegram media groups (albums).
- `rejections.ts` — `RejectionLog`: bounded in-memory log of "not food" reply ids per user.

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
| `/cap` | `processCap` |
| photo | album buffer → `processAlbum` → `processPhoto` |
| album (multi-photo message) | same: each part buffers; buffer flushes to `processAlbum` |
| document (a photo sent uncompressed) | `processDocument` → `processPhoto` when `image/*` |
| `/settings`, `st:*` callbacks | `processSettingsOpen` / `processSettingsCallback` |
| `/help` | `helpText` |
| `tm:log:` / `tm:cancel:` callbacks | `processTextMealDecision` |
| text replying to a "not food" message | canned `errors.rejectionExplain` reply (no LLM) |
| text replying to a meal or its analysis | `processText` with correction intent unlocked |
| any other active-user text | `processText` → `routeText` (question / meal / correction) |
| text from non-active users | `processOnboarding` |

**Still not handled — these get no reply at all:** voice, video, sticker, and edited messages.
They pass the dedupe middleware and fall off the end.

## Verify

`bun test src/tg_bot/bot.test.ts`
