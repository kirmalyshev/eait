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

import { t, type Localized } from "./lang.ts";
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
  target: { lowest: string; now: string; deltaDown: string; deltaUp: string };
  /**
   * The pace screen's numbers and the marker its result owes. `{rate}` is the projection's
   * kgPerWeek formatted with its unit ("0.4 kg" / "0.9 lb") — never the pace's requested rate;
   * `{floor}` is the computed floor. `capMarker`/`floorMarker` are the one small line under it.
   */
  pace: {
    rate: string;
    /** `{target}` with unit, `{month}` CLDR's, `{kcal}` the computed number. */
    result: string;
    capMarker: string;
    floorMarker: string;
  };
  /** The "whole app" beat after the goal — three beats and nothing to answer. */
  how: { title: string; steps: [string, string, string] };
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
   * The target prompt's suggestion line: `{kg}` the suggested weight, `{pct}` the whole percent
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
    body: "The lowest healthy weight for your height is about {kg} kg. We won't set a goal below it. If you're working with a doctor on something different, follow them rather than this app.",
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
    gain: "You're at {weight} kg and asked to gain to {target} — that's not a gain from here. If the goal changed, we can switch it; otherwise give me a number above {weight}.",
    lose: "You're at {weight} kg and asked to lose to {target} — that's not a loss from here. If the goal changed, we can switch it; otherwise give me a number below {weight}.",
    switchToLose: "Switch to losing",
    switchToGain: "Switch to gaining",
    above: "A number above {weight}…",
    below: "A number below {weight}…",
  },
  switched:  {
    gain: "Switched — gaining it is. Where would you like to be, in kg?",
    lose: "Switched — losing it is. Where would you like to be, in kg? Faster isn't better here — it's just harder to keep.",
  },
  capNoteTail:  " That's about {kg} kg a week.",
  goalEdit:  {
    cleared: "Your target weight no longer fitted that goal, so it's cleared — set a new one.",
    worthSetting: "Recorded. Your target weight no longer fits your goal, though — worth setting a new one.",
  },
  target: {
    // "55 · lowest we set" under the range's floor, "74 · now" beside today, "− 6 kg" the
    // answer's distance from it.
    lowest: "{weight} · lowest we set",
    now: "{weight} · now",
    deltaDown: "− {weight}",
    deltaUp: "+ {weight}",
  },
  pace: {
    rate: "{rate} a week",
    result: "{target} around {month} · {kcal} kcal a day",
    capMarker: "capped at the safe limit",
    floorMarker: "never below {floor} · every pace lands here",
  },
  how: {
    title: "Here's the whole app",
    steps: ["Photograph the plate", "Get an honest verdict", "See your progress"],
  },
  ontrack: {
    title: "Built to keep you on track",
    captions: {
      consistency: "A missed day costs nothing. The next one starts at zero.",
      habits: "Nothing is banned. Every plate gets an honest verdict.",
      support: "Ask Spud anything, any time, in Chat.",
      busy: "One photo is the whole log.",
      ideas: "Stuck for dinner? Ask Spud what fits what's left.",
    },
  },
  chart: {
    byEait: "eait analysis",
    weightTrend: "Weight trend",
    without: "Without",
    now: "Now",
    later: "Later",
    twoWays: "Weight over time, drawn two ways: with a plan and without",
    estimatedProgress: "Estimated progress",
    estimate: "Estimate",
    target: "Target {weight}",
    monthEstimate: "{month} · estimate",
  },
  plan: {
    goalLose: "Goal: lose {delta} by {month}",
    goalGain: "Goal: gain {delta} by {month}",
    goalMaintain: "Goal: keep my weight",
    rest: "Your body at rest burns", activity: "With your activity, about", pace: "For your pace, we adjust", floor: "The floor we won’t cross", protein: "Protein to aim for",
  },
  health: {
    title: "Sync with Apple Health",
    body: "Weight and activity in, meals out.",
    connect: "Connect Apple Health",
    skip: "Not now",
  },
  targetSuggestion:  {
    down: "I suggest {kg} kg, about {pct}% down, a good first goal",
    up: "I suggest {kg} kg, about {pct}% up, a good first goal",
  },
  firstMeal:  FIRST_MEAL_COPY.en,
  stepper:  { continue: "Continue", less: "Less", more: "More" },
  offerHeadline:  "Get to {kg} kg by {month}",
  planGoal: { metric: "Goal: lose {n} kg by {month}", imperial: "Goal: lose {n} lbs by {month}" },
};

const FR: ChatCopy = {
  idlePlaceholder:  "Écrire à Spud…",
  continueLabel: "Continuer",
  underAgeCard:  {
    title: "eait, c'est à partir de {age} ans",
    body: "La façon dont cette appli fixe les objectifs caloriques n'est pas conçue pour un corps qui grandit encore.",
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
    body: "Le poids sain le plus bas pour ta taille est d'environ {kg} kg. On ne fixera pas d'objectif en dessous. Si tu suis un autre objectif avec un médecin, écoute-le plutôt que cette appli.",
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
    gain: "Tu es à {weight} kg et tu demandes à monter jusqu'à {target} — ce n'est pas une hausse par rapport à aujourd'hui. Si ton objectif a changé, on peut le modifier ; sinon, donne-moi un nombre au-dessus de {weight}.",
    lose: "Tu es à {weight} kg et tu demandes à descendre jusqu'à {target} — ce n'est pas une baisse par rapport à aujourd'hui. Si ton objectif a changé, on peut le modifier ; sinon, donne-moi un nombre en dessous de {weight}.",
    switchToLose: "Je veux perdre",
    switchToGain: "Je veux prendre",
    above: "Un nombre au-dessus de {weight}…",
    below: "Un nombre en dessous de {weight}…",
  },
  switched:  {
    gain: "Va pour la prise de poids. Où aimerais-tu arriver, en kg ?",
    lose: "D'accord, on vise plus bas. Où aimerais-tu arriver, en kg ? Ici, aller plus vite n'aide pas — c'est juste plus dur à tenir.",
  },
  capNoteTail:  " Ça fait environ {kg} kg par semaine.",
  goalEdit:  {
    cleared: "Ton poids cible ne collait plus à cet objectif, il est donc effacé — choisis-en un nouveau.",
    worthSetting: "Enregistré. Ton poids cible ne colle plus à ton objectif, cela dit — ça vaut le coup d'en fixer un nouveau.",
  },
  target: {
    lowest: "{weight} · le plus bas qu'on fixe",
    now: "{weight} · maintenant",
    deltaDown: "− {weight}",
    deltaUp: "+ {weight}",
  },
  pace: {
    rate: "{rate} par semaine",
    result: "{target} vers {month} · {kcal} kcal par jour",
    capMarker: "plafonné à la limite sûre",
    floorMarker: "jamais sous {floor} · chaque rythme y arrive",
  },
  how: {
    title: "Voilà toute l'app",
    steps: ["Photographie ton assiette", "Reçois un verdict honnête", "Suis ta progression"],
  },
  ontrack: {
    title: "Fait pour te garder en route",
    captions: {
      consistency: "Un jour raté ne coûte rien. Le suivant repart de zéro.",
      habits: "Rien n'est interdit. Chaque assiette a un verdict honnête.",
      support: "Demande à Spud, quand tu veux, dans le Chat.",
      busy: "Une photo, et le repas est noté.",
      ideas: "En panne d'idées pour le dîner ? Spud trouve ce qui rentre.",
    },
  },
  chart: {
    byEait: "eait analysis",
    weightTrend: "Tendance du poids",
    without: "Sans",
    now: "Maintenant",
    later: "Plus tard",
    twoWays: "Évolution du poids, dessinée deux fois : avec un plan et sans",
    estimatedProgress: "Progression estimée",
    estimate: "Estimation",
    target: "Cible {weight}",
    monthEstimate: "{month} · estimation",
  },
  plan: {
    goalLose: "Objectif : perdre {delta} d'ici {month}",
    goalGain: "Objectif : prendre {delta} d'ici {month}",
    goalMaintain: "Objectif : garder mon poids",
    rest: "Au repos, ton corps brûle", activity: "Avec ton activité, environ", pace: "Pour ton rythme, on ajuste", floor: "Le plancher qu’on ne franchit pas", protein: "Protéines à viser",
  },
  health: {
    title: "Synchroniser avec Apple Health",
    body: "Poids et activité entrent, les repas restent dehors.",
    connect: "Connecter Apple Health",
    skip: "Pas maintenant",
  },
  targetSuggestion:  {
    down: "Je te propose {kg} kg, soit environ {pct} % de moins — un bon premier objectif",
    up: "Je te propose {kg} kg, soit environ {pct} % de plus — un bon premier objectif",
  },
  firstMeal:  FIRST_MEAL_COPY.fr,
  stepper:  { continue: "Continuer", less: "Moins", more: "Plus" },
  offerHeadline:  "Atteindre {kg} kg d'ici {month}",
  planGoal: { metric: "Objectif : perdre {n} kg d'ici {month}", imperial: "Objectif : perdre {n} lb d'ici {month}" },
};

const DE: ChatCopy = {
  idlePlaceholder:  "Nachricht an Spud…",
  continueLabel: "Weiter",
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
    body: "Das niedrigste gesunde Gewicht für deine Größe liegt bei etwa {kg} kg. Darunter setzen wir kein Ziel. Wenn du mit einer Ärztin an etwas anderem arbeitest, folge ihr und nicht dieser App.",
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
    gain: "Du bist bei {weight} kg und willst auf {target} zunehmen — von hier aus ist das keine Zunahme. Wenn sich das Ziel geändert hat, stellen wir um; sonst gib mir eine Zahl über {weight}.",
    lose: "Du bist bei {weight} kg und willst auf {target} abnehmen — von hier aus ist das keine Abnahme. Wenn sich das Ziel geändert hat, stellen wir um; sonst gib mir eine Zahl unter {weight}.",
    switchToLose: "Auf Abnehmen umstellen",
    switchToGain: "Auf Zunehmen umstellen",
    above: "Eine Zahl über {weight}…",
    below: "Eine Zahl unter {weight}…",
  },
  switched:  {
    gain: "Umgestellt — zunehmen also. Wo möchtest du landen, in kg?",
    lose: "Umgestellt — abnehmen also. Wo möchtest du landen, in kg? Schneller ist hier nicht besser — nur schwerer zu halten.",
  },
  capNoteTail:  " Das sind etwa {kg} kg pro Woche.",
  goalEdit:  {
    cleared: "Dein Zielgewicht passte nicht mehr zu diesem Ziel, also ist es gelöscht — setz ein neues.",
    worthSetting: "Aufgenommen. Dein Zielgewicht passt allerdings nicht mehr zu deinem Ziel — es lohnt sich, ein neues zu setzen.",
  },
  target: {
    lowest: "{weight} · unser Minimum",
    now: "{weight} · jetzt",
    deltaDown: "− {weight}",
    deltaUp: "+ {weight}",
  },
  pace: {
    rate: "{rate} pro Woche",
    result: "{target} um {month} · {kcal} kcal am Tag",
    capMarker: "auf die sichere Grenze gekappt",
    floorMarker: "nie unter {floor} · jedes Tempo landet hier",
  },
  how: {
    title: "Das ist die ganze App",
    steps: ["Fotografier den Teller", "Bekomm ein ehrliches Urteil", "Sieh deinen Fortschritt"],
  },
  ontrack: {
    title: "Gemacht, damit du dranbleibst",
    captions: {
      consistency: "Ein verpasster Tag kostet nichts. Der nächste fängt bei null an.",
      habits: "Nichts ist verboten. Jeder Teller bekommt ein ehrliches Urteil.",
      support: "Frag Spud, wann immer du willst, im Chat.",
      busy: "Ein Foto ist der ganze Eintrag.",
      ideas: "Keine Idee fürs Abendessen? Spud sagt, was noch reinpasst.",
    },
  },
  chart: {
    byEait: "eait analysis",
    weightTrend: "Gewichtstrend",
    without: "Ohne",
    now: "Jetzt",
    later: "Später",
    twoWays: "Gewicht über die Zeit, zweimal gezeichnet: mit Plan und ohne",
    estimatedProgress: "Geschätzter Fortschritt",
    estimate: "Schätzung",
    target: "Ziel {weight}",
    monthEstimate: "{month} · Schätzung",
  },
  plan: {
    goalLose: "Ziel: {delta} abnehmen bis {month}",
    goalGain: "Ziel: {delta} zunehmen bis {month}",
    goalMaintain: "Ziel: mein Gewicht halten",
    rest: "In Ruhe verbrennt dein Körper", activity: "Mit deiner Aktivität etwa", pace: "Für dein Tempo rechnen wir", floor: "Die Grenze, die wir nicht unterschreiten", protein: "Eiweiß als Ziel",
  },
  health: {
    title: "Mit Apple Health synchronisieren",
    body: "Gewicht und Aktivität kommen rein, Mahlzeiten gehen nicht raus.",
    connect: "Apple Health verbinden",
    skip: "Nicht jetzt",
  },
  targetSuggestion:  {
    down: "Ich schlage {kg} kg vor, etwa {pct}% weniger — ein gutes erstes Ziel",
    up: "Ich schlage {kg} kg vor, etwa {pct}% mehr — ein gutes erstes Ziel",
  },
  firstMeal:  FIRST_MEAL_COPY.de,
  stepper:  { continue: "Weiter", less: "Weniger", more: "Mehr" },
  offerHeadline:  "{kg} kg bis {month}",
  planGoal: { metric: "Ziel: bis {month} {n} kg abnehmen", imperial: "Ziel: bis {month} {n} lb abnehmen" },
};

const IT: ChatCopy = {
  idlePlaceholder:  "Scrivi a Spud…",
  continueLabel: "Continua",
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
    body: "Il peso sano più basso per la tua altezza è circa {kg} kg. Sotto quello non fissiamo obiettivi. Se stai seguendo altro con un medico, segui lui e non questa app.",
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
    gain: "Sei a {weight} kg e chiedi di salire a {target} — da qui non è una crescita. Se l'obiettivo è cambiato possiamo invertirlo; altrimenti dammi un numero sopra {weight}.",
    lose: "Sei a {weight} kg e chiedi di scendere a {target} — da qui non è un calo. Se l'obiettivo è cambiato possiamo invertirlo; altrimenti dammi un numero sotto {weight}.",
    switchToLose: "Passa a perdere peso",
    switchToGain: "Passa a prendere peso",
    above: "Un numero sopra {weight}…",
    below: "Un numero sotto {weight}…",
  },
  switched:  {
    gain: "Invertito — si prende peso, allora. Dove ti piacerebbe arrivare, in kg?",
    lose: "Invertito — si perde peso, allora. Dove ti piacerebbe arrivare, in kg? Più veloce qui non è meglio — è solo più difficile da mantenere.",
  },
  capNoteTail:  " Fa circa {kg} kg a settimana.",
  goalEdit:  {
    cleared: "Il tuo peso obiettivo non corrispondeva più a quell'obiettivo, quindi è stato azzerato — impostane uno nuovo.",
    worthSetting: "Registrato. Il tuo peso obiettivo però non corrisponde più al tuo obiettivo — vale la pena impostarne uno nuovo.",
  },
  target: {
    lowest: "{weight} · il minimo che fissiamo",
    now: "{weight} · ora",
    deltaDown: "− {weight}",
    deltaUp: "+ {weight}",
  },
  pace: {
    rate: "{rate} a settimana",
    result: "{target} verso {month} · {kcal} kcal al giorno",
    capMarker: "limitato al valore di sicurezza",
    floorMarker: "mai sotto {floor} · ogni ritmo arriva qui",
  },
  how: {
    title: "Ecco tutta l'app",
    steps: ["Fotografa il piatto", "Ricevi un verdetto onesto", "Guarda i tuoi progressi"],
  },
  ontrack: {
    title: "Fatta per tenerti in carreggiata",
    captions: {
      consistency: "Un giorno saltato non costa niente. Il prossimo riparte da zero.",
      habits: "Niente è vietato. Ogni piatto riceve un verdetto onesto.",
      support: "Chiedi a Spud, quando vuoi, in Chat.",
      busy: "Una foto è tutto il diario.",
      ideas: "Senza idee per cena? Spud trova cosa ci sta.",
    },
  },
  chart: {
    byEait: "eait analysis",
    weightTrend: "Andamento del peso",
    without: "Senza",
    now: "Ora",
    later: "Dopo",
    twoWays: "Peso nel tempo, disegnato due volte: con un piano e senza",
    estimatedProgress: "Progressi stimati",
    estimate: "Stima",
    target: "Obiettivo {weight}",
    monthEstimate: "{month} · stima",
  },
  plan: {
    goalLose: "Obiettivo: perdere {delta} entro {month}",
    goalGain: "Obiettivo: prendere {delta} entro {month}",
    goalMaintain: "Obiettivo: mantenere il mio peso",
    rest: "A riposo il tuo corpo brucia", activity: "Con la tua attività, circa", pace: "Per il tuo ritmo, correggiamo", floor: "Il limite che non superiamo", protein: "Proteine da raggiungere",
  },
  health: {
    title: "Sincronizza con Apple Health",
    body: "Peso e attività entrano, i pasti restano fuori.",
    connect: "Connetti Apple Health",
    skip: "Non ora",
  },
  targetSuggestion:  {
    down: "Ti suggerisco {kg} kg, circa il {pct}% in meno — un buon primo obiettivo",
    up: "Ti suggerisco {kg} kg, circa il {pct}% in più — un buon primo obiettivo",
  },
  firstMeal:  FIRST_MEAL_COPY.it,
  stepper:  { continue: "Continua", less: "Meno", more: "Più" },
  offerHeadline:  "Arrivare a {kg} kg entro {month}",
  planGoal: { metric: "Obiettivo: perdere {n} kg entro {month}", imperial: "Obiettivo: perdere {n} lb entro {month}" },
};

const ES: ChatCopy = {
  idlePlaceholder:  "Escribe a Spud…",
  continueLabel: "Continuar",
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
    body: "El peso saludable más bajo para tu altura es de unos {kg} kg. No fijamos objetivos por debajo. Si estás trabajando otra cosa con un médico, hazle caso a él y no a esta app.",
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
    gain: "Estás en {weight} kg y pides subir hasta {target} — desde aquí eso no es subir. Si el objetivo ha cambiado, lo cambiamos; si no, dame un número por encima de {weight}.",
    lose: "Estás en {weight} kg y pides bajar hasta {target} — desde aquí eso no es bajar. Si el objetivo ha cambiado, lo cambiamos; si no, dame un número por debajo de {weight}.",
    switchToLose: "Cambiar a perder peso",
    switchToGain: "Cambiar a ganar peso",
    above: "Un número por encima de {weight}…",
    below: "Un número por debajo de {weight}…",
  },
  switched:  {
    gain: "Cambiado — ganar, entonces. ¿Dónde te gustaría llegar, en kg?",
    lose: "Cambiado — perder, entonces. ¿Dónde te gustaría llegar, en kg? Más rápido no es mejor aquí — solo es más difícil de sostener.",
  },
  capNoteTail:  " Eso son unos {kg} kg por semana.",
  goalEdit:  {
    cleared: "Tu peso objetivo ya no encajaba con ese objetivo, así que se ha borrado — pon uno nuevo.",
    worthSetting: "Registrado. Eso sí, tu peso objetivo ya no encaja con tu objetivo — merece la pena poner uno nuevo.",
  },
  target: {
    lowest: "{weight} · el mínimo que fijamos",
    now: "{weight} · ahora",
    deltaDown: "− {weight}",
    deltaUp: "+ {weight}",
  },
  pace: {
    rate: "{rate} a la semana",
    result: "{target} hacia {month} · {kcal} kcal al día",
    capMarker: "limitado al tope seguro",
    floorMarker: "nunca por debajo de {floor} · cada ritmo llega aquí",
  },
  how: {
    title: "Esa es toda la app",
    steps: ["Fotografía el plato", "Recibe un veredicto honesto", "Ve tu progreso"],
  },
  ontrack: {
    title: "Hecha para que no te salgas",
    captions: {
      consistency: "Un día fallado no cuesta nada. El siguiente empieza de cero.",
      habits: "Nada está prohibido. Cada plato recibe un veredicto honesto.",
      support: "Pregúntale a Spud lo que sea, cuando sea, en el Chat.",
      busy: "Una foto es todo el registro.",
      ideas: "¿Sin ideas para cenar? Spud te dice qué cabe.",
    },
  },
  chart: {
    byEait: "eait analysis",
    weightTrend: "Tendencia del peso",
    without: "Sin",
    now: "Ahora",
    later: "Después",
    twoWays: "Peso a lo largo del tiempo, dibujado dos veces: con un plan y sin él",
    estimatedProgress: "Progreso estimado",
    estimate: "Estimación",
    target: "Meta {weight}",
    monthEstimate: "{month} · estimación",
  },
  plan: {
    goalLose: "Meta: perder {delta} para {month}",
    goalGain: "Meta: ganar {delta} para {month}",
    goalMaintain: "Meta: mantener mi peso",
    rest: "En reposo tu cuerpo quema", activity: "Con tu actividad, unas", pace: "Para tu ritmo, ajustamos", floor: "El mínimo del que no bajamos", protein: "Proteína objetivo",
  },
  health: {
    title: "Sincronizar con Apple Health",
    body: "Peso y actividad entran, las comidas no salen.",
    connect: "Conectar Apple Health",
    skip: "Ahora no",
  },
  targetSuggestion:  {
    down: "Te sugiero {kg} kg, alrededor de un {pct}% menos — una buena primera meta",
    up: "Te sugiero {kg} kg, alrededor de un {pct}% más — una buena primera meta",
  },
  firstMeal:  FIRST_MEAL_COPY.es,
  stepper:  { continue: "Continuar", less: "Menos", more: "Más" },
  offerHeadline:  "Llegar a {kg} kg en {month}",
  planGoal: { metric: "Objetivo: bajar {n} kg para {month}", imperial: "Objetivo: bajar {n} lb para {month}" },
};

const VI: ChatCopy = {
  idlePlaceholder:  "Nhắn cho Spud…",
  continueLabel: "Tiếp tục",
  underAgeCard:  {
    title: "eait dành cho {age} tuổi trở lên",
    body: "Cách ứng dụng này đặt mục tiêu calo không được thiết kế cho một cơ thể vẫn đang lớn.",
  },
  underAge:  {
    ask: "Xin lỗi — mình phải dừng ở đây. Nếu chỉ là gõ nhầm, bạn gửi lại tuổi thật nhé.",
    confirm: "Đó là tuổi thật của tôi",
    placeholder: "Tuổi của bạn",
    stopped: [
      "Vậy thì chúng mình dừng ở đây. Mình đang xoá mọi điều bạn đã kể.",
      "Quay lại khi {age} tuổi nhé, mình vẫn ở đây.",
    ],
    endedPlaceholder: "eait dành cho {age} tuổi trở lên",
  },
  belowHealthy:  {
    title: "Mình không đặt được mức đó làm mục tiêu",
    body: "Cân nặng khoẻ mạnh thấp nhất với chiều cao của bạn là khoảng {kg} kg. Chúng mình không đặt mục tiêu dưới mức đó. Nếu bạn đang theo một hướng khác cùng bác sĩ, hãy nghe bác sĩ chứ đừng nghe ứng dụng này.",
  },
  invalid:  {
    age: "Cái đó trông không giống một số tuổi — thử kiểu như 34 xem.",
    height_cm: "Tính bằng cm — kiểu như 175.",
    weight_kg: "Tính bằng kg — áng chừng là được.",
    target_weight_kg: "Một số tính bằng kg — ví dụ 70.",
  },
  ambiguousAge:  {
    line: "Mình muốn chắc là đọc đúng — nếu ý bạn là năm {year}, gửi đủ bốn chữ số nhé.",
    confirm: "Tôi {age} tuổi",
  },
  direction:  {
    gain: "Bạn đang ở {weight} kg mà lại muốn tăng lên {target} — từ đây thì đó không phải là tăng. Nếu mục tiêu đã đổi, chúng mình đổi theo; còn không thì cho mình một số trên {weight}.",
    lose: "Bạn đang ở {weight} kg mà lại muốn giảm xuống {target} — từ đây thì đó không phải là giảm. Nếu mục tiêu đã đổi, chúng mình đổi theo; còn không thì cho mình một số dưới {weight}.",
    switchToLose: "Chuyển sang giảm cân",
    switchToGain: "Chuyển sang tăng cân",
    above: "Một số trên {weight}…",
    below: "Một số dưới {weight}…",
  },
  switched:  {
    gain: "Đã chuyển — vậy là tăng cân. Bạn muốn về mức nào, tính bằng kg?",
    lose: "Đã chuyển — vậy là giảm cân. Bạn muốn về mức nào, tính bằng kg? Nhanh hơn không có nghĩa là tốt hơn — chỉ khó giữ hơn thôi.",
  },
  capNoteTail:  " Tính ra khoảng {kg} kg mỗi tuần.",
  goalEdit:  {
    cleared: "Cân nặng mục tiêu của bạn không còn hợp với mục tiêu đó nữa nên đã được xoá — đặt lại một mức mới nhé.",
    worthSetting: "Đã ghi. Có điều cân nặng mục tiêu của bạn không còn hợp với mục tiêu nữa — nên đặt lại một mức mới.",
  },
  target: {
    lowest: "{weight} · mức thấp nhất chúng tôi đặt",
    now: "{weight} · hiện tại",
    deltaDown: "− {weight}",
    deltaUp: "+ {weight}",
  },
  pace: {
    rate: "{rate} một tuần",
    result: "{target} vào khoảng {month} · {kcal} kcal một ngày",
    capMarker: "đã giới hạn ở mức an toàn",
    floorMarker: "không bao giờ dưới {floor} · mọi tốc độ đều đến đây",
  },
  how: {
    title: "Đó là toàn bộ ứng dụng",
    steps: ["Chụp món ăn", "Nhận đánh giá trung thực", "Xem tiến triển của bạn"],
  },
  ontrack: {
    title: "Được làm ra để giữ bạn đi đúng hướng",
    captions: {
      consistency: "Một ngày lỡ không mất gì. Ngày tiếp theo bắt đầu từ số không.",
      habits: "Không món nào bị cấm. Mỗi đĩa đều nhận một đánh giá trung thực.",
      support: "Hỏi Spud bất cứ điều gì, bất cứ lúc nào, trong Chat.",
      busy: "Một tấm ảnh là cả bản ghi.",
      ideas: "Bí ý tưởng cho bữa tối? Hỏi Spud xem cái gì vừa với phần còn lại.",
    },
  },
  chart: {
    byEait: "eait analysis",
    weightTrend: "Xu hướng cân nặng",
    without: "Không dùng",
    now: "Hiện tại",
    later: "Về sau",
    twoWays: "Cân nặng theo thời gian, vẽ hai cách: có kế hoạch và không",
    estimatedProgress: "Tiến triển ước tính",
    estimate: "Ước tính",
    target: "Mục tiêu {weight}",
    monthEstimate: "{month} · ước tính",
  },
  plan: {
    goalLose: "Mục tiêu: giảm {delta} đến {month}",
    goalGain: "Mục tiêu: tăng {delta} đến {month}",
    goalMaintain: "Mục tiêu: giữ cân nặng",
    rest: "Lúc nghỉ, cơ thể bạn đốt", activity: "Với mức vận động của bạn, khoảng", pace: "Điều chỉnh theo nhịp độ của bạn", floor: "Mức sàn không vượt qua", protein: "Đạm cần hướng tới",
  },
  health: {
    title: "Đồng bộ với Apple Health",
    body: "Cân nặng và vận động đi vào, bữa ăn không đi ra.",
    connect: "Kết nối Apple Health",
    skip: "Để sau",
  },
  targetSuggestion:  {
    down: "Mình gợi ý {kg} kg, tức xuống khoảng {pct}% — một mục tiêu đầu tiên hợp lý",
    up: "Mình gợi ý {kg} kg, tức lên khoảng {pct}% — một mục tiêu đầu tiên hợp lý",
  },
  firstMeal:  FIRST_MEAL_COPY.vi,
  stepper:  { continue: "Tiếp tục", less: "Bớt", more: "Thêm" },
  offerHeadline:  "Đạt {kg} kg vào {month}",
  planGoal: { metric: "Mục tiêu: giảm {n} kg vào {month}", imperial: "Mục tiêu: giảm {n} lb vào {month}" },
};

const ID: ChatCopy = {
  idlePlaceholder:  "Kirim pesan ke Spud…",
  continueLabel: "Lanjutkan",
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
    body: "Berat sehat terendah untuk tinggimu sekitar {kg} kg. Kami tidak menetapkan tujuan di bawah itu. Kalau kamu sedang menjalani hal lain bersama dokter, ikuti dokternya, bukan aplikasi ini.",
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
    gain: "Kamu di {weight} kg dan minta naik ke {target} — dari sini itu bukan kenaikan. Kalau tujuannya berubah, kita bisa ganti; kalau tidak, beri aku angka di atas {weight}.",
    lose: "Kamu di {weight} kg dan minta turun ke {target} — dari sini itu bukan penurunan. Kalau tujuannya berubah, kita bisa ganti; kalau tidak, beri aku angka di bawah {weight}.",
    switchToLose: "Ganti ke menurunkan",
    switchToGain: "Ganti ke menaikkan",
    above: "Angka di atas {weight}…",
    below: "Angka di bawah {weight}…",
  },
  switched:  {
    gain: "Diganti — jadi menaikkan. Kamu ingin sampai di angka berapa, dalam kg?",
    lose: "Diganti — jadi menurunkan. Kamu ingin sampai di angka berapa, dalam kg? Lebih cepat bukan berarti lebih baik — hanya lebih sulit dijaga.",
  },
  capNoteTail:  " Itu sekitar {kg} kg per minggu.",
  goalEdit:  {
    cleared: "Berat targetmu sudah tidak cocok dengan tujuan itu, jadi dihapus — tetapkan yang baru.",
    worthSetting: "Tercatat. Tapi berat targetmu sudah tidak cocok dengan tujuanmu — sebaiknya tetapkan yang baru.",
  },
  target: {
    lowest: "{weight} · batas terendah kami",
    now: "{weight} · sekarang",
    deltaDown: "− {weight}",
    deltaUp: "+ {weight}",
  },
  pace: {
    rate: "{rate} seminggu",
    result: "{target} sekitar {month} · {kcal} kcal sehari",
    capMarker: "dibatasi ke batas aman",
    floorMarker: "tidak pernah di bawah {floor} · semua tempo sampai di sini",
  },
  how: {
    title: "Itulah seluruh aplikasinya",
    steps: ["Foto piringnya", "Dapatkan penilaian jujur", "Lihat progresmu"],
  },
  ontrack: {
    title: "Dibuat agar kamu tetap di jalur",
    captions: {
      consistency: "Satu hari kelewat tidak memakan apa-apa. Hari berikutnya mulai dari nol.",
      habits: "Tidak ada yang dilarang. Setiap piring mendapat penilaian jujur.",
      support: "Tanya Spud apa saja, kapan saja, di Chat.",
      busy: "Satu foto adalah seluruh catatan.",
      ideas: "Bingung mau makan malam apa? Tanya Spud apa yang masih muat.",
    },
  },
  chart: {
    byEait: "eait analysis",
    weightTrend: "Tren berat badan",
    without: "Tanpa",
    now: "Sekarang",
    later: "Nanti",
    twoWays: "Berat badan dari waktu ke waktu, digambar dua cara: dengan rencana dan tanpa",
    estimatedProgress: "Perkiraan progres",
    estimate: "Perkiraan",
    target: "Target {weight}",
    monthEstimate: "{month} · perkiraan",
  },
  plan: {
    goalLose: "Target: turun {delta} menjelang {month}",
    goalGain: "Target: naik {delta} menjelang {month}",
    goalMaintain: "Target: pertahankan berat badan saya",
    rest: "Saat istirahat tubuhmu membakar", activity: "Dengan aktivitasmu, sekitar", pace: "Untuk tempomu, kami sesuaikan", floor: "Batas bawah yang tidak dilewati", protein: "Target protein",
  },
  health: {
    title: "Sinkronkan dengan Apple Health",
    body: "Berat badan dan aktivitas masuk, makanan tidak keluar.",
    connect: "Hubungkan Apple Health",
    skip: "Nanti saja",
  },
  targetSuggestion:  {
    down: "Kusarankan {kg} kg, turun sekitar {pct}% — target pertama yang bagus",
    up: "Kusarankan {kg} kg, naik sekitar {pct}% — target pertama yang bagus",
  },
  firstMeal:  FIRST_MEAL_COPY.id,
  stepper:  { continue: "Lanjut", less: "Kurangi", more: "Tambah" },
  offerHeadline:  "Capai {kg} kg pada {month}",
  planGoal: { metric: "Target: turun {n} kg pada {month}", imperial: "Target: turun {n} lb pada {month}" },
};

const RU: ChatCopy = {
  idlePlaceholder:  "Написать Spud…",
  continueLabel: "Продолжить",
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
    body: "Самый низкий здоровый вес для твоего роста — около {kg} кг. Ниже мы цель не ставим. Если ты работаешь над чем-то другим с врачом, слушай его, а не это приложение.",
  },
  invalid:  {
    age: "На возраст не похоже — попробуй что-то вроде 34.",
    height_cm: "В сантиметрах — что-то вроде 175.",
    weight_kg: "В килограммах — примерно нормально.",
    target_weight_kg: "Число в кг — например 70.",
  },
  ambiguousAge:  {
    line: "Хочу убедиться, что понял правильно: если речь про {year} год, пришли все четыре цифры.",
    confirm: "Мне {age}",
  },
  direction:  {
    gain: "Ты на {weight} кг и просишь набрать до {target} — отсюда это не набор. Если цель поменялась, можем переключить; иначе дай число больше {weight}.",
    lose: "Ты на {weight} кг и просишь сбросить до {target} — отсюда это не сброс. Если цель поменялась, можем переключить; иначе дай число меньше {weight}.",
    switchToLose: "Переключить на похудение",
    switchToGain: "Переключить на набор",
    above: "Число больше {weight}…",
    below: "Число меньше {weight}…",
  },
  switched:  {
    gain: "Переключил — значит набираем. Куда хочешь прийти, в кг?",
    lose: "Переключил — значит худеем. Куда хочешь прийти, в кг? Быстрее здесь не значит лучше — просто труднее удержать.",
  },
  capNoteTail:  " Это примерно {kg} кг в неделю.",
  goalEdit:  {
    cleared: "Твой целевой вес больше не подходил к этой цели, поэтому он сброшен — поставь новый.",
    worthSetting: "Записал. Правда, целевой вес больше не сходится с твоей целью — стоит поставить новый.",
  },
  target: {
    lowest: "{weight} · минимум, который мы задаём",
    now: "{weight} · сейчас",
    deltaDown: "− {weight}",
    deltaUp: "+ {weight}",
  },
  pace: {
    rate: "{rate} в неделю",
    // The month stays NOMINATIVE ("это примерно январь 2027"), like the old projection line —
    // CLDR gives us no declension to put after «к».
    result: "{target} — примерно {month} · {kcal} ккал в день",
    capMarker: "ограничено безопасным пределом",
    floorMarker: "никогда ниже {floor} · любой темп приходит сюда",
  },
  how: {
    title: "Вот и вся программа",
    steps: ["Сфотографируйте тарелку", "Получите честный вердикт", "Смотрите свой прогресс"],
  },
  ontrack: {
    title: "Сделано, чтобы держать вас в ритме",
    captions: {
      consistency: "Пропущенный день ничего не стоит. Следующий начинается с нуля.",
      habits: "Ничего не запрещено. Каждая тарелка получает честный вердикт.",
      support: "Спрашивайте Спада о чём угодно, когда угодно, в чате.",
      busy: "Одно фото — вся запись.",
      ideas: "Нет идей на ужин? Спад подскажет, что ещё поместится.",
    },
  },
  chart: {
    byEait: "eait analysis",
    weightTrend: "Динамика веса",
    without: "Без",
    now: "Сейчас",
    later: "Позже",
    twoWays: "Вес во времени, нарисованный дважды: с планом и без",
    estimatedProgress: "Оценка прогресса",
    estimate: "Оценка",
    target: "Цель {weight}",
    monthEstimate: "{month} · оценка",
  },
  plan: {
    goalLose: "Цель: сбросить {delta} — примерно {month}",
    goalGain: "Цель: набрать {delta} — примерно {month}",
    goalMaintain: "Цель: держать свой вес",
    rest: "В покое твоё тело сжигает", activity: "С твоей активностью — около", pace: "Под твой темп корректируем", floor: "Порог, ниже которого не идём", protein: "Белок — ориентир",
  },
  health: {
    title: "Синхронизация с Apple Health",
    body: "Вес и активность записываются, приёмы пищи — нет.",
    connect: "Подключить Apple Health",
    skip: "Не сейчас",
  },
  targetSuggestion:  {
    down: "Предлагаю {kg} кг — примерно на {pct}% меньше, хорошая первая цель",
    up: "Предлагаю {kg} кг — примерно на {pct}% больше, хорошая первая цель",
  },
  firstMeal:  FIRST_MEAL_COPY.ru,
  stepper:  { continue: "Продолжить", less: "Меньше", more: "Больше" },
  offerHeadline:  "Цель {kg} кг. Срок: {month}",
  planGoal: {
    metric: "Цель: минус {n} кг. Срок: {month}",
    // The SYMBOL, as every other language writes it: the word "фунтов" is the genitive plural and
    // reads wrong beside 1 or 2–4, which no amount of {n} fixes from inside the template.
    imperial: "Цель: минус {n} lb. Срок: {month}",
  },
};

export const CHAT_COPY: Localized<ChatCopy> = { en: EN, fr: FR, de: DE, it: IT, es: ES, vi: VI, id: ID, ru: RU };

/** What Spud says back, in one language. English for one nobody has written yet. */
export const chatCopyFor = (lang: Lang): ChatCopy => t(lang)(CHAT_COPY);
