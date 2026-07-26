import { describe, expect, test } from "bun:test";
import {
  NUTRIENT_IDS,
  cofidFoodRow,
  parseXlsxSheet,
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

describe("parseXlsxSheet — CoFID ships as .xlsx, which is XML in a zip", () => {
  const strings = ["Food Name", "Ackee, canned, drained", "Tr"];
  const sheet =
    `<sheetData>` +
    `<row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1"><v>42</v></c></row>` +
    `<row r="2"><c r="B2" t="s"><v>1</v></c><c r="M2"><v>151</v></c><c r="AA2" t="s"><v>2</v></c></row>` +
    `</sheetData>`;

  test("resolves shared strings and keeps inline numbers", () => {
    const rows = parseXlsxSheet(sheet, strings);
    expect(rows[0]![0]).toBe("Food Name");
    expect(rows[1]![1]).toBe("Ackee, canned, drained");
    expect(rows[1]![12]).toBe("151"); // column M
  });

  test("a skipped cell leaves a GAP at its own column, it does not shift the row", () => {
    // xlsx omits empty cells entirely. Reading cells positionally would slide every later value
    // one column left — the same silent column-shift the USDA CSV parser exists to prevent.
    const rows = parseXlsxSheet(sheet, strings);
    expect(rows[0]![1]).toBe(""); // B1 absent
    expect(rows[0]![2]).toBe("42"); // C1 still at index 2
  });

  test("handles two-letter column references", () => {
    expect(parseXlsxSheet(sheet, strings)[1]![26]).toBe("Tr"); // AA = 26
  });
});

describe("cofidFoodRow", () => {
  // Column layout of CoFID's "1.3 Proximates" sheet, verified against the 2021 release.
  const row = (over: Partial<Record<number, string>> = {}): string[] => {
    const r = new Array(20).fill("");
    r[0] = "13-145"; r[1] = "Ackee, canned, drained";
    r[9] = "2.9"; r[10] = "15.2"; r[11] = "0.8"; r[12] = "151";
    for (const [i, v] of Object.entries(over)) r[Number(i)] = v;
    return r;
  };

  test("maps name, kcal and macros per 100 g", () => {
    const f = cofidFoodRow(row())!;
    expect(f.id).toBe("cofid:13-145");
    expect(f.name).toBe("Ackee, canned, drained");
    expect(f.kcal).toBe(151);
    expect(f.protein_g).toBe(2.9);
    expect(f.fat_g).toBe(15.2);
    expect(f.carbs_g).toBe(0.8);
  });

  test('"Tr" means trace, which is zero, not unknown', () => {
    expect(cofidFoodRow(row({ 11: "Tr" }))!.carbs_g).toBe(0);
  });

  test('"N" means not measured — zero would be a fabricated fact', () => {
    // CoFID writes N for a nutrient that was never analysed. Storing 0 would assert the food
    // contains none of it, and that number would be summed into a user's daily total.
    const f = cofidFoodRow(row({ 9: "N" }))!;
    expect(f.protein_g).toBe(0);
    expect(f.kcal).toBe(151);
  });

  test("a value carrying a qualifier still parses to its number", () => {
    expect(cofidFoodRow(row({ 12: "151" }))!.kcal).toBe(151);
  });

  test("returns null without a usable name or energy", () => {
    expect(cofidFoodRow(row({ 12: "N" }))).toBeNull();
    expect(cofidFoodRow(row({ 1: "" }))).toBeNull();
    expect(cofidFoodRow(row({ 12: "" }))).toBeNull();
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

  test("a USDA taxonomy prefix may be absent from the query", () => {
    // USDA files many foods under a category word: "Fish, salmon, ...", "Beef, ground, ...".
    // Strict head containment rejected those, because a model says "salmon" and never "fish".
    // A head token counts as a taxonomy prefix by how many rows it heads, measured on the corpus
    // itself — no hand-written list of category words.
    const taxo = buildFoodIndex([
      ...Array.from({ length: 60 }, (_, i) => ({
        id: `usda:f${i}`, name: `Fish, species${i}, raw`, kcal: 100, protein_g: 20, carbs_g: 0, fat_g: 2,
      })),
      { id: "usda:s", name: "Fish, salmon, chinook, cooked, dry heat", kcal: 231, protein_g: 25, carbs_g: 0, fat_g: 13 },
      // "Pepper" heads almost nothing, so it stays an identity word and must still block.
      { id: "usda:p", name: "Pepper, banana, raw", kcal: 27, protein_g: 1.7, carbs_g: 5.4, fat_g: 0.5 },
      { id: "usda:b", name: "Bananas, raw", kcal: 89, protein_g: 1.1, carbs_g: 22.8, fat_g: 0.3 },
    ]);
    expect(taxo.find("salmon, cooked")?.id).toBe("usda:s");
    // The relaxation must not reopen the trap it was gated against.
    expect(taxo.find("banana, raw")?.id).toBe("usda:b");
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
