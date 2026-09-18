import { describe, expect, it } from "bun:test";
import { LANGS } from "./types.ts";
import {
  LANGS_READY, LANG_LABEL, LANG_TAG, genderedRussian, localizedGaps, monthYear, numbers, t,
  type Localized,
} from "./lang.ts";

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
  it("is the eight Kirill named, in the order the picker shows them", () => {
    expect(LANGS).toEqual(["en", "fr", "de", "it", "es", "vi", "id", "ru"]);
  });

  it("names only languages whose tables are populated", () => {
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
    expect(LANG_LABEL.fr).toBe("Français");
    expect(LANG_LABEL.it).toBe("Italiano");
    expect(LANG_LABEL.es).toBe("Español");
    expect(LANG_LABEL.vi).toBe("Tiếng Việt");
    expect(LANG_LABEL.id).toBe("Bahasa Indonesia");
  });

  it("carries a BCP-47 tag for every language, because Intl takes a tag and not a Lang", () => {
    for (const lang of LANGS) expect(LANG_TAG[lang].startsWith(lang)).toBe(true);
  });
});

describe("numbers and dates", () => {
  it("are Intl's, so a German reads 1.454 and a Frenchman 1 454", () => {
    expect(numbers("en")(1454)).toBe("1,454");
    expect(numbers("de")(1454)).toBe("1.454");
    // French groups with a narrow no-break space (U+202F in modern CLDR); assert the digits and
    // that it is NOT a comma rather than pinning a space character ICU has moved once already.
    expect(numbers("fr")(1454)).toMatch(/^1\D454$/);
    expect(numbers("ru")(1454)).toMatch(/^1\D454$/);
  });

  it("rounds to whole numbers, and keeps one decimal when there is one", () => {
    expect(numbers("en")(92.04)).toBe("92");
    expect(numbers("en")(92.35)).toBe("92.4");
    expect(numbers("de")(92.35)).toBe("92,4");
  });

  it("names a month in the reader's language, from Intl and never from a table", () => {
    const at = new Date("2026-11-15T12:00:00Z");
    expect(monthYear("en", at)).toBe("November 2026");
    expect(monthYear("de", at)).toBe("November 2026");
    expect(monthYear("fr", at)).toBe("novembre 2026");
    expect(monthYear("vi", at)).toContain("2026");
  });
});

describe("localizedGaps — the check that keeps this true after everybody leaves", () => {
  it("names the table AND the language when one is missing", () => {
    const gaps = localizedGaps({ GREETING: { en: "hi", de: "hallo" } }, ["en", "de", "fr"]);
    expect(gaps).toEqual([{ table: "GREETING", lang: "fr" }]);
  });

  it("finds a table nested inside another export, because most of them are", () => {
    const gaps = localizedGaps({ CARDS: { lose: { en: "a" }, gain: { en: "b", ru: "б" } } }, ["en", "ru"]);
    expect(gaps).toEqual([{ table: "CARDS.lose", lang: "ru" }]);
  });

  it("says nothing about a complete table", () => {
    expect(localizedGaps({ X: { en: 1, de: 2 } }, ["en", "de"])).toEqual([]);
  });

  it("is not fooled by an ordinary object that happens to hold prose", () => {
    expect(localizedGaps({ CARD: { title: "x", body: "y" } }, ["en", "de"])).toEqual([]);
  });

  it("survives a cycle, because a module graph has them", () => {
    const a: Record<string, unknown> = { name: "a" };
    a.self = a;
    expect(localizedGaps({ a }, ["en"])).toEqual([]);
  });
});

describe("genderedRussian — the check no English-reading reviewer could be", () => {
  it("catches a second-person past tense, which in Russian always picks a gender", () => {
    // The exact string that shipped on the chat composer, in three surfaces at once.
    expect(genderedRussian({ placeholder: "Что ты ел?" })).toEqual([{ at: "placeholder", text: "ты ел" }]);
    expect(genderedRussian({ a: { b: "Скажи, что ты ел, и запиши заново." } })[0]?.at).toBe("a.b");
  });

  it("catches it across a couple of words, because that is where it hides", () => {
    expect(genderedRussian(["еда, которую ты не готовил сам"])).toHaveLength(1);
  });

  it("says nothing about Spud talking about HIMSELF, which is his gender to have", () => {
    expect(genderedRussian({ x: "Записал. С этого момента натрий оценивается." })).toEqual([]);
    expect(genderedRussian({ x: "Когда я не уверен, я так и скажу." })).toEqual([]);
  });

  it("needs no language bucket, because no other language can match it", () => {
    // Every string in the graph is asked, so a table that stops being `Localized` stays covered.
    expect(genderedRussian({ de: "Damit bist du nicht allein", fr: "Ça n'arrive pas qu'à toi" })).toEqual([]);
  });
});
