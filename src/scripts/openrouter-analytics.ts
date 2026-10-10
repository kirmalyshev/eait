// What OpenRouter says the account's keys did — the analytics side of #602.
//
//   EAIT__BACKEND__OPENROUTER_MANAGEMENT_KEY=…  bun src/scripts/openrouter-analytics.ts [days]
//
// The MANAGEMENT key, not the request key — a different credential OpenRouter issues for the
// Analytics API, read here and here alone, never printed, never sent anywhere else. ABSENT MEANS
// SKIP: the command is a no-op on a box that has no management key, which is every box until one
// is written into the environment.
//
// Three reads, all metrics and never content:
//   GET /api/v1/analytics/meta       the metrics and dimensions the query endpoint takes today
//   POST /api/v1/analytics/query     requests, tokens, cost and latency by model and by provider,
//                                    each SPLIT BY API KEY so dev/eval traffic does not pollute
//                                    the production figures
//   GET /api/v1/activity             the account's daily usage and spend per model endpoint
//
// A per-call answer — did THIS provider call serve the model its row names, and what did it cost —
// is `openRouterGeneration` in `src/backend/llm/openrouter.ts`, which runs on the regular request
// key. This script is the aggregate; that is the spot-check.

const DAYS = Number(process.argv[2] ?? 30);

function die(message: string): never {
  console.error(`[eait] ${message}`);
  process.exit(1);
}

const key = process.env.EAIT__BACKEND__OPENROUTER_MANAGEMENT_KEY?.trim();
if (!key) {
  console.error("[eait] EAIT__BACKEND__OPENROUTER_MANAGEMENT_KEY is unset — skipping. " +
    "The Analytics API wants OpenRouter's MANAGEMENT key, not the request key.");
  process.exit(0);
}

const ROOT = "https://openrouter.ai/api/v1";
const headers = { authorization: `Bearer ${key}`, "content-type": "application/json" };

async function api(path: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(`${ROOT}${path}`, { ...init, headers: { ...headers, ...(init?.headers ?? {}) } });
  if (!res.ok) {
    // The status, never the body: an upstream error string can echo the key it was sent with.
    throw new Error(`openrouter analytics http ${res.status} on ${path}`);
  }
  return await res.json();
}

const end = new Date();
const start = new Date(end.getTime() - DAYS * 86_400_000);
const time_range = { start: start.toISOString(), end: end.toISOString() };

// The meta endpoint is the inventory — the metrics and dimensions the query endpoint accepts
// today — so the script asks by NAME for what exists rather than guessing at names that drift.
const meta = await api("/analytics/meta") as { data?: { metrics?: { name?: string }[]; dimensions?: { name?: string }[] } };
const metricNames = new Set((meta.data?.metrics ?? []).map((m) => m.name).filter((n): n is string => typeof n === "string"));
const dimensionNames = new Set((meta.data?.dimensions ?? []).map((d) => d.name).filter((n): n is string => typeof n === "string"));
console.error(`[eait] analytics meta: ${metricNames.size} metrics, ${dimensionNames.size} dimensions`);

// The figures the issue asks for — requests, tokens, cost, latency — under whatever names this
// API currently serves them, picked off the meta so a renamed field is a missing column and not a
// 400 nobody asked for.
const metrics = [
  "request_count", "tokens_prompt", "tokens_completion", "tokens_total",
  "total_usage", "usage_total", "cost",
  "latency_p50", "latency_p90", "latency_p95", "latency_p99", "latency_avg", "latency",
].filter((m) => metricNames.has(m));
if (metrics.length === 0) {
  console.error(`[eait] none of the expected metrics is offered; available: ${[...metricNames].join(", ")}`);
  metrics.push(...[...metricNames].slice(0, 8));
}

const has = (dim: string) => dimensionNames.has(dim);
const DIMENSIONS: string[][] = [];
// Two dimensions is the API's ceiling, and the API key is always one of them: a row that does not
// name its key cannot keep dev traffic out of the prod figures.
for (const split of ["model", "provider"]) {
  if (has(split)) DIMENSIONS.push(has("api_key_id") ? [split, "api_key_id"] : [split]);
}

async function query(dimensions: string[]): Promise<Record<string, unknown>[]> {
  const res = await api("/analytics/query", {
    method: "POST",
    body: JSON.stringify({ metrics, dimensions, granularity: "day", time_range, limit: 500 }),
  }) as { data?: { data?: Record<string, unknown>[]; metadata?: { truncated?: boolean } } };
  if (res.data?.metadata?.truncated) console.error("[eait] query hit its row limit — the totals are partial");
  return res.data?.data ?? [];
}

console.log(`openrouter analytics — last ${DAYS} days, by day and API key (metrics: ${metrics.join(", ")})`);
for (const dims of DIMENSIONS) {
  console.log(`\n## ${dims.join(" × ")}`);
  const rows = await query(dims);
  if (rows.length === 0) { console.log("  (no rows)"); continue; }
  for (const row of rows) console.log(JSON.stringify(row));
}

// The account's own activity feed — daily usage and spend per model endpoint, the same numbers
// the dashboard's activity page draws.
console.log("\n## user activity (GET /api/v1/activity)");
try {
  const activity = await api("/activity");
  console.log(JSON.stringify(activity));
} catch (e) {
  console.error(`[eait] activity read failed: ${(e as Error).message}`);
}
