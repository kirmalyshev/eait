// The two messages this product is allowed to send, and the arithmetic that decides which.
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
