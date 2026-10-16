// The server-composed messages this product sends, and the arithmetic that decides which.
//
// THIS HEADER WAS WRITTEN FOR TWO MESSAGES AND IS KEPT FOR WHAT IT STILL EXPLAINS (the trial reminder
// and the 20:30 line). It is no longer the whole list: `NOTIFICATION_IDS` carries six ids, the
// phone schedules per-meal LOCAL reminders (`meal-reminders.ts`, #902) and the server sends the same
// slots as web push to browsers (`engine/meal-slots.ts`, #2149). There is no "one message a day"
// rule any more (ieat-app#1965, Kirill 10 Oct): what bounds a day is one claim per (account, local
// day, SENDER) and the account's own `push_daily_max`, both in `claimSend` (`engine/notify.ts`).
// What is promised to the person is still told by the scripted lines.
//
// The scripted `trial-started` and `trial-day-one` lines (`chat-copy.ts`) promise exactly two:
// "I'll remind you the day before it ends, never the day after" (ieat-app#1591: the 3-day trial
// gets ONE trial-ends reminder, not two), and "At 20:30 you get one line — today against the plan,
// and one concrete thing for tomorrow." Nothing else may be sent by these two. There is no
// cross-sender daily cap (ieat-app#1965): the trial-ends day carries the phone's reminder AND the
// evening line, which is still exactly the two the scripted lines promise.
//
// It lives in shared because both sides need the same answers. The phone schedules the trial
// reminder LOCALLY, off `entitlement.expiresAt`, so it can fire it with no network and cancel
// it the moment the server says the trial converted; the server composes and pushes the 20:30
// line, because a local notification cannot carry a sentence about a day it has not seen. Two
// implementations of "which day is the last" would drift silently, and the symptom would be a
// reminder on the day after — the one thing the copy promises never happens.
//
// The WORDS are admin-editable and the SHAPE is not, the same split onboarding content makes:
// `validateNotificationCopy` runs on the WRITE, so a placeholder the composer cannot fill or a
// health claim never reaches a lock screen.

import { lintCopy } from "./claims.ts";
import { localDate, localTime } from "./dates.ts";
import { trialReminder, type Entitlement } from "./entitlement.ts";
import { genderedRussian, kcalNumbers, wholeNumbers, t, type Localized } from "./lang.ts";
import type { FoodTargets, Goal, Lang } from "./types.ts";

/** Every message that may be sent. Adding one is a product decision, not a copy edit. */
export const NOTIFICATION_IDS = [
  "trial-end", "evening", "nudge", "onboarding-start", "onboarding-photo", "streak-risk",
] as const;
export type NotificationId = (typeof NOTIFICATION_IDS)[number];

export interface NotificationMessage {
  title: string;
  body: string;
  /**
   * `evening` only: the body for a day with nothing logged.
   *
   * A separate string rather than a clever substitution, because "0 of your 2,100kcal today" is
   * an accusation and the recovery framing R1 asks for is a different sentence, not a smaller
   * number. It cannot carry `{eaten}` — there is nothing eaten — and the validator says so.
   */
  emptyBody?: string;
  /**
   * Rotation: further bodies for the same title, by variant name (`v2`…). Present only on the
   * triggers (`onboarding-*`, `streak-risk`), which send a different line on each occasion.
   */
  alternates?: Record<string, string>;
}

export type NotificationCopy = Record<NotificationId, NotificationMessage>;

/**
 * What each field may interpolate, and what it MUST.
 *
 * Same discipline as `SCRIPTED_PARAMS` in `chat.ts`: the composer fills a declared set, so an
 * admin cannot introduce a placeholder that renders as a literal `{weight}` on somebody's lock
 * screen, and cannot delete one the sentence needs to mean anything. Titles take none — a title is
 * read at a glance and a number in it is a number without its sentence.
 */
export const NOTIFICATION_PLACEHOLDERS: Record<string, readonly string[]> = {
  "trial-end.title": [], "trial-end.body": [],
  "evening.title": [], "evening.body": ["eaten", "plan", "tomorrow"],
  "evening.emptyBody": ["plan", "tomorrow"],
  "nudge.title": [], "nudge.body": [],
  "onboarding-start.title": [], "onboarding-start.body": [],
  "onboarding-photo.title": [], "onboarding-photo.body": [],
  "streak-risk.title": [], "streak-risk.body": [],
};

/** iOS truncates well before these; they are a bound on abuse, not a design guide. */
export const MAX_NOTIFICATION_TITLE = 60;
export const MAX_NOTIFICATION_BODY = 240;

/**
 * The shipped words.
 *
 * The reminder says what happens and how to stop it, and nothing else: no countdown, no
 * "you'll lose your progress", no second pitch. Step 15's rules for the sheet apply to the
 * messages that follow from it — the trial was sold once, and a reminder that sells it again is
 * the reason people turn notifications off.
 */
export const DEFAULT_NOTIFICATION_COPY: NotificationCopy = {
  "trial-end": {
    title: "The trial ends tomorrow",
    // "if you're staying" rather than "the subscription starts": a CANCELLATION leaves the expiry
    // where it was, so somebody who has already stopped it still gets this message, and telling
    // them a subscription is about to start would be false rather than merely redundant.
    body: "Tomorrow your free trial ends. If you're staying, nothing to do; if not, Settings › Subscriptions.",
  },
  evening: {
    title: "Today against the plan",
    body: "{eaten} of your {plan}kcal today. {tomorrow}",
    emptyBody: "Nothing logged today — your {plan}kcal are still the plan. {tomorrow}",
  },
  // The free account's line (#730): no figures, because the figures read the day against the plan
  // and that reading is what a subscription buys.
  "onboarding-start": {
    title: "Your plan is nearly ready",
    body: "A few taps and your plan is ready.",
    alternates: { v2: "Pick up where you stopped — it only takes a minute.", v3: "Your plan is waiting on a few answers.", v4: "Finish the last questions and your plan is yours." },
  },
  "onboarding-photo": {
    title: "Your first meal",
    body: "Take a photo of your next meal — that's all it takes to start.",
    alternates: { v2: "One photo is enough to get going.", v3: "Your plan is set. Log your first meal when you're ready.", v4: "Next time you eat, try a photo — we handle the rest." },
  },
  "streak-risk": {
    title: "Keep it going",
    body: "You've logged a few days running. A photo today keeps the run going.",
    alternates: { v2: "One quick photo and today counts too.", v3: "Nothing logged yet today? One meal and the run carries on.", v4: "Your run is still alive — add today with a photo." },
  },
  nudge: {
    title: "Today's meals",
    body: "Log what you ate today — a photo is enough.",
  },
};

/**
 * Every message in every language, and the stored row's shape.
 *
 * `en` IS `DEFAULT_NOTIFICATION_COPY` itself, so the admin's reset, the merge in `engine/notify.ts`
 * and every test go on looking in the one place they already look.
 */
export const NOTIFICATION_COPY: Localized<NotificationCopy> = {
  en: DEFAULT_NOTIFICATION_COPY,
  fr: {
    "trial-end": {
      title: "L'essai se termine demain",
      body: "Demain, ton essai gratuit se termine. Si tu restes, rien à faire ; sinon : Réglages › Abonnements.",
    },
    evening: {
      title: "Aujourd'hui face au plan",
      body: "{eaten}kcal sur tes {plan} aujourd'hui. {tomorrow}",
      emptyBody: "Rien d'enregistré aujourd'hui — ton objectif reste {plan}kcal. {tomorrow}",
    },
    "onboarding-start": {
      title: "Ton plan est presque prêt",
      body: "Quelques touches et ton plan est prêt.",
      alternates: { v2: "Reprends là où tu t'es arrêté — une minute suffit.", v3: "Ton plan n'attend que quelques réponses.", v4: "Termine les dernières questions et ton plan est à toi." },
    },
    "onboarding-photo": {
      title: "Ton premier repas",
      body: "Prends ton prochain repas en photo — il suffit de ça pour commencer.",
      alternates: { v2: "Une seule photo suffit pour démarrer.", v3: "Ton plan est prêt. Note ton premier repas quand tu veux.", v4: "La prochaine fois que tu manges, essaie la photo — on s'occupe du reste." },
    },
    "streak-risk": {
      title: "On continue",
      body: "Tu notes tes repas depuis plusieurs jours. Une photo aujourd'hui prolonge la série.",
      alternates: { v2: "Une photo rapide et aujourd'hui compte aussi.", v3: "Rien de noté aujourd'hui ? Un repas et la série continue.", v4: "Ta série est toujours là — ajoute aujourd'hui avec une photo." },
    },
    nudge: {
      title: "Les repas du jour",
      body: "Note ce que tu as mangé aujourd'hui — une photo suffit.",
    },
  },
  de: {
    "trial-end": {
      title: "Deine Testphase endet morgen",
      body: "Morgen endet deine Testphase. Wenn du bleibst, musst du nichts tun; wenn nicht: Einstellungen › Abonnements.",
    },
    evening: {
      title: "Dein Tag im Vergleich zum Plan",
      body: "{eaten} von deinen {plan}kcal heute. {tomorrow}",
      emptyBody: "Heute nichts eingetragen — deine {plan}kcal sind trotzdem der Plan. {tomorrow}",
    },
    "onboarding-start": {
      title: "Dein Plan ist fast fertig",
      body: "Ein paar Taps, und dein Plan steht.",
      alternates: { v2: "Mach da weiter, wo du aufgehört hast — es dauert nur eine Minute.", v3: "Dein Plan wartet nur noch auf ein paar Antworten.", v4: "Beantworte die letzten Fragen, dann gehört dein Plan dir." },
    },
    "onboarding-photo": {
      title: "Deine erste Mahlzeit",
      body: "Fotografier deine nächste Mahlzeit — mehr braucht es nicht für den Start.",
      alternates: { v2: "Ein Foto reicht, um loszulegen.", v3: "Dein Plan steht. Trag deine erste Mahlzeit ein, wenn du magst.", v4: "Probier beim nächsten Essen ein Foto — den Rest übernehmen wir." },
    },
    "streak-risk": {
      title: "Bleib dran",
      body: "Du trägst schon ein paar Tage in Folge ein. Ein Foto heute führt die Reihe fort.",
      alternates: { v2: "Ein schnelles Foto, und heute zählt auch.", v3: "Heute noch nichts eingetragen? Eine Mahlzeit, und die Reihe geht weiter.", v4: "Deine Reihe lebt noch — ergänze heute mit einem Foto." },
    },
    nudge: {
      title: "Deine Mahlzeiten heute",
      body: "Trag ein, was du heute gegessen hast — ein Foto reicht.",
    },
  },
  it: {
    "trial-end": {
      title: "La prova finisce domani",
      body: "Domani finisce la tua prova gratuita. Se resti non devi fare nulla; altrimenti: Impostazioni › Abbonamenti.",
    },
    evening: {
      title: "Oggi rispetto al piano",
      body: "{eaten} delle tue {plan}kcal oggi. {tomorrow}",
      emptyBody: "Oggi niente registrato — le tue {plan}kcal restano il piano. {tomorrow}",
    },
    "onboarding-start": {
      title: "Il tuo piano è quasi pronto",
      body: "Pochi tocchi e il tuo piano è pronto.",
      alternates: { v2: "Riprendi da dove ti eri fermato — basta un minuto.", v3: "Il tuo piano aspetta solo qualche risposta.", v4: "Rispondi alle ultime domande e il piano è tuo." },
    },
    "onboarding-photo": {
      title: "Il tuo primo pasto",
      body: "Fotografa il prossimo pasto — basta questo per iniziare.",
      alternates: { v2: "Una foto è sufficiente per partire.", v3: "Il piano è pronto. Registra il primo pasto quando vuoi.", v4: "La prossima volta che mangi prova con una foto — al resto pensiamo noi." },
    },
    "streak-risk": {
      title: "Continua così",
      body: "Registri i pasti da qualche giorno di fila. Una foto oggi mantiene la serie.",
      alternates: { v2: "Una foto veloce e anche oggi conta.", v3: "Ancora niente oggi? Un pasto e la serie continua.", v4: "La tua serie è ancora lì — aggiungi oggi con una foto." },
    },
    nudge: {
      title: "I pasti di oggi",
      body: "Registra cosa hai mangiato oggi — basta una foto.",
    },
  },
  es: {
    "trial-end": {
      title: "La prueba termina mañana",
      body: "Mañana acaba tu prueba gratis. Si te quedas, nada que hacer; si no: Ajustes › Suscripciones.",
    },
    evening: {
      title: "Hoy frente al plan",
      body: "{eaten} de tus {plan}kcal hoy. {tomorrow}",
      emptyBody: "Hoy sin registros — tus {plan}kcal siguen siendo el plan. {tomorrow}",
    },
    "onboarding-start": {
      title: "Tu plan está casi listo",
      body: "Unos toques y tu plan está listo.",
      alternates: { v2: "Retoma donde lo dejaste: solo lleva un minuto.", v3: "Tu plan solo espera unas respuestas.", v4: "Termina las últimas preguntas y el plan es tuyo." },
    },
    "onboarding-photo": {
      title: "Tu primera comida",
      body: "Haz una foto de tu próxima comida: es todo lo que hace falta para empezar.",
      alternates: { v2: "Una foto basta para arrancar.", v3: "Tu plan está listo. Apunta tu primera comida cuando quieras.", v4: "La próxima vez que comas, prueba con una foto; del resto nos ocupamos." },
    },
    "streak-risk": {
      title: "Sigue así",
      body: "Llevas varios días seguidos apuntando. Una foto hoy mantiene la racha.",
      alternates: { v2: "Una foto rápida y hoy también cuenta.", v3: "¿Aún sin apuntar hoy? Una comida y la racha sigue.", v4: "Tu racha sigue viva: suma hoy con una foto." },
    },
    nudge: {
      title: "Las comidas de hoy",
      body: "Apunta lo que comiste hoy: basta con una foto.",
    },
  },
  vi: {
    "trial-end": {
      title: "Ngày mai hết thời gian dùng thử",
      body: "Ngày mai bản dùng thử kết thúc. Ở lại thì không cần làm gì; nếu không: Cài đặt › Gói đăng ký.",
    },
    evening: {
      title: "Hôm nay so với kế hoạch",
      body: "{eaten} trên {plan}kcal hôm nay. {tomorrow}",
      emptyBody: "Hôm nay chưa ghi gì — {plan}kcal của bạn vẫn là kế hoạch. {tomorrow}",
    },
    "onboarding-start": {
      title: "Kế hoạch của bạn sắp xong",
      body: "Vài chạm nữa là kế hoạch của bạn sẵn sàng.",
      alternates: { v2: "Tiếp tục từ chỗ bạn dừng — chỉ mất một phút.", v3: "Kế hoạch của bạn chỉ còn chờ vài câu trả lời.", v4: "Trả lời nốt các câu cuối và kế hoạch là của bạn." },
    },
    "onboarding-photo": {
      title: "Bữa ăn đầu tiên",
      body: "Chụp ảnh bữa ăn tiếp theo — chỉ cần vậy để bắt đầu.",
      alternates: { v2: "Một tấm ảnh là đủ để bắt đầu.", v3: "Kế hoạch đã xong. Ghi bữa đầu tiên khi bạn sẵn sàng.", v4: "Lần tới khi ăn, thử chụp ảnh — phần còn lại để chúng tôi lo." },
    },
    "streak-risk": {
      title: "Giữ nhịp nào",
      body: "Bạn đã ghi chép nhiều ngày liên tiếp. Một tấm ảnh hôm nay giữ chuỗi ngày đi tiếp.",
      alternates: { v2: "Một tấm ảnh nhanh và hôm nay cũng được tính.", v3: "Hôm nay chưa ghi gì? Một bữa là chuỗi ngày đi tiếp.", v4: "Chuỗi ngày của bạn vẫn còn — thêm hôm nay bằng một tấm ảnh." },
    },
    nudge: {
      title: "Bữa ăn hôm nay",
      body: "Ghi lại những gì bạn ăn hôm nay — chỉ cần một tấm ảnh.",
    },
  },
  id: {
    "trial-end": {
      title: "Uji coba berakhir besok",
      body: "Besok masa uji cobamu berakhir. Kalau lanjut, tidak perlu apa-apa; kalau tidak: Pengaturan › Langganan.",
    },
    evening: {
      title: "Hari ini dibanding rencana",
      body: "{eaten} dari {plan}kcal hari ini. {tomorrow}",
      emptyBody: "Hari ini belum ada catatan — {plan}kcal-mu tetap rencananya. {tomorrow}",
    },
    "onboarding-start": {
      title: "Rencanamu hampir siap",
      body: "Beberapa ketukan lagi dan rencanamu siap.",
      alternates: { v2: "Lanjutkan dari tempat kamu berhenti — hanya semenit.", v3: "Rencanamu tinggal menunggu beberapa jawaban.", v4: "Selesaikan pertanyaan terakhir dan rencana jadi milikmu." },
    },
    "onboarding-photo": {
      title: "Makan pertamamu",
      body: "Foto makanan berikutnya — itu saja yang dibutuhkan untuk mulai.",
      alternates: { v2: "Satu foto sudah cukup untuk mulai.", v3: "Rencanamu sudah siap. Catat makan pertamamu kapan pun kamu mau.", v4: "Saat makan nanti, coba foto — sisanya kami yang urus." },
    },
    "streak-risk": {
      title: "Terus berjalan",
      body: "Kamu sudah mencatat beberapa hari berturut-turut. Satu foto hari ini menjaga rangkaiannya.",
      alternates: { v2: "Satu foto cepat dan hari ini ikut terhitung.", v3: "Belum ada catatan hari ini? Satu makanan dan rangkaian berlanjut.", v4: "Rangkaianmu masih hidup — tambahkan hari ini dengan satu foto." },
    },
    nudge: {
      title: "Makanan hari ini",
      body: "Catat apa yang kamu makan hari ini — cukup satu foto.",
    },
  },
  ru: {
    "trial-end": {
      title: "Пробный период кончается завтра",
      body: "Завтра пробный период заканчивается. Остаёшься — делать ничего не нужно; если нет: Настройки › Подписки.",
    },
    evening: {
      title: "Итоги дня",
      body: "{eaten} из твоих {plan}ккал сегодня. {tomorrow}",
      emptyBody: "Сегодня ничего не записано — твои {plan}ккал всё ещё план. {tomorrow}",
    },
    "onboarding-start": {
      title: "Осталось немного до плана",
      body: "Пара касаний — и план собран.",
      alternates: { v2: "Вернись к вопросам — это займёт минуту.", v3: "Плану осталось дождаться нескольких ответов.", v4: "Ответь на последние вопросы — и план твой." },
    },
    "onboarding-photo": {
      title: "Первый приём пищи",
      body: "Сфотографируй следующий приём пищи — для старта этого достаточно.",
      alternates: { v2: "Одного фото хватит, чтобы начать.", v3: "План собран. Запиши первый приём пищи, когда захочешь.", v4: "В следующий раз перед едой попробуй фото — остальное берём на себя." },
    },
    "streak-risk": {
      title: "Не сбавляй ход",
      body: "Записи идут несколько дней подряд. Фото сегодня продлит серию.",
      alternates: { v2: "Быстрое фото — и сегодня тоже засчитан.", v3: "Сегодня ещё пусто? Один приём пищи — и серия продолжается.", v4: "Серия жива — добавь сегодня одним фото." },
    },
    nudge: {
      title: "Еда за сегодня",
      body: "Запиши сегодняшнюю еду — хватит одного фото.",
    },
  },
  te: {
  "trial-end": {
    title: "ట్రయల్ రేపటితో ముగుస్తుంది",
    // "if you're staying" rather than "the subscription starts": a CANCELLATION leaves the expiry
    // where it was, so somebody who has already stopped it still gets this message, and telling
    // them a subscription is about to start would be false rather than merely redundant.
    body: "రేపు మీ ఉచిత ట్రయల్ ముగుస్తుంది. కొనసాగించాలనుకుంటే ఏమీ చేయనక్కర్లేదు; లేకపోతే సెట్టింగ్‌లు › సబ్‌స్క్రిప్షన్‌లు.",
  },
  evening: {
    title: "ప్లాన్‌తో పోలిస్తే ఈరోజు",
    body: "ఈరోజు మీ {plan} kcalలో {eaten}. {tomorrow}",
    emptyBody: "ఈరోజు ఏదీ నమోదు కాలేదు — మీ ప్లాన్ ఇంకా {plan} kcal. {tomorrow}",
  },
  // The free account's line (#730): no figures, because the figures read the day against the plan
  // and that reading is what a subscription buys.
  "onboarding-start": {
    title: "మీ ప్లాన్ దాదాపు సిద్ధంగా ఉంది",
    body: "కొన్ని ట్యాప్‌లు, మీ ప్లాన్ సిద్ధం.",
    alternates: { v2: "ఆపిన చోట నుండి కొనసాగించండి — ఒక్క నిమిషం చాలు.", v3: "మీ ప్లాన్ కొన్ని సమాధానాల కోసం వేచి ఉంది.", v4: "చివరి ప్రశ్నలు పూర్తి చేయండి, ప్లాన్ మీదే." },
  },
  "onboarding-photo": {
    title: "మీ మొదటి భోజనం",
    body: "మీ తదుపరి భోజనం ఫోటో తీయండి — మొదలుపెట్టడానికి అంతే చాలు.",
    alternates: { v2: "మొదలుపెట్టడానికి ఒక ఫోటో చాలు.", v3: "మీ ప్లాన్ సిద్ధం. మీకు వీలైనప్పుడు మీ మొదటి భోజనాన్ని నమోదు చేయండి.", v4: "ఈసారి తినేటప్పుడు ఫోటో ప్రయత్నించండి — మిగతాది మేము చూసుకుంటాం." },
  },
  "streak-risk": {
    title: "స్ట్రీక్ కొనసాగించండి",
    body: "కొన్ని రోజులుగా వరుసగా నమోదు చేస్తున్నారు. ఈరోజు ఒక ఫోటోతో స్ట్రీక్ కొనసాగుతుంది.",
    alternates: { v2: "ఒక్క శీఘ్ర ఫోటో, ఈరోజు కూడా లెక్కలోకి వస్తుంది.", v3: "ఈరోజు ఇంకా ఏదీ నమోదు కాలేదా? ఒక భోజనం, స్ట్రీక్ కొనసాగుతుంది.", v4: "మీ స్ట్రీక్ ఇంకా నిలిచే ఉంది — ఒక ఫోటోతో ఈరోజును జోడించండి." },
  },
  nudge: {
    title: "ఈరోజు భోజనాలు",
    body: "ఈరోజు మీరు తిన్నది నమోదు చేయండి — ఒక ఫోటో చాలు.",
  },
},
  ta: {
  "trial-end": {
    title: "சோதனை நாளை முடிகிறது",
    // "if you're staying" rather than "the subscription starts": a CANCELLATION leaves the expiry
    // where it was, so somebody who has already stopped it still gets this message, and telling
    // them a subscription is about to start would be false rather than merely redundant.
    body: "நாளை உங்கள் இலவச சோதனை முடிகிறது. தொடர விரும்பினால் எதுவும் செய்ய வேண்டாம்; இல்லையெனில் அமைப்புகள் › சந்தாக்கள்.",
  },
  evening: {
    title: "இன்று, திட்டத்துடன் ஒப்பிட்டு",
    body: "இன்று உங்கள் {plan} kcal-இல் {eaten}. {tomorrow}",
    emptyBody: "இன்று எதுவும் பதிவாகவில்லை — உங்கள் திட்டம் இன்னும் {plan} kcal தான். {tomorrow}",
  },
  // The free account's line (#730): no figures, because the figures read the day against the plan
  // and that reading is what a subscription buys.
  "onboarding-start": {
    title: "உங்கள் திட்டம் கிட்டத்தட்டத் தயார்",
    body: "சில தட்டல்கள், உங்கள் திட்டம் தயார்.",
    alternates: { v2: "நிறுத்திய இடத்திலிருந்து தொடருங்கள் — ஒரு நிமிடம்தான் ஆகும்.", v3: "உங்கள் திட்டம் சில பதில்களுக்காகக் காத்திருக்கிறது.", v4: "கடைசிக் கேள்விகளை முடியுங்கள், திட்டம் உங்களுடையது." },
  },
  "onboarding-photo": {
    title: "உங்கள் முதல் உணவு",
    body: "உங்கள் அடுத்த உணவைப் புகைப்படம் எடுங்கள் — தொடங்க அது மட்டும் போதும்.",
    alternates: { v2: "தொடங்க ஒரு புகைப்படம் போதும்.", v3: "உங்கள் திட்டம் தயார். நீங்கள் தயாரானதும் முதல் உணவைப் பதிவுசெய்யுங்கள்.", v4: "அடுத்த முறை சாப்பிடும்போது ஒரு புகைப்படம் எடுத்துப் பாருங்கள் — மீதியை நாங்கள் பார்த்துக்கொள்கிறோம்." },
  },
  "streak-risk": {
    title: "தொடர்ச்சியைத் தொடருங்கள்",
    body: "சில நாட்களாகத் தொடர்ந்து பதிவுசெய்து வருகிறீர்கள். இன்று ஒரு புகைப்படம் தொடர்ச்சியைத் தக்கவைக்கும்.",
    alternates: { v2: "ஒரு விரைவான புகைப்படம், இன்றும் கணக்கில் சேரும்.", v3: "இன்று இன்னும் எதுவும் பதிவாகவில்லையா? ஒரு உணவு போதும், தொடர்ச்சி தொடரும்.", v4: "உங்கள் தொடர்ச்சி இன்னும் உயிருடன் உள்ளது — ஒரு புகைப்படத்துடன் இன்றையும் சேருங்கள்." },
  },
  nudge: {
    title: "இன்றைய உணவுகள்",
    body: "இன்று சாப்பிட்டதைப் பதிவுசெய்யுங்கள் — ஒரு புகைப்படம் போதும்.",
  },
},
  pa: {
  "trial-end": {
    title: "ਟ੍ਰਾਇਲ ਕੱਲ੍ਹ ਖ਼ਤਮ ਹੋ ਰਿਹਾ ਹੈ",
    // "if you're staying" rather than "the subscription starts": a CANCELLATION leaves the expiry
    // where it was, so somebody who has already stopped it still gets this message, and telling
    // them a subscription is about to start would be false rather than merely redundant.
    body: "ਕੱਲ੍ਹ ਤੁਹਾਡਾ ਮੁਫ਼ਤ ਟ੍ਰਾਇਲ ਖ਼ਤਮ ਹੋਵੇਗਾ। ਜਾਰੀ ਰੱਖਣਾ ਹੈ ਤਾਂ ਕੁਝ ਨਹੀਂ ਕਰਨਾ; ਨਹੀਂ ਤਾਂ ਸੈਟਿੰਗਾਂ › ਸਬਸਕ੍ਰਿਪਸ਼ਨਾਂ।",
  },
  evening: {
    title: "ਅੱਜ ਦਾ ਦਿਨ, ਪਲਾਨ ਦੇ ਮੁਕਾਬਲੇ",
    body: "ਅੱਜ ਤੁਹਾਡੇ {plan} kcal ਵਿੱਚੋਂ {eaten}। {tomorrow}",
    emptyBody: "ਅੱਜ ਕੁਝ ਦਰਜ ਨਹੀਂ ਹੋਇਆ — ਤੁਹਾਡਾ ਪਲਾਨ ਹਾਲੇ ਵੀ {plan} kcal ਹੈ। {tomorrow}",
  },
  // The free account's line (#730): no figures, because the figures read the day against the plan
  // and that reading is what a subscription buys.
  "onboarding-start": {
    title: "ਤੁਹਾਡਾ ਪਲਾਨ ਲਗਭਗ ਤਿਆਰ ਹੈ",
    body: "ਬੱਸ ਕੁਝ ਟੈਪ, ਅਤੇ ਤੁਹਾਡਾ ਪਲਾਨ ਤਿਆਰ।",
    alternates: { v2: "ਜਿੱਥੇ ਛੱਡਿਆ ਸੀ ਉੱਥੋਂ ਹੀ ਸ਼ੁਰੂ ਕਰੋ — ਬੱਸ ਇੱਕ ਮਿੰਟ ਲੱਗੇਗਾ।", v3: "ਤੁਹਾਡਾ ਪਲਾਨ ਕੁਝ ਜਵਾਬਾਂ ਦੀ ਉਡੀਕ ਕਰ ਰਿਹਾ ਹੈ।", v4: "ਆਖ਼ਰੀ ਸਵਾਲਾਂ ਦੇ ਜਵਾਬ ਦਿਓ, ਅਤੇ ਪਲਾਨ ਤੁਹਾਡਾ।" },
  },
  "onboarding-photo": {
    title: "ਤੁਹਾਡਾ ਪਹਿਲਾ ਖਾਣਾ",
    body: "ਆਪਣੇ ਅਗਲੇ ਖਾਣੇ ਦੀ ਫ਼ੋਟੋ ਲਓ — ਸ਼ੁਰੂ ਕਰਨ ਲਈ ਬੱਸ ਇੰਨਾ ਹੀ ਚਾਹੀਦਾ ਹੈ।",
    alternates: { v2: "ਸ਼ੁਰੂਆਤ ਲਈ ਇੱਕ ਫ਼ੋਟੋ ਕਾਫ਼ੀ ਹੈ।", v3: "ਤੁਹਾਡਾ ਪਲਾਨ ਤਿਆਰ ਹੈ। ਜਦੋਂ ਮਨ ਹੋਵੇ, ਆਪਣਾ ਪਹਿਲਾ ਖਾਣਾ ਦਰਜ ਕਰੋ।", v4: "ਅਗਲੀ ਵਾਰ ਖਾਣ ਵੇਲੇ ਫ਼ੋਟੋ ਲੈ ਕੇ ਦੇਖੋ — ਬਾਕੀ ਅਸੀਂ ਸੰਭਾਲ ਲਵਾਂਗੇ।" },
  },
  "streak-risk": {
    title: "ਸਟ੍ਰੀਕ ਜਾਰੀ ਰੱਖੋ",
    body: "ਕੁਝ ਦਿਨਾਂ ਤੋਂ ਲਗਾਤਾਰ ਖਾਣੇ ਦਰਜ ਹੋ ਰਹੇ ਹਨ। ਅੱਜ ਇੱਕ ਫ਼ੋਟੋ ਨਾਲ ਸਟ੍ਰੀਕ ਜਾਰੀ ਰਹੇਗੀ।",
    alternates: { v2: "ਇੱਕ ਝਟਪਟ ਫ਼ੋਟੋ, ਅਤੇ ਅੱਜ ਦਾ ਦਿਨ ਵੀ ਗਿਣਿਆ ਜਾਵੇਗਾ।", v3: "ਅੱਜ ਹਾਲੇ ਤੱਕ ਕੁਝ ਦਰਜ ਨਹੀਂ? ਇੱਕ ਖਾਣਾ, ਅਤੇ ਸਟ੍ਰੀਕ ਜਾਰੀ।", v4: "ਤੁਹਾਡੀ ਸਟ੍ਰੀਕ ਹਾਲੇ ਬਣੀ ਹੋਈ ਹੈ — ਇੱਕ ਫ਼ੋਟੋ ਨਾਲ ਅੱਜ ਨੂੰ ਵੀ ਜੋੜੋ।" },
  },
  nudge: {
    title: "ਅੱਜ ਦੇ ਖਾਣੇ",
    body: "ਅੱਜ ਜੋ ਖਾਧਾ ਉਸ ਨੂੰ ਦਰਜ ਕਰੋ — ਇੱਕ ਫ਼ੋਟੋ ਕਾਫ਼ੀ ਹੈ।",
  },
},
  or: {
  "trial-end": {
    title: "ଟ୍ରାଏଲ୍ କାଲି ଶେଷ ହେବ",
    // "if you're staying" rather than "the subscription starts": a CANCELLATION leaves the expiry
    // where it was, so somebody who has already stopped it still gets this message, and telling
    // them a subscription is about to start would be false rather than merely redundant.
    body: "କାଲି ଆପଣଙ୍କ ମାଗଣା ଟ୍ରାଏଲ୍ ଶେଷ ହେବ। ଜାରି ରଖିବାକୁ ଚାହିଁଲେ କିଛି କରିବାକୁ ନାହିଁ; ନଚେତ୍ ସେଟିଂସ୍ › ସବସ୍କ୍ରିପସନ୍।",
  },
  evening: {
    title: "ଆଜି, ପ୍ଲାନ୍ ତୁଳନାରେ",
    body: "ଆଜି ଆପଣଙ୍କ {plan} kcal ମଧ୍ୟରୁ {eaten}। {tomorrow}",
    emptyBody: "ଆଜି କିଛି ଲଗ୍ ହୋଇନାହିଁ — ଆପଣଙ୍କ ପ୍ଲାନ୍ ଏବେ ବି {plan} kcal। {tomorrow}",
  },
  // The free account's line (#730): no figures, because the figures read the day against the plan
  // and that reading is what a subscription buys.
  "onboarding-start": {
    title: "ଆପଣଙ୍କ ପ୍ଲାନ୍ ପ୍ରାୟ ପ୍ରସ୍ତୁତ",
    body: "ଆଉ କିଛି ଟ୍ୟାପ୍, ଏବଂ ଆପଣଙ୍କ ପ୍ଲାନ୍ ପ୍ରସ୍ତୁତ।",
    alternates: { v2: "ଯେଉଁଠି ଛାଡ଼ିଥିଲେ ସେଠୁ ଆରମ୍ଭ କରନ୍ତୁ — କେବଳ ଏକ ମିନିଟ୍ ଲାଗିବ।", v3: "ଆପଣଙ୍କ ପ୍ଲାନ୍ କିଛି ଉତ୍ତର ପାଇଁ ଅପେକ୍ଷା କରୁଛି।", v4: "ଶେଷ ପ୍ରଶ୍ନଗୁଡ଼ିକର ଉତ୍ତର ଦିଅନ୍ତୁ, ଆଉ ପ୍ଲାନ୍ ଆପଣଙ୍କର।" },
  },
  "onboarding-photo": {
    title: "ଆପଣଙ୍କ ପ୍ରଥମ ଭୋଜନ",
    body: "ଆପଣଙ୍କ ପରବର୍ତ୍ତୀ ଭୋଜନର ଫଟୋ ନିଅନ୍ତୁ — ଆରମ୍ଭ କରିବାକୁ ଏତିକି ଯଥେଷ୍ଟ।",
    alternates: { v2: "ଆରମ୍ଭ ପାଇଁ ଗୋଟିଏ ଫଟୋ ଯଥେଷ୍ଟ।", v3: "ଆପଣଙ୍କ ପ୍ଲାନ୍ ସେଟ୍ ହୋଇଗଲା। ପ୍ରସ୍ତୁତ ହେଲେ ଆପଣଙ୍କ ପ୍ରଥମ ଭୋଜନ ଲଗ୍ କରନ୍ତୁ।", v4: "ପରଥର ଖାଇବା ବେଳେ ଫଟୋ ନେଇ ଦେଖନ୍ତୁ — ବାକି ଆମେ ସମ୍ଭାଳିବୁ।" },
  },
  "streak-risk": {
    title: "ଜାରି ରଖନ୍ତୁ",
    body: "କିଛି ଦିନ ଧରି ଲଗାତାର ଭୋଜନ ଲଗ୍ ହେଉଛି। ଆଜି ଗୋଟିଏ ଫଟୋ ଷ୍ଟ୍ରିକ୍ ଜାରି ରଖିବ।",
    alternates: { v2: "ଗୋଟିଏ ଶୀଘ୍ର ଫଟୋ, ଆଉ ଆଜି ବି ଗଣାଯିବ।", v3: "ଆଜି ଏପର୍ଯ୍ୟନ୍ତ କିଛି ଲଗ୍ ହୋଇନାହିଁ? ଗୋଟିଏ ଭୋଜନ, ଆଉ ଷ୍ଟ୍ରିକ୍ ଜାରି।", v4: "ଆପଣଙ୍କ ଷ୍ଟ୍ରିକ୍ ଏବେ ବି ଜାରି ଅଛି — ଗୋଟିଏ ଫଟୋ ସହ ଆଜିକୁ ଯୋଡ଼ନ୍ତୁ।" },
  },
  nudge: {
    title: "ଆଜିର ଭୋଜନ",
    body: "ଆଜି ଯାହା ଖାଇଲେ ଲଗ୍ କରନ୍ତୁ — ଗୋଟିଏ ଫଟୋ ଯଥେଷ୍ଟ।",
  },
},
  mr: {
  "trial-end": {
    title: "ट्रायल उद्या संपते",
    // "if you're staying" rather than "the subscription starts": a CANCELLATION leaves the expiry
    // where it was, so somebody who has already stopped it still gets this message, and telling
    // them a subscription is about to start would be false rather than merely redundant.
    body: "उद्या तुमचे मोफत ट्रायल संपेल. सुरू ठेवायचे असल्यास काही करायची गरज नाही; नसल्यास, सेटिंग्ज › सबस्क्रिप्शन्स.",
  },
  evening: {
    title: "आजचा दिवस, प्लॅनच्या तुलनेत",
    body: "आज तुमच्या {plan} kcal पैकी {eaten}. {tomorrow}",
    emptyBody: "आज काहीही नोंदवले नाही — तुमचा प्लॅन अजूनही {plan} kcal आहे. {tomorrow}",
  },
  // The free account's line (#730): no figures, because the figures read the day against the plan
  // and that reading is what a subscription buys.
  "onboarding-start": {
    title: "तुमचा प्लॅन जवळजवळ तयार आहे",
    body: "काही टॅप, आणि तुमचा प्लॅन तयार.",
    alternates: { v2: "जिथे सोडले होते तिथून पुढे सुरू करा — फक्त एक मिनिट लागेल.", v3: "तुमचा प्लॅन काही उत्तरांची वाट पाहत आहे.", v4: "शेवटच्या प्रश्नांची उत्तरे द्या, आणि प्लॅन तुमचा." },
  },
  "onboarding-photo": {
    title: "तुमचे पहिले जेवण",
    body: "तुमच्या पुढच्या जेवणाचा फोटो काढा — सुरुवात करायला एवढेच पुरे.",
    alternates: { v2: "सुरुवातीसाठी एक फोटो पुरेसा आहे.", v3: "तुमचा प्लॅन तयार आहे. मन असेल तेव्हा पहिले जेवण नोंदवा.", v4: "पुढच्या वेळी खाताना फोटो काढून पाहा — बाकी आम्ही पाहू." },
  },
  "streak-risk": {
    title: "स्ट्रीक सुरू ठेवा",
    body: "काही दिवस सलग नोंद झाली आहे. आज एक फोटो काढल्यास स्ट्रीक सुरू राहील.",
    alternates: { v2: "एक झटपट फोटो, आणि आजचा दिवसही मोजला जाईल.", v3: "आज अजून काहीच नोंदवले नाही? एक जेवण, आणि स्ट्रीक सुरू राहील.", v4: "तुमचा स्ट्रीक अजून सुरू आहे — एका फोटोने आजचा दिवसही जोडा." },
  },
  nudge: {
    title: "आजची जेवणे",
    body: "आज जे खाल्ले ते नोंदवा — एक फोटो पुरेसा आहे.",
  },
},
  ml: {
  "trial-end": {
    title: "ട്രയൽ നാളെ അവസാനിക്കും",
    // "if you're staying" rather than "the subscription starts": a CANCELLATION leaves the expiry
    // where it was, so somebody who has already stopped it still gets this message, and telling
    // them a subscription is about to start would be false rather than merely redundant.
    body: "നിങ്ങളുടെ സൗജന്യ ട്രയൽ നാളെ അവസാനിക്കും. തുടരാനാണെങ്കിൽ ഒന്നും ചെയ്യേണ്ട; ഇല്ലെങ്കിൽ ക്രമീകരണം › സബ്സ്ക്രിപ്ഷനുകൾ.",
  },
  evening: {
    title: "ഇന്ന്, പ്ലാനുമായി താരതമ്യം ചെയ്ത്",
    body: "ഇന്ന് നിങ്ങളുടെ {plan} kcal-ൽ {eaten}. {tomorrow}",
    emptyBody: "ഇന്ന് ഒന്നും രേഖപ്പെടുത്തിയിട്ടില്ല — നിങ്ങളുടെ പ്ലാൻ ഇപ്പോഴും {plan} kcal ആണ്. {tomorrow}",
  },
  // The free account's line (#730): no figures, because the figures read the day against the plan
  // and that reading is what a subscription buys.
  "onboarding-start": {
    title: "നിങ്ങളുടെ പ്ലാൻ ഏകദേശം തയ്യാർ",
    body: "കുറച്ച് ടാപ്പുകൾ കൂടി, നിങ്ങളുടെ പ്ലാൻ തയ്യാർ.",
    alternates: { v2: "നിർത്തിയിടത്തുനിന്ന് തുടരൂ — ഒരു മിനിറ്റേ എടുക്കൂ.", v3: "നിങ്ങളുടെ പ്ലാൻ കുറച്ച് ഉത്തരങ്ങൾക്കായി കാത്തിരിക്കുന്നു.", v4: "അവസാന ചോദ്യങ്ങൾ പൂർത്തിയാക്കൂ, പ്ലാൻ നിങ്ങളുടേത്." },
  },
  "onboarding-photo": {
    title: "നിങ്ങളുടെ ആദ്യ ഭക്ഷണം",
    body: "അടുത്ത ഭക്ഷണത്തിന്റെ ഒരു ഫോട്ടോ എടുക്കൂ — തുടങ്ങാൻ അത്രയേ വേണ്ടൂ.",
    alternates: { v2: "തുടങ്ങാൻ ഒരു ഫോട്ടോ മതി.", v3: "നിങ്ങളുടെ പ്ലാൻ തയ്യാറാണ്. തയ്യാറാകുമ്പോൾ ആദ്യ ഭക്ഷണം രേഖപ്പെടുത്തൂ.", v4: "അടുത്ത തവണ കഴിക്കുമ്പോൾ ഒരു ഫോട്ടോ എടുത്തുനോക്കൂ — ബാക്കി ഞങ്ങൾ നോക്കിക്കൊള്ളാം." },
  },
  "streak-risk": {
    title: "സ്ട്രീക്ക് തുടരൂ",
    body: "കുറച്ച് ദിവസമായി തുടർച്ചയായി രേഖപ്പെടുത്തുന്നുണ്ട്. ഇന്ന് ഒരു ഫോട്ടോ, സ്ട്രീക്ക് തുടരും.",
    alternates: { v2: "ഒരു പെട്ടെന്നുള്ള ഫോട്ടോ, ഇന്നും എണ്ണപ്പെടും.", v3: "ഇന്ന് ഇതുവരെ ഒന്നും രേഖപ്പെടുത്തിയില്ലേ? ഒരു ഭക്ഷണം, സ്ട്രീക്ക് തുടരും.", v4: "നിങ്ങളുടെ സ്ട്രീക്ക് ഇപ്പോഴും നിലനിൽക്കുന്നു — ഒരു ഫോട്ടോയിലൂടെ ഇന്നും ചേർക്കൂ." },
  },
  nudge: {
    title: "ഇന്നത്തെ ഭക്ഷണങ്ങൾ",
    body: "ഇന്ന് കഴിച്ചത് രേഖപ്പെടുത്തൂ — ഒരു ഫോട്ടോ മതി.",
  },
},
  kn: {
  "trial-end": {
    title: "ಟ್ರಯಲ್ ನಾಳೆ ಮುಗಿಯುತ್ತದೆ",
    // "if you're staying" rather than "the subscription starts": a CANCELLATION leaves the expiry
    // where it was, so somebody who has already stopped it still gets this message, and telling
    // them a subscription is about to start would be false rather than merely redundant.
    body: "ನಾಳೆ ನಿಮ್ಮ ಉಚಿತ ಟ್ರಯಲ್ ಮುಗಿಯುತ್ತದೆ. ಮುಂದುವರಿಯುವುದಾದರೆ ಏನೂ ಮಾಡಬೇಕಿಲ್ಲ; ಇಲ್ಲದಿದ್ದರೆ, ಸೆಟ್ಟಿಂಗ್‌ಗಳು › ಚಂದಾದಾರಿಕೆಗಳು.",
  },
  evening: {
    title: "ಇಂದು, ಪ್ಲಾನ್‌ಗೆ ಹೋಲಿಸಿದರೆ",
    body: "ಇಂದು ನಿಮ್ಮ {plan} kcal ಪೈಕಿ {eaten}. {tomorrow}",
    emptyBody: "ಇಂದು ಏನೂ ದಾಖಲಾಗಿಲ್ಲ — ನಿಮ್ಮ ಪ್ಲಾನ್ ಇನ್ನೂ {plan} kcal. {tomorrow}",
  },
  // The free account's line (#730): no figures, because the figures read the day against the plan
  // and that reading is what a subscription buys.
  "onboarding-start": {
    title: "ನಿಮ್ಮ ಪ್ಲಾನ್ ಬಹುತೇಕ ಸಿದ್ಧವಾಗಿದೆ",
    body: "ಕೆಲವು ಟ್ಯಾಪ್‌ಗಳು, ಮತ್ತು ನಿಮ್ಮ ಪ್ಲಾನ್ ಸಿದ್ಧ.",
    alternates: { v2: "ನಿಲ್ಲಿಸಿದಲ್ಲಿಂದಲೇ ಮುಂದುವರಿಸಿ — ಒಂದು ನಿಮಿಷ ಸಾಕು.", v3: "ನಿಮ್ಮ ಪ್ಲಾನ್ ಕೆಲವು ಉತ್ತರಗಳಿಗಾಗಿ ಕಾಯುತ್ತಿದೆ.", v4: "ಕೊನೆಯ ಪ್ರಶ್ನೆಗಳನ್ನು ಮುಗಿಸಿ, ಪ್ಲಾನ್ ನಿಮ್ಮದು." },
  },
  "onboarding-photo": {
    title: "ನಿಮ್ಮ ಮೊದಲ ಊಟ",
    body: "ನಿಮ್ಮ ಮುಂದಿನ ಊಟದ ಫೋಟೋ ತೆಗೆಯಿರಿ — ಆರಂಭಿಸಲು ಅಷ್ಟೇ ಸಾಕು.",
    alternates: { v2: "ಆರಂಭಿಸಲು ಒಂದು ಫೋಟೋ ಸಾಕು.", v3: "ನಿಮ್ಮ ಪ್ಲಾನ್ ಸಿದ್ಧವಾಗಿದೆ. ನೀವು ಸಿದ್ಧರಾದಾಗ ನಿಮ್ಮ ಮೊದಲ ಊಟವನ್ನು ದಾಖಲಿಸಿ.", v4: "ಮುಂದಿನ ಬಾರಿ ತಿನ್ನುವಾಗ, ಒಂದು ಫೋಟೋ ಪ್ರಯತ್ನಿಸಿ — ಉಳಿದದ್ದು ನಮಗೆ ಬಿಡಿ." },
  },
  "streak-risk": {
    title: "ಸ್ಟ್ರೀಕ್ ಮುಂದುವರಿಸಿ",
    body: "ಕೆಲವು ದಿನಗಳಿಂದ ಸತತವಾಗಿ ದಾಖಲಿಸಿದ್ದೀರಿ. ಇಂದು ಒಂದು ಫೋಟೋ ಸ್ಟ್ರೀಕ್ ಅನ್ನು ಮುಂದುವರಿಸುತ್ತದೆ.",
    alternates: { v2: "ಒಂದು ತ್ವರಿತ ಫೋಟೋ, ಇಂದಿನ ದಿನವೂ ಲೆಕ್ಕಕ್ಕೆ ಬರುತ್ತದೆ.", v3: "ಇಂದು ಇನ್ನೂ ಏನೂ ದಾಖಲಾಗಿಲ್ಲವೇ? ಒಂದು ಊಟ, ಸ್ಟ್ರೀಕ್ ಮುಂದುವರಿಯುತ್ತದೆ.", v4: "ನಿಮ್ಮ ಸ್ಟ್ರೀಕ್ ಇನ್ನೂ ಜೀವಂತವಾಗಿದೆ — ಒಂದು ಫೋಟೋದಿಂದ ಇಂದಿನ ದಿನವನ್ನೂ ಸೇರಿಸಿ." },
  },
  nudge: {
    title: "ಇಂದಿನ ಊಟಗಳು",
    body: "ಇಂದು ನೀವು ತಿಂದದ್ದನ್ನು ದಾಖಲಿಸಿ — ಒಂದು ಫೋಟೋ ಸಾಕು.",
  },
},
  gu: {
  "trial-end": {
    title: "ટ્રાયલ કાલે પૂરું થાય છે",
    // "if you're staying" rather than "the subscription starts": a CANCELLATION leaves the expiry
    // where it was, so somebody who has already stopped it still gets this message, and telling
    // them a subscription is about to start would be false rather than merely redundant.
    body: "કાલે તમારું મફત ટ્રાયલ પૂરું થશે. ચાલુ રાખવું હોય તો કંઈ કરવાનું નથી; નહીં તો સેટિંગ્સ › સબ્સ્ક્રિપ્શન્સ.",
  },
  evening: {
    title: "આજનો દિવસ, પ્લાનની સરખામણીમાં",
    body: "આજે તમારા {plan} kcal માંથી {eaten}. {tomorrow}",
    emptyBody: "આજે કંઈ નોંધાયું નથી — તમારો પ્લાન હજી {plan} kcal છે. {tomorrow}",
  },
  // The free account's line (#730): no figures, because the figures read the day against the plan
  // and that reading is what a subscription buys.
  "onboarding-start": {
    title: "તમારો પ્લાન લગભગ તૈયાર છે",
    body: "બસ થોડાં ટૅપ, અને તમારો પ્લાન તૈયાર.",
    alternates: { v2: "જ્યાંથી છોડ્યું હતું ત્યાંથી ફરી શરૂ કરો — બસ એક મિનિટ લાગશે.", v3: "તમારો પ્લાન થોડા જવાબોની રાહ જુએ છે.", v4: "છેલ્લા સવાલોના જવાબ આપો, અને પ્લાન તમારો." },
  },
  "onboarding-photo": {
    title: "તમારું પહેલું ભોજન",
    body: "તમારા આગલા ભોજનનો ફોટો લો — શરૂ કરવા બસ આટલું જ જોઈએ.",
    alternates: { v2: "શરૂઆત માટે એક ફોટો પૂરતો છે.", v3: "તમારો પ્લાન તૈયાર છે. મન થાય ત્યારે તમારું પહેલું ભોજન નોંધો.", v4: "હવે પછી ખાઓ ત્યારે ફોટો લઈ જુઓ — બાકીનું અમે સંભાળી લઈશું." },
  },
  "streak-risk": {
    title: "સ્ટ્રીક ચાલુ રાખો",
    body: "થોડા દિવસથી સતત ભોજન નોંધાઈ રહ્યાં છે. આજે એક ફોટોથી સ્ટ્રીક ચાલુ રહેશે.",
    alternates: { v2: "એક ઝડપી ફોટો, અને આજનો દિવસ પણ ગણાશે.", v3: "આજે હજી કંઈ નોંધાયું નથી? એક ભોજન, અને સ્ટ્રીક ચાલુ.", v4: "તમારી સ્ટ્રીક હજી ચાલુ છે — એક ફોટોથી આજનો દિવસ પણ ઉમેરો." },
  },
  nudge: {
    title: "આજનાં ભોજન",
    body: "આજે તમે જે ખાધું તે નોંધો — એક ફોટો પૂરતો છે.",
  },
},
  bn: {
  "trial-end": {
    title: "ট্রায়াল কাল শেষ হচ্ছে",
    // "if you're staying" rather than "the subscription starts": a CANCELLATION leaves the expiry
    // where it was, so somebody who has already stopped it still gets this message, and telling
    // them a subscription is about to start would be false rather than merely redundant.
    body: "কাল আপনার ফ্রি ট্রায়াল শেষ হবে। থাকতে চাইলে কিছু করতে হবে না; না চাইলে সেটিংস › সাবস্ক্রিপশন।",
  },
  evening: {
    title: "প্ল্যানের তুলনায় আজকের দিন",
    body: "আজ আপনার {plan} kcal-এর মধ্যে {eaten}। {tomorrow}",
    emptyBody: "আজ কিছুই লগ হয়নি — আপনার প্ল্যান এখনও {plan} kcal। {tomorrow}",
  },
  // The free account's line (#730): no figures, because the figures read the day against the plan
  // and that reading is what a subscription buys.
  "onboarding-start": {
    title: "আপনার প্ল্যান প্রায় তৈরি",
    body: "কয়েকটা ট্যাপ, আর আপনার প্ল্যান তৈরি।",
    alternates: { v2: "যেখানে থেমেছিলেন সেখান থেকে শুরু করুন — মাত্র এক মিনিট লাগবে।", v3: "আপনার প্ল্যান কয়েকটি উত্তরের অপেক্ষায়।", v4: "শেষ প্রশ্নগুলোর উত্তর দিন, প্ল্যান আপনার।" },
  },
  "onboarding-photo": {
    title: "আপনার প্রথম খাবার",
    body: "পরের খাবারের একটা ছবি তুলুন — শুরু করতে এটুকুই লাগে।",
    alternates: { v2: "শুরু করতে একটা ছবিই যথেষ্ট।", v3: "আপনার প্ল্যান তৈরি। সুবিধামতো প্রথম খাবারটি লগ করুন।", v4: "পরের বার খাওয়ার সময় একটা ছবি তুলে দেখুন — বাকিটা আমরা সামলাব।" },
  },
  "streak-risk": {
    title: "স্ট্রিক চালিয়ে যান",
    body: "কয়েক দিন টানা লগ হয়েছে। আজ একটা ছবি দিলেই স্ট্রিক চলতে থাকবে।",
    alternates: { v2: "একটা ঝটপট ছবি, আর আজকের দিনটাও গোনা হবে।", v3: "আজ এখনও কিছু লগ হয়নি? একটা খাবার, আর স্ট্রিক চলবে।", v4: "আপনার স্ট্রিক এখনও টিকে আছে — একটা ছবি দিয়ে আজকের দিনটাও যোগ করুন।" },
  },
  nudge: {
    title: "আজকের খাবার",
    body: "আজ যা খেয়েছেন তা লগ করুন — একটা ছবিই যথেষ্ট।",
  },
},
  "pt-PT": {
  "trial-end": {
    title: "A avaliação gratuita termina amanhã",
    // "if you're staying" rather than "the subscription starts": a CANCELLATION leaves the expiry
    // where it was, so somebody who has already stopped it still gets this message, and telling
    // them a subscription is about to start would be false rather than merely redundant.
    body: "A tua avaliação gratuita termina amanhã. Se fores continuar, não precisas de fazer nada; se não, Definições › Subscrições.",
  },
  evening: {
    title: "Hoje face ao plano",
    body: "{eaten} das tuas {plan} kcal hoje. {tomorrow}",
    emptyBody: "Nada registado hoje — as tuas {plan} kcal continuam a ser o plano. {tomorrow}",
  },
  // The free account's line (#730): no figures, because the figures read the day against the plan
  // and that reading is what a subscription buys.
  "onboarding-start": {
    title: "O teu plano está quase pronto",
    body: "Mais uns toques e o teu plano fica pronto.",
    alternates: { v2: "Continua onde paraste — só demora um minuto.", v3: "O teu plano só espera por algumas respostas.", v4: "Responde às últimas perguntas e o plano é teu." },
  },
  "onboarding-photo": {
    title: "A tua primeira refeição",
    body: "Tira uma foto da tua próxima refeição — é só isso para começar.",
    alternates: { v2: "Uma foto basta para começar.", v3: "O teu plano está pronto. Regista a tua primeira refeição quando quiseres.", v4: "Da próxima vez que comeres, experimenta uma foto — nós tratamos do resto." },
  },
  "streak-risk": {
    title: "Mantém o ritmo",
    body: "Registaste vários dias seguidos. Uma foto hoje mantém a sequência.",
    alternates: { v2: "Uma foto rápida e hoje também conta.", v3: "Ainda nada registado hoje? Uma refeição e a sequência continua.", v4: "A tua sequência continua viva — junta o dia de hoje com uma foto." },
  },
  nudge: {
    title: "Refeições de hoje",
    body: "Regista o que comeste hoje — uma foto basta.",
  },
},
  ms: {
  "trial-end": {
    title: "Percubaan tamat esok",
    // "if you're staying" rather than "the subscription starts": a CANCELLATION leaves the expiry
    // where it was, so somebody who has already stopped it still gets this message, and telling
    // them a subscription is about to start would be false rather than merely redundant.
    body: "Esok percubaan percuma anda tamat. Jika anda kekal, tiada apa perlu dibuat; jika tidak, Seting › Langganan.",
  },
  evening: {
    title: "Hari ini berbanding pelan",
    body: "{eaten} daripada {plan} kcal anda hari ini. {tomorrow}",
    emptyBody: "Tiada apa-apa dicatat hari ini — {plan} kcal anda masih pelannya. {tomorrow}",
  },
  // The free account's line (#730): no figures, because the figures read the day against the plan
  // and that reading is what a subscription buys.
  "onboarding-start": {
    title: "Pelan anda hampir siap",
    body: "Beberapa ketikan lagi dan pelan anda siap.",
    alternates: { v2: "Sambung dari tempat anda berhenti — hanya seminit.", v3: "Pelan anda menunggu beberapa jawapan.", v4: "Jawab soalan terakhir dan pelan anda milik anda." },
  },
  "onboarding-photo": {
    title: "Hidangan pertama anda",
    body: "Ambil foto hidangan anda yang seterusnya — itu sahaja untuk bermula.",
    alternates: { v2: "Sekeping foto sudah cukup untuk bermula.", v3: "Pelan anda sudah ditetapkan. Catat hidangan pertama anda apabila anda bersedia.", v4: "Kali seterusnya anda makan, cuba ambil foto — kami uruskan selebihnya." },
  },
  "streak-risk": {
    title: "Teruskan momentum",
    body: "Anda telah mencatat beberapa hari berturut-turut. Sekeping foto hari ini meneruskan rentetan itu.",
    alternates: { v2: "Satu foto pantas dan hari ini juga dikira.", v3: "Belum mencatat apa-apa hari ini? Satu hidangan dan rentetan diteruskan.", v4: "Rentetan anda masih hidup — tambah hari ini dengan foto." },
  },
  nudge: {
    title: "Hidangan hari ini",
    body: "Catat apa yang anda makan hari ini — sekeping foto sudah cukup.",
  },
},
  ca: {
  "trial-end": {
    title: "La prova acaba demà",
    // "if you're staying" rather than "the subscription starts": a CANCELLATION leaves the expiry
    // where it was, so somebody who has already stopped it still gets this message, and telling
    // them a subscription is about to start would be false rather than merely redundant.
    body: "Demà acaba la teva prova gratuïta. Si et quedes, no cal fer res; si no, Configuració › Subscripcions.",
  },
  evening: {
    title: "Avui davant el pla",
    body: "{eaten} de les teves {plan} kcal avui. {tomorrow}",
    emptyBody: "Res registrat avui — les teves {plan} kcal continuen sent el pla. {tomorrow}",
  },
  // The free account's line (#730): no figures, because the figures read the day against the plan
  // and that reading is what a subscription buys.
  "onboarding-start": {
    title: "El teu pla és gairebé a punt",
    body: "Uns quants tocs i el teu pla és a punt.",
    alternates: { v2: "Continua on ho vas deixar — només és un minut.", v3: "Al teu pla només li falten unes quantes respostes.", v4: "Acaba les últimes preguntes i el pla és teu." },
  },
  "onboarding-photo": {
    title: "El teu primer àpat",
    body: "Fes una foto del teu proper àpat — no cal res més per començar.",
    alternates: { v2: "Amb una foto n'hi ha prou per arrencar.", v3: "El teu pla és a punt. Registra el primer àpat quan vulguis.", v4: "El proper cop que mengis, prova amb una foto — nosaltres fem la resta." },
  },
  "streak-risk": {
    title: "Continua així",
    body: "Portes uns quants dies seguits registrant. Una foto avui manté la ratxa.",
    alternates: { v2: "Una foto ràpida i avui també compta.", v3: "Encara no has registrat res avui? Un àpat i la ratxa continua.", v4: "La teva ratxa continua viva — afegeix avui amb una foto." },
  },
  nudge: {
    title: "Els àpats d'avui",
    body: "Registra el que has menjat avui — amb una foto n'hi ha prou.",
  },
},
  sl: {
  "trial-end": {
    title: "Preizkusno obdobje se konča jutri",
    // "if you're staying" rather than "the subscription starts": a CANCELLATION leaves the expiry
    // where it was, so somebody who has already stopped it still gets this message, and telling
    // them a subscription is about to start would be false rather than merely redundant.
    body: "Jutri se tvoje brezplačno preizkusno obdobje konča. Če ostaneš, ti ni treba storiti ničesar; če ne, Nastavitve › Naročnine.",
  },
  evening: {
    title: "Današnji dan v primerjavi z načrtom",
    body: "{eaten} od tvojih {plan} kcal danes. {tomorrow}",
    emptyBody: "Danes ni nič zabeleženo — tvoj načrt je še vedno {plan} kcal. {tomorrow}",
  },
  // The free account's line (#730): no figures, because the figures read the day against the plan
  // and that reading is what a subscription buys.
  "onboarding-start": {
    title: "Tvoj načrt je skoraj pripravljen",
    body: "Nekaj dotikov in tvoj načrt je pripravljen.",
    alternates: { v2: "Vrni se k vprašanjem — vzame le minuto.", v3: "Tvoj načrt čaka le še na nekaj odgovorov.", v4: "Odgovori na zadnja vprašanja in načrt je tvoj." },
  },
  "onboarding-photo": {
    title: "Tvoj prvi obrok",
    body: "Fotografiraj naslednji obrok — to je vse, kar potrebuješ za začetek.",
    alternates: { v2: "Ena fotografija je dovolj za začetek.", v3: "Tvoj načrt je nastavljen. Prvi obrok zabeleži, kadar želiš.", v4: "Pri naslednjem obroku poskusi s fotografijo — za ostalo poskrbimo mi." },
  },
  "streak-risk": {
    title: "Kar tako naprej",
    body: "Nekaj dni zapored že beležiš. Fotografija danes ohrani niz.",
    alternates: { v2: "Ena hitra fotografija in tudi danes šteje.", v3: "Danes še nič zabeleženega? En obrok in niz se nadaljuje.", v4: "Tvoj niz še živi — dodaj današnji dan s fotografijo." },
  },
  nudge: {
    title: "Današnji obroki",
    body: "Zabeleži današnje obroke — fotografija je dovolj.",
  },
},
  hr: {
  "trial-end": {
    title: "Probno razdoblje završava sutra",
    // "if you're staying" rather than "the subscription starts": a CANCELLATION leaves the expiry
    // where it was, so somebody who has already stopped it still gets this message, and telling
    // them a subscription is about to start would be false rather than merely redundant.
    body: "Sutra ti završava besplatno probno razdoblje. Ako ostaješ, ne trebaš ništa učiniti; ako ne, Postavke › Pretplate.",
  },
  evening: {
    title: "Današnji dan u odnosu na plan",
    body: "{eaten} od tvojih {plan} kcal danas. {tomorrow}",
    emptyBody: "Danas ništa nije zabilježeno — tvojih {plan} kcal i dalje je plan. {tomorrow}",
  },
  // The free account's line (#730): no figures, because the figures read the day against the plan
  // and that reading is what a subscription buys.
  "onboarding-start": {
    title: "Tvoj plan je gotovo spreman",
    body: "Još nekoliko dodira i plan je spreman.",
    alternates: { v2: "Nastavi ondje gdje je stalo — traje samo minutu.", v3: "Tvoj plan čeka još nekoliko odgovora.", v4: "Odgovori na zadnja pitanja i plan je tvoj." },
  },
  "onboarding-photo": {
    title: "Tvoj prvi obrok",
    body: "Fotografiraj sljedeći obrok — to je sve što treba za početak.",
    alternates: { v2: "Jedna fotografija dovoljna je za početak.", v3: "Plan je postavljen. Zabilježi prvi obrok kad ti odgovara.", v4: "Kad sljedeći put jedeš, probaj s fotografijom — ostalo prepusti nama." },
  },
  "streak-risk": {
    title: "Nastavi niz",
    body: "Već nekoliko dana zaredom bilježiš obroke. Fotografija danas održava niz.",
    alternates: { v2: "Jedna brza fotografija i danas se računa.", v3: "Danas još ništa zabilježeno? Jedan obrok i niz se nastavlja.", v4: "Niz je još živ — dodaj današnji dan fotografijom." },
  },
  nudge: {
    title: "Današnji obroci",
    body: "Zabilježi današnje obroke — dovoljna je fotografija.",
  },
},
  sk: {
  "trial-end": {
    title: "Skúšobné obdobie zajtra končí",
    // "if you're staying" rather than "the subscription starts": a CANCELLATION leaves the expiry
    // where it was, so somebody who has already stopped it still gets this message, and telling
    // them a subscription is about to start would be false rather than merely redundant.
    body: "Zajtra ti končí skúšobné obdobie zadarmo. Ak zostávaš, netreba nič robiť; ak nie, Nastavenia › Predplatné.",
  },
  evening: {
    title: "Dnešok v porovnaní s plánom",
    body: "Dnes {eaten} z tvojich {plan} kcal. {tomorrow}",
    emptyBody: "Dnes nič nezapísané — tvojich {plan} kcal zostáva plánom. {tomorrow}",
  },
  // The free account's line (#730): no figures, because the figures read the day against the plan
  // and that reading is what a subscription buys.
  "onboarding-start": {
    title: "Tvoj plán je takmer hotový",
    body: "Pár ťuknutí a tvoj plán je hotový.",
    alternates: { v2: "Pokračuj v otázkach — zaberie to len minútu.", v3: "Tvoj plán čaká na pár odpovedí.", v4: "Dokonči posledné otázky a plán je tvoj." },
  },
  "onboarding-photo": {
    title: "Tvoje prvé jedlo",
    body: "Odfoť svoje ďalšie jedlo — na začiatok nič viac netreba.",
    alternates: { v2: "Na začiatok stačí jedna fotka.", v3: "Tvoj plán je hotový. Zapíš prvé jedlo, keď budeš chcieť.", v4: "Keď budeš nabudúce jesť, skús fotku — zvyšok vybavíme my." },
  },
  "streak-risk": {
    title: "Drž sériu",
    body: "Pár dní za sebou máš zapísané. Dnešná fotka sériu predĺži.",
    alternates: { v2: "Jedna rýchla fotka a aj dnešok sa počíta.", v3: "Dnes ešte nič nezapísané? Jedno jedlo a séria pokračuje.", v4: "Tvoja séria stále žije — pridaj dnešok fotkou." },
  },
  nudge: {
    title: "Dnešné jedlá",
    body: "Zapíš dnešné jedlá — stačí fotka.",
  },
},
  no: {
  "trial-end": {
    title: "Prøveperioden slutter i morgen",
    // "if you're staying" rather than "the subscription starts": a CANCELLATION leaves the expiry
    // where it was, so somebody who has already stopped it still gets this message, and telling
    // them a subscription is about to start would be false rather than merely redundant.
    body: "I morgen slutter den gratis prøveperioden din. Hvis du blir, trenger du ikke gjøre noe; hvis ikke, Innstillinger › Abonnementer.",
  },
  evening: {
    title: "I dag mot planen",
    body: "{eaten} av dine {plan} kcal i dag. {tomorrow}",
    emptyBody: "Ingenting logget i dag — dine {plan} kcal er fortsatt planen. {tomorrow}",
  },
  // The free account's line (#730): no figures, because the figures read the day against the plan
  // and that reading is what a subscription buys.
  "onboarding-start": {
    title: "Planen din er nesten klar",
    body: "Noen få trykk, så er planen din klar.",
    alternates: { v2: "Fortsett der du slapp — det tar bare et minutt.", v3: "Planen din venter på noen få svar.", v4: "Svar på de siste spørsmålene, så er planen din." },
  },
  "onboarding-photo": {
    title: "Ditt første måltid",
    body: "Ta et bilde av neste måltid — det er alt som skal til for å starte.",
    alternates: { v2: "Ett bilde er nok til å komme i gang.", v3: "Planen din står. Logg det første måltidet når det passer deg.", v4: "Neste gang du spiser, prøv et bilde — vi tar oss av resten." },
  },
  "streak-risk": {
    title: "Hold det gående",
    body: "Du har logget noen dager på rad. Et bilde i dag holder rekken i gang.",
    alternates: { v2: "Ett raskt bilde, så teller i dag også.", v3: "Ingenting logget i dag ennå? Ett måltid, så fortsetter rekken.", v4: "Rekken din lever fortsatt — legg til i dag med et bilde." },
  },
  nudge: {
    title: "Dagens måltider",
    body: "Logg det du spiste i dag — et bilde er nok.",
  },
},
  fi: {
  "trial-end": {
    title: "Kokeilujakso päättyy huomenna",
    // "if you're staying" rather than "the subscription starts": a CANCELLATION leaves the expiry
    // where it was, so somebody who has already stopped it still gets this message, and telling
    // them a subscription is about to start would be false rather than merely redundant.
    body: "Ilmainen kokeilujaksosi päättyy huomenna. Jos jatkat, mitään ei tarvitse tehdä; jos et, Asetukset › Tilaukset.",
  },
  evening: {
    title: "Päivä suhteessa suunnitelmaan",
    body: "Tänään {eaten}/{plan} kcal. {tomorrow}",
    emptyBody: "Tänään ei kirjauksia – suunnitelmasi on yhä {plan} kcal. {tomorrow}",
  },
  // The free account's line (#730): no figures, because the figures read the day against the plan
  // and that reading is what a subscription buys.
  "onboarding-start": {
    title: "Suunnitelmasi on melkein valmis",
    body: "Muutama napautus, niin suunnitelmasi on valmis.",
    alternates: { v2: "Jatka siitä, mihin jäit – se vie vain minuutin.", v3: "Suunnitelmasi odottaa enää muutamaa vastausta.", v4: "Vastaa viimeisiin kysymyksiin, niin suunnitelma on sinun." },
  },
  "onboarding-photo": {
    title: "Ensimmäinen ateriasi",
    body: "Ota kuva seuraavasta ateriastasi – muuta aloittamiseen ei tarvita.",
    alternates: { v2: "Yksi kuva riittää alkuun.", v3: "Suunnitelmasi on valmis. Kirjaa ensimmäinen ateriasi, kun sopii.", v4: "Kokeile kuvaa, kun seuraavan kerran syöt – me hoidamme loput." },
  },
  "streak-risk": {
    title: "Pidä putki käynnissä",
    body: "Olet kirjannut muutaman päivän putkeen. Kuva tänään pitää putken käynnissä.",
    alternates: { v2: "Yksi nopea kuva, niin tämäkin päivä lasketaan.", v3: "Ei vielä kirjauksia tänään? Yksi ateria, niin putki jatkuu.", v4: "Putkesi on yhä käynnissä – lisää tämä päivä kuvalla." },
  },
  nudge: {
    title: "Päivän ateriat",
    body: "Kirjaa, mitä söit tänään – kuva riittää.",
  },
},
  da: {
  "trial-end": {
    title: "Prøveperioden slutter i morgen",
    // "if you're staying" rather than "the subscription starts": a CANCELLATION leaves the expiry
    // where it was, so somebody who has already stopped it still gets this message, and telling
    // them a subscription is about to start would be false rather than merely redundant.
    body: "I morgen slutter din gratis prøveperiode. Hvis du bliver, skal du ikke gøre noget; hvis ikke: Indstillinger › Abonnementer.",
  },
  evening: {
    title: "I dag i forhold til planen",
    body: "{eaten} af dine {plan} kcal i dag. {tomorrow}",
    emptyBody: "Intet registreret i dag — dine {plan} kcal er stadig planen. {tomorrow}",
  },
  // The free account's line (#730): no figures, because the figures read the day against the plan
  // and that reading is what a subscription buys.
  "onboarding-start": {
    title: "Din plan er næsten klar",
    body: "Et par tryk, så er din plan klar.",
    alternates: { v2: "Fortsæt, hvor du slap — det tager kun et minut.", v3: "Din plan venter på et par svar.", v4: "Besvar de sidste spørgsmål, så er planen din." },
  },
  "onboarding-photo": {
    title: "Dit første måltid",
    body: "Tag et foto af dit næste måltid — det er alt, der skal til for at komme i gang.",
    alternates: { v2: "Ét foto er nok til at komme i gang.", v3: "Din plan står klar. Registrér dit første måltid, når det passer dig.", v4: "Næste gang du spiser, så prøv et foto — vi klarer resten." },
  },
  "streak-risk": {
    title: "Hold den kørende",
    body: "Du har registreret et par dage i træk. Et foto i dag holder stimen i gang.",
    alternates: { v2: "Ét hurtigt foto, så tæller i dag også.", v3: "Intet registreret i dag endnu? Ét måltid, så fortsætter stimen.", v4: "Din stime lever stadig — føj i dag til med et foto." },
  },
  nudge: {
    title: "Dagens måltider",
    body: "Registrér, hvad du har spist i dag — et foto er nok.",
  },
},
  hu: {
  "trial-end": {
    title: "Holnap lejár a próbaidőszak",
    // "if you're staying" rather than "the subscription starts": a CANCELLATION leaves the expiry
    // where it was, so somebody who has already stopped it still gets this message, and telling
    // them a subscription is about to start would be false rather than merely redundant.
    body: "Holnap lejár az ingyenes próbaidőszakod. Ha maradsz, nincs teendőd; ha nem: Beállítások › Előfizetések.",
  },
  evening: {
    title: "A mai nap a tervhez képest",
    body: "Ma eddig {eaten}, a terv {plan} kcal. {tomorrow}",
    emptyBody: "Ma semmi nincs rögzítve — a terv továbbra is {plan} kcal. {tomorrow}",
  },
  // The free account's line (#730): no figures, because the figures read the day against the plan
  // and that reading is what a subscription buys.
  "onboarding-start": {
    title: "A terved majdnem kész",
    body: "Pár koppintás, és kész a terved.",
    alternates: { v2: "Folytasd ott, ahol abbahagytad — csak egy perc.", v3: "A terved már csak pár válaszra vár.", v4: "Válaszolj az utolsó kérdésekre, és a terv a tiéd." },
  },
  "onboarding-photo": {
    title: "Az első étkezésed",
    body: "Fotózd le a következő étkezésedet — ennyi kell az induláshoz.",
    alternates: { v2: "Egy fotó elég az induláshoz.", v3: "A terved kész. Rögzítsd az első étkezésedet, amikor készen állsz.", v4: "Legközelebb, amikor eszel, próbálj ki egy fotót — a többit mi intézzük." },
  },
  "streak-risk": {
    title: "Csak így tovább",
    body: "Már pár napja egymás után rögzítesz. Egy mai fotó, és megy tovább a sorozat.",
    alternates: { v2: "Egy gyors fotó, és a mai nap is számít.", v3: "Ma még semmi nincs rögzítve? Egy étkezés, és megy tovább a sorozat.", v4: "A sorozatod még él — add hozzá a mai napot egy fotóval." },
  },
  nudge: {
    title: "A mai étkezések",
    body: "Rögzítsd, mit ettél ma — egy fotó elég.",
  },
},
  el: {
  "trial-end": {
    title: "Η δωρεάν δοκιμή λήγει αύριο",
    // "if you're staying" rather than "the subscription starts": a CANCELLATION leaves the expiry
    // where it was, so somebody who has already stopped it still gets this message, and telling
    // them a subscription is about to start would be false rather than merely redundant.
    body: "Αύριο λήγει η δωρεάν δοκιμή σου. Αν μένεις, δεν χρειάζεται να κάνεις τίποτα· αν όχι, Ρυθμίσεις › Συνδρομές.",
  },
  evening: {
    title: "Η σημερινή μέρα σε σχέση με το πλάνο",
    body: "{eaten} από τις {plan} kcal σου σήμερα. {tomorrow}",
    emptyBody: "Δεν καταγράφηκε τίποτα σήμερα — οι {plan} kcal σου παραμένουν το πλάνο. {tomorrow}",
  },
  // The free account's line (#730): no figures, because the figures read the day against the plan
  // and that reading is what a subscription buys.
  "onboarding-start": {
    title: "Το πλάνο σου είναι σχεδόν έτοιμο",
    body: "Λίγα πατήματα και το πλάνο σου είναι έτοιμο.",
    alternates: { v2: "Συνέχισε από εκεί που σταμάτησες — θέλει μόνο ένα λεπτό.", v3: "Το πλάνο σου περιμένει μερικές απαντήσεις.", v4: "Απάντησε στις τελευταίες ερωτήσεις και το πλάνο είναι δικό σου." },
  },
  "onboarding-photo": {
    title: "Το πρώτο σου γεύμα",
    body: "Φωτογράφισε το επόμενο γεύμα σου — μόνο αυτό χρειάζεται για να ξεκινήσεις.",
    alternates: { v2: "Μία φωτογραφία αρκεί για να ξεκινήσεις.", v3: "Το πλάνο σου είναι έτοιμο. Κατάγραψε το πρώτο σου γεύμα όποτε θέλεις.", v4: "Την επόμενη φορά που θα φας, δοκίμασε μια φωτογραφία — τα υπόλοιπα τα αναλαμβάνουμε εμείς." },
  },
  "streak-risk": {
    title: "Συνέχισε έτσι",
    body: "Καταγράφεις μερικές μέρες στη σειρά. Μια φωτογραφία σήμερα κρατά το σερί ζωντανό.",
    alternates: { v2: "Μια γρήγορη φωτογραφία και μετράει και το σήμερα.", v3: "Δεν έχεις καταγράψει τίποτα σήμερα; Ένα γεύμα και το σερί συνεχίζεται.", v4: "Το σερί σου είναι ακόμα ζωντανό — πρόσθεσε το σήμερα με μια φωτογραφία." },
  },
  nudge: {
    title: "Τα σημερινά γεύματα",
    body: "Κατάγραψε τι έφαγες σήμερα — αρκεί μια φωτογραφία.",
  },
},
  ro: {
  "trial-end": {
    title: "Perioada de probă se încheie mâine",
    // "if you're staying" rather than "the subscription starts": a CANCELLATION leaves the expiry
    // where it was, so somebody who has already stopped it still gets this message, and telling
    // them a subscription is about to start would be false rather than merely redundant.
    body: "Mâine se încheie perioada ta de probă gratuită. Dacă rămâi, nu trebuie să faci nimic; dacă nu, Configurări › Abonamente.",
  },
  evening: {
    title: "Ziua de azi față de plan",
    body: "{eaten} din cele {plan} kcal ale tale azi. {tomorrow}",
    emptyBody: "Nimic înregistrat azi — cele {plan} kcal rămân planul. {tomorrow}",
  },
  // The free account's line (#730): no figures, because the figures read the day against the plan
  // and that reading is what a subscription buys.
  "onboarding-start": {
    title: "Planul tău e aproape gata",
    body: "Câteva atingeri și planul tău e gata.",
    alternates: { v2: "Continuă de unde ai rămas — durează doar un minut.", v3: "Planul tău așteaptă doar câteva răspunsuri.", v4: "Răspunde la ultimele întrebări și planul e al tău." },
  },
  "onboarding-photo": {
    title: "Prima ta masă",
    body: "Fotografiază următoarea masă — doar atât îți trebuie ca să începi.",
    alternates: { v2: "O fotografie e de ajuns ca să pornești.", v3: "Planul tău e gata. Înregistrează prima masă când vrei.", v4: "Data viitoare când mănânci, încearcă o fotografie — de restul ne ocupăm noi." },
  },
  "streak-risk": {
    title: "Ține-o tot așa",
    body: "Ai înregistrat câteva zile la rând. O fotografie azi continuă seria.",
    alternates: { v2: "O fotografie rapidă și ziua de azi contează și ea.", v3: "Nimic înregistrat azi? O masă și seria continuă.", v4: "Seria ta e încă în viață — adaugă ziua de azi cu o fotografie." },
  },
  nudge: {
    title: "Mesele de azi",
    body: "Înregistrează ce ai mâncat azi — o fotografie e de ajuns.",
  },
},
  cs: {
  "trial-end": {
    title: "Zkušební období zítra končí",
    // "if you're staying" rather than "the subscription starts": a CANCELLATION leaves the expiry
    // where it was, so somebody who has already stopped it still gets this message, and telling
    // them a subscription is about to start would be false rather than merely redundant.
    body: "Zítra ti končí zkušební období zdarma. Pokud zůstáváš, nic nedělej; pokud ne, Nastavení › Předplatná.",
  },
  evening: {
    title: "Dnešek v porovnání s plánem",
    body: "Dnes {eaten} z tvých {plan} kcal. {tomorrow}",
    emptyBody: "Dnes nic nezapsáno — tvých {plan} kcal platí dál. {tomorrow}",
  },
  // The free account's line (#730): no figures, because the figures read the day against the plan
  // and that reading is what a subscription buys.
  "onboarding-start": {
    title: "Tvůj plán je skoro hotový",
    body: "Pár klepnutí a plán je hotový.",
    alternates: { v2: "Navaž tam, kde se to zastavilo — zabere to jen minutku.", v3: "Tvůj plán čeká na pár odpovědí.", v4: "Dokonči poslední otázky a plán je tvůj." },
  },
  "onboarding-photo": {
    title: "Tvoje první jídlo",
    body: "Vyfoť své další jídlo — víc k začátku není potřeba.",
    alternates: { v2: "Na rozjezd stačí jedna fotka.", v3: "Plán je hotový. Zapiš první jídlo, až budeš chtít.", v4: "Až budeš příště jíst, zkus fotku — o zbytek se postaráme." },
  },
  "streak-risk": {
    title: "Nepřerušuj to",
    body: "Už pár dní v řadě máš zapsáno. Fotka dnes sérii udrží.",
    alternates: { v2: "Jedna rychlá fotka a i dnešek se počítá.", v3: "Dnes zatím nic zapsáno? Jedno jídlo a série pokračuje.", v4: "Tvoje série pořád žije — přidej dnešek fotkou." },
  },
  nudge: {
    title: "Dnešní jídla",
    body: "Zapiš dnešní jídla — stačí fotka.",
  },
},
  hi: {
  "trial-end": {
    title: "ट्रायल कल खत्म हो रहा है",
    // "if you're staying" rather than "the subscription starts": a CANCELLATION leaves the expiry
    // where it was, so somebody who has already stopped it still gets this message, and telling
    // them a subscription is about to start would be false rather than merely redundant.
    body: "कल आपका मुफ़्त ट्रायल खत्म होगा। जारी रखना है तो कुछ नहीं करना; नहीं तो सेटिंग्ज़ › सब्सक्रिप्शन।",
  },
  evening: {
    title: "आज का दिन, प्लान के मुकाबले",
    body: "आज आपके {plan} kcal में से {eaten}। {tomorrow}",
    emptyBody: "आज कुछ दर्ज नहीं हुआ — आपका प्लान अब भी {plan} kcal है। {tomorrow}",
  },
  // The free account's line (#730): no figures, because the figures read the day against the plan
  // and that reading is what a subscription buys.
  "onboarding-start": {
    title: "आपका प्लान लगभग तैयार है",
    body: "बस कुछ टैप, और आपका प्लान तैयार।",
    alternates: { v2: "जहाँ छोड़ा था वहीं से शुरू करें — बस एक मिनट लगेगा।", v3: "आपका प्लान कुछ जवाबों का इंतज़ार कर रहा है।", v4: "आख़िरी सवालों के जवाब दें, और प्लान आपका।" },
  },
  "onboarding-photo": {
    title: "आपका पहला भोजन",
    body: "अपने अगले भोजन की फ़ोटो लें — शुरू करने के लिए बस इतना ही चाहिए।",
    alternates: { v2: "शुरुआत के लिए एक फ़ोटो काफ़ी है।", v3: "आपका प्लान तैयार है। जब मन हो, अपना पहला भोजन दर्ज करें।", v4: "अगली बार खाते समय फ़ोटो लेकर देखें — बाकी हम संभाल लेंगे।" },
  },
  "streak-risk": {
    title: "स्ट्रीक जारी रखें",
    body: "कुछ दिनों से लगातार भोजन दर्ज हो रहे हैं। आज एक फ़ोटो से स्ट्रीक जारी रहेगी।",
    alternates: { v2: "एक झटपट फ़ोटो, और आज का दिन भी गिना जाएगा।", v3: "आज अभी तक कुछ दर्ज नहीं? एक भोजन, और स्ट्रीक जारी।", v4: "आपकी स्ट्रीक अभी बनी हुई है — एक फ़ोटो से आज को भी जोड़ें।" },
  },
  nudge: {
    title: "आज के भोजन",
    body: "आज आपने जो खाया उसे दर्ज करें — एक फ़ोटो काफ़ी है।",
  },
},
  th: {
  "trial-end": {
    title: "ช่วงทดลองใช้ฟรีจะสิ้นสุดพรุ่งนี้",
    // "if you're staying" rather than "the subscription starts": a CANCELLATION leaves the expiry
    // where it was, so somebody who has already stopped it still gets this message, and telling
    // them a subscription is about to start would be false rather than merely redundant.
    body: "ช่วงทดลองใช้ฟรีของคุณจะสิ้นสุดพรุ่งนี้ ถ้าจะใช้ต่อ ไม่ต้องทำอะไร ถ้าไม่ ไปที่ การตั้งค่า › การสมัครรับ",
  },
  evening: {
    title: "วันนี้เทียบกับแผน",
    body: "วันนี้ {eaten} จาก {plan} kcal ของคุณ {tomorrow}",
    emptyBody: "วันนี้ยังไม่ได้จดอะไร — {plan} kcal ของคุณยังเป็นแผนเหมือนเดิม {tomorrow}",
  },
  // The free account's line (#730): no figures, because the figures read the day against the plan
  // and that reading is what a subscription buys.
  "onboarding-start": {
    title: "แผนของคุณใกล้เสร็จแล้ว",
    body: "แตะอีกไม่กี่ครั้ง แผนของคุณก็พร้อม",
    alternates: { v2: "ทำต่อจากที่ค้างไว้ — ใช้เวลาแค่นาทีเดียว", v3: "แผนของคุณรอคำตอบอีกไม่กี่ข้อ", v4: "ตอบคำถามสุดท้ายให้ครบ แล้วแผนก็เป็นของคุณ" },
  },
  "onboarding-photo": {
    title: "มื้อแรกของคุณ",
    body: "ถ่ายรูปมื้อต่อไปของคุณ — แค่นั้นก็เริ่มได้แล้ว",
    alternates: { v2: "รูปเดียวก็เริ่มได้แล้ว", v3: "แผนของคุณพร้อมแล้ว จดมื้อแรกเมื่อคุณพร้อม", v4: "มื้อหน้าลองถ่ายรูปดู — ที่เหลือเราจัดการเอง" },
  },
  "streak-risk": {
    title: "ทำต่อไปนะ",
    body: "คุณจดต่อเนื่องมาหลายวันแล้ว รูปเดียววันนี้ก็ต่อเนื่องได้อีกวัน",
    alternates: { v2: "ถ่ายรูปสั้นๆ สักรูป แล้ววันนี้ก็นับด้วย", v3: "วันนี้ยังไม่ได้จดอะไรเลย? มื้อเดียวก็ต่อเนื่องได้แล้ว", v4: "ความต่อเนื่องของคุณยังไม่ขาด — เพิ่มวันนี้ด้วยรูปสักรูป" },
  },
  nudge: {
    title: "มื้ออาหารวันนี้",
    body: "จดสิ่งที่คุณกินวันนี้ — รูปเดียวก็พอ",
  },
},
  sv: {
  "trial-end": {
    title: "Provperioden slutar i morgon",
    // "if you're staying" rather than "the subscription starts": a CANCELLATION leaves the expiry
    // where it was, so somebody who has already stopped it still gets this message, and telling
    // them a subscription is about to start would be false rather than merely redundant.
    body: "I morgon slutar din gratis provperiod. Stannar du behöver du inte göra något; annars Inställningar › Prenumerationer.",
  },
  evening: {
    title: "Dagen jämfört med planen",
    body: "{eaten} av dina {plan} kcal i dag. {tomorrow}",
    emptyBody: "Inget loggat i dag — dina {plan} kcal är fortfarande planen. {tomorrow}",
  },
  // The free account's line (#730): no figures, because the figures read the day against the plan
  // and that reading is what a subscription buys.
  "onboarding-start": {
    title: "Din plan är nästan klar",
    body: "Några tryck till, så är din plan klar.",
    alternates: { v2: "Fortsätt där du slutade — det tar bara en minut.", v3: "Din plan väntar bara på några svar.", v4: "Svara på de sista frågorna så är planen din." },
  },
  "onboarding-photo": {
    title: "Din första måltid",
    body: "Fota din nästa måltid — mer än så krävs inte för att börja.",
    alternates: { v2: "Ett foto räcker för att komma igång.", v3: "Din plan är klar. Logga din första måltid när du vill.", v4: "Nästa gång du äter, testa ett foto — vi sköter resten." },
  },
  "streak-risk": {
    title: "Håll det igång",
    body: "Du har loggat några dagar i rad. Ett foto i dag håller sviten vid liv.",
    alternates: { v2: "Ett snabbt foto, så räknas i dag också.", v3: "Inget loggat i dag än? En måltid så fortsätter sviten.", v4: "Din svit lever fortfarande — lägg till i dag med ett foto." },
  },
  nudge: {
    title: "Dagens måltider",
    body: "Logga det du ätit i dag — ett foto räcker.",
  },
},
  uk: {
  "trial-end": {
    title: "Пробний період закінчується завтра",
    // "if you're staying" rather than "the subscription starts": a CANCELLATION leaves the expiry
    // where it was, so somebody who has already stopped it still gets this message, and telling
    // them a subscription is about to start would be false rather than merely redundant.
    body: "Завтра закінчується твій безкоштовний пробний період. Залишаєшся — нічого робити не треба; якщо ні: Параметри › Підписки.",
  },
  evening: {
    title: "День у порівнянні з планом",
    body: "{eaten} із твоїх {plan} ккал сьогодні. {tomorrow}",
    emptyBody: "Сьогодні нічого не записано — твої {plan} ккал усе ще в плані. {tomorrow}",
  },
  // The free account's line (#730): no figures, because the figures read the day against the plan
  // and that reading is what a subscription buys.
  "onboarding-start": {
    title: "Твій план майже готовий",
    body: "Кілька дотиків — і план готовий.",
    alternates: { v2: "Повернися до питань — це займе хвилину.", v3: "Твій план чекає на кілька відповідей.", v4: "Дай відповідь на останні питання — і план твій." },
  },
  "onboarding-photo": {
    title: "Твій перший прийом їжі",
    body: "Сфотографуй наступний прийом їжі — щоб почати, більше нічого не треба.",
    alternates: { v2: "Одного фото досить, щоб почати.", v3: "План готовий. Запиши перший прийом їжі, коли захочеш.", v4: "Наступного разу, коли їстимеш, спробуй фото — решту ми беремо на себе." },
  },
  "streak-risk": {
    title: "Не зупиняйся",
    body: "Записи йдуть уже кілька днів поспіль. Фото сьогодні продовжить серію.",
    alternates: { v2: "Одне швидке фото — і сьогодні теж зараховано.", v3: "Сьогодні ще нічого не записано? Один прийом їжі — і серія триває.", v4: "Серія ще жива — додай сьогоднішній день одним фото." },
  },
  nudge: {
    title: "Сьогоднішні прийоми їжі",
    body: "Запиши сьогоднішню їжу — вистачить одного фото.",
  },
},
  nl: {
  "trial-end": {
    title: "De proefperiode eindigt morgen",
    // "if you're staying" rather than "the subscription starts": a CANCELLATION leaves the expiry
    // where it was, so somebody who has already stopped it still gets this message, and telling
    // them a subscription is about to start would be false rather than merely redundant.
    body: "Morgen eindigt je gratis proefperiode. Blijf je, dan hoef je niets te doen; zo niet: Instellingen › Abonnementen.",
  },
  evening: {
    title: "Vandaag vergeleken met het plan",
    body: "{eaten} van je {plan} kcal vandaag. {tomorrow}",
    emptyBody: "Vandaag niets gelogd — je {plan} kcal zijn nog steeds het plan. {tomorrow}",
  },
  // The free account's line (#730): no figures, because the figures read the day against the plan
  // and that reading is what a subscription buys.
  "onboarding-start": {
    title: "Je plan is bijna klaar",
    body: "Een paar tikken en je plan is klaar.",
    alternates: { v2: "Ga verder waar je gebleven was — het duurt maar een minuut.", v3: "Je plan wacht nog op een paar antwoorden.", v4: "Beantwoord de laatste vragen en je plan is van jou." },
  },
  "onboarding-photo": {
    title: "Je eerste maaltijd",
    body: "Maak een foto van je volgende maaltijd — meer is er niet nodig om te beginnen.",
    alternates: { v2: "Eén foto is genoeg om te beginnen.", v3: "Je plan staat klaar. Log je eerste maaltijd wanneer je wilt.", v4: "Probeer bij je volgende maaltijd een foto — wij doen de rest." },
  },
  "streak-risk": {
    title: "Hou het vol",
    body: "Je logt al een paar dagen op rij. Een foto vandaag houdt de reeks gaande.",
    alternates: { v2: "Eén snelle foto en vandaag telt ook mee.", v3: "Vandaag nog niets gelogd? Eén maaltijd en de reeks gaat door.", v4: "Je reeks loopt nog — voeg vandaag toe met een foto." },
  },
  nudge: {
    title: "Maaltijden van vandaag",
    body: "Log wat je vandaag hebt gegeten — een foto is genoeg.",
  },
},
  pl: {
  "trial-end": {
    title: "Okres próbny kończy się jutro",
    // "if you're staying" rather than "the subscription starts": a CANCELLATION leaves the expiry
    // where it was, so somebody who has already stopped it still gets this message, and telling
    // them a subscription is about to start would be false rather than merely redundant.
    body: "Jutro kończy się twój darmowy okres próbny. Jeśli zostajesz, nic nie musisz robić; jeśli nie — Ustawienia › Subskrypcje.",
  },
  evening: {
    title: "Dzisiejszy dzień na tle planu",
    body: "{eaten} z twoich {plan} kcal dzisiaj. {tomorrow}",
    emptyBody: "Dziś nic nie zapisano — plan to nadal {plan} kcal. {tomorrow}",
  },
  // The free account's line (#730): no figures, because the figures read the day against the plan
  // and that reading is what a subscription buys.
  "onboarding-start": {
    title: "Twój plan jest prawie gotowy",
    body: "Kilka stuknięć i plan gotowy.",
    alternates: { v2: "Kontynuuj od miejsca przerwania — to zajmie tylko minutę.", v3: "Twój plan czeka na kilka odpowiedzi.", v4: "Odpowiedz na ostatnie pytania, a plan będzie twój." },
  },
  "onboarding-photo": {
    title: "Twój pierwszy posiłek",
    body: "Zrób zdjęcie następnego posiłku — tyle wystarczy, by zacząć.",
    alternates: { v2: "Jedno zdjęcie wystarczy, by ruszyć.", v3: "Plan gotowy. Zapisz pierwszy posiłek, kiedy zechcesz.", v4: "Przy następnym posiłku spróbuj zdjęcia — resztą zajmiemy się my." },
  },
  "streak-risk": {
    title: "Nie odpuszczaj",
    body: "Masz już kilka dni z rzędu. Zdjęcie dziś utrzyma serię.",
    alternates: { v2: "Jedno szybkie zdjęcie i dziś też się liczy.", v3: "Dziś jeszcze nic? Jeden posiłek i seria trwa dalej.", v4: "Twoja seria wciąż trwa — dodaj dzisiejszy dzień zdjęciem." },
  },
  nudge: {
    title: "Dzisiejsze posiłki",
    body: "Zapisz dzisiejsze posiłki — wystarczy zdjęcie.",
  },
},
  tr: {
  "trial-end": {
    title: "Deneme yarın bitiyor",
    // "if you're staying" rather than "the subscription starts": a CANCELLATION leaves the expiry
    // where it was, so somebody who has already stopped it still gets this message, and telling
    // them a subscription is about to start would be false rather than merely redundant.
    body: "Ücretsiz denemen yarın bitiyor. Devam ediyorsan bir şey yapmana gerek yok; etmiyorsan Ayarlar › Abonelikler.",
  },
  evening: {
    title: "Bugün, plana göre",
    body: "Bugün {plan} kcal'nin {eaten} kadarı. {tomorrow}",
    emptyBody: "Bugün hiçbir şey kaydedilmedi — planın hâlâ {plan} kcal. {tomorrow}",
  },
  // The free account's line (#730): no figures, because the figures read the day against the plan
  // and that reading is what a subscription buys.
  "onboarding-start": {
    title: "Planın neredeyse hazır",
    body: "Birkaç dokunuş ve planın hazır.",
    alternates: { v2: "Kaldığın yerden devam et — bir dakika sürer.", v3: "Planın birkaç yanıt bekliyor.", v4: "Son soruları bitir, plan senin." },
  },
  "onboarding-photo": {
    title: "İlk öğünün",
    body: "Bir sonraki öğününün fotoğrafını çek — başlamak için bu kadarı yeter.",
    alternates: { v2: "Başlamak için bir fotoğraf yeter.", v3: "Planın hazır. Hazır olduğunda ilk öğününü kaydet.", v4: "Bir dahaki yemeğinde fotoğraf dene — gerisini biz hallederiz." },
  },
  "streak-risk": {
    title: "Devam et",
    body: "Birkaç gündür üst üste kaydediyorsun. Bugün bir fotoğraf serini sürdürür.",
    alternates: { v2: "Hızlı bir fotoğraf, bugün de sayılsın.", v3: "Bugün henüz kayıt yok mu? Bir öğün ve seri devam eder.", v4: "Serin hâlâ sürüyor — bugünü bir fotoğrafla ekle." },
  },
  nudge: {
    title: "Bugünün öğünleri",
    body: "Bugün yediklerini kaydet — bir fotoğraf yeter.",
  },
},
  "zh-Hant": {
  "trial-end": {
    title: "試用期明天結束",
    // "if you're staying" rather than "the subscription starts": a CANCELLATION leaves the expiry
    // where it was, so somebody who has already stopped it still gets this message, and telling
    // them a subscription is about to start would be false rather than merely redundant.
    body: "你的免費試用明天結束。要繼續使用就不用做任何事；不想繼續的話，請到「設定 › 訂閱項目」。",
  },
  evening: {
    title: "今天與計畫的對照",
    body: "你今天吃了 {eaten}，計畫是 {plan} 大卡。{tomorrow}",
    emptyBody: "今天還沒有記錄，{plan} 大卡仍是你的計畫。{tomorrow}",
  },
  // The free account's line (#730): no figures, because the figures read the day against the plan
  // and that reading is what a subscription buys.
  "onboarding-start": {
    title: "你的計畫快完成了",
    body: "點幾下，你的計畫就完成了。",
    alternates: { v2: "從上次停下的地方繼續，只要一分鐘。", v3: "你的計畫只差幾個答案。", v4: "回答最後幾個問題，計畫就是你的了。" },
  },
  "onboarding-photo": {
    title: "你的第一餐",
    body: "拍下你的下一餐，開始就這麼簡單。",
    alternates: { v2: "一張照片就能開始。", v3: "你的計畫已設定好。準備好時就記錄第一餐吧。", v4: "下次吃東西時拍張照，其餘交給我們。" },
  },
  "streak-risk": {
    title: "繼續保持",
    body: "你已經連續記錄好幾天了。今天拍張照，就能延續下去。",
    alternates: { v2: "快速拍張照，今天也算數。", v3: "今天還沒記錄？記一餐就能延續下去。", v4: "你的連續紀錄還在，用一張照片補上今天吧。" },
  },
  nudge: {
    title: "今天的餐點",
    body: "記錄你今天吃了什麼，拍張照就夠了。",
  },
},
  "zh-Hans": {
  "trial-end": {
    title: "试用明天结束",
    // "if you're staying" rather than "the subscription starts": a CANCELLATION leaves the expiry
    // where it was, so somebody who has already stopped it still gets this message, and telling
    // them a subscription is about to start would be false rather than merely redundant.
    body: "你的免费试用明天结束。如果继续使用，无需任何操作；如果不想继续，请前往“设置” › “订阅”。",
  },
  evening: {
    title: "今天与计划的对比",
    body: "今天摄入{eaten}，计划{plan}千卡。{tomorrow}",
    emptyBody: "今天还没有记录——你的计划仍是{plan}千卡。{tomorrow}",
  },
  // The free account's line (#730): no figures, because the figures read the day against the plan
  // and that reading is what a subscription buys.
  "onboarding-start": {
    title: "你的计划快准备好了",
    body: "只需轻点几下，你的计划就准备好了。",
    alternates: { v2: "从上次停下的地方继续——只要一分钟。", v3: "你的计划只差几个回答了。", v4: "回答最后几个问题，计划就是你的了。" },
  },
  "onboarding-photo": {
    title: "你的第一餐",
    body: "给下一餐拍张照片——这样就开始了。",
    alternates: { v2: "一张照片就足以开始。", v3: "你的计划已设定好。准备好后，记录你的第一餐吧。", v4: "下次吃饭时试试拍张照片——剩下的交给我们。" },
  },
  "streak-risk": {
    title: "继续保持",
    body: "你已经连续记录了几天。今天拍一张照片，就能继续保持。",
    alternates: { v2: "快速拍一张，今天也算上。", v3: "今天还没记录？记一餐，连续记录就能继续。", v4: "你的连续记录还在——拍张照片把今天加上。" },
  },
  nudge: {
    title: "今天的餐食",
    body: "记录你今天吃了什么——拍张照片就够了。",
  },
},
  ko: {
  "trial-end": {
    title: "무료 체험이 내일 끝나요",
    // "if you're staying" rather than "the subscription starts": a CANCELLATION leaves the expiry
    // where it was, so somebody who has already stopped it still gets this message, and telling
    // them a subscription is about to start would be false rather than merely redundant.
    body: "내일 무료 체험이 끝나요. 계속 쓸 거라면 아무것도 안 해도 돼요. 아니라면 설정 › 구독으로 가세요.",
  },
  evening: {
    title: "오늘을 플랜과 비교해요",
    body: "오늘 {plan}kcal 중 {eaten} 섭취했어요. {tomorrow}",
    emptyBody: "오늘 기록이 없어요. 플랜은 여전히 {plan}kcal예요. {tomorrow}",
  },
  // The free account's line (#730): no figures, because the figures read the day against the plan
  // and that reading is what a subscription buys.
  "onboarding-start": {
    title: "플랜이 거의 준비됐어요",
    body: "몇 번만 탭하면 플랜이 완성돼요.",
    alternates: { v2: "멈춘 곳부터 이어서 하세요. 1분이면 돼요.", v3: "몇 가지 답변만 더 있으면 플랜이 완성돼요.", v4: "마지막 질문에 답하면 나만의 플랜이 완성돼요." },
  },
  "onboarding-photo": {
    title: "첫 식사",
    body: "다음 식사를 사진으로 찍어 보세요. 시작은 그걸로 충분해요.",
    alternates: { v2: "사진 한 장이면 시작할 수 있어요.", v3: "플랜이 준비됐어요. 준비되면 첫 식사를 기록하세요.", v4: "다음에 먹을 때 사진을 찍어 보세요. 나머지는 저희가 할게요." },
  },
  "streak-risk": {
    title: "계속 이어 가요",
    body: "며칠 연속으로 기록했어요. 오늘 사진 한 장이면 연속 기록이 이어져요.",
    alternates: { v2: "사진 한 장만 빠르게 찍으면 오늘도 기록돼요.", v3: "오늘 아직 기록이 없나요? 한 끼만 기록하면 연속 기록이 이어져요.", v4: "연속 기록이 아직 살아 있어요. 사진으로 오늘을 더해 보세요." },
  },
  nudge: {
    title: "오늘의 식사",
    body: "오늘 먹은 걸 기록하세요. 사진 한 장이면 충분해요.",
  },
},
  ja: {
  "trial-end": {
    title: "トライアルは明日で終了します",
    // "if you're staying" rather than "the subscription starts": a CANCELLATION leaves the expiry
    // where it was, so somebody who has already stopped it still gets this message, and telling
    // them a subscription is about to start would be false rather than merely redundant.
    body: "無料トライアルは明日で終わります。続ける場合は何もしなくて大丈夫です。やめる場合は 設定 › サブスクリプション へ。",
  },
  evening: {
    title: "今日の結果とプラン",
    body: "今日は{plan}kcal中{eaten}。{tomorrow}",
    emptyBody: "今日はまだ記録がありません。プランは引き続き{plan}kcalです。{tomorrow}",
  },
  // The free account's line (#730): no figures, because the figures read the day against the plan
  // and that reading is what a subscription buys.
  "onboarding-start": {
    title: "プランはもうすぐ完成です",
    body: "あと数タップでプランが完成します。",
    alternates: { v2: "続きから再開しましょう。1分で終わります。", v3: "いくつかの回答でプランが完成します。", v4: "残りの質問に答えれば、プランが完成します。" },
  },
  "onboarding-photo": {
    title: "最初の食事",
    body: "次の食事を写真に撮りましょう。始めるのはそれだけです。",
    alternates: { v2: "写真1枚で始められます。", v3: "プランの準備ができました。好きなときに最初の食事を記録しましょう。", v4: "次に食べるときは写真を撮ってみてください。あとはおまかせを。" },
  },
  "streak-risk": {
    title: "この調子で続けましょう",
    body: "数日続けて記録できています。今日も写真1枚で連続記録が続きます。",
    alternates: { v2: "写真をさっと1枚撮れば、今日もカウントされます。", v3: "今日はまだ記録なし？1食記録すれば連続記録が続きます。", v4: "連続記録はまだ続いています。写真で今日の分を追加しましょう。" },
  },
  nudge: {
    title: "今日の食事",
    body: "今日食べたものを記録しましょう。写真1枚で十分です。",
  },
},
  "pt-BR": {
  "trial-end": {
    title: "O teste termina amanhã",
    // "if you're staying" rather than "the subscription starts": a CANCELLATION leaves the expiry
    // where it was, so somebody who has already stopped it still gets this message, and telling
    // them a subscription is about to start would be false rather than merely redundant.
    body: "Amanhã seu teste grátis termina. Se você vai continuar, não precisa fazer nada; se não, Ajustes › Assinaturas.",
  },
  evening: {
    title: "Hoje em relação ao plano",
    body: "{eaten} das suas {plan} kcal hoje. {tomorrow}",
    emptyBody: "Nada registrado hoje — suas {plan} kcal continuam sendo o plano. {tomorrow}",
  },
  // The free account's line (#730): no figures, because the figures read the day against the plan
  // and that reading is what a subscription buys.
  "onboarding-start": {
    title: "Seu plano está quase pronto",
    body: "Alguns toques e seu plano fica pronto.",
    alternates: { v2: "Continue de onde parou — leva só um minuto.", v3: "Seu plano só espera algumas respostas.", v4: "Responda às últimas perguntas e o plano é seu." },
  },
  "onboarding-photo": {
    title: "Sua primeira refeição",
    body: "Tire uma foto da sua próxima refeição — é só isso para começar.",
    alternates: { v2: "Uma foto basta para começar.", v3: "Seu plano está pronto. Registre sua primeira refeição quando quiser.", v4: "Na próxima vez que comer, experimente uma foto — a gente cuida do resto." },
  },
  "streak-risk": {
    title: "Mantenha o ritmo",
    body: "Você registrou vários dias seguidos. Uma foto hoje mantém a sequência.",
    alternates: { v2: "Uma foto rápida e hoje conta também.", v3: "Nada registrado hoje ainda? Uma refeição e a sequência continua.", v4: "Sua sequência continua viva — adicione hoje com uma foto." },
  },
  nudge: {
    title: "Refeições de hoje",
    body: "Registre o que você comeu hoje — uma foto basta.",
  },
},
};

/** The compiled-in copy for one language. English for one nobody has written yet. */
export const notificationCopyFor = (lang: Lang): NotificationCopy => t(lang)(NOTIFICATION_COPY);

/**
 * What the admin has saved, per language. `Partial`, not `Localized`, for the reason
 * `OnboardingContentSet` is: a stored set is an OVERLAY on the compiled-in table, and a host whose
 * admin has only ever edited German has no English in it.
 */
export type NotificationCopySet = Partial<Record<Lang, NotificationCopy>>;

/**
 * A stored row as a SET, whatever shape it was written in.
 *
 * A row saved before #358 is a bare `NotificationCopy` — the messages at the top level — and it
 * is English, because English was all there was. Read as every language it would put an admin's
 * English on a Russian lock screen; read as none of them it would silently discard an edit that is
 * live in production today. So it is adopted for `en` and for nothing else, which is what it meant.
 *
 * Detected by a message id at the top level rather than by the absence of language keys: `ru` and
 * `evening` cannot both be right, and naming the thing we are looking FOR survives the next
 * language code better than naming everything we are not.
 */
export function storedNotificationCopy(stored: unknown): NotificationCopySet {
  if (typeof stored !== "object" || stored === null) return {};
  const raw = stored as Record<string, unknown>;
  if (NOTIFICATION_IDS.some((id) => typeof raw[id] === "object" && raw[id] !== null)) {
    return { en: stored as NotificationCopy };
  }
  return { ...(stored as NotificationCopySet) };
}

/** 20:30 in the server's zone, as R1 specifies. The reminders ride the same slot. */
export const REMINDER_TIME = { hour: 20, minute: 30 } as const;

/**
 * The reply field under the 20:30 message (ieat-app#731). The server names the category on the
 * push; the app registers it at startup with these words, so the field and its button speak the
 * account's language. What is typed there takes the chat's typed-meal path, nothing new.
 */
export const LOG_REPLY_CATEGORY = "log-reply";
export const LOG_REPLY_ACTION = "log";

export interface LogReplyCopy {
  /** The button that opens the field, and the a11y label of the action. */
  button: string;
  /** The field's send button. */
  submit: string;
  placeholder: string;
}

export const LOG_REPLY_COPY: Localized<LogReplyCopy> = {
  en: { button: "Log a meal", submit: "Log", placeholder: "What did you eat?" },
  fr: { button: "Noter un repas", submit: "Noter", placeholder: "Qu'as-tu mangé ?" },
  de: { button: "Mahlzeit eintragen", submit: "Eintragen", placeholder: "Was hast du gegessen?" },
  it: { button: "Registra un pasto", submit: "Registra", placeholder: "Cosa hai mangiato?" },
  es: { button: "Apuntar una comida", submit: "Apuntar", placeholder: "¿Qué has comido?" },
  vi: { button: "Ghi một bữa ăn", submit: "Ghi", placeholder: "Bạn đã ăn gì?" },
  id: { button: "Catat makanan", submit: "Catat", placeholder: "Kamu makan apa?" },
  ru: { button: "Записать еду", submit: "Записать", placeholder: "Что было на тарелке?" },
  te: { button: "భోజనం నమోదు చేయండి", submit: "నమోదు చేయండి", placeholder: "మీరు ఏమి తిన్నారు?" },
  ta: { button: "உணவைப் பதிவுசெய்", submit: "பதிவுசெய்", placeholder: "என்ன சாப்பிட்டீர்கள்?" },
  pa: { button: "ਖਾਣਾ ਦਰਜ ਕਰੋ", submit: "ਦਰਜ ਕਰੋ", placeholder: "ਤੁਸੀਂ ਕੀ ਖਾਧਾ?" },
  or: { button: "ଭୋଜନ ଲଗ୍ କରନ୍ତୁ", submit: "ଲଗ୍ କରନ୍ତୁ", placeholder: "ଆପଣ କ'ଣ ଖାଇଲେ?" },
  mr: { button: "जेवण नोंदवा", submit: "नोंदवा", placeholder: "तुम्ही काय खाल्ले?" },
  ml: { button: "ഭക്ഷണം രേഖപ്പെടുത്തുക", submit: "രേഖപ്പെടുത്തുക", placeholder: "നിങ്ങൾ എന്ത് കഴിച്ചു?" },
  kn: { button: "ಊಟ ದಾಖಲಿಸಿ", submit: "ದಾಖಲಿಸಿ", placeholder: "ನೀವು ಏನು ತಿಂದಿರಿ?" },
  gu: { button: "ભોજન નોંધો", submit: "નોંધો", placeholder: "તમે શું ખાધું?" },
  bn: { button: "খাবার লগ করুন", submit: "লগ করুন", placeholder: "আপনি কী খেয়েছেন?" },
  "pt-PT": { button: "Registar refeição", submit: "Registar", placeholder: "O que comeste?" },
  ms: { button: "Catat hidangan", submit: "Catat", placeholder: "Apa yang anda makan?" },
  ca: { button: "Registra un àpat", submit: "Registra", placeholder: "Què has menjat?" },
  sl: { button: "Zabeleži obrok", submit: "Zabeleži", placeholder: "Kaj je bilo na krožniku?" },
  hr: { button: "Zabilježi obrok", submit: "Zabilježi", placeholder: "Što je bilo za jelo?" },
  sk: { button: "Zapísať jedlo", submit: "Zapísať", placeholder: "Čo bolo na tanieri?" },
  no: { button: "Logg et måltid", submit: "Logg", placeholder: "Hva spiste du?" },
  fi: { button: "Kirjaa ateria", submit: "Kirjaa", placeholder: "Mitä söit?" },
  da: { button: "Registrér et måltid", submit: "Registrér", placeholder: "Hvad spiste du?" },
  hu: { button: "Étkezés rögzítése", submit: "Rögzítés", placeholder: "Mit ettél?" },
  el: { button: "Καταγραφή γεύματος", submit: "Καταγραφή", placeholder: "Τι έφαγες;" },
  ro: { button: "Înregistrează o masă", submit: "Înregistrează", placeholder: "Ce ai mâncat?" },
  cs: { button: "Zapsat jídlo", submit: "Zapsat", placeholder: "Co bylo k jídlu?" },
  hi: { button: "भोजन दर्ज करें", submit: "दर्ज करें", placeholder: "आपने क्या खाया?" },
  th: { button: "จดมื้ออาหาร", submit: "จด", placeholder: "คุณกินอะไรไป?" },
  sv: { button: "Logga en måltid", submit: "Logga", placeholder: "Vad åt du?" },
  uk: { button: "Записати їжу", submit: "Записати", placeholder: "Що було на тарілці?" },
  nl: { button: "Maaltijd loggen", submit: "Loggen", placeholder: "Wat heb je gegeten?" },
  pl: { button: "Zapisz posiłek", submit: "Zapisz", placeholder: "Co było na talerzu?" },
  tr: { button: "Öğün kaydet", submit: "Kaydet", placeholder: "Ne yedin?" },
  "zh-Hant": { button: "記錄一餐", submit: "記錄", placeholder: "你吃了什麼？" },
  "zh-Hans": { button: "记录一餐", submit: "记录", placeholder: "你吃了什么？" },
  ko: { button: "식사 기록", submit: "기록", placeholder: "무엇을 먹었나요?" },
  ja: { button: "食事を記録", submit: "記録", placeholder: "何を食べましたか？" },
  "pt-BR": { button: "Registrar refeição", submit: "Registrar", placeholder: "O que você comeu?" },
};

export const logReplyCopyFor = (lang: Lang): LogReplyCopy => t(lang)(LOG_REPLY_COPY);

/** The id the APP schedules itself. `evening` is a push and is never local. */
export type TrialReminderId = Extract<NotificationId, "trial-end">;

/** One reminder to put on the device: `date` is `YYYY-MM-DD` in the SERVER's zone. */
export interface ScheduledReminder {
  id: TrialReminderId;
  date: string;
}

/**
 * The reminders that should be on this device right now — at most one. Empty means cancel
 * everything.
 *
 * The app's ONE decision about local notifications: its scheduler cancels every id this does not
 * name and schedules every id it does. It lives here rather than in `src/mobile` for the reason
 * `aggregateDays` does — `bun test` does not reach the app, so arithmetic mixed in with
 * `expo-notifications` is untested by construction.
 *
 * Empty covers every ending a trial has: never bought, expired, converted to a real subscription,
 * or opened so late that the day is behind. The caller does not distinguish them, because there
 * is nothing different to do about any of them.
 *
 * A date already past is DROPPED rather than scheduled. iOS accepts a calendar trigger whose
 * components are behind it and then never fires it, which is the same outcome told less honestly —
 * and it leaves `getAllScheduledNotificationsAsync` claiming a reminder that cannot arrive.
 */
export function reminderPlan(
  entitlement: Entitlement,
  timezone: string,
  now: Date = new Date(),
): ScheduledReminder[] {
  const date = trialReminder(entitlement, timezone, now.getTime());
  if (date === null) return [];
  // Compared as strings, which is chronological for `YYYY-MM-DD`, and against TODAY in the SERVER's
  // zone rather than the device's — the same rule the diary and the health aggregation follow.
  //
  // THE SERVER'S ZONE IS LOAD-BEARING, AND THE OTHER END OF THE CONTRACT IS THE TRIGGER. Deciding
  // "has today's slot gone" from the server's wall clock is correct only because the app schedules
  // these as CALENDAR triggers carrying that same zone (`src/mobile/lib/notifications/expo.ts`), so
  // iOS resolves 20:30 in it too. A date trigger, or a trigger without a timezone, would resolve
  // 20:30 on the device instead, and this comparison would be wrong in both directions for anybody
  // who travels. If that trigger type ever changes, change this with it.
  const today = localDate(timezone, now);
  // TODAY counts only while today's slot is still ahead. `date >= today` alone is date granularity,
  // and an app first opened at 21:00 on the day-6 date would schedule a 20:30 trigger that iOS
  // accepts and never fires — the exact outcome this filter exists to avoid, and on that day the
  // server is silent too, so the user gets nothing at all on a day the budget says one.
  // Compared as MINUTES, not as strings, and modulo 24. `hour12: false` formats midnight as 24 in
  // some ICU versions — `zoneOffsetMs` in the backend's scheduler guards the same construction for
  // the same reason — and this is the first place `localTime`'s output is compared rather than
  // displayed. It also runs on the PHONE, under an Intl no test here exercises, so the failure
  // would be a reminder silently dropped for anyone who opened the app between midnight and 01:00
  // on that one day, once per trial, and unreproducible on a Mac.
  const [h, m] = localTime(timezone, now).split(":").map(Number) as [number, number];
  const passed = (h % 24) * 60 + m >= REMINDER_TIME.hour * 60 + REMINDER_TIME.minute;
  return date === today && passed || date < today ? [] : [{ id: "trial-end", date }];
}

/** Interpolate a message. `empty` picks the evening line's nothing-logged variant. */
export function fillNotification(
  copy: NotificationCopy,
  id: NotificationId,
  params: Record<string, string>,
  opts: { empty?: boolean } = {},
): { title: string; body: string } {
  const message = copy[id];
  const template = opts.empty && message.emptyBody ? message.emptyBody : message.body;
  return { title: fill(message.title, params), body: fill(template, params) };
}

const fill = (template: string, params: Record<string, string>): string =>
  template.replace(/\{(\w+)\}/g, (whole, key: string) => params[key] ?? whole);

export type NotificationCopyValidation =
  | { ok: true; content: NotificationCopy }
  | { ok: false; errors: string[] };

/**
 * Validate admin-supplied copy against what the composer can actually fill, and against the claims
 * rule set.
 *
 * On the WRITE, never on the read — a phone that has already been handed a broken template shows a
 * literal `{plan}` on a lock screen and no client-side tolerance recovers it. The claims gate is
 * the same one the landing page's build runs (`shared/claims.ts`): a notification is public
 * copy that arrives unasked, on the device of somebody who told us about their kidneys.
 *
 * Every error, not the first: an editor that reports one problem per save takes six saves to fix
 * six typos.
 */
export function validateNotificationCopy(input: unknown): NotificationCopyValidation {
  const errors: string[] = [];
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, errors: ["copy must be an object"] };
  }
  const raw = input as Record<string, unknown>;

  for (const key of Object.keys(raw)) {
    if (!(NOTIFICATION_IDS as readonly string[]).includes(key)) {
      errors.push(`"${key}" is not a message this product sends`);
    }
  }

  const claimFields: Record<string, string> = {};

  for (const id of NOTIFICATION_IDS) {
    const entry = raw[id];
    if (typeof entry !== "object" || entry === null) { errors.push(`${id} is required`); continue; }
    const m = entry as Record<string, unknown>;

    const fields: [string, unknown, boolean][] = [
      ["title", m.title, true],
      ["body", m.body, true],
      // The nothing-logged variant exists for the evening line and for nothing else: a reminder
      // does not depend on what was logged, so a second body there would never be reached.
      ["emptyBody", m.emptyBody, id === "evening"],
    ];

    for (const [name, value, required] of fields) {
      const at = `${id}.${name}`;
      if (value === undefined) {
        if (required) errors.push(`${at} is required`);
        continue;
      }
      if (!required) { errors.push(`${at} is not used by "${id}"`); continue; }
      if (typeof value !== "string" || value.trim() === "") { errors.push(`${at} is required`); continue; }
      const max = name === "title" ? MAX_NOTIFICATION_TITLE : MAX_NOTIFICATION_BODY;
      if (value.length > max) errors.push(`${at} is over ${max} characters`);

      const declared = NOTIFICATION_PLACEHOLDERS[at] ?? [];
      const used = new Set(Array.from(value.matchAll(/\{(\w+)\}/g), (mm) => mm[1] as string));
      for (const key of used) {
        if (!declared.includes(key)) errors.push(`${at} uses {${key}}, which nothing fills here`);
      }
      for (const key of declared) {
        if (!used.has(key)) errors.push(`${at} is missing {${key}}`);
      }
      claimFields[at] = value;
    }
  }

  for (const v of lintCopy(claimFields)) {
    errors.push(`${v.field} contains a ${v.pattern} claim: "${v.span}"`);
  }

  // ADMIN-TYPED RUSSIAN GETS THE GENDER CHECK TOO, and this is the only place it can run.
  //
  // `genderedRussian` is a build-time guard over the COMPILED-IN tables — and a stored revision
  // REPLACES those for every user, so without this the whole check was a rule about strings an
  // admin could overwrite through the editor without anything looking. It needs no `lang`: a
  // string in any other language has no Cyrillic in it and cannot match.
  for (const g of genderedRussian(raw)) {
    errors.push(`${g.at} tells a Russian reader their gender ("${g.text}") — Russian past tense`
      + " and short adjectives agree, so this greets half your readers as the wrong person");
  }

  if (errors.length > 0) return { ok: false, errors };
  // Every id is present, every field is a string of the right shape: the cast describes what the
  // loop above has just proved.
  return { ok: true, content: raw as unknown as NotificationCopy };
}

export interface EveningInput {
  targets: FoodTargets;
  totals: { kcal: number; protein_g: number };
  goal: Goal;
  /** Meals logged on the day. Zero is its own sentence, not a total of nothing. */
  meals: number;
}

/** A protein gap smaller than this is noise against an estimate, not a thing to act on. */
const PROTEIN_GAP_G = 15;
/** Under the plan by less than this is a normal day, not something to name. */
const UNDER_KCAL = 400;
/** A gain plan that fell short by less than this is on plan. */
const UNDER_KCAL_GAIN = 200;

/**
 * The retention-bearing half of the 20:30 line, as six templates rather than six sentences.
 *
 * The BRANCHING stays in `eveningPrescription` below — which lever a day gets is a claim about that
 * day's arithmetic, and a translator has no business moving it. What is here is the wording of each
 * branch once it has been chosen, which is exactly what a translator does have business with.
 *
 * `skyr` survives in the European languages, where it is on the shelf, and is adapted to Greek
 * yoghurt in Vietnamese and Indonesian, where it is not. A calqued shopping list is a prescription
 * nobody can act on, which makes it the same as no prescription at all.
 */
export const EVENING_PRESCRIPTIONS: Localized<Record<
  "noMeals" | "over" | "protein" | "gainUnder" | "under" | "onPlan", string
>> = {
  en: {
    noMeals: "One photo tomorrow puts the day back on the board.",
    over: "{over} over today — tomorrow starts at {plan} again.",
    protein: "Protein ran {gap}g short — eggs or skyr at breakfast closes it.",
    gainUnder: "{under}kcal short of the plan — a handful of nuts tomorrow covers it.",
    under: "{under} under the plan — eating the whole number tomorrow is the plan, not a slip.",
    onPlan: "On plan. Same again tomorrow.",
  },
  fr: {
    noMeals: "Demain, une seule photo suffit pour reprendre le fil.",
    over: "{over} de trop aujourd'hui — demain, on repart sur {plan}.",
    protein: "Il a manqué {gap}g de protéines — des œufs ou du skyr au petit-déjeuner suffiront à combler l'écart.",
    gainUnder: "Il manquait {under}kcal — une poignée de noix demain, et c'est réglé.",
    under: "{under} en dessous du plan — demain, manger tout ce qui est prévu, c'est le plan, pas un écart.",
    onPlan: "Pile dans le plan. On refait pareil demain.",
  },
  de: {
    noMeals: "Ein Foto morgen, und der Tag zählt wieder.",
    over: "Heute {over} über dem Plan – morgen geht's wieder bei {plan} los.",
    protein: "Beim Protein fehlten {gap}g — Eier oder Skyr zum Frühstück schließen die Lücke.",
    gainUnder: "{under}kcal unter dem Plan — eine Handvoll Nüsse morgen deckt das.",
    under: "{under} unter dem Plan – morgen die volle Menge zu essen ist kein Ausrutscher, sondern der Plan.",
    onPlan: "Im Plan. Morgen genauso.",
  },
  it: {
    noMeals: "Una foto domani rimette la giornata nel conteggio.",
    over: "Oggi {over} in più — domani si riparte da {plan}.",
    protein: "Ti sono mancati {gap}g di proteine: uova o skyr a colazione e recuperi.",
    gainUnder: "{under}kcal sotto il piano — una manciata di noci domani copre tutto.",
    under: "{under} sotto il piano — domani mangiare tutte le kcal previste è il piano, non uno sgarro.",
    onPlan: "In linea con il piano. Domani si replica.",
  },
  es: {
    noMeals: "Mañana, con una foto, el día vuelve a contar.",
    over: "{over} por encima hoy — mañana vuelve a empezar en {plan}.",
    protein: "Faltaron {gap}g de proteína — huevos o skyr en el desayuno lo cierran.",
    gainUnder: "{under}kcal por debajo del plan — un puñado de frutos secos mañana lo cubre.",
    under: "{under} por debajo del plan — mañana come todo lo que marca el plan: eso es el plan, no un exceso.",
    onPlan: "En el plan. Mañana igual.",
  },
  vi: {
    noMeals: "Mai chỉ cần một tấm ảnh là ngày của bạn lại có số liệu.",
    over: "Hôm nay vượt {over} — ngày mai lại bắt đầu từ {plan}.",
    protein: "Đạm còn thiếu {gap}g — trứng hoặc sữa chua Hy Lạp buổi sáng là đủ bù.",
    gainUnder: "Thiếu {under}kcal so với kế hoạch — ngày mai một nắm hạt là đủ.",
    under: "Thiếu {under} so với kế hoạch — ngày mai ăn trọn con số mới là kế hoạch, không phải lỡ nhịp.",
    onPlan: "Đúng kế hoạch. Ngày mai cứ vậy.",
  },
  id: {
    noMeals: "Satu foto besok, dan hari itu terhitung lagi.",
    over: "Hari ini {over} di atas rencana — besok mulai lagi dari {plan}.",
    protein: "Protein kurang {gap}g — telur atau yogurt Yunani saat sarapan menutupnya.",
    gainUnder: "Kurang {under}kcal dari rencana — segenggam kacang besok sudah cukup.",
    under: "Kurang {under} dari rencana — besok makan sesuai angka penuh memang rencananya, bukan pelanggaran.",
    onPlan: "Sesuai rencana. Besok sama lagi.",
  },
  ru: {
    noMeals: "Одно фото завтра — и день снова в счёте.",
    over: "Сегодня {over} сверху — завтра снова стартуешь с {plan}.",
    protein: "Белка не хватило {gap}г — яйца или скир на завтрак закрывают разрыв.",
    gainUnder: "{under}ккал не хватило до плана — горсть орехов завтра это покроет.",
    under: "{under} ниже плана. Съесть завтра всю цифру — это и есть план, а не срыв.",
    onPlan: "По плану. Завтра — так же.",
  },
  te: {
    noMeals: "రేపు ఒక ఫోటో, ఆ రోజు మళ్ళీ లెక్కలోకి వస్తుంది.",
    over: "ఈరోజు {over} ఎక్కువ — రేపు మళ్ళీ {plan} నుండి మొదలు.",
    protein: "ప్రోటీన్ {gap} g తక్కువైంది — అల్పాహారంలో గుడ్లు లేదా పెరుగు దాన్ని పూరిస్తాయి.",
    gainUnder: "ప్లాన్ కంటే {under} kcal తక్కువ — రేపు గుప్పెడు గింజలు దాన్ని పూరిస్తాయి.",
    under: "ప్లాన్ కంటే {under} తక్కువ — రేపు పూర్తి సంఖ్య తినడమే ప్లాన్, అది తప్పు కాదు.",
    onPlan: "ప్లాన్ ప్రకారమే. రేపు కూడా ఇలాగే.",
  },
  ta: {
    noMeals: "நாளை ஒரு புகைப்படம், அந்த நாள் மீண்டும் கணக்கில் சேரும்.",
    over: "இன்று {over} அதிகம் — நாளை மீண்டும் {plan} இலிருந்து தொடக்கம்.",
    protein: "புரதம் {gap} g குறைவு — காலை உணவில் முட்டை அல்லது தயிர் அதை ஈடுசெய்யும்.",
    gainUnder: "திட்டத்தை விட {under} kcal குறைவு — நாளை ஒரு கைப்பிடி கொட்டைகள் அதை ஈடுசெய்யும்.",
    under: "திட்டத்தை விட {under} குறைவு — நாளை முழு எண்ணையும் சாப்பிடுவதுதான் திட்டம், தவறு அல்ல.",
    onPlan: "திட்டப்படி. நாளையும் இதேபோல்.",
  },
  pa: {
    noMeals: "ਕੱਲ੍ਹ ਇੱਕ ਫ਼ੋਟੋ, ਅਤੇ ਦਿਨ ਫਿਰ ਤੋਂ ਗਿਣਤੀ ਵਿੱਚ।",
    over: "ਅੱਜ {over} ਵੱਧ — ਕੱਲ੍ਹ ਫਿਰ ਤੋਂ {plan} ਨਾਲ ਸ਼ੁਰੂਆਤ।",
    protein: "ਪ੍ਰੋਟੀਨ {gap} g ਘੱਟ ਰਿਹਾ — ਨਾਸ਼ਤੇ ਵਿੱਚ ਆਂਡੇ ਜਾਂ ਦਹੀਂ ਨਾਲ ਇਹ ਪੂਰਾ ਹੋ ਜਾਵੇਗਾ।",
    gainUnder: "ਪਲਾਨ ਤੋਂ {under} kcal ਘੱਟ — ਕੱਲ੍ਹ ਮੁੱਠੀ ਭਰ ਮੇਵਿਆਂ ਨਾਲ ਇਹ ਪੂਰਾ ਹੋ ਜਾਵੇਗਾ।",
    under: "ਪਲਾਨ ਤੋਂ {under} ਘੱਟ — ਕੱਲ੍ਹ ਪੂਰਾ ਨੰਬਰ ਖਾਣਾ ਹੀ ਪਲਾਨ ਹੈ, ਕੋਈ ਚੂਕ ਨਹੀਂ।",
    onPlan: "ਪਲਾਨ ਮੁਤਾਬਕ। ਕੱਲ੍ਹ ਵੀ ਇਸੇ ਤਰ੍ਹਾਂ।",
  },
  or: {
    noMeals: "କାଲି ଗୋଟିଏ ଫଟୋ, ଆଉ ଦିନଟି ପୁଣି ବୋର୍ଡରେ।",
    over: "ଆଜି {over} ଅଧିକ — କାଲି ପୁଣି {plan} ରୁ ଆରମ୍ଭ।",
    protein: "ପ୍ରୋଟିନ୍ {gap} g କମ୍ ରହିଲା — ଜଳଖିଆରେ ଅଣ୍ଡା କିମ୍ବା ସ୍କିର୍ ଏହାକୁ ପୂରଣ କରିବ।",
    gainUnder: "ପ୍ଲାନ୍‌ରୁ {under} kcal କମ୍ — କାଲି ମୁଠାଏ ବାଦାମ ଏହାକୁ ପୂରଣ କରିବ।",
    under: "ପ୍ଲାନ୍‌ରୁ {under} କମ୍ — କାଲି ପୂରା ସଂଖ୍ୟା ଖାଇବା ହିଁ ପ୍ଲାନ୍, ଭୁଲ୍ ନୁହେଁ।",
    onPlan: "ପ୍ଲାନ୍ ଅନୁସାରେ। କାଲି ବି ସେହିପରି।",
  },
  mr: {
    noMeals: "उद्या एक फोटो, आणि दिवस पुन्हा मोजणीत.",
    over: "आज {over} जास्त — उद्या पुन्हा {plan} पासून सुरुवात.",
    protein: "प्रोटीन {gap} g कमी पडले — नाश्त्याला अंडी किंवा दही घेतल्यास ते भरून निघेल.",
    gainUnder: "प्लॅनपेक्षा {under} kcal कमी — उद्या मूठभर सुकामेवा घेतल्यास ते भरून निघेल.",
    under: "प्लॅनपेक्षा {under} कमी — उद्या पूर्ण आकडा खाणे हाच प्लॅन आहे, चूक नव्हे.",
    onPlan: "प्लॅननुसार. उद्याही असेच.",
  },
  ml: {
    noMeals: "നാളെ ഒരു ഫോട്ടോ, ആ ദിവസം വീണ്ടും കണക്കിൽ.",
    over: "ഇന്ന് {over} കൂടുതൽ — നാളെ വീണ്ടും {plan} മുതൽ തുടങ്ങും.",
    protein: "പ്രോട്ടീൻ {gap} g കുറവായിരുന്നു — പ്രഭാതഭക്ഷണത്തിന് മുട്ടയോ സ്കീറോ കഴിച്ചാൽ അത് നികത്താം.",
    gainUnder: "പ്ലാനിനെക്കാൾ {under} kcal കുറവ് — നാളെ ഒരു പിടി നട്സ് കഴിച്ചാൽ അത് നികത്താം.",
    under: "പ്ലാനിനെക്കാൾ {under} കുറവ് — നാളെ മുഴുവൻ സംഖ്യയും കഴിക്കുന്നതാണ് പ്ലാൻ, അതൊരു വീഴ്ചയല്ല.",
    onPlan: "പ്ലാൻ പ്രകാരം. നാളെയും ഇതുപോലെ.",
  },
  kn: {
    noMeals: "ನಾಳೆ ಒಂದು ಫೋಟೋ, ದಿನ ಮತ್ತೆ ಲೆಕ್ಕಕ್ಕೆ ಬರುತ್ತದೆ.",
    over: "ಇಂದು {over} ಹೆಚ್ಚು — ನಾಳೆ ಮತ್ತೆ ಪೂರ್ಣ {plan} ಸಿಗುತ್ತದೆ.",
    protein: "ಪ್ರೋಟೀನ್ {gap} g ಕಡಿಮೆ ಆಯಿತು — ಬೆಳಗಿನ ಉಪಾಹಾರದಲ್ಲಿ ಮೊಟ್ಟೆ ಅಥವಾ ಮೊಸರು ಅದನ್ನು ತುಂಬುತ್ತದೆ.",
    gainUnder: "ಪ್ಲಾನ್‌ಗಿಂತ {under} kcal ಕಡಿಮೆ — ನಾಳೆ ಒಂದು ಹಿಡಿ ಬೀಜಗಳು ಅದನ್ನು ತುಂಬುತ್ತವೆ.",
    under: "ಪ್ಲಾನ್‌ಗಿಂತ {under} ಕಡಿಮೆ — ನಾಳೆ ಪೂರ್ಣ ಸಂಖ್ಯೆಯಷ್ಟು ತಿನ್ನುವುದೇ ಪ್ಲಾನ್, ತಪ್ಪಲ್ಲ.",
    onPlan: "ಪ್ಲಾನ್‌ಗೆ ತಕ್ಕಂತೆ. ನಾಳೆಯೂ ಹಾಗೆಯೇ.",
  },
  gu: {
    noMeals: "કાલે એક ફોટો, અને દિવસ ફરી ગણતરીમાં.",
    over: "આજે {over} વધુ — કાલે ફરી {plan} થી શરૂઆત.",
    protein: "પ્રોટીન {gap} g ઓછું રહ્યું — નાસ્તામાં ઈંડાં કે દહીંથી તે પૂરું થઈ જશે.",
    gainUnder: "પ્લાન કરતાં {under} kcal ઓછું — કાલે મુઠ્ઠીભર સૂકો મેવો તે પૂરું કરી દેશે.",
    under: "પ્લાન કરતાં {under} ઓછું — કાલે પૂરો આંકડો ખાવો એ જ પ્લાન છે, કોઈ ચૂક નહીં.",
    onPlan: "પ્લાન મુજબ. કાલે પણ આવું જ.",
  },
  bn: {
    noMeals: "কাল একটা ছবি দিলেই দিনটা আবার হিসাবে ফিরবে।",
    over: "আজ {over} বেশি — কাল আবার {plan} থেকে শুরু।",
    protein: "প্রোটিন {gap} g কম ছিল — সকালের নাশতায় ডিম বা দই খেলে তা পূরণ হবে।",
    gainUnder: "প্ল্যানের চেয়ে {under} kcal কম — কাল এক মুঠো বাদাম খেলেই তা পূরণ হবে।",
    under: "প্ল্যানের চেয়ে {under} কম — কাল পুরো সংখ্যাটা খাওয়াই প্ল্যান, কোনো ভুল নয়।",
    onPlan: "প্ল্যান অনুযায়ী। কালও একই রকম।",
  },
  "pt-PT": {
    noMeals: "Amanhã, uma foto volta a pôr o dia no registo.",
    over: "{over} acima hoje — amanhã começa de novo em {plan}.",
    protein: "Faltaram {gap} g de proteína — ovos ou skyr ao pequeno-almoço resolvem.",
    gainUnder: "{under} kcal abaixo do plano — um punhado de frutos secos amanhã resolve.",
    under: "{under} abaixo do plano — comer o número inteiro amanhã é o plano, não um deslize.",
    onPlan: "Dentro do plano. Repete amanhã.",
  },
  ms: {
    noMeals: "Satu foto esok dan hari itu dikira semula.",
    over: "{over} terlebih hari ini — esok bermula semula pada {plan}.",
    protein: "Protein kurang {gap} g — telur atau skyr ketika sarapan boleh mencukupkannya.",
    gainUnder: "{under} kcal kurang daripada pelan — segenggam kacang esok menampungnya.",
    under: "{under} di bawah pelan — makan jumlah penuh esok ialah pelannya, bukan kesilapan.",
    onPlan: "Ikut pelan. Sama lagi esok.",
  },
  ca: {
    noMeals: "Demà, amb una sola foto el dia torna a comptar.",
    over: "{over} de més avui — demà tornes a començar amb {plan}.",
    protein: "Han faltat {gap} g de proteïna — uns ous o skyr a l'esmorzar ho compensen.",
    gainUnder: "Han faltat {under} kcal per al pla — un grapat de fruits secs demà ho cobreix.",
    under: "{under} per sota del pla — demà, menjar tot el que toca és el pla, no un error.",
    onPlan: "Dins del pla. Demà, igual.",
  },
  sl: {
    noMeals: "Ena fotografija jutri in dan spet šteje.",
    over: "Danes {over} nad načrtom — jutri spet začneš pri {plan}.",
    protein: "Beljakovin je zmanjkalo za {gap} g — jajca ali skyr za zajtrk to zapolnijo.",
    gainUnder: "Do načrta je manjkalo {under} kcal — pest oreščkov jutri to pokrije.",
    under: "{under} pod načrtom — če jutri poješ celotno številko, je to načrt, ne spodrsljaj.",
    onPlan: "Po načrtu. Jutri enako.",
  },
  hr: {
    noMeals: "Jedna fotografija sutra i dan se opet računa.",
    over: "Danas {over} preko — sutra opet kreće od {plan}.",
    protein: "Nedostajalo je {gap} g proteina — jaja ili skyr za doručak pokrivaju razliku.",
    gainUnder: "{under} kcal manje od plana — šaka orašastih plodova sutra to pokriva.",
    under: "{under} ispod plana — sutra pojedi cijeli iznos: to je plan, a ne posrtaj.",
    onPlan: "U planu. Sutra isto.",
  },
  sk: {
    noMeals: "Jedna fotka zajtra a deň je znova v hre.",
    over: "Dnes {over} nad plánom — zajtra sa znova začína na {plan}.",
    protein: "Bielkovín chýbalo {gap} g — vajcia alebo skyr na raňajky to doplnia.",
    gainUnder: "Do plánu chýbalo {under} kcal — hrsť orieškov zajtra to pokryje.",
    under: "Dnes {under} pod plánom — zjesť zajtra celé číslo je plán, nie zakopnutie.",
    onPlan: "Podľa plánu. Zajtra znova tak.",
  },
  no: {
    noMeals: "Ett bilde i morgen, så teller dagen igjen.",
    over: "{over} over i dag — i morgen begynner du på {plan} igjen.",
    protein: "Proteinet var {gap} g for lite — egg eller skyr til frokost tetter gapet.",
    gainUnder: "{under} kcal under planen — en neve nøtter i morgen dekker det.",
    under: "{under} under planen — å spise hele tallet i morgen er planen, ikke en glipp.",
    onPlan: "Innenfor planen. Likedan i morgen.",
  },
  fi: {
    noMeals: "Yksi kuva huomenna, niin päivä lasketaan taas.",
    over: "Tänään {over} yli – huomenna lähtökohta on taas {plan}.",
    protein: "Proteiinia jäi {gap} g vajaaksi – kananmunat tai rahka aamiaisella paikkaavat sen.",
    gainUnder: "{under} kcal suunnitelmasta jäi syömättä – kourallinen pähkinöitä huomenna paikkaa sen.",
    under: "{under} alle suunnitelman – koko määrän syöminen huomenna on suunnitelma, ei lipsahdus.",
    onPlan: "Suunnitelman mukaan. Samoin huomenna.",
  },
  da: {
    noMeals: "Ét foto i morgen, så tæller dagen igen.",
    over: "{over} over i dag — i morgen starter vi på {plan} igen.",
    protein: "Protein manglede {gap} g — æg eller skyr til morgenmad lukker hullet.",
    gainUnder: "{under} kcal under planen — en håndfuld nødder i morgen dækker det.",
    under: "{under} under planen — at spise hele tallet i morgen er planen, ikke et fejltrin.",
    onPlan: "Inden for planen. Det samme igen i morgen.",
  },
  hu: {
    noMeals: "Egy fotó holnap, és a nap újra számít.",
    over: "Ma {over} túllépés — holnap újra {plan} a kiindulás.",
    protein: "{gap} g fehérje hiányzott — tojás vagy skyr reggelire pótolja.",
    gainUnder: "{under} kcal hiányzott a tervhez — holnap egy marék dió pótolja.",
    under: "{under} a terv alatt — holnap a teljes mennyiséget megenni maga a terv, nem botlás.",
    onPlan: "A terv szerint. Holnap ugyanígy.",
  },
  el: {
    noMeals: "Μια φωτογραφία αύριο και η μέρα μετράει ξανά.",
    over: "{over} πάνω σήμερα — αύριο ξεκινάς ξανά με {plan}.",
    protein: "Έλειψαν {gap} g πρωτεΐνης — αυγά ή skyr στο πρωινό καλύπτουν τη διαφορά.",
    gainUnder: "{under} kcal κάτω από το πλάνο — μια χούφτα ξηροί καρποί αύριο το καλύπτουν.",
    under: "{under} κάτω από το πλάνο — αύριο τρως όλο το νούμερο: αυτό είναι το πλάνο, όχι στραβοπάτημα.",
    onPlan: "Εντός πλάνου. Αύριο πάλι τα ίδια.",
  },
  ro: {
    noMeals: "O fotografie mâine și ziua contează din nou.",
    over: "{over} peste azi — mâine începi din nou de la {plan}.",
    protein: "Proteinele au fost cu {gap} g sub țintă — ouă sau skyr la micul dejun acoperă diferența.",
    gainUnder: "Cu {under} kcal sub plan — o mână de nuci mâine acoperă diferența.",
    under: "{under} sub plan — să mănânci mâine tot numărul e planul, nu o abatere.",
    onPlan: "Conform planului. La fel și mâine.",
  },
  cs: {
    noMeals: "Zítra stačí jedna fotka a den se zase počítá.",
    over: "Dnes {over} nad plánem — zítra se začíná znovu od {plan}.",
    protein: "Bílkovin chybělo {gap} g — vejce nebo skyr ke snídani to doženou.",
    gainUnder: "Do plánu chybělo {under} kcal — hrst ořechů zítra to pokryje.",
    under: "{under} pod plánem — sníst zítra celé číslo je plán, ne zakopnutí.",
    onPlan: "Podle plánu. Zítra zase tak.",
  },
  hi: {
    noMeals: "कल एक फ़ोटो, और दिन फिर से गिनती में।",
    over: "आज {over} ज़्यादा — कल फिर से {plan} से शुरुआत।",
    protein: "प्रोटीन {gap} g कम रहा — नाश्ते में अंडे या दही से यह पूरा हो जाएगा।",
    gainUnder: "प्लान से {under} kcal कम — कल मुट्ठी भर मेवे से यह पूरा हो जाएगा।",
    under: "प्लान से {under} कम — कल पूरा नंबर खाना ही प्लान है, कोई चूक नहीं।",
    onPlan: "प्लान के मुताबिक। कल भी ऐसा ही।",
  },
  th: {
    noMeals: "รูปเดียวพรุ่งนี้ วันนั้นก็กลับมานับอีกครั้ง",
    over: "วันนี้เกิน {over} — พรุ่งนี้เริ่มที่ {plan} ใหม่",
    protein: "โปรตีนขาดไป {gap} ก. — ไข่หรือสกีร์ตอนเช้าช่วยเติมได้",
    gainUnder: "ยังขาดอีก {under} kcal จากแผน — ถั่วสักกำมือพรุ่งนี้ก็พอ",
    under: "ต่ำกว่าแผน {under} — พรุ่งนี้กินให้ครบตามตัวเลขคือแผน ไม่ใช่การพลาด",
    onPlan: "ตรงตามแผน พรุ่งนี้ทำแบบเดิมอีกนะ",
  },
  sv: {
    noMeals: "Ett foto i morgon, så räknas dagen igen.",
    over: "{over} över i dag — i morgon börjar det om på {plan}.",
    protein: "Proteinet hamnade {gap} g under — ägg eller skyr till frukost fyller luckan.",
    gainUnder: "{under} kcal under planen — en näve nötter i morgon täcker det.",
    under: "{under} under planen — att äta hela siffran i morgon är planen, inte ett snedsteg.",
    onPlan: "Enligt planen. Samma igen i morgon.",
  },
  uk: {
    noMeals: "Одне фото завтра — і день знову в рахунку.",
    over: "Сьогодні {over} понад план — завтра знову починаєш із {plan}.",
    protein: "Білка забракло {gap} г — яйця чи скир на сніданок це закриють.",
    gainUnder: "До плану забракло {under} ккал — жменя горіхів завтра це покриє.",
    under: "{under} нижче плану. З'їсти завтра всю цифру — це і є план, а не зрив.",
    onPlan: "За планом. Завтра — так само.",
  },
  nl: {
    noMeals: "Eén foto morgen en de dag telt weer mee.",
    over: "Vandaag {over} erover — morgen begint weer bij {plan}.",
    protein: "Eiwit kwam {gap} g tekort — eieren of skyr bij het ontbijt vullen dat aan.",
    gainUnder: "{under} kcal onder het plan — een handje noten morgen vult dat aan.",
    under: "{under} onder het plan — morgen het volledige aantal eten is het plan, geen misstap.",
    onPlan: "Volgens plan. Morgen hetzelfde.",
  },
  pl: {
    noMeals: "Jedno zdjęcie jutro i dzień znów się liczy.",
    over: "Dziś {over} ponad plan — jutro znów zaczynasz od {plan}.",
    protein: "Białka zabrakło {gap} g — jajka lub skyr na śniadanie uzupełnią lukę.",
    gainUnder: "{under} kcal poniżej planu — jutro garść orzechów to pokryje.",
    under: "{under} poniżej planu — zjedzenie jutro pełnej liczby to plan, a nie wpadka.",
    onPlan: "Zgodnie z planem. Jutro tak samo.",
  },
  tr: {
    noMeals: "Yarın bir fotoğraf, günü yeniden tabloya koyar.",
    over: "Bugün {over} fazla — yarın yine {plan} ile başlıyor.",
    protein: "Protein {gap} g eksik kaldı — kahvaltıda yumurta ya da skyr bunu kapatır.",
    gainUnder: "Plana {under} kcal eksik — yarın bir avuç kuruyemiş bunu karşılar.",
    under: "Planın {under} altında — yarın sayının tamamını yemek plan, kaçamak değil.",
    onPlan: "Plana uygun. Yarın da aynısı.",
  },
  "zh-Hant": {
    noMeals: "明天拍一張照片，這一天就重新算進去了。",
    over: "今天超過 {over}，明天又從 {plan} 重新開始。",
    protein: "蛋白質少了 {gap} 公克，早餐吃蛋或優格就能補上。",
    gainUnder: "比計畫少 {under} 大卡，明天吃一把堅果就補上了。",
    under: "比計畫少 {under}。明天吃足計畫的量是照計畫走，不是失誤。",
    onPlan: "符合計畫。明天照樣。",
  },
  "zh-Hans": {
    noMeals: "明天拍一张照片，就能重新开始记录。",
    over: "今天超出{over}——明天重新从{plan}开始。",
    protein: "蛋白质少了{gap}克——早餐吃鸡蛋或冰岛酸奶就能补上。",
    gainUnder: "比计划少了{under}千卡——明天一把坚果就能补上。",
    under: "比计划少了{under}——明天吃满这个数字就是计划本身，不算失误。",
    onPlan: "符合计划。明天照旧。",
  },
  ko: {
    noMeals: "내일 사진 한 장이면 다시 기록이 이어져요.",
    over: "오늘 {over} 초과 — 내일은 다시 {plan}부터 시작해요.",
    protein: "단백질이 {gap}g 부족했어요 — 아침에 달걀이나 스키르를 먹으면 채워져요.",
    gainUnder: "플랜보다 {under}kcal 적어요 — 내일 견과류 한 줌이면 채울 수 있어요.",
    under: "플랜보다 {under} 적어요 — 내일 목표만큼 다 먹는 건 실수가 아니라 플랜대로예요.",
    onPlan: "플랜대로예요. 내일도 똑같이 가요.",
  },
  ja: {
    noMeals: "明日写真を1枚撮れば、また記録に戻れます。",
    over: "今日は{over}オーバー。明日はまた{plan}から始まります。",
    protein: "タンパク質が{gap}g不足。朝食に卵やスキールを足せば埋まります。",
    gainUnder: "プランまで{under}kcal不足。明日ナッツをひとつかみ足せば補えます。",
    under: "プランより{under}少なめ。明日しっかり全部食べるのはプランどおりで、失敗ではありません。",
    onPlan: "プランどおりです。明日も同じ調子で。",
  },
  "pt-BR": {
    noMeals: "Amanhã, uma foto já coloca o dia de volta no registro.",
    over: "{over} acima hoje — amanhã começa de novo em {plan}.",
    protein: "Faltaram {gap} g de proteína — ovos ou skyr no café da manhã resolvem.",
    gainUnder: "{under} kcal abaixo do plano — um punhado de castanhas amanhã resolve.",
    under: "{under} abaixo do plano — comer o número inteiro amanhã é o plano, não um deslize.",
    onPlan: "Dentro do plano. Repita amanhã.",
  },
};

export interface EveningInput {
  targets: FoodTargets;
  totals: { kcal: number; protein_g: number };
  goal: Goal;
  /** Meals logged on the day. Zero is its own sentence, not a total of nothing. */
  meals: number;
}

/**
 * The retention-bearing half of the 20:30 line: ONE concrete thing for tomorrow.
 *
 * R1 is explicit that totals alone are a diary — the prescription is what makes the message worth
 * receiving. Deterministic, like `firstVerdictLines`: the model is never asked for it, so it cannot
 * invent a number, and it is compiled in rather than admin-editable for the same reason the
 * onboarding QUESTIONS are, since each branch is a claim about the user's own day.
 *
 * One sentence, one lever, in priority order. A message that names three things is a message that
 * names none. THE ORDER IS NOT TRANSLATABLE and is why the branching stayed here while the wording
 * moved into `EVENING_PRESCRIPTIONS`.
 */
export function eveningPrescription(i: EveningInput, lang: Lang): string {
  const say = t(lang)(EVENING_PRESCRIPTIONS);
  const n = wholeNumbers(lang);
  const kn = kcalNumbers(lang);
  if (i.meals === 0) return say.noMeals;

  const overBy = i.totals.kcal - i.targets.kcal;
  if (i.goal !== "gain" && overBy > 0) {
    return fill(say.over, { over: kn(overBy), plan: kn(i.targets.kcal) });
  }

  const proteinGap = i.targets.protein_g - i.totals.protein_g;
  if (proteinGap >= PROTEIN_GAP_G) return fill(say.protein, { gap: n(proteinGap) });

  const underBy = -overBy;
  if (i.goal === "gain" && underBy >= UNDER_KCAL_GAIN) return fill(say.gainUnder, { under: kn(underBy) });
  if (i.goal !== "gain" && underBy >= UNDER_KCAL) return fill(say.under, { under: kn(underBy) });

  return say.onPlan;
}
