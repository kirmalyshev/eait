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
  "pt-BR": /obes|sobrepeso|excesso\s+de\s+peso|abaixo\s+do\s+peso|baixo\s+peso|\bnormal(?:es)?\b|saud[áa]ve|insalubre/i,
  ja: /肥満|過体重|低体重|普通体重|標準体重|正常|健康|やせ型|痩せ型/,
  ko: /비만|과체중|저체중|정상|건강/,
  "zh-Hans": /肥胖|超重|过重|偏瘦|过轻|体重不足|正常|健康/,
  "zh-Hant": /肥胖|超重|過重|偏瘦|過輕|體重不足|正常|健康/,
  tr: /obez|fazla\s+kilo|a[şs][ıi]r[ıi]\s+kilo|zay[ıi]f|\bnormal\b|sa[ğg]l[ıi]kl[ıi]|sa[ğg]l[ıi]ks[ıi]z/i,
  pl: /otył|nadwag|niedowag|prawidłow|\bnormaln|zdrow/i,
  nl: /obesitas|obees|zwaarlijvig|overgewicht|ondergewicht|\bnormaal\b|gezond/i,
  uk: /ожир|надмірн|надлишков|зайв\p{L}*\s+ваг|недостатн\p{L}*\s+ваг|дефіцит\s+ваг|норм|здоров/iu,
  sv: /fetma|överviktig|övervikt|undervikt|normalvikt|\bnormal\b|\bfrisk|hälsosam/i,
  th: /อ้วน|ท้วม|น้ำหนักเกิน|น้ำหนักน้อย|ผอม|สมส่วน|ปกติ|สุขภาพดี|ไม่ดีต่อสุขภาพ/,
  // The nukta letter (ज़) is one code point or two, depending on who typed it.
  hi: /मोटाप|मोटा|(?:अधिक|[जज़]़?्यादा|कम)\s+वज|दुबला|सामान्य|स्वस्थ|अस्वस्थ/,
  cs: /obez|obézn|nadváh|podváh|normáln|zdrav/i,
  ro: /obez|supraponder|subponder|\bnormal|sănăt/i,
  el: /παχυσαρκ|παχύσαρκ|υπ[εέ]ρβαρ|λιποβαρ|φυσιολογικ|κανονικ|υγι[εήέ]/iu,
  hu: /elhízott|elhízás|túlsúly|alulsúly|soványság|normál|egészséges|egészségtelen/i,
  da: /fedme|overvægt|undervægt|normalvægt|(?<!\p{L})normal|(?<!\p{L})u?sund/iu,
  // Norwegian writes BMI as KMI; the category words are the ones Danish shares.
  no: /fedme|overvekt|undervekt|normalvekt|(?<!\p{L})normal|(?<!\p{L})u?sunn/iu,
  fi: /lihav|ylipain|alipain|normaal|(?<!\p{L})terve|epäterve/iu,
  sk: /obez|obézn|nadváh|podváh|normáln|zdrav/iu,
  hr: /pretil|debel|debljin|prekomjern|pothranjen|nedovoljn\p{L}*\s+tež|normaln|zdrav/iu,
  sl: /debel|čezmern|prekomern|podhranjen|premajhn\p{L}*\s+tež|normaln|zdrav/iu,
  ca: /ob[eè]s|sobrep[eè]s|infrap[eè]s|pes\s+insuficient|baix\s+pes|(?<!\p{L})normal|(?<!\p{L})san[ae]?s?(?!\p{L})|saludable|insalubre/iu,
  ms: /obes|berlebihan|lebih\s+berat|kurang\s+berat|(?<!\p{L})normal|sihat/iu,
  "pt-PT": /obes|sobrepeso|excesso\s+de\s+peso|peso\s+a\s+mais|abaixo\s+do\s+peso|baixo\s+peso|(?<!\p{L})normal(?:es)?(?!\p{L})|saud[áa]ve|insalubre/iu,
  // The ranges say "below" and "and above" with the word for LESS / MORE (`কম`, `ಕಡಿಮೆ`, `कमी`,
  // `ଅଧିକ`, `తక్కువ`), so those count only beside the word for weight. Gurmukhi's nukta letter is
  // matched both ways, as Hindi's is.
  bn: /স্থূল|মোটা|(?:কম|অতিরিক্ত|বেশি)\s+ওজন|রোগা|স্বাভাবিক|সুস্থ|স্বাস্থ্যকর/,
  gu: /મેદસ્વ|સ્થૂળ|જાડાપણ|(?:ઓછું|વધુ|વધારે)\s+વજન|દૂબળ|સામાન્ય|સ્વસ્થ|તંદુરસ્ત/,
  kn: /ಸ್ಥೂಲ|ಬೊಜ್ಜು|(?:ಕಡಿಮೆ|ಅಧಿಕ|ಹೆಚ್ಚು)\s+ತೂಕ|ಸಾಮಾನ್ಯ|ಆರೋಗ್ಯ/,
  ml: /പൊണ്ണത്തടി|അമിത\s*ഭാര|ഭാരക്കുറവ|ഭാരം\s+കുറവ|സാധാരണ|ആരോഗ്യ/,
  mr: /लठ्ठ|स्थूल|(?:कमी|जास्त|अधिक)\s+वजन|कृश|सामान्य|निरोगी|आरोग्य/,
  or: /ମେଦବହୁଳ|ମୋଟା|(?:କମ୍|ଅଧିକ|ବେଶି)\s+ଓଜନ|ସାଧାରଣ|ସ୍[ୱଵ]ାଭାବିକ|ସୁସ୍ଥ|ସ୍[ୱଵ]ାସ୍ଥ୍ୟକର/,
  pa: /ਮੋਟਾਪ|(?:ਘੱਟ|ਵੱਧ|[\u0A1C\u0A5B]\u0A3C?ਿਆਦਾ)\s+ਭਾਰ|ਪਤਲ|ਸਧਾਰਨ|(?<![\p{L}\p{M}])ਆਮ(?![\p{L}\p{M}])|ਸਿਹਤਮੰਦ|ਤੰਦਰੁਸਤ/u,
  ta: /பருமன்|(?:குறைந்த|அதிக|கூடுதல்)\s+எடை|எடைக்\s*குறைவ|ஒல்லி|இயல்பான|சாதாரண|ஆரோக்கிய/,
  te: /ఊబకాయ|స్థూలకాయ|(?:తక్కువ|అధిక|ఎక్కువ)\s+బరువు|సన్నగా|సాధారణ|ఆరోగ్య/,
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
    expect(say("id", 2)).toBe("Dari 2 makanan hari ini");
  });

  test("every factor has a name in every language", () => {
    for (const lang of LANGS) {
      for (const f of ["protein", "fibre", "satfat", "sugar", "salt"] as const) {
        expect(scoreFactorLabel(f, lang).length, `${lang}/${f}`).toBeGreaterThan(0);
      }
    }
  });
});
