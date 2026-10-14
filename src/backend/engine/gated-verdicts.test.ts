// #2190: a model 0 on satfat/sodium that no catalog row supplied is "unknown", so the card must
// carry no ldl/kidneys verdict rather than "on plan" computed from a number nobody has.

import { beforeAll, describe, expect, it } from "bun:test";
import { configDefaults, type Config } from "../config.ts";
import { demoPorts } from "../llm/demo.ts";
import { memoryStore } from "../store.memory.ts";
import { fakePush } from "../push/fake.ts";
import { logMail } from "../mail/log.ts";
import { gatedVerdicts } from "./meals.ts";
import { patchProfile, type EngineDeps } from "./index.ts";

const CONFIG: Config = {
  ...configDefaults(),
  port: 0, databaseUrl: "memory://test",
  llmProvider: "demo", llmModel: "demo", llmApiKey: "unused",
  appleAudiences: ["com.eait.fit.ios"], googleAudiences: ["test.apps.googleusercontent.com"],
};
let deps: EngineDeps;
let userId: string;

beforeAll(async () => {
  deps = { store: memoryStore(), config: CONFIG, llm: demoPorts(), push: fakePush(), mail: logMail() };
  ({ userId } = await deps.store.upsertDeviceUser(crypto.randomUUID() + crypto.randomUUID(), "en"));
  await deps.store.addIdentity(userId, "google", "g-" + userId.slice(0, 8));
  const out = await patchProfile(deps, userId, {
    goal: "lose", sex: "female", birth_year: 1990, height_cm: 165, weight_kg: 70,
    target_weight_kg: 65, activity: "some", pace: "steady", country: "de",
    restrictions: ["ldl", "kidneys"], complete_onboarding: true,
  });
  if (!out || !out.ok) throw new Error("onboarding failed");
});

const item = (per100?: Record<string, number>) => ({
  name: "rice", name_en: "rice", grams: 200, kcal: 300, protein_g: 5, carbs_g: 60, fat_g: 2, kcal_per_100g: 150,
  ...(per100 ? { food: { name: "rice", source: "usda", per100: { kcal: 150, protein_g: 2.5, carbs_g: 30, fat_g: 1, ...per100 } } } : {}),
}) as never;

describe("gatedVerdicts, missing micros", () => {
  it("drops ldl and kidneys when the model's 0s are not from the catalog", async () => {
    const v = await gatedVerdicts(deps, userId, { kcal: 300, satfat_g: 0, sodium_mg: 0, items: [item()] });
    expect(v.weight).toBeDefined();
    expect(v.ldl).toBeUndefined();
    expect(v.kidneys).toBeUndefined();
  });
  it("keeps them when the catalog supplied the nutrient, even at 0", async () => {
    const v = await gatedVerdicts(deps, userId, {
      kcal: 300, satfat_g: 0, sodium_mg: 0, items: [item({ satfat_g: 0, sodium_mg: 0 })],
    });
    expect(v.ldl).toBe("good");
    expect(v.kidneys).toBe("good");
  });
  it("keeps a model's non-zero estimate", async () => {
    const v = await gatedVerdicts(deps, userId, { kcal: 300, satfat_g: 2, sodium_mg: 300, items: [item()] });
    expect(v.ldl).toBe("good");
    expect(v.kidneys).toBe("good");
  });
});
