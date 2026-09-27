// The Progress weight card's state rule — design-pro's ruling on eait#95: onboarding writes the
// first weigh-in (#84), so "a trend needs two points" is the real threshold, and a range with no
// points still shows the latest weigh-in with its date rather than pretending the account is new.

import { describe, expect, it } from "bun:test";
import type { WeightEntry } from "./contract.ts";
import { weightCard } from "./progress.ts";

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
