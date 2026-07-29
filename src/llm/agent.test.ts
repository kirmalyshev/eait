import { afterAll, describe, expect, test } from "bun:test";
import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { MockLanguageModelV4 } from "ai/test";
import { z } from "zod";
import type { PostgresStore } from "@mastra/pg";
import { freshTestName, openTestDb, cleanupTestDbs } from "../testutil.ts";
import { createMastra } from "./mastra.ts";
import { buildRequestContext, requireUserId } from "./context.ts";
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

/** Shared usage stub — the mock model's `doGenerate` result requires this field, but nothing in
 * these tests asserts on token counts. */
const ZERO_USAGE = {
  inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 0, text: 0, reasoning: 0 },
};

describe("createEngineAgent", () => {
  test("a scripted submit_meal tool call reaches the caller with validated args", async () => {
    const mockModel = new MockLanguageModelV4({
      doGenerate: async () => ({
        finishReason: { unified: "tool-calls", raw: undefined },
        usage: ZERO_USAGE,
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
    const { mastra, memory } = await createMastra({ ...pgBase(), database });

    try {
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
    } finally {
      // PostgresStore owns its own connection pool (no external `pool` was passed to its
      // constructor), so it must be closed explicitly here — otherwise afterAll's
      // cleanupTestDbs FORCE-drops this database out from under a still-open pool connection,
      // and PostgresStore logs "idle pool client error" noise from the forced disconnect (same
      // fix as mastra.test.ts, commit 08e9d9e).
      await (mastra.getStorage() as PostgresStore | undefined)?.close();
    }
  });

  test("RequestContext flows end-to-end through agent.generate() into a tool's execute — requireUserId reads back the bound userId, not a model-supplied value", async () => {
    // Test-only spy tool: the ONLY thing it does is read `requireUserId` off the RequestContext
    // its own `execute` receives and hand the value back. Its `inputSchema` carries no user-id
    // field, so the only way the returned value could be 4242 is if `buildRequestContext(4242)`
    // passed into `agent.generate()`'s `requestContext` option genuinely reached this tool's
    // `execute` through Mastra's real tool-calling loop — proving the channel `context.test.ts`
    // only round-trips in isolation actually works end-to-end.
    const spyTool = createTool({
      id: "spy_user_id",
      description:
        "Test-only tool. Returns whatever requireUserId reads off the caller's bound " +
        "RequestContext — never accepts a userId as input.",
      inputSchema: z.object({}),
      execute: async (_inputData, { requestContext }) => {
        return { userId: requireUserId(requestContext) };
      },
    });

    let callCount = 0;
    const mockModel = new MockLanguageModelV4({
      doGenerate: async () => {
        callCount++;
        if (callCount === 1) {
          return {
            finishReason: { unified: "tool-calls", raw: undefined },
            usage: ZERO_USAGE,
            content: [
              {
                type: "tool-call",
                toolCallId: "call-1",
                toolName: "spy_user_id",
                input: JSON.stringify({}),
              },
            ],
            warnings: [],
          };
        }
        return {
          finishReason: { unified: "stop", raw: undefined },
          usage: ZERO_USAGE,
          content: [{ type: "text", text: "done" }],
          warnings: [],
        };
      },
    });

    const database = freshTestName();
    await openTestDb(database);
    const { mastra, memory } = await createMastra({ ...pgBase(), database });

    try {
      // Not `createEngineAgent()` — that function's tool set is fixed to `submit_meal` alone
      // (out of scope to change for this plan). Same construction shape (id/name/instructions/
      // model/memory/tools), with the spy tool standing in for this one test, run through the
      // exact same real `Agent.generate()` tool-calling loop.
      const agent = new Agent({
        id: "eait-engine-request-context-probe",
        name: "eait-engine-request-context-probe",
        instructions: "test-only agent for verifying the RequestContext→tool channel.",
        model: mockModel,
        memory,
        tools: { spy_user_id: spyTool },
      });

      const requestContext = buildRequestContext(4242);
      const result = await agent.generate("irrelevant — the mock model ignores this", {
        memory: { thread: "test-thread-spy", resource: "4242" },
        requestContext,
      });

      const call = result.toolResults?.find((r) => r.payload.toolName === "spy_user_id");
      expect(call).toBeDefined();
      const payloadResult = call?.payload.result as { userId: number } | undefined;
      expect(payloadResult?.userId).toBe(4242);
    } finally {
      await (mastra.getStorage() as PostgresStore | undefined)?.close();
    }
  });

  test("an out-of-contract submit_meal call does not throw — Mastra returns an error-shaped tool result and feeds it back to the model instead", async () => {
    // Proves what happens to an out-of-contract call through the real agent.generate() tool-calling
    // loop, not just at the schema level.
    //
    // The payload is a malformed `isFood`, NOT the out-of-range `dayOffset: 99` this test used to
    // send: dayOffset is deliberately permissive-then-clamped now (see mealActions.ts), because
    // rejecting a meal over its date field costs a retry and can lose the analysis entirely. A type
    // error on the food flag is a genuine contract violation with no sensible normalization, so it
    // still exercises the error-and-retry path this test exists to document.
    const invalidMealCall = { ...VALID_MEAL_TOOL_CALL, isFood: "yes" };

    let callCount = 0;
    const mockModel = new MockLanguageModelV4({
      doGenerate: async () => {
        callCount++;
        if (callCount === 1) {
          return {
            finishReason: { unified: "tool-calls", raw: undefined },
            usage: ZERO_USAGE,
            content: [
              {
                type: "tool-call",
                toolCallId: "call-1",
                toolName: "submit_meal",
                input: JSON.stringify(invalidMealCall),
              },
            ],
            warnings: [],
          };
        }
        // Mastra feeds the validation error back to the model for a retry; this mock gives up
        // and answers in plain text on its second turn rather than looping forever.
        return {
          finishReason: { unified: "stop", raw: undefined },
          usage: ZERO_USAGE,
          content: [{ type: "text", text: "sorry, I could not submit that." }],
          warnings: [],
        };
      },
    });

    const database = freshTestName();
    await openTestDb(database);
    const { mastra, memory } = await createMastra({ ...pgBase(), database });

    try {
      const agent = createEngineAgent(mockModel, memory);
      const requestContext = buildRequestContext(4242);
      const result = await agent.generate("I ate an apple", {
        memory: { thread: "test-thread-invalid", resource: "4242" },
        requestContext,
      });

      const call = result.toolResults?.find((r) => r.payload.toolName === "submit_meal");
      expect(call).toBeDefined();
      // NOT a SubmitMealResult — Mastra's tool-calling loop does not throw on an out-of-contract
      // call. `payload.result` is really a discriminated union: this error shape, or
      // SubmitMealResult. See mealActions.ts's doc comment for the corrected description; a
      // caller (Plan 2's bot.ts wiring) must check for `error === true` before trusting
      // `payload.result` as a SubmitMealResult.
      const payloadResult = call?.payload.result as
        | { error: true; message: string; validationErrors: unknown }
        | SubmitMealResult
        | undefined;
      expect(payloadResult).toBeDefined();
      expect((payloadResult as { error?: boolean })?.error).toBe(true);
      expect((payloadResult as { message?: string })?.message).toMatch(/isFood/);
      // The model retried after seeing the validation error, exactly as Mastra's error-and-retry
      // contract promises.
      expect(callCount).toBe(2);
    } finally {
      await (mastra.getStorage() as PostgresStore | undefined)?.close();
    }
  });
});
