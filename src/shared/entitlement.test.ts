import { describe, expect, it, test } from "bun:test";
import {
  FREE_ANALYSES, NO_ENTITLEMENT, blockedAsk, entitlementActive, entitlementLive, mayHaveSpentSample, sampleSpent,
  subscriptionState, trialDaysLeft,
} from "./entitlement.ts";

const NOW = Date.parse("2026-08-24T12:00:00.000Z");

describe("entitlementActive", () => {
  test("a future expiry is entitled", () => {
    expect(entitlementActive("2026-09-24T12:00:00.000Z", NOW)).toBe(true);
  });

  test("a past expiry is not", () => {
    expect(entitlementActive("2026-08-24T11:59:59.000Z", NOW)).toBe(false);
  });

  // The boundary belongs to the store, not to us: at the instant it lapses, it has lapsed.
  test("the expiry instant itself is not entitled", () => {
    expect(entitlementActive("2026-08-24T12:00:00.000Z", NOW)).toBe(false);
  });

  test("never purchased is not entitled", () => {
    expect(entitlementActive(null, NOW)).toBe(false);
    expect(entitlementActive(undefined, NOW)).toBe(false);
    expect(entitlementActive("", NOW)).toBe(false);
  });

  // A permanent free pass that no webhook can revoke is the one failure worth being sure about.
  test("garbage is not entitled", () => {
    expect(entitlementActive("whenever", NOW)).toBe(false);
    expect(entitlementActive("2026-13-45T99:99:99Z", NOW)).toBe(false);
  });

  test("the never-purchased constant is inert", () => {
    expect(NO_ENTITLEMENT.active).toBe(false);
    expect(entitlementActive(NO_ENTITLEMENT.expiresAt, NOW)).toBe(false);
  });
});

// The one predicate every surface reads before inviting a retry of a failed analysis: on the
// sample, the cap was charged before the model was asked, and the retry would meet a 402.
describe("sampleSpent", () => {
  test("is the sample used with no entitlement to fall back on, and nothing without a profile", () => {
    expect(sampleSpent({ limits: { sampleUsed: true }, entitlement: { active: false } })).toBe(true);
    expect(sampleSpent({ limits: { sampleUsed: true }, entitlement: { active: true } })).toBe(false);
    expect(sampleSpent({ limits: { sampleUsed: false }, entitlement: { active: false } })).toBe(false);
    expect(sampleSpent(null)).toBe(false);
    expect(sampleSpent(undefined)).toBe(false);
  });
});

// `entitlementLive` is the single yes/no authority for the paid tier, and the only place that
// knows a customer can hold two grants at once. Tested directly rather than only through the
// backend, because every one of these cases is a different person being let in or refused.
describe("blockedAsk", () => {
  // What stands where the camera and the composer were, once the account cannot log a meal.
  test("nothing, while the account can still log one", () => {
    expect(blockedAsk({ limits: { sampleUsed: false }, entitlement: { active: false, lapsed: false } })).toBeNull();
    expect(blockedAsk({ limits: { sampleUsed: true }, entitlement: { active: true, lapsed: false } })).toBeNull();
    expect(blockedAsk(null)).toBeNull();
    expect(blockedAsk(undefined)).toBeNull();
  });

  test("subscribe, for a spent sample and nothing ever bought", () => {
    expect(blockedAsk({ limits: { sampleUsed: true }, entitlement: { active: false, lapsed: false } })).toBe("subscribe");
    // A server older than `lapsed` sends none, and subscribe is the ask that is true of both people.
    expect(blockedAsk({ limits: { sampleUsed: true }, entitlement: { active: false } })).toBe("subscribe");
  });

  test("resubscribe, for a spent sample after a subscription ended", () => {
    expect(blockedAsk({ limits: { sampleUsed: true }, entitlement: { active: false, lapsed: true } })).toBe("resubscribe");
  });
});

describe("mayHaveSpentSample", () => {
  test("an unentitled account on its last analysis, or one whose profile cannot count", () => {
    expect(mayHaveSpentSample({ limits: { sampleRemaining: 1 }, entitlement: { active: false } })).toBe(true);
    expect(mayHaveSpentSample({ limits: { sampleRemaining: 0 }, entitlement: { active: false } })).toBe(true);
    // A server older than the count: re-read, which is the safe direction.
    expect(mayHaveSpentSample({ limits: {}, entitlement: { active: false } })).toBe(true);
  });

  test("not with analyses to spare, and never for an entitled account", () => {
    expect(mayHaveSpentSample({ limits: { sampleRemaining: 2 }, entitlement: { active: false } })).toBe(false);
    expect(mayHaveSpentSample({ limits: { sampleRemaining: 0 }, entitlement: { active: true } })).toBe(false);
    expect(mayHaveSpentSample(null)).toBe(false);
  });
});

describe("entitlementLive", () => {
  const now = Date.parse("2026-08-25T12:00:00.000Z");
  const future = "2026-09-25T12:00:00.000Z";
  const past = "2026-07-25T12:00:00.000Z";

  it("refuses an account with no record: it has never bought anything", () => {
    expect(entitlementLive(null, now, null)).toBe(false);
    expect(entitlementLive(undefined, now, null)).toBe(false);
  });

  it("admits a live subscription and refuses a lapsed one", () => {
    expect(entitlementLive({ expiresAt: future, lifetimeProductId: null }, now, null)).toBe(true);
    expect(entitlementLive({ expiresAt: past, lifetimeProductId: null }, now, null)).toBe(false);
  });

  it("admits the lifetime unlock, which has no date to check", () => {
    expect(entitlementLive({ expiresAt: null, lifetimeProductId: "lifetime" }, now, null)).toBe(true);
  });

  // The case the two-column model exists for: refunding the unlock must not take a subscription
  // with it, and a lapsed subscription must not take the unlock with it.
  it("admits an account holding both, and keeps admitting it when one of them ends", () => {
    expect(entitlementLive({ expiresAt: future, lifetimeProductId: "lifetime" }, now, null)).toBe(true);
    expect(entitlementLive({ expiresAt: past, lifetimeProductId: "lifetime" }, now, null)).toBe(true);
    expect(entitlementLive({ expiresAt: future, lifetimeProductId: null }, now, null)).toBe(true);
  });

  it("refuses a record where both grants are spent", () => {
    expect(entitlementLive({ expiresAt: past, lifetimeProductId: null }, now, null)).toBe(false);
    expect(entitlementLive({ expiresAt: null, lifetimeProductId: null }, now, null)).toBe(false);
  });

  it("refuses an unreadable expiry rather than trusting it", () => {
    expect(entitlementLive({ expiresAt: "not a date", lifetimeProductId: null }, now, null)).toBe(false);
  });

  // The referral week (#899) is the third grant: it admits an account that never bought anything,
  // and it ends on its date like a subscription does.
  it("admits a live referral week with no record at all, and refuses it once it has ended", () => {
    expect(entitlementLive(null, now, future)).toBe(true);
    expect(entitlementLive({ expiresAt: past, lifetimeProductId: null }, now, future)).toBe(true);
    expect(entitlementLive(null, now, past)).toBe(false);
    expect(entitlementLive(null, now, "not a date")).toBe(false);
  });
});

describe("FREE_ANALYSES", () => {
  // #44: the sample is the ONE meal the v5 onboarding gives when the soft offer is closed. Its
  // verdict is followed by the offer that holds, and the server's 402 is what makes it hold.
  test("is one analysis — the meal on us, and nothing after it", () => {
    expect(FREE_ANALYSES).toBe(1);
  });
});

// `trialDaysLeft` — how many calendar days the trial still has, as the Subscription row and the
// reminder both count it (#97, W10/M10). Counted OFF THE EXPIRY so it is length-agnostic
// (ieat-app#1591): "day {n} of {len}" is `len − daysLeft`, the `len` the client's own reading.
describe("trialDaysLeft", () => {
  const TZ = "Europe/Berlin";
  // A trial whose expiry falls on Sat 26 Sep in Berlin.
  const trial = { active: true, trial: true, expiresAt: "2026-09-26T12:00:00.000Z" };

  test("counts the days left off the EXPIRY, so it and the reminder agree", () => {
    expect(trialDaysLeft(trial, TZ, Date.parse("2026-09-20T09:00:00Z"))).toBe(6);
    // The day before is 1, the expiry date itself 0 — "ends tomorrow" reads off the same number.
    expect(trialDaysLeft(trial, TZ, Date.parse("2026-09-25T09:00:00Z"))).toBe(1);
    expect(trialDaysLeft(trial, TZ, Date.parse("2026-09-26T09:00:00Z"))).toBe(0);
  });

  test("is null the moment it is not a live trial", () => {
    // Never bought, expired, converted to paid, a lifetime unlock — each has nothing to count.
    expect(trialDaysLeft({ active: false, trial: true, expiresAt: trial.expiresAt }, TZ, Date.parse("2026-09-24T09:00:00Z"))).toBeNull();
    expect(trialDaysLeft({ active: true, trial: false, expiresAt: trial.expiresAt }, TZ, Date.parse("2026-09-24T09:00:00Z"))).toBeNull();
    expect(trialDaysLeft({ active: true, trial: true, expiresAt: null }, TZ, Date.parse("2026-09-24T09:00:00Z"))).toBeNull();
    expect(trialDaysLeft({ active: true, trial: true, expiresAt: "not a date" }, TZ, Date.parse("2026-09-24T09:00:00Z"))).toBeNull();
    // Past the expiry instant: the trial is over, whatever the calendar diff says.
    expect(trialDaysLeft(trial, TZ, Date.parse("2026-09-26T12:00:01Z"))).toBeNull();
  });

  test("a trial that just started still counts off its own expiry, however far out grace put it", () => {
    expect(trialDaysLeft({ ...trial, expiresAt: "2026-09-28T12:00:00.000Z" }, TZ, Date.parse("2026-09-20T09:00:00Z"))).toBe(8);
  });
});

// The Subscription row's state — one word per entitlement shape (#175), the web row's and the
// phone board's. `trialDaysLeft` is the server's count; "until", never "renews", because the store
// does not say whether a paid period renews.
describe("subscriptionState", () => {
  test("a live trial is its days-left count", () => {
    expect(subscriptionState({ active: true, expiresAt: "2026-10-01T00:00:00.000Z", trial: true, trialDaysLeft: 5 }))
      .toEqual({ kind: "trial", daysLeft: 5 });
  });

  test("a paid period is 'until' its expiry", () => {
    expect(subscriptionState({ active: true, expiresAt: "2026-10-24T00:00:00.000Z", trial: false }))
      .toEqual({ kind: "until", date: "2026-10-24T00:00:00.000Z" });
  });

  // A friend on the referral week has no subscription date and no lifetime: the row says when the
  // week ends rather than calling it forever.
  test("a referral week is 'until' its end", () => {
    expect(subscriptionState({ active: true, expiresAt: null, trial: false, bonusUntil: "2026-10-17T00:00:00.000Z" }))
      .toEqual({ kind: "until", date: "2026-10-17T00:00:00.000Z" });
  });

  test("active with nothing to expire is the lifetime unlock", () => {
    expect(subscriptionState({ active: true, expiresAt: null, trial: false }))
      .toEqual({ kind: "lifetime" });
  });

  test("lapsed is 'ended' — dated when the record still carries one, plain otherwise", () => {
    expect(subscriptionState({ active: false, expiresAt: "2026-09-01T00:00:00.000Z", trial: false, lapsed: true }))
      .toEqual({ kind: "ended", date: "2026-09-01T00:00:00.000Z" });
    expect(subscriptionState({ active: false, expiresAt: null, trial: false, lapsed: true }))
      .toEqual({ kind: "ended", date: null });
  });

  test("never bought is 'free'", () => {
    expect(subscriptionState(NO_ENTITLEMENT)).toEqual({ kind: "free" });
  });
});
