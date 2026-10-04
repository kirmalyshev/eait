// Every fixed sentence the browser client writes for itself, in every language the product speaks.
//
// Gated by `server/copy.test.ts` against `lintCopy` — the same arrangement as `PAGE_COPY` in
// `backend/web/copy.ts`, and with the same limit: the gate reads English patterns, so it proves
// nothing about the seven translations. What protects those is that they are translations OF copy
// that passed it.
//
// Sentences with a NUMBER in them are assembled in `main.ts` around these, so the numbers can come
// from the server and the words from here. Every template that takes one declares its placeholder.
//
// IMPORTED BY RELATIVE PATH, like `advancePending` and `dayBudget` (#608): `@eait/shared` needs
// `node_modules/@eait/shared`, which exists only after `bun install`, and `deploy/Dockerfile.web`
// builds this bundle with neither. `@eait/shared` stays TYPES ONLY in this workspace.

import { logCopyFor } from "../shared/app/log-copy.ts";
import { MAX_USER_LINE } from "../shared/contract.ts";
import { t, wholeNumbers, type CountForms, type Localized } from "../shared/lang.ts";
import type { Lang } from "../shared/types.ts";

export interface WebCopy {
  /* The four tabs' names moved to `src/shared/app/shell-copy.ts` (#87): one table both clients
     draw from. `navAdmin` stays — the admin link is this client's alone. */
  navAdmin: string;
  signOut: string;
  signedOutLead: string;
  signIn: string;
  today: string;
  /** The day switcher's second relative label — the day before `today` (#71). */
  yesterday: string;
  /** The switcher chevrons' accessible names — the buttons themselves carry only a glyph. */
  dayPrev: string;
  dayNext: string;
  /** Home's week arrows. */
  weekPrev: string;
  weekNext: string;
  /**
   * The word after the headline figure — `dayBudget`'s state, in words.
   *
   * Three and not four: `unlogged` takes `targetLine` instead, because nothing logged is not
   * nothing eaten and "2,000 under" would say it was.
   */
  budgetLeft: string;
  budgetOver: string;
  budgetUnder: string;
  /** `{target}` and `{protein}` — a day with nothing logged yet. */
  targetLine: string;
  /**
   * `{eaten}` and `{target}` — the kcal context under the headline.
   *
   * Protein lives in the macro counters beside it since #71, whose eaten/target figures carry a
   * tone a sentence cannot: this line is kcal only.
   */
  eatenLine: string;
  floor: string;
  /**
   * The word before a figure nobody has measured, and the one place amber is spent.
   *
   * It is a WORD rather than a symbol on purpose: the register forbids a number beside its own
   * error, so precision is what carries the confidence and this is what says the precision is low.
   */
  about: string;
  /** `{floor}` — the floor as a status line, never a scale. Two states and nothing between them. */
  floorClear: string;
  floorHeld: string;
  /** The meals table on a window wide enough to hold one. */
  colTime: string;
  colMeal: string;
  colKcal: string;
  connectHealth: string;
  /** `{kg}` — and `weighedOn` is appended when the measurement has a date. */
  weightLine: string;
  /** `{kg}` and `{when}`, where `{when}` is `Intl.RelativeTimeFormat`'s own words. */
  weightLineWhen: string;
  nothingToday: string;
  meal: string;
  noMessages: string;
  sentReload: string;
  proposalLead: string;
  logIt: string;
  notThis: string;
  dropped: string;
  logRetry: string;
  sent: string;
  alreadyLogged: string;
  composerPlaceholder: string;
  /** Today's composer — the same row, worded for the drop (#52). */
  diaryPlaceholder: string;
  send: string;
  /** The labelled button the native file input hides behind. */
  addPhoto: string;
  photosOfOneMeal: string;
  sendPhoto: string;
  cancel: string;
  choosePhotoFirst: string;
  photoTooLarge: string;
  mealGone: string;
  loading: string;
  somethingWrong: string;
  connectTelegram: string;
  telegramFailed: string;
  /** Keyed the way `refusalFrom` names a body, plus this client's own transport states. */
  refusals: Record<string, string>;
  /** The picker in Settings. Its options are `LANG_LABEL` — endonyms, never translated. */
  language: string;
  settings: string;
  /** The outbox (#708): the way out beside resend for a held turn the boards give both to. */
  discard: string;
  /** Said once under the composer when a turn is kept. No cause — offline and an edge are both this. */
  kept: string;
  /** The same, when what is ahead of it waits on a DECISION rather than on a connection. */
  keptBehind: string;
  /** A turn that could not even be saved: nothing went anywhere. */
  notSaved: string;

  // ── The first-meal flow (#42): one analysis on the house, its verdict, the offer after. ─────
  // Spud's lines on the flow — the react/ask/tell/keepGoing/correct/afterAsk — are NOT here:
  // `chatCopyFor(lang).firstMeal` (`shared/onboarding-chat-copy.ts`) is the one table both clients
  // read. What stays is what that table does not carry: the web's upload wording (`photo` there is
  // the phone's camera), the drop zone, the edit fields, the offer's prices and timeline.
  /** The web's photo button — `firstMeal.photo` is the phone's "Take a photo". */
  firstMealUpload: string;
  firstPhotoAsk: string;
  dropPhotoHere: string;
  dropPhotoKinds: string;
  analyseMeal: string;
  firstTypeAsk: string;
  /** The label over the typed meal's one field. */
  yourMeal: string;
  firstVerdictBeat: string;
  correctBeat: string;
  correctAsk: string;
  /** "What it was" — the edit's one text field, which renames the first item. */
  correctWhat: string;
  correctPortion: string;
  portionSmall: string;
  portionRegular: string;
  portionLarge: string;
  saveRecheck: string;
  /** The offer's title — the ask that holds once the free meal is spent. */
  offerAsk: string;
  offerPerkVerdict: string;
  offerPerkPlan: string;
  offerPerkSpud: string;
  offerToday: string;
  offerBeforeEnd: string;
  offerDay8: string;
  offerTodayText: string;
  offerBeforeText: string;
  /** No `{price}`: the API sends this client no price, and inventing one is the defect. */
  offerDay8Text: string;
  /** The radiogroup's name on the offer — one plan today, read by a screen reader (#52). */
  offerPlans: string;
  offerPlanMonthly: string;
  /** Where the price lives — this client shows none; checkout owns it. */
  offerCheckoutHint: string;
  startFreeWeek: string;
  offerLater: string;
  /** `{n}` — the photo bound off `ProfileResponse.limits`. */
  photosMax: string;
  /** The picker's chosen count under the composer — plural by rule, not a "(s)". */
  photosCount: CountForms;
  /** `{text}` — a queued photo's caption. */
  photoWithCaption: string;
  /** The three macros the verdict card reports, under the big kcal. */
  statProtein: string;
  statCarbs: string;
  statFat: string;
}

const EN: WebCopy = {
  navAdmin: "Admin",
  signOut: "Sign out",
  signedOutLead: "Photograph a meal, get the numbers. Sign in to pick up your diary.",
  signIn: "Sign in",
  today: "Today",
  yesterday: "Yesterday", dayPrev: "Previous day", dayNext: "Next day",
  weekPrev: "Previous week", weekNext: "Next week",
  budgetLeft: "left", budgetOver: "over", budgetUnder: "under",
  targetLine: "Target {target} · {protein}g protein",
  eatenLine: "{eaten} of {target} eaten",
  floor: "Your target sits at the minimum this app will ever suggest.",
  about: "about",
  floorClear: "Safe minimum {floor}kcal · you're above it",
  floorHeld: "Held at the safe minimum, {floor}kcal",
  colTime: "Time", colMeal: "Meal", colKcal: "kcal",
  connectHealth: "Connect Apple Health in the eait iPhone app and your weight keeps this target current.",
  weightLine: "Weight {kg}kg.",
  weightLineWhen: "Weight {kg}kg, updated {when}.",
  nothingToday: "Nothing logged yet today.",
  meal: "Meal",
  noMessages: "No messages yet.",
  sentReload: "Sent. Reload to see the conversation.",
  proposalLead: "Logging this — look right?",
  logIt: "Log it",
  notThis: "Not this",
  dropped: "Dropped it.",
  logRetry: "No answer came back. Press Log it again: it cannot log the meal twice.",
  sent: "Sent",
  alreadyLogged: "That one was already logged.",
  composerPlaceholder: "Tell Spud what you ate, or ask anything",
  diaryPlaceholder: "Tell Spud what you ate, or drop a photo",
  send: "Send",
  addPhoto: "Add a photo",
  photosOfOneMeal: "Photos of one meal",
  sendPhoto: "Send the photo",
  cancel: "Cancel",
  choosePhotoFirst: "Choose a photo first.",
  photoTooLarge: "That photo is too large to send.",
  mealGone: "A meal that is no longer logged",
  loading: "Loading…",
  somethingWrong: "Something went wrong. Try again.",
  connectTelegram: "Connect Telegram",
  telegramFailed: "No Telegram link this time. Try again.",
  language: "Language",
  settings: "Settings",
  discard: "Discard",
  kept: "Saved on this device. It goes on its own as soon as it can.",
  keptBehind: "Saved on this device. It goes once the message above that is waiting for you has been sent again or discarded.",
  notSaved: "That could not be saved on this device, and it was not sent. Try again.",
  firstMealUpload: "Upload a photo",
  firstPhotoAsk: "Drop in a photo of anything on your plate",
  dropPhotoHere: "Drop a photo here",
  dropPhotoKinds: "or choose a file · JPEG, PNG or WebP",
  analyseMeal: "Analyse my meal",
  firstTypeAsk: "What did you eat?",
  yourMeal: "Your meal",
  firstVerdictBeat: "Your first macros",
  correctBeat: "Good catch. I'll redo the numbers.",
  correctAsk: "What did I get wrong?",
  correctWhat: "What it was",
  correctPortion: "Portion",
  portionSmall: "Small", portionRegular: "Regular", portionLarge: "Large",
  saveRecheck: "Save and recheck",
  offerAsk: "Every meal, like that one",
  offerPerkVerdict: "Honest macros on every meal",
  offerPerkPlan: "Your plan moves when your weight does",
  offerPerkSpud: "Spud, any time you ask",
  offerToday: "Today", offerBeforeEnd: "Before it ends", offerDay8: "Day 8",
  offerTodayText: "Free for 7 days",
  offerBeforeText: "We remind you",
  offerDay8Text: "Then it's monthly · cancel any time",
  offerPlans: "Your plan",
  offerPlanMonthly: "Monthly · 7 days free",
  offerCheckoutHint: "Checkout opens on a secure page, with the price in your currency. Nothing is charged for 7 days.",
  startFreeWeek: "Start my free week",
  offerLater: "Not now",
  photosMax: "One meal takes up to {n} photos.",
  photosCount: { one: "{n} photo", few: "{n} photos", many: "{n} photos", other: "{n} photos" },
  photoWithCaption: "Photo: {text}",
  statProtein: "Protein", statCarbs: "Carbs", statFat: "Fat",
  refusals: {
    "subscription-required": "This account's free sample is used up. Start your free week to carry on.",
    "unsupported-image": "That file is not a photo this can read. JPEG, PNG or WebP.",
    "not-food": "No food in that one.",
    "analysis-failed": "That did not come back. Try it again.",
    "identity-required": "Sign in with Apple or Google to keep going — a photo can't be read without one.",
    expired: "That one is no longer being held. Say it again.",
    "target-gone": "There is no meal open here to change. Open it in the app, or say what you ate and log it again.",
    "too many photos": "That is more angles than one meal can have.",
    "too large": "That photo is too large to send.",
    "text too long": "That message is too long to send.",
    "maybe-landed": "No answer came back, and it may still have gone through. Reload to check before sending it again.",
    unclear: "That did not finish cleanly, and it may still have been logged. Reload to check before sending it again.",
  },
};

const FR: WebCopy = {
  navAdmin: "Admin", signOut: "Se déconnecter",
  signedOutLead: "Photographie un repas, reçois les chiffres. Connecte-toi pour retrouver ton journal.",
  signIn: "Se connecter", today: "Aujourd'hui",
  yesterday: "Hier", dayPrev: "Jour précédent", dayNext: "Jour suivant",
  weekPrev: "Semaine précédente", weekNext: "Semaine suivante",
  budgetLeft: "restantes", budgetOver: "au-dessus", budgetUnder: "en dessous",
  targetLine: "Objectif {target} · {protein}g de protéines",
  eatenLine: "{eaten} consommées sur {target}",
  floor: "Ton objectif est fixé au minimum que cette app propose.",
  about: "environ",
  floorClear: "Minimum sûr {floor}kcal · tu es au-dessus",
  floorHeld: "Maintenu au minimum sûr, {floor}kcal",
  colTime: "Heure", colMeal: "Repas", colKcal: "kcal",
  connectHealth: "Connecte Santé dans l’app eait sur iPhone : ton poids gardera cet objectif à jour.",
  weightLine: "Poids {kg}kg.",
  weightLineWhen: "Poids {kg}kg, mis à jour {when}.",
  nothingToday: "Rien d'enregistré aujourd'hui.",
  meal: "Repas",
  noMessages: "Aucun message pour l'instant.",
  sentReload: "Envoyé. Recharge pour voir la conversation.",
  proposalLead: "J'enregistre ça — ça te va ?", logIt: "Enregistrer", notThis: "Pas ça",
  dropped: "Annulé.",
  logRetry: "Aucune réponse. Appuie de nouveau sur Enregistrer : le repas ne peut pas être enregistré deux fois.",
  sent: "Envoyé", alreadyLogged: "Celui-là était déjà enregistré.",
  composerPlaceholder: "Dis à Spud ce que tu as mangé, ou demande-lui ce que tu veux",
  diaryPlaceholder: "Dis à Spud ce que tu as mangé, ou dépose une photo", send: "Envoyer",
  addPhoto: "Ajouter une photo",
  photosOfOneMeal: "Photos d'un seul repas",
  sendPhoto: "Envoyer la photo", cancel: "Annuler",
  choosePhotoFirst: "Choisis d'abord une photo.",
  photoTooLarge: "Cette photo est trop lourde à envoyer.",
  mealGone: "Un repas qui n'est plus enregistré",
  loading: "Chargement…", somethingWrong: "Un problème est survenu. Réessaie.",
  connectTelegram: "Connecter Telegram", telegramFailed: "Pas de lien Telegram cette fois. Réessaie.",
  language: "Langue", settings: "Réglages",
  discard: "Abandonner",
  kept: "Enregistré sur cet appareil. Ça partira tout seul dès que possible.",
  keptBehind: "Enregistré sur cet appareil. Ça partira une fois que le message au-dessus, qui t'attend, aura été renvoyé ou abandonné.",
  notSaved: "Ça n'a pas pu être enregistré sur cet appareil, et ça n'a pas été envoyé. Réessaie.",
  firstMealUpload: "Envoyer une photo",
  firstPhotoAsk: "Dépose une photo de ce qu’il y a dans ton assiette",
  dropPhotoHere: "Dépose une photo ici",
  dropPhotoKinds: "ou choisis un fichier · JPEG, PNG ou WebP",
  analyseMeal: "Analyse mon repas",
  firstTypeAsk: "Tu as mangé quoi ?",
  yourMeal: "Ton repas",
  firstVerdictBeat: "Tes premières macros",
  correctBeat: "Bien vu. Je refais les chiffres.",
  correctAsk: "Qu'est-ce que j'ai raté ?",
  correctWhat: "Ce que c'était",
  correctPortion: "Portion",
  portionSmall: "Petite", portionRegular: "Normale", portionLarge: "Grande",
  saveRecheck: "Enregistrer et recalculer",
  offerAsk: "Chaque repas, comme celui-là",
  offerPerkVerdict: "Des macros honnêtes pour chaque repas",
  offerPerkPlan: "Ton plan bouge quand ton poids bouge",
  offerPerkSpud: "Spud, quand tu veux",
  offerToday: "Aujourd'hui", offerBeforeEnd: "Avant la fin", offerDay8: "Jour 8",
  offerTodayText: "7 jours offerts",
  offerBeforeText: "On te le rappelle",
  offerDay8Text: "Ensuite au mois · résiliable à tout moment",
  offerPlans: "Ta formule",
  offerPlanMonthly: "Mensuel · 7 jours offerts",
  offerCheckoutHint: "Le paiement s'ouvre sur une page sécurisée, avec le prix dans ta devise. Rien n'est débité pendant 7 jours.",
  startFreeWeek: "Commencer ma semaine offerte",
  offerLater: "Pas maintenant",
  photosMax: "Un repas prend jusqu'à {n} photos.",
  photosCount: { one: "{n} photo", few: "{n} photos", many: "{n} photos", other: "{n} photos" },
  photoWithCaption: "Photo : {text}",
  statProtein: "Protéines", statCarbs: "Glucides", statFat: "Lipides",
  refusals: {
    "subscription-required": "Ce compte a déjà utilisé son analyse offerte. Lance ta semaine offerte pour continuer.",
    "unsupported-image": "Ce fichier n'est pas une photo lisible ici. JPEG, PNG ou WebP.",
    "not-food": "Aucun aliment sur celle-là.",
    "analysis-failed": "Pas de réponse. Réessaie.",
    "identity-required": "Connecte-toi avec Apple ou Google pour continuer — sans compte, rien n'est lu.",
    expired: "Cette proposition a expiré. Redis-moi ce que tu as mangé.",
    "target-gone": "Aucun repas n'est ouvert ici à modifier. Ouvre-le dans l'app, ou dis ce que tu as mangé et enregistre-le à nouveau.",
    "too many photos": "Ça fait plus d'angles qu'un repas ne peut en avoir.",
    "too large": "Cette photo est trop lourde à envoyer.",
    "text too long": "Ce message est trop long pour être envoyé.",
    "maybe-landed": "Aucune réponse, et c'est peut-être quand même passé. Recharge pour vérifier avant de renvoyer.",
    unclear: "Ça ne s'est pas terminé proprement, et ça a peut-être été enregistré. Recharge pour vérifier avant de renvoyer.",
  },
};

const DE: WebCopy = {
  navAdmin: "Admin", signOut: "Abmelden",
  signedOutLead: "Fotografier eine Mahlzeit, bekomm die Zahlen. Melde dich an, um dein Tagebuch weiterzuführen.",
  signIn: "Anmelden", today: "Heute",
  yesterday: "Gestern", dayPrev: "Vorheriger Tag", dayNext: "Nächster Tag",
  weekPrev: "Vorherige Woche", weekNext: "Nächste Woche",
  budgetLeft: "übrig", budgetOver: "drüber", budgetUnder: "drunter",
  targetLine: "Ziel {target} · {protein}g Protein",
  eatenLine: "{eaten} von {target} gegessen",
  floor: "Dein Ziel liegt beim niedrigsten Wert, den diese App überhaupt vorschlägt.",
  about: "etwa",
  floorClear: "Sicheres Minimum {floor}kcal · du liegst darüber",
  floorHeld: "Beim sicheren Minimum gehalten: {floor}kcal",
  colTime: "Zeit", colMeal: "Mahlzeit", colKcal: "kcal",
  connectHealth: "Verbinde Apple Health in der eait-App auf dem iPhone, dann bleibt dieses Ziel mit deinem Gewicht aktuell.",
  weightLine: "Gewicht {kg}kg.",
  weightLineWhen: "Gewicht {kg}kg, aktualisiert {when}.",
  nothingToday: "Heute noch nichts eingetragen.",
  meal: "Mahlzeit",
  noMessages: "Noch keine Nachrichten.",
  sentReload: "Gesendet. Lad neu, um das Gespräch zu sehen.",
  proposalLead: "Ich trage das ein — passt das?", logIt: "Eintragen", notThis: "Nicht das",
  dropped: "Verworfen.",
  logRetry: "Es kam keine Antwort. Drück noch einmal auf Eintragen: die Mahlzeit kann dabei nicht doppelt eingetragen werden.",
  sent: "Gesendet", alreadyLogged: "Das war schon eingetragen.",
  composerPlaceholder: "Sag Spud, was du gegessen hast, oder frag, was du willst",
  diaryPlaceholder: "Sag Spud, was du gegessen hast, oder leg ein Foto hier ab", send: "Senden",
  addPhoto: "Foto hinzufügen",
  photosOfOneMeal: "Fotos einer Mahlzeit",
  sendPhoto: "Foto senden", cancel: "Abbrechen",
  choosePhotoFirst: "Wähl zuerst ein Foto.",
  photoTooLarge: "Dieses Foto ist zu groß zum Senden.",
  mealGone: "Eine Mahlzeit, die nicht mehr eingetragen ist",
  loading: "Lädt…", somethingWrong: "Etwas ist schiefgegangen. Versuch es noch einmal.",
  connectTelegram: "Telegram verbinden", telegramFailed: "Diesmal kein Telegram-Link. Versuch es noch einmal.",
  language: "Sprache", settings: "Einstellungen",
  discard: "Verwerfen",
  kept: "Auf diesem Gerät gespeichert. Wird automatisch gesendet, sobald es möglich ist.",
  keptBehind: "Auf diesem Gerät gespeichert. Es geht raus, sobald die Nachricht darüber, die auf dich wartet, erneut gesendet oder verworfen wurde.",
  notSaved: "Das ließ sich auf diesem Gerät nicht speichern und wurde nicht gesendet. Versuch es noch einmal.",
  firstMealUpload: "Foto hochladen",
  firstPhotoAsk: "Lade ein Foto von deinem Teller hoch – egal, was drauf ist",
  dropPhotoHere: "Foto hier ablegen",
  dropPhotoKinds: "oder Datei wählen · JPEG, PNG oder WebP",
  analyseMeal: "Mahlzeit analysieren",
  firstTypeAsk: "Was hast du gegessen?",
  yourMeal: "Deine Mahlzeit",
  firstVerdictBeat: "Deine ersten Makros",
  correctBeat: "Gut aufgepasst. Ich rechne neu.",
  correctAsk: "Was habe ich falsch erkannt?",
  correctWhat: "Was es war",
  correctPortion: "Portion",
  portionSmall: "Klein", portionRegular: "Normal", portionLarge: "Groß",
  saveRecheck: "Speichern und neu prüfen",
  offerAsk: "Jede Mahlzeit so wie diese",
  offerPerkVerdict: "Ehrliche Makros zu jeder Mahlzeit",
  offerPerkPlan: "Dein Plan passt sich an, wenn sich dein Gewicht ändert",
  offerPerkSpud: "Spud, wann immer du fragst",
  offerToday: "Heute", offerBeforeEnd: "Vor Ablauf", offerDay8: "Tag 8",
  offerTodayText: "7 Tage kostenlos",
  offerBeforeText: "Wir erinnern dich",
  offerDay8Text: "Danach monatlich · jederzeit kündbar",
  offerPlans: "Dein Abo",
  offerPlanMonthly: "Monatlich · 7 Tage kostenlos",
  offerCheckoutHint: "Die Bezahlung läuft über eine sichere Seite, mit dem Preis in deiner Währung. 7 Tage lang wird nichts abgebucht.",
  startFreeWeek: "Meine Gratiswoche starten",
  offerLater: "Jetzt nicht",
  photosMax: "Pro Mahlzeit gehen bis zu {n} Fotos.",
  photosCount: { one: "{n} Foto", few: "{n} Fotos", many: "{n} Fotos", other: "{n} Fotos" },
  photoWithCaption: "Foto: {text}",
  statProtein: "Protein", statCarbs: "Kohlenhydrate", statFat: "Fett",
  refusals: {
    "subscription-required": "Die kostenlose Testmahlzeit dieses Kontos ist verbraucht. Starte deine Gratiswoche, um weiterzumachen.",
    "unsupported-image": "Dieses Dateiformat geht hier nicht. Nimm JPEG, PNG oder WebP.",
    "not-food": "Auf diesem Foto ist kein Essen.",
    "analysis-failed": "Da kam nichts zurück. Versuch es noch einmal.",
    "identity-required": "Melde dich mit Apple oder Google an, um weiterzumachen — ohne Anmeldung kann kein Foto erkannt werden.",
    expired: "Das ist abgelaufen. Sag es bitte noch einmal.",
    "target-gone": "Hier ist keine Mahlzeit offen, die sich ändern ließe. Öffne sie in der App, oder sag, was du gegessen hast, und trag es neu ein.",
    "too many photos": "Das sind mehr Blickwinkel, als eine Mahlzeit haben kann.",
    "too large": "Dieses Foto ist zu groß zum Senden.",
    "text too long": "Diese Nachricht ist zu lang zum Senden.",
    "maybe-landed": "Es kam keine Antwort, und es kann trotzdem durchgegangen sein. Lad neu und schau nach, bevor du es noch einmal schickst.",
    unclear: "Das hat nicht ganz geklappt, und es kann trotzdem eingetragen worden sein. Lad neu und schau nach, bevor du es noch einmal schickst.",
  },
};

const IT: WebCopy = {
  navAdmin: "Admin", signOut: "Esci",
  signedOutLead: "Fotografa un pasto, ricevi i numeri. Accedi per riprendere il tuo diario.",
  signIn: "Accedi", today: "Oggi",
  yesterday: "Ieri", dayPrev: "Giorno precedente", dayNext: "Giorno successivo",
  weekPrev: "Settimana precedente", weekNext: "Settimana successiva",
  budgetLeft: "rimaste", budgetOver: "in più", budgetUnder: "in meno",
  targetLine: "Obiettivo {target} · {protein}g di proteine",
  eatenLine: "{eaten} di {target} mangiate",
  floor: "Il tuo obiettivo è al minimo che questa app possa proporre.",
  about: "circa",
  floorClear: "Minimo sicuro {floor}kcal · sei al di sopra",
  floorHeld: "Bloccato al minimo sicuro: {floor}kcal",
  colTime: "Ora", colMeal: "Pasto", colKcal: "kcal",
  connectHealth: "Collega Apple Health nell'app eait per iPhone e questo obiettivo si aggiornerà con il tuo peso.",
  weightLine: "Peso {kg}kg.",
  weightLineWhen: "Peso {kg}kg, aggiornato {when}.",
  nothingToday: "Oggi non è ancora stato registrato niente.",
  meal: "Pasto",
  noMessages: "Ancora nessun messaggio.",
  sentReload: "Inviato. Ricarica per vedere la conversazione.",
  proposalLead: "Registro questo — ti torna?", logIt: "Registra", notThis: "Non questo",
  dropped: "Scartato.",
  logRetry: "Non è arrivata risposta. Premi di nuovo Registra: il pasto non può essere registrato due volte.",
  sent: "Inviato", alreadyLogged: "Quello era già registrato.",
  composerPlaceholder: "Di’ a Spud cosa hai mangiato, o chiedigli quello che vuoi",
  diaryPlaceholder: "Di’ a Spud cosa hai mangiato, o trascina una foto", send: "Invia",
  addPhoto: "Aggiungi una foto",
  photosOfOneMeal: "Foto di un solo pasto",
  sendPhoto: "Invia la foto", cancel: "Annulla",
  choosePhotoFirst: "Scegli prima una foto.",
  photoTooLarge: "Quella foto è troppo grande da inviare.",
  mealGone: "Un pasto che non è più registrato",
  loading: "Caricamento…", somethingWrong: "Qualcosa è andato storto. Riprova.",
  connectTelegram: "Collega Telegram", telegramFailed: "Niente link Telegram stavolta. Riprova.",
  language: "Lingua", settings: "Impostazioni",
  discard: "Scarta",
  kept: "Salvato su questo dispositivo. Partirà da solo appena possibile.",
  keptBehind: "Salvato su questo dispositivo. Partirà quando il messaggio qui sopra, che ti aspetta, sarà stato inviato di nuovo o scartato.",
  notSaved: "Non è stato possibile salvarlo su questo dispositivo, e non è stato inviato. Riprova.",
  firstMealUpload: "Carica una foto",
  firstPhotoAsk: "Trascina una foto di quello che hai nel piatto",
  dropPhotoHere: "Trascina qui una foto",
  dropPhotoKinds: "o scegli un file · JPEG, PNG o WebP",
  analyseMeal: "Analizza il mio pasto",
  firstTypeAsk: "Cosa hai mangiato?",
  yourMeal: "Il tuo pasto",
  firstVerdictBeat: "I tuoi primi macro",
  correctBeat: "Ben visto. Rifaccio i conti.",
  correctAsk: "Cosa ho capito male?",
  correctWhat: "Cos’era",
  correctPortion: "Porzione",
  portionSmall: "Piccola", portionRegular: "Normale", portionLarge: "Grande",
  saveRecheck: "Salva e ricontrolla",
  offerAsk: "Ogni pasto, come quello",
  offerPerkVerdict: "Macro onesti per ogni pasto",
  offerPerkPlan: "Il tuo piano cambia quando cambia il tuo peso",
  offerPerkSpud: "Spud, ogni volta che vuoi",
  offerToday: "Oggi", offerBeforeEnd: "Prima che finisca", offerDay8: "Giorno 8",
  offerTodayText: "Gratis per 7 giorni",
  offerBeforeText: "Ti avvisiamo noi",
  offerDay8Text: "Poi è mensile · disdici quando vuoi",
  offerPlans: "Il tuo abbonamento",
  offerPlanMonthly: "Mensile · 7 giorni gratis",
  offerCheckoutHint: "Il pagamento si apre su una pagina sicura, col prezzo nella tua valuta. Non viene addebitato niente per 7 giorni.",
  startFreeWeek: "Inizia la mia settimana gratis",
  offerLater: "Non ora",
  photosMax: "Un pasto accetta fino a {n} foto.",
  photosCount: { one: "{n} foto", few: "{n} foto", many: "{n} foto", other: "{n} foto" },
  photoWithCaption: "Foto: {text}",
  statProtein: "Proteine", statCarbs: "Carboidrati", statFat: "Grassi",
  refusals: {
    "subscription-required": "Hai già usato l'analisi gratuita di questo account. Inizia la tua settimana gratis per continuare.",
    "unsupported-image": "Quel file non è una foto leggibile qui. JPEG, PNG o WebP.",
    "not-food": "Non vedo cibo in questa foto.",
    "analysis-failed": "Nessuna risposta. Riprova.",
    "identity-required": "Accedi con Apple o Google per continuare — senza account non si legge nulla.",
    expired: "Questa proposta è scaduta. Ridimmelo.",
    "target-gone": "Qui non c'è nessun pasto aperto da cambiare. Aprilo nell'app, oppure di' cosa hai mangiato e registralo di nuovo.",
    "too many photos": "Troppe angolazioni per un solo pasto.",
    "too large": "Quella foto è troppo grande da inviare.",
    "text too long": "Questo messaggio è troppo lungo da inviare.",
    "maybe-landed": "Non è arrivata risposta, e potrebbe comunque essere passato. Ricarica e controlla prima di rimandarlo.",
    unclear: "Qualcosa non è andato a buon fine, ma il pasto potrebbe essere stato registrato comunque. Ricarica e controlla prima di rimandarlo.",
  },
};

const ES: WebCopy = {
  navAdmin: "Admin", signOut: "Cerrar sesión",
  signedOutLead: "Fotografía una comida, recibe los números. Entra para seguir con tu diario.",
  signIn: "Entrar", today: "Hoy",
  yesterday: "Ayer", dayPrev: "Día anterior", dayNext: "Día siguiente",
  weekPrev: "Semana anterior", weekNext: "Semana siguiente",
  budgetLeft: "restantes", budgetOver: "por encima", budgetUnder: "por debajo",
  targetLine: "Objetivo {target} · {protein}g de proteína",
  eatenLine: "{eaten} de {target} consumidas",
  floor: "Tu objetivo está en el mínimo que esta app puede proponer.",
  about: "unas",
  floorClear: "Mínimo seguro {floor}kcal · estás por encima",
  floorHeld: "Detenido en el mínimo seguro, {floor}kcal",
  colTime: "Hora", colMeal: "Comida", colKcal: "kcal",
  connectHealth: "Conecta Apple Health en la app eait para iPhone y tu peso mantiene este objetivo al día.",
  weightLine: "Peso {kg}kg.",
  weightLineWhen: "Peso {kg}kg, actualizado {when}.",
  nothingToday: "Hoy todavía no hay nada registrado.",
  meal: "Comida",
  noMessages: "Todavía no hay mensajes.",
  sentReload: "Enviado. Recarga para ver la conversación.",
  proposalLead: "Voy a registrar esto — ¿te cuadra?", logIt: "Registrar", notThis: "Esto no",
  dropped: "Descartado.",
  logRetry: "No llegó respuesta. Pulsa Registrar otra vez: no puede registrar la comida dos veces.",
  sent: "Enviado", alreadyLogged: "Esa ya estaba registrada.",
  composerPlaceholder: "Dile a Spud qué has comido, o pregúntale lo que quieras",
  diaryPlaceholder: "Dile a Spud qué has comido, o suelta una foto", send: "Enviar",
  addPhoto: "Añadir una foto",
  photosOfOneMeal: "Fotos de una sola comida",
  sendPhoto: "Enviar la foto", cancel: "Cancelar",
  choosePhotoFirst: "Elige primero una foto.",
  photoTooLarge: "Esa foto es demasiado grande para enviarla.",
  mealGone: "Una comida que ya no está registrada",
  loading: "Cargando…", somethingWrong: "Algo salió mal. Inténtalo otra vez.",
  connectTelegram: "Conectar Telegram", telegramFailed: "Sin enlace de Telegram esta vez. Inténtalo otra vez.",
  language: "Idioma", settings: "Ajustes",
  discard: "Descartar",
  kept: "Guardado en este dispositivo. Saldrá solo en cuanto pueda.",
  keptBehind: "Guardado en este dispositivo. Saldrá cuando el mensaje de arriba, que te está esperando, se haya enviado otra vez o descartado.",
  notSaved: "No se ha podido guardar en este dispositivo, y no se ha enviado. Inténtalo otra vez.",
  firstMealUpload: "Subir una foto",
  firstPhotoAsk: "Suelta una foto de lo que tengas en el plato",
  dropPhotoHere: "Suelta una foto aquí",
  dropPhotoKinds: "o elige un archivo · JPEG, PNG o WebP",
  analyseMeal: "Analiza mi comida",
  firstTypeAsk: "¿Qué has comido?",
  yourMeal: "Tu comida",
  firstVerdictBeat: "Tus primeros macros",
  correctBeat: "Bien visto. Rehago los números.",
  correctAsk: "¿En qué me equivoqué?",
  correctWhat: "Qué era",
  correctPortion: "Ración",
  portionSmall: "Pequeña", portionRegular: "Normal", portionLarge: "Grande",
  saveRecheck: "Guardar y revisar",
  offerAsk: "Cada comida, como esa",
  offerPerkVerdict: "Macros honestos en cada comida",
  offerPerkPlan: "Tu plan se mueve cuando tu peso se mueve",
  offerPerkSpud: "Spud, cuando lo pidas",
  offerToday: "Hoy", offerBeforeEnd: "Antes de que termine", offerDay8: "Día 8",
  offerTodayText: "Gratis 7 días",
  offerBeforeText: "Te lo recordamos",
  offerDay8Text: "Luego es mensual · cancela cuando quieras",
  offerPlans: "Tu plan",
  offerPlanMonthly: "Mensual · 7 días gratis",
  offerCheckoutHint: "El pago se abre en una página segura, con el precio en tu moneda. No se cobra nada durante 7 días.",
  startFreeWeek: "Empezar mi semana gratis",
  offerLater: "Ahora no",
  photosMax: "Una comida admite hasta {n} fotos.",
  photosCount: { one: "{n} foto", few: "{n} fotos", many: "{n} fotos", other: "{n} fotos" },
  photoWithCaption: "Foto: {text}",
  statProtein: "Proteína", statCarbs: "Carbohidratos", statFat: "Grasas",
  refusals: {
    "subscription-required": "Ya has usado el análisis gratis de esta cuenta. Empieza tu semana gratis para seguir.",
    "unsupported-image": "Ese archivo no es una foto que se pueda leer aquí. JPEG, PNG o WebP.",
    "not-food": "No hay comida en esta.",
    "analysis-failed": "No volvió nada. Inténtalo otra vez.",
    "identity-required": "Inicia sesión con Apple o Google para continuar — sin cuenta no se lee nada.",
    expired: "Ese ya no está en espera. Vuelve a decírmelo.",
    "target-gone": "Aquí no hay ninguna comida abierta que cambiar. Ábrela en la app, o di qué has comido y regístrala otra vez.",
    "too many photos": "Son más ángulos de los que puede tener una comida.",
    "too large": "Esa foto es demasiado grande para enviarla.",
    "text too long": "Ese mensaje es demasiado largo para enviarlo.",
    "maybe-landed": "No llegó respuesta, y aun así puede haber pasado. Recarga y comprueba antes de volver a enviarlo.",
    unclear: "No terminó limpiamente, y aun así puede haberse registrado. Recarga y comprueba antes de volver a enviarlo.",
  },
};

const VI: WebCopy = {
  navAdmin: "Quản trị", signOut: "Đăng xuất",
  signedOutLead: "Chụp một bữa ăn, nhận các con số. Đăng nhập để tiếp tục nhật ký của bạn.",
  signIn: "Đăng nhập", today: "Hôm nay",
  yesterday: "Hôm qua", dayPrev: "Ngày trước", dayNext: "Ngày sau",
  weekPrev: "Tuần trước", weekNext: "Tuần sau",
  budgetLeft: "còn lại", budgetOver: "vượt", budgetUnder: "thiếu",
  targetLine: "Mục tiêu {target} · {protein}g đạm",
  eatenLine: "Đã ăn {eaten} trên {target}",
  floor: "Mục tiêu của bạn đang ở mức thấp nhất mà ứng dụng này sẽ đề xuất.",
  about: "khoảng",
  floorClear: "Mức tối thiểu an toàn {floor}kcal · bạn đang trên mức đó",
  floorHeld: "Giữ ở mức tối thiểu an toàn, {floor}kcal",
  colTime: "Giờ", colMeal: "Bữa ăn", colKcal: "kcal",
  connectHealth: "Kết nối Apple Health trong ứng dụng eait trên iPhone để mục tiêu này luôn cập nhật theo cân nặng của bạn.",
  weightLine: "Cân nặng {kg}kg.",
  weightLineWhen: "Cân nặng {kg}kg, cập nhật {when}.",
  nothingToday: "Hôm nay chưa ghi gì cả.",
  meal: "Bữa ăn",
  noMessages: "Chưa có tin nhắn nào.",
  sentReload: "Đã gửi. Tải lại để xem cuộc trò chuyện.",
  proposalLead: "Mình ghi cái này nhé — có đúng không?", logIt: "Ghi lại", notThis: "Không phải",
  dropped: "Bỏ qua rồi.",
  logRetry: "Không có phản hồi. Bấm Ghi lại lần nữa: bữa ăn không thể bị ghi hai lần.",
  sent: "Đã gửi", alreadyLogged: "Cái đó đã được ghi rồi.",
  composerPlaceholder: "Kể cho Spud bạn đã ăn gì, hoặc hỏi bất cứ điều gì",
  diaryPlaceholder: "Kể cho Spud bạn đã ăn gì, hoặc thả một bức ảnh vào", send: "Gửi",
  addPhoto: "Thêm ảnh",
  photosOfOneMeal: "Ảnh của cùng một bữa",
  sendPhoto: "Gửi ảnh", cancel: "Hủy",
  choosePhotoFirst: "Chọn một tấm ảnh trước đã.",
  photoTooLarge: "Ảnh đó lớn quá, không gửi được.",
  mealGone: "Một bữa ăn không còn được ghi nữa",
  loading: "Đang tải…", somethingWrong: "Có gì đó trục trặc. Thử lại nhé.",
  connectTelegram: "Kết nối Telegram", telegramFailed: "Lần này chưa có liên kết Telegram. Thử lại nhé.",
  language: "Ngôn ngữ", settings: "Cài đặt",
  discard: "Bỏ đi",
  kept: "Đã lưu trên máy này. Nó sẽ tự gửi ngay khi có thể.",
  keptBehind: "Đã lưu trên máy này. Nó sẽ gửi sau khi tin nhắn phía trên — cái đang chờ bạn quyết định — được gửi lại hoặc bỏ đi.",
  notSaved: "Không lưu được trên máy này, và cũng chưa gửi đi. Thử lại nhé.",
  firstMealUpload: "Tải ảnh lên",
  firstPhotoAsk: "Thả vào đây một tấm ảnh bất cứ món gì trên đĩa của bạn",
  dropPhotoHere: "Thả ảnh vào đây",
  dropPhotoKinds: "hoặc chọn một tệp · JPEG, PNG hoặc WebP",
  analyseMeal: "Phân tích bữa của mình",
  firstTypeAsk: "Bạn đã ăn gì?",
  yourMeal: "Bữa của bạn",
  firstVerdictBeat: "Macro đầu tiên của bạn",
  correctBeat: "Bạn tinh mắt đấy. Mình tính lại các con số.",
  correctAsk: "Mình sai chỗ nào?",
  correctWhat: "Đó là món gì",
  correctPortion: "Khẩu phần",
  portionSmall: "Nhỏ", portionRegular: "Vừa", portionLarge: "Lớn",
  saveRecheck: "Lưu và kiểm tra lại",
  offerAsk: "Mọi bữa ăn, như bữa đó",
  offerPerkVerdict: "Macro rõ ràng cho mỗi bữa",
  offerPerkPlan: "Kế hoạch đổi khi cân nặng đổi",
  offerPerkSpud: "Spud, bất cứ lúc nào bạn hỏi",
  offerToday: "Hôm nay", offerBeforeEnd: "Trước khi hết", offerDay8: "Ngày 8",
  offerTodayText: "Miễn phí 7 ngày",
  offerBeforeText: "Chúng mình sẽ nhắc bạn",
  offerDay8Text: "Sau đó tính theo tháng · hủy bất cứ lúc nào",
  offerPlans: "Gói của bạn",
  offerPlanMonthly: "Theo tháng · 7 ngày miễn phí",
  offerCheckoutHint: "Thanh toán mở ra trên một trang bảo mật, với giá theo tiền tệ của bạn. Không trừ tiền trong 7 ngày.",
  startFreeWeek: "Bắt đầu tuần miễn phí",
  offerLater: "Để sau",
  photosMax: "Một bữa ăn nhận tối đa {n} ảnh.",
  photosCount: { one: "{n} bức ảnh", few: "{n} bức ảnh", many: "{n} bức ảnh", other: "{n} bức ảnh" },
  photoWithCaption: "Ảnh: {text}",
  statProtein: "Đạm", statCarbs: "Tinh bột", statFat: "Chất béo",
  refusals: {
    "subscription-required": "Lượt phân tích miễn phí của tài khoản này đã hết. Bắt đầu tuần miễn phí để tiếp tục.",
    "unsupported-image": "Tệp đó không phải ảnh đọc được ở đây. JPEG, PNG hoặc WebP.",
    "not-food": "Không có đồ ăn trong ảnh này.",
    "analysis-failed": "Chưa nhận được kết quả. Thử lại nhé.",
    "identity-required": "Đăng nhập bằng Apple hoặc Google để tiếp tục — không có tài khoản thì không đọc được gì.",
    expired: "Đề xuất đó đã hết hạn. Nói lại giúp mình nhé.",
    "target-gone": "Ở đây không có bữa nào đang mở để sửa. Mở nó trong ứng dụng, hoặc kể bạn đã ăn gì rồi ghi lại.",
    "too many photos": "Một bữa ăn không thể có nhiều góc chụp đến vậy.",
    "too large": "Ảnh đó lớn quá, không gửi được.",
    "text too long": "Tin nhắn này dài quá, không gửi được.",
    "maybe-landed": "Không có phản hồi, nhưng có thể tin nhắn vẫn đã được gửi. Tải lại để kiểm tra trước khi gửi lần nữa.",
    unclear: "Việc này chưa hoàn tất, và có thể bữa ăn vẫn đã được ghi. Tải lại để kiểm tra trước khi gửi lần nữa.",
  },
};

const ID: WebCopy = {
  navAdmin: "Admin", signOut: "Keluar",
  signedOutLead: "Foto makananmu, dapatkan angkanya. Masuk untuk melanjutkan buku harianmu.",
  signIn: "Masuk", today: "Hari ini",
  yesterday: "Kemarin", dayPrev: "Hari sebelumnya", dayNext: "Hari berikutnya",
  weekPrev: "Minggu sebelumnya", weekNext: "Minggu berikutnya",
  budgetLeft: "tersisa", budgetOver: "lebih", budgetUnder: "kurang",
  targetLine: "Target {target} · {protein}g protein",
  eatenLine: "{eaten} dari {target} dimakan",
  floor: "Targetmu berada di angka terendah yang bisa disarankan aplikasi ini.",
  about: "sekitar",
  floorClear: "Minimum aman {floor}kcal · kamu di atasnya",
  floorHeld: "Ditahan di minimum aman: {floor}kcal",
  colTime: "Waktu", colMeal: "Makanan", colKcal: "kcal",
  connectHealth: "Hubungkan Apple Health di aplikasi eait untuk iPhone, dan target ini akan selalu menyesuaikan berat badanmu.",
  weightLine: "Berat {kg}kg.",
  weightLineWhen: "Berat {kg}kg, diperbarui {when}.",
  nothingToday: "Hari ini belum ada yang dicatat.",
  meal: "Makanan",
  noMessages: "Belum ada pesan.",
  sentReload: "Terkirim. Muat ulang untuk melihat percakapannya.",
  proposalLead: "Aku catat ini — sudah benar?", logIt: "Catat", notThis: "Bukan ini",
  dropped: "Dibatalkan.",
  logRetry: "Tidak ada jawaban. Tekan Catat sekali lagi: makanannya tidak bisa tercatat dua kali.",
  sent: "Terkirim", alreadyLogged: "Yang itu sudah tercatat.",
  composerPlaceholder: "Beri tahu Spud apa yang kamu makan, atau tanya apa saja",
  diaryPlaceholder: "Beri tahu Spud apa yang kamu makan, atau taruh foto di sini", send: "Kirim",
  addPhoto: "Tambahkan foto",
  photosOfOneMeal: "Foto dari satu makanan",
  sendPhoto: "Kirim fotonya", cancel: "Batal",
  choosePhotoFirst: "Pilih fotonya dulu.",
  photoTooLarge: "Foto itu terlalu besar untuk dikirim.",
  mealGone: "Makanan yang sudah tidak tercatat lagi",
  loading: "Memuat…", somethingWrong: "Ada yang salah. Coba lagi.",
  connectTelegram: "Hubungkan Telegram", telegramFailed: "Tautan Telegram belum jadi kali ini. Coba lagi.",
  language: "Bahasa", settings: "Pengaturan",
  discard: "Buang",
  kept: "Tersimpan di perangkat ini. Akan terkirim sendiri begitu bisa.",
  keptBehind: "Tersimpan di perangkat ini. Akan terkirim setelah pesan di atas, yang menunggu keputusanmu, dikirim lagi atau dibuang.",
  notSaved: "Itu tidak bisa disimpan di perangkat ini, dan tidak terkirim. Coba lagi.",
  firstMealUpload: "Unggah foto",
  firstPhotoAsk: "Taruh foto apa pun yang ada di piringmu",
  dropPhotoHere: "Taruh foto di sini",
  dropPhotoKinds: "atau pilih berkas · JPEG, PNG atau WebP",
  analyseMeal: "Analisis makananku",
  firstTypeAsk: "Kamu makan apa?",
  yourMeal: "Makananmu",
  firstVerdictBeat: "Makro pertamamu",
  correctBeat: "Jeli juga kamu. Aku hitung ulang angkanya.",
  correctAsk: "Di mana aku salah?",
  correctWhat: "Itu tadi apa",
  correctPortion: "Porsi",
  portionSmall: "Kecil", portionRegular: "Biasa", portionLarge: "Besar",
  saveRecheck: "Simpan dan cek ulang",
  offerAsk: "Setiap makanan, seperti yang tadi",
  offerPerkVerdict: "Makro jujur untuk setiap makanan",
  offerPerkPlan: "Rencanamu ikut menyesuaikan saat beratmu berubah",
  offerPerkSpud: "Spud, kapan pun kamu tanya",
  offerToday: "Hari ini", offerBeforeEnd: "Sebelum berakhir", offerDay8: "Hari ke-8",
  offerTodayText: "Gratis 7 hari",
  offerBeforeText: "Kami ingatkan kamu",
  offerDay8Text: "Lalu bulanan · bisa batal kapan saja",
  offerPlans: "Paketmu",
  offerPlanMonthly: "Bulanan · 7 hari gratis",
  offerCheckoutHint: "Pembayaran terbuka di halaman aman, dengan harga dalam mata uangmu. Tidak ada tagihan selama 7 hari.",
  startFreeWeek: "Mulai minggu gratisku",
  offerLater: "Nanti saja",
  photosMax: "Satu makanan bisa berisi sampai {n} foto.",
  photosCount: { one: "{n} foto", few: "{n} foto", many: "{n} foto", other: "{n} foto" },
  photoWithCaption: "Foto: {text}",
  statProtein: "Protein", statCarbs: "Karbohidrat", statFat: "Lemak",
  refusals: {
    "subscription-required": "Jatah gratis akun ini sudah habis. Mulai minggu gratismu untuk melanjutkan.",
    "unsupported-image": "Berkas itu bukan foto yang bisa dibaca di sini. JPEG, PNG atau WebP.",
    "not-food": "Tidak ada makanan di foto ini.",
    "analysis-failed": "Hasilnya tidak masuk. Coba lagi.",
    "identity-required": "Masuk dengan Apple atau Google untuk lanjut — tanpa akun tidak ada yang terbaca.",
    expired: "Yang itu sudah kedaluwarsa. Sebutkan sekali lagi.",
    "target-gone": "Tidak ada makanan yang sedang terbuka di sini untuk diubah. Buka di aplikasi, atau sebutkan apa yang kamu makan dan catat lagi.",
    "too many photos": "Satu makanan tidak bisa punya sudut sebanyak itu.",
    "too large": "Foto itu terlalu besar untuk dikirim.",
    "text too long": "Pesan ini terlalu panjang untuk dikirim.",
    "maybe-landed": "Tidak ada jawaban, dan mungkin tetap terkirim. Muat ulang untuk mengecek sebelum mengirim lagi.",
    unclear: "Prosesnya tidak tuntas, dan mungkin tetap tercatat. Muat ulang untuk mengecek sebelum mengirim lagi.",
  },
};

const RU: WebCopy = {
  navAdmin: "Админ-панель", signOut: "Выйти",
  signedOutLead: "Сфотографируй еду — получи цифры. Войди, чтобы продолжить свой дневник.",
  signIn: "Войти", today: "Сегодня",
  yesterday: "Вчера", dayPrev: "Предыдущий день", dayNext: "Следующий день",
  weekPrev: "Предыдущая неделя", weekNext: "Следующая неделя",
  budgetLeft: "осталось", budgetOver: "сверх", budgetUnder: "ниже",
  targetLine: "Цель {target} · белка {protein}г",
  eatenLine: "Съедено {eaten} из {target}",
  floor: "Твоя цель стоит на минимуме, ниже которого это приложение никогда не опустится.",
  about: "около",
  floorClear: "Безопасный минимум {floor}ккал · ты выше него",
  floorHeld: "Держим на безопасном минимуме: {floor}ккал",
  colTime: "Время", colMeal: "Приём пищи", colKcal: "ккал",
  connectHealth: "Подключи Apple Health в приложении eait на iPhone — и цель будет обновляться вместе с весом.",
  weightLine: "Вес {kg}кг.",
  weightLineWhen: "Вес {kg}кг, обновлён {when}.",
  nothingToday: "Сегодня пока ничего не записано.",
  meal: "Приём пищи",
  noMessages: "Сообщений пока нет.",
  sentReload: "Отправлено. Обнови страницу, чтобы увидеть разговор.",
  proposalLead: "Записываю вот это — всё верно?", logIt: "Записать", notThis: "Не это",
  dropped: "Убрал.",
  logRetry: "Ответа не пришло. Нажми «Записать» ещё раз: дважды записать приём пищи не получится.",
  sent: "Отправлено", alreadyLogged: "Это уже было записано.",
  composerPlaceholder: "Расскажи Spud, что было на тарелке, или спроси о чём угодно",
  diaryPlaceholder: "Расскажи Spud, что было на тарелке, или перетащи фото", send: "Отправить",
  addPhoto: "Добавить фото",
  photosOfOneMeal: "Фотографии одного приёма пищи",
  sendPhoto: "Отправить фото", cancel: "Отмена",
  choosePhotoFirst: "Сначала выбери фото.",
  photoTooLarge: "Это фото слишком большое для отправки.",
  mealGone: "Приём пищи, которого больше нет в дневнике",
  loading: "Загрузка…", somethingWrong: "Что-то пошло не так. Попробуй ещё раз.",
  connectTelegram: "Подключить Telegram", telegramFailed: "Не удалось создать ссылку на Telegram. Попробуй ещё раз.",
  language: "Язык", settings: "Настройки",
  discard: "Отменить",
  kept: "Сохранено на этом устройстве. Уйдёт само, как только сможет.",
  keptBehind: "Сохранено на этом устройстве. Уйдёт, когда сообщение выше — то, что ждёт твоего решения — будет отправлено снова или отменено.",
  notSaved: "Это не удалось сохранить на устройстве, и отправлено оно не было. Попробуй ещё раз.",
  firstMealUpload: "Загрузить фото",
  firstPhotoAsk: "Перетащи сюда фото всего, что на тарелке",
  dropPhotoHere: "Перетащи фото сюда",
  dropPhotoKinds: "или выбери файл · JPEG, PNG или WebP",
  analyseMeal: "Проанализировать",
  firstTypeAsk: "Что было на тарелке?",
  yourMeal: "Твой приём пищи",
  firstVerdictBeat: "Твои первые макросы",
  correctBeat: "Хорошо замечено. Пересчитаю цифры.",
  correctAsk: "Где я ошибся?",
  correctWhat: "Что это было",
  correctPortion: "Порция",
  portionSmall: "Маленькая", portionRegular: "Обычная", portionLarge: "Большая",
  saveRecheck: "Сохранить и проверить снова",
  offerAsk: "Каждый приём пищи — как этот",
  offerPerkVerdict: "Честные макросы для каждого приёма пищи",
  offerPerkPlan: "План меняется вместе с весом",
  offerPerkSpud: "Spud — всегда, когда спросишь",
  offerToday: "Сегодня", offerBeforeEnd: "До конца пробной недели", offerDay8: "День 8",
  offerTodayText: "Бесплатно 7 дней",
  offerBeforeText: "Мы напомним",
  offerDay8Text: "Дальше помесячно · отменить можно в любой момент",
  offerPlans: "Твой тариф",
  offerPlanMonthly: "Помесячно · 7 дней бесплатно",
  offerCheckoutHint: "Оплата откроется на защищённой странице с ценой в твоей валюте. 7 дней ничего не списывается.",
  startFreeWeek: "Начать бесплатную неделю",
  offerLater: "Не сейчас",
  photosMax: "К одному приёму пищи можно приложить до {n} фото.",
  photosCount: { one: "{n} фото", few: "{n} фото", many: "{n} фото", other: "{n} фото" },
  photoWithCaption: "Фото: {text}",
  statProtein: "Белки", statCarbs: "Углеводы", statFat: "Жиры",
  refusals: {
    "subscription-required": "Бесплатный анализ на этом аккаунте уже использован. Начни бесплатную неделю, чтобы продолжить.",
    "unsupported-image": "Этот формат не поддерживается. Нужен JPEG, PNG или WebP.",
    "not-food": "На этом фото еды нет.",
    "analysis-failed": "Ответ не пришёл. Попробуй ещё раз.",
    "identity-required": "Войди через Apple или Google, чтобы продолжить: без входа фото не распознать.",
    expired: "Это предложение устарело. Напиши ещё раз.",
    "target-gone": "Здесь нет открытого приёма пищи, который можно было бы изменить. Открой его в приложении или скажи, что было на тарелке, и запиши заново.",
    "too many photos": "Это больше ракурсов, чем может быть у одного приёма пищи.",
    "too large": "Это фото слишком большое для отправки.",
    "text too long": "Это сообщение слишком длинное, чтобы его отправить.",
    "maybe-landed": "Ответа не пришло, но запрос мог дойти. Обнови страницу и проверь, прежде чем отправлять снова.",
    unclear: "Что-то пошло не так, но запись могла сохраниться. Обнови страницу и проверь, прежде чем отправлять снова.",
  },
};

/** Every sentence this client writes for itself, keyed by language. */
export const WEB_COPY: Localized<WebCopy> = { en: EN, fr: FR, de: DE, it: IT, es: ES, vi: VI, id: ID, ru: RU };

/** `{placeholder}` per declared key. Nothing here is user text, so an unfilled one is a bug. */
export const fillCopy = (template: string, params: Record<string, string>): string =>
  template.replace(/\{(\w+)\}/g, (whole, key: string) => params[key] ?? whole);

/** This client's own words in one language. English for one nobody has written yet. */
// The refusal sentences LOG_COPY owns (#177): the same refusal reads the same on the phone and
// here — the table is the single place they live, and `{max}` on the caption bound is the
// contract's number, spelled in the reader's language.
const sharedRefusals = (lang: Lang): Record<string, string> => {
  const L = logCopyFor(lang).phone;
  return {
    "cap-user": L.capUserNote,
    "cap-global": L.capGlobalNote,
    "cap-address": L.capAddressNote,
    "rate-limited": L.capAddressNote,
    "cap-unknown": L.capUnknownNote,
    "not-onboarded": L.setupNote,
    "caption too long": fillCopy(L.longNoteNote, { max: wholeNumbers(lang)(MAX_USER_LINE) }),
  };
};

export const webCopyFor = (lang: Lang): WebCopy => {
  const copy = t(lang)(WEB_COPY);
  return { ...copy, refusals: { ...copy.refusals, ...sharedRefusals(lang) } };
};

/** The English, under its old name, for the two callers that have no language: the claims gate. */
export const COPY: WebCopy = { ...EN, refusals: { ...EN.refusals, ...sharedRefusals("en") } };

