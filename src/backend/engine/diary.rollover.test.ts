// Yesterday's unspent plan through `day()` (#912): read in the account's zone, only when yesterday
// has a logged meal, and only with the switch on.

import { describe, expect, test } from "bun:test";
import { dateMinus, explainTargets, localDate } from "@eait/shared";
import type { MealRecord } from "@eait/shared";
import { memoryStore } from "../store.memory.ts";
import { configDefaults, type Config } from "../config.ts";
import { demoPorts } from "../llm/demo.ts";
import { fakePush } from "../push/fake.ts";
import { logMail } from "../mail/log.ts";
import { day } from "./index.ts";
import type { EngineDeps } from "./deps.ts";

const meal = (userId: string, date: string, kcal: number): MealRecord => ({
  id: crypto.randomUUID(), user_id: userId, ts: `${date}T12:00:00.000Z`, date,
  isFood: true, items: [], kcal, protein_g: 100, carbs_g: 150, fat_g: 40, satfat_g: 4,
  fiber_g: 1, sugar_g: 1, sodium_mg: 10,
  verdicts: {}, healthScore: null, confidence: "high", notes: "", corrected: false, model: "test",
});

async function setup(patch: Record<string, unknown> = {}) {
  const store = memoryStore();
  const { userId } = await store.upsertDeviceUser(crypto.randomUUID() + crypto.randomUUID(), "en");
  const profile = await store.patchProfile(userId, { sex: "female", birth_year: 1990, height_cm: 165, weight_kg: 70, activity: "few", goal: "maintain", ...patch });
  const deps: EngineDeps = { store, config: configDefaults() as Config, llm: demoPorts(), push: fakePush(), mail: logMail() };
  const today = localDate((configDefaults() as Config).timezone);
  return { store, userId, plan: explainTargets(profile).targets.kcal, deps, today };
}

describe("day(): rollover", () => {
  test("yesterday's unspent plan rolls into today's goal, capped at 200", async () => {
    const { store, userId, plan, deps, today } = await setup();
    await store.insertMeal(meal(userId, dateMinus(today, 1), plan - 144));
    const out = (await day(deps, userId, today))!;
    expect(out.goal).toMatchObject({ plan, rollover: 144 });
    expect(out.targets.kcal).toBe(plan + 144);
    const big = await setup();
    await big.store.insertMeal(meal(big.userId, dateMinus(big.today, 1), 400));
    expect((await day(big.deps, big.userId, big.today))!.goal.rollover).toBe(200);
  });

  test("an unlogged yesterday rolls nothing, an overshoot rolls nothing", async () => {
    const a = await setup();
    expect((await day(a.deps, a.userId, a.today))!.goal.rollover).toBe(0);
    const b = await setup();
    await b.store.insertMeal(meal(b.userId, dateMinus(b.today, 1), b.plan + 500));
    const out = (await day(b.deps, b.userId, b.today))!;
    expect(out.goal.rollover).toBe(0);
    expect(out.targets.kcal).toBe(b.plan);
  });

  test("with the switch off nothing rolls", async () => {
    const { store, userId, plan, deps, today } = await setup({ addback_rollover: false });
    await store.insertMeal(meal(userId, dateMinus(today, 1), plan - 150));
    expect((await day(deps, userId, today))!.goal.rollover).toBe(0);
  });
});
