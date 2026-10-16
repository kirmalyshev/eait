// The daily average through `average()` (#893): the week is read in the ACCOUNT's zone, the divisor
// is the days with meals, and burned rests on the plan's BMR.

import { describe, expect, test } from "bun:test";
import { dateMinus, emptyHealthDay, explainTargets, localDate, weekStart } from "@eait/shared";
import type { MealRecord } from "@eait/shared";
import { memoryStore } from "../store.memory.ts";
import { configDefaults, type Config } from "../config.ts";
import { demoPorts } from "../llm/demo.ts";
import { fakePush } from "../push/fake.ts";
import { logMail } from "../mail/log.ts";
import { average } from "./index.ts";
import type { EngineDeps } from "./deps.ts";

const meal = (userId: string, date: string, kcal: number): MealRecord => ({
  id: crypto.randomUUID(), user_id: userId, ts: `${date}T12:00:00.000Z`, date,
  isFood: true, items: [], kcal, protein_g: 100, carbs_g: 150, fat_g: 40, satfat_g: 4,
  fiber_g: 1, sugar_g: 1, sodium_mg: 10,
  verdicts: {}, healthScore: null, confidence: "high", notes: "", corrected: false, model: "test",
});

async function setup() {
  const store = memoryStore();
  const { userId } = await store.upsertDeviceUser(crypto.randomUUID() + crypto.randomUUID(), "en");
  const profile = await store.patchProfile(userId, { sex: "female", birth_year: 1990, height_cm: 165, weight_kg: 70, activity: "few", goal: "maintain" });
  const deps: EngineDeps = { store, config: configDefaults() as Config, llm: demoPorts(), push: fakePush(), mail: logMail() };
  const today = localDate((configDefaults() as Config).timezone);
  return { store, userId, profile, deps, today };
}

describe("average()", () => {
  test("last week: the divisor is the days with meals; the other days are null, not zero", async () => {
    const { store, userId, deps, today } = await setup();
    const mon = dateMinus(weekStart(today), 7);
    await store.insertMeal(meal(userId, mon, 1400));
    await store.insertMeal(meal(userId, dateMinus(mon, -2), 1600));
    const out = (await average(deps, userId, 1))!;
    expect(out).toMatchObject({ from: mon, to: dateMinus(mon, -6), week: 1, daysLogged: 2 });
    expect(out.average).toMatchObject({ kcal: 1500 });
    expect(out.days[1]).toMatchObject({ logged: false, kcal: null });
    expect(out.energy).toMatchObject({ burned: null, eaten: 1500, difference: null });
  });

  test("burned is the plan's BMR plus that day's active energy, over days that have meals", async () => {
    const { store, userId, profile, deps, today } = await setup();
    const mon = dateMinus(weekStart(today), 7);
    await store.insertMeal(meal(userId, mon, 1400));
    const h = emptyHealthDay(mon);
    h.active_kcal = 500;
    await store.putHealthDays(userId, [h]);
    const bmr = explainTargets(profile).basis.bmr!;
    const out = (await average(deps, userId, 1))!;
    expect(out.days[0]!.burned).toBe(Math.round(bmr + 500));
    expect(out.energy).toEqual({ burned: Math.round(bmr + 500), eaten: 1400, difference: 1400 - Math.round(bmr + 500) });
  });

  test("no profile is null", async () => {
    const { deps } = await setup();
    expect(await average(deps, crypto.randomUUID(), 0)).toBeNull();
  });
});
