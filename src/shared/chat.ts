// The thread's WORDS that are not the model's: Spud's scripted lines, and the first verdict.
//
// Both live here, in shared, because both sides need them to be the same sentences: the server
// writes them into the thread, the app may render one before the round trip lands. The design is
// `product/design/onboarding/copy.md` (steps 13–15); a sentence changed here is a sentence changed
// in the product, so change the design first.

import { wholeNumbers } from "./lang.ts";
import { fillCopy as fill, threadCopyFor } from "./chat-copy.ts";
import type { FoodTargets, Goal, Lang, MealVerdicts } from "./types.ts";

/**
 * Lines the APP may ask the server to append, BY ID. Never prose: the client names a line and the
 * server owns the words, so nothing a phone sends can put a sentence in Spud's mouth.
 *
 * THE KEYS ARE THE CONTRACT AND THE WORDS ARE NOT. This is the id set two binaries agree on, so it
 * is the same in all eight languages and is deliberately NOT `Localized`; what each id SAYS lives
 * in `THREAD_COPY` (`chat-copy.ts`), keyed by language. The values here are `null` because the type
 * is doing the only job left: naming what exists.
 */
export const SCRIPTED_LINES = {
  /** Step 13 · the camera closed without a photo. */
  "camera-closed": null,
  /** Step 15 · the trial started. `price` is StoreKit's string for the chosen plan. */
  "trial-started": null,
  "trial-day-one": null,
  /**
   * Step 15 · before iOS asks for notifications, once, after the trial starts.
   *
   * The camera primer's pattern from § Step 13: say what the permission is for, and what the
   * limit is, BEFORE the OS dialog — because the OS dialog is asked once and a refusal there is
   * final. What it promises is R1's budget, which `dailyMessage` in `notifications.ts` enforces.
   *
   * "if you're on it" is load-bearing. The ask fires for any live entitlement, and a RESTORED
   * purchase has no trial — `reminderPlan` schedules nothing for it, so a sentence promising two
   * reminders would be describing messages that are not coming.
   */
  "notify-primer": null,
  /** Step 15 · a restored purchase. */
  "restored": null,
  /** Step 13 · before the OS asks for the camera, once. */
  "camera-primer": null,
  /** Step 14 · the user tapped "Fix the numbers" / "Check the grams". */
  "fix-prompt": null,
  /** Step 14 · the first verdict accepted by an account that is already subscribed. */
  "already-in": null,
  /** Step 13 · the camera permission was refused. */
  "camera-denied": null,
  /** Step 14 · the bridge into the paywall, after the first verdict is accepted. */
  "onboarding-done": null,
  /** A proposed meal the user said no to. The words the app already shows. */
  "dropped": null,
} as const;

export type ScriptedLineId = keyof typeof SCRIPTED_LINES;

/**
 * The one rule for client text that ends up inside Spud's bubble: whitespace flattened, so it
 * cannot draw a second line; quotation marks neutralised, so it cannot close the ones around it.
 */
const neutral = (text: string): string => text.replace(/[“”"]/g, "'").replace(/\s+/g, " ").trim();

/**
 * The ONLY client text that may reach an assistant line: the parameters a line declares, as short
 * strings. Everything else is refused, so a phone cannot smuggle prose through a placeholder.
 */
export const SCRIPTED_PARAMS: Record<ScriptedLineId, readonly string[]> = {
  "camera-closed": [], "trial-started": ["price"], "trial-day-one": [], "restored": [],
  "camera-denied": [], "onboarding-done": [], "dropped": [], "camera-primer": [], "fix-prompt": [], "already-in": [],
  "notify-primer": [],
};
const MAX_PARAM_LENGTH = 64;

export const isScriptedLineId = (id: unknown): id is ScriptedLineId =>
  typeof id === "string" && Object.hasOwn(SCRIPTED_LINES, id);

/** The declared parameters of `id`, exactly, or null when a key is missing, extra, not a string, or long. */
export function scriptedParams(id: ScriptedLineId, given: unknown): Record<string, string> | null {
  const declared = SCRIPTED_PARAMS[id];
  const g = typeof given === "object" && given !== null ? (given as Record<string, unknown>) : {};
  const keys = Object.keys(g);
  if (keys.length !== declared.length || keys.some((k) => !declared.includes(k))) return null;
  const out: Record<string, string> = {};
  for (const k of declared) {
    const v = g[k];
    if (typeof v !== "string") return null;
    const flat = neutral(v);
    if (flat === "" || flat.length > MAX_PARAM_LENGTH) return null;
    out[k] = flat;
  }
  return out;
}

export function scriptedLine(
  id: ScriptedLineId,
  params: Record<string, string> = {},
  lang: Lang = "en",
): string {
  // A declared parameter with nothing behind it renders as NOTHING, not as a brace — the rule this
  // function has always had, and the one place in the codebase where an unfilled placeholder is
  // erased rather than left alone. `scriptedParams` has already refused anything but the declared
  // set, so the only way to get here short is a client that sent none.
  return threadCopyFor(lang).scripted[id]!.replace(/\{(\w+)\}/g, (_, k: string) => params[k] ?? "");
}

// ── The coach ────────────────────────────────────────────────────────────────────────────────

/**
 * What the Chat tab offers when nothing live is on screen: three things the coach can do, worded
 * as the user would send them, because a tap sends the words verbatim. Shared so the server can
 * one day suggest the same ones; today only the app reads them.
 */
/**
 * Spud introduces the coach, once: the last line of the first verdict, which is the one thing he
 * says exactly once per account (copy.md § Step 14). Gabie answers questions in Chat and nothing
 * else — Spud logs, Gabie advises — and this is the one user-visible sentence that calls her a
 * nutritionist.
 */
export const MEET_GABIE = (lang: Lang = "en"): string => threadCopyFor(lang).meetGabie;

export const COACH_STARTERS = (lang: Lang = "en"): readonly string[] =>
  threadCopyFor(lang).coachStarters;

/**
 * The fixed thread the deterministic Chat is seeded with. Issue #257.
 *
 * WHY IT EXISTS. Nothing in the suite can tell a correctly pinned thread from one whose newest line
 * is under the dock (#146): `assertVisible` passes on text under the keyboard or behind the tab bar,
 * `scrollUntilVisible` reports the same PASS whether it swiped or not, and `assertScreenshot` — the
 * answer `e2e/AGENTS.md` gives for exactly this class — is disqualified from Chat by the rule beside
 * it, because the screen carries dates and a model's output. So the screen is given a thread that
 * carries neither, and then it can be baselined like the four that already are.
 *
 * EVERY LINE IS THE USER'S, and that is a constraint rather than a style. `POST /v1/messages/lines`
 * takes arbitrary text for the user's own words only; an assistant line has to name a
 * `ScriptedLineId`, and borrowing an onboarding or paywall line here would put those words in a
 * thread that never onboarded and never saw the sheet. What the checkpoints are about is the
 * GEOMETRY of the newest line against a dock that changes height, and a user line is a line.
 *
 * NOTHING IN IT MAY MOVE. No dates, no analyzer numbers, no model output — a checkpoint that went
 * red at a month boundary is the failure `subflow-visual-check.yaml`'s header describes. There is a
 * test that seeds it on two different days and compares.
 *
 * It is fixture data, and it is here rather than beside either consumer because BOTH sides need the
 * identical thread: `backend/dev/seed.ts` writes it through the store for `--demo`, and
 * `app/e2e.tsx` appends it through the real route behind `AUTH_FAKE`. Two copies would be a
 * baseline taken against one of them and checked against the other.
 */
export const FIXTURE_THREAD: readonly string[] = [
  "porridge with berries and a spoon of yoghurt",
  "flat white, oat milk",
  "grilled chicken, brown rice and a green salad",
  "an apple and a small handful of almonds",
  "baked salmon, roast potatoes, broccoli",
];

/** Chips under a live answer: at most this many, each at most this long. */
export const MAX_SUGGESTIONS = 3;
export const MAX_SUGGESTION = 60;

/**
 * The model's follow-up suggestions, fit for chips: strings only, flattened, non-empty, within the
 * bound, distinct, and no more than `MAX_SUGGESTIONS`. Anything else is dropped rather than drawn —
 * a chip is a button, and a button with two lines of model prose on it is not one.
 */
export function cleanSuggestions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v !== "string") continue;
    const flat = neutral(v);
    if (flat === "" || flat.length > MAX_SUGGESTION || out.includes(flat)) continue;
    // A bracketed line is a note the thread replays ("[photo]", "[logged: …]"), copied back by a
    // model that mistook the history for a menu. Nobody sends one.
    if (/^\[.*\]$/.test(flat)) continue;
    out.push(flat);
    if (out.length === MAX_SUGGESTIONS) break;
  }
  return out;
}

/**
 * WHERE THE DAY STANDS, said the same way whatever put the meal there (#306).
 *
 * copy.md § Step 14's arithmetic clause, on its own. It was reachable only through
 * `correctionLine`, so a corrected meal was followed by the day's numbers and a logged one by
 * nothing — #301's "three consecutive meals look like three different features", in the half #301
 * did not touch. Worse, the account's FIRST meal does say the arithmetic (`firstVerdictLines`), so
 * the very next meal broke an expectation the product had just set.
 *
 * NO VERB, AND NO MEAL KCAL. The card under it already carries the meal's own numbers, and #301
 * removed the "Logged." caption for exactly that reason — `LandedMeal` says the running arithmetic
 * "must not come here … a caption repeating any part of it is a second place for numbers that have
 * to agree". This sentence is the day, and only the day.
 *
 * Over target it says the overshoot, in the first verdict's words — never a signed remainder (#663).
 */
export function runningLine(
  i: { targets: FoodTargets; eatenToday: { kcal: number; protein_g: number } },
  lang: Lang = "en",
): string {
  const copy = threadCopyFor(lang).running;
  const left = i.targets.kcal - i.eatenToday.kcal;
  return fill(left >= 0 ? copy.left : copy.over, figures(i, lang));
}

/** The bare numbers every sentence in this file interpolates, grouped the reader's way. */
function figures(
  i: { targets: FoodTargets; eatenToday: { kcal: number; protein_g: number } },
  lang: Lang,
): Record<string, string> {
  const n = wholeNumbers(lang);
  const left = i.targets.kcal - i.eatenToday.kcal;
  return {
    left: n(Math.max(0, left)),
    over: n(Math.max(0, -left)),
    plan: n(i.targets.kcal),
    protein: n(i.eatenToday.protein_g),
    proteinTarget: n(i.targets.protein_g),
  };
}

/**
 * copy.md § Step 14 · after a correction, from chat or from the editor. `eatenToday` is after it.
 *
 * The changed number in front of the day's, because a correction's whole point is that the meal's
 * kcal MOVED — the one thing the re-rendered card cannot say by itself. The clause behind it is
 * `runningLine`, shared with every landed meal so the two can never disagree about one day.
 */
export function correctionLine(
  i: { targets: FoodTargets; meal: { kcal: number }; eatenToday: { kcal: number; protein_g: number } },
  lang: Lang = "en",
): string {
  return fill(threadCopyFor(lang).correction, {
    kcal: wholeNumbers(lang)(i.meal.kcal),
    day: runningLine(i, lang),
  });
}

/**
 * A user's words, fit to be quoted inside Spud's bubble: whitespace flattened, cut at a word inside
 * the scripted-parameter bound and marked as cut, and never split inside a character — a quote
 * attributed to somebody must read as one thing they said.
 */
function quotable(caption: string | null | undefined): string {
  const flat = neutral(caption ?? "");
  const chars = Array.from(flat);
  if (chars.length <= MAX_PARAM_LENGTH) return flat;
  const head = chars.slice(0, MAX_PARAM_LENGTH).join("");
  const space = head.lastIndexOf(" ");
  return (space > MAX_PARAM_LENGTH / 3 ? head.slice(0, space) : head) + "…";
}

export interface FirstVerdictInput {
  goal: Goal;
  targets: FoodTargets;
  meal: { kcal: number; confidence: string };
  /** The day's totals AFTER this meal, which is what "left today" is measured from. */
  eatenToday: { kcal: number; protein_g: number };
  via: "photo" | "text";
  verdicts: MealVerdicts;
  /** The camera note, quoted back first — copy.md § Step 13. */
  caption?: string | null;
}

/**
 * Spud's first verdict — copy.md § Step 14, word for word. Spoken ONCE, on the account's first
 * meal; later meals get the card and, in time, the 20:30 line. Deterministic on purpose: the model
 * is never asked for a verdict, and neither is it asked for these sentences.
 *
 * THE BRANCHES ARE HERE AND THE SENTENCES ARE IN `THREAD_COPY`. Which of them a meal takes is a
 * claim about that meal's arithmetic; the wording is not, and a translator moving a branch would be
 * moving a rule. The old code produced the sentence-initial form of the arithmetic by running
 * `.replace(/^that/, "That")` over it — an English capitalisation rule living inside a string
 * operation, correct in exactly one language. `arithmeticAlone` is that same pair, said out loud.
 */
export function firstVerdictLines(i: FirstVerdictInput, lang: Lang = "en"): string[] {
  const copy = threadCopyFor(lang).firstVerdict;
  const f = figures(i, lang);
  const kcal = wholeNumbers(lang)(i.meal.kcal);
  const left = i.targets.kcal - i.eatenToday.kcal;
  const lines: string[] = [];

  // Over target says the overshoot ("146 over your 1,454"), never a signed remainder (#663).
  const branch = i.goal === "gain"
    ? (left >= 0 ? "gainLeft" : "gainOver")
    : (left >= 0 ? "otherLeft" : "otherOver");

  if (i.via === "text") {
    lines.push(fill(copy.typed, { kcal }));
    lines.push(fill(copy.arithmeticAlone[branch], f));
  } else if (i.meal.confidence === "low") {
    // The design's "— sauce over everything" is an example reason; nothing here can name one.
    lines.push(fill(copy.lowConfidence, { kcal }));
    lines.push(fill(
      left < 0
        ? (i.goal === "gain" ? copy.lowOverGain : copy.lowOverOther)
        : (i.goal === "gain" ? copy.lowLeftGain : copy.lowLeftOther),
      f,
    ));
  } else {
    lines.push(fill(copy.firstIn, { kcal, arithmetic: fill(copy.arithmetic[branch], f) }));
    lines.push(copy.fixHint);
  }

  // Step 13's promise: a pill and a sentence only for something the user declared, and only when
  // it actually ran high. `verdicts` carries a dimension only when the restriction was declared.
  const high = (v: MealVerdicts[keyof MealVerdicts]) => v === "warn" || v === "bad";
  if (high(i.verdicts.kidneys)) lines.push(copy.sodium);
  if (high(i.verdicts.ldl)) lines.push(copy.satfat);
  // Client text in Spud's bubble: flattened and as short as a scripted parameter, so a caption
  // cannot draw a second line inside the bubble or impersonate the sentence that follows.
  const note = quotable(i.caption);
  if (note) lines.unshift(fill(copy.noted, { note }));
  lines.push(MEET_GABIE(lang));
  return lines;
}
