import { describe, expect, test } from "bun:test";
import {
  HEALTH_FIELDS, HEALTH_GROUPS, MEAL_NUTRIENTS, aggregateDays, emptyHealthDay, fieldsWithData,
  healthDayIsEmpty, mealHasNutrition, mealSyncVersion, sanitizeHealthDay, type HealthSample,
} from "./health.ts";

const BERLIN = "Europe/Berlin";

/** A point-in-time sample: start and end are the same instant. */
function at(metric: HealthSample["metric"], iso: string, value: number): HealthSample {
  return { metric, start: iso, end: iso, value };
}

/** An interval sample. */
function span(metric: HealthSample["metric"], start: string, end: string, value: number): HealthSample {
  return { metric, start, end, value };
}

describe("HEALTH_FIELDS", () => {
  test("describes every field on a HealthDay, and no others", () => {
    const dayKeys = Object.keys(emptyHealthDay("2026-01-01")).filter((k) => k !== "date").sort();
    const specKeys = HEALTH_FIELDS.map((f) => f.key as string).slice().sort();
    // The `satisfies` in health.ts makes a bad key a compile error; this catches the other
    // direction, a field added to HealthDay that no spec describes and therefore no screen renders.
    expect(specKeys).toEqual(dayKeys);
  });

  test("every field belongs to a declared group", () => {
    for (const f of HEALTH_FIELDS) expect(HEALTH_GROUPS.some((g) => g.id === f.group)).toBe(true);
  });

  test("every group has at least one field", () => {
    for (const g of HEALTH_GROUPS) expect(HEALTH_FIELDS.some((f) => f.group === g.id)).toBe(true);
  });

  test("every range is orderable", () => {
    for (const f of HEALTH_FIELDS) expect(f.min).toBeLessThan(f.max);
  });

  test("a field with no unit is a whole-number count of things", () => {
    // Steps and workouts are counts and genuinely have no unit. Anything else without one is a
    // number rendered next to nothing, which is a number the user has to guess at.
    for (const f of HEALTH_FIELDS) {
      if (f.unit === "") expect(f.decimals).toBe(0);
    }
  });
});

describe("fieldsWithData", () => {
  const day = (date: string, patch: Partial<ReturnType<typeof emptyHealthDay>>) =>
    ({ ...emptyHealthDay(date), ...patch });

  test("keeps a metric measured earlier in the window but not on the newest day", () => {
    // THE BUG THIS EXISTS FOR. A scale is stepped on some mornings, VO2 max is estimated every few
    // weeks, and body fat comes from a smart scale that is not the one by the door. Deciding what
    // to render from the NEWEST day alone drops every one of them from the screen the moment the
    // most recent day happens to be a steps-only day — which is most days, and always the ones
    // before the user has weighed in.
    const days = [
      day("2026-03-11", { steps: 8000 }),
      day("2026-03-10", { weight_kg: 92, steps: 7000 }),
    ];
    expect(fieldsWithData("body", days).map((f) => f.key)).toEqual(["weight_kg"]);
  });

  test("drops a metric no day in the window carries", () => {
    // The other half: a card full of rows the user has never recorded is a screen that looks broken.
    const days = [day("2026-03-11", { steps: 8000 })];
    expect(fieldsWithData("body", days)).toEqual([]);
  });

  test("returns fields in table order, not in the order data happened to arrive", () => {
    const days = [day("2026-03-11", { lean_mass_kg: 68, weight_kg: 92 })];
    expect(fieldsWithData("body", days).map((f) => f.key)).toEqual(["weight_kg", "lean_mass_kg"]);
  });

  test("a zero is data", () => {
    // Same rule as `healthDayIsEmpty`: zero steps means the phone was carried and the user did not
    // move, which is a measurement and belongs on the screen.
    expect(fieldsWithData("activity", [day("2026-03-11", { steps: 0 })]).map((f) => f.key))
      .toEqual(["steps"]);
  });

  test("no days at all is no fields", () => {
    expect(fieldsWithData("body", [])).toEqual([]);
  });
});

describe("aggregateDays", () => {
  test("takes the LAST reading of the day for a body metric, not the mean", () => {
    const days = aggregateDays([
      at("weight_kg", "2026-03-10T06:00:00Z", 94),
      at("weight_kg", "2026-03-10T19:00:00Z", 92),
    ], BERLIN);
    // A mean would report 93, which is a weight the scale never showed.
    expect(days).toHaveLength(1);
    expect(days[0]!.weight_kg).toBe(92);
  });

  test("sums an energy metric across the day", () => {
    const days = aggregateDays([
      at("active_kcal", "2026-03-10T08:00:00Z", 120),
      at("active_kcal", "2026-03-10T12:00:00Z", 80),
      at("active_kcal", "2026-03-10T18:00:00Z", 300),
    ], BERLIN);
    expect(days[0]!.active_kcal).toBe(500);
  });

  test("counts workouts rather than summing their values", () => {
    const days = aggregateDays([
      span("workouts", "2026-03-10T08:00:00Z", "2026-03-10T09:00:00Z", 1),
      span("workouts", "2026-03-10T18:00:00Z", "2026-03-10T18:45:00Z", 1),
    ], BERLIN);
    expect(days[0]!.workouts).toBe(2);
  });

  test("attributes a night's sleep to the day the user WAKES", () => {
    // Asleep 23:10 on the 10th → 06:40 on the 11th, Berlin time. That is the 11th's sleep: it is
    // the night the user is rested from on the 11th, and it is what Health itself shows.
    const days = aggregateDays([
      span("asleep_minutes", "2026-03-10T22:10:00Z", "2026-03-11T05:40:00Z", 450),
    ], BERLIN);
    expect(days).toHaveLength(1);
    expect(days[0]!.date).toBe("2026-03-11");
    expect(days[0]!.asleep_minutes).toBe(450);
  });

  test("attributes by the CONFIGURED zone, not by UTC", () => {
    // 23:30Z on the 10th is 00:30 on the 11th in Berlin (UTC+1 in March, before the DST switch).
    // Attributed in UTC this is the 10th, and the user's late-evening weigh-in lands on the wrong
    // day — which is the same class of bug the meal dates already avoid.
    const days = aggregateDays([at("weight_kg", "2026-03-10T23:30:00Z", 91)], BERLIN);
    expect(days[0]!.date).toBe("2026-03-11");
  });

  test("returns most recent first", () => {
    const days = aggregateDays([
      at("steps", "2026-03-08T10:00:00Z", 100),
      at("steps", "2026-03-10T10:00:00Z", 300),
      at("steps", "2026-03-09T10:00:00Z", 200),
    ], BERLIN);
    expect(days.map((d) => d.date)).toEqual(["2026-03-10", "2026-03-09", "2026-03-08"]);
  });

  test("a metric absent for a day stays null rather than becoming zero", () => {
    // Zero steps and "we have no step data" are different claims, and a trend that renders the
    // second as the first draws a line through days the phone was simply not worn.
    const days = aggregateDays([at("weight_kg", "2026-03-10T09:00:00Z", 91)], BERLIN);
    expect(days[0]!.steps).toBeNull();
    expect(days[0]!.active_kcal).toBeNull();
  });

  test("produces no day at all when there are no samples", () => {
    expect(aggregateDays([], BERLIN)).toEqual([]);
  });

  test("drops a sample whose value is outside the plausible range", () => {
    // A scale reporting 0 kg, or grams misread as kilograms. One implausible reading must not
    // become the number the calorie target is recomputed from.
    const days = aggregateDays([
      at("weight_kg", "2026-03-10T06:00:00Z", 92),
      at("weight_kg", "2026-03-10T07:00:00Z", 0),
    ], BERLIN);
    expect(days[0]!.weight_kg).toBe(92);
  });

  test("ignores a non-finite value instead of poisoning a sum", () => {
    const days = aggregateDays([
      at("active_kcal", "2026-03-10T08:00:00Z", 200),
      at("active_kcal", "2026-03-10T09:00:00Z", Number.NaN),
    ], BERLIN);
    expect(days[0]!.active_kcal).toBe(200);
  });
});

describe("healthDayIsEmpty", () => {
  test("an untouched day is empty", () => {
    expect(healthDayIsEmpty(emptyHealthDay("2026-03-10"))).toBe(true);
  });

  test("one metric is enough to make it worth storing", () => {
    expect(healthDayIsEmpty({ ...emptyHealthDay("2026-03-10"), steps: 12 })).toBe(false);
  });

  test("a zero is a measurement, not an absence", () => {
    expect(healthDayIsEmpty({ ...emptyHealthDay("2026-03-10"), steps: 0 })).toBe(false);
  });
});

describe("sanitizeHealthDay", () => {
  test("keeps a plausible day intact", () => {
    const day = { ...emptyHealthDay("2026-03-10"), weight_kg: 92, steps: 8000, asleep_minutes: 430 };
    expect(sanitizeHealthDay(day)).toEqual(day);
  });

  test("nulls an out-of-range metric rather than rejecting the whole day", () => {
    // The client is not trusted, but one bad metric out of fifteen is not a reason to lose the
    // other fourteen — and a 422 here would make the phone retry a batch that can never succeed.
    const out = sanitizeHealthDay({ ...emptyHealthDay("2026-03-10"), weight_kg: 4000, steps: 8000 });
    expect(out!.weight_kg).toBeNull();
    expect(out!.steps).toBe(8000);
  });

  test("refuses a day whose date is not a calendar date", () => {
    expect(sanitizeHealthDay({ ...emptyHealthDay("2026-02-31"), steps: 10 })).toBeNull();
    expect(sanitizeHealthDay({ ...emptyHealthDay("not-a-date"), steps: 10 })).toBeNull();
  });

  test("refuses a day that carries nothing", () => {
    expect(sanitizeHealthDay(emptyHealthDay("2026-03-10"))).toBeNull();
  });

  test("coerces a non-numeric value to null instead of storing it", () => {
    const day = { ...emptyHealthDay("2026-03-10"), steps: "8000" as unknown as number, weight_kg: 92 };
    expect(sanitizeHealthDay(day)!.steps).toBeNull();
  });
});

describe("mealSyncVersion", () => {
  const meal = {
    kcal: 520, protein_g: 31, carbs_g: 44, fat_g: 22,
    satfat_g: 6, fiber_g: 5, sugar_g: 9, sodium_mg: 780,
  };

  test("is stable for the same numbers", () => {
    // Two devices mirroring one meal must compute the SAME version. A clock-derived one would make
    // each overwrite the other's identical sample forever.
    expect(mealSyncVersion(meal)).toBe(mealSyncVersion({ ...meal }));
  });

  test("changes when any number changes", () => {
    // If it did not, an edited meal would be silently ignored by the platform's de-duplication and
    // the user's health store would keep the numbers they had just corrected.
    for (const n of MEAL_NUTRIENTS) {
      const edited = { ...meal, [n.key]: meal[n.key] + 1 };
      expect(mealSyncVersion(edited)).not.toBe(mealSyncVersion(meal));
    }
  });

  test("does not collide when two fields' digits are rearranged", () => {
    expect(mealSyncVersion({ ...meal, kcal: 12, protein_g: 3 }))
      .not.toBe(mealSyncVersion({ ...meal, kcal: 1, protein_g: 23 }));
  });

  test("is a non-negative integer, which is what the platform accepts", () => {
    const v = mealSyncVersion(meal);
    expect(Number.isInteger(v)).toBe(true);
    expect(v).toBeGreaterThanOrEqual(0);
  });
});

describe("mealHasNutrition", () => {
  const empty = {
    kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0,
    satfat_g: 0, fiber_g: 0, sugar_g: 0, sodium_mg: 0,
  };

  test("an all-zero meal is not worth writing", () => {
    expect(mealHasNutrition(empty)).toBe(false);
  });

  test("one nutrient is enough", () => {
    expect(mealHasNutrition({ ...empty, kcal: 120 })).toBe(true);
  });
});
