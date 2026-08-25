import { beforeEach, describe, expect, it } from "bun:test";
import { MAX_CLIENT_ID, MAX_USER_LINE, MAX_HEALTH_DAYS_PER_BATCH, ROUTES, emptyHealthDay, localDate } from "@ieat/shared";
import { configDefaults, type Config } from "../config.ts";
import { demoPorts } from "../llm/demo.ts";
import { memoryStore } from "../store.memory.ts";
import type { Store } from "../store.ts";
import type { EngineDeps } from "../engine/index.ts";
import { AuthError, type Verifier } from "../auth/verify.ts";
import { createRouter } from "./routes.ts";
import { fakeMailer } from "../mail/fake.ts";
import { fakePush } from "../push/fake.ts";

/**
 * A stand-in verifier. Accepts `ok:<provider>:<subject>` and rejects everything else.
 *
 * Signature/issuer/audience verification is the provider libraries' job and is not what these
 * tests are about — what IS tested here is the link/merge/switch logic that runs on the far side
 * of a successful verification, which is where this product's own bugs would live.
 */
const testVerifier: Verifier = {
  async verify(provider, idToken, nonce) {
    const [marker, p, subject] = idToken.split(":");
    if (marker !== "ok" || p !== provider || !subject) throw new AuthError("invalid");
    if (nonce !== undefined && nonce !== "good-nonce") throw new AuthError("nonce-mismatch");
    return { provider, subject };
  },
  // Apple's server-to-server notifications have their own suite against the REAL verifier and a
  // real key set — `apple-notifications.test.ts`. A fake here would prove nothing about them.
  async verifyAppleNotification() { throw new AuthError("not-in-these-tests"); },
};

const CONFIG: Config = {
  ...configDefaults(),
  port: 0, databaseUrl: "memory://test",
  llmProvider: "demo", llmModel: "demo", llmApiKey: "unused",
  freeAnalyses: 5, globalDailyAnalysisCap: 0,
  appleAudiences: ["app.ieat"], googleAudiences: ["test.apps.googleusercontent.com"],
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

const del = (p: string, body: unknown, token?: string) =>
  handle(new Request(url(p), {
    method: "DELETE",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
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
  const deps: EngineDeps = { store, config: CONFIG, llm: demoPorts(), mailer: fakeMailer(), push: fakePush() };
  handle = createRouter(deps, store, testVerifier);
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

  it("402s once the sample is spent — the status the app opens the paywall on", async () => {
    const token = await session();
    const deps: EngineDeps = { store, config: { ...CONFIG, freeAnalyses: 1 }, llm: demoPorts(), mailer: fakeMailer(), push: fakePush() };
    handle = createRouter(deps, store, testVerifier);
    await handle(photoRequest(token));
    const res = await handle(photoRequest(token));
    expect(res.status).toBe(402);
    expect(await res.json()).toEqual({ error: "subscription-required" });
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
    // The line is stored in the thread; the shared cap the app applies is the one the server enforces.
    expect((await post(ROUTES.messages, { text: "x".repeat(MAX_USER_LINE + 1) }, token)).status).toBe(400);
    expect((await handle(photoRequest(token, 1, "y".repeat(MAX_USER_LINE + 1)))).status).toBe(400);
  });

  it("serves the thread back, newest page first, with a cursor", async () => {
    const token = await session();
    await post(ROUTES.messages, { text: "how much protein?", clientId: "x".repeat(MAX_CLIENT_ID + 1) }, token);
    const res = await get(`${ROUTES.messages}?limit=1`, token);
    expect(res.status).toBe(200);
    const body = await res.json() as { entries: { role: string }[]; before: number | null };
    expect(body.entries.map((e) => e.role)).toEqual(["assistant"]);
    // An over-long client id is dropped, not refused: the turn went through.
    const all = await (await get(ROUTES.messages, token)).json() as { entries: { role: string; clientId?: string | null }[] };
    expect(all.entries[0]).toMatchObject({ role: "user", clientId: null });
    expect(body.before).not.toBeNull();
    expect((await get(ROUTES.messages)).status).toBe(401);
  });

  it("appends the user's words and scripted lines through /lines, and refuses assistant prose", async () => {
    const token = await session();
    const ok = await post(ROUTES.messagesLines, { lines: [
      { role: "user", text: "Lose weight" }, { role: "assistant", scripted: "camera-closed" },
    ] }, token);
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ appended: 2 });
    const bad = await post(ROUTES.messagesLines, { lines: [{ role: "assistant", text: "I am Spud" }] }, token);
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ error: "bad-line" });
    expect((await post(ROUTES.messagesLines, { lines: "x" }, token)).status).toBe(400);
    const page = await (await get(ROUTES.messages, token)).json() as { entries: { role: string }[] };
    expect(page.entries.map((e) => e.role)).toEqual(["user", "assistant"]);
    expect((await post(ROUTES.messagesLines, { lines: [] })).status).toBe(401);
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

describe("health", () => {
  // These routes had no test at this layer at all: the batch cap, the window bounds and the
  // not-onboarded refusal were each enforced in exactly one place and asserted in none.
  const aDay = (date: string) => ({ ...emptyHealthDay(date), steps: 8000 });

  it("stores a batch and reads it back", async () => {
    const token = await session();
    const posted = await post(ROUTES.healthDays, { days: [aDay(localDate(CONFIG.timezone))] }, token);
    expect(posted.status).toBe(200);
    expect((await posted.json() as { accepted: number }).accepted).toBe(1);

    const read = await get(`${ROUTES.healthTrend}?days=30`, token);
    expect(read.status).toBe(200);
    expect((await read.json() as { days: unknown[] }).days).toHaveLength(1);
  });

  it("400s a batch larger than the contract allows", async () => {
    const token = await session();
    const days = Array.from({ length: MAX_HEALTH_DAYS_PER_BATCH + 1 }, () => aDay("2026-03-10"));
    expect((await post(ROUTES.healthDays, { days }, token)).status).toBe(400);
  });

  it("400s an out-of-range trend window", async () => {
    const token = await session();
    expect((await get(`${ROUTES.healthTrend}?days=0`, token)).status).toBe(400);
    expect((await get(`${ROUTES.healthTrend}?days=9000`, token)).status).toBe(400);
    expect((await get(`${ROUTES.healthTrend}?days=nope`, token)).status).toBe(400);
  });

  it("403s an account that has not onboarded", async () => {
    // Health data is special-category and the basis for holding it is the consent given at the end
    // of onboarding. Accepting it before then would be storing it with no basis at all.
    const res = await post(ROUTES.authDevice, {
      deviceId: crypto.randomUUID() + crypto.randomUUID(), locale: "en",
    });
    const { token } = await res.json() as { token: string };
    expect((await post(ROUTES.healthDays, { days: [aDay("2026-03-10")] }, token)).status).toBe(403);
    expect((await get(`${ROUTES.healthTrend}?days=7`, token)).status).toBe(403);
  });

  it("401s without a bearer token", async () => {
    expect((await post(ROUTES.healthDays, { days: [aDay("2026-03-10")] })).status).toBe(401);
    expect((await get(`${ROUTES.healthTrend}?days=7`)).status).toBe(401);
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
      llm: { ...demoPorts(), routeText: async () => { throw new Error("secret query text"); } }, mailer: fakeMailer(), push: fakePush(),
    };
    const token = await session();
    handle = createRouter(exploding, store, testVerifier);
    const res = await post(ROUTES.messages, { text: "hello" }, token);
    const body = JSON.stringify(await res.json());
    expect(body).not.toContain("secret query text");
  });
});

describe("sign in with apple / google", () => {
  /** A device session that has logged one meal. The anonymous starting point. */
  async function anonymousWithAMeal(): Promise<{ token: string; userId: string }> {
    const token = await session();
    await handle(photoRequest(token));
    const { profile } = await (await get(ROUTES.profile, token)).json() as { profile: { user_id: string } };
    return { token, userId: profile.user_id };
  }

  const signIn = (provider: "apple" | "google", subject: string, token?: string, nonce?: string) =>
    post(
      provider === "apple" ? ROUTES.authApple : ROUTES.authGoogle,
      { idToken: `ok:${provider}:${subject}`, ...(nonce ? { nonce } : {}) },
      token,
    );

  it("creates an account when a fresh install signs in with Apple", async () => {
    const res = await signIn("apple", "apple-sub-1");
    expect(res.status).toBe(200);
    const body = await res.json() as { outcome: string; token: string; onboarded: boolean };
    expect(body.outcome).toBe("created");
    expect(body.onboarded).toBe(false); // straight to onboarding
    expect((await get(ROUTES.profile, body.token)).status).toBe(200);
  });

  it("does the same for Google", async () => {
    const body = await (await signIn("google", "google-sub-1")).json() as { outcome: string };
    expect(body.outcome).toBe("created");
  });

  it("LINKS to the anonymous account and keeps its meals — the whole point", async () => {
    const { token, userId } = await anonymousWithAMeal();
    const body = await (await signIn("apple", "apple-sub-2", token)).json() as
      { outcome: string; userId: string; token: string };

    expect(body.outcome).toBe("linked");
    expect(body.userId).toBe(userId); // same account, not a new one
    const dayView = await (await get(ROUTES.day, body.token)).json() as { meals: unknown[] };
    expect(dayView.meals).toHaveLength(1); // the meal survived signing in
  });

  it("signs a returning user into their existing account on a new device", async () => {
    const first = await (await signIn("apple", "apple-sub-3")).json() as { userId: string; token: string };
    await patch(ROUTES.profile, {
      goal: "lose", sex: "male", weight_kg: 90, complete_onboarding: true,
    }, first.token);

    // A different install. No bearer token — a fresh device.
    const second = await (await signIn("apple", "apple-sub-3")).json() as
      { userId: string; outcome: string; onboarded: boolean };
    expect(second.outcome).toBe("switched");
    expect(second.userId).toBe(first.userId);
    expect(second.onboarded).toBe(true); // and it does NOT re-onboard them
  });

  it("MERGES an anonymous session's meals into the account it signs into", async () => {
    // The account already exists from an earlier device...
    const original = await (await signIn("apple", "apple-sub-4")).json() as { token: string; userId: string };
    await patch(ROUTES.profile, {
      goal: "lose", sex: "male", weight_kg: 90, complete_onboarding: true,
    }, original.token);
    await handle(photoRequest(original.token));

    // ...and now a NEW install logs a meal anonymously, then signs in as the same person.
    const anon = await anonymousWithAMeal();
    const merged = await (await signIn("apple", "apple-sub-4", anon.token)).json() as
      { outcome: string; userId: string; token: string; mergedMeals: number };

    expect(merged.outcome).toBe("merged");
    expect(merged.userId).toBe(original.userId);
    expect(merged.mergedMeals).toBe(1);

    // Both meals are now on one account.
    const dayView = await (await get(ROUTES.day, merged.token)).json() as { meals: unknown[] };
    expect(dayView.meals).toHaveLength(2);
  });

  it("invalidates the merged-away session's old token", async () => {
    const original = await (await signIn("apple", "apple-sub-5")).json() as { token: string };
    await patch(ROUTES.profile, { goal: "lose", weight_kg: 80, complete_onboarding: true }, original.token);
    const anon = await anonymousWithAMeal();
    await signIn("apple", "apple-sub-5", anon.token);
    // The old token pointed at an account that no longer exists. It must stop working rather than
    // silently start addressing someone else's diary.
    expect((await get(ROUTES.profile, anon.token)).status).toBe(401);
  });

  it("does NOT merge two accounts that both have real identities", async () => {
    const a = await (await signIn("apple", "apple-sub-6")).json() as { token: string; userId: string };
    await patch(ROUTES.profile, { goal: "lose", weight_kg: 80, complete_onboarding: true }, a.token);
    await handle(photoRequest(a.token));

    const b = await (await signIn("google", "google-sub-6")).json() as { token: string; userId: string };
    await patch(ROUTES.profile, { goal: "gain", weight_kg: 70, complete_onboarding: true }, b.token);
    await handle(photoRequest(b.token));

    // Signed into account B, now presenting account A's Apple identity.
    const res = await (await signIn("apple", "apple-sub-6", b.token)).json() as
      { outcome: string; userId: string; mergedMeals?: number };

    expect(res.outcome).toBe("switched");
    expect(res.userId).toBe(a.userId);
    expect(res.mergedMeals).toBeUndefined();
    // B is untouched — nothing was destroyed and nothing was guessed.
    expect((await (await get(ROUTES.day, b.token)).json() as { meals: unknown[] }).meals).toHaveLength(1);
  });

  it("links a second provider to the same account", async () => {
    const a = await (await signIn("apple", "apple-sub-7")).json() as { token: string; userId: string };
    const g = await (await signIn("google", "google-sub-7", a.token)).json() as
      { outcome: string; userId: string };
    expect(g.outcome).toBe("linked");
    expect(g.userId).toBe(a.userId);

    const { identities } = await (await get(ROUTES.identities, a.token)).json() as
      { identities: { provider: string }[] };
    expect(identities.map((i) => i.provider).sort()).toEqual(["apple", "google"]);
  });

  it("is a no-op when the identity is already on this account", async () => {
    const a = await (await signIn("apple", "apple-sub-8")).json() as { token: string };
    const again = await (await signIn("apple", "apple-sub-8", a.token)).json() as { outcome: string };
    expect(again.outcome).toBe("already");
  });

  it("keeps apple and google subjects in separate namespaces", async () => {
    // The same string from two providers is two different people.
    const a = await (await signIn("apple", "collide")).json() as { userId: string };
    const g = await (await signIn("google", "collide")).json() as { userId: string };
    expect(g.userId).not.toBe(a.userId);
  });

  it("401s an unverifiable token and never says why", async () => {
    const res = await post(ROUTES.authApple, { idToken: "forged" });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "sign-in-failed" });
  });

  it("401s a token minted for the other provider", async () => {
    // An Apple token replayed at the Google endpoint, and vice versa.
    expect((await post(ROUTES.authGoogle, { idToken: "ok:apple:x" })).status).toBe(401);
    expect((await post(ROUTES.authApple, { idToken: "ok:google:x" })).status).toBe(401);
  });

  it("401s a nonce that does not match the one this client generated", async () => {
    expect((await signIn("apple", "apple-sub-9", undefined, "replayed")).status).toBe(401);
    expect((await signIn("apple", "apple-sub-9", undefined, "good-nonce")).status).toBe(200);
  });

  it("400s a request with no idToken", async () => {
    expect((await post(ROUTES.authApple, {})).status).toBe(400);
  });

  it("signs out by dropping only the calling token", async () => {
    const a = await (await signIn("apple", "apple-sub-10")).json() as { token: string; userId: string };
    // A second device on the same account.
    const b = await (await signIn("apple", "apple-sub-10")).json() as { token: string };

    expect((await post(ROUTES.authSignOut, {}, a.token)).status).toBe(200);
    expect((await get(ROUTES.profile, a.token)).status).toBe(401);
    // The other device stays signed in, and the data is untouched.
    expect((await get(ROUTES.profile, b.token)).status).toBe(200);
  });

  it("releases the provider subject when the account is deleted", async () => {
    const a = await (await signIn("apple", "apple-sub-11")).json() as { token: string; userId: string };
    await handle(new Request(url(ROUTES.account), {
      method: "DELETE", headers: { authorization: `Bearer ${a.token}` },
    }));
    // Signing in again is a NEW account, not a resurrection of the deleted one.
    const again = await (await signIn("apple", "apple-sub-11")).json() as { outcome: string; userId: string };
    expect(again.outcome).toBe("created");
    expect(again.userId).not.toBe(a.userId);
  });

  it("lists the device identity for an anonymous account", async () => {
    const token = await session();
    const { identities } = await (await get(ROUTES.identities, token)).json() as
      { identities: { provider: string }[] };
    expect(identities.map((i) => i.provider)).toEqual(["device"]);
  });
});

describe("sign-out after a merge", () => {
  it("does not let device auth walk back into the merged account", async () => {
    // The regression this guards: if a merge repointed the anonymous DEVICE identity at the real
    // account, then signing out and re-authenticating by device id would silently restore full
    // access with no credential presented — and sign-out would mean nothing.
    const deviceId = crypto.randomUUID() + crypto.randomUUID();
    const anon = await (await post(ROUTES.authDevice, { deviceId })).json() as { token: string };
    await patch(ROUTES.profile, {
      goal: "lose", sex: "male", weight_kg: 90, complete_onboarding: true,
    }, anon.token);
    await handle(photoRequest(anon.token));

    const real = await (await post(ROUTES.authApple, { idToken: "ok:apple:merge-sub" })).json() as { token: string };
    await patch(ROUTES.profile, { goal: "lose", weight_kg: 88, complete_onboarding: true }, real.token);

    const merged = await (await post(
      ROUTES.authApple, { idToken: "ok:apple:merge-sub" }, anon.token,
    )).json() as { outcome: string; userId: string; token: string };
    expect(merged.outcome).toBe("merged");

    await post(ROUTES.authSignOut, {}, merged.token);

    // Re-authenticating with the SAME device id must land on a fresh, empty account.
    const back = await (await post(ROUTES.authDevice, { deviceId })).json() as
      { userId: string; created: boolean; token: string };
    expect(back.userId).not.toBe(merged.userId);
    expect(back.created).toBe(true);
    // Empty: none of the merged account's meals are reachable from the device credential alone.
    const dayView = await (await get(ROUTES.day, back.token)).json() as { meals: unknown[] };
    expect(dayView.meals).toHaveLength(0);
    const view = await (await get(ROUTES.profile, back.token)).json() as { onboarded: boolean };
    expect(view.onboarded).toBe(false);
  });
});

describe("the mailing list", () => {
  /** A router with its own config, because these routes are the only ones that read landingUrl. */
  const router = (landingUrl: string) => {
    const s = memoryStore();
    const mailer = fakeMailer();
    const config: Config = { ...CONFIG, landingUrl };
    return {
      store: s, mailer,
      handle: createRouter({ store: s, config, llm: demoPorts(), mailer, push: fakePush() }, s, testVerifier),
    };
  };

  const form = (fields: Record<string, string>) =>
    new Request(url(ROUTES.subscribe), { method: "POST", body: new URLSearchParams(fields) });

  it("takes a submission and sends the browser to check-your-email", async () => {
    const { handle: h, mailer } = router("https://eait.fit");
    const res = await h(form({ email: "a@example.com", source: "web_hero" }));
    // 303, not 302: 303 tells the browser to follow with GET, so a reload does not re-post.
    expect(res.status).toBe(303);
    // NOT /subscribed. Nothing is on the list yet, and a page that said so would be the same lie
    // the capped case used to tell, in a nicer font.
    expect(res.headers.get("location")).toBe("https://eait.fit/check-your-email");
    expect(mailer.sent).toHaveLength(1);
  });

  it("sends the browser to try-later when the confirmation could not be sent", async () => {
    // The visible half of the mail-provider fix. A host whose sender throws — including the log
    // provider behind a public page — must never read as "check your email".
    const { handle: h, mailer } = router("https://eait.fit");
    mailer.failNext();
    const res = await h(form({ email: "a@example.com" }));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://eait.fit/try-later");
    expect(mailer.sent).toHaveLength(0);
  });

  it("confirms on the link, and lands on the page that says you are on the list", async () => {
    const { handle: h, mailer, store: s } = router("https://eait.fit");
    await h(form({ email: "a@example.com" }));

    const link = new URL(mailer.sent[0]!.confirmUrl);
    const res = await h(new Request(url(`${ROUTES.subscribeConfirm}${link.search}`)));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://eait.fit/subscribed");
    // Confirmed, so the sweep leaves it alone.
    expect(await s.pruneUnconfirmedSubscribers(new Date(Date.now() + 1).toISOString())).toBe(0);
  });

  it("lands an unknown confirmation token on the same page as a real one", async () => {
    // Same rule as unsubscribe: not an oracle for which links are live, and clicking twice is fine.
    const { handle: h } = router("https://eait.fit");
    const res = await h(new Request(url(`${ROUTES.subscribeConfirm}?t=deadbeef`)));
    expect(res.headers.get("location")).toBe("https://eait.fit/subscribed");
  });

  it("builds the confirmation link with the scheme the client actually used", async () => {
    // The request reaches this process over plain HTTP on a Docker network — Caddy terminates TLS
    // and proxies onward — so without X-Forwarded-Proto every link in every email is http://, and
    // a mail client that refuses to open one is right to.
    //
    // The HOST needs no such rescue: Caddy passes the original Host header through untouched
    // (unlike nginx, which replaces it unless told otherwise), so the URL this handler sees already
    // carries the public name.
    const { handle: h, mailer } = router("https://eait.fit");
    await h(new Request("http://api.eait.fit/v1/subscribe", {
      method: "POST",
      headers: { "x-forwarded-proto": "https" },
      body: new URLSearchParams({ email: "a@example.com" }),
    }));
    expect(mailer.sent[0]!.confirmUrl).toStartWith("https://api.eait.fit/v1/subscribe/confirm?t=");
  });

  it("prefers the configured public origin over anything a request can say", async () => {
    // A link built from a header is a link whose hostname a client can influence, and this one goes
    // into an email. Where the origin is known, it is stated.
    const s = memoryStore();
    const mailer = fakeMailer();
    const config: Config = {
      ...CONFIG, landingUrl: "https://eait.fit", publicApiUrl: "https://api.eait.fit",
    };
    const h = createRouter({ store: s, config, llm: demoPorts(), mailer, push: fakePush() }, s, testVerifier);

    await h(new Request("http://attacker.example/v1/subscribe", {
      method: "POST",
      body: new URLSearchParams({ email: "a@example.com" }),
    }));
    expect(mailer.sent[0]!.confirmUrl).toStartWith("https://api.eait.fit/v1/subscribe/confirm?t=");
  });

  it("needs no token, which is the entire point", async () => {
    // A subscriber is not a user. Requiring auth here would mean the list could only hold people
    // who already signed up for the thing the list exists to tell them about.
    const { handle: h, store: s } = router("https://eait.fit");
    await h(form({ email: "b@example.com" }));
    expect(await s.countSubscribersSince(new Date(0).toISOString())).toBe(1);
  });

  it("tells a person about a typo, and a bot about nothing", async () => {
    const { handle: h } = router("https://eait.fit");
    const typo = await h(form({ email: "not-an-address" }));
    expect(typo.headers.get("location")).toBe("https://eait.fit/not-subscribed");
  });

  it("answers a filled honeypot exactly like a success", async () => {
    const { handle: h, store: s } = router("https://eait.fit");
    const res = await h(form({ email: "bot@example.com", company: "Acme" }));
    expect(res.status).toBe(303);
    // The same page a real submission gets — which is now "check your email", because a pending
    // row is not a subscription and the page must not say it is.
    expect(res.headers.get("location")).toBe("https://eait.fit/check-your-email");
    expect(await s.countSubscribersSince(new Date(0).toISOString())).toBe(0);
  });

  it("unsubscribes on a token and no login", async () => {
    const { handle: h, store: s } = router("https://eait.fit");
    const { unsubscribeToken } = await s.addSubscriber("a@example.com", "web");
    const res = await h(new Request(url(`${ROUTES.unsubscribe}?t=${unsubscribeToken}`)));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://eait.fit/unsubscribed");
    expect(await s.countSubscribersSince(new Date(0).toISOString())).toBe(0);
  });

  it("lands an unknown token on the same page as a real one", async () => {
    // The route must not be an oracle for which tokens are live, and clicking twice is not an error.
    const { handle: h } = router("https://eait.fit");
    const res = await h(new Request(url(`${ROUTES.unsubscribe}?t=deadbeef`)));
    expect(res.headers.get("location")).toBe("https://eait.fit/unsubscribed");
  });

  it("answers JSON when there is no landing page to send anyone to", async () => {
    const { handle: h } = router("");
    const res = await h(form({ email: "a@example.com" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

// ── Per-address limits ─────────────────────────────────────────────────────────────────────────
//
// The unit tests in `ratelimit.test.ts` cover the limiter. These cover the thing it is FOR: that
// minting a second account does not buy a second allowance, which is the bypass that made the
// per-user cap decorative.
describe("rate limits", () => {
  const routerWith = (over: Partial<Config>) => {
    const s = memoryStore();
    const config: Config = { ...CONFIG, ...over };
    return createRouter({ store: s, config, llm: demoPorts(), mailer: fakeMailer(), push: fakePush() }, s, testVerifier);
  };

  /** A device registration from a stated address, as Caddy would present it. */
  const registerFrom = (h: (r: Request) => Promise<Response>, address: string) =>
    h(new Request(url(ROUTES.authDevice), {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": address },
      body: JSON.stringify({ deviceId: crypto.randomUUID() + crypto.randomUUID(), locale: "en" }),
    }));

  it("bounds how many accounts one address may mint", async () => {
    const h = routerWith({ authRateLimitPerHour: 3 });

    for (let i = 0; i < 3; i++) {
      expect((await registerFrom(h, "203.0.113.9")).status).toBe(200);
    }

    const refused = await registerFrom(h, "203.0.113.9");
    expect(refused.status).toBe(429);
    expect(await refused.json()).toEqual({ error: "rate-limited" });
    // Without this a client has no idea whether to retry in a second or an hour, and picks a second.
    expect(Number(refused.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("bounds the thread's own lines per address, like the health sync", async () => {
    const h = routerWith({ linesRateLimitPerHour: 2 });
    const address = "203.0.113.45";
    const register = await h(new Request(url(ROUTES.authDevice), {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": address },
      body: JSON.stringify({ deviceId: crypto.randomUUID() + crypto.randomUUID(), locale: "en" }),
    }));
    const { token } = await register.json() as { token: string };
    const append = () => h(new Request(url(ROUTES.messagesLines), {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": address, authorization: `Bearer ${token}` },
      body: JSON.stringify({ lines: [{ role: "user", text: "hi" }] }),
    }));
    expect((await append()).status).toBe(200);
    expect((await append()).status).toBe(200);
    const third = await append();
    expect(third.status).toBe(429);
    expect(await third.json()).toEqual({ error: "rate-limited" });
  });

  it("bounds the manual edit per address too: it writes the thread and sits behind no cap", async () => {
    const h = routerWith({ linesRateLimitPerHour: 2 });
    const address = "203.0.113.46";
    const register = await h(new Request(url(ROUTES.authDevice), {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": address },
      body: JSON.stringify({ deviceId: crypto.randomUUID() + crypto.randomUUID(), locale: "en" }),
    }));
    const { token } = await register.json() as { token: string };
    const patch = (body: unknown) => h(new Request(url(ROUTES.meal(crypto.randomUUID())), {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-forwarded-for": address, authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    }));
    // A body that is not an edit is a 400, before any engine call; a well-formed one on no such meal is the 409.
    const bad = await patch({ kcal: "abc" });
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ error: "bad-edit" });
    expect((await patch({ kcal: 300 })).status).toBe(409);
    const third = await patch({ kcal: 300 });
    expect(third.status).toBe(429);
    expect(await third.json()).toEqual({ error: "rate-limited" });
  });

  it("bounds the health sync, which nothing else bounds", async () => {
    // The heaviest write this API accepts — up to MAX_HEALTH_DAYS_PER_BATCH upserts in one
    // transaction — and no model is called, so none of the billed caps reach it. An account-scoped
    // bound would be worth nothing either: POST /v1/auth/device mints a fresh account for anybody
    // with a 32-character string, so resetting one costs a single request.
    const h = routerWith({ healthSyncRateLimitPerHour: 2 });
    const address = "203.0.113.44";

    const register = await h(new Request(url(ROUTES.authDevice), {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": address },
      body: JSON.stringify({ deviceId: crypto.randomUUID() + crypto.randomUUID(), locale: "en" }),
    }));
    const { token } = await register.json() as { token: string };

    const sync = () => h(new Request(url(ROUTES.healthDays), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": address,
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ days: [{ ...emptyHealthDay("2026-03-10"), steps: 1 }] }),
    }));

    // 403 rather than 200: this account never onboarded. Irrelevant here — what matters is that the
    // limiter is charged BEFORE the body is read, so a refused request still costs an allowance.
    // A cap that only counts the requests it liked is a cap a retry loop walks straight through.
    expect((await sync()).status).toBe(403);
    expect((await sync()).status).toBe(403);

    const refused = await sync();
    expect(refused.status).toBe(429);
    expect(Number(refused.headers.get("retry-after"))).toBeGreaterThan(0);
    // A CODE, not a sentence. `ApiError.isRefusal` on the client switches on this string, and an
    // error it does not recognise is reported to the user as "couldn't reach ieat" — for a request
    // that arrived, was understood, and was answered. Same code as the other per-address limit:
    // nothing has been spent, so it is not `cap-exceeded`.
    expect(await refused.json()).toEqual({ error: "rate-limited" });
  });

  it("does not let one address spend another's allowance", async () => {
    const h = routerWith({ authRateLimitPerHour: 1 });
    expect((await registerFrom(h, "203.0.113.9")).status).toBe(200);
    expect((await registerFrom(h, "203.0.113.9")).status).toBe(429);
    expect((await registerFrom(h, "198.51.100.7")).status).toBe(200);
  });

  it("reads the LAST forwarded address, so a client cannot forge its way out", async () => {
    const h = routerWith({ authRateLimitPerHour: 1 });
    // Caddy appends what it saw, so everything left of the final entry is attacker-controlled. A
    // limiter that keyed on the first value would hand this attacker a fresh bucket per request.
    const spoof = (n: number) =>
      h(new Request(url(ROUTES.authDevice), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": `10.0.0.${n}, 203.0.113.9`,
        },
        body: JSON.stringify({ deviceId: crypto.randomUUID() + crypto.randomUUID(), locale: "en" }),
      }));

    expect((await spoof(1)).status).toBe(200);
    expect((await spoof(2)).status).toBe(429);
    expect((await spoof(3)).status).toBe(429);
  });

  it("counts billed analyses per address, across every account it creates", async () => {
    // The whole point. Two accounts, one address, one allowance between them — otherwise the
    // per-user cap is worth exactly one call to /v1/auth/device.
    const h = routerWith({ analysisRateLimitPerDay: 2, freeAnalyses: 99 });
    const address = "203.0.113.9";

    const onboard = async (): Promise<string> => {
      const res = await registerFrom(h, address);
      const { token } = await res.json() as { token: string };
      await h(new Request(url(ROUTES.profile), {
        method: "PATCH",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({
          goal: "lose", sex: "female", birth_year: 1990, height_cm: 165, weight_kg: 70,
          target_weight_kg: 65, activity: "moderate", pace: "steady", country: "gb",
          restrictions: [], complete_onboarding: true,
        }),
      }));
      return token;
    };

    const photo = (token: string) => {
      const form = new FormData();
      form.append("photo", new File([new Uint8Array(64).fill(7)], "m.jpg", { type: "image/jpeg" }));
      return h(new Request(url(ROUTES.photo), {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "x-forwarded-for": address },
        body: form,
      }));
    };

    const first = await onboard();
    expect((await photo(first)).status).toBe(200);
    expect((await photo(first)).status).toBe(200);

    // A brand new account from the same address. Its own allowance is untouched — and it gets
    // nothing, because the allowance that matters is the address's.
    const second = await onboard();
    const refused = await photo(second);
    expect(refused.status).toBe(429);
    expect(await refused.json()).toEqual({ error: "cap-exceeded", scope: "address" });
  });

  it("is off when the limit is zero, and says so by allowing the request", async () => {
    // An escape hatch that has to be typed, rather than one that happens when a variable is missing.
    const h = routerWith({ authRateLimitPerHour: 0 });
    for (let i = 0; i < 25; i++) {
      expect((await registerFrom(h, "203.0.113.9")).status).toBe(200);
    }
  });
});

describe("subscribe outcomes", () => {
  const routerWith = (over: Partial<Config>) => {
    const s = memoryStore();
    const config: Config = { ...CONFIG, landingUrl: "https://eait.fit", ...over };
    return createRouter({ store: s, config, llm: demoPorts(), mailer: fakeMailer(), push: fakePush() }, s, testVerifier);
  };

  const submit = (h: (r: Request) => Promise<Response>, fields: Record<string, string>) =>
    h(new Request(url(ROUTES.subscribe), { method: "POST", body: new URLSearchParams(fields) }));

  it("does not tell a capped submitter they are on the list", async () => {
    // The defect this exists for. Only `invalid` was routed away from /subscribed, so a submission
    // the cap refused reported success and dropped the address — and the cap is global, so one
    // script filling it turned every real visitor for the rest of the day into a silent loss.
    const h = routerWith({ subscribeDailyCap: 1 });

    const first = await submit(h, { email: "first@example.com" });
    expect(first.headers.get("location")).toBe("https://eait.fit/check-your-email");

    const capped = await submit(h, { email: "second@example.com" });
    expect(capped.headers.get("location")).toBe("https://eait.fit/try-later");
  });

  it("still answers a honeypot hit exactly like a success", async () => {
    // The one case where lying is right: a bot that can tell the two apart learns which field to
    // leave empty next time.
    const h = routerWith({});
    const bot = await submit(h, { email: "bot@example.com", company: "Acme Inc" });
    expect(bot.headers.get("location")).toBe("https://eait.fit/check-your-email");
  });

  it("says the cap was hit in the JSON answer too, for a backend with no landing page", async () => {
    const h = routerWith({ landingUrl: "", subscribeDailyCap: 1 });
    await submit(h, { email: "first@example.com" });
    const capped = await submit(h, { email: "second@example.com" });
    // 429 rather than 200-with-an-error-body: a caller that only reads the status must not read
    // this as an acceptance.
    expect(capped.status).toBe(429);
    expect(await capped.json()).toHaveProperty("error");
  });

  it("sends a rate-limited submission to the same page, saying nothing about which limit", async () => {
    // Distinguishing "the cap is spent" from "you are being limited" tells a script how well it is
    // doing. One page for both.
    const h = routerWith({ subscribeRateLimitPerHour: 1 });
    await submit(h, { email: "a@example.com" });
    const limited = await submit(h, { email: "b@example.com" });
    expect(limited.headers.get("location")).toBe("https://eait.fit/try-later");
  });
});

describe("push tokens", () => {
  const token = () => `ExponentPushToken[${crypto.randomUUID().slice(0, 12)}]`;

  it("registers a token and reads it back off the store", async () => {
    const t = await session();
    const pushToken = token();
    const res = await post(ROUTES.pushToken, { token: pushToken, platform: "ios" }, t);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ registered: true });
    const userId = (await store.userIdForToken(t))!;
    expect(await store.pushTokensFor(userId)).toEqual([{ token: pushToken, platform: "ios" }]);
  });

  it("is idempotent — the app re-registers on every launch", async () => {
    const t = await session();
    const pushToken = token();
    await post(ROUTES.pushToken, { token: pushToken, platform: "ios" }, t);
    await post(ROUTES.pushToken, { token: pushToken, platform: "ios" }, t);
    const userId = (await store.userIdForToken(t))!;
    expect(await store.pushTokensFor(userId)).toHaveLength(1);
  });

  it("unregisters, and says so when there was nothing to unregister", async () => {
    const t = await session();
    const pushToken = token();
    await post(ROUTES.pushToken, { token: pushToken, platform: "ios" }, t);
    const first = await del(ROUTES.pushToken, { token: pushToken }, t);
    expect(await first.json()).toEqual({ registered: false });
    const again = await del(ROUTES.pushToken, { token: pushToken }, t);
    expect(again.status).toBe(200);
    const userId = (await store.userIdForToken(t))!;
    expect(await store.pushTokensFor(userId)).toEqual([]);
  });

  it("refuses a body that is not a push token", async () => {
    const t = await session();
    for (const body of [
      {}, { token: "" }, { token: "not-a-token", platform: "ios" },
      { token: `ExponentPushToken[${"x".repeat(300)}]`, platform: "ios" },
      { token: token(), platform: "android" },
      { token: token() },
    ]) {
      expect((await post(ROUTES.pushToken, body, t)).status).toBe(400);
    }
  });

  it("needs a session, on both methods", async () => {
    expect((await post(ROUTES.pushToken, { token: token(), platform: "ios" })).status).toBe(401);
    expect((await del(ROUTES.pushToken, { token: token() })).status).toBe(401);
  });

  it("keeps one account's device out of another's list", async () => {
    const mine = await session();
    const theirs = await session();
    const pushToken = token();
    await post(ROUTES.pushToken, { token: pushToken, platform: "ios" }, theirs);
    const mineId = (await store.userIdForToken(mine))!;
    expect(await store.pushTokensFor(mineId)).toEqual([]);
    // And a token this account does not hold is not this account's to drop.
    const res = await del(ROUTES.pushToken, { token: pushToken }, mine);
    expect(res.status).toBe(200);
    const theirsId = (await store.userIdForToken(theirs))!;
    expect(await store.pushTokensFor(theirsId)).toHaveLength(1);
  });

  it("is bounded per address, like every other unbilled write here", async () => {
    // `POST /v1/auth/device` mints an account for anybody with a 32-character string, so an
    // account-scoped bound is worth one extra HTTP call to reset. Every token accepted is a row
    // that lives until the account is deleted, and `isPushToken` only checks a shape — a caller
    // can invent as many valid-looking ones as it likes.
    const s = memoryStore();
    const config = { ...CONFIG, linesRateLimitPerHour: 3 };
    const h = createRouter({ store: s, config, llm: demoPorts(), mailer: fakeMailer(), push: fakePush() }, s, testVerifier);
    const res = await h(new Request(url(ROUTES.authDevice), {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ deviceId: crypto.randomUUID() + crypto.randomUUID() }),
    }));
    const { token: bearer } = await res.json() as { token: string };
    const register = (n: number) => h(new Request(url(ROUTES.pushToken), {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${bearer}` },
      body: JSON.stringify({ token: `ExponentPushToken[flood-${n}]`, platform: "ios" }),
    }));

    for (let i = 0; i < 3; i++) expect((await register(i)).status).toBe(200);
    const refused = await register(99);
    expect(refused.status).toBe(429);
    expect(refused.headers.get("retry-after")).toBeTruthy();
    // Its OWN counter: the lines allowance is spent separately, exactly as the meal editor's is.
    const lines = await h(new Request(url(ROUTES.messagesLines), {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${bearer}` },
      body: JSON.stringify({ lines: [{ role: "user", text: "hi" }] }),
    }));
    expect(lines.status).not.toBe(429);
  });

  it("erases the device with the account", async () => {
    const t = await session();
    await post(ROUTES.pushToken, { token: token(), platform: "ios" }, t);
    const userId = (await store.userIdForToken(t))!;
    await handle(new Request(url(ROUTES.account), {
      method: "DELETE", headers: { authorization: `Bearer ${t}` },
    }));
    expect(await store.pushTokensFor(userId)).toEqual([]);
  });
});
