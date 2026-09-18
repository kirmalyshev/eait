// Onboarding on the web, driven end to end with nothing but `Request` objects.
//
// The whole surface is server-rendered and same-origin, which is what makes this possible: there is
// no browser in these tests and there does not need to be one. What is faked is exactly one thing —
// Google's token endpoint — for the same reason the app's E2E flows fake the credential and nothing
// else. The verifier, the sign-in, the profile validation, the target arithmetic and the rendering
// are all the real ones.

import { afterAll, beforeEach, describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  AMBIGUOUS_AGE, DEFAULT_ONBOARDING_CONTENT, UNDER_AGE_CARD, UNDER_AGE_LINES, disabledScreens,
  explainTargets, lintCopy, MAX_USER_LINE, TYPE_MS_PER_CHAR, type Profile,
} from "@eait/shared";
import { configDefaults, type Config } from "../config.ts";
import { demoPorts } from "../llm/demo.ts";
import { memoryStore } from "../store.memory.ts";
import type { Store, StoreOptions } from "../store.ts";
import type { EngineDeps } from "../engine/index.ts";
import { AuthError, type Verifier } from "../auth/verify.ts";
import { BROWSER_SESSION_TTL_MS } from "../auth/tokens.ts";
import { chatHistory, day, handleText, linkTelegram, saveOnboardingContent } from "../engine/index.ts";
import { createRouter } from "../api/routes.ts";
import { fakeMailer } from "../mail/fake.ts";
import { fakePush } from "../push/fake.ts";
import { PAGE_COPY } from "./page.ts";
import type { WebProvider, WebSignInProvider } from "../auth/web-oauth.ts";

const WEB_CLIENT = "web.apps.googleusercontent.com";
const SERVICE_ID = "fit.eait.web";

/** Every nonce the verifier was handed, so a test can prove the one from the cookie arrived. */
let noncesSeen: (string | undefined)[] = [];

const testVerifier: Verifier = {
  async verify(provider, idToken, nonce) {
    noncesSeen.push(nonce);
    // `ok:<provider>:<subject>` or `ok:<provider>:<subject>:<email>`. The address is OPTIONAL
    // because absent is the normal case: Apple sends one on the first authorization for an app and
    // never again, so a fake that always supplied one would be a fake no returning user resembles.
    const [marker, p, subject, email] = idToken.split(":");
    if (marker !== "ok" || p !== provider || !subject) throw new AuthError("invalid");
    return { provider, subject, ...(email ? { email } : {}) };
  },
  async verifyAppleNotification() { throw new AuthError("not-in-these-tests"); },
};

/** The two token endpoints, and the only thing here that is not real. */
const fakeProvider = (name: WebProvider, clientId: string): WebSignInProvider => ({
  clientId,
  authorizeEndpoint: `https://${name}.example/authorize`,
  extraAuthorizeParams: name === "google" ? { prompt: "select_account" } : {},
  async exchange(code) {
    if (code === "bad-code") throw new Error("invalid_grant");
    return `ok:${name}:${code}`;
  },
});

const PROVIDERS: Partial<Record<WebProvider, WebSignInProvider>> = {
  apple: fakeProvider("apple", SERVICE_ID),
  google: fakeProvider("google", WEB_CLIENT),
};

const CONFIG: Config = {
  ...configDefaults(),
  port: 0, databaseUrl: "memory://test",
  llmProvider: "demo", llmModel: "demo", llmApiKey: "unused",
  googleAudiences: [WEB_CLIENT],
  googleWebClientId: WEB_CLIENT,
  googleWebClientSecret: "web-secret",
  appleAudiences: [SERVICE_ID],
  appleServiceId: SERVICE_ID,
  appleTeamId: "TEAM123456",
  appleKeyId: "KEY1234567",
  applePrivateKey: "-----BEGIN " + "PRIVATE KEY-----\nunused-by-the-fake\n-----END " + "PRIVATE KEY-----",
  publicApiUrl: "https://api.eait.fit",
};

let store: Store;
let deps: EngineDeps;
let handle: (req: Request) => Promise<Response>;

/**
 * ONE router per test, not one per request. `createRouter` holds the per-address rate limiter, so a
 * harness that rebuilt it on every call would hand every request a fresh allowance — a limiter that
 * is present, configured and untestable, which is the shape the real server never has.
 */
/**
 * WHAT "THIS DEPLOYMENT HAS A WEB APPLICATION" IS, NOW THAT THIS PROCESS DOES NOT SERVE IT.
 *
 * It used to be a bundle on disk, written by this file into a temporary directory and handed to the
 * router — because the backend served the page itself. #423 moved the web application into its own
 * container on its own port, so the signal is the variable that says a browser origin exists.
 *
 * THE VALUE IS THE HOST THESE TESTS REQUEST. `routes.ts` answers `/start` with a 301 when the
 * request arrives on a host that is not `publicWebUrl`, so naming `app.eait.fit` here would redirect
 * every request this file makes instead of serving it — a deployment that has not split its two
 * names is the honest way to say "there is a web app" without also saying "and you are on the wrong
 * host". The tests that mean the 301 set `publicWebUrl` themselves.
 */
const WEB_ORIGIN = "https://api.eait.fit";

function router(
  config: Config,
  providers = PROVIDERS,
  llm = demoPorts(),
  webApp = false,
  storeOpts: StoreOptions = {},
) {
  store = memoryStore(storeOpts);
  // Only when asked for: a test that sets `publicWebUrl` itself means what it set.
  const withWeb = webApp ? { ...config, publicWebUrl: WEB_ORIGIN } : config;
  deps = { store, config: withWeb, llm, mailer: fakeMailer(), push: fakePush() };
  const handler = createRouter(deps, store, testVerifier, { webProviders: providers });
  handle = (req) => handler(req);
}

const get = (path: string, cookie?: string, headers: Record<string, string> = {}) =>
  handle(new Request(`https://api.eait.fit${path}`, {
    headers: { ...(cookie ? { cookie } : {}), ...headers },
  }));

const post = (path: string, form: Record<string, string | string[]>, cookie?: string) => {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(form)) {
    for (const one of Array.isArray(v) ? v : [v]) body.append(k, one);
  }
  const encoded = body.toString();
  return handle(new Request(`https://api.eait.fit${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      // Sent explicitly because `new Request` does not populate it and a real client always does —
      // and the Apple callback bridge refuses a request that declares no length, since a body it
      // cannot size is a body it must not buffer.
      "content-length": String(new TextEncoder().encode(encoded).length),
      ...(cookie ? { cookie } : {}),
    },
    body: encoded,
  }));
};

/** The `name=value` of one Set-Cookie, for handing back on the next request. */
/** The account behind a `eait_web=<token>` cookie line, for a test that reads what a page wrote. */
async function webUser(sessionCookie: string): Promise<string> {
  const userId = await store.userIdForToken(sessionCookie.split("=")[1]!);
  if (!userId) throw new Error("that session has no account");
  return userId;
}

function cookieFrom(res: Response, name: string): string {
  const all = res.headers.getSetCookie();
  const line = all.find((c) => c.startsWith(`${name}=`));
  if (!line) throw new Error(`no ${name} cookie in ${JSON.stringify(all)}`);
  return line.split(";")[0]!;
}

/** Sign in the way a browser would: start, follow to Google, come back with a code. */
async function signIn(subject = "web-subject", name: WebProvider = "google"): Promise<string> {
  const start = await get(`/start/auth/${name}`);
  const state = new URL(start.headers.get("location")!).searchParams.get("state")!;
  const oauth = cookieFrom(start, "eait_oauth");
  const back = await get(
    `/start/auth/${name}/callback?code=${subject}&state=${encodeURIComponent(state)}`, oauth);
  expect(back.status).toBe(303);
  return cookieFrom(back, "eait_web");
}

/** Answer whatever question is open, until there are none left. */
async function answerAll(session: string, answers: Record<string, string | string[]>) {
  for (let i = 0; i < 20; i++) {
    const page = await get("/start/q", session);
    if (page.status === 303) return;
    const html = await page.text();
    const id = html.match(/name="prompt" value="([a-z_]+)"/)?.[1];
    if (!id) throw new Error(`no prompt on the page: ${html.slice(0, 400)}`);
    const answer = answers[id];
    if (answer === undefined) throw new Error(`no answer supplied for ${id}`);
    const res = await post("/start/q", { prompt: id, answer }, session);
    expect(res.status).toBe(303);
  }
  throw new Error("onboarding did not finish");
}

const ANSWERS: Record<string, string | string[]> = {
  goal: "lose",
  sex: "female",
  birth_year: "34",
  height_cm: "170",
  weight_kg: "80",
  target_weight_kg: "70",
  pace: "steady",
  activity: "light",
  country: "de",
  restrictions: [],
};

beforeEach(() => {
  noncesSeen = [];
  router(CONFIG);
});

describe("the surface is off unless it is configured", () => {
  it("404s every path when no provider is configured", async () => {
    router(CONFIG, {});
    for (const path of ["/start", "/start/q", "/start/plan", "/start/auth/google", "/start/auth/apple"]) {
      expect((await get(path)).status).toBe(404);
    }
  });

  it("404s the routes of a provider this host does not offer, and only those", async () => {
    router(CONFIG, { google: PROVIDERS.google! });
    expect((await get("/start")).status).toBe(200);
    expect((await get("/start/auth/google")).status).toBe(303);
    // Not a redirect back to the front door: an unconfigured provider does not exist here, which
    // is the answer every other unconfigured surface on this server gives.
    expect((await get("/start/auth/apple")).status).toBe(404);
    expect((await get("/start/auth/apple/callback?code=c&state=s")).status).toBe(404);
  });
});

describe("the front door", () => {
  it("renders the welcome copy and one button per provider, Apple first", async () => {
    const res = await get("/start");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain("/start/auth/apple");
    expect(html).toContain("/start/auth/google");
    expect(html).toContain("Continue with Apple");
    expect(html).toContain("Continue with Google");
    // Apple first, as on the app's sign-in screen: the option that asks for the least must not be
    // the one that looks like the afterthought.
    expect(html.indexOf("/start/auth/apple")).toBeLessThan(html.indexOf("/start/auth/google"));
    expect(html).toContain("Spud");
  });

  it("offers only what is configured", async () => {
    router(CONFIG, { apple: PROVIDERS.apple! });
    const html = await (await get("/start")).text();
    expect(html).toContain("Continue with Apple");
    expect(html).not.toContain("Continue with Google");
  });
});

describe("Spud types his lines out", () => {
  it("ships one first-party script, hashed into the policy, on the shared schedule", async () => {
    const res = await get("/start");
    const html = await res.text();
    const m = html.match(/<script>([\s\S]*?)<\/script>/);
    expect(m).not.toBeNull();
    // The hash, not a nonce: the script never changes, so the policy can name it outright and the
    // page still allows no origin but its own.
    const hash = createHash("sha256").update(m![1]!).digest("base64");
    expect(res.headers.get("content-security-policy")).toContain(`script-src 'sha256-${hash}'`);
    expect(m![1]).toContain(`${TYPE_MS_PER_CHAR}`);
    // Only the onboarding's lines are marked for typing. The chat thread's are history, drawn whole
    // (the thread test below asserts the bare class).
    expect(html).toContain('<p class="bubble typed">');
    expect(html).not.toContain('<p class="bubble">');
  });
});

describe("signing in", () => {
  it.each(["apple", "google"] as const)(
    "sends the browser to %s asking for openid and nothing else",
    async (name) => {
      const res = await get(`/start/auth/${name}`);
      expect(res.status).toBe(303);
      const to = new URL(res.headers.get("location")!);
      expect(to.origin + to.pathname).toBe(`https://${name}.example/authorize`);
      expect(to.searchParams.get("client_id")).toBe(name === "apple" ? SERVICE_ID : WEB_CLIENT);
      expect(to.searchParams.get("response_type")).toBe("code");
      // The whole of what is asked for. `email` since issue #95; `profile` still not, because a
      // name and a picture are two personal fields nothing in this product reads.
      expect(to.searchParams.get("scope")).toBe("openid email");
      expect(to.searchParams.get("redirect_uri"))
        .toBe(`https://api.eait.fit/start/auth/${name}/callback`);
      expect(to.searchParams.get("state")).toBeTruthy();
      expect(to.searchParams.get("nonce")).toBeTruthy();
    },
  );

  it("does not let a provider's own params overwrite the state or the scope", async () => {
    // The extras are spread FIRST for this reason. A provider that could overwrite `state` would
    // switch off the CSRF defence, and one that could overwrite `scope` would ask for whatever it
    // liked — both silently, in a URL nobody reads.
    router(CONFIG, {
      google: {
        ...PROVIDERS.google!,
        extraAuthorizeParams: { state: "attacker", scope: "openid email profile phone", nonce: "fixed" },
      },
    });
    const to = new URL((await get("/start/auth/google")).headers.get("location")!);
    expect(to.searchParams.get("state")).not.toBe("attacker");
    expect(to.searchParams.get("nonce")).not.toBe("fixed");
    expect(to.searchParams.get("scope")).toBe("openid email");
  });

  /**
   * APPLE'S `form_post` IS WHY THIS EXISTS. Asking for the email scope obliges it, and a form POST
   * from appleid.apple.com is cross-site — so the `SameSite=Lax` state cookie is not sent with it,
   * and the CSRF check this whole surface is built on would have nothing to compare against.
   *
   * A Lax cookie IS sent on a cross-site top-level GET, which is what the bridge below turns that
   * POST into. The state check then runs exactly where it always did, on a request that has the
   * cookie, and nothing about the defence is weakened to `SameSite=None`.
   */
  describe("Apple's form_post callback", () => {
    it("bridges the POST to the GET that has the cookie, granting nothing on the way", async () => {
      const res = await post("/start/auth/apple/callback", { code: "c", state: "s" });
      expect(res.status).toBe(303);
      const to = new URL(res.headers.get("location")!, "https://api.eait.fit");
      expect(to.pathname).toBe("/start/auth/apple/callback");
      expect(to.searchParams.get("code")).toBe("c");
      expect(to.searchParams.get("state")).toBe("s");
      // It authenticates nobody: no session, and the oauth cookie is untouched.
      expect(res.headers.getSetCookie()).toEqual([]);
    });

    it("completes a sign-in that arrives as a POST, exactly as a GET one does", async () => {
      const start = await get("/start/auth/apple");
      const state = new URL(start.headers.get("location")!).searchParams.get("state")!;
      const oauth = cookieFrom(start, "eait_oauth");

      // Apple's POST carries no cookie — cross-site, Lax.
      const bridged = await post("/start/auth/apple/callback", { code: "posted", state });
      // The browser then follows it as a top-level GET, which does carry the cookie.
      const back = await handle(new Request(
        new URL(bridged.headers.get("location")!, "https://api.eait.fit").toString(),
        { headers: { cookie: oauth } },
      ));
      expect(back.status).toBe(303);
      expect(back.headers.get("location")).toBe("/start/q");
      expect(cookieFrom(back, "eait_web")).toBeTruthy();
    });

    it("still refuses a bridged callback whose state does not match the cookie", async () => {
      const start = await get("/start/auth/apple");
      const oauth = cookieFrom(start, "eait_oauth");
      const bridged = await post("/start/auth/apple/callback", { code: "c", state: "forged" });
      const back = await handle(new Request(
        new URL(bridged.headers.get("location")!, "https://api.eait.fit").toString(),
        { headers: { cookie: oauth } },
      ));
      expect(back.headers.get("location")).toBe("/start?error=1");
    });

    it("refuses an oversized body WITHOUT reading it", async () => {
      // The whole point of the guard: this route is unauthenticated, cross-site and deliberately
      // not rate limited, so a body it buffers before checking is free memory for a stranger.
      // The header is what is checked, so the request never has to carry the bytes to prove it.
      const res = await handle(new Request("https://api.eait.fit/start/auth/apple/callback", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "content-length": String(9 * 1024),
        },
        body: "code=c&state=s",
      }));
      expect(res.status).toBe(303);
      // No parameters carried, so the GET takes its own empty-code exit.
      expect(res.headers.get("location")).toBe("/start/auth/apple/callback");
    });

    it("refuses a body that is not a urlencoded form", async () => {
      const res = await handle(new Request("https://api.eait.fit/start/auth/apple/callback", {
        method: "POST",
        headers: { "content-type": "application/json", "content-length": "20" },
        body: JSON.stringify({ code: "c", state: "s" }),
      }));
      expect(res.status).toBe(303);
      expect(res.headers.get("location")).toBe("/start/auth/apple/callback");
    });

    it("refuses a request that declares no length at all", async () => {
      // A chunked body carries no `content-length`, and the size check has nothing to read. That
      // is the one shape that could slip past the guard and be buffered, so absent is refused
      // rather than treated as zero. Apple always sends the header.
      const res = await handle(new Request("https://api.eait.fit/start/auth/apple/callback", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
      }));
      expect(res.headers.get("location")).toBe("/start/auth/apple/callback");
    });

    it("404s the bridge on a host that does not offer that provider", async () => {
      router(CONFIG, { google: PROVIDERS.google! });
      expect((await post("/start/auth/apple/callback", { code: "c", state: "s" })).status)
        .toBe(404);
    });
  });

  it("writes the state cookie HttpOnly, Lax and Secure", async () => {
    const line = (await get("/start/auth/google")).headers.getSetCookie()
      .find((c) => c.startsWith("eait_oauth="))!;
    expect(line).toContain("HttpOnly");
    expect(line).toContain("SameSite=Lax");
    expect(line).toContain("Secure");
  });

  it("refuses a callback whose state does not match the cookie", async () => {
    const start = await get("/start/auth/google");
    const oauth = cookieFrom(start, "eait_oauth");
    const res = await get("/start/auth/google/callback?code=x&state=not-the-one", oauth);
    expect(res.headers.getSetCookie().some((c) => c.startsWith("eait_web="))).toBe(false);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/start?error=");
  });

  it("refuses a callback with no cookie at all", async () => {
    const res = await get("/start/auth/google/callback?code=x&state=anything");
    expect(res.headers.getSetCookie().some((c) => c.startsWith("eait_web="))).toBe(false);
  });

  it("passes the nonce it generated to the verifier", async () => {
    const start = await get("/start/auth/google");
    const nonce = new URL(start.headers.get("location")!).searchParams.get("nonce");
    await get(
      `/start/auth/google/callback?code=s&state=${encodeURIComponent(new URL(start.headers.get("location")!).searchParams.get("state")!)}`,
      cookieFrom(start, "eait_oauth"),
    );
    expect(noncesSeen).toEqual([nonce!]);
  });

  it("mints a session for a new identity and sends it to the questions", async () => {
    const start = await get("/start/auth/google");
    const state = new URL(start.headers.get("location")!).searchParams.get("state")!;
    const res = await get(
      `/start/auth/google/callback?code=web-subject&state=${encodeURIComponent(state)}`,
      cookieFrom(start, "eait_oauth"),
    );
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/start/q");
    const session = res.headers.getSetCookie().find((c) => c.startsWith("eait_web="))!;
    expect(session).toContain("HttpOnly");
    expect(session).toContain("SameSite=Lax");
    // The account it named is reachable with the same token the app would use.
    const token = session.split(";")[0]!.split("=")[1]!;
    expect(await store.userIdForToken(decodeURIComponent(token))).toBeTruthy();
  });

  /**
   * The callback is the fourth route on this server that mints a session, and the only one that
   * spends an outbound call to Google before anybody is authenticated. The three in `api/routes.ts`
   * are bounded per address; this proves this one is too, on the same allowance.
   */
  it("bounds the callback by address, on the same allowance the app's sign-in routes take", async () => {
    router({ ...CONFIG, authRateLimitPerHour: 1 });
    await signIn("first");
    const start = await get("/start/auth/google");
    const state = new URL(start.headers.get("location")!).searchParams.get("state")!;
    const res = await get(
      `/start/auth/google/callback?code=second&state=${encodeURIComponent(state)}`,
      cookieFrom(start, "eait_oauth"),
    );
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBeTruthy();
    expect(res.headers.getSetCookie().some((c) => c.startsWith("eait_web="))).toBe(false);
  });

  it("does not spend that allowance on a callback that never passed the state check", async () => {
    router({ ...CONFIG, authRateLimitPerHour: 1 });
    // A scanner's request, and one address can be thousands of people behind carrier-grade NAT.
    expect((await get("/start/auth/google/callback?code=x&state=junk")).status).toBe(303);
    await signIn("still-allowed");
  });

  it("404s an unconfigured host however often it is asked, rather than 429ing it", async () => {
    router({ ...CONFIG, authRateLimitPerHour: 1 }, {});
    for (let i = 0; i < 3; i++) {
      expect((await get("/start/auth/google/callback?code=x&state=y")).status).toBe(404);
    }
  });

  it("will not spend a state minted for one provider at the other's callback", async () => {
    // The provider is in the cookie as well as in the path. Without that, a state issued on the way
    // to Google is a state Apple's callback would accept — a stranger's half-finished sign-in
    // completing against whichever provider they can produce a code for.
    const start = await get("/start/auth/google");
    const state = new URL(start.headers.get("location")!).searchParams.get("state")!;
    const res = await get(
      `/start/auth/apple/callback?code=whoever&state=${encodeURIComponent(state)}`,
      cookieFrom(start, "eait_oauth"),
    );
    expect(res.headers.getSetCookie().some((c) => c.startsWith("eait_web="))).toBe(false);
    expect(res.headers.get("location")).toContain("/start?error=");
  });

  it("keeps the two providers' subjects apart, even when they are the same string", async () => {
    // One subject under two providers is two identities and so two accounts. It is the same rule
    // the E2E flows rely on, and it is what makes the wrong button in the app a real hazard rather
    // than a cosmetic one.
    const viaApple = await signIn("same-string", "apple");
    const viaGoogle = await signIn("same-string", "google");
    const a = await store.userIdForToken(viaApple.split("=")[1]!);
    const g = await store.userIdForToken(viaGoogle.split("=")[1]!);
    expect(a).toBeTruthy();
    expect(g).toBeTruthy();
    expect(a).not.toBe(g);
  });

  it("sends a failed exchange back to the front door without a session", async () => {
    const start = await get("/start/auth/google");
    const state = new URL(start.headers.get("location")!).searchParams.get("state")!;
    const res = await get(
      `/start/auth/google/callback?code=bad-code&state=${encodeURIComponent(state)}`,
      cookieFrom(start, "eait_oauth"),
    );
    expect(res.headers.getSetCookie().some((c) => c.startsWith("eait_web="))).toBe(false);
    expect(res.headers.get("location")).toContain("/start?error=");
  });
});

describe("the questions", () => {
  it("sends somebody with no session back to the front door", async () => {
    const res = await get("/start/q");
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/start");
  });

  it("opens on the goal question, with the admin's words and every option", async () => {
    const session = await signIn();
    const html = await (await get("/start/q", session)).text();
    expect(html).toContain('name="prompt" value="goal"');
    for (const option of ["lose", "maintain", "gain"]) {
      expect(html).toContain(`value="${option}"`);
    }
  });

  it("walks the same order the app walks, and finishes", async () => {
    const session = await signIn();
    const asked: string[] = [];
    for (let i = 0; i < 20; i++) {
      const page = await get("/start/q", session);
      if (page.status === 303) break;
      const html = await page.text();
      const id = html.match(/name="prompt" value="([a-z_]+)"/)![1]!;
      asked.push(id);
      await post("/start/q", { prompt: id, answer: ANSWERS[id]! }, session);
    }
    // `country` IS asked here, and only because this request says nothing about where it is from:
    // `get` sends no `Accept-Language` and the account has no address. That is the whole rule —
    // the question is put to exactly the clients that could not answer it (#365). A browser that
    // does answer it is the test below, and the app applies the same rule from `getLocales()`.
    expect(disabledScreens(DEFAULT_ONBOARDING_CONTENT)).toEqual([]);
    expect(asked).toEqual([
      "goal", "sex", "birth_year", "height_cm", "weight_kg",
      "target_weight_kg", "pace", "activity", "country", "restrictions",
    ]);
  });

  it("does not ask a browser that already says where it is, and writes what it said", async () => {
    const session = await signIn();
    const asked: string[] = [];
    for (let i = 0; i < 20; i++) {
      const page = await get("/start/q", session, { "accept-language": "de-DE,de;q=0.9,en;q=0.8" });
      if (page.status === 303) break;
      const html = await page.text();
      const id = html.match(/name="prompt" value="([a-z_]+)"/)![1]!;
      asked.push(id);
      await post("/start/q", { prompt: id, answer: ANSWERS[id]! }, session);
    }
    expect(asked).not.toContain("country");
    // NOT ASKED IS NOT THE SAME AS NOT ANSWERED. The value is what the analyzer reads, so a
    // question skipped because the browser knew the answer has to leave that answer behind — the
    // whole of #359 was a country field nothing filled and nothing asked for.
    expect((await store.getProfile(await webUser(session)))!.country).toBe("de");
  });

  it("offers the country the sign-in address names, first, when nothing else could tell", async () => {
    const session = await signIn();
    const userId = await webUser(session);
    await store.setIdentityEmail(userId, "google", "web-subject", "someone@gmx.de");

    // No `Accept-Language`, so the address is all there is — a HINT, which orders the options and
    // does not answer them. Walk up to the country question rather than through it.
    let html = "";
    for (let i = 0; i < 20; i++) {
      const page = await get("/start/q", session);
      html = await page.text();
      const id = html.match(/name="prompt" value="([a-z_]+)"/)?.[1];
      if (id === undefined || id === "country") break;
      await post("/start/q", { prompt: id, answer: ANSWERS[id]! }, session);
    }
    expect(html).toContain('name="prompt" value="country"');
    const order = [...html.matchAll(/value="(de|gb|us|ru|other)"/g)].map((m) => m[1]);
    expect(order[0]).toBe("de");
    // An ORDER, not an answer: the field is still empty, and it is the user who fills it.
    expect((await store.getProfile(userId))!.country).toBeNull();
  });

  it("asks a screen the admin switches back on", async () => {
    const enabled = {
      ...DEFAULT_ONBOARDING_CONTENT,
      screens: DEFAULT_ONBOARDING_CONTENT.screens.map((screen) =>
        screen.id === "country" ? { ...screen, enabled: true } : screen),
    };
    expect((await saveOnboardingContent(deps, enabled)).ok).toBe(true);
    const session = await signIn();
    const asked: string[] = [];
    for (let i = 0; i < 20; i++) {
      const page = await get("/start/q", session);
      if (page.status === 303) break;
      const html = await page.text();
      const id = html.match(/name="prompt" value="([a-z_]+)"/)![1]!;
      asked.push(id);
      await post("/start/q", { prompt: id, answer: ANSWERS[id]! }, session);
    }
    expect(asked).toContain("country");
  });

  it("re-asks a refused answer in the server's own words, and changes nothing", async () => {
    const session = await signIn();
    await post("/start/q", { prompt: "goal", answer: "lose" }, session);
    await post("/start/q", { prompt: "sex", answer: "female" }, session);
    await post("/start/q", { prompt: "birth_year", answer: "1990" }, session);
    await post("/start/q", { prompt: "height_cm", answer: "170" }, session);
    await post("/start/q", { prompt: "weight_kg", answer: "80" }, session);
    // Below a healthy BMI for 170cm. This is the anorexia guard, and it is a refusal.
    const res = await post("/start/q", { prompt: "target_weight_kg", answer: "40" }, session);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('name="prompt" value="target_weight_kg"');
    expect(html.toLowerCase()).toContain("lowest");
    const userId = (await store.userIdForToken(session.split("=")[1]!))!;
    expect((await store.getProfile(userId))!.target_weight_kg).toBeNull();
  });

  it("refuses an answer for a question that is not the open one", async () => {
    const session = await signIn();
    const res = await post("/start/q", { prompt: "activity", answer: "light" }, session);
    expect(res.status).toBe(303);
    const userId = (await store.userIdForToken(session.split("=")[1]!))!;
    expect((await store.getProfile(userId))!.activity).toBeNull();
  });

});

describe("the plan", () => {
  it("is where a finished profile lands, and it carries the target", async () => {
    const session = await signIn();
    await answerAll(session, ANSWERS);
    const q = await get("/start/q", session);
    expect(q.headers.get("location")).toBe("/start/plan");

    const html = await (await get("/start/plan", session)).text();
    const userId = (await store.userIdForToken(session.split("=")[1]!))!;
    const profile = (await store.getProfile(userId))!;
    expect(profile.onboarded_at).not.toBeNull();
    const { targets } = explainTargets(profile);
    expect(html).toContain(String(targets.kcal));
    expect(html).toContain("Sign in with Google");
  });

  it("says when the floor decided the number", async () => {
    const session = await signIn();
    // Small, light, sedentary and pushing: the deficit runs into `KCAL_FLOOR`.
    await answerAll(session, {
      ...ANSWERS, height_cm: "150", weight_kg: "48", target_weight_kg: "44", pace: "push",
      activity: "sedentary",
    });
    const userId = (await store.userIdForToken(session.split("=")[1]!))!;
    const profile = (await store.getProfile(userId))! as Profile;
    const { basis } = explainTargets(profile);
    expect(basis.floorApplied).toBe(true);
    const html = await (await get("/start/plan", session)).text();
    expect(html.toLowerCase()).toContain("floor");
  });

  it("offers checkout only when one is configured, naming this account", async () => {
    const session = await signIn();
    await answerAll(session, ANSWERS);
    expect(await (await get("/start/plan", session)).text()).not.toContain("pay.rev.cat");

    router({ ...CONFIG, webCheckoutUrl: "https://pay.rev.cat/eait/{userId}" });
    const second = await signIn();
    await answerAll(second, ANSWERS);
    const userId = (await store.userIdForToken(second.split("=")[1]!))!;
    const html = await (await get("/start/plan", second)).text();
    expect(html).toContain(`https://pay.rev.cat/eait/${userId}`);
  });

  // THE SENTENCE THIS WHOLE PROVIDER PAIR EXISTS FOR. The app offers both buttons and the wrong one
  // does not find this account — it attaches to the anonymous one the install already has, so
  // onboarding runs again and this plan, plus anything bought from it, stays on an account the
  // phone is no longer in. `engine/identity.ts` never merges two real identities, so there is no
  // repair downstream of getting this wrong.
  it.each(["apple", "google"] as const)(
    "tells a %s signup to press that same button in the app, not the other one",
    async (name) => {
      const session = await signIn(`sub-${name}`, name);
      await answerAll(session, ANSWERS);
      const html = await (await get("/start/plan", session)).text();
      const [used, other] = name === "apple" ? ["Apple", "Google"] : ["Google", "Apple"];
      expect(html).toContain(`Sign in with ${used}`);
      expect(html).not.toContain(`Sign in with ${other}`);
    },
  );

  it("sends an unfinished profile back to the questions", async () => {
    const session = await signIn();
    const res = await get("/start/plan", session);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/start/q");
  });

});

describe("coming back", () => {
  it("takes a returning identity straight to the plan", async () => {
    const first = await signIn("returning");
    await answerAll(first, ANSWERS);
    // A second browser, the same Google account.
    const again = await signIn("returning");
    const res = await get("/start/q", again);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/start/plan");
  });
});

describe("pairing a browser with an app account", () => {
  /** The app's half, over the API this browser never touches: a device account, onboarded. */
  async function appSession(): Promise<string> {
    const res = await handle(new Request("https://api.eait.fit/v1/auth/device", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deviceId: crypto.randomUUID() + crypto.randomUUID(), locale: "en" }),
    }));
    const { token } = await res.json() as { token: string };
    await handle(new Request("https://api.eait.fit/v1/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({
        goal: "lose", sex: "female", birth_year: 1990, height_cm: 170, weight_kg: 80,
        target_weight_kg: 70, activity: "light", pace: "steady", country: "de",
        restrictions: [], complete_onboarding: true,
      }),
    }));
    return token;
  }

  /** What the app would show the user. */
  async function mint(token: string): Promise<string> {
    const res = await handle(new Request("https://api.eait.fit/v1/auth/pair", {
      method: "POST", headers: { authorization: `Bearer ${token}` },
    }));
    expect(res.status).toBe(200);
    return (await res.json() as { code: string }).code;
  }

  /**
   * THE ONE THE TICKET ASKS FOR: a device-anonymous install opens its own thread in a browser and
   * sends a turn.
   *
   * Every step is a real request. The browser starts with no cookie at all, and what it ends with
   * is the ordinary session cookie the OAuth callback sets — the same token, in the same place,
   * read by the same line.
   */
  it("takes a device-anonymous account's thread into a browser, and a turn lands in it", async () => {
    const app = await appSession();
    const userId = (await store.userIdForToken(app))!;
    const code = await mint(app);

    const paired = await post("/start/pair", { code });
    expect(paired.status).toBe(303);
    expect(paired.headers.get("location")).toBe("/start/chat");
    const session = cookieFrom(paired, "eait_web");

    // The SAME account, not a new one: no user was created and nothing was merged.
    expect(await store.userIdForToken(session.split("=")[1]!)).toBe(userId);

    const thread = await get("/start/chat", session);
    expect(thread.status).toBe(200);

    const before = (await chatHistory(deps, userId, { limit: 50 })).entries.length;
    const said = await post("/start/chat/say", { text: "two eggs and toast" }, session);
    expect(said.status).toBe(303);
    const after = await chatHistory(deps, userId, { limit: 50 });
    expect(after.entries.length).toBeGreaterThan(before);
    expect(JSON.stringify(after.entries)).toContain("two eggs and toast");
  });

  /**
   * THE INVARIANT, with a crafted body — the redemption half.
   *
   * The browser never names an account and cannot: the user id comes out of the store, by the hash
   * of the code. A form field called `userId` is just a field nobody reads.
   */
  it("lands in the account that MINTED the code, whatever else the form says", async () => {
    const a = await appSession();
    const b = await appSession();
    const attacker = (await store.userIdForToken(b))!;
    const code = await mint(a);

    const paired = await post("/start/pair", { code, userId: attacker });
    const session = cookieFrom(paired, "eait_web");
    expect(await store.userIdForToken(session.split("=")[1]!)).toBe(await store.userIdForToken(a));
  });

  /**
   * LOGIN-CSRF, refused by shape.
   *
   * A GET that minted a session from `?code=` would be a link an attacker can send: the victim's
   * browser follows it, is signed into the ATTACKER's account, and types their weight into it —
   * the scenario rule 3 at the top of `start.ts` describes. So there is no GET here at all, and
   * the redemption is the POST somebody pressed.
   */
  it("has no GET that mints anything", async () => {
    const app = await appSession();
    const code = await mint(app);
    const res = await get(`/start/pair?code=${code}`);
    expect(res.headers.getSetCookie()).toEqual([]);
    // And the code is still live afterwards, so the GET did not even spend it.
    expect(cookieFrom(await post("/start/pair", { code }), "eait_web")).toBeTruthy();
  });

  it("works once — a second browser with the same code gets nothing", async () => {
    const app = await appSession();
    const code = await mint(app);
    expect(cookieFrom(await post("/start/pair", { code }), "eait_web")).toBeTruthy();

    const second = await post("/start/pair", { code });
    expect(second.status).toBe(303);
    expect(second.headers.get("location")).toBe("/start?error=code");
    expect(second.headers.getSetCookie()).toEqual([]);
  });

  it("sends an unknown code to the front door with words about it, and sets no cookie", async () => {
    const res = await post("/start/pair", { code: "ABCD2345" });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/start?error=code");
    expect(res.headers.getSetCookie()).toEqual([]);

    // The page that redirect lands on says which thing went wrong — a code, not a sign-in.
    const door = await (await get("/start?error=code")).text();
    expect(door).toContain(PAGE_COPY.errorPair);
    expect(door).not.toContain(PAGE_COPY.errorSignIn);
  });

  it("takes the per-address sign-in allowance before it reads the body", async () => {
    // Two: the device registration spends one, the mint spends the other, and the redemption then
    // meets the wall. The point is that this route is bounded at all — 40 bits of code behind an
    // unbounded POST is 40 bits of code behind nothing.
    router({ ...CONFIG, authRateLimitPerHour: 2 });
    const app = await appSession();
    const code = await mint(app);

    const res = await post("/start/pair", { code });
    expect(res.status).toBe(429);
    expect(res.headers.getSetCookie()).toEqual([]);
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("offers the form on the front door, and it posts", async () => {
    const html = await (await get("/start")).text();
    expect(html).toContain('action="/start/pair"');
    expect(html).toContain('method="post"');
    expect(html).toContain('name="code"');
    expect(html).toContain(PAGE_COPY.pairButton);
  });

  it("gives a paired session no more than a signed-in one: the cookie still buys nothing on the API", async () => {
    const app = await appSession();
    const session = cookieFrom(await post("/start/pair", { code: await mint(app) }), "eait_web");
    const res = await handle(new Request("https://api.eait.fit/v1/profile", { headers: { cookie: session } }));
    expect(res.status).toBe(401);
  });
});

describe("the copy this surface writes", () => {
  /**
   * The claims gate, over OUR sentences and not the rendered page.
   *
   * The rendered page carries the admin's onboarding copy, which says "Lose weight" — the goal a
   * user picks, which `weight-promise` matches and cannot tell from a promise anybody made. Gating
   * the whole page would fail on words that have shipped inside the app, ungated, since the first
   * build. What is new here is this file's own public marketing copy, and that is what is gated.
   */
  it("passes the claims gate", () => {
    expect(lintCopy({ ...PAGE_COPY })).toEqual([]);
  });
});

describe("the cookie is this surface's alone", () => {
  /**
   * Security rule 2 of `web/start.ts`, asserted rather than trusted.
   *
   * It is the invariant most likely to be undone by a later "just read the cookie too" edit in
   * `resolveUserId`, and the cost of that edit is every authenticated route becoming postable from
   * another origin on a signed-in browser. Five lines is cheap insurance for it.
   */
  it("buys nothing on the API", async () => {
    const session = await signIn();
    const res = await handle(new Request("https://api.eait.fit/v1/profile", { headers: { cookie: session } }));
    expect(res.status).toBe(401);
    // And the same token in the header the API DOES read works, so this proves the cookie was
    // ignored rather than that the token was bad.
    const token = session.split("=")[1]!;
    const asBearer = await handle(new Request("https://api.eait.fit/v1/profile", {
      headers: { authorization: `Bearer ${token}` },
    }));
    expect(asBearer.status).toBe(200);
  });

  it("takes the FIRST of two cookies with the same name, not the last", async () => {
    const session = await signIn();
    // What a browser sends when something on the parent domain sets its own `eait_web`: ours is
    // more specific and comes first. Last-wins would hand the session to the other one.
    const shadowed = `${session}; eait_web=someone-elses-token`;
    const res = await get("/start/q", shadowed);
    expect(res.status).toBe(200);
  });

  it("survives a token that outlived its account", async () => {
    const session = await signIn();
    const userId = (await store.userIdForToken(session.split("=")[1]!))!;
    // Erasure racing this request: `deleteUser` revokes the tokens, but one already in a browser
    // still gets sent. A non-null assertion on the profile answered a JSON 500 on an HTML surface.
    await store.deleteUser(userId);
    const res = await get("/start/q", session);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/start");
  });

  it("does not answer 500 to a cookie that is not valid percent-encoding", async () => {
    const res = await get("/start/q", "eait_web=%");
    // Back to the front door, like any other unusable session — `decodeURIComponent` throwing here
    // would reach the router's outer catch and answer a JSON 500 on an HTML surface.
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/start");
  });
});

describe("the numbers go through the shared checks, not this page's own", () => {
  /**
   * The one that would have shipped silently after the merge that made this question an age.
   *
   * The bubble asks how old you are; the column stores a year. `checkNumber` is the single place
   * those meet, and a web page calling `Number()` instead would have stored 34 as a birth year — a
   * person aged nearly two thousand, refused by the server with a sentence about the year, under a
   * bubble that asked for an age.
   */
  it("stores the year a typed age implies", async () => {
    const session = await signIn();
    await post("/start/q", { prompt: "goal", answer: "lose" }, session);
    await post("/start/q", { prompt: "sex", answer: "female" }, session);
    await post("/start/q", { prompt: "birth_year", answer: "34" }, session);
    const userId = (await store.userIdForToken(session.split("=")[1]!))!;
    expect((await store.getProfile(userId))!.birth_year).toBe(new Date().getUTCFullYear() - 34);
  });

  it("still takes a four-digit year, for copy that still asks for one", async () => {
    const session = await signIn();
    await post("/start/q", { prompt: "goal", answer: "lose" }, session);
    await post("/start/q", { prompt: "sex", answer: "female" }, session);
    await post("/start/q", { prompt: "birth_year", answer: "1990" }, session);
    const userId = (await store.userIdForToken(session.split("=")[1]!))!;
    expect((await store.getProfile(userId))!.birth_year).toBe(1990);
  });

  it("asks rather than guesses when two digits could be a year typed short", async () => {
    const session = await signIn();
    await post("/start/q", { prompt: "goal", answer: "lose" }, session);
    await post("/start/q", { prompt: "sex", answer: "female" }, session);
    // "90" is 1990 typed the short way, or somebody who is ninety. Guessing computes a stranger's
    // calorie target.
    const asked = await post("/start/q", { prompt: "birth_year", answer: "90" }, session);
    expect(asked.status).toBe(200);
    const html = await asked.text();
    expect(html).toContain(AMBIGUOUS_AGE.line(90));
    expect(html).toContain('name="age" value="90"');
    const userId = (await store.userIdForToken(session.split("=")[1]!))!;
    expect((await store.getProfile(userId))!.birth_year).toBeNull();

    // The quick reply takes it as an age, and the SERVER does the subtraction.
    await post("/start/q", { prompt: "birth_year", age: "90" }, session);
    expect((await store.getProfile(userId))!.birth_year).toBe(new Date().getUTCFullYear() - 90);
  });

  it("refuses a height in the shared band, in the shared words", async () => {
    const session = await signIn();
    await post("/start/q", { prompt: "goal", answer: "lose" }, session);
    await post("/start/q", { prompt: "sex", answer: "female" }, session);
    await post("/start/q", { prompt: "birth_year", answer: "34" }, session);
    const res = await post("/start/q", { prompt: "height_cm", answer: "500" }, session);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("In centimetres");
    const userId = (await store.userIdForToken(session.split("=")[1]!))!;
    expect((await store.getProfile(userId))!.height_cm).toBeNull();
  });
});

describe("the under-sixteen stop", () => {
  const toAge = async (session: string, age: string) => {
    await post("/start/q", { prompt: "goal", answer: "lose" }, session);
    await post("/start/q", { prompt: "sex", answer: "female" }, session);
    return post("/start/q", { prompt: "birth_year", answer: age }, session);
  };

  it("offers the typo once rather than stopping on the first answer", async () => {
    const session = await signIn();
    const html = await (await toAge(session, "12")).text();
    expect(html).toContain(UNDER_AGE_LINES.ask);
    expect(html).toContain('name="confirm" value="under-age"');
    // Nothing written: the age was refused, not stored.
    const userId = (await store.userIdForToken(session.split("=")[1]!))!;
    expect((await store.getProfile(userId))!.birth_year).toBeNull();
  });

  it("DELETES the account when the age is confirmed, because the words promise it", async () => {
    const session = await signIn();
    await toAge(session, "12");
    const userId = (await store.userIdForToken(session.split("=")[1]!))!;
    const res = await post("/start/q", { prompt: "birth_year", confirm: "under-age" }, session);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain(UNDER_AGE_CARD.title);
    expect(html).toContain(UNDER_AGE_LINES.stopped[0]!);
    // "Nothing you told me is kept, and there is no account to delete" — so there must not be one.
    expect(await store.getProfile(userId)).toBeNull();
    expect(await store.userIdForToken(session.split("=")[1]!)).toBeNull();
    expect(res.headers.getSetCookie().some((c) => c.startsWith("eait_web=;"))).toBe(true);
  });
});

describe("a target that runs the wrong way", () => {
  const toTarget = async (session: string) => {
    for (const [prompt, answer] of [
      ["goal", "lose"], ["sex", "female"], ["birth_year", "34"],
      ["height_cm", "170"], ["weight_kg", "80"],
    ] as const) {
      await post("/start/q", { prompt, answer }, session);
    }
  };

  it("is refused with the offer to switch the goal, and writes nothing", async () => {
    const session = await signIn();
    await toTarget(session);
    // Losing, to a number above the current weight. `explainTargets` would take it and produce a
    // plan that cannot arrive, with nothing on any screen to say so.
    const res = await post("/start/q", { prompt: "target_weight_kg", answer: "90" }, session);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("not a loss from here");
    expect(html).toContain('name="switch" value="gain"');
    const userId = (await store.userIdForToken(session.split("=")[1]!))!;
    expect((await store.getProfile(userId))!.target_weight_kg).toBeNull();
  });

  it("flips the goal and asks again in the words the app uses", async () => {
    const session = await signIn();
    await toTarget(session);
    await post("/start/q", { prompt: "target_weight_kg", answer: "90" }, session);
    const switched = await post("/start/q", { prompt: "target_weight_kg", switch: "gain" }, session);
    expect(switched.status).toBe(303);
    expect(switched.headers.get("location")).toBe("/start/q?switched=1");
    const userId = (await store.userIdForToken(session.split("=")[1]!))!;
    expect((await store.getProfile(userId))!.goal).toBe("gain");
    const again = await (await get("/start/q?switched=1", session)).text();
    expect(again).toContain("Switched — gaining it is");
    // And the number that was refused a moment ago is now the right direction.
    await post("/start/q", { prompt: "target_weight_kg", answer: "90" }, session);
    expect((await store.getProfile(userId))!.target_weight_kg).toBe(90);
  });
});

// ── Chat ──────────────────────────────────────────────────────────────────────────────────────
//
// The same conversation the app shows, in a browser, under the account the cookie names. Every
// engine call here is the one `api/routes.ts` makes; what is new is the rendering and the forms.

/** Sign in and finish onboarding, and hand back the session cookie and the account it names. */
async function onboarded(subject = "web-subject"): Promise<{ session: string; userId: string }> {
  const session = await signIn(subject);
  await answerAll(session, ANSWERS);
  const userId = (await store.userIdForToken(session.split("=")[1]!))!;
  return { session, userId };
}

describe("chat on the web", () => {
  it("404s with no provider configured, and sends a stranger to the front door", async () => {
    router(CONFIG, {});
    expect((await get("/start/chat")).status).toBe(404);
    expect((await get("/chat")).status).toBe(404);
    router(CONFIG);
    const res = await get("/start/chat");
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/start");
  });

  it("redirects the short link to the thread", async () => {
    const res = await get("/chat");
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/start/chat");
  });

  it("sends both ways in to the web application's chat, where there is one (#499)", async () => {
    // One chat on the web: where this deployment has a web application, its chat is the chat.
    router({ ...CONFIG }, undefined, undefined, true);
    const { session } = await onboarded();
    for (const path of ["/chat", "/start/chat", "/start/chat?notice=expired"]) {
      const res = await get(path, session);
      expect(res.status).toBe(303);
      expect(res.headers.get("location")).toBe("/#/chat");
    }
    // Signed out as well: the web application has its own way to sign somebody in.
    expect((await get("/start/chat")).headers.get("location")).toBe("/#/chat");
    // A tab opened before this change still posts here, and is still answered.
    expect((await post("/start/chat/say", { text: "   " }, session)).status).toBe(303);
  });

  it("renders the account's own thread, oldest first, and nobody else's", async () => {
    const { session, userId } = await onboarded();
    const other = await onboarded("someone-else");
    await handleText(deps, userId, { text: "how much protein have I had?" });
    await handleText(deps, other.userId, { text: "not yours" });

    const page = await (await get("/start/chat", session)).text();
    expect(page).toContain("how much protein have I had?");
    expect(page).toContain("Demo");
    expect(page).not.toContain("not yours");
    expect(page.indexOf("how much protein have I had?")).toBeLessThan(page.indexOf("Demo"));
  });

  it("sends somebody who has not finished onboarding back to the questions", async () => {
    const session = await signIn();
    const res = await get("/start/chat", session);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/start/q");
  });
});

describe("chat on the web: saying something", () => {
  it("shows the composer, and keeps both sides of a question", async () => {
    const { session } = await onboarded();
    expect(await (await get("/start/chat", session)).text()).toContain('action="/start/chat/say"');

    const res = await post("/start/chat/say", { text: "how much protein have I had?" }, session);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/start/chat");
    const after = await (await get("/start/chat", session)).text();
    expect(after).toContain("how much protein have I had?");
    expect(after).toContain("Demo");
  });

  it("proposes a typed meal, holds it across the redirect, and logs it when confirmed", async () => {
    const { session, userId } = await onboarded();
    const res = await post("/start/chat/say", { text: "two boiled eggs and a slice of rye bread" }, session);
    expect(res.status).toBe(303);
    const to = res.headers.get("location")!;
    // The proposal is not a thread line until it is confirmed, so its id rides the redirect and is
    // read back through the user-scoped `getPending` — the one place a client-named id is safe.
    expect(to).toMatch(/^\/start\/chat\?pending=[0-9a-f-]{36}$/);
    const pendingId = new URL(to, "https://api.eait.fit").searchParams.get("pending")!;
    const page = await (await get(to, session)).text();
    expect(page).toContain(PAGE_COPY.chatConfirm);
    expect(page).toContain(pendingId);
    expect((await day(deps, userId))!.meals).toHaveLength(0);

    const done = await post("/start/chat/confirm", { pendingId }, session);
    expect(done.status).toBe(303);
    expect(done.headers.get("location")).toBe("/start/chat");
    expect((await day(deps, userId))!.meals).toHaveLength(1);
    // And the card is in the thread, with the verdict in words rather than in a colour.
    const thread = await (await get("/start/chat", session)).text();
    expect(thread).toContain("kcal");
    expect(thread).not.toContain(PAGE_COPY.chatConfirm);
  });

  it("drops a proposal that is cancelled, and logs nothing", async () => {
    const { session, userId } = await onboarded();
    const to = (await post("/start/chat/say", { text: "two boiled eggs" }, session)).headers.get("location")!;
    const pendingId = new URL(to, "https://api.eait.fit").searchParams.get("pending")!;
    const res = await post("/start/chat/cancel", { pendingId }, session);
    expect(res.status).toBe(303);
    expect((await day(deps, userId))!.meals).toHaveLength(0);
    expect(await (await get(to, session)).text()).not.toContain(PAGE_COPY.chatConfirm);
  });

  it("never reaches the engine with an empty message, or with one past the line cap", async () => {
    const { session, userId } = await onboarded();
    expect((await post("/start/chat/say", { text: "   " }, session)).headers.get("location")).toBe("/start/chat");
    const long = await post("/start/chat/say", { text: "x".repeat(MAX_USER_LINE + 1) }, session);
    expect(long.headers.get("location")).toBe("/start/chat?notice=too-long");
    expect(await store.chatBefore(userId, null, 10)).toEqual([]);
    expect(await (await get("/start/chat?notice=too-long", session)).text()).toContain(PAGE_COPY.chatTooLong);
  });

  it("cannot confirm somebody else's proposal, and says only that it is not held", async () => {
    const { session } = await onboarded();
    const other = await onboarded("someone-else");
    const to = (await post("/start/chat/say", { text: "two boiled eggs" }, other.session)).headers.get("location")!;
    const pendingId = new URL(to, "https://api.eait.fit").searchParams.get("pending")!;

    const res = await post("/start/chat/confirm", { pendingId }, session);
    expect(res.headers.get("location")).toBe("/start/chat?notice=expired");
    expect((await day(deps, other.userId))!.meals).toHaveLength(0);
    expect(await (await get("/start/chat?notice=expired", session)).text()).toContain(PAGE_COPY.chatExpired);
  });

  it("renders the server's refusal rather than a blank page", async () => {
    router({ ...CONFIG, freeAnalyses: 1 });
    const { session } = await onboarded();
    await post("/start/chat/say", { text: "how much protein have I had?" }, session);
    const spent = await post("/start/chat/say", { text: "and yesterday?" }, session);
    expect(spent.headers.get("location")).toBe("/start/chat?notice=subscription-required");
    expect(await (await get("/start/chat?notice=subscription-required", session)).text())
      .toContain(PAGE_COPY.chatRefusalSubscription);
  });
});

describe("chat on the web: the address allowance", () => {
  it("bounds chat turns per address, in the same bucket the app's route takes", async () => {
    router({ ...CONFIG, analysisRateLimitPerDay: 1 });
    const { session, userId } = await onboarded();
    expect((await post("/start/chat/say", { text: "how much protein?" }, session)).headers.get("location"))
      .toBe("/start/chat");
    const spent = await post("/start/chat/say", { text: "and yesterday?" }, session);
    expect(spent.headers.get("location")).toBe("/start/chat?notice=cap-address");
    // Refused before the engine, so the second turn is not in the thread and cost nothing.
    expect((await store.chatBefore(userId, null, 10)).filter((l) => l.role === "user")).toHaveLength(1);
  });
});

/** A JPEG's magic bytes and nothing else: the sniff in front of the charge is what reads them. */
const jpegBytes = (fill: number) => { const b = new Uint8Array(64).fill(fill); b[0] = 0xff; b[1] = 0xd8; return b; };

const upload = (files: Uint8Array[], cookie: string, opts: { type?: string; caption?: string } = {}) => {
  const form = new FormData();
  files.forEach((bytes, i) => {
    form.append("photo", new File([bytes], `m${i}.jpg`, { type: opts.type ?? "image/jpeg" }));
  });
  if (opts.caption !== undefined) form.append("caption", opts.caption);
  return handle(new Request("https://api.eait.fit/start/chat/photo", {
    // A declared length, because since #208 this route refuses a request that has none: a synthetic
    // `Request` carries no `content-length`, while a browser's multipart POST always does.
    method: "POST", headers: { cookie, "content-length": "1024" }, body: form,
  }));
};

describe("chat on the web: photos", () => {
  it("logs a photographed meal, with its caption, and puts it in the thread", async () => {
    const { session, userId } = await onboarded();
    expect(await (await get("/start/chat", session)).text()).toContain('enctype="multipart/form-data"');

    const res = await upload([jpegBytes(1)], session, { caption: "with sauce" });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/start/chat");
    expect((await day(deps, userId))!.meals).toHaveLength(1);
    const page = await (await get("/start/chat", session)).text();
    expect(page).toContain("with sauce");
    expect(page).toContain("kcal");
  });

  it("refuses anything that is not an image we can read, before the sample is charged", async () => {
    const { session, userId } = await onboarded();
    // No JPEG/PNG/WebP magic: what an iPhone on High Efficiency hands over, and what the provider
    // answers with a status that stays charged.
    const res = await upload([new Uint8Array(64).fill(9)], session, { type: "image/heic" });
    expect(res.headers.get("location")).toBe("/start/chat?notice=unsupported-image");
    expect((await day(deps, userId))!.meals).toHaveLength(0);
    // The sniff is in front of the charge: a file we cannot read costs the account nothing.
    expect(await store.countUserAnalyses(userId)).toBe(0);
    expect(await (await get("/start/chat?notice=unsupported-image", session)).text())
      .toContain(PAGE_COPY.chatRefusalImage);
  });

  it("refuses a submit with no file, and more angles than a meal may have", async () => {
    const { session, userId } = await onboarded();
    expect((await upload([], session)).headers.get("location")).toBe("/start/chat?notice=no-photo");
    const many = Array.from({ length: CONFIG.maxPhotosPerMeal + 1 }, (_, i) => jpegBytes(i + 1));
    expect((await upload(many, session)).headers.get("location")).toBe("/start/chat?notice=too-many");
    expect((await day(deps, userId))!.meals).toHaveLength(0);
  });

  it("refuses an upload larger than the configured cap before it is buffered", async () => {
    const { session } = await onboarded();
    const res = await handle(new Request("https://api.eait.fit/start/chat/photo", {
      method: "POST",
      headers: { cookie: session, "content-type": "multipart/form-data; boundary=x", "content-length": String(CONFIG.maxUploadBytes + 1) },
      body: "--x--",
    }));
    expect(res.headers.get("location")).toBe("/start/chat?notice=too-large");
  });

  it("refuses a chat POST that declares no length at all", async () => {
    // `Number(null)` is 0, so a chunked body passed the guard and reached `req.formData()` (#208).
    // The same call the Apple callback in this file already makes, and the notice is `too-large`
    // because it is the honest one: the size is unknown, so it cannot be allowed.
    const { session } = await onboarded();
    const res = await handle(new Request("https://api.eait.fit/start/chat/photo", {
      method: "POST",
      headers: { cookie: session, "content-type": "multipart/form-data; boundary=x" },
    }));
    expect(res.headers.get("location")).toBe("/start/chat?notice=too-large");
  });
});

describe("chat on the web: the way in", () => {
  it("offers the chat from the plan page, which is where a finished account lands", async () => {
    const { session } = await onboarded();
    // Signing in again with a finished profile: the questions are done, so /q hands over to /plan.
    const q = await get("/start/q", session);
    expect(q.status).toBe(303);
    expect(q.headers.get("location")).toBe("/start/plan");
    const plan = await (await get("/start/plan", session)).text();
    expect(plan).toContain('href="/start/chat"');
    expect(plan).toContain(PAGE_COPY.planChat);
  });
});

describe("chat on the web: what a notice may say", () => {
  it("ignores a notice code that is only a property of every object", async () => {
    const { session } = await onboarded();
    // A plain object literal inherits from Object.prototype, so a lookup on one of these returns a
    // function rather than undefined — and the page then renders whatever that is. The link is one
    // a stranger can hand somebody, so the miss has to be a miss.
    for (const key of ["constructor", "__proto__", "toString", "valueOf", "hasOwnProperty"]) {
      const res = await get(`/start/chat?notice=${encodeURIComponent(key)}`, session);
      expect(res.status).toBe(200);
      expect(await res.text()).not.toContain('class="notice"');
    }
  });

  it("says which allowance ran out, because the server distinguishes three", async () => {
    router({ ...CONFIG, analysisRateLimitPerDay: 1 });
    const first = await onboarded();
    await post("/start/chat/say", { text: "how much protein?" }, first.session);
    // The ADDRESS limit: not this account's day, and saying so would be a lie to somebody on a
    // carrier network who has logged one meal.
    const address = await post("/start/chat/say", { text: "and yesterday?" }, first.session);
    expect(address.headers.get("location")).toBe("/start/chat?notice=cap-address");
    expect(await (await get("/start/chat?notice=cap-address", first.session)).text())
      .toContain(PAGE_COPY.chatRefusalNetwork);

    // The INSTANCE budget, which is not about this account at all.
    router({ ...CONFIG, globalDailyAnalysisCap: 1 });
    const second = await onboarded();
    await post("/start/chat/say", { text: "how much protein?" }, second.session);
    const global = await post("/start/chat/say", { text: "and yesterday?" }, second.session);
    expect(global.headers.get("location")).toBe("/start/chat?notice=cap-global");
    // The apostrophe is escaped in the page, so the assertion is on the half that is not.
    expect(await (await get("/start/chat?notice=cap-global", second.session)).text())
      .toContain("Tomorrow is a fresh number.");
  });

  it("refuses a photo on the address allowance before it buffers the upload", async () => {
    router({ ...CONFIG, analysisRateLimitPerDay: 1 });
    const { session } = await onboarded();
    await post("/start/chat/say", { text: "how much protein?" }, session);
    // An empty submit, which the parsed form would answer with `no-photo`. The allowance answering
    // first is what proves nothing was buffered to find that out.
    expect((await upload([], session)).headers.get("location")).toBe("/start/chat?notice=cap-address");
  });
});

describe("chat on the web: a turn that needs a meal in focus", () => {
  // This page never sends a `focusMealId` — there is no way to open a meal on it — so the engine's
  // `target-gone` cannot mean what it means in the app, where a meal vanished mid-turn. Here it can
  // only mean nothing was in focus, and the page must not claim a deletion that never happened.
  //
  // Reached with a stubbed router intent, which is the only way: the restriction that makes it
  // unreachable is a sentence in the prompt, not a schema, so a model that ignores it lands here.
  const routed = (r: unknown) => ({ ...demoPorts(), routeText: async () => r as never });

  it("says nothing is open to move, and does not claim the meal was deleted", async () => {
    router(CONFIG, PROVIDERS, routed({ intent: "redate", dayOffset: -1 }));
    const { session, userId } = await onboarded();

    const res = await post("/start/chat/say", { text: "that was yesterday" }, session);
    expect(res.headers.get("location")).toBe("/start/chat?notice=no-focus-redate");
    // The engine writes no line for it either, which is why the notice is the only thing the
    // person can be told: a silent reload is a submit that appears to have done nothing.
    expect(await store.chatBefore(userId, null, 10)).toEqual([]);
    const page = await (await get("/start/chat?notice=no-focus-redate", session)).text();
    expect(page).toContain(PAGE_COPY.chatNoFocusRedate);
    expect(page).not.toContain("deleted");
  });

  it("says something different about a correction, which is a different thing to be told", async () => {
    router(CONFIG, PROVIDERS, routed({ intent: "correction", analysis: { items: [] } }));
    const { session } = await onboarded();

    const res = await post("/start/chat/say", { text: "half the rice" }, session);
    expect(res.headers.get("location")).toBe("/start/chat?notice=no-focus-correction");
    expect(await (await get("/start/chat?notice=no-focus-correction", session)).text())
      .toContain(PAGE_COPY.chatNoFocusCorrection);
    expect(PAGE_COPY.chatNoFocusCorrection).not.toBe(PAGE_COPY.chatNoFocusRedate);
  });
});

describe("chat on the web: who said it", () => {
  it("puts Gabie's name on her answers, and nothing on Spud's", async () => {
    const { session, userId } = await onboarded();
    await store.appendChat(userId, [
      { role: "assistant", kind: "text", text: "First one in. 612 kcal." },
      { role: "user", kind: "text", text: "how much protein have I had?" },
      { role: "assistant", kind: "text", text: "About 40 g so far.", speaker: "gabie" },
    ]);
    const page = await (await get("/start/chat", session)).text();
    // Her name leads her bubble; his lines are unlabelled, because his is the voice the page
    // opens in and a name on every line reads as two strangers rather than one conversation.
    expect(page).toContain('<p class="who">Gabie</p><p class="bubble">About 40 g so far.</p>');
    expect(page).toContain('<p class="bubble">First one in. 612 kcal.</p>');
    expect(page.match(/class="who"/g)).toHaveLength(1);
  });
});

describe("the web surface and the landing are one product", () => {
  it("draws its pages from the landing's own tokens and typeface", async () => {
    const { session } = await onboarded();
    const page = await (await get("/start/chat", session)).text();
    // The landing's palette, by variable name, rather than a second copy of the hexes.
    expect(page).toContain("--accent-ink:");
    expect(page).toContain('font-family: "Space Grotesk"');
    // Light unless somebody says otherwise, which is the landing's rule: the OS is not consulted.
    expect(page).not.toContain("prefers-color-scheme");
  });

  it("serves that typeface itself, cached, so the page loads nothing from anyone else", async () => {
    const res = await get("/start/assets/space-grotesk-latin.woff2");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("font/woff2");
    expect(res.headers.get("cache-control")).toContain("immutable");
    expect((await res.arrayBuffer()).byteLength).toBeGreaterThan(10_000);
    // And the policy that allows it is same-origin only.
    const front = await get("/start");
    expect(front.headers.get("content-security-policy")).toContain("font-src 'self'");
  });
});

describe("signing out of this browser", () => {
  /** Sign in and finish, then hand back the cookie and a bearer minted from it. */
  const session = async (): Promise<{ cookie: string; bearer: string; userId: string }> => {
    const start = await get("/start/auth/google");
    const state = new URL(start.headers.get("location")!).searchParams.get("state")!;
    const res = await get(
      `/start/auth/google/callback?code=signout-subject&state=${encodeURIComponent(state)}`,
      cookieFrom(start, "eait_oauth"),
    );
    const cookie = res.headers.getSetCookie().find((c) => c.startsWith("eait_web="))!.split(";")[0]!;
    const userId = (await store.userIdForToken(decodeURIComponent(cookie.split("=")[1]!)))!;
    await store.patchProfile(userId, { onboarded_at: new Date().toISOString() });
    const bearer = (await (await post("/start/session/token", {}, cookie)).json() as { token: string }).token;
    return { cookie, bearer, userId };
  };

  it("revokes the session, so the next person at this browser is not the last one", async () => {
    // THE FAILURE THIS EXISTS FOR. The web app's Sign out cleared a variable in its own module and
    // nothing else: the HttpOnly cookie survived, so the very next press of "Sign in" answered
    // 303 → / and minted a fresh bearer from the SAME session. On a shared browser that is the next
    // person reading the last person's diary, having supplied no credential at all.
    router({ ...CONFIG }, undefined, undefined, true);
    const { cookie, bearer } = await session();

    const out = await post("/start/session/signout", {}, cookie);
    expect(out.status).toBe(200);
    // The cookie is cleared on the way out, so the browser stops presenting it.
    expect(out.headers.getSetCookie().some((c) => c.startsWith("eait_web=") && /Max-Age=0/.test(c))).toBe(true);

    // And the credential itself is dead, not merely forgotten by the page.
    expect(await store.userIdForToken(decodeURIComponent(cookie.split("=")[1]!))).toBeNull();
    // The bearer the page was holding dies with it — it is a second credential on the same session.
    expect(await store.userIdForToken(bearer)).toBeNull();

    // The front door no longer knows them: the questions, not a redirect into somebody's diary.
    const back = await get("/start", cookie);
    expect(back.status).toBe(200);
  });

  it("is a POST, like every other write on this surface", async () => {
    // A GET that ends a session is a session another site can end with an <img> tag.
    const { cookie } = await session();
    expect((await get("/start/session/signout", cookie)).status).not.toBe(200);
  });

  it("ends nothing for a request with no session, and answers a script in JSON rather than a redirect (#457)", async () => {
    // Called with `fetch` like the mint, so a 303 here is the same red line in the console.
    const res = await post("/start/session/signout", {}, "eait_web=not-a-session");
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
    expect(await res.json()).toEqual({ token: null });
    // Whatever the browser was presenting is not a session, so it stops presenting it.
    expect(res.headers.getSetCookie().some((c) => c.startsWith("eait_web=") && /Max-Age=0/.test(c))).toBe(true);
  });
});

describe("the funnel actually reaches the web application", () => {
  /** Sign in and finish onboarding, which is the state a returning person is in. */
  const onboarded = async (): Promise<string> => {
    const start = await get("/start/auth/google");
    const state = new URL(start.headers.get("location")!).searchParams.get("state")!;
    const res = await get(
      `/start/auth/google/callback?code=returning-subject&state=${encodeURIComponent(state)}`,
      cookieFrom(start, "eait_oauth"),
    );
    const cookie = res.headers.getSetCookie().find((c) => c.startsWith("eait_web="))!.split(";")[0]!;
    const userId = (await store.userIdForToken(decodeURIComponent(cookie.split("=")[1]!)))!;
    await store.patchProfile(userId, { onboarded_at: new Date().toISOString() });
    return cookie;
  };

  it("sends a signed-in, onboarded browser to the diary instead of the questions again", async () => {
    // The whole reason this surface exists is to get somebody to the point of using the product.
    // Answering the questions a second time is not that, and it is what the front door did to
    // anybody who came back — because it renders before the session is ever read.
    router({ ...CONFIG }, undefined, undefined, true);
    const res = await get("/start", await onboarded());
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/");
  });

  it("does not send anybody to a diary that was never built", async () => {
    // `/` answers 404 on a deployment with no bundle, and bouncing a signed-in person into that is
    // worse than showing them the questions.
    router({ ...CONFIG }, undefined, undefined, false);
    const res = await get("/start", await onboarded());
    expect(res.status).toBe(200);
  });

  it("leaves somebody mid-onboarding where they were", async () => {
    // Signed in is not the same as finished. A half-answered profile has no plan behind it, so the
    // diary would be a screen of zeroes and no way back to the questions.
    router({ ...CONFIG }, undefined, undefined, true);
    const start = await get("/start/auth/google");
    const state = new URL(start.headers.get("location")!).searchParams.get("state")!;
    const cb = await get(
      `/start/auth/google/callback?code=halfway-subject&state=${encodeURIComponent(state)}`,
      cookieFrom(start, "eait_oauth"),
    );
    const cookie = cb.headers.getSetCookie().find((c) => c.startsWith("eait_web="))!.split(";")[0]!;
    const res = await get("/start", cookie);
    expect(res.headers.get("location")).not.toBe("/");
  });
});

describe("the plan page hands over to the product", () => {
  const planFor = async (webApp: boolean): Promise<string> => {
    router({ ...CONFIG }, undefined, undefined, webApp);
    const start = await get("/start/auth/google");
    const state = new URL(start.headers.get("location")!).searchParams.get("state")!;
    const cb = await get(
      `/start/auth/google/callback?code=plan-subject&state=${encodeURIComponent(state)}`,
      cookieFrom(start, "eait_oauth"),
    );
    const cookie = cb.headers.getSetCookie().find((c) => c.startsWith("eait_web="))!.split(";")[0]!;
    const userId = (await store.userIdForToken(decodeURIComponent(cookie.split("=")[1]!)))!;
    await store.patchProfile(userId, {
      sex: "female", birth_year: 1990, height_cm: 170, weight_kg: 70, target_weight_kg: 65,
      activity: "light", pace: "steady", goal: "lose", onboarded_at: new Date().toISOString(),
    });
    return await (await get("/start/plan", cookie)).text();
  };

  it("offers the diary, and offers it before the App Store", async () => {
    // The page ended on "Now get the app", which was the only next step when the only client was an
    // iPhone. There is a web application now, and a person who has just answered eight questions in
    // a browser can use it in the same browser — so the handover comes first and installing is what
    // it says after.
    const html = await planFor(true);
    expect(html).toContain('href="/"');
    expect(html.indexOf('href="/"')).toBeLessThan(html.indexOf("Now get the app"));
  });

  it("says nothing about a diary on a deployment that has none", async () => {
    // A button to a 404 is worse than no button, and this is the same rule the front door follows.
    const html = await planFor(false);
    expect(html).not.toContain('href="/"');
    expect(html).toContain("Now get the app");
  });

  it("opens the web application's chat where there is one, and its own where there is not (#499)", async () => {
    const withApp = await planFor(true);
    expect(withApp).toContain('href="/#/chat"');
    expect(withApp).not.toContain('href="/start/chat"');
    expect(await planFor(false)).toContain('href="/start/chat"');
  });
});

describe("handing the browser's own JavaScript a bearer", () => {
  /** Sign in for real and return the session cookie, because that is the only way to get one. */
  const signedIn = async (): Promise<string> => {
    const start = await get("/start/auth/google");
    const state = new URL(start.headers.get("location")!).searchParams.get("state")!;
    const res = await get(
      `/start/auth/google/callback?code=bearer-subject&state=${encodeURIComponent(state)}`,
      cookieFrom(start, "eait_oauth"),
    );
    return res.headers.getSetCookie().find((c) => c.startsWith("eait_web="))!.split(";")[0]!;
  };

  it("mints a SECOND token rather than handing over the cookie's own", async () => {
    // #407. The bundle needs a bearer, and the session cookie is HttpOnly precisely so script
    // cannot read it. Minting a separate token means the cookie's value never enters JavaScript and
    // the two can be revoked independently.
    const cookie = await signedIn();
    const res = await post("/start/session/token", {}, cookie);
    expect(res.status).toBe(200);
    const body = await res.json() as { token: string };
    expect(body.token).toBeTruthy();
    expect(cookie).not.toContain(body.token);
    // And it addresses the same account.
    const cookieToken = decodeURIComponent(cookie.split("=")[1]!);
    expect(await store.userIdForToken(body.token))
      .toBe((await store.userIdForToken(cookieToken))!);
  });

  it("is in the body and never in a URL", async () => {
    // docs/WEB_ONBOARDING.md refuses a bearer secret in a URL: it lands in history, in a Referer
    // and in every log between here and the browser.
    const res = await post("/start/session/token", {}, await signedIn());
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("content-type")).toContain("application/json");
  });

  it("gives nothing to a request with no session, and says so in JSON rather than a redirect (#457)", async () => {
    // `api.ts` asks this with `fetch` on every page load, `redirect: "manual"`. A 303 is not
    // followed, and Chrome records its target as a failed request — a red line in every anonymous
    // visitor's console. A 401 is no better: Chrome logs "Failed to load resource" for that. A 200
    // whose body says there is no session logs nothing (all three measured in Chrome, 2026-09-10).
    for (const cookie of [undefined, "eait_web=not-a-session"]) {
      const res = await post("/start/session/token", {}, cookie);
      expect(res.status).toBe(200);
      expect(res.headers.get("location")).toBeNull();
      expect(res.headers.get("cache-control")).toBe("no-store");
      expect(await res.json()).toEqual({ token: null });
    }
  });

  it("is a POST, so SameSite=Lax is what guards it", async () => {
    // A cross-site GET navigation carries a Lax cookie and a cross-site POST does not. Every write
    // on this surface is a POST for that reason, and minting a credential is a write.
    const res = await get("/start/session/token", await signedIn());
    expect(res.status).not.toBe(200);
  });

  it("gives it a lifetime of hours, while the session behind it keeps the phone's months", async () => {
    // #407's remaining half. The two credentials on one session are not the same kind of thing:
    // the cookie is HttpOnly and a browser holds it, the bearer sits in a closure that this page
    // re-fills from that cookie on every load. Six idle months is what a phone's Keychain needs;
    // handing the same lifetime to a token minted per page view leaves a working credential for
    // every tab anybody ever opened, on the origin that also serves the admin.
    let clock = Date.parse("2026-09-09T09:00:00Z");
    router({ ...CONFIG }, undefined, undefined, false, { now: () => clock });
    const cookie = await signedIn();
    const bearer = (await (await post("/start/session/token", {}, cookie)).json() as { token: string }).token;
    const cookieToken = decodeURIComponent(cookie.split("=")[1]!);
    expect(await store.userIdForToken(bearer)).not.toBeNull();

    // Past the bearer's lifetime and nowhere near the session's.
    clock += BROWSER_SESSION_TTL_MS + 1_000;

    expect(await store.userIdForToken(bearer)).toBeNull();
    // The session itself is untouched, which is what makes the expiry invisible: the page asks
    // again and gets another one.
    expect(await store.userIdForToken(cookieToken)).not.toBeNull();
    expect((await post("/start/session/token", {}, cookie)).status).toBe(200);
  });
});

describe("Sign in with Apple, in both places (#476)", () => {
  // ── THE SUBJECT IS THE ACCOUNT. THE AUDIENCE IS NOT. ────────────────────────────────────────
  //
  // The app authorises as its BUNDLE ID and a browser as the SERVICE ID — Apple's design, not
  // ours, and the reason `config.ts` insists the Service ID appears in `appleAudiences` BESIDE the
  // bundle id rather than instead of it. Two audiences, one `sub`, and the person expects one
  // diary.
  //
  // Nothing in the identity path reads `aud`: `verify.ts` checks it and then returns
  // `{ provider, subject }`, and `identities` is keyed `(provider, subject)`. These say so from
  // both directions rather than leaving it to be inferred from that — the day somebody adds the
  // audience to the identity key to "separate the surfaces", every web sign-in becomes a second
  // account holding none of the person's meals.

  /** The app's own route, as `lib/api.ts` calls it. */
  const nativeSignIn = (subject: string, bearer?: string, email?: string) =>
    handle(new Request("https://api.eait.fit/v1/auth/apple", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
      },
      body: JSON.stringify({ idToken: `ok:apple:${subject}${email ? `:${email}` : ""}` }),
    }));

  /** The browser's, through the real front door: authorize, then the callback with its state. */
  const webSignIn = async (subject: string, email?: string): Promise<string> => {
    const start = await get("/start/auth/apple");
    const state = new URL(start.headers.get("location")!).searchParams.get("state")!;
    const code = `${subject}${email ? `:${email}` : ""}`;
    const res = await get(
      `/start/auth/apple/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`,
      cookieFrom(start, "eait_oauth"),
    );
    const cookie = res.headers.getSetCookie().find((c) => c.startsWith("eait_web="))!;
    return decodeURIComponent(cookie.split(";")[0]!.split("=")[1]!);
  };

  beforeEach(() => { router(CONFIG); });

  it("lands the app and the browser on the SAME account, in that order", async () => {
    const subject = "apple-both-places";
    const app = await nativeSignIn(subject).then((r) => r.json()) as { userId: string; outcome: string };
    expect(app.outcome).toBe("created");

    const web = await webSignIn(subject);
    expect(await store.userIdForToken(web)).toBe(app.userId);
  });

  it("and in the other order, because whichever came first is the account", async () => {
    const subject = "apple-browser-first";
    const web = await webSignIn(subject);
    const first = (await store.userIdForToken(web))!;

    const app = await nativeSignIn(subject).then((r) => r.json()) as { userId: string; outcome: string };
    expect(app.userId).toBe(first);
    // Not `created`: the account already existed, and a returning user links nothing.
    expect(app.outcome).toBe("switched");
  });

  it("adds no second identity, whichever surface signs in again", async () => {
    const subject = "apple-one-identity";
    const app = await nativeSignIn(subject).then((r) => r.json()) as { userId: string };
    await webSignIn(subject);
    await nativeSignIn(subject);

    const linked = await store.listIdentities(app.userId);
    expect(linked.filter((i) => i.provider === "apple")).toHaveLength(1);
  });

  it("keeps the anonymous account's meals when the browser is not where it started", async () => {
    // The app is where somebody logs meals anonymously, so the merge is the app's path — signing in
    // there carries the diary onto the Apple account. The browser then reaches that same account
    // rather than a second empty one, which is the whole of what "both places" has to mean.
    const anon = await handle(new Request("https://api.eait.fit/v1/auth/device", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deviceId: crypto.randomUUID() + crypto.randomUUID(), locale: "en" }),
    })).then((r) => r.json()) as { token: string; userId: string };

    const linkedIn = await nativeSignIn("apple-merge-subject", anon.token)
      .then((r) => r.json()) as { userId: string; outcome: string };
    expect(linkedIn.outcome).toBe("linked");
    expect(linkedIn.userId).toBe(anon.userId);

    const web = await webSignIn("apple-merge-subject");
    expect(await store.userIdForToken(web)).toBe(anon.userId);
  });

  it("joins on the subject when the two surfaces carry two DIFFERENT addresses", async () => {
    // THE PRIVATE RELAY IS NOT AN IDENTITY. Somebody who picks "Hide My Email" gets a relay address
    // rather than their own, and Apple mints it per client — so the app (authorising as the bundle
    // id) and a browser (authorising as the Service ID) can legitimately arrive with two addresses
    // for one person. An identity keyed on the address, or a lookup that fell back to it when the
    // subject missed, would make that TWO accounts holding half a diary each, indistinguishable
    // afterwards from two real people.
    //
    // The addresses below are as far apart as they can be — a real one and a relay — and the only
    // thing the two sign-ins share is the `sub`. One row is the assertion.
    const subject = "apple-hide-my-email";
    const app = await nativeSignIn(subject, undefined, "person@example.com")
      .then((r) => r.json()) as { userId: string; outcome: string };
    expect(app.outcome).toBe("created");

    const web = await webSignIn(subject, "9q7zx3k2m1@privaterelay.appleid.com");
    expect(await store.userIdForToken(web)).toBe(app.userId);
    // And no second identity was created to hold the second address.
    expect(await store.listIdentities(app.userId)).toHaveLength(1);
  });

  it("is offered on the page whenever its four settings are set, beside Google", async () => {
    // The browser half is dark in production for one reason and it is configuration, not code:
    // `webProviders()` registers Apple only when all four are non-empty. This is the assertion that
    // the code half is finished — a host that sets them gets the button.
    const html = await (await get("/start")).text();
    expect(html).toContain("/start/auth/apple");
    expect(html).toContain("Continue with Apple");
  });
});

describe("the origin the browser is sent back to", () => {
  it("is the web origin, not the API's", async () => {
    // #406. The redirect_uri is where the provider returns the person, so it belongs to whichever
    // host is serving them — and that is no longer the host the confirmation emails point at.
    router({ ...CONFIG, publicWebUrl: "https://app.eait.fit" });
    const res = await handle(new Request("https://app.eait.fit/start/auth/google", {
      method: "GET", redirect: "manual",
    }));
    const to = new URL(res.headers.get("location")!);
    expect(to.searchParams.get("redirect_uri"))
      .toBe("https://app.eait.fit/start/auth/google/callback");
  });

  it("falls back to the API's origin, so a host that never sets it is unchanged", async () => {
    router({ ...CONFIG, publicWebUrl: "" });
    const res = await handle(new Request("https://api.eait.fit/start/auth/google", {
      method: "GET", redirect: "manual",
    }));
    const to = new URL(res.headers.get("location")!);
    expect(to.searchParams.get("redirect_uri"))
      .toBe("https://api.eait.fit/start/auth/google/callback");
  });
});

describe("a sign-in button is only drawn where it can complete", () => {
  /** No `publicApiUrl`, so the origin is the request's own — which is how a laptop runs. */
  const atOrigin = (origin: string, path: string) =>
    handle(new Request(`${origin}${path}`, { redirect: "manual" }));

  it("drops Apple on an origin Apple refuses, and keeps Google on loopback", async () => {
    router({ ...CONFIG, publicApiUrl: "" });
    const page = await (await atOrigin("http://localhost:8787", "/start")).text();
    // Apple wants https on a domain it can resolve; Google takes http on loopback.
    expect(page).not.toContain("Continue with Apple");
    expect(page).toContain("Continue with Google");
    // And the routes of the provider that cannot work answer 404, like one never configured.
    expect((await atOrigin("http://localhost:8787", "/start/auth/apple")).status).toBe(404);
    expect((await atOrigin("http://localhost:8787", "/start/auth/google")).status).toBe(303);
  });

  it("drops Google too on a LAN name, which Google refuses over http", async () => {
    router({ ...CONFIG, publicApiUrl: "" });
    // Both gone means the surface is gone: 404, the shape it takes when nothing is configured.
    expect((await atOrigin("http://home-ubuntu:8807", "/start")).status).toBe(404);
  });

  it("offers both once the origin is https", async () => {
    router({ ...CONFIG, publicApiUrl: "" });
    const page = await (await atOrigin("https://api.eait.fit", "/start")).text();
    expect(page).toContain("Continue with Apple");
    expect(page).toContain("Continue with Google");
  });
});

describe("a demo server signs somebody in on a laptop", () => {
  /** What `index.ts` builds under `--demo`: this process serves both ends of the flow. */
  const localProviders = {
    apple: { ...PROVIDERS.apple!, local: true },
    google: { ...PROVIDERS.google!, local: true },
  };

  it("offers both providers on an origin Apple and Google would refuse", async () => {
    // The whole point of a demo provider: Google is not in this flow, so Google's rule about http
    // is not the rule that applies. Without the exemption a demo server showed no buttons at all.
    router({ ...CONFIG, publicApiUrl: "" }, localProviders);
    const page = await (await handle(new Request("http://localhost:8787/start"))).text();
    expect(page).toContain("Continue with Apple");
    expect(page).toContain("Continue with Google");
    expect((await handle(new Request("http://localhost:8787/start/auth/apple"))).status).toBe(303);
  });
});

describe("Connect Telegram", () => {
  const BOT = "eait_test_bot";

  /** A signed-in, onboarded browser session. */
  const onboarded = async (): Promise<string> => {
    const session = await signIn(`tg-${crypto.randomUUID()}`);
    await answerAll(session, ANSWERS);
    return session;
  };

  it("is not on the plan, and is not a route, while the connector is off", async () => {
    const session = await onboarded();
    expect(await (await get("/start/plan", session)).text()).not.toContain("/start/telegram");
    expect((await post("/start/telegram", {}, session)).status).toBe(404);
  });

  it("mints a code at the tap and sends the browser to the bot with it, for this account only", async () => {
    router({ ...CONFIG, telegramBotUsername: BOT });
    const session = await onboarded();
    const html = await (await get("/start/plan", session)).text();
    expect(html).toContain('<form method="post" action="/start/telegram">');
    expect(html).toContain(PAGE_COPY.planTelegram);

    const res = await post("/start/telegram", {}, session);
    expect(res.status).toBe(303);
    const to = new URL(res.headers.get("location")!);
    expect(`${to.origin}${to.pathname}`).toBe(`https://t.me/${BOT}`);
    const code = to.searchParams.get("start")!;
    // Telegram's deep-link payload alphabet: A-Z, a-z, 0-9, _ and -, at most 64.
    expect(code).toMatch(/^[A-Za-z0-9_-]{1,64}$/);

    // The code is this account's, and spending it is what the bot's `/start <code>` does.
    expect(await linkTelegram(deps, code, "7000000002")).toBe("linked");
    expect(await store.userIdForIdentity("telegram", "7000000002")).toBe(await webUser(session));
  });

  it("lets the browser follow that redirect: the page's form-action names t.me", async () => {
    // A form's redirect is checked against `form-action` too. With 'self' alone the button is
    // pressed and the browser silently refuses to go anywhere.
    router({ ...CONFIG, telegramBotUsername: BOT });
    const session = await onboarded();
    const csp = (await get("/start/plan", session)).headers.get("content-security-policy")!;
    expect(csp).toMatch(/form-action 'self' https:\/\/t\.me(;|$)/);
  });

  it("needs the session, like every other write here", async () => {
    router({ ...CONFIG, telegramBotUsername: BOT });
    const res = await post("/start/telegram", {});
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/start");
  });
});
