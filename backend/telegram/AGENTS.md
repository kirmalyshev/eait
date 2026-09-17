# AGENTS.md — backend/telegram

The Telegram connector: a second transport onto the same engine, store and chat thread the app and
the web use. `backend/AGENTS.md` covers the server; this covers this directory.

```
handlers.ts   NO grammY. Telegram id + message → the account → ONE engine function → plain text
              through a port (`Chat`, `Tap`). The copy lives here: `TELEGRAM_COPY`, `refusalText`.
bot.ts        the grammY half: middleware, file download, album buffer, supervisor. Thin.
albums.ts     `AlbumBuffer`, carried over unchanged from the old @eait_bot.
```

## Rules

- **Dormant unless configured.** `backend/index.ts` starts it only when
  `EAIT__BACKEND__TELEGRAM_BOT_TOKEN` is set, and never under `--demo`. Either way one boot line says
  which. SIGTERM stops it before the store closes.
- **grammY stays out of `engine/` and out of `handlers.ts`, and the handlers import the engine only
  through `engine/index.ts`.** A test reads the imports (`handlers.test.ts`, "the boundary").
- **The subject is `from.id` on a private chat, stored as a string, and nothing else.** Never the
  username, first name, chat id, or an id in text or callback data. `bot.test.ts` sends a username
  and checks that the store never holds it.
- **A `telegram` identity comes from spending a pairing code, and only from that.** `/start <code>` →
  `linkTelegram` (`engine/identity.ts`). An id another account holds is never moved (`elsewhere`).
  An unknown Telegram user gets `TELEGRAM_COPY.stranger` and a sign-in link, whatever they send.
  Nothing is charged for that.
- **`/start <code>` is rate limited per Telegram id** on `authRateLimitPerHour`, which is the
  allowance `/start/pair` takes per address. The pairing code's 40-bit arithmetic assumes that limit.
- **Middleware order: private chats only → `update_id` dedupe → `sequentialize(from.id)`.** The
  filter reads no state, so it goes first. The dedupe must come before anything that does work,
  because a replayed photo is a second paid analysis. The dedupe is in memory, so a crash forgets
  it. Albums flush on a timer, outside `sequentialize`.
- **The download URL contains the token.** `fetchFile` errors and logs give only a status or an
  error name, and a test checks this. The limit is 20 MB (the Bot API maximum) or
  `maxUploadBytes`, whichever is lower. The timeout is 30 s. The bytes are read after the caps and
  before the charge, so a failed download costs nothing.
- **Callback data is `ok:<pendingId>` / `no:<pendingId>`** (≤ 64 bytes). A pending id from a tap is
  safe because the store scopes it by the user that `handlers.ts` resolved. `answerCallbackQuery`
  is guarded, because a stale query id must not cost the tap. An edit removes the buttons.
- **A 401 or 404 stops the connector, never the process.** `down()` empties
  `config.telegramBotUsername`. Any other error is retried by the supervisor on `retryMs`. The
  runner runs with `silent: true, maxRetryTime: 0`. Its default logs the whole error object on
  every failed poll, and the inner fetch error carries the token URL. The default also retries
  quietly for up to 15 hours on a backoff that a stop cannot interrupt. `getMe` retries 5xx errors
  inside `bot.init` by itself, and `stop()` aborts that retry.
- **Stopping waits for turns that are already running.** The runner's `stop()` does not wait for
  them, so every update and every album flush is tracked, and `drain()` waits for them after the
  poll ends. An album still inside its debounce when the process stops is dropped (`ponytail:`).
- **Connect Telegram shows only while `config.telegramBotUsername` is set** (written from `getMe`).
  On `/start/plan` it is a POST to `/start/telegram`, which returns a 303 to `t.me`. That is why the
  `/start` CSP `form-action` names `https://t.me`. In the web app, the tap calls `POST /v1/auth/pair`.
  In both, the code is minted at the tap, because it lives for 5 min.
- **The bot sends the turn's RESULT as plain text.** Gabie's answers start with `Gabie: `. Lines
  that the engine only writes to the thread are not sent here: the first verdict, the "day so far"
  line, and Spud's question. The app and the web show them. The bot never sends a focus meal, so
  a correction typed here reaches the router without one.
- **Albums are capped, not refused:** the bot reads the first `maxPhotosPerMeal` photos. A command
  that no handler takes points to the web and is never sent to the router as text.

## Where to add things

A new command or message kind → a method on `telegramHandlers` that calls one engine function,
plus one line in `createBot`. New copy → `TELEGRAM_COPY` or `REFUSAL_WORDS`, which the claims test
already covers.

## Verify

`bun test backend/telegram`. For a live run you need a bot token (see `README.md`).
