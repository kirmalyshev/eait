// One line, one event. The client and the route both speak NDJSON, and the splitter and what the
// last line means are the pieces of the client's stream path that can be tested without a phone.

import { OUTCOME_UNKNOWN, REFUSAL_STATUS, type ErrorResponse, type PhotoLast } from "./contract.ts";
import { isRefusal, type MealLogged } from "./results.ts";

/** Split `carry + chunk` into complete lines; the unterminated tail comes back as `carry`. */
export function splitLines(carry: string, chunk: string): { lines: string[]; carry: string } {
  const parts = (carry + chunk).split("\n");
  const tail = parts.pop() ?? "";
  return { lines: parts.map((l) => l.replace(/\r$/, "")).filter((l) => l !== ""), carry: tail };
}

/**
 * What a finished photo stream MEANS, for a client that throws everything but a meal (#514).
 *
 * `null` is a stream that closed without its last line: the server died mid-turn, the charge
 * stood, and the meal may or may not have landed. That is the unknown `OUTCOME_UNKNOWN` names, so
 * it is worded the same way. A refusal is the status and body the JSON path would have sent.
 */
export function photoEnd(last: PhotoLast | null): { meal: MealLogged } | { status: number; body: ErrorResponse } {
  if (last === null || last.kind === OUTCOME_UNKNOWN) return { status: 500, body: { error: OUTCOME_UNKNOWN } };
  if (isRefusal(last)) {
    return { status: REFUSAL_STATUS[last.kind], body: { error: last.kind, ...("scope" in last ? { scope: last.scope } : {}) } };
  }
  return { meal: last };
}
