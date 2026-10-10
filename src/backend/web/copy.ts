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
  referralLead: "Optional. Join with it and you both get a week of eait free.",
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
  errorPair: "Ce code n'a pas marché. Un code marche une fois, et seulement cinq minutes après sa création.",
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
  referralLead: "Facultatif. Rejoins eait avec et vous recevez chacun une semaine d'eait gratuite.",
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
  errorPair: "Dieser Code hat nicht funktioniert. Ein Code gilt einmal und nur fünf Minuten nach seiner Erzeugung.",
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
  referralLead: "Optional. Meld dich damit an, und ihr bekommt beide eine Woche eait kostenlos.",
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
  errorPair: "Quel codice non ha funzionato. Un codice vale una volta sola, e solo per cinque minuti da quando è stato creato.",
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
  referralLead: "Facoltativo. Iscriviti con quello e ricevete entrambi una settimana di eait gratis.",
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
  errorPair: "Ese código no funcionó. Un código vale una vez, y solo durante cinco minutos desde que se crea.",
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
  referralLead: "Opcional. Únete con él y los dos recibís una semana de eait gratis.",
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
  errorPair: "Mã đó không dùng được. Mỗi mã chỉ dùng một lần, và chỉ trong năm phút kể từ khi tạo.",
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
  referralLead: "Không bắt buộc. Tham gia bằng liên kết đó và cả hai đều được một tuần eait miễn phí.",
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
  errorPair: "Kode itu tidak berhasil. Kode berlaku sekali, dan hanya lima menit setelah dibuat.",
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
  referralLead: "Opsional. Bergabung lewat tautan itu dan kalian berdua mendapat seminggu eait gratis.",
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
  errorPair: "Этот код не сработал. Код работает один раз и только пять минут после создания.",
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
  referralAsk: "Друг прислал тебе ссылку?",
  referralLead: "Необязательно. Присоединись по ней, и вы оба получите неделю eait бесплатно.",
  referralField: "Ссылка-приглашение от друга",
  referralSkip: "Пропустить",
  referralTryAgain: "Попробовать ещё",
  referralApplied: "Приглашение принято. Твоя бесплатная неделя начинается сейчас.",
  referralUnknown: "Эта ссылка никому не принадлежит. Проверь её или пропусти шаг.",
  referralOwn: "Это твоя собственная ссылка. Сюда нужна ссылка друга.",
  referralAlready: "Этот аккаунт уже присоединился по ссылке друга.",
  referralPaid: "Ссылки-приглашения — для новых участников, а покупка eait на этом аккаунте уже есть.",
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
