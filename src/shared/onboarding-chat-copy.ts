// The conversation around the questions, in every language the product speaks.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// WHY THIS IS ONE TABLE PER LANGUAGE RATHER THAN A TABLE PER SENTENCE
//
// `onboarding-chat.ts` holds the BRANCHES — which card a struggle gets, whether the cholesterol
// line chains onto the kidney one, when a two-digit age is ambiguous. Those are rules, they are
// tested, and a translator has no business moving them. What a translator does have business with
// is the wording of each branch once it has been chosen, and that is what is here.
//
// ONE OBJECT PER LANGUAGE, because a voice is a property of the whole side of a conversation and
// not of a string: somebody writing the Vietnamese should see Spud's eight struggle cards, his five
// activity replies and his two refusals together, in one place, and hear whether they sound like
// one person. Eight separate `Localized` tables would be the same words and a worse review.
//
// THE CITATIONS ARE NOT TRANSLATED, THEY ARE RE-WRITTEN AROUND UNCHANGED NUMBERS. "about 42% of
// adults" is 42% in all eight; what changes is the sentence it sits in and how the figure is
// spelled ("n = 1.18M" is "n = 1,18 Mio." in German and the same quantity). `copy.md`'s rule is
// never bend a citation, and a decimal comma is not a bend — a different percentage would be.
//
// THE PERCENTAGES THAT COME FROM CODE STAY COMING FROM CODE. `{share}` is filled from
// `MAX_SURPLUS_SHARE` and `{age}` from `MIN_AGE`, in every language, because a safety guarantee
// described in copy that the arithmetic does not implement is the worst sentence this repo could
// ship — and the way that happens is somebody changing a constant and not eight prose strings.
// ─────────────────────────────────────────────────────────────────────────────────────────────

import { t, type Localized } from "./lang.ts";
import type { Goal, Lang } from "./types.ts";

/** A statistic, and where it came from. Mirrors `SupportCard` in `onboarding-chat.ts`. */
export interface CardCopy {
  title: string;
  body: string;
  source?: string;
}

/** Everything Spud says back, for one language. Branching stays in `onboarding-chat.ts`. */
export interface ChatCopy {
  idlePlaceholder: string;
  struggles: Record<string, string>;
  strugglesAsk: string[];
  quick: {
    struggles: { finish: string; none: string };
    restrictions: { finish: string; none: string };
  };
  goalCards: Record<Goal, CardCopy>;
  goalFollowups: Partial<Record<Goal, string>>;
  struggleCards: Record<string, CardCopy>;
  /** `diets` told to somebody gaining: the regain meta-analysis is about losing, so it is dropped. */
  dietsGainCard: CardCopy;
  /** `{share}` from `MAX_SURPLUS_SHARE`. */
  gainPaceCard: CardCopy;
  /** `{age}` from `MIN_AGE`. */
  underAgeCard: CardCopy;
  underAge: { ask: string; confirm: string; placeholder: string; stopped: string[]; endedPlaceholder: string };
  /** `{kg}` is the lowest healthy weight for this height. */
  belowHealthy: CardCopy;
  /** `{bmr}` is the first real number, spoken six steps early. */
  weightAck: { noted: string; bmr: string };
  activityReplies: Record<string, string>;
  strugglesCloser: { none: string; one: string; many: string };
  restrictions: {
    kidneys: string;
    ldl: string;
    /** Chains onto the kidney line and must never fire without it. */
    ldlChained: string;
    declared: string;
    none: string;
    freeText: string;
  };
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
  /** Appended to the goal-weight question when the goal is losing. `{loseTail}` in the content. */
  loseTail: string;
  /** `{kg}` a week, appended to the share-cap note when there is a rate to name. */
  capNoteTail: string;
  nothingApplies: string;
  goalEdit: { cleared: string; worthSetting: string };
}

const EN: ChatCopy = {
  idlePlaceholder: "Message Spud…",
  struggles: {
    stress: "Stress eating",
    night: "Night snacking",
    binge: "Binge episodes",
    diets: "Diets that didn't stick",
    eatout: "Eating out a lot",
    energy: "Low energy",
    body: "Body image",
    metabolism: "Metabolism worry",
  },
  strugglesAsk: ["Now the part most apps skip. What's been hard? Pick any — or none. This shapes support, never judgement."],
  quick: {
    struggles: { finish: "Done", none: "None of these" },
    restrictions: { finish: "Finish", none: "Nothing applies" },
  },
  goalCards: {
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
  },
  goalFollowups: {
    gain: "Same rules as for everyone here — honest numbers, no cheering, no shame — just pointed up instead of down.",
    maintain: "And the easy path is yours: no target weight to pick — we plan around staying put.",
  },
  struggleCards: {
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
  },
  dietsGainCard: {
    title: "Regain is the norm, not your fault",
    body: "Most attempts to change weight, in either direction, revert within a couple of years — methods failing, not people. Your surplus here is sized to be keepable, not impressive.",
  },
  gainPaceCard: {
    title: "Gaining well is slow on purpose",
    body: "Your surplus gets capped at about {share}% over what your body burns in a day — the zone where muscle keeps up with the scale. Most successful gainers lead with protein; we'll track yours automatically.",
    source: "Survey of 168 athletic adults attempting weight gain",
  },
  underAgeCard: {
    title: "eait is for {age} and over",
    body: "The way this app sets calorie targets is not designed for a body that is still growing.",
  },
  underAge: {
    ask: "Sorry — I have to stop here. If a typo got us here, just send your real age.",
    confirm: "That's my real age",
    placeholder: "Your age",
    stopped: [
      "Then this is where we stop. Nothing you told me is kept, and nothing was sent anywhere — there is no account to delete.",
      "Come back at {age} and I'll be around.",
    ],
    endedPlaceholder: "eait is for {age} and over",
  },
  belowHealthy: {
    title: "I can't set that as a target",
    body: "The lowest healthy weight for your height is about {kg} kg. We won't set a goal below it. If you're working with a doctor on something different, follow them rather than this app.",
  },
  weightAck: {
    noted: "Noted — honest numbers make an honest plan.",
    bmr: "And here's your first number: at rest, your body burns about {bmr} kcal a day. The next questions sharpen it.",
  },
  activityReplies: {
    sedentary: "Thanks for the honest answer — most people overshoot this one, and then the target overshoots them.",
    light: "Good — walks count for more than people think.",
    moderate: "Solid. The number will assume those workouts happen — keep me honest.",
    active: "Good — that buys you more food. I'd rather fuel it properly than guess low.",
    athlete: "Then the number has real work to fuel. I'd rather feed it properly than guess low.",
  },
  strugglesCloser: {
    none: "Even better. If something turns up later, tell me in the chat — the plan can bend.",
    one: "We know how to work with that — the plan gets built around it, not in spite of it. Two quick ones left.",
    many: "We know how to work with each of these — the plan gets built around them, not in spite of them. Two quick ones left.",
  },
  restrictions: {
    kidneys: "Noted. Sodium gets scored from here on — and only because you asked.",
    ldl: "Noted. Saturated fat gets scored from here on — and only because you asked.",
    ldlChained: "Saturated fat gets scored too — same rule: only what you declare.",
    declared: "Noted — those go on your profile, and only they get scored.",
    none: "Then nothing extra gets scored — undeclared things never are. You can add one any time in settings.",
    freeText: "And the free text goes on your profile too.",
  },
  invalid: {
    age: "That doesn't look like an age — try something like 34.",
    height_cm: "In centimetres — something like 175.",
    weight_kg: "In kilograms — roughly is fine.",
    target_weight_kg: "A number in kg — like 70.",
  },
  ambiguousAge: {
    line: "Want to be sure I read that right — if you meant the year {year}, send all four digits.",
    confirm: "I'm {age}",
  },
  direction: {
    gain: "You're at {weight} kg and asked to gain to {target} — that's not a gain from here. If the goal changed, we can switch it; otherwise give me a number above {weight}.",
    lose: "You're at {weight} kg and asked to lose to {target} — that's not a loss from here. If the goal changed, we can switch it; otherwise give me a number below {weight}.",
    switchToLose: "Switch to losing",
    switchToGain: "Switch to gaining",
    above: "A number above {weight}…",
    below: "A number below {weight}…",
  },
  switched: {
    gain: "Switched — gaining it is. Where would you like to be, in kg?",
    lose: "Switched — losing it is. Where would you like to be, in kg? Faster isn't better here — it's just harder to keep.",
  },
  loseTail: " Faster isn't better here — it's just harder to keep.",
  capNoteTail: " That's about {kg} kg a week.",
  nothingApplies: "Nothing applies",
  goalEdit: {
    cleared: "Your target weight no longer fitted that goal, so it's cleared — set a new one.",
    worthSetting: "Recorded. Your target weight no longer fits your goal, though — worth setting a new one.",
  },
};

const FR: ChatCopy = {
  idlePlaceholder: "Écrire à Spud…",
  struggles: {
    stress: "Manger sous stress",
    night: "Grignotage nocturne",
    binge: "Crises de boulimie",
    diets: "Régimes qui n'ont pas tenu",
    eatout: "Souvent au restaurant",
    energy: "Manque d'énergie",
    body: "Image du corps",
    metabolism: "Doutes sur le métabolisme",
  },
  strugglesAsk: ["Maintenant la partie que la plupart des applis sautent. Qu'est-ce qui a été dur ? Coche ce que tu veux — ou rien. Ça oriente le soutien, jamais le jugement."],
  quick: {
    struggles: { finish: "Terminé", none: "Rien de tout ça" },
    restrictions: { finish: "Terminer", none: "Rien à signaler" },
  },
  goalCards: {
    lose: {
      title: "Tu es loin d'être seul",
      body: "Environ 42% des adultes essaient de perdre du poids sur une année donnée. La différence ici : ton objectif est calculé correctement, avec un plancher qu'on ne franchit pas.",
      source: "Revue systématique de 72 études · n = 1,18 M d'adultes",
    },
    gain: {
      title: "Moins rare qu'on ne croit",
      body: "Environ 23% des jeunes hommes et 6% des jeunes femmes ont activement essayé de prendre du poids l'an dernier. C'est un vrai objectif, avec une vraie technique — on visera un surplus qui construit plus qu'il ne rembourre.",
      source: "Étude canadienne sur de jeunes adultes · n = 976",
    },
    maintain: {
      title: "L'objectif discret",
      body: "Environ 23% des adultes travaillent activement à garder leur poids — l'objectif dont personne ne parle, et il mérite quand même un plan. Tes journées seront jugées par rapport au maintien.",
      source: "Méta-analyse des tentatives de contrôle du poids sur un an",
    },
  },
  goalFollowups: {
    gain: "Mêmes règles que pour tout le monde ici — des chiffres honnêtes, pas d'encouragements creux, aucune honte — simplement orientés vers le haut.",
    maintain: "Et le chemin facile est pour toi : pas de poids cible à choisir — on planifie autour du maintien.",
  },
  struggleCards: {
    stress: {
      title: "Un schéma, pas un défaut de caractère",
      body: "Environ 38% des adultes mangent en réaction à leurs émotions au moins une fois par mois — pour la moitié d'entre eux, chaque semaine. Nommer le schéma, c'est déjà l'essentiel ; le journal fait le reste.",
      source: "Étude nationale américaine, n = 5 863 · revue, 2026",
    },
    night: {
      title: "Il y a foule après 20 h",
      body: "Plus de 60% des adultes mangent quelque chose après 20 h, et environ 1 grignoteur sur 4 mange désormais surtout tard le soir. On ne note pas l'heure à laquelle tu manges — seulement le total de la journée.",
      source: "CivicScience, 1,2 M de réponses",
    },
    binge: {
      title: "Tu n'es pas seul là-dedans",
      body: "L'hyperphagie boulimique est le trouble alimentaire le plus fréquent — environ 2,8% des adultes en remplissent les critères à un moment, et 17% des personnes qui démarrent un programme de poids sont dépistées positives. Si les crises semblent hors de contrôle, un clinicien aide plus que n'importe quelle appli. Ici, une journée difficile est une donnée, jamais un verdict.",
      source: "NIMH (NCS-R) · étude sur 6 930 débuts de programme",
    },
    diets: {
      title: "La reprise est la norme, pas ta faute",
      body: "Sur 29 études au long cours, plus de la moitié du poids perdu revient en deux ans — plus de 80% au bout de cinq. Ce sont les méthodes qui échouent, pas les gens. Ton plan ici est dimensionné pour être tenable, pas pour impressionner.",
      source: "Méta-analyse de 29 études américaines sur la perte de poids",
    },
    eatout: {
      title: "C'est au restaurant que ça dérive",
      body: "Les estimations dérivent le plus sur ce que tu n'as pas cuisiné — et c'est exactement là que les photos sont bonnes. Je te dirai quand je ne suis pas sûr, au lieu de faire semblant.",
    },
    energy: {
      title: "L'énergie est la mesure honnête",
      body: "Les journées sous-alimentées et le manque d'énergie voyagent ensemble — c'est une des raisons pour lesquelles on refuse les objectifs sous le plancher de sécurité. La nourriture est la moitié de l'énergie ; on regardera la forme de tes journées.",
    },
    body: {
      title: "Ici, la balance ne juge pas",
      body: "Tu auras des chiffres sur ce que tu manges, jamais de commentaires sur ton corps. C'est ton objectif qui fixe les cibles ; rien ici n'est comparé à qui que ce soit.",
    },
    metabolism: {
      title: "Mesurons plutôt que de s'inquiéter",
      body: "Les métabolismes diffèrent moins que ne le dit internet — mais le tien est le tien, et deux semaines de suivi honnête montrent ce qu'il fait vraiment. Ça vaut mieux que n'importe quelle formule, la mienne comprise.",
    },
  },
  dietsGainCard: {
    title: "La reprise est la norme, pas ta faute",
    body: "La plupart des tentatives de changer de poids, dans un sens comme dans l'autre, s'inversent en quelques années — les méthodes échouent, pas les gens. Ton surplus ici est dimensionné pour être tenable, pas pour impressionner.",
  },
  gainPaceCard: {
    title: "Bien prendre, c'est lent exprès",
    body: "Ton surplus est plafonné à environ {share}% de ce que ton corps brûle en une journée — la zone où le muscle suit la balance. La plupart de ceux qui y arrivent commencent par les protéines ; on suivra les tiennes automatiquement.",
    source: "Enquête auprès de 168 adultes sportifs cherchant à prendre du poids",
  },
  underAgeCard: {
    title: "eait, c'est à partir de {age} ans",
    body: "La façon dont cette appli fixe les objectifs caloriques n'est pas conçue pour un corps qui grandit encore.",
  },
  underAge: {
    ask: "Désolé — je dois m'arrêter là. Si c'est une faute de frappe, envoie-moi ton vrai âge.",
    confirm: "C'est mon vrai âge",
    placeholder: "Ton âge",
    stopped: [
      "Alors on s'arrête ici. Rien de ce que tu m'as dit n'est conservé, et rien n'a été envoyé nulle part — il n'y a aucun compte à supprimer.",
      "Reviens à {age} ans, je serai là.",
    ],
    endedPlaceholder: "eait, c'est à partir de {age} ans",
  },
  belowHealthy: {
    title: "Je ne peux pas fixer ça comme objectif",
    body: "Le poids sain le plus bas pour ta taille est d'environ {kg} kg. On ne fixera pas d'objectif en dessous. Si tu suis autre chose avec un médecin, suis-le lui plutôt que cette appli.",
  },
  weightAck: {
    noted: "Noté — des chiffres honnêtes font un plan honnête.",
    bmr: "Et voilà ton premier chiffre : au repos, ton corps brûle environ {bmr} kcal par jour. Les questions suivantes vont l'affiner.",
  },
  activityReplies: {
    sedentary: "Merci pour la réponse honnête — la plupart des gens surestiment celle-ci, et c'est ensuite l'objectif qui les surestime.",
    light: "Bien — la marche compte plus qu'on ne le croit.",
    moderate: "Solide. Le chiffre partira du principe que ces séances ont lieu — tiens-moi honnête.",
    active: "Bien — ça t'achète plus à manger. Je préfère alimenter correctement que deviner trop bas.",
    athlete: "Alors le chiffre a du vrai travail à alimenter. Je préfère nourrir ça correctement que deviner trop bas.",
  },
  strugglesCloser: {
    none: "Encore mieux. Si quelque chose apparaît plus tard, dis-le-moi dans le chat — le plan peut plier.",
    one: "On sait travailler avec ça — le plan se construit autour, pas contre. Deux petites questions et c'est fini.",
    many: "On sait travailler avec chacun de ces points — le plan se construit autour, pas contre. Deux petites questions et c'est fini.",
  },
  restrictions: {
    kidneys: "Noté. Le sodium sera noté à partir de maintenant — et seulement parce que tu l'as demandé.",
    ldl: "Noté. Les graisses saturées seront notées à partir de maintenant — et seulement parce que tu l'as demandé.",
    ldlChained: "Les graisses saturées aussi — même règle : uniquement ce que tu déclares.",
    declared: "Noté — ça va sur ton profil, et c'est tout ce qui sera noté.",
    none: "Alors rien de plus ne sera noté — ce qui n'est pas déclaré ne l'est jamais. Tu peux en ajouter quand tu veux dans les réglages.",
    freeText: "Et le texte libre va sur ton profil aussi.",
  },
  invalid: {
    age: "Ça ne ressemble pas à un âge — essaie quelque chose comme 34.",
    height_cm: "En centimètres — quelque chose comme 175.",
    weight_kg: "En kilos — à peu près, ça suffit.",
    target_weight_kg: "Un nombre en kg — comme 70.",
  },
  ambiguousAge: {
    line: "Je veux être sûr d'avoir bien lu — si tu voulais dire l'année {year}, envoie les quatre chiffres.",
    confirm: "J'ai {age} ans",
  },
  direction: {
    gain: "Tu es à {weight} kg et tu demandes à monter jusqu'à {target} — ce n'est pas une prise, depuis ici. Si l'objectif a changé, on peut le basculer ; sinon donne-moi un nombre au-dessus de {weight}.",
    lose: "Tu es à {weight} kg et tu demandes à descendre jusqu'à {target} — ce n'est pas une perte, depuis ici. Si l'objectif a changé, on peut le basculer ; sinon donne-moi un nombre en dessous de {weight}.",
    switchToLose: "Passer à la perte",
    switchToGain: "Passer à la prise",
    above: "Un nombre au-dessus de {weight}…",
    below: "Un nombre en dessous de {weight}…",
  },
  switched: {
    gain: "Basculé — on prend, donc. Où aimerais-tu arriver, en kg ?",
    lose: "Basculé — on perd, donc. Où aimerais-tu arriver, en kg ? Plus vite n'est pas mieux ici — c'est juste plus dur à tenir.",
  },
  loseTail: " Plus vite n'est pas mieux ici — c'est juste plus dur à tenir.",
  capNoteTail: " Ça fait environ {kg} kg par semaine.",
  nothingApplies: "Rien à signaler",
  goalEdit: {
    cleared: "Ton poids cible ne collait plus à cet objectif, il est donc effacé — choisis-en un nouveau.",
    worthSetting: "Enregistré. Ton poids cible ne colle plus à ton objectif, cela dit — ça vaut le coup d'en fixer un nouveau.",
  },
};

const DE: ChatCopy = {
  idlePlaceholder: "Nachricht an Spud…",
  struggles: {
    stress: "Essen bei Stress",
    night: "Naschen am Abend",
    binge: "Essanfälle",
    diets: "Diäten, die nicht hielten",
    eatout: "Viel auswärts essen",
    energy: "Wenig Energie",
    body: "Körperbild",
    metabolism: "Sorge um den Stoffwechsel",
  },
  strugglesAsk: ["Jetzt der Teil, den die meisten Apps auslassen. Was war schwer? Such aus, was passt — oder nichts. Das steuert die Unterstützung, nie ein Urteil."],
  quick: {
    struggles: { finish: "Fertig", none: "Nichts davon" },
    restrictions: { finish: "Abschließen", none: "Trifft nichts zu" },
  },
  goalCards: {
    lose: {
      title: "Damit bist du in guter Gesellschaft",
      body: "Rund 42% der Erwachsenen versuchen in einem beliebigen Jahr abzunehmen. Der Unterschied hier: dein Ziel wird sauber berechnet, mit einer Grenze, die wir nicht unterschreiten.",
      source: "Systematische Übersichtsarbeit über 72 Studien · n = 1,18 Mio. Erwachsene",
    },
    gain: {
      title: "Seltener gefühlt als tatsächlich",
      body: "Etwa 23% der jungen Männer und 6% der jungen Frauen haben im letzten Jahr aktiv versucht zuzunehmen. Ein echtes Ziel mit echter Technik — wir setzen einen Überschuss, der mehr aufbaut als anlagert.",
      source: "Kanadische Studie an jungen Erwachsenen · n = 976",
    },
    maintain: {
      title: "Das stille Ziel",
      body: "Etwa 23% der Erwachsenen arbeiten aktiv daran, ihr Gewicht zu halten — das Ziel, über das niemand postet, und es verdient trotzdem einen Plan. Deine Tage werden am Halten gemessen.",
      source: "Meta-Analyse zu Gewichtskontroll-Versuchen im Vorjahr",
    },
  },
  goalFollowups: {
    gain: "Dieselben Regeln wie für alle hier — ehrliche Zahlen, kein Jubeln, keine Scham — nur nach oben statt nach unten gerichtet.",
    maintain: "Und der bequeme Weg gehört dir: kein Zielgewicht auszusuchen — wir planen ums Halten herum.",
  },
  struggleCards: {
    stress: {
      title: "Ein Muster, kein Charakterfehler",
      body: "Rund 38% der Erwachsenen essen mindestens einmal im Monat als Reaktion auf Gefühle — bei etwa der Hälfte davon wöchentlich. Das Muster zu benennen ist der größte Teil der Arbeit; den Rest macht das Protokoll.",
      source: "US-Bevölkerungsstudie, n = 5.863 · Übersichtsarbeit, 2026",
    },
    night: {
      title: "Nach 20 Uhr wird es voll",
      body: "Über 60% der Erwachsenen essen nach 20 Uhr noch etwas, und etwa jeder vierte Snacker isst inzwischen vor allem spätabends. Wir bewerten nicht, wann du isst — nur, was am Ende des Tages zusammenkommt.",
      source: "CivicScience, 1,2 Mio. Antworten",
    },
    binge: {
      title: "Damit bist du nicht allein",
      body: "Die Binge-Eating-Störung ist die häufigste Essstörung — etwa 2,8% der Erwachsenen erfüllen irgendwann die Kriterien, und 17% der Menschen, die ein Abnehmprogramm beginnen, werden positiv gescreent. Wenn sich die Anfälle unkontrollierbar anfühlen, hilft eine Fachperson mehr als jede App. Hier ist ein schwerer Tag eine Information, nie ein Urteil.",
      source: "NIMH (NCS-R) · Studie an 6.930 Programmstartern",
    },
    diets: {
      title: "Zunehmen danach ist die Regel, nicht dein Versagen",
      body: "Über 29 Langzeitstudien hinweg kommt mehr als die Hälfte des verlorenen Gewichts binnen zwei Jahren zurück — über 80% nach fünf. Das sind Methoden, die scheitern, keine Menschen. Dein Plan hier ist so bemessen, dass er haltbar ist, nicht beeindruckend.",
      source: "Meta-Analyse von 29 US-Abnehmstudien",
    },
    eatout: {
      title: "Restaurantteller driften am stärksten",
      body: "Schätzungen driften am meisten bei Essen, das du nicht selbst gekocht hast — und genau darin sind Fotos gut. Ich sage es, wenn ich unsicher bin, statt so zu tun als ob.",
    },
    energy: {
      title: "Energie ist die ehrliche Messgröße",
      body: "Unterversorgte Tage und wenig Energie reisen gemeinsam — einer der Gründe, warum wir Ziele unterhalb der Sicherheitsgrenze ablehnen. Essen ist die Hälfte von Energie; wir schauen auf die Form deiner Tage.",
    },
    body: {
      title: "Die Waage ist hier nicht die Richterin",
      body: "Du bekommst Zahlen über dein Essen, nie Kommentare über deinen Körper. Dein Ziel setzt die Vorgaben; nichts hier wird mit irgendjemandem verglichen.",
    },
    metabolism: {
      title: "Messen statt sorgen",
      body: "Stoffwechsel unterscheiden sich weniger, als das Internet behauptet — aber deiner ist deiner, und zwei Wochen ehrliches Protokollieren zeigen, was er tatsächlich tut. Das schlägt jede Formel, meine eingeschlossen.",
    },
  },
  dietsGainCard: {
    title: "Rückfall ist die Regel, nicht dein Versagen",
    body: "Die meisten Versuche, das Gewicht zu ändern, kehren sich in beide Richtungen binnen ein paar Jahren um — Methoden scheitern, keine Menschen. Dein Überschuss hier ist so bemessen, dass er haltbar ist, nicht beeindruckend.",
  },
  gainPaceCard: {
    title: "Gut zunehmen geht absichtlich langsam",
    body: "Dein Überschuss wird bei etwa {share}% über dem gedeckelt, was dein Körper am Tag verbrennt — die Zone, in der Muskeln mit der Waage mithalten. Die meisten, die gut zunehmen, führen mit Eiweiß; deins verfolgen wir automatisch.",
    source: "Befragung von 168 sportlichen Erwachsenen mit Zunahme-Ziel",
  },
  underAgeCard: {
    title: "eait ist ab {age}",
    body: "Die Art, wie diese App Kalorienziele setzt, ist nicht für einen Körper gedacht, der noch wächst.",
  },
  underAge: {
    ask: "Tut mir leid — hier muss ich aufhören. Wenn ein Tippfehler schuld ist, schick mir einfach dein echtes Alter.",
    confirm: "Das ist mein echtes Alter",
    placeholder: "Dein Alter",
    stopped: [
      "Dann hören wir hier auf. Nichts von dem, was du mir gesagt hast, wird behalten, und nichts wurde irgendwohin geschickt — es gibt kein Konto zu löschen.",
      "Komm mit {age} wieder, ich bin da.",
    ],
    endedPlaceholder: "eait ist ab {age}",
  },
  belowHealthy: {
    title: "Das kann ich nicht als Ziel setzen",
    body: "Das niedrigste gesunde Gewicht für deine Größe liegt bei etwa {kg} kg. Darunter setzen wir kein Ziel. Wenn du mit einer Ärztin an etwas anderem arbeitest, folge ihr und nicht dieser App.",
  },
  weightAck: {
    noted: "Notiert — ehrliche Zahlen machen einen ehrlichen Plan.",
    bmr: "Und hier ist deine erste Zahl: in Ruhe verbrennt dein Körper etwa {bmr} kcal am Tag. Die nächsten Fragen schärfen sie.",
  },
  activityReplies: {
    sedentary: "Danke für die ehrliche Antwort — die meisten schätzen hier zu hoch, und dann schätzt das Ziel sie zu hoch.",
    light: "Gut — Spaziergänge zählen mehr, als man denkt.",
    moderate: "Solide. Die Zahl geht davon aus, dass diese Einheiten stattfinden — halt mich ehrlich.",
    active: "Gut — das bringt dir mehr zu essen. Lieber ordentlich versorgen als zu niedrig raten.",
    athlete: "Dann hat die Zahl echte Arbeit zu versorgen. Lieber ordentlich füttern als zu niedrig raten.",
  },
  strugglesCloser: {
    none: "Umso besser. Wenn später etwas auftaucht, sag es mir im Chat — der Plan kann sich biegen.",
    one: "Damit können wir arbeiten — der Plan wird darum herum gebaut, nicht dagegen. Zwei kurze Fragen noch.",
    many: "Mit jedem davon können wir arbeiten — der Plan wird darum herum gebaut, nicht dagegen. Zwei kurze Fragen noch.",
  },
  restrictions: {
    kidneys: "Notiert. Natrium wird ab jetzt bewertet — und nur, weil du darum gebeten hast.",
    ldl: "Notiert. Gesättigte Fettsäuren werden ab jetzt bewertet — und nur, weil du darum gebeten hast.",
    ldlChained: "Gesättigte Fettsäuren werden auch bewertet — gleiche Regel: nur, was du angibst.",
    declared: "Notiert — das kommt auf dein Profil, und nur das wird bewertet.",
    none: "Dann wird nichts zusätzlich bewertet — was nicht angegeben ist, wird es nie. Du kannst jederzeit in den Einstellungen etwas hinzufügen.",
    freeText: "Und der Freitext kommt auch auf dein Profil.",
  },
  invalid: {
    age: "Das sieht nicht nach einem Alter aus — versuch es mit so etwas wie 34.",
    height_cm: "In Zentimetern — so etwas wie 175.",
    weight_kg: "In Kilogramm — ungefähr reicht.",
    target_weight_kg: "Eine Zahl in kg — zum Beispiel 70.",
  },
  ambiguousAge: {
    line: "Ich will sichergehen, dass ich das richtig lese — wenn du das Jahr {year} meintest, schick alle vier Ziffern.",
    confirm: "Ich bin {age}",
  },
  direction: {
    gain: "Du bist bei {weight} kg und willst auf {target} zunehmen — von hier aus ist das keine Zunahme. Wenn sich das Ziel geändert hat, stellen wir um; sonst gib mir eine Zahl über {weight}.",
    lose: "Du bist bei {weight} kg und willst auf {target} abnehmen — von hier aus ist das keine Abnahme. Wenn sich das Ziel geändert hat, stellen wir um; sonst gib mir eine Zahl unter {weight}.",
    switchToLose: "Auf Abnehmen umstellen",
    switchToGain: "Auf Zunehmen umstellen",
    above: "Eine Zahl über {weight}…",
    below: "Eine Zahl unter {weight}…",
  },
  switched: {
    gain: "Umgestellt — zunehmen also. Wo möchtest du landen, in kg?",
    lose: "Umgestellt — abnehmen also. Wo möchtest du landen, in kg? Schneller ist hier nicht besser — nur schwerer zu halten.",
  },
  loseTail: " Schneller ist hier nicht besser — nur schwerer zu halten.",
  capNoteTail: " Das sind etwa {kg} kg pro Woche.",
  nothingApplies: "Trifft nichts zu",
  goalEdit: {
    cleared: "Dein Zielgewicht passte nicht mehr zu diesem Ziel, also ist es gelöscht — setz ein neues.",
    worthSetting: "Aufgenommen. Dein Zielgewicht passt allerdings nicht mehr zu deinem Ziel — es lohnt sich, ein neues zu setzen.",
  },
};

const IT: ChatCopy = {
  idlePlaceholder: "Scrivi a Spud…",
  struggles: {
    stress: "Mangiare per stress",
    night: "Spuntini notturni",
    binge: "Abbuffate",
    diets: "Diete che non hanno tenuto",
    eatout: "Mangiare spesso fuori",
    energy: "Poca energia",
    body: "Immagine del corpo",
    metabolism: "Dubbi sul metabolismo",
  },
  strugglesAsk: ["Ora la parte che quasi tutte le app saltano. Cosa è stato difficile? Scegli quello che vuoi — o niente. Questo orienta il supporto, mai un giudizio."],
  quick: {
    struggles: { finish: "Fatto", none: "Niente di questi" },
    restrictions: { finish: "Concludi", none: "Niente di tutto ciò" },
  },
  goalCards: {
    lose: {
      title: "Sei in buona compagnia",
      body: "Circa il 42% degli adulti prova a perdere peso in un anno qualsiasi. La differenza qui: il tuo obiettivo viene calcolato per bene, con un limite che non superiamo.",
      source: "Revisione sistematica di 72 studi · n = 1,18 mln di adulti",
    },
    gain: {
      title: "Meno raro di quanto sembri",
      body: "Circa il 23% dei giovani uomini e il 6% delle giovani donne ha provato attivamente a prendere peso nell'ultimo anno. È un obiettivo vero, con una tecnica vera — punteremo a un surplus che costruisce più di quanto imbottisca.",
      source: "Studio canadese su giovani adulti · n = 976",
    },
    maintain: {
      title: "L'obiettivo silenzioso",
      body: "Circa il 23% degli adulti lavora attivamente per mantenere il peso — l'obiettivo di cui nessuno parla, e merita comunque un piano. Le tue giornate saranno valutate sul restare dove sei.",
      source: "Meta-analisi dei tentativi di controllo del peso nell'ultimo anno",
    },
  },
  goalFollowups: {
    gain: "Stesse regole che valgono per tutti qui — numeri onesti, niente incoraggiamenti a vuoto, nessuna vergogna — solo puntati in su invece che in giù.",
    maintain: "E la strada comoda è la tua: nessun peso obiettivo da scegliere — pianifichiamo attorno al restare dove sei.",
  },
  struggleCards: {
    stress: {
      title: "Uno schema, non un difetto di carattere",
      body: "Circa il 38% degli adulti mangia in risposta alle emozioni almeno una volta al mese — per metà di loro, ogni settimana. Dare un nome allo schema è gran parte del lavoro; il resto lo fa il diario.",
      source: "Studio nazionale USA, n = 5.863 · revisione, 2026",
    },
    night: {
      title: "Dopo le 20 c'è folla",
      body: "Oltre il 60% degli adulti mangia qualcosa dopo le 20, e circa 1 su 4 fra chi fa spuntini ormai mangia soprattutto a tarda sera. Non valutiamo quando mangi — solo quanto fa la giornata.",
      source: "CivicScience, 1,2 mln di risposte",
    },
    binge: {
      title: "Non sei solo in questo",
      body: "Il disturbo da alimentazione incontrollata è il disturbo alimentare più diffuso — circa il 2,8% degli adulti ne soddisfa i criteri a un certo punto, e il 17% di chi inizia un programma di peso risulta positivo allo screening. Se gli episodi sembrano fuori controllo, un clinico aiuta più di qualsiasi app. Qui una giornata difficile è un dato, mai un verdetto.",
      source: "NIMH (NCS-R) · studio su 6.930 persone all'inizio di un programma",
    },
    diets: {
      title: "Riprendere è la norma, non colpa tua",
      body: "Su 29 studi a lungo termine, più della metà del peso perso torna entro due anni — oltre l'80% entro cinque. Sono i metodi a fallire, non le persone. Il tuo piano qui è dimensionato per essere mantenibile, non per fare colpo.",
      source: "Meta-analisi di 29 studi USA sulla perdita di peso",
    },
    eatout: {
      title: "I piatti del ristorante sono i più imprecisi",
      body: "Le stime sbandano di più sul cibo che non hai cucinato — ed è esattamente lì che le foto sono brave. Quando non sono sicuro te lo dico, invece di far finta.",
    },
    energy: {
      title: "L'energia è la misura onesta",
      body: "Giornate sotto-alimentate e poca energia viaggiano insieme — è uno dei motivi per cui rifiutiamo obiettivi sotto la soglia di sicurezza. Il cibo è metà dell'energia; guarderemo la forma delle tue giornate.",
    },
    body: {
      title: "Qui la bilancia non giudica",
      body: "Avrai numeri sul cibo, mai commenti sul tuo corpo. È il tuo obiettivo a fissare i target; qui nulla viene confrontato con qualcun altro.",
    },
    metabolism: {
      title: "Misuriamo invece di preoccuparci",
      body: "I metabolismi differiscono meno di quanto dica internet — ma il tuo è il tuo, e due settimane di registrazioni oneste mostrano cosa fa davvero. Batte qualunque formula, compresa la mia.",
    },
  },
  dietsGainCard: {
    title: "Tornare indietro è la norma, non colpa tua",
    body: "Quasi tutti i tentativi di cambiare peso, in entrambe le direzioni, si invertono nel giro di un paio d'anni — sono i metodi a fallire, non le persone. Il tuo surplus qui è dimensionato per essere mantenibile, non per fare colpo.",
  },
  gainPaceCard: {
    title: "Crescere bene è lento di proposito",
    body: "Il tuo surplus viene limitato a circa il {share}% in più di quello che il tuo corpo brucia in un giorno — la zona in cui il muscolo sta al passo con la bilancia. Chi ci riesce parte quasi sempre dalle proteine; le tue le seguiamo in automatico.",
    source: "Indagine su 168 adulti sportivi che cercavano di prendere peso",
  },
  underAgeCard: {
    title: "eait è da {age} anni in su",
    body: "Il modo in cui questa app fissa gli obiettivi calorici non è pensato per un corpo che sta ancora crescendo.",
  },
  underAge: {
    ask: "Mi dispiace — qui devo fermarmi. Se è stato un errore di battitura, mandami la tua età vera.",
    confirm: "È la mia età vera",
    placeholder: "La tua età",
    stopped: [
      "Allora ci fermiamo qui. Niente di quello che mi hai detto viene conservato, e niente è stato mandato da nessuna parte — non c'è nessun account da cancellare.",
      "Torna a {age} anni e io ci sarò.",
    ],
    endedPlaceholder: "eait è da {age} anni in su",
  },
  belowHealthy: {
    title: "Non posso impostarlo come obiettivo",
    body: "Il peso sano più basso per la tua altezza è circa {kg} kg. Sotto quello non fissiamo obiettivi. Se stai seguendo altro con un medico, segui lui e non questa app.",
  },
  weightAck: {
    noted: "Preso nota — numeri onesti fanno un piano onesto.",
    bmr: "Ed ecco il tuo primo numero: a riposo il tuo corpo brucia circa {bmr} kcal al giorno. Le prossime domande lo affinano.",
  },
  activityReplies: {
    sedentary: "Grazie per la risposta onesta — quasi tutti sparano alto qui, e poi è l'obiettivo a sparare alto su di loro.",
    light: "Bene — camminare conta più di quanto si pensi.",
    moderate: "Solido. Il numero darà per scontato che quegli allenamenti si facciano — tienimi onesto.",
    active: "Bene — questo ti compra più cibo. Preferisco alimentarti come si deve che tirare basso.",
    athlete: "Allora il numero ha del lavoro vero da alimentare. Preferisco nutrirlo come si deve che tirare basso.",
  },
  strugglesCloser: {
    none: "Meglio ancora. Se salta fuori qualcosa più avanti, dimmelo in chat — il piano sa piegarsi.",
    one: "Con questo sappiamo lavorare — il piano si costruisce attorno, non contro. Restano due domande veloci.",
    many: "Con ognuno di questi sappiamo lavorare — il piano si costruisce attorno, non contro. Restano due domande veloci.",
  },
  restrictions: {
    kidneys: "Preso nota. Da qui in poi il sodio viene valutato — e solo perché me l'hai chiesto.",
    ldl: "Preso nota. Da qui in poi i grassi saturi vengono valutati — e solo perché me l'hai chiesto.",
    ldlChained: "Anche i grassi saturi vengono valutati — stessa regola: solo ciò che dichiari.",
    declared: "Preso nota — vanno sul tuo profilo, e solo quelli vengono valutati.",
    none: "Allora non viene valutato nulla in più — quello che non è dichiarato non lo è mai. Puoi aggiungerne uno quando vuoi nelle impostazioni.",
    freeText: "E anche il testo libero va sul tuo profilo.",
  },
  invalid: {
    age: "Non sembra un'età — prova con qualcosa tipo 34.",
    height_cm: "In centimetri — qualcosa tipo 175.",
    weight_kg: "In chilogrammi — approssimare va bene.",
    target_weight_kg: "Un numero in kg — tipo 70.",
  },
  ambiguousAge: {
    line: "Voglio essere sicuro di aver letto bene — se intendevi l'anno {year}, mandami tutte e quattro le cifre.",
    confirm: "Ho {age} anni",
  },
  direction: {
    gain: "Sei a {weight} kg e chiedi di salire a {target} — da qui non è una crescita. Se l'obiettivo è cambiato possiamo invertirlo; altrimenti dammi un numero sopra {weight}.",
    lose: "Sei a {weight} kg e chiedi di scendere a {target} — da qui non è un calo. Se l'obiettivo è cambiato possiamo invertirlo; altrimenti dammi un numero sotto {weight}.",
    switchToLose: "Passa a perdere",
    switchToGain: "Passa a prendere",
    above: "Un numero sopra {weight}…",
    below: "Un numero sotto {weight}…",
  },
  switched: {
    gain: "Invertito — si prende, allora. Dove ti piacerebbe arrivare, in kg?",
    lose: "Invertito — si perde, allora. Dove ti piacerebbe arrivare, in kg? Più veloce qui non è meglio — è solo più difficile da mantenere.",
  },
  loseTail: " Più veloce qui non è meglio — è solo più difficile da mantenere.",
  capNoteTail: " Fa circa {kg} kg a settimana.",
  nothingApplies: "Niente di tutto ciò",
  goalEdit: {
    cleared: "Il tuo peso obiettivo non stava più con quell'obiettivo, quindi è stato azzerato — impostane uno nuovo.",
    worthSetting: "Registrato. Il tuo peso obiettivo però non sta più con il tuo obiettivo — vale la pena impostarne uno nuovo.",
  },
};

const ES: ChatCopy = {
  idlePlaceholder: "Escribe a Spud…",
  struggles: {
    stress: "Comer por estrés",
    night: "Picar de noche",
    binge: "Atracones",
    diets: "Dietas que no duraron",
    eatout: "Comer fuera a menudo",
    energy: "Poca energía",
    body: "Imagen corporal",
    metabolism: "Dudas con el metabolismo",
  },
  strugglesAsk: ["Ahora la parte que casi ninguna app toca. ¿Qué te ha costado? Elige lo que quieras — o nada. Esto orienta el apoyo, nunca un juicio."],
  quick: {
    struggles: { finish: "Listo", none: "Nada de esto" },
    restrictions: { finish: "Terminar", none: "Nada de esto" },
  },
  goalCards: {
    lose: {
      title: "Estás en buena compañía",
      body: "Alrededor del 42% de los adultos intenta perder peso en un año cualquiera. La diferencia aquí: tu objetivo se calcula bien, con un suelo que no cruzamos.",
      source: "Revisión sistemática de 72 estudios · n = 1,18 M de adultos",
    },
    gain: {
      title: "Menos raro de lo que parece",
      body: "Cerca del 23% de los hombres jóvenes y el 6% de las mujeres jóvenes intentó ganar peso activamente el año pasado. Es un objetivo real, con técnica real — pondremos un superávit que construya más de lo que rellena.",
      source: "Estudio canadiense de adultos jóvenes · n = 976",
    },
    maintain: {
      title: "El objetivo silencioso",
      body: "Alrededor del 23% de los adultos trabaja activamente para mantener su peso — el objetivo del que nadie habla, y merece un plan igual. Tus días se juzgan frente a quedarte donde estás.",
      source: "Metaanálisis de intentos de control de peso en el último año",
    },
  },
  goalFollowups: {
    gain: "Las mismas reglas que para todos aquí — números honestos, sin porras, sin vergüenza — solo apuntando arriba en vez de abajo.",
    maintain: "Y el camino fácil es el tuyo: no hay peso objetivo que elegir — planificamos alrededor de quedarte donde estás.",
  },
  struggleCards: {
    stress: {
      title: "Un patrón, no un defecto de carácter",
      body: "Cerca del 38% de los adultos come en respuesta a lo que siente al menos una vez al mes — para la mitad de ellos, cada semana. Ponerle nombre al patrón es casi todo el trabajo; el registro hace el resto.",
      source: "Estudio nacional de EE. UU., n = 5.863 · revisión, 2026",
    },
    night: {
      title: "A partir de las 20 h hay cola",
      body: "Más del 60% de los adultos come algo después de las 20 h, y alrededor de 1 de cada 4 personas que pican lo hace ya sobre todo de noche. No puntuamos cuándo comes — solo lo que suma el día.",
      source: "CivicScience, 1,2 M de respuestas",
    },
    binge: {
      title: "No estás solo en esto",
      body: "El trastorno por atracón es el trastorno alimentario más común — alrededor del 2,8% de los adultos cumple los criterios en algún momento, y el 17% de quienes empiezan un programa de peso da positivo en el cribado. Si los episodios se sienten fuera de control, un profesional ayuda más que cualquier app. Aquí un día duro es un dato, nunca un veredicto.",
      source: "NIMH (NCS-R) · estudio de 6.930 personas al inicio de un programa",
    },
    diets: {
      title: "Recuperarlo es la norma, no culpa tuya",
      body: "En 29 estudios a largo plazo, más de la mitad del peso perdido vuelve en dos años — más del 80% a los cinco. Fallan los métodos, no las personas. Tu plan aquí está dimensionado para poder sostenerse, no para impresionar.",
      source: "Metaanálisis de 29 estudios de pérdida de peso en EE. UU.",
    },
    eatout: {
      title: "Los platos de restaurante son los que más se desvían",
      body: "Las estimaciones se desvían más con lo que no cocinaste tú — y ahí es justo donde las fotos son buenas. Cuando no esté seguro lo diré, en vez de disimular.",
    },
    energy: {
      title: "La energía es la medida honesta",
      body: "Los días mal alimentados y la falta de energía viajan juntos — es una de las razones por las que rechazamos objetivos por debajo del suelo de seguridad. La comida es la mitad de la energía; miraremos la forma de tus días.",
    },
    body: {
      title: "Aquí la báscula no juzga",
      body: "Tendrás números sobre la comida, nunca comentarios sobre tu cuerpo. Tu objetivo fija las metas; aquí nada se compara con nadie.",
    },
    metabolism: {
      title: "Midamos en vez de preocuparnos",
      body: "Los metabolismos se parecen más de lo que dice internet — pero el tuyo es el tuyo, y dos semanas de registro honesto enseñan lo que hace de verdad. Eso gana a cualquier fórmula, la mía incluida.",
    },
  },
  dietsGainCard: {
    title: "Volver atrás es la norma, no culpa tuya",
    body: "Casi todos los intentos de cambiar de peso, en cualquier dirección, se revierten en un par de años — fallan los métodos, no las personas. Tu superávit aquí está dimensionado para poder sostenerse, no para impresionar.",
  },
  gainPaceCard: {
    title: "Ganar bien es lento a propósito",
    body: "Tu superávit se limita a cerca del {share}% por encima de lo que tu cuerpo quema en un día — la zona donde el músculo sigue el ritmo de la báscula. Casi todos los que lo consiguen empiezan por la proteína; la tuya la seguimos automáticamente.",
    source: "Encuesta a 168 adultos deportistas que buscaban ganar peso",
  },
  underAgeCard: {
    title: "eait es para {age} años en adelante",
    body: "La forma en que esta app fija objetivos de calorías no está pensada para un cuerpo que todavía está creciendo.",
  },
  underAge: {
    ask: "Lo siento — aquí tengo que parar. Si ha sido una errata, mándame tu edad de verdad.",
    confirm: "Es mi edad de verdad",
    placeholder: "Tu edad",
    stopped: [
      "Entonces aquí lo dejamos. Nada de lo que me has contado se guarda, y nada se ha enviado a ningún sitio — no hay ninguna cuenta que borrar.",
      "Vuelve a los {age} y aquí estaré.",
    ],
    endedPlaceholder: "eait es para {age} años en adelante",
  },
  belowHealthy: {
    title: "No puedo poner eso como objetivo",
    body: "El peso saludable más bajo para tu altura es de unos {kg} kg. No fijamos objetivos por debajo. Si estás trabajando otra cosa con un médico, hazle caso a él y no a esta app.",
  },
  weightAck: {
    noted: "Anotado — números honestos hacen un plan honesto.",
    bmr: "Y aquí va tu primer número: en reposo tu cuerpo quema unas {bmr} kcal al día. Las siguientes preguntas lo afinan.",
  },
  activityReplies: {
    sedentary: "Gracias por la respuesta honesta — casi todo el mundo se pasa aquí, y luego el objetivo se pasa con ellos.",
    light: "Bien — caminar cuenta más de lo que la gente cree.",
    moderate: "Sólido. El número dará por hecho que esos entrenamientos ocurren — mantenme honesto.",
    active: "Bien — eso te compra más comida. Prefiero alimentarlo bien que quedarme corto.",
    athlete: "Entonces el número tiene trabajo de verdad que alimentar. Prefiero alimentarlo bien que quedarme corto.",
  },
  strugglesCloser: {
    none: "Mejor aún. Si aparece algo más adelante, dímelo en el chat — el plan sabe doblarse.",
    one: "Con eso sabemos trabajar — el plan se construye alrededor, no en contra. Quedan dos preguntas rápidas.",
    many: "Con cada una de estas sabemos trabajar — el plan se construye alrededor, no en contra. Quedan dos preguntas rápidas.",
  },
  restrictions: {
    kidneys: "Anotado. A partir de ahora se puntúa el sodio — y solo porque lo has pedido.",
    ldl: "Anotado. A partir de ahora se puntúan las grasas saturadas — y solo porque lo has pedido.",
    ldlChained: "Las grasas saturadas también se puntúan — misma regla: solo lo que declares.",
    declared: "Anotado — van a tu perfil, y solo eso se puntúa.",
    none: "Entonces no se puntúa nada extra — lo que no se declara nunca lo está. Puedes añadir algo cuando quieras en ajustes.",
    freeText: "Y el texto libre va a tu perfil también.",
  },
  invalid: {
    age: "Eso no parece una edad — prueba con algo como 34.",
    height_cm: "En centímetros — algo como 175.",
    weight_kg: "En kilogramos — aproximado vale.",
    target_weight_kg: "Un número en kg — como 70.",
  },
  ambiguousAge: {
    line: "Quiero estar seguro de haberlo leído bien — si querías decir el año {year}, mándame las cuatro cifras.",
    confirm: "Tengo {age}",
  },
  direction: {
    gain: "Estás en {weight} kg y pides subir hasta {target} — desde aquí eso no es subir. Si el objetivo ha cambiado, lo cambiamos; si no, dame un número por encima de {weight}.",
    lose: "Estás en {weight} kg y pides bajar hasta {target} — desde aquí eso no es bajar. Si el objetivo ha cambiado, lo cambiamos; si no, dame un número por debajo de {weight}.",
    switchToLose: "Cambiar a perder",
    switchToGain: "Cambiar a ganar",
    above: "Un número por encima de {weight}…",
    below: "Un número por debajo de {weight}…",
  },
  switched: {
    gain: "Cambiado — ganar, entonces. ¿Dónde te gustaría llegar, en kg?",
    lose: "Cambiado — perder, entonces. ¿Dónde te gustaría llegar, en kg? Más rápido no es mejor aquí — solo es más difícil de sostener.",
  },
  loseTail: " Más rápido no es mejor aquí — solo es más difícil de sostener.",
  capNoteTail: " Eso son unos {kg} kg por semana.",
  nothingApplies: "Nada de esto",
  goalEdit: {
    cleared: "Tu peso objetivo ya no encajaba con ese objetivo, así que se ha borrado — pon uno nuevo.",
    worthSetting: "Registrado. Aunque tu peso objetivo ya no encaja con tu objetivo — merece la pena poner uno nuevo.",
  },
};

const VI: ChatCopy = {
  idlePlaceholder: "Nhắn cho Spud…",
  struggles: {
    stress: "Ăn khi căng thẳng",
    night: "Ăn vặt đêm",
    binge: "Những cơn ăn mất kiểm soát",
    diets: "Ăn kiêng không trụ được",
    eatout: "Ăn ngoài nhiều",
    energy: "Hay uể oải",
    body: "Hình ảnh cơ thể",
    metabolism: "Lo về trao đổi chất",
  },
  strugglesAsk: ["Giờ đến phần mà hầu hết ứng dụng bỏ qua. Điều gì đã khó với bạn? Chọn bao nhiêu cũng được — hoặc không chọn gì. Việc này định hình cách hỗ trợ, không bao giờ để phán xét."],
  quick: {
    struggles: { finish: "Xong", none: "Không cái nào" },
    restrictions: { finish: "Hoàn tất", none: "Không có gì" },
  },
  goalCards: {
    lose: {
      title: "Bạn không hề đơn độc",
      body: "Khoảng 42% người trưởng thành cố giảm cân trong một năm bất kỳ. Khác biệt ở đây: mục tiêu của bạn được tính đàng hoàng, với một mức sàn chúng mình không vượt qua.",
      source: "Tổng quan hệ thống 72 nghiên cứu · n = 1,18 triệu người trưởng thành",
    },
    gain: {
      title: "Không hiếm như bạn tưởng",
      body: "Khoảng 23% nam giới trẻ và 6% nữ giới trẻ đã chủ động cố tăng cân trong năm qua. Đây là mục tiêu thật, có kỹ thuật thật — chúng mình sẽ đặt mức dư vừa đủ để xây cơ hơn là tích mỡ.",
      source: "Nghiên cứu trên người trẻ tại Canada · n = 976",
    },
    maintain: {
      title: "Mục tiêu thầm lặng",
      body: "Khoảng 23% người trưởng thành đang chủ động giữ cân — mục tiêu chẳng ai đăng lên mạng, và nó vẫn xứng đáng có một kế hoạch. Ngày của bạn sẽ được chấm theo việc giữ nguyên.",
      source: "Phân tích tổng hợp các nỗ lực kiểm soát cân nặng trong năm qua",
    },
  },
  goalFollowups: {
    gain: "Luật vẫn như với mọi người ở đây — số liệu thành thật, không tung hô, không xấu hổ — chỉ là hướng lên thay vì hướng xuống.",
    maintain: "Và bạn được đi đường dễ: không phải chọn cân nặng mục tiêu — chúng mình lên kế hoạch quanh việc giữ nguyên.",
  },
  struggleCards: {
    stress: {
      title: "Đây là một khuôn mẫu, không phải lỗi tính cách",
      body: "Khoảng 38% người trưởng thành ăn để phản ứng với cảm xúc ít nhất mỗi tháng một lần — với khoảng một nửa trong số đó là hằng tuần. Gọi được tên khuôn mẫu đã là phần lớn công việc; phần còn lại để nhật ký lo.",
      source: "Nghiên cứu toàn quốc tại Mỹ, n = 5.863 · bài tổng quan, 2026",
    },
    night: {
      title: "Sau 8 giờ tối khá đông vui",
      body: "Hơn 60% người trưởng thành ăn gì đó sau 8 giờ tối, và khoảng 1 trong 4 người hay ăn vặt giờ chủ yếu ăn vào khuya. Chúng mình không chấm giờ bạn ăn — chỉ chấm tổng của cả ngày.",
      source: "CivicScience, 1,2 triệu phản hồi",
    },
    binge: {
      title: "Bạn không một mình trong chuyện này",
      body: "Rối loạn ăn uống vô độ là rối loạn ăn uống phổ biến nhất — khoảng 2,8% người trưởng thành đáp ứng tiêu chuẩn vào một lúc nào đó, và 17% người bắt đầu một chương trình giảm cân có kết quả sàng lọc dương tính. Nếu những cơn đó thấy ngoài tầm kiểm soát, một bác sĩ giúp được nhiều hơn bất kỳ ứng dụng nào. Ở đây, một ngày khó khăn là dữ liệu, không bao giờ là bản án.",
      source: "NIMH (NCS-R) · nghiên cứu trên 6.930 người mới bắt đầu chương trình",
    },
    diets: {
      title: "Tăng lại là chuyện thường, không phải lỗi của bạn",
      body: "Qua 29 nghiên cứu dài hạn, hơn một nửa số cân đã giảm quay lại trong vòng hai năm — hơn 80% sau năm năm. Đó là phương pháp thất bại, không phải con người. Kế hoạch của bạn ở đây được đo cho vừa sức giữ, không phải để gây ấn tượng.",
      source: "Phân tích tổng hợp 29 nghiên cứu giảm cân tại Mỹ",
    },
    eatout: {
      title: "Đồ ăn nhà hàng lệch nhiều nhất",
      body: "Ước lượng lệch nhiều nhất với món bạn không tự nấu — và đó đúng là chỗ ảnh chụp làm tốt nhất. Khi không chắc mình sẽ nói thẳng, thay vì làm ra vẻ.",
    },
    energy: {
      title: "Năng lượng là thước đo thành thật",
      body: "Những ngày ăn thiếu và cảm giác uể oải luôn đi cùng nhau — đó là một lý do chúng mình từ chối mục tiêu dưới mức sàn an toàn. Đồ ăn là một nửa của năng lượng; chúng mình sẽ nhìn dáng của những ngày bạn trải qua.",
    },
    body: {
      title: "Ở đây cái cân không phán xét",
      body: "Bạn sẽ nhận con số về đồ ăn, không bao giờ là nhận xét về cơ thể. Mục tiêu của bạn đặt ra chỉ tiêu; ở đây không có gì đem so với người khác.",
    },
    metabolism: {
      title: "Cứ đo thay vì lo",
      body: "Trao đổi chất giữa người này người kia chênh nhau ít hơn internet nói — nhưng của bạn là của bạn, và hai tuần ghi chép thành thật sẽ cho thấy nó thật sự làm gì. Cái đó hơn mọi công thức, kể cả công thức của mình.",
    },
  },
  dietsGainCard: {
    title: "Quay lại chỗ cũ là chuyện thường, không phải lỗi của bạn",
    body: "Phần lớn các nỗ lực thay đổi cân nặng, theo cả hai hướng, đều đảo ngược sau vài năm — phương pháp thất bại, không phải con người. Mức dư của bạn ở đây được đo cho vừa sức giữ, không phải để gây ấn tượng.",
  },
  gainPaceCard: {
    title: "Tăng tốt thì chậm, và đó là cố ý",
    body: "Mức dư của bạn được giới hạn ở khoảng {share}% trên mức cơ thể đốt trong một ngày — vùng mà cơ bắp theo kịp cái cân. Hầu hết những người tăng cân thành công đều đi trước bằng đạm; đạm của bạn chúng mình theo dõi tự động.",
    source: "Khảo sát 168 người trưởng thành tập luyện muốn tăng cân",
  },
  underAgeCard: {
    title: "eait dành cho {age} tuổi trở lên",
    body: "Cách ứng dụng này đặt mục tiêu calo không được thiết kế cho một cơ thể vẫn đang lớn.",
  },
  underAge: {
    ask: "Xin lỗi — mình phải dừng ở đây. Nếu chỉ là gõ nhầm, bạn gửi lại tuổi thật nhé.",
    confirm: "Đó là tuổi thật của mình",
    placeholder: "Tuổi của bạn",
    stopped: [
      "Vậy thì chúng ta dừng ở đây. Không điều gì bạn kể được giữ lại, và không có gì được gửi đi đâu cả — không có tài khoản nào để xoá.",
      "Quay lại khi {age} tuổi nhé, mình vẫn ở đây.",
    ],
    endedPlaceholder: "eait dành cho {age} tuổi trở lên",
  },
  belowHealthy: {
    title: "Mình không đặt được mức đó làm mục tiêu",
    body: "Cân nặng khoẻ mạnh thấp nhất với chiều cao của bạn là khoảng {kg} kg. Chúng mình không đặt mục tiêu dưới mức đó. Nếu bạn đang theo một hướng khác cùng bác sĩ, hãy nghe bác sĩ chứ đừng nghe ứng dụng này.",
  },
  weightAck: {
    noted: "Ghi nhận — số liệu thành thật thì kế hoạch mới thành thật.",
    bmr: "Và đây là con số đầu tiên của bạn: lúc nghỉ, cơ thể bạn đốt khoảng {bmr} kcal mỗi ngày. Mấy câu tiếp theo sẽ làm nó chính xác hơn.",
  },
  activityReplies: {
    sedentary: "Cảm ơn vì câu trả lời thành thật — phần lớn mọi người khai quá tay ở chỗ này, rồi con số cũng quá tay với họ.",
    light: "Tốt — đi bộ đáng giá hơn người ta tưởng.",
    moderate: "Chắc chắn. Con số sẽ giả định là những buổi tập đó có diễn ra — nhớ giữ mình thành thật nhé.",
    active: "Tốt — điều đó mua thêm đồ ăn cho bạn. Mình thà nạp đủ còn hơn đoán thấp.",
    athlete: "Vậy thì con số có việc thật để nuôi. Mình thà nạp đủ còn hơn đoán thấp.",
  },
  strugglesCloser: {
    none: "Càng tốt. Nếu sau này có gì xuất hiện, cứ nói với mình trong chat — kế hoạch uốn được.",
    one: "Chuyện đó chúng mình biết cách xử lý — kế hoạch sẽ được dựng quanh nó, chứ không chống lại nó. Còn hai câu ngắn nữa thôi.",
    many: "Từng chuyện một chúng mình đều biết cách xử lý — kế hoạch sẽ được dựng quanh chúng, chứ không chống lại chúng. Còn hai câu ngắn nữa thôi.",
  },
  restrictions: {
    kidneys: "Ghi nhận. Từ giờ natri sẽ được chấm — và chỉ vì bạn yêu cầu.",
    ldl: "Ghi nhận. Từ giờ chất béo bão hoà sẽ được chấm — và chỉ vì bạn yêu cầu.",
    ldlChained: "Chất béo bão hoà cũng được chấm — vẫn luật đó: chỉ những gì bạn khai.",
    declared: "Ghi nhận — những mục đó vào hồ sơ của bạn, và chỉ chúng được chấm.",
    none: "Vậy sẽ không có gì thêm được chấm — thứ không khai thì không bao giờ bị chấm. Bạn có thể thêm bất cứ lúc nào trong cài đặt.",
    freeText: "Và phần viết tự do cũng vào hồ sơ của bạn.",
  },
  invalid: {
    age: "Cái đó trông không giống một số tuổi — thử kiểu như 34 xem.",
    height_cm: "Tính bằng xăng-ti-mét — kiểu như 175.",
    weight_kg: "Tính bằng ki-lô-gam — áng chừng là được.",
    target_weight_kg: "Một số tính bằng kg — ví dụ 70.",
  },
  ambiguousAge: {
    line: "Mình muốn chắc là đọc đúng — nếu ý bạn là năm {year}, gửi đủ bốn chữ số nhé.",
    confirm: "Mình {age} tuổi",
  },
  direction: {
    gain: "Bạn đang ở {weight} kg mà lại muốn tăng lên {target} — từ đây thì đó không phải là tăng. Nếu mục tiêu đã đổi, chúng mình đổi theo; còn không thì cho mình một số trên {weight}.",
    lose: "Bạn đang ở {weight} kg mà lại muốn giảm xuống {target} — từ đây thì đó không phải là giảm. Nếu mục tiêu đã đổi, chúng mình đổi theo; còn không thì cho mình một số dưới {weight}.",
    switchToLose: "Chuyển sang giảm cân",
    switchToGain: "Chuyển sang tăng cân",
    above: "Một số trên {weight}…",
    below: "Một số dưới {weight}…",
  },
  switched: {
    gain: "Đã chuyển — vậy là tăng cân. Bạn muốn về mức nào, tính bằng kg?",
    lose: "Đã chuyển — vậy là giảm cân. Bạn muốn về mức nào, tính bằng kg? Nhanh hơn không có nghĩa là tốt hơn — chỉ khó giữ hơn thôi.",
  },
  loseTail: " Nhanh hơn không có nghĩa là tốt hơn — chỉ khó giữ hơn thôi.",
  capNoteTail: " Tính ra khoảng {kg} kg mỗi tuần.",
  nothingApplies: "Không có gì",
  goalEdit: {
    cleared: "Cân nặng mục tiêu của bạn không còn hợp với mục tiêu đó nữa nên đã được xoá — đặt lại một mức mới nhé.",
    worthSetting: "Đã ghi. Có điều cân nặng mục tiêu của bạn không còn hợp với mục tiêu nữa — nên đặt lại một mức mới.",
  },
};

const ID: ChatCopy = {
  idlePlaceholder: "Kirim pesan ke Spud…",
  struggles: {
    stress: "Makan saat stres",
    night: "Ngemil malam",
    binge: "Makan berlebihan tak terkendali",
    diets: "Diet yang tidak bertahan",
    eatout: "Sering makan di luar",
    energy: "Kurang energi",
    body: "Citra tubuh",
    metabolism: "Khawatir soal metabolisme",
  },
  strugglesAsk: ["Sekarang bagian yang kebanyakan aplikasi lewati. Apa yang selama ini terasa berat? Pilih berapa pun — atau tidak sama sekali. Ini membentuk dukungannya, bukan penilaian."],
  quick: {
    struggles: { finish: "Selesai", none: "Tidak satu pun" },
    restrictions: { finish: "Selesaikan", none: "Tidak ada" },
  },
  goalCards: {
    lose: {
      title: "Kamu tidak sendirian",
      body: "Sekitar 42% orang dewasa mencoba menurunkan berat badan dalam satu tahun mana pun. Bedanya di sini: targetmu dihitung dengan benar, dengan batas bawah yang tidak kami lewati.",
      source: "Tinjauan sistematis 72 studi · n = 1,18 juta orang dewasa",
    },
    gain: {
      title: "Tidak sejarang yang dikira",
      body: "Sekitar 23% pria muda dan 6% wanita muda aktif mencoba menaikkan berat badan tahun lalu. Ini tujuan nyata dengan teknik nyata — kami akan menyetel surplus yang lebih banyak membangun daripada menumpuk.",
      source: "Studi dewasa muda di Kanada · n = 976",
    },
    maintain: {
      title: "Tujuan yang jarang disebut",
      body: "Sekitar 23% orang dewasa aktif berusaha menjaga berat badannya — tujuan yang tidak ada yang posting, dan tetap layak punya rencana. Harimu dinilai terhadap tetap di tempat.",
      source: "Meta-analisis upaya pengendalian berat badan setahun terakhir",
    },
  },
  goalFollowups: {
    gain: "Aturannya sama seperti untuk semua orang di sini — angka jujur, tanpa sorak-sorai, tanpa rasa malu — hanya arahnya ke atas, bukan ke bawah.",
    maintain: "Dan jalan mudahnya jadi milikmu: tidak ada berat target yang harus dipilih — kami merencanakan di sekitar tetap di tempat.",
  },
  struggleCards: {
    stress: {
      title: "Sebuah pola, bukan cacat karakter",
      body: "Sekitar 38% orang dewasa makan sebagai respons terhadap perasaan setidaknya sebulan sekali — bagi separuhnya, setiap minggu. Menamai polanya sudah sebagian besar pekerjaannya; sisanya dikerjakan catatan.",
      source: "Studi nasional AS, n = 5.863 · tinjauan, 2026",
    },
    night: {
      title: "Jam 8 malam itu ramai",
      body: "Lebih dari 60% orang dewasa makan sesuatu setelah jam 8 malam, dan sekitar 1 dari 4 orang yang ngemil kini kebanyakan makan larut malam. Kami tidak menilai kapan kamu makan — hanya jumlah harinya.",
      source: "CivicScience, 1,2 juta respons",
    },
    binge: {
      title: "Kamu tidak sendirian dalam hal ini",
      body: "Gangguan makan berlebihan adalah gangguan makan yang paling umum — sekitar 2,8% orang dewasa memenuhi kriterianya pada suatu titik, dan 17% orang yang memulai program berat badan positif saat disaring. Kalau episodenya terasa di luar kendali, seorang klinisi lebih menolong daripada aplikasi mana pun. Di sini, hari yang berat adalah data, bukan vonis.",
      source: "NIMH (NCS-R) · studi terhadap 6.930 orang yang memulai program",
    },
    diets: {
      title: "Naik lagi itu wajar, bukan salahmu",
      body: "Di 29 studi jangka panjang, lebih dari separuh berat yang turun kembali dalam dua tahun — lebih dari 80% dalam lima tahun. Yang gagal metodenya, bukan orangnya. Rencanamu di sini diukur supaya bisa dijaga, bukan supaya mengesankan.",
      source: "Meta-analisis 29 studi penurunan berat badan di AS",
    },
    eatout: {
      title: "Piring restoran paling meleset",
      body: "Perkiraan paling meleset pada makanan yang bukan kamu masak — dan di situlah foto paling berguna. Kalau aku ragu, aku bilang, bukan pura-pura tahu.",
    },
    energy: {
      title: "Energi adalah ukuran yang jujur",
      body: "Hari yang kurang asupan dan energi rendah selalu jalan bareng — itu salah satu alasan kami menolak target di bawah batas aman. Makanan adalah separuh dari energi; kami akan memperhatikan bentuk hari-harimu.",
    },
    body: {
      title: "Di sini timbangan bukan hakim",
      body: "Kamu akan dapat angka tentang makanan, tidak pernah komentar tentang tubuhmu. Tujuanmu yang menetapkan targetnya; di sini tidak ada yang dibandingkan dengan siapa pun.",
    },
    metabolism: {
      title: "Ukur saja daripada cemas",
      body: "Metabolisme orang berbeda lebih sedikit daripada kata internet — tapi punyamu ya punyamu, dan dua minggu mencatat dengan jujur menunjukkan apa yang sebenarnya terjadi. Itu mengalahkan rumus apa pun, termasuk rumusku.",
    },
  },
  dietsGainCard: {
    title: "Balik lagi itu wajar, bukan salahmu",
    body: "Kebanyakan upaya mengubah berat badan, ke arah mana pun, berbalik dalam beberapa tahun — metodenya yang gagal, bukan orangnya. Surplusmu di sini diukur supaya bisa dijaga, bukan supaya mengesankan.",
  },
  gainPaceCard: {
    title: "Naik yang benar memang pelan",
    body: "Surplusmu dibatasi sekitar {share}% di atas yang tubuhmu bakar dalam sehari — zona di mana otot masih mengejar timbangan. Kebanyakan yang berhasil memulai dari protein; punyamu kami lacak otomatis.",
    source: "Survei terhadap 168 orang dewasa aktif yang berusaha menaikkan berat badan",
  },
  underAgeCard: {
    title: "eait untuk usia {age} ke atas",
    body: "Cara aplikasi ini menetapkan target kalori tidak dirancang untuk tubuh yang masih tumbuh.",
  },
  underAge: {
    ask: "Maaf — aku harus berhenti di sini. Kalau tadi salah ketik, kirim saja umur aslimu.",
    confirm: "Itu umur asliku",
    placeholder: "Umurmu",
    stopped: [
      "Kalau begitu kita berhenti di sini. Tidak ada yang kamu ceritakan yang disimpan, dan tidak ada yang dikirim ke mana pun — tidak ada akun yang perlu dihapus.",
      "Datang lagi saat {age} tahun, aku akan ada di sini.",
    ],
    endedPlaceholder: "eait untuk usia {age} ke atas",
  },
  belowHealthy: {
    title: "Aku tidak bisa menetapkan itu sebagai target",
    body: "Berat sehat terendah untuk tinggimu sekitar {kg} kg. Kami tidak menetapkan tujuan di bawah itu. Kalau kamu sedang menjalani hal lain bersama dokter, ikuti dokternya, bukan aplikasi ini.",
  },
  weightAck: {
    noted: "Dicatat — angka yang jujur bikin rencana yang jujur.",
    bmr: "Dan ini angka pertamamu: saat istirahat, tubuhmu membakar sekitar {bmr} kcal sehari. Pertanyaan berikutnya akan mempertajamnya.",
  },
  activityReplies: {
    sedentary: "Terima kasih untuk jawaban jujurnya — kebanyakan orang melebih-lebihkan yang satu ini, lalu targetnya ikut melebih-lebihkan mereka.",
    light: "Bagus — jalan kaki bernilai lebih dari yang orang kira.",
    moderate: "Mantap. Angkanya akan berasumsi latihan itu benar-benar terjadi — jaga aku tetap jujur, ya.",
    active: "Bagus — itu membelikanmu lebih banyak makanan. Aku lebih suka mengisi dengan benar daripada menebak terlalu rendah.",
    athlete: "Kalau begitu angkanya punya kerja nyata untuk diisi. Aku lebih suka mengisi dengan benar daripada menebak terlalu rendah.",
  },
  strugglesCloser: {
    none: "Lebih bagus lagi. Kalau nanti ada yang muncul, bilang di chat — rencananya bisa menyesuaikan.",
    one: "Yang itu kami tahu cara menanganinya — rencananya dibangun di sekitarnya, bukan melawannya. Tinggal dua pertanyaan singkat.",
    many: "Masing-masing dari itu kami tahu cara menanganinya — rencananya dibangun di sekitarnya, bukan melawannya. Tinggal dua pertanyaan singkat.",
  },
  restrictions: {
    kidneys: "Dicatat. Mulai sekarang natrium dinilai — dan hanya karena kamu memintanya.",
    ldl: "Dicatat. Mulai sekarang lemak jenuh dinilai — dan hanya karena kamu memintanya.",
    ldlChained: "Lemak jenuh juga dinilai — aturan yang sama: hanya yang kamu sebutkan.",
    declared: "Dicatat — itu masuk ke profilmu, dan hanya itu yang dinilai.",
    none: "Kalau begitu tidak ada tambahan yang dinilai — yang tidak disebutkan tidak pernah dinilai. Kamu bisa menambahkan kapan saja di pengaturan.",
    freeText: "Dan teks bebasnya juga masuk ke profilmu.",
  },
  invalid: {
    age: "Itu tidak kelihatan seperti umur — coba semacam 34.",
    height_cm: "Dalam sentimeter — semacam 175.",
    weight_kg: "Dalam kilogram — kira-kira saja tidak apa-apa.",
    target_weight_kg: "Angka dalam kg — misalnya 70.",
  },
  ambiguousAge: {
    line: "Aku mau pastikan tidak salah baca — kalau maksudmu tahun {year}, kirim keempat angkanya.",
    confirm: "Umurku {age}",
  },
  direction: {
    gain: "Kamu di {weight} kg dan minta naik ke {target} — dari sini itu bukan kenaikan. Kalau tujuannya berubah, kita bisa ganti; kalau tidak, beri aku angka di atas {weight}.",
    lose: "Kamu di {weight} kg dan minta turun ke {target} — dari sini itu bukan penurunan. Kalau tujuannya berubah, kita bisa ganti; kalau tidak, beri aku angka di bawah {weight}.",
    switchToLose: "Ganti ke menurunkan",
    switchToGain: "Ganti ke menaikkan",
    above: "Angka di atas {weight}…",
    below: "Angka di bawah {weight}…",
  },
  switched: {
    gain: "Diganti — jadi menaikkan. Kamu ingin sampai di angka berapa, dalam kg?",
    lose: "Diganti — jadi menurunkan. Kamu ingin sampai di angka berapa, dalam kg? Lebih cepat bukan berarti lebih baik — hanya lebih sulit dijaga.",
  },
  loseTail: " Lebih cepat bukan berarti lebih baik — hanya lebih sulit dijaga.",
  capNoteTail: " Itu sekitar {kg} kg per minggu.",
  nothingApplies: "Tidak ada",
  goalEdit: {
    cleared: "Berat targetmu sudah tidak cocok dengan tujuan itu, jadi dihapus — tetapkan yang baru.",
    worthSetting: "Tercatat. Tapi berat targetmu sudah tidak cocok dengan tujuanmu — sebaiknya tetapkan yang baru.",
  },
};

const RU: ChatCopy = {
  idlePlaceholder: "Написать Spud…",
  struggles: {
    stress: "Заедаю стресс",
    night: "Ночные перекусы",
    binge: "Приступы переедания",
    diets: "Диеты, которые не удержались",
    eatout: "Часто ем вне дома",
    energy: "Мало сил",
    body: "Отношение к телу",
    metabolism: "Тревога про обмен веществ",
  },
  strugglesAsk: ["Теперь то, что большинство приложений пропускает. Что давалось тяжело? Отметь что угодно — или ничего. Это настраивает поддержку, а не оценку."],
  quick: {
    struggles: { finish: "Готово", none: "Ничего из этого" },
    restrictions: { finish: "Завершить", none: "Ничего не подходит" },
  },
  goalCards: {
    lose: {
      title: "Ты в хорошей компании",
      body: "Около 42% взрослых пробуют похудеть в любой отдельно взятый год. Разница здесь: твоя цель считается как следует, с порогом, ниже которого мы не идём.",
      source: "Систематический обзор 72 исследований · n = 1,18 млн взрослых",
    },
    gain: {
      title: "Реже кажется, чем встречается",
      body: "Примерно 23% молодых мужчин и 6% молодых женщин за прошлый год осознанно пытались набрать вес. Это настоящая цель с настоящей техникой — мы поставим профицит, который строит больше, чем откладывает.",
      source: "Канадское исследование молодых взрослых · n = 976",
    },
    maintain: {
      title: "Тихая цель",
      body: "Около 23% взрослых осознанно работают над тем, чтобы удержать вес — цель, о которой никто не пишет, и она всё равно заслуживает плана. Твои дни будут оцениваться по тому, держишься ли ты на месте.",
      source: "Метаанализ попыток контроля веса за последний год",
    },
  },
  goalFollowups: {
    gain: "Правила те же, что и у всех здесь — честные цифры, без подбадриваний и без стыда — просто направленные вверх, а не вниз.",
    maintain: "И лёгкая дорога твоя: целевой вес выбирать не нужно — планируем вокруг того, чтобы остаться на месте.",
  },
  struggleCards: {
    stress: {
      title: "Это паттерн, а не изъян характера",
      body: "Около 38% взрослых едят в ответ на чувства хотя бы раз в месяц — примерно у половины из них это происходит еженедельно. Назвать паттерн — уже большая часть работы; остальное делает дневник.",
      source: "Национальное исследование в США, n = 5863 · обзор, 2026",
    },
    night: {
      title: "После восьми вечера людно",
      body: "Больше 60% взрослых что-то едят после 20:00, а примерно каждый четвёртый из тех, кто перекусывает, теперь ест в основном поздно вечером. Мы не оцениваем, когда ты ешь — только то, что сложилось за день.",
      source: "CivicScience, 1,2 млн ответов",
    },
    binge: {
      title: "Ты в этом не один",
      body: "Компульсивное переедание — самое распространённое расстройство пищевого поведения: около 2,8% взрослых в какой-то момент отвечают его критериям, а 17% тех, кто начинает программу по весу, дают положительный скрининг. Если приступы ощущаются неуправляемыми, врач поможет больше любого приложения. Здесь тяжёлый день — это данные, а не приговор.",
      source: "NIMH (NCS-R) · исследование 6930 начавших программу",
    },
    diets: {
      title: "Возврат веса — это норма, а не твоя вина",
      body: "По 29 длительным исследованиям больше половины сброшенного возвращается за два года, а за пять — больше 80%. Это подводят методы, а не люди. Твой план здесь рассчитан так, чтобы его можно было удержать, а не чтобы впечатлять.",
      source: "Метаанализ 29 американских исследований похудения",
    },
    eatout: {
      title: "Ресторанные тарелки уводят сильнее всего",
      body: "Оценки уплывают сильнее всего на еде, которую ты не готовил сам, — и именно с этим фотографии справляются лучше всего. Когда я не уверен, я так и скажу, а не сделаю вид.",
    },
    energy: {
      title: "Энергия — честная метрика",
      body: "Недоеденные дни и упадок сил ходят вместе — это одна из причин, почему мы отказываемся ставить цели ниже порога безопасности. Еда — половина энергии; будем смотреть на форму твоих дней.",
    },
    body: {
      title: "Здесь весы не судья",
      body: "Ты будешь получать цифры про еду и никогда — комментарии про своё тело. Цели задаёт твоя задача; здесь ничто не сравнивается ни с кем.",
    },
    metabolism: {
      title: "Давай измерим, а не будем волноваться",
      body: "Обмен веществ у людей различается меньше, чем говорит интернет, — но твой есть твой, и две недели честных записей покажут, что он делает на самом деле. Это лучше любой формулы, включая мою.",
    },
  },
  dietsGainCard: {
    title: "Откат — это норма, а не твоя вина",
    body: "Большинство попыток изменить вес в любую сторону откатываются за пару лет — подводят методы, а не люди. Твой профицит здесь рассчитан так, чтобы его можно было удержать, а не чтобы впечатлять.",
  },
  gainPaceCard: {
    title: "Набирать хорошо — намеренно медленно",
    body: "Твой профицит ограничен примерно {share}% сверх того, что тело сжигает за день, — зона, где мышцы успевают за весами. Большинство тех, у кого получается, начинают с белка; твой мы считаем автоматически.",
    source: "Опрос 168 тренирующихся взрослых, набиравших вес",
  },
  underAgeCard: {
    title: "eait — с {age} лет",
    body: "То, как это приложение ставит цели по калориям, не рассчитано на тело, которое ещё растёт.",
  },
  underAge: {
    ask: "Извини — здесь мне придётся остановиться. Если это опечатка, просто пришли настоящий возраст.",
    confirm: "Это мой настоящий возраст",
    placeholder: "Твой возраст",
    stopped: [
      "Тогда на этом мы остановимся. Ничего из сказанного не сохраняется и никуда не отправлялось — удалять нечего, аккаунта нет.",
      "Возвращайся в {age} — я буду здесь.",
    ],
    endedPlaceholder: "eait — с {age} лет",
  },
  belowHealthy: {
    title: "Не могу поставить это как цель",
    body: "Самый низкий здоровый вес для твоего роста — около {kg} кг. Ниже мы цель не ставим. Если ты работаешь над чем-то другим с врачом, слушай его, а не это приложение.",
  },
  weightAck: {
    noted: "Записал — честные цифры дают честный план.",
    bmr: "И вот твоя первая цифра: в покое тело сжигает около {bmr} ккал в день. Следующие вопросы её уточнят.",
  },
  activityReplies: {
    sedentary: "Спасибо за честный ответ — здесь большинство завышает, а потом цель завышает уже им.",
    light: "Хорошо — прогулки значат больше, чем принято думать.",
    moderate: "Солидно. Цифра будет исходить из того, что эти тренировки действительно случаются, — держи меня в честности.",
    active: "Хорошо — это покупает тебе больше еды. Лучше накормить как следует, чем занизить наугад.",
    athlete: "Тогда цифре есть что питать. Лучше накормить как следует, чем занизить наугад.",
  },
  strugglesCloser: {
    none: "Тем лучше. Если что-то появится позже, скажи мне в чате — план умеет гнуться.",
    one: "С этим мы умеем работать — план строится вокруг, а не вопреки. Осталось два коротких вопроса.",
    many: "С каждым из этого мы умеем работать — план строится вокруг, а не вопреки. Осталось два коротких вопроса.",
  },
  restrictions: {
    kidneys: "Записал. С этого момента натрий оценивается — и только потому, что ты попросил.",
    ldl: "Записал. С этого момента насыщенные жиры оцениваются — и только потому, что ты попросил.",
    ldlChained: "Насыщенные жиры тоже оцениваются — правило то же: только то, что ты указал.",
    declared: "Записал — это уходит в профиль, и оценивается только оно.",
    none: "Тогда ничего дополнительно не оценивается — неуказанное не оценивается никогда. Добавить можно в любой момент в настройках.",
    freeText: "И свободный текст тоже уходит в профиль.",
  },
  invalid: {
    age: "На возраст не похоже — попробуй что-то вроде 34.",
    height_cm: "В сантиметрах — что-то вроде 175.",
    weight_kg: "В килограммах — примерно нормально.",
    target_weight_kg: "Число в кг — например 70.",
  },
  ambiguousAge: {
    line: "Хочу убедиться, что понял правильно: если ты имел в виду {year} год, пришли все четыре цифры.",
    confirm: "Мне {age}",
  },
  direction: {
    gain: "Ты на {weight} кг и просишь набрать до {target} — отсюда это не набор. Если цель поменялась, можем переключить; иначе дай число больше {weight}.",
    lose: "Ты на {weight} кг и просишь сбросить до {target} — отсюда это не сброс. Если цель поменялась, можем переключить; иначе дай число меньше {weight}.",
    switchToLose: "Переключить на похудение",
    switchToGain: "Переключить на набор",
    above: "Число больше {weight}…",
    below: "Число меньше {weight}…",
  },
  switched: {
    gain: "Переключил — значит набираем. Куда хочешь прийти, в кг?",
    lose: "Переключил — значит худеем. Куда хочешь прийти, в кг? Быстрее здесь не значит лучше — просто труднее удержать.",
  },
  loseTail: " Быстрее здесь не значит лучше — просто труднее удержать.",
  capNoteTail: " Это примерно {kg} кг в неделю.",
  nothingApplies: "Ничего не подходит",
  goalEdit: {
    cleared: "Твой целевой вес больше не подходил к этой цели, поэтому он сброшен — поставь новый.",
    worthSetting: "Записал. Правда, целевой вес больше не сходится с твоей целью — стоит поставить новый.",
  },
};

export const CHAT_COPY: Localized<ChatCopy> = { en: EN, fr: FR, de: DE, it: IT, es: ES, vi: VI, id: ID, ru: RU };

/** What Spud says back, in one language. English for one nobody has written yet. */
export const chatCopyFor = (lang: Lang): ChatCopy => t(lang)(CHAT_COPY);
