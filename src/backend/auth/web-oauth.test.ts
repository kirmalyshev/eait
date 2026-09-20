// The web sign-in providers: which ones a config yields, where they send a browser, and — the part
// with no second implementation anywhere — the Apple client secret this server mints for itself.

import { describe, expect, it } from "bun:test";
import { decodeJwt, decodeProtectedHeader, exportPKCS8, generateKeyPair, jwtVerify } from "jose";
import { PKCS8_BEGIN, PKCS8_END, configDefaults } from "../config.ts";
import {
  __appleClientSecret, appleWebProvider, googleWebProvider, webProviders,
} from "./web-oauth.ts";

const GOOGLE = { id: "web.apps.googleusercontent.com", secret: "google-secret" };
const APPLE = { serviceId: "fit.eait.web", teamId: "TEAM123456", keyId: "KEY1234567" };
/** The same three under the names `Config` gives them. */
const APPLE_CONFIG = {
  appleServiceId: APPLE.serviceId, appleTeamId: APPLE.teamId, appleKeyId: APPLE.keyId,
};

/** A real P-256 key, generated per run. Nothing here reads a committed one. */
async function appleKey() {
  const { privateKey, publicKey } = await generateKeyPair("ES256", { extractable: true });
  return { pem: await exportPKCS8(privateKey), publicKey };
}

describe("which providers a host offers", () => {
  const base = {
    ...configDefaults(),
    googleWebClientId: "", googleWebClientSecret: "",
    appleServiceId: "", appleTeamId: "", appleKeyId: "", applePrivateKey: "",
  };

  it("offers nothing when nothing is configured, which is what makes /start not exist", () => {
    expect(Object.keys(webProviders(base))).toEqual([]);
  });

  it("offers each one independently", () => {
    expect(Object.keys(webProviders({
      ...base, googleWebClientId: GOOGLE.id, googleWebClientSecret: GOOGLE.secret,
    }))).toEqual(["google"]);
    expect(Object.keys(webProviders({
      ...base, ...APPLE_CONFIG, applePrivateKey: "pem",
    }))).toEqual(["apple"]);
  });

  it("puts Apple first when both are configured", () => {
    // The record's key order is the button order on the front door, so this is not cosmetic.
    expect(Object.keys(webProviders({
      ...base, ...APPLE_CONFIG, applePrivateKey: "pem",
      googleWebClientId: GOOGLE.id, googleWebClientSecret: GOOGLE.secret,
    }))).toEqual(["apple", "google"]);
  });

  it("drops a provider that is only half configured rather than half offering it", () => {
    // `loadConfig` refuses to boot in this state; this is the second line of defence, because a
    // half-configured provider is a button that fails after somebody has chosen their account.
    expect(Object.keys(webProviders({ ...base, googleWebClientId: GOOGLE.id }))).toEqual([]);
    expect(Object.keys(webProviders({ ...base, ...APPLE_CONFIG }))).toEqual([]);
    expect(Object.keys(webProviders({
      ...base, appleServiceId: APPLE.serviceId, applePrivateKey: "pem",
    }))).toEqual([]);
  });
});

describe("where each one sends a browser", () => {
  it("names the real endpoints", () => {
    expect(googleWebProvider(GOOGLE.id, GOOGLE.secret).authorizeEndpoint)
      .toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(appleWebProvider({ ...APPLE, privateKeyPem: "pem" }).authorizeEndpoint)
      .toBe("https://appleid.apple.com/auth/authorize");
  });

  it("asks Google for the account chooser and Apple for a form_post callback", () => {
    // Apple's extras are EMPTY on purpose: `response_mode` is the one that matters, and it must
    // stay unset. Apple requires `form_post` the moment a scope is requested, and a cross-site POST
    // carries no SameSite=Lax cookie — which is the state check this surface is built on.
    expect(googleWebProvider(GOOGLE.id, GOOGLE.secret).extraAuthorizeParams)
      .toEqual({ prompt: "select_account" });
    // Apple REQUIRES `form_post` the moment the scope contains `email`, and the callback route
    // bridges that POST back to a GET so the Lax state cookie is still what guards it.
    expect(appleWebProvider({ ...APPLE, privateKeyPem: "pem" }).extraAuthorizeParams)
      .toEqual({ response_mode: "form_post" });
  });

  it("uses the Service ID as Apple's client id, which is also the aud it will verify", () => {
    expect(appleWebProvider({ ...APPLE, privateKeyPem: "pem" }).clientId).toBe(APPLE.serviceId);
  });
});

describe("the Apple client secret, which this server mints for itself", () => {
  it("carries the claims Apple checks, signed ES256 by the .p8", async () => {
    const { pem, publicKey } = await appleKey();
    const jwt = await __appleClientSecret({ ...APPLE, privateKeyPem: pem });

    // Verified against the public half rather than merely decoded: a secret Apple cannot verify is
    // a bare `invalid_client` with nothing in it that names the signature as the problem.
    const { payload } = await jwtVerify(jwt, publicKey, {
      issuer: APPLE.teamId, audience: "https://appleid.apple.com",
    });
    expect(payload.sub).toBe(APPLE.serviceId);

    const header = decodeProtectedHeader(jwt);
    expect(header.alg).toBe("ES256");
    // The `kid` is how Apple picks which of your keys to check it with. Without it, every exchange
    // fails on a correctly signed secret.
    expect(header.kid).toBe(APPLE.keyId);
  });

  it("expires in minutes, not in Apple's six months", async () => {
    const { pem } = await appleKey();
    const { iat, exp } = decodeJwt(await __appleClientSecret({ ...APPLE, privateKeyPem: pem }));
    // Used once, immediately, inside a request handler. A long-lived one would be a bearer
    // credential for the whole team id sitting in a variable, and it would save microseconds.
    expect(exp! - iat!).toBe(300);
  });

  it("is minted per exchange, so two are never the same token", async () => {
    const { pem } = await appleKey();
    const key = { ...APPLE, privateKeyPem: pem };
    const [a, b] = await Promise.all([__appleClientSecret(key), __appleClientSecret(key)]);
    // ECDSA is randomized, so even two secrets minted in the same second differ. What this asserts
    // is that nothing is memoised across calls.
    expect(a).not.toBe(b);
  });

  it("refuses a key that is not a P-256 private key rather than signing with something else", async () => {
    await expect(__appleClientSecret({ ...APPLE, privateKeyPem: `${PKCS8_BEGIN}\nnope\n${PKCS8_END}` }))
      .rejects.toThrow();
  });
});
