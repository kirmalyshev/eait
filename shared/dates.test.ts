import { describe, expect, test } from "bun:test";
import {
  dateMinus, dayLabel, isCalendarDate, localDate, localTime, monthGrid, monthLabel, monthOf, monthShift,
} from "./dates.ts";

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
