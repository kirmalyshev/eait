import { afterAll, describe, expect, test as bunTest } from "bun:test";
import { MockLanguageModelV4 } from "ai/test";
import { freshTestName, cleanupTestDbs, openTestDb } from "../testutil.ts";
import { createMastra } from "./mastra.ts";
import { createEngineAgent } from "./agent.ts";
import { routeTextViaAgent } from "./routeViaAgent.ts";
import { buildRouteText, SYSTEM_ROUTE, TARGETING_GUIDANCE } from "../analyzer.ts";
import type { RouteContext } from "../analyzer.ts";
import { buildRequestContext } from "./context.ts";
import type { MealAnalysis, Profile } from "../types.ts";

/**
 * Every test in this file builds a fresh database AND a Postgres-backed Mastra `Memory` (Mastra
 * engages memory on every `generate`, so a storage-less one fails before the model is consulted).
 * That is comfortably more than bun's 5s default under a loaded suite, and it fails as a bare
 * "(unnamed) timed out" with no clue which test it was. `bunfig.toml`'s `[test] timeout` is not
 * honoured by bun 1.3, so the allowance is applied here, once, by wrapping `test`.
 */
const AGENT_TEST_TIMEOUT_MS = 30_000;
const test = (name: string, fn: () => unknown) => bunTest(name, fn as never, AGENT_TEST_TIMEOUT_MS);


const profile: Profile = {
  telegram_id: 1, lang: "ru", goal: "lose", restrictions: ["ldl"],
  medical_limitations: null, food_allergies: null, product_limitations: null, reply_format: null,
};

const ANALYSIS = {
  isFood: true,
  items: [{ name: "Гречка", grams: 180, name_en: "buckwheat" }],
  kcal: 300, protein_g: 12, carbs_g: 55, fat_g: 4,
  satfat_g: 1, fiber_g: 6, sugar_g: 2, sodium_mg: 20,
  plant_protein_pct: 100, verdicts: {}, confidence: "medium", notes: "",
};

const focusMeal = { ...ANALYSIS, kcal: 250 } as unknown as MealAnalysis;

const ctxWith = (focus?: MealAnalysis): RouteContext => ({
  ...(focus ? { focusMeal: focus } : {}),
  todayMeals: [], weekTotals: [], targets: { kcal: 2000, protein_g: 120 }, localTime: "13:00",
});

const usage = {
  inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 0, text: 0, reasoning: 0 },
};

/** A model that emits the given tool calls on its first turn, capturing the prompt it was sent. */
function scripted(...calls: { toolName: string; input: unknown }[]) {
  const seen: { text?: string } = {};
  const model = new MockLanguageModelV4({
    doGenerate: async (opts: any) => {
      if (seen.text === undefined) {
        const parts = opts.prompt?.at(-1)?.content ?? [];
        seen.text = parts.find((p: any) => p.type === "text")?.text;
      }
      return {
        finishReason: { unified: "tool-calls" as const, raw: undefined },
        usage,
        warnings: [],
        content: calls.map((c, i) => ({
          type: "tool-call" as const,
          toolCallId: `c${i}`,
          toolName: c.toolName,
          input: JSON.stringify(c.input),
        })),
      };
    },
  });
  return { model, seen };
}

afterAll(cleanupTestDbs, 60_000); // dropping N databases outlives the 5s default under load

function pgBase() {
  return {
    host: process.env.PGHOST?.trim() || "127.0.0.1",
    port: Number(process.env.PGPORT) || 5439,
    user: process.env.PGUSER?.trim() || "eait",
    password: process.env.PGPASSWORD?.trim() || "eait",
  };
}

async function agentFor(model: MockLanguageModelV4) {
  const database = freshTestName();
  await (await openTestDb(database)).close();
  const { memory } = await createMastra({ ...pgBase(), database });
  return createEngineAgent(model as never, memory);
}

const route = async (model: MockLanguageModelV4, ctx: RouteContext, text = "что я съел?") =>
  routeTextViaAgent(await agentFor(model), text, profile, ctx, buildRequestContext(1));

describe("routeTextViaAgent", () => {
  test("sends the SAME prompt text the shipped router builds", async () => {
    const { model, seen } = scripted({ toolName: "answer_question", input: { answer: "ок" } });
    const ctx = ctxWith();
    await route(model, ctx);
    expect(seen.text).toBe(buildRouteText("что я съел?", profile, ctx));
  });

  test("answer_question → question intent", async () => {
    const { model } = scripted({ toolName: "answer_question", input: { answer: "Около 600 ккал." } });
    expect(await route(model, ctxWith())).toEqual({ intent: "question", answer: "Около 600 ккал." });
  });

  test("submit_meal → meal intent, with the clamped dayOffset", async () => {
    const { model } = scripted({ toolName: "submit_meal", input: { ...ANALYSIS, dayOffset: 1 } });
    const r = await route(model, ctxWith());
    expect(r.intent).toBe("meal");
    expect(r.intent === "meal" && r.dayOffset).toBe(1);
  });

  test("submit_correction → correction intent when a focus meal exists", async () => {
    const { model } = scripted({ toolName: "submit_correction", input: { ...ANALYSIS, kcal: 420 } });
    const r = await route(model, ctxWith(focusMeal));
    expect(r.intent).toBe("correction");
    expect(r.intent === "correction" && r.analysis.kcal).toBe(420);
  });

  test("submit_redate → redate intent, carrying no analysis", async () => {
    const { model } = scripted({ toolName: "submit_redate", input: { dayOffset: 2 } });
    expect(await route(model, ctxWith(focusMeal))).toEqual({ intent: "redate", dayOffset: 2 });
  });

  test("APPLIES the verdict gate on both meal-producing intents", async () => {
    // Same leak the photo agent path shipped with. This profile declares only `ldl`, so a
    // model-authored `kidneys` verdict must not survive into a stored row.
    const leaky = { ...ANALYSIS, verdicts: { weight: "good", ldl: "good", kidneys: "bad" } };
    const meal = await route(scripted({ toolName: "submit_meal", input: { ...leaky, dayOffset: 0 } }).model, ctxWith());
    const corr = await route(scripted({ toolName: "submit_correction", input: leaky }).model, ctxWith(focusMeal));
    expect(meal.intent === "meal" && meal.analysis.verdicts.kidneys).toBeUndefined();
    expect(corr.intent === "correction" && corr.analysis.verdicts.kidneys).toBeUndefined();
  });

  test("a correction WITHOUT a focus meal is salvaged as a question when an answer exists", async () => {
    // routeText's exact behaviour. The model is told these intents are unavailable; when it picks
    // one anyway it usually also writes a serviceable answer, and the user gets that rather than an
    // error. Preserved verbatim — dropping it would be a silent UX regression.
    const { model } = scripted(
      { toolName: "answer_question", input: { answer: "Не вижу, к какому блюду это относится." } },
      { toolName: "submit_correction", input: ANALYSIS },
    );
    const r = await route(model, ctxWith());
    expect(r).toEqual({ intent: "question", answer: "Не вижу, к какому блюду это относится." });
  });

  test("a correction without a focus meal AND no answer throws, never becomes a new meal", async () => {
    // The dangerous fallthrough: silently re-routing a correction into a NEW meal would double-log.
    const { model } = scripted({ toolName: "submit_correction", input: ANALYSIS });
    await expect(route(model, ctxWith())).rejects.toThrow(/without a target/);
  });

  test("a redate without a focus meal throws too", async () => {
    const { model } = scripted({ toolName: "submit_redate", input: { dayOffset: 1 } });
    await expect(route(model, ctxWith())).rejects.toThrow(/without a target/);
  });

  test("isFood=false on a meal-producing intent throws", async () => {
    // A "correction" to not-food would still render a meal card and land in daily totals.
    const notFood = { ...ANALYSIS, isFood: false };
    await expect(route(scripted({ toolName: "submit_meal", input: { ...notFood, dayOffset: 0 } }).model, ctxWith()))
      .rejects.toThrow(/isFood=false/);
    await expect(route(scripted({ toolName: "submit_correction", input: notFood }).model, ctxWith(focusMeal)))
      .rejects.toThrow(/isFood=false/);
  });

  test("a router turn is never offered submit_restrictions — it could not dispatch it", async () => {
    // `submit_restrictions` is registered on the agent but belongs to onboarding. Because the stop
    // condition halts on ANY terminal tool, a router turn that called it would end on a tool this
    // function has no branch for, and the user's message would raise instead of being answered.
    let offered: string[] = [];
    const model = new MockLanguageModelV4({
      doGenerate: async (opts: any) => {
        offered = (opts.tools ?? []).map((t: any) => t.name ?? t.id).sort();
        return {
          finishReason: { unified: "tool-calls" as const, raw: undefined }, usage, warnings: [],
          content: [{ type: "tool-call" as const, toolCallId: "c1", toolName: "answer_question", input: JSON.stringify({ answer: "ок" }) }],
        };
      },
    });
    await route(model, ctxWith());
    expect(offered).not.toContain("submit_restrictions");
    // find_meals is absent because `agentFor` builds the agent with no db handle; the test below
    // covers it being offered when there is one.
    expect(offered).toEqual([
      "answer_question", "ask_which_meal", "submit_correction", "submit_meal", "submit_redate",
    ]);
  });

  test("the router is TOLD how to use search_food_db too — a text meal is grounded like a photo", async () => {
    let sys = "";
    const model = new MockLanguageModelV4({
      doGenerate: async (opts: any) => {
        sys = (opts.prompt ?? []).filter((m: any) => m.role === "system").map((m: any) => m.content).join("\n");
        return {
          finishReason: { unified: "tool-calls" as const, raw: undefined }, usage, warnings: [],
          content: [{ type: "tool-call" as const, toolCallId: "c1", toolName: "answer_question", input: JSON.stringify({ answer: "ок" }) }],
        };
      },
    });
    await route(model, ctxWith());
    expect(sys).toContain("search_food_db");
    expect(sys).toContain(SYSTEM_ROUTE);
  });

  test("THROWS when the agent ends with prose and no terminal tool", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => ({
        finishReason: { unified: "stop" as const, raw: undefined }, usage, warnings: [],
        content: [{ type: "text" as const, text: "Интересный вопрос." }],
      }),
    });
    await expect(route(model, ctxWith())).rejects.toThrow(/without calling a terminal tool/);
  });

  test("the LAST terminal call wins — a retry supersedes the attempt it corrected", async () => {
    const { model } = scripted(
      { toolName: "submit_meal", input: { ...ANALYSIS, kcal: 111, dayOffset: 0 } },
      { toolName: "submit_meal", input: { ...ANALYSIS, kcal: 999, dayOffset: 0 } },
    );
    const r = await route(model, ctxWith());
    expect(r.intent === "meal" && r.analysis.kcal).toBe(999);
  });

  test("THROWS on an error-shaped tool result instead of reading the payload off it", async () => {
    // Mastra resolves a failed inputSchema validation to {error:true,...} and feeds it back — it
    // does NOT throw. Reading `.answer` off that shape would send `undefined` to the user.
    const { model } = scripted({ toolName: "answer_question", input: { answer: "" } });
    await expect(route(model, ctxWith())).rejects.toThrow(/failed validation/);
  });
});

describe("chat-targeted editing (no reply, no focus meal)", () => {
  test("a correction carrying a mealId is returned instead of being salvaged as a question", async () => {
    // Before this, a correction with no focus meal was either salvaged or a loud throw — because
    // there was no way for the model to name a meal. Now there is.
    const { model } = scripted({
      toolName: "submit_correction",
      input: { ...ANALYSIS, mealId: "m-pasta" },
    });
    const r = await route(model, ctxWith());
    expect(r.intent).toBe("correction");
    expect(r).toMatchObject({ mealId: "m-pasta" });
  });

  test("a redate carrying a mealId survives with no focus meal", async () => {
    const { model } = scripted({
      toolName: "submit_redate",
      input: { dayOffset: 2, mealId: "m-pasta" },
    });
    expect(await route(model, ctxWith())).toEqual({
      intent: "redate", dayOffset: 2, mealId: "m-pasta",
    });
  });

  test("a correction with NEITHER focus meal nor mealId is still salvaged or thrown", async () => {
    // The old guard, unchanged: an untargeted edit must never silently become a new meal.
    const { model } = scripted({ toolName: "submit_correction", input: ANALYSIS });
    await expect(route(model, ctxWith())).rejects.toThrow(/without a target/);
  });

  test("the reply's focus meal WINS over a mealId the model invented", async () => {
    // A user who replied to meal A must not have meal B edited. The engine resolves the target,
    // so the router simply must not drop the focus — asserted here as the mealId being reported
    // for what it is, with the focus present for the engine to prefer.
    const { model } = scripted({
      toolName: "submit_correction",
      input: { ...ANALYSIS, mealId: "m-somewhere-else" },
    });
    const r = await route(model, ctxWith(focusMeal));
    expect(r).toMatchObject({ intent: "correction", mealId: "m-somewhere-else" });
  });

  test("ask_which_meal becomes a choose result", async () => {
    const { model } = scripted({
      toolName: "ask_which_meal",
      input: { mealIds: ["m1", "m2"], question: "Какой кофе?" },
    });
    expect(await route(model, ctxWith())).toEqual({
      intent: "choose", mealIds: ["m1", "m2"], question: "Какой кофе?",
    });
  });

  test("a find_meals lookup before the edit does not end the turn", async () => {
    // Same guarantee search_food_db has: a mid-turn lookup is not terminal, and the LAST terminal
    // call is the one that counts.
    const { model } = scripted(
      { toolName: "find_meals", input: { queries: ["pasta"] } },
      { toolName: "submit_correction", input: { ...ANALYSIS, mealId: "m-pasta" } },
    );
    const r = await route(model, ctxWith());
    expect(r).toMatchObject({ intent: "correction", mealId: "m-pasta" });
  });
});

describe("the router is equipped to target meals", () => {
  /** Same as `agentFor`, but with the db handle that registers `find_meals`. */
  async function agentWithDb(model: MockLanguageModelV4) {
    const database = freshTestName();
    const db = await openTestDb(database);
    const { memory } = await createMastra({ ...pgBase(), database });
    return createEngineAgent(model as never, memory, { db, tz: "Europe/Berlin" });
  }

  const probe = () => {
    const captured: { offered: string[]; sys: string } = { offered: [], sys: "" };
    const model = new MockLanguageModelV4({
      doGenerate: async (opts: any) => {
        captured.offered = (opts.tools ?? []).map((t: any) => t.name ?? t.id).sort();
        captured.sys = (opts.prompt ?? [])
          .filter((m: any) => m.role === "system").map((m: any) => m.content).join("\n");
        return {
          finishReason: { unified: "tool-calls" as const, raw: undefined }, usage, warnings: [],
          content: [{
            type: "tool-call" as const, toolCallId: "c1", toolName: "answer_question",
            input: JSON.stringify({ answer: "ок" }),
          }],
        };
      },
    });
    return { model, captured };
  };

  test("find_meals is offered to a router turn when the agent has a db", async () => {
    const { model, captured } = probe();
    await routeTextViaAgent(await agentWithDb(model), "поправь пасту", profile, ctxWith(), buildRequestContext(1));
    expect(captured.offered).toContain("find_meals");
    // still never the onboarding tool, which this function could not dispatch
    expect(captured.offered).not.toContain("submit_restrictions");
  });

  test("the router is TOLD how to target a meal it was not handed", async () => {
    // Mastra's per-call `instructions` REPLACES the agent's, so guidance that is not appended
    // explicitly is dead text — the bug that shipped once with LOOKUP_GUIDANCE.
    const { model, captured } = probe();
    await routeTextViaAgent(await agentWithDb(model), "поправь пасту", profile, ctxWith(), buildRequestContext(1));
    expect(captured.sys).toContain(TARGETING_GUIDANCE);
    expect(captured.sys).toContain(SYSTEM_ROUTE);
  });
});
