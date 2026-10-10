// Which mail implementation a process gets, decided once from its config.
//
// Three states and only one of them sends anything:
//
//   mailProvider "resend"  → resendMail. `loadConfig` turns `resend` with no key into `off`.
//   mailProvider "log"     → logMail. Nothing leaves the machine; the code prints to the server
//                            log, which is what dev, tests and `--demo` drive the flow with.
//   mailProvider "off"     → a port that refuses. Email sign-in does not exist on this instance
//                            (`emailSignInEnabled`): its routes answer 404 and no surface draws
//                            the button, so this is only ever reached by a bug, and then it
//                            fails rather than pretending a mail went out.

import type { Config } from "../config.ts";
import { logMail } from "./log.ts";
import type { MailPort } from "./port.ts";
import { resendMail } from "./resend.ts";

/** The one predicate every email surface asks: routes, `/start`, and `Limits.emailSignIn`. */
export const emailSignInEnabled = (config: Pick<Config, "mailProvider">): boolean => config.mailProvider !== "off";

export function chooseMail(config: Pick<Config, "mailProvider" | "resendApiKey" | "mailFrom">): MailPort {
  if (config.mailProvider === "resend") {
    return resendMail({ apiKey: config.resendApiKey, from: config.mailFrom });
  }
  if (config.mailProvider === "off") {
    return { async sendSignInCode() { throw new Error("[eait] email sign-in is off on this instance"); } };
  }
  return logMail();
}
