import { afterAll, describe, expect, test } from "bun:test";
import { MockLanguageModelV4 } from "ai/test";
import { freshTestName, cleanupTestDbs, openTestDb } from "../testutil.ts";
import { createMastra } from "./mastra.ts";
import { createEngineAgent } from "./agent.ts";
import { analyzeMealViaAgent } from "./analyzeViaAgent.ts";
import { buildUserText } from "../analyzer.ts";
import { buildRequestContext } from "./context.ts";
import { buildFoodIndex } from "../food_db.ts";
import type { Profile } from "../types.ts";

const profile: Profile = {
  telegram_id: 1, lang: "ru", goal: "lose", restrictions: ["ldl"],
  medical_limitations: null, food_allergies: null, product_limitations: null, reply_format: null,
};
const bytes = new Uint8Array([1, 2, 3, 4]);

const ANALYSIS = {
  isFood: true,
  items: [{ name: "Булгур", grams: 200, name_en: "bulgur", kcal: 166 }],
  kcal: 166, protein_g: 6.2, carbs_g: 37.2, fat_g: 0.4,
  satfat_g: 0, fiber_g: 9, sugar_g: 0.2, sodium_mg: 10,
  plant_protein_pct: 100, verdicts: {}, confidence: "medium", notes: "",
  dayOffset: 0,
};

/** Same stub shape agent.test.ts uses — the mock result requires it; no test asserts on tokens. */
const usage = {
  inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 0, text: 0, reasoning: 0 },
};

/** A model that calls submit_meal once with `payload`, capturing what prompt it was sent. */
function scripted(payload: unknown) {
  const seen: { text?: string; imageCount: number } = { imageCount: 0 };
  const model = new MockLanguageModelV4({
    doGenerate: async (opts: any) => {
      // FIRST call only. The agent loops until the model stops calling tools, and on later steps
      // the last message is a tool result rather than the user turn — overwriting here would
      // capture that instead of the prompt actually sent.
      if (seen.text === undefined) {
        const parts = opts.prompt?.at(-1)?.content ?? [];
        seen.text = parts.find((p: any) => p.type === "text")?.text;
        seen.imageCount = parts.filter((p: any) => p.type === "image" || p.type === "file").length;
      }
      return {
        finishReason: { unified: "tool-calls" as const, raw: undefined },
        usage,
        warnings: [],
        content: [
          {
            type: "tool-call" as const,
            toolCallId: "c1",
            toolName: "submit_meal",
            input: JSON.stringify(payload),
          },
        ],
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

/**
 * A real Postgres-backed Memory, as the other agent tests use. Mastra engages memory during
 * `generate` whether or not the turn needs it, so a storage-less Memory fails before the model is
 * ever consulted — and a stub would test a code path production does not run.
 */
async function agentFor(model: MockLanguageModelV4) {
  const database = freshTestName();
  await (await openTestDb(database)).close();
  const { memory } = await createMastra({ ...pgBase(), database });
  return createEngineAgent(model as never, memory);
}

describe("analyzeMealViaAgent", () => {
  test("sends the SAME prompt text the shipped path builds", async () => {
    // The migration must be a transport change and nothing else. If the prompt were re-authored,
    // the eval could not tell a transport regression from an accuracy one — they would move the
    // same numbers.
    const { model, seen } = scripted(ANALYSIS);
    await analyzeMealViaAgent((await agentFor(model)), [bytes], profile, buildRequestContext(1));
    expect(seen.text).toBe(buildUserText(profile, undefined, false));
  });

  test("carries the profile's priors through — repertoire included", async () => {
    const { model, seen } = scripted(ANALYSIS);
    await analyzeMealViaAgent((await agentFor(model)), [bytes], profile, buildRequestContext(1), {
      repertoire: ["гречка", "булгур"],
    });
    expect(seen.text).toContain("гречка, булгур");
  });

  test("several photos go in ONE message — they are angles of one meal, not several dishes", async () => {
    const { model, seen } = scripted(ANALYSIS);
    await analyzeMealViaAgent((await agentFor(model)), [bytes, bytes, bytes], profile, buildRequestContext(1));
    expect(seen.imageCount).toBe(3);
    expect(seen.text).toBe(buildUserText(profile, undefined, true)); // multi-photo hint applied
  });

  test("returns a MealAnalysis matching the shipped schema, dayOffset stripped", async () => {
    const { model } = scripted(ANALYSIS);
    const out = await analyzeMealViaAgent((await agentFor(model)), [bytes], profile, buildRequestContext(1));
    expect(out.kcal).toBe(166);
    expect(out.items[0]!.name_en).toBe("bulgur");
    expect("dayOffset" in out).toBe(false);
  });

  test("APPLIES the verdict gate — an undeclared dimension never survives the agent path", async () => {
    // The old path returns `gated(parseAnalysis(raw), profile)`: model verdicts are DISCARDED and
    // recomputed from the user's caps, then filtered to declared dimensions. This profile declares
    // only "ldl", so a model-authored `kidneys` verdict is a medical claim about a dimension its
    // owner never opted into — the exact leak PR #34 closed on the shipped path.
    const { model } = scripted({
      ...ANALYSIS,
      verdicts: { weight: "good", ldl: "good", kidneys: "bad" },
    });
    const out = await analyzeMealViaAgent(await agentFor(model), [bytes], profile, buildRequestContext(1));
    expect(out.verdicts.kidneys).toBeUndefined();
  });

  test("a null dayOffset still logs the meal — models commonly emit it for same-day", async () => {
    // `RouteSchema` types dayOffset as `z.unknown().optional()` and clamps, precisely because a
    // strict number REJECTS the whole object on the null models emit for today. `submit_meal`'s
    // inputSchema bounds it strictly instead, so under Mastra the same payload fails validation,
    // comes back error-shaped, and the meal is lost where the shipped path files it at offset 0.
    const { model } = scripted({ ...ANALYSIS, dayOffset: null });
    const out = await analyzeMealViaAgent(await agentFor(model), [bytes], profile, buildRequestContext(1));
    expect(out.kcal).toBe(166);
  });

  test("costs ONE model call — the loop stops at the terminal tool, not at maxSteps", async () => {
    // `toolChoice: "required"` forbids the model from ever answering in prose, so without a stop
    // condition the loop cannot end early: it burns maxSteps producing answers nobody reads. This
    // mock always returns a tool call — exactly what a real model under `required` does — so
    // without `stopWhen` this asserts 6 instead of 1, i.e. a 6x bill and 6x latency per photo.
    let calls = 0;
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        calls++;
        return {
          finishReason: { unified: "tool-calls" as const, raw: undefined }, usage, warnings: [],
          content: [{
            type: "tool-call" as const, toolCallId: `c${calls}`, toolName: "submit_meal",
            input: JSON.stringify(ANALYSIS),
          }],
        };
      },
    });
    await analyzeMealViaAgent(await agentFor(model), [bytes], profile, buildRequestContext(1));
    expect(calls).toBe(1);
  });

  test("a food LOOKUP before submitting is still allowed — the stop is on terminal tools only", async () => {
    // The other half of the stop condition. `search_food_db` is a mid-turn lookup, and grounding
    // depends on the agent being able to call it and THEN submit. A stop condition that fired on
    // any tool call would silently disable grounding while every test still passed.
    const index = buildFoodIndex([
      { id: "usda:1", name: "Bulgur, cooked", kcal: 83, protein_g: 3.1, carbs_g: 18.6, fat_g: 0.2 },
    ]);
    const seen: string[] = [];
    let calls = 0;
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        calls++;
        const [toolName, input] = calls === 1
          ? ["search_food_db", JSON.stringify({ queries: ["bulgur"] })]
          : ["submit_meal", JSON.stringify(ANALYSIS)];
        seen.push(toolName!);
        return {
          finishReason: { unified: "tool-calls" as const, raw: undefined }, usage, warnings: [],
          content: [{ type: "tool-call" as const, toolCallId: `c${calls}`, toolName: toolName!, input: input! }],
        };
      },
    });
    const database = freshTestName();
    await (await openTestDb(database)).close();
    const { memory } = await createMastra({ ...pgBase(), database });
    const agent = createEngineAgent(model as never, memory, { foodIndex: index });
    const out = await analyzeMealViaAgent(agent, [bytes], profile, buildRequestContext(1));

    expect(seen).toEqual(["search_food_db", "submit_meal"]);
    expect(out.kcal).toBe(166);
  });

  test("THROWS when the agent never calls submit_meal", async () => {
    // Mirrors the old path's contract: no analysis means no row, never a meal assembled from
    // whatever the agent said in prose.
    const model = new MockLanguageModelV4({
      doGenerate: async () => ({
        finishReason: { unified: "stop" as const, raw: undefined }, usage, warnings: [],
        content: [{ type: "text" as const, text: "I think that is a nice lunch." }],
      }),
    });
    await expect(
      analyzeMealViaAgent((await agentFor(model)), [bytes], profile, buildRequestContext(1)),
    ).rejects.toThrow(/without calling submit_meal/);
  });

  test("THROWS on the error-shaped tool result instead of reading .analysis off it", async () => {
    // The trap this file exists for. Mastra does NOT throw on a failed inputSchema validation — it
    // resolves the call to {error: true, ...} and feeds it back. Reading the payload blindly would
    // crash on a shape the old path rejected loudly and cleanly.
    const model = new MockLanguageModelV4({
      doGenerate: async () => ({
        finishReason: { unified: "tool-calls" as const, raw: undefined }, usage, warnings: [],
        content: [
          { type: "tool-call" as const, toolCallId: "c1", toolName: "submit_meal", input: JSON.stringify({ isFood: "yes" }) },
        ],
      }),
    });
    await expect(
      analyzeMealViaAgent((await agentFor(model)), [bytes], profile, buildRequestContext(1)),
    ).rejects.toThrow();
  });

  test("rejects a call with no images rather than asking the model to imagine one", async () => {
    const { model } = scripted(ANALYSIS);
    await expect(
      analyzeMealViaAgent((await agentFor(model)), [], profile, buildRequestContext(1)),
    ).rejects.toThrow(/no images/);
  });
});
