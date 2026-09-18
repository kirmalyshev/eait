// The mailer the tests assert against.
//
// It records instead of sending, which is what lets a test say "one confirmation went to this
// address with this link in it" rather than "the function returned without throwing". The same
// role `llm/demo.ts` plays for the model: a real implementation of the port whose output a test can
// read.
//
// Not wired into any binary. `logMailer` is what development uses, because printing the link is
// what makes the flow drivable by hand.

import type { Mailer } from "./port.ts";

export interface FakeMailer extends Mailer {
  readonly sent: { to: string; confirmUrl: string }[];
  /** Make the next send throw, to exercise the path where a provider is down. */
  failNext(message?: string): void;
}

export function fakeMailer(): FakeMailer {
  const sent: { to: string; confirmUrl: string }[] = [];
  let failure: string | null = null;

  return {
    sent,
    failNext(message = "provider unavailable") {
      failure = message;
    },
    async sendConfirmation(to, confirmUrl) {
      if (failure !== null) {
        const message = failure;
        failure = null;
        throw new Error(message);
      }
      sent.push({ to, confirmUrl });
    },
  };
}
