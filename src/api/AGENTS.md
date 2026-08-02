# AGENTS.md — src/api/

HTTP over the engine, on `Bun.serve`. The second front end, and the reason `src/engine/` exists.

## Shape

Every handler is three lines: authenticate to a `userId`, call ONE engine function, encode the
result. There is no product logic here — a reviewer should be able to confirm that by noting this
folder never imports `db.ts` and never touches `meals`.

## Invariants that bite here

- **Authentication is injected and has NO default.** `resolveUserId` is a required parameter. A
  scheme that defaults to anything is a scheme that is off, and these routes reach every user's
  diary. It currently resolves to `null`, so everything but `/health` answers 401 — deliberately
  useless rather than deliberately open. Wiring a real scheme is its own decision and its own doc.
- **The API is OPT-IN.** No `API_PORT` → no listener. An instance that has always been
  long-polling-only must not begin listening on a port because it was upgraded.
- **Loopback by default** (`API_HOST`). A process that binds `0.0.0.0` because nobody said otherwise
  is how a build with no auth ends up reachable from the internet.
- **`userId` never comes from the request body.** It is resolved from credentials and passed to the
  engine as an argument. `focusMealId` MAY come from the body — that is safe only because every
  engine read is user-scoped, and there is a test that says so.
- **Errors are logged, never returned.** An error string from deep in the stack can carry a query, a
  path, or a model's echo of user content. The client gets `{"error":"internal"}`.
- **Uploads stay in memory and are bounded.** No disk write, no staging directory "just for
  retries" — the ephemeral-image invariant is the product's, not Telegram's, and a second front end
  is exactly where it would quietly be broken.
- **`not-onboarded` is 403, never 401.** The caller authenticated fine; a 401 sends a well-behaved
  client into a token-refresh loop it can never win.

- **Every `pendingId` the API hands out needs a route that acts on it.** `/v1/messages` can answer `proposed` (text meal), `edit-proposed` (chat-targeted edit) or `choose-meal` (disambiguation). Each has its counterpart: `/v1/meals/pending/{id}/confirm|cancel`, `/v1/edits/pending/{id}/apply|cancel`, `/v1/edits/pending/{id}/choose/{n}`. An id with no route is a client holding a token it can never spend — it has happened twice now, once per confirm-first flow added.
- **Confirm and drop collapse here, unlike on Telegram.** The HTTP response IS the delivery, so there is no window in which a meal is logged (or an edit applied) and the caller has seen nothing. On Telegram they stay two calls because only the surface knows whether the card actually sent.
- **Exhaustiveness is a `switch` + `assertNever`, never an assignment.** The earlier guard cast the result to a union of the then-known success kinds and assigned it to `Exclude<HandleTextResult, Refusal | TargetGone>` — narrow into wide, which TypeScript accepts, so a new kind could never error. It didn't: two kinds were added and this file compiled clean while serving 200s no client could act on.

- **The whole user LIFECYCLE is reachable here, not just the diary.** `POST /v1/onboarding`,
  `GET`/`POST /v1/settings` and `POST /v1/language` exist because an API that can log meals for a
  user it cannot create is a peer of the bot for only half the product. Onboarding input is NARROWED,
  never cast: `step()` re-prompts on unrecognised callback data, so a malformed body would look to
  the client exactly like a stale tap and it would never learn its request was wrong — it is a 400.
- **`Accept-Language` is this protocol's `language_code`.** The surface negotiates the locale and
  passes a resolved `Lang`; the engine stores it on INSERT only, so a later header cannot override a
  choice the user made.
- **A settings POST has two shapes** — `{action}` for tapping a control, `{field, text}` for
  answering the prompt a control opened. `field` is required on the second so the engine can check
  it against the prompt actually armed; a mismatch is 409 and writes nothing. Without it a client
  racing a tap gets its text written into whichever field is armed now.
- **These views carry rendered copy, and that is the one deliberate exception** to "no product logic
  here" — see `engine/AGENTS.md`. `text` renders as-is; each button is a control that POSTs its
  `data` back as `action`.
- **There is NO erasure route, on purpose.** `resolveUserId` still resolves to `null`, so this
  surface is unauthenticated by design; adding a destructive endpoint to it would be strictly worse
  than not having one. It goes in when a real auth scheme does, not before.

## Where to add things

A new route → one handler that calls one `src/engine/` function. If a route needs logic the engine
does not expose, the logic goes in the engine, where the bot gets it too.

## Verify

`bun test src/api/routes.test.ts`
