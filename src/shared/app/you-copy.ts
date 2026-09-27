// The You surface's words (#97, W10): the profile screen both clients draw — web/you.html and
// phone/you.html — the today column web puts beside it, and the phone's deeper screens:
// you-weight (the weigh-in), you-profile and you-saved (the editor), you-basis (the plan's
// arithmetic), you-subscription, you-account and you-delete.
//
// A TABLE IN shared rather than in a client's own copy, for the reason `shell-copy.ts` gives:
// the phone and the browser draw the same screen, and two tables would drift into two products.
//
// What is deliberately NOT here:
// - the tab bar — `SHELL_COPY` owns it;
// - the numbers themselves — `{w}`, `{kcal}`, `{g}` and friends are filled by `numbers`/
//   `wholeNumbers(lang)`, dates and times by `Intl`, prices by `paywallPrice`;
// - the row VALUES the editor shows — "Lose weight", "United Kingdom", "High cholesterol",
//   "0–2" — which are the onboarding option labels (`optionLabel`, `screenOptionValues`,
//   `countryLabel`) rather than this surface's words;
// - "Apple" — a provider's brand name, filled where a sentence wants `{source}`-style data.
// Weight-bearing templates come in `…Kg`/`…Lb` pairs: the unit word lives in the template and
// the client picks by `Profile.units` — a kg figure and a lb figure are not one string.

import { t, type Localized } from "../lang.ts";
import type { Lang } from "../types.ts";
import { healthLabel } from "../health-copy.ts";
import { SHELL_COPY, shellCopyFor } from "./shell-copy.ts";
import { SIGNUP_COPY, signupCopyFor } from "./signup-copy.ts";

export interface YouCopy {
  // ── The screen both clients draw (web/you.html, phone/you.html) ──────────────────────────
  /**
   * The header's fact line under the name: "32 · 172 cm · high cholesterol declared".
   * `{age}` is a bare number, `{height}` arrives preformatted — "172 cm" or `cmToFtIn`'s "5′8″" —
   * and `{flags}` is `flagDeclared`'s output; with nothing declared the line is
   * `headerFactsNoFlags`.
   */
  headerFacts: string;
  /** The same header with nothing declared: "{age} · {height}". */
  headerFactsNoFlags: string;
  /**
   * One flag inside `{flags}`: "{condition} declared". `{condition}` is a medical option's
   * label lowercased the way this language writes a mid-sentence noun ("High cholesterol" →
   * "high cholesterol"); each language phrases it so no participle has to agree with a noun it
   * cannot see.
   */
  flagDeclared: string;
  /** The weight card's label — the same word `healthLabel("weight_kg")` gives Health. */
  weightLabel: string;
  /** The card's action, which writes the S7 row: "Log weight". */
  logWeight: string;
  /** The chart's dashed-line tag: "{w} kg · target" / "{w} lb · target". */
  targetKg: string;
  targetLb: string;
  /** The plan card's label: "Your plan". */
  planLabel: string;
  /** The plan card's affordance, lowercase on the board: "edit". */
  planEdit: string;
  /**
   * The plan's figure as one phrase, "{kcal} kcal a day" — the run-on form the phone's
   * basis, weigh-in and saved cards draw after the number.
   */
  kcalADay: string;
  /** The plan card's muted tail, where "{kcal} kcal" is the big type beside it: "a day". */
  perDay: string;
  /** A macro figure beside its icon, "{g} g" — the card's protein shows no word. */
  grams: string;
  /** "{g} g protein" — the phone's plan line spells it. */
  proteinGrams: string;
  /** "{g} g sat fat" — the second macro the card and the phone's lines show. */
  satFatGrams: string;
  /** The floor marker under the plan figures: "never below {floor}" — `{floor}` is kcal. */
  floorMarker: string;
  /** The first option row — a brand, spelled the same in all eight. */
  appleHealth: string;
  /** Its value when linked, lowercase on the board: "connected". */
  connected: string;
  /** The subscription row — and the phone's subscription screen title: "Subscription". */
  subscription: string;
  /** Its trial value, lowercase on the board: "free week · day {n}". */
  freeWeekDay: string;
  /** The account row — and the phone's account screen title: "Account". */
  account: string;

  /** What only the web board draws: the today column at the screen's right. */
  web: {
    /** The caption under the big figure — "368" over "kcal left ⌄" (the ⌄ is a glyph). */
    kcalLeft: string;
    /** The three macro cards' captions: "{g} g" over "Protein left" etc. */
    proteinLeft: string;
    carbsLeft: string;
    fatLeft: string;
  };

  /** What only the phone boards draw — the You stack's deeper screens. */
  phone: {
    /** The screen's top-bar title: "You" (the tab under it is `SHELL_COPY.navProfile`). */
    title: string;
    /** The profile editor's title — the same word the tab bar uses. */
    profileTitle: string;
    /** The editor screens' commit button: "Save". */
    save: string;

    // ── you-weight.html — the weigh-in ──
    /** Its title: "Your weight". */
    weightTitle: string;
    /**
     * Spud's check over the keypad: "{source} says {w} kg. Is that right?" —
     * `{source}` is the provider's name ("Health", "Apple Health").
     */
    weightCheckKg: string;
    weightCheckLb: string;
    /** The editable figure's own run and the Target row's value: "{w} kg" / "{w} lb". */
    weightKg: string;
    weightLb: string;
    /** The profile editor's Weight row value: "{w} kg · {source}". */
    weightFromKg: string;
    weightFromLb: string;
    /**
     * The line under the figure — a struck previous weight, then the provenance:
     * "{prev} kg · {source}, today {time}". `{prev}` is struck by the client;
     * `{time}` is `Intl`.
     */
    weightSourceKg: string;
    weightSourceLb: string;
    /** The plan recomputing live on the weigh-in and the save: "{from} → {to} kcal a day". */
    planRevised: string;
    /** Spud's confirmation on the saved board: "{w} kg from {source}, saved". */
    savedNoteKg: string;
    savedNoteLb: string;

    // ── you-profile.html / you-saved.html — the editor ──
    /** Row labels; the values are the onboarding option labels and CLDR's country names. */
    goalLabel: string;
    targetLabel: string;
    /** The expandable activity block's header on the editor. */
    activitySection: string;
    /** The same row collapsed on the saved board: "Exercise". */
    activityLabel: string;
    /**
     * One activity option on the editor: "{n} workouts a week" — `{n}` is the option's own
     * label ("0–2", "3–5", "6+"), which the onboarding content already carries.
     */
    activityOption: string;
    countryRow: string;
    judgedAgainst: string;

    // ── you-basis.html — "How we got there", the plan's arithmetic ──
    basisTitle: string;
    /** The resting-energy row. */
    atRest: string;
    /** The day's-activity row. */
    yourDays: string;
    /** The pace row. */
    yourPace: string;
    /** The secondary CTA back into the questions: "Change an answer". */
    changeAnswer: string;

    // ── you-subscription.html ──
    /** The card's label: "Your free week". */
    freeWeekTitle: string;
    /** Its figure: "Day {n} of {total}". */
    dayOfTotal: string;
    /** Beside it: "until {date}" — `{date}` is `Intl`, short weekday and day. */
    untilDate: string;
    /**
     * The two explanation rows' labels: "Before it ends" → "We remind you", "Then" →
     * the monthly price — which is `PAY_COPY`'s `pricePerMonth` ("{price} a month", #126),
     * not a key here: one template for "{price} a month", read from the pay table.
     */
    beforeEnds: string;
    weRemind: string;
    thenLabel: string;
    /** Out to Apple's subscription management: "Manage in the App Store". */
    manageStore: string;
    /** The footer's three links, drawn "Restore · Terms · Privacy". */
    restore: string;
    /** "Terms" — the same word the sign-up consent label links. */
    termsLink: string;
    /** Shorter than `SIGNUP_COPY.privacyLink` ("Privacy Policy") — the board says "Privacy". */
    privacyLink: string;

    // ── you-account.html / you-delete.html ──
    /** The provider row's label — its value is the provider's brand name: "Signed in with". */
    signedInWith: string;
    signOutThis: string;
    signOutEverywhere: string;
    /** The pairing card's label: "Use eait in a browser". */
    pairingTitle: string;
    /** Under the code: "{url} · expires at {time}" — `{url}` is the /start host, `{time}` `Intl`. */
    pairingHint: string;
    newPairingCode: string;
    /** The destructive CTA: "Delete everything". */
    deleteEverything: string;
    /** The sheet's question: "Delete your account?" */
    deleteTitle: string;
    /** What the sheet says goes: the meals, the profile, the health data, the conversation. */
    deleteBody: string;
    /** The sheet's two buttons: "Keep it" and "Delete". */
    keepIt: string;
    deleteConfirm: string;
  };
}

export const YOU_COPY: Localized<YouCopy> = {
  en: {
    headerFacts: "{age} · {height} · {flags}",
    headerFactsNoFlags: "{age} · {height}",
    flagDeclared: "{condition} declared",
    weightLabel: healthLabel("weight_kg", "en"),
    logWeight: "Log weight",
    targetKg: "{w} kg · target",
    targetLb: "{w} lb · target",
    planLabel: "Your plan",
    planEdit: "edit",
    kcalADay: "{kcal} kcal a day",
    perDay: "a day",
    grams: "{g} g",
    proteinGrams: "{g} g protein",
    satFatGrams: "{g} g sat fat",
    floorMarker: "never below {floor}",
    appleHealth: "Apple Health",
    connected: "connected",
    subscription: "Subscription",
    freeWeekDay: "free week · day {n}",
    account: "Account",
    web: {
      kcalLeft: "kcal left",
      proteinLeft: "Protein left",
      carbsLeft: "Carbs left",
      fatLeft: "Fat left",
    },
    phone: {
      title: "You",
      profileTitle: SHELL_COPY.en.navProfile,
      save: "Save",
      weightTitle: "Your weight",
      weightCheckKg: "{source} says {w} kg. Is that right?",
      weightCheckLb: "{source} says {w} lb. Is that right?",
      weightKg: "{w} kg",
      weightLb: "{w} lb",
      weightFromKg: "{w} kg · {source}",
      weightFromLb: "{w} lb · {source}",
      weightSourceKg: "{prev} kg · {source}, today {time}",
      weightSourceLb: "{prev} lb · {source}, today {time}",
      planRevised: "{from} → {to} kcal a day",
      savedNoteKg: "{w} kg from {source}, saved",
      savedNoteLb: "{w} lb from {source}, saved",
      goalLabel: "Goal",
      targetLabel: "Target",
      activitySection: "Exercise frequency",
      activityLabel: "Exercise",
      activityOption: "{n} workouts a week",
      countryRow: "Country",
      judgedAgainst: "Judged against",
      basisTitle: "How we got there",
      atRest: "At rest",
      yourDays: "Your days",
      yourPace: "Your pace",
      changeAnswer: "Change an answer",
      freeWeekTitle: "Your free week",
      dayOfTotal: "Day {n} of {total}",
      untilDate: "until {date}",
      beforeEnds: "Before it ends",
      weRemind: "We remind you",
      thenLabel: "Then",
      manageStore: "Manage in the App Store",
      restore: "Restore",
      termsLink: SIGNUP_COPY.en.termsLink,
      privacyLink: "Privacy",
      signedInWith: "Signed in with",
      signOutThis: "Sign out of this account",
      signOutEverywhere: "Sign out everywhere",
      pairingTitle: "Use eait in a browser",
      pairingHint: "{url} · expires at {time}",
      newPairingCode: "New pairing code",
      deleteEverything: "Delete everything",
      deleteTitle: "Delete your account?",
      deleteBody:
        "Every meal, your profile, your health information and your conversation are erased. " +
        "This cannot be undone.",
      keepIt: "Keep it",
      deleteConfirm: "Delete",
    },
  },
  fr: {
    headerFacts: "{age} · {height} · {flags}",
    headerFactsNoFlags: "{age} · {height}",
    flagDeclared: "vous avez déclaré : {condition}",
    weightLabel: healthLabel("weight_kg", "fr"),
    logWeight: "Enregistrer le poids",
    targetKg: "{w} kg · objectif",
    targetLb: "{w} lb · objectif",
    planLabel: "Ton plan",
    planEdit: "modifier",
    kcalADay: "{kcal} kcal par jour",
    perDay: "par jour",
    grams: "{g} g",
    proteinGrams: "{g} g de protéines",
    satFatGrams: "{g} g de gras saturés",
    floorMarker: "jamais moins de {floor}",
    appleHealth: "Apple Health",
    connected: "connecté",
    subscription: "Abonnement",
    freeWeekDay: "semaine gratuite · jour {n}",
    account: "Compte",
    web: {
      kcalLeft: "kcal restantes",
      proteinLeft: "Protéines restantes",
      carbsLeft: "Glucides restants",
      fatLeft: "Lipides restants",
    },
    phone: {
      title: "Vous",
      profileTitle: shellCopyFor("fr").navProfile,
      save: "Enregistrer",
      weightTitle: "Ton poids",
      weightCheckKg: "{source} indique {w} kg. C'est juste ?",
      weightCheckLb: "{source} indique {w} lb. C'est juste ?",
      weightKg: "{w} kg",
      weightLb: "{w} lb",
      weightFromKg: "{w} kg · {source}",
      weightFromLb: "{w} lb · {source}",
      weightSourceKg: "{prev} kg · {source}, aujourd'hui {time}",
      weightSourceLb: "{prev} lb · {source}, aujourd'hui {time}",
      planRevised: "{from} → {to} kcal par jour",
      savedNoteKg: "{w} kg depuis {source}, enregistré",
      savedNoteLb: "{w} lb depuis {source}, enregistré",
      goalLabel: "Objectif",
      targetLabel: "Cible",
      activitySection: "Fréquence d'exercice",
      activityLabel: "Exercice",
      activityOption: "{n} séances par semaine",
      countryRow: "Pays",
      judgedAgainst: "Évalué selon",
      basisTitle: "Comment on y est arrivé",
      atRest: "Au repos",
      yourDays: "Tes journées",
      yourPace: "Ton rythme",
      changeAnswer: "Modifier une réponse",
      freeWeekTitle: "Ta semaine gratuite",
      dayOfTotal: "Jour {n} sur {total}",
      untilDate: "jusqu'au {date}",
      beforeEnds: "Avant la fin",
      weRemind: "On te le rappelle",
      thenLabel: "Ensuite",
      manageStore: "Gérer dans l'App Store",
      restore: "Restaurer",
      termsLink: signupCopyFor("fr").termsLink,
      privacyLink: "Confidentialité",
      signedInWith: "Connecté avec",
      signOutThis: "Se déconnecter de ce compte",
      signOutEverywhere: "Se déconnecter partout",
      pairingTitle: "Utiliser eait dans un navigateur",
      pairingHint: "{url} · expire à {time}",
      newPairingCode: "Nouveau code d'association",
      deleteEverything: "Tout supprimer",
      deleteTitle: "Supprimer ton compte ?",
      deleteBody:
        "Tous tes repas, ton profil, tes informations de santé et ta conversation sont effacés. " +
        "C'est irréversible.",
      keepIt: "Garder",
      deleteConfirm: "Supprimer",
    },
  },
  de: {
    headerFacts: "{age} · {height} · {flags}",
    headerFactsNoFlags: "{age} · {height}",
    flagDeclared: "von dir angegeben: {condition}",
    weightLabel: healthLabel("weight_kg", "de"),
    logWeight: "Gewicht eintragen",
    targetKg: "{w} kg · Ziel",
    targetLb: "{w} lb · Ziel",
    planLabel: "Dein Plan",
    planEdit: "bearbeiten",
    kcalADay: "{kcal} kcal am Tag",
    perDay: "am Tag",
    grams: "{g} g",
    proteinGrams: "{g} g Eiweiß",
    satFatGrams: "{g} g gesättigte Fette",
    floorMarker: "nie unter {floor}",
    appleHealth: "Apple Health",
    connected: "verbunden",
    subscription: "Abo",
    freeWeekDay: "Gratiswoche · Tag {n}",
    account: "Konto",
    web: {
      kcalLeft: "kcal übrig",
      proteinLeft: "Eiweiß übrig",
      carbsLeft: "Kohlenhydrate übrig",
      fatLeft: "Fett übrig",
    },
    phone: {
      title: "Du",
      profileTitle: shellCopyFor("de").navProfile,
      save: "Speichern",
      weightTitle: "Dein Gewicht",
      weightCheckKg: "{source} sagt {w} kg. Stimmt das?",
      weightCheckLb: "{source} sagt {w} lb. Stimmt das?",
      weightKg: "{w} kg",
      weightLb: "{w} lb",
      weightFromKg: "{w} kg · {source}",
      weightFromLb: "{w} lb · {source}",
      weightSourceKg: "{prev} kg · {source}, heute {time}",
      weightSourceLb: "{prev} lb · {source}, heute {time}",
      planRevised: "{from} → {to} kcal am Tag",
      savedNoteKg: "{w} kg von {source}, gespeichert",
      savedNoteLb: "{w} lb von {source}, gespeichert",
      goalLabel: "Ziel",
      targetLabel: "Zielgewicht",
      activitySection: "Trainingshäufigkeit",
      activityLabel: "Training",
      activityOption: "{n} Workouts pro Woche",
      countryRow: "Land",
      judgedAgainst: "Bewertet nach",
      basisTitle: "Wie wir darauf kommen",
      atRest: "In Ruhe",
      yourDays: "Deine Tage",
      yourPace: "Dein Tempo",
      changeAnswer: "Eine Antwort ändern",
      freeWeekTitle: "Deine Gratiswoche",
      dayOfTotal: "Tag {n} von {total}",
      untilDate: "bis {date}",
      beforeEnds: "Bevor sie endet",
      weRemind: "Wir erinnern dich",
      thenLabel: "Danach",
      manageStore: "Im App Store verwalten",
      restore: "Wiederherstellen",
      termsLink: signupCopyFor("de").termsLink,
      privacyLink: "Datenschutz",
      signedInWith: "Angemeldet mit",
      signOutThis: "Von diesem Konto abmelden",
      signOutEverywhere: "Überall abmelden",
      pairingTitle: "eait im Browser nutzen",
      pairingHint: "{url} · läuft um {time} ab",
      newPairingCode: "Neuer Kopplungscode",
      deleteEverything: "Alles löschen",
      deleteTitle: "Dein Konto löschen?",
      deleteBody:
        "Jede Mahlzeit, dein Profil, deine Gesundheitsdaten und dein Gespräch werden gelöscht. " +
        "Das lässt sich nicht rückgängig machen.",
      keepIt: "Behalten",
      deleteConfirm: "Löschen",
    },
  },
  it: {
    headerFacts: "{age} · {height} · {flags}",
    headerFactsNoFlags: "{age} · {height}",
    flagDeclared: "condizioni indicate: {condition}",
    weightLabel: healthLabel("weight_kg", "it"),
    logWeight: "Registra il peso",
    targetKg: "{w} kg · obiettivo",
    targetLb: "{w} lb · obiettivo",
    planLabel: "Il tuo piano",
    planEdit: "modifica",
    kcalADay: "{kcal} kcal al giorno",
    perDay: "al giorno",
    grams: "{g} g",
    proteinGrams: "{g} g di proteine",
    satFatGrams: "{g} g di grassi saturi",
    floorMarker: "mai sotto {floor}",
    appleHealth: "Apple Health",
    connected: "connesso",
    subscription: "Abbonamento",
    freeWeekDay: "settimana gratis · giorno {n}",
    account: "Account",
    web: {
      kcalLeft: "kcal rimaste",
      proteinLeft: "Proteine rimaste",
      carbsLeft: "Carboidrati rimasti",
      fatLeft: "Grassi rimasti",
    },
    phone: {
      title: "Tu",
      profileTitle: shellCopyFor("it").navProfile,
      save: "Salva",
      weightTitle: "Il tuo peso",
      weightCheckKg: "{source} dice {w} kg. È giusto?",
      weightCheckLb: "{source} dice {w} lb. È giusto?",
      weightKg: "{w} kg",
      weightLb: "{w} lb",
      weightFromKg: "{w} kg · {source}",
      weightFromLb: "{w} lb · {source}",
      weightSourceKg: "{prev} kg · {source}, oggi {time}",
      weightSourceLb: "{prev} lb · {source}, oggi {time}",
      planRevised: "{from} → {to} kcal al giorno",
      savedNoteKg: "{w} kg da {source}, salvato",
      savedNoteLb: "{w} lb da {source}, salvato",
      goalLabel: "Obiettivo",
      targetLabel: "Peso obiettivo",
      activitySection: "Frequenza di allenamento",
      activityLabel: "Allenamento",
      activityOption: "{n} allenamenti a settimana",
      countryRow: "Paese",
      judgedAgainst: "Valutato rispetto a",
      basisTitle: "Come ci siamo arrivati",
      atRest: "A riposo",
      yourDays: "Le tue giornate",
      yourPace: "Il tuo ritmo",
      changeAnswer: "Cambia una risposta",
      freeWeekTitle: "La tua settimana gratis",
      dayOfTotal: "Giorno {n} di {total}",
      untilDate: "fino al {date}",
      beforeEnds: "Prima che finisca",
      weRemind: "Ti avvisiamo noi",
      thenLabel: "Poi",
      manageStore: "Gestisci nell'App Store",
      restore: "Ripristina",
      termsLink: signupCopyFor("it").termsLink,
      privacyLink: "Privacy",
      signedInWith: "Accesso con",
      signOutThis: "Esci da questo account",
      signOutEverywhere: "Esci ovunque",
      pairingTitle: "Usa eait in un browser",
      pairingHint: "{url} · scade alle {time}",
      newPairingCode: "Nuovo codice di abbinamento",
      deleteEverything: "Elimina tutto",
      deleteTitle: "Eliminare il tuo account?",
      deleteBody:
        "Ogni pasto, il tuo profilo, le tue informazioni sulla salute e la tua conversazione " +
        "vengono eliminati. Non si può annullare.",
      keepIt: "Tienilo",
      deleteConfirm: "Elimina",
    },
  },
  es: {
    headerFacts: "{age} · {height} · {flags}",
    headerFactsNoFlags: "{age} · {height}",
    flagDeclared: "has indicado: {condition}",
    weightLabel: healthLabel("weight_kg", "es"),
    logWeight: "Registrar el peso",
    targetKg: "{w} kg · objetivo",
    targetLb: "{w} lb · objetivo",
    planLabel: "Tu plan",
    planEdit: "editar",
    kcalADay: "{kcal} kcal al día",
    perDay: "al día",
    grams: "{g} g",
    proteinGrams: "{g} g de proteína",
    satFatGrams: "{g} g de grasa saturada",
    floorMarker: "nunca por debajo de {floor}",
    appleHealth: "Apple Health",
    connected: "conectado",
    subscription: "Suscripción",
    freeWeekDay: "semana gratis · día {n}",
    account: "Cuenta",
    web: {
      kcalLeft: "kcal restantes",
      proteinLeft: "Proteína restante",
      carbsLeft: "Carbohidratos restantes",
      fatLeft: "Grasa restante",
    },
    phone: {
      title: "Tú",
      profileTitle: shellCopyFor("es").navProfile,
      save: "Guardar",
      weightTitle: "Tu peso",
      weightCheckKg: "{source} dice {w} kg. ¿Es correcto?",
      weightCheckLb: "{source} dice {w} lb. ¿Es correcto?",
      weightKg: "{w} kg",
      weightLb: "{w} lb",
      weightFromKg: "{w} kg · {source}",
      weightFromLb: "{w} lb · {source}",
      weightSourceKg: "{prev} kg · {source}, hoy {time}",
      weightSourceLb: "{prev} lb · {source}, hoy {time}",
      planRevised: "{from} → {to} kcal al día",
      savedNoteKg: "{w} kg de {source}, guardado",
      savedNoteLb: "{w} lb de {source}, guardado",
      goalLabel: "Objetivo",
      targetLabel: "Peso objetivo",
      activitySection: "Frecuencia de ejercicio",
      activityLabel: "Ejercicio",
      activityOption: "{n} entrenamientos a la semana",
      countryRow: "País",
      judgedAgainst: "Evaluado según",
      basisTitle: "Cómo llegamos ahí",
      atRest: "En reposo",
      yourDays: "Tus días",
      yourPace: "Tu ritmo",
      changeAnswer: "Cambiar una respuesta",
      freeWeekTitle: "Tu semana gratis",
      dayOfTotal: "Día {n} de {total}",
      untilDate: "hasta el {date}",
      beforeEnds: "Antes de que acabe",
      weRemind: "Te lo recordamos",
      thenLabel: "Después",
      manageStore: "Gestionar en App Store",
      restore: "Restaurar",
      termsLink: signupCopyFor("es").termsLink,
      privacyLink: "Privacidad",
      signedInWith: "Sesión iniciada con",
      signOutThis: "Cerrar sesión en esta cuenta",
      signOutEverywhere: "Cerrar sesión en todas partes",
      pairingTitle: "Usar eait en un navegador",
      pairingHint: "{url} · caduca a las {time}",
      newPairingCode: "Nuevo código de vinculación",
      deleteEverything: "Borrar todo",
      deleteTitle: "¿Eliminar tu cuenta?",
      deleteBody:
        "Cada comida, tu perfil, tu información de salud y tu conversación se borran. " +
        "No se puede deshacer.",
      keepIt: "Conservar",
      deleteConfirm: "Eliminar",
    },
  },
  vi: {
    headerFacts: "{age} · {height} · {flags}",
    headerFactsNoFlags: "{age} · {height}",
    flagDeclared: "đã khai báo: {condition}",
    weightLabel: healthLabel("weight_kg", "vi"),
    logWeight: "Ghi cân nặng",
    targetKg: "{w} kg · mục tiêu",
    targetLb: "{w} lb · mục tiêu",
    planLabel: "Kế hoạch của bạn",
    planEdit: "sửa",
    kcalADay: "{kcal} kcal một ngày",
    perDay: "một ngày",
    grams: "{g} g",
    proteinGrams: "{g} g đạm",
    satFatGrams: "{g} g chất béo bão hòa",
    floorMarker: "không dưới {floor}",
    appleHealth: "Apple Health",
    connected: "đã kết nối",
    subscription: "Gói đăng ký",
    freeWeekDay: "tuần miễn phí · ngày {n}",
    account: "Tài khoản",
    web: {
      kcalLeft: "kcal còn lại",
      proteinLeft: "Đạm còn lại",
      carbsLeft: "Carb còn lại",
      fatLeft: "Chất béo còn lại",
    },
    phone: {
      title: "Bạn",
      profileTitle: shellCopyFor("vi").navProfile,
      save: "Lưu",
      weightTitle: "Cân nặng của bạn",
      weightCheckKg: "{source} báo {w} kg. Đúng không?",
      weightCheckLb: "{source} báo {w} lb. Đúng không?",
      weightKg: "{w} kg",
      weightLb: "{w} lb",
      weightFromKg: "{w} kg · {source}",
      weightFromLb: "{w} lb · {source}",
      weightSourceKg: "{prev} kg · {source}, hôm nay {time}",
      weightSourceLb: "{prev} lb · {source}, hôm nay {time}",
      planRevised: "{from} → {to} kcal một ngày",
      savedNoteKg: "{w} kg từ {source}, đã lưu",
      savedNoteLb: "{w} lb từ {source}, đã lưu",
      goalLabel: "Mục tiêu",
      targetLabel: "Cân nặng mục tiêu",
      activitySection: "Tần suất tập luyện",
      activityLabel: "Tập luyện",
      activityOption: "{n} buổi tập một tuần",
      countryRow: "Quốc gia",
      judgedAgainst: "Đánh giá theo",
      basisTitle: "Cách chúng tôi tính",
      atRest: "Khi nghỉ",
      yourDays: "Ngày của bạn",
      yourPace: "Nhịp của bạn",
      changeAnswer: "Đổi một câu trả lời",
      freeWeekTitle: "Tuần miễn phí của bạn",
      dayOfTotal: "Ngày {n}/{total}",
      untilDate: "đến {date}",
      beforeEnds: "Trước khi kết thúc",
      weRemind: "Chúng tôi nhắc bạn",
      thenLabel: "Sau đó",
      manageStore: "Quản lý trong App Store",
      restore: "Khôi phục",
      termsLink: signupCopyFor("vi").termsLink,
      privacyLink: "Bảo mật",
      signedInWith: "Đăng nhập bằng",
      signOutThis: "Đăng xuất khỏi tài khoản này",
      signOutEverywhere: "Đăng xuất mọi nơi",
      pairingTitle: "Dùng eait trên trình duyệt",
      pairingHint: "{url} · hết hạn lúc {time}",
      newPairingCode: "Mã ghép mới",
      deleteEverything: "Xóa tất cả",
      deleteTitle: "Xóa tài khoản của bạn?",
      deleteBody:
        "Mọi bữa ăn, hồ sơ, thông tin sức khỏe và cuộc trò chuyện của bạn đều bị xóa. " +
        "Không thể hoàn tác.",
      keepIt: "Giữ lại",
      deleteConfirm: "Xóa",
    },
  },
  id: {
    headerFacts: "{age} · {height} · {flags}",
    headerFactsNoFlags: "{age} · {height}",
    flagDeclared: "{condition} (dinyatakan)",
    weightLabel: healthLabel("weight_kg", "id"),
    logWeight: "Catat berat",
    targetKg: "{w} kg · target",
    targetLb: "{w} lb · target",
    planLabel: "Rencanamu",
    planEdit: "edit",
    kcalADay: "{kcal} kcal sehari",
    perDay: "sehari",
    grams: "{g} g",
    proteinGrams: "{g} g protein",
    satFatGrams: "{g} g lemak jenuh",
    floorMarker: "tidak di bawah {floor}",
    appleHealth: "Apple Health",
    connected: "terhubung",
    subscription: "Langganan",
    freeWeekDay: "minggu gratis · hari {n}",
    account: "Akun",
    web: {
      kcalLeft: "kcal tersisa",
      proteinLeft: "Protein tersisa",
      carbsLeft: "Karbo tersisa",
      fatLeft: "Lemak tersisa",
    },
    phone: {
      title: "Kamu",
      profileTitle: shellCopyFor("id").navProfile,
      save: "Simpan",
      weightTitle: "Beratmu",
      weightCheckKg: "{source} bilang {w} kg. Benar?",
      weightCheckLb: "{source} bilang {w} lb. Benar?",
      weightKg: "{w} kg",
      weightLb: "{w} lb",
      weightFromKg: "{w} kg · {source}",
      weightFromLb: "{w} lb · {source}",
      weightSourceKg: "{prev} kg · {source}, hari ini {time}",
      weightSourceLb: "{prev} lb · {source}, hari ini {time}",
      planRevised: "{from} → {to} kcal sehari",
      savedNoteKg: "{w} kg dari {source}, tersimpan",
      savedNoteLb: "{w} lb dari {source}, tersimpan",
      goalLabel: "Tujuan",
      targetLabel: "Berat target",
      activitySection: "Frekuensi olahraga",
      activityLabel: "Olahraga",
      activityOption: "{n} latihan seminggu",
      countryRow: "Negara",
      judgedAgainst: "Dinilai berdasarkan",
      basisTitle: "Bagaimana kami sampai",
      atRest: "Saat istirahat",
      yourDays: "Harimu",
      yourPace: "Tempomu",
      changeAnswer: "Ubah satu jawaban",
      freeWeekTitle: "Minggu gratismu",
      dayOfTotal: "Hari {n} dari {total}",
      untilDate: "sampai {date}",
      beforeEnds: "Sebelum berakhir",
      weRemind: "Kami ingatkan",
      thenLabel: "Lalu",
      manageStore: "Kelola di App Store",
      restore: "Pulihkan",
      termsLink: signupCopyFor("id").termsLink,
      privacyLink: "Privasi",
      signedInWith: "Masuk dengan",
      signOutThis: "Keluar dari akun ini",
      signOutEverywhere: "Keluar di semua perangkat",
      pairingTitle: "Pakai eait di browser",
      pairingHint: "{url} · kedaluwarsa pukul {time}",
      newPairingCode: "Kode pairing baru",
      deleteEverything: "Hapus semuanya",
      deleteTitle: "Hapus akunmu?",
      deleteBody:
        "Semua makanan, profil, informasi kesehatan, dan percakapanmu terhapus. " +
        "Ini tidak bisa dibatalkan.",
      keepIt: "Simpan",
      deleteConfirm: "Hapus",
    },
  },
  ru: {
    headerFacts: "{age} · {height} · {flags}",
    headerFactsNoFlags: "{age} · {height}",
    flagDeclared: "указано: {condition}",
    weightLabel: healthLabel("weight_kg", "ru"),
    logWeight: "Записать вес",
    targetKg: "{w} кг · цель",
    targetLb: "{w} lb · цель",
    planLabel: "Твой план",
    planEdit: "изменить",
    kcalADay: "{kcal} ккал в день",
    perDay: "в день",
    grams: "{g} г",
    proteinGrams: "{g} г белка",
    satFatGrams: "{g} г насыщенных жиров",
    floorMarker: "не ниже {floor}",
    appleHealth: "Apple Health",
    connected: "подключено",
    subscription: "Подписка",
    freeWeekDay: "бесплатная неделя · день {n}",
    account: "Аккаунт",
    web: {
      kcalLeft: "ккал осталось",
      proteinLeft: "Осталось белка",
      carbsLeft: "Осталось углеводов",
      fatLeft: "Осталось жиров",
    },
    phone: {
      title: "Вы",
      profileTitle: shellCopyFor("ru").navProfile,
      save: "Сохранить",
      weightTitle: "Твой вес",
      weightCheckKg: "{source} сообщает: {w} кг. Всё верно?",
      weightCheckLb: "{source} сообщает: {w} lb. Всё верно?",
      weightKg: "{w} кг",
      weightLb: "{w} lb",
      weightFromKg: "{w} кг · {source}",
      weightFromLb: "{w} lb · {source}",
      weightSourceKg: "{prev} кг · {source}, сегодня {time}",
      weightSourceLb: "{prev} lb · {source}, сегодня {time}",
      planRevised: "{from} → {to} ккал в день",
      savedNoteKg: "{w} кг из {source} — сохранено",
      savedNoteLb: "{w} lb из {source} — сохранено",
      goalLabel: "Цель",
      targetLabel: "Целевой вес",
      activitySection: "Частота тренировок",
      activityLabel: "Тренировки",
      activityOption: "{n} тренировок в неделю",
      countryRow: "Страна",
      judgedAgainst: "Оценка по",
      basisTitle: "Как мы это посчитали",
      atRest: "В покое",
      yourDays: "Твои дни",
      yourPace: "Твой темп",
      changeAnswer: "Изменить ответ",
      freeWeekTitle: "Твоя бесплатная неделя",
      dayOfTotal: "День {n} из {total}",
      untilDate: "до {date}",
      beforeEnds: "Пока не кончилась",
      weRemind: "Мы напомним",
      thenLabel: "Дальше",
      manageStore: "Управлять в App Store",
      restore: "Восстановить",
      termsLink: signupCopyFor("ru").termsLink,
      privacyLink: "Конфиденциальность",
      signedInWith: "Вход через",
      signOutThis: "Выйти из этого аккаунта",
      signOutEverywhere: "Выйти везде",
      pairingTitle: "eait в браузере",
      pairingHint: "{url} · истекает в {time}",
      newPairingCode: "Новый код привязки",
      deleteEverything: "Удалить всё",
      deleteTitle: "Удалить аккаунт?",
      deleteBody:
        "Все приёмы пищи, твой профиль, данные о здоровье и переписка будут стёрты. " +
        "Это необратимо.",
      keepIt: "Оставить",
      deleteConfirm: "Удалить",
    },
  },
};

export const youCopyFor = (lang: Lang): YouCopy => t(lang)(YOU_COPY);
