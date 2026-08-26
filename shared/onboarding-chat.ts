// Onboarding as a conversation: the order, the branches, and every sentence Spud says back.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// WHY THIS IS SHARED AND PURE, AND WHY IT IS NOT ADMIN-EDITABLE
//
// SHARED, because it is where the branch logic lives, and branch logic is exactly the part that
// `bun test` has to be able to reach without a simulator. The reply to "when is it hardest?" reads
// the goal chosen ten steps earlier and the support cards already shown; that is a rule, and a rule
// nobody can run is a rule that drifts.
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
//   2. A stat is delivered once. If a support card already carried it, later replies reference it
//      ("we've covered the 8pm crowd") and never repeat it.
//   3. Never lean on structure the user cannot see. No step numbers, and nothing about an answer
//      that has not been given yet.
// ─────────────────────────────────────────────────────────────────────────────────────────────
//
// WHAT IS STORED AND WHAT IS NOT. `goal`, `sex`, `birth_year`, `height_cm`, `weight_kg`,
// `target_weight_kg`, `pace`, `activity`, `country` and `restrictions` are profile columns, and
// they are the whole input to `explainTargets`. The four conversation questions — why now, what has
// been hard, the hardest moment, eating out — are NOT stored on the profile: nothing reads them
// yet, they are answered into the thread (which is the record, and is erased with the account), and
// `REPORTABLE_FIELDS` has no room for them, which is the point. "Binge episodes" is a disclosure,
// not a preference.

import {
  MAX_DEFICIT_SHARE, MAX_SURPLUS_SHARE, MIN_AGE, MIN_TARGET_BMI, MIN_WEIGHT_KG,
  type RestrictionTag,
} from "./targets.ts";
import type { Goal, Profile } from "./types.ts";
import {
  isKnownScreen, screenForStep, stepApplies,
  type OnboardingContent, type OnboardingPlace, type OnboardingScreenId, type OnboardingStep,
} from "./onboarding.ts";

// ── The prompts ──────────────────────────────────────────────────────────────────────────────

/**
 * Everything Spud asks or shows, in the order of `copy.md` steps 1–15.
 *
 * A prompt with a `field` fills a profile column and its answer survives the app being killed. A
 * prompt without one is conversation: asked while the run is live, skipped on a resume that has
 * already passed it (see `resumeAt`).
 */
export type ChatPromptId =
  | "welcome" | "goal" | "why" | "sex" | "birth_year" | "height_cm" | "weight_kg"
  | "target_weight_kg" | "pace" | "activity" | "struggles" | "moment" | "eatout"
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

/** The struggle chips of copy.md § Step 8. A closed vocabulary, because § Step 9 keys cards off it. */
export const STRUGGLES = [
  "stress", "night", "binge", "diets", "eatout", "energy", "body", "metabolism",
] as const;
export type Struggle = (typeof STRUGGLES)[number];

export const STRUGGLE_LABELS: Record<Struggle, string> = {
  stress: "Stress eating",
  night: "Night snacking",
  binge: "Binge episodes",
  diets: "Diets that didn't stick",
  eatout: "Eating out a lot",
  energy: "Low energy",
  body: "Body image",
  metabolism: "Metabolism worry",
};

/** copy.md § Step 10. Typed answers are keyword-matched onto the same four. */
export const MOMENTS = ["evening", "stress", "skipped", "other"] as const;
export type Moment = (typeof MOMENTS)[number];

export const MOMENT_LABELS: Record<Moment, string> = {
  evening: "Evenings and late nights",
  stress: "Stressful days",
  skipped: "When I've skipped meals",
  other: "Somewhere else",
};

/** copy.md § Step 11. */
export const EATOUTS = ["rarely", "sometimes", "most"] as const;
export type EatOut = (typeof EATOUTS)[number];

export const EATOUT_LABELS: Record<EatOut, string> = {
  rarely: "Rarely",
  sometimes: "A few times a week",
  most: "Most days",
};

export const CHAT_PROMPTS: readonly ChatPrompt[] = [
  { id: "welcome", place: "welcome", kind: "start" },
  { id: "goal", place: "goal", field: "goal", kind: "choice", options: ["lose", "maintain", "gain"] },
  { id: "why", place: "why", kind: "text" },
  { id: "sex", place: "about", field: "sex", kind: "choice", options: ["female", "male"] },
  { id: "birth_year", place: "about", field: "birth_year", kind: "number" },
  { id: "height_cm", place: "body", field: "height_cm", kind: "number" },
  { id: "weight_kg", place: "body", field: "weight_kg", kind: "number" },
  { id: "target_weight_kg", place: "target", field: "target_weight_kg", kind: "number" },
  { id: "pace", place: "target", field: "pace", kind: "choice", options: ["easy", "steady", "push"] },
  { id: "activity", place: "activity", field: "activity", kind: "choice", options: ["sedentary", "light", "moderate", "active", "athlete"] },
  { id: "struggles", place: "struggles", kind: "chips", options: STRUGGLES },
  { id: "moment", place: "moment", kind: "text", options: MOMENTS },
  { id: "eatout", place: "eatout", kind: "choice", options: EATOUTS },
  { id: "country", place: "country", field: "country", kind: "choice", options: ["de", "gb", "us", "ru", "other"] },
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
 * The four conversation questions are SKIPPED when they sit before the resume point. They are not
 * on the profile, so re-asking them would be the only way to have them, and re-asking "what made
 * you decide to start now?" after the app was killed is worse than never asking: the answer was
 * given, the user remembers giving it, and nothing downstream needs it.
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
 * What Spud says to pose one prompt, as bubbles.
 *
 * The profile questions read the ADMIN'S words; the four conversation questions read the constants
 * below. `{loseTail}` is the one substitution in the shipped copy, and it exists because "faster
 * isn't better here" is a warning about losing weight: said to somebody gaining, it is rule 1's
 * reply written for nobody.
 */
export function askLines(prompt: ChatPrompt, content: OnboardingContent, p: Profile): string[] {
  if (prompt.field) {
    const ask = askContent(content, prompt.field);
    // Never empty: `usableContent` drops a whole revision that is missing an ask, so reaching this
    // fallback means the compiled-in default is what is on screen and something is very wrong.
    const lines = ask?.lines ?? [];
    return lines.map((line) => line.replace(
      "{loseTail}",
      p.goal === "lose" ? " Faster isn't better here — it's just harder to keep." : "",
    ));
  }
  return [...CONVERSATION_ASKS[prompt.id as keyof typeof CONVERSATION_ASKS]];
}

/** The composer's placeholder while a prompt is open, or null when there is nothing to type. */
export function askPlaceholder(prompt: ChatPrompt, content: OnboardingContent): string | null {
  if (prompt.field) return askContent(content, prompt.field)?.placeholder ?? null;
  return CONVERSATION_PLACEHOLDERS[prompt.id as keyof typeof CONVERSATION_PLACEHOLDERS] ?? null;
}

/** The idle placeholder, everywhere a prompt does not name its own. copy.md § Step 01. */
export const IDLE_PLACEHOLDER = "Message Spud…";

const CONVERSATION_ASKS = {
  why: ["What made you decide to start now? A sentence is plenty — it's the one answer I'll remind you of when a week goes sideways."],
  struggles: ["Now the part most apps skip. What's been hard? Pick any — or none. This shapes support, never judgement."],
  moment: ["When is it hardest? Pick the moment — I'll build the day around it."],
  eatout: ["How often do you eat food you didn't cook — restaurants, delivery, the office canteen?"],
} as const;

const CONVERSATION_PLACEHOLDERS = {
  why: "In your own words…",
  moment: "Or type it — the hour, the place…",
} as const;

/** The quick replies beside the composer, per prompt. copy.md, verbatim. */
export const QUICK_REPLIES = {
  why: ["I'd rather not say"],
  struggles: ["Done", "None of these"],
  restrictions: ["Finish", "Nothing applies"],
} as const;

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

/** copy.md § Step 02 — the card after the goal, one per branch. */
export const GOAL_CARDS: Record<Goal, SupportCard> = {
  lose: {
    title: "You're in good company",
    body: "About 42% of adults try to lose weight in any given year. The difference here: your target gets computed properly, with a floor we won't cross.",
    source: "Systematic review of 72 studies · n = 1.18M adults",
  },
  gain: {
    title: "Less rare than it feels",
    body: "Roughly 23% of young men and 6% of young women actively tried to gain weight this past year. It's a real goal with real technique — we'll set a surplus that builds more than it pads.",
    source: "Canadian young-adult study · n = 976",
  },
  maintain: {
    title: "The quiet goal",
    body: "About 23% of adults are actively working to hold their weight — the goal nobody posts about, and it still deserves a plan. Your days get judged against staying put.",
    source: "Meta-analysis of past-year weight-control attempts",
  },
};

/** The line after the goal card. Reads the branch taken — rule 1. */
export const GOAL_FOLLOWUPS: Partial<Record<Goal, string>> = {
  gain: "Same rules as for everyone here — honest numbers, no cheering, no shame — just pointed up instead of down.",
  maintain: "And the easy path is yours: no target weight to pick — we plan around staying put.",
};

/**
 * copy.md § Step 09 — one card per struggle picked, at most two.
 *
 * `diets` is the one that branches, and it branches on a citation rather than on tone: the regain
 * meta-analysis is about weight LOSS, so quoting it to somebody gaining would be bending it. The
 * gain variant states the weaker thing that is true, and carries no source, because there is not
 * one for it.
 */
export function struggleCard(struggle: Struggle, goal: Goal): SupportCard {
  if (struggle === "diets" && goal === "gain") {
    return {
      title: "Regain is the norm, not your fault",
      body: "Most attempts to change weight, in either direction, revert within a couple of years — methods failing, not people. Your surplus here is sized to be keepable, not impressive.",
    };
  }
  return STRUGGLE_CARDS[struggle];
}

const STRUGGLE_CARDS: Record<Struggle, SupportCard> = {
  stress: {
    title: "A pattern, not a character flaw",
    body: "Around 38% of adults eat in response to feelings at least monthly — for about half of them, weekly. Naming the pattern is most of the work; the log does the rest.",
    source: "US national study, n = 5,863 · review, 2026",
  },
  night: {
    title: "The 8pm hour is crowded",
    body: "Over 60% of adults eat something after 8pm, and about 1 in 4 snackers now mostly eat late at night. We don't score when you eat — only what the day adds up to.",
    source: "CivicScience, 1.2M responses",
  },
  binge: {
    title: "You're not alone in this",
    body: "Binge eating disorder is the most common eating disorder — about 2.8% of adults meet the criteria at some point, and 17% of people starting a weight programme screen positive. If episodes feel out of control, a clinician helps more than any app. Here, a hard day is data, never a verdict.",
    source: "NIMH (NCS-R) · study of 6,930 programme starters",
  },
  diets: {
    // "plan", not "target" — a maintainer picking this card has no target weight.
    title: "Regain is the norm, not your fault",
    body: "Across 29 long-term studies, more than half of lost weight comes back within two years — over 80% by five. That's methods failing, not people. Your plan here is sized to be keepable, not impressive.",
    source: "Meta-analysis of 29 US weight-loss studies",
  },
  eatout: {
    title: "Restaurant plates drift most",
    body: "Estimates drift most on food you didn't cook — which is exactly what photos are best at. I'll say so when I'm unsure instead of pretending.",
  },
  energy: {
    title: "Energy is the honest metric",
    body: "Under-fuelled days and low energy travel together — it's one reason we refuse targets below the safety floor. Food is half of energy; we'll watch the shape of your days.",
  },
  body: {
    title: "The scale is not the judge here",
    body: "You'll get numbers about food, never comments about your body. Your goal sets the targets; nothing here is compared to anyone else.",
  },
  metabolism: {
    title: "Let's measure instead of worry",
    body: "Metabolisms differ less than the internet says — but yours is yours, and two weeks of honest logging shows what it actually does. That beats any formula, including mine.",
  },
};

/**
 * copy.md § Step 06 — the gain support card.
 *
 * The percentage is READ FROM `MAX_SURPLUS_SHARE`, not typed. A safety guarantee described in copy
 * that the arithmetic does not implement is the worst sentence this repo could ship, and the way
 * that happens is somebody changing the constant and not the prose.
 */
export const GAIN_PACE_CARD: SupportCard = {
  title: "Gaining well is slow on purpose",
  body: `Your surplus gets capped at about ${Math.round(MAX_SURPLUS_SHARE * 100)}% over what your body burns in a day — the zone where muscle keeps up with the scale. Most successful gainers lead with protein; we'll track yours automatically.`,
  source: "Survey of 168 athletic adults attempting weight gain",
};

/** copy.md § Step 04 — the under-16 stop. The refusal is the server's; this is how it reads. */
export const UNDER_AGE_CARD: SupportCard = {
  title: `ieat is for ${MIN_AGE} and over`,
  body: "The way this app sets calorie targets is not designed for a body that is still growing.",
};

export const UNDER_AGE_LINES = {
  /** Offered once, in case a typo got us here. */
  ask: "Sorry — I have to stop here. If a typo got us here, just send the right year.",
  confirm: "That's my real year",
  placeholder: "Year of birth",
  /**
   * The stop, taken.
   *
   * "Nothing you told me is kept" is a promise, so taking this branch DELETES the account rather
   * than merely refusing the next write — the goal and the sex answered a minute ago are already
   * rows. See `onboarding.tsx`.
   */
  stopped: [
    "Then this is where we stop. Nothing you told me is kept, and nothing was sent anywhere — there is no account to delete.",
    `Come back at ${MIN_AGE} and I'll be around.`,
  ],
  endedPlaceholder: `ieat is for ${MIN_AGE} and over`,
} as const;

/** copy.md § Step 06 — the target below a healthy BMI. The server refuses it; this explains it. */
export function belowHealthyCard(minHealthyKg: number): SupportCard {
  return {
    title: "I can't set that as a target",
    body: `The lowest healthy weight for your height is about ${minHealthyKg} kg. We won't set a goal below it. If you're working with a doctor on something different, follow them rather than this app.`,
  };
}

// ── What Spud says back ──────────────────────────────────────────────────────────────────────

/** The state a run accumulates that is NOT on the profile. See the header. */
export interface RunState {
  /** Everything picked at step 8, in the order picked. */
  struggles: Struggle[];
  /** The first two, which are the ones that got a card. Step 10 and 11 dedupe against this. */
  cardsShown: Struggle[];
}

export const EMPTY_RUN: RunState = { struggles: [], cardsShown: [] };

/** How many support cards a multi-select gets. Two is the design's number: three is a lecture. */
export const MAX_STRUGGLE_CARDS = 2;

/**
 * copy.md § Step 03 — the reply to "what made you start now".
 *
 * Keyword-matched into five buckets, and the medical one reads the goal: "people who start for a
 * medical reason tend to lose more" is a finding about weight LOSS, and saying it to somebody
 * gaining is rule 1 again.
 */
export type WhyBucket = "private" | "medical" | "event" | "energy" | "other";

export function whyBucket(text: string, declined: boolean): WhyBucket {
  if (declined) return "private";
  const t = text.toLowerCase();
  if (/(doctor|blood|pressure|health|medic|cholesterol|diabet)/.test(t)) return "medical";
  if (/(wedding|holiday|summer|event|birthday|beach|vacation)/.test(t)) return "event";
  if (/(tired|energy|sleep)/.test(t)) return "energy";
  return "other";
}

export function whyReply(bucket: WhyBucket, goal: Goal | null): string {
  switch (bucket) {
    case "private":
      return "Fair. It stays your business — the plan works either way.";
    case "medical":
      return goal === "lose"
        ? "A strong reason, and a common one. People who start for a medical reason tend to lose more and keep more of it off — we'll keep it steady, not dramatic."
        : "A strong reason, and a common one. Changes started on a doctor's word tend to stick — we'll keep it steady, not dramatic.";
    case "event":
      return "A date on the calendar is honest fuel. I'll show you what's realistic by then — and what's worth keeping after it.";
    case "energy":
      return "Energy is the honest metric — food is half of it. We'll watch the shape of your days, not just the total.";
    case "other":
      return "Good reason. I'll hold onto that — and I won't turn it into a slogan.";
  }
}

/** copy.md § Step 05 — the acknowledgement, and the first real number ten steps early. */
export function weightAck(bmr: number | null): string[] {
  const lines = ["Noted — honest numbers make an honest plan."];
  // Only when there is one. `basalMetabolicRate` returns null for anthropometrics it will not
  // compute from, and a quick win that says "about null kcal" is worse than no quick win.
  if (bmr !== null) {
    lines.push(`And here's your first number: at rest, your body burns about ${n(bmr)} kcal a day. The next questions sharpen it.`);
  }
  return lines;
}

/** copy.md § Step 07 — one reply per activity level. `athlete` is this binary's fifth. */
export const ACTIVITY_REPLIES: Record<string, string> = {
  sedentary: "Thanks for the honest answer — most people overshoot this one, and then the target overshoots them.",
  light: "Good — walks count for more than people think.",
  moderate: "Solid. The number will assume those workouts happen — keep me honest.",
  active: "Good — that buys you more food. I'd rather fuel it properly than guess low.",
  athlete: "Then the number has real work to fuel. I'd rather feed it properly than guess low.",
};

/** copy.md § Step 08 — the line after the cards, or the line when nothing was picked. */
export function strugglesCloser(picked: number): string {
  if (picked === 0) return "Even better. If something turns up later, tell me in the chat — the plan can bend.";
  return picked > 1
    ? "We know how to work with each of these. One more question about them, then back to the easy stuff."
    : "One more question about that, then back to the easy stuff.";
}

/**
 * copy.md § Step 10 — the hardest moment.
 *
 * Rule 2 lives here in its clearest form: the evening reply carries the 8pm statistic, and the
 * night-snacking CARD carries the same statistic. Delivered twice it reads as a script that is not
 * listening, so when the card has already been shown the reply references it and goes straight to
 * what happens about it.
 */
export function momentFromText(text: string): Moment {
  const t = text.toLowerCase();
  if (/(evening|night|late|bed|tv|couch)/.test(t)) return "evening";
  if (/(stress|work|deadline|delivery|order)/.test(t)) return "stress";
  if (/(skip|miss|forget|one meal)/.test(t)) return "skipped";
  return "other";
}

export function momentReply(
  moment: Moment,
  goal: Goal | null,
  run: RunState,
  /** True when the user typed something the four buckets did not match. */
  unmatched = false,
): string {
  switch (moment) {
    case "evening":
      if (goal === "gain") {
        return "Good news: for you the evening is an asset — it's where the surplus gets finished. We'll put the hour to work.";
      }
      return run.cardsShown.includes("night")
        ? "We've covered the 8pm crowd — so, concretely: I'll keep an evening budget in view, and the hour loses its teeth."
        : "The classic hour — over 60% of adults eat something after 8pm. You're not the exception; you're the rule. We don't score when you eat, only what the day adds up to. I'll keep an evening budget in view so the hour loses its teeth.";
    case "stress":
      // No dedupe needed: the stress card carries no overlapping statistic.
      return "A hard day's meal isn't a failure — it's a meal. Photograph it like any other. The days people skip logging are the days the log would help most, so I'll make the honest answer the easy one: one photo, no forms.";
    case "skipped":
      return goal === "gain"
        ? "That's where gaining stalls — a skipped meal is surplus that never happened. Spreading meals through the day is the whole game for you."
        : "That's the day borrowing from the evening. People eating one meal a day are markedly more likely to snack late — spreading the same calories earlier usually beats willpower at 11pm.";
    case "other":
      return unmatched
        ? "That's a real moment, and now it's on the map. We'll build the day around it rather than pretending it won't happen."
        : "Fair — the map fills in as you log. If a pattern shows up, I'll name it and we'll build around it.";
  }
}

/**
 * copy.md § Step 11 — eating out.
 *
 * Rule 2 again, and this one is the closest call in the whole flow: the "Eating out a lot" card
 * says almost exactly what the Most-days reply says, so firing both is the same sentence twice with
 * a question in between.
 */
export function eatoutReply(choice: EatOut, run: RunState): string {
  const carded = run.cardsShown.includes("eatout");
  switch (choice) {
    case "most":
      return carded
        ? "As promised — photos handle exactly that. Snap the plate, I do the rest."
        : "Then photos are your friend — restaurant plates are where estimates drift most, and a photo beats a menu's guess. When I'm unsure, I'll say so instead of pretending.";
    case "rarely":
      return carded
        ? "Rarer than 'eating out a lot' suggested — take it. Photos cover the exceptions when they happen."
        : "Home cooking makes my job easier — portions in your own bowls are the most accurate thing I read.";
    case "sometimes":
      return "A good mix. Photos handle both ends — your bowls and their plates.";
  }
}

/**
 * copy.md § Step 13 — what gets scored, and only what was declared.
 *
 * The cholesterol line CHAINS onto the kidney one ("too", "same rule"), so it must never fire
 * without it — which is why this returns the whole reply rather than one line per tag.
 */
export function restrictionsReply(tags: readonly RestrictionTag[], freeText: boolean): string[] {
  const lines: string[] = [];
  if (tags.includes("kidneys")) {
    lines.push("Noted. Sodium gets scored from here on — and only because you asked.");
  }
  if (tags.includes("ldl")) {
    lines.push(lines.length > 0
      ? "Saturated fat gets scored too — same rule: only what you declare."
      : "Noted. Saturated fat gets scored from here on — and only because you asked.");
  }
  if (lines.length === 0 && tags.length > 0) {
    lines.push("Noted — those go on your profile, and only they get scored.");
  }
  if (lines.length === 0) {
    lines.push("Then nothing extra gets scored — undeclared things never are. You can add one any time in settings.");
  }
  if (freeText) lines.push("And the free text goes on your profile too.");
  return lines;
}

// ── Numbers, refusals, and the direction check ───────────────────────────────────────────────

export type NumberField = "birth_year" | "height_cm" | "weight_kg" | "target_weight_kg";

export type NumberAnswer =
  | { ok: true; value: number }
  /** The value is not one this app takes, and `line` is what Spud says instead of taking it. */
  | { ok: false; line: string }
  /** The year says under sixteen. Not a validation failure — a stop. See `UNDER_AGE_CARD`. */
  | { ok: false; underAge: true };

/**
 * A typed number, checked before it costs a round trip.
 *
 * THE BANDS ARE A SUBSET OF THE SERVER'S, deliberately. `profile.ts` refuses a height outside
 * 100–250 and a weight outside `MIN_WEIGHT_KG`–400 with `out-of-range`, which reaches the app as a
 * refusal with no sentence written for it. Checking a tighter band here means every value this
 * screen accepts is one the server accepts too, so the only refusals a user can meet are the two
 * that have words: the age minimum and the healthy-BMI floor.
 */
export function checkNumber(field: NumberField, raw: string, today = new Date()): NumberAnswer {
  const match = raw.match(/-?\d+(?:[.,]\d+)?/);
  const value = match ? Number(match[0].replace(",", ".")) : NaN;

  if (field === "birth_year") {
    const year = Math.trunc(value);
    const age = today.getUTCFullYear() - year;
    if (!Number.isFinite(value) || year < 1900 || age > 100 || age < 0) {
      return { ok: false, line: "That doesn't look like a year — try something like 1990." };
    }
    if (age < MIN_AGE) return { ok: false, underAge: true };
    return { ok: true, value: year };
  }

  if (!Number.isFinite(value)) return { ok: false, line: INVALID[field] };
  const [lo, hi] = BANDS[field];
  if (value < lo || value > hi) return { ok: false, line: INVALID[field] };
  return { ok: true, value: Math.round(value * 10) / 10 };
}

const BANDS: Record<Exclude<NumberField, "birth_year">, readonly [number, number]> = {
  height_cm: [120, 230],
  // The design says 25 kg; the server refuses anything under `MIN_WEIGHT_KG`, so the lower bound is
  // the server's. A band the client is looser than is a band whose refusals have no words.
  weight_kg: [MIN_WEIGHT_KG, 300],
  target_weight_kg: [MIN_WEIGHT_KG, 300],
};

const INVALID: Record<Exclude<NumberField, "birth_year">, string> = {
  height_cm: "In centimetres — something like 175.",
  weight_kg: "In kilograms — roughly is fine.",
  target_weight_kg: "A number in kg — like 70.",
};

/**
 * copy.md § Step 06 — the wrong-direction check.
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

export function checkDirection(goal: Goal, weightKg: number, targetKg: number): DirectionRefusal | null {
  if (goal === "gain" && targetKg <= weightKg) {
    return {
      line: `You're at ${n(weightKg)} kg and asked to gain to ${n(targetKg)} — that's not a gain from here. If the goal changed, we can switch it; otherwise give me a number above ${n(weightKg)}.`,
      switchTo: "lose",
      switchLabel: "Switch to losing",
      placeholder: `A number above ${n(weightKg)}…`,
    };
  }
  if (goal === "lose" && targetKg >= weightKg) {
    return {
      line: `You're at ${n(weightKg)} kg and asked to lose to ${n(targetKg)} — that's not a loss from here. If the goal changed, we can switch it; otherwise give me a number below ${n(weightKg)}.`,
      switchTo: "gain",
      switchLabel: "Switch to gaining",
      placeholder: `A number below ${n(weightKg)}…`,
    };
  }
  return null;
}

/** What Spud says after the goal is flipped mid-question, and the target is asked again. */
export function switchedLine(goal: Goal): string {
  return goal === "gain"
    ? "Switched — gaining it is. Where would you like to be, in kg?"
    : "Switched — losing it is. Where would you like to be, in kg? Faster isn't better here — it's just harder to keep.";
}

/** The lowest weight this app will set as a target for a height, in whole kg. Mirrors `checkTargetWeight`. */
export function minHealthyKg(heightCm: number): number {
  const m = heightCm / 100;
  return Math.ceil(MIN_TARGET_BMI * m * m);
}

// ── The plan ─────────────────────────────────────────────────────────────────────────────────

/**
 * copy.md § Step 15 — the share-cap note, with the percentage read from the constant.
 *
 * "maintenance" is a word the chat never introduced, so the sentence says "what your body burns in
 * a day" — which is the label on the row directly above it in the calc card.
 */
export function capNote(template: string, goal: Goal | null): string {
  const share = goal === "gain" ? MAX_SURPLUS_SHARE : MAX_DEFICIT_SHARE;
  return template.replace("{share}", String(Math.round(share * 100)));
}

/** The projection sentence, or null when a date would be an invention. `projection.ts` says when. */
export function projectionLine(
  template: string,
  far: string,
  p: { beyondHorizon: boolean; weeks: number },
  month: string,
  targetKg: number | null,
): string {
  if (p.beyondHorizon) return far;
  return template
    .replace("{weeks}", String(p.weeks))
    .replace("{month}", month)
    .replace("{target}", targetKg === null ? "" : n(targetKg));
}

/** Whole numbers with thousands separators, the way every figure in the thread is written. */
function n(x: number): string {
  return Math.round(x * 10) % 10 === 0
    ? Math.round(x).toLocaleString("en-US")
    : (Math.round(x * 10) / 10).toLocaleString("en-US");
}

/**
 * The answer already on the profile, written the way the user gave it.
 *
 * This is what a RESUMED run draws in the user's own bubble, so the replayed transcript reads as
 * the conversation that happened rather than as a database dump: "Lose weight", not `lose`, and
 * "93" rather than `93` with a unit nobody typed. An enumerated value with no label in this
 * binary's content falls back to the raw value — a stale cache is not validated copy.
 */
export function answerLabel(prompt: ChatPrompt, p: Profile, content: OnboardingContent): string | null {
  if (!prompt.field || !isAnswered(prompt, p)) return null;
  const raw = p[prompt.field];
  if (prompt.field === "restrictions") {
    const tags = (raw as string[]).filter((t) => t !== "");
    if (tags.length === 0) return "Nothing applies";
    const opts = content.screens.find((s) => s.id === "restrictions")?.options ?? {};
    return tags.map((t) => opts[t]?.label ?? t).join(" · ");
  }
  if (raw === null) return null;
  if (prompt.options) {
    const id = screenForStep(prompt.field);
    const opts = content.screens.find((s) => isKnownScreen(s.id) && s.id === id)?.options ?? {};
    return opts[String(raw)]?.label ?? String(raw);
  }
  return String(raw);
}
