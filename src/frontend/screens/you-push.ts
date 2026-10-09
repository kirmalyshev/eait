// The two push switches on the web You rows (boards web/you-notifs-*): Notifications (the account
// switch, and this browser's subscription) and Tips and offers (the consent). Mirrors the phone's
// push-offers.ts: a tap shows the new position at once, a failure puts it back and says so.
// Both rows are absent where the server sends no Web Push or this browser cannot receive it.

import { getPushConsent, setPushConsent } from "../api.ts";
import { pushSupported, subscribeWeb, unsubscribeWeb } from "../push.ts";
import { el } from "../shell.ts";
import type { YouCopy } from "../../shared/app/you-copy.ts";

interface Sw { on: boolean; failed: boolean; saving: boolean }

export async function pushRows(after: HTMLElement, words: YouCopy["web"]): Promise<void> {
  if (!pushSupported()) return;
  const consent = await getPushConsent().catch(() => null);
  const key = consent?.webPushKey;
  if (!consent || !key || !after.isConnected) return;

  const notif: Sw = { on: consent.notifications, failed: false, saving: false };
  const offers: Sw = { on: consent.offers, failed: false, saving: false };
  let blocked = notif.on && Notification.permission === "denied";

  const make = (label: string, state: Sw, sub: () => string | null, toggle: () => Promise<void>) => {
    const row = el("div", "opt sw");
    const text = el("div", "ot");
    const labelId = `sw-${label.replace(/\W+/g, "-")}`;
    const lab = el("span", "ot", label);
    lab.id = labelId;
    const subline = el("div", "sub");
    text.append(lab, subline);
    const sw = el("button", "swt") as HTMLButtonElement;
    sw.type = "button";
    sw.setAttribute("role", "switch");
    sw.setAttribute("aria-labelledby", labelId);
    sw.append(el("i", ""));
    sw.addEventListener("click", () => { if (!state.saving) void toggle(); });
    row.append(text, sw);
    const paint = () => {
      sw.setAttribute("aria-checked", String(state.on));
      const line = sub();
      subline.textContent = line ?? "";
      subline.hidden = line === null;
    };
    return { row, paint };
  };

  const save = async (state: Sw, body: { notifications?: boolean; offers?: boolean }, work?: () => Promise<void>) => {
    const was = state.on;
    state.on = !was; state.saving = true; state.failed = false; paint();
    try {
      await setPushConsent(body);
      await work?.();
    } catch {
      state.on = was; state.failed = true;
    }
    state.saving = false; paint();
  };

  const n = make(words.notifications, notif,
    () => notif.failed ? words.pushSaveFailed : blocked ? words.offInBrowser : null,
    async () => {
      if (notif.on) {
        // Off: the account first, then this browser's subscription, which is best effort.
        await save(notif, { notifications: false });
        if (!notif.on) void unsubscribeWeb().catch(() => {});
        return;
      }
      // On: this click is the gesture the permission prompt needs.
      notif.saving = true; notif.failed = false;
      try {
        if (await subscribeWeb(key) === "denied") {
          blocked = true; notif.on = true; notif.saving = false; paint(); return;
        }
        blocked = false;
      } catch {
        notif.saving = false; notif.failed = true; paint(); return;
      }
      notif.saving = false;
      await save(notif, { notifications: true });
    });
  const o = make(words.tipsAndOffers, offers,
    () => offers.failed ? words.pushSaveFailed : null,
    () => save(offers, { offers: !offers.on }));

  function paint(): void {
    n.paint(); o.paint();
    o.row.hidden = !notif.on;
  }
  paint();
  after.after(n.row, o.row);
}
