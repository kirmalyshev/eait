// Pure onboarding state machine (spec §7). No I/O — the bot persists `patch` + `nextState`
// and renders `reply`/`buttons`. Auto-approve: restrictions submitted/skipped -> active.
// Guards make every transition idempotent (a stale button tap resumes, it never resets progress).
//
// Flow after consent: goal -> current weight -> target weight -> country -> restrictions -> active.
// The restrictions step feeds TWO fields from its single free-text answer: `restrictions` (the
// closed tag vocabulary, via parseRestrictions) and `limitations` (the raw words, via
// parseLimitations). No step was added for the latter — the question was already free text.
// Each field's step is derived from which fields are still null; a skip stores a sentinel (0 for
// weights, '' for country) so "answered" is distinguishable from "never asked" on every resume.
// `limitations` rides along on the restrictions answer and is NOT a step-gating field — the flow
// derives no step from it, so its '' sentinel is written for consistency, not for resumption.
//
// Copy comes from the caller's translator, so this file stays language-agnostic AND stays pure:
// `t` is a value passed in, not I/O. The LLM restriction fallback deliberately lives in tg_bot/bot.ts
// for the same reason — see processOnboarding.

import type { TFunction } from "i18next";
import { parseRestrictions } from "./targets.ts";
import { parseLimitations } from "./limitations.ts";
import { countryCodeRows, countryLabel, isCountryCode, parseCountry } from "./country.ts";
import type { Goal, UserState } from "./types.ts";

/** The only user fields onboarding reads. Structurally satisfied by db's UserRow. */
export interface OnboardingUser {
  state: UserState;
  goal: Goal | null;
  /** null = not asked yet; 0 = explicitly skipped; >0 = kilograms. */
  weight_kg: number | null;
  /** Same sentinel as weight_kg: null = not asked, 0 = skipped, >0 = target kilograms. */
  target_weight_kg: number | null;
  /** null = not asked; '' = skipped; else a curated code or a raw "other" string. */
  country: string | null;
}

export type OnboardingInput =
  | { type: "command"; command: "start"; payload?: string } // t.me deep-link start payload, if any
  | { type: "callback"; data: string }
  | { type: "text"; text: string };

export interface InlineButton {
  text: string;
  data: string;
}

export interface OnboardingResult {
  nextState: UserState;
  reply: string;
  patch?: {
    consent_at?: string;
    goal?: Goal;
    weight_kg?: number;
    target_weight_kg?: number;
    country?: string;
    restrictions?: string[];
    /** The restrictions answer kept VERBATIM (normalized), alongside the tags parsed from it.
     * '' is the explicit-skip sentinel — persist with `!== undefined`, never a truthiness check. */
    limitations?: string;
  };
  buttons?: InlineButton[][];
}

/**
 * "92", "92.5", "92,5 кг", "85kg" -> kilograms; "180 lbs" is converted, not mistaken for kg.
 * null when unparseable or outside 30–300 kg (outside that range it is far more likely a typo
 * than a real bodyweight). The FIRST number wins ("92 kg yesterday 80" -> 92).
 */
const LB_PER_KG = 0.45359237;

export function parseWeight(text: string): number | null {
  const m = text.replace(",", ".").match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  let kg = Number(m[0]);
  // A pounds suffix converts; a bare number is trusted as kg (the echo in the reply is the
  // safety net for someone who typed pounds without saying so).
  // Unit anchored to a digit ("180 lbs", "200lb") — a bare \b misses "200lb" (digit→letter
  // is not a word boundary) and a free-floating match would fire on words containing "lb".
  if (/\d\s*(lbs?|pounds?|фунт\w*)\b/i.test(text)) kg = Math.round(kg * LB_PER_KG * 10) / 10;
  return kg >= 30 && kg <= 300 ? kg : null;
}

// ---------- buttons ----------

const consentButtons = (t: TFunction): InlineButton[][] => [
  [{ text: t("onboarding.button.agree"), data: "consent_agree" }],
  [{ text: t("onboarding.button.decline"), data: "consent_decline" }],
];
const goalButtons = (t: TFunction): InlineButton[][] => [
  [
    { text: t("onboarding.button.goalLose"), data: "goal_lose" },
    { text: t("onboarding.button.goalMaintain"), data: "goal_maintain" },
    { text: t("onboarding.button.goalGain"), data: "goal_gain" },
  ],
];
// A lone Skip button carrying the step's skip callback — every skippable step's whole keyboard,
// and the only affordance while typing a free-text "Other" country.
const skipButtons = (data: string, t: TFunction): InlineButton[][] => [
  [{ text: t("onboarding.button.skip"), data }],
];
const restrictionButtons = (t: TFunction): InlineButton[][] => skipButtons("restrictions_skip", t);
const weightButtons = (t: TFunction): InlineButton[][] => skipButtons("weight_skip", t);
const targetWeightButtons = (t: TFunction): InlineButton[][] => skipButtons("target_weight_skip", t);
const countrySkipButtons = (t: TFunction): InlineButton[][] => skipButtons("country_skip", t);

// Curated country picker: shared chunked rows + an Other/Skip row.
const countryButtons = (t: TFunction): InlineButton[][] => [
  ...countryCodeRows(t, (c) => `country_${c}`),
  [
    { text: t("onboarding.button.countryOther"), data: "country_other" },
    { text: t("onboarding.button.skip"), data: "country_skip" },
  ],
];

const GOAL_FROM_DATA: Record<string, Goal> = {
  goal_lose: "lose",
  goal_maintain: "maintain",
  goal_gain: "gain",
};

// ---------- machine ----------

function askGoal(t: TFunction): OnboardingResult {
  return { nextState: "profile", reply: t("onboarding.askGoal"), buttons: goalButtons(t) };
}
function askWeight(
  t: TFunction,
  reply: "onboarding.askWeight" | "onboarding.weightInvalid" = "onboarding.askWeight",
): OnboardingResult {
  return { nextState: "profile", reply: t(reply), buttons: weightButtons(t) };
}
function askTargetWeight(
  t: TFunction,
  reply: "onboarding.askTargetWeight" | "onboarding.targetWeightInvalid" = "onboarding.askTargetWeight",
): OnboardingResult {
  return { nextState: "profile", reply: t(reply), buttons: targetWeightButtons(t) };
}
function askCountry(
  t: TFunction,
  reply: "onboarding.askCountry" | "onboarding.countryInvalid" = "onboarding.askCountry",
): OnboardingResult {
  return { nextState: "profile", reply: t(reply), buttons: countryButtons(t) };
}
function askRestrictions(t: TFunction): OnboardingResult {
  return {
    nextState: "profile",
    reply: t("onboarding.askRestrictions"),
    buttons: restrictionButtons(t),
  };
}
function consent(t: TFunction): OnboardingResult {
  return { nextState: "consent", reply: t("onboarding.consent"), buttons: consentButtons(t) };
}
function activeNudge(t: TFunction): OnboardingResult {
  return { nextState: "active", reply: t("onboarding.alreadyActive") };
}

/** Resume: pick the right prompt for the user's current progress. Order = the flow order; each
 * sentinel (weight/target 0, country '') counts as answered, so only null re-opens a question. */
function resume(u: OnboardingUser | undefined, t: TFunction): OnboardingResult {
  if (!u || u.state === "consent") return consent(t);
  if (u.state === "profile") {
    if (u.goal == null) return askGoal(t);
    if (u.weight_kg == null) return askWeight(t);
    if (u.target_weight_kg == null) return askTargetWeight(t);
    if (u.country == null) return askCountry(t);
    return askRestrictions(t);
  }
  return activeNudge(t);
}

// Step-open predicates: true only when that question is the current one. Each requires every
// EARLIER field answered and its OWN still null, so a stale tap for a later step resumes instead.
const weightOpen = (u: OnboardingUser | undefined): boolean =>
  u?.state === "profile" && u.goal != null && u.weight_kg == null;
const targetOpen = (u: OnboardingUser | undefined): boolean =>
  u?.state === "profile" && u.goal != null && u.weight_kg != null && u.target_weight_kg == null;
const countryOpen = (u: OnboardingUser | undefined): boolean =>
  u?.state === "profile" &&
  u.goal != null &&
  u.weight_kg != null &&
  u.target_weight_kg != null &&
  u.country == null;
const restrictionsOpen = (u: OnboardingUser | undefined): boolean =>
  u?.state === "profile" &&
  u.goal != null &&
  u.weight_kg != null &&
  u.target_weight_kg != null &&
  u.country != null;

export function step(
  u: OnboardingUser | undefined,
  input: OnboardingInput,
  t: TFunction,
  now: Date = new Date(),
): OnboardingResult {
  const state = u?.state ?? "consent";

  // Narrow on `input.type` alone: a compound guard (`type === "command" && command === "start"`)
  // leaves `{type:"command"}` in the union on the false branch, so `input.text` below would not
  // typecheck. `command` has only one member today, so this is equivalent at runtime.
  if (input.type === "command") {
    return resume(u, t); // /start always resumes from wherever the user is
  }

  if (input.type === "callback") {
    switch (input.data) {
      case "consent_agree":
        if (state !== "consent") return resume(u, t); // idempotent: already past consent
        return {
          nextState: "profile",
          reply: t("onboarding.askGoal"),
          patch: { consent_at: now.toISOString() },
          buttons: goalButtons(t),
        };
      case "consent_decline":
        if (state !== "consent") return resume(u, t);
        return { nextState: "consent", reply: t("onboarding.decline") };
      case "weight_skip":
        // Only meaningful while the weight question is open — a stale tap resumes instead.
        if (!weightOpen(u)) return resume(u, t);
        return {
          ...askTargetWeight(t),
          patch: { weight_kg: 0 }, // the explicit-skip sentinel: asked and declined
        };
      case "target_weight_skip":
        if (!targetOpen(u)) return resume(u, t);
        return { ...askCountry(t), patch: { target_weight_kg: 0 } };
      case "country_skip":
        if (!countryOpen(u)) return resume(u, t);
        return { ...askRestrictions(t), patch: { country: "" } }; // '' = asked and declined
      case "country_other":
        // Nudge to type a country; store nothing so the next text is captured as the answer. A
        // lone Skip (not the whole picker again) — matches the minimal /settings "Other" prompt.
        if (!countryOpen(u)) return resume(u, t);
        return { nextState: "profile", reply: t("onboarding.countryOther"), buttons: countrySkipButtons(t) };
      case "restrictions_skip":
        if (!restrictionsOpen(u)) return resume(u, t);
        // '' = asked and declined, the same sentinel country uses.
        return {
          nextState: "active",
          reply: t("onboarding.done"),
          patch: { restrictions: [], limitations: "" },
        };
      default: {
        const goal = GOAL_FROM_DATA[input.data];
        if (goal) {
          if (state !== "profile" || u?.goal != null) return resume(u, t); // don't overwrite
          return { ...askWeight(t), patch: { goal } };
        }
        // A curated country button (`country_de`, …). Unknown codes fall through to a re-prompt.
        if (input.data.startsWith("country_")) {
          const code = input.data.slice("country_".length);
          if (countryOpen(u) && isCountryCode(code)) {
            return {
              nextState: "profile",
              reply: t("onboarding.countrySaved", { country: countryLabel(code, t) }) +
                "\n\n" + t("onboarding.askRestrictions"),
              patch: { country: code },
              buttons: restrictionButtons(t),
            };
          }
        }
        return resume(u, t); // unknown callback -> re-prompt current step
      }
    }
  }

  // input.type === "text" — routed to whichever profile question is currently open.
  if (weightOpen(u)) {
    const kg = parseWeight(input.text);
    if (kg == null) return askWeight(t, "onboarding.weightInvalid");
    return {
      nextState: "profile",
      // Echo the parsed value: a misparse (pounds typed as a bare number, a typo) must be
      // visible and correctable, not silently stored.
      reply: t("onboarding.weightSaved", { kg }) + "\n\n" + t("onboarding.askTargetWeight"),
      patch: { weight_kg: kg },
      buttons: targetWeightButtons(t),
    };
  }
  if (targetOpen(u)) {
    const kg = parseWeight(input.text);
    if (kg == null) return askTargetWeight(t, "onboarding.targetWeightInvalid");
    return {
      nextState: "profile",
      reply: t("onboarding.targetWeightSaved", { kg }) + "\n\n" + t("onboarding.askCountry"),
      patch: { target_weight_kg: kg },
      buttons: countryButtons(t),
    };
  }
  if (countryOpen(u)) {
    const country = parseCountry(input.text);
    if (country == null) return askCountry(t, "onboarding.countryInvalid");
    return {
      nextState: "profile",
      reply: t("onboarding.countrySaved", { country: countryLabel(country, t) }) +
        "\n\n" + t("onboarding.askRestrictions"),
      patch: { country }, // stored raw ("other"); a typed code is not force-canonicalized
      buttons: restrictionButtons(t),
    };
  }
  if (restrictionsOpen(u)) {
    // The one question feeds BOTH fields: the closed vocabulary takes what it can classify
    // (tags → numeric caps + structured verdicts), and the raw words are kept as free-text
    // limitations for the prompt. Before this, anything outside the four tags — "no peanuts",
    // "gastritis" — was parsed to nothing and thrown away.
    return {
      nextState: "active",
      reply: t("onboarding.done"),
      patch: {
        restrictions: parseRestrictions(input.text),
        // ?? "": an answer that normalizes to nothing is still an ANSWER, and must land as the
        // skip sentinel rather than re-opening the question forever.
        limitations: parseLimitations(input.text) ?? "",
      },
    };
  }
  if (state === "profile") return askGoal(t); // still need a goal (via button)
  if (state === "active") return activeNudge(t);
  return { nextState: "consent", reply: t("onboarding.nudge"), buttons: consentButtons(t) };
}
