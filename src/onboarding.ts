// Pure 2-step onboarding state machine (spec §7). No I/O — the bot persists `patch` + `nextState`
// and renders `reply`/`buttons`. Auto-approve: restrictions submitted/skipped -> active.
// Guards make every transition idempotent (a stale button tap resumes, it never resets progress).
//
// Copy comes from the caller's translator, so this file stays language-agnostic AND stays pure:
// `t` is a value passed in, not I/O. The LLM restriction fallback deliberately lives in tg_bot/bot.ts
// for the same reason — see processOnboarding.

import type { TFunction } from "i18next";
import { parseRestrictions } from "./targets.ts";
import type { Goal, UserState } from "./types.ts";

/** The only user fields onboarding reads. Structurally satisfied by db's UserRow. */
export interface OnboardingUser {
  state: UserState;
  goal: Goal | null;
  /** null = not asked yet; 0 = explicitly skipped; >0 = kilograms. */
  weight_kg: number | null;
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
  patch?: { consent_at?: string; goal?: Goal; weight_kg?: number; restrictions?: string[] };
  buttons?: InlineButton[][];
}

/**
 * "92", "92.5", "92,5 кг", "85kg" -> kilograms; null when unparseable or outside 30–300 kg
 * (outside that range it is far more likely a typo or lbs than a real bodyweight in kg).
 */
export function parseWeight(text: string): number | null {
  const m = text.replace(",", ".").match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const kg = Number(m[0]);
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
const restrictionButtons = (t: TFunction): InlineButton[][] => [
  [{ text: t("onboarding.button.skip"), data: "restrictions_skip" }],
];
const weightButtons = (t: TFunction): InlineButton[][] => [
  [{ text: t("onboarding.button.skip"), data: "weight_skip" }],
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

/** Resume: pick the right prompt for the user's current progress. */
function resume(u: OnboardingUser | undefined, t: TFunction): OnboardingResult {
  if (!u || u.state === "consent") return consent(t);
  if (u.state === "profile") {
    if (u.goal == null) return askGoal(t);
    // weight_kg 0 = skipped = answered; only null means the question is still open
    if (u.weight_kg == null) return askWeight(t);
    return askRestrictions(t);
  }
  return activeNudge(t);
}

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
        if (state !== "profile" || u?.goal == null || u.weight_kg != null) return resume(u, t);
        return {
          nextState: "profile",
          reply: t("onboarding.askRestrictions"),
          patch: { weight_kg: 0 }, // the explicit-skip sentinel: asked and declined
          buttons: restrictionButtons(t),
        };
      case "restrictions_skip":
        if (state !== "profile" || u?.goal == null || u.weight_kg == null) return resume(u, t);
        return { nextState: "active", reply: t("onboarding.done"), patch: { restrictions: [] } };
      default: {
        const goal = GOAL_FROM_DATA[input.data];
        if (goal) {
          if (state !== "profile" || u?.goal != null) return resume(u, t); // don't overwrite
          return {
            nextState: "profile",
            reply: t("onboarding.askWeight"),
            patch: { goal },
            buttons: weightButtons(t),
          };
        }
        return resume(u, t); // unknown callback -> re-prompt current step
      }
    }
  }

  // input.type === "text"
  if (state === "profile" && u?.goal != null && u.weight_kg == null) {
    // the weight free-text step
    const kg = parseWeight(input.text);
    if (kg == null) return askWeight(t, "onboarding.weightInvalid");
    return {
      nextState: "profile",
      reply: t("onboarding.askRestrictions"),
      patch: { weight_kg: kg },
      buttons: restrictionButtons(t),
    };
  }
  if (state === "profile" && u?.goal != null) {
    // the restrictions free-text step
    return {
      nextState: "active",
      reply: t("onboarding.done"),
      patch: { restrictions: parseRestrictions(input.text) },
    };
  }
  if (state === "profile") return askGoal(t); // still need a goal (via button)
  if (state === "active") return activeNudge(t);
  return { nextState: "consent", reply: t("onboarding.nudge"), buttons: consentButtons(t) };
}
