// The three messages this product is allowed to send, and the arithmetic that decides which.
//
// copy.md § Step 15 promises exactly three: "I'll remind you on day five and the day before it
// ends, never the day after", and "At 20:30 you get one line — today against the plan, and one
// concrete thing for tomorrow." Nothing else may be sent, and R1's budget
// (`marketing/specs/2026-07-22-retention-plan.md` § 5) is one outbound message a day INCLUDING the
// two reminders — which is what `dailyMessage` is: a reminder day emits the reminder INSTEAD OF the
// evening line, never as well as it.
//
// It lives in shared because both sides need the same answers. The phone schedules the two trial
// reminders LOCALLY, off `entitlement.expiresAt`, so it can fire them with no network and cancel
// them the moment the server says the trial converted; the server composes and pushes the 20:30
// line, because a local notification cannot carry a sentence about a day it has not seen. Two
// implementations of "which day is day five" would drift silently, and the symptom would be a
// reminder on the day after — the one thing the copy promises never happens.
//
// The WORDS are admin-editable and the SHAPE is not, the same split onboarding content makes:
// `validateNotificationCopy` runs on the WRITE, so a placeholder the composer cannot fill or a
// health claim never reaches a lock screen.

import { lintCopy } from "./claims.ts";
import { dateMinus, localDate, localTime } from "./dates.ts";
import type { Entitlement } from "./entitlement.ts";
import { numbers, t, type Localized } from "./lang.ts";
import type { FoodTargets, Goal, Lang } from "./types.ts";

/** Every message that may be sent. Adding one is a product decision, not a copy edit. */
export const NOTIFICATION_IDS = ["trial-day5", "trial-day6", "evening"] as const;
export type NotificationId = (typeof NOTIFICATION_IDS)[number];

export interface NotificationMessage {
  title: string;
  body: string;
  /**
   * `evening` only: the body for a day with nothing logged.
   *
   * A separate string rather than a clever substitution, because "0 of your 2,100 kcal today" is
   * an accusation and the recovery framing R1 asks for is a different sentence, not a smaller
   * number. It cannot carry `{eaten}` — there is nothing eaten — and the validator says so.
   */
  emptyBody?: string;
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
  "trial-day5.title": [], "trial-day5.body": [],
  "trial-day6.title": [], "trial-day6.body": [],
  "evening.title": [], "evening.body": ["eaten", "plan", "tomorrow"],
  "evening.emptyBody": ["plan", "tomorrow"],
};

/** iOS truncates well before these; they are a bound on abuse, not a design guide. */
export const MAX_NOTIFICATION_TITLE = 60;
export const MAX_NOTIFICATION_BODY = 240;

/**
 * The shipped words.
 *
 * The two reminders say what happens and how to stop it, and nothing else: no countdown, no
 * "you'll lose your progress", no second pitch. Step 15's rules for the sheet apply to the
 * messages that follow from it — the trial was sold once, and a reminder that sells it again is
 * the reason people turn notifications off.
 */
export const DEFAULT_NOTIFICATION_COPY: NotificationCopy = {
  "trial-day5": {
    title: "Two days left",
    body: "Two days before the free week ends. Nothing to do if you're staying — if not, Settings › Subscriptions, and you pay nothing.",
  },
  "trial-day6": {
    title: "The trial ends tomorrow",
    // "if you're staying" rather than "the subscription starts": a CANCELLATION leaves the expiry
    // where it was, so somebody who has already stopped it still gets this message, and telling
    // them a subscription is about to start would be false rather than merely redundant.
    body: "Tomorrow the free week ends. If you're staying, nothing to do; if not, Settings › Subscriptions.",
  },
  evening: {
    title: "Today against the plan",
    body: "{eaten} of your {plan} kcal today. {tomorrow}",
    emptyBody: "Nothing logged today — your {plan} kcal are still the plan. {tomorrow}",
  },
};

/**
 * The three messages in every language, and the stored row's shape.
 *
 * `en` IS `DEFAULT_NOTIFICATION_COPY` itself, so the admin's reset, the merge in `engine/notify.ts`
 * and every test go on looking in the one place they already look.
 */
export const NOTIFICATION_COPY: Localized<NotificationCopy> = {
  en: DEFAULT_NOTIFICATION_COPY,
  fr: {
    "trial-day5": {
      title: "Encore deux jours",
      body: "Encore deux jours avant la fin de la semaine gratuite. Rien à faire si tu restes — sinon : Réglages › Abonnements, et tu ne paies rien.",
    },
    "trial-day6": {
      title: "L'essai se termine demain",
      body: "Demain, la semaine gratuite se termine. Si tu restes, rien à faire ; sinon : Réglages › Abonnements.",
    },
    evening: {
      title: "Aujourd'hui face au plan",
      body: "{eaten} de tes {plan} kcal aujourd'hui. {tomorrow}",
      emptyBody: "Rien d'enregistré aujourd'hui — tes {plan} kcal restent le plan. {tomorrow}",
    },
  },
  de: {
    "trial-day5": {
      title: "Noch zwei Tage",
      body: "Noch zwei Tage, bis die Gratiswoche endet. Wenn du bleibst, musst du nichts tun — wenn nicht: Einstellungen › Abos, und du zahlst nichts.",
    },
    "trial-day6": {
      title: "Die Testwoche endet morgen",
      body: "Morgen endet die Gratiswoche. Wenn du bleibst, musst du nichts tun; wenn nicht: Einstellungen › Abos.",
    },
    evening: {
      title: "Heute gegen den Plan",
      body: "{eaten} von deinen {plan} kcal heute. {tomorrow}",
      emptyBody: "Heute nichts eingetragen — deine {plan} kcal sind trotzdem der Plan. {tomorrow}",
    },
  },
  it: {
    "trial-day5": {
      title: "Ancora due giorni",
      body: "Due giorni alla fine della settimana gratis. Se resti non devi fare nulla — altrimenti: Impostazioni › Abbonamenti, e non paghi niente.",
    },
    "trial-day6": {
      title: "La prova finisce domani",
      body: "Domani finisce la settimana gratis. Se resti non devi fare nulla; altrimenti: Impostazioni › Abbonamenti.",
    },
    evening: {
      title: "Oggi rispetto al piano",
      body: "{eaten} delle tue {plan} kcal oggi. {tomorrow}",
      emptyBody: "Oggi niente registrato — le tue {plan} kcal restano il piano. {tomorrow}",
    },
  },
  es: {
    "trial-day5": {
      title: "Quedan dos días",
      body: "Dos días antes de que acabe la semana gratis. Si te quedas, nada que hacer — si no: Ajustes › Suscripciones, y no pagas nada.",
    },
    "trial-day6": {
      title: "La prueba termina mañana",
      body: "Mañana acaba la semana gratis. Si te quedas, nada que hacer; si no: Ajustes › Suscripciones.",
    },
    evening: {
      title: "Hoy frente al plan",
      body: "{eaten} de tus {plan} kcal hoy. {tomorrow}",
      emptyBody: "Hoy sin registros — tus {plan} kcal siguen siendo el plan. {tomorrow}",
    },
  },
  vi: {
    "trial-day5": {
      title: "Còn hai ngày",
      body: "Còn hai ngày nữa là hết tuần miễn phí. Ở lại thì không cần làm gì — nếu không: Cài đặt › Gói đăng ký, và bạn không mất đồng nào.",
    },
    "trial-day6": {
      title: "Bản dùng thử kết thúc ngày mai",
      body: "Ngày mai tuần miễn phí kết thúc. Ở lại thì không cần làm gì; nếu không: Cài đặt › Gói đăng ký.",
    },
    evening: {
      title: "Hôm nay so với kế hoạch",
      body: "{eaten} trên {plan} kcal hôm nay. {tomorrow}",
      emptyBody: "Hôm nay chưa ghi gì — {plan} kcal của bạn vẫn là kế hoạch. {tomorrow}",
    },
  },
  id: {
    "trial-day5": {
      title: "Tinggal dua hari",
      body: "Dua hari lagi minggu gratisnya habis. Kalau lanjut, tidak perlu apa-apa — kalau tidak: Pengaturan › Langganan, dan kamu tidak membayar apa pun.",
    },
    "trial-day6": {
      title: "Masa coba berakhir besok",
      body: "Besok minggu gratisnya habis. Kalau lanjut, tidak perlu apa-apa; kalau tidak: Pengaturan › Langganan.",
    },
    evening: {
      title: "Hari ini dibanding rencana",
      body: "{eaten} dari {plan} kcal hari ini. {tomorrow}",
      emptyBody: "Hari ini belum ada catatan — {plan} kcal-mu tetap rencananya. {tomorrow}",
    },
  },
  ru: {
    "trial-day5": {
      title: "Осталось два дня",
      body: "Через два дня бесплатная неделя закончится. Остаёшься — делать ничего не нужно. Если нет: Настройки › Подписки, и ты ничего не платишь.",
    },
    "trial-day6": {
      title: "Пробная неделя кончается завтра",
      body: "Завтра бесплатная неделя заканчивается. Остаёшься — делать ничего не нужно; если нет: Настройки › Подписки.",
    },
    evening: {
      title: "Сегодня против плана",
      body: "{eaten} из твоих {plan} ккал сегодня. {tomorrow}",
      emptyBody: "Сегодня ничего не записано — твои {plan} ккал всё ещё план. {tomorrow}",
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
 * A row saved before #358 is a bare `NotificationCopy` — three messages at the top level — and it
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
 * The two days a trial gets a reminder, as `YYYY-MM-DD` in `tz`.
 *
 * Derived from the EXPIRY rather than from the start, because the expiry is what the app is told
 * (`ProfileResponse.entitlement.expiresAt`) and what the store can move — a billing retry extends
 * it, and a reminder counted forwards from a purchase date would then fire in the middle of a
 * trial that is still running. Day 5 is two days before the expiry date, day 6 the day before it;
 * neither is ever on or after the expiry, which is the "never the day after" promise.
 *
 * Null when there is no expiry, when it does not parse, or when it has already passed — all three
 * mean there is nothing to remind anybody about.
 */
export function trialReminderDates(
  expiresAt: string | null | undefined,
  tz: string,
  now: number = Date.now(),
): { day5: string; day6: string } | null {
  if (!expiresAt) return null;
  const at = Date.parse(expiresAt);
  if (!Number.isFinite(at) || at <= now) return null;
  const expiryDate = localDate(tz, new Date(at));
  return { day5: dateMinus(expiryDate, 2), day6: dateMinus(expiryDate, 1) };
}

/**
 * The two reminder dates of a live TRIAL, or null when this entitlement is not one.
 *
 * The gate `trialReminderDates` does not have, and the reason both sides call this rather than
 * that: the raw arithmetic answers "two days before the expiry" for ANY expiry, and two days
 * before a yearly renewal has exactly that shape. `entitlement.trial` is the only thing that
 * separates them, and it comes from the store by way of the RevenueCat webhook — no duration
 * heuristic can, because it is looking at the same two days either way.
 */
export function trialReminders(
  entitlement: Entitlement,
  timezone: string,
  now: number = Date.now(),
): { day5: string; day6: string } | null {
  if (!entitlement.active || !entitlement.trial) return null;
  return trialReminderDates(entitlement.expiresAt, timezone, now);
}

/** The two ids the APP schedules itself. `evening` is a push and is never local. */
export type TrialReminderId = Extract<NotificationId, "trial-day5" | "trial-day6">;

/** One reminder to put on the device: `date` is `YYYY-MM-DD` in the SERVER's zone. */
export interface ScheduledReminder {
  id: TrialReminderId;
  date: string;
}

/**
 * The reminders that should be on this device right now, in order. Empty means cancel everything.
 *
 * The app's ONE decision about local notifications: its scheduler cancels every id this does not
 * name and schedules every id it does. It lives here rather than in `src/mobile` for the reason
 * `aggregateDays` does — `bun test` does not reach the app, so arithmetic mixed in with
 * `expo-notifications` is untested by construction.
 *
 * Empty covers every ending a trial has: never bought, expired, converted to a real subscription,
 * or opened so late that both days are behind. The caller does not distinguish them, because there
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
  const dates = trialReminders(entitlement, timezone, now.getTime());
  if (!dates) return [];
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
  // on one of the two days, once per trial, and unreproducible on a Mac.
  const [h, m] = localTime(timezone, now).split(":").map(Number) as [number, number];
  const passed = (h % 24) * 60 + m >= REMINDER_TIME.hour * 60 + REMINDER_TIME.minute;
  return ([
    { id: "trial-day5", date: dates.day5 },
    { id: "trial-day6", date: dates.day6 },
  ] as const).filter((r) => (r.date === today ? !passed : r.date > today));
}

/**
 * The ONE message `date` gets. R1's budget, expressed as a function rather than as a rule in prose.
 *
 * A reminder day emits the reminder and not the evening line. Sending both would be two messages on
 * the two days the user is most likely to be deciding whether to keep the app.
 */
export function dailyMessage(
  date: string,
  reminders: { day5: string; day6: string } | null,
): NotificationId {
  if (reminders?.day5 === date) return "trial-day5";
  if (reminders?.day6 === date) return "trial-day6";
  return "evening";
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
    protein: "Protein ran {gap} g short — eggs or skyr at breakfast closes it.",
    gainUnder: "{under} kcal short of the plan — a handful of nuts tomorrow covers it.",
    under: "{under} under the plan — eating the whole number tomorrow is the plan, not a slip.",
    onPlan: "On plan. Same again tomorrow.",
  },
  fr: {
    noMeals: "Une photo demain remet la journée sur le tableau.",
    over: "{over} au-dessus aujourd'hui — demain repart de {plan}.",
    protein: "Il a manqué {gap} g de protéines — des œufs ou du skyr au petit-déjeuner comblent ça.",
    gainUnder: "{under} kcal sous le plan — une poignée de noix demain suffit.",
    under: "{under} sous le plan — manger le chiffre entier demain, c'est le plan, pas un écart.",
    onPlan: "Dans le plan. Pareil demain.",
  },
  de: {
    noMeals: "Ein Foto morgen holt den Tag zurück aufs Brett.",
    over: "{over} drüber heute — morgen startet wieder bei {plan}.",
    protein: "Beim Eiweiß fehlten {gap} g — Eier oder Skyr zum Frühstück schließen die Lücke.",
    gainUnder: "{under} kcal unter dem Plan — eine Handvoll Nüsse morgen deckt das.",
    under: "{under} unter dem Plan — morgen die ganze Zahl zu essen ist der Plan, kein Ausrutscher.",
    onPlan: "Im Plan. Morgen genauso.",
  },
  it: {
    noMeals: "Una foto domani rimette la giornata sul tabellone.",
    over: "{over} sopra oggi — domani si riparte da {plan}.",
    protein: "Alle proteine mancavano {gap} g — uova o skyr a colazione chiudono il conto.",
    gainUnder: "{under} kcal sotto il piano — una manciata di noci domani copre tutto.",
    under: "{under} sotto il piano — domani mangiare il numero intero è il piano, non uno sgarro.",
    onPlan: "Nel piano. Domani uguale.",
  },
  es: {
    noMeals: "Una foto mañana devuelve el día al marcador.",
    over: "{over} por encima hoy — mañana vuelve a empezar en {plan}.",
    protein: "Faltaron {gap} g de proteína — huevos o skyr en el desayuno lo cierran.",
    gainUnder: "{under} kcal por debajo del plan — un puñado de frutos secos mañana lo cubre.",
    under: "{under} por debajo del plan — comer el número entero mañana es el plan, no un desliz.",
    onPlan: "En el plan. Mañana igual.",
  },
  vi: {
    noMeals: "Một tấm ảnh ngày mai là ngày đó trở lại bảng.",
    over: "Hôm nay vượt {over} — ngày mai lại bắt đầu từ {plan}.",
    protein: "Đạm còn thiếu {gap} g — trứng hoặc sữa chua Hy Lạp buổi sáng là đủ bù.",
    gainUnder: "Thiếu {under} kcal so với kế hoạch — ngày mai một nắm hạt là đủ.",
    under: "Thiếu {under} so với kế hoạch — ngày mai ăn trọn con số mới là kế hoạch, không phải lỡ nhịp.",
    onPlan: "Đúng kế hoạch. Ngày mai cứ vậy.",
  },
  id: {
    noMeals: "Satu foto besok mengembalikan hari itu ke papan.",
    over: "Hari ini lebih {over} — besok mulai lagi dari {plan}.",
    protein: "Protein kurang {gap} g — telur atau yoghurt Yunani saat sarapan menutupnya.",
    gainUnder: "Kurang {under} kcal dari rencana — segenggam kacang besok sudah cukup.",
    under: "Kurang {under} dari rencana — besok makan angka penuhnya itu rencananya, bukan kesalahan.",
    onPlan: "Sesuai rencana. Besok sama lagi.",
  },
  ru: {
    noMeals: "Одно фото завтра вернёт день на доску.",
    over: "Сегодня {over} сверху — завтра снова стартуешь с {plan}.",
    protein: "Белка не хватило {gap} г — яйца или скир на завтрак закрывают разрыв.",
    gainUnder: "{under} ккал не хватило до плана — горсть орехов завтра это покроет.",
    under: "{under} ниже плана — съесть завтра всю цифру и есть план, а не срыв.",
    onPlan: "В плане. Завтра так же.",
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
export function eveningPrescription(i: EveningInput, lang: Lang = "en"): string {
  const say = t(lang)(EVENING_PRESCRIPTIONS);
  const n = numbers(lang);
  if (i.meals === 0) return say.noMeals;

  const overBy = i.totals.kcal - i.targets.kcal;
  if (i.goal !== "gain" && overBy > 0) {
    return fill(say.over, { over: n(overBy), plan: n(i.targets.kcal) });
  }

  const proteinGap = i.targets.protein_g - i.totals.protein_g;
  if (proteinGap >= PROTEIN_GAP_G) return fill(say.protein, { gap: n(proteinGap) });

  const underBy = -overBy;
  if (i.goal === "gain" && underBy >= UNDER_KCAL_GAIN) return fill(say.gainUnder, { under: n(underBy) });
  if (i.goal !== "gain" && underBy >= UNDER_KCAL) return fill(say.under, { under: n(underBy) });

  return say.onPlan;
}
