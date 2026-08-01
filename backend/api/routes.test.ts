import { beforeEach, describe, expect, it } from "bun:test";
import { ROUTES } from "@ieat/shared";
import type { Config } from "../config.ts";
import { demoPorts } from "../llm/demo.ts";
import { memoryStore } from "../store.memory.ts";
import type { Store } from "../store.ts";
import type { EngineDeps } from "../engine/index.ts";
import { createRouter } from "./routes.ts";

const CONFIG: Config = {
  port: 0, host: "127.0.0.1", databaseUrl: "memory://test",
  llmProvider: "demo", llmModel: "demo", llmApiKey: "unused",
  userDailyPhotoCap: 5, globalDailyAnalysisCap: 0, timezone: "Europe/Berlin",
};

let store: Store;
let handle: (req: Request) => Promise<Response>;

const url = (p: string) => `http://localhost${p}`;

const post = (p: string, body: unknown, token?: string) =>
  handle(new Request(url(p), {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  }));

const patch = (p: string, body: unknown, token: string) =>
  handle(new Request(url(p), {
    method: "PATCH",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  }));

const get = (p: string, token?: string) =>
  handle(new Request(url(p), { headers: token ? { authorization: `Bearer ${token}` } : {} }));

/** Register a device and complete onboarding. Returns the bearer token. */
async function session(): Promise<string> {
  const res = await post(ROUTES.authDevice, { deviceId: crypto.randomUUID() + crypto.randomUUID(), locale: "en-GB" });
  const { token } = await res.json() as { token: string };
  await patch(ROUTES.profile, {
    goal: "lose", sex: "female", birth_year: 1990, height_cm: 165, weight_kg: 70,
    target_weight_kg: 65, activity: "moderate", pace: "steady", country: "gb",
    restrictions: [], complete_onboarding: true,
  }, token);
  return token;
}

/** A multipart photo upload. */
function photoRequest(token: string, files = 1, caption?: string): Request {
  const form = new FormData();
  for (let i = 0; i < files; i++) {
    form.append("photo", new File([new Uint8Array(64).fill(i + 1)], `m${i}.jpg`, { type: "image/jpeg" }));
  }
  if (caption) form.append("caption", caption);
  return new Request(url(ROUTES.photo), {
    method: "POST", headers: { authorization: `Bearer ${token}` }, body: form,
  });
}

beforeEach(() => {
  store = memoryStore();
  const deps: EngineDeps = { store, config: CONFIG, llm: demoPorts() };
  handle = createRouter(deps, store);
});

describe("auth", () => {
  it("serves health without a token — a probe that needs a session cannot tell dead from expired", async () => {
    const res = await get(ROUTES.health);
    expect(res.status).toBe(200);
  });

  it("401s every other route without a token", async () => {
    for (const p of [ROUTES.profile, ROUTES.day, ROUTES.week]) {
      expect((await get(p)).status).toBe(401);
    }
    expect((await post(ROUTES.messages, { text: "hi" })).status).toBe(401);
  });

  it("401s a token that was never issued", async () => {
    expect((await get(ROUTES.profile, "not-a-real-token")).status).toBe(401);
  });

  it("rejects a short device id — a guessable one is an impersonatable one", async () => {
    const res = await post(ROUTES.authDevice, { deviceId: "short" });
    expect(res.status).toBe(400);
  });

  it("returns created=true once, then false for the same device", async () => {
    const deviceId = crypto.randomUUID() + crypto.randomUUID();
    const first = await (await post(ROUTES.authDevice, { deviceId })).json() as { created: boolean; userId: string };
    const second = await (await post(ROUTES.authDevice, { deviceId })).json() as { created: boolean; userId: string };
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.userId).toBe(first.userId);
  });

  it("narrows an unsupported locale to en rather than 400-ing the first request the app makes", async () => {
    const res = await post(ROUTES.authDevice, { deviceId: crypto.randomUUID() + crypto.randomUUID(), locale: "ja-JP" });
    const { token } = await res.json() as { token: string };
    const view = await (await get(ROUTES.profile, token)).json() as { profile: { lang: string } };
    expect(view.profile.lang).toBe("en");
  });
});

describe("profile", () => {
  it("422s a target weight below the healthy band, with the minimum it would take", async () => {
    const res = await post(ROUTES.authDevice, { deviceId: crypto.randomUUID() + crypto.randomUUID() });
    const { token } = await res.json() as { token: string };
    await patch(ROUTES.profile, { height_cm: 170 }, token);
    const bad = await patch(ROUTES.profile, { target_weight_kg: 40 }, token);
    expect(bad.status).toBe(422);
    const body = await bad.json() as { reason: string; minHealthyKg: number };
    expect(body.reason).toBe("target-weight-below-healthy-bmi");
    expect(body.minHealthyKg).toBe(54);
  });

  it("returns the target basis so the app can explain the number", async () => {
    const token = await session();
    const view = await (await get(ROUTES.profile, token)).json() as {
      targets: { kcal: number }; basis: { tdee: number; floorApplied: boolean }; onboarded: boolean;
    };
    expect(view.onboarded).toBe(true);
    expect(view.basis.tdee).toBeGreaterThan(0);
    expect(view.targets.kcal).toBeGreaterThanOrEqual(1200);
  });
});

describe("photo", () => {
  it("logs one meal from several angles of it", async () => {
    const token = await session();
    const res = await handle(photoRequest(token, 3, "flat white and a pastry"));
    expect(res.status).toBe(200);
    const body = await res.json() as { kind: string; mealId: string };
    expect(body.kind).toBe("logged");

    const dayView = await (await get(ROUTES.day, token)).json() as { meals: unknown[] };
    expect(dayView.meals).toHaveLength(1); // one meal, not three
  });

  it("400s an upload with no photo part", async () => {
    const token = await session();
    const res = await handle(new Request(url(ROUTES.photo), {
      method: "POST", headers: { authorization: `Bearer ${token}` }, body: new FormData(),
    }));
    expect(res.status).toBe(400);
  });

  it("400s more photos than one meal can plausibly have", async () => {
    const token = await session();
    expect((await handle(photoRequest(token, 9))).status).toBe(400);
  });

  it("413s an oversized declared body before parsing it", async () => {
    const token = await session();
    const res = await handle(new Request(url(ROUTES.photo), {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-length": String(50 * 1024 * 1024) },
      body: new FormData(),
    }));
    expect(res.status).toBe(413);
  });

  it("429s with a scope once the per-user cap is spent", async () => {
    const token = await session();
    const deps: EngineDeps = { store, config: { ...CONFIG, userDailyPhotoCap: 1 }, llm: demoPorts() };
    handle = createRouter(deps, store);
    await handle(photoRequest(token));
    const res = await handle(photoRequest(token));
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "cap-exceeded", scope: "user" });
  });

  it("403s, not 401s, before onboarding — a 401 sends the client into a refresh loop it cannot win", async () => {
    const res = await post(ROUTES.authDevice, { deviceId: crypto.randomUUID() + crypto.randomUUID() });
    const { token } = await res.json() as { token: string };
    expect((await handle(photoRequest(token))).status).toBe(403);
  });
});

describe("chat and editing", () => {
  it("proposes, then logs on confirm", async () => {
    const token = await session();
    const proposed = await (await post(ROUTES.messages, { text: "two eggs and toast" }, token)).json() as
      { kind: string; pendingId: string };
    expect(proposed.kind).toBe("proposed");

    const confirmed = await (await post(ROUTES.pendingConfirm(proposed.pendingId), {}, token)).json() as { kind: string };
    expect(confirmed.kind).toBe("logged");
  });

  it("410s a confirm for a pending meal that is already gone", async () => {
    const token = await session();
    expect((await post(ROUTES.pendingConfirm(crypto.randomUUID()), {}, token)).status).toBe(410);
  });

  it("400s an empty message rather than spending a model call on it", async () => {
    const token = await session();
    expect((await post(ROUTES.messages, { text: "   " }, token)).status).toBe(400);
  });

  it("edits a logged meal and recomputes its totals", async () => {
    const token = await session();
    const meal = await (await handle(photoRequest(token))).json() as { mealId: string };
    const res = await patch(ROUTES.meal(meal.mealId), { kcal: 321 }, token);
    expect(res.status).toBe(200);
    const body = await res.json() as { kind: string; analysis: { kcal: number }; totals: { kcal: number } };
    expect(body.kind).toBe("updated");
    expect(body.analysis.kcal).toBe(321);
    expect(body.totals.kcal).toBe(321);
  });

  it("ignores a client trying to paint its own verdicts on", async () => {
    // `EditMealRequest` has no `verdicts` field, but a client is not a type — it is JSON. The
    // engine recomputes from the user's caps regardless, which is what makes the rule real.
    const token = await session();
    const meal = await (await handle(photoRequest(token))).json() as { mealId: string };
    const body = await (await patch(
      ROUTES.meal(meal.mealId),
      { kcal: 9000, verdicts: { weight: "good", ldl: "good", kidneys: "good" } },
      token,
    )).json() as { analysis: { verdicts: Record<string, string> } };
    expect(body.analysis.verdicts.weight).toBe("bad"); // 9000 kcal is not "good"
    expect(body.analysis.verdicts.ldl).toBeUndefined(); // never declared
    expect(body.analysis.verdicts.kidneys).toBeUndefined();
  });

  it("409s an edit whose meal does not exist", async () => {
    const token = await session();
    const res = await patch(ROUTES.meal(crypto.randomUUID()), { kcal: 1 }, token);
    expect(res.status).toBe(409);
  });

  it("cannot reach another session's meal", async () => {
    const a = await session();
    const b = await session();
    const meal = await (await handle(photoRequest(a))).json() as { mealId: string };
    expect((await patch(ROUTES.meal(meal.mealId), { kcal: 1 }, b)).status).toBe(409);
  });
});

describe("diary", () => {
  it("400s a date that is not a calendar date", async () => {
    const token = await session();
    expect((await get(`${ROUTES.day}?date=2026-02-31`, token)).status).toBe(400);
    expect((await get(`${ROUTES.day}?date=nope`, token)).status).toBe(400);
  });

  it("400s an out-of-range week window", async () => {
    const token = await session();
    expect((await get(`${ROUTES.week}?days=0`, token)).status).toBe(400);
    expect((await get(`${ROUTES.week}?days=900`, token)).status).toBe(400);
  });
});

describe("erasure", () => {
  it("deletes the account and invalidates its token", async () => {
    const token = await session();
    await handle(photoRequest(token));
    const res = await handle(new Request(url(ROUTES.account), {
      method: "DELETE", headers: { authorization: `Bearer ${token}` },
    }));
    expect(res.status).toBe(200);
    // The token is gone with the row, so the session cannot outlive the erasure.
    expect((await get(ROUTES.profile, token)).status).toBe(401);
  });
});

describe("errors", () => {
  it("404s an unknown path", async () => {
    const token = await session();
    expect((await get("/v1/nope", token)).status).toBe(404);
  });

  it("never returns an internal error message to the client", async () => {
    const exploding: EngineDeps = {
      store, config: CONFIG,
      llm: { ...demoPorts(), routeText: async () => { throw new Error("secret query text"); } },
    };
    const token = await session();
    handle = createRouter(exploding, store);
    const res = await post(ROUTES.messages, { text: "hello" }, token);
    const body = JSON.stringify(await res.json());
    expect(body).not.toContain("secret query text");
  });
});
