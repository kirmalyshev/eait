// The web sign-in providers: an authorize URL to send a browser to, and the one network call that
// turns what comes back into an ID token.
//
// A PORT, because this is the only thing in `/start` that reaches the internet, and a surface whose
// tests cannot run without Google and Apple is a surface with no tests. Everything on the far side
// of it — the signature, issuer, audience and expiry checks, the link/merge, the profile — is the
// real implementation in `web/start.test.ts`.
//
// TWO PROVIDERS, ONE SHAPE, AND THAT IS NOT A COINCIDENCE. Both are OIDC authorization-code flows
// with a confidential client. What differs is where the client secret comes from: Google issues one
// and you keep it, Apple issues a signing key and you MINT one per request. That difference is the
// whole of `appleWebProvider` below and is invisible to the caller.
//
// WHY A CODE FLOW AT ALL. The alternative shape — `response_type=id_token` with
// `response_mode=form_post` — needs no secret and returns the token through the browser, but it
// makes the callback a CROSS-SITE POST, and a `SameSite=Lax` cookie is not sent on one. The state
// check would then have to live in a `SameSite=None` cookie. Trading a secret we already keep
// safely for a cookie weakened on every request is the wrong way round.

import { SignJWT, importPKCS8 } from "jose";
/**
 * The providers a browser can sign in with. NOT `Provider` from the contract, which also has
 * `device` — the anonymous identity every install starts with, which no web page can mint.
 */
export type WebProvider = "apple" | "google";

export interface WebSignInProvider {
  /** The `client_id` this provider authorises against — and the `aud` of the token it returns. */
  clientId: string;
  /** Where to send the browser. */
  authorizeEndpoint: string;
  /**
   * Anything this provider needs in the authorize URL beyond the six every one of them takes
   * (`client_id`, `redirect_uri`, `response_type`, `scope`, `state`, `nonce`).
   */
  extraAuthorizeParams: Record<string, string>;
  /**
   * Trade `code` for the ID token the provider minted with it.
   *
   * Throws on anything else. The caller turns that into "that sign-in didn't complete" and never
   * echoes the reason: a token endpoint's errors quote the request.
   */
  exchange(code: string, redirectUri: string): Promise<string>;
}

/** How long to wait on a provider before giving up. A hung sign-in is a hung request handler. */
const TIMEOUT_MS = 10_000;

/**
 * The shared half: POST the code, insist on an `id_token` in the answer.
 *
 * A 200 without one means the code was exchanged for something that is not an identity — an access
 * token, on a request that asked for the wrong scope.
 */
async function exchangeAt(
  endpoint: string, name: string, body: Record<string, string>,
): Promise<string> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${name} token endpoint answered ${res.status}`);
  const parsed = await res.json() as { id_token?: unknown };
  if (typeof parsed.id_token !== "string" || parsed.id_token === "") {
    throw new Error(`${name} token endpoint returned no id_token`);
  }
  return parsed.id_token;
}

const GOOGLE_AUTHORIZE = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";

export function googleWebProvider(clientId: string, clientSecret: string): WebSignInProvider {
  return {
    clientId,
    authorizeEndpoint: GOOGLE_AUTHORIZE,
    // The account chooser rather than a silent re-use: several people share a browser, and a
    // sign-up that silently picks the last Google account creates the wrong one's diary.
    extraAuthorizeParams: { prompt: "select_account" },
    exchange: (code, redirectUri) => exchangeAt(GOOGLE_TOKEN, "google", {
      code,
      client_id: clientId,
      // Google issues web clients a secret and requires it at the token endpoint, even with PKCE.
      // The native flow does not, which is why `src/mobile/lib/auth.ts` carries none.
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  };
}

const APPLE_AUTHORIZE = "https://appleid.apple.com/auth/authorize";
const APPLE_TOKEN = "https://appleid.apple.com/auth/token";
const APPLE_AUDIENCE = "https://appleid.apple.com";

/**
 * How long a minted Apple client secret lives. Apple's ceiling is six months; this is five minutes.
 *
 * It is used once, immediately, inside a request handler. A long-lived one would be a bearer
 * credential for our whole team id sitting in a variable, and the only thing it would save is an
 * ES256 signature that takes microseconds.
 */
const APPLE_SECRET_TTL_S = 300;

export interface AppleWebKey {
  /** The Service ID. This is the `client_id`, and the `aud` of the ID token that comes back. */
  serviceId: string;
  teamId: string;
  keyId: string;
  /** The `.p8` in PKCS#8 PEM, as Apple downloads it. A SECRET, and never logged. */
  privateKeyPem: string;
}

/**
 * Apple's client secret is a JWT WE SIGN, not a string Apple hands over.
 *
 * ES256 over the P-256 key from the `.p8`, `iss` the team id, `sub` the Service ID, `aud` Apple.
 * `jose` is already a dependency — it verifies every ID token this server accepts — and its ES256
 * signer emits the raw R‖S form JWS requires. `node:crypto`'s default is DER, which Apple rejects
 * with a bare `invalid_client` and no hint that the signature encoding is what is wrong.
 */
async function appleClientSecret(key: AppleWebKey): Promise<string> {
  const pk = await importPKCS8(key.privateKeyPem, "ES256");
  return await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: key.keyId })
    .setIssuer(key.teamId)
    .setSubject(key.serviceId)
    .setAudience(APPLE_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${APPLE_SECRET_TTL_S}s`)
    .sign(pk);
}

export function appleWebProvider(key: AppleWebKey): WebSignInProvider {
  return {
    clientId: key.serviceId,
    authorizeEndpoint: APPLE_AUTHORIZE,
    // `form_post`, WHICH ASKING FOR `email` OBLIGES. Apple requires it the moment `scope` contains
    // `name` or `email`, and a form POST from appleid.apple.com is cross-site — so the
    // `SameSite=Lax` state cookie is NOT sent with it, and the CSRF defence this whole surface is
    // built on would have nothing to compare against.
    //
    // What saves it is that Lax cookies ARE sent on a cross-site top-level GET. `/start` answers
    // this POST with a 303 to the same path as a GET, and the state check runs there, on a request
    // that has the cookie — see the bridge in `web/start.ts`. The alternative was a
    // `SameSite=None` state cookie, which weakens every request on this surface to buy back one.
    extraAuthorizeParams: { response_mode: "form_post" },
    exchange: async (code, redirectUri) => exchangeAt(APPLE_TOKEN, "apple", {
      code,
      client_id: key.serviceId,
      client_secret: await appleClientSecret(key),
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  };
}

/** Exported for the test that reads the minted secret's claims back. */
export const __appleClientSecret = appleClientSecret;

/**
 * Which providers this host can sign somebody in with, in the order the front door offers them.
 *
 * APPLE FIRST, for the reason the app puts it first: 4.8 obliges an equivalent privacy-preserving
 * option, and the one that asks for the least should not be the second-best-looking button.
 *
 * A provider that is not fully configured is simply ABSENT — no button, and its routes 404 with
 * everything else that does not exist. An empty record means `/start` itself does not exist.
 */
export function webProviders(config: {
  googleWebClientId: string;
  googleWebClientSecret: string;
  appleServiceId: string;
  appleTeamId: string;
  appleKeyId: string;
  applePrivateKey: string;
}): Partial<Record<WebProvider, WebSignInProvider>> {
  const out: Partial<Record<WebProvider, WebSignInProvider>> = {};
  if (config.appleServiceId !== "" && config.appleTeamId !== ""
      && config.appleKeyId !== "" && config.applePrivateKey !== "") {
    out.apple = appleWebProvider({
      serviceId: config.appleServiceId,
      teamId: config.appleTeamId,
      keyId: config.appleKeyId,
      privateKeyPem: config.applePrivateKey,
    });
  }
  if (config.googleWebClientId !== "" && config.googleWebClientSecret !== "") {
    out.google = googleWebProvider(config.googleWebClientId, config.googleWebClientSecret);
  }
  return out;
}
