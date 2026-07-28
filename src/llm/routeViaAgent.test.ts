import { afterAll, describe, expect, test } from "bun:test";
import { MockLanguageModelV4 } from "ai/test";
import { freshTestName, cleanupTestDbs, openTestDb } from "../testutil.ts";
import { createMastra } from "./mastra.ts";
import { createEngineAgent } from "./agent.ts";
import { routeTextViaAgent } from "./routeViaAgent.ts";
import { buildRouteText } from "../analyzer.ts";
import type { RouteContext } from "../analyzer.ts";
import { buildRequestContext } from "./context.ts";
import type { MealAnalysis, Profile } from "../types.ts";

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

afterAll(cleanupTestDbs);

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
    await expect(route(model, ctxWith())).rejects.toThrow(/without focus meal/);
  });

  test("a redate without a focus meal throws too", async () => {
    const { model } = scripted({ toolName: "submit_redate", input: { dayOffset: 1 } });
    await expect(route(model, ctxWith())).rejects.toThrow(/without focus meal/);
  });

  test("isFood=false on a meal-producing intent throws", async () => {
    // A "correction" to not-food would still render a meal card and land in daily totals.
    const notFood = { ...ANALYSIS, isFood: false };
    await expect(route(scripted({ toolName: "submit_meal", input: { ...notFood, dayOffset: 0 } }).model, ctxWith()))
      .rejects.toThrow(/isFood=false/);
    await expect(route(scripted({ toolName: "submit_correction", input: notFood }).model, ctxWith(focusMeal)))
      .rejects.toThrow(/isFood=false/);
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
