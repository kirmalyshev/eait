import { describe, expect, test } from "bun:test";
import { escapeHtml, renderMealCard } from "./render.ts";
import { translatorFor } from "./i18n/index.ts";
import type { DailyTotals, FoodTargets } from "./types.ts";
import type { FormatMeal } from "./reply.ts";

const totals: DailyTotals = {
  kcal: 80, protein_g: 1, carbs_g: 20, fat_g: 1, satfat_g: 0, fiber_g: 0, sugar_g: 0, sodium_mg: 5,
};
const targets: FoodTargets = { kcal: 1800, protein_g: 100 };
/** Both medical dimensions declared — the default for tests not about the verdict gate itself. */
const MEDICAL = ["ldl", "kidneys"] as const;

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
      totals, targets, t, MEDICAL,
    );
    expect(html).not.toContain("Egg <b>");
    expect(html).toContain("&lt;b&gt;");
    expect(html).not.toContain("<notes>");
  });

  test("builds the card structure: heading, metrics table, notes quote, progress table, footer", () => {
    const html = renderMealCard(meal(), totals, targets, t, MEDICAL, { footer: t("meal.correctionHint") });
    expect(html).toContain("<h3>");
    expect(html).toContain("<table");
    expect(html).toContain("<blockquote>");
    expect(html).toContain("80 / 1800");
    expect(html).toContain("<footer>");
    expect(html).toContain("140");
  });

  test("footer and prefix appear only when the caller asks — a correction card carries no nag", () => {
    const bare = renderMealCard(meal(), totals, targets, t, MEDICAL);
    expect(bare).not.toContain("<footer>");
    const prefixed = renderMealCard(meal(), totals, targets, t, MEDICAL, { prefix: "Updated <v2>" });
    expect(prefixed).toContain("<p>");
    expect(prefixed).toContain("&lt;v2&gt;"); // prefix is escaped like everything else
  });

  test("a meal without notes renders no blockquote", () => {
    const html = renderMealCard(meal({ notes: "" }), totals, targets, t, MEDICAL);
    expect(html).not.toContain("<blockquote>");
  });

  test("no dateLabel ⇒ the today's-progress header, no date line", () => {
    const html = renderMealCard(meal(), totals, targets, t, MEDICAL);
    expect(html).toContain(escapeHtml(t("rich.todaysProgress")));
    expect(html).not.toContain(escapeHtml(t("meal.loggedForDate", { date: "Tue 21 Jul" })));
  });

  test("a dateLabel adds a 'For <date>' paragraph and dates the progress header", () => {
    const html = renderMealCard(meal(), totals, targets, t, MEDICAL, { dateLabel: "Tue 21 Jul" });
    expect(html).toContain("<p>");
    expect(html).toContain(escapeHtml(t("meal.loggedForDate", { date: "Tue 21 Jul" })));
    expect(html).toContain(escapeHtml(t("rich.progressForDate", { date: "Tue 21 Jul" })));
    expect(html).not.toContain(escapeHtml(t("rich.todaysProgress"))); // header swapped, not both
  });

  test("optional targets add rows only when present", () => {
    const withSodium = renderMealCard(meal(), totals, { ...targets, sodium_mg: 2000 }, t, MEDICAL);
    expect(withSodium).toContain("2000");
    const without = renderMealCard(meal(), totals, targets, t, MEDICAL);
    expect(without).not.toContain("2000");
  });
});

describe("renderMealCard — verdict gate", () => {
  // Rich mode is a second, independent rendering path. The shipped bug was present in BOTH, so
  // the fix needs a test in both — a gate applied only to the plain card would leave every
  // rich-format user still seeing medical verdicts they never asked for.

  test("an undeclared dimension is not rendered even when the analysis has one", () => {
    const t = translatorFor("en");
    const html = renderMealCard(
      meal({ verdicts: { weight: "good", ldl: "bad", kidneys: "warn" } }),
      totals,
      targets,
      t,
      [],
    );
    expect(html).not.toContain(t("meal.verdict.ldl"));
    expect(html).not.toContain(t("meal.verdict.kidneys"));
    expect(html).toContain(t("meal.verdict.weight")); // weight is never gated
  });

  test("declared dimensions still render", () => {
    const t = translatorFor("en");
    const html = renderMealCard(
      meal({ verdicts: { weight: "good", ldl: "bad", kidneys: "warn" } }),
      totals,
      targets,
      t,
      MEDICAL,
    );
    expect(html).toContain(t("meal.verdict.ldl"));
    expect(html).toContain(t("meal.verdict.kidneys"));
  });
});
