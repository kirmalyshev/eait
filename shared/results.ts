// The engine's return types. Data, never rendered strings.
//
// Ported from `eait/src/engine/results.ts`, whose header explains why it exists: the bot's
// handlers used to take a `send` callback and emit i18n-rendered Telegram text, which made the
// product logic unusable by anything that is not Telegram. An engine result says WHAT happened;
// the surface decides how to say it. That refactor is the only reason this app could be built at
// all, and its comment already named this client — "JSON for the mobile app".
//
// `hint` is a CODE, not copy, for exactly that reason: `"lowConfidence"` resolves to one string in
// the bot and another in this app, and neither has to agree with the other about wording.

import type { DailyTotals, MealAnalysis } from "./types.ts";

/** Which correction nudge the surface should show under a logged meal. */
export type MealHint = "lowConfidence" | "correction";

/** A meal that reached the diary, with everything a card needs to render. */
export interface MealLogged {
  kind: "logged";
  mealId: string;
  analysis: MealAnalysis;
  /** Totals for the meal's OWN date — a back-dated meal is not today's. */
  totals: DailyTotals;
  date: string;
  hint: MealHint;
}

/**
 * Why a request produced no meal. Each maps to one user-facing message, but the mapping lives in
 * the surface — `not-onboarded` is a Telegram prompt in the bot and a navigation push here.
 */
export type Refusal =
  | { kind: "not-onboarded" }
  /** The model looked and there was no food. Not an error — an answer. */
  | { kind: "not-food" }
  /**
   * `scope` distinguishes "you have used your day" from "the instance has used its budget" from
   * "this network address has".
   *
   * `address` is not a spend cap, it is the thing that makes the other two mean anything. Minting
   * an account is one unauthenticated request, so a per-user allowance is only a limit if there is
   * also a limit on how many users one address may spend through. Worded differently in the app,
   * because "your allowance is gone" would be a lie told to somebody who has logged one meal from
   * a carrier network.
   */
  | { kind: "cap-exceeded"; scope: "user" | "global" | "address" }
  /** The engine failed to produce an analysis. Already logged; the surface just apologises. */
  | { kind: "analysis-failed" };

export type LogPhotoResult = MealLogged | Refusal;

/** A text meal awaiting confirmation. Nothing is in the diary yet. */
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
  /** How the change was made. `manual` = the user edited numbers; `nl` = they described the fix. */
  via: "manual" | "nl";
}

/**
 * A correction whose target vanished between lookup and write (a delete race).
 *
 * `on` is not decoration: a failed correction can be rephrased, a failed re-date cannot — nothing
 * the user types brings a deleted row back, so telling them to try again would be a lie.
 */
export interface TargetGone {
  kind: "target-gone";
  on: "correction" | "redate";
}

export interface MealRedated {
  kind: "redated";
  mealId: string;
  analysis: MealAnalysis;
  totals: DailyTotals;
  date: string;
}

export type HandleTextResult =
  | Answered
  | MealProposed
  | MealUpdated
  | MealRedated
  | TargetGone
  | Refusal;

export type ConfirmMealResult = MealLogged | { kind: "expired" } | Refusal;

/** True when the result carries a meal the surface should render as a card. */
export const isMeal = (r: { kind: string }): r is MealLogged | MealUpdated | MealRedated =>
  r.kind === "logged" || r.kind === "updated" || r.kind === "redated";

/** True when the result is a refusal — the surface shows a message and logs nothing. */
export const isRefusal = (r: { kind: string }): r is Refusal =>
  r.kind === "not-onboarded" || r.kind === "not-food" ||
  r.kind === "cap-exceeded" || r.kind === "analysis-failed";
