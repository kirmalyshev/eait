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
import { FIRST_MEAL_COPY, type FirstMealCopy } from "./first-meal-copy.ts";
import type { ActivityLevel, Goal, Lang } from "./types.ts";
// TYPE-ONLY, so the cycle with `onboarding-chat.ts` is erased at build. These records used to be
// keyed by bare `string`, which is what made the `as Record<Struggle, string>` cast in that file
// necessary — and the root AGENTS.md forbids exactly that cast by name.
import type { Struggle } from "./onboarding-chat.ts";

/** A support card's words; `source` names the study when one is quoted. Mirrors `SupportCard` in `onboarding-chat.ts`. */
export interface CardCopy {
  title: string;
  body: string;
  source?: string;
}

/** Everything Spud says back, for one language. Branching stays in `onboarding-chat.ts`. */
export interface ChatCopy {
  idlePlaceholder: string;
  struggles: Record<Struggle, string>;
  strugglesAsk: string[];
  quick: {
    struggles: { finish: string; none: string };
    restrictions: { finish: string; none: string };
  };
  goalCards: Record<Goal, CardCopy>;
  goalFollowups: Partial<Record<Goal, string>>;
  struggleCards: Record<Struggle, CardCopy>;
  /** `diets` told to somebody gaining: "diets that ban" is a sentence about losing, so the gain variant speaks to either direction. */
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
  activityReplies: Record<ActivityLevel, string>;
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

  /**
   * The Apple Health offer (v5): the ask, the three rows it lists, the two buttons, and one line
   * per outcome. Code, not editable copy — these words stand next to a permission dialog, which
   * is not a slot an admin should be able to fill.
   */
  health: {
    ask: string;
    /** Exactly three: the fill lands `height`/`weight`, `sex`/`birth_year`, and `activity`. */
    rows: [string, string, string];
    connect: string;
    manual: string;
    connected: string;
    partial: string;
    denied: string;
  };
  /**
   * The Health-path activity ask: `{n}` workouts Health counted, `{label}` the computed level's
   * own option label — the question asks the user to confirm, in the chip's own words.
   */
  healthActivity: string;
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
   * The ONE line Spud says after an answer, above the next question — keyed by what it answers.
   * The mood beside it is picked in `reactionTo` (`onboarding-chat.ts`), not here: a mood is a
   * reaction to what just happened and a copy field cannot know that.
   */
  reactions: {
    goalLose: string;
    goalMaintain: string;
    goalGain: string;
    sex: string;
    birthYear: string;
    heightCm: string;
    /** `{bmr}` — today's first real number. */
    weightWithBmr: string;
    /** The weight answer when no BMR could be computed — said plainly, never "about null". */
    weightPlain: string;
    paceEasy: string;
    paceSteady: string;
    pacePush: string;
    struggles: string;
    country: string;
  };
  /**
   * The four support moments' own words — the full-screen beats between question groups.
   * `{kg}` inside the target bodies is the answer itself. The struggles moment's body is the
   * picked card's for one pick, and `many` for two or more — a card speaks to one struggle.
   */
  moments: {
    target: { title: string; cta: string; inBand: string; neutral: string };
    activity: { title: string; body: string; cta: string };
    struggles: { title: string; cta: string; many: string };
    restrictions: { title: string; body: string; cta: string };
  };
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
      body: "Eating when stressed is a pattern, not a character flaw. Naming it is most of the work; the log does the rest.",
    },
    night: {
      title: "The hour isn't scored",
      body: "Late eating isn't scored here. Only what the whole day adds up to counts.",
    },
    binge: {
      title: "A hard day is data",
      body: "If episodes feel out of control, a clinician helps more than any app. Here, a hard day is data, never a verdict.",
    },
    diets: {
      title: "The method fails, not you",
      body: "Diets that ban the food you like rarely last. That's not you failing. I ban nothing: eat what you eat, and I'll tell you honestly how it fits.",
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
    title: "The method fails, not you",
    body: "Changing weight rarely sticks on the first try, in either direction. That's methods failing, not you. Your surplus is sized to be keepable.",
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
  health: {
    ask: "Connect Apple Health and skip 5 questions",
    rows: ["Height and weight", "Age and sex", "How often you exercise"],
    connect: "Connect Apple Health",
    manual: "Enter them myself",
    connected: "Got your numbers. They stay current on their own",
    partial: "Almost — a few details are missing",
    denied: "Enter your details",
  },
  healthActivity: "Health shows {n} workouts in the last 4 weeks. {label}?",
  targetSuggestion: {
    down: "I suggest {kg} kg, about {pct}% down, a good first goal",
    up: "I suggest {kg} kg, about {pct}% up, a good first goal",
  },
  firstMeal: FIRST_MEAL_COPY.en,
  stepper: { continue: "Continue", less: "Less", more: "More" },
  offerHeadline: "Get to {kg} kg by {month}",
  reactions: {
    goalLose: "Lose weight. Good, let's make it stick",
    goalMaintain: "Maintain it is — let's keep what already works",
    goalGain: "Gain weight. Good — let's build it properly",
    sex: "Noted. The formula differs a little for each",
    birthYear: "Good. Age nudges the number a little",
    heightCm: "Last number. No judgement, it's just where we start",
    weightWithBmr: "Thank you. At rest, your body burns about {bmr} kcal a day",
    weightPlain: "Thank you.",
    paceEasy: "Gentle — slow enough to keep",
    paceSteady: "Steady is the one people keep",
    pacePush: "Push — the daily change is capped at what stays safe",
    struggles: "Let me find your local food",
    country: "Nearly there",
  },
  moments: {
    target: {
      title: "A goal you can keep",
      cta: "Continue",
      inBand: "Losing 5–10% is where the health gains start to show: cholesterol, blood pressure, energy. {kg} kg sits right in that band. Small enough to reach, big enough to matter.",
      neutral: "A clear first goal: {kg} kg, with a plan sized to reach it. Small enough to reach, big enough to matter.",
    },
    activity: {
      title: "That's great!",
      body: "Every bit of movement counts. No gym required: a walk after lunch goes a long way, and your plan already counts what you do.",
      cta: "Continue",
    },
    struggles: {
      title: "That's completely normal!",
      cta: "Continue",
      // The body when two or more struggles were picked — one pick shows that card's body.
      many: "None of these is you failing. I ban nothing: eat what you eat, and I'll tell you honestly how each meal fits.",
    },
    restrictions: {
      title: "Thank you for trusting me",
      body: "Your weight, what's been hard, what you just shared — that's a lot to tell an app. I'll use it for one thing: judging every meal against what matters to you.",
      cta: "Build my plan",
    },
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
      title: "Tu es en bonne compagnie",
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
      body: "Manger sous le coup du stress est un schéma, pas un défaut de caractère. Le nommer, c'est déjà l'essentiel ; le journal fait le reste.",
    },
    night: {
      title: "L'heure n'est pas notée",
      body: "Manger tard n'est pas noté ici. Seul ce que la journée entière additionne compte.",
    },
    binge: {
      title: "Un jour difficile est une donnée",
      body: "Si les crises semblent hors de contrôle, un clinicien aide plus que n'importe quelle appli. Ici, une journée difficile est une donnée, jamais un verdict.",
    },
    diets: {
      title: "La méthode échoue, pas toi",
      body: "Les régimes qui interdisent ce que tu aimes durent rarement. Ce n'est pas toi qui échoues. Je n'interdis rien : mange ce que tu manges, et je te dirai honnêtement comment ça s'insère.",
    },
    eatout: {
      title: "C'est au restaurant que ça dérive",
      body: "Les estimations dérivent le plus sur ce que tu n'as pas cuisiné — et c'est exactement là que les photos sont bonnes. Je te dirai quand je ne suis pas sûr, au lieu de faire semblant.",
    },
    energy: {
      title: "L'énergie est la mesure honnête",
      body: "Les journées sous-alimentées et le manque d'énergie vont de pair — c'est une des raisons pour lesquelles on refuse les objectifs sous le plancher de sécurité. La nourriture est la moitié de l'énergie ; on regardera la forme de tes journées.",
    },
    body: {
      title: "Ici, la balance ne juge pas",
      body: "Tu auras des chiffres sur ce que tu manges, jamais de commentaires sur ton corps. C'est ton objectif qui fixe les cibles ; rien ici n'est comparé à qui que ce soit.",
    },
    metabolism: {
      title: "Mesurons plutôt que de nous inquiéter",
      body: "Les métabolismes diffèrent moins que ne le dit internet — mais le tien est le tien, et deux semaines de suivi honnête montrent ce qu'il fait vraiment. Ça vaut mieux que n'importe quelle formule, la mienne comprise.",
    },
  },
  dietsGainCard: {
    title: "La méthode échoue, pas toi",
    body: "Changer de poids tient rarement du premier coup, dans un sens comme dans l'autre. Ce sont les méthodes qui échouent, pas toi. Ton surplus est dimensionné pour être tenable.",
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
    body: "Le poids sain le plus bas pour ta taille est d'environ {kg} kg. On ne fixera pas d'objectif en dessous. Si tu suis autre chose avec un médecin, écoute-le plutôt que cette appli.",
  },
  weightAck: {
    noted: "Noté — des chiffres honnêtes font un plan honnête.",
    bmr: "Et voilà ton premier chiffre : au repos, ton corps brûle environ {bmr} kcal par jour. Les questions suivantes vont l'affiner.",
  },
  activityReplies: {
    sedentary: "Merci pour la réponse honnête — la plupart des gens surestiment celle-ci, et c'est ensuite l'objectif qui les surestime.",
    light: "Bien — la marche compte plus qu'on ne le croit.",
    moderate: "Solide. Le chiffre partira du principe que ces séances ont lieu — ne me fais pas mentir.",
    active: "Bien — ça te donne droit à plus à manger. Je préfère alimenter correctement que deviner trop bas.",
    athlete: "Alors le chiffre a du vrai travail à alimenter. Je préfère nourrir ça correctement que deviner trop bas.",
  },
  strugglesCloser: {
    none: "Encore mieux. Si quelque chose apparaît plus tard, dis-le-moi dans le chat — le plan peut s'adapter.",
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
    gain: "Va pour la prise de poids. Où aimerais-tu arriver, en kg ?",
    lose: "Basculé — on perd, donc. Où aimerais-tu arriver, en kg ? Plus vite n'est pas mieux ici — c'est juste plus dur à tenir.",
  },
  loseTail: " Plus vite n'est pas mieux ici — c'est juste plus dur à tenir.",
  capNoteTail: " Ça fait environ {kg} kg par semaine.",
  nothingApplies: "Rien à signaler",
  goalEdit: {
    cleared: "Ton poids cible ne collait plus à cet objectif, il est donc effacé — choisis-en un nouveau.",
    worthSetting: "Enregistré. Ton poids cible ne colle plus à ton objectif, cela dit — ça vaut le coup d'en fixer un nouveau.",
  },
  health: {
    ask: "Connecte Apple Health et saute 5 questions",
    rows: ["Taille et poids", "Âge et sexe", "Ton activité physique"],
    connect: "Connecter Apple Health",
    manual: "Les saisir moi-même",
    connected: "J'ai tes chiffres. Ils se tiennent à jour tout seuls",
    partial: "Presque — il manque quelques détails",
    denied: "Saisis tes informations",
  },
  healthActivity: "Health indique {n} entraînements sur les 4 dernières semaines. {label} ?",
  targetSuggestion: {
    down: "Je te propose {kg} kg, soit environ {pct}% de moins — un bon premier objectif",
    up: "Je te propose {kg} kg, soit environ {pct}% de plus — un bon premier objectif",
  },
  firstMeal: FIRST_MEAL_COPY.fr,
  stepper: { continue: "Continuer", less: "Moins", more: "Plus" },
  offerHeadline: "Atteindre {kg} kg d'ici {month}",
  reactions: {
    goalLose: "Perdre du poids. Bien — faisons en sorte que ça tienne",
    goalMaintain: "Maintenir — gardons ce qui fonctionne déjà",
    goalGain: "Prendre du poids. Bien — construisons-le proprement",
    sex: "Noté. La formule diffère un peu pour chacun",
    birthYear: "Bien. L'âge fait bouger un peu le chiffre",
    heightCm: "Dernier chiffre. Aucun jugement, c'est juste le point de départ",
    weightWithBmr: "Merci. Au repos, ton corps brûle environ {bmr} kcal par jour",
    weightPlain: "Merci.",
    paceEasy: "Doux — assez lent pour tenir",
    paceSteady: "Régulier, c'est le rythme que les gens gardent",
    pacePush: "Soutenu — l'écart quotidien reste dans les limites sûres",
    struggles: "Laisse-moi trouver les produits de chez toi",
    country: "On y est presque",
  },
  moments: {
    target: {
      title: "Un objectif que tu peux garder",
      cta: "Continuer",
      inBand: "Perdre 5 à 10% est là où les bienfaits pour la santé commencent à se voir : cholestérol, tension, énergie. {kg} kg tombe pile dans cette zone. Assez peu pour l'atteindre, assez pour compter.",
      neutral: "{kg} kg — un premier objectif clair, avec un plan dimensionné pour l'atteindre.",
    },
    activity: {
      title: "C'est super !",
      body: "Chaque mouvement compte. Pas besoin de salle : une marche après le déjeuner va déjà loin, et ton plan compte déjà ce que tu fais.",
      cta: "Continuer",
    },
    struggles: {
      title: "C'est tout à fait normal !",
      cta: "Continuer",
      many: "Rien de tout ça n'est toi qui échoues. Je n'interdis rien : mange ce que tu manges, et je te dirai honnêtement comment chaque repas s'insère.",
    },
    restrictions: {
      title: "Merci de ta confiance",
      body: "Ton poids, ce qui a été dur, ce que tu viens de partager — c'est beaucoup à confier à une application. Je m'en servirai pour une seule chose : juger chaque repas à l'aune de ce qui compte pour toi.",
      cta: "Construire mon plan",
    },
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
      title: "Nicht so selten, wie es sich anfühlt",
      body: "Etwa 23% der jungen Männer und 6% der jungen Frauen haben im letzten Jahr aktiv versucht zuzunehmen. Ein echtes Ziel mit echter Technik — wir setzen den Überschuss so an, dass er mehr Muskeln aufbaut als Polster.",
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
    maintain: "Und du hast den bequemen Weg: du musst kein Zielgewicht aussuchen — wir planen aufs Halten hin.",
  },
  struggleCards: {
    stress: {
      title: "Ein Muster, kein Charakterfehler",
      body: "Essen aus Stress ist ein Muster, kein Charakterfehler. Es zu benennen ist der größte Teil der Arbeit; den Rest macht das Protokoll.",
    },
    night: {
      title: "Die Uhrzeit wird nicht bewertet",
      body: "Spätes Essen wird hier nicht bewertet. Gezählt wird nur, was der ganze Tag ergibt.",
    },
    binge: {
      title: "Ein schwerer Tag ist ein Datenpunkt",
      body: "Wenn sich die Anfälle unkontrollierbar anfühlen, hilft eine Fachperson mehr als jede App. Hier ist ein schwerer Tag eine Information, nie ein Urteil.",
    },
    diets: {
      title: "Die Methode scheitert, nicht du",
      body: "Diäten, die das Essen verbieten, das du magst, halten selten. Das ist nicht dein Scheitern. Ich verbiete nichts: iss, was du isst, und ich sage dir ehrlich, wie es passt.",
    },
    eatout: {
      title: "Restaurantteller driften am stärksten",
      body: "Schätzungen driften am meisten bei Essen, das du nicht selbst gekocht hast — und genau darin sind Fotos gut. Ich sage es, wenn ich unsicher bin, statt so zu tun als ob.",
    },
    energy: {
      title: "Energie ist die ehrliche Messgröße",
      body: "Unterversorgte Tage und wenig Energie gehen Hand in Hand — einer der Gründe, warum wir Ziele unterhalb der Sicherheitsgrenze ablehnen. Essen ist die Hälfte von Energie; wir schauen auf die Form deiner Tage.",
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
    title: "Die Methode scheitert, nicht du",
    body: "Gewicht zu ändern hält selten beim ersten Versuch, egal in welche Richtung. Das sind Methoden, die scheitern, nicht du. Dein Überschuss ist so bemessen, dass er haltbar ist.",
  },
  gainPaceCard: {
    title: "Gut zunehmen geht absichtlich langsam",
    body: "Dein Überschuss wird bei etwa {share}% über dem gedeckelt, was dein Körper am Tag verbrennt — die Zone, in der Muskeln mit der Waage mithalten. Die meisten, die gut zunehmen, fangen mit dem Eiweiß an; deins behalten wir automatisch im Blick.",
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
    sedentary: "Danke für die ehrliche Antwort — die meisten schätzen sich hier zu hoch ein, und dann schätzt das Ziel sie zu hoch ein.",
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
  health: {
    ask: "Verbinde Apple Health und überspringe 5 Fragen",
    rows: ["Größe und Gewicht", "Alter und Geschlecht", "Wie oft du trainierst"],
    connect: "Apple Health verbinden",
    manual: "Selbst eingeben",
    connected: "Deine Zahlen sind da. Sie bleiben von selbst aktuell",
    partial: "Fast — ein paar Angaben fehlen",
    denied: "Gib deine Angaben ein",
  },
  healthActivity: "Health zeigt {n} Workouts in den letzten 4 Wochen. {label}?",
  targetSuggestion: {
    down: "Ich schlage {kg} kg vor, etwa {pct}% weniger — ein gutes erstes Ziel",
    up: "Ich schlage {kg} kg vor, etwa {pct}% mehr — ein gutes erstes Ziel",
  },
  firstMeal: FIRST_MEAL_COPY.de,
  stepper: { continue: "Weiter", less: "Weniger", more: "Mehr" },
  offerHeadline: "{kg} kg bis {month}",
  reactions: {
    goalLose: "Abnehmen. Gut — wir sorgen dafür, dass es hält",
    goalMaintain: "Halten — wir behalten, was schon funktioniert",
    goalGain: "Zunehmen. Gut — wir bauen es richtig auf",
    sex: "Notiert. Die Formel unterscheidet sich für jedes ein wenig",
    birthYear: "Gut. Das Alter verschiebt die Zahl ein wenig",
    heightCm: "Letzte Zahl. Keine Wertung — es ist einfach der Ausgangspunkt",
    weightWithBmr: "Danke. In Ruhe verbrennt dein Körper etwa {bmr} kcal am Tag",
    weightPlain: "Danke.",
    paceEasy: "Sanft — langsam genug, um zu bleiben",
    paceSteady: "Stetig ist das Tempo, das Menschen durchhalten",
    pacePush: "Zügig also — die Tagesänderung bleibt im sicheren Rahmen",
    struggles: "Lass mich die Lebensmittel bei dir finden",
    country: "Fast geschafft",
  },
  moments: {
    target: {
      title: "Ein Ziel, das du halten kannst",
      cta: "Weiter",
      inBand: "5–10% weniger ist der Bereich, in dem die gesundheitlichen Effekte sichtbar werden: Cholesterin, Blutdruck, Energie. {kg} kg liegt genau in diesem Band. Klein genug zum Schaffen, groß genug, um zu zählen.",
      neutral: "{kg} kg — ein klares erstes Ziel, mit einem Plan, der dafür ausgelegt ist.",
    },
    activity: {
      title: "Das ist toll!",
      body: "Jede Bewegung zählt. Kein Fitnessstudio nötig: ein Spaziergang nach dem Mittagessen bringt schon viel, und dein Plan rechnet mit dem, was du tust.",
      cta: "Weiter",
    },
    struggles: {
      title: "Das ist völlig normal!",
      cta: "Weiter",
      many: "Nichts davon ist dein Scheitern. Ich verbiete nichts: iss, was du isst, und ich sage dir ehrlich, wie jede Mahlzeit passt.",
    },
    restrictions: {
      title: "Danke für dein Vertrauen",
      body: "Dein Gewicht, was schwer war, was du mir gerade anvertraut hast — das ist viel für eine App. Ich nutze es für genau eines: jede Mahlzeit an dem zu messen, was dir wichtig ist.",
      cta: "Erstelle meinen Plan",
    },
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
    struggles: { finish: "Fatto", none: "Nessuno di questi" },
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
    gain: "Stesse regole che valgono per tutti qui — numeri onesti, niente incoraggiamenti a vuoto, nessuna vergogna — solo puntate verso l'alto invece che verso il basso.",
    maintain: "E la strada comoda è la tua: nessun peso obiettivo da scegliere — pianifichiamo attorno al restare dove sei.",
  },
  struggleCards: {
    stress: {
      title: "Uno schema, non un difetto di carattere",
      body: "Mangiare per lo stress è uno schema, non un difetto di carattere. Dargli un nome è gran parte del lavoro; il resto lo fa il diario.",
    },
    night: {
      title: "L'orario non viene valutato",
      body: "Mangiare tardi non viene valutato qui. Conta solo quello che somma l'intera giornata.",
    },
    binge: {
      title: "Una giornata storta è un dato",
      body: "Se gli episodi sembrano fuori controllo, un clinico aiuta più di qualsiasi app. Qui una giornata storta è un dato, mai un verdetto.",
    },
    diets: {
      title: "Il metodo fallisce, non tu",
      body: "Le diete che vietano il cibo che ti piace durano raramente. Non sei tu a fallire. Io non vieto niente: mangia quello che mangi, e ti dirò onestamente come ci sta.",
    },
    eatout: {
      title: "I piatti del ristorante sono i più imprecisi",
      body: "Le stime sbandano di più sul cibo che non hai cucinato — ed è esattamente lì che le foto funzionano meglio. Quando non sono sicuro te lo dico, invece di far finta.",
    },
    energy: {
      title: "L'energia è la misura onesta",
      body: "Giornate sotto-alimentate e poca energia vanno di pari passo — è uno dei motivi per cui rifiutiamo obiettivi sotto la soglia di sicurezza. Il cibo è metà dell'energia; guarderemo la forma delle tue giornate.",
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
    title: "Il metodo fallisce, non tu",
    body: "Cambiare peso raramente regge al primo tentativo, in nessuna delle due direzioni. Sono i metodi a fallire, non tu. Il tuo surplus è dimensionato per essere mantenibile.",
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
    sedentary: "Grazie per la risposta onesta — quasi tutti esagerano qui, e poi è l'obiettivo a esagerare con loro.",
    light: "Bene — camminare conta più di quanto si pensi.",
    moderate: "Solido. Il numero darà per scontato che quegli allenamenti si facciano — non farmi sbagliare.",
    active: "Bene — così ti spetta più cibo. Preferisco nutrirti come si deve piuttosto che tirare al ribasso.",
    athlete: "Allora il numero ha del lavoro vero da alimentare. Preferisco nutrirlo come si deve che tirare basso.",
  },
  strugglesCloser: {
    none: "Meglio ancora. Se salta fuori qualcosa più avanti, dimmelo in chat — il piano sa adattarsi.",
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
    switchToLose: "Passa a perdere peso",
    switchToGain: "Passa a prendere peso",
    above: "Un numero sopra {weight}…",
    below: "Un numero sotto {weight}…",
  },
  switched: {
    gain: "Invertito — si prende peso, allora. Dove ti piacerebbe arrivare, in kg?",
    lose: "Invertito — si perde peso, allora. Dove ti piacerebbe arrivare, in kg? Più veloce qui non è meglio — è solo più difficile da mantenere.",
  },
  loseTail: " Più veloce qui non è meglio — è solo più difficile da mantenere.",
  capNoteTail: " Fa circa {kg} kg a settimana.",
  nothingApplies: "Niente di tutto ciò",
  goalEdit: {
    cleared: "Il tuo peso obiettivo non corrispondeva più a quell'obiettivo, quindi è stato azzerato — impostane uno nuovo.",
    worthSetting: "Registrato. Il tuo peso obiettivo però non corrisponde più al tuo obiettivo — vale la pena impostarne uno nuovo.",
  },
  health: {
    ask: "Collega Apple Health e salta 5 domande",
    rows: ["Altezza e peso", "Età e sesso", "Quanto ti alleni"],
    connect: "Collega Apple Health",
    manual: "Li inserisco io",
    connected: "Ho i tuoi numeri. Si aggiornano da soli",
    partial: "Quasi — mancano alcuni dati",
    denied: "Inserisci i tuoi dati",
  },
  healthActivity: "Health mostra {n} allenamenti nelle ultime 4 settimane. {label}?",
  targetSuggestion: {
    down: "Ti suggerisco {kg} kg, circa il {pct}% in meno — un buon primo obiettivo",
    up: "Ti suggerisco {kg} kg, circa il {pct}% in più — un buon primo obiettivo",
  },
  firstMeal: FIRST_MEAL_COPY.it,
  stepper: { continue: "Continua", less: "Meno", more: "Più" },
  offerHeadline: "Arrivare a {kg} kg entro {month}",
  reactions: {
    goalLose: "Perdere peso. Bene — facciamo in modo che duri",
    goalMaintain: "Mantenere — teniamo quello che già funziona",
    goalGain: "Prendere peso. Bene — costruiamolo come si deve",
    sex: "Annotato. La formula cambia un po' per ciascuno",
    birthYear: "Bene. L'età sposta un po' il numero",
    heightCm: "Ultimo numero. Nessun giudizio, è solo il punto di partenza",
    weightWithBmr: "Grazie. A riposo, il tuo corpo brucia circa {bmr} kcal al giorno",
    weightPlain: "Grazie.",
    paceEasy: "Dolce — abbastanza lento da durare",
    paceSteady: "Costante è il ritmo che si mantiene",
    pacePush: "Deciso — la variazione quotidiana resta entro i limiti sicuri",
    struggles: "Fammi trovare i prodotti della tua zona",
    country: "Ci siamo quasi",
  },
  moments: {
    target: {
      title: "Un obiettivo che puoi mantenere",
      cta: "Continua",
      inBand: "Perdere il 5–10% è dove i benefici per la salute iniziano a vedersi: colesterolo, pressione, energia. {kg} kg è proprio in quella fascia. Abbastanza vicino da raggiungere, abbastanza grande da contare.",
      neutral: "{kg} kg — un primo obiettivo chiaro, con un piano dimensionato per raggiungerlo.",
    },
    activity: {
      title: "È fantastico!",
      body: "Ogni movimento conta. Non serve la palestra: una passeggiata dopo pranzo fa molta strada, e il tuo piano conta già quello che fai.",
      cta: "Continua",
    },
    struggles: {
      title: "È assolutamente normale!",
      cta: "Continua",
      many: "Niente di tutto questo è un tuo fallimento. Io non vieto niente: mangia quello che mangi, e ti dirò onestamente come ogni pasto ci sta.",
    },
    restrictions: {
      title: "Grazie per la fiducia",
      body: "Il tuo peso, quello che è stato difficile, quello che mi hai appena raccontato — è tanto da condividere con un'app. Lo userò per una cosa sola: giudicare ogni pasto rispetto a ciò che conta per te.",
      cta: "Crea il mio piano",
    },
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
    gain: "Las mismas reglas que para todos aquí — números honestos, sin ánimos vacíos, sin vergüenza — solo apuntando arriba en vez de abajo.",
    maintain: "Y el camino fácil es el tuyo: no hay peso objetivo que elegir — planificamos alrededor de quedarte donde estás.",
  },
  struggleCards: {
    stress: {
      title: "Un patrón, no un defecto de carácter",
      body: "Comer por estrés es un patrón, no un defecto de carácter. Ponerle nombre es casi todo el trabajo; el registro hace el resto.",
    },
    night: {
      title: "La hora no se puntúa",
      body: "Comer tarde no se puntúa aquí. Solo cuenta lo que suma el día entero.",
    },
    binge: {
      title: "Un día malo es un dato",
      body: "Si los episodios se sienten fuera de control, un profesional ayuda más que cualquier app. Aquí un día malo es un dato, nunca un veredicto.",
    },
    diets: {
      title: "El método falla, no tú",
      body: "Las dietas que prohíben la comida que te gusta rara vez duran. No eres tú quien falla. Yo no prohíbo nada: come lo que comes, y te diré honestamente cómo encaja.",
    },
    eatout: {
      title: "Los platos de restaurante son los que más se desvían",
      body: "Las estimaciones se desvían más con lo que no cocinaste tú — y ahí es justo donde las fotos son buenas. Cuando no esté seguro lo diré, en vez de disimular.",
    },
    energy: {
      title: "La energía es la medida honesta",
      body: "Los días mal alimentados y la falta de energía van de la mano — es una de las razones por las que rechazamos objetivos por debajo del suelo de seguridad. La comida es la mitad de la energía; miraremos la forma de tus días.",
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
    title: "El método falla, no tú",
    body: "Cambiar de peso rara vez se mantiene al primer intento, en ninguna dirección. Son los métodos los que fallan, no tú. Tu superávit está dimensionado para poder sostenerse.",
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
    moderate: "Sólido. El número dará por hecho que esos entrenamientos ocurren — no me dejes mentir.",
    active: "Bien — eso te da derecho a más comida. Prefiero alimentarlo bien que quedarme corto.",
    athlete: "Entonces el número tiene trabajo de verdad que alimentar. Prefiero alimentarlo bien que quedarme corto.",
  },
  strugglesCloser: {
    none: "Mejor aún. Si aparece algo más adelante, dímelo en el chat — el plan sabe adaptarse.",
    one: "Con eso sabemos trabajar — el plan se construye alrededor, no en contra. Quedan dos preguntas rápidas.",
    many: "Con cada una de estas sabemos trabajar — el plan se construye alrededor, no en contra. Quedan dos preguntas rápidas.",
  },
  restrictions: {
    kidneys: "Anotado. A partir de ahora se puntúa el sodio — y solo porque lo has pedido.",
    ldl: "Anotado. A partir de ahora se puntúan las grasas saturadas — y solo porque lo has pedido.",
    ldlChained: "Las grasas saturadas también se puntúan — misma regla: solo lo que declares.",
    declared: "Anotado — van a tu perfil, y solo eso se puntúa.",
    none: "Entonces no se puntúa nada extra — lo que no se declara no se puntúa nunca. Puedes añadir algo cuando quieras en ajustes.",
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
    confirm: "Tengo {age} años",
  },
  direction: {
    gain: "Estás en {weight} kg y pides subir hasta {target} — desde aquí eso no es subir. Si el objetivo ha cambiado, lo cambiamos; si no, dame un número por encima de {weight}.",
    lose: "Estás en {weight} kg y pides bajar hasta {target} — desde aquí eso no es bajar. Si el objetivo ha cambiado, lo cambiamos; si no, dame un número por debajo de {weight}.",
    switchToLose: "Cambiar a perder peso",
    switchToGain: "Cambiar a ganar peso",
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
    worthSetting: "Registrado. Eso sí, tu peso objetivo ya no encaja con tu objetivo — merece la pena poner uno nuevo.",
  },
  health: {
    ask: "Conecta Apple Health y sáltate 5 preguntas",
    rows: ["Altura y peso", "Edad y sexo", "Cuánto entrenas"],
    connect: "Conectar Apple Health",
    manual: "Los escribo yo",
    connected: "Ya tengo tus números. Se mantienen al día solos",
    partial: "Casi — faltan algunos datos",
    denied: "Escribe tus datos",
  },
  healthActivity: "Health muestra {n} entrenamientos en las últimas 4 semanas. ¿{label}?",
  targetSuggestion: {
    down: "Te sugiero {kg} kg, alrededor de un {pct}% menos — una buena primera meta",
    up: "Te sugiero {kg} kg, alrededor de un {pct}% más — una buena primera meta",
  },
  firstMeal: FIRST_MEAL_COPY.es,
  stepper: { continue: "Continuar", less: "Menos", more: "Más" },
  offerHeadline: "Llegar a {kg} kg en {month}",
  reactions: {
    goalLose: "Perder peso. Bien — hagamos que se mantenga",
    goalMaintain: "Mantener — conservemos lo que ya funciona",
    goalGain: "Ganar peso. Bien — construyámoslo bien",
    sex: "Anotado. La fórmula difiere un poco para cada uno",
    birthYear: "Bien. La edad mueve un poco el número",
    heightCm: "Último número. Sin juicios, es solo el punto de partida",
    weightWithBmr: "Gracias. En reposo, tu cuerpo quema unas {bmr} kcal al día",
    weightPlain: "Gracias.",
    paceEasy: "Suave — lo bastante lento para durar",
    paceSteady: "Constante es el ritmo que la gente mantiene",
    pacePush: "Fuerte, entonces — el cambio diario queda dentro de lo seguro",
    struggles: "Déjame encontrar los productos de tu zona",
    country: "Ya casi",
  },
  moments: {
    target: {
      title: "Una meta que puedes mantener",
      cta: "Continuar",
      inBand: "Perder un 5–10% es donde empiezan a notarse las mejoras de salud: colesterol, tensión, energía. {kg} kg cae justo en esa franja. Lo bastante pequeña para alcanzarla, lo bastante grande para importar.",
      neutral: "{kg} kg — una primera meta clara, con un plan dimensionado para alcanzarla.",
    },
    activity: {
      title: "¡Genial!",
      body: "Todo movimiento cuenta. No hace falta gimnasio: un paseo después de comer llega lejos, y tu plan ya cuenta lo que haces.",
      cta: "Continuar",
    },
    struggles: {
      title: "¡Es completamente normal!",
      cta: "Continuar",
      many: "Nada de esto es un fallo tuyo. Yo no prohíbo nada: come lo que comes, y te diré honestamente cómo encaja cada comida.",
    },
    restrictions: {
      title: "Gracias por confiar en mí",
      body: "Tu peso, lo que ha sido difícil, lo que acabas de contarme — es mucho para contarle a una app. Lo usaré para una sola cosa: juzgar cada comida según lo que te importa.",
      cta: "Crear mi plan",
    },
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
      body: "Ăn khi căng thẳng là một khuôn mẫu, không phải lỗi tính cách. Gọi được tên nó đã là phần lớn công việc; phần còn lại để nhật ký lo.",
    },
    night: {
      title: "Giờ giấc không bị chấm",
      body: "Ăn muộn không bị chấm ở đây. Chỉ tổng của cả ngày mới được tính.",
    },
    binge: {
      title: "Một ngày tệ là dữ liệu",
      body: "Nếu những cơn đó thấy ngoài tầm kiểm soát, một bác sĩ giúp được nhiều hơn bất kỳ ứng dụng nào. Ở đây, một ngày khó khăn là dữ liệu, không bao giờ là bản án.",
    },
    diets: {
      title: "Phương pháp thất bại, không phải bạn",
      body: "Những chế độ ăn cấm món bạn thích hiếm khi bền. Đó không phải bạn thất bại. Mình không cấm gì cả: cứ ăn như bạn ăn, và mình sẽ nói thành thật nó hợp thế nào.",
    },
    eatout: {
      title: "Đồ ăn nhà hàng lệch nhiều nhất",
      body: "Ước lượng lệch nhiều nhất với món bạn không tự nấu — và đó đúng là chỗ ảnh chụp làm tốt nhất. Khi không chắc, mình sẽ nói thẳng chứ không làm ra vẻ.",
    },
    energy: {
      title: "Năng lượng là thước đo thành thật",
      body: "Những ngày ăn thiếu và cảm giác uể oải luôn đi cùng nhau — đó là một lý do chúng mình từ chối mục tiêu dưới mức sàn an toàn. Đồ ăn là một nửa của năng lượng; chúng mình sẽ để ý xem ngày của bạn diễn ra thế nào.",
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
    title: "Phương pháp thất bại, không phải bạn",
    body: "Thay đổi cân nặng hiếm khi bền ngay lần đầu, theo chiều nào cũng vậy. Đó là phương pháp thất bại, không phải bạn. Mức dư của bạn được tính để giữ được.",
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
    confirm: "Đó là tuổi thật của tôi",
    placeholder: "Tuổi của bạn",
    stopped: [
      "Vậy thì chúng mình dừng ở đây. Không điều gì bạn kể được giữ lại, và không có gì được gửi đi đâu cả — không có tài khoản nào để xoá.",
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
    moderate: "Ổn đấy. Con số sẽ giả định là những buổi tập đó có diễn ra — nhớ giữ mình thành thật nhé.",
    active: "Tốt — vậy là bạn được ăn nhiều hơn. Mình thà nạp đủ còn hơn đoán thấp.",
    athlete: "Vậy thì con số này phải nuôi khối lượng vận động thật. Mình thà nạp đủ còn hơn đoán thấp.",
  },
  strugglesCloser: {
    none: "Càng tốt. Nếu sau này có gì xuất hiện, cứ nói với mình trong chat — kế hoạch điều chỉnh được.",
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
    height_cm: "Tính bằng cm — kiểu như 175.",
    weight_kg: "Tính bằng kg — áng chừng là được.",
    target_weight_kg: "Một số tính bằng kg — ví dụ 70.",
  },
  ambiguousAge: {
    line: "Mình muốn chắc là đọc đúng — nếu ý bạn là năm {year}, gửi đủ bốn chữ số nhé.",
    confirm: "Tôi {age} tuổi",
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
  health: {
    ask: "Kết nối Apple Health để bỏ qua 5 câu hỏi",
    rows: ["Chiều cao và cân nặng", "Tuổi và giới tính", "Mức độ tập luyện"],
    connect: "Kết nối Apple Health",
    manual: "Tự nhập",
    connected: "Đã có số liệu của bạn. Chúng tự cập nhật",
    partial: "Gần xong — còn thiếu vài thông tin",
    denied: "Nhập thông tin của bạn",
  },
  healthActivity: "Health ghi nhận {n} buổi tập trong 4 tuần qua. {label}?",
  targetSuggestion: {
    down: "Mình gợi ý {kg} kg, tức xuống khoảng {pct}% — một mục tiêu đầu tiên hợp lý",
    up: "Mình gợi ý {kg} kg, tức lên khoảng {pct}% — một mục tiêu đầu tiên hợp lý",
  },
  firstMeal: FIRST_MEAL_COPY.vi,
  stepper: { continue: "Tiếp tục", less: "Bớt", more: "Thêm" },
  offerHeadline: "Đạt {kg} kg vào {month}",
  reactions: {
    goalLose: "Xuống cân. Tốt — mình sẽ giúp nó bền",
    goalMaintain: "Giữ cân — mình giữ lại những gì đang ổn",
    goalGain: "Lên cân. Tốt — mình làm cho đúng",
    sex: "Đã ghi nhận. Công thức khác một chút ở mỗi giới",
    birthYear: "Tốt. Tuổi tác làm con số dịch đi một chút",
    heightCm: "Con số cuối. Không phán xét, đó chỉ là điểm xuất phát",
    weightWithBmr: "Cảm ơn bạn. Khi nghỉ, cơ thể bạn đốt khoảng {bmr} kcal mỗi ngày",
    weightPlain: "Cảm ơn bạn.",
    paceEasy: "Nhẹ nhàng — đủ chậm để giữ được",
    paceSteady: "Đều đặn là nhịp mà mọi người giữ được",
    pacePush: "Dồn sức nhé — mức thay đổi mỗi ngày vẫn nằm trong vùng an toàn",
    struggles: "Để mình tìm những món quen thuộc nơi bạn sống",
    country: "Gần xong rồi",
  },
  moments: {
    target: {
      title: "Một mục tiêu bạn giữ được",
      cta: "Tiếp tục",
      inBand: "Xuống 5–10% là ngưỡng mà lợi ích sức khỏe bắt đầu lộ rõ: cholesterol, huyết áp, năng lượng. {kg} kg nằm đúng trong vùng đó. Đủ nhỏ để chạm tới, đủ lớn để có ý nghĩa.",
      neutral: "{kg} kg — một mục tiêu đầu tiên rõ ràng, với kế hoạch được tính để đạt tới.",
    },
    activity: {
      title: "Tuyệt quá!",
      body: "Mọi vận động đều tính. Không cần phòng gym: một buổi đi bộ sau bữa trưa đã đi được một đoạn dài, và kế hoạch của bạn đã tính cả những gì bạn làm.",
      cta: "Tiếp tục",
    },
    struggles: {
      title: "Điều đó hoàn toàn bình thường!",
      cta: "Tiếp tục",
      many: "Không điều nào trong số này là bạn thất bại. Mình không cấm gì cả: cứ ăn như bạn ăn, và mình sẽ nói thành thật mỗi bữa hợp thế nào.",
    },
    restrictions: {
      title: "Cảm ơn bạn đã tin mình",
      body: "Cân nặng, những điều từng khó khăn, và những gì bạn vừa chia sẻ — thật nhiều để kể cho một ứng dụng. Mình chỉ dùng nó cho một việc: đánh giá mỗi bữa ăn theo điều quan trọng với bạn.",
      cta: "Tạo kế hoạch của tôi",
    },
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
      title: "Lebih umum dari yang kamu kira",
      body: "Sekitar 23% pria muda dan 6% wanita muda aktif mencoba menaikkan berat badan tahun lalu. Ini tujuan nyata dengan teknik nyata — kami akan menyetel surplus yang lebih banyak membangun daripada menumpuk.",
      source: "Studi dewasa muda di Kanada · n = 976",
    },
    maintain: {
      title: "Tujuan yang jarang disebut",
      body: "Sekitar 23% orang dewasa aktif berusaha menjaga berat badannya — tujuan yang tidak pernah dipamerkan orang, dan tetap layak punya rencana. Harimu dinilai dari apakah beratmu bertahan.",
      source: "Meta-analisis upaya pengendalian berat badan setahun terakhir",
    },
  },
  goalFollowups: {
    gain: "Aturannya sama seperti untuk semua orang di sini — angka jujur, tanpa sorak-sorai, tanpa rasa malu — hanya arahnya ke atas, bukan ke bawah.",
    maintain: "Dan jalan mudahnya jadi milikmu: tidak ada berat target yang harus dipilih — kami menyusun rencananya untuk mempertahankan beratmu.",
  },
  struggleCards: {
    stress: {
      title: "Ini pola, bukan cacat karakter",
      body: "Makan saat stres adalah pola, bukan cacat karakter. Menamainya sudah sebagian besar pekerjaannya; sisanya dikerjakan catatan.",
    },
    night: {
      title: "Jam makan tidak dinilai",
      body: "Makan larut tidak dinilai di sini. Hanya jumlah sepanjang hari yang dihitung.",
    },
    binge: {
      title: "Hari yang berat adalah data",
      body: "Kalau episodenya terasa di luar kendali, seorang klinisi lebih menolong daripada aplikasi mana pun. Di sini, hari yang berat adalah data, bukan vonis.",
    },
    diets: {
      title: "Metodenya yang gagal, bukan kamu",
      body: "Diet yang melarang makanan kesukaanmu jarang bertahan. Itu bukan kamu yang gagal. Aku tidak melarang apa pun: makanlah seperti biasa, dan aku akan bilang jujur bagaimana cocoknya.",
    },
    eatout: {
      title: "Porsi restoran paling sulit ditebak",
      body: "Perkiraan paling meleset pada makanan yang bukan kamu masak — dan di situlah foto paling berguna. Kalau aku ragu, aku bilang, bukan pura-pura tahu.",
    },
    energy: {
      title: "Energi adalah ukuran yang jujur",
      body: "Hari yang kurang asupan dan energi rendah selalu jalan bareng — itu salah satu alasan kami menolak target di bawah batas aman. Makanan adalah separuh dari energi; kami akan memperhatikan pola harimu.",
    },
    body: {
      title: "Di sini timbangan bukan hakim",
      body: "Kamu akan dapat angka tentang makanan, tidak pernah komentar tentang tubuhmu. Tujuanmu yang menetapkan targetnya; di sini tidak ada yang dibandingkan dengan siapa pun.",
    },
    metabolism: {
      title: "Ukur saja daripada cemas",
      body: "Metabolisme orang berbeda lebih sedikit daripada yang dibilang internet — tapi punyamu ya punyamu, dan dua minggu mencatat dengan jujur menunjukkan apa yang sebenarnya terjadi. Itu mengalahkan rumus apa pun, termasuk rumusku.",
    },
  },
  dietsGainCard: {
    title: "Metodenya yang gagal, bukan kamu",
    body: "Mengubah berat jarang bertahan di percobaan pertama, ke arah mana pun. Itu metodenya yang gagal, bukan kamu. Surplusmu diukur supaya bisa dijaga.",
  },
  gainPaceCard: {
    title: "Naik yang benar memang pelan",
    body: "Surplusmu dibatasi sekitar {share}% di atas yang dibakar tubuhmu dalam sehari — zona di mana otot masih mengejar timbangan. Kebanyakan yang berhasil memulai dari protein; punyamu kami lacak otomatis.",
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
      "Kalau begitu kita berhenti di sini. Apa pun yang kamu ceritakan tidak disimpan, dan tidak ada yang dikirim ke mana pun — tidak ada akun yang perlu dihapus.",
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
    sedentary: "Terima kasih untuk jawaban jujurnya — kebanyakan orang melebih-lebihkan yang satu ini, lalu targetnya jadi kelewat tinggi buat mereka.",
    light: "Bagus — jalan kaki bernilai lebih dari yang orang kira.",
    moderate: "Mantap. Angkanya akan berasumsi latihan itu benar-benar terjadi — koreksi aku kalau meleset, ya.",
    active: "Bagus — itu artinya jatah makanmu lebih banyak. Aku lebih suka mengisi dengan benar daripada menebak terlalu rendah.",
    athlete: "Kalau begitu angkanya harus menutupi kerja fisik yang nyata. Aku lebih suka mengisi dengan benar daripada menebak terlalu rendah.",
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
    age: "Itu tidak kelihatan seperti umur — coba seperti 34.",
    height_cm: "Dalam sentimeter — seperti 175.",
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
  health: {
    ask: "Hubungkan Apple Health dan lewati 5 pertanyaan",
    rows: ["Tinggi dan berat", "Usia dan jenis kelamin", "Seberapa sering kamu berolahraga"],
    connect: "Hubungkan Apple Health",
    manual: "Isi sendiri",
    connected: "Angka-angkamu sudah masuk. Semuanya terbarui sendiri",
    partial: "Hampir — ada beberapa data yang kurang",
    denied: "Isi datamu",
  },
  healthActivity: "Health menunjukkan {n} latihan dalam 4 minggu terakhir. {label}?",
  targetSuggestion: {
    down: "Kusarankan {kg} kg, turun sekitar {pct}% — target pertama yang bagus",
    up: "Kusarankan {kg} kg, naik sekitar {pct}% — target pertama yang bagus",
  },
  firstMeal: FIRST_MEAL_COPY.id,
  stepper: { continue: "Lanjut", less: "Kurangi", more: "Tambah" },
  offerHeadline: "Capai {kg} kg pada {month}",
  reactions: {
    goalLose: "Turunkan berat. Bagus — kita buat supaya bertahan",
    goalMaintain: "Jaga berat — kita pertahankan yang sudah berhasil",
    goalGain: "Naikkan berat. Bagus — kita bangun dengan benar",
    sex: "Tercatat. Rumusnya sedikit berbeda untuk masing-masing",
    birthYear: "Bagus. Usia sedikit menggeser angkanya",
    heightCm: "Angka terakhir. Tanpa penilaian, ini cuma titik awal",
    weightWithBmr: "Terima kasih. Saat istirahat, tubuhmu membakar sekitar {bmr} kcal sehari",
    weightPlain: "Terima kasih.",
    paceEasy: "Pelan — cukup lambat untuk dijaga",
    paceSteady: "Stabil adalah tempo yang bisa dijaga",
    pacePush: "Cepat, kalau begitu — perubahan hariannya tetap dalam batas aman",
    struggles: "Biar aku cari makanan khas daerahmu",
    country: "Hampir selesai",
  },
  moments: {
    target: {
      title: "Target yang bisa kamu jaga",
      cta: "Lanjut",
      inBand: "Turun 5–10% adalah titik saat manfaat kesehatan mulai terlihat: kolesterol, tekanan darah, energi. {kg} kg pas di rentang itu. Cukup kecil untuk dicapai, cukup besar untuk berarti.",
      neutral: "{kg} kg — target pertama yang jelas, dengan rencana yang diukur untuk mencapainya.",
    },
    activity: {
      title: "Bagus sekali!",
      body: "Setiap gerakan berarti. Tidak perlu gym: jalan kaki setelah makan siang sudah berpengaruh besar, dan rencanamu sudah menghitung apa yang kamu lakukan.",
      cta: "Lanjut",
    },
    struggles: {
      title: "Itu wajar sekali!",
      cta: "Lanjut",
      many: "Tidak satu pun dari ini berarti kamu gagal. Aku tidak melarang apa pun: makanlah seperti biasa, dan aku akan bilang jujur bagaimana tiap makanan cocoknya.",
    },
    restrictions: {
      title: "Terima kasih sudah percaya",
      body: "Beratmu, hal-hal yang berat, dan yang baru kamu ceritakan — itu banyak untuk dibagikan ke sebuah aplikasi. Aku memakainya untuk satu hal saja: menilai setiap makanan terhadap apa yang penting bagimu.",
      cta: "Buat rencanaku",
    },
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
      title: "Не так редко, как кажется",
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
      body: "Еда от стресса — это паттерн, а не изъян характера. Назвать его — уже большая часть работы; остальное делает дневник.",
    },
    night: {
      title: "Время не оценивается",
      body: "Поздняя еда здесь не оценивается. Считается только то, что набирается за весь день.",
    },
    binge: {
      title: "Трудный день — это данные",
      body: "Если приступы ощущаются неуправляемыми, врач поможет больше любого приложения. Здесь трудный день — это данные, а не приговор.",
    },
    diets: {
      title: "Подводит метод, не ты",
      body: "Диеты, которые запрещают еду, которую ты любишь, редко держатся. Это не ты подводишь. Я ничего не запрещаю: ешь как ешь, а я честно скажу, как это вписывается.",
    },
    eatout: {
      title: "Ресторанные тарелки уводят сильнее всего",
      body: "Оценки уплывают сильнее всего на еде, которую готовил кто-то другой, — и именно с этим фотографии справляются лучше всего. Когда я не уверен, я так и скажу, а не сделаю вид.",
    },
    energy: {
      title: "Энергия — честная метрика",
      body: "Дни недоедания и упадок сил идут рука об руку — это одна из причин, почему мы отказываемся ставить цели ниже порога безопасности. Еда — половина энергии; будем смотреть на форму твоих дней.",
    },
    body: {
      title: "Здесь весы не судья",
      body: "Ты будешь получать цифры про еду и никогда — комментарии про своё тело. Ориентиры задаёт твоя цель; здесь ничто не сравнивается ни с кем.",
    },
    metabolism: {
      title: "Давай измерим, а не будем волноваться",
      body: "Обмен веществ у людей различается меньше, чем говорит интернет, — но твой есть твой, и две недели честных записей покажут, что он делает на самом деле. Это лучше любой формулы, включая мою.",
    },
  },
  dietsGainCard: {
    title: "Подводит метод, не ты",
    body: "Изменить вес с первой попытки почти не получается, в любую сторону. Это методы подводят, не ты. Твой профицит рассчитан так, чтобы его можно было удержать.",
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
    sedentary: "Спасибо за честный ответ — здесь большинство завышает, а потом завышенной оказывается и цель.",
    light: "Хорошо — прогулки значат больше, чем принято думать.",
    moderate: "Солидно. Цифра будет исходить из того, что эти тренировки действительно случаются, — держи меня в честности.",
    active: "Хорошо — это покупает тебе больше еды. Лучше накормить как следует, чем занизить наугад.",
    athlete: "Тогда цифре есть что питать. Лучше накормить как следует, чем занизить наугад.",
  },
  strugglesCloser: {
    none: "Тем лучше. Если что-то появится позже, скажи мне в чате — план умеет гнуться.",
    one: "С этим мы умеем работать — план строится вокруг этого, а не вопреки этому. Осталось два коротких вопроса.",
    many: "С каждым из них мы умеем работать — план строится вокруг этого, а не вопреки этому. Осталось два коротких вопроса.",
  },
  restrictions: {
    kidneys: "Записал. С этого момента натрий оценивается — и только по твоей просьбе.",
    ldl: "Записал. С этого момента насыщенные жиры оцениваются — и только по твоей просьбе.",
    ldlChained: "Насыщенные жиры тоже оцениваются — правило то же: только то, что ты указываешь.",
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
    line: "Хочу убедиться, что понял правильно: если речь про {year} год, пришли все четыре цифры.",
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
  health: {
    ask: "Подключи Apple Health и пропусти 5 вопросов",
    rows: ["Рост и вес", "Возраст и пол", "Как часто ты тренируешься"],
    connect: "Подключить Apple Health",
    manual: "Ввести вручную",
    connected: "Цифры у меня. Они обновляются сами",
    partial: "Почти всё — пары деталей не хватает",
    denied: "Введи свои данные",
  },
  // The count sits after the noun — "тренировок: {n}" — because тренировка inflects on the
  // count and a fixed noun would misread half the answers.
  healthActivity: "За последние 4 недели Health записал тренировок: {n}. {label}?",
  targetSuggestion: {
    down: "Предлагаю {kg} кг — примерно на {pct}% меньше, хорошая первая цель",
    up: "Предлагаю {kg} кг — примерно на {pct}% больше, хорошая первая цель",
  },
  firstMeal: FIRST_MEAL_COPY.ru,
  stepper: { continue: "Продолжить", less: "Меньше", more: "Больше" },
  // CLDR gives the month in the nominative ("январь 2027 г."), so no preposition may govern it.
  offerHeadline: "Цель {kg} кг. Срок: {month}",
  reactions: {
    goalLose: "Похудеть. Хорошо — сделаем так, чтобы это держалось",
    goalMaintain: "Удержать вес. Хорошо — оставим то, что уже работает",
    goalGain: "Набрать вес. Хорошо — соберём его правильно",
    sex: "Записал. Формула немного различается для каждого",
    birthYear: "Хорошо. Возраст немного двигает цифру",
    heightCm: "Последняя цифра. Без оценок — это просто точка старта",
    weightWithBmr: "Спасибо. В покое твоё тело сжигает около {bmr} ккал в день",
    weightPlain: "Спасибо.",
    paceEasy: "Мягкий — достаточно медленный, чтобы удержаться",
    paceSteady: "Ровный — тот, который у людей держится",
    pacePush: "Жёсткий, значит — дневная разница всё равно останется в безопасных рамках",
    struggles: "Дай-ка найти твои местные продукты",
    country: "Почти всё",
  },
  moments: {
    target: {
      title: "Цель, которую можно удержать",
      cta: "Дальше",
      inBand: "Минус 5–10% — полоса, где перемены в здоровье начинают проявляться: холестерин, давление, энергия. {kg} кг — прямо в ней. Достаточно близко, чтобы дойти, достаточно много, чтобы иметь значение.",
      neutral: "{kg} кг — ясная первая цель, и план рассчитан именно на неё.",
    },
    activity: {
      title: "Здорово!",
      body: "Любое движение считается. Зал не нужен: прогулка после обеда уже многое даёт, и твой план уже учитывает то, что ты делаешь.",
      cta: "Дальше",
    },
    struggles: {
      title: "Это совершенно нормально!",
      cta: "Дальше",
      many: "Ничто из этого не твоя неудача. Я ничего не запрещаю: ешь как ешь, а я честно скажу, как вписывается каждый приём пищи.",
    },
    restrictions: {
      title: "Спасибо за доверие",
      body: "Вес, то, что было трудно, и вот эти ответы — очень много доверия для одного разговора. Я использую это ровно для одного: судить каждое блюдо по тому, что важно тебе.",
      cta: "Собери мой план",
    },
  },
};

export const CHAT_COPY: Localized<ChatCopy> = { en: EN, fr: FR, de: DE, it: IT, es: ES, vi: VI, id: ID, ru: RU };

/** What Spud says back, in one language. English for one nobody has written yet. */
export const chatCopyFor = (lang: Lang): ChatCopy => t(lang)(CHAT_COPY);
