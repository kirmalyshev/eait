// Composition root. The only file allowed to know which store and which model provider are in use.
//
// `--demo` swaps the Postgres store for the in-memory one and the real provider for a canned
// analyzer, so the whole product can be driven end to end — onboarding, chat, photo, edit — with no
// database and no API key. That is not a toy: it is how the app is developed on a plane, and how a
// UI change gets reviewed without spending money on vision calls.

import { adminTokenFromEnv, configDefaults, loadConfig, redact, type Config } from "./config.ts";
import { AuthError, remoteVerifier, type Verifier } from "./auth/verify.ts";
import { createRouter } from "./api/routes.ts";
import { demoPorts } from "./llm/demo.ts";
import { chooseMailer } from "./mail/choose.ts";
import { openRouterPorts } from "./llm/openrouter.ts";
import type { EngineDeps } from "./engine/index.ts";
import { memoryStore } from "./store.memory.ts";
import { postgresStore } from "./store.pg.ts";
import type { Store } from "./store.ts";

const demo = process.argv.includes("--demo");

// Demo starts from the shared defaults and overrides only what demo mode changes, so a new
// setting picks up its default here instead of being silently absent.
const config: Config = demo
  ? {
      ...configDefaults(),
      port: Number(process.env.EAIT__BACKEND__PORT ?? 8787),
      host: process.env.EAIT__BACKEND__HOST ?? "127.0.0.1",
      databaseUrl: "memory://demo",
      llmProvider: "demo", llmModel: "demo", llmApiKey: "unused",
      // No paywall in the demo — the E2E flows log several meals per account — and unmetered
      // globally: it is a local demo, not a public instance. The sheet itself is exercised against
      // RevenueCat's Test Store, not here.
      freeAnalyses: 100_000, globalDailyAnalysisCap: 0,
      timezone: process.env.EAIT__BACKEND__TZ_NAME ?? "Europe/Berlin",
      // Read from the environment here too, and validated by the same function: the admin is how
      // onboarding copy is edited, and "works in demo, untested in production" is the shape of
      // every configuration bug that ships.
      adminToken: adminTokenFromEnv(),
      // Same argument. The subscribe form's redirect is the one behaviour that cannot be checked
      // by reading the code — you have to POST the form and watch where the browser goes — and a
      // demo that always answered JSON would make that untestable outside production.
      landingUrl: (process.env.EAIT__BACKEND__LANDING_URL ?? "").replace(/\/$/, ""),
    }
  : loadConfig();

// The session lifetime reaches the store the same way every other setting reaches the engine: as an
// argument from the composition root, never as a module constant either side could disagree about.
const storeOptions = { sessionTtlMs: config.sessionTtlDays * 24 * 60 * 60 * 1000 };
const store: Store = demo
  ? memoryStore(storeOptions)
  : await postgresStore(config.databaseUrl, storeOptions);

const mailer = chooseMailer(config, demo);

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
  llm: demo
    ? demoPorts()
    : openRouterPorts({
        apiKey: config.llmApiKey,
        model: config.llmModel,
        baseUrl: config.llmBaseUrl,
        timeoutMs: config.llmTimeoutMs,
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

const handle = createRouter(deps, store, verifier);

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
