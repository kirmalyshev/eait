// Web Push, the page's half: register the worker, hold the subscription, report a tap.
// Every request goes through `api.ts`; the worker (`sw.ts`) has no bearer and makes none.

import { dropPushToken, getPushConsent, postPushOpen, registerPushToken, signedIn } from "./api.ts";

export const pushSupported = (): boolean =>
  "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

export const registerWorker = (): Promise<ServiceWorkerRegistration> => navigator.serviceWorker.register("/sw.js");

const keyBytes = (b64url: string): Uint8Array<ArrayBuffer> => {
  const bin = atob(b64url.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(b64url.length / 4) * 4, "="));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

const post = (sub: PushSubscription) => registerPushToken({
  platform: "web",
  token: JSON.stringify(sub.toJSON()),
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
});

/** Ask permission and subscribe. Call from a user gesture: browsers refuse the prompt otherwise. */
export async function subscribeWeb(webPushKey: string): Promise<"on" | "denied"> {
  if (await Notification.requestPermission() !== "granted") return "denied";
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription()
    ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(webPushKey) });
  await post(sub);
  return "on";
}

export async function unsubscribeWeb(): Promise<void> {
  const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
  if (!sub) return;
  await dropPushToken(JSON.stringify(sub.toJSON()));
  await sub.unsubscribe();
}

/** Every boot, like the phone's every-launch register: a subscription's endpoint can change under it. */
export async function refreshWeb(): Promise<void> {
  if (Notification.permission !== "granted") return;
  const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
  if (sub) await post(sub);
}

/** A tap opened the page as `/?push=<sendId>`: report it once, then take it out of the address. */
export async function reportPushOpen(): Promise<void> {
  const sendId = new URLSearchParams(location.search).get("push");
  if (!sendId) return;
  await postPushOpen({ sendId, action: "tap" });
  history.replaceState(null, "", location.pathname + location.hash);
}

/** Boot, once the session is known. Skips everything when unsupported, signed out or the server sends no push. */
export async function startPush(): Promise<void> {
  if (!pushSupported()) return;
  await registerWorker();
  if (!signedIn()) return;
  await reportPushOpen();
  if ((await getPushConsent()).webPushKey !== null) await refreshWeb();
}
