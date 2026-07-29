// Internal-consistency checks on one analysis (design: docs/design/2026-07-27-analysis-quality.md,
// lever B). Pure — no I/O, no LLM, no db. The model is asked for numbers that must agree with each
// other, and nothing checked whether they do: a meal claiming 600 kcal beside macros worth 330 was
// stored and rendered untouched. That is the "protein/fat sometimes wrong" complaint, and it is
// detectable for free from output we already have.
//
// PHASE 1 IS OBSERVE-ONLY, ON PURPOSE. What to DO about a mismatch — force `confidence: "low"`,
// retry the call, or nothing — depends on how often it fires, and firing on 30% of meals is a
// completely different product decision than firing on 3%. So this reports and the caller logs;
// it never edits a number the user sees. Choose the action from the measured rate, not from taste.
//
// This also becomes load-bearing rather than cosmetic once identification is split across two
// calls: staged pipelines fail by propagating an early error, and the published gains from
// splitting come substantially from the validation between the stages, not the split itself.

import type { MealAnalysis, MealItem } from "./types.ts";

/** Atwater factors. Ethanol is 7 but the schema carries no alcohol field, so it cannot apply here. */
const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 } as const;

/**
 * Agreement test for two kcal figures: `max(15 kcal, 25%)`, the same rule the weighed ground-truth
 * table is held to in `fixture.test.ts`.
 *
 * Deliberately blunt. Fibre digests below 4 kcal/g so vegetable-heavy meals always read high, and
 * every number here is rounded. The absolute floor keeps small dishes from tripping on noise; the
 * percentage still catches a transposed digit in a calorie-dense one. This detects blunders, not
 * imprecision — tightening it would produce a stream of findings that mean nothing.
 *
 * The percentage is taken against `stated`, not against the larger of the two, matching the rule in
 * `fixture.test.ts`. That makes the test ASYMMETRIC by design: the reference is the headline number
 * the user actually sees on the card, so the question asked is "how wrong is the number we
 * published", not "how far apart are these two". Scaling to `max(stated, derived)` instead would let
 * a wildly inflated derived figure widen its own tolerance and excuse the very gap being looked for.
 */
export const WITHIN = (stated: number, derived: number): boolean =>
  Math.abs(stated - derived) <= Math.max(15, stated * 0.25);

export type FindingKind = "atwater" | "item_sum";

export interface Finding {
  kind: FindingKind;
  /** What the model claimed. */
  stated: number;
  /** What its own other numbers imply. */
  derived: number;
}

export interface ConsistencyReport {
  findings: Finding[];
}

/** kcal implied by an item's own macros, or undefined when it declares none. */
function itemKcal(item: MealItem): number | undefined {
  return item.kcal;
}

/**
 * Check one analysis against itself. Returns findings; changes nothing.
 *
 * Both checks stay silent rather than guess when the inputs are absent — a check that fires on
 * missing data is a check that gets switched off.
 */
export function checkConsistency(analysis: MealAnalysis): ConsistencyReport {
  const findings: Finding[] = [];

  const atwater =
    analysis.protein_g * KCAL_PER_G.protein +
    analysis.carbs_g * KCAL_PER_G.carbs +
    analysis.fat_g * KCAL_PER_G.fat;
  if (!WITHIN(analysis.kcal, atwater)) {
    findings.push({ kind: "atwater", stated: analysis.kcal, derived: Math.round(atwater) });
  }

  // Only when EVERY item declares its own kcal. A partial list would under-sum and fire on every
  // mixed case, and a pre-A2 meal carries no per-item kcal at all — reading absent as 0 there would
  // report a full-meal discrepancy against the entire back catalogue. Absent means "nothing to say".
  const items = analysis.items;
  const kcals = items.map(itemKcal);
  if (items.length > 0 && kcals.every((k) => k !== undefined)) {
    const sum = kcals.reduce((a, b) => a! + b!, 0)!;
    if (!WITHIN(analysis.kcal, sum)) {
      findings.push({ kind: "item_sum", stated: analysis.kcal, derived: Math.round(sum) });
    }
  }

  return { findings };
}
