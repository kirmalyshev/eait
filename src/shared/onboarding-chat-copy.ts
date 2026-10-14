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
import type { Lang, Struggle } from "./types.ts";

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
   * The "how it works" beat after the goal — three beats and nothing to answer. `meal` and
   * `photoAlt` are the words inside the step cards' drawn figures: the demo dish's name and the
   * viewfinder photo's alt text (the numbers are `HOW_DEMO`'s constants, fixed to the boards).
   */
  how: { title: string; steps: [string, string, string]; meal: string; photoAlt: string };
  /**
   * The unit word beside a wheel's or ruler's big numeral — "32 years". The symbol units (cm,
   * kg, lb, ft, in) are `spellUnit`'s and stay symbols; only the words with no symbol live here.
   * `yearsCount` is the same word as a whole counted template — the age wheel's rows, where
   * Russian declines it per number ("32 года" beside "35 лет") and one flat word is wrong.
   */
  units: { years: string; yearsCount: CountForms };
  /**
   * The three beats between the questions, none of which asks anything. `twice` is the one cited
   * claim (its source line is the study, in every language); `baseline` prints the BMI computed
   * from the typed height and weight with the band it falls in; `possible` says the target's
   * distance back, `{delta}` a formatted weight with unit.
   */
  twice: { title: string; sub: string; without: string; with: string; source: string; alt: string };
  baseline: {
    title: string; bmi: string;
    bands: { under: string; healthy: string; over: string; obese: string };
    verdict: { under: string; healthy: string; above: string };
    note: string; you: string; body: string; activity: string;
  };
  possible: { lose: string; gain: string };
  /** Under the age question (05, ieat-app#2050): why it is asked. */
  ageWhy: string;
  /**
   * The two-ways chart after the struggles pick: the FIRST picked struggle (list order) writes
   * the caption. `ontrackCaption` owns the choice; this holds the wording of each branch.
   */
  ontrack: { title: string; captions: Record<Struggle, string> };
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
  /** The post-sign-up sync screen (17-health-sync): title, one line, two buttons. */
  health: { title: string; body: string; connect: string; skip: string };
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
  how: {
    title: "How eait works",
    meal: "Salmon, rice, greens",
    photoAlt: "A grain bowl in the viewfinder",
    steps: ["Photograph the plate", "Get honest macros", "See your progress"],
  },
  units: { years: "years", yearsCount: { one: "{n} year", other: "{n} years" } },
  twice: {
    title: "Lose twice as much weight",
    sub: "People who write down what they eat lose twice as much weight",
    without: "Without logging",
    with: "With eait",
    source: "Hollis et al., Am J Prev Med, 2008",
    alt: "Without logging: 1×; with eait: 2×",
  },
  baseline: {
    title: "Here's your baseline",
    bmi: "Body Mass Index (BMI)",
    bands: { under: "UNDERWEIGHT", healthy: "HEALTHY", over: "OVERWEIGHT", obese: "OBESE" },
    verdict: { under: "Your BMI is below the healthy range", healthy: "Your BMI is in the healthy range", above: "Your BMI is above the healthy range" },
    note: "Your plan takes it into account.",
    you: "You",
    body: "Height · weight",
    activity: "Activity",
  },
  possible: { lose: "Losing {delta}? Realistic, and possible!", gain: "Gaining {delta}? Realistic, and possible!" },
  ageWhy: "Your metabolism changes with age, so we factor that in",
  ontrack: {
    title: "Built to keep you on track",
    captions: {
      consistency: "A missed day costs nothing. The next one starts at zero.",
      habits: "Nothing is banned. Every plate gets honest macros.",
      support: "Ask {coach} anything, any time, in Chat.",
      busy: "One photo is the whole log.",
      ideas: "Stuck for dinner? Ask {coach} what fits what's left.",
    },
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
    connect: "Connect Apple Health",
    skip: "Not now",
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
    connect: "Connecter l'app Santé",
    skip: "Pas maintenant",
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
    connect: "Apple Health verbinden",
    skip: "Nicht jetzt",
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
    connect: "Collega Apple Health",
    skip: "Non ora",
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
    connect: "Conectar Apple Health",
    skip: "Ahora no",
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
    connect: "Kết nối Apple Health",
    skip: "Để sau",
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
    connect: "Hubungkan Apple Health",
    skip: "Nanti saja",
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
    connect: "Подключить Apple Health",
    skip: "Не сейчас",
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

const NL: ChatCopy = {
  idlePlaceholder:  "Bericht aan Spud…",
  continueLabel: "Doorgaan",
  saveKept: "Dat kon niet worden opgeslagen. Je antwoord staat er nog. Doorgaan stuurt het opnieuw.",
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
    body: "Het laagste gezonde gewicht voor je lengte is ongeveer {kg}kg. Lager zetten we geen doel. Werk je met een arts aan iets anders, volg dan je arts en niet deze app.",
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
    gain: "Je zit op {weight}kg en wilt aankomen tot {target} — dat is vanaf hier geen aankomen. Is het doel veranderd, dan zetten we het om; anders geef me een getal boven {weight}.",
    lose: "Je zit op {weight}kg en wilt afvallen tot {target} — dat is vanaf hier geen afvallen. Is het doel veranderd, dan zetten we het om; anders geef me een getal onder {weight}.",
    switchToLose: "Overschakelen naar afvallen",
    switchToGain: "Overschakelen naar aankomen",
    above: "Een getal boven {weight}…",
    below: "Een getal onder {weight}…",
  },
  switched:  {
    gain: "Omgezet — aankomen dus. Waar wil je uitkomen, in kg?",
    lose: "Omgezet — afvallen dus. Waar wil je uitkomen, in kg? Sneller is hier niet beter — alleen lastiger vol te houden.",
  },
  capNoteTail:  " Dat is ongeveer {kg}kg per week.",
  goalEdit:  {
    cleared: "Je streefgewicht paste niet meer bij dat doel, dus het is gewist — stel een nieuw in.",
    worthSetting: "Genoteerd. Je streefgewicht past wel niet meer bij je doel — het loont om een nieuw in te stellen.",
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
    result: "{target} rond {month} · {kcal}kcal per dag",
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
  possible: { lose: "{delta} minder? Realistisch en haalbaar!", gain: "{delta} aankomen? Realistisch en haalbaar!" },
  ageWhy: "Je stofwisseling verandert met de leeftijd, dus daar rekenen we mee",
  ontrack: {
    title: "Gemaakt om je op koers te houden",
    captions: {
      consistency: "Een gemiste dag kost niets. De volgende begint gewoon bij nul.",
      habits: "Niets is verboden. Elk bord krijgt eerlijke macro's.",
      support: "Vraag {coach} alles, wanneer je maar wilt, in Chat.",
      busy: "Eén foto is het hele logboek.",
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
    goalLose: "Doel: {delta} afvallen tegen {month}",
    goalGain: "Doel: {delta} aankomen tegen {month}",
    goalMaintain: "Doel: mijn gewicht houden",
    rest: "In rust verbrandt je lichaam", activity: "Met je activiteit ongeveer", pace: "Voor je tempo passen we aan", floor: "De grens waar we niet onder gaan", protein: "Eiwit om naar te streven",
  },
  health: {
    title: "Synchroniseren met Gezondheid",
    body: "Gewicht en activiteit komen binnen. Je maaltijden gaan naar Gezondheid.",
    connect: "Koppel Gezondheid",
    skip: "Niet nu",
  },
  targetSuggestion:  {
    down: "Ik stel {weight} voor, zo'n {pct}% eraf, een goed eerste doel",
    up: "Ik stel {weight} voor, zo'n {pct}% erbij, een goed eerste doel",
  },
  firstMeal:  FIRST_MEAL_COPY.nl,
  stepper:  { continue: "Doorgaan", less: "Minder", more: "Meer" },
  offerHeadline:  "Naar {kg}kg tegen {month}",
  planGoal: { metric: "Doel: {n}kg afvallen tegen {month}", imperial: "Doel: {n} lbs afvallen tegen {month}" },
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
    steps: ["Zrób zdjęcie talerza", "Dostań uczciwe makro", "Śledź swoje postępy"],
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
      habits: "Nic nie jest zakazane. Każdy talerz dostaje uczciwe makro.",
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
    goalLose: "Cel: schudnąć {delta} · termin: {month}",
    goalGain: "Cel: przytyć {delta} · termin: {month}",
    goalMaintain: "Cel: utrzymać wagę",
    rest: "Twoje ciało w spoczynku spala", activity: "Z twoją aktywnością około", pace: "Pod twoje tempo dostosowujemy", floor: "Próg, poniżej którego nie schodzimy", protein: "Cel białka",
  },
  health: {
    title: "Synchronizuj z aplikacją Zdrowie",
    body: "Waga i aktywność trafiają do eait. Twoje posiłki trafiają do aplikacji Zdrowie.",
    connect: "Połącz z aplikacją Zdrowie",
    skip: "Nie teraz",
  },
  targetSuggestion:  {
    down: "Proponuję {weight}, około {pct}% mniej — dobry pierwszy cel",
    up: "Proponuję {weight}, około {pct}% więcej — dobry pierwszy cel",
  },
  firstMeal:  FIRST_MEAL_COPY.pl,
  stepper:  { continue: "Dalej", less: "Mniej", more: "Więcej" },
  offerHeadline:  "Cel: {kg} kg · termin: {month}",
  planGoal: { metric: "Cel: schudnąć {n} kg · termin: {month}", imperial: "Cel: schudnąć {n} lb · termin: {month}" },
};

const TR: ChatCopy = {
  idlePlaceholder:  "Spud'a yaz…",
  continueLabel: "Devam",
  saveKept: "Kaydedilemedi. Cevabın hâlâ burada. Devam onu tekrar gönderir.",
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
    body: "Boyun için en düşük sağlıklı kilo yaklaşık {kg}kg. Bunun altında bir hedef koymayız. Bir doktorla farklı bir şey üzerinde çalışıyorsan, bu uygulamayı değil onu dinle.",
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
    gain: "Şu an {weight}kg'sın ve {target} hedefine kilo almak istedin — buradan bu bir artış değil. Amaç değiştiyse onu değiştirebiliriz; değilse bana {weight} üstünde bir sayı ver.",
    lose: "Şu an {weight}kg'sın ve {target} hedefine kilo vermek istedin — buradan bu bir düşüş değil. Amaç değiştiyse onu değiştirebiliriz; değilse bana {weight} altında bir sayı ver.",
    switchToLose: "Kilo vermeye geç",
    switchToGain: "Kilo almaya geç",
    above: "{weight} üstünde bir sayı…",
    below: "{weight} altında bir sayı…",
  },
  switched:  {
    gain: "Değiştirildi — kilo alıyoruz. kg olarak nereye varmak istersin?",
    lose: "Değiştirildi — kilo veriyoruz. kg olarak nereye varmak istersin? Burada daha hızlı daha iyi değil — sadece korunması daha zor.",
  },
  capNoteTail:  " Bu, haftada yaklaşık {kg}kg.",
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
    result: "{month} civarında {target} · günde {kcal}kcal",
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
  possible: { lose: "{delta} eksi mi? Gerçekçi ve mümkün!", gain: "{delta} almak mı? Gerçekçi ve mümkün!" },
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
    goalLose: "Amaç: {month} tarihine kadar {delta} vermek",
    goalGain: "Amaç: {month} tarihine kadar {delta} almak",
    goalMaintain: "Amaç: kilomu korumak",
    rest: "Vücudun dinlenirken yakar", activity: "Aktivitenle birlikte yaklaşık", pace: "Temposuna göre ayarlıyoruz", floor: "Geçmediğimiz alt sınır", protein: "Hedeflenecek protein",
  },
  health: {
    title: "Sağlık ile eşzamanla",
    body: "Kilo ve aktivite gelir. Öğünlerin Sağlık'a gider.",
    connect: "Sağlık'ı bağla",
    skip: "Şimdi değil",
  },
  targetSuggestion:  {
    down: "{weight} öneriyorum, yaklaşık %{pct} aşağı, iyi bir ilk hedef",
    up: "{weight} öneriyorum, yaklaşık %{pct} yukarı, iyi bir ilk hedef",
  },
  firstMeal:  FIRST_MEAL_COPY.tr,
  stepper:  { continue: "Devam", less: "Daha az", more: "Daha fazla" },
  offerHeadline:  "{month} tarihine kadar {kg}kg'a ulaş",
  planGoal: { metric: "Amaç: {month} tarihine kadar {n}kg vermek", imperial: "Amaç: {month} tarihine kadar {n} lb vermek" },
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
    connect: "連接「健康」",
    skip: "現在不要",
  },
  targetSuggestion:  {
    down: "我建議 {weight}，約減少 {pct}%，是不錯的第一個目標",
    up: "我建議 {weight}，約增加 {pct}%，是不錯的第一個目標",
  },
  firstMeal:  FIRST_MEAL_COPY["zh-Hant"],
  stepper:  { continue: "繼續", less: "減少", more: "增加" },
  offerHeadline:  "在 {month} 前達到 {kg} 公斤",
  planGoal: { metric: "目標：在 {month} 前減掉 {n} 公斤", imperial: "目標：在 {month} 前減掉 {n} lb" },
};

const ZH_HANS: ChatCopy = {
  idlePlaceholder:  "给 Spud 发消息…",
  continueLabel: "继续",
  saveKept: "无法保存。你的回答还在，点击“继续”会再次发送。",
  underAgeCard:  {
    title: "eait 仅供{age}岁及以上人士使用",
    body: "本应用设定热量目标的方式，并不适用于仍在生长发育的身体。",
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
    body: "按你的身高，最低健康体重约为{kg}公斤。我们不会设定低于此值的目标。如果你正在和医生一起朝其他方向努力，请听从医生的建议，而不是本应用。",
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
    steps: ["拍下餐盘", "获得如实的营养数据", "查看你的进度"],
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
      habits: "没有禁止的食物。每一盘都有如实的营养数据。",
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
    connect: "连接“健康”",
    skip: "以后再说",
  },
  targetSuggestion:  {
    down: "我建议{weight}，约减少{pct}%，是不错的第一个目标",
    up: "我建议{weight}，约增加{pct}%，是不错的第一个目标",
  },
  firstMeal:  FIRST_MEAL_COPY["zh-Hans"],
  stepper:  { continue: "继续", less: "减少", more: "增加" },
  offerHeadline:  "预计{month}达到{kg}公斤",
  planGoal: { metric: "目标：减掉{n}公斤，预计{month}", imperial: "目标：减掉{n}lb，预计{month}" },
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
    note: "계획에 이 점을 반영해요.",
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
    twoWays: "시간에 따른 체중을 두 가지로 그렸어요: 계획이 있을 때와 없을 때",
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
    rest: "휴식 중 몸이 쓰는 에너지", activity: "활동량을 더하면 약", pace: "속도에 맞춘 조정", floor: "넘지 않는 최저선", protein: "단백질 목표",
  },
  health: {
    title: "건강 앱과 동기화",
    body: "체중과 활동은 가져오고, 식사는 건강 앱으로 보내요.",
    connect: "건강 앱 연결",
    skip: "나중에",
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
    meal: "サーモン、ご飯、青菜",
    photoAlt: "ファインダーに映るグレインボウル",
    steps: ["お皿を撮影", "正直なPFCを確認", "進捗を見る"],
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
  possible: { lose: "{delta}少なく？現実的で、達成できます！", gain: "{delta}増やす？現実的で、達成できます！" },
  ageWhy: "代謝は年齢とともに変わるので、それも計算に入れます",
  ontrack: {
    title: "続けやすい仕組み",
    captions: {
      consistency: "1日抜けても問題なし。次の日はゼロから始まります。",
      habits: "禁止の食べ物はありません。どのお皿にも正直なPFCを。",
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
    rest: "安静時に体が消費するのは", activity: "活動量を含めると約", pace: "ペースに合わせた調整", floor: "これ以上は下げない下限", protein: "目指したいたんぱく質",
  },
  health: {
    title: "ヘルスケアと同期",
    body: "体重とアクティビティを取り込み、食事をヘルスケアに書き込みます。",
    connect: "ヘルスケアと連携",
    skip: "あとで",
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
    cleared: "Seu peso-alvo não combinava mais com essa meta, então foi apagado — defina um novo.",
    worthSetting: "Registrado. Mas seu peso-alvo não combina mais com sua meta — vale definir um novo.",
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
    connect: "Conectar ao app Saúde",
    skip: "Agora não",
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

export const CHAT_COPY: Localized<ChatCopy> = { en: EN, fr: FR, de: DE, it: IT, es: ES, vi: VI, id: ID, ru: RU, nl: NL, pl: PL, tr: TR, "zh-Hant": ZH_HANT, "zh-Hans": ZH_HANS, ko: KO, ja: JA, "pt-BR": PT_BR };

/** What Spud says back, in one language. English for one nobody has written yet. */
export const chatCopyFor = (lang: Lang): ChatCopy => t(lang)(CHAT_COPY);
