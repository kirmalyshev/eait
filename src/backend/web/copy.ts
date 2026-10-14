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

import { t, type CountForms, type Lang, type Localized } from "@eait/shared";

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
  /**
   * The account-split guard on the post-sign-up handoff (the country screen — the last `/start`
   * page a signed-in account sees). `{provider}` is the one they actually used; see the note in
   * the English below.
   */
  sameAccountHint: string;
  /** No identity to name — a state `/start/country` can only reach through a device-paired run. */
  sameAccountHintGeneric: string;
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
   * for a goal that carries no target, the three perks, the timeline, the ask and the close.
   * The plan rows' own words are `PAY_COPY`'s, and their prices arrive already formatted in the
   * `webPaywall` block — a figure is never written here (#263).
   */
  offerBeat: string;
  offerTitleElse: string;
  offerPerkVerdict: string;
  offerPerkPlan: string;
  offerPerkSpud: string;
  offerWhenToday: string;
  offerWhenEnding: string;
  offerReminder: string;
  /** The day billing starts: "Day {n}", `n` the host's `trialDays` + 1 — never a literal, because
      the trial's length is configured, not fixed (ieat-app#1591). */
  offerWhenAfter: string;
  /** The "then" row's line — cadence-neutral: the plans below are the Monthly/Yearly pair (#263),
      so the timeline may not name one. */
  offerBilled: string;
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

  // ── Email sign-in (#569) ─────────────────────────────────────────────────────────────────
  // The third provider beside Apple and Google — the boards `web/email-address.html`,
  // `web/email-code*.html` and `web/email-too-many.html`. The mail's own words live in
  // `mail/copy.ts`; these are the two pages'.
  //
  // `{email}` inside `emailCodeLead` is the address, already escaped by the caller. `{min}`
  // inside `emailTooMany` is a whole `countText` minute form, filled the same way — the
  // sentence's word order stays the translator's. `{time}` inside `emailResendWait` is an
  // M:SS countdown, rendered once per load — a no-JavaScript page cannot tick.
  titleEmail: string;
  emailHeading: string;
  emailLead: string;
  /** The email input's accessible label. */
  emailFieldLabel: string;
  emailSend: string;
  /** A malformed address, back on the address page — the board draws no state for one. */
  emailBad: string;
  emailTooMany: string;
  /** The count `emailTooMany`'s `{min}` is filled with — one form per plural category the language has. */
  emailMinutes: CountForms;
  emailCodeHeading: string;
  emailCodeLead: string;
  /** The code input's accessible label. */
  emailCodeLabel: string;
  emailCodeWrong: string;
  emailCodeDead: string;
  emailCodeNew: string;
  emailResendWait: string;
  emailResend: string;
  emailDifferent: string;
  /**
   * The invite page a friend's link opens (#899) — `/r/<code>`, the same page on a phone and a
   * desktop. `{link}` in `inviteCopied` is the link without its scheme, as it is read off a screen.
   */
  inviteTitle: string;
  inviteHeading: string;
  inviteLead: string;
  inviteApp: string;
  inviteWeb: string;
  inviteCopied: string;
  /** The friend's-link step, after the country (#899). Optional: Skip is always there. */
  referralAsk: string;
  referralLead: string;
  /** The field's accessible label. */
  referralField: string;
  referralSkip: string;
  referralTryAgain: string;
  referralApplied: string;
  referralUnknown: string;
  referralOwn: string;
  referralAlready: string;
  /** An account that has already bought eait: invite links are for people who have not. */
  referralPaid: string;
}

const EN: PageCopy = {
  frontDoorLead:
    "Set up your account here, then open the app already signed in. It takes about three minutes.",
  welcomeDemoAlt:
    "eait in use: a photo of a grain bowl, three ingredients read with their kcal, and the macros: {kcal}kcal, calories on plan",
  chatHeading: "Your chat",
  chatEmpty: "Nothing here yet. What you say in the app shows up here, and the other way round.",
  chatMealGone: "That meal is no longer in the diary.",
  chatPlaceholder: "What did you eat?",
  chatSend: "Send",
  progress: "Question {step} of {total}",
  back: "Back",
  spudAlt: "Spud, the eait mascot",
  cardMacros: "{kcal}{unit} · {protein}g protein",
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
  chatRefusalSubscription: "This account's free sample is used up. Start your free trial to carry on.",
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
  /** Three places want it and it was typed out in each. */
  continueLabel: "Continue",
  /** The one refusal `/start` words itself — the rest come from the engine's own tables. */
  answerRequired: "That one needs an answer.",
  belowHealthyTarget: "The lowest target we can plan for at your height is {kg}kg.",
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
    offerWhenEnding: "Before it ends",
  offerReminder: "We remind you",
  offerWhenAfter: "Day {n}",
  offerBilled: "Billing starts · cancel any time",
    offerClose: "Close",
  titleOffer: "Start your free trial",
  /** The picker. Its OPTIONS are `LANG_LABEL` — endonyms, never translated. */
  languageLabel: "Language",
  languageSave: "Save",
  tooManyAttempts: "Too many attempts from this address. Try again shortly.\n",
  chatRefusalIdentity: "Sign in with Apple or Google to keep going — the sign-up screen is one step back.",
  titleEmail: "Sign in with email",
  emailHeading: "Sign in with email",
  emailLead: "We'll email you a 6-digit code. No password.",
  emailFieldLabel: "Your email address",
  emailSend: "Send code",
  emailBad: "That doesn't look like an email address.",
  emailTooMany: "Too many tries. Try again in {min}.",
  emailMinutes: { one: "{n} minute", other: "{n} minutes" },
  emailCodeHeading: "Check your inbox",
  emailCodeLead: "Enter the 6-digit code we sent to {email}. It works for 10 minutes.",
  emailCodeLabel: "The 6-digit code",
  emailCodeWrong: "That code isn't right. Check the newest email from eait.",
  emailCodeDead: "This code has expired. Send a new one to keep going.",
  emailCodeNew: "Send a new code",
  emailResendWait: "Resend code in {time}",
  emailResend: "Resend code",
  emailDifferent: "Use a different email",
  inviteTitle: "A week of eait from a friend",
  inviteHeading: "A friend sent you a week of eait",
  inviteLead: "Snap a meal and see what's in it. Join with this link and the week is yours, free, from the day you sign up.",
  inviteApp: "Get the iPhone app",
  inviteWeb: "Start on the web",
  inviteCopied: "Invite {link} is copied for the app.",
  referralAsk: "Did a friend send you a link?",
  referralLead: "Optional. Join with it and your first week of eait is free.",
  referralField: "Friend's invite link",
  referralSkip: "Skip",
  referralTryAgain: "Try again",
  referralApplied: "Invite applied. Your free week starts now.",
  referralUnknown: "That link doesn't match anyone. Check it, or skip.",
  referralOwn: "That's your own link. A friend's link goes here.",
  referralAlready: "This account already joined with a friend's link.",
  referralPaid: "Invite links are for new members, and this account has already bought eait.",
};

const FR: PageCopy = {
  frontDoorLead: "Crée ton compte ici, puis ouvre l'app : la session sera déjà ouverte. Ça prend environ trois minutes.",
  welcomeDemoAlt:
    "eait en action : la photo d'un bowl de céréales, trois ingrédients lus avec leurs kcal, et les macros : {kcal}kcal, calories dans le plan",
  chatHeading: "Ton chat",
  chatEmpty: "Rien ici pour l'instant. Ce que tu dis dans l'app apparaît ici, et inversement.",
  chatMealGone: "Ce repas n'est plus dans le journal.",
  chatPlaceholder: "Tu as mangé quoi ?",
  chatSend: "Envoyer",
  progress: "Question {step} sur {total}",
  back: "Retour",
  spudAlt: "Spud, la mascotte d'eait",
  cardMacros: "{kcal}{unit} · {protein}g de protéines",
  chatProposalLead: "J'enregistre ça — ça te va ?",
  chatAMeal: "Un repas",
  chatConfirm: "Enregistrer",
  chatCancel: "Pas ça",
  chatExpired: "Cette proposition a expiré. Redis-moi ce que tu as mangé.",
  chatTooLong: "Ce message est trop long pour être envoyé.",
  chatRefusalNetwork: "Trop de demandes depuis ce réseau — pas toi, cette connexion. Réessaie plus tard.",
  chatRefusalGlobal: "Tout le monde a épuisé le quota du jour. Demain, on repart de zéro.",
  chatRefusalDay: "C'était le dernier pour aujourd'hui — ton quota quotidien se réinitialise à minuit.",
  chatNoFocusCorrection: "Aucun repas n'est ouvert ici à corriger. Ouvre-le dans l'app, ou dis ce que tu as mangé et enregistre-le à nouveau.",
  chatNoFocusRedate: "Aucun repas n'est ouvert ici à déplacer vers un autre jour. Ouvre-le dans l'app pour changer sa date.",
  chatNotOnboarded: "Réponds d'abord aux questions du plan.",
  chatRefusalSubscription: "Ce compte a déjà utilisé son analyse offerte. Lance ton essai gratuit pour continuer.",
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
  sameAccountHint: "Installe eait pour iPhone et choisis Se connecter avec {provider}. C'est le même compte — tes réponses et ton plan y sont déjà.",
  sameAccountHintGeneric: "Installe eait pour iPhone et connecte-toi comme tu l'as fait ici. C'est le même compte — tes réponses et ton plan y sont déjà.",
  continueLabel: "Continuer",
  answerRequired: "Cette question attend une réponse.",
  belowHealthyTarget: "Pour ta taille, l'objectif le plus bas qu'on puisse fixer est de {kg}kg.",
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
    offerWhenEnding: "Avant la fin",
  offerReminder: "On te le rappelle",
  offerWhenAfter: "Jour {n}",
  offerBilled: "Début de la facturation · résiliable quand tu veux",
    offerClose: "Fermer",
  titleOffer: "Ton essai gratuit",
  languageLabel: "Langue",
  languageSave: "Enregistrer",
  tooManyAttempts: "Trop de tentatives depuis cette adresse. Réessaie dans un moment.\n",
  chatRefusalIdentity: "Connecte-toi avec Apple ou Google pour continuer — l'écran d'inscription est juste avant.",
  titleEmail: "Connexion par e-mail",
  emailHeading: "Connexion par e-mail",
  emailLead: "On t'envoie un code à 6 chiffres par e-mail. Pas de mot de passe.",
  emailFieldLabel: "Ton adresse e-mail",
  emailSend: "Envoyer le code",
  emailBad: "Ça ne ressemble pas à une adresse e-mail.",
  emailTooMany: "Trop d'essais. Réessaie dans {min}.",
  emailMinutes: { one: "{n} minute", other: "{n} minutes" },
  emailCodeHeading: "Regarde ta boîte",
  emailCodeLead: "Entre le code à 6 chiffres envoyé à {email}. Il fonctionne pendant 10 minutes.",
  emailCodeLabel: "Le code à 6 chiffres",
  emailCodeWrong: "Ce n'est pas le bon code. Regarde le dernier e-mail d'eait.",
  emailCodeDead: "Ce code a expiré. Envoie-t'en un nouveau pour continuer.",
  emailCodeNew: "Envoyer un nouveau code",
  emailResendWait: "Renvoyer le code dans {time}",
  emailResend: "Renvoyer le code",
  emailDifferent: "Utiliser un autre e-mail",
  inviteTitle: "Une semaine d'eait offerte par un ami",
  inviteHeading: "Un ami t'offre une semaine d'eait",
  inviteLead: "Photographie un repas et vois ce qu'il contient. Rejoins eait avec ce lien et la semaine est à toi, gratuite, dès ton inscription.",
  inviteApp: "Télécharger l'app iPhone",
  inviteWeb: "Commencer sur le web",
  inviteCopied: "L'invitation {link} est copiée pour l'app.",
  referralAsk: "Un ami t'a envoyé un lien ?",
  referralLead: "Facultatif. Rejoins eait avec ce lien et ta première semaine d'eait est gratuite.",
  referralField: "Lien d'invitation d'un ami",
  referralSkip: "Passer",
  referralTryAgain: "Réessayer",
  referralApplied: "Invitation appliquée. Ta semaine gratuite commence maintenant.",
  referralUnknown: "Ce lien ne correspond à personne. Vérifie-le ou passe cette étape.",
  referralOwn: "C'est ton propre lien. Ici, c'est le lien d'un ami.",
  referralAlready: "Ce compte a déjà rejoint eait avec le lien d'un ami.",
  referralPaid: "Les liens d'invitation sont pour les nouveaux membres, et ce compte a déjà acheté eait.",
};

const DE: PageCopy = {
  frontDoorLead: "Richte dein Konto hier ein und öffne die App dann bereits angemeldet. Dauert etwa drei Minuten.",
  welcomeDemoAlt:
    "eait in Aktion: ein Foto einer Getreidebowl, drei Zutaten mit ihren kcal erkannt, und die Makros: {kcal}kcal, Kalorien im Plan",
  chatHeading: "Dein Chat",
  chatEmpty: "Hier ist noch nichts. Was du in der App sagst, taucht hier auf — und umgekehrt.",
  chatMealGone: "Diese Mahlzeit ist nicht mehr im Tagebuch.",
  chatPlaceholder: "Was hast du gegessen?",
  chatSend: "Senden",
  progress: "Frage {step} von {total}",
  back: "Zurück",
  spudAlt: "Spud, das eait-Maskottchen",
  cardMacros: "{kcal}{unit} · {protein}g Protein",
  chatProposalLead: "Ich trage das ein — passt das?",
  chatAMeal: "Eine Mahlzeit",
  chatConfirm: "Eintragen",
  chatCancel: "Nicht das",
  chatExpired: "Das ist abgelaufen. Sag es bitte noch einmal.",
  chatTooLong: "Diese Nachricht ist zu lang zum Senden.",
  chatRefusalNetwork: "Zu viele aus diesem Netz — nicht du, diese Verbindung. Versuch es später noch einmal.",
  chatRefusalGlobal: "Das Tageskontingent ist für alle aufgebraucht. Morgen geht's wieder von vorn los.",
  chatRefusalDay: "Das war heute dein letztes Foto — dein Tageskontingent wird um Mitternacht zurückgesetzt.",
  chatNoFocusCorrection: "Hier ist keine Mahlzeit offen, die sich korrigieren ließe. Öffne sie in der App, oder sag, was du gegessen hast, und trag es neu ein.",
  chatNoFocusRedate: "Hier ist keine Mahlzeit offen, die sich auf einen anderen Tag schieben ließe. Öffne sie in der App, um den Tag zu ändern.",
  chatNotOnboarded: "Beantworte zuerst die Planfragen.",
  chatRefusalSubscription: "Die kostenlose Testmahlzeit dieses Kontos ist verbraucht. Starte deine Testphase, um weiterzumachen.",
  chatRefusalFailed: "Da kam nichts zurück. Versuch es noch einmal.",
  chatRefusalNotFood: "Das sah nicht nach Essen aus.",
  chatRefusalImage: "Dieses Dateiformat geht hier nicht. Nimm JPEG, PNG oder WebP.",
  chatRefusalNoPhoto: "Wähl zuerst ein Foto.",
  chatTooMany: "Das sind mehr Blickwinkel, als eine Mahlzeit haben kann.",
  chatTooLarge: "Dieses Foto ist zu groß zum Senden.",
  chatPhotoLead: "Oder fotografier es",
  chatPhotoSend: "Foto senden",
  chatCaption: "Soll ich noch etwas wissen? (optional)",
  errorSignIn: "Diese Anmeldung ist nicht durchgegangen. Versuch es noch einmal.",
  sameAccountHint: "Installier eait fürs iPhone und wähl „Anmelden mit {provider}“. Es ist dasselbe Konto — deine Antworten und dein Plan liegen schon darauf.",
  sameAccountHintGeneric: "Installier eait fürs iPhone und melde dich so an wie hier. Es ist dasselbe Konto — deine Antworten und dein Plan liegen schon darauf.",
  continueLabel: "Weiter",
  answerRequired: "Diese Frage braucht eine Antwort.",
  belowHealthyTarget: "Das niedrigste Ziel, das wir für deine Größe planen können, sind {kg}kg.",
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
    offerWhenEnding: "Vor Ablauf",
  offerReminder: "Wir erinnern dich",
  offerWhenAfter: "Tag {n}",
  offerBilled: "Abrechnung beginnt · jederzeit kündbar",
    offerClose: "Schließen",
  titleOffer: "Deine Testphase",
  languageLabel: "Sprache",
  languageSave: "Speichern",
  tooManyAttempts: "Zu viele Versuche von dieser Adresse. Versuch es gleich noch einmal.\n",
  chatRefusalIdentity: "Melde dich mit Apple oder Google an, um weiterzumachen — der Anmeldeschirm ist einen Schritt zurück.",
  titleEmail: "Anmeldung per E-Mail",
  emailHeading: "Anmeldung per E-Mail",
  emailLead: "Wir schicken dir einen 6-stelligen Code per E-Mail. Kein Passwort.",
  emailFieldLabel: "Deine E-Mail-Adresse",
  emailSend: "Code senden",
  emailBad: "Das sieht nicht nach einer E-Mail-Adresse aus.",
  emailTooMany: "Zu viele Versuche. Versuch es in {min} erneut.",
  emailMinutes: { one: "{n} Minute", other: "{n} Minuten" },
  emailCodeHeading: "Schau in dein Postfach",
  emailCodeLead: "Gib den 6-stelligen Code ein, den wir an {email} geschickt haben. Er gilt 10 Minuten.",
  emailCodeLabel: "Der 6-stellige Code",
  emailCodeWrong: "Der Code stimmt nicht. Schau in die neueste E-Mail von eait.",
  emailCodeDead: "Dieser Code ist abgelaufen. Schick dir einen neuen, um weiterzumachen.",
  emailCodeNew: "Neuen Code senden",
  emailResendWait: "Code erneut senden in {time}",
  emailResend: "Code erneut senden",
  emailDifferent: "Andere E-Mail-Adresse verwenden",
  inviteTitle: "Eine Woche eait von Freunden",
  inviteHeading: "Jemand schenkt dir eine Woche eait",
  inviteLead: "Fotografier eine Mahlzeit und sieh, was drin ist. Melde dich mit diesem Link an, und die Woche gehört dir, kostenlos, ab dem Tag der Anmeldung.",
  inviteApp: "iPhone-App holen",
  inviteWeb: "Im Web starten",
  inviteCopied: "Die Einladung {link} ist für die App kopiert.",
  referralAsk: "Hat dir jemand einen Link geschickt?",
  referralLead: "Optional. Melde dich damit an, und deine erste Woche eait ist kostenlos.",
  referralField: "Einladungslink von Freunden",
  referralSkip: "Überspringen",
  referralTryAgain: "Noch mal",
  referralApplied: "Einladung angenommen. Deine kostenlose Woche beginnt jetzt.",
  referralUnknown: "Dieser Link passt zu niemandem. Prüf ihn oder überspring den Schritt.",
  referralOwn: "Das ist dein eigener Link. Hier gehört der Link von Freunden hin.",
  referralAlready: "Dieses Konto ist schon über einen Einladungslink beigetreten.",
  referralPaid: "Einladungslinks sind für neue Mitglieder, und dieses Konto hat eait schon gekauft.",
};

const IT: PageCopy = {
  frontDoorLead: "Prepara qui il tuo account, poi apri l'app: avrai già fatto l'accesso. Ci vogliono circa tre minuti.",
  welcomeDemoAlt:
    "eait in uso: la foto di una bowl di cereali, tre ingredienti letti con le loro kcal e i macro: {kcal}kcal, calorie nel piano",
  chatHeading: "La tua chat",
  chatEmpty: "Qui non c'è ancora niente. Quello che dici nell'app compare qui, e viceversa.",
  chatMealGone: "Quel pasto non è più nel diario.",
  chatPlaceholder: "Cosa hai mangiato?",
  chatSend: "Invia",
  progress: "Domanda {step} di {total}",
  back: "Indietro",
  spudAlt: "Spud, la mascotte di eait",
  cardMacros: "{kcal}{unit} · {protein}g di proteine",
  chatProposalLead: "Registro questo — ti torna?",
  chatAMeal: "Un pasto",
  chatConfirm: "Registra",
  chatCancel: "Non questo",
  chatExpired: "Questa proposta è scaduta. Ridimmelo.",
  chatTooLong: "Questo messaggio è troppo lungo da inviare.",
  chatRefusalNetwork: "Troppe richieste da questa rete — non sei tu, è questa connessione. Riprova più tardi.",
  chatRefusalGlobal: "Il limite di oggi è esaurito per tutti. Domani è un numero nuovo.",
  chatRefusalDay: "Quella era l'ultima di oggi — il tuo limite giornaliero riparte a mezzanotte.",
  chatNoFocusCorrection: "Qui non c'è nessun pasto aperto da correggere. Aprilo nell'app, oppure di' cosa hai mangiato e registralo di nuovo.",
  chatNoFocusRedate: "Qui non c'è nessun pasto aperto da spostare a un altro giorno. Aprilo nell'app per cambiarne la data.",
  chatNotOnboarded: "Prima rispondi alle domande del piano.",
  chatRefusalSubscription: "Hai già usato l'analisi gratuita di questo account. Inizia la tua prova gratuita per continuare.",
  chatRefusalFailed: "Nessuna risposta. Riprova.",
  chatRefusalNotFood: "Non sembrava cibo.",
  chatRefusalImage: "Quel file non è una foto leggibile qui. JPEG, PNG o WebP.",
  chatRefusalNoPhoto: "Scegli prima una foto.",
  chatTooMany: "Troppe angolazioni per un solo pasto.",
  chatTooLarge: "Quella foto è troppo grande da inviare.",
  chatPhotoLead: "Oppure fotografalo",
  chatPhotoSend: "Invia la foto",
  chatCaption: "C'è qualcosa che dovrei sapere? (facoltativo)",
  errorSignIn: "Quell'accesso non è andato a buon fine. Riprova.",
  sameAccountHint: "Installa eait per iPhone e scegli Accedi con {provider}. È lo stesso account — le tue risposte e il tuo piano ci sono già.",
  sameAccountHintGeneric: "Installa eait per iPhone e accedi come hai fatto qui. È lo stesso account — le tue risposte e il tuo piano ci sono già.",
  continueLabel: "Continua",
  answerRequired: "Questa ha bisogno di una risposta.",
  belowHealthyTarget: "L'obiettivo più basso che possiamo pianificare per la tua altezza è {kg}kg.",
  ageBelowMinimum: "Possiamo pianificare solo per adulti — controlla l'anno.",
  outOfRange: "Quel valore è fuori da ciò che possiamo pianificare. Riprova.",
  titleStart: "Inizia con eait",
  titlePlan: "Il tuo piano",
  titleChat: "Chat",
  stepperSuggested: "Peso obiettivo · suggerito",
  topBarNote: "Imposta sul web · finisci sul telefono quando vuoi",
  offerBeat: "Hai fatto la parte difficile",
  offerTitleElse: "Ogni pasto, valutato rispetto al tuo piano",
  offerPerkVerdict: "Macro onesti per ogni pasto",
  offerPerkPlan: "Il tuo piano si adatta al tuo peso",
  offerPerkSpud: "Spud, quando vuoi",
  offerWhenToday: "Oggi",
    offerWhenEnding: "Prima che finisca",
  offerReminder: "Ti avvisiamo noi",
  offerWhenAfter: "Giorno {n}",
  offerBilled: "Inizio dell'addebito · disdici quando vuoi",
    offerClose: "Chiudi",
  titleOffer: "La tua prova gratuita",
  languageLabel: "Lingua",
  languageSave: "Salva",
  tooManyAttempts: "Troppi tentativi da questo indirizzo. Riprova tra poco.\n",
  chatRefusalIdentity: "Accedi con Apple o Google per continuare — la schermata di registrazione è un passo indietro.",
  titleEmail: "Accesso con l'email",
  emailHeading: "Accedi con l'email",
  emailLead: "Ti mandiamo un codice a 6 cifre via email. Niente password.",
  emailFieldLabel: "La tua email",
  emailSend: "Invia il codice",
  emailBad: "Non sembra un indirizzo email.",
  emailTooMany: "Troppi tentativi. Riprova tra {min}.",
  emailMinutes: { one: "{n} minuto", other: "{n} minuti" },
  emailCodeHeading: "Controlla la posta",
  emailCodeLead: "Inserisci il codice a 6 cifre che abbiamo inviato a {email}. Funziona per 10 minuti.",
  emailCodeLabel: "Il codice a 6 cifre",
  emailCodeWrong: "Il codice non è giusto. Controlla l'ultima email di eait.",
  emailCodeDead: "Questo codice è scaduto. Fattone mandare uno nuovo per continuare.",
  emailCodeNew: "Invia un nuovo codice",
  emailResendWait: "Reinvia il codice tra {time}",
  emailResend: "Reinvia il codice",
  emailDifferent: "Usa un'altra email",
  inviteTitle: "Una settimana di eait da un amico",
  inviteHeading: "Un amico ti regala una settimana di eait",
  inviteLead: "Fotografa un pasto e scopri cosa contiene. Iscriviti con questo link e la settimana è tua, gratis, dal giorno in cui ti registri.",
  inviteApp: "Scarica l'app per iPhone",
  inviteWeb: "Inizia sul web",
  inviteCopied: "L'invito {link} è copiato per l'app.",
  referralAsk: "Un amico ti ha mandato un link?",
  referralLead: "Facoltativo. Iscriviti con questo link e la tua prima settimana di eait è gratis.",
  referralField: "Link d'invito di un amico",
  referralSkip: "Salta",
  referralTryAgain: "Riprova",
  referralApplied: "Invito applicato. La tua settimana gratis inizia ora.",
  referralUnknown: "Questo link non corrisponde a nessuno. Controllalo o salta il passaggio.",
  referralOwn: "Questo è il tuo link. Qui va il link di un amico.",
  referralAlready: "Questo account si è già iscritto con il link di un amico.",
  referralPaid: "I link d'invito sono per i nuovi iscritti, e questo account ha già acquistato eait.",
};

const ES: PageCopy = {
  frontDoorLead: "Prepara tu cuenta aquí y luego abre la app ya con la sesión iniciada. Son unos tres minutos.",
  welcomeDemoAlt:
    "eait en uso: la foto de un bowl de granos, tres ingredientes leídos con sus kcal y los macros: {kcal}kcal, calorías dentro del plan",
  chatHeading: "Tu chat",
  chatEmpty: "Aquí todavía no hay nada. Lo que dices en la app aparece aquí, y al revés.",
  chatMealGone: "Esa comida ya no está en el diario.",
  chatPlaceholder: "¿Qué has comido?",
  chatSend: "Enviar",
  progress: "Pregunta {step} de {total}",
  back: "Atrás",
  spudAlt: "Spud, la mascota de eait",
  cardMacros: "{kcal}{unit} · {protein}g de proteína",
  chatProposalLead: "Voy a registrar esto — ¿te cuadra?",
  chatAMeal: "Una comida",
  chatConfirm: "Registrar",
  chatCancel: "Esto no",
  chatExpired: "Ese ya no está en espera. Vuelve a decírmelo.",
  chatTooLong: "Ese mensaje es demasiado largo para enviarlo.",
  chatRefusalNetwork: "Demasiadas peticiones desde esta red — no eres tú, es esta conexión. Inténtalo más tarde.",
  chatRefusalGlobal: "El cupo de hoy se ha agotado para todos. Mañana es un número nuevo.",
  chatRefusalDay: "Esa fue la última de hoy — tu cupo diario se reinicia a medianoche.",
  chatNoFocusCorrection: "Aquí no hay ninguna comida abierta que corregir. Ábrela en la app, o di qué has comido y regístrala otra vez.",
  chatNoFocusRedate: "Aquí no hay ninguna comida abierta que mover a otro día. Ábrela en la app para cambiarle el día.",
  chatNotOnboarded: "Responde primero a las preguntas del plan.",
  chatRefusalSubscription: "Ya has usado el análisis gratis de esta cuenta. Empieza tu prueba gratis para seguir.",
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
  sameAccountHint: "Instala eait para iPhone y elige Iniciar sesión con {provider}. Es la misma cuenta — tus respuestas y tu plan ya están ahí.",
  sameAccountHintGeneric: "Instala eait para iPhone e inicia sesión igual que aquí. Es la misma cuenta — tus respuestas y tu plan ya están ahí.",
  continueLabel: "Continuar",
  answerRequired: "Esa necesita una respuesta.",
  belowHealthyTarget: "El objetivo más bajo que podemos planificar para tu altura es {kg}kg.",
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
    offerWhenEnding: "Antes de que termine",
  offerReminder: "Te avisamos",
  offerWhenAfter: "Día {n}",
  offerBilled: "Empieza el cobro · cancela cuando quieras",
    offerClose: "Cerrar",
  titleOffer: "Tu prueba gratis",
  languageLabel: "Idioma",
  languageSave: "Guardar",
  tooManyAttempts: "Demasiados intentos desde esta dirección. Inténtalo dentro de un momento.\n",
  chatRefusalIdentity: "Inicia sesión con Apple o Google para continuar — la pantalla de registro está a un paso.",
  titleEmail: "Acceso por correo",
  emailHeading: "Accede con tu correo",
  emailLead: "Te enviamos un código de 6 dígitos por correo. Sin contraseña.",
  emailFieldLabel: "Tu correo",
  emailSend: "Enviar código",
  emailBad: "Eso no parece una dirección de correo.",
  emailTooMany: "Demasiados intentos. Prueba de nuevo en {min}.",
  emailMinutes: { one: "{n} minuto", other: "{n} minutos" },
  emailCodeHeading: "Mira tu bandeja",
  emailCodeLead: "Escribe el código de 6 dígitos que enviamos a {email}. Funciona durante 10 minutos.",
  emailCodeLabel: "El código de 6 dígitos",
  emailCodeWrong: "El código no es correcto. Mira el último correo de eait.",
  emailCodeDead: "Este código ha caducado. Pide uno nuevo para continuar.",
  emailCodeNew: "Enviar un código nuevo",
  emailResendWait: "Reenviar el código en {time}",
  emailResend: "Reenviar el código",
  emailDifferent: "Usar otro correo",
  inviteTitle: "Una semana de eait de parte de un amigo",
  inviteHeading: "Un amigo te regala una semana de eait",
  inviteLead: "Fotografía una comida y mira lo que lleva. Únete con este enlace y la semana es tuya, gratis, desde el día en que te registres.",
  inviteApp: "Descargar la app para iPhone",
  inviteWeb: "Empezar en la web",
  inviteCopied: "La invitación {link} está copiada para la app.",
  referralAsk: "¿Te ha enviado un amigo un enlace?",
  referralLead: "Opcional. Únete con él y tu primera semana de eait es gratis.",
  referralField: "Enlace de invitación de un amigo",
  referralSkip: "Omitir",
  referralTryAgain: "Intentar de nuevo",
  referralApplied: "Invitación aplicada. Tu semana gratis empieza ahora.",
  referralUnknown: "Ese enlace no coincide con nadie. Revísalo u omítelo.",
  referralOwn: "Ese es tu propio enlace. Aquí va el enlace de un amigo.",
  referralAlready: "Esta cuenta ya se unió con el enlace de un amigo.",
  referralPaid: "Los enlaces de invitación son para miembros nuevos, y esta cuenta ya compró eait.",
};

const VI: PageCopy = {
  frontDoorLead: "Tạo tài khoản ở đây, rồi mở ứng dụng là đã đăng nhập sẵn. Mất khoảng ba phút.",
  welcomeDemoAlt:
    "eait đang dùng: ảnh một bát ngũ cốc, ba nguyên liệu được đọc kèm kcal, và macro: {kcal}kcal, calo đúng kế hoạch",
  chatHeading: "Khung chat của bạn",
  chatEmpty: "Ở đây chưa có gì. Những gì bạn nói trong ứng dụng sẽ hiện ở đây, và ngược lại.",
  chatMealGone: "Bữa đó không còn trong nhật ký nữa.",
  chatPlaceholder: "Bạn đã ăn gì?",
  chatSend: "Gửi",
  progress: "Câu hỏi {step}/{total}",
  back: "Quay lại",
  spudAlt: "Spud, linh vật của eait",
  cardMacros: "{kcal}{unit} · {protein}g đạm",
  chatProposalLead: "Mình ghi cái này nhé — có đúng không?",
  chatAMeal: "Một bữa ăn",
  chatConfirm: "Ghi lại",
  chatCancel: "Không phải",
  chatExpired: "Đề xuất đó đã hết hạn. Nói lại giúp mình nhé.",
  chatTooLong: "Tin nhắn này dài quá, không gửi được.",
  chatRefusalNetwork: "Quá nhiều lượt từ mạng này — không phải tại bạn, mà tại kết nối này. Thử lại sau nhé.",
  chatRefusalGlobal: "Hạn mức hôm nay đã hết cho tất cả mọi người. Mai lại là một con số mới.",
  chatRefusalDay: "Đó là lần cuối trong hôm nay — hạn mức mỗi ngày của bạn sẽ đặt lại lúc nửa đêm.",
  chatNoFocusCorrection: "Ở đây không có bữa nào đang mở để sửa. Mở nó trong ứng dụng, hoặc kể bạn đã ăn gì rồi ghi lại.",
  chatNoFocusRedate: "Ở đây không có bữa nào đang mở để chuyển sang ngày khác. Mở nó trong ứng dụng để đổi ngày.",
  chatNotOnboarded: "Hãy trả lời các câu hỏi lập kế hoạch trước.",
  chatRefusalSubscription: "Lượt phân tích miễn phí của tài khoản này đã hết. Bắt đầu dùng thử để tiếp tục.",
  chatRefusalFailed: "Chưa nhận được kết quả. Thử lại nhé.",
  chatRefusalNotFood: "Cái đó trông không giống đồ ăn.",
  chatRefusalImage: "Tệp đó không phải ảnh đọc được ở đây. JPEG, PNG hoặc WebP.",
  chatRefusalNoPhoto: "Chọn một tấm ảnh trước đã.",
  chatTooMany: "Một bữa ăn không thể có nhiều góc chụp đến vậy.",
  chatTooLarge: "Ảnh đó lớn quá, không gửi được.",
  chatPhotoLead: "Hoặc chụp ảnh nó",
  chatPhotoSend: "Gửi ảnh",
  chatCaption: "Có gì mình nên biết không? (không bắt buộc)",
  errorSignIn: "Lần đăng nhập đó chưa hòan tất. Thử lại nhé.",
  sameAccountHint: "Cài eait cho iPhone và chọn Đăng nhập bằng {provider}. Vẫn là tài khoản đó — câu trả lời và kế hoạch của bạn đã nằm sẵn trong đấy.",
  sameAccountHintGeneric: "Cài eait cho iPhone và đăng nhập đúng như bạn đã làm ở đây. Vẫn là tài khoản đó — câu trả lời và kế hoạch của bạn đã nằm sẵn trong đấy.",
  continueLabel: "Tiếp tục",
  answerRequired: "Bạn cần trả lời câu này.",
  belowHealthyTarget: "Mục tiêu thấp nhất chúng mình có thể lên kế hoạch cho chiều cao của bạn là {kg}kg.",
  ageBelowMinimum: "Chúng mình chỉ lên kế hoạch cho người trưởng thành — kiểm tra lại năm sinh nhé.",
  outOfRange: "Giá trị đó nằm ngoài phạm vi chúng mình có thể lên kế hoạch. Thử lại nhé.",
  titleStart: "Bắt đầu với eait",
  titlePlan: "Kế hoạch của bạn",
  titleChat: "Chat",
  stepperSuggested: "Cân nặng mục tiêu · gợi ý",
  topBarNote: "Thiết lập trên web · hoàn tất trên điện thoại lúc nào cũng được",
  offerBeat: "Bạn đã qua phần khó rồi",
  offerTitleElse: "Mỗi bữa ăn, so với kế hoạch của bạn",
  offerPerkVerdict: "Macro rõ ràng cho mỗi bữa ăn",
  offerPerkPlan: "Kế hoạch đổi theo cân nặng của bạn",
  offerPerkSpud: "Spud, bất cứ lúc nào bạn hỏi",
  offerWhenToday: "Hôm nay",
    offerWhenEnding: "Trước khi hết hạn",
  offerReminder: "Mình sẽ nhắc bạn",
  offerWhenAfter: "Ngày {n}",
  offerBilled: "Bắt đầu tính phí · hủy bất cứ lúc nào",
    offerClose: "Đóng",
  titleOffer: "Bản dùng thử của bạn",
  languageLabel: "Ngôn ngữ",
  languageSave: "Lưu",
  tooManyAttempts: "Quá nhiều lần thử từ địa chỉ này. Thử lại sau một lát nhé.\n",
  chatRefusalIdentity: "Đăng nhập bằng Apple hoặc Google để tiếp tục — màn hình đăng ký chỉ cách một bước.",
  titleEmail: "Đăng nhập bằng email",
  emailHeading: "Đăng nhập bằng email",
  emailLead: "Chúng tôi sẽ gửi mã 6 số qua email. Không cần mật khẩu.",
  emailFieldLabel: "Địa chỉ email của bạn",
  emailSend: "Gửi mã",
  emailBad: "Địa chỉ email này chưa đúng.",
  emailTooMany: "Thử quá nhiều lần. Thử lại sau {min}.",
  emailMinutes: { other: "{n} phút" },
  emailCodeHeading: "Kiểm tra hộp thư của bạn",
  emailCodeLead: "Nhập mã 6 số chúng tôi đã gửi đến {email}. Mã có hiệu lực trong 10 phút.",
  emailCodeLabel: "Mã 6 số",
  emailCodeWrong: "Mã chưa đúng. Kiểm tra email mới nhất từ eait.",
  emailCodeDead: "Mã này đã hết hạn. Gửi mã mới để tiếp tục.",
  emailCodeNew: "Gửi mã mới",
  emailResendWait: "Gửi lại mã sau {time}",
  emailResend: "Gửi lại mã",
  emailDifferent: "Dùng email khác",
  inviteTitle: "Một tuần eait từ bạn bè",
  inviteHeading: "Bạn bè tặng bạn một tuần eait",
  inviteLead: "Chụp một bữa ăn và xem trong đó có gì. Tham gia bằng liên kết này và tuần đó là của bạn, miễn phí, từ ngày bạn đăng ký.",
  inviteApp: "Tải ứng dụng iPhone",
  inviteWeb: "Bắt đầu trên web",
  inviteCopied: "Lời mời {link} đã được sao chép cho ứng dụng.",
  referralAsk: "Bạn bè có gửi cho bạn một liên kết không?",
  referralLead: "Không bắt buộc. Tham gia bằng liên kết này và tuần đầu tiên dùng eait của bạn được miễn phí.",
  referralField: "Liên kết mời của bạn bè",
  referralSkip: "Bỏ qua",
  referralTryAgain: "Thử lại",
  referralApplied: "Đã áp dụng lời mời. Tuần miễn phí của bạn bắt đầu từ bây giờ.",
  referralUnknown: "Liên kết này không khớp với ai. Hãy kiểm tra lại hoặc bỏ qua.",
  referralOwn: "Đây là liên kết của chính bạn. Hãy dán liên kết của bạn bè vào đây.",
  referralAlready: "Tài khoản này đã tham gia bằng liên kết của bạn bè.",
  referralPaid: "Liên kết mời dành cho thành viên mới, và tài khoản này đã mua eait.",
};

const ID: PageCopy = {
  frontDoorLead: "Siapkan akunmu di sini, lalu buka aplikasinya dalam keadaan sudah masuk. Perlu sekitar tiga menit.",
  welcomeDemoAlt:
    "eait sedang dipakai: foto semangkuk biji-bijian, tiga bahan terbaca dengan kcal-nya, dan makronya: {kcal}kcal, kalori sesuai rencana",
  chatHeading: "Chat-mu",
  chatEmpty: "Belum ada apa-apa di sini. Apa yang kamu tulis di aplikasi muncul di sini, dan sebaliknya.",
  chatMealGone: "Makanan itu sudah tidak ada di buku harian.",
  chatPlaceholder: "Kamu makan apa?",
  chatSend: "Kirim",
  progress: "Pertanyaan {step} dari {total}",
  back: "Kembali",
  spudAlt: "Spud, maskot eait",
  cardMacros: "{kcal}{unit} · {protein}g protein",
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
  chatRefusalSubscription: "Jatah gratis akun ini sudah habis. Mulai masa uji cobamu untuk melanjutkan.",
  chatRefusalFailed: "Hasilnya tidak masuk. Coba lagi.",
  chatRefusalNotFood: "Itu tidak kelihatan seperti makanan.",
  chatRefusalImage: "Berkas itu bukan foto yang bisa dibaca di sini. JPEG, PNG atau WebP.",
  chatRefusalNoPhoto: "Pilih fotonya dulu.",
  chatTooMany: "Satu makanan tidak bisa punya sudut sebanyak itu.",
  chatTooLarge: "Foto itu terlalu besar untuk dikirim.",
  chatPhotoLead: "Atau foto saja",
  chatPhotoSend: "Kirim fotonya",
  chatCaption: "Ada yang perlu aku tahu? (opsional)",
  errorSignIn: "Proses masuk itu tidak selesai. Coba lagi.",
  sameAccountHint: "Pasang eait untuk iPhone dan pilih Masuk dengan {provider}. Ini akun yang sama — jawaban dan rencanamu sudah ada di dalamnya.",
  sameAccountHintGeneric: "Pasang eait untuk iPhone dan masuk dengan cara yang sama seperti di sini. Ini akun yang sama — jawaban dan rencanamu sudah ada di dalamnya.",
  continueLabel: "Lanjut",
  answerRequired: "Yang ini butuh jawaban.",
  belowHealthyTarget: "Target terendah yang bisa kami rencanakan untuk tinggimu adalah {kg}kg.",
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
    offerWhenEnding: "Sebelum berakhir",
  offerReminder: "Kami ingatkan kamu",
  offerWhenAfter: "Hari ke-{n}",
  offerBilled: "Penagihan dimulai · batal kapan saja",
    offerClose: "Tutup",
  titleOffer: "Masa uji cobamu",
  languageLabel: "Bahasa",
  languageSave: "Simpan",
  tooManyAttempts: "Terlalu banyak percobaan dari alamat ini. Coba lagi sebentar.\n",
  chatRefusalIdentity: "Masuk dengan Apple atau Google untuk lanjut — layar pendaftaran ada satu langkah sebelumnya.",
  titleEmail: "Masuk dengan email",
  emailHeading: "Masuk dengan email",
  emailLead: "Kami kirimkan kode 6 digit ke email-mu. Tanpa kata sandi.",
  emailFieldLabel: "Alamat email-mu",
  emailSend: "Kirim kode",
  emailBad: "Itu bukan alamat email yang benar.",
  emailTooMany: "Terlalu banyak percobaan. Coba lagi dalam {min}.",
  emailMinutes: { other: "{n} menit" },
  emailCodeHeading: "Cek kotak masukmu",
  emailCodeLead: "Masukkan kode 6 digit yang kami kirim ke {email}. Kode ini berlaku 10 menit.",
  emailCodeLabel: "Kode 6 digit",
  emailCodeWrong: "Kodenya salah. Cek email terbaru dari eait.",
  emailCodeDead: "Kode ini sudah kedaluwarsa. Kirim kode baru untuk lanjut.",
  emailCodeNew: "Kirim kode baru",
  emailResendWait: "Kirim ulang kode dalam {time}",
  emailResend: "Kirim ulang kode",
  emailDifferent: "Pakai email lain",
  inviteTitle: "Seminggu eait dari teman",
  inviteHeading: "Temanmu mengirimimu seminggu eait",
  inviteLead: "Foto makananmu dan lihat isinya. Bergabung lewat tautan ini dan minggu itu milikmu, gratis, sejak hari kamu mendaftar.",
  inviteApp: "Unduh aplikasi iPhone",
  inviteWeb: "Mulai di web",
  inviteCopied: "Undangan {link} sudah disalin untuk aplikasi.",
  referralAsk: "Apakah ada teman yang mengirimimu tautan?",
  referralLead: "Opsional. Bergabung lewat tautan ini dan minggu pertamamu di eait gratis.",
  referralField: "Tautan undangan dari teman",
  referralSkip: "Lewati",
  referralTryAgain: "Coba lagi",
  referralApplied: "Undangan diterapkan. Minggu gratismu dimulai sekarang.",
  referralUnknown: "Tautan itu tidak cocok dengan siapa pun. Periksa lagi, atau lewati.",
  referralOwn: "Itu tautanmu sendiri. Tautan dari teman yang dimasukkan di sini.",
  referralAlready: "Akun ini sudah bergabung lewat tautan dari teman.",
  referralPaid: "Tautan undangan untuk anggota baru, dan akun ini sudah membeli eait.",
};

const RU: PageCopy = {
  frontDoorLead: "Заведи аккаунт здесь, а потом открой приложение — вход уже будет выполнен. Займёт минуты три.",
  welcomeDemoAlt:
    "eait в работе: фото боула, три ингредиента распознаны с ккал, и макросы: {kcal}ккал, калории в пределах плана",
  chatHeading: "Твой чат",
  chatEmpty: "Здесь пока пусто. Что ты говоришь в приложении, появляется тут, и наоборот.",
  chatMealGone: "Этого приёма пищи больше нет в дневнике.",
  chatPlaceholder: "Что было на тарелке?",
  chatSend: "Отправить",
  progress: "Вопрос {step} из {total}",
  back: "Назад",
  spudAlt: "Spud, талисман eait",
  cardMacros: "{kcal}{unit} · {protein}г белка",
  chatProposalLead: "Записываю вот это — всё верно?",
  chatAMeal: "Приём пищи",
  chatConfirm: "Записать",
  chatCancel: "Не это",
  chatExpired: "Время ожидания вышло. Напиши ещё раз.",
  chatTooLong: "Это сообщение слишком длинное, чтобы его отправить.",
  chatRefusalNetwork: "Слишком много из этой сети — дело не в тебе, а в соединении. Попробуй позже.",
  chatRefusalGlobal: "Общий лимит на сегодня исчерпан. Завтра он обнулится.",
  chatRefusalDay: "Это был последний анализ на сегодня — дневной лимит обнулится в полночь.",
  chatNoFocusCorrection: "Здесь нет открытого приёма пищи, который можно было бы поправить. Открой его в приложении или скажи, что было на тарелке, и запиши заново.",
  chatNoFocusRedate: "Здесь нет открытого приёма пищи, который можно было бы перенести на другой день. Открой его в приложении, чтобы поменять день.",
  chatNotOnboarded: "Сначала ответь на вопросы плана.",
  chatRefusalSubscription: "Бесплатный лимит этого аккаунта исчерпан. Начни пробный период, чтобы продолжить.",
  chatRefusalFailed: "Ответ не пришёл. Попробуй ещё раз.",
  chatRefusalNotFood: "Это не похоже на еду.",
  chatRefusalImage: "Этот формат не поддерживается. Нужен JPEG, PNG или WebP.",
  chatRefusalNoPhoto: "Сначала выбери фото.",
  chatTooMany: "Это больше ракурсов, чем может быть у одного приёма пищи.",
  chatTooLarge: "Это фото слишком большое для отправки.",
  chatPhotoLead: "Или сфотографируй",
  chatPhotoSend: "Отправить фото",
  chatCaption: "Есть что-то, что мне стоит знать? (необязательно)",
  errorSignIn: "Этот вход не завершился. Попробуй ещё раз.",
  sameAccountHint: "Установи eait для iPhone и выбери «Войти через {provider}». Это тот же аккаунт — твои ответы и план уже там.",
  sameAccountHintGeneric: "Установи eait для iPhone и войди так же, как здесь. Это тот же аккаунт — твои ответы и план уже там.",
  continueLabel: "Дальше",
  answerRequired: "На этот нужен ответ.",
  belowHealthyTarget: "Самая низкая цель, которую мы можем спланировать для твоего роста, — {kg}кг.",
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
    offerWhenEnding: "До конца пробного периода",
  offerReminder: "Мы напомним",
  offerWhenAfter: "День {n}",
  offerBilled: "Оплата начинается · отмена в любой момент",
    offerClose: "Закрыть",
  titleOffer: "Твой пробный период",
  languageLabel: "Язык",
  languageSave: "Сохранить",
  tooManyAttempts: "Слишком много попыток с этого адреса. Попробуй чуть позже.\n",
  chatRefusalIdentity: "Войди через Apple или Google, чтобы продолжить — экран регистрации — на шаг назад.",
  titleEmail: "Вход по e-mail",
  emailHeading: "Вход по e-mail",
  emailLead: "Мы пришлём код из 6 цифр на почту. Без пароля.",
  emailFieldLabel: "Твой e-mail",
  emailSend: "Отправить код",
  emailBad: "Это не похоже на адрес e-mail.",
  emailTooMany: "Слишком много попыток. Повтори через {min}.",
  emailMinutes: { one: "{n} минута", few: "{n} минуты", many: "{n} минут", other: "{n} минут" },
  emailCodeHeading: "Проверь почту",
  emailCodeLead: "Введи код из 6 цифр, который мы отправили на {email}. Он работает 10 минут.",
  emailCodeLabel: "Код из 6 цифр",
  emailCodeWrong: "Код не тот. Посмотри последнее письмо от eait.",
  emailCodeDead: "Срок действия кода истёк. Отправь новый, чтобы продолжить.",
  emailCodeNew: "Отправить новый код",
  emailResendWait: "Отправить код снова через {time}",
  emailResend: "Отправить код снова",
  emailDifferent: "Использовать другую почту",
  inviteTitle: "Неделя eait от друга",
  inviteHeading: "Друг дарит тебе неделю eait",
  inviteLead: "Сфотографируй еду и узнай, что в ней. Присоединяйся по этой ссылке, и неделя твоя, бесплатно, с того дня, как ты зарегистрируешься.",
  inviteApp: "Скачать приложение для iPhone",
  inviteWeb: "Начать в браузере",
  inviteCopied: "Приглашение {link} скопировано для приложения.",
  referralAsk: "Тебе прислали ссылку-приглашение?",
  referralLead: "Необязательно. Присоединись по этой ссылке, и первая неделя eait будет бесплатной.",
  referralField: "Ссылка-приглашение от друга",
  referralSkip: "Пропустить",
  referralTryAgain: "Попробовать ещё",
  referralApplied: "Приглашение принято. Твоя бесплатная неделя начинается сейчас.",
  referralUnknown: "Эта ссылка никому не принадлежит. Проверь её или пропусти шаг.",
  referralOwn: "Это твоя собственная ссылка. Сюда нужна ссылка друга.",
  referralAlready: "Этот аккаунт уже присоединился по ссылке друга.",
  referralPaid: "Ссылки-приглашения — для новых участников, а покупка eait на этом аккаунте уже есть.",
};

const NL: PageCopy = {
  frontDoorLead:
    "Stel hier je account in en open daarna de app, al ingelogd. Het duurt zo'n drie minuten.",
  welcomeDemoAlt:
    "eait in gebruik: een foto van een graanbowl, drie ingrediënten herkend met hun kcal, en de macro's: {kcal}kcal, calorieën binnen plan",
  chatHeading: "Je chat",
  chatEmpty: "Hier staat nog niets. Wat je in de app zegt, verschijnt hier, en andersom.",
  chatMealGone: "Die maaltijd staat niet meer in het dagboek.",
  chatPlaceholder: "Wat heb je gegeten?",
  chatSend: "Stuur",
  progress: "Vraag {step} van {total}",
  back: "Terug",
  spudAlt: "Spud, de mascotte van eait",
  cardMacros: "{kcal}{unit} · {protein}g eiwit",
  chatProposalLead: "Ik log dit — klopt het?",
  chatAMeal: "Een maaltijd",
  chatConfirm: "Log het",
  chatCancel: "Niet dit",
  chatExpired: "Die wordt niet meer vastgehouden. Zeg het nog een keer.",
  chatTooLong: "Dat bericht is te lang om te versturen.",
  chatRefusalNetwork: "Te veel vanaf dit netwerk — niet jij, deze verbinding. Probeer het later opnieuw.",
  chatRefusalGlobal: "Iedereen heeft het tegoed van vandaag gebruikt. Morgen begint de teller opnieuw.",
  chatRefusalDay: "Dat was je laatste van vandaag — je dagtegoed wordt om middernacht gereset.",
  chatNoFocusCorrection:
    "Er staat hier geen maaltijd open om te corrigeren. Open hem in de app, of zeg wat je hebt gegeten en log het opnieuw.",
  chatNoFocusRedate:
    "Er staat hier geen maaltijd open om naar een andere dag te verplaatsen. Open hem in de app om de dag te wijzigen.",
  chatNotOnboarded: "Beantwoord eerst de planvragen.",
  chatRefusalSubscription: "De gratis proef van dit account is op. Start je gratis proefperiode om door te gaan.",
  chatRefusalFailed: "Daar kwam niets op terug. Probeer het opnieuw.",
  chatRefusalNotFood: "Dat leek geen eten.",
  chatRefusalImage: "Dat bestand is geen foto die dit kan lezen. JPEG, PNG of WebP.",
  chatRefusalNoPhoto: "Kies eerst een foto.",
  chatTooMany: "Dat zijn meer hoeken dan één maaltijd kan hebben.",
  chatTooLarge: "Die foto is te groot om te versturen.",
  chatPhotoLead: "Of maak er een foto van",
  chatPhotoSend: "Stuur de foto",
  chatCaption: "Moet ik nog iets weten? (optioneel)",
  errorSignIn: "Die inlogpoging is niet afgerond. Probeer het opnieuw.",
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
  /** Three places want it and it was typed out in each. */
  continueLabel: "Verder",
  /** The one refusal `/start` words itself — the rest come from the engine's own tables. */
  answerRequired: "Deze heeft een antwoord nodig.",
  belowHealthyTarget: "Het laagste doel dat we voor jouw lengte kunnen plannen is {kg}kg.",
  ageBelowMinimum: "We kunnen alleen voor volwassenen plannen — check het jaar.",
  outOfRange: "Die waarde valt buiten wat we kunnen plannen. Probeer het opnieuw.",
  /** `<title>` per page. A browser tab in the wrong language is the first thing anybody sees. */
  titleStart: "Begin met eait",
  titlePlan: "Je plan",
  titleChat: "Chat",
  stepperSuggested: "Streefgewicht · voorgesteld",
  topBarNote: "Instellen op het web · rond af op je telefoon wanneer je wilt",
  offerBeat: "Het moeilijkste deel heb je gehad",
  offerTitleElse: "Elke maaltijd, afgezet tegen je plan",
  offerPerkVerdict: "Eerlijke macro's bij elke maaltijd",
  offerPerkPlan: "Je plan beweegt mee met je gewicht",
  offerPerkSpud: "Spud, wanneer je maar wilt",
  offerWhenToday: "Vandaag",
    offerWhenEnding: "Voordat het afloopt",
  offerReminder: "We herinneren je eraan",
  offerWhenAfter: "Dag {n}",
  offerBilled: "Betaling start · altijd opzegbaar",
    offerClose: "Sluit",
  titleOffer: "Start je gratis proefperiode",
  /** The picker. Its OPTIONS are `LANG_LABEL` — endonyms, never translated. */
  languageLabel: "Taal",
  languageSave: "Bewaar",
  tooManyAttempts: "Te veel pogingen vanaf dit adres. Probeer het zo opnieuw.\n",
  chatRefusalIdentity: "Log in met Apple of Google om door te gaan — het aanmeldscherm is één stap terug.",
  titleEmail: "Log in met e-mail",
  emailHeading: "Log in met e-mail",
  emailLead: "We mailen je een 6-cijferige code. Geen wachtwoord.",
  emailFieldLabel: "Je e-mailadres",
  emailSend: "Stuur code",
  emailBad: "Dat lijkt geen e-mailadres.",
  emailTooMany: "Te veel pogingen. Probeer het over {min} opnieuw.",
  emailMinutes: { one: "{n} minuut", other: "{n} minuten" },
  emailCodeHeading: "Check je inbox",
  emailCodeLead: "Voer de 6-cijferige code in die we naar {email} hebben gestuurd. Hij werkt 10 minuten.",
  emailCodeLabel: "De 6-cijferige code",
  emailCodeWrong: "Die code klopt niet. Check de nieuwste e-mail van eait.",
  emailCodeDead: "Deze code is verlopen. Stuur een nieuwe om door te gaan.",
  emailCodeNew: "Stuur een nieuwe code",
  emailResendWait: "Code opnieuw sturen over {time}",
  emailResend: "Code opnieuw sturen",
  emailDifferent: "Ander e-mailadres gebruiken",
  inviteTitle: "Een week eait van een vriend",
  inviteHeading: "Een vriend stuurde je een week eait",
  inviteLead: "Maak een foto van een maaltijd en zie wat erin zit. Meld je aan met deze link en de week is van jou, gratis, vanaf de dag dat je je aanmeldt.",
  inviteApp: "Download de iPhone-app",
  inviteWeb: "Begin op het web",
  inviteCopied: "Uitnodiging {link} is gekopieerd voor de app.",
  referralAsk: "Heeft een vriend je een link gestuurd?",
  referralLead: "Optioneel. Meld je ermee aan en je eerste week eait is gratis.",
  referralField: "Uitnodigingslink van een vriend",
  referralSkip: "Overslaan",
  referralTryAgain: "Probeer opnieuw",
  referralApplied: "Uitnodiging toegepast. Je gratis week begint nu.",
  referralUnknown: "Die link hoort bij niemand. Check hem, of sla over.",
  referralOwn: "Dat is je eigen link. Hier hoort de link van een vriend.",
  referralAlready: "Dit account is al aangemeld met de link van een vriend.",
  referralPaid: "Uitnodigingslinks zijn voor nieuwe leden, en dit account heeft eait al gekocht.",
};

const PL: PageCopy = {
  frontDoorLead:
    "Załóż konto tutaj, a potem otwórz aplikację już zalogowaną. Zajmie to około trzech minut.",
  welcomeDemoAlt:
    "eait w użyciu: zdjęcie miski z kaszą, trzy rozpoznane składniki z kcal i makroskładniki: {kcal}kcal, kalorie zgodne z planem",
  chatHeading: "Twój czat",
  chatEmpty: "Jeszcze nic tu nie ma. To, co piszesz w aplikacji, pojawia się tutaj, i na odwrót.",
  chatMealGone: "Tego posiłku nie ma już w dzienniku.",
  chatPlaceholder: "Co było na talerzu?",
  chatSend: "Wyślij",
  progress: "Pytanie {step} z {total}",
  back: "Wstecz",
  spudAlt: "Spud, maskotka eait",
  cardMacros: "{kcal}{unit} · {protein}g białka",
  chatProposalLead: "Zapisuję to — zgadza się?",
  chatAMeal: "Posiłek",
  chatConfirm: "Zapisz",
  chatCancel: "Nie to",
  chatExpired: "To już nie jest wstrzymane. Napisz jeszcze raz.",
  chatTooLong: "Ta wiadomość jest za długa, by ją wysłać.",
  chatRefusalNetwork: "Za dużo z tej sieci — to nie przez ciebie, tylko przez to połączenie. Spróbuj później.",
  chatRefusalGlobal: "Dzisiejszy wspólny limit się wyczerpał. Jutro licznik startuje od nowa.",
  chatRefusalDay: "To była twoja ostatnia analiza na dziś — dzienny limit odnawia się o północy.",
  chatNoFocusCorrection:
    "Nie ma tu otwartego posiłku do poprawienia. Otwórz go w aplikacji albo napisz, co było na talerzu, i zapisz ponownie.",
  chatNoFocusRedate:
    "Nie ma tu otwartego posiłku do przeniesienia na inny dzień. Otwórz go w aplikacji, aby zmienić dzień.",
  chatNotOnboarded: "Najpierw odpowiedz na pytania do planu.",
  chatRefusalSubscription: "Darmowa próbka tego konta została wykorzystana. Rozpocznij bezpłatny okres próbny, aby kontynuować.",
  chatRefusalFailed: "Odpowiedź nie dotarła. Spróbuj ponownie.",
  chatRefusalNotFood: "To nie wyglądało na jedzenie.",
  chatRefusalImage: "Tego pliku nie da się odczytać jako zdjęcia. JPEG, PNG lub WebP.",
  chatRefusalNoPhoto: "Najpierw wybierz zdjęcie.",
  chatTooMany: "To więcej ujęć, niż może mieć jeden posiłek.",
  chatTooLarge: "To zdjęcie jest za duże, by je wysłać.",
  chatPhotoLead: "Albo zrób zdjęcie",
  chatPhotoSend: "Wyślij zdjęcie",
  chatCaption: "Coś, o czym warto wiedzieć? (opcjonalnie)",
  errorSignIn: "Logowanie nie zostało ukończone. Spróbuj ponownie.",
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
  /** Three places want it and it was typed out in each. */
  continueLabel: "Dalej",
  /** The one refusal `/start` words itself — the rest come from the engine's own tables. */
  answerRequired: "To pytanie wymaga odpowiedzi.",
  belowHealthyTarget: "Najniższy cel, jaki możemy zaplanować dla twojego wzrostu, to {kg}kg.",
  ageBelowMinimum: "Planujemy tylko dla dorosłych — sprawdź rok.",
  outOfRange: "Ta wartość jest poza zakresem, dla którego możemy planować. Spróbuj ponownie.",
  /** `<title>` per page. A browser tab in the wrong language is the first thing anybody sees. */
  titleStart: "Zacznij z eait",
  titlePlan: "Twój plan",
  titleChat: "Czat",
  stepperSuggested: "Docelowa waga · sugerowana",
  topBarNote: "Konfiguracja w przeglądarce · dokończ na telefonie w dowolnej chwili",
  offerBeat: "Najtrudniejsze masz za sobą",
  offerTitleElse: "Każdy posiłek oceniony względem twojego planu",
  offerPerkVerdict: "Rzetelne makro przy każdym posiłku",
  offerPerkPlan: "Twój plan zmienia się razem z twoją wagą",
  offerPerkSpud: "Spud, kiedy tylko zapytasz",
  offerWhenToday: "Dziś",
    offerWhenEnding: "Przed końcem",
  offerReminder: "Przypomnimy ci",
  offerWhenAfter: "Dzień {n}",
  offerBilled: "Start płatności · anulujesz w każdej chwili",
    offerClose: "Zamknij",
  titleOffer: "Rozpocznij bezpłatny okres próbny",
  /** The picker. Its OPTIONS are `LANG_LABEL` — endonyms, never translated. */
  languageLabel: "Język",
  languageSave: "Zapisz",
  tooManyAttempts: "Zbyt wiele prób z tego adresu. Spróbuj ponownie za chwilę.\n",
  chatRefusalIdentity: "Zaloguj się przez Apple lub Google, aby kontynuować — ekran rejestracji jest krok wstecz.",
  titleEmail: "Zaloguj się e-mailem",
  emailHeading: "Zaloguj się e-mailem",
  emailLead: "Wyślemy ci 6-cyfrowy kod e-mailem. Bez hasła.",
  emailFieldLabel: "Twój adres e-mail",
  emailSend: "Wyślij kod",
  emailBad: "To nie wygląda na adres e-mail.",
  emailTooMany: "Zbyt wiele prób. Spróbuj ponownie za {min}.",
  emailMinutes: { one: "{n} minutę", other: "{n} min" },
  emailCodeHeading: "Sprawdź skrzynkę",
  emailCodeLead: "Wpisz 6-cyfrowy kod, który wysłaliśmy na {email}. Działa przez 10 minut.",
  emailCodeLabel: "6-cyfrowy kod",
  emailCodeWrong: "Ten kod jest nieprawidłowy. Sprawdź najnowszego e-maila od eait.",
  emailCodeDead: "Ten kod wygasł. Wyślij nowy, aby kontynuować.",
  emailCodeNew: "Wyślij nowy kod",
  emailResendWait: "Wyślij kod ponownie za {time}",
  emailResend: "Wyślij kod ponownie",
  emailDifferent: "Użyj innego e-maila",
  inviteTitle: "Tydzień eait od znajomych",
  inviteHeading: "Ktoś ze znajomych daje ci tydzień eait",
  inviteLead: "Zrób zdjęcie posiłku i zobacz, co w nim jest. Dołącz przez ten link, a tydzień jest twój, za darmo, od dnia rejestracji.",
  inviteApp: "Pobierz aplikację na iPhone'a",
  inviteWeb: "Zacznij w przeglądarce",
  inviteCopied: "Zaproszenie {link} skopiowane dla aplikacji.",
  referralAsk: "Masz link od znajomych?",
  referralLead: "Opcjonalnie. Dołącz przez niego, a pierwszy tydzień eait będzie darmowy.",
  referralField: "Link z zaproszeniem od znajomych",
  referralSkip: "Pomiń",
  referralTryAgain: "Spróbuj ponownie",
  referralApplied: "Zaproszenie przyjęte. Twój darmowy tydzień zaczyna się teraz.",
  referralUnknown: "Ten link do nikogo nie pasuje. Sprawdź go albo pomiń.",
  referralOwn: "To twój własny link. Tu wpisz link od znajomych.",
  referralAlready: "To konto już dołączyło przez link od znajomych.",
  referralPaid: "Linki z zaproszeniem są dla nowych osób, a na tym koncie eait już został kupiony.",
};

const TR: PageCopy = {
  frontDoorLead:
    "Hesabını burada kur, sonra uygulamayı giriş yapmış olarak aç. Yaklaşık üç dakika sürer.",
  welcomeDemoAlt:
    "eait kullanımda: bir tahıl kâsesinin fotoğrafı, kcal değerleriyle okunan üç malzeme ve makrolar: {kcal}kcal, kaloriler planda",
  chatHeading: "Sohbetin",
  chatEmpty: "Burada henüz bir şey yok. Uygulamada söylediklerin burada görünür, buradakiler de orada.",
  chatMealGone: "Bu öğün artık günlükte yok.",
  chatPlaceholder: "Ne yedin?",
  chatSend: "Gönder",
  progress: "Soru {step} / {total}",
  back: "Geri",
  spudAlt: "Spud, eait maskotu",
  cardMacros: "{kcal}{unit} · {protein}g protein",
  chatProposalLead: "Bunu kaydediyorum — doğru mu?",
  chatAMeal: "Bir öğün",
  chatConfirm: "Kaydet",
  chatCancel: "Bu değil",
  chatExpired: "Bu artık beklemede değil. Tekrar söyle.",
  chatTooLong: "Bu mesaj göndermek için çok uzun.",
  chatRefusalNetwork: "Bu ağdan çok fazla istek var — sen değil, bu bağlantı. Daha sonra tekrar dene.",
  chatRefusalGlobal: "Bugünün kotası herkes için doldu. Yarın sayaç sıfırlanır.",
  chatRefusalDay: "Bu bugünkü son hakkındı — günlük kotan gece yarısı sıfırlanır.",
  chatNoFocusCorrection:
    "Burada düzeltilecek açık bir öğün yok. Uygulamada aç ya da ne yediğini söyleyip yeniden kaydet.",
  chatNoFocusRedate:
    "Burada başka bir güne taşınacak açık bir öğün yok. Gününü değiştirmek için uygulamada aç.",
  chatNotOnboarded: "Önce plan sorularını yanıtla.",
  chatRefusalSubscription: "Bu hesabın ücretsiz denemesi bitti. Devam etmek için ücretsiz denemeni başlat.",
  chatRefusalFailed: "Yanıt gelmedi. Tekrar dene.",
  chatRefusalNotFood: "Bu yiyeceğe benzemiyordu.",
  chatRefusalImage: "Bu dosya burada okunabilen bir fotoğraf değil. JPEG, PNG veya WebP kullan.",
  chatRefusalNoPhoto: "Önce bir fotoğraf seç.",
  chatTooMany: "Bir öğün için bu kadar çok açı olamaz.",
  chatTooLarge: "Bu fotoğraf göndermek için çok büyük.",
  chatPhotoLead: "Ya da fotoğrafını çek",
  chatPhotoSend: "Fotoğrafı gönder",
  chatCaption: "Bilmem gereken bir şey var mı? (isteğe bağlı)",
  errorSignIn: "Giriş tamamlanmadı. Tekrar dene.",
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
  /** Three places want it and it was typed out in each. */
  continueLabel: "Devam",
  /** The one refusal `/start` words itself — the rest come from the engine's own tables. */
  answerRequired: "Bu sorunun yanıtlanması gerekiyor.",
  belowHealthyTarget: "Boyuna göre planlayabileceğimiz en düşük hedef {kg}kg.",
  ageBelowMinimum: "Yalnızca yetişkinler için plan yapabiliyoruz — yılı kontrol et.",
  outOfRange: "Bu değer planlayabileceğimiz aralığın dışında. Tekrar dene.",
  /** `<title>` per page. A browser tab in the wrong language is the first thing anybody sees. */
  titleStart: "eait ile başla",
  titlePlan: "Planın",
  titleChat: "Sohbet",
  stepperSuggested: "Hedef kilo · önerilen",
  topBarNote: "Web'de kur · istediğin zaman telefonunda bitir",
  offerBeat: "Zor kısmı hallettin",
  offerTitleElse: "Her öğün, planına göre değerlendirilir",
  offerPerkVerdict: "Her öğünde dürüst makrolar",
  offerPerkPlan: "Kilon değiştikçe planın da değişir",
  offerPerkSpud: "Spud, ne zaman istersen",
  offerWhenToday: "Bugün",
    offerWhenEnding: "Bitmeden önce",
  offerReminder: "Sana hatırlatırız",
  offerWhenAfter: "{n}. gün",
  offerBilled: "Ödeme başlar · istediğin zaman iptal et",
    offerClose: "Kapat",
  titleOffer: "Ücretsiz denemeni başlat",
  /** The picker. Its OPTIONS are `LANG_LABEL` — endonyms, never translated. */
  languageLabel: "Dil",
  languageSave: "Kaydet",
  tooManyAttempts: "Bu adresten çok fazla deneme yapıldı. Birazdan tekrar dene.\n",
  chatRefusalIdentity: "Devam etmek için Apple veya Google ile giriş yap — kayıt ekranı bir adım geride.",
  titleEmail: "E-postayla giriş yap",
  emailHeading: "E-postayla giriş yap",
  emailLead: "Sana 6 haneli bir kod e-postalayacağız. Şifre yok.",
  emailFieldLabel: "E-posta adresin",
  emailSend: "Kodu gönder",
  emailBad: "Bu bir e-posta adresine benzemiyor.",
  emailTooMany: "Çok fazla deneme. {min} sonra tekrar dene.",
  emailMinutes: { one: "{n} dakika", other: "{n} dakika" },
  emailCodeHeading: "Gelen kutunu kontrol et",
  emailCodeLead: "{email} adresine gönderdiğimiz 6 haneli kodu gir. Kod 10 dakika geçerli.",
  emailCodeLabel: "6 haneli kod",
  emailCodeWrong: "Bu kod doğru değil. eait'ten gelen en yeni e-postaya bak.",
  emailCodeDead: "Bu kodun süresi doldu. Devam etmek için yenisini gönder.",
  emailCodeNew: "Yeni kod gönder",
  emailResendWait: "Kodu tekrar gönder: {time}",
  emailResend: "Kodu tekrar gönder",
  emailDifferent: "Başka bir e-posta kullan",
  inviteTitle: "Bir arkadaştan bir hafta eait",
  inviteHeading: "Bir arkadaşın sana bir hafta eait gönderdi",
  inviteLead: "Bir öğünün fotoğrafını çek, içinde ne olduğunu gör. Bu bağlantıyla katıl; kaydolduğun günden itibaren bir hafta ücretsiz senin.",
  inviteApp: "iPhone uygulamasını indir",
  inviteWeb: "Web'de başla",
  inviteCopied: "{link} daveti uygulama için kopyalandı.",
  referralAsk: "Bir arkadaşın sana bağlantı mı gönderdi?",
  referralLead: "İsteğe bağlı. Onunla katıl, eait'teki ilk haftan ücretsiz olsun.",
  referralField: "Arkadaşının davet bağlantısı",
  referralSkip: "Atla",
  referralTryAgain: "Tekrar dene",
  referralApplied: "Davet uygulandı. Ücretsiz haftan şimdi başlıyor.",
  referralUnknown: "Bu bağlantı kimseyle eşleşmiyor. Kontrol et ya da atla.",
  referralOwn: "Bu senin kendi bağlantın. Buraya bir arkadaşının bağlantısı gelir.",
  referralAlready: "Bu hesap zaten bir arkadaş bağlantısıyla katıldı.",
  referralPaid: "Davet bağlantıları yeni üyeler içindir ve bu hesap eait'i zaten satın aldı.",
};

const ZH_HANT: PageCopy = {
  frontDoorLead:
    "在這裡設定好帳號，打開 App 時就已經登入了。大約需要三分鐘。",
  welcomeDemoAlt:
    "eait 使用畫面：一張穀物碗的照片，辨識出三種食材及其熱量，以及營養素：{kcal} 大卡，熱量符合計畫",
  chatHeading: "你的聊天",
  chatEmpty: "這裡還沒有內容。你在 App 裡說的話會出現在這裡，反之亦然。",
  chatMealGone: "這份餐點已不在日記中。",
  chatPlaceholder: "你吃了什麼？",
  chatSend: "傳送",
  progress: "第 {step} 題，共 {total} 題",
  back: "返回",
  spudAlt: "Spud，eait 的吉祥物",
  cardMacros: "{kcal}{unit} · 蛋白質 {protein} 公克",
  chatProposalLead: "我要記錄這個——對嗎？",
  chatAMeal: "一份餐點",
  chatConfirm: "記錄",
  chatCancel: "不是這個",
  chatExpired: "那則已經失效了，請再說一次。",
  chatTooLong: "這則訊息太長，無法傳送。",
  chatRefusalNetwork: "這個網路的請求太多了——不是你的問題，是這個連線。請稍後再試。",
  chatRefusalGlobal: "今天的額度大家都用完了。明天會重新計算。",
  chatRefusalDay: "這是你今天的最後一次——每日額度會在午夜重設。",
  chatNoFocusCorrection:
    "這裡沒有打開的餐點可以修正。請在 App 中打開它，或說說你吃了什麼再重新記錄。",
  chatNoFocusRedate:
    "這裡沒有打開的餐點可以移到其他日期。請在 App 中打開它來更改日期。",
  chatNotOnboarded: "請先回答計畫問題。",
  chatRefusalSubscription: "這個帳號的免費體驗已用完。開始免費試用即可繼續。",
  chatRefusalFailed: "沒有收到回應，請再試一次。",
  chatRefusalNotFood: "這看起來不像食物。",
  chatRefusalImage: "這個檔案不是可讀取的照片格式。請用 JPEG、PNG 或 WebP。",
  chatRefusalNoPhoto: "請先選擇一張照片。",
  chatTooMany: "一份餐點不會有這麼多角度。",
  chatTooLarge: "這張照片太大，無法傳送。",
  chatPhotoLead: "或拍張照",
  chatPhotoSend: "傳送照片",
  chatCaption: "有什麼我該知道的嗎？（選填）",
  errorSignIn: "登入沒有完成，請再試一次。",
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
  /** Three places want it and it was typed out in each. */
  continueLabel: "繼續",
  /** The one refusal `/start` words itself — the rest come from the engine's own tables. */
  answerRequired: "這題需要回答。",
  belowHealthyTarget: "以你的身高，我們能規劃的最低目標是 {kg} 公斤。",
  ageBelowMinimum: "我們只能為成年人規劃——請檢查年份。",
  outOfRange: "這個數值超出我們能規劃的範圍，請再試一次。",
  /** `<title>` per page. A browser tab in the wrong language is the first thing anybody sees. */
  titleStart: "開始使用 eait",
  titlePlan: "你的計畫",
  titleChat: "聊天",
  stepperSuggested: "目標體重 · 建議值",
  topBarNote: "在網頁上設定 · 隨時到手機上完成",
  offerBeat: "最難的部分你已經完成了",
  offerTitleElse: "每一餐都對照你的計畫",
  offerPerkVerdict: "每一餐都有誠實的營養素數據",
  offerPerkPlan: "你的計畫會隨體重調整",
  offerPerkSpud: "Spud 隨問隨答",
  offerWhenToday: "今天",
    offerWhenEnding: "結束之前",
  offerReminder: "我們會提醒你",
  offerWhenAfter: "第 {n} 天",
  offerBilled: "開始計費 · 可隨時取消",
    offerClose: "關閉",
  titleOffer: "開始免費試用",
  /** The picker. Its OPTIONS are `LANG_LABEL` — endonyms, never translated. */
  languageLabel: "語言",
  languageSave: "儲存",
  tooManyAttempts: "這個位址的嘗試次數太多，請稍後再試。\n",
  chatRefusalIdentity: "請使用 Apple 或 Google 登入以繼續——註冊畫面就在上一步。",
  titleEmail: "使用電子郵件登入",
  emailHeading: "使用電子郵件登入",
  emailLead: "我們會寄一組 6 位數驗證碼給你，不需要密碼。",
  emailFieldLabel: "你的電子郵件地址",
  emailSend: "傳送驗證碼",
  emailBad: "這看起來不像電子郵件地址。",
  emailTooMany: "嘗試次數太多，請在 {min}後再試。",
  emailMinutes: { one: "{n} 分鐘", other: "{n} 分鐘" },
  emailCodeHeading: "請查看收件匣",
  emailCodeLead: "輸入我們寄到 {email} 的 6 位數驗證碼，10 分鐘內有效。",
  emailCodeLabel: "6 位數驗證碼",
  emailCodeWrong: "驗證碼不正確，請查看 eait 寄來的最新一封郵件。",
  emailCodeDead: "這組驗證碼已過期，請重新傳送一組以繼續。",
  emailCodeNew: "傳送新的驗證碼",
  emailResendWait: "{time}後可重新傳送",
  emailResend: "重新傳送驗證碼",
  emailDifferent: "改用其他電子郵件",
  inviteTitle: "朋友送你一週 eait",
  inviteHeading: "有朋友送你一週 eait",
  inviteLead: "拍下一餐，看看裡面有什麼。用這個連結加入，從註冊當天起，這一週免費歸你。",
  inviteApp: "下載 iPhone App",
  inviteWeb: "從網頁開始",
  inviteCopied: "邀請 {link} 已複製，可在 App 中使用。",
  referralAsk: "有朋友傳連結給你嗎？",
  referralLead: "選填。用連結加入，第一週 eait 免費。",
  referralField: "朋友的邀請連結",
  referralSkip: "略過",
  referralTryAgain: "再試一次",
  referralApplied: "邀請已套用，你的免費週從現在開始。",
  referralUnknown: "這個連結找不到對應的人。請檢查一下，或略過。",
  referralOwn: "這是你自己的連結。這裡要填朋友的連結。",
  referralAlready: "這個帳號已經透過朋友的連結加入過了。",
  referralPaid: "邀請連結僅限新會員使用，而這個帳號已經購買過 eait。",
};

const ZH_HANS: PageCopy = {
  frontDoorLead:
    "先在这里设置账户，然后打开 App 就已经登录好了。大约需要三分钟。",
  welcomeDemoAlt:
    "eait 使用示例：一张谷物碗的照片，识别出三种食材及其千卡，以及宏量营养素：{kcal}千卡，热量在计划内",
  chatHeading: "你的聊天",
  chatEmpty: "这里还什么都没有。你在 App 里说的话会显示在这里，反之亦然。",
  chatMealGone: "这餐已经不在日记里了。",
  chatPlaceholder: "你吃了什么？",
  chatSend: "发送",
  progress: "第 {step} 题，共 {total} 题",
  back: "返回",
  spudAlt: "Spud，eait 的吉祥物",
  cardMacros: "{kcal}{unit} · 蛋白质 {protein}克",
  chatProposalLead: "准备记录这个——对吗？",
  chatAMeal: "一餐",
  chatConfirm: "记录",
  chatCancel: "不是这个",
  chatExpired: "这条已经不再保留了。再说一遍吧。",
  chatTooLong: "这条消息太长，发不出去。",
  chatRefusalNetwork: "来自这个网络的请求太多——不是你的问题，是这个连接的。稍后再试。",
  chatRefusalGlobal: "今天的总额度已经用完了。明天会重新计数。",
  chatRefusalDay: "这是你今天的最后一次——每日额度会在午夜重置。",
  chatNoFocusCorrection:
    "这里没有打开的餐食可以修改。在 App 里打开它，或者说说你吃了什么，重新记录。",
  chatNoFocusRedate:
    "这里没有打开的餐食可以移到别的日期。在 App 里打开它来更改日期。",
  chatNotOnboarded: "先回答计划相关的问题。",
  chatRefusalSubscription: "这个账户的免费体验已用完。开始免费试用即可继续。",
  chatRefusalFailed: "没有收到结果。再试一次。",
  chatRefusalNotFood: "这看起来不像食物。",
  chatRefusalImage: "这个文件不是能读取的照片。请用 JPEG、PNG 或 WebP。",
  chatRefusalNoPhoto: "先选一张照片。",
  chatTooMany: "一餐不可能有这么多角度。",
  chatTooLarge: "这张照片太大，发不出去。",
  chatPhotoLead: "或者拍张照",
  chatPhotoSend: "发送照片",
  chatCaption: "有什么我需要知道的吗？（可选）",
  errorSignIn: "登录没有完成。再试一次。",
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
  /** Three places want it and it was typed out in each. */
  continueLabel: "继续",
  /** The one refusal `/start` words itself — the rest come from the engine's own tables. */
  answerRequired: "这一题需要回答。",
  belowHealthyTarget: "按你的身高，我们能规划的最低目标是 {kg}公斤。",
  ageBelowMinimum: "我们只为成年人制定计划——检查一下年份。",
  outOfRange: "这个数值超出了我们能规划的范围。再试一次。",
  /** `<title>` per page. A browser tab in the wrong language is the first thing anybody sees. */
  titleStart: "从 eait 开始",
  titlePlan: "你的计划",
  titleChat: "聊天",
  stepperSuggested: "目标体重 · 建议值",
  topBarNote: "在网页上设置 · 随时在手机上完成",
  offerBeat: "最难的部分你已经完成了",
  offerTitleElse: "每一餐，都对照你的计划来评估",
  offerPerkVerdict: "每一餐都有如实的宏量营养素",
  offerPerkPlan: "你的体重变了，计划也跟着变",
  offerPerkSpud: "Spud，随问随答",
  offerWhenToday: "今天",
    offerWhenEnding: "试用结束前",
  offerReminder: "我们会提醒你",
  offerWhenAfter: "第 {n} 天",
  offerBilled: "开始计费 · 随时可取消",
    offerClose: "关闭",
  titleOffer: "开始免费试用",
  /** The picker. Its OPTIONS are `LANG_LABEL` — endonyms, never translated. */
  languageLabel: "语言",
  languageSave: "保存",
  tooManyAttempts: "来自这个地址的尝试次数太多。请稍后再试。\n",
  chatRefusalIdentity: "通过 Apple 或 Google 登录即可继续——注册页面就在上一步。",
  titleEmail: "用邮箱登录",
  emailHeading: "用邮箱登录",
  emailLead: "我们会给你发一个 6 位验证码。无需密码。",
  emailFieldLabel: "你的邮箱地址",
  emailSend: "发送验证码",
  emailBad: "这看起来不像邮箱地址。",
  emailTooMany: "尝试次数太多。请在 {min}后再试。",
  emailMinutes: { one: "{n} 分钟", other: "{n} 分钟" },
  emailCodeHeading: "查看你的收件箱",
  emailCodeLead: "输入我们发到 {email} 的 6 位验证码。10 分钟内有效。",
  emailCodeLabel: "6 位验证码",
  emailCodeWrong: "验证码不对。查看 eait 发来的最新邮件。",
  emailCodeDead: "验证码已过期。发送一个新的就能继续。",
  emailCodeNew: "发送新验证码",
  emailResendWait: "{time}后可重新发送",
  emailResend: "重新发送验证码",
  emailDifferent: "换个邮箱",
  inviteTitle: "好友送你一周 eait",
  inviteHeading: "好友送了你一周 eait",
  inviteLead: "拍下一餐，看看里面有什么。通过这个链接加入，从你注册那天起，这一周免费归你。",
  inviteApp: "下载 iPhone App",
  inviteWeb: "在网页上开始",
  inviteCopied: "邀请 {link} 已复制，可在 App 中使用。",
  referralAsk: "好友给你发过链接吗？",
  referralLead: "可选。通过它加入，你的第一周 eait 免费。",
  referralField: "好友的邀请链接",
  referralSkip: "跳过",
  referralTryAgain: "再试一次",
  referralApplied: "邀请已生效。你的免费周从现在开始。",
  referralUnknown: "这个链接没有匹配到任何人。检查一下，或者跳过。",
  referralOwn: "这是你自己的链接。这里要填好友的链接。",
  referralAlready: "这个账户已经通过好友链接加入过了。",
  referralPaid: "邀请链接仅限新成员使用，而这个账户已经购买过 eait。",
};

const KO: PageCopy = {
  frontDoorLead:
    "여기서 계정을 만든 다음, 로그인된 상태로 앱을 열어 보세요. 3분 정도 걸려요.",
  welcomeDemoAlt:
    "사용 중인 eait: 그레인 볼 사진, kcal와 함께 인식된 재료 세 가지, 그리고 매크로: {kcal}kcal, 칼로리는 플랜 범위 안",
  chatHeading: "내 채팅",
  chatEmpty: "아직 아무것도 없어요. 앱에서 한 말이 여기에 나타나고, 여기서 한 말도 앱에 나타나요.",
  chatMealGone: "이 식사는 더 이상 다이어리에 없어요.",
  chatPlaceholder: "무엇을 먹었나요?",
  chatSend: "보내기",
  progress: "질문 {step}/{total}",
  back: "뒤로",
  spudAlt: "eait 마스코트 Spud",
  cardMacros: "{kcal}{unit} · 단백질 {protein}g",
  chatProposalLead: "이렇게 기록할게요. 맞나요?",
  chatAMeal: "식사",
  chatConfirm: "기록하기",
  chatCancel: "이거 아니에요",
  chatExpired: "대기 시간이 지났어요. 다시 말해 주세요.",
  chatTooLong: "메시지가 너무 길어서 보낼 수 없어요.",
  chatRefusalNetwork: "이 네트워크에서 요청이 너무 많아요. 계정 문제가 아니라 이 연결의 문제예요. 나중에 다시 시도해 주세요.",
  chatRefusalGlobal: "오늘 전체 이용 한도가 모두 소진됐어요. 내일 새로 채워져요.",
  chatRefusalDay: "오늘 마지막 이용이었어요. 일일 한도는 자정에 초기화돼요.",
  chatNoFocusCorrection:
    "여기에는 수정할 식사가 열려 있지 않아요. 앱에서 열거나, 먹은 것을 말해서 다시 기록해 주세요.",
  chatNoFocusRedate:
    "여기에는 다른 날로 옮길 식사가 열려 있지 않아요. 날짜를 바꾸려면 앱에서 열어 주세요.",
  chatNotOnboarded: "먼저 플랜 질문에 답해 주세요.",
  chatRefusalSubscription: "이 계정의 무료 체험분을 모두 사용했어요. 계속하려면 무료 체험을 시작해 주세요.",
  chatRefusalFailed: "응답이 오지 않았어요. 다시 시도해 주세요.",
  chatRefusalNotFood: "음식처럼 보이지 않아요.",
  chatRefusalImage: "읽을 수 있는 사진 파일이 아니에요. JPEG, PNG, WebP를 사용해 주세요.",
  chatRefusalNoPhoto: "먼저 사진을 선택해 주세요.",
  chatTooMany: "식사 한 끼치고는 사진 각도가 너무 많아요.",
  chatTooLarge: "사진이 너무 커서 보낼 수 없어요.",
  chatPhotoLead: "또는 사진으로 찍기",
  chatPhotoSend: "사진 보내기",
  chatCaption: "알아 두면 좋을 게 있나요? (선택)",
  errorSignIn: "로그인이 완료되지 않았어요. 다시 시도해 주세요.",
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
  /** Three places want it and it was typed out in each. */
  continueLabel: "계속",
  /** The one refusal `/start` words itself — the rest come from the engine's own tables. */
  answerRequired: "이 질문에는 답이 필요해요.",
  belowHealthyTarget: "키를 기준으로 계획할 수 있는 가장 낮은 목표는 {kg}kg이에요.",
  ageBelowMinimum: "성인만 플랜을 세울 수 있어요. 출생 연도를 확인해 주세요.",
  outOfRange: "계획할 수 있는 범위를 벗어난 값이에요. 다시 시도해 주세요.",
  /** `<title>` per page. A browser tab in the wrong language is the first thing anybody sees. */
  titleStart: "eait 시작하기",
  titlePlan: "내 플랜",
  titleChat: "채팅",
  stepperSuggested: "목표 체중 · 추천",
  topBarNote: "웹에서 설정 · 언제든 휴대폰에서 마무리",
  offerBeat: "어려운 부분은 끝났어요",
  offerTitleElse: "모든 식사를 내 플랜에 맞춰 평가해요",
  offerPerkVerdict: "모든 식사에 정직한 매크로",
  offerPerkPlan: "체중이 바뀌면 플랜도 바뀌어요",
  offerPerkSpud: "물어보면 언제든 답하는 Spud",
  offerWhenToday: "오늘",
    offerWhenEnding: "종료 전",
  offerReminder: "알림을 보내 드려요",
  offerWhenAfter: "{n}일차",
  offerBilled: "결제 시작 · 언제든 취소 가능",
    offerClose: "닫기",
  titleOffer: "무료 체험 시작하기",
  /** The picker. Its OPTIONS are `LANG_LABEL` — endonyms, never translated. */
  languageLabel: "언어",
  languageSave: "저장",
  tooManyAttempts: "이 주소에서 시도가 너무 많아요. 잠시 후 다시 시도해 주세요.\n",
  chatRefusalIdentity: "계속하려면 Apple 또는 Google로 로그인해 주세요. 가입 화면은 한 단계 전에 있어요.",
  titleEmail: "이메일로 로그인",
  emailHeading: "이메일로 로그인",
  emailLead: "6자리 코드를 이메일로 보내 드려요. 비밀번호는 필요 없어요.",
  emailFieldLabel: "이메일 주소",
  emailSend: "코드 보내기",
  emailBad: "이메일 주소 형식이 아닌 것 같아요.",
  emailTooMany: "시도 횟수가 너무 많아요. {min} 후에 다시 시도해 주세요.",
  emailMinutes: { one: "{n}분", other: "{n}분" },
  emailCodeHeading: "받은편지함을 확인해 주세요",
  emailCodeLead: "{email}(으)로 보낸 6자리 코드를 입력해 주세요. 코드는 10분 동안 유효해요.",
  emailCodeLabel: "6자리 코드",
  emailCodeWrong: "코드가 맞지 않아요. eait에서 보낸 가장 최근 이메일을 확인해 주세요.",
  emailCodeDead: "코드가 만료됐어요. 계속하려면 새 코드를 받아 주세요.",
  emailCodeNew: "새 코드 보내기",
  emailResendWait: "{time} 후 코드 재전송",
  emailResend: "코드 재전송",
  emailDifferent: "다른 이메일 사용",
  inviteTitle: "친구가 보낸 eait 일주일",
  inviteHeading: "친구가 eait 일주일을 선물했어요",
  inviteLead: "식사를 찍으면 무엇이 들었는지 알 수 있어요. 이 링크로 가입하면 가입한 날부터 일주일을 무료로 쓸 수 있어요.",
  inviteApp: "iPhone 앱 받기",
  inviteWeb: "웹에서 시작하기",
  inviteCopied: "앱에서 쓸 초대 링크를 복사했어요: {link}",
  referralAsk: "친구에게 링크를 받았나요?",
  referralLead: "선택 사항이에요. 이 링크로 가입하면 eait 첫 주가 무료예요.",
  referralField: "친구의 초대 링크",
  referralSkip: "건너뛰기",
  referralTryAgain: "다시 시도",
  referralApplied: "초대가 적용됐어요. 지금부터 무료 1주가 시작돼요.",
  referralUnknown: "일치하는 사용자가 없는 링크예요. 확인하거나 건너뛰어 주세요.",
  referralOwn: "내 링크예요. 여기에는 친구의 링크를 넣어 주세요.",
  referralAlready: "이 계정은 이미 친구 링크로 가입했어요.",
  referralPaid: "초대 링크는 신규 회원용인데, 이 계정은 이미 eait 구매 내역이 있어요.",
};

const JA: PageCopy = {
  frontDoorLead:
    "ここでアカウントを設定すれば、アプリを開いたときにはサインイン済みです。所要時間は3分ほどです。",
  welcomeDemoAlt:
    "eaitの使用例：グレインボウルの写真、読み取った3つの食材とそれぞれのkcal、マクロ栄養素：{kcal}kcal、カロリーはプラン通り",
  chatHeading: "あなたのチャット",
  chatEmpty: "まだ何もありません。アプリで話したことがここに表示され、ここで話したこともアプリに表示されます。",
  chatMealGone: "その食事はもう日記にありません。",
  chatPlaceholder: "何を食べましたか？",
  chatSend: "送信",
  progress: "質問 {step}/{total}",
  back: "戻る",
  spudAlt: "eaitのマスコット、Spud",
  cardMacros: "{kcal}{unit} · タンパク質{protein}g",
  chatProposalLead: "これで記録します。合っていますか？",
  chatAMeal: "食事",
  chatConfirm: "記録する",
  chatCancel: "違います",
  chatExpired: "その内容は保留期限が切れました。もう一度入力してください。",
  chatTooLong: "メッセージが長すぎて送信できません。",
  chatRefusalNetwork: "このネットワークからの利用が多すぎます。あなたではなく、この接続の問題です。後でもう一度お試しください。",
  chatRefusalGlobal: "今日の利用枠は全体で使い切られました。明日またリセットされます。",
  chatRefusalDay: "今日はこれが最後でした。1日の利用枠は午前0時にリセットされます。",
  chatNoFocusCorrection:
    "ここには修正できる食事が開かれていません。アプリで開くか、食べたものを伝えてもう一度記録してください。",
  chatNoFocusRedate:
    "ここには別の日に移動できる食事が開かれていません。日付を変更するにはアプリで開いてください。",
  chatNotOnboarded: "まずプランの質問に答えてください。",
  chatRefusalSubscription: "このアカウントの無料お試しは使い切りました。続けるには無料トライアルを開始してください。",
  chatRefusalFailed: "応答がありませんでした。もう一度お試しください。",
  chatRefusalNotFood: "食べ物には見えませんでした。",
  chatRefusalImage: "このファイルは読み込める写真ではありません。JPEG、PNG、WebPを使ってください。",
  chatRefusalNoPhoto: "まず写真を選んでください。",
  chatTooMany: "1つの食事としては写真が多すぎます。",
  chatTooLarge: "写真が大きすぎて送信できません。",
  chatPhotoLead: "または写真を撮る",
  chatPhotoSend: "写真を送信",
  chatCaption: "伝えておきたいことはありますか？（任意）",
  errorSignIn: "サインインが完了しませんでした。もう一度お試しください。",
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
  /** Three places want it and it was typed out in each. */
  continueLabel: "続ける",
  /** The one refusal `/start` words itself — the rest come from the engine's own tables. */
  answerRequired: "この質問には回答が必要です。",
  belowHealthyTarget: "あなたの身長で設定できる最も低い目標は{kg}kgです。",
  ageBelowMinimum: "プランは成人のみ対象です。生まれた年を確認してください。",
  outOfRange: "その値はプランを作成できる範囲外です。もう一度お試しください。",
  /** `<title>` per page. A browser tab in the wrong language is the first thing anybody sees. */
  titleStart: "eaitを始める",
  titlePlan: "あなたのプラン",
  titleChat: "チャット",
  stepperSuggested: "目標体重 · おすすめ",
  topBarNote: "Webで設定 · 続きはいつでもスマホで",
  offerBeat: "大変なところはもう終わりました",
  offerTitleElse: "すべての食事をプランに照らして判定",
  offerPerkVerdict: "どの食事も正直なマクロ栄養素",
  offerPerkPlan: "体重が変わればプランも変わる",
  offerPerkSpud: "Spudにいつでも質問できる",
  offerWhenToday: "今日",
    offerWhenEnding: "終了前に",
  offerReminder: "お知らせします",
  offerWhenAfter: "{n}日目",
  offerBilled: "課金開始 · いつでも解約可能",
    offerClose: "閉じる",
  titleOffer: "無料トライアルを始める",
  /** The picker. Its OPTIONS are `LANG_LABEL` — endonyms, never translated. */
  languageLabel: "言語",
  languageSave: "保存",
  tooManyAttempts: "このアドレスからの試行が多すぎます。少ししてからもう一度お試しください。\n",
  chatRefusalIdentity: "続けるにはAppleまたはGoogleでサインインしてください。登録画面は1つ前のステップにあります。",
  titleEmail: "メールでサインイン",
  emailHeading: "メールでサインイン",
  emailLead: "6桁のコードをメールでお送りします。パスワードは不要です。",
  emailFieldLabel: "メールアドレス",
  emailSend: "コードを送信",
  emailBad: "メールアドレスの形式ではないようです。",
  emailTooMany: "試行回数が多すぎます。{min}後にもう一度お試しください。",
  emailMinutes: { one: "{n}分", other: "{n}分" },
  emailCodeHeading: "受信トレイを確認してください",
  emailCodeLead: "{email}に送信した6桁のコードを入力してください。有効期限は10分です。",
  emailCodeLabel: "6桁のコード",
  emailCodeWrong: "コードが正しくありません。eaitからの最新のメールを確認してください。",
  emailCodeDead: "このコードは有効期限が切れています。続けるには新しいコードを送信してください。",
  emailCodeNew: "新しいコードを送信",
  emailResendWait: "{time}後にコードを再送信",
  emailResend: "コードを再送信",
  emailDifferent: "別のメールアドレスを使う",
  inviteTitle: "友だちからeaitを1週間",
  inviteHeading: "友だちからeaitの1週間が届きました",
  inviteLead: "食事を撮影すると、何が入っているかわかります。このリンクで登録すれば、登録した日から1週間無料で使えます。",
  inviteApp: "iPhoneアプリを入手",
  inviteWeb: "Webで始める",
  inviteCopied: "招待{link}をアプリ用にコピーしました。",
  referralAsk: "友だちからリンクが届きましたか？",
  referralLead: "任意です。そのリンクで登録すると、eaitの最初の1週間が無料になります。",
  referralField: "友だちの招待リンク",
  referralSkip: "スキップ",
  referralTryAgain: "もう一度試す",
  referralApplied: "招待が適用されました。無料の1週間が今から始まります。",
  referralUnknown: "このリンクに該当する人が見つかりません。確認するか、スキップしてください。",
  referralOwn: "これはあなた自身のリンクです。ここには友だちのリンクを入力してください。",
  referralAlready: "このアカウントはすでに友だちのリンクで登録済みです。",
  referralPaid: "招待リンクは新規メンバー向けです。このアカウントはすでにeaitを購入しています。",
};

const PT_BR: PageCopy = {
  frontDoorLead:
    "Crie sua conta aqui e depois abra o app já com login feito. Leva uns três minutos.",
  welcomeDemoAlt:
    "eait em uso: foto de um bowl de grãos, três ingredientes lidos com suas kcal e os macros: {kcal}kcal, calorias dentro do plano",
  chatHeading: "Seu chat",
  chatEmpty: "Nada aqui ainda. O que você diz no app aparece aqui, e vice-versa.",
  chatMealGone: "Essa refeição não está mais no diário.",
  chatPlaceholder: "O que você comeu?",
  chatSend: "Enviar",
  progress: "Pergunta {step} de {total}",
  back: "Voltar",
  spudAlt: "Spud, o mascote do eait",
  cardMacros: "{kcal}{unit} · {protein}g de proteína",
  chatProposalLead: "Vou registrar isto — está certo?",
  chatAMeal: "Uma refeição",
  chatConfirm: "Registrar",
  chatCancel: "Não é isso",
  chatExpired: "Essa já não está mais guardada. Diga de novo.",
  chatTooLong: "Essa mensagem é longa demais para enviar.",
  chatRefusalNetwork: "Pedidos demais desta rede — não é você, é esta conexão. Tente de novo mais tarde.",
  chatRefusalGlobal: "Todo mundo já usou a cota de hoje. Amanhã o número recomeça.",
  chatRefusalDay: "Essa foi a última de hoje — sua cota diária renova à meia-noite.",
  chatNoFocusCorrection:
    "Não há nenhuma refeição aberta aqui para corrigir. Abra-a no app, ou diga o que comeu e registre de novo.",
  chatNoFocusRedate:
    "Não há nenhuma refeição aberta aqui para mudar de dia. Abra-a no app para trocar o dia.",
  chatNotOnboarded: "Responda primeiro às perguntas do plano.",
  chatRefusalSubscription: "A amostra grátis desta conta acabou. Comece seu teste grátis para continuar.",
  chatRefusalFailed: "Não veio resposta. Tente de novo.",
  chatRefusalNotFood: "Isso não parecia comida.",
  chatRefusalImage: "Esse arquivo não é uma foto que dá para ler aqui. JPEG, PNG ou WebP.",
  chatRefusalNoPhoto: "Escolha uma foto primeiro.",
  chatTooMany: "Isso é mais ângulos do que uma refeição pode ter.",
  chatTooLarge: "Essa foto é grande demais para enviar.",
  chatPhotoLead: "Ou fotografe",
  chatPhotoSend: "Enviar a foto",
  chatCaption: "Algo que eu deva saber? (opcional)",
  errorSignIn: "Esse login não foi concluído. Tente de novo.",
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
  /** Three places want it and it was typed out in each. */
  continueLabel: "Continuar",
  /** The one refusal `/start` words itself — the rest come from the engine's own tables. */
  answerRequired: "Essa precisa de uma resposta.",
  belowHealthyTarget: "A meta mais baixa que podemos planejar para a sua altura é {kg}kg.",
  ageBelowMinimum: "Só podemos montar planos para adultos — confira o ano.",
  outOfRange: "Esse valor está fora do que podemos planejar. Tente de novo.",
  /** `<title>` per page. A browser tab in the wrong language is the first thing anybody sees. */
  titleStart: "Comece com o eait",
  titlePlan: "Seu plano",
  titleChat: "Chat",
  stepperSuggested: "Peso-meta · sugerido",
  topBarNote: "Configure na web · termine no celular quando quiser",
  offerBeat: "A parte difícil você já fez",
  offerTitleElse: "Cada refeição, avaliada pelo seu plano",
  offerPerkVerdict: "Macros honestos em cada refeição",
  offerPerkPlan: "Seu plano muda quando seu peso muda",
  offerPerkSpud: "Spud, sempre que você pedir",
  offerWhenToday: "Hoje",
    offerWhenEnding: "Antes de acabar",
  offerReminder: "A gente te lembra",
  offerWhenAfter: "Dia {n}",
  offerBilled: "A cobrança começa · cancele quando quiser",
    offerClose: "Fechar",
  titleOffer: "Comece seu teste grátis",
  /** The picker. Its OPTIONS are `LANG_LABEL` — endonyms, never translated. */
  languageLabel: "Idioma",
  languageSave: "Salvar",
  tooManyAttempts: "Tentativas demais deste endereço. Tente de novo em instantes.\n",
  chatRefusalIdentity: "Entre com Apple ou Google para continuar — a tela de cadastro está um passo atrás.",
  titleEmail: "Entrar com e-mail",
  emailHeading: "Entrar com e-mail",
  emailLead: "Vamos te mandar um código de 6 dígitos por e-mail. Sem senha.",
  emailFieldLabel: "Seu endereço de e-mail",
  emailSend: "Enviar código",
  emailBad: "Isso não parece um endereço de e-mail.",
  emailTooMany: "Tentativas demais. Tente de novo em {min}.",
  emailMinutes: { one: "{n} minuto", other: "{n} minutos" },
  emailCodeHeading: "Confira sua caixa de entrada",
  emailCodeLead: "Digite o código de 6 dígitos que enviamos para {email}. Ele vale por 10 minutos.",
  emailCodeLabel: "O código de 6 dígitos",
  emailCodeWrong: "Esse código não está certo. Veja o e-mail mais recente do eait.",
  emailCodeDead: "Este código expirou. Peça um novo para continuar.",
  emailCodeNew: "Enviar um novo código",
  emailResendWait: "Reenviar código em {time}",
  emailResend: "Reenviar código",
  emailDifferent: "Usar outro e-mail",
  inviteTitle: "Uma semana de eait de um amigo",
  inviteHeading: "Um amigo te deu uma semana de eait",
  inviteLead: "Fotografe uma refeição e veja o que tem nela. Entre com este link e a semana é sua, grátis, a partir do dia do cadastro.",
  inviteApp: "Baixar o app para iPhone",
  inviteWeb: "Começar na web",
  inviteCopied: "O convite {link} foi copiado para o app.",
  referralAsk: "Um amigo te mandou um link?",
  referralLead: "Opcional. Entre com ele e sua primeira semana de eait é grátis.",
  referralField: "Link de convite do amigo",
  referralSkip: "Pular",
  referralTryAgain: "Tentar de novo",
  referralApplied: "Convite aplicado. Sua semana grátis começa agora.",
  referralUnknown: "Esse link não corresponde a ninguém. Confira ou pule.",
  referralOwn: "Esse é o seu próprio link. Aqui vai o link de um amigo.",
  referralAlready: "Esta conta já entrou com o link de um amigo.",
  referralPaid: "Links de convite são para novos membros, e esta conta já comprou o eait.",
};

/** Every sentence `/start` writes for itself, keyed by language. */
export const PAGE_COPY_BY_LANG: Localized<PageCopy> = {
  en: EN, fr: FR, de: DE, it: IT, es: ES, vi: VI, id: ID, ru: RU, nl: NL, pl: PL, tr: TR, "zh-Hant": ZH_HANT, "zh-Hans": ZH_HANS, ko: KO, ja: JA, "pt-BR": PT_BR,
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
