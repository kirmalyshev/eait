// Onboarding on the web, driven end to end with nothing but `Request` objects.
//
// The whole surface is server-rendered and same-origin, which is what makes this possible: there is
// no browser in these tests and there does not need to be one. What is faked is exactly one thing —
// Google's token endpoint — for the same reason the app's E2E flows fake the credential and nothing
// else. The verifier, the sign-in, the profile validation, the target arithmetic and the rendering
// are all the real ones.

import { beforeEach, describe, expect, it } from "bun:test";
import {
  DEFAULT_ONBOARDING_CONTENT, disabledScreens, explainTargets, lintCopy, type Profile,
} from "@ieat/shared";
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
import type { GoogleCodeExchange } from "./start.ts";

const WEB_CLIENT = "web.apps.googleusercontent.com";

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

/** Google's token endpoint, and the only thing here that is not real. */
const exchange: GoogleCodeExchange = {
  async exchange(code) {
    if (code === "bad-code") throw new Error("invalid_grant");
    return `ok:google:${code}`;
  },
};

const CONFIG: Config = {
  ...configDefaults(),
  port: 0, databaseUrl: "memory://test",
  llmProvider: "demo", llmModel: "demo", llmApiKey: "unused",
  googleAudiences: [WEB_CLIENT],
  googleWebClientId: WEB_CLIENT,
  googleWebClientSecret: "web-secret",
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
function router(config: Config) {
  store = memoryStore();
  deps = { store, config, llm: demoPorts(), mailer: fakeMailer(), push: fakePush() };
  const handler = createRouter(deps, store, testVerifier, { googleExchange: exchange });
  handle = (req) => handler(req);
}

const get = (path: string, cookie?: string) =>
  handle(new Request(`https://api.eait.fit${path}`, { headers: cookie ? { cookie } : {} }));

const post = (path: string, form: Record<string, string | string[]>, cookie?: string) => {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(form)) {
    for (const one of Array.isArray(v) ? v : [v]) body.append(k, one);
  }
  return handle(new Request(`https://api.eait.fit${path}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", ...(cookie ? { cookie } : {}) },
    body: body.toString(),
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
async function signIn(subject = "web-subject"): Promise<string> {
  const start = await get("/start/auth/google");
  const state = new URL(start.headers.get("location")!).searchParams.get("state")!;
  const oauth = cookieFrom(start, "eait_oauth");
  const back = await get(`/start/auth/google/callback?code=${subject}&state=${encodeURIComponent(state)}`, oauth);
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
  birth_year: "1990",
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
  it("404s every path when there is no web client id", async () => {
    router({ ...CONFIG, googleWebClientId: "", googleWebClientSecret: "" });
    for (const path of ["/start", "/start/q", "/start/plan", "/start/auth/google"]) {
      expect((await get(path)).status).toBe(404);
    }
  });

  it("404s when the id is set and the secret is not, rather than half-working", async () => {
    router({ ...CONFIG, googleWebClientSecret: "" });
    expect((await get("/start")).status).toBe(404);
  });
});

describe("the front door", () => {
  it("renders the welcome copy and one way in", async () => {
    const res = await get("/start");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain("/start/auth/google");
    expect(html).toContain("Spud");
  });

});

describe("signing in", () => {
  it("sends the browser to Google asking for openid and nothing else", async () => {
    const res = await get("/start/auth/google");
    expect(res.status).toBe(303);
    const to = new URL(res.headers.get("location")!);
    expect(to.origin + to.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(to.searchParams.get("client_id")).toBe(WEB_CLIENT);
    expect(to.searchParams.get("response_type")).toBe("code");
    expect(to.searchParams.get("scope")).toBe("openid");
    expect(to.searchParams.get("redirect_uri")).toBe("https://api.eait.fit/start/auth/google/callback");
    expect(to.searchParams.get("state")).toBeTruthy();
    expect(to.searchParams.get("nonce")).toBeTruthy();
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
    router({ ...CONFIG, googleWebClientId: "", googleWebClientSecret: "", authRateLimitPerHour: 1 });
    for (let i = 0; i < 3; i++) {
      expect((await get("/start/auth/google/callback?code=x&state=y")).status).toBe(404);
    }
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
