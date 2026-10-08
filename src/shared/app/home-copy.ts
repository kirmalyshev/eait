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
// `Intl` off `LANG_TAG` — none of those are copy. `{coach}` is not needed on this surface: the boards
// draw Spud, and since #462 the words name nobody — the composer speaks first person.
//
// THE {n} RULE: the boards draw a figure and its label as two elements ("368" over "kcal left",
// "55g" over "Protein left"), so the LABEL is a string here and the figure is `wholeNumbers` —
// except `grams`, the "{n}g" the figure element itself needs, and the `· {eaten} of {plan}`
// detail forms, where the numbers ride inside the label and are placeholders like everywhere
// else. A figure that is not there yet — the diary-failed "—" — is the client's `—` fed through
// the same template, not a separate string.

import { fill, t, type Localized } from "../lang.ts";
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
  /** "{macro} {n}g" — the named macro chip on the web proposal ("sat fat 3g"). */
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
  /** phone: the same chip with a streak goal set — drawn "4/14", read "4 of 14 days". */
  phoneStreakGoalAria: string;
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
  /** A gram figure — the macro cards' "55g" and "0g", and "— g" when the diary did not load. */
  grams: string;
  /** A milligram figure — sodium is measured in mg (`sodium_mg`), so its card and chip read so. */
  milligrams: string;
  /**
   * The F bar row's figure line under the target — "{grams} left" (`web/today*.html`,
   * `phone/today*.html`). The row splits the template at `{grams}` so the figure keeps its weight
   * and the word stays light; `{grams}` is the formatted "{n}g" / "{n}mg" figure, and the word
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
  /** The macro tips (F, ieat-app#1291): a tapped protein/carbs/sat-fat row's inline panel —
   * what to eat or skip for the rest of today, one sentence per state. */
  tips: {
    protein: { togo: string; reached: string; over: string };
    carbs: { left: string; over: string };
    satfat: { left: string; over: string };
  };
  /** The empty day — the dashed card's line beside Spud, both clients. */
  nothingLogged: string;
  /** `states-diary-failed`, both clients — the card above "Try again". */
  diaryFailed: string;
  tryAgain: string;
  /** web: the logging CTA — `web/today.html` and `web/today-empty`, opening W5's upload view. */
  webUploadPhoto: string;
  /** web: the in-diary composer — `web/today-logging`. First person, like every composer (#462). */
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
    phoneStreakGoalAria: "{n} of {goal} days",
    phoneDayNote: "Keep dinner lean: {grams}g of {nutrient} to go.",
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
    grams: "{n}g",
    milligrams: "{n}mg",
    gramLeft: "{grams} left", gramOver: "{grams} over",
    dayNoteSatFat: "saturated fat",

    macros: {
      protein: { name: "protein", left: "Protein left", over: "Protein over", ofTarget: "of {target} protein", chip: "protein {n}g" },
      carbs: { name: "carbs", left: "Carbs left", over: "Carbs over", ofTarget: "of {target} carbs", chip: "carbs {n}g" },
      fat: { name: "fat", left: "Fat left", over: "Fat over", ofTarget: "of {target} fat", chip: "fat {n}g" },
      satFat: { name: "sat fat", left: "Sat fat left", over: "Sat fat over", ofTarget: "of {target} sat fat", chip: "sat fat {n}g" },
      sodium: { name: "Sodium", left: "Sodium left", over: "Sodium over", ofTarget: "of {target} sodium", chip: "sodium {n}mg" },
      fibre: { name: "Fibre", chip: "fibre {n}g" },
      sugar: { name: "Sugar", chip: "sugar {n}g" },
    },
    tips: {
      protein: {
        togo: "Add a protein source to your next meal: eggs, Greek yogurt, cottage cheese, chicken, fish, tofu or lentils.",
        reached: "That's today's protein. Anything more is optional.",
        over: "You've had enough protein today. Skip extra meat, fish, eggs and protein shakes until tomorrow.",
      },
      carbs: {
        left: "There's room for a small portion of bread, rice, pasta or fruit today.",
        over: "Limit carbs for the rest of today. Go easy on bread, rice, pasta, sweets and sweet drinks.",
      },
      satfat: {
        left: "You're close to today's limit. Pick lean meat, fish or plant-based options.",
        over: "Limit butter, cheese, fatty meat, pastry and fried food for the rest of today.",
      },
    },
    recentlyUploaded: "Recent",


    nothingLogged: "Nothing logged yet.",
    diaryFailed: "Couldn't load your diary.",
    tryAgain: "Try again",
    webUploadPhoto: "Upload a photo",
    webComposerPlaceholder: "Tell me what you ate, or drop a photo",
    webDayRegion: "Day summary",
    webProposalLead: "Logging to {day} — look right?",
    todayWord: "today",
    webLogIt: "Log it",
    webProposalNo: "No",
    webPage: "Page {n} of {total}",
    webDone: "Done",
    queue: { uploading: "Uploading photo · 1 of 4", waiting: "Waiting to send", notMeal: "That doesn't look like a meal", unread: "Couldn't read this photo", nothingCounted: "Nothing was counted.", retake: "Retake", remove: "Remove", question: "Counted as ≈{kcal}. One detail would sharpen it.", answer: "Answer 1 question", dropTitle: "Drop a photo anywhere to log it", dropSub: "or paste one into the composer", addedTitle: "Added to your day", addedSub: "We'll count it. You can close the app.", beingRead: "{time} · being read, you can close the app", found: "Foods found: {n}" },
  },
  fr: {
    phoneToday: "Aujourd'hui",
    phoneStreakAria: "Série de {n} jours",
    phoneStreakGoalAria: "{n} jours sur {goal}",
    phoneDayNote: "Dîner léger : il te reste {grams}g de {nutrient}.",
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
    grams: "{n}g",
    milligrams: "{n}mg",
    gramLeft: "{grams} restants", gramOver: "{grams} en trop",
    dayNoteSatFat: "graisses saturées",

    macros: {
      protein: { name: "protéines", left: "Protéines restantes", over: "Protéines en trop", ofTarget: "protéines sur {target}", chip: "protéines {n}g" },
      carbs: { name: "glucides", left: "Glucides restants", over: "Glucides en trop", ofTarget: "glucides sur {target}", chip: "glucides {n}g" },
      fat: { name: "lipides", left: "Lipides restants", over: "Lipides en trop", ofTarget: "lipides sur {target}", chip: "lipides {n}g" },
      satFat: { name: "graisses saturées", left: "Graisses sat. restantes", over: "Graisses sat. en trop", ofTarget: "graisses saturées sur {target}", chip: "graisses saturées {n}g" },
      sodium: { name: "Sodium", left: "Sodium restant", over: "Sodium en trop", ofTarget: "sodium sur {target}", chip: "sodium {n}mg" },
      fibre: { name: "Fibres", chip: "fibres {n}g" },
      sugar: { name: "Sucres", chip: "sucres {n}g" },
    },
    tips: {
      protein: {
        togo: "Ajoute une source de protéines à ton prochain repas : œufs, yaourt grec, fromage blanc, poulet, poisson, tofu ou lentilles.",
        reached: "Tu as atteint tes protéines du jour. Le reste est facultatif.",
        over: "Tu as eu assez de protéines aujourd'hui. Laisse de côté la viande, le poisson, les œufs et les shakes protéinés en plus jusqu'à demain.",
      },
      carbs: {
        left: "Il y a de la place pour une petite portion de pain, de riz, de pâtes ou de fruit aujourd'hui.",
        over: "Limite les glucides pour le reste de la journée. Va doucement sur le pain, le riz, les pâtes, les sucreries et les boissons sucrées.",
      },
      satfat: {
        left: "Tu approches de la limite du jour. Choisis de la viande maigre, du poisson ou des options végétales.",
        over: "Limite le beurre, le fromage, la viande grasse, les viennoiseries et les fritures pour le reste de la journée.",
      },
    },
    recentlyUploaded: "Récents",


    nothingLogged: "Rien d'enregistré pour l'instant.",
    diaryFailed: "Impossible de charger ton journal.",
    tryAgain: "Réessayer",
    webUploadPhoto: "Envoyer une photo",
    webComposerPlaceholder: "Dis-moi ce que tu as mangé, ou dépose une photo",
    webDayRegion: "Résumé du jour",
    webProposalLead: "J'enregistre pour {day} — ça te va ?",
    todayWord: "aujourd'hui",
    webLogIt: "Enregistrer",
    webProposalNo: "Non",
    webPage: "Page {n} sur {total}",
    webDone: "Terminé",
    queue: { uploading: "Envoi de la photo · 1 sur 4", waiting: "En attente d'envoi", notMeal: "Ça ne ressemble pas à un repas", unread: "Impossible de lire cette photo", nothingCounted: "Rien n'a été compté.", retake: "Reprendre", remove: "Retirer", question: "Compté à ≈{kcal}. Un détail rendrait l'estimation plus juste.", answer: "Répondre à 1 question", dropTitle: "Dépose une photo n'importe où pour l'ajouter", dropSub: "ou colle-la dans le champ de saisie", addedTitle: "Ajouté à ta journée", addedSub: "On s'occupe du calcul. Tu peux fermer l'app.", beingRead: "{time} · en cours d'analyse, tu peux fermer l'app", found: "Aliments trouvés : {n}" },
  },
  de: {
    phoneToday: "Heute",
    phoneStreakAria: "{n} Tage in Folge",
    phoneStreakGoalAria: "{n} von {goal} Tagen",
    phoneDayNote: "Halte das Abendessen leicht: Bei {nutrient} sind nur noch {grams}g übrig.",
    phoneGoToDay: "Zu {day} springen",
    pickerPrevMonth: "Vorheriger Monat",
    pickerNextMonth: "Nächster Monat",
    pickerClose: "Schließen",
    pickDay: "Tag auswählen",
    pickerDayLogged: "{day}, Mahlzeiten eingetragen",
    pickerDayUnlogged: "{day}, nichts eingetragen",
    kcalLeft: "kcal übrig",
    kcalEaten: "kcal gegessen",
    kcalOver: "kcal zu viel",
    kcalLeftDetail: "kcal übrig · {eaten} von {plan}",
    kcalEatenDetail: "kcal gegessen · {eaten} von {plan}",
    kcalOverDetail: "kcal zu viel · {eaten} von {plan}",
    grams: "{n}g",
    milligrams: "{n}mg",
    gramLeft: "{grams} übrig", gramOver: "{grams} zu viel",
    dayNoteSatFat: "gesättigten Fettsäuren",

    macros: {
      protein: { name: "Protein", left: "Protein übrig", over: "Protein zu viel", ofTarget: "von {target} Protein", chip: "Protein {n}g" },
      carbs: { name: "Kohlenhydrate", left: "Kohlenhydrate übrig", over: "Kohlenhydrate zu viel", ofTarget: "Kohlenhydrate von {target}", chip: "Kohlenhydrate {n}g" },
      fat: { name: "Fett", left: "Fett übrig", over: "Fett zu viel", ofTarget: "Fett von {target}", chip: "Fett {n}g" },
      satFat: { name: "gesättigte Fettsäuren", left: "Ges. Fettsäuren übrig", over: "Ges. Fettsäuren zu viel", ofTarget: "Ges. Fettsäuren von {target}", chip: "ges. Fett {n}g" },
      sodium: { name: "Natrium", left: "Natrium übrig", over: "Natrium zu viel", ofTarget: "Natrium von {target}", chip: "Natrium {n}mg" },
      fibre: { name: "Ballaststoffe", chip: "Ballaststoffe {n}g" },
      sugar: { name: "Zucker", chip: "Zucker {n}g" },
    },
    tips: {
      protein: {
        togo: "Bau eine Proteinquelle in deine nächste Mahlzeit ein: Eier, griechischen Joghurt, Hüttenkäse, Hähnchen, Fisch, Tofu oder Linsen.",
        reached: "Das ist dein Protein für heute. Alles darüber ist optional.",
        over: "Du hattest heute genug Protein. Lass extra Fleisch, Fisch, Eier und Proteinshakes bis morgen weg.",
      },
      carbs: {
        left: "Heute ist Platz für eine kleine Portion Brot, Reis, Nudeln oder Obst.",
        over: "Begrenze Kohlenhydrate für den Rest des Tages. Halte dich bei Brot, Reis, Nudeln, Süßem und süßen Getränken zurück.",
      },
      satfat: {
        left: "Du bist nah am heutigen Limit. Nimm mageres Fleisch, Fisch oder pflanzliche Optionen.",
        over: "Begrenze Butter, Käse, fettes Fleisch, Gebäck und Frittiertes für den Rest des Tages.",
      },
    },
    recentlyUploaded: "Zuletzt",


    nothingLogged: "Noch nichts eingetragen.",
    diaryFailed: "Dein Tagebuch ließ sich nicht laden.",
    tryAgain: "Erneut versuchen",
    webUploadPhoto: "Foto hochladen",
    webComposerPlaceholder: "Sag mir, was du gegessen hast, oder leg ein Foto hier ab",
    webDayRegion: "Tagesübersicht",
    webProposalLead: "Ich trage das für {day} ein — passt das?",
    todayWord: "heute",
    webLogIt: "Eintragen",
    webProposalNo: "Nein",
    webPage: "Seite {n} von {total}",
    webDone: "Fertig",
    queue: { uploading: "Foto wird hochgeladen · 1 von 4", waiting: "Wartet auf den Versand", notMeal: "Das sieht nicht nach einer Mahlzeit aus", unread: "Dieses Foto ließ sich nicht lesen", nothingCounted: "Nichts wurde gezählt.", retake: "Neu aufnehmen", remove: "Entfernen", question: "Mit ≈{kcal} gezählt. Ein Detail würde es genauer machen.", answer: "1 Frage beantworten", dropTitle: "Foto irgendwo ablegen, um es einzutragen", dropSub: "oder ins Eingabefeld einfügen", addedTitle: "Zu deinem Tag hinzugefügt", addedSub: "Wir zählen es. Du kannst die App schließen.", beingRead: "{time} · wird gelesen, du kannst die App schließen", found: "Gefundene Lebensmittel: {n}" },
  },
  it: {
    phoneToday: "Oggi",
    phoneStreakAria: "Serie di {n} giorni",
    phoneStreakGoalAria: "{n} giorni su {goal}",
    phoneDayNote: "Cena leggera: ancora {grams}g di {nutrient}.",
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
    grams: "{n}g",
    milligrams: "{n}mg",
    gramLeft: "{grams} rimasti", gramOver: "{grams} in più",
    dayNoteSatFat: "grassi saturi",

    macros: {
      protein: { name: "proteine", left: "Proteine rimaste", over: "Proteine in più", ofTarget: "proteine su {target}", chip: "proteine {n}g" },
      carbs: { name: "carboidrati", left: "Carboidrati rimasti", over: "Carboidrati in più", ofTarget: "carboidrati su {target}", chip: "carboidrati {n}g" },
      fat: { name: "grassi", left: "Grassi rimasti", over: "Grassi in più", ofTarget: "grassi su {target}", chip: "grassi {n}g" },
      satFat: { name: "grassi saturi", left: "Grassi sat. rimasti", over: "Grassi sat. in più", ofTarget: "grassi saturi su {target}", chip: "grassi saturi {n}g" },
      sodium: { name: "Sodio", left: "Sodio rimasto", over: "Sodio in più", ofTarget: "sodio su {target}", chip: "sodio {n}mg" },
      fibre: { name: "Fibre", chip: "fibre {n}g" },
      sugar: { name: "Zuccheri", chip: "zuccheri {n}g" },
    },
    tips: {
      protein: {
        togo: "Aggiungi una fonte di proteine al prossimo pasto: uova, yogurt greco, fiocchi di latte, pollo, pesce, tofu o lenticchie.",
        reached: "Obiettivo proteine di oggi raggiunto. Il resto è facoltativo.",
        over: "Per oggi hai già preso abbastanza proteine. Evita altra carne, pesce, uova e frullati proteici fino a domani.",
      },
      carbs: {
        left: "C'è spazio per una piccola porzione di pane, riso, pasta o frutta oggi.",
        over: "Limita i carboidrati per il resto della giornata. Vacci piano con pane, riso, pasta, dolci e bevande zuccherate.",
      },
      satfat: {
        left: "Manca poco al limite di oggi. Scegli carne magra, pesce o opzioni vegetali.",
        over: "Limita burro, formaggio, carne grassa, prodotti da forno e fritti per il resto della giornata.",
      },
    },
    recentlyUploaded: "Recenti",


    nothingLogged: "Niente di registrato, per ora.",
    diaryFailed: "Non riesco a caricare il tuo diario.",
    tryAgain: "Riprova",
    webUploadPhoto: "Carica una foto",
    webComposerPlaceholder: "Dimmi cosa hai mangiato, o trascina una foto",
    webDayRegion: "Riepilogo del giorno",
    webProposalLead: "Lo registro per {day} — va bene?",
    todayWord: "oggi",
    webLogIt: "Registra",
    webProposalNo: "No",
    webPage: "Pagina {n} di {total}",
    webDone: "Fatto",
    queue: { uploading: "Caricamento foto · 1 di 4", waiting: "In attesa di invio", notMeal: "Non sembra un pasto", unread: "Impossibile leggere questa foto", nothingCounted: "Non è stato contato nulla.", retake: "Scatta di nuovo", remove: "Rimuovi", question: "Contato come ≈{kcal}. Un dettaglio lo renderebbe più preciso.", answer: "Rispondi a 1 domanda", dropTitle: "Trascina una foto ovunque per registrarla", dropSub: "o incollala nel campo di testo", addedTitle: "Aggiunto alla tua giornata", addedSub: "Lo contiamo noi. Puoi chiudere l'app.", beingRead: "{time} · in lettura, puoi chiudere l'app", found: "Cibi trovati: {n}" },
  },
  es: {
    phoneToday: "Hoy",
    phoneStreakAria: "Racha de {n} días",
    phoneStreakGoalAria: "{n} de {goal} días",
    phoneDayNote: "Cena ligera: quedan {grams}g de {nutrient}.",
    phoneGoToDay: "Ir a {day}",
    pickerPrevMonth: "Mes anterior",
    pickerNextMonth: "Mes siguiente",
    pickerClose: "Cerrar",
    pickDay: "Elegir un día",
    pickerDayLogged: "{day}, con comidas",
    pickerDayUnlogged: "{day}, sin registros",
    kcalLeft: "kcal restantes",
    kcalEaten: "kcal consumidas",
    kcalOver: "kcal de más",
    kcalLeftDetail: "kcal restantes · {eaten} de {plan}",
    kcalEatenDetail: "kcal consumidas · {eaten} de {plan}",
    kcalOverDetail: "kcal de más · {eaten} de {plan}",
    grams: "{n}g",
    milligrams: "{n}mg",
    gramLeft: "{grams} restantes", gramOver: "{grams} de más",
    dayNoteSatFat: "grasas saturadas",

    macros: {
      protein: { name: "proteína", left: "Proteína restante", over: "Proteína de más", ofTarget: "de {target} de proteína", chip: "proteína {n}g" },
      carbs: { name: "carbohidratos", left: "Carbohidratos restantes", over: "Carbohidratos de más", ofTarget: "de {target} de carbohidratos", chip: "carbohidratos {n}g" },
      fat: { name: "grasas", left: "Grasas restantes", over: "Grasas de más", ofTarget: "de {target} de grasas", chip: "grasas {n}g" },
      satFat: { name: "grasas saturadas", left: "Grasas sat. restantes", over: "Grasas sat. de más", ofTarget: "de {target} de grasas sat.", chip: "grasas saturadas {n}g" },
      sodium: { name: "Sodio", left: "Sodio restante", over: "Sodio de más", ofTarget: "de {target} de sodio", chip: "sodio {n}mg" },
      fibre: { name: "Fibra", chip: "fibra {n}g" },
      sugar: { name: "Azúcar", chip: "azúcar {n}g" },
    },
    tips: {
      protein: {
        togo: "Añade una fuente de proteína a tu próxima comida: huevos, yogur griego, queso fresco batido, pollo, pescado, tofu o lentejas.",
        reached: "Esa es la proteína de hoy. Todo lo demás es opcional.",
        over: "Ya has tomado suficiente proteína hoy. Deja la carne, el pescado, los huevos y los batidos de proteína extra hasta mañana.",
      },
      carbs: {
        left: "Hoy aún cabe una ración pequeña de pan, arroz, pasta o fruta.",
        over: "Limita los carbohidratos el resto del día. Ve con cuidado con el pan, el arroz, la pasta, los dulces y las bebidas azucaradas.",
      },
      satfat: {
        left: "Estás cerca del límite de hoy. Elige carne magra, pescado u opciones vegetales.",
        over: "Limita la mantequilla, el queso, la carne grasa, la bollería y los fritos el resto del día.",
      },
    },
    recentlyUploaded: "Recientes",


    nothingLogged: "Nada registrado todavía.",
    diaryFailed: "No se pudo cargar tu diario.",
    tryAgain: "Reintentar",
    webUploadPhoto: "Subir una foto",
    webComposerPlaceholder: "Dime qué has comido, o suelta una foto",
    webDayRegion: "Resumen del día",
    webProposalLead: "Lo registro para {day} — ¿te cuadra?",
    todayWord: "hoy",
    webLogIt: "Registrar",
    webProposalNo: "No",
    webPage: "Página {n} de {total}",
    webDone: "Listo",
    queue: { uploading: "Subiendo la foto · 1 de 4", waiting: "Esperando para enviar", notMeal: "Eso no parece una comida", unread: "No se pudo leer esta foto", nothingCounted: "No se contó nada.", retake: "Repetir", remove: "Quitar", question: "Contado como ≈{kcal}. Un detalle lo afinaría.", answer: "Responder 1 pregunta", dropTitle: "Suelta una foto en cualquier sitio para registrarla", dropSub: "o pégala en el cuadro de texto", addedTitle: "Añadido a tu día", addedSub: "Lo contamos nosotros. Puedes cerrar la app.", beingRead: "{time} · leyéndose, puedes cerrar la app", found: "Alimentos encontrados: {n}" },
  },
  vi: {
    phoneToday: "Hôm nay",
    phoneStreakAria: "Chuỗi {n} ngày",
    phoneStreakGoalAria: "{n} trên {goal} ngày",
    phoneDayNote: "Ăn tối nhẹ thôi: còn {grams}g {nutrient}.",
    phoneGoToDay: "Đến {day}",
    pickerPrevMonth: "Tháng trước",
    pickerNextMonth: "Tháng sau",
    pickerClose: "Đóng",
    pickDay: "Chọn ngày",
    pickerDayLogged: "{day}, đã ghi bữa ăn",
    pickerDayUnlogged: "{day}, chưa ghi gì",
    kcalLeft: "kcal còn lại",
    kcalEaten: "kcal đã ăn",
    kcalOver: "kcal vượt mức",
    kcalLeftDetail: "kcal còn lại · {eaten} trên {plan}",
    kcalEatenDetail: "kcal đã ăn · {eaten} trên {plan}",
    kcalOverDetail: "kcal vượt mức · {eaten} trên {plan}",
    grams: "{n}g",
    milligrams: "{n}mg",
    gramLeft: "{grams} còn lại", gramOver: "vượt {grams}",
    dayNoteSatFat: "chất béo bão hòa",

    macros: {
      protein: { name: "đạm", left: "Đạm còn lại", over: "Đạm vượt mức", ofTarget: "trên {target} đạm", chip: "đạm {n}g" },
      carbs: { name: "tinh bột", left: "Tinh bột còn lại", over: "Tinh bột vượt mức", ofTarget: "trên {target} tinh bột", chip: "tinh bột {n}g" },
      fat: { name: "chất béo", left: "Chất béo còn lại", over: "Chất béo vượt mức", ofTarget: "trên {target} chất béo", chip: "chất béo {n}g" },
      satFat: { name: "chất béo bão hòa", left: "Chất béo bão hòa còn lại", over: "Chất béo bão hòa vượt mức", ofTarget: "trên {target} chất béo bão hòa", chip: "chất béo bão hòa {n}g" },
      sodium: { name: "Natri", left: "Natri còn lại", over: "Natri vượt mức", ofTarget: "trên {target} natri", chip: "natri {n}mg" },
      fibre: { name: "Chất xơ", chip: "chất xơ {n}g" },
      sugar: { name: "Đường", chip: "đường {n}g" },
    },
    tips: {
      protein: {
        togo: "Thêm một nguồn đạm vào bữa kế tiếp: trứng, sữa chua Hy Lạp, phô mai tươi, thịt gà, cá, đậu phụ hoặc đậu lăng.",
        reached: "Đó là lượng đạm của hôm nay. Thêm nữa là tùy bạn.",
        over: "Hôm nay bạn đã đủ đạm. Đến mai hãy tạm ngưng ăn thêm thịt, cá, trứng và uống protein shake.",
      },
      carbs: {
        left: "Hôm nay vẫn còn chỗ cho một phần nhỏ bánh mì, cơm, mì hoặc trái cây.",
        over: "Phần còn lại của hôm nay, hạn chế tinh bột nhé: bớt bánh mì, cơm, mì, đồ ngọt và nước ngọt.",
      },
      satfat: {
        left: "Bạn đang gần giới hạn của hôm nay. Chọn thịt nạc, cá hoặc món từ thực vật.",
        over: "Hạn chế bơ, phô mai, thịt mỡ, bánh ngọt và đồ chiên cho phần còn lại của hôm nay.",
      },
    },
    recentlyUploaded: "Gần đây",


    nothingLogged: "Chưa có gì được ghi.",
    diaryFailed: "Không tải được nhật ký của bạn.",
    tryAgain: "Thử lại",
    webUploadPhoto: "Tải ảnh lên",
    webComposerPlaceholder: "Kể cho mình bạn đã ăn gì, hoặc thả một bức ảnh vào",
    webDayRegion: "Tóm tắt trong ngày",
    webProposalLead: "Ghi vào {day} — đúng không?",
    todayWord: "hôm nay",
    webLogIt: "Ghi lại",
    webProposalNo: "Không",
    webPage: "Trang {n} trên {total}",
    webDone: "Xong",
    queue: { uploading: "Đang tải ảnh lên · 1/4", waiting: "Đang chờ gửi", notMeal: "Cái này trông không giống một bữa ăn", unread: "Không đọc được ảnh này", nothingCounted: "Chưa tính gì cả.", retake: "Chụp lại", remove: "Xóa", question: "Đã tính khoảng ≈{kcal}. Thêm một chi tiết sẽ chính xác hơn.", answer: "Trả lời 1 câu hỏi", dropTitle: "Thả ảnh vào bất kỳ đâu để ghi lại", dropSub: "hoặc dán vào ô soạn tin", addedTitle: "Đã thêm vào ngày của bạn", addedSub: "Mình sẽ tính. Bạn có thể đóng ứng dụng.", beingRead: "{time} · đang đọc, bạn có thể đóng ứng dụng", found: "Món tìm thấy: {n}" },
  },
  id: {
    phoneToday: "Hari ini",
    phoneStreakAria: "Runtunan {n} hari",
    phoneStreakGoalAria: "{n} dari {goal} hari",
    phoneDayNote: "Makan malam ringan saja: sisa {grams}g {nutrient}.",
    phoneGoToDay: "Ke {day}",
    pickerPrevMonth: "Bulan sebelumnya",
    pickerNextMonth: "Bulan berikutnya",
    pickerClose: "Tutup",
    pickDay: "Pilih hari",
    pickerDayLogged: "{day}, ada catatan makan",
    pickerDayUnlogged: "{day}, belum ada catatan",
    kcalLeft: "kcal tersisa",
    kcalEaten: "kcal dimakan",
    kcalOver: "kcal lebih",
    kcalLeftDetail: "kcal tersisa · {eaten} dari {plan}",
    kcalEatenDetail: "kcal dimakan · {eaten} dari {plan}",
    kcalOverDetail: "kcal lebih · {eaten} dari {plan}",
    grams: "{n}g",
    milligrams: "{n}mg",
    gramLeft: "{grams} tersisa", gramOver: "{grams} berlebih",
    dayNoteSatFat: "lemak jenuh",

    macros: {
      protein: { name: "protein", left: "Protein tersisa", over: "Protein lebih", ofTarget: "protein dari {target}", chip: "protein {n}g" },
      carbs: { name: "karbohidrat", left: "Karbohidrat tersisa", over: "Karbohidrat berlebih", ofTarget: "karbohidrat dari {target}", chip: "karbohidrat {n}g" },
      fat: { name: "lemak", left: "Lemak tersisa", over: "Lemak berlebih", ofTarget: "lemak dari {target}", chip: "lemak {n}g" },
      satFat: { name: "lemak jenuh", left: "Lemak jenuh tersisa", over: "Lemak jenuh berlebih", ofTarget: "lemak jenuh dari {target}", chip: "lemak jenuh {n}g" },
      sodium: { name: "Natrium", left: "Natrium tersisa", over: "Natrium berlebih", ofTarget: "natrium dari {target}", chip: "natrium {n}mg" },
      fibre: { name: "Serat", chip: "serat {n}g" },
      sugar: { name: "Gula", chip: "gula {n}g" },
    },
    tips: {
      protein: {
        togo: "Tambahkan sumber protein ke makananmu berikutnya: telur, yogurt Yunani, keju cottage, ayam, ikan, tahu, atau lentil.",
        reached: "Itu proteinmu untuk hari ini. Lebih dari itu opsional.",
        over: "Proteinmu hari ini sudah cukup. Lewati daging, ikan, telur, dan shake protein ekstra sampai besok.",
      },
      carbs: {
        left: "Masih ada ruang untuk porsi kecil roti, nasi, pasta, atau buah hari ini.",
        over: "Batasi karbohidrat untuk sisa hari ini. Kurangi roti, nasi, pasta, makanan manis, dan minuman manis.",
      },
      satfat: {
        left: "Kamu mendekati batas hari ini. Pilih daging tanpa lemak, ikan, atau pilihan nabati.",
        over: "Batasi mentega, keju, daging berlemak, kue kering, dan gorengan untuk sisa hari ini.",
      },
    },
    recentlyUploaded: "Terbaru",


    nothingLogged: "Belum ada yang dicatat.",
    diaryFailed: "Buku harianmu tidak bisa dimuat.",
    tryAgain: "Coba lagi",
    webUploadPhoto: "Unggah foto",
    webComposerPlaceholder: "Beri tahu aku apa yang kamu makan, atau taruh foto di sini",
    webDayRegion: "Ringkasan hari ini",
    webProposalLead: "Mencatat untuk {day} — sudah benar?",
    todayWord: "hari ini",
    webLogIt: "Catat",
    webProposalNo: "Tidak",
    webPage: "Halaman {n} dari {total}",
    webDone: "Selesai",
    queue: { uploading: "Mengunggah foto · 1 dari 4", waiting: "Menunggu untuk dikirim", notMeal: "Itu tidak terlihat seperti makanan", unread: "Foto ini tidak bisa dibaca", nothingCounted: "Tidak ada yang dihitung.", retake: "Foto ulang", remove: "Hapus", question: "Dihitung ≈{kcal}. Satu detail akan membuatnya lebih tepat.", answer: "Jawab 1 pertanyaan", dropTitle: "Letakkan foto di mana saja untuk mencatatnya", dropSub: "atau tempel di kolom pesan", addedTitle: "Ditambahkan ke harimu", addedSub: "Kami yang hitung. Kamu boleh menutup aplikasi.", beingRead: "{time} · sedang dibaca, kamu boleh menutup aplikasi", found: "Makanan ditemukan: {n}" },
  },
  ru: {
    phoneToday: "Сегодня",
    phoneStreakAria: "Серия: {n} дн.",
    phoneStreakGoalAria: "{n} из {goal} дн.",
    phoneDayNote: "На ужин — что-то лёгкое: {nutrient} — не больше {grams}г.",
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
    grams: "{n}г",
    milligrams: "{n}мг",
    gramLeft: "{grams} осталось", gramOver: "{grams} сверх нормы",
    dayNoteSatFat: "насыщенные жиры",

    macros: {
      protein: { name: "белки", left: "Белков осталось", over: "Белков больше нормы", ofTarget: "белков из {target}", chip: "белки {n}г" },
      carbs: { name: "углеводы", left: "Углеводов осталось", over: "Углеводов больше нормы", ofTarget: "углеводов из {target}", chip: "углеводы {n}г" },
      fat: { name: "жиры", left: "Жиров осталось", over: "Жиров больше нормы", ofTarget: "жиров из {target}", chip: "жиры {n}г" },
      satFat: { name: "нас. жиры", left: "Нас. жиров осталось", over: "Нас. жиров больше нормы", ofTarget: "насыщенных жиров из {target}", chip: "нас. жиры {n}г" },
      sodium: { name: "Натрий", left: "Натрия осталось", over: "Натрия больше нормы", ofTarget: "натрия из {target}", chip: "натрий {n}мг" },
      fibre: { name: "Клетчатка", chip: "клетчатка {n}г" },
      sugar: { name: "Сахар", chip: "сахар {n}г" },
    },
    tips: {
      protein: {
        togo: "Добавь источник белка к следующему приёму пищи: яйца, греческий йогурт, творог, курицу, рыбу, тофу или чечевицу.",
        reached: "Это белок на сегодня. Больше — по желанию.",
        over: "Белка сегодня уже достаточно. Пропусти лишнее мясо, рыбу, яйца и протеиновые коктейли до завтра.",
      },
      carbs: {
        left: "Сегодня есть место для небольшой порции хлеба, риса, макарон или фруктов.",
        over: "Ограничь углеводы до конца дня. Полегче с хлебом, рисом, макаронами, сладостями и сладкими напитками.",
      },
      satfat: {
        left: "Предел на сегодня близко. Выбирай нежирное мясо, рыбу или растительные блюда.",
        over: "Ограничь сливочное масло, сыр, жирное мясо, выпечку и жареное до конца дня.",
      },
    },
    recentlyUploaded: "Недавние",


    nothingLogged: "Пока ничего не записано.",
    diaryFailed: "Не удалось загрузить дневник.",
    tryAgain: "Повторить",
    webUploadPhoto: "Загрузить фото",
    webComposerPlaceholder: "Расскажи мне, что было на тарелке, или перетащи фото",
    webDayRegion: "Итоги дня",
    webProposalLead: "Записываю на {day} — всё верно?",
    todayWord: "сегодня",
    webLogIt: "Записать",
    webProposalNo: "Нет",
    webPage: "Страница {n} из {total}",
    webDone: "Готово",
    queue: { uploading: "Загрузка фото · 1 из 4", waiting: "Ждёт отправки", notMeal: "Не похоже на еду", unread: "Не удалось прочитать фото", nothingCounted: "Ничего не учтено.", retake: "Переснять", remove: "Удалить", question: "Учтено как ≈{kcal}. Одна деталь сделает оценку точнее.", answer: "Ответить на 1 вопрос", dropTitle: "Перетащи фото куда угодно, чтобы записать", dropSub: "или вставь его в поле ввода", addedTitle: "Добавлено в твой день", addedSub: "Мы посчитаем. Приложение можно закрыть.", beingRead: "{time} · читаем, приложение можно закрыть", found: "Найдено продуктов: {n}" },
  },
};

/** The streak chip's text and accessible name: "4/14" and "4 of 14 days" with a goal, else as before. */
export function streakChip(
  streak: number, goal: number | null, lang: Lang, n: (v: number) => string,
): { text: string; aria: string } {
  const c = homeCopyFor(lang);
  return goal === null
    ? { text: n(streak), aria: c.phoneStreakAria.replace("{n}", n(streak)) }
    : { text: `${n(streak)}/${n(goal)}`, aria: c.phoneStreakGoalAria.replace("{n}", n(streak)).replace("{goal}", n(goal)) };
}

export const homeCopyFor = (lang: Lang): HomeCopy => t(lang)(HOME_COPY);

// ── The macro tips (F, ieat-app#1291) ──────────────────────────────────────────────────────────
// A tap on the protein, carbs or sat fat row opens the inline panel under its bar: what to eat
// or skip for the rest of today, the sentence alone. Advice for today only, no health claims.

export type MacroTipKind = "protein" | "carbs" | "satfat";

/**
 * The words a macro row's tip speaks, once for phone and web (F, ieat-app#1291). `share` is the
 * day's eaten÷target — `> 1` is the over branch. Protein names three states (to go, reached,
 * over); carbs and sat fat two (left, over). The `over` colour is the caller's `share > 1` —
 * the same compare it already made for the row.
 */
export function macroTip(kind: MacroTipKind, share: number, lang: Lang): string {
  const { tips } = homeCopyFor(lang);
  return kind === "protein"
    ? share > 1 ? tips.protein.over : share >= 1 ? tips.protein.reached : tips.protein.togo
    : kind === "carbs"
      ? share > 1 ? tips.carbs.over : tips.carbs.left
      : share > 1 ? tips.satfat.over : tips.satfat.left;
}
