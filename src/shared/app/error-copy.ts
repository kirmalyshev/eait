// The two screens that stand when the app itself cannot (ieat-app#978): the boot failure, drawn
// when the launch's own requests never got an answer or were refused, and the render boundary,
// drawn when a screen threw. Neither is a board of its own — both borrow the `states-*` grammar:
// a centred say, the care face, a semibold line, a muted one under it, and the small secondary
// "Try again" (`chatCopyFor`'s `tryAgain`, shared rather than reworded).
//
// WHAT IS NOT HERE: the boot screen's "Couldn't reach eait." is `chatScreenCopyFor`'s
// `offlineTitle` — the same sentence the thread's kept turns wear — and nothing here carries the
// thrown error's message, which belongs to the console and to nobody holding the phone.
//
// Phone surfaces both; a client whose shell has no boot or boundary does not read them.

import { t, type Localized } from "../lang.ts";
import type { Lang } from "../types.ts";

export interface ErrorCopy {
  /** Under the reused "Couldn't reach eait." — one note for timeout, offline and dead server alike. */
  bootUnreachableNote: string;
  /** The auth rate limit's 429 at boot: a real answer, worded as the wait it is, not a fault. */
  bootRefusedTitle: string;
  bootRefusedNote: string;
  /** The render boundary's first failure, and the escalated pair when a retry fails again. */
  crashTitle: string;
  crashNote: string;
  crashStuckTitle: string;
  crashStuckNote: string;
  /** The stuck boundary's way out — the remount re-opens the diary rather than the screen that threw. */
  crashHome: string;
}

export const ERROR_COPY: Localized<ErrorCopy> = {
  en: {
    bootUnreachableNote: "Check your connection, then try again.",
    bootRefusedTitle: "Too many sign-ins from this network",
    bootRefusedNote: "Give it a few minutes and try again.",
    crashTitle: "Something went wrong",
    crashNote: "That screen hit an error and stopped. Your meals are saved on the server — nothing you logged has been lost.",
    crashStuckTitle: "That screen keeps failing",
    crashStuckNote: "We couldn't get that screen to load. Your meals are saved on the server — nothing you logged has been lost.",
    crashHome: "Back to my diary",
  },
  fr: {
    bootUnreachableNote: "Vérifie ta connexion, puis réessaie.",
    bootRefusedTitle: "Trop de connexions depuis ce réseau",
    bootRefusedNote: "Laisse passer quelques minutes, puis réessaie.",
    crashTitle: "Une erreur est survenue",
    crashNote: "Cet écran a rencontré une erreur et s'est arrêté. Tes repas sont enregistrés sur le serveur — rien de ce que tu as noté n'est perdu.",
    crashStuckTitle: "Cet écran continue d'échouer",
    crashStuckNote: "Impossible de charger cet écran. Tes repas sont enregistrés sur le serveur — rien de ce que tu as noté n'est perdu.",
    crashHome: "Retour à mon journal",
  },
  de: {
    bootUnreachableNote: "Prüf deine Verbindung und versuch es noch einmal.",
    bootRefusedTitle: "Zu viele Anmeldungen aus diesem Netzwerk",
    bootRefusedNote: "Warte ein paar Minuten und versuch es dann noch einmal.",
    crashTitle: "Etwas ist schiefgelaufen",
    crashNote: "Dieser Bildschirm ist auf einen Fehler gestoßen und wurde angehalten. Deine Mahlzeiten sind auf dem Server gespeichert — nichts, was du eingetragen hast, ist verloren.",
    crashStuckTitle: "Dieser Bildschirm schlägt weiter fehl",
    crashStuckNote: "Dieser Bildschirm ließ sich nicht laden. Deine Mahlzeiten sind auf dem Server gespeichert — nichts, was du eingetragen hast, ist verloren.",
    crashHome: "Zurück zu meinem Tagebuch",
  },
  it: {
    bootUnreachableNote: "Controlla la connessione, poi riprova.",
    bootRefusedTitle: "Troppi accessi da questa rete",
    bootRefusedNote: "Lascia passare qualche minuto e riprova.",
    crashTitle: "Qualcosa è andato storto",
    crashNote: "Quella schermata ha avuto un errore e si è fermata. I tuoi pasti sono salvati sul server — niente di quello che hai registrato è andato perso.",
    crashStuckTitle: "Quella schermata continua a fallire",
    crashStuckNote: "Non siamo riusciti a caricare quella schermata. I tuoi pasti sono salvati sul server — niente di quello che hai registrato è andato perso.",
    crashHome: "Torna al mio diario",
  },
  es: {
    bootUnreachableNote: "Comprueba tu conexión y vuelve a intentarlo.",
    bootRefusedTitle: "Demasiados inicios de sesión desde esta red",
    bootRefusedNote: "Dale unos minutos y vuelve a intentarlo.",
    crashTitle: "Algo salió mal",
    crashNote: "Esa pantalla tuvo un error y se detuvo. Tus comidas están guardadas en el servidor — nada de lo que registraste se ha perdido.",
    crashStuckTitle: "Esa pantalla sigue fallando",
    crashStuckNote: "No pudimos cargar esa pantalla. Tus comidas están guardadas en el servidor — nada de lo que registraste se ha perdido.",
    crashHome: "Volver a mi diario",
  },
  vi: {
    bootUnreachableNote: "Kiểm tra kết nối của bạn, rồi thử lại.",
    bootRefusedTitle: "Quá nhiều lần đăng nhập từ mạng này",
    bootRefusedNote: "Đợi vài phút rồi thử lại.",
    crashTitle: "Đã xảy ra lỗi",
    crashNote: "Màn hình đó gặp lỗi và đã dừng lại. Các bữa ăn của bạn được lưu trên máy chủ — không có gì bạn đã ghi bị mất.",
    crashStuckTitle: "Màn hình đó vẫn lỗi",
    crashStuckNote: "Chúng tôi không tải được màn hình đó. Các bữa ăn của bạn được lưu trên máy chủ — không có gì bạn đã ghi bị mất.",
    crashHome: "Về nhật ký của tôi",
  },
  id: {
    bootUnreachableNote: "Periksa koneksimu, lalu coba lagi.",
    bootRefusedTitle: "Terlalu banyak upaya masuk dari jaringan ini",
    bootRefusedNote: "Tunggu beberapa menit, lalu coba lagi.",
    crashTitle: "Ada yang tidak beres",
    crashNote: "Layar itu mengalami error dan berhenti. Makananmu tersimpan di server — tidak ada yang kamu catat hilang.",
    crashStuckTitle: "Layar itu terus gagal",
    crashStuckNote: "Kami tidak bisa memuat layar itu. Makananmu tersimpan di server — tidak ada yang kamu catat hilang.",
    crashHome: "Kembali ke diary saya",
  },
  ru: {
    bootUnreachableNote: "Проверь соединение и попробуй ещё раз.",
    bootRefusedTitle: "Слишком много входов из этой сети",
    bootRefusedNote: "Подожди несколько минут и попробуй ещё раз.",
    crashTitle: "Что-то пошло не так",
    crashNote: "Этот экран дал сбой и остановился. Твои приёмы пищи сохранены на сервере — ничего из записанного не потеряно.",
    crashStuckTitle: "Этот экран продолжает давать сбой",
    crashStuckNote: "Нам не удалось загрузить этот экран. Твои приёмы пищи сохранены на сервере — ничего из записанного не потеряно.",
    crashHome: "Назад к дневнику",
  },
};

export const errorCopyFor = (lang: Lang): ErrorCopy => t(lang)(ERROR_COPY);
