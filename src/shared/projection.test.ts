import { describe, expect, it } from "bun:test";
import { PROJECTION_HORIZON_WEEKS, projectGoal, projectionMonth } from "./projection.ts";
import type { TargetBasis } from "./targets.ts";
import { LANGS } from "./types.ts";
import type { Profile } from "./types.ts";

/** A basis with the fields a projection reads, and defensible values for the rest. */
function basis(over: Partial<TargetBasis> = {}): TargetBasis {
  return {
    bmr: 1780,
    tdee: 2760,
    requestedDeltaKcal: -550,
    appliedDeltaKcal: -550,
    shareCapApplied: false,
    floorKcal: 1500,
    floorApplied: false,
    usedFallbackBand: false,
    ...over,
  };
}

function profile(over: Partial<Profile> = {}): Profile {
  return {
    user_id: "u1",
    lang: "en",
    goal: "lose",
    sex: "male",
    birth_year: 1990,
    height_cm: 183,
    weight_kg: 90,
    target_weight_kg: 83,
    activity: "moderate",
    pace: "steady",
    country: "de",
    restrictions: [],
    medical_limitations: null,
    food_allergies: null,
    product_limitations: null,
    onboarded_at: null,
    ...over,
  } as Profile;
}

describe("projectGoal", () => {
  it("turns an applied deficit into weeks and a rate", () => {
    // 550 kcal/day × 7 = 3850 kcal/week ÷ 7700 = 0.5 kg/week. 7 kg to lose = 14 weeks.
    const p = projectGoal(profile(), basis());
    expect(p).not.toBeNull();
    expect(p!.kgPerWeek).toBeCloseTo(0.5, 3);
    expect(p!.weeks).toBe(14);
    expect(p!.beyondHorizon).toBe(false);
  });

  it("projects a gain the same way", () => {
    const p = projectGoal(
      profile({ goal: "gain", weight_kg: 70, target_weight_kg: 74 }),
      basis({ requestedDeltaKcal: 385, appliedDeltaKcal: 385 }),
    );
    expect(p).not.toBeNull();
    expect(p!.kgPerWeek).toBeCloseTo(0.35, 3);
    expect(p!.weeks).toBe(11); // 4 kg ÷ 0.35 = 11.4, rounded
  });

  // ── The honesty rule this module exists for ────────────────────────────────────────────────
  //
  // The user picked a pace. The guards may have refused to honour it. A projection computed from
  // what they ASKED for is a date the app has already decided not to work towards.

  it("uses the APPLIED delta, not the requested one, when the share cap bit", () => {
    const p = projectGoal(
      profile(),
      basis({ requestedDeltaKcal: -825, appliedDeltaKcal: -552, shareCapApplied: true }),
    );
    // 552 kcal/day is 0.502 kg/week — 14 weeks. The requested 825 would have claimed 9.
    expect(p!.weeks).toBe(14);
    expect(p!.weeks).toBeGreaterThan(9);
  });

  it("uses the APPLIED delta when the floor bit", () => {
    const p = projectGoal(
      profile({ sex: "female", weight_kg: 62, target_weight_kg: 57 }),
      basis({
        bmr: 1320, tdee: 1584, requestedDeltaKcal: -550, appliedDeltaKcal: -84,
        floorKcal: 1500, floorApplied: true,
      }),
    );
    // 84 kcal/day is 0.076 kg/week: 5 kg takes 65 weeks, not the 10 the pace implied.
    expect(p!.kgPerWeek).toBeCloseTo(0.0764, 3);
    expect(p!.weeks).toBe(65);
  });

  // ── Suppression ────────────────────────────────────────────────────────────────────────────

  it("is null for a maintainer", () => {
    expect(projectGoal(
      profile({ goal: "maintain", target_weight_kg: null }),
      basis({ requestedDeltaKcal: 0, appliedDeltaKcal: 0 }),
    )).toBeNull();
  });

  it("is null with no target weight", () => {
    expect(projectGoal(profile({ target_weight_kg: null }), basis())).toBeNull();
  });

  it("is null with no current weight", () => {
    expect(projectGoal(profile({ weight_kg: null }), basis())).toBeNull();
  });

  it("is null when the applied delta is zero", () => {
    expect(projectGoal(profile(), basis({ appliedDeltaKcal: 0 }))).toBeNull();
  });

  it("is null when the delta pushes away from the target", () => {
    // Wants to lose, but the applied delta is a surplus. No honest date exists.
    expect(projectGoal(profile(), basis({ appliedDeltaKcal: 300 }))).toBeNull();
  });

  it("is null when already at or past the target", () => {
    expect(projectGoal(profile({ weight_kg: 83 }), basis())).toBeNull();
    expect(projectGoal(profile({ weight_kg: 80 }), basis())).toBeNull();
  });

  it("is null on the fallback band, where there is no personal arithmetic to project", () => {
    expect(projectGoal(profile(), basis({ usedFallbackBand: true }))).toBeNull();
  });

  // ── The horizon ────────────────────────────────────────────────────────────────────────────

  it("flags a horizon beyond two years rather than naming a date", () => {
    const p = projectGoal(
      profile({ weight_kg: 120, target_weight_kg: 80 }),
      basis({ requestedDeltaKcal: -550, appliedDeltaKcal: -60 }),
    );
    expect(p).not.toBeNull();
    expect(p!.beyondHorizon).toBe(true);
    expect(p!.weeks).toBeGreaterThan(PROJECTION_HORIZON_WEEKS);
  });

  it("does not flag one exactly at the horizon", () => {
    // 0.05 kg/week × 104 weeks = 5.2 kg.
    const p = projectGoal(
      profile({ weight_kg: 90, target_weight_kg: 84.8 }),
      basis({ appliedDeltaKcal: -55 }),
    );
    expect(p!.weeks).toBe(PROJECTION_HORIZON_WEEKS);
    expect(p!.beyondHorizon).toBe(false);
  });
});

describe("previewProjection", () => {
  // The target screen shows a date per pace BEFORE the pace is saved. The preview must run the
  // same arithmetic the server will — guards included — or it prints a date the app has already
  // decided not to pursue, which is the exact failure `projectGoal`'s header forbids.
  const beforeTarget = () => profile({ target_weight_kg: null, pace: null });

  it("projects a candidate pace through the full arithmetic before it is saved", async () => {
    const { previewProjection } = await import("./projection.ts");
    // Male, 183 cm, 90 kg, moderate: a steady 550 kcal deficit clears both guards untouched.
    const p = previewProjection(beforeTarget(), 83, "steady");
    expect(p).not.toBeNull();
    expect(p!.kgPerWeek).toBeCloseTo(0.5, 2);
    expect(p!.weeks).toBe(14);
  });

  it("slows the date when the guards bite, rather than echoing the requested pace", async () => {
    const { previewProjection } = await import("./projection.ts");
    // Small sedentary female: "push" asks 825 kcal/day, the share cap allows ~20% of a ~1535
    // kcal TDEE. The preview must show the capped rate, not 0.75 kg/week.
    const p = previewProjection(
      profile({ sex: "female", height_cm: 160, weight_kg: 62, activity: "sedentary",
        target_weight_kg: null, pace: null }),
      57, "push",
    );
    expect(p).not.toBeNull();
    expect(p!.kgPerWeek).toBeLessThan(0.5);
  });

  it("is null while activity is unanswered, rather than assuming a multiplier", async () => {
    // An admin-reordered flow (or a stale server revision) can put the target screen before
    // activity. `explainTargets` would default the multiplier to sedentary — a real target may do
    // that, a PREVIEW may not: it would show a date derived from an answer nobody gave.
    const { previewProjection } = await import("./projection.ts");
    expect(previewProjection(profile({ activity: null, target_weight_kg: null, pace: null }),
      83, "steady")).toBeNull();
  });

  it("is null without the anthropometrics, where only the fallback band exists", async () => {
    const { previewProjection } = await import("./projection.ts");
    expect(previewProjection(profile({ height_cm: null, target_weight_kg: null }), 83, "steady"))
      .toBeNull();
  });
});

describe("projectionMonth", () => {
  it("names the month the projection lands in", async () => {
    const { projectionMonth } = await import("./projection.ts");
    // 14 weeks from 2026-08-06 is 2026-11-12.
    expect(projectionMonth(new Date("2026-08-06T12:00:00Z"), 14, "en")).toBe("November 2026");
  });

  it("crosses a year boundary", async () => {
    const { projectionMonth } = await import("./projection.ts");
    expect(projectionMonth(new Date("2026-11-20T12:00:00Z"), 8, "en")).toBe("January 2027");
  });
});

describe("the month a projection lands in, in eight languages", () => {
  it("is CLDR's name and never a table of ours", () => {
    const from = new Date("2026-09-18T12:00:00Z");
    expect(projectionMonth(from, 8, "en")).toBe("November 2026");
    expect(projectionMonth(from, 8, "de")).toBe("November 2026");
    expect(projectionMonth(from, 8, "fr")).toBe("novembre 2026");
    expect(projectionMonth(from, 8, "it")).toBe("novembre 2026");
    // CLDR's own forms, and they are not all "<month> <year>": Spanish inserts "de", Russian
    // appends "г.", and Vietnamese numbers its months ("tháng 11 năm 2026"). Pinning them here is
    // the point — a table of ours would have written all three wrong and looked right in review.
    expect(projectionMonth(from, 8, "es")).toBe("noviembre de 2026");
    expect(projectionMonth(from, 8, "ru")).toBe("ноябрь 2026 г.");
    expect(projectionMonth(from, 8, "vi")).toBe("tháng 11 năm 2026");
    for (const lang of LANGS) {
      const said = projectionMonth(from, 8, lang);
      expect(said, lang).toContain("2026");
      // Never a bare number where a month name belongs — the failure the old table existed to
      // avoid, now guarded by a test instead of by twelve hard-coded strings.
      expect(said.replace(/\d/g, "").trim().length, lang).toBeGreaterThan(2);
    }
  });

  it("rolls the calendar rather than adding milliseconds, across a DST boundary", () => {
    // Europe/Berlin leaves summer time on 2026-10-25. Fourteen weeks from mid-October is late
    // January whichever way you count, and adding 98 × 24 h would land it a day early.
    expect(projectionMonth(new Date("2026-10-20T12:00:00Z"), 14, "en")).toBe("January 2027");
  });
});
