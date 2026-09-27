// The rough-guess question's arithmetic (eait#92, design-pro's ruling): the card asks about the
// item with the most grams, "Half that" is grams ÷ 2 rounded to 5 g, and "More like {n} g" is
// ×1.5 rounded UP to the next 50 g at 100 g or more and the next 10 g below it — 150 → 250.

import { describe, expect, test } from "bun:test";
import { roughGrams, roughPick } from "../screens/log.ts";

describe("roughPick — the item the composed question names", () => {
  const item = (name: string, grams: number) => ({ name, grams });

  test("the most grams, first-listed on a tie", () => {
    expect(roughPick([item("salmon", 140), item("rice", 150), item("broccoli", 90)])?.name).toBe("rice");
    expect(roughPick([item("a", 100), item("b", 100)])?.name).toBe("a");
    expect(roughPick([item("sauce", 0), item("rice", 150)])?.name).toBe("rice");
  });

  test("nothing to ask about when nothing carries grams", () => {
    expect(roughPick([])).toBeNull();
    expect(roughPick([item("a taste", 0)])).toBeNull();
  });
});

describe("roughGrams — the answers the card offers", () => {
  test("half is ÷2 rounded to 5 g", () => {
    expect(roughGrams(150).half).toBe(75);
    expect(roughGrams(90).half).toBe(45);
    expect(roughGrams(20).half).toBe(10);
    expect(roughGrams(7).half).toBe(5);
  });

  test("more is ×1.5 rounded up — next 50 g at ≥100, next 10 g below", () => {
    expect(roughGrams(150).more).toBe(250);
    expect(roughGrams(90).more).toBe(140);
    expect(roughGrams(20).more).toBe(30);
    expect(roughGrams(200).more).toBe(300);
  });
});
