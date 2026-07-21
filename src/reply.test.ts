import { describe, expect, test } from "bun:test";
import { formatReply, verdictEmoji, type FormatMeal } from "./reply.ts";
import { LANGS, translatorFor } from "./i18n/index.ts";
import type { DailyTotals, FoodTargets, MealVerdicts } from "./types.ts";

function meal(over: Partial<FormatMeal> = {}): FormatMeal {
  return {
    items: [
      { name: "rice", grams: 200 },
      { name: "chicken", grams: 150 },
    ],
    kcal: 550,
    protein_g: 40,
    carbs_g: 60,
    fat_g: 12,
    satfat_g: 3,
    sodium_mg: 400,
    verdicts: { weight: "good" },
    confidence: "medium",
    notes: "",
    ...over,
  };
}

const totals: DailyTotals = {
  kcal: 1850,
  protein_g: 90,
  carbs_g: 200,
  fat_g: 60,
  satfat_g: 10,
  fiber_g: 20,
  sugar_g: 30,
  sodium_mg: 1500,
};

function targets(over: Partial<FoodTargets> = {}): FoodTargets {
  return { kcal: 2100, protein_g: 100, ...over };
}

const tru = translatorFor("ru");
const ten = translatorFor("en");
const tde = translatorFor("de");

describe("verdictEmoji", () => {
  test("maps verdicts to ✅⚠️❌", () => {
    expect(verdictEmoji("good")).toBe("✅");
    expect(verdictEmoji("warn")).toBe("⚠️");
    expect(verdictEmoji("bad")).toBe("❌");
  });
});

describe("formatReply", () => {
  test("shows this meal's items and macros", () => {
    const r = formatReply(meal(), totals, targets(), tru);
    expect(r).toContain("rice");
    expect(r).toContain("200");
    expect(r).toContain("550"); // meal kcal
  });

  test("shows the running daily total against the kcal target", () => {
    const r = formatReply(meal(), totals, targets(), tru);
    expect(r).toContain("1850");
    expect(r).toContain("2100"); // target
    expect(r).toContain("/ 2100");
  });

  test("weight verdict always renders", () => {
    const r = formatReply(meal({ verdicts: { weight: "good" } }), totals, targets(), tru);
    expect(r).toContain("✅");
  });

  test("no kidney/ldl lines when the profile did not declare them", () => {
    const r = formatReply(meal({ verdicts: { weight: "good" } }), totals, targets(), tru);
    expect(r).not.toContain(tru("meal.verdict.kidneys"));
    expect(r).not.toContain(tru("meal.verdict.ldl"));
  });

  test("ldl verdict + satfat target line appear when declared", () => {
    const v: MealVerdicts = { weight: "good", ldl: "warn" };
    const r = formatReply(meal({ verdicts: v }), totals, targets({ satfat_g: 13 }), tru);
    expect(r).toContain(tru("meal.verdict.ldl"));
    expect(r).toContain("⚠️");
    expect(r).toContain("13"); // satfat target cap
  });

  test("kidneys verdict + sodium target line appear when declared", () => {
    const v: MealVerdicts = { weight: "good", kidneys: "bad" };
    const r = formatReply(meal({ verdicts: v }), totals, targets({ sodium_mg: 2000 }), tru);
    expect(r).toContain(tru("meal.verdict.kidneys"));
    expect(r).toContain("❌");
    expect(r).toContain("2000"); // sodium target cap
  });

  test("renders an empty item list without crashing", () => {
    const r = formatReply(meal({ items: [] }), totals, targets(), ten);
    expect(r).toContain("🍽");
  });

  test("notes line only appears when notes are non-empty", () => {
    expect(formatReply(meal({ notes: "" }), totals, targets(), ten)).not.toContain("📝");
    expect(formatReply(meal({ notes: "  " }), totals, targets(), ten)).not.toContain("📝");
    expect(formatReply(meal({ notes: "grilled" }), totals, targets(), ten)).toContain("📝 grilled");
  });

  test("every locale renders every line without leaking a raw key", () => {
    const v: MealVerdicts = { weight: "good", ldl: "warn", kidneys: "bad" };
    for (const lang of LANGS) {
      const r = formatReply(
        meal({ verdicts: v, notes: "n" }),
        totals,
        targets({ satfat_g: 13, sodium_mg: 2000 }),
        translatorFor(lang),
      );
      expect(r).not.toMatch(/meal\.[a-zA-Z.]+/); // an unrendered key would appear verbatim
      // items, macros, verdicts, notes, total kcal, protein, satfat, sodium
      expect(r.split("\n").filter(Boolean)).toHaveLength(8);
    }
  });
});

// Golden snapshots. The key-based assertions above are tautological on their own — they pass
// even when the wrong key is wired. These pin the actual rendered output, so a layout or
// grammar regression shows up in the diff.
describe("formatReply golden output", () => {
  test("en", () => {
    expect(formatReply(meal(), totals, targets(), ten)).toBe(
      [
        "🍽 rice 200g, chicken 150g",
        "🔥 550 kcal · P 40 · F 12 · C 60",
        "Weight: ✅",
        "",
        "Today: 1850 / 2100 kcal",
        "Protein: 90 / 100 g",
      ].join("\n"),
    );
  });

  test("ru", () => {
    expect(formatReply(meal(), totals, targets(), tru)).toBe(
      [
        "🍽 rice 200г, chicken 150г",
        "🔥 550 ккал · Б 40 · Ж 12 · У 60",
        "Вес: ✅",
        "",
        "Итого сегодня: 1850 / 2100 ккал",
        "Белок: 90 / 100 г",
      ].join("\n"),
    );
  });

  test("de", () => {
    expect(formatReply(meal(), totals, targets(), tde)).toBe(
      [
        "🍽 rice 200 g, chicken 150 g",
        "🔥 550 kcal · E 40 · F 12 · K 60",
        "Gewicht: ✅",
        "",
        "Heute: 1850 / 2100 kcal",
        "Eiweiß: 90 / 100 g",
      ].join("\n"),
    );
  });
});
