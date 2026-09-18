// Bearer tokens: how one is minted, and the only form of it that is ever written down.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// THE RULE: THE DATABASE HOLDS A HASH, NEVER THE TOKEN
//
// A session token is a password that the holder did not choose and cannot change. It used to be
// stored verbatim — `insert into tokens (token, user_id)` — which meant every copy of the database
// was a file of live credentials for every account. That is not a theoretical concern here: a dump
// runs nightly by cron, is written to disk, and is rsynced off the box on purpose. Anyone who ever
// read one of those files, or the volume it sits on, would have been able to act as any user
// indefinitely, and nothing on the server would have looked wrong.
//
// Storing `sha256(token)` costs one hash per request and removes the entire class. The value the
// client holds exists in exactly two places: the phone's Keychain, and the Authorization header of
// a request in flight under TLS.
//
// NO SALT, AND NO BCRYPT. Both are for secrets a HUMAN chose — low entropy, guessable, worth
// grinding. This is 256 bits from the kernel CSPRNG, so there is no dictionary to run and no
// rainbow table to build; a per-row salt would protect against an attack that cannot be mounted,
// and a deliberately slow KDF would add its cost to every authenticated request for the same
// nothing. Fast hash, full entropy, is the right shape for this one.
// ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * A new bearer token: 256 bits from the platform CSPRNG, base64url so it survives a header, a URL
 * and a shell without escaping.
 *
 * Both stores mint through this. The in-memory one used to concatenate two `randomUUID()`s, which
 * is fine entropy and a DIFFERENT SHAPE — and demo mode is where the sign-in flows get driven, so a
 * token that looks unlike production's is a difference nobody would find until something downstream
 * cared about the length.
 */
export function newSessionToken(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
}

/** Hex SHA-256. The stored form of a token, and the only form either store ever compares. */
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * How long a token survives WITHOUT BEING USED. Not an absolute age.
 *
 * The difference is the whole design. An absolute expiry signs out the people who use the app most,
 * on a schedule, for no security benefit — the token was not more dangerous on day 181 than on day
 * 180. An idle expiry kills exactly the tokens that are worth killing: the ones on a phone that was
 * sold, lost, or restored from a backup and never opened again.
 *
 * 180 days because the alternative is worse than it sounds. A signed-in account whose token expires
 * gets a 401 at boot, and the app trades its device id for a new token — which after a merge is a
 * NEW, EMPTY account, because `engine/identity.ts` drops the anonymous device identity rather than
 * repointing it. The user's meals are not gone and signing in with Apple again restores them, but
 * for the length of that confusion the app looks like it lost everything. Six idle months is long
 * enough that essentially nobody meets it by accident.
 */
export const DEFAULT_SESSION_TTL_MS = 180 * 24 * 60 * 60 * 1000;

/**
 * How long the BROWSER's bearer survives without being used (#407).
 *
 * A different credential with a different holder, so a different number. The phone keeps its token
 * in the Keychain and is the same device for years; the web app keeps its in a closure in
 * `api.ts` that dies with the tab, and re-fills it from the `/start` session cookie on every page
 * load and after any 401. So the lifetime above buys the browser nothing it can use, and costs
 * something real: a token minted per page view, on the origin that also serves the admin, live for
 * six idle months. Every tab anybody ever opened would leave a working credential behind.
 *
 * Twelve hours is a working day. Longer than any gap inside a sitting, so nobody meets it while
 * they are looking; shorter than a night, so a bearer that leaked stops working before the next
 * one starts. Meeting it costs one POST and is invisible — that is what `api.ts`'s retry is for,
 * and it is why this can be short without being a sign-out.
 *
 * A CONSTANT, NOT CONFIGURATION, for the same reason `PAIR_TTL_MS` is one: nothing about it differs
 * between a laptop and production, and it is a security parameter rather than an environment one.
 */
export const BROWSER_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

/**
 * How stale `last_used_at` may get before a request writes it forward.
 *
 * Sliding expiry means every authenticated request could touch the row, and a write on the read
 * path of every request is a cost nobody asked for. An eighth of the lifetime is close enough:
 * a token used at any point inside 22 days never expires, and the write happens a handful of times
 * a year per device instead of on every screen.
 */
export const sessionRefreshAfterMs = (ttlMs: number): number => Math.floor(ttlMs / 8);
