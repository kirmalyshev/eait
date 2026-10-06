// The local-agent transport, exercised against a FAKE CLI binary — a spawned shell script, never
// a real agent and never a billed call. `localAgentPorts` takes the binary's path as `command`,
// so the tests drive the real spawn/timeout/envelope machinery with a process they authored.

import { describe, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { localAgentPorts, type AgentProvider } from "./local-agent.ts";
import type { CoachInput } from "./port.ts";

/**
 * The fake agent. claude answers on stdout as the `--output-format json` envelope; codex writes
 * the file its `-o` flag names. `replies.json` holds `{"rules": [{"match","reply"}],
 * "sequence": […]}`: a rule's reply is given when `match` appears in argv or stdin (which is how
 * the parallel route/speculation pair stays deterministic), else the sequence is consumed in
 * spawn order. Every call's argv and stdin are appended to `calls.jsonl` for the assertions.
 */
const FAKE_AGENT = `import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
const dir = dirname(Bun.argv[1]);
const plan = JSON.parse(readFileSync(join(dir, "replies.json"), "utf8"));
let n = 0;
try { n = Number(readFileSync(join(dir, "count"), "utf8")); } catch {}
writeFileSync(join(dir, "count"), String(n + 1));
const argv = process.argv.slice(2);
let stdin = "";
for await (const chunk of Bun.stdin.stream()) stdin += new TextDecoder().decode(chunk);
appendFileSync(join(dir, "calls.jsonl"), JSON.stringify({ argv, stdin }) + "\\n");
const hay = argv.join(" ") + "\\n" + stdin;
const rule = (plan.rules ?? []).find((r) => hay.includes(r.match));
const seq = plan.sequence ?? [""];
const reply = rule ? rule.reply : seq[Math.min(n, seq.length - 1)];
if (argv[0] === "exec") {
  const o = argv.indexOf("-o");
  if (o < 0) process.exit(2);
  writeFileSync(argv[o + 1], reply);
} else {
  process.stdout.write(JSON.stringify({ is_error: false, subtype: "success", total_cost_usd: 0.01, result: reply }));
}
`;

interface FakeAgent {
  bin: string;
  dir: string;
  plan(rules: { match?: string; reply: string }[], sequence?: string[]): void;
  calls(): { argv: string[]; stdin: string }[];
}

function fixture(): FakeAgent {
  const dir = mkdtempSync(join(tmpdir(), "eait-fake-agent-"));
  writeFileSync(join(dir, "fake-agent.ts"), FAKE_AGENT);
  const bin = join(dir, "fake-agent");
  writeFileSync(bin, `#!/bin/sh\nexec bun "${join(dir, "fake-agent.ts")}" "$@"\n`);
  chmodSync(bin, 0o755);
  return {
    bin, dir,
    plan(rules, sequence = []) {
      writeFileSync(join(dir, "replies.json"), JSON.stringify({ rules, sequence }));
    },
    calls() {
      return readFileSync(join(dir, "calls.jsonl"), "utf8").trim().split("\n")
        .map((l) => JSON.parse(l) as { argv: string[]; stdin: string });
    },
  };
}

function ports(provider: AgentProvider, fake: FakeAgent) {
  return localAgentPorts({
    provider, command: fake.bin, scratchDir: join(fake.dir, "scratch"),
    timeoutMs: 30_000, concurrency: 2,
  });
}

const ANALYSIS = {
  isFood: true,
  items: [{ name: "Boiled eggs", name_en: "boiled eggs", grams: 100, kcal: 155,
    protein_g: 13, carbs_g: 1.1, fat_g: 11, kcal_per_100g: 155 }],
  kcal: 155, protein_g: 13, carbs_g: 1.1, fat_g: 11, satfat_g: 3.3, fiber_g: 0,
  sugar_g: 1.1, sodium_mg: 124, confidence: "medium", notes: "",
};

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);

const PHOTO_INPUT = {
  images: [JPEG],
  profile: { user_id: "u1", lang: "en", goal: "lose", sex: "male", birth_year: 1990,
    height_cm: 183, weight_kg: 93, target_weight_kg: 88, activity: "some", pace: "steady",
    country: "de", restrictions: [], medical_limitations: null, food_allergies: null,
    product_limitations: null, onboarded_at: "2026-01-01T00:00:00.000Z" },
  targets: { kcal: 2393, protein_g: 141, fat_g: 80, carbs_g: 250 },
} as unknown as Parameters<ReturnType<typeof localAgentPorts>["analyzePhoto"]>[0];

const ROUTE_INPUT = {
  text: "two boiled eggs and a slice of rye bread",
  profile: PHOTO_INPUT.profile,
  targets: PHOTO_INPUT.targets,
  todayMeals: [], week: [],
} as unknown as Parameters<ReturnType<typeof localAgentPorts>["routeText"]>[0];

const COACH_INPUT: CoachInput = {
  text: "how did my week go?",
  context: {
    profile: ROUTE_INPUT.profile, targets: ROUTE_INPUT.targets,
    basis: { bmr: 1900, tdee: 2900, activityDeltaKcal: 1000, requestedDeltaKcal: -500, appliedDeltaKcal: -500, shareCapApplied: false, floorKcal: 1500, floorApplied: false, usedFallbackBand: false },
    today: "2026-09-02", localTime: "19:10", todayMeals: [], week: [], projection: null,
  },
  history: [{ role: "user", text: "two eggs" }],
};

describe("analyzePhoto", () => {
  test("the envelope's result is parsed against the meal schema — claude", async () => {
    const fake = fixture();
    fake.plan([], [JSON.stringify(ANALYSIS)]);
    const costs: (number | null)[] = [];
    const out = await ports("claude-cli", fake).analyzePhoto({ ...PHOTO_INPUT, onCost: (c) => costs.push(c) });
    expect(out.items[0]!.name).toBe("Boiled eggs");
    expect(out.kcal).toBe(155);
    expect(costs).toEqual([0.01]);
    const call = fake.calls()[0]!;
    expect(call.argv).toContain("--restricted");
    expect(call.argv).toContain("--output-format");
    expect(call.stdin).toContain("image-0.jpg");
  });

  test("the answer comes out of the file `-o` named — codex", async () => {
    const fake = fixture();
    fake.plan([], [JSON.stringify(ANALYSIS)]);
    const out = await ports("codex-cli", fake).analyzePhoto(PHOTO_INPUT);
    expect(out.items[0]!.name).toBe("Boiled eggs");
    const call = fake.calls()[0]!;
    expect(call.argv).toContain("exec");
    expect(call.argv).toContain("--image");
    expect(call.argv).toContain("-o");
  });

  test("a reply that is not JSON gets one retry, then fails the call", async () => {
    const fake = fixture();
    fake.plan([], ["not json at all", JSON.stringify(ANALYSIS)]);
    const out = await ports("claude-cli", fake).analyzePhoto(PHOTO_INPUT);
    expect(out.kcal).toBe(155);
    expect(fake.calls()).toHaveLength(2);
    expect(fake.calls()[1]!.stdin).toContain("did not satisfy");
  });
});

describe("routeText", () => {
  test("a food message is routed to a meal — the route and the speculation run as two spawns", async () => {
    const fake = fixture();
    fake.plan([
      { match: "text side of a nutrition tracker", reply: JSON.stringify({ intent: "meal" }) },
      { match: "estimate the nutritional content of a meal from the user's own description", reply: JSON.stringify(ANALYSIS) },
    ]);
    const out = await ports("claude-cli", fake).routeText(ROUTE_INPUT);
    expect(out).toEqual({ intent: "meal", analysis: { ...ANALYSIS, confidence: "medium" }, dayOffset: 0 });
    expect(fake.calls()).toHaveLength(2);
  });

  test("a question is answered", async () => {
    const fake = fixture();
    fake.plan([
      { match: "text side of a nutrition tracker", reply: JSON.stringify({ intent: "answer", text: "You have had 0g of protein." }) },
      { match: "estimate the nutritional content", reply: JSON.stringify(ANALYSIS) },
    ]);
    const out = await ports("claude-cli", fake).routeText(ROUTE_INPUT);
    expect(out).toEqual({ intent: "answer", text: "You have had 0g of protein." });
  });
});

describe("coach", () => {
  test("a tool_calls reply runs the closure and its result goes back in the transcript", async () => {
    const fake = fixture();
    fake.plan([], [
      JSON.stringify({ tool_calls: [{ name: "get_meals", arguments: { from: "2026-08-26", to: "2026-09-02" } }] }),
      JSON.stringify({ reply: "Six meals, 11,200kcal.", suggestions: ["And protein?"] }),
    ]);
    const seen: unknown[] = [];
    const out = await ports("claude-cli", fake).coach(COACH_INPUT, {
      get_meals: async (args) => { seen.push(args); return [{ date: "2026-09-01", kcal: 640 }]; },
    });
    expect(seen).toEqual([{ from: "2026-08-26", to: "2026-09-02" }]);
    expect(out).toEqual({ reply: "Six meals, 11,200kcal.", suggestions: ["And protein?"] });
    expect(fake.calls()).toHaveLength(2);
    expect(fake.calls()[1]!.stdin).toContain("tool get_meals answered");
  });

  test("prose where JSON was asked for is still the answer", async () => {
    const fake = fixture();
    fake.plan([], ["You had a quiet week — nothing logged since Tuesday."]);
    const out = await ports("claude-cli", fake).coach(COACH_INPUT, {});
    expect(out.reply).toContain("quiet week");
    expect(out.suggestions).toEqual([]);
  });
});
