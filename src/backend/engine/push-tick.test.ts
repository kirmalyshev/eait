import { beforeEach, describe, expect, it } from "bun:test";
import { configDefaults, type Config } from "../config.ts";
import { demoPorts } from "../llm/demo.ts";
import { fakePush, type FakePush } from "../push/fake.ts";
import { logMail } from "../mail/log.ts";
import { memoryStore } from "../store.memory.ts";
import type { Store } from "../store.ts";
import { patchProfile, type EngineDeps } from "./index.ts";
import { collectPushReceipts, pushTick, sendTestPush } from "./notify.ts";

const CONFIG: Config = {
  ...configDefaults(),
  port: 0, databaseUrl: "memory://test",
  llmProvider: "demo", llmModel: "demo", llmApiKey: "unused",
  timezone: "Europe/Berlin",
};
const PAID_UNTIL = "2027-01-01T00:00:00.000Z";
/** 20:30 Berlin (CEST) on 2026-08-20. */
const BERLIN_2030 = Date.parse("2026-08-20T18:30:00Z");
const MIN = 60_000;

let store: Store;
let push: FakePush;
let deps: EngineDeps;
beforeEach(() => {
  store = memoryStore();
  push = fakePush();
  deps = { store, config: CONFIG, llm: demoPorts(), push, mail: logMail() };
});

let seq = 0;
async function account(opts: { tz?: string; token?: string; trialExpires?: string; lang?: "en" | "de" | "fr"; free?: boolean } = {}): Promise<string> {
  const { userId } = await store.upsertDeviceUser(crypto.randomUUID() + crypto.randomUUID(), opts.lang ?? "en");
  await store.addIdentity(userId, "google", "g-" + userId.slice(0, 8));
  const out = await patchProfile(deps, userId, {
    goal: "lose", sex: "female", birth_year: 1990, height_cm: 165, weight_kg: 70,
    target_weight_kg: 65, activity: "some", pace: "steady", country: "de",
    restrictions: [], complete_onboarding: true,
  });
  if (!out || !out.ok) throw new Error("onboarding failed");
  if (!opts.free) await store.putEntitlement(userId, {
    expiresAt: opts.trialExpires ?? PAID_UNTIL, productId: "com.eait.fit.ios.yearly",
    trial: opts.trialExpires !== undefined, eventAt: new Date(Date.now() + ++seq * 1000).toISOString(),
  });
  await store.putPushToken(userId, opts.token ?? `ExponentPushToken[t-${seq}]`, "ios");
  if (opts.tz) await store.setTimezone(userId, opts.tz);
  return userId;
}

describe("one message a day, for every sender", () => {
  it("two ticks racing for one day send exactly once", async () => {
    await account();
    await Promise.all([pushTick(deps, { now: BERLIN_2030 }), pushTick(deps, { now: BERLIN_2030 })]);
    expect(push.sent).toHaveLength(1);
  });

  it("a later tick the same local day sends nothing more", async () => {
    await account();
    await pushTick(deps, { now: BERLIN_2030 });
    await pushTick(deps, { now: BERLIN_2030 + MIN });
    expect(push.sent).toHaveLength(1);
  });

  it("claims the trial's reminder day as `trial`, sends nothing, and refuses the test push with the reason", async () => {
    const userId = await account({ trialExpires: "2026-08-22T10:00:00Z" });
    const now = Date.parse("2026-08-21T18:30:00Z"); // the 21st: the day the phone speaks
    await pushTick(deps, { now });
    expect(push.sent).toHaveLength(0);
    expect(await sendTestPush(deps, userId, now)).toEqual({ ok: false, reason: "slot-taken", heldBy: "trial" });
  });

  it("the admin test push goes through the slot: the second one the same local day is refused", async () => {
    const userId = await account();
    expect(await sendTestPush(deps, userId, BERLIN_2030)).toEqual({ ok: true, sent: 1 });
    expect(push.sent).toHaveLength(1);
    expect(await sendTestPush(deps, userId, BERLIN_2030 + MIN)).toEqual({ ok: false, reason: "slot-taken", heldBy: "campaign" });
    expect(push.sent).toHaveLength(1);
    // and it took the evening line's day with it
    await pushTick(deps, { now: BERLIN_2030 });
    expect(push.sent).toHaveLength(1);
  });

  it("test push for an account with no device says so, and claims nothing", async () => {
    const { userId } = await store.upsertDeviceUser(crypto.randomUUID() + crypto.randomUUID(), "en");
    expect(await sendTestPush(deps, userId, BERLIN_2030)).toEqual({ ok: false, reason: "no-device" });
  });
});

describe("each account's own 20:30", () => {
  const TOKYO_2030 = Date.parse("2026-08-20T11:30:00Z");
  const LA_2030 = Date.parse("2026-08-21T03:30:00Z");

  it("Tokyo and Los Angeles get the line at their own 20:30, not the server's", async () => {
    const tokyo = await account({ tz: "Asia/Tokyo", token: "ExponentPushToken[tokyo]" });
    await account({ tz: "America/Los_Angeles", token: "ExponentPushToken[la]" });

    await pushTick(deps, { now: TOKYO_2030 });
    expect(push.sent.map((m) => m.to)).toEqual(["ExponentPushToken[tokyo]"]);

    await pushTick(deps, { now: LA_2030 });
    expect(push.sent.map((m) => m.to)).toEqual(["ExponentPushToken[tokyo]", "ExponentPushToken[la]"]);
    // the slot is dated in the user's zone
    expect(await store.claimPushSlot(tokyo, "2026-08-20", "campaign", null)).toEqual({ claimed: false, heldBy: "streak" });
  });

  it("nobody gets it before their 20:30", async () => {
    await account({ tz: "Asia/Tokyo" });
    await pushTick(deps, { now: TOKYO_2030 - MIN });
    expect(push.sent).toHaveLength(0);
  });

  it("a null timezone falls back to the instance zone", async () => {
    await account();
    await pushTick(deps, { now: BERLIN_2030 - MIN });
    expect(push.sent).toHaveLength(0);
    await pushTick(deps, { now: BERLIN_2030 });
    expect(push.sent).toHaveLength(1);
  });

  it("an unusable stored zone falls back too, rather than throwing for the whole tick", async () => {
    const userId = await account();
    await store.setTimezone(userId, "Not/AZone");
    await pushTick(deps, { now: BERLIN_2030 });
    expect(push.sent).toHaveLength(1);
  });

  it("holds 20:30 LOCAL on the day Europe falls back (25 Oct 2026: 20:30 CET is 19:30Z)", async () => {
    await account();
    await pushTick(deps, { now: Date.parse("2026-10-25T18:30:00Z") }); // 19:30 CET
    expect(push.sent).toHaveLength(0);
    await pushTick(deps, { now: Date.parse("2026-10-25T19:30:00Z") });
    expect(push.sent).toHaveLength(1);
  });

  it("holds 20:30 LOCAL on the day Europe springs forward (29 Mar 2026: 20:30 CEST is 18:30Z)", async () => {
    await account();
    await pushTick(deps, { now: Date.parse("2026-03-29T17:30:00Z") }); // 19:30 CEST
    expect(push.sent).toHaveLength(0);
    await pushTick(deps, { now: Date.parse("2026-03-29T18:30:00Z") });
    expect(push.sent).toHaveLength(1);
  });

  it("catches up for two hours, then drops the night", async () => {
    await account({ token: "ExponentPushToken[late]" });
    await pushTick(deps, { now: BERLIN_2030 + 121 * MIN });
    expect(push.sent).toHaveLength(0);
    await pushTick(deps, { now: BERLIN_2030 + 119 * MIN });
    expect(push.sent).toHaveLength(1);
  });
});

describe("send_log", () => {
  it("writes a row per device with its id in the push data, accepted on the ticket", async () => {
    const userId = await account({ token: "ExponentPushToken[a]" });
    await store.putPushToken(userId, "ExponentPushToken[b]", "ios");
    await pushTick(deps, { now: BERLIN_2030 });
    const rows = await store.sendLogFor(userId, 10);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.kind === "streak" && r.state === "accepted" && r.ticketId !== null)).toBe(true);
    expect(push.sent.map((m) => m.data?.sendId).sort()).toEqual(rows.map((r) => r.id).sort());
  });

  it("a receipt moves the row to delivered-to-apns", async () => {
    const userId = await account();
    await pushTick(deps, { now: BERLIN_2030 });
    expect(await collectPushReceipts(deps, Date.now() + 20 * MIN)).toBe(0);
    expect((await store.sendLogFor(userId, 1))[0]).toMatchObject({ state: "delivered-to-apns", receiptError: null });
  });

  it("does not read a receipt before Expo has had time to produce it", async () => {
    const userId = await account();
    await pushTick(deps, { now: BERLIN_2030 });
    await collectPushReceipts(deps, Date.now() + MIN);
    expect((await store.sendLogFor(userId, 1))[0]?.state).toBe("accepted");
  });

  it("a dead-device receipt marks the row dead and drops the token", async () => {
    const userId = await account({ token: "ExponentPushToken[gone]" });
    await pushTick(deps, { now: BERLIN_2030 });
    push.unregisterReceipt((await store.sendLogFor(userId, 1))[0]!.ticketId!);
    expect(await collectPushReceipts(deps, Date.now() + 20 * MIN)).toBe(1);
    expect((await store.sendLogFor(userId, 1))[0]?.state).toBe("dead");
    expect(await store.pushTokensFor(userId)).toEqual([]);
  });

  it("a receipt that merely failed keeps the token and records why", async () => {
    const userId = await account();
    await pushTick(deps, { now: BERLIN_2030 });
    push.failReceipt((await store.sendLogFor(userId, 1))[0]!.ticketId!);
    await collectPushReceipts(deps, Date.now() + 20 * MIN);
    expect((await store.sendLogFor(userId, 1))[0]).toMatchObject({ state: "refused", receiptError: "message-rate-exceeded" });
    expect(await store.pushTokensFor(userId)).toHaveLength(1);
  });

  it("a dead token in the ticket marks the row dead and drops it", async () => {
    const userId = await account({ token: "ExponentPushToken[dead]" });
    push.unregister("ExponentPushToken[dead]");
    await pushTick(deps, { now: BERLIN_2030 });
    expect((await store.sendLogFor(userId, 1))[0]?.state).toBe("dead");
    expect(await store.pushTokensFor(userId)).toEqual([]);
  });

  it("a push service that is down refuses the rows and does not throw; the slot stays claimed", async () => {
    const userId = await account();
    push.failNext();
    await pushTick(deps, { now: BERLIN_2030 });
    expect((await store.sendLogFor(userId, 1))[0]?.state).toBe("refused");
    await pushTick(deps, { now: BERLIN_2030 + MIN });
    expect(push.sent).toHaveLength(0); // a claim is not a send; a stale line is worse than none
  });

  it("logs nothing about a token or a body", async () => {
    await account({ token: "ExponentPushToken[secret]" });
    const lines: string[] = [];
    const log = console.log, err = console.error;
    console.log = (...a: unknown[]) => { lines.push(a.join(" ")); };
    console.error = (...a: unknown[]) => { lines.push(a.join(" ")); };
    try { await pushTick(deps, { now: BERLIN_2030 }); } finally { console.log = log; console.error = err; }
    expect(lines.join("\n")).not.toContain("secret");
  });
});

describe("one bad account is not the whole tick", () => {
  it("keeps going when composing throws for one user", async () => {
    await account({ token: "ExponentPushToken[bad]" });
    await account({ token: "ExponentPushToken[good]" });
    const real = store.getProfile.bind(store);
    let first = true;
    const flaky = { ...store, getProfile: async (id: string) => { if (first) { first = false; throw new Error("db blip"); } return real(id); } };
    const err = console.error;
    console.error = () => {};
    try { await pushTick({ ...deps, store: flaky as Store }, { now: BERLIN_2030 }); } finally { console.error = err; }
    expect(push.sent).toHaveLength(1);
  });
});

describe("who gets which kind", () => {
  it("a subscriber's line claims `streak`, the plain nudge `evening`", async () => {
    const sub = await account({ token: "ExponentPushToken[sub]" });
    const free = await account({ free: true, token: "ExponentPushToken[free]" });
    await pushTick(deps, { now: BERLIN_2030 });
    expect((await store.sendLogFor(sub, 1))[0]?.kind).toBe("streak");
    expect((await store.sendLogFor(free, 1))[0]).toMatchObject({ kind: "evening", templateKey: "nudge" });
    expect(await store.claimPushSlot(free, "2026-08-20", "campaign", null)).toEqual({ claimed: false, heldBy: "evening" });
  });
});

// Ported from the nightly sweep's tests: each is a regression that came from something real.
describe("what the old sweep's tests guarded, on the tick", () => {
  it("speaks each account's own language in one pass, never the first account's (#471)", async () => {
    await account({ lang: "de", token: "ExponentPushToken[de]" });
    await account({ lang: "fr", token: "ExponentPushToken[fr]" });
    await account({ lang: "en", token: "ExponentPushToken[en]" });
    await pushTick(deps, { now: BERLIN_2030 });
    expect(push.sent).toHaveLength(3);
    const titles = new Set(push.sent.map((m) => `${m.title}|${m.body}`));
    expect(titles.size).toBe(3);
    const rows = await Promise.all((await store.pushAudience()).map((a) => store.sendLogFor(a.userId, 1)));
    expect(rows.flat().map((r) => r.lang).sort()).toEqual(["de", "en", "fr"]);
  });

  it("never puts a user's own words on a lock screen", async () => {
    const userId = await account();
    await store.insertMeal({
      id: crypto.randomUUID(), user_id: userId, ts: "2026-08-20T12:00:00.000Z", date: "2026-08-20",
      isFood: true, items: [{ name: "Zanzibar stew", grams: 200 }], kcal: 900, protein_g: 30,
      carbs_g: 50, fat_g: 10, satfat_g: 2, fiber_g: 3, sugar_g: 4, sodium_mg: 300,
      verdicts: {}, healthScore: null, confidence: "high", notes: "my private note", corrected: false, model: "test",
    });
    await pushTick(deps, { now: BERLIN_2030 });
    const text = JSON.stringify(push.sent);
    expect(text).not.toContain("Zanzibar");
    expect(text).not.toContain("private note");
  });

  it("acts on no ticket for a token this send did not address (a stranger's ticket)", async () => {
    const userId = await account({ token: "ExponentPushToken[mine]" });
    const stranger = { ...push, send: async () => [{ token: "ExponentPushToken[stranger]", id: "x", error: "device-not-registered" as const }] };
    const out = await (await import("./notify.ts")).sendLogged(
      { ...deps, push: stranger }, userId, await store.pushTokensFor(userId),
      { kind: "streak", ref: null, templateKey: "evening", lang: "en" }, { title: "t", body: "b" },
    );
    expect(out).toMatchObject({ sent: 0, dropped: 0 });
    expect(await store.pushTokensFor(userId)).toHaveLength(1); // nothing deleted on a stranger's say-so
    expect((await store.sendLogFor(userId, 1))[0]).toMatchObject({ state: "refused", receiptError: "no-ticket" });
  });

  it("counts every message of a batch the service refused (the shape expoPush really produces) and keeps the tokens", async () => {
    const userId = await account({ token: "ExponentPushToken[refused-a]" });
    await store.putPushToken(userId, "ExponentPushToken[refused-b]", "ios");
    const refusing = { ...push, send: async (ms: { to: string }[]) => ms.map((m) => ({ token: m.to, id: null, error: "other" as const })) };
    const out = await pushTick({ ...deps, push: refusing }, { now: BERLIN_2030 });
    expect(out).toMatchObject({ sent: 0, failed: 2, dropped: 0 });
    expect(await store.pushTokensFor(userId)).toHaveLength(2);
    expect((await store.sendLogFor(userId, 5)).every((r) => r.state === "refused")).toBe(true);
  });

  it("names no account and no device when a failure is logged", async () => {
    const userId = await account({ token: "ExponentPushToken[named]" });
    const flaky = { ...store, getProfile: async () => { throw new Error("db blip"); } };
    const lines: string[] = [];
    const err = console.error;
    console.error = (...a: unknown[]) => { lines.push(a.join(" ")); };
    try { await pushTick({ ...deps, store: flaky as Store }, { now: BERLIN_2030 }); } finally { console.error = err; }
    expect(lines.length).toBeGreaterThan(0);
    const all = lines.join("\n");
    expect(all).not.toContain(userId);
    expect(all).not.toContain("named");
  });

  it("a row whose receipt never comes leaves the queue after a day, and cannot starve a newer one", async () => {
    const userId = await account();
    await pushTick(deps, { now: BERLIN_2030 });
    const silent = { ...push, receipts: async () => new Map<string, never>() };
    await collectPushReceipts({ ...deps, push: silent }, Date.now() + 25 * 60 * MIN);
    expect((await store.sendsAwaitingReceipt(10))).toEqual([]);
    expect((await store.sendLogFor(userId, 1))[0]).toMatchObject({ state: "expired", receiptError: "no-receipt" });
  });
});

describe("the admin test push reads the account's zone through a scoped getter", () => {
  it("dates the slot in the account's own zone", async () => {
    const userId = await account({ tz: "Asia/Tokyo" });
    const now = Date.parse("2026-08-20T20:00:00Z"); // 05:00 on the 21st in Tokyo
    expect(await sendTestPush(deps, userId, now)).toEqual({ ok: true, sent: 1 });
    expect(await store.claimPushSlot(userId, "2026-08-21", "campaign", null)).toEqual({ claimed: false, heldBy: "campaign" });
  });
});
