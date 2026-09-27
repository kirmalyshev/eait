import { describe, expect, it } from "bun:test";
import { LANGS } from "./types.ts";
import {
  LANGS_READY, LANG_LABEL, LANG_TAG, UNIT_KCAL, countText, dayMonthAt, genderedRussian,
  listFormat, localizedGaps, monthYear, numbers, signedWholeNumbers, timeAt,
  weekdayLetters, acceptLang, acceptLanguageTags, narrowLang, spellUnit, t,
  type Localized,
} from "./lang.ts";
import { COUNTRY_CODES, countryLabel, countryOptions } from "./onboarding.ts";
import { localDate } from "./dates.ts";

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


  it("signs a whole number the locale's own way — the boards' +450 / −500 deltas", () => {
    const signed = signedWholeNumbers("en");
    expect(signed(450)).toBe("+450");
    expect(signed(0)).toBe("+0");
    // ICU writes the minus as U+2212 or a hyphen depending on the version — pin the digits and
    // that a NON-digit sign precedes them, not the glyph.
    expect(signed(-500)).toMatch(/^\D500$/);
    expect(signedWholeNumbers("de")(-500)).toMatch(/^\D500$/);
  });

  it("formats an instant's day in the ACCOUNT's zone — a boundary instant lands on different days", () => {
    // 01 Jan 2027 01:00 UTC is still 31 Dec 2026 in Honolulu and already 1 Jan in Auckland.
    const at = new Date("2027-01-01T01:00:00Z");
    expect(dayMonthAt("en", "Pacific/Auckland", at)).toMatch(/1 Jan 2027/);
    expect(dayMonthAt("en", "Pacific/Honolulu", at)).toMatch(/31 Dec/);
  });

  it("joins the year only when it is not this one", () => {
    const thisYear = new Date(`${localDate("UTC")}T12:00:00Z`);
    expect(dayMonthAt("en", "UTC", thisYear)).not.toMatch(/\d{4}/);
    expect(dayMonthAt("en", "UTC", new Date("2999-06-15T12:00:00Z"))).toMatch(/2999/);
  });

  it("reads the clock in the account's zone — the pairing code's expiry and a weigh-in's time", () => {
    const at = new Date("2026-09-26T09:41:00Z");
    expect(timeAt("en", "UTC", at)).toMatch(/9:41/);
    expect(timeAt("en", "Pacific/Auckland", at)).toMatch(/21:41/); // UTC+12 that evening
    expect(timeAt("de", "Europe/Berlin", at)).toMatch(/11:41/);  // CEST → UTC+2
    expect(timeAt("de", "Europe/Berlin", at)).not.toBe(timeAt("de", "UTC", at));
  });

  it("names the week's seven letters, Monday first — the strip's and the Progress dots' captions", () => {
    // CLDR's `narrow` weekday, the same source `monthYear` trusts: a table of letters here is
    // the month-name table that file deleted — 56 hand-written initials with the wrong ones in
    // three languages. Pinned per language so a CLDR move is a diff somebody reads.
    expect(weekdayLetters("en")).toEqual(["M", "T", "W", "T", "F", "S", "S"]);
    expect(weekdayLetters("de")).toEqual(["M", "D", "M", "D", "F", "S", "S"]);
    expect(weekdayLetters("ru")).toEqual(["П", "В", "С", "Ч", "П", "С", "В"]);
    for (const lang of LANGS) expect(weekdayLetters(lang)).toHaveLength(7);
  });
});

describe("countText — one count, the form CLDR says its language wants", () => {
  // "4 days" is the whole of English's plural system and three of Russian's four. A table that
  // holds one template per language can write "{n} days" and cannot write "5 дней" — the form is
  // picked by `Intl.PluralRules`, which is the rule and so lives here rather than in the copy.
  const days = { one: "{n} day", other: "{n} days" };
  const dni = { one: "{n} день", few: "{n} дня", many: "{n} дней", other: "{n} дня" };

  it("fills the form the number's category names", () => {
    expect(countText("en")(days, 1)).toBe("1 day");
    expect(countText("en")(days, 4)).toBe("4 days");
    expect(countText("ru")(dni, 1)).toBe("1 день");
    expect(countText("ru")(dni, 4)).toBe("4 дня");
    expect(countText("ru")(dni, 5)).toBe("5 дней");
    // A language with one form asks for `other` alone, and 1 still lands on it.
    expect(countText("vi")({ other: "{n} ngày" }, 1)).toBe("1 ngày");
  });

  it("never returns undefined — a missing category falls to `other`", () => {
    // Russian's `many` covers 11–14 and every x5–x0; English has no `few` to give.
    expect(countText("en")(days, 2)).toBe("2 days");
    expect(countText("ru")({ one: "{n} день", other: "{n} дня" }, 11)).toBe("11 дня");
  });
});

describe("a runtime without Intl.PluralRules / ListFormat / DisplayNames (Hermes on iOS)", () => {
  // The constructors are assigned to `undefined`, not deleted: the helpers read `typeof` at
  // call time, which is the same shape as a Hermes build that never defined them.
  const without = <T extends keyof typeof Intl>(key: T, run: () => void) => {
    const keep = Intl[key];
    // @ts-expect-error — simulating a runtime that never defined the constructor
    Intl[key] = undefined;
    try { run(); } finally { Intl[key] = keep; }
  };

  it("countText still picks the right form — Russian's four included", () => {
    without("PluralRules", () => {
      expect(countText("en")({ one: "{n} day", other: "{n} days" }, 1)).toBe("1 day");
      expect(countText("en")({ one: "{n} day", other: "{n} days" }, 4)).toBe("4 days");
      expect(countText("fr")({ one: "{n} jour", other: "{n} jours" }, 0)).toBe("0 jour");
      const dni = { one: "{n} день", few: "{n} дня", many: "{n} дней", other: "{n} дня" };
      for (const [n, want] of [[1, "1 день"], [4, "4 дня"], [5, "5 дней"], [11, "11 дней"],
        [21, "21 день"], [22, "22 дня"], [25, "25 дней"], [111, "111 дней"]] as const) {
        expect(countText("ru")(dni, n)).toBe(want);
      }
      expect(countText("vi")({ other: "{n} ngày" }, 2)).toBe("2 ngày");
    });
  });

  it("listFormat joins with the comma rather than throwing", () => {
    without("ListFormat", () => {
      expect(listFormat("en", ["a", "b", "c"])).toBe("a, b, c");
      expect(listFormat("en", [])).toBe("");
    });
  });

  it("countryLabel and countryOptions degrade to English names and locale order", () => {
    without("DisplayNames", () => {
      expect(countryLabel("de", "en")).toBe("Germany");
      expect(countryLabel("other", "en")).toBe("other");
    });
    without("Collator", () => {
      const opts = countryOptions("en");
      expect(opts).toContain("de");
      expect(opts[opts.length - 1]).toBe("other");
      expect(opts).toHaveLength(COUNTRY_CODES.length);
    });
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

describe("acceptLanguageTags", () => {
  it("sorts by q, because RFC 9110 does not require the client to", () => {
    // `en;q=0.1, de;q=0.9` served the front door in English, and silently: the first tag is a
    // real language, so nothing looked wrong.
    expect(acceptLanguageTags("en;q=0.1, de;q=0.9")[0]).toBe("de");
    expect(acceptLanguageTags("*;q=0.5,de;q=0.9")[0]).toBe("de");
    expect(narrowLang(acceptLanguageTags("en;q=0.1, ru;q=0.9")[0])).toBe("ru");
  });

  it("keeps the client's own order when the weights tie, and drops what is not a language", () => {
    expect(acceptLanguageTags("de-DE,de,en")).toEqual(["de-DE", "de", "en"]);
    expect(acceptLanguageTags("*")).toEqual([]);
    expect(acceptLanguageTags("de;q=0")).toEqual([]);
    expect(acceptLanguageTags(null)).toEqual([]);
  });
});

describe("acceptLang", () => {
  it("takes the first SUPPORTED language, not the first tag", () => {
    // `pt-BR,fr;q=0.9` served a French speaker English: `pt` narrows to `en` before `fr` is read.
    expect(acceptLang("pt-BR,fr;q=0.9")).toBe("fr");
    expect(acceptLang("fr-CA,en;q=0.5")).toBe("fr");
    expect(acceptLang("pt-BR,ja")).toBe("en");
    expect(acceptLang(null)).toBe("en");
  });
});
