// The referral code: what a friend's link carries and what both onboardings accept.
//
// Here rather than in the backend because both sides read the same input — the app and `/start`
// pre-fill the field from a pasted link, the server refuses anything that is not a code — and two
// parsers would disagree about the first link either one had not seen.

/**
 * The symbols a code is drawn from: A–Z and 2–9 without 0, O, 1 and I. A code is read off a
 * screen and typed by hand, and those are the pairs a person gets wrong. 32 symbols, so six of
 * them are about a billion codes.
 */
export const REFERRAL_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const REFERRAL_CODE_LENGTH = 6;

const CODE = new RegExp(`^[${REFERRAL_ALPHABET}]{${REFERRAL_CODE_LENGTH}}$`);

/**
 * The code in what somebody pasted or typed, uppercased, or null when there is none.
 *
 * Accepts the invite link (`https://eait.fit/r/<code>`, scheme optional, inside a shared sentence
 * too), a `/start?ref=<code>` link, and the bare code in any case with stray spaces. Never
 * corrects a symbol the alphabet does not have: an `O` typed for a `0` is a code nobody holds,
 * and guessing which one was meant would apply somebody else's.
 */
export function normalizeReferralCode(input: string): string | null {
  if (typeof input !== "string") return null;
  const linked = /[?&]ref=([^&#\s]*)/i.exec(input) ?? /\/r\/([^/?#\s]*)/i.exec(input);
  const raw = (linked ? linked[1]! : input.replace(/\s+/g, "")).toUpperCase();
  return CODE.test(raw) ? raw : null;
}
