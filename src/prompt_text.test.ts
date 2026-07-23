import { describe, expect, test } from "bun:test";
import { normalizePromptText, truncateCodePoints } from "./prompt_text.ts";

const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

describe("normalizePromptText", () => {
  test("collapses whitespace runs and trims", () => {
    expect(normalizePromptText("  a   b\tc  ")).toBe("a b c");
  });

  test("no newline-class character can survive (the line-breakout guard)", () => {
    // \n \r \v \f are C0; U+0085 NEL is C1; U+2028/U+2029 are \\s. All must reduce to a space.
    for (const ch of ["\n", "\r", "\v", "\f", "", " ", " "]) {
      const out = normalizePromptText(`a${ch}b`);
      expect(out).toBe("a b");
      expect(out).not.toMatch(/[\n\r]/);
    }
  });

  test("strips C0 and C1 control chars, including both range edges", () => {
    for (const cp of [0x00, 0x01, 0x1f, 0x7f, 0x80, 0x9b, 0x9f]) {
      expect(normalizePromptText(`a${String.fromCodePoint(cp)}b`)).toBe("a b");
    }
  });

  test("strips every bidi control, mark, and isolate — including the U+2066–U+2069 range untested before", () => {
    const dangerous = [
      0x200b, // ZWSP
      0x200e, 0x200f, // LTR/RTL marks
      0x202a, 0x202b, 0x202c, 0x202d, 0x202e, // bidi embed/override (U+202E reverses the card)
      0x2060, 0x2061, 0x2062, 0x2063, 0x2064, // word joiner + invisible operators (range edges 2060/2064)
      0x2066, 0x2067, 0x2068, 0x2069, // bidi isolates LRI/RLI/FSI/PDI (range edges 2066/2069)
      0xfeff, // BOM
    ];
    for (const cp of dangerous) {
      expect(normalizePromptText(`x${String.fromCodePoint(cp)}y`)).toBe("xy");
    }
  });

  test("PRESERVES ZWJ and ZWNJ — meaningful joiners, not padding", () => {
    // ZWJ builds emoji sequences; removing it splits a family into three separate glyphs.
    expect(normalizePromptText("\u{1F468}‍\u{1F469}‍\u{1F467}")).toBe(
      "\u{1F468}‍\u{1F469}‍\u{1F467}",
    );
    // ZWNJ is orthographic in Persian/Arabic; dropping it alters the word form.
    expect(normalizePromptText("a‌b")).toBe("a‌b");
  });

  test("strips lone surrogates, keeps valid astral pairs", () => {
    expect(LONE_SURROGATE.test(normalizePromptText("a\uD800b"))).toBe(false);
    expect(LONE_SURROGATE.test(normalizePromptText("a\uDC00b"))).toBe(false);
    expect(normalizePromptText("a\u{1F600}b")).toBe("a\u{1F600}b");
  });

  test("drops double quotes so the quoted prompt span cannot close early", () => {
    expect(normalizePromptText('no "junk" food')).toBe("no junk food");
  });

  test("returns empty when nothing survives", () => {
    expect(normalizePromptText("")).toBe("");
    expect(normalizePromptText("   ")).toBe("");
    expect(normalizePromptText("​﻿")).toBe("");
    expect(normalizePromptText('""')).toBe("");
  });

  test("is idempotent — the display sinks rely on re-applying it being a no-op", () => {
    const once = normalizePromptText('  no  "junk" ‮evil\n\nmore  ');
    expect(normalizePromptText(once)).toBe(once);
  });
});

describe("truncateCodePoints", () => {
  test("passes through when at or under max", () => {
    expect(truncateCodePoints("abc", 3)).toBe("abc");
    expect(truncateCodePoints("abc", 5)).toBe("abc");
  });

  test("counts code points, not UTF-16 units", () => {
    // Three astral emoji = six UTF-16 units, three code points; a .slice(2) would cut mid-pair.
    const out = truncateCodePoints("\u{1F600}\u{1F601}\u{1F602}", 2);
    expect([...out].length).toBe(2);
    expect(LONE_SURROGATE.test(out)).toBe(false);
  });

  test("empty input and a zero cap", () => {
    expect(truncateCodePoints("", 5)).toBe("");
    expect(truncateCodePoints("abc", 0)).toBe("");
  });
});
