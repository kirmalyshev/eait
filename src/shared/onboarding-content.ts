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
// THE CLAIMS GATE IS ENGLISH-ONLY AND THAT IS STATED RATHER THAN HIDDEN. `claims.ts` matches
// English patterns ("no email", "the only app"), so it proves nothing about the seven translations.
// What protects those is that they are TRANSLATIONS of copy that passed the gate — the English is
// the source, and a sentence is changed there first. A translation that invents a claim of its own
// is a review problem, and the review is the PR.
// ─────────────────────────────────────────────────────────────────────────────────────────────

import { t, type Localized } from "./lang.ts";
import type { Lang } from "./types.ts";
import { DEFAULT_ONBOARDING_CONTENT, usableContent, type OnboardingContent } from "./onboarding.ts";

// ── Français ─────────────────────────────────────────────────────────────────────────────────

// ── Français ──────────────────────────────────────────────────────────────────────

const FR: OnboardingContent = {
  version: DEFAULT_ONBOARDING_CONTENT.version,
  welcome: {
    lines: ["Prends ton repas en photo. Vois s'il rentre dans ta journée."],
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
    lines: ["Essen knipsen. Sehen, ob's passt."],
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
    lines: ["Fotografa un pasto. Scopri se ci sta."],
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
    lines: ["Haz una foto a tu comida. Descubre si encaja."],
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
    lines: ["Chụp bữa ăn. Biết ngay có hợp không."],
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
    lines: ["Foto makananmu. Langsung tahu cocok atau tidak."],
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
    lines: ["Сфотографируй еду — узнай, впишется ли она в твой день."],
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

export const ONBOARDING_CONTENT: Localized<OnboardingContent> = {
  en: DEFAULT_ONBOARDING_CONTENT,
  fr: FR,
  de: DE,
  it: IT,
  es: ES,
  vi: VI,
  id: ID,
  ru: RU,
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
