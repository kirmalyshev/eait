// The claims gate over the sentences the browser client writes for itself, and the check that it
// writes them in every language.
//
// Under `server/` because this directory is the half of the workspace with bun's types; the file
// under test is browser code and imports nothing from bun. Same rule as `backend/web/copy.ts` and
// its `PAGE_COPY`: what is gated is OUR sentences, not the rendered page.

import { describe, expect, it } from "bun:test";
import { LANGS, lintCopy } from "@eait/shared";
import { COPY, WEB_COPY, webCopyFor } from "../copy.ts";

/** Every string in the table, keyed well enough to name. `lintCopy` takes a flat record. */
function flat(node: unknown, at = "", out: Record<string, string> = {}): Record<string, string> {
  if (typeof node === "string") { out[at] = node; return out; }
  if (typeof node === "object" && node !== null) {
    for (const [k, v] of Object.entries(node)) flat(v, at === "" ? k : `${at}.${k}`, out);
  }
  return out;
}

describe("the copy the web client writes", () => {
  it("passes the claims gate", () => {
    // ENGLISH ONLY, and stated: `claims.ts` matches English patterns, so running it over the
    // German would pass regardless. The seven translations are protected by being translations OF
    // copy that passed here.
    expect(lintCopy(flat(COPY))).toEqual([]);
  });

  it("says every sentence in every language, with nothing left to fill", () => {
    const keys = Object.keys(flat(webCopyFor("en"))).sort();
    for (const lang of LANGS) {
      const said = flat(webCopyFor(lang));
      expect(Object.keys(said).sort(), lang).toEqual(keys);
      for (const [at, text] of Object.entries(said)) {
        expect(text.trim(), `${lang}.${at}`).not.toBe("");
        for (const m of text.matchAll(/\{(\w+)\}/g)) {
          expect(["target", "protein", "proteinTarget", "eaten", "kg", "when", "floor", "n"], `${lang}.${at}`)
            .toContain(m[1] ?? "");
        }
      }
    }
  });

  it("keeps the placeholders the diary head fills", () => {
    for (const lang of LANGS) {
      const copy = webCopyFor(lang);
      expect(copy.targetLine, lang).toContain("{target}");
      expect(copy.eatenLine, lang).toContain("{eaten}");
      expect(copy.weightLine, lang).toContain("{kg}");
      expect(copy.weightLineWhen, lang).toContain("{when}");
    }
  });

  it("names all eight and nothing else", () => {
    expect(Object.keys(WEB_COPY).sort()).toEqual([...LANGS].sort());
  });
});
