// The daily average and energy (#893; boards `progress-pw3-avg`, `progress-pw3-energy`): one Monday-
// to-Sunday week read as the average over the days that HAVE meals, their macros, and Apple Health's
// burned beside what was eaten. Pure: the engine hands it the rows, a test hands it a fixture.
//
// A day without meals is not a zero. It is out of every divisor and is drawn as a dotted base, so a
// week with two logged days averages those two and never half of them.

import type { AverageDay, AverageResponse } from "./contract.ts";
import { dateMinus } from "./dates.ts";
import type { DayTotals } from "./types.ts";

export interface WeekAverageInput {
  /** The week's Monday. */
  from: string;
  today: string;
  week: number;
  planKcal: number;
  /** Basal rate the burned figure rests on; null (flat-band plan) means no burned at all. */
  bmr: number | null;
  /** The days that have meals — the diary's own totals rows. */
  totals: readonly DayTotals[];
  /** Apple Health's active energy by date, only where there is a reading. */
  active: ReadonlyMap<string, number>;
}

const mean = (xs: readonly number[]): number => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);

export function weekAverage(i: WeekAverageInput): AverageResponse {
  const byDate = new Map(i.totals.map((t) => [t.date, t]));
  const days: AverageDay[] = Array.from({ length: 7 }, (_, n) => {
    const date = dateMinus(i.from, -n);
    const t = byDate.get(date);
    const act = i.active.get(date);
    return {
      date,
      when: date < i.today ? "past" : date === i.today ? "today" : "future",
      logged: t !== undefined,
      kcal: t?.kcal ?? null,
      protein_g: t?.protein_g ?? null,
      carbs_g: t?.carbs_g ?? null,
      fat_g: t?.fat_g ?? null,
      burned: i.bmr !== null && act !== undefined && date <= i.today ? Math.round(i.bmr + act) : null,
    };
  });
  const logged = days.filter((d) => d.logged);
  const both = logged.filter((d) => d.burned !== null);
  return {
    from: i.from, to: dateMinus(i.from, -6), week: i.week, days, planKcal: i.planKcal, daysLogged: logged.length,
    average: logged.length === 0 ? null : {
      kcal: mean(logged.map((d) => d.kcal!)), protein_g: mean(logged.map((d) => d.protein_g!)),
      carbs_g: mean(logged.map((d) => d.carbs_g!)), fat_g: mean(logged.map((d) => d.fat_g!)),
    },
    energy: logged.length === 0 ? null : both.length === 0
      ? { burned: null, eaten: mean(logged.map((d) => d.kcal!)), difference: null }
      : (() => {
        const burned = mean(both.map((d) => d.burned!));
        const eaten = mean(both.map((d) => d.kcal!));
        return { burned, eaten, difference: eaten - burned };
      })(),
  };
}
