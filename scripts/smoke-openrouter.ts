#!/usr/bin/env bun
// MANUAL smoke test — makes a REAL, BILLED OpenRouter call to verify that the configured
// model (default x-ai/grok-4.5) actually does vision + structured output. NOT part of
// `bun test`; run this once before relying on the model (Task 9 / go-live checkpoint).
//
//   OPENROUTER_API_KEY=... bun run scripts/smoke-openrouter.ts <path-to-food-image.jpg>

import { readFileSync } from "node:fs";
import { loadConfig } from "../src/config.ts";
import { OpenRouterProvider } from "../src/llm/openrouter.ts";

const imgPath = process.argv[2];
if (!imgPath) {
  console.error("usage: bun run scripts/smoke-openrouter.ts <path-to-food-image.jpg>");
  process.exit(1);
}

// config needs TELEGRAM_BOT_TOKEN too; allow a placeholder so the smoke test runs standalone.
const cfg = loadConfig({ TELEGRAM_BOT_TOKEN: "smoke", ...process.env });
const provider = new OpenRouterProvider({
  apiKey: cfg.openrouterApiKey,
  model: cfg.llmModel,
  timeoutMs: cfg.llmTimeoutMs,
});

const b64 = readFileSync(imgPath).toString("base64");
const schema = {
  type: "object",
  properties: {
    isFood: { type: "boolean" },
    items: { type: "array" },
    kcal: { type: "number" },
    protein_g: { type: "number" },
    carbs_g: { type: "number" },
    fat_g: { type: "number" },
  },
  required: ["isFood"],
};

console.error(`[smoke] model=${cfg.llmModel} image=${imgPath} bytes=${b64.length}`);
const out = await provider.chat({
  system: "You are a nutrition estimator. Return ONLY a JSON object, no prose.",
  userText:
    "Analyze this meal photo. Return JSON: isFood, items[{name,grams}], kcal, protein_g, carbs_g, fat_g.",
  imageB64: b64,
  jsonSchema: schema,
});

console.log("=== raw model output ===");
console.log(out);
try {
  console.log("=== parsed ok ===");
  console.log(JSON.parse(out));
} catch {
  console.log("=== NOT valid JSON as-is (analyzer's tolerant parse would run) ===");
}
