// The words on a verdict pill.
//
// HERE RATHER THAN IN `types.ts`, and the reason is a cycle: `lang.ts` imports `LANGS` from
// `types.ts`, so `types.ts` cannot import `Localized` back without the two depending on each other.
// The vocabulary (`VerdictDimension`, `Verdict`, `renderableVerdicts`) stays there, where both sides
// read it; only the words moved, which is the split #358 makes everywhere else too.

import { i18nFor } from "./i18n.ts";
import type { I18n } from "@lingui/core";
import { renderableVerdicts, type Lang, type Verdict, type VerdictDimension, type VerdictLabel } from "./types.ts";


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
 * The MID-SENTENCE noun — "calories", not "Calories" — for the inline form below.
 *
 * A separate set of keys rather than the pill's noun lowered, because case is a language's
 * decision, not a string operation: German keeps "Kalorien" capitalised wherever the word sits,
 * and a client that called `.toLowerCase()` on the pill's word would be wrong there while looking
 * right in English. Each catalog carries its own inline noun, so no client ever cases a word.
 */
const INLINE_NOUN: Record<VerdictDimension, (i18n: I18n) => string> = {
  weight: (i18n) => i18n._("verdict.noun.inline.weight", undefined, { message: "calories" }),
  ldl: (i18n) => i18n._("verdict.noun.inline.ldl", undefined, { message: "saturated fat" }),
  kidneys: (i18n) => i18n._("verdict.noun.inline.kidneys", undefined, { message: "sodium" }),
};

// Warn and bad only. A diary row speaks when the meal is NOT on plan — a meal whose every verdict
// is good shows its time alone, so `verdict.inline.good` does not exist.
const INLINE: Record<Exclude<Verdict, "good">, (i18n: I18n, noun: string) => string> = {
  warn: (i18n, noun) => i18n._("verdict.inline.warn", { noun }, { message: "{noun} high" }),
  bad: (i18n, noun) => i18n._("verdict.inline.bad", { noun }, { message: "{noun} very high" }),
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

/**
 * The noun alone — "Saturated fat", "Sodium" — for a surface that names what is capped rather than
 * how a meal scored. The /start plan's marker row reads it, so the cap and the verdict that judges
 * against it can never spell the nutrient two ways.
 */
export function verdictNoun(dimension: VerdictDimension, lang: Lang): string {
  return NOUN[dimension](i18nFor(lang));
}

/**
 * The INLINE noun alone — `verdictInlineLabel`'s first word with no verdict — mid-sentence case
 * ("saturated fat"). Home's day note names the constraining nutrient inside a sentence, where
 * the standalone noun's capital would sit wrong (`"{grams} g of {nutrient} to go"`, F's `.hnote`).
 */
export function verdictInlineNoun(dimension: VerdictDimension, lang: Lang): string {
  return INLINE_NOUN[dimension](i18nFor(lang));
}

/**
 * One verdict inside a diary row — "calories high", "saturated fat very high" — the pill's words
 * in mid-sentence case. `verdict.bad` stays "very high" everywhere it already reads: `bad` is a
 * share of the day's allowance (`shareVerdict`), never a claim that the plan was exceeded.
 */
export function verdictInlineLabel(
  dimension: VerdictDimension,
  verdict: Exclude<Verdict, "good">,
  lang: Lang,
): string {
  const i18n = i18nFor(lang);
  return INLINE[verdict](i18n, INLINE_NOUN[dimension](i18n));
}

/**
 * The verdict half of a diary row: every verdict that is not on plan, joined by " · ", in pill
 * order — "calories high · saturated fat very high". The row itself is the time, then this.
 *
 * Empty when every verdict is on plan (the row shows its time alone) or when nothing here is a
 * verdict this build knows — `renderableVerdicts` does the dropping, same as the pills.
 */
export function verdictInlineText(verdicts: unknown, lang: Lang): string {
  const v = verdicts as Partial<Record<VerdictDimension, Verdict>>;
  const segments: string[] = [];
  for (const d of renderableVerdicts(verdicts)) {
    const verdict = v[d];
    if (verdict === "warn" || verdict === "bad") segments.push(verdictInlineLabel(d, verdict, lang));
  }
  return segments.join(" · ");
}

/**
 * The pills' words for a meal payload — `{dimension, tone, label}` per visible verdict, in render
 * order, `good` pills included: the proposal card's "on plan" rows are pills too. Composed where
 * the verdict is computed; the bundle that draws them holds no catalog to call `verdictPillLabel`
 * itself (`deploy/Dockerfile.web` builds with no `node_modules`).
 */
export function verdictLabels(verdicts: unknown, lang: Lang): VerdictLabel[] {
  const v = verdicts as Partial<Record<VerdictDimension, Verdict>>;
  return renderableVerdicts(verdicts).map((d) => ({ dimension: d, tone: v[d]!, label: verdictPillLabel(d, v[d]!, lang) }));
}
