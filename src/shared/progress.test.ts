// The Progress weight card's state rule — design-pro's ruling on eait#95: onboarding writes the
// first weigh-in (#84), so "a trend needs two points" is the real threshold, and a range with no
// points still shows the latest weigh-in with its date rather than pretending the account is new.

import { describe, expect, it } from "bun:test";
import type { WeightEntry } from "./contract.ts";
import { bodyTrend, paceRung, weightCard } from "./progress.ts";

const at = (date: string, kg: number): WeightEntry => ({ date, kg, source: "manual" });

describe("the Progress weight card's state", () => {
  it("is empty only when the whole log is — no invented points", () => {
    expect(weightCard([], null)).toEqual({ kind: "empty" });
  });

  it("one weigh-in in range is a dot, not a trend", () => {
    expect(weightCard([at("2026-09-24", 73.4)], at("2026-09-24", 73.4))).toEqual({
      kind: "one",
      point: at("2026-09-24", 73.4),
    });
  });

  it("weights outside the range still name the latest, with its date", () => {
    expect(weightCard([], at("2026-03-01", 74.6))).toEqual({
      kind: "none-in-range",
      latest: at("2026-03-01", 74.6),
    });
  });

  it("two or more in range is the trend, oldest first", () => {
    const points = [at("2026-09-01", 74.6), at("2026-09-24", 73.4)];
    expect(weightCard(points, points[1]!)).toEqual({ kind: "trend", points });
  });
});

describe("bodyTrend — the weigh-in span read against the plan's pace ladder", () => {
  const wk = (start: string, end: string, a: number, b: number): WeightEntry[] => [
    at(start, a), at(end, b),
  ];

  it("needs two weigh-ins — one reading is a weight, not a trend", () => {
    expect(bodyTrend([], "lose", 70, "steady")).toBeNull();
    expect(bodyTrend([at("2026-09-01", 74)], "lose", 70, "steady")).toBeNull();
  });

  it("carries the delta, its weekly rate, and the distance to the target", () => {
    // 74.6 → 73.4 over seven days is 1.2kg a week — a rate the ladder reads as past push.
    const t = bodyTrend(wk("2026-09-01", "2026-09-08", 74.6, 73.4), "lose", 68, "steady");
    expect(t).toMatchObject({ deltaKg: -1.2, kgPerWeek: 1.2, toTargetKg: 5.4 });
  });

  it("a partial week is a rate, not a week", () => {
    // −0.6kg in four days reads as 1.05kg/week — faster than the steady rung it was asked for.
    expect(bodyTrend(wk("2026-09-01", "2026-09-05", 74.0, 73.4), "lose", 68, "steady")!.reading)
      .toBe("fast");
  });

  it("classifies against the rung the plan was built on, not a multiplier of it", () => {
    // −0.25kg/week: on easy's own rung; below steady's; far below push's.
    const span = wk("2026-09-01", "2026-09-29", 74.6, 73.6);
    expect(bodyTrend(span, "lose", 68, "easy")!.reading).toBe("on-pace");
    expect(bodyTrend(span, "lose", 68, "steady")!.reading).toBe("slow");
    expect(bodyTrend(span, "lose", 68, "push")!.reading).toBe("slow");
    // −0.5kg/week on steady is on pace; the same rate on easy is faster than asked.
    const half = wk("2026-09-01", "2026-09-15", 74.0, 73.0);
    expect(bodyTrend(half, "lose", 68, "steady")!.reading).toBe("on-pace");
    expect(bodyTrend(half, "lose", 68, "easy")!.reading).toBe("fast");
  });

  it("moving away from the goal is drift, whatever the rate", () => {
    expect(bodyTrend(wk("2026-09-01", "2026-09-15", 73.0, 74.0), "lose", 68, "steady")!.reading)
      .toBe("drift");
    expect(bodyTrend(wk("2026-09-01", "2026-09-15", 74.0, 73.0), "gain", 80, "steady")!.reading)
      .toBe("drift");
  });

  it("a maintainer and a flat span are both flat", () => {
    expect(bodyTrend(wk("2026-09-01", "2026-09-15", 74.0, 73.2), "maintain", null, "steady")!.reading)
      .toBe("flat");
    expect(bodyTrend(wk("2026-09-01", "2026-09-15", 74.0, 74.02), "lose", 68, "steady")!.reading)
      .toBe("flat");
  });

  it("no target still classifies — the distance is honestly zero", () => {
    const t = bodyTrend(wk("2026-09-01", "2026-09-15", 74.0, 73.0), "lose", null, "steady");
    expect(t).toMatchObject({ toTargetKg: 0, reading: "on-pace" });
  });
});

describe("paceRung — the pace ladder's rungs", () => {
  it("every rate lands on a rung, or past the top", () => {
    expect(paceRung(0.05)).toBe(-1);   // below easy's half-step
    expect(paceRung(0.25)).toBe(0);    // easy
    expect(paceRung(0.3)).toBe(0);     // easy's half of the easy|steady midpoint (0.375)
    expect(paceRung(0.4)).toBe(1);     // steady's half of it
    expect(paceRung(0.5)).toBe(1);     // steady
    expect(paceRung(0.7)).toBe(2);     // push's rung
    expect(paceRung(0.9)).toBe(3);     // past the top of the sustainable band
  });
});
