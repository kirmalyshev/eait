// The diary reads — one day, the (deprecated) rolling window, and the `from`/`to` range the
// Register P boards draw: Home's week strip, Progress's "This week" bars, and the streak.

import {
  dateMinus, DIARY_WINDOW_DAYS, explainTargets, localDate, localTime, windowStart, type DayResponse,
  type DayTotals, type DiaryDay, type DaysResponse,
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
 *
 * DEPRECATED (#103) with the route it bounds — kept for the App Store binary in the field. New
 * work reads the `from`/`to` range below.
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

/**
 * DEPRECATED (#103). The rolling per-day totals the old picker and health screen read — days that
 * have meals, newest first, over the last `days` days. The range read below supersedes it.
 */
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

/**
 * The range read (#84): every calendar day of `[from, to]` — logged days carrying their macro
 * sums, empty past days zeroed, future days null — and the account's logged-day streak.
 *
 * Two reads of the same rows. The page fills `[from, to]` one row per day because the strip draws
 * a day whether or not it has meals; the streak walks the same list backwards from today (or from
 * yesterday while today is still open — a day that has not ended has not broken anything), so the
 * store is asked for the whole diary horizon and the answer is computed here rather than by any
 * client counting days itself.
 *
 * THE WINDOW ASKED FOR IS THE WHOLE HORIZON, not `[from, to]`: a run can be older than the strip
 * being drawn, and a streak that stopped answering at `from` would say 7 to somebody on day 40.
 * `totalsSince` returns only days that have meals, which is also exactly the set the streak walks
 * — "a day with nothing produces NO ROW" is the same rule that makes the walk stop at a gap.
 */
export async function days(
  deps: EngineDeps,
  userId: string,
  from: string,
  to: string,
): Promise<DaysResponse | null> {
  const profile = await deps.store.getProfile(userId);
  if (!profile) return null;
  const zone = deps.config.timezone;
  const today = localDate(zone);
  const targetKcal = explainTargets(profile).targets.kcal;

  const rows = await deps.store.totalsSince(userId, windowStart(today, DIARY_WINDOW_DAYS));
  const totals = new Map(rows.filter((r) => r.date <= to && r.date >= from).map((r) => [r.date, r]));

  const out: DiaryDay[] = [];
  for (let d = from; d <= to; d = dateMinus(d, -1)) {
    const future = d > today;
    const row = totals.get(d);
    out.push({
      date: d,
      when: d === today ? "today" : future ? "future" : "past",
      logged: !future && row !== undefined,
      kcal: future ? null : row?.kcal ?? 0,
      protein_g: future ? null : row?.protein_g ?? 0,
      carbs_g: future ? null : row?.carbs_g ?? 0,
      fat_g: future ? null : row?.fat_g ?? 0,
      satfat_g: future ? null : row?.satfat_g ?? 0,
      targetKcal,
    });
  }

  // The streak: consecutive logged days ending today — or yesterday, while today is still open.
  // Dates only: a meal's `date` is already the account's zone, so one logged past local midnight
  // belongs to the day the user is in, which is the boundary this must not get wrong.
  const loggedDates = new Set(rows.filter((r) => r.date <= today).map((r) => r.date));
  let streak = 0;
  for (let d = loggedDates.has(today) ? today : dateMinus(today, 1); loggedDates.has(d); d = dateMinus(d, 1)) {
    streak++;
  }

  return { days: out, streak };
}
