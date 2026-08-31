// The one thing this product sends by email, as a port.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// WHY A PORT FOR A SINGLE MESSAGE
//
// Same reason `llm/port.ts` exists: the tests must be able to prove the subscribe flow without a
// vendor, an account or a billed call, and the flow is where this product's own bugs would live.
// A test that needs an API key is a test that runs on one machine.
//
// It is deliberately ONE method. This is not a mail layer and must not become one — the app has no
// email address for any user (`auth/verify.ts` discards what the providers volunteer), so there is
// nobody here to send anything to except a person who typed their address into a form on the
// marketing page and has not yet said they meant it.
// ─────────────────────────────────────────────────────────────────────────────────────────────

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
   */
  sendConfirmation(to: string, confirmUrl: string): Promise<void>;
}

/**
 * The message itself, in one place so both implementations send the same words and a test can
 * assert them.
 *
 * PLAIN TEXT, no HTML. There is no tracking pixel to leave out because there is no HTML to put one
 * in, which is the shortest way to keep that true — and the landing page's whole argument is that
 * it carries no third-party anything.
 */
export function confirmationMessage(confirmUrl: string): { subject: string; text: string } {
  return {
    subject: "Confirm your email for eait",
    text: [
      "Somebody — probably you — asked to hear from eait when the iPhone app is out.",
      "",
      "Confirm that this address is yours:",
      confirmUrl,
      "",
      // The line that matters. Until this link is clicked the address is not on any list, and
      // saying so is what makes ignoring this email a complete answer.
      "If it was not you, ignore this. Nothing happens, and the address is deleted within a week.",
      "",
      "One message when the app is out, with a one-click unsubscribe in it. Nothing else, ever.",
    ].join("\n"),
  };
}
