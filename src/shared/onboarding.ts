// Onboarding: the sequence, the questions, the editable copy, and the analytics vocabulary.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// THREE LAYERS, AND THE LINE BETWEEN THEM IS THE POINT
//
//   1. STEPS   — the profile fields onboarding must fill. Fixed in code. `targets.ts` computes a
//                calorie target from these, so the set is not editable by anyone at runtime.
//   2. SCREENS — how those fields are grouped, and the unit the copy is keyed by. Fixed in code; a
//                screen may be turned OFF only if nothing it collects reaches the arithmetic.
//   3. CONTENT — the words. What Spud SAYS to pose each question, the option labels, the front
//                door, and the plan. Fully editable from the backend admin, validated on the write.
//
// An admin can rewrite every sentence in onboarding and cannot break the target math, cannot drop
// the sex question that every published BMR equation needs, and cannot invent a pace option the
// server would reject. `validateOnboardingContent` is where that boundary is enforced, and it is
// enforced on the WRITE, so bad copy never reaches a phone.
//
// WHAT IS *NOT* HERE, AND WHY. The conversation AROUND the questions — Spud's reply to each answer,
// the support cards and their sourced statistics, the branch logic that makes a reply speak to the
// branch taken — lives in `onboarding-chat.ts`, compiled in, under test, and NOT admin-editable.
// Those cards carry citations ("about 42% of adults", "n = 1.18M"), and an admin who edits a
// statistic ships an unsubstantiated health claim to every phone with no gate in front of it. The
// same reasoning that puts `claims.ts` in front of the landing page's copy keeps those sentences in
// code. `product/design/onboarding/copy.md` is the source of truth for both halves.
// ─────────────────────────────────────────────────────────────────────────────────────────────
//
// FIELD-DERIVED, NOT A STEP COUNTER. The current question is whichever field is still null. A
// counter loses its place when the app is killed mid-flow or reinstalled, and the failure is not
// symmetric: being asked your height twice is annoying, but being skipped past a question the
// target math needs produces a number computed from a default nobody chose.
//
// The server owns the truth (it validates and stores), and the app derives the same value locally
// so it can render the next question without a round trip. One implementation, so they cannot
// disagree about what "next" means.

import type { Profile } from "./types.ts";
import { ACTIVITY_LEVELS, PACES } from "./types.ts";
import { RESTRICTION_TAGS } from "./targets.ts";
import { lintCopy } from "./claims.ts";

// ── Steps: the fields ────────────────────────────────────────────────────────────────────────

/**
 * The questions, in order. Each names the profile field that answers it.
 *
 * THE ORDER IS THE DESIGN'S (`product/design/onboarding/copy.md`, steps 2–13): goal, then who you
 * are, then your numbers, then where you want to be and how fast, then how you move. Two things
 * downstream depend on it and would be wrong if it changed:
 *
 *   - the BMR quick win is spoken the moment weight lands (step 5), which needs sex, age and
 *     height already answered;
 *   - the wrong-direction check on the goal weight ("you're at 93 and asked to lose to 95") reads
 *     the current weight, so weight comes first.
 *
 * Activity used to come before the target because the old target SCREEN previewed a landing date
 * per pace and that preview needed the multiplier. The chat does not preview — the date arrives
 * once, on the plan — so the design's order stands unopposed.
 */
export const ONBOARDING_STEPS = [
  "goal", "sex", "birth_year", "height_cm", "weight_kg", "target_weight_kg", "pace", "activity",
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

// ── Screens: how the fields are grouped ──────────────────────────────────────────────────────

/**
 * The groups the copy is keyed by, in the order the design asks them.
 *
 * THEY ARE NO LONGER SCREENS, and the name is kept anyway. The flow is one chat now: Spud asks one
 * question at a time and the answer arrives in the same conversation. But the grouping is still the
 * unit the admin edits, the unit the funnel counts, and the unit `SCREEN_FIELDS` binds the fields
 * to — renaming it would churn the admin, the stored content row and every funnel row already
 * recorded, for a word.
 *
 * `country` is the only one that may be switched off, and it is the only one whose field does not
 * enter the calorie arithmetic.
 */
export const ONBOARDING_SCREENS = [
  "goal", "about", "body", "target", "activity", "country", "restrictions",
] as const;
export type OnboardingScreenId = (typeof ONBOARDING_SCREENS)[number];

/**
 * The places that are not PROFILE questions.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * INTERSTITIALS ARE NOT SCREENS, AND THAT IS THE WHOLE REASON THEY ARE SAFE
 *
 * None of these collects a profile field. So they are absent from `ONBOARDING_STEPS`, absent from
 * `ONBOARDING_SCREENS`, and absent from `SCREEN_FIELDS` — which means the three-layer boundary
 * above, and every rule `validateOnboardingContent` enforces about it, is exactly the shape it was
 * before they existed. Adding a place a user can BE does not add a place a calorie target can come
 * from.
 *
 * `struggles` is a question to the USER — the empathy layer of `copy.md` step 7 — and it is here
 * rather than in `ONBOARDING_STEPS` because nothing it collects is stored on the profile or reaches
 * `explainTargets`. Its answer lives in the conversation, which IS the record: the thread is stored
 * server-side and erased with the account. See `onboarding-chat.ts`.
 *
 * There were four. `why`, `moment` and `eatout` were cut on 2026-08-26 by copy.md's second rule — a
 * question earns its place by having a reader, and each of those three wrote something nothing in
 * `src/` read back. `struggles` is the one that survives it: it picks the support cards a sentence
 * later, which the user sees.
 *
 * They are all places analytics counts, because the funnel's job is to price them. A beat that
 * costs more people than it convinces has to be visible as a drop between two rows.
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 */
export const ONBOARDING_INTERSTITIALS = [
  "welcome", "struggles", "building", "summary",
] as const;
export type OnboardingInterstitial = (typeof ONBOARDING_INTERSTITIALS)[number];

/**
 * Everywhere a user can be during onboarding, in the order they meet them.
 *
 * The analytics vocabulary, and the row order of the admin's funnel table — so a drop between two
 * rows reads as a drop. Fixed in code now that the flow is a conversation: the questions are asked
 * in an order the replies depend on, so an admin cannot reorder them.
 */
export const ONBOARDING_PLACES = [
  "welcome", "goal", "about", "body", "target", "activity",
  "struggles", "country", "restrictions", "building", "summary",
] as const;
export type OnboardingPlace = OnboardingScreenId | OnboardingInterstitial;

/**
 * Which fields each group collects, in the order Spud asks them.
 *
 * This is the mapping that makes the flow safe to resume: the question to ask is the first one the
 * profile has no answer for (`resumeAt`, in `onboarding-chat.ts`), and everything before it has an
 * answer already on the profile.
 *
 * AT MOST TWO ENTRY FIELDS PER GROUP, and the cap outlived the screens that needed it. It is
 * trivially satisfied by a chat, which has one composer and asks one thing at a time — that is
 * STRICTLY stronger, not a reason to drop the rule. The rule is what stops the next person pairing
 * three numbers back into one form:
 *
 * A number pad covers roughly the bottom 340 points of the screen and has no return key, so a
 * screen with three number fields puts the third field AND the primary button underneath a keyboard
 * there is no obvious way to close. Measured here on a 17 Pro: the goal-weight field sat exactly
 * where the keyboard's own toolbar renders, so reaching for it dismissed the keyboard instead, the
 * number went nowhere, and the only symptom was a Continue button that stayed disabled without
 * saying why. `InputAccessoryView` was built as the escape hatch and does not attach at all under
 * the New Architecture in this Expo/RN version, mounted inside the screen or hoisted above it.
 */
export const SCREEN_FIELDS: Record<OnboardingScreenId, readonly OnboardingStep[]> = {
  goal: ["goal"],
  about: ["sex", "birth_year"],
  body: ["height_cm", "weight_kg"],
  // Where you want to be, and how fast. One question in two parts, and the pair that a maintaining
  // user is asked NEITHER of — so both disappear for them.
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

/** The group a given step is asked in. Total by construction — every step is in exactly one. */
export function screenForStep(step: OnboardingStep): OnboardingScreenId {
  for (const id of ONBOARDING_SCREENS) {
    if (SCREEN_FIELDS[id].includes(step)) return id;
  }
  // Unreachable while `SCREEN_FIELDS` covers `ONBOARDING_STEPS`; a test asserts it does.
  throw new Error(`no screen collects "${step}"`);
}

/**
 * Whether this BINARY can render a group the server named.
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

// ── Content: the editable words ──────────────────────────────────────────────────────────────

/**
 * The mascot's expressions.
 *
 * A closed list, because each one is a drawn face in the app. The chat picks the mood in code —
 * concerned on a refusal, cheerful on the plan — rather than reading one out of the copy: a mood is
 * a reaction to what just happened, and an admin cannot know that from a text field.
 */
export const MASCOT_MOODS = ["wave", "happy", "think", "cheer", "care", "idle"] as const;
export type MascotMood = (typeof MASCOT_MOODS)[number];

export interface OnboardingOptionContent {
  label: string;
  /** The second line under an option. Optional, and worth having wherever a label is ambiguous. */
  hint?: string;
}

/**
 * What Spud says to pose ONE question, and what the input looks like while it is open.
 *
 * `lines` is a list because Spud sends bubbles, not paragraphs: "A little about you — two things
 * every calorie formula needs. Which fits?" is one bubble, and the age that follows it is another.
 * One entry, one bubble.
 */
export interface OnboardingAskContent {
  lines: string[];
  /** The composer's placeholder while this question is open. Typed questions only. */
  placeholder?: string;
}

export interface OnboardingScreenContent {
  id: OnboardingScreenId;
  /**
   * What Spud says to ask each field in this group, keyed by the field name.
   *
   * REQUIRED FOR EVERY FIELD THE GROUP COLLECTS. A missing entry is a question with nothing to ask
   * it with, which in a chat is not a degraded screen — it is a conversation that stops.
   */
  asks: Record<string, OnboardingAskContent>;
  /** Per-option copy, keyed by the closed vocabulary for this group. */
  options?: Record<string, OnboardingOptionContent>;
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
 * (`marketing/research/2026-07-28-category-billing-crossread.md` §1). The same doc's §3 finds the
 * pattern: the harder a paywall sits in front of first value, the more the reviews reach for
 * "scam", "misleading", "tricked".
 *
 * This app has no email field of its own. It DOES get a paywall (decision 2026-08-24,
 * marketing/DECISIONS.md): at the very end, after the first photo's verdict, behind a 7-day trial —
 * never in front of the number or the first verdict, which is what §3 says must not be withheld.
 *
 * THE TRUST POINT HAS BEEN NARROWED TWICE, and each time by something that shipped. "No card, no
 * email, no name — nothing to cancel later" was the welcome's first line: the paywall took the
 * card and the cancelling (a trial takes one, and there is then something to cancel), and issue
 * #95 took the email, because sign-in now asks both providers for the address. What is left is the
 * half that is still true — you can use the whole app without an account at all — and it is the
 * half that was always doing the work.
 *
 * THREE RULES ON THE WORDING, all enforced by a test over the WHOLE of the content below — a rule
 * that reads one screen is a rule that moves the sentence to the next one:
 *   - never name a competitor. All seven have the complaint; naming one invites a fair-comparison
 *     argument we lose.
 *   - never claim "free" bare. `copy.md` allows exactly two qualified forms, "free to try" and
 *     "N days free"; §5 of the cross-read rules out the unqualified claim by name.
 *   - never promise away the card, the trial, or the cancelling. This is the rule that did not
 *     exist, which is how a sentence contradicting docs/PAYWALL.md survived the merge that added
 *     the paywall — asserted in four E2E flows the whole time, one of which shoots the App Store
 *     screenshots. A promise about billing is the one kind of copy a reviewer's memory cannot hold.

 * ─────────────────────────────────────────────────────────────────────────────────────────────
 */
export interface OnboardingWelcomeContent {
  /** Spud's opening bubbles. One to four — past that it is a wall, not a front door. */
  lines: string[];
  /** The quick reply that starts the flow. */
  cta: string;
}

/**
 * The arithmetic being done, as a card in the conversation.
 *
 * The incumbent's equivalent is a progress animation over nothing. This one prints the arithmetic
 * from `TargetBasis`, which was computed before the card was drawn. Labels only: every NUMBER on it
 * comes from the profile response, so no admin edit can make it say something that was not
 * computed.
 */
export interface OnboardingBuildingContent {
  /** What Spud says before the card. */
  lines: string[];
  /** The label beside each figure. The figures themselves are not editable — they are computed. */
  restLabel: string;
  activityLabel: string;
  paceLabel: string;
  /** Shown only when the safety floor is the reason the number is what it is. */
  floorLabel: string;
  /** The floor support card, shown under the arithmetic when the floor bit. `{floor}` is filled. */
  floorTitle: string;
  floorBody: string;
}

/** The payoff. Editable too, because it is the most-read thing in the flow. */
export interface OnboardingSummaryContent {
  /** What Spud says before the plan card. */
  lines: string[];
  kcalLabel: string;
  proteinLabel: string;
  /**
   * The projection, with `{weeks}`, `{month}` and `{target}` substituted.
   *
   * Weeks and a month name, never a day-precise date: `projection.ts` says why. Absent from the
   * card entirely when `projectGoal` returns null, which is every case where a number would be an
   * invention rather than a calculation.
   */
  projection: string;
  /** Replaces `projection` past the two-year horizon, where naming a month stops being useful. */
  projectionFar: string;
  /** Shown when the share cap bit — `{share}` is the percentage, filled from `targets.ts`. */
  capNote: string;
  /** The estimates-not-measurements line. */
  disclaimer: string;
  /** The one button. It opens the camera — see `copy.md` § Step 15. */
  cta: string;
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
 * The option vocabulary each group may label, keyed by group.
 *
 * Sourced from the domain constants rather than retyped, so adding a pace or a restriction tag
 * makes the validator demand a label for it instead of letting the app render a blank row.
 */
export const COUNTRY_CODES = ["de", "gb", "us", "other"] as const;
export type CountryCode = (typeof COUNTRY_CODES)[number];

/**
 * The device's region, mapped onto the four countries this app actually curates.
 *
 * WHY THIS EXISTS AT ALL: the country question is a full stop in front of the payoff that buys the
 * user nothing — it tunes which products the analyzer expects to see, and the phone already knows
 * the answer. Asked, it costs roughly a seventh of the people still in the flow. Read from the
 * locale, it costs nothing and is right for almost everyone.
 *
 * "other" IS A REAL ANSWER, not a failure. It is what the curated list means by "somewhere we have
 * not tuned for", so a region we do not carry maps to it exactly as a user picking it would — and
 * so does a device that reports no region at all. There is no null return and no unknown state for
 * a caller to invent behaviour around.
 *
 * The country never reaches `explainTargets`, which is why guessing here is safe and why `country`
 * is the sole member of `OPTIONAL_SCREENS`. A wrong guess changes which brands the analyzer expects,
 * and the user can correct it in settings; it cannot move a calorie target.
 */
export function countryFromRegion(region: string | null | undefined): CountryCode {
  const code = (region ?? "").trim().toLowerCase();
  return (COUNTRY_CODES as readonly string[]).includes(code) && code !== "other"
    ? (code as CountryCode)
    : "other";
}

/**
 * Everything that might say where somebody shops, in the order it deserves to be believed.
 *
 * A REGION IS AN ANSWER; A LANGUAGE AND AN ADDRESS ARE HINTS. That distinction is the whole design.
 * The region is a setting the user chose about where they are, so it skips the question. A language
 * says which supermarket they might know, not which one they are standing in, and an email domain
 * says where they opened an account once — both are worth SEEDING the question with and neither is
 * worth answering it with. A hint that skipped the question would be the #359 defect again, wearing
 * a better guess.
 */
export type CountrySignals = {
  /** Region codes the device or the browser reported, strongest first. */
  regions?: readonly (string | null | undefined)[];
  /** Language codes or tags, same order. A tag's region half is read too. */
  languages?: readonly (string | null | undefined)[];
  /** The address the account signs in with. NEVER leaves the server — see `suggestFromEmail`. */
  email?: string | null;
};

export type CountryResolution = {
  /** The best answer we have. `other` means we have nothing, not that they live nowhere. */
  country: CountryCode;
  /** Put the question to the user. False only when a region answered it outright. */
  ask: boolean;
};

/**
 * What we know about where this user shops, and whether it is good enough not to ask.
 *
 * WHY THE ASK CAME BACK. `country = other` reached prod on an account in Germany (#359): the phone
 * reported a region outside the curated three — an expat with a US App Store region and a German SIM
 * is the ordinary case, not the exotic one — and nothing asked, because the question was switched
 * off wholesale on the strength of the device knowing the answer. It does not always know.
 *
 * So the question is asked EXACTLY when the device could not answer it. That is the cheap half of
 * the trade the original note priced: asked of everybody it cost roughly a seventh of the people
 * still in the flow, and asked only of the people it is load-bearing for it costs that fraction of
 * a much smaller group. `onboarding_events` can measure the real number.
 */
export function resolveCountry(signals: CountrySignals): CountryResolution {
  for (const region of signals.regions ?? []) {
    const code = countryFromRegion(region);
    if (code !== "other") return { country: code, ask: false };
  }
  return { country: suggestCountry(signals), ask: true };
}

/**
 * The best HINT, when no region answered. Language before email: it is a live setting on the device
 * in front of them, where an address is where they opened an account years ago.
 */
function suggestCountry(signals: CountrySignals): CountryCode {
  for (const tag of signals.languages ?? []) {
    // A tag carries its own region ("de-AT", "en-GB"), and that half is a region like any other.
    // Read as the first two-letter subtag AFTER the language, so a script subtag ("zh-Hans-CN")
    // does not hide it — the same rule `/start` applies to `Accept-Language`.
    const [language, ...rest] = (tag ?? "").trim().toLowerCase().split(/[-_]/);
    const fromRegion = countryFromRegion(rest.find((part) => /^[a-z]{2}$/.test(part)));
    if (fromRegion !== "other") return fromRegion;
    const fromLanguage = LANGUAGE_COUNTRY[language ?? ""];
    if (fromLanguage) return fromLanguage;
  }
  return suggestFromEmail(signals.email);
}

/**
 * The only language in the curated three that names one country.
 *
 * English names two of them and therefore suggests neither — a coin flip between the United Kingdom
 * and the United States is not a suggestion, it is a wrong answer half the time, pre-selected.
 */
const LANGUAGE_COUNTRY: Record<string, CountryCode | undefined> = { de: "de" };

/**
 * The country an email address names, or `other`.
 *
 * THE ADDRESS ITSELF NEVER TRAVELS. This runs where the address already is — the server, which
 * holds it on `identities` — and only its answer, a two-letter code the user is about to be shown
 * as a chip, goes anywhere. The app is never told the address (`/v1/auth/identities` returns the
 * provider and a date), and this must not become the reason it is.
 *
 * IT USUALLY SAYS NOTHING, and that is expected rather than a gap to close. Gmail, Outlook and
 * Apple's private relay are most addresses and carry no country; the domains that do are the
 * country-coded ones, which is why this is a TLD read and not a directory of providers. Add a
 * provider only when a real address has been seen to miss.
 */
function suggestFromEmail(email: string | null | undefined): CountryCode {
  const domain = (email ?? "").trim().toLowerCase().split("@")[1] ?? "";
  const tld = domain.split(".").pop() ?? "";
  // `.uk` is the country's own top level; `gb` is the code the profile stores.
  return countryFromRegion(tld === "uk" ? "gb" : tld);
}

/**
 * The option list with the suggestion at the front.
 *
 * The whole of how a suggestion is expressed, on both surfaces: the app's chips and the browser's
 * radio list both render this array in order, so the first entry is the one under the thumb. No
 * pre-selection, no second piece of state, and nothing on screen that says where the guess came
 * from — a chip labelled "from your email" would tell the user something about their address that
 * they did not ask us to work out.
 *
 * `other` is never promoted. It is a suggestion to give up, and it is the value #359 is about.
 */
export function suggestionFirst<T extends string>(
  values: readonly T[],
  suggested: string | null | undefined,
): T[] {
  if (!suggested || suggested === "other" || !values.includes(suggested as T)) return [...values];
  return [suggested as T, ...values.filter((v) => v !== suggested)];
}

/**
 * The per-option labels for one group, from the content. A stale cache falls back to the raw value.
 *
 * Here rather than in the chat screen because settings edits the same fields with the same
 * vocabulary, and two copies of this lookup is two places for a group to lose its labels.
 */
export function screenOptions(
  content: OnboardingContent,
  id: OnboardingScreenId,
): Record<string, OnboardingOptionContent> {
  return content.screens.find((x) => x.id === id)?.options ?? {};
}

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
 * COMPILED INTO THE APP ON PURPOSE. The first bubble of onboarding must render before any network
 * call returns — a fresh install on a hotel wifi should not stare at a spinner — so the binary
 * carries a complete, correct flow and the server's copy replaces it when it arrives. That also
 * means a backend outage degrades onboarding to "the words are a version old", not to "the app
 * does not work".
 *
 * Every sentence below is `product/design/onboarding/copy.md`, verbatim. Change the design first.
 */
export const DEFAULT_ONBOARDING_CONTENT: OnboardingContent = {
  // Bumped whenever a word below changes, which is what makes the funnel readable: events carry the
  // contentVersion they were recorded against, so "did the new copy help" is a question the data
  // can answer instead of a matter of opinion. v4 cut "No card … nothing to cancel later" from the
  // welcome — the hard paywall sells a subscription behind a seven-day trial, and a trial takes a
  // card, so the line became false the day that shipped. v5 IS THE CHAT FLOW: the copy is Spud's
  // side of a conversation now, so the screens carry `asks` and nothing that described a screen.
  //
  // FIVE, NOT FOUR, AND THE MERGE IS WHY. Both this branch and the paywall's copy fix landed on
  // "4", and the version is the join key between a funnel row and the words that produced it —
  // two different flows sharing one number is exactly the meaningless average the counter exists
  // to prevent. v6 asks for an age rather than a year of birth — and predates the first shipped
  // binary, so the REVERSE dead end (age-worded copy on a binary whose parser wanted a year) has
  // no installed base; reword this question again after launch only behind a client-version gate,
  // because `usableContent` checks structure, not meaning, in that direction. v7 is three
  // questions shorter — why now, the hardest moment and eating out are gone, so a v6 funnel has
  // rows a v7 one cannot, and reading the two under one number would compare a fourteen-place
  // flow with an eleven-place one. The words did not change; the FLOW they are counted against
  // did, and that is the same join the number exists for. v8 rewrites the welcome's second and
  // third lines: the verdict is named before the questions, and the billing sentence is the
  // landing's. v9 (issue #95) replaces the welcome's opening claim: "No email, no name." became
  // "No account needed to start.", because sign-in now asks Apple and Google for the address and
  // the old sentence was a privacy promise the product had stopped keeping. It is the most
  // consequential copy change this file has had, so a funnel row tagged v8 and one tagged v9 were
  // answering under different promises — which is exactly what this number exists to keep apart.
  // The claim cannot come back: `retired-no-email` in `claims.ts` refuses it on the admin write,
  // and `usableWelcome` refuses a stored revision that still carries it on the read. v10 (#609)
  // adds one clause to the weight question: the iPhone app keeps that number current from Apple
  // Health, and a newer one moves the target on every surface, the browser included.
  version: 10,
  welcome: {
    lines: [
      "Hi, I'm Spud. Photograph what you eat, get an honest answer — that's the whole app.",
      "Three minutes of questions, then your plan — daily calories, protein, what's realistic by when — and a verdict on your first meal.",
      "No account needed to start. Nothing to pay until you've seen the plan and that first verdict; after that it's a week free to try. Ready?",
    ],
    cta: "Let's go",
  },
  screens: [
    {
      id: "goal",
      asks: {
        goal: { lines: ["The big question: what are you here to do?"] },
      },
      options: {
        lose: { label: "Lose weight" },
        maintain: { label: "Maintain my weight" },
        gain: { label: "Gain weight" },
      },
    },
    {
      id: "about",
      asks: {
        sex: { lines: ["A little about you — two things every calorie formula needs. Which fits?"] },
        // Asked as an AGE and stored as a year — `checkNumber` in `onboarding-chat.ts` converts.
        birth_year: {
          lines: ["And how old are you? Roughly is all the maths wants."],
          placeholder: "Your age",
        },
      },

      options: {
        female: { label: "Female" },
        male: { label: "Male" },
      },
    },
    {
      id: "body",
      asks: {
        height_cm: {
          lines: ["Your numbers now. Roughly is genuinely fine — I'd rather have close than blank. How tall are you, in cm?"],
          placeholder: "Height in cm",
        },
        weight_kg: {
          lines: ["And your weight now, in kg? The eait iPhone app can keep it updated from Apple Health."],
          placeholder: "Weight in kg",
        },
      },
    },
    {
      id: "target",
      asks: {
        // Two goals, two sentences, and the pair is why this is one entry rather than a lookup:
        // "faster isn't better" is a warning about losing, and saying it to a gainer is a reply
        // written for nobody. `{loseTail}` is dropped for a gain plan — see `askLines`.
        target_weight_kg: {
          lines: ["Where would you like to be, in kg?{loseTail}"],
          placeholder: "Goal weight in kg",
        },
        pace: { lines: ["And the pace?"] },
      },
      options: {
        easy: { label: "Gentle", hint: "≈ 0.25 kg a week" },
        steady: { label: "Steady", hint: "≈ 0.5 kg a week" },
        push: { label: "Push", hint: "harder to hold" },
      },
    },
    {
      id: "activity",
      asks: {
        activity: {
          lines: ["How much do you move in a normal week? Honest beats aspirational — this moves the number a lot."],
        },
      },
      options: {
        sedentary: { label: "Mostly sitting", hint: "desk days" },
        light: { label: "Lightly active", hint: "walks, errands" },
        moderate: { label: "Moderate", hint: "2–3 workouts" },
        active: { label: "Active", hint: "most days" },
        athlete: { label: "Athlete", hint: "twice-daily training, or hard physical work" },
      },
    },
    {
      id: "country",
      asks: {
        country: { lines: ["Where do you eat? So I know your supermarket, not somebody else's."] },
      },
      // ON, AND ASKED OF ALMOST NOBODY. `enabled` is the admin's switch — "this question may be
      // asked at all" — and it is no longer what decides who meets it. `resolveCountry` does, on
      // both surfaces: a device or a browser that reports a curated region answers the question and
      // it is never put, and only the users whose region we have not tuned for are asked. That is
      // roughly the cost of the old off-switch for almost everyone, and an answer for the people
      // the guess was failing.
      //
      // IT WAS OFF, AND THAT SHIPPED `country = other` TO PROD. An account in Germany was analysed
      // against a country called "other" because the phone reported a region outside the three and
      // nothing asked (#359, #365). Settings could always correct it; nobody knew to.
      //
      // Still the one group that may be switched off at all, because it is the one whose field
      // never reaches `explainTargets`. An admin who switches it off gets the old behaviour back.
      enabled: true,
      options: {
        de: { label: "Germany" },
        gb: { label: "United Kingdom" },
        us: { label: "United States" },
        other: { label: "Somewhere else" },
      },
    },
    {
      id: "restrictions",
      asks: {
        restrictions: {
          lines: ["Last one. Anything I should judge your food against? Only what you pick gets scored — skip it freely. Free text welcome too."],
          placeholder: "Allergies, foods you avoid…",
        },
      },
      options: {
        kidneys: { label: "Kidney condition" },
        ldl: { label: "High cholesterol" },
        vegan: { label: "Vegan" },
        lowsugar: { label: "Diabetes risk" },
      },
    },
  ],
  building: {
    lines: ["That's everything. Give me a second — I'm doing the arithmetic, not guessing."],
    restLabel: "Your body at rest burns",
    activityLabel: "With your activity, about",
    paceLabel: "For your pace, we adjust",
    floorLabel: "The floor we won't cross",
    floorTitle: "We stopped at {floor} kcal",
    floorBody: "The arithmetic wanted to go lower. We don't set targets below this without medical supervision, so this is where yours sits. It'll also say so on your diary.",
  },
  summary: {
    lines: ["That's you, worked out properly. Here's your plan."],
    kcalLabel: "kcal a day",
    proteinLabel: "Protein to aim for",
    projection: "On this pace you'd be at {target} kg around {month}.",
    projectionFar: "That's a long road — we'll navigate by the next few weeks, not the horizon.",
    capNote: "That pace needs a bigger daily change than is safe to keep up, so yours is the safe version: {share}% of what your body burns in a day.",
    disclaimer: "Estimates, not medical advice. Change any answer in settings.",
    // R0 of the retention plan: onboarding ends with ONE unambiguous instruction, and the thing
    // being asked for is the first photo. "Start logging" points at a diary, which is an empty list
    // and a second decision.
    cta: "Photograph your first meal",
  },
};

// ── Validation: the boundary an admin cannot cross ───────────────────────────────────────────

const MAX_LINE = 240;
const MAX_LABEL = 60;
const MAX_HINT = 90;
const MAX_BODY = 400;
/** One question is at most four bubbles. Past that Spud is lecturing, not asking. */
const MAX_ASK_LINES = 4;
/** The front door is read in about three seconds or it is not read. */
const MAX_WELCOME_LINES = 4;

export type ContentValidation =
  | { ok: true; content: OnboardingContent }
  | { ok: false; errors: string[] };

const isStr = (v: unknown): v is string => typeof v === "string";

/**
 * Validate admin-supplied content against the shape the app can render.
 *
 * Run on the WRITE, never on the read: a phone that has already fetched broken copy is a phone
 * with a broken onboarding, and no amount of client-side tolerance recovers the question the user
 * was on. Refusing the save is the only place this can be fixed while someone is watching.
 *
 * Every rule here exists because breaking it produces something specific and bad:
 *   - a missing required screen           → a profile field nobody was asked for, and a target
 *                                           computed from a default
 *   - a missing ask                       → a question Spud has no sentence for: the conversation
 *                                           stops on a field the arithmetic needs
 *   - a missing option label              → a tappable chip rendering as blank space
 *   - an option key outside the vocabulary → a value the server's own patch validator will 422
 *   - an over-long line                   → a bubble clipped on a 5.4-inch phone, invisible on the
 *                                           reviewer's device and on ours
 */
/**
 * The claim rules that are DECIDABLE on onboarding copy.
 *
 * Not the marketing set: this surface's own honest answers are "Lose weight" and "Diabetes", and
 * `weight-promise` and `disease-term` cannot tell those from a claim. The root AGENTS.md names
 * that exact problem as the reason the web gate covers `PAGE_COPY` and not the rendered page.
 * What IS decidable here is a promise the product has retired, because those are fixed strings
 * with no legitimate use left.
 */
const ONBOARDING_CLAIM_RULES = ["retired-no-email"] as const;

/**
 * Every sentence in a revision that a user will read, keyed well enough to find it again.
 *
 * Walks the whole structure rather than naming fields, because a rule that reads one screen is a
 * rule that moves the sentence to the next one — the same reason `onboarding.test.ts` scans the
 * serialized default instead of the welcome alone. Non-strings are skipped; ids and version are
 * not copy.
 */
function claimFields(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (node: unknown, at: string) => {
    if (typeof node === "string") { out[at] = node; return; }
    if (Array.isArray(node)) { node.forEach((v, i) => walk(v, `${at}[${i}]`)); return; }
    if (typeof node === "object" && node !== null) {
      for (const [k, v] of Object.entries(node)) {
        if (k === "id") continue;
        walk(v, at === "" ? k : `${at}.${k}`);
      }
    }
  };
  walk(raw, "");
  return out;
}

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

  /** A required, non-empty, length-capped string. Returns nothing; it reports. */
  const str = (v: unknown, at: string, max: number) => {
    if (!isStr(v) || v.trim() === "") push(`${at} is required`);
    else if (v.length > max) push(`${at} is over ${max} characters`);
  };

  /** A list of Spud bubbles: one to `max`, each a real sentence. */
  const bubbles = (v: unknown, at: string, max: number) => {
    if (!Array.isArray(v) || v.length < 1 || v.length > max) {
      push(`${at} must be 1 to ${max} lines`);
      return;
    }
    for (const [i, line] of v.entries()) str(line, `${at}[${i}]`, MAX_LINE);
  };

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

    // The asks. One per field this group collects, and nothing else: an ask for a field that is
    // asked somewhere else is copy that will never be spoken, which is worse than an error because
    // the admin watches it save and believes they changed something.
    const asks = s.asks as Record<string, unknown> | undefined;
    if (typeof asks !== "object" || asks === null) {
      push(`${at}.asks is required`);
    } else {
      for (const key of Object.keys(asks)) {
        if (!(SCREEN_FIELDS[screenId] as readonly string[]).includes(key)) {
          push(`${at}.asks has "${key}", which "${screenId}" does not collect`);
        }
      }
      for (const field of SCREEN_FIELDS[screenId]) {
        const a = asks[field] as Record<string, unknown> | undefined;
        if (typeof a !== "object" || a === null) { push(`${at}.asks is missing "${field}"`); continue; }
        bubbles(a.lines, `${at}.asks.${field}.lines`, MAX_ASK_LINES);
        if (a.placeholder !== undefined
          && (!isStr(a.placeholder) || a.placeholder.trim() === "" || a.placeholder.length > MAX_LABEL)) {
          push(`${at}.asks.${field}.placeholder must be a non-empty string under ${MAX_LABEL} characters`);
        }
      }
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
  // Order is NOT content any more: the chat asks in the order `ONBOARDING_STEPS` fixes, because
  // the replies read answers the earlier questions produced. What is checked here is that every
  // group is present exactly once.

  // ── The interstitials ──────────────────────────────────────────────────────────────────────
  //
  // Same discipline as a group, for the same reason: an empty line renders as an empty bubble on
  // the one beat that has no question to fall back on.

  const wel = raw.welcome as Record<string, unknown> | undefined;
  if (typeof wel !== "object" || wel === null) push("welcome is required");
  else {
    bubbles(wel.lines, "welcome.lines", MAX_WELCOME_LINES);
    str(wel.cta, "welcome.cta", MAX_LABEL);
  }

  const bld = raw.building as Record<string, unknown> | undefined;
  if (typeof bld !== "object" || bld === null) push("building is required");
  else {
    bubbles(bld.lines, "building.lines", MAX_ASK_LINES);
    for (const key of ["restLabel", "activityLabel", "paceLabel", "floorLabel", "floorTitle"] as const) {
      str(bld[key], `building.${key}`, MAX_LABEL);
    }
    str(bld.floorBody, "building.floorBody", MAX_BODY);
  }

  const sum = raw.summary as Record<string, unknown> | undefined;
  if (typeof sum !== "object" || sum === null) push("summary is required");
  else {
    bubbles(sum.lines, "summary.lines", MAX_ASK_LINES);
    for (const key of ["kcalLabel", "proteinLabel", "cta"] as const) {
      str(sum[key], `summary.${key}`, MAX_LABEL);
    }
    for (const key of ["projection", "projectionFar", "capNote", "disclaimer"] as const) {
      str(sum[key], `summary.${key}`, MAX_BODY);
    }
  }

  // THE CLAIMS GATE, the same one the notification copy and the landing page run. Onboarding copy
  // is the third editable public surface: an admin can write anything into it and it reaches every
  // phone that fetches a revision. `retired-no-email` is why this is here — "No email, no name."
  // was Spud's third welcome bubble until issue #95, and nothing stopped an admin typing it back.
  for (const v of lintCopy(claimFields(raw), ONBOARDING_CLAIM_RULES)) {
    errors.push(`${v.field} contains a ${v.pattern} claim: "${v.span}"`);
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

/** The groups an admin has switched off, read back out of content. */
export function disabledScreens(content: OnboardingContent): OnboardingScreenId[] {
  return content.screens
    .filter((s) => s.enabled === false && isKnownScreen(s.id) && screenIsOptional(s.id))
    .map((s) => s.id);
}

/**
 * Content this binary can actually run, or the fallback.
 *
 * The mirror image of `isKnownScreen`, and it closes the other half of the same problem. That one
 * handles a server AHEAD of the app — extra screens, dropped. This one handles a server BEHIND it:
 * copy that predates a question the app now asks would silently produce a flow that never asks it,
 * and therefore a calorie target computed from a field nobody filled in. In a chat that is not even
 * a degraded flow — a question with no sentence to ask it with is a conversation that stops dead.
 *
 * So a revision is kept only when every group is present AND every field in every group has an ask.
 * Dropping a whole revision of the copy is the right trade: the words are cosmetic and the app has
 * a complete set compiled in; the questions are not, and asking all of them is the point.
 *
 * AN INTERSTITIAL IS THE EXCEPTION, and the exception is what the rule's own reasoning asks for.
 * `welcome` and `building` ask nothing, so a revision missing one cannot produce a flow that skips
 * a question — the failure the paragraph above is written against does not exist there. Charging an
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
  const byId = new Map(c.screens.map((s) => [s?.id, s]));
  for (const id of ONBOARDING_SCREENS) {
    const screen = byId.get(id);
    if (!screen) return fallback;
    const asks = screen.asks;
    if (typeof asks !== "object" || asks === null) return fallback;
    for (const field of SCREEN_FIELDS[id]) {
      const ask = asks[field];
      if (!ask || !Array.isArray(ask.lines) || ask.lines.length === 0) return fallback;
    }
  }
  return {
    version: c.version,
    welcome: usableWelcome(c.welcome) ? c.welcome : fallback.welcome,
    screens: c.screens,
    building: usableBlock(c.building, ["restLabel", "floorTitle", "floorBody"]) ? c.building : fallback.building,
    // The summary carries the plan card's every label, so a revision from before one of them
    // renders a card with a hole in it. Filled the same way rather than half-adopted.
    summary: usableBlock(c.summary, ["kcalLabel", "proteinLabel", "projection", "cta"])
      ? c.summary
      : fallback.summary,
  };
}

/** A block with bubbles and every key this binary reads. Missing one means the block is a version behind. */
function usableBlock<T extends { lines?: unknown }>(block: T | undefined, keys: readonly string[]): block is T {
  if (typeof block !== "object" || block === null) return false;
  if (!Array.isArray(block.lines) || block.lines.length === 0) return false;
  const b = block as unknown as Record<string, unknown>;
  return keys.every((k) => typeof b[k] === "string" && b[k] !== "");
}

/**
 * A stored welcome is usable when it is shaped right AND makes no claim the product has retired.
 *
 * THE SECOND HALF IS THE READ-SIDE HALF OF THE WRITE GATE, and without it the write gate fixes
 * nothing that is already saved. `onboardingContent` returns the STORED revision and falls back to
 * the compiled default only when one is unusable, so a host whose admin saved "No email, no name."
 * before issue #95 would go on serving it after the binary that retired it shipped — indefinitely,
 * and re-shipping the app would not change it. Refusing it here swaps THAT BLOCK for the shipped
 * one and leaves the rest of the admin's revision alone, which is the narrowest repair available.
 */
function usableWelcome(w: OnboardingWelcomeContent | undefined): w is OnboardingWelcomeContent {
  if (typeof w !== "object" || w === null) return false;
  if (!Array.isArray(w.lines) || w.lines.length === 0) return false;
  if (typeof w.cta !== "string" || w.cta === "") return false;
  return lintCopy(claimFields({ lines: w.lines, cta: w.cta }), ONBOARDING_CLAIM_RULES).length === 0;
}

// ── Analytics ────────────────────────────────────────────────────────────────────────────────

/**
 * What can happen at an onboarding place.
 *
 * Deliberately small. A funnel needs to answer three questions — how many saw this question, how
 * many answered it, and how many left — and every extra verb is a column nobody reads.
 *
 * `back` is kept in the vocabulary and is no longer emitted: the chat has no back button, because a
 * conversation is corrected by saying the next thing rather than by rewinding. Rows already
 * recorded against it are still readable, which is the reason to keep the word rather than to
 * rewrite history.
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
 * know a question WAS answered, not what with — so `value` carries an enumerated choice (`lose`,
 * `moderate`, `de`) and nothing else, and the numeric questions send no value at all.
 *
 * `struggles`, the one question that collects nothing, sends no value either, and it is the
 * strongest case of the lot: "binge episodes" is a disclosure, not a preference. `REPORTABLE_FIELDS`
 * is keyed by `OnboardingStep`, so that field is not on it and its answers are dropped by
 * construction rather than by anybody remembering.
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
  /** Milliseconds this question was on screen before the event. Absent on `view`. */
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

/** One row of the admin funnel: how a question performed. */
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
