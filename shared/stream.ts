// One line, one event. The client and the route both speak NDJSON, and the splitter is the one
// piece of the client's stream path that can be tested without a phone.

/** Split `carry + chunk` into complete lines; the unterminated tail comes back as `carry`. */
export function splitLines(carry: string, chunk: string): { lines: string[]; carry: string } {
  const parts = (carry + chunk).split("\n");
  const tail = parts.pop() ?? "";
  return { lines: parts.map((l) => l.replace(/\r$/, "")).filter((l) => l !== ""), carry: tail };
}
