// Free text: the chat surface's whole engine.
//
// One turn starts with one model call that decides among four intents, rather than a keyword
// router that guesses. The context it decides with — today's meals, the week's sums, the focused
// meal, the thread's tail — is assembled here as STRUCTURED data, not as a replayed transcript: the
// question people actually ask is "how much protein have I had", and a transcript answers that far
// worse than the rows do. A question then goes to the coach (`coach.ts`), which is the one intent
// that may spend more calls: the thread, the plan, and two tools over the user's own rows.

import {
  type HandleTextResult, type MealAnalysis, type MealProposed, type MealRecord, type MealRedated,
  type Profile, explainTargets,
} from "@eait/shared";
import { TEXT_MODEL_CALLS, dateMinus, healthScore, isRefusal, localDate, verdictInlineText, verdictLabels, windowStart } from "@eait/shared";
import type { EngineDeps } from "./deps.ts";
import type { ChatAppend, ChatIntent } from "../store.ts";
import { normalizePromptText } from "../llm/prompt.ts";
import { emptyEstimate } from "../llm/port.ts";
import { prepareAnalysis } from "./analysis.ts";
import { charge, checkCaps, refundGatewayRefusal, releaseSample } from "./caps.ts";
import { applyCorrection, changeLine, gatedVerdicts, redateMeal, sumTotals, toAnalysis } from "./meals.ts";
import { remember } from "./chat.ts";
import { ROUTER_RECENT_LINES, coachTurn, recentLines } from "./coach.ts";
import { eatenAt, once } from "./turns.ts";

// How long a proposed text meal stays confirmable is `config.pendingTtlMs` (`EAIT__BACKEND__PENDING_TTL_MINUTES`),
// read from deps at the point of use rather than frozen into a module constant here.

/** Days of history handed to the router as context, counting today. */
const CONTEXT_DAYS = 7;

/**
 * Is this message one of the options Spud offered, rather than something the user wrote?
 *
 * Compared through `normalizePromptText` — the same sink the options were stored through — then
 * lower-cased, so case and stray whitespace do not decide it. A chip sends its option verbatim, so
 * this is exact-match on the designed path; a person who happens to TYPE "in oil" has answered the
 * question too, and gets the same reading.
 */
function isOneOf(text: string, options: readonly string[]): boolean {
  const key = (s: string) => normalizePromptText(s).toLowerCase();
  const said = key(text);
  return said !== "" && options.some((o) => key(o) === said);
}

export interface HandleTextInput {
  text: string;
  /**
   * The meal a correction or re-date applies to.
   *
   * Safe to accept from the client because every store read is user-scoped: naming someone else's
   * meal resolves to null rather than to their row, and the intents that need a focus meal are
   * refused when it is absent. Asserted by test.
   */
  focusMealId?: string;
  /** The phone's id for this turn, stored on the user line: a second request carrying it is answered from the first (#708). */
  clientId?: string;
  /** When the words were sent. A queued turn reads "yesterday" against the day it was typed. */
  capturedAt?: string;
}

export async function handleText(
  deps: EngineDeps,
  userId: string,
  input: HandleTextInput,
): Promise<HandleTextResult> {
  return once(deps, userId, input.clientId, TEXT_MODEL_CALLS, () => textTurn(deps, userId, input));
}

async function textTurn(
  deps: EngineDeps,
  userId: string,
  input: HandleTextInput,
): Promise<HandleTextResult> {
  const found = await deps.store.getProfile(userId);
  if (!found || found.onboarded_at === null) return { kind: "not-onboarded" };
  // Bound after the check, so the hoisted `route` below sees a `Profile` and never a null.
  const profile = found;

  const zone = deps.config.timezone;
  // The day the turn was TYPED, which a queued turn sent tomorrow is not (#708): "today" and
  // "yesterday" in its words mean that day. The caps and the charge are the day it is sent.
  const today = localDate(zone, eatenAt(input.capturedAt));
  const chargeDay = localDate(zone);

  const refusal = await checkCaps(deps, userId, chargeDay, "text");
  if (refusal) return refusal;
  const { analysisId, onCost } = await charge(deps, userId, chargeDay, "text");

  const focus = input.focusMealId
    ? await deps.store.getMeal(userId, input.focusMealId)
    : null;
  // The stored photos, for the correction call only — `routeText` decides where they go.
  const loadFocusImages = focus && (focus.photos ?? 0) > 0
    ? () => deps.store.getPhotos(userId, focus.id).then((ps) => ps.map((p) => p.bytes))
    : undefined;

  // The framing below is only ever attached to a turn that IS the answer, and the chips send an
  // option verbatim — so "is this message one of the options" is the whole test. Anything the user
  // typed themselves goes to the router exactly as it did before the question existed, which is
  // what stops "how much protein have I had today?" being read as a correction of their lunch
  // because a question happened to be standing on it.
  const answering = focus?.question && isOneOf(input.text, focus.question.options)
    ? focus.question
    : null;

  const todayRows = await deps.store.mealsForDate(userId, today);
  // `windowStart`, not `dateMinus`: it is the expression that MEANS a length, so `CONTEXT_DAYS`
  // days counting today. `dateMinus(today, CONTEXT_DAYS)` was one day wider than its own constant
  // said, and nothing tested the length — which is the whole of why it survived (#182). The router
  // and the coach now reason over the same seven days the sentence "this week" claims.
  const week = await deps.store.totalsSince(userId, windowStart(today, CONTEXT_DAYS));
  const { targets } = explainTargets(profile);
  // Read ONCE for the turn: the router sees the tail, the coach the window. The message itself is
  // not in it — `keep` writes it after the turn — so neither has to skip it.
  const history = await recentLines(deps, userId);

  let routed: Awaited<ReturnType<typeof deps.llm.routeText>>;
  try {
    routed = await deps.llm.routeText({
      text: input.text, profile, targets,
      todayMeals: todayRows.map((m) => ({
        items: m.items.map((i) => i.name), kcal: m.kcal, protein_g: m.protein_g,
      })),
      week,
      ...(focus ? { focusMeal: toAnalysis(focus) } : {}),
      ...(loadFocusImages ? { loadFocusImages } : {}),
      // A chip's words are two of them. "In oil" says nothing on its own, and without the question
      // beside it the router reads it as a new meal or as small talk.
      ...(answering ? { question: answering } : {}),
      recent: history.slice(-ROUTER_RECENT_LINES),
      onCost,
    });
  } catch (e) {
    // Given back when the gateway refused before generating anything — the same rule as the photo
    // path, and it must be, or a typed first meal burns a sample a photo would have kept.
    const refunded = await refundGatewayRefusal(deps, userId, analysisId, e);
    if (!refunded) await releaseSample(deps, userId, analysisId);
    console.error(`[eait] text routing failed: ${(e as Error).message}${refunded ? " (analysis refunded)" : ""}`);
    return { kind: "analysis-failed" };
  }

  // The model that wrote the answer, when there is one — the coach's, or the router's own sentence.
  let answeredBy: string | null = null;
  const result = await route();
  // Every branch that fails ends here as `analysis-failed`: charged, and nothing delivered (#44).
  // `not-food` joins it for the reason `analyzePhotos` releases the same answer: an answer, no meal.
  if (result.kind === "analysis-failed" || result.kind === "not-food") {
    await releaseSample(deps, userId, analysisId);
  }
  // ONE QUESTION, ONE FRAMED TURN. Spent by the turn that was framed as its answer, whatever the
  // router made of it — a correction clears it through `editMeal` anyway, and every other intent
  // would otherwise leave the framing standing over the next message, and the one after that.
  // Housekeeping, so it can never fail the turn it rides on: that turn is already billed.
  if (answering && focus) {
    await deps.store.updateMeal(userId, focus.id, { question: null }).catch((e) => {
      console.error(`[eait] question clear failed: ${(e as Error)?.message ?? e}`);
    });
  }
  await keep(deps, userId, input.text, result, input.clientId ?? null, { intent: routed.intent, model: answeredBy, analysisId }, focus, profile);
  return result;

  async function route(): Promise<HandleTextResult> {
    switch (routed.intent) {
      case "answer": {
        // The router said it is a question; the coach answers it, with the thread and the tools.
        // The router's own sentence is the FALLBACK, so a coach that fails degrades to the chat as
        // it was rather than to `analysis-failed` on a turn already charged.
        try {
          const answered = await coachTurn(deps, userId, { text: input.text, profile, focus, todayRows, week, history, today, onCost });
          answeredBy = deps.config.llmChatModel;
          return answered;
        } catch (e) {
          // With nothing from either, this is a failed analysis and the app says so: an empty
          // `answered` would render as no turn at all, which is the blank bubble by another name.
          if (routed.text.trim() === "") {
            console.error(`[eait] coach failed and the router had no answer either: ${(e as Error)?.message ?? e}`);
            return { kind: "analysis-failed" };
          }
          console.error(`[eait] coach failed, answering from the router: ${(e as Error)?.message ?? e}`);
          answeredBy = deps.config.llmModel;
          return { kind: "answered", text: routed.text, speaker: "gabie" };
        }
      }

      case "meal": {
        // Confirm-first. The model just turned prose into numbers, and the user is the only one who
        // knows whether it understood them — so nothing is written until they say so. The prompt
        // NAMES the resolved date, which is the misparse guard for "yesterday" and friends.
        const date = dateMinus(today, routed.dayOffset);
        const pendingId = crypto.randomUUID();
        // The verdicts are DERIVED here, because the analyzer does not supply them and this result
        // does not pass through a store row that would. Attached before the pending is written so the
        // card the user confirms carries the same judgement as the card they were shown; the write
        // itself recomputes anyway, since the caps can move while a proposal sits.
        // copy.md § Step 14: a typed meal is rough by construction — the portions are a guess however
        // sure the model is of the dish — and the card's "rough estimate" pill reads this field.
        const { analysis: reconciled } = prepareAnalysis(routed.analysis);
        // The router's intent names food, but the analysis behind it may still answer otherwise —
        // or claim food while naming not one item of it (#248: the analyzer declining a vague
        // description with `items: []` at `isFood: true`). The first is the photo path's own
        // refusal; the second is a failed estimate. Refused before the pending is written, or a
        // confirm logs a 0 kcal "Meal" whose every verdict reads on plan.
        if (!reconciled.isFood) return { kind: "not-food" };
        if (emptyEstimate(reconciled)) return { kind: "analysis-failed" };
        const verdicts = await gatedVerdicts(deps, userId, reconciled);
        const analysis: MealAnalysis = {
          ...reconciled,
          confidence: "low",
          verdicts,
          // Same rule as the verdicts above: the score is computed HERE because the proposal the
          // card renders never passes through a store row that would attach it.
          healthScore: healthScore({ ...reconciled, verdicts }, profile.restrictions),
        };
        // Every new proposal sweeps the expired ones: their words have no reason to stay. Housekeeping,
        // so it can never fail the turn it rides on — that turn is already billed.
        await deps.store.pruneExpiredPendings().catch((e) => {
          console.error(`[eait] pending sweep failed: ${(e as Error)?.message ?? e}`);
        });
        // ONE MOMENT, WRITTEN ONCE AND SENT (#367). The row is refused after it and the card stops
        // offering its button at it, so the two must be the same instant rather than two calls to
        // the clock a few milliseconds apart.
        const expiresAt = Date.now() + deps.config.pendingTtlMs;
        await deps.store.putPending({ id: pendingId, userId, analysis, date, expiresAt });
        return {
          kind: "proposed", pendingId, analysis, date, expiresAt: new Date(expiresAt).toISOString(),
          // The card's verdict words, in the account's language, composed where the verdict was.
          verdictInline: verdictInlineText(analysis.verdicts, profile.lang),
          verdictLabels: verdictLabels(analysis.verdicts, profile.lang),
        } satisfies MealProposed;
      }

      case "correction": {
        // Unreachable without a focus meal — the provider degrades the intent to `answer` when none
        // was supplied — but guarded anyway, because that guarantee lives in another file. A refusal
        // the screen can word, never an empty 200: the analysis is charged by now, and a turn that
        // renders nothing leaves the user with a spent sample and no idea why.
        if (!focus) return { kind: "target-gone", on: "correction" };
        // No verdict repair needed on this branch: `applyCorrection` writes through `editMeal`, which
        // recomputes them from the stored row like every other write. The totals still need
        // reconciling — a correction is an analysis like any other.
        const { analysis: reconciled } = prepareAnalysis(routed.analysis);
        // The same gate a fresh meal takes (#248): a correction that comes back not-food or with no
        // items is a failed estimate, and writing it would zero the meal it claims to fix.
        if (!reconciled.isFood || emptyEstimate(reconciled)) return { kind: "analysis-failed" };
        return applyCorrection(deps, userId, focus.id, reconciled);
      }

      case "redate": {
        if (!focus) return { kind: "target-gone", on: "redate" };
        // The ONE sanctioned way a meal's date changes, shared with `POST /v1/meals/:id/redate`:
        // an offset against the day the turn was TYPED — a queued turn sent tomorrow still means
        // its own "yesterday". Macros untouched; a manual edit cannot reach this field at all.
        return redateMeal(deps, userId, focus.id, routed.dayOffset, { at: eatenAt(input.capturedAt) });
      }
    }
  }
}

/**
 * What of this turn goes in the thread. The user's words (the turn happened); the answer as text; a
 * correction or re-date as the meal it changed (`editMeal` does not write for the chat path — the
 * words must come first). A proposal writes the words and nothing else: it is not a meal until
 * confirmed, and `confirmPendingMeal` keeps the card then.
 */
async function keep(
  deps: EngineDeps, userId: string, text: string, result: HandleTextResult, clientId: string | null,
  // #486: the router's decision rides on the words it read, the model on the words it wrote.
  // #525: and the words name the analysis that paid for the turn.
  how: { intent: ChatIntent; model: string | null; analysisId: string },
  // The focus meal as it stood BEFORE this turn — the change line's "before" (#119) — and the
  // profile for its language and declared restrictions.
  before: MealRecord | null, profile: Profile,
): Promise<void> {
  // A refusal never was a turn; a correction whose meal is gone changed nothing, and the app says
  // so in a notice that is not a line.
  if (result.kind === "target-gone" || isRefusal(result)) return;
  // An answer that came back empty is no turn: a sentence with nothing in it is not kept.
  if (result.kind === "answered" && result.text === "") return;
  await remember(deps, userId, async () => {
    // The words go in when they are said, so a turn taken while a proposal sits lands after them.
    // The MEAL is not written until confirmed; `confirmPendingMeal` keeps the card then.
    const lines: ChatAppend[] = [{
      role: "user", kind: "text", text, clientId, intent: how.intent, analysisId: how.analysisId,
      // A proposal's line names its proposal; the meal takes that id when confirmed.
      pendingId: result.kind === "proposed" ? result.pendingId : null,
    }];
    if (result.kind === "answered") {
      lines.push({ role: "assistant", kind: "text", text: result.text, speaker: result.speaker ?? null, model: how.model });
    } else if (result.kind === "updated" || result.kind === "redated") {
      lines.push({ role: "assistant", kind: "meal", mealId: result.mealId, event: result.kind, speaker: "gabie" });
      // #119: the ONE computed line — the coach's — names the change and what the verdicts did. A
      // correction always carried a focus meal; `before` being null is the target-gone case,
      // which returned before this thunk.
      if (result.kind === "updated" && before !== null) {
        const meal = await deps.store.getMeal(userId, result.mealId);
        const line = meal ? changeLine(before, meal, profile) : null;
        result.line = line;
        if (line) lines.push({ role: "assistant", kind: "text", text: line, speaker: "gabie" });
      }
    }
    return lines;
  });
}
