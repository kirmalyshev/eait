// Retrieve-then-select: ground each item on a composition-table row instead of trusting the
// model's own arithmetic (design: docs/design/2026-07-27-analysis-quality.md, D').
//
// WHY THIS SHAPE, RATHER THAN LOOKING THE ANSWER UP AFTERWARDS. The obvious design is to take the
// model's name, find the best row, and replace the macros. That amplifies a misidentification
// instead of fixing it: look up "couscous" and you get precise, authoritative couscous numbers for
// a bowl of bulgur — 112 kcal/100 g against 83, and 1.4 g of fibre against 4.5. Today a wrong
// label produces a fuzzy wrong number; grounding it produces a sharp wrong number that everything
// downstream treats as fact.
//
// So the table is consulted BEFORE the answer is fixed, not after. The matcher narrows 10,780 rows
// to a handful, and the model chooses among them with the photo still in hand — which is the step
// string overlap cannot do, since bulgur and couscous are distinguished by looking, not by tokens.
//
// Measured support: across five runs of one photo the model produced six different names for a
// single food (labneh, herbed labneh, herbed strained yogurt, "dip herbed yogurt", ...), and 70% of
// foods were named inconsistently between runs. Almost none of that was uncertainty about the food
// — it was the absence of a controlled vocabulary. Selecting from rows collapses all six onto one.
//
// The "none of these" answer is mandatory and is the load-bearing part. Forcing a choice among
// wrong rows is worse than keeping the model's guess, because a chosen row carries a `food_id` and
// reads as verified downstream.

import type { FoodRow, FoodIndex } from "./food_db.ts";
import type { MealAnalysis, MealItem } from "./types.ts";

/** One item's shortlist, ready to be offered to the model. */
export interface CandidateSet {
  /** Index into `analysis.items` — the only link back, so it must survive the round trip. */
  itemIndex: number;
  /** What the model called it, in English; the query the shortlist came from. */
  query: string;
  candidates: FoodRow[];
}

/**
 * Build the shortlists. Pure: no LLM, no I/O.
 *
 * Items with no candidates are omitted entirely rather than sent with an empty list. An item the
 * table has never heard of is not a question worth asking — there is nothing to choose from, and
 * the honest outcome is to keep the model's own numbers.
 */
export function buildCandidateSets(
  analysis: MealAnalysis,
  index: FoodIndex,
  k = 10,
): CandidateSet[] {
  const sets: CandidateSet[] = [];
  analysis.items.forEach((item, itemIndex) => {
    // `name_en` is the lookup key; `name` is in the user's language and cannot be matched against
    // an English table. No English name means no lookup, not a fallback to the display name.
    const query = item.name_en?.trim();
    if (!query) return;
    // Union over the model's own name AND its alternatives. Retrieval is driven by the name the
    // model produced, so on its own it can never offer the row for a food the model failed to
    // recognise — "couscous" returns couscous rows, and the bulgur row is never in the running.
    // The alternatives are what put the right answer on the shortlist at all.
    const seen = new Set<string>();
    const candidates: FoodRow[] = [];
    for (const q of [query, ...(item.alt_en ?? [])]) {
      const trimmed = q.trim();
      if (!trimmed) continue;
      for (const row of index.candidates(trimmed, k)) {
        if (seen.has(row.id)) continue;
        seen.add(row.id);
        candidates.push(row);
      }
    }
    if (candidates.length === 0) return;
    sets.push({ itemIndex, query, candidates });
  });
  return sets;
}

/** The model's answer for one item: a chosen row id, or null for "none of these". */
export interface Selection {
  itemIndex: number;
  /** `FoodRow.id`, or null when no offered row is the food in the photo. */
  foodId: string | null;
}

/** Per-100 g row scaled to a portion. */
function scale(row: FoodRow, grams: number) {
  const f = grams / 100;
  return {
    kcal: row.kcal * f,
    protein_g: row.protein_g * f,
    carbs_g: row.carbs_g * f,
    fat_g: row.fat_g * f,
    satfat_g: row.satfat_g === undefined ? undefined : row.satfat_g * f,
    fiber_g: row.fiber_g === undefined ? undefined : row.fiber_g * f,
    sugar_g: row.sugar_g === undefined ? undefined : row.sugar_g * f,
    sodium_mg: row.sodium_mg === undefined ? undefined : row.sodium_mg * f,
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export interface Resolution {
  analysis: MealAnalysis;
  /** How many items ended up grounded on a table row — the match rate, per meal. */
  grounded: number;
}

/**
 * Apply the model's selections: substitute each grounded item's macros and record which row did it.
 *
 * Two rules decide what the meal totals become, and they differ on purpose.
 *
 * kcal, protein, carbs and fat are re-summed from the items ALWAYS, because every item carries
 * them — either from its chosen row or from the model's own per-item figures. The sum is then
 * exactly as good as its parts, which is the honest answer.
 *
 * Saturated fat, fibre, sugar and sodium are re-summed ONLY when every single item was grounded on
 * a row that publishes that nutrient. They are not captured per item, so a partial sum would silently
 * omit whatever the unresolved items contribute and report a LOWER number with full confidence —
 * and sodium and saturated fat are precisely the two that drive the medical verdicts. Understating
 * them is the one failure here that could reach a user who declared a restriction and acted on it.
 * When the condition does not hold, the model's meal-level figure is kept untouched.
 */
export function applySelections(
  analysis: MealAnalysis,
  sets: readonly CandidateSet[],
  selections: readonly Selection[],
): Resolution {
  const chosen = new Map<number, FoodRow>();
  for (const sel of selections) {
    if (!sel.foodId) continue;
    const set = sets.find((s) => s.itemIndex === sel.itemIndex);
    // A row the model was never offered is not a selection, it is a hallucinated id. Ignoring it
    // keeps the model's own numbers, which is the same outcome as "none of these".
    const row = set?.candidates.find((c) => c.id === sel.foodId);
    if (row) chosen.set(sel.itemIndex, row);
  }

  const micros = ["satfat_g", "fiber_g", "sugar_g", "sodium_mg"] as const;
  const microSums: Record<(typeof micros)[number], number | undefined> = {
    satfat_g: 0, fiber_g: 0, sugar_g: 0, sodium_mg: 0,
  };

  const items: MealItem[] = analysis.items.map((item, i) => {
    const row = chosen.get(i);
    if (!row) {
      // Undefined is sticky: one ungrounded item makes every micro total unknowable, because its
      // contribution is not recorded anywhere.
      for (const m of micros) microSums[m] = undefined;
      return item;
    }
    const s = scale(row, item.grams);
    for (const m of micros) {
      if (s[m] === undefined) microSums[m] = undefined;
      else if (microSums[m] !== undefined) microSums[m]! += s[m]!;
    }
    return {
      ...item,
      kcal: round1(s.kcal),
      protein_g: round1(s.protein_g),
      carbs_g: round1(s.carbs_g),
      fat_g: round1(s.fat_g),
      kcal_per_100g: row.kcal,
      food_id: row.id,
    };
  });

  // Sum what every item can supply: a grounded item's substituted figure, or the model's own.
  // An item with neither contributes nothing rather than a zero — absent is not the same as none.
  const sum = (key: "kcal" | "protein_g" | "carbs_g" | "fat_g") =>
    round1(items.reduce((acc, it) => acc + (it[key] ?? 0), 0));
  // Nothing grounded means this step changed nothing, so it must not quietly change the totals
  // either. Re-summing here would enforce items-against-totals agreement — which is exactly the
  // check that ships OBSERVE-ONLY until its fire rate is known. Doing it as a side effect of
  // grounding would smuggle that decision in unmeasured.
  const everyItemHasMacros = chosen.size > 0 && items.every((it) => it.kcal !== undefined);

  return {
    grounded: chosen.size,
    analysis: {
      ...analysis,
      items,
      // Only when the parts actually cover the whole. Otherwise the model's totals stand: they are
      // a guess, but a complete one, and a complete guess beats a partial sum presented as fact.
      ...(everyItemHasMacros
        ? {
            kcal: sum("kcal"),
            protein_g: sum("protein_g"),
            carbs_g: sum("carbs_g"),
            fat_g: sum("fat_g"),
          }
        : {}),
      ...Object.fromEntries(
        micros.flatMap((m) => (microSums[m] === undefined ? [] : [[m, round1(microSums[m]!)]])),
      ),
    },
  };
}
