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
  /** The line under the composer for any other recognition error — `network` when Chrome is offline, `audio-capture` (role=status). */
  composerMicUnavailable: string;
  /** The "+" chooser's two tiles (web "+ Log", the phone's +) and the word that closes it. */
  plusPhoto: string;
  plusText: string;
  /** The chooser's third tile where the browser can listen: starts the mic (#570). */
  plusVoice: string;
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
    composerMicDenied: "Microphone access is off for eait.fit. Turn it on in your browser's settings for this site, then click the mic again.",
    composerMicNothing: "Didn't catch that. Click the mic and try again.",
    composerMicUnavailable: "Voice input isn't working right now. Type instead, or click the mic to try again.",
    plusPhoto: "Photo",
    plusText: "Text",
    plusVoice: "Voice",
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
    composerMicDenied: "L'accès au micro est désactivé pour eait.fit. Activez-le dans les réglages du site de votre navigateur, puis cliquez à nouveau sur le micro.",
    composerMicNothing: "Je n'ai rien entendu. Cliquez sur le micro et réessayez.",
    composerMicUnavailable: "La saisie vocale ne fonctionne pas pour le moment. Écrivez votre message ou cliquez sur le micro pour réessayer.",
    plusPhoto: "Photo",
    plusText: "Texte",
    plusVoice: "Voix",
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
    composerMicDenied: "Der Mikrofonzugriff ist für eait.fit aus. Schalte ihn in den Website-Einstellungen deines Browsers ein und klicke dann erneut auf das Mikrofon.",
    composerMicNothing: "Nichts verstanden. Klicke aufs Mikrofon und versuch es noch mal.",
    composerMicUnavailable: "Spracheingabe funktioniert gerade nicht. Schreib stattdessen oder klicke aufs Mikrofon für einen neuen Versuch.",
    plusPhoto: "Foto",
    plusText: "Text",
    plusVoice: "Sprechen",
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
    composerMicDenied: "L'accesso al microfono è disattivato per eait.fit. Attivalo nelle impostazioni del sito del browser, poi fai clic di nuovo sul microfono.",
    composerMicNothing: "Non ho sentito nulla. Fai clic sul microfono e riprova.",
    composerMicUnavailable: "L'input vocale non funziona in questo momento. Scrivi oppure fai clic sul microfono per riprovare.",
    plusPhoto: "Foto",
    plusText: "Testo",
    plusVoice: "Voce",
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
    composerMicDenied: "El acceso al micrófono está desactivado para eait.fit. Actívalo en los ajustes del sitio de tu navegador y haz clic de nuevo en el micrófono.",
    composerMicNothing: "No he oído nada. Haz clic en el micrófono e inténtalo de nuevo.",
    composerMicUnavailable: "La entrada por voz no funciona ahora mismo. Escribe o haz clic en el micrófono para intentarlo de nuevo.",
    plusPhoto: "Foto",
    plusText: "Texto",
    plusVoice: "Voz",
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
    composerMicDenied: "Quyền dùng micrô của eait.fit đang tắt. Hãy bật trong cài đặt trang web của trình duyệt, rồi nhấp lại vào micrô.",
    composerMicNothing: "Chưa nghe thấy gì. Nhấp vào micrô và thử lại.",
    composerMicUnavailable: "Nhập bằng giọng nói đang không hoạt động. Hãy gõ chữ, hoặc nhấp vào micrô để thử lại.",
    plusPhoto: "Ảnh",
    plusText: "Văn bản",
    plusVoice: "Giọng nói",
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
    composerMicDenied: "Akses mikrofon untuk eait.fit nonaktif. Aktifkan di pengaturan situs browser, lalu klik mikrofon lagi.",
    composerMicNothing: "Tidak terdengar apa pun. Klik mikrofon dan coba lagi.",
    composerMicUnavailable: "Input suara sedang tidak berfungsi. Ketik saja, atau klik mikrofon untuk mencoba lagi.",
    plusPhoto: "Foto",
    plusText: "Teks",
    plusVoice: "Suara",
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
    composerMicDenied: "Доступ к микрофону для eait.fit выключен. Включи его в настройках сайта в браузере и снова нажми на микрофон.",
    composerMicNothing: "Ничего не расслышал. Нажми на микрофон и попробуй ещё раз.",
    composerMicUnavailable: "Голосовой ввод сейчас не работает. Напиши текстом или нажми на микрофон, чтобы попробовать ещё раз.",
    plusPhoto: "Фото",
    plusText: "Текст",
    plusVoice: "Голос",
    closeLog: "Закрыть",
    removeFile: "Убрать {name}",
  },
};

export const shellCopyFor = (lang: Lang): ShellCopy => t(lang)(SHELL_COPY);
