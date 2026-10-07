import { describe, expect, it } from "bun:test";
import { PUSH_KINDS, SEND_STATES, isTimezone, outranks } from "./push.ts";

describe("push kinds", () => {
  it("ranks trial > streak > onboarding > campaign", () => {
    expect([...PUSH_KINDS]).toEqual(["trial", "streak", "evening", "onboarding", "campaign"]);
    expect(outranks("trial", "streak")).toBe(true);
    expect(outranks("streak", "evening")).toBe(true);
    expect(outranks("evening", "onboarding")).toBe(true);
    expect(outranks("onboarding", "campaign")).toBe(true);
    expect(outranks("campaign", "trial")).toBe(false);
    expect(outranks("trial", "trial")).toBe(false);
  });
  it("names the send states", () => {
    expect([...SEND_STATES]).toEqual(["queued", "accepted", "refused", "delivered-to-apns", "dead", "dry"]);
  });
});

describe("isTimezone", () => {
  it("accepts IANA zones", () => {
    expect(isTimezone("Asia/Tokyo")).toBe(true);
    expect(isTimezone("America/Los_Angeles")).toBe(true);
    // names a phone really reports, which `Intl.supportedValuesOf` leaves out in bun 1.4
    for (const z of ["Asia/Kolkata", "Asia/Ho_Chi_Minh", "Europe/Kyiv", "Etc/UTC", "UTC"]) {
      expect(isTimezone(z)).toBe(true);
    }
  });
  it("refuses everything else", () => {
    for (const v of ["", "Mars/Base", "Europe/Berlin\n", 5, null, undefined, "x".repeat(100)]) {
      expect(isTimezone(v)).toBe(false);
    }
  });
});
