import { describe, expect, test } from "bun:test";
import { dayBudget, mealIsGuessed } from "./budget.ts";

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
  // to be the same subtraction — rounding each of them at format time is what makes "about 1 820"
  // and "about 280" stop adding up to the plan.
  test("a guessed day puts BOTH figures on the guess step", () => {
    expect(dayBudget(day(1822, { target: 2100, guessed: true }), TODAY, "lose"))
      .toMatchObject({ guessed: true, eaten: 1820, kcal: 280 });
    // A plan that is not itself on the step: the two estimates are, and the plan stays exact —
    // which is the one number in the line a reader is entitled to every digit of.
    expect(dayBudget(day(1894, { target: 2446, guessed: true }), TODAY, "lose"))
      .toMatchObject({ guessed: true, eaten: 1890, kcal: 560 });
  });

  test("a measured day keeps every digit it earned", () => {
    expect(dayBudget(day(1822, { target: 2100 }), TODAY, "lose"))
      .toMatchObject({ guessed: false, eaten: 1822, kcal: 278 });
  });

  test("a zero target never divides by zero", () => {
    expect(dayBudget(day(300, { target: 0 }), TODAY, "lose")).toMatchObject({ state: "over", kcal: 300, fill: 1 });
    expect(dayBudget(day(0, { target: 0 }), TODAY, "lose")).toMatchObject({ state: "left", kcal: 0, fill: 0 });
  });

  // ── The number rule: precision carries the confidence (#810) ─────────────────────────────────

  test("one low-confidence meal makes the whole day a guess, and the day loses its last digit", () => {
    // The spec's day: four meals coming to 1 822, one of them guessed. It prints 1 820 BECAUSE one
    // of them is a guess, and 280 is what is left while that guess is in.
    expect(dayBudget(day(1822, { meals: 4, guesses: 1, target: 2100 }), TODAY, "lose"))
      .toMatchObject({ guessed: true, eaten: 1820, kcal: 280 });
  });

  test("answering the guess settles the day back to the digit we believe", () => {
    // The same day with the sauce answered: 190 gone, nothing guessed, so nothing is rounded off.
    expect(dayBudget(day(1632, { meals: 4, target: 2100 }), TODAY, "lose"))
      .toMatchObject({ guessed: false, eaten: 1632, kcal: 468 });
  });

  test("a measured day keeps every digit", () => {
    expect(dayBudget(day(1451.4, { meals: 3 }), TODAY, "lose")).toMatchObject({ guessed: false, eaten: 1451 });
  });

  test("the rounding happens before the subtraction, so the two numbers on screen still add up", () => {
    const b = dayBudget(day(1818, { guesses: 1, target: 2100 }), TODAY, "lose");
    expect(b.eaten + b.kcal).toBe(2100);
    expect(b.eaten).toBe(1820);
  });

  test("a day with no meal is not a guess", () => {
    expect(dayBudget(day(0, { meals: 0 }), TODAY, "lose")).toMatchObject({ guessed: false });
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
