// Every word on the landing page.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// WHERE THE POSITIONING COMES FROM
//
// Not from taste. `../eait-marketer/docs/research/` is a year of adversarial market work and this
// file is its output, section by section:
//
//   • The lead — judgement rather than measurement — is angle A2 in
//     `2026-07-26-meta-ad-teardown.md` §6: every advertiser in a 163-ad scrape sells *counting*
//     ("track", "log", "instant breakdown"); none sells *a verdict*. It is the one piece of
//     language in the category nobody had occupied. It is also, unlike a feature list, true of
//     this product specifically — `verdictsFromTargets` runs after every write.
//
//   • "It won't ask for a card" is angle 7 in `2026-07-28-calai-app-store-review-brief.md` §5:
//     the largest complaint cluster in an 864-review corpus, four times the size of the accuracy
//     cluster, and `2026-07-28-category-billing-crossread.md` shows it is a category tax rather
//     than one vendor's mistake — 15% to 48% of low-star reviews across seven apps. It is a
//     structural property of a product with no card gate, not a claim about one.
//
//   • The floor section exists because that brief's §3.4 carries a standing instruction: do not
//     go near unsafe-target territory until our own goal-setting has a documented floor. It now
//     has one — `src/shared/targets.ts`, `KCAL_FLOOR` — and every number quoted here is read off
//     that file rather than written twice. A test asserts they still agree.
//
//   • The accuracy section is angle 2 of `2026-07-26-ad-angle-bank.md`, which is flagged there as
//     double-edged: it may only be run by a product whose answer to "the photo was wrong" is real.
//     Ours is the correction loop, so the section describes the loop and never claims a number.
//
// WHAT MAY NOT APPEAR HERE
//
//   • Health claims. `claims.ts` fails the build on them. FTC substantiation is per claim, and EU
//     Reg 1924/2006 treats marketing copy about food like a product label.
//   • Superiority or exclusivity claims — "the only", "better than", "every other app". That is an
//     Alleinstellungsbehauptung under §5 UWG, actionable by any competitor, and
//     `eait-marketer/DECISIONS.md` (2026-07-26) already retired one caption for exactly this.
//   • Unqualified "free". Same DECISIONS entry: posted copy outlives the pricing that made it true.
//     What is written instead is a fact with a date on it — there is no paid tier and no card.
// ─────────────────────────────────────────────────────────────────────────────────────────────

import { KCAL_FLOOR } from "@ieat/shared";

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
  /** Used as the document title and the og:title. Kept under 60 characters for search results. */
  title: "eait — a number is not an answer",
  tagline: "Photograph the meal. Get the numbers, and a verdict on them.",
} as const;

export const hero = {
  eyebrow: "Photo → numbers → verdict",
  headline: "A number is not an answer.",
  // Deliberately not phrased against a competitor. "Every other app tells you it was 640 calories"
  // is the sharper sentence and it is the one in the teardown, but on a domain we own it is a
  // comparative claim about products we have not measured — see the header of this file.
  sub:
    "640 calories is a fact, not a decision. eait scores each meal against targets computed from " +
    "your body, your goal and whatever you said you have to watch, then tells you what it made " +
    "of it.",
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
  },
} as const;

export const refusalsSection = {
  eyebrow: "What it will not do",
  headline: "Three refusals, and they are the product.",
} as const;

export const refusals: readonly Refusal[] = [
  {
    title: "It will not ask for a card.",
    body:
      "There is no trial to start and none to forget to cancel. You open it, answer a few " +
      "questions about your body, and send a meal. There is no paid tier today and no card on " +
      "file, so there is nothing that can quietly begin charging one.",
    proof: "The largest complaint in this category, by a factor of four, is a charge nobody agreed to.",
  },
  {
    title: "It will not keep your photo.",
    body:
      "The image is read into memory, analysed, and dropped — on the phone and again on the " +
      "server. Nothing is written to a disk, there is no bucket, there is no staging folder “just " +
      "for retries”, and no row in any table holds a path to a picture of your food.",
    proof: "Ephemeral by construction, not by retention policy. A policy is a promise; this is an absence.",
  },
  {
    title: "It will not put your target under the floor.",
    body:
      `${KCAL_FLOOR.female.toLocaleString("en-GB")} kcal for women, ` +
      `${KCAL_FLOOR.male.toLocaleString("en-GB")} for men. Whatever the arithmetic upstream ` +
      "produced, the number you are given does not go under it — and when the floor is the reason " +
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
      "place. Neither needs you to find your food in a database or weigh anything.",
  },
  {
    ordinal: "02",
    title: "Read the numbers.",
    body:
      "Calories, protein, carbs, fat, saturated fat, fibre, sugar and sodium — broken out per " +
      "item and totalled, with what it assumed about each one shown next to it.",
  },
  {
    ordinal: "03",
    title: "Get the verdict.",
    body:
      "The meal is scored against your targets, on the dimensions that apply to you. Calories " +
      "always. Saturated fat if you said you are watching your LDL. Sodium if you said you are " +
      "watching your kidneys. Three separate judgements, because one meal can be fine on one and " +
      "not on another.",
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
        `${KCAL_FLOOR.male.toLocaleString("en-GB")} for men — the widely published minimums for ` +
        "dieting without supervision. Applied after the cap, never before, because a cap applied " +
        "second can pull a floored number back under the floor.",
    },
    {
      title: "A target weight under a healthy BMI is refused.",
      body:
        "Not warned about, not confirmed with a dialog — refused. Below a BMI of 18.5 the app " +
        "will not set the target at all.",
    },
  ],
  outro:
    "And when the floor is why your number is what it is, the screen that shows you the number " +
    "says so. A guard nobody is told about is a guard that only protects the people who were " +
    "never at risk.",
  /** What Spud says here. Same job as in the app: name the refusal, and why. */
  mascot: "This is the bit where I tell you no. It is the only thing I am strict about.",
} as const;

/**
 * The measured numbers, from `docs/ACCURACY.md` (run of 2026-08-01, `x-ai/grok-4.5`).
 *
 * Published because the category's actual credibility problem is that nobody publishes anything —
 * the vendor claims are uncited "90%+" and the counter-claims come from competitor blogs that rank
 * for "<leader> review" in order to sell an alternative. A real number with its sample size beside
 * it is worth more than a better number without one.
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
    "Nobody can weigh your lunch from a picture. An app that behaves as though it can is going to " +
    "be wrong quietly — and quietly wrong is the failure mode that costs you the month.",
  body: [
    "So eait shows its working: the items it thinks it saw, and what it assumed about each. When " +
    "it has that wrong, say so in ordinary words — “half that”, “no oil”, “that is a small one” — " +
    "or open the item and set the grams yourself. Change one item and its calories rescale by its " +
    "own density, the totals re-sum, and the verdict is recomputed from your targets.",
    "That last part is not a detail. A verdict is never carried over from the numbers it was " +
    "first computed on, so it can never describe a meal that has since changed.",
  ],
  proof: {
    label: "What we measured",
    body:
      `On ${measured.dishes} reference dishes with weighed ingredients, the median error was ` +
      `about ${measured.medianErrorPct}%, and the mean signed error was ` +
      `+${measured.meanSignedErrorPct}% — so it is not quietly flattering you. ` +
      `${measured.dishes} dishes is a smoke test rather than a study, and saying so is the point: ` +
      "nobody in this category publishes a number at all. Most of what is left is portion size, " +
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
        "Sign in with Apple asks for no email scope at all, and whatever a provider volunteers in " +
        "its token is discarded before anything is written. The account key is the anonymous " +
        "subject identifier and nothing else. If you give us an address on this website it lives " +
        "on a list that touches none of that, and one click removes it.",
    },
    {
      title: "No photographs.",
      body: "Read, analysed, dropped. Both ends. There is nothing to leak and nothing to request.",
    },
    {
      title: "No account, until you want one.",
      body:
        "The app works on a device identity it creates for itself. Sign in only if you want the " +
        "same history on a second phone — and when you do, what you already logged comes with you.",
    },
    {
      title: "Deletion means deletion.",
      body:
        "Delete the account and the meals, the profile and the product analytics go with it. The " +
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
      "There is no paid tier today and no card on file. If that ever changes it will be a thing " +
      "you decide to do, not a charge that appears because a trial you forgot about ended.",
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
      "It reads what is on the plate rather than looking a barcode up in a product database, so " +
      "an unfamiliar supermarket is not a wall. Portions and dishes are estimated the same way " +
      "everywhere — which is to say approximately, and correctably.",
  },
  {
    q: "Is there an Android version?",
    a:
      "Neither app is out yet — iPhone first, Android after it has proved itself there. The " +
      "Telegram bot works on anything that runs Telegram, Android included.",
  },
];

export const closing = {
  headline: "One photo. Then an answer you can act on.",
  sub: "No card, nothing to cancel, and nothing kept afterwards. Find out whether you like it before you tell it anything about yourself.",
} as const;

/**
 * The founder line.
 *
 * The one proof this product can honestly offer today: there are no users to count, no
 * testimonials, and no revenue. Founder-face is also the format the category's leader ran for 104
 * days straight, so it is competitor-validated rather than a guess.
 *
 * It is true, it is checkable against nothing, and it makes no claim about anyone's results but
 * mine — which is what keeps it out of the territory `claims.ts` exists to police.
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
    "you to confirm — until you do, the address is on no list at all, and if you never do it is " +
    "deleted within a week.",
  label: "Email address",
  placeholder: "you@example.com",
  button: "Tell me when it ships",
  /**
   * The honeypot's visible label. It is hidden from people and read by nothing except a bot that
   * fills every field it finds — which is most of them, and the entire anti-spam story here. A
   * CAPTCHA is a third-party script on a page whose argument is that it loads none.
   */
  honeypotLabel: "Company (leave this empty)",
  note:
    "Deleting an ieat account does not remove an address from this list — they are separate " +
    "things, deliberately, and the unsubscribe link is how you leave.",
  /** The only place the page asks the reader for something, which is exactly Spud's job. */
  mascot: "One message. I will not make a habit of it.",
} as const;

/** The pages the form's redirects land on. Static, no JavaScript, same shell as the page. */
export const outcomes = {
  /** After the CONFIRMATION link, not after the form. That is what makes the title true. */
  subscribed: {
    mascot: "wave" as const,
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
  note:
    "eait is built in Berlin. Photos are never stored, no email address is ever kept, and there " +
    "is no advertising, no cookie and no third-party script on this page.",
} as const;
