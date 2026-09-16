// Where a day stands against its calorie target: the diary's headline, on the phone and the web.
//
// ONE PLACE FOR THE ARITHMETIC, because the two clients draw the same number in the largest type
// on the screen and a rounding that differs between them is a disagreement anybody can see. The
// words stay with each client; the state is named so that `${kcal} kcal ${state}` reads.
//
// THE WEB PAGE IMPORTS THIS BY RELATIVE PATH (`web/AGENTS.md`, #608), so it takes nothing at
// runtime from anywhere: `import type` only.

import type { Goal } from "./types.ts";

export interface DayBudget {
  /**
   * What the headline number is.
   *
   * `left` is still spendable, so only today (or a later day) has it. A past day's unspent budget
   * cannot be eaten any more, so it is `under` instead. `unlogged` is a past day with no meal on
   * it: nothing logged is not nothing eaten, and "2000 under" would say it was.
   */
  state: "left" | "over" | "under" | "unlogged";
  /** The headline: whole kcal, never negative. 0 when `unlogged`. */
  kcal: number;
  /** What was eaten, rounded — the SAME rounding the headline was computed from. */
  eaten: number;
  target: number;
  /** eaten / target, clamped to 0…1 — how full the bar is. */
  fill: number;
  /** Over target, on any plan but gain, where eating past it is the point. */
  warn: boolean;
  protein: { eaten: number; target: number };
}

export function dayBudget(
  day: {
    date: string;
    meals: readonly unknown[];
    totals: { kcal: number; protein_g: number };
    targets: { kcal: number; protein_g: number };
  },
  today: string,
  goal: Goal | null,
): DayBudget {
  // Rounded BEFORE subtracting, so "1451 eaten" and "549 left" add up to the target on screen.
  const eaten = Math.round(day.totals.kcal);
  const target = Math.round(day.targets.kcal);
  const protein = { eaten: Math.round(day.totals.protein_g), target: Math.round(day.targets.protein_g) };
  const past = day.date < today;
  if (past && day.meals.length === 0) {
    return { state: "unlogged", kcal: 0, eaten, target, fill: 0, warn: false, protein };
  }
  const diff = target - eaten;
  const state = diff < 0 ? "over" : past ? "under" : "left";
  const fill = target > 0 ? Math.min(1, Math.max(0, eaten / target)) : eaten > 0 ? 1 : 0;
  return { state, kcal: Math.abs(diff), eaten, target, fill, warn: state === "over" && goal !== "gain", protein };
}
