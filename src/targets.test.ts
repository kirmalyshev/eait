import { describe, expect, test } from "bun:test";
import {
  parseRestrictions,
  targetsFor,
  isRestrictionTag,
  weightRemainingKg,
  RESTRICTION_TAGS,
} from "./targets.ts";
import type { Goal, Profile } from "./types.ts";

function profile(goal: Goal | null, restrictions: string[] = []): Profile {
  return { telegram_id: 1, lang: "ru", goal, restrictions, reply_format: null };
}

describe("targetsFor — known weight drives the protein target", () => {
  // 1.6 g/kg — the low end of the sports-nutrition consensus band, clamped so an extreme
  // bodyweight cannot produce an absurd target. Unknown weight keeps the flat 100 g baseline.
  test("protein = 1.6 g/kg rounded", () => {
    expect(targetsFor({ ...profile("maintain"), weight_kg: 92.5 }).protein_g).toBe(148);
    // a non-integer product, so round-vs-floor is actually exercised (91.6 × 1.6 = 146.56)
    expect(targetsFor({ ...profile("maintain"), weight_kg: 91.6 }).protein_g).toBe(147);
  });
  test("clamped to [80, 180]", () => {
    expect(targetsFor({ ...profile("maintain"), weight_kg: 40 }).protein_g).toBe(80);
    expect(targetsFor({ ...profile("maintain"), weight_kg: 140 }).protein_g).toBe(180);
  });
  test("null or absent weight keeps the 100 g baseline", () => {
    expect(targetsFor({ ...profile("maintain"), weight_kg: null }).protein_g).toBe(100);
    expect(targetsFor(profile("maintain")).protein_g).toBe(100);
  });
});

describe("targetsFor — a target weight anchors protein when cutting", () => {
  // Cutting on a deficit risks lean mass, so protein is set to the GOAL weight, not the current
  // one. Other goals keep anchoring to current bodyweight. Kcal (KCAL_BY_GOAL) is unaffected.
  test("cutting with a target anchors protein to the target, not current", () => {
    // round(85 × 1.6) = 136, not round(92 × 1.6) = 147
    expect(targetsFor({ ...profile("lose"), weight_kg: 92, target_weight_kg: 85 }).protein_g).toBe(136);
  });
  test("maintain/gain anchor protein to current weight even with a target set", () => {
    expect(targetsFor({ ...profile("maintain"), weight_kg: 92, target_weight_kg: 85 }).protein_g).toBe(147);
    expect(targetsFor({ ...profile("gain"), weight_kg: 80, target_weight_kg: 90 }).protein_g).toBe(128);
  });
  test("cutting with no target still anchors to current weight", () => {
    expect(targetsFor({ ...profile("lose"), weight_kg: 92 }).protein_g).toBe(147);
  });
  test("cutting with a target but no current weight anchors to the target", () => {
    expect(targetsFor({ ...profile("lose"), weight_kg: null, target_weight_kg: 85 }).protein_g).toBe(136);
  });
  test("the anchored protein is still clamped to [80, 180]", () => {
    expect(targetsFor({ ...profile("lose"), weight_kg: 60, target_weight_kg: 40 }).protein_g).toBe(80);
  });
  test("kcal is unchanged by a target weight (no invented deficit)", () => {
    expect(targetsFor({ ...profile("lose"), weight_kg: 92, target_weight_kg: 85 }).kcal).toBe(1800);
  });
});

describe("weightRemainingKg — signed distance to the target", () => {
  test("positive when there is weight to lose", () => {
    expect(weightRemainingKg({ ...profile("lose"), weight_kg: 92, target_weight_kg: 85 })).toBe(7);
  });
  test("negative when there is weight to gain", () => {
    expect(weightRemainingKg({ ...profile("gain"), weight_kg: 80, target_weight_kg: 90 })).toBe(-10);
  });
  test("zero at the target", () => {
    expect(weightRemainingKg({ ...profile("maintain"), weight_kg: 85, target_weight_kg: 85 })).toBe(0);
  });
  test("rounded to 0.1 kg", () => {
    expect(weightRemainingKg({ ...profile("lose"), weight_kg: 92.5, target_weight_kg: 85 })).toBe(7.5);
  });
  test("null when either weight is unknown", () => {
    expect(weightRemainingKg({ ...profile("lose"), weight_kg: 92 })).toBeNull();
    expect(weightRemainingKg({ ...profile("lose"), target_weight_kg: 85 })).toBeNull();
    expect(weightRemainingKg(profile("lose"))).toBeNull();
  });
});

describe("targetsFor — goal drives kcal, protein baseline is 100", () => {
  test("lose", () => {
    const t = targetsFor(profile("lose"));
    expect(t.kcal).toBe(1800);
    expect(t.protein_g).toBe(100);
  });
  test("maintain", () => {
    expect(targetsFor(profile("maintain")).kcal).toBe(2100);
  });
  test("gain", () => {
    expect(targetsFor(profile("gain")).kcal).toBe(2400);
  });
  test("null goal defaults to maintain band", () => {
    expect(targetsFor(profile(null)).kcal).toBe(2100);
  });
});

describe("targetsFor — restrictions tighten caps only when relevant", () => {
  test("ldl adds a saturated-fat cap of 13g", () => {
    const t = targetsFor(profile("maintain", ["ldl"]));
    expect(t.satfat_g).toBe(13);
    expect(t.sodium_mg).toBeUndefined();
  });
  test("kidneys adds a sodium cap of 2000mg", () => {
    const t = targetsFor(profile("maintain", ["kidneys"]));
    expect(t.sodium_mg).toBe(2000);
    expect(t.satfat_g).toBeUndefined();
  });
  test("both caps when both restrictions present", () => {
    const t = targetsFor(profile("lose", ["ldl", "kidneys"]));
    expect(t.satfat_g).toBe(13);
    expect(t.sodium_mg).toBe(2000);
  });
  test("no restrictions -> no caps (generic)", () => {
    const t = targetsFor(profile("maintain", []));
    expect(t.satfat_g).toBeUndefined();
    expect(t.sodium_mg).toBeUndefined();
  });
  test("an unrelated restriction (vegan) adds no numeric cap", () => {
    const t = targetsFor(profile("maintain", ["vegan"]));
    expect(t.satfat_g).toBeUndefined();
    expect(t.sodium_mg).toBeUndefined();
  });
});

describe("parseRestrictions — ru + en keyword map, unknowns dropped", () => {
  test("russian free text", () => {
    expect(parseRestrictions("почки, без сахара")).toEqual(["kidneys", "lowsugar"]);
  });
  test("english free text (tags come back in the fixed map order)", () => {
    expect(parseRestrictions("vegan, high cholesterol")).toEqual(["ldl", "vegan"]);
  });
  test("mixed + inflected forms", () => {
    expect(parseRestrictions("проблемы с почками и холестерин")).toEqual(["kidneys", "ldl"]);
  });
  test("unknown words are dropped", () => {
    expect(parseRestrictions("pizza and beer")).toEqual([]);
  });
  test("empty / skip", () => {
    expect(parseRestrictions("")).toEqual([]);
    expect(parseRestrictions("   ")).toEqual([]);
  });
  test("no duplicate tags", () => {
    expect(parseRestrictions("kidney kidneys почки")).toEqual(["kidneys"]);
  });
  test("stable tag order regardless of input order", () => {
    expect(parseRestrictions("sugar, kidney, ldl")).toEqual(["kidneys", "ldl", "lowsugar"]);
  });
});

describe("isRestrictionTag", () => {
  test("accepts every tag in the exported vocabulary", () => {
    expect(RESTRICTION_TAGS.length).toBeGreaterThan(0);
    for (const tag of RESTRICTION_TAGS) expect(isRestrictionTag(tag)).toBe(true);
  });

  test("rejects anything outside it", () => {
    // The guard is what stops a stale stored tag, or a hallucinated one from the LLM
    // classifier, reaching the user as a raw identifier.
    for (const v of ["", "kidney ", "KIDNEY", "made-up", "__proto__", "toString"]) {
      expect(isRestrictionTag(v)).toBe(false);
    }
  });
});
