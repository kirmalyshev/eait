import { beforeEach, describe, expect, it } from "bun:test";
import { DEFAULT_MEAL_REMINDERS } from "@eait/shared";
import { configDefaults } from "../config.ts";
import { demoPorts } from "../llm/demo.ts";
import { fakePush } from "../push/fake.ts";
import { logMail } from "../mail/log.ts";
import { memoryStore } from "../store.memory.ts";
import type { EngineDeps } from "./index.ts";
import { pushConsent, setPushConsent } from "./push-consent.ts";

let deps: EngineDeps;
let userId: string;
beforeEach(async () => {
  const store = memoryStore();
  deps = { store, config: { ...configDefaults(), port: 0, databaseUrl: "memory://t" }, llm: demoPorts(), push: fakePush(), mail: logMail() };
  userId = (await store.upsertDeviceUser(crypto.randomUUID() + crypto.randomUUID(), "en")).userId;
});

describe("tips-and-offers consent", () => {
  it("is OFF with no timestamp until the person turns it on", async () => {
    expect(await pushConsent(deps, userId)).toEqual({ offers: false, at: null, notifications: true, mealReminders: DEFAULT_MEAL_REMINDERS, webPushKey: null });
  });

  it("turning it on stores the moment; turning it off clears it", async () => {
    const before = Date.now();
    const on = await setPushConsent(deps, userId, { offers: true });
    expect(on.offers).toBe(true);
    expect(Date.parse(on.at!)).toBeGreaterThanOrEqual(before - 1000);
    expect(await pushConsent(deps, userId)).toEqual(on);
    expect(await setPushConsent(deps, userId, { offers: false })).toEqual({ offers: false, at: null, notifications: true, mealReminders: DEFAULT_MEAL_REMINDERS, webPushKey: null });
  });

  it("turning it on twice keeps the first moment", async () => {
    const first = await setPushConsent(deps, userId, { offers: true });
    await new Promise((r) => setTimeout(r, 5));
    expect(await setPushConsent(deps, userId, { offers: true })).toEqual(first);
  });

  it("is not the sign-up box: ticked marketing consent is still OFF, and toggling leaves it alone", async () => {
    await deps.store.recordConsent(userId, { terms: true, marketing: true });
    expect(await pushConsent(deps, userId)).toEqual({ offers: false, at: null, notifications: true, mealReminders: DEFAULT_MEAL_REMINDERS, webPushKey: null });
    await setPushConsent(deps, userId, { offers: true });
    await setPushConsent(deps, userId, { offers: false });
    expect((await deps.store.consentOf(userId))?.marketingConsentAt).not.toBeNull();
  });

  it("is per account", async () => {
    const other = (await deps.store.upsertDeviceUser(crypto.randomUUID() + crypto.randomUUID(), "en")).userId;
    await setPushConsent(deps, userId, { offers: true });
    expect((await pushConsent(deps, other)).offers).toBe(false);
  });
});

describe("meal reminders (#902)", () => {
  it("defaults, then stores the whole object and reads it back", async () => {
    expect((await pushConsent(deps, userId)).mealReminders).toEqual(DEFAULT_MEAL_REMINDERS);
    const chosen = { ...DEFAULT_MEAL_REMINDERS, dinner: { on: true, time: "19:30" } };
    expect((await setPushConsent(deps, userId, { mealReminders: chosen })).mealReminders).toEqual(chosen);
  });
});
