// The meal flows, transport-agnostic. Extracted from `tg_bot/bot.ts`'s `process*` functions
// (migration stage 5, `docs/design/2026-07-28-mastra-engine-boundary.md`).
//
// What moved: the active-state gate, both cap checks and the `llm_calls` metering, repertoire
// construction, the consistency observation, the meal write plus first-photo eventing, and the
// daily-totals read. What did NOT move: rendering, i18n, reactions, album buffering, the rejection
// log, and reply-to-message mapping — all Telegram-shaped, all still in `tg_bot/`.
//
// The tell that the boundary is in the right place: nothing in this file imports `i18next`,
// `grammy`, or anything under `tg_bot/`, and nothing in it can send a message.

import {
  berlinDate, berlinDateMinus, berlinTime, dailyTotals, getUser, hasEvent, insertMeal, logEvent,
  logLlmCall, recentMealItems,
} from "../db.ts";
import { buildRepertoire } from "../repertoire.ts";
import { checkConsistency } from "../consistency.ts";
import { profileFromRow } from "./profile.ts";
import { checkCaps } from "./caps.ts";
import type { EngineDeps, UserId } from "./deps.ts";
import type { LogPhotoResult, MealHint } from "./results.ts";
import type { MealAnalysis, MealContext } from "../types.ts";

/**
 * How far back the identification prior looks. A window, not a memory: a food dropped a season ago
 * should stop steering the model, and an unbounded history would grow this per-photo query without
 * limit.
 */
const REPERTOIRE_DAYS = 90;

export interface LogPhotoInput {
  /**
   * Thunks, not bytes: on Telegram the download is a network round trip that must not be paid for
   * before the caps are checked, and a download failure must cost no billed call. A mobile upload
   * resolves its thunk from the request body. Either way the bytes are held in memory, handed to
   * the analyzer, and dropped — no disk write, no photo path, ever.
   */
  images: Array<() => Promise<Uint8Array>>;
  caption?: string;
  /**
   * Fired once the request has passed the onboarding gate and is going to be processed. The bot
   * uses it for the 👀 reaction; a mobile client can start a spinner. Deliberately after the gate
   * (a refusal should not be preceded by "seen") and before the caps — it means "seen", not
   * "will analyze". Never awaited, and a throw from it can never reach the pipeline.
   */
  onAccepted?: () => void;
}

const fire = (hook: (() => void) | undefined, userId: UserId): void => {
  void Promise.resolve()
    .then(() => hook?.())
    .catch((e) => console.warn(`[eait] onAccepted hook failed user=${userId}: ${(e as Error)?.message}`));
};

/** Which nudge to show. The model flagging its own estimate as shaky earns the stronger ask. */
const hintFor = (analysis: MealAnalysis): MealHint =>
  // Prefix-match so a qualifier ("low (mixed dish)") cannot turn the nudge off; the schema already
  // normalizes casing.
  analysis.confidence.startsWith("low") ? "lowConfidence" : "correction";

/**
 * Analyze photos and, if they are food, log the meal.
 *
 * Returns a result union; it renders nothing and sends nothing. The surface maps `kind` onto its
 * own copy and its own idea of a card.
 */
export async function logPhotoMeal(
  deps: EngineDeps,
  userId: UserId,
  input: LogPhotoInput,
): Promise<LogPhotoResult> {
  const { db, config } = deps;
  const u = await getUser(db, userId);
  if (!u || u.state !== "active") return { kind: "not-onboarded" };

  fire(input.onAccepted, userId);

  const prof = profileFromRow(u);
  const date = berlinDate(new Date(), config.tz);

  const capped = await checkCaps(deps, userId, date);
  if (capped) return { kind: "cap-exceeded", scope: capped.scope };

  // The user's own diary as an identification prior. Read here rather than inside the analyzer,
  // which owns the prompt and the parse and must stay free of db access. `berlinDateMinus` for the
  // usual DST reason — subtracting fixed 24h spans then re-deriving a Berlin date is off by one
  // across a transition near midnight.
  const repertoire = buildRepertoire(
    await recentMealItems(db, userId, berlinDateMinus(date, REPERTOIRE_DAYS)),
  );
  const context: MealContext = {
    ...(input.caption === undefined ? {} : { caption: input.caption }),
    localTime: berlinTime(new Date(), config.tz),
    ...(repertoire.length ? { repertoire } : {}),
  };

  let analysis: MealAnalysis;
  try {
    const images: Uint8Array[] = [];
    for (const get of input.images) images.push(await get()); // in-memory only; never written to disk
    // Metered only once the bytes are in hand: a download failure costs no engine call and must not
    // burn a cap unit.
    await logLlmCall(db, userId, date, "photo");
    analysis = await deps.analyzePhoto(images, prof, context);
  } catch (e) {
    console.error(`[eait] analyze failed user=${userId}: ${(e as Error)?.message ?? e}`);
    return { kind: "analysis-failed" };
  }

  // confidence is logged so a model drifting off the high/medium/low vocabulary is visible —
  // off-vocabulary values silently route to the generic hint, and nothing else would say so.
  console.log(
    `[eait] photo user=${userId} isFood=${analysis.isFood} kcal=${analysis.kcal} ` +
      `items=${analysis.items.length} confidence=${analysis.confidence}`,
  );
  // OBSERVE ONLY. The analysis is not touched and the user sees no difference — this exists to
  // produce a fire rate, because the right action on a mismatch depends entirely on whether it
  // trips on 3% of meals or 30%.
  for (const f of checkConsistency(analysis).findings) {
    console.warn(
      `[eait] inconsistent user=${userId} kind=${f.kind} stated=${f.stated} derived=${f.derived}`,
    );
  }

  if (!analysis.isFood) return { kind: "not-food" };

  const mealId = crypto.randomUUID();
  // Event-based, not "has any meal": text meals write to `meals` too, so a "has meals" check would
  // suppress the funnel event for a user whose first photo follows a text meal.
  const firstPhoto = !(await hasEvent(db, userId, "first_photo"));
  await insertMeal(db, {
    id: mealId, user_id: userId, ts: new Date().toISOString(), date, analysis,
    model: config.llmModel, user_message_id: null,
  });
  if (firstPhoto) await logEvent(db, userId, "first_photo");
  console.log(`[eait] meal stored ${mealId} user=${userId}`);

  return {
    kind: "logged",
    mealId,
    analysis,
    totals: await dailyTotals(db, userId, date),
    date,
    hint: hintFor(analysis),
  };
}
