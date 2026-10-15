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
    labelRead: string; unreadableLabel: string; asMealPhoto: string;
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
    queue: { uploading: "Uploading photo · 1 of 4", waiting: "Waiting to send", notMeal: "That doesn't look like a meal", unread: "Couldn't read this photo", nothingCounted: "Nothing was counted.", retake: "Retake", remove: "Remove", question: "Counted as ≈{kcal}. One detail would sharpen it.", answer: "Answer 1 question", dropTitle: "Drop a photo anywhere to log it", dropSub: "or paste one into the composer", addedTitle: "Added to your day", addedSub: "We'll count it. You can close the app.", beingRead: "{time} · being read, you can close the app", found: "Foods found: {n}", labelRead: "Read from the nutrition label in your photo.", unreadableLabel: "Couldn't read that label.", asMealPhoto: "Analyse it as a meal photo" },
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
    queue: { uploading: "Envoi de la photo · 1 sur 4", waiting: "En attente d'envoi", notMeal: "Ça ne ressemble pas à un repas", unread: "Impossible de lire cette photo", nothingCounted: "Rien n'a été compté.", retake: "Reprendre", remove: "Retirer", question: "Compté à ≈{kcal}. Un détail rendrait l'estimation plus juste.", answer: "Répondre à 1 question", dropTitle: "Dépose une photo n'importe où pour l'ajouter", dropSub: "ou colle-la dans le champ de saisie", addedTitle: "Ajouté à ta journée", addedSub: "On s'occupe du calcul. Tu peux fermer l'app.", beingRead: "{time} · en cours d'analyse, tu peux fermer l'app", found: "Aliments trouvés : {n}", labelRead: "Lu sur l'étiquette nutritionnelle de ta photo.", unreadableLabel: "Impossible de lire cette étiquette.", asMealPhoto: "Analyser comme photo de repas" },
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
    queue: { uploading: "Foto wird hochgeladen · 1 von 4", waiting: "Wartet auf den Versand", notMeal: "Das sieht nicht nach einer Mahlzeit aus", unread: "Dieses Foto ließ sich nicht lesen", nothingCounted: "Nichts wurde gezählt.", retake: "Neu aufnehmen", remove: "Entfernen", question: "Mit ≈{kcal} gezählt. Ein Detail würde es genauer machen.", answer: "1 Frage beantworten", dropTitle: "Foto irgendwo ablegen, um es einzutragen", dropSub: "oder ins Eingabefeld einfügen", addedTitle: "Zu deinem Tag hinzugefügt", addedSub: "Wir zählen es. Du kannst die App schließen.", beingRead: "{time} · wird gelesen, du kannst die App schließen", found: "Gefundene Lebensmittel: {n}", labelRead: "Von der Nährwerttabelle auf deinem Foto gelesen.", unreadableLabel: "Die Nährwerttabelle ließ sich nicht lesen.", asMealPhoto: "Als Mahlzeitfoto analysieren" },
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
    queue: { uploading: "Caricamento foto · 1 di 4", waiting: "In attesa di invio", notMeal: "Non sembra un pasto", unread: "Impossibile leggere questa foto", nothingCounted: "Non è stato contato nulla.", retake: "Scatta di nuovo", remove: "Rimuovi", question: "Contato come ≈{kcal}. Un dettaglio lo renderebbe più preciso.", answer: "Rispondi a 1 domanda", dropTitle: "Trascina una foto ovunque per registrarla", dropSub: "o incollala nel campo di testo", addedTitle: "Aggiunto alla tua giornata", addedSub: "Lo contiamo noi. Puoi chiudere l'app.", beingRead: "{time} · in lettura, puoi chiudere l'app", found: "Cibi trovati: {n}", labelRead: "Letto dall'etichetta nutrizionale nella tua foto.", unreadableLabel: "Etichetta non leggibile.", asMealPhoto: "Analizza come foto del pasto" },
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
    queue: { uploading: "Subiendo la foto · 1 de 4", waiting: "Esperando para enviar", notMeal: "Eso no parece una comida", unread: "No se pudo leer esta foto", nothingCounted: "No se contó nada.", retake: "Repetir", remove: "Quitar", question: "Contado como ≈{kcal}. Un detalle lo afinaría.", answer: "Responder 1 pregunta", dropTitle: "Suelta una foto en cualquier sitio para registrarla", dropSub: "o pégala en el cuadro de texto", addedTitle: "Añadido a tu día", addedSub: "Lo contamos nosotros. Puedes cerrar la app.", beingRead: "{time} · leyéndose, puedes cerrar la app", found: "Alimentos encontrados: {n}", labelRead: "Leído de la etiqueta nutricional de tu foto.", unreadableLabel: "No se pudo leer esa etiqueta.", asMealPhoto: "Analizar como foto de comida" },
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
    queue: { uploading: "Đang tải ảnh lên · 1/4", waiting: "Đang chờ gửi", notMeal: "Cái này trông không giống một bữa ăn", unread: "Không đọc được ảnh này", nothingCounted: "Chưa tính gì cả.", retake: "Chụp lại", remove: "Xóa", question: "Đã tính khoảng ≈{kcal}. Thêm một chi tiết sẽ chính xác hơn.", answer: "Trả lời 1 câu hỏi", dropTitle: "Thả ảnh vào bất kỳ đâu để ghi lại", dropSub: "hoặc dán vào ô soạn tin", addedTitle: "Đã thêm vào ngày của bạn", addedSub: "Mình sẽ tính. Bạn có thể đóng ứng dụng.", beingRead: "{time} · đang đọc, bạn có thể đóng ứng dụng", found: "Món tìm thấy: {n}", labelRead: "Đọc từ nhãn dinh dưỡng trong ảnh của bạn.", unreadableLabel: "Không đọc được nhãn đó.", asMealPhoto: "Phân tích như ảnh bữa ăn" },
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
    queue: { uploading: "Mengunggah foto · 1 dari 4", waiting: "Menunggu untuk dikirim", notMeal: "Itu tidak terlihat seperti makanan", unread: "Foto ini tidak bisa dibaca", nothingCounted: "Tidak ada yang dihitung.", retake: "Foto ulang", remove: "Hapus", question: "Dihitung ≈{kcal}. Satu detail akan membuatnya lebih tepat.", answer: "Jawab 1 pertanyaan", dropTitle: "Letakkan foto di mana saja untuk mencatatnya", dropSub: "atau tempel di kolom pesan", addedTitle: "Ditambahkan ke harimu", addedSub: "Kami yang hitung. Kamu boleh menutup aplikasi.", beingRead: "{time} · sedang dibaca, kamu boleh menutup aplikasi", found: "Makanan ditemukan: {n}", labelRead: "Dibaca dari label gizi di fotomu.", unreadableLabel: "Label itu tidak bisa dibaca.", asMealPhoto: "Analisis sebagai foto makanan" },
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
    queue: { uploading: "Загрузка фото · 1 из 4", waiting: "Ждёт отправки", notMeal: "Не похоже на еду", unread: "Не удалось прочитать фото", nothingCounted: "Ничего не учтено.", retake: "Переснять", remove: "Удалить", question: "Учтено как ≈{kcal}. Одна деталь сделает оценку точнее.", answer: "Ответить на 1 вопрос", dropTitle: "Перетащи фото куда угодно, чтобы записать", dropSub: "или вставь его в поле ввода", addedTitle: "Добавлено в твой день", addedSub: "Мы посчитаем. Приложение можно закрыть.", beingRead: "{time} · читаем, приложение можно закрыть", found: "Найдено продуктов: {n}", labelRead: "Цифры — с этикетки на фото.", unreadableLabel: "Не удалось прочитать эту этикетку.", asMealPhoto: "Разобрать как фото еды" },
  },
  te: {
    phoneToday: "ఈరోజు",
    phoneStreakAria: "{n} రోజుల స్ట్రీక్",
    phoneStreakGoalAria: "{n} / {goal} రోజులు",
    phoneDayNote: "రాత్రి భోజనం తేలికగా ఉంచండి: {nutrient} ఇంకా {grams} g మిగిలింది.",
    phoneGoToDay: "దీనికి వెళ్ళండి: {day}",
    pickerPrevMonth: "మునుపటి నెల",
    pickerNextMonth: "తర్వాతి నెల",
    pickerClose: "మూసివేయండి",
    pickDay: "రోజును ఎంచుకోండి",
    pickerDayLogged: "{day}, భోజనాలు నమోదయ్యాయి",
    pickerDayUnlogged: "{day}, ఏమీ నమోదు కాలేదు",
    kcalLeft: "kcal మిగిలింది",
    kcalEaten: "kcal తిన్నారు",
    kcalOver: "kcal ఎక్కువ",
    kcalLeftDetail: "kcal మిగిలింది · {eaten} / {plan}",
    kcalEatenDetail: "kcal తిన్నారు · {eaten} / {plan}",
    kcalOverDetail: "kcal ఎక్కువ · {eaten} / {plan}",
    grams: "{n} g",
    milligrams: "{n} mg",
    gramLeft: "{grams} మిగిలింది", gramOver: "{grams} ఎక్కువ",
    dayNoteSatFat: "సంతృప్త కొవ్వు",

    macros: {
      protein: { name: "ప్రోటీన్", left: "ప్రోటీన్ మిగిలింది", over: "ప్రోటీన్ ఎక్కువ", ofTarget: "/ {target} ప్రోటీన్", chip: "ప్రోటీన్ {n} g" },
      carbs: { name: "కార్బ్స్", left: "కార్బ్స్ మిగిలాయి", over: "కార్బ్స్ ఎక్కువ", ofTarget: "/ {target} కార్బ్స్", chip: "కార్బ్స్ {n} g" },
      fat: { name: "కొవ్వు", left: "కొవ్వు మిగిలింది", over: "కొవ్వు ఎక్కువ", ofTarget: "/ {target} కొవ్వు", chip: "కొవ్వు {n} g" },
      satFat: { name: "సంతృప్త కొవ్వు", left: "సంతృప్త కొవ్వు మిగిలింది", over: "సంతృప్త కొవ్వు ఎక్కువ", ofTarget: "/ {target} సంతృప్త కొవ్వు", chip: "సంతృప్త కొవ్వు {n} g" },
      sodium: { name: "సోడియం", left: "సోడియం మిగిలింది", over: "సోడియం ఎక్కువ", ofTarget: "/ {target} సోడియం", chip: "సోడియం {n} mg" },
      fibre: { name: "ఫైబర్", chip: "ఫైబర్ {n} g" },
      sugar: { name: "చక్కెర", chip: "చక్కెర {n} g" },
    },
    tips: {
      protein: {
        togo: "మీ తర్వాతి భోజనంలో ప్రోటీన్ ఉండేది జోడించండి: గుడ్లు, గ్రీక్ యోగర్ట్, కాటేజ్ చీజ్, చికెన్, చేప, టోఫు లేదా పప్పు.",
        reached: "ఈరోజు ప్రోటీన్ పూర్తయింది. ఇంకా ఎక్కువ ఐచ్ఛికం.",
        over: "ఈరోజు సరిపడా ప్రోటీన్ తీసుకున్నారు. రేపటి వరకు అదనపు మాంసం, చేప, గుడ్లు, ప్రోటీన్ షేక్‌లు వద్దు.",
      },
      carbs: {
        left: "ఈరోజు కొద్దిగా బ్రెడ్, అన్నం, పాస్తా లేదా పండ్లకు చోటు ఉంది.",
        over: "ఈరోజు మిగతా సమయం కార్బ్స్ పరిమితం చేయండి. బ్రెడ్, అన్నం, పాస్తా, స్వీట్లు, తీపి పానీయాలు తగ్గించండి.",
      },
      satfat: {
        left: "ఈరోజు పరిమితికి దగ్గరగా ఉన్నారు. కొవ్వు తక్కువ మాంసం, చేప లేదా మొక్కల ఆధారిత ఎంపికలు ఎంచుకోండి.",
        over: "ఈరోజు మిగతా సమయం వెన్న, చీజ్, కొవ్వు మాంసం, పేస్ట్రీ, వేయించిన ఆహారం పరిమితం చేయండి.",
      },
    },
    recentlyUploaded: "ఇటీవలివి",


    nothingLogged: "ఇంకా ఏమీ నమోదు కాలేదు.",
    diaryFailed: "మీ డైరీని లోడ్ చేయడం కుదరలేదు.",
    tryAgain: "మళ్ళీ ప్రయత్నించండి",
    webUploadPhoto: "ఫోటో అప్‌లోడ్ చేయండి",
    webComposerPlaceholder: "మీరు ఏం తిన్నారో చెప్పండి, లేదా ఫోటో వేయండి",
    webDayRegion: "రోజు సారాంశం",
    webProposalLead: "నమోదు చేసే రోజు: {day} — సరిగ్గా ఉందా?",
    todayWord: "ఈరోజు",
    webLogIt: "నమోదు చేయండి",
    webProposalNo: "వద్దు",
    webPage: "పేజీ {n}/{total}",
    webDone: "పూర్తయింది",
    queue: { uploading: "ఫోటో అప్‌లోడ్ అవుతోంది · 4లో 1", waiting: "పంపడానికి వేచి ఉంది", notMeal: "ఇది భోజనంలా కనిపించడం లేదు", unread: "ఈ ఫోటోను చదవడం కుదరలేదు", nothingCounted: "ఏమీ లెక్కించబడలేదు.", retake: "మళ్ళీ తీయండి", remove: "తీసివేయండి", question: "లెక్కించినది: ≈{kcal}. ఒక వివరం దీన్ని మరింత ఖచ్చితం చేస్తుంది.", answer: "1 ప్రశ్నకు సమాధానం ఇవ్వండి", dropTitle: "నమోదు చేయడానికి ఫోటోను ఎక్కడైనా వేయండి", dropSub: "లేదా దాన్ని మెసేజ్ బాక్స్‌లో పేస్ట్ చేయండి", addedTitle: "మీ రోజుకు జోడించబడింది", addedSub: "మేము దాన్ని లెక్కిస్తాం. యాప్‌ను మూసివేయవచ్చు.", beingRead: "{time} · చదువుతోంది, యాప్‌ను మూసివేయవచ్చు", found: "కనుగొన్న ఆహారాలు: {n}", labelRead: "మీ ఫోటోలోని పోషకాహార లేబుల్ నుండి చదివినది.", unreadableLabel: "ఆ లేబుల్‌ను చదవడం కుదరలేదు.", asMealPhoto: "భోజనం ఫోటోగా విశ్లేషించండి" },
  },
  ta: {
    phoneToday: "இன்று",
    phoneStreakAria: "{n} நாள் ஸ்ட்ரீக்",
    phoneStreakGoalAria: "{n} / {goal} நாட்கள்",
    phoneDayNote: "இரவு உணவை லேசாக வைக்கவும்: {nutrient} இன்னும் {grams} g மீதம்.",
    phoneGoToDay: "செல்: {day}",
    pickerPrevMonth: "முந்தைய மாதம்",
    pickerNextMonth: "அடுத்த மாதம்",
    pickerClose: "மூடு",
    pickDay: "நாளைத் தேர்ந்தெடு",
    pickerDayLogged: "{day}, உணவுகள் உள்ளன",
    pickerDayUnlogged: "{day}, எதுவும் பதிவுசெய்யப்படவில்லை",
    kcalLeft: "kcal மீதம்",
    kcalEaten: "kcal சாப்பிட்டது",
    kcalOver: "kcal அதிகம்",
    kcalLeftDetail: "kcal மீதம் · {eaten} / {plan}",
    kcalEatenDetail: "kcal சாப்பிட்டது · {eaten} / {plan}",
    kcalOverDetail: "kcal அதிகம் · {eaten} / {plan}",
    grams: "{n} g",
    milligrams: "{n} mg",
    gramLeft: "{grams} மீதம்", gramOver: "{grams} அதிகம்",
    dayNoteSatFat: "நிறைவுற்ற கொழுப்பு",

    macros: {
      protein: { name: "புரதம்", left: "புரதம் மீதம்", over: "புரதம் அதிகம்", ofTarget: "/ {target} புரதம்", chip: "புரதம் {n} g" },
      carbs: { name: "கார்ப்ஸ்", left: "கார்ப்ஸ் மீதம்", over: "கார்ப்ஸ் அதிகம்", ofTarget: "/ {target} கார்ப்ஸ்", chip: "கார்ப்ஸ் {n} g" },
      fat: { name: "கொழுப்பு", left: "கொழுப்பு மீதம்", over: "கொழுப்பு அதிகம்", ofTarget: "/ {target} கொழுப்பு", chip: "கொழுப்பு {n} g" },
      satFat: { name: "நிறை. கொழுப்பு", left: "நிறை. கொழுப்பு மீதம்", over: "நிறை. கொழுப்பு அதிகம்", ofTarget: "/ {target} நிறைவுற்ற கொழுப்பு", chip: "நிறை. கொழுப்பு {n} g" },
      sodium: { name: "சோடியம்", left: "சோடியம் மீதம்", over: "சோடியம் அதிகம்", ofTarget: "/ {target} சோடியம்", chip: "சோடியம் {n} mg" },
      fibre: { name: "நார்ச்சத்து", chip: "நார்ச்சத்து {n} g" },
      sugar: { name: "சர்க்கரை", chip: "சர்க்கரை {n} g" },
    },
    tips: {
      protein: {
        togo: "உங்கள் அடுத்த உணவில் ஒரு புரத மூலத்தைச் சேர்க்கவும்: முட்டை, கிரீக் யோகர்ட், காட்டேஜ் சீஸ், சிக்கன், மீன், டோஃபு அல்லது பருப்பு.",
        reached: "இன்றைய புரதம் முடிந்தது. இதற்கு மேல் விருப்பத்தேர்வுதான்.",
        over: "இன்று போதுமான புரதம் எடுத்துவிட்டீர்கள். நாளை வரை கூடுதல் இறைச்சி, மீன், முட்டை, புரத ஷேக் வேண்டாம்.",
      },
      carbs: {
        left: "இன்று ரொட்டி, சாதம், பாஸ்தா அல்லது பழம் சிறிதளவு எடுக்க இடம் உள்ளது.",
        over: "இன்றைய மீதி நேரம் கார்ப்ஸைக் குறைக்கவும். ரொட்டி, சாதம், பாஸ்தா, இனிப்புகள், இனிப்பு பானங்களைக் குறைவாக எடுக்கவும்.",
      },
      satfat: {
        left: "இன்றைய வரம்பை நெருங்கிவிட்டீர்கள். கொழுப்பு குறைந்த இறைச்சி, மீன் அல்லது தாவர அடிப்படையிலான தேர்வுகளைத் தேர்ந்தெடுக்கவும்.",
        over: "இன்றைய மீதி நேரம் வெண்ணெய், சீஸ், கொழுப்புள்ள இறைச்சி, பேஸ்ட்ரி, பொரித்த உணவுகளைக் குறைக்கவும்.",
      },
    },
    recentlyUploaded: "சமீபத்தியவை",


    nothingLogged: "இன்னும் எதுவும் பதிவுசெய்யப்படவில்லை.",
    diaryFailed: "உங்கள் நாட்குறிப்பை ஏற்ற முடியவில்லை.",
    tryAgain: "மீண்டும் முயல்க",
    webUploadPhoto: "புகைப்படத்தைப் பதிவேற்று",
    webComposerPlaceholder: "என்ன சாப்பிட்டீர்கள் என்று சொல்லுங்கள், அல்லது புகைப்படத்தை இடுங்கள்",
    webDayRegion: "நாள் சுருக்கம்",
    webProposalLead: "{day} அன்று பதிவுசெய்கிறேன் — சரியா?",
    todayWord: "இன்று",
    webLogIt: "பதிவுசெய்",
    webProposalNo: "இல்லை",
    webPage: "பக்கம் {n}/{total}",
    webDone: "முடிந்தது",
    queue: { uploading: "புகைப்படம் பதிவேற்றப்படுகிறது · 1 / 4", waiting: "அனுப்பக் காத்திருக்கிறது", notMeal: "இது உணவு போலத் தெரியவில்லை", unread: "இந்தப் புகைப்படத்தைப் படிக்க முடியவில்லை", nothingCounted: "எதுவும் கணக்கிடப்படவில்லை.", retake: "மீண்டும் எடு", remove: "அகற்று", question: "≈{kcal} எனக் கணக்கிடப்பட்டது. ஒரு விவரம் இதைத் துல்லியமாக்கும்.", answer: "1 கேள்விக்குப் பதிலளி", dropTitle: "பதிவுசெய்ய எங்கு வேண்டுமானாலும் புகைப்படத்தை இடவும்", dropSub: "அல்லது செய்திப் பெட்டியில் ஒட்டவும்", addedTitle: "உங்கள் நாளில் சேர்க்கப்பட்டது", addedSub: "நாங்கள் கணக்கிடுவோம். நீங்கள் ஆப்பை மூடலாம்.", beingRead: "{time} · படிக்கப்படுகிறது, ஆப்பை மூடலாம்", found: "கண்டறிந்த உணவுகள்: {n}", labelRead: "உங்கள் புகைப்படத்தில் உள்ள ஊட்டச்சத்து லேபிளிலிருந்து படிக்கப்பட்டது.", unreadableLabel: "அந்த லேபிளைப் படிக்க முடியவில்லை.", asMealPhoto: "உணவுப் புகைப்படமாகப் பகுப்பாய்வு செய்" },
  },
  pa: {
    phoneToday: "ਅੱਜ",
    phoneStreakAria: "{n} ਦਿਨਾਂ ਦੀ ਸਟ੍ਰੀਕ",
    phoneStreakGoalAria: "{goal} ਵਿੱਚੋਂ {n} ਦਿਨ",
    phoneDayNote: "ਰਾਤ ਦਾ ਖਾਣਾ ਹਲਕਾ ਰੱਖੋ: {nutrient} ਦੇ {grams} g ਬਾਕੀ।",
    phoneGoToDay: "{day} 'ਤੇ ਜਾਓ",
    pickerPrevMonth: "ਪਿਛਲਾ ਮਹੀਨਾ",
    pickerNextMonth: "ਅਗਲਾ ਮਹੀਨਾ",
    pickerClose: "ਬੰਦ ਕਰੋ",
    pickDay: "ਦਿਨ ਚੁਣੋ",
    pickerDayLogged: "{day}, ਖਾਣੇ ਦਰਜ ਹਨ",
    pickerDayUnlogged: "{day}, ਕੁਝ ਦਰਜ ਨਹੀਂ",
    kcalLeft: "kcal ਬਾਕੀ",
    kcalEaten: "kcal ਖਾਧੀਆਂ",
    kcalOver: "kcal ਵੱਧ",
    kcalLeftDetail: "kcal ਬਾਕੀ · {plan} ਵਿੱਚੋਂ {eaten}",
    kcalEatenDetail: "kcal ਖਾਧੀਆਂ · {plan} ਵਿੱਚੋਂ {eaten}",
    kcalOverDetail: "kcal ਵੱਧ · {plan} ਵਿੱਚੋਂ {eaten}",
    grams: "{n} g",
    milligrams: "{n} mg",
    gramLeft: "{grams} ਬਾਕੀ", gramOver: "{grams} ਵੱਧ",
    dayNoteSatFat: "ਸੈਚੁਰੇਟਿਡ ਫ਼ੈਟ",

    macros: {
      protein: { name: "ਪ੍ਰੋਟੀਨ", left: "ਪ੍ਰੋਟੀਨ ਬਾਕੀ", over: "ਪ੍ਰੋਟੀਨ ਵੱਧ", ofTarget: "{target} ਪ੍ਰੋਟੀਨ ਵਿੱਚੋਂ", chip: "ਪ੍ਰੋਟੀਨ {n} g" },
      carbs: { name: "ਕਾਰਬਸ", left: "ਕਾਰਬਸ ਬਾਕੀ", over: "ਕਾਰਬਸ ਵੱਧ", ofTarget: "{target} ਕਾਰਬਸ ਵਿੱਚੋਂ", chip: "ਕਾਰਬਸ {n} g" },
      fat: { name: "ਫ਼ੈਟ", left: "ਫ਼ੈਟ ਬਾਕੀ", over: "ਫ਼ੈਟ ਵੱਧ", ofTarget: "{target} ਫ਼ੈਟ ਵਿੱਚੋਂ", chip: "ਫ਼ੈਟ {n} g" },
      satFat: { name: "ਸੈਚੁ. ਫ਼ੈਟ", left: "ਸੈਚੁ. ਫ਼ੈਟ ਬਾਕੀ", over: "ਸੈਚੁ. ਫ਼ੈਟ ਵੱਧ", ofTarget: "{target} ਸੈਚੁਰੇਟਿਡ ਫ਼ੈਟ ਵਿੱਚੋਂ", chip: "ਸੈਚੁ. ਫ਼ੈਟ {n} g" },
      sodium: { name: "ਸੋਡੀਅਮ", left: "ਸੋਡੀਅਮ ਬਾਕੀ", over: "ਸੋਡੀਅਮ ਵੱਧ", ofTarget: "{target} ਸੋਡੀਅਮ ਵਿੱਚੋਂ", chip: "ਸੋਡੀਅਮ {n} mg" },
      fibre: { name: "ਫ਼ਾਈਬਰ", chip: "ਫ਼ਾਈਬਰ {n} g" },
      sugar: { name: "ਸ਼ੂਗਰ", chip: "ਸ਼ੂਗਰ {n} g" },
    },
    tips: {
      protein: {
        togo: "ਆਪਣੇ ਅਗਲੇ ਖਾਣੇ ਵਿੱਚ ਪ੍ਰੋਟੀਨ ਦਾ ਕੋਈ ਸਰੋਤ ਜੋੜੋ: ਆਂਡੇ, ਗ੍ਰੀਕ ਦਹੀਂ, ਪਨੀਰ, ਚਿਕਨ, ਮੱਛੀ, ਟੋਫ਼ੂ ਜਾਂ ਦਾਲ।",
        reached: "ਅੱਜ ਦਾ ਪ੍ਰੋਟੀਨ ਹੋ ਗਿਆ। ਇਸ ਤੋਂ ਵੱਧ ਵਿਕਲਪਿਕ ਹੈ।",
        over: "ਅੱਜ ਲੋੜੀਂਦਾ ਪ੍ਰੋਟੀਨ ਹੋ ਗਿਆ ਹੈ। ਕੱਲ੍ਹ ਤੱਕ ਵਾਧੂ ਮੀਟ, ਮੱਛੀ, ਆਂਡੇ ਅਤੇ ਪ੍ਰੋਟੀਨ ਸ਼ੇਕ ਨਾ ਲਓ।",
      },
      carbs: {
        left: "ਅੱਜ ਬ੍ਰੈੱਡ, ਚੌਲ, ਪਾਸਤਾ ਜਾਂ ਫਲ ਦੇ ਇੱਕ ਛੋਟੇ ਹਿੱਸੇ ਦੀ ਗੁੰਜਾਇਸ਼ ਹੈ।",
        over: "ਅੱਜ ਬਾਕੀ ਦਿਨ ਕਾਰਬਸ ਸੀਮਤ ਰੱਖੋ। ਬ੍ਰੈੱਡ, ਚੌਲ, ਪਾਸਤਾ, ਮਿਠਾਈ ਅਤੇ ਮਿੱਠੇ ਪੀਣ ਵਾਲੇ ਪਦਾਰਥ ਘੱਟ ਲਓ।",
      },
      satfat: {
        left: "ਤੁਸੀਂ ਅੱਜ ਦੀ ਸੀਮਾ ਦੇ ਨੇੜੇ ਹੋ। ਘੱਟ ਚਰਬੀ ਵਾਲਾ ਮੀਟ, ਮੱਛੀ ਜਾਂ ਪਲਾਂਟ-ਬੇਸਡ ਵਿਕਲਪ ਚੁਣੋ।",
        over: "ਅੱਜ ਬਾਕੀ ਦਿਨ ਮੱਖਣ, ਚੀਜ਼, ਚਰਬੀ ਵਾਲਾ ਮੀਟ, ਪੇਸਟਰੀ ਅਤੇ ਤਲੀਆਂ ਚੀਜ਼ਾਂ ਸੀਮਤ ਰੱਖੋ।",
      },
    },
    recentlyUploaded: "ਹਾਲੀਆ",


    nothingLogged: "ਅਜੇ ਕੁਝ ਦਰਜ ਨਹੀਂ।",
    diaryFailed: "ਤੁਹਾਡੀ ਡਾਇਰੀ ਲੋਡ ਨਹੀਂ ਹੋ ਸਕੀ।",
    tryAgain: "ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ",
    webUploadPhoto: "ਫ਼ੋਟੋ ਅੱਪਲੋਡ ਕਰੋ",
    webComposerPlaceholder: "ਦੱਸੋ ਤੁਸੀਂ ਕੀ ਖਾਧਾ, ਜਾਂ ਫ਼ੋਟੋ ਪਾਓ",
    webDayRegion: "ਦਿਨ ਦਾ ਸਾਰ",
    webProposalLead: "{day} ਵਿੱਚ ਦਰਜ ਹੋ ਰਿਹਾ ਹੈ — ਸਹੀ ਹੈ?",
    todayWord: "ਅੱਜ",
    webLogIt: "ਦਰਜ ਕਰੋ",
    webProposalNo: "ਨਹੀਂ",
    webPage: "ਪੇਜ {n}/{total}",
    webDone: "ਹੋ ਗਿਆ",
    queue: { uploading: "ਫ਼ੋਟੋ ਅੱਪਲੋਡ ਹੋ ਰਹੀ ਹੈ · 4 ਵਿੱਚੋਂ 1", waiting: "ਭੇਜਣ ਦੀ ਉਡੀਕ", notMeal: "ਇਹ ਖਾਣਾ ਨਹੀਂ ਲੱਗਦਾ", unread: "ਇਹ ਫ਼ੋਟੋ ਪੜ੍ਹੀ ਨਹੀਂ ਜਾ ਸਕੀ", nothingCounted: "ਕੁਝ ਵੀ ਗਿਣਿਆ ਨਹੀਂ ਗਿਆ।", retake: "ਦੁਬਾਰਾ ਲਓ", remove: "ਹਟਾਓ", question: "≈{kcal} ਵਜੋਂ ਗਿਣਿਆ। ਇੱਕ ਜਾਣਕਾਰੀ ਨਾਲ ਇਹ ਹੋਰ ਸਟੀਕ ਹੋਵੇਗਾ।", answer: "1 ਸਵਾਲ ਦਾ ਜਵਾਬ ਦਿਓ", dropTitle: "ਦਰਜ ਕਰਨ ਲਈ ਕਿਤੇ ਵੀ ਫ਼ੋਟੋ ਪਾਓ", dropSub: "ਜਾਂ ਉਸ ਨੂੰ ਮੈਸੇਜ ਬਾਕਸ ਵਿੱਚ ਪੇਸਟ ਕਰੋ", addedTitle: "ਤੁਹਾਡੇ ਦਿਨ ਵਿੱਚ ਜੋੜਿਆ", addedSub: "ਅਸੀਂ ਇਸ ਨੂੰ ਗਿਣ ਲਵਾਂਗੇ। ਹੁਣ ਐਪ ਬੰਦ ਕੀਤੀ ਜਾ ਸਕਦੀ ਹੈ।", beingRead: "{time} · ਪੜ੍ਹੀ ਜਾ ਰਹੀ ਹੈ, ਐਪ ਬੰਦ ਕੀਤੀ ਜਾ ਸਕਦੀ ਹੈ", found: "ਮਿਲੇ ਖਾਧ ਪਦਾਰਥ: {n}", labelRead: "ਤੁਹਾਡੀ ਫ਼ੋਟੋ ਵਿਚਲੇ ਪੋਸ਼ਣ ਲੇਬਲ ਤੋਂ ਪੜ੍ਹਿਆ।", unreadableLabel: "ਉਹ ਲੇਬਲ ਪੜ੍ਹਿਆ ਨਹੀਂ ਜਾ ਸਕਿਆ।", asMealPhoto: "ਖਾਣੇ ਦੀ ਫ਼ੋਟੋ ਵਜੋਂ ਵਿਸ਼ਲੇਸ਼ਣ ਕਰੋ" },
  },
  or: {
    phoneToday: "ଆଜି",
    phoneStreakAria: "{n} ଦିନର ଷ୍ଟ୍ରିକ୍",
    phoneStreakGoalAria: "{goal} ରୁ {n} ଦିନ",
    phoneDayNote: "ରାତ୍ରି ଭୋଜନ ହାଲୁକା ରଖନ୍ତୁ: {nutrient} ର {grams} g ବାକି।",
    phoneGoToDay: "{day} କୁ ଯାଆନ୍ତୁ",
    pickerPrevMonth: "ପୂର୍ବ ମାସ",
    pickerNextMonth: "ପର ମାସ",
    pickerClose: "ବନ୍ଦ କରନ୍ତୁ",
    pickDay: "ଏକ ଦିନ ବାଛନ୍ତୁ",
    pickerDayLogged: "{day}, ଭୋଜନ ଲଗ୍ ହୋଇଛି",
    pickerDayUnlogged: "{day}, କିଛି ଲଗ୍ ହୋଇନାହିଁ",
    kcalLeft: "kcal ବାକି",
    kcalEaten: "kcal ଖିଆଗଲା",
    kcalOver: "kcal ଅଧିକ",
    kcalLeftDetail: "kcal ବାକି · {plan} ରୁ {eaten}",
    kcalEatenDetail: "kcal ଖିଆଗଲା · {plan} ରୁ {eaten}",
    kcalOverDetail: "kcal ଅଧିକ · {plan} ରୁ {eaten}",
    grams: "{n} g",
    milligrams: "{n} mg",
    gramLeft: "{grams} ବାକି", gramOver: "{grams} ଅଧିକ",
    dayNoteSatFat: "ସାଚୁରେଟେଡ୍ ଫ୍ୟାଟ୍",

    macros: {
      protein: { name: "ପ୍ରୋଟିନ୍", left: "ପ୍ରୋଟିନ୍ ବାକି", over: "ପ୍ରୋଟିନ୍ ଅଧିକ", ofTarget: "{target} ପ୍ରୋଟିନ୍‌ରୁ", chip: "ପ୍ରୋଟିନ୍ {n} g" },
      carbs: { name: "କାର୍ବସ୍", left: "କାର୍ବସ୍ ବାକି", over: "କାର୍ବସ୍ ଅଧିକ", ofTarget: "{target} କାର୍ବସ୍‌ରୁ", chip: "କାର୍ବସ୍ {n} g" },
      fat: { name: "ଫ୍ୟାଟ୍", left: "ଫ୍ୟାଟ୍ ବାକି", over: "ଫ୍ୟାଟ୍ ଅଧିକ", ofTarget: "{target} ଫ୍ୟାଟ୍‌ରୁ", chip: "ଫ୍ୟାଟ୍ {n} g" },
      satFat: { name: "ସାଚୁ. ଫ୍ୟାଟ୍", left: "ସାଚୁ. ଫ୍ୟାଟ୍ ବାକି", over: "ସାଚୁ. ଫ୍ୟାଟ୍ ଅଧିକ", ofTarget: "{target} ସାଚୁରେଟେଡ୍ ଫ୍ୟାଟ୍‌ରୁ", chip: "ସାଚୁ. ଫ୍ୟାଟ୍ {n} g" },
      sodium: { name: "ସୋଡିୟମ୍", left: "ସୋଡିୟମ୍ ବାକି", over: "ସୋଡିୟମ୍ ଅଧିକ", ofTarget: "{target} ସୋଡିୟମ୍‌ରୁ", chip: "ସୋଡିୟମ୍ {n} mg" },
      fibre: { name: "ଫାଇବର୍", chip: "ଫାଇବର୍ {n} g" },
      sugar: { name: "ଚିନି", chip: "ଚିନି {n} g" },
    },
    tips: {
      protein: {
        togo: "ଆପଣଙ୍କ ପରବର୍ତ୍ତୀ ଭୋଜନରେ ପ୍ରୋଟିନ୍‌ର ଏକ ଉତ୍ସ ଯୋଡ଼ନ୍ତୁ: ଅଣ୍ଡା, ଗ୍ରୀକ୍ ଦହି, ଛେନା, ଚିକେନ୍, ମାଛ, ଟୋଫୁ କିମ୍ବା ଡାଲି।",
        reached: "ଆଜିର ପ୍ରୋଟିନ୍ ପୂରା ହେଲା। ଏହାଠାରୁ ଅଧିକ ଇଚ୍ଛାଧୀନ।",
        over: "ଆଜି ଯଥେଷ୍ଟ ପ୍ରୋଟିନ୍ ହୋଇଗଲା। କାଲି ପର୍ଯ୍ୟନ୍ତ ଅତିରିକ୍ତ ମାଂସ, ମାଛ, ଅଣ୍ଡା ଓ ପ୍ରୋଟିନ୍ ଶେକ୍ ଛାଡ଼ନ୍ତୁ।",
      },
      carbs: {
        left: "ଆଜି ଅଳ୍ପ ପରିମାଣର ପାଉଁରୁଟି, ଭାତ, ପାସ୍ତା କିମ୍ବା ଫଳ ପାଇଁ ସ୍ଥାନ ଅଛି।",
        over: "ଆଜି ବାକି ଦିନ କାର୍ବସ୍ ସୀମିତ ରଖନ୍ତୁ। ପାଉଁରୁଟି, ଭାତ, ପାସ୍ତା, ମିଠା ଓ ମିଠା ପାନୀୟ କମ୍ ନିଅନ୍ତୁ।",
      },
      satfat: {
        left: "ଆଜିର ସୀମା ପାଖାପାଖି ପହଞ୍ଚିଛି। କମ୍ ଚର୍ବିଯୁକ୍ତ ମାଂସ, ମାଛ କିମ୍ବା ଉଦ୍ଭିଦ-ଆଧାରିତ ବିକଳ୍ପ ବାଛନ୍ତୁ।",
        over: "ଆଜି ବାକି ଦିନ ଲହୁଣି, ଚିଜ୍, ଚର୍ବିଯୁକ୍ତ ମାଂସ, ପେଷ୍ଟ୍ରି ଓ ଭଜା ଖାଦ୍ୟ ସୀମିତ ରଖନ୍ତୁ।",
      },
    },
    recentlyUploaded: "ସମ୍ପ୍ରତି",


    nothingLogged: "ଏପର୍ଯ୍ୟନ୍ତ କିଛି ଲଗ୍ ହୋଇନାହିଁ।",
    diaryFailed: "ଆପଣଙ୍କ ଡାଏରୀ ଲୋଡ୍ ହୋଇପାରିଲା ନାହିଁ।",
    tryAgain: "ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ",
    webUploadPhoto: "ଏକ ଫଟୋ ଅପଲୋଡ୍ କରନ୍ତୁ",
    webComposerPlaceholder: "କ'ଣ ଖାଇଲେ କୁହନ୍ତୁ, କିମ୍ବା ଏକ ଫଟୋ ଦିଅନ୍ତୁ",
    webDayRegion: "ଦିନର ସାରାଂଶ",
    webProposalLead: "{day} ପାଇଁ ଲଗ୍ କରୁଛି — ଠିକ୍ ଅଛି ତ?",
    todayWord: "ଆଜି",
    webLogIt: "ଲଗ୍ କରନ୍ତୁ",
    webProposalNo: "ନା",
    webPage: "ପେଜ୍ {n}/{total}",
    webDone: "ହୋଇଗଲା",
    queue: { uploading: "ଫଟୋ ଅପଲୋଡ୍ ହେଉଛି · 4 ରୁ 1", waiting: "ପଠାଇବାକୁ ଅପେକ୍ଷା କରୁଛି", notMeal: "ଏହା ଭୋଜନ ପରି ଲାଗୁନାହିଁ", unread: "ଏହି ଫଟୋ ପଢ଼ିହେଲା ନାହିଁ", nothingCounted: "କିଛି ଗଣାଯାଇନାହିଁ।", retake: "ପୁଣି ନିଅନ୍ତୁ", remove: "ହଟାନ୍ତୁ", question: "≈{kcal} ଭାବେ ଗଣାଗଲା। ଗୋଟିଏ ବିବରଣୀ ଏହାକୁ ଅଧିକ ସଠିକ୍ କରିବ।", answer: "1 ପ୍ରଶ୍ନର ଉତ୍ତର ଦିଅନ୍ତୁ", dropTitle: "ଲଗ୍ କରିବାକୁ ଯେକୌଣସି ସ୍ଥାନରେ ଫଟୋ ଦିଅନ୍ତୁ", dropSub: "କିମ୍ବା ମେସେଜ୍ ବକ୍ସରେ ପେଷ୍ଟ କରନ୍ତୁ", addedTitle: "ଆପଣଙ୍କ ଦିନରେ ଯୋଡ଼ାଗଲା", addedSub: "ଆମେ ଏହାକୁ ଗଣିବୁ। ଆପ୍ ବନ୍ଦ କରିପାରିବେ।", beingRead: "{time} · ପଢ଼ାଯାଉଛି, ଆପ୍ ବନ୍ଦ କରିପାରିବେ", found: "ମିଳିଥିବା ଖାଦ୍ୟ: {n}", labelRead: "ଆପଣଙ୍କ ଫଟୋରେ ଥିବା ପୋଷଣ ଲେବଲ୍‌ରୁ ପଢ଼ାଯାଇଛି।", unreadableLabel: "ସେହି ଲେବଲ୍ ପଢ଼ିହେଲା ନାହିଁ।", asMealPhoto: "ଏହାକୁ ଭୋଜନ ଫଟୋ ଭାବେ ବିଶ୍ଳେଷଣ କରନ୍ତୁ" },
  },
  mr: {
    phoneToday: "आज",
    phoneStreakAria: "स्ट्रीक: {n} दिवस",
    phoneStreakGoalAria: "{goal} पैकी {n} दिवस",
    phoneDayNote: "रात्रीचे जेवण हलके ठेवा: {nutrient} फक्त {grams} g बाकी.",
    phoneGoToDay: "{day} वर जा",
    pickerPrevMonth: "मागील महिना",
    pickerNextMonth: "पुढील महिना",
    pickerClose: "बंद करा",
    pickDay: "दिवस निवडा",
    pickerDayLogged: "{day}, जेवणे नोंदवलेली",
    pickerDayUnlogged: "{day}, काहीही नोंदवलेले नाही",
    kcalLeft: "kcal बाकी",
    kcalEaten: "kcal खाल्ले",
    kcalOver: "kcal जास्त",
    kcalLeftDetail: "kcal बाकी · {plan} पैकी {eaten}",
    kcalEatenDetail: "kcal खाल्ले · {plan} पैकी {eaten}",
    kcalOverDetail: "kcal जास्त · {plan} पैकी {eaten}",
    grams: "{n} g",
    milligrams: "{n} mg",
    gramLeft: "{grams} बाकी", gramOver: "{grams} जास्त",
    dayNoteSatFat: "सॅच्युरेटेड फॅट",

    macros: {
      protein: { name: "प्रोटीन", left: "प्रोटीन बाकी", over: "प्रोटीन जास्त", ofTarget: "{target} प्रोटीनपैकी", chip: "प्रोटीन {n} g" },
      carbs: { name: "कार्ब्स", left: "कार्ब्स बाकी", over: "कार्ब्स जास्त", ofTarget: "{target} कार्ब्सपैकी", chip: "कार्ब्स {n} g" },
      fat: { name: "फॅट", left: "फॅट बाकी", over: "फॅट जास्त", ofTarget: "{target} फॅटपैकी", chip: "फॅट {n} g" },
      satFat: { name: "सॅच. फॅट", left: "सॅच. फॅट बाकी", over: "सॅच. फॅट जास्त", ofTarget: "{target} सॅच. फॅटपैकी", chip: "सॅच. फॅट {n} g" },
      sodium: { name: "सोडियम", left: "सोडियम बाकी", over: "सोडियम जास्त", ofTarget: "{target} सोडियमपैकी", chip: "सोडियम {n} mg" },
      fibre: { name: "फायबर", chip: "फायबर {n} g" },
      sugar: { name: "साखर", chip: "साखर {n} g" },
    },
    tips: {
      protein: {
        togo: "तुमच्या पुढच्या जेवणात प्रोटीनचा स्रोत जोडा: अंडी, ग्रीक योगर्ट, पनीर, चिकन, मासे, टोफू किंवा डाळी.",
        reached: "आजचे प्रोटीन पूर्ण झाले. यापुढचे ऐच्छिक आहे.",
        over: "आज पुरेसे प्रोटीन झाले आहे. उद्यापर्यंत जास्तीचे मांस, मासे, अंडी आणि प्रोटीन शेक टाळा.",
      },
      carbs: {
        left: "आज थोडा ब्रेड, भात, पास्ता किंवा फळ खाण्यासाठी जागा आहे.",
        over: "आजच्या उरलेल्या दिवसात कार्ब्स मर्यादित ठेवा. ब्रेड, भात, पास्ता, मिठाई आणि गोड पेये कमी घ्या.",
      },
      satfat: {
        left: "तुम्ही आजच्या मर्यादेच्या जवळ आहात. कमी चरबीचे मांस, मासे किंवा वनस्पती-आधारित पर्याय निवडा.",
        over: "आजच्या उरलेल्या दिवसात लोणी, चीज, चरबीयुक्त मांस, पेस्ट्री आणि तळलेले पदार्थ मर्यादित ठेवा.",
      },
    },
    recentlyUploaded: "अलीकडील",


    nothingLogged: "अजून काहीही नोंदवलेले नाही.",
    diaryFailed: "तुमची डायरी लोड करता आली नाही.",
    tryAgain: "पुन्हा प्रयत्न करा",
    webUploadPhoto: "फोटो अपलोड करा",
    webComposerPlaceholder: "काय खाल्ले ते सांगा, किंवा फोटो टाका",
    webDayRegion: "दिवसाचा सारांश",
    webProposalLead: "नोंद: {day} — बरोबर आहे ना?",
    todayWord: "आज",
    webLogIt: "नोंदवा",
    webProposalNo: "नाही",
    webPage: "पेज {n} / {total}",
    webDone: "पूर्ण",
    queue: { uploading: "फोटो अपलोड होत आहे · 4 पैकी 1", waiting: "पाठवण्याच्या प्रतीक्षेत", notMeal: "हे जेवणासारखे दिसत नाही", unread: "हा फोटो वाचता आला नाही", nothingCounted: "काहीही मोजले गेले नाही.", retake: "पुन्हा फोटो काढा", remove: "काढून टाका", question: "≈{kcal} म्हणून मोजले. एका तपशीलाने ते अधिक अचूक होईल.", answer: "1 प्रश्नाचे उत्तर द्या", dropTitle: "नोंदवण्यासाठी कुठेही फोटो टाका", dropSub: "किंवा कंपोझरमध्ये पेस्ट करा", addedTitle: "तुमच्या दिवसात जोडले", addedSub: "आम्ही ते मोजू. तुम्ही ॲप बंद करू शकता.", beingRead: "{time} · वाचले जात आहे, तुम्ही ॲप बंद करू शकता", found: "सापडलेले पदार्थ: {n}", labelRead: "तुमच्या फोटोतील पोषण लेबलवरून वाचले.", unreadableLabel: "ते लेबल वाचता आले नाही.", asMealPhoto: "जेवणाचा फोटो म्हणून विश्लेषण करा" },
  },
  ml: {
    phoneToday: "ഇന്ന്",
    phoneStreakAria: "{n} ദിവസത്തെ സ്ട്രീക്ക്",
    phoneStreakGoalAria: "{n} / {goal} ദിവസം",
    phoneDayNote: "അത്താഴം ലഘുവാക്കൂ: ഇനി {grams} g {nutrient} ബാക്കി.",
    phoneGoToDay: "{day} എന്ന ദിവസത്തിലേക്ക് പോകുക",
    pickerPrevMonth: "മുൻ മാസം",
    pickerNextMonth: "അടുത്ത മാസം",
    pickerClose: "അടയ്ക്കുക",
    pickDay: "ഒരു ദിവസം തിരഞ്ഞെടുക്കുക",
    pickerDayLogged: "{day}, ഭക്ഷണങ്ങളുണ്ട്",
    pickerDayUnlogged: "{day}, ഒന്നും രേഖപ്പെടുത്തിയിട്ടില്ല",
    kcalLeft: "kcal ബാക്കി",
    kcalEaten: "kcal കഴിച്ചു",
    kcalOver: "kcal കൂടുതൽ",
    kcalLeftDetail: "kcal ബാക്കി · {eaten} / {plan}",
    kcalEatenDetail: "kcal കഴിച്ചു · {eaten} / {plan}",
    kcalOverDetail: "kcal കൂടുതൽ · {eaten} / {plan}",
    grams: "{n} g",
    milligrams: "{n} mg",
    gramLeft: "{grams} ബാക്കി", gramOver: "{grams} കൂടുതൽ",
    dayNoteSatFat: "പൂരിത കൊഴുപ്പ്",

    macros: {
      protein: { name: "പ്രോട്ടീൻ", left: "പ്രോട്ടീൻ ബാക്കി", over: "പ്രോട്ടീൻ കൂടുതൽ", ofTarget: "/ {target} പ്രോട്ടീൻ", chip: "പ്രോട്ടീൻ {n} g" },
      carbs: { name: "കാർബ്സ്", left: "കാർബ്സ് ബാക്കി", over: "കാർബ്സ് കൂടുതൽ", ofTarget: "/ {target} കാർബ്സ്", chip: "കാർബ്സ് {n} g" },
      fat: { name: "കൊഴുപ്പ്", left: "കൊഴുപ്പ് ബാക്കി", over: "കൊഴുപ്പ് കൂടുതൽ", ofTarget: "/ {target} കൊഴുപ്പ്", chip: "കൊഴുപ്പ് {n} g" },
      satFat: { name: "പൂരിത കൊഴുപ്പ്", left: "പൂരിത കൊഴുപ്പ് ബാക്കി", over: "പൂരിത കൊഴുപ്പ് കൂടുതൽ", ofTarget: "/ {target} പൂരിത കൊഴുപ്പ്", chip: "പൂരിത കൊഴുപ്പ് {n} g" },
      sodium: { name: "സോഡിയം", left: "സോഡിയം ബാക്കി", over: "സോഡിയം കൂടുതൽ", ofTarget: "/ {target} സോഡിയം", chip: "സോഡിയം {n} mg" },
      fibre: { name: "നാരുകൾ", chip: "നാരുകൾ {n} g" },
      sugar: { name: "പഞ്ചസാര", chip: "പഞ്ചസാര {n} g" },
    },
    tips: {
      protein: {
        togo: "അടുത്ത ഭക്ഷണത്തിൽ ഒരു പ്രോട്ടീൻ സ്രോതസ്സ് ചേർക്കൂ: മുട്ട, ഗ്രീക്ക് യോഗർട്ട്, പനീർ, ചിക്കൻ, മീൻ, ടോഫു അല്ലെങ്കിൽ പയർ.",
        reached: "ഇന്നത്തെ പ്രോട്ടീൻ ആയി. ഇനി കൂടുതൽ വേണമെങ്കിൽ മാത്രം.",
        over: "ഇന്ന് ആവശ്യത്തിന് പ്രോട്ടീൻ ആയി. നാളെ വരെ അധിക ഇറച്ചി, മീൻ, മുട്ട, പ്രോട്ടീൻ ഷേക്ക് എന്നിവ ഒഴിവാക്കൂ.",
      },
      carbs: {
        left: "ഇന്ന് ചെറിയ അളവിൽ ബ്രെഡ്, ചോറ്, പാസ്ത അല്ലെങ്കിൽ പഴം കഴിക്കാൻ ഇടമുണ്ട്.",
        over: "ഇന്നത്തെ ബാക്കി സമയം കാർബ്സ് പരിമിതപ്പെടുത്തൂ. ബ്രെഡ്, ചോറ്, പാസ്ത, മധുരപലഹാരങ്ങൾ, മധുരപാനീയങ്ങൾ എന്നിവ കുറയ്ക്കൂ.",
      },
      satfat: {
        left: "ഇന്നത്തെ പരിധിയോട് അടുത്തെത്തി. കൊഴുപ്പ് കുറഞ്ഞ ഇറച്ചി, മീൻ അല്ലെങ്കിൽ സസ്യാധിഷ്ഠിത ഓപ്ഷനുകൾ തിരഞ്ഞെടുക്കൂ.",
        over: "ഇന്നത്തെ ബാക്കി സമയം വെണ്ണ, ചീസ്, കൊഴുപ്പുള്ള ഇറച്ചി, പേസ്ട്രി, വറുത്ത ആഹാരം എന്നിവ പരിമിതപ്പെടുത്തൂ.",
      },
    },
    recentlyUploaded: "അടുത്തിടെ",


    nothingLogged: "ഇതുവരെ ഒന്നും രേഖപ്പെടുത്തിയിട്ടില്ല.",
    diaryFailed: "നിങ്ങളുടെ ഡയറി ലോഡ് ചെയ്യാനായില്ല.",
    tryAgain: "വീണ്ടും ശ്രമിക്കുക",
    webUploadPhoto: "ഫോട്ടോ അപ്ലോഡ് ചെയ്യുക",
    webComposerPlaceholder: "എന്ത് കഴിച്ചെന്ന് പറയൂ, അല്ലെങ്കിൽ ഫോട്ടോ ഇടൂ",
    webDayRegion: "ദിവസത്തെ സംഗ്രഹം",
    webProposalLead: "രേഖപ്പെടുത്തുന്നത്: {day} — ശരിയാണോ?",
    todayWord: "ഇന്ന്",
    webLogIt: "രേഖപ്പെടുത്തൂ",
    webProposalNo: "വേണ്ട",
    webPage: "പേജ് {n} / {total}",
    webDone: "പൂർത്തിയായി",
    queue: { uploading: "ഫോട്ടോ അപ്ലോഡ് ചെയ്യുന്നു · 1 / 4", waiting: "അയയ്ക്കാൻ കാത്തിരിക്കുന്നു", notMeal: "അത് ഒരു ഭക്ഷണമായി തോന്നുന്നില്ല", unread: "ഈ ഫോട്ടോ വായിക്കാനായില്ല", nothingCounted: "ഒന്നും എണ്ണിയില്ല.", retake: "വീണ്ടും എടുക്കുക", remove: "നീക്കം ചെയ്യുക", question: "≈{kcal} ആയി എണ്ണി. ഒരു വിവരം കൂടി കിട്ടിയാൽ കൂടുതൽ കൃത്യമാകും.", answer: "1 ചോദ്യത്തിന് ഉത്തരം നൽകുക", dropTitle: "രേഖപ്പെടുത്താൻ എവിടെയും ഒരു ഫോട്ടോ ഇടൂ", dropSub: "അല്ലെങ്കിൽ സന്ദേശ ബോക്സിൽ പേസ്റ്റ് ചെയ്യൂ", addedTitle: "നിങ്ങളുടെ ദിവസത്തിലേക്ക് ചേർത്തു", addedSub: "ഞങ്ങൾ അത് എണ്ണും. ആപ്പ് അടയ്ക്കാം.", beingRead: "{time} · വായിക്കുന്നു, ആപ്പ് അടയ്ക്കാം", found: "കണ്ടെത്തിയ ആഹാരങ്ങൾ: {n}", labelRead: "നിങ്ങളുടെ ഫോട്ടോയിലെ പോഷക ലേബലിൽ നിന്ന് വായിച്ചത്.", unreadableLabel: "ആ ലേബൽ വായിക്കാനായില്ല.", asMealPhoto: "ഭക്ഷണ ഫോട്ടോയായി വിശകലനം ചെയ്യുക" },
  },
  kn: {
    phoneToday: "ಇಂದು",
    phoneStreakAria: "{n} ದಿನದ ಸ್ಟ್ರೀಕ್",
    phoneStreakGoalAria: "{goal} ಪೈಕಿ {n} ದಿನ",
    phoneDayNote: "ರಾತ್ರಿಯ ಊಟ ಹಗುರವಾಗಿರಲಿ: {nutrient} ಇನ್ನು {grams} g ಮಾತ್ರ ಉಳಿದಿದೆ.",
    phoneGoToDay: "ಈ ದಿನಕ್ಕೆ ಹೋಗಿ: {day}",
    pickerPrevMonth: "ಹಿಂದಿನ ತಿಂಗಳು",
    pickerNextMonth: "ಮುಂದಿನ ತಿಂಗಳು",
    pickerClose: "ಮುಚ್ಚಿ",
    pickDay: "ಒಂದು ದಿನ ಆರಿಸಿ",
    pickerDayLogged: "{day}, ಊಟಗಳಿವೆ",
    pickerDayUnlogged: "{day}, ಏನೂ ದಾಖಲಿಸಿಲ್ಲ",
    kcalLeft: "kcal ಉಳಿದಿದೆ",
    kcalEaten: "kcal ತಿನ್ನಲಾಗಿದೆ",
    kcalOver: "kcal ಹೆಚ್ಚು",
    kcalLeftDetail: "kcal ಉಳಿದಿದೆ · {plan} ಪೈಕಿ {eaten}",
    kcalEatenDetail: "kcal ತಿನ್ನಲಾಗಿದೆ · {plan} ಪೈಕಿ {eaten}",
    kcalOverDetail: "kcal ಹೆಚ್ಚು · {plan} ಪೈಕಿ {eaten}",
    grams: "{n} g",
    milligrams: "{n} mg",
    gramLeft: "{grams} ಉಳಿದಿದೆ", gramOver: "{grams} ಹೆಚ್ಚು",
    dayNoteSatFat: "ಸ್ಯಾಚುರೇಟೆಡ್ ಕೊಬ್ಬು",

    macros: {
      protein: { name: "ಪ್ರೋಟೀನ್", left: "ಪ್ರೋಟೀನ್ ಉಳಿದಿದೆ", over: "ಪ್ರೋಟೀನ್ ಹೆಚ್ಚು", ofTarget: "{target} ಪ್ರೋಟೀನ್ ಪೈಕಿ", chip: "ಪ್ರೋಟೀನ್ {n} g" },
      carbs: { name: "ಕಾರ್ಬ್ಸ್", left: "ಕಾರ್ಬ್ಸ್ ಉಳಿದಿದೆ", over: "ಕಾರ್ಬ್ಸ್ ಹೆಚ್ಚು", ofTarget: "{target} ಕಾರ್ಬ್ಸ್ ಪೈಕಿ", chip: "ಕಾರ್ಬ್ಸ್ {n} g" },
      fat: { name: "ಕೊಬ್ಬು", left: "ಕೊಬ್ಬು ಉಳಿದಿದೆ", over: "ಕೊಬ್ಬು ಹೆಚ್ಚು", ofTarget: "{target} ಕೊಬ್ಬು ಪೈಕಿ", chip: "ಕೊಬ್ಬು {n} g" },
      satFat: { name: "ಸ್ಯಾಚುರೇಟೆಡ್ ಕೊಬ್ಬು", left: "ಸ್ಯಾಚುರೇಟೆಡ್ ಕೊಬ್ಬು ಉಳಿದಿದೆ", over: "ಸ್ಯಾಚುರೇಟೆಡ್ ಕೊಬ್ಬು ಹೆಚ್ಚು", ofTarget: "{target} ಸ್ಯಾಚುರೇಟೆಡ್ ಕೊಬ್ಬು ಪೈಕಿ", chip: "ಸ್ಯಾಚುರೇಟೆಡ್ ಕೊಬ್ಬು {n} g" },
      sodium: { name: "ಸೋಡಿಯಂ", left: "ಸೋಡಿಯಂ ಉಳಿದಿದೆ", over: "ಸೋಡಿಯಂ ಹೆಚ್ಚು", ofTarget: "{target} ಸೋಡಿಯಂ ಪೈಕಿ", chip: "ಸೋಡಿಯಂ {n} mg" },
      fibre: { name: "ನಾರಿನಂಶ", chip: "ನಾರಿನಂಶ {n} g" },
      sugar: { name: "ಸಕ್ಕರೆ", chip: "ಸಕ್ಕರೆ {n} g" },
    },
    tips: {
      protein: {
        togo: "ನಿಮ್ಮ ಮುಂದಿನ ಊಟಕ್ಕೆ ಪ್ರೋಟೀನ್ ಮೂಲ ಸೇರಿಸಿ: ಮೊಟ್ಟೆ, ಗ್ರೀಕ್ ಮೊಸರು, ಕಾಟೇಜ್ ಚೀಸ್, ಚಿಕನ್, ಮೀನು, ಟೋಫು ಅಥವಾ ಬೇಳೆ.",
        reached: "ಇಂದಿನ ಪ್ರೋಟೀನ್ ಆಯಿತು. ಇನ್ನೂ ಹೆಚ್ಚಿನದು ಐಚ್ಛಿಕ.",
        over: "ಇಂದು ಸಾಕಷ್ಟು ಪ್ರೋಟೀನ್ ಆಗಿದೆ. ನಾಳೆಯವರೆಗೆ ಹೆಚ್ಚುವರಿ ಮಾಂಸ, ಮೀನು, ಮೊಟ್ಟೆ ಮತ್ತು ಪ್ರೋಟೀನ್ ಶೇಕ್ ಬೇಡ.",
      },
      carbs: {
        left: "ಇಂದು ಸ್ವಲ್ಪ ಬ್ರೆಡ್, ಅನ್ನ, ಪಾಸ್ತಾ ಅಥವಾ ಹಣ್ಣಿಗೆ ಜಾಗವಿದೆ.",
        over: "ಇಂದಿನ ಉಳಿದ ದಿನ ಕಾರ್ಬ್ಸ್ ಮಿತಿಗೊಳಿಸಿ. ಬ್ರೆಡ್, ಅನ್ನ, ಪಾಸ್ತಾ, ಸಿಹಿತಿಂಡಿ ಮತ್ತು ಸಿಹಿ ಪಾನೀಯಗಳನ್ನು ಕಡಿಮೆ ಮಾಡಿ.",
      },
      satfat: {
        left: "ನೀವು ಇಂದಿನ ಮಿತಿಯ ಹತ್ತಿರ ಇದ್ದೀರಿ. ಕಡಿಮೆ ಕೊಬ್ಬಿನ ಮಾಂಸ, ಮೀನು ಅಥವಾ ಸಸ್ಯಾಧಾರಿತ ಆಯ್ಕೆಗಳನ್ನು ಆರಿಸಿ.",
        over: "ಇಂದಿನ ಉಳಿದ ದಿನ ಬೆಣ್ಣೆ, ಚೀಸ್, ಕೊಬ್ಬಿನ ಮಾಂಸ, ಪೇಸ್ಟ್ರಿ ಮತ್ತು ಕರಿದ ಆಹಾರವನ್ನು ಮಿತಿಗೊಳಿಸಿ.",
      },
    },
    recentlyUploaded: "ಇತ್ತೀಚಿನವು",


    nothingLogged: "ಇನ್ನೂ ಏನೂ ದಾಖಲಿಸಿಲ್ಲ.",
    diaryFailed: "ನಿಮ್ಮ ಡೈರಿಯನ್ನು ಲೋಡ್ ಮಾಡಲಾಗಲಿಲ್ಲ.",
    tryAgain: "ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ",
    webUploadPhoto: "ಫೋಟೋ ಅಪ್‌ಲೋಡ್ ಮಾಡಿ",
    webComposerPlaceholder: "ಏನು ತಿಂದಿರಿ ಎಂದು ಹೇಳಿ, ಅಥವಾ ಫೋಟೋ ಹಾಕಿ",
    webDayRegion: "ದಿನದ ಸಾರಾಂಶ",
    webProposalLead: "ದಾಖಲಿಸುವ ದಿನ: {day} — ಸರಿಯೇ?",
    todayWord: "ಇಂದು",
    webLogIt: "ದಾಖಲಿಸಿ",
    webProposalNo: "ಬೇಡ",
    webPage: "ಪುಟ {n} / {total}",
    webDone: "ಮುಗಿದಿದೆ",
    queue: { uploading: "ಫೋಟೋ ಅಪ್‌ಲೋಡ್ ಆಗುತ್ತಿದೆ · 1 / 4", waiting: "ಕಳುಹಿಸಲು ಕಾಯುತ್ತಿದೆ", notMeal: "ಅದು ಊಟದಂತೆ ಕಾಣುತ್ತಿಲ್ಲ", unread: "ಈ ಫೋಟೋ ಓದಲಾಗಲಿಲ್ಲ", nothingCounted: "ಏನೂ ಎಣಿಕೆಯಾಗಲಿಲ್ಲ.", retake: "ಮತ್ತೆ ತೆಗೆಯಿರಿ", remove: "ತೆಗೆದುಹಾಕಿ", question: "≈{kcal} ಎಂದು ಎಣಿಸಲಾಗಿದೆ. ಒಂದು ವಿವರ ಇದನ್ನು ಹೆಚ್ಚು ನಿಖರಗೊಳಿಸುತ್ತದೆ.", answer: "1 ಪ್ರಶ್ನೆಗೆ ಉತ್ತರಿಸಿ", dropTitle: "ದಾಖಲಿಸಲು ಫೋಟೋವನ್ನು ಎಲ್ಲಿಯಾದರೂ ಹಾಕಿ", dropSub: "ಅಥವಾ ಕಂಪೋಸರ್‌ಗೆ ಪೇಸ್ಟ್ ಮಾಡಿ", addedTitle: "ನಿಮ್ಮ ದಿನಕ್ಕೆ ಸೇರಿಸಲಾಗಿದೆ", addedSub: "ನಾವು ಅದನ್ನು ಎಣಿಸುತ್ತೇವೆ. ನೀವು ಆ್ಯಪ್ ಮುಚ್ಚಬಹುದು.", beingRead: "{time} · ಓದಲಾಗುತ್ತಿದೆ, ನೀವು ಆ್ಯಪ್ ಮುಚ್ಚಬಹುದು", found: "ಸಿಕ್ಕ ಆಹಾರಗಳು: {n}", labelRead: "ನಿಮ್ಮ ಫೋಟೋದಲ್ಲಿರುವ ಪೋಷಕಾಂಶ ಲೇಬಲ್‌ನಿಂದ ಓದಲಾಗಿದೆ.", unreadableLabel: "ಆ ಲೇಬಲ್ ಓದಲಾಗಲಿಲ್ಲ.", asMealPhoto: "ಊಟದ ಫೋಟೋ ಆಗಿ ವಿಶ್ಲೇಷಿಸಿ" },
  },
  gu: {
    phoneToday: "આજે",
    phoneStreakAria: "{n} દિવસની સ્ટ્રીક",
    phoneStreakGoalAria: "{goal} માંથી {n} દિવસ",
    phoneDayNote: "રાતનું ભોજન હળવું રાખો: {nutrient} ના {grams} g બાકી.",
    phoneGoToDay: "{day} પર જાઓ",
    pickerPrevMonth: "પાછલો મહિનો",
    pickerNextMonth: "આગલો મહિનો",
    pickerClose: "બંધ કરો",
    pickDay: "દિવસ પસંદ કરો",
    pickerDayLogged: "{day}, ભોજન નોંધાયેલાં છે",
    pickerDayUnlogged: "{day}, કંઈ નોંધાયું નથી",
    kcalLeft: "kcal બાકી",
    kcalEaten: "kcal ખાધી",
    kcalOver: "kcal વધુ",
    kcalLeftDetail: "kcal બાકી · {plan} માંથી {eaten}",
    kcalEatenDetail: "kcal ખાધી · {plan} માંથી {eaten}",
    kcalOverDetail: "kcal વધુ · {plan} માંથી {eaten}",
    grams: "{n} g",
    milligrams: "{n} mg",
    gramLeft: "{grams} બાકી", gramOver: "{grams} વધુ",
    dayNoteSatFat: "સેચ્યુરેટેડ ફેટ",

    macros: {
      protein: { name: "પ્રોટીન", left: "પ્રોટીન બાકી", over: "પ્રોટીન વધુ", ofTarget: "{target} પ્રોટીનમાંથી", chip: "પ્રોટીન {n} g" },
      carbs: { name: "કાર્બ્સ", left: "કાર્બ્સ બાકી", over: "કાર્બ્સ વધુ", ofTarget: "{target} કાર્બ્સમાંથી", chip: "કાર્બ્સ {n} g" },
      fat: { name: "ફેટ", left: "ફેટ બાકી", over: "ફેટ વધુ", ofTarget: "{target} ફેટમાંથી", chip: "ફેટ {n} g" },
      satFat: { name: "સેચ્યુ. ફેટ", left: "સેચ્યુ. ફેટ બાકી", over: "સેચ્યુ. ફેટ વધુ", ofTarget: "{target} સેચ્યુરેટેડ ફેટમાંથી", chip: "સેચ્યુ. ફેટ {n} g" },
      sodium: { name: "સોડિયમ", left: "સોડિયમ બાકી", over: "સોડિયમ વધુ", ofTarget: "{target} સોડિયમમાંથી", chip: "સોડિયમ {n} mg" },
      fibre: { name: "ફાઇબર", chip: "ફાઇબર {n} g" },
      sugar: { name: "ખાંડ", chip: "ખાંડ {n} g" },
    },
    tips: {
      protein: {
        togo: "તમારા આગલા ભોજનમાં પ્રોટીનનો કોઈ સ્રોત ઉમેરો: ઈંડાં, ગ્રીક યોગર્ટ, પનીર, ચિકન, માછલી, ટોફુ અથવા દાળ.",
        reached: "આજનું પ્રોટીન થઈ ગયું. તેનાથી વધુ વૈકલ્પિક છે.",
        over: "આજે પૂરતું પ્રોટીન થઈ ગયું છે. કાલ સુધી વધારાનું માંસ, માછલી, ઈંડાં અને પ્રોટીન શેક ટાળો.",
      },
      carbs: {
        left: "આજે બ્રેડ, ભાત, પાસ્તા અથવા ફળના નાના પોર્શન માટે જગ્યા છે.",
        over: "આજના બાકીના દિવસ માટે કાર્બ્સ મર્યાદિત રાખો. બ્રેડ, ભાત, પાસ્તા, મીઠાઈ અને મીઠાં પીણાં ઓછાં લો.",
      },
      satfat: {
        left: "તમે આજની મર્યાદાની નજીક છો. ઓછી ચરબીવાળું માંસ, માછલી અથવા પ્લાન્ટ-બેઝ્ડ વિકલ્પ પસંદ કરો.",
        over: "આજના બાકીના દિવસ માટે માખણ, ચીઝ, ચરબીવાળું માંસ, પેસ્ટ્રી અને તળેલો ખોરાક મર્યાદિત રાખો.",
      },
    },
    recentlyUploaded: "તાજેતરનાં",


    nothingLogged: "હજી કંઈ નોંધાયું નથી.",
    diaryFailed: "તમારી ડાયરી લોડ થઈ શકી નહીં.",
    tryAgain: "ફરી પ્રયાસ કરો",
    webUploadPhoto: "ફોટો અપલોડ કરો",
    webComposerPlaceholder: "તમે શું ખાધું તે કહો, અથવા ફોટો નાખો",
    webDayRegion: "દિવસનો સારાંશ",
    webProposalLead: "{day} માં નોંધી રહ્યા છીએ — બરાબર છે?",
    todayWord: "આજે",
    webLogIt: "નોંધો",
    webProposalNo: "ના",
    webPage: "પેજ {n}/{total}",
    webDone: "થઈ ગયું",
    queue: { uploading: "ફોટો અપલોડ થઈ રહ્યો છે · 4 માંથી 1", waiting: "મોકલવાની રાહ જુએ છે", notMeal: "આ ભોજન જેવું લાગતું નથી", unread: "આ ફોટો વાંચી શકાયો નહીં", nothingCounted: "કંઈ ગણાયું નથી.", retake: "ફરી લો", remove: "દૂર કરો", question: "≈{kcal} તરીકે ગણ્યું. એક વિગતથી તે વધુ ચોક્કસ થશે.", answer: "1 પ્રશ્નનો જવાબ આપો", dropTitle: "નોંધવા માટે ગમે ત્યાં ફોટો નાખો", dropSub: "અથવા તેને મેસેજ બૉક્સમાં પેસ્ટ કરો", addedTitle: "તમારા દિવસમાં ઉમેર્યું", addedSub: "અમે તેને ગણી લઈશું. હવે ઍપ બંધ કરી શકાય છે.", beingRead: "{time} · વંચાઈ રહ્યું છે, ઍપ બંધ કરી શકાય છે", found: "મળેલા ખાદ્ય પદાર્થો: {n}", labelRead: "તમારા ફોટામાંના પોષણ લેબલ પરથી વાંચ્યું.", unreadableLabel: "તે લેબલ વાંચી શકાયું નહીં.", asMealPhoto: "તેને ભોજનના ફોટા તરીકે વિશ્લેષણ કરો" },
  },
  bn: {
    phoneToday: "আজ",
    phoneStreakAria: "{n} দিনের স্ট্রিক",
    phoneStreakGoalAria: "{goal} দিনের মধ্যে {n} দিন",
    phoneDayNote: "রাতের খাবার হালকা রাখুন: {nutrient} আর {grams} g বাকি।",
    phoneGoToDay: "{day} দেখুন",
    pickerPrevMonth: "আগের মাস",
    pickerNextMonth: "পরের মাস",
    pickerClose: "বন্ধ করুন",
    pickDay: "একটি দিন বাছাই করুন",
    pickerDayLogged: "{day}, খাবার লগ করা আছে",
    pickerDayUnlogged: "{day}, কিছু লগ করা নেই",
    kcalLeft: "kcal বাকি",
    kcalEaten: "kcal খাওয়া হয়েছে",
    kcalOver: "kcal বেশি",
    kcalLeftDetail: "kcal বাকি · {plan}-এর মধ্যে {eaten}",
    kcalEatenDetail: "kcal খাওয়া হয়েছে · {plan}-এর মধ্যে {eaten}",
    kcalOverDetail: "kcal বেশি · {plan}-এর মধ্যে {eaten}",
    grams: "{n} g",
    milligrams: "{n} mg",
    gramLeft: "{grams} বাকি", gramOver: "{grams} বেশি",
    dayNoteSatFat: "স্যাচুরেটেড ফ্যাট",

    macros: {
      protein: { name: "প্রোটিন", left: "প্রোটিন বাকি", over: "প্রোটিন বেশি", ofTarget: "{target} প্রোটিনের মধ্যে", chip: "প্রোটিন {n} g" },
      carbs: { name: "কার্বস", left: "কার্বস বাকি", over: "কার্বস বেশি", ofTarget: "{target} কার্বসের মধ্যে", chip: "কার্বস {n} g" },
      fat: { name: "ফ্যাট", left: "ফ্যাট বাকি", over: "ফ্যাট বেশি", ofTarget: "{target} ফ্যাটের মধ্যে", chip: "ফ্যাট {n} g" },
      satFat: { name: "স্যাচু. ফ্যাট", left: "স্যাচু. ফ্যাট বাকি", over: "স্যাচু. ফ্যাট বেশি", ofTarget: "{target} স্যাচুরেটেড ফ্যাটের মধ্যে", chip: "স্যাচু. ফ্যাট {n} g" },
      sodium: { name: "সোডিয়াম", left: "সোডিয়াম বাকি", over: "সোডিয়াম বেশি", ofTarget: "{target} সোডিয়ামের মধ্যে", chip: "সোডিয়াম {n} mg" },
      fibre: { name: "ফাইবার", chip: "ফাইবার {n} g" },
      sugar: { name: "চিনি", chip: "চিনি {n} g" },
    },
    tips: {
      protein: {
        togo: "পরের খাবারে একটি প্রোটিনের উৎস যোগ করুন: ডিম, গ্রিক দই, কটেজ চিজ, চিকেন, মাছ, টোফু বা ডাল।",
        reached: "আজকের প্রোটিন হয়ে গেছে। এর বেশি খাওয়া ঐচ্ছিক।",
        over: "আজ যথেষ্ট প্রোটিন হয়ে গেছে। কাল পর্যন্ত বাড়তি মাংস, মাছ, ডিম ও প্রোটিন শেক বাদ রাখুন।",
      },
      carbs: {
        left: "আজ অল্প একটু রুটি, ভাত, পাস্তা বা ফলের জায়গা আছে।",
        over: "আজকের বাকি সময় কার্বস সীমিত রাখুন। রুটি, ভাত, পাস্তা, মিষ্টি ও মিষ্টি পানীয় কম খান।",
      },
      satfat: {
        left: "আপনি আজকের সীমার কাছাকাছি। কম চর্বির মাংস, মাছ বা উদ্ভিজ্জ বিকল্প বেছে নিন।",
        over: "আজকের বাকি সময় মাখন, চিজ, চর্বিযুক্ত মাংস, পেস্ট্রি ও ভাজা খাবার সীমিত রাখুন।",
      },
    },
    recentlyUploaded: "সাম্প্রতিক",


    nothingLogged: "এখনও কিছু লগ করা হয়নি।",
    diaryFailed: "আপনার ডায়েরি লোড করা যায়নি।",
    tryAgain: "আবার চেষ্টা করুন",
    webUploadPhoto: "ছবি আপলোড করুন",
    webComposerPlaceholder: "কী খেয়েছেন বলুন, বা একটি ছবি দিন",
    webDayRegion: "দিনের সারসংক্ষেপ",
    webProposalLead: "লগ করছি: {day} — ঠিক আছে?",
    todayWord: "আজ",
    webLogIt: "লগ করুন",
    webProposalNo: "না",
    webPage: "পেজ {n}/{total}",
    webDone: "সম্পন্ন",
    queue: { uploading: "ছবি আপলোড হচ্ছে · 1/4", waiting: "পাঠানোর অপেক্ষায়", notMeal: "এটি খাবার বলে মনে হচ্ছে না", unread: "এই ছবিটি পড়া যায়নি", nothingCounted: "কিছুই গণনা করা হয়নি।", retake: "আবার তুলুন", remove: "সরান", question: "≈{kcal} হিসেবে গণনা করা হয়েছে। একটি তথ্য পেলে আরও নির্ভুল হবে।", answer: "1টি প্রশ্নের উত্তর দিন", dropTitle: "লগ করতে যেকোনো জায়গায় ছবি দিন", dropSub: "অথবা মেসেজ বক্সে পেস্ট করুন", addedTitle: "আপনার দিনে যোগ হয়েছে", addedSub: "আমরা এটি গণনা করে নেব। আপনি অ্যাপ বন্ধ করতে পারেন।", beingRead: "{time} · পড়া হচ্ছে, অ্যাপ বন্ধ করতে পারেন", found: "পাওয়া খাবার: {n}", labelRead: "আপনার ছবির পুষ্টি লেবেল থেকে পড়া।", unreadableLabel: "লেবেলটি পড়া যায়নি।", asMealPhoto: "খাবারের ছবি হিসেবে বিশ্লেষণ করুন" },
  },
  "pt-PT": {
    phoneToday: "Hoje",
    phoneStreakAria: "Sequência de {n} dias",
    phoneStreakGoalAria: "{n} de {goal} dias",
    phoneDayNote: "Jantar leve: faltam {grams} g de {nutrient}.",
    phoneGoToDay: "Ir para {day}",
    pickerPrevMonth: "Mês anterior",
    pickerNextMonth: "Mês seguinte",
    pickerClose: "Fechar",
    pickDay: "Escolhe um dia",
    pickerDayLogged: "{day}, com refeições",
    pickerDayUnlogged: "{day}, nada registado",
    kcalLeft: "kcal restantes",
    kcalEaten: "kcal consumidas",
    kcalOver: "kcal acima",
    kcalLeftDetail: "kcal restantes · {eaten} de {plan}",
    kcalEatenDetail: "kcal consumidas · {eaten} de {plan}",
    kcalOverDetail: "kcal acima · {eaten} de {plan}",
    grams: "{n} g",
    milligrams: "{n} mg",
    gramLeft: "{grams} restantes", gramOver: "{grams} acima",
    dayNoteSatFat: "gordura saturada",

    macros: {
      protein: { name: "proteína", left: "Proteína restante", over: "Proteína acima", ofTarget: "de {target} de proteína", chip: "proteína {n} g" },
      carbs: { name: "hidratos", left: "Hidratos restantes", over: "Hidratos acima", ofTarget: "de {target} de hidratos", chip: "hidratos {n} g" },
      fat: { name: "gordura", left: "Gordura restante", over: "Gordura acima", ofTarget: "de {target} de gordura", chip: "gordura {n} g" },
      satFat: { name: "gord. saturada", left: "Gord. saturada restante", over: "Gord. saturada acima", ofTarget: "de {target} de gord. saturada", chip: "gord. saturada {n} g" },
      sodium: { name: "Sódio", left: "Sódio restante", over: "Sódio acima", ofTarget: "de {target} de sódio", chip: "sódio {n} mg" },
      fibre: { name: "Fibra", chip: "fibra {n} g" },
      sugar: { name: "Açúcar", chip: "açúcar {n} g" },
    },
    tips: {
      protein: {
        togo: "Inclui uma fonte de proteína na próxima refeição: ovos, iogurte grego, queijo cottage, frango, peixe, tofu ou lentilhas.",
        reached: "Essa é a proteína de hoje. Mais do que isso é opcional.",
        over: "Já comeste proteína suficiente hoje. Deixa carne, peixe, ovos e batidos de proteína extra para amanhã.",
      },
      carbs: {
        left: "Ainda há espaço para uma pequena porção de pão, arroz, massa ou fruta hoje.",
        over: "Limita os hidratos no resto do dia. Modera o pão, o arroz, a massa, os doces e as bebidas açucaradas.",
      },
      satfat: {
        left: "Estás perto do limite de hoje. Prefere carne magra, peixe ou opções vegetais.",
        over: "Limita manteiga, queijo, carne gorda, pastelaria e fritos no resto do dia.",
      },
    },
    recentlyUploaded: "Recentes",


    nothingLogged: "Ainda nada registado.",
    diaryFailed: "Não foi possível carregar o teu diário.",
    tryAgain: "Tentar novamente",
    webUploadPhoto: "Carregar uma foto",
    webComposerPlaceholder: "Diz o que comeste ou arrasta uma foto",
    webDayRegion: "Resumo do dia",
    webProposalLead: "A registar para {day} — está certo?",
    todayWord: "hoje",
    webLogIt: "Registar",
    webProposalNo: "Não",
    webPage: "Página {n} de {total}",
    webDone: "OK",
    queue: { uploading: "A carregar foto · 1 de 4", waiting: "À espera de envio", notMeal: "Isto não parece uma refeição", unread: "Não foi possível ler esta foto", nothingCounted: "Nada foi contado.", retake: "Tirar outra", remove: "Remover", question: "Contado como ≈{kcal}. Um detalhe tornaria o valor mais preciso.", answer: "Responder a 1 pergunta", dropTitle: "Arrasta uma foto para qualquer lado para a registar", dropSub: "ou cola uma na caixa de texto", addedTitle: "Adicionado ao teu dia", addedSub: "Nós fazemos as contas. Podes fechar a app.", beingRead: "{time} · em análise, podes fechar a app", found: "Alimentos encontrados: {n}", labelRead: "Lido no rótulo nutricional da tua foto.", unreadableLabel: "Não foi possível ler este rótulo.", asMealPhoto: "Analisar como foto de refeição" },
  },
  ms: {
    phoneToday: "Hari ini",
    phoneStreakAria: "Rentetan {n} hari",
    phoneStreakGoalAria: "{n} daripada {goal} hari",
    phoneDayNote: "Pastikan makan malam ringan: tinggal {grams} g {nutrient}.",
    phoneGoToDay: "Pergi ke {day}",
    pickerPrevMonth: "Bulan sebelumnya",
    pickerNextMonth: "Bulan seterusnya",
    pickerClose: "Tutup",
    pickDay: "Pilih hari",
    pickerDayLogged: "{day}, ada hidangan",
    pickerDayUnlogged: "{day}, tiada yang dicatat",
    kcalLeft: "kcal baki",
    kcalEaten: "kcal dimakan",
    kcalOver: "kcal lebih",
    kcalLeftDetail: "kcal baki · {eaten} daripada {plan}",
    kcalEatenDetail: "kcal dimakan · {eaten} daripada {plan}",
    kcalOverDetail: "kcal lebih · {eaten} daripada {plan}",
    grams: "{n} g",
    milligrams: "{n} mg",
    gramLeft: "baki {grams}", gramOver: "lebih {grams}",
    dayNoteSatFat: "lemak tepu",

    macros: {
      protein: { name: "protein", left: "Baki protein", over: "Protein lebih", ofTarget: "daripada {target} protein", chip: "protein {n} g" },
      carbs: { name: "karbohidrat", left: "Baki karbohidrat", over: "Karbohidrat lebih", ofTarget: "daripada {target} karbohidrat", chip: "karbohidrat {n} g" },
      fat: { name: "lemak", left: "Baki lemak", over: "Lemak lebih", ofTarget: "daripada {target} lemak", chip: "lemak {n} g" },
      satFat: { name: "lemak tepu", left: "Baki lemak tepu", over: "Lemak tepu lebih", ofTarget: "daripada {target} lemak tepu", chip: "lemak tepu {n} g" },
      sodium: { name: "Natrium", left: "Baki natrium", over: "Natrium lebih", ofTarget: "daripada {target} natrium", chip: "natrium {n} mg" },
      fibre: { name: "Serat", chip: "serat {n} g" },
      sugar: { name: "Gula", chip: "gula {n} g" },
    },
    tips: {
      protein: {
        togo: "Tambah sumber protein pada hidangan seterusnya: telur, yogurt Greek, keju kotej, ayam, ikan, tauhu atau kacang lentil.",
        reached: "Itu protein untuk hari ini. Selebihnya pilihan.",
        over: "Anda sudah cukup protein hari ini. Elakkan daging, ikan, telur dan minuman protein tambahan sehingga esok.",
      },
      carbs: {
        left: "Ada ruang untuk sedikit roti, nasi, pasta atau buah hari ini.",
        over: "Hadkan karbohidrat untuk baki hari ini. Kurangkan roti, nasi, pasta, makanan manis dan minuman manis.",
      },
      satfat: {
        left: "Anda hampir mencapai had hari ini. Pilih daging tanpa lemak, ikan atau pilihan berasaskan tumbuhan.",
        over: "Hadkan mentega, keju, daging berlemak, pastri dan makanan bergoreng untuk baki hari ini.",
      },
    },
    recentlyUploaded: "Terkini",


    nothingLogged: "Belum ada yang dicatat.",
    diaryFailed: "Tidak dapat memuatkan diari anda.",
    tryAgain: "Cuba lagi",
    webUploadPhoto: "Muat naik foto",
    webComposerPlaceholder: "Beritahu saya apa yang anda makan, atau letakkan foto",
    webDayRegion: "Ringkasan hari",
    webProposalLead: "Mencatat untuk {day} — betul?",
    todayWord: "hari ini",
    webLogIt: "Catat",
    webProposalNo: "Tidak",
    webPage: "Halaman {n} daripada {total}",
    webDone: "Selesai",
    queue: { uploading: "Memuat naik foto · 1 daripada 4", waiting: "Menunggu untuk dihantar", notMeal: "Itu tidak kelihatan seperti hidangan", unread: "Tidak dapat membaca foto ini", nothingCounted: "Tiada apa yang dikira.", retake: "Ambil semula", remove: "Alih keluar", question: "Dikira sebagai ≈{kcal}. Satu butiran akan menjadikannya lebih tepat.", answer: "Jawab 1 soalan", dropTitle: "Letakkan foto di mana-mana untuk mencatatnya", dropSub: "atau tampalkannya ke dalam kotak mesej", addedTitle: "Ditambah pada hari anda", addedSub: "Kami akan mengiranya. Anda boleh menutup aplikasi.", beingRead: "{time} · sedang dibaca, anda boleh menutup aplikasi", found: "Makanan ditemui: {n}", labelRead: "Dibaca daripada label pemakanan dalam foto anda.", unreadableLabel: "Tidak dapat membaca label itu.", asMealPhoto: "Analisis sebagai foto hidangan" },
  },
  ca: {
    phoneToday: "Avui",
    phoneStreakAria: "Ratxa de {n} dies",
    phoneStreakGoalAria: "{n} de {goal} dies",
    phoneDayNote: "Sopar lleuger: et queden {grams} g de {nutrient}.",
    phoneGoToDay: "Ves a {day}",
    pickerPrevMonth: "Mes anterior",
    pickerNextMonth: "Mes següent",
    pickerClose: "Tanca",
    pickDay: "Tria un dia",
    pickerDayLogged: "{day}, amb àpats",
    pickerDayUnlogged: "{day}, res registrat",
    kcalLeft: "kcal restants",
    kcalEaten: "kcal menjades",
    kcalOver: "kcal de més",
    kcalLeftDetail: "kcal restants · {eaten} de {plan}",
    kcalEatenDetail: "kcal menjades · {eaten} de {plan}",
    kcalOverDetail: "kcal de més · {eaten} de {plan}",
    grams: "{n} g",
    milligrams: "{n} mg",
    gramLeft: "en queden {grams}", gramOver: "{grams} de més",
    dayNoteSatFat: "greix saturat",

    macros: {
      protein: { name: "proteïna", left: "Proteïna restant", over: "Proteïna de més", ofTarget: "de {target} de proteïna", chip: "proteïna {n} g" },
      carbs: { name: "carbohidrats", left: "Carbohidrats restants", over: "Carbohidrats de més", ofTarget: "de {target} de carbohidrats", chip: "carbohidrats {n} g" },
      fat: { name: "greix", left: "Greix restant", over: "Greix de més", ofTarget: "de {target} de greix", chip: "greix {n} g" },
      satFat: { name: "greix sat.", left: "Greix sat. restant", over: "Greix sat. de més", ofTarget: "de {target} de greix sat.", chip: "greix sat. {n} g" },
      sodium: { name: "Sodi", left: "Sodi restant", over: "Sodi de més", ofTarget: "de {target} de sodi", chip: "sodi {n} mg" },
      fibre: { name: "Fibra", chip: "fibra {n} g" },
      sugar: { name: "Sucre", chip: "sucre {n} g" },
    },
    tips: {
      protein: {
        togo: "Afegeix una font de proteïna al pròxim àpat: ous, iogurt grec, mató, pollastre, peix, tofu o llenties.",
        reached: "Aquesta és la proteïna d'avui. Més és opcional.",
        over: "Avui ja has pres prou proteïna. Fins demà, evita més carn, peix, ous i batuts de proteïna.",
      },
      carbs: {
        left: "Avui encara hi ha lloc per a una ració petita de pa, arròs, pasta o fruita.",
        over: "Limita els carbohidrats la resta del dia. Modera't amb el pa, l'arròs, la pasta, els dolços i les begudes ensucrades.",
      },
      satfat: {
        left: "Ja estàs a prop del límit d'avui. Tria carn magra, peix o opcions vegetals.",
        over: "Limita la mantega, el formatge, la carn grassa, la brioixeria i els fregits la resta del dia.",
      },
    },
    recentlyUploaded: "Recents",


    nothingLogged: "Encara no hi ha res registrat.",
    diaryFailed: "No s'ha pogut carregar el teu diari.",
    tryAgain: "Torna-ho a provar",
    webUploadPhoto: "Puja una foto",
    webComposerPlaceholder: "Explica'm què has menjat o deixa-hi una foto",
    webDayRegion: "Resum del dia",
    webProposalLead: "Ho registro a {day} — et sembla bé?",
    todayWord: "avui",
    webLogIt: "Registra'l",
    webProposalNo: "No",
    webPage: "Pàgina {n} de {total}",
    webDone: "Fet",
    queue: { uploading: "Pujant la foto · 1 de 4", waiting: "Pendent d'enviar", notMeal: "Això no sembla un àpat", unread: "No s'ha pogut llegir aquesta foto", nothingCounted: "No s'ha comptat res.", retake: "Repeteix", remove: "Treu", question: "Comptat com a ≈{kcal}. Un detall ho afinaria.", answer: "Respon 1 pregunta", dropTitle: "Deixa una foto a qualsevol lloc per registrar-la", dropSub: "o enganxa-la al quadre de text", addedTitle: "Afegit al teu dia", addedSub: "Ho comptarem. Ja pots tancar l'app.", beingRead: "{time} · s'està llegint, ja pots tancar l'app", found: "Aliments trobats: {n}", labelRead: "Llegit de l'etiqueta nutricional de la teva foto.", unreadableLabel: "No s'ha pogut llegir aquesta etiqueta.", asMealPhoto: "Analitza-la com a foto d'un àpat" },
  },
  sl: {
    phoneToday: "Danes",
    phoneStreakAria: "Dni zapored: {n}",
    phoneStreakGoalAria: "{n} od {goal} dni",
    phoneDayNote: "Lahka večerja: {nutrient} še največ {grams} g.",
    phoneGoToDay: "Odpri dan: {day}",
    pickerPrevMonth: "Prejšnji mesec",
    pickerNextMonth: "Naslednji mesec",
    pickerClose: "Zapri",
    pickDay: "Izberi dan",
    pickerDayLogged: "{day}, ima obroke",
    pickerDayUnlogged: "{day}, nič zabeleženo",
    kcalLeft: "kcal ostane",
    kcalEaten: "kcal pojedeno",
    kcalOver: "kcal preveč",
    kcalLeftDetail: "kcal ostane · {eaten} od {plan}",
    kcalEatenDetail: "kcal pojedeno · {eaten} od {plan}",
    kcalOverDetail: "kcal preveč · {eaten} od {plan}",
    grams: "{n} g",
    milligrams: "{n} mg",
    gramLeft: "še {grams}", gramOver: "{grams} preveč",
    dayNoteSatFat: "nasičene maščobe",

    macros: {
      protein: { name: "beljakovine", left: "Preostale beljakovine", over: "Beljakovin preveč", ofTarget: "od {target} beljakovin", chip: "beljakovine {n} g" },
      carbs: { name: "ogljikovi hidrati", left: "Preostali ogljikovi hidrati", over: "Ogljikovih hidratov preveč", ofTarget: "od {target} ogljikovih hidratov", chip: "ogljikovi hidrati {n} g" },
      fat: { name: "maščobe", left: "Preostale maščobe", over: "Maščob preveč", ofTarget: "od {target} maščob", chip: "maščobe {n} g" },
      satFat: { name: "nas. maščobe", left: "Preostale nas. maščobe", over: "Nas. maščob preveč", ofTarget: "od {target} nasičenih maščob", chip: "nas. maščobe {n} g" },
      sodium: { name: "Natrij", left: "Preostali natrij", over: "Natrija preveč", ofTarget: "od {target} natrija", chip: "natrij {n} mg" },
      fibre: { name: "Vlaknine", chip: "vlaknine {n} g" },
      sugar: { name: "Sladkor", chip: "sladkor {n} g" },
    },
    tips: {
      protein: {
        togo: "Naslednjemu obroku dodaj vir beljakovin: jajca, grški jogurt, skuto, piščanca, ribo, tofu ali lečo.",
        reached: "To so današnje beljakovine. Vse več je neobvezno.",
        over: "Beljakovin imaš danes dovolj. Do jutri izpusti dodatno meso, ribe, jajca in beljakovinske napitke.",
      },
      carbs: {
        left: "Danes je prostor za majhno porcijo kruha, riža, testenin ali sadja.",
        over: "Do konca dneva omeji ogljikove hidrate. Zmerno s kruhom, rižem, testeninami, sladkarijami in sladkimi pijačami.",
      },
      satfat: {
        left: "Blizu si današnje omejitve. Izberi pusto meso, ribe ali rastlinske možnosti.",
        over: "Do konca dneva omeji maslo, sir, mastno meso, pecivo in ocvrto hrano.",
      },
    },
    recentlyUploaded: "Nedavno",


    nothingLogged: "Še nič zabeleženo.",
    diaryFailed: "Tvojega dnevnika ni bilo mogoče naložiti.",
    tryAgain: "Poskusi znova",
    webUploadPhoto: "Naloži fotografijo",
    webComposerPlaceholder: "Povej, kaj je bilo na krožniku, ali spusti fotografijo",
    webDayRegion: "Povzetek dneva",
    webProposalLead: "Beležim za {day} — je prav?",
    todayWord: "danes",
    webLogIt: "Zabeleži",
    webProposalNo: "Ne",
    webPage: "Stran {n} od {total}",
    webDone: "Končano",
    queue: { uploading: "Nalaganje fotografije · 1 od 4", waiting: "Čaka na pošiljanje", notMeal: "To ni videti kot obrok", unread: "Te fotografije ni bilo mogoče prebrati", nothingCounted: "Nič ni bilo šteto.", retake: "Posnemi znova", remove: "Odstrani", question: "Šteto kot ≈{kcal}. Ena podrobnost bi oceno izostrila.", answer: "Odgovori na 1 vprašanje", dropTitle: "Spusti fotografijo kamor koli, da jo zabeležiš", dropSub: "ali jo prilepi v polje za vnos", addedTitle: "Dodano v tvoj dan", addedSub: "Izračunali bomo. Aplikacijo lahko zapreš.", beingRead: "{time} · v branju, aplikacijo lahko zapreš", found: "Najdena živila: {n}", labelRead: "Prebrano s tabele hranilnih vrednosti na tvoji fotografiji.", unreadableLabel: "Tabele hranilnih vrednosti ni bilo mogoče prebrati.", asMealPhoto: "Analiziraj kot fotografijo obroka" },
  },
  hr: {
    phoneToday: "Danas",
    phoneStreakAria: "Niz dana zaredom: {n}",
    phoneStreakGoalAria: "{n} od {goal} dana",
    phoneDayNote: "Lagana večera: {nutrient} — još {grams} g.",
    phoneGoToDay: "Idi na {day}",
    pickerPrevMonth: "Prethodni mjesec",
    pickerNextMonth: "Sljedeći mjesec",
    pickerClose: "Zatvori",
    pickDay: "Odaberi dan",
    pickerDayLogged: "{day}, ima obroka",
    pickerDayUnlogged: "{day}, ništa nije zabilježeno",
    kcalLeft: "kcal preostalo",
    kcalEaten: "kcal pojedeno",
    kcalOver: "kcal preko",
    kcalLeftDetail: "kcal preostalo · {eaten} od {plan}",
    kcalEatenDetail: "kcal pojedeno · {eaten} od {plan}",
    kcalOverDetail: "kcal preko · {eaten} od {plan}",
    grams: "{n} g",
    milligrams: "{n} mg",
    gramLeft: "{grams} preostalo", gramOver: "{grams} preko",
    dayNoteSatFat: "zasićene masti",

    macros: {
      protein: { name: "proteini", left: "Preostalo proteina", over: "Proteini preko", ofTarget: "od {target} proteina", chip: "proteini {n} g" },
      carbs: { name: "ugljikohidrati", left: "Preostalo ugljikohidrata", over: "Ugljikohidrati preko", ofTarget: "od {target} ugljikohidrata", chip: "ugljikohidrati {n} g" },
      fat: { name: "masti", left: "Preostalo masti", over: "Masti preko", ofTarget: "od {target} masti", chip: "masti {n} g" },
      satFat: { name: "zasićene masti", left: "Preostalo zasićenih masti", over: "Zasićene masti preko", ofTarget: "od {target} zasićenih masti", chip: "zasićene masti {n} g" },
      sodium: { name: "Natrij", left: "Preostalo natrija", over: "Natrij preko", ofTarget: "od {target} natrija", chip: "natrij {n} mg" },
      fibre: { name: "Vlakna", chip: "vlakna {n} g" },
      sugar: { name: "Šećer", chip: "šećer {n} g" },
    },
    tips: {
      protein: {
        togo: "Dodaj izvor proteina sljedećem obroku: jaja, grčki jogurt, svježi sir, piletinu, ribu, tofu ili leću.",
        reached: "To su današnji proteini. Sve preko toga je neobavezno.",
        over: "Danas je bilo dovoljno proteina. Do sutra preskoči dodatno meso, ribu, jaja i proteinske napitke.",
      },
      carbs: {
        left: "Danas ima mjesta za malu porciju kruha, riže, tjestenine ili voća.",
        over: "Ograniči ugljikohidrate do kraja dana. Pazi s kruhom, rižom, tjesteninom, slatkišima i slatkim pićima.",
      },
      satfat: {
        left: "Blizu si današnje granice. Biraj nemasno meso, ribu ili biljne opcije.",
        over: "Do kraja dana ograniči maslac, sir, masno meso, peciva i prženu hranu.",
      },
    },
    recentlyUploaded: "Nedavno",


    nothingLogged: "Još ništa nije zabilježeno.",
    diaryFailed: "Dnevnik se nije mogao učitati.",
    tryAgain: "Pokušaj ponovno",
    webUploadPhoto: "Učitaj fotografiju",
    webComposerPlaceholder: "Reci mi što je bilo za jelo ili ispusti fotografiju",
    webDayRegion: "Sažetak dana",
    webProposalLead: "Bilježim za {day} — je li točno?",
    todayWord: "danas",
    webLogIt: "Zabilježi",
    webProposalNo: "Ne",
    webPage: "Stranica {n} od {total}",
    webDone: "Gotovo",
    queue: { uploading: "Prijenos fotografije · 1 od 4", waiting: "Čeka na slanje", notMeal: "To ne izgleda kao obrok", unread: "Ova se fotografija nije mogla pročitati", nothingCounted: "Ništa nije uračunato.", retake: "Snimi ponovno", remove: "Ukloni", question: "Uračunato kao ≈{kcal}. Jedan detalj bi to izoštrio.", answer: "Odgovori na 1 pitanje", dropTitle: "Ispusti fotografiju bilo gdje za bilježenje", dropSub: "ili je zalijepi u polje za unos", addedTitle: "Dodano tvom danu", addedSub: "Uračunat ćemo ga. Možeš zatvoriti aplikaciju.", beingRead: "{time} · čita se, možeš zatvoriti aplikaciju", found: "Pronađene namirnice: {n}", labelRead: "Pročitano s nutritivne deklaracije na tvojoj fotografiji.", unreadableLabel: "Ova se nutritivna deklaracija nije mogla pročitati.", asMealPhoto: "Analiziraj kao fotografiju obroka" },
  },
  sk: {
    phoneToday: "Dnes",
    phoneStreakAria: "Séria dní: {n}",
    phoneStreakGoalAria: "{n} z {goal} dní",
    phoneDayNote: "Ľahká večera: {nutrient} — zostáva {grams} g.",
    phoneGoToDay: "Prejsť na: {day}",
    pickerPrevMonth: "Predchádzajúci mesiac",
    pickerNextMonth: "Nasledujúci mesiac",
    pickerClose: "Zavrieť",
    pickDay: "Vyber deň",
    pickerDayLogged: "{day}, jedlá zapísané",
    pickerDayUnlogged: "{day}, nič nezapísané",
    kcalLeft: "kcal zostáva",
    kcalEaten: "kcal zjedené",
    kcalOver: "kcal navyše",
    kcalLeftDetail: "kcal zostáva · {eaten} z {plan}",
    kcalEatenDetail: "kcal zjedené · {eaten} z {plan}",
    kcalOverDetail: "kcal navyše · {eaten} z {plan}",
    grams: "{n} g",
    milligrams: "{n} mg",
    gramLeft: "{grams} zostáva", gramOver: "{grams} navyše",
    dayNoteSatFat: "nasýtené tuky",

    macros: {
      protein: { name: "bielkoviny", left: "Zostáva bielkovín", over: "Bielkovín navyše", ofTarget: "z {target} bielkovín", chip: "bielkoviny {n} g" },
      carbs: { name: "sacharidy", left: "Zostáva sacharidov", over: "Sacharidov navyše", ofTarget: "z {target} sacharidov", chip: "sacharidy {n} g" },
      fat: { name: "tuky", left: "Zostáva tukov", over: "Tukov navyše", ofTarget: "z {target} tukov", chip: "tuky {n} g" },
      satFat: { name: "nas. tuky", left: "Zostáva nas. tukov", over: "Nas. tukov navyše", ofTarget: "z {target} nas. tukov", chip: "nas. tuky {n} g" },
      sodium: { name: "Sodík", left: "Zostáva sodíka", over: "Sodíka navyše", ofTarget: "z {target} sodíka", chip: "sodík {n} mg" },
      fibre: { name: "Vláknina", chip: "vláknina {n} g" },
      sugar: { name: "Cukor", chip: "cukor {n} g" },
    },
    tips: {
      protein: {
        togo: "Pridaj do ďalšieho jedla zdroj bielkovín: vajcia, grécky jogurt, cottage, kuracie mäso, rybu, tofu alebo šošovicu.",
        reached: "To sú dnešné bielkoviny. Čokoľvek navyše je voliteľné.",
        over: "Bielkovín je na dnes dosť. Do zajtra vynechaj mäso, ryby, vajcia a proteínové nápoje navyše.",
      },
      carbs: {
        left: "Dnes je ešte priestor na malú porciu chleba, ryže, cestovín alebo ovocia.",
        over: "Do konca dňa obmedz sacharidy. Opatrne s chlebom, ryžou, cestovinami, sladkosťami a sladkými nápojmi.",
      },
      satfat: {
        left: "Dnešný limit je blízko. Vyber si chudé mäso, rybu alebo rastlinné možnosti.",
        over: "Do konca dňa obmedz maslo, syr, tučné mäso, pečivo a vyprážané jedlá.",
      },
    },
    recentlyUploaded: "Nedávne",


    nothingLogged: "Zatiaľ nič nezapísané.",
    diaryFailed: "Denník sa nepodarilo načítať.",
    tryAgain: "Skúsiť znova",
    webUploadPhoto: "Nahrať fotku",
    webComposerPlaceholder: "Napíš, čo bolo na tanieri, alebo sem pretiahni fotku",
    webDayRegion: "Prehľad dňa",
    webProposalLead: "Zápis: {day} — sedí to?",
    todayWord: "dnes",
    webLogIt: "Zapísať",
    webProposalNo: "Nie",
    webPage: "Strana {n} z {total}",
    webDone: "Hotovo",
    queue: { uploading: "Nahráva sa fotka · 1 zo 4", waiting: "Čaká na odoslanie", notMeal: "Toto nevyzerá ako jedlo", unread: "Túto fotku sa nepodarilo prečítať", nothingCounted: "Nič sa nezapočítalo.", retake: "Odfotiť znova", remove: "Odstrániť", question: "Započítané ako ≈{kcal}. Jeden detail by to spresnil.", answer: "Odpovedať na 1 otázku", dropTitle: "Pretiahni fotku kamkoľvek a zapíš ju", dropSub: "alebo ju vlož do poľa na písanie", addedTitle: "Pridané k tvojmu dňu", addedSub: "Započítame to. Aplikáciu môžeš zavrieť.", beingRead: "{time} · číta sa, aplikáciu môžeš zavrieť", found: "Nájdené potraviny: {n}", labelRead: "Prečítané z nutričnej tabuľky na tvojej fotke.", unreadableLabel: "Túto nutričnú tabuľku sa nepodarilo prečítať.", asMealPhoto: "Analyzovať ako fotku jedla" },
  },
  no: {
    phoneToday: "I dag",
    phoneStreakAria: "{n} dager på rad",
    phoneStreakGoalAria: "{n} av {goal} dager",
    phoneDayNote: "Hold middagen lett: bare {grams} g {nutrient} igjen.",
    phoneGoToDay: "Gå til {day}",
    pickerPrevMonth: "Forrige måned",
    pickerNextMonth: "Neste måned",
    pickerClose: "Lukk",
    pickDay: "Velg en dag",
    pickerDayLogged: "{day}, har måltider",
    pickerDayUnlogged: "{day}, ingenting logget",
    kcalLeft: "kcal igjen",
    kcalEaten: "kcal spist",
    kcalOver: "kcal over",
    kcalLeftDetail: "kcal igjen · {eaten} av {plan}",
    kcalEatenDetail: "kcal spist · {eaten} av {plan}",
    kcalOverDetail: "kcal over · {eaten} av {plan}",
    grams: "{n} g",
    milligrams: "{n} mg",
    gramLeft: "{grams} igjen", gramOver: "{grams} over",
    dayNoteSatFat: "mettet fett",

    macros: {
      protein: { name: "protein", left: "Protein igjen", over: "Protein over", ofTarget: "av {target} protein", chip: "protein {n} g" },
      carbs: { name: "karbohydrater", left: "Karbohydrater igjen", over: "Karbohydrater over", ofTarget: "av {target} karbohydrater", chip: "karbohydrater {n} g" },
      fat: { name: "fett", left: "Fett igjen", over: "Fett over", ofTarget: "av {target} fett", chip: "fett {n} g" },
      satFat: { name: "mettet fett", left: "Mettet fett igjen", over: "Mettet fett over", ofTarget: "av {target} mettet fett", chip: "mettet fett {n} g" },
      sodium: { name: "Natrium", left: "Natrium igjen", over: "Natrium over", ofTarget: "av {target} natrium", chip: "natrium {n} mg" },
      fibre: { name: "Fiber", chip: "fiber {n} g" },
      sugar: { name: "Sukker", chip: "sukker {n} g" },
    },
    tips: {
      protein: {
        togo: "Legg til en proteinkilde i neste måltid: egg, gresk yoghurt, cottage cheese, kylling, fisk, tofu eller linser.",
        reached: "Det er dagens protein. Alt utover er valgfritt.",
        over: "Du har fått nok protein i dag. Dropp ekstra kjøtt, fisk, egg og proteinshaker til i morgen.",
      },
      carbs: {
        left: "Det er plass til en liten porsjon brød, ris, pasta eller frukt i dag.",
        over: "Begrens karbohydrater resten av dagen. Gå forsiktig fram med brød, ris, pasta, søtsaker og søte drikker.",
      },
      satfat: {
        left: "Du er nær dagens grense. Velg magert kjøtt, fisk eller plantebaserte alternativer.",
        over: "Begrens smør, ost, fett kjøtt, bakverk og frityrstekt mat resten av dagen.",
      },
    },
    recentlyUploaded: "Nylige",


    nothingLogged: "Ingenting logget ennå.",
    diaryFailed: "Kunne ikke laste dagboken din.",
    tryAgain: "Prøv igjen",
    webUploadPhoto: "Last opp et bilde",
    webComposerPlaceholder: "Fortell meg hva du spiste, eller slipp inn et bilde",
    webDayRegion: "Dagsoversikt",
    webProposalLead: "Logger til {day} — ser det riktig ut?",
    todayWord: "i dag",
    webLogIt: "Logg det",
    webProposalNo: "Nei",
    webPage: "Side {n} av {total}",
    webDone: "Ferdig",
    queue: { uploading: "Laster opp bilde · 1 av 4", waiting: "Venter på å sendes", notMeal: "Det ser ikke ut som et måltid", unread: "Kunne ikke lese dette bildet", nothingCounted: "Ingenting ble telt.", retake: "Ta nytt", remove: "Fjern", question: "Telt som ≈{kcal}. Én detalj ville gjort det mer presist.", answer: "Svar på 1 spørsmål", dropTitle: "Slipp et bilde hvor som helst for å logge det", dropSub: "eller lim det inn i skrivefeltet", addedTitle: "Lagt til dagen din", addedSub: "Vi teller det. Du kan lukke appen.", beingRead: "{time} · leses nå, du kan lukke appen", found: "Matvarer funnet: {n}", labelRead: "Lest fra næringsdeklarasjonen på bildet ditt.", unreadableLabel: "Kunne ikke lese denne næringsdeklarasjonen.", asMealPhoto: "Analyser som måltidsbilde" },
  },
  fi: {
    phoneToday: "Tänään",
    phoneStreakAria: "{n} päivän putki",
    phoneStreakGoalAria: "{n}/{goal} päivää",
    phoneDayNote: "Pidä päivällinen kevyenä: {nutrient} – vielä {grams} g.",
    phoneGoToDay: "Siirry: {day}",
    pickerPrevMonth: "Edellinen kuukausi",
    pickerNextMonth: "Seuraava kuukausi",
    pickerClose: "Sulje",
    pickDay: "Valitse päivä",
    pickerDayLogged: "{day}, aterioita kirjattu",
    pickerDayUnlogged: "{day}, ei kirjauksia",
    kcalLeft: "kcal jäljellä",
    kcalEaten: "kcal syöty",
    kcalOver: "kcal yli",
    kcalLeftDetail: "kcal jäljellä · {eaten}/{plan}",
    kcalEatenDetail: "kcal syöty · {eaten}/{plan}",
    kcalOverDetail: "kcal yli · {eaten}/{plan}",
    grams: "{n} g",
    milligrams: "{n} mg",
    gramLeft: "{grams} jäljellä", gramOver: "{grams} yli",
    dayNoteSatFat: "tyydyttynyt rasva",

    macros: {
      protein: { name: "proteiini", left: "Proteiinia jäljellä", over: "Proteiinia yli", ofTarget: "/ {target} proteiinia", chip: "proteiini {n} g" },
      carbs: { name: "hiilihydraatit", left: "Hiilihydraatteja jäljellä", over: "Hiilihydraatteja yli", ofTarget: "/ {target} hiilihydraatteja", chip: "hiilihydraatit {n} g" },
      fat: { name: "rasva", left: "Rasvaa jäljellä", over: "Rasvaa yli", ofTarget: "/ {target} rasvaa", chip: "rasva {n} g" },
      satFat: { name: "tyydyttynyt rasva", left: "Tyydyttynyttä rasvaa jäljellä", over: "Tyydyttynyttä rasvaa yli", ofTarget: "/ {target} tyydyttynyttä rasvaa", chip: "tyyd. rasva {n} g" },
      sodium: { name: "Natrium", left: "Natriumia jäljellä", over: "Natriumia yli", ofTarget: "/ {target} natriumia", chip: "natrium {n} mg" },
      fibre: { name: "Kuitu", chip: "kuitu {n} g" },
      sugar: { name: "Sokeri", chip: "sokeri {n} g" },
    },
    tips: {
      protein: {
        togo: "Lisää proteiinin lähde seuraavaan ateriaasi: kananmunia, kreikkalaista jogurttia, raejuustoa, kanaa, kalaa, tofua tai linssejä.",
        reached: "Siinä tämän päivän proteiini. Loput on vapaaehtoista.",
        over: "Olet saanut tänään tarpeeksi proteiinia. Jätä ylimääräinen liha, kala, kananmunat ja proteiinipirtelöt huomiseen.",
      },
      carbs: {
        left: "Tänään on tilaa pienelle annokselle leipää, riisiä, pastaa tai hedelmiä.",
        over: "Rajoita hiilihydraatteja loppupäivän ajan. Kohtuutta leivän, riisin, pastan, makeisten ja makeiden juomien kanssa.",
      },
      satfat: {
        left: "Olet lähellä tämän päivän rajaa. Valitse vähärasvaista lihaa, kalaa tai kasvipohjaisia vaihtoehtoja.",
        over: "Rajoita voita, juustoa, rasvaista lihaa, leivonnaisia ja friteerattua ruokaa loppupäivän ajan.",
      },
    },
    recentlyUploaded: "Viimeisimmät",


    nothingLogged: "Mitään ei ole vielä kirjattu.",
    diaryFailed: "Päiväkirjan lataus ei onnistunut.",
    tryAgain: "Yritä uudelleen",
    webUploadPhoto: "Lataa kuva",
    webComposerPlaceholder: "Kerro, mitä söit, tai pudota kuva",
    webDayRegion: "Päivän yhteenveto",
    webProposalLead: "Kirjaus: {day} – näyttääkö oikealta?",
    todayWord: "tänään",
    webLogIt: "Kirjaa",
    webProposalNo: "Ei",
    webPage: "Sivu {n}/{total}",
    webDone: "Valmis",
    queue: { uploading: "Ladataan kuvaa · 1/4", waiting: "Odottaa lähetystä", notMeal: "Tämä ei näytä ateriaalta", unread: "Kuvan lukeminen ei onnistunut", nothingCounted: "Mitään ei laskettu.", retake: "Ota uusi", remove: "Ota pois", question: "Laskettu: ≈{kcal}. Yksi tieto tarkentaisi arviota.", answer: "Vastaa 1 kysymykseen", dropTitle: "Pudota kuva mihin tahansa kirjataksesi sen", dropSub: "tai liitä se kirjoituskenttään", addedTitle: "Lisätty päivääsi", addedSub: "Laskemme sen. Voit sulkea sovelluksen.", beingRead: "{time} · luetaan, voit sulkea sovelluksen", found: "Löydetyt ruoat: {n}", labelRead: "Luettu kuvasi ravintoarvomerkinnöistä.", unreadableLabel: "Ravintoarvomerkintöjen lukeminen ei onnistunut.", asMealPhoto: "Analysoi ateriakuvana" },
  },
  da: {
    phoneToday: "I dag",
    phoneStreakAria: "{n} dage i træk",
    phoneStreakGoalAria: "{n} af {goal} dage",
    phoneDayNote: "Hold aftensmaden let: {grams} g {nutrient} tilbage.",
    phoneGoToDay: "Gå til {day}",
    pickerPrevMonth: "Forrige måned",
    pickerNextMonth: "Næste måned",
    pickerClose: "Luk",
    pickDay: "Vælg en dag",
    pickerDayLogged: "{day}, har måltider",
    pickerDayUnlogged: "{day}, intet registreret",
    kcalLeft: "kcal tilbage",
    kcalEaten: "kcal spist",
    kcalOver: "kcal over",
    kcalLeftDetail: "kcal tilbage · {eaten} af {plan}",
    kcalEatenDetail: "kcal spist · {eaten} af {plan}",
    kcalOverDetail: "kcal over · {eaten} af {plan}",
    grams: "{n} g",
    milligrams: "{n} mg",
    gramLeft: "{grams} tilbage", gramOver: "{grams} over",
    dayNoteSatFat: "mættet fedt",

    macros: {
      protein: { name: "protein", left: "Protein tilbage", over: "Protein over", ofTarget: "af {target} protein", chip: "protein {n} g" },
      carbs: { name: "kulhydrater", left: "Kulhydrater tilbage", over: "Kulhydrater over", ofTarget: "af {target} kulhydrater", chip: "kulhydrater {n} g" },
      fat: { name: "fedt", left: "Fedt tilbage", over: "Fedt over", ofTarget: "af {target} fedt", chip: "fedt {n} g" },
      satFat: { name: "mættet fedt", left: "Mættet fedt tilbage", over: "Mættet fedt over", ofTarget: "af {target} mættet fedt", chip: "mættet fedt {n} g" },
      sodium: { name: "Natrium", left: "Natrium tilbage", over: "Natrium over", ofTarget: "af {target} natrium", chip: "natrium {n} mg" },
      fibre: { name: "Kostfibre", chip: "kostfibre {n} g" },
      sugar: { name: "Sukker", chip: "sukker {n} g" },
    },
    tips: {
      protein: {
        togo: "Tilføj en proteinkilde til dit næste måltid: æg, græsk yoghurt, hytteost, kylling, fisk, tofu eller linser.",
        reached: "Det er dagens protein. Mere er valgfrit.",
        over: "Du har fået nok protein i dag. Spring ekstra kød, fisk, æg og proteinshakes over indtil i morgen.",
      },
      carbs: {
        left: "Der er plads til en lille portion brød, ris, pasta eller frugt i dag.",
        over: "Begræns kulhydrater resten af dagen. Skru ned for brød, ris, pasta, slik og søde drikke.",
      },
      satfat: {
        left: "Du er tæt på dagens grænse. Vælg magert kød, fisk eller plantebaserede muligheder.",
        over: "Begræns smør, ost, fedt kød, wienerbrød og friturestegt mad resten af dagen.",
      },
    },
    recentlyUploaded: "Seneste",


    nothingLogged: "Intet registreret endnu.",
    diaryFailed: "Din dagbog kunne ikke indlæses.",
    tryAgain: "Prøv igen",
    webUploadPhoto: "Upload et foto",
    webComposerPlaceholder: "Fortæl mig, hvad du spiste, eller slip et foto",
    webDayRegion: "Dagsoversigt",
    webProposalLead: "Registrerer for {day} — ser det rigtigt ud?",
    todayWord: "i dag",
    webLogIt: "Registrér",
    webProposalNo: "Nej",
    webPage: "Side {n} af {total}",
    webDone: "Færdig",
    queue: { uploading: "Uploader foto · 1 af 4", waiting: "Venter på at blive sendt", notMeal: "Det ligner ikke et måltid", unread: "Fotoet kunne ikke læses", nothingCounted: "Intet blev talt med.", retake: "Tag igen", remove: "Fjern", question: "Talt som ≈{kcal}. Én detalje ville gøre det mere præcist.", answer: "Besvar 1 spørgsmål", dropTitle: "Slip et foto hvor som helst for at registrere det", dropSub: "eller indsæt et i tekstfeltet", addedTitle: "Tilføjet til din dag", addedSub: "Vi regner det ud. Du kan lukke appen.", beingRead: "{time} · bliver læst, du kan lukke appen", found: "Fødevarer fundet: {n}", labelRead: "Aflæst fra næringsdeklarationen på dit foto.", unreadableLabel: "Næringsdeklarationen kunne ikke læses.", asMealPhoto: "Analysér som måltidsfoto" },
  },
  hu: {
    phoneToday: "Ma",
    phoneStreakAria: "Sorozat: {n} nap",
    phoneStreakGoalAria: "{n} / {goal} nap",
    phoneDayNote: "Legyen könnyű a vacsora: még {grams} g {nutrient} fér bele.",
    phoneGoToDay: "Ugrás ide: {day}",
    pickerPrevMonth: "Előző hónap",
    pickerNextMonth: "Következő hónap",
    pickerClose: "Bezárás",
    pickDay: "Válassz napot",
    pickerDayLogged: "{day}, vannak étkezések",
    pickerDayUnlogged: "{day}, nincs rögzítve semmi",
    kcalLeft: "kcal maradt",
    kcalEaten: "kcal elfogyasztva",
    kcalOver: "kcal túllépve",
    kcalLeftDetail: "kcal maradt · {eaten} / {plan}",
    kcalEatenDetail: "kcal elfogyasztva · {eaten} / {plan}",
    kcalOverDetail: "kcal túllépve · {eaten} / {plan}",
    grams: "{n}g",
    milligrams: "{n}mg",
    gramLeft: "{grams} maradt", gramOver: "{grams} túllépve",
    dayNoteSatFat: "telített zsír",

    macros: {
      protein: { name: "fehérje", left: "Maradék fehérje", over: "Fehérje túllépve", ofTarget: "/ {target} fehérje", chip: "fehérje {n} g" },
      carbs: { name: "szénhidrát", left: "Maradék szénhidrát", over: "Szénhidrát túllépve", ofTarget: "/ {target} szénhidrát", chip: "szénhidrát {n} g" },
      fat: { name: "zsír", left: "Maradék zsír", over: "Zsír túllépve", ofTarget: "/ {target} zsír", chip: "zsír {n} g" },
      satFat: { name: "tel. zsír", left: "Maradék tel. zsír", over: "Tel. zsír túllépve", ofTarget: "/ {target} tel. zsír", chip: "tel. zsír {n} g" },
      sodium: { name: "Nátrium", left: "Maradék nátrium", over: "Nátrium túllépve", ofTarget: "/ {target} nátrium", chip: "nátrium {n} mg" },
      fibre: { name: "Rost", chip: "rost {n} g" },
      sugar: { name: "Cukor", chip: "cukor {n} g" },
    },
    tips: {
      protein: {
        togo: "Tegyél fehérjeforrást a következő étkezésedbe: tojás, görög joghurt, túró, csirke, hal, tofu vagy lencse.",
        reached: "Ez a mai fehérjéd. Ami ezen felül van, az már csak opcionális.",
        over: "Mára elég fehérjét ettél. Holnapig hagyd ki az extra húst, halat, tojást és fehérjeturmixot.",
      },
      carbs: {
        left: "Ma még belefér egy kis adag kenyér, rizs, tészta vagy gyümölcs.",
        over: "A nap hátralévő részében korlátozd a szénhidrátot. Mértékkel a kenyérrel, rizzsel, tésztával, édességgel és édes italokkal.",
      },
      satfat: {
        left: "Közel vagy a mai határhoz. Válassz sovány húst, halat vagy növényi ételeket.",
        over: "A nap hátralévő részében korlátozd a vajat, sajtot, zsíros húst, péksüteményt és sült ételeket.",
      },
    },
    recentlyUploaded: "Legutóbbiak",


    nothingLogged: "Még nincs rögzítve semmi.",
    diaryFailed: "Nem sikerült betölteni a naplódat.",
    tryAgain: "Próbáld újra",
    webUploadPhoto: "Fotó feltöltése",
    webComposerPlaceholder: "Mondd el, mit ettél, vagy húzz ide egy fotót",
    webDayRegion: "Napi összesítő",
    webProposalLead: "Rögzítés ide: {day} – stimmel?",
    todayWord: "ma",
    webLogIt: "Rögzítsd",
    webProposalNo: "Nem",
    webPage: "{n}. oldal / {total}",
    webDone: "Kész",
    queue: { uploading: "Fotó feltöltése · 1 / 4", waiting: "Küldésre vár", notMeal: "Ez nem tűnik étkezésnek", unread: "Nem sikerült beolvasni ezt a fotót", nothingCounted: "Semmi sem lett beszámítva.", retake: "Újrafotózás", remove: "Eltávolítás", question: "Beszámítva: ≈{kcal}. Egy részlet pontosítaná.", answer: "Válaszolj 1 kérdésre", dropTitle: "Húzz bárhová egy fotót a rögzítéshez", dropSub: "vagy illeszd be a szövegmezőbe", addedTitle: "Hozzáadva a napodhoz", addedSub: "Beszámítjuk. Bezárhatod az appot.", beingRead: "{time} · beolvasás alatt, bezárhatod az appot", found: "Talált ételek: {n}", labelRead: "A fotódon lévő tápértékcímkéről beolvasva.", unreadableLabel: "Ezt a címkét nem tudtuk beolvasni.", asMealPhoto: "Elemzés étkezésről készült fotóként" },
  },
  el: {
    phoneToday: "Σήμερα",
    phoneStreakAria: "Σερί ημερών: {n}",
    phoneStreakGoalAria: "{n} από {goal} ημέρες",
    phoneDayNote: "Κράτα το βραδινό ελαφρύ: {nutrient} — απομένουν {grams} g.",
    phoneGoToDay: "Μετάβαση σε: {day}",
    pickerPrevMonth: "Προηγούμενος μήνας",
    pickerNextMonth: "Επόμενος μήνας",
    pickerClose: "Κλείσιμο",
    pickDay: "Διάλεξε μέρα",
    pickerDayLogged: "{day}, έχει γεύματα",
    pickerDayUnlogged: "{day}, τίποτα καταγεγραμμένο",
    kcalLeft: "kcal απομένουν",
    kcalEaten: "kcal καταναλώθηκαν",
    kcalOver: "kcal παραπάνω",
    kcalLeftDetail: "kcal απομένουν · {eaten} από {plan}",
    kcalEatenDetail: "kcal καταναλώθηκαν · {eaten} από {plan}",
    kcalOverDetail: "kcal παραπάνω · {eaten} από {plan}",
    grams: "{n} g",
    milligrams: "{n} mg",
    gramLeft: "απομένουν {grams}", gramOver: "{grams} παραπάνω",
    dayNoteSatFat: "κορεσμένα λιπαρά",

    macros: {
      protein: { name: "πρωτεΐνη", left: "Πρωτεΐνη που απομένει", over: "Πρωτεΐνη παραπάνω", ofTarget: "από {target} πρωτεΐνη", chip: "πρωτεΐνη {n} g" },
      carbs: { name: "υδατάνθρακες", left: "Υδατάνθρακες που απομένουν", over: "Υδατάνθρακες παραπάνω", ofTarget: "από {target} υδατάνθρακες", chip: "υδατάνθρακες {n} g" },
      fat: { name: "λιπαρά", left: "Λιπαρά που απομένουν", over: "Λιπαρά παραπάνω", ofTarget: "από {target} λιπαρά", chip: "λιπαρά {n} g" },
      satFat: { name: "κορ. λιπαρά", left: "Κορ. λιπαρά που απομένουν", over: "Κορ. λιπαρά παραπάνω", ofTarget: "από {target} κορ. λιπαρά", chip: "κορ. λιπαρά {n} g" },
      sodium: { name: "Νάτριο", left: "Νάτριο που απομένει", over: "Νάτριο παραπάνω", ofTarget: "από {target} νάτριο", chip: "νάτριο {n} mg" },
      fibre: { name: "Φυτικές ίνες", chip: "φυτικές ίνες {n} g" },
      sugar: { name: "Ζάχαρη", chip: "ζάχαρη {n} g" },
    },
    tips: {
      protein: {
        togo: "Πρόσθεσε μια πηγή πρωτεΐνης στο επόμενο γεύμα σου: αυγά, στραγγιστό γιαούρτι, κότατζ, κοτόπουλο, ψάρι, τόφου ή φακές.",
        reached: "Αυτή είναι η πρωτεΐνη της ημέρας. Ό,τι παραπάνω είναι προαιρετικό.",
        over: "Πήρες αρκετή πρωτεΐνη σήμερα. Άφησε για αύριο το επιπλέον κρέας, ψάρι, αυγά και τα ροφήματα πρωτεΐνης.",
      },
      carbs: {
        left: "Υπάρχει χώρος για μια μικρή μερίδα ψωμί, ρύζι, ζυμαρικά ή φρούτα σήμερα.",
        over: "Περιόρισε τους υδατάνθρακες για το υπόλοιπο της ημέρας. Μην το παρακάνεις με ψωμί, ρύζι, ζυμαρικά, γλυκά και γλυκά ροφήματα.",
      },
      satfat: {
        left: "Είσαι κοντά στο σημερινό όριο. Διάλεξε άπαχο κρέας, ψάρι ή φυτικές επιλογές.",
        over: "Περιόρισε βούτυρο, τυρί, λιπαρό κρέας, αρτοσκευάσματα και τηγανητά για το υπόλοιπο της ημέρας.",
      },
    },
    recentlyUploaded: "Πρόσφατα",


    nothingLogged: "Δεν έχει καταγραφεί τίποτα ακόμη.",
    diaryFailed: "Το ημερολόγιό σου δεν φόρτωσε.",
    tryAgain: "Δοκίμασε ξανά",
    webUploadPhoto: "Ανέβασμα φωτογραφίας",
    webComposerPlaceholder: "Πες μου τι έφαγες ή άφησε μια φωτογραφία εδώ",
    webDayRegion: "Σύνοψη ημέρας",
    webProposalLead: "Καταγραφή για {day} — είναι σωστό;",
    todayWord: "σήμερα",
    webLogIt: "Καταγραφή",
    webProposalNo: "Όχι",
    webPage: "Σελίδα {n} από {total}",
    webDone: "Τέλος",
    queue: { uploading: "Ανέβασμα φωτογραφίας · 1 από 4", waiting: "Αναμονή για αποστολή", notMeal: "Αυτό δεν μοιάζει με γεύμα", unread: "Η φωτογραφία δεν διαβάστηκε", nothingCounted: "Δεν μετρήθηκε τίποτα.", retake: "Νέα λήψη", remove: "Αφαίρεση", question: "Μετρήθηκε ως ≈{kcal}. Μία λεπτομέρεια θα το έκανε πιο ακριβές.", answer: "Απάντησε σε 1 ερώτηση", dropTitle: "Άφησε μια φωτογραφία οπουδήποτε για καταγραφή", dropSub: "ή κάνε επικόλληση στο πεδίο γραφής", addedTitle: "Προστέθηκε στη μέρα σου", addedSub: "Θα το μετρήσουμε. Μπορείς να κλείσεις την εφαρμογή.", beingRead: "{time} · διαβάζεται, μπορείς να κλείσεις την εφαρμογή", found: "Τρόφιμα που βρέθηκαν: {n}", labelRead: "Διαβάστηκε από την ετικέτα διατροφικής αξίας στη φωτογραφία σου.", unreadableLabel: "Δεν ήταν δυνατή η ανάγνωση αυτής της ετικέτας.", asMealPhoto: "Ανάλυση ως φωτογραφία γεύματος" },
  },
  ro: {
    phoneToday: "Azi",
    phoneStreakAria: "Serie de zile: {n}",
    phoneStreakGoalAria: "Zile: {n} din {goal}",
    phoneDayNote: "Cina să fie ușoară: mai ai {grams} g de {nutrient}.",
    phoneGoToDay: "Mergi la {day}",
    pickerPrevMonth: "Luna anterioară",
    pickerNextMonth: "Luna următoare",
    pickerClose: "Închide",
    pickDay: "Alege o zi",
    pickerDayLogged: "{day}, are mese",
    pickerDayUnlogged: "{day}, nimic înregistrat",
    kcalLeft: "kcal rămase",
    kcalEaten: "kcal mâncate",
    kcalOver: "kcal peste",
    kcalLeftDetail: "kcal rămase · {eaten} din {plan}",
    kcalEatenDetail: "kcal mâncate · {eaten} din {plan}",
    kcalOverDetail: "kcal peste · {eaten} din {plan}",
    grams: "{n} g",
    milligrams: "{n} mg",
    gramLeft: "{grams} rămase", gramOver: "{grams} peste",
    dayNoteSatFat: "grăsimi saturate",

    macros: {
      protein: { name: "proteine", left: "Proteine rămase", over: "Proteine peste", ofTarget: "din {target} proteine", chip: "proteine {n} g" },
      carbs: { name: "carbohidrați", left: "Carbohidrați rămași", over: "Carbohidrați peste", ofTarget: "din {target} carbohidrați", chip: "carbohidrați {n} g" },
      fat: { name: "grăsimi", left: "Grăsimi rămase", over: "Grăsimi peste", ofTarget: "din {target} grăsimi", chip: "grăsimi {n} g" },
      satFat: { name: "grăsimi sat.", left: "Grăsimi sat. rămase", over: "Grăsimi sat. peste", ofTarget: "din {target} grăsimi saturate", chip: "grăsimi sat. {n} g" },
      sodium: { name: "Sodiu", left: "Sodiu rămas", over: "Sodiu peste", ofTarget: "din {target} sodiu", chip: "sodiu {n} mg" },
      fibre: { name: "Fibre", chip: "fibre {n} g" },
      sugar: { name: "Zahăr", chip: "zahăr {n} g" },
    },
    tips: {
      protein: {
        togo: "Adaugă o sursă de proteine la următoarea masă: ouă, iaurt grecesc, brânză de vaci, pui, pește, tofu sau linte.",
        reached: "Ai proteinele de azi. Orice în plus e opțional.",
        over: "Ai avut destule proteine azi. Sari peste carnea, peștele, ouăle și shake-urile proteice în plus până mâine.",
      },
      carbs: {
        left: "Azi mai e loc pentru o porție mică de pâine, orez, paste sau fructe.",
        over: "Limitează carbohidrații tot restul zilei. Mai ușor cu pâinea, orezul, pastele, dulciurile și băuturile îndulcite.",
      },
      satfat: {
        left: "Ești aproape de limita de azi. Alege carne slabă, pește sau variante vegetale.",
        over: "Limitează untul, brânza, carnea grasă, produsele de patiserie și prăjelile tot restul zilei.",
      },
    },
    recentlyUploaded: "Recente",


    nothingLogged: "Nimic înregistrat încă.",
    diaryFailed: "Nu am putut încărca jurnalul.",
    tryAgain: "Încearcă din nou",
    webUploadPhoto: "Încarcă o fotografie",
    webComposerPlaceholder: "Spune-mi ce ai mâncat sau trage aici o fotografie",
    webDayRegion: "Rezumatul zilei",
    webProposalLead: "Înregistrez pentru {day} — e corect?",
    todayWord: "azi",
    webLogIt: "Înregistrează",
    webProposalNo: "Nu",
    webPage: "Pagina {n} din {total}",
    webDone: "Gata",
    queue: { uploading: "Se încarcă fotografia · 1 din 4", waiting: "Așteaptă trimiterea", notMeal: "Nu pare a fi o masă", unread: "Nu am putut citi fotografia", nothingCounted: "Nu s-a numărat nimic.", retake: "Refă", remove: "Elimină", question: "Numărat ca ≈{kcal}. Un detaliu l-ar face mai precis.", answer: "Răspunde la 1 întrebare", dropTitle: "Trage o fotografie oriunde ca s-o înregistrezi", dropSub: "sau lipește una în caseta de mesaj", addedTitle: "Adăugat la ziua ta", addedSub: "O numărăm noi. Poți închide aplicația.", beingRead: "{time} · se citește, poți închide aplicația", found: "Alimente găsite: {n}", labelRead: "Valori citite de pe eticheta nutrițională din fotografia ta.", unreadableLabel: "Eticheta asta nu a putut fi citită.", asMealPhoto: "Analizează ca fotografie cu o masă" },
  },
  cs: {
    phoneToday: "Dnes",
    phoneStreakAria: "Série dní: {n}",
    phoneStreakGoalAria: "Dny: {n} z {goal}",
    phoneDayNote: "Lehká večeře: {nutrient} — zbývá {grams} g.",
    phoneGoToDay: "Přejít na {day}",
    pickerPrevMonth: "Předchozí měsíc",
    pickerNextMonth: "Další měsíc",
    pickerClose: "Zavřít",
    pickDay: "Vyber den",
    pickerDayLogged: "{day}, má jídla",
    pickerDayUnlogged: "{day}, nic nezapsáno",
    kcalLeft: "kcal zbývá",
    kcalEaten: "kcal snědeno",
    kcalOver: "kcal nad plán",
    kcalLeftDetail: "kcal zbývá · {eaten} z {plan}",
    kcalEatenDetail: "kcal snědeno · {eaten} z {plan}",
    kcalOverDetail: "kcal nad plán · {eaten} z {plan}",
    grams: "{n} g",
    milligrams: "{n} mg",
    gramLeft: "{grams} zbývá", gramOver: "{grams} nad cíl",
    dayNoteSatFat: "nasycené tuky",

    macros: {
      protein: { name: "bílkoviny", left: "Zbývá bílkovin", over: "Bílkoviny nad cíl", ofTarget: "z {target} bílkovin", chip: "bílkoviny {n} g" },
      carbs: { name: "sacharidy", left: "Zbývá sacharidů", over: "Sacharidy nad cíl", ofTarget: "z {target} sacharidů", chip: "sacharidy {n} g" },
      fat: { name: "tuky", left: "Zbývá tuků", over: "Tuky nad cíl", ofTarget: "z {target} tuků", chip: "tuky {n} g" },
      satFat: { name: "nas. tuky", left: "Zbývá nas. tuků", over: "Nas. tuky nad cíl", ofTarget: "z {target} nasycených tuků", chip: "nas. tuky {n} g" },
      sodium: { name: "Sodík", left: "Zbývá sodíku", over: "Sodík nad cíl", ofTarget: "z {target} sodíku", chip: "sodík {n} mg" },
      fibre: { name: "Vláknina", chip: "vláknina {n} g" },
      sugar: { name: "Cukr", chip: "cukr {n} g" },
    },
    tips: {
      protein: {
        togo: "Přidej do dalšího jídla zdroj bílkovin: vejce, řecký jogurt, tvaroh, kuře, rybu, tofu nebo čočku.",
        reached: "Dnešní bílkoviny máš. Cokoli navíc je volitelné.",
        over: "Bílkovin máš dnes dost. Do zítřka vynech maso, rybu, vejce a proteinové koktejly navíc.",
      },
      carbs: {
        left: "Dnes je ještě místo na malou porci chleba, rýže, těstovin nebo ovoce.",
        over: "Do konce dne omez sacharidy. Opatrně s chlebem, rýží, těstovinami, sladkostmi a slazenými nápoji.",
      },
      satfat: {
        left: "Blížíš se dnešnímu limitu. Vybírej libové maso, rybu nebo rostlinné možnosti.",
        over: "Do konce dne omez máslo, sýr, tučné maso, pečivo z listového těsta a smažená jídla.",
      },
    },
    recentlyUploaded: "Nedávné",


    nothingLogged: "Zatím nic zapsáno.",
    diaryFailed: "Deník se nepodařilo načíst.",
    tryAgain: "Zkusit znovu",
    webUploadPhoto: "Nahrát fotku",
    webComposerPlaceholder: "Napiš, co bylo k jídlu, nebo přetáhni fotku",
    webDayRegion: "Souhrn dne",
    webProposalLead: "Zapisuju na {day} — sedí to?",
    todayWord: "dnešek",
    webLogIt: "Zapsat",
    webProposalNo: "Ne",
    webPage: "Strana {n} z {total}",
    webDone: "Hotovo",
    queue: { uploading: "Nahrávání fotky · 1 ze 4", waiting: "Čeká na odeslání", notMeal: "Tohle nevypadá jako jídlo", unread: "Tuhle fotku se nepodařilo přečíst", nothingCounted: "Nic se nezapočítalo.", retake: "Vyfotit znovu", remove: "Odebrat", question: "Započítáno jako ≈{kcal}. Jeden detail to zpřesní.", answer: "Odpovědět na 1 otázku", dropTitle: "Přetáhni fotku kamkoli a zapiš ji", dropSub: "nebo ji vlož do pole pro psaní", addedTitle: "Přidáno do tvého dne", addedSub: "Spočítáme to. Aplikaci můžeš zavřít.", beingRead: "{time} · čte se, aplikaci můžeš zavřít", found: "Nalezené potraviny: {n}", labelRead: "Přečteno z nutriční etikety na tvé fotce.", unreadableLabel: "Tuhle etiketu se nepodařilo přečíst.", asMealPhoto: "Analyzovat jako fotku jídla" },
  },
  hi: {
    phoneToday: "आज",
    phoneStreakAria: "{n} दिन की स्ट्रीक",
    phoneStreakGoalAria: "{goal} में से {n} दिन",
    phoneDayNote: "रात का खाना हल्का रखें: {nutrient} के {grams} g बाकी।",
    phoneGoToDay: "{day} पर जाएँ",
    pickerPrevMonth: "पिछला महीना",
    pickerNextMonth: "अगला महीना",
    pickerClose: "बंद करें",
    pickDay: "दिन चुनें",
    pickerDayLogged: "{day}, भोजन दर्ज हैं",
    pickerDayUnlogged: "{day}, कुछ दर्ज नहीं",
    kcalLeft: "kcal बाकी",
    kcalEaten: "kcal खाया",
    kcalOver: "kcal ज़्यादा",
    kcalLeftDetail: "kcal बाकी · {plan} में से {eaten}",
    kcalEatenDetail: "kcal खाया · {plan} में से {eaten}",
    kcalOverDetail: "kcal ज़्यादा · {plan} में से {eaten}",
    grams: "{n} g",
    milligrams: "{n} mg",
    gramLeft: "{grams} बाकी", gramOver: "{grams} ज़्यादा",
    dayNoteSatFat: "सैचुरेटेड फ़ैट",

    macros: {
      protein: { name: "प्रोटीन", left: "प्रोटीन बाकी", over: "प्रोटीन ज़्यादा", ofTarget: "{target} प्रोटीन में से", chip: "प्रोटीन {n} g" },
      carbs: { name: "कार्ब्स", left: "कार्ब्स बाकी", over: "कार्ब्स ज़्यादा", ofTarget: "{target} कार्ब्स में से", chip: "कार्ब्स {n} g" },
      fat: { name: "फ़ैट", left: "फ़ैट बाकी", over: "फ़ैट ज़्यादा", ofTarget: "{target} फ़ैट में से", chip: "फ़ैट {n} g" },
      satFat: { name: "सैच. फ़ैट", left: "सैच. फ़ैट बाकी", over: "सैच. फ़ैट ज़्यादा", ofTarget: "{target} सैचुरेटेड फ़ैट में से", chip: "सैच. फ़ैट {n} g" },
      sodium: { name: "सोडियम", left: "सोडियम बाकी", over: "सोडियम ज़्यादा", ofTarget: "{target} सोडियम में से", chip: "सोडियम {n} mg" },
      fibre: { name: "फ़ाइबर", chip: "फ़ाइबर {n} g" },
      sugar: { name: "शुगर", chip: "शुगर {n} g" },
    },
    tips: {
      protein: {
        togo: "अपने अगले भोजन में प्रोटीन का कोई स्रोत जोड़ें: अंडे, ग्रीक योगर्ट, पनीर, चिकन, मछली, टोफ़ू या दाल।",
        reached: "आज का प्रोटीन हो गया। इससे ज़्यादा वैकल्पिक है।",
        over: "आज आपने पर्याप्त प्रोटीन ले लिया है। कल तक अतिरिक्त मांस, मछली, अंडे और प्रोटीन शेक न लें।",
      },
      carbs: {
        left: "आज ब्रेड, चावल, पास्ता या फल के एक छोटे हिस्से की गुंजाइश है।",
        over: "आज बाकी दिन कार्ब्स सीमित रखें। ब्रेड, चावल, पास्ता, मिठाई और मीठे पेय कम लें।",
      },
      satfat: {
        left: "आप आज की सीमा के करीब हैं। कम चर्बी वाला मांस, मछली या प्लांट-बेस्ड विकल्प चुनें।",
        over: "आज बाकी दिन मक्खन, चीज़, चर्बी वाला मांस, पेस्ट्री और तली हुई चीज़ें सीमित रखें।",
      },
    },
    recentlyUploaded: "हाल के",


    nothingLogged: "अभी तक कुछ दर्ज नहीं।",
    diaryFailed: "आपकी डायरी लोड नहीं हो सकी।",
    tryAgain: "फिर से कोशिश करें",
    webUploadPhoto: "फ़ोटो अपलोड करें",
    webComposerPlaceholder: "बताएँ आपने क्या खाया, या फ़ोटो डालें",
    webDayRegion: "दिन का सारांश",
    webProposalLead: "{day} में दर्ज कर रहे हैं — सही है?",
    todayWord: "आज",
    webLogIt: "दर्ज करें",
    webProposalNo: "नहीं",
    webPage: "पेज {n}/{total}",
    webDone: "हो गया",
    queue: { uploading: "फ़ोटो अपलोड हो रही है · 4 में से 1", waiting: "भेजे जाने का इंतज़ार", notMeal: "यह भोजन नहीं लगता", unread: "यह फ़ोटो पढ़ी नहीं जा सकी", nothingCounted: "कुछ भी गिना नहीं गया।", retake: "फिर से लें", remove: "हटाएँ", question: "≈{kcal} के रूप में गिना गया। एक जानकारी से यह और सटीक होगा।", answer: "1 सवाल का जवाब दें", dropTitle: "दर्ज करने के लिए कहीं भी फ़ोटो डालें", dropSub: "या उसे मैसेज बॉक्स में पेस्ट करें", addedTitle: "आपके दिन में जोड़ा गया", addedSub: "हम इसे गिन लेंगे। अब ऐप बंद किया जा सकता है।", beingRead: "{time} · पढ़ी जा रही है, ऐप बंद किया जा सकता है", found: "मिले खाद्य पदार्थ: {n}", labelRead: "आपकी फ़ोटो में पोषण लेबल से पढ़ा गया।", unreadableLabel: "वह लेबल पढ़ा नहीं जा सका।", asMealPhoto: "भोजन की फ़ोटो के रूप में विश्लेषण करें" },
  },
  th: {
    phoneToday: "วันนี้",
    phoneStreakAria: "สตรีค {n} วัน",
    phoneStreakGoalAria: "{n} จาก {goal} วัน",
    phoneDayNote: "มื้อเย็นเบา ๆ หน่อย: {nutrient} เหลืออีก {grams} ก.",
    phoneGoToDay: "ไปที่ {day}",
    pickerPrevMonth: "เดือนก่อนหน้า",
    pickerNextMonth: "เดือนถัดไป",
    pickerClose: "ปิด",
    pickDay: "เลือกวัน",
    pickerDayLogged: "{day} มีมื้อที่จดไว้",
    pickerDayUnlogged: "{day} ยังไม่ได้จดอะไร",
    kcalLeft: "kcal ที่เหลือ",
    kcalEaten: "kcal ที่กินไป",
    kcalOver: "kcal ที่เกิน",
    kcalLeftDetail: "kcal ที่เหลือ · {eaten} จาก {plan}",
    kcalEatenDetail: "kcal ที่กินไป · {eaten} จาก {plan}",
    kcalOverDetail: "kcal ที่เกิน · {eaten} จาก {plan}",
    grams: "{n} ก.",
    milligrams: "{n} มก.",
    gramLeft: "เหลือ {grams}", gramOver: "เกิน {grams}",
    dayNoteSatFat: "ไขมันอิ่มตัว",

    macros: {
      protein: { name: "โปรตีน", left: "โปรตีนที่เหลือ", over: "โปรตีนที่เกิน", ofTarget: "จากโปรตีน {target}", chip: "โปรตีน {n} ก." },
      carbs: { name: "คาร์บ", left: "คาร์บที่เหลือ", over: "คาร์บที่เกิน", ofTarget: "จากคาร์บ {target}", chip: "คาร์บ {n} ก." },
      fat: { name: "ไขมัน", left: "ไขมันที่เหลือ", over: "ไขมันที่เกิน", ofTarget: "จากไขมัน {target}", chip: "ไขมัน {n} ก." },
      satFat: { name: "ไขมันอิ่มตัว", left: "ไขมันอิ่มตัวที่เหลือ", over: "ไขมันอิ่มตัวที่เกิน", ofTarget: "จากไขมันอิ่มตัว {target}", chip: "ไขมันอิ่มตัว {n} ก." },
      sodium: { name: "โซเดียม", left: "โซเดียมที่เหลือ", over: "โซเดียมที่เกิน", ofTarget: "จากโซเดียม {target}", chip: "โซเดียม {n} มก." },
      fibre: { name: "ใยอาหาร", chip: "ใยอาหาร {n} ก." },
      sugar: { name: "น้ำตาล", chip: "น้ำตาล {n} ก." },
    },
    tips: {
      protein: {
        togo: "เพิ่มแหล่งโปรตีนในมื้อถัดไป เช่น ไข่ กรีกโยเกิร์ต คอทเทจชีส ไก่ ปลา เต้าหู้ หรือถั่วเลนทิล",
        reached: "โปรตีนของวันนี้ครบแล้ว ที่เกินจากนี้ไม่จำเป็น",
        over: "วันนี้ได้โปรตีนพอแล้ว งดเนื้อสัตว์ ปลา ไข่ และโปรตีนเชคเพิ่มจนถึงพรุ่งนี้",
      },
      carbs: {
        left: "วันนี้ยังกินขนมปัง ข้าว พาสต้า หรือผลไม้ได้อีกเล็กน้อย",
        over: "จำกัดคาร์บตลอดช่วงที่เหลือของวันนี้ ลดขนมปัง ข้าว พาสต้า ของหวาน และเครื่องดื่มรสหวาน",
      },
      satfat: {
        left: "ใกล้ถึงขีดจำกัดของวันนี้แล้ว เลือกเนื้อไม่ติดมัน ปลา หรืออาหารจากพืช",
        over: "จำกัดเนย ชีส เนื้อติดมัน ขนมอบ และของทอดตลอดช่วงที่เหลือของวันนี้",
      },
    },
    recentlyUploaded: "ล่าสุด",


    nothingLogged: "ยังไม่ได้จดอะไร",
    diaryFailed: "โหลดไดอารี่ของคุณไม่สำเร็จ",
    tryAgain: "ลองอีกครั้ง",
    webUploadPhoto: "อัปโหลดรูป",
    webComposerPlaceholder: "บอกว่ากินอะไรไป หรือวางรูปที่นี่",
    webDayRegion: "สรุปประจำวัน",
    webProposalLead: "จะจดลง {day} ถูกไหม?",
    todayWord: "วันนี้",
    webLogIt: "จดเลย",
    webProposalNo: "ไม่",
    webPage: "หน้า {n} จาก {total}",
    webDone: "เสร็จสิ้น",
    queue: { uploading: "กำลังอัปโหลดรูป · 1 จาก 4", waiting: "รอส่ง", notMeal: "ดูไม่เหมือนมื้ออาหาร", unread: "อ่านรูปนี้ไม่ได้", nothingCounted: "ไม่ได้นับอะไร", retake: "ถ่ายใหม่", remove: "นำออก", question: "นับเป็น ≈{kcal} ขอรายละเอียดอีกนิดจะแม่นขึ้น", answer: "ตอบ 1 คำถาม", dropTitle: "วางรูปตรงไหนก็ได้เพื่อจด", dropSub: "หรือวางรูปลงในช่องพิมพ์", addedTitle: "เพิ่มลงในวันของคุณแล้ว", addedSub: "เราจะนับให้ ปิดแอปได้เลย", beingRead: "{time} · กำลังอ่าน ปิดแอปได้เลย", found: "อาหารที่พบ: {n}", labelRead: "อ่านจากฉลากโภชนาการในรูปของคุณ", unreadableLabel: "อ่านฉลากนั้นไม่ได้", asMealPhoto: "วิเคราะห์เป็นรูปมื้ออาหาร" },
  },
  sv: {
    phoneToday: "I dag",
    phoneStreakAria: "{n} dagar i rad",
    phoneStreakGoalAria: "{n} av {goal} dagar",
    phoneDayNote: "Håll middagen lätt: {grams} g {nutrient} kvar.",
    phoneGoToDay: "Gå till {day}",
    pickerPrevMonth: "Föregående månad",
    pickerNextMonth: "Nästa månad",
    pickerClose: "Stäng",
    pickDay: "Välj en dag",
    pickerDayLogged: "{day}, har måltider",
    pickerDayUnlogged: "{day}, inget loggat",
    kcalLeft: "kcal kvar",
    kcalEaten: "kcal ätna",
    kcalOver: "kcal över",
    kcalLeftDetail: "kcal kvar · {eaten} av {plan}",
    kcalEatenDetail: "kcal ätna · {eaten} av {plan}",
    kcalOverDetail: "kcal över · {eaten} av {plan}",
    grams: "{n} g",
    milligrams: "{n} mg",
    gramLeft: "{grams} kvar", gramOver: "{grams} över",
    dayNoteSatFat: "mättat fett",

    macros: {
      protein: { name: "protein", left: "Protein kvar", over: "Protein över", ofTarget: "av {target} protein", chip: "protein {n} g" },
      carbs: { name: "kolhydrater", left: "Kolhydrater kvar", over: "Kolhydrater över", ofTarget: "av {target} kolhydrater", chip: "kolhydrater {n} g" },
      fat: { name: "fett", left: "Fett kvar", over: "Fett över", ofTarget: "av {target} fett", chip: "fett {n} g" },
      satFat: { name: "mättat fett", left: "Mättat fett kvar", over: "Mättat fett över", ofTarget: "av {target} mättat fett", chip: "mättat fett {n} g" },
      sodium: { name: "Natrium", left: "Natrium kvar", over: "Natrium över", ofTarget: "av {target} natrium", chip: "natrium {n} mg" },
      fibre: { name: "Fibrer", chip: "fibrer {n} g" },
      sugar: { name: "Socker", chip: "socker {n} g" },
    },
    tips: {
      protein: {
        togo: "Lägg till en proteinkälla i nästa måltid: ägg, grekisk yoghurt, keso, kyckling, fisk, tofu eller linser.",
        reached: "Nu har du fått i dig dagens protein. Mer än så är valfritt.",
        over: "Du har fått tillräckligt med protein i dag. Hoppa över extra kött, fisk, ägg och proteinshakes till i morgon.",
      },
      carbs: {
        left: "Det finns plats för en liten portion bröd, ris, pasta eller frukt i dag.",
        over: "Begränsa kolhydraterna resten av dagen. Ta det lugnt med bröd, ris, pasta, godis och söta drycker.",
      },
      satfat: {
        left: "Du är nära dagens gräns. Välj magert kött, fisk eller växtbaserade alternativ.",
        over: "Begränsa smör, ost, fett kött, bakverk och friterad mat resten av dagen.",
      },
    },
    recentlyUploaded: "Senaste",


    nothingLogged: "Inget loggat än.",
    diaryFailed: "Det gick inte att ladda din dagbok.",
    tryAgain: "Försök igen",
    webUploadPhoto: "Ladda upp ett foto",
    webComposerPlaceholder: "Berätta vad du åt, eller släpp ett foto här",
    webDayRegion: "Dagssammanfattning",
    webProposalLead: "Loggar på {day} — stämmer det?",
    todayWord: "i dag",
    webLogIt: "Logga",
    webProposalNo: "Nej",
    webPage: "Sida {n} av {total}",
    webDone: "Klar",
    queue: { uploading: "Laddar upp foto · 1 av 4", waiting: "Väntar på att skickas", notMeal: "Det där ser inte ut som en måltid", unread: "Det gick inte att läsa fotot", nothingCounted: "Inget räknades.", retake: "Ta om", remove: "Ta bort", question: "Räknat som ≈{kcal}. En detalj skulle göra det exaktare.", answer: "Svara på 1 fråga", dropTitle: "Släpp ett foto var som helst för att logga det", dropSub: "eller klistra in ett i inmatningsrutan", addedTitle: "Tillagd i din dag", addedSub: "Vi räknar på den. Du kan stänga appen.", beingRead: "{time} · läses, du kan stänga appen", found: "Livsmedel hittade: {n}", labelRead: "Avläst från näringsdeklarationen på ditt foto.", unreadableLabel: "Det gick inte att läsa etiketten.", asMealPhoto: "Analysera som måltidsfoto" },
  },
  uk: {
    phoneToday: "Сьогодні",
    phoneStreakAria: "Серія: {n} дн.",
    phoneStreakGoalAria: "{n} з {goal} дн.",
    phoneDayNote: "На вечерю — щось легке: {nutrient} — не більше {grams} г.",
    phoneGoToDay: "Відкрити {day}",
    pickerPrevMonth: "Попередній місяць",
    pickerNextMonth: "Наступний місяць",
    pickerClose: "Закрити",
    pickDay: "Вибрати день",
    pickerDayLogged: "{day}, є прийоми їжі",
    pickerDayUnlogged: "{day}, нічого не записано",
    kcalLeft: "ккал лишилося",
    kcalEaten: "ккал з'їдено",
    kcalOver: "ккал понад план",
    kcalLeftDetail: "ккал лишилося · {eaten} з {plan}",
    kcalEatenDetail: "ккал з'їдено · {eaten} з {plan}",
    kcalOverDetail: "ккал понад план · {eaten} з {plan}",
    grams: "{n} г",
    milligrams: "{n} мг",
    gramLeft: "лишилося {grams}", gramOver: "{grams} понад норму",
    dayNoteSatFat: "насичені жири",

    macros: {
      protein: { name: "білок", left: "Білка лишилося", over: "Білка понад норму", ofTarget: "білка з {target}", chip: "білок {n} г" },
      carbs: { name: "вуглеводи", left: "Вуглеводів лишилося", over: "Вуглеводів понад норму", ofTarget: "вуглеводів з {target}", chip: "вуглеводи {n} г" },
      fat: { name: "жири", left: "Жирів лишилося", over: "Жирів понад норму", ofTarget: "жирів з {target}", chip: "жири {n} г" },
      satFat: { name: "нас. жири", left: "Нас. жирів лишилося", over: "Нас. жирів понад норму", ofTarget: "насичених жирів з {target}", chip: "нас. жири {n} г" },
      sodium: { name: "Натрій", left: "Натрію лишилося", over: "Натрію понад норму", ofTarget: "натрію з {target}", chip: "натрій {n} мг" },
      fibre: { name: "Клітковина", chip: "клітковина {n} г" },
      sugar: { name: "Цукор", chip: "цукор {n} г" },
    },
    tips: {
      protein: {
        togo: "Додай джерело білка до наступного прийому їжі: яйця, грецький йогурт, сир, курку, рибу, тофу або сочевицю.",
        reached: "Це вся сьогоднішня норма білка. Більше — за бажанням.",
        over: "Білка сьогодні вже досить. До завтра пропусти зайве м'ясо, рибу, яйця й протеїнові коктейлі.",
      },
      carbs: {
        left: "Сьогодні ще є місце для невеликої порції хліба, рису, макаронів або фруктів.",
        over: "Обмеж вуглеводи до кінця дня. Обережніше з хлібом, рисом, макаронами, солодощами й солодкими напоями.",
      },
      satfat: {
        left: "Денний ліміт уже близько. Обирай нежирне м'ясо, рибу або рослинні страви.",
        over: "До кінця дня обмеж вершкове масло, твердий сир, жирне м'ясо, випічку й смажене.",
      },
    },
    recentlyUploaded: "Нещодавні",


    nothingLogged: "Поки нічого не записано.",
    diaryFailed: "Не вдалося завантажити щоденник.",
    tryAgain: "Спробувати ще раз",
    webUploadPhoto: "Завантажити фото",
    webComposerPlaceholder: "Розкажи, що було на тарілці, або перетягни фото",
    webDayRegion: "Підсумок дня",
    webProposalLead: "Записую на {day} — усе правильно?",
    todayWord: "сьогодні",
    webLogIt: "Записати",
    webProposalNo: "Ні",
    webPage: "Сторінка {n} з {total}",
    webDone: "Готово",
    queue: { uploading: "Завантаження фото · 1 з 4", waiting: "Чекає на надсилання", notMeal: "Це не схоже на прийом їжі", unread: "Не вдалося прочитати це фото", nothingCounted: "Нічого не зараховано.", retake: "Перезняти", remove: "Прибрати", question: "Пораховано як ≈{kcal}. Одна деталь зробить оцінку точнішою.", answer: "Відповісти на 1 запитання", dropTitle: "Перетягни фото будь-куди, щоб записати", dropSub: "або встав його в поле вводу", addedTitle: "Додано до твого дня", addedSub: "Ми все порахуємо. Програму можна закрити.", beingRead: "{time} · читаємо, програму можна закрити", found: "Знайдено продуктів: {n}", labelRead: "Прочитано з харчової етикетки на твоєму фото.", unreadableLabel: "Не вдалося прочитати цю етикетку.", asMealPhoto: "Проаналізувати як фото їжі" },
  },
  nl: {
    phoneToday: "Vandaag",
    phoneStreakAria: "{n} dagen op rij",
    phoneStreakGoalAria: "{n} van {goal} dagen",
    phoneDayNote: "Houd het avondeten licht: nog {grams} g {nutrient} over.",
    phoneGoToDay: "Ga naar {day}",
    pickerPrevMonth: "Vorige maand",
    pickerNextMonth: "Volgende maand",
    pickerClose: "Sluit",
    pickDay: "Kies een dag",
    pickerDayLogged: "{day}, heeft maaltijden",
    pickerDayUnlogged: "{day}, niets gelogd",
    kcalLeft: "kcal over",
    kcalEaten: "kcal gegeten",
    kcalOver: "kcal te veel",
    kcalLeftDetail: "kcal over · {eaten} van {plan}",
    kcalEatenDetail: "kcal gegeten · {eaten} van {plan}",
    kcalOverDetail: "kcal te veel · {eaten} van {plan}",
    grams: "{n}g",
    milligrams: "{n}mg",
    gramLeft: "{grams} over", gramOver: "{grams} te veel",
    dayNoteSatFat: "verzadigd vet",

    macros: {
      protein: { name: "eiwit", left: "Eiwit over", over: "Eiwit te veel", ofTarget: "van {target} eiwit", chip: "eiwit {n} g" },
      carbs: { name: "koolhydraten", left: "Koolhydraten over", over: "Koolhydraten te veel", ofTarget: "van {target} koolhydraten", chip: "koolhydraten {n} g" },
      fat: { name: "vet", left: "Vet over", over: "Vet te veel", ofTarget: "van {target} vet", chip: "vet {n} g" },
      satFat: { name: "verz. vet", left: "Verz. vet over", over: "Verz. vet te veel", ofTarget: "van {target} verz. vet", chip: "verz. vet {n} g" },
      sodium: { name: "Natrium", left: "Natrium over", over: "Natrium te veel", ofTarget: "van {target} natrium", chip: "natrium {n} mg" },
      fibre: { name: "Vezels", chip: "vezels {n} g" },
      sugar: { name: "Suiker", chip: "suiker {n} g" },
    },
    tips: {
      protein: {
        togo: "Voeg een eiwitbron toe aan je volgende maaltijd: eieren, Griekse yoghurt, hüttenkäse, kip, vis, tofu of linzen.",
        reached: "Dat is je eiwit voor vandaag. Meer is optioneel.",
        over: "Je hebt vandaag genoeg eiwit gehad. Sla extra vlees, vis, eieren en eiwitshakes over tot morgen.",
      },
      carbs: {
        left: "Er is vandaag nog ruimte voor een kleine portie brood, rijst, pasta of fruit.",
        over: "Beperk koolhydraten voor de rest van vandaag. Doe rustig aan met brood, rijst, pasta, snoep en zoete drankjes.",
      },
      satfat: {
        left: "Je zit dicht bij de limiet van vandaag. Kies mager vlees, vis of plantaardige opties.",
        over: "Beperk boter, kaas, vet vlees, gebak en gefrituurd eten voor de rest van vandaag.",
      },
    },
    recentlyUploaded: "Recent",


    nothingLogged: "Nog niets gelogd.",
    diaryFailed: "Je dagboek kon niet worden geladen.",
    tryAgain: "Probeer opnieuw",
    webUploadPhoto: "Upload een foto",
    webComposerPlaceholder: "Vertel wat je hebt gegeten, of sleep een foto hierheen",
    webDayRegion: "Dagoverzicht",
    webProposalLead: "Ik log dit voor {day} — klopt het?",
    todayWord: "vandaag",
    webLogIt: "Log het",
    webProposalNo: "Nee",
    webPage: "Pagina {n} van {total}",
    webDone: "Klaar",
    queue: { uploading: "Foto uploaden · 1 van 4", waiting: "Wacht op versturen", notMeal: "Dat lijkt geen maaltijd", unread: "Deze foto kon niet worden gelezen", nothingCounted: "Er is niets meegeteld.", retake: "Opnieuw maken", remove: "Haal weg", question: "Geteld als ≈{kcal}. Eén detail maakt het preciezer.", answer: "Beantwoord 1 vraag", dropTitle: "Sleep ergens een foto neer om hem te loggen", dropSub: "of plak er een in het invoerveld", addedTitle: "Toegevoegd aan je dag", addedSub: "We tellen het mee. Je kunt de app sluiten.", beingRead: "{time} · wordt gelezen, je kunt de app sluiten", found: "Gevonden voedingsmiddelen: {n}", labelRead: "Gelezen van het voedingsetiket op je foto.", unreadableLabel: "Dat etiket kon niet worden gelezen.", asMealPhoto: "Analyseer als maaltijdfoto" },
  },
  pl: {
    phoneToday: "Dziś",
    phoneStreakAria: "Dni z rzędu: {n}",
    phoneStreakGoalAria: "{n} z {goal} dni",
    phoneDayNote: "Lekka kolacja: {nutrient} — zostało {grams} g.",
    phoneGoToDay: "Przejdź do: {day}",
    pickerPrevMonth: "Poprzedni miesiąc",
    pickerNextMonth: "Następny miesiąc",
    pickerClose: "Zamknij",
    pickDay: "Wybierz dzień",
    pickerDayLogged: "{day}, są posiłki",
    pickerDayUnlogged: "{day}, nic nie zapisano",
    kcalLeft: "kcal zostało",
    kcalEaten: "kcal zjedzone",
    kcalOver: "kcal ponad plan",
    kcalLeftDetail: "kcal zostało · {eaten} z {plan}",
    kcalEatenDetail: "kcal zjedzone · {eaten} z {plan}",
    kcalOverDetail: "kcal ponad plan · {eaten} z {plan}",
    grams: "{n}g",
    milligrams: "{n}mg",
    gramLeft: "zostało {grams}", gramOver: "{grams} ponad plan",
    dayNoteSatFat: "tłuszcze nasycone",

    macros: {
      protein: { name: "białko", left: "Zostało białka", over: "Nadwyżka białka", ofTarget: "z {target} białka", chip: "białko {n} g" },
      carbs: { name: "węglowodany", left: "Zostało węglowodanów", over: "Nadwyżka węglowodanów", ofTarget: "z {target} węglowodanów", chip: "węglowodany {n} g" },
      fat: { name: "tłuszcz", left: "Zostało tłuszczu", over: "Nadwyżka tłuszczu", ofTarget: "z {target} tłuszczu", chip: "tłuszcz {n} g" },
      satFat: { name: "tł. nasycone", left: "Zostało tł. nasyconych", over: "Nadwyżka tł. nasyconych", ofTarget: "z {target} tłuszczów nasyconych", chip: "tł. nasycone {n} g" },
      sodium: { name: "Sód", left: "Zostało sodu", over: "Nadwyżka sodu", ofTarget: "z {target} sodu", chip: "sód {n} mg" },
      fibre: { name: "Błonnik", chip: "błonnik {n} g" },
      sugar: { name: "Cukier", chip: "cukier {n} g" },
    },
    tips: {
      protein: {
        togo: "Dodaj źródło białka do następnego posiłku: jajka, jogurt grecki, twarożek, kurczaka, rybę, tofu lub soczewicę.",
        reached: "To dzisiejsze białko. Więcej jest opcjonalne.",
        over: "Masz już dziś dość białka. Do jutra odpuść dodatkowe mięso, ryby, jajka i shaki białkowe.",
      },
      carbs: {
        left: "Dziś jest jeszcze miejsce na małą porcję chleba, ryżu, makaronu lub owoców.",
        over: "Do końca dnia ogranicz węglowodany. Uważaj na chleb, ryż, makaron, słodycze i słodkie napoje.",
      },
      satfat: {
        left: "Zbliżasz się do dzisiejszego limitu. Wybieraj chude mięso, ryby lub opcje roślinne.",
        over: "Do końca dnia ogranicz masło, ser, tłuste mięso, wypieki i smażone jedzenie.",
      },
    },
    recentlyUploaded: "Ostatnie",


    nothingLogged: "Jeszcze nic nie zapisano.",
    diaryFailed: "Nie udało się wczytać dziennika.",
    tryAgain: "Spróbuj ponownie",
    webUploadPhoto: "Prześlij zdjęcie",
    webComposerPlaceholder: "Napisz, co było na talerzu, albo upuść zdjęcie",
    webDayRegion: "Podsumowanie dnia",
    webProposalLead: "Zapisuję na {day} — zgadza się?",
    todayWord: "dziś",
    webLogIt: "Zapisz",
    webProposalNo: "Nie",
    webPage: "Strona {n} z {total}",
    webDone: "Gotowe",
    queue: { uploading: "Przesyłanie zdjęcia · 1 z 4", waiting: "Czeka na wysłanie", notMeal: "To nie wygląda na posiłek", unread: "Nie udało się odczytać zdjęcia", nothingCounted: "Nic nie zostało policzone.", retake: "Zrób ponownie", remove: "Usuń", question: "Policzone jako ≈{kcal}. Jeden szczegół to doprecyzuje.", answer: "Odpowiedz na 1 pytanie", dropTitle: "Upuść zdjęcie w dowolnym miejscu, aby je zapisać", dropSub: "lub wklej je do pola wiadomości", addedTitle: "Dodane do twojego dnia", addedSub: "Policzymy to. Możesz zamknąć aplikację.", beingRead: "{time} · odczytywanie, możesz zamknąć aplikację", found: "Znalezione produkty: {n}", labelRead: "Odczytano z etykiety na zdjęciu.", unreadableLabel: "Nie udało się odczytać tej etykiety.", asMealPhoto: "Analizuj jako zdjęcie posiłku" },
  },
  tr: {
    phoneToday: "Bugün",
    phoneStreakAria: "{n} günlük seri",
    phoneStreakGoalAria: "{n} / {goal} gün",
    phoneDayNote: "Akşam yemeğini hafif tut: {nutrient} için {grams} g kaldı.",
    phoneGoToDay: "Güne git: {day}",
    pickerPrevMonth: "Önceki ay",
    pickerNextMonth: "Sonraki ay",
    pickerClose: "Kapat",
    pickDay: "Bir gün seç",
    pickerDayLogged: "{day}, öğün var",
    pickerDayUnlogged: "{day}, kayıt yok",
    kcalLeft: "kcal kaldı",
    kcalEaten: "kcal yendi",
    kcalOver: "kcal fazla",
    kcalLeftDetail: "kcal kaldı · {eaten} / {plan}",
    kcalEatenDetail: "kcal yendi · {eaten} / {plan}",
    kcalOverDetail: "kcal fazla · {eaten} / {plan}",
    grams: "{n}g",
    milligrams: "{n}mg",
    gramLeft: "{grams} kaldı", gramOver: "{grams} fazla",
    dayNoteSatFat: "doymuş yağ",

    macros: {
      protein: { name: "protein", left: "Kalan protein", over: "Fazla protein", ofTarget: "/ {target} protein", chip: "protein {n}g" },
      carbs: { name: "karbonhidrat", left: "Kalan karbonhidrat", over: "Fazla karbonhidrat", ofTarget: "/ {target} karbonhidrat", chip: "karbonhidrat {n} g" },
      fat: { name: "yağ", left: "Kalan yağ", over: "Fazla yağ", ofTarget: "/ {target} yağ", chip: "yağ {n} g" },
      satFat: { name: "doymuş yağ", left: "Kalan doymuş yağ", over: "Fazla doymuş yağ", ofTarget: "/ {target} doymuş yağ", chip: "doymuş yağ {n} g" },
      sodium: { name: "Sodyum", left: "Kalan sodyum", over: "Fazla sodyum", ofTarget: "/ {target} sodyum", chip: "sodyum {n} mg" },
      fibre: { name: "Lif", chip: "lif {n} g" },
      sugar: { name: "Şeker", chip: "şeker {n} g" },
    },
    tips: {
      protein: {
        togo: "Bir sonraki öğününe bir protein kaynağı ekle: yumurta, Yunan yoğurdu, lor peyniri, tavuk, balık, tofu ya da mercimek.",
        reached: "Bugünün proteini tamam. Fazlası isteğe bağlı.",
        over: "Bugün yeterince protein aldın. Yarına kadar ekstra et, balık, yumurta ve protein shake'i atla.",
      },
      carbs: {
        left: "Bugün küçük bir porsiyon ekmek, pirinç, makarna ya da meyveye yer var.",
        over: "Günün geri kalanında karbonhidratı sınırla. Ekmek, pirinç, makarna, tatlı ve şekerli içeceklerde ölçülü ol.",
      },
      satfat: {
        left: "Bugünkü sınıra yaklaştın. Yağsız et, balık ya da bitkisel seçenekleri tercih et.",
        over: "Günün geri kalanında tereyağı, peynir, yağlı et, hamur işi ve kızartmayı sınırla.",
      },
    },
    recentlyUploaded: "Son eklenenler",


    nothingLogged: "Henüz bir şey kaydedilmedi.",
    diaryFailed: "Günlüğün yüklenemedi.",
    tryAgain: "Tekrar dene",
    webUploadPhoto: "Fotoğraf yükle",
    webComposerPlaceholder: "Ne yediğini söyle ya da bir fotoğraf bırak",
    webDayRegion: "Gün özeti",
    webProposalLead: "Kayıt günü: {day} — doğru mu?",
    todayWord: "bugün",
    webLogIt: "Kaydet",
    webProposalNo: "Hayır",
    webPage: "Sayfa {n} / {total}",
    webDone: "Bitti",
    queue: { uploading: "Fotoğraf yükleniyor · 1 / 4", waiting: "Gönderilmeyi bekliyor", notMeal: "Bu bir öğüne benzemiyor", unread: "Bu fotoğraf okunamadı", nothingCounted: "Hiçbir şey sayılmadı.", retake: "Yeniden çek", remove: "Kaldır", question: "≈{kcal} olarak sayıldı. Bir ayrıntı bunu netleştirir.", answer: "1 soruyu yanıtla", dropTitle: "Kaydetmek için bir fotoğrafı herhangi bir yere bırak", dropSub: "ya da yazma alanına yapıştır", addedTitle: "Gününe eklendi", addedSub: "Sayacağız. Uygulamayı kapatabilirsin.", beingRead: "{time} · okunuyor, uygulamayı kapatabilirsin", found: "Bulunan yiyecekler: {n}", labelRead: "Fotoğrafındaki besin etiketinden okundu.", unreadableLabel: "Bu etiket okunamadı.", asMealPhoto: "Öğün fotoğrafı olarak analiz et" },
  },
  "zh-Hant": {
    phoneToday: "今天",
    phoneStreakAria: "連續 {n} 天",
    phoneStreakGoalAria: "{n}／{goal} 天",
    phoneDayNote: "晚餐吃清淡些：{nutrient}只剩 {grams} 公克。",
    phoneGoToDay: "前往{day}",
    pickerPrevMonth: "上個月",
    pickerNextMonth: "下個月",
    pickerClose: "關閉",
    pickDay: "選擇日期",
    pickerDayLogged: "{day}，有餐點紀錄",
    pickerDayUnlogged: "{day}，沒有紀錄",
    kcalLeft: "剩餘大卡",
    kcalEaten: "已攝取大卡",
    kcalOver: "超出大卡",
    kcalLeftDetail: "剩餘大卡 · {eaten}／{plan}",
    kcalEatenDetail: "已攝取大卡 · {eaten}／{plan}",
    kcalOverDetail: "超出大卡 · {eaten}／{plan}",
    grams: "{n} 公克",
    milligrams: "{n} 毫克",
    gramLeft: "剩餘 {grams}", gramOver: "超出 {grams}",
    dayNoteSatFat: "飽和脂肪",

    macros: {
      protein: { name: "蛋白質", left: "蛋白質剩餘", over: "蛋白質超出", ofTarget: "／{target} 蛋白質", chip: "蛋白質 {n} 公克" },
      carbs: { name: "碳水", left: "碳水剩餘", over: "碳水超出", ofTarget: "／{target} 碳水", chip: "碳水 {n} 公克" },
      fat: { name: "脂肪", left: "脂肪剩餘", over: "脂肪超出", ofTarget: "／{target} 脂肪", chip: "脂肪 {n} 公克" },
      satFat: { name: "飽和脂肪", left: "飽和脂肪剩餘", over: "飽和脂肪超出", ofTarget: "／{target} 飽和脂肪", chip: "飽和脂肪 {n} 公克" },
      sodium: { name: "鈉", left: "鈉剩餘", over: "鈉超出", ofTarget: "／{target} 鈉", chip: "鈉 {n} 毫克" },
      fibre: { name: "膳食纖維", chip: "膳食纖維 {n} 公克" },
      sugar: { name: "糖", chip: "糖 {n} 公克" },
    },
    tips: {
      protein: {
        togo: "下一餐加入蛋白質來源：蛋、希臘優格、茅屋起司、雞肉、魚、豆腐或扁豆。",
        reached: "今天的蛋白質達標了，再多吃就隨你。",
        over: "你今天的蛋白質已經夠了。明天之前先別再加肉、魚、蛋和蛋白飲。",
      },
      carbs: {
        left: "今天還有空間吃一小份麵包、米飯、義大利麵或水果。",
        over: "今天接下來少吃碳水。麵包、米飯、義大利麵、甜食和含糖飲料都要節制。",
      },
      satfat: {
        left: "你快到今天的上限了。選瘦肉、魚或植物性的選項吧。",
        over: "今天接下來少吃奶油、起司、肥肉、糕點和油炸食物。",
      },
    },
    recentlyUploaded: "最近",


    nothingLogged: "還沒有任何紀錄。",
    diaryFailed: "無法載入你的日記。",
    tryAgain: "再試一次",
    webUploadPhoto: "上傳照片",
    webComposerPlaceholder: "告訴我你吃了什麼，或拖入一張照片",
    webDayRegion: "當日摘要",
    webProposalLead: "記錄到{day}——對嗎？",
    todayWord: "今天",
    webLogIt: "記錄",
    webProposalNo: "不要",
    webPage: "第 {n} 頁，共 {total} 頁",
    webDone: "完成",
    queue: { uploading: "正在上傳照片 · 1／4", waiting: "等待傳送", notMeal: "這看起來不像一份餐點", unread: "無法讀取這張照片", nothingCounted: "沒有計入任何次數。", retake: "重拍", remove: "移除", question: "已估算為 ≈{kcal}。多一個細節會更準確。", answer: "回答 1 個問題", dropTitle: "把照片拖到任何地方即可記錄", dropSub: "或貼到輸入框中", addedTitle: "已加入你的這一天", addedSub: "我們會計算它，你可以關閉 App 了。", beingRead: "{time} · 讀取中，你可以關閉 App", found: "找到的食物：{n}", labelRead: "已從照片中的營養標示讀取。", unreadableLabel: "無法讀取這個營養標示。", asMealPhoto: "當作餐點照片分析" },
  },
  "zh-Hans": {
    phoneToday: "今天",
    phoneStreakAria: "连续 {n} 天",
    phoneStreakGoalAria: "{n} / {goal} 天",
    phoneDayNote: "晚餐清淡些：{nutrient}还剩 {grams}克。",
    phoneGoToDay: "前往{day}",
    pickerPrevMonth: "上个月",
    pickerNextMonth: "下个月",
    pickerClose: "关闭",
    pickDay: "选择日期",
    pickerDayLogged: "{day}，有餐食记录",
    pickerDayUnlogged: "{day}，没有记录",
    kcalLeft: "千卡剩余",
    kcalEaten: "千卡已吃",
    kcalOver: "千卡超出",
    kcalLeftDetail: "千卡剩余 · {eaten} / {plan}",
    kcalEatenDetail: "千卡已吃 · {eaten} / {plan}",
    kcalOverDetail: "千卡超出 · {eaten} / {plan}",
    grams: "{n}克",
    milligrams: "{n}毫克",
    gramLeft: "剩余 {grams}", gramOver: "超出 {grams}",
    dayNoteSatFat: "饱和脂肪",

    macros: {
      protein: { name: "蛋白质", left: "蛋白质剩余", over: "蛋白质超出", ofTarget: "/ {target} 蛋白质", chip: "蛋白质 {n}克" },
      carbs: { name: "碳水", left: "碳水剩余", over: "碳水超出", ofTarget: "/ {target} 碳水", chip: "碳水 {n}克" },
      fat: { name: "脂肪", left: "脂肪剩余", over: "脂肪超出", ofTarget: "/ {target} 脂肪", chip: "脂肪 {n}克" },
      satFat: { name: "饱和脂肪", left: "饱和脂肪剩余", over: "饱和脂肪超出", ofTarget: "/ {target} 饱和脂肪", chip: "饱和脂肪 {n}克" },
      sodium: { name: "钠", left: "钠剩余", over: "钠超出", ofTarget: "/ {target} 钠", chip: "钠 {n}毫克" },
      fibre: { name: "膳食纤维", chip: "膳食纤维 {n}克" },
      sugar: { name: "糖", chip: "糖 {n}克" },
    },
    tips: {
      protein: {
        togo: "下一餐加点蛋白质：鸡蛋、希腊酸奶、茅屋奶酪、鸡肉、鱼、豆腐或扁豆。",
        reached: "今天的蛋白质够了。再多吃可以随意。",
        over: "今天的蛋白质已经够了。明天之前不用再加肉、鱼、蛋和蛋白粉饮品。",
      },
      carbs: {
        left: "今天还可以吃一小份面包、米饭、意面或水果。",
        over: "今天剩下的时间少吃碳水。面包、米饭、意面、甜食和含糖饮料都悠着点。",
      },
      satfat: {
        left: "已接近今天的上限。选瘦肉、鱼或植物性食物吧。",
        over: "今天剩下的时间少吃黄油、奶酪、肥肉、酥皮点心和油炸食品。",
      },
    },
    recentlyUploaded: "最近",


    nothingLogged: "还没有记录。",
    diaryFailed: "没能加载你的日记。",
    tryAgain: "再试一次",
    webUploadPhoto: "上传照片",
    webComposerPlaceholder: "告诉我你吃了什么，或者拖入一张照片",
    webDayRegion: "当日概览",
    webProposalLead: "记录到{day}——对吗？",
    todayWord: "今天",
    webLogIt: "记录",
    webProposalNo: "不对",
    webPage: "第 {n} 页，共 {total} 页",
    webDone: "完成",
    queue: { uploading: "正在上传照片 · 1/4", waiting: "等待发送", notMeal: "这看起来不像一餐", unread: "没能读取这张照片", nothingCounted: "没有计入任何内容。", retake: "重拍", remove: "移除", question: "已按约 {kcal} 计入。补充一个细节会更准确。", answer: "回答 1 个问题", dropTitle: "把照片拖到任意位置即可记录", dropSub: "或粘贴到输入框中", addedTitle: "已添加到你的这一天", addedSub: "我们会计算好。你可以关闭 App 了。", beingRead: "{time} · 正在识别，你可以关闭 App", found: "找到的食物：{n}", labelRead: "已从照片中的营养成分表读取。", unreadableLabel: "没能读取这张营养成分表。", asMealPhoto: "当作餐食照片分析" },
  },
  ko: {
    phoneToday: "오늘",
    phoneStreakAria: "{n}일 연속",
    phoneStreakGoalAria: "{goal}일 중 {n}일",
    phoneDayNote: "저녁은 가볍게: {nutrient} {grams}g 남았어요.",
    phoneGoToDay: "{day}(으)로 이동",
    pickerPrevMonth: "이전 달",
    pickerNextMonth: "다음 달",
    pickerClose: "닫기",
    pickDay: "날짜 선택",
    pickerDayLogged: "{day}, 식사 기록 있음",
    pickerDayUnlogged: "{day}, 기록 없음",
    kcalLeft: "kcal 남음",
    kcalEaten: "kcal 섭취",
    kcalOver: "kcal 초과",
    kcalLeftDetail: "kcal 남음 · {plan} 중 {eaten}",
    kcalEatenDetail: "kcal 섭취 · {plan} 중 {eaten}",
    kcalOverDetail: "kcal 초과 · {plan} 중 {eaten}",
    grams: "{n}g",
    milligrams: "{n}mg",
    gramLeft: "{grams} 남음", gramOver: "{grams} 초과",
    dayNoteSatFat: "포화 지방",

    macros: {
      protein: { name: "단백질", left: "남은 단백질", over: "단백질 초과", ofTarget: "/ 단백질 {target}", chip: "단백질 {n}g" },
      carbs: { name: "탄수화물", left: "남은 탄수화물", over: "탄수화물 초과", ofTarget: "/ 탄수화물 {target}", chip: "탄수화물 {n}g" },
      fat: { name: "지방", left: "남은 지방", over: "지방 초과", ofTarget: "/ 지방 {target}", chip: "지방 {n}g" },
      satFat: { name: "포화 지방", left: "남은 포화 지방", over: "포화 지방 초과", ofTarget: "/ 포화 지방 {target}", chip: "포화 지방 {n}g" },
      sodium: { name: "나트륨", left: "남은 나트륨", over: "나트륨 초과", ofTarget: "/ 나트륨 {target}", chip: "나트륨 {n}mg" },
      fibre: { name: "식이섬유", chip: "식이섬유 {n}g" },
      sugar: { name: "당류", chip: "당류 {n}g" },
    },
    tips: {
      protein: {
        togo: "다음 식사에 단백질 식품을 더해 보세요. 달걀, 그릭 요거트, 코티지 치즈, 닭고기, 생선, 두부, 렌틸콩 같은 것들이요.",
        reached: "오늘 단백질은 채웠어요. 더 먹는 건 선택이에요.",
        over: "오늘 단백질은 충분히 먹었어요. 내일까지는 고기, 생선, 달걀, 프로틴 셰이크를 더 먹지 않아도 돼요.",
      },
      carbs: {
        left: "오늘은 빵, 밥, 파스타, 과일을 조금 먹을 여유가 있어요.",
        over: "오늘 남은 시간에는 탄수화물을 줄여 보세요. 빵, 밥, 파스타, 단 음식, 단 음료는 적당히요.",
      },
      satfat: {
        left: "오늘 한도에 가까워요. 기름기 적은 고기, 생선, 식물성 음식을 골라 보세요.",
        over: "오늘 남은 시간에는 버터, 치즈, 기름진 고기, 페이스트리, 튀긴 음식을 줄여 보세요.",
      },
    },
    recentlyUploaded: "최근",


    nothingLogged: "아직 기록이 없어요.",
    diaryFailed: "다이어리를 불러오지 못했어요.",
    tryAgain: "다시 시도",
    webUploadPhoto: "사진 업로드",
    webComposerPlaceholder: "먹은 것을 알려 주거나 사진을 끌어다 놓으세요",
    webDayRegion: "하루 요약",
    webProposalLead: "{day} 기록에 추가할게요. 맞나요?",
    todayWord: "오늘",
    webLogIt: "기록하기",
    webProposalNo: "아니요",
    webPage: "{total}페이지 중 {n}페이지",
    webDone: "완료",
    queue: { uploading: "사진 업로드 중 · 1/4", waiting: "전송 대기 중", notMeal: "식사처럼 보이지 않아요", unread: "이 사진을 읽지 못했어요", nothingCounted: "아무것도 집계되지 않았어요.", retake: "다시 찍기", remove: "지우기", question: "≈{kcal}(으)로 계산했어요. 한 가지만 알려 주면 더 정확해져요.", answer: "질문 1개에 답하기", dropTitle: "아무 곳에나 사진을 끌어다 놓으면 기록돼요", dropSub: "또는 입력창에 붙여넣으세요", addedTitle: "하루 기록에 추가했어요", addedSub: "계산은 저희가 할게요. 앱을 닫아도 돼요.", beingRead: "{time} · 분석 중, 앱을 닫아도 돼요", found: "찾은 음식: {n}개", labelRead: "사진 속 영양성분표에서 읽었어요.", unreadableLabel: "영양성분표를 읽지 못했어요.", asMealPhoto: "식사 사진으로 분석하기" },
  },
  ja: {
    phoneToday: "今日",
    phoneStreakAria: "{n}日連続",
    phoneStreakGoalAria: "{n}/{goal}日",
    phoneDayNote: "夕食は軽めに：{nutrient}は残り{grams}gです。",
    phoneGoToDay: "{day}へ移動",
    pickerPrevMonth: "前の月",
    pickerNextMonth: "次の月",
    pickerClose: "閉じる",
    pickDay: "日付を選択",
    pickerDayLogged: "{day}、記録あり",
    pickerDayUnlogged: "{day}、記録なし",
    kcalLeft: "kcal 残り",
    kcalEaten: "kcal 摂取",
    kcalOver: "kcal オーバー",
    kcalLeftDetail: "kcal 残り · {eaten} / {plan}",
    kcalEatenDetail: "kcal 摂取 · {eaten} / {plan}",
    kcalOverDetail: "kcal オーバー · {eaten} / {plan}",
    grams: "{n}g",
    milligrams: "{n}mg",
    gramLeft: "残り{grams}", gramOver: "{grams}オーバー",
    dayNoteSatFat: "飽和脂肪酸",

    macros: {
      protein: { name: "タンパク質", left: "タンパク質 残り", over: "タンパク質 オーバー", ofTarget: "/ タンパク質{target}", chip: "タンパク質 {n}g" },
      carbs: { name: "炭水化物", left: "炭水化物 残り", over: "炭水化物 オーバー", ofTarget: "/ 炭水化物{target}", chip: "炭水化物 {n}g" },
      fat: { name: "脂質", left: "脂質 残り", over: "脂質 オーバー", ofTarget: "/ 脂質{target}", chip: "脂質 {n}g" },
      satFat: { name: "飽和脂肪酸", left: "飽和脂肪酸 残り", over: "飽和脂肪酸 オーバー", ofTarget: "/ 飽和脂肪酸{target}", chip: "飽和脂肪酸 {n}g" },
      sodium: { name: "ナトリウム", left: "ナトリウム 残り", over: "ナトリウム オーバー", ofTarget: "/ ナトリウム{target}", chip: "ナトリウム {n}mg" },
      fibre: { name: "食物繊維", chip: "食物繊維 {n}g" },
      sugar: { name: "糖分", chip: "糖分 {n}g" },
    },
    tips: {
      protein: {
        togo: "次の食事にタンパク源を加えましょう：卵、ギリシャヨーグルト、カッテージチーズ、鶏肉、魚、豆腐、レンズ豆など。",
        reached: "今日のタンパク質はこれで達成です。これ以上はお好みで。",
        over: "今日のタンパク質は十分です。肉、魚、卵、プロテインシェイクの追加は明日まで控えましょう。",
      },
      carbs: {
        left: "今日はパン、ごはん、パスタ、果物を少しなら食べられます。",
        over: "今日の残りは炭水化物を控えめに。パン、ごはん、パスタ、甘いもの、甘い飲み物はほどほどにしましょう。",
      },
      satfat: {
        left: "今日の上限に近づいています。赤身の肉、魚、植物性の食品を選びましょう。",
        over: "今日の残りは、バター、チーズ、脂身の多い肉、焼き菓子、揚げ物を控えめにしましょう。",
      },
    },
    recentlyUploaded: "最近",


    nothingLogged: "まだ記録がありません。",
    diaryFailed: "日記を読み込めませんでした。",
    tryAgain: "もう一度試す",
    webUploadPhoto: "写真をアップロード",
    webComposerPlaceholder: "食べたものを教えるか、写真をドロップしてください",
    webDayRegion: "1日のまとめ",
    webProposalLead: "{day}に記録します。合っていますか？",
    todayWord: "今日",
    webLogIt: "記録する",
    webProposalNo: "いいえ",
    webPage: "{n}/{total}ページ",
    webDone: "完了",
    queue: { uploading: "写真をアップロード中 · 1/4", waiting: "送信待ち", notMeal: "食事ではないようです", unread: "この写真を読み取れませんでした", nothingCounted: "何もカウントされていません。", retake: "撮り直す", remove: "取り除く", question: "約{kcal}としてカウントしました。1つ教えてもらえると、より正確になります。", answer: "1つの質問に答える", dropTitle: "どこにでも写真をドロップして記録", dropSub: "または入力欄に貼り付け", addedTitle: "今日の記録に追加しました", addedSub: "カウントしておきます。アプリを閉じても大丈夫です。", beingRead: "{time} · 読み取り中、アプリを閉じても大丈夫です", found: "見つかった食品：{n}", labelRead: "写真の栄養成分表示から読み取りました。", unreadableLabel: "その表示を読み取れませんでした。", asMealPhoto: "食事の写真として解析する" },
  },
  "pt-BR": {
    phoneToday: "Hoje",
    phoneStreakAria: "Sequência de {n} dias",
    phoneStreakGoalAria: "{n} de {goal} dias",
    phoneDayNote: "Jantar leve: faltam {grams} g de {nutrient}.",
    phoneGoToDay: "Ir para {day}",
    pickerPrevMonth: "Mês anterior",
    pickerNextMonth: "Próximo mês",
    pickerClose: "Fechar",
    pickDay: "Escolha um dia",
    pickerDayLogged: "{day}, com refeições",
    pickerDayUnlogged: "{day}, nada registrado",
    kcalLeft: "kcal restantes",
    kcalEaten: "kcal consumidas",
    kcalOver: "kcal acima",
    kcalLeftDetail: "kcal restantes · {eaten} de {plan}",
    kcalEatenDetail: "kcal consumidas · {eaten} de {plan}",
    kcalOverDetail: "kcal acima · {eaten} de {plan}",
    grams: "{n}g",
    milligrams: "{n}mg",
    gramLeft: "{grams} restantes", gramOver: "{grams} acima",
    dayNoteSatFat: "gordura saturada",

    macros: {
      protein: { name: "proteína", left: "Proteína restante", over: "Proteína acima", ofTarget: "de {target} de proteína", chip: "proteína {n} g" },
      carbs: { name: "carboidratos", left: "Carboidratos restantes", over: "Carboidratos acima", ofTarget: "de {target} de carboidratos", chip: "carboidratos {n} g" },
      fat: { name: "gordura", left: "Gordura restante", over: "Gordura acima", ofTarget: "de {target} de gordura", chip: "gordura {n} g" },
      satFat: { name: "gord. saturada", left: "Gord. saturada restante", over: "Gord. saturada acima", ofTarget: "de {target} de gord. saturada", chip: "gord. saturada {n} g" },
      sodium: { name: "Sódio", left: "Sódio restante", over: "Sódio acima", ofTarget: "de {target} de sódio", chip: "sódio {n} mg" },
      fibre: { name: "Fibras", chip: "fibras {n} g" },
      sugar: { name: "Açúcar", chip: "açúcar {n} g" },
    },
    tips: {
      protein: {
        togo: "Inclua uma fonte de proteína na próxima refeição: ovos, iogurte grego, queijo cottage, frango, peixe, tofu ou lentilha.",
        reached: "Essa é a proteína de hoje. Mais que isso é opcional.",
        over: "Você já comeu proteína suficiente hoje. Deixe carne, peixe, ovos e shakes de proteína extras para amanhã.",
      },
      carbs: {
        left: "Ainda cabe uma porção pequena de pão, arroz, massa ou fruta hoje.",
        over: "Limite os carboidratos no resto do dia. Pegue leve com pão, arroz, massa, doces e bebidas açucaradas.",
      },
      satfat: {
        left: "Você está perto do limite de hoje. Prefira carne magra, peixe ou opções vegetais.",
        over: "Limite manteiga, queijo, carne gorda, massas folhadas e frituras no resto do dia.",
      },
    },
    recentlyUploaded: "Recentes",


    nothingLogged: "Nada registrado ainda.",
    diaryFailed: "Não deu para carregar seu diário.",
    tryAgain: "Tentar de novo",
    webUploadPhoto: "Enviar uma foto",
    webComposerPlaceholder: "Conte o que você comeu ou solte uma foto",
    webDayRegion: "Resumo do dia",
    webProposalLead: "Registrando para {day} — está certo?",
    todayWord: "hoje",
    webLogIt: "Registrar",
    webProposalNo: "Não",
    webPage: "Página {n} de {total}",
    webDone: "OK",
    queue: { uploading: "Enviando foto · 1 de 4", waiting: "Aguardando envio", notMeal: "Isso não parece uma refeição", unread: "Não deu para ler esta foto", nothingCounted: "Nada foi contado.", retake: "Tirar outra", remove: "Remover", question: "Contado como ≈{kcal}. Um detalhe deixaria mais preciso.", answer: "Responder 1 pergunta", dropTitle: "Solte uma foto em qualquer lugar para registrar", dropSub: "ou cole uma na caixa de texto", addedTitle: "Adicionado ao seu dia", addedSub: "A gente faz a conta. Pode fechar o app.", beingRead: "{time} · em análise, pode fechar o app", found: "Alimentos encontrados: {n}", labelRead: "Lido do rótulo nutricional na sua foto.", unreadableLabel: "Não foi possível ler esse rótulo.", asMealPhoto: "Analisar como foto de refeição" },
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
