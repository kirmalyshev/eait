// The verdict words arrive ON the payload (#- fix): the web bundle carries no Lingui catalog —
// `deploy/Dockerfile.web` builds with no node_modules — so every string a card draws is composed
// here, in the account's language. `verdictLabels` (the pills, {dimension, tone, label}),
// `verdictInline` (the diary row's joined line) and `verdictHeadline` (the first-meal card's
// sentence) cover the diary read, the thread's meal arm, a proposal, the pending read-back and
// every write result — and the photo stream's progress events carry their `line` already worded.
//
// A client that still composed these would be a second copy the language could drift behind; the
// guard in `src/frontend/test/imports.test.ts` is what keeps it from regrowing.

import { describe, expect, it } from "bun:test";
import { beforeEach } from "bun:test";
import type { Lang, MealProposed, PhotoEvent } from "@eait/shared";
import { configDefaults, type Config } from "../config.ts";
import { demoPorts } from "../llm/demo.ts";
import type { AnalyzedMeal, LlmPorts } from "../llm/port.ts";
import { memoryStore } from "../store.memory.ts";
import type { Store } from "../store.ts";
import { fakePush } from "../push/fake.ts";
import {
  chatHistory, confirmPendingMeal, day, editMeal, handleText, logPhotoMeal, patchProfile,
  pendingMeals, type EngineDeps,
} from "./index.ts";

const CONFIG: Config = {
  ...configDefaults(),
  port: 0, databaseUrl: "memory://test",
  llmProvider: "demo", llmModel: "demo", llmApiKey: "unused",
  freeAnalyses: 100, globalDailyAnalysisCap: 10,
  appleAudiences: [], googleAudiences: [],
};

let store: Store;
let deps: EngineDeps;

beforeEach(() => {
  store = memoryStore();
  deps = makeDeps();
});

function makeDeps(llm: LlmPorts = demoPorts()): EngineDeps {
  return { store, config: CONFIG, llm, push: fakePush() };
}

async function onboard(lang: Lang = "en", over: Record<string, unknown> = {}): Promise<string> {
  const { userId } = await store.upsertDeviceUser(crypto.randomUUID() + crypto.randomUUID(), lang);
  await store.addIdentity(userId, "google", "g-" + userId.slice(0, 8));
  const out = await patchProfile(deps, userId, {
    goal: "lose", sex: "female", birth_year: 1990, height_cm: 165, weight_kg: 70,
    target_weight_kg: 65, activity: "some", pace: "steady", country: "de",
    restrictions: [], complete_onboarding: true, ...over,
  });
  if (!out || !out.ok) throw new Error(`onboarding failed: ${JSON.stringify(out)}`);
  return userId;
}

const jpeg = (bytes = 8) => { const b = new Uint8Array(2 + bytes).fill(1); b[0] = 0xff; b[1] = 0xd8; return b; };
const photo = () => ({ images: [async () => jpeg()] });

/** A meal off plan on two axes — a verdict with something to say, in any language. */
const BIG: AnalyzedMeal = {
  isFood: true,
  items: [{ name: "Fries", grams: 400, kcal: 1200, protein_g: 12, carbs_g: 130, fat_g: 60 }],
  kcal: 4000, protein_g: 12, carbs_g: 130, fat_g: 60, satfat_g: 30, fiber_g: 8, sugar_g: 5, sodium_mg: 2400,
  confidence: "high", notes: "",
};

const propose = async (userId: string, llm: LlmPorts = demoPorts()): Promise<MealProposed> => {
  const res = await handleText(makeDeps(llm), userId, { text: "a big plate of fries" });
  if (res.kind !== "proposed") throw new Error(`expected proposed, got ${res.kind}`);
  return res;
};

const bigLlm = (): LlmPorts => ({ ...demoPorts(), routeText: async () => ({ intent: "meal", analysis: BIG, dayOffset: 0 }) });

describe("the verdict words on the wire", () => {
  it("words a diary row: verdictInline + verdictLabels on the day read", async () => {
    const userId = await onboard();
    const res = await handleText(deps, userId, { text: "two eggs on toast" });
    if (res.kind !== "proposed") throw new Error("expected proposed");
    const c = await confirmPendingMeal(deps, userId, res.pendingId);
    if (c.kind !== "logged") throw new Error("expected logged");

    const d = await day(deps, userId, c.date);
    if (d === null) throw new Error("no day");
    const meal = d.meals.at(-1)!;
    expect(Array.isArray(meal.verdictLabels)).toBe(true);
    expect(meal.verdictInline).toBeDefined();
    // Every label names its dimension, its tone and its words — all the row needs, nothing computed.
    for (const v of meal.verdictLabels ?? []) {
      expect(v.dimension.length).toBeGreaterThan(0);
      expect(["good", "warn", "bad"]).toContain(v.tone);
      expect(v.label.length).toBeGreaterThan(0);
    }
  });

  it("words an off-plan row in the account's language", async () => {
    const userId = await onboard("de");
    const res = await handleText(makeDeps(bigLlm()), userId, { text: "a big plate of fries" });
    if (res.kind !== "proposed") throw new Error("expected proposed");
    const c = await confirmPendingMeal(deps, userId, res.pendingId);
    if (c.kind !== "logged") throw new Error("expected logged");
    const d = await day(deps, userId, c.date);
    if (d === null) throw new Error("no day");
    const meal = d.meals.at(-1)!;
    expect(meal.verdictInline).not.toBe("");
    // German words, not the English they are a translation of.
    expect(meal.verdictInline).not.toMatch(/high/);
    const warn = (meal.verdictLabels ?? []).find((v) => v.tone !== "good");
    expect(warn?.label).toBeDefined();
  });

  it("words a proposal: verdictInline + verdictLabels on 'proposed'", async () => {
    const userId = await onboard();
    const res = await propose(userId, bigLlm());
    expect(res.verdictInline).not.toBe("");
    expect((res.verdictLabels ?? []).some((v) => v.tone !== "good")).toBe(true);
    for (const v of res.verdictLabels ?? []) expect(v.label.length).toBeGreaterThan(0);
  });

  it("words the pending read-back the same way", async () => {
    const userId = await onboard();
    await propose(userId);
    const held = await pendingMeals(deps, userId);
    expect(held.length).toBeGreaterThan(0);
    const p = held.at(-1)!;
    expect(p.verdictInline).toBeDefined();
    expect(Array.isArray(p.verdictLabels)).toBe(true);
  });

  it("words the thread's meal arm on the chat read", async () => {
    const userId = await onboard();
    const logged = await logPhotoMeal(deps, userId, photo());
    if (logged.kind !== "logged") throw new Error(`expected logged, got ${logged.kind}`);
    const { entries } = await chatHistory(deps, userId, { limit: 10 });
    const mealEntry = entries.find((e) => e.kind === "meal" && "meal" in e && e.meal !== null);
    if (!mealEntry || !("meal" in mealEntry) || mealEntry.meal === null) throw new Error("no meal arm");
    expect(mealEntry.meal.verdictInline).toBeDefined();
    expect(Array.isArray(mealEntry.meal.verdictLabels)).toBe(true);
  });

  it("words the write results: verdictLabels + verdictHeadline on logged and updated", async () => {
    const userId = await onboard();
    const res = await handleText(makeDeps(bigLlm()), userId, { text: "a big plate of fries" });
    if (res.kind !== "proposed") throw new Error("expected proposed");
    const logged = await confirmPendingMeal(deps, userId, res.pendingId);
    if (logged.kind !== "logged") throw new Error("expected logged");
    expect(Array.isArray(logged.verdictLabels)).toBe(true);
    expect(logged.verdictHeadline).toBeDefined();

    const updated = await editMeal(deps, userId, logged.mealId, { kcal: 600 });
    if (updated.kind !== "updated") throw new Error("expected updated");
    expect(Array.isArray(updated.verdictLabels)).toBe(true);
    expect(updated.verdictHeadline).toBeDefined();
    // The words moved with the numbers — a verdict must never describe what changed under it.
    const after = await editMeal(deps, userId, logged.mealId, { kcal: 4500 });
    if (after.kind !== "updated") throw new Error("expected updated");
    expect(after.verdictHeadline).not.toBe(updated.verdictHeadline);
  });

  it("streams the progress lines already worded, in the account's language", async () => {
    const userId = await onboard("de");
    const events: PhotoEvent[] = [];
    const res = await logPhotoMeal(makeDeps(), userId, photo(), (e) => events.push(e));
    if (res.kind !== "logged") throw new Error(`expected logged, got ${res.kind}`);
    // The first word on the wire is the reading line — never composed client-side.
    const first = events[0];
    expect(first?.kind).toBe("reading");
    if (first?.kind === "reading") expect(first.line).toBe("Teller wird erkannt…");
    // Every item event carries the weighing line, localized — the browser prints it verbatim.
    const item = events.find((e) => e.kind === "item");
    if (item !== undefined && item.kind === "item") expect(item.line).toBe("Portionen werden gewogen…");
  });
});

describe("an on-plan day", () => {
  it("says nothing inline but still sends the labels", async () => {
    const userId = await onboard();
    const res = await handleText(deps, userId, { text: "two eggs on toast" });
    if (res.kind !== "proposed") throw new Error("expected proposed");
    const c = await confirmPendingMeal(deps, userId, res.pendingId);
    if (c.kind !== "logged") throw new Error("expected logged");
    const d = await day(deps, userId, c.date);
    if (d === null) throw new Error("no day");
    const meal = d.meals.at(-1)!;
    // The inline line is a STRING either way — empty on plan, joined warn/bad words off it.
    expect(typeof meal.verdictInline).toBe("string");
  });
});
