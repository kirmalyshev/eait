// The words around the questions, in every language the product speaks.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// WHY THIS IS ONE TABLE PER LANGUAGE RATHER THAN A TABLE PER SENTENCE
//
// `onboarding-chat.ts` holds the BRANCHES — which caption a first struggle writes, which marker
// the pace card owes, when a two-digit age is ambiguous. Those are rules, they are tested, and a
// translator has no business moving them. What a translator does have business with is the
// wording of each branch once it has been chosen, and that is what is here.
//
// ONE OBJECT PER LANGUAGE, because a voice is a property of the whole side of a conversation and
// not of a string: somebody writing the Vietnamese should see the five captions, the two refusals
// and the chart's accessible name together, in one place, and hear whether they sound like one
// person. Eight separate `Localized` tables would be the same words and a worse review.
//
// v2 (#82) RETIRED the conversation layer the boards no longer draw: the per-answer reactions, the
// goal cards and their citations, the support moments, the quick-reply dock and the replies that
// read the previous answer. What survives is the talk the new screens still need — the refusals,
// the chart words, the on-track captions — plus the beats that were never copy to begin with.
//
// THE PERCENTAGES THAT COME FROM CODE STAY COMING FROM CODE. `{share}` is filled from
// `MAX_SURPLUS_SHARE`, `{age}` from `MIN_AGE`, `{floor}` from the computed floor, in every
// language, because a safety guarantee described in copy that the arithmetic does not implement
// is the worst sentence this repo could ship — and the way that happens is somebody changing a
// constant and not eight prose strings.
// ─────────────────────────────────────────────────────────────────────────────────────────────

import { t, type CountForms, type Localized } from "./lang.ts";
import { FIRST_MEAL_COPY, type FirstMealCopy } from "./first-meal-copy.ts";
import type { Lang } from "./types.ts";

/** A card's words; `source` names the study when one is quoted. Mirrors `SupportCard`. */
export interface CardCopy {
  title: string;
  body: string;
  source?: string;
}


/** Everything Spud says back, for one language. Branching stays in `onboarding-chat.ts`. */
export interface ChatCopy {
  idlePlaceholder: string;
  /** The one button under every screen that answers something. */
  continueLabel: string;
  /** A failed answer save: the answer is still on screen, Continue sends it again. */
  saveKept: string;
  /** `{age}` from `MIN_AGE`. */
  underAgeCard: CardCopy;
  underAge: { ask: string; confirm: string; placeholder: string; stopped: string[]; endedPlaceholder: string };
  /** `{kg}` is the lowest healthy weight for this height. */
  belowHealthy: CardCopy;
  invalid: { age: string; height_cm: string; weight_kg: string; target_weight_kg: string };
  /** `{year}` is the year the digits would mean; `{age}` the age they would mean. */
  ambiguousAge: { line: string; confirm: string };
  /** `{weight}` and `{target}` are the two numbers that disagree. */
  direction: {
    gain: string; lose: string;
    switchToLose: string; switchToGain: string;
    above: string; below: string;
  };
  switched: { gain: string; lose: string };
  /** `{kg}` a week, appended to the share-cap note when there is a rate to name. */
  capNoteTail: string;
  goalEdit: { cleared: string; worthSetting: string };
  /**
   * The target ruler's own markers. `{weight}` is a formatted weight WITH unit (weightDisplay);
   * the sign's role is carried by picking down/up, because "−" is U+2212, not a hyphen.
   */
  target: { lowest: string; now: string; nowLowest: string; deltaDown: string; deltaUp: string };
  /**
   * The pace screen's numbers and the marker its result owes. `{rate}` is the projection's
   * kgPerWeek formatted with its unit ("0.4kg" / "0.9lb") — never the pace's requested rate;
   * `{floor}` is the computed floor. `capMarker`/`floorMarker` are the one small line under it.
   */
  pace: {
    rate: string;
    /** The words after the rate figure alone — "a week", said without the number. */
    rateSuffix: string;
    /** `{target}` with unit, `{month}` CLDR's, `{kcal}` the computed number. */
    result: string;
    capMarker: string;
    floorMarker: string;
    /** The answer echo above the pace pick (#1693): the user's own two weights, no verdict. */
    echo: string;
  };
  /**
   * The unit word beside a wheel's or ruler's big numeral — "32 years". The symbol units (cm,
   * kg, lb, ft, in) are `spellUnit`'s and stay symbols; only the words with no symbol live here.
   * `yearsCount` is the same word as a whole counted template — the age wheel's rows, where
   * Russian declines it per number ("32 года" beside "35 лет") and one flat word is wrong.
   */
  units: { years: string; yearsCount: CountForms };
  /**
   * The two beats inside the questions, neither of which asks anything. `baseline` prints the BMI
   * the typed height and weight compute on a neutral bar: the range labels are boundaries, never
   * category words, and `what` is the whole explanation — "Body mass index" (Kirill, 24 Oct:
   * nothing else). `prelim` is the mid-journey plan as two rows — "You burn ≈{burn}" → "You eat
   * {plan}", the gap labelled "your pace"; `keepTitle` is the maintainer's whole headline and
   * `{delta}` the signed gap between burn and plan.
   */
  baseline: {
    title: string; bmi: string; what: string;
    bands: { under: string; healthy: string; over: string; obese: string };
  };
  prelim: {
    title: string; burn: string; gap: string; eat: string; perDay: string; keepTitle: string;
  };
  /** Under the age question (05, ieat-app#2050): why it is asked. */
  ageWhy: string;
  /**
   * The answers said back as numbers, on the screens that follow them (polish §8, §10): the
   * weight's burn under the activity question, the days' burn under the target. `{rest}` and
   * `{burn}` are computed kcal, never typed.
   */
  echo: { rest: string; days: string };
  /**
   * The chart words, shared by every chart the app draws — onboarding's two-ways beat, the plan
   * graph, Progress. DIRECTION's verbatim chart table; `{weight}`/`{month}` filled by the caller.
   * `twoWays` is the chart's accessible NAME (VoiceOver/a11y), read where the pixels are not.
   */
  chart: {
    byEait: string;
    weightTrend: string;
    without: string;
    now: string;
    later: string;
    twoWays: string;
    estimatedProgress: string;
    estimate: string;
    target: string;
    monthEstimate: string;
    /**
     * The estimate graph's accessible NAME (board `15-plan`): "{from} now, {to} around {month}"
     * — the chart's two real ends and the month projectGoal lands on, as one whole template so a
     * language can order it its own way. A graphic nobody can see still owes its sentence.
     */
    estimateAria: string;
  };
  /** The plan card's goal line: `{delta}` is the formatted distance, `{month}` CLDR's landing. */
  plan: {
    goalLose: string; goalGain: string; goalMaintain: string;
    /** The arithmetic rows the plan page draws — the composition, not admin words. */
    rest: string; activity: string; pace: string; floor: string; protein: string;
  };
  /**
   * The post-sign-up sync screen (17-health-sync): title and one line. Its ONE button is
   * `continueLabel` — App Review 5.1.1(iv): a screen ahead of the HealthKit sheet offers no
   * "Not now", and the sheet itself is the only place the request can be declined.
   */
  health: { title: string; body: string };
  /**
   * The target prompt's suggestion line: `{weight}` the suggested weight written the way the
   * reader's toggle spells it (`weightDisplay` — "73.5kg" or "162lb"), `{pct}` the whole percent
   * away from today. `down` for lose, `up` for gain; `maintain` is never asked a target.
   */
  targetSuggestion: { down: string; up: string };
  /**
   * After the plan (v5): the one meal on us, its verdict, and the ask after it. `ask`/`react` are
   * Spud's; `photo`/`tell` the two buttons that start it; `afterAsk` the line over the offer that
   * holds. The web renders an UPLOAD rather than a camera and keeps `photo` for the phone.
   */
  firstMeal: FirstMealCopy;
  /** The target stepper: the button under it, and the SPOKEN labels of its − and + (VoiceOver). */
  stepper: { continue: string; less: string; more: string };
  /** The soft offer's title: `{kg}` the target, `{month}` CLDR's month and year. `offerHeadline`. */
  offerHeadline: string;
  /**
   * The plan headline over the progress graph (S6; board `15-plan`): `{n}` the amount to lose in
   * the reader's units, `{month}` the month `projectGoal` lands on, year included. `planHeadline`.
   * The unit word is part of the sentence and not a symbol beside it, so `metric` and `imperial`
   * are two whole templates. This is the ONE field the claims gate exempts from `weight-promise`
   * — `CLAIM_EXEMPTIONS` in `claims.ts` names it — and it is a promise the plan makes about a
   * goal the user already stated, computed, never written by hand.
   */
  planGoal: { metric: string; imperial: string };
}

const EN: ChatCopy = {
  idlePlaceholder:  "Message Spud…",
  continueLabel: "Continue",
  saveKept: "Couldn't save that. Your answer is still here. Continue sends it again.",
  underAgeCard:  {
    title: "eait is for {age} and over",
    body: "The way this app sets calorie targets is not designed for a body that is still growing.",
  },
  underAge:  {
    ask: "Sorry — I have to stop here. If a typo got us here, just send your real age.",
    confirm: "That's my real age",
    placeholder: "Your age",
    stopped: [
      "Then this is where we stop. I'm deleting everything you told me.",
      "Come back at {age} and I'll be around.",
    ],
    endedPlaceholder: "eait is for {age} and over",
  },
  belowHealthy:  {
    title: "I can't set that as a target",
    body: "The lowest healthy weight for your height is about {kg}kg. We won't set a goal below it. If you're working with a doctor on something different, follow them rather than this app.",
  },
  invalid:  {
    age: "That doesn't look like an age — try something like 34.",
    height_cm: "In centimetres — something like 175.",
    weight_kg: "In kilograms — roughly is fine.",
    target_weight_kg: "A number in kg — like 70.",
  },
  ambiguousAge:  {
    line: "Want to be sure I read that right — if you meant the year {year}, send all four digits.",
    confirm: "I'm {age}",
  },
  direction:  {
    gain: "You're at {weight}kg and asked to gain to {target} — that's not a gain from here. If the goal changed, we can switch it; otherwise give me a number above {weight}.",
    lose: "You're at {weight}kg and asked to lose to {target} — that's not a loss from here. If the goal changed, we can switch it; otherwise give me a number below {weight}.",
    switchToLose: "Switch to losing",
    switchToGain: "Switch to gaining",
    above: "A number above {weight}…",
    below: "A number below {weight}…",
  },
  switched:  {
    gain: "Switched — gaining it is. Where would you like to be, in kg?",
    lose: "Switched — losing it is. Where would you like to be, in kg? Faster isn't better here — it's just harder to keep.",
  },
  capNoteTail:  " That's about {kg}kg a week.",
  goalEdit:  {
    cleared: "Your target weight no longer fitted that goal, so it's cleared — set a new one.",
    worthSetting: "Recorded. Your target weight no longer fits your goal, though — worth setting a new one.",
  },
  target: {
    // "55 · lowest we set" under the range's floor, "74 · now" beside today, "− 6kg" the
    // answer's distance from it.
    lowest: "{weight} · lowest we set",
    now: "{weight} · now",
    nowLowest: "{weight} · now · lowest we set",
    deltaDown: "− {weight}",
    deltaUp: "+ {weight}",
  },
  pace: {
    rate: "{rate} a week",
    rateSuffix: "a week",
    result: "{target} around {month} · {kcal}kcal a day",
    capMarker: "capped at the safe limit",
    floorMarker: "never below {floor} · every pace lands here",
    echo: "From {from} to {to}.",
  },
  units: { years: "years", yearsCount: { one: "{n} year", other: "{n} years" } },
  baseline: {
    title: "Where you're starting",
    bmi: "BMI",
    what: "Body mass index",
    bands: { under: "below 18.5", healthy: "18.5–24.9", over: "25–29.9", obese: "30 and above" },
  },
  prelim: {
    title: "Your plan",
    burn: "You burn",
    gap: "{delta} your pace",
    eat: "You eat",
    perDay: "kcal a day",
    keepTitle: "You burn about {burn}kcal",
  },
  ageWhy: "Your metabolism changes with age, so we factor that in",
  echo: {
    rest: "At rest: {rest}kcal a day",
    days: "Your days burn {burn}kcal",
  },
  chart: {
    byEait: "with eait",
    weightTrend: "Weight trend",
    without: "Without",
    now: "Now",
    later: "Later",
    twoWays: "Weight over time, drawn two ways: with a plan and without",
    estimatedProgress: "Estimated progress",
    estimate: "Estimate",
    target: "Target {weight}",
        monthEstimate: "{month} · estimate",
    estimateAria: "Estimated weight: {from} now, {to} around {month}",
  },
  plan: {
    goalLose: "Goal: lose {delta} by {month}",
    goalGain: "Goal: gain {delta} by {month}",
    goalMaintain: "Goal: keep my weight",
    rest: "Your body at rest burns", activity: "With your activity, about", pace: "For your pace, we adjust", floor: "The floor we won’t cross", protein: "Protein to aim for",
  },
  health: {
    title: "Sync with Apple Health",
    body: "Weight and activity come in. Your meals go to Health.",
  },
  targetSuggestion:  {
    down: "I suggest {weight}, about {pct}% down, a good first goal",
    up: "I suggest {weight}, about {pct}% up, a good first goal",
  },
  firstMeal:  FIRST_MEAL_COPY.en,
  stepper:  { continue: "Continue", less: "Less", more: "More" },
  offerHeadline:  "Get to {kg}kg by {month}",
  planGoal: { metric: "Goal: lose {n}kg by {month}", imperial: "Goal: lose {n} lbs by {month}" },
};

const FR: ChatCopy = {
  idlePlaceholder:  "Écrire à Spud…",
  continueLabel: "Continuer",
  saveKept: "Impossible d'enregistrer. Ta réponse est toujours là. Continuer l'envoie à nouveau.",
  underAgeCard:  {
    title: "eait, c'est à partir de {age} ans",
    body: "La façon dont cette app fixe les objectifs caloriques n'est pas conçue pour un corps qui grandit encore.",
  },
  underAge:  {
    ask: "Désolé — je dois m'arrêter là. Si c'est une faute de frappe, envoie-moi ton vrai âge.",
    confirm: "C'est mon vrai âge",
    placeholder: "Ton âge",
    stopped: [
      "Alors on s'arrête ici. J'efface tout ce que tu m'as dit.",
      "Reviens à {age} ans, je serai là.",
    ],
    endedPlaceholder: "eait, c'est à partir de {age} ans",
  },
  belowHealthy:  {
    title: "Je ne peux pas fixer ça comme objectif",
    body: "Le poids sain le plus bas pour ta taille est d'environ {kg}kg. On ne fixera pas d'objectif en dessous. Si tu suis un autre objectif avec un médecin, écoute-le plutôt que cette appli.",
  },
  invalid:  {
    age: "Ça ne ressemble pas à un âge — essaie quelque chose comme 34.",
    height_cm: "En centimètres — quelque chose comme 175.",
    weight_kg: "En kilos — à peu près, ça suffit.",
    target_weight_kg: "Un nombre en kg — comme 70.",
  },
  ambiguousAge:  {
    line: "Je veux être sûr d'avoir bien lu — si tu voulais dire l'année {year}, envoie les quatre chiffres.",
    confirm: "J'ai {age} ans",
  },
  direction:  {
    gain: "Tu es à {weight}kg et tu demandes à monter jusqu'à {target} — ce n'est pas une hausse par rapport à aujourd'hui. Si ton objectif a changé, on peut le modifier ; sinon, donne-moi un nombre au-dessus de {weight}.",
    lose: "Tu es à {weight}kg et tu demandes à descendre jusqu'à {target} — ce n'est pas une baisse par rapport à aujourd'hui. Si ton objectif a changé, on peut le modifier ; sinon, donne-moi un nombre en dessous de {weight}.",
    switchToLose: "Je veux perdre du poids",
    switchToGain: "Je veux prendre du poids",
    above: "Un nombre au-dessus de {weight}…",
    below: "Un nombre en dessous de {weight}…",
  },
  switched:  {
    gain: "Va pour la prise de poids. Où aimerais-tu arriver, en kg ?",
    lose: "D'accord, on vise plus bas. Où aimerais-tu arriver, en kg ? Ici, aller plus vite n'aide pas — c'est juste plus dur à tenir.",
  },
  capNoteTail:  " Ça fait environ {kg}kg par semaine.",
  goalEdit:  {
    cleared: "Ton poids cible ne collait plus à cet objectif, il est donc effacé — choisis-en un nouveau.",
    worthSetting: "Enregistré. Ton poids cible ne colle plus à ton objectif, cela dit — ça vaut le coup d'en fixer un nouveau.",
  },
  target: {
    lowest: "{weight} · le plus bas qu'on fixe",
    now: "{weight} · maintenant",
    nowLowest: "{weight} · maintenant · le plus bas qu'on fixe",
    deltaDown: "− {weight}",
    deltaUp: "+ {weight}",
  },
  pace: {
    rate: "{rate} par semaine",
    rateSuffix: "par semaine",
    result: "{target} vers {month} · {kcal}kcal par jour",
    capMarker: "plafonné à la limite sans risque",
    floorMarker: "jamais sous {floor}, quel que soit le rythme",
    echo: "De {from} à {to}.",
  },
  how: {
    title: "Comment eait fonctionne",
    meal: "Saumon, riz et légumes verts",
    photoAlt: "Un bowl de céréales dans le viseur",
    steps: ["Photographie ton assiette", "Reçois des macros honnêtes", "Suis ta progression"],
  },
  units: { years: "ans", yearsCount: { one: "{n} an", other: "{n} ans" } },
  twice: {
    title: "Perds deux fois plus de poids",
    sub: "Ceux qui notent ce qu'ils mangent perdent deux fois plus de poids",
    without: "Sans suivi",
    with: "Avec eait",
    source: "Hollis et al., Am J Prev Med, 2008",
    alt: "Sans suivi : 1× ; avec eait : 2×",
  },
  baseline: {
    title: "Voici ton point de départ",
    bmi: "Indice de masse corporelle (IMC)",
    bands: { under: "INSUFFISANCE PONDÉRALE", healthy: "NORMAL", over: "SURPOIDS", obese: "OBÉSITÉ" },
    verdict: { under: "Ton IMC est sous la plage saine", healthy: "Ton IMC est dans la plage saine", above: "Ton IMC est au-dessus de la plage saine" },
    note: "Ton plan en tient compte.",
    you: "Toi",
    body: "Taille · poids",
    activity: "Activité",
  },
  possible: { lose: "{delta} en moins ? Réaliste, et possible !", gain: "{delta} en plus ? Réaliste, et possible !" },
  ageWhy: "Ton métabolisme change avec l’âge, on en tient compte",
  ontrack: {
    title: "Conçu pour t'aider à tenir le cap",
    captions: {
      consistency: "Un jour raté ne coûte rien. Le suivant repart de zéro.",
      habits: "Rien n'est interdit. Chaque assiette a ses macros honnêtes.",
      support: "Demande à {coach}, quand tu veux, dans le Chat.",
      busy: "Une photo, et le repas est noté.",
      ideas: "En panne d'idées pour le dîner ? {coach} trouve ce qui rentre.",
    },
  },
  chart: {
    byEait: "avec eait",
    weightTrend: "Tendance du poids",
    without: "Sans",
    now: "Maintenant",
    later: "Plus tard",
    twoWays: "Évolution du poids, dessinée deux fois : avec un plan et sans",
    estimatedProgress: "Progression estimée",
    estimate: "Estimation",
    target: "Cible {weight}",
        monthEstimate: "{month} · estimation",
    estimateAria: "Poids estimé : {from} maintenant, {to} vers {month}",
  },
  plan: {
    goalLose: "Objectif : perdre {delta} d'ici {month}",
    goalGain: "Objectif : prendre {delta} d'ici {month}",
    goalMaintain: "Objectif : garder mon poids",
    rest: "Au repos, ton corps brûle", activity: "Avec ton activité, environ", pace: "Pour ton rythme, on ajuste", floor: "Le plancher qu’on ne franchit pas", protein: "Protéines à viser",
  },
  health: {
    title: "Synchroniser avec Santé",
    body: "Ton poids et ton activité arrivent, tes repas partent vers Santé.",
  },
  targetSuggestion:  {
    down: "Je te propose {weight}, soit environ {pct} % de moins — un bon premier objectif",
    up: "Je te propose {weight}, soit environ {pct} % de plus — un bon premier objectif",
  },
  firstMeal:  FIRST_MEAL_COPY.fr,
  stepper:  { continue: "Continuer", less: "Moins", more: "Plus" },
  offerHeadline:  "Atteindre {kg}kg d'ici {month}",
  planGoal: { metric: "Objectif : perdre {n}kg d'ici {month}", imperial: "Objectif : perdre {n}lb d'ici {month}" },
};

const DE: ChatCopy = {
  idlePlaceholder:  "Nachricht an Spud…",
  continueLabel: "Weiter",
  saveKept: "Das konnte nicht gespeichert werden. Deine Antwort ist noch da. Mit Weiter wird sie erneut gesendet.",
  underAgeCard:  {
    title: "eait ist ab {age}",
    body: "Die Art, wie diese App Kalorienziele setzt, ist nicht für einen Körper gedacht, der noch wächst.",
  },
  underAge:  {
    ask: "Tut mir leid — hier muss ich aufhören. Wenn ein Tippfehler schuld ist, schick mir einfach dein echtes Alter.",
    confirm: "Das ist mein echtes Alter",
    placeholder: "Dein Alter",
    stopped: [
      "Dann hören wir hier auf. Ich lösche alles, was du mir gesagt hast.",
      "Komm mit {age} wieder, ich bin da.",
    ],
    endedPlaceholder: "eait ist ab {age}",
  },
  belowHealthy:  {
    title: "Das kann ich nicht als Ziel setzen",
    body: "Das niedrigste gesunde Gewicht für deine Größe liegt bei etwa {kg}kg. Darunter setzen wir kein Ziel. Wenn du mit einer Ärztin an etwas anderem arbeitest, folge ihr und nicht dieser App.",
  },
  invalid:  {
    age: "Das sieht nicht nach einem Alter aus — versuch es mit so etwas wie 34.",
    height_cm: "In Zentimetern — so etwas wie 175.",
    weight_kg: "In Kilogramm — ungefähr reicht.",
    target_weight_kg: "Eine Zahl in kg — zum Beispiel 70.",
  },
  ambiguousAge:  {
    line: "Ich will sichergehen, dass ich das richtig lese — wenn du das Jahr {year} meintest, schick alle vier Ziffern.",
    confirm: "Ich bin {age}",
  },
  direction:  {
    gain: "Du bist bei {weight}kg und willst auf {target} zunehmen — von hier aus ist das keine Zunahme. Wenn sich das Ziel geändert hat, stellen wir um; sonst gib mir eine Zahl über {weight}.",
    lose: "Du bist bei {weight}kg und willst auf {target} abnehmen — von hier aus ist das keine Abnahme. Wenn sich das Ziel geändert hat, stellen wir um; sonst gib mir eine Zahl unter {weight}.",
    switchToLose: "Auf Abnehmen umstellen",
    switchToGain: "Auf Zunehmen umstellen",
    above: "Eine Zahl über {weight}…",
    below: "Eine Zahl unter {weight}…",
  },
  switched:  {
    gain: "Umgestellt — zunehmen also. Wo möchtest du landen, in kg?",
    lose: "Umgestellt — abnehmen also. Wo möchtest du landen, in kg? Schneller ist hier nicht besser — nur schwerer zu halten.",
  },
  capNoteTail:  " Das sind etwa {kg}kg pro Woche.",
  goalEdit:  {
    cleared: "Dein Zielgewicht passte nicht mehr zu diesem Ziel, also ist es gelöscht — setz ein neues.",
    worthSetting: "Aufgenommen. Dein Zielgewicht passt allerdings nicht mehr zu deinem Ziel — es lohnt sich, ein neues zu setzen.",
  },
  target: {
    lowest: "{weight} · unser Minimum",
    now: "{weight} · jetzt",
    nowLowest: "{weight} · jetzt · unser Minimum",
    deltaDown: "− {weight}",
    deltaUp: "+ {weight}",
  },
  pace: {
    rate: "{rate} pro Woche",
    rateSuffix: "pro Woche",
    result: "{target} etwa im {month} · {kcal}kcal am Tag",
    capMarker: "auf das sichere Maximum begrenzt",
    floorMarker: "nie unter {floor} · jedes Tempo landet hier",
    echo: "Von {from} auf {to}.",
  },
  how: {
    title: "So funktioniert eait",
    meal: "Lachs mit Reis und Gemüse",
    photoAlt: "Eine Getreidebowl im Sucher",
    steps: ["Fotografier den Teller", "Bekomm ehrliche Makros", "Sieh deinen Fortschritt"],
  },
  units: { years: "Jahre", yearsCount: { one: "{n} Jahr", other: "{n} Jahre" } },
  twice: {
    title: "Nimm doppelt so viel ab",
    sub: "Wer aufschreibt, was er isst, nimmt doppelt so viel ab",
    without: "Ohne Protokoll",
    with: "Mit eait",
    source: "Hollis et al., Am J Prev Med, 2008",
    alt: "Ohne Protokoll: 1×; mit eait: 2×",
  },
  baseline: {
    title: "Das ist dein Ausgangspunkt",
    bmi: "Body-Mass-Index (BMI)",
    bands: { under: "UNTERGEWICHT", healthy: "NORMALGEWICHT", over: "ÜBERGEWICHT", obese: "ADIPOSITAS" },
    verdict: { under: "Dein BMI liegt unter dem gesunden Bereich", healthy: "Dein BMI liegt im gesunden Bereich", above: "Dein BMI liegt über dem gesunden Bereich" },
    note: "Dein Plan berücksichtigt das.",
    you: "Du",
    body: "Größe · Gewicht",
    activity: "Aktivität",
  },
  possible: { lose: "{delta} weniger? Realistisch und machbar!", gain: "{delta} mehr? Realistisch und machbar!" },
  ageWhy: "Dein Stoffwechsel verändert sich mit dem Alter, das rechnen wir ein",
  ontrack: {
    title: "Gemacht, damit du dranbleibst",
    captions: {
      consistency: "Ein verpasster Tag kostet nichts. Der nächste fängt bei null an.",
      habits: "Nichts ist verboten. Jeder Teller bekommt ehrliche Makros.",
      support: "Frag {coach}, wann immer du willst, im Chat.",
      busy: "Ein Foto ist der ganze Eintrag.",
      ideas: "Keine Idee fürs Abendessen? {coach} sagt, was noch reinpasst.",
    },
  },
  chart: {
    byEait: "mit eait",
    weightTrend: "Gewichtstrend",
    without: "Ohne",
    now: "Jetzt",
    later: "Später",
    twoWays: "Gewicht über die Zeit, zweimal gezeichnet: mit Plan und ohne",
    estimatedProgress: "Geschätzter Fortschritt",
    estimate: "Schätzung",
    target: "Ziel {weight}",
        monthEstimate: "{month} · Schätzung",
    estimateAria: "Geschätztes Gewicht: jetzt {from}, {to} etwa im {month}",
  },
  plan: {
    goalLose: "Ziel: {delta} abnehmen bis {month}",
    goalGain: "Ziel: {delta} zunehmen bis {month}",
    goalMaintain: "Ziel: mein Gewicht halten",
    rest: "Im Ruhezustand verbrennt dein Körper", activity: "Mit deiner Aktivität etwa", pace: "Für dein Tempo passen wir an", floor: "Die Grenze, die wir nicht unterschreiten", protein: "Dein Proteinziel",
  },
  health: {
    title: "Mit Apple Health synchronisieren",
    body: "Gewicht und Aktivität kommen rein, deine Mahlzeiten gehen raus.",
  },
  targetSuggestion:  {
    down: "Ich schlage {weight} vor, etwa {pct}% weniger — ein gutes erstes Ziel",
    up: "Ich schlage {weight} vor, etwa {pct}% mehr — ein gutes erstes Ziel",
  },
  firstMeal:  FIRST_MEAL_COPY.de,
  stepper:  { continue: "Weiter", less: "Weniger", more: "Mehr" },
  offerHeadline:  "{kg}kg bis {month}",
  planGoal: { metric: "Ziel: bis {month} {n}kg abnehmen", imperial: "Ziel: bis {month} {n}lb abnehmen" },
};

const IT: ChatCopy = {
  idlePlaceholder:  "Scrivi a Spud…",
  continueLabel: "Continua",
  saveKept: "Non è stato possibile salvare. La tua risposta è ancora qui. Con Continua viene inviata di nuovo.",
  underAgeCard:  {
    title: "eait è da {age} anni in su",
    body: "Il modo in cui questa app fissa gli obiettivi calorici non è pensato per un corpo che sta ancora crescendo.",
  },
  underAge:  {
    ask: "Mi dispiace — qui devo fermarmi. Se è stato un errore di battitura, mandami la tua età vera.",
    confirm: "È la mia età vera",
    placeholder: "La tua età",
    stopped: [
      "Allora ci fermiamo qui. Sto cancellando tutto quello che mi hai detto.",
      "Torna a {age} anni e io ci sarò.",
    ],
    endedPlaceholder: "eait è da {age} anni in su",
  },
  belowHealthy:  {
    title: "Non posso impostarlo come obiettivo",
    body: "Il peso sano più basso per la tua altezza è circa {kg}kg. Sotto quello non fissiamo obiettivi. Se il tuo medico ti ha indicato altro, segui le sue indicazioni e non questa app.",
  },
  invalid:  {
    age: "Non sembra un'età — prova con qualcosa tipo 34.",
    height_cm: "In centimetri — qualcosa tipo 175.",
    weight_kg: "In chilogrammi — approssimare va bene.",
    target_weight_kg: "Un numero in kg — tipo 70.",
  },
  ambiguousAge:  {
    line: "Voglio essere sicuro di aver letto bene — se intendevi l'anno {year}, mandami tutte e quattro le cifre.",
    confirm: "Ho {age} anni",
  },
  direction:  {
    gain: "Sei a {weight}kg e chiedi di salire a {target} — da qui non è un aumento. Se l'obiettivo è cambiato possiamo invertirlo; altrimenti dammi un numero sopra {weight}.",
    lose: "Sei a {weight}kg e chiedi di scendere a {target} — da qui non è un calo. Se l'obiettivo è cambiato possiamo invertirlo; altrimenti dammi un numero sotto {weight}.",
    switchToLose: "Passa a perdere peso",
    switchToGain: "Passa a prendere peso",
    above: "Un numero sopra {weight}…",
    below: "Un numero sotto {weight}…",
  },
  switched:  {
    gain: "Fatto, allora prendiamo peso. Dove ti piacerebbe arrivare, in kg?",
    lose: "Invertito — si perde peso, allora. Dove ti piacerebbe arrivare, in kg? Andare più veloce non è meglio: è solo più difficile da mantenere.",
  },
  capNoteTail:  " Fa circa {kg}kg a settimana.",
  goalEdit:  {
    cleared: "Il tuo peso obiettivo non corrispondeva più a quell'obiettivo, quindi è stato azzerato — impostane uno nuovo.",
    worthSetting: "Registrato. Il tuo peso obiettivo però non corrisponde più al tuo obiettivo — vale la pena impostarne uno nuovo.",
  },
  target: {
    lowest: "{weight} · il minimo che fissiamo",
    now: "{weight} · ora",
    nowLowest: "{weight} · ora · il minimo che fissiamo",
    deltaDown: "− {weight}",
    deltaUp: "+ {weight}",
  },
  pace: {
    rate: "{rate} a settimana",
    rateSuffix: "a settimana",
    result: "{target} verso {month} · {kcal}kcal al giorno",
    capMarker: "limitato al valore di sicurezza",
    floorMarker: "mai sotto {floor} · ogni ritmo arriva qui",
    echo: "Da {from} a {to}.",
  },
  how: {
    title: "Come funziona eait",
    meal: "Salmone, riso e verdure",
    photoAlt: "Una bowl di cereali nel mirino",
    steps: ["Fotografa il piatto", "Ricevi macro onesti", "Guarda i tuoi progressi"],
  },
  units: { years: "anni", yearsCount: { one: "{n} anno", other: "{n} anni" } },
  twice: {
    title: "Perdi il doppio del peso",
    sub: "Chi annota quello che mangia perde il doppio del peso",
    without: "Senza registrare",
    with: "Con eait",
    source: "Hollis et al., Am J Prev Med, 2008",
    alt: "Senza registrare: 1×; con eait: 2×",
  },
  baseline: {
    title: "Ecco il tuo punto di partenza",
    bmi: "Indice di massa corporea (IMC)",
    bands: { under: "SOTTOPESO", healthy: "NORMOPESO", over: "SOVRAPPESO", obese: "OBESITÀ" },
    verdict: { under: "Il tuo IMC è sotto l'intervallo sano", healthy: "Il tuo IMC è nell'intervallo sano", above: "Il tuo IMC è sopra l'intervallo sano" },
    note: "Il tuo piano ne tiene conto.",
    you: "Tu",
    body: "Altezza · peso",
    activity: "Attività",
  },
  possible: { lose: "{delta} in meno? Realistico, e possibile!", gain: "{delta} in più? Realistico, e possibile!" },
  ageWhy: "Il tuo metabolismo cambia con l’età, e ne teniamo conto",
  ontrack: {
    title: "Fatta per tenerti in carreggiata",
    captions: {
      consistency: "Un giorno saltato non costa niente. Il prossimo riparte da zero.",
      habits: "Niente è vietato. Ogni piatto riceve macro onesti.",
      support: "Chiedi a {coach}, quando vuoi, in Chat.",
      busy: "Basta una foto per registrare.",
      ideas: "Senza idee per cena? Chiedi a {coach} cosa ci sta in quello che resta.",
    },
  },
  chart: {
    byEait: "con eait",
    weightTrend: "Andamento del peso",
    without: "Senza",
    now: "Ora",
    later: "Dopo",
    twoWays: "Peso nel tempo, disegnato due volte: con un piano e senza",
    estimatedProgress: "Progressi stimati",
    estimate: "Stima",
    target: "Obiettivo {weight}",
        monthEstimate: "{month} · stima",
    estimateAria: "Peso stimato: {from} ora, {to} intorno a {month}",
  },
  plan: {
    goalLose: "Obiettivo: perdere {delta} entro {month}",
    goalGain: "Obiettivo: prendere {delta} entro {month}",
    goalMaintain: "Obiettivo: mantenere il mio peso",
    rest: "A riposo il tuo corpo brucia", activity: "Con la tua attività, circa", pace: "Per il tuo ritmo, correggiamo", floor: "Il minimo sotto cui non scendiamo", protein: "Proteine da raggiungere",
  },
  health: {
    title: "Sincronizza con Apple Health",
    body: "Peso e attività in entrata, pasti in uscita.",
  },
  targetSuggestion:  {
    down: "Ti suggerisco {weight}, circa il {pct}% in meno — un buon primo obiettivo",
    up: "Ti suggerisco {weight}, circa il {pct}% in più — un buon primo obiettivo",
  },
  firstMeal:  FIRST_MEAL_COPY.it,
  stepper:  { continue: "Continua", less: "Meno", more: "Più" },
  offerHeadline:  "Arriva a {kg}kg entro {month}",
  planGoal: { metric: "Obiettivo: perdere {n}kg entro {month}", imperial: "Obiettivo: perdere {n}lb entro {month}" },
};

const ES: ChatCopy = {
  idlePlaceholder:  "Escribe a Spud…",
  continueLabel: "Continuar",
  saveKept: "No se pudo guardar. Tu respuesta sigue aquí. Con Continuar se envía otra vez.",
  underAgeCard:  {
    title: "eait es para {age} años en adelante",
    body: "La forma en que esta app fija objetivos de calorías no está pensada para un cuerpo que todavía está creciendo.",
  },
  underAge:  {
    ask: "Lo siento — aquí tengo que parar. Si ha sido una errata, mándame tu edad de verdad.",
    confirm: "Es mi edad de verdad",
    placeholder: "Tu edad",
    stopped: [
      "Entonces aquí lo dejamos. Estoy borrando todo lo que me has contado.",
      "Vuelve a los {age} y aquí estaré.",
    ],
    endedPlaceholder: "eait es para {age} años en adelante",
  },
  belowHealthy:  {
    title: "No puedo poner eso como objetivo",
    body: "El peso saludable más bajo para tu altura es de unos {kg}kg. No fijamos objetivos por debajo. Si estás trabajando otra cosa con un médico, hazle caso a él y no a esta app.",
  },
  invalid:  {
    age: "Eso no parece una edad — prueba con algo como 34.",
    height_cm: "En centímetros — algo como 175.",
    weight_kg: "En kilogramos — aproximado vale.",
    target_weight_kg: "Un número en kg — como 70.",
  },
  ambiguousAge:  {
    line: "Quiero estar seguro de haberlo leído bien — si querías decir el año {year}, mándame las cuatro cifras.",
    confirm: "Tengo {age} años",
  },
  direction:  {
    gain: "Estás en {weight}kg y pides subir hasta {target} — desde aquí eso no es subir. Si el objetivo ha cambiado, lo cambiamos; si no, dame un número por encima de {weight}.",
    lose: "Estás en {weight}kg y pides bajar hasta {target} — desde aquí eso no es bajar. Si el objetivo ha cambiado, lo cambiamos; si no, dame un número por debajo de {weight}.",
    switchToLose: "Cambiar a perder peso",
    switchToGain: "Cambiar a ganar peso",
    above: "Un número por encima de {weight}…",
    below: "Un número por debajo de {weight}…",
  },
  switched:  {
    gain: "Cambiado — ganar, entonces. ¿Dónde te gustaría llegar, en kg?",
    lose: "Cambiado — perder, entonces. ¿Dónde te gustaría llegar, en kg? Más rápido no es mejor aquí — solo es más difícil de sostener.",
  },
  capNoteTail:  " Eso son unos {kg}kg por semana.",
  goalEdit:  {
    cleared: "Tu peso objetivo ya no encajaba con ese objetivo, así que se ha borrado — pon uno nuevo.",
    worthSetting: "Registrado. Eso sí, tu peso objetivo ya no encaja con tu objetivo — merece la pena poner uno nuevo.",
  },
  target: {
    lowest: "{weight} · el mínimo que fijamos",
    now: "{weight} · ahora",
    nowLowest: "{weight} · ahora · el mínimo que fijamos",
    deltaDown: "− {weight}",
    deltaUp: "+ {weight}",
  },
  pace: {
    rate: "{rate} a la semana",
    rateSuffix: "a la semana",
    result: "{target} hacia {month} · {kcal}kcal al día",
    capMarker: "limitado al tope seguro",
    floorMarker: "nunca por debajo de {floor} · cada ritmo llega aquí",
    echo: "De {from} a {to}.",
  },
  how: {
    title: "Cómo funciona eait",
    meal: "Salmón con arroz y verduras",
    photoAlt: "Un bowl de granos en el visor",
    steps: ["Fotografía el plato", "Recibe macros honestos", "Ve tu progreso"],
  },
  units: { years: "años", yearsCount: { one: "{n} año", other: "{n} años" } },
  twice: {
    title: "Pierde el doble de peso",
    sub: "Quienes apuntan lo que comen pierden el doble de peso",
    without: "Sin registrar",
    with: "Con eait",
    source: "Hollis et al., Am J Prev Med, 2008",
    alt: "Sin registrar: 1×; con eait: 2×",
  },
  baseline: {
    title: "Este es tu punto de partida",
    bmi: "Índice de masa corporal (IMC)",
    bands: { under: "BAJO PESO", healthy: "PESO NORMAL", over: "SOBREPESO", obese: "OBESIDAD" },
    verdict: { under: "Tu IMC está por debajo del rango saludable", healthy: "Tu IMC está en el rango saludable", above: "Tu IMC está por encima del rango saludable" },
    note: "Tu plan lo tiene en cuenta.",
    you: "Tú",
    body: "Altura · peso",
    activity: "Actividad",
  },
  possible: { lose: "¿{delta} menos? ¡Realista y posible!", gain: "¿{delta} más? ¡Realista y posible!" },
  ageWhy: "Tu metabolismo cambia con la edad, y lo tenemos en cuenta",
  ontrack: {
    title: "Hecha para que no te salgas",
    captions: {
      consistency: "Un día fallado no cuesta nada. El siguiente empieza de cero.",
      habits: "Nada está prohibido. Cada plato recibe macros honestos.",
      support: "Pregúntale a {coach} lo que sea, cuando sea, en el Chat.",
      busy: "Una foto es todo el registro.",
      ideas: "¿Sin ideas para cenar? {coach} te dice qué cabe.",
    },
  },
  chart: {
    byEait: "con eait",
    weightTrend: "Tendencia del peso",
    without: "Sin",
    now: "Ahora",
    later: "Después",
    twoWays: "Peso a lo largo del tiempo, dibujado dos veces: con un plan y sin él",
    estimatedProgress: "Progreso estimado",
    estimate: "Estimación",
    target: "Meta {weight}",
        monthEstimate: "{month} · estimación",
    estimateAria: "Peso estimado: {from} ahora, {to} hacia {month}",
  },
  plan: {
    goalLose: "Objetivo: perder {delta} para {month}",
    goalGain: "Objetivo: ganar {delta} para {month}",
    goalMaintain: "Objetivo: mantener mi peso",
    rest: "En reposo tu cuerpo quema", activity: "Con tu actividad, unas", pace: "Para tu ritmo, ajustamos", floor: "El mínimo del que no bajamos", protein: "Proteína objetivo",
  },
  health: {
    title: "Sincronizar con Apple Health",
    body: "Entran tu peso y tu actividad; salen tus comidas.",
  },
  targetSuggestion:  {
    down: "Te sugiero {weight}, alrededor de un {pct}% menos — una buena primera meta",
    up: "Te sugiero {weight}, alrededor de un {pct}% más — una buena primera meta",
  },
  firstMeal:  FIRST_MEAL_COPY.es,
  stepper:  { continue: "Continuar", less: "Menos", more: "Más" },
  offerHeadline:  "Llegar a {kg}kg en {month}",
  planGoal: { metric: "Objetivo: bajar {n}kg para {month}", imperial: "Objetivo: bajar {n}lb para {month}" },
};

const VI: ChatCopy = {
  idlePlaceholder:  "Nhắn cho Spud…",
  continueLabel: "Tiếp tục",
  saveKept: "Không lưu được. Câu trả lời của bạn vẫn còn đây. Bấm Tiếp tục để gửi lại.",
  underAgeCard:  {
    title: "eait dành cho {age} tuổi trở lên",
    body: "Cách ứng dụng này đặt mục tiêu calo không được thiết kế cho một cơ thể vẫn đang lớn.",
  },
  underAge:  {
    ask: "Xin lỗi — mình phải dừng ở đây. Nếu chỉ là gõ nhầm, bạn gửi lại tuổi thật nhé.",
    confirm: "Đó là tuổi thật của mình",
    placeholder: "Tuổi của bạn",
    stopped: [
      "Vậy thì chúng mình dừng ở đây. Mình đang xóa mọi điều bạn đã kể.",
      "Quay lại khi {age} tuổi nhé, mình vẫn ở đây.",
    ],
    endedPlaceholder: "eait dành cho {age} tuổi trở lên",
  },
  belowHealthy:  {
    title: "Mình không đặt được mức đó làm mục tiêu",
    body: "Cân nặng khỏe mạnh thấp nhất với chiều cao của bạn là khoảng {kg}kg. Chúng mình không đặt mục tiêu dưới mức đó. Nếu bạn đang theo một hướng khác cùng bác sĩ, hãy nghe bác sĩ chứ đừng nghe ứng dụng này.",
  },
  invalid:  {
    age: "Cái đó trông không giống một số tuổi — thử kiểu như 34 xem.",
    height_cm: "Tính bằng cm — kiểu như 175.",
    weight_kg: "Tính bằng kg — áng chừng là được.",
    target_weight_kg: "Một số tính bằng kg — ví dụ 70.",
  },
  ambiguousAge:  {
    line: "Mình muốn chắc là đọc đúng — nếu ý bạn là năm {year}, gửi đủ bốn chữ số nhé.",
    confirm: "Mình {age} tuổi",
  },
  direction:  {
    gain: "Bạn đang ở {weight}kg mà lại muốn tăng lên {target} — từ đây thì đó không phải là tăng. Nếu mục tiêu đã đổi, chúng mình đổi theo; còn không thì cho mình một số trên {weight}.",
    lose: "Bạn đang ở {weight}kg mà lại muốn giảm xuống {target} — từ đây thì đó không phải là giảm. Nếu mục tiêu đã đổi, chúng mình đổi theo; còn không thì cho mình một số dưới {weight}.",
    switchToLose: "Chuyển sang giảm cân",
    switchToGain: "Chuyển sang tăng cân",
    above: "Một số trên {weight}…",
    below: "Một số dưới {weight}…",
  },
  switched:  {
    gain: "Đã chuyển — vậy là tăng cân. Bạn muốn về mức nào, tính bằng kg?",
    lose: "Đã chuyển — vậy là giảm cân. Bạn muốn về mức nào, tính bằng kg? Nhanh hơn không có nghĩa là tốt hơn — chỉ khó giữ hơn thôi.",
  },
  capNoteTail:  " Tính ra khoảng {kg}kg mỗi tuần.",
  goalEdit:  {
    cleared: "Cân nặng mục tiêu của bạn không còn hợp với mục tiêu đó nữa nên đã được xóa — đặt lại một mức mới nhé.",
    worthSetting: "Đã ghi. Có điều cân nặng mục tiêu của bạn không còn hợp với mục tiêu nữa — nên đặt lại một mức mới.",
  },
  target: {
    lowest: "{weight} · mức thấp nhất có thể đặt",
    now: "{weight} · hiện tại",
    nowLowest: "{weight} · hiện tại · mức thấp nhất có thể đặt",
    deltaDown: "− {weight}",
    deltaUp: "+ {weight}",
  },
  pace: {
    rate: "{rate} một tuần",
    rateSuffix: "một tuần",
    result: "{target} vào khoảng {month} · {kcal}kcal một ngày",
    capMarker: "đã giới hạn ở mức an toàn",
    floorMarker: "không bao giờ dưới {floor} · mọi tốc độ đều đến đây",
    echo: "Từ {from} đến {to}.",
  },
  how: {
    title: "eait hoạt động thế nào",
    meal: "Cá hồi, cơm và rau",
    photoAlt: "Một bát ngũ cốc trong khung ngắm",
    steps: ["Chụp món ăn", "Nhận macro rõ ràng", "Xem tiến độ của bạn"],
  },
  units: { years: "tuổi", yearsCount: { other: "{n} tuổi" } },
  twice: {
    title: "Giảm gấp đôi số cân",
    sub: "Người ghi lại những gì mình ăn giảm được gấp đôi số cân",
    without: "Không ghi lại",
    with: "Với eait",
    source: "Hollis et al., Am J Prev Med, 2008",
    alt: "Không ghi lại: 1×; với eait: 2×",
  },
  baseline: {
    title: "Đây là điểm xuất phát của bạn",
    bmi: "Chỉ số khối cơ thể (BMI)",
    bands: { under: "THIẾU CÂN", healthy: "BÌNH THƯỜNG", over: "THỪA CÂN", obese: "BÉO PHÌ" },
    verdict: { under: "BMI của bạn thấp hơn mức khỏe mạnh", healthy: "BMI của bạn trong mức khỏe mạnh", above: "BMI của bạn cao hơn mức khỏe mạnh" },
    note: "Kế hoạch của bạn đã tính đến điều này.",
    you: "Bạn",
    body: "Chiều cao · cân nặng",
    activity: "Mức vận động",
  },
  possible: { lose: "Bớt {delta}? Thực tế và hoàn toàn khả thi!", gain: "Tăng {delta}? Thực tế và hoàn toàn khả thi!" },
  ageWhy: "Trao đổi chất thay đổi theo tuổi, nên chúng tôi tính cả điều đó",
  ontrack: {
    title: "Giúp bạn luôn đi đúng hướng",
    captions: {
      consistency: "Lỡ một ngày cũng không sao. Hôm sau lại bắt đầu từ đầu.",
      habits: "Không món nào bị cấm. Mỗi đĩa đều có macro rõ ràng.",
      support: "Hỏi {coach} bất cứ điều gì, bất cứ lúc nào, trong Chat.",
      busy: "Chỉ một tấm ảnh là ghi xong.",
      ideas: "Bí ý tưởng cho bữa tối? Hỏi {coach} xem món gì hợp với phần còn lại trong ngày.",
    },
  },
  chart: {
    byEait: "với eait",
    weightTrend: "Xu hướng cân nặng",
    without: "Không có kế hoạch",
    now: "Hiện tại",
    later: "Về sau",
    twoWays: "Cân nặng theo thời gian, vẽ hai cách: có kế hoạch và không",
    estimatedProgress: "Tiến triển ước tính",
    estimate: "Ước tính",
    target: "Mục tiêu {weight}",
    monthEstimate: "{month} · ước tính",
    estimateAria: "Cân nặng ước tính: {from} hiện tại, {to} vào khoảng {month}",
  },
  plan: {
    goalLose: "Mục tiêu: giảm {delta} vào khoảng {month}",
    goalGain: "Mục tiêu: tăng {delta} vào khoảng {month}",
    goalMaintain: "Mục tiêu: giữ cân nặng",
    rest: "Lúc nghỉ, cơ thể bạn đốt", activity: "Với mức vận động của bạn, khoảng", pace: "Điều chỉnh theo tốc độ của bạn", floor: "Mức sàn, không bao giờ thấp hơn", protein: "Đạm cần hướng tới",
  },
  health: {
    title: "Đồng bộ với Apple Health",
    body: "Nhận cân nặng và vận động, gửi bữa ăn sang Health.",
  },
  targetSuggestion:  {
    down: "Mình gợi ý {weight}, tức xuống khoảng {pct}% — một mục tiêu đầu tiên hợp lý",
    up: "Mình gợi ý {weight}, tức lên khoảng {pct}% — một mục tiêu đầu tiên hợp lý",
  },
  firstMeal:  FIRST_MEAL_COPY.vi,
  stepper:  { continue: "Tiếp tục", less: "Bớt", more: "Thêm" },
  offerHeadline:  "Đạt {kg}kg vào {month}",
  planGoal: { metric: "Mục tiêu: giảm {n}kg vào {month}", imperial: "Mục tiêu: giảm {n}lb vào {month}" },
};

const ID: ChatCopy = {
  idlePlaceholder:  "Kirim pesan ke Spud…",
  continueLabel: "Lanjutkan",
  saveKept: "Tidak bisa disimpan. Jawabanmu masih di sini. Lanjutkan akan mengirimnya lagi.",
  underAgeCard:  {
    title: "eait untuk usia {age} ke atas",
    body: "Cara aplikasi ini menetapkan target kalori tidak dirancang untuk tubuh yang masih tumbuh.",
  },
  underAge:  {
    ask: "Maaf — aku harus berhenti di sini. Kalau tadi salah ketik, kirim saja umur aslimu.",
    confirm: "Itu umur asliku",
    placeholder: "Umurmu",
    stopped: [
      "Kalau begitu kita berhenti di sini. Aku sedang menghapus semua yang kamu ceritakan.",
      "Datang lagi saat {age} tahun, aku akan ada di sini.",
    ],
    endedPlaceholder: "eait untuk usia {age} ke atas",
  },
  belowHealthy:  {
    title: "Aku tidak bisa menetapkan itu sebagai target",
    body: "Berat sehat terendah untuk tinggimu sekitar {kg}kg. Kami tidak menetapkan tujuan di bawah itu. Kalau kamu sedang menjalani hal lain bersama dokter, ikuti dokternya, bukan aplikasi ini.",
  },
  invalid:  {
    age: "Itu tidak kelihatan seperti umur — coba seperti 34.",
    height_cm: "Dalam sentimeter — seperti 175.",
    weight_kg: "Dalam kilogram — kira-kira saja tidak apa-apa.",
    target_weight_kg: "Angka dalam kg — misalnya 70.",
  },
  ambiguousAge:  {
    line: "Aku mau pastikan tidak salah baca — kalau maksudmu tahun {year}, kirim keempat angkanya.",
    confirm: "Umurku {age}",
  },
  direction:  {
    gain: "Kamu di {weight}kg dan minta naik ke {target} — dari sini itu bukan kenaikan. Kalau tujuannya berubah, kita bisa ganti; kalau tidak, beri aku angka di atas {weight}.",
    lose: "Kamu di {weight}kg dan minta turun ke {target} — dari sini itu bukan penurunan. Kalau tujuannya berubah, kita bisa ganti; kalau tidak, beri aku angka di bawah {weight}.",
    switchToLose: "Ganti ke menurunkan",
    switchToGain: "Ganti ke menaikkan",
    above: "Angka di atas {weight}…",
    below: "Angka di bawah {weight}…",
  },
  switched:  {
    gain: "Diganti — jadi menaikkan. Kamu ingin sampai di angka berapa, dalam kg?",
    lose: "Diganti — jadi menurunkan. Kamu ingin sampai di angka berapa, dalam kg? Lebih cepat bukan berarti lebih baik — hanya lebih sulit dijaga.",
  },
  capNoteTail:  " Itu sekitar {kg}kg per minggu.",
  goalEdit:  {
    cleared: "Berat targetmu sudah tidak cocok dengan tujuan itu, jadi dihapus — tetapkan yang baru.",
    worthSetting: "Tercatat. Tapi berat targetmu sudah tidak cocok dengan tujuanmu — sebaiknya tetapkan yang baru.",
  },
  target: {
    lowest: "{weight} · batas terendah kami",
    now: "{weight} · sekarang",
    nowLowest: "{weight} · sekarang · batas terendah kami",
    deltaDown: "− {weight}",
    deltaUp: "+ {weight}",
  },
  pace: {
    rate: "{rate} seminggu",
    rateSuffix: "seminggu",
    result: "{target} sekitar {month} · {kcal}kcal sehari",
    capMarker: "dibatasi ke batas aman",
    floorMarker: "tidak pernah di bawah {floor} · semua tempo sampai di sini",
    echo: "Dari {from} ke {to}.",
  },
  how: {
    title: "Cara kerja eait",
    meal: "Salmon, nasi, dan sayur",
    photoAlt: "Mangkuk biji-bijian di jendela bidik",
    steps: ["Foto piringnya", "Dapatkan makro jujur", "Lihat progresmu"],
  },
  units: { years: "tahun", yearsCount: { other: "{n} tahun" } },
  twice: {
    title: "Turun berat badan dua kali lebih banyak",
    sub: "Orang yang mencatat apa yang mereka makan kehilangan berat badan dua kali lebih banyak",
    without: "Tanpa mencatat",
    with: "Dengan eait",
    source: "Hollis et al., Am J Prev Med, 2008",
    alt: "Tanpa mencatat: 1×; dengan eait: 2×",
  },
  baseline: {
    title: "Ini titik awalmu",
    bmi: "Indeks Massa Tubuh (IMT)",
    bands: { under: "KURUS", healthy: "NORMAL", over: "BERLEBIH", obese: "OBESITAS" },
    verdict: { under: "IMT-mu di bawah rentang sehat", healthy: "IMT-mu dalam rentang sehat", above: "IMT-mu di atas rentang sehat" },
    note: "Rencanamu sudah memperhitungkannya.",
    you: "Kamu",
    body: "Tinggi · berat",
    activity: "Aktivitas",
  },
  possible: { lose: "Kurang {delta}? Realistis, dan bisa dicapai!", gain: "Tambah {delta}? Realistis, dan bisa dicapai!" },
  ageWhy: "Metabolismemu berubah seiring usia, jadi kami memperhitungkannya",
  ontrack: {
    title: "Dibuat agar kamu tetap di jalur",
    captions: {
      consistency: "Melewatkan satu hari tidak ada ruginya. Hari berikutnya mulai dari nol.",
      habits: "Tidak ada yang dilarang. Setiap piring mendapat makro jujur.",
      support: "Tanya {coach} apa saja, kapan saja, di Chat.",
      busy: "Satu foto adalah seluruh catatan.",
      ideas: "Bingung mau makan malam apa? Tanya {coach} apa yang masih muat.",
    },
  },
  chart: {
    byEait: "dengan eait",
    weightTrend: "Tren berat badan",
    without: "Tanpa",
    now: "Sekarang",
    later: "Nanti",
    twoWays: "Berat badan dari waktu ke waktu, digambar dua cara: dengan rencana dan tanpa",
    estimatedProgress: "Perkiraan progres",
    estimate: "Perkiraan",
    target: "Target {weight}",
        monthEstimate: "{month} · perkiraan",
    estimateAria: "Perkiraan berat: {from} sekarang, {to} sekitar {month}",
  },
  plan: {
    goalLose: "Target: turun {delta} pada {month}",
    goalGain: "Target: naik {delta} menjelang {month}",
    goalMaintain: "Target: pertahankan berat badan aku",
    rest: "Saat istirahat tubuhmu membakar", activity: "Dengan aktivitasmu, sekitar", pace: "Untuk tempomu, kami sesuaikan", floor: "Batas bawah yang tidak dilewati", protein: "Target protein",
  },
  health: {
    title: "Sinkronkan dengan Apple Health",
    body: "Berat badan dan aktivitas masuk ke eait, makanan dikirim ke Kesehatan.",
  },
  targetSuggestion:  {
    down: "Kusarankan {weight}, turun sekitar {pct}% — target pertama yang bagus",
    up: "Kusarankan {weight}, naik sekitar {pct}% — target pertama yang bagus",
  },
  firstMeal:  FIRST_MEAL_COPY.id,
  stepper:  { continue: "Lanjut", less: "Kurangi", more: "Tambah" },
  offerHeadline:  "Capai {kg}kg pada {month}",
  planGoal: { metric: "Target: turun {n}kg pada {month}", imperial: "Target: turun {n}lb pada {month}" },
};

const RU: ChatCopy = {
  idlePlaceholder:  "Написать Spud…",
  continueLabel: "Продолжить",
  saveKept: "Не удалось сохранить. Твой ответ всё ещё здесь. «Продолжить» отправит его снова.",
  underAgeCard:  {
    title: "eait — с {age} лет",
    body: "То, как это приложение ставит цели по калориям, не рассчитано на тело, которое ещё растёт.",
  },
  underAge:  {
    ask: "Извини — здесь мне придётся остановиться. Если это опечатка, просто пришли настоящий возраст.",
    confirm: "Это мой настоящий возраст",
    placeholder: "Твой возраст",
    stopped: [
      "Тогда на этом мы остановимся. Я удаляю все твои ответы.",
      "Возвращайся в {age} — я буду здесь.",
    ],
    endedPlaceholder: "eait — с {age} лет",
  },
  belowHealthy:  {
    title: "Не могу поставить это как цель",
    body: "Самый низкий здоровый вес для твоего роста — около {kg}кг. Ниже мы цель не ставим. Если ты работаешь над чем-то другим с врачом, слушай его, а не это приложение.",
  },
  invalid:  {
    age: "На возраст не похоже — попробуй что-то вроде 34.",
    height_cm: "В сантиметрах — что-то вроде 175.",
    weight_kg: "В килограммах — можно примерно.",
    target_weight_kg: "Число в кг — например 70.",
  },
  ambiguousAge:  {
    line: "Хочу убедиться, что понял правильно: если речь про {year} год, пришли все четыре цифры.",
    confirm: "Мне {age}",
  },
  direction:  {
    gain: "Сейчас у тебя {weight}кг, а цель — {target}: это не набор веса. Если цель поменялась, можем переключить; иначе дай число больше {weight}.",
    lose: "Сейчас у тебя {weight}кг, а цель — {target}: это не снижение веса. Если цель поменялась, можем переключить; иначе дай число меньше {weight}.",
    switchToLose: "Переключить на похудение",
    switchToGain: "Переключить на набор",
    above: "Число больше {weight}…",
    below: "Число меньше {weight}…",
  },
  switched:  {
    gain: "Переключил — значит набираем. Куда хочешь прийти, в кг?",
    lose: "Переключил — значит худеем. Куда хочешь прийти, в кг? Быстрее здесь не значит лучше — просто труднее удержать.",
  },
  capNoteTail:  " Это примерно {kg}кг в неделю.",
  goalEdit:  {
    cleared: "Твой целевой вес больше не подходил к этой цели, поэтому он сброшен — поставь новый.",
    worthSetting: "Записал. Правда, целевой вес больше не сходится с твоей целью — стоит поставить новый.",
  },
  target: {
    lowest: "{weight} · минимум, который мы задаём",
    now: "{weight} · сейчас",
    nowLowest: "{weight} · сейчас · минимум, который мы задаём",
    deltaDown: "− {weight}",
    deltaUp: "+ {weight}",
  },
  pace: {
    rate: "{rate} в неделю",
    rateSuffix: "в неделю",
    // The month stays NOMINATIVE ("это примерно январь 2027"), like the old projection line —
    // CLDR gives us no declension to put after «к».
    result: "{target} · ориентир — {month} · {kcal}ккал в день",
    capMarker: "ограничено безопасным пределом",
    floorMarker: "никогда ниже {floor} · при любом темпе",
    echo: "С {from} до {to}.",
  },
  how: {
    title: "Как работает eait",
    meal: "Лосось, рис и зелень",
    photoAlt: "Боул в видоискателе",
    steps: ["Сфотографируй тарелку", "Получи честные макросы", "Следи за прогрессом"],
  },
  units: { years: "лет", yearsCount: { one: "{n} год", few: "{n} года", many: "{n} лет", other: "{n} года" } },
  twice: {
    title: "Сбрасывай вдвое больше веса",
    sub: "Те, кто записывает, что едят, худеют вдвое больше",
    without: "Без записи",
    with: "С eait",
    source: "Hollis et al., Am J Prev Med, 2008",
    alt: "Без записи: 1×; с eait: 2×",
  },
  baseline: {
    title: "Вот твоя точка отсчёта",
    bmi: "Индекс массы тела (ИМТ)",
    bands: { under: "ДЕФИЦИТ МАССЫ", healthy: "НОРМА", over: "ИЗБЫТОК МАССЫ", obese: "ОЖИРЕНИЕ" },
    verdict: { under: "Твой ИМТ ниже здорового диапазона", healthy: "Твой ИМТ в здоровом диапазоне", above: "Твой ИМТ выше здорового диапазона" },
    note: "Твой план это учитывает.",
    you: "Ты",
    body: "Рост · вес",
    activity: "Активность",
  },
  possible: { lose: "На {delta} меньше? Реально и достижимо!", gain: "На {delta} больше? Реально и достижимо!" },
  ageWhy: "С возрастом обмен веществ меняется, мы это учитываем",
  ontrack: {
    title: "Всё, чтобы не сбиться с курса",
    captions: {
      consistency: "Пропущенный день ничего не стоит. Следующий начинается с нуля.",
      habits: "Ничего не запрещено. Каждая тарелка получает честные макросы.",
      support: "Спрашивай {coach} о чём угодно и когда угодно — в чате.",
      busy: "Одно фото — вся запись.",
      ideas: "Нет идей на ужин? {coach} подскажет, что ещё поместится.",
    },
  },
  chart: {
    byEait: "с eait",
    weightTrend: "Динамика веса",
    without: "Без",
    now: "Сейчас",
    later: "Позже",
    twoWays: "Вес со временем — с планом и без него",
    estimatedProgress: "Оценка прогресса",
    estimate: "Оценка",
    target: "Цель {weight}",
        monthEstimate: "{month} · оценка",
    estimateAria: "Оценка веса: {from} сейчас, {to} — {month}",
  },
  plan: {
    goalLose: "Цель: сбросить {delta} · ориентир — {month}",
    goalGain: "Цель: набрать {delta} · ориентир — {month}",
    goalMaintain: "Цель: сохранить вес",
    rest: "В покое твоё тело сжигает", activity: "С твоей активностью — около", pace: "Под твой темп корректируем", floor: "Порог, ниже которого не идём", protein: "Белок — ориентир",
  },
  health: {
    title: "Синхронизация с Apple Health",
    body: "Вес и активность — из «Здоровья», приёмы пищи — в «Здоровье».",
  },
  targetSuggestion:  {
    down: "Предлагаю {weight} — примерно на {pct}% меньше, хорошая первая цель",
    up: "Предлагаю {weight} — примерно на {pct}% больше, хорошая первая цель",
  },
  firstMeal:  FIRST_MEAL_COPY.ru,
  stepper:  { continue: "Продолжить", less: "Меньше", more: "Больше" },
  offerHeadline:  "Цель {kg}кг. Срок: {month}",
  planGoal: {
    metric: "Цель: минус {n}кг. Срок: {month}",
    // The SYMBOL, as every other language writes it: the word "фунтов" is the genitive plural and
    // reads wrong beside 1 or 2–4, which no amount of {n} fixes from inside the template.
    imperial: "Цель: минус {n}lb. Срок: {month}",
  },
};

const TE: ChatCopy = {
  idlePlaceholder:  "Spudకు మెసేజ్ పంపండి…",
  continueLabel: "కొనసాగించండి",
  saveKept: "అది సేవ్ కాలేదు. మీ సమాధానం ఇంకా ఇక్కడే ఉంది. \"కొనసాగించండి\" నొక్కితే అది మళ్ళీ పంపబడుతుంది.",
  underAgeCard:  {
    title: "eait {age} ఏళ్లు, అంతకంటే ఎక్కువ వయసు వారి కోసం",
    body: "ఈ యాప్ కేలరీ లక్ష్యాలను నిర్ణయించే విధానం ఇంకా ఎదుగుతున్న శరీరం కోసం రూపొందించబడలేదు.",
  },
  underAge:  {
    ask: "క్షమించండి — నేను ఇక్కడే ఆపాలి. టైపింగ్ పొరపాటు వల్ల ఇలా జరిగితే, మీ అసలు వయసు పంపండి.",
    confirm: "అదే నా అసలు వయసు",
    placeholder: "మీ వయసు",
    stopped: [
      "అయితే మనం ఇక్కడే ఆగుదాం. మీరు చెప్పినవన్నీ తొలగిస్తున్నాను.",
      "{age} ఏళ్లు వచ్చాక తిరిగి రండి, నేను ఇక్కడే ఉంటాను.",
    ],
    endedPlaceholder: "eait {age} ఏళ్లు, అంతకంటే ఎక్కువ వయసు వారి కోసం",
  },
  belowHealthy:  {
    title: "దాన్ని లక్ష్యంగా పెట్టలేను",
    body: "మీ ఎత్తుకు అత్యల్ప ఆరోగ్యకరమైన బరువు సుమారు {kg} kg. దాని కంటే తక్కువ లక్ష్యాన్ని మేము పెట్టము. మీరు డాక్టర్‌తో కలిసి వేరే దానిపై పని చేస్తుంటే, ఈ యాప్ కాదు, వారి సలహాను పాటించండి.",
  },
  invalid:  {
    age: "అది వయసులా లేదు — 34 లాంటిది ప్రయత్నించండి.",
    height_cm: "సెంటీమీటర్లలో — 175 లాంటిది.",
    weight_kg: "కిలోగ్రాముల్లో — సుమారుగా చెప్పినా సరే.",
    target_weight_kg: "kgలో ఒక సంఖ్య — 70 లాగా.",
  },
  ambiguousAge:  {
    line: "నేను సరిగ్గా చదివానో లేదో నిర్ధారించుకోవాలి — మీ ఉద్దేశం {year} సంవత్సరం అయితే, నాలుగు అంకెలూ పంపండి.",
    confirm: "నా వయసు {age}",
  },
  direction:  {
    gain: "మీ బరువు ఇప్పుడు {weight} kg, మీరు {target} వరకు పెరగాలని అడిగారు — ఇక్కడి నుండి అది పెరుగుదల కాదు. లక్ష్యం మారితే మనం దాన్ని మార్చవచ్చు; లేదంటే {weight} కంటే ఎక్కువ సంఖ్య ఇవ్వండి.",
    lose: "మీ బరువు ఇప్పుడు {weight} kg, మీరు {target} వరకు తగ్గాలని అడిగారు — ఇక్కడి నుండి అది తగ్గుదల కాదు. లక్ష్యం మారితే మనం దాన్ని మార్చవచ్చు; లేదంటే {weight} కంటే తక్కువ సంఖ్య ఇవ్వండి.",
    switchToLose: "బరువు తగ్గడానికి మార్చండి",
    switchToGain: "బరువు పెరగడానికి మార్చండి",
    above: "{weight} కంటే ఎక్కువ సంఖ్య…",
    below: "{weight} కంటే తక్కువ సంఖ్య…",
  },
  switched:  {
    gain: "మార్చాను — అయితే బరువు పెరగడమే. మీరు ఎంత బరువుకు చేరాలనుకుంటున్నారు, kgలో?",
    lose: "మార్చాను — అయితే బరువు తగ్గడమే. మీరు ఎంత బరువుకు చేరాలనుకుంటున్నారు, kgలో? ఇక్కడ వేగంగా ఉండటం మెరుగు కాదు — దాన్ని నిలబెట్టుకోవడం కష్టం అవుతుంది, అంతే.",
  },
  capNoteTail:  " అది వారానికి సుమారు {kg} kg.",
  goalEdit:  {
    cleared: "మీ లక్ష్య బరువు ఇకపై ఆ లక్ష్యానికి సరిపోలేదు, అందుకే అది తీసివేయబడింది — కొత్తది సెట్ చేయండి.",
    worthSetting: "నమోదైంది. కానీ మీ లక్ష్య బరువు ఇకపై మీ లక్ష్యానికి సరిపోదు — కొత్తది సెట్ చేయడం మంచిది.",
  },
  target: {
    // "55 · lowest we set" under the range's floor, "74 · now" beside today, "− 6kg" the
    // answer's distance from it.
    lowest: "{weight} · మేము పెట్టే కనిష్ఠం",
    now: "{weight} · ఇప్పుడు",
    nowLowest: "{weight} · ఇప్పుడు · మేము పెట్టే కనిష్ఠం",
    deltaDown: "− {weight}",
    deltaUp: "+ {weight}",
  },
  pace: {
    rate: "వారానికి {rate}",
    rateSuffix: "వారానికి",
    result: "సుమారు {month} నాటికి {target} · రోజుకు {kcal} kcal",
    capMarker: "సురక్షిత పరిమితి వద్ద ఆపబడింది",
    floorMarker: "ఎప్పుడూ {floor} కంటే తక్కువ కాదు · ఏ వేగమైనా ఇక్కడికే చేరుతుంది",
    echo: "{from} నుండి {to} వరకు.",
  },
  how: {
    title: "eait ఎలా పని చేస్తుంది",
    meal: "సాల్మన్, అన్నం, ఆకుకూరలు",
    photoAlt: "వ్యూఫైండర్‌లో ధాన్యాల బౌల్",
    steps: ["ప్లేట్ ఫోటో తీయండి", "నిజాయితీ గల మాక్రోలు పొందండి", "మీ ప్రోగ్రెస్‌ను చూడండి"],
  },
  units: { years: "ఏళ్లు", yearsCount: { one: "{n} ఏడాది", other: "{n} ఏళ్లు" } },
  twice: {
    title: "రెట్టింపు బరువు తగ్గండి",
    sub: "తాము తినేదాన్ని రాసుకునేవారు రెట్టింపు బరువు తగ్గుతారు",
    without: "నమోదు లేకుండా",
    with: "eaitతో",
    source: "Hollis et al., Am J Prev Med, 2008",
    alt: "నమోదు లేకుండా: 1×; eaitతో: 2×",
  },
  baseline: {
    title: "ఇదే మీ ప్రారంభ స్థాయి",
    bmi: "బాడీ మాస్ ఇండెక్స్ (BMI)",
    bands: { under: "తక్కువ బరువు", healthy: "ఆరోగ్యకరం", over: "అధిక బరువు", obese: "ఊబకాయం" },
    verdict: { under: "మీ BMI ఆరోగ్యకర పరిధి కంటే తక్కువగా ఉంది", healthy: "మీ BMI ఆరోగ్యకర పరిధిలో ఉంది", above: "మీ BMI ఆరోగ్యకర పరిధి కంటే ఎక్కువగా ఉంది" },
    note: "మీ ప్లాన్ దీన్ని పరిగణనలోకి తీసుకుంటుంది.",
    you: "మీరు",
    body: "ఎత్తు · బరువు",
    activity: "కార్యకలాపం",
  },
  possible: { lose: "{delta} తక్కువా? వాస్తవికం, సాధ్యమే!", gain: "{delta} ఎక్కువా? వాస్తవికం, సాధ్యమే!" },
  ageWhy: "వయసుతో పాటు మీ జీవక్రియ మారుతుంది, అందుకే దాన్ని లెక్కలోకి తీసుకుంటాం",
  ontrack: {
    title: "మిమ్మల్ని దారిలో ఉంచేలా రూపొందించబడింది",
    captions: {
      consistency: "ఒక రోజు తప్పిపోతే నష్టం లేదు. మరుసటి రోజు సున్నా నుండి మొదలవుతుంది.",
      habits: "ఏదీ నిషేధం కాదు. ప్రతి ప్లేట్‌కు నిజాయితీ గల మాక్రోలు.",
      support: "చాట్‌లో ఏదైనా, ఎప్పుడైనా అడగండి — {coach} సమాధానం ఇస్తారు.",
      busy: "ఒక ఫోటోనే మొత్తం నమోదు.",
      ideas: "రాత్రి భోజనానికి ఆలోచన లేదా? మిగిలిన దానికి ఏది సరిపోతుందో {coach} చెబుతారు.",
    },
  },
  chart: {
    byEait: "eaitతో",
    weightTrend: "బరువు ధోరణి",
    without: "లేకుండా",
    now: "ఇప్పుడు",
    later: "తర్వాత",
    twoWays: "కాలక్రమేణా బరువు, రెండు విధాలుగా: ప్లాన్‌తో, ప్లాన్ లేకుండా",
    estimatedProgress: "అంచనా ప్రోగ్రెస్",
    estimate: "అంచనా",
    target: "లక్ష్యం {weight}",
        monthEstimate: "{month} · అంచనా",
    estimateAria: "అంచనా బరువు: ఇప్పుడు {from}, సుమారు {month} నాటికి {to}",
  },
  plan: {
    goalLose: "లక్ష్యం: −{delta} · {month} నాటికి",
    goalGain: "లక్ష్యం: +{delta} · {month} నాటికి",
    goalMaintain: "లక్ష్యం: నా బరువును నిలుపుకోవడం",
    rest: "విశ్రాంతిలో మీ శరీరం ఖర్చు చేసేది", activity: "మీ కార్యకలాపంతో, సుమారు", pace: "మీ వేగానికి తగ్గట్టు మేము చేసే సర్దుబాటు", floor: "మేము దాటని కనీస పరిమితి", protein: "లక్ష్యంగా పెట్టుకోవాల్సిన ప్రోటీన్",
  },
  health: {
    title: "ఆరోగ్యం యాప్‌తో సింక్ చేయండి",
    body: "బరువు, కార్యకలాపం ఇక్కడికి వస్తాయి. మీ భోజనాలు ఆరోగ్యం యాప్‌కు వెళ్తాయి.",
  },
  targetSuggestion:  {
    down: "{weight} సూచిస్తున్నాను, సుమారు {pct}% తక్కువ, మంచి మొదటి లక్ష్యం",
    up: "{weight} సూచిస్తున్నాను, సుమారు {pct}% ఎక్కువ, మంచి మొదటి లక్ష్యం",
  },
  firstMeal:  FIRST_MEAL_COPY.te!,
  stepper:  { continue: "కొనసాగించండి", less: "తక్కువ", more: "ఎక్కువ" },
  offerHeadline:  "లక్ష్యం: {month} నాటికి {kg} kg",
  planGoal: { metric: "లక్ష్యం: −{n} kg · {month} నాటికి", imperial: "లక్ష్యం: −{n} lb · {month} నాటికి" },
};

const TA: ChatCopy = {
  idlePlaceholder:  "Spud-க்குச் செய்தி…",
  continueLabel: "தொடர்க",
  saveKept: "அதைச் சேமிக்க முடியவில்லை. உங்கள் பதில் இன்னும் இங்கே உள்ளது. தொடர்க என்பதை அழுத்தினால் மீண்டும் அனுப்பப்படும்.",
  underAgeCard:  {
    title: "eait {age} வயது மற்றும் அதற்கு மேற்பட்டவர்களுக்கானது",
    body: "இந்த ஆப் கலோரி இலக்குகளை அமைக்கும் முறை, இன்னும் வளர்ந்து வரும் உடலுக்காக வடிவமைக்கப்படவில்லை.",
  },
  underAge:  {
    ask: "மன்னிக்கவும் — இங்கே நிறுத்த வேண்டும். தட்டச்சுப் பிழையால் இப்படி ஆனது என்றால், உங்கள் உண்மையான வயதை அனுப்புங்கள்.",
    confirm: "அதுதான் என் உண்மையான வயது",
    placeholder: "உங்கள் வயது",
    stopped: [
      "அப்படியென்றால் இங்கே நிறுத்துகிறோம். நீங்கள் சொன்ன அனைத்தையும் நீக்குகிறேன்.",
      "{age} வயதில் திரும்பி வாருங்கள், நான் இங்கே இருப்பேன்.",
    ],
    endedPlaceholder: "eait {age} வயது மற்றும் அதற்கு மேற்பட்டவர்களுக்கானது",
  },
  belowHealthy:  {
    title: "அதை இலக்காக அமைக்க முடியாது",
    body: "உங்கள் உயரத்திற்கான மிகக் குறைந்த ஆரோக்கியமான எடை சுமார் {kg} kg. அதற்குக் கீழ் இலக்கை அமைக்க மாட்டோம். வேறு ஏதாவது திட்டத்தில் மருத்துவருடன் இணைந்து செயல்பட்டால், இந்த ஆப்பை விட அவரது ஆலோசனையைப் பின்பற்றுங்கள்.",
  },
  invalid:  {
    age: "அது வயது போலத் தெரியவில்லை — 34 போல ஏதாவது முயலுங்கள்.",
    height_cm: "சென்டிமீட்டரில் — 175 போல.",
    weight_kg: "கிலோகிராமில் — தோராயமாகச் சொன்னாலும் பரவாயில்லை.",
    target_weight_kg: "kg-இல் ஒரு எண் — 70 போல.",
  },
  ambiguousAge:  {
    line: "சரியாகப் புரிந்துகொண்டேனா என உறுதிசெய்ய — {year} என்ற ஆண்டைக் குறித்தீர்கள் என்றால், நான்கு இலக்கங்களையும் அனுப்புங்கள்.",
    confirm: "என் வயது {age}",
  },
  direction:  {
    gain: "உங்கள் எடை {weight} kg, இலக்காக {target} வரை அதிகரிக்கக் கேட்டீர்கள் — இங்கிருந்து அது அதிகரிப்பு அல்ல. குறிக்கோள் மாறியிருந்தால், அதை மாற்றலாம்; இல்லையெனில் {weight} ஐ விட அதிகமான ஓர் எண்ணைத் தாருங்கள்.",
    lose: "உங்கள் எடை {weight} kg, இலக்காக {target} வரை குறைக்கக் கேட்டீர்கள் — இங்கிருந்து அது குறைப்பு அல்ல. குறிக்கோள் மாறியிருந்தால், அதை மாற்றலாம்; இல்லையெனில் {weight} ஐ விடக் குறைவான ஓர் எண்ணைத் தாருங்கள்.",
    switchToLose: "எடை குறைப்புக்கு மாறு",
    switchToGain: "எடை அதிகரிப்புக்கு மாறு",
    above: "{weight} ஐ விட அதிகமான எண்…",
    below: "{weight} ஐ விடக் குறைவான எண்…",
  },
  switched:  {
    gain: "மாற்றப்பட்டது — எடை அதிகரிப்புதான். எந்த எடையை அடைய விரும்புகிறீர்கள், kg-இல்?",
    lose: "மாற்றப்பட்டது — எடை குறைப்புதான். எந்த எடையை அடைய விரும்புகிறீர்கள், kg-இல்? இங்கே வேகமாகச் செல்வது சிறந்தது அல்ல — தக்கவைப்பதுதான் கடினமாகும்.",
  },
  capNoteTail:  " அது வாரத்திற்குச் சுமார் {kg} kg.",
  goalEdit:  {
    cleared: "உங்கள் இலக்கு எடை அந்தக் குறிக்கோளுக்குப் பொருந்தவில்லை, அதனால் அது அகற்றப்பட்டது — புதிய ஒன்றை அமையுங்கள்.",
    worthSetting: "பதிவுசெய்யப்பட்டது. ஆனால் உங்கள் இலக்கு எடை இப்போது உங்கள் குறிக்கோளுக்குப் பொருந்தவில்லை — புதிய ஒன்றை அமைப்பது நல்லது.",
  },
  target: {
    // "55 · lowest we set" under the range's floor, "74 · now" beside today, "− 6kg" the
    // answer's distance from it.
    lowest: "{weight} · நாங்கள் அமைக்கும் குறைந்தபட்சம்",
    now: "{weight} · இப்போது",
    nowLowest: "{weight} · இப்போது · நாங்கள் அமைக்கும் குறைந்தபட்சம்",
    deltaDown: "− {weight}",
    deltaUp: "+ {weight}",
  },
  pace: {
    rate: "வாரத்திற்கு {rate}",
    rateSuffix: "வாரத்திற்கு",
    result: "{month} வாக்கில் {target} · ஒரு நாளைக்கு {kcal} kcal",
    capMarker: "பாதுகாப்பான வரம்பில் கட்டுப்படுத்தப்பட்டது",
    floorMarker: "எப்போதும் குறைந்தது {floor} · எல்லா வேகமும் இங்கே வந்து சேரும்",
    echo: "{from} முதல் {to} வரை.",
  },
  how: {
    title: "eait எப்படிச் செயல்படுகிறது",
    meal: "சால்மன், சாதம், கீரைகள்",
    photoAlt: "வியூஃபைண்டரில் ஒரு தானியக் கிண்ணம்",
    steps: ["தட்டைப் புகைப்படம் எடுங்கள்", "நேர்மையான மேக்ரோக்களைப் பெறுங்கள்", "உங்கள் முன்னேற்றத்தைப் பாருங்கள்"],
  },
  units: { years: "ஆண்டுகள்", yearsCount: { one: "{n} ஆண்டு", other: "{n} ஆண்டுகள்" } },
  twice: {
    title: "இரு மடங்கு எடையைக் குறையுங்கள்",
    sub: "சாப்பிடுவதை எழுதி வைப்பவர்கள் இரு மடங்கு எடையைக் குறைக்கிறார்கள்",
    without: "பதிவுசெய்யாமல்",
    with: "eait உடன்",
    source: "Hollis et al., Am J Prev Med, 2008",
    alt: "பதிவுசெய்யாமல்: 1×; eait உடன்: 2×",
  },
  baseline: {
    title: "இதோ உங்கள் தொடக்க நிலை",
    bmi: "உடல் நிறை குறியீட்டெண் (BMI)",
    bands: { under: "குறைந்த எடை", healthy: "ஆரோக்கியமானது", over: "அதிக எடை", obese: "உடல் பருமன்" },
    verdict: { under: "உங்கள் BMI ஆரோக்கியமான வரம்பை விடக் குறைவு", healthy: "உங்கள் BMI ஆரோக்கியமான வரம்பில் உள்ளது", above: "உங்கள் BMI ஆரோக்கியமான வரம்பை விட அதிகம்" },
    note: "உங்கள் திட்டம் இதைக் கணக்கில் கொள்கிறது.",
    you: "நீங்கள்",
    body: "உயரம் · எடை",
    activity: "செயல்பாடு",
  },
  possible: { lose: "{delta} குறைவா? யதார்த்தமானது, சாத்தியமும் கூட!", gain: "{delta} அதிகமா? யதார்த்தமானது, சாத்தியமும் கூட!" },
  ageWhy: "வயதுடன் உங்கள் வளர்சிதை மாற்றம் மாறுகிறது, அதனால் அதைக் கணக்கில் கொள்கிறோம்",
  ontrack: {
    title: "உங்களைச் சரியான பாதையில் வைக்க உருவாக்கப்பட்டது",
    captions: {
      consistency: "ஒரு நாள் தவறினால் இழப்பு இல்லை. அடுத்த நாள் பூஜ்ஜியத்திலிருந்து தொடங்கும்.",
      habits: "எதுவும் தடை இல்லை. ஒவ்வொரு தட்டுக்கும் நேர்மையான மேக்ரோக்கள்.",
      support: "அரட்டையில் {coach} இடம் எதையும், எப்போது வேண்டுமானாலும் கேளுங்கள்.",
      busy: "ஒரு புகைப்படமே முழுப் பதிவு.",
      ideas: "இரவு உணவுக்கு யோசனை இல்லையா? மீதமுள்ளதில் எது பொருந்தும் என்று {coach} இடம் கேளுங்கள்.",
    },
  },
  chart: {
    byEait: "eait உடன்",
    weightTrend: "எடைப் போக்கு",
    without: "இல்லாமல்",
    now: "இப்போது",
    later: "பின்னர்",
    twoWays: "காலப்போக்கில் எடை, இரண்டு விதமாக: திட்டத்துடனும் திட்டம் இல்லாமலும்",
    estimatedProgress: "மதிப்பிடப்பட்ட முன்னேற்றம்",
    estimate: "மதிப்பீடு",
    target: "இலக்கு {weight}",
        monthEstimate: "{month} · மதிப்பீடு",
    estimateAria: "மதிப்பிடப்பட்ட எடை: இப்போது {from}, {month} வாக்கில் {to}",
  },
  plan: {
    goalLose: "இலக்கு: −{delta} · {month} வரை",
    goalGain: "இலக்கு: +{delta} · {month} வரை",
    goalMaintain: "இலக்கு: என் எடையைத் தக்கவைப்பது",
    rest: "ஓய்வில் உங்கள் உடல் எரிப்பது", activity: "உங்கள் செயல்பாட்டுடன், சுமார்", pace: "உங்கள் வேகத்திற்கு ஏற்ப, சரிசெய்கிறோம்", floor: "நாங்கள் கடக்காத குறைந்தபட்ச வரம்பு", protein: "இலக்காகக் கொள்ள வேண்டிய புரதம்",
  },
  health: {
    title: "சுகாதாரத்துடன் ஒத்திசை",
    body: "எடையும் செயல்பாடும் இங்கே வரும். உங்கள் உணவுகள் சுகாதாரத்திற்குச் செல்லும்.",
  },
  targetSuggestion:  {
    down: "நான் பரிந்துரைப்பது {weight}, சுமார் {pct}% குறைவு, நல்ல முதல் இலக்கு",
    up: "நான் பரிந்துரைப்பது {weight}, சுமார் {pct}% அதிகம், நல்ல முதல் இலக்கு",
  },
  firstMeal:  FIRST_MEAL_COPY.ta!,
  stepper:  { continue: "தொடர்க", less: "குறைவு", more: "அதிகம்" },
  offerHeadline:  "{month} க்குள் {kg} kg-ஐ அடையுங்கள்",
  planGoal: { metric: "இலக்கு: −{n} kg · {month} வரை", imperial: "இலக்கு: −{n} lb · {month} வரை" },
};

const PA: ChatCopy = {
  idlePlaceholder:  "Spud ਨੂੰ ਮੈਸੇਜ ਕਰੋ…",
  continueLabel: "ਜਾਰੀ ਰੱਖੋ",
  saveKept: "ਇਹ ਸੇਵ ਨਹੀਂ ਹੋ ਸਕਿਆ। ਤੁਹਾਡਾ ਜਵਾਬ ਹਾਲੇ ਵੀ ਇੱਥੇ ਹੈ। ਜਾਰੀ ਰੱਖੋ ਦਬਾਉਣ 'ਤੇ ਇਹ ਦੁਬਾਰਾ ਭੇਜਿਆ ਜਾਵੇਗਾ।",
  underAgeCard:  {
    title: "eait {age} ਸਾਲ ਅਤੇ ਉਸ ਤੋਂ ਵੱਧ ਉਮਰ ਲਈ ਹੈ",
    body: "ਇਹ ਐਪ ਜਿਸ ਤਰ੍ਹਾਂ ਕੈਲੋਰੀ ਟੀਚੇ ਤੈਅ ਕਰਦੀ ਹੈ, ਉਹ ਵਧ ਰਹੇ ਸਰੀਰ ਲਈ ਨਹੀਂ ਬਣਿਆ।",
  },
  underAge:  {
    ask: "ਮਾਫ਼ ਕਰਨਾ — ਇੱਥੇ ਹੀ ਰੁਕਣਾ ਪਵੇਗਾ। ਜੇ ਟਾਈਪਿੰਗ ਦੀ ਗ਼ਲਤੀ ਨਾਲ ਇਹ ਹੋਇਆ ਹੈ, ਤਾਂ ਬੱਸ ਆਪਣੀ ਅਸਲੀ ਉਮਰ ਭੇਜੋ।",
    confirm: "ਇਹੀ ਮੇਰੀ ਅਸਲੀ ਉਮਰ ਹੈ",
    placeholder: "ਤੁਹਾਡੀ ਉਮਰ",
    stopped: [
      "ਤਾਂ ਅਸੀਂ ਇੱਥੇ ਹੀ ਰੁਕਦੇ ਹਾਂ। ਤੁਹਾਡੀ ਦੱਸੀ ਹਰ ਗੱਲ ਡਿਲੀਟ ਕੀਤੀ ਜਾ ਰਹੀ ਹੈ।",
      "{age} ਸਾਲ ਦੀ ਉਮਰ ਵਿੱਚ ਵਾਪਸ ਆਓ, ਮੈਂ ਇੱਥੇ ਹੀ ਹਾਂ।",
    ],
    endedPlaceholder: "eait {age} ਸਾਲ ਅਤੇ ਉਸ ਤੋਂ ਵੱਧ ਉਮਰ ਲਈ ਹੈ",
  },
  belowHealthy:  {
    title: "ਇਸ ਨੂੰ ਟੀਚਾ ਨਹੀਂ ਬਣਾਇਆ ਜਾ ਸਕਦਾ",
    body: "ਤੁਹਾਡੇ ਕੱਦ ਲਈ ਸਭ ਤੋਂ ਘੱਟ ਸਿਹਤਮੰਦ ਭਾਰ ਲਗਭਗ {kg} kg ਹੈ। ਅਸੀਂ ਇਸ ਤੋਂ ਘੱਟ ਟੀਚਾ ਨਹੀਂ ਰੱਖਦੇ। ਜੇ ਕਿਸੇ ਡਾਕਟਰ ਨਾਲ ਕੁਝ ਹੋਰ ਤੈਅ ਹੋਇਆ ਹੈ, ਤਾਂ ਇਸ ਐਪ ਦੀ ਬਜਾਏ ਉਨ੍ਹਾਂ ਦੀ ਸਲਾਹ ਮੰਨੋ।",
  },
  invalid:  {
    age: "ਇਹ ਉਮਰ ਵਰਗਾ ਨਹੀਂ ਲੱਗਦਾ — ਕੁਝ ਇਸ ਤਰ੍ਹਾਂ ਲਿਖੋ, ਜਿਵੇਂ 34।",
    height_cm: "ਸੈਂਟੀਮੀਟਰ ਵਿੱਚ — ਜਿਵੇਂ 175।",
    weight_kg: "ਕਿਲੋਗ੍ਰਾਮ ਵਿੱਚ — ਅੰਦਾਜ਼ੇ ਨਾਲ ਵੀ ਚੱਲੇਗਾ।",
    target_weight_kg: "kg ਵਿੱਚ ਇੱਕ ਨੰਬਰ — ਜਿਵੇਂ 70।",
  },
  ambiguousAge:  {
    line: "ਬੱਸ ਪੱਕਾ ਕਰ ਲਈਏ: ਜੇ ਤੁਹਾਡਾ ਮਤਲਬ ਸਾਲ {year} ਤੋਂ ਸੀ, ਤਾਂ ਚਾਰੇ ਅੰਕ ਭੇਜੋ।",
    confirm: "ਮੇਰੀ ਉਮਰ {age} ਹੈ",
  },
  direction:  {
    gain: "ਤੁਹਾਡਾ ਭਾਰ ਹੁਣ {weight} kg ਹੈ ਅਤੇ ਟੀਚਾ {target} ਤੱਕ ਵਧਾਉਣ ਦਾ ਹੈ — ਇੱਥੋਂ ਇਹ ਵਾਧਾ ਨਹੀਂ ਹੈ। ਜੇ ਟੀਚਾ ਬਦਲ ਗਿਆ ਹੈ, ਤਾਂ ਅਸੀਂ ਇਸ ਨੂੰ ਬਦਲ ਸਕਦੇ ਹਾਂ; ਨਹੀਂ ਤਾਂ {weight} ਤੋਂ ਵੱਧ ਕੋਈ ਨੰਬਰ ਦਿਓ।",
    lose: "ਤੁਹਾਡਾ ਭਾਰ ਹੁਣ {weight} kg ਹੈ ਅਤੇ ਟੀਚਾ {target} ਤੱਕ ਘਟਾਉਣ ਦਾ ਹੈ — ਇੱਥੋਂ ਇਹ ਕਮੀ ਨਹੀਂ ਹੈ। ਜੇ ਟੀਚਾ ਬਦਲ ਗਿਆ ਹੈ, ਤਾਂ ਅਸੀਂ ਇਸ ਨੂੰ ਬਦਲ ਸਕਦੇ ਹਾਂ; ਨਹੀਂ ਤਾਂ {weight} ਤੋਂ ਘੱਟ ਕੋਈ ਨੰਬਰ ਦਿਓ।",
    switchToLose: "ਭਾਰ ਘਟਾਉਣ 'ਤੇ ਬਦਲੋ",
    switchToGain: "ਭਾਰ ਵਧਾਉਣ 'ਤੇ ਬਦਲੋ",
    above: "{weight} ਤੋਂ ਵੱਧ ਕੋਈ ਨੰਬਰ…",
    below: "{weight} ਤੋਂ ਘੱਟ ਕੋਈ ਨੰਬਰ…",
  },
  switched:  {
    gain: "ਬਦਲ ਦਿੱਤਾ — ਤਾਂ ਭਾਰ ਵਧਾਉਣਾ ਹੈ। ਟੀਚਾ ਕਿੰਨਾ ਰੱਖੀਏ, kg ਵਿੱਚ?",
    lose: "ਬਦਲ ਦਿੱਤਾ — ਤਾਂ ਭਾਰ ਘਟਾਉਣਾ ਹੈ। ਟੀਚਾ ਕਿੰਨਾ ਰੱਖੀਏ, kg ਵਿੱਚ? ਇੱਥੇ ਤੇਜ਼ ਹੋਣਾ ਬਿਹਤਰ ਨਹੀਂ — ਬੱਸ ਉਸ ਨੂੰ ਬਣਾਈ ਰੱਖਣਾ ਔਖਾ ਹੁੰਦਾ ਹੈ।",
  },
  capNoteTail:  " ਇਹ ਲਗਭਗ {kg} kg ਪ੍ਰਤੀ ਹਫ਼ਤਾ ਹੈ।",
  goalEdit:  {
    cleared: "ਤੁਹਾਡਾ ਟੀਚਾ ਭਾਰ ਹੁਣ ਉਸ ਟੀਚੇ ਨਾਲ ਮੇਲ ਨਹੀਂ ਖਾਂਦਾ ਸੀ, ਇਸ ਲਈ ਇਸ ਨੂੰ ਹਟਾ ਦਿੱਤਾ ਗਿਆ — ਨਵਾਂ ਸੈੱਟ ਕਰੋ।",
    worthSetting: "ਨੋਟ ਕਰ ਲਿਆ। ਪਰ ਤੁਹਾਡਾ ਟੀਚਾ ਭਾਰ ਹੁਣ ਤੁਹਾਡੇ ਟੀਚੇ ਨਾਲ ਮੇਲ ਨਹੀਂ ਖਾਂਦਾ — ਨਵਾਂ ਸੈੱਟ ਕਰਨਾ ਚੰਗਾ ਰਹੇਗਾ।",
  },
  target: {
    // "55 · lowest we set" under the range's floor, "74 · now" beside today, "− 6kg" the
    // answer's distance from it.
    lowest: "{weight} · ਸਾਡਾ ਘੱਟੋ-ਘੱਟ",
    now: "{weight} · ਹੁਣ",
    nowLowest: "{weight} · ਹੁਣ · ਸਾਡਾ ਘੱਟੋ-ਘੱਟ",
    deltaDown: "− {weight}",
    deltaUp: "+ {weight}",
  },
  pace: {
    rate: "{rate} ਪ੍ਰਤੀ ਹਫ਼ਤਾ",
    rateSuffix: "ਪ੍ਰਤੀ ਹਫ਼ਤਾ",
    result: "{month} ਦੇ ਆਸ-ਪਾਸ {target} · {kcal} kcal ਪ੍ਰਤੀ ਦਿਨ",
    capMarker: "ਸੁਰੱਖਿਅਤ ਸੀਮਾ 'ਤੇ ਰੋਕਿਆ ਗਿਆ",
    floorMarker: "{floor} ਤੋਂ ਕਦੇ ਘੱਟ ਨਹੀਂ · ਹਰ ਰਫ਼ਤਾਰ ਇੱਥੇ ਹੀ ਆਉਂਦੀ ਹੈ",
    echo: "{from} ਤੋਂ {to} ਤੱਕ।",
  },
  how: {
    title: "eait ਕਿਵੇਂ ਕੰਮ ਕਰਦਾ ਹੈ",
    meal: "ਸੈਲਮਨ, ਚੌਲ, ਹਰੀਆਂ ਸਬਜ਼ੀਆਂ",
    photoAlt: "ਵਿਊਫ਼ਾਈਂਡਰ ਵਿੱਚ ਅਨਾਜ ਦਾ ਬਾਊਲ",
    steps: ["ਪਲੇਟ ਦੀ ਫ਼ੋਟੋ ਲਓ", "ਇਮਾਨਦਾਰ ਮੈਕਰੋ ਪਾਓ", "ਆਪਣੀ ਪ੍ਰਗਤੀ ਦੇਖੋ"],
  },
  units: { years: "ਸਾਲ", yearsCount: { one: "{n} ਸਾਲ", other: "{n} ਸਾਲ" } },
  twice: {
    title: "ਦੁੱਗਣਾ ਭਾਰ ਘਟਾਓ",
    sub: "ਜੋ ਲੋਕ ਆਪਣਾ ਖਾਣਾ ਲਿਖਦੇ ਹਨ, ਉਨ੍ਹਾਂ ਦਾ ਭਾਰ ਦੁੱਗਣਾ ਘਟਦਾ ਹੈ",
    without: "ਬਿਨਾਂ ਦਰਜ ਕੀਤੇ",
    with: "eait ਨਾਲ",
    source: "Hollis et al., Am J Prev Med, 2008",
    alt: "ਬਿਨਾਂ ਦਰਜ ਕੀਤੇ: 1×; eait ਨਾਲ: 2×",
  },
  baseline: {
    title: "ਇਹ ਰਿਹਾ ਤੁਹਾਡਾ ਸ਼ੁਰੂਆਤੀ ਆਧਾਰ",
    bmi: "ਬਾਡੀ ਮਾਸ ਇੰਡੈਕਸ (BMI)",
    bands: { under: "ਘੱਟ ਭਾਰ", healthy: "ਸਿਹਤਮੰਦ", over: "ਵੱਧ ਭਾਰ", obese: "ਮੋਟਾਪਾ" },
    verdict: { under: "ਤੁਹਾਡਾ BMI ਸਿਹਤਮੰਦ ਦਾਇਰੇ ਤੋਂ ਘੱਟ ਹੈ", healthy: "ਤੁਹਾਡਾ BMI ਸਿਹਤਮੰਦ ਦਾਇਰੇ ਵਿੱਚ ਹੈ", above: "ਤੁਹਾਡਾ BMI ਸਿਹਤਮੰਦ ਦਾਇਰੇ ਤੋਂ ਵੱਧ ਹੈ" },
    note: "ਤੁਹਾਡਾ ਪਲਾਨ ਇਸ ਨੂੰ ਧਿਆਨ ਵਿੱਚ ਰੱਖਦਾ ਹੈ।",
    you: "ਤੁਸੀਂ",
    body: "ਕੱਦ · ਭਾਰ",
    activity: "ਸਰਗਰਮੀ",
  },
  possible: { lose: "{delta} ਘੱਟ? ਵਿਹਾਰਕ ਹੈ, ਅਤੇ ਮੁਮਕਿਨ ਵੀ!", gain: "{delta} ਵੱਧ? ਵਿਹਾਰਕ ਹੈ, ਅਤੇ ਮੁਮਕਿਨ ਵੀ!" },
  ageWhy: "ਉਮਰ ਨਾਲ ਤੁਹਾਡਾ ਮੈਟਾਬੋਲਿਜ਼ਮ ਬਦਲਦਾ ਹੈ, ਇਸ ਲਈ ਅਸੀਂ ਇਸ ਨੂੰ ਧਿਆਨ ਵਿੱਚ ਰੱਖਦੇ ਹਾਂ",
  ontrack: {
    title: "ਤੁਹਾਨੂੰ ਸਹੀ ਰਾਹ 'ਤੇ ਰੱਖਣ ਲਈ ਬਣਿਆ",
    captions: {
      consistency: "ਇੱਕ ਦਿਨ ਛੁੱਟਣ ਨਾਲ ਕੁਝ ਨਹੀਂ ਵਿਗੜਦਾ। ਅਗਲਾ ਦਿਨ ਸਿਫ਼ਰ ਤੋਂ ਸ਼ੁਰੂ ਹੁੰਦਾ ਹੈ।",
      habits: "ਕੁਝ ਵੀ ਮਨ੍ਹਾ ਨਹੀਂ। ਹਰ ਪਲੇਟ ਨੂੰ ਇਮਾਨਦਾਰ ਮੈਕਰੋ ਮਿਲਦੇ ਹਨ।",
      support: "ਚੈਟ ਵਿੱਚ {coach} ਤੋਂ ਕੁਝ ਵੀ, ਕਦੇ ਵੀ ਪੁੱਛੋ।",
      busy: "ਦਰਜ ਕਰਨ ਲਈ ਬੱਸ ਇੱਕ ਫ਼ੋਟੋ।",
      ideas: "ਰਾਤ ਦੇ ਖਾਣੇ ਦਾ ਖ਼ਿਆਲ ਨਹੀਂ ਆ ਰਿਹਾ? {coach} ਤੋਂ ਪੁੱਛੋ ਕਿ ਬਾਕੀ ਵਿੱਚ ਕੀ ਫ਼ਿੱਟ ਹੋਵੇਗਾ।",
    },
  },
  chart: {
    byEait: "eait ਨਾਲ",
    weightTrend: "ਭਾਰ ਦਾ ਰੁਝਾਨ",
    without: "ਬਿਨਾਂ",
    now: "ਹੁਣ",
    later: "ਬਾਅਦ ਵਿੱਚ",
    twoWays: "ਸਮੇਂ ਨਾਲ ਭਾਰ, ਦੋ ਤਰ੍ਹਾਂ: ਪਲਾਨ ਨਾਲ ਅਤੇ ਬਿਨਾਂ",
    estimatedProgress: "ਅੰਦਾਜ਼ਨ ਪ੍ਰਗਤੀ",
    estimate: "ਅੰਦਾਜ਼ਾ",
    target: "ਟੀਚਾ {weight}",
        monthEstimate: "{month} · ਅੰਦਾਜ਼ਾ",
    estimateAria: "ਅੰਦਾਜ਼ਨ ਭਾਰ: ਹੁਣ {from}, {month} ਦੇ ਆਸ-ਪਾਸ {to}",
  },
  plan: {
    goalLose: "ਟੀਚਾ: −{delta} · {month} ਤੱਕ",
    goalGain: "ਟੀਚਾ: +{delta} · {month} ਤੱਕ",
    goalMaintain: "ਟੀਚਾ: ਭਾਰ ਬਣਾਈ ਰੱਖਣਾ",
    rest: "ਆਰਾਮ ਦੀ ਹਾਲਤ ਵਿੱਚ ਤੁਹਾਡਾ ਸਰੀਰ ਖ਼ਰਚ ਕਰਦਾ ਹੈ", activity: "ਤੁਹਾਡੀ ਸਰਗਰਮੀ ਨਾਲ, ਲਗਭਗ", pace: "ਤੁਹਾਡੀ ਰਫ਼ਤਾਰ ਮੁਤਾਬਕ, ਅਸੀਂ ਬਦਲਾਅ ਕਰਦੇ ਹਾਂ", floor: "ਘੱਟੋ-ਘੱਟ ਸੀਮਾ, ਜਿਸ ਤੋਂ ਹੇਠਾਂ ਅਸੀਂ ਨਹੀਂ ਜਾਂਦੇ", protein: "ਪ੍ਰੋਟੀਨ ਦਾ ਟੀਚਾ",
  },
  health: {
    title: "ਸਿਹਤ ਨਾਲ ਸਿੰਕ ਕਰੋ",
    body: "ਭਾਰ ਅਤੇ ਸਰਗਰਮੀ ਇੱਥੇ ਆਉਂਦੇ ਹਨ। ਤੁਹਾਡੇ ਖਾਣੇ ਸਿਹਤ ਵਿੱਚ ਜਾਂਦੇ ਹਨ।",
  },
  targetSuggestion:  {
    down: "ਮੇਰਾ ਸੁਝਾਅ ਹੈ {weight}, ਲਗਭਗ {pct}% ਘੱਟ, ਇੱਕ ਚੰਗਾ ਪਹਿਲਾ ਟੀਚਾ",
    up: "ਮੇਰਾ ਸੁਝਾਅ ਹੈ {weight}, ਲਗਭਗ {pct}% ਵੱਧ, ਇੱਕ ਚੰਗਾ ਪਹਿਲਾ ਟੀਚਾ",
  },
  firstMeal:  FIRST_MEAL_COPY.pa!,
  stepper:  { continue: "ਜਾਰੀ ਰੱਖੋ", less: "ਘੱਟ", more: "ਵੱਧ" },
  offerHeadline:  "{month} ਤੱਕ {kg} kg ਤੱਕ ਪਹੁੰਚੋ",
  planGoal: { metric: "ਟੀਚਾ: −{n} kg · {month} ਤੱਕ", imperial: "ਟੀਚਾ: −{n} lb · {month} ਤੱਕ" },
};

const OR: ChatCopy = {
  idlePlaceholder:  "Spud କୁ ମେସେଜ୍ କରନ୍ତୁ…",
  continueLabel: "ଜାରି ରଖନ୍ତୁ",
  saveKept: "ଏହା ସେଭ୍ ହୋଇପାରିଲା ନାହିଁ। ଆପଣଙ୍କ ଉତ୍ତର ଏଠାରେ ଅଛି। “ଜାରି ରଖନ୍ତୁ” ଦବାଇଲେ ଏହା ପୁଣି ପଠାହେବ।",
  underAgeCard:  {
    title: "eait {age} ବର୍ଷ ଓ ତଦୂର୍ଧ୍ୱ ପାଇଁ",
    body: "ଏହି ଆପ୍ ଯେଉଁ ଉପାୟରେ କ୍ୟାଲୋରୀ ଲକ୍ଷ୍ୟ ସ୍ଥିର କରେ, ତାହା ଏବେ ବି ବଢ଼ୁଥିବା ଶରୀର ପାଇଁ ତିଆରି ନୁହେଁ।",
  },
  underAge:  {
    ask: "ଦୁଃଖିତ — ମୋତେ ଏଠାରେ ରହିଯିବାକୁ ପଡ଼ିବ। ଯଦି ଟାଇପିଂ ଭୁଲ୍ ପାଇଁ ଏପରି ହେଲା, ତେବେ କେବଳ ଆପଣଙ୍କ ପ୍ରକୃତ ବୟସ ପଠାନ୍ତୁ।",
    confirm: "ଏହା ମୋର ପ୍ରକୃତ ବୟସ",
    placeholder: "ଆପଣଙ୍କ ବୟସ",
    stopped: [
      "ତେବେ ଆମେ ଏଠାରେ ରହିଯିବା। ଆପଣ ମୋତେ କହିଥିବା ସବୁକିଛି ମୁଁ ଡିଲିଟ୍ କରୁଛି।",
      "{age} ବର୍ଷ ହେଲେ ଫେରି ଆସନ୍ତୁ, ମୁଁ ଏଠାରେ ଥିବି।",
    ],
    endedPlaceholder: "eait {age} ବର୍ଷ ଓ ତଦୂର୍ଧ୍ୱ ପାଇଁ",
  },
  belowHealthy:  {
    title: "ମୁଁ ତାହାକୁ ଲକ୍ଷ୍ୟ ଭାବେ ସେଟ୍ କରିପାରିବି ନାହିଁ",
    body: "ଆପଣଙ୍କ ଉଚ୍ଚତା ପାଇଁ ସବୁଠୁ କମ୍ ସୁସ୍ଥ ଓଜନ ପ୍ରାୟ {kg} kg। ଆମେ ଏହାଠାରୁ କମ୍ ଲକ୍ଷ୍ୟ ରଖୁନାହୁଁ। ଯଦି ଆପଣ ଡାକ୍ତରଙ୍କ ସହ ଅଲଗା କିଛି ସ୍ଥିର କରିଛନ୍ତି, ତେବେ ଏହି ଆପ୍ ବଦଳରେ ତାଙ୍କ କଥା ମାନନ୍ତୁ।",
  },
  invalid:  {
    age: "ଏହା ବୟସ ପରି ଲାଗୁନାହିଁ — 34 ପରି କିଛି ଲେଖନ୍ତୁ।",
    height_cm: "ସେଣ୍ଟିମିଟରରେ — 175 ପରି।",
    weight_kg: "କିଲୋଗ୍ରାମରେ — ଆନୁମାନିକ ହେଲେ ବି ଚଳିବ।",
    target_weight_kg: "kg ରେ ଏକ ସଂଖ୍ୟା — 70 ପରି।",
  },
  ambiguousAge:  {
    line: "ମୁଁ ଠିକ୍ ପଢ଼ିଲି କି ନାହିଁ ନିଶ୍ଚିତ ହେବାକୁ ଚାହେଁ — ଯଦି ଆପଣ {year} ମସିହା କହିବାକୁ ଚାହୁଁଥିଲେ, ଚାରିଟି ଅଙ୍କ ପଠାନ୍ତୁ।",
    confirm: "ମୋ ବୟସ {age}",
  },
  direction:  {
    gain: "ଏବେ ଆପଣଙ୍କ ଓଜନ {weight} kg ଏବଂ ଲକ୍ଷ୍ୟ {target} — ଏଠାରୁ ଏହା ବୃଦ୍ଧି ନୁହେଁ। ଲକ୍ଷ୍ୟ ବଦଳିଥିଲେ, ଆମେ ତାହା ବଦଳାଇପାରିବା; ନଚେତ୍ {weight} ରୁ ଅଧିକ ଏକ ସଂଖ୍ୟା ଦିଅନ୍ତୁ।",
    lose: "ଏବେ ଆପଣଙ୍କ ଓଜନ {weight} kg ଏବଂ ଲକ୍ଷ୍ୟ {target} — ଏଠାରୁ ଏହା ହ୍ରାସ ନୁହେଁ। ଲକ୍ଷ୍ୟ ବଦଳିଥିଲେ, ଆମେ ତାହା ବଦଳାଇପାରିବା; ନଚେତ୍ {weight} ରୁ କମ୍ ଏକ ସଂଖ୍ୟା ଦିଅନ୍ତୁ।",
    switchToLose: "ଓଜନ କମାଇବାକୁ ବଦଳାନ୍ତୁ",
    switchToGain: "ଓଜନ ବଢ଼ାଇବାକୁ ବଦଳାନ୍ତୁ",
    above: "{weight} ରୁ ଅଧିକ ଏକ ସଂଖ୍ୟା…",
    below: "{weight} ରୁ କମ୍ ଏକ ସଂଖ୍ୟା…",
  },
  switched:  {
    gain: "ବଦଳିଗଲା — ତେବେ ଓଜନ ବଢ଼ାଇବା। kg ରେ କେତେ ପର୍ଯ୍ୟନ୍ତ ଯିବାକୁ ଚାହାଁନ୍ତି?",
    lose: "ବଦଳିଗଲା — ତେବେ ଓଜନ କମାଇବା। kg ରେ କେତେ ପର୍ଯ୍ୟନ୍ତ ଯିବାକୁ ଚାହାଁନ୍ତି? ଏଠାରେ ଦ୍ରୁତ ମାନେ ଭଲ ନୁହେଁ — କେବଳ ବଜାୟ ରଖିବା କଷ୍ଟକର।",
  },
  capNoteTail:  " ଏହା ସପ୍ତାହକୁ ପ୍ରାୟ {kg} kg।",
  goalEdit:  {
    cleared: "ଆପଣଙ୍କ ଲକ୍ଷ୍ୟ ଓଜନ ଆଉ ସେହି ଲକ୍ଷ୍ୟ ସହ ମେଳ ଖାଉ ନ ଥିଲା, ତେଣୁ ଏହାକୁ ହଟାଯାଇଛି — ଏକ ନୂଆ ସେଟ୍ କରନ୍ତୁ।",
    worthSetting: "ଦର୍ଜ ହେଲା। ତେବେ ଆପଣଙ୍କ ଲକ୍ଷ୍ୟ ଓଜନ ଆଉ ଆପଣଙ୍କ ଲକ୍ଷ୍ୟ ସହ ମେଳ ଖାଉନାହିଁ — ଏକ ନୂଆ ସେଟ୍ କରିବା ଭଲ।",
  },
  target: {
    // "55 · lowest we set" under the range's floor, "74 · now" beside today, "− 6kg" the
    // answer's distance from it.
    lowest: "{weight} · ଆମର ସର୍ବନିମ୍ନ",
    now: "{weight} · ଏବେ",
    nowLowest: "{weight} · ଏବେ · ଆମର ସର୍ବନିମ୍ନ",
    deltaDown: "− {weight}",
    deltaUp: "+ {weight}",
  },
  pace: {
    rate: "{rate} ପ୍ରତି ସପ୍ତାହ",
    rateSuffix: "ପ୍ରତି ସପ୍ତାହ",
    result: "{month} ଆଖପାଖରେ {target} · {kcal} kcal ପ୍ରତିଦିନ",
    capMarker: "ସୁରକ୍ଷିତ ସୀମାରେ ସୀମିତ",
    floorMarker: "{floor} ରୁ କେବେ କମ୍ ନୁହେଁ · ସବୁ ଗତି ଏଠାରେ ପହଞ୍ଚେ",
    echo: "{from} ରୁ {to} ପର୍ଯ୍ୟନ୍ତ।",
  },
  how: {
    title: "eait କିପରି କାମ କରେ",
    meal: "ସାଲମନ୍, ଭାତ, ସବୁଜ ପରିବା",
    photoAlt: "ଭ୍ୟୁଫାଇଣ୍ଡରରେ ଏକ ଶସ୍ୟ ବାଉଲ୍",
    steps: ["ପ୍ଲେଟ୍‌ର ଫଟୋ ନିଅନ୍ତୁ", "ସଚ୍ଚୋଟ ମାକ୍ରୋ ପାଆନ୍ତୁ", "ଆପଣଙ୍କ ପ୍ରଗତି ଦେଖନ୍ତୁ"],
  },
  units: { years: "ବର୍ଷ", yearsCount: { one: "{n} ବର୍ଷ", other: "{n} ବର୍ଷ" } },
  twice: {
    title: "ଦୁଇଗୁଣ ଓଜନ କମାନ୍ତୁ",
    sub: "ଯେଉଁମାନେ ନିଜେ ଖାଉଥିବା ଖାଦ୍ୟ ଲେଖି ରଖନ୍ତି, ସେମାନଙ୍କ ଓଜନ ଦୁଇଗୁଣ କମେ",
    without: "ଲଗ୍ ନ କରି",
    with: "eait ସହ",
    source: "Hollis et al., Am J Prev Med, 2008",
    alt: "ଲଗ୍ ନ କରି: 1×; eait ସହ: 2×",
  },
  baseline: {
    title: "ଏହା ଆପଣଙ୍କ ଆରମ୍ଭିକ ଆଧାର",
    bmi: "ବଡି ମାସ୍ ଇଣ୍ଡେକ୍ସ (BMI)",
    bands: { under: "କମ୍ ଓଜନ", healthy: "ସୁସ୍ଥ", over: "ଅଧିକ ଓଜନ", obese: "ମେଦବହୁଳତା" },
    verdict: { under: "ଆପଣଙ୍କ BMI ସୁସ୍ଥ ପରିସରଠାରୁ କମ୍", healthy: "ଆପଣଙ୍କ BMI ସୁସ୍ଥ ପରିସର ମଧ୍ୟରେ", above: "ଆପଣଙ୍କ BMI ସୁସ୍ଥ ପରିସରଠାରୁ ଅଧିକ" },
    note: "ଆପଣଙ୍କ ପ୍ଲାନ୍ ଏହାକୁ ଧ୍ୟାନରେ ରଖେ।",
    you: "ଆପଣ",
    body: "ଉଚ୍ଚତା · ଓଜନ",
    activity: "ସକ୍ରିୟତା",
  },
  possible: { lose: "{delta} କମ୍? ବାସ୍ତବସମ୍ମତ, ଏବଂ ସମ୍ଭବ!", gain: "{delta} ଅଧିକ? ବାସ୍ତବସମ୍ମତ, ଏବଂ ସମ୍ଭବ!" },
  ageWhy: "ବୟସ ସହ ଆପଣଙ୍କ ମେଟାବୋଲିଜମ୍ ବଦଳେ, ତେଣୁ ଆମେ ତାହା ହିସାବକୁ ନେଉ",
  ontrack: {
    title: "ଆପଣଙ୍କୁ ସଠିକ୍ ବାଟରେ ରଖିବା ପାଇଁ ତିଆରି",
    captions: {
      consistency: "ଗୋଟିଏ ଦିନ ଛାଡ଼ିଗଲେ କିଛି କ୍ଷତି ନାହିଁ। ପରଦିନ ଶୂନରୁ ଆରମ୍ଭ।",
      habits: "କିଛି ବି ମନା ନୁହେଁ। ପ୍ରତି ପ୍ଲେଟ୍ ସଚ୍ଚୋଟ ମାକ୍ରୋ ପାଏ।",
      support: "ଚାଟ୍‌ରେ ଯେକୌଣସି ସମୟରେ, ଯେକୌଣସି କଥା {coach} ପାଖରେ ପଚାରନ୍ତୁ।",
      busy: "ଗୋଟିଏ ଫଟୋ ହିଁ ପୂରା ଲଗ୍।",
      ideas: "ରାତ୍ରି ଭୋଜନ ପାଇଁ ଆଇଡିଆ ନାହିଁ? ବାକି ପରିମାଣରେ କ'ଣ ଖାପ ଖାଏ, {coach} ପାଖରେ ପଚାରନ୍ତୁ।",
    },
  },
  chart: {
    byEait: "eait ସହ",
    weightTrend: "ଓଜନ ଧାରା",
    without: "ବିନା",
    now: "ଏବେ",
    later: "ପରେ",
    twoWays: "ସମୟ ସହ ଓଜନ, ଦୁଇ ଉପାୟରେ: ପ୍ଲାନ୍ ସହ ଓ ବିନା",
    estimatedProgress: "ଆନୁମାନିକ ପ୍ରଗତି",
    estimate: "ଅନୁମାନ",
    target: "ଲକ୍ଷ୍ୟ {weight}",
        monthEstimate: "{month} · ଅନୁମାନ",
    estimateAria: "ଆନୁମାନିକ ଓଜନ: ଏବେ {from}, {month} ଆଖପାଖରେ {to}",
  },
  plan: {
    goalLose: "ଲକ୍ଷ୍ୟ: {month} ସୁଦ୍ଧା {delta} କମାଇବା",
    goalGain: "ଲକ୍ଷ୍ୟ: {month} ସୁଦ୍ଧା {delta} ବଢ଼ାଇବା",
    goalMaintain: "ଲକ୍ଷ୍ୟ: ମୋ ଓଜନ ବଜାୟ ରଖିବା",
    rest: "ବିଶ୍ରାମରେ ଆପଣଙ୍କ ଶରୀର ଖର୍ଚ୍ଚ କରେ", activity: "ଆପଣଙ୍କ ସକ୍ରିୟତା ସହ, ପ୍ରାୟ", pace: "ଆପଣଙ୍କ ଗତି ପାଇଁ, ଆମେ ସଜାଡ଼ୁ", floor: "ଯେଉଁ ସୀମା ଆମେ ପାର କରୁନାହୁଁ", protein: "ପ୍ରୋଟିନ୍ ଲକ୍ଷ୍ୟ",
  },
  health: {
    title: "ସ୍ୱାସ୍ଥ୍ୟ ସହ ସିଙ୍କ୍ କରନ୍ତୁ",
    body: "ଓଜନ ଓ ସକ୍ରିୟତା ଏଠାକୁ ଆସେ। ଆପଣଙ୍କ ଭୋଜନ ସ୍ୱାସ୍ଥ୍ୟକୁ ଯାଏ।",
  },
  targetSuggestion:  {
    down: "ମୋ ପରାମର୍ଶ {weight}, ପ୍ରାୟ {pct}% କମ୍, ଏକ ଭଲ ପ୍ରଥମ ଲକ୍ଷ୍ୟ",
    up: "ମୋ ପରାମର୍ଶ {weight}, ପ୍ରାୟ {pct}% ଅଧିକ, ଏକ ଭଲ ପ୍ରଥମ ଲକ୍ଷ୍ୟ",
  },
  firstMeal:  FIRST_MEAL_COPY.or!,
  stepper:  { continue: "ଜାରି ରଖନ୍ତୁ", less: "କମ୍", more: "ଅଧିକ" },
  offerHeadline:  "{month} ସୁଦ୍ଧା {kg} kg ରେ ପହଞ୍ଚନ୍ତୁ",
  planGoal: { metric: "ଲକ୍ଷ୍ୟ: {month} ସୁଦ୍ଧା {n} kg କମାଇବା", imperial: "ଲକ୍ଷ୍ୟ: {month} ସୁଦ୍ଧା {n} lb କମାଇବା" },
};

const MR: ChatCopy = {
  idlePlaceholder:  "Spud ला मेसेज करा…",
  continueLabel: "पुढे जा",
  saveKept: "हे सेव्ह करता आले नाही. तुमचे उत्तर अजून इथेच आहे. पुढे जा दाबल्यास ते पुन्हा पाठवले जाईल.",
  underAgeCard:  {
    title: "eait {age} आणि त्यापुढील वयासाठी आहे",
    body: "हे ॲप ज्या पद्धतीने कॅलरी लक्ष्य ठरवते, ती अजून वाढत असलेल्या शरीरासाठी बनवलेली नाही.",
  },
  underAge:  {
    ask: "माफ करा — मला इथे थांबावे लागेल. टायपिंगच्या चुकीमुळे असे झाले असल्यास, फक्त तुमचे खरे वय पाठवा.",
    confirm: "हेच माझे खरे वय आहे",
    placeholder: "तुमचे वय",
    stopped: [
      "मग आपण इथेच थांबूया. तुम्ही मला सांगितलेले सर्व मी हटवत आहे.",
      "वय {age} झाल्यावर परत या, मी इथेच असेन.",
    ],
    endedPlaceholder: "eait {age} आणि त्यापुढील वयासाठी आहे",
  },
  belowHealthy:  {
    title: "हे लक्ष्य म्हणून ठेवता येत नाही",
    body: "तुमच्या उंचीसाठी सर्वात कमी निरोगी वजन सुमारे {kg} kg आहे. आम्ही याच्या खाली ध्येय ठेवणार नाही. डॉक्टरांसोबत काही वेगळे ठरले असल्यास, या ॲपऐवजी त्यांचा सल्ला पाळा.",
  },
  invalid:  {
    age: "हे वय वाटत नाही — 34 सारखे काहीतरी लिहा.",
    height_cm: "सेंटीमीटरमध्ये — 175 सारखे.",
    weight_kg: "किलोग्रॅममध्ये — अंदाजे चालेल.",
    target_weight_kg: "kg मध्ये एक संख्या — 70 सारखी.",
  },
  ambiguousAge:  {
    line: "मी बरोबर वाचले याची खात्री करायची आहे — तुम्हाला वर्ष {year} म्हणायचे असल्यास, चारही अंक पाठवा.",
    confirm: "माझे वय {age} आहे",
  },
  direction:  {
    gain: "तुमचे वजन आता {weight} kg आहे आणि लक्ष्य {target} — इथून ही वाढ नाही. ध्येय बदलले असल्यास, आपण ते बदलू शकतो; नाहीतर {weight} पेक्षा जास्त संख्या द्या.",
    lose: "तुमचे वजन आता {weight} kg आहे आणि लक्ष्य {target} — इथून ही घट नाही. ध्येय बदलले असल्यास, आपण ते बदलू शकतो; नाहीतर {weight} पेक्षा कमी संख्या द्या.",
    switchToLose: "वजन कमी करण्यावर बदला",
    switchToGain: "वजन वाढवण्यावर बदला",
    above: "{weight} पेक्षा जास्त संख्या…",
    below: "{weight} पेक्षा कमी संख्या…",
  },
  switched:  {
    gain: "बदलले — म्हणजे वजन वाढवायचे. kg मध्ये, किती वजनापर्यंत पोहोचायचे आहे?",
    lose: "बदलले — म्हणजे वजन कमी करायचे. kg मध्ये, किती वजनापर्यंत पोहोचायचे आहे? इथे जलद म्हणजे चांगले नाही — फक्त टिकवणे कठीण होते.",
  },
  capNoteTail:  " म्हणजे सुमारे {kg} kg प्रति आठवडा.",
  goalEdit:  {
    cleared: "तुमचे ध्येय वजन आता त्या ध्येयाशी जुळत नव्हते, म्हणून ते काढून टाकले — नवीन सेट करा.",
    worthSetting: "नोंद घेतली. पण तुमचे ध्येय वजन आता तुमच्या ध्येयाशी जुळत नाही — नवीन सेट करणे चांगले.",
  },
  target: {
    // "55 · lowest we set" under the range's floor, "74 · now" beside today, "− 6kg" the
    // answer's distance from it.
    lowest: "{weight} · आमचे किमान",
    now: "{weight} · आता",
    nowLowest: "{weight} · आता · आमचे किमान",
    deltaDown: "− {weight}",
    deltaUp: "+ {weight}",
  },
  pace: {
    rate: "{rate} प्रति आठवडा",
    rateSuffix: "प्रति आठवडा",
    result: "{month} च्या सुमारास {target} · दिवसाला {kcal} kcal",
    capMarker: "सुरक्षित मर्यादेवर थांबवले",
    floorMarker: "कधीही {floor} पेक्षा कमी नाही · प्रत्येक वेग इथेच येतो",
    echo: "{from} पासून {to} पर्यंत.",
  },
  how: {
    title: "eait कसे काम करते",
    meal: "सॅल्मन, भात, पालेभाज्या",
    photoAlt: "व्ह्यूफाइंडरमध्ये धान्याचा बाउल",
    steps: ["प्लेटचा फोटो काढा", "प्रामाणिक मॅक्रो मिळवा", "तुमची प्रगती पाहा"],
  },
  units: { years: "वर्षे", yearsCount: { one: "{n} वर्ष", other: "{n} वर्षे" } },
  twice: {
    title: "दुप्पट वजन कमी करा",
    sub: "जे लोक आपण काय खातो ते लिहून ठेवतात, त्यांचे वजन दुप्पट कमी होते",
    without: "नोंद न करता",
    with: "eait सोबत",
    source: "Hollis et al., Am J Prev Med, 2008",
    alt: "नोंद न करता: 1×; eait सोबत: 2×",
  },
  baseline: {
    title: "हा आहे तुमचा सुरुवातीचा आधार",
    bmi: "बॉडी मास इंडेक्स (BMI)",
    bands: { under: "कमी वजन", healthy: "निरोगी", over: "जास्त वजन", obese: "लठ्ठपणा" },
    verdict: { under: "तुमचा BMI निरोगी श्रेणीपेक्षा कमी आहे", healthy: "तुमचा BMI निरोगी श्रेणीत आहे", above: "तुमचा BMI निरोगी श्रेणीपेक्षा जास्त आहे" },
    note: "तुमचा प्लॅन हे लक्षात घेतो.",
    you: "तुम्ही",
    body: "उंची · वजन",
    activity: "ॲक्टिव्हिटी",
  },
  possible: { lose: "{delta} कमी? वास्तववादी, आणि शक्य!", gain: "{delta} जास्त? वास्तववादी, आणि शक्य!" },
  ageWhy: "वयानुसार तुमचा मेटाबॉलिझम बदलतो, म्हणून आम्ही तेही लक्षात घेतो",
  ontrack: {
    title: "तुम्हाला योग्य मार्गावर ठेवण्यासाठी बनवलेले",
    captions: {
      consistency: "एक दिवस चुकला तरी काही बिघडत नाही. पुढचा दिवस शून्यापासून सुरू होतो.",
      habits: "काहीही वर्ज्य नाही. प्रत्येक प्लेटला प्रामाणिक मॅक्रो मिळतात.",
      support: "{coach} चॅटमध्ये आहे — काहीही, कधीही विचारा.",
      busy: "एक फोटो म्हणजे संपूर्ण नोंद.",
      ideas: "रात्रीच्या जेवणाला काय करायचे सुचत नाही? उरलेल्यात काय बसेल ते विचारा, {coach} सांगेल.",
    },
  },
  chart: {
    byEait: "eait सोबत",
    weightTrend: "वजनाचा कल",
    without: "विना",
    now: "आता",
    later: "नंतर",
    twoWays: "कालांतराने वजन, दोन प्रकारे: प्लॅनसह आणि प्लॅनशिवाय",
    estimatedProgress: "अंदाजित प्रगती",
    estimate: "अंदाज",
    target: "लक्ष्य {weight}",
        monthEstimate: "{month} · अंदाज",
    estimateAria: "अंदाजित वजन: आता {from}, {month} च्या सुमारास {to}",
  },
  plan: {
    goalLose: "ध्येय: −{delta} · {month} पर्यंत",
    goalGain: "ध्येय: +{delta} · {month} पर्यंत",
    goalMaintain: "ध्येय: माझे वजन टिकवणे",
    rest: "विश्रांतीत तुमचे शरीर खर्च करते", activity: "तुमच्या ॲक्टिव्हिटीसह, सुमारे", pace: "तुमच्या वेगानुसार, आम्ही बदल करतो", floor: "किमान मर्यादा, जिच्या खाली आम्ही जात नाही", protein: "प्रोटीनचे लक्ष्य",
  },
  health: {
    title: "आरोग्य ॲपसोबत सिंक करा",
    body: "वजन आणि ॲक्टिव्हिटी इथे येतात. तुमची जेवणे आरोग्य ॲपमध्ये जातात.",
  },
  targetSuggestion:  {
    down: "माझी सूचना: {weight}, सुमारे {pct}% कमी, एक चांगले पहिले ध्येय",
    up: "माझी सूचना: {weight}, सुमारे {pct}% जास्त, एक चांगले पहिले ध्येय",
  },
  firstMeal:  FIRST_MEAL_COPY.mr!,
  stepper:  { continue: "पुढे जा", less: "कमी", more: "जास्त" },
  offerHeadline:  "{month} पर्यंत {kg} kg गाठा",
  planGoal: { metric: "ध्येय: −{n} kg · {month} पर्यंत", imperial: "ध्येय: −{n} lb · {month} पर्यंत" },
};

const ML: ChatCopy = {
  idlePlaceholder:  "Spud-ന് സന്ദേശം അയയ്ക്കൂ…",
  continueLabel: "തുടരുക",
  saveKept: "അത് സംരക്ഷിക്കാനായില്ല. നിങ്ങളുടെ ഉത്തരം ഇപ്പോഴും ഇവിടെയുണ്ട്. തുടരുക അമർത്തിയാൽ അത് വീണ്ടും അയയ്ക്കും.",
  underAgeCard:  {
    title: "eait {age} വയസ്സും അതിനു മുകളിലുമുള്ളവർക്കുള്ളതാണ്",
    body: "ഈ ആപ്പ് കലോറി ലക്ഷ്യങ്ങൾ നിശ്ചയിക്കുന്ന രീതി ഇപ്പോഴും വളരുന്ന ശരീരത്തിനായി രൂപകൽപ്പന ചെയ്തതല്ല.",
  },
  underAge:  {
    ask: "ക്ഷമിക്കണം — എനിക്ക് ഇവിടെ നിർത്തേണ്ടിവരും. ഒരു ടൈപ്പിംഗ് പിശക് കാരണമാണ് ഇതെങ്കിൽ, നിങ്ങളുടെ ശരിയായ പ്രായം അയയ്ക്കൂ.",
    confirm: "അതാണ് എന്റെ ശരിയായ പ്രായം",
    placeholder: "നിങ്ങളുടെ പ്രായം",
    stopped: [
      "എങ്കിൽ നമ്മൾ ഇവിടെ നിർത്തുന്നു. നിങ്ങൾ എന്നോട് പറഞ്ഞതെല്ലാം ഞാൻ ഇല്ലാതാക്കുന്നു.",
      "{age} വയസ്സാകുമ്പോൾ തിരികെ വരൂ, ഞാൻ ഇവിടെയുണ്ടാകും.",
    ],
    endedPlaceholder: "eait {age} വയസ്സും അതിനു മുകളിലുമുള്ളവർക്കുള്ളതാണ്",
  },
  belowHealthy:  {
    title: "അത് ലക്ഷ്യമായി വയ്ക്കാൻ എനിക്കാവില്ല",
    body: "നിങ്ങളുടെ ഉയരത്തിനുള്ള ഏറ്റവും കുറഞ്ഞ ആരോഗ്യകരമായ ഭാരം ഏകദേശം {kg} kg ആണ്. അതിന് താഴെ ഞങ്ങൾ ലക്ഷ്യം വയ്ക്കില്ല. മറ്റെന്തെങ്കിലും ഒരു ഡോക്ടറുമായി ചേർന്ന് ചെയ്യുന്നുണ്ടെങ്കിൽ, ഈ ആപ്പിനെക്കാൾ അവരെ പിന്തുടരൂ.",
  },
  invalid:  {
    age: "അതൊരു പ്രായമായി തോന്നുന്നില്ല — 34 പോലെ എന്തെങ്കിലും നൽകൂ.",
    height_cm: "സെന്റിമീറ്ററിൽ — 175 പോലെ.",
    weight_kg: "കിലോഗ്രാമിൽ — ഏകദേശം മതി.",
    target_weight_kg: "kg-ൽ ഒരു സംഖ്യ — 70 പോലെ.",
  },
  ambiguousAge:  {
    line: "ഞാൻ ശരിയായാണോ വായിച്ചതെന്ന് ഉറപ്പാക്കട്ടെ — വർഷം {year} ആണ് ഉദ്ദേശിച്ചതെങ്കിൽ, നാല് അക്കങ്ങളും അയയ്ക്കൂ.",
    confirm: "എന്റെ പ്രായം {age}",
  },
  direction:  {
    gain: "നിങ്ങൾ ഇപ്പോൾ {weight} kg ആണ്, ലക്ഷ്യമായി പറഞ്ഞത് {target} — ഇവിടെ നിന്ന് അത് ഭാരം കൂട്ടലല്ല. ലക്ഷ്യം മാറിയെങ്കിൽ നമുക്ക് അത് മാറ്റാം; അല്ലെങ്കിൽ {weight} എന്നതിന് മുകളിലുള്ള ഒരു സംഖ്യ തരൂ.",
    lose: "നിങ്ങൾ ഇപ്പോൾ {weight} kg ആണ്, ലക്ഷ്യമായി പറഞ്ഞത് {target} — ഇവിടെ നിന്ന് അത് ഭാരം കുറയ്ക്കലല്ല. ലക്ഷ്യം മാറിയെങ്കിൽ നമുക്ക് അത് മാറ്റാം; അല്ലെങ്കിൽ {weight} എന്നതിന് താഴെയുള്ള ഒരു സംഖ്യ തരൂ.",
    switchToLose: "ഭാരം കുറയ്ക്കലിലേക്ക് മാറുക",
    switchToGain: "ഭാരം കൂട്ടലിലേക്ക് മാറുക",
    above: "{weight} എന്നതിന് മുകളിലുള്ള ഒരു സംഖ്യ…",
    below: "{weight} എന്നതിന് താഴെയുള്ള ഒരു സംഖ്യ…",
  },
  switched:  {
    gain: "മാറ്റി — ഭാരം കൂട്ടാം. kg-ൽ, എത്രയിൽ എത്താനാണ് ആഗ്രഹം?",
    lose: "മാറ്റി — ഭാരം കുറയ്ക്കാം. kg-ൽ, എത്രയിൽ എത്താനാണ് ആഗ്രഹം? ഇവിടെ വേഗം കൂടുന്നത് നല്ലതല്ല — നിലനിർത്താൻ കൂടുതൽ ബുദ്ധിമുട്ടാകും എന്നേയുള്ളൂ.",
  },
  capNoteTail:  " അതായത് ആഴ്ചയിൽ ഏകദേശം {kg} kg.",
  goalEdit:  {
    cleared: "നിങ്ങളുടെ ലക്ഷ്യ ഭാരം ആ ലക്ഷ്യവുമായി ഇനി ചേരാത്തതിനാൽ അത് നീക്കം ചെയ്തു — പുതിയൊരെണ്ണം സജ്ജമാക്കൂ.",
    worthSetting: "രേഖപ്പെടുത്തി. പക്ഷേ നിങ്ങളുടെ ലക്ഷ്യ ഭാരം ഇനി നിങ്ങളുടെ ലക്ഷ്യവുമായി ചേരുന്നില്ല — പുതിയൊരെണ്ണം സജ്ജമാക്കുന്നത് നല്ലതാണ്.",
  },
  target: {
    // "55 · lowest we set" under the range's floor, "74 · now" beside today, "− 6kg" the
    // answer's distance from it.
    lowest: "{weight} · ഞങ്ങൾ വയ്ക്കുന്ന ഏറ്റവും കുറഞ്ഞത്",
    now: "{weight} · ഇപ്പോൾ",
    nowLowest: "{weight} · ഇപ്പോൾ · ഞങ്ങൾ വയ്ക്കുന്ന ഏറ്റവും കുറഞ്ഞത്",
    deltaDown: "− {weight}",
    deltaUp: "+ {weight}",
  },
  pace: {
    rate: "ആഴ്ചയിൽ {rate}",
    rateSuffix: "ആഴ്ചയിൽ",
    result: "{month} ആകുമ്പോഴേക്കും {target} · ദിവസം {kcal} kcal",
    capMarker: "സുരക്ഷിത പരിധിയിൽ നിർത്തി",
    floorMarker: "ഒരിക്കലും {floor} എന്നതിന് താഴെയല്ല · എല്ലാ ഗതിയും ഇവിടെയെത്തുന്നു",
    echo: "{from} മുതൽ {to} വരെ.",
  },
  how: {
    title: "eait എങ്ങനെ പ്രവർത്തിക്കുന്നു",
    meal: "സാൽമൺ, ചോറ്, ഇലക്കറികൾ",
    photoAlt: "വ്യൂഫൈൻഡറിൽ ഒരു ധാന്യ ബൗൾ",
    steps: ["പ്ലേറ്റിന്റെ ഫോട്ടോ എടുക്കൂ", "സത്യസന്ധമായ മാക്രോകൾ നേടൂ", "നിങ്ങളുടെ പുരോഗതി കാണൂ"],
  },
  units: { years: "വയസ്സ്", yearsCount: { one: "{n} വയസ്സ്", other: "{n} വയസ്സ്" } },
  twice: {
    title: "ഇരട്ടി ഭാരം കുറയ്ക്കൂ",
    sub: "കഴിക്കുന്നത് എഴുതിവയ്ക്കുന്നവർക്ക് ഇരട്ടി ഭാരം കുറയുന്നു",
    without: "രേഖപ്പെടുത്താതെ",
    with: "eait-നൊപ്പം",
    source: "Hollis et al., Am J Prev Med, 2008",
    alt: "രേഖപ്പെടുത്താതെ: 1×; eait-നൊപ്പം: 2×",
  },
  baseline: {
    title: "ഇതാ നിങ്ങളുടെ തുടക്കനില",
    bmi: "ബോഡി മാസ് ഇൻഡക്സ് (BMI)",
    bands: { under: "ഭാരക്കുറവ്", healthy: "ആരോഗ്യകരം", over: "അമിതഭാരം", obese: "പൊണ്ണത്തടി" },
    verdict: { under: "നിങ്ങളുടെ BMI ആരോഗ്യകരമായ പരിധിക്ക് താഴെയാണ്", healthy: "നിങ്ങളുടെ BMI ആരോഗ്യകരമായ പരിധിയിലാണ്", above: "നിങ്ങളുടെ BMI ആരോഗ്യകരമായ പരിധിക്ക് മുകളിലാണ്" },
    note: "നിങ്ങളുടെ പ്ലാൻ ഇത് കണക്കിലെടുക്കുന്നു.",
    you: "നിങ്ങൾ",
    body: "ഉയരം · ഭാരം",
    activity: "പ്രവർത്തനം",
  },
  possible: { lose: "{delta} കുറവ്? യാഥാർത്ഥ്യബോധമുള്ളത്, സാധ്യവും!", gain: "{delta} കൂടുതൽ? യാഥാർത്ഥ്യബോധമുള്ളത്, സാധ്യവും!" },
  ageWhy: "പ്രായത്തിനനുസരിച്ച് നിങ്ങളുടെ മെറ്റബോളിസം മാറുന്നു, അതിനാൽ ഞങ്ങൾ അത് കണക്കിലെടുക്കുന്നു",
  ontrack: {
    title: "നിങ്ങളെ ശരിയായ വഴിയിൽ നിർത്താൻ നിർമിച്ചത്",
    captions: {
      consistency: "ഒരു ദിവസം വിട്ടുപോയാൽ നഷ്ടമൊന്നുമില്ല. അടുത്ത ദിവസം പൂജ്യത്തിൽ നിന്ന് തുടങ്ങും.",
      habits: "ഒന്നും വിലക്കിയിട്ടില്ല. ഓരോ പ്ലേറ്റിനും സത്യസന്ധമായ മാക്രോകൾ.",
      support: "ചാറ്റിൽ എന്തും എപ്പോഴും ചോദിക്കൂ — {coach} ഉത്തരം തരും.",
      busy: "ഒരു ഫോട്ടോ മതി, രേഖപ്പെടുത്തൽ പൂർത്തി.",
      ideas: "അത്താഴത്തിന് എന്ത് എന്ന് സംശയമുണ്ടോ? ബാക്കിയുള്ളതിൽ എന്ത് ചേരുമെന്ന് ചോദിക്കൂ — {coach} പറഞ്ഞുതരും.",
    },
  },
  chart: {
    byEait: "eait-നൊപ്പം",
    weightTrend: "ഭാരത്തിന്റെ പ്രവണത",
    without: "ഇല്ലാതെ",
    now: "ഇപ്പോൾ",
    later: "പിന്നീട്",
    twoWays: "കാലക്രമേണയുള്ള ഭാരം, രണ്ട് രീതിയിൽ: പ്ലാനോടെയും പ്ലാനില്ലാതെയും",
    estimatedProgress: "കണക്കാക്കിയ പുരോഗതി",
    estimate: "ഏകദേശ കണക്ക്",
    target: "ലക്ഷ്യം {weight}",
        monthEstimate: "{month} · ഏകദേശ കണക്ക്",
    estimateAria: "കണക്കാക്കിയ ഭാരം: ഇപ്പോൾ {from}, {month} ആകുമ്പോഴേക്കും {to}",
  },
  plan: {
    goalLose: "ലക്ഷ്യം: −{delta} · {month} ആകുമ്പോഴേക്കും",
    goalGain: "ലക്ഷ്യം: +{delta} · {month} ആകുമ്പോഴേക്കും",
    goalMaintain: "ലക്ഷ്യം: എന്റെ ഭാരം നിലനിർത്തുക",
    rest: "വിശ്രമത്തിൽ നിങ്ങളുടെ ശരീരം എരിക്കുന്നത്", activity: "നിങ്ങളുടെ പ്രവർത്തനത്തോടെ, ഏകദേശം", pace: "നിങ്ങളുടെ ഗതിക്കായി ഞങ്ങൾ ക്രമീകരിക്കുന്നത്", floor: "ഞങ്ങൾ താഴെ പോകാത്ത മിനിമം", protein: "ലക്ഷ്യമിടേണ്ട പ്രോട്ടീൻ",
  },
  health: {
    title: "ആരോഗ്യം ആപ്പുമായി സിങ്ക് ചെയ്യുക",
    body: "ഭാരവും പ്രവർത്തനവും ഇങ്ങോട്ട് വരുന്നു. നിങ്ങളുടെ ഭക്ഷണങ്ങൾ ആരോഗ്യം ആപ്പിലേക്ക് പോകുന്നു.",
  },
  targetSuggestion:  {
    down: "ഞാൻ നിർദ്ദേശിക്കുന്നത് {weight}, ഏകദേശം {pct}% കുറവ്, ഒരു നല്ല ആദ്യ ലക്ഷ്യം",
    up: "ഞാൻ നിർദ്ദേശിക്കുന്നത് {weight}, ഏകദേശം {pct}% കൂടുതൽ, ഒരു നല്ല ആദ്യ ലക്ഷ്യം",
  },
  firstMeal:  FIRST_MEAL_COPY.ml!,
  stepper:  { continue: "തുടരുക", less: "കുറവ്", more: "കൂടുതൽ" },
  offerHeadline:  "{month} ആകുമ്പോഴേക്കും {kg} kg-ൽ എത്തൂ",
  planGoal: { metric: "ലക്ഷ്യം: −{n} kg · {month} ആകുമ്പോഴേക്കും", imperial: "ലക്ഷ്യം: −{n} lb · {month} ആകുമ്പോഴേക്കും" },
};

const KN: ChatCopy = {
  idlePlaceholder:  "Spud ಗೆ ಸಂದೇಶ ಕಳುಹಿಸಿ…",
  continueLabel: "ಮುಂದುವರಿಸಿ",
  saveKept: "ಅದನ್ನು ಉಳಿಸಲಾಗಲಿಲ್ಲ. ನಿಮ್ಮ ಉತ್ತರ ಇನ್ನೂ ಇಲ್ಲೇ ಇದೆ. ಮುಂದುವರಿಸಿ ಒತ್ತಿದರೆ ಅದು ಮತ್ತೆ ಕಳುಹಿಸಲ್ಪಡುತ್ತದೆ.",
  underAgeCard:  {
    title: "eait {age} ವರ್ಷ ಮತ್ತು ಅದಕ್ಕಿಂತ ಮೇಲ್ಪಟ್ಟವರಿಗಾಗಿ",
    body: "ಈ ಆ್ಯಪ್ ಕ್ಯಾಲೊರಿ ಗುರಿಗಳನ್ನು ಹೊಂದಿಸುವ ರೀತಿ ಇನ್ನೂ ಬೆಳೆಯುತ್ತಿರುವ ದೇಹಕ್ಕಾಗಿ ರೂಪಿಸಲಾಗಿಲ್ಲ.",
  },
  underAge:  {
    ask: "ಕ್ಷಮಿಸಿ — ನಾನು ಇಲ್ಲಿಗೆ ನಿಲ್ಲಿಸಬೇಕು. ಟೈಪಿಂಗ್ ತಪ್ಪಿನಿಂದ ಹೀಗಾಗಿದ್ದರೆ, ನಿಮ್ಮ ನಿಜವಾದ ವಯಸ್ಸನ್ನು ಕಳುಹಿಸಿ.",
    confirm: "ಅದೇ ನನ್ನ ನಿಜವಾದ ವಯಸ್ಸು",
    placeholder: "ನಿಮ್ಮ ವಯಸ್ಸು",
    stopped: [
      "ಹಾಗಾದರೆ ನಾವು ಇಲ್ಲಿಗೆ ನಿಲ್ಲಿಸುತ್ತೇವೆ. ನೀವು ಹೇಳಿದ ಎಲ್ಲವನ್ನೂ ನಾನು ಅಳಿಸುತ್ತಿದ್ದೇನೆ.",
      "{age} ವರ್ಷವಾದಾಗ ಮತ್ತೆ ಬನ್ನಿ, ನಾನು ಇಲ್ಲೇ ಇರುತ್ತೇನೆ.",
    ],
    endedPlaceholder: "eait {age} ವರ್ಷ ಮತ್ತು ಅದಕ್ಕಿಂತ ಮೇಲ್ಪಟ್ಟವರಿಗಾಗಿ",
  },
  belowHealthy:  {
    title: "ಅದನ್ನು ಗುರಿಯಾಗಿ ಹೊಂದಿಸಲು ನನಗೆ ಸಾಧ್ಯವಿಲ್ಲ",
    body: "ನಿಮ್ಮ ಎತ್ತರಕ್ಕೆ ಕನಿಷ್ಠ ಆರೋಗ್ಯಕರ ತೂಕ ಸುಮಾರು {kg} kg. ಅದಕ್ಕಿಂತ ಕಡಿಮೆ ಗುರಿಯನ್ನು ನಾವು ಹೊಂದಿಸುವುದಿಲ್ಲ. ನೀವು ವೈದ್ಯರೊಂದಿಗೆ ಬೇರೆ ಏನಾದರೂ ಯೋಜನೆ ಮಾಡುತ್ತಿದ್ದರೆ, ಈ ಆ್ಯಪ್ ಬದಲು ಅವರ ಸಲಹೆಯನ್ನು ಅನುಸರಿಸಿ.",
  },
  invalid:  {
    age: "ಇದು ವಯಸ್ಸಿನಂತೆ ಕಾಣುತ್ತಿಲ್ಲ — ಉದಾಹರಣೆಗೆ 34 ಎಂದು ಬರೆಯಿರಿ.",
    height_cm: "ಸೆಂಟಿಮೀಟರ್‌ಗಳಲ್ಲಿ — ಉದಾಹರಣೆಗೆ 175.",
    weight_kg: "ಕಿಲೋಗ್ರಾಂಗಳಲ್ಲಿ — ಅಂದಾಜು ಸಾಕು.",
    target_weight_kg: "kg ನಲ್ಲಿ ಒಂದು ಸಂಖ್ಯೆ — ಉದಾಹರಣೆಗೆ 70.",
  },
  ambiguousAge:  {
    line: "ನಾನು ಸರಿಯಾಗಿ ಓದಿದ್ದೇನೆಯೇ ಎಂದು ಖಚಿತಪಡಿಸಿಕೊಳ್ಳಲು — ನೀವು {year} ಇಸವಿಯನ್ನು ಉದ್ದೇಶಿಸಿದ್ದರೆ, ನಾಲ್ಕೂ ಅಂಕೆಗಳನ್ನು ಕಳುಹಿಸಿ.",
    confirm: "ನನಗೆ {age} ವರ್ಷ",
  },
  direction:  {
    gain: "ನೀವು ಈಗ {weight} kg ಇದ್ದೀರಿ ಮತ್ತು {target} ವರೆಗೆ ತೂಕ ಹೆಚ್ಚಿಸಲು ಕೇಳಿದ್ದೀರಿ — ಇಲ್ಲಿಂದ ಅದು ಹೆಚ್ಚಳವಲ್ಲ. ಗುರಿ ಬದಲಾಗಿದ್ದರೆ, ನಾವು ಅದನ್ನು ಬದಲಿಸಬಹುದು; ಇಲ್ಲದಿದ್ದರೆ {weight} ಮೀರಿದ ಸಂಖ್ಯೆ ಕೊಡಿ.",
    lose: "ನೀವು ಈಗ {weight} kg ಇದ್ದೀರಿ ಮತ್ತು {target} ವರೆಗೆ ತೂಕ ಇಳಿಸಲು ಕೇಳಿದ್ದೀರಿ — ಇಲ್ಲಿಂದ ಅದು ಇಳಿಕೆಯಲ್ಲ. ಗುರಿ ಬದಲಾಗಿದ್ದರೆ, ನಾವು ಅದನ್ನು ಬದಲಿಸಬಹುದು; ಇಲ್ಲದಿದ್ದರೆ {weight} ಕ್ಕಿಂತ ಕಡಿಮೆ ಸಂಖ್ಯೆ ಕೊಡಿ.",
    switchToLose: "ತೂಕ ಇಳಿಸುವುದಕ್ಕೆ ಬದಲಿಸಿ",
    switchToGain: "ತೂಕ ಹೆಚ್ಚಿಸುವುದಕ್ಕೆ ಬದಲಿಸಿ",
    above: "{weight} ಮೀರಿದ ಸಂಖ್ಯೆ…",
    below: "{weight} ಕ್ಕಿಂತ ಕಡಿಮೆ ಸಂಖ್ಯೆ…",
  },
  switched:  {
    gain: "ಬದಲಾಯಿಸಲಾಗಿದೆ — ತೂಕ ಹೆಚ್ಚಿಸುವುದು. kg ನಲ್ಲಿ ನೀವು ಎಷ್ಟು ತಲುಪಲು ಬಯಸುತ್ತೀರಿ?",
    lose: "ಬದಲಾಯಿಸಲಾಗಿದೆ — ತೂಕ ಇಳಿಸುವುದು. kg ನಲ್ಲಿ ನೀವು ಎಷ್ಟು ತಲುಪಲು ಬಯಸುತ್ತೀರಿ? ಇಲ್ಲಿ ವೇಗ ಹೆಚ್ಚಿದ್ದರೆ ಉತ್ತಮವಲ್ಲ — ಅದನ್ನು ಕಾಯ್ದುಕೊಳ್ಳುವುದು ಕಷ್ಟವಷ್ಟೇ.",
  },
  capNoteTail:  " ಅದು ವಾರಕ್ಕೆ ಸುಮಾರು {kg} kg.",
  goalEdit:  {
    cleared: "ನಿಮ್ಮ ಗುರಿ ತೂಕ ಆ ಗುರಿಗೆ ಇನ್ನು ಹೊಂದುತ್ತಿರಲಿಲ್ಲ, ಹಾಗಾಗಿ ಅದನ್ನು ತೆರವುಗೊಳಿಸಲಾಗಿದೆ — ಹೊಸದನ್ನು ಹೊಂದಿಸಿ.",
    worthSetting: "ದಾಖಲಿಸಲಾಗಿದೆ. ಆದರೆ ನಿಮ್ಮ ಗುರಿ ತೂಕ ಇನ್ನು ನಿಮ್ಮ ಗುರಿಗೆ ಹೊಂದುತ್ತಿಲ್ಲ — ಹೊಸದನ್ನು ಹೊಂದಿಸುವುದು ಒಳ್ಳೆಯದು.",
  },
  target: {
    // "55 · lowest we set" under the range's floor, "74 · now" beside today, "− 6kg" the
    // answer's distance from it.
    lowest: "{weight} · ನಮ್ಮ ಕನಿಷ್ಠ",
    now: "{weight} · ಈಗ",
    nowLowest: "{weight} · ಈಗ · ನಮ್ಮ ಕನಿಷ್ಠ",
    deltaDown: "− {weight}",
    deltaUp: "+ {weight}",
  },
  pace: {
    rate: "ವಾರಕ್ಕೆ {rate}",
    rateSuffix: "ವಾರಕ್ಕೆ",
    result: "ಸುಮಾರು {month} ವೇಳೆಗೆ {target} · ದಿನಕ್ಕೆ {kcal} kcal",
    capMarker: "ಸುರಕ್ಷಿತ ಮಿತಿಯಲ್ಲಿ ನಿಲ್ಲಿಸಲಾಗಿದೆ",
    floorMarker: "ಯಾವಾಗಲೂ ಕನಿಷ್ಠ {floor} · ಪ್ರತಿಯೊಂದು ವೇಗವೂ ಇಲ್ಲಿಗೆ ಬರುತ್ತದೆ",
    echo: "{from} ರಿಂದ {to} ವರೆಗೆ.",
  },
  how: {
    title: "eait ಹೇಗೆ ಕೆಲಸ ಮಾಡುತ್ತದೆ",
    meal: "ಸಾಲ್ಮನ್, ಅನ್ನ, ಸೊಪ್ಪು",
    photoAlt: "ವ್ಯೂಫೈಂಡರ್‌ನಲ್ಲಿ ಧಾನ್ಯದ ಬೌಲ್",
    steps: ["ತಟ್ಟೆಯ ಫೋಟೋ ತೆಗೆಯಿರಿ", "ಪ್ರಾಮಾಣಿಕ ಮ್ಯಾಕ್ರೋಗಳನ್ನು ಪಡೆಯಿರಿ", "ನಿಮ್ಮ ಪ್ರಗತಿಯನ್ನು ನೋಡಿ"],
  },
  units: { years: "ವರ್ಷ", yearsCount: { one: "{n} ವರ್ಷ", other: "{n} ವರ್ಷಗಳು" } },
  twice: {
    title: "ಎರಡು ಪಟ್ಟು ತೂಕ ಇಳಿಸಿ",
    sub: "ತಾವು ತಿನ್ನುವುದನ್ನು ಬರೆದಿಡುವ ಜನರು ಎರಡು ಪಟ್ಟು ತೂಕ ಇಳಿಸುತ್ತಾರೆ",
    without: "ದಾಖಲಿಸದೆ",
    with: "eait ಜೊತೆ",
    source: "Hollis et al., Am J Prev Med, 2008",
    alt: "ದಾಖಲಿಸದೆ: 1×; eait ಜೊತೆ: 2×",
  },
  baseline: {
    title: "ಇದು ನಿಮ್ಮ ಆರಂಭಿಕ ಸ್ಥಿತಿ",
    bmi: "ಬಾಡಿ ಮಾಸ್ ಇಂಡೆಕ್ಸ್ (BMI)",
    bands: { under: "ಕಡಿಮೆ ತೂಕ", healthy: "ಆರೋಗ್ಯಕರ", over: "ಅಧಿಕ ತೂಕ", obese: "ಸ್ಥೂಲಕಾಯ" },
    verdict: { under: "ನಿಮ್ಮ BMI ಆರೋಗ್ಯಕರ ವ್ಯಾಪ್ತಿಗಿಂತ ಕಡಿಮೆ ಇದೆ", healthy: "ನಿಮ್ಮ BMI ಆರೋಗ್ಯಕರ ವ್ಯಾಪ್ತಿಯಲ್ಲಿದೆ", above: "ನಿಮ್ಮ BMI ಆರೋಗ್ಯಕರ ವ್ಯಾಪ್ತಿಗಿಂತ ಹೆಚ್ಚಿದೆ" },
    note: "ನಿಮ್ಮ ಪ್ಲಾನ್ ಇದನ್ನು ಪರಿಗಣಿಸುತ್ತದೆ.",
    you: "ನೀವು",
    body: "ಎತ್ತರ · ತೂಕ",
    activity: "ಚಟುವಟಿಕೆ",
  },
  possible: { lose: "{delta} ಕಡಿಮೆ? ವಾಸ್ತವಿಕ, ಮತ್ತು ಸಾಧ್ಯ!", gain: "{delta} ಹೆಚ್ಚು? ವಾಸ್ತವಿಕ, ಮತ್ತು ಸಾಧ್ಯ!" },
  ageWhy: "ವಯಸ್ಸಿನೊಂದಿಗೆ ನಿಮ್ಮ ಚಯಾಪಚಯ ಬದಲಾಗುತ್ತದೆ, ಹಾಗಾಗಿ ನಾವು ಅದನ್ನು ಲೆಕ್ಕಕ್ಕೆ ತೆಗೆದುಕೊಳ್ಳುತ್ತೇವೆ",
  ontrack: {
    title: "ನಿಮ್ಮನ್ನು ಸರಿಯಾದ ಹಾದಿಯಲ್ಲಿ ಇರಿಸಲು ರೂಪಿಸಲಾಗಿದೆ",
    captions: {
      consistency: "ಒಂದು ದಿನ ತಪ್ಪಿದರೆ ಏನೂ ನಷ್ಟವಿಲ್ಲ. ಮುಂದಿನ ದಿನ ಸೊನ್ನೆಯಿಂದ ಶುರುವಾಗುತ್ತದೆ.",
      habits: "ಯಾವುದೂ ನಿಷಿದ್ಧವಲ್ಲ. ಪ್ರತಿ ತಟ್ಟೆಗೂ ಪ್ರಾಮಾಣಿಕ ಮ್ಯಾಕ್ರೋಗಳು.",
      support: "ಚಾಟ್‌ನಲ್ಲಿ ಏನನ್ನಾದರೂ, ಯಾವಾಗ ಬೇಕಾದರೂ ಕೇಳಿ — {coach} ಉತ್ತರಿಸುತ್ತಾರೆ.",
      busy: "ಒಂದು ಫೋಟೋವೇ ಸಂಪೂರ್ಣ ದಾಖಲೆ.",
      ideas: "ರಾತ್ರಿಯ ಊಟಕ್ಕೆ ಐಡಿಯಾ ಇಲ್ಲವೇ? ಕೇಳಿ, ಉಳಿದದ್ದಕ್ಕೆ ಏನು ಹೊಂದುತ್ತದೆ ಎಂದು {coach} ಹೇಳುತ್ತಾರೆ.",
    },
  },
  chart: {
    byEait: "eait ಜೊತೆ",
    weightTrend: "ತೂಕದ ಪ್ರವೃತ್ತಿ",
    without: "ಇಲ್ಲದೆ",
    now: "ಈಗ",
    later: "ಮುಂದೆ",
    twoWays: "ಕಾಲಾನಂತರದಲ್ಲಿ ತೂಕ, ಎರಡು ರೀತಿಯಲ್ಲಿ: ಪ್ಲಾನ್‌ನೊಂದಿಗೆ ಮತ್ತು ಪ್ಲಾನ್ ಇಲ್ಲದೆ",
    estimatedProgress: "ಅಂದಾಜು ಪ್ರಗತಿ",
    estimate: "ಅಂದಾಜು",
    target: "ಗುರಿ {weight}",
        monthEstimate: "{month} · ಅಂದಾಜು",
    estimateAria: "ಅಂದಾಜು ತೂಕ: ಈಗ {from}, ಸುಮಾರು {month} ವೇಳೆಗೆ {to}",
  },
  plan: {
    goalLose: "ಗುರಿ: {month} ವೇಳೆಗೆ {delta} ಇಳಿಸುವುದು",
    goalGain: "ಗುರಿ: {month} ವೇಳೆಗೆ {delta} ಹೆಚ್ಚಿಸುವುದು",
    goalMaintain: "ಗುರಿ: ನನ್ನ ತೂಕ ಕಾಯ್ದುಕೊಳ್ಳುವುದು",
    rest: "ವಿಶ್ರಾಂತಿಯಲ್ಲಿ ನಿಮ್ಮ ದೇಹ ಖರ್ಚು ಮಾಡುವುದು", activity: "ನಿಮ್ಮ ಚಟುವಟಿಕೆಯೊಂದಿಗೆ, ಸುಮಾರು", pace: "ನಿಮ್ಮ ವೇಗಕ್ಕೆ ತಕ್ಕಂತೆ ಹೊಂದಾಣಿಕೆ", floor: "ನಾವು ದಾಟದ ಕನಿಷ್ಠ ಮಿತಿ", protein: "ಗುರಿಯಾಗಿಸಬೇಕಾದ ಪ್ರೋಟೀನ್",
  },
  health: {
    title: "ಆರೋಗ್ಯ ಆ್ಯಪ್‌ನೊಂದಿಗೆ ಸಿಂಕ್ ಮಾಡಿ",
    body: "ತೂಕ ಮತ್ತು ಚಟುವಟಿಕೆ ಇಲ್ಲಿಗೆ ಬರುತ್ತವೆ. ನಿಮ್ಮ ಊಟಗಳು ಆರೋಗ್ಯ ಆ್ಯಪ್‌ಗೆ ಹೋಗುತ್ತವೆ.",
  },
  targetSuggestion:  {
    down: "ನನ್ನ ಸಲಹೆ {weight}, ಸುಮಾರು {pct}% ಕಡಿಮೆ, ಉತ್ತಮ ಮೊದಲ ಗುರಿ",
    up: "ನನ್ನ ಸಲಹೆ {weight}, ಸುಮಾರು {pct}% ಹೆಚ್ಚು, ಉತ್ತಮ ಮೊದಲ ಗುರಿ",
  },
  firstMeal:  FIRST_MEAL_COPY.kn!,
  stepper:  { continue: "ಮುಂದುವರಿಸಿ", less: "ಕಡಿಮೆ", more: "ಹೆಚ್ಚು" },
  offerHeadline:  "{month} ವೇಳೆಗೆ {kg} kg ತಲುಪಿ",
  planGoal: { metric: "ಗುರಿ: {month} ವೇಳೆಗೆ {n} kg ಇಳಿಸುವುದು", imperial: "ಗುರಿ: {month} ವೇಳೆಗೆ {n} lb ಇಳಿಸುವುದು" },
};

const GU: ChatCopy = {
  idlePlaceholder:  "Spud ને મેસેજ કરો…",
  continueLabel: "ચાલુ રાખો",
  saveKept: "આ સેવ ન થઈ શક્યું. તમારો જવાબ હજી અહીં જ છે. ચાલુ રાખો દબાવતાં તે ફરીથી મોકલાશે.",
  underAgeCard:  {
    title: "eait {age} અને તેથી વધુ ઉંમરના લોકો માટે છે",
    body: "આ ઍપ જે રીતે કેલરી લક્ષ્ય નક્કી કરે છે, તે હજી વિકસતા શરીર માટે બનાવાયેલી નથી.",
  },
  underAge:  {
    ask: "માફ કરશો — મારે અહીં જ અટકવું પડશે. જો ટાઇપની ભૂલથી આવું થયું હોય, તો બસ તમારી સાચી ઉંમર મોકલો.",
    confirm: "આ જ મારી સાચી ઉંમર છે",
    placeholder: "તમારી ઉંમર",
    stopped: [
      "તો આપણે અહીં જ અટકીએ છીએ. તમે કહેલી દરેક વાત ડિલીટ થઈ રહી છે.",
      "{age} વર્ષની ઉંમરે ફરી આવજો, હું અહીં જ હોઈશ.",
    ],
    endedPlaceholder: "eait {age} અને તેથી વધુ ઉંમરના લોકો માટે છે",
  },
  belowHealthy:  {
    title: "આને લક્ષ્ય તરીકે સેટ કરી શકાય નહીં",
    body: "તમારી ઊંચાઈ માટે સૌથી ઓછું સ્વસ્થ વજન લગભગ {kg} kg છે. અમે તેનાથી ઓછું ધ્યેય નક્કી કરતા નથી. જો કોઈ ડૉક્ટર સાથે કંઈક અલગ નક્કી થયું હોય, તો આ ઍપને બદલે તેમની સલાહ માનો.",
  },
  invalid:  {
    age: "આ ઉંમર જેવું લાગતું નથી — 34 જેવું કંઈક લખો.",
    height_cm: "સેન્ટિમીટરમાં — 175 જેવું કંઈક.",
    weight_kg: "કિલોગ્રામમાં — અંદાજે પણ ચાલશે.",
    target_weight_kg: "kg માં એક સંખ્યા — જેમ કે 70.",
  },
  ambiguousAge:  {
    line: "ખાતરી કરી લઈએ: જો તમારો મતલબ વર્ષ {year} હતો, તો ચારેય અંક મોકલો.",
    confirm: "મારી ઉંમર {age} છે",
  },
  direction:  {
    gain: "અત્યારે તમારું વજન {weight} kg છે અને લક્ષ્ય {target} — અહીંથી તે વધારો નથી. જો ધ્યેય બદલાયું હોય, તો આપણે તેને બદલી શકીએ; નહીં તો {weight} થી વધુ કોઈ સંખ્યા આપો.",
    lose: "અત્યારે તમારું વજન {weight} kg છે અને લક્ષ્ય {target} — અહીંથી તે ઘટાડો નથી. જો ધ્યેય બદલાયું હોય, તો આપણે તેને બદલી શકીએ; નહીં તો {weight} થી ઓછી કોઈ સંખ્યા આપો.",
    switchToLose: "વજન ઘટાડવા પર સ્વિચ કરો",
    switchToGain: "વજન વધારવા પર સ્વિચ કરો",
    above: "{weight} થી વધુ કોઈ સંખ્યા…",
    below: "{weight} થી ઓછી કોઈ સંખ્યા…",
  },
  switched:  {
    gain: "બદલી દીધું — તો વજન વધારવાનું છે. લક્ષ્ય કેટલું રાખીએ, kg માં?",
    lose: "બદલી દીધું — તો વજન ઘટાડવાનું છે. લક્ષ્ય કેટલું રાખીએ, kg માં? અહીં વધુ ઝડપ વધુ સારી નથી — બસ તેને જાળવવું વધુ મુશ્કેલ બને છે.",
  },
  capNoteTail:  " આ લગભગ {kg} kg પ્રતિ અઠવાડિયું છે.",
  goalEdit:  {
    cleared: "તમારું લક્ષ્ય વજન હવે એ ધ્યેય સાથે મેળ ખાતું ન હતું, તેથી તે હટાવી દેવાયું — નવું સેટ કરો.",
    worthSetting: "નોંધી લીધું. જોકે, તમારું લક્ષ્ય વજન હવે તમારા ધ્યેય સાથે મેળ ખાતું નથી — નવું સેટ કરવું સારું રહેશે.",
  },
  target: {
    // "55 · lowest we set" under the range's floor, "74 · now" beside today, "− 6kg" the
    // answer's distance from it.
    lowest: "{weight} · અમારું ન્યૂનતમ",
    now: "{weight} · અત્યારે",
    nowLowest: "{weight} · અત્યારે · અમારું ન્યૂનતમ",
    deltaDown: "− {weight}",
    deltaUp: "+ {weight}",
  },
  pace: {
    rate: "{rate} પ્રતિ અઠવાડિયું",
    rateSuffix: "પ્રતિ અઠવાડિયું",
    result: "{month} આસપાસ {target} · {kcal} kcal પ્રતિ દિવસ",
    capMarker: "સુરક્ષિત મર્યાદા પર રોક્યું",
    floorMarker: "ક્યારેય {floor} થી ઓછું નહીં · દરેક ઝડપ અહીં જ પહોંચે છે",
    echo: "{from} થી {to} સુધી.",
  },
  how: {
    title: "eait કેવી રીતે કામ કરે છે",
    meal: "સૅલ્મન, ભાત, લીલાં શાકભાજી",
    photoAlt: "વ્યૂફાઇન્ડરમાં અનાજનો બાઉલ",
    steps: ["પ્લેટનો ફોટો લો", "પ્રામાણિક મૅક્રો મેળવો", "તમારી પ્રગતિ જુઓ"],
  },
  units: { years: "વર્ષ", yearsCount: { one: "{n} વર્ષ", other: "{n} વર્ષ" } },
  twice: {
    title: "બમણું વજન ઘટાડો",
    sub: "જે લોકો પોતાનું ખાવાનું નોંધે છે, તેમનું વજન બમણું ઘટે છે",
    without: "નોંધ્યા વિના",
    with: "eait સાથે",
    source: "Hollis et al., Am J Prev Med, 2008",
    alt: "નોંધ્યા વિના: 1×; eait સાથે: 2×",
  },
  baseline: {
    title: "આ રહ્યો તમારો શરૂઆતનો આધાર",
    bmi: "બોડી માસ ઇન્ડેક્સ (BMI)",
    bands: { under: "ઓછું વજન", healthy: "સ્વસ્થ", over: "વધુ વજન", obese: "મેદસ્વિતા" },
    verdict: { under: "તમારું BMI સ્વસ્થ શ્રેણીથી ઓછું છે", healthy: "તમારું BMI સ્વસ્થ શ્રેણીમાં છે", above: "તમારું BMI સ્વસ્થ શ્રેણીથી વધુ છે" },
    note: "તમારો પ્લાન તેને ધ્યાનમાં રાખે છે.",
    you: "તમે",
    body: "ઊંચાઈ · વજન",
    activity: "પ્રવૃત્તિ",
  },
  possible: { lose: "{delta} ઓછું? વાસ્તવિક છે, અને શક્ય પણ!", gain: "{delta} વધુ? વાસ્તવિક છે, અને શક્ય પણ!" },
  ageWhy: "ઉંમર સાથે તમારું મેટાબોલિઝમ બદલાય છે, તેથી અમે તેને ધ્યાનમાં લઈએ છીએ",
  ontrack: {
    title: "તમને સાચા માર્ગે રાખવા માટે બનાવેલું",
    captions: {
      consistency: "એક દિવસ છૂટે તો કંઈ બગડતું નથી. આગલો દિવસ શૂન્યથી શરૂ થાય છે.",
      habits: "કંઈ પણ મનાઈ નથી. દરેક પ્લેટને પ્રામાણિક મૅક્રો મળે છે.",
      support: "{coach} ચેટમાં છે: કંઈ પણ, ક્યારેય પણ પૂછો.",
      busy: "નોંધવા માટે બસ એક ફોટો.",
      ideas: "રાતના ભોજન માટે આઇડિયા નથી? બાકીમાં શું બંધબેસે તે પૂછો — {coach} જણાવશે.",
    },
  },
  chart: {
    byEait: "eait સાથે",
    weightTrend: "વજનનો ટ્રેન્ડ",
    without: "વિના",
    now: "અત્યારે",
    later: "પછી",
    twoWays: "સમય સાથે વજન, બે રીતે દોરેલું: પ્લાન સાથે અને પ્લાન વિના",
    estimatedProgress: "અંદાજિત પ્રગતિ",
    estimate: "અંદાજ",
    target: "લક્ષ્ય {weight}",
        monthEstimate: "{month} · અંદાજ",
    estimateAria: "અંદાજિત વજન: અત્યારે {from}, {month} આસપાસ {to}",
  },
  plan: {
    goalLose: "ધ્યેય: −{delta} · {month} સુધીમાં",
    goalGain: "ધ્યેય: +{delta} · {month} સુધીમાં",
    goalMaintain: "ધ્યેય: મારું વજન જાળવવું",
    rest: "આરામની સ્થિતિમાં તમારું શરીર ખર્ચે છે", activity: "તમારી પ્રવૃત્તિ સાથે, લગભગ", pace: "તમારી ઝડપ માટે, અમે ગોઠવણ કરીએ છીએ", floor: "ન્યૂનતમ મર્યાદા, જેનાથી નીચે અમે જતા નથી", protein: "પ્રોટીનનું લક્ષ્ય",
  },
  health: {
    title: "હેલ્થ સાથે સિંક કરો",
    body: "વજન અને પ્રવૃત્તિ અહીં આવે છે. તમારાં ભોજન હેલ્થમાં જાય છે.",
  },
  targetSuggestion:  {
    down: "મારું સૂચન {weight} છે, લગભગ {pct}% ઓછું, એક સારું પહેલું ધ્યેય",
    up: "મારું સૂચન {weight} છે, લગભગ {pct}% વધુ, એક સારું પહેલું ધ્યેય",
  },
  firstMeal:  FIRST_MEAL_COPY.gu!,
  stepper:  { continue: "ચાલુ રાખો", less: "ઓછું", more: "વધુ" },
  offerHeadline:  "{month} સુધીમાં {kg} kg સુધી પહોંચો",
  planGoal: { metric: "ધ્યેય: −{n} kg · {month} સુધીમાં", imperial: "ધ્યેય: −{n} lb · {month} સુધીમાં" },
};

const BN: ChatCopy = {
  idlePlaceholder:  "Spud-কে মেসেজ করুন…",
  continueLabel: "চালিয়ে যান",
  saveKept: "এটি সেভ করা যায়নি। আপনার উত্তর এখনও এখানে আছে। চালিয়ে যান চাপলে আবার পাঠানো হবে।",
  underAgeCard:  {
    title: "eait {age} বছর ও তার বেশি বয়সীদের জন্য",
    body: "এই অ্যাপ যেভাবে ক্যালরির লক্ষ্যমাত্রা ঠিক করে, তা এখনও বেড়ে ওঠা শরীরের জন্য তৈরি নয়।",
  },
  underAge:  {
    ask: "দুঃখিত — এখানেই থামতে হবে। টাইপ করতে ভুল হয়ে থাকলে আপনার আসল বয়সটা পাঠান।",
    confirm: "এটাই আমার আসল বয়স",
    placeholder: "আপনার বয়স",
    stopped: [
      "তাহলে এখানেই থামছি। আপনি যা যা বলেছেন সব মুছে ফেলছি।",
      "{age} বছর বয়সে ফিরে আসুন, আমি থাকব।",
    ],
    endedPlaceholder: "eait {age} বছর ও তার বেশি বয়সীদের জন্য",
  },
  belowHealthy:  {
    title: "এটাকে লক্ষ্য হিসেবে রাখতে পারছি না",
    body: "আপনার উচ্চতার জন্য সর্বনিম্ন স্বাস্থ্যকর ওজন প্রায় {kg} kg। আমরা এর নিচে লক্ষ্য রাখি না। আপনি যদি ডাক্তারের সঙ্গে অন্য কিছু নিয়ে কাজ করেন, তাহলে এই অ্যাপের বদলে তাঁর পরামর্শ মানুন।",
  },
  invalid:  {
    age: "এটা বয়স বলে মনে হচ্ছে না — যেমন 34, এমন কিছু লিখুন।",
    height_cm: "সেন্টিমিটারে — যেমন 175।",
    weight_kg: "কিলোগ্রামে — আনুমানিক হলেও চলবে।",
    target_weight_kg: "kg-তে একটি সংখ্যা — যেমন 70।",
  },
  ambiguousAge:  {
    line: "ঠিক পড়েছি কি না নিশ্চিত হতে চাই — আপনি যদি {year} সাল বোঝাতে চান, তাহলে চারটি অঙ্কই পাঠান।",
    confirm: "আমার বয়স {age}",
  },
  direction:  {
    gain: "আপনার ওজন এখন {weight} kg, আর বাড়ানোর লক্ষ্য দিয়েছেন {target} — এখান থেকে সেটা বাড়ানো নয়। লক্ষ্য বদলে থাকলে সেটা পাল্টে দিতে পারি; নইলে {weight} থেকে বেশি একটা সংখ্যা দিন।",
    lose: "আপনার ওজন এখন {weight} kg, আর কমানোর লক্ষ্য দিয়েছেন {target} — এখান থেকে সেটা কমানো নয়। লক্ষ্য বদলে থাকলে সেটা পাল্টে দিতে পারি; নইলে {weight} থেকে কম একটা সংখ্যা দিন।",
    switchToLose: "ওজন কমানোয় বদলান",
    switchToGain: "ওজন বাড়ানোয় বদলান",
    above: "{weight} থেকে বেশি একটা সংখ্যা…",
    below: "{weight} থেকে কম একটা সংখ্যা…",
  },
  switched:  {
    gain: "বদলে দিয়েছি — তাহলে ওজন বাড়ানো। কোথায় পৌঁছাতে চান, kg-তে?",
    lose: "বদলে দিয়েছি — তাহলে ওজন কমানো। কোথায় পৌঁছাতে চান, kg-তে? এখানে দ্রুত মানেই ভালো নয় — শুধু ধরে রাখা কঠিন হয়।",
  },
  capNoteTail:  " এটা সপ্তাহে প্রায় {kg} kg।",
  goalEdit:  {
    cleared: "আপনার লক্ষ্য ওজন আর সেই লক্ষ্যের সঙ্গে মিলছিল না, তাই সেটা খালি করা হয়েছে — নতুন একটা সেট করুন।",
    worthSetting: "রেকর্ড করা হলো। তবে আপনার লক্ষ্য ওজন আর আপনার লক্ষ্যের সঙ্গে মিলছে না — নতুন একটা সেট করা ভালো।",
  },
  target: {
    // "55 · lowest we set" under the range's floor, "74 · now" beside today, "− 6kg" the
    // answer's distance from it.
    lowest: "{weight} · আমাদের সর্বনিম্ন",
    now: "{weight} · এখন",
    nowLowest: "{weight} · এখন · আমাদের সর্বনিম্ন",
    deltaDown: "− {weight}",
    deltaUp: "+ {weight}",
  },
  pace: {
    rate: "সপ্তাহে {rate}",
    rateSuffix: "প্রতি সপ্তাহে",
    result: "{month} নাগাদ {target} · দিনে {kcal} kcal",
    capMarker: "নিরাপদ সীমায় আটকে রাখা",
    floorMarker: "কখনো {floor}-এর নিচে নয় · প্রতিটি গতি এখানেই থামে",
    echo: "{from} থেকে {to}।",
  },
  how: {
    title: "eait কীভাবে কাজ করে",
    meal: "স্যামন, ভাত, শাকসবজি",
    photoAlt: "ভিউফাইন্ডারে একটি শস্যের বাটি",
    steps: ["প্লেটের ছবি তুলুন", "সৎ ম্যাক্রো পান", "আপনার অগ্রগতি দেখুন"],
  },
  units: { years: "বছর", yearsCount: { one: "{n} বছর", other: "{n} বছর" } },
  twice: {
    title: "দ্বিগুণ ওজন কমান",
    sub: "যাঁরা কী খান তা লিখে রাখেন, তাঁদের ওজন দ্বিগুণ কমে",
    without: "লগ না করে",
    with: "eait-এর সঙ্গে",
    source: "Hollis et al., Am J Prev Med, 2008",
    alt: "লগ না করে: 1×; eait-এর সঙ্গে: 2×",
  },
  baseline: {
    title: "এই হলো আপনার শুরুর অবস্থা",
    bmi: "বডি মাস ইনডেক্স (BMI)",
    bands: { under: "কম ওজন", healthy: "স্বাস্থ্যকর", over: "অতিরিক্ত ওজন", obese: "স্থূলতা" },
    verdict: { under: "আপনার BMI স্বাস্থ্যকর সীমার নিচে", healthy: "আপনার BMI স্বাস্থ্যকর সীমার মধ্যে", above: "আপনার BMI স্বাস্থ্যকর সীমার উপরে" },
    note: "আপনার প্ল্যান এটা হিসাবে রাখে।",
    you: "আপনি",
    body: "উচ্চতা · ওজন",
    activity: "কার্যকলাপ",
  },
  possible: { lose: "{delta} কম? বাস্তবসম্মত, আর সম্ভবও!", gain: "{delta} বেশি? বাস্তবসম্মত, আর সম্ভবও!" },
  ageWhy: "বয়সের সঙ্গে আপনার মেটাবলিজম বদলায়, তাই আমরা সেটা হিসাবে রাখি",
  ontrack: {
    title: "আপনাকে ঠিক পথে রাখার জন্য তৈরি",
    captions: {
      consistency: "একদিন বাদ পড়লে কিছু যায় আসে না। পরের দিন শুরু হয় শূন্য থেকে।",
      habits: "কিছুই নিষিদ্ধ নয়। প্রতিটি প্লেট পায় সৎ ম্যাক্রো।",
      support: "চ্যাটে যেকোনো সময় যেকোনো কিছু জিজ্ঞাসা করুন — উত্তর দেবে {coach}।",
      busy: "পুরো লগের জন্য একটা ছবিই যথেষ্ট।",
      ideas: "রাতে কী খাবেন ভেবে পাচ্ছেন না? বাকি হিসাবে কী মানাবে, বলে দেবে {coach}।",
    },
  },
  chart: {
    byEait: "eait-এর সঙ্গে",
    weightTrend: "ওজনের প্রবণতা",
    without: "ছাড়া",
    now: "এখন",
    later: "পরে",
    twoWays: "সময়ের সঙ্গে ওজন, দুইভাবে আঁকা: প্ল্যানসহ আর প্ল্যান ছাড়া",
    estimatedProgress: "আনুমানিক অগ্রগতি",
    estimate: "অনুমান",
    target: "লক্ষ্য ওজন {weight}",
        monthEstimate: "{month} · অনুমান",
    estimateAria: "আনুমানিক ওজন: এখন {from}, {month} নাগাদ {to}",
  },
  plan: {
    goalLose: "লক্ষ্য: −{delta} · {month} নাগাদ",
    goalGain: "লক্ষ্য: +{delta} · {month} নাগাদ",
    goalMaintain: "লক্ষ্য: ওজন ধরে রাখা",
    rest: "বিশ্রামে আপনার শরীর খরচ করে", activity: "আপনার কার্যকলাপসহ, প্রায়", pace: "আপনার গতির জন্য আমরা সমন্বয় করি", floor: "ন্যূনতম সীমা, যার নিচে আমরা যাই না", protein: "প্রোটিনের লক্ষ্যমাত্রা",
  },
  health: {
    title: "স্বাস্থ্য অ্যাপের সঙ্গে সিঙ্ক করুন",
    body: "ওজন আর কার্যকলাপ এখানে আসে। আপনার খাবার যায় স্বাস্থ্য অ্যাপে।",
  },
  targetSuggestion:  {
    down: "আমার পরামর্শ {weight}, প্রায় {pct}% কম, প্রথম লক্ষ্য হিসেবে ভালো",
    up: "আমার পরামর্শ {weight}, প্রায় {pct}% বেশি, প্রথম লক্ষ্য হিসেবে ভালো",
  },
  firstMeal:  FIRST_MEAL_COPY.bn!,
  stepper:  { continue: "চালিয়ে যান", less: "কম", more: "বেশি" },
  offerHeadline:  "{month} নাগাদ {kg} kg-তে পৌঁছান",
  planGoal: { metric: "লক্ষ্য: −{n} kg · {month} নাগাদ", imperial: "লক্ষ্য: −{n} lb · {month} নাগাদ" },
};

const PT_PT: ChatCopy = {
  idlePlaceholder:  "Mensagem para o Spud…",
  continueLabel: "Continuar",
  saveKept: "Não foi possível guardar. A tua resposta continua aqui. Continuar envia-a de novo.",
  underAgeCard:  {
    title: "O eait é para quem tem {age} anos ou mais",
    body: "A forma como esta app define os alvos de calorias não foi pensada para um corpo que ainda está a crescer.",
  },
  underAge:  {
    ask: "Desculpa — tenho de parar aqui. Se foi um erro de escrita, envia só a tua idade real.",
    confirm: "Essa é a minha idade real",
    placeholder: "A tua idade",
    stopped: [
      "Então paramos aqui. Vou apagar tudo o que me contaste.",
      "Volta quando tiveres {age} anos e eu ando por cá.",
    ],
    endedPlaceholder: "O eait é para quem tem {age} anos ou mais",
  },
  belowHealthy:  {
    title: "Não posso definir isso como alvo",
    body: "O peso saudável mais baixo para a tua altura é cerca de {kg} kg. Não definimos um objetivo abaixo disso. Se estiveres a seguir outra orientação com um médico, segue-a em vez desta app.",
  },
  invalid:  {
    age: "Isso não parece uma idade — experimenta algo como 34.",
    height_cm: "Em centímetros — algo como 175.",
    weight_kg: "Em quilos — um valor aproximado chega.",
    target_weight_kg: "Um número em kg — como 70.",
  },
  ambiguousAge:  {
    line: "Quero ter a certeza de que li bem — se querias dizer o ano {year}, envia os quatro dígitos.",
    confirm: "Tenho {age} anos",
  },
  direction:  {
    gain: "Estás com {weight} kg e pediste para subir até {target} — a partir daqui, isso não é uma subida. Se o objetivo mudou, podemos trocá-lo; senão, dá-me um número acima de {weight}.",
    lose: "Estás com {weight} kg e pediste para descer até {target} — a partir daqui, isso não é uma descida. Se o objetivo mudou, podemos trocá-lo; senão, dá-me um número abaixo de {weight}.",
    switchToLose: "Mudar para perder peso",
    switchToGain: "Mudar para ganhar peso",
    above: "Um número acima de {weight}…",
    below: "Um número abaixo de {weight}…",
  },
  switched:  {
    gain: "Feito — vamos ganhar peso. Onde gostavas de chegar, em kg?",
    lose: "Feito — vamos perder peso. Onde gostavas de chegar, em kg? Mais rápido não é melhor aqui — só é mais difícil de manter.",
  },
  capNoteTail:  " Isso dá cerca de {kg} kg por semana.",
  goalEdit:  {
    cleared: "O teu peso-alvo já não encaixava nesse objetivo, por isso foi apagado — define um novo.",
    worthSetting: "Registado. Mas o teu peso-alvo já não encaixa no teu objetivo — vale a pena definir um novo.",
  },
  target: {
    // "55 · lowest we set" under the range's floor, "74 · now" beside today, "− 6kg" the
    // answer's distance from it.
    lowest: "{weight} · o mínimo que definimos",
    now: "{weight} · agora",
    nowLowest: "{weight} · agora · o mínimo que definimos",
    deltaDown: "− {weight}",
    deltaUp: "+ {weight}",
  },
  pace: {
    rate: "{rate} por semana",
    rateSuffix: "por semana",
    result: "{target} por volta de {month} · {kcal} kcal por dia",
    capMarker: "limitado ao máximo seguro",
    floorMarker: "nunca abaixo de {floor} · todos os ritmos chegam aqui",
    echo: "De {from} para {to}.",
  },
  how: {
    title: "Como funciona o eait",
    meal: "Salmão, arroz, folhas verdes",
    photoAlt: "Uma taça de cereais no visor",
    steps: ["Fotografa o prato", "Recebe macros honestos", "Vê o teu progresso"],
  },
  units: { years: "anos", yearsCount: { one: "{n} ano", other: "{n} anos" } },
  twice: {
    title: "Perde o dobro do peso",
    sub: "Quem aponta o que come perde o dobro do peso",
    without: "Sem registar",
    with: "Com o eait",
    source: "Hollis et al., Am J Prev Med, 2008",
    alt: "Sem registar: 1×; com o eait: 2×",
  },
  baseline: {
    title: "Este é o teu ponto de partida",
    bmi: "Índice de Massa Corporal (IMC)",
    bands: { under: "ABAIXO DO PESO", healthy: "SAUDÁVEL", over: "EXCESSO DE PESO", obese: "OBESIDADE" },
    verdict: { under: "O teu IMC está abaixo do intervalo saudável", healthy: "O teu IMC está no intervalo saudável", above: "O teu IMC está acima do intervalo saudável" },
    note: "O teu plano tem isso em conta.",
    you: "Tu",
    body: "Altura · peso",
    activity: "Atividade",
  },
  possible: { lose: "{delta} a menos? Realista e possível!", gain: "{delta} a mais? Realista e possível!" },
  ageWhy: "O teu metabolismo muda com a idade, por isso temos isso em conta",
  ontrack: {
    title: "Feito para te manter no caminho",
    captions: {
      consistency: "Um dia falhado não custa nada. O seguinte começa do zero.",
      habits: "Nada é proibido. Cada prato recebe macros honestos.",
      support: "Pergunta o que quiseres a {coach}, a qualquer hora, no Chat.",
      busy: "Uma foto é o registo inteiro.",
      ideas: "Sem ideias para o jantar? Pergunta a {coach} o que cabe no que sobra.",
    },
  },
  chart: {
    byEait: "com o eait",
    weightTrend: "Tendência do peso",
    without: "Sem",
    now: "Agora",
    later: "Depois",
    twoWays: "Peso ao longo do tempo, desenhado de duas formas: com um plano e sem",
    estimatedProgress: "Progresso estimado",
    estimate: "Estimativa",
    target: "Alvo {weight}",
        monthEstimate: "{month} · estimativa",
    estimateAria: "Peso estimado: {from} agora, {to} por volta de {month}",
  },
  plan: {
    goalLose: "Objetivo: −{delta} até {month}",
    goalGain: "Objetivo: +{delta} até {month}",
    goalMaintain: "Objetivo: manter o peso",
    rest: "O teu corpo em repouso gasta", activity: "Com a tua atividade, cerca de", pace: "Para o teu ritmo, ajustamos", floor: "O mínimo abaixo do qual não descemos", protein: "Proteína a atingir",
  },
  health: {
    title: "Sincronizar com a app Saúde",
    body: "O peso e a atividade entram. As tuas refeições vão para a app Saúde.",
  },
  targetSuggestion:  {
    down: "Sugiro {weight}, cerca de {pct}% a menos, um bom primeiro objetivo",
    up: "Sugiro {weight}, cerca de {pct}% a mais, um bom primeiro objetivo",
  },
  firstMeal:  FIRST_MEAL_COPY["pt-PT"]!,
  stepper:  { continue: "Continuar", less: "Menos", more: "Mais" },
  offerHeadline:  "Chegar a {kg} kg até {month}",
  planGoal: { metric: "Objetivo: −{n} kg até {month}", imperial: "Objetivo: −{n} lb até {month}" },
};

const MS: ChatCopy = {
  idlePlaceholder:  "Mesej Spud…",
  continueLabel: "Teruskan",
  saveKept: "Itu tidak dapat disimpan. Jawapan anda masih ada di sini. Teruskan akan menghantarnya semula.",
  underAgeCard:  {
    title: "eait untuk {age} tahun ke atas",
    body: "Cara aplikasi ini menetapkan sasaran kalori tidak direka untuk badan yang masih membesar.",
  },
  underAge:  {
    ask: "Maaf — saya terpaksa berhenti di sini. Jika ini berlaku kerana salah taip, hantar sahaja umur sebenar anda.",
    confirm: "Itu umur sebenar saya",
    placeholder: "Umur anda",
    stopped: [
      "Kalau begitu, kita berhenti di sini. Saya memadam semua yang anda beritahu saya.",
      "Kembalilah pada umur {age} tahun, saya masih ada.",
    ],
    endedPlaceholder: "eait untuk {age} tahun ke atas",
  },
  belowHealthy:  {
    title: "Saya tidak boleh menetapkan itu sebagai sasaran",
    body: "Berat sihat terendah untuk ketinggian anda ialah kira-kira {kg} kg. Kami tidak akan menetapkan matlamat di bawahnya. Jika doktor anda menasihatkan sesuatu yang berbeza, ikut nasihat doktor dan bukan aplikasi ini.",
  },
  invalid:  {
    age: "Itu tidak kelihatan seperti umur — cuba sesuatu seperti 34.",
    height_cm: "Dalam sentimeter — contohnya 175.",
    weight_kg: "Dalam kilogram — anggaran pun tidak mengapa.",
    target_weight_kg: "Nombor dalam kg — contohnya 70.",
  },
  ambiguousAge:  {
    line: "Saya mahu pastikan saya membacanya dengan betul — jika maksud anda tahun {year}, hantar keempat-empat digit.",
    confirm: "Umur saya {age}",
  },
  direction:  {
    gain: "Berat anda {weight} kg dan anda minta naik ke {target} — itu bukan kenaikan dari sini. Jika matlamat sudah berubah, kita boleh tukar; jika tidak, berikan nombor melebihi {weight}.",
    lose: "Berat anda {weight} kg dan anda minta turun ke {target} — itu bukan penurunan dari sini. Jika matlamat sudah berubah, kita boleh tukar; jika tidak, berikan nombor di bawah {weight}.",
    switchToLose: "Tukar ke turun berat",
    switchToGain: "Tukar ke naik berat",
    above: "Nombor melebihi {weight}…",
    below: "Nombor di bawah {weight}…",
  },
  switched:  {
    gain: "Sudah ditukar — naik berat. Anda mahu ke berapa, dalam kg?",
    lose: "Sudah ditukar — turun berat. Anda mahu ke berapa, dalam kg? Lebih pantas tidak lebih baik di sini — cuma lebih sukar dikekalkan.",
  },
  capNoteTail:  " Itu kira-kira {kg} kg seminggu.",
  goalEdit:  {
    cleared: "Berat sasaran anda tidak lagi sesuai dengan matlamat itu, jadi ia dikosongkan — tetapkan yang baharu.",
    worthSetting: "Direkodkan. Tetapi berat sasaran anda tidak lagi sesuai dengan matlamat anda — elok tetapkan yang baharu.",
  },
  target: {
    // "55 · lowest we set" under the range's floor, "74 · now" beside today, "− 6kg" the
    // answer's distance from it.
    lowest: "{weight} · terendah yang kami tetapkan",
    now: "{weight} · sekarang",
    nowLowest: "{weight} · sekarang · terendah yang kami tetapkan",
    deltaDown: "− {weight}",
    deltaUp: "+ {weight}",
  },
  pace: {
    rate: "{rate} seminggu",
    rateSuffix: "seminggu",
    result: "{target} sekitar {month} · {kcal} kcal sehari",
    capMarker: "dihadkan pada had selamat",
    floorMarker: "tidak kurang daripada {floor} · setiap kadar berakhir di sini",
    echo: "Daripada {from} kepada {to}.",
  },
  how: {
    title: "Cara eait berfungsi",
    meal: "Salmon, nasi, sayur-sayuran",
    photoAlt: "Semangkuk bijirin dalam pemidang tilik",
    steps: ["Ambil foto pinggan", "Dapatkan makro yang jujur", "Lihat kemajuan anda"],
  },
  units: { years: "tahun", yearsCount: { one: "{n} tahun", other: "{n} tahun" } },
  twice: {
    title: "Turun berat dua kali lebih banyak",
    sub: "Orang yang mencatat apa yang mereka makan turun berat dua kali lebih banyak",
    without: "Tanpa mencatat",
    with: "Dengan eait",
    source: "Hollis et al., Am J Prev Med, 2008",
    alt: "Tanpa mencatat: 1×; dengan eait: 2×",
  },
  baseline: {
    title: "Ini titik permulaan anda",
    bmi: "Indeks Jisim Badan (BMI)",
    bands: { under: "KURANG BERAT", healthy: "SIHAT", over: "LEBIH BERAT", obese: "OBES" },
    verdict: { under: "BMI anda di bawah julat sihat", healthy: "BMI anda dalam julat sihat", above: "BMI anda melebihi julat sihat" },
    note: "Pelan anda mengambil kira perkara ini.",
    you: "Anda",
    body: "Ketinggian · berat",
    activity: "Aktiviti",
  },
  possible: { lose: "Kurang {delta}? Realistik, dan boleh dicapai!", gain: "Tambah {delta}? Realistik, dan boleh dicapai!" },
  ageWhy: "Metabolisme anda berubah mengikut usia, jadi kami mengambil kira perkara itu",
  ontrack: {
    title: "Direka untuk memastikan anda kekal di landasan",
    captions: {
      consistency: "Hari yang terlepas tidak merugikan apa-apa. Hari seterusnya bermula dari kosong.",
      habits: "Tiada yang dilarang. Setiap pinggan mendapat makro yang jujur.",
      support: "Tanya {coach} apa sahaja, bila-bila masa, dalam Sembang.",
      busy: "Satu foto ialah keseluruhan catatan.",
      ideas: "Buntu untuk makan malam? Tanya {coach} apa yang sesuai dengan baki.",
    },
  },
  chart: {
    byEait: "dengan eait",
    weightTrend: "Trend berat",
    without: "Tanpa",
    now: "Sekarang",
    later: "Kemudian",
    twoWays: "Berat dari semasa ke semasa, dilukis dua cara: dengan pelan dan tanpa pelan",
    estimatedProgress: "Anggaran kemajuan",
    estimate: "Anggaran",
    target: "Sasaran {weight}",
        monthEstimate: "{month} · anggaran",
    estimateAria: "Anggaran berat: {from} sekarang, {to} sekitar {month}",
  },
  plan: {
    goalLose: "Matlamat: −{delta} menjelang {month}",
    goalGain: "Matlamat: +{delta} menjelang {month}",
    goalMaintain: "Matlamat: kekalkan berat saya",
    rest: "Badan anda ketika rehat membakar", activity: "Dengan aktiviti anda, kira-kira", pace: "Untuk kadar anda, kami laraskan", floor: "Had minimum yang tidak akan kami lepasi", protein: "Sasaran protein",
  },
  health: {
    title: "Segerakkan dengan Kesihatan Apple",
    body: "Berat dan aktiviti masuk. Hidangan anda dihantar ke Kesihatan.",
  },
  targetSuggestion:  {
    down: "Saya cadangkan {weight}, kira-kira {pct}% kurang, matlamat pertama yang baik",
    up: "Saya cadangkan {weight}, kira-kira {pct}% lebih, matlamat pertama yang baik",
  },
  firstMeal:  FIRST_MEAL_COPY.ms!,
  stepper:  { continue: "Teruskan", less: "Kurang", more: "Lagi" },
  offerHeadline:  "Sasaran {kg} kg menjelang {month}",
  planGoal: { metric: "Matlamat: −{n} kg menjelang {month}", imperial: "Matlamat: −{n} lb menjelang {month}" },
};

const CA: ChatCopy = {
  idlePlaceholder:  "Escriu a Spud…",
  continueLabel: "Continua",
  saveKept: "No s'ha pogut desar. La teva resposta encara és aquí. Amb Continua, s'envia de nou.",
  underAgeCard:  {
    title: "eait és a partir dels {age} anys",
    body: "La manera com aquesta app fixa els objectius de calories no està pensada per a un cos que encara creix.",
  },
  underAge:  {
    ask: "Ho sento — m'he d'aturar aquí. Si ha estat un error en escriure, envia'm la teva edat real.",
    confirm: "Aquesta és la meva edat real",
    placeholder: "La teva edat",
    stopped: [
      "Llavors aquí ens aturem. Elimino tot el que m'has dit.",
      "Torna quan tinguis {age} anys i aquí seré.",
    ],
    endedPlaceholder: "eait és a partir dels {age} anys",
  },
  belowHealthy:  {
    title: "No puc fixar això com a objectiu",
    body: "El pes saludable més baix per a la teva alçada és d'uns {kg} kg. No fixarem cap objectiu per sota. Si un metge et porta un pla diferent, segueix les seves indicacions i no les d'aquesta app.",
  },
  invalid:  {
    age: "Això no sembla una edat — prova amb alguna cosa com 34.",
    height_cm: "En centímetres — alguna cosa com 175.",
    weight_kg: "En quilograms — aproximat ja va bé.",
    target_weight_kg: "Un número en kg — com 70.",
  },
  ambiguousAge:  {
    line: "Vull assegurar-me que ho he llegit bé — si volies dir l'any {year}, envia les quatre xifres.",
    confirm: "Tinc {age} anys",
  },
  direction:  {
    gain: "Ara peses {weight} kg i has demanat pujar fins a {target} — des d'aquí això no és pujar. Si la meta ha canviat, la podem canviar; si no, dona'm un número per sobre de {weight}.",
    lose: "Ara peses {weight} kg i has demanat baixar fins a {target} — des d'aquí això no és baixar. Si la meta ha canviat, la podem canviar; si no, dona'm un número per sota de {weight}.",
    switchToLose: "Canvia a baixar de pes",
    switchToGain: "Canvia a pujar de pes",
    above: "Un número per sobre de {weight}…",
    below: "Un número per sota de {weight}…",
  },
  switched:  {
    gain: "Canviat — doncs a pujar. On t'agradaria arribar, en kg?",
    lose: "Canviat — doncs a baixar. On t'agradaria arribar, en kg? Aquí més ràpid no és millor — només és més difícil de mantenir.",
  },
  capNoteTail:  " Això són uns {kg} kg per setmana.",
  goalEdit:  {
    cleared: "El teu pes objectiu ja no encaixava amb aquesta meta, així que s'ha esborrat — fixa'n un de nou.",
    worthSetting: "Registrat. Tot i així, el teu pes objectiu ja no encaixa amb la teva meta — val la pena fixar-ne un de nou.",
  },
  target: {
    // "55 · lowest we set" under the range's floor, "74 · now" beside today, "− 6kg" the
    // answer's distance from it.
    lowest: "{weight} · el mínim que fixem",
    now: "{weight} · ara",
    nowLowest: "{weight} · ara · el mínim que fixem",
    deltaDown: "− {weight}",
    deltaUp: "+ {weight}",
  },
  pace: {
    rate: "{rate} per setmana",
    rateSuffix: "per setmana",
    result: "{target} cap a {month} · {kcal} kcal al dia",
    capMarker: "limitat al màxim segur",
    floorMarker: "mai per sota de {floor} · tots els ritmes acaben aquí",
    echo: "De {from} a {to}.",
  },
  how: {
    title: "Com funciona eait",
    meal: "Salmó, arròs i verdures",
    photoAlt: "Un bol de cereals al visor",
    steps: ["Fotografia el plat", "Obtén macros honestos", "Mira el teu progrés"],
  },
  units: { years: "anys", yearsCount: { one: "{n} any", other: "{n} anys" } },
  twice: {
    title: "Perd el doble de pes",
    sub: "Qui apunta el que menja perd el doble de pes",
    without: "Sense registrar",
    with: "Amb eait",
    source: "Hollis et al., Am J Prev Med, 2008",
    alt: "Sense registrar: 1×; amb eait: 2×",
  },
  baseline: {
    title: "Aquest és el teu punt de partida",
    bmi: "Índex de massa corporal (IMC)",
    bands: { under: "PES BAIX", healthy: "SALUDABLE", over: "SOBREPÈS", obese: "OBESITAT" },
    verdict: { under: "El teu IMC és per sota del rang saludable", healthy: "El teu IMC és dins del rang saludable", above: "El teu IMC és per sobre del rang saludable" },
    note: "El teu pla ho té en compte.",
    you: "Tu",
    body: "Alçada · pes",
    activity: "Activitat",
  },
  possible: { lose: "{delta} menys? Realista, i possible!", gain: "{delta} més? Realista, i possible!" },
  ageWhy: "El metabolisme canvia amb l'edat, i ho tenim en compte",
  ontrack: {
    title: "Fet perquè no perdis el rumb",
    captions: {
      consistency: "Un dia perdut no costa res. El següent comença de zero.",
      habits: "No hi ha res prohibit. Cada plat té macros honestos.",
      support: "Pregunta el que vulguis a {coach}, quan vulguis, al Xat.",
      busy: "Una foto és tot el registre.",
      ideas: "No saps què sopar? Pregunta a {coach} què encaixa amb el que et queda.",
    },
  },
  chart: {
    byEait: "amb eait",
    weightTrend: "Tendència del pes",
    without: "Sense",
    now: "Ara",
    later: "Més endavant",
    twoWays: "El pes al llarg del temps, dibuixat de dues maneres: amb un pla i sense",
    estimatedProgress: "Progrés estimat",
    estimate: "Estimació",
    target: "Objectiu: {weight}",
        monthEstimate: "{month} · estimació",
    estimateAria: "Pes estimat: {from} ara, {to} cap a {month}",
  },
  plan: {
    goalLose: "Meta: −{delta} cap a {month}",
    goalGain: "Meta: +{delta} cap a {month}",
    goalMaintain: "Meta: mantenir el pes",
    rest: "En repòs, el teu cos crema", activity: "Amb la teva activitat, unes", pace: "Pel teu ritme, ajustem", floor: "El mínim que no travessem", protein: "Proteïna a assolir",
  },
  health: {
    title: "Sincronitza amb Salut",
    body: "El pes i l'activitat entren. Els teus àpats van a Salut.",
  },
  targetSuggestion:  {
    down: "Et proposo {weight}, un {pct} % menys: un bon primer objectiu",
    up: "Et proposo {weight}, un {pct} % més: un bon primer objectiu",
  },
  firstMeal:  FIRST_MEAL_COPY.ca!,
  stepper:  { continue: "Continua", less: "Menys", more: "Més" },
  offerHeadline:  "{kg} kg cap a {month}",
  planGoal: { metric: "Meta: −{n} kg cap a {month}", imperial: "Meta: −{n} lb cap a {month}" },
};

const SL: ChatCopy = {
  idlePlaceholder:  "Sporočilo za Spuda…",
  continueLabel: "Nadaljuj",
  saveKept: "Tega ni bilo mogoče shraniti. Tvoj odgovor je še vedno tu. Gumb Nadaljuj ga pošlje znova.",
  underAgeCard:  {
    title: "eait je za starost od {age} let naprej",
    body: "Način, kako ta aplikacija določa ciljne vrednosti kalorij, ni zasnovan za telo, ki še raste.",
  },
  underAge:  {
    ask: "Oprosti — tu se moram ustaviti. Če je kriva tipkarska napaka, mi pošlji svojo pravo starost.",
    confirm: "To je moja prava starost",
    placeholder: "Tvoja starost",
    stopped: [
      "Potem se tu ustaviva. Brišem vse tvoje odgovore.",
      "Vrni se pri {age} letih, tu bom.",
    ],
    endedPlaceholder: "eait je za starost od {age} let naprej",
  },
  belowHealthy:  {
    title: "Tega ne morem nastaviti kot ciljno težo",
    body: "Najnižja zdrava teža za tvojo višino je približno {kg} kg. Cilja pod njo ne nastavimo. Če z zdravnikom delaš na nečem drugem, upoštevaj zdravnika, ne te aplikacije.",
  },
  invalid:  {
    age: "To ni videti kot starost — poskusi na primer 34.",
    height_cm: "V centimetrih — na primer 175.",
    weight_kg: "V kilogramih — približno je v redu.",
    target_weight_kg: "Število v kg — na primer 70.",
  },
  ambiguousAge:  {
    line: "Da ne bo pomote: če gre za letnico {year}, pošlji vse štiri števke.",
    confirm: "Imam {age} let",
  },
  direction:  {
    gain: "Zdaj imaš {weight} kg, cilj pa je {target} — to ni več, kot imaš zdaj. Če se je cilj spremenil, ga lahko zamenjaš; sicer mi napiši število nad {weight}.",
    lose: "Zdaj imaš {weight} kg, cilj pa je {target} — to ni manj, kot imaš zdaj. Če se je cilj spremenil, ga lahko zamenjaš; sicer mi napiši število pod {weight}.",
    switchToLose: "Preklopi na izgubo teže",
    switchToGain: "Preklopi na pridobivanje teže",
    above: "Število nad {weight}…",
    below: "Število pod {weight}…",
  },
  switched:  {
    gain: "Preklopljeno — torej pridobivanje teže. Kam želiš priti, v kg?",
    lose: "Preklopljeno — torej izguba teže. Kam želiš priti, v kg? Hitreje tu ni bolje — le težje se ohrani.",
  },
  capNoteTail:  " To je približno {kg} kg na teden.",
  goalEdit:  {
    cleared: "Tvoja ciljna teža se ni več ujemala s tem ciljem, zato je ponastavljena — nastavi novo.",
    worthSetting: "Zabeleženo. Tvoja ciljna teža pa se ne ujema več s ciljem — splača se nastaviti novo.",
  },
  target: {
    // "55 · lowest we set" under the range's floor, "74 · now" beside today, "− 6kg" the
    // answer's distance from it.
    lowest: "{weight} · najnižje, kar nastavimo",
    now: "{weight} · zdaj",
    nowLowest: "{weight} · zdaj · najnižje, kar nastavimo",
    deltaDown: "− {weight}",
    deltaUp: "+ {weight}",
  },
  pace: {
    rate: "{rate} na teden",
    rateSuffix: "na teden",
    result: "{target} · predvidoma {month} · {kcal} kcal na dan",
    capMarker: "omejeno na varno mejo",
    floorMarker: "nikoli pod {floor} · vsak tempo pristane tu",
    echo: "Od {from} do {to}.",
  },
  how: {
    title: "Kako deluje eait",
    meal: "Losos, riž, zelenjava",
    photoAlt: "Skleda z žiti v iskalu",
    steps: ["Fotografiraj krožnik", "Dobi poštena makrohranila", "Spremljaj svoj napredek"],
  },
  units: { years: "let", yearsCount: { one: "{n} leto", other: "{n} let" } },
  twice: {
    title: "Izgubi dvakrat več teže",
    sub: "Ljudje, ki zapisujejo, kaj jedo, izgubijo dvakrat več teže",
    without: "Brez beleženja",
    with: "Z eait",
    source: "Hollis et al., Am J Prev Med, 2008",
    alt: "Brez beleženja: 1×; z eait: 2×",
  },
  baseline: {
    title: "To je tvoje izhodišče",
    bmi: "Indeks telesne mase (ITM)",
    bands: { under: "PREMAJHNA TEŽA", healthy: "ZDRAVA TEŽA", over: "PREKOMERNA TEŽA", obese: "DEBELOST" },
    verdict: { under: "Tvoj ITM je pod zdravim območjem", healthy: "Tvoj ITM je v zdravem območju", above: "Tvoj ITM je nad zdravim območjem" },
    note: "Tvoj načrt to upošteva.",
    you: "Ti",
    body: "Višina · teža",
    activity: "Aktivnost",
  },
  possible: { lose: "{delta} manj? Realno in izvedljivo!", gain: "{delta} več? Realno in izvedljivo!" },
  ageWhy: "Presnova se s starostjo spreminja, zato to upoštevamo",
  ontrack: {
    title: "Narejeno, da ostaneš na pravi poti",
    captions: {
      consistency: "Izpuščen dan nič ne stane. Naslednji se začne od nule.",
      habits: "Nič ni prepovedano. Vsak krožnik dobi poštena makrohranila.",
      support: "{coach} ti v Klepetu odgovori na kar koli, kadar koli.",
      busy: "Ena fotografija je ves vnos.",
      ideas: "Ne veš, kaj za večerjo? {coach} ti pove, kaj še gre v preostanek dneva.",
    },
  },
  chart: {
    byEait: "z eait",
    weightTrend: "Gibanje teže",
    without: "Brez",
    now: "Zdaj",
    later: "Pozneje",
    twoWays: "Teža skozi čas, prikazana na dva načina: z načrtom in brez njega",
    estimatedProgress: "Ocenjen napredek",
    estimate: "Ocena",
    target: "Ciljna teža {weight}",
        monthEstimate: "{month} · ocena",
    estimateAria: "Ocenjena teža: zdaj {from}; {to} · predvidoma {month}",
  },
  plan: {
    goalLose: "Cilj: −{delta} · predvidoma {month}",
    goalGain: "Cilj: +{delta} · predvidoma {month}",
    goalMaintain: "Cilj: ohraniti težo",
    rest: "Tvoje telo v mirovanju porabi", activity: "S tvojo aktivnostjo približno", pace: "Za tvoj tempo prilagodimo", floor: "Spodnja meja, pod katero ne gremo", protein: "Beljakovine, ki jih ciljaš",
  },
  health: {
    title: "Sinhronizacija z aplikacijo Zdravje",
    body: "Teža in aktivnost prideta noter. Tvoji obroki gredo v aplikacijo Zdravje.",
  },
  targetSuggestion:  {
    down: "Predlagam {weight}, približno {pct} % manj, dober prvi cilj",
    up: "Predlagam {weight}, približno {pct} % več, dober prvi cilj",
  },
  firstMeal:  FIRST_MEAL_COPY.sl!,
  stepper:  { continue: "Nadaljuj", less: "Manj", more: "Več" },
  offerHeadline:  "Cilj {kg} kg · predvidoma {month}",
  planGoal: { metric: "Cilj: −{n} kg · predvidoma {month}", imperial: "Cilj: −{n} lb · predvidoma {month}" },
};

const HR: ChatCopy = {
  idlePlaceholder:  "Poruka za Spuda…",
  continueLabel: "Nastavi",
  saveKept: "To se nije moglo spremiti. Odgovor je još tu. Dodirom na Nastavi šalje se ponovno.",
  underAgeCard:  {
    title: "eait je za dob {age}+",
    body: "Način na koji ova aplikacija postavlja kalorijske ciljeve nije namijenjen tijelu koje još raste.",
  },
  underAge:  {
    ask: "Žao mi je — ovdje moram stati. Ako je posrijedi tipfeler, samo pošalji svoju pravu dob.",
    confirm: "To je moja prava dob",
    placeholder: "Tvoja dob",
    stopped: [
      "Onda ovdje stajemo. Brišem sve tvoje odgovore.",
      "Vrati se s {age} — bit ću tu.",
    ],
    endedPlaceholder: "eait je za dob {age}+",
  },
  belowHealthy:  {
    title: "To ne mogu postaviti kao ciljnu težinu",
    body: "Najniža zdrava težina za tvoju visinu je oko {kg} kg. Cilj ispod nje nećemo postaviti. Ako s liječnikom radiš na nečem drugom, slijedi liječnika, a ne ovu aplikaciju.",
  },
  invalid:  {
    age: "To ne izgleda kao dob — probaj nešto poput 34.",
    height_cm: "U centimetrima — nešto poput 175.",
    weight_kg: "U kilogramima — otprilike je dovoljno.",
    target_weight_kg: "Broj u kg — npr. 70.",
  },
  ambiguousAge:  {
    line: "Samo provjera — ako misliš na godinu {year}, pošalji sve četiri znamenke.",
    confirm: "Imam {age}",
  },
  direction:  {
    gain: "Sada imaš {weight} kg, a cilj ti je {target} — odavde to nije dobivanje na težini. Ako se cilj promijenio, možemo ga zamijeniti; inače mi daj broj veći od {weight}.",
    lose: "Sada imaš {weight} kg, a cilj ti je {target} — odavde to nije gubitak težine. Ako se cilj promijenio, možemo ga zamijeniti; inače mi daj broj manji od {weight}.",
    switchToLose: "Prebaci na mršavljenje",
    switchToGain: "Prebaci na dobivanje težine",
    above: "Broj veći od {weight}…",
    below: "Broj manji od {weight}…",
  },
  switched:  {
    gain: "Prebačeno — dobivanje težine. Gdje želiš biti, u kg?",
    lose: "Prebačeno — mršavljenje. Gdje želiš biti, u kg? Brže ovdje nije bolje — samo je teže održati.",
  },
  capNoteTail:  " To je oko {kg} kg tjedno.",
  goalEdit:  {
    cleared: "Tvoja ciljna težina više nije odgovarala tom cilju pa je poništena — postavi novu.",
    worthSetting: "Primljeno. Ciljna težina ipak više ne odgovara tvom cilju — vrijedi postaviti novu.",
  },
  target: {
    // "55 · lowest we set" under the range's floor, "74 · now" beside today, "− 6kg" the
    // answer's distance from it.
    lowest: "{weight} · najniže što postavljamo",
    now: "{weight} · sada",
    nowLowest: "{weight} · sada · najniže što postavljamo",
    deltaDown: "− {weight}",
    deltaUp: "+ {weight}",
  },
  pace: {
    rate: "{rate} tjedno",
    rateSuffix: "tjedno",
    result: "{target} · procjena: {month} · {kcal} kcal dnevno",
    capMarker: "ograničeno na sigurnu granicu",
    floorMarker: "nikad ispod {floor} · svaki tempo završava ovdje",
    echo: "Od {from} do {to}.",
  },
  how: {
    title: "Kako eait radi",
    meal: "Losos, riža, povrće",
    photoAlt: "Zdjela sa žitaricama u tražilu",
    steps: ["Fotografiraj tanjur", "Dobij iskrene makronutrijente", "Vidi svoj napredak"],
  },
  units: { years: "god.", yearsCount: { one: "{n} godina", other: "{n} god." } },
  twice: {
    title: "Smršavi dvostruko više",
    sub: "Oni koji bilježe što jedu izgube dvostruko više kilograma",
    without: "Bez bilježenja",
    with: "Uz eait",
    source: "Hollis et al., Am J Prev Med, 2008",
    alt: "Bez bilježenja: 1×; uz eait: 2×",
  },
  baseline: {
    title: "Ovo je tvoja polazna točka",
    bmi: "Indeks tjelesne mase (BMI)",
    bands: { under: "POTHRANJENOST", healthy: "NORMALNA TEŽINA", over: "PREKOMJERNA TEŽINA", obese: "PRETILOST" },
    verdict: { under: "Tvoj BMI je ispod zdravog raspona", healthy: "Tvoj BMI je u zdravom rasponu", above: "Tvoj BMI je iznad zdravog raspona" },
    note: "Tvoj plan to uzima u obzir.",
    you: "Ti",
    body: "Visina · težina",
    activity: "Aktivnost",
  },
  possible: { lose: "{delta} manje? Realno i ostvarivo!", gain: "{delta} više? Realno i ostvarivo!" },
  ageWhy: "Metabolizam se mijenja s godinama, pa to uračunavamo",
  ontrack: {
    title: "Stvoreno da ostaneš na pravom putu",
    captions: {
      consistency: "Propušteni dan ne košta ništa. Sljedeći kreće od nule.",
      habits: "Ništa nije zabranjeno. Svaki tanjur dobiva iskrene makronutrijente.",
      support: "Pitaj bilo što, bilo kad, u Chatu — {coach} odgovara.",
      busy: "Jedna fotografija — i obrok je zabilježen.",
      ideas: "Nemaš ideju za večeru? Pitaj, {coach} zna što još stane.",
    },
  },
  chart: {
    byEait: "uz eait",
    weightTrend: "Kretanje težine",
    without: "Bez",
    now: "Sada",
    later: "Kasnije",
    twoWays: "Težina kroz vrijeme, nacrtana na dva načina: s planom i bez njega",
    estimatedProgress: "Procijenjeni napredak",
    estimate: "Procjena",
    target: "Ciljna težina {weight}",
        monthEstimate: "{month} · procjena",
    estimateAria: "Procijenjena težina: sada {from}, {to} — procjena: {month}",
  },
  plan: {
    goalLose: "Cilj: −{delta} · {month}",
    goalGain: "Cilj: +{delta} · {month}",
    goalMaintain: "Cilj: zadržati težinu",
    rest: "Tijelo u mirovanju troši", activity: "S tvojom aktivnošću, oko", pace: "Za tvoj tempo prilagođavamo", floor: "Donja granica koju ne prelazimo", protein: "Ciljani unos proteina",
  },
  health: {
    title: "Sinkroniziraj s aplikacijom Zdravlje",
    body: "Težina i aktivnost stižu ovamo. Obroci idu u aplikaciju Zdravlje.",
  },
  targetSuggestion:  {
    down: "Predlažem {weight}, oko {pct}% manje — dobar prvi cilj",
    up: "Predlažem {weight}, oko {pct}% više — dobar prvi cilj",
  },
  firstMeal:  FIRST_MEAL_COPY.hr!,
  stepper:  { continue: "Nastavi", less: "Manje", more: "Više" },
  offerHeadline:  "Cilj: {kg} kg · {month}",
  planGoal: { metric: "Cilj: −{n} kg · {month}", imperial: "Cilj: −{n} lb · {month}" },
};

const SK: ChatCopy = {
  idlePlaceholder:  "Spud čaká na správu…",
  continueLabel: "Pokračovať",
  saveKept: "Nepodarilo sa to uložiť. Tvoja odpoveď je stále tu. Ťuknutím na Pokračovať ju pošleš znova.",
  underAgeCard:  {
    title: "eait je od {age} rokov",
    body: "Spôsob, akým táto aplikácia nastavuje kalorické normy, nie je určený pre telo, ktoré ešte rastie.",
  },
  underAge:  {
    ask: "Prepáč — tu musím skončiť. Ak sme sa sem dostali kvôli preklepu, pošli svoj skutočný vek.",
    confirm: "To je môj skutočný vek",
    placeholder: "Tvoj vek",
    stopped: [
      "Tak tu končíme. Mažem všetky tvoje odpovede.",
      "Vráť sa, keď budeš mať {age}, budem tu.",
    ],
    endedPlaceholder: "eait je od {age} rokov",
  },
  belowHealthy:  {
    title: "Toto ako cieľ nastaviť nemôžem",
    body: "Najnižšia zdravá váha pre tvoju výšku je asi {kg} kg. Cieľ pod ňou nenastavíme. Ak s lekárom pracuješ na niečom inom, riaď sa ním, nie touto aplikáciou.",
  },
  invalid:  {
    age: "To nevyzerá ako vek — skús niečo ako 34.",
    height_cm: "V centimetroch — niečo ako 175.",
    weight_kg: "V kilogramoch — stačí približne.",
    target_weight_kg: "Číslo v kg — napríklad 70.",
  },
  ambiguousAge:  {
    line: "Chcem mať istotu, že to čítam správne — ak ide o rok {year}, pošli všetky štyri číslice.",
    confirm: "Mám {age} rokov",
  },
  direction:  {
    gain: "Teraz máš {weight} kg a chceš pribrať na {target} — odtiaľto to nie je prírastok. Ak sa cieľ zmenil, môžeme ho prepnúť; inak mi daj číslo nad {weight}.",
    lose: "Teraz máš {weight} kg a chceš schudnúť na {target} — odtiaľto to nie je úbytok. Ak sa cieľ zmenil, môžeme ho prepnúť; inak mi daj číslo pod {weight}.",
    switchToLose: "Prepnúť na chudnutie",
    switchToGain: "Prepnúť na priberanie",
    above: "Číslo nad {weight}…",
    below: "Číslo pod {weight}…",
  },
  switched:  {
    gain: "Prepnuté — ideme priberať. Kde chceš byť, v kg?",
    lose: "Prepnuté — ideme chudnúť. Kde chceš byť, v kg? Rýchlejšie tu neznamená lepšie — len ťažšie udržateľné.",
  },
  capNoteTail:  " To je asi {kg} kg za týždeň.",
  goalEdit:  {
    cleared: "Tvoja cieľová váha už k tomuto cieľu nesedela, tak sme ju vymazali — nastav novú.",
    worthSetting: "Zapísané. Tvoja cieľová váha však už nesedí s tvojím cieľom — oplatí sa nastaviť novú.",
  },
  target: {
    // "55 · lowest we set" under the range's floor, "74 · now" beside today, "− 6kg" the
    // answer's distance from it.
    lowest: "{weight} · najnižšia, akú nastavíme",
    now: "{weight} · teraz",
    nowLowest: "{weight} · teraz · najnižšia, akú nastavíme",
    deltaDown: "− {weight}",
    deltaUp: "+ {weight}",
  },
  pace: {
    rate: "{rate} za týždeň",
    rateSuffix: "za týždeň",
    result: "{target} približne {month} · {kcal} kcal denne",
    capMarker: "obmedzené na bezpečnú hranicu",
    floorMarker: "nikdy pod {floor} · pri každom tempe",
    echo: "Z {from} na {to}.",
  },
  how: {
    title: "Ako eait funguje",
    meal: "Losos, ryža, zelenina",
    photoAlt: "Miska s obilninami v hľadáčiku",
    steps: ["Odfoť tanier", "Získaj poctivé makrá", "Sleduj svoj pokrok"],
  },
  units: { years: "rokov", yearsCount: { one: "{n} rok", other: "{n} r." } },
  twice: {
    title: "Schudni dvakrát viac",
    sub: "Ľudia, ktorí si zapisujú, čo jedia, schudnú dvakrát viac",
    without: "Bez zapisovania",
    with: "S eait",
    source: "Hollis et al., Am J Prev Med, 2008",
    alt: "Bez zapisovania: 1×; s eait: 2×",
  },
  baseline: {
    title: "Tu je tvoj východiskový bod",
    bmi: "Index telesnej hmotnosti (BMI)",
    bands: { under: "PODVÁHA", healthy: "NORMA", over: "NADVÁHA", obese: "OBEZITA" },
    verdict: { under: "Tvoje BMI je pod zdravým rozmedzím", healthy: "Tvoje BMI je v zdravom rozmedzí", above: "Tvoje BMI je nad zdravým rozmedzím" },
    note: "Tvoj plán s tým počíta.",
    you: "Ty",
    body: "Výška · váha",
    activity: "Aktivita",
  },
  possible: { lose: "O {delta} menej? Reálne a možné!", gain: "O {delta} viac? Reálne a možné!" },
  ageWhy: "Metabolizmus sa s vekom mení, preto to zohľadňujeme",
  ontrack: {
    title: "Navrhnuté, aby ťa udržalo v kurze",
    captions: {
      consistency: "Vynechaný deň nič nestojí. Ďalší začína od nuly.",
      habits: "Nič nie je zakázané. Každý tanier dostane poctivé makrá.",
      support: "Pýtaj sa na čokoľvek, kedykoľvek — {coach} je v Chate.",
      busy: "Jedna fotka je celý záznam.",
      ideas: "Nevieš, čo na večeru? {coach} poradí, čo sa ešte zmestí.",
    },
  },
  chart: {
    byEait: "s eait",
    weightTrend: "Vývoj váhy",
    without: "Bez",
    now: "Teraz",
    later: "Neskôr",
    twoWays: "Váha v čase, dvoma spôsobmi: s plánom a bez neho",
    estimatedProgress: "Odhadovaný pokrok",
    estimate: "Odhad",
    target: "Cieľová váha {weight}",
        monthEstimate: "{month} · odhad",
    estimateAria: "Odhadovaná váha: teraz {from}, {to} približne {month}",
  },
  plan: {
    goalLose: "Cieľ: −{delta} · {month}",
    goalGain: "Cieľ: +{delta} · {month}",
    goalMaintain: "Cieľ: udržať si váhu",
    rest: "Tvoje telo v pokoji spáli", activity: "S tvojou aktivitou asi", pace: "Pre tvoje tempo upravujeme", floor: "Minimum, pod ktoré nejdeme", protein: "Odporúčané bielkoviny",
  },
  health: {
    title: "Synchronizácia s aplikáciou Zdravie",
    body: "Váha a aktivita prídu sem. Tvoje jedlá idú do aplikácie Zdravie.",
  },
  targetSuggestion:  {
    down: "Navrhujem {weight}, asi o {pct} % menej, dobrý prvý cieľ",
    up: "Navrhujem {weight}, asi o {pct} % viac, dobrý prvý cieľ",
  },
  firstMeal:  FIRST_MEAL_COPY.sk!,
  stepper:  { continue: "Pokračovať", less: "Menej", more: "Viac" },
  offerHeadline:  "Cieľ {kg} kg · {month}",
  planGoal: { metric: "Cieľ: −{n} kg · {month}", imperial: "Cieľ: −{n} lb · {month}" },
};

const NO: ChatCopy = {
  idlePlaceholder:  "Melding til Spud…",
  continueLabel: "Fortsett",
  saveKept: "Det kunne ikke lagres. Svaret ditt er fortsatt her. Fortsett sender det på nytt.",
  underAgeCard:  {
    title: "eait er for {age} år og oppover",
    body: "Måten denne appen setter kalorirammer på, er ikke laget for en kropp som fortsatt vokser.",
  },
  underAge:  {
    ask: "Beklager — jeg må stoppe her. Hvis det var en skrivefeil, send bare den riktige alderen din.",
    confirm: "Det er min riktige alder",
    placeholder: "Alderen din",
    stopped: [
      "Da stopper vi her. Jeg sletter alt du har fortalt meg.",
      "Kom tilbake når du er {age}, så er jeg her.",
    ],
    endedPlaceholder: "eait er for {age} år og oppover",
  },
  belowHealthy:  {
    title: "Den målvekten kan jeg ikke sette",
    body: "Den laveste sunne vekten for høyden din er rundt {kg} kg. Vi setter ikke et mål under den. Hvis du jobber med en lege mot noe annet, følg legen i stedet for denne appen.",
  },
  invalid:  {
    age: "Det ser ikke ut som en alder — prøv for eksempel 34.",
    height_cm: "I centimeter — for eksempel 175.",
    weight_kg: "I kilo — omtrent er greit.",
    target_weight_kg: "Et tall i kg — for eksempel 70.",
  },
  ambiguousAge:  {
    line: "Jeg vil være sikker på at jeg leste det riktig — hvis du mente året {year}, send alle fire sifrene.",
    confirm: "Jeg er {age}",
  },
  direction:  {
    gain: "Du er på {weight} kg og ba om å gå opp til {target} — det er ingen økning herfra. Hvis målet har endret seg, kan vi bytte det; ellers gi meg et tall over {weight}.",
    lose: "Du er på {weight} kg og ba om å gå ned til {target} — det er ingen nedgang herfra. Hvis målet har endret seg, kan vi bytte det; ellers gi meg et tall under {weight}.",
    switchToLose: "Bytt til å gå ned",
    switchToGain: "Bytt til å gå opp",
    above: "Et tall over {weight}…",
    below: "Et tall under {weight}…",
  },
  switched:  {
    gain: "Byttet — da går vi opp. Hvor vil du lande, i kg?",
    lose: "Byttet — da går vi ned. Hvor vil du lande, i kg? Raskere er ikke bedre her — det er bare vanskeligere å holde.",
  },
  capNoteTail:  " Det er rundt {kg} kg i uken.",
  goalEdit:  {
    cleared: "Målvekten din passet ikke lenger til det målet, så den er nullstilt — sett en ny.",
    worthSetting: "Notert. Målvekten din passer likevel ikke lenger til målet ditt — lurt å sette en ny.",
  },
  target: {
    // "55 · lowest we set" under the range's floor, "74 · now" beside today, "− 6kg" the
    // answer's distance from it.
    lowest: "{weight} · laveste vi setter",
    now: "{weight} · nå",
    nowLowest: "{weight} · nå · laveste vi setter",
    deltaDown: "− {weight}",
    deltaUp: "+ {weight}",
  },
  pace: {
    rate: "{rate} i uken",
    rateSuffix: "i uken",
    result: "{target} rundt {month} · {kcal} kcal om dagen",
    capMarker: "begrenset til den trygge grensen",
    floorMarker: "aldri under {floor} · alle tempoer lander her",
    echo: "Fra {from} til {to}.",
  },
  how: {
    title: "Slik fungerer eait",
    meal: "Laks, ris og grønt",
    photoAlt: "En kornbolle i søkeren",
    steps: ["Ta bilde av tallerkenen", "Få ærlige makroer", "Se fremgangen din"],
  },
  units: { years: "år", yearsCount: { one: "{n} år", other: "{n} år" } },
  twice: {
    title: "Gå ned dobbelt så mye i vekt",
    sub: "De som skriver ned hva de spiser, går ned dobbelt så mye i vekt",
    without: "Uten logging",
    with: "Med eait",
    source: "Hollis et al., Am J Prev Med, 2008",
    alt: "Uten logging: 1×; med eait: 2×",
  },
  baseline: {
    title: "Her er utgangspunktet ditt",
    bmi: "Kroppsmasseindeks (KMI)",
    bands: { under: "UNDERVEKT", healthy: "NORMALVEKT", over: "OVERVEKT", obese: "FEDME" },
    verdict: { under: "KMI-en din er under det sunne området", healthy: "KMI-en din er innenfor det sunne området", above: "KMI-en din er over det sunne området" },
    note: "Planen din tar hensyn til det.",
    you: "Du",
    body: "Høyde · vekt",
    activity: "Aktivitet",
  },
  possible: { lose: "{delta} mindre? Realistisk og mulig!", gain: "{delta} mer? Realistisk og mulig!" },
  ageWhy: "Stoffskiftet endrer seg med alderen, så vi regner det inn",
  ontrack: {
    title: "Laget for å holde deg på sporet",
    captions: {
      consistency: "En glemt dag koster ingenting. Den neste starter på null.",
      habits: "Ingenting er forbudt. Hver tallerken får ærlige makroer.",
      support: "Spør {coach} om hva som helst, når som helst, i Chat.",
      busy: "Ett bilde er hele loggen.",
      ideas: "Tom for middagsideer? Spør {coach} hva som passer med det som er igjen.",
    },
  },
  chart: {
    byEait: "med eait",
    weightTrend: "Vekttrend",
    without: "Uten",
    now: "Nå",
    later: "Senere",
    twoWays: "Vekt over tid, tegnet på to måter: med plan og uten",
    estimatedProgress: "Anslått fremgang",
    estimate: "Anslag",
    target: "Målvekt {weight}",
        monthEstimate: "{month} · anslag",
    estimateAria: "Anslått vekt: {from} nå, {to} rundt {month}",
  },
  plan: {
    goalLose: "Mål: −{delta} innen {month}",
    goalGain: "Mål: +{delta} innen {month}",
    goalMaintain: "Mål: holde vekten",
    rest: "Kroppen din forbrenner i hvile", activity: "Med aktiviteten din, rundt", pace: "For tempoet ditt justerer vi", floor: "Den nedre grensen vi ikke går under", protein: "Protein å sikte mot",
  },
  health: {
    title: "Synkroniser med Apple Helse",
    body: "Vekt og aktivitet kommer inn. Måltidene dine går til Helse.",
  },
  targetSuggestion:  {
    down: "Jeg foreslår {weight}, rundt {pct} % ned, et godt første mål",
    up: "Jeg foreslår {weight}, rundt {pct} % opp, et godt første mål",
  },
  firstMeal:  FIRST_MEAL_COPY.no!,
  stepper:  { continue: "Fortsett", less: "Mindre", more: "Mer" },
  offerHeadline:  "{kg} kg innen {month}",
  planGoal: { metric: "Mål: −{n} kg innen {month}", imperial: "Mål: −{n} lb innen {month}" },
};

const FI: ChatCopy = {
  idlePlaceholder:  "Kirjoita Spudille…",
  continueLabel: "Jatka",
  saveKept: "Tallennus epäonnistui. Vastauksesi on yhä tässä. Jatka lähettää sen uudelleen.",
  underAgeCard:  {
    title: "eait on {age} vuotta täyttäneille",
    body: "Tapa, jolla tämä sovellus asettaa kalorien tavoitetasot, ei sovi vielä kasvavalle keholle.",
  },
  underAge:  {
    ask: "Valitettavasti minun on lopetettava tähän. Jos syynä oli kirjoitusvirhe, lähetä vain oikea ikäsi.",
    confirm: "Tämä on oikea ikäni",
    placeholder: "Ikäsi",
    stopped: [
      "Sitten lopetamme tähän. Poistan kaiken, mitä kerroit minulle.",
      "Palaa, kun olet {age}, olen täällä.",
    ],
    endedPlaceholder: "eait on {age} vuotta täyttäneille",
  },
  belowHealthy:  {
    title: "En voi asettaa tuota tavoitepainoksi",
    body: "Pituudellesi alin terve paino on noin {kg} kg. Emme aseta tavoitetta sen alle. Jos teet lääkärin kanssa töitä jonkin muun tavoitteen eteen, noudata hänen ohjeitaan tämän sovelluksen sijaan.",
  },
  invalid:  {
    age: "Tuo ei näytä iältä – kokeile vaikkapa 34.",
    height_cm: "Senttimetreinä – esimerkiksi 175.",
    weight_kg: "Kilogrammoina – suunnilleen riittää.",
    target_weight_kg: "Luku kilogrammoina – esimerkiksi 70.",
  },
  ambiguousAge:  {
    line: "Haluan varmistaa, että luin oikein – jos tarkoitit vuotta {year}, lähetä kaikki neljä numeroa.",
    confirm: "Olen {age}",
  },
  direction:  {
    gain: "Painat nyt {weight} kg ja tavoitepainoksi annoit {target} – se ei ole painonnousua tästä. Jos tavoite muuttui, voimme vaihtaa sen; muuten anna luku, joka on yli {weight}.",
    lose: "Painat nyt {weight} kg ja tavoitepainoksi annoit {target} – se ei ole painonpudotusta tästä. Jos tavoite muuttui, voimme vaihtaa sen; muuten anna luku, joka on alle {weight}.",
    switchToLose: "Vaihda painonpudotukseen",
    switchToGain: "Vaihda painonnousuun",
    above: "Luku, joka on yli {weight}…",
    below: "Luku, joka on alle {weight}…",
  },
  switched:  {
    gain: "Vaihdettu – painonnousu siis. Mihin haluaisit päätyä, kilogrammoina?",
    lose: "Vaihdettu – painonpudotus siis. Mihin haluaisit päätyä, kilogrammoina? Nopeampi ei ole tässä parempi – vain vaikeampi pitää.",
  },
  capNoteTail:  " Se on noin {kg} kg viikossa.",
  goalEdit:  {
    cleared: "Tavoitepainosi ei enää sopinut siihen tavoitteeseen, joten se tyhjennettiin – aseta uusi.",
    worthSetting: "Tallennettu. Tavoitepainosi ei kuitenkaan enää sovi tavoitteeseesi – uusi kannattaa asettaa.",
  },
  target: {
    // "55 · lowest we set" under the range's floor, "74 · now" beside today, "− 6kg" the
    // answer's distance from it.
    lowest: "{weight} · alin, jonka asetamme",
    now: "{weight} · nyt",
    nowLowest: "{weight} · nyt · alin, jonka asetamme",
    deltaDown: "− {weight}",
    deltaUp: "+ {weight}",
  },
  pace: {
    rate: "{rate} viikossa",
    rateSuffix: "viikossa",
    result: "{target} · arvio: {month} · {kcal} kcal päivässä",
    capMarker: "rajattu turvalliseen enimmäismäärään",
    floorMarker: "ei koskaan alle {floor} · tahdista riippumatta",
    echo: "Nykyisestä {from} tavoitepainoon {to}.",
  },
  how: {
    title: "Näin eait toimii",
    meal: "Lohta, riisiä, vihreää",
    photoAlt: "Viljakulho etsimessä",
    steps: ["Kuvaa lautanen", "Saat rehelliset makrot", "Näe edistymisesi"],
  },
  units: { years: "vuotta", yearsCount: { one: "{n} vuosi", other: "{n} vuotta" } },
  twice: {
    title: "Laihdu kaksi kertaa enemmän",
    sub: "Syömisensä kirjaavat laihtuvat kaksi kertaa enemmän",
    without: "Ilman kirjaamista",
    with: "eait-sovelluksella",
    source: "Hollis et al., Am J Prev Med, 2008",
    alt: "Ilman kirjaamista: 1×; eait-sovelluksella: 2×",
  },
  baseline: {
    title: "Tässä on lähtötasosi",
    bmi: "Painoindeksi (BMI)",
    bands: { under: "ALIPAINO", healthy: "NORMAALIPAINO", over: "YLIPAINO", obese: "LIHAVUUS" },
    verdict: { under: "Painoindeksisi on alle terveen alueen", healthy: "Painoindeksisi on terveellä alueella", above: "Painoindeksisi on yli terveen alueen" },
    note: "Suunnitelmasi ottaa sen huomioon.",
    you: "Sinä",
    body: "Pituus · paino",
    activity: "Aktiivisuus",
  },
  possible: { lose: "{delta} vähemmän? Realistista ja mahdollista!", gain: "{delta} enemmän? Realistista ja mahdollista!" },
  ageWhy: "Aineenvaihdunta muuttuu iän myötä, joten otamme sen huomioon",
  ontrack: {
    title: "Tehty auttamaan sinua pysymään suunnitelmassa",
    captions: {
      consistency: "Väliin jäänyt päivä ei maksa mitään. Seuraava alkaa nollasta.",
      habits: "Mikään ei ole kiellettyä. Jokainen lautanen saa rehelliset makrot.",
      support: "Chatissa {coach} vastaa mihin vain, milloin vain.",
      busy: "Yksi kuva on koko kirjaus.",
      ideas: "Ei ideaa päivälliseksi? {coach} kertoo, mikä vielä mahtuu.",
    },
  },
  chart: {
    byEait: "eait-sovelluksella",
    weightTrend: "Painon kehitys",
    without: "Ilman",
    now: "Nyt",
    later: "Myöhemmin",
    twoWays: "Paino ajan mittaan kahdella tavalla piirrettynä: suunnitelman kanssa ja ilman",
    estimatedProgress: "Arvioitu edistyminen",
    estimate: "Arvio",
    target: "Tavoitepaino {weight}",
        monthEstimate: "{month} · arvio",
    estimateAria: "Arvioitu paino: nyt {from}, {to} arviolta {month}",
  },
  plan: {
    goalLose: "Tavoite: −{delta} · {month}",
    goalGain: "Tavoite: +{delta} · {month}",
    goalMaintain: "Tavoite: painon säilyttäminen",
    rest: "Levossa kehosi kuluttaa", activity: "Aktiivisuutesi kanssa noin", pace: "Tahtisi mukaan säädämme", floor: "Alaraja, jonka alle emme mene", protein: "Proteiinin tavoitetaso",
  },
  health: {
    title: "Synkronoi Terveys-apin kanssa",
    body: "Paino ja aktiivisuus tulevat sisään. Ateriasi menevät Terveys-appiin.",
  },
  targetSuggestion:  {
    down: "Ehdotan {weight}, noin {pct} % vähemmän, hyvä ensimmäinen tavoite",
    up: "Ehdotan {weight}, noin {pct} % enemmän, hyvä ensimmäinen tavoite",
  },
  firstMeal:  FIRST_MEAL_COPY.fi!,
  stepper:  { continue: "Jatka", less: "Vähemmän", more: "Enemmän" },
  offerHeadline:  "Tavoitepaino {kg} kg · {month}",
  planGoal: { metric: "Tavoite: −{n} kg · {month}", imperial: "Tavoite: −{n} lb · {month}" },
};

const DA: ChatCopy = {
  idlePlaceholder:  "Skriv til Spud…",
  continueLabel: "Fortsæt",
  saveKept: "Det kunne ikke gemmes. Dit svar er her stadig. Fortsæt sender det igen.",
  underAgeCard:  {
    title: "eait er fra {age} år",
    body: "Den måde, appen sætter kaloriemål på, er ikke lavet til en krop, der stadig vokser.",
  },
  underAge:  {
    ask: "Beklager — jeg er nødt til at stoppe her. Hvis det skyldes en tastefejl, så send bare din rigtige alder.",
    confirm: "Det er min rigtige alder",
    placeholder: "Din alder",
    stopped: [
      "Så stopper vi her. Jeg sletter alt, hvad du har fortalt mig.",
      "Kom tilbage, når du er {age}, så er jeg her.",
    ],
    endedPlaceholder: "eait er fra {age} år",
  },
  belowHealthy:  {
    title: "Det kan jeg ikke sætte som målvægt",
    body: "Den laveste sunde vægt for din højde er cirka {kg} kg. Vi sætter ikke et mål under den. Hvis du arbejder sammen med en læge om noget andet, så følg lægen frem for denne app.",
  },
  invalid:  {
    age: "Det ligner ikke en alder — prøv noget i stil med 34.",
    height_cm: "I centimeter — noget i stil med 175.",
    weight_kg: "I kilo — cirka er fint.",
    target_weight_kg: "Et tal i kg — fx 70.",
  },
  ambiguousAge:  {
    line: "Jeg vil være sikker på, at jeg læste det rigtigt — hvis du mente året {year}, så send alle fire cifre.",
    confirm: "Jeg er {age}",
  },
  direction:  {
    gain: "Du vejer {weight} kg og bad om at komme op på {target} — det er ikke en stigning herfra. Hvis målet har ændret sig, kan vi skifte det; ellers giv mig et tal over {weight}.",
    lose: "Du vejer {weight} kg og bad om at komme ned på {target} — det er ikke et fald herfra. Hvis målet har ændret sig, kan vi skifte det; ellers giv mig et tal under {weight}.",
    switchToLose: "Skift til vægttab",
    switchToGain: "Skift til vægtøgning",
    above: "Et tal over {weight}…",
    below: "Et tal under {weight}…",
  },
  switched:  {
    gain: "Skiftet — så er det vægtøgning. Hvor vil du gerne ende, i kg?",
    lose: "Skiftet — så er det vægttab. Hvor vil du gerne ende, i kg? Hurtigere er ikke bedre her — det er bare sværere at holde.",
  },
  capNoteTail:  " Det er cirka {kg} kg om ugen.",
  goalEdit:  {
    cleared: "Din målvægt passede ikke længere til det mål, så den er nulstillet — sæt en ny.",
    worthSetting: "Noteret. Din målvægt passer dog ikke længere til dit mål — det er værd at sætte en ny.",
  },
  target: {
    // "55 · lowest we set" under the range's floor, "74 · now" beside today, "− 6kg" the
    // answer's distance from it.
    lowest: "{weight} · laveste vi sætter",
    now: "{weight} · nu",
    nowLowest: "{weight} · nu · laveste vi sætter",
    deltaDown: "− {weight}",
    deltaUp: "+ {weight}",
  },
  pace: {
    rate: "{rate} om ugen",
    rateSuffix: "om ugen",
    result: "{target} omkring {month} · {kcal} kcal om dagen",
    capMarker: "begrænset til den sikre grænse",
    floorMarker: "aldrig under {floor} · alle tempi lander her",
    echo: "Fra {from} til {to}.",
  },
  how: {
    title: "Sådan virker eait",
    meal: "Laks, ris, grønt",
    photoAlt: "En kornbowl i søgeren",
    steps: ["Fotografér tallerkenen", "Få ærlige makroer", "Se dine fremskridt"],
  },
  units: { years: "år", yearsCount: { one: "{n} år", other: "{n} år" } },
  twice: {
    title: "Tab dobbelt så meget i vægt",
    sub: "Folk, der skriver ned, hvad de spiser, taber dobbelt så meget i vægt",
    without: "Uden registrering",
    with: "Med eait",
    source: "Hollis et al., Am J Prev Med, 2008",
    alt: "Uden registrering: 1×; med eait: 2×",
  },
  baseline: {
    title: "Her er dit udgangspunkt",
    bmi: "Body Mass Index (BMI)",
    bands: { under: "UNDERVÆGT", healthy: "NORMALVÆGT", over: "OVERVÆGT", obese: "SVÆR OVERVÆGT" },
    verdict: { under: "Dit BMI er under det sunde interval", healthy: "Dit BMI er i det sunde interval", above: "Dit BMI er over det sunde interval" },
    note: "Din plan tager højde for det.",
    you: "Dig",
    body: "Højde · vægt",
    activity: "Aktivitet",
  },
  possible: { lose: "{delta} mindre? Realistisk og muligt!", gain: "{delta} mere? Realistisk og muligt!" },
  ageWhy: "Dit stofskifte ændrer sig med alderen, så det regner vi med",
  ontrack: {
    title: "Lavet til at holde dig på sporet",
    captions: {
      consistency: "En manglende dag koster ingenting. Den næste starter fra nul.",
      habits: "Intet er forbudt. Hver tallerken får ærlige makroer.",
      support: "Spørg {coach} om hvad som helst, når som helst, i Chat.",
      busy: "Ét foto er hele registreringen.",
      ideas: "Mangler du idéer til aftensmad? Spørg {coach}, hvad der passer til det, der er tilbage.",
    },
  },
  chart: {
    byEait: "med eait",
    weightTrend: "Vægtudvikling",
    without: "Uden",
    now: "Nu",
    later: "Senere",
    twoWays: "Vægt over tid, tegnet på to måder: med en plan og uden",
    estimatedProgress: "Anslåede fremskridt",
    estimate: "Skøn",
    target: "Målvægt {weight}",
        monthEstimate: "{month} · skøn",
    estimateAria: "Anslået vægt: {from} nu, {to} omkring {month}",
  },
  plan: {
    goalLose: "Mål: −{delta} inden {month}",
    goalGain: "Mål: +{delta} inden {month}",
    goalMaintain: "Mål: hold min vægt",
    rest: "Din krop forbrænder i hvile", activity: "Med din aktivitet, cirka", pace: "Til dit tempo justerer vi", floor: "Bundgrænsen, vi ikke går under", protein: "Protein at sigte efter",
  },
  health: {
    title: "Synkroniser med Sundhed",
    body: "Vægt og aktivitet kommer ind. Dine måltider går til Sundhed.",
  },
  targetSuggestion:  {
    down: "Jeg foreslår {weight}, cirka {pct} % ned, et godt første mål",
    up: "Jeg foreslår {weight}, cirka {pct} % op, et godt første mål",
  },
  firstMeal:  FIRST_MEAL_COPY.da!,
  stepper:  { continue: "Fortsæt", less: "Mindre", more: "Mere" },
  offerHeadline:  "Nå {kg} kg inden {month}",
  planGoal: { metric: "Mål: −{n} kg inden {month}", imperial: "Mål: −{n} lb inden {month}" },
};

const HU: ChatCopy = {
  idlePlaceholder:  "Üzenet Spudnak…",
  continueLabel: "Tovább",
  saveKept: "Ezt nem sikerült menteni. A válaszod még itt van. A Tovább újra elküldi.",
  underAgeCard:  {
    title: "Az eait {age} éves kortól használható",
    body: "Az app kalóriacél-számítása nem olyan szervezetre készült, amely még növésben van.",
  },
  underAge:  {
    ask: "Sajnálom — itt meg kell állnom. Ha elírás volt, küldd el a valódi életkorodat.",
    confirm: "Ez a valódi életkorom",
    placeholder: "Életkorod",
    stopped: [
      "Akkor itt megállunk. Törlöm mindazt, amit elmondtál.",
      "Gyere vissza {age} évesen, itt leszek.",
    ],
    endedPlaceholder: "Az eait {age} éves kortól használható",
  },
  belowHealthy:  {
    title: "Ezt nem tudom célként beállítani",
    body: "A magasságodhoz tartozó legalacsonyabb egészséges testsúly kb. {kg} kg. Ennél alacsonyabb célt nem állítunk be. Ha orvossal dolgozol valami máson, az ő útmutatását kövesd, ne ezt az appot.",
  },
  invalid:  {
    age: "Ez nem tűnik életkornak — próbáld valami ilyesmivel: 34.",
    height_cm: "Centiméterben — például 175.",
    weight_kg: "Kilogrammban — nagyjából is jó.",
    target_weight_kg: "Egy szám kg-ban — például 70.",
  },
  ambiguousAge:  {
    line: "Biztos akarok lenni benne, hogy jól olvastam — ha évszámra gondoltál ({year}), küldd el mind a négy számjegyet.",
    confirm: "{age} éves vagyok",
  },
  direction:  {
    gain: "Most {weight} kg a testsúlyod, a gyarapodási célod pedig {target} — innen ez nem gyarapodás. Ha a cél változott, átállíthatjuk; különben adj meg egy {weight} feletti számot.",
    lose: "Most {weight} kg a testsúlyod, a fogyási célod pedig {target} — innen ez nem fogyás. Ha a cél változott, átállíthatjuk; különben adj meg egy {weight} alatti számot.",
    switchToLose: "Váltás fogyásra",
    switchToGain: "Váltás súlygyarapításra",
    above: "Egy {weight} feletti szám…",
    below: "Egy {weight} alatti szám…",
  },
  switched:  {
    gain: "Átállítva — akkor súlygyarapítás. Hová szeretnél eljutni, kg-ban?",
    lose: "Átállítva — akkor fogyás. Hová szeretnél eljutni, kg-ban? A gyorsabb itt nem jobb — csak nehezebb megtartani.",
  },
  capNoteTail:  " Ez hetente kb. {kg} kg.",
  goalEdit:  {
    cleared: "A célsúlyod már nem illett ehhez a célhoz, ezért töröltük — állíts be újat.",
    worthSetting: "Elmentve. A célsúlyod viszont már nem illik a célodhoz — érdemes újat beállítani.",
  },
  target: {
    // "55 · lowest we set" under the range's floor, "74 · now" beside today, "− 6kg" the
    // answer's distance from it.
    lowest: "{weight} · legalacsonyabb cél",
    now: "{weight} · most",
    nowLowest: "{weight} · most · legalacsonyabb cél",
    deltaDown: "− {weight}",
    deltaUp: "+ {weight}",
  },
  pace: {
    rate: "heti {rate}",
    rateSuffix: "hetente",
    result: "{target} · kb. {month} · napi {kcal} kcal",
    capMarker: "a biztonságos határnál korlátozva",
    floorMarker: "sosem megy {floor} alá · minden tempó itt köt ki",
    echo: "{from} → {to}.",
  },
  how: {
    title: "Így működik az eait",
    meal: "Lazac, rizs, zöldség",
    photoAlt: "Egy gabonás tál a keresőben",
    steps: ["Fotózd le a tányért", "Kapj őszinte makrókat", "Kövesd a haladásodat"],
  },
  units: { years: "év", yearsCount: { one: "{n} év", other: "{n} év" } },
  twice: {
    title: "Fogyj kétszer annyit",
    sub: "Akik leírják, mit esznek, kétszer annyit fogynak",
    without: "Rögzítés nélkül",
    with: "Az eait-tel",
    source: "Hollis et al., Am J Prev Med, 2008",
    alt: "Rögzítés nélkül: 1×; az eait-tel: 2×",
  },
  baseline: {
    title: "Itt a kiindulópontod",
    bmi: "Testtömegindex (BMI)",
    bands: { under: "ALACSONY TESTSÚLY", healthy: "EGÉSZSÉGES", over: "TÚLSÚLY", obese: "ELHÍZÁS" },
    verdict: { under: "A BMI-d az egészséges tartomány alatt van", healthy: "A BMI-d az egészséges tartományban van", above: "A BMI-d az egészséges tartomány felett van" },
    note: "A terved ezt figyelembe veszi.",
    you: "Te",
    body: "Magasság · testsúly",
    activity: "Aktivitás",
  },
  possible: { lose: "{delta} kevesebb? Reális és lehetséges!", gain: "{delta} több? Reális és lehetséges!" },
  ageWhy: "Az anyagcseréd az életkorral változik, ezt is beszámítjuk",
  ontrack: {
    title: "Úgy építettük, hogy kitarts",
    captions: {
      consistency: "Egy kihagyott nap semmibe sem kerül. A következő nulláról indul.",
      habits: "Semmi sem tilos. Minden tányér őszinte makrókat kap.",
      support: "Bármit kérdezhetsz, bármikor, a Csevegésben: {coach} válaszol.",
      busy: "Egy fotó az egész rögzítés.",
      ideas: "Nincs ötleted vacsorára? {coach} megmondja, mi fér még bele.",
    },
  },
  chart: {
    byEait: "az eait-tel",
    weightTrend: "Testsúlytrend",
    without: "Nélküle",
    now: "Most",
    later: "Később",
    twoWays: "Testsúly az idő függvényében, kétféleképp: tervvel és terv nélkül",
    estimatedProgress: "Becsült haladás",
    estimate: "Becslés",
    target: "Cél: {weight}",
        monthEstimate: "{month} · becslés",
    estimateAria: "Becsült testsúly: most {from}, kb. {month}: {to}",
  },
  plan: {
    goalLose: "Cél: −{delta} · határidő: {month}",
    goalGain: "Cél: +{delta} · határidő: {month}",
    goalMaintain: "Cél: a testsúlyom megtartása",
    rest: "Nyugalomban a tested ennyit éget el", activity: "Az aktivitásoddal nagyjából", pace: "A tempódhoz igazítunk", floor: "Az alsó határ, amit nem lépünk át", protein: "Fehérjecél",
  },
  health: {
    title: "Szinkronizálás az Egészség appal",
    body: "A testsúly és az aktivitás beérkezik. Az étkezéseid az Egészség appba kerülnek.",
  },
  targetSuggestion:  {
    down: "Javaslatom: {weight}, kb. {pct}%-kal kevesebb, jó első cél",
    up: "Javaslatom: {weight}, kb. {pct}%-kal több, jó első cél",
  },
  firstMeal:  FIRST_MEAL_COPY.hu!,
  stepper:  { continue: "Tovább", less: "Kevesebb", more: "Több" },
  offerHeadline:  "Cél: {kg} kg · határidő: {month}",
  planGoal: { metric: "Cél: −{n} kg · határidő: {month}", imperial: "Cél: −{n} lb · határidő: {month}" },
};

const EL: ChatCopy = {
  idlePlaceholder:  "Μήνυμα προς Spud…",
  continueLabel: "Συνέχεια",
  saveKept: "Δεν ήταν δυνατή η αποθήκευση. Η απάντησή σου είναι ακόμα εδώ. Πάτα Συνέχεια για να σταλεί ξανά.",
  underAgeCard:  {
    title: "Το eait είναι για ηλικίες {age} και άνω",
    body: "Ο τρόπος που αυτή η εφαρμογή ορίζει στόχους θερμίδων δεν είναι σχεδιασμένος για σώμα που ακόμα αναπτύσσεται.",
  },
  underAge:  {
    ask: "Συγγνώμη — πρέπει να σταματήσω εδώ. Αν φταίει κάποιο τυπογραφικό, απλώς στείλε την πραγματική σου ηλικία.",
    confirm: "Αυτή είναι η πραγματική μου ηλικία",
    placeholder: "Η ηλικία σου",
    stopped: [
      "Τότε σταματάμε εδώ. Διαγράφω όλα όσα μου είπες.",
      "Έλα ξανά στα {age} και θα είμαι εδώ.",
    ],
    endedPlaceholder: "Το eait είναι για ηλικίες {age} και άνω",
  },
  belowHealthy:  {
    title: "Δεν μπορώ να το ορίσω ως στόχο",
    body: "Το χαμηλότερο υγιές βάρος για το ύψος σου είναι περίπου {kg} kg. Δεν θα ορίσουμε στόχο κάτω από αυτό. Αν δουλεύεις με γιατρό για κάτι διαφορετικό, ακολούθησε τις ιατρικές οδηγίες κι όχι αυτή την εφαρμογή.",
  },
  invalid:  {
    age: "Αυτό δεν μοιάζει με ηλικία — δοκίμασε κάτι σαν 34.",
    height_cm: "Σε εκατοστά — κάτι σαν 175.",
    weight_kg: "Σε κιλά — κατά προσέγγιση αρκεί.",
    target_weight_kg: "Ένας αριθμός σε kg — π.χ. 70.",
  },
  ambiguousAge:  {
    line: "Θέλω να βεβαιωθώ ότι το διάβασα σωστά — αν εννοούσες το έτος {year}, στείλε και τα τέσσερα ψηφία.",
    confirm: "Είμαι {age} ετών",
  },
  direction:  {
    gain: "Είσαι στα {weight} kg και ζήτησες να ανέβεις στα {target} — από εδώ αυτό δεν είναι αύξηση. Αν άλλαξε ο στόχος, μπορούμε να τον αλλάξουμε· αλλιώς δώσε μου έναν αριθμό πάνω από {weight}.",
    lose: "Είσαι στα {weight} kg και ζήτησες να πέσεις στα {target} — από εδώ αυτό δεν είναι μείωση. Αν άλλαξε ο στόχος, μπορούμε να τον αλλάξουμε· αλλιώς δώσε μου έναν αριθμό κάτω από {weight}.",
    switchToLose: "Αλλαγή σε απώλεια βάρους",
    switchToGain: "Αλλαγή σε αύξηση βάρους",
    above: "Ένας αριθμός πάνω από {weight}…",
    below: "Ένας αριθμός κάτω από {weight}…",
  },
  switched:  {
    gain: "Έγινε — πάμε για αύξηση. Πού θα ήθελες να φτάσεις, σε kg;",
    lose: "Έγινε — πάμε για απώλεια. Πού θα ήθελες να φτάσεις, σε kg; Το πιο γρήγορο δεν είναι καλύτερο εδώ — απλώς πιο δύσκολο να διατηρηθεί.",
  },
  capNoteTail:  " Αυτό είναι περίπου {kg} kg την εβδομάδα.",
  goalEdit:  {
    cleared: "Το βάρος-στόχος σου δεν ταίριαζε πια με αυτόν τον στόχο, οπότε διαγράφηκε — όρισε νέο.",
    worthSetting: "Καταχωρίστηκε. Το βάρος-στόχος σου όμως δεν ταιριάζει πια με τον στόχο σου — αξίζει να ορίσεις νέο.",
  },
  target: {
    // "55 · lowest we set" under the range's floor, "74 · now" beside today, "− 6kg" the
    // answer's distance from it.
    lowest: "{weight} · το κατώτατο που ορίζουμε",
    now: "{weight} · τώρα",
    nowLowest: "{weight} · τώρα · το κατώτατο που ορίζουμε",
    deltaDown: "− {weight}",
    deltaUp: "+ {weight}",
  },
  pace: {
    rate: "{rate} την εβδομάδα",
    rateSuffix: "την εβδομάδα",
    result: "{target} περίπου έως {month} · {kcal} kcal την ημέρα",
    capMarker: "περιορισμένο στο ασφαλές όριο",
    floorMarker: "ποτέ κάτω από {floor} · κάθε ρυθμός καταλήγει εδώ",
    echo: "Από {from} σε {to}.",
  },
  how: {
    title: "Πώς λειτουργεί το eait",
    meal: "Σολομός, ρύζι, πράσινα λαχανικά",
    photoAlt: "Ένα μπολ με δημητριακά στο σκόπευτρο",
    steps: ["Φωτογράφισε το πιάτο", "Πάρε ειλικρινή μακροθρεπτικά", "Δες την πρόοδό σου"],
  },
  units: { years: "έτη", yearsCount: { one: "{n} έτος", other: "{n} έτη" } },
  twice: {
    title: "Χάσε διπλάσιο βάρος",
    sub: "Όσοι καταγράφουν τι τρώνε χάνουν διπλάσιο βάρος",
    without: "Χωρίς καταγραφή",
    with: "Με το eait",
    source: "Hollis et al., Am J Prev Med, 2008",
    alt: "Χωρίς καταγραφή: 1×· με το eait: 2×",
  },
  baseline: {
    title: "Αυτό είναι το σημείο εκκίνησής σου",
    bmi: "Δείκτης Μάζας Σώματος (ΔΜΣ)",
    bands: { under: "ΧΑΜΗΛΟ ΒΑΡΟΣ", healthy: "ΦΥΣΙΟΛΟΓΙΚΟ ΒΑΡΟΣ", over: "ΑΥΞΗΜΕΝΟ ΒΑΡΟΣ", obese: "ΠΑΧΥΣΑΡΚΙΑ" },
    verdict: { under: "Ο ΔΜΣ σου είναι κάτω από το υγιές εύρος", healthy: "Ο ΔΜΣ σου είναι μέσα στο υγιές εύρος", above: "Ο ΔΜΣ σου είναι πάνω από το υγιές εύρος" },
    note: "Το πλάνο σου το λαμβάνει υπόψη.",
    you: "Εσύ",
    body: "Ύψος · βάρος",
    activity: "Δραστηριότητα",
  },
  possible: { lose: "{delta} λιγότερα; Ρεαλιστικό και εφικτό!", gain: "{delta} περισσότερα; Ρεαλιστικό και εφικτό!" },
  ageWhy: "Ο μεταβολισμός σου αλλάζει με την ηλικία, γι' αυτό το υπολογίζουμε",
  ontrack: {
    title: "Φτιαγμένο για να μένεις σε τροχιά",
    captions: {
      consistency: "Μια χαμένη μέρα δεν κοστίζει τίποτα. Η επόμενη ξεκινά από το μηδέν.",
      habits: "Τίποτα δεν απαγορεύεται. Κάθε πιάτο παίρνει ειλικρινή μακροθρεπτικά.",
      support: "Κάνε ό,τι ερώτηση θες προς {coach}, οποτεδήποτε, στη Συνομιλία.",
      busy: "Μία φωτογραφία είναι όλη η καταγραφή.",
      ideas: "Κόλλησες με το βραδινό; Ζήτα από {coach} κάτι που χωράει σε ό,τι απομένει.",
    },
  },
  chart: {
    byEait: "με το eait",
    weightTrend: "Τάση βάρους",
    without: "Χωρίς",
    now: "Τώρα",
    later: "Αργότερα",
    twoWays: "Το βάρος στον χρόνο, με δύο τρόπους: με πλάνο και χωρίς",
    estimatedProgress: "Εκτιμώμενη πρόοδος",
    estimate: "Εκτίμηση",
    target: "Στόχος {weight}",
        monthEstimate: "{month} · εκτίμηση",
    estimateAria: "Εκτιμώμενο βάρος: {from} τώρα, {to} περίπου έως {month}",
  },
  plan: {
    goalLose: "Στόχος: −{delta} έως {month}",
    goalGain: "Στόχος: +{delta} έως {month}",
    goalMaintain: "Στόχος: να διατηρήσω το βάρος μου",
    rest: "Σε ηρεμία το σώμα σου καίει", activity: "Με τη δραστηριότητά σου, περίπου", pace: "Για τον ρυθμό σου, προσαρμόζουμε", floor: "Το κατώτατο όριο που δεν περνάμε", protein: "Στόχος πρωτεΐνης",
  },
  health: {
    title: "Συγχρονισμός με την Υγεία",
    body: "Το βάρος και η δραστηριότητα έρχονται εδώ. Τα γεύματά σου πάνε στην Υγεία.",
  },
  targetSuggestion:  {
    down: "Προτείνω {weight}, περίπου {pct}% λιγότερο, ένας καλός πρώτος στόχος",
    up: "Προτείνω {weight}, περίπου {pct}% περισσότερο, ένας καλός πρώτος στόχος",
  },
  firstMeal:  FIRST_MEAL_COPY.el!,
  stepper:  { continue: "Συνέχεια", less: "Λιγότερο", more: "Περισσότερο" },
  offerHeadline:  "{kg} kg έως {month}",
  planGoal: { metric: "Στόχος: −{n} kg έως {month}", imperial: "Στόχος: −{n} lb έως {month}" },
};

const RO: ChatCopy = {
  idlePlaceholder:  "Scrie-i lui Spud…",
  continueLabel: "Continuă",
  saveKept: "Nu s-a putut salva. Răspunsul tău e încă aici. Continuă îl trimite din nou.",
  underAgeCard:  {
    title: "eait e de la {age} ani",
    body: "Modul în care aplicația stabilește țintele de calorii nu e gândit pentru un corp aflat încă în creștere.",
  },
  underAge:  {
    ask: "Îmi pare rău — trebuie să mă opresc aici. Dacă e o greșeală de tastare, trimite-mi vârsta reală.",
    confirm: "Asta e vârsta mea reală",
    placeholder: "Vârsta ta",
    stopped: [
      "Atunci ne oprim aici. Șterg tot ce mi-ai spus.",
      "Revino la {age} ani și o să fiu aici.",
    ],
    endedPlaceholder: "eait e de la {age} ani",
  },
  belowHealthy:  {
    title: "Nu pot seta asta ca țintă",
    body: "Cea mai mică greutate sănătoasă pentru înălțimea ta e de aproximativ {kg} kg. Nu stabilim un obiectiv sub ea. Dacă lucrezi cu un medic la altceva, urmează-i sfaturile, nu pe ale acestei aplicații.",
  },
  invalid:  {
    age: "Nu pare o vârstă — încearcă ceva de genul 34.",
    height_cm: "În centimetri — ceva de genul 175.",
    weight_kg: "În kilograme — aproximativ e în regulă.",
    target_weight_kg: "Un număr în kg — de exemplu 70.",
  },
  ambiguousAge:  {
    line: "Vreau să mă asigur că am citit bine — dacă te refereai la anul {year}, trimite toate cele patru cifre.",
    confirm: "Am {age} ani",
  },
  direction:  {
    gain: "Ai {weight} kg și ai cerut să ajungi la {target} — de aici nu e o creștere. Dacă s-a schimbat obiectivul, îl putem schimba; altfel dă-mi un număr peste {weight}.",
    lose: "Ai {weight} kg și ai cerut să cobori la {target} — de aici nu e o scădere. Dacă s-a schimbat obiectivul, îl putem schimba; altfel dă-mi un număr sub {weight}.",
    switchToLose: "Treci la slăbit",
    switchToGain: "Treci la luat în greutate",
    above: "Un număr peste {weight}…",
    below: "Un număr sub {weight}…",
  },
  switched:  {
    gain: "Am schimbat — deci luăm în greutate. Unde ai vrea să ajungi, în kg?",
    lose: "Am schimbat — deci slăbim. Unde ai vrea să ajungi, în kg? Mai repede nu e mai bine aici — e doar mai greu de menținut.",
  },
  capNoteTail:  " Asta înseamnă cam {kg} kg pe săptămână.",
  goalEdit:  {
    cleared: "Greutatea țintă nu se mai potrivea cu acest obiectiv, așa că a fost ștearsă — setează una nouă.",
    worthSetting: "Am notat. Totuși, greutatea țintă nu se mai potrivește cu obiectivul tău — merită să setezi una nouă.",
  },
  target: {
    // "55 · lowest we set" under the range's floor, "74 · now" beside today, "− 6kg" the
    // answer's distance from it.
    lowest: "{weight} · minimul nostru",
    now: "{weight} · acum",
    nowLowest: "{weight} · acum · minimul nostru",
    deltaDown: "− {weight}",
    deltaUp: "+ {weight}",
  },
  pace: {
    rate: "{rate} pe săptămână",
    rateSuffix: "pe săptămână",
    result: "{target} cam în {month} · {kcal} kcal pe zi",
    capMarker: "plafonat la limita sigură",
    floorMarker: "niciodată sub {floor} · orice ritm ajunge aici",
    echo: "De la {from} la {to}.",
  },
  how: {
    title: "Cum funcționează eait",
    meal: "Somon, orez, legume verzi",
    photoAlt: "Un bol cu cereale în vizor",
    steps: ["Fotografiază farfuria", "Primește macronutrienți onești", "Vezi-ți progresul"],
  },
  units: { years: "ani", yearsCount: { one: "{n} an", other: "{n} ani" } },
  twice: {
    title: "Slăbește de două ori mai mult",
    sub: "Cei care notează ce mănâncă slăbesc de două ori mai mult",
    without: "Fără jurnal",
    with: "Cu eait",
    source: "Hollis et al., Am J Prev Med, 2008",
    alt: "Fără jurnal: 1×; cu eait: 2×",
  },
  baseline: {
    title: "Iată punctul tău de pornire",
    bmi: "Indicele de masă corporală (IMC)",
    bands: { under: "SUBPONDERE", healthy: "NORMAL", over: "SUPRAPONDERE", obese: "OBEZITATE" },
    verdict: { under: "IMC-ul tău e sub intervalul sănătos", healthy: "IMC-ul tău e în intervalul sănătos", above: "IMC-ul tău e peste intervalul sănătos" },
    note: "Planul tău ține cont de asta.",
    you: "Tu",
    body: "Înălțime · greutate",
    activity: "Activitate",
  },
  possible: { lose: "Cu {delta} mai puțin? Realist și posibil!", gain: "Cu {delta} mai mult? Realist și posibil!" },
  ageWhy: "Metabolismul se schimbă odată cu vârsta, așa că ținem cont de asta",
  ontrack: {
    title: "Gândit să te ajute să rămâi pe drumul bun",
    captions: {
      consistency: "O zi ratată nu costă nimic. Următoarea începe de la zero.",
      habits: "Nimic nu e interzis. Fiecare farfurie primește macronutrienți onești.",
      support: "Pune-i lui {coach} orice întrebare, oricând, în Chat.",
      busy: "O fotografie e toată înregistrarea.",
      ideas: "Nu știi ce să mănânci la cină? {coach} îți spune ce se potrivește cu ce a mai rămas.",
    },
  },
  chart: {
    byEait: "cu eait",
    weightTrend: "Tendința greutății",
    without: "Fără",
    now: "Acum",
    later: "Mai târziu",
    twoWays: "Greutatea în timp, desenată în două feluri: cu plan și fără",
    estimatedProgress: "Progres estimat",
    estimate: "Estimare",
    target: "Țintă {weight}",
        monthEstimate: "{month} · estimare",
    estimateAria: "Greutate estimată: {from} acum, {to} cam în {month}",
  },
  plan: {
    goalLose: "Obiectiv: −{delta} până în {month}",
    goalGain: "Obiectiv: +{delta} până în {month}",
    goalMaintain: "Obiectiv: să-mi mențin greutatea",
    rest: "În repaus, corpul tău arde", activity: "Cu activitatea ta, cam", pace: "Pentru ritmul tău, ajustăm", floor: "Pragul minim sub care nu coborâm", protein: "Ținta de proteine",
  },
  health: {
    title: "Sincronizează cu Sănătate",
    body: "Greutatea și activitatea intră. Mesele tale ajung în Sănătate.",
  },
  targetSuggestion:  {
    down: "Îți sugerez {weight}, cu aproximativ {pct}% mai puțin, un prim obiectiv bun",
    up: "Îți sugerez {weight}, cu aproximativ {pct}% mai mult, un prim obiectiv bun",
  },
  firstMeal:  FIRST_MEAL_COPY.ro!,
  stepper:  { continue: "Continuă", less: "Mai puțin", more: "Mai mult" },
  offerHeadline:  "{kg} kg până în {month}",
  planGoal: { metric: "Obiectiv: −{n} kg până în {month}", imperial: "Obiectiv: −{n} lb până în {month}" },
};

const CS: ChatCopy = {
  idlePlaceholder:  "Zpráva pro Spud…",
  continueLabel: "Pokračovat",
  saveKept: "Nepodařilo se to uložit. Tvoje odpověď tu pořád je. Tlačítko Pokračovat ji odešle znovu.",
  underAgeCard:  {
    title: "eait je od {age} let",
    body: "Způsob, jakým aplikace nastavuje kalorické cíle, není určen pro tělo, které ještě roste.",
  },
  underAge:  {
    ask: "Promiň — tady musím skončit. Pokud jde o překlep, prostě pošli svůj skutečný věk.",
    confirm: "To je můj skutečný věk",
    placeholder: "Tvůj věk",
    stopped: [
      "Tak tady končíme. Mažu všechny tvoje odpovědi.",
      "Vrať se, až ti bude {age}, budu tu.",
    ],
    endedPlaceholder: "eait je od {age} let",
  },
  belowHealthy:  {
    title: "Tohle jako cíl nastavit nemůžu",
    body: "Nejnižší zdravá váha pro tvou výšku je asi {kg} kg. Cíl pod ni nenastavíme. Pokud s lékařem řešíš něco jiného, řiď se jím, ne touto aplikací.",
  },
  invalid:  {
    age: "To nevypadá jako věk — zkus něco jako 34.",
    height_cm: "V centimetrech — třeba 175.",
    weight_kg: "V kilogramech — stačí zhruba.",
    target_weight_kg: "Číslo v kg — třeba 70.",
  },
  ambiguousAge:  {
    line: "Pro jistotu: pokud myslíš rok {year}, pošli všechny čtyři číslice.",
    confirm: "Je mi {age}",
  },
  direction:  {
    gain: "Máš {weight} kg a chceš přibrat na {target} — to odsud není přírůstek. Pokud se cíl změnil, můžeme ho přepnout; jinak mi dej číslo nad {weight}.",
    lose: "Máš {weight} kg a chceš zhubnout na {target} — to odsud není úbytek. Pokud se cíl změnil, můžeme ho přepnout; jinak mi dej číslo pod {weight}.",
    switchToLose: "Přepnout na hubnutí",
    switchToGain: "Přepnout na přibírání",
    above: "Číslo nad {weight}…",
    below: "Číslo pod {weight}…",
  },
  switched:  {
    gain: "Přepnuto — tak přibíráme. Kam se chceš dostat, v kg?",
    lose: "Přepnuto — tak hubneme. Kam se chceš dostat, v kg? Rychleji tu neznamená líp — jen se to hůř udrží.",
  },
  capNoteTail:  " To je asi {kg} kg týdně.",
  goalEdit:  {
    cleared: "Tvoje cílová váha už k tomuto cíli neseděla, takže je smazaná — nastav novou.",
    worthSetting: "Zapsáno. Tvoje cílová váha ale už k cíli nesedí — vyplatí se nastavit novou.",
  },
  target: {
    // "55 · lowest we set" under the range's floor, "74 · now" beside today, "− 6kg" the
    // answer's distance from it.
    lowest: "{weight} · nejnižší, co nastavíme",
    now: "{weight} · teď",
    nowLowest: "{weight} · teď · nejnižší, co nastavíme",
    deltaDown: "− {weight}",
    deltaUp: "+ {weight}",
  },
  pace: {
    rate: "{rate} týdně",
    rateSuffix: "týdně",
    result: "{target} · odhad: {month} · {kcal} kcal denně",
    capMarker: "omezeno na bezpečnou mez",
    floorMarker: "nikdy pod {floor} · při každém tempu",
    echo: "Z {from} na {to}.",
  },
  how: {
    title: "Jak eait funguje",
    meal: "Losos, rýže, zelenina",
    photoAlt: "Miska s obilovinami v hledáčku",
    steps: ["Vyfoť talíř", "Získej poctivá makra", "Sleduj svůj pokrok"],
  },
  units: { years: "let", yearsCount: { one: "{n} rok", other: "{n} let" } },
  twice: {
    title: "Zhubni dvakrát víc",
    sub: "Lidé, kteří si zapisují, co jedí, zhubnou dvakrát víc",
    without: "Bez zapisování",
    with: "S eait",
    source: "Hollis et al., Am J Prev Med, 2008",
    alt: "Bez zapisování: 1×; s eait: 2×",
  },
  baseline: {
    title: "Tady je tvůj výchozí bod",
    bmi: "Index tělesné hmotnosti (BMI)",
    bands: { under: "PODVÁHA", healthy: "ZDRAVÁ VÁHA", over: "NADVÁHA", obese: "OBEZITA" },
    verdict: { under: "Tvoje BMI je pod zdravým rozmezím", healthy: "Tvoje BMI je ve zdravém rozmezí", above: "Tvoje BMI je nad zdravým rozmezím" },
    note: "Tvůj plán s tím počítá.",
    you: "Ty",
    body: "Výška · váha",
    activity: "Aktivita",
  },
  possible: { lose: "O {delta} méně? Reálné a možné!", gain: "O {delta} více? Reálné a možné!" },
  ageWhy: "S věkem se mění metabolismus, a tak s tím počítáme",
  ontrack: {
    title: "Navrženo tak, aby ti to vydrželo",
    captions: {
      consistency: "Vynechaný den nic nestojí. Další začíná od nuly.",
      habits: "Nic není zakázané. Každý talíř dostane poctivá makra.",
      support: "Zeptej se {coach} na cokoli, kdykoli, v chatu.",
      busy: "Jedna fotka je celý záznam.",
      ideas: "Nevíš, co k večeři? Zeptej se {coach}, co se vejde do toho, co zbývá.",
    },
  },
  chart: {
    byEait: "s eait",
    weightTrend: "Vývoj váhy",
    without: "Bez",
    now: "Teď",
    later: "Později",
    twoWays: "Váha v čase, dvěma způsoby: s plánem a bez něj",
    estimatedProgress: "Odhadovaný pokrok",
    estimate: "Odhad",
    target: "Cíl {weight}",
        monthEstimate: "{month} · odhad",
    estimateAria: "Odhadovaná váha: teď {from}, odhad na {month}: {to}",
  },
  plan: {
    goalLose: "Cíl: −{delta} · orientačně {month}",
    goalGain: "Cíl: +{delta} · orientačně {month}",
    goalMaintain: "Cíl: udržet váhu",
    rest: "Tvoje tělo v klidu spálí", activity: "S tvou aktivitou zhruba", pace: "Pro tvoje tempo upravujeme", floor: "Minimum, pod které nejdeme", protein: "Cílové bílkoviny",
  },
  health: {
    title: "Synchronizovat s aplikací Zdraví",
    body: "Váha a aktivita se načtou sem. Tvoje jídla jdou do aplikace Zdraví.",
  },
  targetSuggestion:  {
    down: "Navrhuji {weight}, zhruba o {pct} % méně, dobrý první cíl",
    up: "Navrhuji {weight}, zhruba o {pct} % více, dobrý první cíl",
  },
  firstMeal:  FIRST_MEAL_COPY.cs!,
  stepper:  { continue: "Pokračovat", less: "Méně", more: "Více" },
  offerHeadline:  "Cíl: {kg} kg · orientačně {month}",
  planGoal: { metric: "Cíl: −{n} kg · orientačně {month}", imperial: "Cíl: −{n} lb · orientačně {month}" },
};

const HI: ChatCopy = {
  idlePlaceholder:  "Spud को मैसेज करें…",
  continueLabel: "जारी रखें",
  saveKept: "यह सेव नहीं हो सका। आपका जवाब अभी भी यहीं है। जारी रखें दबाने पर यह फिर से भेजा जाएगा।",
  underAgeCard:  {
    title: "eait {age} साल और उससे ज़्यादा उम्र के लिए है",
    body: "यह ऐप जिस तरह कैलोरी लक्ष्य तय करता है, वह बढ़ते हुए शरीर के लिए नहीं बना है।",
  },
  underAge:  {
    ask: "माफ़ कीजिए — यहीं रुकना होगा। अगर टाइपिंग की गलती से ऐसा हुआ है, तो बस अपनी असली उम्र भेजें।",
    confirm: "यही मेरी असली उम्र है",
    placeholder: "आपकी उम्र",
    stopped: [
      "तो हम यहीं रुकते हैं। आपकी बताई हर बात डिलीट की जा रही है।",
      "{age} की उम्र में वापस आइए, मैं यहीं हूँ।",
    ],
    endedPlaceholder: "eait {age} साल और उससे ज़्यादा उम्र के लिए है",
  },
  belowHealthy:  {
    title: "इसे लक्ष्य नहीं बनाया जा सकता",
    body: "आपकी लंबाई के हिसाब से सबसे कम स्वस्थ वज़न लगभग {kg} kg है। हम इससे कम लक्ष्य नहीं रखते। अगर किसी डॉक्टर के साथ कुछ और तय हुआ है, तो इस ऐप की जगह उनकी सलाह मानें।",
  },
  invalid:  {
    age: "यह उम्र जैसा नहीं लग रहा — कुछ ऐसा लिखें, जैसे 34।",
    height_cm: "सेंटीमीटर में — जैसे 175।",
    weight_kg: "किलोग्राम में — अंदाज़े से भी चलेगा।",
    target_weight_kg: "kg में एक संख्या — जैसे 70।",
  },
  ambiguousAge:  {
    line: "बस पक्का कर लें: अगर आपका मतलब साल {year} से था, तो चारों अंक भेजें।",
    confirm: "मेरी उम्र {age} है",
  },
  direction:  {
    gain: "अभी आपका वज़न {weight} kg है और लक्ष्य {target} — यहाँ से यह बढ़त नहीं है। अगर लक्ष्य बदल गया है, तो हम उसे बदल सकते हैं; वरना {weight} से ज़्यादा कोई संख्या दें।",
    lose: "अभी आपका वज़न {weight} kg है और लक्ष्य {target} — यहाँ से यह कमी नहीं है। अगर लक्ष्य बदल गया है, तो हम उसे बदल सकते हैं; वरना {weight} से कम कोई संख्या दें।",
    switchToLose: "वज़न घटाने पर स्विच करें",
    switchToGain: "वज़न बढ़ाने पर स्विच करें",
    above: "{weight} से ज़्यादा कोई संख्या…",
    below: "{weight} से कम कोई संख्या…",
  },
  switched:  {
    gain: "बदल दिया — तो वज़न बढ़ाना है। लक्ष्य कितना रखें, kg में?",
    lose: "बदल दिया — तो वज़न घटाना है। लक्ष्य कितना रखें, kg में? यहाँ तेज़ होना बेहतर नहीं — बस उसे बनाए रखना मुश्किल होता है।",
  },
  capNoteTail:  " यह लगभग {kg} kg प्रति हफ़्ता है।",
  goalEdit:  {
    cleared: "आपका लक्ष्य वज़न अब उस लक्ष्य से मेल नहीं खाता था, इसलिए उसे हटा दिया गया — नया सेट करें।",
    worthSetting: "नोट कर लिया। हालाँकि आपका लक्ष्य वज़न अब आपके लक्ष्य से मेल नहीं खाता — नया सेट करना अच्छा रहेगा।",
  },
  target: {
    // "55 · lowest we set" under the range's floor, "74 · now" beside today, "− 6kg" the
    // answer's distance from it.
    lowest: "{weight} · हमारा न्यूनतम",
    now: "{weight} · अभी",
    nowLowest: "{weight} · अभी · हमारा न्यूनतम",
    deltaDown: "− {weight}",
    deltaUp: "+ {weight}",
  },
  pace: {
    rate: "{rate} प्रति हफ़्ता",
    rateSuffix: "प्रति हफ़्ता",
    result: "{month} के आसपास {target} · {kcal} kcal प्रति दिन",
    capMarker: "सुरक्षित सीमा पर रोका गया",
    floorMarker: "{floor} से कभी कम नहीं · हर रफ़्तार यहीं आती है",
    echo: "{from} से {to} तक।",
  },
  how: {
    title: "eait कैसे काम करता है",
    meal: "सैल्मन, चावल, हरी सब्ज़ियाँ",
    photoAlt: "व्यूफ़ाइंडर में अनाज का बाउल",
    steps: ["प्लेट की फ़ोटो लें", "ईमानदार मैक्रो पाएँ", "अपनी प्रगति देखें"],
  },
  units: { years: "साल", yearsCount: { one: "{n} साल", other: "{n} साल" } },
  twice: {
    title: "दोगुना वज़न घटाएँ",
    sub: "जो लोग अपना खाना दर्ज करते हैं, उनका वज़न दोगुना घटता है",
    without: "बिना दर्ज किए",
    with: "eait के साथ",
    source: "Hollis et al., Am J Prev Med, 2008",
    alt: "बिना दर्ज किए: 1×; eait के साथ: 2×",
  },
  baseline: {
    title: "यह रहा आपका शुरुआती आधार",
    bmi: "बॉडी मास इंडेक्स (BMI)",
    bands: { under: "कम वज़न", healthy: "स्वस्थ", over: "ज़्यादा वज़न", obese: "मोटापा" },
    verdict: { under: "आपका BMI स्वस्थ दायरे से कम है", healthy: "आपका BMI स्वस्थ दायरे में है", above: "आपका BMI स्वस्थ दायरे से ज़्यादा है" },
    note: "आपका प्लान इसे ध्यान में रखता है।",
    you: "आप",
    body: "लंबाई · वज़न",
    activity: "गतिविधि",
  },
  possible: { lose: "{delta} कम? व्यावहारिक है, और मुमकिन भी!", gain: "{delta} ज़्यादा? व्यावहारिक है, और मुमकिन भी!" },
  ageWhy: "उम्र के साथ आपका मेटाबॉलिज़्म बदलता है, इसलिए हम इसे ध्यान में रखते हैं",
  ontrack: {
    title: "आपको सही राह पर रखने के लिए बना",
    captions: {
      consistency: "एक दिन छूटने से कुछ नहीं बिगड़ता। अगला दिन शून्य से शुरू होता है।",
      habits: "कुछ भी मना नहीं है। हर प्लेट को ईमानदार मैक्रो मिलते हैं।",
      support: "चैट में {coach} से कुछ भी, कभी भी पूछें।",
      busy: "दर्ज करने के लिए बस एक फ़ोटो।",
      ideas: "रात के खाने का आइडिया नहीं? {coach} से पूछें कि बाकी में क्या फ़िट होगा।",
    },
  },
  chart: {
    byEait: "eait के साथ",
    weightTrend: "वज़न का रुझान",
    without: "बिना",
    now: "अभी",
    later: "बाद में",
    twoWays: "समय के साथ वज़न, दो तरह से: प्लान के साथ और बिना",
    estimatedProgress: "अनुमानित प्रगति",
    estimate: "अनुमान",
    target: "लक्ष्य {weight}",
        monthEstimate: "{month} · अनुमान",
    estimateAria: "अनुमानित वज़न: अभी {from}, {month} के आसपास {to}",
  },
  plan: {
    goalLose: "लक्ष्य: −{delta} · {month} तक",
    goalGain: "लक्ष्य: +{delta} · {month} तक",
    goalMaintain: "लक्ष्य: वज़न बनाए रखना",
    rest: "आराम की स्थिति में आपका शरीर खर्च करता है", activity: "आपकी गतिविधि के साथ, लगभग", pace: "आपकी रफ़्तार के हिसाब से समायोजन", floor: "न्यूनतम सीमा, जिसके नीचे हम नहीं जाते", protein: "प्रोटीन का लक्ष्य",
  },
  health: {
    title: "स्वास्थ्य के साथ सिंक करें",
    body: "वज़न और गतिविधि यहाँ आते हैं। आपके भोजन स्वास्थ्य में जाते हैं।",
  },
  targetSuggestion:  {
    down: "मेरा सुझाव है {weight}, लगभग {pct}% कम, एक अच्छा पहला लक्ष्य",
    up: "मेरा सुझाव है {weight}, लगभग {pct}% ज़्यादा, एक अच्छा पहला लक्ष्य",
  },
  firstMeal:  FIRST_MEAL_COPY.hi!,
  stepper:  { continue: "जारी रखें", less: "कम", more: "ज़्यादा" },
  offerHeadline:  "{month} तक {kg} kg तक पहुँचें",
  planGoal: { metric: "लक्ष्य: −{n} kg · {month} तक", imperial: "लक्ष्य: −{n} lb · {month} तक" },
};

const TH: ChatCopy = {
  idlePlaceholder:  "ส่งข้อความถึง Spud…",
  continueLabel: "ต่อไป",
  saveKept: "บันทึกไม่สำเร็จ คำตอบของคุณยังอยู่ แตะ ต่อไป เพื่อส่งอีกครั้ง",
  underAgeCard:  {
    title: "eait สำหรับผู้ที่อายุ {age} ปีขึ้นไป",
    body: "วิธีที่แอปนี้ตั้งเป้าแคลอรีไม่ได้ออกแบบมาสำหรับร่างกายที่ยังเติบโตอยู่",
  },
  underAge:  {
    ask: "ขอโทษนะ — เราต้องหยุดตรงนี้ ถ้าพิมพ์ผิด ก็ส่งอายุจริงมาได้เลย",
    confirm: "นี่คืออายุจริงของฉัน",
    placeholder: "อายุของคุณ",
    stopped: [
      "งั้นเราหยุดกันตรงนี้ เรากำลังลบทุกอย่างที่คุณบอกมา",
      "กลับมาตอนอายุ {age} นะ เรายังอยู่ตรงนี้",
    ],
    endedPlaceholder: "eait สำหรับผู้ที่อายุ {age} ปีขึ้นไป",
  },
  belowHealthy:  {
    title: "เราตั้งค่านั้นเป็นเป้าไม่ได้",
    body: "น้ำหนักต่ำสุดที่ยังดีต่อสุขภาพสำหรับส่วนสูงของคุณคือประมาณ {kg} กก. เราจะไม่ตั้งเป้าหมายต่ำกว่านี้ ถ้าคุณกำลังดูแลกับแพทย์ในแนวทางอื่น ให้ทำตามแพทย์แทนแอปนี้",
  },
  invalid:  {
    age: "ดูไม่เหมือนอายุนะ — ลองแบบ 34",
    height_cm: "เป็นเซนติเมตร — ประมาณ 175",
    weight_kg: "เป็นกิโลกรัม — ประมาณๆ ก็ได้",
    target_weight_kg: "ตัวเลขเป็น กก. — เช่น 70",
  },
  ambiguousAge:  {
    line: "ขอเช็กว่าเราอ่านถูก — ถ้าหมายถึงปี {year} ส่งมาให้ครบสี่หลัก",
    confirm: "อายุ {age}",
  },
  direction:  {
    gain: "ตอนนี้คุณหนัก {weight} กก. และขอเพิ่มเป็น {target} — จากตรงนี้นั่นไม่ใช่การเพิ่ม ถ้าเป้าหมายเปลี่ยนแล้ว เราสลับให้ได้ ไม่งั้นบอกตัวเลขที่มากกว่า {weight}",
    lose: "ตอนนี้คุณหนัก {weight} กก. และขอลดเป็น {target} — จากตรงนี้นั่นไม่ใช่การลด ถ้าเป้าหมายเปลี่ยนแล้ว เราสลับให้ได้ ไม่งั้นบอกตัวเลขที่น้อยกว่า {weight}",
    switchToLose: "สลับเป็นลดน้ำหนัก",
    switchToGain: "สลับเป็นเพิ่มน้ำหนัก",
    above: "ตัวเลขที่มากกว่า {weight}…",
    below: "ตัวเลขที่น้อยกว่า {weight}…",
  },
  switched:  {
    gain: "สลับแล้ว — เพิ่มน้ำหนักนะ อยากไปถึงกี่ กก.?",
    lose: "สลับแล้ว — ลดน้ำหนักนะ อยากไปถึงกี่ กก.? เร็วกว่าไม่ได้ดีกว่า — แค่รักษาไว้ยากกว่า",
  },
  capNoteTail:  " ประมาณ {kg} กก. ต่อสัปดาห์",
  goalEdit:  {
    cleared: "น้ำหนักเป้าหมายของคุณไม่เข้ากับเป้าหมายนั้นแล้ว เราจึงล้างออก — ตั้งใหม่ได้เลย",
    worthSetting: "บันทึกแล้ว แต่น้ำหนักเป้าหมายของคุณไม่เข้ากับเป้าหมายแล้ว — ควรตั้งใหม่",
  },
  target: {
    // "55 · lowest we set" under the range's floor, "74 · now" beside today, "− 6kg" the
    // answer's distance from it.
    lowest: "{weight} · ต่ำสุดที่เราตั้งให้",
    now: "{weight} · ตอนนี้",
    nowLowest: "{weight} · ตอนนี้ · ต่ำสุดที่เราตั้งให้",
    deltaDown: "− {weight}",
    deltaUp: "+ {weight}",
  },
  pace: {
    rate: "{rate} ต่อสัปดาห์",
    rateSuffix: "ต่อสัปดาห์",
    result: "{target} ราว{month} · {kcal} kcal ต่อวัน",
    capMarker: "จำกัดไว้ที่ระดับปลอดภัย",
    floorMarker: "ไม่ต่ำกว่า {floor} · ทุกความเร็วจบที่นี่",
    echo: "จาก {from} เป็น {to}",
  },
  how: {
    title: "eait ทำงานอย่างไร",
    meal: "แซลมอน ข้าว ผักใบเขียว",
    photoAlt: "ชามธัญพืชในช่องมองภาพ",
    steps: ["ถ่ายรูปจาน", "ได้มาโครที่ตรงไปตรงมา", "ดูความคืบหน้าของคุณ"],
  },
  units: { years: "ปี", yearsCount: { one: "{n} ปี", other: "{n} ปี" } },
  twice: {
    title: "ลดน้ำหนักได้มากเป็นสองเท่า",
    sub: "คนที่จดสิ่งที่กินลดน้ำหนักได้มากเป็นสองเท่า",
    without: "ไม่จด",
    with: "ใช้ eait",
    source: "Hollis et al., Am J Prev Med, 2008",
    alt: "ไม่จด: 1×; ใช้ eait: 2×",
  },
  baseline: {
    title: "นี่คือจุดเริ่มต้นของคุณ",
    bmi: "ดัชนีมวลกาย (BMI)",
    bands: { under: "น้ำหนักน้อย", healthy: "สมส่วน", over: "น้ำหนักเกิน", obese: "อ้วน" },
    verdict: { under: "BMI ของคุณต่ำกว่าช่วงที่ดีต่อสุขภาพ", healthy: "BMI ของคุณอยู่ในช่วงที่ดีต่อสุขภาพ", above: "BMI ของคุณสูงกว่าช่วงที่ดีต่อสุขภาพ" },
    note: "แผนของคุณคำนึงถึงเรื่องนี้แล้ว",
    you: "คุณ",
    body: "ส่วนสูง · น้ำหนัก",
    activity: "กิจกรรม",
  },
  possible: { lose: "น้อยลง {delta}? สมจริงและเป็นไปได้!", gain: "มากขึ้น {delta}? สมจริงและเป็นไปได้!" },
  ageWhy: "การเผาผลาญเปลี่ยนไปตามอายุ เราจึงนำมาคำนวณด้วย",
  ontrack: {
    title: "สร้างมาเพื่อให้คุณไปต่อได้",
    captions: {
      consistency: "พลาดไปวันหนึ่งก็ไม่เสียอะไร วันถัดไปเริ่มจากศูนย์",
      habits: "ไม่มีอะไรต้องห้าม ทุกจานได้มาโครที่ตรงไปตรงมา",
      support: "ถาม {coach} ได้ทุกเรื่อง ทุกเวลา ในแชท",
      busy: "รูปเดียวคือการจดทั้งหมด",
      ideas: "คิดไม่ออกว่าเย็นนี้กินอะไร? ถาม {coach} ว่าอะไรเข้ากับที่เหลือ",
    },
  },
  chart: {
    byEait: "ใช้ eait",
    weightTrend: "แนวโน้มน้ำหนัก",
    without: "ไม่ใช้",
    now: "ตอนนี้",
    later: "ภายหลัง",
    twoWays: "น้ำหนักตามเวลา วาดสองแบบ: มีแผนและไม่มีแผน",
    estimatedProgress: "ความคืบหน้าโดยประมาณ",
    estimate: "ประมาณการ",
    target: "เป้า {weight}",
        monthEstimate: "{month} · ประมาณการ",
    estimateAria: "น้ำหนักโดยประมาณ: ตอนนี้ {from} ราว{month} {to}",
  },
  plan: {
    goalLose: "เป้าหมาย: ลด {delta} ภายใน{month}",
    goalGain: "เป้าหมาย: เพิ่ม {delta} ภายใน{month}",
    goalMaintain: "เป้าหมาย: รักษาน้ำหนัก",
    rest: "ร่างกายขณะพักเผาผลาญ", activity: "รวมกิจกรรมของคุณ ประมาณ", pace: "สำหรับความเร็วของคุณ เราปรับ", floor: "ขั้นต่ำที่เราจะไม่ต่ำกว่า", protein: "โปรตีนที่ควรได้",
  },
  health: {
    title: "ซิงค์กับแอปสุขภาพ",
    body: "น้ำหนักและกิจกรรมเข้ามา มื้ออาหารของคุณส่งไปที่แอปสุขภาพ",
  },
  targetSuggestion:  {
    down: "เราแนะนำ {weight} น้อยลงประมาณ {pct}% เป็นเป้าหมายแรกที่ดี",
    up: "เราแนะนำ {weight} มากขึ้นประมาณ {pct}% เป็นเป้าหมายแรกที่ดี",
  },
  firstMeal:  FIRST_MEAL_COPY.th!,
  stepper:  { continue: "ต่อไป", less: "น้อยลง", more: "มากขึ้น" },
  offerHeadline:  "ไปถึง {kg} กก. ภายใน{month}",
  planGoal: { metric: "เป้าหมาย: ลด {n} กก. ภายใน{month}", imperial: "เป้าหมาย: ลด {n} ปอนด์ ภายใน{month}" },
};

const SV: ChatCopy = {
  idlePlaceholder:  "Skriv till Spud…",
  continueLabel: "Fortsätt",
  saveKept: "Kunde inte spara det. Ditt svar finns kvar. Fortsätt skickar det igen.",
  underAgeCard:  {
    title: "eait är för {age} år och uppåt",
    body: "Sättet appen sätter kalorimål på är inte gjort för en kropp som fortfarande växer.",
  },
  underAge:  {
    ask: "Förlåt — jag måste stanna här. Om det blev ett skrivfel, skicka bara din riktiga ålder.",
    confirm: "Det är min riktiga ålder",
    placeholder: "Din ålder",
    stopped: [
      "Då slutar vi här. Jag raderar allt du har berättat.",
      "Kom tillbaka när du är {age}, så finns jag här.",
    ],
    endedPlaceholder: "eait är för {age} år och uppåt",
  },
  belowHealthy:  {
    title: "Det kan jag inte sätta som mål",
    body: "Den lägsta hälsosamma vikten för din längd är cirka {kg} kg. Vi sätter inget mål under den. Om du jobbar med en läkare mot något annat, följ läkarens råd hellre än den här appen.",
  },
  invalid:  {
    age: "Det ser inte ut som en ålder — testa något i stil med 34.",
    height_cm: "I centimeter — något i stil med 175.",
    weight_kg: "I kilo — ungefär räcker.",
    target_weight_kg: "Ett tal i kg — till exempel 70.",
  },
  ambiguousAge:  {
    line: "Vill vara säker på att jag läste rätt — om du menade året {year}, skicka alla fyra siffrorna.",
    confirm: "Jag är {age}",
  },
  direction:  {
    gain: "Du väger {weight} kg och vill gå upp till {target} — det är ingen uppgång härifrån. Om målet har ändrats kan vi byta; annars ge mig ett tal över {weight}.",
    lose: "Du väger {weight} kg och vill gå ner till {target} — det är ingen nedgång härifrån. Om målet har ändrats kan vi byta; annars ge mig ett tal under {weight}.",
    switchToLose: "Byt till att gå ner",
    switchToGain: "Byt till att gå upp",
    above: "Ett tal över {weight}…",
    below: "Ett tal under {weight}…",
  },
  switched:  {
    gain: "Bytt — då går vi upp. Var vill du landa, i kg?",
    lose: "Bytt — då går vi ner. Var vill du landa, i kg? Snabbare är inte bättre här — bara svårare att hålla.",
  },
  capNoteTail:  " Det är cirka {kg} kg i veckan.",
  goalEdit:  {
    cleared: "Din målvikt passade inte längre med det målet, så den är borttagen — sätt en ny.",
    worthSetting: "Noterat. Din målvikt passar dock inte längre med ditt mål — sätt gärna en ny.",
  },
  target: {
    // "55 · lowest we set" under the range's floor, "74 · now" beside today, "− 6kg" the
    // answer's distance from it.
    lowest: "{weight} · lägsta vi sätter",
    now: "{weight} · nu",
    nowLowest: "{weight} · nu · lägsta vi sätter",
    deltaDown: "− {weight}",
    deltaUp: "+ {weight}",
  },
  pace: {
    rate: "{rate} i veckan",
    rateSuffix: "i veckan",
    result: "{target} runt {month} · {kcal} kcal per dag",
    capMarker: "begränsat till den säkra gränsen",
    floorMarker: "aldrig under {floor} · varje tempo landar här",
    echo: "Från {from} till {to}.",
  },
  how: {
    title: "Så funkar eait",
    meal: "Lax, ris, grönt",
    photoAlt: "En bowl med fullkorn i sökaren",
    steps: ["Fota tallriken", "Få ärliga makron", "Se dina framsteg"],
  },
  units: { years: "år", yearsCount: { one: "{n} år", other: "{n} år" } },
  twice: {
    title: "Gå ner dubbelt så mycket i vikt",
    sub: "Den som skriver ner vad hen äter går ner dubbelt så mycket i vikt",
    without: "Utan loggning",
    with: "Med eait",
    source: "Hollis et al., Am J Prev Med, 2008",
    alt: "Utan loggning: 1×; med eait: 2×",
  },
  baseline: {
    title: "Här är din utgångspunkt",
    bmi: "Kroppsmasseindex (BMI)",
    bands: { under: "UNDERVIKT", healthy: "NORMALVIKT", over: "ÖVERVIKT", obese: "FETMA" },
    verdict: { under: "Ditt BMI är under det hälsosamma intervallet", healthy: "Ditt BMI är inom det hälsosamma intervallet", above: "Ditt BMI är över det hälsosamma intervallet" },
    note: "Din plan tar hänsyn till det.",
    you: "Du",
    body: "Längd · vikt",
    activity: "Aktivitet",
  },
  possible: { lose: "{delta} mindre? Realistiskt och möjligt!", gain: "{delta} mer? Realistiskt och möjligt!" },
  ageWhy: "Ämnesomsättningen förändras med åldern, så vi räknar med det",
  ontrack: {
    title: "Byggt för att hjälpa dig hålla kursen",
    captions: {
      consistency: "En missad dag kostar ingenting. Nästa börjar på noll.",
      habits: "Inget är förbjudet. Varje tallrik får ärliga makron.",
      support: "Fråga {coach} vad som helst, när som helst, i chatten.",
      busy: "Ett foto är hela loggningen.",
      ideas: "Ingen idé till middag? Fråga {coach} vad som ryms i det som är kvar.",
    },
  },
  chart: {
    byEait: "med eait",
    weightTrend: "Viktkurva",
    without: "Utan",
    now: "Nu",
    later: "Senare",
    twoWays: "Vikt över tid, ritad på två sätt: med plan och utan",
    estimatedProgress: "Uppskattade framsteg",
    estimate: "Uppskattning",
    target: "Mål {weight}",
        monthEstimate: "{month} · uppskattning",
    estimateAria: "Uppskattad vikt: {from} nu, {to} runt {month}",
  },
  plan: {
    goalLose: "Mål: −{delta} till {month}",
    goalGain: "Mål: +{delta} till {month}",
    goalMaintain: "Mål: hålla min vikt",
    rest: "Din kropp förbränner i vila", activity: "Med din aktivitet, cirka", pace: "För ditt tempo justerar vi", floor: "Gränsen vi aldrig går under", protein: "Protein att sikta på",
  },
  health: {
    title: "Synka med Hälsa",
    body: "Vikt och aktivitet kommer in. Dina måltider går till Hälsa.",
  },
  targetSuggestion:  {
    down: "Jag föreslår {weight}, cirka {pct} % ner, ett bra första mål",
    up: "Jag föreslår {weight}, cirka {pct} % upp, ett bra första mål",
  },
  firstMeal:  FIRST_MEAL_COPY.sv!,
  stepper:  { continue: "Fortsätt", less: "Mindre", more: "Mer" },
  offerHeadline:  "Nå {kg} kg till {month}",
  planGoal: { metric: "Mål: −{n} kg till {month}", imperial: "Mål: −{n} lb till {month}" },
};

const UK: ChatCopy = {
  idlePlaceholder:  "Написати Spud…",
  continueLabel: "Продовжити",
  saveKept: "Не вдалося зберегти. Твоя відповідь усе ще тут. «Продовжити» надішле її знову.",
  underAgeCard:  {
    title: "eait — від {age} років",
    body: "Те, як ця програма ставить цілі за калоріями, не розраховане на тіло, яке ще росте.",
  },
  underAge:  {
    ask: "Вибач — тут мені доведеться зупинитися. Якщо це одрук, просто надішли свій справжній вік.",
    confirm: "Це мій справжній вік",
    placeholder: "Твій вік",
    stopped: [
      "Тоді на цьому зупинимося. Я видаляю всі твої відповіді.",
      "Повертайся, коли тобі буде {age}, — я буду тут.",
    ],
    endedPlaceholder: "eait — від {age} років",
  },
  belowHealthy:  {
    title: "Не можу поставити це як мету",
    body: "Найнижча здорова вага для твого зросту — близько {kg} кг. Нижче ми мету не ставимо. Якщо ти працюєш над чимось іншим із лікарем, дослухайся до лікаря, а не до цієї програми.",
  },
  invalid:  {
    age: "Не схоже на вік — спробуй щось на кшталт 34.",
    height_cm: "У сантиметрах — щось на кшталт 175.",
    weight_kg: "У кілограмах — можна приблизно.",
    target_weight_kg: "Число в кг — наприклад, 70.",
  },
  ambiguousAge:  {
    line: "Хочу переконатися, що все правильно: якщо йдеться про {year} рік, надішли всі чотири цифри.",
    confirm: "Мені {age}",
  },
  direction:  {
    gain: "Зараз у тебе {weight} кг, а мета — {target}: це не набір ваги. Якщо мета змінилася, можемо перемкнути; інакше дай число більше за {weight}.",
    lose: "Зараз у тебе {weight} кг, а мета — {target}: це не зниження ваги. Якщо мета змінилася, можемо перемкнути; інакше дай число менше за {weight}.",
    switchToLose: "Перемкнути на схуднення",
    switchToGain: "Перемкнути на набір",
    above: "Число більше за {weight}…",
    below: "Число менше за {weight}…",
  },
  switched:  {
    gain: "Перемкнуто — отже, набираємо. До якої ваги хочеш прийти, у кг?",
    lose: "Перемкнуто — отже, худнемо. До якої ваги хочеш прийти, у кг? Швидше тут не означає краще — просто важче втримати.",
  },
  capNoteTail:  " Це приблизно {kg} кг на тиждень.",
  goalEdit:  {
    cleared: "Твоя цільова вага більше не відповідала цій меті, тож її скинуто — постав нову.",
    worthSetting: "Записано. Щоправда, цільова вага більше не відповідає твоїй меті — варто поставити нову.",
  },
  target: {
    // "55 · lowest we set" under the range's floor, "74 · now" beside today, "− 6kg" the
    // answer's distance from it.
    lowest: "{weight} · мінімум, який ми ставимо",
    now: "{weight} · зараз",
    nowLowest: "{weight} · зараз · мінімум, який ми ставимо",
    deltaDown: "− {weight}",
    deltaUp: "+ {weight}",
  },
  pace: {
    rate: "{rate} на тиждень",
    rateSuffix: "на тиждень",
    result: "{target} · орієнтир — {month} · {kcal} ккал на день",
    capMarker: "обмежено безпечною межею",
    floorMarker: "ніколи не нижче {floor} · за будь-якого темпу",
    echo: "З {from} до {to}.",
  },
  how: {
    title: "Як працює eait",
    meal: "Лосось, рис, зелень",
    photoAlt: "Боул зі злаками у видошукачі",
    steps: ["Сфотографуй тарілку", "Отримай чесні макроси", "Стеж за прогресом"],
  },
  units: { years: "років", yearsCount: { one: "{n} рік", other: "{n} р." } },
  twice: {
    title: "Скидай удвічі більше ваги",
    sub: "Ті, хто записує, що їсть, скидають удвічі більше ваги",
    without: "Без записів",
    with: "З eait",
    source: "Hollis et al., Am J Prev Med, 2008",
    alt: "Без записів: 1×; з eait: 2×",
  },
  baseline: {
    title: "Ось твоя точка відліку",
    bmi: "Індекс маси тіла (ІМТ)",
    bands: { under: "НЕДОСТАТНЯ ВАГА", healthy: "НОРМА", over: "НАДМІРНА ВАГА", obese: "ОЖИРІННЯ" },
    verdict: { under: "Твій ІМТ нижчий за здоровий діапазон", healthy: "Твій ІМТ у здоровому діапазоні", above: "Твій ІМТ вищий за здоровий діапазон" },
    note: "Твій план це враховує.",
    you: "Ти",
    body: "Зріст · вага",
    activity: "Активність",
  },
  possible: { lose: "На {delta} менше? Реально й досяжно!", gain: "На {delta} більше? Реально й досяжно!" },
  ageWhy: "З віком обмін речовин змінюється, тож ми це враховуємо",
  ontrack: {
    title: "Усе, щоб не збитися з курсу",
    captions: {
      consistency: "Пропущений день нічого не коштує. Наступний починається з нуля.",
      habits: "Нічого не заборонено. Кожна тарілка отримує чесні макроси.",
      support: "Питай {coach} про що завгодно й коли завгодно — у чаті.",
      busy: "Одне фото — і запис готовий.",
      ideas: "Немає ідей на вечерю? Спитай {coach}, що вкладеться в залишок.",
    },
  },
  chart: {
    byEait: "з eait",
    weightTrend: "Динаміка ваги",
    without: "Без",
    now: "Зараз",
    later: "Пізніше",
    twoWays: "Вага з часом — з планом і без нього",
    estimatedProgress: "Оцінка прогресу",
    estimate: "Оцінка",
    target: "Ціль {weight}",
        monthEstimate: "{month} · оцінка",
    estimateAria: "Оцінка ваги: {from} зараз, {to} — орієнтовно {month}",
  },
  plan: {
    goalLose: "Мета: −{delta} · орієнтир — {month}",
    goalGain: "Мета: +{delta} · орієнтир — {month}",
    goalMaintain: "Мета: зберегти вагу",
    rest: "У спокої твоє тіло спалює", activity: "З твоєю активністю — близько", pace: "Під твій темп коригуємо", floor: "Межа, нижче якої не йдемо", protein: "Білок — орієнтир",
  },
  health: {
    title: "Синхронізація з Apple Health",
    body: "Вага й активність — зі «Здоров'я», прийоми їжі — у «Здоров'я».",
  },
  targetSuggestion:  {
    down: "Пропоную {weight} — приблизно на {pct}% менше, гарна перша мета",
    up: "Пропоную {weight} — приблизно на {pct}% більше, гарна перша мета",
  },
  firstMeal:  FIRST_MEAL_COPY.uk!,
  stepper:  { continue: "Продовжити", less: "Менше", more: "Більше" },
  offerHeadline:  "Мета: {kg} кг · орієнтир — {month}",
  planGoal: { metric: "Мета: −{n} кг · орієнтир — {month}", imperial: "Мета: −{n} lb · орієнтир — {month}" },
};

const NL: ChatCopy = {
  idlePlaceholder:  "Bericht aan Spud…",
  continueLabel: "Verder",
  saveKept: "Dat kon niet worden opgeslagen. Je antwoord staat er nog. Met Verder stuur je het opnieuw.",
  underAgeCard:  {
    title: "eait is voor {age} jaar en ouder",
    body: "De manier waarop deze app caloriedoelen stelt, is niet bedoeld voor een lichaam dat nog groeit.",
  },
  underAge:  {
    ask: "Sorry — hier moet ik stoppen. Was het een typfout, stuur dan gewoon je echte leeftijd.",
    confirm: "Dat is mijn echte leeftijd",
    placeholder: "Je leeftijd",
    stopped: [
      "Dan stoppen we hier. Ik verwijder alles wat je me hebt verteld.",
      "Kom terug als je {age} bent, dan ben ik er.",
    ],
    endedPlaceholder: "eait is voor {age} jaar en ouder",
  },
  belowHealthy:  {
    title: "Dat kan ik niet als doel instellen",
    body: "Het laagste gezonde gewicht voor je lengte is ongeveer {kg} kg. Lager zetten we geen doel. Werk je met een arts aan iets anders, volg dan je arts en niet deze app.",
  },
  invalid:  {
    age: "Dat lijkt geen leeftijd — probeer iets als 34.",
    height_cm: "In centimeters — iets als 175.",
    weight_kg: "In kilo's — ongeveer is prima.",
    target_weight_kg: "Een getal in kg — bijvoorbeeld 70.",
  },
  ambiguousAge:  {
    line: "Ik wil zeker weten dat ik dat goed lees — bedoelde je het jaar {year}, stuur dan alle vier de cijfers.",
    confirm: "Ik ben {age}",
  },
  direction:  {
    gain: "Je zit op {weight} kg en wilt aankomen tot {target} — dat is vanaf hier geen aankomen. Is het doel veranderd, dan zetten we het om; anders geef me een getal boven {weight}.",
    lose: "Je zit op {weight} kg en wilt afvallen tot {target} — dat is vanaf hier geen afvallen. Is het doel veranderd, dan zetten we het om; anders geef me een getal onder {weight}.",
    switchToLose: "Overschakelen naar afvallen",
    switchToGain: "Overschakelen naar aankomen",
    above: "Een getal boven {weight}…",
    below: "Een getal onder {weight}…",
  },
  switched:  {
    gain: "Omgezet — aankomen dus. Waar wil je uitkomen, in kg?",
    lose: "Omgezet — afvallen dus. Waar wil je uitkomen, in kg? Sneller is hier niet beter — alleen lastiger vol te houden.",
  },
  capNoteTail:  " Dat is ongeveer {kg} kg per week.",
  goalEdit:  {
    cleared: "Je streefgewicht paste niet meer bij dat doel, dus het is gewist — stel een nieuw in.",
    worthSetting: "Genoteerd. Je streefgewicht past alleen niet meer bij je doel — het loont om een nieuw in te stellen.",
  },
  target: {
    // "55 · lowest we set" under the range's floor, "74 · now" beside today, "− 6kg" the
    // answer's distance from it.
    lowest: "{weight} · ons minimum",
    now: "{weight} · nu",
    nowLowest: "{weight} · nu · ons minimum",
    deltaDown: "− {weight}",
    deltaUp: "+ {weight}",
  },
  pace: {
    rate: "{rate} per week",
    rateSuffix: "per week",
    result: "{target} rond {month} · {kcal} kcal per dag",
    capMarker: "begrensd op de veilige limiet",
    floorMarker: "nooit onder {floor} · elk tempo komt hier uit",
    echo: "Van {from} naar {to}.",
  },
  how: {
    title: "Zo werkt eait",
    meal: "Zalm, rijst, groente",
    photoAlt: "Een graanbowl in de zoeker",
    steps: ["Fotografeer je bord", "Krijg eerlijke macro's", "Zie je voortgang"],
  },
  units: { years: "jaar", yearsCount: { one: "{n} jaar", other: "{n} jaar" } },
  twice: {
    title: "Val twee keer zoveel af",
    sub: "Mensen die opschrijven wat ze eten, vallen twee keer zoveel af",
    without: "Zonder loggen",
    with: "Met eait",
    source: "Hollis et al., Am J Prev Med, 2008",
    alt: "Zonder loggen: 1×; met eait: 2×",
  },
  baseline: {
    title: "Dit is je uitgangspunt",
    bmi: "Body Mass Index (BMI)",
    bands: { under: "ONDERGEWICHT", healthy: "GEZOND", over: "OVERGEWICHT", obese: "OBESITAS" },
    verdict: { under: "Je BMI ligt onder het gezonde bereik", healthy: "Je BMI ligt in het gezonde bereik", above: "Je BMI ligt boven het gezonde bereik" },
    note: "Je plan houdt daar rekening mee.",
    you: "Jij",
    body: "Lengte · gewicht",
    activity: "Activiteit",
  },
  possible: { lose: "{delta} minder? Realistisch, en mogelijk!", gain: "{delta} aankomen? Realistisch, en mogelijk!" },
  ageWhy: "Je stofwisseling verandert met de leeftijd, dus daar rekenen we mee",
  ontrack: {
    title: "Gemaakt om je op koers te houden",
    captions: {
      consistency: "Een gemiste dag kost niets. De volgende begint gewoon bij nul.",
      habits: "Niets is verboden. Elk bord krijgt eerlijke macro's.",
      support: "Vraag {coach} alles, wanneer je maar wilt, in Chat.",
      busy: "Eén foto is alles wat je hoeft te loggen.",
      ideas: "Geen idee voor het avondeten? Vraag {coach} wat nog past.",
    },
  },
  chart: {
    byEait: "met eait",
    weightTrend: "Gewichtstrend",
    without: "Zonder",
    now: "Nu",
    later: "Later",
    twoWays: "Gewicht in de tijd, op twee manieren getekend: met een plan en zonder",
    estimatedProgress: "Geschatte voortgang",
    estimate: "Schatting",
    target: "Doel {weight}",
        monthEstimate: "{month} · schatting",
    estimateAria: "Geschat gewicht: nu {from}, rond {month} {to}",
  },
  plan: {
    goalLose: "Doel: {delta} afvallen vóór {month}",
    goalGain: "Doel: {delta} aankomen vóór {month}",
    goalMaintain: "Doel: mijn gewicht houden",
    rest: "In rust verbrandt je lichaam", activity: "Met je activiteit ongeveer", pace: "Voor je tempo passen we aan", floor: "De grens waar we niet onder gaan", protein: "Eiwit om naar te streven",
  },
  health: {
    title: "Synchroniseren met Gezondheid",
    body: "Gewicht en activiteit komen binnen. Je maaltijden gaan naar Gezondheid.",
  },
  targetSuggestion:  {
    down: "Ik stel {weight} voor, zo'n {pct}% eraf, een goed eerste doel",
    up: "Ik stel {weight} voor, zo'n {pct}% erbij, een goed eerste doel",
  },
  firstMeal:  FIRST_MEAL_COPY.nl,
  stepper:  { continue: "Verder", less: "Minder", more: "Meer" },
  offerHeadline:  "Naar {kg} kg vóór {month}",
  planGoal: { metric: "Doel: {n} kg afvallen vóór {month}", imperial: "Doel: {n} lbs afvallen vóór {month}" },
};

const PL: ChatCopy = {
  idlePlaceholder:  "Wiadomość do Spuda…",
  continueLabel: "Dalej",
  saveKept: "Nie udało się tego zapisać. Twoja odpowiedź wciąż tu jest. „Dalej” wyśle ją ponownie.",
  underAgeCard:  {
    title: "eait jest dla osób od {age} lat",
    body: "Sposób, w jaki ta aplikacja ustala cele kaloryczne, nie jest przeznaczony dla ciała, które wciąż rośnie.",
  },
  underAge:  {
    ask: "Przepraszam — muszę się tu zatrzymać. Jeśli to przez literówkę, po prostu wyślij swój prawdziwy wiek.",
    confirm: "To mój prawdziwy wiek",
    placeholder: "Twój wiek",
    stopped: [
      "W takim razie tu kończymy. Usuwam wszystkie twoje odpowiedzi.",
      "Wróć, gdy skończysz {age} lat — będę tu.",
    ],
    endedPlaceholder: "eait jest dla osób od {age} lat",
  },
  belowHealthy:  {
    title: "Nie mogę ustawić tego jako celu",
    body: "Najniższa zdrowa waga dla twojego wzrostu to około {kg} kg. Nie ustawimy celu poniżej niej. Jeśli pracujesz z lekarzem nad czymś innym, kieruj się jego zaleceniami, a nie tą aplikacją.",
  },
  invalid:  {
    age: "To nie wygląda na wiek — spróbuj czegoś w stylu 34.",
    height_cm: "W centymetrach — na przykład 175.",
    weight_kg: "W kilogramach — wystarczy w przybliżeniu.",
    target_weight_kg: "Liczba w kg — na przykład 70.",
  },
  ambiguousAge:  {
    line: "Chcę mieć pewność, że dobrze to odczytuję — jeśli chodziło ci o rok {year}, wyślij wszystkie cztery cyfry.",
    confirm: "Mój wiek: {age}",
  },
  direction:  {
    gain: "Ważysz {weight} kg i chcesz przytyć do {target} — stąd to nie jest przyrost. Jeśli cel się zmienił, możemy go przestawić; jeśli nie, podaj liczbę powyżej {weight}.",
    lose: "Ważysz {weight} kg i chcesz schudnąć do {target} — stąd to nie jest spadek. Jeśli cel się zmienił, możemy go przestawić; jeśli nie, podaj liczbę poniżej {weight}.",
    switchToLose: "Przestaw na chudnięcie",
    switchToGain: "Przestaw na przybieranie",
    above: "Liczba powyżej {weight}…",
    below: "Liczba poniżej {weight}…",
  },
  switched:  {
    gain: "Przestawione — czyli przybieranie. Ile chcesz ważyć, w kg?",
    lose: "Przestawione — czyli chudnięcie. Ile chcesz ważyć, w kg? Szybciej nie znaczy tu lepiej — po prostu trudniej to utrzymać.",
  },
  capNoteTail:  " To około {kg} kg tygodniowo.",
  goalEdit:  {
    cleared: "Twoja waga docelowa nie pasowała już do tego celu, więc ją wyczyszczono — ustaw nową.",
    worthSetting: "Zapisano. Twoja waga docelowa nie pasuje jednak już do celu — warto ustawić nową.",
  },
  target: {
    // "55 · lowest we set" under the range's floor, "74 · now" beside today, "− 6kg" the
    // answer's distance from it.
    lowest: "{weight} · nasze minimum",
    now: "{weight} · teraz",
    nowLowest: "{weight} · teraz · nasze minimum",
    deltaDown: "− {weight}",
    deltaUp: "+ {weight}",
  },
  pace: {
    rate: "{rate} tygodniowo",
    rateSuffix: "tygodniowo",
    result: "{target} — szacunkowo {month} · {kcal} kcal dziennie",
    capMarker: "ograniczone do bezpiecznego limitu",
    floorMarker: "nigdy poniżej {floor} · tu kończy każde tempo",
    echo: "Od {from} do {to}.",
  },
  how: {
    title: "Jak działa eait",
    meal: "Łosoś, ryż, warzywa",
    photoAlt: "Miska z kaszą w kadrze aparatu",
    steps: ["Zrób zdjęcie talerza", "Dostań rzetelne makro", "Śledź swoje postępy"],
  },
  units: { years: "lat", yearsCount: { one: "{n} rok", other: "{n} l." } },
  twice: {
    title: "Schudnij dwa razy więcej",
    sub: "Osoby, które zapisują, co jedzą, chudną dwa razy więcej",
    without: "Bez zapisywania",
    with: "Z eait",
    source: "Hollis et al., Am J Prev Med, 2008",
    alt: "Bez zapisywania: 1×; z eait: 2×",
  },
  baseline: {
    title: "Twój punkt wyjścia",
    bmi: "Wskaźnik masy ciała (BMI)",
    bands: { under: "NIEDOWAGA", healthy: "NORMA", over: "NADWAGA", obese: "OTYŁOŚĆ" },
    verdict: { under: "Twoje BMI jest poniżej zdrowego zakresu", healthy: "Twoje BMI jest w zdrowym zakresie", above: "Twoje BMI jest powyżej zdrowego zakresu" },
    note: "Twój plan to uwzględnia.",
    you: "Ty",
    body: "Wzrost · waga",
    activity: "Aktywność",
  },
  possible: { lose: "{delta} mniej? Realne i możliwe!", gain: "Przytyć {delta}? Realne i możliwe!" },
  ageWhy: "Metabolizm zmienia się z wiekiem, więc to uwzględniamy",
  ontrack: {
    title: "Pomaga ci trzymać kurs",
    captions: {
      consistency: "Opuszczony dzień nic nie kosztuje. Następny zaczyna się od zera.",
      habits: "Nic nie jest zakazane. Każdy talerz dostaje rzetelne makro.",
      support: "Zapytaj w czacie — {coach} odpowie na wszystko, o każdej porze.",
      busy: "Jedno zdjęcie to cały wpis.",
      ideas: "Nie wiesz, co na kolację? {coach} podpowie, co zmieści się w tym, co zostało.",
    },
  },
  chart: {
    byEait: "z eait",
    weightTrend: "Trend wagi",
    without: "Bez",
    now: "Teraz",
    later: "Później",
    twoWays: "Waga w czasie, na dwa sposoby: z planem i bez",
    estimatedProgress: "Szacowane postępy",
    estimate: "Szacunek",
    target: "Cel {weight}",
        monthEstimate: "{month} · szacunkowo",
    estimateAria: "Szacowana waga: teraz {from}, {to} — szacunkowo {month}",
  },
  plan: {
    goalLose: "Cel: schudnąć {delta} · orientacyjnie {month}",
    goalGain: "Cel: przytyć {delta} · orientacyjnie {month}",
    goalMaintain: "Cel: utrzymać wagę",
    rest: "Twoje ciało w spoczynku spala", activity: "Z twoją aktywnością około", pace: "Pod twoje tempo dostosowujemy", floor: "Próg, poniżej którego nie schodzimy", protein: "Cel białka",
  },
  health: {
    title: "Synchronizuj z aplikacją Zdrowie",
    body: "Waga i aktywność trafiają do eait. Twoje posiłki trafiają do aplikacji Zdrowie.",
  },
  targetSuggestion:  {
    down: "Proponuję {weight}, około {pct}% mniej — dobry pierwszy cel",
    up: "Proponuję {weight}, około {pct}% więcej — dobry pierwszy cel",
  },
  firstMeal:  FIRST_MEAL_COPY.pl,
  stepper:  { continue: "Dalej", less: "Mniej", more: "Więcej" },
  offerHeadline:  "Cel: {kg} kg · orientacyjnie {month}",
  planGoal: { metric: "Cel: schudnąć {n} kg · orientacyjnie {month}", imperial: "Cel: schudnąć {n} lb · orientacyjnie {month}" },
};

const TR: ChatCopy = {
  idlePlaceholder:  "Spud'a yaz…",
  continueLabel: "Devam",
  saveKept: "Kaydedilemedi. Yanıtın hâlâ burada. Devam onu tekrar gönderir.",
  underAgeCard:  {
    title: "eait {age} yaş ve üzeri içindir",
    body: "Bu uygulamanın kalori hedeflerini belirleme şekli, hâlâ büyüyen bir vücut için tasarlanmadı.",
  },
  underAge:  {
    ask: "Üzgünüm — burada durmam gerekiyor. Bir yazım hatası yüzündense, gerçek yaşını gönder yeter.",
    confirm: "Bu benim gerçek yaşım",
    placeholder: "Yaşın",
    stopped: [
      "O zaman burada duruyoruz. Bana anlattığın her şeyi siliyorum.",
      "{age} yaşında geri gel, ben buralarda olurum.",
    ],
    endedPlaceholder: "eait {age} yaş ve üzeri içindir",
  },
  belowHealthy:  {
    title: "Bunu hedef olarak koyamam",
    body: "Boyun için en düşük sağlıklı kilo yaklaşık {kg} kg. Bunun altında bir hedef koymayız. Bir doktorla farklı bir şey üzerinde çalışıyorsan, bu uygulamayı değil onu dinle.",
  },
  invalid:  {
    age: "Bu bir yaş gibi görünmüyor — 34 gibi bir şey dene.",
    height_cm: "Santimetre olarak — 175 gibi bir şey.",
    weight_kg: "Kilogram olarak — yaklaşık olması yeter.",
    target_weight_kg: "kg cinsinden bir sayı — 70 gibi.",
  },
  ambiguousAge:  {
    line: "Doğru okuduğumdan emin olmak istiyorum — {year} yılını kastettiysen dört hanenin hepsini gönder.",
    confirm: "{age} yaşındayım",
  },
  direction:  {
    gain: "Şu an {weight} kg'sın ve {target} hedefine kilo almak istedin — buradan bu bir artış değil. Amaç değiştiyse onu değiştirebiliriz; değilse bana {weight} üstünde bir sayı ver.",
    lose: "Şu an {weight} kg'sın ve {target} hedefine kilo vermek istedin — buradan bu bir düşüş değil. Amaç değiştiyse onu değiştirebiliriz; değilse bana {weight} altında bir sayı ver.",
    switchToLose: "Kilo vermeye geç",
    switchToGain: "Kilo almaya geç",
    above: "{weight} üstünde bir sayı…",
    below: "{weight} altında bir sayı…",
  },
  switched:  {
    gain: "Değiştirildi — kilo alıyoruz. kg olarak nereye varmak istersin?",
    lose: "Değiştirildi — kilo veriyoruz. kg olarak nereye varmak istersin? Burada daha hızlı daha iyi değil — sadece korunması daha zor.",
  },
  capNoteTail:  " Bu, haftada yaklaşık {kg} kg.",
  goalEdit:  {
    cleared: "Hedef kilon artık bu amaca uymuyordu, bu yüzden silindi — yenisini belirle.",
    worthSetting: "Kaydedildi. Ama hedef kilon artık amacına uymuyor — yenisini belirlemeye değer.",
  },
  target: {
    // "55 · lowest we set" under the range's floor, "74 · now" beside today, "− 6kg" the
    // answer's distance from it.
    lowest: "{weight} · koyduğumuz en düşük",
    now: "{weight} · şu an",
    nowLowest: "{weight} · şu an · koyduğumuz en düşük",
    deltaDown: "− {weight}",
    deltaUp: "+ {weight}",
  },
  pace: {
    rate: "haftada {rate}",
    rateSuffix: "haftada",
    result: "{month} civarında {target} · günde {kcal} kcal",
    capMarker: "güvenli sınırda tutuldu",
    floorMarker: "asla {floor} altında değil · her tempo burada kalır",
    echo: "{from} → {to}.",
  },
  how: {
    title: "eait nasıl çalışır",
    meal: "Somon, pilav, yeşillik",
    photoAlt: "Vizörde bir tahıl kâsesi",
    steps: ["Tabağın fotoğrafını çek", "Dürüst makrolar al", "İlerlemeni gör"],
  },
  units: { years: "yaş", yearsCount: { one: "{n} yaş", other: "{n} yaş" } },
  twice: {
    title: "İki kat fazla kilo ver",
    sub: "Yediğini not edenler iki kat fazla kilo veriyor",
    without: "Kayıt tutmadan",
    with: "eait ile",
    source: "Hollis et al., Am J Prev Med, 2008",
    alt: "Kayıt tutmadan: 1×; eait ile: 2×",
  },
  baseline: {
    title: "İşte başlangıç noktan",
    bmi: "Vücut Kitle İndeksi (VKİ)",
    bands: { under: "ZAYIF", healthy: "SAĞLIKLI", over: "FAZLA KİLOLU", obese: "OBEZ" },
    verdict: { under: "VKİ'n sağlıklı aralığın altında", healthy: "VKİ'n sağlıklı aralıkta", above: "VKİ'n sağlıklı aralığın üstünde" },
    note: "Planın bunu hesaba katar.",
    you: "Sen",
    body: "Boy · kilo",
    activity: "Aktivite",
  },
  possible: { lose: "{delta} daha az mı? Gerçekçi ve mümkün!", gain: "{delta} almak mı? Gerçekçi ve mümkün!" },
  ageWhy: "Metabolizman yaşla değişir, biz de bunu hesaba katarız",
  ontrack: {
    title: "Seni yolunda tutmak için yapıldı",
    captions: {
      consistency: "Kaçırılan bir günün bedeli yok. Sonraki gün sıfırdan başlar.",
      habits: "Hiçbir şey yasak değil. Her tabak dürüst makrolar alır.",
      support: "Aklına takılan her şeyi, istediğin zaman Sohbet'te {coach} ile konuş.",
      busy: "Bir fotoğraf, kaydın tamamı.",
      ideas: "Akşam yemeği için fikrin mi yok? Kalan hakkına neyin uyduğunu {coach} söylesin.",
    },
  },
  chart: {
    byEait: "eait ile",
    weightTrend: "Kilo eğilimi",
    without: "Olmadan",
    now: "Şimdi",
    later: "Sonra",
    twoWays: "Zaman içinde kilo, iki şekilde çizildi: planla ve plansız",
    estimatedProgress: "Tahmini ilerleme",
    estimate: "Tahmin",
    target: "Hedef {weight}",
        monthEstimate: "{month} · tahmini",
    estimateAria: "Tahmini kilo: şu an {from}, {month} civarında {to}",
  },
  plan: {
    goalLose: "Hedef: {month} tarihine kadar {delta} vermek",
    goalGain: "Hedef: {month} tarihine kadar {delta} almak",
    goalMaintain: "Hedef: kilomu korumak",
    rest: "Vücudun dinlenirken yakar", activity: "Aktivitenle birlikte yaklaşık", pace: "Tempona göre ayarlıyoruz", floor: "Geçmediğimiz alt sınır", protein: "Hedeflenecek protein",
  },
  health: {
    title: "Sağlık ile eşzamanla",
    body: "Kilo ve aktivite gelir. Öğünlerin Sağlık'a gider.",
  },
  targetSuggestion:  {
    down: "{weight} öneriyorum, yaklaşık %{pct} aşağı, iyi bir ilk hedef",
    up: "{weight} öneriyorum, yaklaşık %{pct} yukarı, iyi bir ilk hedef",
  },
  firstMeal:  FIRST_MEAL_COPY.tr,
  stepper:  { continue: "Devam", less: "Daha az", more: "Daha fazla" },
  offerHeadline:  "{month} tarihine kadar {kg} kg'a ulaş",
  planGoal: { metric: "Hedef: {month} tarihine kadar {n} kg vermek", imperial: "Hedef: {month} tarihine kadar {n} lb vermek" },
};

const ZH_HANT: ChatCopy = {
  idlePlaceholder:  "傳訊息給 Spud…",
  continueLabel: "繼續",
  saveKept: "無法儲存。你的答案還在，按「繼續」會再傳送一次。",
  underAgeCard:  {
    title: "eait 適用於 {age} 歲以上",
    body: "這個 App 設定熱量目標的方式，並不是為仍在發育的身體設計的。",
  },
  underAge:  {
    ask: "抱歉，我只能到此為止。如果是打錯字，直接傳你的真實年齡給我就好。",
    confirm: "這是我的真實年齡",
    placeholder: "你的年齡",
    stopped: [
      "那我們就到這裡。我會刪除你告訴我的所有資料。",
      "等你 {age} 歲再回來，我會在這裡。",
    ],
    endedPlaceholder: "eait 適用於 {age} 歲以上",
  },
  belowHealthy:  {
    title: "我無法把它設為目標",
    body: "以你的身高來說，最低的健康體重約為 {kg} 公斤。我們不會設定低於此的目標。如果你正和醫師進行其他計畫，請遵從醫師，而不是這個 App。",
  },
  invalid:  {
    age: "這看起來不像年齡，試試像 34 這樣的數字。",
    height_cm: "以公分為單位，例如 175。",
    weight_kg: "以公斤為單位，大概就好。",
    target_weight_kg: "以公斤為單位的數字，例如 70。",
  },
  ambiguousAge:  {
    line: "我想確認沒看錯：如果你指的是 {year} 年，請傳完整的四位數。",
    confirm: "我 {age} 歲",
  },
  direction:  {
    gain: "你目前 {weight} 公斤，想增重到 {target}，但從現在來看這不是增重。如果目標改變了，我們可以切換；否則請給我一個大於 {weight} 的數字。",
    lose: "你目前 {weight} 公斤，想減重到 {target}，但從現在來看這不是減重。如果目標改變了，我們可以切換；否則請給我一個小於 {weight} 的數字。",
    switchToLose: "改為減重",
    switchToGain: "改為增重",
    above: "大於 {weight} 的數字…",
    below: "小於 {weight} 的數字…",
  },
  switched:  {
    gain: "已切換，那就增重。你想達到幾公斤？",
    lose: "已切換，那就減重。你想達到幾公斤？這裡不是越快越好，越快只會越難維持。",
  },
  capNoteTail:  "大約每週 {kg} 公斤。",
  goalEdit:  {
    cleared: "你的目標體重已經不符合這個目標，所以已清除，請設定新的目標體重。",
    worthSetting: "已記錄。不過你的目標體重已經不符合你的目標，建議設定新的目標體重。",
  },
  target: {
    // "55 · lowest we set" under the range's floor, "74 · now" beside today, "− 6kg" the
    // answer's distance from it.
    lowest: "{weight} · 我們設定的最低值",
    now: "{weight} · 目前",
    nowLowest: "{weight} · 目前 · 我們設定的最低值",
    deltaDown: "− {weight}",
    deltaUp: "+ {weight}",
  },
  pace: {
    rate: "每週 {rate}",
    rateSuffix: "每週",
    result: "約 {month} 達到 {target} · 每天 {kcal} 大卡",
    capMarker: "已限制在安全上限",
    floorMarker: "絕不低於 {floor} · 任何步調都在此打住",
    echo: "從 {from} 到 {to}。",
  },
  how: {
    title: "eait 如何運作",
    meal: "鮭魚、白飯、青菜",
    photoAlt: "觀景窗中的穀物碗",
    steps: ["拍下你的餐盤", "得到誠實的營養素分析", "查看你的進度"],
  },
  units: { years: "歲", yearsCount: { one: "{n} 歲", other: "{n} 歲" } },
  twice: {
    title: "減掉兩倍的體重",
    sub: "記錄飲食的人，減掉的體重是不記錄者的兩倍",
    without: "不記錄",
    with: "使用 eait",
    source: "Hollis et al., Am J Prev Med, 2008",
    alt: "不記錄：1×；使用 eait：2×",
  },
  baseline: {
    title: "這是你的起點",
    bmi: "身體質量指數（BMI）",
    bands: { under: "過輕", healthy: "健康", over: "過重", obese: "肥胖" },
    verdict: { under: "你的 BMI 低於健康範圍", healthy: "你的 BMI 在健康範圍內", above: "你的 BMI 高於健康範圍" },
    note: "你的計畫已將此納入考量。",
    you: "你",
    body: "身高 · 體重",
    activity: "活動量",
  },
  possible: { lose: "少 {delta}？實際，而且做得到！", gain: "增加 {delta}？實際，而且做得到！" },
  ageWhy: "你的代謝會隨年齡改變，所以我們把它納入計算",
  ontrack: {
    title: "幫你持續走在正軌上",
    captions: {
      consistency: "錯過一天沒關係。下一天從零開始。",
      habits: "沒有禁止的食物。每一盤都有誠實的營養素分析。",
      support: "隨時在聊天中問 {coach} 任何問題。",
      busy: "拍一張照片就完成記錄。",
      ideas: "不知道晚餐吃什麼？問 {coach} 剩下的額度適合吃什麼。",
    },
  },
  chart: {
    byEait: "使用 eait",
    weightTrend: "體重趨勢",
    without: "不使用",
    now: "現在",
    later: "之後",
    twoWays: "體重隨時間的變化，兩種畫法：有計畫和沒有計畫",
    estimatedProgress: "預估進度",
    estimate: "估計",
    target: "目標 {weight}",
        monthEstimate: "{month} · 估計",
    estimateAria: "預估體重：現在 {from}，約 {month} 達到 {to}",
  },
  plan: {
    goalLose: "目標：在 {month} 前減掉 {delta}",
    goalGain: "目標：在 {month} 前增加 {delta}",
    goalMaintain: "目標：維持我的體重",
    rest: "你的身體在靜止時消耗", activity: "加上你的活動量，大約", pace: "依你的步調，我們調整", floor: "我們不會低於的下限", protein: "蛋白質目標",
  },
  health: {
    title: "與「健康」同步",
    body: "體重和活動資料會匯入，你的餐點會寫入「健康」。",
  },
  targetSuggestion:  {
    down: "我建議 {weight}，約減少 {pct}%，是不錯的第一個目標",
    up: "我建議 {weight}，約增加 {pct}%，是不錯的第一個目標",
  },
  firstMeal:  FIRST_MEAL_COPY["zh-Hant"],
  stepper:  { continue: "繼續", less: "減少", more: "增加" },
  offerHeadline:  "在 {month} 前達到 {kg} 公斤",
  planGoal: { metric: "目標：在 {month} 前減掉 {n} 公斤", imperial: "目標：在 {month} 前減掉 {n} 磅" },
};

const ZH_HANS: ChatCopy = {
  idlePlaceholder:  "给 Spud 发消息…",
  continueLabel: "继续",
  saveKept: "无法保存。你的回答还在，点击“继续”会再次发送。",
  underAgeCard:  {
    title: "eait 仅供{age}岁及以上人士使用",
    body: "本 App 设定热量目标的方式，并不适用于仍在生长发育的身体。",
  },
  underAge:  {
    ask: "抱歉——我只能到此为止。如果是输错了，直接发送你的真实年龄就好。",
    confirm: "这就是我的真实年龄",
    placeholder: "你的年龄",
    stopped: [
      "那我们就到此为止。我会删除你告诉我的所有内容。",
      "等你{age}岁时再回来，我会在这里。",
    ],
    endedPlaceholder: "eait 仅供{age}岁及以上人士使用",
  },
  belowHealthy:  {
    title: "我无法把这个设为目标",
    body: "按你的身高，最低健康体重约为{kg}公斤。我们不会设定低于此值的目标。如果你正在和医生一起朝其他方向努力，请听从医生的建议，而不是本 App。",
  },
  invalid:  {
    age: "这看起来不像年龄——试试像 34 这样的数字。",
    height_cm: "以厘米为单位——比如 175。",
    weight_kg: "以公斤为单位——大概的数字就行。",
    target_weight_kg: "以公斤为单位的数字——比如 70。",
  },
  ambiguousAge:  {
    line: "我想确认没有理解错——如果你指的是{year}年，请发送完整的四位数字。",
    confirm: "我{age}岁",
  },
  direction:  {
    gain: "你现在{weight}公斤，却想增重到{target}——这并不是增重。如果目标变了，我们可以切换；否则请给我一个大于{weight}的数字。",
    lose: "你现在{weight}公斤，却想减重到{target}——这并不是减重。如果目标变了，我们可以切换；否则请给我一个小于{weight}的数字。",
    switchToLose: "切换为减重",
    switchToGain: "切换为增重",
    above: "大于{weight}的数字…",
    below: "小于{weight}的数字…",
  },
  switched:  {
    gain: "已切换——那就增重。你想达到多少公斤？",
    lose: "已切换——那就减重。你想达到多少公斤？这里并不是越快越好——太快只会更难保持。",
  },
  capNoteTail:  "大约每周{kg}公斤。",
  goalEdit:  {
    cleared: "你的目标体重已不符合这个目标，因此已被清除——请设定一个新的。",
    worthSetting: "已记录。不过你的目标体重已不符合你的目标——建议设定一个新的。",
  },
  target: {
    // "55 · lowest we set" under the range's floor, "74 · now" beside today, "− 6kg" the
    // answer's distance from it.
    lowest: "{weight} · 我们设定的最低值",
    now: "{weight} · 当前",
    nowLowest: "{weight} · 当前 · 我们设定的最低值",
    deltaDown: "− {weight}",
    deltaUp: "+ {weight}",
  },
  pace: {
    rate: "每周{rate}",
    rateSuffix: "每周",
    result: "约{month}达到{target} · 每天{kcal}千卡",
    capMarker: "已限制在安全上限内",
    floorMarker: "不低于{floor} · 任何节奏都以此为底线",
    echo: "从{from}到{to}。",
  },
  how: {
    title: "eait 如何运作",
    meal: "三文鱼、米饭、青菜",
    photoAlt: "取景框中的一碗谷物饭",
    steps: ["拍下餐盘", "获得如实的宏量营养素", "查看你的进度"],
  },
  units: { years: "岁", yearsCount: { one: "{n}岁", other: "{n}岁" } },
  twice: {
    title: "减重多一倍",
    sub: "记录饮食的人减掉的体重多一倍",
    without: "不记录",
    with: "使用 eait",
    source: "Hollis et al., Am J Prev Med, 2008",
    alt: "不记录：1×；使用 eait：2×",
  },
  baseline: {
    title: "这是你的起点",
    bmi: "身体质量指数（BMI）",
    bands: { under: "偏瘦", healthy: "正常", over: "超重", obese: "肥胖" },
    verdict: { under: "你的BMI低于健康范围", healthy: "你的BMI在健康范围内", above: "你的BMI高于健康范围" },
    note: "你的计划已将此考虑在内。",
    you: "你",
    body: "身高 · 体重",
    activity: "活动量",
  },
  possible: { lose: "少{delta}？现实，而且可行！", gain: "增加{delta}？现实，而且可行！" },
  ageWhy: "代谢会随年龄变化，所以我们会把它考虑进去",
  ontrack: {
    title: "帮你坚持下去",
    captions: {
      consistency: "错过一天没有任何代价。下一天从零开始。",
      habits: "没有禁止的食物。每一盘都有如实的宏量营养素。",
      support: "随时在聊天中向{coach}提任何问题。",
      busy: "一张照片就是全部记录。",
      ideas: "晚餐没主意？问问{coach}，剩下的额度适合吃什么。",
    },
  },
  chart: {
    byEait: "使用 eait",
    weightTrend: "体重趋势",
    without: "不使用",
    now: "现在",
    later: "以后",
    twoWays: "体重随时间的变化，两种画法：有计划和没有计划",
    estimatedProgress: "预估进度",
    estimate: "估算",
    target: "目标{weight}",
        monthEstimate: "{month} · 估算",
    estimateAria: "预估体重：现在{from}，约{month}达到{to}",
  },
  plan: {
    goalLose: "目标：减掉{delta}，预计{month}",
    goalGain: "目标：增加{delta}，预计{month}",
    goalMaintain: "目标：保持体重",
    rest: "你的身体静息时消耗", activity: "加上你的活动量，大约", pace: "根据你的节奏，我们调整", floor: "我们不会突破的底线", protein: "建议的蛋白质目标",
  },
  health: {
    title: "与“健康”同步",
    body: "体重和活动数据会同步进来，你的餐食会写入“健康”。",
  },
  targetSuggestion:  {
    down: "我建议{weight}，约减少{pct}%，是不错的第一个目标",
    up: "我建议{weight}，约增加{pct}%，是不错的第一个目标",
  },
  firstMeal:  FIRST_MEAL_COPY["zh-Hans"],
  stepper:  { continue: "继续", less: "减少", more: "增加" },
  offerHeadline:  "预计{month}达到{kg}公斤",
  planGoal: { metric: "目标：减掉{n}公斤，预计{month}", imperial: "目标：减掉{n}磅，预计{month}" },
};

const KO: ChatCopy = {
  idlePlaceholder:  "Spud에게 메시지…",
  continueLabel: "계속",
  saveKept: "저장하지 못했어요. 답변은 그대로 있어요. 계속을 누르면 다시 보내요.",
  underAgeCard:  {
    title: "eait은 {age}세 이상을 위한 앱이에요",
    body: "이 앱의 칼로리 목표 설정 방식은 아직 성장 중인 몸을 위해 만들어지지 않았어요.",
  },
  underAge:  {
    ask: "죄송해요. 여기서 멈춰야 해요. 오타 때문이라면 실제 나이를 보내 주세요.",
    confirm: "실제 나이가 맞아요",
    placeholder: "나이",
    stopped: [
      "그럼 여기서 멈출게요. 알려 준 내용은 모두 삭제할게요.",
      "{age}세가 되면 다시 와 주세요. 기다리고 있을게요.",
    ],
    endedPlaceholder: "eait은 {age}세 이상을 위한 앱이에요",
  },
  belowHealthy:  {
    title: "그 목표는 설정할 수 없어요",
    body: "키에 맞는 건강한 체중의 하한은 약 {kg}kg이에요. 그보다 낮은 목표는 설정하지 않아요. 의사와 다른 목표로 진행 중이라면 이 앱보다 의사의 안내를 따르세요.",
  },
  invalid:  {
    age: "나이 같지 않아요. 34처럼 입력해 보세요.",
    height_cm: "센티미터로 입력해 주세요. 예: 175.",
    weight_kg: "킬로그램으로 입력해 주세요. 대략이어도 괜찮아요.",
    target_weight_kg: "kg 단위 숫자로 입력해 주세요. 예: 70.",
  },
  ambiguousAge:  {
    line: "제대로 읽었는지 확인하고 싶어요. {year}년을 뜻한 거라면 네 자리 모두 보내 주세요.",
    confirm: "{age}세예요",
  },
  direction:  {
    gain: "지금 {weight}kg인데 {target}까지 늘리고 싶다고 했어요. 지금 기준으로는 증가가 아니에요. 목표가 바뀌었다면 전환할 수 있어요. 아니라면 {weight}보다 큰 숫자를 알려 주세요.",
    lose: "지금 {weight}kg인데 {target}까지 줄이고 싶다고 했어요. 지금 기준으로는 감량이 아니에요. 목표가 바뀌었다면 전환할 수 있어요. 아니라면 {weight}보다 작은 숫자를 알려 주세요.",
    switchToLose: "감량으로 전환",
    switchToGain: "증량으로 전환",
    above: "{weight}보다 큰 숫자…",
    below: "{weight}보다 작은 숫자…",
  },
  switched:  {
    gain: "전환했어요. 증량으로 가요. 목표 체중은 몇 kg인가요?",
    lose: "전환했어요. 감량으로 가요. 목표 체중은 몇 kg인가요? 여기서는 빠르다고 좋은 게 아니에요. 유지하기가 더 어려울 뿐이에요.",
  },
  capNoteTail:  " 주당 약 {kg}kg이에요.",
  goalEdit:  {
    cleared: "목표 체중이 그 목표와 더 이상 맞지 않아서 지웠어요. 새로 설정해 주세요.",
    worthSetting: "기록했어요. 다만 목표 체중이 목표와 더 이상 맞지 않아요. 새로 설정하는 게 좋아요.",
  },
  target: {
    // "55 · lowest we set" under the range's floor, "74 · now" beside today, "− 6kg" the
    // answer's distance from it.
    lowest: "{weight} · 설정 가능한 최저치",
    now: "{weight} · 현재",
    nowLowest: "{weight} · 현재 · 설정 가능한 최저치",
    deltaDown: "− {weight}",
    deltaUp: "+ {weight}",
  },
  pace: {
    rate: "주당 {rate}",
    rateSuffix: "주당",
    result: "{month}쯤 {target} · 하루 {kcal}kcal",
    capMarker: "안전 한도로 제한됨",
    floorMarker: "최소 {floor} · 어떤 속도든 여기서 멈춰요",
    echo: "{from}에서 {to}로.",
  },
  how: {
    title: "eait 사용법",
    meal: "연어, 밥, 채소",
    photoAlt: "뷰파인더 속 곡물 볼",
    steps: ["접시를 찍어요", "솔직한 매크로를 받아요", "진행 상황을 확인해요"],
  },
  units: { years: "세", yearsCount: { one: "{n}세", other: "{n}세" } },
  twice: {
    title: "체중을 두 배 더 감량해요",
    sub: "먹은 음식을 기록하는 사람은 체중을 두 배 더 감량해요",
    without: "기록 없이",
    with: "eait과 함께",
    source: "Hollis et al., Am J Prev Med, 2008",
    alt: "기록 없이: 1×, eait과 함께: 2×",
  },
  baseline: {
    title: "현재 기준점이에요",
    bmi: "체질량지수(BMI)",
    bands: { under: "저체중", healthy: "정상", over: "과체중", obese: "비만" },
    verdict: { under: "BMI가 건강 범위보다 낮아요", healthy: "BMI가 건강 범위 안에 있어요", above: "BMI가 건강 범위보다 높아요" },
    note: "플랜에 이 점을 반영해요.",
    you: "나",
    body: "키 · 체중",
    activity: "활동량",
  },
  possible: { lose: "{delta} 적게요? 현실적이고, 가능해요!", gain: "{delta} 증량이요? 현실적이고, 가능해요!" },
  ageWhy: "나이에 따라 대사가 달라지니 그만큼 반영해요",
  ontrack: {
    title: "꾸준히 이어 가도록 만들었어요",
    captions: {
      consistency: "하루 놓쳐도 괜찮아요. 다음 날은 처음부터 다시 시작해요.",
      habits: "금지된 음식은 없어요. 모든 접시에 솔직한 매크로를 알려 드려요.",
      support: "채팅에서 언제든 {coach}에게 무엇이든 물어보세요.",
      busy: "사진 한 장이면 기록 끝이에요.",
      ideas: "저녁 메뉴가 고민인가요? 남은 양에 맞는 메뉴를 {coach}에게 물어보세요.",
    },
  },
  chart: {
    byEait: "eait과 함께",
    weightTrend: "체중 추이",
    without: "없이",
    now: "현재",
    later: "나중",
    twoWays: "시간에 따른 체중을 두 가지로 그렸어요: 플랜이 있을 때와 없을 때",
    estimatedProgress: "예상 진행 상황",
    estimate: "추정",
    target: "목표 {weight}",
        monthEstimate: "{month} · 추정",
    estimateAria: "예상 체중: 현재 {from}, {month}쯤 {to}",
  },
  plan: {
    goalLose: "목표: {month}까지 {delta} 감량",
    goalGain: "목표: {month}까지 {delta} 증량",
    goalMaintain: "목표: 체중 유지",
    rest: "휴식 중 몸이 쓰는 에너지", activity: "활동량을 더하면 약", pace: "속도에 맞춘 조정", floor: "더 낮추지 않는 최솟값", protein: "단백질 목표",
  },
  health: {
    title: "건강 앱과 동기화",
    body: "체중과 활동은 가져오고, 식사는 건강 앱으로 보내요.",
  },
  targetSuggestion:  {
    down: "{weight}를 추천해요. 약 {pct}% 감소로, 첫 목표로 좋아요",
    up: "{weight}를 추천해요. 약 {pct}% 증가로, 첫 목표로 좋아요",
  },
  firstMeal:  FIRST_MEAL_COPY.ko,
  stepper:  { continue: "계속", less: "줄이기", more: "늘리기" },
  offerHeadline:  "{month}까지 {kg}kg 달성",
  planGoal: { metric: "목표: {month}까지 {n}kg 감량", imperial: "목표: {month}까지 {n}lb 감량" },
};

const JA: ChatCopy = {
  idlePlaceholder:  "Spudにメッセージ…",
  continueLabel: "続ける",
  saveKept: "保存できませんでした。回答は残っています。「続ける」でもう一度送信します。",
  underAgeCard:  {
    title: "eaitは{age}歳以上が対象です",
    body: "このアプリのカロリー目標の設定方法は、まだ成長中の体向けには作られていません。",
  },
  underAge:  {
    ask: "ごめんなさい、ここで止めなければなりません。入力ミスだった場合は、本当の年齢を送ってください。",
    confirm: "これが本当の年齢です",
    placeholder: "年齢",
    stopped: [
      "それでは、ここで終わりにします。教えてもらった内容はすべて削除します。",
      "{age}歳になったらまた来てください。待っています。",
    ],
    endedPlaceholder: "eaitは{age}歳以上が対象です",
  },
  belowHealthy:  {
    title: "その目標は設定できません",
    body: "あなたの身長での健康的な体重の下限は約{kg}kgです。これより低い目標は設定しません。医師と別の方針で取り組んでいる場合は、このアプリではなく医師の指示に従ってください。",
  },
  invalid:  {
    age: "年齢ではないようです。34のように入力してください。",
    height_cm: "センチメートルで入力してください（例：175）。",
    weight_kg: "キログラムで入力してください。だいたいで大丈夫です。",
    target_weight_kg: "kgの数字で入力してください（例：70）。",
  },
  ambiguousAge:  {
    line: "念のため確認させてください。{year}年のことなら、4桁すべて送ってください。",
    confirm: "{age}歳です",
  },
  direction:  {
    gain: "今は{weight}kgで、{target}まで増やしたいとのことですが、今の体重からだと増量になりません。目標が変わったなら切り替えられます。そうでなければ{weight}より大きい数字を教えてください。",
    lose: "今は{weight}kgで、{target}まで減らしたいとのことですが、今の体重からだと減量になりません。目標が変わったなら切り替えられます。そうでなければ{weight}より小さい数字を教えてください。",
    switchToLose: "減量に切り替える",
    switchToGain: "増量に切り替える",
    above: "{weight}より大きい数字…",
    below: "{weight}より小さい数字…",
  },
  switched:  {
    gain: "切り替えました。増量ですね。何kgを目指しますか？",
    lose: "切り替えました。減量ですね。何kgを目指しますか？速ければいいわけではありません。維持するのが難しくなるだけです。",
  },
  capNoteTail:  "1週間あたり約{kg}kgです。",
  goalEdit:  {
    cleared: "目標体重がその目標に合わなくなったので、リセットしました。新しく設定してください。",
    worthSetting: "記録しました。ただ、目標体重が今の目標に合っていないので、新しく設定するのがおすすめです。",
  },
  target: {
    // "55 · lowest we set" under the range's floor, "74 · now" beside today, "− 6kg" the
    // answer's distance from it.
    lowest: "{weight} · 設定できる下限",
    now: "{weight} · 現在",
    nowLowest: "{weight} · 現在 · 設定できる下限",
    deltaDown: "− {weight}",
    deltaUp: "+ {weight}",
  },
  pace: {
    rate: "週{rate}",
    rateSuffix: "/週",
    result: "{month}ごろ{target} · 1日{kcal}kcal",
    capMarker: "安全な上限に制限",
    floorMarker: "{floor}を下回らない · どのペースでもここが下限",
    echo: "{from}から{to}へ。",
  },
  how: {
    title: "eaitの使い方",
    meal: "サーモン、ごはん、青菜",
    photoAlt: "ファインダーに映るグレインボウル",
    steps: ["お皿を撮影", "正直なマクロ栄養素を確認", "進捗を見る"],
  },
  units: { years: "歳", yearsCount: { one: "{n}歳", other: "{n}歳" } },
  twice: {
    title: "減る体重が2倍に",
    sub: "食べたものを記録する人は、体重が2倍減っています",
    without: "記録なし",
    with: "eaitあり",
    source: "Hollis et al., Am J Prev Med, 2008",
    alt: "記録なし：1×、eaitあり：2×",
  },
  baseline: {
    title: "あなたの現在地です",
    bmi: "ボディマス指数（BMI）",
    bands: { under: "低体重", healthy: "標準", over: "過体重", obese: "肥満" },
    verdict: { under: "BMIが標準範囲より低めです", healthy: "BMIは標準範囲内です", above: "BMIが標準範囲より高めです" },
    note: "プランはそれも考慮しています。",
    you: "あなた",
    body: "身長 · 体重",
    activity: "活動量",
  },
  possible: { lose: "{delta}少なく？現実的で、可能です！", gain: "{delta}増やす？現実的で、可能です！" },
  ageWhy: "代謝は年齢とともに変わるので、それも計算に入れます",
  ontrack: {
    title: "続けやすい仕組み",
    captions: {
      consistency: "1日抜けても問題なし。次の日はゼロから始まります。",
      habits: "禁止の食べ物はありません。どのお皿にも正直なマクロ栄養素を。",
      support: "チャットで{coach}にいつでも何でも聞けます。",
      busy: "写真1枚で記録完了。",
      ideas: "夕食に迷ったら？残りに合うものを{coach}に聞いてみましょう。",
    },
  },
  chart: {
    byEait: "eaitあり",
    weightTrend: "体重の推移",
    without: "なし",
    now: "現在",
    later: "その後",
    twoWays: "体重の推移を2通りで表示：プランありとプランなし",
    estimatedProgress: "進捗の見込み",
    estimate: "見込み",
    target: "目標 {weight}",
        monthEstimate: "{month} · 見込み",
    estimateAria: "体重の見込み：現在{from}、{month}ごろ{to}",
  },
  plan: {
    goalLose: "目標：{month}までに{delta}減らす",
    goalGain: "目標：{month}までに{delta}増やす",
    goalMaintain: "目標：体重を維持する",
    rest: "安静時に体が消費するのは", activity: "活動量を含めると約", pace: "ペースに合わせた調整", floor: "これ以上は下げない下限", protein: "目指したいタンパク質",
  },
  health: {
    title: "ヘルスケアと同期",
    body: "体重とアクティビティを取り込み、食事をヘルスケアに書き込みます。",
  },
  targetSuggestion:  {
    down: "おすすめは{weight}。約{pct}%減で、最初の目標にちょうどいいです",
    up: "おすすめは{weight}。約{pct}%増で、最初の目標にちょうどいいです",
  },
  firstMeal:  FIRST_MEAL_COPY.ja,
  stepper:  { continue: "続ける", less: "減らす", more: "増やす" },
  offerHeadline:  "{month}までに{kg}kgへ",
  planGoal: { metric: "目標：{month}までに{n}kg減らす", imperial: "目標：{month}までに{n}lb減らす" },
};

const PT_BR: ChatCopy = {
  idlePlaceholder:  "Mensagem para o Spud…",
  continueLabel: "Continuar",
  saveKept: "Não foi possível salvar. Sua resposta continua aqui. Continuar envia de novo.",
  underAgeCard:  {
    title: "O eait é para quem tem {age} anos ou mais",
    body: "O jeito como este app define metas de calorias não foi feito para um corpo que ainda está crescendo.",
  },
  underAge:  {
    ask: "Desculpe — preciso parar aqui. Se foi um erro de digitação, é só enviar sua idade real.",
    confirm: "Essa é minha idade real",
    placeholder: "Sua idade",
    stopped: [
      "Então paramos aqui. Vou apagar tudo o que você me contou.",
      "Volte quando tiver {age} anos e eu vou estar por aqui.",
    ],
    endedPlaceholder: "O eait é para quem tem {age} anos ou mais",
  },
  belowHealthy:  {
    title: "Não posso definir isso como meta",
    body: "O menor peso saudável para sua altura é de cerca de {kg} kg. Não vamos definir uma meta abaixo disso. Se você segue outra orientação com um médico, siga essa orientação, e não este app.",
  },
  invalid:  {
    age: "Isso não parece uma idade — tente algo como 34.",
    height_cm: "Em centímetros — algo como 175.",
    weight_kg: "Em quilos — um valor aproximado já serve.",
    target_weight_kg: "Um número em kg — como 70.",
  },
  ambiguousAge:  {
    line: "Quero ter certeza de que entendi — se você quis dizer o ano {year}, envie os quatro dígitos.",
    confirm: "Tenho {age} anos",
  },
  direction:  {
    gain: "Você está com {weight} kg e pediu para ganhar até {target} — isso não é um ganho a partir de agora. Se a meta mudou, podemos trocar; senão, me dê um número acima de {weight}.",
    lose: "Você está com {weight} kg e pediu para perder até {target} — isso não é uma perda a partir de agora. Se a meta mudou, podemos trocar; senão, me dê um número abaixo de {weight}.",
    switchToLose: "Mudar para perder",
    switchToGain: "Mudar para ganhar",
    above: "Um número acima de {weight}…",
    below: "Um número abaixo de {weight}…",
  },
  switched:  {
    gain: "Pronto — vamos ganhar. Onde você gostaria de chegar, em kg?",
    lose: "Pronto — vamos perder. Onde você gostaria de chegar, em kg? Mais rápido não é melhor aqui — só é mais difícil de manter.",
  },
  capNoteTail:  " Isso dá cerca de {kg} kg por semana.",
  goalEdit:  {
    cleared: "Seu peso-meta não combinava mais com esse objetivo, então foi apagado — defina um novo.",
    worthSetting: "Registrado. Mas seu peso-meta não combina mais com seu objetivo — vale definir um novo.",
  },
  target: {
    // "55 · lowest we set" under the range's floor, "74 · now" beside today, "− 6kg" the
    // answer's distance from it.
    lowest: "{weight} · o mínimo que definimos",
    now: "{weight} · agora",
    nowLowest: "{weight} · agora · o mínimo que definimos",
    deltaDown: "− {weight}",
    deltaUp: "+ {weight}",
  },
  pace: {
    rate: "{rate} por semana",
    rateSuffix: "por semana",
    result: "{target} por volta de {month} · {kcal} kcal por dia",
    capMarker: "limitado ao máximo seguro",
    floorMarker: "nunca abaixo de {floor} · todo ritmo chega aqui",
    echo: "De {from} para {to}.",
  },
  how: {
    title: "Como o eait funciona",
    meal: "Salmão, arroz, folhas verdes",
    photoAlt: "Um bowl de grãos no visor",
    steps: ["Fotografe o prato", "Receba macros honestos", "Veja seu progresso"],
  },
  units: { years: "anos", yearsCount: { one: "{n} ano", other: "{n} anos" } },
  twice: {
    title: "Perca o dobro de peso",
    sub: "Quem anota o que come perde o dobro de peso",
    without: "Sem registrar",
    with: "Com o eait",
    source: "Hollis et al., Am J Prev Med, 2008",
    alt: "Sem registrar: 1×; com o eait: 2×",
  },
  baseline: {
    title: "Este é seu ponto de partida",
    bmi: "Índice de Massa Corporal (IMC)",
    bands: { under: "ABAIXO DO PESO", healthy: "SAUDÁVEL", over: "SOBREPESO", obese: "OBESIDADE" },
    verdict: { under: "Seu IMC está abaixo da faixa saudável", healthy: "Seu IMC está na faixa saudável", above: "Seu IMC está acima da faixa saudável" },
    note: "Seu plano leva isso em conta.",
    you: "Você",
    body: "Altura · peso",
    activity: "Atividade",
  },
  possible: { lose: "{delta} a menos? Realista e possível!", gain: "Ganhar {delta}? Realista e possível!" },
  ageWhy: "Seu metabolismo muda com a idade, por isso levamos isso em conta",
  ontrack: {
    title: "Feito para manter você no caminho",
    captions: {
      consistency: "Um dia perdido não custa nada. O próximo começa do zero.",
      habits: "Nada é proibido. Todo prato recebe macros honestos.",
      support: "Pergunte o que quiser para {coach}, a qualquer hora, no Chat.",
      busy: "Uma foto é o registro inteiro.",
      ideas: "Sem ideia para o jantar? Pergunte para {coach} o que cabe no que sobrou.",
    },
  },
  chart: {
    byEait: "com o eait",
    weightTrend: "Tendência do peso",
    without: "Sem",
    now: "Agora",
    later: "Depois",
    twoWays: "Peso ao longo do tempo, desenhado de duas formas: com um plano e sem",
    estimatedProgress: "Progresso estimado",
    estimate: "Estimativa",
    target: "Meta {weight}",
        monthEstimate: "{month} · estimativa",
    estimateAria: "Peso estimado: {from} agora, {to} por volta de {month}",
  },
  plan: {
    goalLose: "Meta: perder {delta} até {month}",
    goalGain: "Meta: ganhar {delta} até {month}",
    goalMaintain: "Meta: manter meu peso",
    rest: "Seu corpo em repouso gasta", activity: "Com sua atividade, cerca de", pace: "Para o seu ritmo, ajustamos", floor: "O piso que não ultrapassamos", protein: "Meta de proteína",
  },
  health: {
    title: "Sincronizar com o Saúde",
    body: "Peso e atividade entram. Suas refeições vão para o Saúde.",
  },
  targetSuggestion:  {
    down: "Sugiro {weight}, cerca de {pct}% a menos, uma boa primeira meta",
    up: "Sugiro {weight}, cerca de {pct}% a mais, uma boa primeira meta",
  },
  firstMeal:  FIRST_MEAL_COPY["pt-BR"],
  stepper:  { continue: "Continuar", less: "Menos", more: "Mais" },
  offerHeadline:  "Chegue a {kg} kg até {month}",
  planGoal: { metric: "Meta: perder {n} kg até {month}", imperial: "Meta: perder {n} lb até {month}" },
};

export const CHAT_COPY: Localized<ChatCopy> = { en: EN, fr: FR, de: DE, it: IT, es: ES, vi: VI, id: ID, ru: RU, te: TE, ta: TA, pa: PA, or: OR, mr: MR, ml: ML, kn: KN, gu: GU, bn: BN, "pt-PT": PT_PT, ms: MS, ca: CA, sl: SL, hr: HR, sk: SK, no: NO, fi: FI, da: DA, hu: HU, el: EL, ro: RO, cs: CS, hi: HI, th: TH, sv: SV, uk: UK, nl: NL, pl: PL, tr: TR, "zh-Hant": ZH_HANT, "zh-Hans": ZH_HANS, ko: KO, ja: JA, "pt-BR": PT_BR };

/** What Spud says back, in one language. English for one nobody has written yet. */
export const chatCopyFor = (lang: Lang): ChatCopy => t(lang)(CHAT_COPY);
