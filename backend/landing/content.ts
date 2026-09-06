// Every word on the landing page.
//
// The positioning is research, not taste — the rationale lives in `marketing/` (README.md distils
// it), and each section below cites its source. What may not appear here — health, superiority and
// exclusivity claims, unqualified "free" — is enforced by `claims.ts` at build time; the legal
// reasoning is in that file's header and `marketing/DECISIONS.md`.
//
// Citations: verdict-over-counting lead — `marketing/research/2026-07-26-meta-ad-teardown.md` §6
// (angle A2) · billing refusal — `marketing/research/2026-07-28-calai-app-store-review-brief.md`
// §5 (the angle) and `…-category-billing-crossread.md` §1 (the proof line: seven apps, 2,792
// low-star reviews, billing the largest cluster in all seven — the 864 is Cal AI's alone) · floor section — that brief's §3.4, numbers read from
// `src/shared/targets.ts` · accuracy section — `marketing/research/2026-07-26-ad-angle-bank.md`
// Angle 2 · hero no-card line, the two FAQ additions and the copy-editing pass —
// `marketing/research/2026-09-02-landing-cro-audit.md` · the 2026-09-06 tone pass (warmer,
// second-person, lifestyle-first, every fact unchanged) and `problemSection` — the struggling
// moments SM1 and SM2 and the pushes in `marketing/research/2026-09-02-jtbd.md` §1 and §2, in the
// order the forces evidence ranks them, and `2026-09-02-positioning-canvas.md` §10.
//
// THE TONE IS WARM AND THE FACTS ARE NOT NEGOTIABLE. "Success in health" on this page means agency,
// consistency and feeling good about dinner — never an outcome. Nothing here promises a result,
// because `claims.ts` refuses the words and the product cannot substantiate the rest.
//
// THE FIRST REFUSAL USED TO SAY THERE WAS NO PAID TIER, AND THE PAID TIER SHIPPED. Three places
// said it — the refusal, the cost question and the closing line — and every one of them became
// false the day `checkCaps` started answering `subscription-required`. The angle survives, because
// the 864-review Cal AI corpus is about charges nobody agreed to rather than about price: what the product
// still refuses is taking a card BEFORE it has shown you an answer. The claim is now the narrower
// true one, and `landing.test.ts` fails if the copy and `configDefaults().freeAnalyses` disagree.
//
// NO PRICE IS PRINTED HERE, and that is deliberate rather than coy. The products are priced per
// territory — 175 of them, equalized from a euro base — so any single figure on this page is the
// wrong figure for most of the people reading it, and the App Store shows each of them their own
// before they agree to anything. A number on this page would also be a second copy of one that
// lives in App Store Connect, which is the drift `KCAL_FLOOR` is quoted to avoid.

// EMPHASIS IS `**LIKE THIS**`, AND IT IS THE ONLY MARKUP THIS FILE MAY CONTAIN. `emphasis()` in
// render.ts escapes the string FIRST and then turns the marker into `<strong>`, so copy can never
// smuggle a tag onto the page. One span per block, at most: the reason it exists is that 1,600
// words of even grey read as an essay, and the page is read standing in a kitchen — a reader
// skimming should be able to take the load-bearing sentence out of each block without reading the
// rest of it. A block with everything bold has nothing bold.

import { KCAL_FLOOR, MAX_DEFICIT_SHARE } from "@eait/shared";
import { configuredSample } from "./config.ts";

/**
 * What an account gets before the app asks. The server's own number, not a sentence about it.
 *
 * READ FROM THE INSTANCE, NOT COMPILED IN — `config.ts` explains why, and it is the same rule the
 * rest of this repo applies to every limit the server enforces. The singular branches below are
 * live because of it: a host that pins the knob to 1 gets a page that says so. Production is not
 * that host — it ships the default, which has been fifteen since #204.
 */
export const SAMPLE_ANALYSES: number = configuredSample();

/**
 * The one place the singular/plural choice is made. FIVE sites had hand-written it, in three
 * different phrasings, and the fifth — the meta description, which is the Google snippet — was
 * found by a review rather than by the test.
 */
export const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many);

export interface Refusal {
  /** The promise, stated as what happens. */
  title: string;
  body: string;
  /** The one-line receipt: where in the product this is enforced. */
  proof: string;
}

export interface Step {
  ordinal: string;
  title: string;
  body: string;
}

export interface Faq {
  q: string;
  a: string;
}

export const brand = {
  name: "eait",
  /**
   * The document title and the og:title, under 60 characters so a search result does not truncate
   * it.
   *
   * **The category name comes first and the brand comes last, and that ordering is the whole
   * point.** It read `eait — will this meal fit your day?` for a long while: the brand voice, and
   * two things nobody types into a search box. A page for an unknown product whose title carries
   * only its own name can be found by people who already know the name, which is nobody. The
   * rendered page uses the words `nutrition`, `macro`, `calorie counter` and `food tracker` a
   * combined zero times; this is the one element where that is not survivable, because the title
   * is the highest-weighted text on the page.
   *
   * `photo calorie tracker` is how the category is actually searched. `with a verdict` is the
   * positioning `marketing/research/2026-07-26-meta-ad-teardown.md` §6 found nobody selling, and
   * it is the H1's promise in three words. Neither is a health claim, so `claims.ts` permits both
   * — `lose weight` is what it would refuse, and that is not a sentence this product needs.
   */
  title: "Photo calorie tracker with a verdict — eait",
  /** The positioning line the review panel found the page never says in one sentence. */
  tagline: "Photograph the plate and get a verdict against your own day.",
} as const;

/**
 * NO EYEBROW. It read "Photo → numbers → verdict" — the mechanism, which is the commoditised axis
 * of this category — and the positioning canvas (§10) found it undercut the H1, which already leads
 * with the answer. The headline is the first thing on the page now.
 */
export const hero = {
  /**
   * THE HABIT, NOT THE INSTRUMENT. It read "Will this meal fit your day?" — Angle A2 as the
   * reader's moment — and a cold reader heard a question about time. Kirill's line, 2026-09-06:
   * the page sells eating better as a habit and a life, and the verdict is how it is kept. The
   * cost is that this is a sentence any app in the category could open with, so the sub below is
   * what has to carry the difference: the moment, and the answer that comes back every time.
   */
  headline: "Want to eat better?",
  /**
   * THE PROBLEM, IN THE READER'S OWN MOMENT, then what eait does about it. This is SM1 from the
   * JTBD work (the plate you did not cook, a few kilos from the goal, the margin gone in one
   * guess) and the push away from the usual tools; the last clause is the habit — a verdict on
   * every plate, and a reason to send the next one. "A few kilos from where you want to be" is
   * the segment, not a promise.
   *
   * No "in seconds": docs/ACCURACY.md measured a 37 s median to the verdict on the reasoning
   * model. The glance is about a second; the answer is not, and the hero must not say it is.
   */
  // Plain statements, short. The first version stacked negations ("no weighing, no database
  // search, no card"), personified "the usual tools" and closed on a triplet; Kirill called it
  // slop, and WRITINGSTYLE.md agrees on every count. Nothing here says what eait is not.
  sub: "Scan your food. We'll do the rest.",
  /** The no-card promise from the CRO audit, stated as what happens rather than what does not. */
  promise: plural(SAMPLE_ANALYSES,
    "You get the first verdict before anyone asks you for a card.",
    `You get your first ${SAMPLE_ANALYSES} verdicts before anyone asks you for a card.`),
} as const;

/**
 * The sample the hero instrument renders.
 *
 * Deliberately not a flattering one. The meal is over on two dimensions and badly over on the
 * third, because a landing page that only ever shows a green card is selling a mood. The numbers
 * are a plausible large chicken shawarma; the point of the card is the three separate judgements,
 * which is the thing no competitor's screenshot has.
 */
export const sample = {
  target: {
    kcal: 1780,
    label: "Your daily target",
    basis: "Computed from your profile. Deficit capped at 20% of maintenance.",
    floorKcal: KCAL_FLOOR.female,
    floorLabel: "floor",
  },
  meal: {
    title: "Chicken shawarma, large",
    kcal: 640,
    macros: [
      { label: "protein", value: "41 g" },
      { label: "carbs", value: "58 g" },
      { label: "fat", value: "24 g" },
    ],
    verdicts: [
      { label: "Calories", verdict: "warn" as const },
      { label: "Saturated fat", verdict: "warn" as const },
      { label: "Sodium", verdict: "bad" as const },
    ],
    /**
     * What the reader sends, drawn as their own bubble above the card — so the phone plays the
     * problem and then the answer, rather than only the output. In the app the photo goes with
     * it; the page has no meal photograph it may publish (docs/RELEASE.md § A note on the
     * photos), so the bubble carries the question alone.
     */
    ask: "Is this fine?",
    note: "Counted the garlic sauce. Say “no sauce” if there wasn’t any.",
    /**
     * THE ANSWER, IN A SENTENCE — and the thing this card did not have.
     *
     * The title promises a verdict. The card delivered a photo's numbers and
     * three coloured chips, which is the TAXONOMY of a verdict rather than one: a reader had to
     * decode a pill legend to learn whether the meal was all right. This is the line the app itself
     * ends on ("1168 of your 2393 kcal today — 1225 left"), carrying the one judgement the pills
     * spell out underneath.
     *
     * IT MUST AGREE WITH THE PILLS. It read "Fits your day" for a while, beside a Calories pill
     * reading `warn` — and `warn` on that dimension is `shareVerdict` saying the meal took more
     * than a third of the day (`WARN_SHARE`, src/shared/targets.ts). The sample is documented above
     * as over on two dimensions and badly over on the third; a summary that called it a fit
     * contradicted its own card, in the hero, and a screen reader heard it straight after the three
     * verdicts.
     *
     * `1,140` is `target.kcal − meal.kcal`, and a test computes it rather than reading it, because
     * a hero that quotes arithmetic it got wrong is the worst possible place for a stale number.
     */
    verdict: "1,140 kcal left, but over a third of your day and most of your sodium.",
  },
} as const;

/**
 * The problem, stated before anything is asked for. This section was WHO IT'S FOR — three
 * personas under a label saying the section was about the reader — and the page never said in
 * plain words why it exists. Each row is a place the usual answer breaks (`2026-09-02-jtbd.md`
 * §1 SM1–SM2 and the pushes in §2, in the order the forces evidence ranks them: portions and
 * being wrong, the number with no judgement, the small margin) and closes with the one thing eait
 * does about it. Sources for the rows themselves: `marketing/research/2026-07-26-ad-angle-bank.md`
 * Angle 1 and Angle 3, `…-market-research.md` §5. No outcome promises; the third row's margin is
 * the segment's, and what it promises is a check, not a result.
 *
 * The kcal in the second row is the hero card's own meal, read from `sample` rather than typed,
 * so the number the section argues about is the number the phone above it shows.
 */
export const problemSection = {
  eyebrow: "Struggle",
  headline: "Tracking breaks in the same three places.",
  intro: "Food diaries die for three reasons.",
  rows: [
    {
      title: "Portions are a guess.",
      body:
        "Nobody weighs a restaurant plate. **eait reads it and shows the portion it assumed.** If that is wrong, say so: half that, no oil.",
    },
    {
      title: "The judging is left to you.",
      body:
        `A diary writes ${sample.meal.kcal.toLocaleString("en-GB")} kcal and stops. **eait says whether that was fine, in words.**`,
    },
    {
      title: "One guessed dinner costs the week.",
      body:
        "A small deficit has a small margin. **A verdict on every meal is a check sized for it.**",
    },
  ],
} as const;

export const refusalsSection = {
  eyebrow: "Promises",
  // NOT "kept in code". That headline was addressed to the wrong reader — it answered a
  // developer's question about how the promises are enforced, in a section whose whole job is to
  // tell a visitor what will not happen to them. The enforcement is still real and still tested;
  // it is simply not the reader's business here.
  headline: "What you can count on.",
} as const;

export const refusals: readonly Refusal[] = [
  {
    title: plural(SAMPLE_ANALYSES,
      "You see the first verdict before it asks for a card.",
      `You see your first ${SAMPLE_ANALYSES} verdicts before it asks for a card.`),
    body:
      "Answer a few questions and send a meal. " +
      `${plural(SAMPLE_ANALYSES, "That first answer is yours", `The first ${SAMPLE_ANALYSES} answers are yours`)} ` +
      "before anything is asked of you. Then a free week. **The App Store shows the price in your " +
      "currency before any charge.**",
    proof:
      "2,792 low-star App Store reviews across seven apps in this category. The biggest complaint in every one: a charge nobody agreed to.",
  },
  {
    title: "Your photo stays with your meal.",
    body:
      "Stored beside the meal it logged, on our server in Germany. **Erase the account and the photo goes with it.**",
    proof: "No second copy, no advertising pipeline, nothing sold on. It lives as long as your account and not a day longer.",
  },
  {
    title: "There is a number your target never goes under.",
    body:
      `${KCAL_FLOOR.female.toLocaleString("en-GB")} kcal for women, ${KCAL_FLOOR.male.toLocaleString("en-GB")} for men. ` +
      "**Whatever the arithmetic said, your number stays above it.**",
    proof: "No goal and no hurry gets under it, and when the floor is why your number is what it is, the app says so.",
  },
];

/**
 * The one line the page says louder than the rest, on the other theme's ground between the
 * promises and the accuracy section. The outcome in the reader's own scene, because that is what
 * the habit is for; no number in it, because the sections either side of it carry the proof.
 */
export const band = { line: "Eat out on Friday and the week still adds up." } as const;

/**
 * The photographs. Real plates, photographed by whoever was about to eat them, from Wikimedia
 * Commons under CC0, so nothing is owed and nothing is claimed: none of these is a user's meal or
 * shown as one. The hero's is a chicken shawarma platter because that is the plate the sample
 * card describes, and the closing's is dinner.
 */
export interface Photo {
  file: string;
  source: string;
  license: "CC0";
  width: number;
  height: number;
}

export const photos: { readonly hero: Photo; readonly closing: Photo } = {
  hero: {
    file: "plate-shawarma.webp",
    source: "https://commons.wikimedia.org/wiki/File:Chicken_Shawarma_Platter_-_Lavash_2025-02-10.jpg",
    license: "CC0",
    width: 1000,
    height: 1250,
  },
  closing: {
    file: "plate-dinner.webp",
    source: "https://commons.wikimedia.org/wiki/File:Poke_Bowl_Losos_Zlaty_Klas_2025.jpg",
    license: "CC0",
    width: 1400,
    height: 875,
  },
};

/** The inventory, after the steps: six things, each of them shipped code. */
export const whatSection = {
  eyebrow: "What you get",
  headline: "Scan. Track. Get better.",
  items: [
    {
      title: "A photo or a sentence.",
      body: "Both go to the same analyzer. No barcode, no database search.",
    },
    {
      title: "Corrections in a sentence.",
      body: "Half that, no oil. The numbers and the verdict recompute.",
    },
    {
      title: "A verdict on every meal.",
      body: "Against your own day, in words, on the dimensions you declared.",
    },
    {
      title: "A plan with its arithmetic.",
      body: "Resting burn, activity, the pace you chose, the floor. Every line on screen.",
    },
    {
      title: "Apple Health, both ways.",
      body: "Meals go in. Weight, energy, activity and sleep come back, on one screen with your intake.",
    },
    // Persona-neutral on purpose: the coach is Spud today and becomes Gabie, the nutritionist,
    // when that branch ships. The sentence stays true through both.
    {
      title: "Ask about your week.",
      body: "How was my week, what should dinner be. The answer reads your diary first.",
    },
  ],
} as const;

export const stepsSection = {
  eyebrow: "How it works",
  headline: "Three steps. The third one is the habit.",
} as const;

export const steps: readonly Step[] = [
  {
    ordinal: "01",
    title: "Send the meal.",
    body:
      "A photo, or a sentence: chicken shawarma, large. **No scale, no database search.**",
  },
  {
    ordinal: "02",
    title: "Read the numbers.",
    body:
      "Calories, protein, carbs, fat, fibre, sugar and sodium, per item and totalled, **with the portion it assumed.** Under them, the verdict against your day.",
  },
  {
    ordinal: "03",
    title: "Get better.",
    body:
      "The verdict says what to change on the next plate. **After a week you see it before the app does.**",
  },
];

/**
 * The screenshots.
 *
 * THE PAGE HAD NO IMAGE OF THE PRODUCT ON IT, at all, below the hero — eight sections of two-column
 * body copy and one drawn phone. Everything it claims about a conversation, an arithmetic that is
 * shown rather than asserted, and a day that adds up was written rather than shown, on the one
 * surface where a skeptic is deciding whether this is a serious instrument.
 *
 * THESE ARE THE APP, NOT A MOCKUP. They are `docs/screenshots/`, resized once and committed to
 * `assets/` — the same frames App Store Connect gets, which is what makes them worth putting here:
 * a landing page whose screenshots differ from the listing's is a page selling a different app.
 *
 * WHICH FOUR, AND WHY NOT THE OTHERS. `06` was reshot against the production analyzer on
 * 2026-09-06 and is here because of it: the card now reads back the meal that was typed, in the
 * model's own words, with no disclaimer under it. `07` and `08` are still the 27 Aug set and still
 * carry "Demo analyzer — these numbers are canned" in shot, so they cannot appear anywhere a
 * customer looks; reshooting them needs a real meal photograph, which since the meal keeps its
 * picture is IN FRAME and therefore published rather than merely an input. `docs/RELEASE.md` says
 * so and says whose photograph it may be.
 *
 * The alt text is COPY: `claims.ts` reads attributes, so a health claim in an alt fails the build
 * exactly as one in a paragraph does.
 */
export interface Shot {
  /** The file in `assets/`, copied into the build beside the page. */
  file: string;
  /**
   * The `docs/screenshots/` frame this is a resize of.
   *
   * NAMED RATHER THAN IMPLIED, because the bar on `07`–`08` is a rule about the SOURCE and `file`
   * cannot carry it: no name in the `app-*.webp` scheme can begin with a digit, so a check written
   * against the asset name passes whatever is put behind it. A test resolves this one on disk.
   */
  source: string;
  /**
   * The sha256 of that frame AS AUDITED — the pixels a person looked at before this shot was
   * allowed onto the page.
   *
   * THE ASSET IS A COPY AND COPIES GO STALE. `03` and `05` were reshot with new in-app copy and
   * their `.webp`s were not regenerated, so for one commit the page published a payment promise the
   * app no longer made, on the same page that says a landing whose screenshots differ from the
   * listing's is a page selling a different app. Nothing bound the two: the test asserted only that
   * the source file existed.
   *
   * It is also the re-audit trigger. Everything a human verified about these frames — that no demo
   * disclaimer is in the picture, that the numbers quoted in `body` and `alt` are the ones on the
   * card, that a baked date has not passed — is true of a specific set of pixels and of no other.
   * A reshoot changes the hash, this goes red, and the copy and the bar are read again rather than
   * inherited. Regenerate with the command in `README.md` and paste the new hash here in the same
   * commit as the reshoot.
   *
   * IT DOES NOT BIND THE ASSET TO THE SOURCE, and #168 is that gap: both sides of the comparison
   * are edited by the same hand in the same commit, so a reshoot with the hash pasted and the
   * `cwebp` line forgotten still passes. The four reproduce byte-for-byte today; deriving them in
   * `build.ts` is what would make that enforced rather than true.
   */
  sourceSha256: string;
  /**
   * The first day this frame's pixels stop being true, `YYYY-MM-DD`. Absent when nothing in it
   * dates.
   *
   * `05` prints a projection month — "you'd be at 88 kg around November 2026" — and reshooting does
   * not clear it: the projection is about ten weeks out from whenever the walk runs, so a reshoot
   * moves the month and re-arms the same problem. `build.ts` REFUSES to write the page once the day
   * arrives, because the alternative is eait.fit serving a false projection until somebody happens
   * to look. `scripts/store-frames.ts` reads this too, for the same frames on the App Store side.
   */
  expires?: string;
  width: number;
  height: number;
  title: string;
  body: string;
  alt: string;
}

export const screensSection = {
  eyebrow: "The app",
  headline: "How it looks.",
  intro: "Photographed from the build that goes to the App Store.",
  /** Appended while there is no listing. A store build saying this under a store button is a lie. */
  unreleased: "The iOS app is coming soon. This is it.",
} as const;

export const shots: readonly Shot[] = [
  {
    file: "app-chat.webp",
    source: "03-onboarding.png",
    sourceSha256: "f0480f516552638ff00f5e84395edd552f4d34bbdd4e8141b58a4bb161cbb168",
    width: 589,
    height: 1280,
    title: "It asks. You answer.",
    // READ OFF THE FRAME, not carried over. The 2026-09-06 reshoot changed what this screen
    // promises: it used to say "You see your plan before anything is asked", and now says
    // "Nothing to pay until you've seen the plan and that first verdict". The sentence below said
    // the older thing for one commit, which is the page describing a product the app had stopped
    // being. Whenever `sourceSha256` moves, this is what has to be re-read — the hash exists to
    // stop the paste happening without it.
    // READ OFF THE FRAME AGAIN at issue #95: the welcome's opening bubble changed from "No email,
    // no name." to "No account needed to start.", because sign-in now asks both providers for the
    // address. Both sentences below said the retired thing, and the ALT is the one that matters —
    // it is the only description a screen reader gets of a picture that states a privacy promise.
    // `sourceSha256` moves with the reshoot, which is what forces this to be re-read.
    body:
      "One conversation, no account to make. **Nothing to pay until you have seen your plan and a first verdict.**",
    alt:
      "The opening of the eait onboarding chat: Spud introduces himself, says it is three " +
      "minutes of questions and then a plan and a verdict on your first meal, says no account is " +
      "needed to start and there is nothing to pay until both have been seen and a week free " +
      "to try after that, then asks what you are here to do.",
  },
  {
    file: "app-plan.webp",
    source: "05-your-target-and-why.png",
    expires: "2026-11-01",
    sourceSha256: "30efaa5a0fdf8e526b68e9b78d8a70b650766717a14ee9c0bac09bc3ad2762f8",
    width: 589,
    height: 1280,
    title: "Then it shows the arithmetic.",
    body:
      "Resting burn, activity, the pace you chose, the target that falls out. **Every line on screen.** Different numbers from the hero, because it is a different body.",
    alt:
      "The plan screen: resting burn 1,899 kcal, about 2,943 kcal with activity, minus 550 kcal " +
      "for the chosen pace, and a daily target of 2,393 kcal with a protein figure under it.",
  },
  {
    file: "app-say.webp",
    // KNOWN AND NOT A REGRESSION: the frame opens on a clipped bubble and a half-drawn avatar,
    // because the thread is scrolled mid-sentence when the card lands. `docs/RELEASE.md` has
    // carried the note since the 27 August set; it is repeated here because this is the surface
    // the defect is newest on, and because the next person to re-audit this shot after a reshoot
    // would otherwise read it as something they had just broken. Fixing it means scrolling the
    // thread before the capture, the way `04` and `05` already do.
    source: "06-just-say-what-you-ate.png",
    sourceSha256: "51cf984dba593c682d3e7232c1c3ac13b0285ac229b98b1d2d259e65a8d4d2be",
    width: 589,
    height: 1280,
    title: "Say it, and it reads it back.",
    body:
      "Two eggs and a slice of rye, typed. It answers with the grams it assumed and **why**, before anything is logged.",
    alt:
      "The chat: the sentence \"two boiled eggs and a slice of rye bread\" and the card that comes " +
      "back: 268 kcal marked as a rough estimate, boiled eggs 100 g, rye bread 45 g, 17 g " +
      "protein, and two verdicts reading calories on plan and saturated fat on plan, scored " +
      "against the high cholesterol declared a few messages earlier. Under it, a note saying two " +
      "large eggs were taken as 100 g total and the rye slice estimated at 45 g.",
  },
  {
    file: "app-day.webp",
    source: "09-diary.png",
    sourceSha256: "04ec2b133ab1389cccbca32ff33d32ffca6102ea3900ca4c9abfb7c95b1e2470",
    width: 589,
    height: 1280,
    title: "And the day fills up in front of you.",
    body:
      "Every meal scored as it lands, **what is left stated in kcal.**",
    alt:
      "The diary screen: 1,168 of 2,393 kcal used today with 1,225 left, and two logged meals " +
      "each carrying its own verdicts.",
  },
];


export const floorSection = {
  eyebrow: "The floor",
  headline: "The number it stays above.",
  intro:
    "A daily target is the most consequential number an app like this produces. Three guards run, in this order, every time:",
  guards: [
    {
      title: "The deficit is capped at a share of maintenance.",
      body:
        `${Math.round(MAX_DEFICIT_SHARE * 100)}% of maintenance at most, so the cut scales with the person rather than with the impatience.`,
    },
    {
      title: "The floor is applied last, and unconditionally.",
      body:
        `${KCAL_FLOOR.female.toLocaleString("en-GB")} kcal for women, ${KCAL_FLOOR.male.toLocaleString("en-GB")} for men. Applied after the cap, every time.`,
    },
    {
      title: "A target weight under a healthy BMI is refused.",
      body:
        "Below a BMI of 18.5 the app declines to set the target. There is no dialog to click through.",
    },
  ],
  outro: "When the floor is why your number is what it is, the screen says so.",
  /**
   * What Spud says here. Same job as in the app: name the refusal, and why.
   *
   * HE INTRODUCES HIMSELF, because this is the first time a reader meets him and the page never
   * told anyone who he was. An unnamed cartoon potato beside a paragraph about calorie floors reads
   * as a stray sticker; the app's own first line is "Hi, I'm Spud", and the screenshots two
   * sections above this one now show him doing exactly this job inside the product.
   */
  mascot: "I'm Spud. This is the one thing I'm strict about.",
} as const;

/**
 * The measured numbers, from `docs/ACCURACY.md` (run of 2026-08-01, `x-ai/grok-4.5`).
 *
 * Published because nobody in the category publishes anything — see marketing/README.md.
 *
 * **n IS PART OF THE CLAIM.** Eight dishes is a smoke test, and that document says so in as many
 * words. Quoting the headline MAPE alone would be borrowing a precision the run does not have, so
 * the page quotes the median, the signed error and the sample size together, and rounds — the doc
 * warns that one-decimal comparisons between runs are noise.
 *
 * A test parses `docs/ACCURACY.md` and fails if these stop matching it.
 */
export const measured = {
  dishes: 8,
  medianErrorPct: 28,
  meanSignedErrorPct: 2,
} as const;

export const accuracySection = {
  eyebrow: "Accuracy",
  headline: "A photo is an estimate. So it lets you argue with it.",
  // Lifted out of the body and into the section's opening line. It was the strongest sentence on
  // the page and it was the second half of a mid-paragraph clause in the fifth section.
  intro:
    "**Quiet errors are the ones that cost you the month.** So eait shows its working.",
  body: [
    "The items it saw and the portion it assumed, on screen. Say half that, or set the grams, " +
    "and the verdict is recomputed.",
  ],
  /** His job here is being argued with — the section is about correcting him. */
  mascot: "I would rather be corrected than quietly wrong.",
  proof: {
    label: "What we measured",
    body:
      `On ${measured.dishes} reference dishes with weighed ingredients: median error about ` +
      `${measured.medianErrorPct}%, mean signed error +${measured.meanSignedErrorPct}%. ` +
      `${measured.dishes} dishes is a smoke test rather than a study. We publish it because we ` +
      "could not find another app in this category that does.",
  },
} as const;

export const privacySection = {
  eyebrow: "Privacy",
  headline: "Yours stays yours.",
  facts: [
    {
      title: "Signing in gives us an address. Nothing else does.",
      // Rewritten TWICE, and both times because a sentence here stopped being true of the shipped
      // product. First "there is no address here to leak", the moment a form existed on this page.
      // Then "the app never asks for your email", when sign-in started asking for it (issue #95).
      // The rule this section is built on has not changed: say which half each claim is about,
      // rather than hoping nobody reads both.
      body:
        "**Sign in with Apple or Google hands over an identifier and your email address**: no name, no contacts. We write to it about your account, and it is erased with the account. Without an account there is no address at all.",
    },
    {
      title: "An account only when you want one.",
      body:
        "The app works on a device identity it creates. Sign in for the same history on a second phone.",
    },
    {
      title: "Deletion means deletion.",
      body:
        "**Delete the account and the meals, the profile, the conversation and the product analytics go with it.**",
    },
  ],
} as const;

export const faqSection = { eyebrow: "Questions", headline: "Before you tap." } as const;

export const faqs: readonly Faq[] = [
  {
    q: "What does it cost?",
    a:
      plural(SAMPLE_ANALYSES,
        "Your first analysis costs nothing and needs no card, ",
        `Your first ${SAMPLE_ANALYSES} analyses cost nothing and need no card, `) +
      "then a subscription with a free week. The App Store shows the price in your currency " +
      "before you agree, and you cancel it there.",
  },
  {
    q: "Why isn't it free?",
    a:
      plural(SAMPLE_ANALYSES,
        "Because every analysis after the first runs through a model we pay for, per plate. " +
          "The first one costs you nothing ",
        `Because every analysis after the first ${SAMPLE_ANALYSES} runs through a model we pay ` +
          `for, per plate. Those first ${SAMPLE_ANALYSES} cost you nothing `) +
      "so you can see what it says before deciding.",
  },
  {
    q: "How accurate is it?",
    a:
      `A photo is an estimate: about ${measured.medianErrorPct}% median error on ${measured.dishes} ` +
      "reference dishes, a smoke test rather than a study. Say what it got wrong and the numbers " +
      "and the verdict recompute.",
  },
  {
    q: "Do I have to photograph every meal?",
    a:
      "Every meal you want in the day's total, as a photo or a sentence. The photo is for the plate you cannot guess.",
  },
  {
    q: "What happens when I miss a day?",
    a:
      "Nothing. Each day is judged on its own and the next one starts at zero. No streaks, and Spud does not comment on the gap.",
  },
  {
    q: "Do I have to make an account?",
    a:
      "No. It works on a device identity it creates. Sign in only to keep your history on another phone.",
  },
  {
    q: "Is this medical advice?",
    a:
      "No. It computes targets from what you tell it and scores meals against them. If a clinician gave you numbers, follow those.",
  },
  {
    q: "Does it work outside the United States?",
    a:
      "Yes. It reads the plate instead of a barcode, so an unfamiliar supermarket is fine.",
  },
  {
    q: "Is there an Android version?",
    a:
      "iPhone first. Leave your email and we send one message when it ships.",
  },
];

/**
 * "Keeps nothing" left the sub on 2026-09-06: the first analysis logs a meal, and the refusal two
 * screens up says the photo stays with it. A closing line contradicting the page's own promise is
 * the worst place to be caught out.
 */
export const closing = {
  headline: "One photo. A straight answer. Then dinner.",
  sub:
    `${plural(SAMPLE_ANALYSES, "Your first verdict costs nothing and needs", `Your first ${SAMPLE_ANALYSES} verdicts cost nothing and need`)} no card or account.`,
} as const;

/**
 * The founder line — the one honest proof pre-traction, claiming only my own result.
 * Format validated by the category leader's ad run: `marketing/research/2026-07-26-meta-ad-teardown.md`.
 */
export const founder = {
  line:
    "I built this while cutting to 92 kg. It judges my meals too, and it has told me no more " +
    "often than I would like.",
  by: "Kirill, Berlin",
} as const;

/**
 * The mailing list.
 *
 * The page's hardest sentence to write, because the section three above it now says that signing in
 * DOES give us an address. The copy has to carry the distinction rather than hope nobody notices
 * it: that one belongs to an account, runs it, and is erased with it; this is a list on the
 * website, kept apart from the accounts, that you leave with one click and no login. Neither basis
 * covers the other, which is why no row joins them and why the same address may sit in both.
 *
 * Sold on a specific thing rather than "updates", because "join our newsletter" is a request for a
 * favour and this should be an exchange.
 */
export const subscribeSection = {
  eyebrow: "The mailing list",
  headline: "Hear when the iPhone app ships.",
  body:
    "One address, kept apart from your meals and your account. Confirm it once. Every message carries an unsubscribe link, and an unconfirmed address is deleted within a week.",
  label: "Email address",
  placeholder: "you@example.com",
  button: "I'm in",
  /**
   * Shown by CSS when the address fails the browser's own email check (`:user-invalid`), so the
   * first feedback a typo gets is this sentence rather than the browser's bubble. The example does
   * the explaining; the sentence stays out of the way.
   */
  invalidHint: "That needs to be an email address, like you@example.com.",
  /**
   * The line above each REPEATED ask, mid-page.
   *
   * The page used to ask twice across eight thousand pixels — once in the hero and once at the
   * bottom — so a reader convinced by the refusals, or by the floor, had to scroll past every
   * remaining proof block to act on it. It now asks again after each of the three blocks that do
   * the convincing, with the same field, the same button and the same words: asking more often is
   * not pushier when the ask is one email address, and a different form each time would be.
   */
  bandLine: {
    /** When the ask is the mailing list. */
    form: "Do you like it? We'll invite you.",
    /**
     * When the ask is the store listing or the bot. The form line would be a lie here: nothing on
     * the page is asking for an address in that build, and a band that says so beside a button that
     * opens Telegram is the page describing a product its own button does not open.
     */
    action: "Do you like it? Try it on a real meal right now.",
  },
  /** Under the hero form, where the CTA note used to sit. Short: the full terms are one scroll down. */
  heroNote: "You'll need to verify it.",
  /**
   * The honeypot's visible label. It is hidden from people and read by nothing except a bot that
   * fills every field it finds — which is most of them, and the entire anti-spam story here. A
   * CAPTCHA is a third-party script on a page whose argument is that it loads none.
   */
  honeypotLabel: "Company (leave this empty)",
  note:
    "Deleting an eait account does not remove an address from this list. The two are kept " +
    "apart on purpose, and the unsubscribe link is how you leave.",
  /** The only place the page asks the reader for something, which is exactly Spud's job. */
  mascot: "One message. I will not make a habit of it.",
} as const;

/** The pages the form's redirects land on. Static, no JavaScript, same shell as the page. */
export const outcomes = {
  /** After the CONFIRMATION link, not after the form. That is what makes the title true. */
  subscribed: {
    // The one moment mild happiness is earned — and it is about joining a list, never about food.
    mascot: "happy" as const,
    title: "You are on the list",
    body:
      "One message when the iPhone app is out, and a link in it that removes you in one click. " +
      "Nothing else.",
  },
  /**
   * Where a submission lands. NOT "you are on the list" — nothing is, until the link in the email
   * is followed, and a page that claimed otherwise would be the same lie the capped case used to
   * tell in a nicer font.
   */
  checkYourEmail: {
    mascot: "wave" as const,
    title: "Check your email",
    body:
      "One message is on its way with a link in it. Follow the link and you are on the list; " +
      "ignore it and nothing happens — the address is deleted within a week and you hear nothing.",
  },
  notSubscribed: {
    mascot: "think" as const,
    title: "That did not look like an email address",
    body: "Nothing was saved. Go back and try it again — a typo is the usual reason.",
  },
  /**
   * The refusals that are not the reader's fault: the daily cap, and too many submissions from one
   * network address.
   *
   * This page exists because of a defect. Both of those used to land on `subscribed` — only an
   * invalid address was routed anywhere else — so somebody whose submission was refused was told
   * they were on the list, and the address was simply gone. A bot filling the day's cap in a minute
   * would have turned every real visitor after it into a silent loss, and nothing anywhere would
   * have said so.
   *
   * It does NOT say which of the two happened. A page that distinguishes "the cap is spent" from
   * "you personally are being limited" tells a script exactly how well it is doing.
   */
  tryLater: {
    mascot: "care" as const,
    title: "Not right now — try again shortly",
    body:
      "Nothing was saved, and that one is on us rather than on you. The list takes a limited " +
      "number of addresses each day. Come back in a little while and it will go through.",
  },
  unsubscribed: {
    mascot: "care" as const,
    title: "You are off the list",
    body:
      "The address is gone rather than flagged. If you clicked the link twice, this page says the " +
      "same thing both times, which is deliberate.",
  },
} as const;

export const footer = {
  // "no email address is ever kept" stood here until the red-team pass: quoted alone — and footers
  // get quoted — it was false on its face, on a page carrying three email forms. Then "the app
  // never asks for an email address" went the same way in issue #95, for being false of the app
  // too. A footer sentence has to survive being quoted with nothing around it, so what is left is
  // only what holds on its own.
  note:
    "eait is built in Berlin. Your photos stay with your diary and leave with it, the app works " +
    "without an account at all, and no advertising, cookie or third-party script runs on this page.",
} as const;
