import { describe, expect, test } from "bun:test";
import { OUTCOME_UNKNOWN } from "./contract.ts";
import type { MealLogged } from "./results.ts";
import { photoEnd, splitLines } from "./stream.ts";

// The phone throws everything but a meal, and what it throws picks the words. #514 was a server
// failure mid-turn arriving as `analysis-failed`, which the camera words "Nothing was logged. Try
// again in a moment." about a meal that can already be in the diary.
describe("photoEnd", () => {
  const UNKNOWN = { status: 500, body: { error: OUTCOME_UNKNOWN } };

  test("the server failing mid-turn is an unknown outcome, not a failed analysis", () => {
    expect(photoEnd({ kind: OUTCOME_UNKNOWN })).toEqual(UNKNOWN);
  });

  test("so is a stream that closed without its last line", () => {
    expect(photoEnd(null)).toEqual(UNKNOWN);
  });

  test("a refusal is the status and body the JSON path sends, scope included", () => {
    expect(photoEnd({ kind: "analysis-failed" })).toEqual({ status: 502, body: { error: "analysis-failed" } });
    expect(photoEnd({ kind: "cap-exceeded", scope: "user" }))
      .toEqual({ status: 429, body: { error: "cap-exceeded", scope: "user" } });
  });

  test("a meal is the meal", () => {
    const meal = { kind: "logged" } as MealLogged;
    expect(photoEnd(meal)).toEqual({ meal });
  });
});

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
