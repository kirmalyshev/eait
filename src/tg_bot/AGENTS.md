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

- **Text routing precedence:** command > reply-to-rejection (canned explain, no LLM) >
  free-text router > onboarding. Every text from an **active** user goes through `processText`
  — one `routeText` LLM call deciding question / meal / correction (a reply that maps to a meal
  via `mealByReply` — the bot's analysis message OR the user's own photo — becomes the focus
  meal, which unlocks the correction intent). `processText` returns `false` only for non-active
  users, whose text still belongs to `processOnboarding`.
- **Text meals are confirm-first.** A `meal` intent creates a `pending_meals` row + `tm:log:` /
  `tm:cancel:` buttons; nothing reaches `meals` until the tap (`processTextMealDecision`).
  Photos and albums keep logging directly.
- **Albums are one meal.** Photo updates sharing `media_group_id` are buffered per
  (user, group) in `AlbumBuffer` (in-memory, 1.5 s debounce) and flushed as ONE multi-image
  `analyzeMeal` call (`processAlbum`) — one cap draw, one reply, `user_message_id` = first
  part. A crash between parts costs at most one partial analysis; that's the accepted trade.
  **Deliberate exclusion:** the `document` handler (uncompressed "send as file" images) does
  NOT album-buffer — a multi-document group analyzes as N separate meals and N cap draws.
  Uncompressed multi-image sends are rare enough that the asymmetry is accepted; if you wire
  it, reuse the same `AlbumBuffer`, don't build a second one.
- **The rejection log is in-memory on purpose.** `RejectionLog` (bounded, 20/user) remembers
  "not food" reply ids so a reply to one gets the canned explanation. After a restart such
  replies degrade to the router, which honestly has nothing — never persist anything
  photo-derived to "fix" that.
- **Caps meter LLM calls, not meals.** Every provider call logs an `llm_calls` row first with
  a `kind` tag (`photo` = photo or album analysis, `router` = text routing / Q&A / correction,
  `classify` = onboarding restriction classifier); both the per-user and global caps count those
  rows. A not-food photo, a Q&A, and a text meal each spend one call. The `classify` kind is
  not cap-gated (it fires during onboarding before the user has a cap row), but it is metered
  so `/cap` shows the real picture. **The `document` handler (uncompressed photo) passes through
  to `processPhoto` for food content and does not get its own `kind` — it counts as `photo`.**
- **Idempotency:** the `update_id` dedupe middleware must stay **first** in the chain (crash
  redelivery safety), with `sequentialize(by user)` after it — one user's slow vision call must
  never block another's.
- **Images are in-memory only.** `processPhoto` takes `getBytes()` thunks, hands the bytes to the
  analyzer, and drops them. No disk write, no photo path, ever.
- **Rich replies fall back to plain.** Meal-card sites render both forms via `render.ts` +
  `reply.ts` and hand them to `sendCard`, which goes rich only when the user's EFFECTIVE format
  is rich — `replyFormatFor(u, config)`: the `/settings → Style` choice (`users.reply_format`),
  else the instance's `REPLY_FORMAT`. A failed rich send logs and resends the plain text. Q&A
  answers are always plain (LLM text, unknown markup). Every new meal-card site must resolve
  through `replyFormatFor`, never read `config.replyFormat` directly.
- **`createBot(deps)` must be constructable with an injected db + fake provider and no live token**
  — the test sets `botInfo` and an API transformer so grammy never calls `getMe`.
- **`translatorFor(lang)`, never `i18n.changeLanguage()`.** The runner serves users concurrently,
  so a global language switch can render one user's locale into another's in-flight reply. Read the
  translator *before* a destructive action (`/delete` reads `t` before the row is deleted).
- **No user-facing copy in code.** Every reply goes through `t(...)`; copy lives in
  `src/i18n/locales/*.json`. Layout separators (`"\n"`, `", "`) stay in code.
- **The LLM restriction fallback lives here**, not in `onboarding.ts` — `step()` is a pure no-I/O
  state machine and must stay one.
- **Callbacks always `answerCallbackQuery()`.** Unknown data is never *stored* — `lang_<code>` is
  validated against the registry — but it isn't discarded either: it falls through to
  `processOnboarding`, whose `step()` default re-prompts the current stage.
- **Callback namespaces are disjoint:** `st:` settings, `lang_` language, bare
  `consent_*`/`goal_*`/`restrictions_*` onboarding, `delete_*` delete, `tm:` text-meal confirm.
  Never reuse a prefix across machines — the receiving machine's guards reject foreign taps
  silently.
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
