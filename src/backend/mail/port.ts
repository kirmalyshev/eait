// The one thing this product sends by email, as a port.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// WHY A PORT FOR A SINGLE MESSAGE
//
// Same reason `llm/port.ts` exists: the tests must be able to prove the subscribe flow without a
// vendor, an account or a billed call, and the flow is where this product's own bugs would live.
// A test that needs an API key is a test that runs on one machine.
//
// It is deliberately ONE method. This is not a mail layer and must not become one. An ACCOUNT does
// carry an address since issue #95, but nothing sends to it from here or on a schedule — it is
// held to run the account and written to by a person — so the only recipient this port has is
// somebody who typed their address into a form on the marketing page and has not yet said they
// meant it. Sending to account addresses from a program is a second basis, a second way out and a
// second thing to keep lawful; it does not arrive by adding a method here.
// ─────────────────────────────────────────────────────────────────────────────────────────────

import { t, type Lang, type Localized } from "@eait/shared";

export interface Mailer {
  /**
   * Ask someone to confirm that the address they typed is theirs.
   *
   * `confirmUrl` carries a capability token and nothing else. It is not a login, it grants nothing
   * but "put this one address on the list", and it is the same shape as the unsubscribe link for
   * the same reason: a confirmation that needs an account is a confirmation nobody completes.
   *
   * Throwing is meaningful. The caller has already written a PENDING row, so a failure here leaves
   * an address that can never be confirmed and will be swept — which is the correct outcome and
   * must be logged rather than reported to the submitter, who cannot act on it.
   *
   * `lang` is REQUIRED and has no default. The one caller has the browser's `Accept-Language` in
   * hand (`api/routes.ts` — a subscriber has no account to ask), so an optional parameter here
   * bought nothing but the chance of sending a German reader an English confirmation.
   */
  sendConfirmation(to: string, confirmUrl: string, lang: Lang): Promise<void>;
}

/**
 * The message itself, in one place so both implementations send the same words and a test can
 * assert them.
 *
 * PLAIN TEXT, no HTML. There is no tracking pixel to leave out because there is no HTML to put one
 * in, which is the shortest way to keep that true — and the landing page's whole argument is that
 * it carries no third-party anything.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHICH LANGUAGE, WHEN THE RECIPIENT HAS NO ACCOUNT
 *
 * A subscriber is not a user (`store.ts` says so, and no row may join them), so there is no
 * `users.lang` to read — this is the one outbound message in the product whose recipient the server
 * knows nothing else about. What it does have is the `Accept-Language` of the browser that posted
 * the form seconds earlier, which is the strongest available evidence and is what `routes.ts`
 * passes. An unrecognised header is English.
 *
 * The SUBJECT is translated too. A confirmation whose subject line is in a language the reader does
 * not have is indistinguishable from spam in an inbox, which is the one place this message has to
 * survive.
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 */
// EXPORTED so `copy.i18n.test.ts` can walk it. A `Localized` table that nothing exports is a
// table the check cannot see, which is the one way this product's copy can quietly lose a language.
export const CONFIRMATION: Localized<{ subject: string; lines: string[] }> = {
  en: {
    subject: "Confirm your email for eait",
    lines: [
      "Somebody — probably you — asked to hear from eait when the iPhone app is out.",
      "",
      "Confirm that this address is yours:",
      "{url}",
      "",
      "If it was not you, ignore this. Nothing happens, and the address is deleted within a week.",
      "",
      "One message when the app is out, with a one-click unsubscribe in it. Nothing else, ever.",
    ],
  },
  fr: {
    subject: "Confirme ton adresse e-mail pour eait",
    lines: [
      "Quelqu'un — probablement toi — a demandé à être prévenu quand l'appli iPhone eait sortira.",
      "",
      "Confirme que cette adresse est bien la tienne :",
      "{url}",
      "",
      "Si ce n'était pas toi, ignore ce message. Il ne se passe rien, et l'adresse est supprimée sous une semaine.",
      "",
      "Un message à la sortie de l'appli, avec un lien de désinscription en un clic. Rien d'autre, jamais.",
    ],
  },
  de: {
    subject: "Bestätige deine E-Mail-Adresse für eait",
    lines: [
      "Jemand — vermutlich du — möchte Bescheid bekommen, wenn die eait-App fürs iPhone erscheint.",
      "",
      "Bestätige, dass diese Adresse dir gehört:",
      "{url}",
      "",
      "Warst du das nicht, ignorier diese Mail. Dann passiert nichts, und die Adresse wird binnen einer Woche gelöscht.",
      "",
      "Eine Nachricht, wenn die App da ist, mit einer Abmeldung in einem Klick. Sonst nie etwas.",
    ],
  },
  it: {
    subject: "Conferma la tua email per eait",
    lines: [
      "Qualcuno — probabilmente tu — ha chiesto di essere avvisato quando esce l'app eait per iPhone.",
      "",
      "Conferma che questo indirizzo è tuo:",
      "{url}",
      "",
      "Se non sei stato tu, ignora questo messaggio. Non succede nulla, e l'indirizzo viene cancellato entro una settimana.",
      "",
      "Un messaggio quando l'app esce, con la disiscrizione in un clic. Nient'altro, mai.",
    ],
  },
  es: {
    subject: "Confirma tu correo para eait",
    lines: [
      "Alguien — probablemente tú — pidió que le avisemos cuando salga la app de eait para iPhone.",
      "",
      "Confirma que esta dirección es tuya:",
      "{url}",
      "",
      "Si no fuiste tú, ignora este mensaje. No pasa nada, y la dirección se borra en menos de una semana.",
      "",
      "Un mensaje cuando salga la app, con baja en un clic dentro. Nada más, nunca.",
    ],
  },
  vi: {
    subject: "Xác nhận email của bạn cho eait",
    lines: [
      "Ai đó — nhiều khả năng là bạn — đã đăng ký nhận tin khi ứng dụng eait cho iPhone ra mắt.",
      "",
      "Hãy xác nhận địa chỉ này là của bạn:",
      "{url}",
      "",
      "Nếu không phải bạn, cứ bỏ qua thư này. Sẽ không có gì xảy ra, và địa chỉ sẽ bị xoá trong vòng một tuần.",
      "",
      "Một tin nhắn khi ứng dụng ra mắt, kèm nút huỷ đăng ký chỉ một lần bấm. Ngoài ra không có gì, không bao giờ.",
    ],
  },
  id: {
    subject: "Konfirmasi emailmu untuk eait",
    lines: [
      "Seseorang — kemungkinan besar kamu — minta dikabari saat aplikasi eait untuk iPhone rilis.",
      "",
      "Konfirmasi bahwa alamat ini milikmu:",
      "{url}",
      "",
      "Kalau bukan kamu, abaikan saja. Tidak ada yang terjadi, dan alamatnya dihapus dalam waktu seminggu.",
      "",
      "Satu pesan saat aplikasinya rilis, dengan tautan berhenti berlangganan sekali klik. Selain itu tidak pernah ada.",
    ],
  },
  ru: {
    subject: "Подтверди свою почту для eait",
    lines: [
      "Кто-то — скорее всего, ты — попросил сообщить, когда выйдет приложение eait для iPhone.",
      "",
      "Подтверди, что этот адрес твой:",
      "{url}",
      "",
      "Если это не ты, просто не отвечай. Ничего не произойдёт, а адрес удалится в течение недели.",
      "",
      "Одно письмо, когда приложение выйдет, и отписка в один клик внутри. Больше ничего и никогда.",
    ],
  },
};

export function confirmationMessage(
  confirmUrl: string,
  lang: Lang,
): { subject: string; text: string } {
  const copy = t(lang)(CONFIRMATION);
  // The LINE that matters is the fourth from the end: until this link is clicked the address is not
  // on any list, and saying so is what makes ignoring this email a complete answer. Every
  // translation keeps it, and `port.i18n.test.ts` counts the lines rather than trusting that.
  return { subject: copy.subject, text: copy.lines.join("\n").replace("{url}", confirmUrl) };
}
