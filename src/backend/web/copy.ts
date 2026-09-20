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
  planHeading: string;
  planLead: string;
  /** `{protein}` — the line under the big kcal figure on the plan card. */
  planPerDay: string;
  planFloor: string;
  /** `{floor}` — the floor's own number, said after `planFloor`. */
  planFloorNumber: string;
  planDiary: string;
  planDiaryBody: string;
  planAppHeading: string;
  /** `{provider}` is the one they actually used — see the note in the English below. */
  planAppBody: string;
  planAppBodyGeneric: string;
  planCheckout: string;
  planChat: string;
  planTelegram: string;
  planTelegramBody: string;
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
  pairLead: string;
  pairLabel: string;
  pairButton: string;
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
  languageLabel: string;
  languageSave: string;
  /** `{provider}` is Apple or Google — a brand, so it is not translated, only the verb around it. */
  continueWith: string;
  /**
   * The rate limiter's plain-text 429 body.
   *
   * NOT A PAGE and deliberately still a string a person can read: a browser renders a raw 429 body,
   * so somebody who trips this sees exactly this sentence and nothing else. The `retry-after`
   * header beside it is what a machine reads.
   */
  tooManyAttempts: string;
}

const EN: PageCopy = {
  frontDoorLead:
    "Set up your account here, then open the app already signed in. It takes about three minutes.",
  planHeading: "Your plan",
  planLead: "This is what the app will hold you to. You can change any answer later, in the app.",
  planPerDay: "a day, with at least {protein} g of protein",
  planFloor:
    "This is the lowest daily intake this app will set, so the number is the floor rather than the " +
    "arithmetic. Eating under it is not something we will help you plan.",
  planFloorNumber: "The floor is {floor} kcal.",
  /**
   * The handover to the web application (#394).
   *
   * FIRST ON THE PAGE, ahead of the App Store, and that ordering is the decision: somebody who has
   * just answered eight questions in a browser can use the product in that same browser, and being
   * told to install something instead is being told the thing they just did was a form.
   */
  planDiary: "Open your diary",
  planDiaryBody:
    "Nothing to install. Photograph a meal in this browser and read the answer, on the same account.",
  planAppHeading: "Now get the app",
  /**
   * The `{provider}` is filled in with the one they actually used. THIS SENTENCE IS THE FEATURE:
   * the app offers both buttons, and the other one lands in a different account with onboarding to
   * do again and this plan — and anything bought from it — left behind on an account nothing can
   * merge into. Naming the right button is the only thing standing in front of that.
   */
  planAppBody:
    "Install eait for iPhone and choose Sign in with {provider}. It is the same account — your " +
    "answers and your plan are already on it.",
  /** No identity at all, which the plan page can only reach through a state nothing produces. */
  planAppBodyGeneric:
    "Install eait for iPhone and sign in the same way you did here. It is the same account — your " +
    "answers and your plan are already on it.",
  planCheckout: "Set up your subscription",
  planChat: "Open the chat",
  planTelegram: "Connect Telegram",
  planTelegramBody: "Send meals and questions from Telegram too. Same diary, same chat.",
  chatHeading: "Your chat",
  chatEmpty: "Nothing here yet. What you say in the app shows up here, and the other way round.",
  chatMealGone: "That meal is no longer in the diary.",
  chatPlaceholder: "What did you eat?",
  chatSend: "Send",
  progress: "Question {step} of {total}",
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
  chatRefusalSubscription: "The analyses this account came with are used up. Subscribe to carry on.",
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
   * IT DESCRIBES THE CODE, NOT WHERE TO GET ONE, because today there is nowhere: the app cannot
   * show a code yet (that control is its own ticket). Words naming a button that does not exist
   * would be false now and would have to be rewritten on a guarded surface later.
   */
  pairHeading: "Have a pairing code?",
  pairLead: "A code signs this browser into the account that made it. It works once, and only for five minutes.",
  pairLabel: "Your pairing code",
  pairButton: "Connect this browser",
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
  /** The picker. Its OPTIONS are `LANG_LABEL` — endonyms, never translated. */
  languageLabel: "Language",
  languageSave: "Save",
  continueWith: "Continue with {provider}",
  tooManyAttempts: "Too many attempts from this address. Try again shortly.\n",
};

const FR: PageCopy = {
  frontDoorLead: "Crée ton compte ici, puis ouvre l'appli : la session sera déjà ouverte. Ça prend environ trois minutes.",
  planHeading: "Ton plan",
  planLead: "Voilà ce à quoi l'appli va te tenir. Tu peux changer n'importe quelle réponse plus tard, dans l'appli.",
  planPerDay: "par jour, avec au moins {protein} g de protéines",
  planFloor: "C'est l'apport quotidien le plus bas que cette appli fixera, donc ce chiffre est le plancher plutôt que le calcul. Manger en dessous n'est pas quelque chose que nous t'aiderons à planifier.",
  planFloorNumber: "Le plancher est de {floor} kcal.",
  planDiary: "Ouvrir ton journal",
  planDiaryBody: "Rien à installer. Photographie un repas dans ce navigateur et lis la réponse, sur le même compte.",
  planAppHeading: "Maintenant, installe l'appli",
  planAppBody: "Installe eait pour iPhone et choisis Se connecter avec {provider}. C'est le même compte — tes réponses et ton plan y sont déjà.",
  planAppBodyGeneric: "Installe eait pour iPhone et connecte-toi comme tu l'as fait ici. C'est le même compte — tes réponses et ton plan y sont déjà.",
  planCheckout: "Mettre en place ton abonnement",
  planChat: "Ouvrir le chat",
  planTelegram: "Connecter Telegram",
  planTelegramBody: "Envoie repas et questions depuis Telegram aussi. Même journal, même chat.",
  chatHeading: "Ton chat",
  chatEmpty: "Rien ici pour l'instant. Ce que tu dis dans l'appli apparaît ici, et inversement.",
  chatMealGone: "Ce repas n'est plus dans le journal.",
  chatPlaceholder: "Tu as mangé quoi ?",
  chatSend: "Envoyer",
  progress: "Question {step} sur {total}",
  spudAlt: "Spud, la mascotte d'eait",
  cardMacros: "{kcal} {unit} · {protein} g de protéines",
  chatProposalLead: "J'enregistre ça — ça te va ?",
  chatAMeal: "Un repas",
  chatConfirm: "Enregistrer",
  chatCancel: "Pas ça",
  chatExpired: "Celui-là n'est plus en attente. Redis-le-moi.",
  chatTooLong: "Ce message est trop long pour être envoyé.",
  chatRefusalNetwork: "Trop de demandes depuis ce réseau — pas toi, cette connexion. Réessaie plus tard.",
  chatRefusalGlobal: "Tout le monde a épuisé le quota du jour. Demain repart à zéro.",
  chatRefusalDay: "C'était le dernier pour aujourd'hui — ton quota quotidien repart à minuit.",
  chatNoFocusCorrection: "Aucun repas n'est ouvert ici à corriger. Ouvre-le dans l'appli, ou dis ce que tu as mangé et enregistre-le à nouveau.",
  chatNoFocusRedate: "Aucun repas n'est ouvert ici à déplacer vers un autre jour. Ouvre-le dans l'appli pour changer sa date.",
  chatNotOnboarded: "Réponds d'abord aux questions du plan.",
  chatRefusalSubscription: "Les analyses fournies avec ce compte sont épuisées. Abonne-toi pour continuer.",
  chatRefusalFailed: "Ça n'est pas revenu. Réessaie.",
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
  pairLead: "Un code connecte ce navigateur au compte qui l'a créé. Il marche une fois, et seulement pendant cinq minutes.",
  pairLabel: "Ton code d'appairage",
  pairButton: "Connecter ce navigateur",
  errorPair: "Ce code n'a pas marché. Un code marche une fois, et seulement cinq minutes après sa création.",
  continueLabel: "Continuer",
  answerRequired: "Celle-là attend une réponse.",
  belowHealthyTarget: "L'objectif le plus bas que nous puissions planifier pour ta taille est {kg} kg.",
  ageBelowMinimum: "Nous ne pouvons planifier que pour des adultes — vérifie l'année.",
  outOfRange: "Cette valeur est hors de ce que nous pouvons planifier. Réessaie.",
  titleStart: "Commencer avec eait",
  titlePlan: "Ton plan",
  titleChat: "Chat",
  languageLabel: "Langue",
  languageSave: "Enregistrer",
  continueWith: "Continuer avec {provider}",
  tooManyAttempts: "Trop de tentatives depuis cette adresse. Réessaie dans un moment.\n",
};

const DE: PageCopy = {
  frontDoorLead: "Richte dein Konto hier ein und öffne die App dann bereits angemeldet. Dauert etwa drei Minuten.",
  planHeading: "Dein Plan",
  planLead: "Daran wird die App dich messen. Jede Antwort lässt sich später in der App ändern.",
  planPerDay: "am Tag, mit mindestens {protein} g Eiweiß",
  planFloor: "Das ist die niedrigste Tagesaufnahme, die diese App je ansetzt — die Zahl ist also die Grenze und nicht die Rechnung. Darunter zu essen ist nichts, wobei wir dir helfen werden.",
  planFloorNumber: "Die Grenze liegt bei {floor} kcal.",
  planDiary: "Dein Tagebuch öffnen",
  planDiaryBody: "Nichts zu installieren. Fotografier eine Mahlzeit in diesem Browser und lies die Antwort — auf demselben Konto.",
  planAppHeading: "Jetzt die App holen",
  planAppBody: "Installier eait fürs iPhone und wähl „Anmelden mit {provider}“. Es ist dasselbe Konto — deine Antworten und dein Plan liegen schon darauf.",
  planAppBodyGeneric: "Installier eait fürs iPhone und melde dich so an wie hier. Es ist dasselbe Konto — deine Antworten und dein Plan liegen schon darauf.",
  planCheckout: "Abo einrichten",
  planChat: "Chat öffnen",
  planTelegram: "Telegram verbinden",
  planTelegramBody: "Schick Mahlzeiten und Fragen auch aus Telegram. Gleiches Tagebuch, gleicher Chat.",
  chatHeading: "Dein Chat",
  chatEmpty: "Hier ist noch nichts. Was du in der App sagst, taucht hier auf — und umgekehrt.",
  chatMealGone: "Diese Mahlzeit ist nicht mehr im Tagebuch.",
  chatPlaceholder: "Was hast du gegessen?",
  chatSend: "Senden",
  progress: "Frage {step} von {total}",
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
  chatRefusalSubscription: "Die Analysen, die zu diesem Konto gehörten, sind aufgebraucht. Schließ ein Abo ab, um weiterzumachen.",
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
  pairLead: "Ein Code meldet diesen Browser bei dem Konto an, das ihn erzeugt hat. Er gilt einmal und nur fünf Minuten lang.",
  pairLabel: "Dein Kopplungscode",
  pairButton: "Diesen Browser verbinden",
  errorPair: "Dieser Code hat nicht funktioniert. Ein Code gilt einmal und nur fünf Minuten nach seiner Erzeugung.",
  continueLabel: "Weiter",
  answerRequired: "Die hier braucht eine Antwort.",
  belowHealthyTarget: "Das niedrigste Ziel, das wir für deine Größe planen können, sind {kg} kg.",
  ageBelowMinimum: "Wir können nur für Erwachsene planen — prüf das Jahr.",
  outOfRange: "Dieser Wert liegt außerhalb dessen, was wir planen können. Versuch es noch einmal.",
  titleStart: "Mit eait anfangen",
  titlePlan: "Dein Plan",
  titleChat: "Chat",
  languageLabel: "Sprache",
  languageSave: "Speichern",
  continueWith: "Weiter mit {provider}",
  tooManyAttempts: "Zu viele Versuche von dieser Adresse. Versuch es gleich noch einmal.\n",
};

const IT: PageCopy = {
  frontDoorLead: "Prepara qui il tuo account, poi apri l'app con la sessione già aperta. Ci vogliono circa tre minuti.",
  planHeading: "Il tuo piano",
  planLead: "È a questo che l'app ti terrà. Puoi cambiare qualsiasi risposta più avanti, nell'app.",
  planPerDay: "al giorno, con almeno {protein} g di proteine",
  planFloor: "Questo è l'apporto giornaliero più basso che questa app imposterà, quindi il numero è il limite e non il calcolo. Mangiare al di sotto non è una cosa che ti aiuteremo a pianificare.",
  planFloorNumber: "Il limite è di {floor} kcal.",
  planDiary: "Apri il tuo diario",
  planDiaryBody: "Niente da installare. Fotografa un pasto in questo browser e leggi la risposta, sullo stesso account.",
  planAppHeading: "Ora installa l'app",
  planAppBody: "Installa eait per iPhone e scegli Accedi con {provider}. È lo stesso account — le tue risposte e il tuo piano ci sono già.",
  planAppBodyGeneric: "Installa eait per iPhone e accedi come hai fatto qui. È lo stesso account — le tue risposte e il tuo piano ci sono già.",
  planCheckout: "Attiva l'abbonamento",
  planChat: "Apri la chat",
  planTelegram: "Collega Telegram",
  planTelegramBody: "Manda pasti e domande anche da Telegram. Stesso diario, stessa chat.",
  chatHeading: "La tua chat",
  chatEmpty: "Qui non c'è ancora niente. Quello che dici nell'app compare qui, e viceversa.",
  chatMealGone: "Quel pasto non è più nel diario.",
  chatPlaceholder: "Cosa hai mangiato?",
  chatSend: "Invia",
  progress: "Domanda {step} di {total}",
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
  chatRefusalSubscription: "Le analisi incluse con questo account sono finite. Abbonati per continuare.",
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
  pairLead: "Un codice collega questo browser all'account che l'ha creato. Vale una volta sola, e solo per cinque minuti.",
  pairLabel: "Il tuo codice di collegamento",
  pairButton: "Collega questo browser",
  errorPair: "Quel codice non ha funzionato. Un codice vale una volta sola, e solo per cinque minuti da quando è stato creato.",
  continueLabel: "Continua",
  answerRequired: "Questa ha bisogno di una risposta.",
  belowHealthyTarget: "L'obiettivo più basso che possiamo pianificare per la tua altezza è {kg} kg.",
  ageBelowMinimum: "Possiamo pianificare solo per adulti — controlla l'anno.",
  outOfRange: "Quel valore è fuori da ciò che possiamo pianificare. Riprova.",
  titleStart: "Inizia con eait",
  titlePlan: "Il tuo piano",
  titleChat: "Chat",
  languageLabel: "Lingua",
  languageSave: "Salva",
  continueWith: "Continua con {provider}",
  tooManyAttempts: "Troppi tentativi da questo indirizzo. Riprova tra poco.\n",
};

const ES: PageCopy = {
  frontDoorLead: "Prepara tu cuenta aquí y luego abre la app ya con la sesión iniciada. Son unos tres minutos.",
  planHeading: "Tu plan",
  planLead: "Esto es a lo que la app te va a sujetar. Puedes cambiar cualquier respuesta más adelante, en la app.",
  planPerDay: "al día, con al menos {protein} g de proteína",
  planFloor: "Esta es la ingesta diaria más baja que esta app va a fijar, así que el número es el suelo y no el cálculo. Comer por debajo no es algo que te vayamos a ayudar a planificar.",
  planFloorNumber: "El suelo está en {floor} kcal.",
  planDiary: "Abre tu diario",
  planDiaryBody: "Nada que instalar. Fotografía una comida en este navegador y lee la respuesta, en la misma cuenta.",
  planAppHeading: "Ahora instala la app",
  planAppBody: "Instala eait para iPhone y elige Iniciar sesión con {provider}. Es la misma cuenta — tus respuestas y tu plan ya están ahí.",
  planAppBodyGeneric: "Instala eait para iPhone e inicia sesión igual que aquí. Es la misma cuenta — tus respuestas y tu plan ya están ahí.",
  planCheckout: "Configura tu suscripción",
  planChat: "Abre el chat",
  planTelegram: "Conectar Telegram",
  planTelegramBody: "Manda comidas y preguntas desde Telegram también. El mismo diario, el mismo chat.",
  chatHeading: "Tu chat",
  chatEmpty: "Aquí todavía no hay nada. Lo que dices en la app aparece aquí, y al revés.",
  chatMealGone: "Esa comida ya no está en el diario.",
  chatPlaceholder: "¿Qué comiste?",
  chatSend: "Enviar",
  progress: "Pregunta {step} de {total}",
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
  chatRefusalSubscription: "Los análisis que traía esta cuenta se han agotado. Suscríbete para seguir.",
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
  pairLead: "Un código conecta este navegador con la cuenta que lo creó. Vale una vez, y solo durante cinco minutos.",
  pairLabel: "Tu código de vinculación",
  pairButton: "Conectar este navegador",
  errorPair: "Ese código no funcionó. Un código vale una vez, y solo durante cinco minutos desde que se crea.",
  continueLabel: "Continuar",
  answerRequired: "Esa necesita una respuesta.",
  belowHealthyTarget: "El objetivo más bajo que podemos planificar para tu altura es {kg} kg.",
  ageBelowMinimum: "Solo podemos planificar para adultos — comprueba el año.",
  outOfRange: "Ese valor está fuera de lo que podemos planificar. Inténtalo otra vez.",
  titleStart: "Empezar con eait",
  titlePlan: "Tu plan",
  titleChat: "Chat",
  languageLabel: "Idioma",
  languageSave: "Guardar",
  continueWith: "Continuar con {provider}",
  tooManyAttempts: "Demasiados intentos desde esta dirección. Inténtalo dentro de un momento.\n",
};

const VI: PageCopy = {
  frontDoorLead: "Tạo tài khoản ở đây, rồi mở ứng dụng là đã đăng nhập sẵn. Mất khoảng ba phút.",
  planHeading: "Kế hoạch của bạn",
  planLead: "Đây là chuẩn mà ứng dụng sẽ dùng để chấm bạn. Bạn có thể đổi bất cứ câu trả lời nào sau này, trong ứng dụng.",
  planPerDay: "mỗi ngày, với ít nhất {protein} g đạm",
  planFloor: "Đây là mức ăn vào mỗi ngày thấp nhất mà ứng dụng này sẽ đặt, nên con số đó là mức sàn chứ không phải phép tính. Ăn dưới mức đó không phải điều chúng tôi sẽ giúp bạn lên kế hoạch.",
  planFloorNumber: "Mức sàn là {floor} kcal.",
  planDiary: "Mở nhật ký của bạn",
  planDiaryBody: "Không cần cài gì. Chụp một bữa ăn ngay trong trình duyệt này và đọc câu trả lời, trên cùng tài khoản.",
  planAppHeading: "Giờ thì tải ứng dụng",
  planAppBody: "Cài eait cho iPhone và chọn Đăng nhập bằng {provider}. Vẫn là tài khoản đó — câu trả lời và kế hoạch của bạn đã nằm sẵn trong đấy.",
  planAppBodyGeneric: "Cài eait cho iPhone và đăng nhập đúng như bạn đã làm ở đây. Vẫn là tài khoản đó — câu trả lời và kế hoạch của bạn đã nằm sẵn trong đấy.",
  planCheckout: "Thiết lập gói đăng ký",
  planChat: "Mở khung chat",
  planTelegram: "Kết nối Telegram",
  planTelegramBody: "Gửi bữa ăn và câu hỏi từ Telegram nữa. Cùng nhật ký, cùng khung chat.",
  chatHeading: "Khung chat của bạn",
  chatEmpty: "Ở đây chưa có gì. Những gì bạn nói trong ứng dụng sẽ hiện ở đây, và ngược lại.",
  chatMealGone: "Bữa đó không còn trong nhật ký nữa.",
  chatPlaceholder: "Bạn đã ăn gì?",
  chatSend: "Gửi",
  progress: "Câu hỏi {step}/{total}",
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
  chatRefusalSubscription: "Số lượt phân tích đi kèm tài khoản này đã dùng hết. Đăng ký để tiếp tục.",
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
  pairLead: "Một mã sẽ đăng nhập trình duyệt này vào tài khoản đã tạo ra nó. Dùng được một lần, và chỉ trong năm phút.",
  pairLabel: "Mã ghép nối của bạn",
  pairButton: "Kết nối trình duyệt này",
  errorPair: "Mã đó không dùng được. Mỗi mã chỉ dùng một lần, và chỉ trong năm phút kể từ khi tạo.",
  continueLabel: "Tiếp tục",
  answerRequired: "Câu này cần một câu trả lời.",
  belowHealthyTarget: "Mục tiêu thấp nhất chúng tôi có thể lên kế hoạch cho chiều cao của bạn là {kg} kg.",
  ageBelowMinimum: "Chúng tôi chỉ lên kế hoạch cho người trưởng thành — kiểm tra lại năm nhé.",
  outOfRange: "Giá trị đó nằm ngoài phạm vi chúng tôi có thể lên kế hoạch. Thử lại nhé.",
  titleStart: "Bắt đầu với eait",
  titlePlan: "Kế hoạch của bạn",
  titleChat: "Chat",
  languageLabel: "Ngôn ngữ",
  languageSave: "Lưu",
  continueWith: "Tiếp tục với {provider}",
  tooManyAttempts: "Quá nhiều lần thử từ địa chỉ này. Thử lại sau một lát nhé.\n",
};

const ID: PageCopy = {
  frontDoorLead: "Siapkan akunmu di sini, lalu buka aplikasinya dalam keadaan sudah masuk. Perlu sekitar tiga menit.",
  planHeading: "Rencanamu",
  planLead: "Inilah yang akan dipegang aplikasinya untukmu. Semua jawaban bisa kamu ubah nanti di aplikasi.",
  planPerDay: "per hari, dengan setidaknya {protein} g protein",
  planFloor: "Ini asupan harian terendah yang akan ditetapkan aplikasi ini, jadi angkanya adalah batas bawah, bukan hasil hitungan. Makan di bawah itu bukan sesuatu yang akan kami bantu rencanakan.",
  planFloorNumber: "Batas bawahnya {floor} kcal.",
  planDiary: "Buka buku harianmu",
  planDiaryBody: "Tidak ada yang perlu dipasang. Foto sebuah makanan di browser ini dan baca jawabannya, di akun yang sama.",
  planAppHeading: "Sekarang ambil aplikasinya",
  planAppBody: "Pasang eait untuk iPhone dan pilih Masuk dengan {provider}. Ini akun yang sama — jawaban dan rencanamu sudah ada di dalamnya.",
  planAppBodyGeneric: "Pasang eait untuk iPhone dan masuk dengan cara yang sama seperti di sini. Ini akun yang sama — jawaban dan rencanamu sudah ada di dalamnya.",
  planCheckout: "Atur langgananmu",
  planChat: "Buka chat",
  planTelegram: "Hubungkan Telegram",
  planTelegramBody: "Kirim makanan dan pertanyaan dari Telegram juga. Buku harian yang sama, chat yang sama.",
  chatHeading: "Chat-mu",
  chatEmpty: "Belum ada apa-apa di sini. Apa yang kamu tulis di aplikasi muncul di sini, dan sebaliknya.",
  chatMealGone: "Makanan itu sudah tidak ada di buku harian.",
  chatPlaceholder: "Kamu makan apa?",
  chatSend: "Kirim",
  progress: "Pertanyaan {step} dari {total}",
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
  chatRefusalSubscription: "Jatah analisis akun ini sudah habis. Berlangganan untuk melanjutkan.",
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
  pairLead: "Kode memasukkan browser ini ke akun yang membuatnya. Berlaku sekali, dan hanya selama lima menit.",
  pairLabel: "Kode penyambungmu",
  pairButton: "Sambungkan browser ini",
  errorPair: "Kode itu tidak berhasil. Kode berlaku sekali, dan hanya lima menit setelah dibuat.",
  continueLabel: "Lanjut",
  answerRequired: "Yang ini butuh jawaban.",
  belowHealthyTarget: "Target terendah yang bisa kami rencanakan untuk tinggimu adalah {kg} kg.",
  ageBelowMinimum: "Kami hanya bisa merencanakan untuk orang dewasa — cek tahunnya.",
  outOfRange: "Nilai itu di luar yang bisa kami rencanakan. Coba lagi.",
  titleStart: "Mulai dengan eait",
  titlePlan: "Rencanamu",
  titleChat: "Chat",
  languageLabel: "Bahasa",
  languageSave: "Simpan",
  continueWith: "Lanjutkan dengan {provider}",
  tooManyAttempts: "Terlalu banyak percobaan dari alamat ini. Coba lagi sebentar.\n",
};

const RU: PageCopy = {
  frontDoorLead: "Заведи аккаунт здесь, а потом открой приложение уже с входом. Займёт минуты три.",
  planHeading: "Твой план",
  planLead: "Вот к чему приложение будет тебя возвращать. Любой ответ можно поменять позже, в приложении.",
  planPerDay: "в день, и минимум {protein} г белка",
  planFloor: "Это самый низкий суточный калораж, который приложение когда-либо поставит, так что эта цифра — порог, а не расчёт. Есть ниже — не то, что мы поможем спланировать.",
  planFloorNumber: "Порог — {floor} ккал.",
  planDiary: "Открыть дневник",
  planDiaryBody: "Ставить ничего не нужно. Сфотографируй еду прямо в этом браузере и прочитай ответ — на том же аккаунте.",
  planAppHeading: "Теперь возьми приложение",
  planAppBody: "Установи eait для iPhone и выбери «Войти через {provider}». Это тот же аккаунт — твои ответы и план уже там.",
  planAppBodyGeneric: "Установи eait для iPhone и войди так же, как здесь. Это тот же аккаунт — твои ответы и план уже там.",
  planCheckout: "Оформить подписку",
  planChat: "Открыть чат",
  planTelegram: "Подключить Telegram",
  planTelegramBody: "Присылай еду и вопросы и из Telegram. Тот же дневник, тот же чат.",
  chatHeading: "Твой чат",
  chatEmpty: "Здесь пока пусто. Что ты говоришь в приложении, появляется тут, и наоборот.",
  chatMealGone: "Этого приёма пищи больше нет в дневнике.",
  chatPlaceholder: "Что было на тарелке?",
  chatSend: "Отправить",
  progress: "Вопрос {step} из {total}",
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
  chatRefusalSubscription: "Разборы, которые шли с этим аккаунтом, закончились. Оформи подписку, чтобы продолжить.",
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
  pairLead: "Код входит этим браузером в аккаунт, который его создал. Работает один раз и только пять минут.",
  pairLabel: "Твой код привязки",
  pairButton: "Подключить этот браузер",
  errorPair: "Этот код не сработал. Код работает один раз и только пять минут после создания.",
  continueLabel: "Дальше",
  answerRequired: "На этот нужен ответ.",
  belowHealthyTarget: "Самая низкая цель, которую мы можем спланировать для твоего роста, — {kg} кг.",
  ageBelowMinimum: "Мы планируем только для взрослых — проверь год.",
  outOfRange: "Это значение вне того, что мы можем спланировать. Попробуй ещё раз.",
  titleStart: "Начать с eait",
  titlePlan: "Твой план",
  titleChat: "Чат",
  languageLabel: "Язык",
  languageSave: "Сохранить",
  continueWith: "Продолжить с {provider}",
  tooManyAttempts: "Слишком много попыток с этого адреса. Попробуй чуть позже.\n",
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
