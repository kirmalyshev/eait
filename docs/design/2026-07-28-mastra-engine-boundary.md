# Mastra engine + the bot/mobile boundary — design

Date: 2026-07-28 · Supersedes the rollout half of `2026-07-27-mastra-agent-engine.md`

## Goal

Two things, stated separately because they are orthogonal and get conflated:

1. **Mastra is the only LLM driver.** `provider.ts` / `factory.ts` / `openrouter.ts` and the three
   `analyzer.ts` call sites that use them are deleted.
2. **One engine, two front ends.** The Telegram bot and a future mobile app call the same
   transport-agnostic engine. Neither owns product logic.

Today neither holds. The Mastra path (`llm/mastra.ts`, `agent.ts`, `context.ts`, `tools/`,
`analyzeViaAgent.ts`) is built and tested but **nothing reachable from `index.ts` imports it** — the
running bot is still `analyzer.ts` → `provider.chat` → OpenRouter. And the product logic lives in
`tg_bot/bot.ts`'s `process*` functions, which take a `send` callback and emit rendered Telegram
strings.

## The distinction that shapes everything

**Mastra is the LLM engine. It is not the product engine.**

Caps, per-user scoping, verdict gating, and persistence are policy. They must sit *outside* the
agent, on the caller's side, where no model output can influence them. An agent that owned its own
rate limit is an agent that can be talked out of one.

```
┌── surfaces ────────────┐   ┌── product engine ─────────┐   ┌── Mastra ──────────────┐
│ tg_bot/  grammy, i18n, │   │ engine/  caps · scoping · │   │ agent · memory · tools │
│          buttons,      │──▶│          gating · persist │──▶│ submit_* terminal      │
│          reactions     │   │          → Result union   │   │ search_food_db, diary  │
│ api/     Bun.serve,    │   │                           │   │                        │
│          JSON          │──▶│  the ONLY caller of llm/  │   │  never touches db.ts   │
└────────────────────────┘   └───────────────────────────┘   └────────────────────────┘
      renders results              owns every policy              produces analyses
```

The arrow that must never exist: a surface calling `llm/` directly, or a Mastra tool writing to
`meals`. Tools read (`get_diary_context`, `search_food_db`); the engine writes.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Identity | **Telegram only.** `users.telegram_id` stays the primary key | No `accounts`/`identities` table, no non-Telegram signup, no auth design in this doc. Mobile is a second surface on the same account, so caps, memory thread, and diary are shared with no work |
| API host | **`Bun.serve` in the bot process** | Builtin, zero new deps, matches the repo's builtin-first ethos (`Bun.sql`, no ORM). The bot keeps owning the process — long-polling runner plus graceful stop. Mastra's `registerApiRoute` would add hono + a deployer and move process startup out of `bun run src/index.ts` |
| Order | **Cut over to Mastra, then extract the engine** | One variable at a time. If accuracy regresses it is the model path, not a 1600-line refactor. Goal 1 lands sooner; the extraction afterwards is a pure refactor against a green suite |

## What blocks the cutover — two measured divergences

Both are in already-committed code, both proven by test, both silently wrong rather than loud.

**1. The agent path skips the verdict gate.** `analyzeMeal` returns `gated(parseAnalysis(raw),
profile)`; `analyzeMealViaAgent` returns `MealAnalysisSchema.parse(analysis)`. `gated()` does two
things — it *discards* the model's verdicts and recomputes them from the user's caps
(`verdictsFromTargets`), then filters to declared dimensions (`visibleVerdicts`). The agent path
does neither. Measured: a profile declaring only `ldl` receives `verdicts.kidneys === "bad"`
straight from the model. That is a medical claim on a dimension its owner never opted into — the
leak PR #34 closed on the shipped path, reopened on the new one.

**2. `submit_meal.dayOffset` is strict where `RouteSchema` is deliberately permissive.** The shipped
schema types it `z.unknown().optional()` and clamps, with a comment saying why: models commonly emit
`null` for same-day, and a strict number would reject the whole object and discard a valid analysis.
`submit_meal`'s `inputSchema` bounds it `z.number().int().min(0).max(7)`, required. Measured: `null`
yields `Invalid input: expected number, received null`, which Mastra resolves to an error-shaped
result rather than throwing — so the model retries, and on repeated failure the meal is **lost**
where the shipped path files it at offset 0.

Fix both before any traffic moves: apply `gated()` at the agent path's exit, and make the tool's
`dayOffset` permissive-then-clamped so it matches `RouteSchema` exactly.

## The parity gate

Before the old path is deleted, both paths run over the 12 fixtures extracted from the diary
(`scripts/extract-telegram-fixtures.ts`) and the difference is inspected, not assumed. The prompt is
already byte-identical — `analyzeViaAgent.ts` imports `SYSTEM` and `buildUserText` from
`analyzer.ts`, asserted by test — so any divergence is transport, tool use, or the two bugs above,
and is diagnosable. Compare items, grams, and macros; a clean diff is the ship signal.

## The engine boundary

**Contract:** an engine function takes a resolved `userId` plus typed input, and returns a typed
**result union**. It never renders, never touches i18n, never accepts a transport type.

```
logPhotoMeal(userId, {images, caption, at})  → Logged{meal, totals, hint} | NotFood | CapExceeded
                                             | NotOnboarded | AnalysisFailed
handleText(userId, {text, focusMealId?})     → Answered{text} | MealProposed{pendingId, resolvedDate}
                                             | Corrected{meal, totals} | Redated{meal, date}
confirmPendingMeal(userId, pendingId)        → Logged | Expired
diary(userId, {date}) / week(userId)         → totals
profile(userId) / updateProfile(userId, ...) → Profile
```

`Logged` carries the `MealAnalysis` and `DailyTotals`; Telegram turns that into
`renderMealCard`/`formatReply`, mobile serialises it. `hint` is a **code** (`lowConfidence` |
`correction`), not the copy — the surface resolves it through its own catalog.

**Moves into the engine** (currently in `bot.ts`): the active-state gate, both cap checks
(`llmCallsToday`, `effectiveGlobalCap`) and the `llm_calls` metering, repertoire construction,
consistency logging, meal insert plus first-photo eventing, daily totals, and the pending-meal
lifecycle. Caps especially: metering that lives in the transport is metering a mobile client
bypasses.

**Stays in the transport** because it is genuinely Telegram-shaped: album buffering
(`media_group_id`), reactions, the in-memory rejection log, inline-button state machines
(onboarding, settings), and reply-to-meal resolution. That last one is the interesting split —
`mealByReply` maps a Telegram `reply_to_message_id` to a meal, and the engine takes the resolved
`focusMealId` instead. Mobile has explicit selection (tap a card), so `meals.chat_id` /
`bot_message_id` stay Telegram surface metadata, not engine concepts.

**Onboarding and settings do not go through the engine.** They are pure button state machines over
field-nullness; mobile builds native forms over `profile`/`updateProfile` against the same columns.
Forcing both through one abstraction would make each worse.

## Target structure

```
src/
  engine/        meals.ts · diary.ts · profile.ts · caps.ts · results.ts   ← the only caller of llm/
  llm/           mastra.ts · agent.ts · context.ts · memory.ts · tools/    ← Mastra only, post-cutover
  api/           Bun.serve routes over engine                             ← mobile
  tg_bot/        grammy ctx → engine → i18n render → send                 ← thin adapter
  analyzer.ts    SYSTEM · buildUserText · MealAnalysisSchema · clampDayOffset
```

`analyzer.ts` keeps the prompt and the schemas — the root invariant that the analyzer owns both, with
the provider as thin transport, survives the migration. What it loses is the three `provider.chat`
implementations.

## Stages

Each is independently shippable and independently verifiable.

| # | Stage | Status |
|---|---|---|
| 0 | Fix the two divergences | ✅ `1285257` |
| 1 | Parity harness | ✅ **gate passed 2026-07-29** — see below |
| 2 | Photo flow → Mastra | ✅ `86f3cd8` |
| 3 | Text flow → Mastra | ✅ `a91c098` |
| 4 | Onboarding classify → Mastra | ✅ `a91c098` — **the bot runtime calls no `LLMProvider`** |
| 4b | Delete `provider.ts`/`factory.ts`/`openrouter.ts` | ⛔ blocked on the stage-1 gate (below) |
| 5 | Extract `src/engine/`; `bot.ts` becomes an adapter | ✅ `e21b5c4` |
| 6 | `src/api/` over `Bun.serve` | ✅ `2c6c918` — **both front ends share one engine** |
| 7 | An authentication scheme for `src/api/` | not started — its own decision, its own doc |

### Why the old files are still on disk

They are dev-only and unreachable from `index.ts`. Deleting them would remove the only baseline
`scripts/parity-llm-paths.ts` can measure the cutover against, and that gate has not run to
completion. "We deleted the thing that could have told us" is not a passing gate.

## What the parity harness measured

Three runs, and each one changed a decision.

**Run 1 (4 fixtures, grounding ON) — confounded.** Cross-path item agreement 60% against a 92%
within-path baseline, kcal 13.0% against 8.7%. Unreadable, because the agent path had
`search_food_db` and the old path has no equivalent: the run measured transport *and* grounding
together. That was a flaw in the harness, not a finding, and `--no-food-db` now exists to separate
them.

**Run 2 (grounding OFF) — the transport is clean.** Item agreement **100%** cross-path and
within-path; grams **0.0%** both. So the 60% in run 1 was grounding changing item names and macros,
which is the feature working, not the migration regressing.

**Both runs — a real bug, ~1 photo in 4 lost.** `analyzeMealViaAgent: the agent finished without
calling submit_meal`, on a different fixture each run, with grounding on and off. Cause: the old
path forced structure with `response_format: json_schema`, and the agent path left `toolChoice` at
its `auto` default, so the model could answer in prose and the meal was simply gone. Fixed with
`toolChoice: "required"` on every terminal-tool call. **This fix is unit-tested but not yet
confirmed live** — the confirming run died on a 402 from OpenRouter.

### The earlier parity numbers are void

Both runs predate two fixes and cannot be compared against: the agent path replayed conversation
memory (so each fixture was analyzed with the previous fixtures' photos still in the prompt —
measured at 2 → 5 → 8 → 11 prompt messages over four turns), and the grounding guidance never
reached the model at all, because Mastra's per-call `instructions` replaces rather than appends.
The *transport* conclusion — 100% item agreement with grounding off — was drawn from the FIRST
fixture of that run, which had no prior turns to inherit, so it survives. Nothing else does.

### Gate result — 2026-07-29, 4 fixtures, `--repeat 2 --no-food-db`

```
CROSS-PATH  old vs agent: kcal 5.4%  macros 7.6%  grams  4.1%  items 66% agree
WITHIN-PATH old vs old  : kcal 5.7%  macros 7.2%  grams 11.7%  items 83% agree
```

**4/4 completed, zero `finished without calling submit_meal`** — the blocking defect, previously
about one photo in four, closed by `toolChoice: "required"` plus `stopWhen`.

Every figure the product reports is at or below the model's own run-to-run spread. Grams is the
striking one: the two paths agree on portion weight (4.1%) far more closely than the old path
agrees with itself (11.7%).

**Item naming does not clear the bar: 66% cross against 83% within.** Read as noise at N=4 rather
than a regression — per-fixture within-path agreement ranges 50–100%, and on the worst fixture
cross (45%) and within (50%) are the same. Two caveats on the metric itself: the Jaccard fold
cannot collapse synonyms, so it overstates divergence in both columns; and `--no-food-db` still
sends `LOOKUP_GUIDANCE`, so that arm is not purely transport. Worth re-measuring with more
fixtures before treating the gap as real.

### What still has to happen before 4b

Re-run `scripts/parity-llm-paths.ts` on a funded key, both with and without `--no-food-db`, over
`eval/telegram` and `eval/telegram-unverified`. Expect zero `finished without calling submit_meal`
failures. Then delete the old files.

Stages 2–4 write new code **engine-shaped** — pure functions taking deps and returning results, even
while still living in `bot.ts` — so stage 5 is a move, not a rewrite.

Stage 3 must carry forward every guard `routeText` earned: correction and redate require a focus
meal, a focus-less correction with an answer salvages as a question rather than throwing,
`isFood: false` is rejected on both meal-producing intents, and `gated()` plus `clampDayOffset` run
on whatever the terminal tool carried. Under Mastra these move from post-parse branches to
per-tool availability plus `execute` guards — the tool set for a turn with no focus meal simply
omits `submit_correction` and `submit_redate`.

## Invariants that cross the boundary unchanged

- `userId` is bound into `RequestContext` by the caller; **no tool's `inputSchema` carries a user
  identifier**. The engine is now the caller, so it does the binding.
- Every meal read/write stays `WHERE id = ? AND user_id = ?`.
- **Images stay ephemeral in the API too** — a mobile upload streams to memory, is analyzed, and is
  dropped. No disk, no object store, no photo path. The upload endpoint must not gain a staging
  directory "just for retries".
- Dates in `Europe/Berlin`; `berlinDateMinus` for day arithmetic.
- Verdict dimensions gated at every analyzer exit and again at render.
- An unknown `LLM_PROVIDER` fails at startup, never silently falls back — re-homed onto Mastra's
  model config, same fail-loud contract.

## Out of scope

Non-Telegram signup, an `accounts`/`identities` schema, API authentication and token issuance, and
the mobile client itself. Stage 6 defines the routes; how a device proves it is a given
`telegram_id` is a separate decision and a separate document.

## Cost to be honest about

`bot.test.ts` is 2990 lines testing `process*` directly. Stage 5 moves most of those assertions to
engine tests and leaves `bot.test.ts` verifying adaptation — that the right engine call is made and
the right copy rendered. Done flow by flow the suite never goes red wholesale, but this is the
largest single piece of work in the plan and it buys no user-visible behaviour. It buys the mobile
app being possible at all.
