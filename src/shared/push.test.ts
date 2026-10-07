import { describe, expect, it } from "bun:test";
import { PUSH_KINDS, SEND_STATES, isTimezone, outranks } from "./push.ts";

describe("push kinds", () => {
  it("ranks trial > streak > onboarding > campaign", () => {
    expect([...PUSH_KINDS]).toEqual(["trial", "streak", "onboarding", "campaign"]);
    expect(outranks("trial", "streak")).toBe(true);
    expect(outranks("streak", "onboarding")).toBe(true);
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
  });
  it("refuses everything else", () => {
    for (const v of ["", "Mars/Base", "Europe/Berlin\n", 5, null, undefined, "x".repeat(100)]) {
      expect(isTimezone(v)).toBe(false);
    }
  });
});
