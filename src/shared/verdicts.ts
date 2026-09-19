// The words on a verdict pill.
//
// HERE RATHER THAN IN `types.ts`, and the reason is a cycle: `lang.ts` imports `LANGS` from
// `types.ts`, so `types.ts` cannot import `Localized` back without the two depending on each other.
// The vocabulary (`VerdictDimension`, `Verdict`, `renderableVerdicts`) stays there, where both sides
// read it; only the words moved, which is the split #358 makes everywhere else too.

import { i18nFor } from "./i18n.ts";
import type { I18n } from "@lingui/core";
import type { Lang, Verdict, VerdictDimension } from "./types.ts";


/**
 * ADJECTIVES ARE AVOIDED ON PURPOSE OUTSIDE ENGLISH.
 *
 * "Sodium high" has three nouns behind it — calories, saturated fats, sodium — of two genders and
 * two numbers in every Romance language, and an adjective agreeing with all of them is three
 * strings per verdict rather than one. So the translations use an invariable phrase ("au-dessus",
 * "sopra", "por encima", "hoch" predicatively, "много"), which is both shorter and correct. That is
 * an adaptation rather than a calque, and it is the kind #358 asks for.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * EVERY ID IS A LITERAL, and that is a requirement rather than a style.
 *
 * `lingui extract` reads the SOURCE. An id built at runtime — `verdict.noun.${dimension}` — is a
 * message the extractor cannot see, so it never reaches a catalog and never reaches a translator,
 * and the only symptom is an English word on a card. So the descriptors are spelled out one per
 * message, keyed by the same union the callers use, and `Record<VerdictDimension, …>` is what makes
 * forgetting one a compile error rather than a gap in a `.po` nobody diffs.
 *
 * The English lives HERE, in `message`, not in `en.po` — the source locale is the code, and the
 * catalog for it is generated. That keeps the sentence next to the rule it describes, which is the
 * property `AGENTS.md` asks for and the one a bundle of JSON gives up.
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 */
const NOUN: Record<VerdictDimension, (i18n: I18n) => string> = {
  weight: (i18n) => i18n._("verdict.noun.weight", undefined, { message: "Calories" }),
  ldl: (i18n) => i18n._("verdict.noun.ldl", undefined, { message: "Saturated fat" }),
  kidneys: (i18n) => i18n._("verdict.noun.kidneys", undefined, { message: "Sodium" }),
};

const PILL: Record<Verdict, (i18n: I18n, noun: string) => string> = {
  good: (i18n, noun) => i18n._("verdict.good", { noun }, { message: "{noun} on plan" }),
  warn: (i18n, noun) => i18n._("verdict.warn", { noun }, { message: "{noun} high" }),
  bad: (i18n, noun) => i18n._("verdict.bad", { noun }, { message: "{noun} very high" }),
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
  const i18n = i18nFor(lang);
  // The noun is resolved FIRST and passed as a VALUE, so each language's template keeps its own
  // word order — Russian puts a dash where English puts nothing, and neither is built here.
  return PILL[verdict](i18n, NOUN[dimension](i18n));
}
