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
    // mext and tfda are the real cases: both publish a non-English primary name only (ja, zh-TW),
    // so a stored row could never answer an English query — they stay out rather than load dead weight.
    expect(foodRefFromSnapshotLine(line({ name: { value: "x", source: "mext", record: "mext:1" } }))).toBeNull();
    expect(foodRefFromSnapshotLine(line({ name: { value: "x", source: "tfda", record: "tfda:1" } }))).toBeNull();
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
  test("a BLS line lands as bls: code as id, English name, available carbohydrate, licence credit verbatim", () => {
    const credit = "Max Rubner-Institut (2025): Bundeslebensmittelschlüssel (BLS), Version 4.0 — Deutsche Nährstoffdatenbank.";
    const r = foodRefFromSnapshotLine(line({
      name: { value: "Oat flakes", source: "bls", record: "bls:C131000" },
      per_100: { ENERC_KCAL: n(372, "kcal"), PROCNT: n(13.5), CHOAVL: n(58.7), FAT: n(7), FIBTG: n(10) },
      attribution: [{ text: credit }],
    }))!;
    expect(r).toMatchObject({
      id: "bls:C131000", source: "bls", name_en: "Oat flakes", names: {},
      kcal_per_100g: 372, protein_g_per_100g: 13.5, carbs_g_per_100g: 58.7, fat_g_per_100g: 7, fiber_g_per_100g: 10,
      attribution: [credit],
    });
  });
  test.each([
    ["cofid", "13-519", "Bread, white, farmhouse", "OGL-UK-3.0"],
    ["fineli", "11028", "Milk, whole, 3.9 % fat", "CC-BY-4.0"],
  ])("a %s line lands with its code, English name and licence credit", (source, code, name, _licence) => {
    const credit = `${source} attribution`;
    const r = foodRefFromSnapshotLine(line({
      name: { value: name, source, record: `${source}:${code}` },
      attribution: [{ text: credit }],
    }))!;
    expect(r).toMatchObject({ id: `${source}:${code}`, source, name_en: name, attribution: [credit] });
  });
  test("a non-English name is kept under its language, not as the English key", () => {
    const r = foodRefFromSnapshotLine(line({ name: { value: "Pomme", source: "ciqual", record: "ciqual:13014" }, lang: { value: "fr" } }))!;
    expect(r).toMatchObject({ id: "ciqual:13014", name_en: null, names: { fr: "Pomme" } });
  });
  test("a recipe line lands as recipe: its slug, the English name, the ingredients' credits verbatim", () => {
    const bls = "Max Rubner-Institut (2025): Bundeslebensmittelschlüssel (BLS).";
    const ciqual = "ANSES — Table de composition nutritionnelle Ciqual 2025";
    const r = foodRefFromSnapshotLine(line({
      name: { value: "Plov", source: "recipe", record: "recipe:plov" },
      attribution: [{ text: bls }, { text: ciqual }],
    }))!;
    expect(r).toMatchObject({
      id: "recipe:plov", source: "recipe", name: "Plov", name_en: "Plov", names: {},
      attribution: [bls, ciqual],
    });
  });
  test("a recipe's translated twin is not a second food", () => {
    // `recipe:plov.ru` is the same dish's Russian rendering. As its own row it could never answer
    // the matcher (`name_en` stays null), and folding the name into the English row would take a
    // cross-line merge a per-line conversion cannot express — so one dish stays one row.
    expect(foodRefFromSnapshotLine(line({
      name: { value: "Плов", source: "recipe", record: "recipe:plov.ru" }, lang: { value: "ru" },
    }))).toBeNull();
  });
});
