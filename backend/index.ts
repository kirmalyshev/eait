// Composition root. The only file allowed to know which store and which model provider are in use.
//
// `--demo` swaps the Postgres store for the in-memory one and the real provider for a canned
// analyzer, so the whole product can be driven end to end — onboarding, chat, photo, edit — with no
// database and no API key. That is not a toy: it is how the app is developed on a plane, and how a
// UI change gets reviewed without spending money on vision calls.

import {
  demoConfig, loadConfig, redact, type Config,
} from "./config.ts";
import { AuthError, remoteVerifier, type Verifier } from "./auth/verify.ts";
import { createRouter } from "./api/routes.ts";
import { demoPorts } from "./llm/demo.ts";
import { chooseMailer } from "./mail/choose.ts";
import { choosePush } from "./push/choose.ts";
import { openRouterPorts } from "./llm/openrouter.ts";
import { collectPushReceipts, eveningSweep, msUntilNextEveningLine, RECEIPT_DELAY_MS, type EngineDeps } from "./engine/index.ts";
import { localDate } from "@ieat/shared";
import { memoryStore } from "./store.memory.ts";
import { postgresStore } from "./store.pg.ts";
import type { Store } from "./store.ts";

const demo = process.argv.includes("--demo");

const config: Config = demo ? demoConfig() : loadConfig();

// The session lifetime reaches the store the same way every other setting reaches the engine: as an
// argument from the composition root, never as a module constant either side could disagree about.
const storeOptions = { sessionTtlMs: config.sessionTtlDays * 24 * 60 * 60 * 1000 };
const store: Store = demo
  ? memoryStore(storeOptions)
  : await postgresStore(config.databaseUrl, storeOptions);

const mailer = chooseMailer(config, demo);
const push = choosePush(config, demo);

// One sweep at startup, so a process that has been up for months and is then restarted does not
// carry a table of rows that stopped meaning anything in between. Every later sweep rides along
// with a token being issued; there is no scheduler in this process and adding one for this would be
// the largest thing in it.
const pruned = await store.pruneExpiredTokens();
if (pruned > 0) console.log(`[ieat] pruned ${pruned} idle session token(s) at startup`);
const stale = await store.pruneExpiredPendings();
if (stale > 0) console.log(`[ieat] pruned ${stale} expired proposal(s) at startup`);
const deps: EngineDeps = {
  store,
  config,
  mailer,
  push,
  llm: demo
    ? demoPorts()
    : openRouterPorts({
        apiKey: config.llmApiKey,
        model: config.llmModel,
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
        return { provider, subject };
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
            console.error(`[ieat] push receipts failed: ${(e as Error)?.message ?? e}`);
          });
        }, RECEIPT_DELAY_MS).unref?.();
      }
    } catch (e) {
      // One bad night must not take the timer with it, or the loop stops silently until a restart.
      console.error(`[ieat] evening sweep failed: ${(e as Error)?.message ?? e}`);
    }
    arm();
  };
  const arm = () => {
    const wait = msUntilNextEveningLine(config.timezone, config.eveningLineTime);
    setTimeout(() => { void runSweep(); }, wait);
    console.log(`[ieat] next evening line in ${Math.round(wait / 60_000)} minute(s)`);
  };
  arm();
}

const router = createRouter(deps, store, verifier);

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

console.log(`[ieat] listening on http://${server.hostname}:${server.port}${demo ? " (demo: in-memory store, canned analyzer)" : ""}`);
console.log(`[ieat] config ${JSON.stringify(redact(config))}`);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    await server.stop();
    await store.close();
    process.exit(0);
  });
}
