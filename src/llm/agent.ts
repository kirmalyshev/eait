import { Agent } from "@mastra/core/agent";
import type { Memory } from "@mastra/memory";
import { submitMealTool } from "./tools/mealActions.ts";
import {
  answerQuestionTool, askWhichMealTool, submitCorrectionTool, submitRedateTool,
  submitRestrictionsTool,
} from "./tools/routeActions.ts";
import { makeSearchFoodDbTool } from "./tools/foodDb.ts";
import { makeFindMealsTool } from "./tools/mealLookup.ts";
import type { FoodIndex } from "../food_db.ts";
import type { Db } from "../db.ts";

type EngineModel = ConstructorParameters<typeof Agent>[0]["model"];

/**
 * The one unified Agent (brainstorm decision, `docs/design/2026-07-27-mastra-agent-engine.md`):
 * photo meal analysis, free-text routing/Q&A, and restriction classification all go through this
 * instance. Right now it carries only `submit_meal` — later plans extend the `tools` map and
 * `instructions` as each flow migrates; this function's signature does not change.
 *
 * `model` is a parameter rather than hardcoded so tests inject a scripted mock and production
 * wiring (a later plan) passes a real OpenRouter gateway model string — this is the provider-swap
 * seam `llm/factory.ts` used to own.
 *
 * `deps.foodIndex` registers `search_food_db` when a composition table is available, and omits the
 * tool entirely when it is not. Injected rather than loaded here: the table is 10,780 rows read
 * from disk, this function is called in tests with a mock model, and an agent constructor that
 * performs file I/O is one that cannot be exercised cheaply. Omitting the tool rather than
 * registering a broken one also means a missing table degrades to the agent's own estimates —
 * which is the same outcome as a food it cannot find, and a path already covered.
 */
export function createEngineAgent(
  model: EngineModel,
  memory: Memory,
  deps: { foodIndex?: FoodIndex; db?: Db; tz?: string } = {},
): Agent {
  return new Agent({
    id: "eait-engine",
    name: "eait-engine",
    instructions: `${BASE_INSTRUCTIONS} ${LOOKUP_GUIDANCE}`,
    model,
    memory,
    tools: {
      submit_meal: submitMealTool,
      submit_correction: submitCorrectionTool,
      submit_redate: submitRedateTool,
      answer_question: answerQuestionTool,
      ask_which_meal: askWhichMealTool,
      submit_restrictions: submitRestrictionsTool,
      ...(deps.foodIndex ? { search_food_db: makeSearchFoodDbTool(deps.foodIndex) } : {}),
      // Registered only with a db handle, mirroring `foodIndex`: without one the agent simply
      // cannot search the diary, and a chat-targeted edit degrades to the reply path it replaces
      // rather than to a tool that throws. Tests that do not exercise editing pass neither.
      ...(deps.db ? { find_meals: makeFindMealsTool(deps.db, { tz: deps.tz ?? "Europe/Berlin" }) } : {}),
    },
  });
}

const BASE_INSTRUCTIONS =
  "You are the assistant behind a personal food-diary Telegram bot. You MUST finish every " +
  "turn by calling exactly one terminal tool: submit_meal for food the user ate, " +
  "submit_correction to fix a logged meal's estimate, submit_redate to move a logged meal to " +
  "another day, ask_which_meal when you cannot tell which logged meal is meant, or " +
  "answer_question for anything else. Never end a turn with prose alone — a turn that " +
  "calls no terminal tool is a lost message to the user.";

/**
 * How to use the composition-table lookup, as a SEPARATE export.
 *
 * Mastra's per-call `instructions` REPLACES the agent's, it does not append — so every flow that
 * passes its own system text (all of them: SYSTEM, SYSTEM_ROUTE, SYSTEM_CLASSIFY) silently dropped
 * this, and the model was offered `search_food_db` with nothing telling it how to use it. Measured
 * by capturing the system text a photo turn actually receives.
 *
 * The specific instruction that matters is "pass any similar food it could be confused with":
 * retrieval is driven by the name the model produces, so without an alternative the bulgur row is
 * never on the shortlist for a model that said couscous, and grounding SHARPENS the wrong answer
 * instead of correcting it. Phrased conditionally, so appending it where the tool may be absent
 * costs nothing.
 */
export const LOOKUP_GUIDANCE =
  "When search_food_db is available, look up each food you identify BEFORE submitting, passing " +
  "its English name together with any similar food it could be confused with, and use the " +
  "per-100g figures of the row you pick. If the search returns nothing, keep your own estimate " +
  "rather than choosing a row that is merely close.";
