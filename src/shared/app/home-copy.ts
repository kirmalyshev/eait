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
  nl: {
    phoneToday: "Vandaag",
    phoneStreakAria: "{n} dagen op rij",
    phoneStreakGoalAria: "{n} van {goal} dagen",
    phoneDayNote: "Houd het avondeten licht: nog {grams}g {nutrient} over.",
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
      protein: { name: "eiwit", left: "Eiwit over", over: "Eiwit te veel", ofTarget: "van {target} eiwit", chip: "eiwit {n}g" },
      carbs: { name: "koolhydraten", left: "Koolhydraten over", over: "Koolhydraten te veel", ofTarget: "van {target} koolhydraten", chip: "koolhydraten {n}g" },
      fat: { name: "vet", left: "Vet over", over: "Vet te veel", ofTarget: "van {target} vet", chip: "vet {n}g" },
      satFat: { name: "verz. vet", left: "Verz. vet over", over: "Verz. vet te veel", ofTarget: "van {target} verz. vet", chip: "verz. vet {n}g" },
      sodium: { name: "Natrium", left: "Natrium over", over: "Natrium te veel", ofTarget: "van {target} natrium", chip: "natrium {n}mg" },
      fibre: { name: "Vezels", chip: "vezels {n}g" },
      sugar: { name: "Suiker", chip: "suiker {n}g" },
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
    queue: { uploading: "Foto uploaden · 1 van 4", waiting: "Wacht op versturen", notMeal: "Dat lijkt geen maaltijd", unread: "Deze foto kon niet worden gelezen", nothingCounted: "Er is niets meegeteld.", retake: "Opnieuw maken", remove: "Haal weg", question: "Geteld als ≈{kcal}. Eén detail maakt het preciezer.", answer: "Beantwoord 1 vraag", dropTitle: "Sleep ergens een foto neer om hem te loggen", dropSub: "of plak er een in het invoerveld", addedTitle: "Toegevoegd aan je dag", addedSub: "We tellen het mee. Je kunt de app sluiten.", beingRead: "{time} · wordt gelezen, je kunt de app sluiten", found: "Gevonden voedingsmiddelen: {n}" },
  },
  pl: {
    phoneToday: "Dziś",
    phoneStreakAria: "Seria: {n} dni",
    phoneStreakGoalAria: "{n} z {goal} dni",
    phoneDayNote: "Lekka kolacja: {nutrient} — zostało {grams}g.",
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
      protein: { name: "białko", left: "Zostało białka", over: "Nadwyżka białka", ofTarget: "z {target} białka", chip: "białko {n}g" },
      carbs: { name: "węglowodany", left: "Zostało węglowodanów", over: "Nadwyżka węglowodanów", ofTarget: "z {target} węglowodanów", chip: "węglowodany {n}g" },
      fat: { name: "tłuszcz", left: "Zostało tłuszczu", over: "Nadwyżka tłuszczu", ofTarget: "z {target} tłuszczu", chip: "tłuszcz {n}g" },
      satFat: { name: "tł. nasycone", left: "Zostało tł. nasyconych", over: "Nadwyżka tł. nasyconych", ofTarget: "z {target} tłuszczów nasyconych", chip: "tł. nasycone {n}g" },
      sodium: { name: "Sód", left: "Zostało sodu", over: "Nadwyżka sodu", ofTarget: "z {target} sodu", chip: "sód {n}mg" },
      fibre: { name: "Błonnik", chip: "błonnik {n}g" },
      sugar: { name: "Cukier", chip: "cukier {n}g" },
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
    queue: { uploading: "Przesyłanie zdjęcia · 1 z 4", waiting: "Czeka na wysłanie", notMeal: "To nie wygląda na posiłek", unread: "Nie udało się odczytać zdjęcia", nothingCounted: "Nic nie zostało policzone.", retake: "Zrób ponownie", remove: "Usuń", question: "Policzone jako ≈{kcal}. Jeden szczegół to doprecyzuje.", answer: "Odpowiedz na 1 pytanie", dropTitle: "Upuść zdjęcie w dowolnym miejscu, aby je zapisać", dropSub: "lub wklej je do pola wiadomości", addedTitle: "Dodane do twojego dnia", addedSub: "Policzymy to. Możesz zamknąć aplikację.", beingRead: "{time} · odczytywanie, możesz zamknąć aplikację", found: "Znalezione produkty: {n}" },
  },
  tr: {
    phoneToday: "Bugün",
    phoneStreakAria: "{n} günlük seri",
    phoneStreakGoalAria: "{n} / {goal} gün",
    phoneDayNote: "Akşam yemeğini hafif tut: {nutrient} için {grams}g kaldı.",
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
      carbs: { name: "karbonhidrat", left: "Kalan karbonhidrat", over: "Fazla karbonhidrat", ofTarget: "/ {target} karbonhidrat", chip: "karbonhidrat {n}g" },
      fat: { name: "yağ", left: "Kalan yağ", over: "Fazla yağ", ofTarget: "/ {target} yağ", chip: "yağ {n}g" },
      satFat: { name: "doymuş yağ", left: "Kalan doymuş yağ", over: "Fazla doymuş yağ", ofTarget: "/ {target} doymuş yağ", chip: "doymuş yağ {n}g" },
      sodium: { name: "Sodyum", left: "Kalan sodyum", over: "Fazla sodyum", ofTarget: "/ {target} sodyum", chip: "sodyum {n}mg" },
      fibre: { name: "Lif", chip: "lif {n}g" },
      sugar: { name: "Şeker", chip: "şeker {n}g" },
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
    queue: { uploading: "Fotoğraf yükleniyor · 1 / 4", waiting: "Gönderilmeyi bekliyor", notMeal: "Bu bir öğüne benzemiyor", unread: "Bu fotoğraf okunamadı", nothingCounted: "Hiçbir şey sayılmadı.", retake: "Yeniden çek", remove: "Kaldır", question: "≈{kcal} olarak sayıldı. Bir ayrıntı bunu netleştirir.", answer: "1 soruyu yanıtla", dropTitle: "Kaydetmek için bir fotoğrafı herhangi bir yere bırak", dropSub: "ya da yazma alanına yapıştır", addedTitle: "Gününe eklendi", addedSub: "Biz sayacağız. Uygulamayı kapatabilirsin.", beingRead: "{time} · okunuyor, uygulamayı kapatabilirsin", found: "Bulunan yiyecekler: {n}" },
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
    queue: { uploading: "正在上傳照片 · 1／4", waiting: "等待傳送", notMeal: "這看起來不像一份餐點", unread: "無法讀取這張照片", nothingCounted: "沒有計入任何次數。", retake: "重拍", remove: "移除", question: "已估算為 ≈{kcal}。多一個細節會更準確。", answer: "回答 1 個問題", dropTitle: "把照片拖到任何地方即可記錄", dropSub: "或貼到輸入框中", addedTitle: "已加入你的這一天", addedSub: "我們會計算它，你可以關閉 App 了。", beingRead: "{time} · 讀取中，你可以關閉 App", found: "找到的食物：{n}" },
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
    queue: { uploading: "正在上传照片 · 1 / 4", waiting: "等待发送", notMeal: "这看起来不像一餐", unread: "没能读取这张照片", nothingCounted: "没有计入任何内容。", retake: "重拍", remove: "移除", question: "已按约 {kcal} 计入。补充一个细节会更准确。", answer: "回答 1 个问题", dropTitle: "把照片拖到任意位置即可记录", dropSub: "或粘贴到输入框中", addedTitle: "已添加到你的这一天", addedSub: "我们会计算好。你可以关闭 App 了。", beingRead: "{time} · 正在识别，你可以关闭 App", found: "找到的食物：{n}" },
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
    queue: { uploading: "사진 업로드 중 · 1/4", waiting: "전송 대기 중", notMeal: "식사처럼 보이지 않아요", unread: "이 사진을 읽지 못했어요", nothingCounted: "아무것도 집계되지 않았어요.", retake: "다시 찍기", remove: "지우기", question: "≈{kcal}(으)로 계산했어요. 한 가지만 알려 주면 더 정확해져요.", answer: "질문 1개에 답하기", dropTitle: "아무 곳에나 사진을 끌어다 놓으면 기록돼요", dropSub: "또는 입력창에 붙여넣으세요", addedTitle: "하루 기록에 추가했어요", addedSub: "계산은 저희가 할게요. 앱을 닫아도 돼요.", beingRead: "{time} · 분석 중, 앱을 닫아도 돼요", found: "찾은 음식: {n}개" },
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
      sugar: { name: "糖質", chip: "糖質 {n}g" },
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
    queue: { uploading: "写真をアップロード中 · 1/4", waiting: "送信待ち", notMeal: "食事ではないようです", unread: "この写真を読み取れませんでした", nothingCounted: "何もカウントされていません。", retake: "撮り直す", remove: "取り除く", question: "約{kcal}としてカウントしました。1つ教えてもらえると、より正確になります。", answer: "1つの質問に答える", dropTitle: "どこにでも写真をドロップして記録", dropSub: "または入力欄に貼り付け", addedTitle: "今日の記録に追加しました", addedSub: "カウントしておきます。アプリを閉じても大丈夫です。", beingRead: "{time} · 読み取り中、アプリを閉じても大丈夫です", found: "見つかった食品：{n}" },
  },
  "pt-BR": {
    phoneToday: "Hoje",
    phoneStreakAria: "Sequência de {n} dias",
    phoneStreakGoalAria: "{n} de {goal} dias",
    phoneDayNote: "Jantar leve: faltam {grams}g de {nutrient}.",
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
      protein: { name: "proteína", left: "Proteína restante", over: "Proteína acima", ofTarget: "de {target} de proteína", chip: "proteína {n}g" },
      carbs: { name: "carboidratos", left: "Carboidratos restantes", over: "Carboidratos acima", ofTarget: "de {target} de carboidratos", chip: "carboidratos {n}g" },
      fat: { name: "gordura", left: "Gordura restante", over: "Gordura acima", ofTarget: "de {target} de gordura", chip: "gordura {n}g" },
      satFat: { name: "gord. saturada", left: "Gord. saturada restante", over: "Gord. saturada acima", ofTarget: "de {target} de gord. saturada", chip: "gord. saturada {n}g" },
      sodium: { name: "Sódio", left: "Sódio restante", over: "Sódio acima", ofTarget: "de {target} de sódio", chip: "sódio {n}mg" },
      fibre: { name: "Fibras", chip: "fibras {n}g" },
      sugar: { name: "Açúcar", chip: "açúcar {n}g" },
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
    queue: { uploading: "Enviando foto · 1 de 4", waiting: "Aguardando envio", notMeal: "Isso não parece uma refeição", unread: "Não deu para ler esta foto", nothingCounted: "Nada foi contado.", retake: "Tirar outra", remove: "Remover", question: "Contado como ≈{kcal}. Um detalhe deixaria mais preciso.", answer: "Responder 1 pergunta", dropTitle: "Solte uma foto em qualquer lugar para registrar", dropSub: "ou cole uma na caixa de texto", addedTitle: "Adicionado ao seu dia", addedSub: "A gente faz a conta. Pode fechar o app.", beingRead: "{time} · em análise, pode fechar o app", found: "Alimentos encontrados: {n}" },
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
