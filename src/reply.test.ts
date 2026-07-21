import { describe, expect, test } from "bun:test";
import { formatReply, verdictEmoji, type FormatMeal } from "./reply.ts";
import type { DailyTotals, FoodTargets, MealVerdicts } from "./types.ts";

function meal(over: Partial<FormatMeal> = {}): FormatMeal {
  return {
    items: [
      { name: "рис", grams: 200 },
      { name: "курица", grams: 150 },
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

describe("verdictEmoji", () => {
  test("maps verdicts to ✅⚠️❌", () => {
    expect(verdictEmoji("good")).toBe("✅");
    expect(verdictEmoji("warn")).toBe("⚠️");
    expect(verdictEmoji("bad")).toBe("❌");
  });
});

describe("formatReply", () => {
  test("shows this meal's items and macros", () => {
    const r = formatReply(meal(), totals, targets(), "ru");
    expect(r).toContain("рис");
    expect(r).toContain("200");
    expect(r).toContain("550"); // meal kcal
  });

  test("shows the running daily total against the kcal target", () => {
    const r = formatReply(meal(), totals, targets(), "ru");
    expect(r).toContain("1850");
    expect(r).toContain("2100"); // target
    expect(r).toContain("/ 2100");
  });

  test("weight verdict always renders", () => {
    const r = formatReply(meal({ verdicts: { weight: "good" } }), totals, targets(), "ru");
    expect(r).toContain("✅");
  });

  test("no kidney/ldl lines when the profile did not declare them", () => {
    const r = formatReply(meal({ verdicts: { weight: "good" } }), totals, targets(), "ru");
    expect(r).not.toContain("Почки");
    expect(r).not.toContain("Холестерин");
  });

  test("ldl verdict + satfat target line appear when declared", () => {
    const v: MealVerdicts = { weight: "good", ldl: "warn" };
    const r = formatReply(meal({ verdicts: v }), totals, targets({ satfat_g: 13 }), "ru");
    expect(r).toContain("Холестерин");
    expect(r).toContain("⚠️");
    expect(r).toContain("13"); // satfat target cap
  });

  test("kidneys verdict + sodium target line appear when declared", () => {
    const v: MealVerdicts = { weight: "good", kidneys: "bad" };
    const r = formatReply(meal({ verdicts: v }), totals, targets({ sodium_mg: 2000 }), "ru");
    expect(r).toContain("Почки");
    expect(r).toContain("❌");
    expect(r).toContain("2000"); // sodium target cap
  });

  test("defaults to ru copy", () => {
    const r = formatReply(meal(), totals, targets());
    expect(r).toContain("Итого"); // ru total label
  });
});
