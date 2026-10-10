import { describe, expect, it } from "bun:test";
import { evaluate, type MilestoneInputs, type MilestoneMeal } from "./milestones.ts";

const TODAY = "2026-10-10"; // a Saturday
const meal = (date: string, kcal: number, nameEn: string[] = []): MilestoneMeal =>
  ({ date, createdDate: date, createdHour: 12, kcal, nameEn, healthScore: null });
const inputs = (over: Partial<MilestoneInputs> = {}): MilestoneInputs => ({
  today: TODAY, floorKcal: 1200, targetKcal: 1800, streakLongest: 0, meals: [], weights: [], workouts: [],
  dayScores: new Map(), ...over,
});

describe("evaluate", () => {
  it("counts nothing from a day under the floor", () => {
    const meals = [1, 2, 3, 4, 5].map((n) => meal(`2026-10-0${n}`, 900));
    expect(evaluate(inputs({ meals }))).toEqual([]);
  });

  it("never earns a goal day from today, which can still go over", () => {
    expect(evaluate(inputs({ meals: [meal(TODAY, 1600)] }))).toEqual([]);
    expect(evaluate(inputs({ meals: [meal("2026-10-09", 1600)] }))).toContain("10-one-hit-wonder");
  });

  it("reads the streak badges off streakLongest", () => {
    const got = evaluate(inputs({ streakLongest: 12 }));
    expect(got).toEqual(["01-rookie", "02-getting-serious"]);
  });

  it("needs 5 distinct days of greens inside one ISO week", () => {
    const week = (dates: string[]) => dates.map((d) => meal(d, 1500, ["spinach"]));
    // Mon 5 .. Fri 9 is one ISO week; Thu 1 .. Mon 5 straddles two.
    expect(evaluate(inputs({ meals: week(["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09"]) })))
      .toContain("22-green-machine");
    expect(evaluate(inputs({ meals: week(["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05"]) })))
      .not.toContain("22-green-machine");
  });

  it("measures weight loss from the first weigh-in to the lowest later one", () => {
    const weights = [{ date: "2026-09-01", kg: 90 }, { date: "2026-09-10", kg: 92 }, { date: "2026-09-20", kg: 84 }];
    const got = evaluate(inputs({ weights }));
    expect(got).toContain("26-bye-bye-burrito"); // 6 kg
    expect(got).not.toContain("27-scale-tipper");
  });

  it("ignores meals dated after today", () => {
    expect(evaluate(inputs({ meals: [meal("2026-10-12", 1500)] }))).toEqual([]);
  });
});
