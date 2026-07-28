import { describe, expect, test } from "bun:test";
import { applyCalibration, crossValidate, fitCalibration, MIN_PAIRS } from "./calibration.ts";

/** Deterministic LCG — a seeded generator so a CV result never depends on the run. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

/** est = true^slope * scale — the compression shape we measured (slope < 1 pulls toward the mean). */
const compressed = (truths: number[], slope: number, scale = 1) =>
  truths.map((t) => ({ estimated: scale * t ** slope, actual: t }));

const TRUTHS = [50, 80, 120, 175, 240, 320, 430, 560, 700, 900, 1150, 1400];

describe("fitCalibration", () => {
  test("recovers the inverse of a known compression", () => {
    // est = true^0.67, so the correction must be est^(1/0.67). Recovering the exponent is the
    // whole job: slope 0.67 is what "+35% under 300 kcal, -57% over 1000" actually is.
    const fit = fitCalibration(compressed(TRUTHS, 0.67))!;
    expect(fit.b).toBeCloseTo(1 / 0.67, 4);
  });

  test("an already-unbiased estimator calibrates to the identity", () => {
    const fit = fitCalibration(TRUTHS.map((t) => ({ estimated: t, actual: t })))!;
    expect(fit.b).toBeCloseTo(1, 6);
    expect(applyCalibration(300, fit)).toBeCloseTo(300, 4);
  });

  test("round-trips: applying the fit to the estimates recovers the truths", () => {
    const pairs = compressed(TRUTHS, 0.67, 1.4);
    const fit = fitCalibration(pairs)!;
    for (const p of pairs) expect(applyCalibration(p.estimated, fit)).toBeCloseTo(p.actual, 3);
  });

  test("refuses with too few pairs rather than fitting noise", () => {
    // Two parameters on a handful of dishes is not a calibration, it is a line through whatever
    // happened to be measured. Returning null makes that refusal explicit at the call site.
    expect(fitCalibration(compressed(TRUTHS.slice(0, MIN_PAIRS - 1), 0.67))).toBeNull();
  });

  test("refuses when every estimate is identical — no slope is recoverable", () => {
    const pairs = TRUTHS.map((t) => ({ estimated: 200, actual: t }));
    expect(fitCalibration(pairs)).toBeNull();
  });

  test("drops non-positive pairs instead of taking log of zero", () => {
    const pairs = [...compressed(TRUTHS, 0.67), { estimated: 0, actual: 100 }, { estimated: 50, actual: 0 }];
    const fit = fitCalibration(pairs)!;
    expect(Number.isFinite(fit.a)).toBe(true);
    expect(Number.isFinite(fit.b)).toBe(true);
    expect(fit.n).toBe(TRUTHS.length);
  });
});

describe("crossValidate — the guard that decides whether C ships at all", () => {
  test("reports a real out-of-fold gain on genuinely compressed data, and beats the constant", () => {
    const cv = crossValidate(compressed(TRUTHS, 0.67), 4)!;
    expect(cv.improvedMape).toBeGreaterThan(0);
    expect(cv.baselineMape).toBeGreaterThan(cv.calibratedMape);
    // The gain comes from correcting compression, not from collapsing toward the middle.
    expect(cv.beatsConstant).toBe(true);
  });

  test("pure noise still 'improves' MAPE — which is why beatsConstant is the real gate", () => {
    // Counter-intuitive and the reason this comparator exists. With no signal the exponent
    // collapses toward 0, every prediction becomes a constant near the middle of the data, and
    // that beats using a useless estimate — so improvedMape comes out strongly positive on data
    // where there is nothing whatsoever to learn. Shipping C on that number would push a wrong
    // correction onto every portion the bot reports.
    const r = rng(42);
    const pairs = Array.from({ length: 60 }, () => ({
      estimated: 100 + r() * 900,
      actual: 100 + r() * 900,
    }));
    const cv = crossValidate(pairs, 5)!;
    expect(cv.improvedMape).toBeGreaterThan(0); // the trap
    expect(cv.beatsConstant).toBe(false); // the guard that catches it
  });

  test("folds partition the data — every pair is held out exactly once", () => {
    const cv = crossValidate(compressed(TRUTHS, 0.67), 4)!;
    expect(cv.evaluated).toBe(TRUTHS.length);
  });

  test("returns null when a fold cannot be fitted, rather than a partial answer", () => {
    expect(crossValidate(compressed(TRUTHS.slice(0, 4), 0.67), 4)).toBeNull();
  });
});
