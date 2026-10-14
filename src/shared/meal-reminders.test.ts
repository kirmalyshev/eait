import { expect, test } from "bun:test";
import { DEFAULT_MEAL_REMINDERS as D, isMealReminders, mealReminderPlan } from "./meal-reminders.ts";

const tz = "Europe/Berlin";
const at = (hhmm: string) => new Date(`2026-10-14T${hhmm}:00+02:00`);

test("defaults: breakfast and lunch for today and tomorrow, dinner off", () => {
  const p = mealReminderPlan(D, [], tz, at("06:00"));
  expect(p.map((r) => r.id)).toEqual(["meal-breakfast-0", "meal-breakfast-1", "meal-lunch-0", "meal-lunch-1"]);
  expect(p[1]!.date).toBe("2026-10-15");
});
test("a breakfast logged early covers the breakfast slot only", () => {
  const p = mealReminderPlan(D, [at("07:40").toISOString()], tz, at("08:00"));
  expect(p.map((r) => r.id)).toEqual(["meal-breakfast-1", "meal-lunch-0", "meal-lunch-1"]);
});
test("a passed time is dropped for today", () => {
  const p = mealReminderPlan(D, [], tz, at("13:00"));
  expect(p.map((r) => r.id)).toEqual(["meal-breakfast-1", "meal-lunch-1"]);
});
test("evening is optional and boolean", () => {
  expect(isMealReminders({ ...D, evening: false })).toBe(true);
  expect(isMealReminders({ ...D, evening: "no" })).toBe(false);
});
test("shape check", () => {
  expect(isMealReminders(D)).toBe(true);
  expect(isMealReminders({ ...D, lunch: { on: true, time: "25:00" } })).toBe(false);
});
