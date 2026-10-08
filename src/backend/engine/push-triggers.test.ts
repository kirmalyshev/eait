import { beforeEach, describe, expect, it } from "bun:test";
import { dateMinus, localDate } from "@eait/shared";
import { configDefaults, type Config } from "../config.ts";
import { demoPorts } from "../llm/demo.ts";
import { fakePush, type FakePush } from "../push/fake.ts";
import { memoryStore } from "../store.memory.ts";
import type { Store } from "../store.ts";
import { patchProfile, type EngineDeps } from "./index.ts";
import { instantOf, pushTick, sendTestPush } from "./notify.ts";

const ZONE = "Europe/Berlin";
const CONFIG: Config = {
  ...configDefaults(), port: 0, databaseUrl: "memory://test",
  llmProvider: "demo", llmModel: "demo", llmApiKey: "unused", timezone: ZONE,
};
const TODAY = localDate(ZONE);
/** 20:30 Berlin, `n` local days after the day the accounts were made. */
const evening = (n: number) => instantOf(ZONE, dateMinus(TODAY, -n), { hour: 20, minute: 30 });

let store: Store;
let push: FakePush;
let deps: EngineDeps;
beforeEach(() => {
  store = memoryStore();
  push = fakePush();
  deps = { store, config: CONFIG, llm: demoPorts(), push };
});

let seq = 0;
async function account(opts: { onboarded?: boolean; lang?: "en" | "de" } = {}): Promise<string> {
  const { userId } = await store.upsertDeviceUser(crypto.randomUUID() + crypto.randomUUID(), opts.lang ?? "en");
  await store.addIdentity(userId, "google", "g-" + userId.slice(0, 8));
  if (opts.onboarded !== false) {
    const out = await patchProfile(deps, userId, {
      goal: "lose", sex: "female", birth_year: 1990, height_cm: 165, weight_kg: 70,
      target_weight_kg: 65, activity: "some", pace: "steady", country: "de",
      restrictions: [], complete_onboarding: true,
    });
    if (!out || !out.ok) throw new Error("onboarding failed");
  }
  await store.putPushToken(userId, `ExponentPushToken[t-${++seq}]`, "ios");
  await store.setTimezone(userId, ZONE);
  return userId;
}

async function logOn(userId: string, date: string): Promise<void> {
  await store.insertMeal({
    id: crypto.randomUUID(), user_id: userId, ts: `${date}T12:00:00.000Z`, date,
    isFood: true, items: [{ name: "x", grams: 100 }], kcal: 500, protein_g: 20,
    carbs_g: 50, fat_g: 10, satfat_g: 2, fiber_g: 3, sugar_g: 4, sodium_mg: 300,
    verdicts: {}, healthScore: null, confidence: "high", notes: "", corrected: false, model: "test",
  });
}

const lastLog = async (userId: string) => (await store.sendLogFor(userId, 1))[0]!;

describe("onboarding trigger: day 1, 3 and 7, then stop", () => {
  it("onboarded with nothing logged: pushed on days 1, 3 and 7 under kind onboarding", async () => {
    const userId = await account();
    for (const n of [1, 3, 7]) {
      push.sent.length = 0;
      await pushTick(deps, { now: evening(n) });
      expect(push.sent, `day ${n}`).toHaveLength(1);
      expect(await lastLog(userId)).toMatchObject({ kind: "onboarding", templateKey: "onboarding-photo" });
    }
  });

  it("days 2, 4 and 8 get the ordinary evening line, not an onboarding push", async () => {
    const userId = await account();
    for (const n of [2, 4, 8]) {
      await pushTick(deps, { now: evening(n) });
      expect(await lastLog(userId), `day ${n}`).toMatchObject({ kind: "evening", templateKey: "nudge" });
    }
  });

  it("a day that gets the onboarding push gets no evening line", async () => {
    await account();
    await pushTick(deps, { now: evening(1) });
    await pushTick(deps, { now: evening(1) + 60_000 });
    expect(push.sent).toHaveLength(1);
  });

  it("anything logged ends it: day 3 is the evening line", async () => {
    const userId = await account();
    await logOn(userId, dateMinus(TODAY, -1));
    await pushTick(deps, { now: evening(3) });
    expect(await lastLog(userId)).not.toMatchObject({ kind: "onboarding" });
  });

  it("an unfinished onboarding gets its own key on day 1, and nothing on day 2", async () => {
    const userId = await account({ onboarded: false });
    await pushTick(deps, { now: evening(1) });
    expect(await lastLog(userId)).toMatchObject({ kind: "onboarding", templateKey: "onboarding-start" });
    push.sent.length = 0;
    await pushTick(deps, { now: evening(2) });
    expect(push.sent).toHaveLength(0);
  });
});

describe("streak-at-risk trigger", () => {
  it("streak of 3 ending yesterday: kind streak, key streak-risk", async () => {
    const userId = await account();
    const tonight = 10;
    for (const k of [1, 2, 3]) await logOn(userId, dateMinus(TODAY, -(tonight - k)));
    await pushTick(deps, { now: evening(tonight) });
    expect(push.sent).toHaveLength(1);
    expect(await lastLog(userId)).toMatchObject({ kind: "streak", templateKey: "streak-risk" });
  });

  it("a streak of 2 never triggers", async () => {
    const userId = await account();
    const tonight = 10;
    for (const k of [1, 2]) await logOn(userId, dateMinus(TODAY, -(tonight - k)));
    await pushTick(deps, { now: evening(tonight) });
    expect(await lastLog(userId)).not.toMatchObject({ templateKey: "streak-risk" });
  });

  it("logged today: nothing is at risk", async () => {
    const userId = await account();
    const tonight = 10;
    for (const k of [0, 1, 2, 3]) await logOn(userId, dateMinus(TODAY, -(tonight - k)));
    await pushTick(deps, { now: evening(tonight) });
    expect(await lastLog(userId)).not.toMatchObject({ templateKey: "streak-risk" });
  });

  it("a slot already taken that day means nothing is sent", async () => {
    const userId = await account();
    const tonight = 10;
    for (const k of [1, 2, 3]) await logOn(userId, dateMinus(TODAY, -(tonight - k)));
    expect(await sendTestPush(deps, userId, evening(tonight))).toMatchObject({ ok: true });
    push.sent.length = 0;
    await pushTick(deps, { now: evening(tonight) });
    expect(push.sent).toHaveLength(0);
  });

  it("two at-risk evenings within a week use different variants", async () => {
    const userId = await account();
    for (const d of [1, 2, 3]) await logOn(userId, dateMinus(TODAY, -d));
    await pushTick(deps, { now: evening(4) });
    const first = (await lastLog(userId)).variant;
    await logOn(userId, dateMinus(TODAY, -4));
    await pushTick(deps, { now: evening(5) });
    const second = (await lastLog(userId)).variant;
    expect(first).not.toBeNull();
    expect(second).not.toBe(first);
  });
});
