import { describe, expect, test } from "bun:test";
import { bmi, bmiRange, dayHealthScore, HEALTH_SCORE, healthScore, type HealthScore } from "./scores.ts";
import type { Verdict } from "./types.ts";

/**
 * The pinned persona (#118, confirmed by design-pro): the board account's own plate reads, with
 * `ldl` declared. Porridge 8, salmon 7, flat white 5, banana 5, the day 6.9 → 7; BMI 24.8 at
 * 73.4 kg / 172 cm. If a number here moves, the issue moves first.
 */
const meal = (o: {
  kcal: number; protein_g?: number | null; fiber_g?: number | null; satfat_g?: number | null;
  sugar_g?: number | null; sodium_mg?: number | null; ldl?: Verdict; kidneys?: Verdict;
}) => ({
  kcal: o.kcal,
  protein_g: o.protein_g, fiber_g: o.fiber_g, satfat_g: o.satfat_g,
  sugar_g: o.sugar_g, sodium_mg: o.sodium_mg,
  verdicts: o.ldl !== undefined || o.kidneys !== undefined ? { ldl: o.ldl, kidneys: o.kidneys } : {},
});

const part = (s: HealthScore, factor: string) => s.parts.find((p) => p.factor === factor)!;

describe("bmi", () => {
  test("weight ÷ height², one decimal — the persona's 73.4 kg at 172 cm", () => {
    expect(bmi(73.4, 172)).toBe(24.8);
  });

  test("a non-positive weight or height is no BMI", () => {
    expect(bmi(0, 172)).toBeNull();
    expect(bmi(73.4, 0)).toBeNull();
    expect(bmi(null, 172)).toBeNull();
    expect(bmi(73.4, null)).toBeNull();
  });
});

describe("bmiRange", () => {
  test("the four bands, at their edges", () => {
    expect(bmiRange(18.4)).toBe("below-18.5");
    expect(bmiRange(18.5)).toBe("18.5-24.9");
    expect(bmiRange(24.9)).toBe("18.5-24.9");
    expect(bmiRange(25)).toBe("25-29.9");
    expect(bmiRange(29.9)).toBe("25-29.9");
    expect(bmiRange(30)).toBe("30-plus");
    expect(bmiRange(24.8)).toBe("18.5-24.9");
  });
});

describe("healthScore", () => {
  test("the persona's meals, with ldl declared", () => {
    expect(healthScore(meal({
      kcal: 312, protein_g: 11, fiber_g: 7, satfat_g: 1.8, sugar_g: 18, sodium_mg: 160, ldl: "good",
    }), ["ldl"])?.score).toBe(8);
    expect(healthScore(meal({
      kcal: 540, protein_g: 34, fiber_g: 5, satfat_g: 5, sugar_g: 3, sodium_mg: 620, ldl: "warn",
    }), ["ldl"])?.score).toBe(7);
    expect(healthScore(meal({
      kcal: 214, protein_g: 9, fiber_g: 3, satfat_g: 3, sugar_g: 26, sodium_mg: 120, ldl: "good",
    }), ["ldl"])?.score).toBe(5);
    expect(healthScore(meal({
      kcal: 94, protein_g: 1.1, fiber_g: 1, satfat_g: 0.3, sugar_g: 18, sodium_mg: 2,
    }), [])?.score).toBe(5);
  });

  test("each part's thresholds, per calorie", () => {
    // protein: ≥20% of kcal +2, ≥10% +1, under 0
    expect(part(healthScore(meal({ kcal: 400, protein_g: 20, fiber_g: 0, satfat_g: 0, sugar_g: 0, sodium_mg: 0 }), [])!, "protein").points).toBe(2);
    expect(part(healthScore(meal({ kcal: 400, protein_g: 10, fiber_g: 0, satfat_g: 0, sugar_g: 0, sodium_mg: 0 }), [])!, "protein").points).toBe(1);
    expect(part(healthScore(meal({ kcal: 400, protein_g: 9, fiber_g: 0, satfat_g: 0, sugar_g: 0, sodium_mg: 0 }), [])!, "protein").points).toBe(0);
    // fibre: ≥1.5 g/100 kcal +2, ≥0.75 +1
    expect(part(healthScore(meal({ kcal: 400, protein_g: 0, fiber_g: 6, satfat_g: 0, sugar_g: 0, sodium_mg: 0 }), [])!, "fibre").points).toBe(2);
    expect(part(healthScore(meal({ kcal: 400, protein_g: 0, fiber_g: 3, satfat_g: 0, sugar_g: 0, sodium_mg: 0 }), [])!, "fibre").points).toBe(1);
    expect(part(healthScore(meal({ kcal: 400, protein_g: 0, fiber_g: 2.9, satfat_g: 0, sugar_g: 0, sodium_mg: 0 }), [])!, "fibre").points).toBe(0);
    // sat fat: ≤10% 0, ≤15% −1, over −2
    expect(part(healthScore(meal({ kcal: 400, protein_g: 0, fiber_g: 0, satfat_g: 4.4, sugar_g: 0, sodium_mg: 0 }), [])!, "satfat").points).toBe(0);
    expect(part(healthScore(meal({ kcal: 400, protein_g: 0, fiber_g: 0, satfat_g: 6.6, sugar_g: 0, sodium_mg: 0 }), [])!, "satfat").points).toBe(-1);
    expect(part(healthScore(meal({ kcal: 400, protein_g: 0, fiber_g: 0, satfat_g: 6.7, sugar_g: 0, sodium_mg: 0 }), [])!, "satfat").points).toBe(-2);
    // sugar: ≤15% 0, ≤30% −1, over −2
    expect(part(healthScore(meal({ kcal: 400, protein_g: 0, fiber_g: 0, satfat_g: 0, sugar_g: 15, sodium_mg: 0 }), [])!, "sugar").points).toBe(0);
    expect(part(healthScore(meal({ kcal: 400, protein_g: 0, fiber_g: 0, satfat_g: 0, sugar_g: 30, sodium_mg: 0 }), [])!, "sugar").points).toBe(-1);
    expect(part(healthScore(meal({ kcal: 400, protein_g: 0, fiber_g: 0, satfat_g: 0, sugar_g: 31, sodium_mg: 0 }), [])!, "sugar").points).toBe(-2);
    // salt: ≤100 mg/100 kcal 0, ≤200 −1, over −2
    expect(part(healthScore(meal({ kcal: 400, protein_g: 0, fiber_g: 0, satfat_g: 0, sugar_g: 0, sodium_mg: 400 }), [])!, "salt").points).toBe(0);
    expect(part(healthScore(meal({ kcal: 400, protein_g: 0, fiber_g: 0, satfat_g: 0, sugar_g: 0, sodium_mg: 800 }), [])!, "salt").points).toBe(-1);
    expect(part(healthScore(meal({ kcal: 400, protein_g: 0, fiber_g: 0, satfat_g: 0, sugar_g: 0, sodium_mg: 801 }), [])!, "salt").points).toBe(-2);
  });

  test("the clamp: the best plate is 10, the worst is 1", () => {
    expect(healthScore(meal({ kcal: 400, protein_g: 40, fiber_g: 10, satfat_g: 1, sugar_g: 5, sodium_mg: 100 }), [])?.score).toBe(10);
    expect(healthScore(meal({ kcal: 400, protein_g: 0, fiber_g: 0, satfat_g: 20, sugar_g: 50, sodium_mg: 2000 }), [])?.score).toBe(1);
  });

  test("a nutrient not read scores its part 0 with density null", () => {
    const s = healthScore(meal({ kcal: 400, protein_g: 20, fiber_g: null, satfat_g: 4, sugar_g: 10, sodium_mg: 300 }), [])!;
    const f = part(s, "fibre");
    expect(f.density).toBeNull();
    expect(f.points).toBe(0);
    expect(s.parts.filter((p) => p.density !== null)).toHaveLength(4);
  });

  test("fewer than three of five read is no score, and kcal ≤ 0 is none either", () => {
    expect(healthScore(meal({ kcal: 400, protein_g: 20, fiber_g: 5 }), [])).toBeNull();
    expect(healthScore(meal({ kcal: 0, protein_g: 20, fiber_g: 5, satfat_g: 4, sugar_g: 10, sodium_mg: 100 }), [])).toBeNull();
    expect(healthScore(meal({ kcal: -1, protein_g: 20, fiber_g: 5, satfat_g: 4, sugar_g: 10, sodium_mg: 100 }), [])).toBeNull();
  });

  test("declared ldl takes the lower of the band and the verdict, and names its limit", () => {
    // 8 % of kcal is band 0; a `bad` verdict pulls it to −2 — the score never contradicts the card.
    const s = healthScore(meal({ kcal: 400, protein_g: 20, fiber_g: 5, satfat_g: 3.6, sugar_g: 10, sodium_mg: 100, ldl: "bad" }), ["ldl"])!;
    const f = part(s, "satfat");
    expect(f.points).toBe(-2);
    expect(f.limit).toBe("ldl");
    // undeclared: the same stored verdict does not reach the part
    const plain = healthScore(meal({ kcal: 400, protein_g: 20, fiber_g: 5, satfat_g: 3.6, sugar_g: 10, sodium_mg: 100, ldl: "bad" }), [])!;
    expect(part(plain, "satfat").points).toBe(0);
    expect(part(plain, "satfat").limit).toBeUndefined();
  });

  test("declared kidneys does the same to salt", () => {
    const s = healthScore(meal({ kcal: 400, protein_g: 20, fiber_g: 5, satfat_g: 2, sugar_g: 10, sodium_mg: 300, kidneys: "bad" }), ["kidneys"])!;
    const f = part(s, "salt");
    expect(f.points).toBe(-2); // band is −1 (75 mg/100 kcal), the verdict is worse
    expect(f.limit).toBe("kidneys");
  });

  test("declared lowsugar doubles the sugar penalty; vegan changes nothing", () => {
    const base = meal({ kcal: 400, protein_g: 20, fiber_g: 5, satfat_g: 2, sugar_g: 25, sodium_mg: 100 });
    expect(part(healthScore(base, ["lowsugar"])!, "sugar").points).toBe(-2); // band −1, doubled
    expect(part(healthScore(base, ["lowsugar"])!, "sugar").limit).toBe("lowsugar");
    const heavy = meal({ kcal: 400, protein_g: 20, fiber_g: 5, satfat_g: 2, sugar_g: 40, sodium_mg: 100 });
    expect(part(healthScore(heavy, ["lowsugar"])!, "sugar").points).toBe(-4);
    const vegan = healthScore(base, ["vegan"])!;
    expect(part(vegan, "sugar").points).toBe(-1);
    expect(vegan.score).toBe(healthScore(base, [])!.score);
  });
});

describe("dayHealthScore", () => {
  const scored = (score: number | null, kcal: number) =>
    ({ kcal, healthScore: score === null ? null : { score, base: HEALTH_SCORE.base, parts: [] } });

  test("the persona's day: the kcal-weighted mean, rounded half up — 6.9 → 7", () => {
    expect(dayHealthScore([scored(8, 312), scored(7, 540), scored(5, 214)])).toBe(7);
  });

  test("unscored meals carry no weight, and a day with none scores null", () => {
    expect(dayHealthScore([scored(8, 312), scored(null, 540)])).toBe(8);
    expect(dayHealthScore([scored(null, 312)])).toBeNull();
    expect(dayHealthScore([])).toBeNull();
  });
});
