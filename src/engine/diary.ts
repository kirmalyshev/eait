// Diary reads. The bot barely needs these — its cards carry totals inline — but a mobile client is
// mostly a reader, so this is where the two surfaces diverge most in what they ask for.

import { berlinDate, berlinDateMinus, dailyTotals, mealsOnDate, totalsByDate, getUser } from "../db.ts";
import { targetsFor } from "../targets.ts";
import { profileFromRow } from "./profile.ts";
import type { EngineDeps, UserId } from "./deps.ts";
import type { DailyTotals, DayTotals, FoodTargets, MealRecord } from "../types.ts";

export interface DayView {
  date: string;
  meals: MealRecord[];
  totals: DailyTotals;
  targets: FoodTargets;
}

/**
 * One day's meals with its totals and the user's caps.
 *
 * `date` defaults to today in **Europe/Berlin**, never UTC — the midnight boundary a meal is filed
 * against is the user's, and a UTC default would move every late-evening meal into the next day for
 * anyone west of the line.
 */
export async function day(
  deps: EngineDeps,
  userId: UserId,
  date?: string,
): Promise<DayView | null> {
  const u = await getUser(deps.db, userId);
  if (!u || u.state !== "active") return null;
  const on = date ?? berlinDate(new Date(), deps.config.tz);
  return {
    date: on,
    meals: await mealsOnDate(deps.db, userId, on),
    totals: await dailyTotals(deps.db, userId, on),
    targets: targetsFor(profileFromRow(u)),
  };
}

/** Widest window a single call may scan. A chart does not need more, and an unbounded `days` is an
 * unbounded query on a table that only grows. */
export const MAX_WINDOW_DAYS = 90;

/**
 * Trailing-window kcal/protein by date, for a chart. Default 7 days, matching the router's view.
 *
 * Bounds `days` ITSELF rather than trusting the caller. `api/` validates too and returns a 400,
 * which is the better error — but the engine is the contract, and a second front end that forgets
 * to validate must not be able to ask for ten years of rows.
 */
export async function week(
  deps: EngineDeps,
  userId: UserId,
  days = 7,
): Promise<DayTotals[] | null> {
  if (!Number.isInteger(days) || days < 1 || days > MAX_WINDOW_DAYS) {
    throw new Error(`engine/diary: days must be an integer in [1, ${MAX_WINDOW_DAYS}], got ${days}`);
  }
  const u = await getUser(deps.db, userId);
  if (!u || u.state !== "active") return null;
  const to = berlinDate(new Date(), deps.config.tz);
  // Calendar subtraction, DST-safe — never `Date.now() - n*86_400_000`, which is off by one across
  // a transition near midnight.
  return totalsByDate(deps.db, userId, berlinDateMinus(to, days), to);
}
