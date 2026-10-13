// The short-lived code that links a Telegram account. Issue #209.
//
// An authenticated app session mints a code (`POST /v1/auth/pair`, or `POST /start/telegram`); the
// Telegram bot spends it with `/start <code>` and `linkTelegram` (`engine/identity.ts`) attaches the
// `telegram` identity to the minting account. It was also redeemable for a browser session until the
// email sign-in (#569) gave the browser its own way in.
//
// It is NOT a sign-in and NOT a grant: `createUser` is never called here, and no entitlement, cap
// or allowance moves with it. Minting takes the caller's own account from `resolveUserId`; spending
// takes the account out of the STORE, by the hash of the code. Neither side reads a user id a
// client sent.

import { hashToken } from "../auth/tokens.ts";
import type { EngineDeps } from "./deps.ts";

/**
 * How long a code is worth typing.
 *
 * A constant rather than config: nothing about it differs between dev and prod, and the number is a
 * security parameter rather than an environment one. Five minutes is the window in which a phone
 * left unlocked on the pairing screen is worth something to somebody who picks it up — long enough
 * to walk to another machine and type eight characters, short enough that walking away ends it.
 */
export const PAIR_TTL_MS = 5 * 60_000;

/** Eight symbols. See `ALPHABET` for the arithmetic that makes eight enough. */
const PAIR_CODE_LENGTH = 8;

/**
 * Crockford base32 — the decimal digits and the alphabet minus I, L, O and U.
 *
 * The first three are the ones a person reading a code off a phone screen confuses with 1 and 0,
 * and the fourth is left out so that no code ever spells a word somebody has to read aloud.
 *
 * 32 symbols and eight of them is 40 bits. Against the per-address `auth` allowance the redemption
 * route takes — 20 an hour by default — a guesser needs on the order of 2^39 attempts, which a
 * thousand addresses working together would spend about 27 million hours on. The TTL means they
 * have five minutes.
 *
 * EXACTLY 32 IS WHAT MAKES THE DRAW UNIFORM. `byte & 31` covers 0..31 with 8 bytes mapping to each
 * value, so there is no modulo bias to reject-sample around. An alphabet of any other length here
 * would quietly weight the first few symbols.
 */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/**
 * What a code looks like after normalisation, and the only shape the store is ever asked about.
 *
 * BUILT FROM `ALPHABET`, not written out again. A hand-written `[0-9A-HJKMNP-TV-Z]{8}` is a second
 * copy of the alphabet and the length, and two things that must agree eventually will not — the
 * failure being either codes this refuses to redeem or characters it accepts and cannot mint.
 * Every symbol here is alphanumeric, so none of them needs escaping inside a class.
 */
const CODE = new RegExp(`^[${ALPHABET}]{${PAIR_CODE_LENGTH}}$`);

/**
 * Mint a code for `userId`, replacing whatever that account had.
 *
 * `userId` is the CALLER'S OWN, resolved from their bearer by the route. The store holds
 * `hashToken(code)` and never the code — the same argument `auth/tokens.ts` makes about bearer
 * tokens, and it applies more sharply here, because these eight characters are typed into a form on
 * a page anybody can reach.
 */
export async function mintPairingCode(
  deps: EngineDeps,
  userId: string,
): Promise<{ code: string; expiresAt: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(PAIR_CODE_LENGTH));
  const code = [...bytes].map((b) => ALPHABET[b & 31]!).join("");
  const expiresAt = Date.now() + PAIR_TTL_MS;
  await deps.store.putPairingCode(userId, await hashToken(code), expiresAt);
  return { code, expiresAt: new Date(expiresAt).toISOString() };
}

/**
 * Spend a code and hand back the account it named, or null.
 *
 * Null is every failure — unknown, already spent, expired, malformed — and deliberately one answer.
 * A caller that could tell them apart is an oracle for which codes are live, and every surface that
 * takes a code shows one sentence for all of them.
 *
 * A MALFORMED CODE NEVER REACHES THE STORE. Uppercasing and dropping spaces and dashes is what a
 * person typing eight characters off a screen actually produces; anything left that is not eight
 * symbols of the alphabet cannot be a code this server minted, so there is nothing to look up and
 * no hash of garbage to compute.
 */
export async function claimCode(deps: EngineDeps, raw: string): Promise<string | null> {
  const code = raw.toUpperCase().replace(/[\s-]/g, "");
  if (!CODE.test(code)) return null;
  return deps.store.claimPairingCode(await hashToken(code));
}
