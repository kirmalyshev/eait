// Sign-in by email: a six-digit code as the credential, and nothing else new (#569).
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// WHAT THIS IS, AND WHAT IT DELIBERATELY IS NOT
//
// A third provider beside Apple and Google. The code is the whole identity proof: whoever reads
// the inbox reads the account, so the code is drawn, stored and spent like a credential — CSPRNG,
// sha256 at rest, timing-safe compare, ten minutes, single use, five wrong tries burn it.
//
// The ADDRESS is the subject, trimmed and lowercased, and `identities` keys on it exactly like a
// provider `sub`. It is NEVER joined to an `identities.email` recorded off an Apple or Google
// sign-in: private relay makes the match unreliable, and a match would hand that account to
// whoever controls the inbox. An address on two providers is two accounts — by design, not by
// accident. Nothing here looks an account up by address, and the 204 the send route gives is the
// same answer either way, so the route cannot enumerate one.
//
// The five sign-in outcomes are `completeSignIn`'s, reached with the subject the code proved —
// not a second copy of them.
// ─────────────────────────────────────────────────────────────────────────────────────────────

import type { AuthProviderResponse, Lang } from "@eait/shared";
import { hashToken } from "../auth/tokens.ts";
import { AuthError } from "../auth/verify.ts";
import type { EngineDeps } from "./deps.ts";
import { completeSignIn } from "./identity.ts";

/** How long a code is worth typing — a security parameter, like `PAIR_TTL_MS`, not a setting. */
export const EMAIL_CODE_TTL_MS = 10 * 60_000;
/** A send refused inside this window after the last one — the countdown the client shows. */
export const EMAIL_RESEND_SEC = 60;
/** Wrong tries before a code is burnt. Six digits is a million codes; five is not a guess, it is a typo. */
export const EMAIL_CODE_ATTEMPTS = 5;

/**
 * What the store is ever asked about. Everything else — stray whitespace, a trailing dot in the
 * local part a person typed, case — is normalised before it reaches here, because the subject is
 * the address and two spellings of one inbox are one account.
 */
export const EMAIL_ADDRESS = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;

/** The address's one stored form: trimmed and lowercased, the subject `identities` keys on. */
export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

/**
 * Six digits from a CSPRNG, without modulo bias.
 *
 * `value % 1_000_000` over a raw uint32 favours the first ~967,296 codes by a factor of about
 * one part in 4,300 — small enough that nobody would notice, and exactly the kind of bias the
 * pairing code's ALPHABET comment says a second copy of the arithmetic eventually produces.
 * Rejection to a multiple of a million makes every code equally likely; the bound accepts
 * ~99.98% of draws.
 */
export function newEmailCode(): string {
  const LIMIT = 4_294_000_000; // the largest multiple of 1e6 below 2^32
  const buf = new Uint32Array(1);
  let v: number;
  do {
    crypto.getRandomValues(buf);
    v = buf[0]!;
  } while (v >= LIMIT);
  return String(v % 1_000_000).padStart(6, "0");
}

/**
 * Mint a code for `email`, superseding whatever the address had, and send it.
 *
 * Null on accept — the mail is on its way — or the seconds to wait when the send was refused by
 * either bound the store enforces: the per-recipient hourly cap (`config.emailCodesPerHour`) and
 * the resend window (`EMAIL_RESEND_SEC`). The caller's own per-address allowance is the ROUTE's,
 * spent before this is ever called — same division as the OAuth callback.
 *
 * The mail goes out AFTER the row lands. The other order is worse: a mail that left while the
 * insert failed is a code nobody can ever spend, and a send refused after the row landed is a
 * code a resend fixes. A mail provider that THROWS reaches the route as a 500 — the row stays
 * live for the retry, and the failure is logged instead of silently answering 204 over a mail
 * that never went out.
 */
export async function sendEmailCode(
  deps: EngineDeps,
  rawEmail: string,
  lang: Lang,
): Promise<number | null> {
  const email = normalizeEmail(rawEmail);
  const code = newEmailCode();
  const wait = await deps.store.putEmailCode(
    email,
    await hashToken(code),
    Date.now() + EMAIL_CODE_TTL_MS,
    { perHour: deps.config.emailCodesPerHour, resendSec: EMAIL_RESEND_SEC },
  );
  if (wait !== null) return wait;
  await deps.mail.sendSignInCode(email, code, lang);
  return null;
}

/**
 * Spend a code and sign the address in.
 *
 * `code-wrong` is a live code the hash did not match — the fifth one burns it. `code-dead` is no
 * live row at all: expired, used, burnt, superseded, or never sent — one answer for all of them,
 * the same shape `claimPairingCode` chose and for the same reason.
 *
 * On the spend's success the address goes through `completeSignIn` like a verified `sub`:
 * `currentUserId` is the session the caller already holds (anonymous → merged, real → linked or
 * switched), and `consent` is what the sign-up screen collected. The route enforces `terms` first,
 * cheaply — same shape as the OAuth routes.
 */
export async function verifyEmailCode(
  deps: EngineDeps,
  rawEmail: string,
  rawCode: string,
  currentUserId: string | null,
  lang: Lang,
  consent: { terms: boolean; marketing: boolean },
): Promise<AuthProviderResponse | { kind: "code-wrong" | "code-dead" }> {
  if (!consent.terms) throw new AuthError("terms-required");
  const email = normalizeEmail(rawEmail);
  const spent = await deps.store.spendEmailCode(email, await hashToken(rawCode.trim()), EMAIL_CODE_ATTEMPTS);
  if (spent !== "ok") return { kind: spent === "wrong" ? "code-wrong" : "code-dead" };
  // The address IS the verified subject, and `identities.email` gets it too — `recordEmail`
  // inside `completeSignIn` stores it exactly as a provider-vouched address, which this one is.
  return completeSignIn(
    deps, "email", { provider: "email", subject: email, email },
    currentUserId, lang, consent,
  );
}
