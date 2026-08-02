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

## Where to add things

A new route → one handler that calls one `src/engine/` function. If a route needs logic the engine
does not expose, the logic goes in the engine, where the bot gets it too.

## Verify

`bun test src/api/routes.test.ts`
