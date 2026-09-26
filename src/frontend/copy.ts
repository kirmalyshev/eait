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

import { t, type Localized } from "../shared/lang.ts";
import type { Lang } from "../shared/types.ts";

export interface WebCopy {
  navDiary: string;
  navChat: string;
  /** The account's own screen: language and sign-out live there (#52). */
  navYou: string;
  navAdmin: string;
  signOut: string;
  signedOutLead: string;
  signIn: string;
  today: string;
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
  /** `{eaten}`, `{target}`, `{protein}`, `{proteinTarget}`. */
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
  photo: string;
  edit: string;
  delete: string;
  confirmDeleteMeal: string;
  confirmDeleteLine: string;
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
  messageGone: string;
  messageNotEditable: string;
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
  /** The outbox (#708): a turn kept on the device, and the two ways on from a held one. */
  waitingToSend: string;
  sendAgain: string;
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
  offerPlanMonthly: string;
  offerPlanLifetime: string;
  startFreeWeek: string;
  offerLater: string;
  /** `{n}` — the photo bound off `ProfileResponse.limits`. */
  photosMax: string;
  /** The three macros the verdict card reports, under the big kcal. */
  statProtein: string;
  statCarbs: string;
  statFat: string;
}

const EN: WebCopy = {
  navDiary: "Diary",
  navChat: "Chat",
  navYou: "You",
  navAdmin: "Admin",
  signOut: "Sign out",
  signedOutLead: "Photograph a meal, get the numbers. Sign in to pick up your diary.",
  signIn: "Sign in",
  today: "Today",
  budgetLeft: "left", budgetOver: "over", budgetUnder: "under",
  targetLine: "Target {target} · {protein} g protein",
  eatenLine: "{eaten} of {target} eaten · {protein} of {proteinTarget} g protein",
  floor: "Your target sits at the minimum this app will ever suggest.",
  about: "about",
  floorClear: "Safe minimum {floor} kcal · you're above it",
  floorHeld: "Held at the safe minimum, {floor} kcal",
  colTime: "Time", colMeal: "Meal", colKcal: "kcal",
  connectHealth: "Connect Apple Health in the eait iPhone app and your weight keeps this target current.",
  weightLine: "Weight {kg} kg.",
  weightLineWhen: "Weight {kg} kg, updated {when}.",
  nothingToday: "Nothing logged yet today.",
  meal: "Meal",
  photo: "Photo",
  edit: "Edit",
  delete: "Delete",
  confirmDeleteMeal: "Delete this meal? Its photos and numbers go too.",
  confirmDeleteLine: "Remove this message? Numbers stay.",
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
  messageGone: "That message is gone.",
  messageNotEditable: "That message cannot be edited.",
  mealGone: "A meal that is no longer logged",
  loading: "Loading…",
  somethingWrong: "Something went wrong. Try again.",
  connectTelegram: "Connect Telegram",
  telegramFailed: "No Telegram link this time. Try again.",
  language: "Language",
  settings: "Settings",
  waitingToSend: "Waiting to send",
  sendAgain: "Send again",
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
  firstVerdictBeat: "Your first verdict",
  correctBeat: "Good catch. I'll redo the numbers.",
  correctAsk: "What did I get wrong?",
  correctWhat: "What it was",
  correctPortion: "Portion",
  portionSmall: "Small", portionRegular: "Regular", portionLarge: "Large",
  saveRecheck: "Save and recheck",
  offerAsk: "Every meal, like that one",
  offerPerkVerdict: "An honest verdict on every meal",
  offerPerkPlan: "Your plan moves when your weight does",
  offerPerkSpud: "Spud, any time you ask",
  offerToday: "Today", offerBeforeEnd: "Before it ends", offerDay8: "Day 8",
  offerTodayText: "Free for 7 days",
  offerBeforeText: "We remind you",
  offerDay8Text: "Then it's monthly · cancel any time",
  offerPlanMonthly: "Monthly · 7 days free",
  offerPlanLifetime: "Lifetime",
  startFreeWeek: "Start my free week",
  offerLater: "Not now",
  photosMax: "One meal takes up to {n} photos.",
  statProtein: "Protein", statCarbs: "Carbs", statFat: "Fat",
  refusals: {
    "subscription-required": "This account's free sample is used up. Start your free week to carry on.",
    "cap-user": "That was your last one today — your daily allowance resets at midnight.",
    "cap-global": "Everyone has used today's allowance. Tomorrow is a fresh number.",
    "cap-address": "Too many from this network — not you, this connection. Try again later.",
    "rate-limited": "Too many from this network — not you, this connection. Try again later.",
    "unsupported-image": "That file is not a photo this can read. JPEG, PNG or WebP.",
    "not-food": "That did not look like food.",
    "analysis-failed": "That did not come back. Try it again.",
    "not-onboarded": "Answer the plan questions first.",
    expired: "That one is no longer being held. Say it again.",
    "target-gone": "There is no meal open here to change. Open it in the app, or say what you ate and log it again.",
    "too many photos": "That is more angles than one meal can have.",
    "too large": "That photo is too large to send.",
    "text too long": "That message is too long to send.",
    "caption too long": "That message is too long to send.",
    "cap-unknown": "That's the limit for now. Try again later.",
    "maybe-landed": "No answer came back, and it may still have gone through. Reload to check before sending it again.",
    unclear: "That did not finish cleanly, and it may still have been logged. Reload to check before sending it again.",
  },
};

const FR: WebCopy = {
  navDiary: "Journal", navChat: "Chat", navYou: "Toi", navAdmin: "Admin", signOut: "Se déconnecter",
  signedOutLead: "Photographie un repas, reçois les chiffres. Connecte-toi pour retrouver ton journal.",
  signIn: "Se connecter", today: "Aujourd'hui",
  budgetLeft: "restantes", budgetOver: "au-dessus", budgetUnder: "en dessous",
  targetLine: "Objectif {target} · {protein} g de protéines",
  eatenLine: "{eaten} sur {target} mangées · {protein} sur {proteinTarget} g de protéines",
  floor: "Ton objectif est fixé au minimum que cette appli puisse proposer.",
  about: "environ",
  floorClear: "Minimum sûr {floor} kcal · tu es au-dessus",
  floorHeld: "Maintenu au minimum sûr, {floor} kcal",
  colTime: "Heure", colMeal: "Repas", colKcal: "kcal",
  connectHealth: "Connecte Apple Health dans l'appli eait pour iPhone et ton poids garde cet objectif à jour.",
  weightLine: "Poids {kg} kg.",
  weightLineWhen: "Poids {kg} kg, mis à jour {when}.",
  nothingToday: "Rien d'enregistré aujourd'hui.",
  meal: "Repas", photo: "Photo", edit: "Modifier", delete: "Supprimer",
  confirmDeleteMeal: "Supprimer ce repas ? Ses photos et ses chiffres partent aussi.",
  confirmDeleteLine: "Retirer ce message ? Les chiffres restent.",
  noMessages: "Aucun message pour l'instant.",
  sentReload: "Envoyé. Recharge pour voir la conversation.",
  proposalLead: "J'enregistre ça — ça te va ?", logIt: "Enregistrer", notThis: "Pas ça",
  dropped: "Supprimé.",
  logRetry: "Aucune réponse. Appuie de nouveau sur Enregistrer : le repas ne peut pas être enregistré deux fois.",
  sent: "Envoyé", alreadyLogged: "Celui-là était déjà enregistré.",
  composerPlaceholder: "Dis à Spud ce que tu as mangé, ou demande-lui ce que tu veux",
  diaryPlaceholder: "Dis à Spud ce que tu as mangé, ou dépose une photo", send: "Envoyer",
  addPhoto: "Ajouter une photo",
  photosOfOneMeal: "Photos d'un seul repas",
  sendPhoto: "Envoyer la photo", cancel: "Annuler",
  choosePhotoFirst: "Choisis d'abord une photo.",
  photoTooLarge: "Cette photo est trop lourde à envoyer.",
  messageGone: "Ce message n'existe plus.",
  messageNotEditable: "Ce message ne peut pas être modifié.",
  mealGone: "Un repas qui n'est plus enregistré",
  loading: "Chargement…", somethingWrong: "Quelque chose a échoué. Réessaie.",
  connectTelegram: "Connecter Telegram", telegramFailed: "Pas de lien Telegram cette fois. Réessaie.",
  language: "Langue", settings: "Réglages",
  waitingToSend: "En attente d'envoi",
  sendAgain: "Renvoyer",
  discard: "Abandonner",
  kept: "Enregistré sur cet appareil. Ça partira tout seul dès que possible.",
  keptBehind: "Enregistré sur cet appareil. Ça partira une fois que le message au-dessus, qui t'attend, aura été renvoyé ou abandonné.",
  notSaved: "Ça n'a pas pu être enregistré sur cet appareil, et ça n'a pas été envoyé. Réessaie.",
  firstMealUpload: "Envoyer une photo",
  firstPhotoAsk: "Dépose une photo de n'importe quelle assiette",
  dropPhotoHere: "Dépose une photo ici",
  dropPhotoKinds: "ou choisis un fichier · JPEG, PNG ou WebP",
  analyseMeal: "Analyse mon repas",
  firstTypeAsk: "Tu as mangé quoi ?",
  yourMeal: "Ton repas",
  firstVerdictBeat: "Ton premier verdict",
  correctBeat: "Bien vu. Je refais les chiffres.",
  correctAsk: "Qu'est-ce que j'ai raté ?",
  correctWhat: "Ce que c'était",
  correctPortion: "Portion",
  portionSmall: "Petite", portionRegular: "Normale", portionLarge: "Grande",
  saveRecheck: "Enregistrer et revérifier",
  offerAsk: "Chaque repas, comme celui-là",
  offerPerkVerdict: "Un verdict honnête sur chaque repas",
  offerPerkPlan: "Ton plan bouge quand ton poids bouge",
  offerPerkSpud: "Spud, dès que tu demandes",
  offerToday: "Aujourd'hui", offerBeforeEnd: "Avant la fin", offerDay8: "Jour 8",
  offerTodayText: "Gratuit pendant 7 jours",
  offerBeforeText: "On te le rappelle",
  offerDay8Text: "Ensuite au mois · résiliable à tout moment",
  offerPlanMonthly: "Mensuel · 7 jours gratuits",
  offerPlanLifetime: "À vie",
  startFreeWeek: "Commencer ma semaine gratuite",
  offerLater: "Pas maintenant",
  photosMax: "Un repas prend jusqu'à {n} photos.",
  statProtein: "Protéines", statCarbs: "Glucides", statFat: "Lipides",
  refusals: {
    "subscription-required": "L'offre gratuite de ce compte est utilisée. Commence ta semaine offerte pour continuer.",
    "cap-user": "C'était le dernier pour aujourd'hui — ton quota quotidien repart à minuit.",
    "cap-global": "Tout le monde a épuisé le quota du jour. Demain repart à zéro.",
    "cap-address": "Trop de demandes depuis ce réseau — pas toi, cette connexion. Réessaie plus tard.",
    "rate-limited": "Trop de demandes depuis ce réseau — pas toi, cette connexion. Réessaie plus tard.",
    "unsupported-image": "Ce fichier n'est pas une photo lisible ici. JPEG, PNG ou WebP.",
    "not-food": "Ça ne ressemblait pas à de la nourriture.",
    "analysis-failed": "Ça n'est pas revenu. Réessaie.",
    "not-onboarded": "Réponds d'abord aux questions du plan.",
    expired: "Celui-là n'est plus en attente. Redis-le-moi.",
    "target-gone": "Aucun repas n'est ouvert ici à modifier. Ouvre-le dans l'appli, ou dis ce que tu as mangé et enregistre-le à nouveau.",
    "too many photos": "Ça fait plus d'angles qu'un repas ne peut en avoir.",
    "too large": "Cette photo est trop lourde à envoyer.",
    "text too long": "Ce message est trop long pour être envoyé.",
    "caption too long": "Ce message est trop long pour être envoyé.",
    "cap-unknown": "C'est la limite pour l'instant. Réessaie plus tard.",
    "maybe-landed": "Aucune réponse, et c'est peut-être quand même passé. Recharge pour vérifier avant de renvoyer.",
    unclear: "Ça ne s'est pas terminé proprement, et ça a peut-être été enregistré. Recharge pour vérifier avant de renvoyer.",
  },
};

const DE: WebCopy = {
  navDiary: "Tagebuch", navChat: "Chat", navYou: "Du", navAdmin: "Admin", signOut: "Abmelden",
  signedOutLead: "Fotografier eine Mahlzeit, bekomm die Zahlen. Melde dich an, um dein Tagebuch weiterzuführen.",
  signIn: "Anmelden", today: "Heute",
  budgetLeft: "übrig", budgetOver: "drüber", budgetUnder: "darunter",
  targetLine: "Ziel {target} · {protein} g Eiweiß",
  eatenLine: "{eaten} von {target} gegessen · {protein} von {proteinTarget} g Eiweiß",
  floor: "Dein Ziel liegt auf dem Minimum, das diese App je vorschlagen wird.",
  about: "etwa",
  floorClear: "Sicheres Minimum {floor} kcal · du liegst darüber",
  floorHeld: "Auf dem sicheren Minimum gehalten, {floor} kcal",
  colTime: "Zeit", colMeal: "Mahlzeit", colKcal: "kcal",
  connectHealth: "Verbinde Apple Health in der eait-App fürs iPhone, dann hält dein Gewicht dieses Ziel aktuell.",
  weightLine: "Gewicht {kg} kg.",
  weightLineWhen: "Gewicht {kg} kg, aktualisiert {when}.",
  nothingToday: "Heute noch nichts eingetragen.",
  meal: "Mahlzeit", photo: "Foto", edit: "Bearbeiten", delete: "Löschen",
  confirmDeleteMeal: "Diese Mahlzeit löschen? Ihre Fotos und Zahlen gehen mit.",
  confirmDeleteLine: "Diese Nachricht entfernen? Die Zahlen bleiben.",
  noMessages: "Noch keine Nachrichten.",
  sentReload: "Gesendet. Lad neu, um das Gespräch zu sehen.",
  proposalLead: "Ich trage das ein — passt das?", logIt: "Eintragen", notThis: "Doch nicht",
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
  messageGone: "Diese Nachricht gibt es nicht mehr.",
  messageNotEditable: "Diese Nachricht lässt sich nicht bearbeiten.",
  mealGone: "Eine Mahlzeit, die nicht mehr eingetragen ist",
  loading: "Lädt…", somethingWrong: "Etwas ist schiefgegangen. Versuch es noch einmal.",
  connectTelegram: "Telegram verbinden", telegramFailed: "Diesmal kein Telegram-Link. Versuch es noch einmal.",
  language: "Sprache", settings: "Einstellungen",
  waitingToSend: "Wartet aufs Senden",
  sendAgain: "Erneut senden",
  discard: "Verwerfen",
  kept: "Auf diesem Gerät gespeichert. Es geht von selbst raus, sobald es geht.",
  keptBehind: "Auf diesem Gerät gespeichert. Es geht raus, sobald die Nachricht darüber, die auf dich wartet, erneut gesendet oder verworfen wurde.",
  notSaved: "Das ließ sich auf diesem Gerät nicht speichern und wurde nicht gesendet. Versuch es noch einmal.",
  firstMealUpload: "Foto hochladen",
  firstPhotoAsk: "Leg ein Foto von irgendwas auf deinem Teller rein",
  dropPhotoHere: "Foto hier ablegen",
  dropPhotoKinds: "oder Datei wählen · JPEG, PNG oder WebP",
  analyseMeal: "Analysier meine Mahlzeit",
  firstTypeAsk: "Was hast du gegessen?",
  yourMeal: "Deine Mahlzeit",
  firstVerdictBeat: "Dein erstes Urteil",
  correctBeat: "Gut aufgepasst. Ich rechne neu.",
  correctAsk: "Was habe ich falsch gelesen?",
  correctWhat: "Was es war",
  correctPortion: "Portion",
  portionSmall: "Klein", portionRegular: "Normal", portionLarge: "Groß",
  saveRecheck: "Speichern und neu prüfen",
  offerAsk: "Jede Mahlzeit, wie diese",
  offerPerkVerdict: "Ein ehrliches Urteil zu jeder Mahlzeit",
  offerPerkPlan: "Dein Plan bewegt sich, wenn dein Gewicht sich bewegt",
  offerPerkSpud: "Spud, wann immer du fragst",
  offerToday: "Heute", offerBeforeEnd: "Bevor sie endet", offerDay8: "Tag 8",
  offerTodayText: "7 Tage kostenlos",
  offerBeforeText: "Wir erinnern dich",
  offerDay8Text: "Danach monatlich · jederzeit kündbar",
  offerPlanMonthly: "Monatlich · 7 Tage kostenlos",
  offerPlanLifetime: "Lebenslang",
  startFreeWeek: "Meine Gratiswoche starten",
  offerLater: "Jetzt nicht",
  photosMax: "Eine Mahlzeit nimmt bis zu {n} Fotos.",
  statProtein: "Eiweiß", statCarbs: "Kohlenhydrate", statFat: "Fett",
  refusals: {
    "subscription-required": "Das Gratis-Kontingent dieses Kontos ist aufgebraucht. Starte deine Gratiswoche, um weiterzumachen.",
    "cap-user": "Das war heute deine letzte — dein Tageskontingent setzt um Mitternacht zurück.",
    "cap-global": "Das Tageskontingent ist für alle aufgebraucht. Morgen ist eine frische Zahl.",
    "cap-address": "Zu viele aus diesem Netz — nicht du, diese Verbindung. Versuch es später noch einmal.",
    "rate-limited": "Zu viele aus diesem Netz — nicht du, diese Verbindung. Versuch es später noch einmal.",
    "unsupported-image": "Diese Datei ist kein Foto, das hier gelesen werden kann. JPEG, PNG oder WebP.",
    "not-food": "Das sah nicht nach Essen aus.",
    "analysis-failed": "Da kam nichts zurück. Versuch es noch einmal.",
    "not-onboarded": "Beantworte zuerst die Planfragen.",
    expired: "Das wird nicht mehr vorgehalten. Sag es noch einmal.",
    "target-gone": "Hier ist keine Mahlzeit offen, die sich ändern ließe. Öffne sie in der App, oder sag, was du gegessen hast, und trag es neu ein.",
    "too many photos": "Das sind mehr Blickwinkel, als eine Mahlzeit haben kann.",
    "too large": "Dieses Foto ist zu groß zum Senden.",
    "text too long": "Diese Nachricht ist zu lang zum Senden.",
    "caption too long": "Diese Nachricht ist zu lang zum Senden.",
    "cap-unknown": "Das ist erst einmal die Grenze. Versuch es später noch einmal.",
    "maybe-landed": "Es kam keine Antwort, und es kann trotzdem durchgegangen sein. Lad neu und schau nach, bevor du es noch einmal schickst.",
    unclear: "Das ist nicht sauber zu Ende gegangen, und es kann trotzdem eingetragen worden sein. Lad neu und schau nach, bevor du es noch einmal schickst.",
  },
};

const IT: WebCopy = {
  navDiary: "Diario", navChat: "Chat", navYou: "Tu", navAdmin: "Admin", signOut: "Esci",
  signedOutLead: "Fotografa un pasto, ricevi i numeri. Accedi per riprendere il tuo diario.",
  signIn: "Accedi", today: "Oggi",
  budgetLeft: "rimaste", budgetOver: "sopra", budgetUnder: "sotto",
  targetLine: "Obiettivo {target} · {protein} g di proteine",
  eatenLine: "{eaten} di {target} mangiate · {protein} di {proteinTarget} g di proteine",
  floor: "Il tuo obiettivo è al minimo che questa app possa proporre.",
  about: "circa",
  floorClear: "Minimo sicuro {floor} kcal · sei al di sopra",
  floorHeld: "Fermo al minimo sicuro, {floor} kcal",
  colTime: "Ora", colMeal: "Pasto", colKcal: "kcal",
  connectHealth: "Collega Apple Health nell'app eait per iPhone e il tuo peso tiene aggiornato questo obiettivo.",
  weightLine: "Peso {kg} kg.",
  weightLineWhen: "Peso {kg} kg, aggiornato {when}.",
  nothingToday: "Oggi non è ancora stato registrato niente.",
  meal: "Pasto", photo: "Foto", edit: "Modifica", delete: "Elimina",
  confirmDeleteMeal: "Eliminare questo pasto? Vanno via anche le sue foto e i suoi numeri.",
  confirmDeleteLine: "Togliere questo messaggio? I numeri restano.",
  noMessages: "Ancora nessun messaggio.",
  sentReload: "Inviato. Ricarica per vedere la conversazione.",
  proposalLead: "Sto registrando questo — ti torna?", logIt: "Registra", notThis: "Non questo",
  dropped: "Scartato.",
  logRetry: "Non è arrivata risposta. Premi di nuovo Registra: il pasto non può essere registrato due volte.",
  sent: "Inviato", alreadyLogged: "Quello era già registrato.",
  composerPlaceholder: "Di' a Spud cosa hai mangiato, o chiedigli quello che vuoi",
  diaryPlaceholder: "Di' a Spud cosa hai mangiato, o trascina una foto", send: "Invia",
  addPhoto: "Aggiungi una foto",
  photosOfOneMeal: "Foto di un solo pasto",
  sendPhoto: "Invia la foto", cancel: "Annulla",
  choosePhotoFirst: "Scegli prima una foto.",
  photoTooLarge: "Quella foto è troppo grande da inviare.",
  messageGone: "Quel messaggio non c'è più.",
  messageNotEditable: "Quel messaggio non si può modificare.",
  mealGone: "Un pasto che non è più registrato",
  loading: "Caricamento…", somethingWrong: "Qualcosa è andato storto. Riprova.",
  connectTelegram: "Collega Telegram", telegramFailed: "Niente link Telegram stavolta. Riprova.",
  language: "Lingua", settings: "Impostazioni",
  waitingToSend: "In attesa di invio",
  sendAgain: "Invia di nuovo",
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
  firstVerdictBeat: "Il tuo primo verdetto",
  correctBeat: "Ben visto. Rifaccio i conti.",
  correctAsk: "Cosa ho capito male?",
  correctWhat: "Cos'era",
  correctPortion: "Porzione",
  portionSmall: "Piccola", portionRegular: "Normale", portionLarge: "Grande",
  saveRecheck: "Salva e ricontrolla",
  offerAsk: "Ogni pasto, come quello",
  offerPerkVerdict: "Un verdetto onesto per ogni pasto",
  offerPerkPlan: "Il tuo piano si muove quando si muove il tuo peso",
  offerPerkSpud: "Spud, ogni volta che chiedi",
  offerToday: "Oggi", offerBeforeEnd: "Prima che finisca", offerDay8: "Giorno 8",
  offerTodayText: "Gratis per 7 giorni",
  offerBeforeText: "Ti ricordiamo noi",
  offerDay8Text: "Poi è mensile · disdici quando vuoi",
  offerPlanMonthly: "Mensile · 7 giorni gratis",
  offerPlanLifetime: "Per sempre",
  startFreeWeek: "Inizia la mia settimana gratis",
  offerLater: "Non ora",
  photosMax: "Un pasto accetta fino a {n} foto.",
  statProtein: "Proteine", statCarbs: "Carboidrati", statFat: "Grassi",
  refusals: {
    "subscription-required": "La quota gratuita di questo account è esaurita. Inizia la tua settimana gratis per continuare.",
    "cap-user": "Quella era l'ultima di oggi — il tuo limite giornaliero riparte a mezzanotte.",
    "cap-global": "Il limite di oggi è esaurito per tutti. Domani è un numero nuovo.",
    "cap-address": "Troppe richieste da questa rete — non sei tu, è questa connessione. Riprova più tardi.",
    "rate-limited": "Troppe richieste da questa rete — non sei tu, è questa connessione. Riprova più tardi.",
    "unsupported-image": "Quel file non è una foto leggibile qui. JPEG, PNG o WebP.",
    "not-food": "Non sembrava cibo.",
    "analysis-failed": "Non è tornato niente. Riprova.",
    "not-onboarded": "Prima rispondi alle domande del piano.",
    expired: "Quello non è più in attesa. Ridimmelo.",
    "target-gone": "Qui non c'è nessun pasto aperto da cambiare. Aprilo nell'app, oppure di' cosa hai mangiato e registralo di nuovo.",
    "too many photos": "Sono più angolazioni di quante un pasto possa averne.",
    "too large": "Quella foto è troppo grande da inviare.",
    "text too long": "Questo messaggio è troppo lungo da inviare.",
    "caption too long": "Questo messaggio è troppo lungo da inviare.",
    "cap-unknown": "Per ora il limite è questo. Riprova più tardi.",
    "maybe-landed": "Non è arrivata risposta, e potrebbe comunque essere passato. Ricarica e controlla prima di rimandarlo.",
    unclear: "Non si è chiuso in modo pulito, e potrebbe comunque essere stato registrato. Ricarica e controlla prima di rimandarlo.",
  },
};

const ES: WebCopy = {
  navDiary: "Diario", navChat: "Chat", navYou: "Tú", navAdmin: "Admin", signOut: "Cerrar sesión",
  signedOutLead: "Fotografía una comida, recibe los números. Entra para seguir con tu diario.",
  signIn: "Entrar", today: "Hoy",
  budgetLeft: "restantes", budgetOver: "por encima", budgetUnder: "por debajo",
  targetLine: "Objetivo {target} · {protein} g de proteína",
  eatenLine: "{eaten} de {target} consumidas · {protein} de {proteinTarget} g de proteína",
  floor: "Tu objetivo está en el mínimo que esta app puede proponer.",
  about: "unas",
  floorClear: "Mínimo seguro {floor} kcal · estás por encima",
  floorHeld: "Detenido en el mínimo seguro, {floor} kcal",
  colTime: "Hora", colMeal: "Comida", colKcal: "kcal",
  connectHealth: "Conecta Apple Health en la app eait para iPhone y tu peso mantiene este objetivo al día.",
  weightLine: "Peso {kg} kg.",
  weightLineWhen: "Peso {kg} kg, actualizado {when}.",
  nothingToday: "Hoy todavía no hay nada registrado.",
  meal: "Comida", photo: "Foto", edit: "Editar", delete: "Eliminar",
  confirmDeleteMeal: "¿Eliminar esta comida? Sus fotos y sus números se van también.",
  confirmDeleteLine: "¿Quitar este mensaje? Los números se quedan.",
  noMessages: "Todavía no hay mensajes.",
  sentReload: "Enviado. Recarga para ver la conversación.",
  proposalLead: "Voy a registrar esto — ¿te cuadra?", logIt: "Registrar", notThis: "Esto no",
  dropped: "Descartado.",
  logRetry: "No llegó respuesta. Pulsa Registrar otra vez: no puede registrar la comida dos veces.",
  sent: "Enviado", alreadyLogged: "Esa ya estaba registrada.",
  composerPlaceholder: "Dile a Spud qué comiste, o pregúntale lo que quieras",
  diaryPlaceholder: "Dile a Spud qué comiste, o suelta una foto", send: "Enviar",
  addPhoto: "Añadir una foto",
  photosOfOneMeal: "Fotos de una sola comida",
  sendPhoto: "Enviar la foto", cancel: "Cancelar",
  choosePhotoFirst: "Elige primero una foto.",
  photoTooLarge: "Esa foto es demasiado grande para enviarla.",
  messageGone: "Ese mensaje ya no está.",
  messageNotEditable: "Ese mensaje no se puede editar.",
  mealGone: "Una comida que ya no está registrada",
  loading: "Cargando…", somethingWrong: "Algo salió mal. Inténtalo otra vez.",
  connectTelegram: "Conectar Telegram", telegramFailed: "Sin enlace de Telegram esta vez. Inténtalo otra vez.",
  language: "Idioma", settings: "Ajustes",
  waitingToSend: "Pendiente de envío",
  sendAgain: "Enviar otra vez",
  discard: "Descartar",
  kept: "Guardado en este dispositivo. Saldrá solo en cuanto pueda.",
  keptBehind: "Guardado en este dispositivo. Saldrá cuando el mensaje de arriba, que te está esperando, se haya enviado otra vez o descartado.",
  notSaved: "No se ha podido guardar en este dispositivo, y no se ha enviado. Inténtalo otra vez.",
  firstMealUpload: "Subir una foto",
  firstPhotoAsk: "Suelta una foto de lo que tengas en el plato",
  dropPhotoHere: "Suelta una foto aquí",
  dropPhotoKinds: "o elige un archivo · JPEG, PNG o WebP",
  analyseMeal: "Analiza mi comida",
  firstTypeAsk: "¿Qué comiste?",
  yourMeal: "Tu comida",
  firstVerdictBeat: "Tu primer veredicto",
  correctBeat: "Bien visto. Rehago los números.",
  correctAsk: "¿En qué me equivoqué?",
  correctWhat: "Qué era",
  correctPortion: "Ración",
  portionSmall: "Pequeña", portionRegular: "Normal", portionLarge: "Grande",
  saveRecheck: "Guardar y revisar",
  offerAsk: "Cada comida, como esa",
  offerPerkVerdict: "Un veredicto honesto en cada comida",
  offerPerkPlan: "Tu plan se mueve cuando tu peso se mueve",
  offerPerkSpud: "Spud, cuando lo pidas",
  offerToday: "Hoy", offerBeforeEnd: "Antes de que termine", offerDay8: "Día 8",
  offerTodayText: "Gratis 7 días",
  offerBeforeText: "Te lo recordamos",
  offerDay8Text: "Luego es mensual · cancela cuando quieras",
  offerPlanMonthly: "Mensual · 7 días gratis",
  offerPlanLifetime: "De por vida",
  startFreeWeek: "Empezar mi semana gratis",
  offerLater: "Ahora no",
  photosMax: "Una comida admite hasta {n} fotos.",
  statProtein: "Proteína", statCarbs: "Carbohidratos", statFat: "Grasas",
  refusals: {
    "subscription-required": "La cuota gratuita de esta cuenta se ha agotado. Empieza tu semana gratis para seguir.",
    "cap-user": "Esa fue la última de hoy — tu cupo diario se reinicia a medianoche.",
    "cap-global": "El cupo de hoy se ha agotado para todos. Mañana es un número nuevo.",
    "cap-address": "Demasiadas desde esta red — no eres tú, es esta conexión. Inténtalo más tarde.",
    "rate-limited": "Demasiadas desde esta red — no eres tú, es esta conexión. Inténtalo más tarde.",
    "unsupported-image": "Ese archivo no es una foto que se pueda leer aquí. JPEG, PNG o WebP.",
    "not-food": "Eso no parecía comida.",
    "analysis-failed": "No volvió nada. Inténtalo otra vez.",
    "not-onboarded": "Responde primero a las preguntas del plan.",
    expired: "Ese ya no está en espera. Vuelve a decírmelo.",
    "target-gone": "Aquí no hay ninguna comida abierta que cambiar. Ábrela en la app, o di qué comiste y regístrala otra vez.",
    "too many photos": "Son más ángulos de los que puede tener una comida.",
    "too large": "Esa foto es demasiado grande para enviarla.",
    "text too long": "Ese mensaje es demasiado largo para enviarlo.",
    "caption too long": "Ese mensaje es demasiado largo para enviarlo.",
    "cap-unknown": "Ese es el límite por ahora. Inténtalo más tarde.",
    "maybe-landed": "No llegó respuesta, y aun así puede haber pasado. Recarga y comprueba antes de volver a enviarlo.",
    unclear: "No terminó limpiamente, y aun así puede haberse registrado. Recarga y comprueba antes de volver a enviarlo.",
  },
};

const VI: WebCopy = {
  navDiary: "Nhật ký", navChat: "Chat", navYou: "Bạn", navAdmin: "Quản trị", signOut: "Đăng xuất",
  signedOutLead: "Chụp một bữa ăn, nhận các con số. Đăng nhập để tiếp tục nhật ký của bạn.",
  signIn: "Đăng nhập", today: "Hôm nay",
  budgetLeft: "còn lại", budgetOver: "vượt", budgetUnder: "thiếu",
  targetLine: "Mục tiêu {target} · {protein} g đạm",
  eatenLine: "Đã ăn {eaten} trên {target} · đạm {protein} trên {proteinTarget} g",
  floor: "Mục tiêu của bạn đang ở mức thấp nhất mà ứng dụng này sẽ đề xuất.",
  about: "khoảng",
  floorClear: "Mức tối thiểu an toàn {floor} kcal · bạn đang trên mức đó",
  floorHeld: "Giữ ở mức tối thiểu an toàn, {floor} kcal",
  colTime: "Giờ", colMeal: "Bữa ăn", colKcal: "kcal",
  connectHealth: "Kết nối Apple Health trong ứng dụng eait trên iPhone để cân nặng luôn cập nhật.",
  weightLine: "Cân nặng {kg} kg.",
  weightLineWhen: "Cân nặng {kg} kg, cập nhật {when}.",
  nothingToday: "Hôm nay chưa ghi gì cả.",
  meal: "Bữa ăn", photo: "Ảnh", edit: "Sửa", delete: "Xoá",
  confirmDeleteMeal: "Xoá bữa này? Ảnh và các con số của nó cũng đi luôn.",
  confirmDeleteLine: "Bỏ tin nhắn này? Các con số vẫn giữ nguyên.",
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
  sendPhoto: "Gửi ảnh", cancel: "Huỷ",
  choosePhotoFirst: "Chọn một tấm ảnh trước đã.",
  photoTooLarge: "Ảnh đó lớn quá, không gửi được.",
  messageGone: "Tin nhắn đó không còn nữa.",
  messageNotEditable: "Tin nhắn đó không sửa được.",
  mealGone: "Một bữa ăn không còn được ghi nữa",
  loading: "Đang tải…", somethingWrong: "Có gì đó trục trặc. Thử lại nhé.",
  connectTelegram: "Kết nối Telegram", telegramFailed: "Lần này chưa có liên kết Telegram. Thử lại nhé.",
  language: "Ngôn ngữ", settings: "Cài đặt",
  waitingToSend: "Đang chờ gửi",
  sendAgain: "Gửi lại",
  discard: "Bỏ đi",
  kept: "Đã lưu trên máy này. Nó sẽ tự gửi ngay khi có thể.",
  keptBehind: "Đã lưu trên máy này. Nó sẽ gửi sau khi tin nhắn phía trên — cái đang chờ bạn quyết định — được gửi lại hoặc bỏ đi.",
  notSaved: "Không lưu được trên máy này, và cũng chưa gửi đi. Thử lại nhé.",
  firstMealUpload: "Tải ảnh lên",
  firstPhotoAsk: "Thả vào đây một tấm ảnh bất cứ món gì trên đĩa của bạn",
  dropPhotoHere: "Thả ảnh vào đây",
  dropPhotoKinds: "hoặc chọn một tệp · JPEG, PNG hoặc WebP",
  analyseMeal: "Phân tích bữa của tôi",
  firstTypeAsk: "Bạn đã ăn gì?",
  yourMeal: "Bữa của bạn",
  firstVerdictBeat: "Phán quyết đầu tiên của bạn",
  correctBeat: "Hay đấy. Mình tính lại các con số.",
  correctAsk: "Mình sai chỗ nào?",
  correctWhat: "Đó là món gì",
  correctPortion: "Khẩu phần",
  portionSmall: "Nhỏ", portionRegular: "Vừa", portionLarge: "Lớn",
  saveRecheck: "Lưu và kiểm tra lại",
  offerAsk: "Mọi bữa ăn, như bữa đó",
  offerPerkVerdict: "Phán quyết thẳng thắn cho mỗi bữa",
  offerPerkPlan: "Kế hoạch đổi khi cân nặng đổi",
  offerPerkSpud: "Spud, bất cứ lúc nào bạn hỏi",
  offerToday: "Hôm nay", offerBeforeEnd: "Trước khi hết", offerDay8: "Ngày 8",
  offerTodayText: "Miễn phí 7 ngày",
  offerBeforeText: "Bọn mình nhắc bạn",
  offerDay8Text: "Sau đó tính theo tháng · huỷ bất cứ lúc nào",
  offerPlanMonthly: "Theo tháng · 7 ngày miễn phí",
  offerPlanLifetime: "Trọn đời",
  startFreeWeek: "Bắt đầu tuần miễn phí của tôi",
  offerLater: "Để sau",
  photosMax: "Một bữa ăn nhận tối đa {n} ảnh.",
  statProtein: "Đạm", statCarbs: "Tinh bột", statFat: "Béo",
  refusals: {
    "subscription-required": "Phần miễn phí của tài khoản này đã dùng hết. Bắt đầu tuần miễn phí để tiếp tục.",
    "cap-user": "Đó là lần cuối trong hôm nay — hạn mức mỗi ngày của bạn sẽ đặt lại lúc nửa đêm.",
    "cap-global": "Hạn mức hôm nay đã hết cho tất cả mọi người. Mai lại là một con số mới.",
    "cap-address": "Quá nhiều lượt từ mạng này — không phải tại bạn, mà tại kết nối này. Thử lại sau nhé.",
    "rate-limited": "Quá nhiều lượt từ mạng này — không phải tại bạn, mà tại kết nối này. Thử lại sau nhé.",
    "unsupported-image": "Tệp đó không phải ảnh đọc được ở đây. JPEG, PNG hoặc WebP.",
    "not-food": "Cái đó trông không giống đồ ăn.",
    "analysis-failed": "Không có gì trả về. Thử lại nhé.",
    "not-onboarded": "Hãy trả lời các câu hỏi lập kế hoạch trước.",
    expired: "Cái đó không còn được giữ nữa. Nói lại giúp mình.",
    "target-gone": "Ở đây không có bữa nào đang mở để sửa. Mở nó trong ứng dụng, hoặc kể bạn đã ăn gì rồi ghi lại.",
    "too many photos": "Một bữa ăn không thể có nhiều góc chụp đến vậy.",
    "too large": "Ảnh đó lớn quá, không gửi được.",
    "text too long": "Tin nhắn này dài quá, không gửi được.",
    "caption too long": "Tin nhắn này dài quá, không gửi được.",
    "cap-unknown": "Tạm thời đó là giới hạn. Thử lại sau nhé.",
    "maybe-landed": "Không có phản hồi, và cũng có thể nó vẫn đi qua. Tải lại để kiểm tra trước khi gửi lần nữa.",
    unclear: "Việc này chưa kết thúc gọn ghẽ, và cũng có thể đã được ghi. Tải lại để kiểm tra trước khi gửi lần nữa.",
  },
};

const ID: WebCopy = {
  navDiary: "Buku harian", navChat: "Chat", navYou: "Kamu", navAdmin: "Admin", signOut: "Keluar",
  signedOutLead: "Foto sebuah makanan, dapat angkanya. Masuk untuk melanjutkan buku harianmu.",
  signIn: "Masuk", today: "Hari ini",
  budgetLeft: "tersisa", budgetOver: "lebih", budgetUnder: "kurang",
  targetLine: "Target {target} · {protein} g protein",
  eatenLine: "{eaten} dari {target} dimakan · {protein} dari {proteinTarget} g protein",
  floor: "Targetmu berada di angka terendah yang bisa disarankan aplikasi ini.",
  about: "sekitar",
  floorClear: "Minimum aman {floor} kkal · kamu di atasnya",
  floorHeld: "Tertahan di minimum aman, {floor} kkal",
  colTime: "Waktu", colMeal: "Makan", colKcal: "kkal",
  connectHealth: "Hubungkan Apple Health di aplikasi eait untuk iPhone, dan berat badanmu menjaga target ini tetap terkini.",
  weightLine: "Berat {kg} kg.",
  weightLineWhen: "Berat {kg} kg, diperbarui {when}.",
  nothingToday: "Hari ini belum ada yang dicatat.",
  meal: "Makanan", photo: "Foto", edit: "Ubah", delete: "Hapus",
  confirmDeleteMeal: "Hapus makanan ini? Foto dan angkanya ikut hilang.",
  confirmDeleteLine: "Hapus pesan ini? Angkanya tetap.",
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
  messageGone: "Pesan itu sudah tidak ada.",
  messageNotEditable: "Pesan itu tidak bisa diubah.",
  mealGone: "Makanan yang sudah tidak tercatat lagi",
  loading: "Memuat…", somethingWrong: "Ada yang salah. Coba lagi.",
  connectTelegram: "Hubungkan Telegram", telegramFailed: "Tautan Telegram belum jadi kali ini. Coba lagi.",
  language: "Bahasa", settings: "Pengaturan",
  waitingToSend: "Menunggu dikirim",
  sendAgain: "Kirim lagi",
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
  firstVerdictBeat: "Penilaian pertamamu",
  correctBeat: "Bagus. Aku hitung ulang angkanya.",
  correctAsk: "Di mana aku salah?",
  correctWhat: "Itu tadi apa",
  correctPortion: "Porsi",
  portionSmall: "Kecil", portionRegular: "Biasa", portionLarge: "Besar",
  saveRecheck: "Simpan dan cek ulang",
  offerAsk: "Setiap makanan, seperti yang tadi",
  offerPerkVerdict: "Penilaian jujur untuk setiap makanan",
  offerPerkPlan: "Rencanamu bergerak saat beratmu bergerak",
  offerPerkSpud: "Spud, kapan pun kamu tanya",
  offerToday: "Hari ini", offerBeforeEnd: "Sebelum berakhir", offerDay8: "Hari ke-8",
  offerTodayText: "Gratis 7 hari",
  offerBeforeText: "Kami ingatkan kamu",
  offerDay8Text: "Lalu bulanan · bisa batal kapan saja",
  offerPlanMonthly: "Bulanan · 7 hari gratis",
  offerPlanLifetime: "Seumur hidup",
  startFreeWeek: "Mulai minggu gratisku",
  offerLater: "Nanti saja",
  photosMax: "Satu makanan bisa berisi sampai {n} foto.",
  statProtein: "Protein", statCarbs: "Karbo", statFat: "Lemak",
  refusals: {
    "subscription-required": "Jatah gratis akun ini sudah habis. Mulai minggu gratismu untuk melanjutkan.",
    "cap-user": "Itu yang terakhir untuk hari ini — jatah harianmu mulai lagi tengah malam.",
    "cap-global": "Jatah hari ini sudah habis untuk semua orang. Besok angkanya baru lagi.",
    "cap-address": "Terlalu banyak dari jaringan ini — bukan kamu, tapi koneksinya. Coba lagi nanti.",
    "rate-limited": "Terlalu banyak dari jaringan ini — bukan kamu, tapi koneksinya. Coba lagi nanti.",
    "unsupported-image": "Berkas itu bukan foto yang bisa dibaca di sini. JPEG, PNG atau WebP.",
    "not-food": "Itu tidak kelihatan seperti makanan.",
    "analysis-failed": "Tidak ada jawaban yang kembali. Coba lagi.",
    "not-onboarded": "Jawab dulu pertanyaan rencananya.",
    expired: "Yang itu sudah kedaluwarsa. Sebutkan sekali lagi.",
    "target-gone": "Tidak ada makanan yang sedang terbuka di sini untuk diubah. Buka di aplikasi, atau sebutkan apa yang kamu makan dan catat lagi.",
    "too many photos": "Satu makanan tidak bisa punya sudut sebanyak itu.",
    "too large": "Foto itu terlalu besar untuk dikirim.",
    "text too long": "Pesan ini terlalu panjang untuk dikirim.",
    "caption too long": "Pesan ini terlalu panjang untuk dikirim.",
    "cap-unknown": "Untuk sekarang itu batasnya. Coba lagi nanti.",
    "maybe-landed": "Tidak ada jawaban, dan mungkin tetap terkirim. Muat ulang untuk mengecek sebelum mengirim lagi.",
    unclear: "Ini tidak selesai dengan bersih, dan mungkin tetap tercatat. Muat ulang untuk mengecek sebelum mengirim lagi.",
  },
};

const RU: WebCopy = {
  navDiary: "Дневник", navChat: "Чат", navYou: "Ты", navAdmin: "Админка", signOut: "Выйти",
  signedOutLead: "Сфотографируй еду — получи цифры. Войди, чтобы продолжить свой дневник.",
  signIn: "Войти", today: "Сегодня",
  budgetLeft: "осталось", budgetOver: "сверх", budgetUnder: "ниже",
  targetLine: "Цель {target} · белка {protein} г",
  eatenLine: "Съедено {eaten} из {target} · белка {protein} из {proteinTarget} г",
  floor: "Твоя цель стоит на минимуме, ниже которого это приложение никогда не опустится.",
  about: "около",
  floorClear: "Безопасный минимум {floor} ккал · ты выше него",
  floorHeld: "Остановились на безопасном минимуме, {floor} ккал",
  colTime: "Время", colMeal: "Приём пищи", colKcal: "ккал",
  connectHealth: "Подключи Apple Health в приложении eait для iPhone, и вес будет держать эту цель актуальной.",
  weightLine: "Вес {kg} кг.",
  weightLineWhen: "Вес {kg} кг, обновлён {when}.",
  nothingToday: "Сегодня пока ничего не записано.",
  meal: "Приём пищи", photo: "Фото", edit: "Изменить", delete: "Удалить",
  confirmDeleteMeal: "Удалить этот приём пищи? Его фото и цифры уйдут вместе с ним.",
  confirmDeleteLine: "Убрать это сообщение? Цифры останутся.",
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
  messageGone: "Этого сообщения больше нет.",
  messageNotEditable: "Это сообщение нельзя изменить.",
  mealGone: "Приём пищи, которого больше нет в дневнике",
  loading: "Загрузка…", somethingWrong: "Что-то пошло не так. Попробуй ещё раз.",
  connectTelegram: "Подключить Telegram", telegramFailed: "В этот раз ссылка на Telegram не вышла. Попробуй ещё раз.",
  language: "Язык", settings: "Настройки",
  waitingToSend: "Ждёт отправки",
  sendAgain: "Отправить снова",
  discard: "Отбросить",
  kept: "Сохранено на этом устройстве. Уйдёт само, как только сможет.",
  keptBehind: "Сохранено на этом устройстве. Уйдёт, когда сообщение выше — то, что ждёт твоего решения — будет отправлено снова или отброшено.",
  notSaved: "Это не удалось сохранить на устройстве, и отправлено оно не было. Попробуй ещё раз.",
  firstMealUpload: "Загрузить фото",
  firstPhotoAsk: "Перетащи сюда фото всего, что на тарелке",
  dropPhotoHere: "Перетащи фото сюда",
  dropPhotoKinds: "или выбери файл · JPEG, PNG или WebP",
  analyseMeal: "Проанализируй эту еду",
  firstTypeAsk: "Что было на тарелке?",
  yourMeal: "Твой приём пищи",
  firstVerdictBeat: "Твой первый вердикт",
  correctBeat: "Хорошо замечено. Пересчитаю цифры.",
  correctAsk: "Что мне поправить?",
  correctWhat: "Что это было",
  correctPortion: "Порция",
  portionSmall: "Маленькая", portionRegular: "Обычная", portionLarge: "Большая",
  saveRecheck: "Сохранить и проверить снова",
  offerAsk: "Каждый приём пищи — как этот",
  offerPerkVerdict: "Честный вердикт каждому приёму пищи",
  offerPerkPlan: "План двигается, когда двигается вес",
  offerPerkSpud: "Spud — всегда, когда спросишь",
  offerToday: "Сегодня", offerBeforeEnd: "Пока не кончилась", offerDay8: "День 8",
  offerTodayText: "Бесплатно 7 дней",
  offerBeforeText: "Мы напомним",
  offerDay8Text: "Дальше помесячно · отменить можно в любой момент",
  offerPlanMonthly: "Помесячно · 7 дней бесплатно",
  offerPlanLifetime: "Навсегда",
  startFreeWeek: "Начать бесплатную неделю",
  offerLater: "Не сейчас",
  photosMax: "К одному приёму пищи можно приложить до {n} фото.",
  statProtein: "Белок", statCarbs: "Углеводы", statFat: "Жиры",
  refusals: {
    "subscription-required": "Бесплатный лимит этого аккаунта исчерпан. Начни бесплатную неделю, чтобы продолжить.",
    "cap-user": "Это была последняя на сегодня — дневной лимит обнулится в полночь.",
    "cap-global": "Сегодняшний лимит израсходован всеми. Завтра цифра свежая.",
    "cap-address": "Слишком много из этой сети — дело не в тебе, а в соединении. Попробуй позже.",
    "rate-limited": "Слишком много из этой сети — дело не в тебе, а в соединении. Попробуй позже.",
    "unsupported-image": "Этот файл — не фото, которое здесь можно прочитать. JPEG, PNG или WebP.",
    "not-food": "Это не похоже на еду.",
    "analysis-failed": "Ничего не вернулось. Попробуй ещё раз.",
    "not-onboarded": "Сначала ответь на вопросы плана.",
    expired: "Это больше не держится. Скажи ещё раз.",
    "target-gone": "Здесь нет открытого приёма пищи, который можно было бы изменить. Открой его в приложении или скажи, что было на тарелке, и запиши заново.",
    "too many photos": "Это больше ракурсов, чем может быть у одного приёма пищи.",
    "too large": "Это фото слишком большое для отправки.",
    "text too long": "Это сообщение слишком длинное, чтобы его отправить.",
    "caption too long": "Это сообщение слишком длинное, чтобы его отправить.",
    "cap-unknown": "Пока это предел. Попробуй позже.",
    "maybe-landed": "Ответа не пришло, и всё же могло пройти. Обнови страницу и проверь, прежде чем отправлять снова.",
    unclear: "Это не завершилось чисто, и всё же могло записаться. Обнови страницу и проверь, прежде чем отправлять снова.",
  },
};

/** Every sentence this client writes for itself, keyed by language. */
export const WEB_COPY: Localized<WebCopy> = { en: EN, fr: FR, de: DE, it: IT, es: ES, vi: VI, id: ID, ru: RU };

/** This client's own words in one language. English for one nobody has written yet. */
export const webCopyFor = (lang: Lang): WebCopy => t(lang)(WEB_COPY);

/** The English, under its old name, for the two callers that have no language: the claims gate. */
export const COPY = EN;

/** `{placeholder}` per declared key. Nothing here is user text, so an unfilled one is a bug. */
export const fillCopy = (template: string, params: Record<string, string>): string =>
  template.replace(/\{(\w+)\}/g, (whole, key: string) => params[key] ?? whole);
