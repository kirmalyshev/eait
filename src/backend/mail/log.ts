// The mail provider for dev, tests and `--demo`: print, do not send.
//
// IT PRINTS THE CODE — that is the whole point of this implementation existing. A developer
// driving the sign-in flow reads the digits off the server log the way a phone reads them off the
// lock screen, which is what makes the flow drivable end to end with no Resend account and no
// DNS. The address goes to the log too: it names who asked, and a dev log already holds far more
// than that. Never the rendered bodies — they are the same `MAIL_COPY` strings a test can read.

import type { MailPort } from "./port.ts";

export function logMail(): MailPort {
  return {
    async sendSignInCode(to, code) {
      console.log(`[eait] mail (log only): sign-in code ${code} for ${to}`);
    },
  };
}
