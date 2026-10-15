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
    lines: ["Un plan pensé pour toi", "Ton objectif, ta journée, tes repas"],
    cta: "Créer mon plan",
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
      asks: { birth_year: { lines: ["Quel âge as-tu ?"], placeholder: "Ton âge" } },
    },
    {
      id: "height",
      asks: { height_cm: { lines: ["Quelle est ta taille ?"], placeholder: "Taille en cm" } },
    },
    {
      id: "weight",
      asks: { weight_kg: { lines: ["Combien pèses-tu aujourd'hui ?"], placeholder: "Poids en kg" } },
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
      id: "struggles",
      asks: { struggles: { lines: ["Qu'est-ce qui a été le plus dur ?"] } },
      options: {
        consistency: { label: "Manque de régularité" },
        habits: { label: "Habitudes alimentaires malsaines" },
        support: { label: "Manque de soutien" },
        busy: { label: "Emploi du temps chargé" },
        ideas: { label: "Manque d'idées de repas" },
      },
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
      asks: { country: { lines: ["Où habites-tu ?"], placeholder: "Rechercher" } },
      enabled: true,
      options: { other: { label: "Ailleurs" } },
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
    lines: ["Ein Plan, der zu dir passt", "Dein Ziel, dein Tag, deine Mahlzeiten"],
    cta: "Meinen Plan erstellen",
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
      asks: { birth_year: { lines: ["Wie alt bist du?"], placeholder: "Dein Alter" } },
    },
    {
      id: "height",
      asks: { height_cm: { lines: ["Wie groß bist du?"], placeholder: "Größe in cm" } },
    },
    {
      id: "weight",
      asks: { weight_kg: { lines: ["Was wiegst du heute?"], placeholder: "Gewicht in kg" } },
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
      id: "struggles",
      asks: { struggles: { lines: ["Was war bisher am schwersten?"] } },
      options: {
        consistency: { label: "Mangelnde Regelmäßigkeit" },
        habits: { label: "Ungesunde Essgewohnheiten" },
        support: { label: "Fehlende Unterstützung" },
        busy: { label: "Voller Terminkalender" },
        ideas: { label: "Fehlende Essensideen" },
      },
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
      asks: { country: { lines: ["Wo wohnst du?"], placeholder: "Suchen" } },
      enabled: true,
      options: { other: { label: "Woanders" } },
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
    lines: ["Un piano costruito su di te", "Il tuo obiettivo, la tua giornata, i tuoi pasti"],
    cta: "Crea il mio piano",
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
      asks: { birth_year: { lines: ["Quanti anni hai?"], placeholder: "La tua età" } },
    },
    {
      id: "height",
      asks: { height_cm: { lines: ["Qual è la tua altezza?"], placeholder: "Altezza in cm" } },
    },
    {
      id: "weight",
      asks: { weight_kg: { lines: ["Quanto pesi oggi?"], placeholder: "Peso in kg" } },
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
      id: "struggles",
      asks: { struggles: { lines: ["Cosa è stato più difficile?"] } },
      options: {
        consistency: { label: "Poca costanza" },
        habits: { label: "Abitudini alimentari sbagliate" },
        support: { label: "Poco sostegno" },
        busy: { label: "Agenda piena" },
        ideas: { label: "Poche idee per i pasti" },
      },
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
      asks: { country: { lines: ["Dove vivi?"], placeholder: "Cerca" } },
      enabled: true,
      options: { other: { label: "Altrove" } },
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
    lines: ["Un plan hecho a tu medida", "Tu objetivo, tu día, tus comidas"],
    cta: "Crear mi plan",
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
      asks: { birth_year: { lines: ["¿Qué edad tienes?"], placeholder: "Tu edad" } },
    },
    {
      id: "height",
      asks: { height_cm: { lines: ["¿Cuánto mides?"], placeholder: "Altura en cm" } },
    },
    {
      id: "weight",
      asks: { weight_kg: { lines: ["¿Cuánto pesas hoy?"], placeholder: "Peso en kg" } },
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
      id: "struggles",
      asks: { struggles: { lines: ["¿Qué te ha costado más?"] } },
      options: {
        consistency: { label: "Falta de constancia" },
        habits: { label: "Hábitos de comida poco sanos" },
        support: { label: "Falta de apoyo" },
        busy: { label: "Agenda ocupada" },
        ideas: { label: "Falta de ideas para comer" },
      },
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
      asks: { country: { lines: ["¿Dónde vives?"], placeholder: "Buscar" } },
      enabled: true,
      options: { other: { label: "En otro sitio" } },
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
    lines: ["Kế hoạch dành riêng cho bạn", "Mục tiêu của bạn, ngày của bạn, bữa ăn của bạn"],
    cta: "Lập kế hoạch cho mình",
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
      asks: { birth_year: { lines: ["Bạn bao nhiêu tuổi?"], placeholder: "Tuổi của bạn" } },
    },
    {
      id: "height",
      asks: { height_cm: { lines: ["Bạn cao bao nhiêu?"], placeholder: "Chiều cao (cm)" } },
    },
    {
      id: "weight",
      asks: { weight_kg: { lines: ["Hôm nay bạn nặng bao nhiêu?"], placeholder: "Cân nặng (kg)" } },
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
      id: "struggles",
      asks: { struggles: { lines: ["Điều gì đã khó nhất với bạn?"] } },
      options: {
        consistency: { label: "Thiếu kiên trì" },
        habits: { label: "Thói quen ăn không lành mạnh" },
        support: { label: "Thiếu hỗ trợ" },
        busy: { label: "Lịch trình bận rộn" },
        ideas: { label: "Thiếu ý tưởng cho bữa ăn" },
      },
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
      asks: { country: { lines: ["Bạn sống ở đâu?"], placeholder: "Tìm kiếm" } },
      enabled: true,
      options: { other: { label: "Nơi khác" } },
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
    lines: ["Rencana yang dibuat untukmu", "Tujuanmu, harimu, makananmu"],
    cta: "Buat rencana aku",
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
      asks: { birth_year: { lines: ["Berapa usiamu?"], placeholder: "Umurmu" } },
    },
    {
      id: "height",
      asks: { height_cm: { lines: ["Berapa tinggimu?"], placeholder: "Tinggi dalam cm" } },
    },
    {
      id: "weight",
      asks: { weight_kg: { lines: ["Berapa berat badanmu hari ini?"], placeholder: "Berat dalam kg" } },
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
      id: "struggles",
      asks: { struggles: { lines: ["Apa yang selama ini paling sulit?"] } },
      options: {
        consistency: { label: "Kurang konsisten" },
        habits: { label: "Kebiasaan makan tidak sehat" },
        support: { label: "Kurang dukungan" },
        busy: { label: "Jadwal padat" },
        ideas: { label: "Kurang ide menu" },
      },
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
      asks: { country: { lines: ["Kamu tinggal di mana?"], placeholder: "Cari" } },
      enabled: true,
      options: { other: { label: "Di tempat lain" } },
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
    lines: ["План, созданный под тебя", "Твоя цель, твой день, твоя еда"],
    cta: "Создать мой план",
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
      asks: { birth_year: { lines: ["Сколько тебе лет?"], placeholder: "Твой возраст" } },
    },
    {
      id: "height",
      asks: { height_cm: { lines: ["Какой у тебя рост?"], placeholder: "Рост в см" } },
    },
    {
      id: "weight",
      asks: { weight_kg: { lines: ["Сколько ты сейчас весишь?"], placeholder: "Вес в кг" } },
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
      id: "struggles",
      asks: { struggles: { lines: ["Что давалось труднее всего?"] } },
      options: {
        consistency: { label: "Не хватает постоянства" },
        habits: { label: "Нездоровые пищевые привычки" },
        support: { label: "Не хватает поддержки" },
        busy: { label: "Плотный график" },
        ideas: { label: "Не хватает идей для еды" },
      },
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
      asks: { country: { lines: ["Где ты живёшь?"], placeholder: "Поиск" } },
      enabled: true,
      options: { other: { label: "Где-то ещё" } },
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
  version: 17,
  welcome: {
    lines: ["Um plano feito à tua medida", "O teu objetivo, o teu dia, as tuas refeições"],
    cta: "Criar o meu plano",
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
          lines: ["Qual é a tua idade?"],
          placeholder: "A tua idade",
        },
      },
    },
    {
      id: "height",
      asks: {
        height_cm: {
          lines: ["Qual é a tua altura?"],
          placeholder: "Altura em cm",
        },
      },
    },
    {
      id: "weight",
      asks: {
        weight_kg: {
          lines: ["Quanto pesas hoje?"],
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
      id: "struggles",
      asks: {
        struggles: { lines: ["O que tem sido difícil?"] },
      },
      options: {
        consistency: { label: "Falta de constância" },
        habits: { label: "Hábitos alimentares pouco saudáveis" },
        support: { label: "Falta de apoio" },
        busy: { label: "Agenda cheia" },
        ideas: { label: "Falta de ideias para refeições" },
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
        country: { lines: ["Onde vives?"], placeholder: "Pesquisar" },
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
  version: 17,
  welcome: {
    lines: ["Pelan yang dibina untuk anda", "Matlamat anda, hari anda, hidangan anda"],
    cta: "Bina pelan saya",
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
          lines: ["Berapa umur anda?"],
          placeholder: "Umur anda",
        },
      },
    },
    {
      id: "height",
      asks: {
        height_cm: {
          lines: ["Berapa tinggi anda?"],
          placeholder: "Tinggi dalam cm",
        },
      },
    },
    {
      id: "weight",
      asks: {
        weight_kg: {
          lines: ["Berapa berat anda hari ini?"],
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
      id: "struggles",
      asks: {
        struggles: { lines: ["Apa yang sukar selama ini?"] },
      },
      options: {
        consistency: { label: "Kurang konsisten" },
        habits: { label: "Tabiat makan tidak sihat" },
        support: { label: "Kurang sokongan" },
        busy: { label: "Jadual sibuk" },
        ideas: { label: "Kurang idea hidangan" },
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
        country: { lines: ["Di mana anda tinggal?"], placeholder: "Cari" },
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
  version: 17,
  welcome: {
    lines: ["Un pla fet a la teva mida", "La teva meta, el teu dia, els teus àpats"],
    cta: "Crea el meu pla",
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
          lines: ["Quina edat tens?"],
          placeholder: "La teva edat",
        },
      },
    },
    {
      id: "height",
      asks: {
        height_cm: {
          lines: ["Quant fas d'alçada?"],
          placeholder: "Alçada en cm",
        },
      },
    },
    {
      id: "weight",
      asks: {
        weight_kg: {
          lines: ["Quant peses avui?"],
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
      id: "struggles",
      asks: {
        struggles: { lines: ["Què t'ha costat?"] },
      },
      options: {
        consistency: { label: "Falta de constància" },
        habits: { label: "Hàbits alimentaris poc saludables" },
        support: { label: "Falta de suport" },
        busy: { label: "Agenda atapeïda" },
        ideas: { label: "Falta d'idees per als àpats" },
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
        country: { lines: ["On vius?"], placeholder: "Cerca" },
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
  version: 17,
  welcome: {
    lines: ["Načrt, narejen po tvoji meri", "Tvoj cilj, tvoj dan, tvoji obroki"],
    cta: "Sestavi moj načrt",
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
          lines: ["Koliko let imaš?"],
          placeholder: "Tvoja starost",
        },
      },
    },
    {
      id: "height",
      asks: {
        height_cm: {
          lines: ["Kolikšna je tvoja višina?"],
          placeholder: "Višina v cm",
        },
      },
    },
    {
      id: "weight",
      asks: {
        weight_kg: {
          lines: ["Koliko tehtaš danes?"],
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
      id: "struggles",
      asks: {
        struggles: { lines: ["Kaj ti je bilo težko?"] },
      },
      options: {
        consistency: { label: "Pomanjkanje doslednosti" },
        habits: { label: "Nezdrave prehranjevalne navade" },
        support: { label: "Pomanjkanje podpore" },
        busy: { label: "Natrpan urnik" },
        ideas: { label: "Pomanjkanje idej za obroke" },
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
        country: { lines: ["Kje živiš?"], placeholder: "Iskanje" },
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
  version: 17,
  welcome: {
    lines: ["Plan po tvojoj mjeri", "Tvoj cilj, tvoj dan, tvoji obroci"],
    cta: "Izradi moj plan",
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
          lines: ["Koliko imaš godina?"],
          placeholder: "Tvoja dob",
        },
      },
    },
    {
      id: "height",
      asks: {
        height_cm: {
          lines: ["Kolika ti je visina?"],
          placeholder: "Visina u cm",
        },
      },
    },
    {
      id: "weight",
      asks: {
        weight_kg: {
          lines: ["Kolika ti je težina danas?"],
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
      id: "struggles",
      asks: {
        struggles: { lines: ["Što ti je bilo teško?"] },
      },
      options: {
        consistency: { label: "Nedostatak dosljednosti" },
        habits: { label: "Nezdrave prehrambene navike" },
        support: { label: "Nedostatak podrške" },
        busy: { label: "Prenatrpan raspored" },
        ideas: { label: "Nedostatak ideja za obroke" },
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
        country: { lines: ["Gdje živiš?"], placeholder: "Traži" },
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
  version: 17,
  welcome: {
    lines: ["Plán postavený okolo teba", "Tvoj cieľ, tvoj deň, tvoje jedlá"],
    cta: "Vytvoriť môj plán",
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
          lines: ["Koľko máš rokov?"],
          placeholder: "Tvoj vek",
        },
      },
    },
    {
      id: "height",
      asks: {
        height_cm: {
          lines: ["Aká je tvoja výška?"],
          placeholder: "Výška v cm",
        },
      },
    },
    {
      id: "weight",
      asks: {
        weight_kg: {
          lines: ["Koľko dnes vážiš?"],
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
      id: "struggles",
      asks: {
        struggles: { lines: ["Čo ti doteraz šlo ťažko?"] },
      },
      options: {
        consistency: { label: "Nedostatok pravidelnosti" },
        habits: { label: "Nezdravé stravovacie návyky" },
        support: { label: "Nedostatok podpory" },
        busy: { label: "Nabitý program" },
        ideas: { label: "Nedostatok nápadov na jedlá" },
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
        country: { lines: ["Kde žiješ?"], placeholder: "Hľadať" },
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
  version: 17,
  welcome: {
    lines: ["En plan bygd rundt deg", "Målet ditt, dagen din, måltidene dine"],
    cta: "Lag planen min",
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
          lines: ["Hvor gammel er du?"],
          placeholder: "Alderen din",
        },
      },
    },
    {
      id: "height",
      asks: {
        height_cm: {
          lines: ["Hvor høy er du?"],
          placeholder: "Høyde i cm",
        },
      },
    },
    {
      id: "weight",
      asks: {
        weight_kg: {
          lines: ["Hva veier du i dag?"],
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
      id: "struggles",
      asks: {
        struggles: { lines: ["Hva har vært vanskelig?"] },
      },
      options: {
        consistency: { label: "Mangel på regelmessighet" },
        habits: { label: "Usunne matvaner" },
        support: { label: "Mangel på støtte" },
        busy: { label: "Travel hverdag" },
        ideas: { label: "Mangel på matinspirasjon" },
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
        country: { lines: ["Hvor bor du?"], placeholder: "Søk" },
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
  version: 17,
  welcome: {
    lines: ["Sinun ympärillesi rakennettu suunnitelma", "Sinun tavoitteesi, päiväsi ja ateriasi"],
    cta: "Rakenna suunnitelmani",
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
          lines: ["Kuinka vanha olet?"],
          placeholder: "Ikäsi",
        },
      },
    },
    {
      id: "height",
      asks: {
        height_cm: {
          lines: ["Kuinka pitkä olet?"],
          placeholder: "Pituus, cm",
        },
      },
    },
    {
      id: "weight",
      asks: {
        weight_kg: {
          lines: ["Paljonko painat tänään?"],
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
      id: "struggles",
      asks: {
        struggles: { lines: ["Mikä on ollut vaikeaa?"] },
      },
      options: {
        consistency: { label: "Säännöllisyyden puute" },
        habits: { label: "Epäterveelliset ruokatottumukset" },
        support: { label: "Tuen puute" },
        busy: { label: "Kiireinen aikataulu" },
        ideas: { label: "Ateriaideoiden puute" },
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
        country: { lines: ["Missä asut?"], placeholder: "Hae" },
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
  version: 17,
  welcome: {
    lines: ["En plan bygget op om dig", "Dit mål, din dag, dine måltider"],
    cta: "Lav min plan",
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
          lines: ["Hvor gammel er du?"],
          placeholder: "Din alder",
        },
      },
    },
    {
      id: "height",
      asks: {
        height_cm: {
          lines: ["Hvor høj er du?"],
          placeholder: "Højde i cm",
        },
      },
    },
    {
      id: "weight",
      asks: {
        weight_kg: {
          lines: ["Hvad vejer du i dag?"],
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
      id: "struggles",
      asks: {
        struggles: { lines: ["Hvad har været svært?"] },
      },
      options: {
        consistency: { label: "Manglende kontinuitet" },
        habits: { label: "Usunde spisevaner" },
        support: { label: "Manglende støtte" },
        busy: { label: "Travl hverdag" },
        ideas: { label: "Mangel på madidéer" },
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
        country: { lines: ["Hvor bor du?"], placeholder: "Søg" },
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
  version: 17,
  welcome: {
    lines: ["Rád szabott terv", "A célod, a napod, az étkezéseid"],
    cta: "Kérem a tervem",
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
          lines: ["Hány éves vagy?"],
          placeholder: "Életkorod",
        },
      },
    },
    {
      id: "height",
      asks: {
        height_cm: {
          lines: ["Milyen magas vagy?"],
          placeholder: "Magasság cm-ben",
        },
      },
    },
    {
      id: "weight",
      asks: {
        weight_kg: {
          lines: ["Mennyi ma a testsúlyod?"],
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
      id: "struggles",
      asks: {
        struggles: { lines: ["Mi volt eddig nehéz?"] },
      },
      options: {
        consistency: { label: "Következetesség hiánya" },
        habits: { label: "Egészségtelen étkezési szokások" },
        support: { label: "Támogatás hiánya" },
        busy: { label: "Zsúfolt napirend" },
        ideas: { label: "Ötlethiány az étkezésekhez" },
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
        country: { lines: ["Hol élsz?"], placeholder: "Keresés" },
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
  version: 17,
  welcome: {
    lines: ["Ένα πλάνο φτιαγμένο για σένα", "Ο στόχος σου, η μέρα σου, τα γεύματά σου"],
    cta: "Φτιάξε το πλάνο μου",
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
          lines: ["Πόσο χρονών είσαι;"],
          placeholder: "Η ηλικία σου",
        },
      },
    },
    {
      id: "height",
      asks: {
        height_cm: {
          lines: ["Ποιο είναι το ύψος σου;"],
          placeholder: "Ύψος σε cm",
        },
      },
    },
    {
      id: "weight",
      asks: {
        weight_kg: {
          lines: ["Πόσο ζυγίζεις σήμερα;"],
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
      id: "struggles",
      asks: {
        struggles: { lines: ["Τι σε δυσκόλευε;"] },
      },
      options: {
        consistency: { label: "Έλλειψη συνέπειας" },
        habits: { label: "Ανθυγιεινές διατροφικές συνήθειες" },
        support: { label: "Έλλειψη υποστήριξης" },
        busy: { label: "Πιεσμένο πρόγραμμα" },
        ideas: { label: "Έλλειψη ιδεών για φαγητό" },
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
        country: { lines: ["Πού μένεις;"], placeholder: "Αναζήτηση" },
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
  version: 17,
  welcome: {
    lines: ["Un plan construit în jurul tău", "Obiectivul tău, ziua ta, mesele tale"],
    cta: "Construiește-mi planul",
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
          lines: ["Câți ani ai?"],
          placeholder: "Vârsta ta",
        },
      },
    },
    {
      id: "height",
      asks: {
        height_cm: {
          lines: ["Ce înălțime ai?"],
          placeholder: "Înălțimea în cm",
        },
      },
    },
    {
      id: "weight",
      asks: {
        weight_kg: {
          lines: ["Cât cântărești azi?"],
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
      id: "struggles",
      asks: {
        struggles: { lines: ["Ce a fost greu?"] },
      },
      options: {
        consistency: { label: "Lipsa de consecvență" },
        habits: { label: "Obiceiuri alimentare nesănătoase" },
        support: { label: "Lipsa de sprijin" },
        busy: { label: "Program încărcat" },
        ideas: { label: "Lipsa de idei pentru mese" },
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
        country: { lines: ["Unde locuiești?"], placeholder: "Caută" },
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
  version: 17,
  welcome: {
    lines: ["Plán postavený kolem tebe", "Tvůj cíl, tvůj den, tvoje jídla"],
    cta: "Sestavit můj plán",
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
          lines: ["Kolik ti je let?"],
          placeholder: "Tvůj věk",
        },
      },
    },
    {
      id: "height",
      asks: {
        height_cm: {
          lines: ["Jaká je tvoje výška?"],
          placeholder: "Výška v cm",
        },
      },
    },
    {
      id: "weight",
      asks: {
        weight_kg: {
          lines: ["Kolik dnes vážíš?"],
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
      id: "struggles",
      asks: {
        struggles: { lines: ["Co ti dělalo potíže?"] },
      },
      options: {
        consistency: { label: "Chybí vytrvalost" },
        habits: { label: "Nezdravé stravovací návyky" },
        support: { label: "Chybí podpora" },
        busy: { label: "Nabitý program" },
        ideas: { label: "Chybí inspirace k jídlu" },
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
        country: { lines: ["Kde žiješ?"], placeholder: "Hledat" },
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
  version: 17,
  welcome: {
    lines: ["आपके हिसाब से बना प्लान", "आपका लक्ष्य, आपका दिन, आपका भोजन"],
    cta: "मेरा प्लान बनाएँ",
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
          lines: ["आपकी उम्र क्या है?"],
          placeholder: "आपकी उम्र",
        },
      },
    },
    {
      id: "height",
      asks: {
        height_cm: {
          lines: ["आपकी लंबाई कितनी है?"],
          placeholder: "लंबाई cm में",
        },
      },
    },
    {
      id: "weight",
      asks: {
        weight_kg: {
          lines: ["आज आपका वज़न कितना है?"],
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
      id: "struggles",
      asks: {
        struggles: { lines: ["क्या मुश्किल रहा है?"] },
      },
      options: {
        consistency: { label: "निरंतरता की कमी" },
        habits: { label: "खाने की अस्वस्थ आदतें" },
        support: { label: "सपोर्ट की कमी" },
        busy: { label: "व्यस्त दिनचर्या" },
        ideas: { label: "भोजन के आइडिया की कमी" },
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
        country: { lines: ["आपका देश कौन-सा है?"], placeholder: "खोजें" },
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
  version: 17,
  welcome: {
    lines: ["แผนที่สร้างมาเพื่อคุณ", "เป้าหมายของคุณ วันของคุณ มื้ออาหารของคุณ"],
    cta: "สร้างแผนของฉัน",
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
          lines: ["คุณอายุเท่าไหร่?"],
          placeholder: "อายุของคุณ",
        },
      },
    },
    {
      id: "height",
      asks: {
        height_cm: {
          lines: ["คุณสูงเท่าไหร่?"],
          placeholder: "ส่วนสูงเป็น ซม.",
        },
      },
    },
    {
      id: "weight",
      asks: {
        weight_kg: {
          lines: ["วันนี้คุณหนักเท่าไหร่?"],
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
      id: "struggles",
      asks: {
        struggles: { lines: ["อะไรที่ผ่านมายากที่สุด?"] },
      },
      options: {
        consistency: { label: "ทำได้ไม่สม่ำเสมอ" },
        habits: { label: "นิสัยการกินที่ไม่ดีต่อสุขภาพ" },
        support: { label: "ขาดคนสนับสนุน" },
        busy: { label: "ตารางชีวิตยุ่ง" },
        ideas: { label: "คิดเมนูไม่ออก" },
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
        country: { lines: ["คุณอาศัยอยู่ที่ไหน?"], placeholder: "ค้นหา" },
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
  version: 17,
  welcome: {
    lines: ["En plan byggd kring dig", "Ditt mål, din dag, dina måltider"],
    cta: "Skapa min plan",
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
          lines: ["Hur gammal är du?"],
          placeholder: "Din ålder",
        },
      },
    },
    {
      id: "height",
      asks: {
        height_cm: {
          lines: ["Hur lång är du?"],
          placeholder: "Längd i cm",
        },
      },
    },
    {
      id: "weight",
      asks: {
        weight_kg: {
          lines: ["Vad väger du i dag?"],
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
      id: "struggles",
      asks: {
        struggles: { lines: ["Vad har varit svårt?"] },
      },
      options: {
        consistency: { label: "Brist på regelbundenhet" },
        habits: { label: "Ohälsosamma matvanor" },
        support: { label: "Brist på stöd" },
        busy: { label: "Fullt schema" },
        ideas: { label: "Brist på matinspiration" },
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
        country: { lines: ["Var bor du?"], placeholder: "Sök" },
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
  version: 17,
  welcome: {
    lines: ["План, створений під тебе", "Твоя мета, твій день, твоя їжа"],
    cta: "Створити мій план",
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
          lines: ["Скільки тобі років?"],
          placeholder: "Твій вік",
        },
      },
    },
    {
      id: "height",
      asks: {
        height_cm: {
          lines: ["Який у тебе зріст?"],
          placeholder: "Зріст у см",
        },
      },
    },
    {
      id: "weight",
      asks: {
        weight_kg: {
          lines: ["Скільки ти зараз важиш?"],
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
      id: "struggles",
      asks: {
        struggles: { lines: ["Що давалося найважче?"] },
      },
      options: {
        consistency: { label: "Бракує сталості" },
        habits: { label: "Нездорові харчові звички" },
        support: { label: "Бракує підтримки" },
        busy: { label: "Щільний графік" },
        ideas: { label: "Бракує ідей для їжі" },
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
        country: { lines: ["Де ти живеш?"], placeholder: "Пошук" },
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
  version: 17,
  welcome: {
    lines: ["Een plan dat om jou draait", "Jouw doel, jouw dag, jouw maaltijden"],
    cta: "Maak mijn plan",
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
          lines: ["Hoe oud ben je?"],
          placeholder: "Je leeftijd",
        },
      },
    },
    {
      id: "height",
      asks: {
        height_cm: {
          lines: ["Hoe lang ben je?"],
          placeholder: "Lengte in cm",
        },
      },
    },
    {
      id: "weight",
      asks: {
        weight_kg: {
          lines: ["Wat weeg je vandaag?"],
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
      id: "struggles",
      asks: {
        struggles: { lines: ["Wat was er lastig?"] },
      },
      options: {
        consistency: { label: "Gebrek aan regelmaat" },
        habits: { label: "Ongezonde eetgewoontes" },
        support: { label: "Gebrek aan steun" },
        busy: { label: "Druk schema" },
        ideas: { label: "Gebrek aan maaltijdideeën" },
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
        country: { lines: ["Waar woon je?"], placeholder: "Zoek" },
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
  version: 17,
  welcome: {
    lines: ["Plan stworzony dla ciebie", "Twój cel, twój dzień, twoje posiłki"],
    cta: "Stwórz mój plan",
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
          lines: ["Ile masz lat?"],
          placeholder: "Twój wiek",
        },
      },
    },
    {
      id: "height",
      asks: {
        height_cm: {
          lines: ["Ile masz wzrostu?"],
          placeholder: "Wzrost w cm",
        },
      },
    },
    {
      id: "weight",
      asks: {
        weight_kg: {
          lines: ["Ile dziś ważysz?"],
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
      id: "struggles",
      asks: {
        struggles: { lines: ["Co było najtrudniejsze?"] },
      },
      options: {
        consistency: { label: "Brak regularności" },
        habits: { label: "Niezdrowe nawyki żywieniowe" },
        support: { label: "Brak wsparcia" },
        busy: { label: "Napięty grafik" },
        ideas: { label: "Brak pomysłów na posiłki" },
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
        country: { lines: ["Gdzie mieszkasz?"], placeholder: "Szukaj" },
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
  version: 17,
  welcome: {
    lines: ["Sana göre kurulmuş bir plan", "Hedefin, günün, öğünlerin"],
    cta: "Planımı oluştur",
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
          lines: ["Kaç yaşındasın?"],
          placeholder: "Yaşın",
        },
      },
    },
    {
      id: "height",
      asks: {
        height_cm: {
          lines: ["Boyun kaç?"],
          placeholder: "Boy (cm)",
        },
      },
    },
    {
      id: "weight",
      asks: {
        weight_kg: {
          lines: ["Bugün kaç kilosun?"],
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
      id: "struggles",
      asks: {
        struggles: { lines: ["Şimdiye kadar en çok ne zorladı?"] },
      },
      options: {
        consistency: { label: "Süreklilik eksikliği" },
        habits: { label: "Sağlıksız beslenme alışkanlıkları" },
        support: { label: "Destek eksikliği" },
        busy: { label: "Yoğun program" },
        ideas: { label: "Yemek fikri eksikliği" },
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
        country: { lines: ["Nerede yaşıyorsun?"], placeholder: "Ara" },
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
  version: 17,
  welcome: {
    lines: ["為你量身打造的計畫", "你的目標、你的日常、你的餐點"],
    cta: "建立我的計畫",
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
          lines: ["你幾歲？"],
          placeholder: "你的年齡",
        },
      },
    },
    {
      id: "height",
      asks: {
        height_cm: {
          lines: ["你的身高是？"],
          placeholder: "身高（公分）",
        },
      },
    },
    {
      id: "weight",
      asks: {
        weight_kg: {
          lines: ["你今天的體重是？"],
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
      id: "struggles",
      asks: {
        struggles: { lines: ["過去最難的是什麼？"] },
      },
      options: {
        consistency: { label: "難以持之以恆" },
        habits: { label: "不健康的飲食習慣" },
        support: { label: "缺乏支持" },
        busy: { label: "行程太忙" },
        ideas: { label: "缺少餐點靈感" },
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
        country: { lines: ["你住在哪裡？"], placeholder: "搜尋" },
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
  version: 17,
  welcome: {
    lines: ["为你量身定制的计划", "你的目标、你的一天、你的饮食"],
    cta: "制定我的计划",
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
          lines: ["你多大了？"],
          placeholder: "你的年龄",
        },
      },
    },
    {
      id: "height",
      asks: {
        height_cm: {
          lines: ["你的身高是多少？"],
          placeholder: "身高（厘米）",
        },
      },
    },
    {
      id: "weight",
      asks: {
        weight_kg: {
          lines: ["你现在的体重是多少？"],
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
      id: "struggles",
      asks: {
        struggles: { lines: ["之前最难的是什么？"] },
      },
      options: {
        consistency: { label: "难以坚持" },
        habits: { label: "不健康的饮食习惯" },
        support: { label: "缺少支持" },
        busy: { label: "日程太忙" },
        ideas: { label: "缺少饮食灵感" },
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
        country: { lines: ["你住在哪里？"], placeholder: "搜索" },
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
  version: 17,
  welcome: {
    lines: ["나에게 맞춘 플랜", "내 목표, 내 하루, 내 식사"],
    cta: "내 플랜 만들기",
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
          lines: ["나이가 어떻게 되세요?"],
          placeholder: "나이",
        },
      },
    },
    {
      id: "height",
      asks: {
        height_cm: {
          lines: ["키가 어떻게 되세요?"],
          placeholder: "키(cm)",
        },
      },
    },
    {
      id: "weight",
      asks: {
        weight_kg: {
          lines: ["오늘 체중이 얼마예요?"],
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
      id: "struggles",
      asks: {
        struggles: { lines: ["어떤 점이 어려웠어요?"] },
      },
      options: {
        consistency: { label: "꾸준함 부족" },
        habits: { label: "건강하지 않은 식습관" },
        support: { label: "주변의 지지 부족" },
        busy: { label: "바쁜 일정" },
        ideas: { label: "식사 아이디어 부족" },
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
        country: { lines: ["어디에 사세요?"], placeholder: "검색" },
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
  version: 17,
  welcome: {
    lines: ["あなたに合わせたプラン", "あなたの目標、1日、食事に合わせて"],
    cta: "プランを作る",
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
          lines: ["年齢を教えてください"],
          placeholder: "年齢",
        },
      },
    },
    {
      id: "height",
      asks: {
        height_cm: {
          lines: ["身長を教えてください"],
          placeholder: "身長（cm）",
        },
      },
    },
    {
      id: "weight",
      asks: {
        weight_kg: {
          lines: ["今日の体重は？"],
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
      id: "struggles",
      asks: {
        struggles: { lines: ["これまで何が大変でしたか？"] },
      },
      options: {
        consistency: { label: "続かない" },
        habits: { label: "不健康な食習慣" },
        support: { label: "サポートがない" },
        busy: { label: "忙しい毎日" },
        ideas: { label: "食事のアイデアが浮かばない" },
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
        country: { lines: ["お住まいはどこですか？"], placeholder: "検索" },
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
  version: 17,
  welcome: {
    lines: ["Um plano feito para você", "Sua meta, seu dia, suas refeições"],
    cta: "Montar meu plano",
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
          lines: ["Qual é a sua idade?"],
          placeholder: "Sua idade",
        },
      },
    },
    {
      id: "height",
      asks: {
        height_cm: {
          lines: ["Qual é a sua altura?"],
          placeholder: "Altura em cm",
        },
      },
    },
    {
      id: "weight",
      asks: {
        weight_kg: {
          lines: ["Quanto você pesa hoje?"],
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
      id: "struggles",
      asks: {
        struggles: { lines: ["O que tem sido difícil?"] },
      },
      options: {
        consistency: { label: "Falta de constância" },
        habits: { label: "Hábitos alimentares pouco saudáveis" },
        support: { label: "Falta de apoio" },
        busy: { label: "Agenda cheia" },
        ideas: { label: "Falta de ideias de refeição" },
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
        country: { lines: ["Onde você mora?"], placeholder: "Buscar" },
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
  ru: RU, "pt-PT": PT_PT, ms: MS, ca: CA, sl: SL, hr: HR, sk: SK, no: NO, fi: FI, da: DA, hu: HU, el: EL, ro: RO, cs: CS, hi: HI, th: TH, sv: SV, uk: UK, nl: NL, pl: PL, tr: TR, "zh-Hant": ZH_HANT, "zh-Hans": ZH_HANS, ko: KO, ja: JA, "pt-BR": PT_BR,
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
