// The logging surface's words (#92, W5/M5): pick or drop a photo, the 1.6 s scan, the logged
// card, the rough-guess correction, the first verdict, and the refused / failed / unknown /
// wrong-format states. Written once here because both clients draw the same screens — the claim
// rule on the index puts the whole surface's strings in the first PR to reach it, so `web` and
// `phone` hold the strings only one client's boards draw; everything else is shared.
//
// NOT HERE, on purpose:
// - the verdict pills ("Calories high") — computed in `verdicts.ts`, localized in the catalogs;
// - the chat chrome the state boards sit inside ("Tell Gabie what you ate, or ask", "Send
//   again", "Couldn't reach eait.") — W7's `chat-copy.ts`;
// - the nav labels — `shell-copy.ts`;
// - meal names, grams and figures — data, formatted with `wholeNumbers(lang)`.
//
// UNIT WORDS LIVE INSIDE THE TEMPLATES ("{grams} g", "{plan} kcal"), the way `lang.ts` wants
// a sentence's unit spelled — so the Russian strings write г and ккал themselves rather than
// taking a symbol from code.

import { t, type Localized } from "../lang.ts";
import type { Lang } from "../types.ts";

export interface LogCopy {
  /** `log-upload` + `log-camera`: the note field's placeholder — "sausage, not zucchini". */
  notePlaceholder: string;
  /** `log-reading`: the scanning line, looping over the photo for 1,600 ms. */
  reading: string;
  /** `log-reading`: the disabled CTA while the analyzer runs. */
  checking: string;
  /** `log-reading`, `log-refused`, `states-failed`, `states-format`, `log-camera-denied`. */
  close: string;
  /** `log-logged`, `log-rough`: the card's stamp — web "Logged · 13:05"; phone the screen title. */
  logged: string;
  /** `log-reading`, `log-logged`, `log-refused` (phone): the day title — "Today · 13:04". */
  today: string;
  /** `states-unknown`: the pending badge under a bubble the server has not answered. */
  waitingToSend: string;
  /** `log-refused`: the headline — the photo held no food. */
  noFood: string;
  /** `log-refused`, `states-format`: the retry door. */
  tryAnotherPhoto: string;
  /** `log-rough`: the estimate's own label. */
  roughGuess: string;
  /**
   * `log-rough`: the question. `{item}` is the ingredient the card is least sure of, `{grams}`
   * its amount as a bare number — the unit is the template's.
   */
  roughAsk: string;
  /** `log-rough`: the first answer. */
  roughAbout: string;
  /** `log-rough`: the second answer. */
  roughHalf: string;
  /** `log-rough`: the third answer — "More like 250 g". */
  roughMore: string;
  /**
   * `log-rough`: the sentence a grams answer SENDS as its correction turn — "Half that" and
   * "More like {n} g" both speak the portion they mean ("The rice was about 75 g"), so the
   * thread line and the model read the same words. `{item}` and `{grams}` are the question's.
   */
  roughSent: string;
  /** `log-logged`, `log-rough`: the card's edit door. */
  edit: string;
  /** `log-logged`, `log-rough`: the card's confirm — the counterpart of `edit`. */
  agree: string;
  /** `first-verdict`: the heading — the web renders the phone board's content for this. */
  firstVerdict: string;
  /** `first-verdict`: the secondary — "this is off, let me fix it", the sparkle button. */
  correct: string;
  /** `first-verdict`: the primary. */
  continueCta: string;
  /** `states-failed`: under the title — the photo was not lost. */
  analysisFailedNote: string;
  /** `states-unknown`: the notice's first line — the turn may still have landed. */
  unknownTitle: string;
  /** `states-unknown`: the notice's second line. */
  unknownNote: string;
  /**
   * `log-logged`: the one-line explanation under a warn verdict. `{noun}` is
   * `verdictNoun(dimension, lang)` ("Saturated fat"), `{amount}` the meal's figure, `{target}`
   * the day's cap — the unit is the template's. The translations that cannot agree an adjective
   * with a placeholder noun restructure around it ("For one meal, that is a lot: …").
   */
  verdictDetail: string;
  /** `log-logged`, `log-rough`: the day counter — "{eaten} of {plan} kcal". */
  dayEaten: string;
  /** `log-logged`, `log-rough`: its second half — "582 left"; the rough board joins them with " · ". */
  dayLeft: string;

  /** The boards only the web draws: `log-upload`'s dropzone, and the chat-thread failure state. */
  web: {
    /** `log-upload`: the headline. */
    title: string;
    /** `log-upload`: inside the dropzone. */
    dropHint: string;
    /** `log-upload`: one string — the middot and the format list are the board's. */
    chooseFile: string;
    /** `log-upload`: the board's British spelling — `phone.analyzeCta` is American. */
    analyzeCta: string;
    /** `log-upload`: the quiet door to the chat when there is no photo at hand. `{coach}` is `coach.name`. */
    chatInstead: string;
    /** `log-reading`: the pending card's source suffix — "13:05 · from a photo". */
    fromPhoto: string;
    /** `states-failed`: the web's failed state is a coach card in Chat — with a period, unlike the phone's. */
    failedTitle: string;
    /** `states-failed`: the retry button on that card. */
    sendAgain: string;
  };

  /** The boards only the phone draws: the camera, the library sheet, and its own state cards. */
  phone: {
    /** `log-camera`: the screen's title, reused as the top-bar title on the failed/format sheets. */
    cameraTitle: string;
    /** `log-camera`: the line over the thumbnails. */
    cameraHint: string;
    /** `log-camera`: the captured-shot counter — "{n} of {total}", "1 of 3". */
    shotCount: string;
    /** `log-camera`: the board's American spelling — `web.analyzeCta` is British. */
    analyzeCta: string;
    /** `log-upload`: the library sheet's title. */
    pickTitle: string;
    /** `log-upload`: under the grid. */
    pickHint: string;
    /** `log-camera-denied`: the sheet's headline. */
    cameraOffTitle: string;
    /** `log-camera-denied`: the way out. */
    cameraOffNote: string;
    /** `log-camera-denied`: the secondary door. */
    pickLibrary: string;
    /** `log-refused`: the top-bar title, above `noFood`. */
    refusedTitle: string;
    /** `states-failed`: the phone's failed sheet — no period, unlike the web's chat card. */
    failedTitle: string;
    /** `states-failed`: the phone sheet's retry. */
    tryAgain: string;
    /** `states-format`: the wrong-format sheet — the web refuses format at upload before this exists. */
    formatTitle: string;
    /** `states-format`: which formats pass, and the alternative. */
    formatNote: string;
  };
}

export const LOG_COPY: Localized<LogCopy> = {
  en: {
    notePlaceholder: "Anything I can’t see? Sausage, not zucchini…",
    reading: "Reading the plate. One moment for the numbers.",
    checking: "Checking the numbers",
    close: "Close",
    logged: "Logged",
    today: "Today",
    waitingToSend: "Waiting to send",
    noFood: "No food in that one",
    tryAnotherPhoto: "Try another photo",
    roughGuess: "Rough guess",
    roughAsk: "Was the {item} about {grams} g?",
    roughAbout: "About that",
    roughHalf: "Half that",
    roughMore: "More like {grams} g",
    roughSent: "The {item} was about {grams} g",
    edit: "Edit",
    agree: "Agree",
    firstVerdict: "Your first verdict",
    correct: "Correct",
    continueCta: "Continue",
    analysisFailedNote: "Nothing was logged. Your photo is kept.",
    unknownTitle: "That didn't finish cleanly.",
    unknownNote: "Kept, and re-sent on its own — sending again is safe.",
    verdictDetail: "{noun} is high for one meal: {amount} of your {target} g. Go easy on it for the rest of today.",
    dayEaten: "{eaten} of {plan} kcal",
    dayLeft: "{left} left",
    web: {
      title: "A photo of the meal",
      dropHint: "Drop a photo here",
      chooseFile: "or choose a file · JPEG, PNG or WebP",
      analyzeCta: "Analyse",
      chatInstead: "or tell {coach} about it in Chat",
      fromPhoto: "from a photo",
      failedTitle: "The analysis didn't come back.",
      sendAgain: "Send it again",
    },
    phone: {
      cameraTitle: "One meal, any angle",
      cameraHint: "A second shot from the side helps with portions",
      shotCount: "{n} of {total}",
      analyzeCta: "Analyze",
      pickTitle: "Pick a photo",
      pickHint: "Pick any angles of the same meal",
      cameraOffTitle: "Camera access is off",
      cameraOffNote: "Turn it on in Settings, or pick a photo you already took.",
      pickLibrary: "Pick from library instead",
      refusedTitle: "Couldn’t log that",
      failedTitle: "The analysis didn’t come back",
      tryAgain: "Try again",
      formatTitle: "That photo format can’t be read",
      formatNote: "JPEG, PNG or WebP — or photograph the plate instead.",
    },
  },
  fr: {
    notePlaceholder: "Quelque chose que je ne vois pas ? Saucisse, pas courgette…",
    reading: "Lecture de l’assiette. Un instant pour les chiffres.",
    checking: "Vérification des chiffres",
    close: "Fermer",
    logged: "Enregistré",
    today: "Aujourd’hui",
    waitingToSend: "En attente d’envoi",
    noFood: "Aucun aliment sur celle-là",
    tryAnotherPhoto: "Essayer une autre photo",
    roughGuess: "Estimation approximative",
    roughAsk: "Environ {grams} g de {item} ?",
    roughAbout: "À peu près ça",
    roughHalf: "Moitié moins",
    roughMore: "Plutôt {grams} g",
    roughSent: "Environ {grams} g de {item}",
    edit: "Modifier",
    agree: "D’accord",
    firstVerdict: "Ton premier verdict",
    correct: "Corriger",
    continueCta: "Continuer",
    analysisFailedNote: "Rien n’a été enregistré. Ta photo est gardée.",
    unknownTitle: "Ça ne s’est pas terminé proprement.",
    unknownNote: "Gardé, et renvoyé tout seul — le renvoyer est sans risque.",
    verdictDetail: "Pour un repas, c’est beaucoup : {noun} {amount} sur {target} g. Vas-y doucement pour le reste de la journée.",
    dayEaten: "{eaten} sur {plan} kcal",
    dayLeft: "{left} restantes",
    web: {
      title: "Une photo du repas",
      dropHint: "Dépose une photo ici",
      chooseFile: "ou choisis un fichier · JPEG, PNG ou WebP",
      analyzeCta: "Analyser",
      chatInstead: "ou raconte-le à {coach} dans Chat",
      fromPhoto: "depuis une photo",
      failedTitle: "L’analyse n’est pas arrivée.",
      sendAgain: "Renvoyer",
    },
    phone: {
      cameraTitle: "Un repas, n’importe quel angle",
      cameraHint: "Une deuxième prise de côté aide pour les portions",
      shotCount: "{n} sur {total}",
      analyzeCta: "Analyser",
      pickTitle: "Choisir une photo",
      pickHint: "N’importe quel angle du même repas",
      cameraOffTitle: "L’accès à la caméra est coupé",
      cameraOffNote: "Active-le dans Réglages, ou choisis une photo déjà prise.",
      pickLibrary: "Choisir dans la bibliothèque",
      refusedTitle: "Impossible de l’enregistrer",
      failedTitle: "L’analyse n’est pas arrivée",
      tryAgain: "Réessayer",
      formatTitle: "Ce format de photo est illisible",
      formatNote: "JPEG, PNG ou WebP — ou photographie l’assiette.",
    },
  },
  de: {
    notePlaceholder: "Etwas, das ich nicht sehe? Wurst statt Zucchini…",
    reading: "Der Teller wird gelesen. Einen Moment für die Zahlen.",
    checking: "Zahlen werden geprüft",
    close: "Schließen",
    logged: "Eingetragen",
    today: "Heute",
    waitingToSend: "Wartet aufs Senden",
    noFood: "Kein Essen auf diesem",
    tryAnotherPhoto: "Versuch ein anderes Foto",
    roughGuess: "Grobe Schätzung",
    roughAsk: "Etwa {grams} g {item}?",
    roughAbout: "Ungefähr so viel",
    roughHalf: "Die Hälfte davon",
    roughMore: "Eher {grams} g",
    roughSent: "Etwa {grams} g {item}",
    edit: "Bearbeiten",
    agree: "Stimmt",
    firstVerdict: "Dein erstes Urteil",
    correct: "Korrigieren",
    continueCta: "Weiter",
    analysisFailedNote: "Nichts wurde eingetragen. Dein Foto bleibt gespeichert.",
    unknownTitle: "Das ist nicht sauber durchgegangen.",
    unknownNote: "Behalten und wird von selbst erneut gesendet — erneutes Senden ist sicher.",
    verdictDetail: "Für eine Mahlzeit ist das viel: {noun} {amount} von {target} g. Nimm es für den Rest des Tages lockerer.",
    dayEaten: "{eaten} von {plan} kcal",
    dayLeft: "{left} übrig",
    web: {
      title: "Ein Foto vom Essen",
      dropHint: "Foto hier ablegen",
      chooseFile: "oder wähl eine Datei · JPEG, PNG oder WebP",
      analyzeCta: "Analysieren",
      chatInstead: "oder erzähl es {coach} im Chat",
      fromPhoto: "von einem Foto",
      failedTitle: "Die Analyse ist nicht zurückgekommen.",
      sendAgain: "Erneut senden",
    },
    phone: {
      cameraTitle: "Eine Mahlzeit, jeder Winkel",
      cameraHint: "Ein zweites Bild von der Seite hilft bei den Portionen",
      shotCount: "{n} von {total}",
      analyzeCta: "Analysieren",
      pickTitle: "Foto wählen",
      pickHint: "Beliebige Winkel derselben Mahlzeit",
      cameraOffTitle: "Kamerazugriff ist aus",
      cameraOffNote: "Aktivier ihn in den Einstellungen oder wähl ein Foto, das du schon hast.",
      pickLibrary: "Stattdessen aus der Bibliothek",
      refusedTitle: "Das ließ sich nicht eintragen",
      failedTitle: "Die Analyse ist nicht zurückgekommen",
      tryAgain: "Erneut versuchen",
      formatTitle: "Dieses Fotoformat ist nicht lesbar",
      formatNote: "JPEG, PNG oder WebP — oder fotografier den Teller.",
    },
  },
  it: {
    notePlaceholder: "Qualcosa che non vedo? Salsiccia, non zucchine…",
    reading: "Lettura del piatto. Un attimo per i numeri.",
    checking: "Controllo dei numeri",
    close: "Chiudi",
    logged: "Registrato",
    today: "Oggi",
    waitingToSend: "In attesa di invio",
    noFood: "Nessun cibo in questa",
    tryAnotherPhoto: "Prova un’altra foto",
    roughGuess: "Stima approssimativa",
    roughAsk: "Circa {grams} g di {item}?",
    roughAbout: "Più o meno quello",
    roughHalf: "La metà",
    roughMore: "Più tipo {grams} g",
    roughSent: "Circa {grams} g di {item}",
    edit: "Modifica",
    agree: "Va bene",
    firstVerdict: "Il tuo primo verdetto",
    correct: "Correggi",
    continueCta: "Continua",
    analysisFailedNote: "Niente è stato registrato. La tua foto è conservata.",
    unknownTitle: "Non si è concluso bene.",
    unknownNote: "Conservato e rispedito da solo — rispedire è sicuro.",
    verdictDetail: "Per un pasto è tanto: {noun} {amount} su {target} g. Vacci piano per il resto di oggi.",
    dayEaten: "{eaten} di {plan} kcal",
    dayLeft: "ne restano {left}",
    web: {
      title: "Una foto del pasto",
      dropHint: "Trascina qui una foto",
      chooseFile: "o scegli un file · JPEG, PNG o WebP",
      analyzeCta: "Analizza",
      chatInstead: "o raccontalo a {coach} in Chat",
      fromPhoto: "da una foto",
      failedTitle: "L’analisi non è tornata.",
      sendAgain: "Inviala di nuovo",
    },
    phone: {
      cameraTitle: "Un pasto, da qualsiasi angolazione",
      cameraHint: "Un secondo scatto di lato aiuta con le porzioni",
      shotCount: "{n} di {total}",
      analyzeCta: "Analizza",
      pickTitle: "Scegli una foto",
      pickHint: "Qualsiasi angolazione dello stesso pasto",
      cameraOffTitle: "L’accesso alla fotocamera è disattivato",
      cameraOffNote: "Attivalo in Impostazioni, o scegli una foto che hai già scattato.",
      pickLibrary: "Scegli dalla libreria",
      refusedTitle: "Non si è potuto registrare",
      failedTitle: "L’analisi non è tornata",
      tryAgain: "Riprova",
      formatTitle: "Questo formato di foto non si legge",
      formatNote: "JPEG, PNG o WebP — oppure fotografa il piatto.",
    },
  },
  es: {
    notePlaceholder: "¿Algo que no veo? Salchicha, no calabacín…",
    reading: "Leyendo el plato. Un momento para los números.",
    checking: "Revisando los números",
    close: "Cerrar",
    logged: "Registrado",
    today: "Hoy",
    waitingToSend: "Esperando para enviarse",
    noFood: "No hay comida en esta",
    tryAnotherPhoto: "Prueba otra foto",
    roughGuess: "Estimación aproximada",
    roughAsk: "¿Unos {grams} g de {item}?",
    roughAbout: "Más o menos eso",
    roughHalf: "La mitad",
    roughMore: "Más bien {grams} g",
    roughSent: "Unos {grams} g de {item}",
    edit: "Editar",
    agree: "De acuerdo",
    firstVerdict: "Tu primer veredicto",
    correct: "Corregir",
    continueCta: "Continuar",
    analysisFailedNote: "No se registró nada. Tu foto se conserva.",
    unknownTitle: "Eso no terminó bien.",
    unknownNote: "Se conserva y se reenvía solo — reenviarlo es seguro.",
    verdictDetail: "Para una comida es mucho: {noun} {amount} de {target} g. Ve con calma el resto del día.",
    dayEaten: "{eaten} de {plan} kcal",
    dayLeft: "quedan {left}",
    web: {
      title: "Una foto de la comida",
      dropHint: "Suelta una foto aquí",
      chooseFile: "o elige un archivo · JPEG, PNG o WebP",
      analyzeCta: "Analizar",
      chatInstead: "o cuéntaselo a {coach} en Chat",
      fromPhoto: "de una foto",
      failedTitle: "El análisis no volvió.",
      sendAgain: "Enviarla de nuevo",
    },
    phone: {
      cameraTitle: "Una comida, desde cualquier ángulo",
      cameraHint: "Una segunda toma de lado ayuda con las porciones",
      shotCount: "{n} de {total}",
      analyzeCta: "Analizar",
      pickTitle: "Elige una foto",
      pickHint: "Cualquier ángulo de la misma comida",
      cameraOffTitle: "El acceso a la cámara está desactivado",
      cameraOffNote: "Actívalo en Ajustes, o elige una foto que ya hayas hecho.",
      pickLibrary: "Elegir de la biblioteca",
      refusedTitle: "No se pudo registrar",
      failedTitle: "El análisis no volvió",
      tryAgain: "Reintentar",
      formatTitle: "Ese formato de foto no se puede leer",
      formatNote: "JPEG, PNG o WebP — o fotografía el plato.",
    },
  },
  vi: {
    notePlaceholder: "Có gì tôi không nhìn thấy không? Xúc xích, không phải bí ngòi…",
    reading: "Đang đọc đĩa ăn. Một lát cho các con số.",
    checking: "Đang kiểm tra các con số",
    close: "Đóng",
    logged: "Đã ghi",
    today: "Hôm nay",
    waitingToSend: "Đang chờ gửi",
    noFood: "Không có đồ ăn trong ảnh này",
    tryAnotherPhoto: "Thử ảnh khác",
    roughGuess: "Ước lượng thô",
    roughAsk: "{item} khoảng {grams} g đúng không?",
    roughAbout: "Khoảng đó",
    roughHalf: "Chỉ một nửa",
    roughMore: "Gần {grams} g hơn",
    roughSent: "{item} khoảng {grams} g",
    edit: "Sửa",
    agree: "Đồng ý",
    firstVerdict: "Phán quyết đầu tiên của bạn",
    correct: "Điều chỉnh",
    continueCta: "Tiếp tục",
    analysisFailedNote: "Chưa ghi gì. Ảnh của bạn vẫn được giữ.",
    unknownTitle: "Lần đó chưa hoàn tất trọn vẹn.",
    unknownNote: "Đã giữ lại và tự gửi lại — gửi lại vẫn an toàn.",
    verdictDetail: "{noun} cao cho một bữa: {amount} trong {target} g của bạn. Hãy nhẹ tay phần còn lại của hôm nay.",
    dayEaten: "{eaten} trên {plan} kcal",
    dayLeft: "còn {left}",
    web: {
      title: "Ảnh chụp bữa ăn",
      dropHint: "Thả ảnh vào đây",
      chooseFile: "hoặc chọn tệp · JPEG, PNG hoặc WebP",
      analyzeCta: "Phân tích",
      chatInstead: "hoặc kể cho {coach} trong Chat",
      fromPhoto: "từ ảnh",
      failedTitle: "Phân tích không trả về.",
      sendAgain: "Gửi lại",
    },
    phone: {
      cameraTitle: "Một bữa ăn, góc nào cũng được",
      cameraHint: "Thêm một kiểu chụp từ bên cạnh giúp đo khẩu phần",
      shotCount: "{n} trên {total}",
      analyzeCta: "Phân tích",
      pickTitle: "Chọn ảnh",
      pickHint: "Chọn ảnh cùng một bữa ở góc nào cũng được",
      cameraOffTitle: "Quyền truy cập camera đang tắt",
      cameraOffNote: "Bật nó trong Cài đặt, hoặc chọn ảnh bạn đã chụp sẵn.",
      pickLibrary: "Chọn từ thư viện",
      refusedTitle: "Không ghi được món đó",
      failedTitle: "Phân tích không trả về",
      tryAgain: "Thử lại",
      formatTitle: "Định dạng ảnh đó không đọc được",
      formatNote: "JPEG, PNG hoặc WebP — hoặc chụp đĩa ăn.",
    },
  },
  id: {
    notePlaceholder: "Ada yang tidak terlihat? Sosis, bukan zukini…",
    reading: "Membaca piringnya. Sebentar untuk angkanya.",
    checking: "Memeriksa angka",
    close: "Tutup",
    logged: "Tercatat",
    today: "Hari ini",
    waitingToSend: "Menunggu untuk dikirim",
    noFood: "Tidak ada makanan di yang ini",
    tryAnotherPhoto: "Coba foto lain",
    roughGuess: "Perkiraan kasar",
    roughAsk: "Apakah {item} sekitar {grams} g?",
    roughAbout: "Kira-kira segitu",
    roughHalf: "Setengahnya saja",
    roughMore: "Lebih ke {grams} g",
    roughSent: "{item} sekitar {grams} g",
    edit: "Ubah",
    agree: "Setuju",
    firstVerdict: "Penilaian pertamamu",
    correct: "Koreksi",
    continueCta: "Lanjut",
    analysisFailedNote: "Tidak ada yang tercatat. Fotomu tetap disimpan.",
    unknownTitle: "Yang tadi tidak selesai dengan bersih.",
    unknownNote: "Disimpan, dan dikirim ulang sendiri — mengirim ulang aman.",
    verdictDetail: "{noun} tinggi untuk satu kali makan: {amount} dari {target} g milikmu. Ringankan sisa hari ini.",
    dayEaten: "{eaten} dari {plan} kcal",
    dayLeft: "sisa {left}",
    web: {
      title: "Foto makanannya",
      dropHint: "Taruh foto di sini",
      chooseFile: "atau pilih berkas · JPEG, PNG atau WebP",
      analyzeCta: "Analisis",
      chatInstead: "atau ceritakan ke {coach} di Chat",
      fromPhoto: "dari foto",
      failedTitle: "Analisisnya tidak kembali.",
      sendAgain: "Kirim lagi",
    },
    phone: {
      cameraTitle: "Satu kali makan, sudut mana pun",
      cameraHint: "Jepretan kedua dari samping membantu memperkirakan porsi",
      shotCount: "{n} dari {total}",
      analyzeCta: "Analisis",
      pickTitle: "Pilih foto",
      pickHint: "Sudut mana pun dari makanan yang sama",
      cameraOffTitle: "Akses kamera nonaktif",
      cameraOffNote: "Nyalakan di Pengaturan, atau pilih foto yang sudah kamu ambil.",
      pickLibrary: "Pilih dari galeri",
      refusedTitle: "Tidak bisa mencatat itu",
      failedTitle: "Analisisnya tidak kembali",
      tryAgain: "Coba lagi",
      formatTitle: "Format foto itu tidak bisa dibaca",
      formatNote: "JPEG, PNG atau WebP — atau foto piringnya saja.",
    },
  },
  ru: {
    notePlaceholder: "Чего я не вижу? Колбаса, а не кабачок…",
    reading: "Разбираю тарелку. Ещё мгновение — будут цифры.",
    checking: "Проверяю цифры",
    close: "Закрыть",
    logged: "Записано",
    today: "Сегодня",
    waitingToSend: "Ждёт отправки",
    noFood: "На этом фото еды нет",
    tryAnotherPhoto: "Попробовать другое фото",
    roughGuess: "Примерная оценка",
    roughAsk: "{item} — примерно {grams} г?",
    roughAbout: "Примерно столько",
    roughHalf: "Вдвое меньше",
    roughMore: "Скорее {grams} г",
    roughSent: "{item} — примерно {grams} г",
    edit: "Изменить",
    agree: "Подтвердить",
    firstVerdict: "Твой первый вердикт",
    correct: "Исправить",
    continueCta: "Продолжить",
    analysisFailedNote: "Ничего не записано. Фото сохранено.",
    unknownTitle: "Это не завершилось чисто.",
    unknownNote: "Сохранено и отправится само — повторная отправка безопасна.",
    verdictDetail: "Для одного приёма пищи это много: {noun} — {amount} из {target} г. Остаток дня — умереннее.",
    dayEaten: "{eaten} из {plan} ккал",
    dayLeft: "осталось {left}",
    web: {
      title: "Фото приёма пищи",
      dropHint: "Перетащи сюда фото",
      chooseFile: "или выбери файл · JPEG, PNG или WebP",
      analyzeCta: "Анализировать",
      chatInstead: "или расскажи {coach} об этом в Чате",
      fromPhoto: "по фото",
      failedTitle: "Анализ не вернулся.",
      sendAgain: "Отправить ещё раз",
    },
    phone: {
      cameraTitle: "Одно блюдо, любой ракурс",
      cameraHint: "Второй кадр сбоку помогает с порциями",
      shotCount: "{n} из {total}",
      analyzeCta: "Анализировать",
      pickTitle: "Выбрать фото",
      pickHint: "Любые ракурсы одного блюда",
      cameraOffTitle: "Доступ к камере выключен",
      cameraOffNote: "Включи его в Настройках или выбери уже снятое фото.",
      pickLibrary: "Выбрать из галереи",
      refusedTitle: "Не удалось записать",
      failedTitle: "Анализ не вернулся",
      tryAgain: "Ещё раз",
      formatTitle: "Этот формат фото не читается",
      formatNote: "JPEG, PNG или WebP — или сфотографируй блюдо.",
    },
  },
};

export const logCopyFor = (lang: Lang): LogCopy => t(lang)(LOG_COPY);
