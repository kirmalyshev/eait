import { describe, expect, test } from "bun:test";
import { parseRestrictions, targetsFor, isRestrictionTag, RESTRICTION_TAGS } from "./targets.ts";
import type { Goal, Profile } from "./types.ts";

function profile(goal: Goal | null, restrictions: string[] = []): Profile {
  return { telegram_id: 1, lang: "ru", goal, restrictions };
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
