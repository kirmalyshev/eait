import { describe, expect, test } from "bun:test";
import { REFERRAL_ALPHABET, REFERRAL_CODE_LENGTH, normalizeReferralCode } from "./referral.ts";

describe("normalizeReferralCode", () => {
  test("a typed code, any case, with stray spaces", () => {
    expect(normalizeReferralCode("K7M2QD")).toBe("K7M2QD");
    expect(normalizeReferralCode("k7m2qd")).toBe("K7M2QD");
    expect(normalizeReferralCode("  k7m 2qd \n")).toBe("K7M2QD");
  });

  test("a pasted invite link, with or without a scheme", () => {
    expect(normalizeReferralCode("https://eait.fit/r/K7M2QD")).toBe("K7M2QD");
    expect(normalizeReferralCode("eait.fit/r/k7m2qd")).toBe("K7M2QD");
    expect(normalizeReferralCode("https://eait.fit/r/K7M2QD/")).toBe("K7M2QD");
    expect(normalizeReferralCode("A week of eait free: eait.fit/r/K7M2QD")).toBe("K7M2QD");
  });

  test("a /start link carrying it as ?ref=", () => {
    expect(normalizeReferralCode("https://app.eait.fit/start?ref=k7m2qd")).toBe("K7M2QD");
    expect(normalizeReferralCode("/start?lang=en&ref=K7M2QD#top")).toBe("K7M2QD");
  });

  // The alphabet drops 0/O and 1/I: a code read off a screen and typed has no pair to confuse.
  test("not a code: wrong length, a dropped letter, nothing at all", () => {
    expect(normalizeReferralCode("K7M2Q")).toBeNull();
    expect(normalizeReferralCode("K7M2QDX")).toBeNull();
    expect(normalizeReferralCode("K7M2Q0")).toBeNull();
    expect(normalizeReferralCode("K7M2QO")).toBeNull();
    expect(normalizeReferralCode("K7M2Q1")).toBeNull();
    expect(normalizeReferralCode("K7M2QI")).toBeNull();
    expect(normalizeReferralCode("https://eait.fit/r/")).toBeNull();
    expect(normalizeReferralCode("")).toBeNull();
    expect(normalizeReferralCode(42 as unknown as string)).toBeNull();
  });

  test("the alphabet is 32 symbols with none of 0, O, 1, I", () => {
    expect(REFERRAL_ALPHABET).toHaveLength(32);
    expect(new Set(REFERRAL_ALPHABET).size).toBe(32);
    expect(REFERRAL_ALPHABET).not.toMatch(/[0O1I]/);
    expect(REFERRAL_CODE_LENGTH).toBe(6);
  });
});
