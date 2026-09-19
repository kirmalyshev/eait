// Onboarding as a conversation: the order, the branches, and every sentence Spud says back.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// WHY THIS IS SHARED AND PURE, AND WHY IT IS NOT ADMIN-EDITABLE
//
// SHARED, because it is where the branch logic lives, and branch logic is exactly the part that
// `bun test` has to be able to reach without a simulator. The support card for "diets that didn't
// stick" reads the goal chosen six steps earlier and swaps its citation for one that is about the
// direction taken; that is a rule, and a rule nobody can run is a rule that drifts.
//
// NOT EDITABLE, because these sentences carry SOURCED STATISTICS — "about 42% of adults", "n =
// 1.18M", "2.8% of adults meet the criteria". `product/design/onboarding/copy.md` states the rule
// as "never bend a citation". An admin text box in front of a health statistic is an
// unsubstantiated health claim one typo away from every phone, with no gate in front of it — the
// thing `landing/claims.ts` exists to stop happening in public copy. The QUESTIONS Spud asks are
// editable (`onboarding.ts`, `asks`); the conversation around them is code.
//
// THE THREE RULES EVERY REPLY OBEYS (copy.md § Context model), each with a test:
//   1. Speak to the branch taken, never to "whatever" was chosen. A reply that works for any goal
//      is a reply written for no one.
//   2. A question earns its place by having a reader. Asking for something nothing consumes is the
//      most expensive line in an onboarding — the user pays for it and never sees it come back.
//   3. Never lean on structure the user cannot see. No step numbers, and nothing about an answer
//      that has not been given yet.
// ─────────────────────────────────────────────────────────────────────────────────────────────
//
// WHAT IS STORED AND WHAT IS NOT. `goal`, `sex`, `birth_year`, `height_cm`, `weight_kg`,
// `target_weight_kg`, `pace`, `activity`, `country` and `restrictions` are profile columns, and
// they are the whole input to `explainTargets`. The one conversation question — what has been hard
// — is NOT stored on the profile: it is answered into the thread (which is the record, and is
// erased with the account), and `REPORTABLE_FIELDS` has no room for it, which is the point. "Binge
// episodes" is a disclosure, not a preference.
//
// THERE WERE FOUR. "Why now", "the hardest moment" and "eating out" were cut on 2026-08-26 under
// rule 2: each wrote a value — a bucket, a moment, a frequency — that nothing in `src/` ever read
// back. `struggles` stayed because it picks the support cards that appear one sentence later.

import {
  MAX_DEFICIT_SHARE, MAX_SURPLUS_SHARE, MIN_AGE, MIN_TARGET_BMI, MIN_WEIGHT_KG, ageFrom,
  type RestrictionTag,
} from "./targets.ts";
import { numbers } from "./lang.ts";
import { chatCopyFor, type CardCopy } from "./onboarding-chat-copy.ts";
import type { Goal, Lang, Profile } from "./types.ts";
import {
  isKnownScreen, optionLabel, screenForStep, screenOptionValues, stepApplies,
  type OnboardingContent, type OnboardingPlace, type OnboardingScreenId, type OnboardingStep,
} from "./onboarding.ts";

// ── The prompts ──────────────────────────────────────────────────────────────────────────────

/**
 * Everything Spud asks or shows, in the order of `copy.md` steps 1–12.
 *
 * A prompt with a `field` fills a profile column and its answer survives the app being killed. A
 * prompt without one is conversation: asked while the run is live, skipped on a resume that has
 * already passed it (see `resumeAt`).
 */
export type ChatPromptId =
  | "welcome" | "goal" | "sex" | "birth_year" | "height_cm" | "weight_kg"
  | "target_weight_kg" | "pace" | "activity" | "struggles"
  | "country" | "restrictions" | "building" | "summary";

/**
 * How an answer is given.
 *
 *   start   a single quick reply, and nothing to type
 *   choice  one of an enumerated list, tapped
 *   chips   any number of an enumerated list, plus a quick reply to finish
 *   number  the number pad
 *   text    the composer, with quick replies beside it
 *   auto    nothing to answer — a card Spud draws and moves on from
 */
export type ChatPromptKind = "start" | "choice" | "chips" | "number" | "text" | "auto";

export interface ChatPrompt {
  id: ChatPromptId;
  /** The funnel row this prompt is counted in. */
  place: OnboardingPlace;
  /** The profile column it fills, when it fills one. */
  field?: OnboardingStep;
  kind: ChatPromptKind;
  /** Enumerated values, for `choice` and `chips`. Labels come from the content. */
  options?: readonly string[];
}

/** The struggle chips of copy.md § Step 07. A closed vocabulary, because § Step 08 keys cards off it. */
export const STRUGGLES = [
  "stress", "night", "binge", "diets", "eatout", "energy", "body", "metabolism",
] as const;
export type Struggle = (typeof STRUGGLES)[number];

/**
 * The chip labels, in one language.
 *
 * A FUNCTION OF THE LANGUAGE, like every other table in this file since #358. It was a bare record
 * and the change is deliberate rather than mechanical: a constant is a thing a caller can capture
 * once at module scope, which is exactly how a screen comes to render its labels in whatever
 * language the process started in.
 */
export const STRUGGLE_LABELS = (lang: Lang): Record<Struggle, string> =>
  chatCopyFor(lang).struggles;

export const CHAT_PROMPTS: readonly ChatPrompt[] = [
  { id: "welcome", place: "welcome", kind: "start" },
  { id: "goal", place: "goal", field: "goal", kind: "choice", options: ["lose", "maintain", "gain"] },
  { id: "sex", place: "about", field: "sex", kind: "choice", options: ["female", "male"] },
  { id: "birth_year", place: "about", field: "birth_year", kind: "number" },
  { id: "height_cm", place: "body", field: "height_cm", kind: "number" },
  { id: "weight_kg", place: "body", field: "weight_kg", kind: "number" },
  { id: "target_weight_kg", place: "target", field: "target_weight_kg", kind: "number" },
  { id: "pace", place: "target", field: "pace", kind: "choice", options: ["easy", "steady", "push"] },
  { id: "activity", place: "activity", field: "activity", kind: "choice", options: ["sedentary", "light", "moderate", "active", "athlete"] },
  { id: "struggles", place: "struggles", kind: "chips", options: STRUGGLES },
  // NO `options`, and it is the only choice prompt without them. The country list is sorted by the
  // reader's own alphabet — Austria files under Ö in German and А in Russian — so it cannot be a
  // constant on a prompt. Every renderer falls through to `screenOptionValues(screen, lang)`,
  // which is where it has to come from. This line WAS `["de", "gb", "us", "other"]`, a fourth copy
  // of the list, and it is what both surfaces actually rendered: growing `COUNTRY_CODES` changed
  // nothing on screen until it went.
  { id: "country", place: "country", field: "country", kind: "choice" },
  { id: "restrictions", place: "restrictions", field: "restrictions", kind: "chips" },
  { id: "building", place: "building", kind: "auto" },
  { id: "summary", place: "summary", kind: "auto" },
] as const;

/** One prompt by id. Total for a valid id; the server validates before it calls this. */
export function promptById(id: ChatPromptId): ChatPrompt | undefined {
  return CHAT_PROMPTS.find((p) => p.id === id);
}

/**
 * The prompts this profile will actually meet.
 *
 * A maintainer is asked neither a goal weight nor a pace — both are questions about a change they
 * are not making. A group the admin switched off takes its prompts with it, which today is only
 * `country`: the phone reads it from the device region instead.
 */
export function promptsFor(p: Profile, disabled: readonly OnboardingScreenId[] = []): ChatPrompt[] {
  const off = new Set(disabled);
  return CHAT_PROMPTS.filter((prompt) => {
    if (!prompt.field) return true;
    if (!stepApplies(prompt.field, p)) return false;
    return !off.has(screenForStep(prompt.field));
  });
}

/**
 * Where a run picks up, as an index into `promptsFor`.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * A CONVERSATION HAS TO RESUME SOMEWHERE, AND THE PROFILE IS THE ONLY HONEST PLACE
 *
 * The rule is the one the screens had: the flow is FIELD-DERIVED, so being killed mid-answer
 * resumes at the question the data says you are on, never past it. Everything before that point is
 * replayed as a transcript — Spud's question and the answer already on the profile — so the user
 * arrives back in a conversation rather than at a bare prompt.
 *
 * A conversation question is SKIPPED when it sits before the resume point. It is not on the
 * profile, so re-asking is the only way to have it, and re-asking "what's been hard?" after the app
 * was killed is worse than never asking: the answer was given, the user remembers giving it, and
 * nothing downstream needs it a second time.
 *
 * A run with nothing answered at all starts at zero, on the front door. Anybody with one answer has
 * been past it.
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 */
export function resumeAt(prompts: readonly ChatPrompt[], p: Profile): number {
  const first = prompts.findIndex((prompt) => prompt.field !== undefined && !isAnswered(prompt, p));
  if (first === -1) return prompts.length;
  // Nothing answered at all is a fresh install, and a fresh install starts at the front door rather
  // than at the first question — which is also the gate that keeps a returning user from reading
  // the introduction twice.
  return prompts.some((prompt) => isAnswered(prompt, p)) ? first : 0;
}

/**
 * Whether the profile already carries this prompt's answer.
 *
 * `restrictions` is answered by COMPLETING, not by holding a value: an empty array is a real answer
 * ("none of these") and is indistinguishable from "never asked" by inspection, so the completion
 * flag carries that bit instead.
 */
export function isAnswered(prompt: ChatPrompt, p: Profile): boolean {
  if (!prompt.field) return false;
  if (prompt.field === "restrictions") return p.onboarded_at !== null;
  return p[prompt.field] !== null;
}

// ── The questions Spud asks ──────────────────────────────────────────────────────────────────

/** The editable ask for a profile field, or nothing when this binary's content has none. */
function askContent(content: OnboardingContent, field: OnboardingStep) {
  const id = screenForStep(field);
  const screen = content.screens.find((s) => isKnownScreen(s.id) && s.id === id);
  return screen?.asks?.[field];
}

/**
 * ONE SERVED REVISION: the admin's words, and the language they were served in.
 *
 * The two travel together because they can disagree and nothing else would notice. `content` comes
 * from `GET /v1/onboarding?lang=`, which resolves the QUERY first and the account second, while
 * `lang` supplies the code-side clauses inside the same bubble (`loseTail`, `nothingApplies`). Pass
 * a profile's language beside content fetched for a different one and one sentence is Italian with
 * a German tail — typed as two arguments, that was a mistake no compiler could see, and the phone
 * is where it would be made. `OnboardingContentResponse` is exactly this shape, so a client hands
 * the response straight in.
 */
export interface ServedContent {
  content: OnboardingContent;
  lang: Lang;
}

/**
 * What Spud says to pose one prompt, as bubbles.
 *
 * The profile questions read the ADMIN'S words; the conversation question reads the constant below.
 * `{loseTail}` is the one substitution in the shipped copy, and it exists because "faster isn't
 * better here" is a warning about losing weight: said to somebody gaining, it is rule 1's reply
 * written for nobody.
 */
export function askLines(
  prompt: ChatPrompt,
  served: ServedContent,
  p: Profile,
): string[] {
  const { content, lang } = served;
  // The front door is content too, and it is the one prompt with no field and no constant.
  if (prompt.id === "welcome") return [...content.welcome.lines];
  if (prompt.field) {
    const ask = askContent(content, prompt.field);
    // Never empty: `usableContent` drops a whole revision that is missing an ask, so reaching this
    // fallback means the compiled-in default is what is on screen and something is very wrong.
    const lines = ask?.lines ?? [];
    // `{loseTail}` comes from the CODE table and the sentence around it from the admin's, because
    // the tail is a warning about losing weight and the question is not. `content` is already in
    // this language — the server chose it — so the two halves cannot end up in different ones.
    return lines.map((line) => line.replace("{loseTail}", p.goal === "lose" ? chatCopyFor(lang).loseTail : ""));
  }
  // `building` and `summary` ask nothing — they are cards Spud draws — so an empty list is the
  // right answer for them rather than a throw, and a coordinate naming one is refused by the caller.
  return [...(conversationAsks(lang)[prompt.id] ?? [])];
}

/**
 * The composer's placeholder while a prompt is open, or null when there is nothing to type.
 *
 * Only a profile question takes typed input now — `struggles` is chips and a quick reply — so the
 * admin's word is the only source there is.
 */
export function askPlaceholder(prompt: ChatPrompt, content: OnboardingContent): string | null {
  return prompt.field ? askContent(content, prompt.field)?.placeholder ?? null : null;
}

/** The idle placeholder, everywhere a prompt does not name its own. copy.md § Step 01. */
export const IDLE_PLACEHOLDER = (lang: Lang): string => chatCopyFor(lang).idlePlaceholder;

const conversationAsks = (lang: Lang): Record<string, readonly string[]> =>
  ({ struggles: chatCopyFor(lang).strugglesAsk });

/** The multi-selects' way out: `finish` is the dock's primary button, `none` a pill. copy.md, verbatim. */
export const QUICK_REPLIES = (lang: Lang) => chatCopyFor(lang).quick;

// ── Support cards ────────────────────────────────────────────────────────────────────────────

/**
 * A statistic, and where it came from.
 *
 * `source` is not decoration and not optional by accident: a card that quotes a number without
 * naming the study is the shape of every wellness app's invented statistic. A card with nothing to
 * cite (the four that are statements about how this app behaves, not about people) carries no
 * source line rather than a vague one.
 */
export interface SupportCard {
  title: string;
  body: string;
  source?: string;
}

/** copy.md § Step 02 — the card after the goal, one per branch. The words are in `CHAT_COPY`. */
export const GOAL_CARDS = (lang: Lang): Record<Goal, SupportCard> => chatCopyFor(lang).goalCards;

/** The line after the goal card. Reads the branch taken — rule 1. */
export const GOAL_FOLLOWUPS = (lang: Lang): Partial<Record<Goal, string>> =>
  chatCopyFor(lang).goalFollowups;

/**
 * copy.md § Step 08 — one card per struggle picked, at most two.
 *
 * `diets` is the one that branches, and it branches on a citation rather than on tone: the regain
 * meta-analysis is about weight LOSS, so quoting it to somebody gaining would be bending it. The
 * gain variant states the weaker thing that is true, and carries no source, because there is not
 * one for it.
 */
export function struggleCard(struggle: Struggle, goal: Goal, lang: Lang): SupportCard {
  const copy = chatCopyFor(lang);
  if (struggle === "diets" && goal === "gain") return copy.dietsGainCard;
  return copy.struggleCards[struggle]!;
}

/**
 * copy.md § Step 05 — the gain support card.
 *
 * The percentage is READ FROM `MAX_SURPLUS_SHARE`, not typed. A safety guarantee described in copy
 * that the arithmetic does not implement is the worst sentence this repo could ship, and the way
 * that happens is somebody changing the constant and not the prose.
 */
export const GAIN_PACE_CARD = (lang: Lang): SupportCard =>
  filled(chatCopyFor(lang).gainPaceCard, { share: String(Math.round(MAX_SURPLUS_SHARE * 100)) });

/** copy.md § Step 03 — the under-16 stop. The refusal is the server's; this is how it reads. */
export const UNDER_AGE_CARD = (lang: Lang): SupportCard =>
  filled(chatCopyFor(lang).underAgeCard, { age: String(MIN_AGE) });

/**
 * The stop, offered and then taken.
 *
 * "Nothing you told me is kept" is a promise, so taking this branch DELETES the account rather
 * than merely refusing the next write — the goal and the sex answered a minute ago are already
 * rows. See `onboarding.tsx`.
 */
export const UNDER_AGE_LINES = (lang: Lang) => {
  const copy = chatCopyFor(lang).underAge;
  const age = { age: String(MIN_AGE) };
  return {
    ask: copy.ask,
    confirm: copy.confirm,
    placeholder: copy.placeholder,
    stopped: copy.stopped.map((line) => fill(line, age)),
    endedPlaceholder: fill(copy.endedPlaceholder, age),
  };
};

/** copy.md § Step 05 — the target below a healthy BMI. The server refuses it; this explains it. */
export function belowHealthyCard(minHealthyKg: number, lang: Lang): SupportCard {
  return filled(chatCopyFor(lang).belowHealthy, { kg: numbers(lang)(minHealthyKg) });
}

/**
 * One `{placeholder}` per declared key, and a key with nothing to fill it left alone.
 *
 * Left alone rather than blanked, because a brace on screen is a bug somebody reports and a silent
 * gap in a sentence is one nobody does. `onboarding-chat-copy.test.ts` asserts every table fills.
 */
const fill = (template: string, params: Record<string, string>): string =>
  template.replace(/\{(\w+)\}/g, (whole, key: string) => params[key] ?? whole);

/** A card with its numbers in. `source` is absent on the four that are statements, not citations. */
const filled = (card: CardCopy, params: Record<string, string>): SupportCard => ({
  title: fill(card.title, params),
  body: fill(card.body, params),
  ...(card.source !== undefined ? { source: card.source } : {}),
});

// ── What Spud says back ──────────────────────────────────────────────────────────────────────

/** How many support cards a multi-select gets. Two is the design's number: three is a lecture. */
export const MAX_STRUGGLE_CARDS = 2;

/** copy.md § Step 04 — the acknowledgement, and the first real number six steps early. */
export function weightAck(bmr: number | null, lang: Lang): string[] {
  const copy = chatCopyFor(lang).weightAck;
  const lines = [copy.noted];
  // Only when there is one. `basalMetabolicRate` returns null for anthropometrics it will not
  // compute from, and a quick win that says "about null kcal" is worse than no quick win.
  if (bmr !== null) lines.push(fill(copy.bmr, { bmr: numbers(lang)(bmr) }));
  return lines;
}

/** copy.md § Step 06 — one reply per activity level. `athlete` is this binary's fifth. */
export const ACTIVITY_REPLIES = (lang: Lang): Record<string, string> =>
  chatCopyFor(lang).activityReplies;

/**
 * copy.md § Step 08 — the line after the cards, or the line when nothing was picked.
 *
 * It NAMES WHAT IS LEFT, and the number has to be right: it used to promise "one more question
 * about them", which was the hardest-moment question, and that question is gone.
 */
export function strugglesCloser(picked: number, lang: Lang): string {
  const copy = chatCopyFor(lang).strugglesCloser;
  return picked === 0 ? copy.none : picked > 1 ? copy.many : copy.one;
}

/**
 * copy.md § Step 10 — what gets scored, and only what was declared.
 *
 * The cholesterol line CHAINS onto the kidney one ("too", "same rule"), so it must never fire
 * without it — which is why this returns the whole reply rather than one line per tag.
 */
export function restrictionsReply(
  tags: readonly RestrictionTag[],
  freeText: boolean,
  lang: Lang,
): string[] {
  const copy = chatCopyFor(lang).restrictions;
  const lines: string[] = [];
  if (tags.includes("kidneys")) lines.push(copy.kidneys);
  if (tags.includes("ldl")) lines.push(lines.length > 0 ? copy.ldlChained : copy.ldl);
  if (lines.length === 0 && tags.length > 0) lines.push(copy.declared);
  if (lines.length === 0) lines.push(copy.none);
  if (freeText) lines.push(copy.freeText);
  return lines;
}

// ── Numbers, refusals, and the direction check ───────────────────────────────────────────────

export type NumberField = "birth_year" | "height_cm" | "weight_kg" | "target_weight_kg";

export type NumberAnswer =
  | { ok: true; value: number }
  /** The value is not one this app takes, and `line` is what Spud says instead of taking it. */
  | { ok: false; line: string }
  /** The age says under sixteen. Not a validation failure — a stop. See `UNDER_AGE_CARD`. */
  | { ok: false; underAge: true }
  /** A high two-digit answer that could be a year typed the short way. Asked, never guessed. */
  | { ok: false; ambiguousAge: number };

/**
 * The clarifying exchange for that ambiguity. "90" typed under year-worded copy means 1990; typed
 * by a ninety-year-old it means ninety. Guessing either way computes somebody else's target, so
 * Spud asks — the quick reply takes it as an age, four digits take it as the year.
 */
export const AMBIGUOUS_AGE = (lang: Lang) => {
  const copy = chatCopyFor(lang).ambiguousAge;
  const n = numbers(lang);
  return {
    // The YEAR is not a quantity and must never be grouped: `1990` and not `1,990`. The age beside
    // it is, and at two digits the two formatters agree anyway — which is exactly why the rule has
    // to be written down rather than observed.
    line: (age: number) => fill(copy.line, { year: String(age + 1900) }),
    confirm: (age: number) => fill(copy.confirm, { age: n(age) }),
  };
};

/**
 * A typed number, checked before it costs a round trip.
 *
 * THE BANDS ARE A SUBSET OF THE SERVER'S, deliberately. `profile.ts` refuses a height outside
 * 100–250 and a weight outside `MIN_WEIGHT_KG`–400 with `out-of-range`, which reaches the app as a
 * refusal with no sentence written for it. Checking a tighter band here means every value this
 * screen accepts is one the server accepts too, so the only refusals a user can meet are the two
 * that have words: the age minimum and the healthy-BMI floor.
 */
const parseNumber = (s: string): number => {
  const match = s.match(/-?\d+(?:[.,]\d+)?/);
  return match ? Number(match[0].replace(",", ".")) : NaN;
};

export function checkNumber(
  field: NumberField,
  raw: string,
  lang: Lang,
  // BEHIND the language, and that is the whole reason it moved. Required-after-optional compiles,
  // and it made reaching the language cost a `new Date()` the caller did not want to name — so the
  // call that skipped it read as correct and rendered English.
  today = new Date(),
): NumberAnswer {
  const invalid = chatCopyFor(lang).invalid;
  // THE QUESTION IS AN AGE, AND THE AGE IS WHAT TRAVELS. "How old are you?" is what people answer
  // without arithmetic; `birth_year` is what the profile stores, because an age stored as a number
  // is wrong within twelve months (`types.ts`). The subtraction happens in `engine/profile.ts`,
  // with the SERVER's clock — a device sitting across a UTC year boundary derived a year off by
  // one and got a legitimate sixteen-year-old refused.
  //
  // A FOUR-DIGIT ANSWER IS THE YEAR ITSELF. Copy saved before this question changed still asks for
  // one, and people type years out of habit anyway. The thousands separator is stripped FIRST:
  // "1.990" is how a German writes 1990 and "1,990" is the US form, and read as decimals they were
  // age 1 — which reached the account-deleting stop from a typo.
  if (field === "birth_year") {
    const typed = Math.trunc(parseNumber(raw.replace(/(\d)[.,](\d{3})(?!\d)/g, "$1$2")));
    const age = typed >= 1000 ? today.getUTCFullYear() - typed : typed;
    if (!Number.isFinite(age) || age < 0 || age > 100) {
      return { ok: false, line: invalid.age };
    }
    // THE STOP IS FOR ANSWERS THAT PLAUSIBLY MEAN A CHILD. Its quick reply deletes the account, so
    // "0", "-0.4" and a premature send of "3" — typos, not toddlers — get the retry line instead,
    // from which nothing worse than retyping can happen.
    if (age < MIN_AGE) {
      return age >= 5 ? { ok: false, underAge: true } : { ok: false, line: invalid.age };
    }
    if (typed >= 85 && typed <= 99) return { ok: false, ambiguousAge: typed };
    return { ok: true, value: age };
  }

  const value = parseNumber(raw);
  if (!Number.isFinite(value)) return { ok: false, line: invalid[field] };
  const [lo, hi] = BANDS[field];
  if (value < lo || value > hi) return { ok: false, line: invalid[field] };
  return { ok: true, value: Math.round(value * 10) / 10 };
}

const BANDS: Record<Exclude<NumberField, "birth_year">, readonly [number, number]> = {
  height_cm: [120, 230],
  // The design says 25 kg; the server refuses anything under `MIN_WEIGHT_KG`, so the lower bound is
  // the server's. A band the client is looser than is a band whose refusals have no words.
  weight_kg: [MIN_WEIGHT_KG, 300],
  target_weight_kg: [MIN_WEIGHT_KG, 300],
};

/**
 * copy.md § Step 05 — the wrong-direction check.
 *
 * The tree remembers what was chosen at step 02. Asking to "gain" to a number below the current
 * weight used to be accepted, and `explainTargets` then added a surplus aimed at a lower number:
 * a plan that cannot arrive, with nothing on any screen to say so.
 *
 * The escape is an offer to switch the goal, because that is usually what happened — the goal was
 * mistapped, not the number.
 */
export interface DirectionRefusal {
  line: string;
  /** The quick reply that flips the goal and re-asks. */
  switchTo: Goal;
  switchLabel: string;
  placeholder: string;
}

export function checkDirection(
  goal: Goal,
  weightKg: number,
  targetKg: number,
  lang: Lang,
): DirectionRefusal | null {
  const copy = chatCopyFor(lang).direction;
  const n = numbers(lang);
  const params = { weight: n(weightKg), target: n(targetKg) };
  if (goal === "gain" && targetKg <= weightKg) {
    return {
      line: fill(copy.gain, params),
      switchTo: "lose",
      switchLabel: copy.switchToLose,
      placeholder: fill(copy.above, params),
    };
  }
  if (goal === "lose" && targetKg >= weightKg) {
    return {
      line: fill(copy.lose, params),
      switchTo: "gain",
      switchLabel: copy.switchToGain,
      placeholder: fill(copy.below, params),
    };
  }
  return null;
}

/** What Spud says after the goal is flipped mid-question, and the target is asked again. */
export function switchedLine(goal: Goal, lang: Lang): string {
  const copy = chatCopyFor(lang).switched;
  return goal === "gain" ? copy.gain : copy.lose;
}

/** The lowest weight this app will set as a target for a height, in whole kg. Mirrors `checkTargetWeight`. */
export function minHealthyKg(heightCm: number): number {
  const m = heightCm / 100;
  return Math.ceil(MIN_TARGET_BMI * m * m);
}

// ── The plan ─────────────────────────────────────────────────────────────────────────────────

/**
 * copy.md § Step 12 — the share-cap note, with the percentage read from the constant.
 *
 * "maintenance" is a word the chat never introduced, so the sentence says "what your body burns in
 * a day" — which is the label on the row directly above it in the calc card.
 */
export function capNote(
  template: string,
  goal: Goal | null,
  kgPerWeek: number | null,
  lang: Lang,
): string {
  const share = goal === "gain" ? MAX_SURPLUS_SHARE : MAX_DEFICIT_SHARE;
  const base = template.replace("{share}", String(Math.round(share * 100)));
  if (kgPerWeek === null) return base;
  return base + fill(chatCopyFor(lang).capNoteTail, { kg: numbers(lang)(kgPerWeek) });
}

/** The projection sentence, or null when a date would be an invention. `projection.ts` says when. */
export function projectionLine(
  template: string,
  far: string,
  p: { beyondHorizon: boolean; weeks: number },
  month: string,
  targetKg: number | null,
  lang: Lang,
): string {
  if (p.beyondHorizon) return far;
  return template
    .replace("{weeks}", String(p.weeks))
    .replace("{month}", month)
    .replace("{target}", targetKg === null ? "" : numbers(lang)(targetKg));
}

/**
 * The answer already on the profile, written the way the user gave it.
 *
 * This is what a RESUMED run draws in the user's own bubble, so the replayed transcript reads as
 * the conversation that happened rather than as a database dump: "Lose weight", not `lose`, and
 * "93" rather than `93` with a unit nobody typed. An enumerated value with no label in this
 * binary's content falls back to the raw value — a stale cache is not validated copy.
 */
export function answerLabel(
  prompt: ChatPrompt,
  p: Profile,
  served: ServedContent,
): string | null {
  const { content, lang } = served;
  if (!prompt.field || !isAnswered(prompt, p)) return null;
  const raw = p[prompt.field];
  if (prompt.field === "restrictions") {
    const tags = (raw as string[]).filter((t) => t !== "");
    if (tags.length === 0) return chatCopyFor(lang).nothingApplies;
    const opts = content.screens.find((s) => s.id === "restrictions")?.options ?? {};
    return tags.map((t) => opts[t]?.label ?? t).join(" · ");
  }
  if (raw === null) return null;
  // Typed as an age, stored as a year: drawn back as what was typed. Plain subtraction, NOT
  // `ageFrom` — that is an eligibility band, and at its edge (an accepted 100-year-old crossing
  // New Year) it returned null and the fallback drew the raw year in the user's own bubble.
  if (prompt.field === "birth_year") return String(new Date().getUTCFullYear() - (raw as number));
  // A VOCABULARY IS THE SCREEN'S, NOT THE PROMPT'S. This asked `prompt.options` and echoed the raw
  // value when there were none — which, the moment the country prompt stopped carrying a list,
  // would have drawn the user's own answer back to them as `de`.
  const id = screenForStep(prompt.field);
  if (screenOptionValues(id, lang).length > 0) {
    const opts = content.screens.find((s) => isKnownScreen(s.id) && s.id === id)?.options ?? {};
    return opts[String(raw)]?.label ?? optionLabel(id, String(raw), lang);
  }
  return String(raw);
}

/**
 * What an edit to goal, weight or target weight should actually do.
 *
 * `checkDirection` answers "do these three disagree"; this answers "and so what", which is a
 * different question at every one of the three edit sites and was previously answered only inside
 * onboarding's chat flow. Settings edits the same fields later, so it needs the same answers — and
 * the server validates RANGES but not COHERENCE, so nothing else is going to stop "gain to 80 kg"
 * from 94.
 *
 * The three cases differ because the fields differ in kind:
 *  - the TARGET is a choice, so a contradictory one is refused and re-asked;
 *  - the GOAL is a statement of intent, so it wins and takes the now-meaningless target with it;
 *  - the WEIGHT is a FACT and is always recorded. Refusing to store what someone weighs because it
 *    disagrees with a goal they set months ago is the app arguing with a scale.
 */
export interface GoalEdit {
  /** The patch to send, or null when the edit is refused. */
  patch: Partial<Pick<Profile, "goal" | "weight_kg">> & { target_weight_kg?: number | null } | null;
  /** What to tell the user. Null when there is nothing worth saying. */
  note: string | null;
}

export function reconcileGoalEdit(
  current: Pick<Profile, "goal" | "weight_kg" | "target_weight_kg">,
  patch: { goal?: Goal; weight_kg?: number; target_weight_kg?: number },
  lang: Lang,
): GoalEdit {
  const goal = patch.goal ?? current.goal;
  const weightKg = patch.weight_kg ?? current.weight_kg;
  const targetKg = patch.target_weight_kg ?? current.target_weight_kg;

  if (goal == null || goal === "maintain" || weightKg == null || targetKg == null) {
    return { patch, note: null };
  }
  if (!checkDirection(goal, weightKg, targetKg, lang)) return { patch, note: null };

  if (patch.target_weight_kg !== undefined) {
    return { patch: null, note: checkDirection(goal, weightKg, targetKg, lang)!.line };
  }
  if (patch.goal !== undefined) {
    return {
      patch: { ...patch, target_weight_kg: null },
      note: chatCopyFor(lang).goalEdit.cleared,
    };
  }
  return {
    patch,
    note: chatCopyFor(lang).goalEdit.worthSetting,
  };
}
