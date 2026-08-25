// Expo's push service, over HTTP.
//
// https://exp.host/--/api/v2/push/send takes a batch and answers with one TICKET per message;
// /getPushNotificationReceipts answers, minutes later, with what actually happened at Apple. Both
// halves matter: a ticket says Expo accepted the message, and a receipt says the device took it.
// `DeviceNotRegistered` normally arrives on the RECEIPT — the app was deleted, Apple told Expo —
// and a server that never reads receipts keeps pushing to a phone that has not had the app on it
// for a year.
//
// THE ACCESS TOKEN IS OPTIONAL AT EXPO AND NOT OPTIONAL HERE. Without "enhanced security" anybody
// who learns a push token can send to it; `chooseP…` refuses to build this client without one, so
// an unset credential is a process that LOGS rather than one that sends unauthenticated.

import type { PushError, PushMessage, PushPort, PushTicket } from "./port.ts";

const SEND_URL = "https://exp.host/--/api/v2/push/send";
const RECEIPTS_URL = "https://exp.host/--/api/v2/push/getPushNotificationReceipts";

/** Expo's documented batch size for both endpoints. Over it, the request is rejected whole. */
const BATCH = 100;

export interface ExpoPushOptions {
  accessToken: string;
  timeoutMs: number;
  /** Overridable so a test or a staging instance can point at a recorder. */
  sendUrl?: string;
  receiptsUrl?: string;
}

/** Expo's error vocabulary, narrowed to what this server acts on. */
function toError(details: unknown): PushError {
  const code = (details as { error?: unknown } | null)?.error;
  switch (code) {
    case "DeviceNotRegistered": return "device-not-registered";
    case "MessageTooBig": return "message-too-big";
    case "MessageRateExceeded": return "message-rate-exceeded";
    case "MismatchedSenderId":
    case "InvalidCredentials": return "mismatched-credentials";
    default: return "other";
  }
}

export function expoPush(opts: ExpoPushOptions): PushPort {
  const sendUrl = opts.sendUrl ?? SEND_URL;
  const receiptsUrl = opts.receiptsUrl ?? RECEIPTS_URL;

  const post = async (url: string, body: unknown): Promise<unknown> => {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        // `accept` because Expo's API negotiates on it. `accept-encoding` is deliberately NOT set:
        // Expo's documented example pairs the two, but fetch sets and transparently decodes its own,
        // and a hand-written one it then cannot decode is a body this client would fail to parse.
        "accept": "application/json",
        "content-type": "application/json",
        "authorization": `Bearer ${opts.accessToken}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(opts.timeoutMs),
    });
    if (!res.ok) {
      // The status, never the body: an error body from a push service echoes the request, and the
      // request carries device tokens and a sentence about what somebody ate.
      throw new Error(`expo push ${url} answered ${res.status}`);
    }
    return await res.json();
  };

  return {
    async send(messages) {
      const tickets: PushTicket[] = [];
      for (let i = 0; i < messages.length; i += BATCH) {
        const chunk = messages.slice(i, i + BATCH);
        const payload = chunk.map((m: PushMessage) => ({
          to: m.to, title: m.title, body: m.body, sound: "default",
        }));
        // PER CHUNK, because the earlier chunks have already been ACCEPTED by Expo and will be
        // delivered. A throw escaping this loop would report them as failed — and would lose their
        // receipt ids, which is worse: `DeviceNotRegistered` normally arrives on the receipt, so
        // every dead token in an accepted chunk would survive to be pushed again every night.
        let data: unknown[];
        try {
          const answer = await post(sendUrl, payload) as { data?: unknown[] };
          data = Array.isArray(answer?.data) ? answer.data : [];
        } catch (e) {
          // The status, never the body — `post` has already stripped it. This chunk's messages get
          // "other", which keeps their tokens: a provider having a bad night is not a dead device.
          console.error(`[ieat] expo push: a batch of ${chunk.length} failed: ${(e as Error)?.message ?? e}`);
          for (const m of chunk) tickets.push({ token: m.to, id: null, error: "other" });
          continue;
        }
        chunk.forEach((m, j) => {
          // Positional, which is what Expo's contract is: one ticket per message, in order. A short
          // array is a message we cannot say anything about, and "other" keeps the token.
          const t = data[j] as { status?: string; id?: string; details?: unknown } | undefined;
          if (!t) { tickets.push({ token: m.to, id: null, error: "other" }); return; }
          if (t.status === "ok" && typeof t.id === "string") {
            tickets.push({ token: m.to, id: t.id, error: null });
            return;
          }
          tickets.push({ token: m.to, id: null, error: toError(t.details) });
        });
      }
      return tickets;
    },

    async receipts(ids) {
      const out = new Map<string, PushError | null>();
      for (let i = 0; i < ids.length; i += BATCH) {
        const chunk = ids.slice(i, i + BATCH);
        const answer = await post(receiptsUrl, { ids: chunk }) as { data?: Record<string, unknown> };
        const data = answer?.data ?? {};
        for (const [id, raw] of Object.entries(data)) {
          const r = raw as { status?: string; details?: unknown };
          // A receipt that is not ready yet is simply not in the answer, and the loop never sees
          // it. That is not a failure — it is checked next time or not at all, and the token stays.
          out.set(id, r?.status === "ok" ? null : toError(r?.details));
        }
      }
      return out;
    },
  };
}
