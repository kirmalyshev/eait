#!/usr/bin/env bun
// MANUAL parity harness — makes REAL, BILLED calls: TWO per fixture (one per LLM path). NOT part
// of `bun test`. Requires a real OPENROUTER_API_KEY and the shared dev Postgres (Mastra Memory
// needs storage even on a turn that uses none).
//
// The gate for the Mastra cutover (design: docs/design/2026-07-28-mastra-engine-boundary.md,
// stage 1). Runs both paths over the same photos and prints the difference:
//
//   old: analyzeMeal(images, profile, provider)        → provider.chat → OpenRouter
//   new: analyzeMealViaAgent(agent, images, profile)   → Mastra agent → submit_meal
//
//   OPENROUTER_API_KEY=... bun run scripts/parity-llm-paths.ts [--dir eval/telegram] [--limit N]
//
// WHAT A CLEAN RESULT LOOKS LIKE — and why it is not "identical numbers". Both paths send the
// same prompt (`analyzeViaAgent.ts` imports SYSTEM and buildUserText from analyzer.ts, asserted by
// test) to the same model at the same temperature, but the model is not deterministic and the
// agent path additionally offers tools. So the question this answers is NOT "are the two runs
// equal" — a second run of the SAME path would not be either. It is "is the gap between paths
// within the gap the model already has with itself".
//
// That is why `--repeat` exists and why the report prints a WITHIN-PATH baseline: the old path
// runs twice, and its own run-to-run spread is the yardstick the cross-path spread is read
// against. A cross-path kcal delta of 12% means nothing until you know the same model disagrees
// with itself by 10% on the same photo.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { analyzeMeal } from "../src/analyzer.ts";
import { pairFixtures } from "../src/eval.ts";
import { OpenRouterProvider } from "../src/llm/openrouter.ts";
import { createMastra } from "../src/llm/mastra.ts";
import { createEngineAgent } from "../src/llm/agent.ts";
import { analyzeMealViaAgent } from "../src/llm/analyzeViaAgent.ts";
import { buildRequestContext } from "../src/llm/context.ts";
import { modelRouterId } from "../src/llm/model.ts";
import { loadFoodIndex } from "../src/food_db.ts";
import { parseArgv, type ParsedArgv } from "../src/argv.ts";
import type { MealAnalysis, Profile } from "../src/types.ts";

let argv: ParsedArgv;
try {
  argv = parseArgv(process.argv.slice(2), {
    valued: ["dir", "limit", "repeat"],
    // Grounding is a CAPABILITY the agent path has and the old path cannot have — search_food_db
    // has no equivalent behind `provider.chat`. Leaving it on measures transport and grounding
    // together, and the first run of this harness did exactly that: item agreement fell to 60%
    // against a 92% within-path baseline, which is unreadable as either a transport regression or
    // a grounding effect. Run it BOTH ways: --no-food-db isolates the transport.
    boolean: ["no-food-db"],
  });
} catch (e) {
  console.error((e as Error).message);
  process.exit(2);
}

/** A flag present but unparseable is a typo, not a request for the default — and this script bills. */
function intArg(name: string, fallback: number): number {
  const raw = argv.values[name];
  if (raw === undefined) return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    console.error(`--${name} must be a positive integer, got ${JSON.stringify(raw)}`);
    process.exit(2);
  }
  return n;
}

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  console.error("OPENROUTER_API_KEY is required (this script makes billed calls).");
  process.exit(1);
}

const dir = argv.values.dir ?? "eval/telegram";
const limit = intArg("limit", Number.MAX_SAFE_INTEGER);
const repeat = intArg("repeat", 1);
const model = process.env.LLM_MODEL?.trim() || "x-ai/grok-4.5";
const provider = process.env.LLM_PROVIDER?.trim() || "openrouter";

let files: string[];
try {
  files = readdirSync(dir);
} catch {
  console.error(`fixture dir not found: ${dir}`);
  process.exit(1);
}
const { cases } = pairFixtures(files);
const selected = cases.slice(0, limit);
if (selected.length === 0) {
  console.error(`no complete fixture pairs in ${dir}/`);
  process.exit(1);
}

// The eval's neutral profile: parity is a property of the two transports, not of personalization.
// A profile with restrictions would also exercise the verdict gate, which both paths now share —
// worth its own check, but it would confound this one.
const profile: Profile = {
  telegram_id: 1, lang: "en", goal: "maintain", restrictions: [],
  medical_limitations: null, food_allergies: null, product_limitations: null, reply_format: null,
};

/** The comparable projection of an analysis. Notes and confidence are prose and drift freely. */
interface Shape {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  grams: number;
  items: string[];
}
const shapeOf = (a: MealAnalysis): Shape => ({
  kcal: a.kcal, protein_g: a.protein_g, carbs_g: a.carbs_g, fat_g: a.fat_g,
  grams: a.items.reduce((s, i) => s + i.grams, 0),
  items: a.items.map((i) => (i.name_en ?? i.name).toLowerCase().trim()).sort(),
});

const pct = (a: number, b: number): number => {
  const base = (Math.abs(a) + Math.abs(b)) / 2;
  return base === 0 ? 0 : (Math.abs(a - b) / base) * 100;
};

/**
 * Item-name agreement as a Jaccard index over token sets.
 *
 * Token sets, not raw strings: the vote-margin experiment (`experiment-vote-margin.ts`) measured
 * that raw-string comparison counts "fried eggs" vs "eggs, fried" as a disagreement, and that
 * phrasing drift of exactly that kind swamped the identity signal — 70% apparent disagreement
 * against a real rate nearer 5-10%. Folding to tokens removes the phrasing half. It does NOT
 * remove synonyms ("aubergine"/"eggplant"), so this still OVERSTATES divergence, and the
 * within-path baseline is the only honest reading of how much.
 */
function itemAgreement(a: string[], b: string[]): number {
  const tok = (xs: string[]) => new Set(xs.flatMap((x) => x.split(/[^\p{L}\p{N}]+/u)).filter(Boolean));
  const A = tok(a);
  const B = tok(b);
  if (A.size === 0 && B.size === 0) return 100;
  let shared = 0;
  for (const t of A) if (B.has(t)) shared++;
  return (shared / (A.size + B.size - shared)) * 100;
}

interface Comparison { kcal: number; macros: number; grams: number; items: number }
const compare = (x: Shape, y: Shape): Comparison => ({
  kcal: pct(x.kcal, y.kcal),
  macros: (pct(x.protein_g, y.protein_g) + pct(x.carbs_g, y.carbs_g) + pct(x.fat_g, y.fat_g)) / 3,
  grams: pct(x.grams, y.grams),
  items: itemAgreement(x.items, y.items),
});

const median = (xs: number[]): number => {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

// ---- wiring both paths ----

const oldProvider = new OpenRouterProvider({ apiKey, model, log: () => {} });

// A throwaway Mastra database: this harness must never write agent memory into the dev database the
// bot uses, and a parity run is not a conversation worth keeping either way.
const pg = {
  host: process.env.PGHOST?.trim() || "127.0.0.1",
  port: Number(process.env.PGPORT) || 5439,
  user: process.env.PGUSER?.trim() || "eait",
  password: process.env.PGPASSWORD?.trim() || "eait",
  database: `eait_parity_${Date.now()}`,
};
const admin = new (await import("bun")).SQL({ ...pg, database: "postgres" });
await admin`CREATE DATABASE ${admin(pg.database)}`.catch(() => {});
await admin.close();

const { mastra, memory } = await createMastra(pg);
// The food index is loaded when present so the agent path runs as production would — WITH
// search_food_db. Omitting it would compare the new path's degraded mode against the old path's
// only mode, and call the result parity.
const loaded = argv.flags.has("no-food-db") ? null : await loadFoodIndex();
const agent = createEngineAgent(modelRouterId({ llmProvider: provider, llmModel: model }), memory, {
  ...(loaded ? { foodIndex: loaded.index } : {}),
});

console.log(
  `parity ${new Date().toISOString()}: dir=${dir} model=${model} cases=${selected.length} ` +
    `repeat=${repeat} foodDb=${loaded ? `on (${loaded.index.size} rows)` : "off"}`,
);
console.log(`${selected.length * (repeat + 1)} billed calls\n`);

const cross: Comparison[] = [];
const within: Comparison[] = [];
let failures = 0;

/** Drop the scratch database. Registered for the throw path too — a harness that leaks a database
 * per run turns "I ran the gate a few times" into a full disk. */
async function teardown(): Promise<void> {
  await (mastra.getStorage() as { close?: () => Promise<void> } | undefined)?.close?.();
  const drop = new (await import("bun")).SQL({ ...pg, database: "postgres" });
  await drop`DROP DATABASE IF EXISTS ${drop(pg.database)}`.catch(() => {});
  await drop.close();
}

try {
  for (const c of selected) {
    const bytes = new Uint8Array(readFileSync(join(dir, c.image)));
    try {
      // The old path runs twice when --repeat 2: the second run is the within-path baseline, and it
      // must be the SAME path so the baseline measures model nondeterminism alone.
      const oldRuns: Shape[] = [];
      for (let i = 0; i < repeat; i++) {
        oldRuns.push(shapeOf(await analyzeMeal([bytes], profile, oldProvider)));
      }
      const viaAgent = shapeOf(
        await analyzeMealViaAgent(agent, [bytes], profile, buildRequestContext(1)),
      );

      const x = compare(oldRuns[0]!, viaAgent);
      cross.push(x);
      console.log(
        `  ${c.name}  cross: kcal ${x.kcal.toFixed(1)}%  macros ${x.macros.toFixed(1)}%  ` +
          `grams ${x.grams.toFixed(1)}%  items ${x.items.toFixed(0)}% agree` +
          `   [old ${oldRuns[0]!.kcal} kcal → agent ${viaAgent.kcal} kcal]`,
      );
      if (oldRuns.length > 1) {
        const w = compare(oldRuns[0]!, oldRuns[1]!);
        within.push(w);
        console.log(
          `  ${" ".repeat(c.name.length)}  within: kcal ${w.kcal.toFixed(1)}%  ` +
            `macros ${w.macros.toFixed(1)}%  grams ${w.grams.toFixed(1)}%  items ${w.items.toFixed(0)}% agree`,
        );
      }
    } catch (e) {
      failures++;
      console.error(`  ${c.name} FAILED: ${(e as Error).message}`);
    }
  }

  const report = (label: string, xs: Comparison[]) =>
    xs.length === 0
      ? `${label}: no data`
      : `${label} (median of ${xs.length}): kcal ${median(xs.map((x) => x.kcal)).toFixed(1)}%  ` +
        `macros ${median(xs.map((x) => x.macros)).toFixed(1)}%  ` +
        `grams ${median(xs.map((x) => x.grams)).toFixed(1)}%  ` +
        `items ${median(xs.map((x) => x.items)).toFixed(0)}% agree`;

  console.log(`\n${report("CROSS-PATH  old vs agent", cross)}`);
  if (within.length) {
    console.log(report("WITHIN-PATH old vs old  ", within));
    console.log(
      "\nRead the first line against the second. Cross-path divergence at or below the " +
        "within-path baseline is the model disagreeing with itself, not the transport diverging.",
    );
  }
  if (failures) console.log(`\n${failures} case(s) failed outright`);
} finally {
  await teardown();
}

// Partial coverage must not read as a clean gate to whoever runs this before a cutover.
if (failures) process.exit(3);
