// BMI and the health score (#118) — the formula design-pro confirmed on the issue.
//
// PURE, and deliberately so: the score reads only what a meal row already stores (its five
// nutrients and its computed verdicts) plus the profile's declared `restrictions`. It is
// COMPUTED AT READ — never a column, never a migration — because every number it derives from
// is already stored, and a stored copy is a copy that can disagree. The clients never compute it:
// the server sends `MealRecord.healthScore`, `DayResponse.healthScore` and `WeightsResponse.bmi`.
//
// THE THRESHOLDS ARE ONE TABLE (`HEALTH_SCORE`), so a correction from design-pro is a one-line
// edit and its diff is the whole review. Bands are tried in order and the first satisfied wins —
// a `gte` band includes its bound (≥, the bonuses) and a `lte` band includes its (≤, the
// penalties); the last band is the catch-all.

import { bmi } from "./targets.ts";
import type { Verdict } from "./types.ts";

// `bmi` is not defined twice: `targets.ts` already owns the equation — `checkTargetWeight` and the
// `minHealthyWeightKg` floor read it, so the value the Progress card shows and the floor the plan
// refuses below are the same arithmetic. Re-exported so this module is the one door to the score.
export { bmi };

export type ScoreFactor = "protein" | "fibre" | "satfat" | "sugar" | "salt";

/** The declared limit that personalised a part — the restriction tag, so the breakdown can name it. */
export type ScoreLimit = "ldl" | "kidneys" | "lowsugar";

export interface ScorePart {
  factor: ScoreFactor;
  /**
   * The measure the bands were applied to — a share of the meal's calories (protein, saturated
   * fat, sugar) or grams per 100 kcal (fibre, salt). `null` when the nutrient was not read:
   * the part scores 0 and the UI says "not read".
   */
  density: number | null;
  points: number;
  /** Present when a declared restriction shaped the part. */
  limit?: ScoreLimit;
}

export interface HealthScore {
  /** Base 6 plus the parts, clamped to 1–10. */
  score: number;
  /** The points every score starts from — the breakdown's "Start" row reads it, never recomputes it. */
  base: number;
  parts: ScorePart[];
}

/**
 * The meal-shaped input `healthScore` reads. Numbers may be absent — that is what "not read" means,
 * and a stored row is read through `typeof`, never through the type: `exactOptionalPropertyTypes`
 * is why each field spells `| undefined` out.
 */
export interface ScoreMeal {
  kcal: number | null | undefined;
  protein_g?: number | null | undefined;
  fiber_g?: number | null | undefined;
  satfat_g?: number | null | undefined;
  sugar_g?: number | null | undefined;
  sodium_mg?: number | null | undefined;
  verdicts?: { ldl?: Verdict | undefined; kidneys?: Verdict | undefined } | null | undefined;
}

interface ScoreBand {
  gte?: number;
  lte?: number;
  points: number;
}

interface ScorePartSpec {
  factor: ScoreFactor;
  /** The meal field the density is read from. */
  nutrient: "protein_g" | "fiber_g" | "satfat_g" | "sugar_g" | "sodium_mg";
  /** `density = nutrient × perKcal ÷ kcal` — 400/900 are the % shares (4/9 kcal per gram), 100 the per-100-kcal rates. */
  perKcal: number;
  bands: readonly ScoreBand[];
  /** The restriction that makes this part personal, when declared. */
  limit?: ScoreLimit;
  /** The stored verdict that lowers the band (`ldl` on saturated fat, `kidneys` on salt). */
  verdict?: "ldl" | "kidneys";
  /** `lowsugar` doubles a negative sugar band — there is no sugar verdict to take the lower of. */
  doublePenalty?: boolean;
}

export const HEALTH_SCORE: {
  base: number;
  clamp: { min: number; max: number };
  /** Fewer than this many of the five nutrients read is no score — two numbers is a guess. */
  minRead: number;
  /** A declared limit's verdict on the same card, as points — good 0, warn −1, bad −2. */
  verdictPoints: Record<Verdict, number>;
  parts: readonly ScorePartSpec[];
} = {
  base: 6,
  clamp: { min: 1, max: 10 },
  minRead: 3,
  verdictPoints: { good: 0, warn: -1, bad: -2 },
  parts: [
    {
      factor: "protein", nutrient: "protein_g", perKcal: 400,
      bands: [{ gte: 20, points: 2 }, { gte: 10, points: 1 }, { points: 0 }],
    },
    {
      factor: "fibre", nutrient: "fiber_g", perKcal: 100,
      bands: [{ gte: 1.5, points: 2 }, { gte: 0.75, points: 1 }, { points: 0 }],
    },
    {
      factor: "satfat", nutrient: "satfat_g", perKcal: 900, limit: "ldl", verdict: "ldl",
      bands: [{ lte: 10, points: 0 }, { lte: 15, points: -1 }, { points: -2 }],
    },
    {
      factor: "sugar", nutrient: "sugar_g", perKcal: 400, limit: "lowsugar", doublePenalty: true,
      bands: [{ lte: 15, points: 0 }, { lte: 30, points: -1 }, { points: -2 }],
    },
    {
      factor: "salt", nutrient: "sodium_mg", perKcal: 100, limit: "kidneys", verdict: "kidneys",
      bands: [{ lte: 100, points: 0 }, { lte: 200, points: -1 }, { points: -2 }],
    },
  ],
};

const read = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);

/**
 * One meal's score, or `null` when there is nothing honest to say — `kcal ≤ 0`, or fewer than
 * `minRead` of the five nutrients read.
 *
 * A DECLARED LIMIT PERSONALISES ITS PART. The card's own verdict would otherwise contradict the
 * score — the persona's salmon is 8 % of kcal in saturated fat (band 0) while its pill says
 * "Saturated fat high", so under `ldl` the part takes the lower of the band and the verdict.
 * `lowsugar` doubles the sugar penalty because no sugar verdict exists; `vegan` changes nothing.
 * The part names the limit that shaped it (`part.limit`), so the breakdown can say why.
 */
export function healthScore(meal: ScoreMeal, restrictions: readonly string[]): HealthScore | null {
  const kcal = meal.kcal;
  if (!read(kcal) || kcal <= 0) return null;

  const parts: ScorePart[] = [];
  let readCount = 0;
  for (const spec of HEALTH_SCORE.parts) {
    const raw = meal[spec.nutrient];
    if (!read(raw)) {
      parts.push({ factor: spec.factor, density: null, points: 0 });
      continue;
    }
    readCount++;
    const density = (raw * spec.perKcal) / kcal;
    let points = spec.bands.find((b) =>
      (b.gte === undefined || density >= b.gte) && (b.lte === undefined || density <= b.lte))!.points;
    let limit: ScoreLimit | undefined;
    if (spec.limit !== undefined && restrictions.includes(spec.limit)) {
      limit = spec.limit;
      const verdict = spec.verdict !== undefined ? meal.verdicts?.[spec.verdict] : undefined;
      if (verdict !== undefined) points = Math.min(points, HEALTH_SCORE.verdictPoints[verdict]);
      if (spec.doublePenalty === true && points < 0) points *= 2;
    }
    parts.push(limit === undefined ? { factor: spec.factor, density, points } : { factor: spec.factor, density, points, limit });
  }

  if (readCount < HEALTH_SCORE.minRead) return null;
  const raw = HEALTH_SCORE.base + parts.reduce((sum, p) => sum + p.points, 0);
  return {
    score: Math.min(HEALTH_SCORE.clamp.max, Math.max(HEALTH_SCORE.clamp.min, raw)),
    base: HEALTH_SCORE.base,
    parts,
  };
}

/**
 * The day's score: the kcal-weighted mean of its scored meals, rounded half up — a big plate
 * counts for what it fed, not for what it scored. `null` when no meal carries a score.
 */
export function dayHealthScore(
  meals: readonly { kcal: number | null | undefined; healthScore: HealthScore | null | undefined }[],
): number | null {
  let weighted = 0;
  let weight = 0;
  for (const m of meals) {
    if (m.healthScore === null || m.healthScore === undefined || !read(m.kcal) || m.kcal <= 0) continue;
    weighted += m.healthScore.score * m.kcal;
    weight += m.kcal;
  }
  return weight === 0 ? null : Math.round(weighted / weight);
}

export type BmiRange = "below-18.5" | "18.5-24.9" | "25-29.9" | "30-plus";

/**
 * The four ranges as their upper edges — the value strictly below `max` falls in the band.
 * The ids ARE the numbers: `bmiRangeLabel` reads them out of the id rather than a second table,
 * so a moved edge and a stale label cannot disagree.
 */
export const BMI_BANDS = [
  { id: "below-18.5", max: 18.5 },
  { id: "18.5-24.9", max: 25 },
  { id: "25-29.9", max: 30 },
  { id: "30-plus", max: Number.POSITIVE_INFINITY },
] as const satisfies readonly { id: BmiRange; max: number }[];

/**
 * A neutral id, on purpose — the label beside a BMI is the numbers themselves, and the test in
 * `scores-copy.test.ts` bans the category words ("obese", "healthy range") in all eight languages.
 */
export function bmiRange(value: number): BmiRange {
  return BMI_BANDS.find((b) => value < b.max)!.id;
}
