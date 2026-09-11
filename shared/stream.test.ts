import { describe, expect, test } from "bun:test";
import { OUTCOME_UNKNOWN, type PhotoEvent } from "./contract.ts";
import type { MealLogged } from "./results.ts";
import { advancePending, lastLine, pendingLine, splitLines, streamEnd, type PendingPhoto } from "./stream.ts";
import type { MealItem } from "./types.ts";

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

// #607. The pending photo screen has ONE bubble, and it moves on only when the stream does: our
// words when the request goes, the glance when it lands, the portions once the analyzer closes a
// row. It never steps back — a glance that lands after a row is late, not news.
describe("the pending photo turn", () => {
  const start: PendingPhoto = { glance: null, items: [] };
  const rice: MealItem = { name: "Rice", grams: 150 };
  const egg: MealItem = { name: "Egg", grams: 50 };
  const run = (...events: PhotoEvent[]) => events.reduce(advancePending, start);

  test("before anything arrives, Spud is reading the plate", () => {
    expect(pendingLine(start)).toBe("Reading the plate…");
  });

  test("the glance replaces it", () => {
    expect(pendingLine(run({ kind: "glance", text: "Looks like rice." }))).toBe("Looks like rice.");
  });

  test("the first row moves it on to the portions", () => {
    const p = run({ kind: "glance", text: "Looks like rice." }, { kind: "item", index: 0, item: rice });
    expect(pendingLine(p)).toBe("Weighing portions…");
    expect(p.items).toEqual([rice]);
  });

  test("a glance that lands after a row does not step back", () => {
    const p = run({ kind: "item", index: 0, item: rice }, { kind: "glance", text: "Looks like rice." });
    expect(pendingLine(p)).toBe("Weighing portions…");
  });

  test("a schema retry resets the rows and stays on the portions", () => {
    const p = run(
      { kind: "item", index: 0, item: rice },
      { kind: "item", index: 1, item: egg },
      { kind: "item", index: 0, item: egg },
    );
    expect(p.items).toEqual([egg]);
    expect(pendingLine(p)).toBe("Weighing portions…");
  });
});
