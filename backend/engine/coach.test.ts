// The coach turn: what the agent is handed, what its tools may reach, and how it fails.
//
// Every tool here is a closure over ONE user id, built by the engine — so the property worth
// proving is not that the model behaves, it is that nothing the model can say reaches another
// account's rows or widens a window past its bound.

import { beforeEach, describe, expect, it } from "bun:test";
import { HEALTH_RETENTION_DAYS, type HealthDay, type MealRecord, dateMinus, localDate } from "@eait/shared";
import { configDefaults, type Config } from "../config.ts";
import { demoPorts } from "../llm/demo.ts";
import type { CoachInput, CoachTools, LlmPorts, TextInput } from "../llm/port.ts";
import { memoryStore } from "../store.memory.ts";
import type { Store } from "../store.ts";
import { fakeMailer } from "../mail/fake.ts";
import { fakePush } from "../push/fake.ts";
import { COACH_HISTORY_LINES, coachTools, handleText, patchProfile, recentLines, type EngineDeps } from "./index.ts";

const CONFIG: Config = {
  ...configDefaults(), port: 0, databaseUrl: "memory://test",
  llmProvider: "demo", llmModel: "demo", llmChatModel: "demo", llmApiKey: "unused",
  freeAnalyses: 100, globalDailyAnalysisCap: 100,
};

let store: Store;
let deps: EngineDeps;
const makeDeps = (llm: LlmPorts = demoPorts(), over: Partial<Config> = {}): EngineDeps =>
  ({ store, config: { ...CONFIG, ...over }, llm, mailer: fakeMailer(), push: fakePush() });

async function onboard(over: Record<string, unknown> = {}): Promise<string> {
  const { userId } = await store.upsertDeviceUser(crypto.randomUUID() + crypto.randomUUID(), "en");
  const out = await patchProfile(deps, userId, {
    goal: "lose", sex: "female", birth_year: 1990, height_cm: 165, weight_kg: 70,
    target_weight_kg: 65, activity: "moderate", pace: "steady", country: "de",
    restrictions: [], complete_onboarding: true, ...over,
  });
  if (!out || !out.ok) throw new Error("onboarding failed");
  return userId;
}

const today = () => localDate(CONFIG.timezone);
const meal = (userId: string, over: Partial<MealRecord> = {}): MealRecord => ({
  id: crypto.randomUUID(), user_id: userId, ts: new Date().toISOString(), date: today(),
  isFood: true, items: [{ name: "Rice", grams: 200, name_en: "rice" }, { name: "Chicken", grams: 150 }],
  kcal: 500, protein_g: 40, carbs_g: 56, fat_g: 8, satfat_g: 2, fiber_g: 1, sugar_g: 0.1, sodium_mg: 400,
  verdicts: { weight: "good" }, confidence: "high", notes: "", corrected: false, model: "test", ...over,
});

/** A coach that records what it was handed and answers a fixed line. */
function recordingCoach(reply = "Here is the answer.", suggestions = ["And protein?"]) {
  const seen: { input: CoachInput; tools: CoachTools }[] = [];
  const routed: TextInput[] = [];
  const demo = demoPorts();
  const llm: LlmPorts = {
    ...demo,
    routeText: async (i) => { routed.push(i); return demo.routeText(i); },
    coach: async (input, tools) => { seen.push({ input, tools }); return { reply, suggestions }; },
  };
  return { llm, seen, routed };
}

beforeEach(() => {
  store = memoryStore();
  deps = makeDeps();
});

describe("the coach turn", () => {
  it("answers a question through the coach, and the thread keeps the words but not the chips", async () => {
    const { llm, seen } = recordingCoach();
    const d = makeDeps(llm);
    const userId = await onboard();
    const res = await handleText(d, userId, { text: "how much protein have I had?" });
    expect(res).toEqual({ kind: "answered", text: "Here is the answer.", suggestions: ["And protein?"] });
    expect(seen).toHaveLength(1);
    const lines = (await store.chatBefore(userId, null, 10)).reverse();
    expect(lines.map((l) => [l.role, l.text])).toEqual([
      ["user", "how much protein have I had?"], ["assistant", "Here is the answer."],
    ]);
  });

  it("hands the coach the plan, the day, the week, the focus meal and the clock", async () => {
    const { llm, seen } = recordingCoach();
    const d = makeDeps(llm);
    const userId = await onboard();
    const m = meal(userId);
    await store.insertMeal(m);
    await store.insertMeal(meal(userId, { date: dateMinus(today(), 1), kcal: 1800, protein_g: 90 }));
    await handleText(d, userId, { text: "is this ok?", focusMealId: m.id });
    const c = seen[0]!.input.context;
    expect(c.today).toBe(today());
    expect(c.localTime).toMatch(/^\d\d:\d\d$/);
    expect(c.targets.kcal).toBeGreaterThan(0);
    expect(c.basis.floorKcal).toBe(1200);
    expect(c.todayMeals).toEqual([{ items: ["Rice", "Chicken"], kcal: 500, protein_g: 40 }]);
    expect(c.week.map((w) => w.kcal).sort()).toEqual([1800, 500]);
    expect(c.focusMeal?.kcal).toBe(500);
    expect(c.projection).toMatch(/^around [A-Z][a-z]+ \d{4}$/);
    expect(seen[0]!.input.text).toBe("is this ok?");
  });

  it("replays the thread oldest first, cards as notes about the meal as it is now, without the message itself", async () => {
    const { llm, seen, routed } = recordingCoach();
    const d = makeDeps(llm);
    const userId = await onboard();
    const m = meal(userId);
    await store.insertMeal(m);
    const gone = meal(userId);
    await store.appendChat(userId, [
      { role: "user", kind: "photo", text: "with sauce" },
      { role: "assistant", kind: "meal", mealId: m.id, event: "logged" },
      { role: "assistant", kind: "meal", mealId: gone.id, event: "updated" },
      { role: "assistant", kind: "text", text: "First one in." },
      { role: "user", kind: "text", text: "thanks" },
    ]);
    await handleText(d, userId, { text: "what did I eat?" });
    const h = seen[0]!.input.history;
    expect(h).toEqual([
      { role: "user", text: "[photo] with sauce" },
      { role: "assistant", text: `[logged: Rice, Chicken — 500 kcal, 40 g protein, ${today()}]` },
      { role: "assistant", text: "[a meal that was later deleted]" },
      { role: "assistant", text: "First one in." },
      { role: "user", text: "thanks" },
    ]);
    // And the router saw the tail too, so a follow-up can route as one.
    expect(routed[0]!.recent).toEqual(h.slice(-6));
  });

  it("bounds the history to the newest lines", async () => {
    const userId = await onboard();
    await store.appendChat(userId, Array.from({ length: COACH_HISTORY_LINES + 5 }, (_, i) =>
      ({ role: "user" as const, kind: "text" as const, text: `line ${i}` })));
    const h = await recentLines(deps, userId);
    expect(h).toHaveLength(COACH_HISTORY_LINES);
    expect(h[0]!.text).toBe("line 5");
    expect(h[h.length - 1]!.text).toBe(`line ${COACH_HISTORY_LINES + 4}`);
  });

  it("falls back to the router's own sentence when the coach fails, and still keeps the turn", async () => {
    const llm: LlmPorts = { ...demoPorts(), coach: async () => { throw new Error("the coach is down"); } };
    const d = makeDeps(llm);
    const userId = await onboard();
    const res = await handleText(d, userId, { text: "how much protein have I had?" });
    expect(res.kind).toBe("answered");
    if (res.kind === "answered") {
      expect(res.text).toContain("Demo answer");
      expect(res.suggestions).toBeUndefined();
    }
    expect((await store.chatBefore(userId, null, 10))).toHaveLength(2);
  });

  it("refuses as analysis-failed when the coach fails and the router had nothing to say either", async () => {
    // Neither side produced a sentence. An empty `answered` would be filtered out of the thread
    // and off the screen — a turn that vanished — so it is the refusal the app words instead.
    const llm: LlmPorts = {
      ...demoPorts(),
      routeText: async () => ({ intent: "answer", text: "" }),
      coach: async () => { throw new Error("the coach is down"); },
    };
    const d = makeDeps(llm);
    const userId = await onboard();
    expect((await handleText(d, userId, { text: "how much protein have I had?" })).kind).toBe("analysis-failed");
    expect(await store.chatBefore(userId, null, 10)).toHaveLength(0);
  });

  it("never reaches the coach on a refused turn: the sample rule and the caps stand in front of it", async () => {
    const { llm, seen } = recordingCoach();
    const d = makeDeps(llm, { freeAnalyses: 0 });
    const userId = await onboard();
    expect((await handleText(d, userId, { text: "what should I eat?" })).kind).toBe("subscription-required");
    expect(seen).toHaveLength(0);
  });

  it("does not route a described meal to the coach", async () => {
    const { llm, seen } = recordingCoach();
    const d = makeDeps(llm);
    const userId = await onboard();
    expect((await handleText(d, userId, { text: "two eggs and toast" })).kind).toBe("proposed");
    expect(seen).toHaveLength(0);
  });
});

describe("the coach's tools", () => {
  it("get_meals sees this account's meals in the window and nobody else's, newest first, rounded", async () => {
    const userId = await onboard();
    const other = await onboard();
    const t = today();
    await store.insertMeal(meal(userId, { date: dateMinus(t, 1), kcal: 333.4, ts: "2026-01-01T12:00:00.000Z" }));
    await store.insertMeal(meal(userId, { date: t, kcal: 100, ts: "2026-01-02T08:30:00.000Z" }));
    await store.insertMeal(meal(userId, { date: dateMinus(t, 40), kcal: 999 }));
    await store.insertMeal(meal(other, { date: t, kcal: 777 }));
    const tools = coachTools(deps, userId, t);
    const rows = await tools.get_meals!({ from: dateMinus(t, 6), to: t }) as { date: string; kcal: number; items: { name: string; grams: number }[]; time: string }[];
    expect(rows.map((r) => r.kcal)).toEqual([100, 333]);
    expect(rows[0]!.items).toEqual([{ name: "Rice", grams: 200 }, { name: "Chicken", grams: 150 }]);
    expect(rows[0]!.time).toMatch(/^\d\d:\d\d$/);
    // Nothing on a row names the account.
    expect(JSON.stringify(rows)).not.toContain(userId);
  });

  it("get_meals refuses a bad window in words, never with a throw or a wider read", async () => {
    const userId = await onboard();
    const t = today();
    const tools = coachTools(deps, userId, t);
    expect(await tools.get_meals!({ from: "yesterday", to: t })).toHaveProperty("error");
    expect(await tools.get_meals!({ from: t, to: dateMinus(t, 1) })).toHaveProperty("error");
    expect(await tools.get_meals!({ from: dateMinus(t, 31), to: t })).toHaveProperty("error");
    expect(await tools.get_meals!({ from: dateMinus(t, 30), to: t })).toEqual([]);
    expect(await tools.get_meals!({})).toHaveProperty("error");
  });

  it("get_health reads this account's days only, clamps the window, and drops empty readings", async () => {
    const userId = await onboard();
    const other = await onboard();
    const t = today();
    const day = (date: string, over: Partial<HealthDay> = {}): HealthDay => ({
      date, weight_kg: null, height_cm: null, body_fat_pct: null, lean_mass_kg: null,
      active_kcal: null, resting_kcal: null, steps: null, exercise_minutes: null, workouts: null,
      distance_km: null, asleep_minutes: null, ...over,
    } as HealthDay);
    await store.putHealthDays(userId, [day(t, { weight_kg: 69.5, steps: 8000 }), day(dateMinus(t, 100), { weight_kg: 72 }), day(dateMinus(t, 1))]);
    await store.putHealthDays(other, [day(t, { weight_kg: 90 })]);
    const tools = coachTools(deps, userId, t);
    const rows = await tools.get_health!({ days: 5000 }) as Record<string, unknown>[];
    // The day with no readings at all is not a row: the definition says so, and a bare date is noise.
    expect(rows).toEqual([{ date: t, weight_kg: 69.5, steps: 8000 }]);
    expect(await tools.get_health!({ days: "junk" })).toHaveLength(1);
    expect(await tools.get_health!({ days: 0 })).toHaveLength(1);
    expect(HEALTH_RETENTION_DAYS).toBeGreaterThan(90);
  });
});
