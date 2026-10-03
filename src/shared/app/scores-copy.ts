// The health score and BMI words (#118) — the title, the "{n}/10", the day's label, the one line
// of method, the per-part "not read", the "not enough read" state, and the BMI label and explainer.
//
// THE RANGE LABELS ARE NUMBERS, NEVER WORDS. A BMI band is rendered as "below 18.5" /
// "18.5–24.9" / "30 and above" — built from the band's own id, which IS its bounds, so no
// translation can ever smuggle a category word in. `scores-copy.test.ts` bans "obese",
// "overweight", "normal", "healthy" and their translations across all eight languages.
//
// THE FACTOR NAMES REUSE the labels that already exist: saturated fat's is `LOG_COPY.satfatNoun`
// — the verdict pill's noun already Lingui-free for the log surface (#146) — and the ones nothing
// else names are `factors` here. `limit` on a part is a `medical` screen option id ("ldl",
// "kidneys", "lowsugar"); its label is the onboarding content's, not duplicated here.

import { t, type CountForms, type Localized } from "../lang.ts";
import { logCopyFor } from "./log-copy.ts";
import type { ScoreFactor, ScoreLimit } from "../scores.ts";
import type { Lang } from "../types.ts";

export interface ScoreAppCopy {
  /** The card's title. */
  title: string;
  /** The meal sheet's own title — it scores that one meal (#337). */
  mealTitle: string;
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
  /** The score-less day hero's a11y tail — "Day score, not yet" (ieat-app#1331). */
  notYet: string;
  /** The today-score board's headline — "Today's score {n}/10". */
  todayTitle: string;
  /**
   * "From today's meal" / "From today's {n} meals" — `countText(lang)` picks the form CLDR names
   * for the count; the singular is a whole template because a one is said, not numbered.
   */
  todayFromMeals: CountForms;
  /** The day breakdown's own title — "Today's meals" (#1472); each row carries its own score. */
  breakdownTitle: string;
  /** `todayFromMeals` and `breakdownTitle` for any day but today, which is never "today's" (#1222). */
  dayFromMeals: CountForms;
  dayBreakdownTitle: string;
  /** The four factor names nothing else names — `satfat` reads LOG_COPY's `satfatNoun`. */
  factors: Record<Exclude<ScoreFactor, "satfat">, string>;
  /** The breakdown's opening row — the base points every score starts from. */
  startRow: string;
  /**
   * A part's measure under its factor name, as the boards write it ("25% of kcal", "0.9g per
   * 100kcal", "115mg sodium per 100kcal"). `{n}` arrives already formatted. The
   * `partOfTarget*` forms are the declared-limit variants — "{n}g of your {target}g" — where
   * `{target}` is the cap the profile's restriction sets on the day's targets.
   */
  partPctOfKcal: string;
  partGPer100Kcal: string;
  partMgSodiumPer100Kcal: string;
  partOfTargetG: string;
  partOfTargetMg: string;
  /** The declared limit a personalised part names, mid-sentence — "high cholesterol". */
  limits: Record<ScoreLimit, string>;
}

export const SCORES_APP_COPY: Localized<ScoreAppCopy> = {
  en: {
    title: "Day score",
    mealTitle: "Meal score",
    outOf: "{n}/10",
    dayLabel: "Today",
    method: "From protein, fibre, saturated fat, sugar and salt, per calorie.",
    notRead: "not read",
    insufficient: "Not enough read to score",
    notYet: "not yet",
    todayTitle: "Today's score {n}/10",
    todayFromMeals: { one: "From today's meal", other: "From today's {n} meals" },
    breakdownTitle: "Today's meals",
    dayFromMeals: { one: "From the day's meal", other: "From the day's {n} meals" },
    dayBreakdownTitle: "The day's meals",
    factors: { protein: "Protein", fibre: "Fibre", sugar: "Sugar", salt: "Salt" },
    startRow: "Start",
    partPctOfKcal: "{n}% of kcal",
    partGPer100Kcal: "{n}g per 100kcal",
    partMgSodiumPer100Kcal: "{n}mg sodium per 100kcal",
    partOfTargetG: "{n}g of your {target}g",
    partOfTargetMg: "{n}mg of your {target}mg",
    limits: { ldl: "high cholesterol", kidneys: "kidney condition", lowsugar: "diabetes risk" },
  },
  fr: {
    title: "Score du jour",
    mealTitle: "Score du repas",
    outOf: "{n}/10",
    dayLabel: "Aujourd'hui",
    method: "À partir des protéines, des fibres, des graisses saturées, du sucre et du sel, par calorie.",
    notRead: "non lu",
    insufficient: "Lecture insuffisante pour un score",
    notYet: "pas encore",
    todayTitle: "Score du jour : {n}/10",
    todayFromMeals: { one: "Du repas d'aujourd'hui", other: "Des {n} repas d'aujourd'hui" },
    breakdownTitle: "Les repas d'aujourd'hui",
    dayFromMeals: { one: "Du repas de la journée", other: "Des {n} repas de la journée" },
    dayBreakdownTitle: "Les repas de la journée",
    factors: { protein: "Protéines", fibre: "Fibres", sugar: "Sucres", salt: "Sel" },
    startRow: "Base",
    partPctOfKcal: "{n} % des kcal",
    partGPer100Kcal: "{n}g pour 100kcal",
    partMgSodiumPer100Kcal: "{n}mg de sodium pour 100kcal",
    partOfTargetG: "{n}g sur tes {target}g",
    partOfTargetMg: "{n}mg sur tes {target}mg",
    limits: { ldl: "cholestérol élevé", kidneys: "maladie rénale", lowsugar: "risque de diabète" },
  },
  de: {
    title: "Tagesbewertung",
    mealTitle: "Mahlzeitbewertung",
    outOf: "{n}/10",
    dayLabel: "Heute",
    method: "Aus Protein, Ballaststoffen, gesättigten Fettsäuren, Zucker und Salz — pro Kalorie.",
    notRead: "nicht erkannt",
    insufficient: "Zu wenig erkannt für eine Bewertung",
    notYet: "noch nicht",
    todayTitle: "Tagesbewertung: {n}/10",
    todayFromMeals: { one: "Aus der heutigen Mahlzeit", other: "Aus den heutigen {n} Mahlzeiten" },
    breakdownTitle: "Die heutigen Mahlzeiten",
    dayFromMeals: { one: "Aus der Mahlzeit des Tages", other: "Aus den {n} Mahlzeiten des Tages" },
    dayBreakdownTitle: "Die Mahlzeiten des Tages",
    factors: { protein: "Protein", fibre: "Ballaststoffe", sugar: "Zucker", salt: "Salz" },
    startRow: "Basis",
    partPctOfKcal: "{n}% der kcal",
    partGPer100Kcal: "{n}g pro 100kcal",
    partMgSodiumPer100Kcal: "{n}mg Natrium pro 100kcal",
    partOfTargetG: "{n}g von deinen {target}g",
    partOfTargetMg: "{n}mg von deinen {target}mg",
    limits: { ldl: "hohes Cholesterin", kidneys: "Nierenerkrankung", lowsugar: "Diabetesrisiko" },
  },
  it: {
    title: "Punteggio del giorno",
    mealTitle: "Punteggio del pasto",
    outOf: "{n}/10",
    dayLabel: "Oggi",
    method: "Da proteine, fibre, grassi saturi, zuccheri e sale, per caloria.",
    notRead: "non letto",
    insufficient: "Dati insufficienti per un punteggio",
    notYet: "non ancora",
    todayTitle: "Punteggio di oggi: {n}/10",
    todayFromMeals: { one: "Dal pasto di oggi", other: "Dai {n} pasti di oggi" },
    breakdownTitle: "I pasti di oggi",
    dayFromMeals: { one: "Dal pasto della giornata", other: "Dai {n} pasti della giornata" },
    dayBreakdownTitle: "I pasti della giornata",
    factors: { protein: "Proteine", fibre: "Fibre", sugar: "Zuccheri", salt: "Sale" },
    startRow: "Base",
    partPctOfKcal: "{n}% delle kcal",
    partGPer100Kcal: "{n}g per 100kcal",
    partMgSodiumPer100Kcal: "{n}mg di sodio per 100kcal",
    partOfTargetG: "{n}g sui tuoi {target}g",
    partOfTargetMg: "{n}mg sui tuoi {target}mg",
    limits: { ldl: "colesterolo alto", kidneys: "malattia renale", lowsugar: "rischio di diabete" },
  },
  es: {
    title: "Puntuación del día",
    mealTitle: "Puntuación de la comida",
    outOf: "{n}/10",
    dayLabel: "Hoy",
    method: "A partir de proteínas, fibra, grasas saturadas, azúcar y sal, por caloría.",
    notRead: "sin lectura",
    insufficient: "Lectura insuficiente para una puntuación",
    notYet: "aún no",
    todayTitle: "Puntuación de hoy: {n}/10",
    todayFromMeals: { one: "De la comida de hoy", other: "De las {n} comidas de hoy" },
    breakdownTitle: "Las comidas de hoy",
    dayFromMeals: { one: "De la comida del día", other: "De las {n} comidas del día" },
    dayBreakdownTitle: "Las comidas del día",
    factors: { protein: "Proteínas", fibre: "Fibra", sugar: "Azúcar", salt: "Sal" },
    startRow: "Base",
    partPctOfKcal: "{n}% de las kcal",
    partGPer100Kcal: "{n}g por 100kcal",
    partMgSodiumPer100Kcal: "{n}mg de sodio por 100kcal",
    partOfTargetG: "{n}g de tus {target}g",
    partOfTargetMg: "{n}mg de tus {target}mg",
    limits: { ldl: "colesterol alto", kidneys: "enfermedad renal", lowsugar: "riesgo de diabetes" },
  },
  vi: {
    title: "Điểm trong ngày",
    mealTitle: "Điểm bữa ăn",
    outOf: "{n}/10",
    dayLabel: "Hôm nay",
    method: "Từ đạm, chất xơ, chất béo bão hòa, đường và muối, trên mỗi calo.",
    notRead: "không đọc được",
    insufficient: "Chưa đủ dữ liệu để chấm điểm",
    notYet: "chưa có",
    todayTitle: "Điểm hôm nay: {n}/10",
    todayFromMeals: { other: "Từ {n} bữa hôm nay" },
    breakdownTitle: "Các bữa hôm nay",
    dayFromMeals: { other: "Từ {n} bữa trong ngày" },
    dayBreakdownTitle: "Các bữa trong ngày",
    factors: { protein: "Đạm", fibre: "Chất xơ", sugar: "Đường", salt: "Muối" },
    startRow: "Điểm gốc",
    partPctOfKcal: "{n}% của kcal",
    partGPer100Kcal: "{n}g trên 100kcal",
    partMgSodiumPer100Kcal: "{n}mg natri trên 100kcal",
    partOfTargetG: "{n}g trong {target}g của bạn",
    partOfTargetMg: "{n}mg trong {target}mg của bạn",
    limits: { ldl: "cholesterol cao", kidneys: "bệnh thận", lowsugar: "nguy cơ tiểu đường" },
  },
  id: {
    title: "Skor harian",
    mealTitle: "Skor santapan",
    outOf: "{n}/10",
    dayLabel: "Hari ini",
    method: "Dari protein, serat, lemak jenuh, gula, dan garam, per kalori.",
    notRead: "tidak terbaca",
    insufficient: "Data terbaca kurang untuk skor",
    notYet: "belum ada",
    todayTitle: "Skor hari ini: {n}/10",
    todayFromMeals: { other: "Dari {n} santapan hari ini" },
    breakdownTitle: "Santapan hari ini",
    dayFromMeals: { other: "Dari {n} santapan hari itu" },
    dayBreakdownTitle: "Santapan hari itu",
    factors: { protein: "Protein", fibre: "Serat", sugar: "Gula", salt: "Garam" },
    startRow: "Awal",
    partPctOfKcal: "{n}% dari kcal",
    partGPer100Kcal: "{n}g per 100kcal",
    partMgSodiumPer100Kcal: "{n}mg natrium per 100kcal",
    partOfTargetG: "{n}g dari {target}g kamu",
    partOfTargetMg: "{n}mg dari {target}mg kamu",
    limits: { ldl: "kolesterol tinggi", kidneys: "penyakit ginjal", lowsugar: "risiko diabetes" },
  },
  ru: {
    title: "Оценка дня",
    mealTitle: "Оценка приёма пищи",
    outOf: "{n}/10",
    dayLabel: "Сегодня",
    method: "Из белка, клетчатки, насыщенных жиров, сахара и соли — на калорию.",
    notRead: "не считано",
    insufficient: "Недостаточно данных для оценки",
    notYet: "пока нет",
    todayTitle: "Оценка за сегодня: {n}/10",
    todayFromMeals: {
      one: "По сегодняшнему приёму пищи",
      few: "Из {n} сегодняшних приёмов пищи",
      many: "Из {n} сегодняшних приёмов пищи",
      other: "Из {n} сегодняшних приёмов пищи",
    },
    breakdownTitle: "Сегодняшние приёмы пищи",
    dayFromMeals: {
      one: "По единственному приёму пищи за день",
      few: "Из {n} приёмов пищи за день",
      many: "Из {n} приёмов пищи за день",
      other: "Из {n} приёмов пищи за день",
    },
    dayBreakdownTitle: "Приёмы пищи за день",
    factors: { protein: "Белок", fibre: "Клетчатка", sugar: "Сахар", salt: "Соль" },
    startRow: "База",
    partPctOfKcal: "{n}% от ккал",
    partGPer100Kcal: "{n}г на 100ккал",
    partMgSodiumPer100Kcal: "{n}мг натрия на 100ккал",
    partOfTargetG: "{n}г из твоих {target}г",
    partOfTargetMg: "{n}мг из твоих {target}мг",
    limits: { ldl: "высокий холестерин", kidneys: "заболевание почек", lowsugar: "риск диабета" },
  },
};

export const scoresAppCopy = (lang: Lang): ScoreAppCopy => t(lang)(SCORES_APP_COPY);

/**
 * A factor's name. Saturated fat's is the verdict pill's noun — reached through LOG_COPY's
 * `satfatNoun` (`verdictNoun` lives behind the i18n catalog), and the test pins the two equal.
 */
export function scoreFactorLabel(factor: ScoreFactor, lang: Lang): string {
  if (factor === "satfat") return logCopyFor(lang).satfatNoun;
  return t(lang)(SCORES_APP_COPY).factors[factor];
}
