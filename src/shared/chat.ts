// The thread's WORDS that are not the model's: Spud's scripted lines, and the first verdict.
//
// Both live here, in shared, because both sides need them to be the same sentences: the server
// writes them into the thread, the app may render one before the round trip lands. The design is
// `product/design/onboarding/copy.md` (steps 13–15); a sentence changed here is a sentence changed
// in the product, so change the design first.

import { kcalNumbers, spellUnit, wholeNumbers } from "./lang.ts";
import { threadCopyFor } from "./chat-copy.ts";
import { LANGS, STRUGGLES } from "./types.ts";
import type { FoodTargets, Goal, Lang, MealVerdicts, Struggle } from "./types.ts";
import { verdictNoun } from "./verdicts.ts";

/**
 * Lines the APP may ask the server to append, BY ID. Never prose: the client names a line and the
 * server owns the words, so nothing a phone sends can put a sentence in Spud's mouth.
 *
 * THE KEYS ARE THE CONTRACT AND THE WORDS ARE NOT. This is the id set two binaries agree on, so it
 * is the same in all eight languages and is deliberately NOT `Localized`; what each id SAYS lives
 * in the catalogs, under `thread.scripted.<id>` (`chat-copy.ts` names them). The values here are
 * `null` because the type is doing the only job left: naming what exists.
 *
 * READING A VALUE OFF THIS IS THE ONE MIGRATION THE COMPILER CANNOT REFUSE, so it is marked. Every
 * other table in this change became a function of the language, which makes an un-migrated call
 * site a build error; this one kept its shape and lost its words, and `null` is a legal
 * `ReactNode` — so `<Text>{SCRIPTED_LINES.dropped}</Text>` still typechecks and renders an EMPTY
 * bubble. Empty is worse than English: nothing looks broken in review. The `@deprecated` below is
 * the only signal available, and it shows up in an editor where the type cannot.
 */
/** @deprecated The KEYS are the contract. Read the words with `scriptedLine(id, lang)`. */
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
  lang: Lang,
  // See `checkNumber`: the optional one goes last so that reaching the language never costs a
  // caller an argument it has no opinion about.
  params: Record<string, string> = {},
): string {
  // A declared parameter with nothing behind it renders as NOTHING, not as a brace — the rule this
  // function has always had, and the one place in the codebase where an unfilled placeholder is
  // erased rather than left alone. `scriptedParams` has already refused anything but the declared
  // set, so the only way to get here short is a client that sent none. ICU does the same thing
  // with an argument it was given no value for, which is why the move to a catalog changed the
  // engine under this line and not what it answers.
  return threadCopyFor(lang).scripted[id](params);
}

// ── The coach ────────────────────────────────────────────────────────────────────────────────

/**
 * What the Chat tab offers when nothing live is on screen: three things the coach can do, worded
 * as the user would send them, because a tap sends the words verbatim (S9). One starter exists
 * per struggle; the profile's picks come FIRST, in `STRUGGLES` list order rather than tap order,
 * and the unpicked fill what is left to three — so no pick is read by nothing, and a profile that
 * was never asked gets the list's first three.
 */

export function startersFor(picked: readonly Struggle[] | null | undefined, lang: Lang): string[] {
  return starterRowsFor(picked, lang).map((s) => s.text);
}

/**
 * The starters WITH the struggle each belongs to — the words-only `startersFor` cannot pair one
 * with its icon, and a second ordering written beside this one is the drift it exists to prevent.
 */
export function starterRowsFor(
  picked: readonly Struggle[] | null | undefined,
  lang: Lang,
): { struggle: Struggle; text: string }[] {
  const starters = threadCopyFor(lang).coachStarters;
  const chosen = STRUGGLES.filter((s) => picked?.includes(s));
  const rest = STRUGGLES.filter((s) => !picked?.includes(s));
  return [...chosen, ...rest].slice(0, 3).map((s) => ({ struggle: s, text: starters[s] }));
}

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
 * #130: the logged-meal verdict line — the coach's reply to a meal that landed, ONE PER CAP VERDICT
 * that is not on plan. Only the caps exist here: saturated fat for `ldl`, sodium for `kidneys`;
 * calories have a plan, not a cap, so `weight` never speaks in this line. "Saturated fat is high
 * for one meal: 5 of your 13g." — computed from the stored row against the declared caps; the
 * model never writes it.
 *
 * `verdicts` is the stored, already-visible map: a dimension is in it only when the restriction
 * was declared, so "declared" and "cap present" are the same test.
 *
 * THE TAIL, ruled on the PR review: "it" is the line's nutrient, so the condition is THAT
 * nutrient's remaining share of its cap — under a third of the cap still open today — not the
 * day's calories. A day with plenty of kcal left and saturated fat nearly spent says it; the
 * reverse does not. It appends to the line's own sentence, so "it" resolves to the nutrient
 * named there. `eatenToday` is the day's totals AFTER this meal, so a spent cap reads the truth.
 */
export const CAP_LINE_EASY_SHARE = 1 / 3;
export function capVerdictLines(
  i: {
    meal: { satfat_g: number; sodium_mg: number };
    targets: FoodTargets;
    verdicts: MealVerdicts;
    eatenToday: { satfat_g: number; sodium_mg: number };
  },
  lang: Lang,
): string[] {
  const copy = threadCopyFor(lang).capLine;
  const n = wholeNumbers(lang);
  const caps = [
    { dim: "kidneys" as const, eaten: i.meal.sodium_mg, cap: i.targets.sodium_mg, unit: "mg", eatenToday: i.eatenToday.sodium_mg },
    { dim: "ldl" as const, eaten: i.meal.satfat_g, cap: i.targets.satfat_g, unit: "g", eatenToday: i.eatenToday.satfat_g },
  ];
  return caps
    .filter((c) => c.cap !== undefined && (i.verdicts[c.dim] === "warn" || i.verdicts[c.dim] === "bad"))
    .map((c) =>
      (i.verdicts[c.dim] === "bad" ? copy.veryHigh : copy.high)({
        nutrient: verdictNoun(c.dim, lang),
        eaten: n(c.eaten),
        target: n(c.cap!),
        unit: spellUnit(lang, c.unit),
      }) + (c.cap! - c.eatenToday < c.cap! * CAP_LINE_EASY_SHARE ? ` ${copy.easyTail}` : ""));
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
  meal: { kcal: number; satfat_g: number; sodium_mg: number; confidence: string };
  /** The day's totals AFTER this meal, which is what the cap tails are measured from. */
  eatenToday: { kcal: number; protein_g: number; satfat_g: number; sodium_mg: number };
  via: "photo" | "text";
  verdicts: MealVerdicts;
  /** The camera note, quoted back first — copy.md § Step 13. */
  caption?: string | null;
}

/**
 * THE PILLS' VERDICT IN ONE SENTENCE (#49), and the only judgement a first verdict passes: the
 * arithmetic around it states the day and nothing more. So a meal whose calories pill is high can
 * never read "On plan", and no calories pill is no claim at all. The worst pill decides: calories
 * very high or high, then calories on plan with a declared marker high (that marker's own line
 * follows), then on plan. The server speaks it first in `firstVerdictLines`; a client that
 * re-renders a card after an edit says it again from the verdicts the server just returned.
 */
export function verdictHeadline(verdicts: MealVerdicts, lang: Lang): string | null {
  const h = threadCopyFor(lang).firstVerdict.headline;
  const high = (v: MealVerdicts[keyof MealVerdicts]) => v === "warn" || v === "bad";
  switch (verdicts.weight) {
    case "bad": return h.caloriesVeryHigh;
    case "warn": return h.caloriesHigh;
    case "good": return high(verdicts.ldl) || high(verdicts.kidneys) ? h.caloriesOnPlan : h.onPlan;
    default: return null;
  }
}

/**
 * Spud's first verdict — copy.md § Step 14, word for word. Spoken ONCE, on the account's first
 * meal; later meals get the card and, in time, the 20:30 line. Deterministic on purpose: the model
 * is never asked for a verdict, and neither is it asked for these sentences.
 *
 * THE BRANCHES ARE HERE AND THE SENTENCES ARE IN THE CATALOGS (`chat-copy.ts` names the ids).
 * Which of them a meal takes is a claim about that meal; the wording is not, and a translator
 * moving a branch would be moving a rule.
 *
 * NO DAY'S ARITHMETIC anywhere in it (#1066): the card already carries the meal's numbers and the
 * day's remainder, so the thread does not restate them. What remains is the greeting, the fix
 * hint, and any declared-cap warning — a nutrient line is not a calorie remark.
 */
export function firstVerdictLines(i: FirstVerdictInput, lang: Lang): string[] {
  const copy = threadCopyFor(lang).firstVerdict;
  const kcal = kcalNumbers(lang)(i.meal.kcal);
  const lines: string[] = [];

  if (i.via === "text") {
    lines.push(copy.typed({ kcal }));
  } else if (i.meal.confidence === "low") {
    // The design's "— sauce over everything" is an example reason; nothing here can name one.
    lines.push(copy.lowConfidence({ kcal }));
  } else {
    lines.push(copy.firstIn({ kcal }));
    lines.push(copy.fixHint);
  }

  // Step 13's promise: a pill and a sentence only for something the user declared, and only when
  // it actually ran high. `verdicts` carries a dimension only when the restriction was declared.
  // #130: the sentence is computed — the cap line names the nutrient, the meal's amount and the
  // cap it ran past.
  lines.push(...capVerdictLines(i, lang));
  // Client text in Spud's bubble: flattened and as short as a scripted parameter, so a caption
  // cannot draw a second line inside the bubble or impersonate the sentence that follows.
  const note = quotable(i.caption);
  if (note) lines.unshift(copy.noted({ note }));
  // #49: the headline is the pills' verdict, said first — see `verdictHeadline`.
  const headline = verdictHeadline(i.verdicts, lang);
  if (headline) lines.unshift(headline);
  return lines;
}

/**
 * "No" on a proposal, or an older estimate retired in place: the scripted "Dropped it." line in any
 * shipped language. Her bubble reads it as refused "Not logged" (ieat-app#1520, `chat-proposal-no`);
 * it is never drawn as his line.
 */
const DROPPED: ReadonlySet<string> = new Set(LANGS.map((l) => scriptedLine("dropped", l, {})));
export const isDroppedText = (text: string | null | undefined): boolean => text != null && DROPPED.has(text);
