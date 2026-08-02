// Free text: the chat surface's whole engine.
//
// One turn is one model call that decides among four intents, rather than a keyword router that
// guesses. The context it decides with — today's meals, the week's sums, the focused meal — is
// assembled here as STRUCTURED data, not as a replayed transcript: the question people actually ask
// is "how much protein have I had", and a transcript answers that far worse than the rows do.

import {
  type HandleTextResult, type MealAnalysis, type MealProposed, type MealRedated,
  explainTargets,
} from "@ieat/shared";
import { dateMinus, localDate } from "../dates.ts";
import type { EngineDeps } from "./deps.ts";
import { checkCaps } from "./caps.ts";
import { applyCorrection, gatedVerdicts, sumTotals, toAnalysis } from "./meals.ts";

// How long a proposed text meal stays confirmable is `config.pendingTtlMs` (`PENDING_TTL_MINUTES`),
// read from deps at the point of use rather than frozen into a module constant here.

/** Days of history handed to the router as context. */
const CONTEXT_DAYS = 7;

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
}

export async function handleText(
  deps: EngineDeps,
  userId: string,
  input: HandleTextInput,
): Promise<HandleTextResult> {
  const profile = await deps.store.getProfile(userId);
  if (!profile || profile.onboarded_at === null) return { kind: "not-onboarded" };

  const zone = deps.config.timezone;
  const today = localDate(zone);

  const refusal = await checkCaps(deps, userId, today, "text");
  if (refusal) return refusal;
  await deps.store.recordAnalysis(userId, today, "text");

  const focus = input.focusMealId
    ? await deps.store.getMeal(userId, input.focusMealId)
    : null;

  const todayRows = await deps.store.mealsForDate(userId, today);
  const week = await deps.store.totalsSince(userId, dateMinus(today, CONTEXT_DAYS));
  const { targets } = explainTargets(profile);

  let routed;
  try {
    routed = await deps.llm.routeText({
      text: input.text, profile, targets,
      todayMeals: todayRows.map((m) => ({
        items: m.items.map((i) => i.name), kcal: m.kcal, protein_g: m.protein_g,
      })),
      week,
      ...(focus ? { focusMeal: toAnalysis(focus) } : {}),
    });
  } catch (e) {
    console.error(`[ieat] text routing failed: ${(e as Error).message}`);
    return { kind: "analysis-failed" };
  }

  switch (routed.intent) {
    case "answer":
      return { kind: "answered", text: routed.text };

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
      const analysis: MealAnalysis = {
        ...routed.analysis,
        verdicts: await gatedVerdicts(deps, userId, routed.analysis),
      };
      await deps.store.putPending({
        id: pendingId, userId, analysis, date,
        expiresAt: Date.now() + deps.config.pendingTtlMs,
      });
      return { kind: "proposed", pendingId, analysis, date } satisfies MealProposed;
    }

    case "correction": {
      // Unreachable without a focus meal — the provider degrades the intent to `answer` when none
      // was supplied — but guarded anyway, because that guarantee lives in another file.
      if (!focus) return { kind: "answered", text: "" };
      // No verdict repair needed on this branch: `applyCorrection` writes through `editMeal`, which
      // recomputes them from the stored row like every other write.
      return applyCorrection(deps, userId, focus.id, routed.analysis);
    }

    case "redate": {
      if (!focus) return { kind: "answered", text: "" };
      const date = dateMinus(today, routed.dayOffset);
      // The ONE sanctioned way a meal's date changes. Macros are untouched; a manual edit cannot
      // reach this field at all, because `EditMealRequest` has no date on it.
      const moved = await deps.store.updateMeal(userId, focus.id, { date });
      if (!moved) return { kind: "target-gone", on: "redate" };
      const totals = sumTotals(await deps.store.mealsForDate(userId, date));
      return {
        kind: "redated", mealId: moved.id, analysis: toAnalysis(moved), totals, date,
      } satisfies MealRedated;
    }
  }
}
