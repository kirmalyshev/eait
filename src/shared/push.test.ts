import { describe, expect, it } from "bun:test";
import { PUSH_KINDS, SEND_STATES, isTimezone, pushSenderOf } from "./push.ts";

describe("push kinds", () => {
  it("names the kinds", () => {
    expect([...PUSH_KINDS]).toEqual(["trial", "streak", "evening", "onboarding", "campaign"]);
  });
  it("keys a claim by sender: the scheduled kinds share one, each campaign has its own", () => {
    for (const k of ["trial", "streak", "evening", "onboarding"] as const) expect(pushSenderOf(k, "x")).toBe("scheduled");
    expect(pushSenderOf("campaign", "c1")).toBe("campaign:c1");
    expect(pushSenderOf("campaign", "admin:a")).not.toBe(pushSenderOf("campaign", "admin-test"));
  });
  it("names the send states", () => {
    expect([...SEND_STATES]).toEqual(["queued", "accepted", "refused", "delivered-to-apns", "dead", "dry", "expired", "would_have_sent"]);
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
