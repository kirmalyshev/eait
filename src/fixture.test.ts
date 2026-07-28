import { describe, expect, test } from "bun:test";
import {
  FOOD_TABLE,
  buildExpectation,
  lookupFood,
  normalize,
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
    const c = parseComponent("  olive oil :  12  ");
    expect(c.grams).toBe(12);
    // The name must be trimmed too — an untrimmed "olive oil " still resolves (normalize trims it)
    // but is what gets echoed back in errors and printed in the CLI breakdown.
    expect(c.name).toBe("olive oil");
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

  test("grams parsing is STRICT — a decimal comma or a unit suffix is refused, not truncated", () => {
    // The reason `Number` is used rather than `parseFloat`, pinned so a future tidy-up cannot
    // quietly swap it: parseFloat reads "12,5" as 12 and "180g" as 180. A European decimal comma
    // is the single most likely thing to be typed here, and silently losing the .5 turns a correct
    // weight into a wrong one with no error anywhere.
    expect(() => parseComponent("olive oil: 12,5")).toThrow(/grams/);
    expect(() => parseComponent("olive oil: 180g")).toThrow(/grams/);
    expect(() => parseComponent("olive oil: 12 g extra")).toThrow(/grams/);
  });

  test("an @ on the wrong side of the colon is refused, not absorbed into the name", () => {
    // Otherwise `normalize` strips it, the table lookup succeeds, and the user silently gets the
    // generic row while believing they supplied a package label.
    expect(() => parseComponent("olive oil @: 100")).toThrow(/@ in the food name/);
  });

  test("more than one @ is refused", () => {
    expect(() => parseComponent("x: 100 @ 40 @ 50")).toThrow(/more than one @/);
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
    // Uses the REAL `normalize`, not a copy of its regex. Re-implementing the key function here
    // would test the copy: loosening `normalize` so that "milk 3.5%" and "milk 1.5%" collapse to
    // one key is exactly the regression this test exists to catch, and an inline copy cannot see it.
    const seen = new Set<string>();
    for (const entry of FOOD_TABLE) {
      for (const key of [entry.name, ...(entry.aliases ?? [])]) {
        expect(seen.has(normalize(key))).toBe(false);
        seen.add(normalize(key));
      }
    }
  });

  test("normalize keeps the digits that separate one fat grade from another", () => {
    expect(normalize("milk 3.5%")).not.toBe(normalize("milk 1.5%"));
    expect(normalize("Rice, Cooked")).toBe(normalize("rice cooked"));
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
  test("finds the intended entry behind a typo in a SINGLE-token query", () => {
    // Single token on purpose. "chiken breast" passes even with fuzzy matching disabled entirely,
    // because the exact token "breast" carries it — so the two-word query tests nothing about the
    // edit-distance path. Every line of editDistance/tokenMatches hangs off this assertion.
    expect(suggestFoods("chiken")).toContain("chicken breast");
  });

  test("tolerates two typos in a longer word, one in a shorter", () => {
    expect(suggestFoods("chikcen")).toContain("chicken breast"); // 7 chars → budget 2
    expect(suggestFoods("aple")).toContain("apple"); // 4 chars → budget 1
    // Plain Levenshtein, so a TRANSPOSITION costs 2, not 1: "appel" is over budget for a 5-letter
    // word and suggests nothing. Accepted — this only degrades an error message, never a number —
    // but asserted so the limit is known rather than discovered.
    expect(suggestFoods("appel")).toEqual([]);
  });

  test("finds entries by a partial name", () => {
    expect(suggestFoods("rice")).toContain("rice, cooked");
  });

  test("best match first, capped at five, no duplicates", () => {
    // An entry reachable by both its name and an alias must appear once, and the ranking must put
    // the exact hit on top — a suggestion list that buries the right answer at position four is
    // barely better than none.
    expect(suggestFoods("beef mince 15%")[0]).toBe("beef mince 15%");
    const many = suggestFoods("cooked");
    expect(many).toHaveLength(5);
    expect(new Set(many).size).toBe(many.length);
  });

  test("a short token does not match half the table", () => {
    // "in" inside "tuna, canned in water" must not make every query containing "in" match it.
    expect(suggestFoods("instant noodles")).toEqual([]);
    expect(suggestFoods("a")).toEqual([]);
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

  test("keeps the component NAMES, in order (#A0)", () => {
    // The weighed path parsed each name and then summed it away, exactly like the NutritionVerse
    // adapter did. Recording twenty meals on a kitchen scale before this fix would have thrown the
    // names away at write time — the most expensive ground truth here, unrecoverable without
    // weighing them again.
    const e = buildExpectation(["chicken breast: 200", "rice, cooked: 200"]);
    expect(e.items).toEqual(["chicken breast", "rice, cooked"]);
  });

  test("carries the name a per-100g override was given under, not the override text", () => {
    const e = buildExpectation(["babushka's borscht: 300 @ 45/1.5/4/2.5"]);
    expect(e.items).toEqual(["babushka's borscht"]);
  });

  test("sums macros when every component declares them", () => {
    const e = buildExpectation(["chicken breast: 100", "rice, cooked: 100"]);
    expect(e.protein_g).toBeCloseTo(31 + 2.7, 1);
    expect(e.carbs_g).toBeCloseTo(0 + 28, 1);
  });

  test("OMITS a macro even when the incomplete component comes FIRST", () => {
    // The order that actually exercises the sticky-undefined guard. With the incomplete component
    // last, a naive `(sum ?? 0) + value` accumulator produces the same answer by luck; with it
    // first, that accumulator resurrects the macro and writes a partial sum as complete ground
    // truth — the fabricated-result mode this module exists to prevent.
    const e = buildExpectation(["mystery stew: 300 @ 150", "chicken breast: 100"]);
    expect(e.kcal).toBe(450 + 165);
    expect(e.protein_g).toBeUndefined();
    expect(e.carbs_g).toBeUndefined();
    expect(e.fat_g).toBeUndefined();
  });

  test("an omitted macro is ABSENT from the object, not present-as-undefined", () => {
    // `toBeUndefined` passes either way. The fixture is written with JSON.stringify and read back
    // through ExpectationSchema, so a key present with an undefined value is a different fixture.
    // Nothing else enforces this: zod does NOT strip an explicit undefined, and
    // exactOptionalPropertyTypes is off repo-wide — the `flatMap` is the only guard.
    const e = buildExpectation(["chicken breast: 100", "mystery stew: 300 @ 150"]);
    expect("protein_g" in e).toBe(false);
    // `items` is unconditional — a weighed meal always has at least one named component (an empty
    // spec list throws upstream), so it is never the present-as-undefined case this test guards.
    expect(Object.keys(e).sort()).toEqual(["items", "kcal", "total_grams"]);
    expect(JSON.parse(JSON.stringify(e))).toEqual(e);
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

  test("the schema is enforced at the exit, not merely referenced", () => {
    // 0.04 g rounds to a total_grams of 0, which ExpectationSchema rejects as non-positive. No
    // hand-written guard covers this — deleting the parse makes it return {kcal:40,total_grams:0},
    // ground truth the eval would divide by. The named message is part of the contract: a raw zod
    // dump names a field the user never typed.
    expect(() => buildExpectation(["x: 0.04 @ 100000"])).toThrow(/usable ground truth/);
  });

  test("total_grams is rounded to one decimal like every other ground-truth number", () => {
    // 12.55 + 100 = 112.55; unrounded it would serialize as 112.55 and differ in precision from a
    // Nutrition5k fixture in the same report.
    expect(buildExpectation(["olive oil: 12.55", "chicken breast: 100"]).total_grams).toBe(112.6);
  });

  test("rejects a meal whose components sum to zero kcal", () => {
    // ExpectationSchema demands positive kcal (a zero would break MAPE); catching it here names
    // the actual cause instead of surfacing a schema error about a field the user never typed.
    expect(() => buildExpectation(["black coffee: 200 @ 0"])).toThrow(/0 kcal/);
  });
});
