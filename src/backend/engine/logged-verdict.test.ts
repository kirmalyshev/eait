// #130: a meal LOGGED in Chat gets Gabie's computed verdict line for each cap verdict that is
// not on plan — "Saturated fat is high for one meal: 5 of your 13g." The numbers and the
// verdict are computed from the stored row against the account's caps, never the model's, and
// the "Go easy on it for the rest of today." tail speaks only when that nutrient's share of its
// cap is nearly spent — under a third still open (the PR review's ruling: "it" is the line's
// nutrient, not the day). An EDIT gets the change line (#119); this is the log reply.

import { beforeEach, describe, expect, it } from "bun:test";
import { configDefaults, type Config } from "../config.ts";
import { demoPorts } from "../llm/demo.ts";
import type { LlmPorts } from "../llm/port.ts";
import { memoryStore } from "../store.memory.ts";
import type { Store } from "../store.ts";
import { fakePush } from "../push/fake.ts";
import { logMail } from "../mail/log.ts";
import { chatHistory, confirmPendingMeal, editMeal, handleText, logPhotoMeal, patchProfile, type EngineDeps } from "./index.ts";

const CONFIG: Config = {
  ...configDefaults(),
  port: 0, databaseUrl: "memory://test",
  llmProvider: "demo", llmModel: "demo", llmApiKey: "unused",
  freeAnalyses: 100, globalDailyAnalysisCap: 10,
  appleAudiences: ["com.eait.fit.ios"], googleAudiences: ["test.apps.googleusercontent.com"],
};
let store: Store;
let deps: EngineDeps;
function makeDeps(llm: LlmPorts = demoPorts()): EngineDeps {
  return { store, config: CONFIG, llm, push: fakePush(), mail: logMail() };
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

// The analyzer's answer is a prop: the LINE'S numbers are the stored meal's, so the test pins a
// fixed plate rather than trusting the demo seed. Each call reads the next plate so a second log
// can differ from the first. This account's caps are 13g saturated fat (ldl) and 2,000mg
// sodium (kidneys); its kcal plan is 1,724.
const plates = (...ps: [satfat: number, sodium: number, kcal?: number][]): LlmPorts => {
  let i = 0;
  return {
    ...demoPorts(),
    analyzePhoto: async () => {
      const [satfat_g, sodium_mg, kcal = 540] = ps[Math.min(i++, ps.length - 1)]!;
      return {
        isFood: true,
        items: [{ name: "rice bowl", name_en: "rice bowl", grams: 200, kcal, protein_g: 20, carbs_g: 50, fat_g: 20, kcal_per_100g: 270 }],
        kcal, protein_g: 20, carbs_g: 50, fat_g: 20, satfat_g, fiber_g: 3, sugar_g: 10, sodium_mg,
        confidence: "high", notes: "", scale: null,
      };
    },
  };
};

beforeEach(() => {
  store = memoryStore();
  deps = makeDeps();
});

describe("the logged-meal verdict line", () => {
  it("is the board's line for a cap that ran high — the numbers are the stored meal's", async () => {
    deps = makeDeps(plates([0, 0, 300], [5, 300]));
    const userId = await onboard({ restrictions: ["ldl"] });
    await logPhotoMeal(deps, userId, photo()); // an on-plan plate spends the greeting
    const res = await logPhotoMeal(deps, userId, photo());
    expect(res.kind).toBe("logged");
    const t = await thread(userId);
    // The verdict line sits under the card, and nothing follows it — #1066 retired the day's
    // arithmetic, so the cap line is the last thing said.
    expect(text(t.at(-1)!)).toBe("Saturated fat is high for one meal: 5 of your 13g.");
    expect(t.at(-2)!).toMatchObject({ role: "assistant", kind: "meal", event: "logged" });
    for (const e of t.slice(-2)) expect(e).toMatchObject({ speaker: "gabie" });
  });

  it("says sodium in mg when the kidneys cap is the one that ran high", async () => {
    deps = makeDeps(plates([0, 0, 300], [2, 900]));
    const userId = await onboard({ restrictions: ["kidneys"] });
    await logPhotoMeal(deps, userId, photo());
    await logPhotoMeal(deps, userId, photo());
    expect(text((await thread(userId)).at(-1)!)).toBe("Sodium is high for one meal: 900 of your 2,000mg.");
  });

  it("says 'very high' when the share passes the bad line, and one line per off-plan cap", async () => {
    deps = makeDeps(plates([0, 0, 300], [8, 1100]));
    const userId = await onboard({ restrictions: ["ldl", "kidneys"] });
    await logPhotoMeal(deps, userId, photo());
    await logPhotoMeal(deps, userId, photo());
    const t = await thread(userId);
    expect(t.slice(-2).map(text)).toEqual([
      "Sodium is very high for one meal: 1,100 of your 2,000mg.",
      "Saturated fat is very high for one meal: 8 of your 13g.",
    ]);
  });

  it("adds the 'go easy' tail only when the NUTRIENT's share of its cap is nearly spent — under a third left", async () => {
    // 5g a meal against a 13g cap: after the second, 3g (23%) remain — the advice lands even
    // though the day's calories are wide open. "It" is the line's nutrient, not the day (review).
    deps = makeDeps(plates([5, 300]));
    const userId = await onboard({ restrictions: ["ldl"] });
    await logPhotoMeal(deps, userId, photo());
    // First meal: 8 of 13g still open — the line, and no advice yet.
    expect((await thread(userId)).map(text)).toContain("Saturated fat is high for one meal: 5 of your 13g.");
    await logPhotoMeal(deps, userId, photo());
    expect(text((await thread(userId)).at(-1)!)).toBe(
      "Saturated fat is high for one meal: 5 of your 13g. Go easy on it for the rest of today.");

    // The reverse does not: the day's kcal nearly spent (1,940 of 1,724 eaten) but the cap wide
    // open (5 of 13g, 62% left) is no reason to go easy ON IT.
    store = memoryStore(); deps = makeDeps(plates([0, 0, 1400], [5, 300]));
    const early = await onboard({ restrictions: ["ldl"] });
    await logPhotoMeal(deps, early, photo());
    await logPhotoMeal(deps, early, photo());
    expect(text((await thread(early)).at(-1)!)).toBe("Saturated fat is high for one meal: 5 of your 13g.");
  });

  it("is silent when no cap is declared or none ran high — the card stands alone", async () => {
    deps = makeDeps(plates([8, 1500]));
    const userId = await onboard(); // no restrictions: the caps were never declared
    await logPhotoMeal(deps, userId, photo());
    await logPhotoMeal(deps, userId, photo());
    const t = await thread(userId);
    expect(t.at(-1)!.kind).toBe("meal");
    for (const e of t.slice(-4)) expect(text(e)).not.toContain("one meal:");
  });

  it("is scoped like every other write: one account's caps never land in another's thread", async () => {
    deps = makeDeps(plates([8, 1500]));
    const a = await onboard({ restrictions: ["ldl"] });
    const b = await onboard({ restrictions: ["ldl"] });
    await logPhotoMeal(deps, a, photo());
    await logPhotoMeal(deps, a, photo());
    const bt = (await thread(b)).map(text);
    expect(bt.some((x) => x.includes("one meal:"))).toBe(false);
  });
});

// Kirill, prod 8 Oct (#1752): a correction is ONE meal message, and the comments under it are about
// the corrected meal only — no card per event, no verdict line about numbers that are gone.
describe("a correction keeps the thread about the corrected meal only", () => {
  const cards = (t: { kind: string; mealId?: string | null }[], mealId: string) => t.filter((e) => e.kind === "meal" && e.mealId === mealId);

  it("replaces the old verdict lines with the corrected meal's, and writes no second card", async () => {
    deps = makeDeps(plates([0, 0, 300], [8, 1100]));
    const userId = await onboard({ restrictions: ["ldl", "kidneys"] });
    await logPhotoMeal(deps, userId, photo());
    const res = await logPhotoMeal(deps, userId, photo());
    if (res.kind !== "logged") throw new Error(res.kind);
    await editMeal(deps, userId, res.mealId, { satfat_g: 9, sodium_mg: 300 });
    const t = await thread(userId);
    expect(cards(t, res.mealId)).toHaveLength(1);
    const said = t.filter((e) => e.role === "assistant" && e.kind === "text").map(text);
    expect(said.some((l) => l.includes("1,100"))).toBe(false);
    expect(said.filter((l) => l.startsWith("Saturated fat")).length).toBe(1);
    expect(said.some((l) => l.includes("9 of your 13g"))).toBe(true);
  });

  it("leaves no verdict line when the correction puts the meal back on plan", async () => {
    deps = makeDeps(plates([0, 0, 300], [8, 1100]));
    const userId = await onboard({ restrictions: ["ldl", "kidneys"] });
    await logPhotoMeal(deps, userId, photo());
    const res = await logPhotoMeal(deps, userId, photo());
    if (res.kind !== "logged") throw new Error(res.kind);
    await editMeal(deps, userId, res.mealId, { satfat_g: 1, sodium_mg: 100 });
    const said = (await thread(userId)).filter((e) => e.role === "assistant" && e.kind === "text").map(text);
    expect(said.some((l) => /Saturated fat|Sodium/.test(l) && l.includes("for one meal"))).toBe(false);
  });

  const verdictRows = async (userId: string) =>
    (await store.chatBefore(userId, null, 100)).filter((m) => m.role === "assistant" && m.kind === "text" && m.text?.includes("for one meal"));

  it("tags the verdict lines with their meal on the photo path", async () => {
    deps = makeDeps(plates([0, 0, 300], [8, 1100]));
    const userId = await onboard({ restrictions: ["ldl", "kidneys"] });
    await logPhotoMeal(deps, userId, photo());
    const res = await logPhotoMeal(deps, userId, photo());
    if (res.kind !== "logged") throw new Error(res.kind);
    const rows = await verdictRows(userId);
    expect(rows).toHaveLength(2);
    for (const r of rows) expect(r.mealId).toBe(res.mealId);
  });

  it("tags the verdict lines with their meal on the typed, confirmed path", async () => {
    const plate = (await plates([8, 1100]).analyzePhoto({ images: [jpeg()] } as never)) as never;
    deps = makeDeps({ ...demoPorts(), routeText: async () => ({ intent: "meal", analysis: plate, dayOffset: 0 }) });
    const userId = await onboard({ restrictions: ["ldl", "kidneys"] });
    await logPhotoMeal(deps, userId, photo()); // spend the greeting
    const res = await handleText(deps, userId, { text: "burger and fries" });
    if (res.kind !== "proposed") throw new Error(res.kind);
    const c = await confirmPendingMeal(deps, userId, res.pendingId);
    if (c.kind !== "logged") throw new Error(c.kind);
    const rows = await verdictRows(userId);
    expect(rows.some((r) => r.mealId === c.mealId)).toBe(true);
    for (const r of rows) expect(r.mealId).not.toBeNull();
  });

  it("clears the legacy, untagged verdict lines under a card and the stale 'updated' card (Kirill's 8 Oct thread)", async () => {
    deps = makeDeps(plates([0, 0, 300], [8, 1100]));
    const userId = await onboard({ restrictions: ["ldl", "kidneys"] });
    await logPhotoMeal(deps, userId, photo());
    const res = await logPhotoMeal(deps, userId, photo());
    if (res.kind !== "logged") throw new Error(res.kind);
    // Rewrite this meal's tagged lines as prod holds them: no meal id, plus a second card from the correction.
    await store.deleteMealComments(userId, res.mealId);
    await store.appendChat(userId, [
      { role: "assistant", kind: "text", text: "Sodium is high for one meal: 750 of your 2,000mg.", speaker: "gabie" },
      { role: "assistant", kind: "text", text: "Saturated fat is very high for one meal: 12 of your 13g.", speaker: "gabie" },
      { role: "user", kind: "text", text: "it's not vegan" },
      { role: "assistant", kind: "meal", mealId: res.mealId, event: "updated", speaker: "gabie" },
    ]);
    expect(await verdictRows(userId)).toHaveLength(2);
    await editMeal(deps, userId, res.mealId, { satfat_g: 1, sodium_mg: 100 }, { thread: true });
    expect(await verdictRows(userId)).toHaveLength(0);
  });
});
