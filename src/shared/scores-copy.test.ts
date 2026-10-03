import { describe, expect, test } from "bun:test";
import { LANGS } from "./types.ts";
import { countText } from "./lang.ts";
import { bmiRangeLabel, scoreFactorLabel, scoresCopy } from "./scores-copy.ts";
import { BMI_BANDS, type BmiRange } from "./scores.ts";
import { verdictNoun } from "./verdicts.ts";

/**
 * The category words a BMI label may never carry (#118) — "obese", "overweight", "underweight",
 * "normal", "healthy" and their translations. Numbers are the label; a word would be a judgement.
 *
 * Scoped to the BMI strings (the acronym, the explainer, and every rendered range) — `insufficient`
 * is not a label and languages own words for "insufficient" that ARE these roots ("Недостаточно").
 */
const BANNED: Record<string, RegExp> = {
  en: /\b(?:obese|obesity|overweight|underweight|normal|healthy|unhealthy)\b/i,
  fr: /ob[eè]se|ob[ée]sit[ée]|surpoids|sous-poids|\bnormal(?:e|es)?\b|\bsains?\b|malsains?/i,
  de: /adip[öo]s|fettleibig|[uü]bergewicht|untergewicht|\bnormal(?:e|en|er)?\b|\bgesund|ungesund/i,
  it: /obes[oaie]|sovrappeso|sottopeso|\bnormal[ei]?\b|\bsan[oaie]\b|malsan[oaie]/i,
  es: /obes[oa]s?|sobrepeso|infrapeso|bajo\s+peso|\bnormal(?:es)?\b|\bsan[oa]s?\b|malsan[oa]s?/i,
  vi: /b[ée]o\s*ph[ìi]|th[ừu]a\s*c[âa]n|thi[ếe]u\s*c[âa]n|b[ìi]nh\s*th[ườu]ng|kh[ỏo]e\s*m[ạa]nh/i,
  id: /obesitas|kelebihan\s+berat|kekurangan\s+berat|\bnormal\b|\bsehat\b|tidak\s+sehat/i,
  // Cyrillic needs no \b — JavaScript's is ASCII-only. Substrings on the BMI labels only.
  ru: /ожир|избыточн|недовес|норма|здоров|лишн/i,
};

describe("BMI labels (#118)", () => {
  test("carry no category word, in any language", () => {
    for (const lang of LANGS) {
      const copy = scoresCopy(lang);
      for (const range of BMI_BANDS.map((b) => b.id) as BmiRange[]) {
        expect(bmiRangeLabel(range, lang), `${lang}/${range}`).not.toMatch(BANNED[lang]!);
      }
      expect(copy.bmi, lang).not.toMatch(BANNED[lang]!);
      expect(copy.bmiExplainer, lang).not.toMatch(BANNED[lang]!);
    }
  });

  test("are the band's own numbers, localized", () => {
    expect(bmiRangeLabel("below-18.5", "en")).toBe("below 18.5");
    expect(bmiRangeLabel("18.5-24.9", "en")).toBe("18.5–24.9");
    expect(bmiRangeLabel("25-29.9", "en")).toBe("25–29.9");
    expect(bmiRangeLabel("30-plus", "en")).toBe("30 and above");
    // `numbers(lang)` moves the decimal separator, not the digits.
    expect(bmiRangeLabel("below-18.5", "de")).toBe("unter 18,5");
    expect(bmiRangeLabel("18.5-24.9", "ru")).toBe("18,5–24,9");
  });
});

describe("score copy (#118)", () => {
  test("saturated fat is the verdict pill's noun, not a second translation of it", () => {
    for (const lang of LANGS) expect(scoreFactorLabel("satfat", lang)).toBe(verdictNoun("ldl", lang));
  });

  test("the today board's strings are present in every language (W4)", () => {
    for (const lang of LANGS) {
      const copy = scoresCopy(lang);
      expect(copy.todayTitle, lang).toContain("{n}");
      expect(copy.todayTitle, lang).toContain("/10");
      for (const s of [copy.todayTitle, copy.breakdownTitle, copy.dayBreakdownTitle]) {
        expect(s.length, lang).toBeGreaterThan(0);
      }
    }
  });

  test("'From today's meals' counts in the reader's own plural forms — Russian's three included (W4)", () => {
    const say = (lang: (typeof LANGS)[number], n: number) =>
      countText(lang)(scoresCopy(lang).todayFromMeals, n);
    expect(say("en", 1)).toBe("From today's meal");
    expect(say("en", 3)).toBe("From today's 3 meals");
    expect(say("de", 1)).toBe("Aus der heutigen Mahlzeit");
    expect(say("ru", 1)).toBe("По сегодняшнему приёму пищи");
    expect(say("ru", 4)).toBe("Из 4 сегодняшних приёмов пищи");
    expect(say("ru", 5)).toBe("Из 5 сегодняшних приёмов пищи");
    expect(say("ru", 21)).toBe("По сегодняшнему приёму пищи");
    // Languages without plural marking still fill the count.
    expect(say("vi", 2)).toBe("Từ 2 bữa hôm nay");
    expect(say("id", 2)).toBe("Dari 2 santapan hari ini");
  });

  test("every factor has a name in every language", () => {
    for (const lang of LANGS) {
      for (const f of ["protein", "fibre", "satfat", "sugar", "salt"] as const) {
        expect(scoreFactorLabel(f, lang).length, `${lang}/${f}`).toBeGreaterThan(0);
      }
    }
  });
});
