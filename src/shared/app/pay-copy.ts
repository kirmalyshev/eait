// The paywall's words (W9 · kirmalyshev/eait#96; M9 · kirmalyshev-org/ieat-app#928): the plans
// card, the one-time gift, the €-offer, then catching-up and welcome — plus the phone's own
// boards (the dock after the sample is spent, the trial reminder, the lapsed card), which the
// web has no boards for. The boards are `product/design/pro/{web,phone}/pay-*.html`; where both
// clients draw a string the key is plain, and a `Phone`/`Web` suffix marks the ones only one
// client shows.
//
// NOTHING HERE IS A NUMBER THE PRODUCT COMPUTES. `{price}` and `{percent}` are display strings
// the server already formatted — `ProfileResponse.paywall` carries `PaywallPlan.price`,
// `YearlyPlan.pricePerMonth` and `ExitOffer.regularPrice`/`percentOff`/`perMonth` (#77), and the
// phone prices the same cards from StoreKit through `offerMath`. The offer's €23.99 is the
// operator's `WEB_PRICE_OFFER`, not a string this file may carry; the boards' `[price]` is what
// the templates hold. `{days}` is `WebPaywall.trialDays` (the store's intro period on the phone),
// and `{renewal}` is the SAME `pricePerYear`/`pricePerMonth` template the plan cards carry,
// already priced — so "Then €39.99 a year" never becomes a second way to write that figure.
//
// What is deliberately NOT here: the tab bar and the "+" are `SHELL_COPY`'s; the diary behind
// `pay-dock` and `pay-reminder` is the Home surface's own table; `pay-signin` is W3's board; and
// the struck-through regular price needs no key at all — it is `ExitOffer.regularPrice`, rendered
// inside `<s>`. The welcome card's plan chip ("Monthly") is `planMonthly`/`planYearly` read back.

import { t, type Localized } from "../lang.ts";
import type { Lang } from "../types.ts";

export interface PayCopy {
  /** pay-plans (web + phone): the headline over the two plans. */
  plansTitle: string;
  /** pay-plans: the hero photo's alt — the persona's salmon plate. */
  plansHeroAlt: string;
  /** pay-plans: the preselected plan's name — also the welcome chip's word for it. */
  planYearly: string;
  /** pay-plans and the pay-welcome chip: the other plan's name. */
  planMonthly: string;
  /** pay-plans: the badge on the yearly card. `{days}` is the configured trial length. */
  trialBadge: string;
  /** pay-plans: the yearly card's headline price. `{price}` is `PaywallPlan.price`. */
  pricePerYear: string;
  /** pay-plans (both cards' secondary figure) and pay-reminder's "Then" row. */
  pricePerMonth: string;
  /**
   * pay-paywall (phone): the yearly card's whole sub-line. `{trial}` is the accent span —
   * `trialBadge` filled with the days — and `{price}` the yearly price; the rest renders muted.
   * One sentence, so a language that fronts the price still reads as one line.
   */
  yearlySub: string;
  /**
   * pay-paywall (phone): the monthly card's sub-line, the same shape as `yearlySub` — the trial
   * is on BOTH plans (ieat-app#1591), so the monthly card names its badge and its price too.
   */
  monthlySub: string;
  /** pay-paywall (phone): the small caption under BOTH right-column price figures — "a month". */
  perMonthCaption: string;
  /** pay-paywall (phone): the first benefit line, beside the camera icon. */
  benefitPhoto: string;
  /** pay-paywall (phone): the second benefit line, beside the check icon. */
  benefitPlan: string;
  /** pay-paywall (phone): the third benefit line, beside the chat icon. */
  benefitChat: string;
  /** pay-blocked (phone): the label over the meal the sample already bought. */
  freeMealLabel: string;
  /** pay-plans: the one CTA. `{days}` is the trial's length, from the store or the host's
      `trialDays` — the words never carry a number the store did not say (ieat-app#1591). */
  startTrial: string;
  /**
   * pay-plans (web + the server-rendered offer): the line under the CTA while a trial is
   * picked. `{days}` is the host's `trialDays`, `{renewal}` is `pricePerYear`/`pricePerMonth`
   * already priced — one placeholder keeps "then {price} a year" a whole template.
   */
  trialNote: string;
  /**
   * pay-plans (phone): the same line with the App Store's cancel path in it — the store is who
   * renews the trial, so "Cancel" names Settings › Apple ID › Subscriptions and its 24-hour
   * boundary rather than the app's own Profile screen, which cannot cancel.
   */
  trialNotePhone: string;
  /** pay-plans: the CTA when the selected plan carries no trial — monthly, or yearly for a
      subscriber the store says gets no intro offer. */
  continueCta: string;
  /** pay-plans: the auto-renew line under `continueCta`, yearly — `{price}` is the yearly price. */
  renewNoteYearly: string;
  /** pay-plans: the auto-renew line under `continueCta`, monthly — `{price}` is the monthly price. */
  renewNoteMonthly: string;
  /** pay-plans: the alert's title when the store rejects the purchase — never "nothing was
      charged", because a post-charge failure can reach it. */
  purchaseFailedTitle: string;
  /** pay-plans: the alert's body, which sends a possibly-charged buyer to Restore. */
  purchaseFailedNote: string;
  /** pay-gift (web + phone): the decline interstitial's headline. */
  giftTitle: string;
  /** pay-gift: the gift artwork's accessible name. */
  giftAlt: string;
  /** pay-gift: the line under the headline — the offer is shown once. */
  giftNote: string;
  /** pay-gift: the button that opens the offer. */
  giftOpen: string;
  /** pay-ultra (web + phone): the offer's headline. */
  offerTitle: string;
  /** pay-ultra: the porridge photo's alt. */
  offerAlt: string;
  /** pay-ultra: the discount badge. `{percent}` is `ExitOffer.percentOff`, floored server-side. */
  offerOff: string;
  /** pay-ultra: the offer price under the struck-through regular one — `{price}` is `ExitOffer.price`. */
  offerPrice: string;
  /** pay-ultra: the offer spread over a month — `{price}` is `ExitOffer.perMonth`. */
  offerPerMonth: string;
  /** pay-ultra: the primary CTA. */
  offerClaim: string;
  /** pay-ultra: the decline — goes to the app, and the offer is never shown again. */
  offerDecline: string;
  /** pay-ultra: the billing note the legal footer leads with. */
  offerNote: string;
  /** pay-catching-up (web + phone): after the store or checkout confirms. */
  storeThanks: string;
  /** pay-catching-up (web + phone): the line under it while the entitlement lands. */
  catchingUp: string;
  /** pay-welcome (web + phone): the entitled screen's headline. */
  welcomeTitle: string;
  /** pay-welcome: Spud's line under it. */
  welcomeSub: string;
  /** pay-welcome: the CTA back into the app. */
  welcomeBack: string;
  /** pay-catching-up (phone only): the top-bar label while the purchase is in flight. */
  subscribingPhone: string;
  /** pay-dock (phone only): the card over Home once the free sample is spent. */
  dockTitlePhone: string;
  /** pay-dock (phone only): its button, into the plans. */
  subscribePhone: string;
  /**
   * pay-reminder (web + phone): the ends-tomorrow card's headline (ieat-app#1591 — one reminder
   * the day before the end, so the words name no count).
   */
  trialEnds: string;
  /** pay-reminder (web + phone): the card's line when the renewal price is known — `{renewal}` is
      `pricePerYear`/`pricePerMonth` filled with the plan the trial is actually on. */
  trialEndsNote: string;
  /** pay-reminder (web + phone): the same line when no store or paywall can name the price. */
  trialEndsCancel: string;
  /** pay-reminder (phone only): the renewal row's label; its value is a formatted date, not copy. */
  renewsLabelPhone: string;
  /** pay-lapsed (phone only): the ended subscription's card. */
  lapsedTitlePhone: string;
  /** pay-lapsed (phone only): its button — `entitlement`'s `"resubscribe"` ask, not `"subscribe"`. */
  resubscribePhone: string;
  /** pay-plans, pay-gift, pay-ultra (web + phone): the ×'s accessible name. */
  closeLabel: string;
  /** every pay board's footer (web + phone): restore a purchase. */
  restoreLink: string;
  /** every pay board's footer: the terms document. */
  termsLink: string;
  /** every pay board's footer: the privacy document — "Privacy" here, not the sign-up's longer name. */
  privacyLink: string;
}

export const PAY_COPY: Localized<PayCopy> = {
  en: {
    plansTitle: "Know if every meal fits",
    plansHeroAlt: "Salmon, rice and greens on a plate",
    planYearly: "Yearly",
    planMonthly: "Monthly",
    trialBadge: "{days} days free",
    pricePerYear: "{price} a year",
    pricePerMonth: "{price} a month",
    yearlySub: "{trial}, then {price} a year",
    monthlySub: "{trial}, then {price} a month",
    perMonthCaption: "a month",
    benefitPhoto: "One photo logs a meal",
    benefitPlan: "Every meal checked against your plan",
    benefitChat: "Ask Spud about your day",
    freeMealLabel: "Your free meal",
    startTrial: "Try {days} days free",
    trialNote: "{days} days free, then {renewal}. Renews automatically until cancelled. Cancel any time in Profile › Subscription.",
    trialNotePhone: "{days} days free, then {renewal}. Renews automatically until cancelled. Cancel in Settings › Apple ID › Subscriptions at least 24 hours before the trial ends.",
    continueCta: "Continue",
    renewNoteYearly: "{price} a year. Renews automatically. Cancel any time.",
    renewNoteMonthly: "{price} a month. Renews automatically. Cancel any time.",
    purchaseFailedTitle: "Purchase didn't go through",
    purchaseFailedNote: "The purchase didn't finish. If you were charged, tap Restore — nothing is charged twice.",
    giftTitle: "We have a gift for you",
    giftAlt: "A wrapped gift box",
    giftNote: "One offer, shown only this once.",
    giftOpen: "Open",
    offerTitle: "Your gift: yearly, for less",
    offerAlt: "Porridge with berries",
    offerOff: "{percent} % off",
    offerPrice: "{price} / year",
    offerPerMonth: "≈ {price} a month",
    offerClaim: "Claim",
    offerDecline: "No thanks",
    offerNote: "Billed yearly. Cancel any time",
    storeThanks: "Thanks, the store has it",
    catchingUp: "Your account is catching up. A few seconds.",
    welcomeTitle: "You’re all set",
    welcomeSub: "Every meal gets an honest answer now, and your plan moves when your weight does.",
    welcomeBack: "Back to today",
    subscribingPhone: "Subscribing",
    dockTitlePhone: "That was your meal on us",
    subscribePhone: "Subscribe",
    trialEnds: "Your free trial ends tomorrow",
    trialEndsNote: "Then {renewal}. Cancel today and nothing is charged.",
    trialEndsCancel: "Cancel today and nothing is charged.",
    renewsLabelPhone: "Renews",
    lapsedTitlePhone: "Your subscription has ended",
    resubscribePhone: "Resubscribe",
    closeLabel: "Close",
    restoreLink: "Restore",
    termsLink: "Terms",
    privacyLink: "Privacy",
  },
  fr: {
    plansTitle: "Vois si chaque repas rentre dans ta journée",
    plansHeroAlt: "Saumon, riz et légumes verts dans une assiette",
    planYearly: "Annuel",
    planMonthly: "Mensuel",
    trialBadge: "{days} jours offerts",
    pricePerYear: "{price} par an",
    pricePerMonth: "{price} par mois",
    yearlySub: "{trial}, puis {price} par an",
    monthlySub: "{trial}, puis {price} par mois",
    perMonthCaption: "par mois",
    benefitPhoto: "Une photo enregistre un repas",
    benefitPlan: "Chaque repas vérifié par rapport à ton plan",
    benefitChat: "Parle de ta journée à Spud",
    freeMealLabel: "Ton repas offert",
    startTrial: "Commencer l'essai de {days} jours",
    trialNote: "{days} jours offerts, puis {renewal}. Se renouvelle automatiquement jusqu'à résiliation. Résiliable à tout moment dans Profil › Abonnement.",
    trialNotePhone: "{days} jours offerts, puis {renewal}. Se renouvelle automatiquement jusqu'à résiliation. Résilie dans Réglages › Identifiant Apple › Abonnements au moins 24 h avant la fin de l'essai.",
    continueCta: "Continuer",
    renewNoteYearly: "{price} par an. Se renouvelle automatiquement. Résiliable à tout moment.",
    renewNoteMonthly: "{price} par mois. Se renouvelle automatiquement. Résiliable à tout moment.",
    purchaseFailedTitle: "L'achat n'a pas abouti",
    purchaseFailedNote: "L'achat n'a pas abouti. Si le paiement a été débité, touche Restaurer — rien n'est débité deux fois.",
    giftTitle: "On a un cadeau pour toi",
    giftAlt: "Une boîte cadeau emballée",
    giftNote: "Une seule offre, affichée uniquement cette fois-ci.",
    giftOpen: "Ouvrir",
    offerTitle: "Ton cadeau : l'annuel, moins cher",
    offerAlt: "Porridge aux fruits rouges",
    offerOff: "{percent} % de remise",
    offerPrice: "{price} / an",
    offerPerMonth: "≈ {price} par mois",
    offerClaim: "En profiter",
    offerDecline: "Non merci",
    offerNote: "Facturé à l'année. Résiliable à tout moment",
    storeThanks: "Merci, ton achat est confirmé",
    catchingUp: "Ton compte se met à jour. Quelques secondes.",
    welcomeTitle: "Tout est prêt",
    welcomeSub: "Chaque repas reçoit maintenant une réponse honnête, et ton plan évolue quand ton poids change.",
    welcomeBack: "Retour à aujourd'hui",
    subscribingPhone: "Abonnement en cours",
    dockTitlePhone: "Ce repas était offert",
    subscribePhone: "S'abonner",
    trialEnds: "Ton essai gratuit se termine demain",
    trialEndsNote: "Puis {renewal}. Résilie aujourd'hui et rien n'est facturé.",
    trialEndsCancel: "Résilie aujourd'hui et rien n'est facturé.",
    renewsLabelPhone: "Renouvellement",
    lapsedTitlePhone: "Ton abonnement est terminé",
    resubscribePhone: "Renouveler l'abonnement",
    closeLabel: "Fermer",
    restoreLink: "Restaurer",
    termsLink: "Conditions",
    privacyLink: "Confidentialité",
  },
  de: {
    plansTitle: "Sieh bei jeder Mahlzeit, ob sie passt",
    plansHeroAlt: "Lachs mit Reis und grünem Gemüse auf einem Teller",
    planYearly: "Jährlich",
    planMonthly: "Monatlich",
    trialBadge: "{days} Tage kostenlos",
    pricePerYear: "{price} im Jahr",
    pricePerMonth: "{price} im Monat",
    yearlySub: "{trial}, danach {price} im Jahr",
    monthlySub: "{trial}, danach {price} im Monat",
    perMonthCaption: "im Monat",
    benefitPhoto: "Ein Foto erfasst eine Mahlzeit",
    benefitPlan: "Jede Mahlzeit mit deinem Plan abgeglichen",
    benefitChat: "Frag Spud nach deinem Tag",
    freeMealLabel: "Deine Gratis-Mahlzeit",
    startTrial: "{days} Tage kostenlos testen",
    trialNote: "{days} Tage kostenlos, danach {renewal}. Verlängert sich automatisch bis zur Kündigung. Jederzeit kündbar unter Profil › Abo.",
    trialNotePhone: "{days} Tage kostenlos, danach {renewal}. Verlängert sich automatisch bis zur Kündigung. Kündige in den Einstellungen › Apple-ID › Abos mindestens 24 Stunden vor Ende der Testphase.",
    continueCta: "Weiter",
    renewNoteYearly: "{price} im Jahr. Verlängert sich automatisch. Jederzeit kündbar.",
    renewNoteMonthly: "{price} im Monat. Verlängert sich automatisch. Jederzeit kündbar.",
    purchaseFailedTitle: "Kauf nicht abgeschlossen",
    purchaseFailedNote: "Der Kauf wurde nicht abgeschlossen. Wenn der Betrag abgebucht wurde, tippe auf Wiederherstellen — es wird nichts doppelt abgebucht.",
    giftTitle: "Wir haben ein Geschenk für dich",
    giftAlt: "Ein verpacktes Geschenk",
    giftNote: "Ein Angebot, das du nur dieses eine Mal siehst.",
    giftOpen: "Öffnen",
    offerTitle: "Dein Geschenk: das Jahresabo günstiger",
    offerAlt: "Porridge mit Beeren",
    offerOff: "{percent} % Rabatt",
    offerPrice: "{price} / Jahr",
    offerPerMonth: "≈ {price} im Monat",
    offerClaim: "Einlösen",
    offerDecline: "Nein danke",
    offerNote: "Jährlich abgerechnet. Jederzeit kündbar",
    storeThanks: "Danke, der Store hat's",
    catchingUp: "Dein Konto wird gerade aktualisiert. Nur ein paar Sekunden.",
    welcomeTitle: "Alles bereit",
    welcomeSub: "Jede Mahlzeit bekommt jetzt eine ehrliche Antwort, und dein Plan bewegt sich mit deinem Gewicht.",
    welcomeBack: "Zurück zu heute",
    subscribingPhone: "Abo wird abgeschlossen",
    dockTitlePhone: "Die Mahlzeit ging auf uns",
    subscribePhone: "Abonnieren",
    trialEnds: "Deine Testphase endet morgen",
    trialEndsNote: "Danach {renewal}. Kündige heute, dann wird nichts abgebucht.",
    trialEndsCancel: "Kündige heute, dann wird nichts abgebucht.",
    renewsLabelPhone: "Verlängert sich",
    lapsedTitlePhone: "Dein Abo ist abgelaufen",
    resubscribePhone: "Abo erneuern",
    closeLabel: "Schließen",
    restoreLink: "Wiederherstellen",
    termsLink: "Nutzungsbedingungen",
    privacyLink: "Datenschutz",
  },
  it: {
    plansTitle: "Scopri se ogni pasto ci sta",
    plansHeroAlt: "Salmone, riso e verdure in un piatto",
    planYearly: "Annuale",
    planMonthly: "Mensile",
    trialBadge: "{days} giorni gratis",
    pricePerYear: "{price} all'anno",
    pricePerMonth: "{price} al mese",
    yearlySub: "{trial}, poi {price} all'anno",
    monthlySub: "{trial}, poi {price} al mese",
    perMonthCaption: "al mese",
    benefitPhoto: "Una foto registra un pasto",
    benefitPlan: "Ogni pasto verificato sul tuo piano",
    benefitChat: "Chiedi a Spud della tua giornata",
    freeMealLabel: "Il tuo pasto gratuito",
    startTrial: "Prova gratis per {days} giorni",
    trialNote: "{days} giorni gratis, poi {renewal}. Si rinnova automaticamente fino a disdetta. Disdici quando vuoi in Profilo › Abbonamento.",
    trialNotePhone: "{days} giorni gratis, poi {renewal}. Si rinnova automaticamente fino a disdetta. Disdici in Impostazioni › ID Apple › Abbonamenti almeno 24 ore prima della fine della prova.",
    continueCta: "Continua",
    renewNoteYearly: "{price} all'anno. Si rinnova automaticamente. Disdici quando vuoi.",
    renewNoteMonthly: "{price} al mese. Si rinnova automaticamente. Disdici quando vuoi.",
    purchaseFailedTitle: "Acquisto non riuscito",
    purchaseFailedNote: "L'acquisto non è stato completato. Se ti è stato addebitato, tocca Ripristina — non viene addebitato nulla due volte.",
    giftTitle: "Abbiamo un regalo per te",
    giftAlt: "Un pacco regalo",
    giftNote: "Un'offerta, mostrata solo questa volta.",
    giftOpen: "Apri",
    offerTitle: "Il tuo regalo: l'annuale a prezzo ridotto",
    offerAlt: "Porridge con frutti di bosco",
    offerOff: "-{percent}%",
    offerPrice: "{price} / anno",
    offerPerMonth: "≈ {price} al mese",
    offerClaim: "Riscatta",
    offerDecline: "No grazie",
    offerNote: "Addebito annuale. Disdici quando vuoi",
    storeThanks: "Grazie, acquisto ricevuto dall'App Store",
    catchingUp: "Il tuo account si sta aggiornando. Pochi secondi.",
    welcomeTitle: "È tutto pronto",
    welcomeSub: "Ora ogni pasto riceve una risposta onesta, e il tuo piano si adatta al tuo peso.",
    welcomeBack: "Torna a oggi",
    subscribingPhone: "Abbonamento in corso",
    dockTitlePhone: "Quel pasto l'abbiamo offerto noi",
    subscribePhone: "Abbonati",
    trialEnds: "La tua prova gratuita finisce domani",
    trialEndsNote: "Poi {renewal}. Disdici oggi e non ti sarà addebitato nulla.",
    trialEndsCancel: "Disdici oggi e non ti sarà addebitato nulla.",
    renewsLabelPhone: "Si rinnova",
    lapsedTitlePhone: "Il tuo abbonamento è terminato",
    resubscribePhone: "Rinnova l'abbonamento",
    closeLabel: "Chiudi",
    restoreLink: "Ripristina",
    termsLink: "Termini",
    privacyLink: "Privacy",
  },
  es: {
    plansTitle: "Descubre si cada comida encaja",
    plansHeroAlt: "Salmón con arroz y verduras en un plato",
    planYearly: "Anual",
    planMonthly: "Mensual",
    trialBadge: "{days} días gratis",
    pricePerYear: "{price} al año",
    pricePerMonth: "{price} al mes",
    yearlySub: "{trial}, luego {price} al año",
    monthlySub: "{trial}, luego {price} al mes",
    perMonthCaption: "al mes",
    benefitPhoto: "Una foto registra una comida",
    benefitPlan: "Cada comida comparada con tu plan",
    benefitChat: "Pregúntale a Spud por tu día",
    freeMealLabel: "Tu comida gratis",
    startTrial: "Probar {days} días gratis",
    trialNote: "{days} días gratis, luego {renewal}. Se renueva automáticamente hasta cancelar. Cancela cuando quieras en Perfil › Suscripción.",
    trialNotePhone: "{days} días gratis, luego {renewal}. Se renueva automáticamente hasta cancelar. Cancela en Ajustes › Apple ID › Suscripciones al menos 24 horas antes de que termine la prueba.",
    continueCta: "Continuar",
    renewNoteYearly: "{price} al año. Se renueva automáticamente. Cancela cuando quieras.",
    renewNoteMonthly: "{price} al mes. Se renueva automáticamente. Cancela cuando quieras.",
    purchaseFailedTitle: "La compra no se completó",
    purchaseFailedNote: "La compra no se completó. Si se te ha cobrado, toca Restaurar — nada se cobra dos veces.",
    giftTitle: "Tenemos un regalo para ti",
    giftAlt: "Una caja de regalo envuelta",
    giftNote: "Una oferta, mostrada solo esta vez.",
    giftOpen: "Abrir",
    offerTitle: "Tu regalo: el anual, por menos",
    offerAlt: "Porridge con frutos rojos",
    offerOff: "{percent} % de descuento",
    offerPrice: "{price} / año",
    offerPerMonth: "≈ {price} al mes",
    offerClaim: "Canjear",
    offerDecline: "No, gracias",
    offerNote: "Facturado al año. Cancela cuando quieras",
    storeThanks: "Gracias, la tienda ya lo tiene",
    catchingUp: "Tu cuenta se está poniendo al día. Unos segundos.",
    welcomeTitle: "Todo listo",
    welcomeSub: "Ahora cada comida recibe una respuesta honesta, y tu plan se mueve cuando tu peso lo hace.",
    welcomeBack: "Volver a hoy",
    subscribingPhone: "Suscripción en curso",
    dockTitlePhone: "Esa comida la invitamos nosotros",
    subscribePhone: "Suscribirse",
    trialEnds: "Tu prueba gratis termina mañana",
    trialEndsNote: "Luego {renewal}. Cancela hoy y no se cobra nada.",
    trialEndsCancel: "Cancela hoy y no se cobra nada.",
    renewsLabelPhone: "Se renueva",
    lapsedTitlePhone: "Tu suscripción ha terminado",
    resubscribePhone: "Volver a suscribirse",
    closeLabel: "Cerrar",
    restoreLink: "Restaurar",
    termsLink: "Términos",
    privacyLink: "Privacidad",
  },
  vi: {
    plansTitle: "Biết mỗi bữa ăn có phù hợp không",
    plansHeroAlt: "Cá hồi, cơm và rau xanh trên đĩa",
    planYearly: "Hàng năm",
    planMonthly: "Hàng tháng",
    trialBadge: "Miễn phí {days} ngày",
    pricePerYear: "{price} một năm",
    pricePerMonth: "{price} một tháng",
    yearlySub: "{trial}, sau đó {price} một năm",
    monthlySub: "{trial}, sau đó {price} một tháng",
    perMonthCaption: "một tháng",
    benefitPhoto: "Một bức ảnh ghi lại bữa ăn",
    benefitPlan: "Mỗi bữa ăn đối chiếu với kế hoạch của bạn",
    benefitChat: "Hỏi Spud về ngày của bạn",
    freeMealLabel: "Bữa miễn phí của bạn",
    startTrial: "Dùng thử miễn phí {days} ngày",
    trialNote: "Miễn phí {days} ngày, sau đó {renewal}. Tự gia hạn đến khi bạn hủy. Hủy bất cứ lúc nào trong Hồ sơ › Gói đăng ký.",
    trialNotePhone: "Miễn phí {days} ngày, sau đó {renewal}. Tự gia hạn đến khi bạn hủy. Hủy trong Cài đặt › Apple ID › Gói đăng ký ít nhất 24 giờ trước khi hết dùng thử.",
    continueCta: "Tiếp tục",
    renewNoteYearly: "{price} một năm. Tự gia hạn. Hủy bất cứ lúc nào.",
    renewNoteMonthly: "{price} một tháng. Tự gia hạn. Hủy bất cứ lúc nào.",
    purchaseFailedTitle: "Giao dịch mua chưa hòan tất",
    purchaseFailedNote: "Giao dịch mua chưa hòan tất. Nếu bạn đã bị trừ tiền, hãy chạm Khôi phục — không có gì bị trừ hai lần.",
    giftTitle: "Chúng mình có quà cho bạn",
    giftAlt: "Hộp quà được gói",
    giftNote: "Một ưu đãi, chỉ hiện lần này thôi.",
    giftOpen: "Mở",
    offerTitle: "Quà của bạn: gói năm, giá thấp hơn",
    offerAlt: "Cháo yến mạch với quả mọng",
    offerOff: "Giảm {percent}%",
    offerPrice: "{price} / năm",
    offerPerMonth: "≈ {price} một tháng",
    offerClaim: "Nhận",
    offerDecline: "Không, cảm ơn",
    offerNote: "Thanh toán theo năm. Hủy bất cứ lúc nào",
    storeThanks: "Cảm ơn, cửa hàng đã ghi nhận",
    catchingUp: "Tài khoản của bạn đang đồng bộ. Vài giây thôi.",
    welcomeTitle: "Mọi thứ đã sẵn sàng",
    welcomeSub: "Bây giờ mỗi bữa ăn đều có câu trả lời thẳng thắn, và kế hoạch của bạn đổi theo cân nặng.",
    welcomeBack: "Về hôm nay",
    subscribingPhone: "Đang đăng ký",
    dockTitlePhone: "Bữa đó chúng mình mời",
    subscribePhone: "Đăng ký",
    trialEnds: "Ngày mai hết thời gian dùng thử",
    trialEndsNote: "Sau đó {renewal}. Hủy hôm nay thì không bị tính phí.",
    trialEndsCancel: "Hủy hôm nay thì không bị tính phí.",
    renewsLabelPhone: "Gia hạn",
    lapsedTitlePhone: "Đăng ký của bạn đã hết",
    resubscribePhone: "Đăng ký lại",
    closeLabel: "Đóng",
    restoreLink: "Khôi phục",
    termsLink: "Điều khoản",
    privacyLink: "Quyền riêng tư",
  },
  id: {
    plansTitle: "Tahu setiap makanan cocok atau tidak",
    plansHeroAlt: "Salmon, nasi, dan sayuran hijau di piring",
    planYearly: "Tahunan",
    planMonthly: "Bulanan",
    trialBadge: "Gratis {days} hari",
    pricePerYear: "{price} setahun",
    pricePerMonth: "{price} sebulan",
    yearlySub: "{trial}, lalu {price} setahun",
    monthlySub: "{trial}, lalu {price} sebulan",
    perMonthCaption: "sebulan",
    benefitPhoto: "Satu foto mencatat satu makanan",
    benefitPlan: "Setiap makanan dicek dengan rencanamu",
    benefitChat: "Tanya Spud tentang harimu",
    freeMealLabel: "Makanan gratismu",
    startTrial: "Coba gratis {days} hari",
    trialNote: "Gratis {days} hari, lalu {renewal}. Diperpanjang otomatis sampai dibatalkan. Batal kapan saja di Profil › Langganan.",
    trialNotePhone: "Gratis {days} hari, lalu {renewal}. Diperpanjang otomatis sampai dibatalkan. Batalkan di Pengaturan › Apple ID › Langganan setidaknya 24 jam sebelum uji coba berakhir.",
    continueCta: "Lanjut",
    renewNoteYearly: "{price} setahun. Diperpanjang otomatis. Batal kapan saja.",
    renewNoteMonthly: "{price} sebulan. Diperpanjang otomatis. Batal kapan saja.",
    purchaseFailedTitle: "Pembelian tidak selesai",
    purchaseFailedNote: "Pembelian tidak selesai. Jika kamu sudah ditagih, ketuk Pulihkan — tidak ada yang ditagih dua kali.",
    giftTitle: "Kami punya hadiah untukmu",
    giftAlt: "Kotak hadiah terbungkus",
    giftNote: "Satu penawaran, hanya ditampilkan kali ini.",
    giftOpen: "Buka",
    offerTitle: "Hadiahmu: tahunan, lebih murah",
    offerAlt: "Bubur oat dengan buah beri",
    offerOff: "Diskon {percent}%",
    offerPrice: "{price} / tahun",
    offerPerMonth: "≈ {price} sebulan",
    offerClaim: "Klaim",
    offerDecline: "Tidak, terima kasih",
    offerNote: "Ditagih per tahun. Batal kapan saja",
    storeThanks: "Terima kasih, App Store sudah menerimanya",
    catchingUp: "Akunmu sedang diperbarui. Tunggu beberapa detik.",
    welcomeTitle: "Semua sudah siap",
    welcomeSub: "Sekarang setiap makanan dapat jawaban jujur, dan rencanamu ikut menyesuaikan saat berat badanmu berubah.",
    welcomeBack: "Kembali ke hari ini",
    subscribingPhone: "Memproses langganan…",
    dockTitlePhone: "Makanan tadi dari kami",
    subscribePhone: "Berlangganan",
    trialEnds: "Masa uji cobamu berakhir besok",
    trialEndsNote: "Lalu {renewal}. Batalkan hari ini dan tidak ada yang ditagih.",
    trialEndsCancel: "Batalkan hari ini dan tidak ada yang ditagih.",
    renewsLabelPhone: "Diperpanjang",
    lapsedTitlePhone: "Langgananmu sudah berakhir",
    resubscribePhone: "Perpanjang langganan",
    closeLabel: "Tutup",
    restoreLink: "Pulihkan",
    termsLink: "Ketentuan",
    privacyLink: "Privasi",
  },
  ru: {
    plansTitle: "Знай, подходит ли каждый приём пищи",
    plansHeroAlt: "Лосось с рисом и зеленью на тарелке",
    planYearly: "Годовой",
    planMonthly: "Месячный",
    trialBadge: "Бесплатно: {days} дн.",
    pricePerYear: "{price} в год",
    pricePerMonth: "{price} в месяц",
    yearlySub: "{trial}, затем {price} в год",
    monthlySub: "{trial}, затем {price} в месяц",
    perMonthCaption: "в месяц",
    benefitPhoto: "Одно фото записывает приём пищи",
    benefitPlan: "Каждый приём пищи сравнивается с твоим планом",
    benefitChat: "Спроси Spud о своём дне",
    freeMealLabel: "Твой бесплатный приём пищи",
    startTrial: "Попробовать {days} дн. бесплатно",
    trialNote: "Бесплатно: {days} дн., затем {renewal}. Продлевается автоматически, пока не отменишь. Отмени в любой момент: «Профиль» › «Подписка».",
    trialNotePhone: "Бесплатно: {days} дн., затем {renewal}. Продлевается автоматически, пока не отменишь. Отмени в Настройках › Apple ID › Подписки минимум за 24 часа до конца пробного периода.",
    continueCta: "Продолжить",
    renewNoteYearly: "{price} в год. Продлевается автоматически. Отмена в любой момент.",
    renewNoteMonthly: "{price} в месяц. Продлевается автоматически. Отмена в любой момент.",
    purchaseFailedTitle: "Покупка не прошла",
    purchaseFailedNote: "Покупка не завершена. Если деньги списались, нажми «Восстановить» — дважды ничего не списывается.",
    giftTitle: "У нас есть подарок для тебя",
    giftAlt: "Упакованный подарок",
    giftNote: "Одно предложение — показываем только один раз.",
    giftOpen: "Открыть",
    offerTitle: "Твой подарок: годовой — дешевле",
    offerAlt: "Овсянка с ягодами",
    offerOff: "Скидка {percent} %",
    offerPrice: "{price} / год",
    offerPerMonth: "≈ {price} в месяц",
    offerClaim: "Забрать",
    offerDecline: "Нет, спасибо",
    offerNote: "Оплата за год. Отмена в любой момент",
    storeThanks: "Спасибо, магазин принял покупку",
    catchingUp: "Аккаунт обновляется — пара секунд.",
    welcomeTitle: "Всё готово",
    welcomeSub: "Теперь у каждого приёма пищи есть честный ответ, а план двигается вместе с весом.",
    welcomeBack: "К сегодняшнему дню",
    subscribingPhone: "Оформление подписки",
    dockTitlePhone: "Этот приём пищи — за наш счёт",
    subscribePhone: "Подписаться",
    trialEnds: "Твой пробный период кончается завтра",
    trialEndsNote: "Затем {renewal}. Отмени сегодня — и ничего не спишется.",
    trialEndsCancel: "Отмени сегодня — и ничего не спишется.",
    renewsLabelPhone: "Продление",
    lapsedTitlePhone: "Подписка закончилась",
    resubscribePhone: "Возобновить подписку",
    closeLabel: "Закрыть",
    restoreLink: "Восстановить",
    termsLink: "Условия",
    privacyLink: "Конфиденциальность",
  },
};

export const payCopyFor = (lang: Lang): PayCopy => t(lang)(PAY_COPY);
