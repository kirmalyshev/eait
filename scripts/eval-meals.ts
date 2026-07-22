#!/usr/bin/env bun
// MANUAL accuracy eval (issue #6) — makes REAL, BILLED OpenRouter vision calls: one per
// fixture × run × model. NOT part of `bun test`. Requires a real OPENROUTER_API_KEY.
//
// Fixtures live in a gitignored dir (default ./eval): for each case put `<name>.jpg` (any of
// jpg/jpeg/png/webp) next to `<name>.json` with the kitchen-scale ground truth:
//   { "kcal": 620, "protein_g": 40, "carbs_g": 55, "fat_g": 20, "total_grams": 340 }
// Only `kcal` is required. Photos never enter git — the dir is ignored by name.
//
//   OPENROUTER_API_KEY=... bun run scripts/eval-meals.ts
//     [--dir eval] [--runs 3] [--models x-ai/grok-4.5,anthropic/claude-sonnet-5]
//
// Models run SEQUENTIALLY, cases sequentially within a model — parallel calls would skew any
// latency observations and hammer rate limits for zero benefit at N=20.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { analyzeMeal } from "../src/analyzer.ts";
import {
  ExpectationSchema, pairFixtures, renderReport, summarize,
  type CaseInput, type EvalRun,
} from "../src/eval.ts";
import { OpenRouterProvider } from "../src/llm/openrouter.ts";
import type { Profile } from "../src/types.ts";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  console.error("OPENROUTER_API_KEY is required (this script makes billed calls).");
  process.exit(1);
}

const dir = arg("dir", "eval");
const runs = Number(arg("runs", "1"));
if (!Number.isInteger(runs) || runs < 1) {
  console.error("--runs must be a positive integer");
  process.exit(1);
}
const models = arg("models", process.env.LLM_MODEL ?? "x-ai/grok-4.5")
  .split(",").map((m) => m.trim()).filter(Boolean);

let files: string[];
try {
  files = readdirSync(dir);
} catch {
  console.error(`fixture dir not found: ${dir} — create it and add <name>.jpg + <name>.json pairs`);
  process.exit(1);
}
const { cases, orphans } = pairFixtures(files);
for (const o of orphans) console.warn(`orphan fixture (skipped): ${o}`);
if (cases.length === 0) {
  console.error(`no complete fixture pairs in ${dir}/ — nothing to evaluate`);
  process.exit(1);
}

// A neutral profile: the eval measures the model, not personalization.
const profile: Profile = { telegram_id: 0, lang: "en", goal: "maintain", restrictions: [] };

console.log(
  `${cases.length} case(s) × ${runs} run(s) × ${models.length} model(s) = ` +
    `${cases.length * runs * models.length} billed vision calls\n`,
);

for (const model of models) {
  const provider = new OpenRouterProvider({ apiKey, model, log: () => {} });
  const inputs: CaseInput[] = [];
  for (const c of cases) {
    const expected = ExpectationSchema.parse(JSON.parse(readFileSync(join(dir, c.expectation), "utf8")));
    const bytes = new Uint8Array(readFileSync(join(dir, c.image)));
    const caseRuns: EvalRun[] = [];
    for (let i = 0; i < runs; i++) {
      try {
        const a = await analyzeMeal(bytes, profile, provider);
        if (!a.isFood) throw new Error("model said isFood=false");
        caseRuns.push({
          kcal: a.kcal, protein_g: a.protein_g, carbs_g: a.carbs_g, fat_g: a.fat_g,
          grams_total: a.items.reduce((sum, item) => sum + item.grams, 0),
        });
        console.log(`  ${model} ${c.name} run ${i + 1}: kcal=${a.kcal}`);
      } catch (e) {
        // A failed run is reported and EXCLUDED — a zeroed placeholder would poison the MAE.
        console.error(`  ${model} ${c.name} run ${i + 1} FAILED: ${(e as Error).message}`);
      }
    }
    if (caseRuns.length) inputs.push({ expected, runs: caseRuns });
    else console.error(`  ${model} ${c.name}: all runs failed — case excluded from the summary`);
  }
  // A model whose every call failed (bad id, provider policy 403) must not kill the models
  // that come after it — one summary lost, not the whole sweep.
  if (inputs.length === 0) {
    console.error(`\n${model}: EVERY case failed — no summary. Check the model id / provider policy.\n`);
    process.exitCode = 1;
    continue;
  }
  console.log("\n" + renderReport(model, summarize(inputs)) + "\n");
}
