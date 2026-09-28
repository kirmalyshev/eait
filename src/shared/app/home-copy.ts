// Home's words (#91 — W4, and M4 on the phone reads the same table): the streak chip, the kcal
// card and its left/eaten/over states, the macro cards in both their layouts, the meal list's
// title and flags, the empty and the couldn't-load days, the web's in-diary logging proposal and
// its composer, and the phone's month sheet.
//
// WHAT IS NOT HERE, and where it lives instead: the tab bar and the "Log a meal" FAB name are
// `shellCopyFor` (`app/shell-copy.ts`); the verdict words on a meal row ("calories high ·
// saturated fat high" — lowercased on the board) and on the proposal ("Calories on plan") are
// `verdictPillLabel`/`verdictNoun` (`verdicts.ts`); the kcal under a meal's figure is `UNIT_KCAL`;
// every number is `wholeNumbers`/`numbers`, every date and weekday and the picker's month are
// `Intl` off `LANG_TAG` — none of those are copy. `{coach}` is not needed on this surface: Home is
// where the boards still draw Spud (DIRECTION: the coach's Gabie rename covers Chat, not Home).
//
// THE {n} RULE: the boards draw a figure and its label as two elements ("368" over "kcal left",
// "55 g" over "Protein left"), so the LABEL is a string here and the figure is `wholeNumbers` —
// except `grams`, the "{n} g" the figure element itself needs, and the `· {eaten} of {plan}`
// detail forms, where the numbers ride inside the label and are placeholders like everywhere
// else. A figure that is not there yet — the diary-failed "—" — is the client's `—` fed through
// the same template, not a separate string.

import { t, type Localized } from "../lang.ts";
import type { Lang } from "../types.ts";

/** A macro with a target — the card carries left/over/ofTarget labels. */
export interface HomeTargetMacroCopy {
  /** The bare name — the compact card with no ring ("carbs" on the empty/failed boards). */
  name: string;
  /** "{Macro} left" — the ringed card's label under the figure (`today.html`). */
  left: string;
  /** "{Macro} over" — past its target, overseer's §F.6 default: muted ink, ring closed, never red. */
  over: string;
  /** "of {target} {macro}" — the compact card's label when a ring is drawn (empty/picker/logging boards). */
  ofTarget: string;
  /** "{macro} {n} g" — the named macro chip on the web proposal ("sat fat 3 g"). */
  chip: string;
}

/** A macro with no target (fibre, sugar) — a card shows a total, never a "left". */
export interface HomeMacroCopy {
  name: string;
  chip: string;
}

export interface HomeCopy {
  /** phone: the screen title over the week strip on today — `phone/today-empty` and friends. */
  phoneToday: string;
  /** phone: the streak chip's accessible name — `phone/today.html` draws `aria-label="4-day streak"`. */
  phoneStreakAria: string;
  /**
   * phone: Spud's one line under the meals — `phone/today-picker` draws it behind the sheet.
   * `{nutrient}` is the constraining macro's name as the sentence wants it (`verdictNoun`) and
   * `{grams}` its figure; the kcal-left figure is the card's alone — the line carries the advice
   * (#1000), so the day total is stated once on the screen. One fixed shape, not a lever the copy
   * picks per case.
   */
  phoneDayNote: string;
  /** phone: the month sheet's action — `phone/today-picker` "Go to Sunday 20"; `{day}` is Intl. */
  phoneGoToDay: string;
  /** phone: the month sheet's back arrow's accessible name. */
  pickerPrevMonth: string;
  /** phone: the month sheet's forward arrow's accessible name. */
  pickerNextMonth: string;
  /** phone: the month sheet's scrim's accessible name — the tap-outside dismissal. */
  pickerClose: string;
  /** phone: a marked day's accessible name in the sheet — `{day}` is `dayLabel`'s. */
  pickerDayLogged: string;
  /** phone: an empty day's accessible name in the sheet. */
  pickerDayUnlogged: string;
  /**
   * The guess hedge beside a figure (`today.html` "about 1,437" when the day holds a rough
   * estimate) — the analysis's own honesty, never the target's.
   */
  about: string;
  /** The kcal card's toggle label — `today.html` "kcal left ⌄" (the ⌄ is the client's glyph). */
  kcalLeft: string;
  /** The toggle's other side — the issue's "toggling to eaten". */
  kcalEaten: string;
  /** Past the plan — the boards' "kcal over", §F.6's `--bad`. */
  kcalOver: string;
  /** The compact card's label — the empty/past/picker/logging/failed boards' "· {eaten} of {plan}". */
  kcalLeftDetail: string;
  kcalEatenDetail: string;
  /** `today-past` — "kcal over · 1,812 of 1,434". */
  kcalOverDetail: string;
  /** A gram figure — the macro cards' "55 g" and "0 g", and "— g" when the diary did not load. */
  grams: string;
  /** A milligram figure — sodium is measured in mg (`sodium_mg`), so its card and chip read so. */
  milligrams: string;
  /** The macro cards, paged: protein/carbs/fat on one, saturated fat/fibre/sugar/sodium on two. */
  macros: {
    protein: HomeTargetMacroCopy;
    carbs: HomeTargetMacroCopy;
    fat: HomeTargetMacroCopy;
    /** Ring only when the user declared the marker; the words exist regardless. */
    satFat: HomeTargetMacroCopy;
    sodium: HomeTargetMacroCopy;
    /** No target — a card on page two carries a total and the name only. */
    fibre: HomeMacroCopy;
    sugar: HomeMacroCopy;
  };
  /** The meal list's title — `today.html` "Recently uploaded", both clients. */
  recentlyUploaded: string;
  /** A typed meal's tag on its row — "rough estimate". */
  roughEstimate: string;
  /** The empty day — the dashed card's line beside Spud, both clients. */
  nothingLogged: string;
  /** `states-diary-failed`, both clients — the card above "Try again". */
  diaryFailed: string;
  tryAgain: string;
  /** web: the logging CTA — `web/today.html` and `web/today-empty`, opening W5's upload view. */
  webUploadPhoto: string;
  /** web: the in-diary composer — `web/today-logging`. Spud, not {coach}: Home keeps him. */
  webComposerPlaceholder: string;
  /**
   * web: the side column's landmark name (`aria-label`) — the week strip, the day's cards and
   * the composer sit in a labelled `<section>` beside `<main>` (#178).
   */
  webDayRegion: string;
  /**
   * web: the proposal's lead — `web/today-logging` "Logging to today — look right?". `{day}` is
   * `todayWord` for today or a formatted date for a past day the row sits on.
   */
  webProposalLead: string;
  /** `{day}` inside `webProposalLead` when the proposal lands on today. */
  todayWord: string;
  /** web: the proposal's accept — `web/today-logging`, the same words as Telegram's `tg.logIt`. */
  webLogIt: string;
  /** web: the proposal's decline. */
  webProposalNo: string;
  /**
   * The page dots' accessible name — the two-dot switcher under the macro cards
   * (`today.html`); `{page}` and `{total}` are figures.
   */
  webPage: string;
  /**
   * The score modal's close (`today-score`). Its words are `SCORES_APP_COPY`'s — `title`,
   * `outOf`, `breakdownTitle`, `breakdownLine`, `todayFromMeals` — which #151 left Lingui-free;
   * only this one key is Home's own.
   */
  webDone: string;
}

export const HOME_COPY: Localized<HomeCopy> = {
  en: {
    phoneToday: "Today",
    phoneStreakAria: "{n}-day streak",
    phoneDayNote: "Keep dinner lean: {grams} g of {nutrient} to go.",
    phoneGoToDay: "Go to {day}",
    pickerPrevMonth: "Previous month",
    pickerNextMonth: "Next month",
    pickerClose: "Close",
    pickerDayLogged: "{day}, has meals",
    pickerDayUnlogged: "{day}, nothing logged",
    about: "about",
    kcalLeft: "kcal left",
    kcalEaten: "kcal eaten",
    kcalOver: "kcal over",
    kcalLeftDetail: "kcal left · {eaten} of {plan}",
    kcalEatenDetail: "kcal eaten · {eaten} of {plan}",
    kcalOverDetail: "kcal over · {eaten} of {plan}",
    grams: "{n} g",
    milligrams: "{n} mg",
    macros: {
      protein: { name: "protein", left: "Protein left", over: "Protein over", ofTarget: "of {target} protein", chip: "protein {n} g" },
      carbs: { name: "carbs", left: "Carbs left", over: "Carbs over", ofTarget: "of {target} carbs", chip: "carbs {n} g" },
      fat: { name: "fat", left: "Fat left", over: "Fat over", ofTarget: "of {target} fat", chip: "fat {n} g" },
      satFat: { name: "sat fat", left: "Sat fat left", over: "Sat fat over", ofTarget: "of {target} sat fat", chip: "sat fat {n} g" },
      sodium: { name: "Sodium", left: "Sodium left", over: "Sodium over", ofTarget: "of {target} sodium", chip: "sodium {n} mg" },
      fibre: { name: "Fibre", chip: "fibre {n} g" },
      sugar: { name: "Sugar", chip: "sugar {n} g" },
    },
    recentlyUploaded: "Recently uploaded",
    roughEstimate: "rough estimate",
    nothingLogged: "Nothing logged yet.",
    diaryFailed: "Couldn't load your diary.",
    tryAgain: "Try again",
    webUploadPhoto: "Upload a photo",
    webComposerPlaceholder: "Tell Spud what you ate, or drop a photo",
    webDayRegion: "Day summary",
    webProposalLead: "Logging to {day} — look right?",
    todayWord: "today",
    webLogIt: "Log it",
    webProposalNo: "No",
    webPage: "Page {n} of {total}",
    webDone: "Done",
  },
  fr: {
    phoneToday: "Aujourd'hui",
    phoneStreakAria: "Série de {n} jours",
    phoneDayNote: "Dîner léger : encore {grams} g de {nutrient}.",
    phoneGoToDay: "Aller au {day}",
    pickerPrevMonth: "Mois précédent",
    pickerNextMonth: "Mois suivant",
    pickerClose: "Fermer",
    pickerDayLogged: "{day}, repas notés",
    pickerDayUnlogged: "{day}, rien de noté",
    about: "environ",
    kcalLeft: "kcal restantes",
    kcalEaten: "kcal consommées",
    kcalOver: "kcal en trop",
    kcalLeftDetail: "kcal restantes · {eaten} sur {plan}",
    kcalEatenDetail: "kcal consommées · {eaten} sur {plan}",
    kcalOverDetail: "kcal en trop · {eaten} sur {plan}",
    grams: "{n} g",
    milligrams: "{n} mg",
    macros: {
      protein: { name: "protéines", left: "Protéines restantes", over: "Protéines en trop", ofTarget: "protéines sur {target}", chip: "protéines {n} g" },
      carbs: { name: "glucides", left: "Glucides restants", over: "Glucides en trop", ofTarget: "glucides sur {target}", chip: "glucides {n} g" },
      fat: { name: "lipides", left: "Lipides restants", over: "Lipides en trop", ofTarget: "lipides sur {target}", chip: "lipides {n} g" },
      satFat: { name: "graisses saturées", left: "Gras sat. restants", over: "Gras sat. en trop", ofTarget: "graisses saturées sur {target}", chip: "graisses saturées {n} g" },
      sodium: { name: "Sodium", left: "Sodium restant", over: "Sodium en trop", ofTarget: "sodium sur {target}", chip: "sodium {n} mg" },
      fibre: { name: "Fibres", chip: "fibres {n} g" },
      sugar: { name: "Sucres", chip: "sucres {n} g" },
    },
    recentlyUploaded: "Récemment ajoutés",
    roughEstimate: "estimation approximative",
    nothingLogged: "Rien d'enregistré pour l'instant.",
    diaryFailed: "Impossible de charger ton journal.",
    tryAgain: "Réessayer",
    webUploadPhoto: "Envoyer une photo",
    webComposerPlaceholder: "Dis à Spud ce que tu as mangé, ou dépose une photo",
    webDayRegion: "Résumé du jour",
    webProposalLead: "J'enregistre pour {day} — ça te va ?",
    todayWord: "aujourd'hui",
    webLogIt: "Enregistrer",
    webProposalNo: "Non",
    webPage: "Page {n} sur {total}",
    webDone: "Terminé",
  },
  de: {
    phoneToday: "Heute",
    phoneStreakAria: "{n} Tage in Folge",
    phoneDayNote: "Halte das Abendessen leicht: {nutrient} — noch {grams} g.",
    phoneGoToDay: "Zu {day} springen",
    pickerPrevMonth: "Vorheriger Monat",
    pickerNextMonth: "Nächster Monat",
    pickerClose: "Schließen",
    pickerDayLogged: "{day}, Mahlzeiten erfasst",
    pickerDayUnlogged: "{day}, nichts erfasst",
    about: "etwa",
    kcalLeft: "kcal übrig",
    kcalEaten: "kcal gegessen",
    kcalOver: "kcal zu viel",
    kcalLeftDetail: "kcal übrig · {eaten} von {plan}",
    kcalEatenDetail: "kcal gegessen · {eaten} von {plan}",
    kcalOverDetail: "kcal zu viel · {eaten} von {plan}",
    grams: "{n} g",
    milligrams: "{n} mg",
    macros: {
      protein: { name: "Eiweiß", left: "Eiweiß übrig", over: "Eiweiß zu viel", ofTarget: "Eiweiß von {target}", chip: "Eiweiß {n} g" },
      carbs: { name: "Kohlenhydrate", left: "Kohlenhydrate übrig", over: "Kohlenhydrate zu viel", ofTarget: "Kohlenhydrate von {target}", chip: "Kohlenhydrate {n} g" },
      fat: { name: "Fett", left: "Fett übrig", over: "Fett zu viel", ofTarget: "Fett von {target}", chip: "Fett {n} g" },
      satFat: { name: "gesättigte Fette", left: "Ges. Fette übrig", over: "Ges. Fette zu viel", ofTarget: "gesättigte Fette von {target}", chip: "gesättigte Fette {n} g" },
      sodium: { name: "Natrium", left: "Natrium übrig", over: "Natrium zu viel", ofTarget: "Natrium von {target}", chip: "Natrium {n} mg" },
      fibre: { name: "Ballaststoffe", chip: "Ballaststoffe {n} g" },
      sugar: { name: "Zucker", chip: "Zucker {n} g" },
    },
    recentlyUploaded: "Zuletzt hochgeladen",
    roughEstimate: "grobe Schätzung",
    nothingLogged: "Noch nichts eingetragen.",
    diaryFailed: "Dein Tagebuch ließ sich nicht laden.",
    tryAgain: "Erneut versuchen",
    webUploadPhoto: "Foto hochladen",
    webComposerPlaceholder: "Sag Spud, was du gegessen hast, oder leg ein Foto hier ab",
    webDayRegion: "Tagesübersicht",
    webProposalLead: "Ich trage das für {day} ein — passt das?",
    todayWord: "heute",
    webLogIt: "Eintragen",
    webProposalNo: "Nein",
    webPage: "Seite {n} von {total}",
    webDone: "Fertig",
  },
  it: {
    phoneToday: "Oggi",
    phoneStreakAria: "Serie di {n} giorni",
    phoneDayNote: "Cena leggera: ancora {grams} g di {nutrient}.",
    phoneGoToDay: "Vai a {day}",
    pickerPrevMonth: "Mese precedente",
    pickerNextMonth: "Mese successivo",
    pickerClose: "Chiudi",
    pickerDayLogged: "{day}, pasti registrati",
    pickerDayUnlogged: "{day}, niente registrato",
    about: "circa",
    kcalLeft: "kcal rimaste",
    kcalEaten: "kcal mangiate",
    kcalOver: "kcal in più",
    kcalLeftDetail: "kcal rimaste · {eaten} di {plan}",
    kcalEatenDetail: "kcal mangiate · {eaten} di {plan}",
    kcalOverDetail: "kcal in più · {eaten} di {plan}",
    grams: "{n} g",
    milligrams: "{n} mg",
    macros: {
      protein: { name: "proteine", left: "Proteine rimaste", over: "Proteine in eccesso", ofTarget: "proteine su {target}", chip: "proteine {n} g" },
      carbs: { name: "carboidrati", left: "Carboidrati rimasti", over: "Carboidrati in eccesso", ofTarget: "carboidrati su {target}", chip: "carboidrati {n} g" },
      fat: { name: "grassi", left: "Grassi rimasti", over: "Grassi in eccesso", ofTarget: "grassi su {target}", chip: "grassi {n} g" },
      satFat: { name: "grassi saturi", left: "Grassi sat. rimasti", over: "Grassi sat. in eccesso", ofTarget: "grassi saturi su {target}", chip: "grassi saturi {n} g" },
      sodium: { name: "Sodio", left: "Sodio rimasto", over: "Sodio in eccesso", ofTarget: "sodio su {target}", chip: "sodio {n} mg" },
      fibre: { name: "Fibre", chip: "fibre {n} g" },
      sugar: { name: "Zuccheri", chip: "zuccheri {n} g" },
    },
    recentlyUploaded: "Aggiunti di recente",
    roughEstimate: "stima approssimativa",
    nothingLogged: "Niente di registrato, per ora.",
    diaryFailed: "Non riesco a caricare il tuo diario.",
    tryAgain: "Riprova",
    webUploadPhoto: "Carica una foto",
    webComposerPlaceholder: "Di' a Spud cosa hai mangiato, o trascina una foto",
    webDayRegion: "Riepilogo del giorno",
    webProposalLead: "Lo registro per {day} — torna?",
    todayWord: "oggi",
    webLogIt: "Registra",
    webProposalNo: "No",
    webPage: "Pagina {n} di {total}",
    webDone: "Fatto",
  },
  es: {
    phoneToday: "Hoy",
    phoneStreakAria: "Racha de {n} días",
    phoneDayNote: "Cena ligera: quedan {grams} g de {nutrient}.",
    phoneGoToDay: "Ir a {day}",
    pickerPrevMonth: "Mes anterior",
    pickerNextMonth: "Mes siguiente",
    pickerClose: "Cerrar",
    pickerDayLogged: "{day}, con comidas",
    pickerDayUnlogged: "{day}, sin registros",
    about: "unas",
    kcalLeft: "kcal restantes",
    kcalEaten: "kcal comidas",
    kcalOver: "kcal de más",
    kcalLeftDetail: "kcal restantes · {eaten} de {plan}",
    kcalEatenDetail: "kcal comidas · {eaten} de {plan}",
    kcalOverDetail: "kcal de más · {eaten} de {plan}",
    grams: "{n} g",
    milligrams: "{n} mg",
    macros: {
      protein: { name: "proteína", left: "Proteína restante", over: "Proteína de más", ofTarget: "proteína de {target}", chip: "proteína {n} g" },
      carbs: { name: "carbohidratos", left: "Carbohidratos restantes", over: "Carbohidratos de más", ofTarget: "carbohidratos de {target}", chip: "carbohidratos {n} g" },
      fat: { name: "grasas", left: "Grasas restantes", over: "Grasas de más", ofTarget: "grasas de {target}", chip: "grasas {n} g" },
      satFat: { name: "grasas saturadas", left: "Grasas sat. restantes", over: "Grasas sat. de más", ofTarget: "grasas saturadas de {target}", chip: "grasas saturadas {n} g" },
      sodium: { name: "Sodio", left: "Sodio restante", over: "Sodio de más", ofTarget: "sodio de {target}", chip: "sodio {n} mg" },
      fibre: { name: "Fibra", chip: "fibra {n} g" },
      sugar: { name: "Azúcar", chip: "azúcar {n} g" },
    },
    recentlyUploaded: "Subidos recientemente",
    roughEstimate: "estimación aproximada",
    nothingLogged: "Nada registrado todavía.",
    diaryFailed: "No se pudo cargar tu diario.",
    tryAgain: "Reintentar",
    webUploadPhoto: "Subir una foto",
    webComposerPlaceholder: "Dile a Spud qué comiste, o suelta una foto",
    webDayRegion: "Resumen del día",
    webProposalLead: "Lo registro para {day} — ¿te cuadra?",
    todayWord: "hoy",
    webLogIt: "Registrar",
    webProposalNo: "No",
    webPage: "Página {n} de {total}",
    webDone: "Listo",
  },
  vi: {
    phoneToday: "Hôm nay",
    phoneStreakAria: "Chuỗi {n} ngày",
    phoneDayNote: "Ăn tối nhẹ thôi: còn {grams} g {nutrient}.",
    phoneGoToDay: "Đến {day}",
    pickerPrevMonth: "Tháng trước",
    pickerNextMonth: "Tháng sau",
    pickerClose: "Đóng",
    pickerDayLogged: "{day}, đã ghi bữa ăn",
    pickerDayUnlogged: "{day}, chưa ghi gì",
    about: "khoảng",
    kcalLeft: "kcal còn lại",
    kcalEaten: "kcal đã ăn",
    kcalOver: "kcal vượt quá",
    kcalLeftDetail: "kcal còn lại · {eaten} trên {plan}",
    kcalEatenDetail: "kcal đã ăn · {eaten} trên {plan}",
    kcalOverDetail: "kcal vượt quá · {eaten} trên {plan}",
    grams: "{n} g",
    milligrams: "{n} mg",
    macros: {
      protein: { name: "đạm", left: "Đạm còn lại", over: "Đạm vượt quá", ofTarget: "trong {target} đạm", chip: "đạm {n} g" },
      carbs: { name: "bột đường", left: "Bột đường còn lại", over: "Bột đường vượt quá", ofTarget: "trong {target} bột đường", chip: "bột đường {n} g" },
      fat: { name: "chất béo", left: "Chất béo còn lại", over: "Chất béo vượt quá", ofTarget: "trong {target} chất béo", chip: "chất béo {n} g" },
      satFat: { name: "chất béo bão hoà", left: "Béo bão hoà còn lại", over: "Béo bão hoà vượt quá", ofTarget: "trong {target} chất béo bão hoà", chip: "chất béo bão hoà {n} g" },
      sodium: { name: "Natri", left: "Natri còn lại", over: "Natri vượt quá", ofTarget: "trong {target} natri", chip: "natri {n} mg" },
      fibre: { name: "Chất xơ", chip: "chất xơ {n} g" },
      sugar: { name: "Đường", chip: "đường {n} g" },
    },
    recentlyUploaded: "Mới tải lên",
    roughEstimate: "ước tính sơ bộ",
    nothingLogged: "Chưa có gì được ghi.",
    diaryFailed: "Không tải được nhật ký của bạn.",
    tryAgain: "Thử lại",
    webUploadPhoto: "Tải ảnh lên",
    webComposerPlaceholder: "Kể cho Spud bạn đã ăn gì, hoặc thả một bức ảnh vào",
    webDayRegion: "Tóm tắt trong ngày",
    webProposalLead: "Ghi vào {day} — đúng không?",
    todayWord: "hôm nay",
    webLogIt: "Ghi lại",
    webProposalNo: "Không",
    webPage: "Trang {n} trên {total}",
    webDone: "Xong",
  },
  id: {
    phoneToday: "Hari ini",
    phoneStreakAria: "Rangkaian {n} hari",
    phoneDayNote: "Makan malam yang ringan: tersisa {grams} g {nutrient}.",
    phoneGoToDay: "Ke {day}",
    pickerPrevMonth: "Bulan sebelumnya",
    pickerNextMonth: "Bulan berikutnya",
    pickerClose: "Tutup",
    pickerDayLogged: "{day}, ada catatan makan",
    pickerDayUnlogged: "{day}, belum ada catatan",
    about: "sekitar",
    kcalLeft: "kcal tersisa",
    kcalEaten: "kcal dimakan",
    kcalOver: "kcal berlebih",
    kcalLeftDetail: "kcal tersisa · {eaten} dari {plan}",
    kcalEatenDetail: "kcal dimakan · {eaten} dari {plan}",
    kcalOverDetail: "kcal berlebih · {eaten} dari {plan}",
    grams: "{n} g",
    milligrams: "{n} mg",
    macros: {
      protein: { name: "protein", left: "Protein tersisa", over: "Protein berlebih", ofTarget: "protein dari {target}", chip: "protein {n} g" },
      carbs: { name: "karbohidrat", left: "Karbohidrat tersisa", over: "Karbohidrat berlebih", ofTarget: "karbohidrat dari {target}", chip: "karbohidrat {n} g" },
      fat: { name: "lemak", left: "Lemak tersisa", over: "Lemak berlebih", ofTarget: "lemak dari {target}", chip: "lemak {n} g" },
      satFat: { name: "lemak jenuh", left: "Lemak jenuh tersisa", over: "Lemak jenuh berlebih", ofTarget: "lemak jenuh dari {target}", chip: "lemak jenuh {n} g" },
      sodium: { name: "Natrium", left: "Natrium tersisa", over: "Natrium berlebih", ofTarget: "natrium dari {target}", chip: "natrium {n} mg" },
      fibre: { name: "Serat", chip: "serat {n} g" },
      sugar: { name: "Gula", chip: "gula {n} g" },
    },
    recentlyUploaded: "Baru diunggah",
    roughEstimate: "perkiraan kasar",
    nothingLogged: "Belum ada yang dicatat.",
    diaryFailed: "Tidak bisa memuat diarimu.",
    tryAgain: "Coba lagi",
    webUploadPhoto: "Unggah foto",
    webComposerPlaceholder: "Beri tahu Spud apa yang kamu makan, atau taruh foto di sini",
    webDayRegion: "Ringkasan hari ini",
    webProposalLead: "Mencatat untuk {day} — sudah benar?",
    todayWord: "hari ini",
    webLogIt: "Catat",
    webProposalNo: "Tidak",
    webPage: "Halaman {n} dari {total}",
    webDone: "Selesai",
  },
  ru: {
    phoneToday: "Сегодня",
    phoneStreakAria: "Серия: {n} дн.",
    phoneDayNote: "На ужин — полегче: {nutrient}, ещё {grams} г.",
    phoneGoToDay: "Открыть {day}",
    pickerPrevMonth: "Предыдущий месяц",
    pickerNextMonth: "Следующий месяц",
    pickerClose: "Закрыть",
    pickerDayLogged: "{day}, записаны приёмы пищи",
    pickerDayUnlogged: "{day}, ничего не записано",
    about: "около",
    kcalLeft: "ккал осталось",
    kcalEaten: "ккал съедено",
    kcalOver: "ккал сверх плана",
    kcalLeftDetail: "ккал осталось · {eaten} из {plan}",
    kcalEatenDetail: "ккал съедено · {eaten} из {plan}",
    kcalOverDetail: "ккал сверх плана · {eaten} из {plan}",
    grams: "{n} г",
    milligrams: "{n} мг",
    macros: {
      protein: { name: "белки", left: "Белков осталось", over: "Белков больше нормы", ofTarget: "белков из {target}", chip: "белки {n} г" },
      carbs: { name: "углеводы", left: "Углеводов осталось", over: "Углеводов больше нормы", ofTarget: "углеводов из {target}", chip: "углеводы {n} г" },
      fat: { name: "жиры", left: "Жиров осталось", over: "Жиров больше нормы", ofTarget: "жиров из {target}", chip: "жиры {n} г" },
      satFat: { name: "нас. жиры", left: "Нас. жиров осталось", over: "Нас. жиров больше нормы", ofTarget: "насыщенных жиров из {target}", chip: "нас. жиры {n} г" },
      sodium: { name: "Натрий", left: "Натрия осталось", over: "Натрия больше нормы", ofTarget: "натрия из {target}", chip: "натрий {n} мг" },
      fibre: { name: "Клетчатка", chip: "клетчатка {n} г" },
      sugar: { name: "Сахар", chip: "сахар {n} г" },
    },
    recentlyUploaded: "Недавно добавлено",
    roughEstimate: "грубая оценка",
    nothingLogged: "Пока ничего не записано.",
    diaryFailed: "Не удалось загрузить дневник.",
    tryAgain: "Повторить",
    webUploadPhoto: "Загрузить фото",
    webComposerPlaceholder: "Расскажи Spud, что было на тарелке, или перетащи фото",
    webDayRegion: "Итоги дня",
    webProposalLead: "Записываю на {day} — всё верно?",
    todayWord: "сегодня",
    webLogIt: "Записать",
    webProposalNo: "Нет",
    webPage: "Страница {n} из {total}",
    webDone: "Готово",
  },
};

export const homeCopyFor = (lang: Lang): HomeCopy => t(lang)(HOME_COPY);
