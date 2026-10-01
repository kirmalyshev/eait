// Onboarding as a conversation: the order, the branches, and every sentence Spud says back.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// WHY THIS IS SHARED AND PURE, AND WHY IT IS NOT ADMIN-EDITABLE
//
// SHARED, because it is where the branch logic lives, and branch logic is exactly the part that
// `bun test` has to be able to reach without a simulator. The on-track caption reads the struggles
// picked one beat earlier; that is a rule, and a rule nobody can run is a rule that drifts.
//
// NOT EDITABLE, because which line a case takes IS this file — a text box can hold a sentence but
// not the branch that chose it. A cited figure stays code for the `claims.ts` reason: an
// admin-editable health statistic is an unsubstantiated claim with no gate in front of it. The
// QUESTIONS Spud asks are editable (`onboarding.ts`, `asks`); the conversation around them is
// code.
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
// back. `struggles` stayed because it picks the on-track caption that appears one beat later.

import {
  DIETS, MAX_DEFICIT_SHARE, MAX_SURPLUS_SHARE, MEDICAL_TAGS, MIN_AGE, MIN_WEIGHT_KG, dietOf,
  explainTargets, medicalOf, minHealthyWeightKg,
} from "./targets.ts";
import { fill, kcalNumbers, numbers, spellUnit, wholeNumbers } from "./lang.ts";
import { projectGoal, projectionMonth, previewProjection } from "./projection.ts";
import { kgToLb, type UnitSystem } from "./ui/units.ts";
import { chatCopyFor, type CardCopy } from "./onboarding-chat-copy.ts";
import { threadCopyFor } from "./chat-copy.ts";
import { ACTIVITY_LEVELS, PACES, SEXES, STRUGGLES } from "./types.ts";
import type { Goal, Lang, Pace, Profile, Struggle, Units, Verdict, VerdictDimension } from "./types.ts";
import {
  isKnownScreen, optionLabel, screenForStep, screenOptionValues, screenOptions, stepApplies,
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
  | "welcome" | "goal" | "how" | "sex" | "birth_year" | "height_cm" | "weight_kg"
  | "activity" | "target_weight_kg" | "pace" | "struggles" | "ontrack"
  | "diet" | "medical" | "building" | "summary" | "signup" | "country" | "health";

/**
 * How an answer is given.
 *
 *   start   a single quick reply, and nothing to type
 *   choice  one of an enumerated list, tapped
 *   chips   any number of an enumerated list, plus a quick reply to finish
 *   number  the number pad
 *   text    the composer, with quick replies beside it
 *   auto    nothing to answer — a card Spud draws and moves on from
 *   health  the Apple Health offer: a connect button beside a manual one, its answer being the
 *           permission's outcome rather than typed text
 */
export type ChatPromptKind = "start" | "choice" | "chips" | "number" | "text" | "auto" | "health";

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

/**
 * The struggle ids live on `types.ts` now — they are a stored profile field (`Profile.struggles`),
 * not a conversation-only pick. Five, Cal AI's, in list order; the first picked writes the
 * on-track caption.
 */
export const STRUGGLE_LABELS = (content: OnboardingContent): Record<string, string> =>
  Object.fromEntries(
    Object.entries(content.screens.find((s) => s.id === "struggles")?.options ?? {})
      .map(([k, v]) => [k, v.label]),
  );

export const CHAT_PROMPTS: readonly ChatPrompt[] = [
  { id: "welcome", place: "welcome", kind: "start" },
  { id: "goal", place: "goal", field: "goal", kind: "choice", options: ["lose", "maintain", "gain"] },
  // The "whole app" picture: three beats, no answer. Its words are the compiled `how` copy.
  { id: "how", place: "how", kind: "auto" },
  { id: "sex", place: "sex", field: "sex", kind: "choice", options: SEXES },
  { id: "birth_year", place: "age", field: "birth_year", kind: "number" },
  { id: "height_cm", place: "height", field: "height_cm", kind: "number" },
  { id: "weight_kg", place: "weight", field: "weight_kg", kind: "number" },
  { id: "activity", place: "activity", field: "activity", kind: "choice", options: ACTIVITY_LEVELS },
  { id: "target_weight_kg", place: "target", field: "target_weight_kg", kind: "number" },
  { id: "pace", place: "pace", field: "pace", kind: "choice", options: PACES },
  { id: "struggles", place: "struggles", field: "struggles", kind: "chips", options: STRUGGLES },
  // The two-ways chart: a beat, not a question — it reads `struggles` and writes nothing.
  { id: "ontrack", place: "ontrack", kind: "auto" },
  // `diet` and `medical` carry "fields" that are not profile columns: they are the two VIEWS of
  // `restrictions` (see `OnboardingStep`). The server merges each answer inside the one array.
  { id: "diet", place: "diet", field: "diet", kind: "choice", options: DIETS },
  { id: "medical", place: "medical", field: "medical", kind: "chips", options: [...MEDICAL_TAGS, "none"] },
  { id: "building", place: "building", kind: "auto" },
  { id: "summary", place: "summary", kind: "auto" },
  // The account step — the sign-in surface owns it (S8); this list holds its PLACE in the order.
  { id: "signup", place: "signup", kind: "auto" },
  // NO `options`, and it is the only choice prompt without them. The country list is sorted by the
  // reader's own alphabet — Austria files under Ö in German and А in Russian — so it cannot be a
  // constant on a prompt. Every renderer falls through to `screenOptionValues(screen, lang)`,
  // which is where it has to come from. This line WAS `["de", "gb", "us", "other"]`, a fourth copy
  // of the list, and it is what both surfaces actually rendered: growing `COUNTRY_CODES` changed
  // nothing on screen until it went.
  { id: "country", place: "country", field: "country", kind: "choice" },
  // Apple Health is the LAST place now — a post-sign-up sync offer, not the body-facts shortcut it
  // was: onboarding v2 types the body on the rulers and Health only keeps them current.
  { id: "health", place: "health", kind: "health" },
] as const;

/** One prompt by id. Total for a valid id; the server validates before it calls this. */
export function promptById(id: ChatPromptId): ChatPrompt | undefined {
  return CHAT_PROMPTS.find((p) => p.id === id);
}

/**
 * What the surface can do, as flags — and deliberately a REQUIRED argument. The web and the app
 * run the same walk except for this: a browser cannot read Apple Health, so the offer must not
 * appear there. A default would hide the decision the caller has to make.
 */
export interface OnboardingSurface {
  /** Apple Health can be read (iOS). False in the browser. */
  health: boolean;
}

/**
 * The prompts this profile will actually meet.
 *
 * A maintainer is asked neither a goal weight nor a pace — both are questions about a change they
 * are not making. A group the admin switched off takes its prompts with it, which today is only
 * `country`: the phone reads it from the device region instead. And the Health offer is only
 * emitted on a surface that can answer it — `surface.health`.
 */
export function promptsFor(
  p: Profile,
  disabled: readonly OnboardingScreenId[] = [],
  surface: OnboardingSurface,
): ChatPrompt[] {
  const off = new Set(disabled);
  return CHAT_PROMPTS.filter((prompt) => {
    if (prompt.id === "health") return surface.health;
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
 * THREE FIELDS DO NOT READ AS PLAIN NON-NULL. `struggles` stores a real array, where `null` is
 * "never asked" and `[]` is "asked, nothing picked" — resume reads exactly that bit. `diet` and
 * `medical` are VIEWS of `restrictions`, which can hold a real answer ("balanced" stores no tag,
 * "none of these" stores none) that is indistinguishable from never-asked — so for those the
 * completion flag carries the bit, exactly the rule `restrictions` already had. Accepted cost:
 * someone who picked Balanced and stopped mid-run is asked diet once more on resume.
 */
export function isAnswered(prompt: ChatPrompt, p: Profile): boolean {
  if (!prompt.field) return false;
  if (prompt.field === "struggles") return p.struggles !== null;
  if (prompt.field === "diet") return dietOf(p.restrictions) !== "balanced" || p.onboarded_at !== null;
  if (prompt.field === "medical") return p.onboarded_at !== null;
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
    return [...(ask?.lines ?? [])];
  }
  // `how`, `ontrack`, `building`, `summary` and `signup` ask nothing — they are cards the client
  // draws — so an empty list is the right answer for them rather than a throw.
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
  ({
    health: [chatCopyFor(lang).health.title, chatCopyFor(lang).health.body],
  });

/** The one button under every screen that answers something — "Continue". */
export const continueLabel = (lang: Lang): string => chatCopyFor(lang).continueLabel;

// ── Support cards ────────────────────────────────────────────────────────────────────────────

/**
 * A statistic, and where it came from — or, for a card that cites nothing, just the words.
 *
 * `source` is not decoration and not optional by accident: a card that quotes a number without
 * naming the study is the shape of every wellness app's invented statistic. A card with nothing to
 * cite (statements about how this app behaves — the struggle cards, the gain variant) carries no
 * source line rather than a vague one.
 */
export interface SupportCard {
  title: string;
  body: string;
  source?: string;
}

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

/** A card with its numbers in. `source` is absent on the ones that are statements, not citations. */
const filled = (card: CardCopy, params: Record<string, string>): SupportCard => ({
  title: fill(card.title, params),
  body: fill(card.body, params),
  ...(card.source !== undefined ? { source: card.source } : {}),
});

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

export const BANDS: Record<Exclude<NumberField, "birth_year">, readonly [number, number]> = {
  height_cm: [120, 230],
  // The design says 25kg; the server refuses anything under `MIN_WEIGHT_KG`, so the lower bound is
  // the server's. A band the client is looser than is a band whose refusals have no words.
  weight_kg: [MIN_WEIGHT_KG, 300],
  target_weight_kg: [MIN_WEIGHT_KG, 300],
};

/**
 * Where a control opens when neither the draft, the stored answer nor the profile holds a value —
 * the boards' neutral rider (170cm, 75kg, 30). Named so the three screens share the person
 * rather than each typing their own (#141).
 */
export const ONBOARDING_NEUTRAL = { heightCm: 170, weightKg: 75, ageYears: 30 } as const;

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

/**
 * The lowest weight this app will set as a target for a height, in whole kg. The formula lives in
 * `targets.ts` (`minHealthyWeightKg`) — a second copy here was the drift `AGENTS.md` warns about:
 * two numbers that must agree are two numbers that eventually will not.
 */
export function minHealthyKg(heightCm: number): number {
  const floor = minHealthyWeightKg(heightCm);
  // A height outside the number check never reaches here: this is only called with a real one.
  if (floor === null) throw new RangeError(`minHealthyKg: no floor for height ${heightCm}`);
  return floor;
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
  // The two restriction VIEWS read the array back through their own screens' option labels —
  // the diet for `diet`, the cap tags for `medical`, "None of these" when it holds neither.
  if (prompt.field === "diet") {
    const diet = dietOf(p.restrictions);
    const opts = screenOptions(content, "diet");
    return opts[diet]?.label ?? optionLabel("diet", diet, lang);
  }
  if (prompt.field === "medical") {
    const opts = screenOptions(content, "medical");
    const tags = medicalOf(p.restrictions);
    if (tags.length === 0) return opts.none?.label ?? "none";
    return tags.map((t) => opts[t]?.label ?? t).join(" · ");
  }
  if (prompt.field === "struggles") {
    const opts = screenOptions(content, "struggles");
    const picked = p.struggles ?? [];
    return picked.length === 0 ? null : picked.map((s) => opts[s]?.label ?? s).join(" · ");
  }
  const raw = p[prompt.field];
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
  return typeof raw === "number" ? numbers(lang)(raw) : String(raw);
}

/**
 * What an edit to goal, weight or target weight should actually do.
 *
 * `checkDirection` answers "do these three disagree"; this answers "and so what", which is a
 * different question at every one of the three edit sites and was previously answered only inside
 * onboarding's chat flow. Settings edits the same fields later, so it needs the same answers — and
 * the server validates RANGES but not COHERENCE, so nothing else is going to stop "gain to 80kg"
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

// ── The computed words: suggestions, the pace preview, the plan rows ─────────────────────────
//
// v2 (#82) retired the reactions, the support cards and the four support moments — the screens
// are plain now, and the beats are interstitials. What stays code is the strings that carry
// NUMBERS: the stepper's suggestion, the pace preview, the plan rows. The v1 moment vocabulary
// survives only as the two types the web's now-unrouted `moment()` page still imports.
export type MomentId = "target" | "activity" | "struggles" | "restrictions";
export const MOMENT_POSES = ["cheer", "lift", "think", "heart"] as const;
export type MomentPose = (typeof MOMENT_POSES)[number];

/**
 * The target prompt's suggestion line: "I suggest {kg}kg, about {pct}% down, a good first goal".
 * `pct` is the caller's computed share off the current weight, whole — the arithmetic is
 * `suggestedTargetKg`'s caller's, the words are this table's.
 */
export function targetSuggestionLine(
  kg: number,
  pct: number,
  goal: Goal,
  lang: Lang,
): string | null {
  if (goal !== "lose" && goal !== "gain") return null;
  const copy = chatCopyFor(lang).targetSuggestion;
  return fill(goal === "lose" ? copy.down : copy.up, {
    kg: numbers(lang)(kg),
    pct: wholeNumbers(lang)(pct),
  });
}

/**
 * A weight written the way the user's toggle spells it — "68kg" or "150lb". Storage is always
 * metric; this is the display. ONE conversion lives here so a ruler, a chart and a reply cannot
 * disagree about what a kilogram reads as.
 */
const LB_PER_KG = 2.20462;
export function weightDisplay(kg: number, units: Units | null, lang: Lang): string {
  const v = units === "imperial" ? kg * LB_PER_KG : kg;
  const u = units === "imperial" ? "lb" : "kg";
  return `${numbers(lang)(Math.round(v * 10) / 10)}${spellUnit(lang, u)}`;
}

/**
 * The on-track beat's caption — the FIRST picked struggle in LIST order writes it ("a card speaks
 * to one struggle"), and nothing picked means no caption rather than a guessed one.
 */
export function ontrackCaption(picked: readonly Struggle[] | null, lang: Lang): string | null {
  const first = STRUGGLES.find((s) => picked?.includes(s));
  // `{coach}` is the coach's name — the captions that promise Chat name her (S9), and the name
  // is `threadCopyFor`'s one key so the confirmed per-language table lands in one place.
  return first
    ? fill(chatCopyFor(lang).ontrack.captions[first], { coach: threadCopyFor(lang).coach.name })
    : null;
}

/**
 * The figures drawn INSIDE the "How it works" cards — the persona's own numbers, fixed to the
 * boards (`onboarding/02-how`): the grain-bowl photo, the salmon card and the mini estimate
 * curve are all drawn before a single answer exists, so nothing here is computed. The dish's
 * NAME is copy (`how.meal`); the numbers are this constant so no surface retypes them.
 */
export const HOW_DEMO = {
  startKg: 74,
  targetKg: 68,
  meal: { kcal: 540, proteinG: 34, carbsG: 48, fatG: 23 },
  /** The card's two verdict lines — dimensions and verdicts, the words are `verdictPillLabel`'s. */
  verdicts: [
    { dimension: "weight", verdict: "warn" },
    { dimension: "ldl", verdict: "warn" },
  ] as const satisfies readonly { dimension: VerdictDimension; verdict: Verdict }[],
} as const;

/**
 * The pace screen's one result, per pace — what "Gentle" / "Steady" / "Brisk" would each land.
 *
 * The big number is the PROJECTION's kgPerWeek rounded to one decimal, never the pace's requested
 * rate: steady asks for 0.5 and the 20 % cap hands back 0.37, and a screen that printed the asked
 * number would lie about the plan it is about to build (DIRECTION §"the cap and the floor stay
 * visible"). `marker` names which guard decided it — `cap` or `floor` — and `markerText` is its
 * one small line; `capNote` / `floorTitle` stay one tap behind, unspoken until asked for.
 */
export interface PacePreview {
  ratePerWeek: number | null;
  /** "{target} around {month} · {kcal}kcal a day" — null where the projection honestly has none. */
  line: string | null;
  marker: "cap" | "floor" | null;
  markerText: string | null;
}

export function pacePreview(
  p: Profile,
  pace: Pace,
  today: Date,
  lang: Lang,
): PacePreview | null {
  if (p.target_weight_kg === null || p.weight_kg === null) return null;
  const candidate = { ...p, pace };
  const { targets, basis } = explainTargets(candidate, today);
  const proj = previewProjection(p, p.target_weight_kg, pace);
  const copy = chatCopyFor(lang).pace;
  // The floor wins when both bit: "every pace lands here" is the floor's story, and the cap's
  // marker under it would explain a number that the floor, not the cap, produced.
  const marker = basis.floorApplied ? "floor" as const
    : basis.shareCapApplied ? "cap" as const
    : null;
  return {
    ratePerWeek: proj === null ? null : Math.round(proj.kgPerWeek * 10) / 10,
    line: proj === null ? null : fill(copy.result, {
      target: weightDisplay(p.target_weight_kg, p.units, lang),
      month: projectionMonth(today, proj.weeks, lang),
      kcal: kcalNumbers(lang)(targets.kcal),
    }),
    marker,
    markerText: marker === "floor"
      ? fill(copy.floorMarker, { floor: kcalNumbers(lang)(basis.floorKcal) })
      : marker === "cap" ? copy.capMarker : null,
  };
}

/**
 * The plan reveal's rows — computed values beside the content's labels (ob-building).
 *
 * The sixth row is "the declared limit": one row per medical tag that CARRIES a cap (ldl's
 * saturated fat, kidneys' sodium — read off `targets`, so a cap that was not computed cannot
 * print). `lowsugar` declares no numeric limit and draws none; more than one cap draws one row
 * each and they share the last tick of `PLAN_REVEAL`.
 */
export interface PlanRow {
  id: "calories" | "protein" | "carbs" | "fat" | "diet" | "limit";
  label: string;
  value: string;
}

export function planRows(
  p: Profile,
  targets: { kcal: number; protein_g: number; carbs_g: number; fat_g: number; satfat_g?: number; sodium_mg?: number },
  content: OnboardingContent,
  lang: Lang,
): PlanRow[] {
  const b = content.building;
  const n = numbers(lang);
  const rows: PlanRow[] = [
    { id: "calories", label: b.rows.calories, value: kcalNumbers(lang)(targets.kcal) },
    { id: "protein", label: b.rows.protein, value: `${n(targets.protein_g)}g` },
    { id: "carbs", label: b.rows.carbs, value: `${n(targets.carbs_g)}g` },
    { id: "fat", label: b.rows.fat, value: `${n(targets.fat_g)}g` },
    {
      id: "diet", label: b.rows.diet,
      value: screenOptions(content, "diet")[dietOf(p.restrictions)]?.label ?? dietOf(p.restrictions),
    },
  ];
  const medOpts = screenOptions(content, "medical");
  for (const [tag, cap] of [["ldl", targets.satfat_g], ["kidneys", targets.sodium_mg]] as const) {
    if (cap === undefined) continue;
    rows.push({
      id: "limit",
      label: medOpts[tag]?.label ?? tag,
      value: fill(b.limitCap[tag], { n: n(cap) }),
    });
  }
  return rows;
}

/**
 * The plan card's own goal line: "Goal: lose 6kg by January 2027" — the user's stated direction
 * and delta beside the plan's OWN projection month (same rule `offerHeadline` holds: a computed
 * month, or none). A maintainer's plan says "keep my weight" instead, and a projection past the
 * horizon honestly names no month.
 */
export function planGoalLine(p: Profile, today: Date, lang: Lang): string | null {
  const copy = chatCopyFor(lang).plan;
  if (p.goal === "maintain") return copy.goalMaintain;
  if (p.target_weight_kg === null || p.weight_kg === null) return null;
  const projection = projectGoal(p, explainTargets(p, today).basis);
  if (projection === null || projection.beyondHorizon) return null;
  return fill(p.goal === "gain" ? copy.goalGain : copy.goalLose, {
    delta: weightDisplay(Math.abs(p.weight_kg - p.target_weight_kg), p.units, lang),
    month: projectionMonth(today, projection.weeks, lang),
  });
}

/**
 * The soft offer's title after the plan: "Get to 68kg by January 2027".
 *
 * Null wherever the plan itself names no arrival — maintaining, no target, a projection
 * `projectGoal` will not make, or one past the horizon where the plan says "over two years" — so
 * the offer never promises a date the plan did not. The month is the plan's own (`projectGoal` over
 * `explainTargets`), never a figure the client works out.
 */
export function offerHeadline(p: Profile, today: Date, lang: Lang): string | null {
  if (p.target_weight_kg === null) return null;
  const projection = projectGoal(p, explainTargets(p, today).basis);
  if (projection === null || projection.beyondHorizon) return null;
  return fill(chatCopyFor(lang).offerHeadline, {
    kg: numbers(lang)(p.target_weight_kg),
    month: projectionMonth(today, projection.weeks, lang),
  });
}

/**
 * The plan headline over the progress graph (S6; board `15-plan`): "Goal: lose 6kg by January
 * 2027" — the goal the user already stated, restated with the plan's own projection.
 *
 * LOSE ONLY, and only where `projectGoal` names an arrival: maintain, gain, a missing target and
 * a projection past the horizon all draw nothing, because no board draws them a headline. The
 * amount is current − target in the reader's `units` (the unit word is part of the template, per
 * the unit rule in this workspace's AGENTS.md); the month is the plan's own, year included.
 *
 * This is the ONE sentence the claims gate exempts from `weight-promise` — `CLAIM_EXEMPTIONS` in
 * `claims.ts` names the key — a published promise, not a hole in the gate.
 */
export function planHeadline(p: Profile, today: Date, units: UnitSystem, lang: Lang): string | null {
  if (p.goal !== "lose" || p.weight_kg === null || p.target_weight_kg === null) return null;
  const projection = projectGoal(p, explainTargets(p, today).basis);
  if (projection === null || projection.beyondHorizon) return null;
  const loss = p.weight_kg - p.target_weight_kg;
  return fill(chatCopyFor(lang).planGoal[units], {
    n: numbers(lang)(units === "imperial" ? kgToLb(loss) : loss),
    month: projectionMonth(today, projection.weeks, lang),
  });
}
