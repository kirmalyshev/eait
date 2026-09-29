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
  AMBIGUOUS_AGE, COUNTRY_CODES, DEFAULT_ONBOARDING_CONTENT, LANGS, LANG_LABEL, UNDER_AGE_CARD,
  UNDER_AGE_LINES, chatCopyFor, countryLabel, countryOptions, disabledScreens,
  explainTargets, lintCopy, localDate, MAX_USER_LINE, onboardingContentFor, planHeadline,
  projectGoal, projectionMonth, resolveCountry, suggestionFirst,
  screenForStep, screenOptions, suggestedTargetKg, targetSuggestionLine,
  signupCopyFor, weightDisplay, wholeNumbers, type Profile,
} from "@eait/shared";
import { PKCS8_BEGIN, PKCS8_END, configDefaults, type Config } from "../config.ts";
import { demoPorts } from "../llm/demo.ts";
import { memoryStore } from "../store.memory.ts";
import type { Store, StoreOptions } from "../store.ts";
import type { EngineDeps } from "../engine/index.ts";
import { AuthError, type Verifier } from "../auth/verify.ts";
import { BROWSER_SESSION_TTL_MS } from "../auth/tokens.ts";
import { chatHistory, day, handleText, linkTelegram, saveOnboardingContent } from "../engine/index.ts";
import { createRouter } from "../api/routes.ts";
import { fakePush } from "../push/fake.ts";
import { escape, PAGE_COPY } from "./page.ts";
import { pageCopyFor } from "./copy.ts";
import { createWebApp } from "../../frontend/server/index.ts";
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

// A paywall that sells a yearly plan. A checkout URL alone is a config `loadConfig` refuses —
// no price, no currency — so a hand-built Config carries all three.
const PAYWALL: Config["webPaywall"] = {
  yearlyCheckoutUrl: "https://pay.rev.cat/eait/{userId}",
  monthlyCheckoutUrl: "",
  yearlyPrice: 39.99,
  monthlyPrice: 0,
  trialDays: 7,
  exitOfferCheckoutUrl: "",
  exitOfferPrice: 0,
  exitOfferRegularPrice: 0,
  currency: "EUR",
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
  applePrivateKey: `${PKCS8_BEGIN}\nunused-by-the-fake\n${PKCS8_END}`,
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
  deps = { store, config: withWeb, llm, push: fakePush() };
  const handler = createRouter(deps, store, testVerifier, { webProviders: providers });
  handle = (req) => handler(req);
}

const get = (path: string, cookie?: string, headers: Record<string, string> = {}) =>
  handle(new Request(`https://api.eait.fit${path}`, {
    headers: { ...(cookie ? { cookie } : {}), ...headers },
  }));

const post = (
  path: string, form: Record<string, string | string[]>,
  cookie?: string, headers: Record<string, string> = {},
) => {
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
      ...headers,
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

/**
 * Sign in the way a browser would: POST the kickoff with the boxes ticked, follow to the
 * provider, come back with a code.
 *
 * `session` is the pre-account cookie (S8): when it is handed in, the kickoff and the callback
 * both carry it, which is what attaches the identity to the account the questions already ran
 * on rather than creating a second one.
 *
 * `accept` is the browser's `Accept-Language`, carried on BOTH legs because it is read at account
 * creation and nothing revisits it — that was the #358 bug, and a helper that dropped it here
 * could only ever test English.
 */
async function signIn(
  subject = "web-subject",
  name: WebProvider = "google",
  accept?: string,
  session?: string,
  marketing = false,
): Promise<string> {
  const headers = accept ? { "accept-language": accept } : {};
  const start = await post(
    `/start/auth/${name}`,
    marketing ? { terms: "yes", marketing: "yes" } : { terms: "yes" },
    session,
  );
  const state = new URL(start.headers.get("location")!).searchParams.get("state")!;
  const oauth = cookieFrom(start, "eait_oauth");
  const back = await get(
    `/start/auth/${name}/callback?code=${subject}&state=${encodeURIComponent(state)}`,
    session === undefined ? oauth : `${oauth}; ${session}`, headers);
  expect(back.status).toBe(303);
  return cookieFrom(back, "eait_web");
}

/**
 * Answer whatever question is open, until there are none left. Returns the session cookie —
 * which the FIRST answer may have just created: the questions run on the session account (S8),
 * so this works with none handed in and hands back the one it made.
 */
async function answerAll(
  session: string | undefined, answers: Record<string, string | string[]>,
): Promise<string> {
  let cookie = session;
  for (let i = 0; i < 20; i++) {
    const page = await get("/start/q", cookie);
    if (page.status === 303) {
      if (cookie === undefined) throw new Error("the questions never made an account");
      return cookie;
    }
    const html = await page.text();
    const id = html.match(/name="prompt" value="([a-z_]+)"/)?.[1];
    if (!id) throw new Error(`no prompt on the page: ${html.slice(0, 400)}`);
    const answer = answers[id];
    if (answer === undefined) throw new Error(`no answer supplied for ${id}`);
    // The POST goes to the form's own action: its `?asked=` params are how the walk steps past the
    // two answers a mid-run GET cannot see on the profile (diet-as-balanced, medical). A browser
    // posts where the form says; the `&amp;` decode is what its HTML parser would do.
    const action = html.match(/action="([^"]+)"/)?.[1]?.replace(/&amp;/g, "&") ?? "/start/q";
    const res = await post(action, { prompt: id, answer }, cookie);
    expect(res.status).toBe(303);
    const set = res.headers.getSetCookie().find((c) => c.startsWith("eait_web="));
    if (set) cookie = set.split(";")[0]!;
  }
  throw new Error("onboarding did not finish");
}

/**
 * The S8 walk, end to end with NO sign-in first: the questions make the session account, the
 * plan's Continue lands on the sign-up screen, Apple or Google attaches to THAT account, and the
 * deferred country question is answered on its own screen after it.
 */
async function signedUp(
  subject = "web-subject",
  name: WebProvider = "google",
): Promise<{ session: string; userId: string }> {
  const session = await answerAll(undefined, ANSWERS);
  const signed = await signIn(subject, name, undefined, session);
  // The same account — the answers belong to it either way.
  const userId = await webUser(signed);
  const country = await post("/start/country", { answer: "de" }, signed);
  expect(country.status).toBe(303);
  return { session: signed, userId };
}

const ANSWERS: Record<string, string | string[]> = {
  goal: "lose",
  sex: "female",
  birth_year: "34",
  height_cm: "170",
  weight_kg: "80",
  activity: "few",
  target_weight_kg: "70",
  pace: "steady",
  struggles: ["habits"],
  diet: "mediterranean",
  medical: [],
};

beforeEach(() => {
  noncesSeen = [];
  router(CONFIG);
});

describe("the surface is off unless it is configured", () => {
  it("404s every path when no provider is configured", async () => {
    router(CONFIG, {});
    for (const path of ["/start", "/start/q", "/start/plan", "/start/signup", "/start/auth/google", "/start/auth/apple"]) {
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
    expect((await post("/start/auth/apple", { terms: "yes" })).status).toBe(404);
    expect((await get("/start/auth/apple/callback?code=c&state=s")).status).toBe(404);
  });
});

describe("the front door", () => {
  it("renders the welcome, and two doors: the questions and the sign-up", async () => {
    // S8: the front door is the onboarding's welcome, not a sign-in wall — the sign-up screen is
    // where the providers and the consent boxes live, one step in for somebody who needs them.
    const res = await get("/start");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain('href="/start/q"');
    expect(html).toContain('href="/start/signup"');
    expect(html).toContain(signupCopyFor("en").startCta);
    expect(html).toContain(signupCopyFor("en").haveAccountCta);
    expect(html).not.toContain("/start/auth/");
    expect(html).toContain("Spud");
  });
});

describe("the one control script", () => {
  // The inline script's source, cut by string search rather than a tag regex — a regex that
  // filters HTML is the pattern static analysis flags, so there is none here to flag.
  const inlineScript = (html: string): string => {
    const lower = html.toLowerCase();
    const open = lower.indexOf("<script");
    expect(open).toBeGreaterThanOrEqual(0);
    const start = lower.indexOf(">", open) + 1;
    const end = lower.indexOf("</script", start);
    return html.slice(start, end);
  };

  it("ships one first-party script, hashed into the policy", async () => {
    const res = await get("/start");
    const html = await res.text();
    const script = inlineScript(html);
    // The hash, not a nonce: the script never changes, so the policy can name it outright and the
    // page still allows no origin but its own.
    const hash = createHash("sha256").update(script).digest("base64");
    const csp = res.headers.get("content-security-policy")!;
    expect(csp).toContain(`script-src 'sha256-${hash}'`);
    // It is the progressive-enhancement controller: the drag controls' names and the
    // reduced-motion guard are its two signatures.
    expect(script).toContain("data-ctl");
    expect(script).toContain("prefers-reduced-motion");
    // The welcome's recorded loop is same-origin media, and the CSP says so.
    expect(csp).toContain("media-src 'self'");
  });

  it("parses as JavaScript — a cooked escape in the template kills every page silently", async () => {
    // CONTROL_SCRIPT is a TEMPLATE LITERAL that emits JavaScript: `\p` inside it cooks to a
    // plain `p` and the country's accent-folding regex ships as `/p{M}/` — a SyntaxError that
    // disabled EVERY enhancement on every page and the suite only noticed because a live
    // filter stopped hiding rows. So the source text is compiled here, the same failure the
    // browser had.
    const res = await get("/start");
    const html = await res.text();
    const script = inlineScript(html);
    expect(() => new Function(script)).not.toThrow();
    // And the specific folding regex is the doubled-backslash one, surviving to the wire.
    expect(script).toContain("\\p{M}");
  });
});

describe("the sign-up screen", () => {
  it("offers one button per provider, Apple first, inside the consent form", async () => {
    const html = await (await get("/start/signup")).text();
    expect(html).toContain("Continue with Apple");
    expect(html).toContain("Continue with Google");
    expect(html.indexOf("/start/auth/apple")).toBeLessThan(html.indexOf("/start/auth/google"));
    // The boxes, and both of them bound to the form the buttons submit (`form=` keeps them below
    // the pairing card, where the board draws them).
    expect(html).toContain('name="terms"');
    expect(html).toContain('name="marketing"');
    expect(html).toContain('form="signup"');
    expect(html).toContain(signupCopyFor("en").signUpHeading);
  });

  it("is the board: the plate on top, the marks on the buttons, the boxes unticked", async () => {
    const html = await (await get("/start/signup")).text();
    // The hero is this origin's own asset — `img-src 'self'` — and the licence lives beside it.
    expect(html).toContain('/start/assets/img/hero.webp');
    // Apple in black, Google secondary — the buttons carry the brands' own artwork.
    expect(html).toContain('class="cta apple"');
    expect(html.indexOf('cta apple')).toBeLessThan(html.indexOf('cta s"'));
    // Both boxes drawn but NEITHER ticked — consent is a choice, not a default.
    expect(html.match(/name="terms"[^>]*checked/g) ?? []).toHaveLength(0);
    expect(html.match(/name="marketing"[^>]*checked/g) ?? []).toHaveLength(0);
    // The pairing card names where the code comes from — the shipped tab's own word.
    expect(html).toContain(PAGE_COPY.pairLead.replace("{tab}", "Profile"));
  });

  it("offers only what is configured", async () => {
    router(CONFIG, { apple: PROVIDERS.apple! });
    const html = await (await get("/start/signup")).text();
    expect(html).toContain("Continue with Apple");
    expect(html).not.toContain("Continue with Google");
  });

  it("carries the pairing card, for somebody whose account is on a phone already", async () => {
    const html = await (await get("/start/signup")).text();
    expect(html).toContain('action="/start/pair"');
    expect(html).toContain('method="post"');
    expect(html).toContain('name="code"');
  });
});

describe("signing in", () => {
  it.each(["apple", "google"] as const)(
    "sends the browser to %s asking for openid and nothing else",
    async (name) => {
      // A POST — the kickoff is a write, and the consent boxes are what it carries (S8).
      const res = await post(`/start/auth/${name}`, { terms: "yes" });
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

  it("starts nothing on a GET — a kickoff without consent is no kickoff", async () => {
    const res = await get("/start/auth/google");
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/start/signup");
    expect(res.headers.getSetCookie()).toEqual([]);
  });

  it("sends a POST without the terms tick back to the screen, starting nothing", async () => {
    const res = await post("/start/auth/google", {});
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/start/signup?error=terms");
    // No state cookie minted means no callback can ever complete — the defence is structural.
    expect(res.headers.getSetCookie()).toEqual([]);
  });

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
    const to = new URL(
      (await post("/start/auth/google", { terms: "yes" })).headers.get("location")!,
    );
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
      const start = await post("/start/auth/apple", { terms: "yes" });
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
      const start = await post("/start/auth/apple", { terms: "yes" });
      const oauth = cookieFrom(start, "eait_oauth");
      const bridged = await post("/start/auth/apple/callback", { code: "c", state: "forged" });
      const back = await handle(new Request(
        new URL(bridged.headers.get("location")!, "https://api.eait.fit").toString(),
        { headers: { cookie: oauth } },
      ));
      expect(back.headers.get("location")).toBe("/start/signup?error=1");
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
    const line = (await post("/start/auth/google", { terms: "yes" })).headers.getSetCookie()
      .find((c) => c.startsWith("eait_oauth="))!;
    expect(line).toContain("HttpOnly");
    expect(line).toContain("SameSite=Lax");
    expect(line).toContain("Secure");
  });

  it("refuses a callback whose state does not match the cookie", async () => {
    const start = await post("/start/auth/google", { terms: "yes" });
    const oauth = cookieFrom(start, "eait_oauth");
    const res = await get("/start/auth/google/callback?code=x&state=not-the-one", oauth);
    expect(res.headers.getSetCookie().some((c) => c.startsWith("eait_web="))).toBe(false);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/start/signup?error=");
  });

  it("refuses a callback with no cookie at all", async () => {
    const res = await get("/start/auth/google/callback?code=x&state=anything");
    expect(res.headers.getSetCookie().some((c) => c.startsWith("eait_web="))).toBe(false);
  });

  it("passes the nonce it generated to the verifier", async () => {
    const start = await post("/start/auth/google", { terms: "yes" });
    const nonce = new URL(start.headers.get("location")!).searchParams.get("nonce");
    await get(
      `/start/auth/google/callback?code=s&state=${encodeURIComponent(new URL(start.headers.get("location")!).searchParams.get("state")!)}`,
      cookieFrom(start, "eait_oauth"),
    );
    expect(noncesSeen).toEqual([nonce!]);
  });

  it("mints a session for a new identity and sends it to the questions", async () => {
    const start = await post("/start/auth/google", { terms: "yes" });
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
    const start = await post("/start/auth/google", { terms: "yes" });
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
    const start = await post("/start/auth/google", { terms: "yes" });
    const state = new URL(start.headers.get("location")!).searchParams.get("state")!;
    const res = await get(
      `/start/auth/apple/callback?code=whoever&state=${encodeURIComponent(state)}`,
      cookieFrom(start, "eait_oauth"),
    );
    expect(res.headers.getSetCookie().some((c) => c.startsWith("eait_web="))).toBe(false);
    expect(res.headers.get("location")).toContain("/start/signup?error=");
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
    const start = await post("/start/auth/google", { terms: "yes" });
    const state = new URL(start.headers.get("location")!).searchParams.get("state")!;
    const res = await get(
      `/start/auth/google/callback?code=bad-code&state=${encodeURIComponent(state)}`,
      cookieFrom(start, "eait_oauth"),
    );
    expect(res.headers.getSetCookie().some((c) => c.startsWith("eait_web="))).toBe(false);
    expect(res.headers.get("location")).toContain("/start/signup?error=");
  });
});

describe("the questions", () => {
  it("opens to somebody with no session at all — the first answer is what makes the account", async () => {
    // S8: onboarding runs on the session account, which does not exist until an answer lands.
    const res = await get("/start/q");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('name="prompt" value="goal"');
    // No cookie is minted by a page view — an account exists only once an answer landed.
    expect(res.headers.getSetCookie()).toEqual([]);
  });

  it("is rate-limited like device sign-up — over the limit it is a 429 and no row", async () => {
    // The sessionless first answer mints an account, so it takes the same per-address allowance
    // the sign-in routes take: without it, this form is a `users` row per POST for a bot.
    router({ ...CONFIG, authRateLimitPerHour: 1 });
    // Spend the one allowance — a pairing attempt does it, whatever the code names.
    await post("/start/pair", { code: "ZZZZZZZZ" });

    const res = await post("/start/q", { prompt: "goal", answer: "lose" });
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
    // No cookie, and more to the point no ACCOUNT — the charge stood between the answer and the
    // row it would have made.
    expect(res.headers.getSetCookie().some((c) => c.startsWith("eait_web="))).toBe(false);
    const { rows } = await store.adminListUsers({ limit: 10, today: localDate(CONFIG.timezone) });
    expect(rows).toHaveLength(0);
  });

  it("makes the session account on the first answer, and hands back the cookie for it", async () => {
    const res = await post("/start/q", { prompt: "goal", answer: "lose" });
    expect(res.status).toBe(303);
    const cookie = cookieFrom(res, "eait_web");
    const userId = await webUser(cookie);
    // The answer is the account's already — nothing about it waits for sign-up (S8).
    expect((await store.getProfile(userId))!.goal).toBe("lose");
    // And the account carries no identity yet — the sign-up screen is where it gets one.
    expect((await store.listIdentities(userId)).map((i) => i.provider)).toEqual([]);
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
      const action = html.match(/action="([^"]+)"/)?.[1]?.replace(/&amp;/g, "&") ?? "/start/q";
      await post(action, { prompt: id, answer: ANSWERS[id]! }, session);
    }
    // Country is NOT in the walk any more (S8): it waits for the sign-up and gets a screen of its
    // own after it, at `/start/country` — the tests for that screen are with it.
    expect(disabledScreens(DEFAULT_ONBOARDING_CONTENT)).toEqual([]);
    expect(asked).toEqual([
      "goal", "sex", "birth_year", "height_cm", "weight_kg",
      "activity", "target_weight_kg", "pace", "struggles", "diet", "medical",
    ]);
  });

  it("re-asks a refused answer in the server's own words, and changes nothing", async () => {
    const session = await signIn();
    await post("/start/q", { prompt: "goal", answer: "lose" }, session);
    await post("/start/q", { prompt: "sex", answer: "female" }, session);
    await post("/start/q", { prompt: "birth_year", answer: "1990" }, session);
    await post("/start/q", { prompt: "height_cm", answer: "170" }, session);
    await post("/start/q", { prompt: "weight_kg", answer: "80" }, session);
    await post("/start/q", { prompt: "activity", answer: "few" }, session);
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
    const res = await post("/start/q", { prompt: "activity", answer: "few" }, session);
    expect(res.status).toBe(303);
    const userId = (await store.userIdForToken(session.split("=")[1]!))!;
    expect((await store.getProfile(userId))!.activity).toBeNull();
  });

});

describe("the plan reveal", () => {
  it("follows the last answer — the completing post lands on the reveal, a resume on the plan", async () => {
    // Drive the walk by hand so the LAST post's redirect is the one asserted.
    let cookie = await signIn();
    for (let i = 0; i < 20; i++) {
      const page = await get("/start/q", cookie);
      if (page.status === 303) break;
      const html = await page.text();
      const id = html.match(/name="prompt" value="([a-z_]+)"/)?.[1]!;
      const action = html.match(/action="([^"]+)"/)?.[1]?.replace(/&amp;/g, "&") ?? "/start/q";
      const res = await post(action, { prompt: id, answer: ANSWERS[id]! }, cookie);
      expect(res.status).toBe(303);
      const set = res.headers.getSetCookie().find((c) => c.startsWith("eait_web="));
      if (set) cookie = set.split(";")[0]!;
      if (id === "medical") {
        // The patch that wrote `complete_onboarding` answers with the reveal — once.
        expect(res.headers.get("location")).toBe("/start/building");
      }
    }
    // …and a resume goes to the plan, not back through the countdown.
    expect((await get("/start/q", cookie)).headers.get("location")).toBe("/start/plan");
  });

  it("counts to 100 while the plan's own rows tick in, then offers the plan", async () => {
    const session = await signIn();
    await answerAll(session, { ...ANSWERS, medical: ["ldl"] });
    const html = await (await get("/start/building", session)).text();
    const profile = (await store.getProfile(await webUser(session)))!;
    const { targets } = explainTargets(profile);
    const n = wholeNumbers("en");

    expect(html).toContain("Building your personal plan");
    // The counter's target is carried on the element — the count verb fills it (S1).
    expect(html).toContain("--to:100");
    // The card's title and each row's label are the content's; every VALUE is computed.
    expect(html).toContain("Your daily plan");
    for (const value of [n(targets.kcal), `${n(targets.protein_g)} g`, `${n(targets.carbs_g)} g`, `${n(targets.fat_g)} g`, "Mediterranean"]) {
      expect(html).toContain(`<b class="num">${value}</b>`);
    }
    // The declared cap is a row of its own (the seventh), filled from the same targets.
    expect(html).toContain(`sat fat ≤ ${n(targets.satfat_g!)} g`);
    // Six rows at S5's marks; a seventh shares the last tick.
    for (const d of ["0.5s", "1s", "1.6s", "2.1s", "2.7s", "3.3s"]) {
      expect(html).toContain(`--d:${d}`);
    }
    // The button at 100 %, and the plan opens a second later for anybody who does not tap.
    expect(html).toContain('href="/start/plan"');
    expect(html).toContain("Show me the plan");
    expect(html).toContain('http-equiv="refresh"');
    expect(html).toContain("4.5;url=/start/plan");
  });

  it("answers the front door without a session, and the questions while the profile is unfinished", async () => {
    const noSession = await get("/start/building");
    expect(noSession.status).toBe(303);
    expect(noSession.headers.get("location")).toBe("/start");
    const session = await signIn();
    const res = await get("/start/building", session);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/start/q");
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
    // GROUPED THE READER'S WAY — "1,686" in English, "1.686" in German. Every figure this product
    // writes goes through `Intl` (`lang.ts`), and the plan card was the last one that did not.
    expect(html).toContain(wholeNumbers(profile.lang)(targets.kcal));
    // The plan's one way on is the sign-up screen (S8): consent and the provider buttons live
    // there, and the first meal is behind them.
    expect(html).toContain('href="/start/signup"');
  });

  it("says when the floor decided the number", async () => {
    const session = await signIn();
    // Small, light, barely active and pushing: the deficit runs into `KCAL_FLOOR`.
    await answerAll(session, {
      ...ANSWERS, height_cm: "150", weight_kg: "48", target_weight_kg: "44", pace: "push",
      activity: "few",
    });
    const userId = (await store.userIdForToken(session.split("=")[1]!))!;
    const profile = (await store.getProfile(userId))! as Profile;
    const { basis } = explainTargets(profile);
    expect(basis.floorApplied).toBe(true);
    const html = await (await get("/start/plan", session)).text();
    // The marker names the cap, and its note sits one tap behind — the floor's own words.
    const content = onboardingContentFor("en");
    expect(html).toContain(content.summary.floorMarker.replace("{floor}", wholeNumbers("en")(basis.floorKcal)));
    expect(html).toContain(content.building.floorTitle);
  });

  it("serves the offer to the route that asks for it, only when one is configured", async () => {
    const session = await signIn();
    await answerAll(session, ANSWERS);
    expect(await (await get("/start/plan", session)).text()).not.toContain("pay.rev.cat");
    // Nothing configured is nothing to offer — the soft offer has no screen of its own either.
    expect((await get("/start/offer", session)).status).toBe(303);

    router({ ...CONFIG, webPaywall: PAYWALL });
    const second = await signIn();
    await answerAll(second, ANSWERS);
    const userId = (await store.userIdForToken(second.split("=")[1]!))!;
    // The plan page's only way on is the sign-up (W3): the offer keeps its own route.
    const html = await (await get("/start/plan", second)).text();
    expect(html).not.toContain('href="/start/offer"');
    const offer = await (await get("/start/offer", second)).text();
    expect(offer).toContain('href="/start/checkout"');
    expect((await get("/start/checkout", second)).headers.get("location")).toBe(`https://pay.rev.cat/eait/${userId}`);
  });

  it("sends an unfinished profile back to the questions", async () => {
    const session = await signIn();
    const res = await get("/start/plan", session);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/start/q");
  });

  it("delivers the welcome's promise: the goal line, the estimate graph, the declared marker", async () => {
    // On a deployment WITH a web application — which is also where the language picker must be
    // gone, because the app's own settings carry it there.
    router({ ...CONFIG }, undefined, undefined, true);
    const session = await signIn();
    // High cholesterol declared: saturated fat is scored, and the plan says so with the same cap
    // the verdicts will be computed against — `targets`, not a figure typed into the page.
    await answerAll(session, { ...ANSWERS, medical: ["ldl"] });

    const html = await (await get("/start/plan", session)).text();
    const profile = (await store.getProfile(await webUser(session)))!;
    const { targets } = explainTargets(profile);
    const n = wholeNumbers("en");

    // The headline is the shared S6 sentence — `planHeadline` computes it, and the month is the
    // one `projectGoal` lands on. Nothing is typed into the page.
    const headline = planHeadline(profile, new Date(), "metric", "en");
    expect(headline).not.toBeNull();
    expect(html).toContain(headline!);
    const projection = projectGoal(profile, explainTargets(profile).basis);
    expect(projection).not.toBeNull();
    expect(html).toContain(projectionMonth(new Date(), projection!.weeks, "en"));

    // The estimate graph, drawn: the shared curve, the chip naming the target, the two labels.
    expect(html).toContain('class="pgraph"');
    expect(html).toContain("M20 34 C110 34 200 110 292 110");
    expect(html).toContain(`Target ${weightDisplay(profile.target_weight_kg!, null, "en")}`);
    expect(html).toContain(chatCopyFor("en").chart.estimatedProgress);
    expect(html).toContain(chatCopyFor("en").chart.byEait);

    // The four figures are `explainTargets`' — a page that drifts fails on its own numbers.
    expect(html).toContain(`<b class="num">${n(targets.kcal)}</b>`);
    expect(html).toContain(`${n(targets.protein_g)} g`);
    expect(html).toContain(`${n(targets.carbs_g)} g`);
    expect(html).toContain(`${n(targets.fat_g)} g`);
    // The declared cap is a card of its own — and ONLY because it was declared.
    expect(html).toContain(`${n(targets.satfat_g!)} g`);
    expect(html).toContain("Saturated fat");

    // The primary is the sign-up screen (S8): the account needs an identity before a meal can
    // be read, and `/start/signup` is where the consent and the buttons live.
    expect(html).toContain(pageCopyFor("en").continueLabel);
    expect(html).toContain('href="/start/signup"');
    expect(html).not.toContain('<select name="lang"');
  });

  it("keeps the language picker where there is no web application to hold it", async () => {
    // Then it is the only place to change it — removing it would strand the account's language.
    const session = await signIn();
    await answerAll(session, ANSWERS);
    const html = await (await get("/start/plan", session)).text();
    expect(html).toContain('<select name="lang"');
  });

  it("names no month for a maintain goal — there is nowhere to arrive", async () => {
    const session = await signIn();
    await answerAll(session, { ...ANSWERS, goal: "maintain" });
    const profile = (await store.getProfile(await webUser(session)))!;
    expect(projectGoal(profile, explainTargets(profile).basis)).toBeNull();
    const html = await (await get("/start/plan", session)).text();
    // No headline and no estimate graph: `projectGoal` refused, so the page has nothing to draw.
    expect(html).not.toContain('class="goal');
    expect(html).not.toContain('class="pgraph"');
    expect(html).not.toMatch(/(January|February|March|April|May|June|July|August|September|October|November|December) \d{4}/);
  });

  it("shows no saturated fat to somebody who never asked for it", async () => {
    const session = await signIn();
    await answerAll(session, ANSWERS); // restrictions: []
    const html = await (await get("/start/plan", session)).text();
    // The card is drawn BECAUSE the cap was declared — an undeclared profile meets neither the
    // label nor the icon.
    expect(html).not.toContain("Saturated fat");
    // The stylesheet knows the icon's class; the CARD is what must not be drawn.
    expect(html).not.toContain('<i class="ico i-satfat">');
    expect(html).not.toContain("Sodium");
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
        target_weight_kg: 70, activity: "few", pace: "steady", country: "de",
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
  it("takes a signed-in app account's thread into a browser, and a turn lands in it", async () => {
    const app = await appSession();
    // Under S8 an anonymous account is refused analysis — a real pairing happens after the phone
    // has signed up, so this one has a Google identity like the flow produces.
    await handle(new Request("https://api.eait.fit/v1/auth/google", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${app}` },
      body: JSON.stringify({ idToken: `ok:google:pair-${crypto.randomUUID()}`, terms: true }),
    }));
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
    expect(second.headers.get("location")).toBe("/start/signup?error=code");
    expect(second.headers.getSetCookie()).toEqual([]);
  });

  it("sends an unknown code back to the sign-up screen with words about it, and sets no cookie", async () => {
    const res = await post("/start/pair", { code: "ABCD2345" });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/start/signup?error=code");
    expect(res.headers.getSetCookie()).toEqual([]);

    // The page that redirect lands on says which thing went wrong — a code, not a sign-in.
    const door = await (await get("/start/signup?error=code")).text();
    expect(door).toContain(PAGE_COPY.errorPair);
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

  it("offers the form on the sign-up screen, and it posts", async () => {
    // Under S8 the front door is the welcome — a person holding a code their phone minted is
    // somebody who already has an account, which is the door the sign-up screen is for.
    const html = await (await get("/start/signup")).text();
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
    // A dead cookie on the pre-account surface is simply no cookie: the questions render, and no
    // profile lookup crashes into a JSON 500 on an HTML page.
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('name="prompt" value="goal"');
  });

  it("does not answer 500 to a cookie that is not valid percent-encoding", async () => {
    const res = await get("/start/q", "eait_web=%");
    // An unusable cookie is no session, and `/start/q` is the one route that needs none — the
    // questions render rather than a `decodeURIComponent` throw reaching the router's JSON 500.
    expect(res.status).toBe(200);
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
    expect(html).toContain(AMBIGUOUS_AGE("en").line(90));
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
    expect(html).toContain(UNDER_AGE_LINES("en").ask);
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
    expect(html).toContain(UNDER_AGE_CARD("en").title);
    expect(html).toContain(escape(UNDER_AGE_LINES("en").stopped[0]!));
    // "I'm deleting everything you told me" (#65) — so by the time the page renders, there is none.
    expect(await store.getProfile(userId)).toBeNull();
    expect(await store.userIdForToken(session.split("=")[1]!)).toBeNull();
    expect(res.headers.getSetCookie().some((c) => c.startsWith("eait_web=;"))).toBe(true);
  });
});

describe("a target that runs the wrong way", () => {
  const toTarget = async (session: string) => {
    for (const [prompt, answer] of [
      ["goal", "lose"], ["sex", "female"], ["birth_year", "34"],
      ["height_cm", "170"], ["weight_kg", "80"], ["activity", "few"],
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

// ── The v5 walk (#42): reactions, the stepper, the moments, the soft offer ────────────────────
//
// Every answer gets Spud's one line back, spoken above the next question; the four support beats
// are whole screens of their own; the target weight is a stepper that starts at the shared
// suggestion. None of it is JavaScript — the stepper's buttons are plain form submits, the
// moments are GET pages a POST redirects to.

/** Walk a session to the question named, one real POST at a time, and return its HTML. */
const walkTo = async (session: string, stopAt: string): Promise<string> => {
  let next = "/start/q";
  for (let i = 0; i < 20; i++) {
    const page = await get(next, session);
    if (page.status === 303) throw new Error(`walk ended before ${stopAt}`);
    const html = await page.text();
    const m = html.match(/name="prompt" value="([a-z_]+)"/);
    if (m === null) {
      // An interstitial (`?show=how` / `?show=ontrack`): its Continue is a link, not a form.
      const href = html.match(/<a[^>]*class="cta[^"]*"[^>]*href="([^"]+)"/)?.[1]
        ?? html.match(/<a[^>]*href="([^"]+)"[^>]*class="cta[^"]*"/)?.[1];
      if (href === undefined) throw new Error("a page with neither a prompt nor a continue");
      next = href.replace(/&amp;/g, "&");
      continue;
    }
    const id = m[1]!;
    if (id === stopAt) return html;
    const action = html.match(/action="([^"]+)"/)?.[1]?.replace(/&amp;/g, "&") ?? "/start/q";
    const res = await post(action, { prompt: id, answer: ANSWERS[id]! }, session);
    next = res.headers.get("location") ?? "/start/q";
    if (res.status !== 303) throw new Error(`${id} refused: ${res.status}`);
  }
  throw new Error(`never reached ${stopAt}`);
};

describe("the v2 questions that write the new fields", () => {
  it("stores the struggle picks in list order, whatever order they were tapped", async () => {
    const session = await signIn();
    await walkTo(session, "struggles");
    const html = await (await get("/start/q", session)).text();
    expect(html).toContain('name="prompt" value="struggles"');
    // The chips are the new vocabulary's, labelled from the content — none of the retired eight.
    expect(html).toContain('value="consistency"');
    expect(html).not.toContain('value="binge"');
    const res = await post("/start/q", { prompt: "struggles", answer: ["ideas", "busy"] }, session);
    expect(res.status).toBe(303);
    expect((await store.getProfile(await webUser(session)))!.struggles).toEqual(["busy", "ideas"]);
  });

  it("sends the diet pick AS diet and lets the server write the tag", async () => {
    const session = await signIn();
    await walkTo(session, "diet");
    const res = await post("/start/q", { prompt: "diet", answer: "pescatarian" }, session);
    expect(res.status).toBe(303);
    expect((await store.getProfile(await webUser(session)))!.restrictions).toEqual(["pescatarian"]);
  });

  it("carries EVERY asked marker forward — a mid-walk write keeps the marks it was passed", async () => {
    const session = await signIn();
    // Posting the diet while `?asked=diet` still marks it: a `set` where the list needs an
    // `append` drops it, and the diet question comes back asking again.
    await walkTo(session, "diet");
    const res = await post("/start/q?asked=diet", { prompt: "diet", answer: ["pescatarian"] }, session);
    const loc = res.headers.get("location") ?? "";
    expect(loc).toContain("asked=diet");
    // The COMPLETING write is the exception — it answers with the reveal (W3), not a /q
    // redirect whose marks would only be read by a page that no longer exists.
    await walkTo(session, "medical");
    const done = await post("/start/q?asked=diet", { prompt: "medical", answer: ["none"] }, session);
    expect(done.headers.get("location")).toBe("/start/building");
  });

  it("writes medical [] for 'none', and keeps a picked diet", async () => {
    const session = await signIn();
    await walkTo(session, "medical");
    const res = await post("/start/q", { prompt: "medical", answer: ["none"] }, session);
    expect(res.status).toBe(303);
    // The diet tag survives the medical write — the two views share one column without touching
    // each other's subset.
    expect((await store.getProfile(await webUser(session)))!.restrictions).toEqual(["mediterranean"]);
  });

  it("finishes onboarding on the LAST question's patch — `medical`, and the plan's gate holds", async () => {
    const session = await signIn();
    await answerAll(session, ANSWERS);
    // Medical was the last field prompt, so the profile is onboarded already — and the plan's gate
    // agrees, which is `full.onboarded` on the same `onboarded_at`.
    expect((await store.getProfile(await webUser(session)))!.onboarded_at).not.toBeNull();
    expect((await get("/start/q", session)).headers.get("location")).toBe("/start/plan");
  });
});

describe("the target-weight ruler", () => {
  /** 80 kg at 170 cm → the suggested target is 73.5, the healthy floor about 53.5. */
  it("opens on the shared suggestion, said as the ask, with the refused zone drawn", async () => {
    const session = await signIn();
    const html = await walkTo(session, "target_weight_kg");
    // `targetSuggestionLine` is Spud's ask here, per the design — the admin's own ask is not
    // ALSO said, or the screen is two questions at once.
    expect(html).toContain("I suggest 73.5 kg");
    // The control is the ruler: the suggestion is its needle, carried as data-val AND as the
    // plain input's value — the same number with or without the script.
    expect(html).toContain('data-ctl="ruler"');
    expect(html).toContain('data-val="73.5"');
    expect(html).toMatch(/type="number"[^>]*name="answer"[^>]*value="73\.5"/);
    // The refused zone and the "now" marker are drawn, with the floor's own words on them.
    expect(html).toContain('data-floor="54"');
    expect(html).toContain('data-now="80"');
    expect(html).toContain("lowest we set");
    // The live delta says how far the needle sits from now, in the copy's own words — a
    // placeholder left unfilled would print "{weight}" raw inside the live line.
    expect(html).toMatch(/<div class="live[^>]*>[^<]*6\.5 kg<\//);
    expect(html).not.toMatch(/<div class="live[^>]*>[^<]*\{weight\}/);
  });

  it("writes the typed answer straight through — there is no preview state", async () => {
    const session = await signIn();
    await walkTo(session, "target_weight_kg");
    const userId = await webUser(session);
    const res = await post("/start/q", { prompt: "target_weight_kg", answer: "70" }, session);
    expect(res.status).toBe(303);
    expect((await store.getProfile(userId))!.target_weight_kg).toBe(70);
  });

  it("refuses below the floor, drawn or typed — the bound is the server's", async () => {
    // 170 cm tall at 56 kg: the healthy floor is ~53.5, so the suggestion IS the floor.
    const session = await signIn();
    await post("/start/q", { prompt: "goal", answer: "lose" }, session);
    await post("/start/q", { prompt: "sex", answer: "female" }, session);
    await post("/start/q", { prompt: "birth_year", answer: "35" }, session);
    await post("/start/q", { prompt: "height_cm", answer: "170" }, session);
    await post("/start/q", { prompt: "weight_kg", answer: "56" }, session);
    await post("/start/q", { prompt: "activity", answer: "few" }, session);
    const html = await (await get("/start/q", session)).text();
    expect(html).toContain('name="prompt" value="target_weight_kg"');
    expect(html).toContain('value="54"');
    // A crafted POST does no better: the refusal is `checkNumber`'s, not the markup's.
    const res = await post("/start/q", { prompt: "target_weight_kg", answer: "50" }, session);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("The lowest target we can plan for at your height is 54 kg");
  });

  it("still draws the ruler when there is nothing to suggest", async () => {
    // At the floor already (54 kg at 170 cm) a lose target has no suggestion — today's behaviour.
    const session = await signIn();
    await post("/start/q", { prompt: "goal", answer: "lose" }, session);
    await post("/start/q", { prompt: "sex", answer: "female" }, session);
    await post("/start/q", { prompt: "birth_year", answer: "35" }, session);
    await post("/start/q", { prompt: "height_cm", answer: "170" }, session);
    await post("/start/q", { prompt: "weight_kg", answer: "54" }, session);
    await post("/start/q", { prompt: "activity", answer: "few" }, session);
    const html = await (await get("/start/q", session)).text();
    expect(html).toContain('name="prompt" value="target_weight_kg"');
    expect(html).toContain('data-ctl="ruler"');
    expect(html).toContain('type="number"');
  });
});

describe("the soft offer after the plan", () => {
  const toPlan = async (webApp = false): Promise<string> => {
    router(
      { ...CONFIG, webPaywall: PAYWALL },
      undefined, undefined, webApp,
    );
    const session = await signIn();
    await answerAll(session, ANSWERS);
    return session;
  };

  it("heads the offer with the computed target and month, never literals", async () => {
    const session = await toPlan();
    const html = await (await get("/start/offer", session)).text();
    // offerHeadline(): 80 kg → 70 by a named month — a claim the projection stands behind.
    expect(html).toContain("Get to 70 kg by");
  });

  it("says the three perks and the honest timeline, with no invented price", async () => {
    const session = await toPlan();
    const html = await (await get("/start/offer", session)).text();
    for (const perk of [
      "Honest macros on every meal",
      "Your plan moves when your weight does",
      "Spud, any time you ask",
    ]) expect(html).toContain(escape(perk));
    expect(html).toContain("Free for 7 days");
    expect(html).toContain("We remind you");
    expect(html).toContain("cancel any time");
    expect(html).not.toContain("$");
  });

  it("makes 'Start my free week' the checkout route, which sends THIS account to the checkout", async () => {
    const session = await toPlan();
    const userId = await webUser(session);
    const html = await (await get("/start/offer", session)).text();
    expect(html).toContain("Start my free week");
    expect(html).toContain('href="/start/checkout"');
    // One route both offers link to — this page and the web app's offer that holds — so the id is
    // filled in one place, from the session, and never carried by a client.
    const res = await get("/start/checkout", session);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`https://pay.rev.cat/eait/${userId}`);
  });

  it("sends nobody to a checkout without a session, and has no checkout route when none is configured", async () => {
    await toPlan();
    const anonymous = await get("/start/checkout", undefined);
    expect(anonymous.status).toBe(303);
    expect(anonymous.headers.get("location")).toBe("/start");
    router(CONFIG);
    const session = await signIn();
    expect((await get("/start/checkout", session)).status).toBe(404);
  });

  // #77 — one paid link per configured plan, and the exit offer's own.
  it("routes ?plan= to that plan's checkout, with the same account named", async () => {
    router({ ...CONFIG, webPaywall: { ...PAYWALL,
      yearlyCheckoutUrl: "https://pay.rev.cat/y/{userId}",
      monthlyCheckoutUrl: "https://pay.rev.cat/m/{userId}",
      monthlyPrice: 4.99,
      exitOfferCheckoutUrl: "https://pay.rev.cat/u/{userId}",
      exitOfferPrice: 23.99,
    } });
    const session = await signIn();
    const userId = await webUser(session);
    expect((await get("/start/checkout", session)).headers.get("location"))
      .toBe(`https://pay.rev.cat/y/${userId}`);
    expect((await get("/start/checkout?plan=yearly", session)).headers.get("location"))
      .toBe(`https://pay.rev.cat/y/${userId}`);
    expect((await get("/start/checkout?plan=monthly", session)).headers.get("location"))
      .toBe(`https://pay.rev.cat/m/${userId}`);
    expect((await get("/start/checkout?plan=exit", session)).headers.get("location"))
      .toBe(`https://pay.rev.cat/u/${userId}`);
  });

  it("has no route for a plan the host does not sell, and none it never heard of", async () => {
    router({ ...CONFIG, webPaywall: { ...PAYWALL, yearlyCheckoutUrl: "",
      monthlyCheckoutUrl: "https://pay.rev.cat/m/{userId}", monthlyPrice: 4.99 } });
    const session = await signIn();
    const userId = await webUser(session);
    // Only monthly is configured: it answers, and the bare link falls back to the one plan.
    expect((await get("/start/checkout?plan=monthly", session)).headers.get("location"))
      .toBe(`https://pay.rev.cat/m/${userId}`);
    expect((await get("/start/checkout", session)).headers.get("location"))
      .toBe(`https://pay.rev.cat/m/${userId}`);
    expect((await get("/start/checkout?plan=yearly", session)).status).toBe(404);
    expect((await get("/start/checkout?plan=exit", session)).status).toBe(404);
    expect((await get("/start/checkout?plan=weekly", session)).status).toBe(404);
  });

  it("links the privacy policy under the offer, where one is published", async () => {
    router({ ...CONFIG, webPaywall: PAYWALL, landingUrl: "https://eait.fit" });
    const session = await signIn();
    await answerAll(session, ANSWERS);
    const html = await (await get("/start/offer", session)).text();
    expect(html).toContain('href="https://eait.fit/privacy"');
  });

  it("lets the offer go quietly — × is the web app's first meal", async () => {
    const session = await toPlan(true);
    const html = await (await get("/start/offer", session)).text();
    // The plan page's own way into the app: the root route, which renders the one-meal flow
    // while nothing is logged.
    expect(html).toMatch(/aria-label="[^"]*"[^>]*>×<\/a>/);
    expect(html).toContain('href="/"');
  });

  it("keeps the offer behind its own route — the plan's only ask is the sign-up (W3)", async () => {
    const session = await toPlan();
    const html = await (await get("/start/plan", session)).text();
    expect(html).not.toContain('href="/start/offer"');
    const offer = await get("/start/offer", session);
    expect(offer.status).toBe(200);
  });

  it("is not a screen to land on early, or to sell nothing on", async () => {
    // Mid-walk there is no plan behind it — the offer redirects back to the questions.
    const session = await signIn();
    const early = await get("/start/offer", session);
    expect(early.status).toBe(303);
    expect(early.headers.get("location")).toBe("/start/q");

    // No checkout configured is nothing to offer: straight to where × would have gone.
    router({ ...CONFIG }, undefined, undefined, false);
    const session2 = await signIn();
    await answerAll(session2, ANSWERS);
    const noCheckout = await get("/start/offer", session2);
    expect(noCheckout.status).toBe(303);
    expect(noCheckout.headers.get("location")).toBe("/start/chat");
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
      .toContain(escape(PAGE_COPY.chatRefusalSubscription));
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

describe("the session account, before and after sign-up (S8)", () => {
  it("refuses a photo on an account nobody has signed into — a notice, never an analysis", async () => {
    // The plan was shown and the answers are all collected, but the account holds no Apple or
    // Google identity: a photo is answered `identity-required` and the free sample is not spent.
    const session = await answerAll(undefined, ANSWERS);
    const res = await upload([jpegBytes(1)], session);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/start/chat?notice=identity-required");
    expect(await store.countUserAnalyses(await webUser(session))).toBe(0);
    // And the notice is words the person can act on — the sign-up screen, one step back.
    const page = await (await get("/start/chat?notice=identity-required", session)).text();
    expect(page).toContain(PAGE_COPY.chatRefusalIdentity);
  });

  it("lets a question be asked in chat on the same terms — refused until an identity attaches", async () => {
    const session = await answerAll(undefined, ANSWERS);
    const res = await post("/start/chat/say", { text: "two eggs and toast" }, session);
    expect(res.headers.get("location")).toBe("/start/chat?notice=identity-required");
    expect(await store.countUserAnalyses(await webUser(session))).toBe(0);
  });

  it("keeps every answer when the provider attaches to the session account", async () => {
    const session = await answerAll(undefined, ANSWERS);
    const before = (await store.getProfile(await webUser(session)))!;
    const signed = await signIn("keeps-answers", "google", undefined, session);
    // The SAME account, with the answers still on it — that is the whole ticket.
    const userId = await webUser(signed);
    const after = (await store.getProfile(userId))!;
    for (const field of ["goal", "sex", "birth_year", "height_cm", "weight_kg", "target_weight_kg", "activity", "pace"]) {
      expect(after[field as keyof typeof after]).toEqual(before[field as keyof typeof after]);
    }
    expect((await store.listIdentities(userId)).map((i) => i.provider)).toContain("google");
  });

  it("keeps the existing account's id, and merges a session's answers into it field by field", async () => {
    // The overseer's call on #85: the account the identity already names wins — RevenueCat,
    // Health days, consent history and pairing all hang on the id — but an account that never
    // finished its own onboarding takes the session's answers, which are the person's CURRENT
    // intent. A field only the stale account had is kept; an onboarded account keeps its own
    // wholesale (the test below).
    const earlier = await signIn("already-exists", "apple");
    const real = await webUser(earlier);
    // The stale account's partial profile — including a field the walk never asks.
    await store.patchProfile(real, { sex: "male", food_allergies: "nuts" });

    const session = await answerAll(undefined, { ...ANSWERS, goal: "gain", target_weight_kg: "90" });
    const signed = await signIn("already-exists", "apple", undefined, session);
    expect(await webUser(signed)).toBe(real);
    const winner = (await store.getProfile(real))!;
    // Session values won where it answered — the goal AND the stale account's own sex — and the
    // merged profile is onboarded, so the flow lands on the deferred country question.
    expect(winner.goal).toBe("gain");
    expect(winner.sex).toBe("female");
    expect(winner.food_allergies).toBe("nuts");
    expect(winner.onboarded_at).not.toBeNull();
    expect((await get("/start/country", signed)).status).toBe(200);
    // The tick the person just made is stamped where they actually landed.
    expect((await store.consentOf(real))?.termsAcceptedAt).not.toBeNull();
    // And the session account is gone — its token resolves to nothing, answers and all.
    expect(await store.userIdForToken(session.split("=")[1]!)).toBeNull();
  });

  it("lets an ONBOARDED existing account keep its own answers wholesale", async () => {
    // §F 8: a completed profile is the person's settled answers — the session's are dropped.
    const earlier = await signIn("onboarded-exists", "apple");
    const real = await webUser(earlier);
    await store.patchProfile(real, { onboarded_at: new Date().toISOString(), goal: "lose", country: "gb" });

    const session = await answerAll(undefined, { ...ANSWERS, goal: "gain", target_weight_kg: "90" });
    const signed = await signIn("onboarded-exists", "apple", undefined, session);
    expect(await webUser(signed)).toBe(real);
    const winner = (await store.getProfile(real))!;
    expect(winner.goal).toBe("lose");
    // It had a country already, so the handoff is the product, not the question.
    expect((await get("/start/country", signed)).status).toBe(303);
  });

  it("stamps the marketing box only when it was ticked", async () => {
    const plain = await answerAll(undefined, ANSWERS);
    const plainSigned = await signIn("no-marketing", "google", undefined, plain);
    const plainConsent = await store.consentOf(await webUser(plainSigned));
    expect(plainConsent?.termsAcceptedAt).not.toBeNull();
    expect(plainConsent?.marketingConsentAt).toBeNull();

    const opted = await answerAll(undefined, ANSWERS);
    const optedSigned = await signIn("yes-marketing", "google", undefined, opted, true);
    const optedConsent = await store.consentOf(await webUser(optedSigned));
    expect(optedConsent?.marketingConsentAt).not.toBeNull();
  });

  it("lands a signed-up account on the country question, and stores only what was asked", async () => {
    const session = await answerAll(undefined, ANSWERS);
    const signed = await signIn("deferred-country", "google", undefined, session);
    // The callback's handoff: country is asked AFTER the account exists (S8), on its own screen.
    const asked = await get("/start/country", signed);
    expect(asked.status).toBe(200);
    const userId = await webUser(signed);
    expect((await store.getProfile(userId))!.country).toBeNull();
    const answered = await post("/start/country", { answer: "de" }, signed);
    expect(answered.status).toBe(303);
    expect((await store.getProfile(userId))!.country).toBe("de");
  });

  it("refuses a country value the screen never offered", async () => {
    const session = await answerAll(undefined, ANSWERS);
    const signed = await signIn("bad-country", "google", undefined, session);
    const res = await post("/start/country", { answer: "atlantis" }, signed);
    expect(res.status).toBe(200); // re-asked, not stored
    expect((await store.getProfile(await webUser(signed)))!.country).toBeNull();
  });

  it("sends an anonymous account at the country screen back to the sign-up, not ahead of it", async () => {
    // The one order the whole redesign rests on: country follows the identity, so an account that
    // has not signed up must never be handed the question.
    const session = await answerAll(undefined, ANSWERS);
    const res = await get("/start/country", session);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/start/signup");
  });

  it("draws the board: the ask, the search, the flags, the preselect, Somewhere else last", async () => {
    const session = await answerAll(undefined, ANSWERS);
    const signed = await signIn("country-board", "google", "de", session);
    // The hint comes from the browser's own languages — so this GET says German.
    const html = await (await get("/start/country", signed, { "accept-language": "de" })).text();

    // The ask is a say-line and the search is on top of the grid — the board's order.
    expect(html).toContain('class="say"');
    expect(html.indexOf('class="srch"')).toBeLessThan(html.indexOf('class="opts"'));
    // Flags are drawn for real codes; the sentinel carries none.
    expect(html).toContain("🇩🇪");
    const other = html.slice(html.indexOf('value="other"'));
    expect(other).toContain("…");
    // `other` is last, and the resolved hint arrives preselected, in place — not re-ordered.
    const rendered = [...html.matchAll(/name="answer" value="([a-z]+)"/g)].map((m) => m[1]);
    expect(rendered.at(-1)).toBe("other");
    expect(html).toContain('value="de" checked');
  });

  it("narrows the grid with ?q= for a browser without the one script", async () => {
    const session = await answerAll(undefined, ANSWERS);
    const signed = await signIn("country-search", "google", "en", session);
    const html = await (await get("/start/country?q=aus", signed)).text();
    const rendered = [...html.matchAll(/name="answer" value="([a-z]+)"/g)].map((m) => m[1]);
    expect(rendered).toContain("au");
    expect(rendered).not.toContain("de");
    // The sentinel always stays — it is the honest answer to a search that finds nothing.
    expect(rendered.at(-1)).toBe("other");
  });

  // THE SENTENCE THE PROVIDER PAIR EXISTS FOR — re-homed from the plan to this screen, the
  // post-sign-up handoff: the app offers both buttons and the wrong one does not find this
  // account — it attaches to the anonymous one the install already has, so onboarding runs
  // again and this plan, plus anything bought from it, stays on an account nothing can merge
  // into. `engine/identity.ts` never merges two real identities, so there is no repair
  // downstream of getting this wrong.
  it.each(["apple", "google"] as const)(
    "tells a %s signup to press that same button in the app, not the other one",
    async (name) => {
      const session = await answerAll(undefined, ANSWERS);
      const signed = await signIn(`sub-${name}`, name, undefined, session);
      const html = await (await get("/start/country", signed)).text();
      const [used, other] = name === "apple" ? ["Apple", "Google"] : ["Google", "Apple"];
      expect(html).toContain(`Sign in with ${used}`);
      expect(html).not.toContain(`Sign in with ${other}`);
    },
  );
});

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
  it("still answers at its own route, for a finished account", async () => {
    const { session } = await onboarded();
    // Signing in again with a finished profile: the questions are done, so /q hands over to /plan.
    const q = await get("/start/q", session);
    expect(q.status).toBe(303);
    expect(q.headers.get("location")).toBe("/start/plan");
    // The chat link left the plan page with the old card (the board draws one way on: the
    // sign-up); the ROUTE is still the chat's, and a finished account still gets it.
    const res = await get("/start/chat", session);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain(PAGE_COPY.chatHeading);
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
  it("names Spud on his answers and nobody else — the app's own lines carry no name", async () => {
    const { session, userId } = await onboarded();
    await store.appendChat(userId, [
      { role: "assistant", kind: "text", text: "First one in. 612 kcal." },
      { role: "user", kind: "text", text: "how much protein have I had?" },
      // S9: a coach answer is the coach's, and the page says so — the app's lines stay unlabelled.
      { role: "assistant", kind: "text", text: "About 40 g so far.", speaker: "gabie" },
    ]);
    const page = await (await get("/start/chat", session)).text();
    expect(page).toContain('<p class="who">Spud</p><p class="bubble">About 40 g so far.</p>');
    expect(page).toContain('<p class="bubble">First one in. 612 kcal.</p>');
    expect(page.match(/class="who"/g)).toHaveLength(1);
  });
});

describe("the web surface and the landing are one product", () => {
  it("and the application's own shell follows the same rule — light, never the OS's", async () => {
    // The APP's page is generated by a different process (`frontend/server/index.ts`), so the
    // check is on the shell it serves. #825's one rule covers both surfaces: the bundle's
    // stylesheet may not consult the OS either.
    const dir = mkdtempSync(join(tmpdir(), "eait-app-shell-"));
    try {
      writeFileSync(join(dir, "main.js"), "// bundle\n");
      const app = createWebApp({ bundlePath: new URL(`file://${join(dir, "main.js")}`) });
      const res = await app.fetch(new Request("https://app.eait.fit/"));
      expect(res.status).toBe(200);
      const page = await res.text();
      expect(page).not.toContain("prefers-color-scheme");
      // The same typeface, served by this origin's backend route.
      expect(page).toContain('font-family: "Montserrat"');
      expect(page).toContain("/start/assets/fonts/montserrat-latin.woff2");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("draws its pages from the landing's own tokens and typeface", async () => {
    const { session } = await onboarded();
    const page = await (await get("/start/chat", session)).text();
    // The landing's palette, by variable name, rather than a second copy of the hexes.
    expect(page).toContain("--accent-ink:");
    expect(page).toContain('font-family: "Montserrat"');
    // Light unless somebody says otherwise, which is the landing's rule: the OS is not consulted.
    expect(page).not.toContain("prefers-color-scheme");
  });

  it("serves that typeface itself, cached, so the page loads nothing from anyone else", async () => {
    const res = await get("/start/assets/fonts/montserrat-latin.woff2");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("font/woff2");
    expect(res.headers.get("cache-control")).toContain("immutable");
    expect((await res.arrayBuffer()).byteLength).toBeGreaterThan(10_000);
    // Every subset the pages declare is served — the five of them, and nothing beside them.
    for (const subset of ["latin-ext", "cyrillic", "cyrillic-ext", "vietnamese"]) {
      expect((await get(`/start/assets/fonts/montserrat-${subset}.woff2`)).status, subset).toBe(200);
    }
    expect((await get("/start/assets/fonts/montserrat-400.ttf")).status).toBe(404);
    // And the policy that allows it is same-origin only.
    const front = await get("/start");
    expect(front.headers.get("content-security-policy")).toContain("font-src 'self'");
  });

  it("404s a name none of the asset routes ships — the allowlist, not the filesystem, answers", async () => {
    for (const path of [
      "/start/assets/welcome/nope.mp4",
      "/start/assets/img/nope.webp",
      "/start/assets/fonts/montserrat-italic.woff2",
    ]) {
      expect((await get(path)).status, path).toBe(404);
    }
  });
});

describe("signing out of this browser", () => {
  /** Sign in and finish, then hand back the cookie and a bearer minted from it. */
  const session = async (): Promise<{ cookie: string; bearer: string; userId: string }> => {
    const start = await post("/start/auth/google", { terms: "yes" });
    const state = new URL(start.headers.get("location")!).searchParams.get("state")!;
    const res = await get(
      `/start/auth/google/callback?code=signout-subject&state=${encodeURIComponent(state)}`,
      cookieFrom(start, "eait_oauth"),
    );
    const cookie = res.headers.getSetCookie().find((c) => c.startsWith("eait_web="))!.split(";")[0]!;
    const userId = (await store.userIdForToken(decodeURIComponent(cookie.split("=")[1]!)))!;
    // Country included: S8 asks it after sign-up, and a session resuming an account that never
    // answered it lands back on that screen rather than past it.
    await store.patchProfile(userId, { onboarded_at: new Date().toISOString(), country: "de" });
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
    const start = await post("/start/auth/google", { terms: "yes" });
    const state = new URL(start.headers.get("location")!).searchParams.get("state")!;
    const res = await get(
      `/start/auth/google/callback?code=returning-subject&state=${encodeURIComponent(state)}`,
      cookieFrom(start, "eait_oauth"),
    );
    const cookie = res.headers.getSetCookie().find((c) => c.startsWith("eait_web="))!.split(";")[0]!;
    const userId = (await store.userIdForToken(decodeURIComponent(cookie.split("=")[1]!)))!;
    await store.patchProfile(userId, { onboarded_at: new Date().toISOString(), country: "de" });
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
    // `/` answers 404 on a deployment with no bundle — the resume goes to this surface's own
    // thread instead, the product it can actually serve.
    router({ ...CONFIG }, undefined, undefined, false);
    const res = await get("/start", await onboarded());
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/start/chat");
  });

  it("leaves somebody mid-onboarding where they were", async () => {
    // Signed in is not the same as finished. A half-answered profile has no plan behind it, so the
    // diary would be a screen of zeroes and no way back to the questions.
    router({ ...CONFIG }, undefined, undefined, true);
    const start = await post("/start/auth/google", { terms: "yes" });
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
    const start = await post("/start/auth/google", { terms: "yes" });
    const state = new URL(start.headers.get("location")!).searchParams.get("state")!;
    const cb = await get(
      `/start/auth/google/callback?code=plan-subject&state=${encodeURIComponent(state)}`,
      cookieFrom(start, "eait_oauth"),
    );
    const cookie = cb.headers.getSetCookie().find((c) => c.startsWith("eait_web="))!.split(";")[0]!;
    const userId = (await store.userIdForToken(decodeURIComponent(cookie.split("=")[1]!)))!;
    await store.patchProfile(userId, {
      sex: "female", birth_year: 1990, height_cm: 170, weight_kg: 70, target_weight_kg: 65,
      activity: "few", pace: "steady", goal: "lose", onboarded_at: new Date().toISOString(),
    });
    return await (await get("/start/plan", cookie)).text();
  };

  it("offers the sign-up first — the account needs an identity before a meal can be read", async () => {
    // S8: the plan's one way on is the consent screen that attaches Apple or Google to the
    // account the questions just made. There is no "get the app" and no meal link beside it.
    const html = await planFor(true);
    expect(html).toContain('href="/start/signup"');
  });

  it("links no chat from the plan — the sign-up is the only door (#499's routes still serve)", async () => {
    const withApp = await planFor(true);
    expect(withApp).not.toContain('href="/start/chat"');
    expect(withApp).not.toContain('href="/#/chat"');
    expect(await planFor(false)).not.toContain('href="/start/chat"');
  });
});

describe("handing the browser's own JavaScript a bearer", () => {
  /** Sign in for real and return the session cookie, because that is the only way to get one. */
  const signedIn = async (): Promise<string> => {
    const start = await post("/start/auth/google", { terms: "yes" });
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
      body: JSON.stringify({ idToken: `ok:apple:${subject}${email ? `:${email}` : ""}`, terms: true }),
    }));

  /** The browser's, through the real front door: authorize, then the callback with its state. */
  const webSignIn = async (subject: string, email?: string): Promise<string> => {
    const start = await post("/start/auth/apple", { terms: "yes" });
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
    // the code half is finished — a host that sets them gets the button, on the sign-up screen,
    // which is where the provider buttons live (S8).
    const html = await (await get("/start/signup")).text();
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
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded", "content-length": "9",
      },
      body: "terms=yes",
    }));
    const to = new URL(res.headers.get("location")!);
    expect(to.searchParams.get("redirect_uri"))
      .toBe("https://app.eait.fit/start/auth/google/callback");
  });

  it("falls back to the API's origin, so a host that never sets it is unchanged", async () => {
    router({ ...CONFIG, publicWebUrl: "" });
    const res = await handle(new Request("https://api.eait.fit/start/auth/google", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded", "content-length": "9",
      },
      body: "terms=yes",
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
    const page = await (await atOrigin("http://localhost:8787", "/start/signup")).text();
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
    const page = await (await atOrigin("https://api.eait.fit", "/start/signup")).text();
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
    const page = await (await handle(new Request("http://localhost:8787/start/signup"))).text();
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

// ── Onboarding, driven to the end in all eight ───────────────────────────────────────────────
//
// WHY THE FULL WALK, when `onboarding-content.test.ts` already proves every table is complete.
// Because completeness of a table has never been the failure mode here. Twice in this branch the
// tables were right and the SCREEN was English: `signInWithProvider` wrote `"en"` into the account
// whatever the browser asked for, and `TREND_PERIODS` held plain strings no check could see. Both
// were invisible to a data test and obvious in a rendered page.
//
// This drives the real handler, question by question, in each of the eight — which is the same
// thing `language.pw.ts` does in a browser for German alone, at a cost that allows eight.

describe("the whole onboarding flow, in every language the app speaks", () => {
  for (const lang of LANGS) {
    it(`asks and answers in ${lang} (${LANG_LABEL[lang]}) from the first question past the sign-up to the country`, async () => {
      // THE S8 WALK ITSELF: no sign-in first — the questions run on the session account that the
      // first answer makes, the plan leads to the consent screen, Apple or Google attaches to
      // THAT account, and the deferred country question is the last thing before the product.
      const content = onboardingContentFor(lang);
      const headers = { "accept-language": lang };

      const seen: string[] = [];
      let cookie: string | undefined;
      for (let i = 0; i < 20; i++) {
        const page = await get("/start/q", cookie, headers);
        if (page.status === 303) break;
        const html = await page.text();
        const id = html.match(/name="prompt" value="([a-z_]+)"/)![1]!;
        seen.push(id);

        // EVERY page, not just the last: the bug this replaces was a German welcome followed by
        // English questions, which any single-page assertion would have passed.
        expect(html, `${lang}.${id} did not declare its language`)
          .toContain(`<html lang="${lang}"`);
        // The ask, in that language's own words. Compared on its LONGEST placeholder-free run:
        // `{loseTail}`, `{floor}` and friends are substituted before the page is written, so the
        // stored sentence is not the rendered one — but the words around the hole are.
        const screen = content.screens.find((x) => x.id === screenForStep(id as never));
        if (id === "target_weight_kg") {
          // The one screen whose ask is NOT the admin's (#42): the stepper's ask is the shared
          // `targetSuggestionLine`, spoken from the suggestion itself.
          const me = (await store.getProfile(await webUser(cookie!)))!;
          const kg = suggestedTargetKg(me)!;
          const share = Math.round(Math.abs(kg - me.weight_kg!) / me.weight_kg! * 100);
          const said = targetSuggestionLine(kg, share, "lose", lang);
          expect(html, `${lang}.${id} did not carry the suggestion`).toContain(escape(said!));
        } else {
          const ask = screen?.asks[id as keyof typeof screen.asks]?.lines[0];
          if (ask) {
            const fixed = ask.split(/\{\w+\}/).reduce((a, b) => (b.length > a.length ? b : a), "");
            expect(html, `${lang}.${id} did not ask in ${lang}`).toContain(escape(fixed));
          }
        }

        const action = html.match(/action="([^"]+)"/)?.[1]?.replace(/&amp;/g, "&") ?? "/start/q";
        const res = await post(action, { prompt: id, answer: ANSWERS[id]! }, cookie, headers);
        // The first answer mints the session account — keep its cookie.
        const set = res.headers.getSetCookie().find((c) => c.startsWith("eait_web="));
        if (set) cookie = set.split(";")[0]!;
      }

      // Country is NOT a walk question (S8) — it waits for the sign-up below.
      expect(seen, lang).not.toContain("country");
      expect(seen.at(-1), lang).toBe("medical");

      // The plan, then the consent screen — in the language the questions were answered in,
      // which the first answer wrote into the session account.
      const plan = await get("/start/plan", cookie);
      expect(plan.status, lang).toBe(200);
      const planHtml = await plan.text();
      expect(planHtml, lang).toContain(`<html lang="${lang}"`);
      // The say-line is the content's own, in the asked language — `summary.lines` of the table.
      expect(planHtml, lang).toContain(escape(content.summary.lines.join(" ")));
      const signup = await get("/start/signup", cookie);
      const signupHtml = await signup.text();
      expect(signupHtml, `${lang}.signup`).toContain(`<html lang="${lang}"`);
      expect(signupHtml, `${lang}.signup heading`).toContain(escape(signupCopyFor(lang).signUpHeading));
      // The consent line names both documents, in the language's own words — the placeholders a
      // translation could have dropped.
      expect(signupHtml, `${lang}.signup terms`).toContain(escape(signupCopyFor(lang).termsLink));
      expect(signupHtml, `${lang}.signup privacy`).toContain(escape(signupCopyFor(lang).privacyLink));

      // Sign up — the identity attaches to the account the answers already live on (S8).
      const signed = await signIn(`web-${lang}`, "google", lang, cookie);
      expect(await webUser(signed), lang).toBe(await webUser(cookie!));

      // The sign-up's handoff is the deferred country question, in the account's own language.
      const countryPage = await get("/start/country", signed, headers);
      expect(countryPage.status, lang).toBe(200);
      const countryHtml = await countryPage.text();
      expect(countryHtml, `${lang}.country`).toContain(`<html lang="${lang}"`);

      // THE COUNTRY CHIPS, on their own screen now. Every one of them, by the name CLDR gives it
      // in THIS language — so a client rendering the code, or falling back to English, fails here
      // and names the language it failed in.
      const countryScreen = content.screens.find((x) => x.id === "country")!;
      const ask = countryScreen.asks.country!.lines[0]!;
      const fixed = ask.split(/\{\w+\}/).reduce((a, b) => (b.length > a.length ? b : a), "");
      expect(countryHtml, `${lang}.country did not ask in ${lang}`).toContain(escape(fixed));
      for (const code of COUNTRY_CODES) {
        const label = code === "other"
          ? screenOptions(content, "country").other!.label
          : countryLabel(code, lang);
        expect(countryHtml, `${lang}: no chip reading "${label}" (${code})`)
          .toContain(escape(label));
      }
      // The reader's own alphabet, `other` last — the board's grid order. The hint shows up as
      // the PRESELECTED radio, not a re-ordered list; `resolveCountry` is the same call the page
      // made, so the two can never disagree about what was hinted.
      const rendered = [...countryHtml.matchAll(/name="answer" value="([a-z]+)"/g)].map((m) => m[1]);
      expect(rendered, lang).toEqual([...countryOptions(lang)]);
      const hinted = resolveCountry({ languages: [lang] }).country;
      const checked = countryHtml.match(/name="answer" value="([a-z]+)" checked/)?.[1];
      if (hinted !== null) expect(checked, `${lang}.country hint`).toBe(hinted);

      // Answering it is the end of the flow: the account carries the language and the country,
      // and the handoff is the product itself.
      const done = await post("/start/country", { answer: "de" }, signed, headers);
      expect(done.status, lang).toBe(303);
      const profile = (await store.getProfile(await webUser(signed)))!;
      expect(profile.lang, lang).toBe(lang);
      expect(profile.country, lang).toBe("de");
      expect(profile.onboarded_at, lang).not.toBeNull();
    });
  }

  it("renders a different country list to a German reader than to a Russian one", async () => {
    // The guard against all eight passing because all eight are English. Two languages, the same
    // fourteen countries, and neither the names nor the order may match — on the post-sign-up
    // screen, which is where the question lives now (S8). The account's language is what the
    // page renders in — it is set here directly because the renderer is what is under test.
    const de = await signedUp("web-order-de");
    const ru = await signedUp("web-order-ru", "apple");
    await store.patchProfile(de.userId, { country: null, lang: "de" });
    await store.patchProfile(ru.userId, { country: null, lang: "ru" });
    const deHtml = await (await get("/start/country", de.session)).text();
    const ruHtml = await (await get("/start/country", ru.session)).text();
    expect(deHtml).toContain("Vereinigtes Königreich");
    expect(ruHtml).toContain("Великобритания");
    expect(deHtml).not.toContain("Великобритания");
    expect(ruHtml).not.toContain("Vereinigtes");
    const order = (html: string) =>
      [...html.matchAll(/name="answer" value="([a-z]+)"/g)].map((m) => m[1]);
    expect(order(deHtml)).not.toEqual(order(ruHtml));
  });
});

describe("the counter and Back (#53)", () => {
  /** Walk the open questions, recording each page's "Question N of M". */
  // A British browser: its region answers the country, which is never asked — the case whose total
  // changed between the first question and the second, because only the first request resolved it.
  const BRITISH = { "accept-language": "en-GB,en;q=0.9" };
  async function walk(session: string, answers: Record<string, string | string[]>) {
    // The progress a question shows is the DASH now — one lit segment per place already passed,
    // the current one the wider segment. `lit` counts the lit ones; the same `on` class on every
    // walk is the total not drifting.
    const seen: { lit: number; total: number; id: string }[] = [];
    for (let i = 0; i < 25; i++) {
      const page = await get("/start/q", session, BRITISH);
      if (page.status === 303) return seen;
      const html = await page.text();
      const m = html.match(/name="prompt" value="([a-z_]+)"/);
      if (m === null) {
        // An interstitial: its Continue is a link, and its dash counts too.
        const segs = html.match(/class="dash"[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? "";
        seen.push({ lit: (segs.match(/class="on"/g) ?? []).length, total: (segs.match(/<i/g) ?? []).length, id: "(card)" });
        const href = html.match(/<a[^>]*class="cta[^"]*"[^>]*href="([^"]+)"/)?.[1]
          ?? html.match(/<a[^>]*href="([^"]+)"[^>]*class="cta[^"]*"/)?.[1];
        if (href === undefined) throw new Error("a page with neither a prompt nor a continue");
        await get(href.replace(/&amp;/g, "&"), session, BRITISH);
        continue;
      }
      const id = m[1]!;
      const segs = html.match(/class="dash"[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? "";
      seen.push({
        lit: (segs.match(/class="on"/g) ?? []).length,
        total: (segs.match(/<i/g) ?? []).length,
        id,
      });
      await post("/start/q", { prompt: id, answer: answers[id]! }, session);
    }
    throw new Error("onboarding did not finish");
  }

  for (const goal of ["lose", "gain"] as const) {
    it(`fills the dash forward from the first question to the last on the ${goal} path`, async () => {
      const session = await signIn(`counter-${goal}`, "google", BRITISH["accept-language"]);
      const seen = await walk(session, {
        ...ANSWERS, goal, target_weight_kg: goal === "gain" ? "90" : "70",
      });
      // One segment count for the whole walk, and the lit half never shrinks.
      expect(new Set(seen.map((s) => s.total)).size).toBe(1);
      const lit = seen.map((s) => s.lit);
      expect([...lit].sort((a, b) => a - b)).toEqual(lit);
      expect(lit[0]).toBe(0);
      expect(lit.at(-1)!).toBeGreaterThan(lit[0]!);
    });
  }

  it("keeps one segment count after the goal on the maintain path", async () => {
    const seen = await walk(
      await signIn("counter-maintain", "google", BRITISH["accept-language"]), { ...ANSWERS, goal: "maintain" });
    expect(new Set(seen.map((s) => s.total)).size).toBe(1);
    const lit = seen.map((s) => s.lit);
    expect([...lit].sort((a, b) => a - b)).toEqual(lit);
  });

  it("puts Back on every question: the first to the welcome, the rest to the one before", async () => {
    const session = await signIn("back-links");
    expect(await (await get("/start/q", session)).text()).toContain('class="wback" href="/start"');
    await post("/start/q", { prompt: "goal", answer: "lose" }, session);
    // The how-it-works card sits between goal and sex, and a card is nowhere Back can go —
    // the link past it is the previous QUESTION's edit.
    const card = await get("/start/q?show=how", session);
    expect(card.status).toBe(200);
    expect(await (await get("/start/q", session)).text())
      .toContain('href="/start/q?edit=goal"');
  });

  it("re-shows an answered question with its answer chosen, and a changed answer is written", async () => {
    const session = await signIn("back-edit");
    await post("/start/q", { prompt: "goal", answer: "lose" }, session);
    await post("/start/q", { prompt: "sex", answer: "female" }, session);
    await post("/start/q", { prompt: "birth_year", answer: "34" }, session);
    const sex = await (await get("/start/q?edit=sex", session)).text();
    expect(sex).toContain('name="prompt" value="sex"');
    expect(sex).toMatch(/value="female"[^>]*checked/);
    const age = await (await get("/start/q?edit=birth_year", session)).text();
    expect(age).toMatch(/name="answer"[^>]*value="34"/);

    const res = await post("/start/q", { prompt: "sex", answer: "male" }, session);
    expect(res.headers.get("location")).toBe("/start/q");
    const userId = await webUser(session);
    expect((await store.getProfile(userId))!.sex).toBe("male");
    // …and the walk resumes where it was.
    expect(await (await get("/start/q", session)).text()).toContain('name="prompt" value="height_cm"');
  });

  it("bounces every show that is not the next beat — an unknown id, or a card not due yet", async () => {
    const session = await signIn("show-refuse");
    // Nothing answered: `how` sits AFTER the open question (goal), `ontrack` after it again,
    // and "nope" is no beat at all — each redirects into the walk rather than serving.
    for (const bad of ["nope", "how", "ontrack"]) {
      const res = await get(`/start/q?show=${bad}`, session);
      expect(res.status, bad).toBe(303);
      expect(res.headers.get("location"), bad).toBe("/start/q");
    }
    // And once `how` is served in its turn, the card after it still is not due.
    await post("/start/q", { prompt: "goal", answer: "lose" }, session);
    expect((await get("/start/q?show=how", session)).status).toBe(200);
    const late = await get("/start/q?show=ontrack", session);
    expect(late.status).toBe(303);
    expect(late.headers.get("location")).toBe("/start/q");
  });

  it("'none' clears the medical tags picked before it — the row it ticked wins by meaning", async () => {
    const session = await signIn("medical-none-clears");
    await walkTo(session, "medical");
    const picked = await post("/start/q", { prompt: "medical", answer: ["ldl"] }, session);
    expect(picked.status).toBe(303);
    expect((await store.getProfile(await webUser(session)))!.restrictions)
      .toEqual(expect.arrayContaining(["ldl"]));
    // Back into the question (#53's edit), tick "none of these" — a no-script browser could
    // send it beside a real tag, and the only honest read of both is none.
    const edit = await get("/start/q?edit=medical", session);
    expect(edit.status).toBe(200);
    const res = await post("/start/q", { prompt: "medical", answer: ["ldl", "none"] }, session);
    expect(res.status).toBe(303);
    const p = (await store.getProfile(await webUser(session)))!;
    // The diet tag survives; every medical tag is gone.
    expect(p.restrictions).toEqual(["mediterranean"]);
  });

  it("refuses to edit a question not yet answered, or one that does not exist", async () => {
    const session = await signIn("back-refuse");
    await post("/start/q", { prompt: "goal", answer: "lose" }, session);
    for (const id of ["height_cm", "nope"]) {
      const res = await get(`/start/q?edit=${id}`, session);
      expect(res.status).toBe(303);
      expect(res.headers.get("location")).toBe("/start/q");
    }
    // A POST for a question past the open one is still dropped.
    await post("/start/q", { prompt: "height_cm", answer: "170" }, session);
    expect((await store.getProfile(await webUser(session)))!.height_cm).toBeNull();
  });

  it("labels a number field, keeps a refused value, and ties the refusal to the field", async () => {
    const session = await signIn("field-error");
    for (const id of ["goal", "sex", "birth_year"]) await post("/start/q", { prompt: id, answer: ANSWERS[id]! }, session);
    const page = await (await get("/start/q", session)).text();
    expect(page).toMatch(/<label class="lab" for="answer">[^<]+<\/label>/);
    expect(page).toMatch(/<h1 class="q">[^<]+<\/h1>/);
    const refused = await (await post("/start/q", { prompt: "height_cm", answer: "9" }, session)).text();
    expect(refused).toMatch(/id="answer"[^>]*value="9"[^>]*aria-invalid="true" aria-describedby="answer-error"/);
    expect(refused).toContain('id="answer-error"');
  });
});

