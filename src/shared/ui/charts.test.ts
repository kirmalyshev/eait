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
  estimateCurvePath,
  ESTIMATE_CHART,
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
    expect(dayTone(1066, 1434)).toBe("accent");
    expect(dayTone(1434, 1434)).toBe("accent"); // at the plan is on plan
    expect(dayTone(1812, 1434)).toBe("bad");
  });

  test("a logged day with nothing in it is still a day: accent at zero share", () => {
    expect(dayTone(0, 1434)).toBe("accent");
  });

  test("dotted when nothing is logged at all", () => {
    expect(dayTone(null, 1434)).toBe("dotted");
  });

  test("faded for a future day", () => {
    expect(dayTone(null, 1434, true)).toBe("faded");
    expect(dayTone(0, 1434, true)).toBe("faded");
  });
});

describe("dayRing — the week-strip ring, tone and dash together", () => {
  test("a logged day under plan", () => {
    const r = dayRing(1066, 1434);
    expect(r.tone).toBe("accent");
    expect(r.dasharray).toBe("75.4");
    expect(r.dashoffset).toBe("19.3");
  });

  test("an over-plan day closes the ring in bad", () => {
    const r = dayRing(1812, 1434);
    expect(r.tone).toBe("bad");
    expect(r.dashoffset).toBe("0.0");
  });

  test("nothing logged and a future day both draw the dotted placeholder", () => {
    expect(dayRing(null, 1434)).toEqual({ tone: "dotted", dasharray: WEEK_RING.dottedDash });
    expect(dayRing(null, 1434, true)).toEqual({ tone: "faded", dasharray: WEEK_RING.dottedDash });
  });
});

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

  test("the canonical chart is the board's: viewBox, dots, chip, labels", () => {
    expect(ESTIMATE_CHART.viewBox).toBe("0 0 320 168");
    expect(ESTIMATE_CHART.linePath.startsWith("M20 34")).toBe(true);
    expect(ESTIMATE_CHART.linePath.endsWith("292 110")).toBe(true);
    expect(ESTIMATE_CHART.baseline).toEqual({ x1: 20, x2: 300, y: 138 });
    expect(ESTIMATE_CHART.startDot).toEqual({ cx: 20, cy: 34, r: 5 });
    expect(ESTIMATE_CHART.endDot).toMatchObject({ cx: 292, cy: 110, r: 6 });
    expect(ESTIMATE_CHART.targetChip).toMatchObject({ x: 198, y: 68, width: 106, height: 28, rx: 8 });
    expect(ESTIMATE_CHART.startLabel).toEqual({ x: 20, y: 22 });
    expect(ESTIMATE_CHART.nowLabel).toEqual({ x: 20, y: 158 });
    expect(ESTIMATE_CHART.monthLabel).toEqual({ x: 300, y: 158 });
  });
});

describe("the with-a-plan vs without chart — two fixed shapes, no numbers", () => {
  test("its accessible name is the challenge-8 wording, exactly", () => {
    expect(TWO_WAYS_CHART.a11yName).toBe(
      "Weight over time, drawn two ways: with a plan and without",
    );
  });

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
