import { describe, expect, test } from "bun:test";
import { analyzeCorrection, analyzeMeal, MealAnalysisSchema } from "./analyzer.ts";
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
