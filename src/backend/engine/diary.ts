// Diary reads. No writes, no model calls, no caps — the cheapest thing the API does.

import {
  DIARY_WINDOW_DAYS, explainTargets, localDate, localTime, windowStart, type DayResponse, type DayTotals,
} from "@eait/shared";
import type { EngineDeps } from "./deps.ts";
import { sumTotals } from "./meals.ts";

/**
 * Longest window the week view will return.
 *
 * Re-exported from the contract rather than declared here, because the app is TOLD this number —
 * `Limits.diaryWindowDays` — so the diary's date picker knows where its marks stop being real.
 * It bounds the MARKS and not the days: `day` below answers for any date, and the picker offers
 * every past one. Two copies of a bound one side enforces and the other draws is a picker that
 * claims "nothing logged" about days this query never covered.
 */
export const MAX_WINDOW_DAYS = DIARY_WINDOW_DAYS;

/** One day. Null when the user has no profile — the surface turns that into a 403. */
export async function day(
  deps: EngineDeps,
  userId: string,
  date?: string,
): Promise<DayResponse | null> {
  const profile = await deps.store.getProfile(userId);
  if (!profile) return null;
  const on = date ?? localDate(deps.config.timezone);
  // ORDERED BY THE CLOCK TIME EACH ROW SHOWS, not by the instant it was logged. The two agree for a
  // meal logged on its own day, and disagree for one that was not: "I had ramen yesterday" typed at
  // 09:00, or a meal moved to another day, keeps the instant it was logged — so ordering by instant
  // drew yesterday as 08:00, 19:00, 09:00. The sort is stable, so a tie keeps the store's order.
  const meals = (await deps.store.mealsForDate(userId, on))
    .map((m) => ({ m, at: localTime(deps.config.timezone, new Date(m.ts)) }))
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0))
    .map(({ m }) => m);
  return { date: on, meals, totals: sumTotals(meals), targets: explainTargets(profile).targets };
}

/** Per-day sums, most recent first. */
export async function week(
  deps: EngineDeps,
  userId: string,
  days: number,
): Promise<DayTotals[] | null> {
  const profile = await deps.store.getProfile(userId);
  if (!profile) return null;
  const today = localDate(deps.config.timezone);
  return deps.store.totalsSince(userId, windowStart(today, days));
}
