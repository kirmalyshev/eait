import { beforeEach, describe, expect, it } from "bun:test";
import { dateMinus, localDate } from "@eait/shared";
import { configDefaults, type Config } from "../config.ts";
import { demoPorts } from "../llm/demo.ts";
import { fakePush, type FakePush } from "../push/fake.ts";
import { logMail } from "../mail/log.ts";
import { memoryStore } from "../store.memory.ts";
import type { Store } from "../store.ts";
import { patchProfile, type EngineDeps } from "./index.ts";
import { instantOf, pushTick, sendTestPush, TEST_PUSH_DAILY_CAP, zoneOf } from "./notify.ts";

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
  deps = { store, config: CONFIG, llm: demoPorts(), push, mail: logMail() };
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

async function logOn(userId: string, date: string, kcal = 1600): Promise<void> {
  await store.insertMeal({
    id: crypto.randomUUID(), user_id: userId, ts: `${date}T12:00:00.000Z`, date,
    isFood: true, items: [{ name: "x", grams: 100 }], kcal, protein_g: 20,
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

  it("a meal logged tonight under the floor is not 'nothing today': no streak-risk", async () => {
    const userId = await account();
    const tonight = 10;
    for (const k of [1, 2, 3]) await logOn(userId, dateMinus(TODAY, -(tonight - k)));
    await logOn(userId, dateMinus(TODAY, -tonight), 400);
    await pushTick(deps, { now: evening(tonight) });
    expect(await lastLog(userId)).not.toMatchObject({ templateKey: "streak-risk" });
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

  it("a scheduled message already claimed that day means no second one from the tick", async () => {
    const userId = await account();
    const tonight = 10;
    for (const k of [1, 2, 3]) await logOn(userId, dateMinus(TODAY, -(tonight - k)));
    const zone = zoneOf(deps, await store.timezoneOf(userId));
    expect(await store.claimPushSlot(userId, localDate(zone, new Date(evening(tonight))), "evening", "evening"))
      .toEqual({ claimed: true });
    await pushTick(deps, { now: evening(tonight) });
    expect(push.sent).toHaveLength(0);
  });

  it("the admin test push is a different sender: the tick's message goes alongside it", async () => {
    const userId = await account();
    const tonight = 10;
    for (const k of [1, 2, 3]) await logOn(userId, dateMinus(TODAY, -(tonight - k)));
    expect(await sendTestPush(deps, userId, evening(tonight))).toMatchObject({ ok: true });
    push.sent.length = 0;
    await pushTick(deps, { now: evening(tonight) });
    expect(push.sent).toHaveLength(1);
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

describe("the trial-ends day is not silent on the server", () => {
  const trialEndingAfter = (userId: string, n: number) =>
    store.putEntitlement(userId, {
      expiresAt: `${dateMinus(TODAY, -(n + 1))}T10:00:00.000Z`, productId: "com.eait.fit.ios.yearly",
      trial: true, eventAt: new Date().toISOString(),
    });

  it("onboarding day 1/3/7 on the reminder day still sends its push", async () => {
    for (const n of [1, 3, 7]) {
      const userId = await account();
      await trialEndingAfter(userId, n);
      await pushTick(deps, { now: evening(n) });
      expect(await store.sendLogFor(userId, 5), `day ${n}`).toHaveLength(1);
    }
  });

  it("a streak at risk on the reminder day sends the streak push", async () => {
    const userId = await account();
    for (const k of [1, 2, 3]) await logOn(userId, dateMinus(TODAY, -(10 - k)));
    await trialEndingAfter(userId, 10);
    await pushTick(deps, { now: evening(10) });
    expect(push.sent).toHaveLength(1);
  });
});

describe("admin test push for a staff account", () => {
  const staffDeps = (userId: string): EngineDeps => ({ ...deps, config: { ...CONFIG, campaignStaffIds: [userId] } });

  it("sends again the same day, neither reading nor claiming the slot", async () => {
    const userId = await account();
    const sd = staffDeps(userId);
    expect(await sendTestPush(sd, userId)).toMatchObject({ ok: true });
    expect(await sendTestPush(sd, userId)).toMatchObject({ ok: true });
    expect(push.sent).toHaveLength(2);
    expect(await store.claimPushSlot(userId, localDate(ZONE), "evening", "x")).toMatchObject({ claimed: true });
  });

  it("does not block the real senders that evening", async () => {
    const userId = await account();
    const tonight = 10;
    for (const k of [1, 2, 3]) await logOn(userId, dateMinus(TODAY, -(tonight - k)));
    await sendTestPush(staffDeps(userId), userId, evening(tonight));
    push.sent.length = 0;
    await pushTick(staffDeps(userId), { now: evening(tonight) });
    expect(push.sent).toHaveLength(1);
  });

  it("is decided by the server's staff list: a non-staff account keeps slot-taken", async () => {
    const userId = await account();
    expect(await sendTestPush(deps, userId)).toMatchObject({ ok: true });
    expect(await sendTestPush(deps, userId)).toMatchObject({ ok: false, reason: "slot-taken" });
  });

  it("stops at the daily test cap", async () => {
    const userId = await account();
    const sd = staffDeps(userId);
    for (let i = 0; i < TEST_PUSH_DAILY_CAP; i++) expect(await sendTestPush(sd, userId)).toMatchObject({ ok: true });
    expect(await sendTestPush(sd, userId)).toEqual({ ok: false, reason: "test-cap" });
  });

  it("is logged as a test and left out of the push stats", async () => {
    const userId = await account();
    await sendTestPush(staffDeps(userId), userId);
    expect(await lastLog(userId)).toMatchObject({ kind: "campaign", ref: "admin-test", variant: "admin-test" });
    expect(await store.pushOpenStats(2, ZONE)).toEqual([]);
  });
});
