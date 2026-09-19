import { describe, expect, it } from "bun:test";
import { LANGS } from "./types.ts";
import {
  LANGS_READY, LANG_LABEL, LANG_TAG, UNIT_KCAL, genderedRussian, localizedGaps, monthYear, numbers,
  narrowLang, spellUnit, t,
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
  // The corpus is the point. A reviewer wrote 29 gendered sentences that a nutrition app would
  // plausibly ship and the first version of this check caught four of them, while firing on three
  // of Spud's own lines. Both lists below are that corpus, kept so the next widening is measured
  // rather than argued.
  const GENDERED = [
    "Что ты ел?", "Ты должна выпить воды.", "Оценено только потому, что ты об этом попросил.",
    "Ты {days} дней подряд записывал еду.", "Ты 5 дней подряд держался плана.",
    "Ты в Apple Health записал вес.", "Ты за эту неделю сбросил килограмм.",
    "Ты не смог записать этот обед.", "Ты привык есть поздно.",
    "Готов?", "поправь граммы сам", "Занят? Одна фотография — и всё.",
    "Ты прав — это много.", "Ты голоден? Запиши перекус.", "Ты доволен результатом?",
    "Ты подписан на пробный период.", "Ты новичок здесь.", "Ты здесь не одинок.",
    "Ты в этом не один.", "Что ел ты сегодня?", "Если это был не ты, просто не отвечай.",
  ];
  const FINE = [
    // Spud, about himself. His gender is his own to have.
    "Я пока не уверен в этой оценке.", "Я всегда готов помочь.", "Я тоже рад этому.",
    "Когда я не уверен, я так и скажу.", "Записал. С этого момента натрий оценивается.",
    // `один` is the NUMERAL everywhere except after `ты`.
    "один раз в день", "одна порция риса",
    // A verb agreeing with a masculine NOUN, not with the reader.
    "Хорошо — первый день начался. Ещё одно, прежде чем ты уйдёшь.",
    "Твой целевой вес больше не подходил к цели.",
    // Neuter is never a person; `самая` is the superlative.
    "Готово.", "Уйдёт само, как только получится.", "Самая низкая цель для твоего роста",
    // A unit that happens to end in -л.
    "{plan} ккал сегодня.",
    // Not Russian at all.
    "Damit bist du nicht allein", "You're in good company",
  ];

  it("catches every shape in the corpus", () => {
    for (const text of GENDERED) {
      expect(genderedRussian([text]).length, text).toBeGreaterThan(0);
    }
  });

  it("is silent on every shape that is not about the reader", () => {
    for (const text of FINE) expect(genderedRussian([text]), text).toEqual([]);
  });

  it("names where it found it, so a failure says what to go and edit", () => {
    expect(genderedRussian({ a: { b: "Что ты ел?" } })[0]?.at).toBe("a.b");
  });

  it("does NOT claim to catch pro-drop, which Russian uses constantly", () => {
    // `Отлично справился сегодня` is gendered with no marker of person in it, and `Записал.` is
    // Spud saying "noted" about himself. The two are indistinguishable without understanding the
    // sentence, so guessing would fire on his voice every second line. Pinned so the limit is a
    // decision in the suite rather than a surprise.
    expect(genderedRussian(["Отлично справился сегодня."])).toEqual([]);
  });
});

describe("narrowLang", () => {
  it("strips the q-value, because an Accept-Language entry carries one", () => {
    // `de;q=0.9` narrowed to `en` — so a browser that RANKED its languages got English, and the
    // confirmation email went out in the wrong one. `/start` had a second parser that handled it;
    // this function exists so there is only ever one.
    expect(narrowLang("de;q=0.9")).toBe("de");
    expect(narrowLang("ru;q=1.0")).toBe("ru");
    expect(narrowLang("fr ;q=0.8")).toBe("fr");
    expect(narrowLang("de-DE;q=0.9")).toBe("de");
  });

  it("still narrows everything it always did", () => {
    expect(narrowLang("de-DE")).toBe("de");
    expect(narrowLang("DE_de")).toBe("de");
    expect(narrowLang("zz")).toBe("en");
    expect(narrowLang("*")).toBe("en");
    expect(narrowLang(null)).toBe("en");
    expect(narrowLang(undefined)).toBe("en");
    expect(narrowLang("")).toBe("en");
  });
});
