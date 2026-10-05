// The paywall's words (W9 · kirmalyshev/eait#96): plans → gift → the one offer, then
// catching-up and welcome, plus the phone's dock, trial reminder and lapsed cards.
// The boards are `product/design/pro/{web,phone}/pay-*.html` on ieat-app main (3d2b4357+).
// Completeness in all eight languages is `localizedGaps`' job in `copy.i18n.test.ts`; this file
// holds the table's own contract: the keys exist, the placeholders survive, the English is the
// boards' words, and the claims gate passes over every language.

import { describe, expect, it } from "bun:test";
import { lintCopy } from "../claims.ts";
import { LANGS, type Lang } from "../types.ts";
import { PAY_COPY, payCopyFor } from "./pay-copy.ts";

const KEYS = [
  "plansTitle", "plansHeroAlt",
  "planYearly", "planMonthly", "trialBadge", "pricePerYear", "pricePerMonth",
  "yearlySub", "monthlySub", "perMonthCaption", "benefitPhoto", "benefitPlan", "benefitChat",
  "freeMealLabel",
  "startTrial", "trialNote", "trialNotePhone",
  "giftTitle", "giftAlt", "giftNote", "giftOpen",
  "offerTitle", "offerAlt", "offerOff", "offerPrice", "offerPerMonth",
  "offerClaim", "offerDecline", "offerNote",
  "storeThanks", "catchingUp",
  "welcomeTitle", "welcomeSub", "welcomeBack",
  "subscribingPhone",
  "dockTitlePhone", "subscribePhone",
  "trialEnds", "trialEndsNote", "trialEndsCancel", "renewsLabelPhone",
  "lapsedTitlePhone", "resubscribePhone",
  "closeLabel", "restoreLink", "termsLink", "privacyLink",
] as const;

describe("PAY_COPY", () => {
  it("has every key in every language", () => {
    for (const lang of LANGS) {
      const copy = PAY_COPY[lang];
      expect(copy, lang).toBeDefined();
      for (const key of KEYS) {
        expect(copy![key].length, `${lang}.${key}`).toBeGreaterThan(0);
      }
    }
  });

  it("keeps every placeholder in every language", () => {
    // A dropped `{price}` renders the words around a hole — a plan card that cannot say what it
    // costs. The same class of bug `catalogArgs` catches for the migrated tables.
    const want: Record<string, readonly string[]> = {
      trialBadge: ["{days}"],
      pricePerYear: ["{price}"],
      pricePerMonth: ["{price}"],
      yearlySub: ["{trial}", "{price}"],
      monthlySub: ["{trial}", "{price}"],
      startTrial: ["{days}"],
      trialNote: ["{days}", "{renewal}"],
      trialNotePhone: ["{days}", "{renewal}"],
      offerOff: ["{percent}"],
      offerPrice: ["{price}"],
      offerPerMonth: ["{price}"],
      trialEndsNote: ["{renewal}"],
    };
    for (const lang of LANGS) {
      const copy = PAY_COPY[lang]!;
      for (const [key, phs] of Object.entries(want)) {
        for (const ph of phs) {
          expect(copy[key as keyof typeof copy], `${lang}.${key}`).toContain(ph);
        }
      }
    }
  });

  it("draws the boards' words in English", () => {
    const en = payCopyFor("en" as Lang);
    // pay-plans
    expect(en.plansTitle).toBe("Know if every meal fits");
    expect(en.plansHeroAlt).toBe("Salmon, rice and greens on a plate");
    expect(en.planYearly).toBe("Yearly");
    expect(en.planMonthly).toBe("Monthly");
    expect(en.trialBadge).toBe("{days} days free");
    expect(en.pricePerYear).toBe("{price} a year");
    expect(en.pricePerMonth).toBe("{price} a month");
    // pay-paywall (phone): the benefits, the yearly sub-line, the captions, the free-meal card
    expect(en.benefitPhoto).toBe("One photo logs a meal");
    expect(en.benefitPlan).toBe("Every meal checked against your plan");
    expect(en.benefitChat).toBe("Ask Spud about your day");
    expect(en.yearlySub).toBe("{trial}, then {price} a year");
    expect(en.perMonthCaption).toBe("a month");
    expect(en.freeMealLabel).toBe("Your free meal");
    expect(en.monthlySub).toBe("{trial}, then {price} a month");
    expect(en.startTrial).toBe("Try {days} days free");
    expect(en.trialNote).toBe("{days} days free, then {renewal}. Renews automatically until cancelled. Cancel any time in Profile › Subscription.");
    expect(en.trialNotePhone).toBe("{days} days free, then {renewal}. Renews automatically until cancelled. Cancel in Settings › Apple ID › Subscriptions at least 24 hours before the trial ends.");
    // pay-gift
    expect(en.giftTitle).toBe("We have a gift for you");
    expect(en.giftAlt).toBe("A wrapped gift box");
    expect(en.giftNote).toBe("One offer, shown only this once.");
    expect(en.giftOpen).toBe("Open");
    // pay-ultra
    expect(en.offerTitle).toBe("Your gift: yearly, for less");
    expect(en.offerAlt).toBe("Porridge with berries");
    expect(en.offerOff).toBe("{percent} % off");
    expect(en.offerPrice).toBe("{price} / year");
    expect(en.offerPerMonth).toBe("≈ {price} a month");
    expect(en.offerClaim).toBe("Claim");
    expect(en.offerDecline).toBe("No thanks");
    expect(en.offerNote).toBe("Billed yearly. Cancel any time");
    // pay-catching-up
    expect(en.storeThanks).toBe("Thanks, the store has it");
    expect(en.catchingUp).toBe("Your account is catching up. A few seconds.");
    expect(en.subscribingPhone).toBe("Subscribing");
    // pay-welcome
    expect(en.welcomeTitle).toBe("You’re all set");
    expect(en.welcomeSub).toBe("Every meal gets an honest answer now, and your plan moves when your weight does.");
    expect(en.welcomeBack).toBe("Back to today");
    // pay-dock (phone)
    expect(en.dockTitlePhone).toBe("That was your meal on us");
    expect(en.subscribePhone).toBe("Subscribe");
    // pay-trial-ends (phone and web): the one reminder, named from the board
    expect(en.trialEnds).toBe("Your free trial ends tomorrow");
    expect(en.trialEndsNote).toBe("Then {renewal}. Cancel today and nothing is charged.");
    expect(en.trialEndsCancel).toBe("Cancel today and nothing is charged.");
    expect(en.renewsLabelPhone).toBe("Renews");
    // pay-lapsed (phone)
    expect(en.lapsedTitlePhone).toBe("Your subscription has ended");
    expect(en.resubscribePhone).toBe("Resubscribe");
    // every modal board's chrome and the legal footer
    expect(en.closeLabel).toBe("Close");
    expect(en.restoreLink).toBe("Restore");
    expect(en.termsLink).toBe("Terms");
    expect(en.privacyLink).toBe("Privacy");
  });

  it("carries no claim the gate refuses, in any of the eight", () => {
    // The paywall is the most-attended copy in the product — a discount that overstates itself is
    // exactly what `exclusivity`/`guarantee` exist to stop, so the sweep runs here by name rather
    // than trusting a reviewer to notice.
    for (const lang of LANGS) {
      expect(lintCopy({ ...PAY_COPY[lang]! }), lang).toEqual([]);
    }
  });
});
