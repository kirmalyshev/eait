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

/**
 * The one run that speaks for a case: the run at the median kcal (the LOWER middle on even
 * counts, so the answer is always a real observation, never the average of two).
 *
 * Every number reported for a case comes from this single run. Ranking each field independently
 * would be wrong, not merely imprecise: with runs kcal=[100,200,300] and grams=[10,1000,100],
 * the median kcal (200) and the median grams (100) come from DIFFERENT runs, and their ratio
 * (2.0 kcal/g) is a density none of the three runs produced — 10.0, 0.2 and 3.0. That synthetic
 * density can score a perfect zero error on a case where every run was badly wrong. The
 * decomposition below needs kcal and grams from the SAME observation for
 * ln(kcal) = ln(grams) + ln(density) to hold of anything that actually happened.
 *
 * Ranking is by kcal because kcal is the headline metric; the median keeps the robustness a mean
 * would lose to one wild sample.
 */
export function representativeRun(runs: EvalRun[]): EvalRun {
  if (runs.length === 0) throw new Error("representativeRun: a case has no runs");
  const sorted = [...runs].sort((a, b) => a.kcal - b.kcal);
  return sorted[Math.floor((sorted.length - 1) / 2)]!;
}

const mean = (nums: number[]): number => nums.reduce((a, b) => a + b, 0) / nums.length;
const sum = (nums: number[]): number => nums.reduce((a, b) => a + b, 0);

export interface CaseInput {
  expected: Expectation;
  /** ≥1 runs of the same photo; `representativeRun` is the point estimate, max−min the spread. */
  runs: EvalRun[];
}

/** A directional metric always travels with the case count it was computed over. */
export interface Bias {
  /** Geometric-mean % deviation: `+28` = estimates average 1.28x the true value. */
  pct: number;
  /** How many cases this covers — NOT necessarily `Summary.cases`. */
  cases: number;
}

/**
 * One estimate paired with its ground truth. A single object, not two parallel arrays: parallel
 * arrays can be pushed to unevenly and then silently misalign, which turns into a plausible wrong
 * bias rather than an error.
 */
interface Ratio {
  est: number;
  truth: number;
}

/**
 * Geometric-mean bias of estimate vs truth, as a percentage: `+28` means the estimate is on
 * average 1.28x the true value. Computed in log space so RECIPROCAL errors cancel exactly
 * (ln2 + ln0.5 = 0 → 0%, where the arithmetic mean of the ratios would claim +25%). Note that
 * symmetric-looking percentages do NOT cancel: +30% and −30% are ratios 1.3 and 0.7, whose
 * geometric mean is −4.6%, not 0.
 *
 * This is the number MAE/MAPE cannot show. A model that is uniformly 30% high and one that
 * scatters ±30% score the same absolute error, but the first is a one-line prompt fix and the
 * second is a hard modelling problem. Pairs without a defined log ratio (either side non-positive)
 * are excluded — hence `cases`, and hence `undefined` (never 0) when nothing qualified: "no data"
 * must not read as "unbiased".
 */
function geoMeanBias(ratios: Ratio[]): Bias | undefined {
  const logs = ratios
    .filter((r) => r.est > 0 && r.truth > 0)
    .map((r) => Math.log(r.est / r.truth));
  if (logs.length === 0) return undefined;
  return { pct: (Math.exp(mean(logs)) - 1) * 100, cases: logs.length };
}

export interface Summary {
  cases: number;
  kcal: {
    mae: number;
    mape: number;
    /**
     * Mean per-case (max−min) kcal across runs — run-to-run reproducibility. Only cases with ≥2
     * runs count, and `cases` says how many those were. Absent entirely at `--runs 1`: a single
     * sample always yields 0, and "spread 0" printed off one sample is a reproducibility claim
     * manufactured from no data.
     */
    spread?: { kcal: number; cases: number };
    /** Systematic direction of the kcal error (see `geoMeanBias`). Absent if no positive estimate. */
    bias?: Bias;
    /**
     * % of cases the model over-estimated, over the cases that landed on one side or the other.
     * 50 = no systematic direction. Exact hits are neither over nor under, so they leave the
     * denominator rather than counting as "not over" and dragging the number below 50.
     * Absent when every case was an exact hit.
     */
    over?: { pct: number; cases: number };
  };
  protein_g?: { mae: number; cases: number };
  carbs_g?: { mae: number; cases: number };
  fat_g?: { mae: number; cases: number };
  grams?: { mape: number; cases: number };
  /**
   * Grams-vs-density attribution of the kcal error, over the cases declaring total_grams whose
   * representative run has positive kcal AND positive grams. Since kcal = grams × density, in log
   * space ln(kcal_est/kcal_true) = ln(grams_est/grams_true) + ln(density_est/density_true) — an
   * identity, because density_est is DEFINED as kcal_est/grams_est, so each meal's kcal error
   * splits into a portion component and a richness component with nothing left over.
   *
   * This is the evidence #8 (nutrition-DB grounding) is gated on — its gate is "where does the
   * macro error actually come from", and a density-dominated split speaks to it. It does NOT
   * decide the portion side: #11 (side-view photos for tall/layered dishes) shipped 2026-07-24;
   * the open portion question is #31, measuring that shipped gain on paired overhead+side
   * fixtures. Two caveats on reading a density-dominated split as "build #8": density is DERIVED
   * (kcal_est / grams_est), so the same signal is equally consistent with a food-ID error — which
   * #8 does not fix, since it looks up the name the model already produced; and a component with
   * large scatter but no bias is not something a lookup table can correct either.
   *
   * The per-case identity is exact, but the aggregates do NOT compose: `kcal.bias` spans every
   * case, while the two components span only the decomposable subset. They sum per meal, not
   * across the report.
   */
  decomp?: {
    cases: number;
    /** Mean |density_est − density_true| / density_true × 100, density = kcal/gram. */
    densityMape: number;
    /**
     * Mean |ln(grams_est / grams_true)| — the portion component's magnitude. Note these are means
     * of ABSOLUTE logs, so `gramsLogMae + densityLogMae` does NOT equal the mean kcal log-error:
     * by the triangle inequality it is ≥ it, and strictly greater whenever the two components
     * point in opposite directions. Only the signed per-case components sum exactly.
     */
    gramsLogMae: number;
    /** Mean |ln(density_est / density_true)| — the richness component's magnitude. */
    densityLogMae: number;
    /**
     * Share of total |log| error MAGNITUDE attributable to grams. This is the "which lever is
     * bigger" number — one badly-portioned meal outweighs two slightly-rich ones, as it should.
     */
    gramsSharePct: number;
    /**
     * % of cases where grams is the larger driver, counted over cases where one component
     * STRICTLY dominates. Ties (including every zero-error case, and the exact mirror-error case
     * where both components are wrong by the same factor in opposite directions) are neither, so
     * they leave the denominator instead of silently voting grams. One case, one vote — so read
     * this as "how often", and `gramsSharePct` as "how much". Absent if every case tied.
     */
    gramsDominated?: { pct: number; cases: number };
    /** Signed portion bias (see `geoMeanBias`) — reading meals as too big, or too small? */
    gramsBias?: Bias;
    /**
     * Signed richness bias — too energy-dense per gram, or not enough? Density is driven by fat,
     * sugar and starch, but equally by water content: a watery soup and a dry bake differ in
     * kcal/g without either being "oilier".
     */
    densityBias?: Bias;
  };
}

/**
 * Aggregate error metrics over all cases. Per case every number comes from one `representativeRun`
 * (the median-kcal run); macro metrics only cover cases that declare that macro.
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
  // ABSOLUTE logs — magnitudes, deliberately sign-stripped. Named so they can't be mistaken for
  // the signed series below, which live three lines away and answer a different question.
  const gramsAbsLogs: number[] = [];
  const densityAbsLogs: number[] = [];
  let gramsDominated = 0;
  let dominanceDecided = 0;
  // Signed series: one Ratio object per case, so an estimate can never drift apart from its truth.
  // `geoMeanBias` reports its own case count, because these can cover fewer cases than the
  // absolute metrics beside them.
  const kcalRatios: Ratio[] = [];
  const gramsRatios: Ratio[] = [];
  const densityRatios: Ratio[] = [];
  let kcalOver = 0;
  let kcalDecided = 0;
  const spreads: number[] = [];

  for (const c of cases) {
    const rep = representativeRun(c.runs);
    const kcals = c.runs.map((r) => r.kcal);
    const est = rep.kcal;
    kcalErrs.push(Math.abs(est - c.expected.kcal));
    kcalPctErrs.push((Math.abs(est - c.expected.kcal) / c.expected.kcal) * 100);
    // Only a case with ≥2 runs can disagree with itself; a single-run case has no spread to
    // report, and averaging its 0 in would understate the real disagreement.
    if (kcals.length > 1) spreads.push(Math.max(...kcals) - Math.min(...kcals));
    kcalRatios.push({ est, truth: c.expected.kcal });
    // An exact hit is neither over nor under — it leaves the denominator (see `kcal.over`).
    if (est !== c.expected.kcal) {
      kcalDecided++;
      if (est > c.expected.kcal) kcalOver++;
    }

    for (const key of ["protein_g", "carbs_g", "fat_g"] as const) {
      const want = c.expected[key];
      if (want === undefined) continue;
      macroErrs[key].push(Math.abs(rep[key] - want));
    }
    if (c.expected.total_grams !== undefined) {
      const estGrams = rep.grams_total;
      const trueGrams = c.expected.total_grams;
      gramsPctErrs.push((Math.abs(estGrams - trueGrams) / trueGrams) * 100);
      // Density = kcal/gram, so it needs BOTH sides positive. A zero-gram run (empty model output)
      // has no defined density; a zero-kcal run (a plausible model answer for water or black
      // coffee) would make ln(0) = -Infinity, and a negative one NaN — either would silently
      // destroy the mean for every OTHER case in the same run. Excluded, not divided by zero.
      if (estGrams > 0 && est > 0) {
        const densityTrue = c.expected.kcal / trueGrams;
        const densityEst = est / estGrams;
        densityPctErrs.push((Math.abs(densityEst - densityTrue) / densityTrue) * 100);
        densityRatios.push({ est: densityEst, truth: densityTrue });
        // Inside the guard, not beside `grams.mape` above: the portion and richness biases are
        // printed as a two-way split of ONE error budget, so they must cover the SAME cases.
        // (`grams.mape` legitimately covers more — it needs no density.)
        gramsRatios.push({ est: estGrams, truth: trueGrams });
        const gramsLog = Math.abs(Math.log(estGrams / trueGrams));
        const densityLog = Math.abs(Math.log(densityEst / densityTrue));
        gramsAbsLogs.push(gramsLog);
        densityAbsLogs.push(densityLog);
        // Strict: a tie is not evidence for either lever (see `decomp.gramsDominated`).
        if (gramsLog !== densityLog) {
          dominanceDecided++;
          if (gramsLog > densityLog) gramsDominated++;
        }
      }
    }
  }

  // The `...(x === undefined ? {} : { k: x })` spread below OMITS a key rather than setting it to
  // undefined. Under today's tsconfig (`strict`, no `exactOptionalPropertyTypes`) a plain
  // assignment would also compile, but the distinction is load-bearing at runtime: `"bias" in s`
  // and `JSON.stringify` both treat an explicit `undefined` as present-ish, and the whole point of
  // these optional fields is that absent must be distinguishable from zero. Enabling
  // `exactOptionalPropertyTypes` repo-wide would make this the enforced rule; it currently fails
  // across src/tg_bot/, so the pattern is upheld by convention here instead.
  const kcalBias = geoMeanBias(kcalRatios);
  const summary: Summary = {
    cases: cases.length,
    kcal: {
      mae: mean(kcalErrs),
      mape: mean(kcalPctErrs),
      ...(spreads.length === 0 ? {} : { spread: { kcal: mean(spreads), cases: spreads.length } }),
      ...(kcalBias === undefined ? {} : { bias: kcalBias }),
      ...(kcalDecided === 0
        ? {}
        : { over: { pct: (kcalOver / kcalDecided) * 100, cases: kcalDecided } }),
    },
  };
  for (const key of ["protein_g", "carbs_g", "fat_g"] as const) {
    if (macroErrs[key].length) summary[key] = { mae: mean(macroErrs[key]), cases: macroErrs[key].length };
  }
  if (gramsPctErrs.length) summary.grams = { mape: mean(gramsPctErrs), cases: gramsPctErrs.length };
  if (densityPctErrs.length) {
    const gramsBias = geoMeanBias(gramsRatios);
    const densityBias = geoMeanBias(densityRatios);
    const totalLog = sum(gramsAbsLogs) + sum(densityAbsLogs);
    summary.decomp = {
      cases: densityPctErrs.length,
      densityMape: mean(densityPctErrs),
      gramsLogMae: mean(gramsAbsLogs),
      densityLogMae: mean(densityAbsLogs),
      // Zero total error (every case a perfect hit) attributes to neither side; 50/50 is the
      // only non-arbitrary reading of "no error to apportion".
      gramsSharePct: totalLog === 0 ? 50 : (sum(gramsAbsLogs) / totalLog) * 100,
      ...(dominanceDecided === 0
        ? {}
        : {
            gramsDominated: {
              pct: (gramsDominated / dominanceDecided) * 100,
              cases: dominanceDecided,
            },
          }),
      ...(gramsBias === undefined ? {} : { gramsBias }),
      ...(densityBias === undefined ? {} : { densityBias }),
    };
  }
  return summary;
}

const fmt = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** "1 case" / "2 cases" — a metric's denominator is read closely, so it should read correctly. */
const plural = (n: number): string => `${n} case${n === 1 ? "" : "s"}`;

/**
 * Signed numbers carry their sign explicitly — "+28%" vs "-28%" is the whole point of a bias.
 * Rounds BEFORE testing the sign, so a value that displays as zero never renders as "-0.0%".
 */
const signed = (n: number): string => {
  const rounded = Number(n.toFixed(1));
  return `${rounded > 0 ? "+" : ""}${fmt(rounded)}%`;
};

/**
 * What actually got measured, versus what was asked for. Every exclusion the runner makes lives
 * here so it can be printed on STDOUT beside the report — the report is the artifact that gets
 * archived and pasted into an issue, and it must carry its own caveats. Exclusions announced only
 * on stderr vanish the moment anyone redirects stdout to a file.
 */
export interface RunCoverage {
  /** Fixture pairs found on disk. */
  fixtures: number;
  /** Cases that produced ≥1 usable run and entered the summary. */
  evaluated: number;
  /** Cases dropped because the model said "not food" — an ACCURACY result, not a transport fault. */
  refused: number;
  /** Cases dropped because every run errored (network, 4xx, unparseable output). */
  failed: number;
  runsRequested: number;
  runsCompleted: number;
}

/**
 * One line accounting for the gap between fixtures and evaluated cases. Rendered even when
 * everything succeeded — "30/30" is information, and its absence would make a partial run look
 * like a normal one.
 *
 * Two models with different `evaluated` counts are NOT comparable: the dropped cases are the
 * ambiguous photos, so a model that refuses more scores better on what remains. That warning is
 * part of the line rather than a footnote because the number invites the comparison.
 */
export function renderCoverage(c: RunCoverage): string {
  const parts = [`  coverage: ${c.evaluated}/${c.fixtures} fixtures evaluated`];
  if (c.refused) parts.push(`${c.refused} refused (isFood=false)`);
  if (c.failed) parts.push(`${c.failed} all-runs-failed`);
  parts.push(`runs ${c.runsCompleted}/${c.runsRequested}`);
  const line = parts.join(" · ");
  return c.evaluated === c.fixtures && c.runsCompleted === c.runsRequested
    ? line
    : `${line}\n  WARNING: incomplete coverage — the dropped cases are not random (they skew to ` +
        `ambiguous photos), so this model's numbers are not comparable to a model with a ` +
        `different evaluated count.`;
}

/** One model's summary as a compact plain-text block (the runner prints one per model). */
export function renderReport(model: string, s: Summary): string {
  const lines = [
    `model: ${model} (${plural(s.cases)})`,
    `  kcal    MAE ${fmt(s.kcal.mae)} · MAPE ${fmt(s.kcal.mape)}%` +
      (s.kcal.spread
        ? ` · run spread ${fmt(s.kcal.spread.kcal)} (${plural(s.kcal.spread.cases)} with ≥2 runs)`
        : " · run spread n/a (single run per case)"),
  ];
  // Every partial-coverage number prints its own denominator, and each renders independently:
  // one absent number must not suppress a sibling that IS known. Two percentages side by side
  // over silently different case counts is the exact way this report could mislead.
  const biasParts: string[] = [];
  if (s.kcal.bias) biasParts.push(`${signed(s.kcal.bias.pct)} (${plural(s.kcal.bias.cases)})`);
  else biasParts.push("n/a (no positive estimate)");
  if (s.kcal.over) {
    biasParts.push(`over-estimated in ${fmt(s.kcal.over.pct)}% of ${plural(s.kcal.over.cases)}`);
  }
  lines.push(`  kcal    BIAS ${biasParts.join(" · ")}`);
  if (s.protein_g) lines.push(`  protein MAE ${fmt(s.protein_g.mae)} g (${plural(s.protein_g.cases)})`);
  if (s.carbs_g) lines.push(`  carbs   MAE ${fmt(s.carbs_g.mae)} g (${plural(s.carbs_g.cases)})`);
  if (s.fat_g) lines.push(`  fat     MAE ${fmt(s.fat_g.mae)} g (${plural(s.fat_g.cases)})`);
  if (s.grams) lines.push(`  portion MAPE ${fmt(s.grams.mape)}% (${plural(s.grams.cases)})`);
  if (s.decomp) {
    const d = s.decomp;
    lines.push(`  density MAPE ${fmt(d.densityMape)}% (${plural(d.cases)})`);
    // Magnitude share first: "how much" is the lever question. The per-case vote follows, with
    // its own denominator, because the two can disagree — one badly-portioned meal can outweigh
    // several slightly-rich ones, and a reader who sees only the vote would pick the wrong lever.
    const votes = d.gramsDominated
      ? `, grams-dominated in ${fmt(d.gramsDominated.pct)}% of ${plural(d.gramsDominated.cases)}`
      : ", no case strictly dominated";
    lines.push(
      `  kcal error source: grams |ln| ${fmt(d.gramsLogMae)} vs density |ln| ${fmt(d.densityLogMae)}` +
        ` — ${fmt(d.gramsSharePct)}% of the error magnitude is grams${votes}`,
    );
    // Each half renders on its own: a known portion bias must still print when the richness bias
    // is unavailable. The two normally share a case set by construction (both are computed inside
    // the same guard), so `n/a` here is a signal that something upstream is unusual.
    const portion = d.gramsBias ? signed(d.gramsBias.pct) : "n/a";
    const richness = d.densityBias ? signed(d.densityBias.pct) : "n/a";
    const biasCases = d.gramsBias ?? d.densityBias;
    lines.push(
      `  bias direction: portion ${portion} · richness ${richness}` +
        (biasCases ? ` (${plural(biasCases.cases)})` : ""),
    );
  }
  return lines.join("\n");
}
