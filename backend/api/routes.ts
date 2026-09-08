// HTTP over the engine.
//
// Every handler is the same three steps: authenticate to a userId, call ONE engine function, encode
// the result. There is no product logic here, and a reviewer should be able to confirm that by
// noting this file never imports the store and never touches a meal row directly.
//
// FOUR RULES THIS LAYER ENFORCES:
//  - `userId` NEVER comes from the request body. It is resolved from credentials and passed to the
//    engine as an argument. `focusMealId` and `mealId` may come from the request, and that is safe
//    only because every engine read is user-scoped — asserted by test, not assumed.
//  - Errors are logged, never returned. An error string from deep in the stack can carry a query, a
//    path, or a model's echo of the user's medical free text. The client gets `{"error":"internal"}`.
//  - Uploads stay in memory and are bounded. No disk write, no staging directory.
//  - Refusal→status mapping is imported from the shared contract, so the client's decoder and this
//    encoder cannot drift.

import {
  MAX_CLIENT_ID, MAX_USER_LINE, NDJSON, RATE_LIMITED, REFUSAL_STATUS, ROUTES, isEditMealRequest,
  type AuthDeviceRequest, type AuthDeviceResponse, type AuthProviderRequest,
  type AppendLinesRequest, type AppendLinesResponse, type AuthProviderResponse, type IdentitiesResponse, type Lang,
  type MessageRequest, type OnboardingContentResponse, type OnboardingEventsRequest,
  type OnboardingEventsResponse, type PatchProfileRequest, isRefusal,
  type HealthDaysRequest, type HealthDaysResponse, type HealthResponse, type LivenessResponse,
  HEALTH_RETENTION_DAYS, MAX_HEALTH_DAYS_PER_BATCH, isPushToken, isPushTokenRequest, type PushTokenResponse,
  type PairCodeResponse,
} from "@eait/shared";
import { LANGS } from "@eait/shared";
import { AuthError, type Verifier } from "../auth/verify.ts";
import { isCalendarDate } from "@eait/shared";
import type { Store } from "../store.ts";
import {
  MAX_WINDOW_DAYS, appendLines, cancelPendingMeal, chatHistory, confirmPendingMeal, day, editMeal, handleText,
  healthTrend, identitiesFor, logPhotoMeal, mintPairingCode, onboardingContent, patchProfile, profileView,
  recordHealthDays, recordOnboardingEvents, signInWithProvider, week, type EngineDeps,
  reanalyzeMeal,
} from "../engine/index.ts";
import { confirmSubscription, subscribe, unsubscribe } from "../engine/subscribe.ts";
import { adminRoutes } from "./admin.ts";
import { webProviders, type WebProvider, type WebSignInProvider } from "../auth/web-oauth.ts";
import { isStartPath, startRoutes } from "../web/start.ts";
import { REVENUECAT_WEBHOOK_PATH, createRevenueCatWebhook } from "./revenuecat.ts";
import { APPLE_NOTIFICATIONS_PATH, appleNotifications } from "./apple-notifications.ts";
import { clientAddress, rateLimiter } from "./ratelimit.ts";

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** A refusal, encoded once. `scope` rides along for `cap-exceeded` so the app can word it right. */
function refusal(r: { kind: string; scope?: string }): Response {
  const status = REFUSAL_STATUS[r.kind as keyof typeof REFUSAL_STATUS] ?? 500;
  return json({ error: r.kind, ...(r.scope ? { scope: r.scope } : {}) }, status);
}

/** Narrow a client-supplied locale to a supported language. Unknown falls back to `en`. */
function toLang(locale: string | undefined): Lang {
  const head = (locale ?? "en").slice(0, 2).toLowerCase();
  return (LANGS as readonly string[]).includes(head) ? (head as Lang) : "en";
}

/**
 * Where a browser goes after posting the subscribe form.
 *
 * 303 rather than 302, and it matters: 303 tells the browser to follow with GET. A 302 after a POST
 * is followed with GET by every browser in practice but is specified as "repeat the method", and
 * the observable difference is a page that re-submits the form when somebody reloads it.
 *
 * With no landing URL configured there is nowhere to send anyone, so the route answers with the
 * JSON body instead — which is what a `curl` wants and what a backend deployed without a landing
 * page has to do.
 */
function landingRedirect(landingUrl: string, path: string, body: unknown, status = 200): Response {
  if (landingUrl === "") return json(body, status);
  return new Response(null, { status: 303, headers: { location: `${landingUrl}${path}` } });
}

/**
 * The part of Bun's server this file needs: the socket peer, for a request that arrived without an
 * `X-Forwarded-For`. Declared structurally rather than imported so the router stays constructible
 * in a test with no server at all.
 */
export interface PeerSource {
  requestIP(req: Request): { address: string } | null;
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** What a test replaces. Everything else this router needs, it builds from `deps.config`. */
export interface RouterOptions {
  /**
   * The web onboarding's sign-in providers. See `auth/web-oauth.ts`; a test replaces them so
   * `/start` can be driven end to end without Apple or Google being reachable.
   */
  webProviders?: Partial<Record<WebProvider, WebSignInProvider>>;
  /**
   * How often the streamed photo route writes a blank line while the analyzer is silent. A test
   * shortens it; nothing else sets it. See `STREAM_KEEPALIVE_MS`.
   */
  streamKeepaliveMs?: number;
}

/**
 * THE ANALYZER IS SILENT FOR TENS OF SECONDS, AND AN IDLE SOCKET IS A CLOSED SOCKET. After the
 * glance (~2 s) grok-4.5 reasons for 10–40 s with nothing on the wire; `Bun.serve` closes a
 * connection idle for 10 s by default and iOS gives up on one idle for 60 s. Measured 2026-09-05:
 * the phone reported "the analysis didn't come back" at 12 s while the server, whose `line()`
 * swallows a gone reader, went on to log the meal — a charged turn the user was told failed. A
 * blank line every few seconds is nothing to the client (`splitLines` drops empty lines) and
 * keeps every hop between here and the phone from calling the stream dead.
 */
export const STREAM_KEEPALIVE_MS = 5_000;

const REANALYZE_PATH = /^\/v1\/meals\/([^/]+)\/reanalyze$/;

export function createRouter(
  deps: EngineDeps,
  store: Store,
  verifier: Verifier,
  options: RouterOptions = {},
) {
  const handleRevenueCat = createRevenueCatWebhook();
  const providers = options.webProviders ?? webProviders(deps.config);
  const bearer = (req: Request): string | null => {
    const header = req.headers.get("authorization");
    return header?.startsWith("Bearer ") ? header.slice(7) : null;
  };

  // ── Per-address limits ──────────────────────────────────────────────────────────────────────
  //
  // One limiter per router, so a test gets a clean one and the process gets exactly one.
  //
  // These are NOT the spend caps. `engine/caps.ts` bounds what one ACCOUNT and what the INSTANCE
  // may spend, and both were correct while being trivially bypassable: `POST /v1/auth/device`
  // mints an account for anybody, so resetting a per-user allowance cost one HTTP call, and the
  // only real bound left was the instance budget — which an attacker exhausts on purpose, spending
  // the money and refusing every real user for the rest of the day. A per-address limit on the
  // billed routes is what makes the per-account one mean something.
  const limiter = rateLimiter();

  /** Zero means the limit is off — an escape hatch that has to be explicit rather than implied. */
  const limit = (
    req: Request,
    peer: PeerSource | undefined,
    bucket: string,
    perWindow: number,
    windowMs: number,
  ): number | null => {
    if (perWindow <= 0) return null;
    const address = clientAddress(req, peer?.requestIP(req)?.address);
    // The bucket is part of the key, so an hour of sign-ins and a day of analyses are counted
    // separately for the same address rather than sharing one allowance.
    return limiter.check(`${bucket}:${address}`, { limit: perWindow, windowMs });
  };

  const tooManyRequests = (retryAfter: number, body: Record<string, unknown>): Response =>
    new Response(JSON.stringify(body), {
      status: 429,
      headers: { "content-type": "application/json", "retry-after": String(retryAfter) },
    });

  /**
   * This server's public origin, for the confirmation link.
   *
   * `publicApiUrl` when it is set, because a link built from a request header is a link whose
   * hostname a client can influence — and this one goes into an email. Falling back to the request
   * is what keeps development, where nobody sets it, from needing a second variable: Caddy forwards
   * the original Host, and `X-Forwarded-Proto` is how the https gets back on a request that reached
   * this process over plain HTTP on the internal network.
   */
  const publicOrigin = (req: Request): string => {
    if (deps.config.publicApiUrl) return deps.config.publicApiUrl;
    const here = new URL(req.url);
    const proto = req.headers.get("x-forwarded-proto") ?? here.protocol.replace(":", "");
    return `${proto}://${here.host}`;
  };

  const subscribeDeps = (req: Request) => ({
    store,
    mailer: deps.mailer,
    config: deps.config,
    confirmUrlBase: publicOrigin(req),
  });

  /** The ONLY path from a request to a userId. */
  async function resolveUserId(req: Request): Promise<string | null> {
    const token = bearer(req);
    return token === null ? null : store.userIdForToken(token);
  }

  return async function handle(req: Request, peer?: PeerSource): Promise<Response> {
    const url = new URL(req.url);
    const { pathname } = url;

    // Unauthenticated, deliberately: a liveness probe that requires a session cannot tell a dead
    // process from an expired token.
    //
    // `demo` IS FOR THE SCREENSHOT WALK, and it is the only thing outside this process that can
    // tell the two analyzers apart before a frame is taken. The canned one writes "Demo analyzer —
    // these numbers are canned" INTO the meal card, so a store screenshot shot against it carries
    // that sentence in the picture, where no test and no claims gate can read it — which is #66,
    // and which sat on the App Store listing for a fortnight. `scripts/screenshots.sh` reads this
    // and refuses to take the analyzer frames when it is true. A boolean rather than the provider
    // name: which vendor answers is nobody's business on an unauthenticated probe, and canned-or-
    // not is the whole of what a caller can act on.
    //
    // READ OFF THE PORTS, NOT OFF THE CONFIG. `config.llmProvider` is written by `demoConfig()` and
    // by `EAIT__BACKEND__LLM_PROVIDER`, and read by nothing: `index.ts` chooses the ports from
    // `process.argv` alone. Setting that variable would have made this answer `demo:true` while the
    // real, billed analyzer served every request — and the walk would then refuse frames it could
    // have taken honestly. `llm.canned` is set by `demoPorts()` and cannot disagree with itself.
    if (pathname === ROUTES.health) return json({ ok: true, demo: deps.llm.canned === true } satisfies LivenessResponse);

    try {
      // The admin, on its OWN credential.
      //
      // Handled before `resolveUserId` and never reachable with a user's bearer token — the two
      // are separate authorities, and an admin surface that accepts an ordinary session token is
      // an admin surface every user has. Off entirely unless `EAIT__BACKEND__ADMIN_TOKEN` is set.
      if (pathname === "/admin" || pathname.startsWith("/admin/")) {
        return await adminRoutes(req, url, deps);
      }

      // Onboarding in a browser, on ITS OWN session cookie and before any user is resolved.
      //
      // The cookie is read inside that module and nowhere else, which is the point: `resolveUserId`
      // below stays bearer-only, because an API that accepts a cookie is an API another origin can
      // post to on a signed-in browser. Off entirely unless at least one web provider is
      // configured — Apple, Google, or both.
      if (isStartPath(pathname)) {
        return await startRoutes(req, url, {
          deps, store, verifier, providers, origin: publicOrigin(req),
          // The SAME per-address allowance the three sign-in routes below take, handed in rather
          // than taken here: that module spends it on its OAuth callback only, and only after the
          // gate that makes an unconfigured host answer 404 on every path under `/start`.
          limitAuth: () => limit(req, peer, "auth", deps.config.authRateLimitPerHour, HOUR),
          // And the BILLED allowance, for the chat turns that surface takes. The same bucket the
          // message and photo routes below take, so a browser and a phone on one address share it.
          limitAnalysis: () => limit(req, peer, "analysis", deps.config.analysisRateLimitPerDay, DAY),
        });
      }

      // The purchase webhook, on ITS OWN credential and before any user is resolved.
      //
      // Same authority argument as the admin above: RevenueCat is a third party reporting what the
      // App Store told it, not a signed-in user, and the two must not be confusable. Unset token =
      // the path answers 404 and no account can ever become paid.
      if (pathname === REVENUECAT_WEBHOOK_PATH) {
        return await handleRevenueCat(req, deps);
      }

      // Apple's server-to-server notifications, on the SIGNATURE as their credential and before
      // any user is resolved.
      //
      // Same authority argument again: Apple is reporting that a person withdrew consent, not
      // asking as one of our users, and a bearer token buys nothing here. Off entirely unless
      // `EAIT__BACKEND__APPLE_AUDIENCES` is set — with no audience there is nothing to verify a
      // token against, and verifying without one would accept any Apple developer's notifications.
      if (pathname === APPLE_NOTIFICATIONS_PATH) {
        return await appleNotifications(req, deps, verifier);
      }

      // ── The mailing list ──────────────────────────────────────────────────────────────────
      //
      // Unauthenticated, and handled before `resolveUserId` for the same reason the admin is: a
      // subscriber is not a user, has no token, and must never need one — the whole point of the
      // list is the people who have not signed up for anything yet.
      //
      // FORM-ENCODED, not JSON. The page that posts here carries no JavaScript at all, so a plain
      // <form> is the only submit available, and a browser navigates to whatever comes back. Hence
      // the redirects: a person who subscribed should land on a page that says so, on the site they
      // were reading, not on a JSON body at an api. hostname.
      if (req.method === "POST" && pathname === ROUTES.subscribe) {
        // Refused BEFORE the body is read. The honeypot catches a bot that fills every field and
        // `subscribeDailyCap` bounds the list as a whole; this bounds one address, which is what
        // stops a single script spending the day's cap in a minute and leaving every real visitor
        // told they subscribed when they did not.
        const wait = limit(req, peer, "subscribe", deps.config.subscribeRateLimitPerHour, HOUR);
        if (wait !== null) {
          return landingRedirect(deps.config.landingUrl, "/try-later",
            { error: "too many attempts from this address — try again shortly" }, 429);
        }

        const form = await req.formData().catch(() => null);
        const field = (name: string) => {
          const v = form?.get(name);
          return typeof v === "string" ? v : "";
        };
        const result = await subscribe(
          subscribeDeps(req),
          { email: field("email"), honeypot: field("company"), source: field("source") || "web" },
        );
        // ── Where each outcome goes, and why it is not two branches ─────────────────────────
        //
        // A HONEYPOT hit is answered exactly like a success. That is the one case where lying is
        // correct: a bot that can tell the two apart learns which field to leave alone.
        //
        // Everything else must tell the truth, and this used to be a single boolean that did not.
        // Only `invalid` was routed anywhere but `/subscribed`, so a submission refused by the
        // daily cap landed on a page saying "you are on the list" while the address was dropped —
        // and since the cap is global and was reachable by anybody in about a minute, a script
        // could turn every real visitor for the rest of the day into a silent loss.
        //
        // `capped` is logged rather than merely redirected: it is the only one of these the
        // operator can do something about, and it is invisible from the outside by design.
        if (!result.ok && result.reason === "capped") {
          console.warn("[eait] subscribe refused: the daily list cap is spent");
        }
        //
        // The success page is CHECK-YOUR-EMAIL, not "you are on the list". A pending row is not a
        // subscription, and a page that says it is would be the same lie in a nicer font.
        //
        // `send-failed` shares `/try-later` with `capped`, because from the reader's side they are
        // the same event: nothing was saved and it was not their fault. The pending row is left to
        // be swept.
        if (!result.ok && result.reason === "capped") {
          console.warn("[eait] subscribe refused: the daily list cap is spent");
        }
        const path = !result.ok
          ? (result.reason === "invalid" ? "/not-subscribed"
            : result.reason === "capped" || result.reason === "send-failed" ? "/try-later"
            : "/check-your-email")   // honeypot — indistinguishable from success, deliberately
          : "/check-your-email";
        const body = !result.ok && result.reason === "invalid"
          ? { error: "that does not look like an email address" }
          : !result.ok && result.reason === "capped"
            ? { error: "the list is not taking more addresses today — try again shortly" }
            : !result.ok && result.reason === "send-failed"
              ? { error: "the confirmation could not be sent — try again shortly" }
              : { ok: true };
        // 429 for the cap (come back later, it is a rate) and 502 for a failed send (the provider
        // did not answer, which is not the caller's rate and not their fault). Both land on the same
        // page; only a JSON caller can tell them apart, and a JSON caller is the one that should.
        const status = !result.ok
          ? (result.reason === "capped" ? 429 : result.reason === "send-failed" ? 502 : 200)
          : 200;
        return landingRedirect(deps.config.landingUrl, path, body, status);
      }

      // The other half of double opt-in. A GET, because it is a link in an email and a link in an
      // email is a GET — and it is safe to be one because the token grants exactly "put this one
      // address on the list" and nothing else. A mail client that prefetches it confirms an address
      // its owner asked to confirm, which is the outcome either way.
      if (req.method === "GET" && pathname === ROUTES.subscribeConfirm) {
        await confirmSubscription(subscribeDeps(req), url.searchParams.get("t") ?? "");
        // The same page for a known token and an unknown one. Anything else is an oracle for which
        // confirmation links are live, and it would mean somebody clicking twice gets an error.
        return landingRedirect(deps.config.landingUrl, "/subscribed", { ok: true });
      }

      if (req.method === "GET" && pathname === ROUTES.unsubscribe) {
        await unsubscribe(subscribeDeps(req), url.searchParams.get("t") ?? "");
        return landingRedirect(deps.config.landingUrl, "/unsubscribed", { ok: true });
      }

      // ── The routes that mint a session ────────────────────────────────────────────────────
      //
      // All three are unauthenticated by necessity — this is where a token comes from — and all
      // three are therefore rate-limited by address before anything else happens. Device auth is
      // the one that matters: it creates an ACCOUNT, so without a limit here the per-user analysis
      // allowance is worth exactly one extra HTTP call to reset, and the users table grows as fast
      // as somebody cares to loop.
      if (req.method === "POST"
        && (pathname === ROUTES.authDevice || pathname === ROUTES.authApple
          || pathname === ROUTES.authGoogle)) {
        const wait = limit(req, peer, "auth", deps.config.authRateLimitPerHour, HOUR);
        if (wait !== null) {
          // A distinct error from `cap-exceeded`: nothing has been spent, and the app words the two
          // differently — one is "your day is used up", this one is "slow down".
          return tooManyRequests(wait, { error: RATE_LIMITED });
        }
      }

      if (req.method === "POST" && pathname === ROUTES.authDevice) {
        const body = await req.json() as AuthDeviceRequest;
        // Length is a real check, not decoration: a short device id is guessable, and guessing one
        // is impersonating its owner.
        if (typeof body.deviceId !== "string" || body.deviceId.length < 32) {
          return json({ error: "deviceId must be at least 32 characters" }, 400);
        }
        const { userId, created } = await store.upsertDeviceUser(body.deviceId, toLang(body.locale));
        const token = await store.issueToken(userId);
        return json({ token, userId, created } satisfies AuthDeviceResponse);
      }

      // Sign in with Apple / Google.
      //
      // OPTIONALLY authenticated, and that is the whole feature: a bearer token here means "link
      // this identity to the account I am already using" rather than "create a new one", which is
      // what lets someone try the app anonymously and keep the meals they logged.
      if (req.method === "POST" && (pathname === ROUTES.authApple || pathname === ROUTES.authGoogle)) {
        const provider = pathname === ROUTES.authApple ? "apple" : "google";
        const body = await req.json() as AuthProviderRequest;
        if (typeof body.idToken !== "string" || !body.idToken) {
          return json({ error: "idToken required" }, 400);
        }
        const current = await resolveUserId(req);
        try {
          const result = await signInWithProvider(
            deps, verifier, provider, body.idToken,
            typeof body.nonce === "string" ? body.nonce : undefined,
            current,
          );
          return json(result satisfies AuthProviderResponse);
        } catch (e) {
          if (e instanceof AuthError) {
            // The reason is logged, never returned — it can quote the token.
            console.error(`[eait] ${provider} sign-in rejected: ${e.reason}`);
            return json({ error: "sign-in-failed" }, 401);
          }
          throw e;
        }
      }

      const userId = await resolveUserId(req);
      if (userId === null) return json({ error: "unauthenticated" }, 401);

      // ── The billed routes, bounded by ADDRESS as well as by account ───────────────────────
      //
      // Checked here, after authentication and before any handler, because it applies to every
      // route that calls the model and none of them should be able to forget it.
      //
      // This is the cap that closes the bypass. A per-account allowance is only a limit while
      // accounts are scarce, and they are not: the route above hands one to anybody. Counting per
      // address instead means minting a hundred accounts buys nothing.
      //
      // Reported as `cap-exceeded` with `scope: "address"` rather than as a bare 429, so it travels
      // the refusal path the app already renders — and is worded as what it is. Saying "your daily
      // allowance is spent" to somebody on a carrier network who has logged one meal would be a lie.
      if (req.method === "POST" && (pathname === ROUTES.photo || pathname === ROUTES.messages || REANALYZE_PATH.test(pathname))) {
        const wait = limit(req, peer, "analysis", deps.config.analysisRateLimitPerDay, DAY);
        if (wait !== null) {
          return tooManyRequests(wait, { error: "cap-exceeded", scope: "address" });
        }
      }

      // Sign OUT — drops this token only. Not account deletion; the data is untouched, and every
      // other device stays signed in.
      if (req.method === "POST" && pathname === ROUTES.authSignOut) {
        const token = bearer(req);
        if (token) await store.revokeToken(token);
        return json({ signedOut: true });
      }

      if (req.method === "GET" && pathname === ROUTES.identities) {
        return json({ identities: await identitiesFor(deps, userId) } satisfies IdentitiesResponse);
      }

      // Pair a browser with THIS account. Issue #209.
      //
      // Under the bearer like every route below it, and the body is not read at all: the account
      // this mints for is the one `resolveUserId` returned, and a request naming somebody else
      // names nothing. There is a test with a crafted body that says so.
      //
      // ON THE SESSION-MINTING ALLOWANCE, not the billed one. What comes out of here is redeemable
      // for a session, so it belongs in the same bucket as the three routes that mint one directly
      // — and this is the only one of the four that is reached with a credential already in hand,
      // which is why the check is here rather than in the block above.
      if (req.method === "POST" && pathname === ROUTES.authPair) {
        const wait = limit(req, peer, "auth", deps.config.authRateLimitPerHour, HOUR);
        if (wait !== null) return tooManyRequests(wait, { error: RATE_LIMITED });
        return json(await mintPairingCode(deps, userId) satisfies PairCodeResponse);
      }

      // ── Profile ───────────────────────────────────────────────────────────────────────────
      if (pathname === ROUTES.profile) {
        if (req.method === "GET") {
          const view = await profileView(deps, userId);
          return view ? json(view) : json({ error: "not-onboarded" }, 403);
        }
        if (req.method === "PATCH") {
          const body = await req.json() as PatchProfileRequest;
          const out = await patchProfile(deps, userId, body);
          if (out === null) return json({ error: "not-onboarded" }, 403);
          // 422, and the app re-asks the question. A rejected target weight is the anorexia guard;
          // it must not be expressible as a warning the user can dismiss.
          return out.ok ? json(out.view) : json(out.rejected, 422);
        }
      }

      // ── Onboarding ────────────────────────────────────────────────────────────────────────
      if (req.method === "GET" && pathname === ROUTES.onboarding) {
        return json({ content: await onboardingContent(deps) } satisfies OnboardingContentResponse);
      }

      // Funnel events. Authenticated, because they are stored against the caller's account and
      // erased with it — but deliberately forgiving about their contents: the engine drops what it
      // does not recognise rather than 400ing, since a rejected batch means an app that retries
      // forever and a funnel that is missing exactly the users on bad connections.
      if (req.method === "POST" && pathname === ROUTES.onboardingEvents) {
        const body = await req.json() as OnboardingEventsRequest;
        const accepted = await recordOnboardingEvents(deps, userId, body?.events);
        return json({ accepted } satisfies OnboardingEventsResponse);
      }

      // ── Photo ─────────────────────────────────────────────────────────────────────────────
      if (req.method === "POST" && pathname === ROUTES.photo) {
        // Checked BEFORE parsing. `req.formData()` buffers the whole body into memory, so a size
        // check after it has run protects nothing — the allocation it was meant to prevent has
        // already happened. `maxRequestBodySize` on the server is the real backstop (a client can
        // lie about Content-Length); this is the early, cheap, honest-client rejection.
        //
        // ABSENT IS REFUSED, NOT READ AS ZERO. `Number(null)` is 0, so a `Transfer-Encoding:
        // chunked` body with no length passed this guard and went straight into `formData()` —
        // exactly the buffering above (#208). The same call `web/start.ts` already makes on the
        // Apple callback, and 411 rather than 413 because the size is unknown rather than known
        // to be too big: a 413 in a log would read as a user's photo being oversized.
        const length = req.headers.get("content-length");
        const declared = length === null ? NaN : Number(length);
        if (!Number.isFinite(declared)) return json({ error: "length required" }, 411);
        if (declared > deps.config.maxUploadBytes) return json({ error: "too large" }, 413);

        const form = await req.formData();
        // flatMap rather than a filter predicate: it narrows the element type without asserting
        // one, so a string-valued "photo" field is simply dropped as the malformed input it is.
        const files = form.getAll("photo").flatMap((f) => (typeof f === "string" ? [] : [f]));
        if (files.length === 0) return json({ error: "no photo" }, 400);
        if (files.length > deps.config.maxPhotosPerMeal) return json({ error: "too many photos" }, 400);
        const uploadBytes = files.reduce((n, f) => n + f.size, 0);
        if (uploadBytes > deps.config.maxUploadBytes) return json({ error: "too large" }, 413);
        console.log(`[eait] photo upload: ${files.length} file(s), ${uploadBytes} B`);
        const caption = form.get("caption");
        // A caption is a line in the thread; the shared cap the app applies is enforced here.
        if (typeof caption === "string" && caption.length > MAX_USER_LINE) return json({ error: "caption too long" }, 400);

        const input = {
          // Several files are ANGLES OF ONE MEAL, not several meals. Thunks, so nothing is read
          // until the engine has passed the caps.
          images: files.map((f) => async () => new Uint8Array(await f.arrayBuffer())),
          ...(typeof caption === "string" && caption ? { caption } : {}),
        };
        // THE STREAM. One JSON object per line — the glance, each item as the analyzer closes it
        // — and the result LAST, refusals included, because the 200 has gone out with the first
        // byte. Everything refused above this point is still an HTTP status: nothing has been
        // written yet. Without the header this is the JSON route it always was.
        if ((req.headers.get("accept") ?? "").includes(NDJSON)) {
          const encoder = new TextEncoder();
          const keepaliveMs = options.streamKeepaliveMs ?? STREAM_KEEPALIVE_MS;
          const body = new ReadableStream<Uint8Array>({
            async start(ctrl) {
              // THE READER CAN BE GONE BEFORE THE TURN IS — the phone timed out or lost the
              // network — and Bun then throws on every enqueue. A throw here would surface inside
              // the analyzer's delta loop and abandon a call already charged, so a line nobody can
              // read is dropped and the turn finishes for the diary regardless: leaving the screen
              // mid-stream logs the meal, as it did before the route streamed.
              const line = (e: unknown) => {
                try { ctrl.enqueue(encoder.encode(JSON.stringify(e) + "\n")); } catch { /* reader gone */ }
              };
              const keepalive = setInterval(() => {
                try { ctrl.enqueue(encoder.encode("\n")); } catch { /* reader gone */ }
              }, keepaliveMs);
              try {
                line(await logPhotoMeal(deps, userId, input, line));
              } catch (e) {
                // The JSON path's 500, in-band: logged, never worded to the client.
                console.error(`[eait] api ${req.method} ${pathname} failed mid-stream: ${(e as Error)?.message ?? e}`);
                line({ kind: "analysis-failed" });
              } finally {
                clearInterval(keepalive);
                try { ctrl.close(); } catch { /* the reader's cancel closed it first */ }
              }
            },
          });
          return new Response(body, { status: 200, headers: { "content-type": NDJSON, "cache-control": "no-store" } });
        }
        const result = await logPhotoMeal(deps, userId, input);
        return isRefusal(result) ? refusal(result) : json(result);
      }

      // ── Push tokens ───────────────────────────────────────────────────────────────────────
      //
      // No engine call, deliberately: this is the same shape as sign-out and account deletion —
      // credentials in, one store write, no product decision. Putting it behind an engine function
      // would be a function that forwards its arguments.
      //
      // The register is idempotent because the app re-registers on every launch: a token changes on
      // reinstall, on a restore from backup, and whenever Apple reissues one.
      if (pathname === ROUTES.pushToken && (req.method === "POST" || req.method === "DELETE")) {
        // Unbilled and unmetered otherwise, so the same per-address bound the other unbilled writes
        // take — its own counter at the `/lines` allowance, exactly as the meal editor has. An
        // account-scoped bound would be worth nothing: `POST /v1/auth/device` mints an account for
        // anybody with a 32-character string. And `isPushToken` checks a SHAPE, so a caller can
        // invent as many valid-looking tokens as it likes, each one a row that lives until the
        // account is deleted.
        const wait = limit(req, peer, "push-token", deps.config.linesRateLimitPerHour, HOUR);
        if (wait !== null) return tooManyRequests(wait, { error: RATE_LIMITED });
        const body = await req.json().catch(() => null);
        if (req.method === "POST") {
          if (!isPushTokenRequest(body)) return json({ error: "push token required" }, 400);
          await store.putPushToken(userId, body.token, body.platform);
          return json({ registered: true } satisfies PushTokenResponse);
        }
        const token = (body as { token?: unknown } | null)?.token;
        if (!isPushToken(token)) return json({ error: "push token required" }, 400);
        // The answer is the STATE, not whether this call changed it. Turning notifications off on a
        // device whose token has already moved to another account must still read as "off here".
        await store.dropPushToken(userId, token);
        return json({ registered: false } satisfies PushTokenResponse);
      }

      // ── Chat ──────────────────────────────────────────────────────────────────────────────
      if (req.method === "GET" && pathname === ROUTES.messages) {
        const before = Number(url.searchParams.get("before"));
        const pageLimit = Number(url.searchParams.get("limit"));
        return json(await chatHistory(deps, userId, {
          before: Number.isInteger(before) && before > 0 ? before : null,
          ...(Number.isInteger(pageLimit) && pageLimit > 0 ? { limit: pageLimit } : {}),
        }));
      }
      // The app's own lines: the user's words and Spud's scripted lines by id. All-or-nothing, and
      // a rejected batch is a 400 rather than a partial thread.
      if (req.method === "POST" && pathname === ROUTES.messagesLines) {
        // Unbilled, so no cap reaches it; per address, like the health sync, and BEFORE the body.
        const wait = limit(req, peer, "lines", deps.config.linesRateLimitPerHour, HOUR);
        if (wait !== null) return tooManyRequests(wait, { error: RATE_LIMITED });
        const body = await req.json() as AppendLinesRequest;
        if (!Array.isArray(body?.lines)) return json({ error: "lines required" }, 400);
        const out = await appendLines(deps, userId, body.lines);
        if (body.lines.length > 0 && out.appended === 0) return json({ error: out.reason ?? "bad-line" }, 400);
        return json(out satisfies AppendLinesResponse);
      }
      if (req.method === "POST" && pathname === ROUTES.messages) {
        const body = await req.json() as MessageRequest;
        if (typeof body.text !== "string" || !body.text.trim()) {
          return json({ error: "text required" }, 400);
        }
        // A turn is a line in the thread; the shared cap the composer applies is enforced here.
        if (body.text.length > MAX_USER_LINE) return json({ error: "text too long" }, 400);
        const result = await handleText(deps, userId, {
          text: body.text,
          ...(typeof body.focusMealId === "string" ? { focusMealId: body.focusMealId } : {}),
          // Stored, never interpreted; an over-long one is dropped rather than refused.
          ...(typeof body.clientId === "string" && body.clientId.length <= MAX_CLIENT_ID ? { clientId: body.clientId } : {}),
        });
        if (result.kind === "target-gone") return json({ error: "target-gone", on: result.on }, 409);
        return isRefusal(result) ? refusal(result) : json(result);
      }

      // ── Manual edit ───────────────────────────────────────────────────────────────────────
      const photoMatch = /^\/v1\/meals\/([^/]+)\/photos\/(\d{1,2})$/.exec(pathname);
      if (req.method === "GET" && photoMatch) {
        const p = await deps.store.getPhoto(userId, decodeURIComponent(photoMatch[1]!), Number(photoMatch[2]));
        if (!p) return json({ error: "not found" }, 404);
        return new Response(p.bytes, {
          headers: {
            "content-type": p.mime,
            "content-length": String(p.bytes.byteLength),
            "cache-control": "private, max-age=31536000, immutable",
          },
        });
      }

      const reanalyzeMatch = REANALYZE_PATH.exec(pathname);
      if (req.method === "POST" && reanalyzeMatch) {
        const result = await reanalyzeMeal(deps, userId, decodeURIComponent(reanalyzeMatch[1]!));
        if (result.kind === "target-gone") return json({ error: "target-gone", on: result.on }, 409);
        return isRefusal(result) ? refusal(result) : json(result);
      }

      const mealMatch = /^\/v1\/meals\/([^/]+)$/.exec(pathname);
      if (req.method === "PATCH" && mealMatch) {
        // Unbilled and behind no cap, but it writes the thread: per address, the same allowance as
        // `/lines` but its own counter, so an onboarding's burst of lines cannot spend the editor's.
        const wait = limit(req, peer, "meal-edit", deps.config.linesRateLimitPerHour, HOUR);
        if (wait !== null) return tooManyRequests(wait, { error: RATE_LIMITED });
        const body: unknown = await req.json();
        if (!isEditMealRequest(body)) return json({ error: "bad-edit" }, 400);
        const result = await editMeal(deps, userId, decodeURIComponent(mealMatch[1]!), body);
        return result.kind === "target-gone"
          ? json({ error: "target-gone", on: result.on }, 409)
          : json(result);
      }

      // ── Pending text meals ────────────────────────────────────────────────────────────────
      const pending = /^\/v1\/meals\/pending\/([^/]+)\/(confirm|cancel)$/.exec(pathname);
      if (req.method === "POST" && pending) {
        const id = decodeURIComponent(pending[1]!);
        if (pending[2] === "cancel") {
          const res = await cancelPendingMeal(deps, userId, id);
          return res.kind === "expired" ? json({ error: "expired" }, 410) : json(res);
        }
        const res = await confirmPendingMeal(deps, userId, id);
        if (res.kind === "expired") return json({ error: "expired" }, 410);
        return isRefusal(res) ? refusal(res) : json(res);
      }

      // ── Diary ─────────────────────────────────────────────────────────────────────────────
      if (req.method === "GET" && pathname === ROUTES.day) {
        // Validated rather than passed through: an unparseable date matches no rows, so the client
        // would get a cheerful empty day for what is actually a typo, and never learn otherwise.
        const date = url.searchParams.get("date");
        if (date !== null && !isCalendarDate(date)) {
          return json({ error: "date must be YYYY-MM-DD" }, 400);
        }
        const view = await day(deps, userId, date ?? undefined);
        return view ? json(view) : json({ error: "not-onboarded" }, 403);
      }

      if (req.method === "GET" && pathname === ROUTES.week) {
        const days = Number(url.searchParams.get("days") ?? 7);
        if (!Number.isInteger(days) || days < 1 || days > MAX_WINDOW_DAYS) {
          return json({ error: `days must be an integer in [1, ${MAX_WINDOW_DAYS}]` }, 400);
        }
        const totals = await week(deps, userId, days);
        return totals ? json({ days: totals }) : json({ error: "not-onboarded" }, 403);
      }

      // ── Health ────────────────────────────────────────────────────────────────────────────
      //
      // DAILY AGGREGATES, never raw samples. The phone reduces its health store to a handful of
      // numbers per day before sending anything, so what arrives here is what this product uses
      // rather than a per-second series it has no use for. The engine validates every value again:
      // the client aggregating is a convenience, not a reason to trust the result.
      if (req.method === "POST" && pathname === ROUTES.healthDays) {
        // The heaviest write here: up to `MAX_HEALTH_DAYS_PER_BATCH` upserts in one transaction.
        // No model is called, so none of the billed caps cover it — and an account-scoped bound
        // would be worth nothing anyway, because `POST /v1/auth/device` mints a fresh account for
        // anybody with a 32-character string. Per address, like the other three.
        const wait = limit(req, peer, "health", deps.config.healthSyncRateLimitPerHour, HOUR);
        if (wait !== null) {
          // `rate-limited`, the same code the other per-address limiter uses, and NOT a sentence.
          // The client switches on this string (`ApiError.isRefusal`) to tell a refusal the server
          // meant from a request that never arrived; an unrecognised code is shown to the user as
          // "couldn't reach eait". Not `cap-exceeded` either: nothing has been spent here.
          return tooManyRequests(wait, { error: RATE_LIMITED });
        }

        const body = await req.json() as HealthDaysRequest;
        const days = Array.isArray(body?.days) ? body.days : [];
        if (days.length > MAX_HEALTH_DAYS_PER_BATCH) {
          return json({ error: `at most ${MAX_HEALTH_DAYS_PER_BATCH} days per request` }, 400);
        }
        const out = await recordHealthDays(deps, userId, days, body?.weightMeasuredAt);
        return out ? json(out satisfies HealthDaysResponse) : json({ error: "not-onboarded" }, 403);
      }

      if (req.method === "GET" && pathname === ROUTES.healthTrend) {
        const days = Number(url.searchParams.get("days") ?? 30);
        if (!Number.isInteger(days) || days < 1 || days > HEALTH_RETENTION_DAYS) {
          return json({ error: `days must be an integer in [1, ${HEALTH_RETENTION_DAYS}]` }, 400);
        }
        const out = await healthTrend(deps, userId, days);
        return out ? json(out satisfies HealthResponse) : json({ error: "not-onboarded" }, 403);
      }

      // ── Erasure ───────────────────────────────────────────────────────────────────────────
      if (req.method === "DELETE" && pathname === ROUTES.account) {
        // Real deletion, not a flag. Health-related restrictions are special-category data and the
        // basis for holding them is consent, which has to be withdrawable in fact and not in prose.
        await store.deleteUser(userId);
        return json({ deleted: true });
      }

      return json({ error: "not found" }, 404);
    } catch (e) {
      console.error(`[eait] api ${req.method} ${pathname} failed: ${(e as Error)?.message ?? e}`);
      return json({ error: "internal" }, 500);
    }
  };
}
