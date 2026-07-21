import { describe, expect, test } from "bun:test";
import { parseRestrictions, targetsFor } from "./targets.ts";
import type { Goal, Profile } from "./types.ts";

function profile(goal: Goal | null, restrictions: string[] = []): Profile {
  return { telegram_id: 1, lang: "ru", goal, restrictions };
}

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
