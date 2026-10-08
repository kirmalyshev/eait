import { beforeEach, describe, expect, it } from "bun:test";
import {
  HEALTH_RETENTION_DAYS, IDEMPOTENCY_KEY, MAX_CLIENT_ID, MAX_USER_LINE, MAX_HEALTH_DAYS_PER_BATCH, ROUTES, emptyHealthDay,
  dateMinus, localDate, NDJSON, OUTCOME_UNKNOWN, type ChatHistoryResponse, type PairCodeResponse, type PhotoEvent, type MealLogged,
  type DaysResponse, type MealRecord, type ProfileResponse, type MealProposed, type PendingMealsResponse,
  type ChatEntry, type WeightsResponse,
} from "@eait/shared";
import { configDefaults, type Config } from "../config.ts";
import { DEMO_NOT_FOOD, demoPorts } from "../llm/demo.ts";
import { memoryStore } from "../store.memory.ts";
import type { Store } from "../store.ts";
import type { EngineDeps } from "../engine/index.ts";
import type { LlmPorts } from "../llm/port.ts";
import { AuthError, type Verifier } from "../auth/verify.ts";
import { createRouter } from "./routes.ts";
import { redeemPairingCode } from "../engine/pairing.ts";
import { fakePush } from "../push/fake.ts";

/** 64 bytes that pass the engine's magic-byte check as a JPEG. */
const jpegBytes = (fill: number) => { const b = new Uint8Array(64).fill(fill); b[0] = 0xff; b[1] = 0xd8; return b; };

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
  appleAudiences: ["com.eait.fit.ios"], googleAudiences: ["test.apps.googleusercontent.com"],
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

/** A meal on the record, bypassing the analysis path — for tests about what HOLDS one. */
const seedMeal = (userId: string) => store.insertMeal({
  id: crypto.randomUUID(), user_id: userId, ts: new Date().toISOString(), date: localDate("Europe/Berlin"),
  isFood: true, items: [{ name: "Rice", grams: 200 }, { name: "Chicken", grams: 150 }],
  kcal: 500, protein_g: 40, carbs_g: 56, fat_g: 8, satfat_g: 2, fiber_g: 1, sugar_g: 0.1,
  sodium_mg: 400, verdicts: { weight: "good" }, healthScore: null, confidence: "high", notes: "", corrected: false,
  model: "test",
});

/**
 * Register a device, sign it in with Google, and complete onboarding. Returns the bearer token.
 *
 * The sign-in is not ceremony: since S8 an account with no Apple or Google identity is anonymous
 * and every analysis is refused before it is charged — the tests below are about what a signed-in
 * account can do, so this makes one, through the same attach call the app makes at sign-up.
 */
async function session(): Promise<string> {
  const res = await post(ROUTES.authDevice, { deviceId: crypto.randomUUID() + crypto.randomUUID(), locale: "en-GB" });
  const { token } = await res.json() as { token: string };
  await post(ROUTES.authGoogle, { idToken: `ok:google:s-${crypto.randomUUID()}`, terms: true }, token);
  await patch(ROUTES.profile, {
    goal: "lose", sex: "female", birth_year: 1990, height_cm: 165, weight_kg: 70,
    target_weight_kg: 65, activity: "some", pace: "steady", country: "gb",
    restrictions: [], complete_onboarding: true,
  }, token);
  return token;
}

/**
 * A declared body length, because since #208 these routes refuse a request that declares none.
 *
 * `new Request(url, { body: form })` sets no `content-length` — the header is added by the network
 * layer on the way out, and `Bun.serve` parses it back off the wire, so a handler in production
 * always sees one and a synthetic Request here does not. The value only has to be under the cap;
 * what is under test is the guard, not the arithmetic.
 */
const DECLARED_LENGTH = "1024";

/** A multipart photo upload. */
function photoRequest(token: string, files = 1, caption?: string): Request {
  const form = new FormData();
  for (let i = 0; i < files; i++) {
    form.append("photo", new File([jpegBytes(i + 1)], `m${i}.jpg`, { type: "image/jpeg" }));
  }
  if (caption) form.append("caption", caption);
  return new Request(url(ROUTES.photo), {
    method: "POST", headers: { authorization: `Bearer ${token}`, "content-length": DECLARED_LENGTH }, body: form,
  });
}

beforeEach(() => {
  store = memoryStore();
  const deps: EngineDeps = { store, config: CONFIG, llm: demoPorts(), push: fakePush() };
  handle = createRouter(deps, store, testVerifier);
});

describe("auth", () => {
  it("serves health without a token — a probe that needs a session cannot tell dead from expired", async () => {
    const res = await get(ROUTES.health);
    expect(res.status).toBe(200);
  });

  it("says the analyzer is canned only when the canned PORTS are the ones answering", async () => {
    // THE FIELD THIS ONCE READ WAS DECORATIVE. It was `config.llmProvider`, which `demoConfig()`
    // writes and nothing in `src/` reads — `index.ts` chooses the ports from `process.argv` alone.
    // `EAIT__BACKEND__LLM_PROVIDER=demo` would therefore have produced `demo:true` from a process
    // serving every request through the real, billed analyzer, and `scripts/screenshots.sh` would
    // then refuse App Store frames it could have taken honestly. This is that case: config still
    // says demo, the ports answering do not.
    const real = { ...demoPorts(), canned: false };
    const handleReal = createRouter(
      { store, config: CONFIG, llm: real, push: fakePush() },
      store, testVerifier,
    );
    expect(CONFIG.llmProvider).toBe("demo");
    expect(await (await handleReal(new Request(url(ROUTES.health)))).json()).toEqual({ ok: true, demo: false });
  });

  it("says on health whether the analyzer is the canned one", async () => {
    // `scripts/screenshots.sh` is the caller that needs this and the reason it exists. A frame
    // shot against the demo analyzer carries "Demo analyzer — these numbers are canned" in the
    // picture, and that frame goes to App Store Connect and onto the landing page; #66 is what
    // that costs. The script cannot see pixels and could not see the backend either, so the walk
    // was guarded by a comment. It is a boolean and not the provider's name: which vendor is
    // answering is nobody's business on an unauthenticated probe, and canned-or-not is the only
    // part the caller can act on.
    // The harness runs `demoPorts()`, which is the canned analyzer itself.
    const res = await get(ROUTES.health);
    expect(await res.json()).toEqual({ ok: true, demo: true });
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

  // #77. The paywall is operator configuration the client is TOLD — computed and formatted
  // server-side, so the browser calculates nothing and the bundle compiles no price.
  describe("paywall", () => {
    const SELLING: Config["webPaywall"] = {
      yearlyCheckoutUrl: "https://pay.rev.cat/y/{userId}",
      monthlyCheckoutUrl: "https://pay.rev.cat/m/{userId}",
      yearlyPrice: 39.99,
      monthlyPrice: 4.99,
      trialDays: 7,
      exitOfferCheckoutUrl: "https://pay.rev.cat/u/{userId}",
      exitOfferPrice: 23.99,
      exitOfferRegularPrice: 39.99,
      currency: "EUR",
    };

    const viewFor = async (webPaywall: Config["webPaywall"], locale = "en-GB") => {
      const s = memoryStore();
      const h = createRouter(
        { store: s, config: { ...CONFIG, webPaywall }, llm: demoPorts(), push: fakePush() },
        s, testVerifier);
      const res = await h(new Request(url(ROUTES.authDevice), {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ deviceId: crypto.randomUUID() + crypto.randomUUID(), locale }),
      }));
      const { token } = await res.json() as { token: string };
      return (await (await h(new Request(url(ROUTES.profile), {
        headers: { authorization: `Bearer ${token}` },
      }))).json() as ProfileResponse);
    };

    it("sends both plans and the exit offer, priced and named for THIS account", async () => {
      const view = await viewFor(SELLING);
      const userId = view.profile.user_id;
      expect(view.paywall.trialDays).toBe(7);
      // Every checkout already carries this account's id — `{userId}` is filled here, never by a
      // client, because the webhook grants the purchase to app_user_id and nothing else.
      expect(view.paywall.yearly).toEqual({
        checkoutUrl: `https://pay.rev.cat/y/${userId}`,
        price: "€39.99",
        pricePerMonth: "€3.33",
      });
      expect(view.paywall.monthly).toEqual({
        checkoutUrl: `https://pay.rev.cat/m/${userId}`,
        price: "€4.99",
      });
      expect(view.paywall.exitOffer).toEqual({
        checkoutUrl: `https://pay.rev.cat/u/${userId}`,
        price: "€23.99",
        regularPrice: "€39.99",
        percentOff: 40,
        perMonth: "€2.00",
      });
    });

    it("formats the same prices in the account's own language", async () => {
      const view = await viewFor(SELLING, "de-DE");
      expect(view.paywall.yearly?.price).toBe("39,99 €");
      expect(view.paywall.exitOffer?.perMonth).toBe("2,00 €");
    });

    it("sends an empty paywall — plans null, offer null — when the host sells nothing", async () => {
      const view = await viewFor({ ...SELLING,
        yearlyCheckoutUrl: "", monthlyCheckoutUrl: "", exitOfferCheckoutUrl: "" });
      expect(view.paywall).toEqual({ trialDays: 7, yearly: null, monthly: null, exitOffer: null,
        termsUrl: "", privacyUrl: "" });
    });
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

  it("attaches another angle to a logged meal, and charges nothing for it (#304)", async () => {
    const token = await session();
    const logged = await (await handle(photoRequest(token))).json() as { mealId: string };

    const form = new FormData();
    form.append("photo", new File([jpegBytes(7)], "second.jpg", { type: "image/jpeg" }));
    const res = await handle(new Request(url(ROUTES.mealPhotos(logged.mealId)), {
      method: "POST", headers: { authorization: `Bearer ${token}`, "content-length": DECLARED_LENGTH }, body: form,
    }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ mealId: logged.mealId, photos: 2 });
    // The GET by position — the route `PhotoStrip` fetches — now answers for the new one.
    expect((await handle(new Request(url(ROUTES.mealPhoto(logged.mealId, 1)), {
      headers: { authorization: `Bearer ${token}` },
    }))).status).toBe(200);
  });

  it("guards the attach like the upload it is: length, size, a part, and the meal's owner", async () => {
    const token = await session();
    const logged = await (await handle(photoRequest(token))).json() as { mealId: string };
    const at = url(ROUTES.mealPhotos(logged.mealId));
    const auth = { authorization: `Bearer ${token}` };
    const withPhoto = () => {
      const f = new FormData();
      f.append("photo", new File([jpegBytes(7)], "s.jpg", { type: "image/jpeg" }));
      return f;
    };

    // No length at all is refused rather than read as zero — the #208 guard, on this route too.
    expect((await handle(new Request(at, { method: "POST", headers: { ...auth, "content-type": "multipart/form-data; boundary=x" } }))).status).toBe(411);
    expect((await handle(new Request(at, { method: "POST", headers: { ...auth, "content-length": String(50 * 1024 * 1024) }, body: new FormData() }))).status).toBe(413);
    expect((await handle(new Request(at, { method: "POST", headers: { ...auth, "content-length": DECLARED_LENGTH }, body: new FormData() }))).status).toBe(400);

    // Another account's meal id is 409 target-gone, never a hint that the meal exists.
    const other = await session();
    const res = await handle(new Request(at, { method: "POST", headers: { authorization: `Bearer ${other}`, "content-length": DECLARED_LENGTH }, body: withPhoto() }));
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "target-gone" });

    // Past the meal's own limit: a 400 naming the limit, and nothing stored.
    const many = new FormData();
    for (let i = 0; i < CONFIG.maxPhotosPerMeal; i++) many.append("photo", new File([jpegBytes(i + 20)], `x${i}.jpg`, { type: "image/jpeg" }));
    const over = await handle(new Request(at, { method: "POST", headers: { ...auth, "content-length": DECLARED_LENGTH }, body: many }));
    expect(over.status).toBe(400);
    expect(await over.json()).toEqual({ error: "too-many-photos", limit: CONFIG.maxPhotosPerMeal });

    // A HEIC is 415, the same status and the same sniff that guards the charge on the upload route.
    const heicForm = new FormData();
    heicForm.append("photo", new File([new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63])], "s.heic", { type: "image/heic" }));
    const bad = await handle(new Request(at, { method: "POST", headers: { ...auth, "content-length": DECLARED_LENGTH }, body: heicForm }));
    expect(bad.status).toBe(415);
  });

  it("400s an upload with no photo part", async () => {
    const token = await session();
    const res = await handle(new Request(url(ROUTES.photo), {
      method: "POST", headers: { authorization: `Bearer ${token}`, "content-length": DECLARED_LENGTH }, body: new FormData(),
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

  it("411s a request that declares no length at all, rather than reading it as zero", async () => {
    // `Number(null)` is 0, so a chunked body with no `content-length` passed the guard and reached
    // `req.formData()` — the buffering the guard exists to prevent (#208). Absent is refused, the
    // same call `web/start.ts` already makes on the Apple callback. `maxRequestBodySize` is still
    // the real backstop; this is the cheap early refusal.
    const token = await session();
    const res = await handle(new Request(url(ROUTES.photo), {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "multipart/form-data; boundary=x" },
    }));
    expect(res.status).toBe(411);
  });

  // #708: the queue re-sends a turn whose answer was lost, under the id it was first sent with.
  it("answers a re-sent photo or message from the first, logging and charging once", async () => {
    const token = await session();
    const userId = (await store.userIdForToken(token))!;
    const clientId = crypto.randomUUID();
    const yesterday = new Date(Date.now() - 86_400_000).toISOString();
    const withId = () => {
      const form = new FormData();
      form.append("photo", new File([jpegBytes(1)], "m.jpg", { type: "image/jpeg" }));
      form.append("clientId", clientId);
      form.append("capturedAt", yesterday);
      return new Request(url(ROUTES.photo), {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-length": DECLARED_LENGTH, accept: NDJSON },
        body: form,
      });
    };
    const last = async (res: Response) => JSON.parse((await res.text()).trim().split("\n").at(-1)!) as { kind: string; date?: string };
    const first = await last(await handle(withId()));
    const again = await last(await handle(withId()));
    expect(first.kind).toBe("logged");
    expect(again).toEqual(first);
    // Dated by the capture, in the server's zone.
    expect(first.date).toBe(localDate(CONFIG.timezone, new Date(yesterday)));
    expect(await store.countUserAnalyses(userId)).toBe(1);

    const said = crypto.randomUUID();
    const one = await (await post(ROUTES.messages, { text: "how much protein?", clientId: said }, token)).json();
    const two = await (await post(ROUTES.messages, { text: "how much protein?", clientId: said }, token)).json();
    expect(two).toEqual(one);
    expect(await store.countUserAnalyses(userId)).toBe(2);
    const thread = await (await get(ROUTES.messages, token)).json() as { entries: { role: string; clientId?: string | null }[] };
    expect(thread.entries.filter((e) => e.clientId === said)).toHaveLength(1);
  });

  // #414: a turn id that never had a job row is not a running job. Its kept answer is served, and
  // an unsettled claim — a turn the pre-jobs version accepted, dead long past its bound by now —
  // is the unknown, not a "running" that no worker holds.
  it("reads a bare turn through the job route as its outcome, never as running", async () => {
    const token = await session();
    const userId = (await store.userIdForToken(token))!;
    const unsettled = crypto.randomUUID();
    await store.claimTurn(userId, unsettled);
    const res = await get(ROUTES.photoJob(unsettled), token);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ kind: "settled", jobId: unsettled, result: { kind: OUTCOME_UNKNOWN } });
    const answered = crypto.randomUUID();
    await store.claimTurn(userId, answered);
    await store.settleTurn(userId, answered, { kind: "subscription-required" });
    const got = await get(ROUTES.photoJob(answered), token);
    expect(await got.json()).toEqual({ kind: "settled", jobId: answered, result: { kind: "subscription-required" } });
    expect((await get(ROUTES.photoJob(crypto.randomUUID()), token)).status).toBe(404);
  });

  // A replay calls no model, so the address allowance is not what it spends — and a replay refused
  // there is held by the client, whose "Send again" is a NEW id: the second meal (#708 review).
  it("lets a re-sent turn past the address limit that a new turn meets", async () => {
    const token = await session();
    const deps: EngineDeps = { store, config: { ...CONFIG, analysisRateLimitPerDay: 1 }, llm: demoPorts(), push: fakePush() };
    handle = createRouter(deps, store, testVerifier);
    const said = crypto.randomUUID();
    const send = (key: string) => handle(new Request(url(ROUTES.messages), {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json", [IDEMPOTENCY_KEY]: key },
      body: JSON.stringify({ text: "how much protein?", clientId: key }),
    }));
    const first = await send(said);
    expect(first.status).toBe(200);
    const again = await send(said);
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual(await first.json());
    expect((await send(crypto.randomUUID())).status).toBe(429);
  });

  it("402s once the sample is spent — the status the app opens the paywall on", async () => {
    const token = await session();
    const deps: EngineDeps = { store, config: { ...CONFIG, freeAnalyses: 1 }, llm: demoPorts(), push: fakePush() };
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

  it("lists the caller's live proposals as their turns sent them, and forgets one once logged (#530)", async () => {
    const token = await session();
    const proposed = await (await post(ROUTES.messages, { text: "two eggs and toast" }, token)).json() as MealProposed;
    expect(proposed.kind).toBe("proposed");
    const listed = async (t: string) => (await (await get(ROUTES.pending, t)).json() as PendingMealsResponse).proposals;
    expect(await listed(token)).toEqual([proposed]);
    // Scoped by the caller: another account sees none of it.
    expect(await listed(await session())).toEqual([]);
    await post(ROUTES.pendingConfirm(proposed.pendingId), {}, token);
    expect(await listed(token)).toEqual([]);
  });

  it("400s an empty message rather than spending a model call on it", async () => {
    const token = await session();
    // A question comes back with the coach's chips, bounded like every other client-bound list.
    const asked = await (await post(ROUTES.messages, { text: "how's my week going?" }, token)).json() as
      { kind: string; text: string; suggestions?: string[] };
    expect(asked.kind).toBe("answered");
    expect(asked.text).toContain("Demo");
    expect(asked.suggestions!.length).toBeGreaterThan(0);
    expect(asked.suggestions!.length).toBeLessThanOrEqual(3);
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

  it("signs a coach answer as Gabie's, and never takes a speaker a client claims", async () => {
    const token = await session();
    const asked = await (await post(ROUTES.messages, { text: "how's my week going?" }, token)).json() as { kind: string; speaker?: string };
    // S9: Gabie answers in Chat — the wire says so.
    expect(asked).toMatchObject({ kind: "answered", speaker: "gabie" });
    // A scripted line is Spud's even when the client tries to sign it as somebody else's.
    const forged = await post(ROUTES.messagesLines, { lines: [{ role: "assistant", scripted: "camera-closed", speaker: "gabie" }] }, token);
    expect(forged.status).toBe(200);
    const { entries } = await (await get(ROUTES.messages, token)).json() as { entries: { role: string; kind: string; speaker?: string | null }[] };
    expect(entries.map((e) => [e.role, e.kind, e.speaker])).toEqual([
      ["user", "text", undefined], ["assistant", "text", "gabie"], ["assistant", "text", null],
    ]);
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
    expect(body.analysis.verdicts.weight).toBe("bad"); // 9000kcal is not "good"
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

  // #608. A user's own lines, by id. Both routes are scoped: another account's id is 409, never 404.
  //
  // There is no `GET /v1/meals/:id` route — only `PATCH` matches `mealMatch` in routes.ts, so a GET
  // on that path falls through to the router's own 404 regardless of whether the meal exists. The
  // brief's tests read the meal back that way; here they read it through `store.getMeal` instead,
  // resolving `userId` the way the file's other tests do (`store.userIdForToken`).
  describe("DELETE and PATCH /v1/messages/:id", () => {
    /** One photo turn; the user's photo line id and its meal id. */
    async function photoLine(token: string, caption?: string) {
      const logged = await (await handle(photoRequest(token, 1, caption))).json() as { kind: string; mealId: string };
      expect(logged.kind).toBe("logged");
      const { entries } = await (await get(ROUTES.messages, token)).json() as ChatHistoryResponse;
      const line = entries.find((e) => e.role === "user" && e.kind === "photo");
      if (!line) throw new Error("no photo line");
      return { lineId: line.id, mealId: logged.mealId, entries };
    }
    function editRequest(token: string, lineId: string, text: string, files = 0, stream = false): Request {
      const form = new FormData();
      form.append("text", text);
      for (let i = 0; i < files; i++) form.append("photo", new File([jpegBytes(i + 7)], `a${i}.jpg`, { type: "image/jpeg" }));
      return new Request(url(ROUTES.message(lineId)), {
        method: "PATCH", body: form,
        headers: { authorization: `Bearer ${token}`, "content-length": DECLARED_LENGTH, ...(stream ? { accept: "application/x-ndjson" } : {}) },
      });
    }

    it("deletes a photo line with its meal and cards; another account's id is 409", async () => {
      const token = await session();
      const { lineId, mealId } = await photoLine(token);
      expect((await del(ROUTES.message(lineId), {}, await session())).status).toBe(409);
      const res = await del(ROUTES.message(lineId), {}, token);
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ kind: "deleted", mealId });
      const { entries } = await (await get(ROUTES.messages, token)).json() as ChatHistoryResponse;
      expect(entries.some((e) => e.id === lineId || (e.kind === "meal" && e.mealId === mealId))).toBe(false);
      const userId = (await store.userIdForToken(token))!;
      expect(await store.getMeal(userId, mealId)).toBeNull();
    });

    it("refuses to delete an assistant line", async () => {
      const token = await session();
      const { entries } = await photoLine(token);
      const card = entries.find((e) => e.role === "assistant")!;
      expect((await del(ROUTES.message(card.id), {}, token)).status).toBe(400);
    });

    it("edits a photo line: the numbers and the words change in place, as a stream", async () => {
      const token = await session();
      const { lineId, mealId, entries: before } = await photoLine(token, "rice");
      const res = await handle(editRequest(token, lineId, "rice, and an egg", 1, true));
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("application/x-ndjson");
      const lines = (await res.text()).split("\n").filter((l) => l.trim() !== "").map((l) => JSON.parse(l) as { kind: string });
      expect(lines.some((l) => l.kind === "item")).toBe(true);
      expect(lines.at(-1)).toMatchObject({ kind: "updated", mealId, via: "reanalysis" });
      const { entries } = await (await get(ROUTES.messages, token)).json() as ChatHistoryResponse;
      expect(entries.map((e) => e.id)).toEqual(before.map((e) => e.id));
      const line = entries.find((e) => e.id === lineId);
      expect(line && line.kind === "photo" ? line.text : null).toBe("rice, and an egg");
      const userId = (await store.userIdForToken(token))!;
      const meal = await store.getMeal(userId, mealId);
      expect(meal?.photos).toBe(2);
      expect(meal?.corrected).toBe(false);
    });

    it("answers JSON without the accept header, and 400 on a text line, 409 on another account's", async () => {
      const token = await session();
      const { lineId } = await photoLine(token);
      expect((await handle(editRequest(token, lineId, "x"))).status).toBe(200);
      expect((await handle(editRequest(await session(), lineId, "x"))).status).toBe(409);
      await post(ROUTES.messages, { text: "what is a good breakfast?" }, token);
      const { entries } = await (await get(ROUTES.messages, token)).json() as ChatHistoryResponse;
      const text = entries.findLast((e) => e.role === "user" && e.kind === "text")!;
      expect((await handle(editRequest(token, text.id, "y"))).status).toBe(400);
    });

    it("caps the words and the angles, and needs a length", async () => {
      const token = await session();
      const { lineId } = await photoLine(token);
      expect((await handle(editRequest(token, lineId, "x".repeat(MAX_USER_LINE + 1)))).status).toBe(400);
      const many = await handle(editRequest(token, lineId, "x", CONFIG.maxPhotosPerMeal));
      expect(many.status).toBe(400);
      expect(await many.json()).toMatchObject({ error: "too-many-photos" });
      const noLength = new Request(url(ROUTES.message(lineId)), { method: "PATCH", headers: { authorization: `Bearer ${token}`, "content-type": "multipart/form-data; boundary=x" } });
      expect((await handle(noLength)).status).toBe(411);
    });
  });

  // #61. The meal screen's delete: the same semantics as the line's, for a caller holding a meal id.
  describe("DELETE /v1/meals/:id", () => {
    /** Every way a line can name a meal: a photo line's and a card's `mealId`, a typed line's `pendingId`. */
    const namesMeal = (e: ChatEntry, mealId: string): boolean =>
      ((e.kind === "photo" || e.kind === "meal") && e.mealId === mealId) ||
      (e.role === "user" && e.kind === "text" && e.pendingId === mealId);

    it("deletes the meal, its photos, its cards and the line that carried it", async () => {
      const token = await session();
      const logged = await (await handle(photoRequest(token))).json() as { kind: string; mealId: string; date: string };
      expect(logged.kind).toBe("logged");
      const { entries } = await (await get(ROUTES.messages, token)).json() as ChatHistoryResponse;
      const line = entries.find((e) => e.role === "user" && e.kind === "photo" && e.mealId === logged.mealId);
      if (!line) throw new Error("no photo line");

      const res = await del(ROUTES.meal(logged.mealId), {}, token);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ kind: "deleted", mealId: logged.mealId, date: logged.date });

      const userId = (await store.userIdForToken(token))!;
      expect(await store.getMeal(userId, logged.mealId)).toBeNull();
      expect(await store.getPhotos(userId, logged.mealId)).toEqual([]);
      const after = await (await get(ROUTES.messages, token)).json() as ChatHistoryResponse;
      expect(after.entries.some((e) => e.id === line.id || namesMeal(e, logged.mealId))).toBe(false);
    });

    it("409s another account's meal id and an unknown one, deleting nothing", async () => {
      const token = await session();
      const logged = await (await handle(photoRequest(token))).json() as { mealId: string };
      const res = await del(ROUTES.meal(logged.mealId), {}, await session());
      expect(res.status).toBe(409);
      expect(await res.json()).toMatchObject({ error: "target-gone" });
      expect((await del(ROUTES.meal(crypto.randomUUID()), {}, token)).status).toBe(409);
      // And nothing of the meal's owner's was touched.
      const userId = (await store.userIdForToken(token))!;
      expect(await store.getMeal(userId, logged.mealId)).not.toBeNull();
      const { entries } = await (await get(ROUTES.messages, token)).json() as ChatHistoryResponse;
      expect(entries.some((e) => namesMeal(e, logged.mealId))).toBe(true);
    });
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
    expect((await get(`${ROUTES.week}?days=${HEALTH_RETENTION_DAYS + 1}`, token)).status).toBe(400);
    // The intake series on the health screen covers the same span as the health rows.
    expect((await get(`${ROUTES.week}?days=${HEALTH_RETENTION_DAYS}`, token)).status).toBe(200);
  });
});

// ── The range reads (#84) ───────────────────────────────────────────────────────────────────
//
// `GET /v1/diary/days` is what Home's week strip and Progress's "This week" bars read; the streak
// travels inside the same answer because a streak a client counted is a streak that disagrees.
// Dates here are written out relative to the server's zone — `localDate(CONFIG.timezone)` is what
// the engine calls "today", which is exactly the thing under test.

const aMeal = (userId: string, date: string, kcal: number): MealRecord => ({
  id: crypto.randomUUID(), user_id: userId, ts: `${date}T12:00:00.000Z`, date,
  isFood: true, items: [], kcal, protein_g: 10, carbs_g: 40, fat_g: 15, satfat_g: 4,
  fiber_g: 1, sugar_g: 1, sodium_mg: 10,
  verdicts: { weight: "good" }, healthScore: null, confidence: "high", notes: "", corrected: false, model: "test",
});

const TODAY = () => localDate(CONFIG.timezone);

describe("the days read", () => {
  it("answers every day of the range, oldest first, logged or empty", async () => {
    const token = await session();
    const uid = (await store.userIdForToken(token))!;

    const today = TODAY();
    const d = (back: number) => dateMinus(today, back);
    await store.insertMeal(aMeal(uid, d(2), 500));
    await store.insertMeal(aMeal(uid, d(2), 300));
    await store.insertMeal(aMeal(uid, d(0), 600));

    const res = await get(`${ROUTES.days}?from=${d(3)}&to=${d(0)}`, token);
    expect(res.status).toBe(200);
    const out = await res.json() as DaysResponse;

    expect(out.days.map((day) => day.date)).toEqual([d(3), d(2), d(1), d(0)]);
    expect(out.days[0]).toMatchObject({ logged: false, kcal: 0, when: "past" });
    expect(out.days[1]).toMatchObject({ logged: true, kcal: 800, when: "past" });
    expect(out.days[2]).toMatchObject({ logged: false, kcal: 0, when: "past" });
    expect(out.days[3]).toMatchObject({ logged: true, kcal: 600, when: "today" });
    // The day's plan is sent once, not repeated per row: the session() profile's kcal target.
    const me = await (await get(ROUTES.profile, token)).json() as ProfileResponse;
    expect(out.targetKcal).toBe(me.targets.kcal);
    // Two logged days back, a blank one between: the run counts today alone.
    expect(out.streak).toBe(1);
  });

  it("marks a day after today empty rather than zero — a day not yet is not a day eaten at zero", async () => {
    const token = await session();
    const today = TODAY();
    const res = await get(`${ROUTES.days}?from=${today}&to=${dateMinus(today, -2)}`, token);
    expect(res.status).toBe(200);
    const out = await res.json() as DaysResponse;
    expect(out.days.map((day) => day.when)).toEqual(["today", "future", "future"]);
    expect(out.days[1]!.logged).toBe(false);
    expect(out.days[1]!.kcal).toBeNull();
    expect(out.days[2]!.kcal).toBeNull();
  });

  it("counts the streak from yesterday while today is still open, and stops at a blank day", async () => {
    const token = await session();
    const uid = (await store.userIdForToken(token))!;
    const today = TODAY();
    const d = (back: number) => dateMinus(today, back);

    await store.insertMeal(aMeal(uid, d(1), 100));
    await store.insertMeal(aMeal(uid, d(2), 100));
    await store.insertMeal(aMeal(uid, d(3), 100));
    // d(4) blank → the run is three days even though d(5) is also logged.
    await store.insertMeal(aMeal(uid, d(5), 100));

    const out = await (await get(`${ROUTES.days}?from=${d(6)}&to=${today}`, token)).json() as DaysResponse;
    expect(out.streak).toBe(3);

    // One logged meal today and the same run reads four.
    await store.insertMeal(aMeal(uid, d(0), 100));
    const today2 = await (await get(`${ROUTES.days}?from=${d(6)}&to=${today}`, token)).json() as DaysResponse;
    expect(today2.streak).toBe(4);
  });

  it("counts nobody else's meals", async () => {
    const token = await session();
    const other = (await store.upsertDeviceUser(crypto.randomUUID() + crypto.randomUUID(), "en")).userId;
    const today = TODAY();
    await store.insertMeal(aMeal(other, dateMinus(today, 1), 900));

    const out = await (await get(`${ROUTES.days}?from=${dateMinus(today, 2)}&to=${today}`, token)).json() as DaysResponse;
    expect(out.streak).toBe(0);
    expect(out.days.every((day) => !day.logged)).toBe(true);
  });

  it("400s a missing, malformed or over-31-day span; 403s a fresh account", async () => {
    const token = await session();
    const today = TODAY();
    expect((await get(`${ROUTES.days}?from=${today}`, token)).status).toBe(400);
    expect((await get(`${ROUTES.days}?from=nope&to=${today}`, token)).status).toBe(400);
    // from AFTER to is an empty span, not a mistaken one.
    expect((await get(`${ROUTES.days}?from=${today}&to=${dateMinus(today, 1)}`, token)).status).toBe(400);
    expect((await get(`${ROUTES.days}?from=${dateMinus(today, 31)}&to=${today}`, token)).status).toBe(400);
    expect((await get(`${ROUTES.days}?from=${dateMinus(today, 30)}&to=${today}`, token)).status).toBe(200);

    // A fresh account answers like the sibling diary reads: an empty diary is not a refusal —
    // `day` and `week` both answer one, and so does this: every row empty, streak zero.
    const { token: fresh } = await (await post(ROUTES.authDevice, {
      deviceId: crypto.randomUUID() + crypto.randomUUID(), locale: "en",
    })).json() as { token: string };
    const blank = await get(`${ROUTES.days}?from=${today}&to=${today}`, fresh);
    expect(blank.status).toBe(200);
    expect(await blank.json() as DaysResponse).toMatchObject({
      days: [{ date: today, logged: false, when: "today" }], streak: 0,
    });
  });
});

describe("the weights read", () => {
  const healthWeight = (date: string, kg: number) => ({ ...emptyHealthDay(date), weight_kg: kg });

  it("merges the health import and the typed log, the typed word winning a shared day", async () => {
    const token = await session();
    const uid = (await store.userIdForToken(token))!;
    const today = TODAY();

    // A HealthKit backfill, a typed correction on the same day, and an older typed one.
    await store.putHealthDays(uid, [healthWeight(today, 73.4), healthWeight(dateMinus(today, 10), 74.6)]);
    await store.putWeight(uid, today, 73.2);
    await store.putWeight(uid, dateMinus(today, 30), 75.0);

    const out = await (await get(`${ROUTES.weights}?range=90D`, token)).json() as WeightsResponse;
    // Oldest first — chart order — and each date once.
    expect(out.weights).toEqual([
      { date: dateMinus(today, 30), kg: 75.0, source: "manual" },
      { date: dateMinus(today, 10), kg: 74.6, source: "health" },
      { date: today, kg: 73.2, source: "manual" },
    ]);
    // `latest` is the log's newest entry, whatever the range left in.
    expect(out.latest).toEqual({ date: today, kg: 73.2, source: "manual" });
  });

  it("still names the latest weigh-in when the selected range holds none", async () => {
    // Store-level account, so no manual row lands today: the only weigh-in predates 90D.
    const { userId } = await store.upsertDeviceUser(crypto.randomUUID() + crypto.randomUUID(), "en");
    const token = await store.issueToken(userId);
    const today = TODAY();
    await store.putWeight(userId, dateMinus(today, 100), 75.5);

    const out = await (await get(`${ROUTES.weights}?range=90D`, token)).json() as WeightsResponse;
    // `weights` honours the range — the card's empty frame — while `latest` keeps the dated
    // figure the none-in-range state shows (design-pro on #95).
    expect(out.weights).toEqual([]);
    expect(out.latest).toEqual({ date: dateMinus(today, 100), kg: 75.5, source: "manual" });
  });

  it("answers no latest at all when nothing was ever logged", async () => {
    const { userId } = await store.upsertDeviceUser(crypto.randomUUID() + crypto.randomUUID(), "en");
    const token = await store.issueToken(userId);
    const out = await (await get(ROUTES.weights, token)).json() as WeightsResponse;
    expect(out.weights).toEqual([]);
    expect(out.latest).toBeNull();
  });

  it("bounds the log by the range, in the server's own timezone", async () => {
    const token = await session();
    const uid = (await store.userIdForToken(token))!;
    const today = TODAY();
    await store.putWeight(uid, today, 73.4);
    await store.putWeight(uid, dateMinus(today, 40), 74.4);  // inside 90D, outside nothing newer
    await store.putWeight(uid, dateMinus(today, 100), 75.5); // outside 90D
    await store.putWeight(uid, dateMinus(today, 200), 76.5); // outside 6M

    const d90 = await (await get(`${ROUTES.weights}?range=90D`, token)).json() as WeightsResponse;
    expect(d90.weights.map((w) => w.date)).toEqual([dateMinus(today, 40), today]);
    const m6 = await (await get(`${ROUTES.weights}?range=6M`, token)).json() as WeightsResponse;
    expect(m6.weights.map((w) => w.date)).toEqual([dateMinus(today, 100), dateMinus(today, 40), today]);
    const all = await (await get(`${ROUTES.weights}?range=all`, token)).json() as WeightsResponse;
    expect(all.weights.map((w) => w.date)).toEqual([
      dateMinus(today, 200), dateMinus(today, 100), dateMinus(today, 40), today,
    ]);
    // And nobody else's: another account's row never surfaces here.
    const other = (await store.upsertDeviceUser(crypto.randomUUID() + crypto.randomUUID(), "en")).userId;
    await store.putWeight(other, today, 50.0);
    expect((await (await get(`${ROUTES.weights}?range=all`, token)).json() as WeightsResponse).weights)
      .toHaveLength(4);
  });

  it("answers the BMI off the newest weigh-in and the profile's height (#118)", async () => {
    const token = await session();
    const uid = (await store.userIdForToken(token))!;
    const today = TODAY();
    await store.patchProfile(uid, { height_cm: 172 });
    await store.putWeight(uid, today, 73.4);
    const out = await (await get(`${ROUTES.weights}?range=90D`, token)).json() as WeightsResponse;
    expect(out.bmi).toEqual({ value: 24.8, range: "18.5-24.9" });
  });

  it("answers null without a height — and nothing to another account", async () => {
    const { userId } = await store.upsertDeviceUser(crypto.randomUUID() + crypto.randomUUID(), "en");
    const token = await store.issueToken(userId);
    await store.putWeight(userId, TODAY(), 73.4);
    const out = await (await get(ROUTES.weights, token)).json() as WeightsResponse;
    expect(out.bmi).toBeNull();
  });

  it("defaults to the board's first segment and refuses a range it does not know", async () => {
    const token = await session();
    const today = TODAY();
    expect((await get(`${ROUTES.weights}`, token)).status).toBe(200);
    expect((await get(`${ROUTES.weights}?range=90D`, token)).status).toBe(200);
    expect((await get(`${ROUTES.weights}?range=nope`, token)).status).toBe(400);
    void today;
  });
});

describe("the projection on the weights read", () => {
  // An account onboarded three days ago at 70kg aiming for 65 — hand-built rather than
  // session()'s, because the store-level patch can write the onboarded_at of a PAST day, which is
  // what the goal bar's "start" needs a history older than to prove it isn't reading it.
  const accountWeighed = async () => {
    const { userId } = await store.upsertDeviceUser(crypto.randomUUID() + crypto.randomUUID(), "en");
    const token = await store.issueToken(userId);
    const today = TODAY();
    await store.patchProfile(userId, {
      goal: "lose", sex: "female", birth_year: 1990, height_cm: 165, weight_kg: 70,
      target_weight_kg: 65, activity: "some", pace: "steady", country: "gb", restrictions: [],
      onboarded_at: `${dateMinus(today, 3)}T08:00:00.000Z`,
    });
    return { token, userId, today };
  };

  it("projects the plan from the latest weigh-in, starting where the plan was set", async () => {
    const { token, userId, today } = await accountWeighed();
    // The onboarding-day weigh-in, a pre-onboarding health backfill that must NOT become the
    // start, and a health same-day reading that must not beat what she typed.
    await store.putHealthDays(userId, [
      { ...emptyHealthDay(dateMinus(today, 30)), weight_kg: 74.6 },
      { ...emptyHealthDay(dateMinus(today, 3)), weight_kg: 71.1 },
    ]);
    await store.putWeight(userId, dateMinus(today, 3), 70.0);
    await store.putWeight(userId, dateMinus(today, 1), 66.0);

    const out = await (await get(ROUTES.weights, token)).json() as WeightsResponse;
    expect(out.projection).not.toBeNull();
    // The current figure is the newest LOGGED weight, not the profile's stored 70.
    expect(out.projection!.currentKg).toBe(66);
    expect(out.projection!.targetKg).toBe(65);
    // And the start is the typed onboarding value — 70, not the 74.6 backfill and not the 71.1
    // the scale reported for the same morning (the typed row wins a shared date).
    expect(out.projection!.startKg).toBe(70);
    expect(out.projection!.weeks).toBeGreaterThan(0);
    expect(out.projection!.kgPerWeek).toBeGreaterThan(0);
    expect(out.projection!.month.length).toBeGreaterThan(0);
    expect(out.projection!.beyondHorizon).toBe(false);
  });

  it("falls back to the earliest weigh-in when nothing was logged after onboarding", async () => {
    const { token, userId, today } = await accountWeighed();
    // The whole log predates the account — a HealthKit backfill of a phone that had data long
    // before the install. The plan still needs somewhere to start from.
    await store.putHealthDays(userId, [
      { ...emptyHealthDay(dateMinus(today, 60)), weight_kg: 74.6 },
      { ...emptyHealthDay(dateMinus(today, 40)), weight_kg: 74.0 },
    ]);
    const out = await (await get(ROUTES.weights, token)).json() as WeightsResponse;
    expect(out.projection!.startKg).toBe(74.6);
    expect(out.projection!.currentKg).toBe(74.0);
  });

  it("uses the stored weight when nothing was ever logged", async () => {
    const { token } = await accountWeighed();
    const out = await (await get(ROUTES.weights, token)).json() as WeightsResponse;
    expect(out.projection!.currentKg).toBe(70);
    expect(out.projection!.startKg).toBe(70);
  });

  it("writes the typed weight to the day's weigh-in row, the last write winning", async () => {
    const token = await session();
    const today = TODAY();

    await patch(ROUTES.profile, { weight_kg: 69.5 }, token);
    await patch(ROUTES.profile, { weight_kg: 69.2 }, token);

    const out = await (await get(`${ROUTES.weights}?range=90D`, token)).json() as WeightsResponse;
    // One row for today — the second typing replaced the first, onboarding's own included.
    expect(out.weights.filter((w) => w.date === today))
      .toEqual([{ date: today, kg: 69.2, source: "manual" }]);
  });

  it("does not weigh-in on a patch that clears the weight", async () => {
    const token = await session();
    await patch(ROUTES.profile, { weight_kg: null }, token);
    const out = await (await get(`${ROUTES.weights}?range=90D`, token)).json() as WeightsResponse;
    // The onboarding PATCH's own row stands; the clear wrote nothing — null is not a weigh-in.
    expect(out.weights.filter((w) => w.date === TODAY())).toHaveLength(1);
  });

  it("answers null where no honest projection exists — a maintainer has nowhere to arrive", async () => {
    const res = await post(ROUTES.authDevice, { deviceId: crypto.randomUUID() + crypto.randomUUID(), locale: "en" });
    const { token } = await res.json() as { token: string };
    await patch(ROUTES.profile, {
      goal: "maintain", sex: "female", birth_year: 1990, height_cm: 165, weight_kg: 70,
      activity: "some", country: "gb", restrictions: [], complete_onboarding: true,
    }, token);
    const out = await (await get(ROUTES.weights, token)).json() as WeightsResponse;
    expect(out.projection).toBeNull();
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
    expect((await get(`${ROUTES.healthTrend}?days=${HEALTH_RETENTION_DAYS + 1}`, token)).status).toBe(400);
    expect((await get(`${ROUTES.healthTrend}?days=nope`, token)).status).toBe(400);
    // Everything the server keeps, in one read: what the year view asks for.
    expect((await get(`${ROUTES.healthTrend}?days=${HEALTH_RETENTION_DAYS}`, token)).status).toBe(200);
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
      llm: { ...demoPorts(), routeText: async () => { throw new Error("secret query text"); } }, push: fakePush(),
    };
    const token = await session();
    handle = createRouter(exploding, store, testVerifier);
    const res = await post(ROUTES.messages, { text: "hello" }, token);
    const body = JSON.stringify(await res.json());
    expect(body).not.toContain("secret query text");
  });
});

describe("sign in with apple / google", () => {
  /**
   * A device session whose account carries a meal — seeded directly, since an anonymous account
   * (S8) cannot log one. What the merge tests exercise is the account state they care about.
   */
  async function anonymousWithAMeal(): Promise<{ token: string; userId: string }> {
    const res = await post(ROUTES.authDevice, { deviceId: crypto.randomUUID() + crypto.randomUUID(), locale: "en-GB" });
    const { token } = await res.json() as { token: string };
    await patch(ROUTES.profile, { goal: "lose", weight_kg: 80, complete_onboarding: true }, token);
    const { profile } = await (await get(ROUTES.profile, token)).json() as { profile: { user_id: string } };
    await seedMeal(profile.user_id);
    return { token, userId: profile.user_id };
  }

  const signIn = (provider: "apple" | "google", subject: string, token?: string, nonce?: string) =>
    post(
      provider === "apple" ? ROUTES.authApple : ROUTES.authGoogle,
      { idToken: `ok:${provider}:${subject}`, terms: true, ...(nonce ? { nonce } : {}) },
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

  // ── Signing out everywhere (#247) ────────────────────────────────────────────────────────

  it("ends every session of this account, including the one that asked", async () => {
    // THE MITIGATION FOR #209. An intercepted pairing code buys a full session until it idles out;
    // this is the only thing that ends it.
    const a = await (await signIn("apple", "apple-signout-all")).json() as { token: string; userId: string };
    // A second session on the same account, the way a browser gets one.
    const second = await store.issueToken(a.userId);
    expect(await store.userIdForToken(second)).toBe(a.userId);

    const res = await post(ROUTES.authSignOutEverywhere, {}, a.token);
    expect(res.status).toBe(200);

    expect(await store.userIdForToken(second)).toBeNull();
    // The calling device too, which is correct and is what the button has to say.
    expect(await store.userIdForToken(a.token)).toBeNull();
    expect((await get(ROUTES.identities, a.token)).status).toBe(401);
  });

  it("is not account deletion: signing in again gets everything back", async () => {
    const a = await (await signIn("apple", "apple-signout-keeps")).json() as { token: string; userId: string };
    await post(ROUTES.authSignOutEverywhere, {}, a.token);
    // Signed out for real — otherwise the sign-in below would prove nothing.
    expect(await store.userIdForToken(a.token)).toBeNull();

    const again = await (await signIn("apple", "apple-signout-keeps")).json() as
      { userId: string; outcome: string };
    expect(again.userId).toBe(a.userId);
    expect(again.outcome).toBe("switched");
  });

  it("touches nobody else's sessions", async () => {
    const a = await (await signIn("apple", "apple-signout-mine")).json() as { token: string };
    const b = await (await signIn("google", "google-signout-theirs")).json() as { token: string };
    await post(ROUTES.authSignOutEverywhere, {}, a.token);
    expect((await get(ROUTES.identities, b.token)).status).toBe(200);
  });

  it("needs a session of its own", async () => {
    expect((await post(ROUTES.authSignOutEverywhere, {})).status).toBe(401);
  });

  it("is a POST, so nothing else can end a session on somebody's behalf", async () => {
    const token = await session();
    expect((await get(ROUTES.authSignOutEverywhere, token)).status).not.toBe(200);
    expect(await store.userIdForToken(token)).not.toBeNull();
  });

  // ── Unlinking (#246) ─────────────────────────────────────────────────────────────────────

  it("unlinks one provider and leaves the account and its other ways in", async () => {
    const a = await (await signIn("apple", "apple-unlink-1")).json() as { token: string; userId: string };
    await signIn("google", "google-unlink-1", a.token);

    const res = await del(ROUTES.identity("google"), {}, a.token);
    expect(res.status).toBe(200);
    const body = await res.json() as { identities: { provider: string }[]; deleted: boolean };
    expect(body.deleted).toBe(false);
    expect(body.identities.map((i) => i.provider).sort()).toEqual(["apple"]);
    // The session still works: the account is there and Apple still opens it.
    expect((await get(ROUTES.identities, a.token)).status).toBe(200);
  });

  it("NEVER takes the subject from the request", async () => {
    // The rule the whole route rests on. A body naming somebody else's link names nothing: the
    // subject is resolved from the CALLER's own identities, and the provider is in the path.
    const victim = await (await signIn("apple", "apple-victim")).json() as { token: string };
    const attacker = await (await signIn("google", "google-attacker")).json() as { token: string };

    const res = await del(
      ROUTES.identity("apple"),
      { subject: "apple-victim", userId: "whatever" },
      attacker.token,
    );
    // The attacker has no Apple link of their own, so there is nothing to remove — and the
    // victim's is untouched.
    expect(res.status).toBe(404);
    const still = await (await get(ROUTES.identities, victim.token)).json() as
      { identities: { provider: string }[] };
    expect(still.identities.map((i) => i.provider)).toContain("apple");
  });

  it("erases the account when the identity removed was the last way in, and says so", async () => {
    // The delete-when-last rule is `Store.removeIdentity`'s and is left alone: a paired browser
    // session is not an identity and does not count as "this account is reachable" (#209). What is
    // added is that the caller is TOLD, rather than finding out from the next 401.
    const a = await (await signIn("apple", "apple-only-way-in")).json() as { token: string };
    const res = await del(ROUTES.identity("apple"), {}, a.token);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ identities: [], deleted: true });
    // The session names nothing now.
    expect((await get(ROUTES.identities, a.token)).status).toBe(401);
  });

  it("keeps an account whose device identity is still there", async () => {
    // Signing in from an install that has a device identity LINKS rather than switches, so the
    // device row is still a way in and removing the provider does not erase anything.
    const res = await post(ROUTES.authDevice, { deviceId: crypto.randomUUID() + crypto.randomUUID(), locale: "en-GB" });
    const { token } = await res.json() as { token: string };
    const linked = await (await signIn("google", "google-keeps-device", token)).json() as
      { outcome: string };
    expect(linked.outcome).toBe("linked");

    const body = await (await del(ROUTES.identity("google"), {}, token)).json() as
      { deleted: boolean; identities: { provider: string }[] };
    expect(body.deleted).toBe(false);
    expect(body.identities.map((i) => i.provider)).toEqual(["device"]);
    expect((await get(ROUTES.identities, token)).status).toBe(200);
  });

  it("refuses to unlink the device identity", async () => {
    // It is the anonymous credential the install was born with rather than something a person
    // linked, and dropping it would lock a signed-out session out of an account that still exists.
    const res = await post(ROUTES.authDevice, { deviceId: crypto.randomUUID() + crypto.randomUUID(), locale: "en-GB" });
    const { token } = await res.json() as { token: string };
    expect((await del(ROUTES.identity("device"), {}, token)).status).toBe(404);
    const { identities } = await (await get(ROUTES.identities, token)).json() as
      { identities: { provider: string }[] };
    expect(identities.map((i) => i.provider)).toEqual(["device"]);
  });

  it("404s a provider this server has never heard of, and one that is not linked", async () => {
    const token = await session();
    expect((await del(ROUTES.identity("facebook" as never), {}, token)).status).toBe(404);
    expect((await del(ROUTES.identity("apple"), {}, token)).status).toBe(404);
  });

  it("needs a session of its own", async () => {
    expect((await del(ROUTES.identity("google"), {})).status).toBe(401);
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
    const res = await post(ROUTES.authApple, { idToken: "forged", terms: true });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "sign-in-failed" });
  });

  it("401s a token minted for the other provider", async () => {
    // An Apple token replayed at the Google endpoint, and vice versa.
    expect((await post(ROUTES.authGoogle, { idToken: "ok:apple:x", terms: true })).status).toBe(401);
    expect((await post(ROUTES.authApple, { idToken: "ok:google:x", terms: true })).status).toBe(401);
  });

  it("401s a nonce that does not match the one this client generated", async () => {
    expect((await signIn("apple", "apple-sub-9", undefined, "replayed")).status).toBe(401);
    expect((await signIn("apple", "apple-sub-9", undefined, "good-nonce")).status).toBe(200);
  });

  it("400s a request with no idToken", async () => {
    expect((await post(ROUTES.authApple, {})).status).toBe(400);
  });

  it("400s a sign-in that did not tick the terms box — S8's required consent", async () => {
    // Before the verifier is ever called: a sign-in without consent is not one, whatever the
    // token would have proven.
    const res = await post(ROUTES.authApple, { idToken: "ok:apple:no-terms" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "terms-required" });
    // Marketing is the OTHER box — ticking it is not agreement to the terms.
    expect((await post(ROUTES.authGoogle, { idToken: "ok:google:no-terms", marketing: true })).status).toBe(400);
    // And `terms: false` is a tick that was never made, not a different one.
    expect((await post(ROUTES.authApple, { idToken: "ok:apple:no-terms", terms: false })).status).toBe(400);
  });

  it("stamps the consent boxes onto the account the sign-in lands on", async () => {
    const res = await post(ROUTES.authGoogle, { idToken: "ok:google:consented", terms: true, marketing: true });
    const { userId } = await res.json() as { userId: string };
    const consent = await store.consentOf(userId);
    expect(consent?.termsAcceptedAt).not.toBeNull();
    expect(consent?.marketingConsentAt).not.toBeNull();
  });

  it("leaves a ticked marketing box ticked — an unticked one never erases it", async () => {
    const first = await (await post(
      ROUTES.authGoogle, { idToken: "ok:google:consent-keeps", terms: true, marketing: true },
    )).json() as { userId: string };
    // A returning sign-in without the optional box ticked must not un-consent them.
    const again = await (await post(
      ROUTES.authGoogle, { idToken: "ok:google:consent-keeps", terms: true },
    )).json() as { userId: string };
    expect(again.userId).toBe(first.userId);
    const consent = await store.consentOf(first.userId);
    expect(consent?.termsAcceptedAt).not.toBeNull();
    expect(consent?.marketingConsentAt).not.toBeNull();
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
    const res = await post(ROUTES.authDevice, { deviceId: crypto.randomUUID() + crypto.randomUUID(), locale: "en-GB" });
    const { token } = await res.json() as { token: string };
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

    const real = await (await post(ROUTES.authApple, { idToken: "ok:apple:merge-sub", terms: true })).json() as { token: string };
    await patch(ROUTES.profile, { goal: "lose", weight_kg: 88, complete_onboarding: true }, real.token);

    const merged = await (await post(
      ROUTES.authApple, { idToken: "ok:apple:merge-sub", terms: true }, anon.token,
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

describe("POST /v1/auth/pair", () => {
  it("mints a code and says when it dies", async () => {
    const token = await session();
    const res = await post(ROUTES.authPair, {}, token);
    expect(res.status).toBe(200);
    const body = await res.json() as PairCodeResponse;
    expect(body.code).toMatch(/^[0-9A-HJKMNP-TV-Z]{8}$/);
    expect(Date.parse(body.expiresAt)).toBeGreaterThan(Date.now());
  });

  it("needs a bearer — there is nothing here for an unauthenticated caller", async () => {
    const res = await post(ROUTES.authPair, {});
    expect(res.status).toBe(401);
  });

  /**
   * #408. THE ADDRESS COMES FROM THE SERVER, because the app that prints it outlives the server
   * that serves it.
   *
   * Every build already on a phone derived this string from its own compiled-in `API_URL` and
   * printed `api.eait.fit/start`. That name stops serving the page the day #395 finishes, and a
   * shipped binary cannot be told otherwise — which is why `api/routes.ts` answers those with a
   * permanent 301 and why this field exists: the NEXT move needs no new build.
   */
  it("sends the pairing address on the browser's origin, not the API's", async () => {
    const s = memoryStore();
    const config: Config = { ...CONFIG, publicApiUrl: "https://api.eait.fit", publicWebUrl: "https://app.eait.fit" };
    const h = createRouter({ store: s, config, llm: demoPorts(), push: fakePush() }, s, testVerifier);
    const res = await h(new Request("https://api.eait.fit" + ROUTES.authDevice, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deviceId: crypto.randomUUID() + crypto.randomUUID() }),
    }));
    const { token } = await res.json() as { token: string };
    const view = await (await h(new Request("https://api.eait.fit" + ROUTES.profile, {
      headers: { authorization: `Bearer ${token}` },
    }))).json() as ProfileResponse;

    // The host a person types into an address bar, and the path that answers there. No scheme:
    // this is read aloud off a phone screen.
    expect(view.pairAddress).toBe("app.eait.fit/start");
  });

  it("falls back to the API's own origin, which is every host that has not moved yet", async () => {
    const s = memoryStore();
    const config: Config = { ...CONFIG, publicApiUrl: "https://api.eait.fit", publicWebUrl: "" };
    const h = createRouter({ store: s, config, llm: demoPorts(), push: fakePush() }, s, testVerifier);
    const res = await h(new Request("https://api.eait.fit" + ROUTES.authDevice, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deviceId: crypto.randomUUID() + crypto.randomUUID() }),
    }));
    const { token } = await res.json() as { token: string };
    const view = await (await h(new Request("https://api.eait.fit" + ROUTES.profile, {
      headers: { authorization: `Bearer ${token}` },
    }))).json() as ProfileResponse;
    expect(view.pairAddress).toBe("api.eait.fit/start");
  });

  it("names the Telegram bot only while the connector has reached Telegram, read per request", async () => {
    // The SAME config object the connector writes the username onto after getMe, and empties again
    // on a dead token. A copy taken at router construction would keep a link to a bot that is gone.
    const s = memoryStore();
    const config: Config = { ...CONFIG };
    const h = createRouter({ store: s, config, llm: demoPorts(), push: fakePush() }, s, testVerifier);
    const res = await h(new Request("https://api.eait.fit" + ROUTES.authDevice, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deviceId: crypto.randomUUID() + crypto.randomUUID() }),
    }));
    const { token } = await res.json() as { token: string };
    const read = async () => (await (await h(new Request("https://api.eait.fit" + ROUTES.profile, {
      headers: { authorization: `Bearer ${token}` },
    }))).json() as ProfileResponse).telegramBot;

    expect(await read()).toBeNull();
    config.telegramBotUsername = "eait_test_bot";
    expect(await read()).toBe("eait_test_bot");
    config.telegramBotUsername = "";
    expect(await read()).toBeNull();
  });

  it("says nothing rather than guessing when this server knows neither origin", async () => {
    // Development, where nobody sets either variable. An empty string is what lets the app keep
    // using the host it is already talking to — a guess made here would be wrong on every
    // worktree at once, and wrong in a string a person is asked to type.
    const token = await session();
    const view = await (await get(ROUTES.profile, token)).json() as ProfileResponse;
    expect(view.pairAddress).toBe("");
  });

  /**
   * THE INVARIANT, with a crafted body.
   *
   * `userId` is resolved from the credential and passed as an argument; a request that names
   * somebody else names nothing. This is the assertion that would fail the day a handler starts
   * reading the body, and it is worth more here than anywhere else on the server, because what this
   * route hands out is a way into an account.
   */
  it("mints for the BEARER's account even when the body names another user", async () => {
    const mine = await session();
    const theirs = await session();
    const victim = (await (await get(ROUTES.profile, theirs)).json() as { profile: { user_id: string } })
      .profile.user_id;

    const { code } = await (await post(ROUTES.authPair, { userId: victim }, mine)).json() as PairCodeResponse;
    const paired = await redeemPairingCode(
      { store, config: CONFIG, llm: demoPorts(), push: fakePush() },
      code,
    );
    const landedOn = await store.userIdForToken(paired!);
    expect(landedOn).not.toBe(victim);
    expect(landedOn).toBe(await store.userIdForToken(mine));
  });

  it("takes the session-minting allowance, because it mints the thing that mints a session", async () => {
    const s = memoryStore();
    const config: Config = { ...CONFIG, authRateLimitPerHour: 2 };
    const h = createRouter(
      { store: s, config, llm: demoPorts(), push: fakePush() }, s, testVerifier);
    const address = "203.0.113.77";
    const reg = await h(new Request(url(ROUTES.authDevice), {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": address },
      body: JSON.stringify({ deviceId: crypto.randomUUID() + crypto.randomUUID() }),
    }));
    const { token } = await reg.json() as { token: string };
    const pair = () => h(new Request(url(ROUTES.authPair), {
      method: "POST",
      headers: { "x-forwarded-for": address, authorization: `Bearer ${token}` },
    }));
    // The registration above already spent one of the two.
    expect((await pair()).status).toBe(200);
    const refused = await pair();
    expect(refused.status).toBe(429);
    expect(await refused.json()).toEqual({ error: "rate-limited" });
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
    return createRouter({ store: s, config, llm: demoPorts(), push: fakePush() }, s, testVerifier);
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
    // error it does not recognise is reported to the user as "couldn't reach eait" — for a request
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
      // S8: a device account alone is anonymous and refused analysis — sign it in first.
      await h(new Request(url(ROUTES.authGoogle), {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ idToken: `ok:google:rl-${crypto.randomUUID()}`, terms: true }),
      }));
      await h(new Request(url(ROUTES.profile), {
        method: "PATCH",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({
          goal: "lose", sex: "female", birth_year: 1990, height_cm: 165, weight_kg: 70,
          target_weight_kg: 65, activity: "some", pace: "steady", country: "gb",
          restrictions: [], complete_onboarding: true,
        }),
      }));
      return token;
    };

    const photo = (token: string) => {
      const form = new FormData();
      form.append("photo", new File([jpegBytes(7)], "m.jpg", { type: "image/jpeg" }));
      return h(new Request(url(ROUTES.photo), {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "x-forwarded-for": address, "content-length": DECLARED_LENGTH },
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

  it("bounds a re-analysis by address in the same bucket as the photo it re-reads", async () => {
    const h = routerWith({ analysisRateLimitPerDay: 2, freeAnalyses: 99 });
    const address = "203.0.113.10";
    const { token } = await (await registerFrom(h, address)).json() as { token: string };
    // S8: a device account alone is anonymous and refused analysis — sign it in first.
    await h(new Request(url(ROUTES.authGoogle), {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ idToken: `ok:google:${crypto.randomUUID()}`, terms: true }),
    }));
    await h(new Request(url(ROUTES.profile), {
      method: "PATCH",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({
        goal: "lose", sex: "female", birth_year: 1990, height_cm: 165, weight_kg: 70,
        target_weight_kg: 65, activity: "some", pace: "steady", country: "gb",
        restrictions: [], complete_onboarding: true,
      }),
    }));
    const form = new FormData();
    form.append("photo", new File([jpegBytes(7)], "m.jpg", { type: "image/jpeg" }));
    // Under a key, which the photo turn claims — and which must buy a re-analysis nothing: that route
    // runs the model every time, so a claimed key there is no replay (#708 review, round 2).
    const key = crypto.randomUUID();
    const logged = await (await h(new Request(url(ROUTES.photo), {
      method: "POST", headers: { authorization: `Bearer ${token}`, "x-forwarded-for": address, "content-length": DECLARED_LENGTH, [IDEMPOTENCY_KEY]: key }, body: form,
    }))).json() as { mealId: string };
    const reanalyze = () => h(new Request(url(ROUTES.mealReanalyze(logged.mealId)), {
      method: "POST", headers: { authorization: `Bearer ${token}`, "x-forwarded-for": address, [IDEMPOTENCY_KEY]: key },
    }));
    expect((await reanalyze()).status).toBe(200);
    const refused = await reanalyze();
    expect(refused.status).toBe(429);
    expect(await refused.json()).toEqual({ error: "cap-exceeded", scope: "address" });
  });

  it("bounds a message edit by address in the same bucket as the photo it re-reads (#608)", async () => {
    const h = routerWith({ analysisRateLimitPerDay: 2, freeAnalyses: 99 });
    const address = "203.0.113.11";
    const { token } = await (await registerFrom(h, address)).json() as { token: string };
    // S8: a device account alone is anonymous and refused analysis — sign it in first.
    await h(new Request(url(ROUTES.authGoogle), {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ idToken: `ok:google:${crypto.randomUUID()}`, terms: true }),
    }));
    await h(new Request(url(ROUTES.profile), {
      method: "PATCH",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({
        goal: "lose", sex: "female", birth_year: 1990, height_cm: 165, weight_kg: 70,
        target_weight_kg: 65, activity: "some", pace: "steady", country: "gb",
        restrictions: [], complete_onboarding: true,
      }),
    }));
    const form = new FormData();
    form.append("photo", new File([jpegBytes(7)], "m.jpg", { type: "image/jpeg" }));
    await h(new Request(url(ROUTES.photo), {
      method: "POST", headers: { authorization: `Bearer ${token}`, "x-forwarded-for": address, "content-length": DECLARED_LENGTH }, body: form,
    }));
    const { entries } = await (await h(new Request(url(ROUTES.messages), { headers: { authorization: `Bearer ${token}` } }))).json() as ChatHistoryResponse;
    const line = entries.find((e) => e.role === "user" && e.kind === "photo")!;
    const edit = () => {
      const f = new FormData();
      f.append("text", "x");
      return h(new Request(url(ROUTES.message(line.id)), {
        method: "PATCH",
        headers: { authorization: `Bearer ${token}`, "x-forwarded-for": address, "content-length": DECLARED_LENGTH },
        body: f,
      }));
    };
    expect((await edit()).status).toBe(200);
    const refused = await edit();
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

describe("push opens (ieat-app#1759)", () => {
  async function sendFor(t: string): Promise<string> {
    const id = crypto.randomUUID();
    await store.createSend((await store.userIdForToken(t))!, {
      id, kind: "campaign", ref: null, templateKey: "route-t", lang: "en", variant: null,
      token: "ExponentPushToken[route]", state: "accepted",
    });
    return id;
  }
  const opened = async () =>
    (await store.pushOpenStats(2, "UTC")).filter((r) => r.templateKey === "route-t").reduce((n, r) => n + r.opened, 0);

  it("records an open, once, however often it is reported", async () => {
    const t = await session();
    const sendId = await sendFor(t);
    for (let i = 0; i < 2; i++) {
      const res = await post(ROUTES.pushOpen, { sendId, action: "tap" }, t);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
    }
    expect(await opened()).toBe(1);
  });

  it("answers the same for another account's send and records nothing", async () => {
    const mine = await session();
    const theirs = await session();
    const sendId = await sendFor(theirs);
    const res = await post(ROUTES.pushOpen, { sendId }, mine);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(await opened()).toBe(0);
  });

  it("refuses a body that is not an open, and needs a session", async () => {
    const t = await session();
    for (const body of [{}, { sendId: "" }, { sendId: 4 }, { sendId: "x", action: "swipe" }]) {
      expect((await post(ROUTES.pushOpen, body, t)).status).toBe(400);
    }
    expect((await post(ROUTES.pushOpen, { sendId: "x" })).status).toBe(401);
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

  it("stores the zone the app reports on open, and ignores one it cannot use", async () => {
    const t = await session();
    const userId = (await store.userIdForToken(t))!;
    const tz = async () => (await store.pushAudience()).find((r) => r.userId === userId)?.timezone;
    await post(ROUTES.pushToken, { token: token(), platform: "ios", timezone: "Asia/Tokyo" }, t);
    expect(await tz()).toBe("Asia/Tokyo");
    // An unusable zone is not a reason to refuse the token: the registration still lands, the zone stays.
    const res = await post(ROUTES.pushToken, { token: token(), platform: "ios", timezone: "Mars/Base" }, t);
    expect(res.status).toBe(200);
    expect(await tz()).toBe("Asia/Tokyo");
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
    const h = createRouter({ store: s, config, llm: demoPorts(), push: fakePush() }, s, testVerifier);
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

describe("the streamed photo route", () => {
  /** The stream, read whole and parsed line by line. */
  async function ndjson(res: Response): Promise<PhotoEvent[]> {
    return (await res.text()).split("\n").filter(Boolean).map((l) => JSON.parse(l) as PhotoEvent);
  }
  const streamed = (token: string, files = 1, caption?: string) => {
    const req = photoRequest(token, files, caption);
    req.headers.set("accept", NDJSON);
    return handle(req);
  };

  it("streams NDJSON when asked: the reading line and the items — each carrying its words — then the result as the last line", async () => {
    const token = await session();
    const res = await streamed(token);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe(NDJSON);
    const events = await ndjson(res);
    // `reading` opens the stream — the client's pending line, already worded, never composed there.
    expect(events[0]).toEqual({ kind: "reading", line: expect.any(String) });
    const last = events.at(-1) as MealLogged;
    expect(last.kind).toBe("logged");
    expect(events.filter((e) => e.kind === "item").length).toBe(last.analysis.items.length);
    for (const e of events) if (e.kind === "item") expect(typeof e.line).toBe("string");
  });

  it("answers JSON, as before, without the accept header", async () => {
    const token = await session();
    const res = await handle(photoRequest(token));
    expect(res.headers.get("content-type")).toBe("application/json");
    expect(((await res.json()) as { kind: string }).kind).toBe("logged");
  });

  it("puts an engine refusal on the last line of a 200 stream", async () => {
    const token = await session();
    const res = await streamed(token, 1, DEMO_NOT_FOOD);
    expect(res.status).toBe(200);
    const events = await ndjson(res);
    expect(events.at(-1)).toEqual({ kind: "not-food" });
  });

  it("words a throw after the meal was logged as an unknown outcome, never as a failed analysis (#514)", async () => {
    const token = await session();
    // The day's totals are read AFTER the insert, so a store failing there fails a turn whose meal
    // is already in the diary.
    const read = store.mealsForDate;
    store.mealsForDate = async () => { throw new Error("the database went away"); };
    const events = await ndjson(await streamed(token));
    store.mealsForDate = read;
    expect(events.at(-1)).toEqual({ kind: OUTCOME_UNKNOWN });
    const day = await (await get(ROUTES.day, token)).json() as { meals: unknown[] };
    expect(day.meals.length).toBe(1);
  });

  it("logs the meal even when the reader cancels after the first line — the charge stood, so the diary must too", async () => {
    const token = await session();
    const reader = (await streamed(token)).body!.getReader();
    expect((await reader.read()).done).toBe(false);
    await reader.cancel();
    // The demo analyzer is still streaming its chunks into a closed stream. The meal lands anyway.
    for (let i = 0; i < 40; i++) {
      const day = await (await get(ROUTES.day, token)).json() as { meals: unknown[] };
      if (day.meals.length === 1) return;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error("the meal never landed after the reader cancelled");
  });

  it("still 413s an oversized body on the streaming path", async () => {
    const token = await session();
    const res = await handle(new Request(url(ROUTES.photo), {
      method: "POST", body: new FormData(),
      headers: { authorization: `Bearer ${token}`, accept: NDJSON, "content-length": String(50 * 1024 * 1024) },
    }));
    expect(res.status).toBe(413);
  });
});

describe("the stream's keepalive", () => {
  it("writes blank lines while the analyzer is silent, and the client's splitter ignores them", async () => {
    const slow: LlmPorts = {
      ...demoPorts(),
      analyzePhoto: async (input, onDelta) => {
        await new Promise((r) => setTimeout(r, 120));
        return demoPorts().analyzePhoto(input, onDelta);
      },
    };
    const deps: EngineDeps = { store, config: CONFIG, llm: slow, push: fakePush() };
    const h = createRouter(deps, store, testVerifier, { streamKeepaliveMs: 20 });
    const res = await post(ROUTES.authDevice, { deviceId: crypto.randomUUID() + crypto.randomUUID(), locale: "en-GB" });
    const { token } = await res.json() as { token: string };
    // Signed in, like every account that may analyse — an anonymous one is refused (S8).
    await h(new Request(url(ROUTES.authGoogle), {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ idToken: `ok:google:ka-${crypto.randomUUID()}`, terms: true }),
    }));
    await patch(ROUTES.profile, {
      goal: "lose", sex: "female", birth_year: 1990, height_cm: 165, weight_kg: 70,
      target_weight_kg: 65, activity: "some", pace: "steady", country: "gb",
      restrictions: [], complete_onboarding: true,
    }, token);
    const req = photoRequest(token);
    req.headers.set("accept", NDJSON);
    const text = await (await h(req)).text();
    const raw = text.split("\n");
    // At least three blank lines in ~120 ms of silence, and the last line is still the result.
    expect(raw.filter((l) => l === "").length).toBeGreaterThanOrEqual(3);
    const lines = raw.filter(Boolean).map((l) => JSON.parse(l) as PhotoEvent);
    expect(lines.at(-1)!.kind).toBe("logged");
  });
});

describe("the text turn, streamed (#508)", () => {
  it("answers as its last line, past the keepalives", async () => {
    const slow: LlmPorts = {
      ...demoPorts(),
      routeText: async (...args) => {
        await new Promise((r) => setTimeout(r, 120));
        return demoPorts().routeText(...args);
      },
    };
    const deps: EngineDeps = { store, config: CONFIG, llm: slow, push: fakePush() };
    const h = createRouter(deps, store, testVerifier, { streamKeepaliveMs: 20 });
    const res = await h(new Request(url(ROUTES.messages), {
      method: "POST",
      headers: { authorization: `Bearer ${await session()}`, "content-type": "application/json", accept: NDJSON },
      body: JSON.stringify({ text: "how did my week go?" }),
    }));
    expect(res.headers.get("content-type")).toBe(NDJSON);
    const raw = (await res.text()).split("\n");
    expect(raw.filter((l) => l === "").length).toBeGreaterThanOrEqual(3);
    expect((JSON.parse(raw.filter(Boolean).at(-1)!) as { kind: string }).kind).toBe("answered");
  });

  it("refuses in-band once the stream has begun, and with a status before it", async () => {
    // A fresh device account has no profile, and the ENGINE is what says so, after the 200 went out.
    const minted = await post(ROUTES.authDevice, { deviceId: crypto.randomUUID() + crypto.randomUUID(), locale: "en-GB" });
    const { token } = await minted.json() as { token: string };
    const turn = (text: string) => handle(new Request(url(ROUTES.messages), {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json", accept: NDJSON },
      body: JSON.stringify({ text }),
    }));
    const streamed = await turn("two eggs");
    expect(streamed.status).toBe(200);
    expect(JSON.parse((await streamed.text()).trim().split("\n").at(-1)!)).toEqual({ kind: "not-onboarded" });
    // What the route refuses before the engine runs is still a status, stream or no stream.
    expect((await turn(" ")).status).toBe(400);
  });

  it("answers JSON, as before, without the accept header", async () => {
    const res = await post(ROUTES.messages, { text: "how did my week go?" }, await session());
    expect(res.headers.get("content-type")).toBe("application/json");
    expect(((await res.json()) as { kind: string }).kind).toBe("answered");
  });
});

describe("GET /v1/meals/:id/photos/:n", () => {
  it("returns the caller's photo with its sniffed mime, and nothing to anyone else", async () => {
    const token = await session();
    const logged = await (await handle(photoRequest(token, 2))).json() as { mealId: string };
    const res = await get(ROUTES.mealPhoto(logged.mealId, 1), token);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(res.headers.get("cache-control")).toBe("private, max-age=31536000, immutable");
    expect(Array.from(new Uint8Array(await res.arrayBuffer()))).toEqual(Array.from(jpegBytes(2)));

    expect((await get(ROUTES.mealPhoto(logged.mealId, 2), token)).status).toBe(404);
    expect((await get(ROUTES.mealPhoto(logged.mealId, 0), await session())).status).toBe(404);
    expect((await get(ROUTES.mealPhoto(logged.mealId, 0))).status).toBe(401);
  });
});

describe("POST /v1/meals/:id/reanalyze", () => {
  it("re-reads the photo for the owner and 404s a meal with none", async () => {
    const token = await session();
    const logged = await (await handle(photoRequest(token))).json() as { mealId: string };
    const res = await post(ROUTES.mealReanalyze(logged.mealId), {}, token);
    expect(res.status).toBe(200);
    expect((await res.json() as { via: string }).via).toBe("reanalysis");
    expect((await post(ROUTES.mealReanalyze(logged.mealId), {}, await session())).status).toBe(409);
    const proposed = await (await post(ROUTES.messages, { text: "a bowl of rice" }, token)).json() as { pendingId: string };
    const textMeal = await (await post(ROUTES.pendingConfirm(proposed.pendingId), {}, token)).json() as { mealId: string };
    const none = await post(ROUTES.mealReanalyze(textMeal.mealId), {}, token);
    expect(none.status).toBe(404);
    expect((await none.json() as { error: string }).error).toBe("no-photo");
  });
});
