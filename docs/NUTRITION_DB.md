# Nutrition database layer — research and integration design

Groundwork for #8. Written after the range-compression measurement, which changes what this layer
is worth and why.

## What the measurement says this can and cannot fix

`kcal = grams × density`. Over 60 evaluated dishes (30 Nutrition5k + 30 NutritionVerse-Real,
grok-4.5, single run each), regressing the model's estimate against truth in log space:

| component | slope | r | who supplies it |
|---|---|---|---|
| kcal | **0.47** | 0.72 | derived |
| grams | 0.67 | 0.78 | **the model** — a database cannot fix this |
| density (kcal/g) | 0.81 | 0.89 | **the model's arithmetic** — a database replaces this |

Slope 1.0 would mean "twice the food, twice the estimate". At 0.47 the model compresses everything
toward roughly 500 kcal: **+35% on dishes under 300 kcal, −57% on dishes over 1000**. Signed bias
pooled across both datasets is +0.9% for grams and −2.6% for density — near zero. So the defect is
not direction, it is *range*.

**What a database buys:** density is the model doing arithmetic it is bad at. A correct lookup
replaces both its scatter (14.6–20.6% MAPE) and its 0.81 slope with the table's own accuracy, which
for staples is a few percent. That lifts the kcal slope from 0.47 to roughly the grams slope, 0.67.

**What it does not buy:** grams. The model still decides how much food is on the plate, and that is
the larger half of the error. This layer must be paired with portion work (#31, #12), not treated
as the fix.

An earlier note on #8 said density's near-zero bias weakened the case for this work. That judged
bias alone and ignored scatter and slope, both of which a lookup removes. The case is stronger than
that note claimed.

## The two-layer split

A meal photo contains two different lookup problems, and conflating them is the usual failure:

- **Packaged / branded** — a specific yoghurt, a protein bar, a jar of sauce. The package label is
  better ground truth than any generic table. → Open Food Facts.
- **Generic / raw / cooked** — "boiled potato", "fried chicken thigh", "buckwheat". No barcode
  exists. → national food composition tables.

Meal photos are overwhelmingly the second kind, so the national tables matter more, but the first
is where per-product precision is available for free.

## Databases by region — verified reachable, July 2026

Probed with actual requests, not taken from documentation.

### Global, packaged

| Source | Size | Access | Licence |
|---|---|---|---|
| [Open Food Facts](https://world.openfoodfacts.org/data) | 3.5M+ products | REST, **no key, no rate limit** for reasonable use; full bulk dumps (JSONL/CSV/MongoDB) | **ODbL** — attribution **and share-alike** |

Verified: `GET /api/v2/product/3017620422003.json` → Nutella, 539 kcal, 6.3 P / 57.5 C / 30.9 F per
100 g. Note the search endpoint returned 503 under load; the by-barcode endpoint was stable. Plan
for the bulk dump rather than live search.

ODbL's share-alike applies to a *derived database*. Using it to compute a user's meal is fine;
shipping a modified copy of it obliges you to publish that copy under ODbL too.

### United States

| Source | Size | Access | Licence |
|---|---|---|---|
| [USDA FoodData Central](https://fdc.nal.usda.gov/) | SR Legacy ~7.8k, Foundation, Branded ~1.9M | REST API (free key; `DEMO_KEY` works for trials), bulk CSV | **Public domain** |

Verified: `foods/search?query=buckwheat groats cooked&dataType=SR Legacy` → "Buckwheat groats,
roasted, cooked", 92 kcal / 3.38 P / 19.9 C / 0.62 F — identical to the value already in our
`FOOD_TABLE`. Best-documented API of the set, public domain, and the reference every other table is
compared against. **Start here.**

### European Union

No single EU-wide table. [EuroFIR](https://www.eurofir.org/food-information/food-composition-databases/)
is the directory; national tables are the real sources.

| Country | Source | Size | Access | Licence |
|---|---|---|---|---|
| **Germany** | **BLS 4.0** (Max Rubner-Institut) | **7,140 foods incl. prepared dishes**, 138 nutrients | [blsdb.de](https://www.blsdb.de/) — **licence fees waived, free to all** | free; redistribution terms not stated on the site |
| France | CIQUAL (ANSES) | 3,185 foods / 67 components | XML/XLS download | open (Etalab) |
| Finland | Fineli (THL) | 4,156 foods / 55 nutrients | open-data download | CC BY |
| Denmark | Frida (DTU) | 1,170 foods / 105 nutrients | download | open |
| Netherlands | NEVO (RIVM) | 2,152 foods / 133 nutrients | download, registration | restricted |
| Sweden | Livsmedelsverket | ~2k | REST API (`dataportal.livsmedelsverket.se`) | open |

**BLS 4.0 is the standout for this project.** It is the German national database, it was
licence-fee-only until recently, and it uniquely includes *prepared dishes* rather than only
ingredients — which is what a meal photo actually shows. For a Berlin-based user logging German
food, it beats USDA on relevance.

### Russia

**This is the gap.** No official open, machine-readable database exists.

- The reference work is Skurikhin & Volgarev, *Химический состав пищевых продуктов* — the Russian
  Institute of Nutrition tables, ~1,618 items / 20 nutrients, published 1994 in print.
- Consumer sites (Calorizator, health-diet.ru) publish Skurikhin-derived values and are what
  Russian-speaking apps actually use, but they are unofficial, have **no stated reuse licence**, and
  would have to be scraped.

Practical options, in order: (1) accept USDA/BLS for Russian dishes, which covers ingredients well
and prepared dishes poorly; (2) hand-curate a small Russian-dish table the way `src/fixture.ts`
already does for the eval, sourced and reviewed; (3) treat Russian prepared dishes as the
package-label case and let users correct them, feeding #12.

### Latin America

[LATINFOODS](https://www.fao.org/infoods/infoods/regional-data-centres/latinfoods/en/) is the FAO
regional network covering Argentina, Brazil, Chile, Colombia, Mexico, Peru and others. Brazil's
TACO and Mexico's tables are the largest national members. Format is predominantly **PDF and XLS,
not APIs** — usable, but each needs its own one-off parser and manual review.

### South-East Asia

[ASEANFOODS](https://www.fao.org/infoods/infoods/regional-data-centres/en/) covers Indonesia,
Malaysia, the Philippines, Singapore, Thailand, Vietnam and others. National sources include the
Philippine FNRI table and Thailand's INMU. Same shape as Latin America: **published tables, not
APIs**.

For both regions, [FAO/INFOODS](https://www.fao.org/infoods/infoods/tables-and-databases/en/) is the
umbrella directory and the right starting point when a user base actually appears there. Neither is
worth building for now — no users.

## Integration design

### Where it sits

`src/analyzer.ts` keeps the prompt and the zod parse (root `AGENTS.md` invariant). The database is a
**new focused module under `src/`**, called by the analyzer after the parse and before `gated()`.
`src/llm/` stays transport-only. Nothing about images-are-ephemeral or per-user scoping changes.

### The flow

Today the model returns `items[{name, grams}]` **and** all the macros. The change is to stop
trusting the second half:

1. Model returns `items[{name, grams}]` as now.
2. For each item, resolve `name` → a composition row.
3. Macros = `Σ grams × per100 / 100` — deterministic arithmetic, not the model's.
4. **No confident match → keep the model's macros for that item and mark it.** Silent substitution
   of a wrong row is worse than the model's guess, because it looks authoritative.

### The hard part is name matching, not the database

Free-text multilingual food names → table rows. This is where the project succeeds or fails, and
the database choice is secondary to it. Options, cheapest first:

1. **Ask the model for a canonical key.** It is already naming the food; adding one schema field —
   an English, singular, cooking-state-qualified name (`"chicken thigh, roasted, skinless"`) beside
   the localized display name — costs almost nothing and turns a multilingual matching problem into
   a monolingual one. This is the highest-leverage move and should come first.
2. **Token/fuzzy match** over normalized names, exactly as `labelsAgree` and `FOOD_TABLE`'s
   `normalize` already do in this repo. Handles the easy majority.
3. **Embedding similarity** for the tail, if 1+2 leave too many misses. Local model, no API.

Cache resolved matches by canonical key — the same twenty foods recur constantly for one user.

### Cooking state is the trap

`src/fixture.ts` already carries the scar: 100 g of dry rice and 100 g of cooked rice differ ~3x,
and the food table encodes preparation in the name for exactly that reason. A lookup layer that
matches "rice" to a dry-rice row will produce a confident, precise, 3x-wrong number — worse than
the model's fuzzy guess, because nothing downstream will question it. Whatever matching is built
must treat cooking state as part of the key, not a modifier to be dropped.

### How to know if it worked

The eval already decomposes error into grams and density (`summarize` in `src/eval.ts`), so this is
directly measurable rather than a matter of opinion. Run the 60-case set before and after; the
success criterion is the **density row**, not the headline:

- `density MAPE` 14.6–20.6% → low single digits for matched items
- density slope 0.81 → ~1.0
- kcal slope 0.47 → ~0.67
- grams unchanged — if it moves, something is wrong

Report match rate alongside, since a layer that silently falls back on 80% of items has not been
tested by a small MAPE improvement.

## Recommendation

1. **USDA FDC first** — public domain, real API, best documentation, and it is the reference the
   others are validated against. Enough to prove the pipeline.
2. **BLS 4.0 next** — newly free, German, and the only one of these that covers *prepared dishes*.
   For this user base it is the highest-relevance source available.
3. **Open Food Facts for packaged items**, via bulk dump rather than live search. Mind ODbL
   share-alike if a derived table is ever published.
4. **Russia: no open source exists.** Decide deliberately between hand-curation and accepting
   USDA/BLS coverage. Do not scrape unlicensed consumer sites into a shipped product.
5. **Latin America and SE Asia: not now.** PDF-era tables, no users, and the work does not
   generalize from the EU/US integration.

And keep the framing honest: this layer addresses the third of the error that lives in density. The
larger half is grams, and no database estimates portion.
