import { fakeMailer } from "../mail/fake.ts";
import { fakePush } from "../push/fake.ts";
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
import { AuthError, type Verifier } from "../auth/verify.ts";
import { createRouter } from "./routes.ts";
import { ADMIN_PAGE } from "./admin.page.ts";

const EAIT__BACKEND__ADMIN_TOKEN = "test-admin-token-that-is-long-enough";

const verifier: Verifier = {
  async verify() { throw new AuthError("not-used-here"); },
  async verifyAppleNotification() { throw new AuthError("not-used-here"); },
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
  const deps: EngineDeps = { store, config, llm: demoPorts(), mailer: fakeMailer(), push: fakePush() };
  handle = createRouter(deps, store, verifier);
}

const admin = (method: string, path: string, body?: unknown, token = EAIT__BACKEND__ADMIN_TOKEN) =>
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

  it("404s every admin path when EAIT__BACKEND__ADMIN_TOKEN is unset", async () => {
    // 404 rather than 403. "There is an admin here and you cannot have it" is information, and a
    // deployment that never set the variable should look like one that has no such feature.
    for (const path of ["/admin", "/admin/api/content", "/admin/api/funnel", "/admin/api/notifications"]) {
      expect((await admin("GET", path)).status).toBe(404);
    }
    expect((await admin("PUT", "/admin/api/content", { content: {} })).status).toBe(404);
  });
});

describe("the admin credential", () => {
  beforeEach(() => { mount({ ...base, adminToken: EAIT__BACKEND__ADMIN_TOKEN }); });

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
    expect((await admin("GET", "/admin/api/content", undefined, EAIT__BACKEND__ADMIN_TOKEN.slice(0, -1))).status).toBe(401);
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
  beforeEach(() => { mount({ ...base, adminToken: EAIT__BACKEND__ADMIN_TOKEN }); });

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

  it("saves the interstitials and serves them to the app", async () => {
    const content = structuredClone(DEFAULT_ONBOARDING_CONTENT);
    content.welcome.title = "Photograph dinner. Get a straight answer.";
    content.welcome.points = ["No card to start.", "No email."];
    content.building.floorLabel = "Stopped at your floor";
    content.summary.projection = "Roughly {weeks} weeks — {month}.";

    expect((await admin("PUT", "/admin/api/content", { content })).status).toBe(200);

    const token = await session();
    const res = await handle(new Request(url(ROUTES.onboarding), {
      headers: { authorization: `Bearer ${token}` },
    }));
    const body = await res.json() as { content: OnboardingContent };
    expect(body.content.welcome.title).toBe("Photograph dinner. Get a straight answer.");
    expect(body.content.welcome.points).toEqual(["No card to start.", "No email."]);
    expect(body.content.building.floorLabel).toBe("Stopped at your floor");
    expect(body.content.summary.projection).toBe("Roughly {weeks} weeks — {month}.");
  });

  it("422s an interstitial the app could not render", async () => {
    const content = structuredClone(DEFAULT_ONBOARDING_CONTENT);
    content.welcome.points = [];

    const res = await admin("PUT", "/admin/api/content", { content });
    expect(res.status).toBe(422);
    expect((await res.json() as { errors: string[] }).errors.join(" ")).toContain("welcome.points");
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
  beforeEach(() => { mount({ ...base, adminToken: EAIT__BACKEND__ADMIN_TOKEN }); });

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

// The notification copy: the same three verbs on the same credential, and the same rule that the
// validation runs on the WRITE. A lock screen is the one surface where "we will fix it in the next
// fetch" is not available — the message has already been delivered.
describe("editing the notification copy", () => {
  beforeEach(() => { mount({ ...base, adminToken: EAIT__BACKEND__ADMIN_TOKEN }); });

  it("serves the shipped copy and the placeholders the editor needs", async () => {
    const res = await admin("GET", "/admin/api/notifications");
    expect(res.status).toBe(200);
    const body = await res.json() as {
      copy: Record<string, { title: string; body: string }>;
      meta: { ids: string[]; placeholders: Record<string, string[]> };
    };
    expect(body.copy.evening!.body).toContain("{eaten}");
    expect(body.meta.ids).toEqual(["trial-day5", "trial-day6", "evening"]);
    expect(body.meta.placeholders["evening.body"]).toEqual(["eaten", "plan", "tomorrow"]);
  });

  it("saves a rewrite", async () => {
    const current = await (await admin("GET", "/admin/api/notifications")).json() as { copy: Record<string, unknown> };
    const copy = { ...current.copy, "trial-day5": { title: "Two days to go", body: "Two days before the free week ends." } };
    expect((await admin("PUT", "/admin/api/notifications", { copy })).status).toBe(200);
    const after = await (await admin("GET", "/admin/api/notifications")).json() as { copy: Record<string, { title: string }> };
    expect(after.copy["trial-day5"]!.title).toBe("Two days to go");
  });

  it("422s a template the composer cannot fill, with every reason", async () => {
    const current = await (await admin("GET", "/admin/api/notifications")).json() as { copy: Record<string, unknown> };
    const res = await admin("PUT", "/admin/api/notifications", {
      copy: { ...current.copy, evening: { title: "Evening", body: "{weight} today.", emptyBody: "Nothing." } },
    });
    expect(res.status).toBe(422);
    const { errors } = await res.json() as { errors: string[] };
    expect(errors.length).toBeGreaterThan(1);
    expect(errors.join(" ")).toContain("{weight}");
  });

  it("422s a health claim rather than putting one on a lock screen", async () => {
    const current = await (await admin("GET", "/admin/api/notifications")).json() as { copy: Record<string, unknown> };
    const res = await admin("PUT", "/admin/api/notifications", {
      copy: { ...current.copy, "trial-day6": { title: "Last day", body: "One more week and this cures it." } },
    });
    expect(res.status).toBe(422);
    expect((await res.json() as { errors: string[] }).errors.join(" ")).toContain("claim");
  });

  it("restores the shipped copy", async () => {
    const current = await (await admin("GET", "/admin/api/notifications")).json() as { copy: Record<string, unknown> };
    await admin("PUT", "/admin/api/notifications", {
      copy: { ...current.copy, "trial-day5": { title: "Edited", body: "Edited body." } },
    });
    expect((await admin("POST", "/admin/api/notifications/reset", {})).status).toBe(200);
    const after = await (await admin("GET", "/admin/api/notifications")).json() as { copy: Record<string, { title: string }> };
    expect(after.copy["trial-day5"]!.title).toBe("Two days left");
  });

  it("refuses an ordinary user's bearer token here too", async () => {
    const token = await session();
    const res = await handle(new Request(url("/admin/api/notifications"), {
      headers: { authorization: `Bearer ${token}` },
    }));
    expect(res.status).toBe(401);
  });
});

// The page is a string, so nothing typechecks it and nothing runs it. A syntax error in that
// script serves a 200 and an admin surface that does nothing at all, and the only symptom is a
// console message in one browser. These two assertions are what stands in for a bundler.
describe("the admin page", () => {
  it("parses as JavaScript", () => {
    const script = /<script>([\s\S]*?)<\/script>/.exec(ADMIN_PAGE)?.[1];
    expect(script).toBeTruthy();
    // Parses without executing — there is no DOM here, and a parse is what this is checking.
    expect(() => new Function(script!)).not.toThrow();
  });

  it("only reaches for elements that exist on it", () => {
    const ids = new Set(Array.from(ADMIN_PAGE.matchAll(/id="([\w-]+)"/g), (m) => m[1]!));
    const wanted = Array.from(ADMIN_PAGE.matchAll(/\$\("([\w-]+)"\)/g), (m) => m[1]!);
    expect(wanted.length).toBeGreaterThan(10);
    expect([...new Set(wanted)].filter((id) => !ids.has(id))).toEqual([]);
  });
});
