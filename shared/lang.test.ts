import { describe, expect, it } from "bun:test";
import { LANGS } from "./types.ts";
import { LANGS_READY, LANG_LABEL, t, type Localized } from "./lang.ts";

// The localization spine (#474, slice 1 of #358). Nothing user-visible ships with it: what is
// pinned here is the fallback rule, because getting it wrong is a crash rather than a wart.

describe("t", () => {
  const GREETING: Localized<string> = { en: "Good evening", de: "Guten Abend" };

  it("answers in the asked language when there is one", () => {
    expect(t("de")(GREETING)).toBe("Guten Abend");
    expect(t("en")(GREETING)).toBe("Good evening");
  });

  it("FALLS BACK AT THE KEY, never at the screen", () => {
    // One untranslated button is a wart. A screen that throws is a process abort in a Release
    // build — `AGENTS.md` and #358 both say so — so a missing entry is English, never undefined.
    expect(t("ru")(GREETING)).toBe("Good evening");
    for (const lang of LANGS) expect(typeof t(lang)(GREETING)).toBe("string");
  });

  it("carries anything, not only strings — the tables are typed constants, not a string catalogue", () => {
    const OPTIONS: Localized<readonly string[]> = { en: ["Lose weight", "Maintain"], ru: ["Похудеть", "Поддерживать"] };
    expect(t("ru")(OPTIONS)).toEqual(["Похудеть", "Поддерживать"]);
    expect(t("de")(OPTIONS)).toEqual(["Lose weight", "Maintain"]);
  });

  it("is bound once and used many times, so a screen reads its language once", () => {
    const say = t("de");
    expect([GREETING, { en: "Chat" } as Localized<string>].map(say)).toEqual(["Guten Abend", "Chat"]);
  });
});

describe("what the product claims to speak", () => {
  it("names only languages whose tables are populated", () => {
    // `LANGS` is what the SERVER accepts and the model already answers in. `LANGS_READY` is what
    // the app has words for, and offering a language that falls back to English on every screen is
    // worse than not offering it. They converge as the later slices land.
    expect(LANGS_READY.every((l) => (LANGS as readonly string[]).includes(l))).toBe(true);
    expect(LANGS_READY).toContain("en");
    expect(new Set(LANGS_READY).size).toBe(LANGS_READY.length);
  });

  it("labels every supported language in ITSELF, so the row is readable to the person picking", () => {
    // A list of languages written in the language the reader is trying to leave is the one list
    // they cannot read. Never translated, so these are not `Localized` and must not become so.
    for (const lang of LANGS) expect(LANG_LABEL[lang].length).toBeGreaterThan(0);
    expect(LANG_LABEL.ru).toBe("Русский");
    expect(LANG_LABEL.de).toBe("Deutsch");
  });
});
