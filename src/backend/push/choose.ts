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
// Web subscriptions (tokens that parse as one) are routed to a second client by the same rule: sent
// through `webPush` when PUSH_ENABLED and all three VAPID values are set, logged otherwise.
//
// The warning fires once at boot. The difference here is that nothing user-visible depends on a
// push having been sent: a missing 20:30 line is a message that did not arrive, not a form that
// lied to the person who filled it in.

import { webPushSubscription } from "@eait/shared";
import type { Config } from "../config.ts";
import { expoPush } from "./expo.ts";
import { logPush } from "./log.ts";
import type { PushPort } from "./port.ts";
import { webPush } from "./web.ts";

type PushConfig = Pick<
  Config,
  "pushEnabled" | "expoPushAccessToken" | "webPushVapidPublicKey" | "webPushVapidPrivateKey" | "webPushSubject" | "pushTimeoutMs" | "publicApiUrl"
>;

/**
 * Push images are served from the API host and from nowhere else, so the allowed host is the one
 * this server already announces as its own, never a second setting that has to agree with it
 * (the app's notification extension allows exactly the host of the API origin it talks to).
 * No `publicApiUrl` means no image is ever sent.
 */
export function apiHostOf(publicApiUrl: string): string | undefined {
  try {
    const u = new URL(publicApiUrl);
    return u.protocol === "https:" ? u.hostname : undefined;
  } catch {
    return undefined;
  }
}

function chooseExpo(config: PushConfig, demo: boolean): PushPort {
  if (demo || !config.pushEnabled) return logPush();
  if (config.expoPushAccessToken === "") {
    console.warn(
      "[eait] EAIT__BACKEND__PUSH_ENABLED is on without EAIT__BACKEND__EXPO_PUSH_ACCESS_TOKEN: "
      + "notifications will be logged, not sent. Expo accepts unauthenticated sends and this "
      + "server will not make one.",
    );
    return logPush();
  }
  return expoPush({ accessToken: config.expoPushAccessToken, timeoutMs: config.pushTimeoutMs, imageHost: apiHostOf(config.publicApiUrl) });
}

function chooseWeb(config: PushConfig, demo: boolean): PushPort {
  if (demo || !config.pushEnabled) return logPush();
  const vapid = [config.webPushVapidPublicKey, config.webPushVapidPrivateKey, config.webPushSubject];
  if (vapid.some((v) => v === "")) {
    if (vapid.some((v) => v !== "")) {
      console.warn(
        "[eait] EAIT__BACKEND__WEB_PUSH_* is only partly set (public key, private key and subject are all needed): "
        + "web notifications will be logged, not sent.",
      );
    }
    return logPush();
  }
  return webPush({
    publicKey: config.webPushVapidPublicKey, privateKey: config.webPushVapidPrivateKey, subject: config.webPushSubject,
    timeoutMs: config.pushTimeoutMs, imageHost: apiHostOf(config.publicApiUrl),
  });
}

/** Routes each message by its token: a Web Push subscription goes to the web client, everything else to Expo's. */
export function choosePush(config: PushConfig, demo: boolean): PushPort {
  const expo = chooseExpo(config, demo);
  const web = chooseWeb(config, demo);
  return {
    async send(messages) {
      const isWeb = (to: string) => webPushSubscription(to) !== null;
      const [forWeb, forExpo] = [messages.filter((m) => isWeb(m.to)), messages.filter((m) => !isWeb(m.to))];
      const [a, b] = await Promise.all([forExpo.length ? expo.send(forExpo) : [], forWeb.length ? web.send(forWeb) : []]);
      return [...a, ...b];
    },
    receipts: (ids) => expo.receipts(ids),
  };
}
