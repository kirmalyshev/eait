// The transport, exercised without a billed call.
//
// These tests exist because of a defect the demo analyzer hid completely: against a real model,
// EVERY chat message describing food came back as an empty bubble. The router answered
// `intent: "meal"` with no `analysis`, and the switch in `routeText` silently degraded that to
// `{ intent: "answer", text: "" }`. Nothing threw, nothing logged, and the user typed what they ate
// and got a blank reply.

import { describe, expect, test } from "bun:test";
import { openRouterPorts } from "./openrouter.ts";

/** A fetch that replays the given assistant payloads, one per call, and records the requests. */
function fakeFetch(payloads: unknown[]) {
  const bodies: Record<string, unknown>[] = [];
  const impl = (async (_url: string, init: RequestInit) => {
    bodies.push(JSON.parse(String(init.body)) as Record<string, unknown>);
    const payload = payloads[Math.min(bodies.length - 1, payloads.length - 1)];
    return new Response(
      JSON.stringify({ choices: [{ message: { content: JSON.stringify(payload) } }] }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as unknown as typeof fetch;
  return { impl, bodies };
}

function ports(payloads: unknown[]) {
  const { impl, bodies } = fakeFetch(payloads);
  return {
    llm: openRouterPorts({
      apiKey: "test-key-not-a-secret", model: "test-model",
      baseUrl: "https://example.invalid/v1/chat/completions", timeoutMs: 5000, fetchImpl: impl,
    }),
    bodies,
  };
}

const ROUTE_INPUT = {
  text: "two boiled eggs and a slice of rye bread",
  profile: { user_id: "u1", lang: "en", goal: "lose", sex: "male", birth_year: 1990,
    height_cm: 183, weight_kg: 93, target_weight_kg: 88, activity: "moderate", pace: "steady",
    country: "de", restrictions: [], medical_limitations: null, food_allergies: null,
    product_limitations: null, onboarded_at: "2026-01-01T00:00:00.000Z" },
  targets: { kcal: 2393, protein_g: 141, fat_g: 80, carbs_g: 250 },
  todayMeals: [],
  week: { kcal: 0, protein_g: 0 },
} as unknown as Parameters<ReturnType<typeof openRouterPorts>["routeText"]>[0];

const ANALYSIS = {
  isFood: true,
  items: [{ name: "Boiled eggs", name_en: "boiled eggs", grams: 100, kcal: 155,
    protein_g: 13, carbs_g: 1.1, fat_g: 11, kcal_per_100g: 155 }],
  kcal: 155, protein_g: 13, carbs_g: 1.1, fat_g: 11, satfat_g: 3.3, fiber_g: 0,
  sugar_g: 1.1, sodium_mg: 124, confidence: "medium", notes: "",
};

describe("routeText", () => {
  test("a food message is routed to a meal", async () => {
    const { llm } = ports([{ intent: "meal", analysis: ANALYSIS, dayOffset: 0 }]);
    const out = await llm.routeText(ROUTE_INPUT);
    expect(out.intent).toBe("meal");
  });

  test("a question is answered", async () => {
    const { llm } = ports([{ intent: "answer", text: "You have had 0 g of protein." }]);
    const out = await llm.routeText(ROUTE_INPUT);
    expect(out).toEqual({ intent: "answer", text: "You have had 0 g of protein." });
  });

  // The defect. `intent: "meal"` with no analysis is a malformed reply, not an answer.
  test("`meal` without an analysis is retried, not silently turned into an empty answer", async () => {
    const { llm, bodies } = ports([
      { intent: "meal", dayOffset: 0 },                        // malformed
      { intent: "meal", analysis: ANALYSIS, dayOffset: 0 },    // the retry gets it right
    ]);
    const out = await llm.routeText(ROUTE_INPUT);

    expect(bodies.length).toBe(2);
    expect(out.intent).toBe("meal");
  });

  test("a reply that stays malformed throws rather than answering with nothing", async () => {
    // `handleText` turns a throw into `analysis-failed`, which the app renders as a real message.
    // An empty string renders as an empty bubble, which tells the user their food was understood.
    const { llm } = ports([{ intent: "meal", dayOffset: 0 }]);
    await expect(llm.routeText(ROUTE_INPUT)).rejects.toThrow();
  });

  test("an unactionable intent degrades to the answer the model did supply", async () => {
    // `redate` with no focus meal cannot be done here. Degrading is right when there is something
    // to say.
    const { llm } = ports([{ intent: "redate", dayOffset: 1, text: "Which meal did you mean?" }]);
    const out = await llm.routeText(ROUTE_INPUT);
    expect(out).toEqual({ intent: "answer", text: "Which meal did you mean?" });
  });

  test("no branch may resolve to an empty answer", async () => {
    // The invariant that makes the blank bubble impossible. This transport owns HTTP and nothing
    // else, so it does not invent a sentence to fill the gap — it refuses, and `handleText` turns
    // that into `analysis-failed`, which the app renders as a real message.
    const { llm } = ports([{ intent: "redate", dayOffset: 1 }]);
    await expect(llm.routeText(ROUTE_INPUT)).rejects.toThrow(/empty/i);
  });
});
