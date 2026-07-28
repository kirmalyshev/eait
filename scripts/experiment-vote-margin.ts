// MANUAL experiment. SPENDS MONEY — one billed vision call per fixture per run.
//
//   OPENROUTER_API_KEY=... bun run scripts/experiment-vote-margin.ts \
//     [--dir eval/telegram] [--runs 5] [--temp 0.2] [--limit 20]
//
// THE QUESTION. A3 asks the user which food a dish contains when the bot cannot tell bulgur from
// couscous. It needs a trigger — some signal that says "this one is ambiguous". Two candidates:
//
//   1. the model self-reports alternatives (`alt[]`)      — free, one call
//   2. the model is run N times and disagrees with itself — N calls, but disagreement is
//                                                            demonstrated rather than claimed
//
// Candidate 2 only works if the disagreement EXISTS. We ship at temperature 0.2, which is close to
// argmax, so the model may simply answer identically every time — in which case vote margin is
// structurally incapable of being a trigger at production settings, no matter how appealing the
// idea is, and A3 must use `alt[]`. That is the question this run answers, and either answer is
// decisive.
//
// It reports agreement per fixture and names every CONTESTED food (one that appears in some runs
// and not others). A contested food is exactly what A3 would ask about, so the contested list is a
// preview of the questions the feature would generate.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgv } from "../src/argv.ts";
import { analyzeMeal } from "../src/analyzer.ts";
import { ExpectationSchema } from "../src/eval.ts";
import { createProvider } from "../src/llm/factory.ts";
import { loadConfig } from "../src/config.ts";
import type { ChatRequest, LLMProvider } from "../src/llm/provider.ts";
import type { Profile } from "../src/types.ts";

const argv = parseArgv(process.argv.slice(2), {
  valued: ["dir", "runs", "temp", "limit"],
  boolean: [],
});
const dirs = (argv.values.dir ?? "eval/telegram,eval/telegram-unverified").split(",");
const runs = Number(argv.values.runs ?? "5");
const temp = Number(argv.values.temp ?? "0.2");
const limit = Number(argv.values.limit ?? "20");

const config = loadConfig(process.env);
const base = createProvider(config);

/**
 * Wraps the real provider and rewrites the temperature on the way through.
 *
 * `analyzeMeal` hardcodes the shipped temperature, and rightly so — an experiment must not be able
 * to change what production sends. Decorating the provider gets the sweep without touching the
 * analyzer, so the prompt, schema and parse under test are byte-for-byte the ones that ship.
 */
const atTemperature = (t: number): LLMProvider => ({
  chat: (req: ChatRequest) => base.chat({ ...req, temperature: t }),
});

const profile: Profile = {
  telegram_id: 0, lang: "ru", goal: "maintain", restrictions: [],
  medical_limitations: null, food_allergies: null, product_limitations: null, reply_format: null,
};

/** Grouping key. The model writes `name` in the user's language; `name_en` is the comparable one. */
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * The measurement this experiment actually needs, and the one the first run got wrong.
 *
 * Comparing raw strings counts "coffee with milk" against "coffee, with milk" as a disagreement
 * about what the food IS. It is not — it is the same identification phrased differently, and at
 * production temperature that phrasing drift swamped the signal completely. A trigger built on raw
 * strings would fire on every meal and mean nothing.
 *
 * So foods are compared as SORTED TOKEN SETS with filler dropped and a crude singular fold, which
 * collapses word order, punctuation and plurals. What survives is a genuine difference in the food
 * named — "bulgur" against "couscous", or a component appearing in one run and not another.
 */
const FILLER = new Set(["with", "and", "of", "a", "the", "in", "on", "plain", "cooked", "boiled"]);
const idKey = (s: string): string =>
  [
    ...new Set(
      s
        .toLowerCase()
        .split(/[^a-z0-9\u0400-\u04ff]+/)
        .map((t) => (t.length > 3 && t.endsWith("s") ? t.slice(0, -1) : t))
        .filter((t) => t && !FILLER.has(t)),
    ),
  ]
    .sort()
    .join(" ");

interface Case { stem: string; dir: string; image: Uint8Array; truth: string[] | undefined }

const cases: Case[] = [];
for (const dir of dirs) {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    console.error(`skip ${dir}: not readable`);
    continue;
  }
  for (const f of entries.filter((e) => e.endsWith(".json")).sort()) {
    const stem = f.slice(0, -5);
    const image = entries.find((e) => e.startsWith(`${stem}.`) && !e.endsWith(".json"));
    if (!image) continue;
    const parsed = ExpectationSchema.safeParse(JSON.parse(readFileSync(join(dir, f), "utf8")));
    cases.push({
      stem, dir,
      image: new Uint8Array(readFileSync(join(dir, image))),
      truth: parsed.success ? parsed.data.items : undefined,
    });
  }
}
const selected = cases.slice(0, limit);
if (selected.length === 0) {
  console.error("no fixtures found");
  process.exit(1);
}

console.log(
  `${selected.length} fixture(s) x ${runs} run(s) at temperature ${temp} = ` +
    `${selected.length * runs} BILLED vision calls\n`,
);

const provider = atTemperature(temp);
let totalFoods = 0;
let totalContested = 0;
let totalRawFoods = 0;
let totalRawContested = 0;
const contestedExamples: string[] = [];

for (const c of selected) {
  // Sequential per fixture: the runs of ONE photo are the measurement, and interleaving them with
  // other photos' runs buys nothing but rate-limit risk.
  const perRun: Set<string>[] = [];
  const perRunId: Set<string>[] = [];
  for (let i = 0; i < runs; i++) {
    try {
      const a = await analyzeMeal([c.image], profile, provider);
      perRun.push(new Set(a.items.map((it) => norm(it.name_en ?? it.name)).filter(Boolean)));
      perRunId.push(new Set(a.items.map((it) => idKey(it.name_en ?? it.name)).filter(Boolean)));
    } catch (e) {
      console.warn(`  ${c.stem} run ${i + 1} failed: ${e instanceof Error ? e.message : e}`);
    }
  }
  if (perRun.length < 2) {
    console.log(`${c.stem}: too few successful runs to compare`);
    continue;
  }

  const tally = (sets: Set<string>[]) => {
    const counts = new Map<string, number>();
    for (const set of sets) for (const name of set) counts.set(name, (counts.get(name) ?? 0) + 1);
    return counts;
  };
  const rawCounts = tally(perRun);
  const idCounts = tally(perRunId);
  const rawContested = [...rawCounts.entries()].filter(([, n]) => n < perRun.length).length;
  const idContested = [...idCounts.entries()].filter(([, n]) => n < perRun.length);

  totalFoods += idCounts.size;
  totalContested += idContested.length;
  totalRawFoods += rawCounts.size;
  totalRawContested += rawContested;

  const truth = c.truth?.length ? `\n    truth: ${c.truth.join(", ")}` : "";
  console.log(
    `${c.stem}  IDENTITY ${idCounts.size - idContested.length}/${idCounts.size} unanimous  ` +
      `| phrasing ${rawCounts.size - rawContested}/${rawCounts.size} unanimous  (${perRun.length} runs)${truth}`,
  );
  for (const [name, n] of idContested.sort((a, b) => b[1] - a[1])) {
    console.log(`    CONTESTED IDENTITY  ${n}/${perRun.length}  ${name}`);
    contestedExamples.push(name);
  }
}

const pct = (a: number, b: number) => (b === 0 ? 0 : Math.round((a / b) * 100));
console.log(
  `\n=== at temperature ${temp}\n` +
    `    IDENTITY contested ${totalContested}/${totalFoods} (${pct(totalContested, totalFoods)}%)  ` +
    `<- the only figure a trigger could use\n` +
    `    phrasing contested ${totalRawContested}/${totalRawFoods} (${pct(totalRawContested, totalRawFoods)}%)  ` +
    `<- naming drift; a raw-string trigger would fire on this and mean nothing`,
);
console.log(
  totalContested === 0
    ? "NO disagreement. Vote margin cannot be A3's trigger at this temperature — it would never\n" +
        "fire. A3 must use the model's self-reported alt[], or the sweep must move temperature."
    : "Disagreement exists, so vote margin is a POSSIBLE trigger. Whether it is a GOOD one depends\n" +
        "on whether the contested foods above are the genuinely ambiguous ones, or just noise.",
);
