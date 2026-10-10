import { fill } from "@eait/shared";
import type { Lang } from "@eait/shared";
import { pageCopyFor } from "../copy.ts";
import { ctaSubmit, wtop } from "./board.ts";
import { escape, shell } from "./shell.ts";

/**
 * Email sign-in's two pages (#569, boards `web/email-address.html`, `web/email-code*.html`,
 * `web/email-too-many.html`).
 *
 * WHAT THE BOARDS DRAW THAT THIS SURFACE CANNOT, and the honest rendering of each:
 *
 * - Six per-digit boxes. They auto-advance, which is JavaScript, and this surface ships none —
 *   so the code page draws ONE field, centred and spaced the way the boxes read, carrying the
 *   one-time-code autocomplete a phone keyboard fills from the same SMS/mail hint.
 * - "The sixth digit signs in." Same constraint, same answer: a visible Continue under the field.
 * - "Resend code in 0:42" ticking. A server-rendered page cannot tick; it renders the countdown
 *   as it stood at load, and when the window has passed the same slot holds the resend submit.
 *
 * The mail icon on the sign-up button is `ico("mail")`; there is no envelope board art to port.
 */

export interface EmailAddressView {
  /** The address the last send named — re-rendered in the field, escaped by `escape()`. */
  email: string;
  /** A `t13` bad note under the field: the malformed-address words, or the too-many one. */
  error: string | null;
  lang: Lang;
}

export function emailAddress(v: EmailAddressView): string {
  const c = pageCopyFor(v.lang);
  return shell(c.titleEmail, `${wtop()}
<div class="wmain one"><div class="wcol">
<div class="eml">
<h1>${escape(c.emailHeading)}</h1>
<p class="m">${escape(c.emailLead)}</p>
<form method="post" action="/start/email/address">
<input type="email" name="email" autocomplete="email" spellcheck="false" required
  placeholder="you@example.com" value="${escape(v.email)}"
  aria-label="${escape(c.emailFieldLabel)}">
${v.error ? `<p class="eml-note bad" role="alert">${escape(v.error)}</p>` : ""}
${ctaSubmit(c.emailSend)}
</form>
</div>
</div></div>
`, v.lang, "ob");
}

export interface EmailCodeView {
  /** The address the live code was sent to — the lead's `{email}`, drawn bold like the board. */
  email: string;
  /** The countdown to show at render: seconds left in the resend window, or 0 when it is over. */
  resendWaitSec: number;
  /**
   * The state the page draws. `null` is a fresh send; "wrong" the bad-bordered field with the
   * not-right note; "dead" expired/used/burnt/superseded — field kept like the board's, but the
   * CTA becomes "Send a new code" and the resend row is gone (it IS the resend); "too-many" the
   * shared wait note.
   */
  state: "wrong" | "dead" | "too-many" | null;
  /** `too-many`'s filled wait — the whole "in 12 minutes" form, already counted. */
  tooManyNote?: string | undefined;
  lang: Lang;
}

/** `0:42` — the boards' format, minutes and two-digit seconds. */
const mmss = (sec: number): string => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

export function emailCode(v: EmailCodeView): string {
  const c = pageCopyFor(v.lang);
  // `{email}` is the one placeholder the template carries, filled with the bolded address — the
  // board draws it in ink to say THIS is where the code went.
  const lead = fill(c.emailCodeLead, { email: `<b>${escape(v.email)}</b>` });
  const note = v.state === "wrong" ? c.emailCodeWrong
    : v.state === "dead" ? c.emailCodeDead
    : v.state === "too-many" ? v.tooManyNote ?? c.emailTooMany
    : null;
  const resend = v.resendWaitSec > 0
    ? `<span class="t13 faint">${escape(fill(c.emailResendWait, { time: mmss(v.resendWaitSec) }))}</span>`
    : `<button class="t13 link" type="submit">${escape(c.emailResend)}</button>`;
  return shell(c.titleEmail, `${wtop()}
<div class="wmain one"><div class="wcol">
<div class="eml">
<h1>${escape(c.emailCodeHeading)}</h1>
<p class="m">${lead}</p>
<form method="post" action="/start/email/code">
<input class="codein${v.state === "wrong" ? " bad" : ""}" type="text" inputmode="numeric"
  autocomplete="one-time-code" name="code" maxlength="6" required
  aria-label="${escape(c.emailCodeLabel)}">
${note ? `<p class="eml-note bad" role="alert">${escape(note)}</p>` : ""}
${v.state === "dead" ? "" : ctaSubmit(c.continueLabel)}
</form>
${v.state === "dead" ? `<form method="post" action="/start/email/resend">${ctaSubmit(c.emailCodeNew)}</form>`
: `<div class="eml-row">
  <form method="post" action="/start/email/resend">${resend}</form>
  <a class="t13" href="/start/email/address">${escape(c.emailDifferent)}</a>
</div>`}
</div>
</div></div>
`, v.lang, "ob");
}
