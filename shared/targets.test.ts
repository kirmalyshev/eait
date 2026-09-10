import { describe, expect, it } from "bun:test";
import {
  KCAL_FLOOR, KCAL_FLOOR_UNKNOWN, MIN_TARGET_BMI, ageFrom, basalMetabolicRate, bmi,
  checkTargetWeight, explainTargets, targetsFor, verdictsFromTargets,
  visibleVerdicts, weightRemainingKg,
} from "./targets.ts";
import type { Profile } from "./types.ts";

const TODAY = new Date("2026-08-01T12:00:00Z");

function profile(over: Partial<Profile> = {}): Profile {
  return {
    user_id: "u1", lang: "en", goal: "maintain", sex: "female", birth_year: 1990,
    height_cm: 165, weight_kg: 70, weight_measured_at: null, target_weight_kg: 65,
    activity: "sedentary", pace: "steady",
    country: "de", restrictions: [], medical_limitations: null, food_allergies: null,
    product_limitations: null, onboarded_at: "2026-01-01T00:00:00Z",
    ...over,
  };
}

describe("ageFrom", () => {
  it("computes whole years", () => {
    expect(ageFrom(1990, TODAY)).toBe(36);
  });

  it("refuses under-16s rather than clamping them", () => {
    // Clamping would hand a 14-year-old an adult's target. Null routes to a refusal instead.
    expect(ageFrom(2014, TODAY)).toBeNull();
    expect(ageFrom(2010, TODAY)).toBe(16);
  });

  it("refuses implausible birth years at both ends", () => {
    expect(ageFrom(1800, TODAY)).toBeNull();
    expect(ageFrom(2030, TODAY)).toBeNull();
  });

  it("is null when never asked", () => {
    expect(ageFrom(null, TODAY)).toBeNull();
  });
});

describe("basalMetabolicRate (Mifflin-St Jeor)", () => {
  it("matches the published equation for a woman", () => {
    // 10(70) + 6.25(165) - 5(36) - 161 = 700 + 1031.25 - 180 - 161 = 1390.25 -> 1390
    expect(basalMetabolicRate(profile(), TODAY)).toBe(1390);
  });

  it("matches the published equation for a man", () => {
    // 10(80) + 6.25(180) - 5(36) + 5 = 800 + 1125 - 180 + 5 = 1750
    expect(basalMetabolicRate(profile({ sex: "male", weight_kg: 80, height_cm: 180 }), TODAY)).toBe(1750);
  });

  it("returns null when any input is missing, never a partial guess", () => {
    expect(basalMetabolicRate(profile({ sex: null }), TODAY)).toBeNull();
    expect(basalMetabolicRate(profile({ height_cm: null }), TODAY)).toBeNull();
    expect(basalMetabolicRate(profile({ weight_kg: null }), TODAY)).toBeNull();
    expect(basalMetabolicRate(profile({ birth_year: null }), TODAY)).toBeNull();
  });

  it("returns null for out-of-range anthropometrics", () => {
    expect(basalMetabolicRate(profile({ height_cm: 40 }), TODAY)).toBeNull();
    expect(basalMetabolicRate(profile({ weight_kg: 500 }), TODAY)).toBeNull();
  });
});

describe("the calorie floor", () => {
  // The regression this whole module exists for. Cal AI shipped 569/900/1250 kcal targets and
  // collected one-star reviews citing Harvard; see the header of targets.ts.
  it("never returns below the female floor, however aggressive the inputs", () => {
    const p = profile({
      sex: "female", goal: "lose", pace: "push", activity: "sedentary",
      height_cm: 150, weight_kg: 45, birth_year: 1960,
    });
    const { targets, basis } = explainTargets(p, TODAY);
    expect(targets.kcal).toBeGreaterThanOrEqual(KCAL_FLOOR.female);
    expect(basis.floorApplied).toBe(true);
  });

  it("never returns below the male floor", () => {
    const p = profile({
      sex: "male", goal: "lose", pace: "push", activity: "sedentary",
      height_cm: 160, weight_kg: 55, birth_year: 1955,
    });
    expect(explainTargets(p, TODAY).targets.kcal).toBeGreaterThanOrEqual(KCAL_FLOOR.male);
  });

  it("uses the HIGHER floor when sex is unknown, because guessing low is the harmful way", () => {
    const p = profile({ sex: null, goal: "lose" });
    expect(explainTargets(p, TODAY).basis.floorKcal).toBe(KCAL_FLOOR_UNKNOWN);
  });

  it("reports floorApplied=false when the floor did not bind", () => {
    const p = profile({ sex: "male", goal: "lose", weight_kg: 95, height_cm: 185, activity: "moderate" });
    const { targets, basis } = explainTargets(p, TODAY);
    expect(basis.floorApplied).toBe(false);
    expect(targets.kcal).toBeGreaterThan(KCAL_FLOOR.male);
  });

  it("applies the floor AFTER the share cap, not before", () => {
    // Order matters: flooring first and share-capping second would let the cap pull the number back
    // under the floor. Both guards fire for this user, and the floor must be the one that wins.
    const p = profile({
      sex: "female", goal: "lose", pace: "push", activity: "sedentary",
      height_cm: 152, weight_kg: 48, birth_year: 1958,
    });
    const { targets, basis } = explainTargets(p, TODAY);
    expect(basis.shareCapApplied).toBe(true);
    expect(basis.floorApplied).toBe(true);
    expect(targets.kcal).toBe(KCAL_FLOOR.female);
  });
});

describe("the deficit share cap", () => {
  it("never subtracts more than 20% of maintenance", () => {
    const p = profile({ sex: "male", goal: "lose", pace: "push", activity: "sedentary", weight_kg: 90, height_cm: 180 });
    const { basis } = explainTargets(p, TODAY);
    expect(basis.tdee).not.toBeNull();
    expect(Math.abs(basis.appliedDeltaKcal)).toBeLessThanOrEqual(Math.round(basis.tdee! * 0.2));
  });

  it("scales with the person — a bigger user gets a bigger absolute deficit", () => {
    const small = explainTargets(profile({ sex: "female", goal: "lose", weight_kg: 55, height_cm: 158 }), TODAY);
    const large = explainTargets(profile({ sex: "male", goal: "lose", weight_kg: 110, height_cm: 190 }), TODAY);
    expect(Math.abs(large.basis.appliedDeltaKcal)).toBeGreaterThan(Math.abs(small.basis.appliedDeltaKcal));
  });

  it("caps a surplus tighter than a deficit", () => {
    const p = profile({ sex: "male", goal: "gain", pace: "push", activity: "sedentary", weight_kg: 70, height_cm: 178 });
    const { basis } = explainTargets(p, TODAY);
    expect(basis.appliedDeltaKcal).toBeGreaterThan(0);
    expect(basis.appliedDeltaKcal).toBeLessThanOrEqual(Math.round(basis.tdee! * 0.15));
  });

  it("applies no delta at all when maintaining", () => {
    const { basis } = explainTargets(profile({ goal: "maintain" }), TODAY);
    expect(basis.requestedDeltaKcal).toBe(0);
    expect(basis.appliedDeltaKcal).toBe(0);
  });

  it("moves faster on push than on easy", () => {
    const base = { sex: "male", goal: "lose", weight_kg: 95, height_cm: 185, activity: "moderate" } as const;
    const easy = explainTargets(profile({ ...base, pace: "easy" }), TODAY);
    const push = explainTargets(profile({ ...base, pace: "push" }), TODAY);
    expect(push.targets.kcal).toBeLessThan(easy.targets.kcal);
  });
});

describe("fallback band", () => {
  it("falls back to a flat goal band when anthropometrics are unknown", () => {
    const { targets, basis } = explainTargets(profile({ sex: null, birth_year: null, height_cm: null }), TODAY);
    expect(basis.usedFallbackBand).toBe(true);
    expect(basis.bmr).toBeNull();
    expect(targets.kcal).toBe(2100); // maintain band, unchanged from eait
  });

  it("floors the fallback band too", () => {
    // The bands sit above every floor today. This asserts the guard survives someone editing one.
    const { targets } = explainTargets(profile({ sex: "female", goal: "lose", birth_year: null }), TODAY);
    expect(targets.kcal).toBeGreaterThanOrEqual(KCAL_FLOOR.female);
  });
});

describe("checkTargetWeight", () => {
  it("refuses a target below the healthy BMI band", () => {
    const res = checkTargetWeight(40, 170);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toBe("below-healthy-bmi");
      // 18.5 * 1.7^2 = 53.5 -> ceil 54
      expect(res.minHealthyKg).toBe(54);
      expect(bmi(res.minHealthyKg, 170)!).toBeGreaterThanOrEqual(MIN_TARGET_BMI);
    }
  });

  it("accepts a target inside the band", () => {
    expect(checkTargetWeight(65, 170).ok).toBe(true);
  });

  it("cannot check without a height, and says so by passing", () => {
    // Onboarding asks height before target weight, so this is the partial-profile case only.
    expect(checkTargetWeight(35, null).ok).toBe(true);
  });
});

describe("protein target", () => {
  it("anchors to the GOAL weight when cutting", () => {
    const cutting = targetsFor(profile({ goal: "lose", weight_kg: 90, target_weight_kg: 75 }), TODAY);
    expect(cutting.protein_g).toBe(120); // 75 * 1.6
  });

  it("anchors to current bodyweight otherwise", () => {
    const gaining = targetsFor(profile({ goal: "gain", weight_kg: 70, target_weight_kg: 80 }), TODAY);
    expect(gaining.protein_g).toBe(112); // 70 * 1.6
  });

  it("clamps at both ends", () => {
    expect(targetsFor(profile({ goal: "maintain", weight_kg: 40 }), TODAY).protein_g).toBe(80);
    expect(targetsFor(profile({ goal: "maintain", weight_kg: 200 }), TODAY).protein_g).toBe(180);
  });
});

describe("restriction caps", () => {
  it("attaches a cap only for a declared restriction", () => {
    const none = targetsFor(profile(), TODAY);
    expect(none.satfat_g).toBeUndefined();
    expect(none.sodium_mg).toBeUndefined();

    const ldl = targetsFor(profile({ restrictions: ["ldl"] }), TODAY);
    expect(ldl.satfat_g).toBe(13);
    expect(ldl.sodium_mg).toBeUndefined();

    const both = targetsFor(profile({ restrictions: ["ldl", "kidneys"] }), TODAY);
    expect(both.satfat_g).toBe(13);
    expect(both.sodium_mg).toBe(2000);
  });

  it("does not let a non-medical tag unlock a cap", () => {
    const t = targetsFor(profile({ restrictions: ["vegan", "lowsugar"] }), TODAY);
    expect(t.satfat_g).toBeUndefined();
    expect(t.sodium_mg).toBeUndefined();
  });
});

describe("visibleVerdicts", () => {
  it("drops a medical verdict the user never declared", () => {
    const out = visibleVerdicts({ weight: "good", ldl: "bad", kidneys: "warn" }, []);
    expect(out).toEqual({ weight: "good" });
  });

  it("keeps only the declared dimension", () => {
    const out = visibleVerdicts({ weight: "good", ldl: "bad", kidneys: "warn" }, ["ldl"]);
    expect(out).toEqual({ weight: "good", ldl: "bad" });
  });

  it("never gates weight", () => {
    expect(visibleVerdicts({ weight: "bad" }, [])).toEqual({ weight: "bad" });
  });

  it("does not let lowsugar or vegan open a medical dimension", () => {
    const out = visibleVerdicts({ weight: "good", ldl: "bad" }, ["lowsugar", "vegan"]);
    expect(out).toEqual({ weight: "good" });
  });
});

describe("verdictsFromTargets", () => {
  const targets = { kcal: 2000, protein_g: 120, satfat_g: 13, sodium_mg: 2000 };

  it("judges by share of the day's allowance", () => {
    expect(verdictsFromTargets({ kcal: 500, satfat_g: 2, sodium_mg: 300 }, targets).weight).toBe("good");
    expect(verdictsFromTargets({ kcal: 800, satfat_g: 2, sodium_mg: 300 }, targets).weight).toBe("warn");
    expect(verdictsFromTargets({ kcal: 1200, satfat_g: 2, sodium_mg: 300 }, targets).weight).toBe("bad");
  });

  it("produces no medical verdict when the cap is absent", () => {
    const out = verdictsFromTargets({ kcal: 500, satfat_g: 40, sodium_mg: 5000 }, { kcal: 2000, protein_g: 120 });
    expect(out.ldl).toBeUndefined();
    expect(out.kidneys).toBeUndefined();
  });

  it("is deterministic after an edit — the point of computing rather than asking the model", () => {
    const before = verdictsFromTargets({ kcal: 400, satfat_g: 2, sodium_mg: 100 }, targets);
    const after = verdictsFromTargets({ kcal: 1400, satfat_g: 20, sodium_mg: 100 }, targets);
    expect(before.weight).toBe("good");
    expect(after.weight).toBe("bad");
    expect(after.ldl).toBe("bad");
  });
});

describe("weightRemainingKg", () => {
  it("is positive when there is weight still to lose", () => {
    expect(weightRemainingKg(profile({ weight_kg: 93, target_weight_kg: 92 }))).toBe(1);
  });

  it("is negative when gaining", () => {
    expect(weightRemainingKg(profile({ weight_kg: 70, target_weight_kg: 78 }))).toBe(-8);
  });

  it("is null when either weight is unknown", () => {
    expect(weightRemainingKg(profile({ weight_kg: null }))).toBeNull();
  });
});
