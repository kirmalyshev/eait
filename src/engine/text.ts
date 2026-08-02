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
  applyCorrection, berlinDate, berlinDateMinus, berlinTime, dailyTotals, getUser, insertPendingEdit,
  insertPendingMeal, logLlmCall, mealById, mealsInWindow, mealsOnDate, prunePendingEdits,
  prunePendingMeals,
  setMealDate, totalsByDate,
} from "../db.ts";
import { targetsFor } from "../targets.ts";
import { mealRecordToAnalysis } from "./profile.ts";
import { profileFromRow } from "./profile.ts";
import { checkCaps } from "./caps.ts";
import type { RouteContext } from "../analyzer.ts";
import type { MealAnalysis, MealRecord } from "../types.ts";
import type { EngineDeps, UserId } from "./deps.ts";
import type { HandleTextResult, MealChoice } from "./results.ts";

/** Mirrors the 7-day week context the router is given (weekStart = today − 7d). */
const WEEK_DAYS = 7;

/**
 * Stale pending text meals are swept lazily on the next pending insert. 48 h.
 *
 * Lives here, where pending rows are CREATED and swept; `meals.ts` imports it to honour the same
 * TTL at confirm time. One direction only (`meals.ts` → `text.ts`, never back) — the sweep and the
 * confirm check must agree, and two constants is how "expired" and the actual lifetime drift apart.
 */
export const PENDING_TTL_MS = 48 * 3_600_000;

export interface HandleTextInput {
  text: string;
  /** The meal this message is about, if any. Unlocks the correction and redate intents. */
  focusMealId?: string;
  /** Same "seen" hook as the photo flow — fired after the gate, before the caps. */
  onAccepted?: () => void;
}

/**
 * Sweep expired pending edits, on the same lazy-on-insert schedule and the same TTL as pending
 * meals. A sweep failure must never cost the user their (already metered) edit — logged and
 * skipped, and the next insert retries anyway.
 */
async function sweepPendingEdits(db: EngineDeps["db"]): Promise<void> {
  try {
    await prunePendingEdits(db, new Date(Date.now() - PENDING_TTL_MS).toISOString());
  } catch (e) {
    console.warn(`[eait] pending-edit sweep failed: ${(e as Error)?.message}`);
  }
}

/**
 * Shortest food word that may match a meal on its own.
 *
 * Matching the user's raw sentence against stored item names means every short token is a false
 * positive waiting to happen — "a", "of", "it", "was". Four characters is the floor at which a word
 * is plausibly a food name rather than grammar.
 */
const MIN_FOOD_WORD = 4;

/**
 * Find the meals an UNTARGETED edit could be about, from whatever signal it does carry.
 *
 * THE FALLBACK EXISTS BECAUSE THE MODEL IS NOT RELIABLE ABOUT THIS, and that was measured, not
 * assumed. Two live failures drove it, and they needed different signals:
 *
 *   - "the pasta was 200g, not 150" → `submit_correction` with no `mealId`, even though the meal
 *     was listed in the prompt. Fixed twice over: `todayMeals` now carries `mealId` so the
 *     commonest case needs no search at all, AND the corrected analysis names the food, which is
 *     the same signal `find_meals` matches on.
 *   - "actually the oatmeal was yesterday, move it" → `submit_redate` with no `mealId`. A re-date
 *     carries no analysis, so there is nothing on the ROUTE to match — but the user's own sentence
 *     says "oatmeal", and the diary has a meal called that.
 *
 * So both directions are tried: analysis item names against stored names, and stored names against
 * the user's text. Whichever fires, the result goes to the same confirm-or-choose path a
 * model-targeted edit does — one match asks "update this one?", several ask which, none refuses.
 * This is never a silent guess; it only ever earns the user a tap.
 */
async function recoverTargets(
  db: EngineDeps["db"],
  userId: UserId,
  signal: { items?: { name: string; name_en?: string }[]; text: string },
  today: string,
): Promise<MealRecord[]> {
  const needles = (signal.items ?? [])
    .flatMap((it) => [it.name, it.name_en])
    .filter((n): n is string => typeof n === "string" && n.trim() !== "")
    .map((n) => n.trim().toLowerCase());
  const haystack = signal.text.toLowerCase();

  const window = await mealsInWindow(db, userId, berlinDateMinus(today, WEEK_DAYS), today);
  return window.filter((m) =>
    m.items.some((it) => {
      const stored = `${it.name} ${it.name_en ?? ""}`.toLowerCase();
      // Either direction counts: the model may say "pasta" for a stored "pasta carbonara", or
      // "pasta carbonara" for a stored "pasta".
      if (needles.some((n) => stored.includes(n) || n.includes(it.name.toLowerCase()))) return true;
      // And the user's own sentence names the food often enough to be worth reading — this is what
      // rescues a re-date, which carries no analysis at all.
      return stored
        .split(/[^\p{L}\p{N}]+/u)
        .filter((w) => w.length >= MIN_FOOD_WORD)
        .some((w) => haystack.includes(w));
    }),
  );
}

/**
 * Park an edit whose target was INFERRED — by the model naming an id, or by the item match above —
 * and hand the surface everything it needs to ask "apply this?".
 *
 * Shared by both routes on purpose. They differ only in how the target was found, and that is
 * exactly the thing that must NOT change what the user is shown: an inferred target gets a
 * confirmation either way, and one code path is how that stays true.
 */
async function proposeEdit(
  deps: EngineDeps,
  userId: UserId,
  route: { intent: "correction"; analysis: MealAnalysis } | { intent: "redate"; dayOffset: number },
  target: MealRecord,
  today: string,
): Promise<HandleTextResult> {
  const pendingId = crypto.randomUUID();
  const newDate = route.intent === "redate"
    // Resolved NOW, and stored as a date rather than an offset: "move it to yesterday" typed at
    // 23:59 and approved at 00:01 must land on the day the user meant, not one day later.
    ? berlinDateMinus(today, route.dayOffset)
    : target.date;
  await sweepPendingEdits(deps.db);
  await insertPendingEdit(deps.db, {
    id: pendingId, user_id: userId, ts: new Date().toISOString(), kind: route.intent,
    meal_id: target.id,
    ...(route.intent === "correction" ? { analysis: route.analysis } : { new_date: newDate }),
  });
  const current = mealRecordToAnalysis(target);
  return {
    kind: "edit-proposed",
    pendingId,
    edit: route.intent,
    mealId: target.id,
    current,
    // A re-date changes no macros, so the "after" IS the "before" — carried anyway so a surface can
    // render both edits through one code path.
    proposed: route.intent === "correction" ? route.analysis : current,
    date: target.date,
    newDate,
  };
}

/**
 * Park a disambiguation and hand the surface the buttons to draw.
 *
 * `question` is the model's when it asked with `ask_which_meal`, and absent when the item-match
 * fallback found several — there is no model prose in that case, so the surface resolves a copy
 * key instead. That is why it is optional rather than defaulted to an English string here: this
 * layer does not own wording.
 */
async function proposeChoice(
  deps: EngineDeps,
  userId: UserId,
  sourceText: string,
  candidates: MealRecord[],
  question?: string,
): Promise<HandleTextResult> {
  const pendingId = crypto.randomUUID();
  await sweepPendingEdits(deps.db);
  await insertPendingEdit(deps.db, {
    id: pendingId, user_id: userId, ts: new Date().toISOString(), kind: "choose",
    source_text: sourceText, candidates: candidates.map((m) => m.id),
  });
  return {
    kind: "choose-meal",
    pendingId,
    ...(question ? { question } : {}),
    candidates: candidates.map(toChoice(deps.config.tz)),
  };
}

/** A stored meal reduced to what a disambiguation button needs to be distinguishable. */
const toChoice = (tz: string) => (m: MealRecord): MealChoice => ({
  mealId: m.id,
  date: m.date,
  time: Number.isNaN(Date.parse(m.ts)) ? "" : berlinTime(new Date(m.ts), tz),
  items: m.items.map((it) => it.name),
  kcal: m.kcal,
});

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
    // `mealId` included so a correction to something eaten TODAY — much the commonest case —
    // needs no diary search at all: the model already has the meal in front of it and can now name
    // it. `find_meals` remains for earlier days.
    todayMeals: (await mealsOnDate(db, userId, date)).map((m) => ({
      mealId: m.id, items: m.items, kcal: m.kcal, protein_g: m.protein_g,
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

  if (route.intent === "choose") {
    // The agent found several possible targets and refused to guess. Resolve the ids it named
    // against the user's OWN rows — a hallucinated or foreign id simply drops out, so the buttons
    // can only ever offer meals that exist and belong to the caller.
    const found: MealRecord[] = [];
    for (const id of route.mealIds) {
      const m = await mealById(db, userId, id);
      if (m) found.push(m);
    }
    if (found.length === 0) {
      console.error(`[eait] choose intent resolved to no real meals user=${userId}`);
      return { kind: "analysis-failed" };
    }
    // One survivor is still worth asking about — "did you mean this one?" is a tap, where the
    // generic apology is a dead end. It happens when the model names one real meal and one it
    // invented; the real one is still the likeliest target.
    return proposeChoice(deps, userId, input.text, found, route.question);
  }

  // Correction and redate act on a target, and there are two ways to have one: the reply's focus
  // meal, or a `mealId` the agent found for itself. THE FOCUS WINS — a user who replied to meal A
  // must never have meal B edited, however confident the model is about B.
  const target = focus ?? (route.mealId ? await mealById(db, userId, route.mealId) : undefined);
  if (!target) {
    // A `mealId` that resolves to nothing means the model named a meal that is not the caller's, or
    // one that has since been deleted. Distinct from having named none at all, and the user should
    // be told their target is gone rather than fobbed off with the generic failure.
    if (route.mealId) {
      console.warn(`[eait] ${route.intent} named an unreachable meal user=${userId}`);
      return { kind: "target-gone", on: route.intent };
    }
    // No id at all — recover from the food the edit names, or that the user's sentence does,
    // rather than discarding the message. See `recoverTargets`.
    const recovered = await recoverTargets(
      db,
      userId,
      { ...(route.intent === "correction" ? { items: route.analysis.items } : {}), text: input.text },
      date,
    );
    if (recovered.length === 0) {
      console.warn(`[eait] ${route.intent} intent without a target user=${userId}, nothing matched`);
      return { kind: "analysis-failed" };
    }
    console.log(
      `[eait] untargeted ${route.intent} recovered by name match user=${userId} candidates=${recovered.length}`,
    );
    // Never applied straight through, however confident the match: this target was inferred by
    // string overlap, which is weaker evidence than the model naming an id, not stronger.
    if (recovered.length > 1) return proposeChoice(deps, userId, input.text, recovered);
    return proposeEdit(deps, userId, route, recovered[0]!, date);
  }

  // An INFERRED target waits for a tap; a replied-to one applies immediately. The distinction is
  // the whole confirm-first rationale: pointing at a card is unambiguous, reading a sentence is not.
  if (!focus) return proposeEdit(deps, userId, route, target, date);

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
