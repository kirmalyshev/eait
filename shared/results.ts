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
  | { kind: "analysis-failed" }
  /** The upload is not a JPEG, PNG or WebP. Refused before anything is charged. */
  | { kind: "unsupported-image" }
  /** A re-analysis of a meal that has no stored photo. */
  | { kind: "no-photo" };

export type LogPhotoResult = MealLogged | Refusal;

/** A text meal awaiting confirmation. Nothing is in the diary yet. */
export interface MealProposed {
  kind: "proposed";
  pendingId: string;
  analysis: MealAnalysis;
  /** The resolved calendar date, so the confirm prompt can NAME it — the misparse guard. */
  date: string;
}

/** Who said an assistant line. Absent is Spud, the host; `gabie` is the nutritionist, and only a coach answer carries it. */
export type ChatSpeaker = "gabie";

export interface Answered {
  kind: "answered";
  /** Model prose in the user's language. Content, not copy — it passes through unrendered. */
  text: string;
  /** Who answered. A coach turn is Gabie's, fallback included; absent or null is Spud. */
  speaker?: ChatSpeaker | null;
  /**
   * What the user might ask next, in their own words, as chips under the answer. Live turn only:
   * the thread stores the sentence and never the chips, so a stored line carries none. Absent
   * means draw nothing; the app never invents any.
   */
  suggestions?: string[];
}

export interface MealUpdated {
  kind: "updated";
  mealId: string;
  analysis: MealAnalysis;
  totals: DailyTotals;
  date: string;
  /** How the change was made. `manual` = the user edited numbers; `nl` = they described the fix; `reanalysis` = the analyzer re-read the stored photo. */
  via: "manual" | "nl" | "reanalysis";
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

/** Whose cap was reached. `unknown` is the honest answer for a scope that is absent or new. */
export type CapScope = "address" | "global" | "user" | "unknown";

/**
 * ONE DECISION ABOUT AN UNNAMED CAP, made here rather than three times in three screens.
 *
 * The camera, the chat and the meal screen each word `cap-exceeded` for what the user was doing
 * there — three sentences, deliberately. What is NOT theirs to decide separately is what an absent
 * or unrecognised scope means, and they had already drifted: two of them reached the per-user
 * sentence as their default branch, so "your daily allowance is spent" was said about a cap that
 * may be the shared budget (also per-day) or a carrier network everyone behind one address shares.
 *
 * `unknown` is what an unnamed cap is. A surface answers it by not claiming whose it was (#158).
 */
export const capScope = (scope: string | null | undefined): CapScope =>
  scope === "address" || scope === "global" || scope === "user" ? scope : "unknown";

/**
 * The one 429 body that is not a refusal kind: a per-address limiter saying "slow down".
 *
 * Nothing is spent and nothing is refused, which is why it is not in `REFUSAL_STATUS` — and why it
 * needs a name of its own. Six routes send it and every consumer switches on it; each spelling of
 * the string was a place to typo it into a body nobody recognises, which the client reports as
 * "couldn't reach eait" for a request that arrived and was answered.
 */
export const RATE_LIMITED = "rate-limited";

/**
 * True when the body came from a server that UNDERSTOOD the request — every refusal, plus the one
 * 429 that is not one.
 *
 * DERIVED, like `isRefusal` above and for the same reason. `ApiError.isRefusal` used to spell the
 * rule out, so a second consumer had to spell it out too, and the next non-refusal body the server
 * grows would have to be added to both: whichever copy forgot would report an answered request as
 * "couldn't reach eait" — a regression `api.ts` records having already been fixed once. Adding a
 * body here is the whole change.
 *
 * Not the negation of "offline": `internal`, `bad-edit` and `unauthenticated` are false here and
 * still arrived. This answers whether the body is one the client has a design for, and a surface
 * that needs "did it reach the server" asks the transport, not this.
 */
const ANSWER_STATUS: Record<string, number> = { ...REFUSAL_STATUS, [RATE_LIMITED]: 429 };
export const isServerAnswer = (r: { kind: string }): boolean => Object.hasOwn(ANSWER_STATUS, r.kind);

/** One refused turn, as every surface names it: `kind` is `"offline"` when nothing reached the server. */
export interface RefusedTurn {
  kind: string;
  scope?: string;
}

/**
 * WHAT THE SERVER ANSWERED, extracted once (#145).
 *
 * The same decision was written out five times across three screens — `meal/[id].tsx` twice,
 * `camera.tsx` twice, `chat.tsx` once — as a ternary on `instanceof ApiError` plus a defensive read
 * of `scope`, under three different key names for the same thing (`kind`, `error`, `refusal`). So
 * the next body shape the server grows had to be threaded through five hand-written copies, and the
 * one that was missed would report a designed answer as "Couldn't reach eait." — which
 * `ApiError.isRefusal` already records having happened once.
 *
 * TAKES THE BODY, NOT THE THROWN VALUE, so the rule is testable where the test command reaches:
 * `instanceof ApiError` is the transport's question and lives in the client (`refusalOf`), and this
 * is the only part with a decision in it.
 *
 * NULL IS THE ONE THING THAT MEANS OFFLINE. A body with no `error` in it still ARRIVED — the server
 * answered something this client has no design for, which is a different fact from the request
 * never landing, and wording it as a connection problem sends somebody to check a connection that
 * is fine. `scope` is ABSENT rather than undefined when there is none: the callers spread this into
 * objects under `exactOptionalPropertyTypes`, where those are not the same thing.
 */
export function refusalFrom(body: { error?: unknown; scope?: unknown } | null | undefined): RefusedTurn {
  if (body === null || body === undefined) return { kind: "offline" };
  return {
    kind: String(body.error),
    ...(typeof body.scope === "string" ? { scope: body.scope } : {}),
  };
}
