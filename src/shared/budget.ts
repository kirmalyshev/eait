// Where a day stands against its calorie target: the diary's headline, on the phone and the web.
//
// ONE PLACE FOR THE ARITHMETIC, because the two clients draw the same number in the largest type
// on the screen and a rounding that differs between them is a disagreement anybody can see. The
// words stay with each client; the state is named so that `${kcal} kcal ${state}` reads.
//
// THE WEB PAGE IMPORTS THIS BY RELATIVE PATH (`web/AGENTS.md`, #608), and so does the one value it
// now takes: `toGuessStep` from `lang.ts`, which that bundle already loads for its formatters.
// Nothing here may reach `@eait/shared` by package name — that path needs a `node_modules` the web
// image does not build — and nothing here may grow a dependency the browser half cannot carry.

import { toGuessStep } from "./lang.ts";
import type { Goal } from "./types.ts";

/**
 * A MEAL WHOSE NUMBERS ARE A GUESS (#47) — the one definition, read by every surface that prints
 * one of its figures.
 *
 * Two halves, and both are load-bearing. `confidence: "low"` is the analyzer saying it could not
 * read the plate, and it is also what `engine/text.ts` forces onto a TYPED meal, where the
 * portions were never seen however sure the model was of the dish. `corrected` is the answer:
 * `editMeal` sets it on every manual edit and on every natural-language correction, so a plate
 * whose grams the user has since typed stops being hedged. Without that half the thread goes on
 * saying "about" about a number the person supplied, which is the opposite of the rule.
 */
export const mealIsGuessed = (meal: { confidence: string; corrected: boolean }): boolean =>
  meal.confidence === "low" && !meal.corrected;

export type MacroTone = "care" | "good" | "bad";

/**
 * The colour of a macro counter — one rule for both clients (#71), next to `dayBudget` because the
 * figures it colours come out of the same totals.
 *
 * The two macros judge in OPPOSITE directions, and that is the whole of this function. Protein is a
 * target to reach: under it is "care", the still-to-go state, never a failure; reaching it is
 * "good". Saturated fat is a cap: under it is "good" and past it is "bad". A target of zero or less
 * is no target at all, so there is nothing to judge — "care" either way.
 */
export function macroTone(kind: "protein" | "satfat", eaten: number, target: number): MacroTone {
  if (target <= 0) return "care";
  if (kind === "protein") return eaten >= target ? "good" : "care";
  return eaten > target ? "bad" : "good";
}

export interface DayBudget {
  /**
   * What the headline number is.
   *
   * `left` is still spendable, so only today (or a later day) has it. A past day's unspent budget
   * cannot be eaten any more, so it is `under` instead. `unlogged` is a past day with no meal on
   * it: nothing logged is not nothing eaten, and "2000 under" would say it was.
   */
  state: "left" | "over" | "under" | "unlogged";
  /** The headline: whole kcal, never negative, on the guess step when `guessed`. 0 when `unlogged`. */
  kcal: number;
  /** What was eaten, rounded — the SAME rounding the headline was computed from. */
  eaten: number;
  target: number;
  /** eaten / target, clamped to 0…1 — how full the bar is. */
  fill: number;
  /**
   * The day has a guessed meal in it, so every figure derived from it is a guess (#47).
   *
   * What it changes is PRECISION, not wording: `eaten` and `kcal` have already lost the digit
   * nobody believes, and the client prints them behind its hedge word. `target` keeps every digit
   * — it is arithmetic over answers the user gave, and rounding it would hedge a promise.
   */
  guessed: boolean;
  /** Over target, on any plan but gain, where eating past it is the point. */
  warn: boolean;
  protein: { eaten: number; target: number };
}

export function dayBudget(
  day: {
    date: string;
    meals: readonly unknown[];
    totals: { kcal: number; protein_g: number; guessed: boolean };
    targets: { kcal: number; protein_g: number };
  },
  today: string,
  goal: Goal | null,
): DayBudget {
  // Rounded BEFORE subtracting, so "1451 eaten" and "549 left" add up to the target on screen.
  //
  // ON THE GUESS STEP WHEN THE DAY HOLDS A GUESS (#47), and BOTH figures, not one: the headline
  // and the line under it are the two numbers a reader sees, and one of them at ten and the other
  // at one is a screen that says "about 1,890" over "about 556". They no longer add up to the
  // plan, and that is the arithmetic rather than a bug — the plan is the one EXACT number in the
  // line, and two estimates cannot both land on the step and still make an exact total. The
  // rounding happens HERE, once, so no formatter has to do it a second time.
  const guessed = day.totals.guessed;
  const step = (x: number): number => guessed ? toGuessStep(x) : Math.round(x);
  const eaten = step(day.totals.kcal);
  const target = Math.round(day.targets.kcal);
  const protein = { eaten: Math.round(day.totals.protein_g), target: Math.round(day.targets.protein_g) };
  const past = day.date < today;
  if (past && day.meals.length === 0) {
    return { state: "unlogged", kcal: 0, eaten, target, fill: 0, warn: false, guessed, protein };
  }
  const diff = target - eaten;
  const state = diff < 0 ? "over" : past ? "under" : "left";
  const fill = target > 0 ? Math.min(1, Math.max(0, eaten / target)) : eaten > 0 ? 1 : 0;
  return {
    state, kcal: step(Math.abs(diff)), eaten, target, fill, guessed,
    warn: state === "over" && goal !== "gain", protein,
  };
}
