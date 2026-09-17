// The push service the tests assert against.
//
// It records instead of sending, so a test can say "one message went to this device with these
// words in it" rather than "the function returned without throwing" — the same role `mail/fake.ts`
// plays for the confirmation email and `llm/demo.ts` for the analyzer.
//
// Not wired into any binary. `logPush` is what a process without an Expo credential gets.

import type { PushError, PushMessage, PushPort, PushTicket } from "./port.ts";

export interface FakePush extends PushPort {
  readonly sent: PushMessage[];
  /** This token is gone: the next `send` refuses it in the ticket. */
  unregister(token: string): void;
  /** This receipt id comes back as a dead device, the way a real one does minutes later. */
  unregisterReceipt(id: string): void;
  /** This receipt id comes back as a failure that is NOT a dead device. */
  failReceipt(id: string): void;
  /** Make the next `send` throw, to exercise a push service that is down. */
  failNext(message?: string): void;
}

export function fakePush(): FakePush {
  const sent: PushMessage[] = [];
  const dead = new Set<string>();
  const receiptErrors = new Map<string, PushError>();
  let failure: string | null = null;
  let seq = 0;

  return {
    sent,
    unregister(token) { dead.add(token); },
    unregisterReceipt(id) { receiptErrors.set(id, "device-not-registered"); },
    failReceipt(id) { receiptErrors.set(id, "message-rate-exceeded"); },
    failNext(message = "push service unavailable") { failure = message; },

    async send(messages) {
      if (failure !== null) {
        const message = failure;
        failure = null;
        throw new Error(message);
      }
      const tickets: PushTicket[] = [];
      for (const m of messages) {
        if (dead.has(m.to)) {
          tickets.push({ token: m.to, id: null, error: "device-not-registered" });
          continue;
        }
        sent.push(m);
        tickets.push({ token: m.to, id: `receipt-${++seq}`, error: null });
      }
      return tickets;
    },

    async receipts(ids) {
      const out = new Map<string, PushError | null>();
      for (const id of ids) out.set(id, receiptErrors.get(id) ?? null);
      return out;
    },
  };
}
