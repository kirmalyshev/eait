import { afterAll, describe, expect, test } from "bun:test";
import { startApi } from "./server.ts";
import { cleanupTestDbs, freshTestDb } from "../testutil.ts";
import type { Config } from "../config.ts";
import type { EngineDeps } from "../engine/index.ts";

afterAll(cleanupTestDbs, 60_000);

const cfg: Config = {
  telegramBotToken: "x", openrouterApiKey: "x", llmProvider: "openrouter", llmModel: "test",
  llmTimeoutMs: 1000, tz: "Europe/Berlin",
  pg: { host: "127.0.0.1", port: 5439, user: "eait", password: "eait", database: "unused" },
  perUserDailyPhotoCap: 5, adminUserId: null, allowedUserIds: null, globalDailyAnalysisCap: null,
  replyFormat: "plain", apiPort: null, apiHost: "127.0.0.1",
};

async function deps(): Promise<EngineDeps> {
  return {
    db: await freshTestDb(), config: cfg,
    analyzePhoto: async () => { throw new Error("unused"); },
    routeText: async () => { throw new Error("unused"); },
    classifyRestrictions: async () => [],
  };
}

describe("startApi", () => {
  test("returns null when no port is configured — the API is OPT-IN", async () => {
    // An instance that has always been long-polling-only must not begin listening on a port
    // because it was upgraded. Opening a socket is never a silent default.
    expect(startApi(await deps(), () => 1, { apiPort: null, apiHost: "127.0.0.1" })).toBeNull();
  });

  test("serves /health and refuses everything else without a session", async () => {
    // `resolveUserId` returning null is what startBot passes today: no auth scheme is wired, so the
    // API must be obviously closed rather than accidentally open.
    const api = startApi(await deps(), () => null, { apiPort: 0, apiHost: "127.0.0.1" })!;
    try {
      expect(api.port).toBeGreaterThan(0); // port 0 = OS-assigned, so tests never collide
      const base = `http://127.0.0.1:${api.port}`;
      expect((await fetch(`${base}/health`)).status).toBe(200);
      expect((await fetch(`${base}/v1/diary/day`)).status).toBe(401);
    } finally {
      await api.stop();
    }
  });

  test("binds the CONFIGURED host — loopback unless asked otherwise", async () => {
    // A process that binds 0.0.0.0 because nobody said otherwise is how a build with no auth ends
    // up reachable from the internet. Asserted on the bound hostname rather than by probing
    // 0.0.0.0: on a dev machine that address routes to loopback anyway, so a network probe cannot
    // tell a loopback bind from a wildcard one and would pass either way.
    const a = startApi(await deps(), () => null, { apiPort: 0, apiHost: "127.0.0.1" })!;
    try {
      expect(a.hostname).toBe("127.0.0.1");
    } finally {
      await a.stop();
    }
    // And the config is genuinely honoured, not hardcoded loopback.
    const b = startApi(await deps(), () => null, { apiPort: 0, apiHost: "0.0.0.0" })!;
    try {
      expect(b.hostname).toBe("0.0.0.0");
    } finally {
      await b.stop();
    }
  });

  test("stop() actually closes the socket", async () => {
    const api = startApi(await deps(), () => null, { apiPort: 0, apiHost: "127.0.0.1" })!;
    const port = api.port;
    await api.stop();
    await expect(fetch(`http://127.0.0.1:${port}/health`)).rejects.toThrow();
  });
});
