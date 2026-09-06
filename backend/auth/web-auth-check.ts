// Whether a web sign-in can actually complete, per provider, at a given origin.
//
// IT EXISTS BECAUSE THE FIRST SYMPTOM WAS GOOGLE'S OWN ERROR PAGE. A provider that is half
// configured, or configured against an origin its console will never accept, renders a button that
// looks exactly like a working one and fails after the user has left this site. The rules below are
// the two providers' own, and they are checked here rather than discovered there:
//
//   Google accepts an `http` redirect URI only for `localhost` and `127.0.0.1`. A LAN name is
//   refused, which is why a preview reached at `http://home-ubuntu:8807` cannot sign anybody in.
//
//   Apple accepts neither: a Return URL must be https and must be a domain it can resolve, so
//   sign-in with Apple cannot work against a laptop at all without an https tunnel in front of it.
//
// The same verdicts drive three things: the front door hides a button that cannot work, `make
// auth-check` prints what to register, and a misconfigured deploy is refused rather than shipped.

import type { WebProvider } from "./web-oauth.ts";

/** The variables each provider needs, in the order a person would fill them in. */
export const WEB_AUTH_VARS: Record<WebProvider, readonly string[]> = {
  apple: [
    "EAIT__BACKEND__APPLE_SERVICE_ID",
    "EAIT__BACKEND__APPLE_TEAM_ID",
    "EAIT__BACKEND__APPLE_KEY_ID",
    "EAIT__BACKEND__APPLE_PRIVATE_KEY",
  ],
  google: [
    "EAIT__BACKEND__GOOGLE_WEB_CLIENT_ID",
    "EAIT__BACKEND__GOOGLE_WEB_CLIENT_SECRET",
  ],
};

export interface WebAuthConfig {
  appleServiceId: string;
  appleTeamId: string;
  appleKeyId: string;
  applePrivateKey: string;
  googleWebClientId: string;
  googleWebClientSecret: string;
}

export type WebAuthState =
  /** Every variable set, and this origin is one the provider will accept. */
  | "ok"
  /** Nothing set. Not a fault: a host may offer one provider and not the other. */
  | "off"
  /** Some set and some not, which renders no button and is almost always a mistake. */
  | "incomplete"
  /** Configured, but this origin cannot complete the flow. The button must not be drawn. */
  | "unusable";

export interface WebAuthVerdict {
  provider: WebProvider;
  state: WebAuthState;
  /** The variables still to set, on `incomplete`. */
  missing: string[];
  /** What to register in that provider's console for this origin. */
  callbackUrl: string;
  /** Why an `unusable` origin is unusable, in the provider's own terms. */
  reason?: string;
}

/** Loopback, which both providers treat differently from every other host. */
function isLoopback(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || hostname === "::1";
}

/**
 * One provider's verdict at one origin.
 *
 * `origin` is what the callback URL is built from — `EAIT__BACKEND__PUBLIC_API_URL` where it is
 * set, and the request's own scheme and host otherwise. Pass it and the answer is about a real
 * deployment; omit it and the answer is only about the variables.
 */
export function checkWebProvider(
  provider: WebProvider,
  config: WebAuthConfig,
  origin?: string,
): WebAuthVerdict {
  const values = provider === "apple"
    ? [config.appleServiceId, config.appleTeamId, config.appleKeyId, config.applePrivateKey]
    : [config.googleWebClientId, config.googleWebClientSecret];
  const names = WEB_AUTH_VARS[provider];
  const missing = names.filter((_, i) => values[i]!.trim() === "");
  const callbackUrl = `${(origin ?? "").replace(/\/$/, "")}/start/auth/${provider}/callback`;

  if (missing.length === names.length) return { provider, state: "off", missing, callbackUrl };
  if (missing.length > 0) return { provider, state: "incomplete", missing, callbackUrl };
  if (origin === undefined) return { provider, state: "ok", missing: [], callbackUrl };

  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return { provider, state: "unusable", missing: [], callbackUrl, reason: `${origin} is not a URL` };
  }
  const https = url.protocol === "https:";
  const loopback = isLoopback(url.hostname);

  if (provider === "apple" && !https) {
    return {
      provider, state: "unusable", missing: [], callbackUrl,
      reason: "Apple requires an https Return URL, and refuses localhost — put an https tunnel in front of this origin and point EAIT__BACKEND__PUBLIC_API_URL at it",
    };
  }
  if (provider === "apple" && loopback) {
    return {
      provider, state: "unusable", missing: [], callbackUrl,
      reason: "Apple refuses a loopback Return URL, https or not — it must be a domain Apple can resolve",
    };
  }
  if (provider === "google" && !https && !loopback) {
    return {
      provider, state: "unusable", missing: [], callbackUrl,
      reason: `Google accepts an http redirect URI only for localhost and 127.0.0.1, never for ${url.hostname} — reach this server on http://localhost:${url.port || "80"} instead`,
    };
  }
  return { provider, state: "ok", missing: [], callbackUrl };
}

/** Both providers, Apple first, in the order the sign-in page offers them. */
export function checkWebAuth(config: WebAuthConfig, origin?: string): WebAuthVerdict[] {
  return (["apple", "google"] as const).map((p) => checkWebProvider(p, config, origin));
}
