// Onboarding: the sequence, the screens, the editable copy, and the analytics vocabulary.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// THREE LAYERS, AND THE LINE BETWEEN THEM IS THE POINT
//
//   1. STEPS   — the profile fields onboarding must fill. Fixed in code. `targets.ts` computes a
//                calorie target from these, so the set is not editable by anyone at runtime.
//   2. SCREENS — how those fields are grouped and ordered. Fixed in code; a screen may be turned
//                OFF only if every field on it is optional to the arithmetic.
//   3. CONTENT — the words. Titles, subtitles, mascot lines, option labels, the "why we ask" note.
//                Fully editable from the backend admin, validated against the shape above.
//
// An admin can rewrite every sentence in onboarding and cannot break the target math, cannot drop
// the sex question that every published BMR equation needs, and cannot invent a pace option the
// server would reject. `validateOnboardingContent` is where that boundary is enforced, and it is
// enforced on the WRITE, so bad copy never reaches a phone.
// ─────────────────────────────────────────────────────────────────────────────────────────────
//
// FIELD-DERIVED, NOT A STEP COUNTER. The current question is whichever field is still null. A
// counter loses its place when the app is killed mid-flow or reinstalled, and the failure is not
// symmetric: being asked your height twice is annoying, but being skipped past a question the
// target math needs produces a number computed from a default nobody chose.
//
// The server owns the truth (it validates and stores), and the app derives the same value locally
// so it can render the next screen without a round trip. One implementation, so they cannot
// disagree about what "next" means.

import type { Profile } from "./types.ts";
import { ACTIVITY_LEVELS, PACES } from "./types.ts";
import { RESTRICTION_TAGS } from "./targets.ts";

// ── Steps: the fields ────────────────────────────────────────────────────────────────────────

/** The questions, in order. Each names the profile field that answers it. */
export const ONBOARDING_STEPS = [
  "goal", "sex", "birth_year", "height_cm", "weight_kg", "target_weight_kg", "activity", "pace",
  "country", "restrictions",
] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/**
 * Whether a step applies to this profile at all.
 *
 * A maintaining user is asked neither a target weight nor a pace: both are questions about a
 * change they are not making, and a required field with no meaning is how a flow acquires a "skip"
 * button that then has to be handled at every later step.
 */
export function stepApplies(step: OnboardingStep, p: Profile): boolean {
  if (p.goal === "maintain" && (step === "target_weight_kg" || step === "pace")) return false;
  return true;
}

/**
 * The next unanswered question, or null when the profile is complete.
 *
 * `restrictions` is last and is always considered unanswered until onboarding is marked complete:
 * an empty array is a real answer ("none of these"), indistinguishable from "never asked" by
 * inspection, so the completion flag carries that bit instead.
 */
export function nextStep(p: Profile): OnboardingStep | null {
  for (const step of ONBOARDING_STEPS) {
    if (!stepApplies(step, p)) continue;
    if (step === "restrictions") continue;
    if (p[step] === null) return step;
  }
  return p.onboarded_at === null ? "restrictions" : null;
}

/** How far through the flow this profile is, counted in FIELDS. See `screenProgress` for screens. */
export function onboardingProgress(p: Profile): { index: number; total: number } {
  const applicable = ONBOARDING_STEPS.filter((s) => stepApplies(s, p));
  const current = nextStep(p);
  return {
    index: current === null ? applicable.length : applicable.indexOf(current),
    total: applicable.length,
  };
}

// ── Screens: how the fields are grouped ──────────────────────────────────────────────────────

/**
 * The screens, in order.
 *
 * SEVEN, DOWN FROM TEN, AND THAT IS THE HEADLINE CHANGE. Completion falls roughly 15% for every
 * screen past five, and the same ten fields asked one-per-screen is ten chances to close the app.
 * Grouping the questions a person would answer in one breath — "sex and year of birth", "height and
 * weight", "where you'd like to be, and how fast" — collects identical data in seven stops.
 *
 * SIX for a maintainer: `target` asks a goal weight and a pace, which are both questions about a
 * change they are not making, so the whole screen disappears rather than rendering half-empty.
 *
 * Nothing was dropped to get there. `country` is the only screen that may be switched off, and it
 * is the only one whose field does not enter the calorie arithmetic.
 */
export const ONBOARDING_SCREENS = [
  "goal", "about", "body", "target", "activity", "country", "restrictions",
] as const;
export type OnboardingScreenId = (typeof ONBOARDING_SCREENS)[number];

/**
 * The places that are not questions.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * INTERSTITIALS ARE NOT SCREENS, AND THAT IS THE WHOLE REASON THEY ARE SAFE
 *
 * `welcome`, `building` and `summary` collect no profile field. So they are absent from
 * `ONBOARDING_STEPS`, absent from `ONBOARDING_SCREENS`, and absent from `SCREEN_FIELDS` — which
 * means the three-layer boundary above, and every rule `validateOnboardingContent` enforces about
 * it, is exactly the shape it was before they existed. Adding a place a user can BE does not add a
 * place a calorie target can come from.
 *
 * They are still places analytics counts, because the funnel's job is to price them. A beat that
 * costs more people than it convinces has to be visible as a drop between two rows.
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 */
export const ONBOARDING_INTERSTITIALS = ["welcome", "building", "summary"] as const;
export type OnboardingInterstitial = (typeof ONBOARDING_INTERSTITIALS)[number];

/** Everywhere a user can be during onboarding. The analytics vocabulary. */
export const ONBOARDING_PLACES = [
  "welcome", ...ONBOARDING_SCREENS, "building", "summary",
] as const;
export type OnboardingPlace = OnboardingScreenId | OnboardingInterstitial;

/**
 * Which fields each screen collects, in render order.
 *
 * This is the mapping that makes a grouped flow safe to resume: the screen to show is the one
 * containing `nextStep`, and the fields before it on that screen are already answered and render
 * pre-filled rather than blank.
 */
/**
 * AT MOST TWO TEXT ENTRY FIELDS PER SCREEN, and that is a hard constraint rather than a preference.
 *
 * A number pad covers roughly the bottom 340 points of the screen. Three fields plus a header plus
 * a primary button do not fit in what is left on any iPhone this app supports, so the third field
 * and the button end up UNDER the keyboard — and there is no way off a `decimal-pad`, which has no
 * return key. Measured here: the goal-weight field sat exactly where the keyboard's own toolbar
 * renders, so reaching for it dismissed the keyboard instead, the number went nowhere, and the only
 * symptom was a Continue button that stayed disabled without saying why.
 *
 * The obvious fix — an "Next/Done" accessory bar above the keyboard — was built and does not work:
 * `InputAccessoryView` did not attach at all under the New Architecture in this Expo/RN version,
 * whether mounted inside the screen or hoisted above it. So the layout has to be right instead.
 */
export const SCREEN_FIELDS: Record<OnboardingScreenId, readonly OnboardingStep[]> = {
  goal: ["goal"],
  about: ["sex", "birth_year"],
  body: ["height_cm", "weight_kg"],
  // Where you want to be, and how fast you want to get there. One question in two parts, and the
  // pair that a maintaining user is asked NEITHER of — so this whole screen disappears for them.
  target: ["target_weight_kg", "pace"],
  activity: ["activity"],
  country: ["country"],
  restrictions: ["restrictions"],
};

/**
 * Screens an admin may switch off, and why only these.
 *
 * A screen is optional exactly when nothing it collects reaches `explainTargets`. `country` tunes
 * what the analyzer expects to see on a plate; every other screen feeds the number. Turning one of
 * those off would not shorten onboarding, it would produce a calorie target computed from a value
 * nobody chose — which is the failure this whole subsystem is written to prevent.
 */
export const OPTIONAL_SCREENS: readonly OnboardingScreenId[] = ["country"];

export function screenIsOptional(id: OnboardingScreenId): boolean {
  return OPTIONAL_SCREENS.includes(id);
}

/** The screen a given step is asked on. Total by construction — every step is on exactly one. */
export function screenForStep(step: OnboardingStep): OnboardingScreenId {
  for (const id of ONBOARDING_SCREENS) {
    if (SCREEN_FIELDS[id].includes(step)) return id;
  }
  // Unreachable while `SCREEN_FIELDS` covers `ONBOARDING_STEPS`; a test asserts it does.
  throw new Error(`no screen collects "${step}"`);
}

/**
 * Whether a screen has anything left to ask this profile.
 *
 * `disabled` names screens the admin switched off. A disabled screen is skipped, and because the
 * flow is field-derived rather than counted, skipping it simply means its field stays null — which
 * every downstream consumer already handles, since a user could always decline to answer.
 */
export function screenApplies(
  id: OnboardingScreenId,
  p: Profile,
  disabled: readonly OnboardingScreenId[] = [],
): boolean {
  if (disabled.includes(id) && screenIsOptional(id)) return false;
  // An id this binary does not know. See `isKnownScreen` — a shipped app outlives the server it
  // was built against, and it must skip a screen from the future rather than crash on it.
  const fields = SCREEN_FIELDS[id] as readonly OnboardingStep[] | undefined;
  if (!fields) return false;
  return fields.some((f) => stepApplies(f, p));
}

/**
 * Whether this BINARY can render a screen the server named.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE OLD-APP / NEW-SERVER CASE, WHICH IS NOT HYPOTHETICAL
 *
 * Onboarding copy is fetched at runtime, and an app on the App Store outlives the server it was
 * built against by months. So a phone WILL eventually be handed a screen id that its code has no
 * fields, no controls and no renderer for — the first time a new question is added.
 *
 * That case reached a simulator during development, from nothing more exotic than a server process
 * that had been running since before the screens were renamed. The app did not degrade: it threw
 * `Cannot read property 'some' of undefined` on every render and onboarding was a blank screen,
 * which for a user on a fresh install is an app that does not start.
 *
 * Unknown screens are therefore DROPPED, here, once. The user gets the flow their binary knows —
 * which is a complete, correct flow, because the fields are compiled in and only the words are not.
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 */
export function isKnownScreen(id: string): id is OnboardingScreenId {
  return (ONBOARDING_SCREENS as readonly string[]).includes(id);
}

/** The screens this profile will actually see, in order. */
export function applicableScreens(
  p: Profile,
  disabled: readonly OnboardingScreenId[] = [],
): OnboardingScreenId[] {
  return ONBOARDING_SCREENS.filter((id) => screenApplies(id, p, disabled));
}

/**
 * The screen to render now, or null when every question has been answered.
 *
 * Derived from `nextStep`, so it inherits the resume property: kill the app on the body screen
 * having answered height only, and this returns `body` again with height pre-filled.
 */
export function nextScreen(
  p: Profile,
  disabled: readonly OnboardingScreenId[] = [],
): OnboardingScreenId | null {
  const step = nextStep(p);
  if (step === null) return null;
  const screen = screenForStep(step);
  if (screenApplies(screen, p, disabled)) return screen;
  // The step's own screen is switched off. Fall forward to the next screen that still has a
  // question — never backwards, which would loop.
  const rest = applicableScreens(p, disabled);
  const from = ONBOARDING_SCREENS.indexOf(screen);
  return rest.find((id) => ONBOARDING_SCREENS.indexOf(id) > from) ?? null;
}

/** Progress in SCREENS — what the bar at the top of onboarding shows. */
export function screenProgress(
  p: Profile,
  disabled: readonly OnboardingScreenId[] = [],
): { index: number; total: number } {
  const screens = applicableScreens(p, disabled);
  const current = nextScreen(p, disabled);
  return {
    index: current === null ? screens.length : Math.max(0, screens.indexOf(current)),
    total: screens.length,
  };
}

// ── Content: the editable words ──────────────────────────────────────────────────────────────

/**
 * The mascot's expressions.
 *
 * A closed list, because each one is a drawn face in the app. An admin picking a mood the binary
 * does not have would render nothing — so the validator refuses it rather than the renderer
 * guessing.
 */
export const MASCOT_MOODS = ["wave", "happy", "think", "cheer", "care", "idle"] as const;
export type MascotMood = (typeof MASCOT_MOODS)[number];

/** What the mascot shows and says on one screen. */
export interface MascotLine {
  mood: MascotMood;
  /** Spoken in the bubble. Short — it is a speech bubble, not a paragraph. */
  line: string;
}

export interface OnboardingOptionContent {
  label: string;
  /** The second line under an option. Optional, and worth having wherever a label is ambiguous. */
  hint?: string;
}

export interface OnboardingScreenContent {
  id: OnboardingScreenId;
  title: string;
  subtitle?: string;
  mascot: MascotLine;
  /**
   * Why this question is asked, in the user's interest.
   *
   * Not decoration. The single most-cited reason people abandon a health onboarding is being asked
   * something personal with no stated purpose; saying what a number is FOR converts materially
   * better than asking for it bare, and it is also the honest thing to do with special-category
   * data.
   */
  why?: string;
  /** Per-option copy, keyed by the closed vocabulary for this screen. */
  options?: Record<string, OnboardingOptionContent>;
  /** The primary button, where the screen has one. */
  cta?: string;
  /** Optional screens only — see `OPTIONAL_SCREENS`. Ignored, and forced true, on required ones. */
  enabled?: boolean;
}

/**
 * The front door. What this is, before the first question.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHY THE FIRST THING THE APP SAYS IS WHAT IT WILL NOT ASK FOR
 *
 * Across seven calorie apps and 2,792 low-star reviews, the billing cluster is the largest
 * complaint for every single one — floor 15%, median 27%, the category leader at 48%
 * (`eait-marketer/.../2026-07-28-category-billing-crossread.md` §1). The same doc's §3 finds the
 * pattern: the harder a paywall sits in front of first value, the more the reviews reach for
 * "scam", "misleading", "tricked".
 *
 * This app has no paywall, no trial, no card and no email field. That is not a feature to defend,
 * it is the absence of the thing the whole category is being complained about — so the front door
 * states it plainly and moves on.
 *
 * TWO RULES ON THE WORDING, both from §5 of that doc and both enforced by a test:
 *   - never name a competitor. All seven have the complaint; naming one invites a fair-comparison
 *     argument we lose.
 *   - never claim "free". The claim is "no card to start", which is true and checkable today.
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 */
export interface OnboardingWelcomeContent {
  title: string;
  subtitle?: string;
  mascot: MascotLine;
  /** Short lines under the title. One to four — past that it is a wall, not a promise. */
  points: string[];
  cta: string;
}

/**
 * The plan being worked out.
 *
 * The incumbent's equivalent is a progress animation over nothing. This one prints the arithmetic
 * from `TargetBasis`, which was computed before the screen mounted — the dwell is there so the
 * lines can be read, and a tap skips it. Labels only: every NUMBER on this screen comes from the
 * profile response, so no admin edit can make it say something that was not computed.
 */
export interface OnboardingBuildingContent {
  title: string;
  mascot: MascotLine;
  /** The label beside each figure. The figures themselves are not editable — they are computed. */
  restLabel: string;
  activityLabel: string;
  paceLabel: string;
  /** Shown only when the safety floor is the reason the number is what it is. */
  floorLabel: string;
  cta: string;
}

/** The payoff screen. Editable too, because it is the most-read screen in the flow. */
export interface OnboardingSummaryContent {
  title: string;
  mascot: MascotLine;
  cta: string;
  /** Shown under the number. The estimates-not-measurements disclaimer. */
  disclaimer: string;
  /**
   * The projection, with `{weeks}` and `{month}` substituted.
   *
   * Weeks and a month name, never a day-precise date: `projection.ts` says why. Absent from the
   * screen entirely when `projectGoal` returns null, which is every case where a number would be
   * an invention rather than a calculation.
   */
  projection: string;
  /** Replaces `projection` past the two-year horizon, where naming a month stops being useful. */
  projectionFar: string;
}

export interface OnboardingContent {
  /**
   * Bumped on every admin save.
   *
   * Carried on every analytics event, so a funnel can be read per version — which is the whole
   * point of making the copy editable. "Completion went up" is only a claim if you know which
   * words were on screen.
   */
  version: number;
  welcome: OnboardingWelcomeContent;
  screens: OnboardingScreenContent[];
  building: OnboardingBuildingContent;
  summary: OnboardingSummaryContent;
}

/**
 * The option vocabulary each screen may label, keyed by screen.
 *
 * Sourced from the domain constants rather than retyped, so adding a pace or a restriction tag
 * makes the validator demand a label for it instead of letting the app render a blank row.
 */
export const COUNTRY_CODES = ["de", "gb", "us", "ru", "other"] as const;
export type CountryCode = (typeof COUNTRY_CODES)[number];

export const SCREEN_OPTIONS: Partial<Record<OnboardingScreenId, readonly string[]>> = {
  goal: ["lose", "maintain", "gain"],
  about: ["female", "male"],
  target: PACES,
  activity: ACTIVITY_LEVELS,
  country: COUNTRY_CODES,
  restrictions: RESTRICTION_TAGS,
};

// ── The defaults ─────────────────────────────────────────────────────────────────────────────

/**
 * The copy the app ships with, and the row the server seeds its table from.
 *
 * COMPILED INTO THE APP ON PURPOSE. The first screen of onboarding must render before any network
 * call returns — a fresh install on a hotel wifi should not stare at a spinner — so the binary
 * carries a complete, correct flow and the server's copy replaces it when it arrives. That also
 * means a backend outage degrades onboarding to "the words are a version old", not to "the app
 * does not work".
 */
export const DEFAULT_ONBOARDING_CONTENT: OnboardingContent = {
  version: 1,
  welcome: {
    title: "Photograph what you eat. Get an honest answer.",
    subtitle: "A few questions first, so the answer is about you rather than an average.",
    mascot: { mood: "wave", line: "Hi, I'm Spud. I'll judge your dinner, never you." },
    points: [
      "No card, and nothing to cancel later.",
      "No email, no name — we never ask who you are.",
      "Your photos are read, judged, and dropped. Never stored.",
    ],
    cta: "Start",
  },
  screens: [
    {
      id: "goal",
      title: "What are you here to do?",
      // He introduced himself on the welcome screen a tap ago. Doing it twice in a row is the
      // tell of a flow whose screens were written without reference to each other.
      mascot: { mood: "happy", line: "A few quick questions and I'll have your number." },
      options: {
        lose: { label: "Lose weight", hint: "Steadily, and never below what's safe" },
        maintain: { label: "Stay where I am", hint: "Hold the line, eat well" },
        gain: { label: "Gain weight", hint: "Put it on deliberately" },
      },
    },
    {
      id: "about",
      title: "A little about you",
      subtitle: "Two things every calorie formula needs.",
      mascot: { mood: "happy", line: "No email, no card, no name. Just enough to do the maths." },
      why: "Every published formula for basal metabolic rate needs sex and age. The minimum we will ever set you differs by 300 kcal between them.",
      options: {
        female: { label: "Female" },
        male: { label: "Male" },
      },
      cta: "Continue",
    },
    {
      id: "body",
      title: "Your numbers",
      subtitle: "Roughly is fine. You can change any of it later.",
      mascot: { mood: "think", line: "Roughly is genuinely fine — I'd rather have close than blank." },
      why: "Height and weight are what your resting burn is computed from. Nothing else here moves the number as much.",
      cta: "Continue",
    },
    {
      id: "target",
      title: "Where you'd like to be",
      subtitle: "And how quickly you want to get there.",
      mascot: { mood: "care", line: "Faster isn't better here. It's just harder to keep." },
      why: "Whichever pace you pick, we cap the change at a fifth of your maintenance and never go below a floor — and we refuse a goal weight under a healthy one for your height.",
      options: {
        easy: { label: "Easy", hint: "About 0.25 kg a week" },
        steady: { label: "Steady", hint: "About 0.5 kg a week" },
        push: { label: "Push", hint: "About 0.75 kg a week" },
      },
      cta: "Continue",
    },
    {
      id: "activity",
      title: "How much do you move?",
      subtitle: "Be honest rather than aspirational — this moves the number a lot.",
      mascot: { mood: "think", line: "Answer for a normal week, not your best one." },
      options: {
        sedentary: { label: "Mostly sitting", hint: "Desk job, little deliberate exercise" },
        light: { label: "Lightly active", hint: "Walking most days, 1-2 sessions a week" },
        moderate: { label: "Moderately active", hint: "Training 3-4 times a week" },
        active: { label: "Very active", hint: "Training 5-6 times a week, or on your feet all day" },
        athlete: { label: "Athlete", hint: "Twice-daily training, or hard physical work" },
      },
    },
    {
      id: "country",
      title: "Where do you eat?",
      mascot: { mood: "happy", line: "So I know your supermarket, not somebody else's." },
      why: "This changes which products the analyzer expects to see. Most calorie apps are trained US-first and miss local brands entirely.",
      options: {
        de: { label: "Germany" },
        gb: { label: "United Kingdom" },
        us: { label: "United States" },
        ru: { label: "Russia" },
        other: { label: "Somewhere else" },
      },
      enabled: true,
    },
    {
      id: "restrictions",
      title: "Anything I should judge your food against?",
      subtitle: "Only what you pick here gets scored. Skip it if none apply.",
      mascot: { mood: "care", line: "Last one. Skip it freely — nothing here is required." },
      why: "Health information is sensitive. It is used only to judge your meals, it is never sold or shared, and deleting your account erases it.",
      options: {
        kidneys: { label: "Kidney / renal" },
        ldl: { label: "High cholesterol" },
        vegan: { label: "Vegan" },
        lowsugar: { label: "Diabetes / low sugar" },
      },
      cta: "Finish",
    },
  ],
  building: {
    title: "Working out your number",
    mascot: { mood: "think", line: "Give me a second — I'm doing the arithmetic, not guessing." },
    restLabel: "Your body at rest",
    activityLabel: "With how you move",
    paceLabel: "For the pace you picked",
    floorLabel: "Held at your safe floor",
    cta: "See the plan",
  },
  summary: {
    title: "Your daily plan",
    mascot: { mood: "cheer", line: "That's you, worked out properly. Here's how I got there." },
    // R0 of the retention plan: onboarding ends with ONE unambiguous instruction, and the thing
    // being asked for is the first photo. "Start logging" points at a diary, which is an empty list
    // and a second decision.
    cta: "Photograph your next meal",
    disclaimer: "These are estimates from photographs, not measurements. Don't make medical decisions with them.",
    projection: "About {weeks} weeks at this pace — around {month}, if the arithmetic holds.",
    projectionFar: "Over two years at this pace. Worth picking a nearer goal weight first.",
  },
};

// ── Validation: the boundary an admin cannot cross ───────────────────────────────────────────

const MAX_TITLE = 80;
const MAX_SUBTITLE = 200;
const MAX_LINE = 160;
const MAX_WHY = 400;
const MAX_LABEL = 60;
const MAX_HINT = 90;
/** The front door is read in about three seconds or it is not read. */
const MAX_WELCOME_POINTS = 4;

export type ContentValidation =
  | { ok: true; content: OnboardingContent }
  | { ok: false; errors: string[] };

const isStr = (v: unknown): v is string => typeof v === "string";

/**
 * Validate admin-supplied content against the shape the app can render.
 *
 * Run on the WRITE, never on the read: a phone that has already fetched broken copy is a phone
 * with a broken onboarding, and no amount of client-side tolerance recovers the screen the user
 * was on. Refusing the save is the only place this can be fixed while someone is watching.
 *
 * Every rule here exists because breaking it produces something specific and bad:
 *   - a missing required screen           → a profile field nobody was asked for, and a target
 *                                           computed from a default
 *   - a missing option label              → a tappable row rendering as blank space
 *   - an option key outside the vocabulary → a value the server's own patch validator will 422
 *   - an over-long title                  → text clipped on a 5.4-inch phone, invisible on the
 *                                           reviewer's device and on ours
 */
export function validateOnboardingContent(input: unknown): ContentValidation {
  const errors: string[] = [];
  const push = (m: string) => { errors.push(m); };

  if (typeof input !== "object" || input === null) {
    return { ok: false, errors: ["content must be an object"] };
  }
  const raw = input as Record<string, unknown>;

  const version = raw.version;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
    push("version must be a positive integer");
  }

  if (!Array.isArray(raw.screens)) {
    return { ok: false, errors: [...errors, "screens must be an array"] };
  }

  const seen = new Set<string>();
  const screens: OnboardingScreenContent[] = [];

  for (const [i, entry] of raw.screens.entries()) {
    const at = `screens[${i}]`;
    if (typeof entry !== "object" || entry === null) { push(`${at} must be an object`); continue; }
    const s = entry as Record<string, unknown>;

    const id = s.id;
    if (!isStr(id) || !(ONBOARDING_SCREENS as readonly string[]).includes(id)) {
      push(`${at}.id "${String(id)}" is not a known screen`);
      continue;
    }
    if (seen.has(id)) { push(`${at}.id "${id}" appears twice`); continue; }
    seen.add(id);
    const screenId = id as OnboardingScreenId;

    if (!isStr(s.title) || s.title.trim() === "") push(`${at}.title is required`);
    else if (s.title.length > MAX_TITLE) push(`${at}.title is over ${MAX_TITLE} characters`);

    if (s.subtitle !== undefined && (!isStr(s.subtitle) || s.subtitle.length > MAX_SUBTITLE)) {
      push(`${at}.subtitle must be a string under ${MAX_SUBTITLE} characters`);
    }
    if (s.why !== undefined && (!isStr(s.why) || s.why.length > MAX_WHY)) {
      push(`${at}.why must be a string under ${MAX_WHY} characters`);
    }
    if (s.cta !== undefined && (!isStr(s.cta) || s.cta.trim() === "" || s.cta.length > MAX_LABEL)) {
      push(`${at}.cta must be a non-empty string under ${MAX_LABEL} characters`);
    }

    const mascot = s.mascot as Record<string, unknown> | undefined;
    if (typeof mascot !== "object" || mascot === null) push(`${at}.mascot is required`);
    else {
      if (!isStr(mascot.mood) || !(MASCOT_MOODS as readonly string[]).includes(mascot.mood)) {
        push(`${at}.mascot.mood must be one of ${MASCOT_MOODS.join(", ")}`);
      }
      if (!isStr(mascot.line) || mascot.line.trim() === "") push(`${at}.mascot.line is required`);
      else if (mascot.line.length > MAX_LINE) push(`${at}.mascot.line is over ${MAX_LINE} characters`);
    }

    const vocabulary = SCREEN_OPTIONS[screenId];
    if (vocabulary) {
      const opts = s.options as Record<string, unknown> | undefined;
      if (typeof opts !== "object" || opts === null) {
        push(`${at}.options is required for "${screenId}"`);
      } else {
        for (const key of Object.keys(opts)) {
          if (!vocabulary.includes(key)) push(`${at}.options has unknown option "${key}"`);
        }
        for (const key of vocabulary) {
          const o = opts[key] as Record<string, unknown> | undefined;
          if (typeof o !== "object" || o === null) { push(`${at}.options is missing "${key}"`); continue; }
          if (!isStr(o.label) || o.label.trim() === "") push(`${at}.options.${key}.label is required`);
          else if (o.label.length > MAX_LABEL) push(`${at}.options.${key}.label is over ${MAX_LABEL} characters`);
          if (o.hint !== undefined && (!isStr(o.hint) || o.hint.length > MAX_HINT)) {
            push(`${at}.options.${key}.hint must be a string under ${MAX_HINT} characters`);
          }
        }
      }
    } else if (s.options !== undefined) {
      push(`${at}.options is not used by "${screenId}"`);
    }

    if (s.enabled !== undefined && typeof s.enabled !== "boolean") {
      push(`${at}.enabled must be a boolean`);
    }
    // A required screen cannot be switched off, whatever the payload says. Rejected rather than
    // coerced: silently ignoring an admin's edit teaches them the toggle works when it does not.
    if (s.enabled === false && !screenIsOptional(screenId)) {
      push(`"${screenId}" cannot be disabled — its answer is used to compute the calorie target`);
    }

    screens.push(entry as OnboardingScreenContent);
  }

  for (const id of ONBOARDING_SCREENS) {
    if (!seen.has(id)) push(`screens is missing "${id}"`);
  }
  // Order is content, not code: an admin may put `country` before `activity` if that reads better.
  // What is fixed is that every screen is present exactly once.

  // ── The interstitials ──────────────────────────────────────────────────────────────────────
  //
  // Same discipline as a screen, for the same reason: an empty title or a mood the binary does not
  // have renders as blank space on the one screen that has no question to fall back on.

  /** A required, non-empty, length-capped string. Returns nothing; it reports. */
  const str = (v: unknown, at: string, max: number) => {
    if (!isStr(v) || v.trim() === "") push(`${at} is required`);
    else if (v.length > max) push(`${at} is over ${max} characters`);
  };
  const mascotAt = (v: unknown, at: string) => {
    if (typeof v !== "object" || v === null) { push(`${at} is required`); return; }
    const m = v as Record<string, unknown>;
    if (!isStr(m.mood) || !(MASCOT_MOODS as readonly string[]).includes(m.mood)) {
      push(`${at}.mood must be one of ${MASCOT_MOODS.join(", ")}`);
    }
    str(m.line, `${at}.line`, MAX_LINE);
  };

  const wel = raw.welcome as Record<string, unknown> | undefined;
  if (typeof wel !== "object" || wel === null) push("welcome is required");
  else {
    str(wel.title, "welcome.title", MAX_TITLE);
    if (wel.subtitle !== undefined && (!isStr(wel.subtitle) || wel.subtitle.length > MAX_SUBTITLE)) {
      push(`welcome.subtitle must be a string under ${MAX_SUBTITLE} characters`);
    }
    str(wel.cta, "welcome.cta", MAX_LABEL);
    mascotAt(wel.mascot, "welcome.mascot");
    // One to four. Zero makes the screen a title and a button; five makes it a wall, and the point
    // of a front door is that it is read in about three seconds.
    if (!Array.isArray(wel.points) || wel.points.length < 1 || wel.points.length > MAX_WELCOME_POINTS) {
      push(`welcome.points must be 1 to ${MAX_WELCOME_POINTS} lines`);
    } else {
      for (const [i, pt] of wel.points.entries()) str(pt, `welcome.points[${i}]`, MAX_HINT);
    }
  }

  const bld = raw.building as Record<string, unknown> | undefined;
  if (typeof bld !== "object" || bld === null) push("building is required");
  else {
    str(bld.title, "building.title", MAX_TITLE);
    str(bld.cta, "building.cta", MAX_LABEL);
    mascotAt(bld.mascot, "building.mascot");
    for (const key of ["restLabel", "activityLabel", "paceLabel", "floorLabel"] as const) {
      str(bld[key], `building.${key}`, MAX_LABEL);
    }
  }

  const sum = raw.summary as Record<string, unknown> | undefined;
  if (typeof sum !== "object" || sum === null) push("summary is required");
  else {
    str(sum.title, "summary.title", MAX_TITLE);
    str(sum.cta, "summary.cta", MAX_LABEL);
    str(sum.disclaimer, "summary.disclaimer", MAX_WHY);
    str(sum.projection, "summary.projection", MAX_SUBTITLE);
    str(sum.projectionFar, "summary.projectionFar", MAX_SUBTITLE);
    mascotAt(sum.mascot, "summary.mascot");
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    content: {
      version: version as number,
      welcome: raw.welcome as OnboardingWelcomeContent,
      screens,
      building: raw.building as OnboardingBuildingContent,
      summary: raw.summary as OnboardingSummaryContent,
    },
  };
}

/** The screens an admin has switched off, read back out of content. */
export function disabledScreens(content: OnboardingContent): OnboardingScreenId[] {
  return content.screens
    .filter((s) => s.enabled === false && isKnownScreen(s.id) && screenIsOptional(s.id))
    .map((s) => s.id);
}

/**
 * Content in the admin's chosen ORDER, filtered to what this profile will see.
 *
 * The app renders from this rather than from `ONBOARDING_SCREENS` directly, which is what makes
 * reordering in the admin actually reorder the flow.
 */
export function orderedScreens(
  content: OnboardingContent,
  p: Profile,
): OnboardingScreenContent[] {
  const off = disabledScreens(content);
  // `isKnownScreen` first, and it is the load-bearing half — see its own note. Everything
  // downstream of this function indexes `SCREEN_FIELDS` by id and would throw on a screen from a
  // newer server.
  return content.screens.filter((s) => isKnownScreen(s.id) && screenApplies(s.id, p, off));
}

/**
 * Content this binary can actually run, or the fallback.
 *
 * The mirror image of `isKnownScreen`, and it closes the other half of the same problem. That one
 * handles a server AHEAD of the app — extra screens, dropped. This one handles a server BEHIND it:
 * copy that predates a question the app now asks would silently produce a flow that never asks it,
 * and therefore a calorie target computed from a field nobody filled in.
 *
 * Dropping a whole revision of the copy is the right trade. The words are cosmetic and the app has
 * a complete set compiled in; the questions are not, and asking all of them is the point.
 *
 * AN INTERSTITIAL IS THE EXCEPTION, and the exception is what the rule's own reasoning asks for.
 * `welcome` and `building` ask nothing, so a revision missing one cannot produce a flow that skips
 * a question — the failure the paragraph above is written against does not exist here. Charging an
 * admin every word they edited because a server predates a cosmetic block would be a penalty with
 * no defect behind it, so those fall back BLOCK BY BLOCK and the rest of the revision survives.
 */
export function usableContent(
  candidate: unknown,
  fallback: OnboardingContent = DEFAULT_ONBOARDING_CONTENT,
): OnboardingContent {
  if (typeof candidate !== "object" || candidate === null) return fallback;
  const c = candidate as Partial<OnboardingContent>;
  if (typeof c.version !== "number" || !Array.isArray(c.screens)) return fallback;
  const present = new Set(c.screens.map((s) => s?.id));
  for (const id of ONBOARDING_SCREENS) {
    if (!present.has(id)) return fallback;
  }
  return {
    version: c.version,
    welcome: c.welcome ?? fallback.welcome,
    screens: c.screens,
    building: c.building ?? fallback.building,
    // The summary carries the projection strings, added at the same time as the interstitials. A
    // revision from before them has a summary that renders but has nothing to say about a
    // projection, so it is filled the same way rather than half-adopted.
    summary: c.summary?.projection ? c.summary : fallback.summary,
  };
}

/**
 * The index of the first screen this profile still has a question on, in the ADMIN's order.
 *
 * This, not `nextScreen`, is what the app renders from. `nextScreen` walks the canonical order in
 * `ONBOARDING_SCREENS`; once an admin can reorder the flow those two disagree, and the shape of the
 * disagreement is nasty — the app would show screen 3 while the "what is next" logic pointed at
 * screen 5, so a question would be asked and then asked again.
 *
 * Still FIELD-DERIVED, which is the property that matters: the answer comes from which fields are
 * null, so killing the app mid-flow resumes where the data says you are rather than where a counter
 * claims. Returns `screens.length` when everything has been answered — the summary.
 */
export function nextScreenIndex(content: OnboardingContent, p: Profile): number {
  const screens = orderedScreens(content, p);
  for (const [i, screen] of screens.entries()) {
    // `restrictions` is answered by COMPLETING, not by having a value: an empty array is a real
    // answer ("none of these") and is indistinguishable from "never asked" by inspection.
    if (screen.id === "restrictions") {
      if (p.onboarded_at === null) return i;
      continue;
    }
    const unanswered = SCREEN_FIELDS[screen.id]
      .filter((f) => stepApplies(f, p))
      .some((f) => p[f] === null);
    if (unanswered) return i;
  }
  return screens.length;
}

// ── Analytics ────────────────────────────────────────────────────────────────────────────────

/**
 * What can happen on an onboarding screen.
 *
 * Deliberately small. A funnel needs to answer three questions — how many saw this screen, how many
 * answered it, and how many left — and every extra verb is a column nobody reads.
 */
export const ONBOARDING_ACTIONS = ["view", "answer", "back", "reject", "complete"] as const;
export type OnboardingAction = (typeof ONBOARDING_ACTIONS)[number];

/**
 * One thing that happened during onboarding.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHAT IS DELIBERATELY NOT IN HERE
 *
 * No weight, no height, no year of birth, and no free text. Those are the answers, and the answers
 * to this particular questionnaire are health data about an identified person. The funnel needs to
 * know a screen WAS answered, not what with — so `value` carries an enumerated choice (`lose`,
 * `moderate`, `de`) and nothing else, and the numeric screens send no value at all.
 *
 * This is not a nicety. Analytics rows outlive the account that produced them in most systems, and
 * the account here can be deleted on demand under 5.1.1(v); a funnel that had recorded someone's
 * body weight would make that promise false.
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 */
export interface OnboardingEvent {
  /** Client-generated. The server upserts on it, so a retried batch is not a doubled funnel. */
  id: string;
  /** Which run of onboarding this was — a reinstall is a new one. */
  sessionId: string;
  place: OnboardingPlace;
  action: OnboardingAction;
  /** Which copy was on screen. The reason `version` exists at all. */
  contentVersion: number;
  /** Milliseconds this screen was on screen before the event. Absent on `view`. */
  ms?: number;
  /** The field this event is about, on `answer` and `reject`. */
  field?: string;
  /** ENUMERATED answers only — see the note above. Never a number, never free text. */
  value?: string;
  /** Client clock, ISO. The server stamps its own arrival time separately. */
  at: string;
}

/** Fields whose answer may be sent as `value`. Everything else is recorded as answered, no more. */
export const REPORTABLE_FIELDS: readonly OnboardingStep[] = [
  "goal", "sex", "activity", "pace", "country", "restrictions",
];

export function isReportableField(field: string): boolean {
  return (REPORTABLE_FIELDS as readonly string[]).includes(field);
}

/** One row of the admin funnel: how a screen performed. */
export interface FunnelRow {
  place: OnboardingPlace;
  views: number;
  answers: number;
  backs: number;
  rejects: number;
  /** Median ms from view to answer. Whole seconds is what the admin renders. */
  medianMs: number | null;
}

export interface OnboardingFunnel {
  /** Distinct onboarding runs seen in the window. The denominator for everything else. */
  sessions: number;
  /** Runs that reached `complete`. */
  completed: number;
  days: number;
  contentVersion: number;
  rows: FunnelRow[];
}
