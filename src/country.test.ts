import { describe, expect, test } from "bun:test";
import { translatorFor } from "./i18n/index.ts";
import { COUNTRIES, countryForPrompt, countryLabel, isCountryCode, parseCountry } from "./country.ts";

describe("country vocabulary", () => {
  test("isCountryCode accepts curated codes, rejects everything else", () => {
    expect(isCountryCode("de")).toBe(true);
    expect(isCountryCode("ru")).toBe(true);
    expect(isCountryCode("xx")).toBe(false);
    expect(isCountryCode("")).toBe(false);
    expect(isCountryCode("Germany")).toBe(false);
    expect(isCountryCode(null)).toBe(false);
    expect(isCountryCode(42)).toBe(false);
  });

  test("every curated code resolves to a non-empty English prompt name", () => {
    for (const c of COUNTRIES) expect(countryForPrompt(c)).toBeTruthy();
  });

  test("countryForPrompt resolves a code to its English name, passes a raw string through", () => {
    expect(countryForPrompt("de")).toBe("Germany");
    expect(countryForPrompt("portugal")).toBe("portugal"); // raw 'other'
  });

  test("countryForPrompt maps the skip sentinel and null/undefined to null", () => {
    expect(countryForPrompt("")).toBeNull();
    expect(countryForPrompt(null)).toBeNull();
    expect(countryForPrompt(undefined)).toBeNull();
  });

  test("countryLabel localizes a known code, shows a raw string as itself", () => {
    const t = translatorFor("en");
    expect(countryLabel("de", t)).toBe(t("country.de"));
    expect(countryLabel("portugal", t)).toBe("portugal");
  });

  test("parseCountry trims and rejects empty / whitespace / overlong", () => {
    expect(parseCountry("  Portugal ")).toBe("Portugal");
    expect(parseCountry("")).toBeNull();
    expect(parseCountry("   ")).toBeNull();
    expect(parseCountry("x".repeat(61))).toBeNull();
  });
});
