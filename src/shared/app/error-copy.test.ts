// The error surfaces' words (ieat-app#978): the boot failure and the render boundary. Completeness
// in all eight languages is `localizedGaps`' job in `copy.i18n.test.ts`; this file holds the
// table's own contract: the keys exist, and the claims gate reads every string it ships.

import { describe, expect, it } from "bun:test";
import { LANGS, type Lang } from "../types.ts";
import { lintCopy } from "../claims.ts";
import { ERROR_COPY, errorCopyFor, type ErrorCopy } from "./error-copy.ts";

const walk = (node: unknown, at: string, into: Record<string, string>): Record<string, string> => {
  if (typeof node === "string") { into[at] = node; return into; }
  if (typeof node !== "object" || node === null) return into;
  for (const [k, v] of Object.entries(node)) walk(v, at === "" ? k : `${at}.${k}`, into);
  return into;
};
const fields = (copy: ErrorCopy) => walk(copy, "", {});

describe("ERROR_COPY", () => {
  it("has every key in every language", () => {
    for (const lang of LANGS) {
      const copy = ERROR_COPY[lang];
      expect(copy, lang).toBeDefined();
      for (const [k, v] of Object.entries(fields(copy!))) {
        expect(v.length, `${lang}.${k}`).toBeGreaterThan(0);
      }
    }
  });

  it("carries no claim the gate would refuse, in any of the eight", () => {
    for (const lang of LANGS) {
      const named: Record<string, string> = {};
      for (const [k, v] of Object.entries(fields(ERROR_COPY[lang]!))) named[`ERROR_COPY.${k}`] = v;
      expect(lintCopy(named).map((v) => `${v.field}: ${v.pattern} "${v.span}"`), lang).toEqual([]);
    }
  });

  it("does not promise data survived that may not have (#708: the outbox is local)", () => {
    // The en words, pinned — a re-added "saved on the server" claim fails here by name.
    const en = errorCopyFor("en" as Lang);
    expect(en.crashNote).toBe("That screen hit an error and stopped.");
    expect(en.crashStuckNote).toBe("We couldn't get that screen to load.");
    expect(en.bootRefusedNote).toBe("Try again later.");
  });
});
