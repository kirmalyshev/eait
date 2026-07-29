import { describe, expect, test } from "bun:test";
import {
  parseRestrictions,
  targetsFor,
  isRestrictionTag,
  weightRemainingKg,
  visibleVerdicts,
  verdictsFromTargets,
  RESTRICTION_TAGS,
} from "./targets.ts";
import type { Goal, Profile } from "./types.ts";

function profile(goal: Goal | null, restrictions: string[] = []): Profile {
  return { telegram_id: 1, lang: "ru", goal, restrictions, medical_limitations: null, food_allergies: null, product_limitations: null, reply_format: null };
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

describe("visibleVerdicts", () => {
  // The gate that makes "only declared dimensions are judged" true regardless of what the model
  // returns — full rationale and the measured evidence live on `visibleVerdicts` itself.

  test("weight always survives — it applies to every user", () => {
    expect(visibleVerdicts({ weight: "good" }, [])).toEqual({ weight: "good" });
  });

  test("drops ldl and kidneys when the user declared neither", () => {
    expect(visibleVerdicts({ weight: "good", ldl: "bad", kidneys: "warn" }, [])).toEqual({
      weight: "good",
    });
  });

  test("an unrelated restriction does not unlock a medical verdict", () => {
    // lowsugar and vegan carry no verdict dimension of their own; they must not open ldl/kidneys.
    expect(visibleVerdicts({ ldl: "bad", kidneys: "bad" }, ["lowsugar", "vegan"])).toEqual({});
  });

  test("keeps exactly the declared dimensions", () => {
    expect(visibleVerdicts({ weight: "good", ldl: "bad", kidneys: "warn" }, ["ldl"])).toEqual({
      weight: "good",
      ldl: "bad",
    });
    expect(visibleVerdicts({ ldl: "bad", kidneys: "warn" }, ["kidneys"])).toEqual({
      kidneys: "warn",
    });
  });

  test("declaring a restriction cannot invent a verdict the model never gave", () => {
    expect(visibleVerdicts({}, ["ldl", "kidneys"])).toEqual({});
  });

  test("does not mutate the input", () => {
    const original = { weight: "good", ldl: "bad" } as const;
    const copy = { ...original };
    visibleVerdicts(copy, []);
    expect(copy).toEqual(original);
  });
});

describe("verdictsFromTargets — verdicts computed, not asked for", () => {
  const withTags = (restrictions: string[]): Profile => profile("maintain", restrictions);
  const meal = (over: Partial<{ kcal: number; satfat_g: number; sodium_mg: number }> = {}) =>
    ({ kcal: 100, satfat_g: 0, sodium_mg: 0, ...over });

  test("judges each dimension by its share of the day's allowance", () => {
    const t = targetsFor(withTags(["ldl", "kidneys"]));
    // satfat cap 13 g/day: 4 g is under a third, 5 g is over it, 7 g is over half.
    expect(verdictsFromTargets(meal({ satfat_g: 4 }), t).ldl).toBe("good");
    expect(verdictsFromTargets(meal({ satfat_g: 5 }), t).ldl).toBe("warn");
    expect(verdictsFromTargets(meal({ satfat_g: 7 }), t).ldl).toBe("bad");
    // sodium cap 2000 mg/day.
    expect(verdictsFromTargets(meal({ sodium_mg: 600 }), t).kidneys).toBe("good");
    expect(verdictsFromTargets(meal({ sodium_mg: 700 }), t).kidneys).toBe("warn");
    expect(verdictsFromTargets(meal({ sodium_mg: 1200 }), t).kidneys).toBe("bad");
  });

  test("weight always applies and is judged against the kcal target", () => {
    const t = targetsFor(withTags([]));
    expect(verdictsFromTargets(meal({ kcal: t.kcal * 0.2 }), t).weight).toBe("good");
    expect(verdictsFromTargets(meal({ kcal: t.kcal * 0.4 }), t).weight).toBe("warn");
    expect(verdictsFromTargets(meal({ kcal: t.kcal * 0.9 }), t).weight).toBe("bad");
  });

  test("an UNDECLARED dimension cannot be produced, even by accident", () => {
    // The cap is absent from `targets` exactly when the restriction was not declared, so the
    // undeclared dimension has nothing to be computed from. Structural, not a filter.
    const v = verdictsFromTargets(meal({ satfat_g: 99, sodium_mg: 9999 }), targetsFor(withTags([])));
    expect(v.ldl).toBeUndefined();
    expect(v.kidneys).toBeUndefined();
    expect(Object.keys(v)).toEqual(["weight"]);
  });

  test("declaring one restriction does not unlock the other", () => {
    const v = verdictsFromTargets(meal({ satfat_g: 99, sodium_mg: 9999 }), targetsFor(withTags(["ldl"])));
    expect(v.ldl).toBe("bad");
    expect(v.kidneys).toBeUndefined();
  });

  test("a substituted macro changes the verdict — the whole point (D)", () => {
    // The staleness this replaces: the model reported 5 g of saturated fat and called it good, a
    // lookup revised it to 20 g, and the reassuring verdict stayed attached to a number that no
    // longer existed. Recomputed, the verdict follows the macro.
    const t = targetsFor(withTags(["ldl"]));
    expect(verdictsFromTargets(meal({ satfat_g: 4 }), t).ldl).toBe("good");
    expect(verdictsFromTargets(meal({ satfat_g: 20 }), t).ldl).toBe("bad");
  });
});
