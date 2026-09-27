// The BMI card's words (#118's card, drawn on Progress's board #95) — its label, the one line of
// method under the "?", and the four band labels.
//
// Their own table, not a section of `scores-copy.ts`: that table reads `verdictNoun`, which is
// Lingui, and a Lingui edge in the graph is a word the browser bundle cannot carry
// (`frontend/test/imports.ts` fails the reach, by name). Everything here imports only `lang.ts`,
// so both halves — the web's Progress and the server-side score surfaces — read the one wording.

import { numbers, t, type Localized } from "../lang.ts";
import type { BmiRange } from "../scores.ts";
import type { Lang } from "../types.ts";

export interface BmiCopy {
  /** The card's label — the acronym, spelled the way the language spells it. */
  bmi: string;
  /** The one line explaining BMI. */
  bmiExplainer: string;
  /**
   * Range templates — `{n}` / `{low}`/`{high}` are the band's own bounds, formatted by `numbers`.
   * THE RANGE LABELS ARE NUMBERS, NEVER WORDS: a band is "below 18.5" / "18.5–24.9" /
   * "25–29.9" / "30 and above", never "underweight"/"normal"/"overweight" — the classification
   * words are the medical claim the design board ruled out.
   */
  bmiBelow: string;
  bmiBetween: string;
  bmiAbove: string;
}

export const BMI_COPY: Localized<BmiCopy> = {
  en: {
    bmi: "BMI",
    bmiExplainer: "Weight in kg divided by height in metres, squared.",
    bmiBelow: "below {n}",
    bmiBetween: "{low}–{high}",
    bmiAbove: "{n} and above",
  },
  fr: {
    bmi: "IMC",
    bmiExplainer: "Poids en kg divisé par la taille en mètres, au carré.",
    bmiBelow: "moins de {n}",
    bmiBetween: "{low}–{high}",
    bmiAbove: "{n} et plus",
  },
  de: {
    bmi: "BMI",
    bmiExplainer: "Gewicht in kg geteilt durch die Körpergröße in Metern zum Quadrat.",
    bmiBelow: "unter {n}",
    bmiBetween: "{low}–{high}",
    bmiAbove: "{n} und mehr",
  },
  it: {
    bmi: "IMC",
    bmiExplainer: "Peso in kg diviso per l'altezza in metri, al quadrato.",
    bmiBelow: "sotto {n}",
    bmiBetween: "{low}–{high}",
    bmiAbove: "{n} e oltre",
  },
  es: {
    bmi: "IMC",
    bmiExplainer: "Peso en kg dividido por la altura en metros, al cuadrado.",
    bmiBelow: "por debajo de {n}",
    bmiBetween: "{low}–{high}",
    bmiAbove: "{n} y más",
  },
  vi: {
    bmi: "BMI",
    bmiExplainer: "Cân nặng tính bằng kg chia cho chiều cao tính bằng mét, bình phương.",
    bmiBelow: "dưới {n}",
    bmiBetween: "{low}–{high}",
    bmiAbove: "từ {n} trở lên",
  },
  id: {
    bmi: "IMT",
    bmiExplainer: "Berat badan dalam kg dibagi tinggi badan dalam meter, dikuadratkan.",
    bmiBelow: "di bawah {n}",
    bmiBetween: "{low}–{high}",
    bmiAbove: "{n} ke atas",
  },
  ru: {
    bmi: "ИМТ",
    bmiExplainer: "Вес в кг, делённый на рост в метрах в квадрате.",
    bmiBelow: "ниже {n}",
    bmiBetween: "{low}–{high}",
    bmiAbove: "{n} и выше",
  },
};

export const bmiCopy = (lang: Lang): BmiCopy => t(lang)(BMI_COPY);

/**
 * A BMI range as its own numbers — "below 18.5", "18.5–24.9", "30 and above". The bounds are read
 * out of the range ID ITSELF, so the label and the boundary `bmiRange` tests can never disagree,
 * and `numbers(lang)` moves the decimal separator with the language.
 */
export function bmiRangeLabel(range: BmiRange, lang: Lang): string {
  const copy = t(lang)(BMI_COPY);
  const n = numbers(lang);
  if (range.startsWith("below-")) return copy.bmiBelow.replace("{n}", n(Number(range.slice(6))));
  if (range.endsWith("-plus")) return copy.bmiAbove.replace("{n}", n(Number(range.slice(0, -5))));
  const [lo, hi] = range.split("-") as [string, string];
  return copy.bmiBetween.replace("{low}", n(Number(lo))).replace("{high}", n(Number(hi)));
}
