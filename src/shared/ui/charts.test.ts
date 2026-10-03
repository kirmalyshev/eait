// Every chart in Register P, reduced to the numbers a renderer cannot get wrong on its own.
//
// The pinned values are the ones the boards actually draw (`product/design/pro` on ieat-app main
// d3fe6ef8): the day ring at 1,066 of 1,434, the week strip's four logged days, the macro rings,
// the persona's five logged weigh-ins, the week's bars, and the estimate curve's fixed shape.

import { describe, expect, test } from "bun:test";
import {
  BMI_SEGMENTS,
  bmiTick,
  bodyWeightChart,
  compareChart,
  dayRing,
  dayTone,
  estimateAreaPath,
  estimateChart,
  estimateCurvePath,
  ESTIMATE_CHART_MINI,
  goalBar,
  intakeChart,
  ringDash,
  TWO_WAYS_CHART,
  weekBars,
  TARGET_LANE_DASH, weightChart,
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
    expect(r.dasharray).toBe("88.0");
    expect(r.dashoffset).toBe("22.6");
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
      dasharray: "88.0",
      dashoffset: "88.0",
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
    // The drawn points are the TREND's (#1114): the trailing 7-day mean at each weigh-in's date —
    // 74.3 at t17 (74.4 and 74.2) — but the ends are the real weigh-ins (#1282): 73.4, not 73.7.
    expect(c.path).toBe("M20 31 L123 40 L179 45 L273 59 L310 86");
    expect(c.points).toEqual([
      { x: 20, y: 31 },
      { x: 123, y: 40 },
      { x: 179, y: 45 },
      { x: 273, y: 59 },
      { x: 310, y: 86 },
    ]);
  });

  test("gridlines, the first and last value labels, the date row", () => {
    const c = weightChart(persona);
    expect(c.gridlines).toEqual([22, 58, 94]);
    expect(c.firstLabel).toEqual({ x: 20, y: 14 });
    expect(c.lastLabel).toEqual({ x: 300, y: 100 });
    expect(c.dateLabelY).toBe(110);
  });

  test("an empty read has no path and no points", () => {
    const c = weightChart([]);
    expect(c.points).toEqual([]);
    expect(c.path).toBe("");
  });

  test("a target adds the bottom lane you.html draws — without one the geometry is unchanged", () => {
    const c = weightChart(persona, true);
    expect(c.viewBox).toBe("0 0 320 120");
    expect(c.dateLabelY).toBe(118);
    expect(c.targetLine).toEqual({ x1: 24, x2: 296, y: 104, dash: TARGET_LANE_DASH });
    expect(c.targetLabel).toEqual({ x: 296, y: 98 });
    const plain = weightChart(persona);
    expect(plain.targetLine).toBeUndefined();
    expect(plain.viewBox).toBe("0 0 320 112");
    expect(plain.dateLabelY).toBe(110);
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
    expect(c.planLine).toEqual({ x1: 8, x2: 312, y: 43, dash: "3 3" });
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

  test("a bar reaching the label's zone lifts it clear — the label never sits on a bar (#174)", () => {
    // Sunday (the last slot, under the right-anchored label) over plan: at the fixed planY − 6
    // the baseline lands inside the bar. The label stays right-anchored, above the bar's top.
    const c = weekBars([null, null, null, null, null, null, 2200], 1434, 6);
    const last = c.bars[6]!;
    expect(last.y).toBeLessThan(31); // tops inside the label's fixed zone (planY − 6 = 53 − text)
    expect(c.planLabel.x).toBe(312);
    expect(c.planLabel.y).toBeLessThanOrEqual(last.y - 6);
    expect(c.planLabel.y).toBeGreaterThanOrEqual(0);
    // And the board's own week — nothing near the label — keeps the board's spot.
    expect(weekBars(days, 1434, 3).planLabel).toEqual({ x: 312, y: 37 });
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

describe("the BMI bar — four segments, one tick", () => {
  test("the persona's 24.8 sits at the boards' 49.6% (boards.py _BPOS)", () => {
    expect(bmiTick(24.8, "18.5-24.9")).toBeCloseTo(0.496, 3);
  });

  test("the segments are quarters and the open ends borrow the neighbour's width", () => {
    expect(bmiTick(18.5, "18.5-24.9")).toBe(0.25);
    expect(bmiTick(24.9, "18.5-24.9")).toBe(0.5);
    expect(bmiTick(15, "below-18.5")).toBeGreaterThan(0);
    expect(bmiTick(15, "below-18.5")).toBeLessThan(0.25);
    expect(bmiTick(34, "30-plus")).toBeGreaterThan(0.75);
    // The tick never leaves the bar, however far out the value is.
    expect(bmiTick(60, "30-plus")).toBe(1);
    expect(bmiTick(10, "below-18.5")).toBe(0);
  });

  test("the ids are the ones scores.ts bands by, in bar order", () => {
    expect(BMI_SEGMENTS.map((s) => s.id)).toEqual(["below-18.5", "18.5-24.9", "25-29.9", "30-plus"]);
  });
});

// ── Apple Health's charts (phone/health*.html, the M8 boards) ──────────────────────────────────

describe("intakeChart — the Health intake card's bars against the plan", () => {
  // The seeded week's intake, Sep 18 → today the 24th, plan 1,434 — health.html's own numbers.
  const vals = [1386, 1522, 1308, 1908, 1572, 1580, 1066];
  const labels = ["18", "19", "20", "21", "22", "23", "Today"];
  const c = intakeChart(vals, 1434, 6);

  test("the board's frame: 350×150, a full-width baseline at 124, labels at 142", () => {
    expect(c.viewBox).toBe("0 0 350 150");
    expect(c.baseline).toBe(124);
    expect(c.labels.map((l) => l.y)).toEqual(Array(7).fill(142));
    expect(c.labels[6]).toEqual({ x: 311, y: 142 });
  });

  test("seven days get the board's pitch: 48px slots at x 8, bars 30 wide, rx 3", () => {
    expect(c.bars.map((b) => b?.x)).toEqual([8, 56, 104, 152, 200, 248, 296]);
    expect(c.bars.map((b) => b?.width)).toEqual(Array(7).fill(30));
    expect(c.bars[0]?.rx).toBe(3);
  });

  test("the dashed plan line spans the frame, label at its right end", () => {
    expect(c.planLine).not.toBeNull();
    expect(c.planLine!.x1).toBe(0);
    expect(c.planLine!.x2).toBe(350);
    expect(c.planLine!.dash).toBe("5 4");
    expect(c.planLabel!.x).toBe(350);
    expect(c.planLabel!.y).toBe(c.planLine!.y - 6);
  });

  test("the scale yields to the largest figure — a bar over plan clears the line", () => {
    const tallest = c.bars[3]!; // 1,908 of 1,434 — over plan
    expect(tallest.y + tallest.height).toBe(124);
    expect(tallest.y).toBeLessThan(c.planLine!.y);
    expect(tallest.y).toBeGreaterThanOrEqual(0);
    expect(c.planLine!.y).toBeGreaterThanOrEqual(0);
  });

  test("only today carries the flag — a gap draws no bar but keeps its label slot", () => {
    expect(c.bars.filter((b) => b?.today)).toHaveLength(1);
    const g = intakeChart([null, 1066, null, null, null, null, null], 1434, 1);
    expect(g.bars[0]).toBeNull();
    expect(g.labels[0]).toEqual({ x: 23, y: 142 });
    expect(g.bars[1]?.today).toBe(true);
  });

  test("more buckets narrow the bars — a 26-week axis still fits the frame", () => {
    const w = intakeChart(Array(26).fill(1200), 1434);
    expect(w.bars[25]!.x + w.bars[25]!.width).toBeLessThanOrEqual(350);
    expect(w.bars[0]!.x).toBeGreaterThanOrEqual(0);
    for (const b of w.bars) expect(b!.width).toBeGreaterThanOrEqual(2);
  });

  test("no plan means no line and no label", () => {
    const c0 = intakeChart(vals, 0);
    expect(c0.planLine).toBeNull();
    expect(c0.planLabel).toBeNull();
  });
});

describe("compareChart — two series on two axes", () => {
  // health-compare.html's own numbers: intake as the bars, steps as the line.
  const intake = [1720, 1560, 1810, 1590, 1640, 1500, 1066];
  const steps = [8900, null, 14300, 13500, 12400, 6900];
  const labels = ["18", "19", "20", "21", "22", "23", "Today"];
  const fmt = (v: number) => v.toLocaleString("en-US");
  const c = compareChart(intake, steps, labels, fmt, fmt);

  test("the board's frame: 350×164, three hairlines, gutter labels on both sides", () => {
    expect(c.viewBox).toBe("0 0 350 164");
    expect(c.gridlines).toHaveLength(3);
    expect(c.leftLabels.map((l) => l.text)).toEqual(["0", "1,000", "2,000"]);
    expect(c.rightLabels.map((l) => l.text)).toEqual(["5,000", "10,000", "15,000"]);
    // Left labels end just left of the plot; right labels start just right of it.
    expect(c.leftLabels[0]!.x).toBeLessThan(c.plotLeft);
    expect(c.rightLabels[0]!.x).toBeGreaterThan(c.plotLeft + c.plotWidth);
  });

  test("the bars floor at zero and the line floats in its own range", () => {
    const s = compareChart(intake, steps, labels, fmt, fmt);
    for (const b of s.bars) {
      if (b === null) continue;
      expect(b.y + b.height).toBeCloseTo(140, 0);
      expect(b.rx).toBe(3);
    }
    // Steps run 6,900→14,300: the board's own axis, 5,000 to 15,000.
    expect(s.rightLabels[0]!.text).toBe("5,000");
    expect(s.rightLabels[2]!.text).toBe("15,000");
  });

  test("a null on the line side breaks the path into runs but the bar still draws", () => {
    const s = compareChart(intake, steps, labels, fmt, fmt);
    expect(s.runs.length).toBe(2); // 8,900 alone, then 14,300·15,200·12,400·6,900
    expect(s.bars[1]).not.toBeNull();
    expect(s.dots).toHaveLength(5);
    for (const d of s.dots) expect(d.r).toBe(3.5);
  });

  test("a null on the bar side leaves the slot empty while the line runs through", () => {
    const s = compareChart([1720, null, 1810, 1590, 1640, 1500, 1066], steps, labels, fmt, fmt);
    expect(s.bars[1]).toBeNull();
    expect(s.labels.map((l) => l.text)).toEqual(labels);
  });

  test("the gutters widen for a wide label rather than clip it", () => {
    const wide = compareChart(intake, steps, labels, () => "8 h 30 m", fmt);
    expect(wide.plotLeft).toBeGreaterThan(c.plotLeft);
  });

  test("x labels sit under the slot centres, oldest to newest", () => {
    expect(c.labels.map((l) => l.y)).toEqual(Array(7).fill(160));
    expect(c.labels[0]!.x).toBeCloseTo(c.bars[0]!.x + c.bars[0]!.width / 2, 1);
    expect(c.labels[6]!.x).toBeCloseTo(c.bars[6]!.x + c.bars[6]!.width / 2, 1);
  });
});

describe("bodyWeightChart — the Body screen's weigh-in line", () => {
  // The persona's log (boards.py WEIGHTS): 74.6 on 24 Aug through 73.4 on 24 Sep.
  const pts = [[0, 74.6], [11, 74.4], [17, 74.2], [27, 74.0], [31, 73.4]]
    .map(([t, kg]) => ({ t: t!, kg: kg! }));
  const c = bodyWeightChart(pts);

  test("the board's frame and the persona's five dots", () => {
    expect(c.viewBox).toBe("0 0 340 130");
    // The same trend the Progress card draws (#1114): 74.3 at t17, the real 73.4 at the end (#1282).
    expect(c.points).toEqual([
      { x: 20, y: 30 }, { x: 126, y: 40 }, { x: 185, y: 45 }, { x: 281, y: 60 }, { x: 320, y: 90 },
    ]);
    expect(c.path).toBe("M20 30 L126 40 L185 45 L281 60 L320 90");
  });

  test("the first and last value labels and the date row sit where the board puts them", () => {
    expect(c.firstLabel).toEqual({ x: 20, y: 18 });
    expect(c.lastLabel).toEqual({ x: 310, y: 102 });
    expect(c.dateLabelY).toBe(128);
    expect(c.dateLabelX).toEqual({ start: 20, end: 320 });
  });

  test("the scale shrinks for a wide span and a lone weigh-in is a dot, not a path", () => {
    const wide = bodyWeightChart([{ t: 0, kg: 90 }, { t: 30, kg: 70 }]);
    for (const p of wide.points) {
      expect(p.y).toBeGreaterThanOrEqual(30);
      expect(p.y).toBeLessThanOrEqual(96);
    }
    const one = bodyWeightChart([{ t: 0, kg: 73.4 }]);
    expect(one.path).toBe("");
    expect(one.points).toHaveLength(1);
  });
});
