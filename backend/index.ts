// Composition root. The only file allowed to know which store and which model provider are in use.
//
// `--demo` swaps the Postgres store for the in-memory one and the real provider for a canned
// analyzer, so the whole product can be driven end to end — onboarding, chat, photo, edit — with no
// database and no API key. That is not a toy: it is how the app is developed on a plane, and how a
// UI change gets reviewed without spending money on vision calls.

import {
  configDefaults, demoConfig, loadConfig, redact, type Config,
} from "./config.ts";
import { AuthError, remoteVerifier, type Verifier } from "./auth/verify.ts";
import { createRouter } from "./api/routes.ts";
import type { WebProvider, WebSignInProvider } from "./auth/web-oauth.ts";
import { demoPorts } from "./llm/demo.ts";
import { chooseMailer } from "./mail/choose.ts";
import { choosePush } from "./push/choose.ts";
import { openRouterPorts } from "./llm/openrouter.ts";
import { collectPushReceipts, eveningSweep, msUntilNextEveningLine, RECEIPT_DELAY_MS, type EngineDeps } from "./engine/index.ts";
import { localDate } from "@eait/shared";
import { memoryStore } from "./store.memory.ts";
import { postgresStore } from "./store.pg.ts";
import type { Store } from "./store.ts";

const demo = process.argv.includes("--demo");
/**
 * WHICH ANSWERS THIS SERVER SERVES, independently of which store it holds.
 *
 * `--demo` alone is the canned analyzer and the canned coach; `--demo --llm real` is the same
 * in-memory server answering with the real models, which is the one shape a browser suite needs to
 * exercise the model's own behaviour without a database or a provider console. `--llm demo` does
 * the inverse on a real server. One entry point, two kinds of answer, named rather than implied.
 */
const llmArg = ((): "demo" | "real" => {
  const i = process.argv.indexOf("--llm");
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  if (v === "demo" || v === "real") return v;
  return demo ? "demo" : "real";
})();
const cannedLlm = llmArg === "demo";

const config: Config = demo ? demoConfig() : loadConfig();

// `--demo --llm real` is the one combination the demo config cannot answer on its own: it names no
// key, because a demo server never needed one. Taken from the environment here, and refused rather
// than half-configured — a server that says it is answering with the real model and is not is worse
// than one that will not start.
if (demo && llmArg === "real") {
  const key = process.env.EAIT__BACKEND__LLM_API_KEY ?? "";
  if (key === "") {
    console.error("[eait] --llm real needs EAIT__BACKEND__LLM_API_KEY; run without it for the canned answers");
    process.exit(1);
  }
  config.llmApiKey = key;
  const d = configDefaults();
  config.llmProvider = "openrouter";
  config.llmModel = process.env.EAIT__BACKEND__LLM_MODEL ?? d.llmModel;
  config.llmChatModel = process.env.EAIT__BACKEND__LLM_CHAT_MODEL ?? d.llmChatModel;
  config.llmGlanceModel = process.env.EAIT__BACKEND__LLM_GLANCE_MODEL ?? d.llmGlanceModel;
}

// The session lifetime reaches the store the same way every other setting reaches the engine: as an
// argument from the composition root, never as a module constant either side could disagree about.
const storeOptions = { sessionTtlMs: config.sessionTtlDays * 24 * 60 * 60 * 1000 };
const store: Store = demo
  ? memoryStore(storeOptions)
  : await postgresStore(config.databaseUrl, storeOptions);

// THE ADMIN IS GRANTED HERE OR NOWHERE (#391a).
//
// Out of band, at boot, from a UUID in configuration — never from a request, and never by a
// self-service path. Idempotent on purpose: the off-site backup is restored on every deploy, so a
// grant applied once by hand would vanish under a pre-role dump and leave an instance nobody can
// administer.
//
// A LOUD FAILURE WHEN THE ID NAMES NOTHING. `setRole` creates no account, so a typo would
// otherwise be silence — and an admin nobody can sign in as reads exactly like a working one.
if (config.adminBootstrapUserId !== "") {
  const granted = await store.setRole(config.adminBootstrapUserId, "admin");
  console.log(granted
    ? `[eait] admin role held by ${config.adminBootstrapUserId}`
    : `[eait] ADMIN BOOTSTRAP FAILED: no account ${config.adminBootstrapUserId}. `
      + "Nobody has been made an admin. Sign in once to create the account, then use its user id.");
}

const mailer = chooseMailer(config, demo);
const push = choosePush(config, demo);

// One sweep at startup, so a process that has been up for months and is then restarted does not
// carry a table of rows that stopped meaning anything in between. Every later sweep rides along
// with a token being issued; there is no scheduler in this process and adding one for this would be
// the largest thing in it.
const pruned = await store.pruneExpiredTokens();
if (pruned > 0) console.log(`[eait] pruned ${pruned} idle session token(s) at startup`);
const stale = await store.pruneExpiredPendings();
if (stale > 0) console.log(`[eait] pruned ${stale} expired proposal(s) at startup`);
const deps: EngineDeps = {
  store,
  config,
  mailer,
  push,
  llm: cannedLlm
    ? demoPorts()
    : openRouterPorts({
        apiKey: config.llmApiKey,
        model: config.llmModel,
        chatModel: config.llmChatModel,
        glanceModel: config.llmGlanceModel,
        reasoningEffort: config.llmReasoningEffort,
        baseUrl: config.llmBaseUrl,
        timeoutMs: config.llmTimeoutMs,
        maxTokens: config.llmMaxTokens,
      }),
};

// In demo mode the verifier trusts a token of the form `demo:<provider>:<subject>` so the sign-in
// flows can be driven without Apple or Google credentials. It is wired ONLY under `--demo`; the
// real verifier checks signature, issuer, audience and expiry against the provider's JWKS.
const verifier: Verifier = demo
  ? {
      async verify(provider, idToken) {
        const [marker, p, subject] = idToken.split(":");
        if (marker !== "demo" || p !== provider || !subject) throw new AuthError("demo-token-invalid");
        // AN ADDRESS, BECAUSE A REAL TOKEN CARRIES ONE. Without it no demo run, no E2E flow and no
        // demo `/start` sign-in ever executes the write that stores it — the suite would be green
        // over a code path it never enters. Same rule the demo analyzer learned: a fake may be
        // POORER than the real thing, never different in a way a test can see. Derived from the
        // subject so two demo identities are two addresses, and on `example.com`, which RFC 2606
        // reserves precisely so nothing can be delivered to it.
        return { provider, subject, email: `${provider}-${subject}@example.com` };
      },
      // Not faked. Apple's notification is a signature from Apple or it is nothing, and a demo
      // server that accepted an unsigned one would be a place to develop against a check that
      // does not exist. The route is 404 anyway unless an audience is configured.
      async verifyAppleNotification() { throw new AuthError("demo-notification-unsupported"); },
    }
  : remoteVerifier({
      appleAudiences: config.appleAudiences,
      googleAudiences: config.googleAudiences,
    });

// ── The 20:30 line ───────────────────────────────────────────────────────────────────────────
//
// A timer to the NEXT occurrence, re-armed after every run, rather than a fixed 24-hour interval.
// The two differ twice a year: an interval started before a DST transition drifts an hour and stays
// drifted, so the "20:30 line" arrives at 19:30 for half the year — which nothing in any log says
// and which only the people receiving it can see.
//
// `msUntilNextEveningLine` computes it against `config.timezone` through the same date functions
// the rest of the product dates meals with.
//
// The receipts are read separately, RECEIPT_DELAY_MS after the send: Expo does not know what Apple
// did with a message at the moment it accepts it, and `DeviceNotRegistered` — the one outcome that
// drops a row — normally arrives on that second read.
if (config.pushEnabled) {
  const runSweep = async () => {
    try {
      const result = await eveningSweep(deps, { date: localDate(config.timezone) });
      if (result.tickets.length > 0) {
        setTimeout(() => {
          void collectPushReceipts(deps, result.tickets).catch((e) => {
            console.error(`[eait] push receipts failed: ${(e as Error)?.message ?? e}`);
          });
        }, RECEIPT_DELAY_MS).unref?.();
      }
    } catch (e) {
      // One bad night must not take the timer with it, or the loop stops silently until a restart.
      console.error(`[eait] evening sweep failed: ${(e as Error)?.message ?? e}`);
    }
    arm();
  };
  const arm = () => {
    const wait = msUntilNextEveningLine(config.timezone, config.eveningLineTime);
    setTimeout(() => { void runSweep(); }, wait);
    console.log(`[eait] next evening line in ${Math.round(wait / 60_000)} minute(s)`);
  };
  arm();
}

/**
 * The web onboarding's providers, canned under `--demo` for the same reason the verifier above is.
 *
 * The verifier alone was not enough to make `/start` walkable without credentials: the first thing
 * that surface does is send the browser to Google or Apple, and neither of them will authorise
 * against a client id that does not exist. So the authorize endpoint is this process's own
 * `/demo/authorize`, which bounces straight back to the callback, and the exchange returns the token
 * shape the demo verifier above accepts.
 *
 * THE SUBJECT IS THE CODE, which is what makes the flow useful rather than merely green: signing in
 * twice with the same subject is the returning user, and two subjects are two accounts. Wired ONLY
 * under `--demo`; a production process builds these from real credentials in `createRouter`.
 */
const demoProviders: Partial<Record<WebProvider, WebSignInProvider>> = {
  apple: demoProvider("apple"),
  google: demoProvider("google"),
};
function demoProvider(name: WebProvider): WebSignInProvider {
  return {
    clientId: `demo-${name}`,
    authorizeEndpoint: `http://${config.host}:${config.port}/demo/authorize`,
    extraAuthorizeParams: { provider: name },
    // Served by this process, so `/start` does not measure it against Apple's and Google's rules
    // about the origin — the thing that would refuse an http callback is Google, and Google is not
    // in this flow.
    local: true,
    async exchange(code) { return `demo:${name}:${code}`; },
  };
}

const router = createRouter(deps, store, verifier, demo ? { webProviders: demoProviders } : {});

// ── The demo-only account lookup ─────────────────────────────────────────────────────────────
//
// `GET /demo/user-id?provider=apple&subject=…` → `{ "userId": "…" }`, or 404.
//
// WHY IT EXISTS. A RevenueCat delivery names the account by OUR user id, and RevenueCat cannot
// reach a laptop — so the paywall E2E flow has to post that delivery itself, through the real
// route, past the real credential check. Nothing in the app shows a user id (deliberately: it is
// an account key, not a support code), so the flow has no way to learn which account it is in.
// This answers that, for an identity the flow itself chose a moment earlier by signing in.
//
// WHY IT IS SAFE. It is composed in HERE, under `--demo`, and `api/routes.ts` has never heard of
// it: a production process does not route this path at all, it 404s in the router like any other
// unknown one. It reads, and only a user id — which on a demo server names an in-memory account
// created by the flow itself, thirty seconds earlier, holding canned data.
const handle: typeof router = demo
  ? async (req, server) => {
      const url = new URL(req.url);

      // The canned consent screen. It echoes `state` — which is the whole of what the callback
      // checks — and hands back a code that IS the subject.
      //
      // IT ASKS WHO YOU ARE, because on a demo server the subject is the account: signing in twice
      // with the same one is the returning user, two are two accounts, and the same string under
      // both providers is TWO accounts rather than one. That is the behaviour `/start` exists to be
      // walked against, and a page that picked a fixed subject would hide all of it. `?subject=`
      // skips the form, which is what a script uses.
      if (url.pathname === "/demo/authorize") {
        const subject = url.searchParams.get("subject");
        const provider = url.searchParams.get("provider") ?? "";
        if (subject === null) {
          const hidden = ["redirect_uri", "state", "provider"].map((k) =>
            `<input type="hidden" name="${k}" value="${(url.searchParams.get(k) ?? "")
              .replace(/&/g, "&amp;").replace(/"/g, "&quot;")}">`).join("");
          return new Response(
            // The empty data: icon the other three shells carry, for the same reason: without it
            // Chrome asks this origin for /favicon.ico, `resolveUserId` answers 401 before anything
            // can 404 it, and every local sign-in leaves an error in the console. A console that
            // always has an error in it is a console nobody reads.
            `<!doctype html><meta name=viewport content="width=device-width,initial-scale=1">` +
            `<link rel="icon" href="data:,">`
            + `<body style="font:16px system-ui;max-width:22rem;margin:3rem auto">`
            + `<h1 style="font-size:1.1rem">Demo ${provider} sign-in</h1>`
            + `<p>Any string. The same one twice is the same account.</p>`
            + `<form>${hidden}<input name=subject value="demo-subject" autofocus `
            + `style="font:inherit;width:100%;padding:.5rem"><button style="font:inherit;`
            + `margin-top:.5rem;padding:.5rem 1rem">Continue</button></form>`,
            { headers: { "content-type": "text/html; charset=utf-8" } },
          );
        }
        const back = new URL(url.searchParams.get("redirect_uri") ?? "");
        back.searchParams.set("state", url.searchParams.get("state") ?? "");
        back.searchParams.set("code", subject === "" ? "demo-subject" : subject);
        return new Response(null, { status: 303, headers: { location: back.toString() } });
      }

      if (url.pathname !== "/demo/user-id") return router(req, server);
      const provider = url.searchParams.get("provider");
      const subject = url.searchParams.get("subject") ?? "";
      if ((provider !== "apple" && provider !== "google") || subject === "") {
        return new Response("bad request", { status: 400 });
      }
      const userId = await store.userIdForIdentity(provider, subject);
      return userId === null
        ? new Response("not found", { status: 404 })
        : Response.json({ userId });
    }
  : router;

const server = Bun.serve({
  port: config.port,
  // Loopback by default. A process that binds 0.0.0.0 because nobody said otherwise is how a build
  // ends up reachable from the internet before its auth has been reviewed.
  hostname: config.host,
  // The real backstop for upload size — a client can lie about or omit Content-Length, so the
  // early check in the router is a courtesy and this is the guarantee.
  maxRequestBodySize: config.maxUploadBytes + 1024 * 1024,
  // `server` is passed through so the router can fall back to the socket peer when a request has no
  // `X-Forwarded-For`. In production every request has one — Caddy is the only way in — so this is
  // the local-development path, where it is the difference between per-address limits and one
  // shared bucket called "unknown".
  fetch: (req, server) => handle(req, server),
});

// The banner NAMES both halves, because they are chosen separately now: a server that says
// "canned analyzer" while answering with a billed model is the one line nobody reads twice.
const mode = demo ? ` (demo: in-memory store, ${cannedLlm ? "canned" : "REAL, BILLED"} model)` : "";
console.log(`[eait] listening on http://${server.hostname}:${server.port}${mode}`);
console.log(`[eait] config ${JSON.stringify(redact(config))}`);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    await server.stop();
    await store.close();
    process.exit(0);
  });
}
