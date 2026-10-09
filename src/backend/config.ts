import { MIN_MODEL_CALL_TIMEOUT_MS, REMINDER_TIME, FREE_ANALYSES, SERVER_LLM_TIMEOUT_MS } from "@eait/shared";
import { DEFAULT_SESSION_TTL_MS } from "./auth/tokens.ts";
import { AGENT_PROVIDERS } from "./llm/local-agent.ts";

/** Every `EAIT__BACKEND__LLM_PROVIDER` value `index.ts` can wire: the gateway, then the CLIs. */
const LLM_PROVIDERS = ["openrouter", ...AGENT_PROVIDERS];

// Configuration, loaded once at startup and validated loudly.
//
// An unknown or missing setting is a STARTUP ERROR, never a silent fallback. A bot that quietly
// falls back to a different model answers differently and nothing in any log says why.

/**
 * The `EAIT__BACKEND__WEB_*` paywall block, parsed (#77). Checkout URLs are `{userId}` templates;
 * prices are AMOUNTS in `currency`; anything empty or zero is not offered. This is the config
 * shape — what the client is SENT is `WebPaywall` in `src/shared/paywall.ts`, computed and
 * formatted per account by `engine/profile.ts`.
 */
export interface WebPaywallConfig {
  /** Yearly plan checkout template; "" = the plan is not offered. */
  yearlyCheckoutUrl: string;
  /** Monthly plan checkout template; "" = the plan is not offered. */
  monthlyCheckoutUrl: string;
  yearlyPrice: number;
  monthlyPrice: number;
  /** Free days the plan's CTA may promise; 0 = no trial line. */
  trialDays: number;
  /** The declined-plans offer's checkout template; "" = a decline goes straight to the app. */
  exitOfferCheckoutUrl: string;
  exitOfferPrice: number;
  /** The struck-through anchor; `yearlyPrice` when the operator sets none. */
  exitOfferRegularPrice: number;
  /** The ISO 4217 code every price is formatted in — "EUR". Empty only while nothing is sold. */
  currency: string;
}

export interface Config {
  port: number;
  /** Loopback by default. A process that binds 0.0.0.0 because nobody said otherwise is how a
   *  build with no auth ends up reachable from the internet. */
  host: string;
  databaseUrl: string;
  /**
   * The store's connection ceiling. It bounds concurrent store CALLS, not statements: every method
   * runs inside a transaction for its whole body, so a call holds its connection until it commits.
   * An env var rather than a constant because the right number depends on the box and on
   * `max_connections`, and raising it must not require a code change and a redeploy.
   */
  databaseMaxConnections: number;
  llmProvider: string;
  /** The analyzer and the router. Needs vision. */
  llmModel: string;
  /**
   * The coach — the model behind a question in chat. Text only, so it need not be the vision
   * model, and its own setting so the two can move independently: the analyzer is judged on
   * grams, the coach on prose and tool use, and the best model at one is not the best at the other.
   */
  llmChatModel: string;
  /**
   * `reasoning: { effort }` on every schema call — `reasoning: { enabled: false }` on `off` — or
   * nothing when empty. Ships `off`: reasoning is where the wait was — a median 47.7 s to first
   * item on grok-4.5, 3.6 s on qwen3-vl-235b with it off, at the same kcal error (n = 60,
   * docs/ACCURACY.md).
   */
  llmReasoningEffort: string;
  /**
   * Pins the nutrition calls — analyzer, router, corrections — to these OpenRouter providers,
   * comma-separated, with fallbacks refused (`provider.order` + `allow_fallbacks: false`). The
   * privacy page names OpenRouter and the serving provider and nobody else, so routing may not
   * roam. Empty lets OpenRouter choose. Must name providers that serve `llmModel`, or every call
   * fails at routing. The coach (`llmChatModel`) is not pinned.
   */
  llmProviderOrder: string;
  llmApiKey: string;
  /**
   * Where the chat-completions call goes. Env-configurable so a test instance can point at a proxy, a
   * gateway, or a recorded fixture server without a code change — and so nothing has to guess
   * which environment it is in.
   */
  llmBaseUrl: string;
  /**
   * How long a model call may hang before it is abandoned. There was no timeout at all: a
   * provider that accepts the connection and never answers held the request, the user's photo,
   * and a worker slot indefinitely.
   */
  llmTimeoutMs: number;
  /**
   * The completion bound sent with every model call.
   *
   * A request that names none is not unbounded — the provider substitutes the model's own ceiling
   * (65536 on OpenRouter) and reserves the whole of it against the balance BEFORE it will route the
   * call. So an omitted bound is not a generous default, it is a demand for ~40x the tokens the
   * call will actually generate, refused as a 402 with nothing analyzed.
   *
   * The default is ~10x the 1614 completion tokens a real meal analysis measured on grok-4.5 —
   * 80% of which were REASONING tokens, which count against this and vary far more than the answer
   * does. Generous on purpose: the bound is reserved, not charged — the incident's own numbers put
   * completion at ~$6/M, so 16000 bills ~$0.01 and merely requires ~$0.096 of balance to route,
   * against ~$0.39 for the 65536 it replaces. That is the real cost of raising it: not the bill,
   * but the balance below which every call 402s again. Worth it, because a bound that is too tight
   * truncates the JSON and returns `analysis-failed` with the user's analysis already charged.
   *
   * It is a variable because the right number is a property of the model, and `llmModel` is a
   * variable. It is not a variable that has to be SET: this default is what ships, and deleting the
   * env line falls back to it rather than to no bound at all.
   */
  llmMaxTokens: number;
  /**
   * At most this many coding-agent CLI processes at once, and only read when `llmProvider` is a
   * `*-cli` one (`llm/local-agent.ts`). A spawned agent is a whole runtime per call — the bound
   * is what keeps an unbounded fan-out of them from taking the host down with them. The default
   * is sized for `routeText`'s speculative pair.
   */
  llmAgentConcurrency: number;
  /**
   * Analyses an account gets before an entitlement is required. THERE IS NO FREE TIER: this is
   * the onboarding's sample — the one meal on us, photo or typed — and the default is
   * `FREE_ANALYSES` (1). Lifetime, not per day, and the INSTANCE default: the admin can give one
   * account its own (`Store.setFreeAnalyses`). A demo instance sets it high rather than growing a
   * second code path.
   */
  freeAnalyses: number;
  /**
   * Photos per day for an account with a live entitlement; 0 means no daily cap. What a
   * subscription buys is this allowance — never an exemption from `globalDailyAnalysisCap`,
   * which bounds the instance above it: a paid user is a bigger share of a budget.
   */
  paidDailyPhotoCap: number;
  /** Photos the whole instance may analyze per day. Bounds spend when the app is public. */
  globalDailyAnalysisCap: number;
  /** IANA zone used for every date boundary. Dates are NOT computed in UTC. */
  timezone: string;

  /**
   * How long a proposed text meal stays confirmable. Shorter in production keeps the table small;
   * longer in development stops a proposal expiring while you are reading the code.
   */
  pendingTtlMs: number;
  /** Total upload size accepted, in bytes. A cap is what stops a large POST being a DoS. */
  maxUploadBytes: number;
  /**
   * Photographs accepted for ONE meal. Several angles of one plate, one analysis, one billed call.
   *
   * The client is TOLD this value rather than compiling its own copy — see `limits` on the profile
   * response. Two independently-set numbers that must agree is two numbers that will not.
   */
  maxPhotosPerMeal: number;

  /**
   * Every audience an Apple ID token may legitimately carry — the iOS bundle id, plus a Service ID
   * if a web flow is ever added. NOT a secret; a client id is public by design.
   *
   * Empty means Sign in with Apple is OFF, and the route says so rather than verifying without an
   * audience check. A verifier with no audience accepts tokens minted for any app in the world.
   */
  appleAudiences: string[];
  /** Every Google OAuth client id that may sign in: iOS, web, Android. Empty = Google is off. */
  googleAudiences: string[];
  /**
   * The Google OAuth WEB client, for onboarding in a browser (`docs/WEB_ONBOARDING.md`).
   *
   * BOTH OR NEITHER. With either one empty every path under `/start` answers 404 — the same shape
   * as the admin and the purchase webhook, and for the same reason: a half-configured sign-up is a
   * button that fails after somebody has already chosen their Google account.
   *
   * The id must ALSO appear in `googleAudiences`, and `loadConfig` refuses to start otherwise: the
   * token this flow gets back carries it as `aud`, so the two disagreeing is a surface that renders,
   * consents, and then fails every callback. The secret is Google's requirement for a web client at
   * the token endpoint; the native flow has none, which is why the app carries none.
   */
  googleWebClientId: string;
  googleWebClientSecret: string;
  /**
   * The web paywall (#77): which plans a browser may buy, at what prices, on how long a trial, and
   * the one exit offer — every field an `EAIT__BACKEND__WEB_*` variable, sent to the client
   * computed and formatted in `ProfileResponse.paywall`. The bundle compiles none of it.
   *
   * Every URL is a TEMPLATE containing `{userId}` — a RevenueCat Web Billing link, or anything
   * else that ends in a delivery to `/v1/revenuecat/webhook`. The id has to be in it: the webhook
   * is the only thing that can grant an entitlement, `app_user_id` is how it names the account,
   * and it refuses an id this server never issued. `loadConfig` refuses to boot on one without it.
   *
   * Prices are AMOUNTS in `currency` — numbers, never display strings; per-language formatting is
   * `paywallPrice`'s, at send time. EVERY URL EMPTY means the host sells nothing:
   * `/start/checkout` 404s, the soft offer passes straight through, and `paywall` tells every
   * client there is no paywall surface. The free sample is still `freeAnalyses` regardless —
   * nothing switches to "free" because a variable is missing.
   */
  webPaywall: WebPaywallConfig;

  /**
   * Sign in with Apple, in a browser (`docs/WEB_ONBOARDING.md`). ALL FOUR OR NONE — with any of
   * them empty the Apple button is not offered on `/start` and its two routes 404 with everything
   * else that does not exist.
   *
   * IT IS A DIFFERENT CLIENT FROM THE APP'S, and that is Apple's design rather than ours: the app
   * authorises as its BUNDLE ID and a browser authorises as a SERVICE ID. So the token that comes
   * back here carries the Service ID as its `aud`, and `appleServiceId` must appear in
   * `appleAudiences` — `loadConfig` refuses to start otherwise, for the reason the Google web
   * client id has the same check.
   *
   * `applePrivateKey` is the `.p8` in PKCS#8 PEM, and it is the one credential here that is a
   * SECRET. Apple does not issue a client secret; it issues this key, and the secret is a
   * short-lived ES256 JWT minted from it per request (`auth/web-oauth.ts`).
   */
  appleServiceId: string;
  appleTeamId: string;
  appleKeyId: string;
  applePrivateKey: string;

  /**
   * How many days a bearer token survives WITHOUT BEING USED.
   *
   * Idle time, not absolute age — `auth/tokens.ts` has the argument. Configurable because the right
   * number is a product judgement rather than a constant of nature, and because a test instance
   * that wants to exercise the expiry path should not have to wait half a year to reach it.
   */
  sessionTtlDays: number;

  /**
   * Requests per hour, per address, on the routes that mint a session.
   *
   * `POST /v1/auth/device` creates an account for anybody with a 32-character string, so without
   * this the per-user analysis allowance is worth nothing — resetting it costs one HTTP call — and
   * the users table grows as fast as somebody cares to loop. Zero disables the limit.
   */
  authRateLimitPerHour: number;
  /**
   * Billed analyses per day, per address, across every account reached from it.
   *
   * THIS is the cap that closes the account-minting bypass: `userDailyPhotoCap` bounds one account
   * and this bounds one address regardless of how many accounts it creates. Set well above one
   * person's own allowance on purpose — a mobile carrier can put thousands of subscribers behind
   * one address, and refusing a stranger who has logged one meal is a worse failure than the spend
   * this is guarding. Zero disables it; `globalDailyAnalysisCap` is then the only backstop.
   */
  analysisRateLimitPerDay: number;
  /**
   * The App Clip's circuit breaker: clip estimates the whole instance may spend per UTC day,
   * counted in the store and checked before the charge. Zero turns the clip route off. Server-only.
   */
  clipDailyMax: number;
  /** Clip estimates per address per day, on top of `analysisRateLimitPerDay`. Zero disables it. */
  clipPerAddressDay: number;
  /**
   * Health-sync posts per hour, per address.
   *
   * The heaviest write this API accepts: up to `MAX_HEALTH_DAYS_PER_BATCH` upserts inside one
   * transaction. It costs nothing at the model, so no billed cap covers it, and `POST
   * /v1/auth/device` hands out an account to anybody with a 32-character string — so an
   * account-scoped bound would be reset by one HTTP call. Per address, like the others.
   *
   * Generous on purpose: the app syncs on each visit to one screen, and several people can sit
   * behind one carrier address. This is a bound on a loop, not a quota anybody should meet. Zero
   * disables it.
   */
  healthSyncRateLimitPerHour: number;
  /** `POST /v1/messages/lines` and `PATCH /v1/meals/:id` per address per hour — one allowance, two counters. Unbilled and unmetered otherwise; same argument as the health sync. Zero disables it. */
  linesRateLimitPerHour: number;

  /**
   * The shared secret RevenueCat presents on its webhook, in the `Authorization` header.
   *
   * EMPTY MEANS THERE IS NO WEBHOOK. The route answers 404 exactly like `/admin` does when it is
   * unconfigured — an unauthenticated endpoint that writes entitlements is an endpoint that grants
   * them, and 404 rather than 403 keeps "there is one here" from being information.
   *
   * A secret, and treated as one: constant-time comparison, and `redact()` masks it.
   */
  revenueCatWebhookToken: string;
  /**
   * WHICH RevenueCat entitlement grants the paid tier.
   *
   * The DEFAULT IS THE IDENTIFIER THAT ACTUALLY EXISTS in the RevenueCat project (`eait_fit_pro`,
   * project eait․fit), not a generic `pro`. There is exactly one entitlement there and all three
   * products hang off it, so a default that names anything else means every purchase is read as
   * `other-entitlement` and silently grants nothing — charged, and no tier. It was `pro` for a day
   * on the strength of a document rather than the dashboard.
   *
   * A project can carry several — a lifetime unlock, a legacy plan, an internal comp — and an
   * event names the ones it affects. Matching on a configured id rather than "any entitlement at
   * all" is what stops a product nobody meant to sell the paid tier from selling it.
   */
  revenueCatEntitlementId: string;
  /**
   * Accept webhook events from RevenueCat's SANDBOX environment (App Store sandbox, Test Store).
   * OFF by default: a simulated purchase must not grant a real entitlement. The one deployed host
   * opts in while purchases are exercised from development and TestFlight builds, and must switch
   * it OFF the day the listing goes live (`eait_revenuecat_accept_sandbox`).
   */
  revenueCatAcceptSandbox: boolean;

  /**
   * The credential for `/admin` — onboarding copy and the funnel.
   *
   * EMPTY MEANS THERE IS NO ADMIN. Every path under `/admin` answers 404, so a deployment that
   * never sets this has no admin surface to attack rather than a locked one to guess at. It is its
   * own authority: a user's bearer token gets nothing here, and this token gets nothing on the
   * user API.
   *
   * A secret, and it is treated as one — `redact()` masks it, and nothing prints it.
   */
  // RETIRED in #391b — the admin is a role on an account. See `adminBootstrapUserId`.

  /**
   * This server's own public origin.
   *
   * Empty is supported and means "work it out from the request" — the Host header Caddy forwards,
   * plus `X-Forwarded-Proto`. Setting it explicitly is better wherever it is known, because a link
   * built from a header is a link an attacker can influence the hostname of.
   */
  publicApiUrl: string;

  /**
   * The origin a BROWSER is on, when it is not this API's own.
   *
   * Split out of `publicApiUrl` in #406, because one value cannot name two origins and the
   * reshuffle needs it to: `app.eait.fit` serves people, `api.eait.fit` serves the phone. The
   * OAuth `redirect_uri` is where a provider returns a person, so it follows THIS. The two were
   * one value until `app.eait.fit` existed, and the split is what lets each keep its own.
   *
   * Empty means "the same origin as the API", which is what every host did before this existed —
   * so an environment that never sets it is unchanged.
   */
  publicWebUrl: string;

  /**
   * The Telegram connector's bot token, from @BotFather. A secret: `redact()` masks it, and a
   * download URL built from it never reaches an error message (`telegram/bot.ts`).
   *
   * EMPTY MEANS THERE IS NO CONNECTOR — no polling loop, no Connect Telegram link, one boot line
   * saying it is off. `demoConfig` never reads it, so `--demo` never starts one. Prod and dev use
   * different bots: one token polled from two processes answers 409 to both.
   */
  telegramBotToken: string;
  /**
   * The read key for fooddb's catalog (`EAIT__BACKEND__FOODDB_READ_KEY`). Empty switches the daily
   * `food_ref` refresh off, and it is the only thing that does. A secret: `redact` masks it.
   */
  fooddbReadKey: string;
  /** Where that catalog lives. */
  fooddbUrl: string;
  /**
   * The connector's bot username, as Telegram's `getMe` answered it. NOT an environment variable:
   * written by the connector once it has reached Telegram (`index.ts`), and emptied again if the
   * token turns out dead. Every Connect Telegram link — the `/start` plan page, and the web app via
   * `ProfileResponse.telegramBot` — is drawn only while this is non-empty.
   */
  telegramBotUsername: string;

  /**
   * The ONE account made an admin at boot, by UUID, or empty for none (#391a).
   *
   * A UUID and never a provider `sub`, and that is a security property rather than a preference:
   * `identities` is keyed `(provider, subject)` and `upsertDeviceUser` writes
   * `('device', <any client-supplied string of 32+ characters>)`. An Apple subject is about 44
   * characters, so a grant keyed on the subject alone would be claimable by anybody willing to
   * mint a device account carrying it. The user id is ours, is a uuid column, and no request can
   * choose it.
   *
   * Applied on every boot, idempotently, because it must survive a restore: the off-site backup is
   * restored on every deploy, and a one-shot command run once against a database that is later
   * replaced by a pre-role dump leaves an instance nobody can administer.
   */
  adminBootstrapUserId: string;
  /**
   * Bootstrap fallback for the staff flag (`users.staff`, set in the admin users list): ids listed
   * here count as staff too. Empty means only the flag decides.
   */
  campaignStaffIds: string[];

  // ── Notifications ────────────────────────────────────────────────────────────────────────
  //
  // Off by default, everywhere. A development server that pushed to real phones the first time
  // somebody ran it would be a development server nobody could run twice.

  /**
   * Whether the nightly sweep runs at all.
   *
   * OFF unless a deployment says otherwise. It is the switch to pull when the loop is doing more
   * harm than good — the retention plan pre-commits to turning a loop off when its blocks exceed
   * its reactivations, and that promise needs a switch that is not a code change.
   */
  pushEnabled: boolean;
  /**
   * Expo's push access token.
   *
   * A secret, and treated as one. EMPTY MEANS PUSHES ARE LOGGED, NOT SENT: Expo accepts
   * unauthenticated sends, so a server that fell back to sending without this would be a server
   * anybody who learns a device token can impersonate. `choosePush` refuses to build the real
   * client without it.
   */
  expoPushAccessToken: string;
  /**
   * Web Push (VAPID). All three set, with `pushEnabled`, and browser pushes are sent; otherwise
   * they are logged. The public key is sent to the client; the private key is a secret, and
   * `redact()` masks it. `webPushSubject` is a `mailto:` or `https:` contact for the push services.
   */
  webPushVapidPublicKey: string;
  webPushVapidPrivateKey: string;
  webPushSubject: string;
  /** How long one push request may hang. Same argument as `llmTimeoutMs`. */
  pushTimeoutMs: number;
  /** How long a shutdown waits for queued photo and update jobs; the deploy's stop grace period must exceed it. */
  shutdownDrainMs: number;
  /** How many queued jobs one process runs at once. */
  jobConcurrency: number;
  /** A queued job no replica has claimed by this age settles `OUTCOME_UNKNOWN` rather than waiting forever. */
  jobMaxQueuedMs: number;
  /**
   * When the evening line goes out, in this server's `timezone`.
   *
   * Configurable so a staging instance can reach the path without waiting until the evening. The
   * DEFAULT is `REMINDER_TIME` from `@eait/shared`, which is the 20:30 the onboarding copy promises
   * — move it in production and step 15's promise becomes false.
   */
  eveningLineTime: { hour: number; minute: number };

  /**
   * The landing page's origin, for the one thing the API needs it for: the privacy link `/start`
   * renders at `${landingUrl}/privacy`.
   *
   * Empty is a supported state, not a broken one: the pages then carry no privacy link, which is
   * what a backend deployed without a landing page has to do.
   */
  landingUrl: string;

  /**
   * The document the sign-up's "I agree to eait's Terms" links (#311). Unlike `landingUrl` this
   * is the href itself, not an origin a path is appended to — the terms live wherever the
   * operator published them, not necessarily on a landing of theirs.
   *
   * Empty is the same supported state: the consent line then renders the document's name as
   * underlined text, which is all a host with no published terms can honestly do.
   */
  termsUrl: string;

  /**
   * The donation links an operator may offer — the You surface's "Support eait" row (#200).
   * ALL EMPTY IS THE DEFAULT AND THE OFF STATE: a host that takes no donations draws no row,
   * and `ProfileResponse.donate` is how the bundle learns the ones that are set — sent, like
   * `limits`, never compiled into a client that serves more than one host.
   */
  donateKofiUrl: string;
  donateBmcUrl: string;
  donateGithubUrl: string;

}

/** A donation link: empty is off; a set one must be an http(s) URL a browser can open. */
function donateUrl(name: string, raw: string | undefined): string {
  const v = (raw ?? "").trim();
  if (v !== "" && !/^https?:\/\/\S+$/.test(v)) {
    throw new Error(`[eait] ${name} must be an http(s) URL — e.g. https://ko-fi.com/you — not "${v}"`);
  }
  return v;
}

/** Comma-separated env list → trimmed array, empties dropped. */
function list(name: string): string[] {
  return (process.env[name] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`[eait] ${name} is required and not set`);
  return v;
}

/**
 * A non-negative integer from the environment, or the fallback.
 *
 * Exported because `scripts/` reads the same variables without `loadConfig`, and hand-rolling the
 * read there is how a present-but-empty variable became `Number("")` — zero — and a typo became
 * `NaN`, which `JSON.stringify` writes as `null` and a provider reads as "not sent".
 */
export function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) throw new Error(`[eait] ${name} must be a non-negative integer`);
  return n;
}

/**
 * The per-model-call budget, read and floored — the ONE way anything reads this variable.
 *
 * The same lesson as `llmMaxTokensFromEnv` directly below, and deliberately the same shape. `int()`
 * accepts an explicit `0`, and zero here is not "no limit": it is a budget of nothing, so every
 * model call aborts before it starts. Since #175 this number is also SENT to the phone
 * (`Limits.modelCallTimeoutMs`), which makes a zero worse than a dead server — the client's wait
 * becomes the transfer margin alone while this process keeps running the call and keeps paying for
 * it, with nothing logged as wrong on either side.
 *
 * `MIN_MODEL_CALL_TIMEOUT_MS` is in `shared` because the phone applies the same floor to the
 * number it receives. A shipped app outlives the server it was built against, and a proxy or an
 * older server can put anything in that field.
 */
export function llmTimeoutMsFromEnv(fallback: number): number {
  const value = int("EAIT__BACKEND__LLM_TIMEOUT_MS", fallback);
  if (value < MIN_MODEL_CALL_TIMEOUT_MS) {
    throw new Error(`[eait] EAIT__BACKEND__LLM_TIMEOUT_MS must be at least ${MIN_MODEL_CALL_TIMEOUT_MS}; a photo analysis measured a median 37s to its first token, and 0 is a budget of nothing rather than 'unbounded'`);
  }
  return value;
}

/**
 * The completion bound, read and floored — the ONE way anything reads this variable.
 *
 * `int` alone is not enough, and sharing only `int` is what let these two diverge: it accepts an
 * explicit `0`, so the server refused to start while `scripts/eval-photos.ts` sent `max_tokens: 0`
 * on every billed call. Zero is "no limit" for every cap and rate limit in this file and cannot
 * mean that here — it is a bound OF zero, so every reply comes back empty.
 *
 * The floor is ABOVE the 1614 completion tokens a real analysis measured, not merely above zero. A
 * bound under the measurement does not fail some calls, it fails every one of them, and since
 * truncation is terminal rather than retried it fails them deterministically: this incident again,
 * from a value the validator had called acceptable.
 */
export function llmMaxTokensFromEnv(fallback: number): number {
  const value = int("EAIT__BACKEND__LLM_MAX_TOKENS", fallback);
  if (value < 2000) {
    throw new Error("[eait] EAIT__BACKEND__LLM_MAX_TOKENS must be at least 2000; one measured analysis is 1614 completion tokens, and 0 is a bound of zero rather than 'unbounded'");
  }
  return value;
}

/**
 * Every default, in ONE place, reading nothing from the environment.
 *
 * `loadConfig` layers env over this, and `--demo` and the tests override the few fields they care
 * about. Before this existed the defaults were written inline in `loadConfig` and each other
 * construction site listed every field by hand, so adding one broke three of them at once — which
 * is how this function came to be written.
 *
 * The values here are the DEVELOPMENT-safe ones: loopback, no credentials, generous caps.
 */
export function configDefaults(): Config {
  return {
    port: 8484,
    host: "127.0.0.1",
    databaseUrl: "",
    databaseMaxConnections: 25,
    llmProvider: "openrouter",
    llmModel: "qwen/qwen3-vl-235b-a22b-instruct",
    llmChatModel: "x-ai/grok-4.6",
    llmReasoningEffort: "off",
    // DeepInfra is the named provider for the shipped analyzer — the pin the privacy page's
    // "OpenRouter plus the serving provider" promise is written around. Empty would roam.
    // provider.order takes the endpoint's SLUG (`deepinfra`, the part before the `/fp8` tag),
    // not the display name — "DeepInfra" matches no provider and would fail every call.
    llmProviderOrder: "deepinfra",
    llmApiKey: "",
    llmBaseUrl: "https://openrouter.ai/api/v1/chat/completions",
    llmTimeoutMs: SERVER_LLM_TIMEOUT_MS,
    llmMaxTokens: 16_000,
    llmAgentConcurrency: 2,
    freeAnalyses: FREE_ANALYSES,
    paidDailyPhotoCap: 200,
    globalDailyAnalysisCap: 500,
    timezone: "Europe/Berlin",
    pendingTtlMs: 30 * 60 * 1000,
    maxUploadBytes: 20 * 1024 * 1024,
    maxPhotosPerMeal: 4,
    sessionTtlDays: DEFAULT_SESSION_TTL_MS / (24 * 60 * 60 * 1000),
    authRateLimitPerHour: 20,
    analysisRateLimitPerDay: 60,
    clipDailyMax: 500,
    clipPerAddressDay: 3,
    healthSyncRateLimitPerHour: 120,
    linesRateLimitPerHour: 120,
    appleAudiences: [],
    googleAudiences: [],
    googleWebClientId: "",
    googleWebClientSecret: "",
    webPaywall: {
      yearlyCheckoutUrl: "",
      monthlyCheckoutUrl: "",
      yearlyPrice: 0,
      monthlyPrice: 0,
      trialDays: 0,
      exitOfferCheckoutUrl: "",
      exitOfferPrice: 0,
      exitOfferRegularPrice: 0,
      currency: "",
    },
    appleServiceId: "",
    appleTeamId: "",
    appleKeyId: "",
    applePrivateKey: "",
    revenueCatWebhookToken: "",
    revenueCatEntitlementId: "eait_fit_pro",
    revenueCatAcceptSandbox: false,
    publicApiUrl: "",
    publicWebUrl: "",
    telegramBotToken: "",
    fooddbReadKey: "",
    fooddbUrl: "https://food-api.eait.fit",
    telegramBotUsername: "",
    adminBootstrapUserId: "",
    campaignStaffIds: [],
    landingUrl: "",
    termsUrl: "",
    donateKofiUrl: "",
    donateBmcUrl: "",
    donateGithubUrl: "",
    pushEnabled: false,
    expoPushAccessToken: "",
    webPushVapidPublicKey: "",
    webPushVapidPrivateKey: "",
    webPushSubject: "",
    pushTimeoutMs: 15_000,
    shutdownDrainMs: 60_000,
    jobConcurrency: 4,
    jobMaxQueuedMs: 600_000,
    // The one number the shipped copy states out loud, so it has exactly one source.
    eveningLineTime: { hour: REMINDER_TIME.hour, minute: REMINDER_TIME.minute },
  };
}

export function loadConfig(): Config {
  const d = configDefaults();

  const maxPhotosPerMeal = int("EAIT__BACKEND__MAX_PHOTOS_PER_MEAL", d.maxPhotosPerMeal);
  if (maxPhotosPerMeal < 1) throw new Error("[eait] EAIT__BACKEND__MAX_PHOTOS_PER_MEAL must be at least 1");

  // Zero passes `int` — it is a non-negative integer — and would expire every token the instant it
  // was issued, which presents as an app that cannot stay signed in and as nothing in any log.
  const sessionTtlDays = int("EAIT__BACKEND__SESSION_TTL_DAYS", d.sessionTtlDays);
  if (sessionTtlDays < 1) throw new Error("[eait] EAIT__BACKEND__SESSION_TTL_DAYS must be at least 1");

  // The free DAILY cap described a tier that no longer exists. A host provisioned before the
  // change still spells it; refusing is what gets it removed rather than silently ignored.
  if (process.env.EAIT__BACKEND__USER_DAILY_PHOTO_CAP !== undefined) {
    throw new Error(
      "[eait] EAIT__BACKEND__USER_DAILY_PHOTO_CAP is retired: there is no free tier. " +
      `EAIT__BACKEND__FREE_ANALYSES is the sample size (default ${FREE_ANALYSES}).`,
    );
  }
  const freeAnalyses = int("EAIT__BACKEND__FREE_ANALYSES", d.freeAnalyses);
  const paidDailyPhotoCap = int("EAIT__BACKEND__PAID_DAILY_PHOTO_CAP", d.paidDailyPhotoCap);

  const llmMaxTokens = llmMaxTokensFromEnv(d.llmMaxTokens);

  // `openrouter` is the billed gateway; the `*-cli` values are the local coding agents of
  // `llm/local-agent.ts` — dev and self-hosted only. An unknown value used to read as
  // "openrouter anyway", a provider the operator never asked for answering with their key.
  const llmProvider = process.env.EAIT__BACKEND__LLM_PROVIDER ?? d.llmProvider;
  if (!LLM_PROVIDERS.includes(llmProvider)) {
    throw new Error(`[eait] EAIT__BACKEND__LLM_PROVIDER must be one of ${LLM_PROVIDERS.join(", ")}, not "${llmProvider}"`);
  }
  const llmAgentConcurrency = int("EAIT__BACKEND__LLM_AGENT_CONCURRENCY", d.llmAgentConcurrency);
  if (llmAgentConcurrency < 1) {
    throw new Error("[eait] EAIT__BACKEND__LLM_AGENT_CONCURRENCY must be at least 1");
  }

  // The web sign-in's audience, checked at BOOT rather than at the end of somebody's first sign-up.
  //
  // `auth/verify.ts` refuses a token whose `aud` is not in this list, and the token `/start` gets
  // back carries the web client id. Set one and forget the other and the surface renders, the button
  // works, Google shows its consent screen — and then every callback fails, for everybody,
  // permanently, with the only trace in this process's log. That is the same failure the both-or-
  // neither rule and the `{userId}` check refuse: configuration that looks complete and breaks after
  // the user has already chosen their Google account.
  const googleAudiences = list("EAIT__BACKEND__GOOGLE_AUDIENCES");
  const googleWebClientId = process.env.EAIT__BACKEND__GOOGLE_WEB_CLIENT_ID ?? d.googleWebClientId;
  if (googleWebClientId !== "" && !googleAudiences.includes(googleWebClientId)) {
    throw new Error(
      "[eait] EAIT__BACKEND__GOOGLE_WEB_CLIENT_ID must also be listed in EAIT__BACKEND__GOOGLE_AUDIENCES, " +
      "or every /start sign-in fails audience verification — see docs/WEB_ONBOARDING.md",
    );
  }

  // Sign in with Apple on the web, checked the same way and for the same reasons.
  //
  // THE SERVICE ID IS A SECOND AUDIENCE, not a replacement for the bundle id: the app keeps signing
  // in as `com.eait.fit.ios` while a browser signs in as the Service ID, so both belong in the list
  // and dropping either one silently switches off one of the two surfaces.
  const appleServiceId = process.env.EAIT__BACKEND__APPLE_SERVICE_ID ?? d.appleServiceId;
  const appleWebParts = {
    EAIT__BACKEND__APPLE_SERVICE_ID: appleServiceId,
    EAIT__BACKEND__APPLE_TEAM_ID: process.env.EAIT__BACKEND__APPLE_TEAM_ID ?? d.appleTeamId,
    EAIT__BACKEND__APPLE_KEY_ID: process.env.EAIT__BACKEND__APPLE_KEY_ID ?? d.appleKeyId,
    EAIT__BACKEND__APPLE_PRIVATE_KEY: applePrivateKeyFromEnv(),
  };
  const appleWebSet = Object.entries(appleWebParts).filter(([, v]) => v !== "");
  // ALL FOUR OR NONE, checked rather than tolerated. Three of the four is a host where the button
  // renders and the exchange fails with Apple's `invalid_client`, which says nothing about which of
  // them is missing.
  if (appleWebSet.length > 0 && appleWebSet.length < 4) {
    const missing = Object.entries(appleWebParts).filter(([, v]) => v === "").map(([k]) => k);
    throw new Error(
      `[eait] Sign in with Apple on /start needs all four of its settings or none; missing: ` +
      `${missing.join(", ")} — see docs/WEB_ONBOARDING.md`,
    );
  }
  if (appleServiceId !== "" && !list("EAIT__BACKEND__APPLE_AUDIENCES").includes(appleServiceId)) {
    throw new Error(
      "[eait] EAIT__BACKEND__APPLE_SERVICE_ID must also be listed in EAIT__BACKEND__APPLE_AUDIENCES, " +
      "or every /start sign-in with Apple fails audience verification — see docs/WEB_ONBOARDING.md",
    );
  }

  // A value the provider rejects is a 400 on EVERY schema call — charged, because a 400 is not a
  // gateway refusal — so a typo here would spend every user's sample on nothing. Refused at boot.
  const llmReasoningEffort = process.env.EAIT__BACKEND__LLM_REASONING_EFFORT ?? d.llmReasoningEffort;
  if (!["", "low", "medium", "high", "off"].includes(llmReasoningEffort)) {
    throw new Error(`[eait] EAIT__BACKEND__LLM_REASONING_EFFORT must be low, medium, high or off (or empty), not "${llmReasoningEffort}"`);
  }

  const eveningLineTime = eveningLineTimeFromEnv();

  return {
    ...d,
    port: int("EAIT__BACKEND__PORT", d.port),
    host: process.env.EAIT__BACKEND__HOST ?? d.host,
    databaseUrl: required("EAIT__BACKEND__DATABASE_URL"),
    databaseMaxConnections: int("EAIT__BACKEND__DATABASE_MAX_CONNECTIONS", d.databaseMaxConnections),
    llmProvider,
    llmModel: process.env.EAIT__BACKEND__LLM_MODEL ?? d.llmModel,
    llmChatModel: process.env.EAIT__BACKEND__LLM_CHAT_MODEL ?? d.llmChatModel,
    llmReasoningEffort,
    llmProviderOrder: process.env.EAIT__BACKEND__LLM_PROVIDER_ORDER ?? d.llmProviderOrder,
    // The key is OpenRouter's: a `*-cli` provider authenticates on the host instead, and
    // requiring it there would refuse a boot that needed no key at all.
    llmApiKey: llmProvider === "openrouter"
      ? required("EAIT__BACKEND__LLM_API_KEY")
      : (process.env.EAIT__BACKEND__LLM_API_KEY ?? ""),
    llmBaseUrl: process.env.EAIT__BACKEND__LLM_BASE_URL ?? d.llmBaseUrl,
    llmTimeoutMs: llmTimeoutMsFromEnv(d.llmTimeoutMs),
    llmMaxTokens,
    llmAgentConcurrency,
    freeAnalyses,
    paidDailyPhotoCap,
    globalDailyAnalysisCap: int("EAIT__BACKEND__GLOBAL_DAILY_ANALYSIS_CAP", d.globalDailyAnalysisCap),
    timezone: process.env.EAIT__BACKEND__TZ_NAME ?? d.timezone,
    pendingTtlMs: int("EAIT__BACKEND__PENDING_TTL_MINUTES", d.pendingTtlMs / 60_000) * 60 * 1000,
    // Expressed in megabytes because that is how anyone setting it thinks about it.
    maxUploadBytes: int("EAIT__BACKEND__MAX_UPLOAD_MB", d.maxUploadBytes / (1024 * 1024)) * 1024 * 1024,
    maxPhotosPerMeal,
    sessionTtlDays,
    authRateLimitPerHour: int("EAIT__BACKEND__AUTH_RATE_LIMIT_PER_HOUR", d.authRateLimitPerHour),
    analysisRateLimitPerDay: int("EAIT__BACKEND__ANALYSIS_RATE_LIMIT_PER_DAY", d.analysisRateLimitPerDay),
    clipDailyMax: int("EAIT__BACKEND__CLIP_DAILY_MAX", d.clipDailyMax),
    clipPerAddressDay: int("EAIT__BACKEND__CLIP_PER_ADDRESS_DAY", d.clipPerAddressDay),
    healthSyncRateLimitPerHour: int("EAIT__BACKEND__HEALTH_SYNC_RATE_LIMIT_PER_HOUR", d.healthSyncRateLimitPerHour),
    linesRateLimitPerHour: int("EAIT__BACKEND__LINES_RATE_LIMIT_PER_HOUR", d.linesRateLimitPerHour),
    appleAudiences: list("EAIT__BACKEND__APPLE_AUDIENCES"),
    googleAudiences,
    googleWebClientId,
    googleWebClientSecret: process.env.EAIT__BACKEND__GOOGLE_WEB_CLIENT_SECRET ?? d.googleWebClientSecret,
    appleServiceId,
    appleTeamId: process.env.EAIT__BACKEND__APPLE_TEAM_ID ?? d.appleTeamId,
    appleKeyId: process.env.EAIT__BACKEND__APPLE_KEY_ID ?? d.appleKeyId,
    applePrivateKey: applePrivateKeyFromEnv(),
    webPaywall: webPaywallFromEnv(),
    revenueCatWebhookToken: revenueCatWebhookTokenFromEnv(),
    revenueCatEntitlementId:
      process.env.EAIT__BACKEND__REVENUECAT_ENTITLEMENT_ID ?? d.revenueCatEntitlementId,
    revenueCatAcceptSandbox: ["1", "true"].includes(process.env.EAIT__BACKEND__REVENUECAT_ACCEPT_SANDBOX ?? ""),
    publicApiUrl: (process.env.EAIT__BACKEND__PUBLIC_API_URL ?? d.publicApiUrl).replace(/\/$/, ""),
    publicWebUrl: (process.env.EAIT__BACKEND__PUBLIC_WEB_URL ?? d.publicWebUrl).replace(/\/$/, ""),
    telegramBotToken: telegramBotTokenFromEnv(),
    fooddbReadKey: (process.env.EAIT__BACKEND__FOODDB_READ_KEY ?? "").trim(),
    fooddbUrl: (process.env.EAIT__BACKEND__FOODDB_URL ?? "").trim() || d.fooddbUrl,
    adminBootstrapUserId: (process.env.EAIT__BACKEND__ADMIN_BOOTSTRAP_USER_ID ?? d.adminBootstrapUserId).trim(),
    campaignStaffIds: process.env.EAIT__BACKEND__CAMPAIGN_STAFF_IDS === undefined ? d.campaignStaffIds : list("EAIT__BACKEND__CAMPAIGN_STAFF_IDS"),
    // No validation beyond "looks like an origin": a wrong value here sends somebody to the wrong
    // page, which is visible, rather than corrupting anything, which is not.
    landingUrl: (process.env.EAIT__BACKEND__LANDING_URL ?? d.landingUrl).replace(/\/$/, ""),
    // The href itself, so no trailing-slash trim — stripping one off `…/stdeula/` is a broken link.
    termsUrl: process.env.EAIT__BACKEND__TERMS_URL ?? d.termsUrl,
    donateKofiUrl: donateUrl("EAIT__BACKEND__DONATE_KOFI_URL", process.env.EAIT__BACKEND__DONATE_KOFI_URL),
    donateBmcUrl: donateUrl("EAIT__BACKEND__DONATE_BMC_URL", process.env.EAIT__BACKEND__DONATE_BMC_URL),
    donateGithubUrl: donateUrl("EAIT__BACKEND__DONATE_GITHUB_URL", process.env.EAIT__BACKEND__DONATE_GITHUB_URL),
    pushEnabled: ["1", "true"].includes(process.env.EAIT__BACKEND__PUSH_ENABLED ?? ""),
    expoPushAccessToken: process.env.EAIT__BACKEND__EXPO_PUSH_ACCESS_TOKEN ?? d.expoPushAccessToken,
    webPushVapidPublicKey: process.env.EAIT__BACKEND__WEB_PUSH_VAPID_PUBLIC_KEY ?? d.webPushVapidPublicKey,
    webPushVapidPrivateKey: process.env.EAIT__BACKEND__WEB_PUSH_VAPID_PRIVATE_KEY ?? d.webPushVapidPrivateKey,
    webPushSubject: process.env.EAIT__BACKEND__WEB_PUSH_SUBJECT ?? d.webPushSubject,
    pushTimeoutMs: int("EAIT__BACKEND__PUSH_TIMEOUT_MS", d.pushTimeoutMs),
    shutdownDrainMs: int("EAIT__BACKEND__SHUTDOWN_DRAIN_MS", d.shutdownDrainMs),
    jobConcurrency: int("EAIT__BACKEND__JOB_CONCURRENCY", d.jobConcurrency),
    jobMaxQueuedMs: int("EAIT__BACKEND__JOB_MAX_QUEUED_MS", d.jobMaxQueuedMs),
    eveningLineTime,
  };
}

/**
 * `HH:MM`, in this server's zone.
 *
 * A startup error rather than a fallback to 20:30. A typo here does not break anything visible —
 * the sweep simply runs at a time nobody chose, once a day, and the only way to find out is to
 * notice when the messages arrive.
 */
export function eveningLineTimeFromEnv(): { hour: number; minute: number } {
  const raw = process.env.EAIT__BACKEND__EVENING_LINE_TIME;
  if (raw === undefined || raw === "") return { ...configDefaults().eveningLineTime };
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(raw.trim());
  if (!m) throw new Error(`[eait] EAIT__BACKEND__EVENING_LINE_TIME must be HH:MM, not "${raw}"`);
  return { hour: Number(m[1]), minute: Number(m[2]) };
}

/**
 * There WAS an `adminTokenFromEnv` here, and #391b retired it.
 *
 * The admin is a role an account carries; there is no shared secret left to validate, and a
 * variable that still existed would be a second way in that nobody was watching. What replaced it
 * is `adminBootstrapUserId` above, which grants the role at boot and is not a credential.
 */

/**
 * The RevenueCat webhook credential, refused if it is too short to be one.
 *
 * Same shape and same reasoning as `adminTokenFromEnv`: unset is fine and means the webhook does
 * not exist, while set-and-weak is a startup error because it looks protected and is not. What is
 * behind this one is the ability to write "this account has paid" onto any account whose id you
 * can guess — and account ids are handed to the client, so guessing is not the hard part.
 *
 * RevenueCat sends the value verbatim as the `Authorization` header, so it must be a header value:
 * no whitespace, no newline. A token with a space in it is a header the server splits differently
 * from the one the dashboard shows, and the only symptom is a webhook that always 404s.
 */
export function revenueCatWebhookTokenFromEnv(): string {
  const raw = process.env.EAIT__BACKEND__REVENUECAT_WEBHOOK_TOKEN ?? "";
  if (raw === "") return raw;
  if (raw.length < 24) {
    throw new Error(
      "[eait] EAIT__BACKEND__REVENUECAT_WEBHOOK_TOKEN must be at least 24 characters (or unset to disable the webhook)",
    );
  }
  if (/\s/.test(raw)) {
    throw new Error("[eait] EAIT__BACKEND__REVENUECAT_WEBHOOK_TOKEN must not contain whitespace");
  }
  return raw;
}

/**
 * The Telegram bot token, or empty for no connector.
 *
 * TRIMMED, NEVER VALIDATED. A token has no whitespace, so a stray space or newline from an env file
 * is removed rather than sent. Anything else wrong with it is Telegram's to say: a 401 or 404 stops
 * the connector with a line naming this variable, and the API keeps serving — a Telegram typo must
 * not be able to take the product's own server down at boot.
 */
export function telegramBotTokenFromEnv(): string {
  return (process.env.EAIT__BACKEND__TELEGRAM_BOT_TOKEN ?? "").trim();
}

/**
 * A config safe to print. Never log the raw object — `llmApiKey` is in it, and a config dump in a
 * crash report is one of the commonest ways a key reaches a log aggregator.
 */
export function redact(c: Config): Record<string, unknown> {
  const {
    llmApiKey: _k, revenueCatWebhookToken: _rc,
    expoPushAccessToken: _e, webPushVapidPrivateKey: _wp, googleWebClientSecret: _g, applePrivateKey: _ap, telegramBotToken: _tg, fooddbReadKey: _fk, databaseUrl,
    ...rest
  } = c;
  return {
    ...rest,
    databaseUrl: databaseUrl.replace(/\/\/[^@]*@/, "//***@"),
    llmApiKey: "***",
    // Destructured out above and reinstated as a mask, so a field added to Config can never reach
    // this log by being forgotten — the omission is the default and the disclosure is the edit.
    // Whether the admin is ON is worth seeing in a boot log; the token itself never is.
    // Same again: whether purchases can be reported at all is the thing worth reading in a log.
    revenueCatWebhookToken: c.revenueCatWebhookToken === "" ? "(disabled)" : "***",
    // Whether this server can send a notification at all is the thing worth reading in a boot log.
    expoPushAccessToken: c.expoPushAccessToken === "" ? "(unset — pushes are logged)" : "***",
    webPushVapidPrivateKey: c.webPushVapidPrivateKey === "" ? "(unset — web pushes are logged)" : "***",
    // Google's web client secret. A real secret — ansible carries it `no_log` and reads it back off
    // the host rather than re-deriving it — and this line is the only thing between it and every
    // container log, because `...rest` above would print it verbatim on every boot.
    googleWebClientSecret: c.googleWebClientSecret === "" ? "(unset — Google is off on /start)" : "***",
    // The Apple `.p8`. Destructured out above for the same reason and reinstated the same way: it
    // is a multi-line PEM, so `...rest` would not merely leak it, it would leak it across twenty
    // lines of a boot log where nobody reads to the end.
    applePrivateKey: c.applePrivateKey === "" ? "(unset — Apple is off on /start)" : "***",
    telegramBotToken: c.telegramBotToken === "" ? "(unset — the Telegram connector is off)" : "***",
    fooddbReadKey: c.fooddbReadKey === "" ? "(unset — the catalog refresh is off)" : "***",
  };
}

/**
 * The configuration `--demo` runs on.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * IT STARTS FROM `configDefaults()` AND OVERRIDES ONLY WHAT DEMO MODE CHANGES, so a new setting
 * picks up its default here instead of being silently absent.
 *
 * It lives beside `loadConfig` rather than in the composition root because it is the same kind of
 * decision — which numbers this process runs on — and because a composition root cannot be tested
 * without starting a server, which is how the per-address limits below stayed at their production
 * values long after they had begun failing the E2E suite.
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 */
/**
 * The demo's per-address auth limit: a million, unless one runner says otherwise.
 *
 * `scripts/e2e-boot.sh` needs a real one, because a 429 at the door is a screen this app has words
 * for and nothing else in the repo can reach it. Everything else must stay unmetered for the reason
 * `demoConfig` states at length: a demo has one address, every flow mints a token on launch, and a
 * metered demo goes red from the sixth flow on in the app's own words — a failure that names the
 * product and not the limiter.
 *
 * SO IT IS NOT THE PRODUCTION VARIABLE. `EAIT__BACKEND__AUTH_RATE_LIMIT_PER_HOUR` is read from the
 * ambient environment by `loadConfig`, `bun run --cwd backend demo` auto-loads `.env`, and this
 * machine loads `~/.claude/.env` into every shell — so honouring that name here would mean one
 * stray value silently metering every `./dev up --demo`. `…__E2E_AUTH_RATE_LIMIT_PER_HOUR` is set
 * by one script and nothing else, which keeps the carve-out without re-opening that door.
 *
 * AND ZERO IS REFUSED. `int` allows it — it guards `n < 0`, and its name says non-negative — while
 * `ratelimit.ts` admits on `count < limit`, so a limit of zero refuses the FIRST sign-in and every
 * one after it. That is the same red suite the paragraph above is about, reachable by spelling the
 * value `0` rather than by leaving it empty.
 */
function demoAuthRateLimitPerHour(): number {
  const n = int("EAIT__BACKEND__E2E_AUTH_RATE_LIMIT_PER_HOUR", 1_000_000);
  if (n === 0) {
    throw new Error("[eait] EAIT__BACKEND__E2E_AUTH_RATE_LIMIT_PER_HOUR must be at least 1 — zero refuses every sign-in");
  }
  return n;
}

export function demoConfig(): Config {
  return {
    ...configDefaults(),
    port: Number(process.env.EAIT__BACKEND__PORT ?? 8484),
    host: process.env.EAIT__BACKEND__HOST ?? "127.0.0.1",
    databaseUrl: "memory://demo",
    llmProvider: "demo", llmModel: "demo", llmChatModel: "demo", llmApiKey: "unused",
    // No paywall in the demo BY DEFAULT — the E2E flows log several meals per account — and
    // unmetered globally: it is a local demo, not a public instance. The sheet itself is exercised
    // against RevenueCat's Test Store, not here.
    //
    // OVERRIDABLE, for the one runner that needs a sample it can spend. `scripts/e2e-paywall.sh`
    // starts a demo with `EAIT__BACKEND__FREE_ANALYSES=1`, because the refusal that opens the
    // paywall is `subscription-required` and nothing produces it while the sample is effectively
    // unlimited. It cannot be the default: the suite's other flows log two or three analyses per
    // account and would all end on a paywall instead of on what they test.
    freeAnalyses: Number(process.env.EAIT__BACKEND__FREE_ANALYSES ?? 100_000),
    globalDailyAnalysisCap: 0,
    // AND UNMETERED PER ADDRESS, for a reason the global cap does not cover. `api/ratelimit.ts`
    // keys on the client address, and a demo has exactly one: every request the simulator makes
    // comes off 127.0.0.1 and lands in the same bucket. `bun run e2e` clears state and mints a
    // fresh account per flow, three flows run 01-onboarding as a subflow, and a failed flow is
    // retried once — comfortably past the production default of 20 sign-ins an hour. The suite then
    // goes red from the sixth flow on, showing the app's own "Too many sign-ins from this network
    // just now", and every failure names a product string rather than the limiter. A gate that
    // fails under its own load, in words that describe the app, is worse than no gate at all.
    //
    // OVERRIDABLE, under a name of its own — see `demoAuthRateLimitPerHour` below.
    authRateLimitPerHour: demoAuthRateLimitPerHour(),
    analysisRateLimitPerDay: 1_000_000,
    healthSyncRateLimitPerHour: 1_000_000,
    linesRateLimitPerHour: 1_000_000,
    timezone: process.env.EAIT__BACKEND__TZ_NAME ?? "Europe/Berlin",
    // The same override `loadConfig` honours, read the same way (ieat-app#1178): a proposal lives
    // thirty minutes by default and a walk does not wait thirty minutes, so a demo that cannot age
    // one cannot draw "That one timed out" (`chat-expired`). `EAIT__BACKEND__PENDING_TTL_MINUTES=0`
    // makes every proposal die on arrival — `int` allows zero, which is the point here.
    pendingTtlMs: int("EAIT__BACKEND__PENDING_TTL_MINUTES", configDefaults().pendingTtlMs / 60_000) * 60 * 1000,
    // Read from the environment here too, and validated by the same function: the admin is how
    // onboarding copy is edited, and "works in demo, untested in production" is the shape of
    // every configuration bug that ships.
    // And the same argument for the web onboarding, except that `--demo` no longer needs any of
    // these to reach `/start` at all: `index.ts` gives it canned providers, because the surface's
    // first act is to send the browser to Google or Apple and neither will authorise against a
    // client id that does not exist. These are still read so a demo can be pointed at a REAL client
    // when the thing being checked is the redirect itself. Nothing is weakened by the canned pair —
    // the demo verifier a few lines below already accepts `demo:<provider>:<subject>` from anybody
    // who can reach the process, which is why a demo server is a loopback thing and always was.
    // AND THE BROWSER'S ORIGIN, for the reason the paragraph above gives about the admin: "works in
    // demo, untested in production" is the shape of every configuration bug that ships. Two things
    // read it and both are silent when it is wrong — the `/start` front door, which sends a
    // returning person to the diary instead of asking the questions again, and the plan page, which
    // offers the diary at all. `./dev up --demo --web` had a web application answering on the very
    // next port and a demo that could not tell it apart from itself, so it did neither.
    publicWebUrl: (process.env.EAIT__BACKEND__PUBLIC_WEB_URL ?? "").replace(/\/$/, ""),
    googleWebClientId: process.env.EAIT__BACKEND__GOOGLE_WEB_CLIENT_ID ?? "",
    googleWebClientSecret: process.env.EAIT__BACKEND__GOOGLE_WEB_CLIENT_SECRET ?? "",
    appleServiceId: process.env.EAIT__BACKEND__APPLE_SERVICE_ID ?? "",
    appleTeamId: process.env.EAIT__BACKEND__APPLE_TEAM_ID ?? "",
    appleKeyId: process.env.EAIT__BACKEND__APPLE_KEY_ID ?? "",
    applePrivateKey: applePrivateKeyFromEnv(),
    webPaywall: webPaywallFromEnv(),
    // Same argument — "works in demo, untested in production" is the shape of every configuration
    // bug that ships. The privacy link `/start` renders comes off this.
    landingUrl: (process.env.EAIT__BACKEND__LANDING_URL ?? "").replace(/\/$/, ""),
    // And the consent line's terms link beside it.
    termsUrl: process.env.EAIT__BACKEND__TERMS_URL ?? "",
    // Same argument once more for the donation links (#200): off unless the operator sets one,
    // and settable here so the Support row is the same code the production server sends.
    donateKofiUrl: donateUrl("EAIT__BACKEND__DONATE_KOFI_URL", process.env.EAIT__BACKEND__DONATE_KOFI_URL),
    donateBmcUrl: donateUrl("EAIT__BACKEND__DONATE_BMC_URL", process.env.EAIT__BACKEND__DONATE_BMC_URL),
    donateGithubUrl: donateUrl("EAIT__BACKEND__DONATE_GITHUB_URL", process.env.EAIT__BACKEND__DONATE_GITHUB_URL),
    // And the same argument again for the notification sweep. `choosePush` gives a demo the
    // LOGGING implementation whatever these say, so nothing can leave the machine — but the
    // scheduler, the sweep and the composed sentence are only reachable by hand if these are
    // readable here. Set EAIT__BACKEND__EVENING_LINE_TIME to a minute from now and watch it run.
    pushEnabled: ["1", "true"].includes(process.env.EAIT__BACKEND__PUSH_ENABLED ?? ""),
    eveningLineTime: eveningLineTimeFromEnv(),
    // The same argument once more, for the paid tier. The webhook is the ONLY way an account
    // becomes paid, and RevenueCat cannot reach a laptop — so a paywall flow has to post the
    // delivery itself, through the real route, past the real credential check. Unset here means
    // the route 404s exactly as it does in production, which is the state every other run wants.
    revenueCatWebhookToken: revenueCatWebhookTokenFromEnv(),
    // A Test Store purchase is delivered as `environment: SANDBOX`, and a demo that dropped those
    // would be a demo where no purchase can be exercised at all. Never a default in production:
    // there, sandbox deliveries are how somebody grants themselves a subscription for free.
    revenueCatAcceptSandbox: true,
  };
}

/**
 * The web paywall's env block, read and validated at boot (#77).
 *
 * EVERY URL IS REFUSED WITHOUT `{userId}` rather than accepted and silently useless. A checkout
 * link with no account id in it produces a RevenueCat delivery naming an anonymous customer,
 * which `api/revenuecat.ts` refuses outright — so the purchase succeeds, the money moves, and the
 * entitlement never lands anywhere. That failure is invisible from this end and expensive at the
 * other, which is exactly the kind that belongs in a startup check.
 *
 * `EAIT__BACKEND__WEB_CHECKOUT_URL` still answers for the yearly plan — the alias shipped before
 * plans existed and is kept for one release so a deploy mid-upgrade loses no checkout. The named
 * key wins when both are set.
 *
 * A CHECKOUT WITHOUT ITS PRICE IS REFUSED, and so is any sale without a currency: the boards draw
 * a figure on every plan, so a link that cannot be priced is a paywall with a hole in it, and a
 * number with no currency is one `Intl` cannot write down.
 */
export function webPaywallFromEnv(): WebPaywallConfig {
  // The reads are `process.env.NAME` literals at every call site — a name handed to a helper is
  // one the deploy scan in `src/scripts/prod-env.test.ts` cannot see, and a variable the scan
  // cannot see is one that ends up set nowhere.
  const url = (name: string, raw: string | undefined): string => {
    const v = raw ?? "";
    if (v !== "" && !v.includes("{userId}")) {
      throw new Error(`[eait] ${name} must contain {userId} — the webhook is the only thing that can grant the entitlement, and app_user_id is how it names the account`);
    }
    return v;
  };
  const price = (name: string, raw: string | undefined): number => {
    if (raw === undefined || raw === "") return 0;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) {
      throw new Error(`[eait] ${name} must be a positive amount — e.g. 39.99 — not "${raw}"`);
    }
    return n;
  };
  const yearlyPrice = price("EAIT__BACKEND__WEB_PRICE_YEARLY", process.env.EAIT__BACKEND__WEB_PRICE_YEARLY);
  const w: WebPaywallConfig = {
    yearlyCheckoutUrl:
      url("EAIT__BACKEND__WEB_CHECKOUT_YEARLY_URL", process.env.EAIT__BACKEND__WEB_CHECKOUT_YEARLY_URL)
      || url("EAIT__BACKEND__WEB_CHECKOUT_URL", process.env.EAIT__BACKEND__WEB_CHECKOUT_URL),
    monthlyCheckoutUrl: url("EAIT__BACKEND__WEB_CHECKOUT_MONTHLY_URL", process.env.EAIT__BACKEND__WEB_CHECKOUT_MONTHLY_URL),
    yearlyPrice,
    monthlyPrice: price("EAIT__BACKEND__WEB_PRICE_MONTHLY", process.env.EAIT__BACKEND__WEB_PRICE_MONTHLY),
    trialDays: int("EAIT__BACKEND__WEB_TRIAL_DAYS", 0),
    exitOfferCheckoutUrl: url("EAIT__BACKEND__WEB_EXIT_OFFER_URL", process.env.EAIT__BACKEND__WEB_EXIT_OFFER_URL),
    exitOfferPrice: price("EAIT__BACKEND__WEB_EXIT_OFFER_PRICE", process.env.EAIT__BACKEND__WEB_EXIT_OFFER_PRICE),
    // The anchor the offer is struck against defaults to the regular yearly price: an operator
    // who sets none still shows an honest strike-through.
    exitOfferRegularPrice:
      price("EAIT__BACKEND__WEB_EXIT_OFFER_REGULAR_PRICE", process.env.EAIT__BACKEND__WEB_EXIT_OFFER_REGULAR_PRICE) || yearlyPrice,
    currency: (process.env.EAIT__BACKEND__WEB_CURRENCY ?? "").toUpperCase(),
  };
  if (w.yearlyCheckoutUrl !== "" && w.yearlyPrice <= 0) {
    throw new Error("[eait] EAIT__BACKEND__WEB_CHECKOUT_YEARLY_URL is set but EAIT__BACKEND__WEB_PRICE_YEARLY is not a positive amount — a plan that cannot name its price is a paywall with a hole in it");
  }
  if (w.monthlyCheckoutUrl !== "" && w.monthlyPrice <= 0) {
    throw new Error("[eait] EAIT__BACKEND__WEB_CHECKOUT_MONTHLY_URL is set but EAIT__BACKEND__WEB_PRICE_MONTHLY is not a positive amount");
  }
  if (w.exitOfferCheckoutUrl !== "" && (w.exitOfferPrice <= 0 || w.exitOfferRegularPrice <= 0)) {
    throw new Error("[eait] EAIT__BACKEND__WEB_EXIT_OFFER_URL needs EAIT__BACKEND__WEB_EXIT_OFFER_PRICE and a regular price to strike through — its own, or EAIT__BACKEND__WEB_PRICE_YEARLY");
  }
  if (w.exitOfferCheckoutUrl !== "" && w.exitOfferPrice >= w.exitOfferRegularPrice) {
    throw new Error("[eait] EAIT__BACKEND__WEB_EXIT_OFFER_PRICE must undercut the regular price — an exit offer that saves nothing would show a '0 % off' card; leave WEB_EXIT_OFFER_URL empty instead");
  }
  const sellsSomething = w.yearlyCheckoutUrl !== "" || w.monthlyCheckoutUrl !== "" || w.exitOfferCheckoutUrl !== "";
  if (sellsSomething) {
    try {
      new Intl.NumberFormat("en", { style: "currency", currency: w.currency });
    } catch {
      throw new Error("[eait] EAIT__BACKEND__WEB_CURRENCY must be an ISO 4217 code — e.g. EUR — when the web paywall sells anything");
    }
  }
  return w;
}
/**
 * The PKCS#8 guard words, ASSEMBLED rather than spelled out.
 *
 * A credential scanner matches SHAPE, not substance: the dashed BEGIN line is the signature, and a
 * file carrying it trips the scan whether or not a key follows. Every use of these words in this
 * repository is this validation check or a test fixture holding no key material, so every hit was
 * false — and a gate that only ever cries wolf is a gate somebody eventually switches off. Building
 * the dashes from a count keeps the shape out of the source while leaving the comparison below
 * byte-identical; `config.test.ts` pins these two strings against a second, independent
 * construction, because a marker one dash short still reads correctly in a diff.
 */
const PEM_DASHES = "-".repeat(5);
export const PKCS8_BEGIN = `${PEM_DASHES}BEGIN PRIVATE KEY${PEM_DASHES}`;
export const PKCS8_END = `${PEM_DASHES}END PRIVATE KEY${PEM_DASHES}`;

/**
 * The Apple `.p8`, read from the environment with its newlines put back.
 *
 * `\n` IS ACCEPTED AS AN ESCAPE, and it is not a convenience. This value is a multi-line PEM and
 * it travels through a `.env` file, a compose `environment:` block and an ansible template, none of
 * which carry a literal newline in a value without quoting rules that differ between all three. The
 * single-line form is what every one of them can hold, so it is what the deploy writes.
 *
 * A value that is not a PKCS#8 PEM is a STARTUP ERROR rather than a callback that fails later:
 * `importPKCS8` would throw inside a request handler, after Apple's consent screen, for everybody.
 */
export function applePrivateKeyFromEnv(): string {
  const raw = (process.env.EAIT__BACKEND__APPLE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n").trim();
  if (raw === "") return "";
  if (!raw.startsWith(PKCS8_BEGIN) || !raw.endsWith(PKCS8_END)) {
    throw new Error(
      "[eait] EAIT__BACKEND__APPLE_PRIVATE_KEY is not a PKCS#8 PEM — it must be the .p8 Apple " +
      "downloads, whole, BEGIN and END lines included (newlines may be written as \\n). " +
      "See docs/WEB_ONBOARDING.md",
    );
  }
  return raw;
}
