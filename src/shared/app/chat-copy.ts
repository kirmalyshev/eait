// The chat surface's words (W7 #94, mobile M7): the thread screen's chrome — the first-open
// greeting, the composer's two prompts, the proposal card, the coach answer's macro bar, and the
// send/load states the outbox can surface.
//
// Boards (ieat-app `product/design/pro/`, main at 3d2b4357): `web/chat.html`, `web/chat-empty.html`,
// `web/chat-proposal.html`, `web/chat-coach.html`, `web/states-chat-failed.html`,
// `web/states-offline.html`, `web/states-failed.html`, `web/states-unknown.html`, and
// `phone/chat.html`, `phone/chat-empty.html`, `phone/chat-proposal.html`, `phone/chat-coach.html`,
// `phone/chat-busy.html`, `phone/chat-expired.html`, `phone/states-chat-failed.html`,
// `phone/states-offline.html`, `phone/states-not-sent.html`, `phone/states-unknown.html`,
// `phone/states-failed.html`. Keys shown by both clients are plain; keys only one client draws sit
// under `web`/`phone` (the claim rule on #94).
//
// WHAT IS NOT HERE, and whose table it is instead: the nav labels and the "Log a meal" fab are
// `SHELL_COPY`; the coach's signature "{coach} · nutritionist" and the
// macro TILE labels are `MEAL_COPY`'s (`coachLine`, `macro*` — #116 fills `{coach}`
// from `THREAD_COPY`'s `coach.name`, S9); the card's verdict lines ("Calories high") are
// `verdicts.ts`'s, computed and never reworded per surface; the running line and the starters are
// `THREAD_COPY`'s; the coach's ANSWERS are model-written or engine-scripted — the largest text
// surface is in no table; `phone/states-failed.html` is the log surface's standalone screen (its
// "One meal, any angle" and "Close" belong to that table), while `web/states-failed.html` draws the
// same failure inside Chat and IS here. Dates and times are `Intl`; a kcal figure's unit is
// `UNIT_KCAL`.
//
// ONE DEVIATION, flagged rather than adjusted: `phone/chat-busy.html`'s aria-label says "Spud is
// typing" — the direction's coach is Spud (#1041): `phone.typing` is "{coach} is typing".
//
// RUSSIAN: no past-tense verb may describe the reader (`genderedRussian` walks this table), so the
// composer's "What did you eat?" asks about the plate, not about "ты ел". The gram beside a figure
// is a symbol inside the template — "{n}г" — never a declined word.

import { t, type Localized } from "../lang.ts";
import { STRUGGLES, type Lang, type Struggle } from "../types.ts";
import type { IconName } from "../ui/icons.ts";

export interface ChatScreenCopy {
  /** First open (web + phone `chat-empty.html`, `chat-coach.html`): the coach's opening line. */
  greeting: string;
  /**
   * The composer's short prompt (web + phone `chat-empty.html`, `chat-proposal.html`,
   * `chat-coach.html`, `phone/chat-busy.html`, `phone/chat-expired.html`,
   * `phone/states-not-sent.html`) — and the same sentence as the coach's ask on
   * `phone/chat-busy.html` and `states-unknown.html`.
   */
  composerAsk: string;
  /**
   * The composer over a live thread (`chat.html`, `states-chat-failed.html`,
   * `states-offline.html`, `states-unknown.html` — web + phone). `{coach}` is the coach's name,
   * never a literal.
   */
  composerThread: string;

  /** The proposal card's question (web + phone `chat-proposal.html`, `phone/chat-expired.html`). */
  proposalCheck: string;
  /** Its two answers (`chat-proposal.html`, both clients). */
  proposalAccept: string;
  proposalDecline: string;

  /**
   * The coach answer's macro bar (`chat-coach.html`, both clients): the bar's title is the macro's
   * name, TITLE-case as drawn — `MEAL_COPY.macro*` are the tile labels and read lowercase there.
   * A calories or saturated-fat bar reads `verdictNoun` instead of this map.
   */
  /**
   * `kcal` and `satfat` name the cap, not the macro — the verdict nouns "Calories" and
   * "Saturated fat" (`verdict.noun.weight`/`ldl`), typed here because this bundle holds no
   * i18n catalog to call `verdictNoun` with (#145).
   */
  macroLabels: { protein: string; carbs: string; fat: string; kcal: string; satfat: string };
  /**
   * The figure beside the bar as its TWO halves — the `wholeNumbers` slot, then the "of 109g"
   * tail, `{unit}` being kcal on the calories bar — so a client composes `macroEaten` +
   * `macroTarget` rather than splitting a template on `{value}` (a cut no translation may reorder
   * or rewrite).
   */
  macroEaten: string;
  macroTarget: string;
  /**
   * The first-open starter rows (`chat-empty.html`, both clients), keyed by the struggle each
   * asks. The words are `THREAD_COPY`'s `coachStarters` values restated as a Localized map —
   * the bundle has no catalog (#145), so the row text must sit in a table it can read.
   */
  starters: Record<Struggle, string>;
  /**
   * The meal named on ONE line — the focus sheet's caption and the thread's shrunken card alike:
   * "{name} — {kcal}", `names()` and `kcal()` either side, never a literal join in code.
   */
  mealLine: string;

  /** The pager affordance over the thread's oldest page, both clients. */
  earlier: string;
  /**
   * A card moved to another day by a correction — "Moved — now on yesterday." `{day}` is a
   * `dayLabel` word, lower-case inside the sentence as the languages write it.
   */
  movedCaption: string;

  /** A proposal left unanswered too long (`phone/chat-expired.html`, the web's same card). */
  expired: string;

  /** `states-chat-failed.html`, both clients: the load failure and its button. */
  loadFailed: string;
  /** The retry button — `states-chat-failed.html`, both clients (and phone's `states-failed.html`). */
  tryAgain: string;

  /**
   * `states-offline.html`, both clients: the coach line above the failed photo, the two failure
   * lines, and the resend — which works the existing outbox, not a second queue.
   */
  eitherWorks: string;
  offlineTitle: string;
  offlineBody: string;
  sendAgain: string;

  /** `states-unknown.html`, both clients: outcome unknown — kept, and re-sent on its own. */
  waitingToSend: string;
  unknownTitle: string;
  /** The UNANSWERED row's line — that turn does go out again on its own (`attemptOf`: retry). */
  unknownBody: string;
  /**
   * A HELD outcome-unknown turn is never re-sent on its own, and its resend mints a new id —
   * so "re-sent on its own" would be false, and "sending again is safe" could log a turn that
   * ran twice. It says what is actually known and hands the decision over (#1106).
   */
  unknownHeldBody: string;

  /**
   * The analysis's failure, drawn INSIDE chat on web (`web/states-failed.html`) and as the log
   * surface's standalone screen on phone (`phone/states-failed.html`) — both clients read the
   * same words.
   */
  analysisFailed: string;
  analysisKept: string;

  /** Web-only keys. */
  web: {
    /** The in-chat resend on `web/states-failed.html` (phone's screen says `tryAgain`). */
    sendItAgain: string;
  };
  /** Phone-only keys. */
  phone: {
    /** The send spinner's caption and aria-label (`phone/chat-busy.html`). */
    sending: string;
    /** The typing indicator's aria-label (`phone/chat-busy.html` — the board's literal reads "Spud", which is the coach since #1041: `{coach}`). */
    typing: string;
    /** The outbox row's own words (`phone/states-not-sent.html`); M7's client reads this key. */
    notSent: string;
    /** A turn the server answered with a refusal, kept for a purchase — never sent is not the same thing. */
    notLogged: string;
    /** A turn that ran out of time: its words are back in the message field, and Send resends. */
    timedOut: string;
    /** A photo line's accessible name — alone, and with its caption in `{caption}`. */
    photo: string;
    photoCaption: string;
    /** The kept turn's way out beside `sendAgain`, and the confirm the tap opens. */
    discard: string;
    discardQ: string;
    discardNote: string;
    /** The alert when the queue already took the turn a discard was meant for. */
    onItsWayTitle: string;
    onItsWayNote: string;
    /**
     * The line-menu verbs and confirms — a photo line is its meal, so it edits and its delete
     * takes the meal; a text line only removes, and its numbers stay.
     */
    edit: string;
    delete: string;
    remove: string;
    cancel: string;
    deleteMealQ: string;
    deleteMealNote: string;
    deleteLineQ: string;
    deleteLineNote: string;
    /** The VoiceOver hint naming the long-press on the user's own line. */
    holdActions: string;
    holdDelete: string;
    /** A photo line's accessible name when the words went as an image. */
    photoMessage: string;
    /** `identity-required` — the refusal's way out, as a button. */
    signInOffer: string;
    /** A `target-gone` answer: the meal the turn was about no longer exists. */
    goneTitle: string;
    goneRedateNote: string;
    goneApplyTitle: string;
    goneApplyNote: string;
    /**
     * The refusal sentences a turn rests on, said in the say column — the same decision web takes
     * through `refusalWords`, by the refusal's kind and scope. The refusal the paywall answers
     * (`subscription-required`) and the sign-in door (`identity-required`) carry no words here.
     */
    refusals: {
      /** `not-food` — a single quiet line, no pair. */
      notFood: string;
      /** `cap-exceeded`, scope `global`. */
      capGlobalTitle: string;
      capGlobalNote: string;
      /** `cap-exceeded`, scope `address` — NOT the reader's own allowance. */
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
      /** `text too long` — `{max}` is the bound. */
      longTextTitle: string;
      longTextNote: string;
      /** `caption too long` — a photo's note, so "nothing was logged" is said. */
      longNoteTitle: string;
      longNoteNote: string;
      /** `unsupported-image`, `no photo`. */
      unreadableTitle: string;
      unreadableNote: string;
      /** `too large`. */
      tooLargeTitle: string;
      tooLargeNote: string;
      /** `too many photos`. */
      tooManyTitle: string;
      tooManyNote: string;
      /** `analysis-failed`; the `*SampleNote` variant when the failure spent the last free meal. */
      failedTitle: string;
      failedNote: string;
      failedSampleNote: string;
      /** `unanswered` — the turn reached the server, its proposal's card never came back. */
      unansweredTitle: string;
      unansweredNote: string;
      unansweredSampleNote: string;
      /** outcome-unknown — the server may have finished the turn it never answered (#514). */
      maybeLandedTitle: string;
      maybeLandedNote: string;
      /** Nothing answered at all — the connection, not the server. */
      unreachableTitle: string;
      unreachableNote: string;
    };
  };
}

export const CHAT_SCREEN_COPY: Localized<ChatScreenCopy> = {
  en: {
    greeting: "Tell me what you ate, or ask me anything.",
    composerAsk: "What did you eat?",
    mealLine: "{name} — {kcal}",
    earlier: "Earlier messages",
    movedCaption: "Moved — now on {day}.",
    composerThread: "Tell {coach} what you ate, or ask",
    proposalCheck: "Logging to today — look right?",
    proposalAccept: "Log it",
    proposalDecline: "No",
    expired: "That one timed out. Describe it again and I'll re-read it.",
    macroLabels: { protein: "Protein", carbs: "Carbs", fat: "Fat", kcal: "Calories", satfat: "Saturated fat" },
    starters: { consistency: "How's my week going?", habits: "What's a lighter swap for dinner?", support: "Am I getting enough protein?", busy: "I'll just tell you what I ate", ideas: "What should I eat tonight?" },
    macroEaten: "{value}",
    macroTarget: "of {target}{unit}",
    loadFailed: "Couldn't load the conversation.",
    tryAgain: "Try again",
    eitherWorks: "Photograph it or tell me — either works",
    offlineTitle: "Couldn't reach eait.",
    offlineBody: "Nothing was logged.",
    sendAgain: "Send again",
    waitingToSend: "Waiting to send",
    unknownTitle: "That didn't finish cleanly.",
    unknownBody: "Kept, and re-sent on its own — sending again is safe.",
    unknownHeldBody: "We couldn't confirm this went through. Check your day before sending it again, or discard it.",
    analysisFailed: "The analysis didn't come back.",
    analysisKept: "Nothing was logged. Your photo is kept.",
    web: { sendItAgain: "Send it again" },
    phone: {
      sending: "Sending",
      typing: "{coach} is typing",
      notSent: "Not sent. It's back in the box.",
      notLogged: "Not logged. It's back in the box.",
      timedOut: "That one timed out. It's back in the box, send it again.",
      photo: "Photo",
      photoCaption: "Photo: {caption}",
      discard: "Discard",
      discardQ: "Discard this?",
      discardNote: "It hasn't been logged, and it won't be.",
      onItsWayTitle: "Already on its way",
      onItsWayNote: "It was sent before you discarded it, so it will be logged. You can delete it from Chat once it lands.",
      edit: "Edit",
      delete: "Delete",
      remove: "Remove",
      cancel: "Cancel",
      deleteMealQ: "Delete this meal?",
      deleteMealNote: "Its photos and numbers go too.",
      deleteLineQ: "Remove this message?",
      deleteLineNote: "Numbers stay.",
      holdActions: "Hold for Edit and Delete",
      holdDelete: "Hold to delete",
      photoMessage: "Your photo message",
      signInOffer: "Sign in with Apple or Google",
      goneTitle: "That meal is gone",
      goneRedateNote: "It was deleted, so there is nothing to move.",
      goneApplyTitle: "Couldn't apply that",
      goneApplyNote: "The meal was deleted before the change landed. Log it again if you still need it.",
      refusals: {
        notFood: "I couldn't find any food in that.",
        capGlobalTitle: "The instance is out of budget for today",
        capGlobalNote: "Not you — everyone. It resets at midnight.",
        capAddressTitle: "Too many from this network",
        capAddressNote: "Not you — this connection. Shared and mobile networks hit this together. Try again later or from another connection.",
        capUserTitle: "That's your last one today",
        capUserNote: "Your daily photo allowance is spent. It resets at midnight.",
        capUnknownTitle: "That one hit a limit",
        capUnknownNote: "Nothing was logged. Try again later.",
        setupTitle: "Finish setting up first",
        setupNote: "We need your goal and weight before anything can be judged.",
        longTextTitle: "Too long for one message",
        longTextNote: "Keep it under {max} characters.",
        longNoteTitle: "That note is too long",
        longNoteNote: "Keep it under {max} characters. Nothing was logged.",
        unreadableTitle: "That photo can't be read",
        unreadableNote: "Nothing was logged and nothing was counted.",
        tooLargeTitle: "That photo is too large to send",
        tooLargeNote: "Nothing was logged and nothing was counted.",
        tooManyTitle: "More angles than one meal takes",
        tooManyNote: "Nothing was logged and nothing was counted.",
        failedTitle: "That didn't go through",
        failedNote: "Try again in a moment.",
        failedSampleNote: "It still counted, and that was the last of your sample — the next meal needs a subscription.",
        unansweredTitle: "That one reached me, but the answer didn't",
        unansweredNote: "It's here, send it again.",
        unansweredSampleNote: "Nothing was logged, but it counted, and that was the last of your sample — the next meal needs a subscription.",
        maybeLandedTitle: "That one reached me, but didn't finish",
        maybeLandedNote: "It may have gone through. Check before sending it again.",
        unreachableTitle: "Couldn't reach eait",
        unreachableNote: "Nothing was logged. Check your connection, then send it again.",
      },
    },
  },
  fr: {
    greeting: "Raconte-moi ce que tu as mangé, ou demande-moi n'importe quoi.",
    composerAsk: "Qu'as-tu mangé ?",
    mealLine: "{name} — {kcal}",
    earlier: "Messages plus anciens",
    movedCaption: "Déplacé — nouveau jour : {day}.",
    composerThread: "Dis à {coach} ce que tu as mangé, ou demande",
    proposalCheck: "Je l'ajoute à aujourd'hui — ça te va ?",
    proposalAccept: "Enregistrer",
    proposalDecline: "Non",
    expired: "Celui-là a expiré. Décris-le à nouveau et je le relis.",
    macroLabels: { protein: "Protéines", carbs: "Glucides", fat: "Lipides", kcal: "Calories", satfat: "Graisses saturées" },
    starters: { consistency: "Ma semaine se passe comment ?", habits: "Une alternative plus légère pour le dîner ?", support: "J'ai assez de protéines ?", busy: "Je te dis juste ce que j'ai mangé", ideas: "Je mange quoi ce soir ?" },
    macroEaten: "{value}",
    macroTarget: "sur {target}{unit}",
    loadFailed: "Impossible de charger la conversation.",
    tryAgain: "Réessayer",
    eitherWorks: "Photographie-le ou raconte-le-moi — les deux marchent",
    offlineTitle: "Impossible de joindre eait.",
    offlineBody: "Rien n'a été enregistré.",
    sendAgain: "Renvoyer",
    waitingToSend: "En attente d'envoi",
    unknownTitle: "Ça ne s'est pas terminé proprement.",
    unknownBody: "Conservé, et renvoyé tout seul — renvoyer toi-même est sans risque.",
    unknownHeldBody: "Impossible de confirmer que c'est bien passé. Regarde ta journée avant de le renvoyer, ou supprime-le.",
    analysisFailed: "L'analyse n'est pas revenue.",
    analysisKept: "Rien n'a été enregistré. Ta photo est conservée.",
    web: { sendItAgain: "La renvoyer" },
    phone: {
      sending: "Envoi",
      typing: "{coach} écrit",
      notSent: "Non envoyé. Ton message est de retour dans le champ.",
      notLogged: "Non enregistré. Ton message est de retour dans le champ.",
      timedOut: "Ce message a expiré. Il est de retour dans le champ, renvoie-le.",
      photo: "Photo",
      photoCaption: "Photo : {caption}",
      discard: "Supprimer",
      discardQ: "Supprimer ?",
      discardNote: "Il n'a pas été enregistré, et il ne le sera pas.",
      onItsWayTitle: "Déjà envoyé",
      onItsWayNote: "Il a été envoyé avant que tu ne le supprimes — il sera enregistré. Tu pourras le supprimer dans Chat une fois arrivé.",
      edit: "Modifier",
      delete: "Supprimer",
      remove: "Retirer",
      cancel: "Annuler",
      deleteMealQ: "Supprimer ce repas ?",
      deleteMealNote: "Ses photos et ses chiffres partent aussi.",
      deleteLineQ: "Retirer ce message ?",
      deleteLineNote: "Les chiffres restent.",
      holdActions: "Reste appuyé pour Modifier et Supprimer",
      holdDelete: "Reste appuyé pour supprimer",
      photoMessage: "Ton message photo",
      signInOffer: "Se connecter avec Apple ou Google",
      goneTitle: "Ce repas n'existe plus",
      goneRedateNote: "Il a été supprimé — rien à déplacer.",
      goneApplyTitle: "Impossible d'appliquer ça",
      goneApplyNote: "Le repas a été supprimé avant que le changement n'arrive. Enregistre-le à nouveau si tu en as encore besoin.",
      refusals: {
        notFood: "Je n'ai trouvé aucun aliment là-dedans.",
        capGlobalTitle: "L'instance est à court de budget aujourd'hui",
        capGlobalNote: "Pas toi — tout le monde. Ça repart à minuit.",
        capAddressTitle: "Trop de demandes depuis ce réseau",
        capAddressNote: "Pas toi — cette connexion. Les réseaux partagés et mobiles l'atteignent ensemble. Réessaie plus tard ou depuis une autre connexion.",
        capUserTitle: "C'était ta dernière aujourd'hui",
        capUserNote: "Ton quota de photos quotidien est épuisé. Il repart à minuit.",
        capUnknownTitle: "Celle-ci a atteint une limite",
        capUnknownNote: "Rien n'a été enregistré. Réessaie plus tard.",
        setupTitle: "Termine d'abord la configuration",
        setupNote: "Il nous faut ton objectif et ton poids avant de pouvoir juger quoi que ce soit.",
        longTextTitle: "Trop long pour un message",
        longTextNote: "Reste sous les {max} caractères.",
        longNoteTitle: "Cette note est trop longue",
        longNoteNote: "Reste sous les {max} caractères. Rien n'a été enregistré.",
        unreadableTitle: "Cette photo est illisible",
        unreadableNote: "Rien n'a été enregistré ni compté.",
        tooLargeTitle: "Cette photo est trop lourde pour être envoyée",
        tooLargeNote: "Rien n'a été enregistré ni compté.",
        tooManyTitle: "Plus d'angles qu'un repas n'en prend",
        tooManyNote: "Rien n'a été enregistré ni compté.",
        failedTitle: "Ça n'est pas passé",
        failedNote: "Réessaie dans un instant.",
        failedSampleNote: "Ça a quand même compté, et c'était la fin de ton essai — le prochain repas demande un abonnement.",
        unansweredTitle: "Ton message m'est bien arrivé, mais la réponse n'est pas arrivée",
        unansweredNote: "Il est là, renvoie-le.",
        unansweredSampleNote: "Rien n'a été enregistré, mais ça a compté, et c'était la fin de ton essai — le prochain repas demande un abonnement.",
        maybeLandedTitle: "Celle-ci m'est arrivée, mais n'a pas abouti",
        maybeLandedNote: "Elle a peut-être été enregistrée. Vérifie avant de la renvoyer.",
        unreachableTitle: "Impossible de joindre eait",
        unreachableNote: "Rien n'a été enregistré. Vérifie ta connexion, puis renvoie.",
      },
    },
  },
  de: {
    greeting: "Sag mir, was du gegessen hast, oder frag mich, was du willst.",
    composerAsk: "Was hast du gegessen?",
    mealLine: "{name} — {kcal}",
    earlier: "Ältere Nachrichten",
    movedCaption: "Verschoben — neuer Tag: {day}.",
    composerThread: "Sag {coach}, was du gegessen hast, oder frag",
    proposalCheck: "Ich trage es für heute ein — passt das?",
    proposalAccept: "Eintragen",
    proposalDecline: "Nein",
    expired: "Das ist abgelaufen. Beschreib es noch einmal, dann lese ich es neu.",
    macroLabels: { protein: "Protein", carbs: "Kohlenhydrate", fat: "Fett", kcal: "Kalorien", satfat: "Gesättigte Fettsäuren" },
    starters: { consistency: "Wie läuft meine Woche?", habits: "Wie mache ich das Abendessen leichter?", support: "Bekomme ich genug Protein?", busy: "Ich sage dir einfach, was ich gegessen habe", ideas: "Was soll ich heute Abend essen?" },
    macroEaten: "{value}",
    macroTarget: "von {target}{unit}",
    loadFailed: "Die Unterhaltung konnte nicht geladen werden.",
    tryAgain: "Erneut versuchen",
    eitherWorks: "Fotografier es oder sag es mir — beides geht",
    offlineTitle: "eait ist gerade nicht erreichbar.",
    offlineBody: "Es wurde nichts eingetragen.",
    sendAgain: "Erneut senden",
    waitingToSend: "Wartet auf den Versand",
    unknownTitle: "Das ist nicht sauber durchgegangen.",
    unknownBody: "Gespeichert – wird automatisch erneut gesendet. Nochmal senden schadet nicht.",
    unknownHeldBody: "Wir konnten nicht bestätigen, dass es durchgegangen ist. Sieh in deinem Tag nach, bevor du es erneut sendest, oder verwirf es.",
    analysisFailed: "Die Analyse ist nicht zurückgekommen.",
    analysisKept: "Es wurde nichts eingetragen. Dein Foto ist gespeichert.",
    web: { sendItAgain: "Nochmal senden" },
    phone: {
      sending: "Wird gesendet",
      typing: "{coach} schreibt",
      notSent: "Nicht gesendet. Deine Nachricht steht wieder im Eingabefeld.",
      notLogged: "Nicht eingetragen. Deine Nachricht steht wieder im Eingabefeld.",
      timedOut: "Die Nachricht ist abgelaufen. Sie steht wieder im Eingabefeld, schick sie noch einmal.",
      photo: "Foto",
      photoCaption: "Foto: {caption}",
      discard: "Verwerfen",
      discardQ: "Verwerfen?",
      discardNote: "Es wurde nicht gespeichert und wird es auch nicht.",
      onItsWayTitle: "Schon unterwegs",
      onItsWayNote: "Es wurde gesendet, bevor du es verworfen hast — es wird gespeichert. Du kannst es in Chat löschen, sobald es ankommt.",
      edit: "Bearbeiten",
      delete: "Löschen",
      remove: "Entfernen",
      cancel: "Abbrechen",
      deleteMealQ: "Diese Mahlzeit löschen?",
      deleteMealNote: "Fotos und Werte werden mitgelöscht.",
      deleteLineQ: "Diese Nachricht entfernen?",
      deleteLineNote: "Die Werte bleiben.",
      holdActions: "Gedrückt halten zum Bearbeiten oder Löschen",
      holdDelete: "Zum Löschen halten",
      photoMessage: "Deine Foto-Nachricht",
      signInOffer: "Mit Apple oder Google anmelden",
      goneTitle: "Diese Mahlzeit ist weg",
      goneRedateNote: "Sie wurde gelöscht — es gibt nichts zu verschieben.",
      goneApplyTitle: "Änderung nicht übernommen",
      goneApplyNote: "Die Mahlzeit wurde gelöscht, bevor die Änderung ankam. Trag sie neu ein, wenn du sie noch brauchst.",
      refusals: {
        notFood: "Ich konnte darin kein Essen finden.",
        capGlobalTitle: "eait hat für heute kein Analysebudget mehr",
        capGlobalNote: "Nicht du — alle. Es wird um Mitternacht zurückgesetzt.",
        capAddressTitle: "Zu viele aus diesem Netzwerk",
        capAddressNote: "Nicht du — diese Verbindung. Geteilte und mobile Netze erreichen das Limit gemeinsam. Versuch es später oder von einer anderen Verbindung.",
        capUserTitle: "Das war dein letztes Foto für heute",
        capUserNote: "Dein tägliches Foto-Kontingent ist aufgebraucht. Es wird um Mitternacht zurückgesetzt.",
        capUnknownTitle: "Hier greift ein Limit",
        capUnknownNote: "Nichts wurde eingetragen. Versuch es später.",
        setupTitle: "Beende zuerst die Einrichtung",
        setupNote: "Wir brauchen dein Ziel und dein Gewicht, bevor etwas bewertet werden kann.",
        longTextTitle: "Zu lang für eine Nachricht",
        longTextNote: "Bleib unter {max} Zeichen.",
        longNoteTitle: "Diese Notiz ist zu lang",
        longNoteNote: "Bleib unter {max} Zeichen. Nichts wurde eingetragen.",
        unreadableTitle: "Dieses Foto ist nicht lesbar",
        unreadableNote: "Nichts wurde eingetragen und nichts gezählt.",
        tooLargeTitle: "Dieses Foto ist zu groß zum Senden",
        tooLargeNote: "Nichts wurde eingetragen und nichts gezählt.",
        tooManyTitle: "Mehr Blickwinkel, als eine Mahlzeit braucht",
        tooManyNote: "Nichts wurde eingetragen und nichts gezählt.",
        failedTitle: "Das ist nicht durchgegangen",
        failedNote: "Versuch es gleich noch einmal.",
        failedSampleNote: "Es hat trotzdem gezählt, und das war deine kostenlose Testmahlzeit — die nächste Mahlzeit braucht ein Abo.",
        unansweredTitle: "Die ist angekommen, aber die Antwort kam nicht an",
        unansweredNote: "Sie steht wieder im Eingabefeld, schick sie noch einmal.",
        unansweredSampleNote: "Nichts wurde eingetragen, aber es hat gezählt — und das war deine kostenlose Testmahlzeit; die nächste Mahlzeit braucht ein Abo.",
        maybeLandedTitle: "Die ist angekommen, aber nicht fertig geworden",
        maybeLandedNote: "Sie könnte durchgegangen sein. Prüfe es, bevor du sie erneut sendest.",
        unreachableTitle: "eait nicht erreichbar",
        unreachableNote: "Nichts wurde eingetragen. Prüfe deine Verbindung und sende es noch einmal.",
      },
    },
  },
  it: {
    greeting: "Dimmi cosa hai mangiato, o chiedimi quello che vuoi.",
    composerAsk: "Cosa hai mangiato?",
    mealLine: "{name} — {kcal}",
    earlier: "Messaggi precedenti",
    movedCaption: "Spostato — nuovo giorno: {day}.",
    composerThread: "Di' a {coach} cosa hai mangiato, o chiedi",
    proposalCheck: "Lo registro a oggi — va bene?",
    proposalAccept: "Registralo",
    proposalDecline: "No",
    expired: "Quella è scaduta. Descrivila di nuovo e la rileggo.",
    macroLabels: { protein: "Proteine", carbs: "Carboidrati", fat: "Grassi", kcal: "Calorie", satfat: "Grassi saturi" },
    starters: { consistency: "Come sta andando la settimana?", habits: "Un'alternativa più leggera per cena?", support: "Sto prendendo abbastanza proteine?", busy: "Ti dico solo cosa ho mangiato", ideas: "Cosa mangio stasera?" },
    macroEaten: "{value}",
    macroTarget: "su {target}{unit}",
    loadFailed: "Impossibile caricare la conversazione.",
    tryAgain: "Riprova",
    eitherWorks: "Fotografalo o dimmelo — uno vale l'altro",
    offlineTitle: "Impossibile raggiungere eait.",
    offlineBody: "Non è stato registrato nulla.",
    sendAgain: "Invia di nuovo",
    waitingToSend: "In attesa di invio",
    unknownTitle: "Non si è concluso correttamente.",
    unknownBody: "Conservato, e rispedito da solo — inviare di nuovo è sicuro.",
    unknownHeldBody: "Non siamo riusciti a confermare che sia andato a buon fine. Controlla il tuo giorno prima di inviarlo di nuovo, oppure scartalo.",
    analysisFailed: "L'analisi non è tornata.",
    analysisKept: "Non è stato registrato nulla. La tua foto è conservata.",
    web: { sendItAgain: "Inviala di nuovo" },
    phone: {
      sending: "Invio",
      typing: "{coach} sta scrivendo",
      notSent: "Non inviato. Il messaggio è tornato nel campo.",
      notLogged: "Non registrato. Il messaggio è tornato nel campo.",
      timedOut: "Il messaggio è scaduto. È tornato nel campo, invialo di nuovo.",
      photo: "Foto",
      photoCaption: "Foto: {caption}",
      discard: "Scarta",
      discardQ: "Scartarlo?",
      discardNote: "Non è stato registrato, e non lo sarà.",
      onItsWayTitle: "È già in viaggio",
      onItsWayNote: "È stato inviato prima che lo scartassi, quindi verrà registrato. Potrai eliminarlo da Chat quando arriva.",
      edit: "Modifica",
      delete: "Elimina",
      remove: "Rimuovi",
      cancel: "Annulla",
      deleteMealQ: "Eliminare questo pasto?",
      deleteMealNote: "Anche le foto e i numeri se ne vanno.",
      deleteLineQ: "Rimuovere questo messaggio?",
      deleteLineNote: "I numeri restano.",
      holdActions: "Tieni premuto per Modifica ed Elimina",
      holdDelete: "Tieni premuto per eliminare",
      photoMessage: "Il tuo messaggio foto",
      signInOffer: "Accedi con Apple o Google",
      goneTitle: "Quel pasto non c'è più",
      goneRedateNote: "È stato eliminato, quindi non c'è nulla da spostare.",
      goneApplyTitle: "Non posso applicarlo",
      goneApplyNote: "Il pasto è stato eliminato prima che la modifica arrivasse. Registralo di nuovo se ti serve ancora.",
      refusals: {
        notFood: "Non ci ho trovato cibo.",
        capGlobalTitle: "L'istanza oggi è a corto di budget",
        capGlobalNote: "Non tu — tutti. Si azzera a mezzanotte.",
        capAddressTitle: "Troppe richieste da questa rete",
        capAddressNote: "Non tu — questa connessione. Le reti condivise e mobili ci arrivano insieme. Riprova più tardi o da un'altra connessione.",
        capUserTitle: "Era l'ultima di oggi",
        capUserNote: "Il tuo limite foto giornaliero è esaurito. Si azzera a mezzanotte.",
        capUnknownTitle: "Questa ha raggiunto un limite",
        capUnknownNote: "Nulla è stato registrato. Riprova più tardi.",
        setupTitle: "Finisci prima la configurazione",
        setupNote: "Ci servono il tuo obiettivo e il tuo peso prima di poter valutare.",
        longTextTitle: "Troppo lungo per un messaggio",
        longTextNote: "Resta sotto i {max} caratteri.",
        longNoteTitle: "La nota è troppo lunga",
        longNoteNote: "Resta sotto i {max} caratteri. Nulla è stato registrato.",
        unreadableTitle: "La foto non si può leggere",
        unreadableNote: "Nulla registrato e nulla contato.",
        tooLargeTitle: "La foto è troppo grande per essere inviata",
        tooLargeNote: "Nulla registrato e nulla contato.",
        tooManyTitle: "Più scatti di quanti ne serva un pasto",
        tooManyNote: "Nulla registrato e nulla contato.",
        failedTitle: "Non è andata",
        failedNote: "Riprova tra un attimo.",
        failedSampleNote: "È comunque contata, ed era l'ultima della tua prova — il prossimo pasto richiede un abbonamento.",
        unansweredTitle: "Il messaggio mi è arrivato, ma la risposta no",
        unansweredNote: "È qui, invialo di nuovo.",
        unansweredSampleNote: "Nulla registrato, ma ha contato — ed era l'ultima della prova; il prossimo pasto richiede un abbonamento.",
        maybeLandedTitle: "Mi è arrivata, ma non si è conclusa",
        maybeLandedNote: "Potrebbe essere andata a buon fine. Controlla prima di inviarla di nuovo.",
        unreachableTitle: "eait non raggiungibile",
        unreachableNote: "Nulla è stato registrato. Controlla la connessione e invialo di nuovo.",
      },
    },
  },
  es: {
    greeting: "Cuéntame qué has comido, o pregúntame lo que sea.",
    composerAsk: "¿Qué has comido?",
    mealLine: "{name} — {kcal}",
    earlier: "Mensajes anteriores",
    movedCaption: "Movida al {day}.",
    composerThread: "Dile a {coach} qué has comido, o pregunta",
    proposalCheck: "Lo registro en hoy — ¿te cuadra?",
    proposalAccept: "Registrarla",
    proposalDecline: "No",
    expired: "Esa caducó. Descríbela otra vez y la vuelvo a leer.",
    macroLabels: { protein: "Proteína", carbs: "Carbohidratos", fat: "Grasas", kcal: "Calorías", satfat: "Grasas saturadas" },
    starters: { consistency: "¿Cómo va mi semana?", habits: "¿Una alternativa más ligera para la cena?", support: "¿Estoy tomando suficiente proteína?", busy: "Te digo lo que he comido y ya", ideas: "¿Qué ceno hoy?" },
    macroEaten: "{value}",
    macroTarget: "de {target}{unit}",
    loadFailed: "No se pudo cargar la conversación.",
    tryAgain: "Reintentar",
    eitherWorks: "Fotografíalo o cuéntamelo — cualquiera vale",
    offlineTitle: "No se pudo conectar con eait.",
    offlineBody: "No se registró nada.",
    sendAgain: "Reenviar",
    waitingToSend: "Esperando para enviar",
    unknownTitle: "Eso no terminó del todo bien.",
    unknownBody: "Guardado, y se reenvía solo — volver a enviar es seguro.",
    unknownHeldBody: "No pudimos confirmar que se haya enviado. Revisa tu día antes de volver a enviarlo, o descártalo.",
    analysisFailed: "El análisis no volvió.",
    analysisKept: "No se registró nada. Tu foto queda guardada.",
    web: { sendItAgain: "Enviarla de nuevo" },
    phone: {
      sending: "Enviando",
      typing: "{coach} está escribiendo",
      notSent: "No enviado. Tu mensaje está de vuelta en el campo.",
      notLogged: "No registrado. Tu mensaje está de vuelta en el campo.",
      timedOut: "El mensaje caducó. Está de vuelta en el campo, envíalo otra vez.",
      photo: "Foto",
      photoCaption: "Foto: {caption}",
      discard: "Descartar",
      discardQ: "¿Descartarlo?",
      discardNote: "No se ha registrado, y no se registrará.",
      onItsWayTitle: "Ya va de camino",
      onItsWayNote: "Se envió antes de que lo descartaras, así que se registrará. Podrás borrarlo desde Chat cuando llegue.",
      edit: "Editar",
      delete: "Eliminar",
      remove: "Quitar",
      cancel: "Cancelar",
      deleteMealQ: "¿Eliminar esta comida?",
      deleteMealNote: "Sus fotos y sus números también.",
      deleteLineQ: "¿Quitar este mensaje?",
      deleteLineNote: "Los números se quedan.",
      holdActions: "Mantén pulsado para Editar y Eliminar",
      holdDelete: "Mantén pulsado para eliminar",
      photoMessage: "Tu mensaje con foto",
      signInOffer: "Inicia sesión con Apple o Google",
      goneTitle: "Esa comida ya no existe",
      goneRedateNote: "Fue eliminada, así que no hay nada que mover.",
      goneApplyTitle: "No se pudo aplicar",
      goneApplyNote: "La comida se eliminó antes de que llegara el cambio. Vuelve a registrarla si aún la necesitas.",
      refusals: {
        notFood: "No encontré comida ahí.",
        capGlobalTitle: "La instancia se quedó sin presupuesto hoy",
        capGlobalNote: "No tú — todos. Se reinicia a medianoche.",
        capAddressTitle: "Demasiadas desde esta red",
        capAddressNote: "No tú — esta conexión. Las redes compartidas y móvil llegan juntas al límite. Inténtalo más tarde o desde otra conexión.",
        capUserTitle: "Esa era tu última de hoy",
        capUserNote: "Tu límite diario de fotos está agotado. Se reinicia a medianoche.",
        capUnknownTitle: "Esta alcanzó un límite",
        capUnknownNote: "No se registró nada. Inténtalo más tarde.",
        setupTitle: "Termina primero la configuración",
        setupNote: "Necesitamos tu objetivo y tu peso antes de poder valorar nada.",
        longTextTitle: "Demasiado largo para un mensaje",
        longTextNote: "Quédate por debajo de {max} caracteres.",
        longNoteTitle: "La nota es demasiado larga",
        longNoteNote: "Quédate por debajo de {max} caracteres. No se registró nada.",
        unreadableTitle: "Esa foto no se puede leer",
        unreadableNote: "No se registró ni se contó nada.",
        tooLargeTitle: "Esa foto es demasiado grande para enviarse",
        tooLargeNote: "No se registró ni se contó nada.",
        tooManyTitle: "Más ángulos de los que caben en una comida",
        tooManyNote: "No se registró ni se contó nada.",
        failedTitle: "No salió",
        failedNote: "Inténtalo en un momento.",
        failedSampleNote: "Aun así contó, y era tu último análisis gratis — la siguiente comida necesita una suscripción.",
        unansweredTitle: "Me llegó, pero la respuesta no",
        unansweredNote: "Está aquí, envíalo otra vez.",
        unansweredSampleNote: "No se registró nada, pero contó — y era tu último análisis gratis; la siguiente comida necesita una suscripción.",
        maybeLandedTitle: "Me llegó, pero no terminó",
        maybeLandedNote: "Puede que haya pasado. Compruébalo antes de volver a enviarla.",
        unreachableTitle: "No se pudo contactar con eait",
        unreachableNote: "No se registró nada. Comprueba tu conexión y envíalo otra vez.",
      },
    },
  },
  vi: {
    greeting: "Kể mình nghe bạn đã ăn gì, hoặc hỏi mình bất cứ điều gì.",
    composerAsk: "Bạn đã ăn gì?",
    mealLine: "{name} — {kcal}",
    earlier: "Tin nhắn cũ hơn",
    movedCaption: "Đã chuyển — ngày mới: {day}.",
    composerThread: "Kể {coach} nghe bạn đã ăn gì, hoặc hỏi",
    proposalCheck: "Ghi vào hôm nay — đúng chứ?",
    proposalAccept: "Ghi lại",
    proposalDecline: "Không",
    expired: "Cái đó đã hết giờ. Mô tả lại và mình sẽ đọc lại.",
    macroLabels: { protein: "Đạm", carbs: "Tinh bột", fat: "Chất béo", kcal: "Calo", satfat: "Chất béo bão hoà" },
    starters: { consistency: "Tuần này thế nào?", habits: "Đổi món gì nhẹ hơn cho bữa tối?", support: "Đã đủ đạm chưa?", busy: "Mình sẽ kể mình đã ăn gì", ideas: "Tối nay nên ăn gì?" },
    macroEaten: "{value}",
    macroTarget: "trên {target}{unit}",
    loadFailed: "Không tải được cuộc trò chuyện.",
    tryAgain: "Thử lại",
    eitherWorks: "Chụp nó hoặc kể mình nghe — cách nào cũng được",
    offlineTitle: "Không kết nối được với eait.",
    offlineBody: "Chưa có gì được ghi lại.",
    sendAgain: "Gửi lại",
    waitingToSend: "Đang chờ gửi",
    unknownTitle: "Việc gửi chưa kết thúc trọn vẹn.",
    unknownBody: "Đã giữ lại, và sẽ tự gửi lại — gửi lại vẫn an toàn.",
    unknownHeldBody: "Mình không xác nhận được là nó đã gửi thành công. Hãy kiểm tra lại ngày của bạn trước khi gửi lại, hoặc bỏ nó đi.",
    analysisFailed: "Phân tích không trả về.",
    analysisKept: "Chưa có gì được ghi lại. Ảnh của bạn được giữ.",
    web: { sendItAgain: "Gửi nó lại" },
    phone: {
      sending: "Đang gửi",
      typing: "{coach} đang nhập",
      notSent: "Chưa gửi. Tin nhắn đã quay lại trong ô nhập.",
      notLogged: "Chưa ghi. Tin nhắn đã quay lại trong ô nhập.",
      timedOut: "Tin nhắn đã hết giờ. Đã quay lại trong ô nhập, gửi lại nhé.",
      photo: "Ảnh",
      photoCaption: "Ảnh: {caption}",
      discard: "Bỏ đi",
      discardQ: "Bỏ tin này?",
      discardNote: "Nó chưa được ghi, và sẽ không được ghi.",
      onItsWayTitle: "Đã gửi đi rồi",
      onItsWayNote: "Nó được gửi trước khi bạn bỏ, nên sẽ được ghi. Bạn có thể xoá nó trong Chat khi nó về đến.",
      edit: "Sửa",
      delete: "Xoá",
      remove: "Gỡ",
      cancel: "Huỷ",
      deleteMealQ: "Xoá bữa này?",
      deleteMealNote: "Ảnh và số liệu của nó cũng mất.",
      deleteLineQ: "Gỡ tin nhắn này?",
      deleteLineNote: "Số liệu vẫn giữ.",
      holdActions: "Nhấn giữ để Sửa và Xoá",
      holdDelete: "Nhấn giữ để xoá",
      photoMessage: "Tin nhắn ảnh của bạn",
      signInOffer: "Đăng nhập bằng Apple hoặc Google",
      goneTitle: "Bữa đó không còn",
      goneRedateNote: "Nó đã bị xoá, nên không còn gì để chuyển.",
      goneApplyTitle: "Không áp dụng được",
      goneApplyNote: "Bữa đã bị xoá trước khi thay đổi đến. Ghi lại nếu bạn vẫn cần.",
      refusals: {
        notFood: "Mình không tìm thấy món ăn nào trong đó.",
        capGlobalTitle: "Hệ thống hết ngân sách hôm nay",
        capGlobalNote: "Không phải bạn — tất cả mọi người. Nó sẽ đặt lại lúc nửa đêm.",
        capAddressTitle: "Quá nhiều yêu cầu từ mạng này",
        capAddressNote: "Không phải bạn — đường truyền này. Mạng dùng chung và mạng di động chạm giới hạn cùng nhau. Thử lại sau hoặc qua kết nối khác.",
        capUserTitle: "Đó là lượt cuối hôm nay",
        capUserNote: "Hạn mức ảnh hằng ngày của bạn đã hết. Nó đặt lại lúc nửa đêm.",
        capUnknownTitle: "Tin này chạm một giới hạn",
        capUnknownNote: "Chưa ghi gì. Thử lại sau.",
        setupTitle: "Hoàn tất thiết lập trước",
        setupNote: "Chúng mình cần mục tiêu và cân nặng của bạn trước khi nhận định được.",
        longTextTitle: "Dài quá cho một tin nhắn",
        longTextNote: "Giữ dưới {max} ký tự.",
        longNoteTitle: "Ghi chú đó dài quá",
        longNoteNote: "Giữ dưới {max} ký tự. Chưa ghi gì.",
        unreadableTitle: "Không đọc được ảnh đó",
        unreadableNote: "Không ghi và không tính gì.",
        tooLargeTitle: "Ảnh đó lớn quá để gửi",
        tooLargeNote: "Không ghi và không tính gì.",
        tooManyTitle: "Nhiều góc hơn một bữa cần",
        tooManyNote: "Không ghi và không tính gì.",
        failedTitle: "Không gửi được",
        failedNote: "Thử lại sau chút nữa.",
        failedSampleNote: "Nó vẫn tính, và đó là lượt cuối trong phần dùng thử — bữa kế tiếp cần một gói.",
        unansweredTitle: "Tin đã tới mình, nhưng câu trả lời chưa tới",
        unansweredNote: "Tin vẫn ở đây, gửi lại nhé.",
        unansweredSampleNote: "Chưa ghi gì, nhưng đã tính — và đó là lượt cuối trong phần dùng thử; bữa kế tiếp cần một gói.",
        maybeLandedTitle: "Tin đã tới mình, nhưng chưa xong",
        maybeLandedNote: "Có thể nó đã được ghi. Kiểm tra trước khi gửi lại.",
        unreachableTitle: "Không kết nối được với eait",
        unreachableNote: "Chưa ghi gì. Kiểm tra kết nối rồi gửi lại.",
      },
    },
  },
  id: {
    greeting: "Beri tahu aku apa yang kamu makan, atau tanyakan apa saja.",
    composerAsk: "Apa yang kamu makan?",
    mealLine: "{name} — {kcal}",
    earlier: "Pesan sebelumnya",
    movedCaption: "Dipindahkan — hari baru: {day}.",
    composerThread: "Beri tahu {coach} apa yang kamu makan, atau tanya",
    proposalCheck: "Kucatat untuk hari ini — benar?",
    proposalAccept: "Catat",
    proposalDecline: "Tidak",
    expired: "Yang itu kedaluwarsa. Deskripsikan lagi dan aku baca ulang.",
    macroLabels: { protein: "Protein", carbs: "Karbohidrat", fat: "Lemak", kcal: "Kalori", satfat: "Lemak jenuh" },
    starters: { consistency: "Bagaimana mingguku?", habits: "Ada alternatif lebih ringan untuk makan malam?", support: "Proteinku sudah cukup belum?", busy: "Aku kasih tahu saja apa yang kumakan", ideas: "Malam ini sebaiknya makan apa?" },
    macroEaten: "{value}",
    macroTarget: "dari {target}{unit}",
    loadFailed: "Tidak bisa memuat percakapan.",
    tryAgain: "Coba lagi",
    eitherWorks: "Foto atau ceritakan ke aku — dua-duanya bisa",
    offlineTitle: "Tidak bisa terhubung ke eait.",
    offlineBody: "Tidak ada yang tercatat.",
    sendAgain: "Kirim lagi",
    waitingToSend: "Menunggu untuk dikirim",
    unknownTitle: "Tidak selesai dengan baik.",
    unknownBody: "Disimpan, dan terkirim ulang sendiri — mengirim ulang tetap aman.",
    unknownHeldBody: "Aku tidak bisa memastikan pesan ini terkirim. Cek harimu sebelum mengirimnya lagi, atau buang saja.",
    analysisFailed: "Analisisnya tidak kembali.",
    analysisKept: "Tidak ada yang tercatat. Fotomu disimpan.",
    web: { sendItAgain: "Kirim lagi" },
    phone: {
      sending: "Mengirim",
      typing: "{coach} sedang mengetik",
      notSent: "Belum terkirim. Pesanmu kembali ke kolom.",
      notLogged: "Belum tercatat. Pesanmu kembali ke kolom.",
      timedOut: "Pesanmu kedaluwarsa. Sudah kembali ke kolom, kirim lagi.",
      photo: "Foto",
      photoCaption: "Foto: {caption}",
      discard: "Buang",
      discardQ: "Buang ini?",
      discardNote: "Belum dicatat, dan tidak akan dicatat.",
      onItsWayTitle: "Sudah terkirim",
      onItsWayNote: "Terkirim sebelum kamu membuangnya, jadi akan tetap dicatat. Kamu bisa menghapusnya di Chat setelah tiba.",
      edit: "Ubah",
      delete: "Hapus",
      remove: "Singkirkan",
      cancel: "Batal",
      deleteMealQ: "Hapus makanan ini?",
      deleteMealNote: "Foto dan angkanya ikut terhapus.",
      deleteLineQ: "Singkirkan pesan ini?",
      deleteLineNote: "Angkanya tetap.",
      holdActions: "Tahan untuk Ubah dan Hapus",
      holdDelete: "Tahan untuk menghapus",
      photoMessage: "Pesan foto kamu",
      signInOffer: "Masuk dengan Apple atau Google",
      goneTitle: "Makanan itu sudah tidak ada",
      goneRedateNote: "Sudah dihapus, jadi tidak ada yang bisa dipindahkan.",
      goneApplyTitle: "Tidak bisa menerapkannya",
      goneApplyNote: "Makanan itu terhapus sebelum perubahan sampai. Catat lagi kalau masih perlu.",
      refusals: {
        notFood: "Aku tidak menemukan makanan di situ.",
        capGlobalTitle: "Instans kehabisan bujet hari ini",
        capGlobalNote: "Bukan kamu — semuanya. Direset tengah malam.",
        capAddressTitle: "Terlalu banyak dari jaringan ini",
        capAddressNote: "Bukan kamu — koneksi ini. Jaringan bersama dan seluler kena batas bersama. Coba lagi nanti atau dari koneksi lain.",
        capUserTitle: "Itu yang terakhir hari ini",
        capUserNote: "Jatah foto harianmu habis. Direset tengah malam.",
        capUnknownTitle: "Yang itu kena batas",
        capUnknownNote: "Tidak ada yang tercatat. Coba lagi nanti.",
        setupTitle: "Selesaikan pengaturan dulu",
        setupNote: "Kami perlu target dan beratmu sebelum bisa menilai apa pun.",
        longTextTitle: "Kepanjangan untuk satu pesan",
        longTextNote: "Jaga di bawah {max} karakter.",
        longNoteTitle: "Catatan itu kepanjangan",
        longNoteNote: "Jaga di bawah {max} karakter. Tidak ada yang tercatat.",
        unreadableTitle: "Foto itu tidak bisa dibaca",
        unreadableNote: "Tidak ada yang dicatat maupun dihitung.",
        tooLargeTitle: "Foto itu terlalu besar untuk dikirim",
        tooLargeNote: "Tidak ada yang dicatat maupun dihitung.",
        tooManyTitle: "Sudut lebih banyak dari yang satu makanan butuhkan",
        tooManyNote: "Tidak ada yang dicatat maupun dihitung.",
        failedTitle: "Tidak berhasil",
        failedNote: "Coba lagi sebentar lagi.",
        failedSampleNote: "Tetap terhitung, dan itu yang terakhir dari masa coba — makanan berikutnya butuh langganan.",
        unansweredTitle: "Yang itu sampai padaku, tapi jawabannya tidak",
        unansweredNote: "Ada di sini, kirim lagi.",
        unansweredSampleNote: "Tidak ada yang dicatat, tapi terhitung — dan itu yang terakhir dari masa coba; makanan berikutnya butuh langganan.",
        maybeLandedTitle: "Yang itu sampai, tapi tidak selesai",
        maybeLandedNote: "Mungkin tetap tercatat. Periksa dulu sebelum mengirim ulang.",
        unreachableTitle: "Tidak bisa menghubungi eait",
        unreachableNote: "Tidak ada yang tercatat. Periksa koneksimu, lalu kirim lagi.",
      },
    },
  },
  ru: {
    greeting: "Расскажи, что было на тарелке, или спроси о чём угодно.",
    composerAsk: "Что было на тарелке?",
    mealLine: "{name} — {kcal}",
    earlier: "Предыдущие сообщения",
    movedCaption: "Перенесено — новый день: {day}.",
    composerThread: "Расскажи {coach}, что было на тарелке, или спроси",
    proposalCheck: "Записываю на сегодня — верно?",
    proposalAccept: "Записать",
    proposalDecline: "Нет",
    expired: "Время вышло. Опиши ещё раз, и я перечитаю.",
    macroLabels: { protein: "Белок", carbs: "Углеводы", fat: "Жиры", kcal: "Калории", satfat: "Насыщенные жиры" },
    starters: { consistency: "Как у меня идёт неделя?", habits: "Как сделать ужин полегче?", support: "Мне хватает белка?", busy: "Просто скажу, что было на тарелке", ideas: "Что съесть сегодня вечером?" },
    macroEaten: "{value}",
    macroTarget: "из {target}{unit}",
    loadFailed: "Не удалось загрузить переписку.",
    tryAgain: "Попробовать ещё раз",
    eitherWorks: "Сфотографируй или расскажи — сработает и так, и так",
    offlineTitle: "Не удалось связаться с eait.",
    offlineBody: "Ничего не записалось.",
    sendAgain: "Отправить ещё раз",
    waitingToSend: "Ждёт отправки",
    unknownTitle: "Отправка не завершилась до конца.",
    unknownBody: "Сохранено и отправится само — отправить ещё раз безопасно.",
    unknownHeldBody: "Не удалось подтвердить, что сообщение дошло. Проверь свой день, прежде чем отправить его ещё раз, или отмени.",
    analysisFailed: "Анализ не вернулся.",
    analysisKept: "Ничего не записалось. Фото сохранено.",
    web: { sendItAgain: "Отправить ещё раз" },
    phone: {
      sending: "Отправка",
      typing: "{coach} печатает",
      notSent: "Не отправлено. Сообщение вернулось в поле ввода.",
      notLogged: "Не записано. Сообщение вернулось в поле ввода.",
      timedOut: "Время вышло. Сообщение вернулось в поле ввода, отправь ещё раз.",
      photo: "Фото",
      photoCaption: "Фото: {caption}",
      discard: "Отменить",
      discardQ: "Отменить отправку?",
      discardNote: "Оно не записано — и не будет.",
      onItsWayTitle: "Уже отправлено",
      onItsWayNote: "Оно ушло до того, как его отменили — и будет записано. Удалить его можно в Чате, когда оно придёт.",
      edit: "Изменить",
      delete: "Удалить",
      remove: "Убрать",
      cancel: "Отмена",
      deleteMealQ: "Удалить этот приём пищи?",
      deleteMealNote: "Его фото и цифры тоже уйдут.",
      deleteLineQ: "Убрать это сообщение?",
      deleteLineNote: "Цифры останутся.",
      holdActions: "Удерживай: Изменить и Удалить",
      holdDelete: "Удерживай, чтобы удалить",
      photoMessage: "Твоё сообщение с фото",
      signInOffer: "Войти через Apple или Google",
      goneTitle: "Этого приёма пищи больше нет",
      goneRedateNote: "Он удалён — переносить нечего.",
      goneApplyTitle: "Не получилось применить",
      goneApplyNote: "Приём пищи был удалён до того, как изменение дошло. Запиши его заново, если он ещё нужен.",
      refusals: {
        notFood: "Я не нашёл тут еды.",
        capGlobalTitle: "Общий лимит на сегодня исчерпан",
        capGlobalNote: "Не ты — все. Сбросится в полночь.",
        capAddressTitle: "Слишком много запросов из этой сети",
        capAddressNote: "Не ты — это соединение. Общие и мобильные сети упираются в лимит вместе. Попробуй позже или с другой сети.",
        capUserTitle: "Это было последнее фото на сегодня",
        capUserNote: "Дневной лимит фото исчерпан. Сбросится в полночь.",
        capUnknownTitle: "Упёрлись в лимит",
        capUnknownNote: "Ничего не записано. Попробуй позже.",
        setupTitle: "Сначала заверши настройку",
        setupNote: "Нужны цель и вес, прежде чем что-то можно оценить.",
        longTextTitle: "Слишком длинно для одного сообщения",
        longTextNote: "Уложись в {max} символов.",
        longNoteTitle: "Заметка слишком длинная",
        longNoteNote: "Уложись в {max} символов. Ничего не записано.",
        unreadableTitle: "Это фото не читается",
        unreadableNote: "Ничего не записано и не посчитано.",
        tooLargeTitle: "Фото слишком большое для отправки",
        tooLargeNote: "Ничего не записано и не посчитано.",
        tooManyTitle: "Ракурсов больше, чем нужно одному приёму",
        tooManyNote: "Ничего не записано и не посчитано.",
        failedTitle: "Не получилось",
        failedNote: "Попробуй чуть позже.",
        failedSampleNote: "Попытка всё равно засчитана, и она была последней бесплатной — для следующего приёма пищи нужна подписка.",
        unansweredTitle: "Оно дошло до меня, а ответ — нет",
        unansweredNote: "Оно здесь, отправь ещё раз.",
        unansweredSampleNote: "Ничего не записано, но попытка засчитана, и она была последней бесплатной — для следующего приёма пищи нужна подписка.",
        maybeLandedTitle: "Оно дошло, но не завершилось",
        maybeLandedNote: "Возможно, оно записано. Проверь, прежде чем отправлять ещё раз.",
        unreachableTitle: "Не удалось связаться с eait",
        unreachableNote: "Ничего не записано. Проверь соединение и отправь ещё раз.",
      },
    },
  },
};

export const chatScreenCopyFor = (lang: Lang): ChatScreenCopy => t(lang)(CHAT_SCREEN_COPY);

// ── The option-row icons ───────────────────────────────────────────────────────────────────
//
// The starter card and the coach's suggestion rows draw the boards' `.opt` rows — one icon,
// the words, a chevron. WHICH icon follows the boards (`chat-empty`, `chat-coach`): a starter
// carries its struggle's own, and a suggestion row takes the macro's when the words name one,
// else `ideas`. The mapping is shared so W7 and M7 draw the same icon for the same line.

/** Each struggle's starter row's icon, the boards' own pairing. */
export const STARTER_ICONS: Record<Struggle, IconName> = {
  consistency: "consistency", habits: "habits", support: "protein", busy: "busy", ideas: "ideas",
};

const words = (text: string): string[] =>
  text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 0);

/** True when `phrase` appears in `text` as whole words — never inside a longer word. */
const hasPhrase = (text: string, phrase: string): boolean => {
  const hay = words(text);
  const needle = words(phrase);
  if (needle.length === 0) return false;
  outer: for (let i = 0; i + needle.length <= hay.length; i++) {
    for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer;
    return true;
  }
  return false;
};

/**
 * The starter rows in the struggles' own order — the picked struggles first, in `STRUGGLES` list
 * order, the unpicked filling to three — `shared/chat.ts`'s rule restated against this table,
 * because `starterRowsFor` there reads the lingui THREAD_COPY and this bundle holds no catalog.
 */
export function starterRows(
  picked: readonly Struggle[] | null | undefined,
  lang: Lang,
): { struggle: Struggle; text: string }[] {
  const starters = chatScreenCopyFor(lang).starters;
  return [...STRUGGLES.filter((s) => picked?.includes(s)), ...STRUGGLES.filter((s) => !picked?.includes(s))]
    .slice(0, 3).map((s) => ({ struggle: s, text: starters[s] }));
}

/**
 * The icon a coach line's `.opt` row carries (`chat-coach`): a starter's own struggle icon when
 * the row IS a starter, a macro's icon when the words name a `macroLabels` entry, `ideas`
 * otherwise. Whole-word, case-insensitive — the boards' rule, in the reader's language.
 */
export function coachRowIcon(text: string, lang: Lang): IconName {
  const starters = chatScreenCopyFor(lang).starters;
  for (const s of Object.keys(STARTER_ICONS) as Struggle[]) {
    if (hasPhrase(text, starters[s])) return STARTER_ICONS[s];
  }
  const labels = chatScreenCopyFor(lang).macroLabels;
  for (const [m, label] of Object.entries(labels)) {
    if (hasPhrase(text, label)) return m as IconName;
  }
  return "ideas";
}
