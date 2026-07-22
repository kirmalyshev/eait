import { describe, expect, test } from "bun:test";
import { analyzeCorrection, analyzeMeal, classifyRestrictions, MealAnalysisSchema } from "./analyzer.ts";
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
    const out = await analyzeMeal(bytes, profile, provider);
    expect(out.isFood).toBe(true);
    expect(out.kcal).toBe(300);
    expect(out.items[0]!.name).toBe("rice");
    expect(out.verdicts.kidneys).toBe("warn");
  });

  test("injects the profile (goal + restriction tags) into the prompt", async () => {
    const provider = new FakeProvider(() => validJson);
    await analyzeMeal(bytes, profile, provider);
    const req = provider.lastRequest!;
    const blob = `${req.system}\n${req.userText}`.toLowerCase();
    expect(blob).toContain("lose");
    expect(blob).toContain("kidneys");
    expect(blob).toContain("ldl");
    // and it actually sends the image + asks for structured output
    expect(req.imageB64).toBeDefined();
    expect(req.jsonSchema).toBeDefined();
  });

  test("isFood=false passes through (valid, not an error)", async () => {
    const provider = new FakeProvider(() => JSON.stringify({ isFood: false }));
    const out = await analyzeMeal(bytes, profile, provider);
    expect(out.isFood).toBe(false);
    expect(out.kcal).toBe(0); // defaulted, not garbage
  });

  test("tolerant parse: strips code fences", async () => {
    const provider = new FakeProvider(() => "```json\n{\"isFood\":true,\"kcal\":420}\n```");
    const out = await analyzeMeal(bytes, profile, provider);
    expect(out.isFood).toBe(true);
    expect(out.kcal).toBe(420);
  });

  test("tolerant parse: pulls the outermost object out of surrounding prose", async () => {
    const provider = new FakeProvider(
      () => 'Sure! Here you go: {"isFood":true,"kcal":100} — hope that helps.',
    );
    const out = await analyzeMeal(bytes, profile, provider);
    expect(out.kcal).toBe(100);
  });

  test("non-JSON output throws (caller shows 'не смог разобрать', writes no row)", async () => {
    const provider = new FakeProvider(() => "I cannot help with that.");
    await expect(analyzeMeal(bytes, profile, provider)).rejects.toThrow();
  });

  test("zod rejects garbage that lacks isFood", async () => {
    const provider = new FakeProvider(() => JSON.stringify({ foo: 1, kcal: "lots" }));
    await expect(analyzeMeal(bytes, profile, provider)).rejects.toThrow();
  });

  test("zod rejects a non-boolean isFood", async () => {
    const provider = new FakeProvider(() => JSON.stringify({ isFood: "yes" }));
    await expect(analyzeMeal(bytes, profile, provider)).rejects.toThrow();
  });
});

describe("analyzeCorrection", () => {
  test("re-analyzes with the correction text + prior estimate, returns updated analysis", async () => {
    const prior: MealAnalysis = MealAnalysisSchema.parse(JSON.parse(validJson));
    const provider = new FakeProvider(() =>
      JSON.stringify({ isFood: true, kcal: 250, items: [{ name: "rice", grams: 150 }] }),
    );
    const out = await analyzeCorrection(prior, "на самом деле 150г риса", profile, provider);
    expect(out.kcal).toBe(250);
    const req = provider.lastRequest!;
    expect(req.userText.toLowerCase()).toContain("150");
    // prior estimate is provided as context (no image needed — images are ephemeral)
    expect(req.userText).toContain("300"); // prior kcal
    expect(req.imageB64).toBeUndefined();
  });
});

describe("MealAnalysisSchema", () => {
  test("defaults numeric fields so a minimal isFood object is valid", () => {
    const parsed = MealAnalysisSchema.parse({ isFood: false });
    expect(parsed.kcal).toBe(0);
    expect(parsed.items).toEqual([]);
    expect(parsed.verdicts).toEqual({});
  });
});

describe("output language", () => {
  test("the prompt names the user's language, so items and notes come back localized", async () => {
    for (const [lang, llmName] of [["ru", "Russian"], ["de", "German"], ["en", "English"]] as const) {
      const provider = new FakeProvider(() => validJson);
      await analyzeMeal(bytes, { ...profile, lang }, provider);
      expect(provider.lastRequest?.userText).toContain(llmName);
    }
  });

  test("the correction path inherits the language instruction", async () => {
    const provider = new FakeProvider(() => validJson);
    const prior = MealAnalysisSchema.parse(JSON.parse(validJson));
    await analyzeCorrection(prior, "no oil", { ...profile, lang: "de" }, provider);
    expect(provider.lastRequest?.userText).toContain("German");
  });

  test("numeric fields are explicitly excluded from localization", async () => {
    const provider = new FakeProvider(() => validJson);
    await analyzeMeal(bytes, { ...profile, lang: "de" }, provider);
    // guards against a model that "helpfully" returns "dreihundert" for kcal
    expect(provider.lastRequest?.userText).toMatch(/numeric/i);
  });
});

describe("estimation protocol", () => {
  test("prompt stages the estimate: items + cooking method, portions via scale references, then macros", async () => {
    const provider = new FakeProvider(() => validJson);
    await analyzeMeal(bytes, profile, provider);
    const text = provider.lastRequest!.userText.toLowerCase();
    expect(text).toContain("cooking method");
    expect(text).toContain("scale reference");
    expect(text).toContain("volume");
  });

  test("reasoning comes first in the wire schema so the model reasons before the numbers", async () => {
    const provider = new FakeProvider(() => validJson);
    await analyzeMeal(bytes, profile, provider);
    const schema = provider.lastRequest!.jsonSchema as { properties: Record<string, unknown> };
    expect(Object.keys(schema.properties)[0]).toBe("reasoning");
  });

  test("reasoning is scratch space: stripped from the parsed result, never persisted", async () => {
    const withReasoning = JSON.stringify({ ...JSON.parse(validJson), reasoning: "the plate is ~26cm" });
    const provider = new FakeProvider(() => withReasoning);
    const out = await analyzeMeal(bytes, profile, provider);
    expect("reasoning" in out).toBe(false);
  });

  test("confidence is constrained to high/medium/low", async () => {
    const provider = new FakeProvider(() => validJson);
    await analyzeMeal(bytes, profile, provider);
    expect(provider.lastRequest!.userText).toMatch(/high.{0,15}medium.{0,15}low/i);
  });

  test("the wire schema enum-constrains confidence, not just the prose", async () => {
    // The bot's low-confidence nudge exact-matches "low"; a free-string schema invites
    // "low (mixed dish)", which would silently fall through to the generic hint.
    const provider = new FakeProvider(() => validJson);
    await analyzeMeal(bytes, profile, provider);
    const schema = provider.lastRequest!.jsonSchema as { properties: Record<string, any> };
    expect(schema.properties.confidence.enum).toEqual(["high", "medium", "low"]);
  });

  test("prompt counteracts the systematic underestimation of mixed dishes", async () => {
    const provider = new FakeProvider(() => validJson);
    await analyzeMeal(bytes, profile, provider);
    expect(provider.lastRequest!.userText.toLowerCase()).toContain("underestimat");
  });

  test("the correction path inherits the estimation protocol", async () => {
    const provider = new FakeProvider(() => validJson);
    const prior = MealAnalysisSchema.parse(JSON.parse(validJson));
    await analyzeCorrection(prior, "no oil", profile, provider);
    expect(provider.lastRequest!.userText.toLowerCase()).toContain("cooking method");
  });
});

describe("meal context", () => {
  test("caption is injected verbatim when provided", async () => {
    const provider = new FakeProvider(() => validJson);
    await analyzeMeal(bytes, profile, provider, { caption: "две котлеты и гречка" });
    expect(provider.lastRequest!.userText).toContain("две котлеты и гречка");
  });

  test("local time is injected when provided", async () => {
    const provider = new FakeProvider(() => validJson);
    await analyzeMeal(bytes, profile, provider, { localTime: "08:30" });
    expect(provider.lastRequest!.userText).toContain("08:30");
  });

  test("no context → no caption or local-time lines in the prompt", async () => {
    const provider = new FakeProvider(() => validJson);
    await analyzeMeal(bytes, profile, provider);
    expect(provider.lastRequest!.userText).not.toMatch(/caption|local time/i);
  });

  test("an oversized caption is truncated before it reaches the model", async () => {
    const provider = new FakeProvider(() => validJson);
    await analyzeMeal(bytes, profile, provider, { caption: "start" + "x".repeat(5000) + "END" });
    expect(provider.lastRequest!.userText).toContain("start");
    expect(provider.lastRequest!.userText).not.toContain("END");
  });
});

describe("expert persona + cuisine prior", () => {
  // Persona measurably tightens macro estimates; a regional-cuisine prior steers identification
  // away from generic international staples (+87.5% ID in the GPT-4V origin-prompt study).
  test("the system prompt casts the model as an expert nutritionist", async () => {
    const provider = new FakeProvider(() => validJson);
    await analyzeMeal(bytes, profile, provider);
    expect(provider.lastRequest!.system.toLowerCase()).toContain("expert nutritionist");
  });

  test("a locale with a regional cuisine gets a hedged prior in the prompt", async () => {
    const provider = new FakeProvider(() => validJson);
    await analyzeMeal(bytes, { ...profile, lang: "ru" }, provider);
    const text = provider.lastRequest!.userText;
    expect(text).toMatch(/Eastern European|Russian.{0,40}home cooking/);
    expect(text).toMatch(/prior|likely|suggest/i); // a hint, never an assertion about the photo
  });

  test("a locale without a regional prior gets no cuisine line", async () => {
    const provider = new FakeProvider(() => validJson);
    await analyzeMeal(bytes, { ...profile, lang: "en" }, provider);
    // Match the line's fixed wording, so a null leaking into the template can't slip past.
    expect(provider.lastRequest!.userText).not.toMatch(/home cooking|interface language suggests/i);
  });

  test("the correction path inherits the cuisine prior", async () => {
    const provider = new FakeProvider(() => validJson);
    const prior = MealAnalysisSchema.parse(JSON.parse(validJson));
    await analyzeCorrection(prior, "no oil", { ...profile, lang: "de" }, provider);
    expect(provider.lastRequest!.userText).toMatch(/German|Central European/);
    expect(provider.lastRequest!.userText).toMatch(/home cooking/);
  });
});

describe("sampling temperature", () => {
  // Low temperature is the cheap form of self-consistency: same photo → same estimate,
  // instead of a 3-call median. All analyzer calls request it; the provider stays generic.
  test("meal analysis requests a low temperature", async () => {
    const provider = new FakeProvider(() => validJson);
    await analyzeMeal(bytes, profile, provider);
    expect(provider.lastRequest!.temperature).toBeDefined();
    expect(provider.lastRequest!.temperature!).toBeLessThanOrEqual(0.3);
  });

  test("correction and restriction classification inherit it", async () => {
    const provider = new FakeProvider(() => validJson);
    const prior = MealAnalysisSchema.parse(JSON.parse(validJson));
    await analyzeCorrection(prior, "no oil", profile, provider);
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
