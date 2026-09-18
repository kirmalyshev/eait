// The words on a verdict pill.
//
// HERE RATHER THAN IN `types.ts`, and the reason is a cycle: `lang.ts` imports `LANGS` from
// `types.ts`, so `types.ts` cannot import `Localized` back without the two depending on each other.
// The vocabulary (`VerdictDimension`, `Verdict`, `renderableVerdicts`) stays there, where both sides
// read it; only the words moved, which is the split #358 makes everywhere else too.

import { t, type Localized } from "./lang.ts";
import type { Lang, Verdict, VerdictDimension } from "./types.ts";

interface VerdictCopy {
  /** What a dimension is called on a card. */
  noun: Record<VerdictDimension, string>;
  /** `{noun}`, and the verdict IN WORDS. */
  good: string;
  warn: string;
  bad: string;
}

/**
 * ADJECTIVES ARE AVOIDED ON PURPOSE OUTSIDE ENGLISH.
 *
 * "Sodium high" has three nouns behind it — calories, saturated fats, sodium — of two genders and
 * two numbers in every Romance language, and an adjective agreeing with all of them is three
 * strings per verdict rather than one. So the translations use an invariable phrase ("au-dessus",
 * "sopra", "por encima", "hoch" predicatively, "много"), which is both shorter and correct. That is
 * an adaptation rather than a calque, and it is the kind #358 asks for.
 */
// EXPORTED, and that is not tidiness. `localizedGaps` walks `import * as shared` — a table nothing
// exports is a table it cannot see, which is the one way a language is lost quietly, and these are
// the words on every meal card the phone and Telegram draw.
export const VERDICT_COPY: Localized<VerdictCopy> = {
  en: {
    noun: { weight: "Calories", ldl: "Saturated fat", kidneys: "Sodium" },
    good: "{noun} on plan", warn: "{noun} high", bad: "{noun} very high",
  },
  fr: {
    noun: { weight: "Calories", ldl: "Graisses saturées", kidneys: "Sodium" },
    good: "{noun} — dans le plan", warn: "{noun} — au-dessus", bad: "{noun} — bien au-dessus",
  },
  de: {
    noun: { weight: "Kalorien", ldl: "Gesättigte Fette", kidneys: "Natrium" },
    good: "{noun} — im Plan", warn: "{noun} — hoch", bad: "{noun} — sehr hoch",
  },
  it: {
    noun: { weight: "Calorie", ldl: "Grassi saturi", kidneys: "Sodio" },
    good: "{noun} — nel piano", warn: "{noun} — sopra", bad: "{noun} — molto sopra",
  },
  es: {
    noun: { weight: "Calorías", ldl: "Grasas saturadas", kidneys: "Sodio" },
    good: "{noun} — en el plan", warn: "{noun} — por encima", bad: "{noun} — muy por encima",
  },
  vi: {
    noun: { weight: "Calo", ldl: "Chất béo bão hoà", kidneys: "Natri" },
    good: "{noun} — đúng kế hoạch", warn: "{noun} — hơi cao", bad: "{noun} — rất cao",
  },
  id: {
    noun: { weight: "Kalori", ldl: "Lemak jenuh", kidneys: "Natrium" },
    good: "{noun} — sesuai rencana", warn: "{noun} — tinggi", bad: "{noun} — sangat tinggi",
  },
  ru: {
    noun: { weight: "Калории", ldl: "Насыщенные жиры", kidneys: "Натрий" },
    good: "{noun} — в норме", warn: "{noun} — много", bad: "{noun} — очень много",
  },
};

/**
 * The words on a verdict pill — INCLUDING the verdict.
 *
 * The pill used to read "Calories" and carry good/warn/bad in its tint and a coloured dot. That is
 * the whole meaning of the row encoded in hue alone: a red/green colour blindness reads two
 * identically-worded pills, and VoiceOver reads "Calories" and stops. It also lands on a card
 * belonging to somebody who declared a medical restriction, which is the audience least able to
 * afford guessing.
 *
 * Worded from `shareVerdict`'s thresholds — a share of the day's allowance, not a claim about the
 * food itself. "high" is about this meal's place in the day, which is the only thing this product
 * measures, and every translation keeps that scope rather than saying the food is high in anything.
 */
export function verdictPillLabel(
  dimension: VerdictDimension,
  verdict: Verdict,
  lang: Lang,
): string {
  const copy = t(lang)(VERDICT_COPY);
  const template = verdict === "good" ? copy.good : verdict === "warn" ? copy.warn : copy.bad;
  return template.replace("{noun}", copy.noun[dimension]);
}
