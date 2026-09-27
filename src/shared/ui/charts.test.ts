// Every chart in Register P, reduced to the numbers a renderer cannot get wrong on its own.
//
// The pinned values are the ones the boards actually draw (`product/design/pro` on ieat-app main
// d3fe6ef8): the day ring at 1,066 of 1,434, the week strip's four logged days, the macro rings,
// the persona's five logged weigh-ins, the week's bars, and the estimate curve's fixed shape.

import { describe, expect, test } from "bun:test";
import {
  dayRing,
  dayTone,
  estimateAreaPath,
  estimateChart,
  estimateCurvePath,
  ESTIMATE_CHART_MINI,
  goalBar,
  ringDash,
  TWO_WAYS_CHART,
  weekBars,
  weightChart,
  WEIGHT_RANGES,
  WEEK_RING,
} from "./charts.ts";

describe("ringDash — the share of a ring's circumference to draw", () => {
  test("the day ring: 1,066 of 1,434 at r 44 is 276.5 / 70.9", () => {
    expect(ringDash(1066 / 1434, 44)).toEqual({ dasharray: 276.5, dashoffset: 70.9 });
  });

  test("the week-strip rings at r 12, the persona's four logged days", () => {
    expect(ringDash(1386 / 1434, 12).dashoffset).toBe(2.5); // Mon
    expect(ringDash(1429 / 1434, 12).dashoffset).toBe(0.3); // Tue
    expect(ringDash(1308 / 1434, 12).dashoffset).toBe(6.6); // Wed
    expect(ringDash(1066 / 1434, 12).dashoffset).toBe(19.3); // Thu, today
  });

  test("the macro rings at r 21", () => {
    expect(ringDash(54 / 109, 21)).toEqual({ dasharray: 131.9, dashoffset: 66.6 });
    expect(ringDash(134 / 142, 21).dashoffset).toBe(7.4);
    expect(ringDash(35 / 48, 21).dashoffset).toBe(35.7);
  });

  test("the web's day ring at r 40", () => {
    expect(ringDash(852 / 1434, 40)).toEqual({ dasharray: 251.3, dashoffset: 102.0 });
  });

  test("clamped at a full ring — an over-plan day draws full, never past the start", () => {
    expect(ringDash(1.5, 12).dashoffset).toBe(0.0);
    expect(ringDash(1812 / 1434, 40).dashoffset).toBe(0.0);
  });

  test("an empty day draws nothing of the ring", () => {
    expect(ringDash(0, 12)).toEqual({ dasharray: 75.4, dashoffset: 75.4 });
  });
});

describe("dayTone — what a day in the week strip is allowed to say", () => {
  test("accent at or under the plan, bad past it, and never amber", () => {
    expect(dayTone({ kcal: 1066, logged: true, when: "today" }, 1434)).toBe("accent");
    expect(dayTone({ kcal: 1434, logged: true, when: "past" }, 1434)).toBe("accent");
    expect(dayTone({ kcal: 1812, logged: true, when: "past" }, 1434)).toBe("bad");
  });

  test("today with nothing logged yet keeps the instrument: accent at zero share", () => {
    // today-empty.html draws today's ring as the accent arc fully offset — the solid track alone.
    expect(dayTone({ kcal: null, logged: false, when: "today" }, 1434)).toBe("accent");
  });

  test("a past day with nothing logged is dotted", () => {
    // DIRECTION: dotted when nothing is logged.
    expect(dayTone({ kcal: null, logged: false, when: "past" }, 1434)).toBe("dotted");
  });

  test("a future day is faded — the dimmed cell over the dotted ring", () => {
    expect(dayTone({ kcal: null, logged: false, when: "future" }, 1434)).toBe("faded");
  });
});

describe("dayRing — the week-strip ring, tone and dash together", () => {
  test("a logged day under plan", () => {
    const r = dayRing({ kcal: 1066, logged: true, when: "today" }, 1434);
    expect(r.tone).toBe("accent");
    expect(r.dasharray).toBe("75.4");
    expect(r.dashoffset).toBe("19.3");
  });

  test("an over-plan day closes the ring in bad", () => {
    // today-past.html: the Sunday, 1,812 of 1,434, is the full ring in --bad.
    const r = dayRing({ kcal: 1812, logged: true, when: "past" }, 1434);
    expect(r.tone).toBe("bad");
    expect(r.dashoffset).toBe("0.0");
  });

  test("today's empty ring is accent at zero, exactly as today-empty.html draws it", () => {
    expect(dayRing({ kcal: null, logged: false, when: "today" }, 1434)).toEqual({
      tone: "accent",
      dasharray: "75.4",
      dashoffset: "75.4",
    });
  });

  test("a past day with nothing logged and a future day both draw the dotted placeholder", () => {
    expect(dayRing({ kcal: null, logged: false, when: "past" }, 1434)).toEqual({
      tone: "dotted",
      dasharray: WEEK_RING.dottedDash,
    });
    expect(dayRing({ kcal: null, logged: false, when: "future" }, 1434)).toEqual({
      tone: "faded",
      dasharray: WEEK_RING.dottedDash,
    });
  });
});

/** A drawn "M x y C …" cubic, sampled densely — the test reads the path a renderer draws. */
function curvePoints(d: string, samples = 2000): { x: number; y: number }[] {
  const m = /^M([\d.]+) ([\d.]+) C([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+)$/.exec(d);
  if (!m) throw new Error(`not a single cubic: ${d}`);
  const p = m.slice(1).map(Number);
  return Array.from({ length: samples + 1 }, (_, i) => {
    const t = i / samples;
    const u = 1 - t;
    return {
      x: u ** 3 * p[0]! + 3 * u * u * t * p[2]! + 3 * u * t * t * p[4]! + t ** 3 * p[6]!,
      y: u ** 3 * p[1]! + 3 * u * u * t * p[3]! + 3 * u * t * t * p[5]! + t ** 3 * p[7]!,
    };
  });
}

/** Every sampled point of the curve that lands inside the chip's rectangle. */
function curveInChip(
  d: string,
  chip: { x: number; y: number; width: number; height: number },
): { x: number; y: number }[] {
  return curvePoints(d).filter(
    (p) => p.x >= chip.x && p.x <= chip.x + chip.width && p.y >= chip.y && p.y <= chip.y + chip.height,
  );
}

describe("the estimate curve — a drawn shape, not read data", () => {
  test("the line runs flat out of the start and flat into the end", () => {
    const d = estimateCurvePath(20, 34, 292, 110);
    expect(d).toBe("M20 34 C110.7 34 201.3 110 292 110");
  });

  test("the area closes the same curve to the baseline", () => {
    expect(estimateAreaPath(20, 34, 292, 110, 138)).toBe(
      "M20 34 C110.7 34 201.3 110 292 110 L292 138 L20 138 Z",
    );
  });

  test("the canonical chart for a lose goal is the board's, verbatim", () => {
    const c = estimateChart("lose");
    expect(c.viewBox).toBe("0 0 320 168");
    expect(c.linePath).toBe("M20 34 C110 34 200 110 292 110");
    expect(c.areaPath).toBe("M20 34 C110 34 200 110 292 110 L292 138 L20 138 Z");
    expect(c.baseline).toEqual({ x1: 20, x2: 300, y: 138 });
    expect(c.startDot).toEqual({ cx: 20, cy: 34, r: 5 });
    expect(c.endDot).toMatchObject({ cx: 292, cy: 110, r: 6 });
    expect(c.targetChip).toMatchObject({ x: 198, y: 48, width: 106, height: 28, rx: 8, textY: 67 });
    expect(c.startLabel).toEqual({ x: 20, y: 22 });
    expect(c.nowLabel).toEqual({ x: 20, y: 158 });
    expect(c.monthLabel).toEqual({ x: 300, y: 158 });
  });

  test("a gain goal mirrors the curve vertically and the chip follows the end", () => {
    const c = estimateChart("gain");
    expect(c.linePath).toBe("M20 110 C110 110 200 34 292 34");
    expect(c.areaPath).toBe("M20 110 C110 110 200 34 292 34 L292 138 L20 138 Z");
    expect(c.startDot).toEqual({ cx: 20, cy: 110, r: 5 });
    expect(c.endDot).toMatchObject({ cx: 292, cy: 34, r: 6 });
    expect(c.targetChip).toMatchObject({ x: 198, y: 68, width: 106, height: 28, rx: 8, textY: 87 });
    expect(c.startLabel).toEqual({ x: 20, y: 122 });
    // The axis and its captions do not move.
    expect(c.baseline).toEqual({ x1: 20, x2: 300, y: 138 });
    expect(c.nowLabel).toEqual({ x: 20, y: 158 });
  });

  test("the Target chip never touches the curve, in either direction (#112)", () => {
    for (const direction of ["lose", "gain"] as const) {
      const c = estimateChart(direction);
      expect(curveInChip(c.linePath, c.targetChip)).toEqual([]);
    }
  });

  test("How it works' mini chart is its own fixed frame", () => {
    expect(ESTIMATE_CHART_MINI.viewBox).toBe("0 0 320 96");
    expect(ESTIMATE_CHART_MINI.linePath).toBe("M16 18 C100 18 180 70 296 70");
    expect(ESTIMATE_CHART_MINI.areaPath).toBe("M16 18 C100 18 180 70 296 70 L296 88 L16 88 Z");
    expect(ESTIMATE_CHART_MINI.startDot).toEqual({ cx: 16, cy: 18, r: 4.5 });
    expect(ESTIMATE_CHART_MINI.endDot).toMatchObject({ cx: 296, cy: 70, r: 5 });
    expect(ESTIMATE_CHART_MINI.targetChip).toMatchObject({ x: 212, y: 34, width: 92, height: 24 });
    expect(ESTIMATE_CHART_MINI.startLabel).toEqual({ x: 16, y: 10 });
    expect(curveInChip(ESTIMATE_CHART_MINI.linePath, ESTIMATE_CHART_MINI.targetChip)).toEqual([]);
  });
});

describe("the with-a-plan vs without chart — two fixed shapes, no numbers", () => {
  test("the two drawn shapes and the shared start", () => {
    expect(TWO_WAYS_CHART.viewBox).toBe("0 0 320 170");
    expect(TWO_WAYS_CHART.withoutPath).toBe("M16 36 C70 44 92 96 150 94 S230 64 304 40");
    expect(TWO_WAYS_CHART.withPath).toBe("M16 36 C80 44 120 104 180 110 S260 114 304 114");
    expect(TWO_WAYS_CHART.startDot).toEqual({ cx: 16, cy: 36, r: 5 });
  });
});

describe("weightChart — logged weights over the day axis", () => {
  // The persona's five weigh-ins: 24 Aug → 24 Sep (day offsets over a 31-day span).
  const persona = [
    { t: 0, kg: 74.6 },
    { t: 11, kg: 74.4 },
    { t: 17, kg: 74.2 },
    { t: 27, kg: 74.0 },
    { t: 31, kg: 73.4 },
  ];

  test("the persona's line, exactly as progress.html draws it", () => {
    const c = weightChart(persona);
    expect(c.viewBox).toBe("0 0 320 112");
    expect(c.path).toBe("M20 31 L123 40 L179 50 L273 59 L310 86");
    expect(c.points).toEqual([
      { x: 20, y: 31 },
      { x: 123, y: 40 },
      { x: 179, y: 50 },
      { x: 273, y: 59 },
      { x: 310, y: 86 },
    ]);
  });

  test("gridlines, the first and last value labels, the date row", () => {
    const c = weightChart(persona);
    expect(c.gridlines).toEqual([22, 58, 94]);
    expect(c.firstLabel).toEqual({ x: 20, y: 14 });
    expect(c.lastLabel).toEqual({ x: 300, y: 90 });
    expect(c.dateLabelY).toBe(110);
  });

  test("an empty read has no path and no points", () => {
    const c = weightChart([]);
    expect(c.points).toEqual([]);
    expect(c.path).toBe("");
  });

  test("the four ranges exist and are the only ones", () => {
    expect(WEIGHT_RANGES).toEqual(["90D", "6M", "1Y", "all"]);
  });
});

describe("weekBars — the week's intake against the plan", () => {
  const days = [1386, 1429, 1308, 1066, null, null, null];

  test("the persona's week, as progress.html draws it", () => {
    const c = weekBars(days, 1434, 3);
    expect(c.viewBox).toBe("0 0 320 142");
    expect(c.planLine).toEqual({ x1: 8, x2: 312, y: 43 });
    expect(c.planLabel).toEqual({ x: 312, y: 37 });
    expect(c.bars[0]).toMatchObject({ x: 14, y: 45, height: 73, tone: "accent", today: false });
    expect(c.bars[1]).toMatchObject({ x: 58, y: 43, height: 75 });
    expect(c.bars[2]).toMatchObject({ x: 102, y: 49, height: 69 });
    expect(c.bars[3]).toMatchObject({ x: 146, y: 62, height: 56, today: true });
  });

  test("a day with nothing logged draws no bar but keeps its label", () => {
    const c = weekBars(days, 1434, 3);
    expect(c.bars[4]).toBeNull();
    expect(c.bars[5]).toBeNull();
    expect(c.bars[6]).toBeNull();
    expect(c.labels.map((l) => l.x)).toEqual([27, 71, 115, 159, 203, 247, 291]);
    expect(c.labels[0]?.y).toBe(136);
  });

  test("an over-plan day is bad and the bar clears the plan line", () => {
    const c = weekBars([1812, null, null, null, null, null, null], 1434, 3);
    const bar = c.bars[0];
    expect(bar).not.toBeNull();
    expect(bar?.tone).toBe("bad");
    expect(bar && bar.y < c.planLine.y).toBe(true);
  });

  test("a maintain-scale plan still fits the viewBox — the scale yields to the data", () => {
    // plan 2,800 with a 3,200-kcal day: the fixed 100/1900 scale would put the plan line at y −29.
    const c = weekBars([2600, 3200, 2400, 2100, null, null, null], 2800, 3);
    expect(c.planLine.y).toBeGreaterThanOrEqual(0);
    expect(c.planLabel.y).toBeGreaterThanOrEqual(0);
    for (const bar of c.bars) {
      if (bar === null) continue;
      expect(bar.y).toBeGreaterThanOrEqual(0);
      expect(bar.y + bar.height).toBeLessThanOrEqual(118);
    }
  });
});

describe("goalBar — the plan's progress as a share", () => {
  test("the persona: 74 → 68 at 73.4 is one tenth in", () => {
    expect(goalBar(74, 73.4, 68)).toEqual({ share: 0.1, doneKg: 0.6, toGoKg: 5.4 });
  });

  test("a gain goal counts the other direction", () => {
    const g = goalBar(60, 61.5, 68);
    expect(g.share).toBeCloseTo(0.1875);
    expect(g.doneKg).toBe(1.5);
    expect(g.toGoKg).toBe(6.5);
  });

  test("the bar clamps at both ends and a zero goal is full", () => {
    expect(goalBar(74, 74, 68).share).toBe(0);
    expect(goalBar(74, 68, 68).share).toBe(1);
    expect(goalBar(74, 60, 68).share).toBe(1);
    expect(goalBar(74, 80, 68).share).toBe(0);
    expect(goalBar(74, 74, 74).share).toBe(1);
  });
});
