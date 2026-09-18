// Daily series → the points a chart draws, and how two of them relate.
//
// The health screen shows a metric by day, by week, by month or by year, and compares two series
// against each other. All of that is arithmetic on `YYYY-MM-DD` rows, and arithmetic in a React
// component is arithmetic no test ever runs — so it lives here, beside `health.ts`, and the screen
// only draws what this file hands it.
//
// ONE RULE FOR EVERY BUCKET: the mean of the days that have a reading, and null when none do.
// Weekly average weight is the number a weight-loss plan is judged by, and average steps PER DAY
// is what makes a week and a month comparable on one axis — a monthly TOTAL would be four times a
// weekly one and say nothing about whether the user moved more. Null stays null: a bucket with no
// reading is a gap in the line, never a zero, for the same reason `HealthDay` fields are.

import { dateMinus, monthOf, monthShift, windowStart } from "./dates.ts";
import type { HealthDay, HealthMetric } from "./health.ts";
import { HEALTH_COPY } from "./health-copy.ts";
import { LANG_TAG, t } from "./lang.ts";
import type { DayTotals, Lang } from "./types.ts";

/** The four x-axes, as ids. The words for them are per language — see `trendPeriods`. */
export const TREND_PERIOD_IDS = ["days", "weeks", "months", "years"] as const;

export type TrendPeriod = (typeof TREND_PERIOD_IDS)[number];

/**
 * The four x-axes WITH THEIR WORDS. A function of the language, not a constant, for the reason
 * every other table here is one: a constant is what a screen captures at module scope and then
 * renders in whatever language the process started in. These four shipped as English literals
 * inside a screen that was otherwise translated, and no check could see it — they are not
 * `Localized<T>`, so `localizedGaps` walks straight past them.
 */
export const trendPeriods = (lang: Lang): readonly { id: TrendPeriod; label: string; noun: string }[] =>
  TREND_PERIOD_IDS.map((id) => ({ id, ...t(lang)(HEALTH_COPY).periods[id] }));

/** How many buckets each period draws. Years is open-ended: every year that has stored data. */
const BUCKETS: Record<Exclude<TrendPeriod, "years">, number> = { days: 30, weeks: 26, months: 12 };

/** One span on the x-axis, inclusive on both ends. */
export interface TrendBucket {
  start: string;
  end: string;
  /** What the axis prints for it. */
  label: string;
}

/** One day's reading of one thing. Null is unknown, never zero. */
export interface DailyPoint {
  date: string;
  value: number | null;
}

/** One drawn point: the bucket, its mean, and how many days went into it. */
export interface TrendPoint extends TrendBucket {
  value: number | null;
  n: number;
}

/** Midday UTC, so a date-only value cannot slip a day while being formatted — as `dayLabel` does. */
const noon = (date: string) => new Date(`${date}T12:00:00Z`);
/**
 * The axis labels, in the reader's own language rather than in en-GB.
 *
 * `en-US`, NOT `en-GB`, for English only: the British short form of September is "Sept", one letter
 * wider than every other month, and it is the one label on an axis of twelve that would then wrap.
 * `LANG_TAG.en` is `en-GB` because this product is metric and in Berlin, so the exception is spelled
 * out here rather than fixed there — the date format and the unit system are different questions,
 * and `targets.ts` is the reason that distinction is kept sharp.
 */
const dayMonth = (lang: Lang) =>
  new Intl.DateTimeFormat(LANG_TAG[lang], { timeZone: "UTC", day: "numeric", month: "short" });
const monthShort = (lang: Lang) =>
  new Intl.DateTimeFormat(lang === "en" ? "en-US" : LANG_TAG[lang], { timeZone: "UTC", month: "short" });

/**
 * The buckets a period draws, OLDEST FIRST — chart order, left to right. The last bucket always
 * contains `today`, even when it has not finished.
 *
 * Weeks run Monday to Sunday, matching `monthGrid`: this app's zone is Europe/Berlin and ISO weeks
 * start on Monday. Years run from the year of the oldest day the window covers, so the axis never
 * offers a year the store cannot have a row for.
 *
 * THE THIRD ARGUMENT IS A LENGTH IN DAYS, NOT A DATE, AND THAT IS THE WHOLE POINT. It used to be
 * an `oldest` date, so keeping the promise above was the CALLER's job — and `app/health.tsx` got
 * it wrong, passing the window rows may be STORED in rather than the one they can be SERVED from.
 * One day wider, which drew a permanently empty leading year bar on 31 December 2025, 2026, 2027
 * and 2029, and on 30 December 2028. A grep test was written to police the call sites; taking the
 * length instead and deriving the date here makes the wrong call unrepresentable, which is
 * smaller, covers the backend and `src/scripts/` too, and is checked by `bun run typecheck`.
 *
 * THE FOURTH IS THE ACCOUNT'S OLDEST ROW, AND IT ONLY EVER NARROWS THE YEARS AXIS. A new account
 * drew five permanently empty leading bars, because the axis knew the window but not when the
 * rows START. It cannot widen the axis past the served window — the promise above outranks it —
 * so the two clamps compose rather than fight. Pass every series the chart draws (`oldestDate`):
 * an axis derived from one of them silently drops the other's older rows in `bucketSeries`.
 */
export function trendBuckets(
  period: TrendPeriod, today: string, days: number, lang: Lang, oldestRow?: string,
): TrendBucket[] {
  const dayAxis = dayMonth(lang);
  const monthAxis = monthShort(lang);
  switch (period) {
    case "days":
      return Array.from({ length: BUCKETS.days }, (_, i) => {
        const date = dateMinus(today, BUCKETS.days - 1 - i);
        return { start: date, end: date, label: dayAxis.format(noon(date)) };
      });
    case "weeks": {
      // getUTCDay is 0 for Sunday; shift so Monday is 0.
      const monday = dateMinus(today, (noon(today).getUTCDay() + 6) % 7);
      return Array.from({ length: BUCKETS.weeks }, (_, i) => {
        const start = dateMinus(monday, 7 * (BUCKETS.weeks - 1 - i));
        return { start, end: dateMinus(start, -6), label: dayAxis.format(noon(start)) };
      });
    }
    case "months":
      return Array.from({ length: BUCKETS.months }, (_, i) => {
        const month = monthShift(monthOf(today), i - (BUCKETS.months - 1));
        const start = `${month}-01`;
        // The day before the next month's first: the only way to get February right every year.
        return { start, end: dateMinus(`${monthShift(month, 1)}-01`, 1), label: monthAxis.format(noon(start)) };
      });
    case "years": {
      // Derived HERE and not above: the other three periods have a fixed bucket count and never
      // read the window, so computing a date for them is a `Date.UTC` and a `toISOString` paid on
      // every axis rebuild for nothing.
      const served = Number(windowStart(today, days).slice(0, 4));
      const to = Number(today.slice(0, 4));
      // `Math.min` with today's year is not belt-and-braces: a phone whose clock runs behind the
      // server holds a row dated after `today`, and without it the axis counts backwards to
      // nothing and every chart reads "Nothing in this period".
      const from = Math.min(to, oldestRow ? Math.max(served, Number(oldestRow.slice(0, 4))) : served);
      return Array.from({ length: to - from + 1 }, (_, i) => {
        const y = String(from + i);
        return { start: `${y}-01-01`, end: `${y}-12-31`, label: y };
      });
    }
  }
}

/**
 * The earliest date across several daily series, or undefined when all of them are empty — what
 * `trendBuckets` wants for its fourth argument. Rows arrive newest-first, so this is a `min` and
 * not a `[0]`.
 */
export function oldestDate(...series: readonly (readonly { date: string }[])[]): string | undefined {
  let oldest: string | undefined;
  for (const rows of series) for (const r of rows) if (oldest === undefined || r.date < oldest) oldest = r.date;
  return oldest;
}

/** Mean of the known days in each bucket, rounded to `decimals`. See the header for why a mean. */
export function bucketSeries(
  points: readonly DailyPoint[],
  buckets: readonly TrendBucket[],
  decimals: number,
): TrendPoint[] {
  const sum = new Array<number>(buckets.length).fill(0);
  const n = new Array<number>(buckets.length).fill(0);
  for (const p of points) {
    if (p.value === null) continue;
    // Buckets are contiguous and sorted, so a plain scan is fine: 1,800 days × 30 buckets is
    // nothing, and it stays obviously correct.
    const i = buckets.findIndex((b) => p.date >= b.start && p.date <= b.end);
    if (i === -1) continue;
    sum[i]! += p.value;
    n[i]! += 1;
  }
  const f = 10 ** decimals;
  return buckets.map((b, i) => ({
    ...b,
    value: n[i] === 0 ? null : Math.round((sum[i]! / n[i]!) * f) / f,
    n: n[i]!,
  }));
}

/** The first and the latest bucket that HAVE a value. Null when none does. */
export function trendEndpoints(
  points: readonly TrendPoint[],
): { first: TrendPoint; latest: TrendPoint } | null {
  const known = points.filter((p) => p.value !== null);
  const first = known[0];
  const latest = known[known.length - 1];
  return first && latest ? { first, latest } : null;
}

/**
 * The chart as one sentence, for VoiceOver. A chart is an image to a screen reader, and an image
 * of a weight trend that says "image" is a screen that shows the user with low vision nothing at
 * all about the thing they came for.
 */
export function trendSummary(
  name: string,
  period: TrendPeriod,
  points: readonly TrendPoint[],
  format: (value: number) => string,
  lang: Lang,
): string {
  const copy = t(lang)(HEALTH_COPY);
  // `per`, not `noun`: Russian's `по` governs the dative plural — see `HealthCopy`.
  const noun = copy.periods[period].per;
  const fill = (template: string, into: Record<string, string>) =>
    Object.entries(into).reduce((out, [k, v]) => out.replaceAll(`{${k}}`, v), template);

  const ends = trendEndpoints(points);
  if (!ends) return fill(copy.summary.empty, { name, noun });
  const values = points.flatMap((p) => (p.value === null ? [] : [p.value]));
  return fill(copy.summary.line, {
    name, noun,
    first: format(ends.first.value!), firstAt: ends.first.label,
    last: format(ends.latest.value!), lastAt: ends.latest.label,
    low: format(Math.min(...values)), high: format(Math.max(...values)),
  });
}

export interface Correlation {
  /** Pearson's r, to two decimals. */
  r: number;
  /** How many buckets were known on both sides. */
  n: number;
}

/** Fewer points than this and r is a coin toss dressed as a finding. */
const MIN_OVERLAP = 5;

/**
 * Pearson's r over the buckets known on BOTH sides. Null when too few overlap, or when one side is
 * flat — a series that never moves has no relationship to anything, and dividing by its zero
 * spread would say NaN rather than that.
 */
export function correlate(a: readonly TrendPoint[], b: readonly TrendPoint[]): Correlation | null {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const x = a[i]!.value;
    const y = b[i]!.value;
    if (x === null || y === null) continue;
    xs.push(x);
    ys.push(y);
  }
  const n = xs.length;
  if (n < MIN_OVERLAP) return null;

  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - mx;
    const dy = ys[i]! - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return null;
  return { r: Math.round((sxy / Math.sqrt(sxx * syy)) * 100) / 100, n };
}

/**
 * The relationship in words. A bare "r = 0.46" is a number most people have to look up; the
 * sentence is what the caption prints, and the number sits beside it for those who want it.
 */
export function correlationWords(r: number, lang: Lang): string {
  const copy = t(lang)(HEALTH_COPY).correlation;
  const size = Math.abs(r);
  if (size < 0.2) return copy.none;
  const strength = size < 0.5 ? copy.weak : size < 0.8 ? copy.moderate : copy.strong;
  const direction = r > 0 ? copy.together : copy.opposed;
  // The THRESHOLDS stay here and only the words move: which band a coefficient falls in is a claim
  // about the arithmetic, and a translator has no business moving 0.5.
  return copy.sentence.replace("{strength}", strength).replace("{direction}", direction);
}

/**
 * A cached per-day series brought up to date with a fresh read of its recent window.
 *
 * The health screen paints from the cache and revalidates behind it, and revalidating five years
 * on every visit is two hundred kilobytes for a week that can have changed: the sync re-reads
 * `HEALTH_SYNC_LOOKBACK_DAYS`, and a meal is edited on a recent day. So the full window is read
 * once a session and every later visit reads only from `since`. Fresh rows REPLACE the cached
 * window rather than merge into it — a day the server no longer has is a day that is gone.
 */
export function mergeSince<T extends { date: string }>(
  cached: readonly T[],
  fresh: readonly T[],
  since: string,
): T[] {
  // And never two rows for one date: `since` is computed on the phone and the window on the
  // server, and a day of disagreement between them must not double a day.
  const replaced = new Set(fresh.map((r) => r.date));
  const kept = cached.filter((r) => r.date < since && !replaced.has(r.date));
  return [...fresh, ...kept].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/** One metric's column, as a daily series. */
export function metricSeries(days: readonly HealthDay[], metric: HealthMetric): DailyPoint[] {
  return days.map((d) => ({ date: d.date, value: d[metric] }));
}

/**
 * The five things the compare card can put against each other.
 *
 * Unit and decimals are here so `formatHealthValue` can print them; `burned` and `intake` are not
 * health fields and have no spec of their own.
 */
export const COMPARE_SERIES = [
  { id: "intake", label: "Intake", unit: "kcal", decimals: 0 },
  { id: "burned", label: "Burned", unit: "kcal", decimals: 0 },
  { id: "sleep", label: "Sleep", unit: "min", decimals: 0 },
  { id: "steps", label: "Steps", unit: "", decimals: 0 },
  { id: "exercise", label: "Exercise", unit: "min", decimals: 0 },
] as const;

export type CompareSeriesId = (typeof COMPARE_SERIES)[number]["id"];

/**
 * One compare series, as daily points.
 *
 * `burned` is active plus resting energy and is unknown when EITHER half is: reporting a day's
 * active energy alone as "burned" understates it by the whole basal figure and draws a cliff on the
 * chart that never happened. `intake` is the diary's own totals — a day with no meals logged is not
 * a day of eating nothing, so it is absent rather than zero.
 */
export function compareSeries(
  id: CompareSeriesId,
  health: readonly HealthDay[],
  intake: readonly DayTotals[],
): DailyPoint[] {
  switch (id) {
    case "intake":
      return intake.map((d) => ({ date: d.date, value: d.kcal }));
    case "burned":
      return health.map((d) => ({
        date: d.date,
        value: d.active_kcal === null || d.resting_kcal === null ? null : d.active_kcal + d.resting_kcal,
      }));
    case "sleep":
      return metricSeries(health, "asleep_minutes");
    case "steps":
      return metricSeries(health, "steps");
    case "exercise":
      return metricSeries(health, "exercise_minutes");
  }
}
