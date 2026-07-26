import { describe, expect, test } from "bun:test";
import {
  NUTRIENT_IDS,
  buildFoodIndex,
  normalizeFoodName,
  parseCsvLine,
  usdaFoodRow,
  type FoodRow,
} from "./food_db.ts";

describe("parseCsvLine — USDA quotes its fields and its names contain commas", () => {
  // A naive split(",") shifts every column after the first comma inside a name, so the food gets
  // another food's numbers. Nothing errors; the row is just silently wrong.
  test("keeps a quoted comma inside one field", () => {
    expect(parseCsvLine(`"167512","sr_legacy_food","Biscuits, Artificial Flavor, dough","18"`)).toEqual([
      "167512",
      "sr_legacy_food",
      "Biscuits, Artificial Flavor, dough",
      "18",
    ]);
  });

  test("handles empty fields, unquoted fields, and a trailing empty field", () => {
    expect(parseCsvLine(`"1","","x",,"2",`)).toEqual(["1", "", "x", "", "2", ""]);
  });

  test("unescapes a doubled quote", () => {
    expect(parseCsvLine(`"say ""hi""","2"`)).toEqual([`say "hi"`, "2"]);
  });

  test("a comma inside quotes is never a separator, even repeatedly", () => {
    expect(parseCsvLine(`"a,b,c","d"`)).toHaveLength(2);
  });
});

describe("normalizeFoodName — English is the lookup notation", () => {
  test("case, punctuation and spacing collapse to one key", () => {
    expect(normalizeFoodName("Buckwheat groats, roasted, cooked")).toBe("buckwheat groats roasted cooked");
    expect(normalizeFoodName("  CHICKEN   breast ")).toBe("chicken breast");
  });

  test("keeps digits and percent — they are fat grades, not noise", () => {
    expect(normalizeFoodName("Milk, 3.5% fat")).toContain("3");
    expect(normalizeFoodName("Milk, 1% fat")).not.toBe(normalizeFoodName("Milk, 2% fat"));
  });
});

describe("usdaFoodRow", () => {
  const nutrients = new Map([
    [NUTRIENT_IDS.kcal, 92],
    [NUTRIENT_IDS.protein_g, 3.38],
    [NUTRIENT_IDS.carbs_g, 19.94],
    [NUTRIENT_IDS.fat_g, 0.62],
    [NUTRIENT_IDS.fiber_g, 2.7],
    [NUTRIENT_IDS.sodium_mg, 4],
  ]);

  test("maps a food plus its nutrient amounts, per 100 g", () => {
    const row = usdaFoodRow("173688", "Buckwheat groats, roasted, cooked", nutrients);
    expect(row).not.toBeNull();
    expect(row!.id).toBe("usda:173688");
    expect(row!.name).toBe("Buckwheat groats, roasted, cooked");
    expect(row!.kcal).toBe(92);
    expect(row!.protein_g).toBe(3.4);
    expect(row!.fiber_g).toBe(2.7);
    // Absent nutrients are omitted, not zeroed — "not measured" and "contains none" differ, and a
    // zero would be summed into a user's daily total as fact.
    expect("satfat_g" in row!).toBe(false);
  });

  test("returns null when energy is missing — a food with no kcal cannot ground anything", () => {
    expect(usdaFoodRow("1", "Water", new Map([[NUTRIENT_IDS.protein_g, 0]]))).toBeNull();
  });

  test("returns null for a food whose energy is the kJ nutrient by mistake", () => {
    // 1062 is Energy in kJ. Reading it as kcal inflates every value 4.184x, silently.
    expect(usdaFoodRow("1", "X", new Map([[1062, 385]]))).toBeNull();
  });

  test("rejects negative amounts rather than storing them", () => {
    expect(usdaFoodRow("1", "X", new Map([[NUTRIENT_IDS.kcal, -5]]))).toBeNull();
  });
});

describe("buildFoodIndex — English lookup", () => {
  const rows: FoodRow[] = [
    { id: "usda:1", name: "Buckwheat groats, roasted, cooked", kcal: 92, protein_g: 3.4, carbs_g: 19.9, fat_g: 0.6 },
    { id: "usda:2", name: "Chicken, broilers or fryers, breast, meat only, cooked, roasted", kcal: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6 },
    { id: "usda:3", name: "Chicken, broilers or fryers, thigh, meat only, cooked, roasted", kcal: 179, protein_g: 24.8, carbs_g: 0, fat_g: 8.2 },
    { id: "usda:4", name: "Rice, white, long-grain, regular, cooked", kcal: 130, protein_g: 2.7, carbs_g: 28, fat_g: 0.3 },
    { id: "usda:5", name: "Rice, white, long-grain, regular, raw", kcal: 365, protein_g: 7.1, carbs_g: 80, fat_g: 0.7 },
  ];
  const index = buildFoodIndex(rows);

  test("an exact English name resolves", () => {
    expect(index.find("Buckwheat groats, roasted, cooked")?.id).toBe("usda:1");
  });

  test("a short natural name resolves to the right long USDA description", () => {
    // What the analyzer will actually emit, versus how USDA words it.
    expect(index.find("chicken breast, cooked")?.id).toBe("usda:2");
    expect(index.find("chicken thigh, roasted")?.id).toBe("usda:3");
  });

  test("COOKING STATE decides between otherwise identical foods", () => {
    // The 3x trap: matching "rice, cooked" to the raw row is a confident, precise, wrong answer.
    expect(index.find("rice, white, cooked")?.id).toBe("usda:4");
    expect(index.find("rice, white, raw")?.id).toBe("usda:5");
  });

  test("a qualifier that CHANGES the food disqualifies the row", () => {
    // Every one of these was a real wrong match from the first implementation against the actual
    // 7,928-row USDA index. They are the dangerous shape: a confident, precise, wrong number.
    // "Pepper, banana" is not a banana; "Sweet potato" is not a potato; breaded tenders are not
    // chicken breast. The rule is that a candidate's HEAD segment — the part before the first
    // comma, which is what USDA uses for food identity — may not introduce a word the query
    // never asked for.
    const trap = buildFoodIndex([
      { id: "usda:a", name: "Bananas, raw", kcal: 89, protein_g: 1.1, carbs_g: 22.8, fat_g: 0.3 },
      { id: "usda:b", name: "Pepper, banana, raw", kcal: 27, protein_g: 1.7, carbs_g: 5.4, fat_g: 0.5 },
      { id: "usda:c", name: "Potatoes, boiled, cooked without skin", kcal: 87, protein_g: 2, carbs_g: 20, fat_g: 0.1 },
      { id: "usda:d", name: "Sweet potato, cooked, boiled, without skin", kcal: 76, protein_g: 1.4, carbs_g: 17.7, fat_g: 0.1 },
      { id: "usda:e", name: "Chicken, broilers or fryers, breast, meat only, cooked, roasted", kcal: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6 },
      { id: "usda:f", name: "Chicken breast tenders, breaded, cooked, microwaved", kcal: 252, protein_g: 14, carbs_g: 18, fat_g: 13 },
    ]);
    expect(trap.find("banana, raw")?.id).toBe("usda:a");
    expect(trap.find("potato, boiled")?.id).toBe("usda:c");
    expect(trap.find("chicken breast, cooked")?.id).toBe("usda:e");
  });

  test("singular and plural are the same food", () => {
    // USDA pluralises its head nouns ("Bananas, raw", "Apples, raw") while a model emits the
    // singular. Without this the correct row is invisible and a wrong one wins by default.
    const plural = buildFoodIndex([
      { id: "usda:a", name: "Bananas, raw", kcal: 89, protein_g: 1.1, carbs_g: 22.8, fat_g: 0.3 },
      { id: "usda:b", name: "Lentils, mature seeds, cooked, boiled", kcal: 116, protein_g: 9, carbs_g: 20, fat_g: 0.4 },
    ]);
    expect(plural.find("banana, raw")?.id).toBe("usda:a");
    expect(plural.find("lentil, cooked")?.id).toBe("usda:b");
  });

  test("returns null rather than the least-bad row when nothing is close", () => {
    // A silent wrong match is worse than the model's own guess, because it looks authoritative.
    expect(index.find("borscht")).toBeNull();
    expect(index.find("")).toBeNull();
  });

  test("does not match on a single common token alone", () => {
    // "cooked" appears in most rows; matching on it would return an arbitrary food.
    expect(index.find("cooked")).toBeNull();
  });

  test("size reports what was indexed", () => {
    expect(index.size).toBe(5);
  });
});
