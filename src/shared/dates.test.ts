import { describe, expect, test } from "bun:test";
import {
  dateMinus, dayLabel, isCalendarDate, localDate, localTime, monthGrid, monthLabel, monthOf,
  monthShift, windowStart, zonedMidnight,
} from "./dates.ts";
import { HEALTH_RETENTION_DAYS } from "./contract.ts";

describe("dayLabel", () => {
  test("names the two days a person has a word for", () => {
    expect(dayLabel("2026-08-27", "2026-08-27")).toBe("today");
    expect(dayLabel("2026-08-26", "2026-08-27")).toBe("yesterday");
  });

  test("anything older is a weekday and a date, never an ISO string", () => {
    expect(dayLabel("2026-08-24", "2026-08-27")).toBe("Mon 24 Aug");
    expect(dayLabel("2026-08-24", "2026-08-27")).not.toContain("-");
  });

  test("crosses a month and a year boundary without slipping a day", () => {
    expect(dayLabel("2025-12-31", "2026-01-01")).toBe("yesterday");
    expect(dayLabel("2025-12-30", "2026-01-01")).toBe("Tue 30 Dec");
  });

  test("holds across a DST transition — the label is derived, not counted in hours", () => {
    // Europe/Berlin springs forward on 2026-03-29.
    expect(dayLabel("2026-03-28", "2026-03-29")).toBe("yesterday");
    expect(dayLabel("2026-03-29", "2026-03-30")).toBe("yesterday");
  });
});

describe("the helpers dayLabel is built on", () => {
  test("still hold", () => {
    expect(dateMinus("2026-03-29", 1)).toBe("2026-03-28");
    // NEGATIVE shifts forward, which is how the diary's "next day" chevron moves. Same calendar
    // arithmetic, so it is DST-safe in that direction too.
    expect(dateMinus("2026-03-28", -1)).toBe("2026-03-29");
    expect(dateMinus("2025-12-31", -1)).toBe("2026-01-01");
    expect(isCalendarDate("2026-02-31")).toBe(false);
    expect(localDate("Europe/Berlin", new Date("2026-08-27T22:30:00Z"))).toBe("2026-08-28");
    expect(localTime("Europe/Berlin", new Date("2026-08-27T22:30:00Z"))).toBe("00:30");
  });
});

describe("the month grid the diary's date picker is drawn from", () => {
  test("names the month a date belongs to, and steps between months", () => {
    expect(monthOf("2026-08-29")).toBe("2026-08");
    expect(monthShift("2026-08", -1)).toBe("2026-07");
    expect(monthShift("2026-08", 1)).toBe("2026-09");
    // Across both year boundaries, which is where hand-rolled month arithmetic goes wrong.
    expect(monthShift("2026-01", -1)).toBe("2025-12");
    expect(monthShift("2025-12", 1)).toBe("2026-01");
  });

  test("is whole weeks starting on Monday, so every column is one weekday", () => {
    const grid = monthGrid("2026-08");
    expect(grid.length % 7).toBe(0);
    // 1 Aug 2026 is a Saturday, so the first row runs Mon 27 Jul → Sun 2 Aug.
    expect(grid[0]).toBe("2026-07-27");
    expect(grid).toContain("2026-08-01");
    expect(grid.at(-1)).toBe("2026-09-06");
    // Every seventh cell is a Monday: the grid is contiguous days, never a month with holes in it.
    for (let i = 0; i + 1 < grid.length; i++) {
      expect(dateMinus(grid[i]!, -1)).toBe(grid[i + 1]!);
    }
  });

  test("is always six rows, so the card does not change height as you page", () => {
    // A month that needs five (June starts on a Monday) and one that needs six (August starts on a
    // Saturday), plus both February shapes — the widest spread of leads and lengths there is.
    for (const m of ["2026-06", "2026-08", "2026-02", "2028-02"]) {
      expect(monthGrid(m)).toHaveLength(42);
    }
  });

  test("a month starting ON Monday gets no leading days from the month before", () => {
    // 1 June 2026 is a Monday.
    expect(monthGrid("2026-06")[0]).toBe("2026-06-01");
  });

  test("covers February in a leap year without dropping the 29th", () => {
    expect(monthGrid("2028-02")).toContain("2028-02-29");
    expect(monthGrid("2026-02")).not.toContain("2026-02-29");
  });

  test("spells the month for a person, never as an ISO string", () => {
    expect(monthLabel("2026-08")).toBe("August 2026");
    expect(monthLabel("2026-08")).not.toContain("-");
  });
});

describe("zonedMidnight", () => {
  test("is the instant a calendar day begins in the zone, summer and winter", () => {
    expect(zonedMidnight("Europe/Berlin", "2026-08-31").toISOString()).toBe("2026-08-30T22:00:00.000Z");
    expect(zonedMidnight("Europe/Berlin", "2026-01-15").toISOString()).toBe("2026-01-14T23:00:00.000Z");
    expect(zonedMidnight("UTC", "2026-08-31").toISOString()).toBe("2026-08-31T00:00:00.000Z");
    expect(zonedMidnight("America/New_York", "2026-08-31").toISOString()).toBe("2026-08-31T04:00:00.000Z");
  });

  test("is right on the day the clocks change", () => {
    // Berlin springs forward on 2026-03-29 at 02:00 CET. Midnight is still CET (+1).
    expect(zonedMidnight("Europe/Berlin", "2026-03-29").toISOString()).toBe("2026-03-28T23:00:00.000Z");
    // And the day after is CEST (+2).
    expect(zonedMidnight("Europe/Berlin", "2026-03-30").toISOString()).toBe("2026-03-29T22:00:00.000Z");
  });
});

describe("windowStart", () => {
  test("a window of N days starts N-1 days back, so one day is today itself", () => {
    // THE PROPERTY EVERYTHING TURNS ON, and the one that was spelled two different ways before
    // this function existed. A request for N days must answer with N days.
    expect(windowStart("2026-09-06", 1)).toBe("2026-09-06");
    expect(windowStart("2026-09-06", 2)).toBe("2026-09-05");
    expect(windowStart("2026-09-06", 30)).toBe("2026-08-08");
    expect(windowStart("2026-09-06", HEALTH_RETENTION_DAYS)).toBe("2021-09-07");
  });

  test("the window really is that many days long, counted back", () => {
    for (const days of [1, 2, 7, 30, 365, HEALTH_RETENTION_DAYS]) {
      const start = windowStart("2026-09-06", days);
      // Walk from the start to today and count: the two must agree, which is what stops a
      // fencepost being fixed on one side and reintroduced on the other.
      let n = 1;
      for (let d = start; d !== "2026-09-06"; d = dateMinus(d, -1)) n++;
      expect(n).toBe(days);
    }
  });

  test("is DST-safe, because it is calendar arithmetic and not a subtraction of hours", () => {
    // Berlin springs forward on 2026-03-29. A fixed 24h span across it lands an hour early and
    // rounds to the previous day; `dateMinus` is calendar subtraction and cannot.
    expect(windowStart("2026-03-30", 2)).toBe("2026-03-29");
    expect(windowStart("2026-03-30", 3)).toBe("2026-03-28");
    // And the autumn change, the other direction.
    expect(windowStart("2026-10-26", 2)).toBe("2026-10-25");
  });

  test("never returns a future date, however bad the number it is given", () => {
    // `days` reaches this from `Limits.diaryWindowDays`, which the SERVER supplies. A zero used to
    // return tomorrow, and `mergeSince` keeps every cached row older than its boundary — so a
    // boundary in the future resurrects days the fresh read has since deleted. Clamped, not
    // thrown: a bad number from a server is not a reason to take a screen down.
    for (const bad of [0, -1, -5, Number.NaN, -Infinity]) {
      expect(windowStart("2026-09-06", bad)).toBe("2026-09-06");
    }
    // A fractional window is floored to whole days rather than producing an invalid date.
    expect(windowStart("2026-09-06", 2.9)).toBe("2026-09-05");
  });

  test("and never a non-date or a throw, however LARGE the number it is given", () => {
    // The top end is the one that crashes rather than merely misbehaving, and it is reached from
    // the same server-supplied `diaryWindowDays` — during render, where an unhandled error is a
    // process abort in a Release build. Measured before the clamp: 1e6 gave "-000712-10", which
    // is not a date and compares wrong under the string comparisons every caller uses, and 1e9
    // and 2^31 both threw `RangeError: Invalid Date`.
    for (const big of [1e6, 1e9, 2 ** 31, Number.MAX_SAFE_INTEGER, Infinity]) {
      const out = windowStart("2026-09-06", big);
      expect(out).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(out < "2026-09-06").toBe(true);
    }
    // Infinity is the WIDEST window, not the narrowest. `Number.isFinite` is false for it, so the
    // first version of the guard answered with today itself — one day where the caller asked for
    // everything, which is the failure that hides rather than crashes.
    expect(windowStart("2026-09-06", Infinity)).toBe(windowStart("2026-09-06", 1e9));
    expect(windowStart("2026-09-06", Infinity)).not.toBe("2026-09-06");
  });
});
