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
// the templates hold. `{days}` is `WebPaywall.trialDays` (the store's trial length on the phone).
// `{day}` in `cancelNotePhone` is the renewal's WEEKDAY NAME, formatted by the client with
// `Intl.DateTimeFormat(LANG_TAG[lang], { weekday: "long" })` — every template beside it is written
// so a nominative weekday reads correctly, because `Intl` cannot decline Russian's `до
// воскресенья`.
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
  /** pay-plans: the one CTA. */
  startTrial: string;
  /** pay-plans: the line under the CTA — `{days}` and `{price}` are the trial and the yearly price. */
  trialNote: string;
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
  /** pay-reminder (phone only): the card's headline. `{days}` is the days left on the trial. */
  trialLeftPhone: string;
  /** pay-reminder (phone only): the renewal row's label; its value is a formatted date, not copy. */
  renewsLabelPhone: string;
  /** pay-reminder (phone only): the price row's label — its value reuses `pricePerMonth`. */
  thenLabelPhone: string;
  /** pay-reminder (phone only): the how-to-cancel row's label. */
  toCancelLabelPhone: string;
  /** pay-reminder (phone only): the path, exactly as the board words it. */
  cancelStepsPhone: string;
  /**
   * pay-reminder (phone only): the reassurance under the rows. `{day}` is the renewal's weekday
   * name — every language's template is written so a nominative weekday is grammatical.
   */
  cancelNotePhone: string;
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
    startTrial: "Start my free week",
    trialNote: "{days} days free, then {price} a year. Cancel any time.",
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
    trialLeftPhone: "{days} days left of your free week",
    renewsLabelPhone: "Renews",
    thenLabelPhone: "Then",
    toCancelLabelPhone: "To cancel",
    cancelStepsPhone: "You → Manage subscription",
    cancelNotePhone: "Cancel before {day} and nothing is charged.",
    lapsedTitlePhone: "Your subscription has ended",
    resubscribePhone: "Resubscribe",
    closeLabel: "Close",
    restoreLink: "Restore",
    termsLink: "Terms",
    privacyLink: "Privacy",
  },
  fr: {
    plansTitle: "Sache si chaque repas te convient",
    plansHeroAlt: "Saumon, riz et légumes verts dans une assiette",
    planYearly: "Annuel",
    planMonthly: "Mensuel",
    trialBadge: "{days} jours offerts",
    pricePerYear: "{price} par an",
    pricePerMonth: "{price} par mois",
    startTrial: "Commencer ma semaine offerte",
    trialNote: "{days} jours offerts, puis {price} par an. Résiliable à tout moment.",
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
    storeThanks: "Merci, la boutique l'a bien reçu",
    catchingUp: "Ton compte se met à jour. Quelques secondes.",
    welcomeTitle: "Tout est prêt",
    welcomeSub: "Chaque repas reçoit maintenant une réponse honnête, et ton plan évolue quand ton poids change.",
    welcomeBack: "Retour à aujourd'hui",
    subscribingPhone: "Abonnement en cours",
    dockTitlePhone: "Ce repas était offert",
    subscribePhone: "S'abonner",
    trialLeftPhone: "Plus que {days} jours de semaine offerte",
    renewsLabelPhone: "Renouvellement",
    thenLabelPhone: "Puis",
    toCancelLabelPhone: "Pour résilier",
    cancelStepsPhone: "Toi → Gérer l'abonnement",
    cancelNotePhone: "Résilie avant {day} et rien ne sera facturé.",
    lapsedTitlePhone: "Ton abonnement est terminé",
    resubscribePhone: "Renouveler l'abonnement",
    closeLabel: "Fermer",
    restoreLink: "Restaurer",
    termsLink: "Conditions",
    privacyLink: "Confidentialité",
  },
  de: {
    plansTitle: "Weiß, ob jede Mahlzeit passt",
    plansHeroAlt: "Lachs mit Reis und grünem Gemüse auf einem Teller",
    planYearly: "Jährlich",
    planMonthly: "Monatlich",
    trialBadge: "{days} Tage kostenlos",
    pricePerYear: "{price} im Jahr",
    pricePerMonth: "{price} im Monat",
    startTrial: "Meine Gratiswoche starten",
    trialNote: "{days} Tage kostenlos, danach {price} im Jahr. Jederzeit kündbar.",
    continueCta: "Weiter",
    renewNoteYearly: "{price} im Jahr. Verlängert sich automatisch. Jederzeit kündbar.",
    renewNoteMonthly: "{price} im Monat. Verlängert sich automatisch. Jederzeit kündbar.",
    purchaseFailedTitle: "Kauf nicht abgeschlossen",
    purchaseFailedNote: "Der Kauf wurde nicht abgeschlossen. Wenn der Betrag abgebucht wurde, tippe auf Wiederherstellen — es wird nichts doppelt abgebucht.",
    giftTitle: "Wir haben ein Geschenk für dich",
    giftAlt: "Ein verpacktes Geschenk",
    giftNote: "Ein Angebot, nur dieses eine Mal gezeigt.",
    giftOpen: "Öffnen",
    offerTitle: "Dein Geschenk: jährlich, für weniger",
    offerAlt: "Porridge mit Beeren",
    offerOff: "{percent} % Rabatt",
    offerPrice: "{price} / Jahr",
    offerPerMonth: "≈ {price} im Monat",
    offerClaim: "Einlösen",
    offerDecline: "Nein danke",
    offerNote: "Jährlich abgerechnet. Jederzeit kündbar",
    storeThanks: "Danke, der Store hat's",
    catchingUp: "Dein Konto holt gerade auf. Ein paar Sekunden.",
    welcomeTitle: "Alles fertig",
    welcomeSub: "Jede Mahlzeit bekommt jetzt eine ehrliche Antwort, und dein Plan bewegt sich mit deinem Gewicht.",
    welcomeBack: "Zurück zu heute",
    subscribingPhone: "Abo wird abgeschlossen",
    dockTitlePhone: "Die Mahlzeit ging auf uns",
    subscribePhone: "Abonnieren",
    trialLeftPhone: "Noch {days} Tage deiner Gratiswoche",
    renewsLabelPhone: "Verlängert sich",
    thenLabelPhone: "Danach",
    toCancelLabelPhone: "Zum Kündigen",
    cancelStepsPhone: "Du → Abo verwalten",
    cancelNotePhone: "Kündige bis {day} und es wird nichts abgebucht.",
    lapsedTitlePhone: "Dein Abo ist abgelaufen",
    resubscribePhone: "Abo erneuern",
    closeLabel: "Schließen",
    restoreLink: "Wiederherstellen",
    termsLink: "Nutzungsbedingungen",
    privacyLink: "Datenschutz",
  },
  it: {
    plansTitle: "Sai se ogni pasto ci sta",
    plansHeroAlt: "Salmone, riso e verdure in un piatto",
    planYearly: "Annuale",
    planMonthly: "Mensile",
    trialBadge: "{days} giorni gratis",
    pricePerYear: "{price} all'anno",
    pricePerMonth: "{price} al mese",
    startTrial: "Inizia la mia settimana gratis",
    trialNote: "{days} giorni gratis, poi {price} all'anno. Disdici quando vuoi.",
    continueCta: "Continua",
    renewNoteYearly: "{price} all'anno. Si rinnova automaticamente. Disdici quando vuoi.",
    renewNoteMonthly: "{price} al mese. Si rinnova automaticamente. Disdici quando vuoi.",
    purchaseFailedTitle: "Acquisto non riuscito",
    purchaseFailedNote: "L'acquisto non è stato completato. Se ti è stato addebitato, tocca Ripristina — non viene addebitato nulla due volte.",
    giftTitle: "Abbiamo un regalo per te",
    giftAlt: "Un pacco regalo",
    giftNote: "Un'offerta, mostrata solo questa volta.",
    giftOpen: "Apri",
    offerTitle: "Il tuo regalo: l'annuale, a meno",
    offerAlt: "Porridge con frutti di bosco",
    offerOff: "{percent} % di sconto",
    offerPrice: "{price} / anno",
    offerPerMonth: "≈ {price} al mese",
    offerClaim: "Riscatta",
    offerDecline: "No grazie",
    offerNote: "Fatturato all'anno. Disdici quando vuoi",
    storeThanks: "Grazie, lo store ce l'ha",
    catchingUp: "Il tuo account si sta aggiornando. Pochi secondi.",
    welcomeTitle: "È tutto pronto",
    welcomeSub: "Ora ogni pasto riceve una risposta onesta, e il tuo piano si muove con il tuo peso.",
    welcomeBack: "Torna a oggi",
    subscribingPhone: "Abbonamento in corso",
    dockTitlePhone: "Quel pasto l'abbiamo offerto noi",
    subscribePhone: "Abbonati",
    trialLeftPhone: "{days} giorni rimasti della tua settimana gratis",
    renewsLabelPhone: "Si rinnova",
    thenLabelPhone: "Poi",
    toCancelLabelPhone: "Per disdire",
    cancelStepsPhone: "Tu → Gestisci abbonamento",
    cancelNotePhone: "Disdici prima di {day} e non ti sarà addebitato nulla.",
    lapsedTitlePhone: "Il tuo abbonamento è terminato",
    resubscribePhone: "Rinnova l'abbonamento",
    closeLabel: "Chiudi",
    restoreLink: "Ripristina",
    termsLink: "Termini",
    privacyLink: "Privacy",
  },
  es: {
    plansTitle: "Sabe si cada comida encaja",
    plansHeroAlt: "Salmón con arroz y verduras en un plato",
    planYearly: "Anual",
    planMonthly: "Mensual",
    trialBadge: "{days} días gratis",
    pricePerYear: "{price} al año",
    pricePerMonth: "{price} al mes",
    startTrial: "Empezar mi semana gratis",
    trialNote: "{days} días gratis, luego {price} al año. Cancela cuando quieras.",
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
    trialLeftPhone: "Te quedan {days} días de tu semana gratis",
    renewsLabelPhone: "Se renueva",
    thenLabelPhone: "Luego",
    toCancelLabelPhone: "Para cancelar",
    cancelStepsPhone: "Tú → Gestionar suscripción",
    cancelNotePhone: "Cancela antes del {day} y no se cobra nada.",
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
    startTrial: "Bắt đầu tuần miễn phí của tôi",
    trialNote: "Miễn phí {days} ngày, sau đó {price} một năm. Huỷ bất cứ lúc nào.",
    continueCta: "Tiếp tục",
    renewNoteYearly: "{price} một năm. Tự gia hạn. Huỷ bất cứ lúc nào.",
    renewNoteMonthly: "{price} một tháng. Tự gia hạn. Huỷ bất cứ lúc nào.",
    purchaseFailedTitle: "Giao dịch mua chưa hoàn tất",
    purchaseFailedNote: "Giao dịch mua chưa hoàn tất. Nếu bạn đã bị trừ tiền, hãy chạm Khôi phục — không có gì bị trừ hai lần.",
    giftTitle: "Chúng tôi có quà cho bạn",
    giftAlt: "Hộp quà được gói",
    giftNote: "Một ưu đãi, chỉ hiện lần này thôi.",
    giftOpen: "Mở",
    offerTitle: "Quà của bạn: gói năm, giá thấp hơn",
    offerAlt: "Cháo yến mạch với quả mọng",
    offerOff: "Giảm {percent} %",
    offerPrice: "{price} / năm",
    offerPerMonth: "≈ {price} một tháng",
    offerClaim: "Nhận",
    offerDecline: "Không, cảm ơn",
    offerNote: "Thanh toán theo năm. Huỷ bất cứ lúc nào",
    storeThanks: "Cảm ơn, cửa hàng đã ghi nhận",
    catchingUp: "Tài khoản của bạn đang đồng bộ. Vài giây thôi.",
    welcomeTitle: "Mọi thứ đã sẵn sàng",
    welcomeSub: "Bây giờ mỗi bữa ăn đều có câu trả lời thẳng thắn, và kế hoạch của bạn đổi theo cân nặng.",
    welcomeBack: "Về hôm nay",
    subscribingPhone: "Đang đăng ký",
    dockTitlePhone: "Bữa đó chúng tôi mời",
    subscribePhone: "Đăng ký",
    trialLeftPhone: "Còn {days} ngày của tuần miễn phí",
    renewsLabelPhone: "Gia hạn",
    thenLabelPhone: "Sau đó",
    toCancelLabelPhone: "Để huỷ",
    cancelStepsPhone: "Bạn → Quản lý đăng ký",
    cancelNotePhone: "Huỷ trước {day} và sẽ không bị tính phí.",
    lapsedTitlePhone: "Đăng ký của bạn đã hết",
    resubscribePhone: "Đăng ký lại",
    closeLabel: "Đóng",
    restoreLink: "Khôi phục",
    termsLink: "Điều khoản",
    privacyLink: "Bảo mật",
  },
  id: {
    plansTitle: "Ketahui apakah setiap makanan cocok",
    plansHeroAlt: "Salmon, nasi, dan sayuran hijau di piring",
    planYearly: "Tahunan",
    planMonthly: "Bulanan",
    trialBadge: "Gratis {days} hari",
    pricePerYear: "{price} setahun",
    pricePerMonth: "{price} sebulan",
    startTrial: "Mulai minggu gratis saya",
    trialNote: "Gratis {days} hari, lalu {price} setahun. Batal kapan saja.",
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
    offerAlt: "Porridge dengan beri",
    offerOff: "Diskon {percent}%",
    offerPrice: "{price} / tahun",
    offerPerMonth: "≈ {price} sebulan",
    offerClaim: "Klaim",
    offerDecline: "Tidak, terima kasih",
    offerNote: "Ditagih per tahun. Batal kapan saja",
    storeThanks: "Terima kasih, store sudah menerimanya",
    catchingUp: "Akunmu sedang mengejar. Beberapa detik.",
    welcomeTitle: "Semua sudah siap",
    welcomeSub: "Sekarang setiap makanan dapat jawaban jujur, dan rencanamu bergerak saat berat badanmu berubah.",
    welcomeBack: "Kembali ke hari ini",
    subscribingPhone: "Sedang berlangganan",
    dockTitlePhone: "Makanan tadi dari kami",
    subscribePhone: "Berlangganan",
    trialLeftPhone: "Sisa {days} hari dari minggu gratismu",
    renewsLabelPhone: "Diperpanjang",
    thenLabelPhone: "Lalu",
    toCancelLabelPhone: "Untuk batal",
    cancelStepsPhone: "Kamu → Kelola langganan",
    cancelNotePhone: "Batal sebelum hari {day} dan tidak ada yang ditagih.",
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
    trialBadge: "{days} дней бесплатно",
    pricePerYear: "{price} в год",
    pricePerMonth: "{price} в месяц",
    startTrial: "Начать бесплатную неделю",
    trialNote: "{days} дней бесплатно, затем {price} в год. Отмена в любой момент.",
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
    catchingUp: "Аккаунт догоняет. Несколько секунд.",
    welcomeTitle: "Всё готово",
    welcomeSub: "Теперь у каждого приёма пищи есть честный ответ, а план двигается вместе с весом.",
    welcomeBack: "Назад к сегодняшнему дню",
    subscribingPhone: "Оформление подписки",
    dockTitlePhone: "Этот приём пищи — за наш счёт",
    subscribePhone: "Подписаться",
    trialLeftPhone: "Осталось {days} дня бесплатной недели",
    renewsLabelPhone: "Продление",
    thenLabelPhone: "Затем",
    toCancelLabelPhone: "Чтобы отменить",
    cancelStepsPhone: "«Ты» → Управление подпиской",
    cancelNotePhone: "{day} — последний день отмены без списаний.",
    lapsedTitlePhone: "Подписка закончилась",
    resubscribePhone: "Возобновить подписку",
    closeLabel: "Закрыть",
    restoreLink: "Восстановить",
    termsLink: "Условия",
    privacyLink: "Конфиденциальность",
  },
};

export const payCopyFor = (lang: Lang): PayCopy => t(lang)(PAY_COPY);
