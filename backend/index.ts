// Composition root. The only file allowed to know which store and which model provider are in use.
//
// `--demo` swaps the Postgres store for the in-memory one and the real provider for a canned
// analyzer, so the whole product can be driven end to end — onboarding, chat, photo, edit — with no
// database and no API key. That is not a toy: it is how the app is developed on a plane, and how a
// UI change gets reviewed without spending money on vision calls.

import { MAX_UPLOAD_BYTES } from "@ieat/shared";
import { loadConfig, redact, type Config } from "./config.ts";
import { AuthError, remoteVerifier, type IdentityVerifier } from "./auth/verify.ts";
import { createRouter } from "./api/routes.ts";
import { demoPorts } from "./llm/demo.ts";
import { openRouterPorts } from "./llm/openrouter.ts";
import type { EngineDeps } from "./engine/index.ts";
import { memoryStore } from "./store.memory.ts";
import { postgresStore } from "./store.pg.ts";
import type { Store } from "./store.ts";

const demo = process.argv.includes("--demo");

const config: Config = demo
  ? {
      port: Number(process.env.PORT ?? 8787),
      host: process.env.HOST ?? "127.0.0.1",
      databaseUrl: "memory://demo",
      llmProvider: "demo", llmModel: "demo", llmApiKey: "unused",
      userDailyPhotoCap: 100, globalDailyAnalysisCap: 0,
      timezone: process.env.TZ_NAME ?? "Europe/Berlin",
      appleAudiences: [], googleAudiences: [],
    }
  : loadConfig();

const store: Store = demo ? memoryStore() : await postgresStore(config.databaseUrl);
const deps: EngineDeps = {
  store,
  config,
  llm: demo
    ? demoPorts()
    : openRouterPorts({ apiKey: config.llmApiKey, model: config.llmModel }),
};

// In demo mode the verifier trusts a token of the form `demo:<provider>:<subject>` so the sign-in
// flows can be driven without Apple or Google credentials. It is wired ONLY under `--demo`; the
// real verifier checks signature, issuer, audience and expiry against the provider's JWKS.
const verifier: IdentityVerifier = demo
  ? {
      async verify(provider, idToken) {
        const [marker, p, subject] = idToken.split(":");
        if (marker !== "demo" || p !== provider || !subject) throw new AuthError("demo-token-invalid");
        return { provider, subject };
      },
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
  maxRequestBodySize: MAX_UPLOAD_BYTES + 1024 * 1024,
  fetch: handle,
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
