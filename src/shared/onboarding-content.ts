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

const FR: OnboardingContent = {
  version: DEFAULT_ONBOARDING_CONTENT.version,
  welcome: {
    lines: [
      "Salut, moi c'est Spud. Photographie ce que tu manges, reçois une réponse honnête — l'appli tient entière là-dedans.",
      "Trois minutes de questions, puis ton plan — calories par jour, protéines, ce qui est réaliste et pour quand — et un verdict sur ton premier repas.",
      "Pas besoin de compte pour commencer. Rien à payer tant que tu n'as pas vu le plan et ce premier verdict ; ensuite, une semaine gratuite pour essayer. On y va ?",
    ],
    cta: "C'est parti",
  },
  screens: [
    {
      id: "goal",
      asks: { goal: { lines: ["La grande question : qu'est-ce que tu viens faire ici ?"] } },
      options: {
        lose: { label: "Perdre du poids" },
        maintain: { label: "Maintenir mon poids" },
        gain: { label: "Prendre du poids" },
      },
    },
    {
      id: "about",
      asks: {
        sex: { lines: ["Deux mots sur toi — les deux données dont toute formule de calories a besoin. Qu'est-ce qui correspond ?"] },
        birth_year: { lines: ["Et tu as quel âge ? À peu près suffit au calcul."], placeholder: "Ton âge" },
      },
      options: { female: { label: "Femme" }, male: { label: "Homme" } },
    },
    {
      id: "body",
      asks: {
        height_cm: {
          lines: ["Tes chiffres, maintenant. À peu près, c'est vraiment suffisant — je préfère approximatif à vide. Tu mesures combien, en cm ?"],
          placeholder: "Taille en cm",
        },
        weight_kg: {
          lines: ["Et ton poids actuel, en kg ? L'appli eait pour iPhone peut le tenir à jour depuis Apple Health."],
          placeholder: "Poids en kg",
        },
      },
    },
    {
      id: "target",
      asks: {
        target_weight_kg: { lines: ["Où aimerais-tu arriver, en kg ?{loseTail}"], placeholder: "Poids cible en kg" },
        pace: { lines: ["Et à quel rythme ?"] },
      },
      options: {
        easy: { label: "Doux", hint: "≈ 0,25 kg par semaine" },
        steady: { label: "Régulier", hint: "≈ 0,5 kg par semaine" },
        push: { label: "Soutenu", hint: "plus dur à tenir" },
      },
    },
    {
      id: "activity",
      asks: {
        activity: { lines: ["Tu bouges combien dans une semaine normale ? Honnête vaut mieux qu'ambitieux — ça déplace beaucoup le chiffre."] },
      },
      options: {
        sedentary: { label: "Peu de mouvement", hint: "journées de bureau" },
        light: { label: "Activité légère", hint: "marche, courses" },
        moderate: { label: "Activité modérée", hint: "2–3 séances" },
        active: { label: "Activité élevée", hint: "presque tous les jours" },
        athlete: { label: "Niveau sportif", hint: "deux entraînements par jour, ou travail physique dur" },
      },
    },
    {
      id: "country",
      asks: { country: { lines: ["Tu manges où ? Pour que je connaisse ton supermarché, pas celui d'un autre."] } },
      enabled: true,
      options: {
        de: { label: "Allemagne" },
        gb: { label: "Royaume-Uni" },
        us: { label: "États-Unis" },
        other: { label: "Ailleurs" },
      },
    },
    {
      id: "restrictions",
      asks: {
        restrictions: {
          lines: ["Dernière question. Quelque chose à quoi je devrais mesurer ce que tu manges ? Seul ce que tu choisis est noté — tu peux passer. Le texte libre marche aussi."],
          placeholder: "Allergies, aliments évités…",
        },
      },
      options: {
        kidneys: { label: "Maladie rénale" },
        ldl: { label: "Cholestérol élevé" },
        vegan: { label: "Végétalien" },
        lowsugar: { label: "Risque de diabète" },
      },
    },
  ],
  building: {
    lines: ["C'est tout. Laisse-moi une seconde — je calcule, je ne devine pas."],
    restLabel: "Au repos, ton corps brûle",
    activityLabel: "Avec ton activité, environ",
    paceLabel: "Pour ton rythme, on ajuste",
    floorLabel: "Le plancher qu'on ne franchit pas",
    floorTitle: "On s'arrête à {floor} kcal",
    floorBody: "Le calcul voulait descendre plus bas. Sans suivi médical, on ne fixe pas d'objectif en dessous, donc le tien s'arrête ici. Ton journal le dira aussi.",
  },
  summary: {
    lines: ["Voilà, c'est toi, calculé proprement. Ton plan :"],
    kcalLabel: "kcal par jour",
    proteinLabel: "Protéines à viser",
    projection: "À ce rythme, tu serais à {target} kg vers {month}.",
    projectionFar: "C'est un long chemin — on navigue aux prochaines semaines, pas à l'horizon.",
    capNote: "Ce rythme demanderait un écart quotidien plus grand qu'on ne peut tenir sans risque, alors tu as la version sûre : {share}% de ce que ton corps brûle en une journée.",
    disclaimer: "Des estimations, pas un avis médical. Chaque réponse se change dans les réglages.",
    cta: "Photographie ton premier repas",
  },
};

// ── Deutsch ──────────────────────────────────────────────────────────────────────────────────

const DE: OnboardingContent = {
  version: DEFAULT_ONBOARDING_CONTENT.version,
  welcome: {
    lines: [
      "Hi, ich bin Spud. Fotografier, was du isst, und bekomm eine ehrliche Antwort — mehr macht die App nicht.",
      "Drei Minuten Fragen, dann dein Plan — Kalorien pro Tag, Eiweiß, was bis wann realistisch ist — und ein Urteil zu deiner ersten Mahlzeit.",
      "Zum Starten brauchst du kein Konto. Zahlen musst du erst, wenn du den Plan und dieses erste Urteil gesehen hast; danach eine Woche kostenlos zum Ausprobieren. Bereit?",
    ],
    cta: "Los geht's",
  },
  screens: [
    {
      id: "goal",
      asks: { goal: { lines: ["Die große Frage: Was willst du hier erreichen?"] } },
      options: {
        lose: { label: "Abnehmen" },
        maintain: { label: "Gewicht halten" },
        gain: { label: "Zunehmen" },
      },
    },
    {
      id: "about",
      asks: {
        sex: { lines: ["Kurz zu dir — zwei Angaben, die jede Kalorienformel braucht. Was trifft zu?"] },
        birth_year: { lines: ["Und wie alt bist du? Für die Rechnung reicht ungefähr."], placeholder: "Dein Alter" },
      },
      options: { female: { label: "Weiblich" }, male: { label: "Männlich" } },
    },
    {
      id: "body",
      asks: {
        height_cm: {
          lines: ["Jetzt deine Zahlen. Ungefähr reicht wirklich — ein grober Wert ist mir lieber als gar keiner. Wie groß bist du, in cm?"],
          placeholder: "Größe in cm",
        },
        weight_kg: {
          lines: ["Und dein Gewicht jetzt, in kg? Die eait-App fürs iPhone kann es über Apple Health aktuell halten."],
          placeholder: "Gewicht in kg",
        },
      },
    },
    {
      id: "target",
      asks: {
        target_weight_kg: { lines: ["Wo möchtest du landen, in kg?{loseTail}"], placeholder: "Zielgewicht in kg" },
        pace: { lines: ["Und das Tempo?"] },
      },
      options: {
        easy: { label: "Sanft", hint: "≈ 0,25 kg pro Woche" },
        steady: { label: "Stetig", hint: "≈ 0,5 kg pro Woche" },
        push: { label: "Zügig", hint: "schwerer durchzuhalten" },
      },
    },
    {
      id: "activity",
      asks: {
        activity: { lines: ["Wie viel bewegst du dich in einer normalen Woche? Ehrlich schlägt ambitioniert — das verschiebt die Zahl deutlich."] },
      },
      options: {
        sedentary: { label: "Meistens sitzend", hint: "Schreibtischtage" },
        light: { label: "Leicht aktiv", hint: "Spaziergänge, Besorgungen" },
        moderate: { label: "Mittel", hint: "2–3 Einheiten" },
        active: { label: "Aktiv", hint: "fast täglich" },
        athlete: { label: "Sportlich", hint: "zweimal täglich Training oder schwere körperliche Arbeit" },
      },
    },
    {
      id: "country",
      asks: { country: { lines: ["Wo isst du? Damit ich deinen Supermarkt kenne und nicht irgendeinen."] } },
      enabled: true,
      options: {
        de: { label: "Deutschland" },
        gb: { label: "Vereinigtes Königreich" },
        us: { label: "Vereinigte Staaten" },
        other: { label: "Woanders" },
      },
    },
    {
      id: "restrictions",
      asks: {
        restrictions: {
          lines: ["Letzte Frage. Gibt es etwas, woran ich dein Essen messen soll? Bewertet wird nur, was du auswählst — überspring das ruhig. Freitext geht auch."],
          placeholder: "Allergien, gemiedene Lebensmittel…",
        },
      },
      options: {
        kidneys: { label: "Nierenerkrankung" },
        ldl: { label: "Hoher Cholesterinwert" },
        vegan: { label: "Vegan" },
        lowsugar: { label: "Diabetesrisiko" },
      },
    },
  ],
  building: {
    lines: ["Das war's. Gib mir eine Sekunde — ich rechne, ich rate nicht."],
    restLabel: "In Ruhe verbrennt dein Körper",
    activityLabel: "Mit deiner Aktivität etwa",
    paceLabel: "Für dein Tempo rechnen wir",
    floorLabel: "Die Grenze, die wir nicht unterschreiten",
    floorTitle: "Wir bleiben bei {floor} kcal",
    floorBody: "Die Rechnung wollte tiefer. Ohne ärztliche Begleitung setzen wir keine Ziele darunter, also liegt deins genau hier. In deinem Tagebuch steht das auch.",
  },
  summary: {
    lines: ["Das bist du, sauber durchgerechnet. Hier ist dein Plan."],
    kcalLabel: "kcal pro Tag",
    proteinLabel: "Eiweiß als Ziel",
    projection: "In diesem Tempo wärst du gegen {month} bei {target} kg.",
    projectionFar: "Das ist ein weiter Weg — wir navigieren nach den nächsten Wochen, nicht nach dem Horizont.",
    capNote: "Dieses Tempo bräuchte eine größere Tagesänderung, als sich sicher durchhalten lässt, also bekommst du die sichere Variante: {share}% dessen, was dein Körper am Tag verbrennt.",
    disclaimer: "Schätzungen, keine medizinische Beratung. Jede Antwort lässt sich in den Einstellungen ändern.",
    cta: "Fotografier deine erste Mahlzeit",
  },
};

// ── Italiano ─────────────────────────────────────────────────────────────────────────────────

const IT: OnboardingContent = {
  version: DEFAULT_ONBOARDING_CONTENT.version,
  welcome: {
    lines: [
      "Ciao, sono Spud. Fotografa quello che mangi e ricevi una risposta onesta — l'app è tutta qui.",
      "Tre minuti di domande, poi il tuo piano — calorie al giorno, proteine, cosa è realistico ed entro quando — e un verdetto sul tuo primo pasto.",
      "Per iniziare non serve un account. Non paghi niente finché non hai visto il piano e quel primo verdetto; poi hai una settimana gratis per provare. Pronti?",
    ],
    cta: "Si parte",
  },
  screens: [
    {
      id: "goal",
      asks: { goal: { lines: ["La domanda importante: cosa vuoi ottenere qui?"] } },
      options: {
        lose: { label: "Perdere peso" },
        maintain: { label: "Mantenere il peso" },
        gain: { label: "Prendere peso" },
      },
    },
    {
      id: "about",
      asks: {
        sex: { lines: ["Due cose su di te — quelle che serve a ogni formula per le calorie. Cosa corrisponde?"] },
        birth_year: { lines: ["E quanti anni hai? Al calcolo basta un'approssimazione."], placeholder: "La tua età" },
      },
      options: { female: { label: "Donna" }, male: { label: "Uomo" } },
    },
    {
      id: "body",
      asks: {
        height_cm: {
          lines: ["Ora i tuoi numeri. Approssimare va benissimo — meglio vicino che vuoto. Quanto misuri, in cm?"],
          placeholder: "Altezza in cm",
        },
        weight_kg: {
          lines: ["E il tuo peso adesso, in kg? L'app eait per iPhone può tenerlo aggiornato da Apple Health."],
          placeholder: "Peso in kg",
        },
      },
    },
    {
      id: "target",
      asks: {
        target_weight_kg: { lines: ["Dove ti piacerebbe arrivare, in kg?{loseTail}"], placeholder: "Peso obiettivo in kg" },
        pace: { lines: ["E il ritmo?"] },
      },
      options: {
        easy: { label: "Dolce", hint: "≈ 0,25 kg a settimana" },
        steady: { label: "Costante", hint: "≈ 0,5 kg a settimana" },
        push: { label: "Deciso", hint: "più difficile da tenere" },
      },
    },
    {
      id: "activity",
      asks: {
        activity: { lines: ["Quanto ti muovi in una settimana normale? Onesto batte ambizioso — qui il numero cambia parecchio."] },
      },
      options: {
        sedentary: { label: "Poco movimento", hint: "giornate da scrivania" },
        light: { label: "Attività leggera", hint: "passeggiate, commissioni" },
        moderate: { label: "Attività moderata", hint: "2–3 allenamenti" },
        active: { label: "Attività alta", hint: "quasi ogni giorno" },
        athlete: { label: "Livello sportivo", hint: "due allenamenti al giorno, o lavoro fisico pesante" },
      },
    },
    {
      id: "country",
      asks: { country: { lines: ["Dove mangi? Così conosco il tuo supermercato, non quello di qualcun altro."] } },
      enabled: true,
      options: {
        de: { label: "Germania" },
        gb: { label: "Regno Unito" },
        us: { label: "Stati Uniti" },
        other: { label: "Da un'altra parte" },
      },
    },
    {
      id: "restrictions",
      asks: {
        restrictions: {
          lines: ["Ultima. C'è qualcosa rispetto a cui dovrei valutare quello che mangi? Viene valutato solo ciò che scegli — saltala pure. Va bene anche il testo libero."],
          placeholder: "Allergie, cibi che eviti…",
        },
      },
      options: {
        kidneys: { label: "Malattia renale" },
        ldl: { label: "Colesterolo alto" },
        vegan: { label: "Vegano" },
        lowsugar: { label: "Rischio di diabete" },
      },
    },
  ],
  building: {
    lines: ["È tutto. Dammi un secondo — sto calcolando, non tirando a indovinare."],
    restLabel: "A riposo il tuo corpo brucia",
    activityLabel: "Con la tua attività, circa",
    paceLabel: "Per il tuo ritmo, correggiamo",
    floorLabel: "Il limite che non superiamo",
    floorTitle: "Ci fermiamo a {floor} kcal",
    floorBody: "Il calcolo voleva scendere ancora. Senza controllo medico non fissiamo obiettivi sotto questa soglia, quindi il tuo resta qui. Lo dirà anche il tuo diario.",
  },
  summary: {
    lines: ["Ecco te, calcolato per bene. Questo è il tuo piano."],
    kcalLabel: "kcal al giorno",
    proteinLabel: "Proteine da puntare",
    projection: "A questo ritmo saresti a {target} kg verso {month}.",
    projectionFar: "È una strada lunga — navighiamo sulle prossime settimane, non sull'orizzonte.",
    capNote: "Quel ritmo chiederebbe una variazione quotidiana più grande di quanto sia sicuro mantenere, quindi il tuo è la versione sicura: {share}% di quello che il tuo corpo brucia in un giorno.",
    disclaimer: "Stime, non consigli medici. Ogni risposta si cambia nelle impostazioni.",
    cta: "Fotografa il tuo primo pasto",
  },
};

// ── Español ──────────────────────────────────────────────────────────────────────────────────

const ES: OnboardingContent = {
  version: DEFAULT_ONBOARDING_CONTENT.version,
  welcome: {
    lines: [
      "Hola, soy Spud. Fotografía lo que comes y recibe una respuesta honesta — la app es eso y nada más.",
      "Tres minutos de preguntas, luego tu plan — calorías al día, proteína, qué es realista y para cuándo — y un veredicto sobre tu primera comida.",
      "No hace falta cuenta para empezar. No pagas nada hasta ver el plan y ese primer veredicto; después tienes una semana gratis para probar. ¿Empezamos?",
    ],
    cta: "Vamos",
  },
  screens: [
    {
      id: "goal",
      asks: { goal: { lines: ["La pregunta grande: ¿a qué has venido?"] } },
      options: {
        lose: { label: "Perder peso" },
        maintain: { label: "Mantener mi peso" },
        gain: { label: "Ganar peso" },
      },
    },
    {
      id: "about",
      asks: {
        sex: { lines: ["Un poco sobre ti — los dos datos que necesita cualquier fórmula de calorías. ¿Cuál encaja?"] },
        birth_year: { lines: ["¿Y cuántos años tienes? Para el cálculo basta con aproximar."], placeholder: "Tu edad" },
      },
      options: { female: { label: "Mujer" }, male: { label: "Hombre" } },
    },
    {
      id: "body",
      asks: {
        height_cm: {
          lines: ["Ahora tus números. Aproximar está bien de verdad — prefiero cerca que en blanco. ¿Cuánto mides, en cm?"],
          placeholder: "Altura en cm",
        },
        weight_kg: {
          lines: ["¿Y tu peso ahora, en kg? La app eait para iPhone puede mantenerlo al día desde Apple Health."],
          placeholder: "Peso en kg",
        },
      },
    },
    {
      id: "target",
      asks: {
        target_weight_kg: { lines: ["¿Dónde te gustaría llegar, en kg?{loseTail}"], placeholder: "Peso objetivo en kg" },
        pace: { lines: ["¿Y a qué ritmo?"] },
      },
      options: {
        easy: { label: "Suave", hint: "≈ 0,25 kg por semana" },
        steady: { label: "Constante", hint: "≈ 0,5 kg por semana" },
        push: { label: "Fuerte", hint: "más difícil de sostener" },
      },
    },
    {
      id: "activity",
      asks: {
        activity: { lines: ["¿Cuánto te mueves en una semana normal? Honesto gana a aspiracional — esto mueve mucho el número."] },
      },
      options: {
        sedentary: { label: "Poco movimiento", hint: "días de escritorio" },
        light: { label: "Actividad ligera", hint: "paseos, recados" },
        moderate: { label: "Actividad moderada", hint: "2–3 entrenamientos" },
        active: { label: "Actividad alta", hint: "casi todos los días" },
        athlete: { label: "Nivel deportista", hint: "dos entrenamientos al día, o trabajo físico duro" },
      },
    },
    {
      id: "country",
      asks: { country: { lines: ["¿Dónde comes? Para conocer tu supermercado y no el de otro."] } },
      enabled: true,
      options: {
        de: { label: "Alemania" },
        gb: { label: "Reino Unido" },
        us: { label: "Estados Unidos" },
        other: { label: "En otro sitio" },
      },
    },
    {
      id: "restrictions",
      asks: {
        restrictions: {
          lines: ["La última. ¿Hay algo con lo que deba juzgar tu comida? Solo se puntúa lo que elijas — sáltatela sin problema. El texto libre también vale."],
          placeholder: "Alergias, alimentos que evitas…",
        },
      },
      options: {
        kidneys: { label: "Enfermedad renal" },
        ldl: { label: "Colesterol alto" },
        vegan: { label: "Vegano" },
        lowsugar: { label: "Riesgo de diabetes" },
      },
    },
  ],
  building: {
    lines: ["Eso es todo. Dame un segundo — estoy calculando, no adivinando."],
    restLabel: "En reposo tu cuerpo quema",
    activityLabel: "Con tu actividad, unas",
    paceLabel: "Por tu ritmo, ajustamos",
    floorLabel: "El suelo que no cruzamos",
    floorTitle: "Nos quedamos en {floor} kcal",
    floorBody: "El cálculo quería bajar más. Sin supervisión médica no fijamos objetivos por debajo de esto, así que el tuyo se queda aquí. Tu diario también lo dirá.",
  },
  summary: {
    lines: ["Esto eres tú, calculado como toca. Aquí está tu plan."],
    kcalLabel: "kcal al día",
    proteinLabel: "Proteína a la que apuntar",
    projection: "A este ritmo estarías en {target} kg hacia {month}.",
    projectionFar: "Es un camino largo — navegamos por las próximas semanas, no por el horizonte.",
    capNote: "Ese ritmo pediría un cambio diario mayor del que es seguro sostener, así que el tuyo es la versión segura: {share}% de lo que tu cuerpo quema en un día.",
    disclaimer: "Estimaciones, no consejo médico. Cualquier respuesta se cambia en ajustes.",
    cta: "Fotografía tu primera comida",
  },
};

// ── Tiếng Việt ───────────────────────────────────────────────────────────────────────────────

const VI: OnboardingContent = {
  version: DEFAULT_ONBOARDING_CONTENT.version,
  welcome: {
    lines: [
      "Chào, mình là Spud. Chụp ảnh món bạn ăn, nhận một câu trả lời thành thật — ứng dụng chỉ có vậy thôi.",
      "Ba phút trả lời câu hỏi, rồi đến kế hoạch của bạn — calo mỗi ngày, đạm, điều gì là thực tế và đến khi nào — cùng một nhận xét cho bữa đầu tiên.",
      "Bắt đầu thì không cần tài khoản. Bạn chưa phải trả gì cho đến khi xem xong kế hoạch và nhận xét đầu tiên đó; sau đó là một tuần dùng thử miễn phí. Sẵn sàng chưa?",
    ],
    cta: "Bắt đầu thôi",
  },
  screens: [
    {
      id: "goal",
      asks: { goal: { lines: ["Câu hỏi lớn: bạn đến đây để làm gì?"] } },
      options: {
        lose: { label: "Giảm cân" },
        maintain: { label: "Giữ nguyên cân nặng" },
        gain: { label: "Tăng cân" },
      },
    },
    {
      id: "about",
      asks: {
        sex: { lines: ["Vài điều về bạn — hai thông tin mà mọi công thức tính calo đều cần. Cái nào đúng?"] },
        birth_year: { lines: ["Bạn bao nhiêu tuổi? Số gần đúng là đủ cho phép tính."], placeholder: "Tuổi của bạn" },
      },
      options: { female: { label: "Nữ" }, male: { label: "Nam" } },
    },
    {
      id: "body",
      asks: {
        height_cm: {
          lines: ["Giờ đến các con số của bạn. Áng chừng là hoàn toàn ổn — mình thích số gần đúng hơn là để trống. Bạn cao bao nhiêu, tính bằng cm?"],
          placeholder: "Chiều cao (cm)",
        },
        weight_kg: {
          lines: ["Còn cân nặng hiện tại, tính bằng kg? Ứng dụng eait trên iPhone có thể tự cập nhật nó từ Apple Health."],
          placeholder: "Cân nặng (kg)",
        },
      },
    },
    {
      id: "target",
      asks: {
        target_weight_kg: { lines: ["Bạn muốn về mức nào, tính bằng kg?{loseTail}"], placeholder: "Cân nặng mục tiêu (kg)" },
        pace: { lines: ["Còn nhịp độ thì sao?"] },
      },
      options: {
        easy: { label: "Nhẹ nhàng", hint: "≈ 0,25 kg mỗi tuần" },
        steady: { label: "Đều đặn", hint: "≈ 0,5 kg mỗi tuần" },
        push: { label: "Dồn sức", hint: "khó giữ hơn" },
      },
    },
    {
      id: "activity",
      asks: {
        activity: { lines: ["Một tuần bình thường bạn vận động nhiều không? Thành thật hơn là mơ mộng — chỗ này làm con số lệch nhiều."] },
      },
      options: {
        sedentary: { label: "Chủ yếu ngồi", hint: "ngày làm bàn giấy" },
        light: { label: "Vận động nhẹ", hint: "đi bộ, chạy việc vặt" },
        moderate: { label: "Vận động vừa", hint: "2–3 buổi tập" },
        active: { label: "Vận động nhiều", hint: "gần như mỗi ngày" },
        athlete: { label: "Mức vận động viên", hint: "tập hai buổi mỗi ngày, hoặc lao động nặng" },
      },
    },
    {
      id: "country",
      asks: { country: { lines: ["Bạn ăn ở đâu? Để mình biết siêu thị của bạn, chứ không phải của người khác."] } },
      enabled: true,
      options: {
        de: { label: "Đức" },
        gb: { label: "Vương quốc Anh" },
        us: { label: "Hoa Kỳ" },
        other: { label: "Nơi khác" },
      },
    },
    {
      id: "restrictions",
      asks: {
        restrictions: {
          lines: ["Câu cuối. Có điều gì mình nên dựa vào để đánh giá đồ ăn của bạn không? Chỉ những gì bạn chọn mới được chấm — bỏ qua cũng không sao. Viết tự do cũng được."],
          placeholder: "Dị ứng, món bạn tránh…",
        },
      },
      options: {
        kidneys: { label: "Bệnh thận" },
        ldl: { label: "Cholesterol cao" },
        vegan: { label: "Thuần chay" },
        lowsugar: { label: "Nguy cơ tiểu đường" },
      },
    },
  ],
  building: {
    lines: ["Vậy là xong. Cho mình một giây — mình đang tính, không phải đoán."],
    restLabel: "Lúc nghỉ, cơ thể bạn đốt",
    activityLabel: "Với mức vận động của bạn, khoảng",
    paceLabel: "Theo nhịp độ của bạn, điều chỉnh",
    floorLabel: "Mức sàn không vượt qua",
    floorTitle: "Dừng lại ở {floor} kcal",
    floorBody: "Phép tính muốn xuống thấp hơn. Không có bác sĩ theo dõi thì chúng tôi không đặt mục tiêu thấp hơn mức này, nên của bạn dừng ở đây. Nhật ký cũng sẽ ghi vậy.",
  },
  summary: {
    lines: ["Đây là bạn, tính đâu ra đấy. Kế hoạch của bạn đây."],
    kcalLabel: "kcal mỗi ngày",
    proteinLabel: "Đạm cần hướng tới",
    projection: "Với nhịp này, bạn sẽ ở mức {target} kg vào khoảng {month}.",
    projectionFar: "Đường còn dài — chúng mình đi theo vài tuần tới, không nhìn về chân trời.",
    capNote: "Nhịp đó cần mức thay đổi mỗi ngày lớn hơn mức an toàn để duy trì, nên bạn nhận bản an toàn: {share}% lượng cơ thể bạn đốt trong một ngày.",
    disclaimer: "Đây là ước tính, không phải lời khuyên y tế. Câu trả lời nào cũng đổi được trong cài đặt.",
    cta: "Chụp bữa ăn đầu tiên",
  },
};

// ── Bahasa Indonesia ─────────────────────────────────────────────────────────────────────────

const ID: OnboardingContent = {
  version: DEFAULT_ONBOARDING_CONTENT.version,
  welcome: {
    lines: [
      "Hai, aku Spud. Foto apa yang kamu makan, dapat jawaban jujur — isi aplikasinya cuma itu.",
      "Tiga menit pertanyaan, lalu rencanamu — kalori harian, protein, apa yang realistis dan kapan — plus penilaian untuk makanan pertamamu.",
      "Mulai tanpa perlu akun. Tidak ada yang dibayar sampai kamu melihat rencananya dan penilaian pertama itu; setelah itu ada satu minggu gratis untuk mencoba. Siap?",
    ],
    cta: "Ayo mulai",
  },
  screens: [
    {
      id: "goal",
      asks: { goal: { lines: ["Pertanyaan besarnya: kamu ke sini untuk apa?"] } },
      options: {
        lose: { label: "Menurunkan berat badan" },
        maintain: { label: "Menjaga berat badan" },
        gain: { label: "Menaikkan berat badan" },
      },
    },
    {
      id: "about",
      asks: {
        sex: { lines: ["Sedikit tentang kamu — dua hal yang dibutuhkan setiap rumus kalori. Mana yang cocok?"] },
        birth_year: { lines: ["Umurmu berapa? Kira-kira saja sudah cukup buat hitungannya."], placeholder: "Umurmu" },
      },
      options: { female: { label: "Perempuan" }, male: { label: "Laki-laki" } },
    },
    {
      id: "body",
      asks: {
        height_cm: {
          lines: ["Sekarang angka-angkamu. Kira-kira benar-benar cukup — lebih baik mendekati daripada kosong. Tinggimu berapa, dalam cm?"],
          placeholder: "Tinggi dalam cm",
        },
        weight_kg: {
          lines: ["Dan berat badanmu sekarang, dalam kg? Aplikasi eait untuk iPhone bisa terus memperbaruinya dari Apple Health."],
          placeholder: "Berat dalam kg",
        },
      },
    },
    {
      id: "target",
      asks: {
        target_weight_kg: { lines: ["Kamu ingin sampai di angka berapa, dalam kg?{loseTail}"], placeholder: "Berat target dalam kg" },
        pace: { lines: ["Lalu temponya?"] },
      },
      options: {
        easy: { label: "Pelan", hint: "≈ 0,25 kg per minggu" },
        steady: { label: "Stabil", hint: "≈ 0,5 kg per minggu" },
        push: { label: "Cepat", hint: "lebih sulit dijaga" },
      },
    },
    {
      id: "activity",
      asks: {
        activity: { lines: ["Seberapa banyak kamu bergerak dalam seminggu biasa? Jujur lebih baik daripada ambisius — ini menggeser angkanya jauh."] },
      },
      options: {
        sedentary: { label: "Lebih banyak duduk", hint: "hari-hari di meja" },
        light: { label: "Aktivitas ringan", hint: "jalan kaki, urusan harian" },
        moderate: { label: "Aktivitas sedang", hint: "2–3 latihan" },
        active: { label: "Aktivitas tinggi", hint: "hampir tiap hari" },
        athlete: { label: "Level atlet", hint: "latihan dua kali sehari, atau kerja fisik berat" },
      },
    },
    {
      id: "country",
      asks: { country: { lines: ["Kamu makan di mana? Biar aku tahu supermarketmu, bukan punya orang lain."] } },
      enabled: true,
      options: {
        de: { label: "Jerman" },
        gb: { label: "Britania Raya" },
        us: { label: "Amerika Serikat" },
        other: { label: "Di tempat lain" },
      },
    },
    {
      id: "restrictions",
      asks: {
        restrictions: {
          lines: ["Terakhir. Ada sesuatu yang harus jadi patokan aku menilai makananmu? Hanya yang kamu pilih yang dinilai — lewati saja kalau tidak ada. Teks bebas juga boleh."],
          placeholder: "Alergi, makanan yang dihindari…",
        },
      },
      options: {
        kidneys: { label: "Penyakit ginjal" },
        ldl: { label: "Kolesterol tinggi" },
        vegan: { label: "Vegan" },
        lowsugar: { label: "Risiko diabetes" },
      },
    },
  ],
  building: {
    lines: ["Sudah semua. Beri aku sedetik — aku sedang menghitung, bukan menebak."],
    restLabel: "Saat istirahat tubuhmu membakar",
    activityLabel: "Dengan aktivitasmu, sekitar",
    paceLabel: "Untuk tempomu, kami sesuaikan",
    floorLabel: "Batas bawah yang tidak dilewati",
    floorTitle: "Kami berhenti di {floor} kcal",
    floorBody: "Hitungannya ingin turun lebih jauh. Tanpa pengawasan medis kami tidak menetapkan target di bawah ini, jadi punyamu berhenti di sini. Buku harianmu juga akan menyebutkannya.",
  },
  summary: {
    lines: ["Ini kamu, dihitung dengan benar. Ini rencanamu."],
    kcalLabel: "kcal per hari",
    proteinLabel: "Target protein",
    projection: "Dengan tempo ini kamu ada di {target} kg sekitar {month}.",
    projectionFar: "Jalannya panjang — kita berpatokan pada beberapa minggu ke depan, bukan pada cakrawala.",
    capNote: "Tempo itu butuh perubahan harian yang lebih besar daripada yang aman untuk dijaga, jadi punyamu versi amannya: {share}% dari yang tubuhmu bakar dalam sehari.",
    disclaimer: "Perkiraan, bukan nasihat medis. Semua jawaban bisa diubah di pengaturan.",
    cta: "Foto makanan pertamamu",
  },
};

// ── Русский ──────────────────────────────────────────────────────────────────────────────────

const RU: OnboardingContent = {
  version: DEFAULT_ONBOARDING_CONTENT.version,
  welcome: {
    lines: [
      "Привет, я Spud. Фотографируй, что ешь, и получай честный ответ — в этом всё приложение.",
      "Три минуты вопросов — и вот твой план: калории на день, белок, что реально и к какому сроку. И вердикт по первому приёму пищи.",
      "Чтобы начать, аккаунт не нужен. Платить не придётся, пока не увидишь план и тот самый первый вердикт; дальше — неделя бесплатно, чтобы попробовать. Готов?",
    ],
    cta: "Поехали",
  },
  screens: [
    {
      id: "goal",
      asks: { goal: { lines: ["Главный вопрос: зачем ты здесь?"] } },
      options: {
        lose: { label: "Похудеть" },
        maintain: { label: "Удержать вес" },
        gain: { label: "Набрать вес" },
      },
    },
    {
      id: "about",
      asks: {
        sex: { lines: ["Немного о тебе — две вещи, без которых не работает ни одна формула калорий. Что подходит?"] },
        birth_year: { lines: ["И сколько тебе лет? Для расчёта хватит примерно."], placeholder: "Твой возраст" },
      },
      options: { female: { label: "Женский" }, male: { label: "Мужской" } },
    },
    {
      id: "body",
      asks: {
        height_cm: {
          lines: ["Теперь твои цифры. Примерно — правда нормально: лучше близко, чем пусто. Какой у тебя рост, в см?"],
          placeholder: "Рост в см",
        },
        weight_kg: {
          lines: ["А вес сейчас, в кг? Приложение eait для iPhone умеет держать его актуальным через Apple Health."],
          placeholder: "Вес в кг",
        },
      },
    },
    {
      id: "target",
      asks: {
        target_weight_kg: { lines: ["Куда хочешь прийти, в кг?{loseTail}"], placeholder: "Целевой вес в кг" },
        pace: { lines: ["И темп?"] },
      },
      options: {
        easy: { label: "Мягкий", hint: "≈ 0,25 кг в неделю" },
        steady: { label: "Ровный", hint: "≈ 0,5 кг в неделю" },
        push: { label: "Жёсткий", hint: "труднее выдержать" },
      },
    },
    {
      id: "activity",
      asks: {
        activity: { lines: ["Сколько ты двигаешься в обычную неделю? Честно лучше, чем с запасом — это сильно двигает цифру."] },
      },
      options: {
        sedentary: { label: "В основном сидя", hint: "дни за столом" },
        light: { label: "Лёгкая активность", hint: "прогулки, дела" },
        moderate: { label: "Умеренная", hint: "2–3 тренировки" },
        active: { label: "Высокая", hint: "почти каждый день" },
        athlete: { label: "Спортивная", hint: "две тренировки в день или тяжёлый физический труд" },
      },
    },
    {
      id: "country",
      asks: { country: { lines: ["Где ты ешь? Чтобы я знал твой супермаркет, а не чей-то чужой."] } },
      enabled: true,
      options: {
        de: { label: "Германия" },
        gb: { label: "Великобритания" },
        us: { label: "США" },
        other: { label: "Где-то ещё" },
      },
    },
    {
      id: "restrictions",
      asks: {
        restrictions: {
          lines: ["Последний вопрос. Есть что-то, с чем мне сверять твою еду? Оценивается только то, что ты выберешь — можно смело пропустить. Свободный текст тоже подойдёт."],
          placeholder: "Аллергии, продукты, которых избегаешь…",
        },
      },
      options: {
        kidneys: { label: "Болезнь почек" },
        ldl: { label: "Высокий холестерин" },
        vegan: { label: "Веган" },
        lowsugar: { label: "Риск диабета" },
      },
    },
  ],
  building: {
    lines: ["Это всё. Дай секунду — я считаю, а не прикидываю."],
    restLabel: "В покое твоё тело сжигает",
    activityLabel: "С твоей активностью — около",
    paceLabel: "Под твой темп корректируем",
    floorLabel: "Порог, ниже которого не идём",
    floorTitle: "Мы остановились на {floor} ккал",
    floorBody: "Расчёт хотел уйти ниже. Без наблюдения врача мы не ставим цели ниже этой отметки, так что твоя — здесь. В дневнике это тоже будет написано.",
  },
  summary: {
    lines: ["Вот и всё, посчитано как следует. Твой план:"],
    kcalLabel: "ккал в день",
    proteinLabel: "Белок — ориентир",
    projection: "В таком темпе {target} кг — это примерно {month}",
    projectionFar: "Дорога долгая — ориентируемся на ближайшие недели, а не на горизонт.",
    capNote: "Такой темп потребовал бы большей дневной разницы, чем безопасно выдерживать, так что у тебя безопасный вариант: {share}% от того, что тело сжигает за день.",
    disclaimer: "Это оценки, а не медицинская рекомендация. Любой ответ можно поменять в настройках.",
    cta: "Сфотографируй первый приём пищи",
  },
};

// ── The table ────────────────────────────────────────────────────────────────────────────────

/**
 * The words onboarding ships with, in every language.
 *
 * `en` is `DEFAULT_ONBOARDING_CONTENT` itself rather than a copy of it, so the English stays where
 * the tests, the admin's reset and `usableContent`'s fallback already look for it, and there is
 * exactly one of it.
 */
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
