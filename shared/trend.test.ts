import { describe, expect, test } from "bun:test";
import { HEALTH_FIELDS, emptyHealthDay, type HealthDay, type HealthMetric } from "./health.ts";
import {
  COMPARE_SERIES, TREND_PERIODS, bucketSeries, compareSeries, correlate, correlationWords,
  mergeSince, metricSeries, oldestDate, trendBuckets, trendEndpoints, trendSummary, type DailyPoint,
  type TrendBucket, type TrendPeriod, type TrendPoint,
} from "./trend.ts";
import { HEALTH_RETENTION_DAYS } from "./contract.ts";
import { dateMinus, windowStart } from "./dates.ts";

// 2026-08-31 is a Monday; 2026-09-02 a Wednesday. Both are asserted below rather than assumed.
const MON = "2026-08-31";
const WED = "2026-09-02";
// The window as a LENGTH, which is what `trendBuckets` takes: five years and a day, the same
// number the server retains. Only the years axis reads it — the other three periods have a fixed
// bucket count — and from either date below it starts in 2021, which is what those tests assert.
const WINDOW = HEALTH_RETENTION_DAYS;

describe("trendBuckets", () => {
  test("days: the last 30 calendar days, one each, ending today", () => {
    const b = trendBuckets("days", MON, WINDOW);
    expect(b).toHaveLength(30);
    expect(b[0]).toEqual({ start: "2026-08-02", end: "2026-08-02", label: "2 Aug" });
    expect(b[29]).toEqual({ start: MON, end: MON, label: "31 Aug" });
  });

  test("weeks: 26 Monday-to-Sunday weeks, the last one containing today", () => {
    const b = trendBuckets("weeks", WED, WINDOW);
    expect(b).toHaveLength(26);
    // The week today falls in, even though it has not finished.
    expect(b[25]).toEqual({ start: "2026-08-31", end: "2026-09-06", label: "31 Aug" });
    expect(b[24]).toEqual({ start: "2026-08-24", end: "2026-08-30", label: "24 Aug" });
    expect(b[0]!.start).toBe("2026-03-09");
    // A Monday is the first day of its own week, not the last of the previous one.
    expect(trendBuckets("weeks", MON, WINDOW)[25]!.start).toBe(MON);
  });

  test("months: 12 calendar months, the last one containing today", () => {
    const b = trendBuckets("months", MON, WINDOW);
    expect(b).toHaveLength(12);
    expect(b[0]).toEqual({ start: "2025-09-01", end: "2025-09-30", label: "Sep" });
    expect(b[11]).toEqual({ start: "2026-08-01", end: "2026-08-31", label: "Aug" });
    // A leap February ends on the 29th, not on a hard-coded 28.
    const leap = trendBuckets("months", "2028-03-15", WINDOW);
    expect(leap[10]).toEqual({ start: "2028-02-01", end: "2028-02-29", label: "Feb" });
  });

  test("years: every calendar year the window reaches, to today", () => {
    const b = trendBuckets("years", MON, WINDOW);
    expect(b.map((x) => x.label)).toEqual(["2021", "2022", "2023", "2024", "2025", "2026"]);
    expect(b[0]).toEqual({ start: "2021-01-01", end: "2021-12-31", label: "2021" });
    expect(b[5]).toEqual({ start: "2026-01-01", end: "2026-12-31", label: "2026" });
  });

  test("every period's buckets are contiguous and oldest first", () => {
    for (const period of ["days", "weeks", "months", "years"] as const) {
      const b = trendBuckets(period, WED, WINDOW);
      for (let i = 1; i < b.length; i++) {
        expect(b[i]!.start > b[i - 1]!.end).toBe(true);
        // No gap: the day after one bucket's end is the next bucket's start.
        const next = new Date(`${b[i - 1]!.end}T00:00:00Z`);
        next.setUTCDate(next.getUTCDate() + 1);
        expect(next.toISOString().slice(0, 10)).toBe(b[i]!.start);
      }
    }
  });
});

describe("bucketSeries", () => {
  const buckets = trendBuckets("weeks", MON, WINDOW);
  const last = buckets[25]!;
  const prev = buckets[24]!;

  test("a bucket's value is the mean of the days that have one, and n counts them", () => {
    const points: DailyPoint[] = [
      { date: "2026-08-24", value: 92 },
      { date: "2026-08-25", value: null }, // unknown, not zero — never in the mean
      { date: "2026-08-26", value: 91 },
      { date: MON, value: 90.5 },
    ];
    const out = bucketSeries(points, buckets, 1);
    expect(out).toHaveLength(26);
    expect(out[24]).toEqual({ ...prev, value: 91.5, n: 2 });
    expect(out[25]).toEqual({ ...last, value: 90.5, n: 1 });
  });

  test("a bucket with no known day is null, never zero", () => {
    const out = bucketSeries([{ date: MON, value: 8000 }], buckets, 0);
    expect(out[0]).toEqual({ ...buckets[0]!, value: null, n: 0 });
  });

  test("rounds to the given decimals", () => {
    const points: DailyPoint[] = [{ date: "2026-08-24", value: 1 }, { date: "2026-08-25", value: 2 }];
    expect(bucketSeries(points, buckets, 0)[24]!.value).toBe(2); // 1.5 rounds half up
    expect(bucketSeries(points, buckets, 2)[24]!.value).toBe(1.5);
  });

  test("a day outside every bucket is ignored, and input order does not matter", () => {
    const points: DailyPoint[] = [
      { date: "2026-09-07", value: 1000 }, // next week — after the last bucket
      { date: "2019-01-01", value: 1000 }, // before the first
      { date: MON, value: 3 },
      { date: "2026-08-24", value: 1 },
    ];
    const out = bucketSeries(points, buckets, 0);
    expect(out[25]!.value).toBe(3);
    expect(out[24]!.value).toBe(1);
    expect(out.reduce((n, p) => n + p.n, 0)).toBe(2);
  });
});

describe("correlate", () => {
  const point = (i: number, value: number | null): TrendPoint =>
    ({ start: `2026-08-${String(i + 1).padStart(2, "0")}`, end: "", label: "", value, n: value === null ? 0 : 1 });
  const series = (values: (number | null)[]) => values.map((v, i) => point(i, v));

  test("a perfect positive relationship is r = 1", () => {
    const a = series([1, 2, 3, 4, 5, 6]);
    const b = series([10, 20, 30, 40, 50, 60]);
    expect(correlate(a, b)).toEqual({ r: 1, n: 6 });
  });

  test("a perfect negative relationship is r = -1", () => {
    const a = series([1, 2, 3, 4, 5]);
    const b = series([5, 4, 3, 2, 1]);
    expect(correlate(a, b)).toEqual({ r: -1, n: 5 });
  });

  test("only points known on BOTH sides count, and fewer than five is no answer", () => {
    const a = series([1, 2, 3, 4, 5, 6, 7]);
    const b = series([1, null, 3, 4, null, 6, 7]);
    expect(correlate(a, b)).toEqual({ r: 1, n: 5 });
    expect(correlate(a, series([1, null, 3, 4, null, 6, null]))).toBeNull();
  });

  test("a flat series has no correlation to report", () => {
    expect(correlate(series([1, 2, 3, 4, 5]), series([2, 2, 2, 2, 2]))).toBeNull();
  });

  test("r is rounded to two decimals", () => {
    const a = series([1, 2, 3, 4, 5, 6]);
    const b = series([2, 1, 4, 3, 6, 5]);
    const out = correlate(a, b)!;
    expect(out.r).toBe(0.83);
  });
});

describe("correlationWords", () => {
  test("names the strength and the direction in words, never as a bare number", () => {
    expect(correlationWords(0.05)).toBe("no clear link");
    expect(correlationWords(-0.1)).toBe("no clear link");
    expect(correlationWords(0.3)).toBe("a weak link — they tend to rise together");
    expect(correlationWords(-0.3)).toBe("a weak link — one tends to rise as the other falls");
    expect(correlationWords(0.6)).toBe("a moderate link — they tend to rise together");
    expect(correlationWords(-0.9)).toBe("a strong link — one tends to rise as the other falls");
  });
});

describe("metricSeries and compareSeries", () => {
  const day = (date: string, patch: Partial<HealthDay>): HealthDay => ({ ...emptyHealthDay(date), ...patch });
  const health: HealthDay[] = [
    day("2026-08-31", { active_kcal: 500, resting_kcal: 1700, steps: 9000, asleep_minutes: 420, exercise_minutes: 30, weight_kg: 90 }),
    day("2026-08-30", { active_kcal: 400, steps: null, asleep_minutes: null, exercise_minutes: 0, weight_kg: null }),
  ];
  const intake = [{ date: "2026-08-31", kcal: 2100, protein_g: 120 }];

  test("metricSeries lifts one column out of the days, nulls kept", () => {
    expect(metricSeries(health, "weight_kg")).toEqual([
      { date: "2026-08-31", value: 90 }, { date: "2026-08-30", value: null },
    ]);
  });

  test("burned is active plus resting, and unknown when either half is", () => {
    // Reporting 400 kcal burned on a day whose resting energy was not recorded would understate
    // the day by the whole basal figure and draw a cliff on the chart that never happened.
    expect(compareSeries("burned", health, intake)).toEqual([
      { date: "2026-08-31", value: 2200 }, { date: "2026-08-30", value: null },
    ]);
  });

  test("intake comes from the diary totals, and a day with no meals is unknown, not zero", () => {
    expect(compareSeries("intake", health, intake)).toEqual([{ date: "2026-08-31", value: 2100 }]);
  });

  test("sleep, steps and exercise are the health columns, zero kept as zero", () => {
    expect(compareSeries("sleep", health, intake).map((p) => p.value)).toEqual([420, null]);
    expect(compareSeries("steps", health, intake).map((p) => p.value)).toEqual([9000, null]);
    expect(compareSeries("exercise", health, intake).map((p) => p.value)).toEqual([30, 0]);
  });

  test("every compare series carries a unit and decimals the formatter can use", () => {
    expect(COMPARE_SERIES.map((s) => s.id)).toEqual(["intake", "burned", "sleep", "steps", "exercise"]);
    for (const s of COMPARE_SERIES) {
      expect(typeof s.unit).toBe("string");
      expect(Number.isInteger(s.decimals)).toBe(true);
    }
  });
});

describe("trendEndpoints and trendSummary", () => {
  const points = bucketSeries(
    [
      { date: "2026-08-03", value: 94.1 }, { date: "2026-08-12", value: 92.0 },
      { date: "2026-08-20", value: 90.8 }, { date: "2026-08-31", value: 91.2 },
    ],
    trendBuckets("weeks", "2026-08-31", WINDOW),
    1,
  );
  const kg = (v: number) => `${v.toFixed(1)} kg`;

  test("endpoints are the first and the latest KNOWN buckets, skipping gaps", () => {
    const e = trendEndpoints(points)!;
    expect(e.first.label).toBe("3 Aug");
    expect(e.first.value).toBe(94.1);
    expect(e.latest.label).toBe("31 Aug");
    expect(e.latest.value).toBe(91.2);
    expect(trendEndpoints(points.map((p) => ({ ...p, value: null, n: 0 })))).toBeNull();
  });

  test("the summary is one sentence a screen reader can say instead of the picture", () => {
    expect(trendSummary("Weight", "weeks", points, kg)).toBe(
      "Weight by week: from 94.1 kg (3 Aug) to 91.2 kg (31 Aug). Lowest 90.8 kg, highest 94.1 kg.",
    );
    expect(trendSummary("Weight", "weeks", points.map((p) => ({ ...p, value: null, n: 0 })), kg)).toBe(
      "Weight by week: nothing recorded.",
    );
  });

  test("every period names the unit of its axis", () => {
    expect(TREND_PERIODS.map((p) => p.noun)).toEqual(["day", "week", "month", "year"]);
  });
});

describe("mergeSince", () => {
  const row = (date: string, v: number) => ({ date, v });

  test("replaces everything from `since` on with the fresh rows and keeps the older ones", () => {
    const cached = [row("2026-08-31", 1), row("2026-08-30", 2), row("2026-08-20", 3)];
    const fresh = [row("2026-08-31", 10), row("2026-08-29", 9)]; // the 30th is gone: a deleted day
    expect(mergeSince(cached, fresh, "2026-08-25")).toEqual([
      row("2026-08-31", 10), row("2026-08-29", 9), row("2026-08-20", 3),
    ]);
  });

  test("a fresh row for a date the cache also holds replaces it, whatever `since` says", () => {
    // `since` is computed on the phone and the window on the server; a day of disagreement
    // between them must not become two rows for one date.
    const cached = [row("2026-08-31", 1), row("2026-08-28", 2)];
    const fresh = [row("2026-08-31", 10), row("2026-08-28", 20)];
    // Without the rule, 2026-08-28 — older than `since`, so kept — would appear twice.
    expect(mergeSince(cached, fresh, "2026-08-30")).toEqual([row("2026-08-31", 10), row("2026-08-28", 20)]);
  });

  test("a fresh row older than `since` still lands, and the result is most recent first", () => {
    const cached = [row("2026-08-31", 1)];
    const fresh = [row("2026-08-01", 5), row("2026-08-31", 2)];
    expect(mergeSince(cached, fresh, "2026-08-25")).toEqual([row("2026-08-31", 2), row("2026-08-01", 5)]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// THE CHART ARITHMETIC: ITS COMPLEXITY CLASS, NOT ITS CLOCK
//
// `bun run perf` grades the health screen on a device, and since #60 both of its numbers genuinely
// cover the charts. But that needs a Mac and a simulator, so it runs neither in CI nor on a Linux
// checkout — and this is the one screen whose render cost SCALES: `bucketSeries` runs once per
// charted series over every stored day, up to `HEALTH_RETENTION_DAYS` of them, which is five years.
//
// SO WHAT IS ASSERTED IS THE SCALING LAW, AND NOTHING ABOUT MILLISECONDS. `bucketSeries` is
// O(days × buckets): every day is placed by scanning a bucket list whose length the period fixes.
// A regression nests a second scan inside that one and makes it O(days²), which is visible with no
// calibrated machine at all — run the workload over N days and over 2N and compare the work done.
//
// THE WORK IS COUNTED, NOT TIMED, and that is what makes this a gate rather than a calibration
// exercise. A wall clock here measures the machine at least as much as the code: on the authoring
// Mac at load 684 the SAME linear workload gave 2N/N time ratios from 0.05 to 29. An earlier
// version asserted an absolute millisecond ceiling and was worse still: every number justifying
// it was measured on an M-series Mac, while `.github/workflows/test.yml` runs `bun run check` on
// `ubuntu-latest`, the shared-runner class `e2e.yml` explicitly refuses to grade timing on.
//
// BOTH SIDES OF THE SCAN ARE COUNTED, because a regression can nest either one. Counting only the
// bucket boundaries missed a whole shape outright: a dedupe pass over `points` is genuinely
// O(days²), touches no `b.start` or `b.end`, and read 1.9804 — indistinguishable from linear,
// while costing 122 ms of render at the real window, over `SCREEN_BUDGETS.health.paintMs` alone.
// Every point read is tallied too.
//
// Measured against five implementations of `bucketSeries`, deterministic to the digit:
//
//   linear, as shipped                          1.9903   passes
//   a bucket scan nested in the days scan        3.9929   fails
//   a dedupe pass over points, no bucket reads   3.4083   fails
//   one date→bucket Map, O(days + buckets)       1.7143   passes
//   COPY the dates out, then scan the COPY       1.9938   PASSES, and should not
//
// ─── WHAT THIS GATE DOES NOT SEE, STATED BECAUSE THE LAST ROW IS REAL AND WAS MEASURED ───
//
// It counts property READS through a proxy, which is not the same thing as work. A regression that
// copies the fields into local arrays first — `const ds = points.map(p => p.date)` and then a
// nested loop over `ds`, which is how somebody would naturally write a dedupe — reads each point
// exactly once and tallies linear. Two reviewers reproduced that independently, at 1.9938 and at
// 1.9903, the second digit-for-digit identical to the shipped code. It costs about 60 ms for
// fifteen metrics at the real 1,826-day window, which is over this screen's whole paint budget.
//
// So the honest claim is narrow: THIS GATE CATCHES A NESTED SCAN THAT RE-READS ITS INPUT, on
// either side. It does not catch one that reads the input once and then works over a copy, and it
// says nothing at all about a constant-factor slowdown. Making it see the copy is not a matter of
// counting harder — once the data is in a plain local array, no proxy can observe what is done to
// it, and the only implementation-agnostic measure left is time. Time was tried and is worse: on
// the authoring Mac at load 684 the same LINEAR workload gave 2N/N time ratios from 0.05 to 29, so
// any bound loose enough not to flake is loose enough to miss this.
//
// `bun run perf` is what covers the rest, and this is a reason to run it on a change to this
// screen rather than a reason to skip it. `perf.ts` says the same thing from the other side.
//
// The last row is the reason there is no lower bound on the COUNT: a correct implementation that
// is strictly faster must be able to land. What stops "did less work" from passing as "faster" is
// the output assertion in the same test — every bucket has to come back filled — not the tally.
//
// THE PERIOD HAS TO BE ONE WITH A FIXED BUCKET COUNT, and `days` is one: thirty, whatever the
// window. `years` grows its axis with N as well, so honest linear code would read ~4x there and
// this test would call it quadratic. The bucket count is asserted below for that reason.
// ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Small on purpose. The claim is a scaling LAW, which is scale-free, so the fixture only has to be
 * big enough to make the exponent legible — and small enough that a quadratic regression fails in
 * under a second rather than making somebody wait to be told. The full window is exercised by the
 * test below, which does no counting.
 */
const SCALING_DAYS = 150;

/**
 * ONE CONSTANT, READ BY THE MEASUREMENT AND BY THE GUARD THAT MAKES IT MEAN ANYTHING.
 *
 * The period has to have a bucket count that does NOT grow with the window, or honest linear code
 * reads ~4x and this test calls it quadratic. `days` is thirty buckets whatever the window; `years`
 * grows its axis with N. `scanComparisons` used to name its own period while the guard asserted a
 * bucket count for `days`, so changing that one literal to `years` would have left the guard green
 * and the measurement meaningless.
 */
const SCALING_PERIOD: TrendPeriod = "days";

/**
 * `n` days ending on `today`, every metric populated on every one.
 *
 * THE SWING PERIOD COMES FROM THE FIELD'S INDEX, not from anything about its name. It was
 * `3 + (key.length % 7)` first, which collides: weight and height both landed on 5, so they were
 * exact scalar multiples of each other and `correlate` returned r = 1 for weight against height —
 * the very fabrication this fixture is built to avoid. An index is unique by
 * construction, which is the property actually needed.
 *
 * Rounded to the field's OWN decimals, because `sanitizeHealthDay` does that on every real ingest
 * path. A flat one decimal put a tenth of a workout and 7,991.9 steps in a fixture whose sibling
 * assertion is about plausibility.
 *
 * Built inside the callers rather than in a `describe` body: bun evaluates those at COLLECTION
 * time, so a five-year fixture there is paid by every run of this file, including `bun test -t` for
 * one of the thirty tests that never touch it.
 */
function healthDays(n: number, today: string): HealthDay[] {
  const out: HealthDay[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const day = emptyHealthDay(dateMinus(today, i));
    HEALTH_FIELDS.forEach((f, index) => {
      const places = 10 ** f.decimals;
      // A BAND OF ONE VALUE STILL MOVES ONE UNIT. Height's is 183 to 183, and a constant series has
      // no variance, so `correlate` answers null for every pair it is in and the assertion below
      // cannot run.
      const [lo, hi] = f.typical;
      const amplitude = (hi - lo) / 2 || 1 / places;
      const period = 3 + index;
      const value = (lo + hi) / 2 + amplitude * Math.sin(((i % period) / period) * 2 * Math.PI);
      day[f.key] = Math.round(value * places) / places;
    });
    out.push(day);
  }
  return out;
}

/**
 * Every comparison `bucketSeries` performs over `n` days of every metric.
 *
 * Buckets and points both go in behind a proxy, so a scan nested on either side is counted. The
 * proxies are also what stop the calls being optimised away: `bucketSeries` returns values nothing
 * here reads, and under a timed version JSC eliminating them would have passed the test
 * unconditionally with no symptom. A count of zero is a broken measurement, and the test says so.
 *
 * THE RESULT MAP IS SUBTRACTED BACK OUT. `bucketSeries` ends with `buckets.map(b => ({...b}))`,
 * and the spread reads `start`, `end` AND `label` once per bucket — work that does not grow with
 * the days, so it is a constant added to both sides that drags the ratio toward 1 and toward
 * passing. Each `label` read marks one such visit and implies exactly one `start` and one `end`,
 * so the correction is derived from what was observed rather than from a hardcoded 900. If that
 * spread ever goes away the label count goes to zero and the correction with it.
 */
function scanComparisons(n: number, today: string): { work: number; mapVisits: number } {
  const days = healthDays(n, today);
  let boundary = 0;
  let labels = 0;
  let points = 0;
  const buckets: TrendBucket[] = trendBuckets(SCALING_PERIOD, today, n).map(
    (b) => new Proxy(b, {
      get(target, key, receiver) {
        if (key === "start" || key === "end") boundary++;
        else if (key === "label") labels++;
        return Reflect.get(target, key, receiver);
      },
    }),
  );
  for (const f of HEALTH_FIELDS) {
    const series: DailyPoint[] = metricSeries(days, f.key).map(
      (p) => new Proxy(p, {
        get(target, key, receiver) {
          if (key === "date" || key === "value") points++;
          return Reflect.get(target, key, receiver);
        },
      }),
    );
    bucketSeries(series, buckets, f.decimals);
  }
  return { work: boundary - 2 * labels + points, mapVisits: labels };
}

describe("the fixture the scaling and window tests are built on", () => {
  const today = "2026-09-06";

  test("every metric reads plausibly on every generated day, not merely at its base", () => {
    // OVER THE GENERATED DAYS, not over the bands, because the days are what `sanitizeHealthDay`
    // would see. No key-parity assertion: `typical` is required by `HealthFieldSpec`, so a field
    // without one is a compile error and `bun run typecheck` fails before this runner starts.
    const days = healthDays(40, today);
    for (const f of HEALTH_FIELDS) {
      for (const day of days) {
        const v = day[f.key];
        expect(v).not.toBeNull();
        expect(v!).toBeGreaterThanOrEqual(f.min);
        expect(v!).toBeLessThanOrEqual(f.max);
        const [lo, hi] = f.typical;
        const unit = 1 / 10 ** f.decimals;
        expect(`${f.key} ${day.date}: ${v! >= lo - unit && v! <= hi + unit}`).toBe(`${f.key} ${day.date}: true`);
        // As `sanitizeHealthDay` would have stored it.
        expect(Math.round(v! * 10 ** f.decimals) / 10 ** f.decimals).toBe(v!);
      }
    }
  });

  test("no series is a scalar multiple of another, so a correlation here means something", () => {
    const days = healthDays(120, today);
    const buckets = trendBuckets("days", today, 120);
    // BUILT ONCE. Called inside the loop below, this was 450 full passes for 15 distinct results
    // on every `bun test ./src/shared`.
    const byMetric = new Map<HealthMetric, TrendPoint[]>(
      HEALTH_FIELDS.map((f) => [f.key, bucketSeries(metricSeries(days, f.key), buckets, 2)]),
    );
    const series = (m: HealthMetric) => byMetric.get(m)!;
    // Weight against height was r = 1 under the old key-length period. Same group, and the pair
    // the review measured, so it is the one pinned here.
    expect(correlate(series("weight_kg"), series("height_cm"))!.r).toBeLessThan(1);
    // `correlate` is symmetric, so each unordered pair once.
    HEALTH_FIELDS.forEach((a, i) => {
      for (const b of HEALTH_FIELDS.slice(i + 1)) {
        // Non-null is half the claim: a constant series correlates with nothing at all.
        const r = correlate(series(a.key), series(b.key));
        expect(r).not.toBeNull();
        expect(r!.r).toBeLessThan(1);
      }
    });
  });
});

describe("chart arithmetic scales with the days it is given", () => {
  const today = "2026-09-06";

  test("doubling the days doubles the work, and does not quadruple it", () => {
    // A fixed bucket count is what makes the ratio the days' exponent alone. THIS GUARDS THE
    // CONSTANT, NOT `trendBuckets`: for `days` the count is thirty by construction and the window
    // is never an input, so these two can only disagree if `SCALING_PERIOD` is changed to a period
    // whose axis grows — `years` — which is exactly the change that would make the measurement
    // meaningless without anything else here noticing.
    for (const n of [SCALING_DAYS, 2 * SCALING_DAYS]) {
      expect(trendBuckets(SCALING_PERIOD, today, n)).toHaveLength(30);
    }

    const small = scanComparisons(SCALING_DAYS, today);
    const large = scanComparisons(2 * SCALING_DAYS, today);
    const n = small.work;
    const doubled = large.work;

    // Zero would mean the scan never ran and the ratio would be meaningless.
    expect(n).toBeGreaterThan(0);

    // THE CORRECTION TERM, PINNED. Subtracting two boundary reads per map visit is exact only
    // while the result spread copies exactly `start`, `end` and `label`. Add a fourth property, or
    // replace the spread with explicit copies, and the constant subtracted stops matching the
    // constant added — the ratio then drifts toward or away from the threshold with nothing here
    // failing. One visit per bucket per call, the same on both sides, is what makes it a constant.
    expect(small.mapVisits).toBe(30 * HEALTH_FIELDS.length);
    expect(large.mapVisits).toBe(small.mapVisits);

    // 1.99 linear and 1.71 for a correct Map-based rewrite, against 3.41 and 3.99 for the two
    // quadratic shapes. Three is the empty middle, not a tuned bound, and no timeout is needed to
    // hold it: the quadratic form fails this in well under a second, because a fixture sized for
    // an exponent is far smaller than one sized for a stopwatch.
    expect(doubled / n).toBeLessThan(3);
  });

  test("and the buckets come back FILLED, which is what a smaller count has to survive", () => {
    // THE ONLY THING SEPARATING "faster" FROM "did less work". Fewer comparisons pushes the ratio
    // DOWN, so an implementation that broke out of the scan early and dropped points from their
    // buckets would satisfy the assertion above. One day per bucket, every bucket, at both sizes.
    for (const n of [SCALING_DAYS, 2 * SCALING_DAYS]) {
      const days = healthDays(n, today);
      const points = bucketSeries(
        metricSeries(days, "weight_kg"),
        trendBuckets(SCALING_PERIOD, today, n),
        1,
      );
      expect(points).toHaveLength(30);
      expect(points.every((p) => p.n === 1)).toBe(true);
      expect(points.every((p) => p.value !== null)).toBe(true);
    }
  });
});

describe("the five-year window", () => {
  const today = "2026-09-06";

  test("every period fills every bucket over the whole of what the server serves", () => {
    const oldest = windowStart(today, HEALTH_RETENTION_DAYS);
    const days = healthDays(HEALTH_RETENTION_DAYS, today);
    expect(days[0]!.date).toBe(oldest);

    for (const period of TREND_PERIODS) {
      const points = bucketSeries(
        metricSeries(days, "weight_kg"),
        trendBuckets(period.id, today, HEALTH_RETENTION_DAYS),
        1,
      );
      expect(points.length).toBeGreaterThan(0);
      expect(points.every((p) => p.value !== null)).toBe(true);
    }
  });

  // THE INVARIANT `windowStart` EXISTS FOR: no bucket may lie entirely outside the window a read
  // can answer from. `app/health.tsx` built its axis from the INGEST window, one day wider, which
  // broke this on five dates in the supported range — a permanently empty leading year bar. The
  // screen cannot express that any more: `trendBuckets` takes a LENGTH and derives the date, so
  // this is now a property of the function rather than a rule its callers have to remember.
  test("no year bucket falls entirely outside the window a read can answer from", () => {
    for (const day of ["2025-12-31", "2026-12-31", "2027-12-31", "2028-12-30", "2029-12-31"]) {
      const served = windowStart(day, HEALTH_RETENTION_DAYS);
      const axis = trendBuckets("years", day, HEALTH_RETENTION_DAYS);
      expect(axis.every((b) => b.end >= served)).toBe(true);

      // One day wider — the window the screen used to pass — and a bucket ends before the oldest
      // row a client can be given, so it is empty forever. Kept as the thing being ruled out.
      const wider = trendBuckets("years", day, HEALTH_RETENTION_DAYS + 1);
      expect(wider.some((b) => b.end < served)).toBe(true);
    }
  });
});

// #183 — a new account drew five permanently empty leading year bars, because the years axis was
// built from the retention window alone and knew nothing about when the account's rows START.
// The fourth argument narrows the axis to the account's own history; it can never widen it past
// the window a read can be answered from, which is the invariant above.
describe("trendBuckets, years, clamped to the account's oldest row", () => {
  test("a one-day-old account gets one bar, not six", () => {
    const b = trendBuckets("years", "2026-09-06", WINDOW, "2026-09-05");
    expect(b.map((x) => x.label)).toEqual(["2026"]);
  });

  test("two years of rows get three bars", () => {
    const b = trendBuckets("years", "2026-09-06", WINDOW, "2024-03-01");
    expect(b.map((x) => x.label)).toEqual(["2024", "2025", "2026"]);
  });

  test("a row older than the served window does not widen the axis", () => {
    const b = trendBuckets("years", MON, WINDOW, "2015-01-01");
    expect(b.map((x) => x.label)).toEqual(["2021", "2022", "2023", "2024", "2025", "2026"]);
  });

  test("no oldest row leaves the axis exactly as it was", () => {
    expect(trendBuckets("years", MON, WINDOW, undefined)).toEqual(trendBuckets("years", MON, WINDOW));
  });

  // A phone whose clock runs ahead of the server can hold a row dated after `today`. The axis must
  // still end on today's year rather than count backwards into an empty array.
  test("a row dated after today still leaves the bucket today falls in", () => {
    const b = trendBuckets("years", MON, WINDOW, "2027-04-01");
    expect(b.map((x) => x.label)).toEqual(["2026"]);
  });

  // The one that catches an axis built from health rows alone: intake rows can be older, and
  // `bucketSeries` drops a row no bucket contains (`trend.ts`, `if (i === -1) continue`) without
  // saying so.
  test("every row of BOTH series lands in a bucket", () => {
    const health = [{ date: "2026-01-05", value: 90 }, { date: "2025-06-01", value: 91 }];
    const intake = [{ date: "2024-02-02", value: 2000 }, { date: "2026-02-02", value: 2100 }];
    const oldest = oldestDate(health, intake);
    expect(oldest).toBe("2024-02-02");
    const axis = trendBuckets("years", MON, WINDOW, oldest);
    for (const series of [health, intake]) {
      const n = bucketSeries(series, axis, 0).reduce((s, p) => s + p.n, 0);
      expect(n).toBe(series.length);
    }
  });

  test("days, weeks and months ignore the oldest row", () => {
    for (const period of ["days", "weeks", "months"] as const) {
      expect(trendBuckets(period, MON, WINDOW, "2026-08-30")).toEqual(trendBuckets(period, MON, WINDOW));
    }
  });
});

describe("oldestDate", () => {
  test("the minimum date across every series, whatever order they arrive in", () => {
    // Newest-first is what the screen holds: rows come back `order by date desc`.
    const days = [{ date: "2026-09-01" }, { date: "2026-08-01" }];
    const intake = [{ date: "2026-09-02" }, { date: "2025-12-31" }];
    expect(oldestDate(days, intake)).toBe("2025-12-31");
    expect(oldestDate(intake, days)).toBe("2025-12-31");
  });

  test("undefined when there is nothing to be oldest", () => {
    expect(oldestDate()).toBeUndefined();
    expect(oldestDate([], [])).toBeUndefined();
    expect(oldestDate([], [{ date: "2026-01-01" }])).toBe("2026-01-01");
  });
});
