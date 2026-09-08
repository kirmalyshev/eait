// Onboarding on the web. `docs/WEB_ONBOARDING.md` is the design; this is the six routes.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// FOUR RULES, ALL OF THEM SECURITY
//
//  1. OFF BY DEFAULT. No `EAIT__BACKEND__GOOGLE_WEB_CLIENT_ID` and `_SECRET` and every path here
//     answers 404 — not 403, because "there is a sign-up here" is information. Same shape as the
//     admin and the purchase webhook.
//  2. THE COOKIE IS THIS SURFACE'S ALONE. It carries the same session token the app holds, and
//     `resolveUserId` in `api/routes.ts` must never learn to read it: an API that accepts a cookie
//     is an API where every route can be posted to from another origin on a logged-in browser.
//  3. `SameSite=Lax` IS THE CSRF DEFENCE, and it is why every state change here is a POST. A
//     cross-site POST carries no Lax cookie; a cross-site GET does, which is exactly why the OAuth
//     callback — the one GET that changes anything — compares `state` against its own cookie.
//     Without that comparison a stranger can finish a sign-in AS THEMSELVES in somebody's browser,
//     and that person then types their weight into the stranger's account.
//  4. THE IDENTITY STILL COMES OUT OF A VERIFIED TOKEN. This route hands Google's ID token to the
//     same `Verifier` the app's route uses — signature, issuer, audience, expiry, nonce.
// ─────────────────────────────────────────────────────────────────────────────────────────────

import {
  AMBIGUOUS_AGE, RESTRICTION_TAGS, SCREEN_OPTIONS, UNDER_AGE_CARD, UNDER_AGE_LINES, askLines,
  askPlaceholder, checkDirection, checkNumber, disabledScreens, isAnswered, promptsFor,
  isRefusal, MAX_USER_LINE, renderableVerdicts, screenForStep, screenOptions, switchedLine,
  verdictPillLabel,
  type ChatEntry, type ChatPrompt, type Goal, type NumberField, type OnboardingContent,
  type PatchProfileRequest, type Profile,
} from "@eait/shared";
import { AuthError, type IdentityVerifier } from "../auth/verify.ts";
import type { WebProvider, WebSignInProvider } from "../auth/web-oauth.ts";
import { checkWebProvider } from "../auth/web-auth-check.ts";
import {
  cancelPendingMeal, chatHistory, confirmPendingMeal, handleText, logPhotoMeal, onboardingContent,
  patchProfile, profileView, redeemPairingCode, signInWithProvider, type EngineDeps,
} from "../engine/index.ts";
import type { Store } from "../store.ts";
import {
  chat, frontDoor, html, plan, question, stopped, FONT_PATH, PAGE_COPY,
  type ChatLine, type ChatProposal, type QuestionOption,
} from "./page.ts";

export const START_PREFIX = "/start";

/**
 * `/start/auth/<provider>` and `/start/auth/<provider>/callback`.
 *
 * ONE PATH PER PROVIDER rather than one shared callback with the provider in the state, because
 * each one has to be registered as an authorized redirect URI with its own console anyway — and a
 * URL a person has to copy into Apple's developer portal by hand should be readable enough that
 * they can tell whether they pasted the right one.
 */
const AUTH_PATH = /^\/start\/auth\/(apple|google)(\/callback)?$/;

/**
 * The thread, and the short link people can be told out loud.
 *
 * UNDER `/start` LIKE EVERYTHING ELSE, because the session cookie is `Path=/start` and widening it
 * would hand the cookie to every path on this origin, the JSON API included — the one thing rule 2
 * at the top of this file exists to prevent. `/chat` is a redirect and nothing more: it carries no
 * session and decides nothing.
 */
const CHAT_PATH = `${START_PREFIX}/chat`;
const CHAT_ALIAS = "/chat";

/** Thread lines rendered on one page. No pagination here yet: the composer is what people came for. */
const CHAT_PAGE_LINES = 50;

/**
 * What `?notice=` may say, and the words for each.
 *
 * A CODE IN THE QUERY, NEVER A SENTENCE: the redirect that carries it is a URL anybody can hand
 * somebody else, and a page that rendered arbitrary text from one would put a stranger's words in
 * the product's voice. Every key here is a refusal the engine produced or a state this page knows.
 *
 * READ WITH `Object.hasOwn`, because a plain object inherits from `Object.prototype`: `?notice=
 * constructor` on a bare lookup returns a FUNCTION, which is truthy, survives the `?? null`, and
 * throws inside `escape` — a crafted link that turns this page into a 500.
 *
 * THE THREE CAPS ARE THREE SENTENCES. The engine already distinguishes them (`caps.ts` answers
 * `cap-exceeded` with a scope) and so does the app (`lib/meal-refusal.ts`). "Your allowance is
 * spent" is a lie to somebody on a carrier network who has logged one meal, and a lie again when
 * what ran out is the instance's budget.
 */
const CHAT_NOTICE: Record<string, string> = {
  expired: PAGE_COPY.chatExpired,
  "too-long": PAGE_COPY.chatTooLong,
  "cap-address": PAGE_COPY.chatRefusalNetwork,
  "cap-global": PAGE_COPY.chatRefusalGlobal,
  "cap-user": PAGE_COPY.chatRefusalDay,
  "subscription-required": PAGE_COPY.chatRefusalSubscription,
  "analysis-failed": PAGE_COPY.chatRefusalFailed,
  "not-food": PAGE_COPY.chatRefusalNotFood,
  "no-focus-correction": PAGE_COPY.chatNoFocusCorrection,
  "no-focus-redate": PAGE_COPY.chatNoFocusRedate,
  "not-onboarded": PAGE_COPY.chatNotOnboarded,
  "unsupported-image": PAGE_COPY.chatRefusalImage,
  "no-photo": PAGE_COPY.chatRefusalNoPhoto,
  "too-many": PAGE_COPY.chatTooMany,
  "too-large": PAGE_COPY.chatTooLarge,
};

/** The label on each button, and the order they are offered in — Apple first, as in the app. */
const PROVIDER_LABEL: Record<WebProvider, string> = {
  apple: "Continue with Apple",
  google: "Continue with Google",
};

/** The session, and the ten minutes of OAuth state that precedes it. */
const SESSION_COOKIE = "eait_web";
const OAUTH_COOKIE = "eait_oauth";
const OAUTH_TTL_S = 600;

/**
 * The most Apple's `form_post` callback may weigh.
 *
 * It carries `code`, `state` and, on a first authorization, a small `user` JSON — hundreds of
 * bytes. 8 KB is generous for that and small enough that the free, unauthenticated, unlimited
 * calls this route accepts cost nothing to refuse. A body with no declared length is refused too:
 * the number is what makes the decision cheap, and Apple always sends one.
 */
const CALLBACK_MAX_BYTES = 8 * 1024;

export function isStartPath(pathname: string): boolean {
  return pathname === START_PREFIX || pathname.startsWith(`${START_PREFIX}/`) || pathname === CHAT_ALIAS;
}

export interface StartContext {
  deps: EngineDeps;
  store: Store;
  verifier: IdentityVerifier;
  /**
   * The providers this host can sign somebody in with, built from config by `webProviders`. An
   * EMPTY record is what makes `/start` answer 404 on every path: a sign-up page with no way to
   * sign up is not a degraded page, it is a page that does not exist.
   */
  providers: Partial<Record<WebProvider, WebSignInProvider>>;
  /**
   * This server's public origin — `EAIT__BACKEND__PUBLIC_API_URL` where it is set, which is what
   * every deployed host does (`iac/.../env.prod.j2`). The redirect URI is built from it.
   */
  origin: string;
  /**
   * The per-address sign-in allowance, the SAME one `/v1/auth/*` takes. Null means go ahead;
   * a number is the seconds to wait.
   *
   * The callback below is the fourth route on this server that mints a session, and the only one
   * that spends an outbound call to Google's token endpoint — ten seconds of a request handler —
   * before anybody is authenticated. Without this it is the one unbounded route on the box.
   */
  limitAuth: () => number | null;
  /** The billed allowance, spent on a chat turn exactly as the API's message route spends it. */
  limitAnalysis?: (() => number | null) | undefined;
}

const notFound = (): Response =>
  new Response(JSON.stringify({ error: "not found" }), {
    status: 404, headers: { "content-type": "application/json" },
  });

/**
 * The per-address refusal, in plain text because both routes that give it are reached by a browser
 * following a form or a redirect, not by anything that parses JSON.
 *
 * ONE SHAPE FOR BOTH. The OAuth callback and the pairing form spend the SAME allowance, so a
 * caller that could tell the two refusals apart would be learning which route it hit rather than
 * what to do about it — and the thing to do is the same either way.
 */
const tooManyAttempts = (wait: number): Response =>
  new Response("Too many attempts from this address. Try again shortly.\n", {
    status: 429,
    headers: { "content-type": "text/plain; charset=utf-8", "retry-after": String(wait) },
  });

/** 303 and not 302: a POST followed with GET, so a reload does not re-submit the answer. */
const seeOther = (location: string, cookies: string[] = []): Response => {
  const headers = new Headers({ location });
  for (const c of cookies) headers.append("set-cookie", c);
  return new Response(null, { status: 303, headers });
};

/**
 * FIRST WINS, and it is not a preference. RFC 6265 orders cookies most-specific first, and a
 * browser will happily send two named `eait_web` — ours on `Path=/start`, and one set for
 * `Domain=eait.fit` from anywhere else on the domain, including the landing host. Last-wins hands
 * the session to whichever of those was written second, which is the one an attacker controls.
 *
 * A value that is not valid percent-encoding is DROPPED rather than thrown on: `decodeURIComponent`
 * raises `URIError` on a bare `%`, which reaches the router's outer catch and answers a JSON 500 on
 * an HTML surface — for as long as that cookie survives in the browser, which is until somebody
 * clears it by hand.
 */
function cookieHeader(req: Request): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (req.headers.get("cookie") ?? "").split(";")) {
    const eq = part.indexOf("=");
    if (eq < 1) continue;
    const name = part.slice(0, eq).trim();
    if (name in out) continue;
    try {
      out[name] = decodeURIComponent(part.slice(eq + 1).trim());
    } catch {
      // Not ours, or corrupted. Either way there is nothing to read out of it.
    }
  }
  return out;
}

/**
 * `Secure` whenever the origin is https, and not otherwise — a Secure cookie is simply dropped over
 * http, which would make the whole flow fail silently on a local server with no TLS.
 */
function setCookie(name: string, value: string, opts: { secure: boolean; maxAge?: number }): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`, "Path=/start", "HttpOnly", "SameSite=Lax",
  ];
  if (opts.secure) parts.push("Secure");
  if (opts.maxAge !== undefined) parts.push(`Max-Age=${opts.maxAge}`);
  return parts.join("; ");
}

const clearCookie = (name: string, secure: boolean): string =>
  `${setCookie(name, "", { secure, maxAge: 0 })}`;

const randomToken = (): string => crypto.randomUUID().replace(/-/g, "");

/**
 * What a bridged POST that cannot be forwarded answers.
 *
 * The same 303 shape as a forwarded one, to the SAME path with no parameters, so the GET below
 * takes its ordinary `code === ""` exit and lands on the front door with the error. A refusal that
 * looked different would tell a stranger which of the two rejected them.
 */
const failedCallback = (pathname: string): Response => seeOther(pathname);

/** The questions this surface asks: every prompt that fills a profile field, in the app's order. */
function questionsFor(profile: Profile, content: OnboardingContent): ChatPrompt[] {
  return promptsFor(profile, disabledScreens(content)).filter((p) => p.field !== undefined);
}

/** The values a choice or chips question offers, with the admin's labels on them. */
function optionsFor(prompt: ChatPrompt, content: OnboardingContent): QuestionOption[] {
  const screen = screenForStep(prompt.field!);
  const values = prompt.options ?? SCREEN_OPTIONS[screen] ?? [];
  const labels = screenOptions(content, screen);
  return values.map((value) => ({
    value,
    label: labels[value]?.label ?? value,
    ...(labels[value]?.hint ? { hint: labels[value]!.hint! } : {}),
  }));
}

type Answered =
  | { kind: "patch"; patch: PatchProfileRequest }
  /** Refused before it costs a round trip, in the words `src/shared` wrote for it. */
  | { kind: "refuse"; line: string; switchTo?: Goal }
  /** Under sixteen. Not a validation failure — a stop, and the account goes with it. */
  | { kind: "under-age" }
  /** A high two-digit answer that could be a year typed short. Asked, never guessed. */
  | { kind: "ambiguous-age"; age: number }
  | { kind: "missing" };

/**
 * What the app's own composer would send for this question — through the SAME shared checks.
 *
 * `checkNumber` is not optional politeness here, it is the only thing that makes the answer mean
 * what the question asked. The `birth_year` prompt ASKS FOR AN AGE and the column stores a year;
 * that conversion lives in `src/shared` and nowhere else, so a web page doing its own `Number()`
 * would take "34" and store it as a birth year — a person aged 1,992, refused by the server with a
 * sentence about the year, under a bubble that asked how old they are. The bands it enforces are
 * likewise a deliberate subset of the server's, so the only refusals anybody can meet are the two
 * that have words written for them.
 */
function answerFor(prompt: ChatPrompt, answers: string[], profile: Profile): Answered {
  const field = prompt.field!;
  if (field === "restrictions") {
    const tags = answers.filter((a) => (RESTRICTION_TAGS as readonly string[]).includes(a));
    // The last question, so it is also the one that finishes onboarding — the same patch the app's
    // restrictions screen sends. No free-text box here: the app's is unstructured medical prose,
    // and a public web form is not where to start collecting it.
    return { kind: "patch", patch: { restrictions: tags, complete_onboarding: true } };
  }
  const value = answers[0];
  if (value === undefined || value === "") return { kind: "missing" };

  if (prompt.kind === "number") {
    const checked = checkNumber(field as NumberField, value);
    if (!checked.ok) {
      if ("underAge" in checked) return { kind: "under-age" };
      // "90" is 1990 typed the short way, or somebody who is ninety. Computing the wrong one is
      // computing a stranger's calorie target, so it is asked rather than guessed.
      if ("ambiguousAge" in checked) return { kind: "ambiguous-age", age: checked.ambiguousAge };
      return { kind: "refuse", line: checked.line };
    }
    // THE AGE TRAVELS, NOT THE YEAR. `checkNumber` returns an age for this field — a four-digit
    // answer included — and `patchProfile` does the subtraction with the SERVER's clock, because a
    // client sitting across a UTC year boundary derived a year off by one and got a legitimate
    // sixteen-year-old refused. Sending `birth_year` from here would put that clock back.
    if (field === "birth_year") return { kind: "patch", patch: { age: checked.value } };

    // The wrong-direction check, which the server cannot make: `explainTargets` would accept a
    // surplus aimed at a number below the current weight and produce a plan that cannot arrive,
    // with nothing on any screen to say so.
    if (field === "target_weight_kg" && profile.goal !== null && profile.weight_kg !== null) {
      const wrong = checkDirection(profile.goal, profile.weight_kg, checked.value);
      if (wrong) return { kind: "refuse", line: wrong.line, switchTo: wrong.switchTo };
    }
    return { kind: "patch", patch: { [field]: checked.value } as PatchProfileRequest };
  }
  return { kind: "patch", patch: { [field]: value } as PatchProfileRequest };
}

/**
 * A refusal, in words. The SERVER's reason, rendered — never a second implementation of the rule.
 *
 * `target-weight-below-healthy-bmi` is the anorexia guard, and the number it carries is the lowest
 * this app will accept. Saying it is the whole point: a refusal with no number is a wall.
 */
function refusalText(r: { reason: string; minHealthyKg?: number }): string {
  if (r.reason === "target-weight-below-healthy-bmi") {
    return `The lowest target we can plan for at your height is ${r.minHealthyKg} kg.`;
  }
  if (r.reason === "age-below-minimum") return "We can only plan for adults — check the year.";
  return "That value is outside what we can plan for. Try again.";
}

export async function startRoutes(req: Request, url: URL, ctx: StartContext): Promise<Response> {
  const { config } = ctx.deps;
  // A BUTTON THAT CANNOT WORK IS WORSE THAN NO BUTTON. Both providers refuse origins a laptop can
  // offer — Apple wants https on a domain it can resolve, Google takes http on loopback only — and
  // a redirect they reject fails on THEIR error page, after the person has left this site. So a
  // provider that is configured but cannot complete the flow here is not offered here, and its two
  // routes answer 404 like a provider that was never configured at all. `make auth-check` is what
  // says why, in words, rather than leaving somebody to infer it from a missing button.
  const usable = Object.fromEntries(
    (Object.keys(ctx.providers) as WebProvider[])
      .filter((p) => ctx.providers[p]!.local === true
        || checkWebProvider(p, ctx.deps.config, ctx.origin).state === "ok")
      .map((p) => [p, ctx.providers[p]!]),
  ) as Partial<Record<WebProvider, WebSignInProvider>>;
  const offered = (Object.keys(usable) as WebProvider[]);
  if (offered.length === 0) return notFound();

  const { pathname } = url;
  const secure = ctx.origin.startsWith("https://");
  const cookies = cookieHeader(req);

  // ── The front door ────────────────────────────────────────────────────────────────────────
  if (req.method === "GET" && (pathname === START_PREFIX || pathname === `${START_PREFIX}/`)) {
    const content = await onboardingContent(ctx.deps);
    // A CODE, NEVER A SENTENCE — the same rule `?notice=` follows on the chat page. `error=code`
    // is the pairing form's refusal and anything else is the sign-in's, which is what the OAuth
    // failure path already sets.
    const error = url.searchParams.get("error") === "code" ? PAGE_COPY.errorPair
      : url.searchParams.has("error") ? PAGE_COPY.errorSignIn
      : null;
    return html(frontDoor(content.welcome.lines, offered.map((p) => ({
      href: `${START_PREFIX}/auth/${p}`, label: PROVIDER_LABEL[p],
    })), error));
  }

  // The typeface, on this origin, which is what lets the CSP stay at `font-src 'self'` and load
  // nothing from anyone else. Before the session gate: a font is not somebody's data, and a
  // sign-in page that cannot draw its own headings is the first thing a visitor sees.
  if (req.method === "GET" && pathname === FONT_PATH) {
    return new Response(Bun.file(new URL("../landing/assets/fonts/space-grotesk-latin.woff2", import.meta.url)), {
      headers: {
        "content-type": "font/woff2",
        // Immutable because the name is the file: a new cut of the typeface is a new path.
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  }

  if (req.method === "GET" && pathname === CHAT_ALIAS) return seeOther(CHAT_PATH);

  // ── Sign in ───────────────────────────────────────────────────────────────────────────────
  // APPLE POSTS ITS CALLBACK, and that POST is cross-site, so it carries no `SameSite=Lax` cookie
  // and the state check below would have nothing to compare against. Asking for the email scope is
  // what obliges `response_mode=form_post` (`auth/web-oauth.ts`), so this is not optional.
  //
  // The answer is a 303 to the SAME path as a GET: a Lax cookie IS sent on a cross-site top-level
  // GET, so the browser's next request has it and every check runs unchanged, on the one route
  // that was already written to expect a `code` and a `state` in the query. Nothing is granted
  // here — no session, no cookie, not even the rate-limit charge, all of which belong to the
  // request that can actually be checked. A forged POST therefore buys a redirect to a route that
  // refuses it.
  const postedCallback = req.method === "POST" ? AUTH_PATH.exec(pathname) : null;
  if (postedCallback?.[2] !== undefined) {
    if (!usable[postedCallback[1] as WebProvider]) return notFound();
    // CHECKED BEFORE PARSING, the rule `api/routes.ts` states on the photo route: `req.formData()`
    // buffers the whole body into memory, so a size check after it has run protects nothing. This
    // request is unauthenticated, cross-site and — deliberately — not rate limited, because the
    // allowance belongs to the GET that can actually be checked. That makes it the one route on
    // this server a stranger can call for free at any rate, so it must stay cheap: Apple posts a
    // few hundred bytes of urlencoded form, and anything that is not that shape is refused
    // without being read.
    const length = req.headers.get("content-length");
    const declared = length === null ? NaN : Number(length);
    const contentType = req.headers.get("content-type") ?? "";
    if (!Number.isFinite(declared) || declared > CALLBACK_MAX_BYTES
        || !contentType.startsWith("application/x-www-form-urlencoded")) {
      return failedCallback(pathname);
    }
    const form = await req.formData().catch(() => null);
    const carried = new URLSearchParams();
    for (const key of ["code", "state", "error"]) {
      const value = form?.get(key);
      if (typeof value === "string") carried.set(key, value);
    }
    // Apple also posts `user` on the first authorization: the name and address it collected. It is
    // not read, here or anywhere — the address this product stores comes out of the SIGNED id
    // token in the exchange, and a JSON blob in a form body is not a claim anybody verified.
    return seeOther(`${pathname}?${carried.toString()}`);
  }

  const authMatch = req.method === "GET" ? AUTH_PATH.exec(pathname) : null;
  if (authMatch) {
    const name = authMatch[1] as WebProvider;
    const provider = usable[name];
    // A provider this host has not configured does not exist here — 404, the same answer every
    // other unconfigured surface gives, and not a redirect back to a page offering one button.
    if (!provider) return notFound();
    const redirectUri = `${ctx.origin}${START_PREFIX}/auth/${name}/callback`;

    if (authMatch[2] === undefined) {
      const state = randomToken();
      const nonce = randomToken();
      // A local provider names a path on this server, so it is resolved against the origin the
      // request arrived on rather than one baked in at boot: a demo reached by hostname must not
      // redirect the browser to loopback.
      const to = new URL(provider.authorizeEndpoint, ctx.origin);
      to.search = new URLSearchParams({
        // The provider's own extras FIRST, so nothing it adds can override one of the six below.
        // `state` is the CSRF defence and `scope` is the privacy promise; a provider that could
        // overwrite either would do it silently, in a URL nobody reads.
        ...provider.extraAuthorizeParams,
        client_id: provider.clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        // `openid email`, for BOTH of them, since issue #95 — the address is what makes a
        // signed-in account reachable. NOT `profile`, which both vendors' own libraries add by
        // default: it puts a name and a picture on the consent screen and in the token, two
        // personal fields nothing in this product reads.
        //
        // The email scope is what obliges Apple's `response_mode=form_post`, and the bridge at the
        // top of this function is what keeps that from costing the Lax state cookie.
        scope: "openid email",
        nonce,
        state,
      }).toString();
      return seeOther(to.toString(), [
        // THE PROVIDER IS IN THE COOKIE, not only in the path. Without it a state minted on the way
        // to one provider is spendable at the other's callback, which is a stranger's half-finished
        // sign-in completing against whichever provider they can produce a code for.
        setCookie(OAUTH_COOKIE, `${name}.${state}.${nonce}`, { secure, maxAge: OAUTH_TTL_S }),
      ]);
    }

    const failed = () => seeOther(`${START_PREFIX}?error=1`, [clearCookie(OAUTH_COOKIE, secure)]);
    const [forProvider, state, nonce] = (cookies[OAUTH_COOKIE] ?? "").split(".");
    const code = url.searchParams.get("code") ?? "";
    // Everything about this comparison is the CSRF defence. An absent cookie fails it too, which is
    // what makes a callback replayed from somewhere else useless.
    if (!state || !nonce || forProvider !== name || code === "") return failed();
    if (url.searchParams.get("state") !== state) return failed();

    // Charged HERE — after the state check, so a scanner cannot spend a shared CGNAT address's
    // allowance with requests that were never going to reach a provider, and before the exchange,
    // which is the part that costs a socket and ten seconds. Never before the gate at the top of
    // this function: a 429 from an unconfigured host would say the surface exists.
    const wait = ctx.limitAuth();
    if (wait !== null) {
      return tooManyAttempts(wait);
    }

    let token: string;
    try {
      const idToken = await provider.exchange(code, redirectUri);
      // The SAME verifier the app's route uses. Nothing about this being a browser makes the
      // signature, the issuer, the audience or the nonce optional.
      ({ token } = await signInWithProvider(
        ctx.deps, ctx.verifier, name, idToken, nonce,
        // No account is carried into this: a browser arriving here has no anonymous session to
        // merge, and there is nothing on this surface that could have created one.
        null,
      ));
    } catch (e) {
      // Logged, never shown. The exchange's error quotes the request and the verifier's can quote
      // the token.
      console.error(`[eait] web sign-in failed: ${e instanceof AuthError ? e.reason : (e as Error)?.message}`);
      return failed();
    }
    return seeOther(`${START_PREFIX}/q`, [
      clearCookie(OAUTH_COOKIE, secure),
      // No Max-Age: a session cookie, gone when the browser closes. The token itself expires on
      // idle time server-side, which is the authority.
      setCookie(SESSION_COOKIE, token, { secure }),
    ]);
  }

  // ── Pairing: a browser trades a code for a session ────────────────────────────────────────
  //
  // Unauthenticated by necessity — this is where the browser's session comes from — and therefore
  // rate limited by address before the body is read, on the same allowance the OAuth callback and
  // the app's three sign-in routes take.
  //
  // A POST AND ONLY A POST. There is no GET here, and that is the design rather than an omission:
  // a GET that minted a session from `?code=` is a link a stranger can send, after which the
  // victim's browser is signed into the ATTACKER's account and the victim types their weight into
  // it — rule 3 at the top of this file, and the reason every state change on this surface is a
  // form somebody pressed.
  //
  // The account comes out of the STORE, by the hash of the code. Nothing in this body names a user
  // and nothing here would read it if it did.
  if (req.method === "POST" && pathname === `${START_PREFIX}/pair`) {
    const wait = ctx.limitAuth();
    if (wait !== null) {
      return tooManyAttempts(wait);
    }
    const form = await req.formData().catch(() => null);
    const code = form?.get("code");
    const token = await redeemPairingCode(ctx.deps, typeof code === "string" ? code : "");
    // ONE ANSWER for unknown, spent, expired and malformed. Anything else is an oracle for which
    // codes are live, and the person holding a dead code has the same thing to do in every case.
    if (token === null) return seeOther(`${START_PREFIX}?error=code`);
    return seeOther(CHAT_PATH, [
      // The callback's cookie, verbatim: same name, same flags, no Max-Age. A paired browser holds
      // an ordinary session and nothing downstream can tell it apart from a signed-in one — which
      // is the point, and is why `/start/chat` needs no branch for it (an un-onboarded account is
      // bounced to `/start/q` there, so a browser can even finish onboarding).
      setCookie(SESSION_COOKIE, token, { secure }),
    ]);
  }

  // ── Everything past here needs the session ────────────────────────────────────────────────
  const session = cookies[SESSION_COOKIE] ?? "";
  const userId = session === "" ? null : await ctx.store.userIdForToken(session);
  if (userId === null) return seeOther(START_PREFIX);

  // Read once, and NOT non-null asserted. A token can outlive the profile it names — an erasure
  // racing this request, and `deleteUser` revokes tokens rather than waiting for them — and the
  // assertion turned that into a TypeError, which the router's outer catch answers as a JSON 500 on
  // an HTML surface. The front door with the cookie cleared is what that session actually is.
  const profile = await ctx.store.getProfile(userId);
  if (profile === null) return seeOther(START_PREFIX, [clearCookie(SESSION_COOKIE, secure)]);

  const view = async (): Promise<{ profile: Profile; content: OnboardingContent }> => ({
    profile, content: await onboardingContent(ctx.deps),
  });

  if (pathname === `${START_PREFIX}/q`) {
    const { profile, content } = await view();
    const questions = questionsFor(profile, content);
    const openIndex = questions.findIndex((p) => !isAnswered(p, profile));

    const ask = (error: string | null, actions: Action[] = []) =>
      html(renderQuestion(questions, openIndex, profile, content, error, actions));

    if (req.method === "GET") {
      if (openIndex === -1) return seeOther(`${START_PREFIX}/plan`);
      // The goal was just flipped mid-question, so the target is asked again in the words the app
      // uses for it rather than in silence.
      const switched = url.searchParams.has("switched") && profile.goal !== null
        ? switchedLine(profile.goal)
        : null;
      return ask(switched);
    }

    if (req.method === "POST") {
      if (openIndex === -1) return seeOther(`${START_PREFIX}/plan`);
      const open = questions[openIndex]!;
      const form = await req.formData().catch(() => null);
      // The open question is the server's to decide, so a post naming a different one is dropped
      // rather than applied: the profile is what says where somebody is, on this surface exactly as
      // in the app, and a stale tab must not be able to write an answer to a question already past.
      if (form?.get("prompt") !== open.id) return seeOther(`${START_PREFIX}/q`);

      // The wrong-direction refusal's own escape: usually the goal was mistapped, not the number.
      const switchTo = form.get("switch");
      if (typeof switchTo === "string" && (switchTo === "lose" || switchTo === "gain")) {
        await patchProfile(ctx.deps, userId, { goal: switchTo });
        return seeOther(`${START_PREFIX}/q?switched=1`);
      }

      // The ambiguity resolved as an age. Trusted only because it is one of the values
      // `checkNumber` itself named ambiguous, and re-checked below like any other answer.
      const asAge = form.get("age");
      if (typeof asAge === "string" && /^\d{2}$/.test(asAge)) {
        const outcome = await patchProfile(ctx.deps, userId, { age: Number(asAge) });
        if (outcome && !outcome.ok) return ask(refusalText(outcome.rejected));
        return seeOther(`${START_PREFIX}/q`);
      }

      // The under-sixteen stop, taken. The account goes: "nothing you told me is kept" is a
      // promise, and the goal and the sex answered a minute ago are already rows.
      if (form.get("confirm") === "under-age") {
        await ctx.store.deleteUser(userId);
        return html(stopped(UNDER_AGE_CARD.title, UNDER_AGE_CARD.body, UNDER_AGE_LINES.stopped), 200, {
          cookies: [clearCookie(SESSION_COOKIE, secure)],
        });
      }

      const answers = form.getAll("answer").filter((v): v is string => typeof v === "string");
      const answer = answerFor(open, answers, profile);
      if (answer.kind === "missing") return ask("That one needs an answer.");
      if (answer.kind === "ambiguous-age") {
        // The quick reply takes it as an age; four digits in the box take it as the year.
        return ask(AMBIGUOUS_AGE.line(answer.age), [
          { name: "age", value: String(answer.age), label: AMBIGUOUS_AGE.confirm(answer.age) },
        ]);
      }
      if (answer.kind === "under-age") {
        // Offered ONCE, in case a typo got us here. Confirming is what takes the stop.
        return ask(UNDER_AGE_LINES.ask, [
          { name: "confirm", value: "under-age", label: UNDER_AGE_LINES.confirm },
        ]);
      }
      if (answer.kind === "refuse") {
        return ask(answer.line, answer.switchTo
          ? [{
              name: "switch",
              value: answer.switchTo,
              label: answer.switchTo === "lose" ? "Switch to losing" : "Switch to gaining",
            }]
          : []);
      }
      const outcome = await patchProfile(ctx.deps, userId, answer.patch);
      if (outcome && !outcome.ok) return ask(refusalText(outcome.rejected));
      return seeOther(`${START_PREFIX}/q`);
    }
  }

  // ── The thread ────────────────────────────────────────────────────────────────────────────
  if (pathname === CHAT_PATH || pathname.startsWith(`${CHAT_PATH}/`)) {
    // Onboarding first, exactly as the app has it: the engine answers `not-onboarded` to every turn
    // until the plan exists, and a chat page that could only refuse is a page with nothing on it.
    const full = await profileView(ctx.deps, userId);
    if (!full || !full.onboarded) return seeOther(`${START_PREFIX}/q`);

    if (req.method === "GET" && pathname === CHAT_PATH) {
      const { entries } = await chatHistory(ctx.deps, userId, { limit: CHAT_PAGE_LINES });
      // The proposal is not a thread line until it is confirmed, so it is carried across the
      // redirect by id and read back HERE — through the user-scoped `getPending`, which is what
      // makes an id from a query string safe: another account's proposal simply resolves to null.
      const held = url.searchParams.get("pending");
      const pending = held === null ? null : await ctx.store.getPending(userId, held);
      const proposal: ChatProposal | null = pending === null ? null : {
        pendingId: pending.id,
        title: pending.analysis.items.map((i) => i.name).join(", ") || "A meal",
        kcal: Math.round(pending.analysis.kcal),
        proteinG: Math.round(pending.analysis.protein_g),
      };
      return html(chat({
        lines: entries.map(threadLine),
        notice: noticeText(url.searchParams.get("notice")),
        proposal,
      }));
    }

    // EVERY WRITE IS A POST ANSWERING 303, and both halves of that are load-bearing. A POST is what
    // a `SameSite=Lax` cookie is not sent with cross-site, which is this surface's CSRF defence;
    // the redirect is what stops a refresh re-sending the turn, on a page whose only control is a
    // form and whose user has no undo.
    const back = (notice?: string | undefined) =>
      seeOther(notice ? `${CHAT_PATH}?notice=${notice}` : CHAT_PATH);
    if (req.method !== "POST") return notFound();

    // CHECKED BEFORE PARSING, the rule the photo route in `api/routes.ts` states: `req.formData()`
    // buffers the whole body, so a size check after it has run protects nothing — the allocation it
    // was meant to prevent has already happened.
    const declared = Number(req.headers.get("content-length") ?? 0);
    if (declared > ctx.deps.config.maxUploadBytes) return back("too-large");

    // The billed routes take the address allowance BEFORE the body is read, which is where
    // `api/routes.ts` takes it too: an address that is already over should not be able to make this
    // server buffer a multipart upload to find that out. Confirm and cancel are not billed and do
    // not take it — they write no analysis.
    const billed = pathname === `${CHAT_PATH}/say` || pathname === `${CHAT_PATH}/photo`;
    if (billed && ctx.limitAnalysis?.() != null) return back("cap-address");

    const form = await req.formData().catch(() => null);
    const field = (name: string): string => {
      const v = form?.get(name);
      return typeof v === "string" ? v.trim() : "";
    };

    if (pathname === `${CHAT_PATH}/photo`) {
      // flatMap rather than a filter predicate: it narrows the element type without asserting one,
      // so a string-valued "photo" field is dropped as the malformed input it is — and so is the
      // empty part a browser sends when the file chooser was never opened.
      const files = form?.getAll("photo").flatMap((f) => (typeof f === "string" || f.size === 0 ? [] : [f])) ?? [];
      if (files.length === 0) return back("no-photo");
      if (files.length > ctx.deps.config.maxPhotosPerMeal) return back("too-many");
      if (files.reduce((n, f) => n + f.size, 0) > ctx.deps.config.maxUploadBytes) return back("too-large");
      const caption = field("caption");
      if (caption.length > MAX_USER_LINE) return back("too-long");

      // Several files are ANGLES OF ONE MEAL. Thunks, so nothing is read until the engine has
      // passed the caps — and the JPEG sniff inside it still runs before the charge, which is what
      // keeps a HEIC from spending somebody's sample. No streaming here: with no JavaScript on this
      // page there is nothing to deliver a glance to.
      const result = await logPhotoMeal(ctx.deps, userId, {
        images: files.map((f) => async () => new Uint8Array(await f.arrayBuffer())),
        ...(caption ? { caption } : {}),
      });
      return back(noticeFor(result));
    }

    if (pathname === `${CHAT_PATH}/say`) {
      const text = field("text");
      // Neither of these reaches the engine, so neither spends an analysis: an empty submit is a
      // stray Enter, and a body past the cap is refused by the same number the app enforces.
      if (text === "") return back();
      if (text.length > MAX_USER_LINE) return back("too-long");

      const result = await handleText(ctx.deps, userId, { text });
      if (result.kind === "proposed") {
        return seeOther(`${CHAT_PATH}?pending=${encodeURIComponent(result.pendingId)}`);
      }
      return back(noticeFor(result));
    }

    if (pathname === `${CHAT_PATH}/confirm` || pathname === `${CHAT_PATH}/cancel`) {
      const pendingId = field("pendingId");
      if (pendingId === "") return back("expired");
      const result = pathname.endsWith("/confirm")
        ? await confirmPendingMeal(ctx.deps, userId, pendingId)
        : await cancelPendingMeal(ctx.deps, userId, pendingId);
      // `expired` is also what another account's id resolves to, and deliberately reads the same:
      // the page must not become a way to ask whether some proposal exists somewhere.
      if (result.kind === "expired") return back("expired");
      return back(noticeFor(result));
    }

    return notFound();
  }

  if (req.method === "GET" && pathname === `${START_PREFIX}/plan`) {
    const full = await profileView(ctx.deps, userId);
    if (!full || !full.onboarded) return seeOther(`${START_PREFIX}/q`);
    // WHICH BUTTON TO PRESS IN THE APP, named rather than guessed, and the reason this page reads
    // identities at all. The app offers both, and pressing the other one does not find this
    // account: it attaches to the anonymous one the install already had, so onboarding runs a
    // second time and the plan on this page — and any subscription bought from it — stays on an
    // account the phone is no longer in. `engine/identity.ts` will not merge two real identities,
    // so nothing downstream can repair it. One sentence naming the right button is what prevents it.
    const identities = await ctx.store.listIdentities(userId);
    const signedInWith = identities
      .map((i) => i.provider).find((p): p is WebProvider => p === "apple" || p === "google") ?? null;
    return html(plan({
      signedInWith,
      kcal: full.targets.kcal,
      proteinG: full.targets.protein_g,
      floorApplied: full.basis.floorApplied,
      floorKcal: full.basis.floorKcal,
      // The id goes in the URL because RevenueCat's webhook is the only thing that can grant the
      // entitlement and `app_user_id` is how it names the account. An anonymous checkout produces a
      // delivery this server refuses — see `api/revenuecat.ts`.
      checkoutUrl: config.webCheckoutUrl === ""
        ? null
        // `replaceAll`: a template naming the placeholder twice — a path segment and a query
        // parameter, which is a shape real checkout links take — would otherwise ship the second
        // one literally.
        : config.webCheckoutUrl.replaceAll("{userId}", encodeURIComponent(userId)),
    }));
  }

  return notFound();
}

/** The words for a code, and nothing at all for a code this page does not know. */
function noticeText(code: string | null): string | null {
  return code !== null && Object.hasOwn(CHAT_NOTICE, code) ? CHAT_NOTICE[code]! : null;
}

/**
 * The code for an engine result: a refusal by name, a cap by the allowance that actually ran out,
 * and nothing for a turn that worked.
 *
 * `target-gone` IS NOT A REFUSAL and has to be named separately — `REFUSAL_STATUS` does not carry
 * it, so gating on `isRefusal` alone read it as a turn that worked. `keep()` writes no line for
 * one either, so a page with no notice is a submit that appears to have done nothing at all.
 *
 * AND IT MEANS SOMETHING ELSE HERE. This page never sends a `focusMealId` — there is no way to open
 * a meal on it — so the meal did not vanish mid-turn as it can in the app: nothing was ever in
 * focus. Saying "that meal was deleted" would assert an event that did not happen, so the code
 * carries `on` and the words say what is actually true of this surface.
 */
function noticeFor(result: { kind: string; scope?: string; on?: string }): string | undefined {
  if (result.kind === "target-gone") return `no-focus-${result.on ?? "correction"}`;
  if (!isRefusal(result)) return undefined;
  return result.kind === "cap-exceeded" ? `cap-${result.scope ?? "user"}` : result.kind;
}

/**
 * One stored line, in the shape the page draws.
 *
 * A card is resolved from the meal as it is NOW (`chatHistory` does the read), so a verdict on this
 * page never describes numbers that have since changed — and a meal that is gone says so rather
 * than rendering a stale one. `who` is the stored speaker: Gabie answers questions, and everything
 * else is Spud, whose name the page does not repeat because he is the voice it opens in.
 */
function threadLine(e: ChatEntry): ChatLine {
  if (e.role === "user") {
    return e.kind === "photo"
      ? { kind: "user", text: e.text, photo: true }
      : { kind: "user", text: e.text };
  }
  if (e.kind === "text") return { kind: "said", who: e.speaker === "gabie" ? "Gabie" : null, text: e.text };
  const meal = e.meal;
  if (!meal) return { kind: "card", card: null };
  return {
    kind: "card",
    card: {
      title: meal.items.map((i) => i.name).join(", ") || "A meal",
      kcal: Math.round(meal.kcal),
      proteinG: Math.round(meal.protein_g),
      verdicts: renderableVerdicts(meal.verdicts).map((d) => verdictPillLabel(d, meal.verdicts[d]!)),
    },
  };
}

/** A quick reply: an extra submit button beside the answer. */
interface Action { name: string; value: string; label: string }

function renderQuestion(
  questions: readonly ChatPrompt[],
  index: number,
  profile: Profile,
  content: OnboardingContent,
  error: string | null,
  actions: Action[] = [],
): string {
  const prompt = questions[index]!;
  return question({
    promptId: prompt.id,
    kind: prompt.kind === "chips" ? "chips" : prompt.kind === "number" ? "number" : "choice",
    lines: askLines(prompt, content, profile),
    options: prompt.kind === "number" ? [] : optionsFor(prompt, content),
    placeholder: askPlaceholder(prompt, content),
    error,
    actions,
    step: index + 1,
    total: questions.length,
  });
}
