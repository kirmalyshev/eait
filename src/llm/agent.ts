import { Agent } from "@mastra/core/agent";
import type { Memory } from "@mastra/memory";
import { submitMealTool } from "./tools/mealActions.ts";

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
 */
export function createEngineAgent(model: EngineModel, memory: Memory): Agent {
  return new Agent({
    id: "eait-engine",
    name: "eait-engine",
    instructions:
      "You are the assistant behind a personal food-diary Telegram bot. You MUST finish every " +
      "turn by calling exactly one terminal tool — right now only submit_meal is available.",
    model,
    memory,
    tools: { submit_meal: submitMealTool },
  });
}
