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
| `trend.ts` | a daily series by day/week/month/year, and Pearson between two of them. Every number on a health chart. |
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

## Dates, health arithmetic, and the onboarding contract

> Moved verbatim from the root `AGENTS.md`, which is the router and no longer carries the detail.

- **`HEALTH_RETENTION_DAYS` is one number with four jobs, and they must agree.** How old a health
  row may be and still be stored, the widest trend a client may read, how far the phone's first
  sync reaches, and — through `DIARY_WINDOW_DAYS` — how far the diary's per-day totals go, because
  the health screen draws intake on the same axis as energy burned. It was three constants on two
  sides once; the year view is what made the drift visible.
- **Every number on a health chart is `src/shared/trend.ts`.** `trendBuckets` (Monday weeks,
  calendar months, every stored year), `bucketSeries` (the MEAN of the days with a reading — a
  weekly total and a monthly total do not share an axis, an average per day does — and null stays
  null, a gap and never a zero), `correlate` (Pearson over the buckets known on both sides, and no
  answer under five of them) and `correlationWords`. `app/health.tsx` draws; it computes nothing.
  `lib/components/chart.tsx` is hand-drawn on `react-native-svg`, which was already a dependency,
  and takes only theme tokens: the accent for the primary series, `textMuted` for the second, and
  a caption in words saying which is which.
- **The phone aggregates health in the SERVER's timezone, never its own.** `ProfileResponse.timezone`
  carries it, and `dates.ts` lives in `src/shared` for that reason. Two zones means a day's meals and
  that same day's health describe two different twenty-four-hour windows — on one screen, invisibly,
  only for people who travel.
- **Dates are computed in the configured zone, not UTC.** `dates.ts`. To shift a stored
  `YYYY-MM-DD`, use `dateMinus` — calendar subtraction, DST-safe. Never subtract fixed 24-hour spans
  and re-derive; that is off by one across a DST transition near midnight, twice a year, never
  reproducibly.
- **A meal's date changes ONLY via re-date.** `EditMealRequest` has no `date` field, so the manual
  editor cannot reach it. `MealPatch` does, for the one sanctioned path.
- **Onboarding is ONE CHAT with Spud, and the design is `product/design/onboarding/`.** `copy.md` is
  every sentence and is the source of truth: change it before changing a string. The ten profile
  questions are asked one at a time in `ONBOARDING_STEPS` order, plus ONE that collects no profile
  field (what has been hard) whose answer lives in the stored thread rather than in a column, and
  `REPORTABLE_FIELDS` has no room for it by construction, which is what keeps "binge episodes" out
  of a funnel row. **A question earns its place by having a reader.** There were four; why now, the
  hardest moment and eating out were cut on 2026-08-26 because nothing in `src/` read back what they
  wrote — the user pays for a question like that and never sees it come back. `struggles` survived
  because it picks the support cards a sentence later, which the user does see.
- **Onboarding: the WORDS are editable, the QUESTIONS are not.** `src/shared/onboarding.ts` holds
  three layers and the line between them is the whole design. STEPS are the profile fields the
  calorie target needs — fixed in code. SCREENS are how those fields are grouped and the unit the
  copy is keyed by — fixed in code, and one may be switched off only when nothing on it reaches
  `explainTargets` (today: only `country`). CONTENT is `asks` (what Spud says to pose each field,
  one entry per bubble), the option labels, the front door and the plan — fully editable in the
  backend admin. `validateOnboardingContent` enforces that boundary ON THE WRITE, so bad copy never
  reaches a phone; an admin can rewrite every question and cannot produce a target computed from a
  value nobody chose.
- **The REPLIES and the support cards are code, not copy.** `src/shared/onboarding-chat.ts` holds
  the branch logic and every sourced statistic ("about 42% of adults", "n = 1.18M"). An admin text
  box in front of a health statistic is an unsubstantiated claim one typo away from every phone,
  with no gate in front of it — the thing `landing/claims.ts` exists to stop in public copy. Two
  percentages in that file are READ from `MAX_DEFICIT_SHARE`/`MAX_SURPLUS_SHARE` rather than typed.
  Three rules hold over every reply and each has a test: speak to the branch taken, deliver a stat
  once, and never lean on structure the user cannot see.
- **Onboarding content is fetched at runtime, so both directions of drift are normal.** A shipped
  app outlives its server. The app walks `CHAT_PROMPTS`, which is compiled in, so a screen from a
  newer server is carried and never rendered; `usableContent` discards a whole revision from an
  OLDER one when any question is missing its `asks` — a question with no sentence to ask it with is
  a conversation that stops, not a degraded screen. The app renders the compiled-in default first
  and upgrades in place — onboarding must never open on a spinner. The server runs the same guard
  on the read, so the admin editor opens on something that can be saved.
- **Onboarding analytics carry no answers.** `REPORTABLE_FIELDS` is the whitelist: enumerated
  choices only (`goal`, `sex`, `activity`, `pace`, `country`, `restrictions`). Never a weight, a
  height, a year of birth, the medical free text, or the conversation answer. Enforced
  on the client AND again in `recordOnboardingEvents`, because a client-side promise about what it
  sends is not a control. The funnel is erased with the account, which is a real analytics cost
  accepted deliberately.
