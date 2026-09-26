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
          expect(["target", "protein", "proteinTarget", "eaten", "kg", "when", "floor", "n", "text"], `${lang}.${at}`)
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

// #47: the two rules the retired register (#35) left behind, pinned so they cannot drift back.
describe("one number per thing, and the floor as a status line", () => {
  it("never prints a number with its error, a band, or a low/high pair", () => {
    for (const lang of LANGS) {
      for (const [at, text] of Object.entries(flat(webCopyFor(lang)))) {
        expect(text, `${lang}.${at}`).not.toMatch(/±|\{(low|high|min|max)\}|\}\s*[–-]\s*\{/);
      }
    }
  });

  it("says the floor as one line with one number in it, in two states and nothing between", () => {
    for (const lang of LANGS) {
      const c = webCopyFor(lang);
      for (const line of [c.floorClear, c.floorHeld]) {
        expect(line.match(/\{\w+\}/g), `${lang}: ${line}`).toEqual(["{floor}"]);
      }
      expect(c.floorClear).not.toBe(c.floorHeld);
    }
  });
});

// #44/#46 (monorepo #818): the sample is a SETTING — one meal by default, and whatever an admin
// gives one account — so the sentence that says it is spent may not count it. And the web has its
// own checkout now, so the browser's refusal may not send people to the phone to pay.
describe("the spent-sample refusal", () => {
  it("counts nothing, in English", () => {
    expect(webCopyFor("en").refusals["subscription-required"]).not.toMatch(/\banalyses\b/i);
  });
  it("points at the free week here, not at the app", () => {
    expect(webCopyFor("en").refusals["subscription-required"]).not.toMatch(/\bapp\b/i);
    for (const lang of LANGS) expect(webCopyFor(lang).refusals["subscription-required"]).not.toMatch(/eait-App|app eait|appli eait|app de eait|ứng dụng eait|aplikasi eait|приложении eait/i);
  });
});
