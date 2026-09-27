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

import { bmiCopy, type BmiCopy } from "./app/bmi-copy.ts";
import { scoresAppCopy, type ScoreAppCopy } from "./app/scores-copy.ts";
import { t, type CountForms, type Localized } from "./lang.ts";
import type { BmiRange, ScoreFactor } from "./scores.ts";
import type { Lang } from "./types.ts";
import { verdictNoun } from "./verdicts.ts";

export interface ScoresCopy extends ScoreAppCopy, BmiCopy {}

export const SCORES_COPY: Localized<ScoresCopy> = {
  en: {
    ...scoresAppCopy("en"),
    ...bmiCopy("en"),
  },
  fr: {
    ...scoresAppCopy("fr"),
    ...bmiCopy("fr"),
  },
  de: {
    ...scoresAppCopy("de"),
    ...bmiCopy("de"),
  },
  it: {
    ...scoresAppCopy("it"),
    ...bmiCopy("it"),
  },
  es: {
    ...scoresAppCopy("es"),
    ...bmiCopy("es"),
  },
  vi: {
    ...scoresAppCopy("vi"),
    ...bmiCopy("vi"),
  },
  id: {
    ...scoresAppCopy("id"),
    ...bmiCopy("id"),
  },
  ru: {
    ...scoresAppCopy("ru"),
    ...bmiCopy("ru"),
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
 * A BMI range as its own numbers — "below 18.5", "18.5–24.9", "30 and above". The implementation
 * and the templates live in `app/bmi-copy.ts` — the Lingui-free copy — and are re-exported here so
 * the score surface's one import keeps answering them.
 */
export { bmiRangeLabel } from "./app/bmi-copy.ts";
