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
  ageFrom,
  AMBIGUOUS_AGE, DIETS, MEDICAL_TAGS, STRUGGLES, UNDER_AGE_CARD, UNDER_AGE_LINES, askLines,
  chatCopyFor as CHAT,
  askPlaceholder, checkDirection, checkNumber, dietOf, disabledScreens, isAnswered, promptsFor,
  isRefusal, MAX_USER_LINE, medicalOf, offerHeadline, optionLabel, planGoalLine, planRows, projectGoal,
  promptById,
  renderableVerdicts, resolveCountry, ROUTES, screenForStep,
  screenOptions, screenOptionValues, suggestedTargetKg, suggestionFirst,
  switchedLine, targetRange, targetSuggestionLine, TARGET_STEP_KG,
  LANGS_READY, acceptLang, acceptLanguageTags, numbers, signupCopyFor, verdictPillLabel,
  type ChatEntry, type ChatPrompt, type ChatPromptId, type Diet, type Goal, type Lang,
  type MedicalTag, type NumberField, type OnboardingContent, type PatchProfileRequest,
  type Profile, type Struggle,
} from "@eait/shared";
import { AuthError, type IdentityVerifier } from "../auth/verify.ts";
import { BROWSER_SESSION_TTL_MS } from "../auth/tokens.ts";
import type { WebProvider, WebSignInProvider } from "../auth/web-oauth.ts";
import { checkWebProvider } from "../auth/web-auth-check.ts";
import {
  cancelPendingMeal, chatHistory, confirmPendingMeal, handleText, isAnonymous, logPhotoMeal,
  onboardingContent, mintPairingCode, patchProfile, profileView, redeemPairingCode,
  signInWithProvider, type EngineDeps,
} from "../engine/index.ts";
import { blankProfile, type Store } from "../store.ts";
import {
  // NOT `PAGE_COPY`. It is the English alias, and every use here is shadowed by a local
  // `pageCopyFor(lang)` — so importing it buys nothing and costs a silent English render the
  // day somebody writes `PAGE_COPY.foo` outside one of those scopes. Unimported, that is a
  // compile error instead.
  building, chat, frontDoor, html, offer, pageCopyFor, plan, question, signUp, stopped,
  FONT_FILES, FONT_URL_DIR,
  type PageCopy,
  type ChatLine, type ChatProposal, type QuestionOption,
} from "./page.ts";

/**
 * Re-exported from the contract, which is where the one spelling lives (#408): the phone is told
 * this path in `ProfileResponse.pairAddress` and prints it, so a second literal here is a second
 * literal that can drift from the address people are asked to type.
 */
export const START_PREFIX = ROUTES.webStart;

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
const chatNotice = (copy: PageCopy): Record<string, string> => ({
  expired: copy.chatExpired,
  "identity-required": copy.chatRefusalIdentity,
  "too-long": copy.chatTooLong,
  "cap-address": copy.chatRefusalNetwork,
  "cap-global": copy.chatRefusalGlobal,
  "cap-user": copy.chatRefusalDay,
  "subscription-required": copy.chatRefusalSubscription,
  "analysis-failed": copy.chatRefusalFailed,
  "not-food": copy.chatRefusalNotFood,
  "no-focus-correction": copy.chatNoFocusCorrection,
  "no-focus-redate": copy.chatNoFocusRedate,
  "not-onboarded": copy.chatNotOnboarded,
  "unsupported-image": copy.chatRefusalImage,
  "no-photo": copy.chatRefusalNoPhoto,
  "too-many": copy.chatTooMany,
  "too-large": copy.chatTooLarge,
});

/**
 * The label on each button, and the order they are offered in — Apple first, as in the app.
 *
 * The BRAND is not translated and the verb around it is: "Weiter mit Apple", never "Weiter mit
 * Apfel". Same rule as `LANG_LABEL` and the product's own name.
 */
const providerLabel = (p: WebProvider, lang: Lang): string =>
  pageCopyFor(lang).continueWith.replace("{provider}", p === "apple" ? "Apple" : "Google");

/** What this browser asked for, narrowed. The only language signal there is before a session. */
const browserLang = (req: Request): Lang =>
  acceptLang(req.headers.get("accept-language"));

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
   * Whether this deployment has a web application to send anybody to.
   *
   * From the same one read of the bundle that serves it, so this and `/` cannot disagree. False
   * means every path here behaves as it did before the web app existed — a deployment that never
   * built one must not bounce people into a 404.
   */
  hasWebApp: boolean;
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
 *
 * WORDED FROM THE HEADER, NEVER FROM THE ACCOUNT. Two of the three callers have no account yet, and
 * the third is on the path that exists to SHED load — reading a profile to word a rate-limit
 * refusal is a database query on the one request we have decided not to serve.
 */
const tooManyAttempts = (wait: number, lang: Lang): Response =>
  new Response(pageCopyFor(lang).tooManyAttempts, {
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

/**
 * No live session, told to a SCRIPT rather than a person (#457) — see where the session is read.
 *
 * The mint's own shape with no token in it, so its one caller reads one field either way. The
 * cookie is cleared: whatever the browser presented is not a session, and presenting it again on
 * the next load buys nothing.
 */
const noSession = (secure: boolean): Response => {
  const headers = new Headers({ "content-type": "application/json", "cache-control": "no-store" });
  headers.append("set-cookie", clearCookie(SESSION_COOKIE, secure));
  return new Response(JSON.stringify({ token: null }), { headers });
};

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

/**
 * WHERE A SESSION RESUMES — the flow's own order (S8): questions on the session account, then the
 * plan, then sign-up, then the one deferred question, then the product. A cookie from any point
 * in that lands wherever its account actually is, so closing a tab mid-walk is not a lost walk.
 *
 * The pairing form and the front door both call this; it is the single place the order lives.
 */
async function resumeTo(ctx: StartContext, userId: string, profile: Profile): Promise<string> {
  if (profile.onboarded_at === null) return `${START_PREFIX}/q`;
  if (await isAnonymous(ctx.deps, userId)) return `${START_PREFIX}/plan`;
  if (profile.country === null) return `${START_PREFIX}/country`;
  return ctx.hasWebApp ? "/" : CHAT_PATH;
}

/**
 * The questions this surface asks: every prompt that fills a profile field, in the app's order.
 *
 * `askCountry` is the browser's half of the rule the phone applies in `onboarding.tsx` — the group
 * is switched on now, and what decides who meets it is whether the client could answer it. Two
 * surfaces asking different questions behind one profile is the thing the test below has an
 * assertion against, so this takes the decision as an argument rather than making a second one.
 */
function questionsFor(profile: Profile, content: OnboardingContent, askCountry = true): ChatPrompt[] {
  const off = disabledScreens(content);
  // { health: false } — a browser cannot read Apple Health, so the v5 offer never appears here.
  return promptsFor(profile, askCountry ? off : [...off, "country"], { health: false })
    .filter((p) => p.field !== undefined);
}


/** A tag's region: the first two-letter subtag after the language, so "zh-Hans-CN" still answers. */
const regionOf = (tag: string): string | undefined =>
  tag.split("-").slice(1).find((part) => /^[A-Za-z]{2}$/.test(part));

/**
 * The values a choice or chips question offers, with the admin's labels on them.
 *
 * A LABEL THE CONTENT DOES NOT CARRY FALLS BACK TO CLDR, not to the raw value. That is the
 * country list: fifteen countries in eight languages is 120 strings nobody should type, so
 * `countryLabel` names them and the content carries only `other`. An admin who writes one anyway
 * still wins — this reads the content first.
 */
function optionsFor(
  prompt: ChatPrompt,
  content: OnboardingContent,
  lang: Lang,
  suggested: string | null = null,
): QuestionOption[] {
  const screen = screenForStep(prompt.field!);
  const values = suggestionFirst(prompt.options ?? screenOptionValues(screen, lang), suggested);
  const labels = screenOptions(content, screen);
  return values.map((value) => ({
    value,
    label: labels[value]?.label ?? optionLabel(screen, value, lang),
    ...(labels[value]?.hint ? { hint: labels[value]!.hint! } : {}),
  }));
}

type Answered =
  | { kind: "patch"; patch: PatchProfileRequest }
  /** Refused before it costs a round trip, in the words `shared` wrote for it. */
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
 * that conversion lives in `shared` and nowhere else, so a web page doing its own `Number()`
 * would take "34" and store it as a birth year — a person aged 1,992, refused by the server with a
 * sentence about the year, under a bubble that asked how old they are. The bands it enforces are
 * likewise a deliberate subset of the server's, so the only refusals anybody can meet are the two
 * that have words written for them.
 */
function answerFor(prompt: ChatPrompt, answers: string[], profile: Profile): Answered {
  const field = prompt.field!;
  // The three v2 writes (#82). `struggles` stores the picked chips in the list's own order; `diet`
  // and `medical` go to the server AS their write views and it rewrites `restrictions` — the web
  // never composes the tag array, like everywhere else.
  if (field === "struggles") {
    return {
      kind: "patch",
      patch: {
        struggles: answers.filter((a): a is Struggle => (STRUGGLES as readonly string[]).includes(a)),
      },
    };
  }
  if (field === "medical") {
    return {
      kind: "patch",
      patch: {
        medical: answers.filter(
          (a): a is MedicalTag => (MEDICAL_TAGS as readonly string[]).includes(a),
        ),
      },
    };
  }
  if (field === "diet") {
    const value = answers[0];
    if (value === undefined || !(DIETS as readonly string[]).includes(value)) {
      return { kind: "missing" };
    }
    return { kind: "patch", patch: { diet: value as Diet } };
  }
  const value = answers[0];
  if (value === undefined || value === "") return { kind: "missing" };

  if (prompt.kind === "number") {
    const checked = checkNumber(field as NumberField, value, profile.lang, new Date());
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
      const wrong = checkDirection(profile.goal, profile.weight_kg, checked.value, profile.lang);
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
function refusalText(r: { reason: string; minHealthyKg?: number }, lang: Lang): string {
  const copy = pageCopyFor(lang);
  if (r.reason === "target-weight-below-healthy-bmi") {
    return copy.belowHealthyTarget.replace("{kg}", numbers(lang)(r.minHealthyKg ?? 0));
  }
  if (r.reason === "age-below-minimum") return copy.ageBelowMinimum;
  return copy.outOfRange;
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
  // The session, resolved once for every path here. On the sign-up flow it is the SESSION ACCOUNT
  // the OAuth callback attaches the identity to (S8): onboarding runs on an account with no
  // identity — the cookie's — and sign-up writes Apple or Google onto it.
  const session = cookies[SESSION_COOKIE] ?? "";
  const userId = session === "" ? null : await ctx.store.userIdForToken(session);

  // ── The front door ────────────────────────────────────────────────────────────────────────
  if (req.method === "GET" && (pathname === START_PREFIX || pathname === `${START_PREFIX}/`)) {
    // A session mid-flow resumes where its account is — the questions, the plan, the deferred
    // country, or the product itself — rather than the welcome a returning user has no use for.
    // The welcome only exists for somebody with no session at all.
    if (userId !== null) {
      const profile = await ctx.store.getProfile(userId);
      if (profile !== null) return seeOther(await resumeTo(ctx, userId, profile));
    }
    // THE BROWSER'S HEADER, because the front door is the one page that runs before there is an
    // account to ask. Everything past it reads `profile.lang`, which the first answer's account
    // seeds from this same signal and the picker overrules — so this is a starting guess and
    // never the answer.
    const lang = acceptLang(req.headers.get("accept-language"));
    const SIGNUP_COPY = signupCopyFor(lang);
    const content = await onboardingContent(ctx.deps, lang);
    return html(frontDoor(content.welcome.lines, [
      { href: `${START_PREFIX}/q`, label: SIGNUP_COPY.startCta },
      { href: `${START_PREFIX}/signup`, label: SIGNUP_COPY.haveAccountCta },
    ], lang));
  }

  // The typeface, on this origin, which is what lets the CSP stay at `font-src 'self'` and load
  // nothing from anyone else. Before the session gate: a font is not somebody's data, and a
  // sign-in page that cannot draw its own headings is the first thing a visitor sees.
  if (req.method === "GET" && pathname.startsWith(`${FONT_URL_DIR}/`)) {
    // The whitelist is the family's own file list (FONT_FILES): a path under the directory that
    // is not one of them is a 404, not a file read — `../../shared/assets/fonts/${name}` is never
    // built from request bytes the list did not name.
    const name = pathname.slice(FONT_URL_DIR.length + 1);
    if (!FONT_FILES.includes(name)) return notFound();
    return new Response(Bun.file(new URL(`../../shared/assets/fonts/${name}`, import.meta.url)), {
      headers: {
        "content-type": "font/woff2",
        // Immutable because the name is the file: a new cut of the typeface is a new path.
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  }

  // ONE CHAT ON THE WEB (#499). Where this deployment has a web application, ITS chat is the chat:
  // the short link and this page's own address both send people there, signed in or not — it has
  // its own way to sign somebody in. The page below stays for a deployment with no web application,
  // and the POSTs under it stay for a tab opened before this, which still posts to them.
  if (req.method === "GET" && ctx.hasWebApp && (pathname === CHAT_ALIAS || pathname === CHAT_PATH)) {
    return seeOther("/#/chat");
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

  // ── The sign-up screen (S8) ───────────────────────────────────────────────────────────────
  //
  // One screen for both callers: a session account signing UP after its answers, and a returning
  // person signing IN from "I already have an account" — attaching an identity and presenting one
  // are the same mechanism either way, and the consent boxes are required for both.
  //
  // BEFORE THE SESSION GATE: a returning sign-in arrives with no cookie at all.
  if (pathname === `${START_PREFIX}/signup`) {
    if (req.method !== "GET") return notFound();
    // A session that already carries an identity has nothing to sign up for — send it onward,
    // which is also what keeps a signed-in person who taps "I already have an account" from
    // signing themselves a second account over their own.
    if (userId !== null && !(await isAnonymous(ctx.deps, userId))) {
      const profile = await ctx.store.getProfile(userId);
      if (profile !== null) return seeOther(await resumeTo(ctx, userId, profile));
    }
    const profile = userId === null ? null : await ctx.store.getProfile(userId);
    const lang = profile?.lang ?? browserLang(req);
    const PAGE_COPY = pageCopyFor(lang);
    return html(signUp({
      providers: offered.map((p) => ({
        action: `${START_PREFIX}/auth/${p}`, label: providerLabel(p, lang),
      })),
      error: url.searchParams.get("error") === "code" ? PAGE_COPY.errorPair
        : url.searchParams.get("error") === "terms" ? signupCopyFor(lang).errorTerms
        : url.searchParams.has("error") ? PAGE_COPY.errorSignIn
        : null,
      privacyHref: config.landingUrl === "" ? null : `${config.landingUrl}/privacy`,
      lang,
    }), 200, {
      // The consent POST answers with a 303 to the provider's own origin — and `form-action`
      // is checked against EVERY hop, so each configured provider's authorize origin is named.
      formAction: [...new Set(offered.map(
        (p) => new URL(usable[p]!.authorizeEndpoint, ctx.origin).origin,
      ))],
    });
  }

  // THE KICKOFF IS A POST — the consent boxes ride the form, and a cookie the callback reads is
  // only ever minted by a request that carried the tick. GET on the same path goes back to the
  // screen rather than starting anything: a sign-in started without consent is not started at all.
  const postedAuth = req.method === "POST" ? AUTH_PATH.exec(pathname) : null;
  if (postedAuth && postedAuth[2] === undefined) {
    const name = postedAuth[1] as WebProvider;
    const provider = usable[name];
    if (!provider) return notFound();
    const form = await req.formData().catch(() => null);
    // The required box, enforced on the server: the screen's tick is a suggestion, the POST is the
    // fact. The fourth cookie segment carries the optional box's answer — terms is implied, since
    // this cookie cannot exist without it.
    if (form === null || form.get("terms") === null) return seeOther(`${START_PREFIX}/signup?error=terms`);
    const marketing = form.get("marketing") !== null;
    const state = randomToken();
    const nonce = randomToken();
    const redirectUri = `${ctx.origin}${START_PREFIX}/auth/${name}/callback`;
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
      setCookie(OAUTH_COOKIE, `${name}.${state}.${nonce}.${marketing ? "m" : ""}`, { secure, maxAge: OAUTH_TTL_S }),
    ]);
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
      // A GET kickoff cannot carry consent, so it carries the visitor to the screen that asks
      // for it. Old links lose nothing: the sign-up screen is what they meant.
      return seeOther(`${START_PREFIX}/signup`);
    }

    const failed = () => seeOther(`${START_PREFIX}/signup?error=1`, [clearCookie(OAUTH_COOKIE, secure)]);
    const [forProvider, state, nonce, consentFlags] = (cookies[OAUTH_COOKIE] ?? "").split(".");
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
      return tooManyAttempts(wait, browserLang(req));
    }

    let result;
    try {
      const idToken = await provider.exchange(code, redirectUri);
      // The SAME verifier the app's route uses. Nothing about this being a browser makes the
      // signature, the issuer, the audience or the nonce optional.
      //
      // THE SESSION ACCOUNT GOES IN: the cookie's account is the one onboarding ran on, so an
      // unknown identity attaches to IT and the answers stay; an identity that already has an
      // account wins instead, and the session's answers are dropped with it. Consent came off the
      // kickoff's cookie — the one only a ticked terms box could mint.
      result = await signInWithProvider(
        ctx.deps, ctx.verifier, name, idToken, nonce, userId,
        // ...and the header decides the language only when this sign-in CREATES the account — the
        // same reading the front door took — since every other outcome keeps the surviving one.
        browserLang(req),
        { terms: true, marketing: consentFlags === "m" },
      );
    } catch (e) {
      // Logged, never shown. The exchange's error quotes the request and the verifier's can quote
      // the token.
      console.error(`[eait] web sign-in failed: ${e instanceof AuthError ? e.reason : (e as Error)?.message}`);
      return failed();
    }
    const landed = await ctx.store.getProfile(result.userId);
    return seeOther(
      landed === null ? `${START_PREFIX}/q` : await resumeTo(ctx, result.userId, landed),
      [
        clearCookie(OAUTH_COOKIE, secure),
        // No Max-Age: a session cookie, gone when the browser closes. The token itself expires on
        // idle time server-side, which is the authority.
        setCookie(SESSION_COOKIE, result.token, { secure }),
      ],
    );
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
      return tooManyAttempts(wait, browserLang(req));
    }
    const form = await req.formData().catch(() => null);
    const code = form?.get("code");
    const token = await redeemPairingCode(ctx.deps, typeof code === "string" ? code : "");
    // ONE ANSWER for unknown, spent, expired and malformed. Anything else is an oracle for which
    // codes are live, and the person holding a dead code has the same thing to do in every case.
    // Back to the sign-up screen, which is where the pairing form lives now (S8).
    if (token === null) return seeOther(`${START_PREFIX}/signup?error=code`);
    return seeOther(CHAT_PATH, [
      // The callback's cookie, verbatim: same name, same flags, no Max-Age. A paired browser holds
      // an ordinary session and nothing downstream can tell it apart from a signed-in one — which
      // is the point, and is why `/start/chat` needs no branch for it (an un-onboarded account is
      // bounced to `/start/q` there, so a browser can even finish onboarding).
      setCookie(SESSION_COOKIE, token, { secure }),
    ]);
  }

  // ── Everything past here needs the session ────────────────────────────────────────────────
  //
  // A PAGE WITH NO SESSION GOES TO THE FRONT DOOR; A SCRIPT IS TOLD SO IN JSON (#457). The two
  // `session/*` routes below are called by the web app with `fetch` and read as JSON, never
  // navigated to, so a 303 is not an answer they can take: `api.ts` does not follow it, and Chrome
  // records its target as a failed request — one red line in every anonymous visitor's console. A
  // 401 is no better, Chrome logs "Failed to load resource" for it. A 200 whose body carries no
  // token logs nothing, and says exactly what is true. All three measured in Chrome, 2026-09-10.
  const scripted = req.method === "POST"
    && (pathname === `${START_PREFIX}/session/token` || pathname === `${START_PREFIX}/session/signout`);
  // THE ONE ROUTE WITHOUT A SESSION IS THE QUESTIONS THEMSELVES (S8): onboarding runs on the
  // session account, which the first answer creates — so `/start/q` renders and posts without a
  // cookie, and everything else still goes to the front door (or answers a script in JSON).
  const preAccount = userId === null && pathname === `${START_PREFIX}/q`
    && (req.method === "GET" || req.method === "POST");
  if (userId === null && !preAccount) return scripted ? noSession(secure) : seeOther(START_PREFIX);

  // Read once, and NOT non-null asserted. A token can outlive the profile it names — an erasure
  // racing this request, and `deleteUser` revokes tokens rather than waiting for them — and the
  // assertion turned that into a TypeError, which the router's outer catch answers as a JSON 500 on
  // an HTML surface. The front door with the cookie cleared is what that session actually is.
  //
  // On the pre-account path there IS no row yet: the questions render against a blank profile in
  // the browser's own language, and the account — and its language — is created by the first
  // answer that lands, not by a page view.
  const profile = userId === null
    ? blankProfile("pre-account", browserLang(req))
    : await ctx.store.getProfile(userId);
  if (profile === null) {
    return scripted ? noSession(secure) : seeOther(START_PREFIX, [clearCookie(SESSION_COOKIE, secure)]);
  }

  // THE ACCOUNT'S LANGUAGE, and the copy fetched in it — or the browser's, on the one path that
  // runs before an account exists: the pre-account `/q` renders the blank profile in
  // `browserLang(req)`, which is also the language the first answer's account is born into.
  const view = async (): Promise<{ profile: Profile; content: OnboardingContent }> => ({
    profile, content: await onboardingContent(ctx.deps, profile.lang),
  });

  if (pathname === `${START_PREFIX}/q`) {
    const { profile, content } = await view();

    // COUNTRY IS NOT A WALK QUESTION ANY MORE (S8): it waits for the sign-up and is asked on its
    // own screen after it (`/start/country`), preselected where the browser's languages already
    // answer it. `false` here keeps it out of `promptsFor` — and out of the step count.
    const questions = questionsFor(profile, content, false);
    // `diet` and `medical` are the two prompts whose answer the profile cannot SHOW mid-run: a
    // Balanced pick stores no tag, and `medical` reads as answered only once `onboarded_at` lands
    // — the binding's resume rule, which a mid-walk request cannot tell from "was just answered".
    // The `asked` params are THIS RUN's memory of them: each POST appends the prompt it wrote to
    // the redirect, and every rendered form carries the set forward in its action. Honored ONLY
    // for those two ids — a crafted `?asked=height_cm` is ignored — and absent from a fresh URL,
    // so a Balanced picker who left mid-run is still asked the diet once more on return, which is
    // the accepted re-ask the same binding describes.
    const asked = new Set<string>(
      url.searchParams.getAll("asked").filter((a) => a === "diet" || a === "medical"),
    );
    const openIndex = questions.findIndex((p) => !isAnswered(p, profile) && !asked.has(p.id));
    // What the just-rendered form posts to — the set travels inside the walk, never into history.
    const askPath = asked.size === 0
      ? `${START_PREFIX}/q`
      : `${START_PREFIX}/q?${[...asked].map((a) => `asked=${a}`).join("&")}`;
    // BACK (#53): an answered question, shown again to change. Only one BEFORE the open question —
    // what is past it has no answer to show, and the profile still decides where the walk resumes.
    const editable = (id: unknown): number => {
      const i = questions.findIndex((p) => p.id === id);
      return i !== -1 && (openIndex === -1 || i < openIndex) && isAnswered(questions[i]!, profile) ? i : -1;
    };

    const askAt = (
      index: number, error: string | null, actions: Action[] = [], draftKg?: number, typed?: string[],
    ) =>
      html(renderQuestion(
        questions, index, profile, content, error, actions, null, draftKg,
        typed ?? (index === openIndex ? undefined : currentAnswer(questions[index]!, profile)),
        askPath,
      ));
    const ask = (error: string | null, actions: Action[] = [], draftKg?: number) =>
      askAt(openIndex, error, actions, draftKg);

    if (req.method === "GET" && url.searchParams.has("edit")) {
      const i = editable(url.searchParams.get("edit"));
      if (i === -1) return seeOther(`${START_PREFIX}/q`);
      const kg = questions[i]!.id === "target_weight_kg" ? profile.target_weight_kg ?? undefined : undefined;
      return askAt(i, null, [], kg);
    }

    if (req.method === "GET") {
      if (openIndex === -1) return seeOther(`${START_PREFIX}/plan`);
      // The goal was just flipped mid-question, so the target is asked again in the words the app
      // uses for it rather than in silence.
      const switched = url.searchParams.has("switched") && profile.goal !== null
        ? switchedLine(profile.goal, profile.lang)
        : null;
      return ask(switched);
    }

    if (req.method === "POST") {
      const form = await req.formData().catch(() => null);
      if (form === null) return seeOther(`${START_PREFIX}/q`);

      // THE FIRST ANSWER CREATES THE ACCOUNT (S8). Onboarding runs on the session account — this
      // surface's version of the phone's device account — so the answers are already the
      // account's when Apple or Google attaches at sign-up. Only an answer that LANDS creates
      // one: a refused first answer re-renders against the blank profile and leaves no row,
      // which is also why a page view never creates anything.
      if (userId === null) {
        const open = questions[0];
        if (open === undefined || form.get("prompt") !== open.id) return seeOther(`${START_PREFIX}/q`);
        // The under-sixteen confirm can only be offered by a walk that has an account; posted
        // without one it is still honoured — nothing was ever kept, which is what the page says.
        if (form.get("confirm") === "under-age") {
          const card = UNDER_AGE_CARD(profile.lang);
          return html(stopped(card.title, card.body, UNDER_AGE_LINES(profile.lang).stopped, profile.lang));
        }
        const typed = form.getAll("answer").filter((v): v is string => typeof v === "string");
        const answer = answerFor(open, typed, profile);
        const retry = (error: string | null, actions: Action[] = []) =>
          html(renderQuestion(questions, 0, profile, content, error, actions, null, undefined,
            typed.length > 0 ? typed : undefined));
        if (answer.kind === "missing") return retry(pageCopyFor(profile.lang).answerRequired);
        if (answer.kind === "ambiguous-age") {
          const age = AMBIGUOUS_AGE(profile.lang);
          return retry(age.line(answer.age), [
            { name: "age", value: String(answer.age), label: age.confirm(answer.age) },
          ]);
        }
        if (answer.kind === "under-age") {
          const under = UNDER_AGE_LINES(profile.lang);
          return retry(under.ask, [{ name: "confirm", value: "under-age", label: under.confirm }]);
        }
        if (answer.kind === "refuse") return retry(answer.line);
        // Charged like `/v1/auth/device`, because it IS that route's job under S8: a sessionless
        // answer mints an account, so the per-address allowance is what stands between a bot
        // walking this form and a `users` row per POST. Charged after validation — a refused
        // answer creates nothing and spends nothing either.
        const wait = ctx.limitAuth();
        if (wait !== null) return tooManyAttempts(wait, profile.lang);
        const fresh = await ctx.store.createUser(profile.lang);
        const outcome = await patchProfile(ctx.deps, fresh, answer.patch);
        if (outcome && !outcome.ok) return retry(refusalText(outcome.rejected, profile.lang));
        const token = await ctx.store.issueToken(fresh);
        return seeOther(`${START_PREFIX}/q`, [setCookie(SESSION_COOKIE, token, { secure })]);
      }

      // The open question is the server's to decide, so a post naming a LATER one is dropped rather
      // than applied: the profile is what says where somebody is, on this surface exactly as in the
      // app. An EARLIER, answered one is Back's change (#53), written the same way and then resumed.
      const editIndex = form.get("prompt") === questions[openIndex]?.id ? -1 : editable(form.get("prompt"));
      if (editIndex === -1 && (openIndex === -1 || form.get("prompt") !== questions[openIndex]!.id)) {
        return seeOther(openIndex === -1 ? `${START_PREFIX}/plan` : `${START_PREFIX}/q`);
      }
      const at = editIndex === -1 ? openIndex : editIndex;
      const open = questions[at]!;
      // A refused answer is shown back as typed (#53): wiping the box made the person retype it.
      const typed = form.getAll("answer").filter((v): v is string => typeof v === "string");
      const ask = (error: string | null, actions: Action[] = [], draftKg?: number) =>
        askAt(at, error, actions, draftKg, typed.length > 0 ? typed : undefined);

      // The stepper's − and + ARE submits of this same form: the shown number comes back as
      // `answer` with a `step` direction, and the page answers stepped — a render, not a redirect,
      // because nothing was written and a refresh can only re-ask. The range is the server's own;
      // a crafted POST clamps at it the same way the disabled button does.
      const stepReq = form.get("step");
      if (open.id === "target_weight_kg" && stepReq !== null) {
        const dir = stepReq === "-1" ? -1 : stepReq === "1" ? 1 : 0;
        const range = targetRange(profile);
        const draft = Number(form.get("answer"));
        if (dir === 0 || !Number.isFinite(draft)) return ask(null);
        return range === null
          ? ask(null)
          : ask(null, [], Math.min(range.max, Math.max(range.min, draft + dir * TARGET_STEP_KG)));
      }

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
        if (outcome && !outcome.ok) return ask(refusalText(outcome.rejected, profile.lang));
        return seeOther(`${START_PREFIX}/q`);
      }

      // The under-sixteen stop, taken. The account goes: "nothing you told me is kept" is a
      // promise, and the goal and the sex answered a minute ago are already rows.
      if (form.get("confirm") === "under-age") {
        await ctx.store.deleteUser(userId);
        const card = UNDER_AGE_CARD(profile.lang);
        return html(stopped(card.title, card.body, UNDER_AGE_LINES(profile.lang).stopped, profile.lang), 200, {
          cookies: [clearCookie(SESSION_COOKIE, secure)],
        });
      }

      const answers = form.getAll("answer").filter((v): v is string => typeof v === "string");
      const answer = answerFor(open, answers, profile);
      if (answer.kind === "missing") return ask(pageCopyFor(profile.lang).answerRequired);
      if (answer.kind === "ambiguous-age") {
        // The quick reply takes it as an age; four digits in the box take it as the year.
        const age = AMBIGUOUS_AGE(profile.lang);
        return ask(age.line(answer.age), [
          { name: "age", value: String(answer.age), label: age.confirm(answer.age) },
        ]);
      }
      if (answer.kind === "under-age") {
        // Offered ONCE, in case a typo got us here. Confirming is what takes the stop.
        const under = UNDER_AGE_LINES(profile.lang);
        return ask(under.ask, [{ name: "confirm", value: "under-age", label: under.confirm }]);
      }
      if (answer.kind === "refuse") {
        return ask(answer.line, answer.switchTo
          ? [{
              name: "switch",
              value: answer.switchTo,
              label: answer.switchTo === "lose"
                ? CHAT(profile.lang).direction.switchToLose
                : CHAT(profile.lang).direction.switchToGain,
            }]
          : []);
      }
      // COMPLETION RIDES THE LAST QUESTION'S PATCH, whichever one it is — `medical`, since country
      // is S8's own screen after the sign-up and never in this walk. It goes on the patch rather
      // than a second POST so a partial write can never mark a run complete.
      const patch: PatchProfileRequest =
        editIndex === -1 && at === questions.length - 1
          ? { ...answer.patch, complete_onboarding: true }
          : answer.patch;
      const outcome = await patchProfile(ctx.deps, userId, patch);
      if (outcome && !outcome.ok) return ask(refusalText(outcome.rejected, profile.lang));
      // THE REVEAL IS THE COMPLETING PATCH'S ANSWER (W3), not a state `/start/q` resumes into:
      // the run that just wrote `complete_onboarding` lands on it once, and every later arrival —
      // a resume, a return, a refresh — goes to the plan itself.
      if (editIndex === -1 && at === questions.length - 1) return seeOther(`${START_PREFIX}/building`);
      // The walk's memory of the two answers a mid-run GET cannot see (see `asked` above): the
      // redirect appends the prompt just written so the next page knows it was passed.
      const nextAsked = new Set(asked);
      if (open.id === "diet" || open.id === "medical") nextAsked.add(open.id);
      const marker = nextAsked.size === 0
        ? "" : `?${[...nextAsked].map((a) => `asked=${a}`).join("&")}`;
      return seeOther(`${START_PREFIX}/q${marker}`);
    }
  }

  // Past the questions, null is not a state a session can be in — the gate above let it through
  // for `/start/q` alone, and this line is what the compiler learns that from.
  if (userId === null) return notFound();

  // ── THE BEARER THIS PAGE'S JAVASCRIPT MAY HOLD (#407) ─────────────────────────────────────
  //
  // The web app on this origin talks to `/api/v1/*`, and that API is bearer-only — deliberately,
  // because an API that accepts a cookie is an API another origin can post to on a signed-in
  // browser. So the bundle needs a token, and this is the one place it can get one.
  //
  // A SECOND TOKEN, NOT THE COOKIE'S OWN VALUE. The session cookie is HttpOnly precisely so script
  // cannot read it; handing its value back would undo that. A separate token means the cookie
  // never enters JavaScript and the two can be revoked apart.
  //
  // IN THE BODY, NEVER IN A URL. A bearer in a query string lands in history, in a `Referer` and in
  // every log between here and the browser — the thing this document refuses by name.
  //
  // A POST, so `SameSite=Lax` is the guard. A cross-site GET navigation carries a Lax cookie and a
  // cross-site POST does not, which is why every write on this surface is a POST; minting a
  // credential is a write.
  // ── ENDING THE SESSION, WHICH IS A SERVER-SIDE ACT ───────────────────────────────────────
  //
  // The web app's Sign out cleared a variable in its own module and nothing else. The cookie is
  // HttpOnly, so script cannot clear it, and it stayed valid — the very next press of "Sign in"
  // answered 303 to the diary and minted a fresh bearer from the SAME session. On a shared browser
  // that is the next person reading the last person's diary, having supplied no credential.
  //
  // `revokeTokensFor`, not `revokeToken`: the page holds a SECOND credential minted from this same
  // session above, and there is no way for it to hand that one back. "Sign out of this browser"
  // that leaves a live bearer behind is a promise the product does not keep.
  //
  // A POST, like every other write here: a GET that ends a session is a session another site can
  // end with an <img> tag.
  if (req.method === "POST" && pathname === `${START_PREFIX}/session/signout`) {
    await ctx.store.revokeTokensFor(userId);
    const headers = new Headers({ "content-type": "application/json", "cache-control": "no-store" });
    // Cleared on the way out, so the browser stops presenting a token that is already dead.
    headers.append("set-cookie", clearCookie(SESSION_COOKIE, secure));
    return new Response(JSON.stringify({ ok: true }), { headers });
  }

  if (req.method === "POST" && pathname === `${START_PREFIX}/session/token`) {
    // WITH A LIFETIME OF ITS OWN, not the phone's six idle months. This token is re-minted from the
    // cookie on every page load and after any 401, so the long one buys the browser nothing and
    // leaves a working credential behind for every tab anybody ever opened — on the origin that
    // also serves the admin. See `BROWSER_SESSION_TTL_MS`.
    return new Response(JSON.stringify({ token: await ctx.store.issueToken(userId, BROWSER_SESSION_TTL_MS) }), {
      headers: {
        "content-type": "application/json",
        // Not a page, and not something an intermediary may keep.
        "cache-control": "no-store",
      },
    });
  }

  // ── The country, asked AFTER sign-up (S8) ─────────────────────────────────────────────────
  //
  // It tunes the analyzer's cuisine and nothing else, so it is the one answer that was willing to
  // wait: out of the walk entirely, and on a screen of its own once the account has an identity.
  // The browser's languages usually already answer it — the screen is still shown, with that
  // answer preselected, because a person confirming where they live is a better country than a
  // header guessing it.
  if (pathname === `${START_PREFIX}/country`) {
    const { content } = await view();
    const lang = profile.lang;
    // Before the plan exists this screen means nothing; once the answer is stored it never means
    // anything again. Both resume the session where its account actually is — and a session that
    // has not signed up yet goes to the step this one comes after.
    if (profile.onboarded_at === null) return seeOther(`${START_PREFIX}/q`);
    if (await isAnonymous(ctx.deps, userId)) return seeOther(`${START_PREFIX}/signup`);
    if (profile.country !== null) return seeOther(await resumeTo(ctx, userId, profile));
    // `enabled` is still the admin's switch, here as it was in the walk: a screen switched off is
    // a question this deployment does not put to anybody, and the step collapses to the handoff.
    if (disabledScreens(content).includes("country")) {
      return seeOther(ctx.hasWebApp ? "/" : CHAT_PATH);
    }

    // Resolved the way `/start/q` used to resolve it (#365): the browser's regions, then its
    // languages, then the sign-in address — `emailForUser` exists so that a code is the only
    // thing that leaves the server. Here it preselects rather than writes.
    const tags = acceptLanguageTags(req.headers.get("accept-language"));
    const resolved = resolveCountry({
      regions: tags.map(regionOf),
      languages: tags,
      email: await ctx.store.emailForUser(userId),
    });
    const prompt = promptById("country")!;
    const ask = (error: string | null) => html(question({
      promptId: "country",
      kind: "choice",
      lines: askLines(prompt, { content, lang }, profile),
      options: optionsFor(prompt, content, lang, resolved.country),
      placeholder: null,
      error,
      actions: [],
      action: `${START_PREFIX}/country`,
      back: `${START_PREFIX}/signup`,
      ...(resolved.country === null ? {} : { current: [resolved.country] }),
      lang,
    }));

    if (req.method === "GET") return ask(null);
    if (req.method === "POST") {
      const form = await req.formData().catch(() => null);
      const chosen = form?.get("answer");
      // Only what the screen offered — the answer is a country code or `other`, and anything else
      // is the question re-asked rather than a value stored.
      const offeredValues = optionsFor(prompt, content, lang).map((o) => o.value);
      if (typeof chosen !== "string" || !offeredValues.includes(chosen)) {
        return ask(pageCopyFor(lang).answerRequired);
      }
      await patchProfile(ctx.deps, userId, { country: chosen });
      // The stored profile read above still says country=null — the handoff is known without
      // re-reading it: onboarded, signed in, country just written. That is the end of `/start`.
      return seeOther(ctx.hasWebApp ? "/" : CHAT_PATH);
    }
    return notFound();
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
        title: pending.analysis.items.map((i) => i.name).join(", ") || pageCopyFor(profile.lang).chatAMeal,
        kcal: Math.round(pending.analysis.kcal),
        proteinG: Math.round(pending.analysis.protein_g),
      };
      return html(chat({
        lines: entries.map((e) => threadLine(e, profile.lang)),
        notice: noticeText(url.searchParams.get("notice"), profile.lang),
        proposal,
        lang: profile.lang,
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
    // was meant to prevent has already happened. Absent is refused rather than read as zero, the
    // same call the Apple callback above makes and for the same reason (#208): `Number(null)` is 0,
    // so a chunked body was the one shape that walked past this. `too-large` is the notice because
    // it is the only honest one — a length nobody declared cannot be allowed — and inventing a
    // second notice would put a new sentence in front of a user for a request a browser never sends.
    const length = req.headers.get("content-length");
    const declared = length === null ? NaN : Number(length);
    if (!Number.isFinite(declared) || declared > ctx.deps.config.maxUploadBytes) return back("too-large");

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

  // ── Connect Telegram: a code minted at the tap, and the browser sent to the bot with it ─────
  //
  // MINTED HERE, NOT WHEN THE PLAN IS DRAWN. A code lives five minutes (`PAIR_TTL_MS`), and a plan
  // page is read for longer than that; minted at the press, the bot has it within seconds. A POST
  // like every other write on this surface, on the session-minting allowance like the app's own
  // mint route, because the code is redeemable for a session at `/start/pair` too.
  //
  // 404 while the connector is off, like every surface here that is not configured.
  if (req.method === "POST" && pathname === `${START_PREFIX}/telegram`) {
    if (config.telegramBotUsername === "") return notFound();
    const wait = ctx.limitAuth();
    // THE ACCOUNT'S language, not the browser's. The two callers above are pre-session and have
    // only the header; this one is behind the cookie and read `profile` a hundred lines ago, so
    // the argument in `tooManyAttempts` for spending nothing on a request we have decided not to
    // serve does not apply — there is no query to save.
    if (wait !== null) return tooManyAttempts(wait, profile.lang);
    const { code } = await mintPairingCode(ctx.deps, userId);
    return seeOther(`https://t.me/${config.telegramBotUsername}?start=${code}`);
  }

  /**
   * THE LANGUAGE PICKER'S WRITE, and it is not a second endpoint.
   *
   * It calls `patchProfile` — the same engine function `PATCH /v1/profile` calls, with the same
   * validation of `lang` against `LANGS` — and then redirects back to the page, which re-renders in
   * the new language because every renderer reads `profile.lang`. There is one place a language is
   * stored and one place it is validated; this is a form in front of them.
   *
   * A POST, like every other write here: `SameSite=Lax` withholds the cookie from a cross-site POST
   * and that is this surface's CSRF defence. The 303 is what stops a refresh re-sending it.
   *
   * A code outside `LANGS_READY` is REFUSED rather than stored. `patchProfile` accepts anything in
   * `LANGS` — the wider set the model answers in — and that is right for the API, where a phone may
   * legitimately ask for a language the browser pages have no words in. Here the select only offers
   * the ready ones, so anything else is a crafted form post, and honouring it would leave somebody
   * on a page of English with a picker that says otherwise.
   */
  if (req.method === "POST" && pathname === `${START_PREFIX}/language`) {
    const form = await req.formData().catch(() => null);
    const asked = form?.get("lang");
    if (typeof asked !== "string" || !(LANGS_READY as readonly string[]).includes(asked)) {
      return seeOther(`${START_PREFIX}/plan`);
    }
    await patchProfile(ctx.deps, userId, { lang: asked as Lang });
    return seeOther(`${START_PREFIX}/plan`);
  }

  // ── The reveal (W3, `ob-building`) ────────────────────────────────────────────────────────
  //
  // Between the last answer and the plan: the count, the checklist of what was computed, and the
  // one button. The page READS the finished plan — `profileView` ran `explainTargets` already —
  // and shows it ticking in rather than pretending to compute: "the time the computation takes"
  // is one local read, and the strip is honest about that by showing its own rows.
  if (pathname === `${START_PREFIX}/building`) {
    if (req.method !== "GET") return notFound();
    const full = await profileView(ctx.deps, userId);
    if (!full || !full.onboarded) return seeOther(`${START_PREFIX}/q`);
    const content = await onboardingContent(ctx.deps, profile.lang);
    return html(building({
      lines: content.building.lines,
      title: content.building.title,
      cta: content.building.cta,
      rows: planRows(profile, full.targets, content, profile.lang),
      next: `${START_PREFIX}/plan`,
      lang: profile.lang,
    }));
  }

  if (req.method === "GET" && pathname === `${START_PREFIX}/plan`) {
    const full = await profileView(ctx.deps, userId);
    if (!full || !full.onboarded) return seeOther(`${START_PREFIX}/q`);
    // The page's every figure is the engine's: `profileView` already ran `explainTargets`, and the
    // headline is the plan card's own — `planHeadline`, the S6-exempt sentence, which the renderer
    // computes over that same basis rather than retyping a number.
    const content = await onboardingContent(ctx.deps, profile.lang);
    // The walk's dash counts the screens already asked — one segment per prompt before the
    // reveal's own, so the count is the walk's and not a number the page types in. The browser
    // sees no Health prompt and no in-walk country, which is what the filters say.
    const prompts = promptsFor(profile, [...disabledScreens(content), "country"], { health: false });
    const dashOn = Math.max(0, prompts.findIndex((p) => p.id === "building") - 1);
    return html(plan({
      dashOn,
      profile: full.profile,
      targets: full.targets,
      basis: full.basis,
      projection: projectGoal(full.profile, full.basis),
      content,
      next: `${START_PREFIX}/signup`,
      hasWebApp: ctx.hasWebApp,
      lang: profile.lang,
    }));
  }

  // ── The soft offer (#42) — the plan's one ask, with a way past it. ──────────────────────────
  //
  // The × is not decoration: the welcome's promise is "nothing to pay until the plan and the
  // first verdict", and the close is what keeps it — it goes to the web app's first-meal flow,
  // the same app root the plan page already links to. With no checkout configured there is
  // nothing to offer at all, so the route answers as if it were declined: straight there.
  // THE PAID LINKS, one per configured plan (#77). `?plan=` says which — `yearly` is the
  // preselected plan, so a bare link means it — and `exit` is the offer a decline leads to.
  // A plan the operator did not configure is a route that does not exist, the shape the purchase
  // webhook and `/admin` use. The id goes in the URL because RevenueCat's webhook is the only
  // thing that can grant the entitlement and `app_user_id` is how it names the account; it is
  // filled here, from the session, so no page and no client ever carries it. `replaceAll`: a
  // template naming the placeholder twice would otherwise ship the second one literally.
  if (req.method === "GET" && pathname === `${START_PREFIX}/checkout`) {
    const plan = url.searchParams.get("plan");
    const target =
      plan === null ? config.webPaywall.yearlyCheckoutUrl || config.webPaywall.monthlyCheckoutUrl
      : plan === "yearly" ? config.webPaywall.yearlyCheckoutUrl
      : plan === "monthly" ? config.webPaywall.monthlyCheckoutUrl
      : plan === "exit" ? config.webPaywall.exitOfferCheckoutUrl
      : "";
    if (target === "") return notFound();
    return seeOther(target.replaceAll("{userId}", encodeURIComponent(userId)));
  }

  if (req.method === "GET" && pathname === `${START_PREFIX}/offer`) {
    if (profile.onboarded_at === null) return seeOther(`${START_PREFIX}/q`);
    const closeTo = ctx.hasWebApp ? "/" : CHAT_PATH;
    if (config.webPaywall.yearlyCheckoutUrl === "" && config.webPaywall.monthlyCheckoutUrl === "") {
      return seeOther(closeTo);
    }
    return html(offer({
      // `offerHeadline` names the computed target by the computed month — never literals, and
      // never a figure the projection cannot stand behind; it answers null for those, and the
      // page's own fallback title is what is said instead.
      headline: offerHeadline(profile, new Date(), profile.lang)
        ?? pageCopyFor(profile.lang).offerTitleElse,
      checkoutUrl: `${START_PREFIX}/checkout`,
      privacyHref: config.landingUrl === "" ? null : `${config.landingUrl}/privacy`,
      closeHref: closeTo,
      lang: profile.lang,
    }));
  }

  return notFound();
}

/** The words for a code, and nothing at all for a code this page does not know. */
function noticeText(code: string | null, lang: Lang): string | null {
  // `Object.hasOwn` on the CODE, still — the table is built fresh per language now, and building
  // it does not change what the guard is for: `?notice=constructor` on a bare lookup returns a
  // function, survives `?? null`, and throws inside `escape`.
  const table = chatNotice(pageCopyFor(lang));
  return code !== null && Object.hasOwn(table, code) ? table[code]! : null;
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
function threadLine(e: ChatEntry, lang: Lang): ChatLine {
  if (e.role === "user") {
    return e.kind === "photo"
      ? { kind: "user", text: e.text, photo: true }
      : { kind: "user", text: e.text };
  }
  if (e.kind === "text") return { kind: "said", who: null, text: e.text };
  const meal = e.meal;
  if (!meal) return { kind: "card", card: null };
  return {
    kind: "card",
    card: {
      title: meal.items.map((i) => i.name).join(", ") || pageCopyFor(lang).chatAMeal,
      kcal: Math.round(meal.kcal),
      proteinG: Math.round(meal.protein_g),
      verdicts: renderableVerdicts(meal.verdicts).map((d) => verdictPillLabel(d, meal.verdicts[d]!, lang)),
    },
  };
}

/** What an answered question already holds, as the form's `answer` values — age, not the stored year. */
function currentAnswer(prompt: ChatPrompt, p: Profile): string[] {
  if (prompt.field === "birth_year") {
    const age = ageFrom(p.birth_year);
    return age === null ? [] : [String(age)];
  }
  if (prompt.field === "struggles") return p.struggles ?? [];
  // The two write views read back through the shared readers — `medical` ticks "none" for the
  // empty set, and `diet` reads balanced when no diet tag survives.
  if (prompt.field === "diet") return [dietOf(p.restrictions)];
  if (prompt.field === "medical") {
    const tags = medicalOf(p.restrictions);
    return tags.length === 0 ? ["none"] : [...tags];
  }
  const value = prompt.field ? p[prompt.field as keyof Profile] : null;
  return value === null || value === undefined ? [] : [String(value)];
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
  suggested: string | null = null,
  draftKg?: number,
  current?: readonly string[],
  action = `${START_PREFIX}/q`,
): string {
  const prompt = questions[index]!;
  const lang = profile.lang;

  let lines = askLines(prompt, { content, lang }, profile);
  // The target question is the design's stepper when there is a suggestion to start from — with
  // `targetSuggestionLine` AS the ask, because the suggestion spoken and the number shown are the
  // same sentence. At the healthy floor there is nothing to suggest and the plain box stands.
  let stepper: { value: number; min: number; max: number } | null = null;
  if (prompt.id === "target_weight_kg") {
    const suggestedKg = suggestedTargetKg(profile);
    const range = targetRange(profile);
    if (suggestedKg !== null && range !== null && profile.weight_kg !== null
        && (profile.goal === "lose" || profile.goal === "gain")) {
      stepper = { value: draftKg ?? suggestedKg, min: range.min, max: range.max };
      const share = Math.round(Math.abs(suggestedKg - profile.weight_kg) / profile.weight_kg * 100);
      const line = targetSuggestionLine(suggestedKg, share, profile.goal, lang);
      if (line !== null) lines = [line];
    }
  }

  return question({
    promptId: prompt.id,
    kind: prompt.kind === "chips" ? "chips" : prompt.kind === "number" ? "number" : "choice",
    lines,
    options: prompt.kind === "number" ? [] : optionsFor(prompt, content, lang, suggested),
    placeholder: askPlaceholder(prompt, content),
    error,
    actions,
    action,
    stepper,
    step: index + 1,
    total: questions.length,
    back: index > 0 ? `${START_PREFIX}/q?edit=${encodeURIComponent(questions[index - 1]!.id)}` : START_PREFIX,
    ...(current ? { current } : {}),
    lang,
  });
}
