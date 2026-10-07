// #119 "A change, named": after a meal edit lands — typed in the meal's conversation, set on the
// keypad, or produced by a re-read — the thread gets ONE computed line, Gabie's, naming the change
// and what the verdicts did: "Rice 150 → 200g: 540 → 605kcal. Both still high for one meal."
// The words are MEAL_COPY's `change*` templates; the numbers and verdicts are computed here, never
// the model's.

import { beforeEach, describe, expect, it } from "bun:test";
import { explainTargets, type MealItem, type MealRecord } from "@eait/shared";
import { configDefaults, type Config } from "../config.ts";
import { demoPorts } from "../llm/demo.ts";
import type { AnalyzedMeal, LlmPorts } from "../llm/port.ts";
import { memoryStore } from "../store.memory.ts";
import type { Store } from "../store.ts";
import { fakePush } from "../push/fake.ts";
import { changeLine, chatHistory, editMeal, handleText, logPhotoMeal, patchProfile, reanalyzeMeal, type EngineDeps } from "./index.ts";

const CONFIG: Config = {
  ...configDefaults(),
  port: 0, databaseUrl: "memory://test",
  llmProvider: "demo", llmModel: "demo", llmApiKey: "unused",
  freeAnalyses: 100, globalDailyAnalysisCap: 10,
  appleAudiences: ["com.eait.fit.ios"], googleAudiences: ["test.apps.googleusercontent.com"],
};
let store: Store;
let deps: EngineDeps;
function makeDeps(over: Partial<Config> = {}, llm: LlmPorts = demoPorts()): EngineDeps {
  return { store, config: { ...CONFIG, ...over }, llm, push: fakePush() };
}
async function onboard(over: Record<string, unknown> = {}): Promise<string> {
  const { userId } = await store.upsertDeviceUser(crypto.randomUUID() + crypto.randomUUID(), "en");
  await store.addIdentity(userId, "google", "g-" + userId.slice(0, 8));
  const out = await patchProfile(deps, userId, {
    goal: "lose", sex: "female", birth_year: 1990, height_cm: 165, weight_kg: 70,
    target_weight_kg: 65, activity: "some", pace: "steady", country: "de",
    restrictions: [], complete_onboarding: true, ...over,
  });
  if (!out || !out.ok) throw new Error(`onboarding failed: ${JSON.stringify(out)}`);
  return userId;
}
const jpeg = () => { const b = new Uint8Array(10).fill(1); b[0] = 0xff; b[1] = 0xd8; return b; };
const photo = () => ({ images: [async () => jpeg()] });
const thread = async (userId: string) => (await chatHistory(deps, userId, {})).entries;
const text = (e: { kind: string }) => ("text" in e ? (e as { text: string | null }).text : null) ?? "";

beforeEach(() => {
  store = memoryStore();
  deps = makeDeps();
});

const rice = (grams: number, kcal: number): MealItem => ({ name: "rice", name_en: "rice", grams, kcal });
const salmon = (grams: number, kcal: number): MealItem => ({ name: "salmon", name_en: "salmon", grams, kcal });

/** A stored-row fixture. Only what the composer reads needs to be true. */
const meal = (over: Partial<MealRecord>): MealRecord => ({
  isFood: true, items: [], kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0,
  satfat_g: 0, fiber_g: 0, sugar_g: 0, sodium_mg: 0,
  verdicts: {}, confidence: "high", notes: "",
  id: "m1", user_id: "u", ts: "2026-09-27T12:00:00Z", date: "2026-09-27",
  corrected: false, model: null, ...over,
  healthScore: over.healthScore ?? null,
});
const EN = { lang: "en" as const, restrictions: [] as string[] };

describe("the composed words", () => {
  it("is the board's line, verbatim: the item, the grams and the kcal, then the verdicts that stayed high", () => {
    const before = meal({ items: [rice(150, 195), salmon(140, 345)], kcal: 540, verdicts: { weight: "warn", ldl: "warn" } });
    const after = meal({ items: [rice(200, 260), salmon(140, 345)], kcal: 605, verdicts: { weight: "warn", ldl: "warn" } });
    expect(changeLine(before, after, { lang: "en", restrictions: ["ldl"] }))
      .toBe("Rice 150 → 200g: 540 → 605kcal. Both still high for one meal.");
  });

  it("names one still-high dimension instead of 'Both'", () => {
    const before = meal({ items: [rice(150, 195)], kcal: 540, verdicts: { weight: "warn" } });
    const after = meal({ items: [rice(200, 260)], kcal: 605, verdicts: { weight: "warn" } });
    expect(changeLine(before, after, EN)).toBe("Rice 150 → 200g: 540 → 605kcal. Calories still high for one meal.");
  });

  it("says 'All still high' when all three stayed high", () => {
    const v = { weight: "warn", ldl: "warn", kidneys: "warn" } as const;
    const line = changeLine(
      meal({ items: [rice(150, 195)], kcal: 540, verdicts: v }),
      meal({ items: [rice(200, 260)], kcal: 605, verdicts: v }),
      { lang: "en", restrictions: ["ldl", "kidneys"] });
    expect(line).toBe("Rice 150 → 200g: 540 → 605kcal. All still high for one meal.");
  });

  it("says which dimension moved to on plan, then what stayed high", () => {
    const line = changeLine(
      meal({ items: [rice(150, 195)], kcal: 540, verdicts: { weight: "warn", ldl: "warn" } }),
      meal({ items: [rice(200, 260)], kcal: 605, verdicts: { weight: "good", ldl: "warn" } }),
      { lang: "en", restrictions: ["ldl"] });
    expect(line).toBe("Rice 150 → 200g: 540 → 605kcal. Calories now on plan. Saturated fat still high for one meal.");
  });

  it("says which dimension moved to high, and which moved to over", () => {
    const line = changeLine(
      meal({ items: [rice(150, 195)], kcal: 540, verdicts: { weight: "good", ldl: "good", kidneys: "warn" } }),
      meal({ items: [rice(200, 260)], kcal: 605, verdicts: { weight: "good", ldl: "warn", kidneys: "bad" } }),
      { lang: "en", restrictions: ["ldl", "kidneys"] });
    expect(line).toBe("Rice 150 → 200g: 540 → 605kcal. Saturated fat now high for one meal. Sodium now very high for one meal.");
  });

  it("says 'All on plan now' when every visible dimension landed on plan", () => {
    const line = changeLine(
      meal({ items: [rice(150, 195)], kcal: 540, verdicts: { weight: "warn", ldl: "warn" } }),
      meal({ items: [rice(120, 156)], kcal: 430, verdicts: { weight: "good", ldl: "good" } }),
      { lang: "en", restrictions: ["ldl"] });
    expect(line).toBe("Rice 150 → 120g: 540 → 430kcal. All on plan now.");
  });

  it("names the single on-plan move rather than 'All' when it is the only dimension", () => {
    const line = changeLine(
      meal({ items: [rice(150, 195)], kcal: 540, verdicts: { weight: "warn" } }),
      meal({ items: [rice(120, 156)], kcal: 430, verdicts: { weight: "good" } }),
      EN);
    expect(line).toBe("Rice 150 → 120g: 540 → 430kcal. Calories now on plan.");
  });

  it("carries only the kcal clause when no item's grams moved", () => {
    const line = changeLine(
      meal({ items: [rice(150, 195)], kcal: 540, verdicts: { weight: "warn" } }),
      meal({ items: [rice(150, 195)], kcal: 300, verdicts: { weight: "good" } }),
      EN);
    expect(line).toBe("540 → 300kcal. Calories now on plan.");
  });

  it("joins several moved items with the locale's list word", () => {
    const line = changeLine(
      meal({ items: [rice(150, 195), salmon(140, 345)], kcal: 540, verdicts: { weight: "warn" } }),
      meal({ items: [rice(200, 260), salmon(160, 394)], kcal: 654, verdicts: { weight: "warn" } }),
      EN);
    expect(line).toBe("Rice 150 → 200g and salmon 140 → 160g: 540 → 654kcal. Calories still high for one meal.");
  });

  it("is silent on an edit that moved nothing — a rename gets its card and no line", () => {
    const before = meal({ items: [rice(150, 195)], kcal: 540, verdicts: { weight: "warn" } });
    const renamed = meal({ items: [{ ...rice(150, 195), name: "basmati rice" }], kcal: 540, verdicts: { weight: "warn" } });
    expect(changeLine(before, renamed, EN)).toBeNull();
  });

  it("reads a dimension that appeared — a restriction declared between the writes — as a change", () => {
    const line = changeLine(
      meal({ items: [rice(150, 195)], kcal: 540, verdicts: { weight: "warn" } }),
      meal({ items: [rice(150, 195)], kcal: 540, verdicts: { weight: "warn", kidneys: "bad" } }),
      { lang: "en", restrictions: ["kidneys"] });
    expect(line).toBe("Sodium now very high for one meal. Calories still high for one meal.");
  });

  it("speaks the account's language", () => {
    const line = changeLine(
      meal({ items: [rice(150, 195)], kcal: 540, verdicts: { weight: "warn" } }),
      meal({ items: [rice(200, 260)], kcal: 605, verdicts: { weight: "warn" } }),
      { lang: "ru", restrictions: [] });
    expect(line).toContain("150 → 200г");
    expect(line).toContain("540 → 605ккал");
    expect(line).toContain("всё ещё много");
  });
});

describe("written into the thread", () => {
  const PLATE: AnalyzedMeal = {
    isFood: true,
    items: [rice(150, 195), salmon(140, 345)],
    kcal: 540, protein_g: 30, carbs_g: 40, fat_g: 20,
    satfat_g: 6, fiber_g: 2, sugar_g: 1, sodium_mg: 300,
    confidence: "high", notes: "",
  };
  const analyzer = (a: AnalyzedMeal): LlmPorts => ({ ...demoPorts(), analyzePhoto: async () => a });

  async function plated(userId: string, a: AnalyzedMeal = PLATE) {
    const res = await logPhotoMeal(makeDeps({}, analyzer(a)), userId, photo());
    if (res.kind !== "logged") throw new Error(`expected logged, got ${res.kind}`);
    return res;
  }

  it("the keypad edit writes the card and Gabie's one computed line, in that order", async () => {
    const userId = await onboard();
    // Both sides of the edit inside the warn band (> 1/3 and <= 1/2 of the day's kcal).
    const target = explainTargets((await store.getProfile(userId))!).targets.kcal;
    const kcal = Math.round(target * 0.4), after = Math.round(target * 0.44);
    const meal0 = await plated(userId, { ...PLATE, items: [rice(150, kcal / 2), salmon(140, kcal / 2)], kcal });
    const out = await editMeal(deps, userId, meal0.mealId, { items: [rice(200, kcal / 2), salmon(140, kcal / 2)], kcal: after });
    if (out.kind !== "updated") throw new Error(`expected updated, got ${out.kind}`);
    const t = await thread(userId);
    expect(t.filter((e) => e.kind === "meal")).toHaveLength(1);
    const last = t.at(-1)!;
    expect(last.role === "assistant" && last.kind === "text" && last.speaker).toBe("gabie");
    expect(text(last)).toBe(`Rice 150 → 200g: ${kcal} → ${after}kcal. Calories still high for one meal.`);
    // The result carries the SAME line — the writing screen names the change without a second read.
    expect(out.line).toBe(text(last));
  });

  it("a typed correction writes the user's words, the card and the line", async () => {
    const userId = await onboard();
    const meal0 = await plated(userId);
    const res = await handleText(deps, userId, { text: "half that", focusMealId: meal0.mealId });
    expect(res.kind).toBe("updated");
    if (res.kind !== "updated") throw new Error();
    const t = await thread(userId);
    expect(t.slice(-2).map((e) => [e.role, e.kind])).toEqual([["user", "text"], ["assistant", "text"]]);
    const last = t.at(-1)!;
    expect(last.role === "assistant" && last.kind === "text" && last.speaker).toBe("gabie");
    // The demo correction halves both items: rice 150 → 75, salmon 140 → 70, kcal 540 → 270 —
    // both under a third of the day, so no verdict tail.
    expect(text(last)).toBe("Rice 150 → 75g and salmon 140 → 70g: 540 → 270kcal.");
    expect(res.line).toBe(text(last));
  });

  it("a re-read that moved the numbers writes the line too", async () => {
    const userId = await onboard();
    let calls = 0;
    const llm: LlmPorts = {
      ...demoPorts(),
      analyzePhoto: async () => (++calls === 1 ? PLATE : { ...PLATE, items: [rice(200, 260), salmon(140, 345)], kcal: 605 }),
    };
    const res = await logPhotoMeal(makeDeps({}, llm), userId, photo());
    if (res.kind !== "logged") throw new Error("expected logged");
    const out = await reanalyzeMeal(makeDeps({}, llm), userId, res.mealId);
    expect(out.kind).toBe("updated");
    if (out.kind !== "updated") throw new Error();
    const t = await thread(userId);
    const last = t.at(-1)!;
    expect(last.role === "assistant" && last.kind === "text" && last.speaker).toBe("gabie");
    // 540kcal is 31% of the day (on plan); 605 is 35% (high) — the tail is computed, not written.
    expect(text(last)).toBe("Rice 150 → 200g: 540 → 605kcal. Calories now high for one meal.");
    expect(out.line).toBe(text(last));
  });

  it("a re-read that changed nothing writes no line", async () => {
    const userId = await onboard();
    const res = await plated(userId);
    const out = await reanalyzeMeal(makeDeps({}, analyzer(PLATE)), userId, res.mealId);
    expect(out.kind).toBe("updated");
    if (out.kind !== "updated") throw new Error();
    expect(out.line).toBeNull();
    const t = await thread(userId);
    expect(t.at(-1)!.role === "assistant" && t.at(-1)!.kind === "text").toBe(true);
    // The line is the greeting/verdict text from logging — nothing new was appended for the re-read.
    expect(text(t.at(-1)!)).not.toContain("→");
  });

  it("a rename writes the card and no line", async () => {
    const userId = await onboard();
    const meal0 = await plated(userId);
    const out = await editMeal(deps, userId, meal0.mealId, { items: [{ ...rice(150, 195), name: "basmati rice" }, salmon(140, 345)] });
    if (out.kind !== "updated") throw new Error(`expected updated, got ${out.kind}`);
    expect(out.line).toBeNull();
    const t = await thread(userId);
    expect(t.filter((e) => e.kind === "meal")).toHaveLength(1);
  });

  it("is scoped like every other write: another account's meal id is target-gone and writes nothing", async () => {
    const a = await onboard();
    const b = await onboard();
    const meal0 = await plated(a);
    const mine = (await thread(a)).length;
    const out = await editMeal(deps, b, meal0.mealId, { kcal: 100 });
    expect(out.kind).toBe("target-gone");
    expect(await thread(a)).toHaveLength(mine);
    expect(await thread(b)).toHaveLength(0);
  });
});
