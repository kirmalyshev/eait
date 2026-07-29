// Portion calibration (design: docs/design/2026-07-27-analysis-quality.md, lever C). Pure — no
// I/O, no LLM. NOT WIRED INTO THE BOT, and must not be until `crossValidate` says it earns its
// place on held-out data.
//
// What this corrects: the model's portion estimates are range-COMPRESSED. Measured over 60 dishes,
// the log-log slope of estimate against truth is 0.67 for grams — small portions come out too
// large, large ones far too small, and the pivot sits near a mid-sized dish. That is a systematic,
// signed bias, which is exactly why it feels "unpredictable" when met one meal at a time.
//
// GRAMS ONLY, deliberately. kcal = grams x density, and the density half is addressed by grounding
// the food against a composition table; calibrating kcal directly as well would correct the same
// error twice. Grams is also the larger half of the budget (0.67 against 0.81).
//
// Bias, not variance. Sampling the model repeatedly and taking a median reduces spread — it cannot
// move a biased estimator, because the median of a biased estimator is still biased. Calibration is
// the only lever here aimed at the bias, which is also why no amount of self-consistency substitutes
// for it. Notably, nothing found in the published literature corrects this post hoc: the field
// measures the bias and lives with it.

/** One measured pair: what the model said, and what the scale said. */
export interface CalibrationPair {
  estimated: number;
  actual: number;
}

/** `actual ≈ exp(a) * estimated^b`, fitted by least squares in log-log space. */
export interface Calibration {
  a: number;
  b: number;
  /** Pairs the fit was actually computed from, after dropping unusable ones. */
  n: number;
}

/**
 * Fewer pairs than this and a two-parameter fit is drawing a line through whatever happened to be
 * measured. The whole fixture set is ~52 dishes, so this is not a comfortable margin — it is a
 * floor below which the answer is certainly meaningless rather than merely uncertain.
 */
export const MIN_PAIRS = 8;

/**
 * Fit `actual = exp(a) * estimated^b`. Returns null when the data cannot support a fit, rather
 * than a number the caller would have no way to distrust.
 *
 * Log space because the error is multiplicative: being 100 g out on a 150 g side dish and on a
 * 1400 g platter are not the same mistake, and a linear fit would let the large dishes decide the
 * whole line.
 */
export function fitCalibration(pairs: readonly CalibrationPair[]): Calibration | null {
  // log(0) is -Infinity and log(-1) is NaN; either poisons the sums silently, so drop rather than
  // repair. A zero-gram estimate is a failed analysis, not a small portion.
  const usable = pairs.filter((p) => p.estimated > 0 && p.actual > 0);
  if (usable.length < MIN_PAIRS) return null;

  const xs = usable.map((p) => Math.log(p.estimated));
  const ys = usable.map((p) => Math.log(p.actual));
  const mx = xs.reduce((s, v) => s + v, 0) / xs.length;
  const my = ys.reduce((s, v) => s + v, 0) / ys.length;

  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < xs.length; i++) {
    sxy += (xs[i]! - mx) * (ys[i]! - my);
    sxx += (xs[i]! - mx) ** 2;
  }
  // No spread in the estimates means no slope exists. Guarding on a small epsilon rather than
  // exactly 0 because a near-degenerate fit produces an enormous exponent that would look like a
  // valid calibration and destroy every portion it touched.
  if (sxx < 1e-12) return null;

  const b = sxy / sxx;
  return { a: my - b * mx, b, n: usable.length };
}

/** Apply a fit to one estimate. Non-positive input is returned untouched — nothing to correct. */
export function applyCalibration(grams: number, fit: Calibration): number {
  if (!(grams > 0)) return grams;
  return Math.exp(fit.a) * grams ** fit.b;
}

const mape = (pairs: readonly CalibrationPair[], f: (g: number) => number): number =>
  (pairs.reduce((s, p) => s + Math.abs(f(p.estimated) - p.actual) / p.actual, 0) / pairs.length) * 100;

export interface CvResult {
  /** MAPE of the raw estimates on held-out data. */
  baselineMape: number;
  /** MAPE of the calibrated estimates on held-out data. */
  calibratedMape: number;
  /** Percentage points gained. NEGATIVE means calibration made held-out accuracy worse. */
  improvedMape: number;
  /**
   * MAPE of ignoring the estimate entirely and predicting the training folds' typical portion.
   *
   * The comparator that stops a false positive, and it is not obvious. Fit two parameters to an
   * estimator carrying NO signal and the exponent collapses toward 0, which turns every prediction
   * into a constant near the middle of the data — and that beats using a useless estimate, so the
   * gain over `baselineMape` comes out strongly positive. Measured on seeded noise: fitted
   * exponent 0.08, a 12.6pp "improvement", and the bare constant scoring 59.0 against
   * calibration's 59.7. The apparent win was shrinkage, not correction.
   */
  constantMape: number;
  /**
   * Whether calibration beat the constant predictor. THIS is the ship gate, not `improvedMape`:
   * beating the raw estimate only shows the estimate was poor, while beating the constant shows
   * the calibration is actually using what the model saw.
   */
  beatsConstant: boolean;
  /** Pairs actually scored — every pair is held out exactly once. */
  evaluated: number;
  folds: number;
}

/**
 * k-fold cross-validation: fit on k-1 folds, score the held-out one, repeat.
 *
 * This exists because two parameters on ~52 dishes will fit in-sample noise very comfortably, and
 * an in-sample improvement proves nothing whatsoever. A negative `improvedMape` is a real and
 * expected outcome — it means the compression the fit found was an artefact of the sample, and C
 * must then NOT ship. That result is worth having; shipping a wrong correction to every portion
 * the bot reports is not.
 *
 * Deterministic by construction: folds are assigned by index (i % k), never shuffled, so the same
 * input always yields the same verdict and nobody can re-roll until the number looks good.
 */
export function crossValidate(pairs: readonly CalibrationPair[], folds = 5): CvResult | null {
  const usable = pairs.filter((p) => p.estimated > 0 && p.actual > 0);
  if (folds < 2 || usable.length < folds) return null;

  const held: CalibrationPair[] = [];
  const corrected: CalibrationPair[] = [];
  const constant: CalibrationPair[] = [];
  for (let k = 0; k < folds; k++) {
    const test = usable.filter((_, i) => i % folds === k);
    const train = usable.filter((_, i) => i % folds !== k);
    const fit = fitCalibration(train);
    // One unfittable fold means the answer would be scored on a different set than it claims.
    // Refusing beats reporting a gain averaged over whichever folds happened to work.
    if (!fit || test.length === 0) return null;
    // Geometric, not arithmetic: the error is multiplicative and the fit lives in log space, so
    // the honest "ignore the photo entirely" baseline is the typical portion in that same space.
    const typical = Math.exp(
      train.reduce((s, p) => s + Math.log(p.actual), 0) / train.length,
    );
    for (const p of test) {
      held.push(p);
      corrected.push({ estimated: applyCalibration(p.estimated, fit), actual: p.actual });
      constant.push({ estimated: typical, actual: p.actual });
    }
  }

  const baselineMape = mape(held, (g) => g);
  const calibratedMape = mape(corrected, (g) => g);
  const constantMape = mape(constant, (g) => g);
  return {
    baselineMape,
    calibratedMape,
    improvedMape: baselineMape - calibratedMape,
    constantMape,
    beatsConstant: calibratedMape < constantMape,
    evaluated: held.length,
    folds,
  };
}
