import { describe, expect, test } from "bun:test";
import { foodRefFromSnapshotLine, type SnapshotLine } from "./snapshot.ts";

const n = (value: number, unit = "g", basis = "100g") => ({ value, unit, basis });
const line = (over: Partial<SnapshotLine> = {}): SnapshotLine => ({
  name: { value: "Hummus, commercial", source: "fdc", record: "fdc:321358" },
  lang: { value: "en" }, category: { value: "legumes" }, gtin14: [],
  per_100: { ENERC_KCAL: n(229, "kcal"), PROCNT: n(7.35), CHOCDF: n(14.9), FAT: n(17.1), NA: n(438, "mg") },
  ...over,
});

describe("a snapshot line as a food_ref row", () => {
  test("USDA lands as usda-sr with its macros and an English name", () => {
    expect(foodRefFromSnapshotLine(line())).toMatchObject({
      id: "usda-sr:321358", source: "usda-sr", name_en: "Hummus, commercial", category: "legumes",
      kcal_per_100g: 229, protein_g_per_100g: 7.35, carbs_g_per_100g: 14.9, fat_g_per_100g: 17.1, sodium_mg_per_100g: 438,
    });
  });
  test("a source eait's schema does not name is skipped", () => {
    expect(foodRefFromSnapshotLine(line({ name: { value: "x", source: "mext", record: "mext:1" } }))).toBeNull();
  });
  test("a barcoded product is not a generic food", () => {
    expect(foodRefFromSnapshotLine(line({ gtin14: [{}] }))).toBeNull();
  });
  test("available carbohydrate stands in for total, a 100 ml basis does not count, and missing stays null", () => {
    const r = foodRefFromSnapshotLine(line({ per_100: { ENERC_KCAL: n(40, "kcal", "100ml"), CHOAVL: n(9) } }))!;
    expect(r.carbs_g_per_100g).toBe(9);
    expect(r.kcal_per_100g).toBeNull();
    expect(r.protein_g_per_100g).toBeNull();
  });
  test("a non-English name is kept under its language, not as the English key", () => {
    const r = foodRefFromSnapshotLine(line({ name: { value: "Pomme", source: "ciqual", record: "ciqual:13014" }, lang: { value: "fr" } }))!;
    expect(r).toMatchObject({ id: "ciqual:13014", name_en: null, names: { fr: "Pomme" } });
  });
});
