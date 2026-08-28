import { describe, expect, test } from "bun:test";
import { dateMinus, dayLabel, isCalendarDate, localDate, localTime } from "./dates.ts";

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
