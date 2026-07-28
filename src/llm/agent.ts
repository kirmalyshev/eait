import { Agent } from "@mastra/core/agent";
import type { Memory } from "@mastra/memory";
import { submitMealTool } from "./tools/mealActions.ts";
import {
  answerQuestionTool, submitCorrectionTool, submitRedateTool, submitRestrictionsTool,
} from "./tools/routeActions.ts";
import { makeSearchFoodDbTool } from "./tools/foodDb.ts";
import type { FoodIndex } from "../food_db.ts";

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
  deps: { foodIndex?: FoodIndex } = {},
): Agent {
  return new Agent({
    id: "eait-engine",
    name: "eait-engine",
    instructions:
      "You are the assistant behind a personal food-diary Telegram bot. You MUST finish every " +
      "turn by calling exactly one terminal tool: submit_meal for food the user ate, " +
      "submit_correction to fix the focus meal's estimate, submit_redate to move the focus meal to " +
      "another day, or answer_question for anything else. submit_correction and submit_redate are " +
      "only valid when a focus meal was provided. Never end a turn with prose alone — a turn that " +
      "calls no terminal tool is a lost message to the user. " +
      "When search_food_db is available, look up each food you identify BEFORE submitting, passing " +
      "its English name together with any similar food it could be confused with, and use the " +
      "per-100g figures of the row you pick. If the search returns nothing, keep your own estimate " +
      "rather than choosing a row that is merely close.",
    model,
    memory,
    tools: {
      submit_meal: submitMealTool,
      submit_correction: submitCorrectionTool,
      submit_redate: submitRedateTool,
      answer_question: answerQuestionTool,
      submit_restrictions: submitRestrictionsTool,
      ...(deps.foodIndex ? { search_food_db: makeSearchFoodDbTool(deps.foodIndex) } : {}),
    },
  });
}
