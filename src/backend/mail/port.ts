// How a sign-in code reaches an inbox, as a port.
//
// Same reason `push/port.ts` and `llm/port.ts` exist: the engine asks for the mail and must not
// know which provider carries it — a test, a dev run and `--demo` get the `log` implementation and
// read the code off the server log, never off a network.
//
// ONE METHOD, because the sign-in code is the only mail this server sends. A generic
// send(subject, body) would invite a second caller before there is copy for one; the day another
// mail exists this grows a second method or a union type.

import type { Lang } from "@eait/shared";

export interface MailPort {
  /**
   * Deliver `code` to `to`, worded in `lang`.
   *
   * Throws on a provider failure rather than swallowing it: the caller's code stays live in the
   * store either way, and a mail that did not go out is the failure a silent 204 would hide.
   */
  sendSignInCode(to: string, code: string, lang: Lang): Promise<void>;
}
