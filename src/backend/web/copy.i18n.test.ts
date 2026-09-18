import { describe, expect, it } from "bun:test";
import { LANGS, LANGS_READY, LANG_LABEL, lintCopy } from "@eait/shared";
import { PAGE_COPY_BY_LANG, pageCopyFor } from "./copy.ts";
import { plan, question, shell } from "./page.ts";

describe("what /start says for itself, in eight languages", () => {
  it("has every key in every language — the type says so, this says it out loud", () => {
    const keys = Object.keys(pageCopyFor("en")).sort();
    for (const lang of LANGS) {
      expect(Object.keys(pageCopyFor(lang)).sort(), lang).toEqual(keys);
      for (const [k, v] of Object.entries(pageCopyFor(lang))) {
        expect(v.trim(), `${lang}.${k}`).not.toBe("");
      }
    }
  });

  it("keeps the two placeholders code fills, and introduces none", () => {
    for (const lang of LANGS) {
      const copy = pageCopyFor(lang);
      expect(copy.planAppBody, lang).toContain("{provider}");
      expect(copy.belowHealthyTarget, lang).toContain("{kg}");
      for (const [k, v] of Object.entries(copy)) {
        for (const m of v.matchAll(/\{(\w+)\}/g)) {
          expect(["provider", "kg"], `${lang}.${k}`).toContain(m[1] ?? "");
        }
      }
    }
  });

  it("passes the claims gate in English, which is the language the gate can read", () => {
    // Stated rather than hidden: `claims.ts` matches English patterns, so running it over the
    // German would pass regardless and prove nothing. The seven translations are protected by
    // being translations OF this.
    expect(lintCopy({ ...pageCopyFor("en") })).toEqual([]);
  });

  it("declares its language to the browser, because a screen reader picks a voice from it", () => {
    for (const lang of LANGS) {
      expect(shell("t", "<p>b</p>", lang), lang).toContain(`<html lang="${lang}">`);
    }
    // And the default is still English rather than undefined, for the two callers with no language.
    expect(shell("t", "<p>b</p>")).toContain('<html lang="en">');
  });
});

describe("the language picker on the plan page", () => {
  const view = {
    signedInWith: "apple" as const, kcal: 1800, proteinG: 120,
    floorApplied: false, floorKcal: 1500, checkoutUrl: null, hasWebApp: true, telegram: false,
  };

  it("offers exactly LANGS_READY, labelled in each language's own name", () => {
    const html = plan({ ...view, lang: "de" });
    for (const code of LANGS_READY) {
      expect(html).toContain(`<option value="${code}"`);
      expect(html).toContain(LANG_LABEL[code]);
    }
    // Never a language the app cannot render end to end: choosing one looks like a bug.
    const offered = [...html.matchAll(/<option value="(\w+)"/g)].map((m) => m[1]);
    expect(offered.sort()).toEqual([...LANGS_READY].sort());
  });

  it("pre-selects the language being read, so the control is not lying", () => {
    for (const lang of LANGS_READY) {
      expect(plan({ ...view, lang }), lang).toContain(`<option value="${lang}" selected>`);
    }
  });

  it("selects nothing for a language it cannot offer, which is the English the page is in", () => {
    // An account can hold a language `LANGS_READY` does not claim — `PATCH /v1/profile` accepts
    // every `LANGS` code, because the model answers in all of them. The page then renders English
    // (fallback at the key) and the picker must not claim otherwise. With no `selected`, a browser
    // shows the first option, which is English: the control agrees with the page.
    const unready = LANGS.find((l) => !(LANGS_READY as readonly string[]).includes(l));
    if (unready === undefined) return; // every language is ready; nothing to disagree about
    expect(plan({ ...view, lang: unready })).not.toContain("selected");
  });

  it("posts to the one route, which writes through the profile", () => {
    expect(plan({ ...view, lang: "en" })).toContain('action="/start/language"');
  });

  it("renders a question page in the asked language", () => {
    const de = question({
      promptId: "goal", kind: "number", lines: ["Wie groß bist du?"], options: [],
      placeholder: null, error: null, actions: [], step: 1, total: 10, lang: "de",
    });
    expect(de).toContain(pageCopyFor("de").continueLabel);
    expect(de).not.toContain(">Continue<");
  });
});

describe("the table itself", () => {
  it("names all eight and nothing else", () => {
    expect(Object.keys(PAGE_COPY_BY_LANG).sort()).toEqual([...LANGS].sort());
  });
});

describe("the front door's two buttons", () => {
  it("translate the verb and keep the brand, in every language", () => {
    // "Weiter mit Apple", never "Weiter mit Apfel". Same rule as `LANG_LABEL` and the product's
    // own name: a brand is the same string wherever it is read.
    for (const lang of LANGS) {
      const said = pageCopyFor(lang).continueWith;
      expect(said, lang).toContain("{provider}");
      expect(said.replace("{provider}", "Apple"), lang).toContain("Apple");
    }
    expect(pageCopyFor("de").continueWith.replace("{provider}", "Apple")).toBe("Weiter mit Apple");
  });
});
