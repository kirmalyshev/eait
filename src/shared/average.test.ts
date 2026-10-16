import { describe, expect, it } from "bun:test";
import { weekAverage } from "./average.ts";
import type { DayTotals } from "./types.ts";

const day = (date: string, kcal: number, protein_g = 80, carbs_g = 150, fat_g = 50): DayTotals => ({ date, kcal, protein_g, carbs_g, fat_g, satfat_g: 10 });
// Mon 2026-10-12 … Sun 2026-10-18; today is Thursday.
const base = { from: "2026-10-12", today: "2026-10-15", week: 0, planKcal: 1434, bmr: 1500 };

describe("weekAverage (#893)", () => {
  it("averages over the days WITH meals only, never over seven", () => {
    const r = weekAverage({ ...base, totals: [day("2026-10-12", 1400), day("2026-10-14", 1600)], active: new Map() });
    expect(r.daysLogged).toBe(2);
    expect(r.average!.kcal).toBe(1500);
  });

  it("a day without meals is null and not logged, never a 0 bar", () => {
    const r = weekAverage({ ...base, totals: [day("2026-10-12", 1400)], active: new Map() });
    const tue = r.days[1]!;
    expect(tue).toMatchObject({ date: "2026-10-13", logged: false, kcal: null, protein_g: null, carbs_g: null, fat_g: null });
    expect(r.days.map((d) => d.when)).toEqual(["past", "past", "past", "today", "future", "future", "future"]);
  });

  it("a week with no meals has no average and no energy", () => {
    const r = weekAverage({ ...base, totals: [], active: new Map([["2026-10-12", 600]]) });
    expect(r.average).toBeNull();
    expect(r.energy).toBeNull();
  });

  it("averages each macro over the same days, rounded", () => {
    const r = weekAverage({ ...base, totals: [day("2026-10-12", 1000, 81, 150, 50), day("2026-10-13", 2000, 100, 151, 51)], active: new Map() });
    expect(r.average).toEqual({ kcal: 1500, protein_g: 91, carbs_g: 151, fat_g: 51 });
  });

  it("burned is at rest + active; eaten and difference are over the days that have both", () => {
    const r = weekAverage({
      ...base,
      totals: [day("2026-10-12", 1400), day("2026-10-13", 1500), day("2026-10-14", 1700)],
      active: new Map([["2026-10-12", 500], ["2026-10-13", 700]]),
    });
    // Wed has meals but no reading: it stays out of burned AND out of the energy's eaten.
    expect(r.energy).toEqual({ burned: 2100, eaten: 1450, difference: -650 });
    expect(r.average!.kcal).toBe(1533);
    expect(r.days[2]!.burned).toBeNull();
  });

  it("no Apple Health: burned and difference are null, never 0; eaten is the plain average", () => {
    const r = weekAverage({ ...base, totals: [day("2026-10-12", 1400), day("2026-10-13", 1600)], active: new Map() });
    expect(r.energy).toEqual({ burned: null, eaten: 1500, difference: null });
  });

  it("no BMR (flat-band plan): nothing to rest on, so no burned even with a reading", () => {
    const r = weekAverage({ ...base, bmr: null, totals: [day("2026-10-12", 1400)], active: new Map([["2026-10-12", 600]]) });
    expect(r.days[0]!.burned).toBeNull();
    expect(r.energy!.burned).toBeNull();
  });

  it("a reading dated after today is not a burned figure", () => {
    const r = weekAverage({ ...base, totals: [day("2026-10-16", 1400)], active: new Map([["2026-10-16", 600]]) });
    expect(r.days[4]!.burned).toBeNull();
  });
});
