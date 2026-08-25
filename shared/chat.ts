// The thread's WORDS that are not the model's: Spud's scripted lines, and the first verdict.
//
// Both live here, in shared, because both sides need them to be the same sentences: the server
// writes them into the thread, the app may render one before the round trip lands. The design is
// `product/design/onboarding/copy.md` (steps 16–18); a sentence changed here is a sentence changed
// in the product, so change the design first.

import type { FoodTargets, Goal, MealVerdicts } from "./types.ts";

/**
 * Lines the APP may ask the server to append, by id. Never prose: the client names a line and the
 * server owns the words, so nothing a phone sends can put a sentence in Spud's mouth.
 * `{name}` placeholders are filled from `params`.
 */
export const SCRIPTED_LINES = {
  /** Step 16 · the camera closed without a photo. */
  "camera-closed": "No rush. The plan is on your diary — photograph the next meal when it happens. That's the whole habit, and I'll say so once tomorrow if it hasn't.",
  /** Step 18 · the trial started. `price` is StoreKit's string for the chosen plan. */
  "trial-started": "Trial's on. Seven days, then {price} unless you stop it — I'll remind you on day five and the day before it ends, never the day after.",
  "trial-day-one": "Your first day is started. At 20:30 you get one line — today against the plan, and one concrete thing for tomorrow. Nothing before that.",
  /** Step 18 · a restored purchase. */
  "restored": "Restored — you're in. A photo or a sentence both log a meal.",
  /** Step 16 · before the OS asks for the camera, once. */
  "camera-primer": "One thing first: iOS will ask for the camera. I use it for the plate and nothing else — the photo is analyzed and deleted, never saved to your phone or kept on our servers.",
  /** Step 17 · the user tapped "Fix the numbers" / "Check the grams". */
  "fix-prompt": "Tell me what's off — \"half the rice\", \"no avocado\", \"it was 500\" all work. Or open the card and edit the grams yourself.",
  /** Step 17 · the first verdict accepted by an account that is already subscribed. */
  "already-in": "Good. I'm here in Chat whenever — a photo or a sentence both log a meal.",
  /** Step 16 · the camera permission was refused. */
  "camera-denied": "No camera, no problem. Pick a photo from your library, or just tell me what you ate — both get a verdict.",
  /** Step 17 · the bridge into the paywall, after the first verdict is accepted. */
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

/** copy.md § Step 17 · after a correction, from chat or from the editor. `eatenToday` is after it. */
export function correctionLine(i: { targets: FoodTargets; meal: { kcal: number }; eatenToday: { kcal: number; protein_g: number } }): string {
  return `Updated — ${n(i.meal.kcal)} kcal. ${n(i.targets.kcal - i.eatenToday.kcal)} of your ${n(i.targets.kcal)} left today, ${n(i.eatenToday.protein_g)} of the ${n(i.targets.protein_g)} g protein.`;
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
  /** The camera note, quoted back first — copy.md § Step 16. */
  caption?: string | null;
}

const n = (x: number) => Math.round(x).toLocaleString("en-US");

/**
 * Spud's first verdict — copy.md § Step 17, word for word. Spoken ONCE, on the account's first
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
  return lines;
}
