// The thread's WORDS that are not the model's: Spud's scripted lines, and the first verdict.
//
// Both live here, in shared, because both sides need them to be the same sentences: the server
// writes them into the thread, the app may render one before the round trip lands. The design is
// `product/design/onboarding/copy.md` (steps 13–15); a sentence changed here is a sentence changed
// in the product, so change the design first.

import type { FoodTargets, Goal, MealVerdicts } from "./types.ts";

/**
 * Lines the APP may ask the server to append, by id. Never prose: the client names a line and the
 * server owns the words, so nothing a phone sends can put a sentence in Spud's mouth.
 * `{name}` placeholders are filled from `params`.
 */
export const SCRIPTED_LINES = {
  /** Step 13 · the camera closed without a photo. */
  "camera-closed": "No rush. The plan is on your diary — photograph the next meal when it happens. That's the whole habit, and I'll say so once tomorrow if it hasn't.",
  /** Step 15 · the trial started. `price` is StoreKit's string for the chosen plan. */
  "trial-started": "Trial's on. Seven days, then {price} unless you stop it — I'll remind you on day five and the day before it ends, never the day after.",
  "trial-day-one": "Your first day is started. At 20:30 you get one line — today against the plan, and one concrete thing for tomorrow. Nothing before that.",
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
  "notify-primer": "One more thing iOS is about to ask about: notifications. One a day and never more — the 20:30 line, plus two reminders before the free week ends if you're on it. Nothing else, ever.",
  /** Step 15 · a restored purchase. */
  "restored": "Restored — you're in. A photo or a sentence both log a meal.",
  /** Step 13 · before the OS asks for the camera, once. */
  "camera-primer": "One thing first: iOS will ask for the camera. I use it for the plate and nothing else — the photo is kept with the meal so you can see it in your diary, and erased with your account.",
  /** Step 14 · the user tapped "Fix the numbers" / "Check the grams". */
  "fix-prompt": "Tell me what's off — \"half the rice\", \"no avocado\", \"it was 500\" all work. Or open the card and edit the grams yourself.",
  /** Step 14 · the first verdict accepted by an account that is already subscribed. */
  "already-in": "Good. I'm here in Chat whenever — a photo or a sentence both log a meal.",
  /** Step 13 · the camera permission was refused. */
  "camera-denied": "No camera, no problem. Pick a photo from your library, or just tell me what you ate — both get a verdict.",
  /** Step 14 · the bridge into the paywall, after the first verdict is accepted. */
  "onboarding-done": "Good — that's onboarding done, and the first day started. One more thing before you go, and it's the only time I'll ask.",
  /** A proposed meal the user said no to. The words the app already shows. */
  "dropped": "Dropped it.",
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

export function scriptedLine(id: ScriptedLineId, params: Record<string, string> = {}): string {
  return SCRIPTED_LINES[id].replace(/\{(\w+)\}/g, (_, k: string) => params[k] ?? "");
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
export const MEET_GABIE = "Questions go to Gabie, the nutritionist here — what to eat tonight, how the week's going. Same chat; she reads your diary before she answers. I log, she advises.";

export const COACH_STARTERS: readonly string[] = [
  "How's my week going?",
  "What should I eat tonight?",
  "Am I getting enough protein?",
];

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
 * THE NEGATIVE IS DELIBERATE. Over target this reads "-146 of your 1,454 left today", which is what
 * `firstVerdictLines` already ships: "a number is honest where a euphemism is not".
 */
export function runningLine(i: { targets: FoodTargets; eatenToday: { kcal: number; protein_g: number } }): string {
  return `${n(i.targets.kcal - i.eatenToday.kcal)} of your ${n(i.targets.kcal)} left today, ${n(i.eatenToday.protein_g)} of the ${n(i.targets.protein_g)} g protein.`;
}

/**
 * copy.md § Step 14 · after a correction, from chat or from the editor. `eatenToday` is after it.
 *
 * The changed number in front of the day's, because a correction's whole point is that the meal's
 * kcal MOVED — the one thing the re-rendered card cannot say by itself. The clause behind it is
 * `runningLine`, shared with every landed meal so the two can never disagree about one day.
 */
export function correctionLine(i: { targets: FoodTargets; meal: { kcal: number }; eatenToday: { kcal: number; protein_g: number } }): string {
  return `Updated — ${n(i.meal.kcal)} kcal. ${runningLine(i)}`;
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

const n = (x: number) => Math.round(x).toLocaleString("en-US");

/**
 * Spud's first verdict — copy.md § Step 14, word for word. Spoken ONCE, on the account's first
 * meal; later meals get the card and, in time, the 20:30 line. Deterministic on purpose: the model
 * is never asked for a verdict, and neither is it asked for these sentences.
 */
export function firstVerdictLines(i: FirstVerdictInput): string[] {
  const left = i.targets.kcal - i.eatenToday.kcal;
  const rest = `${n(left)} of your ${n(i.targets.kcal)}`;
  const protein = `${n(i.eatenToday.protein_g)} of the ${n(i.targets.protein_g)} g protein`;
  const kcal = n(i.meal.kcal);
  const lines: string[] = [];

  // The arithmetic clause is the prototype's, kept whole even when over: only the closing clause
  // swaps. "that leaves -146" is what the design shows; a number is honest where a euphemism is not.
  // A gain plan past its target is not "still to fill": rule 1, the branch taken, holds when over too.
  const arithmetic = i.goal === "gain"
    ? (left >= 0
      ? `${rest} still to fill today, and ${protein}. Keep going.`
      : `${n(-left)} over your ${n(i.targets.kcal)} today, and ${protein}. Past it is the point on a gain plan; tomorrow is a fresh number.`)
    : `that leaves ${rest} for the rest of today, and ${protein}.` + (left >= 0 ? " On plan." : " Over for today — tomorrow is a fresh number.");

  if (i.via === "text") {
    lines.push(`Typed, not photographed — so the portions are my guess. Take ${kcal} as rough; if you know the grams, say so and I'll fix it.`);
    lines.push(arithmetic.replace(/^that/, "That"));
  } else if (i.meal.confidence === "low") {
    // The design's "— sauce over everything" is an example reason; nothing here can name one.
    lines.push(`Honest answer: I couldn't read that plate well. Take ${kcal} as a rough guess and check the grams before you trust the total. A second angle next time helps.`);
    lines.push(i.goal === "gain" && left < 0
      ? `Even rough, it counts: about ${n(-left)} over your ${n(i.targets.kcal)} today.`
      : `Even rough, it counts: about ${n(left)} of your ${n(i.targets.kcal)} ${i.goal === "gain" ? "still to fill today" : "left today"}.`
        + (i.goal !== "gain" && left < 0 ? " Over for today — tomorrow is a fresh number." : ""));
  } else {
    lines.push(`First one in. ${kcal} kcal — ${arithmetic}`);
    lines.push("If anything's off, say so — \"half the rice\", \"no avocado\" — or tap the card and change the grams.");
  }

  // Step 13's promise: a pill and a sentence only for something the user declared, and only when
  // it actually ran high. `verdicts` carries a dimension only when the restriction was declared.
  const high = (v: MealVerdicts[keyof MealVerdicts]) => v === "warn" || v === "bad";
  if (high(i.verdicts.kidneys)) lines.push("Sodium runs high on this one. Scored only because you asked me to.");
  if (high(i.verdicts.ldl)) lines.push("Saturated fat runs high on this one. Scored only because you asked me to.");
  // Client text in Spud's bubble: flattened and as short as a scripted parameter, so a caption
  // cannot draw a second line inside the bubble or impersonate the sentence that follows.
  const note = quotable(i.caption);
  if (note) lines.unshift(`“${note}” — noted, it's in the numbers.`);
  lines.push(MEET_GABIE);
  return lines;
}
