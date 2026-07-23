import { describe, expect, test } from "bun:test";
import {
  LIMITATIONS_DISPLAY_LEN,
  LIMITATIONS_MAX_LEN,
  limitationsDisplay,
  parseLimitations,
} from "./limitations.ts";

/** A high surrogate not followed by a low one, or a low one not preceded by a high one. */
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

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

  // A lone surrogate is not UTF-8 encodable: Postgres mangles it to U+FFFD and the Telegram Bot
  // API rejects the whole message, which would take /settings and /me offline for that user.
  test("truncation never splits an astral character in half", () => {
    const out = parseLimitations("x".repeat(299) + "🥜")!;
    expect(LONE_SURROGATE.test(out)).toBe(false);
    expect([...out].length).toBeLessThanOrEqual(LIMITATIONS_MAX_LEN);
    // Round-trips through UTF-8 unchanged — the property that actually matters downstream.
    expect(new TextDecoder().decode(new TextEncoder().encode(out))).toBe(out);
  });

  test("an all-emoji value caps by code point, not by UTF-16 unit", () => {
    const out = parseLimitations("🥜".repeat(400))!;
    expect(LONE_SURROGATE.test(out)).toBe(false);
    expect([...out].length).toBe(LIMITATIONS_MAX_LEN);
  });

  test("zero-width characters do not make an invisible non-empty value", () => {
    // Without the invisible-character pass this returns "​": truthy, so the /settings root
    // renders "Limitations: " with nothing after it instead of "none", and /me shows a blank row
    // the user cannot see in order to clear it.
    expect(parseLimitations("\u200b")).toBeNull();
    expect(parseLimitations("\u200b\u2060\ufeff")).toBeNull();
    expect(parseLimitations("no\u200bpeanuts")).toBe("nopeanuts");
  });

  test("bidi overrides are stripped — a stored value cannot reverse the rest of the card", () => {
    // Telegram honours U+202E, so this would render the remainder of /settings and /me backwards.
    expect(parseLimitations("\u202eevil")).toBe("evil");
    expect(parseLimitations("no \u202a\u202b\u202c peanuts")).toBe("no peanuts");
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

  test("truncation never splits an astral character in half", () => {
    // 59 ASCII + an emoji straddling the 60th slot: a UTF-16 .slice() cuts the pair.
    const out = limitationsDisplay("y".repeat(59) + "🥜🥛");
    expect(LONE_SURROGATE.test(out)).toBe(false);
    expect(new TextDecoder().decode(new TextEncoder().encode(out))).toBe(out);
    expect(limitationsDisplay("🥜".repeat(100))).not.toMatch(LONE_SURROGATE);
  });

  test("a value exactly at the limit is not truncated", () => {
    const exact = "c".repeat(LIMITATIONS_DISPLAY_LEN);
    expect(limitationsDisplay(exact)).toBe(exact);
  });
});
