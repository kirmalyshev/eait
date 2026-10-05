import { describe, expect, it } from "bun:test";
import { offerMath, paywallPercent, paywallPrice, perMonth } from "./paywall.ts";

// The one arithmetic the web paywall (#96) and the native one (#928) share: the exit offer's
// percent off and its per-month equivalent, derived from the two prices that were actually
// configured — never a percentage typed by hand.

describe("offerMath", () => {
  it("derives the offer card's figures from the two prices", () => {
    expect(offerMath(39.99, 23.99)).toEqual({
      percentOff: 40,
      perMonth: 2.00,
    });
  });

  it("floors the discount, so the card never overstates it", () => {
    // 28.99 / 39.99 is 27.5% — the card says 27, never 28.
    expect(offerMath(39.99, 28.99)!.percentOff).toBe(27);
  });

  it("gives the per-month equivalent to the cent", () => {
    expect(offerMath(39.99, 23.99)!.perMonth).toBe(2.00);
    expect(offerMath(50, 10)!.perMonth).toBe(0.83);
  });

  it("answers null when either price is missing or worthless", () => {
    expect(offerMath(0, 23.99)).toBeNull();
    expect(offerMath(39.99, -1)).toBeNull();
    expect(offerMath(NaN, 23.99)).toBeNull();
  });

  it("answers null when the floored saving is under one percent — there is no offer to draw", () => {
    // Priced ABOVE the regular plan, equal to it, or 0.25 % off: every card would say "0 % off"
    // or worse, so the answer is no offer at all and a decline goes to the app.
    expect(offerMath(19.99, 29.99)).toBeNull();
    expect(offerMath(39.99, 39.99)).toBeNull();
    expect(offerMath(40, 39.99)).toBeNull();
  });
});

describe("perMonth", () => {
  it("spreads a yearly amount over a month, to the cent — the one figure both cards share", () => {
    expect(perMonth(23.99)).toBe(2.00);
    expect(perMonth(39.99)).toBe(3.33);
    expect(perMonth(0.09)).toBe(0.01);
  });
});

describe("paywallPrice", () => {
  it("formats an amount in the configured currency and the reader's language", () => {
    expect(paywallPrice(39.99, "EUR", "en")).toBe("€39.99");
    expect(paywallPrice(39.99, "EUR", "de")).toBe("39,99 €");
    expect(paywallPrice(39.99, "USD", "en")).toBe("$39.99");
  });
});

describe("paywallPercent", () => {
  it("writes the sign the locale's own way — tight in English, spaced in French and German (#451)", () => {
    // The badge used to read "40 % off" in English: `{percent}` carried a bare number and every
    // template baked the " %" in. Now `Intl` owns the spacing — the NBSP is CLDR's, not ours.
    expect(paywallPercent(40, "en")).toBe("40%");
    expect(paywallPercent(40, "fr")).toBe("40 %");
    expect(paywallPercent(40, "de")).toBe("40 %");
  });
});
