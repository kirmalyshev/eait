// Accuracy-eval core (issue #6): fixture pairing, error metrics, and report rendering for the
// weighed-meal eval. Pure logic only — file I/O and the billed LLM calls live in the manual
// runner `scripts/eval-meals.ts`. Not imported by the bot runtime.

import { z } from "zod";

/** Ground truth for one meal photo, from `<name>.json` next to `<name>.jpg`. */
export const ExpectationSchema = z.object({
  // Positive on purpose: a zero/negative kcal expectation is always a typo and would break MAPE.
  kcal: z.number().positive(),
  protein_g: z.number().nonnegative().optional(),
  carbs_g: z.number().nonnegative().optional(),
  fat_g: z.number().nonnegative().optional(),
  /** Kitchen-scale weight of the whole serving; compared against the sum of items[].grams. */
  total_grams: z.number().positive().optional(),
});
export type Expectation = z.infer<typeof ExpectationSchema>;

/** The numbers one analyzer run yields for one case (a MealAnalysis, flattened). */
export interface EvalRun {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  /** Sum of items[].grams for this run. */
  grams_total: number;
}

export interface EvalCaseFiles {
  name: string;
  image: string;
  expectation: string;
}

const IMAGE_EXT = /\.(jpe?g|png|webp)$/i;

/**
 * Pair image files with their same-stem `.json` expectation. Orphans (an image without ground
 * truth, or ground truth without an image) are returned, not dropped silently — a fixture that
 * quietly doesn't run reads as "covered" when it isn't.
 */
export function pairFixtures(files: string[]): { cases: EvalCaseFiles[]; orphans: string[] } {
  const images = new Map<string, string>();
  const jsons = new Map<string, string>();
  for (const f of files) {
    if (IMAGE_EXT.test(f)) images.set(f.replace(IMAGE_EXT, ""), f);
    else if (f.toLowerCase().endsWith(".json")) jsons.set(f.slice(0, -".json".length), f);
    // anything else (.DS_Store, notes) is not fixture material
  }
  const cases: EvalCaseFiles[] = [];
  const orphans: string[] = [];
  for (const [stem, image] of [...images.entries()].sort()) {
    const expectation = jsons.get(stem);
    if (expectation) {
      cases.push({ name: stem, image, expectation });
      jsons.delete(stem);
    } else {
      orphans.push(image);
    }
  }
  orphans.push(...jsons.values());
  return { cases, orphans };
}

export function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

const mean = (nums: number[]): number => nums.reduce((a, b) => a + b, 0) / nums.length;

export interface CaseInput {
  expected: Expectation;
  /** ≥1 runs of the same photo; the median is the point estimate, max−min the spread. */
  runs: EvalRun[];
}

export interface Summary {
  cases: number;
  kcal: { mae: number; mape: number; spread: number };
  protein_g?: { mae: number; cases: number };
  carbs_g?: { mae: number; cases: number };
  fat_g?: { mae: number; cases: number };
  grams?: { mape: number; cases: number };
}

/**
 * Aggregate error metrics over all cases. Per case the point estimate is the MEDIAN across
 * runs (robust to one wild sample); macro metrics only cover cases that declare that macro.
 */
export function summarize(cases: CaseInput[]): Summary {
  if (cases.length === 0) throw new Error("summarize: no cases — nothing to evaluate");

  const kcalErrs: number[] = [];
  const kcalPctErrs: number[] = [];
  const kcalSpreads: number[] = [];
  const macroErrs: Record<"protein_g" | "carbs_g" | "fat_g", number[]> = {
    protein_g: [], carbs_g: [], fat_g: [],
  };
  const gramsPctErrs: number[] = [];

  for (const c of cases) {
    const kcals = c.runs.map((r) => r.kcal);
    const est = median(kcals);
    kcalErrs.push(Math.abs(est - c.expected.kcal));
    kcalPctErrs.push((Math.abs(est - c.expected.kcal) / c.expected.kcal) * 100);
    kcalSpreads.push(Math.max(...kcals) - Math.min(...kcals));

    for (const key of ["protein_g", "carbs_g", "fat_g"] as const) {
      const want = c.expected[key];
      if (want === undefined) continue;
      macroErrs[key].push(Math.abs(median(c.runs.map((r) => r[key])) - want));
    }
    if (c.expected.total_grams !== undefined) {
      const est_g = median(c.runs.map((r) => r.grams_total));
      gramsPctErrs.push((Math.abs(est_g - c.expected.total_grams) / c.expected.total_grams) * 100);
    }
  }

  const summary: Summary = {
    cases: cases.length,
    kcal: { mae: mean(kcalErrs), mape: mean(kcalPctErrs), spread: mean(kcalSpreads) },
  };
  for (const key of ["protein_g", "carbs_g", "fat_g"] as const) {
    if (macroErrs[key].length) summary[key] = { mae: mean(macroErrs[key]), cases: macroErrs[key].length };
  }
  if (gramsPctErrs.length) summary.grams = { mape: mean(gramsPctErrs), cases: gramsPctErrs.length };
  return summary;
}

const fmt = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** One model's summary as a compact plain-text block (the runner prints one per model). */
export function renderReport(model: string, s: Summary): string {
  const lines = [
    `model: ${model} (${s.cases} case${s.cases === 1 ? "" : "s"})`,
    `  kcal    MAE ${fmt(s.kcal.mae)} · MAPE ${fmt(s.kcal.mape)}% · run spread ${fmt(s.kcal.spread)}`,
  ];
  if (s.protein_g) lines.push(`  protein MAE ${fmt(s.protein_g.mae)} g (${s.protein_g.cases} cases)`);
  if (s.carbs_g) lines.push(`  carbs   MAE ${fmt(s.carbs_g.mae)} g (${s.carbs_g.cases} cases)`);
  if (s.fat_g) lines.push(`  fat     MAE ${fmt(s.fat_g.mae)} g (${s.fat_g.cases} cases)`);
  if (s.grams) lines.push(`  portion MAPE ${fmt(s.grams.mape)}% (${s.grams.cases} cases)`);
  return lines.join("\n");
}
