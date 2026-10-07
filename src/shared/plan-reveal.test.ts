import { expect, test } from "bun:test";
import { planJourneyTicks } from "./plan-reveal.ts";

const at = (y: number, m: number, d: number) => new Date(y, m, d, 12);
const months = (from: Date, weeks: number, lang: "en" | "de" = "en") =>
  planJourneyTicks(from, weeks, lang).filter((k) => k.kind === "month");

test("a month tick whose label would touch Today is dropped (Nov at x~62, TodayNov)", () => {
  expect(months(at(2026, 9, 7), 20).map((k) => k.label)).not.toContain("Nov");
});

test("a start mid-month keeps a month tick that has room", () => {
  expect(months(at(2026, 9, 7), 8).map((k) => k.label)).toEqual(["Nov"]);
});

test("a start near a month boundary has no month tick beside Today", () => {
  expect(months(at(2026, 9, 28), 9)).toEqual([]);
});

test("no month label, in any language, starts within 4px of Today's real width", () => {
  const today = { en: 36, de: 40 };
  for (const lang of ["en", "de"] as const)
    for (let day = 0; day < 120; day++)
      for (const weeks of [4, 8, 12, 16, 20, 30])
        for (const k of months(at(2026, 9, 1 + day), weeks, lang))
          expect(k.x - 12).toBeGreaterThanOrEqual(14 + today[lang] + 4);
});
