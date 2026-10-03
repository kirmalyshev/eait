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
  /**
   * The render boundary's first failure, and the escalated pair when a retry fails again. Neither
   * promises that logged data is safe: a turn sitting in the phone's outbox is NOT on the server
   * (#708), so "nothing you logged has been lost" would be a claim the crash could make false.
   */
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
    bootRefusedNote: "Try again later.",
    crashTitle: "Something went wrong",
    crashNote: "That screen hit an error and stopped.",
    crashStuckTitle: "That screen keeps failing",
    crashStuckNote: "We couldn't get that screen to load.",
    crashHome: "Back to my diary",
  },
  fr: {
    bootUnreachableNote: "Vérifie ta connexion, puis réessaie.",
    bootRefusedTitle: "Trop de connexions depuis ce réseau",
    bootRefusedNote: "Réessaie plus tard.",
    crashTitle: "Une erreur est survenue",
    crashNote: "Cet écran a rencontré une erreur et s'est arrêté.",
    crashStuckTitle: "Cet écran continue d'échouer",
    crashStuckNote: "Impossible de charger cet écran.",
    crashHome: "Retour à mon journal",
  },
  de: {
    bootUnreachableNote: "Prüf deine Verbindung und versuch es noch einmal.",
    bootRefusedTitle: "Zu viele Anmeldungen aus diesem Netzwerk",
    bootRefusedNote: "Versuch es später noch einmal.",
    crashTitle: "Etwas ist schiefgelaufen",
    crashNote: "Dieser Bildschirm ist auf einen Fehler gestoßen und wurde angehalten.",
    crashStuckTitle: "Dieser Bildschirm schlägt weiter fehl",
    crashStuckNote: "Dieser Bildschirm ließ sich nicht laden.",
    crashHome: "Zurück zu meinem Tagebuch",
  },
  it: {
    bootUnreachableNote: "Controlla la connessione, poi riprova.",
    bootRefusedTitle: "Troppi accessi da questa rete",
    bootRefusedNote: "Riprova più tardi.",
    crashTitle: "Qualcosa è andato storto",
    crashNote: "Quella schermata ha avuto un errore e si è fermata.",
    crashStuckTitle: "Quella schermata continua a fallire",
    crashStuckNote: "Non siamo riusciti a caricare quella schermata.",
    crashHome: "Torna al mio diario",
  },
  es: {
    bootUnreachableNote: "Comprueba tu conexión y vuelve a intentarlo.",
    bootRefusedTitle: "Demasiados inicios de sesión desde esta red",
    bootRefusedNote: "Vuelve a intentarlo más tarde.",
    crashTitle: "Algo salió mal",
    crashNote: "Esa pantalla tuvo un error y se detuvo.",
    crashStuckTitle: "Esa pantalla sigue fallando",
    crashStuckNote: "No pudimos cargar esa pantalla.",
    crashHome: "Volver a mi diario",
  },
  vi: {
    bootUnreachableNote: "Kiểm tra kết nối của bạn, rồi thử lại.",
    bootRefusedTitle: "Quá nhiều lần đăng nhập từ mạng này",
    bootRefusedNote: "Thử lại sau.",
    crashTitle: "Đã xảy ra lỗi",
    crashNote: "Màn hình đó gặp lỗi và đã dừng lại.",
    crashStuckTitle: "Màn hình đó vẫn lỗi",
    crashStuckNote: "Chúng mình không tải được màn hình đó.",
    crashHome: "Về nhật ký của mình",
  },
  id: {
    bootUnreachableNote: "Periksa koneksimu, lalu coba lagi.",
    bootRefusedTitle: "Terlalu banyak upaya masuk dari jaringan ini",
    bootRefusedNote: "Coba lagi nanti.",
    crashTitle: "Ada yang tidak beres",
    crashNote: "Layar itu mengalami error dan berhenti.",
    crashStuckTitle: "Layar itu terus gagal",
    crashStuckNote: "Kami tidak bisa memuat layar itu.",
    crashHome: "Kembali ke diary aku",
  },
  ru: {
    bootUnreachableNote: "Проверь соединение и попробуй ещё раз.",
    bootRefusedTitle: "Слишком много входов из этой сети",
    bootRefusedNote: "Попробуй ещё раз позже.",
    crashTitle: "Что-то пошло не так",
    crashNote: "Этот экран дал сбой и остановился.",
    crashStuckTitle: "Этот экран продолжает давать сбой",
    crashStuckNote: "Нам не удалось загрузить этот экран.",
    crashHome: "Назад к дневнику",
  },
};

export const errorCopyFor = (lang: Lang): ErrorCopy => t(lang)(ERROR_COPY);
