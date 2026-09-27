import { describe, expect, it } from "bun:test";
import {
  askLines, chatCopyFor, DEFAULT_ONBOARDING_CONTENT, explainTargets, LANGS, LANGS_READY,
  LANG_LABEL, promptById, UNIT_KCAL, lintCopy, onboardingContentFor, projectGoal,
  signupCopyFor, wholeNumbers,
  type Lang, type Profile,
} from "@eait/shared";
import { blankProfile } from "../store.ts";
import { PAGE_COPY_BY_LANG, pageCopyFor } from "./copy.ts";
import { chat, plan, question, shell, type PlanView } from "./page.ts";

/**
 * A plan page takes the computed view, not a bag of strings — the fixture builds the profile the
 * boards' persona wears and runs the real arithmetic once, so nothing here retypes a number.
 */
const PERSONA: Profile = {
  user_id: "i18n", lang: "en", goal: "lose", sex: "female", birth_year: 1990,
  height_cm: 170, weight_kg: 80, weight_measured_at: null, target_weight_kg: 70,
  activity: "few", pace: "steady", units: null, struggles: [], country: "de",
  restrictions: [], medical_limitations: null, food_allergies: null,
  product_limitations: null, onboarded_at: "2026-01-01T00:00:00Z",
};

function planView(lang: Lang, hasWebApp = false): PlanView {
  const { targets, basis } = explainTargets(PERSONA);
  return {
    profile: { ...PERSONA, lang }, targets, basis,
    projection: projectGoal(PERSONA, basis),
    content: onboardingContentFor(lang), next: "/start/signup", hasWebApp, lang,
  };
}

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
      expect(copy.belowHealthyTarget, lang).toContain("{kg}");
      // The pairing hint names the tab the phone's control lives on — `{tab}` is filled with
      // SHELL_COPY's navProfile, so a translation that drops it renders "in ." for nothing.
      expect(copy.pairLead, lang).toContain("{tab}");
      // A meal card's three. Dropping `{unit}` is how `UNIT_KCAL` and a translation come apart.
      for (const ph of ["{kcal}", "{unit}", "{protein}"]) {
        expect(copy.cardMacros, `${lang}.cardMacros`).toContain(ph);
      }
      // "QUESTION 3 OF 10" was English on every question page, under an `<html lang="de">`.
      for (const ph of ["{step}", "{total}"]) {
        expect(copy.progress, `${lang}.progress`).toContain(ph);
      }
      // The consent label's two placeholders are the document names — a translation that drops one
      // renders an agreement that names half of what it means.
      for (const ph of ["{terms}", "{privacy}"]) {
        expect(signupCopyFor(lang).termsLabel, `${lang}.termsLabel`).toContain(ph);
      }
      // The sign-up screen's words live in `SIGNUP_COPY` (#110) — the same placeholder discipline
      // applies there.
      for (const [k, v] of Object.entries({ ...copy, ...signupCopyFor(lang) })) {
        for (const m of v.matchAll(/\{(\w+)\}/g)) {
          expect(
            ["provider", "kg", "protein", "floor", "kcal", "unit", "step", "total", "weeks", "terms", "privacy", "tab"],
            `${lang}.${k}`,
          ).toContain(m[1] ?? "");
        }
      }
    }
  });

  it("passes the claims gate in English, which is the language the gate can read", () => {
    // Stated rather than hidden: `claims.ts` matches English patterns, so running it over the
    // German would pass regardless and prove nothing. The seven translations are protected by
    // being translations OF this.
    expect(lintCopy({ ...pageCopyFor("en"), ...signupCopyFor("en") })).toEqual([]);
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
  it("stays off the plan page where a web application holds the language already (#51)", () => {
    const html = plan(planView("de", true));
    expect(html).not.toContain('<select name="lang"');
    expect(html).not.toContain('action="/start/language"');
    // And back on a deployment with none, the picker is the only place to change it — so it stays.
    expect(plan(planView("de"))).toContain('<select name="lang"');
  });

  it("offers exactly LANGS_READY, labelled in each language's own name", () => {
    const html = plan(planView("de"));
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
      expect(plan(planView(lang)), lang).toContain(`<option value="${lang}" selected>`);
    }
  });

  it("selects nothing for a language it cannot offer, which is the English the page is in", () => {
    // An account can hold a language `LANGS_READY` does not claim — `PATCH /v1/profile` accepts
    // every `LANGS` code, because the model answers in all of them. The page then renders English
    // (fallback at the key) and the picker must not claim otherwise. With no `selected`, a browser
    // shows the first option, which is English: the control agrees with the page.
    const unready = LANGS.find((l) => !(LANGS_READY as readonly string[]).includes(l));
    if (unready === undefined) return; // every language is ready; nothing to disagree about
    expect(plan(planView(unready))).not.toContain("selected");
  });

  it("writes the card's own sentences in the asked language, with the figures grouped", () => {
    const de = plan(planView("de"));
    const content = onboardingContentFor("de");
    const { targets } = explainTargets(PERSONA);
    // The kcal card's caption is the content's, the figure grouped for the reader.
    expect(de).toContain(`<small>${content.summary.kcalLabel}</small>`);
    expect(de).toContain(wholeNumbers("de")(targets.kcal));
    expect(de).not.toContain("kcal a day");
  });

  it("posts to the one route, which writes through the profile", () => {
    expect(plan(planView("en"))).toContain('action="/start/language"');
  });

  it("renders a question page in the asked language", () => {
    const de = question({
      prompt: promptById("birth_year")!,
      profile: blankProfile("t", "de"),
      content: DEFAULT_ONBOARDING_CONTENT,
      lines: askLines(promptById("birth_year")!, { content: DEFAULT_ONBOARDING_CONTENT, lang: "de" }, blankProfile("t", "de")),
      lang: "de",
      units: "metric",
      error: null,
      actions: [],
      action: "/start/q",
      segAction: "/start/q",
      current: [],
      draft: null,
      back: "/start",
      today: new Date("2025-01-01T00:00:00Z"),
    });
    expect(de).toContain(chatCopyFor("de").continueLabel);
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
  // The stylesheet legitimately contains the string "kcal" — `--macro-kcal` is a token name (#78)
  // — and so does the markup: the kcal icon's class is `i-kcal`. The no-"kcal" assertions therefore
  // run on TEXT only, not on tags.
  const content = (html: string) =>
    html.replace(/<style>[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/class="[^"]*"/g, "");

  it("spell the kilocalorie the same way, on one card, in every language", () => {
    // A Russian plan card read "1 500 kcal" with "Порог — 1500 ккал." two lines under it. The
    // kcal card's caption is the content's own (`kcalLabel`), so the spelling beside the figure
    // is the language's and there is nothing else on the card to disagree with it.
    for (const lang of LANGS) {
      const html = plan(planView(lang));
      const label = onboardingContentFor(lang).summary.kcalLabel;
      expect(html, lang).toContain(`<small>${label}</small>`);
      // The caption carries the unit's own spelling — "kcal" or "ккал", never the other's.
      expect(label, lang).toContain(UNIT_KCAL[lang]);
    }
    const ru = content(plan(planView("ru")));
    expect(ru).toContain("ккал в день");
    expect(ru).not.toMatch(/>\s*kcal|kcal\s*</);
    expect(ru).not.toContain(" kcal ");
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
    const ru = content(chat({ lines: [{ kind: "card", card }], notice: null, proposal: null, lang: "ru" }));
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
