import { describe, expect, test } from "bun:test";
import { dayBudget, kcalCardState, macroCardState, macroLeft, macroTone, mealIsGuessed } from "./budget.ts";

const TODAY = "2026-09-16";
const day = (
  kcal: number,
  o: { date?: string; meals?: number; target?: number; protein?: number; guesses?: number; guessed?: boolean } = {},
) => ({
  date: o.date ?? TODAY,
  // The meals themselves: only their COUNT and, for a reader of this file, which of them the
  // analyzer could not read. `dayBudget` asks the totals, because `totals.guessed` is the one the
  // backend computed through `mealIsGuessed` — confidence AND whether it has since been answered.
  meals: Array.from({ length: o.meals ?? 1 }, (_, i) => ({ confidence: i < (o.guesses ?? 0) ? "low" : "high" })),
  totals: { kcal, protein_g: o.protein ?? 0, guessed: o.guessed ?? (o.guesses ?? 0) > 0 },
  targets: { kcal: o.target ?? 2000, protein_g: 120 },
});

describe("dayBudget", () => {
  test("today under target: what is left, and the bar filled by what was eaten", () => {
    expect(dayBudget(day(1450, { protein: 80.4 }), TODAY, "lose")).toEqual({
      state: "left", kcal: 550, eaten: 1450, target: 2000, fill: 0.725, warn: false, guessed: false,
      protein: { eaten: 80, target: 120 },
    });
  });

  test("today exactly on target is 0 left, not over", () => {
    expect(dayBudget(day(2000), TODAY, "lose")).toMatchObject({ state: "left", kcal: 0, fill: 1, warn: false });
  });

  test("today with nothing logged has the whole target left", () => {
    expect(dayBudget(day(0, { meals: 0 }), TODAY, "lose")).toMatchObject({ state: "left", kcal: 2000, fill: 0 });
  });

  test("over target says the overshoot as a positive number and clamps the bar full", () => {
    expect(dayBudget(day(2310), TODAY, "maintain")).toMatchObject({ state: "over", kcal: 310, fill: 1, warn: true });
  });

  test("rounds what was eaten BEFORE subtracting, so the two numbers on screen add up", () => {
    // 1450.6 is drawn as 1451; the remainder beside it has to be 549, not 549.4 or 550.
    expect(dayBudget(day(1450.6), TODAY, "lose")).toMatchObject({ eaten: 1451, kcal: 549 });
    // Half a kcal over rounds to exactly the target: on it, not "0 over".
    expect(dayBudget(day(2000.4), TODAY, "lose")).toMatchObject({ state: "left", kcal: 0 });
  });

  test("a past day's unspent budget is not spendable: it is UNDER, not left", () => {
    expect(dayBudget(day(1450, { date: "2026-09-15" }), TODAY, "lose")).toMatchObject({ state: "under", kcal: 550 });
    expect(dayBudget(day(2100, { date: "2026-09-15" }), TODAY, "lose")).toMatchObject({ state: "over", kcal: 100, warn: true });
  });

  test("a past day with nothing logged claims nothing about what was eaten", () => {
    expect(dayBudget(day(0, { date: "2026-09-10", meals: 0 }), TODAY, "lose")).toMatchObject({ state: "unlogged", kcal: 0, fill: 0 });
  });

  test("over on a gain plan is the point of the plan, so it is not a warning", () => {
    expect(dayBudget(day(2600), TODAY, "gain")).toMatchObject({ state: "over", kcal: 600, warn: false });
  });

  test("an unreadable profile (no goal) still warns over target", () => {
    expect(dayBudget(day(2600), TODAY, null)).toMatchObject({ state: "over", warn: true });
  });

  // #28: a day with a guessed meal in it is a guessed day, and the two figures a reader sees have
  // to be the same subtraction — rounding each of them at format time is what makes "1 822 eaten"
  // and "278 left" stop adding up to the plan.
  test("a guessed day keeps the same digits the rows print (ieat-app#1576)", () => {
    expect(dayBudget(day(1822, { target: 2100, guessed: true }), TODAY, "lose"))
      .toMatchObject({ guessed: true, eaten: 1822, kcal: 278 });
    // The issue's own day: 2 122 − 1 094 = 1 028, not the 1 030 the guess step drew beside a meal
    // row reading 1 094. The flag stays — the hedge is the client's "about", not a lost digit.
    expect(dayBudget(day(1094, { target: 2122, guessed: true }), TODAY, "lose"))
      .toMatchObject({ guessed: true, eaten: 1094, kcal: 1028 });
  });

  test("a measured day keeps every digit it earned", () => {
    expect(dayBudget(day(1822, { target: 2100 }), TODAY, "lose"))
      .toMatchObject({ guessed: false, eaten: 1822, kcal: 278 });
  });

  test("a zero target never divides by zero", () => {
    expect(dayBudget(day(300, { target: 0 }), TODAY, "lose")).toMatchObject({ state: "over", kcal: 300, fill: 1 });
    expect(dayBudget(day(0, { target: 0 }), TODAY, "lose")).toMatchObject({ state: "left", kcal: 0, fill: 0 });
  });

  // ── The number rule: one quantity, one number on a screen (ieat-app#1576) ────────────────────────────

  test("one low-confidence meal makes the whole day a guess — flagged, not rounded", () => {
    // The spec's day: four meals coming to 1 822, one of them guessed. `guessed` still marks the
    // day for the client's hedge word, but the figures are the same ones the rows add up to.
    expect(dayBudget(day(1822, { meals: 4, guesses: 1, target: 2100 }), TODAY, "lose"))
      .toMatchObject({ guessed: true, eaten: 1822, kcal: 278 });
  });

  test("answering the guess settles the day back out of the hedge", () => {
    // The same day with the sauce answered: 190 gone, nothing guessed, so no hedge flag.
    expect(dayBudget(day(1632, { meals: 4, target: 2100 }), TODAY, "lose"))
      .toMatchObject({ guessed: false, eaten: 1632, kcal: 468 });
  });

  test("a measured day keeps every digit", () => {
    expect(dayBudget(day(1451.4, { meals: 3 }), TODAY, "lose")).toMatchObject({ guessed: false, eaten: 1451 });
  });

  test("the rounding happens before the subtraction, so the two numbers on screen still add up", () => {
    const b = dayBudget(day(1818, { guesses: 1, target: 2100 }), TODAY, "lose");
    expect(b.eaten + b.kcal).toBe(2100);
    expect(b.eaten).toBe(1818);
  });

  test("a day with no meal is not a guess", () => {
    expect(dayBudget(day(0, { meals: 0 }), TODAY, "lose")).toMatchObject({ guessed: false });
  });

  describe("macroTone", () => {
    test("protein is a target to reach: care until it is, good from then on", () => {
      expect(macroTone("protein", 80, 120)).toBe("care");
      expect(macroTone("protein", 120, 120)).toBe("good");
      expect(macroTone("protein", 150, 120)).toBe("good");
    });

    test("saturated fat is a cap: good while under it, bad once past it", () => {
      expect(macroTone("satfat", 7, 20)).toBe("good");
      expect(macroTone("satfat", 20, 20)).toBe("good");
      expect(macroTone("satfat", 21, 20)).toBe("bad");
    });

    test("no target means nothing to judge, whichever side the macro is", () => {
      expect(macroTone("protein", 80, 0)).toBe("care");
      expect(macroTone("satfat", 80, 0)).toBe("care");
      expect(macroTone("satfat", 80, -20)).toBe("care");
    });
  });

  describe("macroLeft", () => {
    test("what is left of a macro's target, rounded like the card prints it", () => {
      expect(macroLeft(120, 48)).toBe(72);
      expect(macroLeft(120, 47.6)).toBe(72);
      expect(macroLeft(13, 6.9)).toBe(6);
    });

    test("reached or past the target is zero, never a negative figure", () => {
      expect(macroLeft(120, 120)).toBe(0);
      expect(macroLeft(120, 150)).toBe(0);
    });

    test("no target means nothing left to count", () => {
      expect(macroLeft(0, 40)).toBe(0);
      expect(macroLeft(-20, 0)).toBe(0);
    });
  });

  describe("mealIsGuessed", () => {
    test("a plate the analyzer could not read is a guess; a typed meal arrives as one too", () => {
      expect(mealIsGuessed({ confidence: "low", corrected: false })).toBe(true);
      expect(mealIsGuessed({ confidence: "high", corrected: false })).toBe(false);
      expect(mealIsGuessed({ confidence: "medium", corrected: false })).toBe(false);
    });

    test("an answered meal is settled, however badly it was read", () => {
      // `editMeal` sets `corrected` on every manual edit and every natural-language correction.
      // Without this half the thread goes on saying "about" about grams the person typed.
      expect(mealIsGuessed({ confidence: "low", corrected: true })).toBe(false);
    });
  });
});

describe("kcalCardState", () => {
  // The W4 card's figure-and-label pair is ONE choice (#164's review): today toggles "left" to
  // "eaten"; a past day shows what WAS eaten — nothing is "left" of a day that is over — except
  // the overage on an over day and the plan an unlogged one had.
  test("today under target: the remaining figure under 'left'", () => {
    const b = dayBudget(day(1500), TODAY, "lose");
    expect(kcalCardState(b, false)).toEqual({ figure: 500, label: "left", guessed: false });
  });

  test("the toggle: same budget, eaten's figure under 'eaten'", () => {
    const b = dayBudget(day(1500), TODAY, "lose");
    expect(kcalCardState(b, true)).toEqual({ figure: 1500, label: "eaten", guessed: false });
  });

  test("an over day toggles 'over' to 'eaten' — never the eaten figure under 'over' (#164)", () => {
    const b = dayBudget(day(2500), TODAY, "lose");
    expect(kcalCardState(b, false)).toEqual({ figure: 500, label: "over", guessed: false });
    expect(kcalCardState(b, true)).toEqual({ figure: 2500, label: "eaten", guessed: false });
  });

  test("a past day under target reads 'left' — the figure is what's left, never eaten (#170)", () => {
    const b = dayBudget(day(1500, { date: "2026-09-10" }), TODAY, "lose");
    expect(b.state).toBe("under");
    expect(kcalCardState(b, false)).toEqual({ figure: 500, label: "left", guessed: false });
  });

  test("a past day with nothing on it shows the plan that day had", () => {
    const b = dayBudget(day(0, { date: "2026-09-10", meals: 0 }), TODAY, "lose");
    expect(kcalCardState(b, false)).toEqual({ figure: 2000, label: "left", guessed: false });
  });

  test("a guessed day carries the about-marker through (#47)", () => {
    const b = dayBudget(day(1500, { guessed: true }), TODAY, "lose");
    expect(kcalCardState(b, false).guessed).toBe(true);
  });
});

describe("macroCardState", () => {
  // The one figure-and-label pair for "{n}g · {Macro} left/over" — Home's diary column and
  // You's day column draw the same card (#175), so the rule lives here rather than on a screen.
  test("under target: what is left, under 'left', the ring at the eaten share", () => {
    expect(macroCardState(100, 150)).toEqual({ figure: 50, label: "left", share: 100 / 150 });
  });

  test("over target: the OVERAGE under 'over' and a closed ring — never a clamped '0g left'", () => {
    expect(macroCardState(155, 150)).toEqual({ figure: 5, label: "over", share: 1 });
  });

  test("exactly on target is 'left' 0, not 'over'", () => {
    expect(macroCardState(150, 150)).toEqual({ figure: 0, label: "left", share: 1 });
  });

  test("no target: the eaten figure under 'left', and no ring to draw", () => {
    expect(macroCardState(12, undefined)).toEqual({ figure: 12, label: "left" });
  });

  test("the eaten figure is the rounded one — a fraction is not a fact the analyzer had", () => {
    expect(macroCardState(12.6, undefined)).toEqual({ figure: 13, label: "left" });
    expect(macroCardState(10.4, 50)).toEqual({ figure: 40, label: "left", share: 10 / 50 });
  });
});
