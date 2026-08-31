// The one network call the web sign-in makes: an authorization code for an ID token.
//
// A PORT, because it is the only thing in `/start` that reaches the internet, and a surface whose
// tests cannot run without Google is a surface with no tests. Everything on the far side of it —
// the signature, issuer, audience and expiry checks, the link/merge, the profile — is the real
// implementation in `web/start.test.ts`.
//
// WHY A SECRET AT ALL. Google issues web clients a secret and requires it at the token endpoint,
// even with PKCE; the native flow this repository also has does not, which is why `lib/auth.ts`
// carries none. The alternative shape — `response_type=id_token` with `response_mode=form_post` —
// needs no secret and returns the token through the browser, but it makes the callback a
// CROSS-SITE POST, and a `SameSite=Lax` cookie is not sent on one. The state check would then have
// to live in a `SameSite=None` cookie. Trading a secret we already keep safely for a cookie
// weakened on every request is the wrong way round.

export interface GoogleCodeExchange {
  /**
   * Trade `code` for the ID token Google minted with it.
   *
   * Throws on anything else. The caller turns that into "that sign-in didn't complete" and never
   * echoes the reason: the token endpoint's errors quote the request.
   */
  exchange(code: string, redirectUri: string): Promise<string>;
}

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

/** How long to wait on Google before giving up. A hung sign-in is a hung request handler. */
const TIMEOUT_MS = 10_000;

export function googleCodeExchange(clientId: string, clientSecret: string): GoogleCodeExchange {
  return {
    async exchange(code, redirectUri) {
      const res = await fetch(TOKEN_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }).toString(),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`google token endpoint answered ${res.status}`);
      const body = await res.json() as { id_token?: unknown };
      // A 200 without an `id_token` means the code was exchanged for something that is not an
      // identity — an access token, on a request that asked for the wrong scope.
      if (typeof body.id_token !== "string" || body.id_token === "") {
        throw new Error("google token endpoint returned no id_token");
      }
      return body.id_token;
    },
  };
}
