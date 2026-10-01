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
// where the boards still draw Spud — and since #1041 the coach IS Spud, so the names agree.
//
// THE {n} RULE: the boards draw a figure and its label as two elements ("368" over "kcal left",
// "55 g" over "Protein left"), so the LABEL is a string here and the figure is `wholeNumbers` —
// except `grams`, the "{n} g" the figure element itself needs, and the `· {eaten} of {plan}`
// detail forms, where the numbers ride inside the label and are placeholders like everywhere
// else. A figure that is not there yet — the diary-failed "—" — is the client's `—` fed through
// the same template, not a separate string.

import { fill, t, type Localized } from "../lang.ts";
import type { Lang } from "../types.ts";

/** One tip branch's two lines — the Callout's title and its second line (F, ieat-app#1291). */
export interface MacroTipLine {
  /** The Callout's first line — "Protein: {g} to go". `{g}` is the row's own figure. */
  title: string;
  /** What the number means for the rest of today. */
  body: string;
}

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
  /** What a long press on the week strip does — the month sheet, named for VoiceOver and the web's calendar button. */
  pickDay: string;
  /** phone: a marked day's accessible name in the sheet — `{day}` is `dayLabel`'s. */
  pickerDayLogged: string;
  /** phone: an empty day's accessible name in the sheet. */
  pickerDayUnlogged: string;
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
  /**
   * The F bar row's figure line under the target — "{grams} left" (`web/today*.html`,
   * `phone/today*.html`). The row splits the template at `{grams}` so the figure keeps its weight
   * and the word stays light; `{grams}` is the formatted "{n} g" / "{n} mg" figure, and the word
   * agrees with the grams, not the macro (grammes are masculine plural where the language inflects).
   */
  gramLeft: string;
  /** The same figure line past the target — "{grams} over". */
  gramOver: string;
  /**
   * The day note's `{nutrient}` for the saturated-fat constraint — the sentence noun
   * ("saturated fat"), not the card's short name ("sat fat"). Protein/carbs read their
   * `name` as-is. The verdicts' inline noun says the same thing through the Lingui catalog,
   * which the browser bundle may not reach — this is the surface's own copy of the word.
   */
  dayNoteSatFat: string;

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
  /** The meal list's title — `today.html` "Recent", both clients. */
  recentlyUploaded: string;
  /** The macro tips (F, ieat-app#1291): a tapped protein/carbs/sat-fat row's Callout — the state
   * line, then what to eat or skip for the rest of today. `{g}` takes the row's own figure. */
  tips: {
    protein: { togo: MacroTipLine; reached: MacroTipLine; over: MacroTipLine };
    carbs: { left: MacroTipLine; over: MacroTipLine };
    satfat: { left: MacroTipLine; over: MacroTipLine };
  };
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
  /**
   * The photo queue (#1318, `log-queue-*`, both clients). Steps 2–4 arrive worded in the job's
   * `line`; step 1 is the client's own upload. `{kcal}`, `{time}` and `{n}` are figures.
   */
  queue: {
    uploading: string; waiting: string; notMeal: string; unread: string; nothingCounted: string;
    retake: string; remove: string; question: string; answer: string; dropTitle: string; dropSub: string;
    addedTitle: string; addedSub: string; beingRead: string; found: string;
  };
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
    pickDay: "Choose a day",
    pickerDayLogged: "{day}, has meals",
    pickerDayUnlogged: "{day}, nothing logged",
    kcalLeft: "kcal left",
    kcalEaten: "kcal eaten",
    kcalOver: "kcal over",
    kcalLeftDetail: "kcal left · {eaten} of {plan}",
    kcalEatenDetail: "kcal eaten · {eaten} of {plan}",
    kcalOverDetail: "kcal over · {eaten} of {plan}",
    grams: "{n} g",
    milligrams: "{n} mg",
    gramLeft: "{grams} left", gramOver: "{grams} over",
    dayNoteSatFat: "saturated fat",

    macros: {
      protein: { name: "protein", left: "Protein left", over: "Protein over", ofTarget: "of {target} protein", chip: "protein {n} g" },
      carbs: { name: "carbs", left: "Carbs left", over: "Carbs over", ofTarget: "of {target} carbs", chip: "carbs {n} g" },
      fat: { name: "fat", left: "Fat left", over: "Fat over", ofTarget: "of {target} fat", chip: "fat {n} g" },
      satFat: { name: "sat fat", left: "Sat fat left", over: "Sat fat over", ofTarget: "of {target} sat fat", chip: "sat fat {n} g" },
      sodium: { name: "Sodium", left: "Sodium left", over: "Sodium over", ofTarget: "of {target} sodium", chip: "sodium {n} mg" },
      fibre: { name: "Fibre", chip: "fibre {n} g" },
      sugar: { name: "Sugar", chip: "sugar {n} g" },
    },
    tips: {
      protein: {
        togo: { title: "Protein: {g} to go", body: "Add a protein source to your next meal: eggs, Greek yogurt, cottage cheese, chicken, fish, tofu or lentils." },
        reached: { title: "Protein: target reached", body: "That's today's protein. Anything more is optional." },
        over: { title: "Protein: over for today", body: "You've had enough protein today. Skip extra meat, fish, eggs and protein shakes until tomorrow." },
      },
      carbs: {
        left: { title: "Carbs: {g} left", body: "There's room for a small portion of bread, rice, pasta or fruit today." },
        over: { title: "Carbs: {g} over", body: "Limit carbs for the rest of today. Go easy on bread, rice, pasta, sweets and sweet drinks." },
      },
      satfat: {
        left: { title: "Sat fat: {g} left", body: "You're close to today's limit. Pick lean meat, fish or plant-based options." },
        over: { title: "Sat fat: {g} over the limit", body: "Limit butter, cheese, fatty meat, pastry and fried food for the rest of today." },
      },
    },
    recentlyUploaded: "Recent",


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
    queue: { uploading: "Uploading photo · 1 of 4", waiting: "Waiting for connection. It sends itself.", notMeal: "That doesn't look like a meal", unread: "Couldn't read this photo", nothingCounted: "Nothing was counted.", retake: "Retake", remove: "Remove", question: "Counted as ≈{kcal}. One detail would sharpen it.", answer: "Answer 1 question", dropTitle: "Drop a photo anywhere to log it", dropSub: "or paste one into the composer", addedTitle: "Added to your day", addedSub: "We'll count it. You can close the app.", beingRead: "{time} · being read, you can close the app", found: "Foods found: {n}" },
  },
  fr: {
    phoneToday: "Aujourd'hui",
    phoneStreakAria: "Série de {n} jours",
    phoneDayNote: "Dîner léger : encore {grams} g de {nutrient}.",
    phoneGoToDay: "Aller au {day}",
    pickerPrevMonth: "Mois précédent",
    pickerNextMonth: "Mois suivant",
    pickerClose: "Fermer",
    pickDay: "Choisir un jour",
    pickerDayLogged: "{day}, repas notés",
    pickerDayUnlogged: "{day}, rien de noté",
    kcalLeft: "kcal restantes",
    kcalEaten: "kcal consommées",
    kcalOver: "kcal en trop",
    kcalLeftDetail: "kcal restantes · {eaten} sur {plan}",
    kcalEatenDetail: "kcal consommées · {eaten} sur {plan}",
    kcalOverDetail: "kcal en trop · {eaten} sur {plan}",
    grams: "{n} g",
    milligrams: "{n} mg",
    gramLeft: "{grams} restants", gramOver: "{grams} en trop",
    dayNoteSatFat: "graisses saturées",

    macros: {
      protein: { name: "protéines", left: "Protéines restantes", over: "Protéines en trop", ofTarget: "protéines sur {target}", chip: "protéines {n} g" },
      carbs: { name: "glucides", left: "Glucides restants", over: "Glucides en trop", ofTarget: "glucides sur {target}", chip: "glucides {n} g" },
      fat: { name: "lipides", left: "Lipides restants", over: "Lipides en trop", ofTarget: "lipides sur {target}", chip: "lipides {n} g" },
      satFat: { name: "graisses saturées", left: "Gras sat. restants", over: "Gras sat. en trop", ofTarget: "graisses saturées sur {target}", chip: "graisses saturées {n} g" },
      sodium: { name: "Sodium", left: "Sodium restant", over: "Sodium en trop", ofTarget: "sodium sur {target}", chip: "sodium {n} mg" },
      fibre: { name: "Fibres", chip: "fibres {n} g" },
      sugar: { name: "Sucres", chip: "sucres {n} g" },
    },
    tips: {
      protein: {
        togo: { title: "Protéines : encore {g}", body: "Ajoute une source de protéines à ton prochain repas : œufs, yaourt grec, fromage blanc, poulet, poisson, tofu ou lentilles." },
        reached: { title: "Protéines : objectif atteint", body: "C'est ta protéine du jour. Tout supplément est facultatif." },
        over: { title: "Protéines : dépassé pour aujourd'hui", body: "Tu as eu assez de protéines aujourd'hui. Laisse de côté la viande, le poisson, les œufs et les shakes protéinés en plus jusqu'à demain." },
      },
      carbs: {
        left: { title: "Glucides : encore {g}", body: "Il y a de la place pour une petite portion de pain, de riz, de pâtes ou de fruit aujourd'hui." },
        over: { title: "Glucides : {g} en trop", body: "Limite les glucides pour le reste de la journée. Va doucement sur le pain, le riz, les pâtes, les sucreries et les boissons sucrées." },
      },
      satfat: {
        left: { title: "Graisses sat. : encore {g}", body: "Tu approches de la limite du jour. Choisis de la viande maigre, du poisson ou des options végétales." },
        over: { title: "Graisses sat. : {g} au-delà de la limite", body: "Limite le beurre, le fromage, la viande grasse, les viennoiseries et les fritures pour le reste de la journée." },
      },
    },
    recentlyUploaded: "Récents",


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
    queue: { uploading: "Envoi de la photo · 1 sur 4", waiting: "En attente de connexion. L'envoi se fera tout seul.", notMeal: "Ça ne ressemble pas à un repas", unread: "Impossible de lire cette photo", nothingCounted: "Rien n'a été compté.", retake: "Reprendre", remove: "Retirer", question: "Compté à ≈{kcal}. Un détail rendrait l'estimation plus juste.", answer: "Répondre à 1 question", dropTitle: "Déposez une photo n'importe où pour l'ajouter", dropSub: "ou collez-la dans le champ de saisie", addedTitle: "Ajouté à votre journée", addedSub: "On s'occupe du calcul. Vous pouvez fermer l'app.", beingRead: "{time} · en cours de lecture, vous pouvez fermer l'app", found: "Aliments trouvés : {n}" },
  },
  de: {
    phoneToday: "Heute",
    phoneStreakAria: "{n} Tage in Folge",
    phoneDayNote: "Halte das Abendessen leicht: {nutrient} — noch {grams} g.",
    phoneGoToDay: "Zu {day} springen",
    pickerPrevMonth: "Vorheriger Monat",
    pickerNextMonth: "Nächster Monat",
    pickerClose: "Schließen",
    pickDay: "Tag auswählen",
    pickerDayLogged: "{day}, Mahlzeiten erfasst",
    pickerDayUnlogged: "{day}, nichts erfasst",
    kcalLeft: "kcal übrig",
    kcalEaten: "kcal gegessen",
    kcalOver: "kcal zu viel",
    kcalLeftDetail: "kcal übrig · {eaten} von {plan}",
    kcalEatenDetail: "kcal gegessen · {eaten} von {plan}",
    kcalOverDetail: "kcal zu viel · {eaten} von {plan}",
    grams: "{n} g",
    milligrams: "{n} mg",
    gramLeft: "{grams} übrig", gramOver: "{grams} zu viel",
    dayNoteSatFat: "gesättigte Fette",

    macros: {
      protein: { name: "Eiweiß", left: "Eiweiß übrig", over: "Eiweiß zu viel", ofTarget: "Eiweiß von {target}", chip: "Eiweiß {n} g" },
      carbs: { name: "Kohlenhydrate", left: "Kohlenhydrate übrig", over: "Kohlenhydrate zu viel", ofTarget: "Kohlenhydrate von {target}", chip: "Kohlenhydrate {n} g" },
      fat: { name: "Fett", left: "Fett übrig", over: "Fett zu viel", ofTarget: "Fett von {target}", chip: "Fett {n} g" },
      satFat: { name: "gesättigte Fette", left: "Ges. Fette übrig", over: "Ges. Fette zu viel", ofTarget: "gesättigte Fette von {target}", chip: "gesättigte Fette {n} g" },
      sodium: { name: "Natrium", left: "Natrium übrig", over: "Natrium zu viel", ofTarget: "Natrium von {target}", chip: "Natrium {n} mg" },
      fibre: { name: "Ballaststoffe", chip: "Ballaststoffe {n} g" },
      sugar: { name: "Zucker", chip: "Zucker {n} g" },
    },
    tips: {
      protein: {
        togo: { title: "Eiweiß: noch {g}", body: "Bau eine Eiweißquelle in deine nächste Mahlzeit ein: Eier, griechischen Joghurt, Hüttenkäse, Hähnchen, Fisch, Tofu oder Linsen." },
        reached: { title: "Eiweiß: Ziel erreicht", body: "Das ist dein Eiweiß für heute. Alles darüber ist optional." },
        over: { title: "Eiweiß: zu viel für heute", body: "Du hattest heute genug Eiweiß. Lass extra Fleisch, Fisch, Eier und Proteinshakes bis morgen weg." },
      },
      carbs: {
        left: { title: "Kohlenhydrate: noch {g}", body: "Heute ist Platz für eine kleine Portion Brot, Reis, Nudeln oder Obst." },
        over: { title: "Kohlenhydrate: {g} zu viel", body: "Begrenze Kohlenhydrate für den Rest des Tages. Geh ruhig an Brot, Reis, Nudeln, Süßes und süße Getränke ran." },
      },
      satfat: {
        left: { title: "Ges. Fette: noch {g}", body: "Du bist nah am heutigen Limit. Nimm mageres Fleisch, Fisch oder pflanzliche Optionen." },
        over: { title: "Ges. Fette: {g} über dem Limit", body: "Begrenze Butter, Käse, fettes Fleisch, Gebäck und Frittiertes für den Rest des Tages." },
      },
    },
    recentlyUploaded: "Zuletzt",


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
    queue: { uploading: "Foto wird hochgeladen · 1 von 4", waiting: "Warte auf Verbindung. Es wird von selbst gesendet.", notMeal: "Das sieht nicht nach einer Mahlzeit aus", unread: "Dieses Foto ließ sich nicht lesen", nothingCounted: "Nichts wurde gezählt.", retake: "Neu aufnehmen", remove: "Entfernen", question: "Mit ≈{kcal} gezählt. Ein Detail würde es genauer machen.", answer: "1 Frage beantworten", dropTitle: "Foto irgendwo ablegen, um es einzutragen", dropSub: "oder ins Eingabefeld einfügen", addedTitle: "Zu deinem Tag hinzugefügt", addedSub: "Wir zählen es. Du kannst die App schließen.", beingRead: "{time} · wird gelesen, du kannst die App schließen", found: "Gefundene Lebensmittel: {n}" },
  },
  it: {
    phoneToday: "Oggi",
    phoneStreakAria: "Serie di {n} giorni",
    phoneDayNote: "Cena leggera: ancora {grams} g di {nutrient}.",
    phoneGoToDay: "Vai a {day}",
    pickerPrevMonth: "Mese precedente",
    pickerNextMonth: "Mese successivo",
    pickerClose: "Chiudi",
    pickDay: "Scegli un giorno",
    pickerDayLogged: "{day}, pasti registrati",
    pickerDayUnlogged: "{day}, niente registrato",
    kcalLeft: "kcal rimaste",
    kcalEaten: "kcal mangiate",
    kcalOver: "kcal in più",
    kcalLeftDetail: "kcal rimaste · {eaten} di {plan}",
    kcalEatenDetail: "kcal mangiate · {eaten} di {plan}",
    kcalOverDetail: "kcal in più · {eaten} di {plan}",
    grams: "{n} g",
    milligrams: "{n} mg",
    gramLeft: "{grams} rimasti", gramOver: "{grams} in eccesso",
    dayNoteSatFat: "grassi saturi",

    macros: {
      protein: { name: "proteine", left: "Proteine rimaste", over: "Proteine in eccesso", ofTarget: "proteine su {target}", chip: "proteine {n} g" },
      carbs: { name: "carboidrati", left: "Carboidrati rimasti", over: "Carboidrati in eccesso", ofTarget: "carboidrati su {target}", chip: "carboidrati {n} g" },
      fat: { name: "grassi", left: "Grassi rimasti", over: "Grassi in eccesso", ofTarget: "grassi su {target}", chip: "grassi {n} g" },
      satFat: { name: "grassi saturi", left: "Grassi sat. rimasti", over: "Grassi sat. in eccesso", ofTarget: "grassi saturi su {target}", chip: "grassi saturi {n} g" },
      sodium: { name: "Sodio", left: "Sodio rimasto", over: "Sodio in eccesso", ofTarget: "sodio su {target}", chip: "sodio {n} mg" },
      fibre: { name: "Fibre", chip: "fibre {n} g" },
      sugar: { name: "Zuccheri", chip: "zuccheri {n} g" },
    },
    tips: {
      protein: {
        togo: { title: "Proteine: ancora {g}", body: "Aggiungi una fonte di proteine al prossimo pasto: uova, yogurt greco, fiocchi di latte, pollo, pesce, tofu o lenticchie." },
        reached: { title: "Proteine: obiettivo raggiunto", body: "Queste sono le proteine di oggi. Il resto è facoltativo." },
        over: { title: "Proteine: oltre per oggi", body: "Hai avuto abbastanza proteine oggi. Salta carne, pesce, uova e frullati proteici in più fino a domani." },
      },
      carbs: {
        left: { title: "Carboidrati: ancora {g}", body: "C'è spazio per una piccola porzione di pane, riso, pasta o frutta oggi." },
        over: { title: "Carboidrati: {g} in più", body: "Limita i carboidrati per il resto della giornata. Vacci piano con pane, riso, pasta, dolci e bevande zuccherate." },
      },
      satfat: {
        left: { title: "Grassi sat.: ancora {g}", body: "Sei vicino al limite di oggi. Scegli carne magra, pesce o opzioni vegetali." },
        over: { title: "Grassi sat.: {g} oltre il limite", body: "Limita burro, formaggio, carne grassa, prodotti da forno e fritti per il resto della giornata." },
      },
    },
    recentlyUploaded: "Recenti",


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
    queue: { uploading: "Caricamento foto · 1 di 4", waiting: "In attesa di connessione. Si invia da sola.", notMeal: "Non sembra un pasto", unread: "Impossibile leggere questa foto", nothingCounted: "Non è stato contato nulla.", retake: "Rifai", remove: "Rimuovi", question: "Contato come ≈{kcal}. Un dettaglio lo renderebbe più preciso.", answer: "Rispondi a 1 domanda", dropTitle: "Trascina una foto ovunque per registrarla", dropSub: "o incollala nel campo di testo", addedTitle: "Aggiunto alla tua giornata", addedSub: "Lo contiamo noi. Puoi chiudere l'app.", beingRead: "{time} · in lettura, puoi chiudere l'app", found: "Cibi trovati: {n}" },
  },
  es: {
    phoneToday: "Hoy",
    phoneStreakAria: "Racha de {n} días",
    phoneDayNote: "Cena ligera: quedan {grams} g de {nutrient}.",
    phoneGoToDay: "Ir a {day}",
    pickerPrevMonth: "Mes anterior",
    pickerNextMonth: "Mes siguiente",
    pickerClose: "Cerrar",
    pickDay: "Elegir un día",
    pickerDayLogged: "{day}, con comidas",
    pickerDayUnlogged: "{day}, sin registros",
    kcalLeft: "kcal restantes",
    kcalEaten: "kcal comidas",
    kcalOver: "kcal de más",
    kcalLeftDetail: "kcal restantes · {eaten} de {plan}",
    kcalEatenDetail: "kcal comidas · {eaten} de {plan}",
    kcalOverDetail: "kcal de más · {eaten} de {plan}",
    grams: "{n} g",
    milligrams: "{n} mg",
    gramLeft: "{grams} restantes", gramOver: "{grams} de más",
    dayNoteSatFat: "grasas saturadas",

    macros: {
      protein: { name: "proteína", left: "Proteína restante", over: "Proteína de más", ofTarget: "proteína de {target}", chip: "proteína {n} g" },
      carbs: { name: "carbohidratos", left: "Carbohidratos restantes", over: "Carbohidratos de más", ofTarget: "carbohidratos de {target}", chip: "carbohidratos {n} g" },
      fat: { name: "grasas", left: "Grasas restantes", over: "Grasas de más", ofTarget: "grasas de {target}", chip: "grasas {n} g" },
      satFat: { name: "grasas saturadas", left: "Grasas sat. restantes", over: "Grasas sat. de más", ofTarget: "grasas saturadas de {target}", chip: "grasas saturadas {n} g" },
      sodium: { name: "Sodio", left: "Sodio restante", over: "Sodio de más", ofTarget: "sodio de {target}", chip: "sodio {n} mg" },
      fibre: { name: "Fibra", chip: "fibra {n} g" },
      sugar: { name: "Azúcar", chip: "azúcar {n} g" },
    },
    tips: {
      protein: {
        togo: { title: "Proteína: quedan {g}", body: "Añade una fuente de proteína a tu próxima comida: huevos, yogur griego, queso cottage, pollo, pescado, tofu o lentejas." },
        reached: { title: "Proteína: objetivo alcanzado", body: "Esa es la proteína de hoy. Todo lo demás es opcional." },
        over: { title: "Proteína: de más para hoy", body: "Ya has tomado suficiente proteína hoy. Deja la carne, el pescado, los huevos y los batidos de proteína extra hasta mañana." },
      },
      carbs: {
        left: { title: "Carbohidratos: quedan {g}", body: "Hoy hay espacio para una porción pequeña de pan, arroz, pasta o fruta." },
        over: { title: "Carbohidratos: {g} de más", body: "Limita los carbohidratos el resto del día. Ve con cuidado con el pan, el arroz, la pasta, los dulces y las bebidas azucaradas." },
      },
      satfat: {
        left: { title: "Grasas sat.: quedan {g}", body: "Estás cerca del límite de hoy. Elige carne magra, pescado u opciones vegetales." },
        over: { title: "Grasas sat.: {g} por encima del límite", body: "Limita la mantequilla, el queso, la carne grasa, la bollería y los fritos el resto del día." },
      },
    },
    recentlyUploaded: "Recientes",


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
    queue: { uploading: "Subiendo la foto · 1 de 4", waiting: "Esperando conexión. Se enviará sola.", notMeal: "Eso no parece una comida", unread: "No se pudo leer esta foto", nothingCounted: "No se contó nada.", retake: "Repetir", remove: "Quitar", question: "Contado como ≈{kcal}. Un detalle lo afinaría.", answer: "Responder 1 pregunta", dropTitle: "Suelta una foto en cualquier sitio para registrarla", dropSub: "o pégala en el cuadro de texto", addedTitle: "Añadido a tu día", addedSub: "Lo contamos nosotros. Puedes cerrar la app.", beingRead: "{time} · leyéndose, puedes cerrar la app", found: "Alimentos encontrados: {n}" },
  },
  vi: {
    phoneToday: "Hôm nay",
    phoneStreakAria: "Chuỗi {n} ngày",
    phoneDayNote: "Ăn tối nhẹ thôi: còn {grams} g {nutrient}.",
    phoneGoToDay: "Đến {day}",
    pickerPrevMonth: "Tháng trước",
    pickerNextMonth: "Tháng sau",
    pickerClose: "Đóng",
    pickDay: "Chọn ngày",
    pickerDayLogged: "{day}, đã ghi bữa ăn",
    pickerDayUnlogged: "{day}, chưa ghi gì",
    kcalLeft: "kcal còn lại",
    kcalEaten: "kcal đã ăn",
    kcalOver: "kcal vượt quá",
    kcalLeftDetail: "kcal còn lại · {eaten} trên {plan}",
    kcalEatenDetail: "kcal đã ăn · {eaten} trên {plan}",
    kcalOverDetail: "kcal vượt quá · {eaten} trên {plan}",
    grams: "{n} g",
    milligrams: "{n} mg",
    gramLeft: "{grams} còn lại", gramOver: "{grams} vượt quá",
    dayNoteSatFat: "chất béo bão hoà",

    macros: {
      protein: { name: "đạm", left: "Đạm còn lại", over: "Đạm vượt quá", ofTarget: "trong {target} đạm", chip: "đạm {n} g" },
      carbs: { name: "bột đường", left: "Bột đường còn lại", over: "Bột đường vượt quá", ofTarget: "trong {target} bột đường", chip: "bột đường {n} g" },
      fat: { name: "chất béo", left: "Chất béo còn lại", over: "Chất béo vượt quá", ofTarget: "trong {target} chất béo", chip: "chất béo {n} g" },
      satFat: { name: "chất béo bão hoà", left: "Béo bão hoà còn lại", over: "Béo bão hoà vượt quá", ofTarget: "trong {target} chất béo bão hoà", chip: "chất béo bão hoà {n} g" },
      sodium: { name: "Natri", left: "Natri còn lại", over: "Natri vượt quá", ofTarget: "trong {target} natri", chip: "natri {n} mg" },
      fibre: { name: "Chất xơ", chip: "chất xơ {n} g" },
      sugar: { name: "Đường", chip: "đường {n} g" },
    },
    tips: {
      protein: {
        togo: { title: "Đạm: còn {g}", body: "Thêm một nguồn đạm vào bữa kế tiếp: trứng, sữa chua Hy Lạp, phô mai tươi, thịt gà, cá, đậu phụ hoặc đậu lăng." },
        reached: { title: "Đạm: đã đủ mục tiêu", body: "Đó là lượng đạm của hôm nay. Thêm nữa là tuỳ bạn." },
        over: { title: "Đạm: vượt trong hôm nay", body: "Hôm nay bạn đã đủ đạm. Tạm bỏ thêm thịt, cá, trứng và sinh tố đạm tới ngày mai." },
      },
      carbs: {
        left: { title: "Bột đường: còn {g}", body: "Hôm nay vẫn còn chỗ cho một phần nhỏ bánh mì, cơm, mì hoặc trái cây." },
        over: { title: "Bột đường: vượt {g}", body: "Hạn chế bột đường cho phần còn lại của hôm nay. Đi nhẹ với bánh mì, cơm, mì, đồ ngọt và nước ngọt." },
      },
      satfat: {
        left: { title: "Béo bão hoà: còn {g}", body: "Bạn đang gần giới hạn của hôm nay. Chọn thịt nạc, cá hoặc món từ thực vật." },
        over: { title: "Béo bão hoà: vượt giới hạn {g}", body: "Hạn chế bơ, phô mai, thịt mỡ, bánh ngọt và đồ chiên cho phần còn lại của hôm nay." },
      },
    },
    recentlyUploaded: "Gần đây",


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
    queue: { uploading: "Đang tải ảnh lên · 1/4", waiting: "Đang chờ kết nối. Ảnh sẽ tự gửi.", notMeal: "Cái này trông không giống một bữa ăn", unread: "Không đọc được ảnh này", nothingCounted: "Chưa tính gì cả.", retake: "Chụp lại", remove: "Xoá", question: "Đã tính khoảng ≈{kcal}. Thêm một chi tiết sẽ chính xác hơn.", answer: "Trả lời 1 câu hỏi", dropTitle: "Thả ảnh vào bất kỳ đâu để ghi lại", dropSub: "hoặc dán vào ô soạn tin", addedTitle: "Đã thêm vào ngày của bạn", addedSub: "Mình sẽ tính. Bạn có thể đóng ứng dụng.", beingRead: "{time} · đang đọc, bạn có thể đóng ứng dụng", found: "Món tìm thấy: {n}" },
  },
  id: {
    phoneToday: "Hari ini",
    phoneStreakAria: "Rangkaian {n} hari",
    phoneDayNote: "Makan malam yang ringan: tersisa {grams} g {nutrient}.",
    phoneGoToDay: "Ke {day}",
    pickerPrevMonth: "Bulan sebelumnya",
    pickerNextMonth: "Bulan berikutnya",
    pickerClose: "Tutup",
    pickDay: "Pilih hari",
    pickerDayLogged: "{day}, ada catatan makan",
    pickerDayUnlogged: "{day}, belum ada catatan",
    kcalLeft: "kcal tersisa",
    kcalEaten: "kcal dimakan",
    kcalOver: "kcal berlebih",
    kcalLeftDetail: "kcal tersisa · {eaten} dari {plan}",
    kcalEatenDetail: "kcal dimakan · {eaten} dari {plan}",
    kcalOverDetail: "kcal berlebih · {eaten} dari {plan}",
    grams: "{n} g",
    milligrams: "{n} mg",
    gramLeft: "{grams} tersisa", gramOver: "{grams} berlebih",
    dayNoteSatFat: "lemak jenuh",

    macros: {
      protein: { name: "protein", left: "Protein tersisa", over: "Protein berlebih", ofTarget: "protein dari {target}", chip: "protein {n} g" },
      carbs: { name: "karbohidrat", left: "Karbohidrat tersisa", over: "Karbohidrat berlebih", ofTarget: "karbohidrat dari {target}", chip: "karbohidrat {n} g" },
      fat: { name: "lemak", left: "Lemak tersisa", over: "Lemak berlebih", ofTarget: "lemak dari {target}", chip: "lemak {n} g" },
      satFat: { name: "lemak jenuh", left: "Lemak jenuh tersisa", over: "Lemak jenuh berlebih", ofTarget: "lemak jenuh dari {target}", chip: "lemak jenuh {n} g" },
      sodium: { name: "Natrium", left: "Natrium tersisa", over: "Natrium berlebih", ofTarget: "natrium dari {target}", chip: "natrium {n} mg" },
      fibre: { name: "Serat", chip: "serat {n} g" },
      sugar: { name: "Gula", chip: "gula {n} g" },
    },
    tips: {
      protein: {
        togo: { title: "Protein: kurang {g}", body: "Tambahkan sumber protein ke santapan berikutnya: telur, yogurt Yunani, keju cottage, ayam, ikan, tahu, atau lentil." },
        reached: { title: "Protein: target tercapai", body: "Itu proteinmu untuk hari ini. Lebih dari itu opsional." },
        over: { title: "Protein: berlebih untuk hari ini", body: "Proteinmu hari ini sudah cukup. Lewati daging, ikan, telur, dan shake protein ekstra sampai besok." },
      },
      carbs: {
        left: { title: "Karbohidrat: sisa {g}", body: "Masih ada ruang untuk porsi kecil roti, nasi, pasta, atau buah hari ini." },
        over: { title: "Karbohidrat: {g} berlebih", body: "Batasi karbohidrat untuk sisa hari ini. Pelankan roti, nasi, pasta, makanan manis, dan minuman manis." },
      },
      satfat: {
        left: { title: "Lemak jenuh: sisa {g}", body: "Kamu mendekati batas hari ini. Pilih daging tanpa lemak, ikan, atau pilihan nabati." },
        over: { title: "Lemak jenuh: {g} di atas batas", body: "Batasi mentega, keju, daging berlemak, kue kering, dan gorengan untuk sisa hari ini." },
      },
    },
    recentlyUploaded: "Terbaru",


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
    queue: { uploading: "Mengunggah foto · 1 dari 4", waiting: "Menunggu koneksi. Akan terkirim sendiri.", notMeal: "Itu tidak terlihat seperti makanan", unread: "Foto ini tidak bisa dibaca", nothingCounted: "Tidak ada yang dihitung.", retake: "Foto ulang", remove: "Hapus", question: "Dihitung ≈{kcal}. Satu detail akan membuatnya lebih tepat.", answer: "Jawab 1 pertanyaan", dropTitle: "Letakkan foto di mana saja untuk mencatatnya", dropSub: "atau tempel di kolom pesan", addedTitle: "Ditambahkan ke harimu", addedSub: "Kami yang hitung. Kamu boleh menutup aplikasi.", beingRead: "{time} · sedang dibaca, kamu boleh menutup aplikasi", found: "Makanan ditemukan: {n}" },
  },
  ru: {
    phoneToday: "Сегодня",
    phoneStreakAria: "Серия: {n} дн.",
    phoneDayNote: "На ужин — полегче: {nutrient}, ещё {grams} г.",
    phoneGoToDay: "Открыть {day}",
    pickerPrevMonth: "Предыдущий месяц",
    pickerNextMonth: "Следующий месяц",
    pickerClose: "Закрыть",
    pickDay: "Выбрать день",
    pickerDayLogged: "{day}, записаны приёмы пищи",
    pickerDayUnlogged: "{day}, ничего не записано",
    kcalLeft: "ккал осталось",
    kcalEaten: "ккал съедено",
    kcalOver: "ккал сверх плана",
    kcalLeftDetail: "ккал осталось · {eaten} из {plan}",
    kcalEatenDetail: "ккал съедено · {eaten} из {plan}",
    kcalOverDetail: "ккал сверх плана · {eaten} из {plan}",
    grams: "{n} г",
    milligrams: "{n} мг",
    gramLeft: "{grams} осталось", gramOver: "{grams} сверх нормы",
    dayNoteSatFat: "насыщенные жиры",

    macros: {
      protein: { name: "белки", left: "Белков осталось", over: "Белков больше нормы", ofTarget: "белков из {target}", chip: "белки {n} г" },
      carbs: { name: "углеводы", left: "Углеводов осталось", over: "Углеводов больше нормы", ofTarget: "углеводов из {target}", chip: "углеводы {n} г" },
      fat: { name: "жиры", left: "Жиров осталось", over: "Жиров больше нормы", ofTarget: "жиров из {target}", chip: "жиры {n} г" },
      satFat: { name: "нас. жиры", left: "Нас. жиров осталось", over: "Нас. жиров больше нормы", ofTarget: "насыщенных жиров из {target}", chip: "нас. жиры {n} г" },
      sodium: { name: "Натрий", left: "Натрия осталось", over: "Натрия больше нормы", ofTarget: "натрия из {target}", chip: "натрий {n} мг" },
      fibre: { name: "Клетчатка", chip: "клетчатка {n} г" },
      sugar: { name: "Сахар", chip: "сахар {n} г" },
    },
    tips: {
      protein: {
        togo: { title: "Белок: осталось {g}", body: "Добавь источник белка к следующему приёму пищи: яйца, греческий йогурт, творог, курицу, рыбу, тофу или чечевицу." },
        reached: { title: "Белок: норма достигнута", body: "Это белок на сегодня. Больше — по желанию." },
        over: { title: "Белок: больше нормы на сегодня", body: "Белка сегодня уже достаточно. Пропусти лишнее мясо, рыбу, яйца и протеиновые коктейли до завтра." },
      },
      carbs: {
        left: { title: "Углеводы: осталось {g}", body: "Сегодня есть место для небольшой порции хлеба, риса, макарон или фруктов." },
        over: { title: "Углеводы: {g} сверх", body: "Ограничь углеводы до конца дня. Полегче с хлебом, рисом, макаронами, сладостями и сладкими напитками." },
      },
      satfat: {
        left: { title: "Нас. жиры: осталось {g}", body: "Предел на сегодня близко. Выбирай нежирное мясо, рыбу или растительные блюда." },
        over: { title: "Нас. жиры: {g} сверх предела", body: "Ограничь сливочное масло, сыр, жирное мясо, выпечку и жареное до конца дня." },
      },
    },
    recentlyUploaded: "Недавние",


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
    queue: { uploading: "Загрузка фото · 1 из 4", waiting: "Ждём связь. Отправится само.", notMeal: "Не похоже на еду", unread: "Не удалось прочитать фото", nothingCounted: "Ничего не учтено.", retake: "Переснять", remove: "Удалить", question: "Учтено как ≈{kcal}. Одна деталь сделает оценку точнее.", answer: "Ответить на 1 вопрос", dropTitle: "Перетащите фото куда угодно, чтобы добавить", dropSub: "или вставьте его в поле ввода", addedTitle: "Добавлено в ваш день", addedSub: "Мы посчитаем. Приложение можно закрыть.", beingRead: "{time} · читаем, приложение можно закрыть", found: "Найдено продуктов: {n}" },
  },
};

export const homeCopyFor = (lang: Lang): HomeCopy => t(lang)(HOME_COPY);

// ── The macro tips (F, ieat-app#1291) ──────────────────────────────────────────────────────────
// A tap on the protein, carbs or sat fat row opens the Callout: the row's state in one line,
// then what to eat or skip for the rest of today. Advice for today only, no health claims.

export type MacroTipKind = "protein" | "carbs" | "satfat";

export interface MacroTip {
  /** The Callout's first line — "Protein: 55 g to go". */
  title: string;
  /** The Callout's second line — what the number means for the rest of today. */
  body: string;
}

/**
 * The words a macro row's tip speaks, once for phone and web (F, ieat-app#1291). `share` is the
 * day's eaten÷target — `> 1` is the over branch — and `grams` the row's OWN figure already
 * formatted by the caller ("55 g"), so the shared layer holds words and the client holds numbers.
 * Protein names three states (to go, reached, over); carbs and sat fat two (left, over). The `over`
 * colour is the caller's `share > 1` — the same compare it already made for the row.
 */
export function macroTip(kind: MacroTipKind, share: number, grams: string, lang: Lang): MacroTip {
  const { tips } = homeCopyFor(lang);
  const branch =
    kind === "protein"
      ? share > 1 ? tips.protein.over : share >= 1 ? tips.protein.reached : tips.protein.togo
      : kind === "carbs"
        ? share > 1 ? tips.carbs.over : tips.carbs.left
        : share > 1 ? tips.satfat.over : tips.satfat.left;
  return { title: fill(branch.title, { g: grams }), body: branch.body };
}
