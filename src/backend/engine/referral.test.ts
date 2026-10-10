// Refer a friend (#899): the friend's week at redemption, the referrer's at the friend's first
// paid period, and the third grant both of them make — which every reader of "paid" must count.

import { beforeEach, describe, expect, it } from "bun:test";
import { configDefaults, type Config } from "../config.ts";
import { demoPorts } from "../llm/demo.ts";
import { logMail } from "../mail/log.ts";
import { fakePush } from "../push/fake.ts";
import { memoryStore } from "../store.memory.ts";
import type { Store, StoreOptions } from "../store.ts";
import {
  adminUsers, applyRevenueCatEvent, checkCaps, entitlementFor, profileView, type EngineDeps, type RevenueCatEvent,
} from "./index.ts";
import { redeemReferral, referralRewardDays, shareReferral } from "./referral.ts";

const DAY = 86_400_000;
const CONFIG: Config = {
  ...configDefaults(),
  port: 0, databaseUrl: "memory://test",
  llmProvider: "demo", llmModel: "demo", llmApiKey: "unused",
  freeAnalyses: 0, landingUrl: "https://eait.fit",
};

let store: Store;
let deps: EngineDeps;
function mount(opts: StoreOptions = {}, over: Partial<Config> = {}) {
  store = memoryStore(opts);
  deps = { store, config: { ...CONFIG, ...over }, llm: demoPorts(), push: fakePush(), mail: logMail() };
}
beforeEach(() => mount());

const account = async () => (await store.upsertDeviceUser(crypto.randomUUID() + crypto.randomUUID(), "en")).userId;
const codeOf = async (userId: string) => (await store.referralOf(userId))!.code;
/** `referrer` and a `friend` who joined with its link. */
async function pair() {
  const referrer = await account();
  const friend = await account();
  const out = await redeemReferral(deps, friend, await codeOf(referrer));
  if ("kind" in out) throw new Error(out.kind);
  return { referrer, friend };
}

let seq = 0;
const paid = (appUserId: string, over: Partial<RevenueCatEvent> = {}): RevenueCatEvent => ({
  appUserId, type: "INITIAL_PURCHASE", entitlementIds: [CONFIG.revenueCatEntitlementId],
  expirationAtMs: Date.now() + 30 * DAY, productId: "com.eait.fit.ios.monthly", trial: false,
  eventTimestampMs: Date.now() + ++seq * 1000, sandbox: false, transactionId: `txn-${seq}`, originalTransactionId: "", refund: false, ...over,
});
const daysLeft = async (userId: string) => {
  const until = await store.bonusUntil(userId);
  return until === null ? null : Math.round((Date.parse(until) - Date.now()) / DAY);
};

describe("redeeming a friend's link", () => {
  it("accepts the link or the code as typed, and starts the friend's week at once", async () => {
    const referrer = await account();
    const friend = await account();
    const out = await redeemReferral(deps, friend, ` https://eait.fit/r/${(await codeOf(referrer)).toLowerCase()} `);
    if ("kind" in out) throw new Error(out.kind);
    expect(out.referral.applied).toBe(true);
    expect(out.entitlement).toMatchObject({ active: true, expiresAt: null, trial: false, lapsed: false });
    expect(out.entitlement.bonusUntil).toBe(await store.bonusUntil(friend));
    expect(await daysLeft(friend)).toBe(7);
  });

  it("takes the friend's days from config", async () => {
    mount({}, { referralFriendDays: 3 });
    const { friend } = await pair();
    expect(await daysLeft(friend)).toBe(3);
  });

  it("refuses an unknown code, the account's own, and a second one, granting nothing", async () => {
    const me = await account();
    expect(await redeemReferral(deps, me, "ZZZZZZ")).toEqual({ kind: "referral-unknown" });
    expect(await redeemReferral(deps, me, "not a code")).toEqual({ kind: "referral-unknown" });
    expect(await redeemReferral(deps, me, 42)).toEqual({ kind: "referral-unknown" });
    expect(await redeemReferral(deps, me, await codeOf(me))).toEqual({ kind: "referral-own" });
    expect(await store.bonusUntil(me)).toBeNull();
    const { friend } = await pair();
    expect(await redeemReferral(deps, friend, await codeOf(await account()))).toEqual({ kind: "referral-already" });
    expect(await daysLeft(friend)).toBe(7);
  });
});

// Must-fix (#597 review): the referral is for somebody who has not paid. A renewal of a plan bought
// before the code applied must never pay the referrer — so the code is refused there, and a
// payment from before the code applied, however late it is delivered, pays nobody.
describe("a friend who had already paid", () => {
  it("is refused at redemption, with its own kind", async () => {
    const referrer = await account();
    const friend = await account();
    await applyRevenueCatEvent(deps, paid(friend));
    expect(await redeemReferral(deps, friend, await codeOf(referrer))).toEqual({ kind: "referral-paid" });
    await applyRevenueCatEvent(deps, paid(friend, { type: "RENEWAL" }));
    expect(await store.bonusUntil(referrer)).toBeNull();
  });

  it("may still join from a free trial, and the referrer is paid when it converts", async () => {
    const referrer = await account();
    const friend = await account();
    await applyRevenueCatEvent(deps, paid(friend, { trial: true }));
    expect("kind" in await redeemReferral(deps, friend, await codeOf(referrer))).toBe(false);
    await applyRevenueCatEvent(deps, paid(friend, { type: "RENEWAL" }));
    expect(await daysLeft(referrer)).toBe(7);
  });

  it("earns nothing from a payment made before the code applied, delivered after it, nor from its renewals", async () => {
    const { referrer, friend } = await pair();
    await applyRevenueCatEvent(deps, paid(friend, { eventTimestampMs: Date.now() - 60_000 }));
    await applyRevenueCatEvent(deps, paid(friend, { type: "RENEWAL" }));
    expect(await store.bonusUntil(referrer)).toBeNull();
  });

  it("takes the reward back when that early payment is delivered after a renewal paid it", async () => {
    const { referrer, friend } = await pair();
    await applyRevenueCatEvent(deps, paid(friend, { type: "RENEWAL" }));
    expect(await daysLeft(referrer)).toBe(7);
    await applyRevenueCatEvent(deps, paid(friend, { eventTimestampMs: Date.now() - 60_000 }));
    expect(await daysLeft(referrer)).toBe(0);
  });
});

// Must-fix (#597 review): a refund of the paid period that earned the reward revokes it — only
// that one: "will not renew" is not a refund, and a refund of a later renewal is not that period.
describe("deliveries out of order, and one subscription on several accounts", () => {
  it("pays for the earliest paid period, whichever arrives first", async () => {
    const { referrer, friend } = await pair();
    const first = Date.now() + 10_000;
    await applyRevenueCatEvent(deps, paid(friend, { type: "RENEWAL", eventTimestampMs: first + 60_000 }));
    await applyRevenueCatEvent(deps, paid(friend, { productId: "com.eait.fit.ios.yearly", eventTimestampMs: first }));
    expect(await daysLeft(referrer)).toBe(14);
  });

  it("pays once for one store subscription, whichever account it lands on", async () => {
    const referrer = await account();
    const [a, b] = [await account(), await account()];
    await redeemReferral(deps, a, await codeOf(referrer));
    await redeemReferral(deps, b, await codeOf(referrer));
    await applyRevenueCatEvent(deps, paid(a, { originalTransactionId: "apple-sub-1" }));
    await applyRevenueCatEvent(deps, paid(b, { originalTransactionId: "apple-sub-1" }));
    expect(await daysLeft(referrer)).toBe(7);
  });
});

describe("a refunded first payment", () => {
  const refund = (friend: string, transactionId: string, over: Partial<RevenueCatEvent> = {}) =>
    paid(friend, { type: "CANCELLATION", transactionId, refund: true, ...over });

  it("takes the referrer's reward back, and that friend never earns it again", async () => {
    const { referrer, friend } = await pair();
    await applyRevenueCatEvent(deps, paid(friend, { transactionId: "t-first", productId: "com.eait.fit.ios.yearly" }));
    expect(await daysLeft(referrer)).toBe(14);
    await applyRevenueCatEvent(deps, refund(friend, "t-first"));
    expect(await daysLeft(referrer)).toBe(0);
    await applyRevenueCatEvent(deps, paid(friend, { type: "RENEWAL", transactionId: "t-again" }));
    expect(await daysLeft(referrer)).toBe(0);
  });

  it("earns nothing when the refund is delivered before the payment it refunds", async () => {
    const { referrer, friend } = await pair();
    await applyRevenueCatEvent(deps, refund(friend, "t-first"));
    await applyRevenueCatEvent(deps, paid(friend, { transactionId: "t-first", eventTimestampMs: Date.now() + 1_000 }));
    expect(await store.bonusUntil(referrer)).toBeNull();
  });

  it("is not a cancellation that only stops the renewal, nor a refund of some other period", async () => {
    const { referrer, friend } = await pair();
    await applyRevenueCatEvent(deps, paid(friend, { transactionId: "t-first" }));
    await applyRevenueCatEvent(deps, refund(friend, "t-first", { refund: false }));
    await applyRevenueCatEvent(deps, refund(friend, "t-later"));
    await applyRevenueCatEvent(deps, refund(friend, "t-first", { entitlementIds: ["something-else"] }));
    expect(await daysLeft(referrer)).toBe(7);
  });
});

describe("the referral week is a grant", () => {
  it("lifts the sample refusal while it runs", async () => {
    const me = await account();
    await store.addIdentity(me, "google", `g-${me}`);
    expect(await checkCaps(deps, me, "2026-10-10", "photo")).toEqual({ kind: "subscription-required" });
    await redeemReferral(deps, me, await codeOf(await account()));
    expect(await checkCaps(deps, me, "2026-10-10", "photo")).toBeNull();
  });

  it("ends on its date, and a friend whose week ended without paying is not lapsed", async () => {
    mount({ now: () => Date.now() - 8 * DAY });
    const { friend } = await pair();
    expect(await entitlementFor(deps, friend)).toMatchObject({ active: false, lapsed: false, bonusUntil: null });
  });

  it("describes only the subscription when one is live, and sends the week only when it is alone", async () => {
    const { referrer, friend } = await pair();
    await applyRevenueCatEvent(deps, paid(friend));
    const e = await entitlementFor(deps, friend);
    expect(e).toMatchObject({ active: true, trial: false, bonusUntil: null, productId: "com.eait.fit.ios.monthly" });
    expect(e.expiresAt).not.toBeNull();
    expect((await entitlementFor(deps, referrer)).bonusUntil).toBe(await store.bonusUntil(referrer));
  });

  it("counts on the admin's list", async () => {
    const { friend } = await pair();
    const row = (await adminUsers(deps, { q: friend, limit: 1 })).users[0]!;
    expect(row.entitlement).toBeNull();
    expect(row.entitled).toBe(true);
  });
});

describe("the referrer's reward", () => {
  it("is a week for a monthly friend and two for a yearly one, past the referrer's own access", async () => {
    const monthly = await pair();
    await applyRevenueCatEvent(deps, paid(monthly.friend));
    expect(await daysLeft(monthly.referrer)).toBe(7);

    const yearly = await pair();
    await applyRevenueCatEvent(deps, paid(yearly.referrer, { expirationAtMs: Date.now() + 30 * DAY }));
    await applyRevenueCatEvent(deps, paid(yearly.friend, { productId: "com.eait.fit.ios.yearly" }));
    expect(await daysLeft(yearly.referrer)).toBe(44);
  });

  it("is granted once per friend, ever", async () => {
    const { referrer, friend } = await pair();
    await applyRevenueCatEvent(deps, paid(friend));
    await applyRevenueCatEvent(deps, paid(friend, { type: "RENEWAL", productId: "com.eait.fit.ios.yearly" }));
    expect(await daysLeft(referrer)).toBe(7);
    expect((await profileView(deps, referrer))!.referral).toMatchObject({ joined: 1, subscribed: 1, weeksEarned: 1 });
  });

  it("pays once for the same delivery twice, and once for two deliveries racing", async () => {
    const { referrer, friend } = await pair();
    const event = paid(friend);
    await applyRevenueCatEvent(deps, event);
    await applyRevenueCatEvent(deps, event);
    await Promise.all([applyRevenueCatEvent(deps, paid(friend, { type: "RENEWAL" })), applyRevenueCatEvent(deps, paid(friend, { type: "RENEWAL" }))]);
    expect(await daysLeft(referrer)).toBe(7);
  });

  it("waits out a free trial and comes with the first paid period", async () => {
    const { referrer, friend } = await pair();
    await applyRevenueCatEvent(deps, paid(friend, { trial: true }));
    expect(await store.bonusUntil(referrer)).toBeNull();
    await applyRevenueCatEvent(deps, paid(friend, { type: "RENEWAL" }));
    expect(await daysLeft(referrer)).toBe(7);
  });

  it("is never granted by a sandbox purchase, a lifetime, a cancellation, or another entitlement", async () => {
    mount({}, { revenueCatAcceptSandbox: true });
    const { referrer, friend } = await pair();
    expect(await applyRevenueCatEvent(deps, paid(friend, { sandbox: true }))).toEqual({ applied: true });
    await applyRevenueCatEvent(deps, paid(friend, { type: "NON_RENEWING_PURCHASE", expirationAtMs: null, productId: "lifetime" }));
    await applyRevenueCatEvent(deps, paid(friend, { type: "CANCELLATION" }));
    await applyRevenueCatEvent(deps, paid(friend, { entitlementIds: ["something-else"] }));
    expect(await store.bonusUntil(referrer)).toBeNull();
  });

  // A paid period delivered after a newer event is not written, but it is still a payment: the
  // grant is its own once-only write, so the friend who paid still earns the referrer the week.
  it("is granted for a paid period delivered out of order", async () => {
    const { referrer, friend } = await pair();
    const late = paid(friend);
    await applyRevenueCatEvent(deps, paid(friend, { type: "CANCELLATION", trial: true }));
    expect(await applyRevenueCatEvent(deps, late)).toEqual({ applied: false, reason: "not-applied" });
    expect(await daysLeft(referrer)).toBe(7);
  });

  it("is nothing for an account nobody referred", async () => {
    const loner = await account();
    expect(await applyRevenueCatEvent(deps, paid(loner))).toEqual({ applied: true });
    expect(await store.bonusUntil(loner)).toBeNull();
  });

  // Must-fix (#597 review): the lengths end to end, through the webhook, per product.
  it("pays each product's length through the webhook: the config's, else the name's, month before year", async () => {
    mount({}, { referralRewardDays: { "pro.annual.v2": 21, "plan-y": 14 } });
    const cases: [string, number][] = [
      ["com.eait.fit.ios.monthly", 7], ["com.eait.fit.ios.yearly", 14], ["eait_pro_annual", 14],
      ["pro.annual.v2", 21], ["plan-y", 14], ["anything", 7],
      // Both words in one id: never the longer reward on a guess.
      ["eait_monthly_yearly_promo", 7],
    ];
    for (const [productId, days] of cases) {
      const { referrer, friend } = await pair();
      await applyRevenueCatEvent(deps, paid(friend, { productId }));
      expect(await daysLeft(referrer), productId).toBe(days);
    }
  });

  it("reads the product's days from config before its name", () => {
    const config = { ...CONFIG, referralRewardDays: { "pro.annual.v2": 21, "plan-y": 14 } };
    expect(referralRewardDays(config, "pro.annual.v2")).toBe(21);
    expect(referralRewardDays(config, "plan-y")).toBe(14);
    expect(referralRewardDays(config, "com.eait.fit.ios.yearly")).toBe(14);
    expect(referralRewardDays(config, "eait_pro_annual")).toBe(14);
    expect(referralRewardDays(config, "com.eait.fit.ios.monthly")).toBe(7);
    expect(referralRewardDays(config, "anything")).toBe(7);
  });
});

describe("the profile's referral card", () => {
  it("carries the link, and counts without naming anybody", async () => {
    const { referrer } = await pair();
    const view = (await profileView(deps, referrer))!.referral;
    expect(view).toEqual({
      link: `https://eait.fit/r/${await codeOf(referrer)}`, applied: false, joined: 1, subscribed: 0, weeksEarned: 0, bankedDays: 0,
    });
  });

  // Kirill, 10 Oct: a paying referrer's weeks are BANKED after their subscription and shown.
  it("says how many days are banked past a live subscription, and none otherwise", async () => {
    const { referrer, friend } = await pair();
    expect((await profileView(deps, referrer))!.referral.bankedDays).toBe(0);
    await applyRevenueCatEvent(deps, paid(referrer, { expirationAtMs: Date.now() + 30 * DAY }));
    await applyRevenueCatEvent(deps, paid(friend, { productId: "com.eait.fit.ios.yearly" }));
    expect((await profileView(deps, referrer))!.referral.bankedDays).toBe(14);
    // Without a live subscription the weeks are in use, not banked.
    const other = await pair();
    await applyRevenueCatEvent(deps, paid(other.friend));
    expect((await profileView(deps, other.referrer))!.referral.bankedDays).toBe(0);
  });

  it("falls back to the web origin, then the API's, for the link", async () => {
    mount({}, { landingUrl: "", publicWebUrl: "https://app.example" });
    const me = await account();
    expect((await profileView(deps, me))!.referral.link).toBe(`https://app.example/r/${await codeOf(me)}`);
  });
});

describe("sharing the link", () => {
  it("counts a short label and refuses anything else", async () => {
    const me = await account();
    expect(await shareReferral(deps, me, "Messages")).toBe(true);
    expect(await shareReferral(deps, me, "whatsapp")).toBe(true);
    for (const bad of ["", " ", "a".repeat(33), "hi there", "<script>", 7, null]) {
      expect(await shareReferral(deps, me, bad)).toBe(false);
    }
    expect((await store.referralOf(me))!.shares).toBe(2);
  });
});
