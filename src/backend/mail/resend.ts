// Resend — the mail provider that actually delivers (#569).
//
// One HTTPS call per mail, the API key in the Authorization header and never in a URL or a log
// line. A non-2xx is a thrown Error with the STATUS, not the body: Resend's error payloads quote
// the request, and the request carries the recipient — an address in a log is a leak on a route
// that exists specifically so the mail goes where the address says.
//
// No SDK: the whole surface this needs is one POST, and a dependency is a second place to keep.

import type { Lang } from "@eait/shared";
import { mailCopyFor } from "./copy.ts";
import type { MailPort } from "./port.ts";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/** How long one send may hang. Same argument as `pushTimeoutMs`: a wedged socket is a wedged handler. */
const TIMEOUT_MS = 15_000;

export function resendMail(opts: { apiKey: string; from: string }): MailPort {
  return {
    async sendSignInCode(to, code, lang: Lang) {
      const copy = mailCopyFor(lang);
      const fill = (s: string) => s.replaceAll("{code}", code);
      const res = await fetch(RESEND_ENDPOINT, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${opts.apiKey}`,
        },
        body: JSON.stringify({
          from: opts.from,
          to: [to],
          subject: fill(copy.subject),
          text: fill(copy.text),
          html: fill(copy.html),
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`resend answered ${res.status}`);
    },
  };
}
