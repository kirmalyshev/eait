// The Telegram connector's words, in every language the product speaks.
//
// A SECOND TRANSPORT OVER ONE ENGINE, so it has its own copy for the same reason `PAGE_COPY` and
// `frontend/copy.ts` do: `not-onboarded` is a navigation push in the app, a form on the web and a
// sentence with a link here, and the engine hands all three the same `Refusal` kind. What it must
// NOT have is its own idea of what the engine said — `REFUSAL_WORDS` is keyed by the kinds
// `REFUSAL_STATUS` defines, and a kind with no sentence falls back to the generic failure.
//
// WHICH LANGUAGE. The account's, once there is one — a Telegram is attached to an eait account made
// elsewhere, and that account has answered the question. Before that there is no account to ask, so
// the one sentence a stranger gets reads their `from.language_code`, which is the only thing
// Telegram tells us that is about them rather than about their message.

import { t, type Localized } from "@eait/shared";

export interface TelegramCopy {
  stranger: string;
  signIn: string;
  connectedLead: string;
  viaApp: string;
  connectedTail: string;
  notYours: string;
  codeInvalid: string;
  tooManyTries: string;
  onTheWeb: string;
  tooLong: string;
  proposalLead: string;
  /** `{date}` — a proposal for a day that is not today names it. */
  proposalLeadDated: string;
  logIt: string;
  notThis: string;
  logged: string;
  alreadyLogged: string;
  expired: string;
  updated: string;
  moved: string;
  targetGone: string;
  downloadFailed: string;
  tooLarge: string;
  /** `{eaten}`, `{plan}`, `{protein}`, `{proteinTarget}` — the `/today` header. */
  todayHead: string;
  todayEmpty: string;
  /** What an unnamed dish is called on a card. */
  meal: string;
  macros: { protein: string; carbs: string; fat: string };
  failed: string;
  /** Keyed by refusal kind, with `cap-exceeded` split by scope. */
  refusals: Record<string, string>;
}

const EN: TelegramCopy = {
  stranger: "This is the new eait. Your meals and photos are kept in your eait account: sign in on the web and press Connect Telegram on your plan.",
  signIn: "Sign in",
  connectedLead: "Connected to the eait account signed in with",
  viaApp: "the app",
  connectedTail: "Send a photo of a meal, tell me what you ate, or ask Gabie a question.",
  notYours: "Not your account? Sign in to your own on the web and press Connect Telegram there — this Telegram moves to it.",
  codeInvalid: "That link has expired. Open your plan on the web and press Connect Telegram again.",
  tooManyTries: "Too many tries from this Telegram. Wait a while, then press the link again.",
  onTheWeb: "Your profile and settings are on the web.",
  tooLong: "That message is too long to send.",
  proposalLead: "Logging this — look right?",
  proposalLeadDated: "Logging this for {date} — look right?",
  logIt: "Log it",
  notThis: "Not this",
  logged: "Logged.",
  alreadyLogged: "That one was already logged.",
  expired: "That one is no longer being held. Say it again.",
  updated: "Updated.",
  moved: "Moved.",
  targetGone: "There is no meal open here to change. Say what you ate and log it again.",
  downloadFailed: "That photo did not come through from Telegram. Send it again.",
  tooLarge: "That photo is too large to send.",
  todayHead: "Today: {eaten} of {plan} kcal, {protein} of {proteinTarget} g protein",
  todayEmpty: "Nothing logged today yet.",
  meal: "Meal",
  macros: { protein: "Protein", carbs: "Carbs", fat: "Fat" },
  failed: "Something went wrong, and it may still have gone through. Check /today before sending it again.",
  refusals: {
    "not-onboarded": "Answer the plan questions on the web first.",
    "not-food": "That did not look like food.",
    "cap-user": "That was your last one today — your daily allowance resets at midnight.",
    "cap-global": "Everyone has used today's allowance. Tomorrow is a fresh number.",
    "cap-address": "That's the limit for now. Try again later.",
    "subscription-required": "The analyses this account came with are used up. Subscribe on the web to carry on.",
    "analysis-failed": "That did not come back. Try it again.",
    "unsupported-image": "That file is not a photo this can read. JPEG, PNG or WebP.",
    "no-photo": "That photo did not come through. Send it again.",
  },
};

const FR: TelegramCopy = {
  stranger: "Voici le nouveau eait. Tes repas et tes photos sont gardés dans ton compte eait : connecte-toi sur le web et appuie sur Connecter Telegram depuis ton plan.",
  signIn: "Se connecter",
  connectedLead: "Connecté au compte eait ouvert avec",
  viaApp: "l'appli",
  connectedTail: "Envoie la photo d'un repas, dis-moi ce que tu as mangé, ou pose une question à Gabie.",
  notYours: "Ce n'est pas ton compte ? Connecte-toi au tien sur le web et appuie sur Connecter Telegram là-bas — ce Telegram bascule dessus.",
  codeInvalid: "Ce lien a expiré. Ouvre ton plan sur le web et appuie de nouveau sur Connecter Telegram.",
  tooManyTries: "Trop d'essais depuis ce Telegram. Attends un peu, puis réappuie sur le lien.",
  onTheWeb: "Ton profil et tes réglages sont sur le web.",
  tooLong: "Ce message est trop long pour être envoyé.",
  proposalLead: "J'enregistre ça — ça te va ?",
  proposalLeadDated: "J'enregistre ça pour le {date} — ça te va ?",
  logIt: "Enregistrer",
  notThis: "Pas ça",
  logged: "Enregistré.",
  alreadyLogged: "Celui-là était déjà enregistré.",
  expired: "Celui-là n'est plus en attente. Redis-le-moi.",
  updated: "Corrigé.",
  moved: "Déplacé.",
  targetGone: "Il n'y a aucun repas ouvert ici à modifier. Dis-moi ce que tu as mangé et enregistre-le à nouveau.",
  downloadFailed: "Cette photo n'est pas arrivée depuis Telegram. Renvoie-la.",
  tooLarge: "Cette photo est trop lourde à envoyer.",
  todayHead: "Aujourd'hui : {eaten} sur {plan} kcal, {protein} sur {proteinTarget} g de protéines",
  todayEmpty: "Rien d'enregistré aujourd'hui pour l'instant.",
  meal: "Repas",
  macros: { protein: "Protéines", carbs: "Glucides", fat: "Lipides" },
  failed: "Quelque chose a échoué, et c'est peut-être quand même passé. Vérifie /today avant de renvoyer.",
  refusals: {
    "not-onboarded": "Réponds d'abord aux questions du plan sur le web.",
    "not-food": "Ça ne ressemblait pas à de la nourriture.",
    "cap-user": "C'était le dernier pour aujourd'hui — ton quota quotidien repart à minuit.",
    "cap-global": "Tout le monde a épuisé le quota du jour. Demain repart à zéro.",
    "cap-address": "C'est la limite pour l'instant. Réessaie plus tard.",
    "subscription-required": "Les analyses fournies avec ce compte sont épuisées. Abonne-toi sur le web pour continuer.",
    "analysis-failed": "Ça n'est pas revenu. Réessaie.",
    "unsupported-image": "Ce fichier n'est pas une photo lisible ici. JPEG, PNG ou WebP.",
    "no-photo": "Cette photo n'est pas arrivée. Renvoie-la.",
  },
};

const DE: TelegramCopy = {
  stranger: "Das ist das neue eait. Deine Mahlzeiten und Fotos liegen in deinem eait-Konto: melde dich im Web an und drück auf deinem Plan auf Telegram verbinden.",
  signIn: "Anmelden",
  connectedLead: "Verbunden mit dem eait-Konto, angemeldet mit",
  viaApp: "der App",
  connectedTail: "Schick ein Foto einer Mahlzeit, sag mir, was du gegessen hast, oder stell Gabie eine Frage.",
  notYours: "Nicht dein Konto? Melde dich im Web bei deinem eigenen an und drück dort auf Telegram verbinden — dieses Telegram wechselt dann dorthin.",
  codeInvalid: "Dieser Link ist abgelaufen. Öffne deinen Plan im Web und drück noch einmal auf Telegram verbinden.",
  tooManyTries: "Zu viele Versuche von diesem Telegram. Warte etwas und drück den Link noch einmal.",
  onTheWeb: "Dein Profil und deine Einstellungen sind im Web.",
  tooLong: "Diese Nachricht ist zu lang zum Senden.",
  proposalLead: "Ich trage das ein — passt das?",
  proposalLeadDated: "Ich trage das für den {date} ein — passt das?",
  logIt: "Eintragen",
  notThis: "Doch nicht",
  logged: "Eingetragen.",
  alreadyLogged: "Das war schon eingetragen.",
  expired: "Das wird nicht mehr vorgehalten. Sag es noch einmal.",
  updated: "Aktualisiert.",
  moved: "Verschoben.",
  targetGone: "Hier ist keine Mahlzeit offen, die ich ändern könnte. Sag mir, was du gegessen hast, und trag es neu ein.",
  downloadFailed: "Dieses Foto kam von Telegram nicht durch. Schick es noch einmal.",
  tooLarge: "Dieses Foto ist zu groß zum Senden.",
  todayHead: "Heute: {eaten} von {plan} kcal, {protein} von {proteinTarget} g Eiweiß",
  todayEmpty: "Heute ist noch nichts eingetragen.",
  meal: "Mahlzeit",
  macros: { protein: "Eiweiß", carbs: "Kohlenhydrate", fat: "Fett" },
  failed: "Etwas ist schiefgegangen, und es kann trotzdem durchgegangen sein. Schau in /today, bevor du es noch einmal schickst.",
  refusals: {
    "not-onboarded": "Beantworte zuerst die Planfragen im Web.",
    "not-food": "Das sah nicht nach Essen aus.",
    "cap-user": "Das war heute deine letzte — dein Tageskontingent setzt um Mitternacht zurück.",
    "cap-global": "Das Tageskontingent ist für alle aufgebraucht. Morgen ist eine frische Zahl.",
    "cap-address": "Das ist erst einmal die Grenze. Versuch es später noch einmal.",
    "subscription-required": "Die Analysen, die zu diesem Konto gehörten, sind aufgebraucht. Schließ im Web ein Abo ab, um weiterzumachen.",
    "analysis-failed": "Da kam nichts zurück. Versuch es noch einmal.",
    "unsupported-image": "Diese Datei ist kein Foto, das hier gelesen werden kann. JPEG, PNG oder WebP.",
    "no-photo": "Dieses Foto kam nicht an. Schick es noch einmal.",
  },
};

const IT: TelegramCopy = {
  stranger: "Questo è il nuovo eait. I tuoi pasti e le tue foto stanno nel tuo account eait: accedi sul web e premi Collega Telegram dal tuo piano.",
  signIn: "Accedi",
  connectedLead: "Collegato all'account eait con cui hai fatto accesso tramite",
  viaApp: "l'app",
  connectedTail: "Manda la foto di un pasto, dimmi cosa hai mangiato, o fai una domanda a Gabie.",
  notYours: "Non è il tuo account? Accedi al tuo sul web e premi Collega Telegram lì — questo Telegram passa a quello.",
  codeInvalid: "Quel link è scaduto. Apri il tuo piano sul web e premi di nuovo Collega Telegram.",
  tooManyTries: "Troppi tentativi da questo Telegram. Aspetta un po', poi premi di nuovo il link.",
  onTheWeb: "Il tuo profilo e le impostazioni sono sul web.",
  tooLong: "Questo messaggio è troppo lungo da inviare.",
  proposalLead: "Sto registrando questo — ti torna?",
  proposalLeadDated: "Sto registrando questo per il {date} — ti torna?",
  logIt: "Registra",
  notThis: "Non questo",
  logged: "Registrato.",
  alreadyLogged: "Quello era già registrato.",
  expired: "Quello non è più in attesa. Ridimmelo.",
  updated: "Aggiornato.",
  moved: "Spostato.",
  targetGone: "Qui non c'è nessun pasto aperto da cambiare. Dimmi cosa hai mangiato e registralo di nuovo.",
  downloadFailed: "Quella foto non è arrivata da Telegram. Rimandala.",
  tooLarge: "Quella foto è troppo grande da inviare.",
  todayHead: "Oggi: {eaten} di {plan} kcal, {protein} di {proteinTarget} g di proteine",
  todayEmpty: "Oggi non è ancora stato registrato niente.",
  meal: "Pasto",
  macros: { protein: "Proteine", carbs: "Carboidrati", fat: "Grassi" },
  failed: "Qualcosa è andato storto, e potrebbe comunque essere passato. Controlla /today prima di rimandarlo.",
  refusals: {
    "not-onboarded": "Prima rispondi alle domande del piano sul web.",
    "not-food": "Non sembrava cibo.",
    "cap-user": "Quella era l'ultima di oggi — il tuo limite giornaliero riparte a mezzanotte.",
    "cap-global": "Il limite di oggi è esaurito per tutti. Domani è un numero nuovo.",
    "cap-address": "Per ora il limite è questo. Riprova più tardi.",
    "subscription-required": "Le analisi incluse con questo account sono finite. Abbonati sul web per continuare.",
    "analysis-failed": "Non è tornato niente. Riprova.",
    "unsupported-image": "Quel file non è una foto leggibile qui. JPEG, PNG o WebP.",
    "no-photo": "Quella foto non è arrivata. Rimandala.",
  },
};

const ES: TelegramCopy = {
  stranger: "Este es el nuevo eait. Tus comidas y tus fotos se guardan en tu cuenta de eait: entra en la web y pulsa Conectar Telegram en tu plan.",
  signIn: "Entrar",
  connectedLead: "Conectado a la cuenta de eait iniciada con",
  viaApp: "la app",
  connectedTail: "Manda la foto de una comida, dime qué comiste, o hazle una pregunta a Gabie.",
  notYours: "¿No es tu cuenta? Entra en la tuya en la web y pulsa Conectar Telegram allí — este Telegram se pasa a ella.",
  codeInvalid: "Ese enlace ha caducado. Abre tu plan en la web y pulsa Conectar Telegram otra vez.",
  tooManyTries: "Demasiados intentos desde este Telegram. Espera un poco y vuelve a pulsar el enlace.",
  onTheWeb: "Tu perfil y tus ajustes están en la web.",
  tooLong: "Ese mensaje es demasiado largo para enviarlo.",
  proposalLead: "Voy a registrar esto — ¿te cuadra?",
  proposalLeadDated: "Voy a registrar esto para el {date} — ¿te cuadra?",
  logIt: "Registrar",
  notThis: "Esto no",
  logged: "Registrado.",
  alreadyLogged: "Ese ya estaba registrado.",
  expired: "Ese ya no está en espera. Vuelve a decírmelo.",
  updated: "Actualizado.",
  moved: "Movido.",
  targetGone: "Aquí no hay ninguna comida abierta que cambiar. Dime qué comiste y regístralo otra vez.",
  downloadFailed: "Esa foto no llegó desde Telegram. Mándala otra vez.",
  tooLarge: "Esa foto es demasiado grande para enviarla.",
  todayHead: "Hoy: {eaten} de {plan} kcal, {protein} de {proteinTarget} g de proteína",
  todayEmpty: "Hoy todavía no hay nada registrado.",
  meal: "Comida",
  macros: { protein: "Proteína", carbs: "Carbohidratos", fat: "Grasas" },
  failed: "Algo salió mal, y aun así puede haber pasado. Mira /today antes de volver a mandarlo.",
  refusals: {
    "not-onboarded": "Responde primero a las preguntas del plan en la web.",
    "not-food": "Eso no parecía comida.",
    "cap-user": "Esa fue la última de hoy — tu cupo diario se reinicia a medianoche.",
    "cap-global": "El cupo de hoy se ha agotado para todos. Mañana es un número nuevo.",
    "cap-address": "Ese es el límite por ahora. Inténtalo más tarde.",
    "subscription-required": "Los análisis que traía esta cuenta se han agotado. Suscríbete en la web para seguir.",
    "analysis-failed": "No volvió nada. Inténtalo otra vez.",
    "unsupported-image": "Ese archivo no es una foto que se pueda leer aquí. JPEG, PNG o WebP.",
    "no-photo": "Esa foto no llegó. Mándala otra vez.",
  },
};

const VI: TelegramCopy = {
  stranger: "Đây là eait mới. Bữa ăn và ảnh của bạn được lưu trong tài khoản eait: đăng nhập trên web rồi bấm Kết nối Telegram ở trang kế hoạch.",
  signIn: "Đăng nhập",
  connectedLead: "Đã kết nối với tài khoản eait đăng nhập bằng",
  viaApp: "ứng dụng",
  connectedTail: "Gửi ảnh một bữa ăn, kể mình nghe bạn đã ăn gì, hoặc hỏi Gabie một câu.",
  notYours: "Không phải tài khoản của bạn? Đăng nhập vào tài khoản của chính bạn trên web rồi bấm Kết nối Telegram ở đó — Telegram này sẽ chuyển sang đó.",
  codeInvalid: "Liên kết đó đã hết hạn. Mở trang kế hoạch trên web rồi bấm Kết nối Telegram lần nữa.",
  tooManyTries: "Thử quá nhiều lần từ Telegram này. Chờ một lát rồi bấm lại liên kết.",
  onTheWeb: "Hồ sơ và cài đặt của bạn nằm trên web.",
  tooLong: "Tin nhắn này dài quá, không gửi được.",
  proposalLead: "Mình ghi cái này nhé — có đúng không?",
  proposalLeadDated: "Mình ghi cái này cho ngày {date} nhé — có đúng không?",
  logIt: "Ghi lại",
  notThis: "Không phải",
  logged: "Đã ghi.",
  alreadyLogged: "Cái đó đã được ghi rồi.",
  expired: "Cái đó không còn được giữ nữa. Nói lại giúp mình.",
  updated: "Đã cập nhật.",
  moved: "Đã chuyển.",
  targetGone: "Ở đây không có bữa nào đang mở để sửa. Kể mình nghe bạn ăn gì rồi ghi lại.",
  downloadFailed: "Ảnh đó không tới được từ Telegram. Gửi lại nhé.",
  tooLarge: "Ảnh đó lớn quá, không gửi được.",
  todayHead: "Hôm nay: {eaten} trên {plan} kcal, {protein} trên {proteinTarget} g đạm",
  todayEmpty: "Hôm nay chưa ghi gì cả.",
  meal: "Bữa ăn",
  macros: { protein: "Đạm", carbs: "Tinh bột", fat: "Chất béo" },
  failed: "Có gì đó trục trặc, và cũng có thể nó vẫn đi qua. Kiểm tra /today trước khi gửi lại.",
  refusals: {
    "not-onboarded": "Hãy trả lời các câu hỏi lập kế hoạch trên web trước.",
    "not-food": "Cái đó trông không giống đồ ăn.",
    "cap-user": "Đó là lần cuối trong hôm nay — hạn mức mỗi ngày của bạn đặt lại lúc nửa đêm.",
    "cap-global": "Hạn mức hôm nay đã hết cho tất cả mọi người. Mai lại là một con số mới.",
    "cap-address": "Tạm thời đó là giới hạn. Thử lại sau nhé.",
    "subscription-required": "Số lượt phân tích đi kèm tài khoản này đã dùng hết. Đăng ký trên web để tiếp tục.",
    "analysis-failed": "Không có gì trả về. Thử lại nhé.",
    "unsupported-image": "Tệp đó không phải ảnh đọc được ở đây. JPEG, PNG hoặc WebP.",
    "no-photo": "Ảnh đó không tới. Gửi lại nhé.",
  },
};

const ID: TelegramCopy = {
  stranger: "Ini eait yang baru. Makanan dan fotomu disimpan di akun eait-mu: masuk lewat web lalu tekan Hubungkan Telegram di halaman rencanamu.",
  signIn: "Masuk",
  connectedLead: "Terhubung ke akun eait yang masuk lewat",
  viaApp: "aplikasi",
  connectedTail: "Kirim foto makanan, ceritakan apa yang kamu makan, atau tanya sesuatu ke Gabie.",
  notYours: "Bukan akunmu? Masuk ke akunmu sendiri lewat web lalu tekan Hubungkan Telegram di sana — Telegram ini akan pindah ke akun itu.",
  codeInvalid: "Tautan itu sudah kedaluwarsa. Buka halaman rencanamu di web lalu tekan Hubungkan Telegram lagi.",
  tooManyTries: "Terlalu banyak percobaan dari Telegram ini. Tunggu sebentar, lalu tekan tautannya lagi.",
  onTheWeb: "Profil dan pengaturanmu ada di web.",
  tooLong: "Pesan ini terlalu panjang untuk dikirim.",
  proposalLead: "Aku catat ini — sudah benar?",
  proposalLeadDated: "Aku catat ini untuk {date} — sudah benar?",
  logIt: "Catat",
  notThis: "Bukan ini",
  logged: "Tercatat.",
  alreadyLogged: "Yang itu sudah tercatat.",
  expired: "Yang itu sudah kedaluwarsa. Sebutkan sekali lagi.",
  updated: "Diperbarui.",
  moved: "Dipindahkan.",
  targetGone: "Tidak ada makanan yang sedang terbuka di sini untuk diubah. Sebutkan apa yang kamu makan lalu catat lagi.",
  downloadFailed: "Foto itu tidak sampai dari Telegram. Kirim lagi.",
  tooLarge: "Foto itu terlalu besar untuk dikirim.",
  todayHead: "Hari ini: {eaten} dari {plan} kcal, {protein} dari {proteinTarget} g protein",
  todayEmpty: "Hari ini belum ada yang dicatat.",
  meal: "Makanan",
  macros: { protein: "Protein", carbs: "Karbohidrat", fat: "Lemak" },
  failed: "Ada yang gagal, dan mungkin tetap terkirim. Cek /today sebelum mengirim ulang.",
  refusals: {
    "not-onboarded": "Jawab dulu pertanyaan rencananya di web.",
    "not-food": "Itu tidak kelihatan seperti makanan.",
    "cap-user": "Itu yang terakhir untuk hari ini — jatah harianmu mulai lagi tengah malam.",
    "cap-global": "Jatah hari ini sudah habis untuk semua orang. Besok angkanya baru lagi.",
    "cap-address": "Untuk sekarang itu batasnya. Coba lagi nanti.",
    "subscription-required": "Jatah analisis akun ini sudah habis. Berlangganan di web untuk melanjutkan.",
    "analysis-failed": "Tidak ada jawaban yang kembali. Coba lagi.",
    "unsupported-image": "Berkas itu bukan foto yang bisa dibaca di sini. JPEG, PNG atau WebP.",
    "no-photo": "Foto itu tidak sampai. Kirim lagi.",
  },
};

const RU: TelegramCopy = {
  stranger: "Это новый eait. Твои приёмы пищи и фотографии хранятся в аккаунте eait: войди в вебе и нажми «Подключить Telegram» на странице плана.",
  signIn: "Войти",
  connectedLead: "Подключено к аккаунту eait, вход выполнен через",
  viaApp: "приложение",
  connectedTail: "Пришли фото еды, расскажи, что было на тарелке, или задай вопрос Gabie.",
  notYours: "Не твой аккаунт? Войди в свой в вебе и нажми там «Подключить Telegram» — этот Telegram перейдёт к нему.",
  codeInvalid: "Ссылка истекла. Открой свой план в вебе и снова нажми «Подключить Telegram».",
  tooManyTries: "Слишком много попыток с этого Telegram. Подожди немного и нажми ссылку ещё раз.",
  onTheWeb: "Профиль и настройки — в вебе.",
  tooLong: "Это сообщение слишком длинное, чтобы его отправить.",
  proposalLead: "Записываю вот это — всё верно?",
  proposalLeadDated: "Записываю вот это на {date} — всё верно?",
  logIt: "Записать",
  notThis: "Не это",
  logged: "Записал.",
  alreadyLogged: "Это уже было записано.",
  expired: "Это больше не держится. Скажи ещё раз.",
  updated: "Обновил.",
  moved: "Перенёс.",
  targetGone: "Здесь нет открытого приёма пищи, который можно было бы изменить. Скажи, что было на тарелке, и запиши заново.",
  downloadFailed: "Это фото не дошло из Telegram. Пришли его ещё раз.",
  tooLarge: "Это фото слишком большое для отправки.",
  todayHead: "Сегодня: {eaten} из {plan} ккал, белка {protein} из {proteinTarget} г",
  todayEmpty: "Сегодня пока ничего не записано.",
  meal: "Приём пищи",
  macros: { protein: "Белки", carbs: "Углеводы", fat: "Жиры" },
  failed: "Что-то пошло не так, и всё же могло пройти. Загляни в /today, прежде чем отправлять снова.",
  refusals: {
    "not-onboarded": "Сначала ответь на вопросы плана в вебе.",
    "not-food": "Это не похоже на еду.",
    "cap-user": "Это была последняя на сегодня — дневной лимит обнулится в полночь.",
    "cap-global": "Сегодняшний лимит израсходован всеми. Завтра цифра свежая.",
    "cap-address": "Пока это предел. Попробуй позже.",
    "subscription-required": "Разборы, которые шли с этим аккаунтом, закончились. Оформи подписку в вебе, чтобы продолжить.",
    "analysis-failed": "Ничего не вернулось. Попробуй ещё раз.",
    "unsupported-image": "Этот файл — не фото, которое здесь можно прочитать. JPEG, PNG или WebP.",
    "no-photo": "Это фото не дошло. Пришли его ещё раз.",
  },
};

/** Every sentence the bot sends. Gated by `lintCopy` in its test, exactly like `PAGE_COPY`. */
export const TELEGRAM_COPY: Localized<TelegramCopy> = {
  en: EN, fr: FR, de: DE, it: IT, es: ES, vi: VI, id: ID, ru: RU,
};

/** The bot's words in one language. English for one nobody has written yet. */
export const telegramCopyFor = (lang: Parameters<typeof t>[0]): TelegramCopy => t(lang)(TELEGRAM_COPY);
