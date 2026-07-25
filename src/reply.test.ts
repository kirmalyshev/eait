import { describe, expect, test, spyOn } from "bun:test";
import { formatReply, berlinDayLabel, mealDateLabel, verdictEmoji, type FormatMeal } from "./reply.ts";
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

/**
 * The restriction set most tests run with: both medical dimensions declared, so a verdict the
 * model returns is one the user asked for. Tests about the GATE pass their own set instead.
 */
const MEDICAL = ["ldl", "kidneys"] as const;

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

describe("berlinDayLabel", () => {
  test("renders the stored calendar day in the locale, Berlin tz", () => {
    // 2026-07-21 is a Tuesday.
    expect(berlinDayLabel("2026-07-21", "en")).toMatch(/Tue/);
    expect(berlinDayLabel("2026-07-21", "en")).toMatch(/21/);
    expect(berlinDayLabel("2026-07-21", "en")).toMatch(/Jul/);
  });
  test("localizes month/weekday names without any catalog strings", () => {
    expect(berlinDayLabel("2026-07-21", "de")).toMatch(/Di|Juli|Jul/); // German abbreviations
    expect(berlinDayLabel("2026-07-21", "ru")).toMatch(/июл|вт/i); // Russian
  });
  test("the noon-UTC anchor keeps the day stable (no off-by-one at the boundary)", () => {
    expect(berlinDayLabel("2026-01-01", "en")).toMatch(/1/); // not Dec 31
    expect(berlinDayLabel("2026-01-01", "en")).toMatch(/Jan/);
  });
  test("the noon anchor holds the day WEST of UTC too, not just Berlin", () => {
    // Sao Paulo is UTC-3; a midnight anchor would slip this to Jul 20. Pins the anchor's purpose.
    expect(berlinDayLabel("2026-07-21", "en", "America/Sao_Paulo")).toMatch(/21/);
  });
  test("a malformed date degrades to the raw string and warns, never throws a RangeError", () => {
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    try {
      expect(() => berlinDayLabel("not-a-date", "en")).not.toThrow();
      expect(berlinDayLabel("not-a-date", "en")).toBe("not-a-date");
      // Rollover-valid strings (Feb 30) must NOT silently normalize to Mar 2 — they degrade too.
      expect(berlinDayLabel("2026-02-30", "en")).toBe("2026-02-30");
      expect(berlinDayLabel("2026-04-31", "en")).toBe("2026-04-31");
      expect(warn).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});

describe("mealDateLabel", () => {
  test("same-day ⇒ undefined; a different day ⇒ the berlinDayLabel", () => {
    expect(mealDateLabel("2026-07-22", "2026-07-22", "en")).toBeUndefined();
    expect(mealDateLabel("2026-07-21", "2026-07-22", "en")).toBe(berlinDayLabel("2026-07-21", "en"));
  });
});

describe("formatReply — dated meal", () => {
  test("no dateLabel ⇒ byte-identical to the undated call (no regression)", () => {
    const bare = formatReply(meal(), totals, targets(), ten, MEDICAL);
    const explicitUndefined = formatReply(meal(), totals, targets(), ten, MEDICAL, {});
    expect(explicitUndefined).toBe(bare);
    expect(bare).toContain(ten("meal.totalKcal", { now: 1850, target: 2100 }));
  });

  test("a dateLabel adds the 'For <date>' line and dates the kcal total", () => {
    const r = formatReply(meal(), totals, targets(), ten, MEDICAL, { dateLabel: "Tue 21 Jul" });
    expect(r).toContain("Tue 21 Jul");
    expect(r).toContain(ten("meal.loggedForDate", { date: "Tue 21 Jul" }));
    expect(r).toContain(ten("meal.totalKcalDated", { date: "Tue 21 Jul", now: 1850, target: 2100 }));
    expect(r).not.toContain(ten("meal.totalKcal", { now: 1850, target: 2100 })); // "Today:" gone
  });
});

describe("formatReply", () => {
  test("shows this meal's items and macros", () => {
    const r = formatReply(meal(), totals, targets(), tru, MEDICAL);
    expect(r).toContain("rice");
    expect(r).toContain("200");
    expect(r).toContain("550"); // meal kcal
  });

  test("shows the running daily total against the kcal target", () => {
    const r = formatReply(meal(), totals, targets(), tru, MEDICAL);
    expect(r).toContain("1850");
    expect(r).toContain("2100"); // target
    expect(r).toContain("/ 2100");
  });

  test("weight verdict always renders", () => {
    const r = formatReply(meal({ verdicts: { weight: "good" } }), totals, targets(), tru, MEDICAL);
    expect(r).toContain("✅");
  });

  test("no kidney/ldl lines when the analysis carries no such verdict", () => {
    const r = formatReply(meal({ verdicts: { weight: "good" } }), totals, targets(), tru, MEDICAL);
    expect(r).not.toContain(tru("meal.verdict.kidneys"));
    expect(r).not.toContain(tru("meal.verdict.ldl"));
  });

  test("an UNDECLARED dimension is not rendered even when the analysis has one", () => {
    // The shipped bug (rationale on `visibleVerdicts`). The previous test could not catch it:
    // its fixture had the model already complying, so it tested the model, not the gate.
    const v: MealVerdicts = { weight: "good", ldl: "bad", kidneys: "warn" };
    const r = formatReply(meal({ verdicts: v }), totals, targets(), tru, []);
    expect(r).not.toContain(tru("meal.verdict.kidneys"));
    expect(r).not.toContain(tru("meal.verdict.ldl"));
    expect(r).toContain(tru("meal.verdict.weight")); // weight is never gated
  });

  test("declaring one medical dimension does not unlock the other", () => {
    const v: MealVerdicts = { weight: "good", ldl: "bad", kidneys: "warn" };
    const r = formatReply(meal({ verdicts: v }), totals, targets(), tru, ["ldl"]);
    expect(r).toContain(tru("meal.verdict.ldl"));
    expect(r).not.toContain(tru("meal.verdict.kidneys"));
  });

  test.each(LANGS)("%s gates cleanly — no stray separator or dangling line", (lang) => {
    // The all-locales test below runs with MEDICAL, so it never exercises the gate; de in
    // particular had no gated coverage at all. Two verdict lines disappearing must not leave a
    // dangling separator or an empty line behind in any locale.
    const t = translatorFor(lang);
    const v: MealVerdicts = { weight: "good", ldl: "warn", kidneys: "bad" };
    const gated = formatReply(meal({ verdicts: v }), totals, targets(), t, []);
    const ungated = formatReply(meal({ verdicts: v }), totals, targets(), t, MEDICAL);
    expect(gated).not.toContain(t("meal.verdict.ldl"));
    expect(gated).not.toContain(t("meal.verdict.kidneys"));
    expect(gated).toContain(t("meal.verdict.weight"));
    expect(gated.split("\n").length).toBe(ungated.split("\n").length); // same line count
    expect(gated).not.toMatch(/\n\s*\n\s*\n/); // no doubled blank line
    expect(gated.trimEnd()).toBe(gated); // no trailing whitespace left by a dropped item
  });

  test("an unrelated restriction unlocks nothing medical", () => {
    // lowsugar is a real tag with no verdict dimension — it must not act as a skeleton key.
    const v: MealVerdicts = { ldl: "bad", kidneys: "warn" };
    const r = formatReply(meal({ verdicts: v }), totals, targets(), tru, ["lowsugar"]);
    expect(r).not.toContain(tru("meal.verdict.ldl"));
    expect(r).not.toContain(tru("meal.verdict.kidneys"));
  });

  test("ldl verdict + satfat target line appear when declared", () => {
    const v: MealVerdicts = { weight: "good", ldl: "warn" };
    const r = formatReply(meal({ verdicts: v }), totals, targets({ satfat_g: 13 }), tru, MEDICAL);
    expect(r).toContain(tru("meal.verdict.ldl"));
    expect(r).toContain("⚠️");
    expect(r).toContain("13"); // satfat target cap
  });

  test("kidneys verdict + sodium target line appear when declared", () => {
    const v: MealVerdicts = { weight: "good", kidneys: "bad" };
    const r = formatReply(meal({ verdicts: v }), totals, targets({ sodium_mg: 2000 }), tru, MEDICAL);
    expect(r).toContain(tru("meal.verdict.kidneys"));
    expect(r).toContain("❌");
    expect(r).toContain("2000"); // sodium target cap
  });

  test("renders an empty item list without crashing", () => {
    const r = formatReply(meal({ items: [] }), totals, targets(), ten, MEDICAL);
    expect(r).toContain("🍽");
  });

  test("notes line only appears when notes are non-empty", () => {
    expect(formatReply(meal({ notes: "" }), totals, targets(), ten, MEDICAL)).not.toContain("📝");
    expect(formatReply(meal({ notes: "  " }), totals, targets(), ten, MEDICAL)).not.toContain("📝");
    expect(formatReply(meal({ notes: "grilled" }), totals, targets(), ten, MEDICAL)).toContain("📝 grilled");
  });

  test("every locale renders every line without leaking a raw key", () => {
    const v: MealVerdicts = { weight: "good", ldl: "warn", kidneys: "bad" };
    for (const lang of LANGS) {
      const r = formatReply(
        meal({ verdicts: v, notes: "n" }),
        totals,
        targets({ satfat_g: 13, sodium_mg: 2000 }),
        translatorFor(lang),
        MEDICAL,
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
    expect(formatReply(meal(), totals, targets(), ten, MEDICAL)).toBe(
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
    expect(formatReply(meal(), totals, targets(), tru, MEDICAL)).toBe(
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
    expect(formatReply(meal(), totals, targets(), tde, MEDICAL)).toBe(
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
