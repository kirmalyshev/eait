# Analysis quality — design

Date: 2026-07-27 · Branch: `feat/analysis-quality`

## Goal

Make meal analysis stable and predictable. Three reported failures, in the principal's words:

1. calories too high on some dishes, too low on others
2. the wrong product — "couscous instead of bulgur"
3. protein/fat sometimes wrong

These are three different mechanisms with three different fixes. Treating them as one "make it
more accurate" problem is how this stays unfixed.

## The three complaints are three mechanisms

| Reported | Mechanism | Measured |
|---|---|---|
| kcal high on some dishes, low on others | **range compression** — everything pulled toward ~500 kcal | log-log slope **0.47**; **+35%** under 300 kcal, **−57%** over 1000 |
| couscous instead of bulgur | **identification**, with no personal prior | see below |
| protein/fat sometimes wrong | **no consistency gate** — contradictions ship | Atwater lives only in `src/fixture.test.ts` (dev-only) |

Slopes measured over 60 evaluated dishes: `kcal = grams × density`, grams **0.67**, density **0.81**.

The first mechanism matters most for the framing. It is **not random**. A steep, consistent,
signed bias is exactly what "unpredictable" feels like when experienced one meal at a time. The
aggregate is predictable; the individual meal is not.

### What a misidentification actually costs

Grounded in the table `scripts/fetch-food-db.ts` already builds (`data/food-db/foods.jsonl`):

| row | kcal/100 g | fibre |
|---|---|---|
| `usda:170287` Bulgur, **cooked** | 83 | 4.5 g |
| `usda:169700` Couscous, **cooked** | 112 | 1.4 g |

kcal differs by **+35%**; **fibre differs by 3.2×**. The macro error from a wrong label is larger,
relatively, than the calorie error it is usually noticed by.

## Current state of the codebase (verified 2026-07-27, at `3079a92`)

- **No runtime macro-consistency check.** Atwater (4/4/9) exists only in `src/fixture.test.ts`.
  A meal whose stated kcal contradicts its own macros is stored and shown untouched.
- **`confidence` does nothing.** Model-authored; its only consumer is `src/tg_bot/bot.ts:725`,
  choosing which hint string to print. It never gates and has never been checked for correlation
  with actual error.
- **Corrections are applied and forgotten.** `applyCorrection` (`src/db.ts:810`) writes the row and
  sets `corrected = 1`; `buildUserText` receives profile, caption and local time — **no history**.
  A corrected name never influences the next analysis.
- **`items` is `TEXT`, not `jsonb`** (`src/db.ts:265`), so a repertoire is built in TS from parsed
  rows, not in SQL. This is the better place for it anyway — pure, testable, matches `src/`.
- **Two LLM architectures coexist.** `provider.ts`/`factory.ts`/`openrouter.ts` is wired into the
  running bot; `mastra.ts`/`agent.ts`/`tools/` (#36) is built, tested, and **unwired**. See
  `docs/design/2026-07-27-mastra-agent-engine.md`.

## Ordering: identification before grounding

The instinct is to wire `food_db.ts` in first — it is built and unwired. **That order is wrong.**

Look up `couscous` and you get precise, confident, authoritative couscous numbers for a bowl of
bulgur. Grounding does not correct a misidentification; it **amplifies** it. Today a wrong label
produces a fuzzy wrong number. After grounding it produces a sharp wrong number that everything
downstream treats as fact.

So identification (A) lands before density grounding (D), and D is not built here at all — see D.

---

## A1 · Personal repertoire prior

`recentItems(db, user_id)` reads `items` + `corrected` for the last 90 days. A pure
`buildRepertoire()` counts names, **weights `corrected = 1` meals higher** — a name the principal
fixed by hand outranks one the model invented — and returns the top ~15. `buildUserText` injects
one hedged line, worded like the existing cuisine prior in `analyzer.ts`: the photo always wins.

Empty repertoire (new user) emits no line, so nothing changes at cold start.

**The risk is anchoring, and it is symmetric.** A prior naming *bulgur* helps when bulgur was eaten
and hurts when couscous was. This is the same failure class as the deleted round-up hedge (see the
comment block at `analyzer.ts:166` — a hedge that pushes one way is only right if the model errs the
other way). It must be measured, not assumed.

## A2 · Per-item macros

`items[]` gains `kcal`, `protein_g`, `carbs_g`, `fat_g`, and `kcal_per_100g`.

The prompt **already asks for this** (`analyzer.ts:165`: "Compute kcal and macros per item from
grams + cooking method; totals are the sums across items"). The numbers are computed and discarded.

Two payoffs: it makes a per-item substitution expressible at all, and it makes an A3 tap cost
**zero LLM calls** rather than a billed re-analysis.

`MealAnalysisSchema` is imported by `src/llm/tools/mealActions.ts:31` as the Mastra terminal tool's
`inputSchema`, so this change serves **both** architectures from one edit. The old path additionally
hand-maintains `MEAL_JSON_SCHEMA` (`analyzer.ts:66`), which needs the same fields; that copy dies at
the Mastra cutover.

## A3 · Ask when the product is ambiguous

A silent prior guesses. A question **creates ground truth**. They compose: the prior resolves what
history settles, the question handles what it cannot, and the answer feeds the prior — so questions
decay toward zero as the repertoire fills.

`items[]` gains `alt[]` (max 2): `{name, name_en, kcal_per_100g}`. Gated hard, because friction
kills a food diary:

- **Materiality** — `|Δ kcal/100g| < 15%` → do not ask. A question that does not move the number is
  pure cost. This gate uses the model's own `kcal_per_100g`, which is what keeps A3 independent of
  the food DB and therefore of the Mastra cutover.
- **Repertoire first** — if history holds one candidate and not the other, resolve silently. This is
  the decay mechanism.
- **One question per meal, maximum** — the item with the largest `grams × Δdensity`. Two questions
  per card and people stop answering.
- **Never blocks.** The card ships with the best guess; buttons sit beneath it. No tap, no harm.

Tap → recompute **locally** from `kcal_per_100g` → edit the card in place (`setMealReply` already
stores chat and message id) → `corrected = 1` → feeds A1.

Callback data `amb:<mealId>:<itemIdx>:<altIdx>` ≈ 46 bytes of Telegram's 64, following the existing
`tm:log:<uuid>` precedent. `amb:` is unused — `tm:`, `st:`, `lang_`, `delete_` and the bare
onboarding names are taken. The handler is scoped `WHERE id = ? AND user_id = ?` like every other
meal read. New copy keys go in all three locales; the parity test enforces it.

## B · Consistency gate

Two checks on the model's own output, immediately after the parse, costing nothing:

- **Atwater** — `4·protein + 4·carbs + 9·fat` vs stated kcal
- **Item sum** — `Σ items` vs totals (available once A2 lands)

Tolerance `max(15 kcal, 25%)`, reusing the rule already proven in `src/fixture.test.ts`.

**Ships logging-only first.** The action is not chosen up front: if this trips on 30% of meals it is
a different product decision than 3%. Measure the fire rate over the fixture set, then choose
between forcing `confidence: "low"` (free; that path already asks for a weight) and a retry (billed,
and a self-contradicting model may contradict itself twice).

### Trap: this must NOT be a zod `.refine()` yet

A `.refine()` on `MealAnalysisSchema` is the elegant version, and under Mastra it is genuinely
excellent: validation fails → Mastra returns an error-shaped tool result → it is fed back → the
model repairs its own arithmetic. Free self-repair (see `src/CLAUDE.md`).

On the **current production path** the identical line does the opposite. `safeParse` throws, per
`analyzer.ts`'s fail-loud contract, producing `errors.analyzeFailed` and **no stored meal**. The same
one-line change means self-repair on one path and silent data loss on the other.

B therefore stays a post-parse check, and migrates into the schema only after the cutover.

## C · Grams calibration

Calibrate **grams, not kcal**. `kcal = grams × density`; D replaces density, so correcting kcal
directly would double-count once D lands. Grams is also the larger half (slope 0.67 vs 0.81).

Two parameters fitted in log space on ~60 dishes is thin enough that overfitting is the default
outcome, not a risk. So: k-fold cross-validation, report the held-out gain with a confidence
interval, and **ship only if the gain survives out of fold**. If it does not, C stops there and that
is a result worth having.

## D · Density grounding — deferred to the Mastra cutover, deliberately

`docs/design/2026-07-27-mastra-agent-engine.md` already specs a `search_food_db` tool wrapping
`food_db.ts`. Building post-hoc substitution here would create a second mechanism for one job, and
the tool is the better of the two for the failure actually reported: the model can look up bulgur
against couscous and **disambiguate**, rather than having us confidently ground whichever label it
happened to emit.

Deferring costs almost nothing — `food_db.ts` is built and tested; D was always wiring.

It also makes A3 stronger later: `alt[].kcal_per_100g` becomes a real table value instead of a model
estimate, turning the materiality gate from an approximation into a fact.

### Two hazards to carry into that work

Both found by reading the built table, not by reasoning about it:

- **Sources disagree.** `cofid:11-902` (Couscous, plain, cooked) is **178** kcal/100 g;
  `usda:169700` (Couscous, cooked) is **112**. A 59% spread on the same food, most likely different
  water-absorption assumptions. Grounding introduces its own error; it does not merely remove ours.
- **Raw and cooked are different foods.** CoFID carries `11-904 Wheat, bulgur, raw` (352) and **no**
  cooked bulgur. A lookup for cooked bulgur that settles for the raw row is wrong by **4.2×** —
  larger than any error the lookup was introduced to fix. The confidence floor must treat a
  raw/cooked mismatch as a non-match, not a near-match.

---

## What survives the Mastra cutover

| Survives | Dies with the cutover |
|---|---|
| `buildRepertoire()` — pure, `src/` | `MEAL_JSON_SCHEMA` field additions |
| `atwater()` / item-sum — pure, `src/` | `buildUserText` prompt lines (become agent instructions) |
| `calibrateGrams()` — pure, `src/` | |
| `MealAnalysisSchema` changes — already shared | |
| `amb:` callback + card buttons — Telegram layer, untouched by #36 | |

The rework cost is small and known: two schema copies collapse to one, and a few prompt lines move
into `instructions`.

## A0 · Fixtures must carry ground-truth item names (prerequisite)

**Found during spec review, and it blocks both gating experiments below.**

Every fixture on disk stores totals only:

```json
{"kcal":266,"protein_g":7.5,"carbs_g":56,"fat_g":0.8,"total_grams":174}
```

`Expectation` (`src/eval.ts:17`) has no names field. So "was the item identified correctly?" — the
question A1 and A3 both turn on — **cannot currently be asked of any fixture.**

The names are not lost, only discarded. `src/eval.ts:31` says so directly: the CSV *"repeats
per-ingredient fields we ignore"*, and `labelsAgree` (`src/eval.ts:93`) already parses ingredient
names to run the photo-pairing gate before throwing them away.

So A0 is: add an optional `items: string[]` to `Expectation`, have `nutritionverseRowToExpectation`
keep the names it already reads, and re-run the adapter. No billed calls, no new photos, no new
ground truth — only stopping the discard. Optional on the type so the 22 existing Nutrition5k
fixtures stay valid without regeneration.

### Fixture inventory (verified on disk, 2026-07-27)

| set | count | has item names | notes |
|---|---|---|---|
| `data/food-photos/` (Nutrition5k) | 22 | no | gitignored; one row is 4900 kcal / 3500 g — inspect before trusting |
| `eval/nutritionverse/` | 30 | no — **recoverable via A0** | CC BY-NC-SA, gitignored |
| `eval/weighed/` | **0 — does not exist** | — | the `docs/ACCURACY_EVAL.md` protocol is written; no meal recorded yet |

52 fixtures, none currently naming its ingredients, and **zero weighed home meals**. That last row
is the real limit on everything here: the whole set is Western/Canadian restaurant and cafeteria
food, and none of it is the Russian/German home cooking the bot is actually used on.

## Measurement

Every item is checked against fixtures, not argued for. **A0 lands first**, or the two experiments
below cannot run at all.

**A3 is gated by one experiment, run before any UI is built:**

> When the model's primary name is wrong, does `alt[]` contain the truth?

High → asking recovers real errors and A3 earns its place. Low → the model is not torn when it
should be, and no UX rescues that. One eval run, no new fixtures, decisive either way.

**A1 cannot be measured directly** — no fixture carries per-user history. Measure the mechanism
instead, leave-one-out (which also needs A0's names), in two directions:

- *helpful* — build each fixture's repertoire from other fixtures' true names; does identification
  improve?
- *adversarial* — seed the repertoire with the confusable-but-wrong name; **how much damage does a
  wrong prior do?**

The adversarial number decides whether A1 ships. A prior that overrides a correct photo reading is
a regression regardless of how well the helpful case scores.

**B** reports a fire rate before it gets an action. **C** reports an out-of-fold gain with a CI, and
ships only if that survives. Success for D, when it lands, is the **density** row moving — MAPE
14.6–20.6% → low single digits, slope 0.81 → ~1.0 — reported beside a match rate. A small MAPE gain
at a 20% match rate has tested nothing.

## Sequence

`A0 → A1 → A2 → A3 → B → C`, with D folded into the Mastra cutover.

A0 is small and unblocks the evidence for everything in A. B and C are independent of A and can
land in any order relative to it — they are sequenced last only because A addresses the failure the
principal can actually see.

## Open items

- **B's action on mismatch** — deliberately unresolved; the measured fire rate decides it.
- **Verdicts go stale under D.** Verdicts are model-authored from the model's own macros
  (`analyzer.ts:204,207`). Substituting satfat invalidates them: a reassuring `ldl: "good"` can end
  up attached to numbers that no longer exist, on a card a user with a declared restriction may act
  on. Recommendation: recompute from the caps `targetsFor` already produces — deterministic,
  auditable, and it stops the model judging at all. This is a product decision and must be settled
  **before** D ships, not after.
- **`confidence` has never been checked for correlation with error.** If it does not predict, it is
  decoration on the card and a bad foundation for any gate. Cheap to measure on the existing eval;
  worth knowing before B's action is chosen, since forcing `confidence: "low"` assumes the field
  means something.
