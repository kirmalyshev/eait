// Pure 2-step onboarding state machine (spec §7). No I/O — the bot persists `patch` + `nextState`
// and renders `reply`/`buttons`. Auto-approve: restrictions submitted/skipped -> active.
// Guards make every transition idempotent (a stale button tap resumes, it never resets progress).

import { parseRestrictions } from "./targets.ts";
import type { Goal, UserState } from "./types.ts";

/** The only user fields onboarding reads. Structurally satisfied by db's UserRow. */
export interface OnboardingUser {
  state: UserState;
  goal: Goal | null;
}

export type OnboardingInput =
  | { type: "command"; command: "start" }
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

// ---------- copy (ru) ----------

const CONSENT_COPY =
  "Привет! Я анализирую фото твоей еды и считаю КБЖУ под твою цель.\n\n" +
  "Что важно знать:\n" +
  "• Я обрабатываю фото еды и твой профиль (цель, ограничения).\n" +
  "• Оценки — приблизительные, это не медицинский совет.\n" +
  "• Фото не хранятся: разбираю и сразу удаляю.\n" +
  "• Команда /delete стирает все твои данные.\n\n" +
  "Согласен обрабатывать эти данные?";

const DECLINE_COPY =
  "Без согласия не могу обрабатывать данные. Напиши /start, когда будешь готов.";

const ASK_GOAL = "Какая цель?";
const ASK_RESTRICTIONS =
  "Есть ограничения по здоровью или питанию? Напиши свободно (например: «почки, без сахара») или нажми «Пропустить».";
const DONE = "Готово — шли фото еды 📸";
const ALREADY_ACTIVE = "Ты уже настроен — просто шли фото еды 📸 (/me — профиль и итоги дня).";
const NUDGE_BUTTON = "Нажми кнопку выше или напиши /start.";

// ---------- buttons ----------

const CONSENT_BUTTONS: InlineButton[][] = [
  [{ text: "Согласен", data: "consent_agree" }],
  [{ text: "Отказ", data: "consent_decline" }],
];
const GOAL_BUTTONS: InlineButton[][] = [
  [
    { text: "Похудеть", data: "goal_lose" },
    { text: "Держать", data: "goal_maintain" },
    { text: "Набрать", data: "goal_gain" },
  ],
];
const RESTRICTION_BUTTONS: InlineButton[][] = [[{ text: "Пропустить", data: "restrictions_skip" }]];

const GOAL_FROM_DATA: Record<string, Goal> = {
  goal_lose: "lose",
  goal_maintain: "maintain",
  goal_gain: "gain",
};

// ---------- machine ----------

function askGoal(): OnboardingResult {
  return { nextState: "profile", reply: ASK_GOAL, buttons: GOAL_BUTTONS };
}
function askRestrictions(): OnboardingResult {
  return { nextState: "profile", reply: ASK_RESTRICTIONS, buttons: RESTRICTION_BUTTONS };
}
function consent(): OnboardingResult {
  return { nextState: "consent", reply: CONSENT_COPY, buttons: CONSENT_BUTTONS };
}
function activeNudge(): OnboardingResult {
  return { nextState: "active", reply: ALREADY_ACTIVE };
}

/** Resume: pick the right prompt for the user's current progress. */
function resume(u: OnboardingUser | undefined): OnboardingResult {
  if (!u || u.state === "consent") return consent();
  if (u.state === "profile") return u.goal == null ? askGoal() : askRestrictions();
  return activeNudge();
}

export function step(
  u: OnboardingUser | undefined,
  input: OnboardingInput,
  now: Date = new Date(),
): OnboardingResult {
  const state = u?.state ?? "consent";

  if (input.type === "command" && input.command === "start") {
    return resume(u); // /start always resumes from wherever the user is
  }

  if (input.type === "callback") {
    switch (input.data) {
      case "consent_agree":
        if (state !== "consent") return resume(u); // idempotent: already past consent
        return {
          nextState: "profile",
          reply: ASK_GOAL,
          patch: { consent_at: now.toISOString() },
          buttons: GOAL_BUTTONS,
        };
      case "consent_decline":
        if (state !== "consent") return resume(u);
        return { nextState: "consent", reply: DECLINE_COPY };
      case "restrictions_skip":
        if (state !== "profile" || u?.goal == null) return resume(u);
        return { nextState: "active", reply: DONE, patch: { restrictions: [] } };
      default: {
        const goal = GOAL_FROM_DATA[input.data];
        if (goal) {
          if (state !== "profile" || u?.goal != null) return resume(u); // don't overwrite
          return { nextState: "profile", reply: ASK_RESTRICTIONS, patch: { goal }, buttons: RESTRICTION_BUTTONS };
        }
        return resume(u); // unknown callback -> re-prompt current step
      }
    }
  }

  // input.type === "text"
  if (state === "profile" && u?.goal != null) {
    // the restrictions free-text step
    return {
      nextState: "active",
      reply: DONE,
      patch: { restrictions: parseRestrictions(input.text) },
    };
  }
  if (state === "profile") return askGoal(); // still need a goal (via button)
  if (state === "active") return activeNudge();
  return { nextState: "consent", reply: NUDGE_BUTTON, buttons: CONSENT_BUTTONS };
}
