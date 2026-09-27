// The welcome and sign-up screen's words (#110): the two doors, the headline, the consent boxes
// and their error. Both clients draw this screen — `/start` does today and the phone's M3 does —
// so the words live here once rather than once per client. Completeness in all eight languages is
// `localizedGaps`' job in `copy.i18n.test.ts`; this file holds the table's own contract: the keys
// exist, the consent label keeps its two placeholders, and the English is the board's words.

import { describe, expect, it } from "bun:test";
import { LANGS, type Lang } from "../types.ts";
import { SIGNUP_COPY, signupCopyFor } from "./signup-copy.ts";

const KEYS = [
  "startCta", "haveAccountCta", "signUpHeading",
  "termsLabel", "termsLink", "privacyLink", "consentMarketing", "errorTerms",
] as const;

describe("SIGNUP_COPY", () => {
  it("has every key in every language", () => {
    for (const lang of LANGS) {
      const copy = SIGNUP_COPY[lang];
      expect(copy, lang).toBeDefined();
      for (const key of KEYS) {
        expect(copy![key].length, `${lang}.${key}`).toBeGreaterThan(0);
      }
    }
  });

  it("keeps the consent label's two placeholders in every language", () => {
    // `{terms}` and `{privacy}` hold the document names — a translation that drops one renders an
    // agreement that names half of what it means.
    for (const lang of LANGS) {
      const copy = SIGNUP_COPY[lang];
      for (const ph of ["{terms}", "{privacy}"]) {
        expect(copy!.termsLabel, `${lang}.termsLabel`).toContain(ph);
      }
    }
  });

  it("draws the board's words in English", () => {
    const en = signupCopyFor("en" as Lang);
    expect(en.startCta).toBe("Build my plan");
    expect(en.haveAccountCta).toBe("I already have an account");
    expect(en.signUpHeading).toBe("Photograph what you eat, get an honest answer");
  });
});
