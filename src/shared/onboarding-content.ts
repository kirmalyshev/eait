// Onboarding's editable words, in every language the product speaks.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// WHY THE DATA IS HERE AND THE RULES ARE NEXT DOOR
//
// `onboarding.ts` owns the three layers — STEPS, SCREENS, CONTENT — and the validator that keeps an
// admin on the right side of the line between them. None of that changes when a language is added;
// only the CONTENT does, eight times over. So the tree lives here and the rules stay there, and the
// dependency runs ONE WAY: this file imports `onboarding.ts` and nothing imports back.
//
// EVERY LANGUAGE IS THE SAME REVISION. `version` is the join key between a funnel row and the words
// that produced it, and translations of one editorial revision are one revision — a German who
// completes onboarding and an Italian who does not were answering the same questions. Eight version
// counters would make the funnel eight funnels, each too small to read.
//
// THE PLACEHOLDERS ARE PART OF THE SENTENCE. `{floor}`, `{target}`, `{month}`, `{share}` and
// `{loseTail}` are filled by code; a translation that drops one renders a sentence with its number
// missing, and nothing would say so. `onboarding-content.test.ts` checks every one of them in every
// language, which is the only reason it is safe to have a translator anywhere near these strings.
//
// THE CLAIMS GATE IS NO LONGER ENGLISH-ONLY — `claims.ts` matches `guarantee`, `weight-promise`,
// `lowers-marker` and `detox` in all eight languages — but this surface opts into
// `retired-no-email` alone, still an English pattern, because its own honest answers ("Lose
// weight", "Diabetes") are sentences the wider set cannot read. What protects the seven
// translations is what it was: they are TRANSLATIONS of copy that passed the gate — the English
// is the source, and a sentence is changed there first. A translation that invents a claim of
// its own is a review problem, and the review is the PR.
// ─────────────────────────────────────────────────────────────────────────────────────────────

import { t, type Localized } from "./lang.ts";
import type { Lang } from "./types.ts";
import { DEFAULT_ONBOARDING_CONTENT, usableContent, type OnboardingContent } from "./onboarding.ts";

// ── Français ─────────────────────────────────────────────────────────────────────────────────

// ── Français ──────────────────────────────────────────────────────────────────────

const FR: OnboardingContent = {
  version: DEFAULT_ONBOARDING_CONTENT.version,
  welcome: {
    lines: ["Compte les calories avec une photo"],
    cta: "Commencer",
    signin: "J'ai déjà un compte",
  },
  screens: [
    {
      id: "goal",
      asks: { goal: { lines: ["Quel est ton objectif ?"] } },
      options: {
        lose: { label: "Perdre du poids" },
        maintain: { label: "Garder mon poids" },
        gain: { label: "Prendre du poids" },
      },
    },
    {
      id: "sex",
      asks: { sex: { lines: ["Quel est ton sexe ?"] } },
      options: { male: { label: "Homme" }, female: { label: "Femme" }, other: { label: "Autre" } },
    },
    {
      id: "age",
      asks: { birth_year: { lines: ["Ton âge ?"], placeholder: "Ton âge" } },
    },
    {
      id: "height",
      asks: { height_cm: { lines: ["Taille"], placeholder: "Taille en cm" } },
    },
    {
      id: "weight",
      asks: { weight_kg: { lines: ["Ton poids"], placeholder: "Poids en kg" } },
    },
    {
      id: "activity",
      asks: { activity: { lines: ["À quel point tes journées sont-elles actives ?"] } },
      options: {
        none: { label: "0", hint: "Pas de séance" },
        few: { label: "1–2", hint: "Une séance de temps en temps" },
        some: { label: "3–4", hint: "Quelques séances par semaine" },
        many: { label: "5+", hint: "Athlète confirmé" },
      },
    },
    {
      id: "target",
      asks: { target_weight_kg: { lines: ["Quel poids vises-tu ?"], placeholder: "Poids cible en kg" } },
    },
    {
      id: "pace",
      asks: { pace: { lines: ["À quel rythme ?"] } },
      options: {
        easy: { label: "Doux" },
        steady: { label: "Régulier" },
        push: { label: "Soutenu" },
      },
    },
    {
      id: "counted",
      asks: { counted_before: { lines: ["Déjà compté les calories ?"] } },
      options: {
        never: { label: "Jamais" },
        stopped: { label: "Essayé, arrêté" },
        onoff: { label: "Par intermittence" },
        now: { label: "Je compte en ce moment" },
      },
    },
    {
      id: "barrier",
      asks: {
        barriers: {
          lines: ["Qu'est-ce qui t'a arrêté ?", "Choisis tout ce qui s'applique"],
          variants: {
            onoff: ["Qu'est-ce qui t'a gêné ?", "Choisis tout ce qui s'applique"],
            now: ["Qu'est-ce qui te faciliterait la tâche ?", "Choisis tout ce qui s'applique"],
          },
        },
      },
      options: {
        too_long: { label: "Ça prenait trop de temps" },
        forgot: { label: "J'oubliais" },
        invisible: { label: "Je ne voyais pas de résultats" },
        no_idea: { label: "Je ne savais pas quoi manger" },
        stressful: { label: "C'était stressant" },
        nobody: { label: "Personne à qui demander" },
        creeping: { label: "Mon poids revenait petit à petit" },
        not_enough: { label: "Dur de manger assez" },
      },
    },
    {
      id: "situation",
      asks: {
        situations: {
          lines: ["Quand est-ce le plus dur de noter ?"],
          variants: { never: ["Quand penses-tu que noter sera le plus dur ?"] },
        },
      },
      options: {
        workdays: { label: "Les jours de travail chargés" },
        eating_out: { label: "Au restaurant" },
        cooking: { label: "Cuisiner pour d'autres" },
        snacks: { label: "Snacks et boissons" },
        evenings: { label: "Soirs et week-ends" },
      },
    },
    {
      id: "diet",
      asks: { diet: { lines: ["Tu suis un régime particulier ?"] } },
      options: {
        balanced: { label: "Équilibré" },
        wholefood: { label: "Aliments complets" },
        mediterranean: { label: "Méditerranéen" },
        flexitarian: { label: "Flexitarien" },
        pescatarian: { label: "Pescétarien" },
        vegetarian: { label: "Végétarien" },
        vegan: { label: "Végétalien" },
      },
    },
    {
      id: "medical",
      asks: { medical: { lines: ["Des contraintes de santé ?"] } },
      options: {
        kidneys: { label: "Maladie rénale" },
        ldl: { label: "Cholestérol élevé" },
        lowsugar: { label: "Risque de diabète" },
        none: { label: "Rien de tout ça" },
      },
    },
    {
      id: "country",
      asks: { country: { lines: ["Où manges-tu ?"], placeholder: "Rechercher" } },
      enabled: true,
      options: { other: { label: "Ailleurs" } },
    },
    {
      id: "streak",
      asks: { streak_goal_days: { lines: ["Quelle série viser ?"] } },
      options: {
        "7": { label: "7 jours" },
        "14": { label: "14 jours" },
        "30": { label: "30 jours" },
        "50": { label: "50 jours" },
      },
    },
  ],
  building: {
    lines: ["Je construis ton plan personnel"],
    title: "Ton plan quotidien",
    rows: {
      calories: "Calories", protein: "Protéines", carbs: "Glucides",
      fat: "Lipides", diet: "Régime",
    },
    limitCap: { ldl: "graisses saturées ≤ {n}g", kidneys: "sodium ≤ {n}mg" },
    cta: "Montre-moi le plan",
    floorTitle: "On s'arrête à {floor}kcal",
    floorBody: "Le calcul voulait descendre plus bas. Sans suivi médical, on ne fixe pas d'objectif en dessous, donc le tien s'arrête ici. Ton journal le dira aussi.",
  },
  summary: {
    lines: ["Voilà ton plan"],
    kcalLabel: "kcal par jour",
    floorMarker: "plafonné par sécurité · jamais sous {floor}",
    macros: {
      protein: "Protéines", carbs: "Glucides", fat: "Lipides",
      satfat: "Graisses saturées · tu l'as demandé",
    },
    capNote: "Ce rythme demanderait un écart quotidien plus grand qu'on ne peut tenir sans risque, alors tu as la version sûre : {share}% de ce que ton corps brûle en une journée.",
    cta: "Photographie ton premier repas",
  },
};

// ── Deutsch ───────────────────────────────────────────────────────────────────────

const DE: OnboardingContent = {
  version: DEFAULT_ONBOARDING_CONTENT.version,
  welcome: {
    lines: ["Kalorien zählen per Foto"],
    cta: "Los geht's",
    signin: "Ich habe schon ein Konto",
  },
  screens: [
    {
      id: "goal",
      asks: { goal: { lines: ["Was willst du erreichen?"] } },
      options: {
        lose: { label: "Abnehmen" },
        maintain: { label: "Mein Gewicht halten" },
        gain: { label: "Zunehmen" },
      },
    },
    {
      id: "sex",
      asks: { sex: { lines: ["Dein Geschlecht?"] } },
      options: { male: { label: "Männlich" }, female: { label: "Weiblich" }, other: { label: "Divers" } },
    },
    {
      id: "age",
      asks: { birth_year: { lines: ["Dein Alter?"], placeholder: "Dein Alter" } },
    },
    {
      id: "height",
      asks: { height_cm: { lines: ["Größe"], placeholder: "Größe in cm" } },
    },
    {
      id: "weight",
      asks: { weight_kg: { lines: ["Dein Gewicht"], placeholder: "Gewicht in kg" } },
    },
    {
      id: "activity",
      asks: { activity: { lines: ["Wie aktiv sind deine Tage?"] } },
      options: {
        none: { label: "0", hint: "Kein Training" },
        few: { label: "1–2", hint: "Ab und zu ein Workout" },
        some: { label: "3–4", hint: "Ein paar Workouts pro Woche" },
        many: { label: "5+", hint: "Fast täglich Training" },
      },
    },
    {
      id: "target",
      asks: { target_weight_kg: { lines: ["Welches Gewicht strebst du an?"], placeholder: "Zielgewicht in kg" } },
    },
    {
      id: "pace",
      asks: { pace: { lines: ["Wie schnell?"] } },
      options: {
        easy: { label: "Sanft" },
        steady: { label: "Stetig" },
        push: { label: "Zügig" },
      },
    },
    {
      id: "counted",
      asks: { counted_before: { lines: ["Schon mal Kalorien gezählt?"] } },
      options: {
        never: { label: "Nie" },
        stopped: { label: "Probiert, aufgehört" },
        onoff: { label: "Mal so, mal so" },
        now: { label: "Ich zähle gerade" },
      },
    },
    {
      id: "barrier",
      asks: {
        barriers: {
          lines: ["Was hat dich gestoppt?", "Wähl alles, was zutrifft"],
          variants: {
            onoff: ["Was kam dazwischen?", "Wähl alles, was zutrifft"],
            now: ["Was würdest du dir leichter wünschen?", "Wähl alles, was zutrifft"],
          },
        },
      },
      options: {
        too_long: { label: "Es dauerte zu lange" },
        forgot: { label: "Ich hab's vergessen" },
        invisible: { label: "Ich hab keine Fortschritte gesehen" },
        no_idea: { label: "Ich wusste nicht, was ich essen soll" },
        stressful: { label: "Es war stressig" },
        nobody: { label: "Niemand zum Fragen" },
        creeping: { label: "Mein Gewicht kam langsam zurück" },
        not_enough: { label: "Schwer, genug zu essen" },
      },
    },
    {
      id: "situation",
      asks: {
        situations: {
          lines: ["Wann fällt das Eintragen am schwersten?"],
          variants: { never: ["Wann wird das Eintragen vermutlich am schwersten?"] },
        },
      },
      options: {
        workdays: { label: "Volle Arbeitstage" },
        eating_out: { label: "Essen gehen" },
        cooking: { label: "Für andere kochen" },
        snacks: { label: "Snacks und Getränke" },
        evenings: { label: "Abende und Wochenenden" },
      },
    },
    {
      id: "diet",
      asks: { diet: { lines: ["Folgst du einer Ernährungsweise?"] } },
      options: {
        balanced: { label: "Ausgewogen" },
        wholefood: { label: "Vollwertkost" },
        mediterranean: { label: "Mediterran" },
        flexitarian: { label: "Flexitarisch" },
        pescatarian: { label: "Pescetarisch" },
        vegetarian: { label: "Vegetarisch" },
        vegan: { label: "Vegan" },
      },
    },
    {
      id: "medical",
      asks: { medical: { lines: ["Medizinische Einschränkungen?"] } },
      options: {
        kidneys: { label: "Nierenerkrankung" },
        ldl: { label: "Hoher Cholesterinwert" },
        lowsugar: { label: "Diabetesrisiko" },
        none: { label: "Nichts davon" },
      },
    },
    {
      id: "country",
      asks: { country: { lines: ["Wo isst du?"], placeholder: "Suchen" } },
      enabled: true,
      options: { other: { label: "Woanders" } },
    },
    {
      id: "streak",
      asks: { streak_goal_days: { lines: ["Welche Serie peilst du an?"] } },
      options: {
        "7": { label: "7 Tage" },
        "14": { label: "14 Tage" },
        "30": { label: "30 Tage" },
        "50": { label: "50 Tage" },
      },
    },
  ],
  building: {
    lines: ["Dein persönlicher Plan wird erstellt"],
    title: "Dein Tagesplan",
    rows: {
      calories: "Kalorien", protein: "Protein", carbs: "Kohlenhydrate",
      fat: "Fett", diet: "Ernährung",
    },
    limitCap: { ldl: "gesättigte Fettsäuren ≤ {n}g", kidneys: "Natrium ≤ {n}mg" },
    cta: "Zeig mir den Plan",
    floorTitle: "Wir bleiben bei {floor}kcal",
    floorBody: "Die Rechnung wollte tiefer. Ohne ärztliche Begleitung setzen wir keine Ziele darunter, also liegt deins genau hier. In deinem Tagebuch steht das auch.",
  },
  summary: {
    lines: ["Hier ist dein Plan"],
    kcalLabel: "kcal pro Tag",
    floorMarker: "aus Sicherheitsgründen begrenzt · nie unter {floor}",
    macros: {
      protein: "Protein", carbs: "Kohlenhydrate", fat: "Fett",
      satfat: "Gesättigte Fettsäuren · auf deinen Wunsch",
    },
    capNote: "Dieses Tempo bräuchte eine größere Tagesänderung, als sich sicher durchhalten lässt, also bekommst du die sichere Variante: {share}% dessen, was dein Körper am Tag verbrennt.",
    cta: "Fotografier deine erste Mahlzeit",
  },
};

// ── Italiano ──────────────────────────────────────────────────────────────────────

const IT: OnboardingContent = {
  version: DEFAULT_ONBOARDING_CONTENT.version,
  welcome: {
    lines: ["Conta le calorie con una foto"],
    cta: "Inizia",
    signin: "Ho già un account",
  },
  screens: [
    {
      id: "goal",
      asks: { goal: { lines: ["Cosa vuoi ottenere?"] } },
      options: {
        lose: { label: "Perdere peso" },
        maintain: { label: "Mantenere il peso" },
        gain: { label: "Prendere peso" },
      },
    },
    {
      id: "sex",
      asks: { sex: { lines: ["Qual è il tuo sesso?"] } },
      options: { male: { label: "Uomo" }, female: { label: "Donna" }, other: { label: "Altro" } },
    },
    {
      id: "age",
      asks: { birth_year: { lines: ["La tua età?"], placeholder: "La tua età" } },
    },
    {
      id: "height",
      asks: { height_cm: { lines: ["Altezza"], placeholder: "Altezza in cm" } },
    },
    {
      id: "weight",
      asks: { weight_kg: { lines: ["Il tuo peso"], placeholder: "Peso in kg" } },
    },
    {
      id: "activity",
      asks: { activity: { lines: ["Quanto sono attive le tue giornate?"] } },
      options: {
        none: { label: "0", hint: "Nessun allenamento" },
        few: { label: "1–2", hint: "Un allenamento ogni tanto" },
        some: { label: "3–4", hint: "Qualche allenamento a settimana" },
        many: { label: "5+", hint: "Quasi tutti i giorni" },
      },
    },
    {
      id: "target",
      asks: { target_weight_kg: { lines: ["Che peso vuoi raggiungere?"], placeholder: "Peso obiettivo in kg" } },
    },
    {
      id: "pace",
      asks: { pace: { lines: ["A che ritmo?"] } },
      options: {
        easy: { label: "Dolce" },
        steady: { label: "Costante" },
        push: { label: "Sostenuto" },
      },
    },
    {
      id: "counted",
      asks: { counted_before: { lines: ["Hai mai contato le calorie?"] } },
      options: {
        never: { label: "Mai" },
        stopped: { label: "Provato, poi smesso" },
        onoff: { label: "Ogni tanto" },
        now: { label: "Le conto adesso" },
      },
    },
    {
      id: "barrier",
      asks: {
        barriers: {
          lines: ["Cosa ti ha fermato?", "Scegli tutte quelle che valgono"],
          variants: {
            onoff: ["Cosa si è messo in mezzo?", "Scegli tutte quelle che valgono"],
            now: ["Cosa vorresti più facile?", "Scegli tutte quelle che valgono"],
          },
        },
      },
      options: {
        too_long: { label: "Ci voleva troppo tempo" },
        forgot: { label: "Dimenticavo" },
        invisible: { label: "Non vedevo risultati" },
        no_idea: { label: "Non sapevo cosa mangiare" },
        stressful: { label: "Era stressante" },
        nobody: { label: "Nessuno a cui chiedere" },
        creeping: { label: "Il mio peso tornava su" },
        not_enough: { label: "Difficile mangiare abbastanza" },
      },
    },
    {
      id: "situation",
      asks: {
        situations: {
          lines: ["Quando è più difficile registrare i pasti?"],
          variants: { never: ["Quando pensi che registrare i pasti sarà più difficile?"] },
        },
      },
      options: {
        workdays: { label: "Giornate di lavoro piene" },
        eating_out: { label: "Mangiare fuori" },
        cooking: { label: "Cucinare per altri" },
        snacks: { label: "Snack e bevande" },
        evenings: { label: "Sere e weekend" },
      },
    },
    {
      id: "diet",
      asks: { diet: { lines: ["Segui una dieta?"] } },
      options: {
        balanced: { label: "Equilibrata" },
        wholefood: { label: "Cibi poco lavorati" },
        mediterranean: { label: "Mediterranea" },
        flexitarian: { label: "Flexitariana" },
        pescatarian: { label: "Pescetariana" },
        vegetarian: { label: "Vegetariana" },
        vegan: { label: "Vegana" },
      },
    },
    {
      id: "medical",
      asks: { medical: { lines: ["Hai condizioni mediche da considerare?"] } },
      options: {
        kidneys: { label: "Malattia renale" },
        ldl: { label: "Colesterolo alto" },
        lowsugar: { label: "Rischio di diabete" },
        none: { label: "Niente di tutto questo" },
      },
    },
    {
      id: "country",
      asks: { country: { lines: ["Dove mangi?"], placeholder: "Cerca" } },
      enabled: true,
      options: { other: { label: "Altrove" } },
    },
    {
      id: "streak",
      asks: { streak_goal_days: { lines: ["Quale serie vuoi raggiungere?"] } },
      options: {
        "7": { label: "7 giorni" },
        "14": { label: "14 giorni" },
        "30": { label: "30 giorni" },
        "50": { label: "50 giorni" },
      },
    },
  ],
  building: {
    lines: ["Sto costruendo il tuo piano personale"],
    title: "Il tuo piano giornaliero",
    rows: {
      calories: "Calorie", protein: "Proteine", carbs: "Carboidrati",
      fat: "Grassi", diet: "Dieta",
    },
    limitCap: { ldl: "grassi saturi ≤ {n}g", kidneys: "sodio ≤ {n}mg" },
    cta: "Mostrami il piano",
    floorTitle: "Ci fermiamo a {floor}kcal",
    floorBody: "Il calcolo voleva scendere ancora. Senza controllo medico non fissiamo obiettivi sotto questa soglia, quindi il tuo resta qui. Lo dirà anche il tuo diario.",
  },
  summary: {
    lines: ["Ecco il tuo piano"],
    kcalLabel: "kcal al giorno",
    floorMarker: "limitato per sicurezza · mai sotto {floor}",
    macros: {
      protein: "Proteine", carbs: "Carboidrati", fat: "Grassi",
      satfat: "Grassi saturi · l'hai chiesto tu",
    },
    capNote: "Quel ritmo chiederebbe una variazione quotidiana più grande di quanto sia sicuro mantenere, quindi il tuo è la versione sicura: {share}% di quello che il tuo corpo brucia in un giorno.",
    cta: "Fotografa il tuo primo pasto",
  },
};

// ── Español ───────────────────────────────────────────────────────────────────────

const ES: OnboardingContent = {
  version: DEFAULT_ONBOARDING_CONTENT.version,
  welcome: {
    lines: ["Cuenta calorías con una foto"],
    cta: "Empezar",
    signin: "Ya tengo una cuenta",
  },
  screens: [
    {
      id: "goal",
      asks: { goal: { lines: ["¿Para qué estás aquí?"] } },
      options: {
        lose: { label: "Perder peso" },
        maintain: { label: "Mantener mi peso" },
        gain: { label: "Ganar peso" },
      },
    },
    {
      id: "sex",
      asks: { sex: { lines: ["¿Cuál es tu sexo?"] } },
      options: { male: { label: "Hombre" }, female: { label: "Mujer" }, other: { label: "Otro" } },
    },
    {
      id: "age",
      asks: { birth_year: { lines: ["¿Tu edad?"], placeholder: "Tu edad" } },
    },
    {
      id: "height",
      asks: { height_cm: { lines: ["Altura"], placeholder: "Altura en cm" } },
    },
    {
      id: "weight",
      asks: { weight_kg: { lines: ["Tu peso"], placeholder: "Peso en kg" } },
    },
    {
      id: "activity",
      asks: { activity: { lines: ["¿Cómo de activos son tus días?"] } },
      options: {
        none: { label: "0", hint: "Sin entrenamientos" },
        few: { label: "1–2", hint: "Algún entrenamiento de vez en cuando" },
        some: { label: "3–4", hint: "Unos entrenamientos a la semana" },
        many: { label: "5+", hint: "Entreno casi a diario" },
      },
    },
    {
      id: "target",
      asks: { target_weight_kg: { lines: ["¿Cuál es tu peso objetivo?"], placeholder: "Peso objetivo en kg" } },
    },
    {
      id: "pace",
      asks: { pace: { lines: ["¿A qué ritmo?"] } },
      options: {
        easy: { label: "Suave" },
        steady: { label: "Constante" },
        push: { label: "Rápido" },
      },
    },
    {
      id: "counted",
      asks: { counted_before: { lines: ["¿Has contado calorías antes?"] } },
      options: {
        never: { label: "Nunca" },
        stopped: { label: "Lo intenté, lo dejé" },
        onoff: { label: "A ratos" },
        now: { label: "Las cuento ahora" },
      },
    },
    {
      id: "barrier",
      asks: {
        barriers: {
          lines: ["¿Qué te hizo parar?", "Elige todas las que encajen"],
          variants: {
            onoff: ["¿Qué te lo puso difícil?", "Elige todas las que encajen"],
            now: ["¿Qué te gustaría que fuera más fácil?", "Elige todas las que encajen"],
          },
        },
      },
      options: {
        too_long: { label: "Llevaba demasiado tiempo" },
        forgot: { label: "Se me olvidaba" },
        invisible: { label: "No veía resultados" },
        no_idea: { label: "No sabía qué comer" },
        stressful: { label: "Me resultaba estresante" },
        nobody: { label: "Nadie a quien preguntar" },
        creeping: { label: "Mi peso volvía a subir" },
        not_enough: { label: "Me costaba comer suficiente" },
      },
    },
    {
      id: "situation",
      asks: {
        situations: {
          lines: ["¿Cuándo es más difícil registrar?"],
          variants: { never: ["¿Cuándo crees que registrar será más difícil?"] },
        },
      },
      options: {
        workdays: { label: "Días de trabajo ajetreados" },
        eating_out: { label: "Comer fuera" },
        cooking: { label: "Cocinar para otros" },
        snacks: { label: "Snacks y bebidas" },
        evenings: { label: "Tardes y fines de semana" },
      },
    },
    {
      id: "diet",
      asks: { diet: { lines: ["¿Sigues alguna dieta?"] } },
      options: {
        balanced: { label: "Equilibrada" },
        wholefood: { label: "Comida real" },
        mediterranean: { label: "Mediterránea" },
        flexitarian: { label: "Flexitariana" },
        pescatarian: { label: "Pescetariana" },
        vegetarian: { label: "Vegetariana" },
        vegan: { label: "Vegana" },
      },
    },
    {
      id: "medical",
      asks: { medical: { lines: ["¿Alguna condición médica?"] } },
      options: {
        kidneys: { label: "Enfermedad renal" },
        ldl: { label: "Colesterol alto" },
        lowsugar: { label: "Riesgo de diabetes" },
        none: { label: "Ninguna de estas" },
      },
    },
    {
      id: "country",
      asks: { country: { lines: ["¿Dónde comes?"], placeholder: "Buscar" } },
      enabled: true,
      options: { other: { label: "En otro sitio" } },
    },
    {
      id: "streak",
      asks: { streak_goal_days: { lines: ["¿Qué racha quieres lograr?"] } },
      options: {
        "7": { label: "7 días" },
        "14": { label: "14 días" },
        "30": { label: "30 días" },
        "50": { label: "50 días" },
      },
    },
  ],
  building: {
    lines: ["Creando tu plan personal"],
    title: "Tu plan diario",
    rows: {
      calories: "Calorías", protein: "Proteína", carbs: "Carbohidratos",
      fat: "Grasas", diet: "Dieta",
    },
    limitCap: { ldl: "grasas saturadas ≤ {n}g", kidneys: "sodio ≤ {n}mg" },
    cta: "Enséñame el plan",
    floorTitle: "Nos quedamos en {floor}kcal",
    floorBody: "El cálculo quería bajar más. Sin supervisión médica no fijamos objetivos por debajo de esto, así que el tuyo se queda aquí. Tu diario también lo dirá.",
  },
  summary: {
    lines: ["Aquí está tu plan"],
    kcalLabel: "kcal al día",
    floorMarker: "limitado por seguridad · nunca por debajo de {floor}",
    macros: {
      protein: "Proteína", carbs: "Carbohidratos", fat: "Grasas",
      satfat: "Grasas saturadas · lo pediste tú",
    },
    capNote: "Ese ritmo pediría un cambio diario mayor del que es seguro sostener, así que el tuyo es la versión segura: {share}% de lo que tu cuerpo quema en un día.",
    cta: "Fotografía tu primera comida",
  },
};

// ── Tiếng Việt ────────────────────────────────────────────────────────────────────

const VI: OnboardingContent = {
  version: DEFAULT_ONBOARDING_CONTENT.version,
  welcome: {
    lines: ["Đếm calo bằng một tấm ảnh"],
    cta: "Bắt đầu",
    signin: "Mình đã có tài khoản",
  },
  screens: [
    {
      id: "goal",
      asks: { goal: { lines: ["Bạn đến đây để làm gì?"] } },
      options: {
        lose: { label: "Giảm cân" },
        maintain: { label: "Giữ cân nặng của mình" },
        gain: { label: "Tăng cân" },
      },
    },
    {
      id: "sex",
      asks: { sex: { lines: ["Giới tính của bạn là gì?"] } },
      options: { male: { label: "Nam" }, female: { label: "Nữ" }, other: { label: "Khác" } },
    },
    {
      id: "age",
      asks: { birth_year: { lines: ["Tuổi của bạn?"], placeholder: "Tuổi của bạn" } },
    },
    {
      id: "height",
      asks: { height_cm: { lines: ["Chiều cao"], placeholder: "Chiều cao (cm)" } },
    },
    {
      id: "weight",
      asks: { weight_kg: { lines: ["Cân nặng của bạn"], placeholder: "Cân nặng (kg)" } },
    },
    {
      id: "activity",
      asks: { activity: { lines: ["Ngày của bạn vận động thế nào?"] } },
      options: {
        none: { label: "0", hint: "Không tập" },
        few: { label: "1–2", hint: "Thỉnh thoảng tập" },
        some: { label: "3–4", hint: "Vài buổi tập mỗi tuần" },
        many: { label: "5+", hint: "Vận động viên thực thụ" },
      },
    },
    {
      id: "target",
      asks: { target_weight_kg: { lines: ["Bạn nhắm đến mức cân nào?"], placeholder: "Cân nặng mục tiêu (kg)" } },
    },
    {
      id: "pace",
      asks: { pace: { lines: ["Nhanh thế nào?"] } },
      options: {
        easy: { label: "Nhẹ nhàng" },
        steady: { label: "Đều đặn" },
        push: { label: "Nhanh" },
      },
    },
    {
      id: "counted",
      asks: { counted_before: { lines: ["Bạn đã từng đếm calo chưa?"] } },
      options: {
        never: { label: "Chưa bao giờ" },
        stopped: { label: "Đã thử, rồi bỏ" },
        onoff: { label: "Thỉnh thoảng" },
        now: { label: "Mình đang đếm" },
      },
    },
    {
      id: "barrier",
      asks: {
        barriers: {
          lines: ["Điều gì khiến bạn dừng lại?", "Chọn tất cả những gì đúng"],
          variants: {
            onoff: ["Điều gì đã cản trở bạn?", "Chọn tất cả những gì đúng"],
            now: ["Bạn muốn điều gì dễ hơn?", "Chọn tất cả những gì đúng"],
          },
        },
      },
      options: {
        too_long: { label: "Mất quá nhiều thời gian" },
        forgot: { label: "Mình hay quên" },
        invisible: { label: "Không thấy có kết quả" },
        no_idea: { label: "Không biết nên ăn gì" },
        stressful: { label: "Cảm thấy căng thẳng" },
        nobody: { label: "Không có ai để hỏi" },
        creeping: { label: "Cân nặng cứ tăng trở lại" },
        not_enough: { label: "Khó ăn đủ" },
      },
    },
    {
      id: "situation",
      asks: {
        situations: {
          lines: ["Khi nào ghi lại bữa ăn khó nhất?"],
          variants: { never: ["Bạn nghĩ khi nào ghi lại bữa ăn sẽ khó nhất?"] },
        },
      },
      options: {
        workdays: { label: "Ngày làm việc bận rộn" },
        eating_out: { label: "Ăn ngoài" },
        cooking: { label: "Nấu cho người khác" },
        snacks: { label: "Ăn vặt và đồ uống" },
        evenings: { label: "Buổi tối và cuối tuần" },
      },
    },
    {
      id: "diet",
      asks: { diet: { lines: ["Bạn có theo chế độ ăn nào không?"] } },
      options: {
        balanced: { label: "Cân bằng" },
        wholefood: { label: "Thực phẩm toàn phần" },
        mediterranean: { label: "Địa Trung Hải" },
        flexitarian: { label: "Ăn chay linh hoạt" },
        pescatarian: { label: "Ăn chay có cá" },
        vegetarian: { label: "Ăn chay" },
        vegan: { label: "Thuần chay" },
      },
    },
    {
      id: "medical",
      asks: { medical: { lines: ["Bạn có vấn đề sức khỏe nào cần lưu ý không?"] } },
      options: {
        kidneys: { label: "Bệnh thận" },
        ldl: { label: "Cholesterol cao" },
        lowsugar: { label: "Nguy cơ tiểu đường" },
        none: { label: "Không có gì trong số này" },
      },
    },
    {
      id: "country",
      asks: { country: { lines: ["Bạn ăn ở đâu?"], placeholder: "Tìm kiếm" } },
      enabled: true,
      options: { other: { label: "Nơi khác" } },
    },
    {
      id: "streak",
      asks: { streak_goal_days: { lines: ["Bạn muốn đạt chuỗi bao nhiêu ngày?"] } },
      options: {
        "7": { label: "7 ngày" },
        "14": { label: "14 ngày" },
        "30": { label: "30 ngày" },
        "50": { label: "50 ngày" },
      },
    },
  ],
  building: {
    lines: ["Đang lập kế hoạch riêng cho bạn"],
    title: "Kế hoạch mỗi ngày của bạn",
    rows: {
      calories: "Calo", protein: "Đạm", carbs: "Tinh bột",
      fat: "Chất béo", diet: "Chế độ ăn",
    },
    limitCap: { ldl: "chất béo bão hòa ≤ {n}g", kidneys: "natri ≤ {n}mg" },
    cta: "Cho mình xem kế hoạch",
    floorTitle: "Dừng lại ở {floor}kcal",
    floorBody: "Phép tính muốn xuống thấp hơn. Không có bác sĩ theo dõi thì chúng mình không đặt mục tiêu thấp hơn mức này, nên của bạn dừng ở đây. Nhật ký cũng sẽ ghi vậy.",
  },
  summary: {
    lines: ["Kế hoạch của bạn đây"],
    kcalLabel: "kcal mỗi ngày",
    floorMarker: "đã giới hạn vì an toàn · không bao giờ dưới {floor}",
    macros: {
      protein: "Đạm", carbs: "Tinh bột", fat: "Chất béo",
      satfat: "Chất béo bão hòa · bạn đã chọn",
    },
    capNote: "Tốc độ đó cần mức thay đổi mỗi ngày lớn hơn mức an toàn để duy trì, nên bạn nhận bản an toàn: {share}% lượng cơ thể bạn đốt trong một ngày.",
    cta: "Chụp bữa ăn đầu tiên",
  },
};

// ── Bahasa Indonesia ──────────────────────────────────────────────────────────────

const ID: OnboardingContent = {
  version: DEFAULT_ONBOARDING_CONTENT.version,
  welcome: {
    lines: ["Hitung kalori dengan foto"],
    cta: "Mulai",
    signin: "Aku sudah punya akun",
  },
  screens: [
    {
      id: "goal",
      asks: { goal: { lines: ["Kamu ke sini untuk apa?"] } },
      options: {
        lose: { label: "Menurunkan berat badan" },
        maintain: { label: "Jaga berat badan aku" },
        gain: { label: "Menaikkan berat badan" },
      },
    },
    {
      id: "sex",
      asks: { sex: { lines: ["Apa jenis kelaminmu?"] } },
      options: { male: { label: "Laki-laki" }, female: { label: "Perempuan" }, other: { label: "Lainnya" } },
    },
    {
      id: "age",
      asks: { birth_year: { lines: ["Umurmu?"], placeholder: "Umurmu" } },
    },
    {
      id: "height",
      asks: { height_cm: { lines: ["Tinggi badan"], placeholder: "Tinggi dalam cm" } },
    },
    {
      id: "weight",
      asks: { weight_kg: { lines: ["Berat badanmu"], placeholder: "Berat dalam kg" } },
    },
    {
      id: "activity",
      asks: { activity: { lines: ["Seberapa aktif harimu?"] } },
      options: {
        none: { label: "0", hint: "Tidak olahraga" },
        few: { label: "1–2", hint: "Olahraga sesekali" },
        some: { label: "3–4", hint: "Beberapa kali olahraga seminggu" },
        many: { label: "5+", hint: "Atlet / latihan serius" },
      },
    },
    {
      id: "target",
      asks: { target_weight_kg: { lines: ["Berat badan berapa yang kamu tuju?"], placeholder: "Berat target dalam kg" } },
    },
    {
      id: "pace",
      asks: { pace: { lines: ["Seberapa cepat?"] } },
      options: {
        easy: { label: "Santai" },
        steady: { label: "Stabil" },
        push: { label: "Cepat" },
      },
    },
    {
      id: "counted",
      asks: { counted_before: { lines: ["Pernah hitung kalori?"] } },
      options: {
        never: { label: "Belum pernah" },
        stopped: { label: "Pernah, lalu berhenti" },
        onoff: { label: "Kadang-kadang" },
        now: { label: "Aku masih menghitung" },
      },
    },
    {
      id: "barrier",
      asks: {
        barriers: {
          lines: ["Apa yang membuatmu berhenti?", "Pilih semua yang cocok"],
          variants: {
            onoff: ["Apa yang menghalangimu?", "Pilih semua yang cocok"],
            now: ["Apa yang ingin kamu permudah?", "Pilih semua yang cocok"],
          },
        },
      },
      options: {
        too_long: { label: "Terlalu lama" },
        forgot: { label: "Sering lupa" },
        invisible: { label: "Tidak kelihatan hasilnya" },
        no_idea: { label: "Tidak tahu mau makan apa" },
        stressful: { label: "Terasa stres" },
        nobody: { label: "Tidak ada yang bisa ditanya" },
        creeping: { label: "Beratku naik lagi pelan-pelan" },
        not_enough: { label: "Susah makan cukup" },
      },
    },
    {
      id: "situation",
      asks: {
        situations: {
          lines: ["Kapan mencatat paling susah?"],
          variants: { never: ["Menurutmu kapan mencatat akan paling susah?"] },
        },
      },
      options: {
        workdays: { label: "Hari kerja yang sibuk" },
        eating_out: { label: "Makan di luar" },
        cooking: { label: "Masak untuk orang lain" },
        snacks: { label: "Camilan dan minuman" },
        evenings: { label: "Malam dan akhir pekan" },
      },
    },
    {
      id: "diet",
      asks: { diet: { lines: ["Apakah kamu menjalani diet?"] } },
      options: {
        balanced: { label: "Seimbang" },
        wholefood: { label: "Makanan utuh" },
        mediterranean: { label: "Mediterania" },
        flexitarian: { label: "Fleksitarian" },
        pescatarian: { label: "Peskatarian" },
        vegetarian: { label: "Vegetarian" },
        vegan: { label: "Vegan" },
      },
    },
    {
      id: "medical",
      asks: { medical: { lines: ["Ada batasan medis?"] } },
      options: {
        kidneys: { label: "Penyakit ginjal" },
        ldl: { label: "Kolesterol tinggi" },
        lowsugar: { label: "Risiko diabetes" },
        none: { label: "Tidak ada" },
      },
    },
    {
      id: "country",
      asks: { country: { lines: ["Kamu makan di mana?"], placeholder: "Cari" } },
      enabled: true,
      options: { other: { label: "Di tempat lain" } },
    },
    {
      id: "streak",
      asks: { streak_goal_days: { lines: ["Mau target streak berapa hari?"] } },
      options: {
        "7": { label: "7 hari" },
        "14": { label: "14 hari" },
        "30": { label: "30 hari" },
        "50": { label: "50 hari" },
      },
    },
  ],
  building: {
    lines: ["Menyusun rencana pribadimu"],
    title: "Rencana harianmu",
    rows: {
      calories: "Kalori", protein: "Protein", carbs: "Karbohidrat",
      fat: "Lemak", diet: "Diet",
    },
    limitCap: { ldl: "lemak jenuh ≤ {n}g", kidneys: "natrium ≤ {n}mg" },
    cta: "Tunjukkan rencananya",
    floorTitle: "Kami berhenti di {floor}kcal",
    floorBody: "Hitungannya mengarah lebih rendah lagi. Tanpa pengawasan medis kami tidak menetapkan target di bawah ini, jadi punyamu berhenti di sini. Buku harianmu juga akan menyebutkannya.",
  },
  summary: {
    lines: ["Ini rencanamu"],
    kcalLabel: "kcal per hari",
    floorMarker: "dibatasi demi keamanan · tidak pernah di bawah {floor}",
    macros: {
      protein: "Protein", carbs: "Karbohidrat", fat: "Lemak",
      satfat: "Lemak jenuh · kamu yang minta",
    },
    capNote: "Tempo itu butuh selisih harian yang terlalu besar untuk dijaga dengan aman, jadi rencanamu memakai versi aman: {share}% dari kalori yang dibakar tubuhmu dalam sehari.",
    cta: "Foto makanan pertamamu",
  },
};

// ── Русский ───────────────────────────────────────────────────────────────────────

const RU: OnboardingContent = {
  version: DEFAULT_ONBOARDING_CONTENT.version,
  welcome: {
    lines: ["Считай калории по фото"],
    cta: "Начать",
    signin: "У меня уже есть аккаунт",
  },
  screens: [
    {
      id: "goal",
      asks: { goal: { lines: ["Какая у тебя цель?"] } },
      options: {
        lose: { label: "Похудеть" },
        maintain: { label: "Сохранить вес" },
        gain: { label: "Набрать вес" },
      },
    },
    {
      id: "sex",
      asks: { sex: { lines: ["Твой пол?"] } },
      options: { male: { label: "Мужской" }, female: { label: "Женский" }, other: { label: "Другой" } },
    },
    {
      id: "age",
      asks: { birth_year: { lines: ["Твой возраст?"], placeholder: "Твой возраст" } },
    },
    {
      id: "height",
      asks: { height_cm: { lines: ["Рост"], placeholder: "Рост в см" } },
    },
    {
      id: "weight",
      asks: { weight_kg: { lines: ["Твой вес"], placeholder: "Вес в кг" } },
    },
    {
      id: "activity",
      asks: { activity: { lines: ["Насколько активны твои дни?"] } },
      options: {
        none: { label: "0", hint: "Без тренировок" },
        few: { label: "1–2", hint: "Тренировки время от времени" },
        some: { label: "3–4", hint: "Несколько тренировок в неделю" },
        many: { label: "5+", hint: "Почти каждый день" },
      },
    },
    {
      id: "target",
      asks: { target_weight_kg: { lines: ["К какому весу ты хочешь прийти?"], placeholder: "Целевой вес в кг" } },
    },
    {
      id: "pace",
      asks: { pace: { lines: ["В каком темпе?"] } },
      options: {
        easy: { label: "Мягкий" },
        steady: { label: "Ровный" },
        push: { label: "Быстрый" },
      },
    },
    {
      id: "counted",
      asks: { counted_before: { lines: ["Доводилось считать калории?"] } },
      options: {
        never: { label: "Ни разу" },
        stopped: { label: "Раньше да, теперь нет" },
        onoff: { label: "С перерывами" },
        now: { label: "Считаю сейчас" },
      },
    },
    {
      id: "barrier",
      asks: {
        barriers: {
          lines: ["Что тебя остановило?", "Выбери всё, что подходит"],
          variants: {
            onoff: ["Что тебе мешало?", "Выбери всё, что подходит"],
            now: ["Что было бы проще?", "Выбери всё, что подходит"],
          },
        },
      },
      options: {
        too_long: { label: "Это занимало слишком много времени" },
        forgot: { label: "Вылетало из головы" },
        invisible: { label: "Не было видно результата" },
        no_idea: { label: "Было непонятно, что есть" },
        stressful: { label: "Это напрягало" },
        nobody: { label: "Некого было спросить" },
        creeping: { label: "Вес всё время возвращался" },
        not_enough: { label: "Трудно было съедать достаточно" },
      },
    },
    {
      id: "situation",
      asks: {
        situations: {
          lines: ["Когда сложнее всего записывать?"],
          variants: { never: ["Как думаешь, когда записывать будет сложнее всего?"] },
        },
      },
      options: {
        workdays: { label: "Загруженные будни" },
        eating_out: { label: "Еда вне дома" },
        cooking: { label: "Готовка для других" },
        snacks: { label: "Перекусы и напитки" },
        evenings: { label: "Вечера и выходные" },
      },
    },
    {
      id: "diet",
      asks: { diet: { lines: ["Ты придерживаешься какой-то диеты?"] } },
      options: {
        balanced: { label: "Сбалансированная" },
        wholefood: { label: "Цельные продукты" },
        mediterranean: { label: "Средиземноморская" },
        flexitarian: { label: "Флекситарианская" },
        pescatarian: { label: "Пескетарианская" },
        vegetarian: { label: "Вегетарианская" },
        vegan: { label: "Веганская" },
      },
    },
    {
      id: "medical",
      asks: { medical: { lines: ["Есть ли медицинские ограничения?"] } },
      options: {
        kidneys: { label: "Заболевание почек" },
        ldl: { label: "Высокий холестерин" },
        lowsugar: { label: "Риск диабета" },
        none: { label: "Ничего из этого" },
      },
    },
    {
      id: "country",
      asks: { country: { lines: ["Где ты ешь?"], placeholder: "Поиск" } },
      enabled: true,
      options: { other: { label: "Где-то ещё" } },
    },
    {
      id: "streak",
      asks: { streak_goal_days: { lines: ["На какую серию настроимся?"] } },
      options: {
        "7": { label: "7 дн." },
        "14": { label: "14 дн." },
        "30": { label: "30 дн." },
        "50": { label: "50 дн." },
      },
    },
  ],
  building: {
    lines: ["Составляю твой личный план"],
    title: "Твой план на день",
    rows: {
      calories: "Калории", protein: "Белок", carbs: "Углеводы",
      fat: "Жиры", diet: "Диета",
    },
    limitCap: { ldl: "насыщенные жиры ≤ {n}г", kidneys: "натрий ≤ {n}мг" },
    cta: "Показать план",
    floorTitle: "Мы остановились на {floor}ккал",
    floorBody: "Расчёт хотел уйти ниже. Без наблюдения врача мы не ставим цели ниже этой отметки, так что твоя — здесь. В дневнике это тоже будет написано.",
  },
  summary: {
    lines: ["Вот твой план"],
    kcalLabel: "ккал в день",
    floorMarker: "ограничено ради безопасности · никогда ниже {floor}",
    macros: {
      protein: "Белок", carbs: "Углеводы", fat: "Жиры",
      satfat: "Насыщенные жиры · по твоему запросу",
    },
    capNote: "Такой темп потребовал бы большей дневной разницы, чем безопасно выдерживать, так что у тебя безопасный вариант: {share}% от того, что тело сжигает за день.",
    cta: "Сфотографируй первый приём пищи",
  },
};

const TE: OnboardingContent = {
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
  // Health, and a newer one moves the target on every surface, the browser included. v11 grows
  // the country question from four options to fifteen: it offered Germany, the UK, the US and
  // "Somewhere else" while the product shipped in eight languages, so a Vietnamese, Indonesian,
  // Italian, Spanish or Russian reader had exactly one true answer and it was the sentinel. The
  // labels left this file with it — a country's name is CLDR's, not an admin's. Bumped because a
  // funnel row for a four-chip screen and one for a fifteen-chip screen are not the same screen.
  // v12 is the v5 redesign's copy (issue #42): the age question asks "How old are you?" plainly,
  // and the activity options answer in plain frequencies — "A little each week" — rather than
  // effort labels. v13 (#50) drops 'No account needed to start.': the web asks for a sign-in
  // before the first question, and one content tree cannot say it on the phone only.
  // v14 is targets v2 (#81): the activity question's five levels became three — few/some/many —
  // and the sex question gained "other". A stored v13 revision carries neither, so the validator
  // retires it and every language falls back to this.
  //
  // v15 IS ONBOARDING V2 (#82): the conversation becomes Cal AI-shaped plain screens, one question
  // each — twelve screens where seven used to be, the struggles eight became five stored picks,
  // the restrictions screen split into `diet` (seven single-choice) and `medical` (multi-select,
  // "None of these" a drawn row), and the sign-up beat lands between the plan and the country.
  // A stored v14 revision names screens and asks this shape cannot satisfy, so it falls back whole.
  // v16 (#1078): the activity question's three bands became four — 0 / 1–2 / 3–4 / 5+ — and `few`
  // moved from "0–2" to "1–2". A stored v15 labels the new `few` "0–2" and has no `none` at all,
  // so `usableContent` retires it and every language falls back to this. v17 (ieat-app#2050)
  // rewrites the welcome as a title and a subtitle — "A plan built around you" — over the photo.
  version: 19,
  welcome: {
    lines: ["ఫోటోతో కేలరీలు లెక్కించండి"],
    cta: "ప్రారంభించండి",
    signin: "నాకు ఇప్పటికే ఖాతా ఉంది",
  },
  screens: [
    {
      id: "goal",
      asks: {
        goal: { lines: ["మీరు ఇక్కడ ఏం చేయాలనుకుంటున్నారు?"] },
      },
      options: {
        lose: { label: "బరువు తగ్గడం" },
        maintain: { label: "బరువు నిలుపుకోవడం" },
        gain: { label: "బరువు పెరగడం" },
      },
    },
    {
      id: "sex",
      asks: {
        sex: { lines: ["మీ లింగం ఏమిటి?"] },
      },
      options: {
        male: { label: "పురుషుడు" },
        female: { label: "స్త్రీ" },
        other: { label: "ఇతర" },
      },
    },
    {
      id: "age",
      asks: {
        // Asked as an AGE and stored as a year — `checkNumber` in `onboarding-chat.ts` converts.
        birth_year: {
          lines: ["మీ వయసు?"],
          placeholder: "మీ వయసు",
        },
      },
    },
    {
      id: "height",
      asks: {
        height_cm: {
          lines: ["ఎత్తు"],
          placeholder: "ఎత్తు cmలో",
        },
      },
    },
    {
      id: "weight",
      asks: {
        weight_kg: {
          lines: ["మీ బరువు"],
          placeholder: "బరువు kgలో",
        },
      },
    },
    {
      id: "activity",
      asks: {
        activity: {
          lines: ["మీ రోజులు ఎంత చురుకుగా ఉంటాయి?"],
        },
      },
      options: {
        // Targets v2/#1078: four levels id'd by their icons — the range is the label, the line
        // beneath is the hint.
        none: { label: "0", hint: "వర్కౌట్‌లు లేవు" },
        few: { label: "1–2", hint: "అప్పుడప్పుడు వర్కౌట్‌లు" },
        some: { label: "3–4", hint: "వారానికి కొన్ని వర్కౌట్‌లు" },
        many: { label: "5+", hint: "అంకితభావం గల అథ్లెట్" },
      },
    },
    {
      id: "target",
      asks: {
        target_weight_kg: {
          lines: ["మీరు ఏ బరువును లక్ష్యంగా పెట్టుకున్నారు?"],
          placeholder: "లక్ష్య బరువు kgలో",
        },
      },
    },
    {
      id: "pace",
      asks: {
        pace: { lines: ["ఎంత వేగంగా?"] },
      },
      options: {
        easy: { label: "తేలికైన" },
        steady: { label: "స్థిరమైన" },
        push: { label: "చురుకైన" },
      },
    },
    {
      id: "counted",
      asks: { counted_before: { lines: ["ఇంతకు ముందు కేలరీలు లెక్కించారా?"] } },
      options: {
        never: { label: "ఎప్పుడూ లేదు" },
        stopped: { label: "ప్రయత్నించాను, ఆపేశాను" },
        onoff: { label: "అప్పుడప్పుడు" },
        now: { label: "ఇప్పుడు లెక్కిస్తున్నాను" },
      },
    },
    {
      id: "barrier",
      asks: {
        barriers: {
          lines: ["ఏది మిమ్మల్ని ఆపింది?", "సరిపోయినవన్నీ ఎంచుకోండి"],
          variants: {
            onoff: ["ఏది అడ్డం వచ్చింది?", "సరిపోయినవన్నీ ఎంచుకోండి"],
            now: ["ఏది సులభంగా ఉండాలనుకుంటున్నారు?", "సరిపోయినవన్నీ ఎంచుకోండి"],
          },
        },
      },
      options: {
        too_long: { label: "చాలా సమయం పట్టేది" },
        forgot: { label: "మర్చిపోయేదాన్ని" },
        invisible: { label: "ఫలితం కనిపించేది కాదు" },
        no_idea: { label: "ఏమి తినాలో తెలియేది కాదు" },
        stressful: { label: "ఒత్తిడిగా అనిపించేది" },
        nobody: { label: "అడిగేందుకు ఎవరూ లేరు" },
        creeping: { label: "నా బరువు మళ్లీ పెరుగుతూనే ఉండేది" },
        not_enough: { label: "సరిపోనంత తినడం కష్టం" },
      },
    },
    {
      id: "situation",
      asks: {
        situations: {
          lines: ["ఎప్పుడు నమోదు చేయడం కష్టమవుతుంది?"],
          variants: { never: ["ఎప్పుడు నమోదు చేయడం కష్టమవుతుందని అనుకుంటున్నారు?"] },
        },
      },
      options: {
        workdays: { label: "బిజీగా ఉండే పని దినాలు" },
        eating_out: { label: "బయట తినడం" },
        cooking: { label: "ఇతరుల కోసం వంట చేయడం" },
        snacks: { label: "స్నాక్స్ మరియు పానీయాలు" },
        evenings: { label: "సాయంత్రాలు మరియు వారాంతాలు" },
      },
    },
    {
      id: "diet",
      asks: {
        diet: { lines: ["మీరు ఏదైనా డైట్ పాటిస్తారా?"] },
      },
      options: {
        balanced: { label: "సమతుల్య" },
        wholefood: { label: "సంపూర్ణ ఆహారం" },
        mediterranean: { label: "మెడిటరేనియన్" },
        flexitarian: { label: "ఫ్లెక్సిటేరియన్" },
        pescatarian: { label: "పెస్కటేరియన్" },
        vegetarian: { label: "శాకాహారం" },
        vegan: { label: "వీగన్" },
      },
    },
    {
      id: "medical",
      asks: {
        medical: { lines: ["ఏవైనా వైద్యపరమైన పరిమితులు?"] },
      },
      options: {
        kidneys: { label: "కిడ్నీ సమస్య" },
        ldl: { label: "అధిక కొలెస్ట్రాల్" },
        lowsugar: { label: "డయాబెటిస్ ప్రమాదం" },
        none: { label: "వీటిలో ఏదీ కాదు" },
      },
    },
    {
      id: "country",
      asks: {
        country: { lines: ["మీరు ఎక్కడ తింటారు?"], placeholder: "వెతకండి" },
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
        other: { label: "మరెక్కడైనా" },
      },
    },
    {
      id: "streak",
      asks: {
        streak_goal_days: { lines: ["లక్ష్యంగా ఒక స్ట్రీక్‌ను ఎంచుకోండి"] },
      },
      options: {
        "7": { label: "7 రోజులు" },
        "14": { label: "14 రోజులు" },
        "30": { label: "30 రోజులు" },
        "50": { label: "50 రోజులు" },
      },
    },
  ],
  building: {
    lines: ["మీ వ్యక్తిగత ప్లాన్ రూపొందుతోంది"],
    title: "మీ రోజువారీ ప్లాన్",
    rows: { calories: "కేలరీలు", protein: "ప్రోటీన్", carbs: "కార్బ్స్", fat: "కొవ్వు", diet: "డైట్" },
    limitCap: { ldl: "సంతృప్త కొవ్వు ≤ {n} g", kidneys: "సోడియం ≤ {n} mg" },
    cta: "ప్లాన్ చూపించండి",
    floorTitle: "{floor} kcal వద్ద ఆపాము",
    floorBody: "లెక్క ఇంకా తక్కువకు వెళ్లాలనుకుంది. వైద్య పర్యవేక్షణ లేకుండా దీని కంటే తక్కువ లక్ష్యాలను మేము పెట్టము, అందుకే మీది ఇక్కడే ఉంది. మీ డైరీలో కూడా ఇదే చెబుతుంది.",
  },
  summary: {
    lines: ["ఇదే మీ ప్లాన్"],
    kcalLabel: "రోజుకు kcal",
    floorMarker: "భద్రత కోసం పరిమితం · ఎప్పుడూ {floor} కంటే తక్కువ కాదు",
    macros: {
      protein: "ప్రోటీన్",
      carbs: "కార్బ్స్",
      fat: "కొవ్వు",
      satfat: "సంతృప్త కొవ్వు · మీరు అడిగారు",
    },
    capNote: "ఆ వేగానికి సురక్షితంగా కొనసాగించగలిగే దానికంటే పెద్ద రోజువారీ మార్పు అవసరం, అందుకే మీది సురక్షిత వెర్షన్: మీ శరీరం రోజులో ఖర్చు చేసే దానిలో {share}%.",
    // R0 of the retention plan: onboarding ends with ONE unambiguous instruction, and the thing
    // being asked for is the first photo. "Start logging" points at a diary, which is an empty list
    // and a second decision.
    cta: "మీ మొదటి భోజనాన్ని ఫోటో తీయండి",
  },
};

const TA: OnboardingContent = {
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
  // Health, and a newer one moves the target on every surface, the browser included. v11 grows
  // the country question from four options to fifteen: it offered Germany, the UK, the US and
  // "Somewhere else" while the product shipped in eight languages, so a Vietnamese, Indonesian,
  // Italian, Spanish or Russian reader had exactly one true answer and it was the sentinel. The
  // labels left this file with it — a country's name is CLDR's, not an admin's. Bumped because a
  // funnel row for a four-chip screen and one for a fifteen-chip screen are not the same screen.
  // v12 is the v5 redesign's copy (issue #42): the age question asks "How old are you?" plainly,
  // and the activity options answer in plain frequencies — "A little each week" — rather than
  // effort labels. v13 (#50) drops 'No account needed to start.': the web asks for a sign-in
  // before the first question, and one content tree cannot say it on the phone only.
  // v14 is targets v2 (#81): the activity question's five levels became three — few/some/many —
  // and the sex question gained "other". A stored v13 revision carries neither, so the validator
  // retires it and every language falls back to this.
  //
  // v15 IS ONBOARDING V2 (#82): the conversation becomes Cal AI-shaped plain screens, one question
  // each — twelve screens where seven used to be, the struggles eight became five stored picks,
  // the restrictions screen split into `diet` (seven single-choice) and `medical` (multi-select,
  // "None of these" a drawn row), and the sign-up beat lands between the plan and the country.
  // A stored v14 revision names screens and asks this shape cannot satisfy, so it falls back whole.
  // v16 (#1078): the activity question's three bands became four — 0 / 1–2 / 3–4 / 5+ — and `few`
  // moved from "0–2" to "1–2". A stored v15 labels the new `few` "0–2" and has no `none` at all,
  // so `usableContent` retires it and every language falls back to this. v17 (ieat-app#2050)
  // rewrites the welcome as a title and a subtitle — "A plan built around you" — over the photo.
  version: 19,
  welcome: {
    lines: ["புகைப்படத்துடன் கலோரிகளை எண்ணுங்கள்"],
    cta: "தொடங்கு",
    signin: "எனக்கு ஏற்கெனவே கணக்கு உள்ளது",
  },
  screens: [
    {
      id: "goal",
      asks: {
        goal: { lines: ["நீங்கள் எதற்காக இங்கே வந்தீர்கள்?"] },
      },
      options: {
        lose: { label: "எடையைக் குறை" },
        maintain: { label: "என் எடையைத் தக்கவை" },
        gain: { label: "எடையை அதிகரி" },
      },
    },
    {
      id: "sex",
      asks: {
        sex: { lines: ["உங்கள் பாலினம் என்ன?"] },
      },
      options: {
        male: { label: "ஆண்" },
        female: { label: "பெண்" },
        other: { label: "மற்றவை" },
      },
    },
    {
      id: "age",
      asks: {
        // Asked as an AGE and stored as a year — `checkNumber` in `onboarding-chat.ts` converts.
        birth_year: {
          lines: ["உங்கள் வயது?"],
          placeholder: "உங்கள் வயது",
        },
      },
    },
    {
      id: "height",
      asks: {
        height_cm: {
          lines: ["உயரம்"],
          placeholder: "உயரம் cm-இல்",
        },
      },
    },
    {
      id: "weight",
      asks: {
        weight_kg: {
          lines: ["உங்கள் எடை"],
          placeholder: "எடை kg-இல்",
        },
      },
    },
    {
      id: "activity",
      asks: {
        activity: {
          lines: ["உங்கள் நாட்கள் எவ்வளவு சுறுசுறுப்பானவை?"],
        },
      },
      options: {
        // Targets v2/#1078: four levels id'd by their icons — the range is the label, the line
        // beneath is the hint.
        none: { label: "0", hint: "உடற்பயிற்சி இல்லை" },
        few: { label: "1–2", hint: "அவ்வப்போது உடற்பயிற்சி" },
        some: { label: "3–4", hint: "வாரத்தில் சில உடற்பயிற்சிகள்" },
        many: { label: "5+", hint: "தீவிர விளையாட்டுப் பயிற்சி" },
      },
    },
    {
      id: "target",
      asks: {
        target_weight_kg: {
          lines: ["எந்த எடையை இலக்காகக் கொள்கிறீர்கள்?"],
          placeholder: "இலக்கு எடை kg-இல்",
        },
      },
    },
    {
      id: "pace",
      asks: {
        pace: { lines: ["எவ்வளவு வேகமாக?"] },
      },
      options: {
        easy: { label: "மென்மையாக" },
        steady: { label: "நிலையாக" },
        push: { label: "விரைவாக" },
      },
    },
    {
      id: "counted",
      asks: { counted_before: { lines: ["முன்பு கலோரிகளை எண்ணியிருக்கிறீர்களா?"] } },
      options: {
        never: { label: "ஒருபோதும் இல்லை" },
        stopped: { label: "முயற்சித்தேன், நிறுத்திவிட்டேன்" },
        onoff: { label: "அவ்வப்போது" },
        now: { label: "இப்போது எண்ணுகிறேன்" },
      },
    },
    {
      id: "barrier",
      asks: {
        barriers: {
          lines: ["உங்களை எது நிறுத்தியது?", "பொருந்துவனவற்றை எல்லாம் தேர்ந்தெடுங்கள்"],
          variants: {
            onoff: ["எது தடையாக இருந்தது?", "பொருந்துவனவற்றை எல்லாம் தேர்ந்தெடுங்கள்"],
            now: ["எது இன்னும் எளிதாக இருக்க வேண்டும்?", "பொருந்துவனவற்றை எல்லாம் தேர்ந்தெடுங்கள்"],
          },
        },
      },
      options: {
        too_long: { label: "அதிக நேரம் எடுத்தது" },
        forgot: { label: "மறந்துவிட்டேன்" },
        invisible: { label: "அது வேலை செய்வது தெரியவில்லை" },
        no_idea: { label: "என்ன சாப்பிடுவதென்று தெரியவில்லை" },
        stressful: { label: "மன அழுத்தமாக இருந்தது" },
        nobody: { label: "கேட்பதற்கு யாருமில்லை" },
        creeping: { label: "என் எடை மீண்டும் ஏறிக்கொண்டே இருந்தது" },
        not_enough: { label: "போதுமான அளவு சாப்பிடுவது கடினம்" },
      },
    },
    {
      id: "situation",
      asks: {
        situations: {
          lines: ["எப்போது பதிவு செய்வது கடினம்?"],
          variants: { never: ["எப்போது பதிவு செய்வது கடினமாக இருக்கும் என்று எதிர்பார்க்கிறீர்கள்?"] },
        },
      },
      options: {
        workdays: { label: "பிசியான வேலை நாட்கள்" },
        eating_out: { label: "வெளியில் சாப்பிடுவது" },
        cooking: { label: "மற்றவர்களுக்கு சமைப்பது" },
        snacks: { label: "சிற்றுண்டிகளும் பானங்களும்" },
        evenings: { label: "மாலைகளும் வார இறுதிகளும்" },
      },
    },
    {
      id: "diet",
      asks: {
        diet: { lines: ["ஏதாவது உணவுமுறையைப் பின்பற்றுகிறீர்களா?"] },
      },
      options: {
        balanced: { label: "சமச்சீர்" },
        wholefood: { label: "முழு உணவுகள்" },
        mediterranean: { label: "மத்தியதரைக்கடல்" },
        flexitarian: { label: "ஃப்ளெக்ஸிடேரியன்" },
        pescatarian: { label: "பெஸ்கடேரியன்" },
        vegetarian: { label: "சைவம்" },
        vegan: { label: "வீகன்" },
      },
    },
    {
      id: "medical",
      asks: {
        medical: { lines: ["ஏதாவது மருத்துவக் கட்டுப்பாடுகள்?"] },
      },
      options: {
        kidneys: { label: "சிறுநீரகப் பிரச்சினை" },
        ldl: { label: "அதிக கொலஸ்ட்ரால்" },
        lowsugar: { label: "நீரிழிவு அபாயம்" },
        none: { label: "இவற்றில் எதுவும் இல்லை" },
      },
    },
    {
      id: "country",
      asks: {
        country: { lines: ["நீங்கள் எங்கே சாப்பிடுகிறீர்கள்?"], placeholder: "தேடு" },
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
        other: { label: "வேறு எங்காவது" },
      },
    },
    {
      id: "streak",
      asks: {
        streak_goal_days: { lines: ["இலக்காக ஒரு ஸ்ட்ரீக்கைத் தேர்ந்தெடுங்கள்"] },
      },
      options: {
        "7": { label: "7 நாட்கள்" },
        "14": { label: "14 நாட்கள்" },
        "30": { label: "30 நாட்கள்" },
        "50": { label: "50 நாட்கள்" },
      },
    },
  ],
  building: {
    lines: ["உங்கள் தனிப்பட்ட திட்டம் உருவாகிறது"],
    title: "உங்கள் தினசரித் திட்டம்",
    rows: { calories: "கலோரிகள்", protein: "புரதம்", carbs: "கார்ப்ஸ்", fat: "கொழுப்பு", diet: "உணவுமுறை" },
    limitCap: { ldl: "நிறைவுற்ற கொழுப்பு ≤ {n} g", kidneys: "சோடியம் ≤ {n} mg" },
    cta: "திட்டத்தைக் காட்டு",
    floorTitle: "{floor} kcal-இல் நிறுத்தினோம்",
    floorBody: "கணக்கு இதைவிடக் குறைவாகச் செல்ல விரும்பியது. மருத்துவக் கண்காணிப்பு இல்லாமல் இதற்குக் கீழ் இலக்குகளை அமைப்பதில்லை, எனவே உங்களுடையது இங்கே உள்ளது. உங்கள் நாட்குறிப்பிலும் இது குறிப்பிடப்படும்.",
  },
  summary: {
    lines: ["இதோ உங்கள் திட்டம்"],
    kcalLabel: "ஒரு நாளைக்கு kcal",
    floorMarker: "பாதுகாப்புக்காக வரம்பு · எப்போதும் குறைந்தது {floor}",
    macros: {
      protein: "புரதம்",
      carbs: "கார்ப்ஸ்",
      fat: "கொழுப்பு",
      satfat: "நிறைவுற்ற கொழுப்பு · நீங்கள் கேட்டது",
    },
    capNote: "அந்த வேகத்திற்குத் தொடர்ந்து பாதுகாப்பாகத் தக்கவைக்க முடியாத அளவு பெரிய தினசரி மாற்றம் தேவை, எனவே உங்களுடையது பாதுகாப்பான பதிப்பு: உங்கள் உடல் ஒரு நாளில் எரிப்பதில் {share}%.",
    // R0 of the retention plan: onboarding ends with ONE unambiguous instruction, and the thing
    // being asked for is the first photo. "Start logging" points at a diary, which is an empty list
    // and a second decision.
    cta: "உங்கள் முதல் உணவைப் புகைப்படம் எடுங்கள்",
  },
};

const PA: OnboardingContent = {
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
  // Health, and a newer one moves the target on every surface, the browser included. v11 grows
  // the country question from four options to fifteen: it offered Germany, the UK, the US and
  // "Somewhere else" while the product shipped in eight languages, so a Vietnamese, Indonesian,
  // Italian, Spanish or Russian reader had exactly one true answer and it was the sentinel. The
  // labels left this file with it — a country's name is CLDR's, not an admin's. Bumped because a
  // funnel row for a four-chip screen and one for a fifteen-chip screen are not the same screen.
  // v12 is the v5 redesign's copy (issue #42): the age question asks "How old are you?" plainly,
  // and the activity options answer in plain frequencies — "A little each week" — rather than
  // effort labels. v13 (#50) drops 'No account needed to start.': the web asks for a sign-in
  // before the first question, and one content tree cannot say it on the phone only.
  // v14 is targets v2 (#81): the activity question's five levels became three — few/some/many —
  // and the sex question gained "other". A stored v13 revision carries neither, so the validator
  // retires it and every language falls back to this.
  //
  // v15 IS ONBOARDING V2 (#82): the conversation becomes Cal AI-shaped plain screens, one question
  // each — twelve screens where seven used to be, the struggles eight became five stored picks,
  // the restrictions screen split into `diet` (seven single-choice) and `medical` (multi-select,
  // "None of these" a drawn row), and the sign-up beat lands between the plan and the country.
  // A stored v14 revision names screens and asks this shape cannot satisfy, so it falls back whole.
  // v16 (#1078): the activity question's three bands became four — 0 / 1–2 / 3–4 / 5+ — and `few`
  // moved from "0–2" to "1–2". A stored v15 labels the new `few` "0–2" and has no `none` at all,
  // so `usableContent` retires it and every language falls back to this. v17 (ieat-app#2050)
  // rewrites the welcome as a title and a subtitle — "A plan built around you" — over the photo.
  version: 19,
  welcome: {
    lines: ["ਫੋਟੋ ਨਾਲ ਕੈਲੋਰੀ ਗਿਣੋ"],
    cta: "ਸ਼ੁਰੂ ਕਰੋ",
    signin: "ਮੇਰਾ ਅਕਾਊਂਟ ਪਹਿਲਾਂ ਤੋਂ ਹੈ",
  },
  screens: [
    {
      id: "goal",
      asks: {
        goal: { lines: ["ਤੁਸੀਂ ਇੱਥੇ ਕਿਸ ਲਈ ਹੋ?"] },
      },
      options: {
        lose: { label: "ਭਾਰ ਘਟਾਓ" },
        maintain: { label: "ਭਾਰ ਬਣਾਈ ਰੱਖੋ" },
        gain: { label: "ਭਾਰ ਵਧਾਓ" },
      },
    },
    {
      id: "sex",
      asks: {
        sex: { lines: ["ਤੁਹਾਡਾ ਲਿੰਗ ਕੀ ਹੈ?"] },
      },
      options: {
        male: { label: "ਮਰਦ" },
        female: { label: "ਔਰਤ" },
        other: { label: "ਹੋਰ" },
      },
    },
    {
      id: "age",
      asks: {
        // Asked as an AGE and stored as a year — `checkNumber` in `onboarding-chat.ts` converts.
        birth_year: {
          lines: ["ਤੁਹਾਡੀ ਉਮਰ?"],
          placeholder: "ਤੁਹਾਡੀ ਉਮਰ",
        },
      },
    },
    {
      id: "height",
      asks: {
        height_cm: {
          lines: ["ਕੱਦ"],
          placeholder: "ਕੱਦ cm ਵਿੱਚ",
        },
      },
    },
    {
      id: "weight",
      asks: {
        weight_kg: {
          lines: ["ਤੁਹਾਡਾ ਵਜ਼ਨ"],
          placeholder: "ਭਾਰ kg ਵਿੱਚ",
        },
      },
    },
    {
      id: "activity",
      asks: {
        activity: {
          lines: ["ਤੁਹਾਡੇ ਦਿਨ ਕਿੰਨੇ ਸਰਗਰਮ ਰਹਿੰਦੇ ਹਨ?"],
        },
      },
      options: {
        // Targets v2/#1078: four levels id'd by their icons — the range is the label, the line
        // beneath is the hint.
        none: { label: "0", hint: "ਕੋਈ ਵਰਕਆਊਟ ਨਹੀਂ" },
        few: { label: "1–2", hint: "ਕਦੇ-ਕਦਾਈਂ ਵਰਕਆਊਟ" },
        some: { label: "3–4", hint: "ਹਫ਼ਤੇ ਵਿੱਚ ਕੁਝ ਵਰਕਆਊਟ" },
        many: { label: "5+", hint: "ਐਥਲੀਟ ਵਰਗੀ ਰੁਟੀਨ" },
      },
    },
    {
      id: "target",
      asks: {
        target_weight_kg: {
          lines: ["ਤੁਹਾਡਾ ਟੀਚਾ ਭਾਰ ਕੀ ਹੈ?"],
          placeholder: "ਟੀਚਾ ਭਾਰ kg ਵਿੱਚ",
        },
      },
    },
    {
      id: "pace",
      asks: {
        pace: { lines: ["ਕਿੰਨੀ ਤੇਜ਼ੀ ਨਾਲ?"] },
      },
      options: {
        easy: { label: "ਹਲਕੀ" },
        steady: { label: "ਸਥਿਰ" },
        push: { label: "ਤੇਜ਼" },
      },
    },
    {
      id: "counted",
      asks: { counted_before: { lines: ["ਕੀ ਤੁਸੀਂ ਪਹਿਲਾਂ ਕਦੇ ਕੈਲੋਰੀ ਗਿਣੀਆਂ ਹਨ?"] } },
      options: {
        never: { label: "ਕਦੇ ਨਹੀਂ" },
        stopped: { label: "ਕੋਸ਼ਿਸ਼ ਕੀਤੀ, ਛੱਡ ਦਿੱਤੀ" },
        onoff: { label: "ਕਦੇ ਕਦੇ" },
        now: { label: "ਗਿਣਤੀ ਹੁਣ ਵੀ ਚੱਲ ਰਹੀ ਹੈ" },
      },
    },
    {
      id: "barrier",
      asks: {
        barriers: {
          lines: ["ਕਿਸ ਚੀਜ਼ ਨੇ ਤੁਹਾਨੂੰ ਰੋਕਿਆ?", "ਲਾਗੂ ਹੋਣ ਵਾਲੇ ਸਾਰੇ ਚੁਣੋ"],
          variants: {
            onoff: ["ਕੀ ਰੁਕਾਵਟ ਬਣਿਆ?", "ਲਾਗੂ ਹੋਣ ਵਾਲੇ ਸਾਰੇ ਚੁਣੋ"],
            now: ["ਕੀ ਹੋਰ ਆਸਾਨ ਹੋਵੇ?", "ਲਾਗੂ ਹੋਣ ਵਾਲੇ ਸਾਰੇ ਚੁਣੋ"],
          },
        },
      },
      options: {
        too_long: { label: "ਬਹੁਤ ਸਮਾਂ ਲੱਗਦਾ ਸੀ" },
        forgot: { label: "ਭੁੱਲ ਜਾਣਾ ਆਮ ਸੀ" },
        invisible: { label: "ਕੰਮ ਕਰਦਾ ਨਜ਼ਰ ਨਹੀਂ ਆਉਂਦਾ ਸੀ" },
        no_idea: { label: "ਕੀ ਖਾਣਾ, ਪਤਾ ਨਹੀਂ ਸੀ" },
        stressful: { label: "ਤਣਾਅ ਜਿਹਾ ਲੱਗਦਾ ਸੀ" },
        nobody: { label: "ਪੁੱਛਣ ਲਈ ਕੋਈ ਨਹੀਂ ਸੀ" },
        creeping: { label: "ਮੇਰਾ ਵਜ਼ਨ ਮੁੜ ਵੱਧਣ ਲੱਗਦਾ ਸੀ" },
        not_enough: { label: "ਕਾਫ਼ੀ ਖਾਣਾ ਮੁਸ਼ਕਿਲ ਸੀ" },
      },
    },
    {
      id: "situation",
      asks: {
        situations: {
          lines: ["ਦਰਜ ਕਰਨਾ ਕਦੋਂ ਸਭ ਤੋਂ ਔਖਾ ਹੈ?"],
          variants: { never: ["ਕਦੋਂ ਦਰਜ ਕਰਨਾ ਸਭ ਤੋਂ ਔਖਾ ਹੋਵੇਗਾ?"] },
        },
      },
      options: {
        workdays: { label: "ਰੁੱਝੇ ਕੰਮ ਵਾਲੇ ਦਿਨ" },
        eating_out: { label: "ਬਾਹਰ ਖਾਣਾ" },
        cooking: { label: "ਦੂਜਿਆਂ ਲਈ ਖਾਣਾ ਬਣਾਉਣਾ" },
        snacks: { label: "ਨਾਸ਼ਤੇ ਤੇ ਪੇਅ" },
        evenings: { label: "ਸ਼ਾਮਾਂ ਅਤੇ ਵੀਕੈਂਡ" },
      },
    },
    {
      id: "diet",
      asks: {
        diet: { lines: ["ਤੁਹਾਡੀ ਡਾਇਟ ਕਿਹੋ ਜਿਹੀ ਹੈ?"] },
      },
      options: {
        balanced: { label: "ਸੰਤੁਲਿਤ" },
        wholefood: { label: "ਸਾਬਤ ਭੋਜਨ" },
        mediterranean: { label: "ਮੈਡੀਟੇਰੇਨੀਅਨ" },
        flexitarian: { label: "ਫ਼ਲੈਕਸੀਟੇਰੀਅਨ" },
        pescatarian: { label: "ਪੈਸਕੇਟੇਰੀਅਨ" },
        vegetarian: { label: "ਸ਼ਾਕਾਹਾਰੀ" },
        vegan: { label: "ਵੀਗਨ" },
      },
    },
    {
      id: "medical",
      asks: {
        medical: { lines: ["ਕੋਈ ਮੈਡੀਕਲ ਪਾਬੰਦੀ?"] },
      },
      options: {
        kidneys: { label: "ਗੁਰਦੇ ਦੀ ਬਿਮਾਰੀ" },
        ldl: { label: "ਹਾਈ ਕੋਲੈਸਟ੍ਰੋਲ" },
        lowsugar: { label: "ਡਾਇਬਟੀਜ਼ ਦਾ ਜੋਖਮ" },
        none: { label: "ਇਨ੍ਹਾਂ ਵਿੱਚੋਂ ਕੋਈ ਨਹੀਂ" },
      },
    },
    {
      id: "country",
      asks: {
        country: { lines: ["ਤੁਸੀਂ ਕਿੱਥੇ ਖਾਂਦੇ ਹੋ?"], placeholder: "ਖੋਜੋ" },
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
        other: { label: "ਕਿਤੇ ਹੋਰ" },
      },
    },
    {
      id: "streak",
      asks: {
        streak_goal_days: { lines: ["ਕਿੰਨੀ ਲੰਬੀ ਸਟ੍ਰੀਕ ਦਾ ਟੀਚਾ ਰੱਖੀਏ?"] },
      },
      options: {
        "7": { label: "7 ਦਿਨ" },
        "14": { label: "14 ਦਿਨ" },
        "30": { label: "30 ਦਿਨ" },
        "50": { label: "50 ਦਿਨ" },
      },
    },
  ],
  building: {
    lines: ["ਤੁਹਾਡਾ ਨਿੱਜੀ ਪਲਾਨ ਬਣ ਰਿਹਾ ਹੈ"],
    title: "ਤੁਹਾਡਾ ਰੋਜ਼ਾਨਾ ਪਲਾਨ",
    rows: { calories: "ਕੈਲੋਰੀ", protein: "ਪ੍ਰੋਟੀਨ", carbs: "ਕਾਰਬਸ", fat: "ਫ਼ੈਟ", diet: "ਡਾਇਟ" },
    limitCap: { ldl: "ਸੈਚੁਰੇਟਿਡ ਫ਼ੈਟ ≤ {n} g", kidneys: "ਸੋਡੀਅਮ ≤ {n} mg" },
    cta: "ਮੈਨੂੰ ਪਲਾਨ ਦਿਖਾਓ",
    floorTitle: "{floor} kcal 'ਤੇ ਰੋਕ ਦਿੱਤਾ ਗਿਆ",
    floorBody: "ਹਿਸਾਬ ਇਸ ਤੋਂ ਹੇਠਾਂ ਜਾਣਾ ਚਾਹੁੰਦਾ ਸੀ। ਡਾਕਟਰ ਦੀ ਨਿਗਰਾਨੀ ਤੋਂ ਬਿਨਾਂ ਅਸੀਂ ਇਸ ਤੋਂ ਘੱਟ ਟੀਚੇ ਨਹੀਂ ਰੱਖਦੇ, ਇਸ ਲਈ ਤੁਹਾਡਾ ਟੀਚਾ ਇੱਥੇ ਹੀ ਹੈ। ਤੁਹਾਡੀ ਡਾਇਰੀ ਵਿੱਚ ਵੀ ਇਹੀ ਲਿਖਿਆ ਹੋਵੇਗਾ।",
  },
  summary: {
    lines: ["ਇਹ ਰਿਹਾ ਤੁਹਾਡਾ ਪਲਾਨ"],
    kcalLabel: "kcal ਪ੍ਰਤੀ ਦਿਨ",
    floorMarker: "ਸੁਰੱਖਿਆ ਲਈ ਸੀਮਤ · {floor} ਤੋਂ ਕਦੇ ਘੱਟ ਨਹੀਂ",
    macros: {
      protein: "ਪ੍ਰੋਟੀਨ",
      carbs: "ਕਾਰਬਸ",
      fat: "ਫ਼ੈਟ",
      satfat: "ਸੈਚੁਰੇਟਿਡ ਫ਼ੈਟ · ਤੁਹਾਡੇ ਕਹਿਣ 'ਤੇ",
    },
    capNote: "ਉਸ ਰਫ਼ਤਾਰ ਲਈ ਰੋਜ਼ ਇੰਨਾ ਵੱਡਾ ਬਦਲਾਅ ਚਾਹੀਦਾ ਹੈ ਜਿੰਨਾ ਸੁਰੱਖਿਅਤ ਢੰਗ ਨਾਲ ਲੰਬੇ ਸਮੇਂ ਤੱਕ ਨਹੀਂ ਚੱਲ ਸਕਦਾ, ਇਸ ਲਈ ਤੁਹਾਡਾ ਪਲਾਨ ਸੁਰੱਖਿਅਤ ਵਾਲਾ ਹੈ: ਤੁਹਾਡਾ ਸਰੀਰ ਇੱਕ ਦਿਨ ਵਿੱਚ ਜਿੰਨਾ ਖ਼ਰਚ ਕਰਦਾ ਹੈ, ਉਸ ਦਾ {share}%।",
    // R0 of the retention plan: onboarding ends with ONE unambiguous instruction, and the thing
    // being asked for is the first photo. "Start logging" points at a diary, which is an empty list
    // and a second decision.
    cta: "ਆਪਣੇ ਪਹਿਲੇ ਖਾਣੇ ਦੀ ਫ਼ੋਟੋ ਲਓ",
  },
};

const OR: OnboardingContent = {
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
  // Health, and a newer one moves the target on every surface, the browser included. v11 grows
  // the country question from four options to fifteen: it offered Germany, the UK, the US and
  // "Somewhere else" while the product shipped in eight languages, so a Vietnamese, Indonesian,
  // Italian, Spanish or Russian reader had exactly one true answer and it was the sentinel. The
  // labels left this file with it — a country's name is CLDR's, not an admin's. Bumped because a
  // funnel row for a four-chip screen and one for a fifteen-chip screen are not the same screen.
  // v12 is the v5 redesign's copy (issue #42): the age question asks "How old are you?" plainly,
  // and the activity options answer in plain frequencies — "A little each week" — rather than
  // effort labels. v13 (#50) drops 'No account needed to start.': the web asks for a sign-in
  // before the first question, and one content tree cannot say it on the phone only.
  // v14 is targets v2 (#81): the activity question's five levels became three — few/some/many —
  // and the sex question gained "other". A stored v13 revision carries neither, so the validator
  // retires it and every language falls back to this.
  //
  // v15 IS ONBOARDING V2 (#82): the conversation becomes Cal AI-shaped plain screens, one question
  // each — twelve screens where seven used to be, the struggles eight became five stored picks,
  // the restrictions screen split into `diet` (seven single-choice) and `medical` (multi-select,
  // "None of these" a drawn row), and the sign-up beat lands between the plan and the country.
  // A stored v14 revision names screens and asks this shape cannot satisfy, so it falls back whole.
  // v16 (#1078): the activity question's three bands became four — 0 / 1–2 / 3–4 / 5+ — and `few`
  // moved from "0–2" to "1–2". A stored v15 labels the new `few` "0–2" and has no `none` at all,
  // so `usableContent` retires it and every language falls back to this. v17 (ieat-app#2050)
  // rewrites the welcome as a title and a subtitle — "A plan built around you" — over the photo.
  version: 19,
  welcome: {
    lines: ["ଫଟୋରେ କ୍ୟାଲୋରୀ ଗଣନ୍ତୁ"],
    cta: "ଆରମ୍ଭ କରନ୍ତୁ",
    signin: "ମୋର ପୂର୍ବରୁ ଆକାଉଣ୍ଟ ଅଛି",
  },
  screens: [
    {
      id: "goal",
      asks: {
        goal: { lines: ["ଆପଣ ଏଠାରେ କ'ଣ କରିବାକୁ ଚାହାଁନ୍ତି?"] },
      },
      options: {
        lose: { label: "ଓଜନ କମାଇବା" },
        maintain: { label: "ମୋ ଓଜନ ବଜାୟ ରଖିବା" },
        gain: { label: "ଓଜନ ବଢ଼ାଇବା" },
      },
    },
    {
      id: "sex",
      asks: {
        sex: { lines: ["ଆପଣଙ୍କ ଲିଙ୍ଗ କ'ଣ?"] },
      },
      options: {
        male: { label: "ପୁରୁଷ" },
        female: { label: "ମହିଳା" },
        other: { label: "ଅନ୍ୟ" },
      },
    },
    {
      id: "age",
      asks: {
        // Asked as an AGE and stored as a year — `checkNumber` in `onboarding-chat.ts` converts.
        birth_year: {
          lines: ["ଆପଣଙ୍କ ବୟସ?"],
          placeholder: "ଆପଣଙ୍କ ବୟସ",
        },
      },
    },
    {
      id: "height",
      asks: {
        height_cm: {
          lines: ["ଉଚ୍ଚତା"],
          placeholder: "cm ରେ ଉଚ୍ଚତା",
        },
      },
    },
    {
      id: "weight",
      asks: {
        weight_kg: {
          lines: ["ଆପଣଙ୍କ ଓଜନ"],
          placeholder: "kg ରେ ଓଜନ",
        },
      },
    },
    {
      id: "activity",
      asks: {
        activity: {
          lines: ["ଆପଣଙ୍କ ଦିନ କେତେ ସକ୍ରିୟ?"],
        },
      },
      options: {
        // Targets v2/#1078: four levels id'd by their icons — the range is the label, the line
        // beneath is the hint.
        none: { label: "0", hint: "କୌଣସି ୱର୍କଆଉଟ୍ ନାହିଁ" },
        few: { label: "1–2", hint: "ବେଳେବେଳେ ୱର୍କଆଉଟ୍" },
        some: { label: "3–4", hint: "ସପ୍ତାହକୁ କିଛି ୱର୍କଆଉଟ୍" },
        many: { label: "5+", hint: "ନିୟମିତ ଆଥଲିଟ୍" },
      },
    },
    {
      id: "target",
      asks: {
        target_weight_kg: {
          lines: ["ଆପଣ କେଉଁ ଓଜନକୁ ଲକ୍ଷ୍ୟ କରୁଛନ୍ତି?"],
          placeholder: "kg ରେ ଲକ୍ଷ୍ୟ ଓଜନ",
        },
      },
    },
    {
      id: "pace",
      asks: {
        pace: { lines: ["କେତେ ଦ୍ରୁତ?"] },
      },
      options: {
        easy: { label: "ଧୀରେ" },
        steady: { label: "ସ୍ଥିର" },
        push: { label: "ଦ୍ରୁତ" },
      },
    },
    {
      id: "counted",
      asks: { counted_before: { lines: ["ପୂର୍ବରୁ କ୍ୟାଲୋରୀ ଗଣିଛନ୍ତି କି?"] } },
      options: {
        never: { label: "କେବେ ନାହିଁ" },
        stopped: { label: "ଚେଷ୍ଟା କରିଥିଲି, ଛାଡ଼ିଥିଲି" },
        onoff: { label: "ବେଳେବେଳେ" },
        now: { label: "ବର୍ତ୍ତମାନ ଗଣୁଛି" },
      },
    },
    {
      id: "barrier",
      asks: {
        barriers: {
          lines: ["କ'ଣ ଆପଣଙ୍କୁ ଅଟକାଇଥିଲା?", "ଯାହା ମେଳ ଖାଏ ସବୁ ବାଛନ୍ତୁ"],
          variants: {
            onoff: ["କ'ଣ ବାଧା ସୃଷ୍ଟି କରିଥିଲା?", "ଯାହା ମେଳ ଖାଏ ସବୁ ବାଛନ୍ତୁ"],
            now: ["କ'ଣ ସହଜ ହେଲେ ଭଲ ହୋଇଥାନ୍ତା?", "ଯାହା ମେଳ ଖାଏ ସବୁ ବାଛନ୍ତୁ"],
          },
        },
      },
      options: {
        too_long: { label: "ବହୁତ ସମୟ ନେଉଥିଲା" },
        forgot: { label: "ଭୁଲି ଯାଉଥିଲି" },
        invisible: { label: "ଫଳାଫଳ ଦେଖାଯାଉ ନଥିଲା" },
        no_idea: { label: "କ'ଣ ଖାଇବି ଜଣା ନଥିଲା" },
        stressful: { label: "ଚାପଯୁକ୍ତ ଲାଗୁଥିଲା" },
        nobody: { label: "ପଚାରିବାକୁ କେହି ନଥିଲେ" },
        creeping: { label: "ମୋ ଓଜନ ପୁଣି ବଢ଼ି ଚାଲିଥିଲା" },
        not_enough: { label: "ଯଥେଷ୍ଟ ଖାଇବା କଷ୍ଟ ଥିଲା" },
      },
    },
    {
      id: "situation",
      asks: {
        situations: {
          lines: ["କେବେ ଲିଖିବା ସବୁଠାରୁ କଷ୍ଟ ହୁଏ?"],
          variants: { never: ["କେବେ ଲିଖିବା ସବୁଠାରୁ କଷ୍ଟ ହେବ ବୋଲି ଭାବୁଛନ୍ତି?"] },
        },
      },
      options: {
        workdays: { label: "ବ୍ୟସ୍ତ କାର୍ଯ୍ୟଦିବସ" },
        eating_out: { label: "ବାହାରେ ଖାଇବା" },
        cooking: { label: "ଅନ୍ୟମାନଙ୍କ ପାଇଁ ରାନ୍ଧିବା" },
        snacks: { label: "ଜଳଖିଆ ଓ ପାନୀୟ" },
        evenings: { label: "ସନ୍ଧ୍ୟା ଓ ସପ୍ତାହାନ୍ତ" },
      },
    },
    {
      id: "diet",
      asks: {
        diet: { lines: ["ଆପଣ କୌଣସି ଡାଏଟ୍ ମାନନ୍ତି କି?"] },
      },
      options: {
        balanced: { label: "ସନ୍ତୁଳିତ" },
        wholefood: { label: "ହୋଲ୍-ଫୁଡ୍" },
        mediterranean: { label: "ମେଡିଟେରାନିଆନ୍" },
        flexitarian: { label: "ଫ୍ଲେକ୍ସିଟେରିଆନ୍" },
        pescatarian: { label: "ପେସ୍କାଟେରିଆନ୍" },
        vegetarian: { label: "ଶାକାହାରୀ" },
        vegan: { label: "ଭିଗାନ୍" },
      },
    },
    {
      id: "medical",
      asks: {
        medical: { lines: ["କୌଣସି ଚିକିତ୍ସା ସମ୍ବନ୍ଧୀୟ ସୀମା?"] },
      },
      options: {
        kidneys: { label: "କିଡନୀ ସମସ୍ୟା" },
        ldl: { label: "ଅଧିକ କୋଲେଷ୍ଟେରଲ୍" },
        lowsugar: { label: "ମଧୁମେହ ଆଶଙ୍କା" },
        none: { label: "ଏଥିରୁ କୌଣସିଟି ନୁହେଁ" },
      },
    },
    {
      id: "country",
      asks: {
        country: { lines: ["ଆପଣ କେଉଁଠାରେ ଖାଆନ୍ତି?"], placeholder: "ଖୋଜନ୍ତୁ" },
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
        other: { label: "ଅନ୍ୟ କେଉଁଠି" },
      },
    },
    {
      id: "streak",
      asks: {
        streak_goal_days: { lines: ["ଲକ୍ଷ୍ୟ ପାଇଁ ଏକ ଷ୍ଟ୍ରିକ୍ ବାଛନ୍ତୁ"] },
      },
      options: {
        "7": { label: "7 ଦିନ" },
        "14": { label: "14 ଦିନ" },
        "30": { label: "30 ଦିନ" },
        "50": { label: "50 ଦିନ" },
      },
    },
  ],
  building: {
    lines: ["ଆପଣଙ୍କ ବ୍ୟକ୍ତିଗତ ପ୍ଲାନ୍ ତିଆରି ହେଉଛି"],
    title: "ଆପଣଙ୍କ ଦୈନିକ ପ୍ଲାନ୍",
    rows: { calories: "କ୍ୟାଲୋରୀ", protein: "ପ୍ରୋଟିନ୍", carbs: "କାର୍ବସ୍", fat: "ଫ୍ୟାଟ୍", diet: "ଡାଏଟ୍" },
    limitCap: { ldl: "ସାଚୁରେଟେଡ୍ ଫ୍ୟାଟ୍ ≤ {n} g", kidneys: "ସୋଡିୟମ୍ ≤ {n} mg" },
    cta: "ମୋତେ ପ୍ଲାନ୍ ଦେଖାନ୍ତୁ",
    floorTitle: "ଆମେ {floor} kcal ରେ ରହିଗଲୁ",
    floorBody: "ହିସାବ ଆହୁରି କମ୍ ଯିବାକୁ ଚାହୁଁଥିଲା। ଚିକିତ୍ସକଙ୍କ ତତ୍ତ୍ୱାବଧାନ ବିନା ଆମେ ଏହାଠାରୁ କମ୍ ଲକ୍ଷ୍ୟ ସେଟ୍ କରୁନାହୁଁ, ତେଣୁ ଆପଣଙ୍କର ଏଠାରେ ରହିଲା। ଆପଣଙ୍କ ଡାଏରୀରେ ମଧ୍ୟ ଏହା ଲେଖାଥିବ।",
  },
  summary: {
    lines: ["ଏହା ଆପଣଙ୍କ ପ୍ଲାନ୍"],
    kcalLabel: "kcal ପ୍ରତିଦିନ",
    floorMarker: "ସୁରକ୍ଷା ପାଇଁ ସୀମିତ · {floor} ରୁ କେବେ କମ୍ ନୁହେଁ",
    macros: {
      protein: "ପ୍ରୋଟିନ୍",
      carbs: "କାର୍ବସ୍",
      fat: "ଫ୍ୟାଟ୍",
      satfat: "ସାଚୁରେଟେଡ୍ ଫ୍ୟାଟ୍ · ଆପଣଙ୍କ ଅନୁରୋଧରେ",
    },
    capNote: "ସେହି ଗତି ପାଇଁ ଦୈନିକ ଏତେ ବଡ଼ ପରିବର୍ତ୍ତନ ଦରକାର ଯାହା ସୁରକ୍ଷିତ ଭାବେ ବଜାୟ ରଖିହେବ ନାହିଁ, ତେଣୁ ଆପଣଙ୍କର ସୁରକ୍ଷିତ ସଂସ୍କରଣ: ଆପଣଙ୍କ ଶରୀର ଦିନକରେ ଯାହା ଖର୍ଚ୍ଚ କରେ ତାର {share}%।",
    // R0 of the retention plan: onboarding ends with ONE unambiguous instruction, and the thing
    // being asked for is the first photo. "Start logging" points at a diary, which is an empty list
    // and a second decision.
    cta: "ଆପଣଙ୍କ ପ୍ରଥମ ଭୋଜନର ଫଟୋ ନିଅନ୍ତୁ",
  },
};

const MR: OnboardingContent = {
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
  // Health, and a newer one moves the target on every surface, the browser included. v11 grows
  // the country question from four options to fifteen: it offered Germany, the UK, the US and
  // "Somewhere else" while the product shipped in eight languages, so a Vietnamese, Indonesian,
  // Italian, Spanish or Russian reader had exactly one true answer and it was the sentinel. The
  // labels left this file with it — a country's name is CLDR's, not an admin's. Bumped because a
  // funnel row for a four-chip screen and one for a fifteen-chip screen are not the same screen.
  // v12 is the v5 redesign's copy (issue #42): the age question asks "How old are you?" plainly,
  // and the activity options answer in plain frequencies — "A little each week" — rather than
  // effort labels. v13 (#50) drops 'No account needed to start.': the web asks for a sign-in
  // before the first question, and one content tree cannot say it on the phone only.
  // v14 is targets v2 (#81): the activity question's five levels became three — few/some/many —
  // and the sex question gained "other". A stored v13 revision carries neither, so the validator
  // retires it and every language falls back to this.
  //
  // v15 IS ONBOARDING V2 (#82): the conversation becomes Cal AI-shaped plain screens, one question
  // each — twelve screens where seven used to be, the struggles eight became five stored picks,
  // the restrictions screen split into `diet` (seven single-choice) and `medical` (multi-select,
  // "None of these" a drawn row), and the sign-up beat lands between the plan and the country.
  // A stored v14 revision names screens and asks this shape cannot satisfy, so it falls back whole.
  // v16 (#1078): the activity question's three bands became four — 0 / 1–2 / 3–4 / 5+ — and `few`
  // moved from "0–2" to "1–2". A stored v15 labels the new `few` "0–2" and has no `none` at all,
  // so `usableContent` retires it and every language falls back to this. v17 (ieat-app#2050)
  // rewrites the welcome as a title and a subtitle — "A plan built around you" — over the photo.
  version: 19,
  welcome: {
    lines: ["फोटोने कॅलरी मोजा"],
    cta: "सुरू करा",
    signin: "माझे अकाउंट आधीच आहे",
  },
  screens: [
    {
      id: "goal",
      asks: {
        goal: { lines: ["तुम्हाला काय साध्य करायचे आहे?"] },
      },
      options: {
        lose: { label: "वजन कमी करा" },
        maintain: { label: "वजन टिकवा" },
        gain: { label: "वजन वाढवा" },
      },
    },
    {
      id: "sex",
      asks: {
        sex: { lines: ["तुमचे लिंग काय आहे?"] },
      },
      options: {
        male: { label: "पुरुष" },
        female: { label: "स्त्री" },
        other: { label: "इतर" },
      },
    },
    {
      id: "age",
      asks: {
        // Asked as an AGE and stored as a year — `checkNumber` in `onboarding-chat.ts` converts.
        birth_year: {
          lines: ["तुमचे वय?"],
          placeholder: "तुमचे वय",
        },
      },
    },
    {
      id: "height",
      asks: {
        height_cm: {
          lines: ["उंची"],
          placeholder: "उंची cm मध्ये",
        },
      },
    },
    {
      id: "weight",
      asks: {
        weight_kg: {
          lines: ["तुमचे वजन"],
          placeholder: "वजन kg मध्ये",
        },
      },
    },
    {
      id: "activity",
      asks: {
        activity: {
          lines: ["तुमचे दिवस किती सक्रिय असतात?"],
        },
      },
      options: {
        // Targets v2/#1078: four levels id'd by their icons — the range is the label, the line
        // beneath is the hint.
        none: { label: "0", hint: "वर्कआउट नाही" },
        few: { label: "1–2", hint: "कधीमधी वर्कआउट" },
        some: { label: "3–4", hint: "आठवड्यात काही वर्कआउट" },
        many: { label: "5+", hint: "समर्पित ॲथलीट" },
      },
    },
    {
      id: "target",
      asks: {
        target_weight_kg: {
          lines: ["तुमचे ध्येय वजन किती आहे?"],
          placeholder: "ध्येय वजन kg मध्ये",
        },
      },
    },
    {
      id: "pace",
      asks: {
        pace: { lines: ["किती वेगाने?"] },
      },
      options: {
        easy: { label: "सौम्य" },
        steady: { label: "स्थिर" },
        push: { label: "जलद" },
      },
    },
    {
      id: "counted",
      asks: { counted_before: { lines: ["यापूर्वी कॅलरी मोजल्या आहेत का?"] } },
      options: {
        never: { label: "कधीच नाही" },
        stopped: { label: "प्रयत्न केला, सोडून दिला" },
        onoff: { label: "कधी कधी" },
        now: { label: "आत्ताही मोजत आहे" },
      },
    },
    {
      id: "barrier",
      asks: {
        barriers: {
          lines: ["कशामुळे थांबलात?", "लागू असलेले सर्व निवडा"],
          variants: {
            onoff: ["काय अडथळा आला?", "लागू असलेले सर्व निवडा"],
            now: ["काय अजून सोपं हवं?", "लागू असलेले सर्व निवडा"],
          },
        },
      },
      options: {
        too_long: { label: "खूप वेळ लागत होता" },
        forgot: { label: "लक्षात राहत नव्हतं" },
        invisible: { label: "परिणाम दिसत नव्हता" },
        no_idea: { label: "काय जेवावं कळत नव्हतं" },
        stressful: { label: "तणावपूर्ण वाटत होतं" },
        nobody: { label: "विचारायला कोणी नव्हतं" },
        creeping: { label: "वजन पुन्हा हळूहळू वाढत होतं" },
        not_enough: { label: "पुरेसं जेवणं कठीण होतं" },
      },
    },
    {
      id: "situation",
      asks: {
        situations: {
          lines: ["कधी नोंदवणं सगळ्यात अवघड?"],
          variants: { never: ["नोंदवणं कधी सगळ्यात अवघड जाईल असं वाटतं?"] },
        },
      },
      options: {
        workdays: { label: "व्यस्त कामाचे दिवस" },
        eating_out: { label: "बाहेर जेवणं" },
        cooking: { label: "इतरांसाठी स्वयंपाक" },
        snacks: { label: "स्नॅक्स आणि पेये" },
        evenings: { label: "संध्याकाळ आणि सुट्टीचे दिवस" },
      },
    },
    {
      id: "diet",
      asks: {
        diet: { lines: ["तुम्ही एखादा आहार पाळता का?"] },
      },
      options: {
        balanced: { label: "संतुलित" },
        wholefood: { label: "होल-फूड" },
        mediterranean: { label: "मेडिटेरेनियन" },
        flexitarian: { label: "फ्लेक्सिटेरियन" },
        pescatarian: { label: "पेस्केटेरियन" },
        vegetarian: { label: "शाकाहारी" },
        vegan: { label: "व्हेगन" },
      },
    },
    {
      id: "medical",
      asks: {
        medical: { lines: ["काही वैद्यकीय मर्यादा?"] },
      },
      options: {
        kidneys: { label: "किडनीचा आजार" },
        ldl: { label: "उच्च कोलेस्टेरॉल" },
        lowsugar: { label: "मधुमेहाचा धोका" },
        none: { label: "यापैकी काहीही नाही" },
      },
    },
    {
      id: "country",
      asks: {
        country: { lines: ["तुम्ही कुठे जेवता?"], placeholder: "शोधा" },
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
        other: { label: "इतर कुठेतरी" },
      },
    },
    {
      id: "streak",
      asks: {
        streak_goal_days: { lines: ["कोणत्या स्ट्रीकचे लक्ष्य ठेवायचे ते निवडा"] },
      },
      options: {
        "7": { label: "7 दिवस" },
        "14": { label: "14 दिवस" },
        "30": { label: "30 दिवस" },
        "50": { label: "50 दिवस" },
      },
    },
  ],
  building: {
    lines: ["तुमचा वैयक्तिक प्लॅन तयार होत आहे"],
    title: "तुमचा दैनिक प्लॅन",
    rows: { calories: "कॅलरी", protein: "प्रोटीन", carbs: "कार्ब्स", fat: "फॅट", diet: "आहार" },
    limitCap: { ldl: "सॅच्युरेटेड फॅट ≤ {n} g", kidneys: "सोडियम ≤ {n} mg" },
    cta: "मला प्लॅन दाखवा",
    floorTitle: "आम्ही {floor} kcal वर थांबलो",
    floorBody: "हिशोब यापेक्षा खाली जात होता. वैद्यकीय देखरेखीशिवाय आम्ही यापेक्षा कमी लक्ष्य ठेवत नाही, म्हणून तुमचे लक्ष्य इथेच आहे. तुमच्या डायरीतही असेच लिहिलेले असेल.",
  },
  summary: {
    lines: ["हा आहे तुमचा प्लॅन"],
    kcalLabel: "kcal दिवसाला",
    floorMarker: "सुरक्षेसाठी मर्यादित · कधीही {floor} पेक्षा कमी नाही",
    macros: {
      protein: "प्रोटीन",
      carbs: "कार्ब्स",
      fat: "फॅट",
      satfat: "सॅच्युरेटेड फॅट · तुमच्या सांगण्यानुसार",
    },
    capNote: "त्या वेगासाठी दररोज जितका मोठा बदल लागतो तितका सुरक्षितपणे टिकवता येत नाही, म्हणून तुमचा प्लॅन सुरक्षित आवृत्ती आहे: तुमचे शरीर एका दिवसात जितके खर्च करते त्याच्या {share}%.",
    // R0 of the retention plan: onboarding ends with ONE unambiguous instruction, and the thing
    // being asked for is the first photo. "Start logging" points at a diary, which is an empty list
    // and a second decision.
    cta: "तुमच्या पहिल्या जेवणाचा फोटो काढा",
  },
};

const ML: OnboardingContent = {
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
  // Health, and a newer one moves the target on every surface, the browser included. v11 grows
  // the country question from four options to fifteen: it offered Germany, the UK, the US and
  // "Somewhere else" while the product shipped in eight languages, so a Vietnamese, Indonesian,
  // Italian, Spanish or Russian reader had exactly one true answer and it was the sentinel. The
  // labels left this file with it — a country's name is CLDR's, not an admin's. Bumped because a
  // funnel row for a four-chip screen and one for a fifteen-chip screen are not the same screen.
  // v12 is the v5 redesign's copy (issue #42): the age question asks "How old are you?" plainly,
  // and the activity options answer in plain frequencies — "A little each week" — rather than
  // effort labels. v13 (#50) drops 'No account needed to start.': the web asks for a sign-in
  // before the first question, and one content tree cannot say it on the phone only.
  // v14 is targets v2 (#81): the activity question's five levels became three — few/some/many —
  // and the sex question gained "other". A stored v13 revision carries neither, so the validator
  // retires it and every language falls back to this.
  //
  // v15 IS ONBOARDING V2 (#82): the conversation becomes Cal AI-shaped plain screens, one question
  // each — twelve screens where seven used to be, the struggles eight became five stored picks,
  // the restrictions screen split into `diet` (seven single-choice) and `medical` (multi-select,
  // "None of these" a drawn row), and the sign-up beat lands between the plan and the country.
  // A stored v14 revision names screens and asks this shape cannot satisfy, so it falls back whole.
  // v16 (#1078): the activity question's three bands became four — 0 / 1–2 / 3–4 / 5+ — and `few`
  // moved from "0–2" to "1–2". A stored v15 labels the new `few` "0–2" and has no `none` at all,
  // so `usableContent` retires it and every language falls back to this. v17 (ieat-app#2050)
  // rewrites the welcome as a title and a subtitle — "A plan built around you" — over the photo.
  version: 19,
  welcome: {
    lines: ["ഫോട്ടോയിലൂടെ കലോറി കണക്കാക്കൂ"],
    cta: "തുടങ്ങുക",
    signin: "എനിക്ക് ഇതിനകം ഒരു അക്കൗണ്ട് ഉണ്ട്",
  },
  screens: [
    {
      id: "goal",
      asks: {
        goal: { lines: ["ഇവിടെ എന്താണ് നിങ്ങളുടെ ലക്ഷ്യം?"] },
      },
      options: {
        lose: { label: "ഭാരം കുറയ്ക്കുക" },
        maintain: { label: "ഭാരം നിലനിർത്തുക" },
        gain: { label: "ഭാരം കൂട്ടുക" },
      },
    },
    {
      id: "sex",
      asks: {
        sex: { lines: ["നിങ്ങളുടെ ലിംഗം ഏതാണ്?"] },
      },
      options: {
        male: { label: "പുരുഷൻ" },
        female: { label: "സ്ത്രീ" },
        other: { label: "മറ്റുള്ളവ" },
      },
    },
    {
      id: "age",
      asks: {
        // Asked as an AGE and stored as a year — `checkNumber` in `onboarding-chat.ts` converts.
        birth_year: {
          lines: ["നിങ്ങളുടെ പ്രായം?"],
          placeholder: "നിങ്ങളുടെ പ്രായം",
        },
      },
    },
    {
      id: "height",
      asks: {
        height_cm: {
          lines: ["ഉയരം"],
          placeholder: "ഉയരം cm-ൽ",
        },
      },
    },
    {
      id: "weight",
      asks: {
        weight_kg: {
          lines: ["നിങ്ങളുടെ ഭാരം"],
          placeholder: "ഭാരം kg-ൽ",
        },
      },
    },
    {
      id: "activity",
      asks: {
        activity: {
          lines: ["നിങ്ങളുടെ ദിവസങ്ങൾ എത്രത്തോളം സജീവമാണ്?"],
        },
      },
      options: {
        // Targets v2/#1078: four levels id'd by their icons — the range is the label, the line
        // beneath is the hint.
        none: { label: "0", hint: "വർക്കൗട്ട് ഇല്ല" },
        few: { label: "1–2", hint: "ഇടയ്ക്കിടെ വർക്കൗട്ട്" },
        some: { label: "3–4", hint: "ആഴ്ചയിൽ കുറച്ച് വർക്കൗട്ടുകൾ" },
        many: { label: "5+", hint: "സമർപ്പിത കായികതാരം" },
      },
    },
    {
      id: "target",
      asks: {
        target_weight_kg: {
          lines: ["ഏത് ഭാരമാണ് ലക്ഷ്യമിടുന്നത്?"],
          placeholder: "ലക്ഷ്യ ഭാരം kg-ൽ",
        },
      },
    },
    {
      id: "pace",
      asks: {
        pace: { lines: ["എത്ര വേഗത്തിൽ?"] },
      },
      options: {
        easy: { label: "മൃദുവായി" },
        steady: { label: "സ്ഥിരമായി" },
        push: { label: "വേഗത്തിൽ" },
      },
    },
    {
      id: "counted",
      asks: { counted_before: { lines: ["മുമ്പ് കലോറി കണക്കാക്കിയിട്ടുണ്ടോ?"] } },
      options: {
        never: { label: "ഒരിക്കലുമില്ല" },
        stopped: { label: "ശ്രമിച്ചു, പിന്നെ നിർത്തി" },
        onoff: { label: "ഇടയ്ക്കിടെ" },
        now: { label: "ഇപ്പോൾ കണക്കാക്കുന്നു" },
      },
    },
    {
      id: "barrier",
      asks: {
        barriers: {
          lines: ["എന്താണ് നിങ്ങളെ നിർത്തിയത്?", "ചേരുന്നവയെല്ലാം തിരഞ്ഞെടുക്കുക"],
          variants: {
            onoff: ["എന്താണ് തടസ്സമായത്?", "ചേരുന്നവയെല്ലാം തിരഞ്ഞെടുക്കുക"],
            now: ["എന്താണ് കൂടുതൽ എളുപ്പമാകേണ്ടത്?", "ചേരുന്നവയെല്ലാം തിരഞ്ഞെടുക്കുക"],
          },
        },
      },
      options: {
        too_long: { label: "ധാരാളം സമയം എടുത്തു" },
        forgot: { label: "മറന്നുപോയി" },
        invisible: { label: "ഇത് പ്രവർത്തിക്കുന്നത് കാണാൻ കഴിഞ്ഞില്ല" },
        no_idea: { label: "എന്ത് കഴിക്കണമെന്ന് അറിയില്ലായിരുന്നു" },
        stressful: { label: "സമ്മർദ്ദമായി തോന്നി" },
        nobody: { label: "ചോദിക്കാൻ ആരുമില്ലായിരുന്നു" },
        creeping: { label: "ഭാരം വീണ്ടും കൂടിത്തുടങ്ങി" },
        not_enough: { label: "മതിയായത്ര കഴിക്കാൻ ബുദ്ധിമുട്ടായിരുന്നു" },
      },
    },
    {
      id: "situation",
      asks: {
        situations: {
          lines: ["എപ്പോഴാണ് രേഖപ്പെടുത്തൽ ഏറ്റവും ബുദ്ധിമുട്ട്?"],
          variants: { never: ["എപ്പോഴാണ് രേഖപ്പെടുത്തൽ ഏറ്റവും ബുദ്ധിമുട്ടാകുമെന്ന് കരുതുന്നു?"] },
        },
      },
      options: {
        workdays: { label: "തിരക്കുള്ള ജോലിദിവസങ്ങൾ" },
        eating_out: { label: "പുറത്ത് ഭക്ഷണം" },
        cooking: { label: "മറ്റുള്ളവർക്കായി പാചകം" },
        snacks: { label: "ലഘുഭക്ഷണവും പാനീയങ്ങളും" },
        evenings: { label: "വൈകുന്നേരങ്ങളും അവധിദിവസങ്ങളും" },
      },
    },
    {
      id: "diet",
      asks: {
        diet: { lines: ["നിങ്ങൾ ഏതെങ്കിലും ഡയറ്റ് പിന്തുടരുന്നുണ്ടോ?"] },
      },
      options: {
        balanced: { label: "സന്തുലിതം" },
        wholefood: { label: "സംസ്കരിക്കാത്ത ഭക്ഷണം" },
        mediterranean: { label: "മെഡിറ്ററേനിയൻ" },
        flexitarian: { label: "ഫ്ലെക്സിറ്റേറിയൻ" },
        pescatarian: { label: "പെസ്കറ്റേറിയൻ" },
        vegetarian: { label: "സസ്യാഹാരം" },
        vegan: { label: "വീഗൻ" },
      },
    },
    {
      id: "medical",
      asks: {
        medical: { lines: ["എന്തെങ്കിലും ആരോഗ്യപരമായ നിയന്ത്രണങ്ങൾ?"] },
      },
      options: {
        kidneys: { label: "വൃക്കരോഗം" },
        ldl: { label: "ഉയർന്ന കൊളസ്ട്രോൾ" },
        lowsugar: { label: "പ്രമേഹ സാധ്യത" },
        none: { label: "ഇവയൊന്നുമില്ല" },
      },
    },
    {
      id: "country",
      asks: {
        country: { lines: ["നിങ്ങൾ എവിടെയാണ് ഭക്ഷണം കഴിക്കുന്നത്?"], placeholder: "തിരയുക" },
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
        other: { label: "മറ്റെവിടെയെങ്കിലും" },
      },
    },
    {
      id: "streak",
      asks: {
        streak_goal_days: { lines: ["ലക്ഷ്യമിടാൻ ഒരു സ്ട്രീക്ക് തിരഞ്ഞെടുക്കൂ"] },
      },
      options: {
        "7": { label: "7 ദിവസം" },
        "14": { label: "14 ദിവസം" },
        "30": { label: "30 ദിവസം" },
        "50": { label: "50 ദിവസം" },
      },
    },
  ],
  building: {
    lines: ["നിങ്ങളുടെ വ്യക്തിഗത പ്ലാൻ തയ്യാറാക്കുന്നു"],
    title: "നിങ്ങളുടെ ദൈനംദിന പ്ലാൻ",
    rows: { calories: "കലോറി", protein: "പ്രോട്ടീൻ", carbs: "കാർബ്സ്", fat: "കൊഴുപ്പ്", diet: "ഡയറ്റ്" },
    limitCap: { ldl: "പൂരിത കൊഴുപ്പ് ≤ {n} g", kidneys: "സോഡിയം ≤ {n} mg" },
    cta: "പ്ലാൻ കാണിക്കൂ",
    floorTitle: "ഞങ്ങൾ {floor} kcal-ൽ നിർത്തി",
    floorBody: "കണക്ക് ഇതിലും താഴേക്ക് പോകാൻ ആഗ്രഹിച്ചു. മെഡിക്കൽ മേൽനോട്ടമില്ലാതെ ഞങ്ങൾ ഇതിന് താഴെ ലക്ഷ്യം വയ്ക്കില്ല, അതിനാൽ നിങ്ങളുടേത് ഇവിടെയാണ്. നിങ്ങളുടെ ഡയറിയിലും അത് കാണിക്കും.",
  },
  summary: {
    lines: ["ഇതാ നിങ്ങളുടെ പ്ലാൻ"],
    kcalLabel: "kcal / ദിവസം",
    floorMarker: "സുരക്ഷയ്ക്കായി പരിധി · ഒരിക്കലും {floor}ന് താഴെയല്ല",
    macros: {
      protein: "പ്രോട്ടീൻ",
      carbs: "കാർബ്സ്",
      fat: "കൊഴുപ്പ്",
      satfat: "പൂരിത കൊഴുപ്പ് · നിങ്ങൾ ആവശ്യപ്പെട്ടത്",
    },
    capNote: "ആ ഗതിക്ക് സുരക്ഷിതമായി തുടരാവുന്നതിലും വലിയ ദൈനംദിന മാറ്റം വേണം, അതിനാൽ നിങ്ങളുടേത് സുരക്ഷിത പതിപ്പാണ്: നിങ്ങളുടെ ശരീരം ഒരു ദിവസം എരിക്കുന്നതിന്റെ {share}%.",
    // R0 of the retention plan: onboarding ends with ONE unambiguous instruction, and the thing
    // being asked for is the first photo. "Start logging" points at a diary, which is an empty list
    // and a second decision.
    cta: "നിങ്ങളുടെ ആദ്യ ഭക്ഷണത്തിന്റെ ഫോട്ടോ എടുക്കൂ",
  },
};

const KN: OnboardingContent = {
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
  // Health, and a newer one moves the target on every surface, the browser included. v11 grows
  // the country question from four options to fifteen: it offered Germany, the UK, the US and
  // "Somewhere else" while the product shipped in eight languages, so a Vietnamese, Indonesian,
  // Italian, Spanish or Russian reader had exactly one true answer and it was the sentinel. The
  // labels left this file with it — a country's name is CLDR's, not an admin's. Bumped because a
  // funnel row for a four-chip screen and one for a fifteen-chip screen are not the same screen.
  // v12 is the v5 redesign's copy (issue #42): the age question asks "How old are you?" plainly,
  // and the activity options answer in plain frequencies — "A little each week" — rather than
  // effort labels. v13 (#50) drops 'No account needed to start.': the web asks for a sign-in
  // before the first question, and one content tree cannot say it on the phone only.
  // v14 is targets v2 (#81): the activity question's five levels became three — few/some/many —
  // and the sex question gained "other". A stored v13 revision carries neither, so the validator
  // retires it and every language falls back to this.
  //
  // v15 IS ONBOARDING V2 (#82): the conversation becomes Cal AI-shaped plain screens, one question
  // each — twelve screens where seven used to be, the struggles eight became five stored picks,
  // the restrictions screen split into `diet` (seven single-choice) and `medical` (multi-select,
  // "None of these" a drawn row), and the sign-up beat lands between the plan and the country.
  // A stored v14 revision names screens and asks this shape cannot satisfy, so it falls back whole.
  // v16 (#1078): the activity question's three bands became four — 0 / 1–2 / 3–4 / 5+ — and `few`
  // moved from "0–2" to "1–2". A stored v15 labels the new `few` "0–2" and has no `none` at all,
  // so `usableContent` retires it and every language falls back to this. v17 (ieat-app#2050)
  // rewrites the welcome as a title and a subtitle — "A plan built around you" — over the photo.
  version: 19,
  welcome: {
    lines: ["ಫೋಟೋದಿಂದ ಕ್ಯಾಲೊರಿಗಳನ್ನು ಲೆಕ್ಕ ಹಾಕಿ"],
    cta: "ಪ್ರಾರಂಭಿಸಿ",
    signin: "ನನಗೆ ಈಗಾಗಲೇ ಖಾತೆ ಇದೆ",
  },
  screens: [
    {
      id: "goal",
      asks: {
        goal: { lines: ["ನೀವು ಇಲ್ಲಿ ಏನು ಮಾಡಲು ಬಂದಿದ್ದೀರಿ?"] },
      },
      options: {
        lose: { label: "ತೂಕ ಇಳಿಸಿ" },
        maintain: { label: "ತೂಕ ಕಾಯ್ದುಕೊಳ್ಳಿ" },
        gain: { label: "ತೂಕ ಹೆಚ್ಚಿಸಿ" },
      },
    },
    {
      id: "sex",
      asks: {
        sex: { lines: ["ನಿಮ್ಮ ಲಿಂಗ ಯಾವುದು?"] },
      },
      options: {
        male: { label: "ಪುರುಷ" },
        female: { label: "ಮಹಿಳೆ" },
        other: { label: "ಇತರೆ" },
      },
    },
    {
      id: "age",
      asks: {
        // Asked as an AGE and stored as a year — `checkNumber` in `onboarding-chat.ts` converts.
        birth_year: {
          lines: ["ನಿಮ್ಮ ವಯಸ್ಸು?"],
          placeholder: "ನಿಮ್ಮ ವಯಸ್ಸು",
        },
      },
    },
    {
      id: "height",
      asks: {
        height_cm: {
          lines: ["ಎತ್ತರ"],
          placeholder: "ಎತ್ತರ cm ನಲ್ಲಿ",
        },
      },
    },
    {
      id: "weight",
      asks: {
        weight_kg: {
          lines: ["ನಿಮ್ಮ ತೂಕ"],
          placeholder: "ತೂಕ kg ನಲ್ಲಿ",
        },
      },
    },
    {
      id: "activity",
      asks: {
        activity: {
          lines: ["ನಿಮ್ಮ ದಿನಗಳು ಎಷ್ಟು ಸಕ್ರಿಯವಾಗಿರುತ್ತವೆ?"],
        },
      },
      options: {
        // Targets v2/#1078: four levels id'd by their icons — the range is the label, the line
        // beneath is the hint.
        none: { label: "0", hint: "ವರ್ಕ್‌ಔಟ್ ಇಲ್ಲ" },
        few: { label: "1–2", hint: "ಆಗಾಗ ವರ್ಕ್‌ಔಟ್" },
        some: { label: "3–4", hint: "ವಾರಕ್ಕೆ ಕೆಲವು ವರ್ಕ್‌ಔಟ್‌ಗಳು" },
        many: { label: "5+", hint: "ಸಮರ್ಪಿತ ಕ್ರೀಡಾಪಟು" },
      },
    },
    {
      id: "target",
      asks: {
        target_weight_kg: {
          lines: ["ನೀವು ಯಾವ ತೂಕವನ್ನು ಗುರಿಯಾಗಿಸಿದ್ದೀರಿ?"],
          placeholder: "ಗುರಿ ತೂಕ kg ನಲ್ಲಿ",
        },
      },
    },
    {
      id: "pace",
      asks: {
        pace: { lines: ["ಎಷ್ಟು ವೇಗವಾಗಿ?"] },
      },
      options: {
        easy: { label: "ಸೌಮ್ಯ" },
        steady: { label: "ಸ್ಥಿರ" },
        push: { label: "ತ್ವರಿತ" },
      },
    },
    {
      id: "counted",
      asks: { counted_before: { lines: ["ಮೊದಲು ಕ್ಯಾಲೊರಿಗಳನ್ನು ಎಣಿಸಿದ್ದೀರಾ?"] } },
      options: {
        never: { label: "ಎಂದಿಗೂ ಇಲ್ಲ" },
        stopped: { label: "ಪ್ರಯತ್ನಿಸಿದೆ, ನಿಲ್ಲಿಸಿದೆ" },
        onoff: { label: "ಆಗಿಂದಾಗಿ" },
        now: { label: "ಈಗ ಎಣಿಸುತ್ತಿದ್ದೇನೆ" },
      },
    },
    {
      id: "barrier",
      asks: {
        barriers: {
          lines: ["ನಿಮ್ಮನ್ನು ಏನು ನಿಲ್ಲಿಸಿತು?", "ಹೊಂದುವವುಗಳನ್ನೆಲ್ಲಾ ಆಯ್ಕೆಮಾಡಿ"],
          variants: {
            onoff: ["ಏನು ಅಡ್ಡ ಬಂತು?", "ಹೊಂದುವವುಗಳನ್ನೆಲ್ಲಾ ಆಯ್ಕೆಮಾಡಿ"],
            now: ["ಏನು ಇನ್ನಷ್ಟು ಸುಲಭವಾಗಬೇಕು?", "ಹೊಂದುವವುಗಳನ್ನೆಲ್ಲಾ ಆಯ್ಕೆಮಾಡಿ"],
          },
        },
      },
      options: {
        too_long: { label: "ಬಹಳ ಸಮಯ ತೆಗೆದುಕೊಳ್ಳುತ್ತಿತ್ತು" },
        forgot: { label: "ಮರೆತುಹೋಗುತ್ತಿದ್ದೆ" },
        invisible: { label: "ಫಲಿತಾಂಶ ಕಂಡುಬರಲಿಲ್ಲ" },
        no_idea: { label: "ಏನು ತಿನ್ನಬೇಕೆಂದು ತಿಳಿದಿರಲಿಲ್ಲ" },
        stressful: { label: "ಒತ್ತಡವಾಗಿ ಅನ್ನಿಸುತ್ತಿತ್ತು" },
        nobody: { label: "ಕೇಳಲು ಯಾರೂ ಇರಲಿಲ್ಲ" },
        creeping: { label: "ನನ್ನ ತೂಕ ಮತ್ತೆ ಏರಿಕೆಯಾಗುತ್ತಿತ್ತು" },
        not_enough: { label: "ಸಾಕಷ್ಟು ತಿನ್ನುವುದು ಕಷ್ಟವಾಗಿತ್ತು" },
      },
    },
    {
      id: "situation",
      asks: {
        situations: {
          lines: ["ಯಾವಾಗ ದಾಖಲಿಸುವುದು ಅತಿ ಕಷ್ಟ?"],
          variants: { never: ["ಯಾವಾಗ ದಾಖಲಿಸುವುದು ಅತಿ ಕಷ್ಟ ಎಂದು ಭಾವಿಸುತ್ತೀರಿ?"] },
        },
      },
      options: {
        workdays: { label: "ಬಿಝಿ ಕೆಲಸದ ದಿನಗಳು" },
        eating_out: { label: "ಹೊರಗೆ ಊಟ" },
        cooking: { label: "ಇತರರಿಗಾಗಿ ಅಡುಗೆ" },
        snacks: { label: "ತಿಂಡಿಗಳು ಮತ್ತು ಪಾನೀಯಗಳು" },
        evenings: { label: "ಸಂಜೆಗಳು ಮತ್ತು ವಾರಾಂತ್ಯಗಳು" },
      },
    },
    {
      id: "diet",
      asks: {
        diet: { lines: ["ನೀವು ಯಾವುದಾದರೂ ಡಯಟ್ ಅನುಸರಿಸುತ್ತೀರಾ?"] },
      },
      options: {
        balanced: { label: "ಸಮತೋಲಿತ" },
        wholefood: { label: "ಸಂಪೂರ್ಣ ಆಹಾರ" },
        mediterranean: { label: "ಮೆಡಿಟರೇನಿಯನ್" },
        flexitarian: { label: "ಫ್ಲೆಕ್ಸಿಟೇರಿಯನ್" },
        pescatarian: { label: "ಪೆಸ್ಕಟೇರಿಯನ್" },
        vegetarian: { label: "ಸಸ್ಯಾಹಾರಿ" },
        vegan: { label: "ವೀಗನ್" },
      },
    },
    {
      id: "medical",
      asks: {
        medical: { lines: ["ಯಾವುದಾದರೂ ವೈದ್ಯಕೀಯ ನಿರ್ಬಂಧಗಳು?"] },
      },
      options: {
        kidneys: { label: "ಮೂತ್ರಪಿಂಡದ ಸಮಸ್ಯೆ" },
        ldl: { label: "ಅಧಿಕ ಕೊಲೆಸ್ಟ್ರಾಲ್" },
        lowsugar: { label: "ಮಧುಮೇಹದ ಅಪಾಯ" },
        none: { label: "ಇವುಗಳಲ್ಲಿ ಯಾವುದೂ ಇಲ್ಲ" },
      },
    },
    {
      id: "country",
      asks: {
        country: { lines: ["ನೀವು ಎಲ್ಲಿ ಊಟ ಮಾಡುತ್ತೀರಿ?"], placeholder: "ಹುಡುಕಿ" },
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
        other: { label: "ಬೇರೆಡೆ" },
      },
    },
    {
      id: "streak",
      asks: {
        streak_goal_days: { lines: ["ಗುರಿಯಾಗಿ ಒಂದು ಸ್ಟ್ರೀಕ್ ಆಯ್ಕೆಮಾಡಿ"] },
      },
      options: {
        "7": { label: "7 ದಿನಗಳು" },
        "14": { label: "14 ದಿನಗಳು" },
        "30": { label: "30 ದಿನಗಳು" },
        "50": { label: "50 ದಿನಗಳು" },
      },
    },
  ],
  building: {
    lines: ["ನಿಮ್ಮ ವೈಯಕ್ತಿಕ ಪ್ಲಾನ್ ರೂಪಿಸಲಾಗುತ್ತಿದೆ"],
    title: "ನಿಮ್ಮ ದೈನಂದಿನ ಪ್ಲಾನ್",
    rows: { calories: "ಕ್ಯಾಲೊರಿ", protein: "ಪ್ರೋಟೀನ್", carbs: "ಕಾರ್ಬ್ಸ್", fat: "ಕೊಬ್ಬು", diet: "ಡಯಟ್" },
    limitCap: { ldl: "ಸ್ಯಾಚುರೇಟೆಡ್ ಕೊಬ್ಬು ≤ {n} g", kidneys: "ಸೋಡಿಯಂ ≤ {n} mg" },
    cta: "ಪ್ಲಾನ್ ತೋರಿಸಿ",
    floorTitle: "ನಾವು {floor} kcal ನಲ್ಲಿ ನಿಲ್ಲಿಸಿದ್ದೇವೆ",
    floorBody: "ಲೆಕ್ಕಾಚಾರ ಇನ್ನೂ ಕೆಳಗೆ ಹೋಗಲು ಬಯಸಿತ್ತು. ವೈದ್ಯಕೀಯ ಮೇಲ್ವಿಚಾರಣೆಯಿಲ್ಲದೆ ನಾವು ಇದಕ್ಕಿಂತ ಕಡಿಮೆ ಗುರಿಗಳನ್ನು ಹೊಂದಿಸುವುದಿಲ್ಲ, ಹಾಗಾಗಿ ನಿಮ್ಮದು ಇಲ್ಲೇ ಇದೆ. ನಿಮ್ಮ ಡೈರಿಯಲ್ಲೂ ಇದನ್ನೇ ತೋರಿಸಲಾಗುತ್ತದೆ.",
  },
  summary: {
    lines: ["ಇದು ನಿಮ್ಮ ಪ್ಲಾನ್"],
    kcalLabel: "kcal ದಿನಕ್ಕೆ",
    floorMarker: "ಸುರಕ್ಷತೆಗಾಗಿ ಮಿತಿಗೊಳಿಸಲಾಗಿದೆ · ಯಾವಾಗಲೂ ಕನಿಷ್ಠ {floor}",
    macros: {
      protein: "ಪ್ರೋಟೀನ್",
      carbs: "ಕಾರ್ಬ್ಸ್",
      fat: "ಕೊಬ್ಬು",
      satfat: "ಸ್ಯಾಚುರೇಟೆಡ್ ಕೊಬ್ಬು · ನೀವು ಕೇಳಿದಂತೆ",
    },
    capNote: "ಆ ವೇಗಕ್ಕೆ ಸುರಕ್ಷಿತವಾಗಿ ಮುಂದುವರಿಸಬಹುದಾದದ್ದಕ್ಕಿಂತ ದೊಡ್ಡ ದೈನಂದಿನ ಬದಲಾವಣೆ ಬೇಕು, ಹಾಗಾಗಿ ನಿಮ್ಮದು ಸುರಕ್ಷಿತ ಆವೃತ್ತಿ: ನಿಮ್ಮ ದೇಹ ಒಂದು ದಿನದಲ್ಲಿ ಖರ್ಚು ಮಾಡುವುದರ {share}%.",
    // R0 of the retention plan: onboarding ends with ONE unambiguous instruction, and the thing
    // being asked for is the first photo. "Start logging" points at a diary, which is an empty list
    // and a second decision.
    cta: "ನಿಮ್ಮ ಮೊದಲ ಊಟದ ಫೋಟೋ ತೆಗೆಯಿರಿ",
  },
};

const GU: OnboardingContent = {
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
  // Health, and a newer one moves the target on every surface, the browser included. v11 grows
  // the country question from four options to fifteen: it offered Germany, the UK, the US and
  // "Somewhere else" while the product shipped in eight languages, so a Vietnamese, Indonesian,
  // Italian, Spanish or Russian reader had exactly one true answer and it was the sentinel. The
  // labels left this file with it — a country's name is CLDR's, not an admin's. Bumped because a
  // funnel row for a four-chip screen and one for a fifteen-chip screen are not the same screen.
  // v12 is the v5 redesign's copy (issue #42): the age question asks "How old are you?" plainly,
  // and the activity options answer in plain frequencies — "A little each week" — rather than
  // effort labels. v13 (#50) drops 'No account needed to start.': the web asks for a sign-in
  // before the first question, and one content tree cannot say it on the phone only.
  // v14 is targets v2 (#81): the activity question's five levels became three — few/some/many —
  // and the sex question gained "other". A stored v13 revision carries neither, so the validator
  // retires it and every language falls back to this.
  //
  // v15 IS ONBOARDING V2 (#82): the conversation becomes Cal AI-shaped plain screens, one question
  // each — twelve screens where seven used to be, the struggles eight became five stored picks,
  // the restrictions screen split into `diet` (seven single-choice) and `medical` (multi-select,
  // "None of these" a drawn row), and the sign-up beat lands between the plan and the country.
  // A stored v14 revision names screens and asks this shape cannot satisfy, so it falls back whole.
  // v16 (#1078): the activity question's three bands became four — 0 / 1–2 / 3–4 / 5+ — and `few`
  // moved from "0–2" to "1–2". A stored v15 labels the new `few` "0–2" and has no `none` at all,
  // so `usableContent` retires it and every language falls back to this. v17 (ieat-app#2050)
  // rewrites the welcome as a title and a subtitle — "A plan built around you" — over the photo.
  version: 19,
  welcome: {
    lines: ["ફોટોથી કેલરી ગણો"],
    cta: "શરૂ કરો",
    signin: "મારું એકાઉન્ટ પહેલેથી છે",
  },
  screens: [
    {
      id: "goal",
      asks: {
        goal: { lines: ["તમે અહીં શું કરવા માંગો છો?"] },
      },
      options: {
        lose: { label: "વજન ઘટાડો" },
        maintain: { label: "મારું વજન જાળવો" },
        gain: { label: "વજન વધારો" },
      },
    },
    {
      id: "sex",
      asks: {
        sex: { lines: ["તમારું લિંગ શું છે?"] },
      },
      options: {
        male: { label: "પુરુષ" },
        female: { label: "સ્ત્રી" },
        other: { label: "અન્ય" },
      },
    },
    {
      id: "age",
      asks: {
        // Asked as an AGE and stored as a year — `checkNumber` in `onboarding-chat.ts` converts.
        birth_year: {
          lines: ["તમારી ઉંમર?"],
          placeholder: "તમારી ઉંમર",
        },
      },
    },
    {
      id: "height",
      asks: {
        height_cm: {
          lines: ["ઊંચાઈ"],
          placeholder: "ઊંચાઈ cm માં",
        },
      },
    },
    {
      id: "weight",
      asks: {
        weight_kg: {
          lines: ["તમારું વજન"],
          placeholder: "વજન kg માં",
        },
      },
    },
    {
      id: "activity",
      asks: {
        activity: {
          lines: ["તમારા દિવસો કેટલા સક્રિય હોય છે?"],
        },
      },
      options: {
        // Targets v2/#1078: four levels id'd by their icons — the range is the label, the line
        // beneath is the hint.
        none: { label: "0", hint: "કોઈ વર્કઆઉટ નહીં" },
        few: { label: "1–2", hint: "ક્યારેક વર્કઆઉટ" },
        some: { label: "3–4", hint: "અઠવાડિયામાં થોડા વર્કઆઉટ" },
        many: { label: "5+", hint: "સમર્પિત ઍથ્લીટ" },
      },
    },
    {
      id: "target",
      asks: {
        target_weight_kg: {
          lines: ["તમારું લક્ષ્ય વજન શું છે?"],
          placeholder: "લક્ષ્ય વજન kg માં",
        },
      },
    },
    {
      id: "pace",
      asks: {
        pace: { lines: ["કેટલી ઝડપે?"] },
      },
      options: {
        easy: { label: "હળવી" },
        steady: { label: "સ્થિર" },
        push: { label: "ઝડપી" },
      },
    },
    {
      id: "counted",
      asks: { counted_before: { lines: ["પહેલાં ક્યારેય કેલરી ગણી છે?"] } },
      options: {
        never: { label: "ક્યારેય નહીં" },
        stopped: { label: "ટ્રાય કરી, પછી છોડી દીધી" },
        onoff: { label: "ક્યારેક ક્યારેક" },
        now: { label: "હવે ગણું છું" },
      },
    },
    {
      id: "barrier",
      asks: {
        barriers: {
          lines: ["શેનાથી તમે અટક્યા?", "લાગુ પડતું બધું પસંદ કરો"],
          variants: {
            onoff: ["શું અડચણ આવી?", "લાગુ પડતું બધું પસંદ કરો"],
            now: ["શું વધુ સરળ હોવું જોઈએ?", "લાગુ પડતું બધું પસંદ કરો"],
          },
        },
      },
      options: {
        too_long: { label: "બહુ સમય લેતું હતું" },
        forgot: { label: "યાદ નહોતું રહેતું" },
        invisible: { label: "પરિણામ દેખાતું નહોતું" },
        no_idea: { label: "શું ખાવું એ ખ્યાલ નહોતો" },
        stressful: { label: "તણાવભર્યું લાગતું હતું" },
        nobody: { label: "પૂછવા કોઈ નહોતું" },
        creeping: { label: "મારું વજન ફરી વધતું હતું" },
        not_enough: { label: "પૂરતું ખાવું મુશ્કેલ હતું" },
      },
    },
    {
      id: "situation",
      asks: {
        situations: {
          lines: ["નોંધવું ક્યારે સૌથી અઘરું?"],
          variants: { never: ["નોંધવું ક્યારે સૌથી અઘરું થશે એમ લાગે છે?"] },
        },
      },
      options: {
        workdays: { label: "વ્યસ્ત કામકાજના દિવસો" },
        eating_out: { label: "બહાર જમવું" },
        cooking: { label: "બીજા માટે રસોઈ" },
        snacks: { label: "નાસ્તા અને પીણાં" },
        evenings: { label: "સાંજો અને વીકેન્ડ" },
      },
    },
    {
      id: "diet",
      asks: {
        diet: { lines: ["શું તમે કોઈ ડાયટ અનુસરો છો?"] },
      },
      options: {
        balanced: { label: "સંતુલિત" },
        wholefood: { label: "હોલ-ફૂડ" },
        mediterranean: { label: "મેડિટેરેનિયન" },
        flexitarian: { label: "ફ્લેક્સિટેરિયન" },
        pescatarian: { label: "પેસ્કેટેરિયન" },
        vegetarian: { label: "શાકાહારી" },
        vegan: { label: "વીગન" },
      },
    },
    {
      id: "medical",
      asks: {
        medical: { lines: ["કોઈ તબીબી મર્યાદા?"] },
      },
      options: {
        kidneys: { label: "કિડનીની બીમારી" },
        ldl: { label: "ઊંચું કોલેસ્ટ્રોલ" },
        lowsugar: { label: "ડાયાબિટીસનું જોખમ" },
        none: { label: "આમાંથી કંઈ નહીં" },
      },
    },
    {
      id: "country",
      asks: {
        country: { lines: ["તમે ક્યાં જમો છો?"], placeholder: "શોધો" },
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
        other: { label: "બીજે ક્યાંક" },
      },
    },
    {
      id: "streak",
      asks: {
        streak_goal_days: { lines: ["સ્ટ્રીકનું લક્ષ્ય પસંદ કરો"] },
      },
      options: {
        "7": { label: "7 દિવસ" },
        "14": { label: "14 દિવસ" },
        "30": { label: "30 દિવસ" },
        "50": { label: "50 દિવસ" },
      },
    },
  ],
  building: {
    lines: ["તમારો વ્યક્તિગત પ્લાન બની રહ્યો છે"],
    title: "તમારો રોજનો પ્લાન",
    rows: { calories: "કેલરી", protein: "પ્રોટીન", carbs: "કાર્બ્સ", fat: "ફેટ", diet: "ડાયટ" },
    limitCap: { ldl: "સેચ્યુરેટેડ ફેટ ≤ {n} g", kidneys: "સોડિયમ ≤ {n} mg" },
    cta: "મને પ્લાન બતાવો",
    floorTitle: "{floor} kcal પર અટકાવ્યું",
    floorBody: "ગણતરી આનાથી નીચે જવા માંગતી હતી. તબીબી દેખરેખ વિના અમે આનાથી ઓછું લક્ષ્ય નક્કી કરતા નથી, તેથી તમારું લક્ષ્ય અહીં જ છે. તમારી ડાયરીમાં પણ આ લખેલું હશે.",
  },
  summary: {
    lines: ["આ રહ્યો તમારો પ્લાન"],
    kcalLabel: "kcal પ્રતિ દિવસ",
    floorMarker: "સુરક્ષા માટે મર્યાદિત · ક્યારેય {floor} થી ઓછું નહીં",
    macros: {
      protein: "પ્રોટીન",
      carbs: "કાર્બ્સ",
      fat: "ફેટ",
      satfat: "સેચ્યુરેટેડ ફેટ · તમારા કહેવાથી",
    },
    capNote: "એ ઝડપ માટે રોજ એટલો મોટો ફેરફાર જોઈએ જેટલો સુરક્ષિત રીતે ટકાવી ન શકાય, તેથી તમારો પ્લાન સુરક્ષિત સંસ્કરણ છે: તમારું શરીર એક દિવસમાં જેટલું ખર્ચે છે તેના {share}%.",
    // R0 of the retention plan: onboarding ends with ONE unambiguous instruction, and the thing
    // being asked for is the first photo. "Start logging" points at a diary, which is an empty list
    // and a second decision.
    cta: "તમારા પહેલા ભોજનનો ફોટો લો",
  },
};

const BN: OnboardingContent = {
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
  // Health, and a newer one moves the target on every surface, the browser included. v11 grows
  // the country question from four options to fifteen: it offered Germany, the UK, the US and
  // "Somewhere else" while the product shipped in eight languages, so a Vietnamese, Indonesian,
  // Italian, Spanish or Russian reader had exactly one true answer and it was the sentinel. The
  // labels left this file with it — a country's name is CLDR's, not an admin's. Bumped because a
  // funnel row for a four-chip screen and one for a fifteen-chip screen are not the same screen.
  // v12 is the v5 redesign's copy (issue #42): the age question asks "How old are you?" plainly,
  // and the activity options answer in plain frequencies — "A little each week" — rather than
  // effort labels. v13 (#50) drops 'No account needed to start.': the web asks for a sign-in
  // before the first question, and one content tree cannot say it on the phone only.
  // v14 is targets v2 (#81): the activity question's five levels became three — few/some/many —
  // and the sex question gained "other". A stored v13 revision carries neither, so the validator
  // retires it and every language falls back to this.
  //
  // v15 IS ONBOARDING V2 (#82): the conversation becomes Cal AI-shaped plain screens, one question
  // each — twelve screens where seven used to be, the struggles eight became five stored picks,
  // the restrictions screen split into `diet` (seven single-choice) and `medical` (multi-select,
  // "None of these" a drawn row), and the sign-up beat lands between the plan and the country.
  // A stored v14 revision names screens and asks this shape cannot satisfy, so it falls back whole.
  // v16 (#1078): the activity question's three bands became four — 0 / 1–2 / 3–4 / 5+ — and `few`
  // moved from "0–2" to "1–2". A stored v15 labels the new `few` "0–2" and has no `none` at all,
  // so `usableContent` retires it and every language falls back to this. v17 (ieat-app#2050)
  // rewrites the welcome as a title and a subtitle — "A plan built around you" — over the photo.
  version: 19,
  welcome: {
    lines: ["ছবি দিয়ে ক্যালরি গুনুন"],
    cta: "শুরু করুন",
    signin: "আমার আগে থেকেই অ্যাকাউন্ট আছে",
  },
  screens: [
    {
      id: "goal",
      asks: {
        goal: { lines: ["আপনি এখানে কী করতে চান?"] },
      },
      options: {
        lose: { label: "ওজন কমান" },
        maintain: { label: "ওজন ধরে রাখুন" },
        gain: { label: "ওজন বাড়ান" },
      },
    },
    {
      id: "sex",
      asks: {
        sex: { lines: ["আপনার লিঙ্গ কী?"] },
      },
      options: {
        male: { label: "পুরুষ" },
        female: { label: "নারী" },
        other: { label: "অন্যান্য" },
      },
    },
    {
      id: "age",
      asks: {
        // Asked as an AGE and stored as a year — `checkNumber` in `onboarding-chat.ts` converts.
        birth_year: {
          lines: ["আপনার বয়স?"],
          placeholder: "আপনার বয়স",
        },
      },
    },
    {
      id: "height",
      asks: {
        height_cm: {
          lines: ["উচ্চতা"],
          placeholder: "উচ্চতা (cm)",
        },
      },
    },
    {
      id: "weight",
      asks: {
        weight_kg: {
          lines: ["আপনার ওজন"],
          placeholder: "ওজন (kg)",
        },
      },
    },
    {
      id: "activity",
      asks: {
        activity: {
          lines: ["আপনার দিনগুলো কতটা সক্রিয়?"],
        },
      },
      options: {
        // Targets v2/#1078: four levels id'd by their icons — the range is the label, the line
        // beneath is the hint.
        none: { label: "0", hint: "কোনো ওয়ার্কআউট নয়" },
        few: { label: "1–2", hint: "মাঝে মাঝে ওয়ার্কআউট" },
        some: { label: "3–4", hint: "সপ্তাহে কয়েকটি ওয়ার্কআউট" },
        many: { label: "5+", hint: "পুরোদস্তুর অ্যাথলিট" },
      },
    },
    {
      id: "target",
      asks: {
        target_weight_kg: {
          lines: ["কোন ওজনে পৌঁছাতে চান?"],
          placeholder: "লক্ষ্য ওজন (kg)",
        },
      },
    },
    {
      id: "pace",
      asks: {
        pace: { lines: ["কত দ্রুত?"] },
      },
      options: {
        easy: { label: "হালকা" },
        steady: { label: "স্থির" },
        push: { label: "দ্রুত" },
      },
    },
    {
      id: "counted",
      asks: { counted_before: { lines: ["আগে কি ক্যালরি গুনেছেন?"] } },
      options: {
        never: { label: "কখনো না" },
        stopped: { label: "চেষ্টা করেছিলাম, ছেড়ে দিয়েছি" },
        onoff: { label: "মাঝে মাঝে" },
        now: { label: "এখন গুনছি" },
      },
    },
    {
      id: "barrier",
      asks: {
        barriers: {
          lines: ["কী আপনাকে থামিয়েছিল?", "যা যা মানায় সব বেছে নিন"],
          variants: {
            onoff: ["কী বাধা হয়েছিল?", "যা যা মানায় সব বেছে নিন"],
            now: ["কী সহজ হলে ভালো হতো?", "যা যা মানায় সব বেছে নিন"],
          },
        },
      },
      options: {
        too_long: { label: "বেশি সময় লাগত" },
        forgot: { label: "ভুলে যেতাম" },
        invisible: { label: "ফলাফল দেখা যেত না" },
        no_idea: { label: "কী খাব জানতাম না" },
        stressful: { label: "চাপের লাগত" },
        nobody: { label: "জিজ্ঞেস করার মতো কেউ ছিল না" },
        creeping: { label: "আমার ওজন আবার বেড়ে যেত" },
        not_enough: { label: "যথেষ্ট খাওয়া কঠিন ছিল" },
      },
    },
    {
      id: "situation",
      asks: {
        situations: {
          lines: ["কখন লিখে রাখা সবচেয়ে কঠিন?"],
          variants: { never: ["কখন লিখে রাখা সবচেয়ে কঠিন হবে বলে মনে করেন?"] },
        },
      },
      options: {
        workdays: { label: "ব্যস্ত কর্মদিবস" },
        eating_out: { label: "বাইরে খাওয়া" },
        cooking: { label: "অন্যদের জন্য রান্না" },
        snacks: { label: "স্ন্যাকস আর পানীয়" },
        evenings: { label: "সন্ধ্যে আর ছুটির দিন" },
      },
    },
    {
      id: "diet",
      asks: {
        diet: { lines: ["আপনি কি কোনো ডায়েট মেনে চলেন?"] },
      },
      options: {
        balanced: { label: "সুষম" },
        wholefood: { label: "অপ্রক্রিয়াজাত খাবার" },
        mediterranean: { label: "ভূমধ্যসাগরীয়" },
        flexitarian: { label: "ফ্লেক্সিটেরিয়ান" },
        pescatarian: { label: "পেসকেটেরিয়ান" },
        vegetarian: { label: "নিরামিষ" },
        vegan: { label: "ভিগান" },
      },
    },
    {
      id: "medical",
      asks: {
        medical: { lines: ["কোনো চিকিৎসাগত সীমাবদ্ধতা?"] },
      },
      options: {
        kidneys: { label: "কিডনির সমস্যা" },
        ldl: { label: "উচ্চ কোলেস্টেরল" },
        lowsugar: { label: "ডায়াবেটিসের ঝুঁকি" },
        none: { label: "এগুলোর কোনোটিই নয়" },
      },
    },
    {
      id: "country",
      asks: {
        country: { lines: ["আপনি কোথায় খান?"], placeholder: "খুঁজুন" },
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
        other: { label: "অন্য কোথাও" },
      },
    },
    {
      id: "streak",
      asks: {
        streak_goal_days: { lines: ["কত দিনের স্ট্রিক লক্ষ্য রাখবেন, বেছে নিন"] },
      },
      options: {
        "7": { label: "7 দিন" },
        "14": { label: "14 দিন" },
        "30": { label: "30 দিন" },
        "50": { label: "50 দিন" },
      },
    },
  ],
  building: {
    lines: ["আপনার ব্যক্তিগত প্ল্যান তৈরি হচ্ছে"],
    title: "আপনার দৈনিক প্ল্যান",
    rows: { calories: "ক্যালরি", protein: "প্রোটিন", carbs: "কার্বস", fat: "ফ্যাট", diet: "ডায়েট" },
    limitCap: { ldl: "স্যাচু. ফ্যাট ≤ {n} g", kidneys: "সোডিয়াম ≤ {n} mg" },
    cta: "প্ল্যানটা দেখান",
    floorTitle: "{floor} kcal-এ থামানো হয়েছে",
    floorBody: "হিসাব আরও নিচে যেতে চাইছিল। চিকিৎসকের তত্ত্বাবধান ছাড়া আমরা এর নিচে লক্ষ্যমাত্রা রাখি না, তাই আপনারটা এখানেই। আপনার ডায়েরিতেও সেটা লেখা থাকবে।",
  },
  summary: {
    lines: ["এই হলো আপনার প্ল্যান"],
    kcalLabel: "kcal প্রতিদিন",
    floorMarker: "নিরাপত্তার জন্য সীমিত · কখনো {floor}-এর নিচে নয়",
    macros: {
      protein: "প্রোটিন",
      carbs: "কার্বস",
      fat: "ফ্যাট",
      satfat: "স্যাচুরেটেড ফ্যাট · আপনার অনুরোধে",
    },
    capNote: "ওই গতির জন্য প্রতিদিন যত বড় পরিবর্তন দরকার, তা নিরাপদে ধরে রাখা যায় না, তাই আপনারটা নিরাপদ সংস্করণ: আপনার শরীর এক দিনে যা খরচ করে তার {share}%।",
    // R0 of the retention plan: onboarding ends with ONE unambiguous instruction, and the thing
    // being asked for is the first photo. "Start logging" points at a diary, which is an empty list
    // and a second decision.
    cta: "আপনার প্রথম খাবারের ছবি তুলুন",
  },
};

const PT_PT: OnboardingContent = {
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
  // Health, and a newer one moves the target on every surface, the browser included. v11 grows
  // the country question from four options to fifteen: it offered Germany, the UK, the US and
  // "Somewhere else" while the product shipped in eight languages, so a Vietnamese, Indonesian,
  // Italian, Spanish or Russian reader had exactly one true answer and it was the sentinel. The
  // labels left this file with it — a country's name is CLDR's, not an admin's. Bumped because a
  // funnel row for a four-chip screen and one for a fifteen-chip screen are not the same screen.
  // v12 is the v5 redesign's copy (issue #42): the age question asks "How old are you?" plainly,
  // and the activity options answer in plain frequencies — "A little each week" — rather than
  // effort labels. v13 (#50) drops 'No account needed to start.': the web asks for a sign-in
  // before the first question, and one content tree cannot say it on the phone only.
  // v14 is targets v2 (#81): the activity question's five levels became three — few/some/many —
  // and the sex question gained "other". A stored v13 revision carries neither, so the validator
  // retires it and every language falls back to this.
  //
  // v15 IS ONBOARDING V2 (#82): the conversation becomes Cal AI-shaped plain screens, one question
  // each — twelve screens where seven used to be, the struggles eight became five stored picks,
  // the restrictions screen split into `diet` (seven single-choice) and `medical` (multi-select,
  // "None of these" a drawn row), and the sign-up beat lands between the plan and the country.
  // A stored v14 revision names screens and asks this shape cannot satisfy, so it falls back whole.
  // v16 (#1078): the activity question's three bands became four — 0 / 1–2 / 3–4 / 5+ — and `few`
  // moved from "0–2" to "1–2". A stored v15 labels the new `few` "0–2" and has no `none` at all,
  // so `usableContent` retires it and every language falls back to this. v17 (ieat-app#2050)
  // rewrites the welcome as a title and a subtitle — "A plan built around you" — over the photo.
  version: 19,
  welcome: {
    lines: ["Conta calorias com uma foto"],
    cta: "Começar",
    signin: "Já tenho uma conta",
  },
  screens: [
    {
      id: "goal",
      asks: {
        goal: { lines: ["O que queres alcançar?"] },
      },
      options: {
        lose: { label: "Perder peso" },
        maintain: { label: "Manter o peso" },
        gain: { label: "Ganhar peso" },
      },
    },
    {
      id: "sex",
      asks: {
        sex: { lines: ["Qual é o teu sexo?"] },
      },
      options: {
        male: { label: "Masculino" },
        female: { label: "Feminino" },
        other: { label: "Outro" },
      },
    },
    {
      id: "age",
      asks: {
        // Asked as an AGE and stored as a year — `checkNumber` in `onboarding-chat.ts` converts.
        birth_year: {
          lines: ["A tua idade?"],
          placeholder: "A tua idade",
        },
      },
    },
    {
      id: "height",
      asks: {
        height_cm: {
          lines: ["Altura"],
          placeholder: "Altura em cm",
        },
      },
    },
    {
      id: "weight",
      asks: {
        weight_kg: {
          lines: ["O teu peso"],
          placeholder: "Peso em kg",
        },
      },
    },
    {
      id: "activity",
      asks: {
        activity: {
          lines: ["Quão ativos são os teus dias?"],
        },
      },
      options: {
        // Targets v2/#1078: four levels id'd by their icons — the range is the label, the line
        // beneath is the hint.
        none: { label: "0", hint: "Sem treinos" },
        few: { label: "1–2", hint: "Treinos de vez em quando" },
        some: { label: "3–4", hint: "Alguns treinos por semana" },
        many: { label: "5+", hint: "Treino quase todos os dias" },
      },
    },
    {
      id: "target",
      asks: {
        target_weight_kg: {
          lines: ["Que peso queres atingir?"],
          placeholder: "Peso-alvo em kg",
        },
      },
    },
    {
      id: "pace",
      asks: {
        pace: { lines: ["A que ritmo?"] },
      },
      options: {
        easy: { label: "Leve" },
        steady: { label: "Constante" },
        push: { label: "Rápido" },
      },
    },
    {
      id: "counted",
      asks: { counted_before: { lines: ["Já contaste calorias?"] } },
      options: {
        never: { label: "Nunca" },
        stopped: { label: "Tentei, desisti" },
        onoff: { label: "De vez em quando" },
        now: { label: "Conto agora" },
      },
    },
    {
      id: "barrier",
      asks: {
        barriers: {
          lines: ["O que te fez parar?", "Escolhe tudo o que se aplica"],
          variants: {
            onoff: ["O que se meteu no caminho?", "Escolhe tudo o que se aplica"],
            now: ["O que gostarias que fosse mais fácil?", "Escolhe tudo o que se aplica"],
          },
        },
      },
      options: {
        too_long: { label: "Demorava demasiado" },
        forgot: { label: "Esquecia-me" },
        invisible: { label: "Não via resultados" },
        no_idea: { label: "Não sabia o que comer" },
        stressful: { label: "Era stressante" },
        nobody: { label: "Ninguém a quem perguntar" },
        creeping: { label: "O meu peso voltava a subir" },
        not_enough: { label: "Difícil comer o suficiente" },
      },
    },
    {
      id: "situation",
      asks: {
        situations: {
          lines: ["Quando é mais difícil registar?"],
          variants: { never: ["Quando achas que registar vai ser mais difícil?"] },
        },
      },
      options: {
        workdays: { label: "Dias de trabalho cheios" },
        eating_out: { label: "Comer fora" },
        cooking: { label: "Cozinhar para outros" },
        snacks: { label: "Snacks e bebidas" },
        evenings: { label: "Serões e fins de semana" },
      },
    },
    {
      id: "diet",
      asks: {
        diet: { lines: ["Segues alguma dieta?"] },
      },
      options: {
        balanced: { label: "Equilibrada" },
        wholefood: { label: "Alimentos integrais" },
        mediterranean: { label: "Mediterrânica" },
        flexitarian: { label: "Flexitariana" },
        pescatarian: { label: "Pescetariana" },
        vegetarian: { label: "Vegetariana" },
        vegan: { label: "Vegana" },
      },
    },
    {
      id: "medical",
      asks: {
        medical: { lines: ["Alguma restrição médica?"] },
      },
      options: {
        kidneys: { label: "Doença renal" },
        ldl: { label: "Colesterol alto" },
        lowsugar: { label: "Risco de diabetes" },
        none: { label: "Nenhuma destas" },
      },
    },
    {
      id: "country",
      asks: {
        country: { lines: ["Onde comes?"], placeholder: "Pesquisar" },
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
        other: { label: "Outro lugar" },
      },
    },
    {
      id: "streak",
      asks: {
        streak_goal_days: { lines: ["Escolhe uma sequência como objetivo"] },
      },
      options: {
        "7": { label: "7 dias" },
        "14": { label: "14 dias" },
        "30": { label: "30 dias" },
        "50": { label: "50 dias" },
      },
    },
  ],
  building: {
    lines: ["A criar o teu plano pessoal"],
    title: "O teu plano diário",
    rows: { calories: "Calorias", protein: "Proteína", carbs: "Hidratos", fat: "Gordura", diet: "Dieta" },
    limitCap: { ldl: "gordura saturada ≤ {n} g", kidneys: "sódio ≤ {n} mg" },
    cta: "Mostra-me o plano",
    floorTitle: "Parámos em {floor} kcal",
    floorBody: "As contas queriam ir mais abaixo. Não definimos alvos abaixo disto sem acompanhamento médico, por isso o teu fica aqui. Isso também vai aparecer no teu diário.",
  },
  summary: {
    lines: ["Aqui está o teu plano"],
    kcalLabel: "kcal por dia",
    floorMarker: "limitado por segurança · nunca abaixo de {floor}",
    macros: {
      protein: "Proteína",
      carbs: "Hidratos",
      fat: "Gordura",
      satfat: "Gordura saturada · a teu pedido",
    },
    capNote: "Esse ritmo exige uma mudança diária maior do que é seguro manter, por isso o teu é a versão segura: {share}% do que o teu corpo gasta num dia.",
    // R0 of the retention plan: onboarding ends with ONE unambiguous instruction, and the thing
    // being asked for is the first photo. "Start logging" points at a diary, which is an empty list
    // and a second decision.
    cta: "Fotografa a tua primeira refeição",
  },
};

const MS: OnboardingContent = {
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
  // Health, and a newer one moves the target on every surface, the browser included. v11 grows
  // the country question from four options to fifteen: it offered Germany, the UK, the US and
  // "Somewhere else" while the product shipped in eight languages, so a Vietnamese, Indonesian,
  // Italian, Spanish or Russian reader had exactly one true answer and it was the sentinel. The
  // labels left this file with it — a country's name is CLDR's, not an admin's. Bumped because a
  // funnel row for a four-chip screen and one for a fifteen-chip screen are not the same screen.
  // v12 is the v5 redesign's copy (issue #42): the age question asks "How old are you?" plainly,
  // and the activity options answer in plain frequencies — "A little each week" — rather than
  // effort labels. v13 (#50) drops 'No account needed to start.': the web asks for a sign-in
  // before the first question, and one content tree cannot say it on the phone only.
  // v14 is targets v2 (#81): the activity question's five levels became three — few/some/many —
  // and the sex question gained "other". A stored v13 revision carries neither, so the validator
  // retires it and every language falls back to this.
  //
  // v15 IS ONBOARDING V2 (#82): the conversation becomes Cal AI-shaped plain screens, one question
  // each — twelve screens where seven used to be, the struggles eight became five stored picks,
  // the restrictions screen split into `diet` (seven single-choice) and `medical` (multi-select,
  // "None of these" a drawn row), and the sign-up beat lands between the plan and the country.
  // A stored v14 revision names screens and asks this shape cannot satisfy, so it falls back whole.
  // v16 (#1078): the activity question's three bands became four — 0 / 1–2 / 3–4 / 5+ — and `few`
  // moved from "0–2" to "1–2". A stored v15 labels the new `few` "0–2" and has no `none` at all,
  // so `usableContent` retires it and every language falls back to this. v17 (ieat-app#2050)
  // rewrites the welcome as a title and a subtitle — "A plan built around you" — over the photo.
  version: 19,
  welcome: {
    lines: ["Kira kalori dengan gambar"],
    cta: "Mula",
    signin: "Saya sudah ada akaun",
  },
  screens: [
    {
      id: "goal",
      asks: {
        goal: { lines: ["Apa tujuan anda di sini?"] },
      },
      options: {
        lose: { label: "Turunkan berat badan" },
        maintain: { label: "Kekalkan berat saya" },
        gain: { label: "Naikkan berat badan" },
      },
    },
    {
      id: "sex",
      asks: {
        sex: { lines: ["Apakah jantina anda?"] },
      },
      options: {
        male: { label: "Lelaki" },
        female: { label: "Perempuan" },
        other: { label: "Lain-lain" },
      },
    },
    {
      id: "age",
      asks: {
        // Asked as an AGE and stored as a year — `checkNumber` in `onboarding-chat.ts` converts.
        birth_year: {
          lines: ["Umur anda?"],
          placeholder: "Umur anda",
        },
      },
    },
    {
      id: "height",
      asks: {
        height_cm: {
          lines: ["Ketinggian"],
          placeholder: "Tinggi dalam cm",
        },
      },
    },
    {
      id: "weight",
      asks: {
        weight_kg: {
          lines: ["Berat badan anda"],
          placeholder: "Berat dalam kg",
        },
      },
    },
    {
      id: "activity",
      asks: {
        activity: {
          lines: ["Seaktif mana hari-hari anda?"],
        },
      },
      options: {
        // Targets v2/#1078: four levels id'd by their icons — the range is the label, the line
        // beneath is the hint.
        none: { label: "0", hint: "Tiada senaman" },
        few: { label: "1–2", hint: "Senaman sekali-sekala" },
        some: { label: "3–4", hint: "Beberapa sesi senaman seminggu" },
        many: { label: "5+", hint: "Atlet tegar" },
      },
    },
    {
      id: "target",
      asks: {
        target_weight_kg: {
          lines: ["Berapa berat yang anda sasarkan?"],
          placeholder: "Berat matlamat dalam kg",
        },
      },
    },
    {
      id: "pace",
      asks: {
        pace: { lines: ["Berapa pantas?"] },
      },
      options: {
        easy: { label: "Santai" },
        steady: { label: "Sekata" },
        push: { label: "Pantas" },
      },
    },
    {
      id: "counted",
      asks: { counted_before: { lines: ["Pernahkah anda mengira kalori?"] } },
      options: {
        never: { label: "Tidak pernah" },
        stopped: { label: "Cuba, kemudian berhenti" },
        onoff: { label: "Kadang-kadang" },
        now: { label: "Saya masih mengira" },
      },
    },
    {
      id: "barrier",
      asks: {
        barriers: {
          lines: ["Apa yang membuatkan anda berhenti?", "Pilih semua yang sesuai"],
          variants: {
            onoff: ["Apa yang menghalang anda?", "Pilih semua yang sesuai"],
            now: ["Apa yang anda ingin permudahkan?", "Pilih semua yang sesuai"],
          },
        },
      },
      options: {
        too_long: { label: "Mengambil masa terlalu lama" },
        forgot: { label: "Saya terlupa" },
        invisible: { label: "Tiada hasil yang kelihatan" },
        no_idea: { label: "Tidak tahu mahu makan apa" },
        stressful: { label: "Terasa stres" },
        nobody: { label: "Tiada siapa untuk ditanya" },
        creeping: { label: "Berat badan saya kembali naik" },
        not_enough: { label: "Sukar untuk makan cukup" },
      },
    },
    {
      id: "situation",
      asks: {
        situations: {
          lines: ["Bilakah paling sukar untuk mencatat?"],
          variants: { never: ["Bilakah anda jangkakan paling sukar untuk mencatat?"] },
        },
      },
      options: {
        workdays: { label: "Hari bekerja yang sibuk" },
        eating_out: { label: "Makan di luar" },
        cooking: { label: "Memasak untuk orang lain" },
        snacks: { label: "Snek dan minuman" },
        evenings: { label: "Waktu petang dan hujung minggu" },
      },
    },
    {
      id: "diet",
      asks: {
        diet: { lines: ["Adakah anda mengikut sesuatu diet?"] },
      },
      options: {
        balanced: { label: "Seimbang" },
        wholefood: { label: "Makanan tidak diproses" },
        mediterranean: { label: "Mediterranean" },
        flexitarian: { label: "Fleksitarian" },
        pescatarian: { label: "Peskatarian" },
        vegetarian: { label: "Vegetarian" },
        vegan: { label: "Vegan" },
      },
    },
    {
      id: "medical",
      asks: {
        medical: { lines: ["Ada batasan perubatan?"] },
      },
      options: {
        kidneys: { label: "Penyakit buah pinggang" },
        ldl: { label: "Kolesterol tinggi" },
        lowsugar: { label: "Risiko diabetes" },
        none: { label: "Tiada antara ini" },
      },
    },
    {
      id: "country",
      asks: {
        country: { lines: ["Di mana anda makan?"], placeholder: "Cari" },
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
        other: { label: "Tempat lain" },
      },
    },
    {
      id: "streak",
      asks: {
        streak_goal_days: { lines: ["Pilih rentetan yang anda sasarkan"] },
      },
      options: {
        "7": { label: "7 hari" },
        "14": { label: "14 hari" },
        "30": { label: "30 hari" },
        "50": { label: "50 hari" },
      },
    },
  ],
  building: {
    lines: ["Membina pelan peribadi anda"],
    title: "Pelan harian anda",
    rows: { calories: "Kalori", protein: "Protein", carbs: "Karbohidrat", fat: "Lemak", diet: "Diet" },
    limitCap: { ldl: "lemak tepu ≤ {n} g", kidneys: "natrium ≤ {n} mg" },
    cta: "Tunjukkan pelan",
    floorTitle: "Kami berhenti pada {floor} kcal",
    floorBody: "Kiraan mahu pergi lebih rendah. Kami tidak menetapkan sasaran di bawah ini tanpa pengawasan perubatan, jadi di sinilah sasaran anda. Ia juga dinyatakan dalam diari anda.",
  },
  summary: {
    lines: ["Inilah pelan anda"],
    kcalLabel: "kcal sehari",
    floorMarker: "dihadkan demi keselamatan · tidak kurang daripada {floor}",
    macros: {
      protein: "Protein",
      carbs: "Karbohidrat",
      fat: "Lemak",
      satfat: "Lemak tepu · atas permintaan anda",
    },
    capNote: "Kadar itu memerlukan perubahan harian yang lebih besar daripada yang selamat untuk diteruskan, jadi anda mendapat versi selamat: {share}% daripada tenaga yang dibakar badan anda dalam sehari.",
    // R0 of the retention plan: onboarding ends with ONE unambiguous instruction, and the thing
    // being asked for is the first photo. "Start logging" points at a diary, which is an empty list
    // and a second decision.
    cta: "Ambil foto hidangan pertama anda",
  },
};

const CA: OnboardingContent = {
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
  // Health, and a newer one moves the target on every surface, the browser included. v11 grows
  // the country question from four options to fifteen: it offered Germany, the UK, the US and
  // "Somewhere else" while the product shipped in eight languages, so a Vietnamese, Indonesian,
  // Italian, Spanish or Russian reader had exactly one true answer and it was the sentinel. The
  // labels left this file with it — a country's name is CLDR's, not an admin's. Bumped because a
  // funnel row for a four-chip screen and one for a fifteen-chip screen are not the same screen.
  // v12 is the v5 redesign's copy (issue #42): the age question asks "How old are you?" plainly,
  // and the activity options answer in plain frequencies — "A little each week" — rather than
  // effort labels. v13 (#50) drops 'No account needed to start.': the web asks for a sign-in
  // before the first question, and one content tree cannot say it on the phone only.
  // v14 is targets v2 (#81): the activity question's five levels became three — few/some/many —
  // and the sex question gained "other". A stored v13 revision carries neither, so the validator
  // retires it and every language falls back to this.
  //
  // v15 IS ONBOARDING V2 (#82): the conversation becomes Cal AI-shaped plain screens, one question
  // each — twelve screens where seven used to be, the struggles eight became five stored picks,
  // the restrictions screen split into `diet` (seven single-choice) and `medical` (multi-select,
  // "None of these" a drawn row), and the sign-up beat lands between the plan and the country.
  // A stored v14 revision names screens and asks this shape cannot satisfy, so it falls back whole.
  // v16 (#1078): the activity question's three bands became four — 0 / 1–2 / 3–4 / 5+ — and `few`
  // moved from "0–2" to "1–2". A stored v15 labels the new `few` "0–2" and has no `none` at all,
  // so `usableContent` retires it and every language falls back to this. v17 (ieat-app#2050)
  // rewrites the welcome as a title and a subtitle — "A plan built around you" — over the photo.
  version: 19,
  welcome: {
    lines: ["Compta calories amb una foto"],
    cta: "Comença",
    signin: "Ja tinc un compte",
  },
  screens: [
    {
      id: "goal",
      asks: {
        goal: { lines: ["Què vols aconseguir?"] },
      },
      options: {
        lose: { label: "Baixar de pes" },
        maintain: { label: "Mantenir el pes" },
        gain: { label: "Pujar de pes" },
      },
    },
    {
      id: "sex",
      asks: {
        sex: { lines: ["Quin és el teu sexe?"] },
      },
      options: {
        male: { label: "Home" },
        female: { label: "Dona" },
        other: { label: "Altre" },
      },
    },
    {
      id: "age",
      asks: {
        // Asked as an AGE and stored as a year — `checkNumber` in `onboarding-chat.ts` converts.
        birth_year: {
          lines: ["La teva edat?"],
          placeholder: "La teva edat",
        },
      },
    },
    {
      id: "height",
      asks: {
        height_cm: {
          lines: ["Alçada"],
          placeholder: "Alçada en cm",
        },
      },
    },
    {
      id: "weight",
      asks: {
        weight_kg: {
          lines: ["El teu pes"],
          placeholder: "Pes en kg",
        },
      },
    },
    {
      id: "activity",
      asks: {
        activity: {
          lines: ["Com d'actius són els teus dies?"],
        },
      },
      options: {
        // Targets v2/#1078: four levels id'd by their icons — the range is the label, the line
        // beneath is the hint.
        none: { label: "0", hint: "Sense entrenaments" },
        few: { label: "1–2", hint: "Entrenaments de tant en tant" },
        some: { label: "3–4", hint: "Uns quants entrenaments per setmana" },
        many: { label: "5+", hint: "Esportista de debò" },
      },
    },
    {
      id: "target",
      asks: {
        target_weight_kg: {
          lines: ["A quin pes vols arribar?"],
          placeholder: "Pes objectiu en kg",
        },
      },
    },
    {
      id: "pace",
      asks: {
        pace: { lines: ["A quin ritme?"] },
      },
      options: {
        easy: { label: "Suau" },
        steady: { label: "Constant" },
        push: { label: "Ràpid" },
      },
    },
    {
      id: "counted",
      asks: { counted_before: { lines: ["Has comptat calories abans?"] } },
      options: {
        never: { label: "Mai" },
        stopped: { label: "Ho vaig provar, ho vaig deixar" },
        onoff: { label: "De tant en tant" },
        now: { label: "Les compto ara" },
      },
    },
    {
      id: "barrier",
      asks: {
        barriers: {
          lines: ["Què t'ha aturat?", "Tria tot el que encaixi"],
          variants: {
            onoff: ["Què s'hi va interposar?", "Tria tot el que encaixi"],
            now: ["Què voldries que fos més fàcil?", "Tria tot el que encaixi"],
          },
        },
      },
      options: {
        too_long: { label: "Em prenia massa temps" },
        forgot: { label: "Se m'oblidava" },
        invisible: { label: "No en veia els resultats" },
        no_idea: { label: "No sabia què menjar" },
        stressful: { label: "Em resultava estressant" },
        nobody: { label: "Ningú a qui preguntar" },
        creeping: { label: "El pes em tornava a pujar" },
        not_enough: { label: "Em costava menjar prou" },
      },
    },
    {
      id: "situation",
      asks: {
        situations: {
          lines: ["Quan costa més registrar?"],
          variants: { never: ["Quan creus que registrar serà més difícil?"] },
        },
      },
      options: {
        workdays: { label: "Dies de feina aferrissats" },
        eating_out: { label: "Menjar fora" },
        cooking: { label: "Cuinar per a altres" },
        snacks: { label: "Snacks i begudes" },
        evenings: { label: "Vespres i caps de setmana" },
      },
    },
    {
      id: "diet",
      asks: {
        diet: { lines: ["Segueixes alguna dieta?"] },
      },
      options: {
        balanced: { label: "Equilibrada" },
        wholefood: { label: "Aliments sense processar" },
        mediterranean: { label: "Mediterrània" },
        flexitarian: { label: "Flexitariana" },
        pescatarian: { label: "Pescetariana" },
        vegetarian: { label: "Vegetariana" },
        vegan: { label: "Vegana" },
      },
    },
    {
      id: "medical",
      asks: {
        medical: { lines: ["Alguna limitació mèdica?"] },
      },
      options: {
        kidneys: { label: "Malaltia renal" },
        ldl: { label: "Colesterol alt" },
        lowsugar: { label: "Risc de diabetis" },
        none: { label: "Cap d'aquestes" },
      },
    },
    {
      id: "country",
      asks: {
        country: { lines: ["On menges?"], placeholder: "Cerca" },
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
        other: { label: "En un altre lloc" },
      },
    },
    {
      id: "streak",
      asks: {
        streak_goal_days: { lines: ["Tria la ratxa que vols assolir"] },
      },
      options: {
        "7": { label: "7 dies" },
        "14": { label: "14 dies" },
        "30": { label: "30 dies" },
        "50": { label: "50 dies" },
      },
    },
  ],
  building: {
    lines: ["Estic creant el teu pla personal"],
    title: "El teu pla diari",
    rows: { calories: "Calories", protein: "Proteïna", carbs: "Carbohidrats", fat: "Greix", diet: "Dieta" },
    limitCap: { ldl: "greix saturat ≤ {n} g", kidneys: "sodi ≤ {n} mg" },
    cta: "Ensenya'm el pla",
    floorTitle: "Ens hem aturat a {floor} kcal",
    floorBody: "El càlcul volia baixar més. Sense supervisió mèdica no fixem objectius per sota d'aquest valor, així que el teu es queda aquí. El teu diari també ho indicarà.",
  },
  summary: {
    lines: ["Aquest és el teu pla"],
    kcalLabel: "kcal al dia",
    floorMarker: "limitat per seguretat · mai per sota de {floor}",
    macros: {
      protein: "Proteïna",
      carbs: "Carbohidrats",
      fat: "Greix",
      satfat: "Greix saturat · ho has demanat",
    },
    capNote: "Aquest ritme demana un canvi diari més gran del que és segur mantenir, així que el teu és la versió segura: el {share} % del que el teu cos crema en un dia.",
    // R0 of the retention plan: onboarding ends with ONE unambiguous instruction, and the thing
    // being asked for is the first photo. "Start logging" points at a diary, which is an empty list
    // and a second decision.
    cta: "Fotografia el teu primer àpat",
  },
};

const SL: OnboardingContent = {
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
  // Health, and a newer one moves the target on every surface, the browser included. v11 grows
  // the country question from four options to fifteen: it offered Germany, the UK, the US and
  // "Somewhere else" while the product shipped in eight languages, so a Vietnamese, Indonesian,
  // Italian, Spanish or Russian reader had exactly one true answer and it was the sentinel. The
  // labels left this file with it — a country's name is CLDR's, not an admin's. Bumped because a
  // funnel row for a four-chip screen and one for a fifteen-chip screen are not the same screen.
  // v12 is the v5 redesign's copy (issue #42): the age question asks "How old are you?" plainly,
  // and the activity options answer in plain frequencies — "A little each week" — rather than
  // effort labels. v13 (#50) drops 'No account needed to start.': the web asks for a sign-in
  // before the first question, and one content tree cannot say it on the phone only.
  // v14 is targets v2 (#81): the activity question's five levels became three — few/some/many —
  // and the sex question gained "other". A stored v13 revision carries neither, so the validator
  // retires it and every language falls back to this.
  //
  // v15 IS ONBOARDING V2 (#82): the conversation becomes Cal AI-shaped plain screens, one question
  // each — twelve screens where seven used to be, the struggles eight became five stored picks,
  // the restrictions screen split into `diet` (seven single-choice) and `medical` (multi-select,
  // "None of these" a drawn row), and the sign-up beat lands between the plan and the country.
  // A stored v14 revision names screens and asks this shape cannot satisfy, so it falls back whole.
  // v16 (#1078): the activity question's three bands became four — 0 / 1–2 / 3–4 / 5+ — and `few`
  // moved from "0–2" to "1–2". A stored v15 labels the new `few` "0–2" and has no `none` at all,
  // so `usableContent` retires it and every language falls back to this. v17 (ieat-app#2050)
  // rewrites the welcome as a title and a subtitle — "A plan built around you" — over the photo.
  version: 19,
  welcome: {
    lines: ["Štej kalorije s fotografijo"],
    cta: "Začni",
    signin: "Račun že imam",
  },
  screens: [
    {
      id: "goal",
      asks: {
        goal: { lines: ["Kaj želiš doseči?"] },
      },
      options: {
        lose: { label: "Izgubiti težo" },
        maintain: { label: "Ohraniti težo" },
        gain: { label: "Pridobiti težo" },
      },
    },
    {
      id: "sex",
      asks: {
        sex: { lines: ["Kakšen je tvoj spol?"] },
      },
      options: {
        male: { label: "Moški" },
        female: { label: "Ženski" },
        other: { label: "Drugo" },
      },
    },
    {
      id: "age",
      asks: {
        // Asked as an AGE and stored as a year — `checkNumber` in `onboarding-chat.ts` converts.
        birth_year: {
          lines: ["Tvoja starost?"],
          placeholder: "Tvoja starost",
        },
      },
    },
    {
      id: "height",
      asks: {
        height_cm: {
          lines: ["Višina"],
          placeholder: "Višina v cm",
        },
      },
    },
    {
      id: "weight",
      asks: {
        weight_kg: {
          lines: ["Tvoja teža"],
          placeholder: "Teža v kg",
        },
      },
    },
    {
      id: "activity",
      asks: {
        activity: {
          lines: ["Kako aktivni so tvoji dnevi?"],
        },
      },
      options: {
        // Targets v2/#1078: four levels id'd by their icons — the range is the label, the line
        // beneath is the hint.
        none: { label: "0", hint: "Brez vadbe" },
        few: { label: "1–2", hint: "Vadba občasno" },
        some: { label: "3–4", hint: "Nekaj vadb na teden" },
        many: { label: "5+", hint: "Vadba skoraj vsak dan" },
      },
    },
    {
      id: "target",
      asks: {
        target_weight_kg: {
          lines: ["Kakšno težo ciljaš?"],
          placeholder: "Ciljna teža v kg",
        },
      },
    },
    {
      id: "pace",
      asks: {
        pace: { lines: ["Kako hitro?"] },
      },
      options: {
        easy: { label: "Blag" },
        steady: { label: "Enakomeren" },
        push: { label: "Hiter" },
      },
    },
    {
      id: "counted",
      asks: { counted_before: { lines: ["Imaš izkušnje s štetjem kalorij?"] } },
      options: {
        never: { label: "Nikoli" },
        stopped: { label: "Prej ja, zdaj ne" },
        onoff: { label: "Kdaj pa kdaj" },
        now: { label: "Trenutno štejem" },
      },
    },
    {
      id: "barrier",
      asks: {
        barriers: {
          lines: ["Kaj te je ustavilo?", "Izberi vse, kar se ujema"],
          variants: {
            onoff: ["Kaj je prišlo vmes?", "Izberi vse, kar se ujema"],
            now: ["Kaj bi bilo lažje?", "Izberi vse, kar se ujema"],
          },
        },
      },
      options: {
        too_long: { label: "Vzelo je preveč časa" },
        forgot: { label: "Pozabljalo se mi je" },
        invisible: { label: "Rezultatov ni bilo videti" },
        no_idea: { label: "Ni bilo idej, kaj jesti" },
        stressful: { label: "Bilo je stresno" },
        nobody: { label: "Ni bilo koga vprašati" },
        creeping: { label: "Teža se je vračala" },
        not_enough: { label: "Težko je bilo pojesti dovolj" },
      },
    },
    {
      id: "situation",
      asks: {
        situations: {
          lines: ["Kdaj je beleženje najtežje?"],
          variants: { never: ["Kdaj misliš, da bo beleženje najtežje?"] },
        },
      },
      options: {
        workdays: { label: "Zasedeni delovniki" },
        eating_out: { label: "Prehranjevanje zunaj" },
        cooking: { label: "Kuhanje za druge" },
        snacks: { label: "Prigrizki in pijače" },
        evenings: { label: "Večeri in vikendi" },
      },
    },
    {
      id: "diet",
      asks: {
        diet: { lines: ["Ali slediš kakšni dieti?"] },
      },
      options: {
        balanced: { label: "Uravnotežena" },
        wholefood: { label: "Polnovredna" },
        mediterranean: { label: "Mediteranska" },
        flexitarian: { label: "Fleksitarijanska" },
        pescatarian: { label: "Peskatarijanska" },
        vegetarian: { label: "Vegetarijanska" },
        vegan: { label: "Veganska" },
      },
    },
    {
      id: "medical",
      asks: {
        medical: { lines: ["Kakšne zdravstvene omejitve?"] },
      },
      options: {
        kidneys: { label: "Bolezen ledvic" },
        ldl: { label: "Visok holesterol" },
        lowsugar: { label: "Tveganje za sladkorno bolezen" },
        none: { label: "Nič od tega" },
      },
    },
    {
      id: "country",
      asks: {
        country: { lines: ["Kje ješ?"], placeholder: "Iskanje" },
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
        other: { label: "Drugje" },
      },
    },
    {
      id: "streak",
      asks: {
        streak_goal_days: { lines: ["Izberi niz, ki ga želiš doseči"] },
      },
      options: {
        "7": { label: "7 dni" },
        "14": { label: "14 dni" },
        "30": { label: "30 dni" },
        "50": { label: "50 dni" },
      },
    },
  ],
  building: {
    lines: ["Pripravljam tvoj osebni načrt"],
    title: "Tvoj dnevni načrt",
    rows: { calories: "Kalorije", protein: "Beljakovine", carbs: "Ogljikovi hidrati", fat: "Maščobe", diet: "Dieta" },
    limitCap: { ldl: "nasičene maščobe ≤ {n} g", kidneys: "natrij ≤ {n} mg" },
    cta: "Pokaži mi načrt",
    floorTitle: "Ustavili smo se pri {floor} kcal",
    floorBody: "Izračun bi šel nižje. Brez zdravniškega nadzora ne nastavljamo ciljnih vrednosti pod to mejo, zato je tvoja tukaj. To bo pisalo tudi v tvojem dnevniku.",
  },
  summary: {
    lines: ["To je tvoj načrt"],
    kcalLabel: "kcal na dan",
    floorMarker: "omejeno zaradi varnosti · nikoli pod {floor}",
    macros: {
      protein: "Beljakovine",
      carbs: "Ogljikovi hidrati",
      fat: "Maščobe",
      satfat: "Nasičene maščobe · na tvojo željo",
    },
    capNote: "Ta tempo bi zahteval večjo dnevno spremembo, kot jo je varno vzdrževati, zato imaš varno različico: {share} % tega, kar tvoje telo porabi v enem dnevu.",
    // R0 of the retention plan: onboarding ends with ONE unambiguous instruction, and the thing
    // being asked for is the first photo. "Start logging" points at a diary, which is an empty list
    // and a second decision.
    cta: "Fotografiraj svoj prvi obrok",
  },
};

const HR: OnboardingContent = {
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
  // Health, and a newer one moves the target on every surface, the browser included. v11 grows
  // the country question from four options to fifteen: it offered Germany, the UK, the US and
  // "Somewhere else" while the product shipped in eight languages, so a Vietnamese, Indonesian,
  // Italian, Spanish or Russian reader had exactly one true answer and it was the sentinel. The
  // labels left this file with it — a country's name is CLDR's, not an admin's. Bumped because a
  // funnel row for a four-chip screen and one for a fifteen-chip screen are not the same screen.
  // v12 is the v5 redesign's copy (issue #42): the age question asks "How old are you?" plainly,
  // and the activity options answer in plain frequencies — "A little each week" — rather than
  // effort labels. v13 (#50) drops 'No account needed to start.': the web asks for a sign-in
  // before the first question, and one content tree cannot say it on the phone only.
  // v14 is targets v2 (#81): the activity question's five levels became three — few/some/many —
  // and the sex question gained "other". A stored v13 revision carries neither, so the validator
  // retires it and every language falls back to this.
  //
  // v15 IS ONBOARDING V2 (#82): the conversation becomes Cal AI-shaped plain screens, one question
  // each — twelve screens where seven used to be, the struggles eight became five stored picks,
  // the restrictions screen split into `diet` (seven single-choice) and `medical` (multi-select,
  // "None of these" a drawn row), and the sign-up beat lands between the plan and the country.
  // A stored v14 revision names screens and asks this shape cannot satisfy, so it falls back whole.
  // v16 (#1078): the activity question's three bands became four — 0 / 1–2 / 3–4 / 5+ — and `few`
  // moved from "0–2" to "1–2". A stored v15 labels the new `few` "0–2" and has no `none` at all,
  // so `usableContent` retires it and every language falls back to this. v17 (ieat-app#2050)
  // rewrites the welcome as a title and a subtitle — "A plan built around you" — over the photo.
  version: 19,
  welcome: {
    lines: ["Broji kalorije s fotografije"],
    cta: "Kreni",
    signin: "Već imam račun",
  },
  screens: [
    {
      id: "goal",
      asks: {
        goal: { lines: ["Što želiš postići?"] },
      },
      options: {
        lose: { label: "Smršaviti" },
        maintain: { label: "Zadržati težinu" },
        gain: { label: "Dobiti na težini" },
      },
    },
    {
      id: "sex",
      asks: {
        sex: { lines: ["Tvoj spol?"] },
      },
      options: {
        male: { label: "Muško" },
        female: { label: "Žensko" },
        other: { label: "Drugo" },
      },
    },
    {
      id: "age",
      asks: {
        // Asked as an AGE and stored as a year — `checkNumber` in `onboarding-chat.ts` converts.
        birth_year: {
          lines: ["Tvoja dob?"],
          placeholder: "Tvoja dob",
        },
      },
    },
    {
      id: "height",
      asks: {
        height_cm: {
          lines: ["Visina"],
          placeholder: "Visina u cm",
        },
      },
    },
    {
      id: "weight",
      asks: {
        weight_kg: {
          lines: ["Tvoja težina"],
          placeholder: "Težina u kg",
        },
      },
    },
    {
      id: "activity",
      asks: {
        activity: {
          lines: ["Koliko su aktivni tvoji dani?"],
        },
      },
      options: {
        // Targets v2/#1078: four levels id'd by their icons — the range is the label, the line
        // beneath is the hint.
        none: { label: "0", hint: "Bez treninga" },
        few: { label: "1–2", hint: "Trening tu i tamo" },
        some: { label: "3–4", hint: "Nekoliko treninga tjedno" },
        many: { label: "5+", hint: "Trening gotovo svaki dan" },
      },
    },
    {
      id: "target",
      asks: {
        target_weight_kg: {
          lines: ["Kojoj težini težiš?"],
          placeholder: "Ciljna težina u kg",
        },
      },
    },
    {
      id: "pace",
      asks: {
        pace: { lines: ["Kojim tempom?"] },
      },
      options: {
        easy: { label: "Blago" },
        steady: { label: "Ujednačeno" },
        push: { label: "Žustro" },
      },
    },
    {
      id: "counted",
      asks: { counted_before: { lines: ["Imaš li iskustva s brojanjem kalorija?"] } },
      options: {
        never: { label: "Nikad" },
        stopped: { label: "Ranije da, sada ne" },
        onoff: { label: "Povremeno" },
        now: { label: "Trenutno brojim" },
      },
    },
    {
      id: "barrier",
      asks: {
        barriers: {
          lines: ["Što te je zaustavilo?", "Odaberi sve što odgovara"],
          variants: {
            onoff: ["Što ti je smetalo?", "Odaberi sve što odgovara"],
            now: ["Što bi bilo lakše?", "Odaberi sve što odgovara"],
          },
        },
      },
      options: {
        too_long: { label: "Trajalo je predugo" },
        forgot: { label: "Zaboravljalo mi se" },
        invisible: { label: "Nisu se vidjeli rezultati" },
        no_idea: { label: "Nije bilo ideja što jesti" },
        stressful: { label: "Bilo je stresno" },
        nobody: { label: "Nije bilo koga pitati" },
        creeping: { label: "Težina se vraćala" },
        not_enough: { label: "Teško je bilo pojesti dovoljno" },
      },
    },
    {
      id: "situation",
      asks: {
        situations: {
          lines: ["Kada je bilježenje najteže?"],
          variants: { never: ["Kada misliš da će bilježenje biti najteže?"] },
        },
      },
      options: {
        workdays: { label: "Naporni radni dani" },
        eating_out: { label: "Jelo vani" },
        cooking: { label: "Kuhanje za druge" },
        snacks: { label: "Grickalice i pića" },
        evenings: { label: "Večeri i vikendi" },
      },
    },
    {
      id: "diet",
      asks: {
        diet: { lines: ["Držiš li se neke prehrane?"] },
      },
      options: {
        balanced: { label: "Uravnotežena" },
        wholefood: { label: "Cjelovita hrana" },
        mediterranean: { label: "Mediteranska" },
        flexitarian: { label: "Fleksitarijanska" },
        pescatarian: { label: "Peskatarijanska" },
        vegetarian: { label: "Vegetarijanska" },
        vegan: { label: "Veganska" },
      },
    },
    {
      id: "medical",
      asks: {
        medical: { lines: ["Imaš li zdravstvena ograničenja?"] },
      },
      options: {
        kidneys: { label: "Bolest bubrega" },
        ldl: { label: "Visok kolesterol" },
        lowsugar: { label: "Rizik od dijabetesa" },
        none: { label: "Ništa od navedenog" },
      },
    },
    {
      id: "country",
      asks: {
        country: { lines: ["Gdje jedeš?"], placeholder: "Traži" },
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
        other: { label: "Negdje drugdje" },
      },
    },
    {
      id: "streak",
      asks: {
        streak_goal_days: { lines: ["Odaberi niz kojem težiš"] },
      },
      options: {
        "7": { label: "7 dana" },
        "14": { label: "14 dana" },
        "30": { label: "30 dana" },
        "50": { label: "50 dana" },
      },
    },
  ],
  building: {
    lines: ["Izrađujemo tvoj osobni plan"],
    title: "Tvoj dnevni plan",
    rows: { calories: "Kalorije", protein: "Proteini", carbs: "Ugljikohidrati", fat: "Masti", diet: "Prehrana" },
    limitCap: { ldl: "zasićene masti ≤ {n} g", kidneys: "natrij ≤ {n} mg" },
    cta: "Pokaži mi plan",
    floorTitle: "Stali smo na {floor} kcal",
    floorBody: "Izračun je htio ići niže. Bez liječničkog nadzora ne postavljamo ciljeve ispod ovoga, pa je tvoj upravo ovdje. To će pisati i u tvom dnevniku.",
  },
  summary: {
    lines: ["Ovo je tvoj plan"],
    kcalLabel: "kcal dnevno",
    floorMarker: "ograničeno radi sigurnosti · nikad ispod {floor}",
    macros: {
      protein: "Proteini",
      carbs: "Ugljikohidrati",
      fat: "Masti",
      satfat: "Zasićene masti · na tvoj zahtjev",
    },
    capNote: "Taj tempo traži veću dnevnu promjenu nego što je sigurno održivo, pa dobivaš sigurnu verziju: {share}% onoga što tvoje tijelo potroši u danu.",
    // R0 of the retention plan: onboarding ends with ONE unambiguous instruction, and the thing
    // being asked for is the first photo. "Start logging" points at a diary, which is an empty list
    // and a second decision.
    cta: "Fotografiraj svoj prvi obrok",
  },
};

const SK: OnboardingContent = {
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
  // Health, and a newer one moves the target on every surface, the browser included. v11 grows
  // the country question from four options to fifteen: it offered Germany, the UK, the US and
  // "Somewhere else" while the product shipped in eight languages, so a Vietnamese, Indonesian,
  // Italian, Spanish or Russian reader had exactly one true answer and it was the sentinel. The
  // labels left this file with it — a country's name is CLDR's, not an admin's. Bumped because a
  // funnel row for a four-chip screen and one for a fifteen-chip screen are not the same screen.
  // v12 is the v5 redesign's copy (issue #42): the age question asks "How old are you?" plainly,
  // and the activity options answer in plain frequencies — "A little each week" — rather than
  // effort labels. v13 (#50) drops 'No account needed to start.': the web asks for a sign-in
  // before the first question, and one content tree cannot say it on the phone only.
  // v14 is targets v2 (#81): the activity question's five levels became three — few/some/many —
  // and the sex question gained "other". A stored v13 revision carries neither, so the validator
  // retires it and every language falls back to this.
  //
  // v15 IS ONBOARDING V2 (#82): the conversation becomes Cal AI-shaped plain screens, one question
  // each — twelve screens where seven used to be, the struggles eight became five stored picks,
  // the restrictions screen split into `diet` (seven single-choice) and `medical` (multi-select,
  // "None of these" a drawn row), and the sign-up beat lands between the plan and the country.
  // A stored v14 revision names screens and asks this shape cannot satisfy, so it falls back whole.
  // v16 (#1078): the activity question's three bands became four — 0 / 1–2 / 3–4 / 5+ — and `few`
  // moved from "0–2" to "1–2". A stored v15 labels the new `few` "0–2" and has no `none` at all,
  // so `usableContent` retires it and every language falls back to this. v17 (ieat-app#2050)
  // rewrites the welcome as a title and a subtitle — "A plan built around you" — over the photo.
  version: 19,
  welcome: {
    lines: ["Počítaj kalórie z fotky"],
    cta: "Začať",
    signin: "Už mám účet",
  },
  screens: [
    {
      id: "goal",
      asks: {
        goal: { lines: ["Čo tu chceš dosiahnuť?"] },
      },
      options: {
        lose: { label: "Schudnúť" },
        maintain: { label: "Udržať si váhu" },
        gain: { label: "Pribrať" },
      },
    },
    {
      id: "sex",
      asks: {
        sex: { lines: ["Aké je tvoje pohlavie?"] },
      },
      options: {
        male: { label: "Mužské" },
        female: { label: "Ženské" },
        other: { label: "Iné" },
      },
    },
    {
      id: "age",
      asks: {
        // Asked as an AGE and stored as a year — `checkNumber` in `onboarding-chat.ts` converts.
        birth_year: {
          lines: ["Tvoj vek?"],
          placeholder: "Tvoj vek",
        },
      },
    },
    {
      id: "height",
      asks: {
        height_cm: {
          lines: ["Výška"],
          placeholder: "Výška v cm",
        },
      },
    },
    {
      id: "weight",
      asks: {
        weight_kg: {
          lines: ["Tvoja váha"],
          placeholder: "Váha v kg",
        },
      },
    },
    {
      id: "activity",
      asks: {
        activity: {
          lines: ["Aké aktívne sú tvoje dni?"],
        },
      },
      options: {
        // Targets v2/#1078: four levels id'd by their icons — the range is the label, the line
        // beneath is the hint.
        none: { label: "0", hint: "Bez tréningov" },
        few: { label: "1–2", hint: "Tréningy občas" },
        some: { label: "3–4", hint: "Pár tréningov týždenne" },
        many: { label: "5+", hint: "Tréning takmer každý deň" },
      },
    },
    {
      id: "target",
      asks: {
        target_weight_kg: {
          lines: ["Akú váhu chceš dosiahnuť?"],
          placeholder: "Cieľová váha v kg",
        },
      },
    },
    {
      id: "pace",
      asks: {
        pace: { lines: ["Ako rýchlo?"] },
      },
      options: {
        easy: { label: "Pomaly" },
        steady: { label: "Stabilne" },
        push: { label: "Svižne" },
      },
    },
    {
      id: "counted",
      asks: { counted_before: { lines: ["Máš za sebou počítanie kalórií?"] } },
      options: {
        never: { label: "Nikdy" },
        stopped: { label: "Predtým áno, teraz nie" },
        onoff: { label: "S prestávkami" },
        now: { label: "Počítam teraz" },
      },
    },
    {
      id: "barrier",
      asks: {
        barriers: {
          lines: ["Čo ťa zastavilo?", "Vyber všetko, čo sedí"],
          variants: {
            onoff: ["Čo ti prekážalo?", "Vyber všetko, čo sedí"],
            now: ["Čo by malo byť jednoduchšie?", "Vyber všetko, čo sedí"],
          },
        },
      },
      options: {
        too_long: { label: "Trvalo to príliš dlho" },
        forgot: { label: "Zabúdalo sa mi" },
        invisible: { label: "Nebolo vidieť výsledky" },
        no_idea: { label: "Chýbali nápady, čo jesť" },
        stressful: { label: "Bolo to stresujúce" },
        nobody: { label: "Nebolo koho spýtať" },
        creeping: { label: "Váha sa vracala" },
        not_enough: { label: "Ťažké bolo zjesť dosť" },
      },
    },
    {
      id: "situation",
      asks: {
        situations: {
          lines: ["Kedy je zapisovanie najťažšie?"],
          variants: { never: ["Kedy myslíš, že zapisovanie bude najťažšie?"] },
        },
      },
      options: {
        workdays: { label: "Náročné pracovné dni" },
        eating_out: { label: "Jedlo vonku" },
        cooking: { label: "Varenie pre iných" },
        snacks: { label: "Občerstvenie a nápoje" },
        evenings: { label: "Večery a víkendy" },
      },
    },
    {
      id: "diet",
      asks: {
        diet: { lines: ["Držíš nejakú diétu?"] },
      },
      options: {
        balanced: { label: "Vyvážená" },
        wholefood: { label: "Nespracované potraviny" },
        mediterranean: { label: "Stredomorská" },
        flexitarian: { label: "Flexitariánska" },
        pescatarian: { label: "Pescetariánska" },
        vegetarian: { label: "Vegetariánska" },
        vegan: { label: "Vegánska" },
      },
    },
    {
      id: "medical",
      asks: {
        medical: { lines: ["Nejaké zdravotné obmedzenia?"] },
      },
      options: {
        kidneys: { label: "Ochorenie obličiek" },
        ldl: { label: "Vysoký cholesterol" },
        lowsugar: { label: "Riziko cukrovky" },
        none: { label: "Nič z toho" },
      },
    },
    {
      id: "country",
      asks: {
        country: { lines: ["Kde ješ?"], placeholder: "Hľadať" },
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
        other: { label: "Inde" },
      },
    },
    {
      id: "streak",
      asks: {
        streak_goal_days: { lines: ["Vyber si sériu, na ktorú sa zameriaš"] },
      },
      options: {
        "7": { label: "7 dní" },
        "14": { label: "14 dní" },
        "30": { label: "30 dní" },
        "50": { label: "50 dní" },
      },
    },
  ],
  building: {
    lines: ["Zostavujem tvoj osobný plán"],
    title: "Tvoj denný plán",
    rows: { calories: "Kalórie", protein: "Bielkoviny", carbs: "Sacharidy", fat: "Tuky", diet: "Diéta" },
    limitCap: { ldl: "nasýtené tuky ≤ {n} g", kidneys: "sodík ≤ {n} mg" },
    cta: "Ukáž mi plán",
    floorTitle: "Zastavili sme sa na {floor} kcal",
    floorBody: "Výpočet chcel ísť nižšie. Bez lekárskeho dohľadu nenastavujeme normy pod toto minimum, takže tvoj zostáva tu. Uvidíš to aj v denníku.",
  },
  summary: {
    lines: ["Tu je tvoj plán"],
    kcalLabel: "kcal denne",
    floorMarker: "obmedzené kvôli bezpečnosti · nikdy pod {floor}",
    macros: {
      protein: "Bielkoviny",
      carbs: "Sacharidy",
      fat: "Tuky",
      satfat: "Nasýtené tuky · na tvoju žiadosť",
    },
    capNote: "Toto tempo by si vyžadovalo väčšiu dennú zmenu, než je bezpečné dlhodobo udržať, preto máš bezpečnú verziu: {share} % z toho, čo tvoje telo spáli za deň.",
    // R0 of the retention plan: onboarding ends with ONE unambiguous instruction, and the thing
    // being asked for is the first photo. "Start logging" points at a diary, which is an empty list
    // and a second decision.
    cta: "Odfoť svoje prvé jedlo",
  },
};

const NO: OnboardingContent = {
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
  // Health, and a newer one moves the target on every surface, the browser included. v11 grows
  // the country question from four options to fifteen: it offered Germany, the UK, the US and
  // "Somewhere else" while the product shipped in eight languages, so a Vietnamese, Indonesian,
  // Italian, Spanish or Russian reader had exactly one true answer and it was the sentinel. The
  // labels left this file with it — a country's name is CLDR's, not an admin's. Bumped because a
  // funnel row for a four-chip screen and one for a fifteen-chip screen are not the same screen.
  // v12 is the v5 redesign's copy (issue #42): the age question asks "How old are you?" plainly,
  // and the activity options answer in plain frequencies — "A little each week" — rather than
  // effort labels. v13 (#50) drops 'No account needed to start.': the web asks for a sign-in
  // before the first question, and one content tree cannot say it on the phone only.
  // v14 is targets v2 (#81): the activity question's five levels became three — few/some/many —
  // and the sex question gained "other". A stored v13 revision carries neither, so the validator
  // retires it and every language falls back to this.
  //
  // v15 IS ONBOARDING V2 (#82): the conversation becomes Cal AI-shaped plain screens, one question
  // each — twelve screens where seven used to be, the struggles eight became five stored picks,
  // the restrictions screen split into `diet` (seven single-choice) and `medical` (multi-select,
  // "None of these" a drawn row), and the sign-up beat lands between the plan and the country.
  // A stored v14 revision names screens and asks this shape cannot satisfy, so it falls back whole.
  // v16 (#1078): the activity question's three bands became four — 0 / 1–2 / 3–4 / 5+ — and `few`
  // moved from "0–2" to "1–2". A stored v15 labels the new `few` "0–2" and has no `none` at all,
  // so `usableContent` retires it and every language falls back to this. v17 (ieat-app#2050)
  // rewrites the welcome as a title and a subtitle — "A plan built around you" — over the photo.
  version: 19,
  welcome: {
    lines: ["Tell kalorier med et bilde"],
    cta: "Start",
    signin: "Jeg har allerede en konto",
  },
  screens: [
    {
      id: "goal",
      asks: {
        goal: { lines: ["Hva vil du oppnå?"] },
      },
      options: {
        lose: { label: "Gå ned i vekt" },
        maintain: { label: "Holde vekten" },
        gain: { label: "Gå opp i vekt" },
      },
    },
    {
      id: "sex",
      asks: {
        sex: { lines: ["Hvilket kjønn har du?"] },
      },
      options: {
        male: { label: "Mann" },
        female: { label: "Kvinne" },
        other: { label: "Annet" },
      },
    },
    {
      id: "age",
      asks: {
        // Asked as an AGE and stored as a year — `checkNumber` in `onboarding-chat.ts` converts.
        birth_year: {
          lines: ["Alderen din?"],
          placeholder: "Alderen din",
        },
      },
    },
    {
      id: "height",
      asks: {
        height_cm: {
          lines: ["Høyde"],
          placeholder: "Høyde i cm",
        },
      },
    },
    {
      id: "weight",
      asks: {
        weight_kg: {
          lines: ["Vekten din"],
          placeholder: "Vekt i kg",
        },
      },
    },
    {
      id: "activity",
      asks: {
        activity: {
          lines: ["Hvor aktive er dagene dine?"],
        },
      },
      options: {
        // Targets v2/#1078: four levels id'd by their icons — the range is the label, the line
        // beneath is the hint.
        none: { label: "0", hint: "Ingen trening" },
        few: { label: "1–2", hint: "Trening av og til" },
        some: { label: "3–4", hint: "Noen treningsøkter i uken" },
        many: { label: "5+", hint: "Trener nesten daglig" },
      },
    },
    {
      id: "target",
      asks: {
        target_weight_kg: {
          lines: ["Hvilken vekt sikter du mot?"],
          placeholder: "Målvekt i kg",
        },
      },
    },
    {
      id: "pace",
      asks: {
        pace: { lines: ["Hvor fort?"] },
      },
      options: {
        easy: { label: "Rolig" },
        steady: { label: "Jevnt" },
        push: { label: "Raskt" },
      },
    },
    {
      id: "counted",
      asks: { counted_before: { lines: ["Telt kalorier før?"] } },
      options: {
        never: { label: "Aldri" },
        stopped: { label: "Prøvde, sluttet" },
        onoff: { label: "Av og til" },
        now: { label: "Jeg teller nå" },
      },
    },
    {
      id: "barrier",
      asks: {
        barriers: {
          lines: ["Hva fikk deg til å slutte?", "Velg alt som passer"],
          variants: {
            onoff: ["Hva kom i veien?", "Velg alt som passer"],
            now: ["Hva vil du skal være enklere?", "Velg alt som passer"],
          },
        },
      },
      options: {
        too_long: { label: "Det tok for lang tid" },
        forgot: { label: "Jeg glemte det" },
        invisible: { label: "Jeg så ikke at det virket" },
        no_idea: { label: "Jeg visste ikke hva jeg skulle spise" },
        stressful: { label: "Det føltes stressende" },
        nobody: { label: "Ingen å spørre" },
        creeping: { label: "Vekten krøp tilbake" },
        not_enough: { label: "Vanskelig å spise nok" },
      },
    },
    {
      id: "situation",
      asks: {
        situations: {
          lines: ["Når er det vanskeligst å logge?"],
          variants: { never: ["Når tror du det blir vanskeligst å logge?"] },
        },
      },
      options: {
        workdays: { label: "Travle hverdager" },
        eating_out: { label: "Spise ute" },
        cooking: { label: "Lage mat til andre" },
        snacks: { label: "Snacks og drikke" },
        evenings: { label: "Kvelder og helger" },
      },
    },
    {
      id: "diet",
      asks: {
        diet: { lines: ["Følger du et kosthold?"] },
      },
      options: {
        balanced: { label: "Balansert" },
        wholefood: { label: "Lite bearbeidet" },
        mediterranean: { label: "Middelhavskost" },
        flexitarian: { label: "Fleksitariansk" },
        pescatarian: { label: "Pescetariansk" },
        vegetarian: { label: "Vegetarisk" },
        vegan: { label: "Vegansk" },
      },
    },
    {
      id: "medical",
      asks: {
        medical: { lines: ["Noen medisinske begrensninger?"] },
      },
      options: {
        kidneys: { label: "Nyresykdom" },
        ldl: { label: "Høyt kolesterol" },
        lowsugar: { label: "Diabetesrisiko" },
        none: { label: "Ingen av disse" },
      },
    },
    {
      id: "country",
      asks: {
        country: { lines: ["Hvor spiser du?"], placeholder: "Søk" },
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
        other: { label: "Et annet sted" },
      },
    },
    {
      id: "streak",
      asks: {
        streak_goal_days: { lines: ["Velg en rekke å sikte mot"] },
      },
      options: {
        "7": { label: "7 dager" },
        "14": { label: "14 dager" },
        "30": { label: "30 dager" },
        "50": { label: "50 dager" },
      },
    },
  ],
  building: {
    lines: ["Lager den personlige planen din"],
    title: "Dagsplanen din",
    rows: { calories: "Kalorier", protein: "Protein", carbs: "Karbohydrater", fat: "Fett", diet: "Kosthold" },
    limitCap: { ldl: "mettet fett ≤ {n} g", kidneys: "natrium ≤ {n} mg" },
    cta: "Vis meg planen",
    floorTitle: "Vi stoppet på {floor} kcal",
    floorBody: "Regnestykket ville gå lavere. Vi setter ikke rammer under dette uten medisinsk oppfølging, så det er her din ligger. Det står også i dagboken din.",
  },
  summary: {
    lines: ["Her er planen din"],
    kcalLabel: "kcal om dagen",
    floorMarker: "begrenset av sikkerhetshensyn · aldri under {floor}",
    macros: {
      protein: "Protein",
      carbs: "Karbohydrater",
      fat: "Fett",
      satfat: "Mettet fett · du ba om det",
    },
    capNote: "Det tempoet krever en større daglig endring enn det er trygt å holde over tid, så du får den trygge versjonen: {share} % av det kroppen din forbrenner på en dag.",
    // R0 of the retention plan: onboarding ends with ONE unambiguous instruction, and the thing
    // being asked for is the first photo. "Start logging" points at a diary, which is an empty list
    // and a second decision.
    cta: "Ta bilde av ditt første måltid",
  },
};

const FI: OnboardingContent = {
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
  // Health, and a newer one moves the target on every surface, the browser included. v11 grows
  // the country question from four options to fifteen: it offered Germany, the UK, the US and
  // "Somewhere else" while the product shipped in eight languages, so a Vietnamese, Indonesian,
  // Italian, Spanish or Russian reader had exactly one true answer and it was the sentinel. The
  // labels left this file with it — a country's name is CLDR's, not an admin's. Bumped because a
  // funnel row for a four-chip screen and one for a fifteen-chip screen are not the same screen.
  // v12 is the v5 redesign's copy (issue #42): the age question asks "How old are you?" plainly,
  // and the activity options answer in plain frequencies — "A little each week" — rather than
  // effort labels. v13 (#50) drops 'No account needed to start.': the web asks for a sign-in
  // before the first question, and one content tree cannot say it on the phone only.
  // v14 is targets v2 (#81): the activity question's five levels became three — few/some/many —
  // and the sex question gained "other". A stored v13 revision carries neither, so the validator
  // retires it and every language falls back to this.
  //
  // v15 IS ONBOARDING V2 (#82): the conversation becomes Cal AI-shaped plain screens, one question
  // each — twelve screens where seven used to be, the struggles eight became five stored picks,
  // the restrictions screen split into `diet` (seven single-choice) and `medical` (multi-select,
  // "None of these" a drawn row), and the sign-up beat lands between the plan and the country.
  // A stored v14 revision names screens and asks this shape cannot satisfy, so it falls back whole.
  // v16 (#1078): the activity question's three bands became four — 0 / 1–2 / 3–4 / 5+ — and `few`
  // moved from "0–2" to "1–2". A stored v15 labels the new `few` "0–2" and has no `none` at all,
  // so `usableContent` retires it and every language falls back to this. v17 (ieat-app#2050)
  // rewrites the welcome as a title and a subtitle — "A plan built around you" — over the photo.
  version: 19,
  welcome: {
    lines: ["Laske kalorit kuvalla"],
    cta: "Aloita",
    signin: "Minulla on jo tili",
  },
  screens: [
    {
      id: "goal",
      asks: {
        goal: { lines: ["Mitä haluat saavuttaa?"] },
      },
      options: {
        lose: { label: "Pudottaa painoa" },
        maintain: { label: "Säilyttää painoni" },
        gain: { label: "Nostaa painoa" },
      },
    },
    {
      id: "sex",
      asks: {
        sex: { lines: ["Mikä on sukupuolesi?"] },
      },
      options: {
        male: { label: "Mies" },
        female: { label: "Nainen" },
        other: { label: "Muu" },
      },
    },
    {
      id: "age",
      asks: {
        // Asked as an AGE and stored as a year — `checkNumber` in `onboarding-chat.ts` converts.
        birth_year: {
          lines: ["Ikäsi?"],
          placeholder: "Ikäsi",
        },
      },
    },
    {
      id: "height",
      asks: {
        height_cm: {
          lines: ["Pituus"],
          placeholder: "Pituus, cm",
        },
      },
    },
    {
      id: "weight",
      asks: {
        weight_kg: {
          lines: ["Painosi"],
          placeholder: "Paino, kg",
        },
      },
    },
    {
      id: "activity",
      asks: {
        activity: {
          lines: ["Kuinka aktiivisia päiväsi ovat?"],
        },
      },
      options: {
        // Targets v2/#1078: four levels id'd by their icons — the range is the label, the line
        // beneath is the hint.
        none: { label: "0", hint: "Ei treenejä" },
        few: { label: "1–2", hint: "Treeniä silloin tällöin" },
        some: { label: "3–4", hint: "Muutama treeni viikossa" },
        many: { label: "5+", hint: "Omistautunut urheilija" },
      },
    },
    {
      id: "target",
      asks: {
        target_weight_kg: {
          lines: ["Mihin painoon tähtäät?"],
          placeholder: "Tavoitepaino, kg",
        },
      },
    },
    {
      id: "pace",
      asks: {
        pace: { lines: ["Kuinka nopeasti?"] },
      },
      options: {
        easy: { label: "Rauhallisesti" },
        steady: { label: "Tasaisesti" },
        push: { label: "Reippaasti" },
      },
    },
    {
      id: "counted",
      asks: { counted_before: { lines: ["Oletko laskenut kaloreja?"] } },
      options: {
        never: { label: "En koskaan" },
        stopped: { label: "Kokeilin, lopetin" },
        onoff: { label: "Silloin tällöin" },
        now: { label: "Lasken nykyään" },
      },
    },
    {
      id: "barrier",
      asks: {
        barriers: {
          lines: ["Mikä sai sinut lopettamaan?", "Valitse kaikki, jotka sopivat"],
          variants: {
            onoff: ["Mikä tuli väliin?", "Valitse kaikki, jotka sopivat"],
            now: ["Mitä haluaisit olevan helpompaa?", "Valitse kaikki, jotka sopivat"],
          },
        },
      },
      options: {
        too_long: { label: "Siihen meni liikaa aikaa" },
        forgot: { label: "Unohdin" },
        invisible: { label: "En nähnyt tuloksia" },
        no_idea: { label: "En tiennyt, mitä syödä" },
        stressful: { label: "Tuntui stressaavalta" },
        nobody: { label: "Ei ketään, keneltä kysyä" },
        creeping: { label: "Painoni hiipi takaisin" },
        not_enough: { label: "Vaikea syödä tarpeeksi" },
      },
    },
    {
      id: "situation",
      asks: {
        situations: {
          lines: ["Milloin kirjaaminen on vaikeinta?"],
          variants: { never: ["Milloin arvelet kirjaamisen olevan vaikeinta?"] },
        },
      },
      options: {
        workdays: { label: "Kiireiset työpäivät" },
        eating_out: { label: "Ravintolassa syöminen" },
        cooking: { label: "Muille kokkaaminen" },
        snacks: { label: "Välipalat ja juomat" },
        evenings: { label: "Illat ja viikonloput" },
      },
    },
    {
      id: "diet",
      asks: {
        diet: { lines: ["Noudatatko jotain ruokavaliota?"] },
      },
      options: {
        balanced: { label: "Monipuolinen" },
        wholefood: { label: "Prosessoimaton ruoka" },
        mediterranean: { label: "Välimerellinen" },
        flexitarian: { label: "Fleksitaristinen" },
        pescatarian: { label: "Pescovegetaristinen" },
        vegetarian: { label: "Kasvis" },
        vegan: { label: "Vegaaninen" },
      },
    },
    {
      id: "medical",
      asks: {
        medical: { lines: ["Onko lääketieteellisiä rajoitteita?"] },
      },
      options: {
        kidneys: { label: "Munuaissairaus" },
        ldl: { label: "Korkea kolesteroli" },
        lowsugar: { label: "Diabetesriski" },
        none: { label: "Ei mikään näistä" },
      },
    },
    {
      id: "country",
      asks: {
        country: { lines: ["Missä syöt?"], placeholder: "Hae" },
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
        other: { label: "Muualla" },
      },
    },
    {
      id: "streak",
      asks: {
        streak_goal_days: { lines: ["Valitse tavoiteputki"] },
      },
      options: {
        "7": { label: "7 päivää" },
        "14": { label: "14 päivää" },
        "30": { label: "30 päivää" },
        "50": { label: "50 päivää" },
      },
    },
  ],
  building: {
    lines: ["Teemme henkilökohtaista suunnitelmaasi"],
    title: "Päivittäinen suunnitelmasi",
    rows: { calories: "Kalorit", protein: "Proteiini", carbs: "Hiilihydraatit", fat: "Rasva", diet: "Ruokavalio" },
    limitCap: { ldl: "tyydyttynyt rasva ≤ {n} g", kidneys: "natrium ≤ {n} mg" },
    cta: "Näytä suunnitelma",
    floorTitle: "Pysähdyimme tähän: {floor} kcal",
    floorBody: "Laskelma olisi mennyt alemmas. Emme aseta tavoitetasoja tämän alle ilman lääkärin seurantaa, joten sinun tavoitetasosi on tässä. Se lukee myös päiväkirjassasi.",
  },
  summary: {
    lines: ["Tässä on suunnitelmasi"],
    kcalLabel: "kcal päivässä",
    floorMarker: "rajattu turvallisuuden vuoksi · ei koskaan alle {floor}",
    macros: {
      protein: "Proteiini",
      carbs: "Hiilihydraatit",
      fat: "Rasva",
      satfat: "Tyydyttynyt rasva · pyynnöstäsi",
    },
    capNote: "Tuo tahti vaatisi suuremman päivittäisen muutoksen kuin on turvallista ylläpitää, joten saat turvallisen version: {share} % siitä, mitä kehosi kuluttaa päivässä.",
    // R0 of the retention plan: onboarding ends with ONE unambiguous instruction, and the thing
    // being asked for is the first photo. "Start logging" points at a diary, which is an empty list
    // and a second decision.
    cta: "Kuvaa ensimmäinen ateriasi",
  },
};

const DA: OnboardingContent = {
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
  // Health, and a newer one moves the target on every surface, the browser included. v11 grows
  // the country question from four options to fifteen: it offered Germany, the UK, the US and
  // "Somewhere else" while the product shipped in eight languages, so a Vietnamese, Indonesian,
  // Italian, Spanish or Russian reader had exactly one true answer and it was the sentinel. The
  // labels left this file with it — a country's name is CLDR's, not an admin's. Bumped because a
  // funnel row for a four-chip screen and one for a fifteen-chip screen are not the same screen.
  // v12 is the v5 redesign's copy (issue #42): the age question asks "How old are you?" plainly,
  // and the activity options answer in plain frequencies — "A little each week" — rather than
  // effort labels. v13 (#50) drops 'No account needed to start.': the web asks for a sign-in
  // before the first question, and one content tree cannot say it on the phone only.
  // v14 is targets v2 (#81): the activity question's five levels became three — few/some/many —
  // and the sex question gained "other". A stored v13 revision carries neither, so the validator
  // retires it and every language falls back to this.
  //
  // v15 IS ONBOARDING V2 (#82): the conversation becomes Cal AI-shaped plain screens, one question
  // each — twelve screens where seven used to be, the struggles eight became five stored picks,
  // the restrictions screen split into `diet` (seven single-choice) and `medical` (multi-select,
  // "None of these" a drawn row), and the sign-up beat lands between the plan and the country.
  // A stored v14 revision names screens and asks this shape cannot satisfy, so it falls back whole.
  // v16 (#1078): the activity question's three bands became four — 0 / 1–2 / 3–4 / 5+ — and `few`
  // moved from "0–2" to "1–2". A stored v15 labels the new `few` "0–2" and has no `none` at all,
  // so `usableContent` retires it and every language falls back to this. v17 (ieat-app#2050)
  // rewrites the welcome as a title and a subtitle — "A plan built around you" — over the photo.
  version: 19,
  welcome: {
    lines: ["Tæl kalorier med et foto"],
    cta: "Start",
    signin: "Jeg har allerede en konto",
  },
  screens: [
    {
      id: "goal",
      asks: {
        goal: { lines: ["Hvad er du her for?"] },
      },
      options: {
        lose: { label: "Tabe mig" },
        maintain: { label: "Holde min vægt" },
        gain: { label: "Tage på" },
      },
    },
    {
      id: "sex",
      asks: {
        sex: { lines: ["Hvad er dit køn?"] },
      },
      options: {
        male: { label: "Mand" },
        female: { label: "Kvinde" },
        other: { label: "Andet" },
      },
    },
    {
      id: "age",
      asks: {
        // Asked as an AGE and stored as a year — `checkNumber` in `onboarding-chat.ts` converts.
        birth_year: {
          lines: ["Din alder?"],
          placeholder: "Din alder",
        },
      },
    },
    {
      id: "height",
      asks: {
        height_cm: {
          lines: ["Højde"],
          placeholder: "Højde i cm",
        },
      },
    },
    {
      id: "weight",
      asks: {
        weight_kg: {
          lines: ["Din vægt"],
          placeholder: "Vægt i kg",
        },
      },
    },
    {
      id: "activity",
      asks: {
        activity: {
          lines: ["Hvor aktive er dine dage?"],
        },
      },
      options: {
        // Targets v2/#1078: four levels id'd by their icons — the range is the label, the line
        // beneath is the hint.
        none: { label: "0", hint: "Ingen træning" },
        few: { label: "1–2", hint: "Træning en gang imellem" },
        some: { label: "3–4", hint: "Et par træningspas om ugen" },
        many: { label: "5+", hint: "Dedikeret atlet" },
      },
    },
    {
      id: "target",
      asks: {
        target_weight_kg: {
          lines: ["Hvilken vægt sigter du efter?"],
          placeholder: "Målvægt i kg",
        },
      },
    },
    {
      id: "pace",
      asks: {
        pace: { lines: ["Hvor hurtigt?"] },
      },
      options: {
        easy: { label: "Roligt" },
        steady: { label: "Jævnt" },
        push: { label: "Raskt" },
      },
    },
    {
      id: "counted",
      asks: { counted_before: { lines: ["Talt kalorier før?"] } },
      options: {
        never: { label: "Aldrig" },
        stopped: { label: "Prøvede, stoppede" },
        onoff: { label: "Af og til" },
        now: { label: "Jeg tæller nu" },
      },
    },
    {
      id: "barrier",
      asks: {
        barriers: {
          lines: ["Hvad fik dig til at stoppe?", "Vælg alt, der passer"],
          variants: {
            onoff: ["Hvad kom i vejen?", "Vælg alt, der passer"],
            now: ["Hvad vil du gerne have lettere?", "Vælg alt, der passer"],
          },
        },
      },
      options: {
        too_long: { label: "Det tog for lang tid" },
        forgot: { label: "Jeg glemte det" },
        invisible: { label: "Jeg så ikke, at det virkede" },
        no_idea: { label: "Jeg vidste ikke, hvad jeg skulle spise" },
        stressful: { label: "Det føltes stressende" },
        nobody: { label: "Ingen at spørge" },
        creeping: { label: "Min vægt krøb tilbage" },
        not_enough: { label: "Svært at spise nok" },
      },
    },
    {
      id: "situation",
      asks: {
        situations: {
          lines: ["Hvornår er det sværest at logge?"],
          variants: { never: ["Hvornår regner du med, at det er sværest at logge?"] },
        },
      },
      options: {
        workdays: { label: "Travle hverdage" },
        eating_out: { label: "Spise ude" },
        cooking: { label: "Lave mad til andre" },
        snacks: { label: "Snacks og drikke" },
        evenings: { label: "Aftener og weekender" },
      },
    },
    {
      id: "diet",
      asks: {
        diet: { lines: ["Følger du en bestemt kost?"] },
      },
      options: {
        balanced: { label: "Balanceret" },
        wholefood: { label: "Uforarbejdet" },
        mediterranean: { label: "Middelhavskost" },
        flexitarian: { label: "Fleksitarisk" },
        pescatarian: { label: "Pescetarisk" },
        vegetarian: { label: "Vegetarisk" },
        vegan: { label: "Vegansk" },
      },
    },
    {
      id: "medical",
      asks: {
        medical: { lines: ["Nogen medicinske begrænsninger?"] },
      },
      options: {
        kidneys: { label: "Nyresygdom" },
        ldl: { label: "Højt kolesterol" },
        lowsugar: { label: "Risiko for diabetes" },
        none: { label: "Ingen af disse" },
      },
    },
    {
      id: "country",
      asks: {
        country: { lines: ["Hvor spiser du?"], placeholder: "Søg" },
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
        other: { label: "Et andet sted" },
      },
    },
    {
      id: "streak",
      asks: {
        streak_goal_days: { lines: ["Vælg en stime at sigte efter"] },
      },
      options: {
        "7": { label: "7 dage" },
        "14": { label: "14 dage" },
        "30": { label: "30 dage" },
        "50": { label: "50 dage" },
      },
    },
  ],
  building: {
    lines: ["Bygger din personlige plan"],
    title: "Din dagsplan",
    rows: { calories: "Kalorier", protein: "Protein", carbs: "Kulhydrater", fat: "Fedt", diet: "Kost" },
    limitCap: { ldl: "mættet fedt ≤ {n} g", kidneys: "natrium ≤ {n} mg" },
    cta: "Vis mig planen",
    floorTitle: "Vi stoppede ved {floor} kcal",
    floorBody: "Regnestykket ville længere ned. Vi sætter ikke mål under dette uden lægelig opfølgning, så det er her, dit ligger. Det står også i din dagbog.",
  },
  summary: {
    lines: ["Her er din plan"],
    kcalLabel: "kcal om dagen",
    floorMarker: "begrænset af hensyn til sikkerheden · aldrig under {floor}",
    macros: {
      protein: "Protein",
      carbs: "Kulhydrater",
      fat: "Fedt",
      satfat: "Mættet fedt · du bad om det",
    },
    capNote: "Det tempo kræver en større daglig ændring, end det er sikkert at holde, så du får den sikre udgave: {share} % af det, din krop forbrænder på en dag.",
    // R0 of the retention plan: onboarding ends with ONE unambiguous instruction, and the thing
    // being asked for is the first photo. "Start logging" points at a diary, which is an empty list
    // and a second decision.
    cta: "Fotografér dit første måltid",
  },
};

const HU: OnboardingContent = {
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
  // Health, and a newer one moves the target on every surface, the browser included. v11 grows
  // the country question from four options to fifteen: it offered Germany, the UK, the US and
  // "Somewhere else" while the product shipped in eight languages, so a Vietnamese, Indonesian,
  // Italian, Spanish or Russian reader had exactly one true answer and it was the sentinel. The
  // labels left this file with it — a country's name is CLDR's, not an admin's. Bumped because a
  // funnel row for a four-chip screen and one for a fifteen-chip screen are not the same screen.
  // v12 is the v5 redesign's copy (issue #42): the age question asks "How old are you?" plainly,
  // and the activity options answer in plain frequencies — "A little each week" — rather than
  // effort labels. v13 (#50) drops 'No account needed to start.': the web asks for a sign-in
  // before the first question, and one content tree cannot say it on the phone only.
  // v14 is targets v2 (#81): the activity question's five levels became three — few/some/many —
  // and the sex question gained "other". A stored v13 revision carries neither, so the validator
  // retires it and every language falls back to this.
  //
  // v15 IS ONBOARDING V2 (#82): the conversation becomes Cal AI-shaped plain screens, one question
  // each — twelve screens where seven used to be, the struggles eight became five stored picks,
  // the restrictions screen split into `diet` (seven single-choice) and `medical` (multi-select,
  // "None of these" a drawn row), and the sign-up beat lands between the plan and the country.
  // A stored v14 revision names screens and asks this shape cannot satisfy, so it falls back whole.
  // v16 (#1078): the activity question's three bands became four — 0 / 1–2 / 3–4 / 5+ — and `few`
  // moved from "0–2" to "1–2". A stored v15 labels the new `few` "0–2" and has no `none` at all,
  // so `usableContent` retires it and every language falls back to this. v17 (ieat-app#2050)
  // rewrites the welcome as a title and a subtitle — "A plan built around you" — over the photo.
  version: 19,
  welcome: {
    lines: ["Számolj kalóriát egy fotóval"],
    cta: "Kezdés",
    signin: "Már van fiókom",
  },
  screens: [
    {
      id: "goal",
      asks: {
        goal: { lines: ["Mi a célod?"] },
      },
      options: {
        lose: { label: "Fogyás" },
        maintain: { label: "Testsúly megtartása" },
        gain: { label: "Súlygyarapítás" },
      },
    },
    {
      id: "sex",
      asks: {
        sex: { lines: ["Mi a nemed?"] },
      },
      options: {
        male: { label: "Férfi" },
        female: { label: "Nő" },
        other: { label: "Egyéb" },
      },
    },
    {
      id: "age",
      asks: {
        // Asked as an AGE and stored as a year — `checkNumber` in `onboarding-chat.ts` converts.
        birth_year: {
          lines: ["Életkorod?"],
          placeholder: "Életkorod",
        },
      },
    },
    {
      id: "height",
      asks: {
        height_cm: {
          lines: ["Magasság"],
          placeholder: "Magasság cm-ben",
        },
      },
    },
    {
      id: "weight",
      asks: {
        weight_kg: {
          lines: ["A súlyod"],
          placeholder: "Testsúly kg-ban",
        },
      },
    },
    {
      id: "activity",
      asks: {
        activity: {
          lines: ["Mennyire aktívak a napjaid?"],
        },
      },
      options: {
        // Targets v2/#1078: four levels id'd by their icons — the range is the label, the line
        // beneath is the hint.
        none: { label: "0", hint: "Nincs edzés" },
        few: { label: "1–2", hint: "Néha egy-egy edzés" },
        some: { label: "3–4", hint: "Heti néhány edzés" },
        many: { label: "5+", hint: "Elkötelezett sportoló" },
      },
    },
    {
      id: "target",
      asks: {
        target_weight_kg: {
          lines: ["Milyen testsúlyt szeretnél elérni?"],
          placeholder: "Célsúly kg-ban",
        },
      },
    },
    {
      id: "pace",
      asks: {
        pace: { lines: ["Milyen gyorsan?"] },
      },
      options: {
        easy: { label: "Kíméletes" },
        steady: { label: "Egyenletes" },
        push: { label: "Lendületes" },
      },
    },
    {
      id: "counted",
      asks: { counted_before: { lines: ["Számoltál már kalóriát?"] } },
      options: {
        never: { label: "Soha" },
        stopped: { label: "Próbáltam, abbahagytam" },
        onoff: { label: "Időnként" },
        now: { label: "Most is számolok" },
      },
    },
    {
      id: "barrier",
      asks: {
        barriers: {
          lines: ["Mi állított meg?", "Jelölj be mindent, ami igaz"],
          variants: {
            onoff: ["Mi jött közbe?", "Jelölj be mindent, ami igaz"],
            now: ["Mi legyen könnyebb?", "Jelölj be mindent, ami igaz"],
          },
        },
      },
      options: {
        too_long: { label: "Túl sokáig tartott" },
        forgot: { label: "Elfelejtettem" },
        invisible: { label: "Nem láttam, hogy működik" },
        no_idea: { label: "Nem tudtam, mit egyek" },
        stressful: { label: "Stresszes volt" },
        nobody: { label: "Nem volt kitől kérdezni" },
        creeping: { label: "A súlyom visszakúszott" },
        not_enough: { label: "Nehéz volt eleget enni" },
      },
    },
    {
      id: "situation",
      asks: {
        situations: {
          lines: ["Mikor a legnehezebb naplózni?"],
          variants: { never: ["Mikor lesz szerinted a legnehezebb naplózni?"] },
        },
      },
      options: {
        workdays: { label: "Zsúfolt munkanapok" },
        eating_out: { label: "Éttermi étkezés" },
        cooking: { label: "Másoknak főzés" },
        snacks: { label: "Nasik és italok" },
        evenings: { label: "Esték és hétvégék" },
      },
    },
    {
      id: "diet",
      asks: {
        diet: { lines: ["Követsz valamilyen étrendet?"] },
      },
      options: {
        balanced: { label: "Kiegyensúlyozott" },
        wholefood: { label: "Teljes értékű" },
        mediterranean: { label: "Mediterrán" },
        flexitarian: { label: "Flexitáriánus" },
        pescatarian: { label: "Pescetáriánus" },
        vegetarian: { label: "Vegetáriánus" },
        vegan: { label: "Vegán" },
      },
    },
    {
      id: "medical",
      asks: {
        medical: { lines: ["Van egészségügyi korlátozásod?"] },
      },
      options: {
        kidneys: { label: "Vesebetegség" },
        ldl: { label: "Magas koleszterin" },
        lowsugar: { label: "Cukorbetegség kockázata" },
        none: { label: "Egyik sem" },
      },
    },
    {
      id: "country",
      asks: {
        country: { lines: ["Hol eszel?"], placeholder: "Keresés" },
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
        other: { label: "Máshol" },
      },
    },
    {
      id: "streak",
      asks: {
        streak_goal_days: { lines: ["Milyen sorozatot tűzöl ki célul?"] },
      },
      options: {
        "7": { label: "7 nap" },
        "14": { label: "14 nap" },
        "30": { label: "30 nap" },
        "50": { label: "50 nap" },
      },
    },
  ],
  building: {
    lines: ["Készül a személyre szabott terved"],
    title: "A napi terved",
    rows: { calories: "Kalória", protein: "Fehérje", carbs: "Szénhidrát", fat: "Zsír", diet: "Étrend" },
    limitCap: { ldl: "telített zsír ≤ {n} g", kidneys: "nátrium ≤ {n} mg" },
    cta: "Mutasd a tervet",
    floorTitle: "{floor} kcal-nál megálltunk",
    floorBody: "A számítás lejjebb menne. Orvosi felügyelet nélkül nem állítunk be ennél alacsonyabb célt, ezért a tiéd itt áll meg. A naplódban is ez fog szerepelni.",
  },
  summary: {
    lines: ["Itt a terved"],
    kcalLabel: "kcal naponta",
    floorMarker: "biztonsági korlát · sosem megy {floor} alá",
    macros: {
      protein: "Fehérje",
      carbs: "Szénhidrát",
      fat: "Zsír",
      satfat: "Telített zsír · te kérted",
    },
    capNote: "Ez a tempó nagyobb napi változást igényelne, mint ami biztonságosan tartható, ezért a biztonságos változatot kapod: a tested napi energiafelhasználásának {share}%-át.",
    // R0 of the retention plan: onboarding ends with ONE unambiguous instruction, and the thing
    // being asked for is the first photo. "Start logging" points at a diary, which is an empty list
    // and a second decision.
    cta: "Fotózd le az első étkezésedet",
  },
};

const EL: OnboardingContent = {
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
  // Health, and a newer one moves the target on every surface, the browser included. v11 grows
  // the country question from four options to fifteen: it offered Germany, the UK, the US and
  // "Somewhere else" while the product shipped in eight languages, so a Vietnamese, Indonesian,
  // Italian, Spanish or Russian reader had exactly one true answer and it was the sentinel. The
  // labels left this file with it — a country's name is CLDR's, not an admin's. Bumped because a
  // funnel row for a four-chip screen and one for a fifteen-chip screen are not the same screen.
  // v12 is the v5 redesign's copy (issue #42): the age question asks "How old are you?" plainly,
  // and the activity options answer in plain frequencies — "A little each week" — rather than
  // effort labels. v13 (#50) drops 'No account needed to start.': the web asks for a sign-in
  // before the first question, and one content tree cannot say it on the phone only.
  // v14 is targets v2 (#81): the activity question's five levels became three — few/some/many —
  // and the sex question gained "other". A stored v13 revision carries neither, so the validator
  // retires it and every language falls back to this.
  //
  // v15 IS ONBOARDING V2 (#82): the conversation becomes Cal AI-shaped plain screens, one question
  // each — twelve screens where seven used to be, the struggles eight became five stored picks,
  // the restrictions screen split into `diet` (seven single-choice) and `medical` (multi-select,
  // "None of these" a drawn row), and the sign-up beat lands between the plan and the country.
  // A stored v14 revision names screens and asks this shape cannot satisfy, so it falls back whole.
  // v16 (#1078): the activity question's three bands became four — 0 / 1–2 / 3–4 / 5+ — and `few`
  // moved from "0–2" to "1–2". A stored v15 labels the new `few` "0–2" and has no `none` at all,
  // so `usableContent` retires it and every language falls back to this. v17 (ieat-app#2050)
  // rewrites the welcome as a title and a subtitle — "A plan built around you" — over the photo.
  version: 19,
  welcome: {
    lines: ["Μέτρα θερμίδες με μια φωτογραφία"],
    cta: "Ξεκίνα",
    signin: "Έχω ήδη λογαριασμό",
  },
  screens: [
    {
      id: "goal",
      asks: {
        goal: { lines: ["Τι θέλεις να πετύχεις;"] },
      },
      options: {
        lose: { label: "Απώλεια βάρους" },
        maintain: { label: "Διατήρηση βάρους" },
        gain: { label: "Αύξηση βάρους" },
      },
    },
    {
      id: "sex",
      asks: {
        sex: { lines: ["Ποιο είναι το φύλο σου;"] },
      },
      options: {
        male: { label: "Άνδρας" },
        female: { label: "Γυναίκα" },
        other: { label: "Άλλο" },
      },
    },
    {
      id: "age",
      asks: {
        // Asked as an AGE and stored as a year — `checkNumber` in `onboarding-chat.ts` converts.
        birth_year: {
          lines: ["Η ηλικία σου;"],
          placeholder: "Η ηλικία σου",
        },
      },
    },
    {
      id: "height",
      asks: {
        height_cm: {
          lines: ["Ύψος"],
          placeholder: "Ύψος σε cm",
        },
      },
    },
    {
      id: "weight",
      asks: {
        weight_kg: {
          lines: ["Το βάρος σου"],
          placeholder: "Βάρος σε kg",
        },
      },
    },
    {
      id: "activity",
      asks: {
        activity: {
          lines: ["Πόσο δραστήριες είναι οι μέρες σου;"],
        },
      },
      options: {
        // Targets v2/#1078: four levels id'd by their icons — the range is the label, the line
        // beneath is the hint.
        none: { label: "0", hint: "Καθόλου προπόνηση" },
        few: { label: "1–2", hint: "Προπόνηση πού και πού" },
        some: { label: "3–4", hint: "Μερικές προπονήσεις την εβδομάδα" },
        many: { label: "5+", hint: "Προπόνηση σχεδόν κάθε μέρα" },
      },
    },
    {
      id: "target",
      asks: {
        target_weight_kg: {
          lines: ["Σε ποιο βάρος στοχεύεις;"],
          placeholder: "Βάρος-στόχος σε kg",
        },
      },
    },
    {
      id: "pace",
      asks: {
        pace: { lines: ["Πόσο γρήγορα;"] },
      },
      options: {
        easy: { label: "Ήπια" },
        steady: { label: "Σταθερά" },
        push: { label: "Γρήγορα" },
      },
    },
    {
      id: "counted",
      asks: { counted_before: { lines: ["Έχεις μετρήσει θερμίδες;"] } },
      options: {
        never: { label: "Ποτέ" },
        stopped: { label: "Δοκίμασα, σταμάτησα" },
        onoff: { label: "Περιστασιακά" },
        now: { label: "Μετράω τώρα" },
      },
    },
    {
      id: "barrier",
      asks: {
        barriers: {
          lines: ["Τι σε σταμάτησε;", "Διάλεξε όσα ταιριάζουν"],
          variants: {
            onoff: ["Τι μπήκε εμπόδιο;", "Διάλεξε όσα ταιριάζουν"],
            now: ["Τι θα ήθελες πιο εύκολο;", "Διάλεξε όσα ταιριάζουν"],
          },
        },
      },
      options: {
        too_long: { label: "Έπαιρνε πολύ χρόνο" },
        forgot: { label: "Το ξεχνούσα" },
        invisible: { label: "Δεν έβλεπα να δουλεύει" },
        no_idea: { label: "Δεν ήξερα τι να φάω" },
        stressful: { label: "Ήταν αγχωτικό" },
        nobody: { label: "Κανέναν να ρωτήσω" },
        creeping: { label: "Το βάρος μου ξανά ανέβαινε" },
        not_enough: { label: "Δύσκολο να φάω αρκετά" },
      },
    },
    {
      id: "situation",
      asks: {
        situations: {
          lines: ["Πότε η καταγραφή είναι πιο δύσκολη;"],
          variants: { never: ["Πότε περιμένεις να είναι πιο δύσκολη η καταγραφή;"] },
        },
      },
      options: {
        workdays: { label: "Φορτωμένες εργάσιμες" },
        eating_out: { label: "Φαγητό έξω" },
        cooking: { label: "Μαγείρεμα για άλλους" },
        snacks: { label: "Σνακ και ποτά" },
        evenings: { label: "Βράδια και Σαββατοκύριακα" },
      },
    },
    {
      id: "diet",
      asks: {
        diet: { lines: ["Ακολουθείς κάποια διατροφή;"] },
      },
      options: {
        balanced: { label: "Ισορροπημένη" },
        wholefood: { label: "Ανεπεξέργαστη" },
        mediterranean: { label: "Μεσογειακή" },
        flexitarian: { label: "Φλεξιταριανή" },
        pescatarian: { label: "Πεσκεταριανή" },
        vegetarian: { label: "Χορτοφαγική" },
        vegan: { label: "Βίγκαν" },
      },
    },
    {
      id: "medical",
      asks: {
        medical: { lines: ["Κάποιοι ιατρικοί περιορισμοί;"] },
      },
      options: {
        kidneys: { label: "Πάθηση νεφρών" },
        ldl: { label: "Υψηλή χοληστερίνη" },
        lowsugar: { label: "Κίνδυνος διαβήτη" },
        none: { label: "Τίποτα από αυτά" },
      },
    },
    {
      id: "country",
      asks: {
        country: { lines: ["Πού τρως;"], placeholder: "Αναζήτηση" },
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
        other: { label: "Κάπου αλλού" },
      },
    },
    {
      id: "streak",
      asks: {
        streak_goal_days: { lines: ["Διάλεξε ένα σερί να κυνηγήσεις"] },
      },
      options: {
        "7": { label: "7 ημέρες" },
        "14": { label: "14 ημέρες" },
        "30": { label: "30 ημέρες" },
        "50": { label: "50 ημέρες" },
      },
    },
  ],
  building: {
    lines: ["Φτιάχνουμε το προσωπικό σου πλάνο"],
    title: "Το ημερήσιο πλάνο σου",
    rows: { calories: "Θερμίδες", protein: "Πρωτεΐνη", carbs: "Υδατάνθρακες", fat: "Λιπαρά", diet: "Διατροφή" },
    limitCap: { ldl: "κορεσμένα λιπαρά ≤ {n} g", kidneys: "νάτριο ≤ {n} mg" },
    cta: "Δείξε μου το πλάνο",
    floorTitle: "Σταματήσαμε στις {floor} kcal",
    floorBody: "Ο υπολογισμός ήθελε να πάει πιο χαμηλά. Δεν ορίζουμε στόχους κάτω από αυτό χωρίς ιατρική παρακολούθηση, οπότε εδώ μένει ο δικός σου. Θα το γράφει και στο ημερολόγιό σου.",
  },
  summary: {
    lines: ["Αυτό είναι το πλάνο σου"],
    kcalLabel: "kcal την ημέρα",
    floorMarker: "περιορισμένο για ασφάλεια · ποτέ κάτω από {floor}",
    macros: {
      protein: "Πρωτεΐνη",
      carbs: "Υδατάνθρακες",
      fat: "Λιπαρά",
      satfat: "Κορεσμένα λιπαρά · το ζήτησες",
    },
    capNote: "Αυτός ο ρυθμός θέλει μεγαλύτερη ημερήσια αλλαγή απ' όση είναι ασφαλές να διατηρηθεί, οπότε ο δικός σου είναι η ασφαλής εκδοχή: {share}% από όσα καίει το σώμα σου σε μια μέρα.",
    // R0 of the retention plan: onboarding ends with ONE unambiguous instruction, and the thing
    // being asked for is the first photo. "Start logging" points at a diary, which is an empty list
    // and a second decision.
    cta: "Φωτογράφισε το πρώτο σου γεύμα",
  },
};

const RO: OnboardingContent = {
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
  // Health, and a newer one moves the target on every surface, the browser included. v11 grows
  // the country question from four options to fifteen: it offered Germany, the UK, the US and
  // "Somewhere else" while the product shipped in eight languages, so a Vietnamese, Indonesian,
  // Italian, Spanish or Russian reader had exactly one true answer and it was the sentinel. The
  // labels left this file with it — a country's name is CLDR's, not an admin's. Bumped because a
  // funnel row for a four-chip screen and one for a fifteen-chip screen are not the same screen.
  // v12 is the v5 redesign's copy (issue #42): the age question asks "How old are you?" plainly,
  // and the activity options answer in plain frequencies — "A little each week" — rather than
  // effort labels. v13 (#50) drops 'No account needed to start.': the web asks for a sign-in
  // before the first question, and one content tree cannot say it on the phone only.
  // v14 is targets v2 (#81): the activity question's five levels became three — few/some/many —
  // and the sex question gained "other". A stored v13 revision carries neither, so the validator
  // retires it and every language falls back to this.
  //
  // v15 IS ONBOARDING V2 (#82): the conversation becomes Cal AI-shaped plain screens, one question
  // each — twelve screens where seven used to be, the struggles eight became five stored picks,
  // the restrictions screen split into `diet` (seven single-choice) and `medical` (multi-select,
  // "None of these" a drawn row), and the sign-up beat lands between the plan and the country.
  // A stored v14 revision names screens and asks this shape cannot satisfy, so it falls back whole.
  // v16 (#1078): the activity question's three bands became four — 0 / 1–2 / 3–4 / 5+ — and `few`
  // moved from "0–2" to "1–2". A stored v15 labels the new `few` "0–2" and has no `none` at all,
  // so `usableContent` retires it and every language falls back to this. v17 (ieat-app#2050)
  // rewrites the welcome as a title and a subtitle — "A plan built around you" — over the photo.
  version: 19,
  welcome: {
    lines: ["Numără caloriile cu o poză"],
    cta: "Începe",
    signin: "Am deja un cont",
  },
  screens: [
    {
      id: "goal",
      asks: {
        goal: { lines: ["Ce vrei să obții?"] },
      },
      options: {
        lose: { label: "Să slăbesc" },
        maintain: { label: "Să-mi mențin greutatea" },
        gain: { label: "Să iau în greutate" },
      },
    },
    {
      id: "sex",
      asks: {
        sex: { lines: ["Care e sexul tău?"] },
      },
      options: {
        male: { label: "Masculin" },
        female: { label: "Feminin" },
        other: { label: "Altul" },
      },
    },
    {
      id: "age",
      asks: {
        // Asked as an AGE and stored as a year — `checkNumber` in `onboarding-chat.ts` converts.
        birth_year: {
          lines: ["Vârsta ta?"],
          placeholder: "Vârsta ta",
        },
      },
    },
    {
      id: "height",
      asks: {
        height_cm: {
          lines: ["Înălțime"],
          placeholder: "Înălțimea în cm",
        },
      },
    },
    {
      id: "weight",
      asks: {
        weight_kg: {
          lines: ["Greutatea ta"],
          placeholder: "Greutatea în kg",
        },
      },
    },
    {
      id: "activity",
      asks: {
        activity: {
          lines: ["Cât de active sunt zilele tale?"],
        },
      },
      options: {
        // Targets v2/#1078: four levels id'd by their icons — the range is the label, the line
        // beneath is the hint.
        none: { label: "0", hint: "Fără antrenamente" },
        few: { label: "1–2", hint: "Antrenamente din când în când" },
        some: { label: "3–4", hint: "Câteva antrenamente pe săptămână" },
        many: { label: "5+", hint: "Antrenament aproape zilnic" },
      },
    },
    {
      id: "target",
      asks: {
        target_weight_kg: {
          lines: ["Ce greutate îți propui?"],
          placeholder: "Greutatea țintă în kg",
        },
      },
    },
    {
      id: "pace",
      asks: {
        pace: { lines: ["Cât de repede?"] },
      },
      options: {
        easy: { label: "Lejer" },
        steady: { label: "Constant" },
        push: { label: "Alert" },
      },
    },
    {
      id: "counted",
      asks: { counted_before: { lines: ["Ai mai numărat calorii?"] } },
      options: {
        never: { label: "Niciodată" },
        stopped: { label: "Am încercat, m-am oprit" },
        onoff: { label: "Din când în când" },
        now: { label: "Număr acum" },
      },
    },
    {
      id: "barrier",
      asks: {
        barriers: {
          lines: ["Ce te-a oprit?", "Alege tot ce se potrivește"],
          variants: {
            onoff: ["Ce ți-a stat în cale?", "Alege tot ce se potrivește"],
            now: ["Ce ai vrea să fie mai ușor?", "Alege tot ce se potrivește"],
          },
        },
      },
      options: {
        too_long: { label: "Dura prea mult" },
        forgot: { label: "Uitam" },
        invisible: { label: "Nu vedeam rezultate" },
        no_idea: { label: "Nu știam ce să mănânc" },
        stressful: { label: "Era stresant" },
        nobody: { label: "Nu aveam pe cine să întreb" },
        creeping: { label: "Greutatea mea tot revenea" },
        not_enough: { label: "Greu să mănânc suficient" },
      },
    },
    {
      id: "situation",
      asks: {
        situations: {
          lines: ["Când e cel mai greu să notezi?"],
          variants: { never: ["Când te aștepți să fie cel mai greu să notezi?"] },
        },
      },
      options: {
        workdays: { label: "Zile lucrătoare aglomerate" },
        eating_out: { label: "Mese în oraș" },
        cooking: { label: "Gătit pentru alții" },
        snacks: { label: "Gustări și băuturi" },
        evenings: { label: "Seri și weekenduri" },
      },
    },
    {
      id: "diet",
      asks: {
        diet: { lines: ["Urmezi o dietă?"] },
      },
      options: {
        balanced: { label: "Echilibrată" },
        wholefood: { label: "Alimente integrale" },
        mediterranean: { label: "Mediteraneeană" },
        flexitarian: { label: "Flexitariană" },
        pescatarian: { label: "Pescetariană" },
        vegetarian: { label: "Vegetariană" },
        vegan: { label: "Vegană" },
      },
    },
    {
      id: "medical",
      asks: {
        medical: { lines: ["Ai limitări medicale?"] },
      },
      options: {
        kidneys: { label: "Afecțiune renală" },
        ldl: { label: "Colesterol ridicat" },
        lowsugar: { label: "Risc de diabet" },
        none: { label: "Niciuna dintre acestea" },
      },
    },
    {
      id: "country",
      asks: {
        country: { lines: ["Unde mănânci?"], placeholder: "Caută" },
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
        other: { label: "Altundeva" },
      },
    },
    {
      id: "streak",
      asks: {
        streak_goal_days: { lines: ["Ce serie îți propui?"] },
      },
      options: {
        "7": { label: "7 zile" },
        "14": { label: "14 zile" },
        "30": { label: "30 de zile" },
        "50": { label: "50 de zile" },
      },
    },
  ],
  building: {
    lines: ["Îți construim planul personal"],
    title: "Planul tău zilnic",
    rows: { calories: "Calorii", protein: "Proteine", carbs: "Carbohidrați", fat: "Grăsimi", diet: "Dietă" },
    limitCap: { ldl: "grăsimi saturate ≤ {n} g", kidneys: "sodiu ≤ {n} mg" },
    cta: "Arată-mi planul",
    floorTitle: "Ne-am oprit la {floor} kcal",
    floorBody: "Calculul voia să coboare mai jos. Nu stabilim ținte sub acest nivel fără supraveghere medicală, așa că aici rămâne a ta. Scrie asta și în jurnalul tău.",
  },
  summary: {
    lines: ["Iată planul tău"],
    kcalLabel: "kcal pe zi",
    floorMarker: "limitat pentru siguranță · niciodată sub {floor}",
    macros: {
      protein: "Proteine",
      carbs: "Carbohidrați",
      fat: "Grăsimi",
      satfat: "Grăsimi saturate · la cererea ta",
    },
    capNote: "Ritmul acesta ar cere o schimbare zilnică mai mare decât poate fi menținută în siguranță, așa că primești varianta sigură: {share}% din ce arde corpul tău într-o zi.",
    // R0 of the retention plan: onboarding ends with ONE unambiguous instruction, and the thing
    // being asked for is the first photo. "Start logging" points at a diary, which is an empty list
    // and a second decision.
    cta: "Fotografiază prima ta masă",
  },
};

const CS: OnboardingContent = {
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
  // Health, and a newer one moves the target on every surface, the browser included. v11 grows
  // the country question from four options to fifteen: it offered Germany, the UK, the US and
  // "Somewhere else" while the product shipped in eight languages, so a Vietnamese, Indonesian,
  // Italian, Spanish or Russian reader had exactly one true answer and it was the sentinel. The
  // labels left this file with it — a country's name is CLDR's, not an admin's. Bumped because a
  // funnel row for a four-chip screen and one for a fifteen-chip screen are not the same screen.
  // v12 is the v5 redesign's copy (issue #42): the age question asks "How old are you?" plainly,
  // and the activity options answer in plain frequencies — "A little each week" — rather than
  // effort labels. v13 (#50) drops 'No account needed to start.': the web asks for a sign-in
  // before the first question, and one content tree cannot say it on the phone only.
  // v14 is targets v2 (#81): the activity question's five levels became three — few/some/many —
  // and the sex question gained "other". A stored v13 revision carries neither, so the validator
  // retires it and every language falls back to this.
  //
  // v15 IS ONBOARDING V2 (#82): the conversation becomes Cal AI-shaped plain screens, one question
  // each — twelve screens where seven used to be, the struggles eight became five stored picks,
  // the restrictions screen split into `diet` (seven single-choice) and `medical` (multi-select,
  // "None of these" a drawn row), and the sign-up beat lands between the plan and the country.
  // A stored v14 revision names screens and asks this shape cannot satisfy, so it falls back whole.
  // v16 (#1078): the activity question's three bands became four — 0 / 1–2 / 3–4 / 5+ — and `few`
  // moved from "0–2" to "1–2". A stored v15 labels the new `few` "0–2" and has no `none` at all,
  // so `usableContent` retires it and every language falls back to this. v17 (ieat-app#2050)
  // rewrites the welcome as a title and a subtitle — "A plan built around you" — over the photo.
  version: 19,
  welcome: {
    lines: ["Počítej kalorie z fotky"],
    cta: "Začít",
    signin: "Už mám účet",
  },
  screens: [
    {
      id: "goal",
      asks: {
        goal: { lines: ["Co je tvůj cíl?"] },
      },
      options: {
        lose: { label: "Zhubnout" },
        maintain: { label: "Udržet váhu" },
        gain: { label: "Přibrat" },
      },
    },
    {
      id: "sex",
      asks: {
        sex: { lines: ["Jaké je tvoje pohlaví?"] },
      },
      options: {
        male: { label: "Muž" },
        female: { label: "Žena" },
        other: { label: "Jiné" },
      },
    },
    {
      id: "age",
      asks: {
        // Asked as an AGE and stored as a year — `checkNumber` in `onboarding-chat.ts` converts.
        birth_year: {
          lines: ["Tvůj věk?"],
          placeholder: "Tvůj věk",
        },
      },
    },
    {
      id: "height",
      asks: {
        height_cm: {
          lines: ["Výška"],
          placeholder: "Výška v cm",
        },
      },
    },
    {
      id: "weight",
      asks: {
        weight_kg: {
          lines: ["Tvoje váha"],
          placeholder: "Váha v kg",
        },
      },
    },
    {
      id: "activity",
      asks: {
        activity: {
          lines: ["Jak aktivní jsou tvoje dny?"],
        },
      },
      options: {
        // Targets v2/#1078: four levels id'd by their icons — the range is the label, the line
        // beneath is the hint.
        none: { label: "0", hint: "Bez tréninků" },
        few: { label: "1–2", hint: "Občas nějaký trénink" },
        some: { label: "3–4", hint: "Pár tréninků týdně" },
        many: { label: "5+", hint: "Trénink skoro denně" },
      },
    },
    {
      id: "target",
      asks: {
        target_weight_kg: {
          lines: ["Na jakou váhu míříš?"],
          placeholder: "Cílová váha v kg",
        },
      },
    },
    {
      id: "pace",
      asks: {
        pace: { lines: ["Jak rychle?"] },
      },
      options: {
        easy: { label: "Mírně" },
        steady: { label: "Vyrovnaně" },
        push: { label: "Svižně" },
      },
    },
    {
      id: "counted",
      asks: { counted_before: { lines: ["Máš zkušenost s počítáním kalorií?"] } },
      options: {
        never: { label: "Nikdy" },
        stopped: { label: "Dřív jo, teď ne" },
        onoff: { label: "S přestávkami" },
        now: { label: "Počítám teď" },
      },
    },
    {
      id: "barrier",
      asks: {
        barriers: {
          lines: ["Co tě zastavilo?", "Vyber všechno, co sedí"],
          variants: {
            onoff: ["Co ti překáželo?", "Vyber všechno, co sedí"],
            now: ["Co by mělo být jednodušší?", "Vyber všechno, co sedí"],
          },
        },
      },
      options: {
        too_long: { label: "Trvalo to moc dlouho" },
        forgot: { label: "Zapomínalo se mi" },
        invisible: { label: "Nebylo vidět výsledky" },
        no_idea: { label: "Chyběly nápady, co jíst" },
        stressful: { label: "Bylo to stresující" },
        nobody: { label: "Nebylo koho se zeptat" },
        creeping: { label: "Váha se vracela" },
        not_enough: { label: "Těžké bylo sníst dost" },
      },
    },
    {
      id: "situation",
      asks: {
        situations: {
          lines: ["Kdy je zapisování nejtěžší?"],
          variants: { never: ["Kdy si myslíš, že zapisování bude nejtěžší?"] },
        },
      },
      options: {
        workdays: { label: "Náročné pracovní dny" },
        eating_out: { label: "Jídlo venku" },
        cooking: { label: "Vaření pro jiné" },
        snacks: { label: "Svačiny a nápoje" },
        evenings: { label: "Večery a víkendy" },
      },
    },
    {
      id: "diet",
      asks: {
        diet: { lines: ["Držíš nějakou dietu?"] },
      },
      options: {
        balanced: { label: "Vyvážená" },
        wholefood: { label: "Nezpracované potraviny" },
        mediterranean: { label: "Středomořská" },
        flexitarian: { label: "Flexitariánská" },
        pescatarian: { label: "Pescetariánská" },
        vegetarian: { label: "Vegetariánská" },
        vegan: { label: "Veganská" },
      },
    },
    {
      id: "medical",
      asks: {
        medical: { lines: ["Nějaká zdravotní omezení?"] },
      },
      options: {
        kidneys: { label: "Onemocnění ledvin" },
        ldl: { label: "Vysoký cholesterol" },
        lowsugar: { label: "Riziko cukrovky" },
        none: { label: "Nic z toho" },
      },
    },
    {
      id: "country",
      asks: {
        country: { lines: ["Kde jíš?"], placeholder: "Hledat" },
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
        other: { label: "Jinde" },
      },
    },
    {
      id: "streak",
      asks: {
        streak_goal_days: { lines: ["Jakou sérii si dáš za cíl?"] },
      },
      options: {
        "7": { label: "7 dní" },
        "14": { label: "14 dní" },
        "30": { label: "30 dní" },
        "50": { label: "50 dní" },
      },
    },
  ],
  building: {
    lines: ["Sestavuji tvůj osobní plán"],
    title: "Tvůj denní plán",
    rows: { calories: "Kalorie", protein: "Bílkoviny", carbs: "Sacharidy", fat: "Tuky", diet: "Dieta" },
    limitCap: { ldl: "nasycené tuky ≤ {n} g", kidneys: "sodík ≤ {n} mg" },
    cta: "Ukaž mi plán",
    floorTitle: "Zastavili jsme se na {floor} kcal",
    floorBody: "Výpočet chtěl jít níž. Bez lékařského dohledu cíle pod toto minimum nenastavujeme, takže tvůj zůstává tady. V deníku to bude uvedeno taky.",
  },
  summary: {
    lines: ["Tady je tvůj plán"],
    kcalLabel: "kcal denně",
    floorMarker: "omezeno kvůli bezpečnosti · nikdy pod {floor}",
    macros: {
      protein: "Bílkoviny",
      carbs: "Sacharidy",
      fat: "Tuky",
      satfat: "Nasycené tuky · na tvoje přání",
    },
    capNote: "Takové tempo by vyžadovalo větší denní změnu, než je bezpečné dlouhodobě udržet, takže máš bezpečnou verzi: {share} % toho, co tvoje tělo za den spálí.",
    // R0 of the retention plan: onboarding ends with ONE unambiguous instruction, and the thing
    // being asked for is the first photo. "Start logging" points at a diary, which is an empty list
    // and a second decision.
    cta: "Vyfoť své první jídlo",
  },
};

const HI: OnboardingContent = {
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
  // Health, and a newer one moves the target on every surface, the browser included. v11 grows
  // the country question from four options to fifteen: it offered Germany, the UK, the US and
  // "Somewhere else" while the product shipped in eight languages, so a Vietnamese, Indonesian,
  // Italian, Spanish or Russian reader had exactly one true answer and it was the sentinel. The
  // labels left this file with it — a country's name is CLDR's, not an admin's. Bumped because a
  // funnel row for a four-chip screen and one for a fifteen-chip screen are not the same screen.
  // v12 is the v5 redesign's copy (issue #42): the age question asks "How old are you?" plainly,
  // and the activity options answer in plain frequencies — "A little each week" — rather than
  // effort labels. v13 (#50) drops 'No account needed to start.': the web asks for a sign-in
  // before the first question, and one content tree cannot say it on the phone only.
  // v14 is targets v2 (#81): the activity question's five levels became three — few/some/many —
  // and the sex question gained "other". A stored v13 revision carries neither, so the validator
  // retires it and every language falls back to this.
  //
  // v15 IS ONBOARDING V2 (#82): the conversation becomes Cal AI-shaped plain screens, one question
  // each — twelve screens where seven used to be, the struggles eight became five stored picks,
  // the restrictions screen split into `diet` (seven single-choice) and `medical` (multi-select,
  // "None of these" a drawn row), and the sign-up beat lands between the plan and the country.
  // A stored v14 revision names screens and asks this shape cannot satisfy, so it falls back whole.
  // v16 (#1078): the activity question's three bands became four — 0 / 1–2 / 3–4 / 5+ — and `few`
  // moved from "0–2" to "1–2". A stored v15 labels the new `few` "0–2" and has no `none` at all,
  // so `usableContent` retires it and every language falls back to this. v17 (ieat-app#2050)
  // rewrites the welcome as a title and a subtitle — "A plan built around you" — over the photo.
  version: 19,
  welcome: {
    lines: ["फोटो से कैलोरी गिनें"],
    cta: "शुरू करें",
    signin: "मेरा अकाउंट पहले से है",
  },
  screens: [
    {
      id: "goal",
      asks: {
        goal: { lines: ["आप यहाँ किसलिए हैं?"] },
      },
      options: {
        lose: { label: "वज़न घटाएँ" },
        maintain: { label: "वज़न बनाए रखें" },
        gain: { label: "वज़न बढ़ाएँ" },
      },
    },
    {
      id: "sex",
      asks: {
        sex: { lines: ["आपका लिंग क्या है?"] },
      },
      options: {
        male: { label: "पुरुष" },
        female: { label: "महिला" },
        other: { label: "अन्य" },
      },
    },
    {
      id: "age",
      asks: {
        // Asked as an AGE and stored as a year — `checkNumber` in `onboarding-chat.ts` converts.
        birth_year: {
          lines: ["आपकी उम्र?"],
          placeholder: "आपकी उम्र",
        },
      },
    },
    {
      id: "height",
      asks: {
        height_cm: {
          lines: ["कद"],
          placeholder: "लंबाई cm में",
        },
      },
    },
    {
      id: "weight",
      asks: {
        weight_kg: {
          lines: ["आपका वज़न"],
          placeholder: "वज़न kg में",
        },
      },
    },
    {
      id: "activity",
      asks: {
        activity: {
          lines: ["आपके दिन कितने सक्रिय रहते हैं?"],
        },
      },
      options: {
        // Targets v2/#1078: four levels id'd by their icons — the range is the label, the line
        // beneath is the hint.
        none: { label: "0", hint: "कोई वर्कआउट नहीं" },
        few: { label: "1–2", hint: "कभी-कभार वर्कआउट" },
        some: { label: "3–4", hint: "हफ़्ते में कुछ वर्कआउट" },
        many: { label: "5+", hint: "एथलीट जैसी दिनचर्या" },
      },
    },
    {
      id: "target",
      asks: {
        target_weight_kg: {
          lines: ["आपका लक्ष्य वज़न क्या है?"],
          placeholder: "लक्ष्य वज़न kg में",
        },
      },
    },
    {
      id: "pace",
      asks: {
        pace: { lines: ["कितनी तेज़ी से?"] },
      },
      options: {
        easy: { label: "हल्की" },
        steady: { label: "स्थिर" },
        push: { label: "तेज़" },
      },
    },
    {
      id: "counted",
      asks: { counted_before: { lines: ["क्या पहले कभी कैलोरी गिनी हैं?"] } },
      options: {
        never: { label: "कभी नहीं" },
        stopped: { label: "कोशिश की, फिर छोड़ दिया" },
        onoff: { label: "कभी-कभी" },
        now: { label: "अभी गिनती चल रही है" },
      },
    },
    {
      id: "barrier",
      asks: {
        barriers: {
          lines: ["किस चीज़ ने आपको रोका?", "जो भी लागू हो सब चुनें"],
          variants: {
            onoff: ["क्या रुकावट आई?", "जो भी लागू हो सब चुनें"],
            now: ["क्या और आसान होना चाहिए?", "जो भी लागू हो सब चुनें"],
          },
        },
      },
      options: {
        too_long: { label: "बहुत समय लगता था" },
        forgot: { label: "याद नहीं रहता था" },
        invisible: { label: "असर दिखता नहीं था" },
        no_idea: { label: "समझ नहीं आता था कि क्या खाएँ" },
        stressful: { label: "तनावपूर्ण लगता था" },
        nobody: { label: "पूछने के लिए कोई नहीं था" },
        creeping: { label: "मेरा वज़न फिर बढ़ने लगता था" },
        not_enough: { label: "ज़रूरत भर खाना मुश्किल था" },
      },
    },
    {
      id: "situation",
      asks: {
        situations: {
          lines: ["दर्ज करना कब सबसे मुश्किल है?"],
          variants: { never: ["कब दर्ज करना सबसे मुश्किल लगेगा?"] },
        },
      },
      options: {
        workdays: { label: "व्यस्त काम के दिन" },
        eating_out: { label: "बाहर खाना" },
        cooking: { label: "दूसरों के लिए खाना बनाना" },
        snacks: { label: "नाश्ता और पेय" },
        evenings: { label: "शामें और वीकेंड" },
      },
    },
    {
      id: "diet",
      asks: {
        diet: { lines: ["आपकी डाइट कैसी है?"] },
      },
      options: {
        balanced: { label: "संतुलित" },
        wholefood: { label: "साबुत आहार" },
        mediterranean: { label: "मेडिटेरेनियन" },
        flexitarian: { label: "फ़्लेक्सिटेरियन" },
        pescatarian: { label: "पेस्केटेरियन" },
        vegetarian: { label: "शाकाहारी" },
        vegan: { label: "वीगन" },
      },
    },
    {
      id: "medical",
      asks: {
        medical: { lines: ["कोई मेडिकल पाबंदी?"] },
      },
      options: {
        kidneys: { label: "किडनी की बीमारी" },
        ldl: { label: "हाई कोलेस्ट्रॉल" },
        lowsugar: { label: "डायबिटीज़ का खतरा" },
        none: { label: "इनमें से कोई नहीं" },
      },
    },
    {
      id: "country",
      asks: {
        country: { lines: ["आप कहाँ खाते हैं?"], placeholder: "खोजें" },
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
        other: { label: "कहीं और" },
      },
    },
    {
      id: "streak",
      asks: {
        streak_goal_days: { lines: ["कितनी लंबी स्ट्रीक का लक्ष्य रखें?"] },
      },
      options: {
        "7": { label: "7 दिन" },
        "14": { label: "14 दिन" },
        "30": { label: "30 दिन" },
        "50": { label: "50 दिन" },
      },
    },
  ],
  building: {
    lines: ["आपका निजी प्लान बन रहा है"],
    title: "आपका रोज़ का प्लान",
    rows: { calories: "कैलोरी", protein: "प्रोटीन", carbs: "कार्ब्स", fat: "फ़ैट", diet: "डाइट" },
    limitCap: { ldl: "सैचुरेटेड फ़ैट ≤ {n} g", kidneys: "सोडियम ≤ {n} mg" },
    cta: "मुझे प्लान दिखाएँ",
    floorTitle: "{floor} kcal पर रोक दिया गया",
    floorBody: "हिसाब इससे नीचे जाना चाहता था। डॉक्टर की निगरानी के बिना हम इससे कम लक्ष्य नहीं रखते, इसलिए आपका लक्ष्य यहीं है। आपकी डायरी में भी यही लिखा होगा।",
  },
  summary: {
    lines: ["यह रहा आपका प्लान"],
    kcalLabel: "kcal प्रति दिन",
    floorMarker: "सुरक्षा के लिए सीमित · {floor} से कभी कम नहीं",
    macros: {
      protein: "प्रोटीन",
      carbs: "कार्ब्स",
      fat: "फ़ैट",
      satfat: "सैचुरेटेड फ़ैट · आपके कहने पर",
    },
    capNote: "उस रफ़्तार के लिए रोज़ इतना बड़ा बदलाव चाहिए जितना सुरक्षित रूप से लंबे समय तक नहीं चल सकता, इसलिए आपका प्लान सुरक्षित वाला है: आपका शरीर एक दिन में जितना खर्च करता है, उसका {share}%।",
    // R0 of the retention plan: onboarding ends with ONE unambiguous instruction, and the thing
    // being asked for is the first photo. "Start logging" points at a diary, which is an empty list
    // and a second decision.
    cta: "अपने पहले भोजन की फ़ोटो लें",
  },
};

const TH: OnboardingContent = {
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
  // Health, and a newer one moves the target on every surface, the browser included. v11 grows
  // the country question from four options to fifteen: it offered Germany, the UK, the US and
  // "Somewhere else" while the product shipped in eight languages, so a Vietnamese, Indonesian,
  // Italian, Spanish or Russian reader had exactly one true answer and it was the sentinel. The
  // labels left this file with it — a country's name is CLDR's, not an admin's. Bumped because a
  // funnel row for a four-chip screen and one for a fifteen-chip screen are not the same screen.
  // v12 is the v5 redesign's copy (issue #42): the age question asks "How old are you?" plainly,
  // and the activity options answer in plain frequencies — "A little each week" — rather than
  // effort labels. v13 (#50) drops 'No account needed to start.': the web asks for a sign-in
  // before the first question, and one content tree cannot say it on the phone only.
  // v14 is targets v2 (#81): the activity question's five levels became three — few/some/many —
  // and the sex question gained "other". A stored v13 revision carries neither, so the validator
  // retires it and every language falls back to this.
  //
  // v15 IS ONBOARDING V2 (#82): the conversation becomes Cal AI-shaped plain screens, one question
  // each — twelve screens where seven used to be, the struggles eight became five stored picks,
  // the restrictions screen split into `diet` (seven single-choice) and `medical` (multi-select,
  // "None of these" a drawn row), and the sign-up beat lands between the plan and the country.
  // A stored v14 revision names screens and asks this shape cannot satisfy, so it falls back whole.
  // v16 (#1078): the activity question's three bands became four — 0 / 1–2 / 3–4 / 5+ — and `few`
  // moved from "0–2" to "1–2". A stored v15 labels the new `few` "0–2" and has no `none` at all,
  // so `usableContent` retires it and every language falls back to this. v17 (ieat-app#2050)
  // rewrites the welcome as a title and a subtitle — "A plan built around you" — over the photo.
  version: 19,
  welcome: {
    lines: ["นับแคลอรี่ด้วยรูปภาพ"],
    cta: "เริ่มเลย",
    signin: "ฉันมีบัญชีอยู่แล้ว",
  },
  screens: [
    {
      id: "goal",
      asks: {
        goal: { lines: ["คุณอยากทำอะไร?"] },
      },
      options: {
        lose: { label: "ลดน้ำหนัก" },
        maintain: { label: "รักษาน้ำหนัก" },
        gain: { label: "เพิ่มน้ำหนัก" },
      },
    },
    {
      id: "sex",
      asks: {
        sex: { lines: ["เพศของคุณคือ?"] },
      },
      options: {
        male: { label: "ชาย" },
        female: { label: "หญิง" },
        other: { label: "อื่นๆ" },
      },
    },
    {
      id: "age",
      asks: {
        // Asked as an AGE and stored as a year — `checkNumber` in `onboarding-chat.ts` converts.
        birth_year: {
          lines: ["อายุของคุณ?"],
          placeholder: "อายุของคุณ",
        },
      },
    },
    {
      id: "height",
      asks: {
        height_cm: {
          lines: ["ส่วนสูง"],
          placeholder: "ส่วนสูงเป็น ซม.",
        },
      },
    },
    {
      id: "weight",
      asks: {
        weight_kg: {
          lines: ["น้ำหนักของคุณ"],
          placeholder: "น้ำหนักเป็น กก.",
        },
      },
    },
    {
      id: "activity",
      asks: {
        activity: {
          lines: ["แต่ละวันคุณแอ็กทีฟแค่ไหน?"],
        },
      },
      options: {
        // Targets v2/#1078: four levels id'd by their icons — the range is the label, the line
        // beneath is the hint.
        none: { label: "0", hint: "ไม่ออกกำลังกาย" },
        few: { label: "1–2", hint: "ออกกำลังกายบ้างเป็นครั้งคราว" },
        some: { label: "3–4", hint: "ออกกำลังกายสองสามครั้งต่อสัปดาห์" },
        many: { label: "5+", hint: "ฝึกซ้อมจริงจัง" },
      },
    },
    {
      id: "target",
      asks: {
        target_weight_kg: {
          lines: ["คุณตั้งเป้าน้ำหนักไว้เท่าไหร่?"],
          placeholder: "น้ำหนักเป้าหมายเป็น กก.",
        },
      },
    },
    {
      id: "pace",
      asks: {
        pace: { lines: ["เร็วแค่ไหน?"] },
      },
      options: {
        easy: { label: "สบายๆ" },
        steady: { label: "สม่ำเสมอ" },
        push: { label: "เร็ว" },
      },
    },
    {
      id: "counted",
      asks: { counted_before: { lines: ["เคยนับแคลอรี่ไหม?"] } },
      options: {
        never: { label: "ไม่เคย" },
        stopped: { label: "เคยลอง แล้วเลิก" },
        onoff: { label: "นับบ้างหยุดบ้าง" },
        now: { label: "ตอนนี้กำลังนับอยู่" },
      },
    },
    {
      id: "barrier",
      asks: {
        barriers: {
          lines: ["อะไรทำให้คุณเลิก?", "เลือกทุกข้อที่ตรง"],
          variants: {
            onoff: ["อะไรเป็นอุปสรรค?", "เลือกทุกข้อที่ตรง"],
            now: ["อยากให้อะไรง่ายขึ้น?", "เลือกทุกข้อที่ตรง"],
          },
        },
      },
      options: {
        too_long: { label: "ใช้เวลานานเกินไป" },
        forgot: { label: "ชอบลืม" },
        invisible: { label: "ไม่เห็นผลลัพธ์" },
        no_idea: { label: "ไม่รู้จะกินอะไร" },
        stressful: { label: "รู้สึกเครียด" },
        nobody: { label: "ไม่มีใครให้ถาม" },
        creeping: { label: "น้ำหนักกลับมาขึ้นเรื่อยๆ" },
        not_enough: { label: "กินให้พอยาก" },
      },
    },
    {
      id: "situation",
      asks: {
        situations: {
          lines: ["ช่วงไหนบันทึกยากสุด?"],
          variants: { never: ["คิดว่าช่วงไหนจะบันทึกยากสุด?"] },
        },
      },
      options: {
        workdays: { label: "วันทำงานที่ยุ่ง" },
        eating_out: { label: "กินข้าวนอกบ้าน" },
        cooking: { label: "ทำอาหารให้คนอื่น" },
        snacks: { label: "ของว่างและเครื่องดื่ม" },
        evenings: { label: "ตอนเย็นและวันหยุด" },
      },
    },
    {
      id: "diet",
      asks: {
        diet: { lines: ["คุณกินตามแนวทางอาหารแบบไหนไหม?"] },
      },
      options: {
        balanced: { label: "สมดุล" },
        wholefood: { label: "อาหารไม่แปรรูป" },
        mediterranean: { label: "เมดิเตอร์เรเนียน" },
        flexitarian: { label: "เฟล็กซิทาเรียน" },
        pescatarian: { label: "เพสคาทาเรียน" },
        vegetarian: { label: "มังสวิรัติ" },
        vegan: { label: "วีแกน" },
      },
    },
    {
      id: "medical",
      asks: {
        medical: { lines: ["มีข้อจำกัดทางการแพทย์ไหม?"] },
      },
      options: {
        kidneys: { label: "โรคไต" },
        ldl: { label: "คอเลสเตอรอลสูง" },
        lowsugar: { label: "เสี่ยงเบาหวาน" },
        none: { label: "ไม่มีเลย" },
      },
    },
    {
      id: "country",
      asks: {
        country: { lines: ["คุณกินข้าวที่ไหน?"], placeholder: "ค้นหา" },
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
        other: { label: "ที่อื่น" },
      },
    },
    {
      id: "streak",
      asks: {
        streak_goal_days: { lines: ["เลือกสตรีคที่อยากทำให้ถึง"] },
      },
      options: {
        "7": { label: "7 วัน" },
        "14": { label: "14 วัน" },
        "30": { label: "30 วัน" },
        "50": { label: "50 วัน" },
      },
    },
  ],
  building: {
    lines: ["กำลังสร้างแผนส่วนตัวของคุณ"],
    title: "แผนรายวันของคุณ",
    rows: { calories: "แคลอรี", protein: "โปรตีน", carbs: "คาร์บ", fat: "ไขมัน", diet: "แนวทางอาหาร" },
    limitCap: { ldl: "ไขมันอิ่มตัว ≤ {n} ก.", kidneys: "โซเดียม ≤ {n} มก." },
    cta: "ดูแผน",
    floorTitle: "เราหยุดไว้ที่ {floor} kcal",
    floorBody: "ตัวเลขคำนวณได้ต่ำกว่านี้ แต่เราไม่ตั้งเป้าต่ำกว่าระดับนี้หากไม่มีแพทย์ดูแล เป้าของคุณจึงอยู่ตรงนี้ ในไดอารี่ของคุณก็จะแสดงไว้ด้วย",
  },
  summary: {
    lines: ["นี่คือแผนของคุณ"],
    kcalLabel: "kcal ต่อวัน",
    floorMarker: "จำกัดไว้เพื่อความปลอดภัย · ไม่ต่ำกว่า {floor}",
    macros: {
      protein: "โปรตีน",
      carbs: "คาร์บ",
      fat: "ไขมัน",
      satfat: "ไขมันอิ่มตัว · ตามที่คุณขอ",
    },
    capNote: "ความเร็วนั้นต้องเปลี่ยนต่อวันมากเกินกว่าที่ทำต่อเนื่องได้อย่างปลอดภัย แผนของคุณจึงเป็นแบบปลอดภัย: {share}% ของพลังงานที่ร่างกายเผาผลาญต่อวัน",
    // R0 of the retention plan: onboarding ends with ONE unambiguous instruction, and the thing
    // being asked for is the first photo. "Start logging" points at a diary, which is an empty list
    // and a second decision.
    cta: "ถ่ายรูปมื้อแรกของคุณ",
  },
};

const SV: OnboardingContent = {
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
  // Health, and a newer one moves the target on every surface, the browser included. v11 grows
  // the country question from four options to fifteen: it offered Germany, the UK, the US and
  // "Somewhere else" while the product shipped in eight languages, so a Vietnamese, Indonesian,
  // Italian, Spanish or Russian reader had exactly one true answer and it was the sentinel. The
  // labels left this file with it — a country's name is CLDR's, not an admin's. Bumped because a
  // funnel row for a four-chip screen and one for a fifteen-chip screen are not the same screen.
  // v12 is the v5 redesign's copy (issue #42): the age question asks "How old are you?" plainly,
  // and the activity options answer in plain frequencies — "A little each week" — rather than
  // effort labels. v13 (#50) drops 'No account needed to start.': the web asks for a sign-in
  // before the first question, and one content tree cannot say it on the phone only.
  // v14 is targets v2 (#81): the activity question's five levels became three — few/some/many —
  // and the sex question gained "other". A stored v13 revision carries neither, so the validator
  // retires it and every language falls back to this.
  //
  // v15 IS ONBOARDING V2 (#82): the conversation becomes Cal AI-shaped plain screens, one question
  // each — twelve screens where seven used to be, the struggles eight became five stored picks,
  // the restrictions screen split into `diet` (seven single-choice) and `medical` (multi-select,
  // "None of these" a drawn row), and the sign-up beat lands between the plan and the country.
  // A stored v14 revision names screens and asks this shape cannot satisfy, so it falls back whole.
  // v16 (#1078): the activity question's three bands became four — 0 / 1–2 / 3–4 / 5+ — and `few`
  // moved from "0–2" to "1–2". A stored v15 labels the new `few` "0–2" and has no `none` at all,
  // so `usableContent` retires it and every language falls back to this. v17 (ieat-app#2050)
  // rewrites the welcome as a title and a subtitle — "A plan built around you" — over the photo.
  version: 19,
  welcome: {
    lines: ["Räkna kalorier med ett foto"],
    cta: "Börja",
    signin: "Jag har redan ett konto",
  },
  screens: [
    {
      id: "goal",
      asks: {
        goal: { lines: ["Vad vill du uppnå?"] },
      },
      options: {
        lose: { label: "Gå ner i vikt" },
        maintain: { label: "Hålla min vikt" },
        gain: { label: "Gå upp i vikt" },
      },
    },
    {
      id: "sex",
      asks: {
        sex: { lines: ["Vilket är ditt kön?"] },
      },
      options: {
        male: { label: "Man" },
        female: { label: "Kvinna" },
        other: { label: "Annat" },
      },
    },
    {
      id: "age",
      asks: {
        // Asked as an AGE and stored as a year — `checkNumber` in `onboarding-chat.ts` converts.
        birth_year: {
          lines: ["Din ålder?"],
          placeholder: "Din ålder",
        },
      },
    },
    {
      id: "height",
      asks: {
        height_cm: {
          lines: ["Längd"],
          placeholder: "Längd i cm",
        },
      },
    },
    {
      id: "weight",
      asks: {
        weight_kg: {
          lines: ["Din vikt"],
          placeholder: "Vikt i kg",
        },
      },
    },
    {
      id: "activity",
      asks: {
        activity: {
          lines: ["Hur aktiva är dina dagar?"],
        },
      },
      options: {
        // Targets v2/#1078: four levels id'd by their icons — the range is the label, the line
        // beneath is the hint.
        none: { label: "0", hint: "Ingen träning" },
        few: { label: "1–2", hint: "Träning då och då" },
        some: { label: "3–4", hint: "Några träningspass i veckan" },
        many: { label: "5+", hint: "Hängiven idrottare" },
      },
    },
    {
      id: "target",
      asks: {
        target_weight_kg: {
          lines: ["Vilken vikt siktar du på?"],
          placeholder: "Målvikt i kg",
        },
      },
    },
    {
      id: "pace",
      asks: {
        pace: { lines: ["Hur snabbt?"] },
      },
      options: {
        easy: { label: "Lugnt" },
        steady: { label: "Jämnt" },
        push: { label: "Raskt" },
      },
    },
    {
      id: "counted",
      asks: { counted_before: { lines: ["Räknat kalorier förut?"] } },
      options: {
        never: { label: "Aldrig" },
        stopped: { label: "Försökte, slutade" },
        onoff: { label: "Då och då" },
        now: { label: "Jag räknar nu" },
      },
    },
    {
      id: "barrier",
      asks: {
        barriers: {
          lines: ["Vad fick dig att sluta?", "Välj allt som stämmer"],
          variants: {
            onoff: ["Vad kom i vägen?", "Välj allt som stämmer"],
            now: ["Vad vill du ska vara enklare?", "Välj allt som stämmer"],
          },
        },
      },
      options: {
        too_long: { label: "Det tog för lång tid" },
        forgot: { label: "Jag glömde" },
        invisible: { label: "Jag såg inte att det funkade" },
        no_idea: { label: "Jag visste inte vad jag skulle äta" },
        stressful: { label: "Det kändes stressigt" },
        nobody: { label: "Ingen att fråga" },
        creeping: { label: "Vikten smög tillbaka" },
        not_enough: { label: "Svårt att äta tillräckligt" },
      },
    },
    {
      id: "situation",
      asks: {
        situations: {
          lines: ["När är det svårast att logga?"],
          variants: { never: ["När tror du att det blir svårast att logga?"] },
        },
      },
      options: {
        workdays: { label: "Stressiga arbetsdagar" },
        eating_out: { label: "Äta ute" },
        cooking: { label: "Laga mat åt andra" },
        snacks: { label: "Snacks och drycker" },
        evenings: { label: "Kvällar och helger" },
      },
    },
    {
      id: "diet",
      asks: {
        diet: { lines: ["Följer du någon kost?"] },
      },
      options: {
        balanced: { label: "Balanserad" },
        wholefood: { label: "Oprocessad" },
        mediterranean: { label: "Medelhavsinspirerad" },
        flexitarian: { label: "Flexitarisk" },
        pescatarian: { label: "Pescetarisk" },
        vegetarian: { label: "Vegetarisk" },
        vegan: { label: "Vegansk" },
      },
    },
    {
      id: "medical",
      asks: {
        medical: { lines: ["Några medicinska begränsningar?"] },
      },
      options: {
        kidneys: { label: "Njursjukdom" },
        ldl: { label: "Högt kolesterol" },
        lowsugar: { label: "Risk för diabetes" },
        none: { label: "Inget av detta" },
      },
    },
    {
      id: "country",
      asks: {
        country: { lines: ["Var äter du?"], placeholder: "Sök" },
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
        other: { label: "Någon annanstans" },
      },
    },
    {
      id: "streak",
      asks: {
        streak_goal_days: { lines: ["Välj en svit att sikta på"] },
      },
      options: {
        "7": { label: "7 dagar" },
        "14": { label: "14 dagar" },
        "30": { label: "30 dagar" },
        "50": { label: "50 dagar" },
      },
    },
  ],
  building: {
    lines: ["Skapar din personliga plan"],
    title: "Din dagliga plan",
    rows: { calories: "Kalorier", protein: "Protein", carbs: "Kolhydrater", fat: "Fett", diet: "Kost" },
    limitCap: { ldl: "mättat fett ≤ {n} g", kidneys: "natrium ≤ {n} mg" },
    cta: "Visa mig planen",
    floorTitle: "Vi stannade vid {floor} kcal",
    floorBody: "Räknestycket ville gå lägre. Vi sätter inga mål under det här utan medicinsk uppföljning, så här hamnar ditt. Det står även i din dagbok.",
  },
  summary: {
    lines: ["Här är din plan"],
    kcalLabel: "kcal per dag",
    floorMarker: "begränsat för säkerhets skull · aldrig under {floor}",
    macros: {
      protein: "Protein",
      carbs: "Kolhydrater",
      fat: "Fett",
      satfat: "Mättat fett · du bad om det",
    },
    capNote: "Det tempot kräver en större daglig förändring än vad som är säkert att hålla, så du får den säkra versionen: {share} % av det din kropp förbränner på en dag.",
    // R0 of the retention plan: onboarding ends with ONE unambiguous instruction, and the thing
    // being asked for is the first photo. "Start logging" points at a diary, which is an empty list
    // and a second decision.
    cta: "Fota din första måltid",
  },
};

const UK: OnboardingContent = {
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
  // Health, and a newer one moves the target on every surface, the browser included. v11 grows
  // the country question from four options to fifteen: it offered Germany, the UK, the US and
  // "Somewhere else" while the product shipped in eight languages, so a Vietnamese, Indonesian,
  // Italian, Spanish or Russian reader had exactly one true answer and it was the sentinel. The
  // labels left this file with it — a country's name is CLDR's, not an admin's. Bumped because a
  // funnel row for a four-chip screen and one for a fifteen-chip screen are not the same screen.
  // v12 is the v5 redesign's copy (issue #42): the age question asks "How old are you?" plainly,
  // and the activity options answer in plain frequencies — "A little each week" — rather than
  // effort labels. v13 (#50) drops 'No account needed to start.': the web asks for a sign-in
  // before the first question, and one content tree cannot say it on the phone only.
  // v14 is targets v2 (#81): the activity question's five levels became three — few/some/many —
  // and the sex question gained "other". A stored v13 revision carries neither, so the validator
  // retires it and every language falls back to this.
  //
  // v15 IS ONBOARDING V2 (#82): the conversation becomes Cal AI-shaped plain screens, one question
  // each — twelve screens where seven used to be, the struggles eight became five stored picks,
  // the restrictions screen split into `diet` (seven single-choice) and `medical` (multi-select,
  // "None of these" a drawn row), and the sign-up beat lands between the plan and the country.
  // A stored v14 revision names screens and asks this shape cannot satisfy, so it falls back whole.
  // v16 (#1078): the activity question's three bands became four — 0 / 1–2 / 3–4 / 5+ — and `few`
  // moved from "0–2" to "1–2". A stored v15 labels the new `few` "0–2" and has no `none` at all,
  // so `usableContent` retires it and every language falls back to this. v17 (ieat-app#2050)
  // rewrites the welcome as a title and a subtitle — "A plan built around you" — over the photo.
  version: 19,
  welcome: {
    lines: ["Рахуй калорії за фото"],
    cta: "Почати",
    signin: "У мене вже є акаунт",
  },
  screens: [
    {
      id: "goal",
      asks: {
        goal: { lines: ["Яка в тебе мета?"] },
      },
      options: {
        lose: { label: "Схуднути" },
        maintain: { label: "Зберегти вагу" },
        gain: { label: "Набрати вагу" },
      },
    },
    {
      id: "sex",
      asks: {
        sex: { lines: ["Твоя стать?"] },
      },
      options: {
        male: { label: "Чоловіча" },
        female: { label: "Жіноча" },
        other: { label: "Інша" },
      },
    },
    {
      id: "age",
      asks: {
        // Asked as an AGE and stored as a year — `checkNumber` in `onboarding-chat.ts` converts.
        birth_year: {
          lines: ["Твій вік?"],
          placeholder: "Твій вік",
        },
      },
    },
    {
      id: "height",
      asks: {
        height_cm: {
          lines: ["Зріст"],
          placeholder: "Зріст у см",
        },
      },
    },
    {
      id: "weight",
      asks: {
        weight_kg: {
          lines: ["Твоя вага"],
          placeholder: "Вага в кг",
        },
      },
    },
    {
      id: "activity",
      asks: {
        activity: {
          lines: ["Наскільки активні твої дні?"],
        },
      },
      options: {
        // Targets v2/#1078: four levels id'd by their icons — the range is the label, the line
        // beneath is the hint.
        none: { label: "0", hint: "Без тренувань" },
        few: { label: "1–2", hint: "Тренування час від часу" },
        some: { label: "3–4", hint: "Кілька тренувань на тиждень" },
        many: { label: "5+", hint: "Майже щодня" },
      },
    },
    {
      id: "target",
      asks: {
        target_weight_kg: {
          lines: ["До якої ваги прагнеш?"],
          placeholder: "Бажана вага в кг",
        },
      },
    },
    {
      id: "pace",
      asks: {
        pace: { lines: ["Як швидко?"] },
      },
      options: {
        easy: { label: "М'який" },
        steady: { label: "Рівний" },
        push: { label: "Швидкий" },
      },
    },
    {
      id: "counted",
      asks: { counted_before: { lines: ["Доводилося рахувати калорії?"] } },
      options: {
        never: { label: "Ні разу" },
        stopped: { label: "Раніше так, тепер ні" },
        onoff: { label: "З перервами" },
        now: { label: "Рахую зараз" },
      },
    },
    {
      id: "barrier",
      asks: {
        barriers: {
          lines: ["Що тебе зупинило?", "Вибери все, що підходить"],
          variants: {
            onoff: ["Що тобі заважало?", "Вибери все, що підходить"],
            now: ["Що було б легше?", "Вибери все, що підходить"],
          },
        },
      },
      options: {
        too_long: { label: "Це займало забагато часу" },
        forgot: { label: "Вилітало з голови" },
        invisible: { label: "Не було видно результату" },
        no_idea: { label: "Було незрозуміло, що їсти" },
        stressful: { label: "Це напружувало" },
        nobody: { label: "Нікого було запитати" },
        creeping: { label: "Вага весь час поверталася" },
        not_enough: { label: "Важко було з'їдати достатньо" },
      },
    },
    {
      id: "situation",
      asks: {
        situations: {
          lines: ["Коли записувати найважче?"],
          variants: { never: ["Як гадаєш, коли записувати буде найважче?"] },
        },
      },
      options: {
        workdays: { label: "Завантажені будні" },
        eating_out: { label: "Їжа поза домом" },
        cooking: { label: "Готування для інших" },
        snacks: { label: "Перекуси й напої" },
        evenings: { label: "Вечори й вихідні" },
      },
    },
    {
      id: "diet",
      asks: {
        diet: { lines: ["Ти дотримуєшся якоїсь дієти?"] },
      },
      options: {
        balanced: { label: "Збалансована" },
        wholefood: { label: "Цільні продукти" },
        mediterranean: { label: "Середземноморська" },
        flexitarian: { label: "Флекситаріанська" },
        pescatarian: { label: "Пескетаріанська" },
        vegetarian: { label: "Вегетаріанська" },
        vegan: { label: "Веганська" },
      },
    },
    {
      id: "medical",
      asks: {
        medical: { lines: ["Є медичні обмеження?"] },
      },
      options: {
        kidneys: { label: "Захворювання нирок" },
        ldl: { label: "Високий холестерин" },
        lowsugar: { label: "Ризик діабету" },
        none: { label: "Нічого з цього" },
      },
    },
    {
      id: "country",
      asks: {
        country: { lines: ["Де ти їси?"], placeholder: "Пошук" },
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
        other: { label: "Деінде" },
      },
    },
    {
      id: "streak",
      asks: {
        streak_goal_days: { lines: ["Обери серію, на яку націлитися"] },
      },
      options: {
        "7": { label: "7 днів" },
        "14": { label: "14 днів" },
        "30": { label: "30 днів" },
        "50": { label: "50 днів" },
      },
    },
  ],
  building: {
    lines: ["Складаю твій особистий план"],
    title: "Твій план на день",
    rows: { calories: "Калорії", protein: "Білок", carbs: "Вуглеводи", fat: "Жири", diet: "Дієта" },
    limitCap: { ldl: "насичені жири ≤ {n} г", kidneys: "натрій ≤ {n} мг" },
    cta: "Показати план",
    floorTitle: "Ми зупинилися на {floor} ккал",
    floorBody: "Розрахунок хотів піти нижче. Без нагляду лікаря ми не ставимо цілей нижче цієї позначки, тож твоя — тут. У щоденнику це теж буде вказано.",
  },
  summary: {
    lines: ["Ось твій план"],
    kcalLabel: "ккал на день",
    floorMarker: "обмежено заради безпеки · ніколи не нижче {floor}",
    macros: {
      protein: "Білок",
      carbs: "Вуглеводи",
      fat: "Жири",
      satfat: "Насичені жири · на твоє прохання",
    },
    capNote: "Такий темп потребував би більшої щоденної різниці, ніж безпечно витримувати, тож у тебе безпечний варіант: {share}% від того, що тіло спалює за день.",
    // R0 of the retention plan: onboarding ends with ONE unambiguous instruction, and the thing
    // being asked for is the first photo. "Start logging" points at a diary, which is an empty list
    // and a second decision.
    cta: "Сфотографуй перший прийом їжі",
  },
};

const NL: OnboardingContent = {
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
  // Health, and a newer one moves the target on every surface, the browser included. v11 grows
  // the country question from four options to fifteen: it offered Germany, the UK, the US and
  // "Somewhere else" while the product shipped in eight languages, so a Vietnamese, Indonesian,
  // Italian, Spanish or Russian reader had exactly one true answer and it was the sentinel. The
  // labels left this file with it — a country's name is CLDR's, not an admin's. Bumped because a
  // funnel row for a four-chip screen and one for a fifteen-chip screen are not the same screen.
  // v12 is the v5 redesign's copy (issue #42): the age question asks "How old are you?" plainly,
  // and the activity options answer in plain frequencies — "A little each week" — rather than
  // effort labels. v13 (#50) drops 'No account needed to start.': the web asks for a sign-in
  // before the first question, and one content tree cannot say it on the phone only.
  // v14 is targets v2 (#81): the activity question's five levels became three — few/some/many —
  // and the sex question gained "other". A stored v13 revision carries neither, so the validator
  // retires it and every language falls back to this.
  //
  // v15 IS ONBOARDING V2 (#82): the conversation becomes Cal AI-shaped plain screens, one question
  // each — twelve screens where seven used to be, the struggles eight became five stored picks,
  // the restrictions screen split into `diet` (seven single-choice) and `medical` (multi-select,
  // "None of these" a drawn row), and the sign-up beat lands between the plan and the country.
  // A stored v14 revision names screens and asks this shape cannot satisfy, so it falls back whole.
  // v16 (#1078): the activity question's three bands became four — 0 / 1–2 / 3–4 / 5+ — and `few`
  // moved from "0–2" to "1–2". A stored v15 labels the new `few` "0–2" and has no `none` at all,
  // so `usableContent` retires it and every language falls back to this. v17 (ieat-app#2050)
  // rewrites the welcome as a title and a subtitle — "A plan built around you" — over the photo.
  version: 19,
  welcome: {
    lines: ["Tel calorieën met een foto"],
    cta: "Start",
    signin: "Ik heb al een account",
  },
  screens: [
    {
      id: "goal",
      asks: {
        goal: { lines: ["Wat wil je bereiken?"] },
      },
      options: {
        lose: { label: "Afvallen" },
        maintain: { label: "Mijn gewicht houden" },
        gain: { label: "Aankomen" },
      },
    },
    {
      id: "sex",
      asks: {
        sex: { lines: ["Wat is je geslacht?"] },
      },
      options: {
        male: { label: "Man" },
        female: { label: "Vrouw" },
        other: { label: "Anders" },
      },
    },
    {
      id: "age",
      asks: {
        // Asked as an AGE and stored as a year — `checkNumber` in `onboarding-chat.ts` converts.
        birth_year: {
          lines: ["Je leeftijd?"],
          placeholder: "Je leeftijd",
        },
      },
    },
    {
      id: "height",
      asks: {
        height_cm: {
          lines: ["Lengte"],
          placeholder: "Lengte in cm",
        },
      },
    },
    {
      id: "weight",
      asks: {
        weight_kg: {
          lines: ["Je gewicht"],
          placeholder: "Gewicht in kg",
        },
      },
    },
    {
      id: "activity",
      asks: {
        activity: {
          lines: ["Hoe actief zijn je dagen?"],
        },
      },
      options: {
        // Targets v2/#1078: four levels id'd by their icons — the range is the label, the line
        // beneath is the hint.
        none: { label: "0", hint: "Geen trainingen" },
        few: { label: "1–2", hint: "Af en toe een training" },
        some: { label: "3–4", hint: "Een paar trainingen per week" },
        many: { label: "5+", hint: "Fanatieke sporter" },
      },
    },
    {
      id: "target",
      asks: {
        target_weight_kg: {
          lines: ["Naar welk gewicht wil je toe?"],
          placeholder: "Streefgewicht in kg",
        },
      },
    },
    {
      id: "pace",
      asks: {
        pace: { lines: ["Hoe snel?"] },
      },
      options: {
        easy: { label: "Rustig" },
        steady: { label: "Gestaag" },
        push: { label: "Stevig" },
      },
    },
    {
      id: "counted",
      asks: { counted_before: { lines: ["Al eens calorieën geteld?"] } },
      options: {
        never: { label: "Nooit" },
        stopped: { label: "Geprobeerd, gestopt" },
        onoff: { label: "Af en toe" },
        now: { label: "Ik tel nu" },
      },
    },
    {
      id: "barrier",
      asks: {
        barriers: {
          lines: ["Wat hield je tegen?", "Kies alles wat past"],
          variants: {
            onoff: ["Wat kwam ertussen?", "Kies alles wat past"],
            now: ["Wat zou je makkelijker willen?", "Kies alles wat past"],
          },
        },
      },
      options: {
        too_long: { label: "Het duurde te lang" },
        forgot: { label: "Ik vergat het" },
        invisible: { label: "Ik zag niet dat het werkte" },
        no_idea: { label: "Ik wist niet wat te eten" },
        stressful: { label: "Het voelde stressvol" },
        nobody: { label: "Niemand om te vragen" },
        creeping: { label: "Mijn gewicht kroop terug" },
        not_enough: { label: "Moeilijk genoeg eten" },
      },
    },
    {
      id: "situation",
      asks: {
        situations: {
          lines: ["Wanneer is bijhouden het lastigst?"],
          variants: { never: ["Wanneer denk je dat bijhouden het lastigst wordt?"] },
        },
      },
      options: {
        workdays: { label: "Drukke werkdagen" },
        eating_out: { label: "Uit eten" },
        cooking: { label: "Koken voor anderen" },
        snacks: { label: "Snacks en drankjes" },
        evenings: { label: "Avonden en weekenden" },
      },
    },
    {
      id: "diet",
      asks: {
        diet: { lines: ["Volg je een dieet?"] },
      },
      options: {
        balanced: { label: "Gebalanceerd" },
        wholefood: { label: "Onbewerkt" },
        mediterranean: { label: "Mediterraan" },
        flexitarian: { label: "Flexitarisch" },
        pescatarian: { label: "Pescotarisch" },
        vegetarian: { label: "Vegetarisch" },
        vegan: { label: "Veganistisch" },
      },
    },
    {
      id: "medical",
      asks: {
        medical: { lines: ["Medische beperkingen?"] },
      },
      options: {
        kidneys: { label: "Nieraandoening" },
        ldl: { label: "Hoog cholesterol" },
        lowsugar: { label: "Risico op diabetes" },
        none: { label: "Geen van deze" },
      },
    },
    {
      id: "country",
      asks: {
        country: { lines: ["Waar eet je?"], placeholder: "Zoek" },
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
        other: { label: "Ergens anders" },
      },
    },
    {
      id: "streak",
      asks: {
        streak_goal_days: { lines: ["Kies een reeks als doel"] },
      },
      options: {
        "7": { label: "7 dagen" },
        "14": { label: "14 dagen" },
        "30": { label: "30 dagen" },
        "50": { label: "50 dagen" },
      },
    },
  ],
  building: {
    lines: ["Je persoonlijke plan wordt gemaakt"],
    title: "Je dagplan",
    rows: { calories: "Calorieën", protein: "Eiwit", carbs: "Koolhydraten", fat: "Vet", diet: "Dieet" },
    limitCap: { ldl: "verzadigd vet ≤ {n} g", kidneys: "natrium ≤ {n} mg" },
    cta: "Laat het plan zien",
    floorTitle: "We zijn gestopt bij {floor} kcal",
    floorBody: "De berekening wilde lager uitkomen. Zonder medische begeleiding stellen we geen doel onder deze grens in, dus hier ligt het jouwe. Dat staat ook in je dagboek.",
  },
  summary: {
    lines: ["Hier is je plan"],
    kcalLabel: "kcal per dag",
    floorMarker: "veiligheidshalve begrensd · nooit onder {floor}",
    macros: {
      protein: "Eiwit",
      carbs: "Koolhydraten",
      fat: "Vet",
      satfat: "Verzadigd vet · op jouw verzoek",
    },
    capNote: "Dat tempo vraagt om een groter dagelijks verschil dan veilig vol te houden is, dus je krijgt de veilige versie: {share}% van wat je lichaam per dag verbrandt.",
    // R0 of the retention plan: onboarding ends with ONE unambiguous instruction, and the thing
    // being asked for is the first photo. "Start logging" points at a diary, which is an empty list
    // and a second decision.
    cta: "Fotografeer je eerste maaltijd",
  },
};

const PL: OnboardingContent = {
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
  // Health, and a newer one moves the target on every surface, the browser included. v11 grows
  // the country question from four options to fifteen: it offered Germany, the UK, the US and
  // "Somewhere else" while the product shipped in eight languages, so a Vietnamese, Indonesian,
  // Italian, Spanish or Russian reader had exactly one true answer and it was the sentinel. The
  // labels left this file with it — a country's name is CLDR's, not an admin's. Bumped because a
  // funnel row for a four-chip screen and one for a fifteen-chip screen are not the same screen.
  // v12 is the v5 redesign's copy (issue #42): the age question asks "How old are you?" plainly,
  // and the activity options answer in plain frequencies — "A little each week" — rather than
  // effort labels. v13 (#50) drops 'No account needed to start.': the web asks for a sign-in
  // before the first question, and one content tree cannot say it on the phone only.
  // v14 is targets v2 (#81): the activity question's five levels became three — few/some/many —
  // and the sex question gained "other". A stored v13 revision carries neither, so the validator
  // retires it and every language falls back to this.
  //
  // v15 IS ONBOARDING V2 (#82): the conversation becomes Cal AI-shaped plain screens, one question
  // each — twelve screens where seven used to be, the struggles eight became five stored picks,
  // the restrictions screen split into `diet` (seven single-choice) and `medical` (multi-select,
  // "None of these" a drawn row), and the sign-up beat lands between the plan and the country.
  // A stored v14 revision names screens and asks this shape cannot satisfy, so it falls back whole.
  // v16 (#1078): the activity question's three bands became four — 0 / 1–2 / 3–4 / 5+ — and `few`
  // moved from "0–2" to "1–2". A stored v15 labels the new `few` "0–2" and has no `none` at all,
  // so `usableContent` retires it and every language falls back to this. v17 (ieat-app#2050)
  // rewrites the welcome as a title and a subtitle — "A plan built around you" — over the photo.
  version: 19,
  welcome: {
    lines: ["Policz kalorie ze zdjęcia"],
    cta: "Zacznij",
    signin: "Mam już konto",
  },
  screens: [
    {
      id: "goal",
      asks: {
        goal: { lines: ["Jaki jest twój cel?"] },
      },
      options: {
        lose: { label: "Schudnąć" },
        maintain: { label: "Utrzymać wagę" },
        gain: { label: "Przytyć" },
      },
    },
    {
      id: "sex",
      asks: {
        sex: { lines: ["Jaka jest twoja płeć?"] },
      },
      options: {
        male: { label: "Mężczyzna" },
        female: { label: "Kobieta" },
        other: { label: "Inna" },
      },
    },
    {
      id: "age",
      asks: {
        // Asked as an AGE and stored as a year — `checkNumber` in `onboarding-chat.ts` converts.
        birth_year: {
          lines: ["Twój wiek?"],
          placeholder: "Twój wiek",
        },
      },
    },
    {
      id: "height",
      asks: {
        height_cm: {
          lines: ["Wzrost"],
          placeholder: "Wzrost w cm",
        },
      },
    },
    {
      id: "weight",
      asks: {
        weight_kg: {
          lines: ["Twoja waga"],
          placeholder: "Waga w kg",
        },
      },
    },
    {
      id: "activity",
      asks: {
        activity: {
          lines: ["Jak aktywne są twoje dni?"],
        },
      },
      options: {
        // Targets v2/#1078: four levels id'd by their icons — the range is the label, the line
        // beneath is the hint.
        none: { label: "0", hint: "Bez treningów" },
        few: { label: "1–2", hint: "Treningi od czasu do czasu" },
        some: { label: "3–4", hint: "Kilka treningów w tygodniu" },
        many: { label: "5+", hint: "Trening prawie codziennie" },
      },
    },
    {
      id: "target",
      asks: {
        target_weight_kg: {
          lines: ["Do jakiej wagi dążysz?"],
          placeholder: "Docelowa waga w kg",
        },
      },
    },
    {
      id: "pace",
      asks: {
        pace: { lines: ["Jak szybko?"] },
      },
      options: {
        easy: { label: "Łagodnie" },
        steady: { label: "Równo" },
        push: { label: "Szybko" },
      },
    },
    {
      id: "counted",
      asks: { counted_before: { lines: ["Masz doświadczenie w liczeniu kalorii?"] } },
      options: {
        never: { label: "Nigdy" },
        stopped: { label: "Kiedyś tak, teraz nie" },
        onoff: { label: "Z przerwami" },
        now: { label: "Tak, liczę" },
      },
    },
    {
      id: "barrier",
      asks: {
        barriers: {
          lines: ["Co cię zatrzymało?", "Zaznacz wszystko, co pasuje"],
          variants: {
            onoff: ["Co ci przeszkodziło?", "Zaznacz wszystko, co pasuje"],
            now: ["Co chcesz uprościć?", "Zaznacz wszystko, co pasuje"],
          },
        },
      },
      options: {
        too_long: { label: "To zajmowało za dużo czasu" },
        forgot: { label: "Zapominało się" },
        invisible: { label: "Nie było widać efektów" },
        no_idea: { label: "Brakowało pomysłu, co jeść" },
        stressful: { label: "To było stresujące" },
        nobody: { label: "Nie było kogo zapytać" },
        creeping: { label: "Waga wracała" },
        not_enough: { label: "Trudno było zjeść wystarczająco" },
      },
    },
    {
      id: "situation",
      asks: {
        situations: {
          lines: ["Kiedy zapisywanie jest najtrudniejsze?"],
          variants: { never: ["Kiedy spodziewasz się, że zapisywanie będzie najtrudniejsze?"] },
        },
      },
      options: {
        workdays: { label: "Zajęte dni powszednie" },
        eating_out: { label: "Jedzenie na mieście" },
        cooking: { label: "Gotowanie dla innych" },
        snacks: { label: "Przekąski i napoje" },
        evenings: { label: "Wieczory i weekendy" },
      },
    },
    {
      id: "diet",
      asks: {
        diet: { lines: ["Stosujesz jakąś dietę?"] },
      },
      options: {
        balanced: { label: "Zbilansowana" },
        wholefood: { label: "Nieprzetworzona żywność" },
        mediterranean: { label: "Śródziemnomorska" },
        flexitarian: { label: "Fleksitariańska" },
        pescatarian: { label: "Peskatariańska" },
        vegetarian: { label: "Wegetariańska" },
        vegan: { label: "Wegańska" },
      },
    },
    {
      id: "medical",
      asks: {
        medical: { lines: ["Masz ograniczenia zdrowotne?"] },
      },
      options: {
        kidneys: { label: "Choroba nerek" },
        ldl: { label: "Wysoki cholesterol" },
        lowsugar: { label: "Ryzyko cukrzycy" },
        none: { label: "Żadne z tych" },
      },
    },
    {
      id: "country",
      asks: {
        country: { lines: ["Gdzie jesz?"], placeholder: "Szukaj" },
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
        other: { label: "Gdzie indziej" },
      },
    },
    {
      id: "streak",
      asks: {
        streak_goal_days: { lines: ["Jaką serię chcesz osiągnąć?"] },
      },
      options: {
        "7": { label: "7 dni" },
        "14": { label: "14 dni" },
        "30": { label: "30 dni" },
        "50": { label: "50 dni" },
      },
    },
  ],
  building: {
    lines: ["Tworzę twój osobisty plan"],
    title: "Twój plan dnia",
    rows: { calories: "Kalorie", protein: "Białko", carbs: "Węglowodany", fat: "Tłuszcz", diet: "Dieta" },
    limitCap: { ldl: "tłuszcze nasycone ≤ {n} g", kidneys: "sód ≤ {n} mg" },
    cta: "Pokaż mi plan",
    floorTitle: "Zatrzymaliśmy się na {floor} kcal",
    floorBody: "Z rachunku wychodziło mniej. Bez nadzoru lekarza nie ustalamy celów poniżej tej wartości, więc twój jest właśnie tutaj. Zobaczysz to też w swoim dzienniku.",
  },
  summary: {
    lines: ["Oto twój plan"],
    kcalLabel: "kcal dziennie",
    floorMarker: "ograniczone dla bezpieczeństwa · nigdy poniżej {floor}",
    macros: {
      protein: "Białko",
      carbs: "Węglowodany",
      fat: "Tłuszcz",
      satfat: "Tłuszcze nasycone · na twoją prośbę",
    },
    capNote: "To tempo wymaga większej dziennej zmiany, niż można bezpiecznie utrzymać, więc dostajesz bezpieczną wersję: {share}% tego, co twój organizm spala w ciągu dnia.",
    // R0 of the retention plan: onboarding ends with ONE unambiguous instruction, and the thing
    // being asked for is the first photo. "Start logging" points at a diary, which is an empty list
    // and a second decision.
    cta: "Sfotografuj swój pierwszy posiłek",
  },
};

const TR: OnboardingContent = {
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
  // Health, and a newer one moves the target on every surface, the browser included. v11 grows
  // the country question from four options to fifteen: it offered Germany, the UK, the US and
  // "Somewhere else" while the product shipped in eight languages, so a Vietnamese, Indonesian,
  // Italian, Spanish or Russian reader had exactly one true answer and it was the sentinel. The
  // labels left this file with it — a country's name is CLDR's, not an admin's. Bumped because a
  // funnel row for a four-chip screen and one for a fifteen-chip screen are not the same screen.
  // v12 is the v5 redesign's copy (issue #42): the age question asks "How old are you?" plainly,
  // and the activity options answer in plain frequencies — "A little each week" — rather than
  // effort labels. v13 (#50) drops 'No account needed to start.': the web asks for a sign-in
  // before the first question, and one content tree cannot say it on the phone only.
  // v14 is targets v2 (#81): the activity question's five levels became three — few/some/many —
  // and the sex question gained "other". A stored v13 revision carries neither, so the validator
  // retires it and every language falls back to this.
  //
  // v15 IS ONBOARDING V2 (#82): the conversation becomes Cal AI-shaped plain screens, one question
  // each — twelve screens where seven used to be, the struggles eight became five stored picks,
  // the restrictions screen split into `diet` (seven single-choice) and `medical` (multi-select,
  // "None of these" a drawn row), and the sign-up beat lands between the plan and the country.
  // A stored v14 revision names screens and asks this shape cannot satisfy, so it falls back whole.
  // v16 (#1078): the activity question's three bands became four — 0 / 1–2 / 3–4 / 5+ — and `few`
  // moved from "0–2" to "1–2". A stored v15 labels the new `few` "0–2" and has no `none` at all,
  // so `usableContent` retires it and every language falls back to this. v17 (ieat-app#2050)
  // rewrites the welcome as a title and a subtitle — "A plan built around you" — over the photo.
  version: 19,
  welcome: {
    lines: ["Fotoğrafla kalori say"],
    cta: "Başla",
    signin: "Zaten bir hesabım var",
  },
  screens: [
    {
      id: "goal",
      asks: {
        goal: { lines: ["Hedefin ne?"] },
      },
      options: {
        lose: { label: "Kilo vermek" },
        maintain: { label: "Kilomu korumak" },
        gain: { label: "Kilo almak" },
      },
    },
    {
      id: "sex",
      asks: {
        sex: { lines: ["Cinsiyetin ne?"] },
      },
      options: {
        male: { label: "Erkek" },
        female: { label: "Kadın" },
        other: { label: "Diğer" },
      },
    },
    {
      id: "age",
      asks: {
        // Asked as an AGE and stored as a year — `checkNumber` in `onboarding-chat.ts` converts.
        birth_year: {
          lines: ["Yaşın?"],
          placeholder: "Yaşın",
        },
      },
    },
    {
      id: "height",
      asks: {
        height_cm: {
          lines: ["Boy"],
          placeholder: "Boy (cm)",
        },
      },
    },
    {
      id: "weight",
      asks: {
        weight_kg: {
          lines: ["Kilon"],
          placeholder: "Kilo (kg)",
        },
      },
    },
    {
      id: "activity",
      asks: {
        activity: {
          lines: ["Günlerin ne kadar hareketli?"],
        },
      },
      options: {
        // Targets v2/#1078: four levels id'd by their icons — the range is the label, the line
        // beneath is the hint.
        none: { label: "0", hint: "Antrenman yok" },
        few: { label: "1–2", hint: "Arada bir antrenman" },
        some: { label: "3–4", hint: "Haftada birkaç antrenman" },
        many: { label: "5+", hint: "Neredeyse her gün antrenman" },
      },
    },
    {
      id: "target",
      asks: {
        target_weight_kg: {
          lines: ["Hangi kiloyu hedefliyorsun?"],
          placeholder: "Hedef kilo (kg)",
        },
      },
    },
    {
      id: "pace",
      asks: {
        pace: { lines: ["Ne hızda?"] },
      },
      options: {
        easy: { label: "Hafif" },
        steady: { label: "Düzenli" },
        push: { label: "Hızlı" },
      },
    },
    {
      id: "counted",
      asks: { counted_before: { lines: ["Daha önce kalori saydın mı?"] } },
      options: {
        never: { label: "Hiç" },
        stopped: { label: "Denemiştim, bıraktım" },
        onoff: { label: "Arada sırada" },
        now: { label: "Şimdi sayıyorum" },
      },
    },
    {
      id: "barrier",
      asks: {
        barriers: {
          lines: ["Seni ne durdurdu?", "Uyanların hepsini seç"],
          variants: {
            onoff: ["Ne engel oldu?", "Uyanların hepsini seç"],
            now: ["Neyin daha kolay olmasını isterdin?", "Uyanların hepsini seç"],
          },
        },
      },
      options: {
        too_long: { label: "Çok uzun sürüyordu" },
        forgot: { label: "Unutuyordum" },
        invisible: { label: "İşe yaradığını göremiyordum" },
        no_idea: { label: "Ne yiyeceğimi bilmiyordum" },
        stressful: { label: "Stresli geliyordu" },
        nobody: { label: "Soracak kimse yoktu" },
        creeping: { label: "Kilom sürekli geri geliyordu" },
        not_enough: { label: "Yeterince yemek zordu" },
      },
    },
    {
      id: "situation",
      asks: {
        situations: {
          lines: ["Kaydetmek ne zaman en zor?"],
          variants: { never: ["Kaydetmenin ne zaman en zor olacağını düşünüyorsun?"] },
        },
      },
      options: {
        workdays: { label: "Yoğun iş günleri" },
        eating_out: { label: "Dışarıda yemek" },
        cooking: { label: "Başkaları için yemek yapmak" },
        snacks: { label: "Atıştırmalıklar ve içecekler" },
        evenings: { label: "Akşamlar ve hafta sonları" },
      },
    },
    {
      id: "diet",
      asks: {
        diet: { lines: ["Belirli bir diyet uyguluyor musun?"] },
      },
      options: {
        balanced: { label: "Dengeli" },
        wholefood: { label: "İşlenmemiş gıdalar" },
        mediterranean: { label: "Akdeniz" },
        flexitarian: { label: "Fleksitaryen" },
        pescatarian: { label: "Pesketaryen" },
        vegetarian: { label: "Vejetaryen" },
        vegan: { label: "Vegan" },
      },
    },
    {
      id: "medical",
      asks: {
        medical: { lines: ["Tıbbi bir kısıtlaman var mı?"] },
      },
      options: {
        kidneys: { label: "Böbrek rahatsızlığı" },
        ldl: { label: "Yüksek kolesterol" },
        lowsugar: { label: "Diyabet riski" },
        none: { label: "Hiçbiri" },
      },
    },
    {
      id: "country",
      asks: {
        country: { lines: ["Nerede yemek yiyorsun?"], placeholder: "Ara" },
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
        other: { label: "Başka bir yer" },
      },
    },
    {
      id: "streak",
      asks: {
        streak_goal_days: { lines: ["Hedefleyeceğin bir seri seç"] },
      },
      options: {
        "7": { label: "7 gün" },
        "14": { label: "14 gün" },
        "30": { label: "30 gün" },
        "50": { label: "50 gün" },
      },
    },
  ],
  building: {
    lines: ["Kişisel planın hazırlanıyor"],
    title: "Günlük planın",
    rows: { calories: "Kalori", protein: "Protein", carbs: "Karbonhidrat", fat: "Yağ", diet: "Diyet" },
    limitCap: { ldl: "doymuş yağ ≤ {n} g", kidneys: "sodyum ≤ {n} mg" },
    cta: "Planı göster",
    floorTitle: "{floor} kcal'de durduk",
    floorBody: "Hesap daha aşağı inmek istedi. Tıbbi gözetim olmadan bunun altında hedef koymuyoruz, o yüzden seninki burada. Bu, günlüğünde de yazacak.",
  },
  summary: {
    lines: ["İşte planın"],
    kcalLabel: "kcal / gün",
    floorMarker: "güvenlik için sınırlı · asla {floor} altına inmez",
    macros: {
      protein: "Protein",
      carbs: "Karbonhidrat",
      fat: "Yağ",
      satfat: "Doymuş yağ · sen istedin",
    },
    capNote: "Bu tempo, güvenle sürdürülebilecekten daha büyük bir günlük değişim gerektiriyor; bu yüzden seninki güvenli sürüm: vücudunun bir günde yaktığı enerjinin %{share} kadarı.",
    // R0 of the retention plan: onboarding ends with ONE unambiguous instruction, and the thing
    // being asked for is the first photo. "Start logging" points at a diary, which is an empty list
    // and a second decision.
    cta: "İlk öğününün fotoğrafını çek",
  },
};

const ZH_HANT: OnboardingContent = {
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
  // Health, and a newer one moves the target on every surface, the browser included. v11 grows
  // the country question from four options to fifteen: it offered Germany, the UK, the US and
  // "Somewhere else" while the product shipped in eight languages, so a Vietnamese, Indonesian,
  // Italian, Spanish or Russian reader had exactly one true answer and it was the sentinel. The
  // labels left this file with it — a country's name is CLDR's, not an admin's. Bumped because a
  // funnel row for a four-chip screen and one for a fifteen-chip screen are not the same screen.
  // v12 is the v5 redesign's copy (issue #42): the age question asks "How old are you?" plainly,
  // and the activity options answer in plain frequencies — "A little each week" — rather than
  // effort labels. v13 (#50) drops 'No account needed to start.': the web asks for a sign-in
  // before the first question, and one content tree cannot say it on the phone only.
  // v14 is targets v2 (#81): the activity question's five levels became three — few/some/many —
  // and the sex question gained "other". A stored v13 revision carries neither, so the validator
  // retires it and every language falls back to this.
  //
  // v15 IS ONBOARDING V2 (#82): the conversation becomes Cal AI-shaped plain screens, one question
  // each — twelve screens where seven used to be, the struggles eight became five stored picks,
  // the restrictions screen split into `diet` (seven single-choice) and `medical` (multi-select,
  // "None of these" a drawn row), and the sign-up beat lands between the plan and the country.
  // A stored v14 revision names screens and asks this shape cannot satisfy, so it falls back whole.
  // v16 (#1078): the activity question's three bands became four — 0 / 1–2 / 3–4 / 5+ — and `few`
  // moved from "0–2" to "1–2". A stored v15 labels the new `few` "0–2" and has no `none` at all,
  // so `usableContent` retires it and every language falls back to this. v17 (ieat-app#2050)
  // rewrites the welcome as a title and a subtitle — "A plan built around you" — over the photo.
  version: 19,
  welcome: {
    lines: ["拍照算卡路里"],
    cta: "開始",
    signin: "我已經有帳號了",
  },
  screens: [
    {
      id: "goal",
      asks: {
        goal: { lines: ["你的目標是什麼？"] },
      },
      options: {
        lose: { label: "減重" },
        maintain: { label: "維持體重" },
        gain: { label: "增重" },
      },
    },
    {
      id: "sex",
      asks: {
        sex: { lines: ["你的生理性別是？"] },
      },
      options: {
        male: { label: "男性" },
        female: { label: "女性" },
        other: { label: "其他" },
      },
    },
    {
      id: "age",
      asks: {
        // Asked as an AGE and stored as a year — `checkNumber` in `onboarding-chat.ts` converts.
        birth_year: {
          lines: ["你的年齡？"],
          placeholder: "你的年齡",
        },
      },
    },
    {
      id: "height",
      asks: {
        height_cm: {
          lines: ["身高"],
          placeholder: "身高（公分）",
        },
      },
    },
    {
      id: "weight",
      asks: {
        weight_kg: {
          lines: ["你的體重"],
          placeholder: "體重（公斤）",
        },
      },
    },
    {
      id: "activity",
      asks: {
        activity: {
          lines: ["你平常的活動量如何？"],
        },
      },
      options: {
        // Targets v2/#1078: four levels id'd by their icons — the range is the label, the line
        // beneath is the hint.
        none: { label: "0", hint: "不運動" },
        few: { label: "1–2", hint: "偶爾運動" },
        some: { label: "3–4", hint: "每週運動幾次" },
        many: { label: "5+", hint: "幾乎天天訓練" },
      },
    },
    {
      id: "target",
      asks: {
        target_weight_kg: {
          lines: ["你的目標體重是多少？"],
          placeholder: "目標體重（公斤）",
        },
      },
    },
    {
      id: "pace",
      asks: {
        pace: { lines: ["想用什麼節奏？"] },
      },
      options: {
        easy: { label: "溫和" },
        steady: { label: "穩定" },
        push: { label: "較快" },
      },
    },
    {
      id: "counted",
      asks: { counted_before: { lines: ["算過卡路里嗎？"] } },
      options: {
        never: { label: "沒算過" },
        stopped: { label: "試過，後來停了" },
        onoff: { label: "斷斷續續" },
        now: { label: "現在還在算" },
      },
    },
    {
      id: "barrier",
      asks: {
        barriers: {
          lines: ["什麼讓你停下來？", "符合的都選"],
          variants: {
            onoff: ["什麼讓你卡住了？", "符合的都選"],
            now: ["你希望什麼更簡單？", "符合的都選"],
          },
        },
      },
      options: {
        too_long: { label: "太花時間" },
        forgot: { label: "常常忘記" },
        invisible: { label: "看不出效果" },
        no_idea: { label: "不知道該吃什麼" },
        stressful: { label: "壓力很大" },
        nobody: { label: "沒人可以問" },
        creeping: { label: "體重總是悄悄回升" },
        not_enough: { label: "很難吃夠" },
      },
    },
    {
      id: "situation",
      asks: {
        situations: {
          lines: ["什麼時候最難記錄？"],
          variants: { never: ["你覺得什麼時候會最難記錄？"] },
        },
      },
      options: {
        workdays: { label: "忙碌的工作日" },
        eating_out: { label: "外食" },
        cooking: { label: "幫別人煮飯" },
        snacks: { label: "零食和飲料" },
        evenings: { label: "晚上和週末" },
      },
    },
    {
      id: "diet",
      asks: {
        diet: { lines: ["你有遵循特定的飲食方式嗎？"] },
      },
      options: {
        balanced: { label: "均衡飲食" },
        wholefood: { label: "原型食物" },
        mediterranean: { label: "地中海飲食" },
        flexitarian: { label: "彈性素" },
        pescatarian: { label: "海鮮素" },
        vegetarian: { label: "蛋奶素" },
        vegan: { label: "純素" },
      },
    },
    {
      id: "medical",
      asks: {
        medical: { lines: ["有任何醫療上的限制嗎？"] },
      },
      options: {
        kidneys: { label: "腎臟疾病" },
        ldl: { label: "膽固醇偏高" },
        lowsugar: { label: "糖尿病風險" },
        none: { label: "以上皆無" },
      },
    },
    {
      id: "country",
      asks: {
        country: { lines: ["你在哪裡吃飯？"], placeholder: "搜尋" },
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
        other: { label: "其他地區" },
      },
    },
    {
      id: "streak",
      asks: {
        streak_goal_days: { lines: ["選一個想達成的連續天數"] },
      },
      options: {
        "7": { label: "7 天" },
        "14": { label: "14 天" },
        "30": { label: "30 天" },
        "50": { label: "50 天" },
      },
    },
  ],
  building: {
    lines: ["正在建立你的個人計畫"],
    title: "你的每日計畫",
    rows: { calories: "熱量", protein: "蛋白質", carbs: "碳水", fat: "脂肪", diet: "飲食" },
    limitCap: { ldl: "飽和脂肪 ≤ {n} 公克", kidneys: "鈉 ≤ {n} 毫克" },
    cta: "讓我看看計畫",
    floorTitle: "我們停在 {floor} 大卡",
    floorBody: "計算結果原本還想再往下。沒有醫療監督的情況下，我們不會設定低於這個數字的目標，所以你的目標就定在這裡。你的日記上也會註明這一點。",
  },
  summary: {
    lines: ["這是你的計畫"],
    kcalLabel: "大卡／天",
    floorMarker: "基於安全設限 · 絕不低於 {floor}",
    macros: {
      protein: "蛋白質",
      carbs: "碳水",
      fat: "脂肪",
      satfat: "飽和脂肪 · 依你的要求",
    },
    capNote: "這個節奏需要的每日落差，超過能安全維持的程度，所以你拿到的是安全版本：身體一天消耗量的 {share}%。",
    // R0 of the retention plan: onboarding ends with ONE unambiguous instruction, and the thing
    // being asked for is the first photo. "Start logging" points at a diary, which is an empty list
    // and a second decision.
    cta: "拍下你的第一餐",
  },
};

const ZH_HANS: OnboardingContent = {
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
  // Health, and a newer one moves the target on every surface, the browser included. v11 grows
  // the country question from four options to fifteen: it offered Germany, the UK, the US and
  // "Somewhere else" while the product shipped in eight languages, so a Vietnamese, Indonesian,
  // Italian, Spanish or Russian reader had exactly one true answer and it was the sentinel. The
  // labels left this file with it — a country's name is CLDR's, not an admin's. Bumped because a
  // funnel row for a four-chip screen and one for a fifteen-chip screen are not the same screen.
  // v12 is the v5 redesign's copy (issue #42): the age question asks "How old are you?" plainly,
  // and the activity options answer in plain frequencies — "A little each week" — rather than
  // effort labels. v13 (#50) drops 'No account needed to start.': the web asks for a sign-in
  // before the first question, and one content tree cannot say it on the phone only.
  // v14 is targets v2 (#81): the activity question's five levels became three — few/some/many —
  // and the sex question gained "other". A stored v13 revision carries neither, so the validator
  // retires it and every language falls back to this.
  //
  // v15 IS ONBOARDING V2 (#82): the conversation becomes Cal AI-shaped plain screens, one question
  // each — twelve screens where seven used to be, the struggles eight became five stored picks,
  // the restrictions screen split into `diet` (seven single-choice) and `medical` (multi-select,
  // "None of these" a drawn row), and the sign-up beat lands between the plan and the country.
  // A stored v14 revision names screens and asks this shape cannot satisfy, so it falls back whole.
  // v16 (#1078): the activity question's three bands became four — 0 / 1–2 / 3–4 / 5+ — and `few`
  // moved from "0–2" to "1–2". A stored v15 labels the new `few` "0–2" and has no `none` at all,
  // so `usableContent` retires it and every language falls back to this. v17 (ieat-app#2050)
  // rewrites the welcome as a title and a subtitle — "A plan built around you" — over the photo.
  version: 19,
  welcome: {
    lines: ["拍照算卡路里"],
    cta: "开始",
    signin: "我已有账户",
  },
  screens: [
    {
      id: "goal",
      asks: {
        goal: { lines: ["你想达成什么目标？"] },
      },
      options: {
        lose: { label: "减重" },
        maintain: { label: "保持体重" },
        gain: { label: "增重" },
      },
    },
    {
      id: "sex",
      asks: {
        sex: { lines: ["你的性别是？"] },
      },
      options: {
        male: { label: "男性" },
        female: { label: "女性" },
        other: { label: "其他" },
      },
    },
    {
      id: "age",
      asks: {
        // Asked as an AGE and stored as a year — `checkNumber` in `onboarding-chat.ts` converts.
        birth_year: {
          lines: ["你的年龄？"],
          placeholder: "你的年龄",
        },
      },
    },
    {
      id: "height",
      asks: {
        height_cm: {
          lines: ["身高"],
          placeholder: "身高（厘米）",
        },
      },
    },
    {
      id: "weight",
      asks: {
        weight_kg: {
          lines: ["你的体重"],
          placeholder: "体重（公斤）",
        },
      },
    },
    {
      id: "activity",
      asks: {
        activity: {
          lines: ["你平时的活动量如何？"],
        },
      },
      options: {
        // Targets v2/#1078: four levels id'd by their icons — the range is the label, the line
        // beneath is the hint.
        none: { label: "0", hint: "不锻炼" },
        few: { label: "1–2", hint: "偶尔锻炼" },
        some: { label: "3–4", hint: "每周锻炼几次" },
        many: { label: "5+", hint: "几乎每天训练" },
      },
    },
    {
      id: "target",
      asks: {
        target_weight_kg: {
          lines: ["你的目标体重是多少？"],
          placeholder: "目标体重（公斤）",
        },
      },
    },
    {
      id: "pace",
      asks: {
        pace: { lines: ["想按什么节奏？"] },
      },
      options: {
        easy: { label: "温和" },
        steady: { label: "稳定" },
        push: { label: "较快" },
      },
    },
    {
      id: "counted",
      asks: { counted_before: { lines: ["算过卡路里吗？"] } },
      options: {
        never: { label: "没算过" },
        stopped: { label: "试过，后来停了" },
        onoff: { label: "断断续续" },
        now: { label: "现在还在算" },
      },
    },
    {
      id: "barrier",
      asks: {
        barriers: {
          lines: ["是什么让你停下了？", "符合的都选"],
          variants: {
            onoff: ["是什么让你卡住了？", "符合的都选"],
            now: ["你希望什么更简单？", "符合的都选"],
          },
        },
      },
      options: {
        too_long: { label: "太花时间" },
        forgot: { label: "常常忘记" },
        invisible: { label: "看不到效果" },
        no_idea: { label: "不知道该吃什么" },
        stressful: { label: "压力很大" },
        nobody: { label: "没人可以问" },
        creeping: { label: "体重总是悄悄回升" },
        not_enough: { label: "很难吃够" },
      },
    },
    {
      id: "situation",
      asks: {
        situations: {
          lines: ["什么时候最难记录？"],
          variants: { never: ["你觉得什么时候会最难记录？"] },
        },
      },
      options: {
        workdays: { label: "忙碌的工作日" },
        eating_out: { label: "外食" },
        cooking: { label: "帮别人做饭" },
        snacks: { label: "零食和饮料" },
        evenings: { label: "晚上和周末" },
      },
    },
    {
      id: "diet",
      asks: {
        diet: { lines: ["你有遵循某种饮食方式吗？"] },
      },
      options: {
        balanced: { label: "均衡饮食" },
        wholefood: { label: "天然全食物" },
        mediterranean: { label: "地中海饮食" },
        flexitarian: { label: "弹性素食" },
        pescatarian: { label: "鱼素" },
        vegetarian: { label: "素食" },
        vegan: { label: "纯素" },
      },
    },
    {
      id: "medical",
      asks: {
        medical: { lines: ["有医疗方面的限制吗？"] },
      },
      options: {
        kidneys: { label: "肾脏疾病" },
        ldl: { label: "胆固醇偏高" },
        lowsugar: { label: "糖尿病风险" },
        none: { label: "以上都没有" },
      },
    },
    {
      id: "country",
      asks: {
        country: { lines: ["你在哪里吃饭？"], placeholder: "搜索" },
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
        other: { label: "其他地方" },
      },
    },
    {
      id: "streak",
      asks: {
        streak_goal_days: { lines: ["选一个连续记录目标"] },
      },
      options: {
        "7": { label: "7 天" },
        "14": { label: "14 天" },
        "30": { label: "30 天" },
        "50": { label: "50 天" },
      },
    },
  ],
  building: {
    lines: ["正在制定你的个人计划"],
    title: "你的每日计划",
    rows: { calories: "热量", protein: "蛋白质", carbs: "碳水", fat: "脂肪", diet: "饮食" },
    limitCap: { ldl: "饱和脂肪 ≤ {n}克", kidneys: "钠 ≤ {n}毫克" },
    cta: "查看我的计划",
    floorTitle: "我们停在了{floor}千卡",
    floorBody: "按计算本可以更低。没有医生监督，我们不会把目标设得比这更低，所以你的目标就定在这里。你的日记里也会注明这一点。",
  },
  summary: {
    lines: ["这是你的计划"],
    kcalLabel: "千卡/天",
    floorMarker: "出于安全已设限 · 绝不低于 {floor}",
    macros: {
      protein: "蛋白质",
      carbs: "碳水",
      fat: "脂肪",
      satfat: "饱和脂肪 · 按你的要求",
    },
    capNote: "这个节奏需要的每日热量差超出了能安全坚持的范围，所以你拿到的是安全版本：身体一天消耗量的 {share}%。",
    // R0 of the retention plan: onboarding ends with ONE unambiguous instruction, and the thing
    // being asked for is the first photo. "Start logging" points at a diary, which is an empty list
    // and a second decision.
    cta: "拍下你的第一餐",
  },
};

const KO: OnboardingContent = {
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
  // Health, and a newer one moves the target on every surface, the browser included. v11 grows
  // the country question from four options to fifteen: it offered Germany, the UK, the US and
  // "Somewhere else" while the product shipped in eight languages, so a Vietnamese, Indonesian,
  // Italian, Spanish or Russian reader had exactly one true answer and it was the sentinel. The
  // labels left this file with it — a country's name is CLDR's, not an admin's. Bumped because a
  // funnel row for a four-chip screen and one for a fifteen-chip screen are not the same screen.
  // v12 is the v5 redesign's copy (issue #42): the age question asks "How old are you?" plainly,
  // and the activity options answer in plain frequencies — "A little each week" — rather than
  // effort labels. v13 (#50) drops 'No account needed to start.': the web asks for a sign-in
  // before the first question, and one content tree cannot say it on the phone only.
  // v14 is targets v2 (#81): the activity question's five levels became three — few/some/many —
  // and the sex question gained "other". A stored v13 revision carries neither, so the validator
  // retires it and every language falls back to this.
  //
  // v15 IS ONBOARDING V2 (#82): the conversation becomes Cal AI-shaped plain screens, one question
  // each — twelve screens where seven used to be, the struggles eight became five stored picks,
  // the restrictions screen split into `diet` (seven single-choice) and `medical` (multi-select,
  // "None of these" a drawn row), and the sign-up beat lands between the plan and the country.
  // A stored v14 revision names screens and asks this shape cannot satisfy, so it falls back whole.
  // v16 (#1078): the activity question's three bands became four — 0 / 1–2 / 3–4 / 5+ — and `few`
  // moved from "0–2" to "1–2". A stored v15 labels the new `few` "0–2" and has no `none` at all,
  // so `usableContent` retires it and every language falls back to this. v17 (ieat-app#2050)
  // rewrites the welcome as a title and a subtitle — "A plan built around you" — over the photo.
  version: 19,
  welcome: {
    lines: ["사진으로 칼로리 계산"],
    cta: "시작하기",
    signin: "이미 계정이 있어요",
  },
  screens: [
    {
      id: "goal",
      asks: {
        goal: { lines: ["어떤 목표가 있으세요?"] },
      },
      options: {
        lose: { label: "체중 감량" },
        maintain: { label: "체중 유지" },
        gain: { label: "체중 증량" },
      },
    },
    {
      id: "sex",
      asks: {
        sex: { lines: ["성별이 어떻게 되세요?"] },
      },
      options: {
        male: { label: "남성" },
        female: { label: "여성" },
        other: { label: "기타" },
      },
    },
    {
      id: "age",
      asks: {
        // Asked as an AGE and stored as a year — `checkNumber` in `onboarding-chat.ts` converts.
        birth_year: {
          lines: ["나이?"],
          placeholder: "나이",
        },
      },
    },
    {
      id: "height",
      asks: {
        height_cm: {
          lines: ["키"],
          placeholder: "키(cm)",
        },
      },
    },
    {
      id: "weight",
      asks: {
        weight_kg: {
          lines: ["몸무게"],
          placeholder: "체중(kg)",
        },
      },
    },
    {
      id: "activity",
      asks: {
        activity: {
          lines: ["평소 얼마나 활동적이세요?"],
        },
      },
      options: {
        // Targets v2/#1078: four levels id'd by their icons — the range is the label, the line
        // beneath is the hint.
        none: { label: "0", hint: "운동 안 해요" },
        few: { label: "1–2", hint: "가끔 운동해요" },
        some: { label: "3–4", hint: "일주일에 몇 번 운동해요" },
        many: { label: "5+", hint: "거의 매일 운동해요" },
      },
    },
    {
      id: "target",
      asks: {
        target_weight_kg: {
          lines: ["목표 체중은 얼마예요?"],
          placeholder: "목표 체중(kg)",
        },
      },
    },
    {
      id: "pace",
      asks: {
        pace: { lines: ["어떤 속도로 할까요?"] },
      },
      options: {
        easy: { label: "천천히" },
        steady: { label: "꾸준히" },
        push: { label: "빠르게" },
      },
    },
    {
      id: "counted",
      asks: { counted_before: { lines: ["칼로리를 계산해 본 적 있나요?"] } },
      options: {
        never: { label: "한 번도 없어요" },
        stopped: { label: "해봤다가 그만뒀어요" },
        onoff: { label: "했다 말다 해요" },
        now: { label: "지금도 계산해요" },
      },
    },
    {
      id: "barrier",
      asks: {
        barriers: {
          lines: ["무엇 때문에 그만두셨나요?", "해당하는 것을 모두 고르세요"],
          variants: {
            onoff: ["무엇이 방해가 됐나요?", "해당하는 것을 모두 고르세요"],
            now: ["뭐가 더 쉬웠으면 하나요?", "해당하는 것을 모두 고르세요"],
          },
        },
      },
      options: {
        too_long: { label: "시간이 너무 걸려요" },
        forgot: { label: "자꾸 까먹어요" },
        invisible: { label: "효과가 눈에 안 보여요" },
        no_idea: { label: "뭘 먹어야 할지 몰라서요" },
        stressful: { label: "스트레스였어요" },
        nobody: { label: "물어볼 사람이 없어요" },
        creeping: { label: "체중이 자꾸 다시 늘어요" },
        not_enough: { label: "충분히 먹기 힘들어요" },
      },
    },
    {
      id: "situation",
      asks: {
        situations: {
          lines: ["언제 기록하기가 가장 어려워요?"],
          variants: { never: ["언제 기록하기가 가장 어려울 것 같아요?"] },
        },
      },
      options: {
        workdays: { label: "바쁜 평일" },
        eating_out: { label: "외식할 때" },
        cooking: { label: "남을 위해 요리할 때" },
        snacks: { label: "간식과 음료" },
        evenings: { label: "저녁과 주말" },
      },
    },
    {
      id: "diet",
      asks: {
        diet: { lines: ["따로 하는 식단이 있나요?"] },
      },
      options: {
        balanced: { label: "균형 잡힌 식단" },
        wholefood: { label: "자연식품 위주" },
        mediterranean: { label: "지중해식" },
        flexitarian: { label: "플렉시테리언" },
        pescatarian: { label: "페스코 베지테리언" },
        vegetarian: { label: "베지테리언" },
        vegan: { label: "비건" },
      },
    },
    {
      id: "medical",
      asks: {
        medical: { lines: ["의학적 제한이 있나요?"] },
      },
      options: {
        kidneys: { label: "신장 질환" },
        ldl: { label: "높은 콜레스테롤" },
        lowsugar: { label: "당뇨병 위험" },
        none: { label: "해당 없음" },
      },
    },
    {
      id: "country",
      asks: {
        country: { lines: ["어디서 식사하세요?"], placeholder: "검색" },
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
        other: { label: "다른 곳" },
      },
    },
    {
      id: "streak",
      asks: {
        streak_goal_days: { lines: ["목표 연속 기록을 골라 보세요"] },
      },
      options: {
        "7": { label: "7일" },
        "14": { label: "14일" },
        "30": { label: "30일" },
        "50": { label: "50일" },
      },
    },
  ],
  building: {
    lines: ["나만의 플랜을 만들고 있어요"],
    title: "하루 플랜",
    rows: { calories: "칼로리", protein: "단백질", carbs: "탄수화물", fat: "지방", diet: "식단" },
    limitCap: { ldl: "포화 지방 ≤ {n}g", kidneys: "나트륨 ≤ {n}mg" },
    cta: "플랜 보기",
    floorTitle: "{floor}kcal에서 멈췄어요",
    floorBody: "계산상으로는 더 내려갈 수 있었어요. 의료진의 관리 없이는 이보다 낮은 목표를 정하지 않아서, 여기로 맞췄어요. 다이어리에도 이렇게 표시돼요.",
  },
  summary: {
    lines: ["플랜이 준비됐어요"],
    kcalLabel: "kcal/일",
    floorMarker: "안전을 위해 제한 · {floor} 미만으로는 안 내려가요",
    macros: {
      protein: "단백질",
      carbs: "탄수화물",
      fat: "지방",
      satfat: "포화 지방 · 요청하신 항목",
    },
    capNote: "그 속도는 안전하게 유지하기 어려울 만큼 하루 변화가 커야 해서, 안전한 버전으로 맞췄어요. 몸이 하루에 소모하는 에너지의 {share}%예요.",
    // R0 of the retention plan: onboarding ends with ONE unambiguous instruction, and the thing
    // being asked for is the first photo. "Start logging" points at a diary, which is an empty list
    // and a second decision.
    cta: "첫 식사를 찍어 보세요",
  },
};

const JA: OnboardingContent = {
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
  // Health, and a newer one moves the target on every surface, the browser included. v11 grows
  // the country question from four options to fifteen: it offered Germany, the UK, the US and
  // "Somewhere else" while the product shipped in eight languages, so a Vietnamese, Indonesian,
  // Italian, Spanish or Russian reader had exactly one true answer and it was the sentinel. The
  // labels left this file with it — a country's name is CLDR's, not an admin's. Bumped because a
  // funnel row for a four-chip screen and one for a fifteen-chip screen are not the same screen.
  // v12 is the v5 redesign's copy (issue #42): the age question asks "How old are you?" plainly,
  // and the activity options answer in plain frequencies — "A little each week" — rather than
  // effort labels. v13 (#50) drops 'No account needed to start.': the web asks for a sign-in
  // before the first question, and one content tree cannot say it on the phone only.
  // v14 is targets v2 (#81): the activity question's five levels became three — few/some/many —
  // and the sex question gained "other". A stored v13 revision carries neither, so the validator
  // retires it and every language falls back to this.
  //
  // v15 IS ONBOARDING V2 (#82): the conversation becomes Cal AI-shaped plain screens, one question
  // each — twelve screens where seven used to be, the struggles eight became five stored picks,
  // the restrictions screen split into `diet` (seven single-choice) and `medical` (multi-select,
  // "None of these" a drawn row), and the sign-up beat lands between the plan and the country.
  // A stored v14 revision names screens and asks this shape cannot satisfy, so it falls back whole.
  // v16 (#1078): the activity question's three bands became four — 0 / 1–2 / 3–4 / 5+ — and `few`
  // moved from "0–2" to "1–2". A stored v15 labels the new `few` "0–2" and has no `none` at all,
  // so `usableContent` retires it and every language falls back to this. v17 (ieat-app#2050)
  // rewrites the welcome as a title and a subtitle — "A plan built around you" — over the photo.
  version: 19,
  welcome: {
    lines: ["写真でカロリー計算"],
    cta: "はじめる",
    signin: "アカウントをお持ちの方",
  },
  screens: [
    {
      id: "goal",
      asks: {
        goal: { lines: ["目標は何ですか？"] },
      },
      options: {
        lose: { label: "体重を減らす" },
        maintain: { label: "体重を維持する" },
        gain: { label: "体重を増やす" },
      },
    },
    {
      id: "sex",
      asks: {
        sex: { lines: ["性別を教えてください"] },
      },
      options: {
        male: { label: "男性" },
        female: { label: "女性" },
        other: { label: "その他" },
      },
    },
    {
      id: "age",
      asks: {
        // Asked as an AGE and stored as a year — `checkNumber` in `onboarding-chat.ts` converts.
        birth_year: {
          lines: ["年齢？"],
          placeholder: "年齢",
        },
      },
    },
    {
      id: "height",
      asks: {
        height_cm: {
          lines: ["身長"],
          placeholder: "身長（cm）",
        },
      },
    },
    {
      id: "weight",
      asks: {
        weight_kg: {
          lines: ["体重"],
          placeholder: "体重（kg）",
        },
      },
    },
    {
      id: "activity",
      asks: {
        activity: {
          lines: ["普段どのくらい体を動かしますか？"],
        },
      },
      options: {
        // Targets v2/#1078: four levels id'd by their icons — the range is the label, the line
        // beneath is the hint.
        none: { label: "0", hint: "運動なし" },
        few: { label: "1–2", hint: "ときどき運動する" },
        some: { label: "3–4", hint: "週に数回運動する" },
        many: { label: "5+", hint: "ほぼ毎日トレーニング" },
      },
    },
    {
      id: "target",
      asks: {
        target_weight_kg: {
          lines: ["目標体重はどのくらいですか？"],
          placeholder: "目標体重（kg）",
        },
      },
    },
    {
      id: "pace",
      asks: {
        pace: { lines: ["どのくらいのペースで？"] },
      },
      options: {
        easy: { label: "ゆるやか" },
        steady: { label: "着実" },
        push: { label: "速め" },
      },
    },
    {
      id: "counted",
      asks: { counted_before: { lines: ["カロリーを計算したことはありますか？"] } },
      options: {
        never: { label: "一度もない" },
        stopped: { label: "やってみて、やめた" },
        onoff: { label: "やったりやめたり" },
        now: { label: "今も計算中" },
      },
    },
    {
      id: "barrier",
      asks: {
        barriers: {
          lines: ["何が原因でやめましたか？", "あてはまるものをすべて選んでください"],
          variants: {
            onoff: ["何がじゃまになりましたか？", "あてはまるものをすべて選んでください"],
            now: ["何をもっと簡単にしたいですか？", "あてはまるものをすべて選んでください"],
          },
        },
      },
      options: {
        too_long: { label: "時間がかかりすぎた" },
        forgot: { label: "忘れてしまった" },
        invisible: { label: "効果が見えなかった" },
        no_idea: { label: "何を食べればいいか分からなかった" },
        stressful: { label: "ストレスに感じた" },
        nobody: { label: "聞ける人がいなかった" },
        creeping: { label: "体重が少しずつ戻ってきた" },
        not_enough: { label: "十分に食べるのが難しかった" },
      },
    },
    {
      id: "situation",
      asks: {
        situations: {
          lines: ["記録が難しいのはいつですか？"],
          variants: { never: ["記録が難しくなりそうなのはいつですか？"] },
        },
      },
      options: {
        workdays: { label: "忙しい平日" },
        eating_out: { label: "外食" },
        cooking: { label: "人のために料理" },
        snacks: { label: "間食と飲み物" },
        evenings: { label: "夜と週末" },
      },
    },
    {
      id: "diet",
      asks: {
        diet: { lines: ["決まった食事スタイルはありますか？"] },
      },
      options: {
        balanced: { label: "バランス重視" },
        wholefood: { label: "ホールフード" },
        mediterranean: { label: "地中海式" },
        flexitarian: { label: "フレキシタリアン" },
        pescatarian: { label: "ペスカタリアン" },
        vegetarian: { label: "ベジタリアン" },
        vegan: { label: "ヴィーガン" },
      },
    },
    {
      id: "medical",
      asks: {
        medical: { lines: ["医療上の制限はありますか？"] },
      },
      options: {
        kidneys: { label: "腎臓の疾患" },
        ldl: { label: "高コレステロール" },
        lowsugar: { label: "糖尿病のリスク" },
        none: { label: "どれも当てはまらない" },
      },
    },
    {
      id: "country",
      asks: {
        country: { lines: ["どこで食事をしますか？"], placeholder: "検索" },
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
        other: { label: "その他の地域" },
      },
    },
    {
      id: "streak",
      asks: {
        streak_goal_days: { lines: ["連続記録の目標を選びましょう"] },
      },
      options: {
        "7": { label: "7日" },
        "14": { label: "14日" },
        "30": { label: "30日" },
        "50": { label: "50日" },
      },
    },
  ],
  building: {
    lines: ["あなた専用のプランを作成中"],
    title: "1日のプラン",
    rows: { calories: "カロリー", protein: "タンパク質", carbs: "炭水化物", fat: "脂質", diet: "食事スタイル" },
    limitCap: { ldl: "飽和脂肪酸 ≤ {n}g", kidneys: "ナトリウム ≤ {n}mg" },
    cta: "プランを見る",
    floorTitle: "{floor}kcalで止めました",
    floorBody: "計算上はもっと低くなりましたが、医師の管理なしにこれより低い目標は設定しません。なので、あなたの目標はここになります。日記にもそう表示されます。",
  },
  summary: {
    lines: ["あなたのプランです"],
    kcalLabel: "kcal/日",
    floorMarker: "安全のため上限あり · {floor}未満にはなりません",
    macros: {
      protein: "タンパク質",
      carbs: "炭水化物",
      fat: "脂質",
      satfat: "飽和脂肪酸 · ご希望により",
    },
    capNote: "そのペースだと、安全に続けられる範囲を超えて毎日の摂取量を変える必要があります。そのため、安全なバージョンにしました：1日に体が消費する量の{share}%です。",
    // R0 of the retention plan: onboarding ends with ONE unambiguous instruction, and the thing
    // being asked for is the first photo. "Start logging" points at a diary, which is an empty list
    // and a second decision.
    cta: "最初の食事を撮影する",
  },
};

const PT_BR: OnboardingContent = {
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
  // Health, and a newer one moves the target on every surface, the browser included. v11 grows
  // the country question from four options to fifteen: it offered Germany, the UK, the US and
  // "Somewhere else" while the product shipped in eight languages, so a Vietnamese, Indonesian,
  // Italian, Spanish or Russian reader had exactly one true answer and it was the sentinel. The
  // labels left this file with it — a country's name is CLDR's, not an admin's. Bumped because a
  // funnel row for a four-chip screen and one for a fifteen-chip screen are not the same screen.
  // v12 is the v5 redesign's copy (issue #42): the age question asks "How old are you?" plainly,
  // and the activity options answer in plain frequencies — "A little each week" — rather than
  // effort labels. v13 (#50) drops 'No account needed to start.': the web asks for a sign-in
  // before the first question, and one content tree cannot say it on the phone only.
  // v14 is targets v2 (#81): the activity question's five levels became three — few/some/many —
  // and the sex question gained "other". A stored v13 revision carries neither, so the validator
  // retires it and every language falls back to this.
  //
  // v15 IS ONBOARDING V2 (#82): the conversation becomes Cal AI-shaped plain screens, one question
  // each — twelve screens where seven used to be, the struggles eight became five stored picks,
  // the restrictions screen split into `diet` (seven single-choice) and `medical` (multi-select,
  // "None of these" a drawn row), and the sign-up beat lands between the plan and the country.
  // A stored v14 revision names screens and asks this shape cannot satisfy, so it falls back whole.
  // v16 (#1078): the activity question's three bands became four — 0 / 1–2 / 3–4 / 5+ — and `few`
  // moved from "0–2" to "1–2". A stored v15 labels the new `few` "0–2" and has no `none` at all,
  // so `usableContent` retires it and every language falls back to this. v17 (ieat-app#2050)
  // rewrites the welcome as a title and a subtitle — "A plan built around you" — over the photo.
  version: 19,
  welcome: {
    lines: ["Conte calorias com uma foto"],
    cta: "Começar",
    signin: "Já tenho uma conta",
  },
  screens: [
    {
      id: "goal",
      asks: {
        goal: { lines: ["O que você quer alcançar?"] },
      },
      options: {
        lose: { label: "Perder peso" },
        maintain: { label: "Manter meu peso" },
        gain: { label: "Ganhar peso" },
      },
    },
    {
      id: "sex",
      asks: {
        sex: { lines: ["Qual é o seu sexo?"] },
      },
      options: {
        male: { label: "Masculino" },
        female: { label: "Feminino" },
        other: { label: "Outro" },
      },
    },
    {
      id: "age",
      asks: {
        // Asked as an AGE and stored as a year — `checkNumber` in `onboarding-chat.ts` converts.
        birth_year: {
          lines: ["Sua idade?"],
          placeholder: "Sua idade",
        },
      },
    },
    {
      id: "height",
      asks: {
        height_cm: {
          lines: ["Altura"],
          placeholder: "Altura em cm",
        },
      },
    },
    {
      id: "weight",
      asks: {
        weight_kg: {
          lines: ["Seu peso"],
          placeholder: "Peso em kg",
        },
      },
    },
    {
      id: "activity",
      asks: {
        activity: {
          lines: ["Quão ativos são seus dias?"],
        },
      },
      options: {
        // Targets v2/#1078: four levels id'd by their icons — the range is the label, the line
        // beneath is the hint.
        none: { label: "0", hint: "Sem treinos" },
        few: { label: "1–2", hint: "Treino de vez em quando" },
        some: { label: "3–4", hint: "Alguns treinos por semana" },
        many: { label: "5+", hint: "Treino quase todo dia" },
      },
    },
    {
      id: "target",
      asks: {
        target_weight_kg: {
          lines: ["Qual peso você quer alcançar?"],
          placeholder: "Peso-meta em kg",
        },
      },
    },
    {
      id: "pace",
      asks: {
        pace: { lines: ["Em que ritmo?"] },
      },
      options: {
        easy: { label: "Leve" },
        steady: { label: "Constante" },
        push: { label: "Rápido" },
      },
    },
    {
      id: "counted",
      asks: { counted_before: { lines: ["Já contou calorias?"] } },
      options: {
        never: { label: "Nunca" },
        stopped: { label: "Tentei, desisti" },
        onoff: { label: "De vez em quando" },
        now: { label: "Ainda conto" },
      },
    },
    {
      id: "barrier",
      asks: {
        barriers: {
          lines: ["O que fez você parar?", "Escolha todas que se aplicam"],
          variants: {
            onoff: ["O que atrapalhou?", "Escolha todas que se aplicam"],
            now: ["O que você gostaria que fosse mais fácil?", "Escolha todas que se aplicam"],
          },
        },
      },
      options: {
        too_long: { label: "Demorava demais" },
        forgot: { label: "Eu esquecia" },
        invisible: { label: "Não via resultados" },
        no_idea: { label: "Não sabia o que comer" },
        stressful: { label: "Era estressante" },
        nobody: { label: "Ninguém para perguntar" },
        creeping: { label: "Meu peso voltava a subir" },
        not_enough: { label: "Difícil comer o suficiente" },
      },
    },
    {
      id: "situation",
      asks: {
        situations: {
          lines: ["Quando é mais difícil registrar?"],
          variants: { never: ["Quando você acha que registrar vai ser mais difícil?"] },
        },
      },
      options: {
        workdays: { label: "Dias de trabalho cheios" },
        eating_out: { label: "Comer fora" },
        cooking: { label: "Cozinhar para outros" },
        snacks: { label: "Lanches e bebidas" },
        evenings: { label: "Fins de tarde e fins de semana" },
      },
    },
    {
      id: "diet",
      asks: {
        diet: { lines: ["Você segue alguma dieta?"] },
      },
      options: {
        balanced: { label: "Equilibrada" },
        wholefood: { label: "Alimentos integrais" },
        mediterranean: { label: "Mediterrânea" },
        flexitarian: { label: "Flexitariana" },
        pescatarian: { label: "Pescetariana" },
        vegetarian: { label: "Vegetariana" },
        vegan: { label: "Vegana" },
      },
    },
    {
      id: "medical",
      asks: {
        medical: { lines: ["Alguma restrição médica?"] },
      },
      options: {
        kidneys: { label: "Doença renal" },
        ldl: { label: "Colesterol alto" },
        lowsugar: { label: "Risco de diabetes" },
        none: { label: "Nenhuma dessas" },
      },
    },
    {
      id: "country",
      asks: {
        country: { lines: ["Onde você come?"], placeholder: "Buscar" },
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
        other: { label: "Outro lugar" },
      },
    },
    {
      id: "streak",
      asks: {
        streak_goal_days: { lines: ["Escolha uma meta de sequência"] },
      },
      options: {
        "7": { label: "7 dias" },
        "14": { label: "14 dias" },
        "30": { label: "30 dias" },
        "50": { label: "50 dias" },
      },
    },
  ],
  building: {
    lines: ["Criando seu plano pessoal"],
    title: "Seu plano diário",
    rows: { calories: "Calorias", protein: "Proteína", carbs: "Carboidratos", fat: "Gordura", diet: "Dieta" },
    limitCap: { ldl: "gordura saturada ≤ {n} g", kidneys: "sódio ≤ {n} mg" },
    cta: "Me mostra o plano",
    floorTitle: "Paramos em {floor} kcal",
    floorBody: "A conta queria ir mais baixo. Não definimos metas abaixo disso sem acompanhamento médico, então a sua fica aqui. Isso também vai aparecer no seu diário.",
  },
  summary: {
    lines: ["Aqui está seu plano"],
    kcalLabel: "kcal por dia",
    floorMarker: "limitado por segurança · nunca abaixo de {floor}",
    macros: {
      protein: "Proteína",
      carbs: "Carboidratos",
      fat: "Gordura",
      satfat: "Gordura saturada · você pediu",
    },
    capNote: "Esse ritmo exige uma mudança diária maior do que é seguro manter, então o seu é a versão segura: {share}% do que seu corpo gasta em um dia.",
    // R0 of the retention plan: onboarding ends with ONE unambiguous instruction, and the thing
    // being asked for is the first photo. "Start logging" points at a diary, which is an empty list
    // and a second decision.
    cta: "Fotografe sua primeira refeição",
  },
};

export const ONBOARDING_CONTENT: Localized<OnboardingContent> = {
  en: DEFAULT_ONBOARDING_CONTENT,
  fr: FR,
  de: DE,
  it: IT,
  es: ES,
  vi: VI,
  id: ID,
  ru: RU, te: TE, ta: TA, pa: PA, or: OR, mr: MR, ml: ML, kn: KN, gu: GU, bn: BN, "pt-PT": PT_PT, ms: MS, ca: CA, sl: SL, hr: HR, sk: SK, no: NO, fi: FI, da: DA, hu: HU, el: EL, ro: RO, cs: CS, hi: HI, th: TH, sv: SV, uk: UK, nl: NL, pl: PL, tr: TR, "zh-Hant": ZH_HANT, "zh-Hans": ZH_HANS, ko: KO, ja: JA, "pt-BR": PT_BR,
};

/**
 * What the admin has saved, as the row holds it: a revision per language, and never all of them.
 *
 * `Partial` rather than `Localized`, deliberately — a stored set with no English in it is a host
 * whose admin has edited German and nothing else, which is ordinary. `Localized`'s required `en` is
 * a promise about the COMPILED-IN tables, where it is what makes the fallback total; a stored row
 * is an overlay on those and is allowed to be as sparse as an admin's afternoon.
 */
export type OnboardingContentSet = Partial<Record<Lang, OnboardingContent>>;

/** The compiled-in copy for one language. English for one nobody has written yet. */
export const onboardingContentFor = (lang: Lang): OnboardingContent => t(lang)(ONBOARDING_CONTENT);

/**
 * The stored revision for ONE language, or that language's compiled-in copy.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE ADMIN'S SAVE IS PER LANGUAGE, AND THE ROW HOLDS ALL OF THEM
 *
 * `onboarding_content` is one row of jsonb and stays one row: what changed is that the JSON is now
 * `Localized<OnboardingContent>` instead of a bare one. No column, no migration, no second table —
 * and, more to the point, no way for a save in one language to serve itself to a reader of another.
 * An admin edits German, Germans see it, and the Italian a phone renders is the compiled-in one
 * until somebody writes an Italian revision.
 *
 * A LEGACY ROW IS ENGLISH, because English was all there was when it was written. Reading it as
 * every language would hand a German the English an admin typed in 2026 — the exact failure the
 * per-language fallback exists to prevent — so a bare `OnboardingContent` is adopted for `en` only.
 *
 * Each language then goes through `usableContent`, which is the SAME old-app/new-server guard as
 * before, with THIS language's compiled-in copy as the fallback rather than English.
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 */
export function usableContentFor(lang: Lang, stored: unknown): OnboardingContent {
  const fallback = onboardingContentFor(lang);
  if (typeof stored !== "object" || stored === null) return fallback;
  // A bare revision — the shape saved before this branch. English, and nothing else.
  const legacy = Array.isArray((stored as { screens?: unknown }).screens);
  const candidate = legacy ? (lang === "en" ? stored : undefined) : (stored as Record<string, unknown>)[lang];
  return candidate === undefined ? fallback : usableContent(candidate, fallback);
}

/** Every language's stored revision, read back for a save that must not clobber its neighbours. */
export function storedContentSet(stored: unknown): OnboardingContentSet {
  if (typeof stored !== "object" || stored === null) return {};
  if (Array.isArray((stored as { screens?: unknown }).screens)) return { en: stored as OnboardingContent };
  return { ...(stored as OnboardingContentSet) };
}
