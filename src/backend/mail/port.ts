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

import { i18nFor, type I18n, type Lang } from "@eait/shared";

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
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE FIRST TABLE TO LEAVE `Localized<T>` FOR A CATALOG, and what that changed.
 *
 * It was eight copies of a nine-element `lines` array, two elements of which were `""` and one of
 * which was the literal `"{url}"`. Eight languages × three lines of STRUCTURE is twenty-four
 * strings a translator could get wrong and no reader would ever see — and one of them, the blank
 * separator, is a string a PO editor will not even show. The catalog carries the five sentences
 * and the subject; the blank lines and the link are assembled here, where they are layout rather
 * than language.
 *
 * The link is a VALUE now, not a `.replace("{url}", …)` over the joined text. That replace ran
 * over every language's prose and would have substituted the first `{url}` it found anywhere,
 * including one a translator had accidentally left in the wrong sentence.
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 */
const CONFIRMATION = (i18n: I18n): { subject: string; lines: string[] } => ({
  subject: i18n._("mail.confirm.subject", undefined, { message: "Confirm your email for eait" }),
  lines: [
    i18n._("mail.confirm.who", undefined, {
      message: "Somebody — probably you — asked to hear from eait when the iPhone app is out.",
    }),
    i18n._("mail.confirm.ask", undefined, { message: "Confirm that this address is yours:" }),
    // THE LINE THAT MATTERS. Until this link is clicked the address is on no list, and saying so
    // is what makes ignoring this email a complete answer — and what makes it lawful to send
    // unasked. Every translation keeps it, and `port.i18n.test.ts` proves it by shape.
    i18n._("mail.confirm.ignore", undefined, {
      message: "If it was not you, ignore this. Nothing happens, and the address is deleted within a week.",
    }),
    i18n._("mail.confirm.promise", undefined, {
      message: "One message when the app is out, with a one-click unsubscribe in it. Nothing else, ever.",
    }),
  ],
});

export function confirmationMessage(
  confirmUrl: string,
  lang: Lang,
): { subject: string; text: string } {
  const { subject, lines } = CONFIRMATION(i18nFor(lang));
  const [who, ask, ignore, promise] = lines as [string, string, string, string];
  // The blank lines are LAYOUT and are built here rather than carried as catalog entries: a PO
  // editor does not show an empty message, and a separator is not something to translate.
  return { subject, text: [who, "", ask, confirmUrl, "", ignore, "", promise].join("\n") };
}
