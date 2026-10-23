// The Android Apple return hop's allowlist and App Link (ieat-app#2434). The routes themselves
// were eait#714's; what is asserted here is the boundary #2434 added: a scheme is admitted only
// when it is CONFIGURED, and `https` only while this host certifies an App Link.

import { describe, expect, it } from "bun:test";
import { ROUTES } from "@eait/shared";
import { configDefaults, type Config } from "../config.ts";
import { demoPorts } from "../llm/demo.ts";
import { memoryStore } from "../store.memory.ts";
import type { WebSignInProvider } from "../auth/web-oauth.ts";
import { AuthError, type Verifier } from "../auth/verify.ts";
import { createRouter } from "./routes.ts";
import { fakePush } from "../push/fake.ts";
import { logMail } from "../mail/log.ts";

const APPLE: WebSignInProvider = {
  clientId: "fit.eait.services",
  authorizeEndpoint: "https://appleid.apple.com/auth/authorize",
  extraAuthorizeParams: {},
  async exchange() { throw new Error("never exchanged"); },
};

const testVerifier: Verifier = {
  async verify() { throw new AuthError("not-in-these-tests"); },
  async verifyAppleNotification() { throw new AuthError("not-in-these-tests"); },
};

const FINGERPRINT = `${"AB:".repeat(31)}CD`;

const CONFIG: Config = {
  ...configDefaults(),
  port: 0, databaseUrl: "memory://test",
  llmProvider: "demo", llmModel: "demo", llmApiKey: "unused",
  publicApiUrl: "https://api.eait.fit",
  androidAppSchemes: ["eait"],
  androidPackage: "com.eait.fit",
  androidCertFingerprints: [FINGERPRINT],
};

function router(config: Partial<Config> = {}) {
  const store = memoryStore();
  const c = { ...CONFIG, ...config };
  const handle = createRouter(
    { store, config: c, llm: demoPorts(), push: fakePush(), mail: logMail() },
    store, testVerifier, { webProviders: { apple: APPLE } },
  );
  return (req: Request) => handle(req);
}

const get = (h: ReturnType<typeof router>, path: string) => h(new Request(`https://api.eait.fit${path}`));

const kickoff = (h: ReturnType<typeof router>, query: string) =>
  get(h, `${ROUTES.authAppleAndroid}?${query}`);

const back = (h: ReturnType<typeof router>, state: string, extra: Record<string, string> = { id_token: "tok" }) => {
  const body = new URLSearchParams({ state, ...extra }).toString();
  // A constructed Request carries no content-length, and the route refuses one it cannot size
  // before `formData()` buffers it — so the test declares it the way a real POST does.
  return h(new Request(`https://api.eait.fit${ROUTES.authAppleAndroidReturn}`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "content-length": String(body.length),
    },
    body,
  }));
};

const STATE = "a".repeat(24);
const NONCE = "b".repeat(64);

describe("the Android Apple kickoff's scheme allowlist", () => {
  it("accepts a configured scheme exactly, and nothing else", async () => {
    const h = router();
    const ok = await kickoff(h, `scheme=eait&state=${STATE}&nonce=${NONCE}`);
    expect(ok.status).toBe(303);
    const to = new URL(ok.headers.get("location") ?? "");
    expect(to.origin).toBe("https://appleid.apple.com");
    // Certified, the token marks the App Link; the scheme the kickoff named is still what an
    // uncertified host carries — the allowlist is checked either way.
    expect(to.searchParams.get("state")).toBe(`https.${STATE}`);
    const off = router({ androidCertFingerprints: [] });
    const plain = await kickoff(off, `scheme=eait&state=${STATE}&nonce=${NONCE}`);
    expect(new URL(plain.headers.get("location") ?? "").searchParams.get("state")).toBe(`eait.${STATE}`);

    // The prefix regex these replaced admitted every `eait*` name — a custom scheme being
    // claimable by any installed app is the whole of the bug this list closes.
    for (const forged of ["eaitdev", "eait-anything", "eait2", "eat", "x-eait"]) {
      expect((await kickoff(h, `scheme=${forged}&state=${STATE}&nonce=${NONCE}`)).status).toBe(400);
    }
  });

  it("admits a second scheme only when it is configured, and an empty list admits nothing", async () => {
    const two = router({ androidAppSchemes: ["eait", "eaitdev2"] });
    expect((await kickoff(two, `scheme=eaitdev2&state=${STATE}&nonce=${NONCE}`)).status).toBe(303);
    const none = router({ androidAppSchemes: [] });
    expect((await kickoff(none, `scheme=eait&state=${STATE}&nonce=${NONCE}`)).status).toBe(400);
  });

  it("takes the App Link UNCONDITIONALLY while certified — a caller's opt-in is not asked", async () => {
    const h = router();
    // No `via` at all: an attacker kickoff that would name the scheme by omission gets the
    // verified hop instead, because the scheme exists only for hosts that cannot certify one.
    const res = await kickoff(h, `scheme=eait&state=${STATE}&nonce=${NONCE}`);
    expect(res.status).toBe(303);
    expect(new URL(res.headers.get("location") ?? "").searchParams.get("state")).toBe(`https.${STATE}`);
    // `via` is not read at all — neither honouring it nor refusing it is a door a caller needs.
    const withVia = await kickoff(h, `scheme=eait&state=${STATE}&nonce=${NONCE}&via=browser`);
    expect(new URL(withVia.headers.get("location") ?? "").searchParams.get("state")).toBe(`https.${STATE}`);
    // Unconfigured is the only case the scheme still carries.
    const off = router({ androidCertFingerprints: [] });
    const plain = await kickoff(off, `scheme=eait&state=${STATE}&nonce=${NONCE}`);
    expect(new URL(plain.headers.get("location") ?? "").searchParams.get("state")).toBe(`eait.${STATE}`);
  });
});

describe("the Android Apple return", () => {
  it("bounces into a configured scheme and refuses every other, on the POST anybody can send", async () => {
    const h = router();
    const ok = await back(h, `eait.${STATE}`);
    expect(ok.status).toBe(303);
    expect(ok.headers.get("location")).toBe(`eait://apple-return?state=${STATE}&id_token=tok`);
    for (const forged of [`eaitdev.${STATE}`, `eait-anything.${STATE}`, `javascript.${STATE}`, STATE]) {
      expect((await back(h, forged)).status).toBe(400);
    }
  });

  it("returns through the App Link on this host only while it is certified", async () => {
    const h = router();
    const ok = await back(h, `https.${STATE}`);
    expect(ok.status).toBe(303);
    expect(ok.headers.get("location"))
      .toBe(`https://api.eait.fit${ROUTES.authAppleAndroidApp}?state=${STATE}&id_token=tok`);
    // `https` is not a scheme a poster may pick: without the configuration behind it, the token
    // is as foreign as any other.
    const off = router({ androidCertFingerprints: [] });
    expect((await back(off, `https.${STATE}`)).status).toBe(400);
  });

  it("carries Apple's error instead of a token, on both hops", async () => {
    const h = router();
    const scheme = await back(h, `eait.${STATE}`, { error: "user_cancelled_authorize" });
    expect(scheme.headers.get("location"))
      .toBe(`eait://apple-return?state=${STATE}&error=user_cancelled_authorize`);
    const link = await back(h, `https.${STATE}`, { error: "user_cancelled_authorize" });
    expect(link.headers.get("location"))
      .toBe(`https://api.eait.fit${ROUTES.authAppleAndroidApp}?state=${STATE}&error=user_cancelled_authorize`);
  });
});

describe("the App Link's landing", () => {
  it("answers a tap-through page and NEVER a Location with a non-https scheme", async () => {
    const h = router();
    const res = await get(h, `${ROUTES.authAppleAndroidApp}?state=${STATE}&id_token=tok`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    // No redirect of any kind: the case this page answers — the link unverified or no install —
    // is exactly the case where a foreign app claiming `eait` is the only receiver. The person
    // taps the same verified URL back into the app, a gesture Android delivers even here.
    expect(res.headers.get("location")).toBeNull();
    const html = await res.text();
    expect(html).toContain(`href="https://api.eait.fit${ROUTES.authAppleAndroidApp}?state=${STATE}&id_token=tok"`);
    expect(html).toContain("Install the app");
    // Apple's error is carried to the tap the same way the token is.
    const err = await get(h, `${ROUTES.authAppleAndroidApp}?state=${STATE}&error=user_cancelled_authorize`);
    expect(await err.text()).toContain(`error=user_cancelled_authorize`);
    // Nothing to hand back is not found, and the page exists only where an App Link does.
    expect((await get(h, `${ROUTES.authAppleAndroidApp}?id_token=tok`)).status).toBe(404);
    expect((await get(h, `${ROUTES.authAppleAndroidApp}?state=x`)).status).toBe(404);
    const off = router({ androidCertFingerprints: [] });
    expect((await get(off, `${ROUTES.authAppleAndroidApp}?state=${STATE}&id_token=tok`)).status).toBe(404);
  });
});

describe("/.well-known/assetlinks.json", () => {
  it("names the configured package and fingerprints while App Links are on", async () => {
    const h = router();
    const res = await get(h, ROUTES.assetlinks);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: "com.eait.fit",
        sha256_cert_fingerprints: [FINGERPRINT],
      },
    }]);
  });

  it("is absent rather than empty while unconfigured", async () => {
    const off = router({ androidCertFingerprints: [] });
    expect((await get(off, ROUTES.assetlinks)).status).toBe(404);
  });
});
