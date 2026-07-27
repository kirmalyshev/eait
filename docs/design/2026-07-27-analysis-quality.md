# Analysis quality — design

Date: 2026-07-27 · Branch: `feat/analysis-quality`

## Goal

Make meal analysis stable and predictable. Three reported failures, in the principal's words:

1. calories too high on some dishes, too low on others
2. the wrong product — "couscous instead of bulgur"
3. protein/fat sometimes wrong

These are three mechanisms with three different fixes. Treating them as one "make it more
accurate" problem is how this stays unfixed.

**Evidence discipline.** This document separates **what we measured** on our own fixtures from
**what is published elsewhere**. Published numbers come from different datasets and are never
directly comparable to ours — they are used for direction, not for targets. Sources are listed at
the end.

## The three complaints are three mechanisms

| Reported | Mechanism | Measured **by us** |
|---|---|---|
| kcal high on some dishes, low on others | **range compression** — everything pulled toward ~500 kcal | log-log slope **0.47**; **+35%** under 300 kcal, **−57%** over 1000 |
| couscous instead of bulgur | **identification**, unconstrained and with no personal prior | see below |
| protein/fat sometimes wrong | **no consistency gate** — contradictions ship | Atwater lives only in `src/fixture.test.ts` (dev-only) |

Slopes over 60 evaluated dishes: `kcal = grams × density`, grams **0.67**, density **0.81**.

The first mechanism matters most for the framing: it is **not random**. A steep, consistent, signed
bias is exactly what "unpredictable" feels like when experienced one meal at a time.

### What a misidentification actually costs

From the table `scripts/fetch-food-db.ts` already builds (`data/food-db/foods.jsonl`):

| row | kcal/100 g | fibre |
|---|---|---|
| `usda:170287` Bulgur, **cooked** | 83 | 4.5 g |
| `usda:169700` Couscous, **cooked** | 112 | 1.4 g |

kcal differs **+35%**; **fibre differs 3.2×**. The macro error from a wrong label is larger,
relatively, than the calorie error it gets noticed by.

## Where we sit against published work

| system | error | source |
|---|---|---|
| human visual estimation | 40%+ | SnapCalorie / Nutrition5k |
| **eait today** | **42.2% MAPE (ours)** | our eval |
| ChatGPT / Claude on food photos | 35.8–37.3% MAPE | Nutrients 2026 |
| GPT-4o / Claude-3.7 on ACETADA | 24.5% / 23.9% MAPE | Coburn et al. 2025 |
| SnapCalorie (LiDAR depth) | ~15% | vendor published |
| Nutrition5k, depth volume scalar | 18.7% → **13.7%** | Nutrition5k paper |

Portion is the universal bottleneck: deployed apps report **68–86% food identification but as low as
39% portion accuracy**. Our own grams/density split says the same thing independently.

**Ceiling.** ~15% requires LiDAR depth, which a Telegram photo cannot provide. **25–30% is the
realistic target here**, and the multi-photo side-view hint is our only approximation of depth.

## Best practices we already implement

ACETADA tested five reasoning modifiers. We already carry four, including the strongest:

| modifier | their reported gain | ours |
|---|---|---|
| **Expert-Persona** | **−75.39 kcal MAE** (best of five) | ✅ `analyzer.ts:111` |
| Chain-of-Thought | — | ✅ 3-step protocol into `reasoning` first |
| Scale-Hint | — | ✅ plate ~26 cm, cutlery (`analyzer.ts:164`) |
| Timestamp / meal-type | among the top-2 metadata signals | ✅ local time |
| Few-Shot Exemplars | −21.31 kcal (weakest) | ❌ never tried |

The cheap prompt wins are largely taken. That is itself a finding: further prompt tuning is not
where the remaining error lives.

---

## The architecture decision: retrieve-then-select

The original plan was **identification first, grounding second** — because grounding a wrong label
sharpens the error rather than fixing it. FoodCHA suggests something strictly better.

FoodCHA splits identification into three constrained calls (category → subcategory → cooking style,
each restricted by the last) and reports, against a one-shot 11B model:

| | FoodCHA | one-shot |
|---|---|---|
| subcategory precision | **0.789** | 0.571 |
| cooking-style precision | **0.871** | 0.344 |
| latency | 3.19 s | 15.65 s |

Subcategory precision is the couscous-vs-bulgur metric.

**The gain is not from splitting.** It is from what sits between the calls: a `PriorDB` returning
the valid candidate set per stage, a normalizer mapping output onto canonical labels, membership and
hierarchy validation, and retries with escalating strictness. Their ablation is the proof —
**removing validation drops cooking-style EWR 0.640 → 0.529.** The general decomposition literature
agrees: error propagation is the main failure mode of staged pipelines, and decomposition wins only
when validation and retry sit between the steps.

So the conclusion is not "use four calls". It is:

> **Do not ground the label afterwards. Constrain the label to the database's vocabulary in the
> first place.**

A label chosen *from* the table cannot be amplified by the table. The amplification problem
dissolves instead of being sequenced around, and lookup match rate approaches 100%.

**Adaptation.** FoodCHA's ontology is 62 subcategories — promptable. Ours is **10,780 foods** — not.
So the shape is **retrieve-then-select**:

```
 call 1   photo ──▶ free-form name · grams · per-item macros · kcal_per_100g
                          │
                          ▼
          food_db.find()  ──▶ top-K candidates (K ≈ 10)   deterministic, 0 LLM calls
                          │
                          ▼
 call 2   "which of these K is it?" ──▶ canonical row + food_id
                          │                (may answer "none of these")
                          ▼
          B validation ──▶ Atwater + item-sum ──▶ retry on failure
```

Two calls, not four. This **is** the `search_food_db` tool already specced in
`docs/design/2026-07-27-mastra-agent-engine.md`, with one amendment that must not be lost: the tool
**constrains the choice**, it does not merely inform it. A "none of these" escape is mandatory —
without it the model is forced to pick a wrong row, which is worse than its own guess.

**What this does not fix.** Every FoodCHA gain is identification. **Portion is untouched** — and
portion is our larger half, and the stage the field puts at 39%. Cost is ~2× calls and ~2.5×
latency; ours runs ~10 s per call, so ~20 s to a card, behind the existing 👀 reaction.

---

## Current state of the codebase (verified 2026-07-27, at `3079a92`)

- **No runtime macro-consistency check.** Atwater exists only in `src/fixture.test.ts`. A meal whose
  stated kcal contradicts its own macros is stored and shown untouched.
- **`confidence` does nothing.** Model-authored; its only consumer is `src/tg_bot/bot.ts:725`,
  choosing a hint string. Never gated, never checked for correlation with error.
- **Corrections are applied and forgotten.** `applyCorrection` (`src/db.ts:810`) writes the row and
  sets `corrected = 1`; `buildUserText` gets profile, caption and local time — **no history**.
- **`items` is `TEXT`, not `jsonb`** (`src/db.ts:265`), so a repertoire is built in TS from parsed
  rows. Pure and testable, which suits `src/`.
- **Two LLM architectures coexist.** `provider.ts`/`factory.ts`/`openrouter.ts` is wired into the
  bot; `mastra.ts`/`agent.ts`/`tools/` (#36) is built, tested and **unwired**.

---

## 0 · Model A/B refresh — first, because it may dominate

Published VLMs reach 23.9–24.5% MAPE where we measure 42.2%. **Different datasets; not directly
comparable, and this document does not claim otherwise.** But the gap is wide enough that a current
frontier model may close more of it than every lever below combined, at the cost of one eval run.

`x-ai/grok-4.5` was chosen by A/B months ago in model time. Re-run the A/B before investing in
pipeline work — if the ranking has moved, the rest of this document gets reprioritised.

## A0 · Fixtures must carry ground-truth item names (prerequisite)

**Found during spec review; it blocks every identification experiment here.**

Every fixture on disk stores totals only:

```json
{"kcal":266,"protein_g":7.5,"carbs_g":56,"fat_g":0.8,"total_grams":174}
```

`Expectation` (`src/eval.ts:17`) has no names field, so "was the product identified correctly?" —
the question retrieve-then-select, A1 and A3 all turn on — **cannot be asked of any fixture today**.

The names are discarded, not absent. `src/eval.ts:31` says so: the CSV *"repeats per-ingredient
fields we ignore"*, and `labelsAgree` (`src/eval.ts:93`) already parses them for the pairing gate
before dropping them.

A0: add an optional `items: string[]` to `Expectation`, keep the names the adapter already reads,
re-run it. No billed calls, no new photos. Optional on the type so the 22 Nutrition5k fixtures stay
valid without regeneration.

### Fixture inventory (verified on disk, 2026-07-27)

| set | count | item names | notes |
|---|---|---|---|
| `data/food-photos/` (Nutrition5k) | 22 | no | gitignored; one row is 4900 kcal / 3500 g — inspect before trusting |
| `eval/nutritionverse/` | 30 | no — **recoverable via A0** | CC BY-NC-SA, gitignored |
| `eval/weighed/` | **0 — does not exist** | — | protocol written in `docs/ACCURACY_EVAL.md`; no meal recorded yet |

52 fixtures, none naming its ingredients, **zero weighed home meals**. That last row is the real
limit: the whole set is Western restaurant and cafeteria food, none of it the Russian/German home
cooking the bot is actually used on. 52 dishes is also thin for fitting anything (see C).

## A1 · Personal repertoire prior

`recentItems(db, user_id)` reads `items` + `corrected` for the last 90 days. A pure
`buildRepertoire()` counts names, **weights `corrected = 1` higher** — a name the principal fixed by
hand outranks one the model invented — and returns the top ~15. `buildUserText` injects one hedged
line, worded like the existing cuisine prior: the photo always wins. Empty repertoire emits no line.

Directionally supported: ACETADA found contextual metadata (including a known-food-items list)
improved every model, averaging **−76 kcal** calorie MAE and **−53 g** portion MAE.

**The risk is anchoring, and it is symmetric.** A prior naming *bulgur* helps when bulgur was eaten
and hurts when couscous was — the same failure class as the deleted round-up hedge (`analyzer.ts:166`).
Measured, not assumed; see Measurement.

## A2 · Per-item macros

`items[]` gains `kcal`, `protein_g`, `carbs_g`, `fat_g`, `kcal_per_100g`.

The prompt **already asks for this** (`analyzer.ts:165`) and we discard it. Capturing it makes
per-item substitution expressible, makes the item-sum check possible, and makes an A3 tap cost zero
LLM calls.

`MealAnalysisSchema` is imported by `src/llm/tools/mealActions.ts:31` as the Mastra terminal tool's
`inputSchema`, so this serves **both** architectures from one edit. The old path also hand-maintains
`MEAL_JSON_SCHEMA` (`analyzer.ts:66`), which needs the same fields; that copy dies at cutover.

## A3 · Ask when the choice is genuinely ambiguous — now a fallback

Under retrieve-then-select, call 2 resolves most ambiguity against the table. A3 becomes the
**fallback** for when the constrained choice is still uncertain, or when call 2 answers "none of
these" — not the primary identification fix it was in the first draft.

Gates unchanged, because friction kills a food diary:

- **Materiality** — `|Δ kcal/100g| < 15%` → do not ask.
- **Repertoire first** — if history holds one candidate and not the other, resolve silently.
- **One question per meal, max** — the item with the largest `grams × Δdensity`.
- **Never blocks.** Card ships with the best guess; buttons sit beneath it.

Tap → recompute locally from `kcal_per_100g` → edit the card in place (`setMealReply` stores chat and
message id) → `corrected = 1` → feeds A1.

Callback `amb:<mealId>:<itemIdx>:<altIdx>` ≈ 46 bytes of Telegram's 64, following the existing
`tm:log:<uuid>` precedent. `amb:` is unused (`tm:`, `st:`, `lang_`, `delete_` and bare onboarding
names are taken). Handler scoped `WHERE id = ? AND user_id = ?`. New copy keys in all three locales;
the parity test enforces it.

**Open question for measurement:** a self-consistency **vote margin** may be a better ambiguity
trigger than a self-reported `alt[]`. A model that emits couscous 3× and bulgur 2× is demonstrably
torn; a model asked "are you unsure?" is introspecting, and we already know its `confidence` output
carries no weight. See Measurement.

## B · Consistency gate — promoted to load-bearing

Two checks on the model's own output, immediately after the parse, costing nothing:

- **Atwater** — `4·protein + 4·carbs + 9·fat` vs stated kcal
- **Item sum** — `Σ items` vs totals (available once A2 lands)

Tolerance `max(15 kcal, 25%)`, reusing the rule proven in `src/fixture.test.ts`.

**This is no longer a nice-to-have.** Under retrieve-then-select it is the validation that makes
decomposition safe: FoodCHA's ablation puts a fifth of their benefit on validation alone, and the
decomposition literature names error propagation as the main way staged pipelines fail. Split
without validation and the split is net-negative.

**Ships logging-only first.** The action is not chosen up front: tripping on 30% of meals is a
different product decision than 3%. Measure the fire rate, then choose between forcing
`confidence: "low"` (free; that path already asks for a weight) and a retry (billed, and a
self-contradicting model may contradict itself twice).

### Trap: this must NOT be a zod `.refine()` yet

A `.refine()` on `MealAnalysisSchema` is excellent under Mastra — validation fails, Mastra returns an
error-shaped tool result, it is fed back, the model repairs its own arithmetic (see `src/CLAUDE.md`).

On the **current production path** the identical line does the opposite: `safeParse` throws per
`analyzer.ts`'s fail-loud contract, producing `errors.analyzeFailed` and **no stored meal**. Same one
line: self-repair on one path, silent data loss on the other. B stays a post-parse check until the
cutover.

## C · Grams calibration — possibly novel, and the only lever aimed at bias

Calibrate **grams, not kcal**. `kcal = grams × density`; D replaces density, so calibrating kcal
would double-count. Grams is also the larger half (0.67 vs 0.81).

No paper or product found in this research calibrates the systematic slope post hoc — the field
measures bias and does not correct it. That makes C the one lever here that is not table stakes.

It is also the one aimed at complaint #1. **Self-consistency cannot substitute**: a median of a
biased estimator is still biased. Aggregation reduces variance; only calibration moves bias.

Two parameters fitted in log space on ~52 dishes is thin enough that overfitting is the default
outcome, not a risk. k-fold cross-validation, report the held-out gain with a CI, and **ship only if
it survives out of fold.** If it does not, C stops there, and that is a result worth having.

## D · The food table as vocabulary, not as post-hoc substitution

Superseded by retrieve-then-select above. D is no longer a final substitution step; it is the
candidate source for call 2, delivered as the Mastra `search_food_db` tool, with a mandatory "none
of these" escape.

### Two hazards, both found by reading the built table

- **Sources disagree.** `cofid:11-902` (Couscous, plain, cooked) is **178** kcal/100 g;
  `usda:169700` (Couscous, cooked) is **112**. A 59% spread on the same food, most likely different
  water-absorption assumptions. Grounding introduces its own error; it does not merely remove ours.
  Retrieval must not offer both as if interchangeable.
- **Raw and cooked are different foods.** CoFID has `11-904 Wheat, bulgur, raw` (352) and **no**
  cooked bulgur. Settling for the raw row is wrong by **4.2×** — larger than the error the lookup
  exists to remove. A raw/cooked mismatch is a **non-match**, never a near-match.

## New levers from the research

- **Venue context (home / restaurant / canteen).** ACETADA: *"every 'best metadata' combination
  contained either gps or timestamp"* — location was among the two most valuable signals, averaging
  −76 kcal MAE. We have `country` (static, coarse) and **nothing** about venue, though restaurant
  portions are systematically larger and oilier. Cheap: infer from the photo, or one `/settings`
  default plus a per-meal override.
- **Self-consistency (N samples, aggregate).** Self-ensembling VLMs on numeric extraction report up
  to **23% relative** gain by taking per-field medians, with convergence-based early stopping to cap
  cost. Note the tension: that is **per-field** medians, which `src/eval.ts:194` deliberately refuses
  (median kcal and median grams from different runs yield a density no run produced). Production
  aggregation faces the same trap and must aggregate whole runs, or accept synthetic densities
  knowingly.
  Weak counter-evidence: on a nutrition **knowledge exam**, CoT+self-consistency beat plain CoT by
  only +0.16pp. Different task shape; the numeric-extraction analogy is the applicable one.
- **Few-shot exemplars.** Untested here, weakest of ACETADA's five modifiers (−21.31 kcal), cheap to
  try once A0 gives us named fixtures to build exemplars from.

Not adopted: the Nutrients 2026 finding that an explicit *"do not read text or numbers in the image"*
instruction helped substantially. It **conflicts with our multi-photo hint**, which deliberately
treats packaging labels as ground truth. Reading a real label is good; hallucinating from partial
text is not. Worth an experiment, not a blind adoption.

---

## What survives the Mastra cutover

| Survives | Dies with the cutover |
|---|---|
| `buildRepertoire()` — pure, `src/` | `MEAL_JSON_SCHEMA` field additions |
| `atwater()` / item-sum — pure, `src/` | `buildUserText` prompt lines (become agent instructions) |
| `calibrateGrams()` — pure, `src/` | |
| `MealAnalysisSchema` changes — already shared | |
| `amb:` callback + card buttons — Telegram layer, untouched by #36 | |

## Measurement

Every item is checked against fixtures, not argued for. **A0 lands first**, or the identification
experiments cannot run at all.

**Retrieve-then-select is gated by the two-call experiment:** one-call baseline vs
`call 1 → food_db.find() → call 2 (select from K)`, scoring **identification separately from grams**,
plus latency and cost. FoodCHA's +38% subcategory precision is the hypothesis; our fixtures decide.

**A3's trigger is a head-to-head:** self-reported `alt[]` vs self-consistency vote margin, judged on
which better predicts an actual identification error. If vote margin wins, `alt[]` may not be needed
in the schema at all.

**A1 cannot be measured directly** — no fixture carries per-user history. Measure the mechanism
leave-one-out, in two directions:

- *helpful* — build each fixture's repertoire from other fixtures' true names; does identification
  improve?
- *adversarial* — seed the repertoire with the confusable-but-wrong name; **how much damage does a
  wrong prior do?**

The adversarial number decides whether A1 ships. A prior that overrides a correct photo reading is a
regression however well the helpful case scores.

**B** reports a fire rate before it gets an action. **C** reports an out-of-fold gain with a CI and
ships only if that survives. **D**, as retrieval, is judged on match rate and on identification
accuracy — a MAPE gain at a 20% match rate has tested nothing.

## Sequence

```
 0   model A/B refresh          may dominate; one eval run
 A0  fixture item names         unblocks every identification experiment
 A2  per-item macros            shared schema; needed by B and by call 2
 D'  retrieve-then-select       the architecture decision, gated by its experiment
 B   consistency gate           load-bearing once D' lands — validation between steps
 A1  repertoire prior           gated by the adversarial experiment
 A3  ask, as fallback           gated by the trigger head-to-head
 C   grams calibration          the only bias lever; gated by out-of-fold CV
 +   venue context · self-consistency · few-shot exemplars
```

B moves ahead of A1/A3 because it is the safety net for D', not a polish step.

## Open items

- **B's action on mismatch** — deliberately unresolved; the measured fire rate decides it.
- **Verdicts go stale under substitution.** Verdicts are model-authored from the model's own macros
  (`analyzer.ts:204,207`). Replacing satfat invalidates them: a reassuring `ldl: "good"` attached to
  numbers that no longer exist, on a card a user with a declared restriction may act on.
  Recommendation: recompute from the caps `targetsFor` already produces — deterministic, auditable,
  and it stops the model judging at all. Product decision; settle it **before** D' ships.
- **`confidence` has never been checked for correlation with error.** If it does not predict, it is
  decoration, and a poor foundation for any gate. Cheap to measure; worth knowing before B's action
  is chosen, since forcing `confidence: "low"` assumes the field means something.
- **Latency budget.** Two calls ≈ 20 s to a card. Acceptable behind the 👀 reaction, but it should be
  measured on real traffic, not assumed.

## Sources

Published figures above come from: Coburn et al., *Evaluating Large Multimodal Models for Nutrition
Analysis* (ACETADA), arXiv 2507.07048 · *FoodCHA: Multi-Modal LLM Agent for Fine-Grained Food
Analysis*, arXiv 2605.05499 · Vinod & Zhu, *Food Portion Estimation: From Pixels to Calories*,
arXiv 2602.05078 · Thames et al., *Nutrition5k*, arXiv 2103.03375 · *Prompt Engineering and Model
Selection for LLM-Based Nutritional Estimation from Food Images*, Nutrients 2026,
doi:10.3390/nu18122017 · *Self-Ensembling Vision-Language Models for Chart Data Extraction*,
arXiv 2605.27298 · *Evaluation of LLMs accuracy and consistency in the registered dietitian exam*,
Sci Rep 2025 · SnapCalorie and Cal AI vendor-published accuracy pages.

None of these measured eait. Every number attributed to us in this document came from our own eval.
