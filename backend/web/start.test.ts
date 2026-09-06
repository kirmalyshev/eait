// Onboarding on the web, driven end to end with nothing but `Request` objects.
//
// The whole surface is server-rendered and same-origin, which is what makes this possible: there is
// no browser in these tests and there does not need to be one. What is faked is exactly one thing —
// Google's token endpoint — for the same reason the app's E2E flows fake the credential and nothing
// else. The verifier, the sign-in, the profile validation, the target arithmetic and the rendering
// are all the real ones.

import { beforeEach, describe, expect, it } from "bun:test";
import {
  AMBIGUOUS_AGE, DEFAULT_ONBOARDING_CONTENT, UNDER_AGE_CARD, UNDER_AGE_LINES, disabledScreens,
  explainTargets, lintCopy, type Profile,
} from "@eait/shared";
import { configDefaults, type Config } from "../config.ts";
import { demoPorts } from "../llm/demo.ts";
import { memoryStore } from "../store.memory.ts";
import type { Store } from "../store.ts";
import type { EngineDeps } from "../engine/index.ts";
import { AuthError, type Verifier } from "../auth/verify.ts";
import { saveOnboardingContent } from "../engine/index.ts";
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
    const [marker, p, subject] = idToken.split(":");
    if (marker !== "ok" || p !== provider || !subject) throw new AuthError("invalid");
    return { provider, subject };
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
function router(config: Config, providers = PROVIDERS) {
  store = memoryStore();
  deps = { store, config, llm: demoPorts(), mailer: fakeMailer(), push: fakePush() };
  const handler = createRouter(deps, store, testVerifier, { webProviders: providers });
  handle = (req) => handler(req);
}

const get = (path: string, cookie?: string) =>
  handle(new Request(`https://api.eait.fit${path}`, { headers: cookie ? { cookie } : {} }));

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
    // No `country`: it is the one OPTIONAL screen and the shipped content has it switched off, so
    // the app does not ask it either. Asserted rather than assumed — a question this surface asked
    // and the app did not would be two different onboardings behind one profile.
    expect(disabledScreens(DEFAULT_ONBOARDING_CONTENT)).toContain("country");
    expect(asked).toEqual([
      "goal", "sex", "birth_year", "height_cm", "weight_kg",
      "target_weight_kg", "pace", "activity", "restrictions",
    ]);
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
