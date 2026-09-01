// ID-token verification for Sign in with Apple and Google Sign-In.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// THE ONE RULE: the subject comes out of a SIGNATURE-VERIFIED token, never out of the request.
//
// A client that can name its own user id can name anyone's. Everything below exists to make the
// subject trustworthy: the signature is checked against the provider's published keys, the issuer
// must be the provider, the audience must be OUR client id (a token minted for a different app is
// a valid token and an invalid login), and expiry is enforced.
//
// Audience checking is the one people skip, and it is the one that matters most: without it,
// anybody who can get a user to sign into THEIR app can replay that token here and become them.
// ─────────────────────────────────────────────────────────────────────────────────────────────

import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import type { Provider } from "@eait/shared";

/** A verified identity. Deliberately just the subject — see the note on email below. */
export interface VerifiedIdentity {
  provider: Provider;
  /** The provider's stable, per-app user identifier (`sub`). This is the whole account key. */
  subject: string;
}

/**
 * The port the engine depends on. Injected, so the tests exercise the link/merge logic against a
 * fake verifier and never touch the network — the same reason `LlmPorts` is a port.
 */
export interface IdentityVerifier {
  verify(provider: "apple" | "google", idToken: string, nonce?: string): Promise<VerifiedIdentity>;
}

/**
 * The other thing Apple signs: the server-to-server notification.
 *
 * A separate port from `IdentityVerifier` because the engine's sign-in path must not depend on it
 * — nothing about linking accounts needs to know this endpoint exists.
 */
export interface AppleNotificationVerifier {
  /**
   * Check that Apple signed this notification, and return its `events` claim UNREAD.
   *
   * Unread is the point. This function answers one question — did Apple sign this, for us — and
   * the shape of what is inside is the caller's problem. A verifier that also refused unfamiliar
   * events would answer 401 to a message that genuinely was Apple's, and a non-2xx is what makes
   * Apple retry it all day.
   *
   * There is no `sub` at the top level of these tokens, so the checks below are the ONLY thing
   * standing between this endpoint and any Apple developer ending any of our users' sessions.
   */
  verifyAppleNotification(payloadJws: string): Promise<unknown>;
}

/** Everything the HTTP layer needs from a verifier. The real one does both. */
export interface Verifier extends IdentityVerifier, AppleNotificationVerifier {}

export class AuthError extends Error {
  constructor(readonly reason: string) {
    super(reason);
    this.name = "AuthError";
  }
}

const APPLE_JWKS = "https://appleid.apple.com/auth/keys";
const GOOGLE_JWKS = "https://www.googleapis.com/oauth2/v3/certs";

const APPLE_ISSUER = "https://appleid.apple.com";
// Google has historically minted both spellings, and both are legitimate.
const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

export interface VerifierConfig {
  /** Every audience an Apple token may legitimately carry: the iOS bundle id, plus any Service ID. */
  appleAudiences: string[];
  /** Every Google OAuth client id that may sign in: iOS, web, Android. */
  googleAudiences: string[];
  /**
   * JWKS endpoints and expected issuers. Defaulted to the real providers; overridable ONLY so the
   * tests can point this at a local key set.
   *
   * That override exists because the alternative is a security boundary with no test on it. A fake
   * verifier proves the link/merge logic and nothing about signature, issuer, audience or expiry
   * checking — which is the half that decides whether a stranger can become you.
   */
  apple?: { jwksUri: string; issuer: string };
  google?: { jwksUri: string; issuer: string | string[] };
}

/** Hex SHA-256, for the Apple nonce comparison. */
async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function remoteVerifier(config: VerifierConfig): Verifier {
  const appleCfg = config.apple ?? { jwksUri: APPLE_JWKS, issuer: APPLE_ISSUER };
  const googleCfg = config.google ?? { jwksUri: GOOGLE_JWKS, issuer: GOOGLE_ISSUERS };

  // Built once. `createRemoteJWKSet` caches keys and refetches on an unknown `kid`, which is what
  // makes provider key rotation a non-event instead of a global outage.
  const apple = createRemoteJWKSet(new URL(appleCfg.jwksUri));
  const google = createRemoteJWKSet(new URL(googleCfg.jwksUri));

  return {
    async verify(provider, idToken, nonce) {
      if (!idToken || typeof idToken !== "string") throw new AuthError("missing-token");

      const audiences = provider === "apple" ? config.appleAudiences : config.googleAudiences;
      if (audiences.length === 0) {
        // A misconfigured audience list must be a loud failure. Verifying without an audience
        // check would "work" in testing and accept tokens minted for any app in production.
        throw new AuthError(`${provider}-not-configured`);
      }

      let payload: JWTPayload;
      try {
        ({ payload } = await jwtVerify(
          idToken,
          provider === "apple" ? apple : google,
          {
            issuer: provider === "apple" ? appleCfg.issuer : googleCfg.issuer,
            audience: audiences,
            // jose enforces `exp`, and clock skew is bounded rather than ignored.
            clockTolerance: 30,
          },
        ));
      } catch (e) {
        // The provider's message is logged by the caller, never returned: it can echo the token.
        throw new AuthError(`${provider}-token-invalid`);
      }

      const subject = payload.sub;
      if (typeof subject !== "string" || subject === "") throw new AuthError("no-subject");

      // Apple only: `email_verified` and `email` are deliberately ignored. See below.
      if (nonce !== undefined) {
        const claimed = payload.nonce;
        if (typeof claimed !== "string") throw new AuthError("nonce-missing");
        // Native Sign in with Apple puts the SHA-256 of the nonce in the token; the web flow and
        // Google put the raw value. Accepting either is correct rather than lax — the check that
        // matters is that it corresponds to the nonce THIS client just generated.
        if (claimed !== nonce && claimed !== (await sha256Hex(nonce))) {
          throw new AuthError("nonce-mismatch");
        }
      }

      return { provider, subject };
    },

    async verifyAppleNotification(payloadJws) {
      if (!payloadJws || typeof payloadJws !== "string") throw new AuthError("missing-token");
      // Same rule as sign-in: an unconfigured audience list is OFF, not permissive.
      if (config.appleAudiences.length === 0) throw new AuthError("apple-not-configured");

      let payload: JWTPayload;
      try {
        ({ payload } = await jwtVerify(payloadJws, apple, {
          issuer: appleCfg.issuer,
          // The PRIMARY App ID. A Service ID in this list is harmless and a wrong id here is an
          // endpoint that accepts another developer's notifications about their own users.
          audience: config.appleAudiences,
          clockTolerance: 30,
        }));
      } catch (e) {
        throw new AuthError("apple-notification-invalid");
      }

      // NOTHING HERE BOUNDS THE TOKEN'S AGE, and that is not an oversight to fix with a flag.
      // Apple sends `iss`, `aud`, `iat`, `jti` and `events` — no `exp` — so jose has no expiry to
      // enforce, and `maxTokenAge` would make every notification depend on `iat` being present and
      // on this server's clock: get either wrong and every revocation is refused, silently, which
      // is the failure this endpoint exists to prevent. A late delivery is Apple's normal
      // behaviour. What makes an OLD one harmless is the ordering rule in `revokeAppleIdentity`:
      // an event that predates the link it names does nothing.

      return payload.events;
    },
  };
}

/**
 * NO EMAIL IS STORED, from either provider.
 *
 * Apple sends the email only on first authorization (and often a private relay address); Google
 * sends it every time. We take neither. The provider `sub` is a stable per-app key and is all an
 * account needs — signing in with the same Apple ID or Google account restores the account, which
 * is the only thing an email would have been for.
 *
 * Not storing it means there is no email to leak, no email to keep lawful, and nothing to explain
 * in a privacy policy. That is consistent with a product whose other headline property is that it
 * never keeps your photographs.
 */
