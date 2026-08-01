// Tests for the REAL verifier — jose, a real RSA key pair, a real JWKS served over HTTP, real
// signature/issuer/audience/expiry checking.
//
// This file exists because the router tests use a fake verifier. A fake proves the link/merge logic
// and NOTHING about the half that decides whether a stranger can become you. Every assertion below
// is a way an attacker gets in if the check is missing.

import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { SignJWT, exportJWK, generateKeyPair, type CryptoKey } from "jose";
import { AuthError, remoteVerifier, type IdentityVerifier } from "./verify.ts";

const APPLE_ISS = "https://appleid.apple.com";
const GOOGLE_ISS = "https://accounts.google.com";
const APPLE_AUD = "app.ieat";
const GOOGLE_AUD = "1234.apps.googleusercontent.com";

let privateKey: CryptoKey;
/** The key pair nobody published — used to forge a correctly-shaped token with a bad signature. */
let attackerKey: CryptoKey;
let server: ReturnType<typeof Bun.serve>;
let verifier: IdentityVerifier;

/** Mint a token. Every parameter is a knob an attacker would want to turn. */
async function token(opts: {
  sub?: string;
  aud?: string;
  iss?: string;
  nonce?: string;
  expiresIn?: string;
  key?: CryptoKey;
  kid?: string;
} = {}): Promise<string> {
  return new SignJWT({ ...(opts.nonce !== undefined ? { nonce: opts.nonce } : {}) })
    .setProtectedHeader({ alg: "RS256", kid: opts.kid ?? "test-key-1" })
    .setIssuer(opts.iss ?? APPLE_ISS)
    .setAudience(opts.aud ?? APPLE_AUD)
    .setSubject(opts.sub ?? "sub-123")
    .setIssuedAt()
    .setExpirationTime(opts.expiresIn ?? "5m")
    .sign(opts.key ?? privateKey);
}

/** SHA-256 hex, mirroring what native Sign in with Apple puts in the nonce claim. */
async function sha256Hex(input: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

beforeAll(async () => {
  ({ privateKey } = await generateKeyPair("RS256", { extractable: true }) as { privateKey: CryptoKey; publicKey: CryptoKey });
  const pair = await generateKeyPair("RS256", { extractable: true });
  privateKey = pair.privateKey as CryptoKey;
  attackerKey = (await generateKeyPair("RS256", { extractable: true })).privateKey as CryptoKey;

  const jwk = await exportJWK(pair.publicKey as CryptoKey);
  // A real JWKS endpoint, served locally. jose fetches this over HTTP exactly as it would fetch
  // Apple's — the code path under test is the shipping one, not a stub.
  server = Bun.serve({
    port: 0,
    fetch: () => Response.json({ keys: [{ ...jwk, kid: "test-key-1", alg: "RS256", use: "sig" }] }),
  });

  const jwksUri = `http://127.0.0.1:${server.port}/keys`;
  verifier = remoteVerifier({
    appleAudiences: [APPLE_AUD],
    googleAudiences: [GOOGLE_AUD],
    apple: { jwksUri, issuer: APPLE_ISS },
    google: { jwksUri, issuer: GOOGLE_ISS },
  });
});

afterAll(() => server?.stop(true));

describe("the happy path", () => {
  it("accepts a properly signed Apple token and returns its subject", async () => {
    const result = await verifier.verify("apple", await token({ sub: "apple-user-1" }));
    expect(result).toEqual({ provider: "apple", subject: "apple-user-1" });
  });

  it("accepts a properly signed Google token", async () => {
    const t = await token({ iss: GOOGLE_ISS, aud: GOOGLE_AUD, sub: "google-user-1" });
    expect(await verifier.verify("google", t)).toEqual({ provider: "google", subject: "google-user-1" });
  });
});

describe("signature", () => {
  it("rejects a token signed by a key that is not in the JWKS", async () => {
    // Correct issuer, correct audience, correct shape, wrong signer. This is the whole attack.
    const forged = await token({ sub: "victim", key: attackerKey });
    expect(verifier.verify("apple", forged)).rejects.toThrow(AuthError);
  });

  it("rejects a token whose kid is not published", async () => {
    expect(verifier.verify("apple", await token({ kid: "not-a-real-kid" }))).rejects.toThrow(AuthError);
  });

  it("rejects a structurally invalid token", async () => {
    expect(verifier.verify("apple", "not.a.jwt")).rejects.toThrow(AuthError);
    expect(verifier.verify("apple", "")).rejects.toThrow(AuthError);
  });

  it("rejects an unsigned (alg:none) token", async () => {
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const body = Buffer.from(JSON.stringify({
      sub: "victim", aud: APPLE_AUD, iss: APPLE_ISS, exp: Math.floor(Date.now() / 1000) + 300,
    })).toString("base64url");
    expect(verifier.verify("apple", `${header}.${body}.`)).rejects.toThrow(AuthError);
  });
});

describe("audience — the check that gets skipped", () => {
  it("rejects a VALID token minted for a different app", async () => {
    // The reason audience checking matters: this token is genuinely signed by Apple and genuinely
    // belongs to this user. Without the audience check, anyone who can get a user to sign into
    // THEIR app can replay that token here and become them.
    const other = await token({ sub: "victim", aud: "com.someone.else" });
    expect(verifier.verify("apple", other)).rejects.toThrow(AuthError);
  });

  it("refuses outright when no audience is configured, rather than verifying without one", async () => {
    const unconfigured = remoteVerifier({
      appleAudiences: [], googleAudiences: [],
      apple: { jwksUri: `http://127.0.0.1:${server.port}/keys`, issuer: APPLE_ISS },
      google: { jwksUri: `http://127.0.0.1:${server.port}/keys`, issuer: GOOGLE_ISS },
    });
    // A perfectly good token still fails: an unconfigured verifier is off, not permissive.
    expect(unconfigured.verify("apple", await token())).rejects.toThrow(/not-configured/);
  });

  it("accepts any audience in the configured list", async () => {
    const multi = remoteVerifier({
      appleAudiences: ["app.ieat", "app.ieat.service"], googleAudiences: [GOOGLE_AUD],
      apple: { jwksUri: `http://127.0.0.1:${server.port}/keys`, issuer: APPLE_ISS },
      google: { jwksUri: `http://127.0.0.1:${server.port}/keys`, issuer: GOOGLE_ISS },
    });
    const t = await token({ aud: "app.ieat.service", sub: "s" });
    expect((await multi.verify("apple", t)).subject).toBe("s");
  });
});

describe("issuer", () => {
  it("rejects a token issued by someone other than the provider", async () => {
    const evil = await token({ iss: "https://evil.example.com" });
    expect(verifier.verify("apple", evil)).rejects.toThrow(AuthError);
  });

  it("does not accept a Google-issued token at the Apple endpoint", async () => {
    // Cross-provider replay: the audiences differ too, but issuer alone must stop it.
    const g = await token({ iss: GOOGLE_ISS, aud: GOOGLE_AUD });
    expect(verifier.verify("apple", g)).rejects.toThrow(AuthError);
  });

  it("accepts either spelling Google has historically used", async () => {
    const bothSpellings = remoteVerifier({
      appleAudiences: [APPLE_AUD], googleAudiences: [GOOGLE_AUD],
      apple: { jwksUri: `http://127.0.0.1:${server.port}/keys`, issuer: APPLE_ISS },
      google: {
        jwksUri: `http://127.0.0.1:${server.port}/keys`,
        issuer: ["https://accounts.google.com", "accounts.google.com"],
      },
    });
    const bare = await token({ iss: "accounts.google.com", aud: GOOGLE_AUD, sub: "g" });
    expect((await bothSpellings.verify("google", bare)).subject).toBe("g");
  });
});

describe("expiry", () => {
  it("rejects an expired token", async () => {
    expect(verifier.verify("apple", await token({ expiresIn: "-1h" }))).rejects.toThrow(AuthError);
  });

  it("tolerates small clock skew rather than failing a valid login", async () => {
    // 30s tolerance is configured; a token that expired 10s ago still passes.
    expect((await verifier.verify("apple", await token({ expiresIn: "-10s" }))).subject).toBe("sub-123");
  });
});

describe("nonce", () => {
  it("accepts the raw nonce echoed back", async () => {
    const t = await token({ nonce: "abc123" });
    expect((await verifier.verify("apple", t, "abc123")).subject).toBe("sub-123");
  });

  it("accepts the SHA-256 of the nonce — what native Sign in with Apple actually sends", async () => {
    // Both forms are accepted deliberately: the native and web flows disagree about which lands in
    // the claim, and being wrong about it silently breaks every sign-in.
    const t = await token({ nonce: await sha256Hex("abc123") });
    expect((await verifier.verify("apple", t, "abc123")).subject).toBe("sub-123");
  });

  it("rejects a replayed token whose nonce is not the one this client generated", async () => {
    const t = await token({ nonce: "somebody-elses-nonce" });
    expect(verifier.verify("apple", t, "my-nonce")).rejects.toThrow(/nonce-mismatch/);
  });

  it("rejects a token with no nonce when one was expected", async () => {
    expect(verifier.verify("apple", await token(), "my-nonce")).rejects.toThrow(/nonce-missing/);
  });

  it("skips the check when the client did not use a nonce", async () => {
    expect((await verifier.verify("apple", await token())).subject).toBe("sub-123");
  });
});

describe("subject", () => {
  it("rejects a token with an empty subject", async () => {
    const t = await new SignJWT({})
      .setProtectedHeader({ alg: "RS256", kid: "test-key-1" })
      .setIssuer(APPLE_ISS).setAudience(APPLE_AUD).setSubject("")
      .setIssuedAt().setExpirationTime("5m").sign(privateKey);
    expect(verifier.verify("apple", t)).rejects.toThrow(AuthError);
  });

  it("never leaks the token or the provider's message in the error", async () => {
    const forged = await token({ sub: "victim", key: attackerKey });
    try {
      await verifier.verify("apple", forged);
      throw new Error("should have rejected");
    } catch (e) {
      expect(e).toBeInstanceOf(AuthError);
      expect((e as AuthError).reason).toBe("apple-token-invalid");
      expect((e as AuthError).message).not.toContain(forged.slice(0, 20));
    }
  });
});
