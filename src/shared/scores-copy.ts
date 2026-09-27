// The health score and BMI words (#118) — the title, the "{n}/10", the day's label, the one line
// of method, the per-part "not read", the "not enough read" state, and the BMI label and explainer.
//
// THE RANGE LABELS ARE NUMBERS, NEVER WORDS. A BMI band is rendered as "below 18.5" /
// "18.5–24.9" / "30 and above" — built from the band's own id, which IS its bounds, so no
// translation can ever smuggle a category word in. `scores-copy.test.ts` bans "obese",
// "overweight", "normal", "healthy" and their translations across all eight languages.
//
// THE FACTOR NAMES REUSE the labels that already exist: saturated fat is `verdictNoun("ldl")`,
// so the pill and the breakdown spell it the same way. The ones nothing else names — protein,
// fibre, sugar, salt — are here. `limit` on a part is a `medical` screen option id ("ldl",
// "kidneys", "lowsugar"); its label is the onboarding content's, not duplicated here.

import { numbers, t, type Localized } from "./lang.ts";
import type { BmiRange, ScoreFactor } from "./scores.ts";
import type { Lang } from "./types.ts";
import { verdictNoun } from "./verdicts.ts";

export interface ScoresCopy {
  /** The card's title. */
  title: string;
  /** "{n}/10" — the score as a fraction, `{n}` already formatted. */
  outOf: string;
  /** The day's label where the day's score stands (Home's page 2). */
  dayLabel: string;
  /** The one line explaining the method, under the title. */
  method: string;
  /** A part whose nutrient the analysis did not read. */
  notRead: string;
  /** The whole-card state when fewer than three of the five nutrients were read. */
  insufficient: string;
  /** The BMI label — the acronym, spelled the way the language spells it. */
  bmi: string;
  /** The one line explaining BMI. */
  bmiExplainer: string;
  /** Range templates — `{n}` / `{low}`/`{high}` are the band's own bounds, localized by `numbers`. */
  bmiBelow: string;
  bmiBetween: string;
  bmiAbove: string;
  /** The factor names nothing else owns — saturated fat reuses the verdict noun. */
  factors: Record<"protein" | "fibre" | "sugar" | "salt", string>;
}

export const SCORES_COPY: Localized<ScoresCopy> = {
  en: {
    title: "Health score",
    outOf: "{n}/10",
    dayLabel: "Today",
    method: "From protein, fibre, saturated fat, sugar and salt, per calorie.",
    notRead: "not read",
    insufficient: "Not enough read to score",
    bmi: "BMI",
    bmiExplainer: "Weight in kg divided by height in metres, squared.",
    bmiBelow: "below {n}",
    bmiBetween: "{low}–{high}",
    bmiAbove: "{n} and above",
    factors: { protein: "Protein", fibre: "Fibre", sugar: "Sugar", salt: "Salt" },
  },
  fr: {
    title: "Score santé",
    outOf: "{n}/10",
    dayLabel: "Aujourd'hui",
    method: "À partir des protéines, des fibres, des graisses saturées, du sucre et du sel, par calorie.",
    notRead: "non lu",
    insufficient: "Lecture insuffisante pour un score",
    bmi: "IMC",
    bmiExplainer: "Poids en kg divisé par la taille en mètres, au carré.",
    bmiBelow: "moins de {n}",
    bmiBetween: "{low}–{high}",
    bmiAbove: "{n} et plus",
    factors: { protein: "Protéines", fibre: "Fibres", sugar: "Sucres", salt: "Sel" },
  },
  de: {
    title: "Gesundheitsscore",
    outOf: "{n}/10",
    dayLabel: "Heute",
    method: "Aus Protein, Ballaststoffen, gesättigten Fettsäuren, Zucker und Salz — pro Kalorie.",
    notRead: "nicht erkannt",
    insufficient: "Zu wenig erkannt für einen Score",
    bmi: "BMI",
    bmiExplainer: "Gewicht in kg geteilt durch die Körpergröße in Metern zum Quadrat.",
    bmiBelow: "unter {n}",
    bmiBetween: "{low}–{high}",
    bmiAbove: "{n} und mehr",
    factors: { protein: "Protein", fibre: "Ballaststoffe", sugar: "Zucker", salt: "Salz" },
  },
  it: {
    title: "Punteggio di salute",
    outOf: "{n}/10",
    dayLabel: "Oggi",
    method: "Da proteine, fibre, grassi saturi, zuccheri e sale, per caloria.",
    notRead: "non letto",
    insufficient: "Dati insufficienti per un punteggio",
    bmi: "IMC",
    bmiExplainer: "Peso in kg diviso per l'altezza in metri, al quadrato.",
    bmiBelow: "sotto {n}",
    bmiBetween: "{low}–{high}",
    bmiAbove: "{n} e oltre",
    factors: { protein: "Proteine", fibre: "Fibre", sugar: "Zuccheri", salt: "Sale" },
  },
  es: {
    title: "Puntuación de salud",
    outOf: "{n}/10",
    dayLabel: "Hoy",
    method: "A partir de proteínas, fibra, grasas saturadas, azúcar y sal, por caloría.",
    notRead: "sin lectura",
    insufficient: "Lectura insuficiente para una puntuación",
    bmi: "IMC",
    bmiExplainer: "Peso en kg dividido por la altura en metros, al cuadrado.",
    bmiBelow: "por debajo de {n}",
    bmiBetween: "{low}–{high}",
    bmiAbove: "{n} y más",
    factors: { protein: "Proteínas", fibre: "Fibra", sugar: "Azúcar", salt: "Sal" },
  },
  vi: {
    title: "Điểm sức khỏe",
    outOf: "{n}/10",
    dayLabel: "Hôm nay",
    method: "Từ đạm, chất xơ, chất béo bão hòa, đường và muối, trên mỗi calo.",
    notRead: "không đọc được",
    insufficient: "Chưa đủ dữ liệu để chấm điểm",
    bmi: "BMI",
    bmiExplainer: "Cân nặng tính bằng kg chia cho chiều cao tính bằng mét, bình phương.",
    bmiBelow: "dưới {n}",
    bmiBetween: "{low}–{high}",
    bmiAbove: "từ {n} trở lên",
    factors: { protein: "Đạm", fibre: "Chất xơ", sugar: "Đường", salt: "Muối" },
  },
  id: {
    title: "Skor kesehatan",
    outOf: "{n}/10",
    dayLabel: "Hari ini",
    method: "Dari protein, serat, lemak jenuh, gula, dan garam, per kalori.",
    notRead: "tidak terbaca",
    insufficient: "Data terbaca kurang untuk skor",
    bmi: "IMT",
    bmiExplainer: "Berat badan dalam kg dibagi tinggi badan dalam meter, dikuadratkan.",
    bmiBelow: "di bawah {n}",
    bmiBetween: "{low}–{high}",
    bmiAbove: "{n} ke atas",
    factors: { protein: "Protein", fibre: "Serat", sugar: "Gula", salt: "Garam" },
  },
  ru: {
    title: "Оценка здоровья",
    outOf: "{n}/10",
    dayLabel: "Сегодня",
    method: "Из белка, клетчатки, насыщенных жиров, сахара и соли — на калорию.",
    notRead: "не считано",
    insufficient: "Недостаточно данных для оценки",
    bmi: "ИМТ",
    bmiExplainer: "Вес в кг, делённый на рост в метрах в квадрате.",
    bmiBelow: "ниже {n}",
    bmiBetween: "{low}–{high}",
    bmiAbove: "{n} и выше",
    factors: { protein: "Белок", fibre: "Клетчатка", sugar: "Сахар", salt: "Соль" },
  },
};

export const scoresCopy = (lang: Lang): ScoresCopy => t(lang)(SCORES_COPY);

/**
 * A factor's name. Saturated fat is the ONE that already has a localized label — the verdict
 * pill's — and the breakdown must spell it the same way, so it reads `verdictNoun` rather than
 * carrying a second translation of it.
 */
export function scoreFactorLabel(factor: ScoreFactor, lang: Lang): string {
  if (factor === "satfat") return verdictNoun("ldl", lang);
  return t(lang)(SCORES_COPY).factors[factor];
}

/**
 * A BMI range as its own numbers — "below 18.5", "18.5–24.9", "30 and above". The bounds are read
 * out of the range ID ITSELF, so the label and the boundary `bmiRange` tests can never disagree,
 * and `numbers(lang)` moves the decimal separator with the language.
 */
export function bmiRangeLabel(range: BmiRange, lang: Lang): string {
  const copy = t(lang)(SCORES_COPY);
  const n = numbers(lang);
  if (range.startsWith("below-")) return copy.bmiBelow.replace("{n}", n(Number(range.slice(6))));
  if (range.endsWith("-plus")) return copy.bmiAbove.replace("{n}", n(Number(range.slice(0, -5))));
  const [lo, hi] = range.split("-") as [string, string];
  return copy.bmiBetween.replace("{low}", n(Number(lo))).replace("{high}", n(Number(hi)));
}
