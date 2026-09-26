import { describe, expect, it } from "bun:test";
import { LANGS, LANGS_READY, LANG_LABEL, UNIT_KCAL, lintCopy, wholeNumbers } from "@eait/shared";
import { PAGE_COPY_BY_LANG, pageCopyFor } from "./copy.ts";
import { chat, plan, question, shell } from "./page.ts";

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

  it("keeps every placeholder code fills, and introduces none", () => {
    for (const lang of LANGS) {
      const copy = pageCopyFor(lang);
      expect(copy.planAppBody, lang).toContain("{provider}");
      expect(copy.belowHealthyTarget, lang).toContain("{kg}");
      // The plan's one placeholder. A translation that drops it renders a sentence with its
      // number missing, and nothing anywhere would say so.
      expect(copy.planWeeks, lang).toContain("{weeks}");
      expect(copy.planFloorNumber, lang).toContain("{floor}");
      // A meal card's three. Dropping `{unit}` is how `UNIT_KCAL` and a translation come apart.
      for (const ph of ["{kcal}", "{unit}", "{protein}"]) {
        expect(copy.cardMacros, `${lang}.cardMacros`).toContain(ph);
      }
      // "QUESTION 3 OF 10" was English on every question page, under an `<html lang="de">`.
      for (const ph of ["{step}", "{total}"]) {
        expect(copy.progress, `${lang}.progress`).toContain(ph);
      }
      for (const [k, v] of Object.entries(copy)) {
        for (const m of v.matchAll(/\{(\w+)\}/g)) {
          expect(["provider", "kg", "protein", "floor", "kcal", "unit", "step", "total", "weeks"], `${lang}.${k}`)
          .toContain(m[1] ?? "");
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
  });
});

describe("the language picker on the plan page", () => {
  // No web application here: with one, the picker is not drawn — the language lives in the app's
  // own settings — so every picker assertion is against a deployment that has none.
  const view = {
    signedInWith: "apple" as const, beat: null, targetKg: null, byWhen: null, weeks: null,
    kcal: 1800, proteinG: 120,
    labels: { rest: "At rest", activity: "The days", pace: "The pace", floor: "The floor", protein: "Protein" },
    bmr: 1400, tdee: 1900, paceKcal: -300,
    floorApplied: false, floorKcal: 1500, checkout: false, hasWebApp: false, telegram: false,
  };

  it("stays off the plan page where a web application holds the language already (#51)", () => {
    const html = plan({ ...view, lang: "de", hasWebApp: true });
    expect(html).not.toContain('<select name="lang"');
    expect(html).not.toContain('action="/start/language"');
    // And back on a deployment with none, the picker is the only place to change it — so it stays.
    expect(plan({ ...view, lang: "de" })).toContain('<select name="lang"');
  });

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

  it("writes the card's own sentences in the asked language, with the figures grouped", () => {
    const de = plan({ ...view, lang: "de", floorApplied: true });
    expect(de).toContain(pageCopyFor("de").planEachDay);
    expect(de).toContain(pageCopyFor("de").planFloorNumber.replace("{floor}", "1.500"));
    expect(de).toContain("1.800 kcal");
    expect(de).not.toContain("Each day");
    expect(de).not.toContain("The floor is");
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

describe("the plan card's two figures", () => {
  const view = {
    signedInWith: "apple" as const, beat: null, targetKg: null, byWhen: null, weeks: null,
    kcal: 1500, proteinG: 120,
    labels: { rest: "At rest", activity: "The days", pace: "The pace", floor: "The floor", protein: "Protein" },
    bmr: 1400, tdee: 1900, paceKcal: -300,
    floorApplied: true, floorKcal: 1500, checkout: false, hasWebApp: false, telegram: false,
  };

  it("spell the kilocalorie the same way, on one card, in every language", () => {
    // A Russian plan card read "1 500 kcal" with "Порог — 1500 ккал." two lines under it. The
    // sentences carry the word in their own template; the headline concatenates it, and the two
    // disagreed. `UNIT_KCAL` is the one spelling, and this is the card where it showed.
    for (const lang of LANGS) {
      const html = plan({ ...view, lang });
      expect(html, lang).toContain(`${UNIT_KCAL[lang]}</p>`);
      // The floor sentence is prose and already carried it; assert they agree rather than assert
      // either one's contents, so this keeps holding when a translation is reworded.
      expect(pageCopyFor(lang).planFloorNumber, lang).toContain(UNIT_KCAL[lang]);
    }
    expect(plan({ ...view, lang: "ru" })).toContain("ккал</p>");
    expect(plan({ ...view, lang: "ru" })).not.toContain("kcal");
  });

  it("writes a MEAL CARD's figures in the reader's language too, not only the plan's", () => {
    // `plan()` was localized and these two were not, in the same file: the proposal card and every
    // card in the thread interpolated `${kcal} kcal · ${proteinG} g protein` raw. A Russian reader
    // got `1450 kcal · 30 g protein` underneath a plan page reading `Порог — 1 500 ккал.` — the
    // wrong unit and the wrong grouping, on the surface where the number is the whole point.
    const card = { title: "Овсянка", kcal: 1450, proteinG: 30, verdicts: [] };
    for (const lang of LANGS) {
      const html = chat({ lines: [{ kind: "card", card }], notice: null, proposal: null, lang });
      expect(html, lang).toContain(UNIT_KCAL[lang]);
    }
    const ru = chat({ lines: [{ kind: "card", card }], notice: null, proposal: null, lang: "ru" });
    expect(ru).toContain("ккал");
    expect(ru).not.toContain("kcal");
    expect(ru).toContain("белка");
    // Grouped the way every other figure on this page is — never the raw 1450.
    expect(ru).toContain(wholeNumbers("ru")(1450));
    expect(ru).not.toMatch(/>1450 /);
  });
});

// #49, principal 2026-09-26: Spud only — /start's own words name nobody else either.
it("/start never mentions Gabie, in any language", () => {
  for (const lang of LANGS) {
    for (const [key, text] of Object.entries(pageCopyFor(lang))) {
      if (typeof text === "string") expect(text, `${lang}.${key}`).not.toMatch(/gabie/i);
    }
  }
});
