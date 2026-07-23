import { describe, expect, test } from "bun:test";
import {
  LIMITATIONS_DISPLAY_LEN,
  LIMITATIONS_MAX_LEN,
  limitationsDisplay,
  parseLimitations,
} from "./limitations.ts";

describe("parseLimitations", () => {
  test("passes ordinary text through unchanged", () => {
    expect(parseLimitations("no peanuts, gastritis")).toBe("no peanuts, gastritis");
  });

  test("trims and collapses every whitespace run to a single space", () => {
    expect(parseLimitations("  no   peanuts\n\nno spicy\tfood  ")).toBe(
      "no peanuts no spicy food",
    );
  });

  test("is single-line: newlines can never survive", () => {
    const out = parseLimitations("line one\nline two\r\nline three");
    expect(out).not.toBeNull();
    expect(out).not.toContain("\n");
    expect(out).not.toContain("\r");
  });

  test("drops double quotes — the value is interpolated inside a quoted prompt span", () => {
    expect(parseLimitations('no "junk" food')).toBe("no junk food");
  });

  test("strips control characters", () => {
    // C0 and C1 — a hand-crafted payload must never reach the prompt intact.
    expect(parseLimitations("no \u0001 peanuts")).toBe("no peanuts");
    expect(parseLimitations("no \u009b peanuts")).toBe("no peanuts");
  });

  test("caps at LIMITATIONS_MAX_LEN", () => {
    const out = parseLimitations("a".repeat(500));
    expect(out).toHaveLength(LIMITATIONS_MAX_LEN);
  });

  test("empty and whitespace-only input yields null", () => {
    expect(parseLimitations("")).toBeNull();
    expect(parseLimitations("   ")).toBeNull();
    expect(parseLimitations("\n\n\t")).toBeNull();
    // Only quotes: nothing survives the quote strip either.
    expect(parseLimitations('""')).toBeNull();
  });
});

describe("limitationsDisplay", () => {
  test("returns short values unchanged", () => {
    expect(limitationsDisplay("no peanuts")).toBe("no peanuts");
  });

  test("truncates past LIMITATIONS_DISPLAY_LEN with an ellipsis", () => {
    const out = limitationsDisplay("b".repeat(200));
    expect(out).toHaveLength(LIMITATIONS_DISPLAY_LEN + 1); // + the ellipsis character
    expect(out.endsWith("…")).toBe(true);
  });

  test("a value exactly at the limit is not truncated", () => {
    const exact = "c".repeat(LIMITATIONS_DISPLAY_LEN);
    expect(limitationsDisplay(exact)).toBe(exact);
  });
});
