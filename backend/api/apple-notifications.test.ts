// Apple's server-to-server notifications, end to end: a real JWS, a real local JWKS, the real
// router, and the real store.
//
// The accounts in these tests are made by SIGNING IN, with tokens minted from the same key set —
// so what is asserted is what a revocation does to an account that got here the way real ones do.
//
// Two halves fail differently, as in the RevenueCat webhook. The SIGNATURE half fails loudly: a
// token this server cannot attribute to Apple is a 401 and nothing is written. The MEANING half
// fails quietly: an event about an account nobody has, or a type this server does not act on, is
// answered 200 and ignored, because a non-2xx is what makes Apple send it again all day.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { SignJWT, exportJWK, generateKeyPair, type CryptoKey } from "jose";
import { ROUTES } from "@ieat/shared";
import { configDefaults, type Config } from "../config.ts";
import { demoPorts } from "../llm/demo.ts";
import { memoryStore } from "../store.memory.ts";
import type { Store } from "../store.ts";
import type { EngineDeps } from "../engine/index.ts";
import { fakeMailer } from "../mail/fake.ts";
import { fakePush } from "../push/fake.ts";
import { remoteVerifier, type Verifier } from "../auth/verify.ts";
import { createRouter } from "./routes.ts";
import { APPLE_NOTIFICATIONS_PATH } from "./apple-notifications.ts";

const APPLE_ISS = "https://appleid.apple.com";
const APPLE_AUD = "com.eait.fit.ios";
const GOOGLE_ISS = "https://accounts.google.com";
const GOOGLE_AUD = "1234.apps.googleusercontent.com";

let privateKey: CryptoKey;
/** The key nobody published — a correctly shaped notification with a signature we cannot trust. */
let attackerKey: CryptoKey;
let server: ReturnType<typeof Bun.serve>;
let jwksUri: string;

let store: Store;
let handle: (req: Request) => Promise<Response>;

const base = (): Config => ({
  ...configDefaults(),
  port: 0, databaseUrl: "memory://test",
  llmProvider: "demo", llmModel: "demo", llmApiKey: "unused",
  globalDailyAnalysisCap: 0,
  appleAudiences: [APPLE_AUD], googleAudiences: [GOOGLE_AUD],
});

function mount(config: Config) {
  store = memoryStore();
  const verifier: Verifier = remoteVerifier({
    appleAudiences: config.appleAudiences,
    googleAudiences: config.googleAudiences,
    apple: { jwksUri, issuer: APPLE_ISS },
    google: { jwksUri, issuer: GOOGLE_ISS },
  });
  const deps: EngineDeps = { store, config, llm: demoPorts(), mailer: fakeMailer(), push: fakePush() };
  handle = createRouter(deps, store, verifier);
}

beforeAll(async () => {
  const pair = await generateKeyPair("RS256", { extractable: true });
  privateKey = pair.privateKey as CryptoKey;
  attackerKey = (await generateKeyPair("RS256", { extractable: true })).privateKey as CryptoKey;
  const jwk = await exportJWK(pair.publicKey as CryptoKey);
  server = Bun.serve({
    port: 0,
    fetch: () => Response.json({ keys: [{ ...jwk, kid: "test-key-1", alg: "RS256", use: "sig" }] }),
  });
  jwksUri = `http://127.0.0.1:${server.port}/keys`;
});

afterAll(() => server?.stop(true));

beforeEach(() => mount(base()));

/** An Apple ID token, the kind the app sends to `/v1/auth/apple`. */
const idToken = (sub: string) =>
  new SignJWT({})
    .setProtectedHeader({ alg: "RS256", kid: "test-key-1" })
    .setIssuer(APPLE_ISS).setAudience(APPLE_AUD).setSubject(sub)
    .setIssuedAt().setExpirationTime("5m").sign(privateKey);

/** A notification, the kind Apple posts. `events` is a JSON-encoded STRING unless told otherwise. */
async function notification(opts: {
  type?: string;
  sub?: string;
  events?: unknown;
  eventTime?: number | null;
  aud?: string;
  iss?: string;
  key?: CryptoKey;
  /** Apple sends NO `exp`. Setting one here is the exception, for the tests that want it. */
  expiresIn?: string;
  issuedAt?: number;
} = {}): Promise<string> {
  const events = opts.events !== undefined
    ? opts.events
    : JSON.stringify({
        type: opts.type ?? "consent-revoked",
        sub: opts.sub ?? "apple-sub",
        ...(opts.eventTime === null ? {} : { event_time: opts.eventTime ?? Date.now() }),
      });
  const jwt = new SignJWT({ events, jti: crypto.randomUUID() })
    .setProtectedHeader({ alg: "RS256", kid: "test-key-1" })
    .setIssuer(opts.iss ?? APPLE_ISS).setAudience(opts.aud ?? APPLE_AUD)
    .setIssuedAt(opts.issuedAt ?? Math.floor(Date.now() / 1000));
  return (opts.expiresIn ? jwt.setExpirationTime(opts.expiresIn) : jwt).sign(opts.key ?? privateKey);
}

const deliver = (payload: unknown, headers: Record<string, string> = {}) =>
  handle(new Request(`http://localhost${APPLE_NOTIFICATIONS_PATH}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({ payload }),
  }));

const post = (path: string, body: unknown, token?: string) =>
  handle(new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  }));

const profileStatus = async (token: string): Promise<number> =>
  (await handle(new Request(`http://localhost${ROUTES.profile}`, {
    headers: { authorization: `Bearer ${token}` },
  }))).status;

/** An account whose ONLY identity is Apple — a fresh install that signed in before anything else. */
async function appleOnlyAccount(sub: string): Promise<{ userId: string; token: string }> {
  const res = await post(ROUTES.authApple, { idToken: await idToken(sub) });
  expect(res.status).toBe(200);
  const { token, userId } = await res.json() as { token: string; userId: string };
  expect((await store.listIdentities(userId)).map((i) => i.provider)).toEqual(["apple"]);
  return { userId, token };
}

/** An account that used the app anonymously first, then linked Apple to it. */
async function deviceThenAppleAccount(sub: string): Promise<{ userId: string; token: string }> {
  const dev = await post(ROUTES.authDevice, {
    deviceId: crypto.randomUUID() + crypto.randomUUID(), locale: "en",
  });
  const { token } = await dev.json() as { token: string };
  const res = await post(ROUTES.authApple, { idToken: await idToken(sub) }, token);
  const { userId } = await res.json() as { userId: string };
  return { userId, token };
}

describe("the surface exists only when Apple could be talking to us", () => {
  it("answers 404 when no Apple audience is configured", async () => {
    // Same reason /admin and the purchase webhook answer 404: "there is an endpoint here that ends
    // sessions" is information, and with no audience there is nothing to check a token against.
    mount({ ...base(), appleAudiences: [] });
    expect((await deliver(await notification())).status).toBe(404);
  });

  it("answers 404 to anything but a POST", async () => {
    const res = await handle(new Request(`http://localhost${APPLE_NOTIFICATIONS_PATH}`));
    expect(res.status).toBe(404);
  });

  it("refuses a body larger than it will read", async () => {
    const res = await deliver(await notification(), { "content-length": String(1024 * 1024) });
    expect(res.status).toBe(413);
  });

  it("refuses one that never declared a length", async () => {
    // The route is unauthenticated and has no rate limit, so the cap cannot be a courtesy that a
    // caller opts into by being honest about the size. Nothing sets `Content-Length` here.
    const res = await deliver("x".repeat(70 * 1024));
    expect(res.status).toBe(413);
  });

  it("refuses one whose declared length is not a number", async () => {
    // `Number("xyz")` is NaN and every comparison against it is false, so a junk header used to
    // pass the check that a truthful one fails.
    const res = await deliver("x".repeat(70 * 1024), { "content-length": "xyz" });
    expect(res.status).toBe(413);
  });
});

describe("the signature is the credential", () => {
  it("rejects a notification signed by a key that is not Apple's", async () => {
    const { token } = await appleOnlyAccount("forged-sub");
    const res = await deliver(await notification({ sub: "forged-sub", key: attackerKey }));
    expect(res.status).toBe(401);
    // Nothing happened: the session is alive and the identity is still linked.
    expect(await profileStatus(token)).toBe(200);
    expect(await store.userIdForIdentity("apple", "forged-sub")).not.toBeNull();
  });

  it("rejects a notification issued by someone other than Apple", async () => {
    await appleOnlyAccount("wrong-iss-sub");
    const res = await deliver(await notification({ sub: "wrong-iss-sub", iss: "https://evil.example.com" }));
    expect(res.status).toBe(401);
    expect(await store.userIdForIdentity("apple", "wrong-iss-sub")).not.toBeNull();
  });

  it("rejects a notification minted for a different app", async () => {
    // Genuinely Apple-signed and genuinely about a real Apple user — addressed to somebody else's
    // App ID. Without the audience check this endpoint ends sessions for any Apple developer.
    await appleOnlyAccount("wrong-aud-sub");
    const res = await deliver(await notification({ sub: "wrong-aud-sub", aud: "com.someone.else" }));
    expect(res.status).toBe(401);
    expect(await store.userIdForIdentity("apple", "wrong-aud-sub")).not.toBeNull();
  });

  it("rejects a body with no payload at all", async () => {
    expect((await deliver(undefined)).status).toBe(401);
    expect((await deliver(42)).status).toBe(401);
  });

  it("never returns the reason", async () => {
    const res = await deliver(await notification({ key: attackerKey }));
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });
});

describe("consent-revoked", () => {
  it("ends every session and unlinks Apple, keeping an account that has another identity", async () => {
    const { userId, token } = await deviceThenAppleAccount("linked-sub");
    const second = await store.issueToken(userId);

    const res = await deliver(await notification({ type: "consent-revoked", sub: "linked-sub" }));
    expect(res.status).toBe(200);

    // Signed out everywhere, not just on the device that noticed.
    expect(await profileStatus(token)).toBe(401);
    expect(await store.userIdForToken(second)).toBeNull();
    // Apple is gone, the account and its device identity are not.
    expect(await store.userIdForIdentity("apple", "linked-sub")).toBeNull();
    expect((await store.listIdentities(userId)).map((i) => i.provider)).toEqual(["device"]);
    expect(await store.getProfile(userId)).not.toBeNull();
  });

  it("deletes an account whose only identity was Apple", async () => {
    // Nobody can ever reach this account again — there is no second way in. Keeping it would be
    // holding a person's medical free text with no basis and no route to erasure.
    const { userId, token } = await appleOnlyAccount("only-apple-sub");

    expect((await deliver(await notification({ sub: "only-apple-sub" }))).status).toBe(200);

    expect(await store.getProfile(userId)).toBeNull();
    expect(await profileStatus(token)).toBe(401);
    expect(await store.userIdForIdentity("apple", "only-apple-sub")).toBeNull();
  });

  it("answers the same thing when Apple sends it twice", async () => {
    // Apple retries, and a retry must not be an error — the second delivery finds nothing to do.
    await appleOnlyAccount("twice-sub");
    const first = await deliver(await notification({ sub: "twice-sub" }));
    const second = await deliver(await notification({ sub: "twice-sub" }));
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ ok: true });
  });

  it("answers 200 for a subject this server has never seen", async () => {
    const res = await deliver(await notification({ sub: "nobody-here" }));
    expect(res.status).toBe(200);
  });
});

describe("account-delete", () => {
  it("is treated exactly like a revocation", async () => {
    // The user deleted their Apple Account. The consequence for us is identical: the identity can
    // never authenticate again, so it goes, and so does the account if nothing else remains.
    const { userId: alone } = await appleOnlyAccount("deleted-alone");
    const { userId: linked } = await deviceThenAppleAccount("deleted-linked");

    expect((await deliver(await notification({ type: "account-delete", sub: "deleted-alone" }))).status).toBe(200);
    expect((await deliver(await notification({ type: "account-delete", sub: "deleted-linked" }))).status).toBe(200);

    expect(await store.getProfile(alone)).toBeNull();
    expect(await store.getProfile(linked)).not.toBeNull();
    expect((await store.listIdentities(linked)).map((i) => i.provider)).toEqual(["device"]);
  });
});

describe("the events this server does not act on", () => {
  it("ignores email-disabled and email-enabled", async () => {
    // No provider email is ever requested or stored (`requestedScopes: []`), so there is nothing
    // these could update. They are acknowledged rather than refused, or Apple keeps sending them.
    const { userId, token } = await appleOnlyAccount("email-sub");

    for (const type of ["email-disabled", "email-enabled"]) {
      const res = await deliver(await notification({ type, sub: "email-sub" }));
      expect(res.status).toBe(200);
    }

    expect(await profileStatus(token)).toBe(200);
    expect(await store.userIdForIdentity("apple", "email-sub")).toBe(userId);
  });

  it("ignores a type it has never heard of", async () => {
    const { token } = await appleOnlyAccount("future-sub");
    expect((await deliver(await notification({ type: "something-new", sub: "future-sub" }))).status).toBe(200);
    expect(await profileStatus(token)).toBe(200);
  });
});

describe("an events claim this server cannot read", () => {
  it("acknowledges an events claim sent as an object rather than a JSON string", async () => {
    // Apple documents `events` as a JSON-ENCODED STRING. An object is a message we cannot act on,
    // and it will not parse any differently on the fourth attempt — so it is acknowledged, not
    // refused. The signature was Apple's; only the shape was not.
    const { token } = await appleOnlyAccount("object-events-sub");
    const res = await deliver(await notification({
      events: { type: "consent-revoked", sub: "object-events-sub" },
    }));
    expect(res.status).toBe(200);
    expect(await profileStatus(token)).toBe(200);
    expect(await store.userIdForIdentity("apple", "object-events-sub")).not.toBeNull();
  });

  it("acknowledges an events string that is not JSON, and one with no subject", async () => {
    const { token } = await appleOnlyAccount("no-sub-sub");
    expect((await deliver(await notification({ events: "not json at all" }))).status).toBe(200);
    expect((await deliver(await notification({ events: JSON.stringify({ type: "consent-revoked" }) }))).status).toBe(200);
    expect(await profileStatus(token)).toBe(200);
  });
});

describe("what the app meets on its next launch", () => {
  // The app has no code for this and needs none: a revoked session is an ordinary dead token. Boot
  // reads the profile, catches the 401, and trades the device id it still holds for a fresh token
  // (`src/mobile/app/_layout.tsx`). What that lands in is the only open question, and it has two
  // answers — so both are exercised here rather than reasoned about.

  const bootRecovery = async (deviceId: string) => {
    const res = await post(ROUTES.authDevice, { deviceId, locale: "en" });
    expect(res.status).toBe(200);
    const { token } = await res.json() as { token: string };
    return { token, profile: await profileStatus(token) };
  };

  it("lands back in the same account when the device identity survived", async () => {
    const deviceId = crypto.randomUUID() + crypto.randomUUID();
    const dev = await post(ROUTES.authDevice, { deviceId, locale: "en" });
    const { token: before, userId } = await dev.json() as { token: string; userId: string };
    await post(ROUTES.authApple, { idToken: await idToken("recover-linked") }, before);

    await deliver(await notification({ sub: "recover-linked" }));

    expect(await profileStatus(before)).toBe(401);
    const after = await bootRecovery(deviceId);
    expect(after.profile).toBe(200);
    // Same account, all of it still there — signed out of Apple, not erased.
    expect(await store.userIdForToken(after.token)).toBe(userId);
  });

  it("lands in a new empty account when the account was deleted", async () => {
    const { userId, token } = await appleOnlyAccount("recover-deleted");
    await deliver(await notification({ sub: "recover-deleted" }));

    expect(await profileStatus(token)).toBe(401);
    const after = await bootRecovery(crypto.randomUUID() + crypto.randomUUID());
    // A fresh account, at onboarding. Not a crash, and not a token refresh that can never win.
    expect(after.profile).toBe(200);
    expect(await store.userIdForToken(after.token)).not.toBe(userId);
  });
});

describe("the token Apple actually sends", () => {
  it("is accepted with no expiry claim at all", async () => {
    // Apple's notification carries iss, aud, iat, jti and events — and no `exp`. Every other test
    // in this file used to mint one, which is exactly how a suite can be green about a token shape
    // that never arrives.
    const { userId } = await appleOnlyAccount("no-exp");
    expect((await deliver(await notification({ sub: "no-exp" }))).status).toBe(200);
    expect(await store.getProfile(userId)).toBeNull();
  });

  it("is refused once its issued-at is older than the link it names", async () => {
    // The same message, redelivered after the user re-granted consent. Applying it would tear down
    // the fresh link; on this account it would erase everything logged since.
    const { userId, token } = await appleOnlyAccount("replayed");
    const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000;

    const res = await deliver(await notification({ sub: "replayed", eventTime: twoDaysAgo }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(await store.getProfile(userId)).not.toBeNull();
    expect(await profileStatus(token)).toBe(200);
    expect(await store.userIdForIdentity("apple", "replayed")).toBe(userId);
  });

  it("still applies when no event_time is sent, rather than being ignored", async () => {
    const { userId } = await appleOnlyAccount("timeless");
    expect((await deliver(await notification({ sub: "timeless", eventTime: null }))).status).toBe(200);
    expect(await store.getProfile(userId)).toBeNull();
  });

  it("still applies when event_time looks like seconds rather than milliseconds", async () => {
    // Reading seconds as milliseconds would date every event to 1970 and silently ignore every
    // revocation. A value that cannot be epoch milliseconds is no time at all, which means apply.
    const { userId } = await appleOnlyAccount("seconds");
    const asSeconds = Math.floor(Date.now() / 1000);
    expect((await deliver(await notification({ sub: "seconds", eventTime: asSeconds }))).status).toBe(200);
    expect(await store.getProfile(userId)).toBeNull();
  });
});
