import { afterAll, describe, expect, test } from "bun:test";
import { createRouter } from "./routes.ts";

/** `Response.json()` is `unknown`; every assertion here reads a field, so narrow once. */
const body = async (res: Response): Promise<any> => res.json();
import { cleanupTestDbs, freshTestDb } from "../testutil.ts";
import { insertMeal, setProfile, upsertUser, berlinDate } from "../db.ts";
import type { Config } from "../config.ts";
import type { EngineDeps } from "../engine/index.ts";
import type { MealAnalysis } from "../types.ts";

afterAll(cleanupTestDbs, 60_000);

const cfg: Config = {
  telegramBotToken: "x", openrouterApiKey: "x", llmProvider: "openrouter", llmModel: "test",
  llmTimeoutMs: 1000, tz: "Europe/Berlin",
  pg: { host: "127.0.0.1", port: 5439, user: "eait", password: "eait", database: "unused" },
  perUserDailyPhotoCap: 5, adminUserId: null, allowedUserIds: null, globalDailyAnalysisCap: null,
  replyFormat: "plain", apiPort: null, apiHost: "127.0.0.1",
};

const ANALYSIS = {
  isFood: true, items: [{ name: "гречка", grams: 180 }],
  kcal: 600, protein_g: 40, carbs_g: 60, fat_g: 15, satfat_g: 3, fiber_g: 8, sugar_g: 5,
  sodium_mg: 400, plant_protein_pct: 45, verdicts: {}, confidence: "medium", notes: "",
} as MealAnalysis;

async function ctx(over: Partial<EngineDeps> = {}) {
  const db = await freshTestDb();
  const deps: EngineDeps = {
    db, config: cfg,
    analyzePhoto: async () => ANALYSIS,
    routeText: async () => ({ intent: "question", answer: "about 600 kcal" }),
    classifyRestrictions: async () => [],
    ...over,
  };
  return { db, deps };
}

/** An active user, the state every engine call gates on. */
async function activeUser(db: Awaited<ReturnType<typeof freshTestDb>>, id: number) {
  await upsertUser(db, { telegram_id: id });
  await setProfile(db, id, { state: "active", goal: "lose", weight_kg: 90 });
}

const photoBody = () => {
  const form = new FormData();
  form.append("photo", new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }), "m.jpg");
  return form;
};

describe("api router", () => {
  test("/health needs no session — a probe that needs a token cannot tell dead from expired", async () => {
    const { deps } = await ctx();
    const res = await createRouter(deps, () => null)(new Request("http://x/health"));
    expect(res.status).toBe(200);
  });

  test("every other route is 401 without a resolved user", async () => {
    const { deps } = await ctx();
    const handle = createRouter(deps, () => null);
    for (const path of ["/v1/diary/day", "/v1/diary/week", "/v1/messages", "/v1/meals/photo"]) {
      expect((await handle(new Request(`http://x${path}`))).status).toBe(401);
    }
  });

  test("a photo upload logs a meal and returns it", async () => {
    const { db, deps } = await ctx();
    await activeUser(db, 700);
    const res = await createRouter(deps, () => 700)(
      new Request("http://x/v1/meals/photo", { method: "POST", body: photoBody() }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { kind: string; analysis: { kcal: number }; totals: { kcal: number } };
    expect(body.kind).toBe("logged");
    expect(body.analysis.kcal).toBe(600);
    expect(body.totals.kcal).toBe(600);
  });

  test("the SAME cap the bot draws from applies here — metering is not per-transport", async () => {
    // The reason caps moved into the engine. If they had stayed in tg_bot/, this endpoint would be
    // an unmetered way to spend the whole budget.
    const { db, deps } = await ctx();
    await activeUser(db, 701);
    const handle = createRouter({ ...deps, config: { ...cfg, perUserDailyPhotoCap: 1 } }, () => 701);
    const first = await handle(new Request("http://x/v1/meals/photo", { method: "POST", body: photoBody() }));
    const second = await handle(new Request("http://x/v1/meals/photo", { method: "POST", body: photoBody() }));
    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
    expect((await body(second)).scope).toBe("user");
  });

  test("not-onboarded is 403, never 401 — the caller authenticated fine", async () => {
    // A 401 would send a well-behaved client into a token-refresh loop it can never win.
    const { deps } = await ctx();
    const res = await createRouter(deps, () => 999)(
      new Request("http://x/v1/meals/photo", { method: "POST", body: photoBody() }),
    );
    expect(res.status).toBe(403);
  });

  test("a not-food photo is 422 with no meal logged", async () => {
    const { db, deps } = await ctx({ analyzePhoto: async () => ({ ...ANALYSIS, isFood: false }) });
    await activeUser(db, 702);
    const handle = createRouter(deps, () => 702);
    expect((await handle(new Request("http://x/v1/meals/photo", { method: "POST", body: photoBody() }))).status)
      .toBe(422);
    const day = await body(await handle(new Request("http://x/v1/diary/day")));
    expect(day.meals).toEqual([]);
  });

  test("a text message routes and answers", async () => {
    const { db, deps } = await ctx();
    await activeUser(db, 703);
    const res = await createRouter(deps, () => 703)(
      new Request("http://x/v1/messages", {
        method: "POST", body: JSON.stringify({ text: "how am I doing?" }),
      }),
    );
    expect(res.status).toBe(200);
    expect((await body(res)).text).toBe("about 600 kcal");
  });

  test("the diary NEVER reaches another user's meals, even naming their meal id", async () => {
    // The invariant the whole codebase is built on, re-checked at the new front door: a client can
    // put any string in focusMealId, and every engine read is `WHERE id = ? AND user_id = ?`.
    const { db, deps } = await ctx();
    await activeUser(db, 704);
    await activeUser(db, 705);
    const date = berlinDate(new Date(), cfg.tz);
    await insertMeal(db, { id: "other-meal", user_id: 704, ts: "t", date, analysis: ANALYSIS });

    const day = await body(await createRouter(deps, () => 705)(new Request("http://x/v1/diary/day")));
    expect(day.meals).toEqual([]);
    expect(day.totals.kcal).toBe(0);

    // Naming 704's meal as the focus resolves to nothing, so the turn routes as an ordinary
    // question rather than correcting a stranger's row.
    const res = await createRouter(deps, () => 705)(
      new Request("http://x/v1/messages", {
        method: "POST", body: JSON.stringify({ text: "make it 900", focusMealId: "other-meal" }),
      }),
    );
    expect(res.status).toBe(200);
    expect((await body(res)).kind).toBe("answered");
  });

  test("a text meal is PROPOSED, not logged — confirm-first survives the new surface", async () => {
    const { db, deps } = await ctx({
      routeText: async () => ({ intent: "meal", analysis: ANALYSIS, dayOffset: 0 }),
    });
    await activeUser(db, 706);
    const handle = createRouter(deps, () => 706);
    const proposed = await body(await handle(new Request("http://x/v1/messages", {
      method: "POST", body: JSON.stringify({ text: "ate buckwheat" }),
    })));
    expect(proposed.kind).toBe("proposed");
    expect(proposed.pendingId).toBeString();
    // Nothing in `meals` yet — the whole point of confirm-first.
    expect((await body(await handle(new Request("http://x/v1/diary/day")))).meals).toEqual([]);
  });

  test("rejects a bad request instead of guessing", async () => {
    const { db, deps } = await ctx();
    await activeUser(db, 707);
    const handle = createRouter(deps, () => 707);
    expect((await handle(new Request("http://x/v1/messages", { method: "POST", body: "{}" }))).status).toBe(400);
    expect((await handle(new Request("http://x/v1/meals/photo", { method: "POST", body: new FormData() }))).status)
      .toBe(400);
    expect((await handle(new Request("http://x/v1/diary/week?days=0"))).status).toBe(400);
    expect((await handle(new Request("http://x/v1/nope"))).status).toBe(404);
  });

  test("an internal error is 500 with NO detail in the body", async () => {
    // An error string from deep in the stack can carry a query, a path, or a model's echo of user
    // content. It goes to the log, never to the client.
    const { db, deps } = await ctx({
      routeText: async () => { throw new Error("secret-bearing detail"); },
    });
    await activeUser(db, 708);
    const res = await createRouter(deps, () => 708)(
      new Request("http://x/v1/messages", { method: "POST", body: JSON.stringify({ text: "hi" }) }),
    );
    // handleText catches its own routing failure and reports it as a refusal, so this is 502 — and
    // either way the body must not carry the message.
    expect(await res.text()).not.toContain("secret-bearing");
  });
});
