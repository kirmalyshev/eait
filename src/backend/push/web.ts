// Web Push (browsers), over the `web-push` package.
//
// A subscription is the token: the canonical JSON `webPushSubscription` produces, which names a
// push service's endpoint and the browser's keys. There is no second phase — the push service
// answers each send with a status, and a 404 or 410 there IS `device-not-registered`. So every
// ticket has `id: null`, and nothing is ever waiting on a receipt.
//
// The token is the endpoint, the keys and the way back to a person's browser, so nothing here logs
// it, the body, or a key — only a count and a status.

import { webPushSubscription } from "@eait/shared";
import webpush from "web-push";
import { ownImage } from "./expo.ts";
import type { PushError, PushMessage, PushPort, PushTicket } from "./port.ts";

export interface WebPushOptions {
  publicKey: string;
  privateKey: string;
  /** `mailto:` or `https:` contact the push services may use to reach the operator. */
  subject: string;
  timeoutMs: number;
  /** The one host an `imageUrl` may name. Empty or unset: no image is ever sent. */
  imageHost?: string | undefined;
}

/** Sends in flight at once. */
const CONCURRENCY = 20;

/** A day: a push the browser has not collected by then is stale. */
const TTL_SECONDS = 24 * 60 * 60;

function toError(status: unknown): PushError {
  switch (status) {
    case 404:
    case 410: return "device-not-registered";
    case 413: return "message-too-big";
    case 429: return "message-rate-exceeded";
    case 401:
    case 403: return "mismatched-credentials";
    default: return "other";
  }
}

export function webPush(opts: WebPushOptions): PushPort {
  const sendOne = async (m: PushMessage): Promise<PushTicket> => {
    const token = webPushSubscription(m.to);
    if (token === null) return { token: m.to, id: null, error: "device-not-registered" };
    const image = ownImage(m.imageUrl, opts.imageHost);
    const payload = JSON.stringify({ title: m.title, body: m.body, data: m.data ?? {}, ...(image ? { image } : {}) });
    try {
      await webpush.sendNotification(JSON.parse(token), payload, {
        vapidDetails: { subject: opts.subject, publicKey: opts.publicKey, privateKey: opts.privateKey },
        TTL: TTL_SECONDS,
        urgency: "normal",
        timeout: opts.timeoutMs,
      });
      return { token: m.to, id: null, error: null };
    } catch (e) {
      const status = (e as { statusCode?: unknown })?.statusCode;
      console.error(`[eait] web push: a send failed (${typeof status === "number" ? status : "no status"})`);
      return { token: m.to, id: null, error: toError(status) };
    }
  };

  return {
    async send(messages) {
      const tickets: PushTicket[] = [];
      for (let i = 0; i < messages.length; i += CONCURRENCY) {
        tickets.push(...await Promise.all(messages.slice(i, i + CONCURRENCY).map(sendOne)));
      }
      return tickets;
    },
    async receipts() {
      return new Map();
    },
  };
}
