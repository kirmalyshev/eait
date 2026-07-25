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

/** One decimal place (12.4), collapsing a trailing `.0` so whole numbers stay integers (193). */
const round1 = (n: number): number => Math.round(n * 10) / 10;

/**
 * Map one raw `dish_metadata_cafe*.csv` line (Nutrition5k) to a fixture Expectation — the
 * zero-effort accuracy baseline for the model A/B (#7), pending real weighed home meals (#6).
 * The first six comma fields are dish-level (dish_id, total_calories, total_mass, total_fat,
 * total_carb, total_protein); the real CSV then repeats per-ingredient fields we ignore (it has
 * NO num_ingrs column — ingredients start at field 7). kcal rounds to an integer, macros/grams to
 * one decimal, then ExpectationSchema validates — so a short or non-numeric line throws instead
 * of writing NaN ground truth that would silently poison the MAE/MAPE.
 */
export function nutrition5kRowToExpectation(
  row: string,
): { dishId: string; expectation: Expectation } {
  const f = row.split(",");
  if (f.length < 6) {
    throw new Error(`nutrition5k row has ${f.length} fields, need >= 6 dish-level`);
  }
  const [dishId, kcal, mass, fat, carb, protein] = f;
  const expectation = ExpectationSchema.parse({
    kcal: Math.round(Number(kcal)),
    total_grams: round1(Number(mass)),
    fat_g: round1(Number(fat)),
    carbs_g: round1(Number(carb)),
    protein_g: round1(Number(protein)),
  });
  return { dishId: dishId!, expectation };
}

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
  /**
   * Grams-vs-density attribution of the kcal error (only cases declaring total_grams, with a
   * non-zero model gram estimate). Since kcal = grams × density, in log space
   * ln(kcal_est/kcal_true) = ln(grams_est/grams_true) + ln(density_est/density_true) exactly, so
   * each meal's kcal error splits cleanly into a portion component and a richness component.
   * This is the number that decides #11 (portion technique — fixes grams) vs #8 (nutrition-DB
   * grounding — fixes density given correct grams): whichever component dominates is the lever.
   */
  decomp?: {
    cases: number;
    /** Mean |density_est − density_true| / density_true × 100, density = kcal/gram. */
    densityMape: number;
    /** Mean |ln(grams_est / grams_true)| — the portion component of the kcal log-error. */
    gramsLogMae: number;
    /** Mean |ln(density_est / density_true)| — the richness component of the kcal log-error. */
    densityLogMae: number;
    /** % of cases where the grams component is the larger driver of the kcal error. */
    gramsDominatedPct: number;
  };
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
  const densityPctErrs: number[] = [];
  const gramsLogs: number[] = [];
  const densityLogs: number[] = [];
  let gramsDominated = 0;

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
      // Density = kcal/gram. Needs a positive gram estimate; a zero-gram run (empty model output)
      // has no defined density, so it's excluded from the decomposition rather than divided by zero.
      if (est_g > 0) {
        const dTrue = c.expected.kcal / c.expected.total_grams;
        const dEst = est / est_g;
        densityPctErrs.push((Math.abs(dEst - dTrue) / dTrue) * 100);
        const gLog = Math.abs(Math.log(est_g / c.expected.total_grams));
        const dLog = Math.abs(Math.log(dEst / dTrue));
        gramsLogs.push(gLog);
        densityLogs.push(dLog);
        if (gLog >= dLog) gramsDominated++;
      }
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
  if (densityPctErrs.length) {
    summary.decomp = {
      cases: densityPctErrs.length,
      densityMape: mean(densityPctErrs),
      gramsLogMae: mean(gramsLogs),
      densityLogMae: mean(densityLogs),
      gramsDominatedPct: (gramsDominated / densityPctErrs.length) * 100,
    };
  }
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
  if (s.decomp) {
    const d = s.decomp;
    lines.push(`  density MAPE ${fmt(d.densityMape)}% (${d.cases} cases)`);
    lines.push(
      `  kcal error source: grams |ln| ${fmt(d.gramsLogMae)} vs density |ln| ${fmt(d.densityLogMae)}` +
        ` — ${fmt(d.gramsDominatedPct)}% grams-dominated`,
    );
  }
  return lines.join("\n");
}
