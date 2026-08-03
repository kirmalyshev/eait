// The development mailer: prints the link, never the address.
//
// It exists so the whole double-opt-in flow can be driven end to end — submit, receive, confirm —
// with no vendor account and no billed send. `bun run backend:demo` uses it, and so does any
// deployment that has not been given a real provider.
//
// IT PRINTS THE URL AND NOT THE RECIPIENT, which is the only interesting decision in the file.
// The URL carries a capability token that puts one address on a mailing list; the address itself is
// personal data that this repo refuses to write to a log anywhere else, and a server log is exactly
// the sort of place a "we never keep an email address" claim quietly stops being true. Printing the
// link keeps the flow testable; printing the address would make the log a copy of the list.

import { confirmationMessage, type Mailer } from "./port.ts";

export function logMailer(): Mailer {
  return {
    async sendConfirmation(_to, confirmUrl) {
      const { subject } = confirmationMessage(confirmUrl);
      console.log(`[ieat] mail (log provider) "${subject}" -> ${confirmUrl}`);
    },
  };
}
