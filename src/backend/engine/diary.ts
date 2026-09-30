// The diary reads — one day, and the `from`/`to` range the Register P boards draw: Home's week
// strip, Progress's "This week" bars, and the streak.

import {
  dateMinus, dayHealthScore, explainTargets, HEALTH_RETENTION_DAYS, localDate, localTime,
  verdictInlineText, verdictLabels, windowStart,
  type DayResponse, type DiaryDay, type DaysResponse,
} from "@eait/shared";
import type { EngineDeps } from "./deps.ts";
import { sumTotals } from "./meals.ts";

/** One day. Null when the user has no profile — the surface turns that into a 403. */
export async function day(
  deps: EngineDeps,
  userId: string,
  date?: string,
): Promise<DayResponse | null> {
  const profile = await deps.store.getProfile(userId);
  if (!profile) return null;
  const on = date ?? localDate(deps.config.timezone);
  // NEWEST FIRST BY THE CLOCK TIME EACH ROW SHOWS, not by the instant it was logged. The two agree
  // for a meal logged on its own day, and disagree for one that was not: "I had ramen yesterday"
  // typed at 09:00, or a meal moved to another day, keeps the instant it was logged — so ordering
  // by instant would interleave those. A tie on the shown minute falls to the meal's ts, newest
  // first as well.
  const meals = (await deps.store.mealsForDate(userId, on))
    .map((m) => ({ m, at: localTime(deps.config.timezone, new Date(m.ts)) }))
    .sort((a, b) => (a.at > b.at ? -1 : a.at < b.at ? 1 : a.m.ts > b.m.ts ? -1 : a.m.ts < b.m.ts ? 1 : 0))
    .map(({ m }) => m)
    // The row's own words, worded HERE — the web bundle carries no i18n catalog, so a meal's
    // verdict reaches the page already composed ("calories high · saturated fat high", "" when
    // every verdict is on plan) and the pills as {dimension, tone, label}.
    .map((m) => ({ ...m, verdictInline: verdictInlineText(m.verdicts, profile.lang), verdictLabels: verdictLabels(m.verdicts, profile.lang) }));
  return {
    date: on, meals, totals: sumTotals(meals), targets: explainTargets(profile).targets,
    // The day's score is the kcal-weighted mean of the meals' own — the store attached those on
    // the read, so a meal nobody scored leaves this null rather than a six nobody earned.
    healthScore: dayHealthScore(meals),
  };
}

/**
 * The range read (#84): every calendar day of `[from, to]` — logged days carrying their kcal,
 * empty past days zeroed, future days null — the account's logged-day streak, and its calorie
 * target sent once.
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

  const rows = await deps.store.totalsSince(userId, windowStart(today, HEALTH_RETENTION_DAYS));
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

  return { days: out, targetKcal, streak };
}
