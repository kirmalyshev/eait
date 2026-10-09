// The service worker: shows a Web Push and routes its tap. It holds no bearer and makes no request —
// the open is reported by the page (`push.ts` → `reportPushOpen`) from the `?push=` it is opened with.
// Typed locally rather than with the `webworker` lib, which cannot share a tsconfig with the DOM one.

interface PushData { sendId?: string; route?: string; mealId?: string }
interface Waitable { waitUntil(p: Promise<unknown>): void }
interface PushEvt extends Waitable { data: { json(): { title: string; body: string; data?: PushData; image?: string } } | null }
interface ClickEvt extends Waitable { notification: { close(): void; data?: PushData } }
interface WinClient { url: string; focus(): Promise<unknown>; navigate(url: string): Promise<unknown> }
interface Worker {
  registration: { showNotification(title: string, o: object): Promise<void> };
  clients: { matchAll(o: object): Promise<WinClient[]>; openWindow(url: string): Promise<unknown> };
  location: { origin: string };
  addEventListener(type: "push", fn: (e: PushEvt) => void): void;
  addEventListener(type: "notificationclick", fn: (e: ClickEvt) => void): void;
}
const sw = self as unknown as Worker;

// Keys are `PUSH_ROUTES` (shared/contract.ts); a type import cannot make this table exhaustive, so a new route is one line here.
const HASH: Record<string, string> = {
  home: "#/", chat: "#/chat", progress: "#/progress", camera: "#/log",
  settings: "#/you", profile: "#/you", subscription: "#/pay",
};

sw.addEventListener("push", (event) => {
  const p = event.data?.json();
  if (!p) return;
  event.waitUntil(sw.registration.showNotification(p.title, {
    body: p.body, data: p.data, image: p.image, tag: p.data?.sendId,
  }));
});

sw.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const d = event.notification.data ?? {};
  const hash = d.route !== undefined ? HASH[d.route] ?? "#/"
    : d.mealId !== undefined ? `#/meal/${encodeURIComponent(d.mealId)}` : "#/";
  const url = `/${d.sendId ? `?push=${encodeURIComponent(d.sendId)}` : ""}${hash}`;
  event.waitUntil((async () => {
    const win = (await sw.clients.matchAll({ type: "window", includeUncontrolled: true }))
      .find((c) => c.url.startsWith(sw.location.origin));
    if (win) { await win.focus(); await win.navigate(url); } else await sw.clients.openWindow(url);
  })());
});
