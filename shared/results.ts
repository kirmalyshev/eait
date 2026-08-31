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

import type { DailyTotals, MealAnalysis, MealQuestion } from "./types.ts";
import { REFUSAL_STATUS } from "./contract.ts";

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
  /**
   * The one thing Spud would ask about this plate, when there is one worth asking.
   *
   * ABSENT is the normal case, and the surface must render nothing for it: the engine only asks
   * about a low-confidence plate, past an account's first meal, when the account could afford the
   * reply. The answer goes back through the ordinary text turn with this meal in focus, so the
   * chips are a shortcut for typing rather than a route of their own.
   */
  question?: MealQuestion;
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
  /**
   * The sample is spent and there is no entitlement. Not a cap: nothing resets at midnight. The
   * app answers it with the paywall, and `limits.sampleUsed` lets it do so before asking.
   */
  | { kind: "subscription-required" }
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

/**
 * True when the result is a refusal — the surface shows a message and logs nothing.
 *
 * Derived from the status map rather than listed again: the hand-written list shipped one kind
 * short, and a refusal it did not name left the server as a 200 with the refusal in the body.
 */
export const isRefusal = (r: { kind: string }): r is Refusal => Object.hasOwn(REFUSAL_STATUS, r.kind);
