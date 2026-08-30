# AGENTS.md — src/shared

The contract both sides implement. Root `AGENTS.md` covers the repo; this covers this workspace.

**It may not import from `src/backend` or `src/mobile`.** A dependency in either direction makes it
a third implementation instead of the agreement between two.

## What lives here, and why it is here rather than on one side

| file | it is here because |
|---|---|
| `contract.ts` | routes, request/response types, the refusal→status map. Change an endpoint and both sides break together, which is the point. |
| `types.ts` | `Profile`, `MealAnalysis`, `MealRecord`, the verdict vocabulary. |
| `targets.ts` | the calorie target and **the floor**. Read its header before touching any of it. |
| `dates.ts` | calendar maths in a named zone. The phone aggregates health into days, so both sides compute dates. |
| `health.ts` | `HEALTH_FIELDS` + `aggregateDays`. Day attribution is tested with no simulator. |
| `onboarding.ts`, `onboarding-chat.ts` | the question set and the branch logic. |
| `perf.ts` | `PERF_SCREENS` and every screen's budget. |
| `entitlement.ts`, `chat.ts`, `thread.ts`, `projection.ts`, `claims.ts`, `notifications.ts` | same rule: one definition, two consumers. |

Everything is exported through `index.ts` (`export *`), so a new export needs no wiring.

## Invariants a reviewer should check first

- **A limit the server enforces is SENT, never compiled into both sides.** `Limits` is the carrier
  and `configDefaults()` the source. A constant here that also exists as a server bound is two
  numbers that will eventually disagree — and the user meets that as a refusal after they have
  already acted. `MAX_UPLOAD_BYTES`, `MAX_PHOTOS_PER_MEAL` and `DIARY_WINDOW_DAYS` are FALLBACKS for
  a client with no profile yet; the server is the authority.
- **A bound means exactly what its comment says it bounds.** `DIARY_WINDOW_DAYS` bounds
  `/v1/diary/week` — which days can be MARKED. It does not bound `/v1/diary/day`, which answers for
  any date. Using it to gate anything else is how the date picker came to refuse days the server
  would happily return.
- **Verdicts are computed, never accepted** — not from the model, not from the client.
  `AnalyzedMeal` is `MealAnalysis` minus `verdicts` and the gap must never be closed with a cast.
- **Dates are computed in the configured zone, never UTC.** Shift a stored `YYYY-MM-DD` with
  `dateMinus` — calendar subtraction, DST-safe. Never subtract fixed 24-hour spans.
- **`YYYY-MM-DD` and `YYYY-MM` compare correctly as strings.** That is deliberate and is why
  ordering, windows and month arithmetic use plain `<`/`>` rather than parsing.
- **The calorie floor is unconditional.** Share cap first, floor second. Any new code path that
  produces a kcal target goes through `explainTargets`.

## Testing

`bun test ./src/shared` — no database, no simulator. Every file here has a `.test.ts` beside it and
that is the expectation for anything added: this is the layer where a rule can be proven cheaply,
so a rule that is only exercised through the app is in the wrong place.

TDD is the repo's rule and it is enforceable here more than anywhere: write the failing test, watch
it fail, implement, watch it pass.

## Adding to this workspace

A new domain rule or type both sides need → a file here, exported from `index.ts`. If only one side
will ever use it, it does not belong here — put it in that side and keep this the agreement.
