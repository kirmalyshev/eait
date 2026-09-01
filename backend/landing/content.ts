// Every word on the landing page.
//
// The positioning is research, not taste — the rationale lives in `marketing/` (README.md distils
// it), and each section below cites its source. What may not appear here — health, superiority and
// exclusivity claims, unqualified "free" — is enforced by `claims.ts` at build time; the legal
// reasoning is in that file's header and `marketing/DECISIONS.md`.
//
// Citations: verdict-over-counting lead — `marketing/research/2026-07-26-meta-ad-teardown.md` §6
// (angle A2) · billing refusal — `marketing/research/2026-07-28-calai-app-store-review-brief.md`
// §5 and `…-category-billing-crossread.md` · floor section — that brief's §3.4, numbers read from
// `src/shared/targets.ts` · accuracy section — `marketing/research/2026-07-26-ad-angle-bank.md`
// Angle 2.
//
// THE FIRST REFUSAL USED TO SAY THERE WAS NO PAID TIER, AND THE PAID TIER SHIPPED. Three places
// said it — the refusal, the cost question and the closing line — and every one of them became
// false the day `checkCaps` started answering `subscription-required`. The angle survives, because
// the 864-review corpus is about charges nobody agreed to rather than about price: what the product
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

import { FREE_ANALYSES, KCAL_FLOOR, MAX_DEFICIT_SHARE } from "@eait/shared";

/** What an account gets before the app asks. The server's own number, not a sentence about it. */
const SAMPLE_ANALYSES = FREE_ANALYSES;

export interface Refusal {
  /** The promise, phrased as the thing that will not happen. */
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
  tagline: "The meal-verdict app: it answers before it asks.",
} as const;

export const hero = {
  eyebrow: "Photo → numbers → verdict",
  // Angle A2 phrased as the reader's moment, not a thesis — see marketing/README.md.
  headline: "Will this meal fit your day?",
  sub:
    "Photograph the plate. eait reads it — calories, protein, saturated fat, salt — and answers " +
    "against targets computed from your body and your goal. Seconds, no weighing, no database " +
    "search.",
  // The Tier-1 segment, never the restricted-diet reader, and no medication named —
  // `marketing/research/2026-07-26-ad-angle-bank.md` Angle 3; liability: redteam-positioning.md.
  audience:
    "Built for the person who has fought the same few kilos for years. Small deficits have " +
    "small margins, and one guessed dinner can undo a careful week.",
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
    note: "Counted the garlic sauce. Say “no sauce” if there wasn’t any.",
    /**
     * THE ANSWER, IN A SENTENCE — and the thing this card did not have.
     *
     * The eyebrow promises photo → numbers → verdict. The card delivered a photo's numbers and
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
    verdict: "1,140 kcal left — but over a third of your day, and most of your sodium.",
  },
} as const;

/**
 * Who it's for. Row by row: `marketing/research/2026-07-26-ad-angle-bank.md` Angle 3, Angle 1,
 * and `…-market-research.md` §5 (sell the accountability relationship). No outcome promises.
 */
export const forSection = {
  eyebrow: "Who it's for",
  headline: "One question at the table, three people asking it.",
  rows: [
    {
      title: "You've carried the same few kilos for years.",
      body:
        "Not a big cut, which is exactly why it is hard. The smaller the deficit, the smaller " +
        "the margin of error, and **one misjudged meal erases a careful week.** A verdict on every " +
        "meal is a check built for exactly that margin.",
    },
    {
      title: "Logging always died at portions.",
      body:
        "You logged honestly and still guessed the grams. **Portion size is where every food " +
        "diary breaks.** eait reads the plate, shows what it assumed, and you correct it in a " +
        "sentence: “half that”, “no oil”, “that was a small one”.",
    },
    {
      title: "You want someone to answer to.",
      body:
        "A diary writes things down and never says whether they were fine. **Every meal you send " +
        "comes back judged against your day**, which is the part a tracker never gave you, and " +
        "the reason to send the next one.",
    },
  ],
} as const;

export const refusalsSection = {
  eyebrow: "What it will not do",
  headline: "Three refusals, and they are the product.",
} as const;

export const refusals: readonly Refusal[] = [
  {
    title: "It will not ask for a card before it has answered you.",
    body:
      "You open it, answer a few questions about your body, and send a meal — **no account, no " +
      `email, no card.** ${SAMPLE_ANALYSES === 1 ? "That first answer is yours" : `The first ${SAMPLE_ANALYSES} answers are yours`} ` +
      "before anything is asked of you. Only then does it ask, and what it asks for is a " +
      "subscription that opens with a free week, bought through the App Store and cancelled " +
      "there, before a cent moves if you decide against it.",
    proof:
      "In the 864 App Store reviews we read across this category, the biggest complaint, four " +
      "times the size of the next, is a charge nobody agreed to.",
  },
  {
    title: "It will not keep your photo.",
    body:
      "The image is read into memory, analysed, and dropped, on the phone and again on the " +
      "server. **Nothing is written to disk**, there is no bucket, there is no staging folder “just " +
      "for retries”, and no row in any table holds a path to a picture of your food.",
    proof: "Nothing to retain. The photo never exists long enough to need a policy.",
  },
  {
    title: "It will not put your target under the floor.",
    body:
      `${KCAL_FLOOR.female.toLocaleString("en-GB")} kcal for women, ` +
      `${KCAL_FLOOR.male.toLocaleString("en-GB")} for men. Whatever the arithmetic upstream ` +
      "produced, **the number you are given does not go under it**. When the floor is the reason " +
      "your target is what it is, the app says so instead of hiding it.",
    proof: "A daily target is the one output of an app like this that can actually harm someone.",
  },
];

export const stepsSection = {
  eyebrow: "How it works",
  headline: "Three moves. The third is the one that matters.",
} as const;

export const steps: readonly Step[] = [
  {
    ordinal: "01",
    title: "Send the meal.",
    body:
      "A photo of the plate, or a sentence — “chicken shawarma, large”. Both go to the same " +
      "place. **Neither needs you to find your food in a database or weigh anything.**",
  },
  {
    ordinal: "02",
    title: "Read the numbers.",
    body:
      "Calories, protein, carbs, fat, saturated fat, fibre, sugar and sodium — broken out per " +
      "item and totalled, **with what it assumed about each one shown next to it.**",
  },
  {
    ordinal: "03",
    title: "Get the verdict.",
    body:
      "The meal is scored against your targets, on the dimensions that apply to you. Calories " +
      "always. Saturated fat if you said you are watching your LDL. Sodium if you said you are " +
      "watching your kidneys. **Three separate judgements, because one meal can be fine on one and " +
      "not on another.**",
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
 * WHICH THREE, AND WHY NOT THE OTHERS. The set's analyzer frames (`06`–`08`) carry "Demo analyzer —
 * these numbers are canned" in shot, and `06` shows a card that does not match what was typed into
 * it. `docs/RELEASE.md` says all ten were reshot against a real analyzer and none of them carries
 * that line; the committed pixels disagree, and until they are reshot those three cannot appear
 * anywhere a customer looks. These three never reach the analyzer and are honest as they stand.
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
   * NAMED RATHER THAN IMPLIED, because the bar on `06`–`08` is a rule about the SOURCE and `file`
   * cannot carry it: no name in the `app-*.webp` scheme can begin with a digit, so a check written
   * against the asset name passes whatever is put behind it. A test resolves this one on disk.
   */
  source: string;
  width: number;
  height: number;
  title: string;
  body: string;
  alt: string;
}

export const screensSection = {
  eyebrow: "The app",
  headline: "This is the shape of it, in three screens.",
  intro:
    "Photographed from the build that goes to the App Store, not drawn for this page. The iPhone " +
    "app is not out yet; these are it.",
} as const;

export const shots: readonly Shot[] = [
  {
    file: "app-chat.webp",
    source: "03-onboarding.png",
    width: 589,
    height: 1280,
    title: "It asks. You answer.",
    body:
      "One conversation instead of a sign-up form, with **nothing asked of you first**. The " +
      "plan arrives at the end of it, and only then does the asking start.",
    alt:
      "The opening of the eait onboarding chat: Spud introduces himself, says the app " +
      "takes three minutes of questions, and asks the first one.",
  },
  {
    file: "app-plan.webp",
    source: "05-your-target-and-why.png",
    width: 589,
    height: 1280,
    title: "Then it shows the arithmetic.",
    body:
      "Resting burn, the activity on top of it, the adjustment for the pace you chose, and the " +
      "number that falls out. **A target you can check** rather than one handed down. The " +
      "numbers differ from the hero card because the body does.",
    alt:
      "The plan screen: resting burn 1,899 kcal, about 2,943 kcal with activity, minus 550 kcal " +
      "for the chosen pace, and a daily target of 2,393 kcal with a protein figure under it.",
  },
  {
    file: "app-day.webp",
    source: "09-diary.png",
    width: 589,
    height: 1280,
    title: "And the day fills up in front of you.",
    body:
      "Every meal scored against that number as it lands, with **what is left stated in kcal** " +
      "rather than in a ring you have to interpret.",
    alt:
      "The diary screen: 1,168 of 2,393 kcal used today with 1,225 left, and two logged meals " +
      "each carrying its own verdicts.",
  },
];


export const floorSection = {
  eyebrow: "The floor",
  headline: "The one number it will not compute its way past.",
  intro:
    "An app that hands you a daily calorie target is doing the single most consequential thing in " +
    "this category, and the arithmetic that produces it will happily produce a dangerous answer " +
    "for a small person in a hurry. So three guards run, in this order, every time:",
  guards: [
    {
      title: "The deficit is capped at a share of maintenance.",
      body:
        "20% at most, so the number scales with the person rather than with how impatient the " +
        "goal is. A 55 kg woman and a 110 kg man asking for the same pace do not get the same cut.",
    },
    {
      title: "The floor is applied last, and unconditionally.",
      body:
        `${KCAL_FLOOR.female.toLocaleString("en-GB")} kcal for women, ` +
        `${KCAL_FLOOR.male.toLocaleString("en-GB")} for men — the minimums usually cited for ` +
        "dieting without supervision. Applied after the cap, never before: apply the cap second " +
        "and it can pull an already-floored number back under the floor.",
    },
    {
      title: "A target weight under a healthy BMI is refused.",
      body:
        "Refused outright: no warning, no confirmation dialog. Below a BMI of 18.5 the app " +
        "will not set the target at all.",
    },
  ],
  outro:
    "And when the floor is why your number is what it is, the screen says so. " +
    "A guard nobody is told about is a guard that only protects the people who were " +
    "never at risk.",
  /**
   * What Spud says here. Same job as in the app: name the refusal, and why.
   *
   * HE INTRODUCES HIMSELF, because this is the first time a reader meets him and the page never
   * told anyone who he was. An unnamed cartoon potato beside a paragraph about calorie floors reads
   * as a stray sticker; the app's own first line is "Hi, I'm Spud", and the screenshots two
   * sections above this one now show him doing exactly this job inside the product.
   */
  mascot:
    "I'm Spud. This is the bit where I tell you no — it is the only thing I am strict about.",
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

/**
 * The four numbers, pulled out of the prose and set large.
 *
 * Every one of them is already argued further down the page, in a sentence, in body copy — which is
 * the problem this answers. The load-bearing facts of the product were the least visible thing on
 * it, and a reader who scrolls rather than reads left with none of them.
 *
 * READ FROM THE CODE, never typed. `KCAL_FLOOR` and `MAX_DEFICIT_SHARE` come from
 * `src/shared/targets.ts`, and the error figure from `measured`, which a test reconciles against
 * `docs/ACCURACY.md`. The repo's rule is that a number quoted in public copy is read from the code
 * that produces it, and a band of large numbers is the worst place to start breaking it.
 */
export const figuresSection = {
  eyebrow: "In numbers",
  headline: "Four figures the rest of this page is about.",
} as const;

export const figures = [
  {
    // ONE NUMBER IN THE FIGURE, BOTH IN THE LABEL. "1,200 / 1,500" is thirteen monospaced
    // characters and does not fit a quarter of the wrapper at this size — it wrapped after the
    // slash and read as a mistake. Shrinking the type to fit would have shrunk all four.
    value: KCAL_FLOOR.female.toLocaleString("en-GB"),
    unit: "kcal floor, women",
    label:
      `${KCAL_FLOOR.male.toLocaleString("en-GB")} for men. No arithmetic upstream gets a target ` +
      "under either of them.",
  },
  {
    value: `${Math.round(MAX_DEFICIT_SHARE * 100)}%`,
    unit: "of maintenance",
    label: "The deepest cut it will compute, whatever pace was asked for.",
  },
  {
    value: "0",
    unit: "photos kept",
    label: "Read into memory, analysed, dropped. On the phone and again on the server.",
  },
  {
    value: `${measured.medianErrorPct}%`,
    unit: `median error, ${measured.dishes} dishes`,
    label: "Published because we could not find another app that does. A smoke test, and we say so.",
  },
] as const;

export const accuracySection = {
  eyebrow: "Accuracy",
  headline: "A photo is an estimate. So it lets you argue with it.",
  // Lifted out of the body and into the section's opening line. It was the strongest sentence on
  // the page and it was the second half of a mid-paragraph clause in the fifth section.
  intro:
    "Nobody can weigh your lunch from a picture. An app that behaves as though it can is going to " +
    "be wrong quietly, and **quietly wrong is the failure mode that costs you the month.**",
  body: [
    "So eait shows its working: the items it thinks it saw, and what it assumed about each. When " +
    "it has that wrong, say so in ordinary words — “half that”, “no oil”, “that is a small one” — " +
    "or open the item and set the grams yourself. Change one item and its calories rescale by its " +
    "own density, the totals re-sum, and the verdict is recomputed from your targets.",
    "That last part is not a detail. A verdict is never carried over from the numbers it was " +
    "first computed on, so it can never describe a meal that has since changed.",
  ],
  /** His job here is being argued with — the section is about correcting him. */
  mascot: "I would rather be corrected than quietly wrong.",
  proof: {
    label: "What we measured",
    body:
      `On ${measured.dishes} reference dishes with weighed ingredients, the median error was ` +
      `about ${measured.medianErrorPct}%, and the mean signed error was ` +
      `+${measured.meanSignedErrorPct}%, so it is not quietly flattering you. ` +
      `${measured.dishes} dishes is a smoke test rather than a study, and saying so is the point: ` +
      "we could not find another app in this category that publishes a number at all. Most of " +
      "what is left is portion size, " +
      "which is the one thing a sentence can fix.",
  },
} as const;

export const privacySection = {
  eyebrow: "Privacy",
  headline: "What it never has in the first place.",
  facts: [
    {
      title: "The app never asks for your email.",
      // Rewritten when the list below was added, because the old sentence — "there is no address
      // here to leak" — stopped being true of the whole product the moment there was a form on
      // this page. It is still true of the APP, which is the part that holds your meals, and the
      // honest version says which is which rather than hoping nobody reads both sections.
      body:
        "**Sign in with Apple asks for no email scope at all**, and whatever a provider volunteers in " +
        "its token is discarded before anything is written. The account key is the anonymous " +
        "subject identifier and nothing else. If you give us an address on this website, it lives " +
        "on a list that touches none of that, and one click removes it.",
    },
    {
      title: "No photographs.",
      body: "**Read, analysed, dropped.** Both ends. There is nothing to leak and nothing to request.",
    },
    {
      title: "No account, until you want one.",
      body:
        "The app works on a device identity it creates for itself. Sign in only if you want the " +
        "same history on a second phone; and when you do, what you already logged comes with you.",
    },
    {
      title: "Deletion means deletion.",
      body:
        "**Delete the account, and the meals, the profile, the conversation and the product analytics go with it.** The " +
        "analytics being in that list costs us the ability to measure anything historical. That " +
        "was the trade we chose.",
    },
  ],
} as const;

export const faqSection = { eyebrow: "Questions", headline: "Before you tap." } as const;

export const faqs: readonly Faq[] = [
  {
    q: "What does it cost?",
    a:
      "Your first analysis costs nothing and needs no card, so you can see what it actually says " +
      "about your food before deciding anything. After that it is a subscription, with a free " +
      "week before the first charge. It is bought in the App Store, which shows you the price in " +
      "your own currency before you agree, and cancelled in the same place: Settings, your name, " +
      "Subscriptions. There is no charge that appears without you having agreed to it.",
  },
  {
    q: "Do I have to make an account?",
    a:
      "No. The app creates a device identity for itself and works immediately. Sign in with Apple " +
      "or Google only if you want your history on another device.",
  },
  {
    q: "Is this medical advice?",
    a:
      "No. It computes targets from what you tell it about your body and scores meals against " +
      "them. It is not supervision and it does not replace a clinician. If you have been given " +
      "numbers by one, those are the numbers to follow.",
  },
  {
    q: "Does it work outside the United States?",
    a:
      "It reads what is on the plate rather than looking up a barcode in a product database, so " +
      "an unfamiliar supermarket is not a wall. Portions and dishes are estimated the same way " +
      "everywhere, which is to say approximately and correctably.",
  },
  {
    q: "Is there an Android version?",
    a:
      "Not yet: iPhone first, Android after it has proved itself there. Leave an email on this " +
      "page and you will hear the day the iPhone app ships.",
  },
];

export const closing = {
  headline: "One photo. Then an answer you can act on.",
  sub: "Seeing it work costs nothing and identifies nobody, and nothing is kept afterwards. Find out whether you like it before you pay for it or tell it who you are.",
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
 * The page's hardest sentence to write, because the section three above it says we never store an
 * email address. Both are true and the copy has to carry the distinction rather than hope nobody
 * notices it: the APP never asks for one and cannot reach one; this is a list on the website, kept
 * apart from the accounts, that you leave with one click and no login.
 *
 * Sold on a specific thing rather than "updates", because "join our newsletter" is a request for a
 * favour and this should be an exchange.
 */
export const subscribeSection = {
  eyebrow: "If not today",
  headline: "Hear when the iPhone app is out.",
  body:
    "One address, on a list that lives on this website and nowhere near your meals. It is not " +
    "connected to an account, it is not used for anything else, and every message carries a link " +
    "that removes you in one click with no login and no questions. You will get one email asking " +
    "you to confirm; until you do, the address is on no list at all, and if you never do it is " +
    "deleted within a week.",
  label: "Email address",
  placeholder: "you@example.com",
  button: "Tell me when it ships",
  /**
   * Shown by CSS when the address fails the browser's own email check (`:user-invalid`), so the
   * first feedback a typo gets is this sentence rather than the browser's bubble. The example does
   * the explaining; the sentence stays out of the way.
   */
  invalidHint: "That needs to be an email address — like you@example.com.",
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
    form:
      "Convinced by that bit? The deal: one address now, one email the day it ships, and the " +
      "app answers you before it asks anything of you.",
    /**
     * When the ask is the store listing or the bot. The form line would be a lie here: nothing on
     * the page is asking for an address in that build, and a band that says so beside a button that
     * opens Telegram is the page describing a product its own button does not open.
     */
    action: "Convinced by that bit? You can try it on a real meal right now.",
  },
  /** Under the hero form, where the CTA note used to sit. Short: the full terms are one scroll down. */
  heroNote:
    "One email when the iPhone app is out, a confirmation click first, and a one-click way off " +
    "the list. Nothing else.",
  /**
   * The honeypot's visible label. It is hidden from people and read by nothing except a bot that
   * fills every field it finds — which is most of them, and the entire anti-spam story here. A
   * CAPTCHA is a third-party script on a page whose argument is that it loads none.
   */
  honeypotLabel: "Company (leave this empty)",
  note:
    "Deleting an eait account does not remove an address from this list; they are separate " +
    "things, deliberately, and the unsubscribe link is how you leave.",
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
  // get quoted — it was false on its face, on a page carrying three email forms. The one sentence
  // that dropped the app-vs-website distinction the privacy section is built on.
  note:
    "eait is built in Berlin. No photo is stored, the app never asks for an email address, and no " +
    "advertising, cookie or third-party script runs on this page.",
} as const;
