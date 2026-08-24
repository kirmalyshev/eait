import { describe, expect, test } from "bun:test";
import { NO_ENTITLEMENT, entitlementActive } from "./entitlement.ts";

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
