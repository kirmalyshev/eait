// One line, one event. Both billed routes speak NDJSON (#508), and the splitter, the last line and
// what it means are the pieces of the client's stream path that can be tested without a phone.

import { OUTCOME_UNKNOWN, REFUSAL_STATUS, type ErrorResponse } from "./contract.ts";
import { isRefusal, type Refusal } from "./results.ts";

/** Split `carry + chunk` into complete lines; the unterminated tail comes back as `carry`. */
export function splitLines(carry: string, chunk: string): { lines: string[]; carry: string } {
  const parts = (carry + chunk).split("\n");
  const tail = parts.pop() ?? "";
  return { lines: parts.map((l) => l.replace(/\r$/, "")).filter((l) => l !== ""), carry: tail };
}

/**
 * The answer a FINISHED stream carries: its last line, parsed (#508). Blank keepalives and any event
 * lines before it are not the answer. Null when the stream closed without one; `streamEnd` says
 * what that means.
 */
export function lastLine<T = unknown>(text: string): T | null {
  const { lines, carry } = splitLines("", text);
  const last = carry.trim() !== "" ? carry : lines.at(-1);
  return last === undefined ? null : JSON.parse(last) as T;
}

/**
 * What a finished stream's last line MEANS, for a client that throws everything but an answer.
 *
 * `null` is a stream that closed without its last line: the server died mid-turn and the charge
 * stood, which is the unknown `OUTCOME_UNKNOWN` names (#514), so it is worded the same way. A
 * refusal is the status and body the JSON path would have sent. Anything else is the answer. ONE
 * rule for both streamed routes, the photo and the text turn (#508).
 */
export function streamEnd<T extends { kind: string }>(
  last: T | Refusal | { kind: typeof OUTCOME_UNKNOWN } | null,
): { answer: T } | { status: number; body: ErrorResponse } {
  if (last === null || last.kind === OUTCOME_UNKNOWN) return { status: 500, body: { error: OUTCOME_UNKNOWN } };
  if (isRefusal(last)) {
    return { status: REFUSAL_STATUS[last.kind], body: { error: last.kind, ...("scope" in last ? { scope: last.scope } : {}) } };
  }
  return { answer: last as T };
}
