// #130: a meal LOGGED in Chat gets Gabie's computed verdict line for each cap verdict that is
// not on plan — "Saturated fat is high for one meal: 5 of your 13 g." The numbers and the
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
import { chatHistory, logPhotoMeal, patchProfile, type EngineDeps } from "./index.ts";

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
  return { store, config: CONFIG, llm, push: fakePush() };
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
// can differ from the first. This account's caps are 13 g saturated fat (ldl) and 2,000 mg
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
    const last = t.slice(-2).map(text);
    // The verdict line sits under the card, before the day's arithmetic.
    expect(last[0]).toBe("Saturated fat is high for one meal: 5 of your 13 g.");
    expect(last[1]).toContain("left today");
    expect(t.at(-3)!).toMatchObject({ role: "assistant", kind: "meal", event: "logged" });
    for (const e of t.slice(-3)) expect(e).toMatchObject({ speaker: "gabie" });
  });

  it("says sodium in mg when the kidneys cap is the one that ran high", async () => {
    deps = makeDeps(plates([0, 0, 300], [2, 900]));
    const userId = await onboard({ restrictions: ["kidneys"] });
    await logPhotoMeal(deps, userId, photo());
    await logPhotoMeal(deps, userId, photo());
    expect((await thread(userId)).slice(-2).map(text)[0]).toBe("Sodium is high for one meal: 900 of your 2,000 mg.");
  });

  it("says 'very high' when the share passes the bad line, and one line per off-plan cap", async () => {
    deps = makeDeps(plates([0, 0, 300], [8, 1100]));
    const userId = await onboard({ restrictions: ["ldl", "kidneys"] });
    await logPhotoMeal(deps, userId, photo());
    await logPhotoMeal(deps, userId, photo());
    const t = await thread(userId);
    expect(t.slice(-3).map(text)).toEqual([
      "Sodium is very high for one meal: 1,100 of your 2,000 mg.",
      "Saturated fat is very high for one meal: 8 of your 13 g.",
      expect.stringContaining("left today") as unknown as string,
    ]);
  });

  it("adds the 'go easy' tail only when the NUTRIENT's share of its cap is nearly spent — under a third left", async () => {
    // 5 g a meal against a 13 g cap: after the second, 3 g (23%) remain — the advice lands even
    // though the day's calories are wide open. "It" is the line's nutrient, not the day (review).
    deps = makeDeps(plates([5, 300]));
    const userId = await onboard({ restrictions: ["ldl"] });
    await logPhotoMeal(deps, userId, photo());
    // First meal: 8 of 13 g still open — the line, and no advice yet.
    expect((await thread(userId)).map(text)).toContain("Saturated fat is high for one meal: 5 of your 13 g.");
    await logPhotoMeal(deps, userId, photo());
    expect((await thread(userId)).slice(-2).map(text)[0]).toBe(
      "Saturated fat is high for one meal: 5 of your 13 g. Go easy on it for the rest of today.");

    // The reverse does not: the day's kcal nearly spent (1,940 of 1,724 eaten) but the cap wide
    // open (5 of 13 g, 62% left) is no reason to go easy ON IT.
    store = memoryStore(); deps = makeDeps(plates([0, 0, 1400], [5, 300]));
    const early = await onboard({ restrictions: ["ldl"] });
    await logPhotoMeal(deps, early, photo());
    await logPhotoMeal(deps, early, photo());
    expect((await thread(early)).slice(-2).map(text)[0]).toBe("Saturated fat is high for one meal: 5 of your 13 g.");
  });

  it("is silent when no cap is declared or none ran high — the card and the running line stand alone", async () => {
    deps = makeDeps(plates([8, 1500]));
    const userId = await onboard(); // no restrictions: the caps were never declared
    await logPhotoMeal(deps, userId, photo());
    await logPhotoMeal(deps, userId, photo());
    const t = (await thread(userId)).slice(-1).map(text);
    expect(t[0]).toContain("left today");
    for (const e of (await thread(userId)).slice(-4)) expect(text(e)).not.toContain("one meal:");
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
