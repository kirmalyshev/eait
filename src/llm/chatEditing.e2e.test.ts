// End-to-end: a chat-targeted edit through the REAL chain — Telegram surface → engine →
// `textRouterViaAgent` → Mastra agent → `find_meals` hitting Postgres → terminal tool → applied.
//
// WHY THIS EXISTS SEPARATELY from the surface tests in `tg_bot/bot.test.ts`. Those stub the
// `routeText` port, which is right for asserting what the bot does with a routing decision — but it
// means the one wiring failure that would only ever appear in production is untested: `userId` has
// to travel from `profile.telegram_id` → `buildRequestContext` → Mastra's `RequestContext` →
// `requireUserId` inside the tool → the SQL predicate. Every one of those hops is real code that no
// stubbed port exercises, and `find_meals` is the first tool to depend on the whole chain. A break
// anywhere in it is either "the bot cannot find any of your meals" or, far worse, somebody else's.
//
// The MODEL is scripted, deliberately — this asserts the wiring, not the model's judgement. What a
// real model chooses is what `scripts/parity-llm-paths.ts` and the fixture eval measure.

import { afterAll, describe, expect, test as bunTest } from "bun:test";
import { MockLanguageModelV4 } from "ai/test";
import { cleanupTestDbs, freshTestName, openTestDb } from "../testutil.ts";
import { createMastra } from "./mastra.ts";
import { createEngineAgent } from "./agent.ts";
import { textRouterViaAgent } from "./analyzePort.ts";
import { handleText } from "../engine/text.ts";
import { applyPendingEdit } from "../engine/edits.ts";
import { getMeal, insertMeal, upsertUser, setProfile, setUserState, berlinDate } from "../db.ts";
import type { Db } from "../db.ts";
import type { Config } from "../config.ts";
import type { MealAnalysis } from "../types.ts";

/**
 * Every test in this file builds a fresh database AND a Postgres-backed Mastra `Memory` (Mastra
 * engages memory on every `generate`, so a storage-less one fails before the model is consulted).
 * That is comfortably more than bun's 5s default under a loaded suite, and it fails as a bare
 * "(unnamed) timed out" with no clue which test it was. `bunfig.toml`'s `[test] timeout` is not
 * honoured by bun 1.3, so the allowance is applied here, once, by wrapping `test`.
 */
const AGENT_TEST_TIMEOUT_MS = 30_000;
const test = (name: string, fn: () => unknown) => bunTest(name, fn as never, AGENT_TEST_TIMEOUT_MS);


afterAll(cleanupTestDbs, 60_000);

const usage = {
  inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 0, text: 0, reasoning: 0 },
};

const cfg = {
  tz: "Europe/Berlin", llmModel: "test", perUserDailyPhotoCap: 50, globalDailyAnalysisCap: null,
} as unknown as Config;

const meal = (over: Partial<MealAnalysis> = {}): MealAnalysis => ({
  isFood: true,
  items: [{ name: "pasta carbonara", grams: 300 }],
  kcal: 520, protein_g: 22, carbs_g: 60, fat_g: 20,
  satfat_g: 8, fiber_g: 3, sugar_g: 4, sodium_mg: 600,
  plant_protein_pct: 20, verdicts: {}, confidence: "medium", notes: "",
  ...over,
});

/**
 * A model that calls `find_meals` on its first step, then feeds the id it got back into
 * `submit_correction` on the second. Records what the tool actually returned, so the assertion is
 * about the rows the agent saw rather than about what it was told to send.
 */
function twoStep(queries: string[]) {
  const seen = { found: undefined as unknown, steps: 0 };
  const model = new MockLanguageModelV4({
    doGenerate: async (opts: any) => {
      seen.steps++;
      // Mastra feeds tool results back as message parts; pull the find_meals result off the last one.
      const parts = (opts.prompt ?? []).flatMap((m: any) => (Array.isArray(m.content) ? m.content : []));
      const result = parts.filter((p: any) => p.type === "tool-result" && p.toolName === "find_meals").at(-1);
      if (result) seen.found = result.output?.value ?? result.output ?? result.result;

      if (!result) {
        return {
          finishReason: { unified: "tool-calls" as const, raw: undefined }, usage, warnings: [],
          content: [{
            type: "tool-call" as const, toolCallId: "c1", toolName: "find_meals",
            input: JSON.stringify({ queries }),
          }],
        };
      }
      const found = (seen.found as { meals?: { mealId: string }[] })?.meals ?? [];
      return {
        finishReason: { unified: "tool-calls" as const, raw: undefined }, usage, warnings: [],
        content: [{
          type: "tool-call" as const, toolCallId: "c2", toolName: "submit_correction",
          // The id comes from the TOOL's answer, never from the script — if the plumbing hands the
          // agent nothing, this call carries no mealId and the edit is refused.
          input: JSON.stringify({ ...meal({ kcal: 690, protein_g: 42 }), mealId: found[0]?.mealId }),
        }],
      };
    },
  });
  return { model, seen };
}

async function activeUser(db: Db, id: number) {
  await upsertUser(db, { telegram_id: id });
  await setProfile(db, id, { goal: "lose", weight_kg: 92, restrictions: [] });
  await setUserState(db, id, "active");
}

/** Engine deps over the REAL router port — the chain this file exists to exercise. */
async function engineFor(db: Db, database: string, model: MockLanguageModelV4) {
  const { memory } = await createMastra({
    host: process.env.PGHOST?.trim() || "127.0.0.1",
    port: Number(process.env.PGPORT) || 5439,
    user: process.env.PGUSER?.trim() || "eait",
    password: process.env.PGPASSWORD?.trim() || "eait",
    database,
  });
  const agent = createEngineAgent(model as never, memory, { db, tz: cfg.tz });
  return { db, config: cfg, routeText: textRouterViaAgent(agent) } as never;
}

/** A test db whose name we still know, since createMastra needs to reach the same one. */
async function namedDb(): Promise<{ db: Db; database: string }> {
  const database = freshTestName();
  const db = await openTestDb(database);
  return { db, database };
}

describe("chat-targeted editing, end to end", () => {
  test("the agent finds the user's own meal and the correction reaches the row", async () => {
    const { db, database } = await namedDb();
    await activeUser(db, 1);
    const date = berlinDate(new Date(), cfg.tz);
    await insertMeal(db, {
      id: "m-pasta", user_id: 1, ts: new Date().toISOString(), date, analysis: meal(),
    });

    const { model, seen } = twoStep(["pasta"]);
    const deps = await engineFor(db, database, model);

    // No focusMealId — this is the whole point: the user did not reply to anything.
    const result = await handleText(deps, 1, { text: "the pasta was 200g, not 150" });

    // The tool really read Postgres, scoped to this user.
    expect((seen.found as { meals: { mealId: string }[] }).meals.map((m) => m.mealId)).toEqual(["m-pasta"]);
    expect(seen.steps).toBe(2);

    // The engine proposed rather than applied, because the target was inferred.
    expect(result.kind).toBe("edit-proposed");
    expect((await getMeal(db, "m-pasta", 1))!.kcal).toBe(520);

    // And approving it writes through.
    const applied = await applyPendingEdit(deps, 1, (result as { pendingId: string }).pendingId);
    expect(applied.kind).toBe("updated");
    expect((await getMeal(db, "m-pasta", 1))!.kcal).toBe(690);
  });

  test("find_meals never returns another user's rows, however the model asks", async () => {
    // The failure this whole binding exists to prevent. User 2 owns the pasta; user 1 asks for it.
    const { db, database } = await namedDb();
    await activeUser(db, 1);
    await activeUser(db, 2);
    const date = berlinDate(new Date(), cfg.tz);
    await insertMeal(db, {
      id: "m-theirs", user_id: 2, ts: new Date().toISOString(), date, analysis: meal(),
    });

    const { model, seen } = twoStep(["pasta"]);
    const deps = await engineFor(db, database, model);

    const result = await handleText(deps, 1, { text: "the pasta was 200g" });

    expect((seen.found as { meals: unknown[] }).meals).toEqual([]);
    // With no id to name, the correction is refused rather than aimed at the only meal that exists.
    expect(result.kind).toBe("analysis-failed");
    expect((await getMeal(db, "m-theirs", 2))!.kcal).toBe(520); // untouched
  });
});
