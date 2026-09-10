// Health metrics imported from the phone's health store, and the arithmetic that turns raw samples
// into the daily rows this product actually keeps.
//
// THE DIVISION OF LABOUR HERE IS THE POINT. The native adapter's entire job is to hand back
// `HealthSample[]` — a list of numbers with instants attached. Everything after that is arithmetic,
// and arithmetic is where the bugs are: which day a night's sleep belongs to, what happens across a
// DST boundary, a scale that reported twice, a watch that backfilled a week late. None of that
// should need a simulator to test, so none of it lives on the phone side of the port.
//
// Nothing here imports from `src/backend` or `src/mobile`. The app aggregates, the server
// validates, and both do it with this file.

import { isCalendarDate, localDate } from "./dates.ts";

/** The metric groups, in render order. One list, so a screen cannot invent a sixth. */
export const HEALTH_GROUPS = [
  { id: "body", label: "Body" },
  { id: "energy", label: "Energy" },
  { id: "activity", label: "Activity" },
  { id: "sleep", label: "Sleep" },
  { id: "cardio", label: "Heart" },
] as const;

export type HealthGroup = (typeof HEALTH_GROUPS)[number]["id"];

/**
 * How a day's samples become one number.
 *
 * `last`  — the most recent reading of the day wins. Correct for anything measured rather than
 *           accumulated: a mean of this morning's 94 kg and this evening's 92 kg reports 93 kg,
 *           a weight the scale never showed and the user never had.
 * `sum`   — the day's total. Correct for anything accumulated: energy, steps, distance, minutes.
 * `count` — how many samples there were, ignoring their values. Workouts.
 */
export type HealthAgg = "last" | "sum" | "count";

/**
 * Which end of a sample decides the calendar day it lands on.
 *
 * Everything is attributed by its START except sleep, which is attributed by its END — a night that
 * begins on the 10th and ends on the 11th is the 11th's sleep. That is the day the user is rested
 * from, it is what Health itself shows, and attributing it to the 10th would put the night's sleep
 * on a row alongside the food eaten before it rather than the day it belongs to.
 */
export type HealthAttribution = "start" | "end";

export interface HealthFieldSpec {
  key: HealthMetric;
  group: HealthGroup;
  /** What the screen calls it. */
  label: string;
  unit: string;
  decimals: number;
  agg: HealthAgg;
  attribute: HealthAttribution;
  /**
   * The plausible range, INCLUSIVE. A reading outside it is dropped rather than stored.
   *
   * This is not tidiness. `weight_kg` feeds the calorie target, so one implausible sample — a scale
   * reporting 0, or grams misread as kilograms — is a recomputed plan built on a number nobody
   * weighed. Dropping the sample loses one reading; keeping it loses the target.
   */
  min: number;
  max: number;
  typical: readonly [number, number];
}

/**
 * One day's health, as this product keeps it: aggregates only, never raw samples.
 *
 * WIDE ROW ON PURPOSE, rather than a `(metric, value)` table. Adding a metric here is a column AND a
 * contract field, so it breaks the server and the app in one `bun run typecheck`. An EAV table
 * happily accepts a metric that nothing renders and reports success.
 *
 * Every field is `number | null` and null means UNKNOWN, never zero. "No step data" and "did not
 * move" are different claims, and a trend that renders the first as the second draws a confident
 * line through every day the phone was left at home.
 */
export interface HealthDay {
  date: string; // YYYY-MM-DD, in the server's configured zone

  // Body
  weight_kg: number | null;
  height_cm: number | null;
  body_fat_pct: number | null;
  lean_mass_kg: number | null;

  // Energy
  active_kcal: number | null;
  resting_kcal: number | null;

  // Activity
  steps: number | null;
  exercise_minutes: number | null;
  workouts: number | null;
  distance_km: number | null;

  // Sleep
  asleep_minutes: number | null;
  in_bed_minutes: number | null;

  // Cardio
  resting_hr_bpm: number | null;
  hrv_ms: number | null;
  vo2max: number | null;
}

/** Every metric name. Derived from `HealthDay`, so the two can never drift apart. */
export type HealthMetric = Exclude<keyof HealthDay, "date">;

/**
 * The field table — the single list every renderer, aggregator and validator iterates.
 *
 * `satisfies` ties each `key` to `HealthDay`, so a typo or a removed field is a compile error
 * rather than a column that silently stops appearing. Same idiom as `VERDICT_DIMENSIONS`, and for
 * the same reason: the failure it prevents is a row quietly missing from a screen, which nobody
 * reports as a bug because nobody knows it was supposed to be there.
 */
export const HEALTH_FIELDS = [
  { key: "weight_kg", group: "body", label: "Weight", unit: "kg", decimals: 1, agg: "last", attribute: "start", min: 20, max: 500, typical: [91, 94] },
  { key: "height_cm", group: "body", label: "Height", unit: "cm", decimals: 0, agg: "last", attribute: "start", min: 50, max: 260, typical: [183, 183] },
  { key: "body_fat_pct", group: "body", label: "Body fat", unit: "%", decimals: 1, agg: "last", attribute: "start", min: 1, max: 75, typical: [22, 26] },
  { key: "lean_mass_kg", group: "body", label: "Lean mass", unit: "kg", decimals: 1, agg: "last", attribute: "start", min: 10, max: 200, typical: [66, 70] },

  { key: "active_kcal", group: "energy", label: "Active energy", unit: "kcal", decimals: 0, agg: "sum", attribute: "start", min: 0, max: 20_000, typical: [250, 780] },
  { key: "resting_kcal", group: "energy", label: "Resting energy", unit: "kcal", decimals: 0, agg: "sum", attribute: "start", min: 0, max: 10_000, typical: [1650, 1780] },

  { key: "steps", group: "activity", label: "Steps", unit: "", decimals: 0, agg: "sum", attribute: "start", min: 0, max: 200_000, typical: [3_000, 14_000] },
  { key: "exercise_minutes", group: "activity", label: "Exercise", unit: "min", decimals: 0, agg: "sum", attribute: "start", min: 0, max: 1_440, typical: [0, 65] },
  { key: "workouts", group: "activity", label: "Workouts", unit: "", decimals: 0, agg: "count", attribute: "start", min: 0, max: 50, typical: [0, 1] },
  { key: "distance_km", group: "activity", label: "Distance", unit: "km", decimals: 1, agg: "sum", attribute: "start", min: 0, max: 500, typical: [2, 11] },

  // Attributed by END — see `HealthAttribution`.
  { key: "asleep_minutes", group: "sleep", label: "Asleep", unit: "min", decimals: 0, agg: "sum", attribute: "end", min: 0, max: 1_440, typical: [360, 510] },
  { key: "in_bed_minutes", group: "sleep", label: "In bed", unit: "min", decimals: 0, agg: "sum", attribute: "end", min: 0, max: 1_440, typical: [370, 550] },

  { key: "resting_hr_bpm", group: "cardio", label: "Resting heart rate", unit: "bpm", decimals: 0, agg: "last", attribute: "start", min: 20, max: 200, typical: [52, 64] },
  { key: "hrv_ms", group: "cardio", label: "HRV", unit: "ms", decimals: 0, agg: "last", attribute: "start", min: 1, max: 500, typical: [30, 85] },
  { key: "vo2max", group: "cardio", label: "VO2 max", unit: "ml/kg/min", decimals: 1, agg: "last", attribute: "start", min: 5, max: 100, typical: [38, 43] },
] as const satisfies readonly HealthFieldSpec[];

const FIELD_BY_KEY: ReadonlyMap<string, HealthFieldSpec> =
  new Map(HEALTH_FIELDS.map((f) => [f.key, f]));

export function healthField(metric: string): HealthFieldSpec | undefined {
  return FIELD_BY_KEY.get(metric);
}

/** The fields of one group, in table order. What a trend card iterates. */
export function fieldsInGroup(group: HealthGroup): readonly HealthFieldSpec[] {
  return HEALTH_FIELDS.filter((f) => f.group === group);
}

/**
 * The fields of one group that ANY day in the window carries a value for, in table order.
 *
 * THE WINDOW, NOT THE NEWEST DAY. Most of these metrics are not daily: a scale is stepped on some
 * mornings, VO2 max is re-estimated every few weeks, body fat comes from a device that is not
 * always the one to hand. Choosing what to render from the newest day alone drops all of them the
 * moment that day happens to carry only steps — which is most days, and always the ones before the
 * user has weighed in. The row itself then shows the most recent reading it has, so the screen says
 * "92.1 kg" from yesterday rather than saying nothing about weight at all.
 *
 * The other direction still holds: a metric no day in the window carries is dropped, because a card
 * of rows the user has never recorded is a screen that looks broken.
 */
export function fieldsWithData(
  group: HealthGroup,
  days: readonly HealthDay[],
): readonly HealthFieldSpec[] {
  // `!= null` rather than truthiness: zero steps is a measurement — the phone was carried and the
  // user did not move — and it is not the same statement as having no step data at all.
  return fieldsInGroup(group).filter((f) => days.some((d) => d[f.key] != null));
}

/**
 * One reading, as a person reads it.
 *
 * Minutes are the unit HealthKit stores sleep in and they are not a unit anybody thinks in: the
 * screen printed "Asleep 387 min" and "In bed 427 min", which is a subtraction and a division away
 * from the two numbers the user came for. Everything else keeps its own unit — 11 minutes of
 * exercise is 11 minutes, and a step count is a count.
 */
export function formatHealthValue(
  spec: Pick<HealthFieldSpec, "unit" | "decimals">,
  value: number,
): string {
  if (spec.unit === "min" && value >= 60) {
    const whole = Math.round(value);
    return `${Math.floor(whole / 60)} h ${whole % 60} m`;
  }
  return `${value.toFixed(spec.decimals)}${spec.unit ? ` ${spec.unit}` : ""}`;
}

/** What one metric's row on the trend screen shows. See `metricTrend`. */
export interface MetricTrend {
  /** The most recent reading in the window, from the most recent day that HAS one. */
  latest: number;
  /**
   * How far `latest` sits from the mean of the OTHER days, or null when there are none.
   *
   * Null rather than zero, and the difference matters on screen: "no change" is a claim about a
   * comparison that happened, and one reading supports no comparison at all. Rendering a confident
   * zero from a single data point is the same lie as drawing a flat line through days on which
   * nothing was recorded.
   */
  delta: number | null;
  /** True when `delta` is outside the noise band and therefore worth drawing an arrow for. */
  moved: boolean;
}

/**
 * One metric's row: the latest reading, and where it sits against the rest of the window.
 *
 * THE BASELINE EXCLUDES THE READING BEING JUDGED. A mean taken over every day including today is a
 * baseline today has already moved, so every change is understated by a factor of (n-1)/n — worst
 * exactly when the window is short, which is every new user's first week.
 *
 * Here rather than in the screen because it is arithmetic, and arithmetic in a React component is
 * arithmetic no test ever runs.
 */
export function metricTrend(
  spec: HealthFieldSpec,
  days: readonly HealthDay[],
): MetricTrend | null {
  const values: number[] = [];
  for (const d of days) {
    const v = d[spec.key];
    if (v !== null) values.push(v);
  }
  const latest = values[0];
  if (latest === undefined) return null;

  const rest = values.slice(1);
  if (rest.length === 0) return { latest, delta: null, moved: false };

  const mean = rest.reduce((n, v) => n + v, 0) / rest.length;
  const delta = round(latest - mean, spec.decimals);
  // A ±2% band reads as "no change". Below that an arrow is noise dressed as a signal.
  return { latest, delta, moved: Math.abs(delta) > Math.abs(mean) * 0.02 };
}

/** A day with nothing known about it. Every metric null — null is unknown, never zero. */
export function emptyHealthDay(date: string): HealthDay {
  const day = { date } as HealthDay;
  for (const f of HEALTH_FIELDS) day[f.key] = null;
  return day;
}

/** True when nothing at all is known. Such a day is never sent and never stored. */
export function healthDayIsEmpty(day: HealthDay): boolean {
  // Explicitly `=== null`, not falsy: zero steps is a measurement — the phone was carried and the
  // user did not move — and it is not the same statement as having no step data at all.
  return HEALTH_FIELDS.every((f) => day[f.key] === null);
}

/** One reading, as the native adapter hands it over. */
export interface HealthSample {
  metric: HealthMetric;
  /** ISO instant the sample begins. Equal to `end` for a point-in-time reading. */
  start: string;
  /** ISO instant the sample ends. */
  end: string;
  value: number;
  /**
   * What recorded it — the source's bundle identifier, when the platform says.
   *
   * Carried for ONE reason: a phone and a watch both record steps, distance and active energy for
   * the same period, and a day's samples therefore describe that day more than once. See
   * `reduceSamples`. Optional because not every source has one to give, and a build that omits it
   * behaves exactly as this file did before the field existed.
   */
  source?: string;
}

/**
 * Raw samples → daily rows, in the given zone. Most recent day first.
 *
 * The zone is an ARGUMENT and comes from the server (`ProfileResponse.timezone`), not from the
 * device. If the phone aggregated in its own zone while the server dated meals in its configured
 * one, a day's food and that same day's health would describe two different twenty-four-hour
 * windows — invisibly, only for people who travel, and never reproducibly for whoever goes looking.
 */
export function aggregateDays(samples: readonly HealthSample[], zone: string): HealthDay[] {
  /** date → metric → the samples that landed there. */
  const byDate = new Map<string, Map<HealthMetric, HealthSample[]>>();

  for (const s of samples) {
    const spec = FIELD_BY_KEY.get(s.metric);
    if (!spec) continue; // A metric this build has no field for. Dropped, not guessed at.
    if (typeof s.value !== "number" || !Number.isFinite(s.value)) continue;
    if (s.value < spec.min || s.value > spec.max) continue;

    const instant = new Date(spec.attribute === "end" ? s.end : s.start);
    if (Number.isNaN(instant.getTime())) continue;
    const date = localDate(zone, instant);

    let metrics = byDate.get(date);
    if (!metrics) byDate.set(date, (metrics = new Map()));
    const list = metrics.get(s.metric);
    if (list) list.push(s);
    else metrics.set(s.metric, [s]);
  }

  const days: HealthDay[] = [];
  for (const [date, metrics] of byDate) {
    const day = emptyHealthDay(date);
    for (const [metric, list] of metrics) {
      const spec = FIELD_BY_KEY.get(metric)!;
      day[metric] = reduceSamples(list, spec);
    }
    if (!healthDayIsEmpty(day)) days.push(day);
  }

  // Most recent first, matching `totalsSince` — the other per-day series in this product.
  days.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return days;
}

function reduceSamples(list: readonly HealthSample[], spec: HealthFieldSpec): number {
  if (spec.agg === "last") {
    // The reading with the latest end, tie-broken on start so two samples closed at the same
    // instant still order deterministically rather than by whatever order the query returned them
    // in. Which SOURCE it came from does not matter: the most recent weight is the most recent
    // weight whether the scale or the user's own thumb put it there.
    let best = list[0]!;
    for (const s of list) {
      if (s.end > best.end || (s.end === best.end && s.start > best.start)) best = s;
    }
    return round(best.value, spec.decimals);
  }

  // ── accumulated metrics, and the second recorder ──
  //
  // A phone and a watch worn on the same day both record steps, distance and active energy for the
  // same hours; two fitness apps both record the same workout; a watch and a sleep app both record
  // the same night. Adding every sample up reports each of those roughly twice — and Health, which
  // de-duplicates by preferring one source, shows the user the other number on the same day. Sleep
  // is worse than overstated: past 1440 minutes `sanitizeHealthDay` nulls it, so a doubled night
  // leaves the screen with no sleep on it at all.
  //
  // So: total each source separately, and take the LARGEST. Within one source the samples are the
  // consecutive pieces of one record — Apple's own sleep stages, a day's step buckets — and summing
  // them is exactly right. Across sources they are competing accounts of the same hours, and the
  // fullest account is the best single answer available without a source-priority list, which
  // HealthKit does not hand out. It can under-count when two sources genuinely cover different
  // parts of a day (a watch worn only in the evening). That direction is the right one to be wrong
  // in: an understated total looks like a quiet day, an overstated one looks like a broken app.
  const perSource = new Map<string, number>();
  for (const s of list) {
    // Absent source = one unnamed source, so a client that never sends the field sums as before.
    const key = s.source ?? "";
    perSource.set(key, (perSource.get(key) ?? 0) + (spec.agg === "count" ? 1 : s.value));
  }
  return round(Math.max(...perSource.values()), spec.decimals);
}

function round(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

/**
 * Server-side validation of a day the client sent. Returns null for a day not worth storing.
 *
 * A bad METRIC is nulled; a bad DAY is refused. That asymmetry is deliberate: one implausible
 * reading out of fifteen is no reason to lose the other fourteen, and answering 422 would make the
 * phone retry a batch that can never succeed. A date that is not a date, though, has nowhere to go
 * — it would become a row keyed on a string no query will ever match.
 */
export function sanitizeHealthDay(day: HealthDay): HealthDay | null {
  if (typeof day?.date !== "string" || !isCalendarDate(day.date)) return null;

  const out = emptyHealthDay(day.date);
  for (const f of HEALTH_FIELDS) {
    const v = day[f.key];
    if (typeof v !== "number" || !Number.isFinite(v)) continue; // covers null, undefined, "8000"
    if (v < f.min || v > f.max) continue;
    out[f.key] = round(v, f.decimals);
  }

  return healthDayIsEmpty(out) ? null : out;
}

// ── Writing back ─────────────────────────────────────────────────────────────────────────────
//
// The other direction: the nutrition eait logs, mirrored into the phone's health store so the
// user's own nutrition ring reflects what they ate. Platform-neutral on purpose — the mapping from
// these names to `HKQuantityTypeIdentifier` lives on the phone, because HealthKit is not something
// this package is allowed to know about.

/** A nutrient this product mirrors, and the unit it is measured in. */
export interface MealNutrientSpec {
  /** The field on a meal analysis this reads. */
  key: "kcal" | "protein_g" | "carbs_g" | "fat_g" | "satfat_g" | "fiber_g" | "sugar_g" | "sodium_mg";
  /** `kcal`, `g` or `mg`. The phone maps these onto the platform's unit strings. */
  unit: "kcal" | "g" | "mg";
}

export const MEAL_NUTRIENTS = [
  { key: "kcal", unit: "kcal" },
  { key: "protein_g", unit: "g" },
  { key: "carbs_g", unit: "g" },
  { key: "fat_g", unit: "g" },
  { key: "satfat_g", unit: "g" },
  { key: "fiber_g", unit: "g" },
  { key: "sugar_g", unit: "g" },
  { key: "sodium_mg", unit: "mg" },
] as const satisfies readonly MealNutrientSpec[];

/** The numbers a mirrored meal is made of. Exactly what `mealSyncVersion` hashes. */
export type MealNutrition = { [K in MealNutrientSpec["key"]]: number };

/**
 * A version number for a meal's nutrition, for the platform's own de-duplication.
 *
 * HealthKit replaces a sample carrying a sync identifier it has already seen, and uses the sync
 * VERSION to decide which of two writes is newer. So this must (a) change whenever any number
 * changes, and (b) be the same on every device for the same meal — otherwise two phones mirroring
 * one diary would overwrite each other's identical samples forever.
 *
 * Derived from the values rather than from a clock, for that second reason.
 */
export function mealSyncVersion(meal: MealNutrition): number {
  // FNV-1a over the rounded values. A hash, not a counter — see above for why a clock is wrong.
  // Rounded to one decimal first, so a float differing in its last bit between two devices does not
  // produce two versions of an identical meal.
  let h = 0x811c9dc5;
  for (const n of MEAL_NUTRIENTS) {
    const v = Math.round((Number(meal[n.key]) || 0) * 10).toString();
    for (let i = 0; i < v.length; i++) {
      h ^= v.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    h ^= 0x2c; // a separator, so {12, 3} and {1, 23} cannot collide
    h = Math.imul(h, 0x01000193);
  }
  // The platform's sync version is a signed 32-bit integer, so drop the sign BIT rather than take
  // the absolute value: `Math.abs(-2147483648)` is 2147483648, which is one past the largest value
  // that type holds. Masking cannot leave the range, and costs the same one bit of hash space.
  return (h | 0) & 0x7fff_ffff;
}

/** True when something about this meal is worth writing. An all-zero meal is not. */
export function mealHasNutrition(meal: MealNutrition): boolean {
  return MEAL_NUTRIENTS.some((n) => (Number(meal[n.key]) || 0) > 0);
}
