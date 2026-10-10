import { describe, expect, it } from "bun:test";
import { dateMinus, localDate, type MealRecord } from "@eait/shared";
import { configDefaults, type Config } from "../config.ts";
import { demoPorts } from "../llm/demo.ts";
import { memoryStore } from "../store.memory.ts";
import { fakePush } from "../push/fake.ts";
import { logMail } from "../mail/log.ts";
import { adminUserSummary } from "./entitlement.ts";
import { days, patchProfile, type EngineDeps } from "./index.ts";

const CONFIG: Config = {
  ...configDefaults(),
  port: 0, databaseUrl: "memory://test",
  llmProvider: "demo", llmModel: "demo", llmApiKey: "unused",
};

describe("the admin summary's streak", () => {
  it("is the streak Home shows: forgiving, with the account's floor", async () => {
    const store = memoryStore();
    const deps: EngineDeps = { store, config: CONFIG, llm: demoPorts(), push: fakePush(), mail: logMail() };
    const { userId } = await store.upsertDeviceUser(crypto.randomUUID() + crypto.randomUUID(), "en");
    await store.addIdentity(userId, "google", "g-" + userId.slice(0, 8));
    const out = await patchProfile(deps, userId, {
      goal: "lose", sex: "female", birth_year: 1990, height_cm: 165, weight_kg: 70,
      target_weight_kg: 65, activity: "some", pace: "steady", country: "de",
      restrictions: [], complete_onboarding: true,
    });
    if (!out || !out.ok) throw new Error("onboarding failed");

    const today = localDate(CONFIG.timezone);
    // Five days back: 1500, 1500, ONE under the 1200 floor, 1500, 1500. Counting days with a meal
    // would say 5; the forgiving rule forgives the bent day and adds nothing for it.
    for (const [back, kcal] of [[5, 1500], [4, 1500], [3, 500], [2, 1500], [1, 1500]] as const) {
      await store.insertMeal({
        id: crypto.randomUUID(), user_id: userId, ts: new Date().toISOString(), date: dateMinus(today, back),
        isFood: true, items: [], kcal, protein_g: 0, carbs_g: 0, fat_g: 0, satfat_g: 0, fiber_g: 0,
        sugar_g: 0, sodium_mg: 0, verdicts: {}, confidence: "high", notes: "", healthScore: null, corrected: false, model: null,
      });
    }

    const summary = await adminUserSummary(deps, userId);
    const home = await days(deps, userId, today, today);
    expect(summary?.streakDays).toBe(home!.streak);
    expect(summary?.streakDays).toBe(4);
  });
});
