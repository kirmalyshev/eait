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
  ExpectationSchema, pairFixtures, renderCoverage, renderReport, summarize,
  type CaseInput, type EvalRun, type Expectation,
} from "../src/eval.ts";
import { OpenRouterProvider } from "../src/llm/openrouter.ts";
import type { Profile } from "../src/types.ts";

// A flag present but empty ("--mode" with nothing after it, or "--mode --runs 3") is a typo, not
// a request for the default: silently falling back would run a BILLED eval measuring something
// other than what was asked for, and the report would not say so.
function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const value = process.argv[i + 1];
  if (!value || value.startsWith("--")) {
    console.error(`--${name} was given with no value`);
    process.exit(2);
  }
  return value;
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
if (models.length === 0) {
  // e.g. `--models ","` — otherwise the loop body never runs and the script exits 0 with no report.
  console.error("--models listed no usable model slugs");
  process.exit(2);
}

// Structured-output mode: "schema" mirrors production (response_format json_schema — works for
// grok/OpenAI-style), "prompt" inlines the schema and drops response_format so providers that
// choke on it (several Chinese vision models) can compete. Use "prompt" for a fair cross-vendor
// A/B — it's the one mode every reachable model honors.
const mode = arg("mode", "schema");
if (mode !== "schema" && mode !== "prompt") {
  console.error('--mode must be "schema" or "prompt"');
  process.exit(1);
}

let files: string[];
try {
  files = readdirSync(dir);
} catch {
  console.error(`fixture dir not found: ${dir} — create it and add <name>.jpg + <name>.json pairs`);
  process.exit(1);
}
const { cases, orphans } = pairFixtures(files);
// Orphans go to STDOUT, not stderr: a fixture that silently never ran is exactly the thing an
// archived report must disclose, and stderr is not in the archived report.
for (const o of orphans) console.log(`orphan fixture (skipped, no ground truth pair): ${o}`);
if (cases.length === 0) {
  console.error(`no complete fixture pairs in ${dir}/ — nothing to evaluate`);
  process.exit(1);
}

// Parse EVERY expectation before the first billed call. Parsing lazily inside the model loop
// means a malformed fixture aborts after spending money on every case before it — and after an
// earlier model's report has already printed, which reads as a complete run to anyone tailing.
const expectations = new Map<string, Expectation>();
for (const c of cases) {
  try {
    expectations.set(c.name, ExpectationSchema.parse(JSON.parse(readFileSync(join(dir, c.expectation), "utf8"))));
  } catch (e) {
    console.error(`fixture ${c.expectation} is not valid ground truth: ${(e as Error).message}`);
    process.exit(1);
  }
}

// A neutral profile: the eval measures the model, not personalization.
const profile: Profile = { telegram_id: 0, lang: "en", goal: "maintain", restrictions: [], medical_limitations: null, food_allergies: null, product_limitations: null, reply_format: null };

// Provenance on stdout: mode is the exact variable a cross-vendor A/B exists to control, so two
// archived reports must never be indistinguishable on it.
console.log(
  `eval ${new Date().toISOString()}: dir=${dir} mode=${mode} runs=${runs} ` +
    `models=${models.join(",")}`,
);
console.log(
  `${cases.length} case(s) × ${runs} run(s) × ${models.length} model(s) = ` +
    `${cases.length * runs * models.length} billed vision calls\n`,
);

let incomplete = false;
for (const model of models) {
  const provider = new OpenRouterProvider({ apiKey, model, log: () => {} });
  const inputs: CaseInput[] = [];
  let refused = 0;
  let failed = 0;
  let runsCompleted = 0;
  for (const c of cases) {
    const expected = expectations.get(c.name)!;
    const bytes = new Uint8Array(readFileSync(join(dir, c.image)));
    const caseRuns: EvalRun[] = [];
    // "Not food" is an ACCURACY result, not a transport fault, so it is counted apart from call
    // failures — a cautious model that declines the ambiguous photos would otherwise look better
    // than one that guesses, by being scored on an easier subset.
    let caseRefused = false;
    for (let i = 0; i < runs; i++) {
      try {
        const a = await analyzeMeal([bytes], profile, provider, undefined, mode);
        if (!a.isFood) {
          caseRefused = true;
          throw new Error("model said isFood=false");
        }
        const grams = a.items.reduce((sum, item) => sum + item.grams, 0);
        caseRuns.push({
          kcal: a.kcal, protein_g: a.protein_g, carbs_g: a.carbs_g, fat_g: a.fat_g,
          grams_total: grams,
        });
        runsCompleted++;
        // grams too, not just kcal: with the fixture ground truth alongside, the signed
        // grams/density split is recomputable from an archived log — but only if BOTH numbers are
        // on the line. Rounded, because summing model floats prints things like 99.99999999999999.
        console.log(
          `  ${model} ${c.name} run ${i + 1}: kcal=${a.kcal} grams=${Math.round(grams)}`,
        );
      } catch (e) {
        // A failed run is reported and EXCLUDED — a zeroed placeholder would poison the MAE.
        console.error(`  ${model} ${c.name} run ${i + 1} FAILED: ${(e as Error).message}`);
      }
    }
    if (caseRuns.length) inputs.push({ expected, runs: caseRuns });
    else if (caseRefused) refused++;
    else failed++;
  }
  const coverage = renderCoverage({
    fixtures: cases.length,
    evaluated: inputs.length,
    refused,
    failed,
    runsRequested: cases.length * runs,
    runsCompleted,
  });
  if (inputs.length < cases.length || runsCompleted < cases.length * runs) incomplete = true;
  // A model that failed EVERY case (bad slug, provider 403, rate-limit) must not abort the whole
  // A/B: summarize([]) throws by design, so guard it and move to the next model with a loud line.
  if (inputs.length === 0) {
    console.log(`\nmodel: ${model} — NO SUMMARY, every case failed\n${coverage}\n`);
    continue;
  }
  console.log("\n" + renderReport(model, summarize(inputs)) + "\n" + coverage + "\n");
}

// Exit non-zero on partial coverage. The numbers are still printed and still useful, but a
// wrapper or CI step must not read "some cases silently vanished" as success.
if (incomplete) process.exit(3);
