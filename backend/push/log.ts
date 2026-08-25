// The push service for a process with no Expo credential: print, do not send.
//
// The same role `mail/log.ts` plays for the confirmation email — it makes the whole nightly sweep
// drivable by hand, in demo mode and in development, with no vendor account and no device.
//
// IT PRINTS NEITHER THE TOKEN NOR THE BODY. The token addresses somebody's phone and the body says
// what they ate; a count and a title is what makes the flow readable. That the log is less useful
// than it could be is the point: this implementation runs in development AND on any host whose
// credential was never set, and a log line is the easiest place for either to leak.

import type { PushPort } from "./port.ts";

export function logPush(): PushPort {
  let seq = 0;
  return {
    async send(messages) {
      console.log(`[ieat] push (log only): ${messages.length} message(s) would be sent`);
      return messages.map((m) => ({ token: m.to, id: `log-${++seq}`, error: null }));
    },
    async receipts(ids) {
      return new Map(ids.map((id) => [id, null]));
    },
  };
}
