// Fibre, sugar and sodium goals (ieat-app#914). Goals to READ AGAINST, not verdicts: nothing here
// feeds `verdictsFromTargets`, so a day over its sugar goal judges no meal. `FoodTargets` stays the
// verdict surface and is not widened.
//
// The user edits three nullable overrides on the profile; `microGoals` resolves them. A declared
// kidney restriction already caps sodium in `FoodTargets` (`targets.ts`), and a goal can LOWER that
// cap but never raise it, so the resolved sodium is the smaller of the two.

import type { FoodTargets, Profile } from "./types.ts";

export interface MicroGoals {
  /** At least. */
  fiber_g: number;
  /** At most. */
  sugar_g: number;
  /** At most. */
  sodium_mg: number;
}

export const MICRO_GOAL_DEFAULTS: MicroGoals = { fiber_g: 25, sugar_g: 50, sodium_mg: 2300 };

/** The largest a user may set: inputs past these are typos, not goals. */
export const MICRO_GOAL_MAX: MicroGoals = { fiber_g: 200, sugar_g: 500, sodium_mg: 10000 };

export function microGoals(
  p: Pick<Profile, "fiber_goal_g" | "sugar_goal_g" | "sodium_goal_mg">,
  targets: Pick<FoodTargets, "sodium_mg">,
): MicroGoals {
  return {
    fiber_g: p.fiber_goal_g ?? MICRO_GOAL_DEFAULTS.fiber_g,
    sugar_g: p.sugar_goal_g ?? MICRO_GOAL_DEFAULTS.sugar_g,
    sodium_mg: Math.min(p.sodium_goal_mg ?? MICRO_GOAL_DEFAULTS.sodium_mg, targets.sodium_mg ?? Infinity),
  };
}
