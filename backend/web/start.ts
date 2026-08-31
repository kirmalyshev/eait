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
  RESTRICTION_TAGS, SCREEN_OPTIONS, askLines, askPlaceholder, disabledScreens, isAnswered,
  promptsFor, screenForStep, screenOptions,
  type ChatPrompt, type OnboardingContent, type PatchProfileRequest, type Profile,
} from "@ieat/shared";
import { AuthError, type IdentityVerifier } from "../auth/verify.ts";
import type { GoogleCodeExchange } from "../auth/google-web.ts";
import {
  onboardingContent, patchProfile, profileView, signInWithProvider, type EngineDeps,
} from "../engine/index.ts";
import type { Store } from "../store.ts";
import { frontDoor, html, plan, question, PAGE_COPY, type QuestionOption } from "./page.ts";

export type { GoogleCodeExchange } from "../auth/google-web.ts";

export const START_PREFIX = "/start";
const CALLBACK_PATH = "/start/auth/google/callback";
const AUTHORIZE_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";

/** The session, and the ten minutes of OAuth state that precedes it. */
const SESSION_COOKIE = "eait_web";
const OAUTH_COOKIE = "eait_oauth";
const OAUTH_TTL_S = 600;

export function isStartPath(pathname: string): boolean {
  return pathname === START_PREFIX || pathname.startsWith(`${START_PREFIX}/`);
}

export interface StartContext {
  deps: EngineDeps;
  store: Store;
  verifier: IdentityVerifier;
  exchange: GoogleCodeExchange;
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
}

const notFound = (): Response =>
  new Response(JSON.stringify({ error: "not found" }), {
    status: 404, headers: { "content-type": "application/json" },
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

/** What the app's own composer would send for this question. */
function patchFor(prompt: ChatPrompt, answers: string[]): PatchProfileRequest | null {
  const field = prompt.field!;
  if (field === "restrictions") {
    const tags = answers.filter((a) => (RESTRICTION_TAGS as readonly string[]).includes(a));
    // The last question, so it is also the one that finishes onboarding — the same patch the app's
    // restrictions screen sends. No free-text box here: the app's is unstructured medical prose,
    // and a public web form is not where to start collecting it.
    return { restrictions: tags, complete_onboarding: true };
  }
  const value = answers[0];
  if (value === undefined || value === "") return null;
  if (prompt.kind === "number") {
    const n = Number(value);
    // Refused here rather than sent: `patchProfile` would reject a NaN with `out-of-range`, which
    // is a true answer to the wrong question — the user typed something that is not a number.
    if (!Number.isFinite(n)) return null;
    return { [field]: field === "birth_year" ? Math.trunc(n) : n } as PatchProfileRequest;
  }
  return { [field]: value } as PatchProfileRequest;
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
  if (config.googleWebClientId === "" || config.googleWebClientSecret === "") return notFound();

  const { pathname } = url;
  const secure = ctx.origin.startsWith("https://");
  const cookies = cookieHeader(req);
  const redirectUri = `${ctx.origin}${CALLBACK_PATH}`;

  // ── The front door ────────────────────────────────────────────────────────────────────────
  if (req.method === "GET" && (pathname === START_PREFIX || pathname === `${START_PREFIX}/`)) {
    const content = await onboardingContent(ctx.deps);
    const error = url.searchParams.has("error") ? PAGE_COPY.errorSignIn : null;
    return html(frontDoor(content.welcome.lines, `${START_PREFIX}/auth/google`, error));
  }

  // ── Sign in ───────────────────────────────────────────────────────────────────────────────
  if (req.method === "GET" && pathname === `${START_PREFIX}/auth/google`) {
    const state = randomToken();
    const nonce = randomToken();
    const to = new URL(AUTHORIZE_ENDPOINT);
    to.search = new URLSearchParams({
      client_id: config.googleWebClientId,
      redirect_uri: redirectUri,
      response_type: "code",
      // OPENID AND NOTHING ELSE. `profile` and `email` are what Google's own libraries add by
      // default, and asking for either would put "See your primary email address" on the consent
      // screen of a product whose first promise is that it asks for neither.
      scope: "openid",
      nonce,
      state,
      // The account chooser rather than a silent re-use: several people share a browser, and a
      // sign-up that silently picks the last Google account creates the wrong one's diary.
      prompt: "select_account",
    }).toString();
    return seeOther(to.toString(), [
      setCookie(OAUTH_COOKIE, `${state}.${nonce}`, { secure, maxAge: OAUTH_TTL_S }),
    ]);
  }

  if (req.method === "GET" && pathname === CALLBACK_PATH) {
    const failed = () => seeOther(`${START_PREFIX}?error=1`, [clearCookie(OAUTH_COOKIE, secure)]);
    const [state, nonce] = (cookies[OAUTH_COOKIE] ?? "").split(".");
    const code = url.searchParams.get("code") ?? "";
    // Everything about this comparison is the CSRF defence. An absent cookie fails it too, which is
    // what makes a callback replayed from somewhere else useless.
    if (!state || !nonce || code === "" || url.searchParams.get("state") !== state) return failed();

    // Charged HERE — after the state check, so a scanner cannot spend a shared CGNAT address's
    // allowance with requests that were never going to reach Google, and before the exchange, which
    // is the part that costs a socket and ten seconds. Never before the 404 gate at the top of this
    // function: a 429 from an unconfigured host would say the surface exists.
    const wait = ctx.limitAuth();
    if (wait !== null) {
      return new Response("Too many sign-in attempts from this address. Try again shortly.\n", {
        status: 429,
        headers: { "content-type": "text/plain; charset=utf-8", "retry-after": String(wait) },
      });
    }

    let token: string;
    try {
      const idToken = await ctx.exchange.exchange(code, redirectUri);
      // The SAME verifier the app's route uses. Nothing about this being a browser makes the
      // signature, the issuer, the audience or the nonce optional.
      ({ token } = await signInWithProvider(
        ctx.deps, ctx.verifier, "google", idToken, nonce,
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

    if (req.method === "GET") {
      if (openIndex === -1) return seeOther(`${START_PREFIX}/plan`);
      return html(renderQuestion(questions, openIndex, profile, content, null));
    }

    if (req.method === "POST") {
      if (openIndex === -1) return seeOther(`${START_PREFIX}/plan`);
      const open = questions[openIndex]!;
      const form = await req.formData().catch(() => null);
      // The open question is the server's to decide, so a post naming a different one is dropped
      // rather than applied: the profile is what says where somebody is, on this surface exactly as
      // in the app, and a stale tab must not be able to write an answer to a question already past.
      if (form?.get("prompt") !== open.id) return seeOther(`${START_PREFIX}/q`);

      const answers = form.getAll("answer").filter((v): v is string => typeof v === "string");
      const patch = patchFor(open, answers);
      if (patch === null) {
        return html(renderQuestion(questions, openIndex, profile, content, "That one needs an answer."));
      }
      const outcome = await patchProfile(ctx.deps, userId, patch);
      if (outcome && !outcome.ok) {
        return html(renderQuestion(questions, openIndex, profile, content, refusalText(outcome.rejected)));
      }
      return seeOther(`${START_PREFIX}/q`);
    }
  }

  if (req.method === "GET" && pathname === `${START_PREFIX}/plan`) {
    const full = await profileView(ctx.deps, userId);
    if (!full || !full.onboarded) return seeOther(`${START_PREFIX}/q`);
    return html(plan({
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

function renderQuestion(
  questions: readonly ChatPrompt[],
  index: number,
  profile: Profile,
  content: OnboardingContent,
  error: string | null,
): string {
  const prompt = questions[index]!;
  return question({
    promptId: prompt.id,
    kind: prompt.kind === "chips" ? "chips" : prompt.kind === "number" ? "number" : "choice",
    lines: askLines(prompt, content, profile),
    options: prompt.kind === "number" ? [] : optionsFor(prompt, content),
    placeholder: askPlaceholder(prompt, content),
    error,
    step: index + 1,
    total: questions.length,
  });
}
