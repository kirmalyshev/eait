// Logging a meal, and editing one after the fact.
//
// TWO INVARIANTS THIS FILE CARRIES:
//
//  1. PHOTOS LIVE WITH THE MEAL. Bytes are read into memory, handed to the analyzer, and — only
//     once the meal is logged — stored in `meal_photos`, read back by `meal_id AND user_id`,
//     erased with the meal or the account. Nothing is written for a refused or failed turn, and a
//     store failure never fails the turn. Never on disk, never logged, never in a result.
//  2. VERDICTS ARE COMPUTED HERE, NEVER ACCEPTED. Not from the model, and not from the client. They
//     are derived from the user's caps after every write — including every manual edit — so a
//     verdict can never describe numbers that have since changed.

import {
  type ClipEstimateResponse, type DailyTotals, type EditMealRequest, type LogPhotoResult, type MealAnalysis, type MealHint,
  type Lang, type MealItem, type MealLogged, type MealProposed, type MealQuestion, type MealRecord,
  type MealRedated, type MealUpdated, type PhotoEvent,
  type Profile, type TargetGone, type ConfirmMealResult, type Refusal, type VerdictDimension,
  explainTargets, verdictsFromTargets, visibleVerdicts,
} from "@eait/shared";
import {
  LANG_TAG, PHOTO_MODEL_CALLS, UNIT_KCAL, VERDICT_DIMENSIONS, dateMinus, healthScore, localDate, localTime,
  mealCopyFor, mealIsGuessed, spellUnit, streamCopyFor, verdictHeadline, verdictInlineText,
  verdictLabels, verdictNoun, wholeNumbers, windowStart,
} from "@eait/shared";
import type { EngineDeps } from "./deps.ts";
import { MAX_OPTION, MAX_QUESTION, normalizePromptText } from "../llm/prompt.ts";
import { isCookingFat, prepareAnalysis } from "./analysis.ts";
import { charge, checkCaps, refundGatewayRefusal, releaseSample } from "./caps.ts";
import { afterLog, firstVerdict, remember } from "./chat.ts";
import { scriptedLine } from "@eait/shared";
import { clampDayOffset, emptyEstimate, imageMime, type AnalyzedMeal } from "../llm/port.ts";
import { itemScanner } from "../llm/partial.ts";
import { eatenAt, once } from "./turns.ts";
import { isAnonymous } from "./identity.ts";

/** Images arrive as thunks so nothing is READ until the caps have passed. */
export interface LogPhotoInput {
  images: (() => Promise<Uint8Array>)[];
  caption?: string;
  /** The phone's id for this turn: a second request carrying it is answered from the first (#708). */
  clientId?: string;
  /** When the photo was taken. The meal is dated by it; the analysis is charged today. */
  capturedAt?: string;
  /** When the request carrying the turn arrived; the queue leg's zero. Absent on calls whose turn came another way. */
  receivedAt?: number;
}

/** Sum a day's meals. The single place totals are produced, so two views cannot disagree. */
export function sumTotals(meals: readonly MealRecord[]): DailyTotals {
  const t: DailyTotals = {
    kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, satfat_g: 0, fiber_g: 0, sugar_g: 0, sodium_mg: 0,
    // #47: one guessed meal makes the day's figures a guess, and this is the only producer of a
    // `DailyTotals`, so the surfaces that print one cannot disagree about it.
    guessed: meals.some(mealIsGuessed),
  };
  for (const m of meals) {
    t.kcal += m.kcal; t.protein_g += m.protein_g; t.carbs_g += m.carbs_g; t.fat_g += m.fat_g;
    t.satfat_g += m.satfat_g; t.fiber_g += m.fiber_g; t.sugar_g += m.sugar_g; t.sodium_mg += m.sodium_mg;
  }
  return t;
}

/**
 * Which nudge to show under a freshly logged meal.
 *
 * Not decoration. The incumbent's second-largest complaint cluster is wrong estimates and its
 * smallest is "fixing a wrong result doesn't work" — a correction loop nobody can find is the same
 * as not having one. A low-confidence analysis says so and invites the fix immediately.
 */
function hintFor(analysis: AnalyzedMeal): MealHint {
  return analysis.confidence === "low" ? "lowConfidence" : "correction";
}

/**
 * Recompute the verdicts for an analysis against the user's current caps, then gate them.
 *
 * Exported because `handleText` needs it too. A proposed meal is the ONE analysis the app renders
 * without a store round-trip, so it is the one place an analyzer's raw output — which has no
 * `verdicts` field at all — could reach a client, and did.
 */
export async function gatedVerdicts(deps: EngineDeps, userId: string, a: {
  kcal: number; satfat_g: number; sodium_mg: number;
}) {
  const profile = await deps.store.getProfile(userId);
  if (!profile) return {};
  const { targets } = explainTargets(profile);
  // Belt and braces, both cheap, both on a medical claim: derive only declared dimensions, then
  // filter for declared dimensions again.
  return visibleVerdicts(verdictsFromTargets(a, targets), profile.restrictions);
}

export interface PhotoRead {
  kind: "read";
  analysis: AnalyzedMeal;
  question: ReturnType<typeof prepareAnalysis>["question"];
  images: Uint8Array[];
  analysisId: string;
}

/**
 * THE ONE PHOTO TURN, from the caps to a prepared analysis (#608). `logPhotoMeal` logs what it
 * returns as a new meal; `reanalyzeMeal` and `editLine` write it over an existing one. Caps
 * first; the bytes are read after them and sniffed before the charge (the provider rejects HEIC
 * with a 400 that stays charged); the charge before the model call (a failed call still costs
 * money); the answer reconciled and gated on `isFood` before anyone writes a row. A third copy
 * of this was the reason to move it.
 */
export async function analyzePhotos(
  deps: EngineDeps,
  userId: string,
  profile: Profile,
  date: string,
  read: () => Promise<Uint8Array[]>,
  caption: string | undefined,
  onEvent?: (event: PhotoEvent) => void,
  /** When the plate was photographed; the analyzer reads the time of day off it. `date` is the charge's. */
  eaten: Date = new Date(),
  scope: "photo" | "clip" = "photo",
  /**
   * When the request carrying the turn arrived — the queue leg's zero. It cannot come off
   * `capturedAt`/`eaten`: a turn kept in an outbox and sent hours later would report its whole
   * offline wait as queue and drag the p95 with it (#220). The default is this call's own
   * entry — receipt enough for callers whose turns are never kept.
   */
  receivedAt: number = Date.now(),
): Promise<PhotoRead | Refusal> {
  const zone = deps.config.timezone;
  // The stream's first word — "Reading the plate…", already in the account's language. A client
  // prints it; it never composes it: the web bundle holds no i18n catalog.
  onEvent?.({ kind: "reading", line: streamCopyFor(profile.lang).reading });
  const refusal = await checkCaps(deps, userId, date, scope);
  if (refusal) return refusal;

  // Sniffed AFTER the cap (a refused account never has its bytes read) and BEFORE the charge: the
  // provider rejects HEIC with a 400 that stays charged, and HEIC is what an iPhone hands over
  // unless the capture is re-encoded — without this the first real photo spent the sample and
  // logged nothing.
  const images = await read();
  if (images.length === 0) return { kind: "no-photo" };
  if (images.some((b) => imageMime(b) === null)) return { kind: "unsupported-image" };

  // Recorded BEFORE the call. A failed model call still costs money, so a cap that only counts
  // successes is a cap a retry loop walks straight through.
  const { analysisId, onCost } = await charge(deps, userId, date, scope);

  const { targets } = explainTargets(profile);

  // The turn's own clock, for the latency the admin page reads: receipt-to-call in `queue` (the
  // upload and the caps live in it), call-to-first-item, call-to-answer. Written ONCE, when the
  // turn settles, and like `addCost` a write that finds no row is a log line, not a failure.
  const clock = { calledAt: 0, firstItem: null as number | null };
  const reportTiming = () => void deps.store.recordTiming(userId, analysisId, {
    queue: Math.max(0, clock.calledAt - receivedAt),
    firstItem: clock.firstItem,
    total: Date.now() - clock.calledAt,
  }).then(
    (landed) => { if (!landed) console.error(`[eait] timing not recorded: analysis ${analysisId} is gone`); },
    (e: unknown) => { console.error(`[eait] timing not recorded: ${(e as Error)?.message ?? e}`); },
  );

  // The weighing words ride the item events: same rule as `reading` — the line is sent, not derived.
  const weighing = streamCopyFor(profile.lang).weighing;
  const onDelta = onEvent ? itemScanner((index, item) => {
    if (clock.firstItem === null) clock.firstItem = Date.now() - clock.calledAt;
    onEvent({ kind: "item", index, item, line: weighing });
  }) : undefined;

  let analysis: AnalyzedMeal;
  clock.calledAt = Date.now();
  try {
    analysis = await deps.llm.analyzePhoto({
      images, profile, targets, onCost,
      ...(caption !== undefined ? { caption } : {}),
      localTime: localTime(zone, eaten),
      repertoire: await buildRepertoire(deps, userId, localDate(zone, eaten)),
      // What this person's own corrections say about their portions. Unlike the repertoire, this
      // one is allowed to move the grams — see `buildUserText`.
      portionPriors: await deps.store.portionPriors(userId),
    }, onDelta);
  } catch (e) {
    // A failure's timing is data too — a timeout IS a latency reading, and the percentile over
    // only the survivors would flatter the model. The write lands or logs; the refusal is unchanged.
    reportTiming();
    // A gateway refusal generated nothing and was billed nothing, so the analysis charged above is
    // given back. Every other failure may have cost real money and stays charged.
    const refunded = await refundGatewayRefusal(deps, userId, analysisId, e);
    // Billed or not, nothing reached the person, so the sample is still theirs (#44).
    if (!refunded) await releaseSample(deps, userId, analysisId);
    // Logged, never returned: the message can carry the prompt, and the prompt carries the user's
    // medical free text.
    console.error(`[eait] photo analysis failed: ${(e as Error).message}${refunded ? " (analysis refunded)" : ""}`);
    return { kind: "analysis-failed" };
  }
  reportTiming();
  // `images` is returned to the caller, which stores them after the row exists.

  // Nothing an analyzer returns is stored unreconciled: the totals are checked against the items
  // and the prompt-side fields come off. Before the `isFood` gate, so both answers get the same
  // treatment. `question` is handed back rather than dropped — it is the only one of the two that
  // has anywhere to go.
  const prepared = prepareAnalysis(analysis);
  analysis = prepared.analysis;

  if (!analysis.isFood) {
    // An answer, but no verdict: not the meal on us (#44).
    await releaseSample(deps, userId, analysisId);
    return { kind: "not-food" };
  }
  if (emptyEstimate(analysis)) {
    // The model claimed food and itemised none of it — a failed read, not an empty plate (#248).
    // Same rule as the gate above: nothing reached the person, so the sample is still theirs.
    await releaseSample(deps, userId, analysisId);
    return { kind: "analysis-failed" };
  }
  return { kind: "read", analysis, question: prepared.question, images, analysisId };
}

/**
 * The App Clip's estimate: an anonymous device account's sample, read and answered, nothing stored
 * but the charge. No meal, no photos, no verdicts — the account has no targets to judge against.
 */
export async function estimatePhoto(
  deps: EngineDeps,
  userId: string,
  images: (() => Promise<Uint8Array>)[],
): Promise<{ kind: "estimated"; estimate: ClipEstimateResponse } | { kind: "not-anonymous" } | Refusal> {
  if (!(await isAnonymous(deps, userId))) return { kind: "not-anonymous" };
  const profile = await deps.store.getProfile(userId);
  if (!profile) return { kind: "not-onboarded" };
  // Charged on the UTC day, which is the day `clipDailyMax` counts.
  const read = await analyzePhotos(deps, userId, profile, new Date().toISOString().slice(0, 10),
    () => Promise.all(images.map((r) => r())), undefined, undefined, new Date(), "clip");
  if (read.kind !== "read") return read;
  const { items, kcal, protein_g, carbs_g, fat_g, confidence } = read.analysis;
  return { kind: "estimated", estimate: { items, kcal, protein_g, carbs_g, fat_g, confidence } };
}

export async function logPhotoMeal(
  deps: EngineDeps,
  userId: string,
  input: LogPhotoInput,
  /**
   * The live turn's side channel: each item as the analyzer closes it. The result is still the
   * return value — the route writes it as the stream's last line. Without it nothing streams:
   * a JSON caller pays for exactly what it did.
   */
  onEvent?: (event: PhotoEvent) => void,
): Promise<LogPhotoResult> {
  return once(deps, userId, input.clientId, PHOTO_MODEL_CALLS, (d) => logPhotoTurn(d, userId, input, onEvent));
}

async function logPhotoTurn(
  deps: EngineDeps,
  userId: string,
  input: LogPhotoInput,
  onEvent?: (event: PhotoEvent) => void,
): Promise<LogPhotoResult> {
  const profile = await deps.store.getProfile(userId);
  if (!profile || profile.onboarded_at === null) return { kind: "not-onboarded" };

  // TWO DAYS, and they differ for a photo taken offline and sent later (#708). The meal is dated
  // when it was eaten. The caps and the charge are today's, or a backdated capture would be a way
  // around a daily allowance.
  const eaten = eatenAt(input.capturedAt);
  const date = localDate(deps.config.timezone, eaten);
  const today = localDate(deps.config.timezone);

  const read = await analyzePhotos(deps, userId, profile, today,
    () => Promise.all(input.images.map((r) => r())), input.caption, onEvent, eaten,
    "photo", input.receivedAt);
  if (read.kind !== "read") return read;
  const { analysis, images, analysisId } = read;
  const question = await mayAsk(deps, userId, today, analysis, read.question);

  const verdicts = await gatedVerdicts(deps, userId, analysis);
  const record: MealRecord = {
    ...analysis,
    id: crypto.randomUUID(),
    user_id: userId,
    ts: eaten.toISOString(),
    date,
    verdicts,
    // Computed at write for the card this turn returns; the stores recompute it on every READ, so
    // a later edit can never leave the score describing numbers that changed.
    healthScore: healthScore({ ...analysis, verdicts }, profile.restrictions),
    corrected: false,
    model: deps.config.llmModel,
    // Stored, because the answer arrives as its own turn and has to find the question again — and
    // named explicitly rather than left to the spread, which would carry the analyzer's raw one
    // past every condition `mayAsk` just applied.
    question,
  };
  await deps.store.insertMeal(record);
  // Stored AFTER the meal is inserted and never for a refused or failed turn — there is no row for
  // those to belong to. A store failure is a log line, not a failed turn: the meal is logged and the
  // user has their card, the same rule the thread write follows.
  const stored = await deps.store.putPhotos(userId, record.id, images.map((b) => ({ mime: imageMime(b)!, bytes: b })))
    .then(() => true, (e: unknown) => { console.error(`[eait] photos not stored: ${(e as Error)?.message ?? e}`); return false; });

  const totals = sumTotals(await deps.store.mealsForDate(userId, date));
  // The bubble names the meal; the bytes are fetched through the scoped route, never carried in a
  // line. Then the card, then — on the account's first meal only — Spud's verdict in the design's words.
  await remember(deps, userId, async () => {
    const greeting = await firstVerdict(deps, userId, profile, record, totals, "photo", input.caption ?? null);
    return {
      lines: [
        // A bubble that names a meal with no photo behind it is an empty frame in the thread.
        { role: "user", kind: "photo", text: input.caption ?? null, mealId: stored ? record.id : null, analysisId },
        { role: "assistant", kind: "meal", mealId: record.id, event: "logged", speaker: "gabie" },
        ...greeting.lines,
        // A declared cap that ran high still gets its line (#130); an empty greeting is exactly
        // the condition for saying it here — the greeting is spent — and it is already known.
        ...(greeting.lines.length === 0 ? await afterLog(deps, userId, record, totals) : []),
        // LAST, and a plain assistant line like any other model prose in this thread: the estimate
        // is delivered, then queried. There is no line kind for it, because a question that needed
        // one would be a question the Chat tab could not show when the app scrolls back to it.
        ...(question ? [{ role: "assistant", kind: "text", text: question.text, speaker: "gabie", model: deps.config.llmModel } as const] : []),
      ],
      ...(greeting.undo ? { undo: greeting.undo } : {}),
    };
  });
  return {
    kind: "logged", mealId: record.id,
    analysis: { ...analysis, verdicts: record.verdicts, healthScore: record.healthScore },
    totals, date, hint: hintFor(analysis),
    ...verdictWordsFor(record.verdicts, profile.lang),
    ...(question ? { question } : {}),
  } satisfies MealLogged;
}

/**
 * Whether the model's one question may actually be put to this user, and the question if so.
 *
 * Four conditions, and every one of them is about whether an answer could help rather than about
 * whether the model wanted to ask:
 *
 *  - LOW CONFIDENCE ONLY. A question under a plate the card calls confident reads as the app
 *    doubting an estimate it just presented as good.
 *  - NOT THE FIRST MEAL. copy.md gives the first card Spud's verdict, and an interrogation on top
 *    of the one screen that has to show what this product does is one screen doing two jobs.
 *  - THE ACCOUNT CAN AFFORD THE REPLY. A tapped chip is a billed correction, so `checkCaps` is
 *    asked — as a dry check, which it is: it reads and never charges — with the TEXT scope the
 *    answer will actually spend. Asking somebody whose sample is gone opens chips onto a 402.
 *  - IT IS SAFE TO REPEAT. The text and the options go through `normalizePromptText` because both
 *    become a line in the thread and, on the reply, a quoted span in the next prompt.
 *
 * The first-meal test counts analyses AFTER this photo's own charge, so `1` is this one and `> 1`
 * means the account has done something before. A text turn before the first photo counts as that,
 * which is the intended reading: the introduction has happened.
 */
async function mayAsk(
  deps: EngineDeps,
  userId: string,
  date: string,
  analysis: AnalyzedMeal,
  question: MealQuestion | null,
): Promise<MealQuestion | null> {
  if (!question || analysis.confidence !== "low") return null;
  if ((await deps.store.countUserAnalyses(userId)) <= 1) return null;
  if (await checkCaps(deps, userId, date, "text")) return null;
  return {
    text: normalizePromptText(question.text, MAX_QUESTION),
    options: question.options.map((o) => normalizePromptText(o, MAX_OPTION)),
  };
}

/**
 * The manual edit — "possibility to edit the LLM answer", in its direct form.
 *
 * The natural-language form goes through `handleText` and ends up here too, so both paths share one
 * write, one verdict recomputation, and one `corrected` flag. There is deliberately no way to edit
 * a meal without recomputing verdicts.
 */
export async function editMeal(
  deps: EngineDeps,
  userId: string,
  mealId: string,
  request: EditMealRequest,
  // The chat path writes its own card AFTER the user's words; the editor has no words, so the card
  // is written here. One write path, two thread shapes — copy.md offers both corrections as equals.
  //
  // `measure` is off for the natural-language path, and that is the whole reason it exists: an NL
  // correction is a fresh re-analysis of the WHOLE plate by the text model, so every item it
  // re-emits with different grams would be recorded as this person's portion — when it is one
  // estimator disagreeing with the other. The prior learns from the manual editor only, where every
  // changed number is one a person typed.
  opts: { thread?: boolean; measure?: boolean } = {},
): Promise<MealUpdated | TargetGone> {
  const existing = await deps.store.getMeal(userId, mealId);
  // Scoped read: another user's meal id resolves to null here, indistinguishable from a deleted one.
  if (!existing) return { kind: "target-gone", on: "correction" };
  // Every item at 0 g is no meal, whichever path sent it (ieat-app#1224): those items are ignored
  // rather than stored as a 0 kcal meal that still counts. One item zeroed is a real edit.
  const { items: sentItems, ...sentTotals } = request;
  const patch: EditMealRequest = sentItems !== undefined && sentItems.length > 0 && sentItems.every((i) => i.grams === 0)
    ? sentTotals : request;

  // When a patch replaces the items but says nothing about a total, the total is DERIVED from the
  // items — `patch.kcal ?? existing.kcal` used to keep the old figure on top of new items, which
  // an items-only edit (the phone's and web's ingredient editors send `{ items }` alone) left
  // stale. A field NO item reports cannot be derived — absent is not zero — so it keeps the
  // stored figure. An explicit total still wins over either.
  //
  // #196: the four fields items do NOT carry (satfat, fibre, sugar, sodium) would otherwise keep
  // describing the old plate after a grams change — they scale by the edit's kcal ratio. The same
  // goes for a macro only SOME items report: a silent item's share is unknown, never zero, so the
  // stored figure scales rather than being summed without it.
  const mergedKcal = patch.kcal
    ?? (patch.items !== undefined && patch.items.every((i) => i.kcal !== undefined)
      ? patch.items.reduce((s, i) => s + (i.kcal ?? 0), 0)
      : existing.kcal);
  const kcalRatio = patch.items !== undefined && existing.kcal !== 0
    ? mergedKcal / existing.kcal
    : 1;
  const scale = (kept: number): number => Math.round(kept * kcalRatio * 10) / 10;
  const derived = <K extends "kcal" | "protein_g" | "carbs_g" | "fat_g">(field: K, sent: number | undefined, kept: number): number => {
    if (sent !== undefined) return sent;
    if (patch.items === undefined) return kept;
    if (patch.items.every((i) => i[field] !== undefined)) return patch.items.reduce((s, i) => s + (i[field] ?? 0), 0);
    return patch.items.some((i) => i[field] !== undefined) ? scale(kept) : kept;
  };
  const scaled = (sent: number | undefined, kept: number): number =>
    sent ?? (patch.items !== undefined ? scale(kept) : kept);
  const merged = {
    items: patch.items ?? existing.items,
    kcal: mergedKcal,
    protein_g: derived("protein_g", patch.protein_g, existing.protein_g),
    carbs_g: derived("carbs_g", patch.carbs_g, existing.carbs_g),
    fat_g: derived("fat_g", patch.fat_g, existing.fat_g),
    satfat_g: scaled(patch.satfat_g, existing.satfat_g),
    fiber_g: scaled(patch.fiber_g, existing.fiber_g),
    sugar_g: scaled(patch.sugar_g, existing.sugar_g),
    sodium_mg: scaled(patch.sodium_mg, existing.sodium_mg),
  };

  const updated = await deps.store.updateMeal(userId, mealId, {
    ...merged,
    verdicts: await gatedVerdicts(deps, userId, merged),
    corrected: true,
    // One question per meal, asked once. Cleared by the write that answers it — and by a manual
    // edit too, which is the same write: once the user has changed the numbers themselves, the
    // question is about a plate that no longer exists, and the next `GET /day` would offer the
    // chips again over an answer already given.
    question: null,
  });
  // Not redundant with the read above: the row can vanish between the two (a concurrent account
  // delete). A correction that silently succeeded against nothing is worse than one that says so.
  if (!updated) return { kind: "target-gone", on: "correction" };

  // What the edit measured. AFTER the write and never able to undo it: the correction is what the
  // user asked for, and the measurement is only what we get out of it.
  if (patch.items && opts.measure !== false) {
    const corrections = portionCorrections(existing.items, patch.items);
    if (corrections.length > 0) {
      await deps.store.recordPortionCorrections(userId, corrections).catch((e: unknown) => {
        console.error(`[eait] portion correction not recorded: ${(e as Error)?.message ?? e}`);
      });
    }
  }

  const totals = sumTotals(await deps.store.mealsForDate(userId, updated.date));
  const profile = await deps.store.getProfile(userId);
  const lang = profile?.lang ?? "en";
  // #119: ONE computed line names the change and what the verdicts did. It is null on an edit
  // that moved nothing (a rename), which keeps #49's rule: the card, and no line about it. The
  // SAME string rides the result — the screen that made the write is where it is shown first.
  const line = profile ? changeLine(existing, updated, profile) : null;
  if (opts.thread !== false) {
    await remember(deps, userId, async () => [
      { role: "assistant", kind: "meal", mealId, event: "updated", speaker: "gabie" },
      ...(line ? [{ role: "assistant", kind: "text", text: line, speaker: "gabie", mealId } as const] : []),
    ]);
  }
  return {
    kind: "updated", mealId, analysis: toAnalysis(updated), totals, date: updated.date, via: "manual",
    line, ...verdictWordsFor(updated.verdicts, lang),
  };
}

/**
 * THE ONE SANCTIONED WAY a meal's date changes (#150): by offset, clamped to the bound the router
 * answers with, against the day the move was made (`at` — the turn path passes the turn's capture
 * time, so a queued "that was yesterday" still means the day it was typed). A client never sends a
 * `YYYY-MM-DD`: `EditMealRequest` has no `date` field on purpose, and a bare number cannot put a
 * meal on a day the bound would not let it reach.
 *
 * Reached two ways: the router's `redate` intent, and `POST /v1/meals/:id/redate` — the meal
 * surface's "Move to yesterday", unbilled. Both write the same thread card a turn's re-date does
 * (`kind: "meal", event: "redated"`), so the thread reads identically whichever way it happened.
 */
export async function redateMeal(
  deps: EngineDeps,
  userId: string,
  mealId: string,
  dayOffset: unknown,
  // `at` is the move's clock: the turn path passes the turn's capture time, so a queued "that was
  // yesterday" still means the day it was typed. `thread` is the route's only — the chat path's
  // `keep` writes the redated card under the user's words itself, so a second write here would
  // land two cards for one move.
  opts: { thread?: boolean; at?: Date } = {},
): Promise<MealRedated | TargetGone> {
  const date = dateMinus(localDate(deps.config.timezone, opts.at), clampDayOffset(dayOffset));
  const moved = await deps.store.updateMeal(userId, mealId, { date });
  if (!moved) return { kind: "target-gone", on: "redate" };
  const totals = sumTotals(await deps.store.mealsForDate(userId, date));
  if (opts.thread === true) {
    await remember(deps, userId, [{ role: "assistant", kind: "meal", mealId: moved.id, event: "redated", speaker: "gabie" }]);
  }
  return { kind: "redated", mealId: moved.id, analysis: toAnalysis(moved), totals, date };
}

/**
 * What an edit changed about the portions, item by item.
 *
 * Matched on `name_en ?? name` — the same key `buildRepertoire` groups by, so both priors talk
 * about the same foods — and one stored item answers at most one edited item, or a plate listing a
 * food twice would measure the same before against two afters.
 *
 * A zero before is a division by zero rather than a small portion, and is dropped here as well as
 * in the store: this is the only caller, and no such row may exist to poison a median.
 */
function portionCorrections(before: readonly MealItem[], after: readonly MealItem[]) {
  const was = new Map<string, number>();
  for (const it of before) {
    const key = it.name_en ?? it.name;
    if (!was.has(key)) was.set(key, it.grams);
  }
  const out: { name_en: string; grams_before: number; grams_after: number }[] = [];
  for (const it of after) {
    const key = it.name_en ?? it.name;
    const grams_before = was.get(key);
    if (grams_before === undefined) continue;
    was.delete(key);
    if (grams_before <= 0 || grams_before === it.grams) continue;
    out.push({ name_en: key, grams_before, grams_after: it.grams });
  }
  return out;
}

/**
 * "A change, named" (#119) — the ONE line written into the thread after an edit lands, whichever
 * path made it: Gabie's, `speaker: "gabie"`. It names the change (the items' grams and the meal's
 * kcal, before → after) and says what the verdicts did — one sentence per dimension that moved,
 * and one for the high ones that stayed.
 *
 * COMPUTED, which is the point: it states verdicts, and verdicts are never the model's to write —
 * `visibleVerdicts` is read on the stored rows, before and after, gated on the restrictions as the
 * profile declares them NOW. The words are `MEAL_COPY`'s `change*` templates; nothing here writes
 * freehand. Returns null when the edit moved nothing the line can name (a rename — its card is
 * already written, and a sentence about it would be #49's lie again).
 */
export function changeLine(
  before: MealRecord,
  after: MealRecord,
  profile: Pick<Profile, "lang" | "restrictions">,
): string | null {
  const lang = profile.lang;
  const copy = mealCopyFor(lang);
  const n = wholeNumbers(lang);
  const fill = (template: string, params: Record<string, string>): string =>
    template.replace(/\{(\w+)\}/g, (whole, key: string) => params[key] ?? whole);
  const dimName = (d: VerdictDimension) => verdictNoun(d, lang);

  const parts: string[] = [];

  // The change itself. Items are matched on the canonical key like `portionCorrections` — the
  // prior and the line must agree about which rice moved — and the display name is AFTER's.
  const was = new Map(before.items.map((i) => [i.name_en ?? i.name, i.grams]));
  const moved = after.items.flatMap((i) => {
    const g = was.get(i.name_en ?? i.name);
    return g !== undefined && g !== i.grams ? [{ item: i, gramsBefore: g }] : [];
  });
  const total = fill(copy.changeTotal, {
    kcalBefore: n(before.kcal), kcalAfter: n(after.kcal), kcal: UNIT_KCAL[lang],
  });
  if (moved.length > 0) {
    const items = new Intl.ListFormat(LANG_TAG[lang], { type: "conjunction" }).format(
      moved.map(({ item, gramsBefore }) => fill(copy.changeItem, {
        item: item.name, before: n(gramsBefore), after: n(item.grams), unit: spellUnit(lang, "g"),
      })));
    // Sentence case belongs to the position, not the stored name — the first character only, so
    // an "and"-joined second item keeps the case the analyzer gave it.
    parts.push(fill(copy.changeWithItems, { items, total })
      .replace(/^./, (c) => c.toLocaleUpperCase(LANG_TAG[lang])));
  } else if (before.kcal !== after.kcal) {
    parts.push(total);
  }

  // What the verdicts did. Only dimensions visible after the edit are spoken of; one that appeared
  // (a restriction declared between the writes) counts as a move onto its verdict.
  const beforeV = visibleVerdicts(before.verdicts, profile.restrictions);
  const afterV = visibleVerdicts(after.verdicts, profile.restrictions);
  const visible = VERDICT_DIMENSIONS.filter((d) => afterV[d] !== undefined);
  const changedDims = visible.filter((d) => beforeV[d] !== afterV[d]);
  const stillHigh = visible.filter((d) => beforeV[d] === afterV[d] && afterV[d] !== "good");
  // A verdict tail exists to say what THE EDIT did; nothing moved, nothing to say — the rename
  // case, whose card is written by the caller regardless.
  if (parts.length === 0 && changedDims.length === 0) return null;
  if (visible.length > 0 && visible.every((d) => afterV[d] === "good") && changedDims.length > 0) {
    // One dimension moving alone names itself; a fuller sweep is "All on plan now."
    parts.push(changedDims.length === 1 && visible.length === 1
      ? fill(copy.changeToPlan, { dim: dimName(changedDims[0]!) })
      : copy.changeAllOnPlan);
  } else {
    const landed = { good: copy.changeToPlan, warn: copy.changeToHigh, bad: copy.changeToVeryHigh } as const;
    for (const d of changedDims) parts.push(fill(landed[afterV[d]!], { dim: dimName(d) }));
    if (stillHigh.length === 1) parts.push(fill(copy.changeStillHighOne, { dim: dimName(stillHigh[0]!) }));
    else if (stillHigh.length === 2) parts.push(copy.changeStillHighTwo);
    else if (stillHigh.length >= 3) parts.push(copy.changeStillHighAll);
  }
  return parts.length > 0 ? parts.join(" ") : null;
}

/** Apply an LLM-produced correction. Same write path as a manual edit; only `via` differs. */
export async function applyCorrection(
  deps: EngineDeps,
  userId: string,
  mealId: string,
  analysis: AnalyzedMeal,
): Promise<MealUpdated | TargetGone> {
  const res = await editMeal(deps, userId, mealId, {
    items: analysis.items, kcal: analysis.kcal, protein_g: analysis.protein_g,
    carbs_g: analysis.carbs_g, fat_g: analysis.fat_g, satfat_g: analysis.satfat_g,
    fiber_g: analysis.fiber_g, sugar_g: analysis.sugar_g, sodium_mg: analysis.sodium_mg,
  }, { thread: false, measure: false });
  return res.kind === "updated" ? { ...res, via: "nl" } : res;
}

/**
 * ANOTHER ANGLE OF A MEAL ALREADY LOGGED. Stored, never re-analyzed, never charged (#304).
 *
 * The camera's pending screen is on the phone while the multipart request is still on the wire
 * with its photos in it, so a second shot cannot join it — the note beside it is queued and applied
 * as an ordinary correction, and this is the other half of that screen. Three ways out were
 * considered (#304); this is the one that costs the user nothing and moves no number under them.
 *
 * WHAT IT DELIBERATELY DOES NOT DO: ask the analyzer, touch the caps, recompute a verdict, or write
 * a line into the thread. The meal's numbers are exactly what they were, and `PhotoStrip` on the
 * meal screen renders the new angle the moment `photos` goes up. Making the numbers move is the
 * meal screen's existing "Re-read" — `reanalyzeMeal`, which IS charged, is a deliberate tap, and
 * already re-reads every stored photo, this one included.
 *
 * THE LIMIT IS COUNTED AGAINST WHAT IS ALREADY STORED, which is why the server decides it: the app
 * knows `limits.maxPhotosPerMeal` and the meal's own count and should refuse first, but two numbers
 * that must agree eventually will not. The JPEG sniff runs before anything is written, the same
 * guard `logPhotoMeal` puts in front of the charge.
 */
export async function attachPhotos(
  deps: EngineDeps,
  userId: string,
  mealId: string,
  images: Uint8Array[],
): Promise<
  | { kind: "attached"; mealId: string; photos: number }
  | { kind: "too-many"; limit: number }
  | TargetGone
  | { kind: "unsupported-image" }
> {
  // Scoped, like every other read: another account's meal id resolves to null, never to their row.
  const existing = await deps.store.getMeal(userId, mealId);
  if (!existing) return { kind: "target-gone", on: "correction" };
  if (images.length === 0) return { kind: "attached", mealId, photos: existing.photos ?? 0 };

  const typed = images.map((bytes) => ({ mime: imageMime(bytes), bytes }));
  if (typed.some((p) => p.mime === null)) return { kind: "unsupported-image" };

  const limit = deps.config.maxPhotosPerMeal;
  const held = existing.photos ?? 0;
  if (held + images.length > limit) return { kind: "too-many", limit };

  const photos = await deps.store.appendPhotos(userId, mealId, typed.map((p) => ({ mime: p.mime!, bytes: p.bytes })));
  // 0 means the meal stopped being the caller's between the read above and the write — deleted, in
  // practice. Answered as the delete race it is, not as a successful attach of nothing.
  if (photos === 0) return { kind: "target-gone", on: "correction" };
  return { kind: "attached", mealId, photos };
}

/**
 * The edit path (`rewriteMeal`) with no new text and no new photos: reads the caption off the
 * photo line, as the analyzer first saw it. The charging and `corrected: false` prose lives on
 * `rewriteMeal` already, and the change line (#119) is written there when the read moved numbers.
 */
export async function reanalyzeMeal(
  deps: EngineDeps,
  userId: string,
  mealId: string,
): Promise<MealUpdated | TargetGone | Refusal> {
  const existing = await deps.store.getMeal(userId, mealId);
  if (!existing) return { kind: "target-gone", on: "correction" };
  if ((existing.photos ?? 0) === 0) return { kind: "no-photo" };
  const profile = await deps.store.getProfile(userId);
  if (!profile || profile.onboarded_at === null) return { kind: "not-onboarded" };

  // The words that went with the photos, as the analyzer first saw them (#608): a re-read is an
  // edit that changed nothing, so it reads the same caption the edit path would.
  const line = await deps.store.photoLineFor(userId, mealId);
  return rewriteMeal(deps, userId, existing, profile, line?.text ?? undefined, async () => [], undefined);
}

/**
 * The analyzer reads a meal's photos again — the stored ones, plus `added` — and replaces the
 * numbers (#608). Charged like a photo, written like an edit but with `corrected: false` and the
 * current model: an estimator replacing itself is not a person correcting it. Never through
 * `editMeal`, which would record portion corrections. Writes the ONE thread line an edit earns
 * (#119): `changeLine`, computed — and nothing when the read changed nothing.
 *
 * `added` is a THUNK, read inside the spine's own `read` callback right alongside the stored
 * bytes — after the caps, before the charge — so a capped or refused turn never opens an angle
 * nobody is going to keep. `editLine`'s bytes therefore sit unread in the caller until this point.
 */
export async function rewriteMeal(
  deps: EngineDeps, userId: string, existing: MealRecord, profile: Profile,
  caption: string | undefined, added: () => Promise<Uint8Array[]>, onEvent: ((event: PhotoEvent) => void) | undefined,
): Promise<MealUpdated | TargetGone | Refusal> {
  const today = localDate(deps.config.timezone);
  // Captured here rather than trusted from `read.images`: the stored count can be stale (another
  // request mutated it since `existing` was read), so slicing `read.images` by it would risk
  // taking a stored photo for an added one.
  let addedBytes: Uint8Array[] = [];
  const read = await analyzePhotos(deps, userId, profile, today,
    async () => {
      addedBytes = await added();
      return [...(await deps.store.getPhotos(userId, existing.id)).map((p) => p.bytes), ...addedBytes];
    },
    caption, onEvent);
  if (read.kind !== "read") return read;
  const { analysis } = read;
  const updated = await deps.store.updateMeal(userId, existing.id, {
    items: analysis.items, kcal: analysis.kcal, protein_g: analysis.protein_g, carbs_g: analysis.carbs_g,
    fat_g: analysis.fat_g, satfat_g: analysis.satfat_g, fiber_g: analysis.fiber_g, sugar_g: analysis.sugar_g,
    sodium_mg: analysis.sodium_mg, notes: analysis.notes,
    verdicts: await gatedVerdicts(deps, userId, analysis),
    confidence: analysis.confidence, corrected: false, model: deps.config.llmModel, question: null,
  });
  if (!updated) return { kind: "target-gone", on: "correction" };
  // Stored AFTER the numbers that describe them, never for a refused turn. A store failure is a
  // log line, as `putPhotos` is in `logPhotoMeal`.
  if (addedBytes.length > 0) {
    await deps.store.appendPhotos(userId, existing.id, addedBytes.map((b) => ({ mime: imageMime(b)!, bytes: b })))
      .catch((e: unknown) => console.error(`[eait] photos not appended: ${(e as Error)?.message ?? e}`));
  }
  const totals = sumTotals(await deps.store.mealsForDate(userId, updated.date));
  // #119: a re-read is an edit like any other — the same computed line names what it changed,
  // written only when the read actually moved something.
  const line = changeLine(existing, updated, profile);
  if (line) await remember(deps, userId, [{ role: "assistant", kind: "text", text: line, speaker: "gabie", mealId: existing.id }]);
  return {
    kind: "updated", mealId: existing.id, analysis: toAnalysis(updated), totals, date: updated.date,
    via: "reanalysis", line, ...verdictWordsFor(updated.verdicts, profile.lang),
  };
}

/** A stored row, back to the analysis shape a card renders. */
export function toAnalysis(m: MealRecord): MealAnalysis {
  return {
    isFood: m.isFood, items: m.items as MealItem[], kcal: m.kcal, protein_g: m.protein_g,
    carbs_g: m.carbs_g, fat_g: m.fat_g, satfat_g: m.satfat_g, fiber_g: m.fiber_g,
    sugar_g: m.sugar_g, sodium_mg: m.sodium_mg, verdicts: m.verdicts, healthScore: m.healthScore,
    confidence: m.confidence, notes: m.notes,
  };
}

/**
 * The meal takes the proposal's id, so a confirm whose RESPONSE was lost — or one racing itself, or a
 * cancel that came after it — is answered with the meal already logged, not "expired", which would
 * send the user to describe it a second time, at a second billed call, into a duplicate. Any meal of
 * the caller's with that id answers this way, a photo meal's included: the id is theirs, nothing is
 * written, and "logged" is the true state of it.
 */
/**
 * The verdict words a write result carries — the pills plus the one-sentence headline the
 * first-meal card draws — composed where the verdicts were recomputed, in the account's language.
 */
const verdictWordsFor = (verdicts: MealRecord["verdicts"], lang: Lang) => ({
  verdictLabels: verdictLabels(verdicts, lang),
  verdictHeadline: verdictHeadline(verdicts, lang),
});

async function loggedAs(deps: EngineDeps, userId: string, id: string): Promise<MealLogged | null> {
  const already = await deps.store.getMeal(userId, id);
  if (!already) return null;
  const totals = sumTotals(await deps.store.mealsForDate(userId, already.date));
  const lang = (await deps.store.getProfile(userId))?.lang ?? "en";
  return {
    kind: "logged", mealId: already.id, analysis: toAnalysis(already), totals, date: already.date,
    hint: hintFor(already), ...verdictWordsFor(already.verdicts, lang),
  };
}

export async function confirmPendingMeal(
  deps: EngineDeps,
  userId: string,
  pendingId: string,
): Promise<ConfirmMealResult | { kind: "expired" }> {
  const pending = await deps.store.getPending(userId, pendingId);
  const alreadyLogged = () => loggedAs(deps, userId, pendingId);
  if (!pending) return (await alreadyLogged()) ?? { kind: "expired" };
  // The drop is the claim. A confirm and a cancel racing on one proposal must reach ONE outcome,
  // so whichever removes the row decides it; the other finds it gone and answers with what stands.
  if (!(await deps.store.dropPending(userId, pendingId))) return (await alreadyLogged()) ?? { kind: "expired" };

  // A proposal written before the empty-estimate gate (#248), or by a deploy that did not have it:
  // whatever the row claims, an analysis with no items is never recorded. The claim has already
  // dropped it, so a retry meets "expired" rather than being offered the same nothing again.
  if (!pending.analysis.isFood || pending.analysis.items.length === 0) return { kind: "analysis-failed" };

  let record: MealRecord;
  let inserted: boolean;
  try {
    const verdicts = await gatedVerdicts(deps, userId, pending.analysis);
    const restrictions = (await deps.store.getProfile(userId))?.restrictions ?? [];
    record = {
      ...pending.analysis,
      id: pendingId,
      user_id: userId,
      ts: new Date().toISOString(),
      date: pending.date,
      verdicts,
      // A pending row written before #118 carries no score — it is computed here, never trusted
      // off the stored proposal.
      healthScore: healthScore({ ...pending.analysis, verdicts }, restrictions),
      corrected: false,
      model: deps.config.llmModel,
    };
    inserted = await deps.store.insertMeal(record);
  } catch (e) {
    // The claim was taken and nothing was written: hand the proposal back, so the retry the screen
    // offers on this failure can log it instead of meeting "expired" for a sentence already billed.
    // Logged if even that fails: the symptom is a later "expired" on a sentence already billed.
    await deps.store.putPending(pending).catch((err) => {
      console.error(`[eait] pending restore failed: ${(err as Error)?.message ?? err}`);
    });
    throw e;
  }
  // Cannot lose to another confirm now (the claim above is exclusive); kept as the last guard on
  // the one id two rows may never share. Answered OUTSIDE the restore's reach: the meal is there,
  // and a proposal put back for a logged meal would let a later "no" drop what stays logged.
  if (!inserted) return (await alreadyLogged()) ?? { kind: "expired" };

  const totals = sumTotals(await deps.store.mealsForDate(userId, pending.date));
  const lang = (await deps.store.getProfile(userId))?.lang ?? "en";
  await remember(deps, userId, async () => {
    const profile = await deps.store.getProfile(userId);
    const greeting = profile ? await firstVerdict(deps, userId, profile, record, totals, "text") : { lines: [] };
    return {
      // The words were kept when they were said; this is the card, and on a first meal the verdict.
      lines: [
        { role: "assistant", kind: "meal", mealId: record.id, event: "logged", speaker: "gabie" },
        ...greeting.lines,
        // The same cap lines a photo meal gets: a confirmed estimate is a landed meal.
        ...(greeting.lines.length === 0 ? await afterLog(deps, userId, record, totals) : []),
      ],
      ...(greeting.undo ? { undo: greeting.undo } : {}),
    };
  });
  return {
    kind: "logged", mealId: record.id,
    analysis: { ...pending.analysis, verdicts: record.verdicts, healthScore: record.healthScore },
    totals, date: pending.date, hint: hintFor(pending.analysis),
    ...verdictWordsFor(record.verdicts, lang),
  };
}

export async function cancelPendingMeal(
  deps: EngineDeps,
  userId: string,
  pendingId: string,
): Promise<{ kind: "cancelled" } | { kind: "expired" } | MealLogged> {
  // The drop is the claim (see `confirmPendingMeal`): a "no" that finds the row gone lost to a
  // confirm, or came after one whose response was lost, or is late. The meal is logged under the
  // proposal's id and nothing here un-logs it, so the honest answer is the meal, not "expired".
  // ponytail: a confirm that has claimed but not yet inserted answers this as "expired" for those
  // milliseconds; the next page load shows the card. Exact would be a row-level state, not worth it.
  if (!(await deps.store.dropPending(userId, pendingId))) return (await loggedAs(deps, userId, pendingId)) ?? { kind: "expired" };
  // A "no" is a turn too: the words are already there; this is the answer. An expiry adds nothing.
  // A THUNK, so the profile read that words it sits inside `remember`'s guard: the drop has
  // already happened and a store hiccup here must not turn a cancel into a failure.
  await remember(deps, userId, async () => [{
    role: "assistant", kind: "text", speaker: "gabie",
    text: scriptedLine("dropped", (await deps.store.getProfile(userId))?.lang ?? "en"),
  }]);
  return { kind: "cancelled" };
}

/**
 * The account's live proposals, oldest first, as their turns sent them (#530): what a page that lost
 * its card reads back, so "Log it" comes back over the numbers it was offered for. Charges nothing
 * and writes nothing; an expired one is not offered, because nobody may confirm it.
 */
export async function pendingMeals(deps: EngineDeps, userId: string): Promise<MealProposed[]> {
  const profile = await deps.store.getProfile(userId);
  const restrictions = profile?.restrictions ?? [];
  const lang = profile?.lang ?? "en";
  return (await deps.store.pendingsFor(userId)).map((p) => ({
    kind: "proposed", pendingId: p.id,
    // Recomputed, not read off the row — a pending written before #118 has none, and a restriction
    // the user has since ticked should shape the card being re-shown.
    analysis: { ...p.analysis, healthScore: healthScore(p.analysis, restrictions) },
    date: p.date, expiresAt: new Date(p.expiresAt).toISOString(),
    // The card's words recomputed with it — a language change between proposal and read-back shows.
    verdictInline: verdictInlineText(p.analysis.verdicts, lang),
    verdictLabels: verdictLabels(p.analysis.verdicts, lang),
  } satisfies MealProposed));
}

/** Days of the user's own history the identification prior is built from, counting today. */
const REPERTOIRE_DAYS = 30;

/**
 * Foods this user logs most often, most frequent first.
 *
 * An IDENTIFICATION prior and nothing else — the prompt says so explicitly. It exists because the
 * same person eats the same twenty things, and knowing that is the difference between "rice" and
 * "the bulgur he has four times a week". It must never touch a number.
 *
 * `windowStart`, because it is the expression that means a LENGTH. `dateMinus(today, 30)` was
 * thirty-one days under a comment that said thirty (#184), and there was no test on the length —
 * the same fencepost, at a second call site, found the same way.
 */
async function buildRepertoire(deps: EngineDeps, userId: string, today: string): Promise<string[]> {
  const since = windowStart(today, REPERTOIRE_DAYS);
  const days = await deps.store.totalsSince(userId, since);
  const counts = new Map<string, number>();
  for (const d of days) {
    for (const meal of await deps.store.mealsForDate(userId, d.date)) {
      for (const item of meal.items) {
        // Fat inferred from a sheen is in every meal and chosen in none of them. Fed back as a
        // frequent food it becomes the top of the list, and a prior meant to help identify what is
        // on the plate starts arguing for oil on plates that have none.
        // The mark is re-tested here, not just trusted: rows written while a model filled the
        // single-value enum on every item (#317) are still stored that way, and skipping them
        // would keep those users' repertoires empty until the rows aged out.
        if (isCookingFat(item)) continue;
        const key = item.name_en ?? item.name;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([name]) => name);
}
