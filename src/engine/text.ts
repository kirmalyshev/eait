// Free-text handling, transport-agnostic — the router half of `tg_bot/bot.ts:processText`.
//
// WHAT DID NOT MOVE, and why the split falls here. `processText` also owns a precedence chain that
// is entirely Telegram: command > armed settings prompt (`users.pending_input`) >
// reply-to-a-rejection > router > onboarding. Every one of those is about how a Telegram message
// arrives, not about what the diary should do, and a mobile client has none of them — it has
// buttons and screens instead. So the surface resolves precedence and a focus meal, then calls this
// with the text and (optionally) which meal it is about.
//
// `focusMealId` is a UUID, not a message id. Telegram maps `reply_to_message_id → mealByReply → id`
// before calling; a mobile client already knows the id because the user tapped a card.

import {
  applyCorrection, berlinDate, berlinDateMinus, berlinTime, dailyTotals, getUser, insertPendingMeal,
  logLlmCall, mealById, mealsOnDate, prunePendingMeals, setMealDate, totalsByDate,
} from "../db.ts";
import { targetsFor } from "../targets.ts";
import { mealRecordToAnalysis } from "./profile.ts";
import { profileFromRow } from "./profile.ts";
import { checkCaps } from "./caps.ts";
import type { RouteContext } from "../analyzer.ts";
import type { EngineDeps, UserId } from "./deps.ts";
import type { HandleTextResult } from "./results.ts";

/** Mirrors the 7-day week context the router is given (weekStart = today − 7d). */
const WEEK_DAYS = 7;

/** Stale pending text meals are swept lazily on the next pending insert. 48 h. */
export const PENDING_TTL_MS = 48 * 3_600_000;

export interface HandleTextInput {
  text: string;
  /** The meal this message is about, if any. Unlocks the correction and redate intents. */
  focusMealId?: string;
  /** Same "seen" hook as the photo flow — fired after the gate, before the caps. */
  onAccepted?: () => void;
}

const fire = (hook: (() => void) | undefined, userId: UserId): void => {
  void Promise.resolve()
    .then(() => hook?.())
    .catch((e) => console.warn(`[eait] onAccepted hook failed user=${userId}: ${(e as Error)?.message}`));
};

export async function handleText(
  deps: EngineDeps,
  userId: UserId,
  input: HandleTextInput,
): Promise<HandleTextResult> {
  const { db, config } = deps;
  const u = await getUser(db, userId);
  if (!u || u.state !== "active") return { kind: "not-onboarded" };

  fire(input.onAccepted, userId);

  const prof = profileFromRow(u);
  const date = berlinDate(new Date(), config.tz);

  const capped = await checkCaps(deps, userId, date);
  if (capped) return { kind: "cap-exceeded", scope: capped.scope };

  // Resolved BEFORE the routing call, because its presence is what tells the model whether the
  // correction and redate intents are available at all.
  const focus = input.focusMealId ? await mealById(db, userId, input.focusMealId) : undefined;

  const ctx: RouteContext = {
    ...(focus ? { focusMeal: mealRecordToAnalysis(focus) } : {}),
    todayMeals: (await mealsOnDate(db, userId, date)).map((m) => ({
      items: m.items, kcal: m.kcal, protein_g: m.protein_g,
    })),
    // `berlinDateMinus` for the usual DST reason.
    weekTotals: await totalsByDate(db, userId, berlinDateMinus(date, WEEK_DAYS), date),
    targets: targetsFor(prof),
    localTime: berlinTime(new Date(), config.tz),
  };

  await logLlmCall(db, userId, date, "router");
  let route;
  try {
    route = await deps.routeText(input.text, prof, ctx);
  } catch (e) {
    // Logged here so a model outage and a parse bug are not indistinguishable from the operator's
    // side: the user gets a message either way, and without this the logs get nothing.
    console.error(`[eait] route failed user=${userId}: ${(e as Error)?.message ?? e}`);
    return { kind: "analysis-failed" };
  }

  if (route.intent === "question") return { kind: "answered", text: route.answer };

  if (route.intent === "meal") {
    // Confirm-first: NOTHING reaches `meals` until the user says yes. A text meal is a parse of
    // prose, and the confirm prompt naming the resolved date is the misparse guard.
    const pendingId = crypto.randomUUID();
    const mealDate = berlinDateMinus(date, route.dayOffset); // offset 0 returns `date` unchanged
    console.log(`[eait] text meal user=${userId} dayOffset=${route.dayOffset} date=${mealDate}`);
    // Housekeeping must never cost the user their (already-metered) meal — a sweep failure is
    // logged and skipped, and the next insert retries anyway.
    try {
      await prunePendingMeals(db, new Date(Date.now() - PENDING_TTL_MS).toISOString());
    } catch (e) {
      console.warn(`[eait] pending sweep failed: ${(e as Error)?.message}`);
    }
    await insertPendingMeal(db, {
      id: pendingId, user_id: userId, ts: new Date().toISOString(), date: mealDate,
      analysis: route.analysis, model: config.llmModel, user_message_id: null,
    });
    return { kind: "proposed", pendingId, analysis: route.analysis, date: mealDate };
  }

  // Correction and redate both act on the focus meal. The router guarantees one is present; a
  // missing one here is a wiring bug, and returning `target-gone` keeps it from ever being
  // silently re-routed into a NEW meal.
  if (!focus) {
    // Distinct from `target-gone`: the row did not vanish, the caller wired this wrong. Surfaces as
    // the generic failure, exactly as it did before, rather than as "your meal was deleted".
    console.error(`[eait] ${route.intent} intent without focus row user=${userId} — should be unreachable`);
    return { kind: "analysis-failed" };
  }

  if (route.intent === "correction") {
    // The meal can vanish between lookup and update (a /delete race, a second instance) — a 0-row
    // update must never be reported as applied.
    if (!(await applyCorrection(db, focus.id, userId, route.analysis))) {
      return { kind: "target-gone", on: "correction" };
    }
    return {
      kind: "updated",
      mealId: focus.id,
      analysis: route.analysis,
      // The corrected meal keeps its OWN date, and these totals are for that date — not today's.
      totals: await dailyTotals(db, userId, focus.date),
      date: focus.date,
    };
  }

  const newDate = berlinDateMinus(date, route.dayOffset);
  if (!(await setMealDate(db, focus.id, userId, newDate))) return { kind: "target-gone", on: "redate" };
  // The one sanctioned date mutation gets an audit line, like the meal-stored path — a "why did my
  // breakfast jump days" report is otherwise untraceable.
  console.log(
    `[eait] redate user=${userId} meal=${focus.id} dayOffset=${route.dayOffset} ${focus.date}→${newDate}`,
  );
  return {
    kind: "redated",
    mealId: focus.id,
    // Macros unchanged — that is the whole distinction from a correction.
    analysis: mealRecordToAnalysis(focus),
    totals: await dailyTotals(db, userId, newDate),
    date: newDate,
  };
}
