// Diary reads. No writes, no model calls, no caps — the cheapest thing the API does.

import { explainTargets, type DayResponse, type DayTotals } from "@ieat/shared";
import { dateMinus, localDate } from "../dates.ts";
import type { EngineDeps } from "./deps.ts";
import { sumTotals } from "./meals.ts";

/** Longest window the week view will return. A client asking for a year is a client with a bug. */
export const MAX_WINDOW_DAYS = 90;

/** One day. Null when the user has no profile — the surface turns that into a 403. */
export async function day(
  deps: EngineDeps,
  userId: string,
  date?: string,
): Promise<DayResponse | null> {
  const profile = await deps.store.getProfile(userId);
  if (!profile) return null;
  const on = date ?? localDate(deps.config.timezone);
  const meals = await deps.store.mealsForDate(userId, on);
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
  return deps.store.totalsSince(userId, dateMinus(today, days - 1));
}
