// Which mail implementation a process gets, decided once from its config.
//
// Two states and only one of them sends anything:
//
//   mailProvider "log" (the default)      → logMail. Nothing leaves the machine; the code prints
//                                           to the server log, which is what dev, tests and
//                                           `--demo` drive the flow with.
//   mailProvider "resend" + an API key    → resendMail. `loadConfig` has already refused the
//                                           combination of `resend` and no key, so by the time
//                                           this reads them both are either right or the process
//                                           is not running.

import type { Config } from "../config.ts";
import { logMail } from "./log.ts";
import type { MailPort } from "./port.ts";
import { resendMail } from "./resend.ts";

export function chooseMail(config: Pick<Config, "mailProvider" | "resendApiKey" | "mailFrom">): MailPort {
  if (config.mailProvider === "resend") {
    return resendMail({ apiKey: config.resendApiKey, from: config.mailFrom });
  }
  return logMail();
}
