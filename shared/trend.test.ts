import { describe, expect, test } from "bun:test";
import { emptyHealthDay, type HealthDay } from "./health.ts";
import {
  COMPARE_SERIES, TREND_PERIODS, bucketSeries, compareSeries, correlate, correlationWords,
  mergeSince, metricSeries, trendBuckets, trendEndpoints, trendSummary, type DailyPoint,
  type TrendPoint,
} from "./trend.ts";

// 2026-08-31 is a Monday; 2026-09-02 a Wednesday. Both are asserted below rather than assumed.
const MON = "2026-08-31";
const WED = "2026-09-02";
const OLDEST = "2021-08-31";

describe("trendBuckets", () => {
  test("days: the last 30 calendar days, one each, ending today", () => {
    const b = trendBuckets("days", MON, OLDEST);
    expect(b).toHaveLength(30);
    expect(b[0]).toEqual({ start: "2026-08-02", end: "2026-08-02", label: "2 Aug" });
    expect(b[29]).toEqual({ start: MON, end: MON, label: "31 Aug" });
  });

  test("weeks: 26 Monday-to-Sunday weeks, the last one containing today", () => {
    const b = trendBuckets("weeks", WED, OLDEST);
    expect(b).toHaveLength(26);
    // The week today falls in, even though it has not finished.
    expect(b[25]).toEqual({ start: "2026-08-31", end: "2026-09-06", label: "31 Aug" });
    expect(b[24]).toEqual({ start: "2026-08-24", end: "2026-08-30", label: "24 Aug" });
    expect(b[0]!.start).toBe("2026-03-09");
    // A Monday is the first day of its own week, not the last of the previous one.
    expect(trendBuckets("weeks", MON, OLDEST)[25]!.start).toBe(MON);
  });

  test("months: 12 calendar months, the last one containing today", () => {
    const b = trendBuckets("months", MON, OLDEST);
    expect(b).toHaveLength(12);
    expect(b[0]).toEqual({ start: "2025-09-01", end: "2025-09-30", label: "Sep" });
    expect(b[11]).toEqual({ start: "2026-08-01", end: "2026-08-31", label: "Aug" });
    // A leap February ends on the 29th, not on a hard-coded 28.
    const leap = trendBuckets("months", "2028-03-15", OLDEST);
    expect(leap[10]).toEqual({ start: "2028-02-01", end: "2028-02-29", label: "Feb" });
  });

  test("years: every calendar year from the oldest stored day to today", () => {
    const b = trendBuckets("years", MON, OLDEST);
    expect(b.map((x) => x.label)).toEqual(["2021", "2022", "2023", "2024", "2025", "2026"]);
    expect(b[0]).toEqual({ start: "2021-01-01", end: "2021-12-31", label: "2021" });
    expect(b[5]).toEqual({ start: "2026-01-01", end: "2026-12-31", label: "2026" });
  });

  test("every period's buckets are contiguous and oldest first", () => {
    for (const period of ["days", "weeks", "months", "years"] as const) {
      const b = trendBuckets(period, WED, OLDEST);
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
  const buckets = trendBuckets("weeks", MON, OLDEST);
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
    trendBuckets("weeks", "2026-08-31", "2021-08-31"),
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
