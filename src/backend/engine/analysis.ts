// What a model answered, turned into something the engine may store.
//
// One responsibility, and every analyzer output passes through it: the photo path and both text
// paths. What comes out is an `AnalyzedMeal` with no prompt-side fields left on it, and totals that
// describe the items under them.

import type { AnalyzedMeal } from "../llm/port.ts";

/** The four totals that have a per-item counterpart. satfat, fibre, sugar and sodium do not. */
const SUMMED = ["kcal", "protein_g", "carbs_g", "fat_g"] as const;

/**
 * How far a total may sit from the sum of its items before the card says the model disagreed with
 * its own working. The items are the totals either way; this decides only the confidence.
 *
 * A percentage alone flags an olive against a rounding difference; a flat number alone lets a
 * 900 kcal plate drift by a fifth. The floor is what stops a 40 kcal snack being downgraded over
 * 6 kcal nobody got wrong.
 */
const TOLERANCE_SHARE = 0.15;
const TOLERANCE_FLOOR_KCAL = 30;

/** One step down, and no further. `low` is already the loudest thing the card can say. */
const DOWNGRADE: Record<string, string> = { high: "medium", medium: "low", low: "low" };

/**
 * Reconcile an analysis with itself, and take the prompt-side fields off it.
 *
 * THE ITEMS ARE THE WORKING THE MODEL SHOWED. When a total disagrees loudly with them, one of the
 * two is wrong and it is not the list — the rows are what the user reads, what the editor rescales,
 * and what a substitution recomputes from. A card whose rows add up to 700 under a header saying
 * 1100 is the same defect the correction loop exists for, arriving before the user can even see it.
 * The items are the working, so the card's header is their sum. A row edit and the header can
 * therefore never disagree, because there is only ever one number and the rows are it.
 *
 * `scale` and `question` come off here because they belong to the estimate rather than to the meal.
 * `question` is handed back to the caller instead of dropped — that is what Task 3 reads.
 */
export function prepareAnalysis(analysis: AnalyzedMeal): {
  analysis: AnalyzedMeal;
  question: { text: string; options: string[] } | null;
} {
  const { scale: _scale, question, ...meal } = analysis;
  const out = { analysis: meal, question: question ?? null };

  // Nothing to reconcile against. A model that returned totals and no items has failed to itemise,
  // not seen an empty plate, so believing a sum over zero rows would throw the whole meal away.
  if (!meal.isFood || meal.items.length === 0) return out;

  // A MISSING PER-ITEM NUMBER IS NOT A ZERO. The shared `MealItem` keeps all four optional, an edit
  // may store an item carrying only a name and its grams, and `--demo`'s own correction maps over
  // the stored items and hands back whatever they had. Counting one of those as zero reconciles the
  // plate downwards to a number nobody estimated — silently, and always in the direction of
  // under-counting. There is no working to believe, so nothing is reconciled.
  const sums = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
  for (const it of meal.items) {
    for (const k of SUMMED) {
      const v = it[k];
      if (typeof v !== "number") return out;
      sums[k] += v;
    }
  }
  // Every row present and every row zero says nothing either — and it is the loudest version of the
  // same failure, because the tolerance collapses to the floor and the plate's calories are deleted.
  if (sums.kcal <= 0) return out;

  // The totals are the sums, whatever the model wrote over them. The tolerance decides one thing
  // only: whether the gap between the two is worth saying out loud on the card.
  const tolerance = Math.max(TOLERANCE_SHARE * sums.kcal, TOLERANCE_FLOOR_KCAL);
  const disagreed = Math.abs(meal.kcal - sums.kcal) > tolerance;

  return {
    ...out,
    analysis: {
      ...meal, ...sums,
      // It was wrong about the one thing it could have checked itself.
      confidence: disagreed ? DOWNGRADE[meal.confidence] ?? meal.confidence : meal.confidence,
    },
  };
}
