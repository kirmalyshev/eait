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

import { LANG_TAG, listConjunction, numbers, t, type Localized } from "../lang.ts";
import type { Lang } from "../types.ts";
import { healthLabel } from "../health-copy.ts";
import { heightText, type UnitSystem } from "../ui/units.ts";
import { SHELL_COPY, shellCopyFor } from "./shell-copy.ts";
import { SIGNUP_COPY, signupCopyFor } from "./signup-copy.ts";

export interface YouCopy {
  // ── The screen both clients draw (web/you.html, phone/you.html) ──────────────────────────
  /**
   * The header's fact line under the name: "32 · 172cm · high cholesterol declared".
   * `{age}` is a bare number, `{height}` arrives preformatted — "172cm" or `cmToFtIn`'s "5′8″" —
   * and `{flags}` is `flagDeclared`'s output; with nothing declared the line is
   * `headerFactsNoFlags`.
   */
  headerFacts: string;
  /** The same header with nothing declared: "{age} · {height}". */
  headerFactsNoFlags: string;
  /** A partial profile, age and flags but no height: "{age} · {flags}". */
  headerFactsAgeFlags: string;
  /** A partial profile, height and flags but no birth year: "{height} · {flags}". */
  headerFactsHeightFlags: string;
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
  /** The chart's dashed-line tag: "{w}kg · target" / "{w}lb · target". */
  targetKg: string;
  targetLb: string;
  /** The plan card's label: "Your plan". */
  planLabel: string;
  /** The plan card's affordance, lowercase on the board: "edit". */
  planEdit: string;
  /**
   * The plan's figure as one phrase, "{kcal}kcal a day" — the run-on form the phone's
   * basis, weigh-in and saved cards draw after the number.
   */
  kcalADay: string;
  /** The plan card's muted tail, where "{kcal}kcal" is the big type beside it: "a day". */
  perDay: string;
  /** A macro figure beside its icon, "{g}g" — the card's protein shows no word. */
  grams: string;
  /** "{g}g protein" — the phone's plan line spells it. */
  proteinGrams: string;
  /**
   * The saturated-fat macro, "{g}g {noun}" — `{noun}` is filled with `LOG_COPY.satfatNoun`
   * so the plan names the same dimension the verdicts do, in one wording.
   */
  satFatGrams: string;
  /** The "How we got there" floor marker: "never below {floor}" — `{floor}` is kcal. */
  floorMarker: string;
  /** The first option row — a brand, spelled the same in all eight. */
  appleHealth: string;
  /** Its value when linked, lowercase on the board: "connected". */
  connected: string;
  /** The subscription row — and the phone's subscription screen title: "Subscription". */
  subscription: string;
  /** Its trial value, lowercase on the board: "free week · day {n}". */
  freeWeekDay: string;
  /** Its paid value: "until {date}" — the period's end; the store never says it renews. */
  subscriptionUntil: string;
  /** The lifetime unlock's value: "lifetime". */
  subscriptionLifetime: string;
  /** A lapsed period: "ended {date}" — and "ended" alone when the record keeps no date. */
  subscriptionEnded: string;
  subscriptionEndedNoDate: string;
  /** Its value when the account has never bought: "free". */
  subscriptionFree: string;
  /** The account row — and the phone's account screen title: "Account". */
  account: string;

  /** What only the web board draws. The day column's own words are HOME_COPY's — the column is
      the same component on both surfaces, so its captions come from one table. */
  web: {
    /** The Units row's label and its two options — the symbols are `spellUnit`'s, spelled the
        way the language writes them (`kg · cm` / `lb · ft`, Russian "кг · см"). */
    units: string;
    unitsMetric: string;
    unitsImperial: string;
    /** The optional Support row's label (#200) — drawn only while the operator configures a
        donation URL; the provider names beside it are brands and stay untranslated. */
    support: string;
  };

  /** What only the phone boards draw — the You stack's deeper screens. */
  phone: {
    /** The screen's top-bar title: "You" (the tab under it is `SHELL_COPY.navProfile`). */
    title: string;
    /** The profile editor's title — the same word the tab bar uses. */
    profileTitle: string;
    /** The editor screens' commit button: "Save". */
    save: string;
    /** A failed save: what was entered is still in the field, Save sends it again. */
    saveKept: string;

    // ── you-weight.html — the weigh-in ──
    /** Its title: "Your weight". */
    weightTitle: string;
    /**
     * Spud's check over the keypad: "{source} says {w}kg. Is that right?" —
     * `{source}` is the provider's name ("Health", "Apple Health").
     */
    weightCheckKg: string;
    weightCheckLb: string;
    /** The editable figure's own run and the Target row's value: "{w}kg" / "{w}lb". */
    weightKg: string;
    weightLb: string;
    /** The profile editor's Weight row value: "{w}kg · {source}". */
    weightFromKg: string;
    weightFromLb: string;
    /**
     * The line under the figure — a struck previous weight, then the provenance:
     * "{prev}kg · {source}, today {time}". `{prev}` is struck by the client;
     * `{time}` is `Intl`.
     */
    weightSourceKg: string;
    weightSourceLb: string;
    /**
     * `{source}` for a reading the person TYPED — "you" — filling the slot the provider's
     * name does, so `weightSourceKg`/`weightSourceOnKg` still read honestly for a manual
     * weigh-in: "{prev}kg · you, today {time}".
     */
    sourceYou: string;
    /**
     * The check's typed-reading variant — "{source} says" has no source to name when the
     * person typed the figure: "You typed {w}kg. Is that right?"
     */
    weightCheckTypedKg: string;
    weightCheckTypedLb: string;
    /**
     * The provenance line past the reading's own day — "{prev}kg · {source}, {date}",
     * `{date}` an `Intl` short date. `weightSourceKg` is the same-day wording.
     */
    weightSourceOnKg: string;
    weightSourceOnLb: string;
    /** The plan recomputing live on the weigh-in and the save: "{from} → {to}kcal a day". */
    planRevised: string;
    /** Spud's confirmation on the saved board: "{w}kg from {source}, saved". */
    savedNoteKg: string;
    savedNoteLb: string;
    /** A typed weight's saved line — "{w}kg, saved"; there is no {source} to name. */
    savedNoteTypedKg: string;
    savedNoteTypedLb: string;

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
    /**
     * The guard over leaving the editor with changes still staged — "Discard changes?",
     * then "Keep editing" / "Discard" (design-pro, ieat-app#929).
     */
    discardTitle: string;
    discardCancel: string;
    discardConfirm: string;

    /**
     * A sheet's scrim — the tap-outside dismissal — as VoiceOver names it: "Dismiss".
     * (The phone's pickers and the delete sheet share it.)
     */
    dismiss: string;
    /**
     * How a flat row ANNOUNCES itself to a reader when it carries a value — "{label}: {value}" —
     * "Language: English". The visible pieces stay separate elements; this is the label the row
     * reads as ONE element, so the separator is the language's own punctuation, not a code join.
     */
    labeledValue: string;

    // ── the flat card's own pickers — units' labels are `web.units*` above ──
    /** The Language row's label — "Language". */
    language: string;
    /** The Appearance row's label — "Appearance" (the phone follows its own theme setting). */
    appearance: string;
    /** The theme picker's three answers — "Light" / "Dark" / "System". */
    themeLight: string;
    themeDark: string;
    themeSystem: string;

    // ── the sign-out rows' confirmations — the account board draws the rows; the questions ──
    // ── are the phone's own guard against a one-tap sign-out ──
    /** "Sign out?" — and what stays behind. */
    signOutTitle: string;
    signOutBody: string;
    /** "Sign out everywhere?" — the everywhere one is also destructive here, so it says so. */
    signOutEverywhereTitle: string;
    signOutEverywhereBody: string;
    /** The alerts' cancel. */
    cancel: string;
    /** The first confirm — "Sign out"; the second's is `signOutEverywhere`, same words. */
    signOutConfirm: string;
  };
}

export const YOU_COPY: Localized<YouCopy> = {
  en: {
    headerFacts: "{age} · {height} · {flags}",
    headerFactsNoFlags: "{age} · {height}",
    headerFactsAgeFlags: "{age} · {flags}",
    headerFactsHeightFlags: "{height} · {flags}",
    flagDeclared: "{condition} declared",
    weightLabel: healthLabel("weight_kg", "en"),
    logWeight: "Log weight",
    targetKg: "{w}kg · target",
    targetLb: "{w}lb · target",
    planLabel: "Your plan",
    planEdit: "edit",
    kcalADay: "{kcal}kcal a day",
    perDay: "a day",
    grams: "{g}g",
    proteinGrams: "{g}g protein",
    satFatGrams: "{g}g {noun}",
    floorMarker: "never below {floor}",
    appleHealth: "Apple Health",
    connected: "connected",
    subscription: "Subscription",
    freeWeekDay: "free week · day {n}",
    subscriptionUntil: "until {date}",
    subscriptionLifetime: "lifetime",
    subscriptionEnded: "ended {date}",
    subscriptionEndedNoDate: "ended",
    subscriptionFree: "free",
    account: "Account",
    web: {
      units: "Units",
      unitsMetric: "kg · cm",
      unitsImperial: "lb · ft",
      support: "Support eait",
    },
    phone: {
      title: "You",
      profileTitle: SHELL_COPY.en.navProfile,
      save: "Save",
      saveKept: "Couldn't save that. What you entered is still here. Save again.",
      weightTitle: "Your weight",
      weightCheckKg: "{source} says {w}kg. Is that right?",
      weightCheckLb: "{source} says {w}lb. Is that right?",
      sourceYou: "you",
      weightCheckTypedKg: "You typed {w}kg. Is that right?",
      weightCheckTypedLb: "You typed {w}lb. Is that right?",
      weightKg: "{w}kg",
      weightLb: "{w}lb",
      weightFromKg: "{w}kg · {source}",
      weightFromLb: "{w}lb · {source}",
      weightSourceKg: "{prev}kg · {source}, today {time}",
      weightSourceLb: "{prev}lb · {source}, today {time}",
      weightSourceOnKg: "{prev}kg · {source}, {date}",
      weightSourceOnLb: "{prev}lb · {source}, {date}",
      planRevised: "{from} → {to}kcal a day",
      savedNoteKg: "{w}kg from {source}, saved",
      savedNoteLb: "{w}lb from {source}, saved",
      savedNoteTypedKg: "{w}kg, saved",
      savedNoteTypedLb: "{w}lb, saved",
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
      language: "Language",
      appearance: "Appearance",
      themeLight: "Light",
      themeDark: "Dark",
      themeSystem: "System",
      signOutTitle: "Sign out?",
      signOutBody: "Your meals stay on your account. Sign in again on any device to get them back.",
      signOutEverywhereTitle: "Sign out everywhere?",
      signOutEverywhereBody: "Every device and browser signed into this account is signed out, including this phone. Your meals stay on your account — sign in again to get them back.",
      cancel: "Cancel",
      signOutConfirm: "Sign out",
      discardTitle: "Discard changes?",
      discardCancel: "Keep editing",
      discardConfirm: "Discard",
      dismiss: "Dismiss",
      labeledValue: "{label}: {value}",
    },
  },
  fr: {
    headerFacts: "{age} · {height} · {flags}",
    headerFactsNoFlags: "{age} · {height}",
    headerFactsAgeFlags: "{age} · {flags}",
    headerFactsHeightFlags: "{height} · {flags}",
    flagDeclared: "« {condition} » indiqué",
    weightLabel: healthLabel("weight_kg", "fr"),
    logWeight: "Enregistrer le poids",
    targetKg: "{w}kg · objectif",
    targetLb: "{w}lb · objectif",
    planLabel: "Ton plan",
    planEdit: "modifier",
    kcalADay: "{kcal}kcal par jour",
    perDay: "par jour",
    grams: "{g}g",
    proteinGrams: "{g}g de protéines",
    satFatGrams: "{g}g de {noun}",
    floorMarker: "jamais moins de {floor}",
    appleHealth: "Apple Health",
    connected: "connecté",
    subscription: "Abonnement",
    freeWeekDay: "semaine gratuite · jour {n}",
    subscriptionUntil: "jusqu'au {date}",
    subscriptionLifetime: "à vie",
    subscriptionEnded: "terminé le {date}",
    subscriptionEndedNoDate: "terminé",
    subscriptionFree: "gratuit",
    account: "Compte",
    web: {
      units: "Unités",
      unitsMetric: "kg · cm",
      unitsImperial: "lb · ft",
      support: "Soutenir eait",
    },
    phone: {
      title: "Toi",
      profileTitle: shellCopyFor("fr").navProfile,
      save: "Enregistrer",
      saveKept: "Impossible d'enregistrer. Ce que tu as saisi est toujours là. Enregistre à nouveau.",
      weightTitle: "Ton poids",
      weightCheckKg: "{source} indique {w}kg. C'est juste ?",
      weightCheckLb: "{source} indique {w}lb. C'est juste ?",
      sourceYou: "ta saisie",
      weightCheckTypedKg: "Tu as saisi {w}kg. C'est juste ?",
      weightCheckTypedLb: "Tu as saisi {w}lb. C'est juste ?",
      weightKg: "{w}kg",
      weightLb: "{w}lb",
      weightFromKg: "{w}kg · {source}",
      weightFromLb: "{w}lb · {source}",
      weightSourceKg: "{prev}kg · {source}, aujourd'hui {time}",
      weightSourceLb: "{prev}lb · {source}, aujourd'hui {time}",
      weightSourceOnKg: "{prev}kg · {source}, le {date}",
      weightSourceOnLb: "{prev}lb · {source}, le {date}",
      planRevised: "{from} → {to}kcal par jour",
      savedNoteKg: "{w}kg depuis {source}, enregistré",
      savedNoteLb: "{w}lb depuis {source}, enregistré",
      savedNoteTypedKg: "{w}kg, enregistré",
      savedNoteTypedLb: "{w}lb, enregistré",
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
      language: "Langue",
      appearance: "Apparence",
      themeLight: "Clair",
      themeDark: "Sombre",
      themeSystem: "Système",
      signOutTitle: "Se déconnecter ?",
      signOutBody: "Tes repas restent sur ton compte. Reconnecte-toi sur n'importe quel appareil pour les retrouver.",
      signOutEverywhereTitle: "Se déconnecter partout ?",
      signOutEverywhereBody: "Tous les appareils et navigateurs connectés à ce compte sont déconnectés, y compris ce téléphone. Tes repas restent sur ton compte — reconnecte-toi pour les retrouver.",
      cancel: "Annuler",
      signOutConfirm: "Se déconnecter",
      discardTitle: "Ignorer les modifications ?",
      discardCancel: "Continuer la modification",
      discardConfirm: "Ignorer",
      dismiss: "Fermer",
      labeledValue: "{label}: {value}",
    },
  },
  de: {
    headerFacts: "{age} · {height} · {flags}",
    headerFactsNoFlags: "{age} · {height}",
    headerFactsAgeFlags: "{age} · {flags}",
    headerFactsHeightFlags: "{height} · {flags}",
    flagDeclared: "von dir angegeben: {condition}",
    weightLabel: healthLabel("weight_kg", "de"),
    logWeight: "Gewicht eintragen",
    targetKg: "{w}kg · Ziel",
    targetLb: "{w}lb · Ziel",
    planLabel: "Dein Plan",
    planEdit: "bearbeiten",
    kcalADay: "{kcal}kcal am Tag",
    perDay: "am Tag",
    grams: "{g}g",
    proteinGrams: "{g}g Eiweiß",
    satFatGrams: "{g}g {noun}",
    floorMarker: "nie unter {floor}",
    appleHealth: "Apple Health",
    connected: "verbunden",
    subscription: "Abo",
    freeWeekDay: "Gratiswoche · Tag {n}",
    subscriptionUntil: "bis {date}",
    subscriptionLifetime: "lebenslang",
    subscriptionEnded: "beendet am {date}",
    subscriptionEndedNoDate: "beendet",
    subscriptionFree: "kostenlos",
    account: "Konto",
    web: {
      units: "Einheiten",
      unitsMetric: "kg · cm",
      unitsImperial: "lb · ft",
      support: "eait unterstützen",
    },
    phone: {
      title: "Du",
      profileTitle: shellCopyFor("de").navProfile,
      save: "Speichern",
      saveKept: "Das konnte nicht gespeichert werden. Deine Eingabe ist noch da. Speichere noch einmal.",
      weightTitle: "Dein Gewicht",
      weightCheckKg: "{source} sagt {w}kg. Stimmt das?",
      weightCheckLb: "{source} sagt {w}lb. Stimmt das?",
      sourceYou: "deine Eingabe",
      weightCheckTypedKg: "Du hast {w}kg eingetragen. Stimmt das?",
      weightCheckTypedLb: "Du hast {w}lb eingetragen. Stimmt das?",
      weightKg: "{w}kg",
      weightLb: "{w}lb",
      weightFromKg: "{w}kg · {source}",
      weightFromLb: "{w}lb · {source}",
      weightSourceKg: "{prev}kg · {source}, heute {time}",
      weightSourceLb: "{prev}lb · {source}, heute {time}",
      weightSourceOnKg: "{prev}kg · {source}, {date}",
      weightSourceOnLb: "{prev}lb · {source}, {date}",
      planRevised: "{from} → {to}kcal am Tag",
      savedNoteKg: "{w}kg von {source}, gespeichert",
      savedNoteLb: "{w}lb von {source}, gespeichert",
      savedNoteTypedKg: "{w}kg, gespeichert",
      savedNoteTypedLb: "{w}lb, gespeichert",
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
      language: "Sprache",
      appearance: "Erscheinungsbild",
      themeLight: "Hell",
      themeDark: "Dunkel",
      themeSystem: "System",
      signOutTitle: "Abmelden?",
      signOutBody: "Deine Mahlzeiten bleiben auf deinem Konto. Melde dich auf einem beliebigen Gerät wieder an, um sie zurückzubekommen.",
      signOutEverywhereTitle: "Überall abmelden?",
      signOutEverywhereBody: "Alle Geräte und Browser, die mit diesem Konto angemeldet sind, werden abgemeldet — auch dieses Telefon. Deine Mahlzeiten bleiben auf deinem Konto — melde dich wieder an, um sie zurückzubekommen.",
      cancel: "Abbrechen",
      signOutConfirm: "Abmelden",
      discardTitle: "Änderungen verwerfen?",
      discardCancel: "Weiter bearbeiten",
      discardConfirm: "Verwerfen",
      dismiss: "Schließen",
      labeledValue: "{label}: {value}",
    },
  },
  it: {
    headerFacts: "{age} · {height} · {flags}",
    headerFactsNoFlags: "{age} · {height}",
    headerFactsAgeFlags: "{age} · {flags}",
    headerFactsHeightFlags: "{height} · {flags}",
    flagDeclared: "condizioni indicate: {condition}",
    weightLabel: healthLabel("weight_kg", "it"),
    logWeight: "Registra il peso",
    targetKg: "{w}kg · obiettivo",
    targetLb: "{w}lb · obiettivo",
    planLabel: "Il tuo piano",
    planEdit: "modifica",
    kcalADay: "{kcal}kcal al giorno",
    perDay: "al giorno",
    grams: "{g}g",
    proteinGrams: "{g}g di proteine",
    satFatGrams: "{g}g di {noun}",
    floorMarker: "mai sotto {floor}",
    appleHealth: "Apple Health",
    connected: "connesso",
    subscription: "Abbonamento",
    freeWeekDay: "settimana gratis · giorno {n}",
    subscriptionUntil: "fino al {date}",
    subscriptionLifetime: "a vita",
    subscriptionEnded: "terminato il {date}",
    subscriptionEndedNoDate: "terminato",
    subscriptionFree: "gratuito",
    account: "Account",
    web: {
      units: "Unità",
      unitsMetric: "kg · cm",
      unitsImperial: "lb · ft",
      support: "Sostieni eait",
    },
    phone: {
      title: "Tu",
      profileTitle: shellCopyFor("it").navProfile,
      save: "Salva",
      saveKept: "Non è stato possibile salvare. Quello che hai inserito è ancora qui. Salva di nuovo.",
      weightTitle: "Il tuo peso",
      weightCheckKg: "{source} dice {w}kg. È giusto?",
      weightCheckLb: "{source} dice {w}lb. È giusto?",
      sourceYou: "inserito da te",
      weightCheckTypedKg: "Hai inserito {w}kg. È giusto?",
      weightCheckTypedLb: "Hai inserito {w}lb. È giusto?",
      weightKg: "{w}kg",
      weightLb: "{w}lb",
      weightFromKg: "{w}kg · {source}",
      weightFromLb: "{w}lb · {source}",
      weightSourceKg: "{prev}kg · {source}, oggi {time}",
      weightSourceLb: "{prev}lb · {source}, oggi {time}",
      weightSourceOnKg: "{prev}kg · {source}, {date}",
      weightSourceOnLb: "{prev}lb · {source}, {date}",
      planRevised: "{from} → {to}kcal al giorno",
      savedNoteKg: "{w}kg da {source}, salvato",
      savedNoteLb: "{w}lb da {source}, salvato",
      savedNoteTypedKg: "{w}kg, salvato",
      savedNoteTypedLb: "{w}lb, salvato",
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
      language: "Lingua",
      appearance: "Aspetto",
      themeLight: "Chiaro",
      themeDark: "Scuro",
      themeSystem: "Sistema",
      signOutTitle: "Uscire?",
      signOutBody: "I tuoi pasti restano sul tuo account. Accedi di nuovo su qualsiasi dispositivo per ritrovarli.",
      signOutEverywhereTitle: "Uscire da tutti i dispositivi?",
      signOutEverywhereBody: "Tutti i dispositivi e i browser connessi a questo account vengono disconnessi, incluso questo telefono. I tuoi pasti restano sul tuo account — accedi di nuovo per ritrovarli.",
      cancel: "Annulla",
      signOutConfirm: "Esci",
      discardTitle: "Scartare le modifiche?",
      discardCancel: "Continua a modificare",
      discardConfirm: "Scarta",
      dismiss: "Chiudi",
      labeledValue: "{label}: {value}",
    },
  },
  es: {
    headerFacts: "{age} · {height} · {flags}",
    headerFactsNoFlags: "{age} · {height}",
    headerFactsAgeFlags: "{age} · {flags}",
    headerFactsHeightFlags: "{height} · {flags}",
    flagDeclared: "has indicado: {condition}",
    weightLabel: healthLabel("weight_kg", "es"),
    logWeight: "Registrar el peso",
    targetKg: "{w}kg · objetivo",
    targetLb: "{w}lb · objetivo",
    planLabel: "Tu plan",
    planEdit: "editar",
    kcalADay: "{kcal}kcal al día",
    perDay: "al día",
    grams: "{g}g",
    proteinGrams: "{g}g de proteína",
    satFatGrams: "{g}g de {noun}",
    floorMarker: "nunca por debajo de {floor}",
    appleHealth: "Apple Health",
    connected: "conectado",
    subscription: "Suscripción",
    freeWeekDay: "semana gratis · día {n}",
    subscriptionUntil: "hasta el {date}",
    subscriptionLifetime: "de por vida",
    subscriptionEnded: "terminada el {date}",
    subscriptionEndedNoDate: "terminada",
    subscriptionFree: "gratis",
    account: "Cuenta",
    web: {
      units: "Unidades",
      unitsMetric: "kg · cm",
      unitsImperial: "lb · ft",
      support: "Apoyar eait",
    },
    phone: {
      title: "Tú",
      profileTitle: shellCopyFor("es").navProfile,
      save: "Guardar",
      saveKept: "No se pudo guardar. Lo que escribiste sigue aquí. Guarda otra vez.",
      weightTitle: "Tu peso",
      weightCheckKg: "{source} dice {w}kg. ¿Es correcto?",
      weightCheckLb: "{source} dice {w}lb. ¿Es correcto?",
      sourceYou: "tu registro",
      weightCheckTypedKg: "Escribiste {w}kg. ¿Es correcto?",
      weightCheckTypedLb: "Escribiste {w}lb. ¿Es correcto?",
      weightKg: "{w}kg",
      weightLb: "{w}lb",
      weightFromKg: "{w}kg · {source}",
      weightFromLb: "{w}lb · {source}",
      weightSourceKg: "{prev}kg · {source}, hoy {time}",
      weightSourceLb: "{prev}lb · {source}, hoy {time}",
      weightSourceOnKg: "{prev}kg · {source}, {date}",
      weightSourceOnLb: "{prev}lb · {source}, {date}",
      planRevised: "{from} → {to}kcal al día",
      savedNoteKg: "{w}kg de {source}, guardado",
      savedNoteLb: "{w}lb de {source}, guardado",
      savedNoteTypedKg: "{w}kg, guardado",
      savedNoteTypedLb: "{w}lb, guardado",
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
      language: "Idioma",
      appearance: "Apariencia",
      themeLight: "Claro",
      themeDark: "Oscuro",
      themeSystem: "Sistema",
      signOutTitle: "¿Cerrar sesión?",
      signOutBody: "Tus comidas se quedan en tu cuenta. Vuelve a iniciar sesión en cualquier dispositivo para recuperarlas.",
      signOutEverywhereTitle: "¿Cerrar sesión en todas partes?",
      signOutEverywhereBody: "Todos los dispositivos y navegadores conectados a esta cuenta se desconectan, incluido este teléfono. Tus comidas se quedan en tu cuenta — vuelve a iniciar sesión para recuperarlas.",
      cancel: "Cancelar",
      signOutConfirm: "Cerrar sesión",
      discardTitle: "¿Descartar los cambios?",
      discardCancel: "Seguir editando",
      discardConfirm: "Descartar",
      dismiss: "Cerrar",
      labeledValue: "{label}: {value}",
    },
  },
  vi: {
    headerFacts: "{age} · {height} · {flags}",
    headerFactsNoFlags: "{age} · {height}",
    headerFactsAgeFlags: "{age} · {flags}",
    headerFactsHeightFlags: "{height} · {flags}",
    flagDeclared: "đã khai báo: {condition}",
    weightLabel: healthLabel("weight_kg", "vi"),
    logWeight: "Ghi cân nặng",
    targetKg: "{w}kg · mục tiêu",
    targetLb: "{w}lb · mục tiêu",
    planLabel: "Kế hoạch của bạn",
    planEdit: "sửa",
    kcalADay: "{kcal}kcal một ngày",
    perDay: "một ngày",
    grams: "{g}g",
    proteinGrams: "{g}g đạm",
    satFatGrams: "{g}g {noun}",
    floorMarker: "không dưới {floor}",
    appleHealth: "Apple Health",
    connected: "đã kết nối",
    subscription: "Gói đăng ký",
    freeWeekDay: "tuần miễn phí · ngày {n}",
    subscriptionUntil: "đến {date}",
    subscriptionLifetime: "trọn đời",
    subscriptionEnded: "đã kết thúc {date}",
    subscriptionEndedNoDate: "đã kết thúc",
    subscriptionFree: "miễn phí",
    account: "Tài khoản",
    web: {
      units: "Đơn vị",
      unitsMetric: "kg · cm",
      unitsImperial: "lb · ft",
      support: "Ủng hộ eait",
    },
    phone: {
      title: "Bạn",
      profileTitle: shellCopyFor("vi").navProfile,
      save: "Lưu",
      saveKept: "Không lưu được. Những gì bạn nhập vẫn còn đây. Lưu lại nhé.",
      weightTitle: "Cân nặng của bạn",
      weightCheckKg: "{source} báo {w}kg. Đúng không?",
      weightCheckLb: "{source} báo {w}lb. Đúng không?",
      sourceYou: "bạn",
      weightCheckTypedKg: "Bạn đã nhập {w}kg. Đúng không?",
      weightCheckTypedLb: "Bạn đã nhập {w}lb. Đúng không?",
      weightKg: "{w}kg",
      weightLb: "{w}lb",
      weightFromKg: "{w}kg · {source}",
      weightFromLb: "{w}lb · {source}",
      weightSourceKg: "{prev}kg · {source}, hôm nay {time}",
      weightSourceLb: "{prev}lb · {source}, hôm nay {time}",
      weightSourceOnKg: "{prev}kg · {source}, {date}",
      weightSourceOnLb: "{prev}lb · {source}, {date}",
      planRevised: "{from} → {to}kcal một ngày",
      savedNoteKg: "{w}kg từ {source}, đã lưu",
      savedNoteLb: "{w}lb từ {source}, đã lưu",
      savedNoteTypedKg: "{w}kg, đã lưu",
      savedNoteTypedLb: "{w}lb, đã lưu",
      goalLabel: "Mục tiêu",
      targetLabel: "Cân nặng mục tiêu",
      activitySection: "Tần suất tập luyện",
      activityLabel: "Tập luyện",
      activityOption: "{n} buổi tập một tuần",
      countryRow: "Quốc gia",
      judgedAgainst: "Đánh giá theo",
      basisTitle: "Cách chúng mình tính",
      atRest: "Nghỉ",
      yourDays: "Vận động",
      yourPace: "Nhịp",
      changeAnswer: "Đổi một câu trả lời",
      freeWeekTitle: "Tuần miễn phí của bạn",
      dayOfTotal: "Ngày {n}/{total}",
      untilDate: "đến {date}",
      beforeEnds: "Trước khi kết thúc",
      weRemind: "Chúng mình nhắc bạn",
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
      language: "Ngôn ngữ",
      appearance: "Giao diện",
      themeLight: "Sáng",
      themeDark: "Tối",
      themeSystem: "Hệ thống",
      signOutTitle: "Đăng xuất?",
      signOutBody: "Các bữa ăn của bạn vẫn nằm trong tài khoản. Đăng nhập lại trên bất kỳ thiết bị nào để lấy lại chúng.",
      signOutEverywhereTitle: "Đăng xuất ở mọi nơi?",
      signOutEverywhereBody: "Mọi thiết bị và trình duyệt đang đăng nhập vào tài khoản này đều bị đăng xuất, kể cả chiếc điện thoại này. Các bữa ăn của bạn vẫn nằm trong tài khoản — đăng nhập lại để lấy lại chúng.",
      cancel: "Huỷ",
      signOutConfirm: "Đăng xuất",
      discardTitle: "Bỏ các thay đổi?",
      discardCancel: "Tiếp tục chỉnh sửa",
      discardConfirm: "Bỏ",
      dismiss: "Đóng",
      labeledValue: "{label}: {value}",
    },
  },
  id: {
    headerFacts: "{age} · {height} · {flags}",
    headerFactsNoFlags: "{age} · {height}",
    headerFactsAgeFlags: "{age} · {flags}",
    headerFactsHeightFlags: "{height} · {flags}",
    flagDeclared: "{condition} (dinyatakan)",
    weightLabel: healthLabel("weight_kg", "id"),
    logWeight: "Catat berat",
    targetKg: "{w}kg · target",
    targetLb: "{w}lb · target",
    planLabel: "Rencanamu",
    planEdit: "edit",
    kcalADay: "{kcal}kcal sehari",
    perDay: "sehari",
    grams: "{g}g",
    proteinGrams: "{g}g protein",
    satFatGrams: "{g}g {noun}",
    floorMarker: "tidak di bawah {floor}",
    appleHealth: "Apple Health",
    connected: "terhubung",
    subscription: "Langganan",
    freeWeekDay: "minggu gratis · hari {n}",
    subscriptionUntil: "sampai {date}",
    subscriptionLifetime: "seumur hidup",
    subscriptionEnded: "berakhir {date}",
    subscriptionEndedNoDate: "berakhir",
    subscriptionFree: "gratis",
    account: "Akun",
    web: {
      units: "Unit",
      unitsMetric: "kg · cm",
      unitsImperial: "lb · ft",
      support: "Dukung eait",
    },
    phone: {
      title: "Kamu",
      profileTitle: shellCopyFor("id").navProfile,
      save: "Simpan",
      saveKept: "Tidak bisa disimpan. Yang kamu isi masih di sini. Simpan lagi.",
      weightTitle: "Beratmu",
      weightCheckKg: "{source} bilang {w}kg. Benar?",
      weightCheckLb: "{source} bilang {w}lb. Benar?",
      sourceYou: "catatanmu",
      weightCheckTypedKg: "Kamu memasukkan {w}kg. Benar?",
      weightCheckTypedLb: "Kamu memasukkan {w}lb. Benar?",
      weightKg: "{w}kg",
      weightLb: "{w}lb",
      weightFromKg: "{w}kg · {source}",
      weightFromLb: "{w}lb · {source}",
      weightSourceKg: "{prev}kg · {source}, hari ini {time}",
      weightSourceLb: "{prev}lb · {source}, hari ini {time}",
      weightSourceOnKg: "{prev}kg · {source}, {date}",
      weightSourceOnLb: "{prev}lb · {source}, {date}",
      planRevised: "{from} → {to}kcal sehari",
      savedNoteKg: "{w}kg dari {source}, tersimpan",
      savedNoteLb: "{w}lb dari {source}, tersimpan",
      savedNoteTypedKg: "{w}kg, tersimpan",
      savedNoteTypedLb: "{w}lb, tersimpan",
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
      language: "Bahasa",
      appearance: "Tampilan",
      themeLight: "Terang",
      themeDark: "Gelap",
      themeSystem: "Sistem",
      signOutTitle: "Keluar?",
      signOutBody: "Makananmu tetap ada di akunmu. Masuk lagi di perangkat apa pun untuk mendapatkannya kembali.",
      signOutEverywhereTitle: "Keluar di semua perangkat?",
      signOutEverywhereBody: "Semua perangkat dan browser yang masuk ke akun ini dikeluarkan, termasuk ponsel ini. Makananmu tetap ada di akunmu — masuk lagi untuk mendapatkannya kembali.",
      cancel: "Batal",
      signOutConfirm: "Keluar",
      discardTitle: "Buang perubahan?",
      discardCancel: "Lanjutkan mengedit",
      discardConfirm: "Buang",
      dismiss: "Tutup",
      labeledValue: "{label}: {value}",
    },
  },
  ru: {
    headerFacts: "{age} · {height} · {flags}",
    headerFactsNoFlags: "{age} · {height}",
    headerFactsAgeFlags: "{age} · {flags}",
    headerFactsHeightFlags: "{height} · {flags}",
    flagDeclared: "указано: {condition}",
    weightLabel: healthLabel("weight_kg", "ru"),
    logWeight: "Записать вес",
    targetKg: "{w}кг · цель",
    targetLb: "{w}lb · цель",
    planLabel: "Твой план",
    planEdit: "изменить",
    kcalADay: "{kcal}ккал в день",
    perDay: "в день",
    grams: "{g}г",
    proteinGrams: "{g}г белка",
    satFatGrams: "{g}г {noun}",
    floorMarker: "не ниже {floor}",
    appleHealth: "Apple Health",
    connected: "подключено",
    subscription: "Подписка",
    freeWeekDay: "бесплатная неделя · день {n}",
    subscriptionUntil: "до {date}",
    subscriptionLifetime: "пожизненная",
    subscriptionEnded: "закончилась {date}",
    subscriptionEndedNoDate: "закончилась",
    subscriptionFree: "бесплатно",
    account: "Аккаунт",
    web: {
      units: "Единицы",
      unitsMetric: "кг · см",
      unitsImperial: "lb · ft",
      support: "Поддержать eait",
    },
    phone: {
      title: "Профиль",
      profileTitle: shellCopyFor("ru").navProfile,
      save: "Сохранить",
      saveKept: "Не удалось сохранить. Введённое всё ещё здесь. Сохрани ещё раз.",
      weightTitle: "Твой вес",
      weightCheckKg: "{source} сообщает: {w}кг. Всё верно?",
      weightCheckLb: "{source} сообщает: {w}lb. Всё верно?",
      sourceYou: "твоя запись",
      weightCheckTypedKg: "Твоя последняя запись — {w}кг. Всё верно?",
      weightCheckTypedLb: "Твоя последняя запись — {w}lb. Всё верно?",
      weightKg: "{w}кг",
      weightLb: "{w}lb",
      weightFromKg: "{w}кг · {source}",
      weightFromLb: "{w}lb · {source}",
      weightSourceKg: "{prev}кг · {source}, сегодня {time}",
      weightSourceLb: "{prev}lb · {source}, сегодня {time}",
      weightSourceOnKg: "{prev}кг · {source}, {date}",
      weightSourceOnLb: "{prev}lb · {source}, {date}",
      planRevised: "{from} → {to}ккал в день",
      savedNoteKg: "{w}кг из {source} — сохранено",
      savedNoteLb: "{w}lb из {source} — сохранено",
      savedNoteTypedKg: "{w}кг, сохранено",
      savedNoteTypedLb: "{w}lb, сохранено",
      goalLabel: "Цель",
      targetLabel: "Целевой вес",
      activitySection: "Частота тренировок",
      activityLabel: "Тренировки",
      activityOption: "Тренировок в неделю: {n}",
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
      language: "Язык",
      appearance: "Внешний вид",
      themeLight: "Светлая",
      themeDark: "Тёмная",
      themeSystem: "Как в системе",
      signOutTitle: "Выйти?",
      signOutBody: "Твои приёмы пищи остаются в аккаунте. Войди снова на любом устройстве, чтобы вернуть их.",
      signOutEverywhereTitle: "Выйти везде?",
      signOutEverywhereBody: "Все устройства и браузеры, вошедшие в этот аккаунт, выходят из него — включая этот телефон. Твои приёмы пищи остаются в аккаунте — войди снова, чтобы вернуть их.",
      cancel: "Отмена",
      signOutConfirm: "Выйти",
      discardTitle: "Сбросить изменения?",
      discardCancel: "Продолжить",
      discardConfirm: "Сбросить",
      dismiss: "Закрыть",
      labeledValue: "{label}: {value}",
    },
  },
};

export const youCopyFor = (lang: Lang): YouCopy => t(lang)(YOU_COPY);

/** The tables' own `{placeholder}` fill — a key with nothing to fill it left alone. */
const fill = (template: string, params: Record<string, string>): string =>
  template.replace(/\{(\w+)\}/g, (whole, key: string) => params[key] ?? whole);

/**
 * The identity card's fact line — "32 · 172cm · high cholesterol declared" — assembled HERE so
 * the web and the phone build the same line off the same pieces (#97 review).
 *
 * `age` is the SERVER's `ProfileResponse.age` — a surface never subtracts years itself; `null`
 * prints nothing, not a guess. `heightCm` goes through `heightText`, so the unit follows
 * `units`. The flags are the medical options' labels joined the way this language lists two
 * things — `Intl.ListFormat` — inside ONE `flagDeclared` fill: "high cholesterol and kidney
 * disease declared". A template that LEADS with `{condition}` reads the noun mid-sentence, and
 * lowering it is the locale's own operation over the whole phrase — `toLocaleLowerCase`, never
 * a character slice.
 */
export function youFacts(
  lang: Lang,
  facts: {
    age: number | null;
    heightCm: number | null;
    restrictions: readonly string[];
    medicalOptions: Record<string, { label: string }>;
    units: UnitSystem;
  },
): string {
  const you = youCopyFor(lang);
  const labels = facts.restrictions
    .filter((r) => r !== "none" && r in facts.medicalOptions)
    .map((r) => facts.medicalOptions[r]!.label);
  const joined = listConjunction(lang, labels);
  const flags = labels.length
    ? fill(you.flagDeclared, {
        condition: you.flagDeclared.startsWith("{condition}")
          ? joined.toLocaleLowerCase(LANG_TAG[lang])
          : joined,
      })
    : "";
  const age = facts.age !== null ? numbers(lang)(facts.age) : null;
  const height = facts.heightCm !== null ? heightText(facts.heightCm, facts.units, lang) : null;
  if (age !== null && height !== null)
    return flags ? fill(you.headerFacts, { age, height, flags }) : fill(you.headerFactsNoFlags, { age, height });
  if (age !== null) return flags ? fill(you.headerFactsAgeFlags, { age, flags }) : age;
  if (height !== null) return flags ? fill(you.headerFactsHeightFlags, { height, flags }) : height;
  return flags;
}
