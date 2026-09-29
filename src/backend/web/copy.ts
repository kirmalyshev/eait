// Every fixed sentence `/start` writes for itself, in every language the product speaks.
//
// WHAT IS GATED IS *OUR* SENTENCES, NOT THE RENDERED PAGE — the rule `page.ts` already had, and the
// reason this table exists rather than the strings sitting inline. The page also renders the
// admin's onboarding copy, which says things like "Lose weight": a goal somebody picked, not a
// claim this product is making, and a gate over the whole document could not tell them apart.
//
// THE CLAIMS GATE IS ENGLISH-ONLY. `claims.ts` matches English patterns, so it proves nothing about
// the seven translations; what protects those is that they are translations OF copy that passed it.
// `page.test.ts` says so out loud rather than quietly running the gate over all eight and passing.
//
// WHICH LANGUAGE: the ACCOUNT's, every time — `/start` has a signed-in user before it renders
// anything past the front door, and the front door reads `Accept-Language`, which is the only
// signal there is before an account exists.

import { t, type Lang, type Localized } from "@eait/shared";

export interface PageCopy {
  frontDoorLead: string;
  /**
   * The welcome demo's accessible name (00-welcome): the recorded loop is a video, so its
   * content is announced rather than read. Describes the final frame — the computed card.
   */
  welcomeDemoAlt: string;
  chatHeading: string;
  chatEmpty: string;
  chatMealGone: string;
  chatPlaceholder: string;
  chatSend: string;
  /**
   * A meal card's figures: `{kcal}` (already grouped), `{unit}` from `UNIT_KCAL`, `{protein}`.
   *
   * The unit is a PLACEHOLDER rather than spelled into each translation, so this key and
   * `UNIT_KCAL` cannot drift — Russian writes `ккал` in exactly one place.
   */
  /**
   * The mascot's alternative text. "Spud" is a NAME and stays one in all eight — what is
   * translated is the sentence around it, because a screen reader announcing English inside a page
   * `shell()` has declared `lang="ru"` gives the wrong voice to the one element that cannot be
   * skimmed past.
   */
  /** `{step}` and `{total}`. Rendered uppercase by CSS, so the copy is written in sentence case. */
  progress: string;
  /** The link to the question before (#53). */
  back: string;
  spudAlt: string;
  cardMacros: string;
  chatProposalLead: string;
  /** A proposal whose items the analyzer could not name. */
  chatAMeal: string;
  chatConfirm: string;
  chatCancel: string;
  chatExpired: string;
  chatTooLong: string;
  chatRefusalNetwork: string;
  chatRefusalGlobal: string;
  chatRefusalDay: string;
  chatNoFocusCorrection: string;
  chatNoFocusRedate: string;
  chatNotOnboarded: string;
  chatRefusalSubscription: string;
  chatRefusalFailed: string;
  chatRefusalNotFood: string;
  chatRefusalImage: string;
  chatRefusalNoPhoto: string;
  chatTooMany: string;
  chatTooLarge: string;
  chatPhotoLead: string;
  chatPhotoSend: string;
  chatCaption: string;
  errorSignIn: string;
  pairHeading: string;
  /** `{tab}` is filled with the shipped tab's own name (SHELL_COPY.navProfile). */
  pairLead: string;
  pairLabel: string;
  pairButton: string;
  /**
   * The account-split guard on the post-sign-up handoff (the country screen — the last `/start`
   * page a signed-in account sees). `{provider}` is the one they actually used; see the note in
   * the English below.
   */
  sameAccountHint: string;
  /** No identity to name — a state `/start/country` can only reach through a device-paired run. */
  sameAccountHintGeneric: string;
  errorPair: string;
  continueLabel: string;
  answerRequired: string;
  /** `{kg}` — the lowest weight this height can be planned for. */
  belowHealthyTarget: string;
  ageBelowMinimum: string;
  outOfRange: string;
  titleStart: string;
  titlePlan: string;
  titleChat: string;
  /**
   * The target-weight stepper's caption (#42). The number and its −/+ buttons are the control;
   * Spud's words are the shared `targetSuggestionLine`, not this.
   */
  stepperSuggested: string;
  topBarNote: string;
  /**
   * The soft offer after the plan (#42). The headline is shared — `offerHeadline` names the
   * computed target and month — so these are the words around it: the beat, the fallback title
   * for a goal that carries no target, the three perks, the timeline, the plan rows, the ask and
   * the close. NO PRICE ANYWHERE: `webPaywall` holds URLs, not figures, and inventing one is
   * exactly the claim the gate exists to catch.
   */
  offerBeat: string;
  offerTitleElse: string;
  offerPerkVerdict: string;
  offerPerkPlan: string;
  offerPerkSpud: string;
  offerWhenToday: string;
  offerFreeWeek: string;
  offerWhenEnding: string;
  offerReminder: string;
  offerWhenDay8: string;
  offerMonthly: string;
  offerPlanMonthly: string;
  offerPlanMonthlyUnit: string;
  offerPlanLifetime: string;
  offerPlanLifetimeUnit: string;
  offerCta: string;
  /** The link under the offer to the published privacy policy. */
  offerPrivacy: string;
  /** The ×'s accessible name — it lets the offer go, straight into the first meal. */
  offerClose: string;
  titleOffer: string;
  languageLabel: string;
  languageSave: string;
  /** `{provider}` is Apple or Google — a brand, so it is not translated, only the verb around it. */
  /**
   * The rate limiter's plain-text 429 body.
   *
   * NOT A PAGE and deliberately still a string a person can read: a browser renders a raw 429 body,
   * so somebody who trips this sees exactly this sentence and nothing else. The `retry-after`
   * header beside it is what a machine reads.
   */
  tooManyAttempts: string;

  // ── S8 ────────────────────────────────────────────────────────────────────────────────────
  // The welcome's two doors and the sign-up screen's words moved to `SIGNUP_COPY` in
  // `src/shared/app/signup-copy.ts` (#110): the phone's M3 draws the same screen. What stays is
  // the chat surface's refusal.
  /**
   * `identity-required`: the engine's answer to analysis on an account with no Apple or Google
   * identity — the sign-up screen is the remedy, not an apology.
   */
  chatRefusalIdentity: string;
}

const EN: PageCopy = {
  frontDoorLead:
    "Set up your account here, then open the app already signed in. It takes about three minutes.",
  welcomeDemoAlt:
    "eait in use: a photo of a grain bowl, three ingredients read with their kcal, and the macros: {kcal} kcal, calories on plan",
  chatHeading: "Your chat",
  chatEmpty: "Nothing here yet. What you say in the app shows up here, and the other way round.",
  chatMealGone: "That meal is no longer in the diary.",
  chatPlaceholder: "What did you eat?",
  chatSend: "Send",
  progress: "Question {step} of {total}",
  back: "Back",
  spudAlt: "Spud, the eait mascot",
  cardMacros: "{kcal} {unit} · {protein} g protein",
  chatProposalLead: "Logging this — look right?",
  chatAMeal: "A meal",
  chatConfirm: "Log it",
  chatCancel: "Not this",
  chatExpired: "That one is no longer being held. Say it again.",
  chatTooLong: "That message is too long to send.",
  chatRefusalNetwork: "Too many from this network — not you, this connection. Try again later.",
  chatRefusalGlobal: "Everyone has used today's allowance. Tomorrow is a fresh number.",
  chatRefusalDay: "That was your last one today — your daily allowance resets at midnight.",
  chatNoFocusCorrection:
    "There is no meal open here to correct. Open it in the app, or say what you ate and log it again.",
  chatNoFocusRedate:
    "There is no meal open here to move to another day. Open it in the app to change its day.",
  chatNotOnboarded: "Answer the plan questions first.",
  chatRefusalSubscription: "This account's free sample is used up. Start your free week to carry on.",
  chatRefusalFailed: "That did not come back. Try it again.",
  chatRefusalNotFood: "That did not look like food.",
  chatRefusalImage: "That file is not a photo this can read. JPEG, PNG or WebP.",
  chatRefusalNoPhoto: "Choose a photo first.",
  chatTooMany: "That is more angles than one meal can have.",
  chatTooLarge: "That photo is too large to send.",
  chatPhotoLead: "Or photograph it",
  chatPhotoSend: "Send the photo",
  chatCaption: "Anything I should know? (optional)",
  errorSignIn: "That sign-in didn't complete. Try again.",
  /**
   * The pairing form, on the front door rather than on a page of its own.
   *
   * Somebody who already has an account is not signing up, so the two sign-in buttons are not for
   * them — and a second page they would have to be told the address of defeats the point of a code
   * short enough to read out loud. One field under the buttons is the whole surface.
   *
   * IT NOW SAYS WHERE TO GET ONE — the board's words ("Your phone makes one in You"), with the
   * tab named by its shipped label rather than the board's older name: `{tab}` is filled with
   * `SHELL_COPY.navProfile` ("Profile"), the screen the phone's pairing control lives on.
   */
  pairHeading: "Have a pairing code?",
  pairLead: "Your phone makes one in {tab}.",
  pairLabel: "Your pairing code",
  pairButton: "Pair this browser",
  /**
   * The `{provider}` is filled in with the one they actually used. THIS SENTENCE IS THE FEATURE:
   * the app offers both buttons, and the other one lands in a different account with onboarding to
   * do again and this plan — and anything bought from it — left behind on an account nothing can
   * merge into. Naming the right button is the only thing standing in front of that.
   */
  sameAccountHint:
    "Install eait for iPhone and choose Sign in with {provider}. It is the same account — your " +
    "answers and your plan are already on it.",
  sameAccountHintGeneric:
    "Install eait for iPhone and sign in the same way you did here. It is the same account — " +
    "your answers and your plan are already on it.",
  errorPair: "That code did not work. A code works once, and only for five minutes after it is made.",
  /** Three places want it and it was typed out in each. */
  continueLabel: "Continue",
  /** The one refusal `/start` words itself — the rest come from the engine's own tables. */
  answerRequired: "That one needs an answer.",
  belowHealthyTarget: "The lowest target we can plan for at your height is {kg} kg.",
  ageBelowMinimum: "We can only plan for adults — check the year.",
  outOfRange: "That value is outside what we can plan for. Try again.",
  /** `<title>` per page. A browser tab in the wrong language is the first thing anybody sees. */
  titleStart: "Start with eait",
  titlePlan: "Your plan",
  titleChat: "Chat",
  stepperSuggested: "Target weight · suggested",
  topBarNote: "Set up on the web · finish on your phone any time",
  offerBeat: "You've done the hard part",
  offerTitleElse: "Every meal, judged against your plan",
  offerPerkVerdict: "Honest macros on every meal",
  offerPerkPlan: "Your plan moves when your weight does",
  offerPerkSpud: "Spud, any time you ask",
  offerWhenToday: "Today",
  offerFreeWeek: "Free for 7 days",
  offerWhenEnding: "Before it ends",
  offerReminder: "We remind you",
  offerWhenDay8: "Day 8",
  offerMonthly: "Billed monthly · cancel any time",
  offerPlanMonthly: "Monthly · 7 days free",
  offerPlanMonthlyUnit: "a month",
  offerPlanLifetime: "Lifetime",
  offerPlanLifetimeUnit: "once",
  offerCta: "Start my free week",
  offerPrivacy: "Privacy",
  offerClose: "Close",
  titleOffer: "Start your free week",
  /** The picker. Its OPTIONS are `LANG_LABEL` — endonyms, never translated. */
  languageLabel: "Language",
  languageSave: "Save",
  tooManyAttempts: "Too many attempts from this address. Try again shortly.\n",
  chatRefusalIdentity: "Sign in with Apple or Google to keep going — the sign-up screen is one step back.",
};

const FR: PageCopy = {
  frontDoorLead: "Crée ton compte ici, puis ouvre l'appli : la session sera déjà ouverte. Ça prend environ trois minutes.",
  welcomeDemoAlt:
    "eait en action : la photo d'un bowl de céréales, trois ingrédients lus avec leurs kcal, et les macros : {kcal} kcal, calories dans le plan",
  chatHeading: "Ton chat",
  chatEmpty: "Rien ici pour l'instant. Ce que tu dis dans l'appli apparaît ici, et inversement.",
  chatMealGone: "Ce repas n'est plus dans le journal.",
  chatPlaceholder: "Tu as mangé quoi ?",
  chatSend: "Envoyer",
  progress: "Question {step} sur {total}",
  back: "Retour",
  spudAlt: "Spud, la mascotte d'eait",
  cardMacros: "{kcal} {unit} · {protein} g de protéines",
  chatProposalLead: "J'enregistre ça — ça te va ?",
  chatAMeal: "Un repas",
  chatConfirm: "Enregistrer",
  chatCancel: "Pas ça",
  chatExpired: "Cette proposition a expiré. Redis-moi ce que tu as mangé.",
  chatTooLong: "Ce message est trop long pour être envoyé.",
  chatRefusalNetwork: "Trop de demandes depuis ce réseau — pas toi, cette connexion. Réessaie plus tard.",
  chatRefusalGlobal: "Tout le monde a épuisé le quota du jour. Demain, on repart de zéro.",
  chatRefusalDay: "C'était le dernier pour aujourd'hui — ton quota quotidien se réinitialise à minuit.",
  chatNoFocusCorrection: "Aucun repas n'est ouvert ici à corriger. Ouvre-le dans l'appli, ou dis ce que tu as mangé et enregistre-le à nouveau.",
  chatNoFocusRedate: "Aucun repas n'est ouvert ici à déplacer vers un autre jour. Ouvre-le dans l'appli pour changer sa date.",
  chatNotOnboarded: "Réponds d'abord aux questions du plan.",
  chatRefusalSubscription: "Ce compte a déjà utilisé son analyse offerte. Lance ta semaine gratuite pour continuer.",
  chatRefusalFailed: "Pas de réponse. Réessaie.",
  chatRefusalNotFood: "Ça ne ressemblait pas à de la nourriture.",
  chatRefusalImage: "Ce fichier n'est pas une photo lisible ici. JPEG, PNG ou WebP.",
  chatRefusalNoPhoto: "Choisis d'abord une photo.",
  chatTooMany: "Ça fait plus d'angles qu'un repas ne peut en avoir.",
  chatTooLarge: "Cette photo est trop lourde à envoyer.",
  chatPhotoLead: "Ou photographie-le",
  chatPhotoSend: "Envoyer la photo",
  chatCaption: "Quelque chose que je devrais savoir ? (facultatif)",
  errorSignIn: "Cette connexion n'a pas abouti. Réessaie.",
  pairHeading: "Tu as un code d'appairage ?",
  pairLead: "Ton téléphone en crée un dans {tab}.",
  pairLabel: "Ton code d'appairage",
  pairButton: "Appairer ce navigateur",
  sameAccountHint: "Installe eait pour iPhone et choisis Se connecter avec {provider}. C'est le même compte — tes réponses et ton plan y sont déjà.",
  sameAccountHintGeneric: "Installe eait pour iPhone et connecte-toi comme tu l'as fait ici. C'est le même compte — tes réponses et ton plan y sont déjà.",
  errorPair: "Ce code n'a pas marché. Un code marche une fois, et seulement cinq minutes après sa création.",
  continueLabel: "Continuer",
  answerRequired: "Cette question attend une réponse.",
  belowHealthyTarget: "Pour ta taille, l'objectif le plus bas qu'on puisse fixer est de {kg} kg.",
  ageBelowMinimum: "On ne peut faire un plan que pour les adultes — vérifie l'année.",
  outOfRange: "Cette valeur sort de ce qu'on peut planifier. Réessaie.",
  titleStart: "Commencer avec eait",
  titlePlan: "Ton plan",
  titleChat: "Chat",
  stepperSuggested: "Poids cible · suggéré",
  topBarNote: "Commencé sur le web · à finir sur ton téléphone quand tu veux",
  offerBeat: "Tu as fait le plus dur",
  offerTitleElse: "Chaque repas, évalué par rapport à ton plan",
  offerPerkVerdict: "Des macros honnêtes pour chaque repas",
  offerPerkPlan: "Ton plan bouge quand ton poids bouge",
  offerPerkSpud: "Spud, quand tu veux",
  offerWhenToday: "Aujourd'hui",
  offerFreeWeek: "Gratuit pendant 7 jours",
  offerWhenEnding: "Avant la fin",
  offerReminder: "On te le rappelle",
  offerWhenDay8: "Jour 8",
  offerMonthly: "Facturé au mois · résiliable quand tu veux",
  offerPlanMonthly: "Mensuel · 7 jours offerts",
  offerPlanMonthlyUnit: "par mois",
  offerPlanLifetime: "À vie",
  offerPlanLifetimeUnit: "une seule fois",
  offerCta: "Commencer ma semaine offerte",
  offerPrivacy: "Confidentialité",
  offerClose: "Fermer",
  titleOffer: "Ta semaine offerte",
  languageLabel: "Langue",
  languageSave: "Enregistrer",
  tooManyAttempts: "Trop de tentatives depuis cette adresse. Réessaie dans un moment.\n",
  chatRefusalIdentity: "Connecte-toi avec Apple ou Google pour continuer — l'écran d'inscription est à un pas.",
};

const DE: PageCopy = {
  frontDoorLead: "Richte dein Konto hier ein und öffne die App dann bereits angemeldet. Dauert etwa drei Minuten.",
  welcomeDemoAlt:
    "eait in Aktion: ein Foto einer Getreidebowl, drei Zutaten mit ihren kcal erkannt, und die Makros: {kcal} kcal, Kalorien im Plan",
  chatHeading: "Dein Chat",
  chatEmpty: "Hier ist noch nichts. Was du in der App sagst, taucht hier auf — und umgekehrt.",
  chatMealGone: "Diese Mahlzeit ist nicht mehr im Tagebuch.",
  chatPlaceholder: "Was hast du gegessen?",
  chatSend: "Senden",
  progress: "Frage {step} von {total}",
  back: "Zurück",
  spudAlt: "Spud, das eait-Maskottchen",
  cardMacros: "{kcal} {unit} · {protein} g Eiweiß",
  chatProposalLead: "Ich trage das ein — passt das?",
  chatAMeal: "Eine Mahlzeit",
  chatConfirm: "Eintragen",
  chatCancel: "Doch nicht",
  chatExpired: "Das wird nicht mehr vorgehalten. Sag es noch einmal.",
  chatTooLong: "Diese Nachricht ist zu lang zum Senden.",
  chatRefusalNetwork: "Zu viele aus diesem Netz — nicht du, diese Verbindung. Versuch es später noch einmal.",
  chatRefusalGlobal: "Das Tageskontingent ist für alle aufgebraucht. Morgen ist eine frische Zahl.",
  chatRefusalDay: "Das war heute deine letzte — dein Tageskontingent setzt um Mitternacht zurück.",
  chatNoFocusCorrection: "Hier ist keine Mahlzeit offen, die sich korrigieren ließe. Öffne sie in der App, oder sag, was du gegessen hast, und trag es neu ein.",
  chatNoFocusRedate: "Hier ist keine Mahlzeit offen, die sich auf einen anderen Tag schieben ließe. Öffne sie in der App, um den Tag zu ändern.",
  chatNotOnboarded: "Beantworte zuerst die Planfragen.",
  chatRefusalSubscription: "Das Gratis-Kontingent dieses Kontos ist aufgebraucht. Starte deine Gratiswoche, um weiterzumachen.",
  chatRefusalFailed: "Da kam nichts zurück. Versuch es noch einmal.",
  chatRefusalNotFood: "Das sah nicht nach Essen aus.",
  chatRefusalImage: "Diese Datei ist kein Foto, das hier gelesen werden kann. JPEG, PNG oder WebP.",
  chatRefusalNoPhoto: "Wähl zuerst ein Foto.",
  chatTooMany: "Das sind mehr Blickwinkel, als eine Mahlzeit haben kann.",
  chatTooLarge: "Dieses Foto ist zu groß zum Senden.",
  chatPhotoLead: "Oder fotografier es",
  chatPhotoSend: "Foto senden",
  chatCaption: "Soll ich noch etwas wissen? (optional)",
  errorSignIn: "Diese Anmeldung ist nicht durchgegangen. Versuch es noch einmal.",
  pairHeading: "Hast du einen Kopplungscode?",
  pairLead: "Dein Telefon erstellt ihn in {tab}.",
  pairLabel: "Dein Kopplungscode",
  pairButton: "Diesen Browser koppeln",
  sameAccountHint: "Installier eait fürs iPhone und wähl „Anmelden mit {provider}“. Es ist dasselbe Konto — deine Antworten und dein Plan liegen schon darauf.",
  sameAccountHintGeneric: "Installier eait fürs iPhone und melde dich so an wie hier. Es ist dasselbe Konto — deine Antworten und dein Plan liegen schon darauf.",
  errorPair: "Dieser Code hat nicht funktioniert. Ein Code gilt einmal und nur fünf Minuten nach seiner Erzeugung.",
  continueLabel: "Weiter",
  answerRequired: "Die hier braucht eine Antwort.",
  belowHealthyTarget: "Das niedrigste Ziel, das wir für deine Größe planen können, sind {kg} kg.",
  ageBelowMinimum: "Wir können nur für Erwachsene planen — prüf das Jahr.",
  outOfRange: "Dieser Wert liegt außerhalb dessen, was wir planen können. Versuch es noch einmal.",
  titleStart: "Mit eait anfangen",
  titlePlan: "Dein Plan",
  titleChat: "Chat",
  stepperSuggested: "Zielgewicht · Vorschlag",
  topBarNote: "Im Browser einrichten · am Telefon jederzeit weiter",
  offerBeat: "Den schweren Teil hast du schon geschafft",
  offerTitleElse: "Jede Mahlzeit, gemessen an deinem Plan",
  offerPerkVerdict: "Ehrliche Makros zu jeder Mahlzeit",
  offerPerkPlan: "Dein Plan bewegt sich mit deinem Gewicht",
  offerPerkSpud: "Spud, wann immer du fragst",
  offerWhenToday: "Heute",
  offerFreeWeek: "7 Tage kostenlos",
  offerWhenEnding: "Bevor sie endet",
  offerReminder: "Wir erinnern dich",
  offerWhenDay8: "Tag 8",
  offerMonthly: "Monatliche Abrechnung · jederzeit kündbar",
  offerPlanMonthly: "Monatlich · 7 Tage gratis",
  offerPlanMonthlyUnit: "pro Monat",
  offerPlanLifetime: "Lifetime",
  offerPlanLifetimeUnit: "einmalig",
  offerCta: "Meine Gratiswoche starten",
  offerPrivacy: "Datenschutz",
  offerClose: "Schließen",
  titleOffer: "Deine Gratiswoche",
  languageLabel: "Sprache",
  languageSave: "Speichern",
  tooManyAttempts: "Zu viele Versuche von dieser Adresse. Versuch es gleich noch einmal.\n",
  chatRefusalIdentity: "Melde dich mit Apple oder Google an, um weiterzumachen — der Anmeldeschirm ist einen Schritt zurück.",
};

const IT: PageCopy = {
  frontDoorLead: "Prepara qui il tuo account, poi apri l'app con la sessione già aperta. Ci vogliono circa tre minuti.",
  welcomeDemoAlt:
    "eait in uso: la foto di una bowl di cereali, tre ingredienti letti con le loro kcal e i macro: {kcal} kcal, calorie nel piano",
  chatHeading: "La tua chat",
  chatEmpty: "Qui non c'è ancora niente. Quello che dici nell'app compare qui, e viceversa.",
  chatMealGone: "Quel pasto non è più nel diario.",
  chatPlaceholder: "Cosa hai mangiato?",
  chatSend: "Invia",
  progress: "Domanda {step} di {total}",
  back: "Indietro",
  spudAlt: "Spud, la mascotte di eait",
  cardMacros: "{kcal} {unit} · {protein} g di proteine",
  chatProposalLead: "Sto registrando questo — ti torna?",
  chatAMeal: "Un pasto",
  chatConfirm: "Registra",
  chatCancel: "Non questo",
  chatExpired: "Quello non è più in attesa. Ridimmelo.",
  chatTooLong: "Questo messaggio è troppo lungo da inviare.",
  chatRefusalNetwork: "Troppe richieste da questa rete — non sei tu, è questa connessione. Riprova più tardi.",
  chatRefusalGlobal: "Il limite di oggi è esaurito per tutti. Domani è un numero nuovo.",
  chatRefusalDay: "Quella era l'ultima di oggi — il tuo limite giornaliero riparte a mezzanotte.",
  chatNoFocusCorrection: "Qui non c'è nessun pasto aperto da correggere. Aprilo nell'app, oppure di' cosa hai mangiato e registralo di nuovo.",
  chatNoFocusRedate: "Qui non c'è nessun pasto aperto da spostare a un altro giorno. Aprilo nell'app per cambiarne la data.",
  chatNotOnboarded: "Prima rispondi alle domande del piano.",
  chatRefusalSubscription: "La quota gratuita di questo account è esaurita. Inizia la tua settimana gratis per continuare.",
  chatRefusalFailed: "Non è tornato niente. Riprova.",
  chatRefusalNotFood: "Non sembrava cibo.",
  chatRefusalImage: "Quel file non è una foto leggibile qui. JPEG, PNG o WebP.",
  chatRefusalNoPhoto: "Scegli prima una foto.",
  chatTooMany: "Sono più angolazioni di quante un pasto possa averne.",
  chatTooLarge: "Quella foto è troppo grande da inviare.",
  chatPhotoLead: "Oppure fotografalo",
  chatPhotoSend: "Invia la foto",
  chatCaption: "C'è qualcosa che dovrei sapere? (facoltativo)",
  errorSignIn: "Quell'accesso non è andato a buon fine. Riprova.",
  pairHeading: "Hai un codice di collegamento?",
  pairLead: "Il telefono ne crea uno in {tab}.",
  pairLabel: "Il tuo codice di collegamento",
  pairButton: "Abbina questo browser",
  sameAccountHint: "Installa eait per iPhone e scegli Accedi con {provider}. È lo stesso account — le tue risposte e il tuo piano ci sono già.",
  sameAccountHintGeneric: "Installa eait per iPhone e accedi come hai fatto qui. È lo stesso account — le tue risposte e il tuo piano ci sono già.",
  errorPair: "Quel codice non ha funzionato. Un codice vale una volta sola, e solo per cinque minuti da quando è stato creato.",
  continueLabel: "Continua",
  answerRequired: "Questa ha bisogno di una risposta.",
  belowHealthyTarget: "L'obiettivo più basso che possiamo pianificare per la tua altezza è {kg} kg.",
  ageBelowMinimum: "Possiamo pianificare solo per adulti — controlla l'anno.",
  outOfRange: "Quel valore è fuori da ciò che possiamo pianificare. Riprova.",
  titleStart: "Inizia con eait",
  titlePlan: "Il tuo piano",
  titleChat: "Chat",
  stepperSuggested: "Peso obiettivo · suggerito",
  topBarNote: "Imposta sul web · finisci sul telefono quando vuoi",
  offerBeat: "Hai fatto la parte difficile",
  offerTitleElse: "Ogni pasto, giudicato sul tuo piano",
  offerPerkVerdict: "Macro onesti per ogni pasto",
  offerPerkPlan: "Il tuo piano si muove con il tuo peso",
  offerPerkSpud: "Spud, quando vuoi",
  offerWhenToday: "Oggi",
  offerFreeWeek: "Gratis per 7 giorni",
  offerWhenEnding: "Prima che finisca",
  offerReminder: "Ti ricordiamo noi",
  offerWhenDay8: "Giorno 8",
  offerMonthly: "Fatturato al mese · disdici quando vuoi",
  offerPlanMonthly: "Mensile · 7 giorni gratis",
  offerPlanMonthlyUnit: "al mese",
  offerPlanLifetime: "Per sempre",
  offerPlanLifetimeUnit: "una volta sola",
  offerCta: "Inizia la mia settimana gratis",
  offerPrivacy: "Privacy",
  offerClose: "Chiudi",
  titleOffer: "La tua settimana gratis",
  languageLabel: "Lingua",
  languageSave: "Salva",
  tooManyAttempts: "Troppi tentativi da questo indirizzo. Riprova tra poco.\n",
  chatRefusalIdentity: "Accedi con Apple o Google per continuare — la schermata di registrazione è a un passo.",
};

const ES: PageCopy = {
  frontDoorLead: "Prepara tu cuenta aquí y luego abre la app ya con la sesión iniciada. Son unos tres minutos.",
  welcomeDemoAlt:
    "eait en uso: la foto de un bowl de granos, tres ingredientes leídos con sus kcal y los macros: {kcal} kcal, calorías dentro del plan",
  chatHeading: "Tu chat",
  chatEmpty: "Aquí todavía no hay nada. Lo que dices en la app aparece aquí, y al revés.",
  chatMealGone: "Esa comida ya no está en el diario.",
  chatPlaceholder: "¿Qué comiste?",
  chatSend: "Enviar",
  progress: "Pregunta {step} de {total}",
  back: "Atrás",
  spudAlt: "Spud, la mascota de eait",
  cardMacros: "{kcal} {unit} · {protein} g de proteína",
  chatProposalLead: "Voy a registrar esto — ¿te cuadra?",
  chatAMeal: "Una comida",
  chatConfirm: "Registrar",
  chatCancel: "Esto no",
  chatExpired: "Ese ya no está en espera. Vuelve a decírmelo.",
  chatTooLong: "Ese mensaje es demasiado largo para enviarlo.",
  chatRefusalNetwork: "Demasiadas peticiones desde esta red — no eres tú, es esta conexión. Inténtalo más tarde.",
  chatRefusalGlobal: "El cupo de hoy se ha agotado para todos. Mañana es un número nuevo.",
  chatRefusalDay: "Esa fue la última de hoy — tu cupo diario se reinicia a medianoche.",
  chatNoFocusCorrection: "Aquí no hay ninguna comida abierta que corregir. Ábrela en la app, o di qué comiste y regístrala otra vez.",
  chatNoFocusRedate: "Aquí no hay ninguna comida abierta que mover a otro día. Ábrela en la app para cambiarle el día.",
  chatNotOnboarded: "Responde primero a las preguntas del plan.",
  chatRefusalSubscription: "La cuota gratuita de esta cuenta se ha agotado. Empieza tu semana gratis para seguir.",
  chatRefusalFailed: "No volvió nada. Inténtalo otra vez.",
  chatRefusalNotFood: "Eso no parecía comida.",
  chatRefusalImage: "Ese archivo no es una foto que se pueda leer aquí. JPEG, PNG o WebP.",
  chatRefusalNoPhoto: "Elige primero una foto.",
  chatTooMany: "Son más ángulos de los que puede tener una comida.",
  chatTooLarge: "Esa foto es demasiado grande para enviarla.",
  chatPhotoLead: "O fotografíalo",
  chatPhotoSend: "Enviar la foto",
  chatCaption: "¿Algo que deba saber? (opcional)",
  errorSignIn: "Ese inicio de sesión no se completó. Inténtalo otra vez.",
  pairHeading: "¿Tienes un código de vinculación?",
  pairLead: "Tu teléfono crea uno en {tab}.",
  pairLabel: "Tu código de vinculación",
  pairButton: "Vincular este navegador",
  sameAccountHint: "Instala eait para iPhone y elige Iniciar sesión con {provider}. Es la misma cuenta — tus respuestas y tu plan ya están ahí.",
  sameAccountHintGeneric: "Instala eait para iPhone e inicia sesión igual que aquí. Es la misma cuenta — tus respuestas y tu plan ya están ahí.",
  errorPair: "Ese código no funcionó. Un código vale una vez, y solo durante cinco minutos desde que se crea.",
  continueLabel: "Continuar",
  answerRequired: "Esa necesita una respuesta.",
  belowHealthyTarget: "El objetivo más bajo que podemos planificar para tu altura es {kg} kg.",
  ageBelowMinimum: "Solo podemos planificar para adultos — comprueba el año.",
  outOfRange: "Ese valor está fuera de lo que podemos planificar. Inténtalo otra vez.",
  titleStart: "Empezar con eait",
  titlePlan: "Tu plan",
  titleChat: "Chat",
  stepperSuggested: "Peso objetivo · sugerido",
  topBarNote: "Configura en la web · termina en tu teléfono cuando quieras",
  offerBeat: "Ya hiciste la parte difícil",
  offerTitleElse: "Cada comida, juzgada contra tu plan",
  offerPerkVerdict: "Macros honestos en cada comida",
  offerPerkPlan: "Tu plan se mueve con tu peso",
  offerPerkSpud: "Spud, cuando preguntes",
  offerWhenToday: "Hoy",
  offerFreeWeek: "Gratis por 7 días",
  offerWhenEnding: "Antes de que termine",
  offerReminder: "Te avisamos",
  offerWhenDay8: "Día 8",
  offerMonthly: "Cobro mensual · cancela cuando quieras",
  offerPlanMonthly: "Mensual · 7 días gratis",
  offerPlanMonthlyUnit: "al mes",
  offerPlanLifetime: "De por vida",
  offerPlanLifetimeUnit: "un solo pago",
  offerCta: "Empezar mi semana gratis",
  offerPrivacy: "Privacidad",
  offerClose: "Cerrar",
  titleOffer: "Tu semana gratis",
  languageLabel: "Idioma",
  languageSave: "Guardar",
  tooManyAttempts: "Demasiados intentos desde esta dirección. Inténtalo dentro de un momento.\n",
  chatRefusalIdentity: "Inicia sesión con Apple o Google para continuar — la pantalla de registro está a un paso.",
};

const VI: PageCopy = {
  frontDoorLead: "Tạo tài khoản ở đây, rồi mở ứng dụng là đã đăng nhập sẵn. Mất khoảng ba phút.",
  welcomeDemoAlt:
    "eait đang dùng: ảnh một bát ngũ cốc, ba nguyên liệu được đọc kèm kcal, và macro: {kcal} kcal, calo trong kế hoạch",
  chatHeading: "Khung chat của bạn",
  chatEmpty: "Ở đây chưa có gì. Những gì bạn nói trong ứng dụng sẽ hiện ở đây, và ngược lại.",
  chatMealGone: "Bữa đó không còn trong nhật ký nữa.",
  chatPlaceholder: "Bạn đã ăn gì?",
  chatSend: "Gửi",
  progress: "Câu hỏi {step}/{total}",
  back: "Quay lại",
  spudAlt: "Spud, linh vật của eait",
  cardMacros: "{kcal} {unit} · {protein} g đạm",
  chatProposalLead: "Mình ghi cái này nhé — có đúng không?",
  chatAMeal: "Một bữa ăn",
  chatConfirm: "Ghi lại",
  chatCancel: "Không phải",
  chatExpired: "Cái đó không còn được giữ nữa. Nói lại giúp mình.",
  chatTooLong: "Tin nhắn này dài quá, không gửi được.",
  chatRefusalNetwork: "Quá nhiều lượt từ mạng này — không phải tại bạn, mà tại kết nối này. Thử lại sau nhé.",
  chatRefusalGlobal: "Hạn mức hôm nay đã hết cho tất cả mọi người. Mai lại là một con số mới.",
  chatRefusalDay: "Đó là lần cuối trong hôm nay — hạn mức mỗi ngày của bạn sẽ đặt lại lúc nửa đêm.",
  chatNoFocusCorrection: "Ở đây không có bữa nào đang mở để sửa. Mở nó trong ứng dụng, hoặc kể bạn đã ăn gì rồi ghi lại.",
  chatNoFocusRedate: "Ở đây không có bữa nào đang mở để chuyển sang ngày khác. Mở nó trong ứng dụng để đổi ngày.",
  chatNotOnboarded: "Hãy trả lời các câu hỏi lập kế hoạch trước.",
  chatRefusalSubscription: "Phần miễn phí của tài khoản này đã dùng hết. Bắt đầu tuần miễn phí để tiếp tục.",
  chatRefusalFailed: "Không có gì trả về. Thử lại nhé.",
  chatRefusalNotFood: "Cái đó trông không giống đồ ăn.",
  chatRefusalImage: "Tệp đó không phải ảnh đọc được ở đây. JPEG, PNG hoặc WebP.",
  chatRefusalNoPhoto: "Chọn một tấm ảnh trước đã.",
  chatTooMany: "Một bữa ăn không thể có nhiều góc chụp đến vậy.",
  chatTooLarge: "Ảnh đó lớn quá, không gửi được.",
  chatPhotoLead: "Hoặc chụp ảnh nó",
  chatPhotoSend: "Gửi ảnh",
  chatCaption: "Có gì mình nên biết không? (không bắt buộc)",
  errorSignIn: "Lần đăng nhập đó chưa hoàn tất. Thử lại nhé.",
  pairHeading: "Bạn có mã ghép nối không?",
  pairLead: "Điện thoại tạo một mã trong {tab}.",
  pairLabel: "Mã ghép nối của bạn",
  pairButton: "Ghép trình duyệt này",
  sameAccountHint: "Cài eait cho iPhone và chọn Đăng nhập bằng {provider}. Vẫn là tài khoản đó — câu trả lời và kế hoạch của bạn đã nằm sẵn trong đấy.",
  sameAccountHintGeneric: "Cài eait cho iPhone và đăng nhập đúng như bạn đã làm ở đây. Vẫn là tài khoản đó — câu trả lời và kế hoạch của bạn đã nằm sẵn trong đấy.",
  errorPair: "Mã đó không dùng được. Mỗi mã chỉ dùng một lần, và chỉ trong năm phút kể từ khi tạo.",
  continueLabel: "Tiếp tục",
  answerRequired: "Câu này cần một câu trả lời.",
  belowHealthyTarget: "Mục tiêu thấp nhất chúng tôi có thể lên kế hoạch cho chiều cao của bạn là {kg} kg.",
  ageBelowMinimum: "Chúng tôi chỉ lên kế hoạch cho người trưởng thành — kiểm tra lại năm nhé.",
  outOfRange: "Giá trị đó nằm ngoài phạm vi chúng tôi có thể lên kế hoạch. Thử lại nhé.",
  titleStart: "Bắt đầu với eait",
  titlePlan: "Kế hoạch của bạn",
  titleChat: "Chat",
  stepperSuggested: "Cân nặng mục tiêu · gợi ý",
  topBarNote: "Cài đặt trên web · tiếp tục trên điện thoại bất cứ lúc nào",
  offerBeat: "Bạn đã qua phần khó rồi",
  offerTitleElse: "Mỗi bữa ăn, so với kế hoạch của bạn",
  offerPerkVerdict: "Macro trung thực cho mỗi bữa ăn",
  offerPerkPlan: "Kế hoạch đổi theo cân nặng của bạn",
  offerPerkSpud: "Spud, bất cứ lúc nào bạn hỏi",
  offerWhenToday: "Hôm nay",
  offerFreeWeek: "Miễn phí 7 ngày",
  offerWhenEnding: "Trước khi hết hạn",
  offerReminder: "Mình sẽ nhắc bạn",
  offerWhenDay8: "Ngày 8",
  offerMonthly: "Tính theo tháng · hủy bất cứ lúc nào",
  offerPlanMonthly: "Theo tháng · 7 ngày miễn phí",
  offerPlanMonthlyUnit: "mỗi tháng",
  offerPlanLifetime: "Trọn đời",
  offerPlanLifetimeUnit: "trả một lần",
  offerCta: "Bắt đầu tuần miễn phí",
  offerPrivacy: "Quyền riêng tư",
  offerClose: "Đóng",
  titleOffer: "Tuần miễn phí của bạn",
  languageLabel: "Ngôn ngữ",
  languageSave: "Lưu",
  tooManyAttempts: "Quá nhiều lần thử từ địa chỉ này. Thử lại sau một lát nhé.\n",
  chatRefusalIdentity: "Đăng nhập bằng Apple hoặc Google để tiếp tục — màn hình đăng ký chỉ cách một bước.",
};

const ID: PageCopy = {
  frontDoorLead: "Siapkan akunmu di sini, lalu buka aplikasinya dalam keadaan sudah masuk. Perlu sekitar tiga menit.",
  welcomeDemoAlt:
    "eait sedang dipakai: foto semangkuk grain bowl, tiga bahan terbaca dengan kcal-nya, dan makronya: {kcal} kkal, kalori sesuai rencana",
  chatHeading: "Chat-mu",
  chatEmpty: "Belum ada apa-apa di sini. Apa yang kamu tulis di aplikasi muncul di sini, dan sebaliknya.",
  chatMealGone: "Makanan itu sudah tidak ada di buku harian.",
  chatPlaceholder: "Kamu makan apa?",
  chatSend: "Kirim",
  progress: "Pertanyaan {step} dari {total}",
  back: "Kembali",
  spudAlt: "Spud, maskot eait",
  cardMacros: "{kcal} {unit} · {protein} g protein",
  chatProposalLead: "Aku catat ini — sudah benar?",
  chatAMeal: "Makanan",
  chatConfirm: "Catat",
  chatCancel: "Bukan ini",
  chatExpired: "Yang itu sudah kedaluwarsa. Sebutkan sekali lagi.",
  chatTooLong: "Pesan ini terlalu panjang untuk dikirim.",
  chatRefusalNetwork: "Terlalu banyak dari jaringan ini — bukan kamu, tapi koneksinya. Coba lagi nanti.",
  chatRefusalGlobal: "Jatah hari ini sudah habis untuk semua orang. Besok angkanya baru lagi.",
  chatRefusalDay: "Itu yang terakhir untuk hari ini — jatah harianmu mulai lagi tengah malam.",
  chatNoFocusCorrection: "Tidak ada makanan yang sedang terbuka di sini untuk dikoreksi. Buka di aplikasi, atau sebutkan apa yang kamu makan dan catat lagi.",
  chatNoFocusRedate: "Tidak ada makanan yang sedang terbuka di sini untuk dipindah ke hari lain. Buka di aplikasi untuk mengubah harinya.",
  chatNotOnboarded: "Jawab dulu pertanyaan rencananya.",
  chatRefusalSubscription: "Jatah gratis akun ini sudah habis. Mulai minggu gratismu untuk melanjutkan.",
  chatRefusalFailed: "Tidak ada jawaban yang kembali. Coba lagi.",
  chatRefusalNotFood: "Itu tidak kelihatan seperti makanan.",
  chatRefusalImage: "Berkas itu bukan foto yang bisa dibaca di sini. JPEG, PNG atau WebP.",
  chatRefusalNoPhoto: "Pilih fotonya dulu.",
  chatTooMany: "Satu makanan tidak bisa punya sudut sebanyak itu.",
  chatTooLarge: "Foto itu terlalu besar untuk dikirim.",
  chatPhotoLead: "Atau foto saja",
  chatPhotoSend: "Kirim fotonya",
  chatCaption: "Ada yang perlu aku tahu? (opsional)",
  errorSignIn: "Proses masuk itu tidak selesai. Coba lagi.",
  pairHeading: "Punya kode penyambung?",
  pairLead: "Ponsel membuatnya di {tab}.",
  pairLabel: "Kode penyambungmu",
  pairButton: "Pasangkan browser ini",
  sameAccountHint: "Pasang eait untuk iPhone dan pilih Masuk dengan {provider}. Ini akun yang sama — jawaban dan rencanamu sudah ada di dalamnya.",
  sameAccountHintGeneric: "Pasang eait untuk iPhone dan masuk dengan cara yang sama seperti di sini. Ini akun yang sama — jawaban dan rencanamu sudah ada di dalamnya.",
  errorPair: "Kode itu tidak berhasil. Kode berlaku sekali, dan hanya lima menit setelah dibuat.",
  continueLabel: "Lanjut",
  answerRequired: "Yang ini butuh jawaban.",
  belowHealthyTarget: "Target terendah yang bisa kami rencanakan untuk tinggimu adalah {kg} kg.",
  ageBelowMinimum: "Kami hanya bisa merencanakan untuk orang dewasa — cek tahunnya.",
  outOfRange: "Nilai itu di luar yang bisa kami rencanakan. Coba lagi.",
  titleStart: "Mulai dengan eait",
  titlePlan: "Rencanamu",
  titleChat: "Chat",
  stepperSuggested: "Berat target · saran",
  topBarNote: "Atur di web · lanjutkan di ponsel kapan saja",
  offerBeat: "Bagian beratnya sudah kamu lewati",
  offerTitleElse: "Setiap makanan, dinilai dari rencanamu",
  offerPerkVerdict: "Makro jujur untuk setiap makanan",
  offerPerkPlan: "Rencanamu ikut berubah saat beratmu berubah",
  offerPerkSpud: "Spud, kapan pun kamu tanya",
  offerWhenToday: "Hari ini",
  offerFreeWeek: "Gratis 7 hari",
  offerWhenEnding: "Sebelum berakhir",
  offerReminder: "Kami ingatkan kamu",
  offerWhenDay8: "Hari ke-8",
  offerMonthly: "Tagihan bulanan · batal kapan saja",
  offerPlanMonthly: "Bulanan · 7 hari gratis",
  offerPlanMonthlyUnit: "per bulan",
  offerPlanLifetime: "Seumur hidup",
  offerPlanLifetimeUnit: "sekali bayar",
  offerCta: "Mulai minggu gratisku",
  offerPrivacy: "Privasi",
  offerClose: "Tutup",
  titleOffer: "Minggu gratismu",
  languageLabel: "Bahasa",
  languageSave: "Simpan",
  tooManyAttempts: "Terlalu banyak percobaan dari alamat ini. Coba lagi sebentar.\n",
  chatRefusalIdentity: "Masuk dengan Apple atau Google untuk lanjut — layar pendaftaran tinggal selangkah.",
};

const RU: PageCopy = {
  frontDoorLead: "Заведи аккаунт здесь, а потом открой приложение уже с входом. Займёт минуты три.",
  welcomeDemoAlt:
    "eait в работе: фото боула, три ингредиента распознаны с ккал, и макросы: {kcal} ккал, калории в пределах плана",
  chatHeading: "Твой чат",
  chatEmpty: "Здесь пока пусто. Что ты говоришь в приложении, появляется тут, и наоборот.",
  chatMealGone: "Этого приёма пищи больше нет в дневнике.",
  chatPlaceholder: "Что было на тарелке?",
  chatSend: "Отправить",
  progress: "Вопрос {step} из {total}",
  back: "Назад",
  spudAlt: "Spud, талисман eait",
  cardMacros: "{kcal} {unit} · {protein} г белка",
  chatProposalLead: "Записываю вот это — всё верно?",
  chatAMeal: "Приём пищи",
  chatConfirm: "Записать",
  chatCancel: "Не это",
  chatExpired: "Это больше не держится. Скажи ещё раз.",
  chatTooLong: "Это сообщение слишком длинное, чтобы его отправить.",
  chatRefusalNetwork: "Слишком много из этой сети — дело не в тебе, а в соединении. Попробуй позже.",
  chatRefusalGlobal: "Сегодняшний лимит израсходован всеми. Завтра цифра свежая.",
  chatRefusalDay: "Это была последняя на сегодня — дневной лимит обнулится в полночь.",
  chatNoFocusCorrection: "Здесь нет открытого приёма пищи, который можно было бы поправить. Открой его в приложении или скажи, что было на тарелке, и запиши заново.",
  chatNoFocusRedate: "Здесь нет открытого приёма пищи, который можно было бы перенести на другой день. Открой его в приложении, чтобы поменять день.",
  chatNotOnboarded: "Сначала ответь на вопросы плана.",
  chatRefusalSubscription: "Бесплатный лимит этого аккаунта исчерпан. Начни бесплатную неделю, чтобы продолжить.",
  chatRefusalFailed: "Ничего не вернулось. Попробуй ещё раз.",
  chatRefusalNotFood: "Это не похоже на еду.",
  chatRefusalImage: "Этот файл — не фото, которое здесь можно прочитать. JPEG, PNG или WebP.",
  chatRefusalNoPhoto: "Сначала выбери фото.",
  chatTooMany: "Это больше ракурсов, чем может быть у одного приёма пищи.",
  chatTooLarge: "Это фото слишком большое для отправки.",
  chatPhotoLead: "Или сфотографируй",
  chatPhotoSend: "Отправить фото",
  chatCaption: "Есть что-то, что мне стоит знать? (необязательно)",
  errorSignIn: "Этот вход не завершился. Попробуй ещё раз.",
  pairHeading: "Есть код привязки?",
  pairLead: "Телефон создаёт его в разделе {tab}.",
  pairLabel: "Твой код привязки",
  pairButton: "Привязать этот браузер",
  sameAccountHint: "Установи eait для iPhone и выбери «Войти через {provider}». Это тот же аккаунт — твои ответы и план уже там.",
  sameAccountHintGeneric: "Установи eait для iPhone и войди так же, как здесь. Это тот же аккаунт — твои ответы и план уже там.",
  errorPair: "Этот код не сработал. Код работает один раз и только пять минут после создания.",
  continueLabel: "Дальше",
  answerRequired: "На этот нужен ответ.",
  belowHealthyTarget: "Самая низкая цель, которую мы можем спланировать для твоего роста, — {kg} кг.",
  ageBelowMinimum: "Мы планируем только для взрослых — проверь год.",
  outOfRange: "Это значение вне того, что мы можем спланировать. Попробуй ещё раз.",
  titleStart: "Начать с eait",
  titlePlan: "Твой план",
  titleChat: "Чат",
  stepperSuggested: "Целевой вес · предложено",
  topBarNote: "Настройка в браузере · продолжи на телефоне в любой момент",
  offerBeat: "Самое трудное уже позади",
  offerTitleElse: "Каждый приём пищи — оценка по твоему плану",
  offerPerkVerdict: "Честные макросы для каждого приёма пищи",
  offerPerkPlan: "План меняется вместе с твоим весом",
  offerPerkSpud: "Spud, когда спросишь",
  offerWhenToday: "Сегодня",
  offerFreeWeek: "7 дней бесплатно",
  offerWhenEnding: "До конца пробного периода",
  offerReminder: "Мы напомним",
  offerWhenDay8: "День 8",
  offerMonthly: "Оплата помесячно · отмена в любой момент",
  offerPlanMonthly: "Месячный · 7 дней бесплатно",
  offerPlanMonthlyUnit: "в месяц",
  offerPlanLifetime: "Навсегда",
  offerPlanLifetimeUnit: "один платёж",
  offerCta: "Начать бесплатную неделю",
  offerPrivacy: "Конфиденциальность",
  offerClose: "Закрыть",
  titleOffer: "Твоя бесплатная неделя",
  languageLabel: "Язык",
  languageSave: "Сохранить",
  tooManyAttempts: "Слишком много попыток с этого адреса. Попробуй чуть позже.\n",
  chatRefusalIdentity: "Войди через Apple или Google, чтобы продолжить — экран регистрации в шаге назад.",
};

/** Every sentence `/start` writes for itself, keyed by language. */
export const PAGE_COPY_BY_LANG: Localized<PageCopy> = {
  en: EN, fr: FR, de: DE, it: IT, es: ES, vi: VI, id: ID, ru: RU,
};

/** `/start`'s own words in one language. English for one nobody has written yet. */
export const pageCopyFor = (lang: Lang): PageCopy => t(lang)(PAGE_COPY_BY_LANG);

/**
 * The English, kept under its old name.
 *
 * `page.ts` builds its markup from a copy object rather than from a table lookup per string, and
 * every caller that has a language hands it `pageCopyFor(lang)`. This is what the two surfaces with
 * NO language reach for: the shell's markup tests, and the claims gate, which can only read English.
 */
export const PAGE_COPY = EN;
