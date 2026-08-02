// The engine's return types. Data, never rendered strings.
//
// THE WHOLE POINT OF THIS FILE. `bot.ts`'s `process*` functions took a `send` callback and emitted
// i18n-rendered Telegram text, which made the product logic unusable by anything that is not
// Telegram. An engine result says WHAT happened; the surface decides how to say it — `t()` plus an
// inline keyboard for the bot, JSON for the mobile app. No `t`, no `TFunction`, no locale, and no
// message ids reach this layer.
//
// `hint` is a CODE, not copy, for exactly that reason: `"lowConfidence"` resolves to a Telegram
// string in `reply.ts` and to whatever the mobile client wants, and neither has to agree with the
// other about wording.

import type { DailyTotals, MealAnalysis } from "../types.ts";

/** Which correction nudge the surface should show under a logged meal. */
export type MealHint = "lowConfidence" | "correction";

/** A meal that reached the diary, with everything a card needs to render. */
export interface MealLogged {
  kind: "logged";
  mealId: string;
  analysis: MealAnalysis;
  /** Totals for the meal's OWN date — a re-dated or back-dated meal is not today's. */
  totals: DailyTotals;
  date: string;
  hint: MealHint;
}

/**
 * Why a request produced no meal. Each maps to one user-facing message, but the mapping lives in
 * the surface — `not-onboarded` is a Telegram onboarding prompt and a mobile signup screen.
 */
export type Refusal =
  | { kind: "not-onboarded" }
  /** The model looked and there was no food. Not an error — an answer. */
  | { kind: "not-food" }
  /** `scope` distinguishes "you have used your day" from "the instance has used its budget". */
  | { kind: "cap-exceeded"; scope: "user" | "global" }
  /** The engine failed to produce an analysis. Already logged; the surface just apologises. */
  | { kind: "analysis-failed" };

export type LogPhotoResult = MealLogged | Refusal;

/** A text meal awaiting confirmation. Nothing is in `meals` yet. */
export interface MealProposed {
  kind: "proposed";
  pendingId: string;
  analysis: MealAnalysis;
  /** The resolved calendar date, so the confirm prompt can NAME it — the misparse guard. */
  date: string;
}

export interface Answered {
  kind: "answered";
  /** Model prose in the user's language. Content, not copy — it passes through unrendered. */
  text: string;
}

export interface MealUpdated {
  kind: "updated";
  mealId: string;
  analysis: MealAnalysis;
  totals: DailyTotals;
  date: string;
}

export interface MealRedated {
  kind: "redated";
  mealId: string;
  analysis: MealAnalysis;
  totals: DailyTotals;
  date: string;
}

/**
 * A correction or re-date whose target vanished between lookup and write (a /delete race).
 *
 * `on` is NOT decoration: the two carry different guidance. A failed correction can be rephrased;
 * a failed re-date cannot — nothing the user types brings a deleted row back, so telling them to
 * try again would be a lie. Collapsing them lost that distinction and a test caught it.
 */
export interface TargetGone {
  kind: "target-gone";
  on: "correction" | "redate";
}

/**
 * An edit whose target the MODEL worked out, waiting for the user to approve it.
 *
 * A reply-based edit applies immediately — pointing at a card is unambiguous. This one is not: the
 * agent read the sentence, searched the diary and chose. So it gets the same confirm-first
 * treatment a text meal gets, and for the same reason — the card names the meal it is about to
 * change, which is the misparse guard.
 *
 * `current` and `proposed` are both carried so a surface can show what actually changes rather
 * than only the end state. For a re-date they are equal: macros never move, only the day.
 */
export interface EditProposed {
  kind: "edit-proposed";
  pendingId: string;
  edit: "correction" | "redate";
  mealId: string;
  current: MealAnalysis;
  proposed: MealAnalysis;
  /** The meal's date now. */
  date: string;
  /** Where it would end up. Equal to `date` for a correction. */
  newDate: string;
}

/** One meal offered as a possible target, with enough on it to tell two similar meals apart. */
export interface MealChoice {
  mealId: string;
  date: string;
  /** Local time of day, `HH:MM`. Empty when the stored timestamp is unparseable. */
  time: string;
  items: string[];
  kcal: number;
}

/**
 * The agent found several meals the message could be about and refused to pick.
 *
 * It carries no edit, deliberately. The user's tap replays their ORIGINAL message with the chosen
 * meal in focus, so the second pass is an ordinary unambiguous edit rather than a half-finished one
 * this layer would have to keep in step.
 */
export interface MealChoiceNeeded {
  kind: "choose-meal";
  pendingId: string;
  /** Model prose — content, not copy, like `Answered.text`. */
  question: string;
  candidates: MealChoice[];
}

export type HandleTextResult =
  | Answered
  | MealProposed
  | MealUpdated
  | MealRedated
  | EditProposed
  | MealChoiceNeeded
  | TargetGone
  | Refusal;

/** What became of a pending edit the user tapped Apply on. */
export type ApplyEditResult = MealUpdated | MealRedated | { kind: "expired" } | TargetGone | Refusal;

export type ConfirmMealResult = MealLogged | { kind: "expired" } | Refusal;

/** True when the result carries a meal the surface should render as a card. */
export const isMeal = (r: { kind: string }): r is MealLogged | MealUpdated | MealRedated =>
  r.kind === "logged" || r.kind === "updated" || r.kind === "redated";
