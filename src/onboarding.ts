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
  patch?: { consent_at?: string; goal?: Goal; restrictions?: string[] };
  buttons?: InlineButton[][];
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

const GOAL_FROM_DATA: Record<string, Goal> = {
  goal_lose: "lose",
  goal_maintain: "maintain",
  goal_gain: "gain",
};

// ---------- machine ----------

function askGoal(t: TFunction): OnboardingResult {
  return { nextState: "profile", reply: t("onboarding.askGoal"), buttons: goalButtons(t) };
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
  if (u.state === "profile") return u.goal == null ? askGoal(t) : askRestrictions(t);
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
      case "restrictions_skip":
        if (state !== "profile" || u?.goal == null) return resume(u, t);
        return { nextState: "active", reply: t("onboarding.done"), patch: { restrictions: [] } };
      default: {
        const goal = GOAL_FROM_DATA[input.data];
        if (goal) {
          if (state !== "profile" || u?.goal != null) return resume(u, t); // don't overwrite
          return {
            nextState: "profile",
            reply: t("onboarding.askRestrictions"),
            patch: { goal },
            buttons: restrictionButtons(t),
          };
        }
        return resume(u, t); // unknown callback -> re-prompt current step
      }
    }
  }

  // input.type === "text"
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
