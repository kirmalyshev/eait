// Which push implementation a process gets, decided once from its config.
//
// Three states, and only one of them sends anything:
//
//   demo, or EAIT__BACKEND__PUSH_ENABLED unset  → logPush. Nothing leaves the machine.
//   enabled, no access token                    → logPush, and a warning at boot. Expo accepts
//                                                 unauthenticated sends, so falling back to
//                                                 sending would make this server one that anybody
//                                                 who learns a device token can impersonate.
//   enabled with a token                        → expoPush.
//
// The warning fires once at boot, which the mailer's history says is not enough on its own — the
// log provider ran behind a public landing page for weeks and one boot line did not stop it. The
// difference here is that nothing user-visible depends on a push having been sent: a missing 20:30
// line is a message that did not arrive, not a form that lied to the person who filled it in.

import type { Config } from "../config.ts";
import { expoPush } from "./expo.ts";
import { logPush } from "./log.ts";
import type { PushPort } from "./port.ts";

type PushConfig = Pick<Config, "pushEnabled" | "expoPushAccessToken" | "pushTimeoutMs">;

export function choosePush(config: PushConfig, demo: boolean): PushPort {
  if (demo || !config.pushEnabled) return logPush();
  if (config.expoPushAccessToken === "") {
    console.warn(
      "[eait] EAIT__BACKEND__PUSH_ENABLED is on without EAIT__BACKEND__EXPO_PUSH_ACCESS_TOKEN: "
      + "notifications will be logged, not sent. Expo accepts unauthenticated sends and this "
      + "server will not make one.",
    );
    return logPush();
  }
  return expoPush({ accessToken: config.expoPushAccessToken, timeoutMs: config.pushTimeoutMs });
}
