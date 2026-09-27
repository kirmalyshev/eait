// The chat surface's words (W7 #94, mobile M7): the thread screen's chrome — the first-open
// greeting, the composer's two prompts, the proposal card, the coach answer's macro bar, and the
// send/load states the outbox can surface.
//
// Boards (ieat-app `product/design/pro/`, main at 3d2b4357): `web/chat.html`, `web/chat-empty.html`,
// `web/chat-proposal.html`, `web/chat-coach.html`, `web/states-chat-failed.html`,
// `web/states-offline.html`, `web/states-failed.html`, `web/states-unknown.html`, and
// `phone/chat.html`, `phone/chat-empty.html`, `phone/chat-proposal.html`, `phone/chat-coach.html`,
// `phone/chat-busy.html`, `phone/chat-expired.html`, `phone/states-chat-failed.html`,
// `phone/states-offline.html`, `phone/states-not-sent.html`, `phone/states-unknown.html`,
// `phone/states-failed.html`. Keys shown by both clients are plain; keys only one client draws sit
// under `web`/`phone` (the claim rule on #94).
//
// WHAT IS NOT HERE, and whose table it is instead: the nav labels and the "Log a meal" fab are
// `SHELL_COPY`; the coach's signature "{coach} · nutritionist", the "rough estimate" badge and the
// macro TILE labels are `MEAL_COPY`'s (`coachLine`, `roughEstimate`, `macro*` — #116 fills `{coach}`
// from `THREAD_COPY`'s `coach.name`, S9); the card's verdict lines ("Calories high") are
// `verdicts.ts`'s, computed and never reworded per surface; the running line and the starters are
// `THREAD_COPY`'s; the coach's ANSWERS are model-written or engine-scripted — the largest text
// surface is in no table; `phone/states-failed.html` is the log surface's standalone screen (its
// "One meal, any angle" and "Close" belong to that table), while `web/states-failed.html` draws the
// same failure inside Chat and IS here. Dates and times are `Intl`; a kcal figure's unit is
// `UNIT_KCAL`.
//
// ONE DEVIATION, flagged rather than adjusted: `phone/chat-busy.html`'s aria-label says "Spud is
// typing", but the direction gives Chat's voice to Gabie — `phone.typing` is "{coach} is typing".
//
// RUSSIAN: no past-tense verb may describe the reader (`genderedRussian` walks this table), so the
// composer's "What did you eat?" asks about the plate, not about "ты ел". The gram beside a figure
// is a symbol inside the template — "{n} г" — never a declined word.

import { t, type Localized } from "../lang.ts";
import { STRUGGLES, type Lang, type Struggle } from "../types.ts";
import type { IconName } from "../ui/icons.ts";

export interface ChatScreenCopy {
  /** First open (web + phone `chat-empty.html`, `chat-coach.html`): Gabie's opening line. */
  greeting: string;
  /**
   * The composer's short prompt (web + phone `chat-empty.html`, `chat-proposal.html`,
   * `chat-coach.html`, `phone/chat-busy.html`, `phone/chat-expired.html`,
   * `phone/states-not-sent.html`) — and the same sentence as the coach's ask on
   * `phone/chat-busy.html` and `states-unknown.html`.
   */
  composerAsk: string;
  /**
   * The composer over a live thread (`chat.html`, `states-chat-failed.html`,
   * `states-offline.html`, `states-unknown.html` — web + phone). `{coach}` is the coach's name,
   * never a literal.
   */
  composerThread: string;

  /** The proposal card's question (web + phone `chat-proposal.html`, `phone/chat-expired.html`). */
  proposalCheck: string;
  /** Its two answers (`chat-proposal.html`, both clients). */
  proposalAccept: string;
  proposalDecline: string;

  /**
   * The coach answer's macro bar (`chat-coach.html`, both clients): the bar's title is the macro's
   * name, TITLE-case as drawn — `MEAL_COPY.macro*` are the tile labels and read lowercase there.
   * A calories or saturated-fat bar reads `verdictNoun` instead of this map.
   */
  /**
   * `kcal` and `satfat` name the cap, not the macro — the verdict nouns "Calories" and
   * "Saturated fat" (`verdict.noun.weight`/`ldl`), typed here because this bundle holds no
   * i18n catalog to call `verdictNoun` with (#145).
   */
  macroLabels: { protein: string; carbs: string; fat: string; kcal: string; satfat: string };
  /** The figure beside the bar — "54 of 109 g". `{value}`/`{target}` are `wholeNumbers`. */
  macroOfTarget: string;
  /**
   * The first-open starter rows (`chat-empty.html`, both clients), keyed by the struggle each
   * asks. The words are `THREAD_COPY`'s `coachStarters` values restated as a Localized map —
   * the bundle has no catalog (#145), so the row text must sit in a table it can read.
   */
  starters: Record<Struggle, string>;
  /**
   * The meal named on ONE line — the focus sheet's caption and the thread's shrunken card alike:
   * "{name} — {kcal}", `names()` and `kcal()` either side, never a literal join in code.
   */
  mealLine: string;

  /** A proposal left unanswered too long (`phone/chat-expired.html`, the web's same card). */
  expired: string;

  /** `states-chat-failed.html`, both clients: the load failure and its button. */
  loadFailed: string;
  /** The retry button — `states-chat-failed.html`, both clients (and phone's `states-failed.html`). */
  tryAgain: string;

  /**
   * `states-offline.html`, both clients: the coach line above the failed photo, the two failure
   * lines, and the resend — which works the existing outbox, not a second queue.
   */
  eitherWorks: string;
  offlineTitle: string;
  offlineBody: string;
  sendAgain: string;

  /** `states-unknown.html`, both clients: outcome unknown — kept, and re-sent on its own. */
  waitingToSend: string;
  unknownTitle: string;
  unknownBody: string;

  /**
   * The analysis's failure, drawn INSIDE chat on web (`web/states-failed.html`) and as the log
   * surface's standalone screen on phone (`phone/states-failed.html`) — both clients read the
   * same words.
   */
  analysisFailed: string;
  analysisKept: string;

  /** Web-only keys. */
  web: {
    /** The in-chat resend on `web/states-failed.html` (phone's screen says `tryAgain`). */
    sendItAgain: string;
  };
  /** Phone-only keys. */
  phone: {
    /** The send spinner's caption and aria-label (`phone/chat-busy.html`). */
    sending: string;
    /** The typing indicator's aria-label (`phone/chat-busy.html` — the board's literal reads "Spud", the direction's coach is Gabie: `{coach}`). */
    typing: string;
    /** The outbox row's own words (`phone/states-not-sent.html`); M7's client reads this key. */
    notSent: string;
  };
}

export const CHAT_SCREEN_COPY: Localized<ChatScreenCopy> = {
  en: {
    greeting: "Tell me what you ate, or ask me anything.",
    composerAsk: "What did you eat?",
    mealLine: "{name} — {kcal}",
    composerThread: "Tell {coach} what you ate, or ask",
    proposalCheck: "Logging to today — look right?",
    proposalAccept: "Log it",
    proposalDecline: "No",
    expired: "That one timed out. Describe it again and I'll re-read it.",
    macroLabels: { protein: "Protein", carbs: "Carbs", fat: "Fat", kcal: "Calories", satfat: "Saturated fat" },
    starters: { consistency: "How's my week going?", habits: "What's a lighter swap for dinner?", support: "Am I getting enough protein?", busy: "I'll just tell you what I ate", ideas: "What should I eat tonight?" },
    macroOfTarget: "{value} of {target} g",
    loadFailed: "Couldn't load the conversation.",
    tryAgain: "Try again",
    eitherWorks: "Photograph it or tell me — either works",
    offlineTitle: "Couldn't reach eait.",
    offlineBody: "Nothing was logged.",
    sendAgain: "Send again",
    waitingToSend: "Waiting to send",
    unknownTitle: "That didn't finish cleanly.",
    unknownBody: "Kept, and re-sent on its own — sending again is safe.",
    analysisFailed: "The analysis didn't come back.",
    analysisKept: "Nothing was logged. Your photo is kept.",
    web: { sendItAgain: "Send it again" },
    phone: {
      sending: "Sending",
      typing: "{coach} is typing",
      notSent: "Not sent — tap to put it back in the box",
    },
  },
  fr: {
    greeting: "Raconte-moi ce que tu as mangé, ou demande-moi n'importe quoi.",
    composerAsk: "Qu'as-tu mangé ?",
    mealLine: "{name} — {kcal}",
    composerThread: "Dis à {coach} ce que tu as mangé, ou demande",
    proposalCheck: "Je l'ajoute à aujourd'hui — ça te va ?",
    proposalAccept: "Enregistrer",
    proposalDecline: "Non",
    expired: "Celui-là a expiré. Décris-le à nouveau et je le relis.",
    macroLabels: { protein: "Protéines", carbs: "Glucides", fat: "Lipides", kcal: "Calories", satfat: "Graisses saturées" },
    starters: { consistency: "Ma semaine se passe comment ?", habits: "Une alternative plus légère pour le dîner ?", support: "J'ai assez de protéines ?", busy: "Je te dis juste ce que j'ai mangé", ideas: "Je mange quoi ce soir ?" },
    macroOfTarget: "{value} sur {target} g",
    loadFailed: "Impossible de charger la conversation.",
    tryAgain: "Réessayer",
    eitherWorks: "Photographie-le ou raconte-le-moi — les deux marchent",
    offlineTitle: "Impossible de joindre eait.",
    offlineBody: "Rien n'a été enregistré.",
    sendAgain: "Renvoyer",
    waitingToSend: "En attente d'envoi",
    unknownTitle: "Ça ne s'est pas terminé proprement.",
    unknownBody: "Conservé, et renvoyé tout seul — renvoyer toi-même est sans risque.",
    analysisFailed: "L'analyse n'est pas revenue.",
    analysisKept: "Rien n'a été enregistré. Ta photo est conservée.",
    web: { sendItAgain: "La renvoyer" },
    phone: {
      sending: "Envoi",
      typing: "{coach} écrit",
      notSent: "Non envoyé — touche pour le remettre dans la boîte",
    },
  },
  de: {
    greeting: "Sag mir, was du gegessen hast, oder frag mich, was du willst.",
    composerAsk: "Was hast du gegessen?",
    mealLine: "{name} — {kcal}",
    composerThread: "Sag {coach}, was du gegessen hast, oder frag",
    proposalCheck: "Ich trage es für heute ein — passt das?",
    proposalAccept: "Eintragen",
    proposalDecline: "Nein",
    expired: "Das ist abgelaufen. Beschreib es noch einmal, dann lese ich es neu.",
    macroLabels: { protein: "Protein", carbs: "Kohlenhydrate", fat: "Fett", kcal: "Kalorien", satfat: "Gesättigte Fette" },
    starters: { consistency: "Wie läuft meine Woche?", habits: "Wie mache ich das Abendessen leichter?", support: "Bekomme ich genug Eiweiß?", busy: "Ich sage dir einfach, was ich gegessen habe", ideas: "Was soll ich heute Abend essen?" },
    macroOfTarget: "{value} von {target} g",
    loadFailed: "Die Unterhaltung konnte nicht geladen werden.",
    tryAgain: "Erneut versuchen",
    eitherWorks: "Fotografier es oder sag es mir — beides geht",
    offlineTitle: "eait ist gerade nicht erreichbar.",
    offlineBody: "Es wurde nichts eingetragen.",
    sendAgain: "Erneut senden",
    waitingToSend: "Wartet auf den Versand",
    unknownTitle: "Das ist nicht sauber durchgegangen.",
    unknownBody: "Gespeichert und wird von selbst nochmal gesendet — selbst erneut senden ist sicher.",
    analysisFailed: "Die Analyse ist nicht zurückgekommen.",
    analysisKept: "Es wurde nichts eingetragen. Dein Foto ist gespeichert.",
    web: { sendItAgain: "Nochmal senden" },
    phone: {
      sending: "Wird gesendet",
      typing: "{coach} schreibt",
      notSent: "Nicht gesendet — tippe, um es zurück in die Box zu legen",
    },
  },
  it: {
    greeting: "Dimmi cosa hai mangiato, o chiedimi quello che vuoi.",
    composerAsk: "Cosa hai mangiato?",
    mealLine: "{name} — {kcal}",
    composerThread: "Di' a {coach} cosa hai mangiato, o chiedi",
    proposalCheck: "Lo registro a oggi — va bene?",
    proposalAccept: "Registralo",
    proposalDecline: "No",
    expired: "Quella è scaduta. Descrivila di nuovo e la rileggo.",
    macroLabels: { protein: "Proteine", carbs: "Carboidrati", fat: "Grassi", kcal: "Calorie", satfat: "Grassi saturi" },
    starters: { consistency: "Come sta andando la settimana?", habits: "Un'alternativa più leggera per cena?", support: "Sto prendendo abbastanza proteine?", busy: "Ti dico solo cosa ho mangiato", ideas: "Cosa mangio stasera?" },
    macroOfTarget: "{value} su {target} g",
    loadFailed: "Impossibile caricare la conversazione.",
    tryAgain: "Riprova",
    eitherWorks: "Fotografalo o dimmelo — uno vale l'altro",
    offlineTitle: "Impossibile raggiungere eait.",
    offlineBody: "Non è stato registrato nulla.",
    sendAgain: "Invia di nuovo",
    waitingToSend: "In attesa di invio",
    unknownTitle: "Non si è concluso correttamente.",
    unknownBody: "Conservato, e rispedito da solo — inviare di nuovo è sicuro.",
    analysisFailed: "L'analisi non è tornata.",
    analysisKept: "Non è stato registrato nulla. La tua foto è conservata.",
    web: { sendItAgain: "Inviala di nuovo" },
    phone: {
      sending: "Invio",
      typing: "{coach} sta scrivendo",
      notSent: "Non inviato — tocca per rimetterlo nel box",
    },
  },
  es: {
    greeting: "Cuéntame qué has comido, o pregúntame lo que sea.",
    composerAsk: "¿Qué has comido?",
    mealLine: "{name} — {kcal}",
    composerThread: "Dile a {coach} qué has comido, o pregunta",
    proposalCheck: "Lo registro en hoy — ¿te parece bien?",
    proposalAccept: "Registrarla",
    proposalDecline: "No",
    expired: "Esa caducó. Descríbela otra vez y la vuelvo a leer.",
    macroLabels: { protein: "Proteína", carbs: "Carbohidratos", fat: "Grasa", kcal: "Calorías", satfat: "Grasas saturadas" },
    starters: { consistency: "¿Cómo va mi semana?", habits: "¿Una alternativa más ligera para la cena?", support: "¿Estoy tomando suficiente proteína?", busy: "Te digo lo que comí y ya", ideas: "¿Qué ceno hoy?" },
    macroOfTarget: "{value} de {target} g",
    loadFailed: "No se pudo cargar la conversación.",
    tryAgain: "Reintentar",
    eitherWorks: "Fotografíalo o cuéntamelo — cualquiera vale",
    offlineTitle: "No se pudo conectar con eait.",
    offlineBody: "No se registró nada.",
    sendAgain: "Reenviar",
    waitingToSend: "Esperando para enviar",
    unknownTitle: "No terminó de salir limpio.",
    unknownBody: "Guardado, y se reenvía solo — volver a enviar es seguro.",
    analysisFailed: "El análisis no volvió.",
    analysisKept: "No se registró nada. Tu foto queda guardada.",
    web: { sendItAgain: "Enviarla de nuevo" },
    phone: {
      sending: "Enviando",
      typing: "{coach} está escribiendo",
      notSent: "No enviado — toca para devolverlo a la bandeja",
    },
  },
  vi: {
    greeting: "Kể mình nghe bạn đã ăn gì, hoặc hỏi mình bất cứ điều gì.",
    composerAsk: "Bạn đã ăn gì?",
    mealLine: "{name} — {kcal}",
    composerThread: "Kể {coach} nghe bạn đã ăn gì, hoặc hỏi",
    proposalCheck: "Ghi vào hôm nay — đúng chứ?",
    proposalAccept: "Ghi lại",
    proposalDecline: "Không",
    expired: "Cái đó đã hết giờ. Mô tả lại và mình sẽ đọc lại.",
    macroLabels: { protein: "Đạm", carbs: "Tinh bột", fat: "Chất béo", kcal: "Calo", satfat: "Chất béo bão hoà" },
    starters: { consistency: "Tuần này thế nào?", habits: "Đổi món gì nhẹ hơn cho bữa tối?", support: "Đã đủ đạm chưa?", busy: "Tôi sẽ kể tôi đã ăn gì", ideas: "Tối nay nên ăn gì?" },
    macroOfTarget: "{value} trên {target} g",
    loadFailed: "Không tải được cuộc trò chuyện.",
    tryAgain: "Thử lại",
    eitherWorks: "Chụp nó hoặc kể mình nghe — cách nào cũng được",
    offlineTitle: "Không kết nối được với eait.",
    offlineBody: "Chưa có gì được ghi lại.",
    sendAgain: "Gửi lại",
    waitingToSend: "Đang chờ gửi",
    unknownTitle: "Việc gửi chưa kết thúc trọn vẹn.",
    unknownBody: "Đã giữ lại, và sẽ tự gửi lại — gửi lại vẫn an toàn.",
    analysisFailed: "Phân tích không trả về.",
    analysisKept: "Chưa có gì được ghi lại. Ảnh của bạn được giữ.",
    web: { sendItAgain: "Gửi nó lại" },
    phone: {
      sending: "Đang gửi",
      typing: "{coach} đang nhập",
      notSent: "Chưa gửi — chạm để đặt lại vào hộp",
    },
  },
  id: {
    greeting: "Beri tahu aku apa yang kamu makan, atau tanyakan apa saja.",
    composerAsk: "Apa yang kamu makan?",
    mealLine: "{name} — {kcal}",
    composerThread: "Beri tahu {coach} apa yang kamu makan, atau tanya",
    proposalCheck: "Kucatat untuk hari ini — benar?",
    proposalAccept: "Catat",
    proposalDecline: "Tidak",
    expired: "Yang itu kedaluwarsa. Deskripsikan lagi dan aku baca ulang.",
    macroLabels: { protein: "Protein", carbs: "Karbohidrat", fat: "Lemak", kcal: "Kalori", satfat: "Lemak jenuh" },
    starters: { consistency: "Bagaimana mingguku?", habits: "Ada alternatif lebih ringan untuk makan malam?", support: "Proteinku sudah cukup belum?", busy: "Aku kasih tahu saja apa yang kumakan", ideas: "Malam ini sebaiknya makan apa?" },
    macroOfTarget: "{value} dari {target} g",
    loadFailed: "Tidak bisa memuat percakapan.",
    tryAgain: "Coba lagi",
    eitherWorks: "Foto atau ceritakan ke aku — dua-duanya bisa",
    offlineTitle: "Tidak bisa terhubung ke eait.",
    offlineBody: "Tidak ada yang tercatat.",
    sendAgain: "Kirim lagi",
    waitingToSend: "Menunggu untuk dikirim",
    unknownTitle: "Tidak selesai dengan baik.",
    unknownBody: "Disimpan, dan terkirim ulang sendiri — mengirim ulang tetap aman.",
    analysisFailed: "Analisisnya tidak kembali.",
    analysisKept: "Tidak ada yang tercatat. Fotomu disimpan.",
    web: { sendItAgain: "Kirim lagi" },
    phone: {
      sending: "Mengirim",
      typing: "{coach} sedang mengetik",
      notSent: "Belum terkirim — ketuk untuk mengembalikannya ke kotak",
    },
  },
  ru: {
    greeting: "Расскажи, что было на тарелке, или спроси о чём угодно.",
    composerAsk: "Что было на тарелке?",
    mealLine: "{name} — {kcal}",
    composerThread: "Расскажи {coach}, что было на тарелке, или спроси",
    proposalCheck: "Записываю на сегодня — верно?",
    proposalAccept: "Записать",
    proposalDecline: "Нет",
    expired: "Время вышло. Опиши ещё раз, и я перечитаю.",
    macroLabels: { protein: "Белок", carbs: "Углеводы", fat: "Жиры", kcal: "Калории", satfat: "Насыщенные жиры" },
    starters: { consistency: "Как у меня идёт неделя?", habits: "Как сделать ужин полегче?", support: "Мне хватает белка?", busy: "Просто скажу, что было на тарелке", ideas: "Что съесть сегодня вечером?" },
    macroOfTarget: "{value} из {target} г",
    loadFailed: "Не удалось загрузить переписку.",
    tryAgain: "Попробовать ещё раз",
    eitherWorks: "Сфотографируй или расскажи — сработает и так, и так",
    offlineTitle: "Не удалось связаться с eait.",
    offlineBody: "Ничего не записалось.",
    sendAgain: "Отправить ещё раз",
    waitingToSend: "Ждёт отправки",
    unknownTitle: "Отправка не завершилась до конца.",
    unknownBody: "Сохранено и отправится само — отправить ещё раз безопасно.",
    analysisFailed: "Анализ не вернулся.",
    analysisKept: "Ничего не записалось. Фото сохранено.",
    web: { sendItAgain: "Отправить ещё раз" },
    phone: {
      sending: "Отправка",
      typing: "{coach} печатает",
      notSent: "Не отправлено — нажми, чтобы вернуть в коробку",
    },
  },
};

export const chatScreenCopyFor = (lang: Lang): ChatScreenCopy => t(lang)(CHAT_SCREEN_COPY);

// ── The option-row icons ───────────────────────────────────────────────────────────────────
//
// The starter card and the coach's suggestion rows draw the boards' `.opt` rows — one icon,
// the words, a chevron. WHICH icon follows the boards (`chat-empty`, `chat-coach`): a starter
// carries its struggle's own, and a suggestion row takes the macro's when the words name one,
// else `ideas`. The mapping is shared so W7 and M7 draw the same icon for the same line.

/** Each struggle's starter row's icon, the boards' own pairing. */
export const STARTER_ICONS: Record<Struggle, IconName> = {
  consistency: "consistency", habits: "habits", support: "protein", busy: "busy", ideas: "ideas",
};

const words = (text: string): string[] =>
  text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 0);

/** True when `phrase` appears in `text` as whole words — never inside a longer word. */
const hasPhrase = (text: string, phrase: string): boolean => {
  const hay = words(text);
  const needle = words(phrase);
  if (needle.length === 0) return false;
  outer: for (let i = 0; i + needle.length <= hay.length; i++) {
    for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer;
    return true;
  }
  return false;
};

/**
 * The starter rows in the struggles' own order — the picked struggles first, in `STRUGGLES` list
 * order, the unpicked filling to three — `shared/chat.ts`'s rule restated against this table,
 * because `starterRowsFor` there reads the lingui THREAD_COPY and this bundle holds no catalog.
 */
export function starterRows(
  picked: readonly Struggle[] | null | undefined,
  lang: Lang,
): { struggle: Struggle; text: string }[] {
  const starters = chatScreenCopyFor(lang).starters;
  return [...STRUGGLES.filter((s) => picked?.includes(s)), ...STRUGGLES.filter((s) => !picked?.includes(s))]
    .slice(0, 3).map((s) => ({ struggle: s, text: starters[s] }));
}

/**
 * The icon a coach line's `.opt` row carries (`chat-coach`): a starter's own struggle icon when
 * the row IS a starter, a macro's icon when the words name a `macroLabels` entry, `ideas`
 * otherwise. Whole-word, case-insensitive — the boards' rule, in the reader's language.
 */
export function coachRowIcon(text: string, lang: Lang): IconName {
  const starters = chatScreenCopyFor(lang).starters;
  for (const s of Object.keys(STARTER_ICONS) as Struggle[]) {
    if (hasPhrase(text, starters[s])) return STARTER_ICONS[s];
  }
  const labels = chatScreenCopyFor(lang).macroLabels;
  for (const [m, label] of Object.entries(labels)) {
    if (hasPhrase(text, label)) return m as IconName;
  }
  return "ideas";
}
