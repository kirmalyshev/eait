import { afterAll, describe, expect, test } from "bun:test";
import { MockLanguageModelV4 } from "ai/test";
import { freshTestName, openTestDb, cleanupTestDbs } from "../testutil.ts";
import { createMastra } from "./mastra.ts";
import { buildRequestContext } from "./context.ts";
import { createEngineAgent } from "./agent.ts";
import type { SubmitMealResult } from "./tools/mealActions.ts";

afterAll(cleanupTestDbs);

function pgBase() {
  return {
    host: process.env.PGHOST?.trim() || "127.0.0.1",
    port: Number(process.env.PGPORT) || 5439,
    user: process.env.PGUSER?.trim() || "eait",
    password: process.env.PGPASSWORD?.trim() || "eait",
  };
}

const VALID_MEAL_TOOL_CALL = {
  isFood: true,
  items: [{ name: "apple", grams: 150 }],
  kcal: 78,
  protein_g: 0.4,
  carbs_g: 21,
  fat_g: 0.3,
  satfat_g: 0,
  fiber_g: 2.4,
  sugar_g: 15,
  sodium_mg: 1,
  plant_protein_pct: 0,
  verdicts: {},
  confidence: "high",
  notes: "",
  dayOffset: 0,
};

describe("createEngineAgent", () => {
  test("a scripted submit_meal tool call reaches the caller with validated args", async () => {
    const mockModel = new MockLanguageModelV4({
      doGenerate: async () => ({
        finishReason: { unified: "tool-calls", raw: undefined },
        usage: {
          inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 0, text: 0, reasoning: 0 },
        },
        content: [
          {
            type: "tool-call",
            toolCallId: "call-1",
            toolName: "submit_meal",
            input: JSON.stringify(VALID_MEAL_TOOL_CALL),
          },
        ],
        warnings: [],
      }),
    });

    const database = freshTestName();
    await openTestDb(database);
    const { memory } = await createMastra({ ...pgBase(), database });

    const agent = createEngineAgent(mockModel, memory);
    const requestContext = buildRequestContext(4242);
    const result = await agent.generate("I ate an apple", {
      memory: { thread: "test-thread", resource: "4242" },
      requestContext,
    });

    const call = result.toolResults?.find((r) => r.payload.toolName === "submit_meal");
    expect(call).toBeDefined();
    // Mastra's ToolResultPayload defaults its `result` field to `unknown` (it isn't threaded
    // through from submit_meal's own `execute` return type via agent.generate()'s toolResults) —
    // narrow to the type submit_meal's `execute` actually declares (mealActions.ts), the same
    // pattern mealActions.test.ts already uses for this tool's execute() return value directly.
    const payloadResult = call?.payload.result as SubmitMealResult | undefined;
    expect(payloadResult?.analysis.items[0].name).toBe("apple");
    expect(payloadResult?.dayOffset).toBe(0);
  });
});
