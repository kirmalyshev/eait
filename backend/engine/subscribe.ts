// The mailing list.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// WHY THIS EXISTS AT ALL, ON A PRODUCT THAT REFUSES TO STORE AN EMAIL
//
// The app does not ask for an address and never will: `requestedScopes: []`, and `auth/verify.ts`
// discards whatever a provider volunteers. That is a real promise and the landing page makes it.
//
// This is a different thing, and the difference is the whole design. Somebody who reads the page
// and is not ready to open a chat today has, otherwise, no way to hear about it again — and
// `marketing/research/2026-07-22-form-factor-research.md` names the list as the only
// audience asset no platform can take away. So the list exists, and it is kept SEPARATE:
//
//   • No row joins a subscriber to a user. `store.ts` says so and both implementations obey it.
//   • The app's promise stays literally true, because the app is still not where the address came
//     from and still has no way to reach one.
//   • Withdrawal is its own action with its own capability token, rather than something you get by
//     deleting an account you may not have.
//
// The cost, stated plainly because it is the kind of thing that surprises people later: deleting
// an eait account does NOT remove an address from this list. The privacy policy says that.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// A ROW IS NOT A SUBSCRIBER. THE CONFIRMATION IS.
//
// Submitting a form is not consent — it is somebody typing an address into a box, and there is
// nothing in the act that says the address was theirs. Single opt-in means any visitor can put any
// stranger on this list, and that stranger's first contact is a message they never asked for and
// have to act on. In Germany, where this is built and where most of these addresses will be, the
// confirmed variety is the standard for proving consent at all (BGH I ZR 164/09).
//
// So a submission writes a PENDING row, sends one confirmation, and stops. Until the link in it is
// clicked the address is on no list. If nobody clicks it, the row is deleted within days: an
// unconfirmed address is personal data held with no basis whatsoever, quite possibly somebody
// else's, and the only defensible thing to do with it is to stop having it.
// ─────────────────────────────────────────────────────────────────────────────────────────────

import type { Mailer } from "../mail/port.ts";
import type { Store } from "../store.ts";

export interface SubscribeDeps {
  store: Store;
  mailer: Mailer;
  config: {
    subscribeDailyCap: number;
    /** How long a pending row lives before it is swept. */
    subscribeConfirmTtlDays: number;
  };
  /** Where the confirmation link points: the API's own public origin. Built in `routes.ts`. */
  confirmUrlBase: string;
  now?: () => number;
}

export type SubscribeResult =
  /** `pending` is false when the address was already confirmed and nothing was sent. */
  | { ok: true; created: boolean; pending: boolean }
  /** Every refusal a caller may be told about. The reason is never shown to the submitter. */
  | { ok: false; reason: "invalid" | "honeypot" | "capped" | "send-failed" };

/**
 * Deliberately not RFC 5322.
 *
 * A full-grammar validator accepts addresses no mail provider will deliver to and rejects ones they
 * will, and the only check that actually proves an address works is sending to it. This one rules
 * out the shapes that are certainly not addresses and gets out of the way — one `@`, something
 * either side, a dot in the domain, no whitespace, no angle brackets.
 */
const EMAIL_RE = /^[^\s@<>,;]{1,64}@[^\s@<>,;.]+(?:\.[^\s@<>,;.]+)+$/;

/** Longer than any real address and short enough that a body cannot be used as storage. */
const MAX_EMAIL_LENGTH = 254;

export function normaliseEmail(raw: string): string {
  // Lowercased and trimmed, so `Kirill@…` and `kirill@…` are one row rather than two subscriptions
  // and two tokens. The local part is technically case-sensitive; no provider anybody uses treats
  // it that way, and the failure mode of respecting it here is a person who cannot unsubscribe
  // because they typed their own address with a different capitalisation.
  return raw.trim().toLowerCase();
}

/** The confirmation link, built in ONE place so the route and the email cannot disagree. */
export function confirmUrl(base: string, token: string): string {
  return `${base.replace(/\/$/, "")}/v1/subscribe/confirm?t=${encodeURIComponent(token)}`;
}

/**
 * Records an address as pending and sends it one confirmation.
 *
 * `honeypot` is a field the form renders, hides from people, and expects to be empty. It is the
 * whole anti-spam story on the page itself and that is a deliberate choice: a CAPTCHA is a
 * third-party script on a page whose entire argument is that it loads none, and a signed-token
 * scheme needs JavaScript the page also does not have. A bot that fills every field it finds is
 * most of them; `subscribeRateLimitPerHour` in `routes.ts` is the backstop for one that does not.
 *
 * The daily cap counts EVERY row added today, confirmed or not — a cap that only counted the ones
 * it liked is a cap a loop walks straight through.
 */
export async function subscribe(
  deps: SubscribeDeps,
  input: { email: string; honeypot?: string; source: string },
): Promise<SubscribeResult> {
  // Checked first and cheapest. A filled honeypot is answered exactly like a success, so a bot
  // learns nothing from the response about whether it was believed.
  if (input.honeypot && input.honeypot.trim() !== "") return { ok: false, reason: "honeypot" };

  const email = normaliseEmail(input.email ?? "");
  if (email.length === 0 || email.length > MAX_EMAIL_LENGTH || !EMAIL_RE.test(email)) {
    return { ok: false, reason: "invalid" };
  }

  const now = deps.now?.() ?? Date.now();

  // Swept here rather than on a timer this process does not have. Running it on the write path
  // means it happens exactly when the table is growing, which is when it matters — and it means an
  // abandoned pending row stops counting against the cap below once it has expired.
  const ttlMs = deps.config.subscribeConfirmTtlDays * 24 * 60 * 60 * 1000;
  await deps.store.pruneUnconfirmedSubscribers(new Date(now - ttlMs).toISOString());

  const since = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  if (await deps.store.countSubscribersSince(since) >= deps.config.subscribeDailyCap) {
    return { ok: false, reason: "capped" };
  }

  const { confirmToken, created } = await deps.store.addSubscriber(email, input.source);

  // Already confirmed: send NOTHING. A "you are already subscribed" message is unsolicited mail to
  // somebody who did not ask for it this time, and answering the form differently for an address
  // already on the list turns this endpoint into an oracle for who is on it.
  if (confirmToken === null) return { ok: true, created, pending: false };

  try {
    await deps.mailer.sendConfirmation(email, confirmUrl(deps.confirmUrlBase, confirmToken));
  } catch (e) {
    // Logged, never returned: a provider's error can quote the request it rejected, and that
    // request contains the address. The pending row is left alone — it cannot be confirmed, so the
    // sweep removes it within the week, which is the right end state for an address nobody agreed
    // to.
    console.error(`[eait] subscribe: confirmation send failed: ${(e as Error)?.message ?? e}`);
    return { ok: false, reason: "send-failed" };
  }

  return { ok: true, created, pending: true };
}

/**
 * Turns a pending row into a subscriber.
 *
 * Says nothing about whether the token was known, for the same reason `unsubscribe` does not: the
 * page should read the same whether the link was clicked once or twice, and an endpoint that
 * answers differently is an oracle for which tokens are live.
 */
export async function confirmSubscription(deps: SubscribeDeps, token: string): Promise<void> {
  if (!token || token.length > 128) return;
  await deps.store.confirmSubscriber(token);
}

/**
 * Removes an address, by token.
 *
 * Returns nothing for an unknown token as well as a known one, and that is not a bug. The page a
 * person lands on says "you are off the list", and it should say that whether they clicked the link
 * once or twice — the alternative is an error page telling somebody who has already unsubscribed
 * that something went wrong.
 */
export async function unsubscribe(deps: SubscribeDeps, token: string): Promise<void> {
  if (!token || token.length > 128) return;
  await deps.store.removeSubscriber(token);
}
