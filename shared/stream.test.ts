import { describe, expect, test } from "bun:test";
import { OUTCOME_UNKNOWN } from "./contract.ts";
import type { MealLogged } from "./results.ts";
import { lastLine, splitLines, streamEnd } from "./stream.ts";

// The phone throws everything but an answer, and what it throws picks the words. #514 was a server
// failure mid-turn arriving as `analysis-failed`, which the camera words "Nothing was logged. Try
// again in a moment." about a meal that can already be in the diary.
describe("streamEnd", () => {
  const UNKNOWN = { status: 500, body: { error: OUTCOME_UNKNOWN } };

  test("the server failing mid-turn is an unknown outcome, not a failed analysis", () => {
    expect(streamEnd({ kind: OUTCOME_UNKNOWN })).toEqual(UNKNOWN);
  });

  test("so is a stream that closed without its last line", () => {
    expect(streamEnd(null)).toEqual(UNKNOWN);
  });

  test("a refusal is the status and body the JSON path sends, scope included", () => {
    expect(streamEnd({ kind: "analysis-failed" })).toEqual({ status: 502, body: { error: "analysis-failed" } });
    expect(streamEnd({ kind: "cap-exceeded", scope: "user" }))
      .toEqual({ status: 429, body: { error: "cap-exceeded", scope: "user" } });
  });

  test("a meal is the answer", () => {
    const meal = { kind: "logged" } as MealLogged;
    expect(streamEnd(meal)).toEqual({ answer: meal });
  });

  // The text turn's designed outcome that is not a refusal: the JSON path's 409, in band (#508).
  test("so is a text turn's target-gone, which the screen words rather than throws", () => {
    expect(streamEnd({ kind: "target-gone", on: "correction" })).toEqual({ answer: { kind: "target-gone", on: "correction" } });
  });
});

describe("lastLine", () => {
  test("is the answer a finished stream carries: its last line, past keepalives and events", () => {
    expect(lastLine<{ kind: string }>('\n\n{"kind":"glance"}\n\n{"kind":"answered"}\n')).toEqual({ kind: "answered" });
  });

  test("reads a last line the server did not terminate", () => {
    expect(lastLine<{ kind: string }>('\n{"kind":"answered"}')).toEqual({ kind: "answered" });
  });

  test("is null for a stream that closed with no answer at all", () => {
    expect(lastLine("\n\n\n")).toBeNull();
    expect(lastLine("")).toBeNull();
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
