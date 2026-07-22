import { describe, expect, test } from "bun:test";
import { escapeHtml, renderMealCard } from "./render.ts";
import { translatorFor } from "./i18n/index.ts";
import type { DailyTotals, FoodTargets } from "./types.ts";
import type { FormatMeal } from "./reply.ts";

const totals: DailyTotals = {
  kcal: 80, protein_g: 1, carbs_g: 20, fat_g: 1, satfat_g: 0, fiber_g: 0, sugar_g: 0, sodium_mg: 5,
};
const targets: FoodTargets = { kcal: 1800, protein_g: 100 };

function meal(over: Partial<FormatMeal> = {}): FormatMeal {
  return {
    items: [{ name: "blueberries", grams: 140 }],
    kcal: 80, protein_g: 1, fat_g: 1, carbs_g: 20, satfat_g: 0, sodium_mg: 5,
    verdicts: { weight: "good" },
    confidence: "high",
    notes: "Clear single-item photo.",
    ...over,
  };
}

describe("escapeHtml", () => {
  test("escapes the five HTML-significant characters", () => {
    expect(escapeHtml(`<b>&"'`)).toBe("&lt;b&gt;&amp;&quot;&apos;");
  });
});

describe("renderMealCard", () => {
  const t = translatorFor("en");

  test("escapes LLM-supplied names and notes — the model can never inject markup", () => {
    const html = renderMealCard(
      meal({ items: [{ name: 'Egg <b>&"bomb"', grams: 100 }], notes: "Some <notes>" }),
      totals, targets, t,
    );
    expect(html).not.toContain("Egg <b>");
    expect(html).toContain("&lt;b&gt;");
    expect(html).not.toContain("<notes>");
  });

  test("builds the card structure: heading, metrics table, notes quote, progress table, footer", () => {
    const html = renderMealCard(meal(), totals, targets, t);
    expect(html).toContain("<h3>");
    expect(html).toContain("<table");
    expect(html).toContain("<blockquote>");
    expect(html).toContain("80 / 1800");
    expect(html).toContain("<footer>");
    expect(html).toContain("140");
  });

  test("a meal without notes renders no blockquote", () => {
    const html = renderMealCard(meal({ notes: "" }), totals, targets, t);
    expect(html).not.toContain("<blockquote>");
  });

  test("optional targets add rows only when present", () => {
    const withSodium = renderMealCard(meal(), totals, { ...targets, sodium_mg: 2000 }, t);
    expect(withSodium).toContain("2000");
    const without = renderMealCard(meal(), totals, targets, t);
    expect(without).not.toContain("2000");
  });
});
