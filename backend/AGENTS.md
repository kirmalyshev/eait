# AGENTS.md — src/backend

The server. Root `AGENTS.md` covers the repo; this covers this workspace.

## The shape, in one pass

```
api/routes.ts     one handler per route; it calls ONE engine function and returns
engine/           all product logic — day/week, meals, chat, identity, entitlement, onboarding
store.ts          the port; store.pg.ts is what runs, store.memory.ts is what tests run against
llm/              port.ts + prompt.ts + openrouter.ts + demo.ts. Prompts are authored ONCE, in prompt.ts.
                  `coach` is the agent loop; its tools are closures the ENGINE builds (engine/coach.ts)
auth/             token issue/verify. Tokens are stored as sha256, never in the clear
config.ts         configDefaults() is the single source of defaults; loadConfig() layers env over it
landing/          a generator, not a page. Read landing/README.md before touching copy
mail/, push/      outbound. dev/seed.ts is fixtures, written against the Store INTERFACE
```

**If a route needs logic the engine does not expose, the logic goes in the engine** — not into the
route. A route that computes is a rule the tests cannot reach.

## Invariants a reviewer should check first

- **Per-user scoping on every read and write.** `userId` arrives as an ARGUMENT resolved from
  credentials — never from a request body, a model output, or a tool call. Never widen a meal query
  beyond `id = ? AND user_id = ?`. The one exception is the RevenueCat webhook, where the id IS the
  message, and it is safe only because of the shared secret checked before the body is read.
- **Both store implementations must agree.** `store.contract.test.ts` runs the same suite against
  each. A rule proven only against the memory store is a rule about a mock's mood.
- **Empty means absent, not zero.** `totalsSince` groups by date, so a day with no meals produces
  NO ROW. Anything reading it is reading "days that have something", and treating a missing row as
  a zero is a claim the query never made.
- **A cap is charged before the model call, not after.** A cap counting only successes is one a
  retry loop walks through. Except a `GatewayRefusal` — a status that provably generated nothing
  (401, 402, 429, 503) was billed nothing, and `store.undoAnalysis` gives the analysis back. Charge
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
- **The admin is its own authority** (`EAIT__BACKEND__ADMIN_TOKEN`, constant-time, checked before
  any user is resolved). Unset means the surface does not exist — 404, not 403.

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
