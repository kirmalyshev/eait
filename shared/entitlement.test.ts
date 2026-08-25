import { describe, expect, it, test } from "bun:test";
import { NO_ENTITLEMENT, entitlementActive, entitlementLive, sampleSpent } from "./entitlement.ts";

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
describe("entitlementLive", () => {
  const now = Date.parse("2026-08-25T12:00:00.000Z");
  const future = "2026-09-25T12:00:00.000Z";
  const past = "2026-07-25T12:00:00.000Z";

  it("refuses an account with no record: it has never bought anything", () => {
    expect(entitlementLive(null, now)).toBe(false);
    expect(entitlementLive(undefined, now)).toBe(false);
  });

  it("admits a live subscription and refuses a lapsed one", () => {
    expect(entitlementLive({ expiresAt: future, lifetimeProductId: null }, now)).toBe(true);
    expect(entitlementLive({ expiresAt: past, lifetimeProductId: null }, now)).toBe(false);
  });

  it("admits the lifetime unlock, which has no date to check", () => {
    expect(entitlementLive({ expiresAt: null, lifetimeProductId: "lifetime" }, now)).toBe(true);
  });

  // The case the two-column model exists for: refunding the unlock must not take a subscription
  // with it, and a lapsed subscription must not take the unlock with it.
  it("admits an account holding both, and keeps admitting it when one of them ends", () => {
    expect(entitlementLive({ expiresAt: future, lifetimeProductId: "lifetime" }, now)).toBe(true);
    expect(entitlementLive({ expiresAt: past, lifetimeProductId: "lifetime" }, now)).toBe(true);
    expect(entitlementLive({ expiresAt: future, lifetimeProductId: null }, now)).toBe(true);
  });

  it("refuses a record where both grants are spent", () => {
    expect(entitlementLive({ expiresAt: past, lifetimeProductId: null }, now)).toBe(false);
    expect(entitlementLive({ expiresAt: null, lifetimeProductId: null }, now)).toBe(false);
  });

  it("refuses an unreadable expiry rather than trusting it", () => {
    expect(entitlementLive({ expiresAt: "not a date", lifetimeProductId: null }, now)).toBe(false);
  });
});
