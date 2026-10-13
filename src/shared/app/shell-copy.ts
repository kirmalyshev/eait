// The app shell's words — the one navigation both clients draw (#87): the boards' `eait` wordmark,
// then Home · Progress · Chat · Profile, with the round "+" between them that logs a meal.
//
// A TABLE IN shared rather than in a client's own copy, because the phone and the browser offer
// the same tabs by the same names and two tables would drift into two products. This is the first
// of the `app/*-copy.ts` surface tables (the plan's §B puts every surface's strings here): a
// record of words, `lang.ts` for the `Localized`/`t` plumbing, and nothing else, so the module a
// browser bundles by relative path stays small.

import { t, type Localized } from "../lang.ts";
import type { Lang } from "../types.ts";

export interface ShellCopy {
  /** The tabs, in the boards' order: Home · Progress · Chat · Profile. */
  navHome: string;
  navProgress: string;
  navChat: string;
  navProfile: string;
  /** The round "+" that logs a meal — its accessible name; the button itself is a glyph. */
  logMeal: string;
  /** The composer's camera round — icon-only, so the name is the label (`composerRow`, both surfaces). */
  composerPhoto: string;
  /** The composer's send round — icon-only (`composerRow`). */
  composerSend: string;
  /** The composer's mic round, idle — icon-only, so the name is the label (web chat, Safari only; #570). */
  composerMic: string;
  /** The mic round while listening: what a press does. */
  composerMicStop: string;
  /** The field's placeholder while listening and nothing is heard yet. */
  composerListening: string;
  /** The mic round's name once the permission is denied. */
  composerMicBlocked: string;
  /** The line under the composer after a denied permission (role=status). */
  composerMicDenied: string;
  /** The line under the composer when nothing was heard (role=status). */
  composerMicNothing: string;
  /** The "+" chooser's two tiles (web "+ Log", the phone's +) and the word that closes it. */
  plusPhoto: string;
  plusText: string;
  closeLog: string;
  /** `{name}` — an attached file chip's remove button. */
  removeFile: string;
}

export const SHELL_COPY: Localized<ShellCopy> = {
  en: {
    navHome: "Home",
    navProgress: "Progress",
    navChat: "Chat",
    navProfile: "Profile",
    logMeal: "Log a meal",
    composerPhoto: "Add a photo",
    composerSend: "Send",
    composerMic: "Speak instead of typing",
    composerMicStop: "Stop listening",
    composerListening: "Listening…",
    composerMicBlocked: "Microphone blocked",
    composerMicDenied: "Safari isn't allowed to use the microphone here. Allow it in Safari › Settings for eait.fit, then tap the mic again.",
    composerMicNothing: "Didn't catch that. Tap the mic and try again.",
    plusPhoto: "Photo",
    plusText: "Text",
    closeLog: "Close",
    removeFile: "Remove {name}",
  },
  fr: {
    navHome: "Accueil",
    navProgress: "Progrès",
    navChat: "Chat",
    navProfile: "Profil",
    logMeal: "Enregistrer un repas",
    composerPhoto: "Ajouter une photo",
    composerSend: "Envoyer",
    composerMic: "Parler au lieu de taper",
    composerMicStop: "Arrêter l'écoute",
    composerListening: "J'écoute…",
    composerMicBlocked: "Micro bloqué",
    composerMicDenied: "Safari n'a pas accès au micro ici. Autorisez-le dans Safari › Réglages pour eait.fit, puis touchez à nouveau le micro.",
    composerMicNothing: "Je n'ai rien entendu. Touchez le micro et réessayez.",
    plusPhoto: "Photo",
    plusText: "Texte",
    closeLog: "Fermer",
    removeFile: "Retirer {name}",
  },
  de: {
    navHome: "Start",
    navProgress: "Fortschritt",
    navChat: "Chat",
    navProfile: "Profil",
    logMeal: "Mahlzeit eintragen",
    composerPhoto: "Foto hinzufügen",
    composerSend: "Senden",
    composerMic: "Sprechen statt tippen",
    composerMicStop: "Zuhören beenden",
    composerListening: "Ich höre zu…",
    composerMicBlocked: "Mikrofon blockiert",
    composerMicDenied: "Safari darf hier das Mikrofon nicht nutzen. Erlaube es unter Safari › Einstellungen für eait.fit und tippe dann erneut auf das Mikrofon.",
    composerMicNothing: "Nichts verstanden. Tippe aufs Mikrofon und versuch es noch mal.",
    plusPhoto: "Foto",
    plusText: "Text",
    closeLog: "Schließen",
    removeFile: "{name} entfernen",
  },
  it: {
    navHome: "Home",
    navProgress: "Progressi",
    navChat: "Chat",
    navProfile: "Profilo",
    logMeal: "Registra un pasto",
    composerPhoto: "Aggiungi una foto",
    composerSend: "Invia",
    composerMic: "Parla invece di scrivere",
    composerMicStop: "Smetti di ascoltare",
    composerListening: "Ti ascolto…",
    composerMicBlocked: "Microfono bloccato",
    composerMicDenied: "Safari non può usare il microfono qui. Consentilo in Safari › Impostazioni per eait.fit, poi tocca di nuovo il microfono.",
    composerMicNothing: "Non ho sentito nulla. Tocca il microfono e riprova.",
    plusPhoto: "Foto",
    plusText: "Testo",
    closeLog: "Chiudi",
    removeFile: "Rimuovi {name}",
  },
  es: {
    navHome: "Inicio",
    navProgress: "Progreso",
    navChat: "Chat",
    navProfile: "Perfil",
    logMeal: "Registrar una comida",
    composerPhoto: "Añadir una foto",
    composerSend: "Enviar",
    composerMic: "Habla en vez de escribir",
    composerMicStop: "Dejar de escuchar",
    composerListening: "Te escucho…",
    composerMicBlocked: "Micrófono bloqueado",
    composerMicDenied: "Safari no puede usar el micrófono aquí. Permítelo en Safari › Ajustes para eait.fit y vuelve a tocar el micrófono.",
    composerMicNothing: "No he oído nada. Toca el micrófono e inténtalo de nuevo.",
    plusPhoto: "Foto",
    plusText: "Texto",
    closeLog: "Cerrar",
    removeFile: "Quitar {name}",
  },
  vi: {
    navHome: "Trang chủ",
    navProgress: "Tiến độ",
    navChat: "Chat",
    navProfile: "Hồ sơ",
    logMeal: "Ghi một bữa ăn",
    composerPhoto: "Thêm ảnh",
    composerSend: "Gửi",
    composerMic: "Nói thay vì gõ",
    composerMicStop: "Dừng nghe",
    composerListening: "Đang nghe…",
    composerMicBlocked: "Micrô bị chặn",
    composerMicDenied: "Safari không được dùng micrô ở đây. Hãy cho phép trong Safari › Cài đặt cho eait.fit, rồi chạm lại vào micrô.",
    composerMicNothing: "Chưa nghe thấy gì. Chạm vào micrô và thử lại.",
    plusPhoto: "Ảnh",
    plusText: "Văn bản",
    closeLog: "Đóng",
    removeFile: "Xóa {name}",
  },
  id: {
    navHome: "Beranda",
    navProgress: "Progres",
    navChat: "Chat",
    navProfile: "Profil",
    logMeal: "Catat makanan",
    composerPhoto: "Tambah foto",
    composerSend: "Kirim",
    composerMic: "Bicara, bukan mengetik",
    composerMicStop: "Berhenti mendengarkan",
    composerListening: "Mendengarkan…",
    composerMicBlocked: "Mikrofon diblokir",
    composerMicDenied: "Safari tidak diizinkan memakai mikrofon di sini. Izinkan di Safari › Pengaturan untuk eait.fit, lalu ketuk mikrofon lagi.",
    composerMicNothing: "Tidak terdengar apa pun. Ketuk mikrofon dan coba lagi.",
    plusPhoto: "Foto",
    plusText: "Teks",
    closeLog: "Tutup",
    removeFile: "Hapus {name}",
  },
  ru: {
    navHome: "Главная",
    navProgress: "Прогресс",
    navChat: "Чат",
    navProfile: "Профиль",
    logMeal: "Записать приём пищи",
    composerPhoto: "Добавить фото",
    composerSend: "Отправить",
    composerMic: "Сказать голосом",
    composerMicStop: "Перестать слушать",
    composerListening: "Слушаю…",
    composerMicBlocked: "Микрофон заблокирован",
    composerMicDenied: "Safari не может использовать микрофон на этом сайте. Разреши его в Safari › Настройки для eait.fit и снова нажми на микрофон.",
    composerMicNothing: "Ничего не расслышал. Нажми на микрофон и попробуй ещё раз.",
    plusPhoto: "Фото",
    plusText: "Текст",
    closeLog: "Закрыть",
    removeFile: "Убрать {name}",
  },
};

export const shellCopyFor = (lang: Lang): ShellCopy => t(lang)(SHELL_COPY);
