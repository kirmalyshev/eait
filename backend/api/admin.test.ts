// The onboarding API, and the admin behind it.
//
// This file is mostly about who is allowed to do what. The admin edits the first thing every new
// user reads, on a route that sits in the same process as the user API, so the tests that matter
// are the ones proving the two authorities do not overlap: an ordinary session token must be worth
// exactly nothing here, and an unconfigured deployment must not have this surface at all.

import { beforeEach, describe, expect, it } from "bun:test";
import { DEFAULT_ONBOARDING_CONTENT, ROUTES, type OnboardingContent } from "@ieat/shared";
import { configDefaults, type Config } from "../config.ts";
import { demoPorts } from "../llm/demo.ts";
import { memoryStore } from "../store.memory.ts";
import type { Store } from "../store.ts";
import type { EngineDeps } from "../engine/index.ts";
import { AuthError, type IdentityVerifier } from "../auth/verify.ts";
import { createRouter } from "./routes.ts";

const ADMIN_TOKEN = "test-admin-token-that-is-long-enough";

const verifier: IdentityVerifier = {
  async verify() { throw new AuthError("not-used-here"); },
};

const base: Config = {
  ...configDefaults(),
  port: 0, databaseUrl: "memory://test",
  llmProvider: "demo", llmModel: "demo", llmApiKey: "unused",
};

let store: Store;
let handle: (req: Request) => Promise<Response>;

const url = (p: string) => `http://localhost${p}`;

function mount(config: Config) {
  store = memoryStore();
  const deps: EngineDeps = { store, config, llm: demoPorts() };
  handle = createRouter(deps, store, verifier);
}

const admin = (method: string, path: string, body?: unknown, token = ADMIN_TOKEN) =>
  handle(new Request(url(path), {
    method,
    headers: {
      "content-type": "application/json",
      ...(token === "" ? {} : { "x-admin-token": token }),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  }));

/** A device session — an ordinary user's bearer token. */
async function session(): Promise<string> {
  const res = await handle(new Request(url(ROUTES.authDevice), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ deviceId: crypto.randomUUID() + crypto.randomUUID(), locale: "en" }),
  }));
  return (await res.json() as { token: string }).token;
}

describe("the admin is off unless configured", () => {
  beforeEach(() => { mount(base); });

  it("404s every admin path when ADMIN_TOKEN is unset", async () => {
    // 404 rather than 403. "There is an admin here and you cannot have it" is information, and a
    // deployment that never set the variable should look like one that has no such feature.
    for (const path of ["/admin", "/admin/api/content", "/admin/api/funnel"]) {
      expect((await admin("GET", path)).status).toBe(404);
    }
    expect((await admin("PUT", "/admin/api/content", { content: {} })).status).toBe(404);
  });
});

describe("the admin credential", () => {
  beforeEach(() => { mount({ ...base, adminToken: ADMIN_TOKEN }); });

  it("serves the page without a token, because the page is where you type one", async () => {
    const res = await admin("GET", "/admin", undefined, "");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    // Inline-only, so a future edit that reaches for a CDN fails here rather than quietly shipping
    // a third party the token typed into this form.
    expect(res.headers.get("content-security-policy")).toContain("default-src 'none'");
  });

  it("refuses the API without a token", async () => {
    expect((await admin("GET", "/admin/api/content", undefined, "")).status).toBe(401);
  });

  it("refuses a wrong token", async () => {
    expect((await admin("GET", "/admin/api/content", undefined, "wrong")).status).toBe(401);
    // Including one that is a prefix of the real thing — the comparison is constant-time, and this
    // asserts the behaviour rather than the timing.
    expect((await admin("GET", "/admin/api/content", undefined, ADMIN_TOKEN.slice(0, -1))).status).toBe(401);
  });

  it("refuses an ordinary user's bearer token", async () => {
    // THE ONE THAT MATTERS. Two authorities in one process: if a session token reached this, every
    // user of the app could rewrite the onboarding every other user reads.
    const token = await session();
    const res = await handle(new Request(url("/admin/api/content"), {
      headers: { authorization: `Bearer ${token}` },
    }));
    expect(res.status).toBe(401);
  });

  it("accepts the right one", async () => {
    const res = await admin("GET", "/admin/api/content");
    expect(res.status).toBe(200);
    const body = await res.json() as { content: OnboardingContent; meta: { moods: string[] } };
    expect(body.content.screens).toHaveLength(DEFAULT_ONBOARDING_CONTENT.screens.length);
    // The editor needs the vocabulary in order to render the right controls.
    expect(body.meta.moods.length).toBeGreaterThan(0);
  });
});

describe("editing the copy", () => {
  beforeEach(() => { mount({ ...base, adminToken: ADMIN_TOKEN }); });

  it("saves a rewrite and serves it to the app", async () => {
    const content = structuredClone(DEFAULT_ONBOARDING_CONTENT);
    content.screens.find((s) => s.id === "goal")!.title = "What brings you here?";
    content.screens.find((s) => s.id === "goal")!.mascot.line = "One tap and we're moving.";

    expect((await admin("PUT", "/admin/api/content", { content })).status).toBe(200);

    // Read back through the APP's route, unauthenticated by the admin token — this is the whole
    // loop, and it is the half that a test of the admin alone would not cover.
    const token = await session();
    const res = await handle(new Request(url(ROUTES.onboarding), {
      headers: { authorization: `Bearer ${token}` },
    }));
    const body = await res.json() as { content: OnboardingContent };
    expect(body.content.screens.find((s) => s.id === "goal")!.title).toBe("What brings you here?");
    expect(body.content.version).toBe(DEFAULT_ONBOARDING_CONTENT.version + 1);
  });

  it("422s a save that would break the app, with every reason", async () => {
    const content = structuredClone(DEFAULT_ONBOARDING_CONTENT);
    content.screens.find((s) => s.id === "activity")!.enabled = false;
    content.screens.find((s) => s.id === "goal")!.title = "";

    const res = await admin("PUT", "/admin/api/content", { content });
    expect(res.status).toBe(422);
    const { errors } = await res.json() as { errors: string[] };
    expect(errors.length).toBeGreaterThan(1);
    expect(errors.join(" ")).toContain("calorie target");
  });

  it("restores the shipped copy", async () => {
    const content = structuredClone(DEFAULT_ONBOARDING_CONTENT);
    content.screens[0]!.title = "Regrettable";
    await admin("PUT", "/admin/api/content", { content });

    const res = await admin("POST", "/admin/api/content/reset", {});
    expect(res.status).toBe(200);
    const body = await res.json() as { content: OnboardingContent };
    expect(body.content.screens[0]!.title).toBe(DEFAULT_ONBOARDING_CONTENT.screens[0]!.title);
  });
});

describe("the app's onboarding routes", () => {
  beforeEach(() => { mount({ ...base, adminToken: ADMIN_TOKEN }); });

  it("needs a session", async () => {
    expect((await handle(new Request(url(ROUTES.onboarding)))).status).toBe(401);
    expect((await handle(new Request(url(ROUTES.onboardingEvents), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ events: [] }),
    }))).status).toBe(401);
  });

  it("serves content before onboarding is complete", async () => {
    // 403 `not-onboarded` guards the diary and the profile. It must NOT guard this: the copy is
    // what a user needs in order to onboard at all, and gating it would be a deadlock.
    const token = await session();
    const res = await handle(new Request(url(ROUTES.onboarding), {
      headers: { authorization: `Bearer ${token}` },
    }));
    expect(res.status).toBe(200);
  });

  it("accepts a batch of events and reports what was new", async () => {
    const token = await session();
    const send = (events: unknown[]) => handle(new Request(url(ROUTES.onboardingEvents), {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ events }),
    }));

    const e = {
      id: "e1", sessionId: "s", place: "goal", action: "view",
      contentVersion: 1, at: new Date().toISOString(),
    };
    expect(await (await send([e])).json()).toEqual({ accepted: 1 });
    // The retry the app makes when it could not confirm the first attempt.
    expect(await (await send([e])).json()).toEqual({ accepted: 0 });
  });

  it("does not 400 on a malformed batch", async () => {
    // Forgiving on purpose. A rejected batch is an app that retries forever, and the funnel then
    // has a hole exactly where the users on bad connections were.
    const token = await session();
    const res = await handle(new Request(url(ROUTES.onboardingEvents), {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ events: [{ nonsense: true }, "string", 5] }),
    }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ accepted: 0 });
  });
});
