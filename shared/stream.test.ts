import { describe, expect, test } from "bun:test";
import { splitLines } from "./stream.ts";

describe("splitLines", () => {
  test("returns complete lines and carries the unterminated tail", () => {
    const a = splitLines("", '{"a":1}\n{"b":');
    expect(a.lines).toEqual(['{"a":1}']);
    expect(a.carry).toBe('{"b":');
    const b = splitLines(a.carry, "2}\n");
    expect(b.lines).toEqual(['{"b":2}']);
    expect(b.carry).toBe("");
  });

  test("drops blank lines and tolerates CRLF", () => {
    expect(splitLines("", "x\r\n\r\ny\n").lines).toEqual(["x", "y"]);
  });
});
