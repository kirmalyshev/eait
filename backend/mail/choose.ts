// Which mailer a process gets, decided once from its config.
//
// `log` prints the confirmation link and never the recipient — the right sender for development
// and for a host with no landing page. It is the WRONG sender behind a public page: eait.fit ran
// that way for weeks, the boot warning fired once into a log nobody read, and every visitor who
// left an address was sent to "check your email" for a link that went to a container. So behind a
// public page the log provider does not print; it throws, the visitor lands on /try-later, and the
// operator gets one error line per submission until EAIT__BACKEND__MAIL_PROVIDER=resend is set. The process still
// starts, because the app's API is the same process and a phone must not lose its diary over a
// mailing list.

import type { Config } from "../config.ts";
import { logMailer } from "./log.ts";
import type { Mailer } from "./port.ts";
import { resendMailer } from "./resend.ts";

type MailConfig = Pick<
  Config,
  "mailProvider" | "mailFrom" | "resendApiKey" | "resendBaseUrl" | "mailTimeoutMs" | "landingUrl"
>;

/** Loopback, RFC 1918 and mDNS `.local`: a preview served to a phone on the LAN is still a preview. */
const LOCAL_LANDING =
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|[^/:]+\.local)(:|$|\/)/;

export function chooseMailer(config: MailConfig, demo: boolean): Mailer {
  // Demo first: a demo never sends real mail, whatever the environment happens to carry.
  if (demo) return logMailer();
  if (config.mailProvider === "resend") {
    return resendMailer({
      apiKey: config.resendApiKey, from: config.mailFrom,
      baseUrl: config.resendBaseUrl, timeoutMs: config.mailTimeoutMs,
    });
  }
  if (config.landingUrl === "" || LOCAL_LANDING.test(config.landingUrl)) return logMailer();

  console.warn(
    "[eait] EAIT__BACKEND__MAIL_PROVIDER=log with a public landing page: every subscribe submission will be "
    + "refused (/try-later) until EAIT__BACKEND__MAIL_PROVIDER=resend and EAIT__BACKEND__RESEND_API_KEY are set.",
  );
  return {
    async sendConfirmation() {
      throw new Error("EAIT__BACKEND__MAIL_PROVIDER=log with a public landing page: no confirmation was sent");
    },
  };
}
