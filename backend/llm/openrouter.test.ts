// The transport, exercised without a billed call.
//
// These tests exist because of a defect the demo analyzer hid completely: against a real model,
// EVERY chat message describing food came back as an empty bubble. The router answered
// `intent: "meal"` with no `analysis`, and the switch in `routeText` silently degraded that to
// `{ intent: "answer", text: "" }`. Nothing threw, nothing logged, and the user typed what they ate
// and got a blank reply.

import { describe, expect, test } from "bun:test";
import { openRouterPorts } from "./openrouter.ts";
import { GatewayRefusal } from "./port.ts";

/** A payload the provider stopped at the completion bound. `partial` is what it had written. */
const truncated = (partial: string) => ({ __finish_reason: "length", __raw: partial });

/** Stopped at the bound, but the cut landed after the last brace — the object is whole. */
const cutAfterTheBrace = (payload: unknown) =>
  ({ __finish_reason: "length", __raw: JSON.stringify(payload) + "\n" });

/** A fetch that replays the given assistant payloads, one per call, and records the requests. */
function fakeFetch(payloads: unknown[]) {
  const bodies: Record<string, unknown>[] = [];
  const impl = (async (_url: string, init: RequestInit) => {
    bodies.push(JSON.parse(String(init.body)) as Record<string, unknown>);
    const payload = payloads[Math.min(bodies.length - 1, payloads.length - 1)];
    const cut = payload as { __finish_reason?: string; __raw?: string };
    const choice = cut?.__finish_reason
      ? { finish_reason: cut.__finish_reason, message: { content: cut.__raw } }
      : { finish_reason: "stop", message: { content: JSON.stringify(payload) } };
    return new Response(
      JSON.stringify({ choices: [choice] }),
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
      baseUrl: "https://example.invalid/v1/chat/completions", timeoutMs: 5000, maxTokens: 4321,
      fetchImpl: impl,
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

  test("a router that supplies the analysis costs exactly one call", async () => {
    const { llm, bodies } = ports([{ intent: "meal", analysis: ANALYSIS, dayOffset: 0 }]);
    await llm.routeText(ROUTE_INPUT);
    expect(bodies.length).toBe(1);
  });

  // The defect, and the fix. grok-4.5 picks `intent: "meal"` and omits the analysis EVERY time —
  // the routing prompt says "same rules as a photo" and those rules are only in the PHOTO prompt.
  // Feeding the validation error back on a retry does not help. A focused second call does.
  test("a router that omits the analysis gets it from a focused second call", async () => {
    const { llm, bodies } = ports([
      { intent: "meal", dayOffset: 0 },   // the router decides, and does not do the work
      ANALYSIS,                            // the focused call does
    ]);
    const out = await llm.routeText(ROUTE_INPUT);

    expect(out.intent).toBe("meal");
    expect(out).toHaveProperty("analysis.kcal", 155);
    // The second call asks for the ANALYSIS schema, not the route schema. That is the whole point.
    expect(bodies.length).toBe(2);
    expect((bodies[1] as { response_format: { json_schema: { name: string } } })
      .response_format.json_schema.name).toBe("text-meal");
  });

  test("a focused analysis that also fails throws rather than answering with nothing", async () => {
    // `handleText` turns a throw into `analysis-failed`, which the app renders as a real message.
    // An empty string renders as an empty bubble, which tells the user their food was understood.
    const { llm } = ports([{ intent: "meal", dayOffset: 0 }, { nope: true }]);
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

// A request that names no completion bound is not an unbounded request — the provider substitutes
// the model's own ceiling, and OpenRouter reserves the whole of it against the balance before it
// will route the call. On 2026-08-26 that is what refused the first real user's first photo:
// "You requested up to 65536 tokens, but can only afford 34361" (HTTP 402), on a request whose
// measured completion was 1614 tokens. Nothing was analyzed, and the account's one free sample was
// already charged. The bound belongs on every call the loop makes, not only the first: the body is
// rebuilt each attempt, and a bound moved out of that literal would be lost on the retry alone.
describe("completion bound", () => {
  test("every call names its own completion bound", async () => {
    const { llm, bodies } = ports([{ intent: "answer", text: "ok" }]);
    await llm.routeText(ROUTE_INPUT);
    expect(bodies[0]).toHaveProperty("max_tokens", 4321);
  });

  test("the schema retry carries it too", async () => {
    // First reply fails the schema, so `complete` retries. Both bodies must be bounded.
    const { llm, bodies } = ports([{ nope: true }, { intent: "answer", text: "ok" }]);
    await llm.routeText(ROUTE_INPUT);
    expect(bodies.length).toBe(2);
    for (const b of bodies) expect(b).toHaveProperty("max_tokens", 4321);
  });
});

// The bound's own failure mode, and the one retry not worth paying for.
//
// A completion cut off at `max_tokens` comes back as HTTP 200 with `finish_reason: "length"` and a
// half-written object. Parsed as a schema miss it would be retried with a LONGER prompt, the same
// bound and no instruction to be shorter — a second billed call generating another full bound's
// worth of tokens, ending in `llm did not satisfy …: not valid JSON`. That message sends the next
// reader to the model or the schema. The bound is the actual cause and the log has to say so,
// because by then the user's analysis has already been charged.
describe("truncation at the bound", () => {
  test("a completion cut off at the bound says so, naming the setting", async () => {
    const { llm } = ports([truncated('{"intent":"answer","text":"You have had 0 g of pro')]);
    await expect(llm.routeText(ROUTE_INPUT)).rejects.toThrow(/truncated.*EAIT__BACKEND__LLM_MAX_TOKENS/s);
  });

  // The other direction, and the reason the check cannot come before the parse. `length` says
  // generation stopped at the bound, not that the object is unusable: with a JSON schema the model
  // emits its closing brace and a trailing newline, and a cut in that whitespace leaves a complete
  // answer flagged as truncated. A gateway behind EAIT__BACKEND__LLM_BASE_URL may flag
  // conservatively too. Refusing a reply that parses and validates would fail the analysis — and
  // the analysis is charged before the call — over trailing whitespace.
  test("an answer that is whole is returned, whatever the bound flag says", async () => {
    const { llm, bodies } = ports([cutAfterTheBrace({ intent: "answer", text: "You have had 0 g of protein." })]);
    const out = await llm.routeText(ROUTE_INPUT);
    expect(out).toEqual({ intent: "answer", text: "You have had 0 g of protein." });
    expect(bodies.length).toBe(1);
  });

  // The other unusable shape, and the one a mutation test found unpinned: a reply cut where the
  // object happens to close, so it PARSES and then misses the schema. Without the second check it
  // falls through to `lastError` and buys another bound's worth of tokens to end in
  // "did not satisfy", which is the message this whole guard exists to stop producing.
  test("a truncated reply that parses but misses the schema is terminal too", async () => {
    const { llm, bodies } = ports([{ __finish_reason: "length", __raw: '{"nope":true}' }]);
    await expect(llm.routeText(ROUTE_INPUT)).rejects.toThrow(/truncated.*EAIT__BACKEND__LLM_MAX_TOKENS/s);
    expect(bodies.length).toBe(1);
  });

  test("it does not spend a second call retrying into the same bound", async () => {
    const { llm, bodies } = ports([truncated('{"intent":"answ')]);
    await expect(llm.routeText(ROUTE_INPUT)).rejects.toThrow();
    expect(bodies.length).toBe(1);
  });
});

describe("a non-200 from the gateway", () => {
  /** A gateway that answers one status and routes nothing. */
  const refusing = (status: number) => openRouterPorts({
    apiKey: "test-key-not-a-secret", model: "test-model",
    baseUrl: "https://example.invalid/v1/chat/completions", timeoutMs: 5000, maxTokens: 4321,
    fetchImpl: (async () => new Response('{"error":{"message":"nope"}}', { status })) as unknown as typeof fetch,
  });

  const thrown = async (status: number) =>
    await refusing(status).routeText(ROUTE_INPUT).then(() => null, (e: unknown) => e);

  // The status is the whole decision about whether the account keeps its lifetime analysis, so it
  // is asserted per code rather than read out of a message. A 402 is what bricked the first real
  // user: charged for a call OpenRouter refused before any model saw it (issue #32).
  test.each([401, 402, 429, 503])("%i never reached a model, so it was billed nothing", async (status) => {
    const err = await thrown(status);
    expect(err).toBeInstanceOf(GatewayRefusal);
    expect((err as GatewayRefusal).status).toBe(status);
    expect((err as Error).message).toContain(`llm http ${status}`);
  });

  // Charging on ambiguity is the safe direction: the alternative gives back calls we paid for.
  test.each([400, 408, 500, 502])("%i may name a model that already ran, and stays charged", async (status) => {
    const err = await thrown(status);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(GatewayRefusal);
  });

  /** A gateway that answers one completion and then refuses everything after it. */
  const thenRefusing = (first: unknown, status: number) => {
    let n = 0;
    return openRouterPorts({
      apiKey: "test-key-not-a-secret", model: "test-model",
      baseUrl: "https://example.invalid/v1/chat/completions", timeoutMs: 5000, maxTokens: 4321,
      fetchImpl: (async () => (n++ === 0
        ? new Response(
            JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(first) } }] }),
            { status: 200, headers: { "content-type": "application/json" } })
        : new Response('{"error":{"message":"nope"}}', { status }))) as unknown as typeof fetch,
    });
  };

  // ONE charged analysis pays for as many calls as this transport makes, and the status is only
  // half the question: a 402 on the SECOND call refuses a request whose first call already
  // generated tokens and was billed. Refunding that gives back a call this instance paid for —
  // the expensive direction of issue #32's fix, and the one no status code can distinguish.
  test("a refusal on the focused second call stays charged: the router call was billed", async () => {
    const err = await thenRefusing({ intent: "meal", dayOffset: 0 }, 402)
      .routeText(ROUTE_INPUT).then(() => null, (e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(GatewayRefusal);
  });

  test("a refusal on the schema retry stays charged: the reply it retries was billed", async () => {
    const err = await thenRefusing({ nope: true }, 429)
      .routeText(ROUTE_INPUT).then(() => null, (e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(GatewayRefusal);
  });
});
