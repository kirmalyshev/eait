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
// `eait-marketer/docs/research/2026-07-22-form-factor-research.md` names the list as the only
// audience asset no platform can take away. So the list exists, and it is kept SEPARATE:
//
//   • No row joins a subscriber to a user. `store.ts` says so and both implementations obey it.
//   • The app's promise stays literally true, because the app is still not where the address came
//     from and still has no way to reach one.
//   • Withdrawal is its own action with its own capability token, rather than something you get by
//     deleting an account you may not have.
//
// The cost, stated plainly because it is the kind of thing that surprises people later: deleting
// an ieat account does NOT remove an address from this list. The privacy policy says that.
// ─────────────────────────────────────────────────────────────────────────────────────────────

import type { Store } from "../store.ts";

export interface SubscribeDeps {
  store: Store;
  config: { subscribeDailyCap: number };
  now?: () => number;
}

export type SubscribeResult =
  | { ok: true; created: boolean }
  /** Every refusal a caller may be told about. The reason is never shown to the submitter. */
  | { ok: false; reason: "invalid" | "honeypot" | "capped" };

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

/**
 * Adds an address to the list.
 *
 * `honeypot` is a field the form renders, hides from people, and expects to be empty. It is the
 * whole anti-spam story and that is a deliberate choice: a CAPTCHA is a third-party script on a
 * page whose entire argument is that it loads none, and a signed-token scheme needs JavaScript the
 * page also does not have. A bot that fills every field it finds is most of them.
 *
 * The daily cap is the backstop for the rest. It counts EVERY row added today, successful or not —
 * a cap that only counts the ones it liked is a cap a loop walks straight through.
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
  const since = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  if (await deps.store.countSubscribersSince(since) >= deps.config.subscribeDailyCap) {
    return { ok: false, reason: "capped" };
  }

  const { created } = await deps.store.addSubscriber(email, input.source);
  return { ok: true, created };
}

/**
 * Removes an address, by token.
 *
 * Returns true for an unknown token as well as a known one, and that is not a bug. The page a
 * person lands on says "you are off the list", and it should say that whether they clicked the link
 * once or twice — the alternative is an error page telling somebody who has already unsubscribed
 * that something went wrong. It also stops the endpoint being an oracle for which tokens are live.
 */
export async function unsubscribe(deps: SubscribeDeps, token: string): Promise<void> {
  if (!token || token.length > 128) return;
  await deps.store.removeSubscriber(token);
}
