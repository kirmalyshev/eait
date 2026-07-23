import { describe, expect, test, spyOn } from "bun:test";
import { analyzeMeal, classifyRestrictions, routeText, clampDayOffset, MealAnalysisSchema } from "./analyzer.ts";
import { LANGS, LOCALES } from "./i18n/registry.ts";
import type { ChatRequest, LLMProvider } from "./llm/provider.ts";
import type { MealAnalysis, Profile } from "./types.ts";

class FakeProvider implements LLMProvider {
  lastRequest?: ChatRequest;
  constructor(private responder: (req: ChatRequest) => string) {}
  async chat(req: ChatRequest): Promise<string> {
    this.lastRequest = req;
    return this.responder(req);
  }
}

const bytes = new Uint8Array([1, 2, 3, 4]);
const profile: Profile = {
  telegram_id: 1,
  lang: "ru",
  goal: "lose",
  restrictions: ["kidneys", "ldl"],
  reply_format: null,
};

const validJson = JSON.stringify({
  isFood: true,
  items: [{ name: "rice", grams: 200 }],
  kcal: 300,
  protein_g: 8,
  carbs_g: 60,
  fat_g: 2,
  satfat_g: 0.5,
  fiber_g: 1,
  sugar_g: 1,
  sodium_mg: 5,
  plant_protein_pct: 100,
  verdicts: { weight: "good", kidneys: "warn", ldl: "good" },
  confidence: "medium",
  notes: "ok",
});

describe("analyzeMeal", () => {
  test("returns a parsed, validated MealAnalysis", async () => {
    const provider = new FakeProvider(() => validJson);
    const out = await analyzeMeal([bytes], profile, provider);
    expect(out.isFood).toBe(true);
    expect(out.kcal).toBe(300);
    expect(out.items[0]!.name).toBe("rice");
    expect(out.verdicts.kidneys).toBe("warn");
  });

  test("injects the profile (goal + restriction tags) into the prompt", async () => {
    const provider = new FakeProvider(() => validJson);
    await analyzeMeal([bytes], profile, provider);
    const req = provider.lastRequest!;
    const blob = `${req.system}\n${req.userText}`.toLowerCase();
    expect(blob).toContain("lose");
    expect(blob).toContain("kidneys");
    expect(blob).toContain("ldl");
    // and it actually sends the image + asks for structured output
    expect(req.imagesB64?.length).toBe(1);
    expect(req.jsonSchema).toBeDefined();
  });

  test("isFood=false passes through (valid, not an error)", async () => {
    const provider = new FakeProvider(() => JSON.stringify({ isFood: false }));
    const out = await analyzeMeal([bytes], profile, provider);
    expect(out.isFood).toBe(false);
    expect(out.kcal).toBe(0); // defaulted, not garbage
  });

  test("tolerant parse: strips code fences", async () => {
    const provider = new FakeProvider(() => "```json\n{\"isFood\":true,\"kcal\":420}\n```");
    const out = await analyzeMeal([bytes], profile, provider);
    expect(out.isFood).toBe(true);
    expect(out.kcal).toBe(420);
  });

  test("tolerant parse: pulls the outermost object out of surrounding prose", async () => {
    const provider = new FakeProvider(
      () => 'Sure! Here you go: {"isFood":true,"kcal":100} — hope that helps.',
    );
    const out = await analyzeMeal([bytes], profile, provider);
    expect(out.kcal).toBe(100);
  });

  test("non-JSON output throws (caller shows 'не смог разобрать', writes no row)", async () => {
    const provider = new FakeProvider(() => "I cannot help with that.");
    await expect(analyzeMeal([bytes], profile, provider)).rejects.toThrow();
  });

  test("zod rejects garbage that lacks isFood", async () => {
    const provider = new FakeProvider(() => JSON.stringify({ foo: 1, kcal: "lots" }));
    await expect(analyzeMeal([bytes], profile, provider)).rejects.toThrow();
  });

  test("zod rejects a non-boolean isFood", async () => {
    const provider = new FakeProvider(() => JSON.stringify({ isFood: "yes" }));
    await expect(analyzeMeal([bytes], profile, provider)).rejects.toThrow();
  });
});

describe("correction via routeText", () => {
  test("re-routes with the correction text + focus meal, returns updated analysis, no image", async () => {
    const focusMeal: MealAnalysis = MealAnalysisSchema.parse(JSON.parse(validJson));
    const provider = new FakeProvider(() =>
      JSON.stringify({ intent: "correction", analysis: { isFood: true, kcal: 250, items: [{ name: "rice", grams: 150 }] } }),
    );
    const ctx = { focusMeal, todayMeals: [], weekTotals: [], targets: { kcal: 1800, protein_g: 100 } };
    const out = await routeText("на самом деле 150г риса", profile, ctx, provider);
    expect(out.intent).toBe("correction");
    if (out.intent === "correction") expect(out.analysis.kcal).toBe(250);
    const req = provider.lastRequest!;
    expect(req.userText.toLowerCase()).toContain("150");
    // prior estimate is provided as context (no image needed — images are ephemeral)
    expect(req.userText).toContain("300"); // focus meal kcal
    expect(req.imagesB64).toBeUndefined();
  });
});

describe("MealAnalysisSchema", () => {
  test("defaults numeric fields so a minimal isFood object is valid", () => {
    const parsed = MealAnalysisSchema.parse({ isFood: false });
    expect(parsed.kcal).toBe(0);
    expect(parsed.items).toEqual([]);
    expect(parsed.verdicts).toEqual({});
  });

  test("confidence is normalized at parse: trimmed + lowercased", () => {
    // The wire enum is advisory (strict:false), so " Low " and "Medium" do arrive. Normalizing
    // here means the bot and the stored row always see canonical casing.
    expect(MealAnalysisSchema.parse({ isFood: true, confidence: " Low " }).confidence).toBe("low");
    expect(MealAnalysisSchema.parse({ isFood: true, confidence: "Medium" }).confidence).toBe("medium");
    expect(MealAnalysisSchema.parse({ isFood: true }).confidence).toBe("unknown");
  });
});

describe("output language", () => {
  test("the prompt names the user's language, so items and notes come back localized", async () => {
    for (const [lang, llmName] of [["ru", "Russian"], ["de", "German"], ["en", "English"]] as const) {
      const provider = new FakeProvider(() => validJson);
      await analyzeMeal([bytes], { ...profile, lang }, provider);
      expect(provider.lastRequest?.userText).toContain(llmName);
    }
  });

  test("the router path inherits the language instruction", async () => {
    const provider = new FakeProvider(() => JSON.stringify({ intent: "question", answer: "ok" }));
    await routeText("no oil", { ...profile, lang: "de" }, { todayMeals: [], weekTotals: [], targets: { kcal: 1800, protein_g: 100 } }, provider);
    expect(provider.lastRequest?.userText).toContain("German");
  });

  test("numeric fields are explicitly excluded from localization", async () => {
    const provider = new FakeProvider(() => validJson);
    await analyzeMeal([bytes], { ...profile, lang: "de" }, provider);
    // guards against a model that "helpfully" returns "dreihundert" for kcal
    expect(provider.lastRequest?.userText).toMatch(/numeric/i);
  });
});

describe("estimation protocol", () => {
  test("prompt stages the estimate: items + cooking method, portions via scale references, then macros", async () => {
    const provider = new FakeProvider(() => validJson);
    await analyzeMeal([bytes], profile, provider);
    const text = provider.lastRequest!.userText.toLowerCase();
    expect(text).toContain("cooking method");
    expect(text).toContain("scale reference");
    expect(text).toContain("volume");
  });

  test("reasoning comes first in the wire schema so the model reasons before the numbers", async () => {
    const provider = new FakeProvider(() => validJson);
    await analyzeMeal([bytes], profile, provider);
    const schema = provider.lastRequest!.jsonSchema as { properties: Record<string, unknown> };
    expect(Object.keys(schema.properties)[0]).toBe("reasoning");
  });

  test("reasoning is scratch space: stripped from the parsed result, never persisted", async () => {
    const withReasoning = JSON.stringify({ ...JSON.parse(validJson), reasoning: "the plate is ~26cm" });
    const provider = new FakeProvider(() => withReasoning);
    const out = await analyzeMeal([bytes], profile, provider);
    expect("reasoning" in out).toBe(false);
  });

  test("confidence is constrained to high/medium/low", async () => {
    const provider = new FakeProvider(() => validJson);
    await analyzeMeal([bytes], profile, provider);
    expect(provider.lastRequest!.userText).toMatch(/high.{0,15}medium.{0,15}low/i);
  });

  test("the wire schema enum-constrains confidence, not just the prose", async () => {
    // The bot's low-confidence nudge exact-matches "low"; a free-string schema invites
    // "low (mixed dish)", which would silently fall through to the generic hint.
    const provider = new FakeProvider(() => validJson);
    await analyzeMeal([bytes], profile, provider);
    const schema = provider.lastRequest!.jsonSchema as { properties: Record<string, any> };
    expect(schema.properties.confidence.enum).toEqual(["high", "medium", "low"]);
  });

  test("prompt counteracts the systematic underestimation of mixed dishes", async () => {
    const provider = new FakeProvider(() => validJson);
    await analyzeMeal([bytes], profile, provider);
    expect(provider.lastRequest!.userText.toLowerCase()).toContain("underestimat");
  });

  test("the router path inherits the estimation protocol", async () => {
    const provider = new FakeProvider(() => JSON.stringify({ intent: "question", answer: "ok" }));
    await routeText("no oil", profile, { todayMeals: [], weekTotals: [], targets: { kcal: 1800, protein_g: 100 } }, provider);
    expect(provider.lastRequest!.userText.toLowerCase()).toContain("cooking method");
  });
});

describe("meal context", () => {
  test("caption is injected verbatim when provided", async () => {
    const provider = new FakeProvider(() => validJson);
    await analyzeMeal([bytes], profile, provider, { caption: "две котлеты и гречка" });
    expect(provider.lastRequest!.userText).toContain("две котлеты и гречка");
  });

  test("local time is injected when provided", async () => {
    const provider = new FakeProvider(() => validJson);
    await analyzeMeal([bytes], profile, provider, { localTime: "08:30" });
    expect(provider.lastRequest!.userText).toContain("08:30");
  });

  test("no context → no caption or local-time lines in the prompt", async () => {
    const provider = new FakeProvider(() => validJson);
    await analyzeMeal([bytes], profile, provider);
    expect(provider.lastRequest!.userText).not.toMatch(/caption|local time/i);
  });

  test("an oversized caption is truncated before it reaches the model", async () => {
    const provider = new FakeProvider(() => validJson);
    await analyzeMeal([bytes], profile, provider, { caption: "start" + "x".repeat(5000) + "END" });
    expect(provider.lastRequest!.userText).toContain("start");
    expect(provider.lastRequest!.userText).not.toContain("END");
  });
});

describe("expert persona + cuisine prior", () => {
  // Persona measurably tightens macro estimates; a regional-cuisine prior steers identification
  // away from generic international staples (+87.5% ID in the GPT-4V origin-prompt study).
  test("the system prompt casts the model as an expert nutritionist", async () => {
    const provider = new FakeProvider(() => validJson);
    await analyzeMeal([bytes], profile, provider);
    expect(provider.lastRequest!.system.toLowerCase()).toContain("expert nutritionist");
  });

  // Registry-driven, so a future locale's cuisineHint (or its absence) is covered the moment
  // it is registered — no per-locale literal patterns to keep in sync.
  test.each(LANGS)("cuisine prior tracks the registry for %s", async (lang) => {
    const provider = new FakeProvider(() => validJson);
    await analyzeMeal([bytes], { ...profile, lang }, provider);
    const text = provider.lastRequest!.userText;
    const hint = LOCALES[lang].cuisineHint;
    if (hint) {
      expect(text).toContain(hint); // verbatim — a null leaking into the template can't pass
      // The hedge is the safety property: the prior must never outrank what is actually shown.
      expect(text).toMatch(/always trust the actual evidence/);
    } else {
      expect(text).not.toMatch(/interface language suggests/i);
    }
  });

  test("the router path inherits the cuisine prior", async () => {
    const provider = new FakeProvider(() => JSON.stringify({ intent: "question", answer: "ok" }));
    await routeText("no oil", { ...profile, lang: "de" }, { todayMeals: [], weekTotals: [], targets: { kcal: 1800, protein_g: 100 } }, provider);
    // The verbatim hint, not /German|.../: the output-language line always contains "German",
    // so a looser pattern would pass even with the cuisine line deleted.
    expect(provider.lastRequest!.userText).toContain(LOCALES.de.cuisineHint);
  });
});

describe("sampling temperature", () => {
  // Low temperature is the cheap form of self-consistency: same photo → same estimate,
  // instead of a 3-call median. All analyzer calls request it; the provider stays generic.
  test("meal analysis requests a low temperature", async () => {
    const provider = new FakeProvider(() => validJson);
    await analyzeMeal([bytes], profile, provider);
    expect(provider.lastRequest!.temperature).toBeDefined();
    expect(provider.lastRequest!.temperature!).toBeLessThanOrEqual(0.3);
  });

  test("router and restriction classification inherit it", async () => {
    const provider = new FakeProvider(() => JSON.stringify({ intent: "question", answer: "ok" }));
    await routeText("no oil", profile, { todayMeals: [], weekTotals: [], targets: { kcal: 1800, protein_g: 100 } }, provider);
    expect(provider.lastRequest!.temperature!).toBeLessThanOrEqual(0.3);

    const classifier = new FakeProvider(() => JSON.stringify({ tags: [] }));
    await classifyRestrictions("kidneys", classifier, "en");
    expect(classifier.lastRequest!.temperature!).toBeLessThanOrEqual(0.3);
  });
});

describe("classifyRestrictions", () => {
  const tags = (v: string[]) => JSON.stringify({ tags: v });

  test("maps free text in any language onto the known tag vocabulary", async () => {
    const provider = new FakeProvider(() => tags(["kidneys", "lowsugar"]));
    const out = await classifyRestrictions("Nieren, kein Zucker", provider, "de");
    expect(out).toEqual(["kidneys", "lowsugar"]);
  });

  test("drops tags outside the vocabulary the rest of the app understands", async () => {
    // targetsFor and the analyzer prompt only know these four; an invented dimension
    // would be stored but never acted on, which is worse than dropping it.
    const provider = new FakeProvider(() => tags(["kidneys", "gluten", "astrology"]));
    expect(await classifyRestrictions("...", provider, "en")).toEqual(["kidneys"]);
  });

  test("returns an empty list rather than throwing when the model returns junk", async () => {
    const provider = new FakeProvider(() => "not json at all");
    expect(await classifyRestrictions("...", provider, "en")).toEqual([]);
  });

  test("returns an empty list when the provider itself fails", async () => {
    const provider: LLMProvider = { chat: async () => { throw new Error("network"); } };
    expect(await classifyRestrictions("...", provider, "en")).toEqual([]);
  });

  test("truncates long input before it reaches the model", async () => {
    const provider = new FakeProvider(() => tags([]));
    await classifyRestrictions("x".repeat(5000), provider, "en");
    expect(provider.lastRequest!.userText.length).toBeLessThan(600);
  });

  test("passes the user's locale as a hint without asserting the input is in it", async () => {
    const provider = new FakeProvider(() => tags([]));
    await classifyRestrictions("...", provider, "de");
    expect(provider.lastRequest?.userText).toContain("German");
    expect(provider.lastRequest?.userText).toMatch(/may be|might be|likely/i);
  });
});

describe("analyzeMeal — multi-image (albums)", () => {
  test("two images are both sent and the multi-photo instruction is added", async () => {
    const provider = new FakeProvider(() => validJson);
    await analyzeMeal([bytes, new Uint8Array([9, 9])], profile, provider);
    const req = provider.lastRequest!;
    expect(req.imagesB64?.length).toBe(2);
    expect(req.userText).toContain("SAME meal");
  });

  test("a single image gets no multi-photo instruction", async () => {
    const provider = new FakeProvider(() => validJson);
    await analyzeMeal([bytes], profile, provider);
    const req = provider.lastRequest!;
    expect(req.imagesB64?.length).toBe(1);
    expect(req.userText).not.toContain("SAME meal");
  });
});

describe("routeText", () => {
  const routeCtx = {
    todayMeals: [{ items: [{ name: "pasta", grams: 120 }], kcal: 640, protein_g: 28 }],
    weekTotals: [{ date: "2026-07-21", kcal: 1800, protein_g: 90 }],
    targets: { kcal: 1800, protein_g: 100 },
    localTime: "18:30",
  };

  test("question intent returns the answer and sends diary context in the prompt", async () => {
    const provider = new FakeProvider(() => JSON.stringify({ intent: "question", answer: "You ate 640 kcal today" }));
    const r = await routeText("how am I doing?", profile, routeCtx, provider);
    expect(r.intent).toBe("question");
    if (r.intent === "question") expect(r.answer).toContain("640");
    const seen = provider.lastRequest!.userText;
    expect(seen).toContain("pasta");
    expect(seen).toContain("18:30");
    expect(seen).toContain("how am I doing?");
  });

  test("meal intent parses a full MealAnalysis", async () => {
    const provider = new FakeProvider(() => JSON.stringify({ intent: "meal", analysis: JSON.parse(validJson) }));
    const r = await routeText("ate 2 eggs and toast", profile, routeCtx, provider);
    expect(r.intent).toBe("meal");
    if (r.intent === "meal") expect(r.analysis.kcal).toBe(300);
  });

  test("correction intent passes through when a focus meal is present", async () => {
    const provider = new FakeProvider(() => JSON.stringify({ intent: "correction", analysis: JSON.parse(validJson) }));
    const focusMeal = { ...JSON.parse(validJson), kcal: 999 };
    const r = await routeText("actually 300 kcal", profile, { ...routeCtx, focusMeal }, provider);
    expect(r.intent).toBe("correction");
    expect(provider.lastRequest!.userText).toContain("focus meal");
  });

  test("correction without focus meal degrades to question when an answer is present, else throws", async () => {
    const withAnswer = new FakeProvider(() => JSON.stringify({ intent: "correction", answer: "did you mean?" }));
    const r = await routeText("x", profile, routeCtx, withAnswer);
    expect(r.intent).toBe("question");
    const without = new FakeProvider(() => JSON.stringify({ intent: "correction" }));
    await expect(routeText("x", profile, routeCtx, without)).rejects.toThrow();
  });

  test("meal intent with isFood=false throws", async () => {
    const provider = new FakeProvider(() =>
      JSON.stringify({ intent: "meal", analysis: { ...JSON.parse(validJson), isFood: false } }));
    await expect(routeText("nothing edible", profile, routeCtx, provider)).rejects.toThrow();
  });

  test("question without an answer throws; user text is capped", async () => {
    const provider = new FakeProvider(() => JSON.stringify({ intent: "question", answer: "" }));
    await expect(routeText("y", profile, routeCtx, provider)).rejects.toThrow();
    const ok = new FakeProvider(() => JSON.stringify({ intent: "question", answer: "hi" }));
    await routeText("z".repeat(5000), profile, routeCtx, ok);
    expect(ok.lastRequest!.userText.length).toBeLessThan(4000);
  });
});

describe("routeText — review hardening", () => {
  const minCtx = { todayMeals: [], weekTotals: [], targets: { kcal: 1800, protein_g: 100 } };

  test("correction intent with isFood=false throws (would render a non-food meal card)", async () => {
    const focusMeal = MealAnalysisSchema.parse(JSON.parse(validJson));
    const provider = new FakeProvider(() =>
      JSON.stringify({ intent: "correction", analysis: { ...JSON.parse(validJson), isFood: false } }));
    await expect(routeText("that was my keys, not food", profile, { ...minCtx, focusMeal }, provider)).rejects.toThrow();
  });

  test("meal intent without an analysis object throws", async () => {
    const provider = new FakeProvider(() => JSON.stringify({ intent: "meal" }));
    await expect(routeText("ate rice", profile, minCtx, provider)).rejects.toThrow();
  });
});

describe("clampDayOffset", () => {
  test("maps every input to an integer in [0, 7]", () => {
    expect(clampDayOffset(0)).toBe(0);
    expect(clampDayOffset(1)).toBe(1);
    expect(clampDayOffset(7)).toBe(7);
    expect(clampDayOffset(8)).toBe(7); // older than the window → clamp to the edge
    expect(clampDayOffset(100)).toBe(7);
    expect(clampDayOffset(-1)).toBe(0); // future → today
    expect(clampDayOffset(3.7)).toBe(3); // truncated to a whole day
    expect(clampDayOffset(NaN)).toBe(0);
    expect(clampDayOffset(Infinity)).toBe(0);
    expect(clampDayOffset(undefined)).toBe(0);
    expect(clampDayOffset("2")).toBe(0); // non-number → default, never trust a string
  });
});

describe("routeText — meal date offset", () => {
  const minCtx = { todayMeals: [], weekTotals: [], targets: { kcal: 1800, protein_g: 100 } };

  test("meal intent carries a normalized dayOffset from the model", async () => {
    const provider = new FakeProvider(() =>
      JSON.stringify({ intent: "meal", dayOffset: 1, analysis: JSON.parse(validJson) }));
    const r = await routeText("add on yesterday 2 beers", profile, minCtx, provider);
    expect(r.intent).toBe("meal");
    if (r.intent === "meal") expect(r.dayOffset).toBe(1);
  });

  test("a meal with no dayOffset defaults to 0 (today) and does NOT warn", async () => {
    const provider = new FakeProvider(() => JSON.stringify({ intent: "meal", analysis: JSON.parse(validJson) }));
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    try {
      const r = await routeText("ate 2 eggs", profile, minCtx, provider);
      if (r.intent === "meal") expect(r.dayOffset).toBe(0);
      // The common case (no offset) must be silent — an absent field is in-contract, not drift.
      // Pins the `r.dayOffset !== undefined` half of the warn guard (else every plain meal spams).
      expect(warn.mock.calls.some((c) => String(c[0]).includes("out of contract"))).toBe(false);
    } finally {
      warn.mockRestore();
    }
  });

  test("an out-of-range model dayOffset is clamped, not trusted, and warned", async () => {
    const provider = new FakeProvider(() =>
      JSON.stringify({ intent: "meal", dayOffset: 99, analysis: JSON.parse(validJson) }));
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    try {
      const r = await routeText("ages ago", profile, minCtx, provider);
      if (r.intent === "meal") expect(r.dayOffset).toBe(7);
      // Doctrine: model drift is surfaced, never silently normalized.
      expect(warn.mock.calls.some((c) => String(c[0]).includes("out of contract"))).toBe(true);
    } finally {
      warn.mockRestore();
    }
  });

  test("an in-contract dayOffset does not warn (no false operator noise)", async () => {
    const provider = new FakeProvider(() =>
      JSON.stringify({ intent: "meal", dayOffset: 2, analysis: JSON.parse(validJson) }));
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    try {
      await routeText("day before yesterday", profile, minCtx, provider);
      expect(warn.mock.calls.some((c) => String(c[0]).includes("out of contract"))).toBe(false);
    } finally {
      warn.mockRestore();
    }
  });

  test("a non-number dayOffset (null / string) degrades to 0 + warn, never discards the meal", async () => {
    // z.number() would REJECT these and throw away a valid analysis; z.unknown() + clamp keeps it.
    for (const bad of [null, "1", "yesterday"]) {
      const provider = new FakeProvider(() =>
        JSON.stringify({ intent: "meal", dayOffset: bad, analysis: JSON.parse(validJson) }));
      const warn = spyOn(console, "warn").mockImplementation(() => {});
      try {
        const r = await routeText("ate rice", profile, minCtx, provider);
        expect(r.intent).toBe("meal"); // meal survived
        if (r.intent === "meal") expect(r.dayOffset).toBe(0); // non-number → today
        expect(warn.mock.calls.some((c) => String(c[0]).includes("out of contract"))).toBe(true);
      } finally {
        warn.mockRestore();
      }
    }
  });

  test("a correction ignores any model-supplied dayOffset (no leak, no date shift)", async () => {
    const focusMeal = MealAnalysisSchema.parse(JSON.parse(validJson));
    const provider = new FakeProvider(() =>
      JSON.stringify({ intent: "correction", dayOffset: 3, analysis: JSON.parse(validJson) }));
    const r = await routeText("actually 300", profile, { ...minCtx, focusMeal }, provider);
    expect(r.intent).toBe("correction");
    expect(r as Record<string, unknown>).not.toHaveProperty("dayOffset");
  });
});
