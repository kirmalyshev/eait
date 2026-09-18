# AGENTS.md — backend

> This workspace also lives inside a private monorepo (the app, the web client, the landing, the deploy tree). Paths such as `src/mobile/…`, `docs/…`, `scripts/…`, `deploy/…` and `#NNN` issue references point there; the rules they support hold here regardless.

The server. Root `AGENTS.md` covers the repo; this covers this workspace.

## The shape, in one pass

```
api/routes.ts     one handler per route; it calls ONE engine function and returns
engine/           all product logic — day/week, meals, chat, identity, entitlement, onboarding
store.ts          the port; store.pg.ts is what runs, store.memory.ts is what tests run against
llm/              port.ts + prompt.ts + openrouter.ts + demo.ts. Prompts are AUTHORED in prompt.ts and
                  may be OVERRIDDEN by a row in llm_prompts; prompt.ts is the seed and the fallback
                  `coach` is the agent loop; its tools are closures the ENGINE builds (engine/coach.ts)
auth/             token issue/verify. Tokens are stored as sha256, never in the clear
config.ts         configDefaults() is the single source of defaults; loadConfig() layers env over it
mail/, push/      outbound. dev/seed.ts is fixtures, written against the Store INTERFACE
telegram/         the Telegram connector, a second transport over the engine — telegram/AGENTS.md
```

**If a route needs logic the engine does not expose, the logic goes in the engine** — not into the
route. A route that computes is a rule the tests cannot reach.

## Invariants a reviewer should check first

- **Per-user scoping on every read and write.** `userId` arrives as an ARGUMENT resolved from
  credentials — never from a request body, a model output, or a tool call. Never widen a meal query
  beyond `id = ? AND user_id = ?`. The one exception is the RevenueCat webhook, where the id IS the
  message, and it is safe only because of the shared secret checked before the body is read.
- **Both store implementations must agree.** `store.contract.test.ts` runs the same suite against
  each. A rule proven only against the memory store is a rule about a mock's mood. Its Postgres
  half runs under `./dev test`, against this worktree's own DERIVED test database — never a
  hand-created `eait_test`, which several worktrees would share while all of them migrate and
  write it, and never the dev database, which `./dev seed` puts an admin into.
- **Empty means absent, not zero.** `totalsSince` groups by date, so a day with no meals produces
  NO ROW. Anything reading it is reading "days that have something", and treating a missing row as
  a zero is a claim the query never made.
- **A cap is charged before the model call, not after.** A cap counting only successes is one a
  retry loop walks through. Except a `GatewayRefusal` — a status that provably generated nothing
  (401, 402, 429, 503) was billed nothing, and `store.undoAnalysis` gives the analysis back. One
  exception is accepted (#523): on a streamed photo turn the glance runs beside the analyzer on its
  own model and may already be billed when the analyzer is refused. The analysis is given back
  anyway — one bounded glance is worth less than a user's analysis — and the glance's cost, finding
  no row, reaches only the `cost not recorded` log line. Charge
  on ambiguity: a timeout or a truncation may have run — and so does a gateway status on any call
  but the FIRST of a turn (the schema retry, `routeText`'s focused second call), because those
  follow a completion that was billed.
- **Errors are logged, never returned.** An error string from deep in the stack can carry the
  prompt, and the prompt carries the user's medical free text. Config goes through `redact()`.
- **Never log the API key, the database URL with credentials, or raw image bytes.**
- **The app never creates the database.** `migrate()` creates tables inside a database that must
  already exist.
- **State conditions live in the store's own guarded statements**, never in a read the engine did
  first: deliveries can be concurrent, nothing is transactional, and a decision made from a stale
  read is dropped permanently.
- **The admin is a ROLE an account carries** (`users.role`, checked `=== "admin"` AFTER the user is
  resolved). It was its own authority — a shared `EAIT__BACKEND__ADMIN_TOKEN` reached before any
  user existed — until #391b; that token is retired, because a replayable secret in a header and a
  role are two ways in, and two ways in must not survive a deploy. What did not change: nobody
  holding the role means the surface does not exist, and every path under it answers 404, not 403.
  An identified ordinary account gets 404 as well; only an anonymous request gets 401, because the
  public page already proves the route exists. **The role is granted OUT OF BAND and only out of
  band** — `EAIT__BACKEND__ADMIN_BOOTSTRAP_USER_ID`, a user id and never a provider subject, applied
  at boot. It is not on `Profile`, so no `PATCH` can write it in either store; it is not in the
  column list `mergeUsers` copies, so no merge can carry it. Deleting the last admin switches the
  surface off, which the variable never could.

## Windows and bounds

`/v1/diary/week` is bounded (`MAX_WINDOW_DAYS`, re-exported from the contract so the app can be
TOLD it). `/v1/diary/day` is **not** bounded — it validates the shape of a date and nothing else.
When you read or write a comment about either, say which one it constrains: a bound described as
covering more than it does is how a client comes to refuse something the server would have answered.

## Testing

`bun test ./src/backend` — no database needed, because the memory store is a real implementation of
the port rather than a mock. `EAIT__BACKEND__DATABASE_URL` is only for `make run-backend`.

The demo analyzer (`llm/demo.ts`) must stay **as poor as the real one**. A fake may be poorer than
the real thing, never different in a way a test can see: it once supplied `verdicts: {}` where the
real analyzer supplies none, so `--demo` could not reproduce a crash that hit every real run.

## Adding to this workspace

New endpoint → the route in `src/shared/contract.ts` FIRST, then one handler here that calls one
engine function, then a client method. New product logic → `engine/`. New LLM capability → a port
type in `llm/port.ts`, a prompt in `prompt.ts`, an implementation in `openrouter.ts`, and a canned
one in `demo.ts` so the tests still run.

A SEVENTH SYSTEM PROMPT IS FOUR EDITS, and the tests name the one you forget: the constant and its
entry in `PROMPT_DEFAULTS`, its key in `PROMPT_KEYS`, the same key in the `llm_prompts_key_check`
constraint in `store.pg.ts`, and the call site in `openrouter.ts` reading it off `await prompts()`
rather than importing the constant. Miss the constraint and `prompt.schema.test.ts` fails naming
the key with no database; miss it and run the store contract suite against Postgres and that fails
naming it too.

## Auth, the paid tier, and the surfaces the server owns

> Moved verbatim from the root `AGENTS.md`, which is the router and no longer carries the detail.

- **Onboarding also happens in a browser, at `/start`.** `src/backend/web/`, served by the backend,
  server-rendered, no JavaScript and no build step — so the page and the form handler are the same
  origin and there is no CORS to add to an API that deliberately has none. Sign in with Apple or
  Google, answer the same questions `shared` defines, read the plan, and subscribe through a
  checkout link that carries the user id. **It offers the SAME PAIR the app does, and that is the
  point rather than symmetry**: the app shows two buttons, and pressing the other one lands in a
  different account — it attaches to the anonymous one the install already has, so onboarding runs
  again and the web-made plan, plus anything bought from it, stays on an account
  `engine/identity.ts` will never merge. The plan page names the button they used. **`webProviders`
  in `auth/web-oauth.ts` decides what exists**: no provider configured and every path answers 404,
  the shape `/admin` and the purchase webhook use; one configured is a supported host and the
  other's routes 404. Apple's client secret is not a stored string — it is a five-minute ES256 JWT
  minted per exchange from the `.p8`, and the Service ID (not the bundle id) is what its token
  carries as `aud`. Design and configuration: `docs/WEB_ONBOARDING.md`.

- **Photos live with the meal.** A logged meal's photos are stored in `meal_photos` (bytea, cascade
  from `meals` and `users`), written by `logPhotoMeal` AFTER the caps are charged and the meal is
  inserted, and never for a refused or failed turn. Every read is `meal_id = ? AND user_id = ?`
  (`GET /v1/meals/:id/photos/:n`); they move with a merge and go with the meal or the account.
  Never on the server's disk, never logged, never in a result. The phone still deletes every
  capture in a `finally`; fetched photos sit in expo-image's disk cache, cleared with the session.
  `scripts/export-photos.ts` is the one cross-user read and is host-side only. Design:
  `docs/superpowers/specs/2026-09-05-photo-storage-design.md`.
- **A session token is stored as a hash, and expires when it stops being used.**
  `src/backend/auth/tokens.ts`. The `tokens` table holds `sha256(token)` and there is no column
  holding the token — a dump names accounts and login times without letting the reader become any of
  them, which matters because a dump runs nightly by cron and is rsynced off the box on purpose.
  Expiry is IDLE time, not age: 180 days without a request, slid forward on use. An absolute one
  signs out the people who use the app most, on a schedule, for no benefit.
- **The paid tier is SERVER state, and the RevenueCat webhook is its only source.** The App Store
  takes the payment, RevenueCat is told, and it posts to `/v1/revenuecat/webhook` — which is off
  entirely unless `EAIT__BACKEND__REVENUECAT_WEBHOOK_TOKEN` is set (404, like `/admin`, because
  "there is a purchase webhook here" is information). No client route grants an entitlement and
  there must never be one: the phone's own `CustomerInfo` from the SDK is a rendering hint, and it
  disagrees with the server for a few seconds after every purchase, when only one of the two is the
  thing refusing requests. The app is TOLD, in `ProfileResponse.entitlement` and
  `limits.dailyPhotoCap`. **The cap is decided in `dailyPhotoCap` (`engine/entitlement.ts`) and
  nowhere else** — `checkCaps` refuses with it and `limitsOf` reports it, and two copies of that
  number is the app promising an allowance the server will not honour. A paid account gets a bigger
  per-user cap, never an exemption from `globalDailyAnalysisCap`. **There is no free tier.** An
  account gets `freeAnalyses` (15, three days of meals) analyses over its lifetime — photo, library or typed, so a sentence is
  not the free way around the ask — and `checkCaps` answers every later one with
  `subscription-required` (402) until the webhook has written an entitlement. `limits.sampleUsed`
  tells the app, and the app opens the paywall on it; the refusal is the authority, the sheet only its
  rendering. **The sheet is RevenueCat's, authored in their dashboard** and presented by
  `RevenueCatUI.presentPaywall()` — so its copy ships with no review and no deploy, and the landing
  page's claims gate does not run over it. `presentPaywallIfNeeded` is never used: it gates on the
  SDK's own `CustomerInfo`, which is the copy this app may not branch on. A purchase ends by polling
  OUR profile until the webhook has landed (`lib/paywall.tsx`), because for those seconds the phone
  says subscribed and the server still answers 402. **And then the app carries out the action the
  sheet interrupted** — the photo, the typed meal, the correction, the question — on its own: a gate
  the user resolves never costs them their input, and never asks for a second attempt (#662). On
  2026-09-13 a typed meal met the sheet, the purchase went through, and the meal was simply gone. **A lifetime unlock and a subscription are SEPARATE grants on one
  record**, because a customer can hold both: `expiresAt` is the subscription, `lifetimeProductId`
  is the unlock, and `entitlementLive` says entitled if either does. One field carried both once,
  and refunding the lifetime then revoked a monthly plan that was still paid for. Each delivery
  touches exactly one of them — an expiry sets the subscription, `NON_RENEWING_PURCHASE` grants the
  unlock, and `CANCELLATION`/`EXPIRATION` with no expiry clears it only when the stored unlock came
  from the same product. **Every state condition lives in the store's own guarded statements, never in a
  read the engine did first**: deliveries can be concurrent, nothing is transactional, and the
  webhook answers 200 either way, so a decision made from a stale read is dropped permanently.
  **Webhook delivery is not
  ordered**, so `putEntitlement` applies an event only when it is newer than the last one applied TO THAT GRANT — the
  same rule `weight_measured_at` enforces, and without it a cancellation generated before a renewal
  arrives after it and revokes a subscription somebody is paying for. And the id in the payload is
  the ONE user id in this codebase that comes from a request body: that is what the message is, it
  is safe only because of the shared secret checked before the body is read, and `putEntitlement`
  never creates a user.
- **A cap on an account is not a cap while accounts are free.** `POST /v1/auth/device` mints one for
  anybody with a 32-character string, so the sample (`EAIT__BACKEND__FREE_ANALYSES`, fifteen analyses per account)
  costs an attacker one HTTP call to reset — and the only remaining bound, the instance budget, is the thing they are trying to exhaust.
  `src/backend/api/ratelimit.ts` bounds the billed routes PER ADDRESS as well. The address is the
  **last** `X-Forwarded-For` value, never the first: a proxy appends what it saw, so everything left
  of it was written by the client. IPv6 keys on the /64. In memory, so a restart forgives everyone
  and a second replica would double every limit — both stated, neither discovered.
- **A form submission is not consent.** The mailing list is double opt-in: a submission writes a
  PENDING row and sends one confirmation, and only the link in it adds anybody. An address never
  confirmed is deleted within a week, because it is personal data held with no basis and quite
  possibly somebody else's. Re-submitting a pending address re-sends the SAME link (a new token
  invalidates the one already in their inbox); re-submitting a confirmed one sends NOTHING (it would
  be unsolicited mail, and answering differently makes the endpoint an oracle for who is on the
  list). The success page is `/check-your-email`; `/subscribed` belongs to the confirmation link.
- **`deploy/backup.sh` is scheduled by ansible, not by a comment.** `roles/eait_app/tasks/backup.yml`
  writes `/etc/cron.d/eait-backup` and takes the first dump during the deploy that installs it, then
  asserts a file exists. The tree lives at `/srv/eait/**src**`; a cron line missing that `src` fails
  every night into a log nobody reads, which is what the old one did. The off-site half is
  `deploy/backup-offsite.sh`: restic pushes the dumps — encrypted before a byte leaves the box, they
  carry medical free text — to the repository in `eait_restic_repository`, on the same cron file,
  once `eait_backup_offsite_enabled` is set; the three credentials travel the environment → host →
  refuse path the mail key uses, and every deploy then RESTORES the latest dump back from the
  remote and asserts it is a database dump, because an upload nobody has restored is not a backup.
  `make remote-backup-check` is that same proof on demand.
- **One health metric has an effect, and it is weight.** It updates `profile.weight_kg` server-side
  through the same range guard the manual form uses, and only when its measurement is NEWER than
  `weight_measured_at` — otherwise a sync firing seconds after the user types their weight silently
  reverts it. Activity, energy and sleep are stored, shown, and change nothing: the activity
  multiplier already prices activity into TDEE, so adding active energy on top double-counts it and
  erases the deficit. `targets.ts` is untouched by health.
- **The chat thread is stored on the server, and the engine writes it.** `chat_messages` /
  `Store.appendChat`, written by the engine function that PRODUCED the turn (`handleText`,
  `logPhotoMeal`, `confirmPendingMeal`, `cancelPendingMeal`, `editMeal` via `engine/chat.ts`).
  The app may add ONLY through `POST /v1/messages/lines`: the user's own words, and Spud's scripted
  lines BY ID (`SCRIPTED_LINES` in `src/shared/chat.ts`) — never assistant prose from a client,
  because a phone must not be able to put a sentence in Spud's mouth. Spud's first verdict is
  `firstVerdictLines`, deterministic and spoken once. The Chat tab (`GET /v1/messages`) is the
  thread's continuation, so it never shows a line the server does not have. A photo bubble carries
  the meal id and fetches the picture through the scoped route; no bytes travel in a line. A meal card stores the meal ID and is resolved on READ (`chatHistory`),
  so it shows the meal as it is now and a verdict never outlives its numbers. A proposal writes
  the words when they are said and the card only when confirmed, so a turn taken while the card
  sits keeps its place; a refused turn writes nothing; a thread write that fails never fails the
  turn. Erased with the account (it holds the medical free
  text), moved by an anonymous→real merge, and never joined to `onboarding_events` — the funnel
  stays answer-free.
- **A question in chat goes to the coach, and the coach's tools are closures over ONE user id.**
  `engine/coach.ts`. The router (`routeText`) still decides what a message IS — a described meal,
  a correction, a re-date are confirm-first and unchanged — and hands a question to `llm.coach`
  with the last `COACH_HISTORY_LINES` thread lines, the plan and why it is what it is, today, the
  week, and two read-only tools: `get_meals` (a date window ≤ 31 days, ≤ 60 rows, via
  `store.mealsSince`) and `get_health` (≤ 90 days). THE ENGINE BUILDS THE CLOSURES; the port that
  runs the loop (`openrouter.ts`, at most `MAX_COACH_ROUNDS` tool rounds and then one forced
  answer with `tool_choice: "none"`, the whole turn inside ONE `llmTimeoutMs`) never sees an
  account and cannot reach a row on its own — the one place a
  model output would otherwise choose whose rows to read. Every replayed line and the message pass
  `normalizePromptText`: the thread holds words the model wrote and words the user typed, and both
  are read back into a prompt. A tool's failure reaches the model as `{ error }` and its message
  reaches the log only — a query can carry the medical free text. The reply carries up to three
  `suggestions`, chips for the LIVE turn only; the thread stores the sentence. The router's own
  sentence is the fallback when the coach fails, so an outage is today's chat, never
  `analysis-failed` on a turn already charged. The coach has its own model,
  `EAIT__BACKEND__LLM_CHAT_MODEL` (text only; the analyzer keeps the vision one), and the
  persona and its rules are one prompt, `SYSTEM_COACH`, with a test naming each rule. Design:
  `docs/superpowers/specs/2026-09-02-coach-chat-design.md`.
- **The web session cookie is `/start`'s alone.** `src/backend/web/start.ts` reads it and nothing
  else does — `resolveUserId` in `api/routes.ts` stays bearer-only, because an API that accepts a
  cookie is an API another origin can post to on a signed-in browser. `SameSite=Lax` is what
  protects the forms (a cross-site POST carries no Lax cookie), which is why every state change
  there is a POST; the one GET that changes anything is the OAuth callback, and what protects that
  is comparing `state` against its own cookie. Without that comparison a stranger finishes a sign-in
  as themselves in somebody else's browser, and that person then types their weight into the
  stranger's account.
- **An identity comes out of a verified token, never out of a request.** `auth/verify.ts` checks
  signature, issuer, expiry AND audience. Skipping the audience check makes any other app's token a
  valid login here. An unconfigured audience list must refuse the route, never verify without it.
- **A provider that cannot sign anybody in is not a way into an account.** `signsIn` (in
  `src/shared/contract.ts`, beside `PROVIDERS`) is the one predicate, and every rule that reads
  `identities` to decide who can reach an account asks it: `removeIdentity` deletes the account when
  the last SIGN-IN identity goes, and `isAnonymous` ignores anything that is not one. `telegram` is
  a transport onto an account made elsewhere and mints no session. Counted as a way in, one row made
  two older rules wrong at once — an account survived with nothing that could ever sign into it, and
  a device account with a bot connected stopped merging on its owner's first real sign-in.
- **Merging is anonymous→real only.** `engine/identity.ts`. Two accounts that both carry a real
  identity are never merged — there is no safe answer to whose profile survives. And a merge DROPS
  the anonymous device identity rather than repointing it, or signing out would let plain device
  auth walk straight back in. Both store implementations must agree; a test asserts it.
- **The email scope is requested and the address is stored; nothing wider is.** Apple:
  `AppleAuthenticationScope.EMAIL`. Google: `scopes: ["openid", "email"]` — still NOT
  `expo-auth-session/providers/google`, because that wrapper unions whatever you pass with
  `userinfo.profile` as well and offers no way out (`applyRequiredScopes`), which would put a name
  and a picture on the consent screen and in the token: two personal fields nothing here reads. The
  `sub` claim is still the whole account key and nothing authenticates with an address. It lands on
  the `identities` row through `setIdentityEmail`, called AFTER the branch in `signInWithProvider`
  — a returning user links nothing, and that is the only path an account created before this will
  ever take again. Apple sends the address on the FIRST authorization and never again, so an
  absent one must never overwrite a stored one. Asking for it obliges Apple's
  `response_mode=form_post` on the web, which `web/start.ts` bridges back to a GET so the
  `SameSite=Lax` state cookie still guards the callback. Retiring the old "no email, no name"
  promise is issue #95, and every surface that carried it moved in the same change — the claim is
  refused on the admin WRITE and on the READ (`retired-no-email` in `claims.ts`, `usableWelcome`),
  because onboarding copy is stored per host and outlives the binary that shipped it.
  The redirect is the BUNDLE ID scheme, the one of Google's two accepted forms that Expo's
  scheme plugin already registers; writing `ios.infoPlist.CFBundleURLTypes` to take the other turns
  that plugin off and drops the app's own deep links.
- **A system prompt is AUTHORED in `src/backend/llm/prompt.ts` and may be OVERRIDDEN by a row.** It
  used to be truer than that — "no prompt string is written anywhere else" — and it stopped being
  true when the prose moved into `llm_prompts` so it could be edited without a deploy. What still
  holds: no second prompt string is written in the SOURCE, the six constants are the SEED AND THE
  FALLBACK, and an empty table, a deleted row, a row that fails containment or a database that is
  down all resolve back to them (`loadPrompts`, which cannot throw). `PROMPT_KEYS` is the set of
  prompts that exist; the `llm_prompts` check constraint spells the same six out by hand, and
  `prompt.schema.test.ts` fails naming the key when the two disagree, so a seventh prompt cannot
  half-land. What did NOT move, and must not: `normalizePromptText` (a containment boundary, not
  editable content), every `build*` function (they interpolate the user's own data and enforce its
  caps — a stored template would be a language this repo then owns), the Zod schemas, and
  `COACH_TOOL_DEFS` (both are structurally coupled to what the engine parses into). A stored prompt
  replaces the TEXT of one system message and reaches nothing else: it is JSON-escaped into that
  field, so text shaped like a second message, a tool definition or a tool result stays text.
  **Validated on the WRITE** (`validateStoredPrompt`, via `savePrompt`), because a stored prompt
  meets no reviewer and no typecheck — same character classes `normalizePromptText` strips, minus
  its shape rules, since a prompt is the frame around a span rather than a span. Refused, never
  repaired: silently deleting a character changes what the model was asked without telling anyone.
  The table is **append-only** (`(key, version)`), because an edit that changes model behaviour with
  no record is the failure mode here — `store.promptRevisions` is the trail. **Global rows, no
  `user_id`, and that is safe because a prompt is not a user's data**: it is what this server sends
  on behalf of every account, so there is no query here to widen past one. What would falsify all of
  this: a per-user prompt (it would need the scoping), or any builder, schema or tool definition
  following the prose into the table.
- **Public copy passes a claims gate before it is written, not before it is reviewed.**
  `src/landing/claims.ts` fails the build on a health claim (`lose weight`, `guaranteed`,
  `lowers cholesterol`, `detox`) and on a superiority or exclusivity claim (`the only app`, `every
  other app`). FTC substantiation is per claim; an unsubstantiated "the only" is an
  *Alleinstellungsbehauptung* under §5 UWG and actionable by any competitor. The rule set is a
  deliberate copy of `eait-marketer/src/claims.ts` — change one, change both.
- **A number quoted in public copy is read from the code that produces it.** The landing's floor
  section quotes `KCAL_FLOOR`, and a test fails when the copy and the constant disagree. A safety
  guarantee described in marketing that the app does not implement is the worst sentence this repo
  could publish.
- **A subscriber is not a user, and no row may join them.** Since issue #95 an account carries an
  address too, and that is a DIFFERENT thing: it belongs to an account, is held to run it, and is
  erased with it, while a subscriber has no account and consented to one specific thing — being
  told when the app ships. Neither basis covers the other, so the two are never reconciled,
  deduplicated or read together. `subscribers` has no foreign key to `users` and must not gain one. The
  consequence — deleting an account does NOT leave the list — is stated on the page and in the
  privacy policy, because a privacy promise with an unstated exception is how one becomes a
  complaint. Withdrawal is a capability token in a link: no login, no confirmation screen, and
  clicking it twice says the same thing both times.
- **`--env-file` feeds compose's interpolation, not the container's environment.** A variable that
  is in `deploy/.env.prod` and not in that service's `environment:` block reaches nothing. It looks
  configured from the host and is absent inside the process; `EAIT__BACKEND__LANDING_URL` shipped that way and the
  only thing that found it was posting the form at the deployed server.
- **The photo route streams when asked, and the last line is the answer.** `POST /v1/meals/photo`
  with `accept: application/x-ndjson` answers `200` at once and writes one JSON object per line:
  zero or one `glance` (a separate call on a model that does NOT reason,
  `EAIT__BACKEND__LLM_GLANCE_MODEL`, its text never stored anywhere), an `item` per object the
  analyzer closes inside `items` (`llm/partial.ts`, a scanner over the streamed JSON), and the
  `LogPhotoResult` LAST — refusals included, because the status went out with the first byte.
  Everything the route rejects BEFORE the engine runs is still an HTTP status. Without the header
  it is the JSON route it always was, and `logPhotoMeal` without `onEvent` makes no glance call.
  The pending card renders item NAME and GRAMS only; the kcal, the macros and the verdicts are the
  final card's, so nothing provisional is a number the product later contradicts. Measured
  2026-09-05 (`docs/ACCURACY.md`): the 30 s wait was grok-4.5's reasoning — a median 37 s to first
  visible token, 0 to 4433 reasoning tokens on the SAME photo — and that endpoint refuses to switch
  reasoning off. `EAIT__BACKEND__LLM_REASONING_EFFORT` is the knob and ships unset until the n=30
  bake-off says otherwise; the glance is what puts a sentence on the screen in about a second.
