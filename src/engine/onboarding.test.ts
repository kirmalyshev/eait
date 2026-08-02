// Onboarding as an ENGINE flow, driven with no Telegram anywhere in the call.
//
// That is the whole point of these tests: every assertion here is one a mobile client would make,
// and none of them can be satisfied by code that lives in `tg_bot/`. Before this module the flow
// was reachable only through `processOnboarding`, so a second front end could log meals for a user
// it had no way to create.

import { afterAll, describe, expect, spyOn, test } from "bun:test";
import { advanceOnboarding } from "./onboarding.ts";
import { cleanupTestDbs, freshTestDb } from "../testutil.ts";
import { getUser, type Db } from "../db.ts";
import * as dbModule from "../db.ts";
import { translatorFor } from "../i18n/index.ts";
import type { Config } from "../config.ts";
import type { EngineDeps } from "./deps.ts";

afterAll(cleanupTestDbs, 60_000);

const cfg: Config = {
  telegramBotToken: "x", openrouterApiKey: "x", llmProvider: "openrouter", llmModel: "test",
  llmTimeoutMs: 1000, tz: "Europe/Berlin",
  pg: { host: "127.0.0.1", port: 5439, user: "eait", password: "eait", database: "unused" },
  perUserDailyPhotoCap: 5, adminUserId: null, allowedUserIds: null, globalDailyAnalysisCap: null,
  replyFormat: "plain", apiPort: null, apiHost: "127.0.0.1",
};

// The engine picks the language from the row and calls this; the surface owns construction.
const tf = translatorFor;

async function ctx(over: Partial<EngineDeps> = {}) {
  const db = await freshTestDb();
  const deps: EngineDeps = {
    db, config: cfg,
    analyzePhoto: async () => { throw new Error("unused"); },
    routeText: async () => { throw new Error("unused"); },
    classifyRestrictions: async () => [],
    ...over,
  };
  return { db, deps };
}

/** The whole flow, consent to active, with no surface in sight. */
async function runToActive(deps: EngineDeps, id: number) {
  await advanceOnboarding(deps, id, { input: { type: "command", command: "start" } }, tf);
  await advanceOnboarding(deps, id, { input: { type: "callback", data: "consent_agree" } }, tf);
  await advanceOnboarding(deps, id, { input: { type: "callback", data: "goal_lose" } }, tf);
  await advanceOnboarding(deps, id, { input: { type: "text", text: "93" } }, tf);
  await advanceOnboarding(deps, id, { input: { type: "text", text: "85" } }, tf);
  await advanceOnboarding(deps, id, { input: { type: "callback", data: "country_de" } }, tf);
  return advanceOnboarding(deps, id, { input: { type: "text", text: "kidneys, no sugar" } }, tf);
}

describe("advanceOnboarding", () => {
  test("first contact creates the user and returns the consent view", async () => {
    const { db, deps } = await ctx();
    const r = await advanceOnboarding(
      deps, 900,
      { input: { type: "command", command: "start" }, username: "kir", langHint: "en" },
      tf,
    );
    expect(r.reply.length).toBeGreaterThan(0);
    expect(r.buttons?.flat().map((b) => b.data)).toContain("consent_agree");
    const u = await getUser(db, 900);
    expect(u?.username).toBe("kir");
    expect(u?.state).toBe("consent");
  });

  test("a full run persists every profile field and ends active", async () => {
    const { db, deps } = await ctx();
    const r = await runToActive(deps, 901);
    expect(r.nextState).toBe("active");
    const u = await getUser(db, 901);
    expect(u?.state).toBe("active");
    expect(u?.goal).toBe("lose");
    expect(u?.weight_kg).toBe(93);
    expect(u?.target_weight_kg).toBe(85);
    expect(u?.country).toBe("de");
    expect(u?.restrictions).toContain("kidneys");
    expect(u?.consent_at).toBeTruthy();
  });

  test("onboarding_complete is logged exactly once, on the transition", async () => {
    const { db, deps } = await ctx();
    await runToActive(deps, 902);
    // A stale re-tap of the last step must not log a second completion.
    await advanceOnboarding(deps, 902, { input: { type: "command", command: "start" } }, tf);
    const rows = await db`SELECT count(*)::int AS n FROM events
      WHERE user_id = 902 AND event = 'onboarding_complete'`;
    expect((rows[0] as { n: number }).n).toBe(1);
  });

  test("the classifier refines tags the keyword parse missed", async () => {
    // "Nieren" is German for kidneys and the keyword table does not know it — the exact gap the
    // fallback exists to close, and it must work for an API client too.
    const { db, deps } = await ctx({ classifyRestrictions: async () => ["kidneys"] });
    await advanceOnboarding(deps, 903, { input: { type: "command", command: "start" } }, tf);
    await advanceOnboarding(deps, 903, { input: { type: "callback", data: "consent_agree" } }, tf);
    await advanceOnboarding(deps, 903, { input: { type: "callback", data: "goal_maintain" } }, tf);
    await advanceOnboarding(deps, 903, { input: { type: "callback", data: "weight_skip" } }, tf);
    await advanceOnboarding(deps, 903, { input: { type: "callback", data: "target_weight_skip" } }, tf);
    await advanceOnboarding(deps, 903, { input: { type: "callback", data: "country_skip" } }, tf);
    await advanceOnboarding(deps, 903, { input: { type: "text", text: "Nieren" } }, tf);
    const u = await getUser(db, 903);
    expect(u?.restrictions).toContain("kidneys");
    // Metered like every other model call, and NOT cap-gated.
    const rows = await db`SELECT count(*)::int AS n FROM llm_calls
      WHERE user_id = 903 AND kind = 'classify'`;
    expect((rows[0] as { n: number }).n).toBe(1);
  });

  test("a classifier failure keeps the keyword parse instead of losing the answer", async () => {
    const { db, deps } = await ctx({
      classifyRestrictions: async () => { throw new Error("model down"); },
    });
    await advanceOnboarding(deps, 904, { input: { type: "command", command: "start" } }, tf);
    await advanceOnboarding(deps, 904, { input: { type: "callback", data: "consent_agree" } }, tf);
    await advanceOnboarding(deps, 904, { input: { type: "callback", data: "goal_lose" } }, tf);
    await advanceOnboarding(deps, 904, { input: { type: "callback", data: "weight_skip" } }, tf);
    await advanceOnboarding(deps, 904, { input: { type: "callback", data: "target_weight_skip" } }, tf);
    await advanceOnboarding(deps, 904, { input: { type: "callback", data: "country_skip" } }, tf);
    const r = await advanceOnboarding(deps, 904, { input: { type: "text", text: "kidneys" } }, tf);
    // The deterministic parse still landed, and the user still reached active.
    expect(r.nextState).toBe("active");
    const u = await getUser(db, 904);
    expect(u?.restrictions).toContain("kidneys");
    expect(u?.medical_limitations).toBe("kidneys");
  });

  test("an explicit skip is never second-guessed by the model", async () => {
    let called = false;
    const { db, deps } = await ctx({
      classifyRestrictions: async () => { called = true; return ["kidneys"]; },
    });
    await advanceOnboarding(deps, 905, { input: { type: "command", command: "start" } }, tf);
    await advanceOnboarding(deps, 905, { input: { type: "callback", data: "consent_agree" } }, tf);
    await advanceOnboarding(deps, 905, { input: { type: "callback", data: "goal_lose" } }, tf);
    await advanceOnboarding(deps, 905, { input: { type: "callback", data: "weight_skip" } }, tf);
    await advanceOnboarding(deps, 905, { input: { type: "callback", data: "target_weight_skip" } }, tf);
    await advanceOnboarding(deps, 905, { input: { type: "callback", data: "country_skip" } }, tf);
    await advanceOnboarding(deps, 905, { input: { type: "callback", data: "restrictions_skip" } }, tf);
    expect(called).toBe(false);
    const u = await getUser(db, 905);
    expect(u?.state).toBe("active");
    expect(u?.restrictions).toEqual([]);
  });

  test("a deep-link payload is recorded; an out-of-grammar one is dropped", async () => {
    const { db, deps } = await ctx();
    await advanceOnboarding(
      deps, 906, { input: { type: "command", command: "start", payload: "tiktok_a1" } }, tf,
    );
    expect((await getUser(db, 906))?.acquisition_source).toBe("tiktok_a1");

    await advanceOnboarding(
      deps, 907, { input: { type: "command", command: "start", payload: "drop me; --" } }, tf,
    );
    expect((await getUser(db, 907))?.acquisition_source).toBeNull();
  });

  test("the surface's language hint seeds only the INSERT", async () => {
    const { db, deps } = await ctx();
    await advanceOnboarding(deps, 908, { input: { type: "command", command: "start" }, langHint: "ru" }, tf);
    expect((await getUser(db, 908))?.lang).toBe("ru");
    // A later contact carrying a different hint must not undo a deliberate /lang choice.
    await advanceOnboarding(deps, 908, { input: { type: "command", command: "start" }, langHint: "en" }, tf);
    expect((await getUser(db, 908))?.lang).toBe("ru");
  });

  test("the very first screen renders in the language the surface just negotiated", async () => {
    // The regression this guards: resolve a translator BEFORE the upsert and the row does not exist
    // yet, so every user's consent screen arrives in the default language no matter what they sent.
    const { deps } = await ctx();
    const ru = await advanceOnboarding(
      deps, 911, { input: { type: "command", command: "start" }, langHint: "ru" }, tf,
    );
    const en = await advanceOnboarding(
      deps, 912, { input: { type: "command", command: "start" }, langHint: "en" }, tf,
    );
    expect(ru.reply).not.toBe(en.reply);
    expect(ru.reply).toBe(translatorFor("ru")("onboarding.consent"));
  });

  test("a transition persists in a SINGLE setProfile UPDATE (atomic, not per-field)", async () => {
    // Moved from bot.test.ts with the code it covers. A step never mutates more than a couple of
    // fields, but N sequential writes mean a crash between two of them leaves a half-applied
    // transition — tags stored, medical_limitations NULL — and the resume then re-asks a question
    // the user already answered.
    const { db, deps } = await ctx();
    await advanceOnboarding(deps, 913, { input: { type: "command", command: "start" } }, tf);
    await advanceOnboarding(deps, 913, { input: { type: "callback", data: "consent_agree" } }, tf);
    await advanceOnboarding(deps, 913, { input: { type: "callback", data: "goal_lose" } }, tf);
    await advanceOnboarding(deps, 913, { input: { type: "callback", data: "weight_skip" } }, tf);
    await advanceOnboarding(deps, 913, { input: { type: "callback", data: "target_weight_skip" } }, tf);
    await advanceOnboarding(deps, 913, { input: { type: "callback", data: "country_skip" } }, tf);

    // bun's spyOn calls through by default, so the write still happens.
    const spy = spyOn(dbModule, "setProfile");
    try {
      // The restrictions step is the one that patches two fields at once (tags + raw words).
      await advanceOnboarding(deps, 913, { input: { type: "text", text: "kidneys, no peanuts" } }, tf);
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
    const u = (await getUser(db, 913))!;
    expect(u.restrictions).toEqual(["kidneys"]);
    expect(u.medical_limitations).toBe("kidneys, no peanuts");
    expect(u.state).toBe("active");
  });

  test("userId is an argument — one user's run never touches another's row", async () => {
    const { db, deps } = await ctx();
    await runToActive(deps, 909);
    await advanceOnboarding(deps, 910, { input: { type: "command", command: "start" } }, tf);
    expect((await getUser(db, 910))?.state).toBe("consent");
    expect((await getUser(db, 909))?.state).toBe("active");
  });
});

// Keeps the `Db` import honest — the raw handle is used for the event/meter count assertions above.
export type _Db = Db;
