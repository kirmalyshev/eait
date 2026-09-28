// The logging surface's words (#92, W5/M5): pick or drop a photo, the 1.6 s scan, the logged
// card, the rough-guess correction, the first verdict, and the refused / failed / unknown /
// wrong-format states. Written once here because both clients draw the same screens — the claim
// rule on the index puts the whole surface's strings in the first PR to reach it, so `web` and
// `phone` hold the strings only one client's boards draw; everything else is shared.
//
// NOT HERE, on purpose:
// - the verdict pills ("Calories high") — computed in `verdicts.ts`, localized in the catalogs;
// - the chat chrome the state boards sit inside ("Tell Gabie what you ate, or ask", "Send
//   again", "Couldn't reach eait.") — W7's `chat-copy.ts`;
// - the nav labels — `shell-copy.ts`;
// - meal names, grams and figures — data, formatted with `wholeNumbers(lang)`.
//
// UNIT WORDS LIVE INSIDE THE TEMPLATES ("{grams} g", "{plan} kcal"), the way `lang.ts` wants
// a sentence's unit spelled — so the Russian strings write г and ккал themselves rather than
// taking a symbol from code.

import { t, type Localized } from "../lang.ts";
import type { Lang } from "../types.ts";

export interface LogCopy {
  /** `log-upload` + `log-camera`: the note field's placeholder — "sausage, not zucchini". */
  notePlaceholder: string;
  /** `log-reading`: the scanning line, looping over the photo for 1,600 ms. */
  reading: string;
  /** `log-reading`: the disabled CTA while the analyzer runs. */
  checking: string;
  /** `log-reading`, `log-refused`, `states-failed`, `states-format`, `log-camera-denied`. */
  close: string;
  /** `log-logged`, `log-rough`: the card's stamp — web "Logged · 13:05"; phone the screen title. */
  logged: string;
  /** `log-reading`, `log-logged`, `log-refused` (phone): the day title — "Today · 13:04". */
  today: string;
  /** `states-unknown`: the pending badge under a bubble the server has not answered. */
  waitingToSend: string;
  /** `log-refused`: the headline — the photo held no food. */
  noFood: string;
  /** `log-refused`, `states-format`: the retry door. */
  tryAnotherPhoto: string;
  /** `log-rough`: the estimate's own label. */
  roughGuess: string;
  /**
   * `log-rough`: the question. `{item}` is the ingredient the card is least sure of, `{grams}`
   * its amount as a bare number — the unit is the template's.
   */
  roughAsk: string;
  /** `log-rough`: the first answer. */
  roughAbout: string;
  /** `log-rough`: the second answer. */
  roughHalf: string;
  /** `log-rough`: the third answer — "More like 250 g". */
  roughMore: string;
  /**
   * `log-rough`: the TEXT a grams answer sends — a correction is a turn with the meal in focus,
   * not a PATCH, so "Half that" must be a sentence the person could have typed. `{item}` is the
   * asked-about item's name, `{grams}` the number the chip promised.
   */
  roughSent: string;
  /** `log-logged`, `log-rough`: the card's edit door. */
  edit: string;
  /** `log-logged`, `log-rough`: the card's confirm — the counterpart of `edit`. */
  agree: string;
  /** `first-verdict`: the heading — the web renders the phone board's content for this. */
  firstVerdict: string;
  /** `first-verdict`: the secondary — "this is off, let me fix it", the sparkle button. */
  correct: string;
  /** `first-verdict`: the primary. */
  continueCta: string;
  /** `states-failed`: under the title — the photo was not lost. */
  analysisFailedNote: string;
  /** `states-unknown`: the notice's first line — the turn may still have landed. */
  unknownTitle: string;
  /** `states-unknown`: the notice's second line. */
  unknownNote: string;
  /**
   * `log-logged`: the noun `{noun}` fills — saturated fat, the one dimension the detail line is
   * written for. A copy-table entry rather than a `verdicts.ts` read, because that table is
   * Lingui-backed and this one is what the browser bundle carries.
   */
  satfatNoun: string;
  /** The sodium noun for the same line — `{noun}` when the declared cap is on sodium. */
  sodiumNoun: string;
  /**
   * `log-logged`: the one-line explanation under a warn verdict. `{noun}` is `satfatNoun`
   * ("Saturated fat") or `sodiumNoun` ("Sodium") — whichever cap the verdict names — `{amount}`
   * the meal's figure, `{target}` the day's cap, and `{unit}` the spelled unit (g/mg, filled
   * with `spellUnit` on the composing side, never a letter in the template). The translations
   * that cannot agree an adjective with a placeholder noun restructure around it ("For one meal,
   * that is a lot: …").
   */
  verdictDetail: string;
  /** `log-logged`, `log-rough`: the day counter — "{eaten} of {plan} kcal". */
  dayEaten: string;
  /**
   * `log-logged`: the day counter's quiet half — the card bolds `{eaten}` alone and prints this
   * beside it ("of 1,434 kcal"). A whole template, not `dayEaten` with `{eaten}` hollowed out:
   * a placeholder filled with "" is a hole a translation cannot see.
   */
  dayOfPlan: string;
  /** `log-logged`, `log-rough`: its second half — "582 left"; the rough board joins them with " · ". */
  dayLeft: string;
  /** `log-logged`, `log-rough`: the same slot when the day ran past — "120 over". */
  dayOver: string;

  /** The boards only the web draws: `log-upload`'s dropzone, and the chat-thread failure state. */
  web: {
    /** `log-upload`: the headline. */
    title: string;
    /** `log-upload`: inside the dropzone. */
    dropHint: string;
    /** `log-upload`: one string — the middot and the format list are the board's. */
    chooseFile: string;
    /** `log-upload`: the board's British spelling — `phone.analyzeCta` is American. */
    analyzeCta: string;
    /** `log-upload`: the quiet door to the chat when there is no photo at hand. `{coach}` is `coach.name`. */
    chatInstead: string;
    /** `log-reading`: the pending card's source suffix — "13:05 · from a photo". */
    fromPhoto: string;
    /** `states-failed`: the web's failed state is a coach card in Chat — with a period, unlike the phone's. */
    failedTitle: string;
    /** `states-failed`: the retry button on that card. */
    sendAgain: string;
  };

  /** The boards only the phone draws: the camera, the library sheet, and its own state cards. */
  phone: {
    /** `log-camera`: the screen's title, reused as the top-bar title on the failed/format sheets. */
    cameraTitle: string;
    /** `log-camera`: the line over the thumbnails. */
    cameraHint: string;
    /** `log-camera`: the captured-shot counter — "{n} of {total}", "1 of 3". */
    shotCount: string;
    /** `log-camera`: the board's American spelling — `web.analyzeCta` is British. */
    analyzeCta: string;
    /** `log-upload`: the library sheet's title. */
    pickTitle: string;
    /** `log-upload`: under the grid. */
    pickHint: string;
    /** `log-camera-denied`: the sheet's headline. */
    cameraOffTitle: string;
    /** `log-camera-denied`: the way out. */
    cameraOffNote: string;
    /** `log-camera-denied`: the secondary door. */
    pickLibrary: string;
    /** `log-refused`: the top-bar title, above `noFood`. */
    refusedTitle: string;
    /** `states-failed`: the phone's failed sheet — no period, unlike the web's chat card. */
    failedTitle: string;
    /** `states-failed`: the phone sheet's retry. */
    tryAgain: string;
    /** `states-format`: the wrong-format sheet — the web refuses format at upload before this exists. */
    formatTitle: string;
    /** `states-format`: which formats pass, and the alternative. */
    formatNote: string;

    // The controls' accessible names — the boards draw them as icons, so the words live on the
    // a11y label alone.
    /** `log-camera`: the shutter. */
    shutterLabel: string;
    /** `log-camera`: the library door beside the shutter. */
    libraryLabel: string;
    /** `log-camera`: a thumbnail's ✕. */
    removeShotLabel: string;
    /** `log-camera`: the note field — the visual is `notePlaceholder` alone. */
    noteLabel: string;
    /** `log-camera` edit mode: the re-read's button — the analyze CTA's own verb. */
    editSend: string;
    /** The sample-spent gate's heading — the paywall callout, not a `states-*` sheet. */
    lockHeading: string;
    /** `states-failed` charged variant: the turn WAS charged, and that was the last of the sample. */
    failedSampleNote: string;

    // The `states-*` sheets a photo turn can rest on, as title + note pairs. `not-food`,
    // `analysis-failed` (plain) and `unsupported-image` have their own surfaces; these are every
    // other resting state drawn over the log surface — caps by scope, the unfinished setup, the
    // over-long note, the two device failures, the server failure and the transport one.
    /** `cap-exceeded`, scope `global`. */
    capGlobalTitle: string;
    capGlobalNote: string;
    /** `cap-exceeded`, scope `address` — NOT the reader's own allowance, and it may not read as one. */
    capAddressTitle: string;
    capAddressNote: string;
    /** `cap-exceeded`, scope `user`. */
    capUserTitle: string;
    capUserNote: string;
    /** `cap-exceeded`, scope absent or unrecognised — a limit is named, never an owner guessed. */
    capUnknownTitle: string;
    capUnknownNote: string;
    /** `not-onboarded`. */
    setupTitle: string;
    setupNote: string;
    /** `caption too long` — `{max}` is the bound, filled `wholeNumbers`. */
    longNoteTitle: string;
    longNoteNote: string;
    /** `library-unavailable`. */
    libraryFailTitle: string;
    libraryFailNote: string;
    /** `capture-failed`. */
    captureFailTitle: string;
    captureFailNote: string;
    /** `no-photo` — a re-read asked of a meal that has none stored. */
    noPhotoTitle: string;
    noPhotoNote: string;
    /** The server's own failure — a refusal that is ours, never the connection's. */
    serverFailTitle: string;
    serverFailNote: string;
    /** The transport failure — nothing answered, and nothing was kept to re-send. */
    offlineTitle: string;
    offlineNote: string;
  };
}

export const LOG_COPY: Localized<LogCopy> = {
  en: {
    notePlaceholder: "Anything I can’t see? Sausage, not zucchini…",
    reading: "Reading the plate. One moment for the numbers.",
    checking: "Checking the numbers",
    close: "Close",
    logged: "Logged",
    today: "Today",
    waitingToSend: "Waiting to send",
    noFood: "No food in that one",
    tryAnotherPhoto: "Try another photo",
    roughGuess: "Rough guess",
    roughAsk: "Was the {item} about {grams} g?",
    roughAbout: "About that",
    roughHalf: "Half that",
    roughMore: "More like {grams} g",
    roughSent: "The {item} was about {grams} g",
    edit: "Edit",
    agree: "Agree",
    firstVerdict: "Your first verdict",
    correct: "Correct",
    continueCta: "Continue",
    analysisFailedNote: "Nothing was logged. Your photo is kept.",
    unknownTitle: "That didn't finish cleanly.",
    unknownNote: "Kept, and re-sent on its own — sending again is safe.",
    verdictDetail: "{noun} is high for one meal: {amount} of your {target} {unit}. Go easy on it for the rest of today.",
    satfatNoun: "Saturated fat",
    sodiumNoun: "Sodium",
    dayEaten: "{eaten} of {plan} kcal",
    dayOfPlan: "of {plan} kcal",
    dayLeft: "{left} left",
    dayOver: "{over} over",
    web: {
      title: "A photo of the meal",
      dropHint: "Drop a photo here",
      chooseFile: "or choose a file · JPEG, PNG or WebP",
      analyzeCta: "Analyse",
      chatInstead: "or tell {coach} about it in Chat",
      fromPhoto: "from a photo",
      failedTitle: "The analysis didn't come back.",
      sendAgain: "Send it again",
    },
    phone: {
      cameraTitle: "One meal, any angle",
      cameraHint: "A second shot from the side helps with portions",
      shotCount: "{n} of {total}",
      analyzeCta: "Analyze",
      pickTitle: "Pick a photo",
      pickHint: "Pick any angles of the same meal",
      cameraOffTitle: "Camera access is off",
      cameraOffNote: "Turn it on in Settings, or pick a photo you already took.",
      pickLibrary: "Pick from library instead",
      refusedTitle: "Couldn’t log that",
      failedTitle: "The analysis didn’t come back",
      tryAgain: "Try again",
      formatTitle: "That photo format can’t be read",
      formatNote: "JPEG, PNG or WebP — or photograph the plate instead.",
      shutterLabel: "Take a photo",
      libraryLabel: "Choose from library",
      removeShotLabel: "Remove this shot",
      noteLabel: "Note about this meal",
      editSend: "Send",
      lockHeading: "Photos need a subscription",
      failedSampleNote: "Nothing was logged, but it still counted, and that was the last of your sample — the next photo needs a subscription.",
      capGlobalTitle: "Out of budget for today",
      capGlobalNote: "The shared daily analysis budget is spent. It resets at midnight.",
      capAddressTitle: "Too many photos from this network",
      capAddressNote: "Not your allowance — this network’s. If you are on shared or mobile internet, try again later or from another connection.",
      capUserTitle: "That was your last photo today",
      capUserNote: "Your daily allowance is spent. It resets at midnight — chat still works.",
      capUnknownTitle: "That one hit a limit",
      capUnknownNote: "Nothing was logged and nothing was counted. Try again later — chat still works.",
      setupTitle: "Finish setting up first",
      setupNote: "We need your goal and weight before a meal can be judged.",
      longNoteTitle: "That note is too long",
      longNoteNote: "Keep it under {max} characters. Nothing was logged.",
      libraryFailTitle: "Can’t open your photos",
      libraryFailNote: "eait needs permission to read a photo you pick. You can grant it in Settings → eait, or take the photo here instead.",
      captureFailTitle: "The camera didn’t take that",
      captureFailNote: "Try again.",
      noPhotoTitle: "Take or pick a photo first",
      noPhotoNote: "A photo of the meal is what the analysis reads.",
      serverFailTitle: "eait hit a problem",
      serverFailNote: "The server failed on that one, not your connection. Nothing was logged and nothing was counted.",
      offlineTitle: "Couldn’t reach eait",
      offlineNote: "Nothing was logged. Check your connection.",
    },
  },
  fr: {
    notePlaceholder: "Quelque chose que je ne vois pas ? Saucisse, pas courgette…",
    reading: "Lecture de l’assiette. Un instant pour les chiffres.",
    checking: "Vérification des chiffres",
    close: "Fermer",
    logged: "Enregistré",
    today: "Aujourd’hui",
    waitingToSend: "En attente d’envoi",
    noFood: "Aucun aliment sur celle-là",
    tryAnotherPhoto: "Essayer une autre photo",
    roughGuess: "Estimation approximative",
    roughAsk: "Environ {grams} g de {item} ?",
    roughAbout: "À peu près ça",
    roughHalf: "Moitié moins",
    roughMore: "Plutôt {grams} g",
    roughSent: "Environ {grams} g de {item}",
    edit: "Modifier",
    agree: "D’accord",
    firstVerdict: "Ton premier verdict",
    correct: "Corriger",
    continueCta: "Continuer",
    analysisFailedNote: "Rien n’a été enregistré. Ta photo est gardée.",
    unknownTitle: "Ça ne s’est pas terminé proprement.",
    unknownNote: "Gardé, et renvoyé tout seul — le renvoyer est sans risque.",
    verdictDetail: "Pour un repas, c’est beaucoup : {noun} {amount} sur {target} {unit}. Vas-y doucement pour le reste de la journée.",
    satfatNoun: "Graisses saturées",
    sodiumNoun: "Sodium",
    dayEaten: "{eaten} sur {plan} kcal",
    dayOfPlan: "sur {plan} kcal",
    dayLeft: "{left} restantes",
    dayOver: "{over} en trop",
    web: {
      title: "Une photo du repas",
      dropHint: "Dépose une photo ici",
      chooseFile: "ou choisis un fichier · JPEG, PNG ou WebP",
      analyzeCta: "Analyser",
      chatInstead: "ou raconte-le à {coach} dans Chat",
      fromPhoto: "depuis une photo",
      failedTitle: "L’analyse n’est pas arrivée.",
      sendAgain: "Renvoyer",
    },
    phone: {
      cameraTitle: "Un repas, n’importe quel angle",
      cameraHint: "Une deuxième prise de côté aide pour les portions",
      shotCount: "{n} sur {total}",
      analyzeCta: "Analyser",
      pickTitle: "Choisir une photo",
      pickHint: "N’importe quel angle du même repas",
      cameraOffTitle: "L’accès à la caméra est coupé",
      cameraOffNote: "Active-le dans Réglages, ou choisis une photo déjà prise.",
      pickLibrary: "Choisir dans la bibliothèque",
      refusedTitle: "Impossible de l’enregistrer",
      failedTitle: "L’analyse n’est pas arrivée",
      tryAgain: "Réessayer",
      formatTitle: "Ce format de photo est illisible",
      formatNote: "JPEG, PNG ou WebP — ou photographie l’assiette.",
      shutterLabel: "Prendre une photo",
      libraryLabel: "Choisir dans la bibliothèque",
      removeShotLabel: "Retirer cette photo",
      noteLabel: "Note sur ce repas",
      editSend: "Envoyer",
      lockHeading: "Les photos demandent un abonnement",
      failedSampleNote: "Rien n’a été enregistré, mais ça a quand même compté — et c’était la dernière de ton essai. La prochaine photo demande un abonnement.",
      capGlobalTitle: "Plus de budget aujourd’hui",
      capGlobalNote: "Le budget d’analyses quotidien partagé est épuisé. Il repart à minuit.",
      capAddressTitle: "Trop de photos depuis ce réseau",
      capAddressNote: "Pas ta limite — celle du réseau. Sur un réseau partagé ou mobile, réessaie plus tard ou depuis une autre connexion.",
      capUserTitle: "C’était ta dernière photo aujourd’hui",
      capUserNote: "Ta limite quotidienne est atteinte. Elle repart à minuit — le chat marche toujours.",
      capUnknownTitle: "Ça a touché une limite",
      capUnknownNote: "Rien n’a été enregistré ni compté. Réessaie plus tard — le chat marche toujours.",
      setupTitle: "Finis d’abord la configuration",
      setupNote: "Il nous faut ton objectif et ton poids avant de pouvoir juger un repas.",
      longNoteTitle: "Cette note est trop longue",
      longNoteNote: "Reste sous {max} caractères. Rien n’a été enregistré.",
      libraryFailTitle: "Impossible d’ouvrir tes photos",
      libraryFailNote: "eait a besoin de l’autorisation pour lire une photo choisie. Accorde-la dans Réglages → eait, ou prends la photo ici.",
      captureFailTitle: "L’appareil n’a pas pris celle-là",
      captureFailNote: "Réessaie.",
      noPhotoTitle: "Prends ou choisis d’abord une photo",
      noPhotoNote: "C’est une photo du repas que l’analyse lit.",
      serverFailTitle: "eait a eu un problème",
      serverFailNote: "C’est le serveur qui a raté celle-là, pas ta connexion. Rien n’a été enregistré ni compté.",
      offlineTitle: "Impossible de joindre eait",
      offlineNote: "Rien n’a été enregistré. Vérifie ta connexion.",
    },
  },
  de: {
    notePlaceholder: "Etwas, das ich nicht sehe? Wurst statt Zucchini…",
    reading: "Der Teller wird gelesen. Einen Moment für die Zahlen.",
    checking: "Zahlen werden geprüft",
    close: "Schließen",
    logged: "Eingetragen",
    today: "Heute",
    waitingToSend: "Wartet aufs Senden",
    noFood: "Kein Essen auf diesem",
    tryAnotherPhoto: "Versuch ein anderes Foto",
    roughGuess: "Grobe Schätzung",
    roughAsk: "Etwa {grams} g {item}?",
    roughAbout: "Ungefähr so viel",
    roughHalf: "Die Hälfte davon",
    roughMore: "Eher {grams} g",
    roughSent: "Etwa {grams} g {item}",
    edit: "Bearbeiten",
    agree: "Stimmt",
    firstVerdict: "Dein erstes Urteil",
    correct: "Korrigieren",
    continueCta: "Weiter",
    analysisFailedNote: "Nichts wurde eingetragen. Dein Foto bleibt gespeichert.",
    unknownTitle: "Das ist nicht sauber durchgegangen.",
    unknownNote: "Behalten und wird von selbst erneut gesendet — erneutes Senden ist sicher.",
    verdictDetail: "Für eine Mahlzeit ist das viel: {noun} {amount} von {target} {unit}. Nimm es für den Rest des Tages lockerer.",
    satfatNoun: "Gesättigte Fette",
    sodiumNoun: "Natrium",
    dayEaten: "{eaten} von {plan} kcal",
    dayOfPlan: "von {plan} kcal",
    dayLeft: "{left} übrig",
    dayOver: "{over} zu viel",
    web: {
      title: "Ein Foto vom Essen",
      dropHint: "Foto hier ablegen",
      chooseFile: "oder wähl eine Datei · JPEG, PNG oder WebP",
      analyzeCta: "Analysieren",
      chatInstead: "oder erzähl es {coach} im Chat",
      fromPhoto: "von einem Foto",
      failedTitle: "Die Analyse ist nicht zurückgekommen.",
      sendAgain: "Erneut senden",
    },
    phone: {
      cameraTitle: "Eine Mahlzeit, jeder Winkel",
      cameraHint: "Ein zweites Bild von der Seite hilft bei den Portionen",
      shotCount: "{n} von {total}",
      analyzeCta: "Analysieren",
      pickTitle: "Foto wählen",
      pickHint: "Beliebige Winkel derselben Mahlzeit",
      cameraOffTitle: "Kamerazugriff ist aus",
      cameraOffNote: "Aktivier ihn in den Einstellungen oder wähl ein Foto, das du schon hast.",
      pickLibrary: "Stattdessen aus der Bibliothek",
      refusedTitle: "Das ließ sich nicht eintragen",
      failedTitle: "Die Analyse ist nicht zurückgekommen",
      tryAgain: "Erneut versuchen",
      formatTitle: "Dieses Fotoformat ist nicht lesbar",
      formatNote: "JPEG, PNG oder WebP — oder fotografier den Teller.",
      shutterLabel: "Foto aufnehmen",
      libraryLabel: "Aus der Bibliothek wählen",
      removeShotLabel: "Dieses Bild entfernen",
      noteLabel: "Notiz zu dieser Mahlzeit",
      editSend: "Senden",
      lockHeading: "Fotos brauchen ein Abo",
      failedSampleNote: "Nichts wurde eingetragen, aber es hat trotzdem gezählt — und das war das letzte deiner Probe. Das nächste Foto braucht ein Abo.",
      capGlobalTitle: "Budget für heute aufgebraucht",
      capGlobalNote: "Das geteilte Tagesbudget für Analysen ist aufgebraucht. Es setzt um Mitternacht zurück.",
      capAddressTitle: "Zu viele Fotos aus diesem Netzwerk",
      capAddressNote: "Nicht dein Limit — das des Netzwerks. In geteilten oder mobilen Netzen später noch einmal oder über eine andere Verbindung versuchen.",
      capUserTitle: "Das war dein letztes Foto heute",
      capUserNote: "Dein Tageslimit ist erreicht. Es setzt um Mitternacht zurück — der Chat läuft weiter.",
      capUnknownTitle: "Das lief auf ein Limit",
      capUnknownNote: "Nichts wurde eingetragen oder gezählt. Versuch es später noch einmal — der Chat läuft weiter.",
      setupTitle: "Erst die Einrichtung fertig machen",
      setupNote: "Wir brauchen dein Ziel und dein Gewicht, bevor eine Mahlzeit beurteilt werden kann.",
      longNoteTitle: "Die Notiz ist zu lang",
      longNoteNote: "Bleib unter {max} Zeichen. Nichts wurde eingetragen.",
      libraryFailTitle: "Deine Fotos lassen sich nicht öffnen",
      libraryFailNote: "eait braucht die Erlaubnis, ein gewähltes Foto zu lesen. Erteile sie in Einstellungen → eait, oder fotografier hier.",
      captureFailTitle: "Die Kamera hat das nicht genommen",
      captureFailNote: "Versuch es noch einmal.",
      noPhotoTitle: "Erst ein Foto machen oder wählen",
      noPhotoNote: "Ein Foto der Mahlzeit ist, was die Analyse liest.",
      serverFailTitle: "eait hatte ein Problem",
      serverFailNote: "Der Server hat bei dem versagt, nicht deine Verbindung. Nichts wurde eingetragen oder gezählt.",
      offlineTitle: "eait nicht erreichbar",
      offlineNote: "Nichts wurde eingetragen. Prüf deine Verbindung.",
    },
  },
  it: {
    notePlaceholder: "Qualcosa che non vedo? Salsiccia, non zucchine…",
    reading: "Lettura del piatto. Un attimo per i numeri.",
    checking: "Controllo dei numeri",
    close: "Chiudi",
    logged: "Registrato",
    today: "Oggi",
    waitingToSend: "In attesa di invio",
    noFood: "Nessun cibo in questa",
    tryAnotherPhoto: "Prova un’altra foto",
    roughGuess: "Stima approssimativa",
    roughAsk: "Circa {grams} g di {item}?",
    roughAbout: "Più o meno quello",
    roughHalf: "La metà",
    roughMore: "Più tipo {grams} g",
    roughSent: "Circa {grams} g di {item}",
    edit: "Modifica",
    agree: "Va bene",
    firstVerdict: "Il tuo primo verdetto",
    correct: "Correggi",
    continueCta: "Continua",
    analysisFailedNote: "Niente è stato registrato. La tua foto è conservata.",
    unknownTitle: "Non si è concluso bene.",
    unknownNote: "Conservato e rispedito da solo — rispedire è sicuro.",
    verdictDetail: "Per un pasto è tanto: {noun} {amount} su {target} {unit}. Vacci piano per il resto di oggi.",
    satfatNoun: "Grassi saturi",
    sodiumNoun: "Sodio",
    dayEaten: "{eaten} di {plan} kcal",
    dayOfPlan: "di {plan} kcal",
    dayLeft: "ne restano {left}",
    dayOver: "{over} in più",
    web: {
      title: "Una foto del pasto",
      dropHint: "Trascina qui una foto",
      chooseFile: "o scegli un file · JPEG, PNG o WebP",
      analyzeCta: "Analizza",
      chatInstead: "o raccontalo a {coach} in Chat",
      fromPhoto: "da una foto",
      failedTitle: "L’analisi non è tornata.",
      sendAgain: "Inviala di nuovo",
    },
    phone: {
      cameraTitle: "Un pasto, da qualsiasi angolazione",
      cameraHint: "Un secondo scatto di lato aiuta con le porzioni",
      shotCount: "{n} di {total}",
      analyzeCta: "Analizza",
      pickTitle: "Scegli una foto",
      pickHint: "Qualsiasi angolazione dello stesso pasto",
      cameraOffTitle: "L’accesso alla fotocamera è disattivato",
      cameraOffNote: "Attivalo in Impostazioni, o scegli una foto che hai già scattato.",
      pickLibrary: "Scegli dalla libreria",
      refusedTitle: "Non si è potuto registrare",
      failedTitle: "L’analisi non è tornata",
      tryAgain: "Riprova",
      formatTitle: "Questo formato di foto non si legge",
      formatNote: "JPEG, PNG o WebP — oppure fotografa il piatto.",
      shutterLabel: "Scatta una foto",
      libraryLabel: "Scegli dalla libreria",
      removeShotLabel: "Rimuovi questo scatto",
      noteLabel: "Nota su questo pasto",
      editSend: "Invia",
      lockHeading: "Le foto richiedono un abbonamento",
      failedSampleNote: "Niente è stato registrato, ma ha comunque contato — ed era l’ultima della tua prova. La prossima foto richiede un abbonamento.",
      capGlobalTitle: "Budget di oggi esaurito",
      capGlobalNote: "Il budget giornaliero condiviso per le analisi è esaurito. Riparte a mezzanotte.",
      capAddressTitle: "Troppe foto da questa rete",
      capAddressNote: "Non il tuo limite — quello della rete. Se sei su una rete condivisa o mobile, riprova più tardi o da un’altra connessione.",
      capUserTitle: "Quella era la tua ultima foto di oggi",
      capUserNote: "Il tuo limite giornaliero è finito. Riparte a mezzanotte — la chat funziona ancora.",
      capUnknownTitle: "Quello ha toccato un limite",
      capUnknownNote: "Niente è stato registrato né contato. Riprova più tardi — la chat funziona ancora.",
      setupTitle: "Finisci prima la configurazione",
      setupNote: "Ci servono il tuo obiettivo e il tuo peso prima di poter giudicare un pasto.",
      longNoteTitle: "La nota è troppo lunga",
      longNoteNote: "Resta sotto {max} caratteri. Niente è stato registrato.",
      libraryFailTitle: "Impossibile aprire le tue foto",
      libraryFailNote: "eait ha bisogno del permesso per leggere una foto che scegli. Concedilo in Impostazioni → eait, o scatta qui.",
      captureFailTitle: "La fotocamera non l’ha presa",
      captureFailNote: "Riprova.",
      noPhotoTitle: "Scatta o scegli prima una foto",
      noPhotoNote: "È una foto del pasto quella che l’analisi legge.",
      serverFailTitle: "eait ha avuto un problema",
      serverFailNote: "Il server ha fallito su quella, non la tua connessione. Niente è stato registrato né contato.",
      offlineTitle: "Impossibile raggiungere eait",
      offlineNote: "Niente è stato registrato. Controlla la connessione.",
    },
  },
  es: {
    notePlaceholder: "¿Algo que no veo? Salchicha, no calabacín…",
    reading: "Leyendo el plato. Un momento para los números.",
    checking: "Revisando los números",
    close: "Cerrar",
    logged: "Registrado",
    today: "Hoy",
    waitingToSend: "Esperando para enviarse",
    noFood: "No hay comida en esta",
    tryAnotherPhoto: "Prueba otra foto",
    roughGuess: "Estimación aproximada",
    roughAsk: "¿Unos {grams} g de {item}?",
    roughAbout: "Más o menos eso",
    roughHalf: "La mitad",
    roughMore: "Más bien {grams} g",
    roughSent: "Unos {grams} g de {item}",
    edit: "Editar",
    agree: "De acuerdo",
    firstVerdict: "Tu primer veredicto",
    correct: "Corregir",
    continueCta: "Continuar",
    analysisFailedNote: "No se registró nada. Tu foto se conserva.",
    unknownTitle: "Eso no terminó bien.",
    unknownNote: "Se conserva y se reenvía solo — reenviarlo es seguro.",
    verdictDetail: "Para una comida es mucho: {noun} {amount} de {target} {unit}. Ve con calma el resto del día.",
    satfatNoun: "Grasas saturadas",
    sodiumNoun: "Sodio",
    dayEaten: "{eaten} de {plan} kcal",
    dayOfPlan: "de {plan} kcal",
    dayLeft: "quedan {left}",
    dayOver: "{over} de más",
    web: {
      title: "Una foto de la comida",
      dropHint: "Suelta una foto aquí",
      chooseFile: "o elige un archivo · JPEG, PNG o WebP",
      analyzeCta: "Analizar",
      chatInstead: "o cuéntaselo a {coach} en Chat",
      fromPhoto: "de una foto",
      failedTitle: "El análisis no volvió.",
      sendAgain: "Enviarla de nuevo",
    },
    phone: {
      cameraTitle: "Una comida, desde cualquier ángulo",
      cameraHint: "Una segunda toma de lado ayuda con las porciones",
      shotCount: "{n} de {total}",
      analyzeCta: "Analizar",
      pickTitle: "Elige una foto",
      pickHint: "Cualquier ángulo de la misma comida",
      cameraOffTitle: "El acceso a la cámara está desactivado",
      cameraOffNote: "Actívalo en Ajustes, o elige una foto que ya hayas hecho.",
      pickLibrary: "Elegir de la biblioteca",
      refusedTitle: "No se pudo registrar",
      failedTitle: "El análisis no volvió",
      tryAgain: "Reintentar",
      formatTitle: "Ese formato de foto no se puede leer",
      formatNote: "JPEG, PNG o WebP — o fotografía el plato.",
      shutterLabel: "Hacer una foto",
      libraryLabel: "Elegir de la biblioteca",
      removeShotLabel: "Quitar esta foto",
      noteLabel: "Nota sobre esta comida",
      editSend: "Enviar",
      lockHeading: "Las fotos necesitan una suscripción",
      failedSampleNote: "No se registró nada, pero aun así contó — y era la última de tu prueba. La siguiente foto necesita una suscripción.",
      capGlobalTitle: "Sin presupuesto para hoy",
      capGlobalNote: "El presupuesto diario compartido de análisis se agotó. Se reinicia a medianoche.",
      capAddressTitle: "Demasiadas fotos desde esta red",
      capAddressNote: "No tu límite — el de la red. Si estás en una red compartida o móvil, inténtalo más tarde o desde otra conexión.",
      capUserTitle: "Esa era tu última foto de hoy",
      capUserNote: "Tu límite diario se agotó. Se reinicia a medianoche — el chat sigue funcionando.",
      capUnknownTitle: "Esa topó con un límite",
      capUnknownNote: "No se registró ni contó nada. Inténtalo más tarde — el chat sigue funcionando.",
      setupTitle: "Termina primero la configuración",
      setupNote: "Necesitamos tu objetivo y tu peso antes de poder juzgar una comida.",
      longNoteTitle: "Esa nota es demasiado larga",
      longNoteNote: "Quédate por debajo de {max} caracteres. No se registró nada.",
      libraryFailTitle: "No se pueden abrir tus fotos",
      libraryFailNote: "eait necesita permiso para leer una foto que elijas. Concédelo en Ajustes → eait, o hazla aquí.",
      captureFailTitle: "La cámara no hizo esa",
      captureFailNote: "Inténtalo de nuevo.",
      noPhotoTitle: "Haz o elige primero una foto",
      noPhotoNote: "Una foto de la comida es lo que lee el análisis.",
      serverFailTitle: "eait tuvo un problema",
      serverFailNote: "El servidor falló en esa, no tu conexión. No se registró ni contó nada.",
      offlineTitle: "No se pudo contactar con eait",
      offlineNote: "No se registró nada. Revisa tu conexión.",
    },
  },
  vi: {
    notePlaceholder: "Có gì tôi không nhìn thấy không? Xúc xích, không phải bí ngòi…",
    reading: "Đang đọc đĩa ăn. Một lát cho các con số.",
    checking: "Đang kiểm tra các con số",
    close: "Đóng",
    logged: "Đã ghi",
    today: "Hôm nay",
    waitingToSend: "Đang chờ gửi",
    noFood: "Không có đồ ăn trong ảnh này",
    tryAnotherPhoto: "Thử ảnh khác",
    roughGuess: "Ước lượng thô",
    roughAsk: "{item} khoảng {grams} g đúng không?",
    roughAbout: "Khoảng đó",
    roughHalf: "Chỉ một nửa",
    roughMore: "Gần {grams} g hơn",
    roughSent: "{item} khoảng {grams} g",
    edit: "Sửa",
    agree: "Đồng ý",
    firstVerdict: "Phán quyết đầu tiên của bạn",
    correct: "Điều chỉnh",
    continueCta: "Tiếp tục",
    analysisFailedNote: "Chưa ghi gì. Ảnh của bạn vẫn được giữ.",
    unknownTitle: "Lần đó chưa hoàn tất trọn vẹn.",
    unknownNote: "Đã giữ lại và tự gửi lại — gửi lại vẫn an toàn.",
    verdictDetail: "{noun} cao cho một bữa: {amount} trong {target} {unit} của bạn. Hãy nhẹ tay phần còn lại của hôm nay.",
    satfatNoun: "Chất béo bão hoà",
    sodiumNoun: "Natri",
    dayEaten: "{eaten} trên {plan} kcal",
    dayOfPlan: "trên {plan} kcal",
    dayLeft: "còn {left}",
    dayOver: "{over} vượt quá",
    web: {
      title: "Ảnh chụp bữa ăn",
      dropHint: "Thả ảnh vào đây",
      chooseFile: "hoặc chọn tệp · JPEG, PNG hoặc WebP",
      analyzeCta: "Phân tích",
      chatInstead: "hoặc kể cho {coach} trong Chat",
      fromPhoto: "từ ảnh",
      failedTitle: "Phân tích không trả về.",
      sendAgain: "Gửi lại",
    },
    phone: {
      cameraTitle: "Một bữa ăn, góc nào cũng được",
      cameraHint: "Thêm một kiểu chụp từ bên cạnh giúp đo khẩu phần",
      shotCount: "{n} trên {total}",
      analyzeCta: "Phân tích",
      pickTitle: "Chọn ảnh",
      pickHint: "Chọn ảnh cùng một bữa ở góc nào cũng được",
      cameraOffTitle: "Quyền truy cập camera đang tắt",
      cameraOffNote: "Bật nó trong Cài đặt, hoặc chọn ảnh bạn đã chụp sẵn.",
      pickLibrary: "Chọn từ thư viện",
      refusedTitle: "Không ghi được món đó",
      failedTitle: "Phân tích không trả về",
      tryAgain: "Thử lại",
      formatTitle: "Định dạng ảnh đó không đọc được",
      formatNote: "JPEG, PNG hoặc WebP — hoặc chụp đĩa ăn.",
      shutterLabel: "Chụp ảnh",
      libraryLabel: "Chọn từ thư viện",
      removeShotLabel: "Xoá ảnh này",
      noteLabel: "Ghi chú về bữa này",
      editSend: "Gửi",
      lockHeading: "Chụp ảnh cần gói thuê bao",
      failedSampleNote: "Chưa ghi gì, nhưng lần đó vẫn được tính — và đó là lượt dùng thử cuối cùng. Ảnh kế tiếp cần gói thuê bao.",
      capGlobalTitle: "Hết ngân sách hôm nay",
      capGlobalNote: "Ngân sách phân tích chung trong ngày đã hết. Quay lại lúc nửa đêm.",
      capAddressTitle: "Quá nhiều ảnh từ mạng này",
      capAddressNote: "Không phải hạn mức của bạn — là của mạng. Trên mạng chung hoặc di động, thử lại sau hoặc qua kết nối khác.",
      capUserTitle: "Đó là ảnh cuối cùng của bạn hôm nay",
      capUserNote: "Hạn mức trong ngày của bạn đã hết. Quay lại lúc nửa đêm — chat vẫn hoạt động.",
      capUnknownTitle: "Cái đó chạm hạn mức",
      capUnknownNote: "Chưa ghi và chưa tính gì. Thử lại sau — chat vẫn hoạt động.",
      setupTitle: "Hoàn tất thiết lập trước đã",
      setupNote: "Chúng tôi cần mục tiêu và cân nặng của bạn trước khi chấm một bữa.",
      longNoteTitle: "Ghi chú đó quá dài",
      longNoteNote: "Giữ dưới {max} ký tự. Chưa ghi gì.",
      libraryFailTitle: "Không mở được ảnh của bạn",
      libraryFailNote: "eait cần quyền đọc ảnh bạn chọn. Cấp quyền trong Cài đặt → eait, hoặc chụp ngay tại đây.",
      captureFailTitle: "Máy ảnh không chụp được ảnh đó",
      captureFailNote: "Thử lại nhé.",
      noPhotoTitle: "Chụp hoặc chọn ảnh trước đã",
      noPhotoNote: "Ảnh bữa ăn là thứ phân tích đọc.",
      serverFailTitle: "eait gặp sự cố",
      serverFailNote: "Máy chủ lỗi trên ảnh đó, không phải kết nối của bạn. Chưa ghi và chưa tính gì.",
      offlineTitle: "Không kết nối được với eait",
      offlineNote: "Chưa ghi gì. Kiểm tra kết nối của bạn.",
    },
  },
  id: {
    notePlaceholder: "Ada yang tidak terlihat? Sosis, bukan zukini…",
    reading: "Membaca piringnya. Sebentar untuk angkanya.",
    checking: "Memeriksa angka",
    close: "Tutup",
    logged: "Tercatat",
    today: "Hari ini",
    waitingToSend: "Menunggu untuk dikirim",
    noFood: "Tidak ada makanan di yang ini",
    tryAnotherPhoto: "Coba foto lain",
    roughGuess: "Perkiraan kasar",
    roughAsk: "Apakah {item} sekitar {grams} g?",
    roughAbout: "Kira-kira segitu",
    roughHalf: "Setengahnya saja",
    roughMore: "Lebih ke {grams} g",
    roughSent: "{item} sekitar {grams} g",
    edit: "Ubah",
    agree: "Setuju",
    firstVerdict: "Penilaian pertamamu",
    correct: "Koreksi",
    continueCta: "Lanjut",
    analysisFailedNote: "Tidak ada yang tercatat. Fotomu tetap disimpan.",
    unknownTitle: "Yang tadi tidak selesai dengan bersih.",
    unknownNote: "Disimpan, dan dikirim ulang sendiri — mengirim ulang aman.",
    verdictDetail: "{noun} tinggi untuk satu kali makan: {amount} dari {target} {unit} milikmu. Ringankan sisa hari ini.",
    satfatNoun: "Lemak jenuh",
    sodiumNoun: "Natrium",
    dayEaten: "{eaten} dari {plan} kcal",
    dayOfPlan: "dari {plan} kcal",
    dayLeft: "sisa {left}",
    dayOver: "{over} berlebih",
    web: {
      title: "Foto makanannya",
      dropHint: "Taruh foto di sini",
      chooseFile: "atau pilih berkas · JPEG, PNG atau WebP",
      analyzeCta: "Analisis",
      chatInstead: "atau ceritakan ke {coach} di Chat",
      fromPhoto: "dari foto",
      failedTitle: "Analisisnya tidak kembali.",
      sendAgain: "Kirim lagi",
    },
    phone: {
      cameraTitle: "Satu kali makan, sudut mana pun",
      cameraHint: "Jepretan kedua dari samping membantu memperkirakan porsi",
      shotCount: "{n} dari {total}",
      analyzeCta: "Analisis",
      pickTitle: "Pilih foto",
      pickHint: "Sudut mana pun dari makanan yang sama",
      cameraOffTitle: "Akses kamera nonaktif",
      cameraOffNote: "Nyalakan di Pengaturan, atau pilih foto yang sudah kamu ambil.",
      pickLibrary: "Pilih dari galeri",
      refusedTitle: "Tidak bisa mencatat itu",
      failedTitle: "Analisisnya tidak kembali",
      tryAgain: "Coba lagi",
      formatTitle: "Format foto itu tidak bisa dibaca",
      formatNote: "JPEG, PNG atau WebP — atau foto piringnya saja.",
      shutterLabel: "Ambil foto",
      libraryLabel: "Pilih dari galeri",
      removeShotLabel: "Hapus foto ini",
      noteLabel: "Catatan tentang makanan ini",
      editSend: "Kirim",
      lockHeading: "Foto butuh langganan",
      failedSampleNote: "Tidak ada yang tercatat, tapi tetap terhitung — dan itu yang terakhir dari uji cobamu. Foto berikutnya butuh langganan.",
      capGlobalTitle: "Anggaran hari ini habis",
      capGlobalNote: "Anggaran analisis harian bersama sudah habis. Reset tengah malam.",
      capAddressTitle: "Terlalu banyak foto dari jaringan ini",
      capAddressNote: "Bukan jatahmu — jatah jaringan. Kalau di jaringan bersama atau seluler, coba lagi nanti atau lewat koneksi lain.",
      capUserTitle: "Itu foto terakhirmu hari ini",
      capUserNote: "Jatah harianmu sudah habis. Reset tengah malam — chat tetap jalan.",
      capUnknownTitle: "Yang itu kena batas",
      capUnknownNote: "Tidak ada yang tercatat atau terhitung. Coba lagi nanti — chat tetap jalan.",
      setupTitle: "Selesaikan pengaturan dulu",
      setupNote: "Kami butuh tujuan dan beratmu sebelum bisa menilai makanan.",
      longNoteTitle: "Catatan itu terlalu panjang",
      longNoteNote: "Jaga di bawah {max} karakter. Tidak ada yang tercatat.",
      libraryFailTitle: "Fotomu tidak bisa dibuka",
      libraryFailNote: "eait butuh izin untuk membaca foto yang kamu pilih. Beri izin di Pengaturan → eait, atau ambil foto di sini.",
      captureFailTitle: "Kamera tidak mengambil yang itu",
      captureFailNote: "Coba lagi.",
      noPhotoTitle: "Ambil atau pilih foto dulu",
      noPhotoNote: "Foto makananlah yang dibaca analisis.",
      serverFailTitle: "eait mengalami masalah",
      serverFailNote: "Server yang gagal pada yang itu, bukan koneksimu. Tidak ada yang tercatat atau terhitung.",
      offlineTitle: "eait tidak bisa dihubungi",
      offlineNote: "Tidak ada yang tercatat. Periksa koneksimu.",
    },
  },
  ru: {
    notePlaceholder: "Чего я не вижу? Колбаса, а не кабачок…",
    reading: "Разбираю тарелку. Ещё мгновение — будут цифры.",
    checking: "Проверяю цифры",
    close: "Закрыть",
    logged: "Записано",
    today: "Сегодня",
    waitingToSend: "Ждёт отправки",
    noFood: "На этом фото еды нет",
    tryAnotherPhoto: "Попробовать другое фото",
    roughGuess: "Примерная оценка",
    roughAsk: "{item} — примерно {grams} г?",
    roughAbout: "Примерно столько",
    roughHalf: "Вдвое меньше",
    roughMore: "Скорее {grams} г",
    roughSent: "{item} — примерно {grams} г",
    edit: "Изменить",
    agree: "Подтвердить",
    firstVerdict: "Твой первый вердикт",
    correct: "Исправить",
    continueCta: "Продолжить",
    analysisFailedNote: "Ничего не записано. Фото сохранено.",
    unknownTitle: "Это не завершилось чисто.",
    unknownNote: "Сохранено и отправится само — повторная отправка безопасна.",
    verdictDetail: "Для одного приёма пищи это много: {noun} — {amount} из {target} {unit}. Остаток дня — умереннее.",
    satfatNoun: "Насыщенные жиры",
    sodiumNoun: "Натрий",
    dayEaten: "{eaten} из {plan} ккал",
    dayOfPlan: "из {plan} ккал",
    dayLeft: "осталось {left}",
    dayOver: "{over} сверх плана",
    web: {
      title: "Фото приёма пищи",
      dropHint: "Перетащи сюда фото",
      chooseFile: "или выбери файл · JPEG, PNG или WebP",
      analyzeCta: "Анализировать",
      chatInstead: "или расскажи {coach} об этом в Чате",
      fromPhoto: "по фото",
      failedTitle: "Анализ не вернулся.",
      sendAgain: "Отправить ещё раз",
    },
    phone: {
      cameraTitle: "Одно блюдо, любой ракурс",
      cameraHint: "Второй кадр сбоку помогает с порциями",
      shotCount: "{n} из {total}",
      analyzeCta: "Анализировать",
      pickTitle: "Выбрать фото",
      pickHint: "Любые ракурсы одного блюда",
      cameraOffTitle: "Доступ к камере выключен",
      cameraOffNote: "Включи его в Настройках или выбери уже снятое фото.",
      pickLibrary: "Выбрать из галереи",
      refusedTitle: "Не удалось записать",
      failedTitle: "Анализ не вернулся",
      tryAgain: "Ещё раз",
      formatTitle: "Этот формат фото не читается",
      formatNote: "JPEG, PNG или WebP — или сфотографируй блюдо.",
      shutterLabel: "Сделать фото",
      libraryLabel: "Выбрать из галереи",
      removeShotLabel: "Убрать этот кадр",
      noteLabel: "Заметка к этому приёму",
      editSend: "Отправить",
      lockHeading: "Фото доступны по подписке",
      failedSampleNote: "Ничего не записано, но это всё же посчиталось — и это была последняя из пробной. Следующее фото уже по подписке.",
      capGlobalTitle: "Бюджет на сегодня исчерпан",
      capGlobalNote: "Общий дневной бюджет анализов исчерпан. Обнулится в полночь.",
      capAddressTitle: "Слишком много фото из этой сети",
      capAddressNote: "Не твоё ограничение — сети. Если ты в общей или мобильной сети, попробуй позже или с другого подключения.",
      capUserTitle: "Это было последнее фото на сегодня",
      capUserNote: "Твоё дневное ограничение исчерпано. Обнулится в полночь — чат по-прежнему работает.",
      capUnknownTitle: "Оно уперлось в лимит",
      capUnknownNote: "Ничего не записано и не засчитано. Попробуй позже — чат по-прежнему работает.",
      setupTitle: "Сначала заверши настройку",
      setupNote: "Нужны твоя цель и вес, прежде чем можно будет оценить приём.",
      longNoteTitle: "Заметка слишком длинная",
      longNoteNote: "Держи короче {max} знаков. Ничего не записано.",
      libraryFailTitle: "Не удаётся открыть твои фото",
      libraryFailNote: "eait нужно разрешение на чтение выбранного фото. Дай его в Настройках → eait или сфотографируй здесь.",
      captureFailTitle: "Камера не сняла этот кадр",
      captureFailNote: "Попробуй ещё раз.",
      noPhotoTitle: "Сначала сними или выбери фото",
      noPhotoNote: "Именно фото приёма читает анализ.",
      serverFailTitle: "У eait что-то пошло не так",
      serverFailNote: "Сервер не справился с этим, а не твоя связь. Ничего не записано и не засчитано.",
      offlineTitle: "eait недоступен",
      offlineNote: "Ничего не записано. Проверь соединение.",
    },
  },
};

export const logCopyFor = (lang: Lang): LogCopy => t(lang)(LOG_COPY);
