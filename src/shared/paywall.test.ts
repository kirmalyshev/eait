import { describe, expect, it } from "bun:test";
import { offerMath, paywallPrice } from "./paywall.ts";

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

  it("reports a negative discount rather than inventing one when the offer costs more", () => {
    // −50.02 % floored is −51: down, always, so a mispriced offer can only look worse, never
    // better, than it is.
    expect(offerMath(19.99, 29.99)!.percentOff).toBe(-51);
  });
});

describe("paywallPrice", () => {
  it("formats an amount in the configured currency and the reader's language", () => {
    expect(paywallPrice(39.99, "EUR", "en")).toBe("€39.99");
    expect(paywallPrice(39.99, "EUR", "de")).toBe("39,99 €");
    expect(paywallPrice(39.99, "USD", "en")).toBe("$39.99");
  });
});
