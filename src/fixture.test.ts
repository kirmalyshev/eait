import { describe, expect, test } from "bun:test";
import {
  FOOD_TABLE,
  buildExpectation,
  lookupFood,
  parseComponent,
  suggestFoods,
} from "./fixture.ts";
import { ExpectationSchema } from "./eval.ts";

describe("parseComponent — table form", () => {
  test("'<food>: <grams>' resolves per-100g from the table", () => {
    const c = parseComponent("olive oil: 12");
    expect(c.name).toBe("olive oil");
    expect(c.grams).toBe(12);
    expect(c.per100.kcal).toBe(884);
  });

  test("tolerates surrounding and inner whitespace", () => {
    expect(parseComponent("  olive oil :  12  ").grams).toBe(12);
  });

  test("accepts a fractional weight — kitchen scales read 0.1 g", () => {
    expect(parseComponent("olive oil: 12.5").grams).toBe(12.5);
  });

  test("matching is normalized: case, commas and extra spaces do not matter", () => {
    expect(parseComponent("Rice, Cooked: 200").per100.kcal).toBe(
      parseComponent("rice cooked: 200").per100.kcal,
    );
  });

  test("an alias resolves to the same entry as its canonical name", () => {
    expect(parseComponent("quark 5%: 100").per100).toEqual(parseComponent("tvorog 5%: 100").per100);
  });
});

describe("parseComponent — inline per-100g override", () => {
  // The escape hatch for anything the table does not carry: composite/branded foods, where the
  // package label is BETTER ground truth than any generic table row.
  test("'@ <kcal>' sets kcal only", () => {
    const c = parseComponent("pelmeni: 250 @ 275");
    expect(c.per100).toEqual({ kcal: 275 });
    expect(c.grams).toBe(250);
    expect(c.name).toBe("pelmeni");
  });

  test("'@ kcal/protein/carbs/fat' sets the full composition", () => {
    const c = parseComponent("kefir 1%: 250 @ 40/3.4/4/1");
    expect(c.per100).toEqual({ kcal: 40, protein_g: 3.4, carbs_g: 4, fat_g: 1 });
  });

  test("an inline override wins over a table entry of the same name", () => {
    // A specific package label beats a generic table row, and the user typing one means they have it.
    expect(parseComponent("olive oil: 10 @ 900").per100.kcal).toBe(900);
  });

  test("rejects a partial macro list — 3 of 4 is a typo, not a request to guess", () => {
    expect(() => parseComponent("x: 100 @ 40/3.4/4")).toThrow(/kcal or kcal\/protein\/carbs\/fat/);
  });

  test("rejects a non-numeric or negative composition", () => {
    expect(() => parseComponent("x: 100 @ abc")).toThrow(/per-100g/);
    expect(() => parseComponent("x: 100 @ -5")).toThrow(/per-100g/);
  });

  test("rejects a BLANK field rather than reading it as zero", () => {
    // `Number("")` is 0, so a slipped keystroke would otherwise become real ground truth: "40//4/1"
    // silently declares zero protein, and a bare "@" silently declares a zero-calorie food. Both
    // are the same silent-zero defect an unknown ingredient is already protected from — a blank is
    // a typo, and a typo must never be readable as a measurement.
    expect(() => parseComponent("x: 100 @ 40//4/1")).toThrow(/blank/);
    expect(() => parseComponent("x: 100 @ /3.4/4/1")).toThrow(/blank/);
    expect(() => parseComponent("x: 100 @")).toThrow(/blank/);
    expect(() => parseComponent("x: 100 @   ")).toThrow(/blank/);
  });

  test("accepts a zero-kcal override — black coffee and water are real meal components", () => {
    expect(parseComponent("black coffee: 200 @ 0").per100.kcal).toBe(0);
  });
});

describe("parseComponent — rejects malformed input rather than guessing", () => {
  test("no colon", () => {
    expect(() => parseComponent("olive oil 12")).toThrow(/<food>: <grams>/);
  });

  test("non-numeric grams", () => {
    expect(() => parseComponent("olive oil: some")).toThrow(/grams/);
  });

  test("zero or negative grams", () => {
    expect(() => parseComponent("olive oil: 0")).toThrow(/grams/);
    expect(() => parseComponent("olive oil: -5")).toThrow(/grams/);
  });

  test("empty food name", () => {
    expect(() => parseComponent(": 100")).toThrow(/food name/);
  });

  test("an unknown food is an error carrying suggestions, never a silent zero", () => {
    // Silently scoring an unknown ingredient as 0 kcal would understate the ground truth and make
    // the model look like it over-estimates — the exact bias this eval exists to measure.
    expect(() => parseComponent("chiken breast: 180")).toThrow(/not in the food table/);
    expect(() => parseComponent("chiken breast: 180")).toThrow(/chicken breast/);
  });
});

describe("lookupFood", () => {
  test("finds every canonical name and every alias in the shipped table", () => {
    for (const entry of FOOD_TABLE) {
      expect(lookupFood(entry.name)).toBeDefined();
      for (const alias of entry.aliases ?? []) expect(lookupFood(alias)).toBe(entry.per100);
    }
  });

  test("returns undefined for a miss", () => {
    expect(lookupFood("dragonfruit sorbet")).toBeUndefined();
  });
});

describe("FOOD_TABLE integrity", () => {
  test("no duplicate names or aliases — a duplicate silently shadows one entry", () => {
    const seen = new Set<string>();
    for (const entry of FOOD_TABLE) {
      for (const key of [entry.name, ...(entry.aliases ?? [])]) {
        const norm = key.toLowerCase().replace(/[^a-z0-9%]+/g, " ").trim();
        expect(seen.has(norm)).toBe(false);
        seen.add(norm);
      }
    }
  });

  test("every entry declares all four macros, so a table-only meal reports every macro", () => {
    for (const entry of FOOD_TABLE) {
      expect(entry.per100.kcal).toBeGreaterThanOrEqual(0);
      for (const macro of ["protein_g", "carbs_g", "fat_g"] as const) {
        expect(entry.per100[macro]).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test("declared macros are energetically consistent with the declared kcal", () => {
    // 4/4/9/7 Atwater (the 7 is ethanol — without it every alcoholic entry looks broken). Not a
    // precision check: fibre digests below 4 kcal/g, so vegetables always read high, and rounding
    // moves everything. The tolerance is therefore `max(15 kcal, 25%)` — the absolute floor lets
    // low-calorie, high-fibre foods pass, while the percentage still catches a transposed digit in
    // a calorie-dense one (olive oil at 84, chicken breast at 310). This is the guard that stops a
    // typo in ground-truth data from being read as model error forever.
    for (const entry of FOOD_TABLE) {
      const { kcal, protein_g = 0, carbs_g = 0, fat_g = 0, alcohol_g = 0 } = entry.per100;
      const atwater = protein_g * 4 + carbs_g * 4 + fat_g * 9 + alcohol_g * 7;
      expect(Math.abs(atwater - kcal)).toBeLessThanOrEqual(Math.max(15, kcal * 0.25));
    }
  });
});

describe("suggestFoods", () => {
  test("finds the intended entry behind a typo", () => {
    expect(suggestFoods("chiken breast")).toContain("chicken breast");
  });

  test("finds entries by a partial name", () => {
    expect(suggestFoods("rice")).toContain("rice, cooked");
  });

  test("returns an empty list rather than noise when nothing is close", () => {
    expect(suggestFoods("zzzzqqqq")).toEqual([]);
  });
});

describe("buildExpectation", () => {
  test("sums kcal and grams across components", () => {
    // chicken breast 165/100g × 200g = 330; rice 130/100g × 200g = 260 → 590 kcal, 400 g
    const e = buildExpectation(["chicken breast: 200", "rice, cooked: 200"]);
    expect(e.kcal).toBe(590);
    expect(e.total_grams).toBe(400);
  });

  test("scales a fractional weight correctly", () => {
    expect(buildExpectation(["olive oil: 12.5"]).kcal).toBe(Math.round(884 * 0.125));
  });

  test("sums macros when every component declares them", () => {
    const e = buildExpectation(["chicken breast: 100", "rice, cooked: 100"]);
    expect(e.protein_g).toBeCloseTo(31 + 2.7, 1);
    expect(e.carbs_g).toBeCloseTo(0 + 28, 1);
  });

  test("OMITS a macro no component can be summed for", () => {
    // A partial sum would be ground truth that is wrong LOW, and the eval would report the gap as
    // model error. Absent is the only honest answer; ExpectationSchema makes macros optional
    // precisely so this case has somewhere to land.
    const e = buildExpectation(["chicken breast: 100", "mystery stew: 300 @ 150"]);
    expect(e.kcal).toBe(165 + 450);
    expect(e.protein_g).toBeUndefined();
    expect(e.carbs_g).toBeUndefined();
    expect(e.fat_g).toBeUndefined();
    expect(e.total_grams).toBe(400);
  });

  test("a macro survives when every component declares that one macro", () => {
    const e = buildExpectation(["chicken breast: 100", "shake: 100 @ 150/30/5/1"]);
    expect(e.protein_g).toBeCloseTo(31 + 30, 1);
    expect(e.fat_g).toBeCloseTo(3.6 + 1, 1);
  });

  test("the result always validates as ground truth the eval can consume", () => {
    expect(() => ExpectationSchema.parse(buildExpectation(["apple: 150"]))).not.toThrow();
  });

  test("rounds kcal to an integer and macros/grams to one decimal", () => {
    const e = buildExpectation(["chicken breast: 137"]);
    expect(Number.isInteger(e.kcal)).toBe(true);
    expect(e.protein_g).toBe(Math.round(31 * 1.37 * 10) / 10);
  });

  test("rejects an empty component list", () => {
    expect(() => buildExpectation([])).toThrow(/at least one/);
  });

  test("rejects a meal whose components sum to zero kcal", () => {
    // ExpectationSchema demands positive kcal (a zero would break MAPE); catching it here names
    // the actual cause instead of surfacing a schema error about a field the user never typed.
    expect(() => buildExpectation(["black coffee: 200 @ 0"])).toThrow(/0 kcal/);
  });
});
