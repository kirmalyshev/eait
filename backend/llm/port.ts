// The LLM capability ports.
//
// The engine depends on these FUNCTION TYPES, never on a vendor SDK. Swapping OpenRouter for
// anything else is one file (`openrouter.ts`) plus one line in the composition root, and the
// engine's tests bind fakes to the same four signatures — which is what lets cap enforcement,
// verdict gating, the correction loop and the coach's tools be tested without a billed call.

import type { DayTotals, FoodTargets, MealAnalysis, Profile, TargetBasis } from "@eait/shared";
import type { PortionPrior } from "../store.ts";

/**
 * What an analyzer returns: every number, and NO verdicts.
 *
 * The model is never asked to judge — `prompt.ts` says so, and `MealAnalysisSchema` has no such
 * field, so zod strips one even when a model volunteers it. The engine derives verdicts from the
 * user's caps instead (`gatedVerdicts`), which is what makes them deterministic and auditable.
 *
 * This type exists because the old signature said `MealAnalysis`, and the implementations closed
 * the gap with `as MealAnalysis` — three casts asserting a field none of those values carried. The
 * typechecker therefore could not see that `proposed` shipped an analyzer's output straight to the
 * app with `verdicts` undefined, and `VerdictRow` indexed into it. In a Release build an unhandled
 * render error is a process abort: `RCTFatal` throws an NSException off the TurboModule queue and
 * the main thread dies wherever it happened to be, which is why three crash reports named three
 * unrelated subsystems and none of them named this.
 *
 * Saying what an analyzer really returns makes "an analysis reached a client unrepaired" a compile
 * error, which is the only version of this guarantee that holds.
 */
export type AnalyzedMeal = Omit<MealAnalysis, "verdicts"> & {
  /**
   * What the model measured the portions against, when anything in the frame gave it a reference.
   * `null` when nothing did — which is a real answer, and a better one than an invented plate.
   */
  scale?: { reference: string; plate_diameter_cm?: number | undefined } | null | undefined;
  /** The one thing the model would ask to make the estimate better, if it may ask at all. */
  question?: { text: string; options: string[] } | null | undefined;
};
// Both live in an intersection rather than on the shared `MealAnalysis`, and that is the point of
// them being here: they are PROMPT-SIDE. They explain or continue an estimate rather than describing
// the meal, so `prepareAnalysis` strips them and no stored row, no meal card and no client ever sees
// one. Putting them on the shared type would have made every store implementation responsible for a
// field with nothing to say.

/**
 * The gateway refused before any tokens were generated, so the call was billed NOTHING.
 *
 * The engine charges an analysis BEFORE the model is asked, because a call that ran costs money
 * whether or not it returned anything usable — and a cap that only counts successes is a cap a
 * retry loop walks straight through. That reasoning does not reach a request the gateway turned
 * away: no inference happened, no invoice moved, and the account is given its analysis back
 * (`store.undoAnalysis`). Anything else — a timeout, a truncation, a reply that would not parse —
 * may have cost real money and stays charged.
 *
 * It is a TYPE rather than a status field on the message because the engine must not decide this
 * by reading an error string, and only the implementation that saw the response knows which
 * statuses of its own gateway mean "never routed" (`openrouter.ts`).
 */
/**
 * The image formats the provider decodes, read from the magic bytes and never from a filename or
 * a content-type header. HEIC — what an iPhone set to High Efficiency captures — is not one of
 * them, and the provider answers it with a 400 that stays charged.
 */
export function imageMime(bytes: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "image/webp";
  return null;
}

export class GatewayRefusal extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "GatewayRefusal";
  }
}

export interface PhotoInput {
  /** Several images are ANGLES OF ONE MEAL, not several meals. One analysis, one billed call. */
  images: Uint8Array[];
  profile: Profile;
  targets: FoodTargets;
  caption?: string;
  /** HH:MM local — lets the model infer breakfast/lunch/dinner, which measurably helps portioning. */
  localTime?: string;
  /** Foods this user has logged before, most-eaten first. A prior for IDENTIFICATION only; it must
   *  never touch a number. */
  repertoire?: readonly string[];
  /**
   * What this user's own corrections say their portions of a food weigh, most corrected first.
   *
   * The one prior here that MAY change a number, and the reason it may is that the numbers are the
   * user's, measured against the model's earlier reads of the same food. The store's type, because
   * a second shape for three fields is a second thing to keep in step.
   */
  portionPriors?: readonly PortionPrior[];
}

/**
 * `onDelta` receives each piece of VISIBLE content as the model writes it — never reasoning —
 * so the engine can show item rows before the reply is whole. Optional: without it the call is
 * one request and one reply, as it was.
 */
export type AnalyzePhoto = (input: PhotoInput, onDelta?: (text: string) => void) => Promise<AnalyzedMeal>;

/** What the glance needs: the same images, and the language to answer in. */
export interface GlanceInput { images: Uint8Array[]; lang: string }
/**
 * One sentence about the plate, from a call built to be fast — a model that does not reason,
 * beside the analyzer, never instead of it. Its failure never fails a turn, and its text is never
 * stored: it belongs to the live turn, like the coach's suggestion chips.
 */
export type GlancePhoto = (input: GlanceInput) => Promise<string>;

/**
 * What free text turned out to mean.
 *
 * `dayOffset` is whole days back from today, `[0, 7]`. It is CLAMPED at every construction site
 * rather than typed as a bounded number: models commonly emit `null` for "today", and rejecting the
 * whole response over its date field loses a fully correct analysis to a retry loop.
 */
export type RouteResult =
  | { intent: "answer"; text: string }
  | { intent: "meal"; analysis: AnalyzedMeal; dayOffset: number }
  | { intent: "correction"; analysis: AnalyzedMeal }
  | { intent: "redate"; dayOffset: number };

export interface TextInput {
  text: string;
  profile: Profile;
  targets: FoodTargets;
  /** Today's meals, so "what have I eaten" is answered from data rather than from a transcript. */
  todayMeals: { items: string[]; kcal: number; protein_g: number }[];
  /** The last week's per-day sums — the other half of the router's context. */
  week: DayTotals[];
  /** The meal a correction would apply to. Absent means corrections are not available this turn. */
  focusMeal?: MealAnalysis;
  /**
   * The question Spud asked about that meal, still unanswered.
   *
   * Present only when there is one to answer, because the prompt line it produces tells the model
   * this message IS the answer — a standing instruction to read every message as a correction.
   */
  question?: { text: string; options: string[] };
  /**
   * The last few lines of the thread, oldest first, so "what about dinner?" after a meal routes
   * as a question rather than as a plate called "dinner". Context for the DECISION only; the
   * coach gets the longer window.
   */
  recent?: CoachHistoryLine[];
}

export type RouteText = (input: TextInput) => Promise<RouteResult>;

/** Free text → restriction tags, when the keyword pass found nothing. Validated against the closed
 *  vocabulary by the caller; anything outside it is dropped. */
export type ClassifyRestrictions = (text: string) => Promise<string[]>;

// ── The coach ────────────────────────────────────────────────────────────────────────────────

/**
 * What the coach knows before it reads the message: the plan and why it is what it is, the day
 * so far, the week's sums, the meal in focus, and the clock. Everything else it asks a tool for.
 */
export interface CoachContext {
  profile: Profile;
  targets: FoodTargets;
  basis: TargetBasis;
  /** The server's calendar date and local time — "tonight" has to mean something. */
  today: string;
  localTime: string;
  todayMeals: { items: string[]; kcal: number; protein_g: number }[];
  week: DayTotals[];
  focusMeal?: MealAnalysis;
  /** "around March 2027", or null when no honest projection exists. */
  projection: string | null;
}

/** One replayed line of the thread. A card or a photo is already a one-line note by here. */
export interface CoachHistoryLine {
  role: "user" | "assistant";
  text: string;
}

export interface CoachInput {
  text: string;
  context: CoachContext;
  /** Oldest first, and never including the message itself. */
  history: CoachHistoryLine[];
}

/**
 * The tools, as closures the ENGINE built: each is already scoped to the one account whose turn
 * this is, so the port never sees a user id and cannot reach a row on its own. Keyed by the name
 * the model calls, which must be one `COACH_TOOL_DEFS` describes. Arguments arrive parsed but
 * unvalidated; every closure validates its own.
 */
export type CoachTools = Record<string, (args: Record<string, unknown>) => Promise<unknown>>;

export interface CoachReply {
  reply: string;
  /** Already through `cleanSuggestions`: chips, or none. */
  suggestions: string[];
}

/**
 * The agent behind a question. Runs the model against the context and the history, executes the
 * tool calls it makes through `tools`, and returns what it finally said. Every call it makes is
 * billed — the router already generated this turn — so a gateway status here is a plain error.
 */
export type Coach = (input: CoachInput, tools: CoachTools) => Promise<CoachReply>;

/**
 * Tool rounds one turn may take before the model is made to answer. The bound on a tool-happy
 * model running the meter: each round is a billed completion, and two tools over a bounded
 * window do not need more than this to answer any question this product asks.
 */
export const MAX_COACH_ROUNDS = 4;

/**
 * The tools' bounds, here because two files read them: the engine's closures enforce them
 * (`engine/coach.ts`) and the definitions the model reads state them (`prompt.ts`). A bound the
 * model is not told is one it cannot respect — and a row cap it is not told is a partial window
 * summed as a whole one.
 */
/** The widest `get_meals` window, and the most rows one call returns — the newest. */
export const COACH_MEALS_WINDOW_DAYS = 31;
export const COACH_MEALS_LIMIT = 60;
/** The furthest back `get_health` reaches. */
export const COACH_HEALTH_DAYS = 90;

export interface LlmPorts {
  analyzePhoto: AnalyzePhoto;
  glancePhoto: GlancePhoto;
  routeText: RouteText;
  classifyRestrictions: ClassifyRestrictions;
  coach: Coach;
}

/** Clamp to an integer in `[0, MAX_DAY_OFFSET]`, warning when the value was out of contract. */
export const MAX_DAY_OFFSET = 7;
export function clampDayOffset(v: unknown): number {
  const n = Math.round(Number(v ?? 0));
  if (!Number.isFinite(n)) return 0;
  if (n < 0 || n > MAX_DAY_OFFSET) {
    console.warn(`[eait] dayOffset out of contract: ${String(v)} -> clamped`);
    return Math.min(MAX_DAY_OFFSET, Math.max(0, n));
  }
  return n;
}
