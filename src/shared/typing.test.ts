import { describe, expect, test } from "bun:test";
import { TYPE_MS_PER_CHAR, typedPrefix, typingMs } from "./typing.ts";

describe("typingMs", () => {
  test("one beat per character", () => {
    expect(typingMs("hello")).toBe(5 * TYPE_MS_PER_CHAR);
    expect(typingMs("")).toBe(0);
  });
  test("a long line is not cut short — the pace is the point", () => {
    expect(typingMs("x".repeat(300))).toBe(300 * TYPE_MS_PER_CHAR);
  });
});

describe("typedPrefix", () => {
  test("nothing before the first beat, everything after the last", () => {
    expect(typedPrefix("hello", 0)).toBe("");
    expect(typedPrefix("hello", TYPE_MS_PER_CHAR - 1)).toBe("");
    expect(typedPrefix("hello", 5 * TYPE_MS_PER_CHAR)).toBe("hello");
    expect(typedPrefix("hello", 10_000)).toBe("hello");
  });
  test("advances one character per beat", () => {
    expect(typedPrefix("hello", TYPE_MS_PER_CHAR)).toBe("h");
    expect(typedPrefix("hello", 3 * TYPE_MS_PER_CHAR + 2)).toBe("hel");
  });
  test("a negative clock is the start", () => {
    expect(typedPrefix("hello", -50)).toBe("");
  });
  test("counts code points, not UTF-16 units, so an emoji never shows half-drawn", () => {
    expect(typedPrefix("a\u{1F4F7}b", TYPE_MS_PER_CHAR)).toBe("a");
    expect(typedPrefix("a\u{1F4F7}b", 2 * TYPE_MS_PER_CHAR)).toBe("a\u{1F4F7}");
    expect(typingMs("a\u{1F4F7}b")).toBe(3 * TYPE_MS_PER_CHAR);
  });
});
