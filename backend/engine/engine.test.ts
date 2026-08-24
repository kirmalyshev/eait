import { beforeEach, describe, expect, it } from "bun:test";
import { isMeal, type MealAnalysis } from "@ieat/shared";
import { configDefaults, type Config } from "../config.ts";
import { demoPorts } from "../llm/demo.ts";
import type { LlmPorts } from "../llm/port.ts";
import { memoryStore } from "../store.memory.ts";
import type { Store } from "../store.ts";
import { localDate } from "@ieat/shared";
import { fakeMailer } from "../mail/fake.ts";
import {
  applyCorrection, cancelPendingMeal, confirmPendingMeal, day, editMeal, handleText, logPhotoMeal,
  nextStep, patchProfile, profileView, week, type EngineDeps,
} from "./index.ts";

const CONFIG: Config = {
  ...configDefaults(),
  port: 0, databaseUrl: "memory://test",
  llmProvider: "demo", llmModel: "demo", llmApiKey: "unused",
  userDailyPhotoCap: 3, globalDailyAnalysisCap: 10,
  appleAudiences: ["app.ieat"], googleAudiences: ["test.apps.googleusercontent.com"],
};

let store: Store;
let deps: EngineDeps;

function makeDeps(over: Partial<Config> = {}, llm: LlmPorts = demoPorts()): EngineDeps {
  return { store, config: { ...CONFIG, ...over }, llm, mailer: fakeMailer() };
}

/** A fully onboarded user. Returns the id. */
async function onboard(over: Record<string, unknown> = {}): Promise<string> {
  const { userId } = await store.upsertDeviceUser(crypto.randomUUID() + crypto.randomUUID(), "en");
  const out = await patchProfile(deps, userId, {
    goal: "lose", sex: "female", birth_year: 1990, height_cm: 165, weight_kg: 70,
    target_weight_kg: 65, activity: "moderate", pace: "steady", country: "de",
    restrictions: [], complete_onboarding: true, ...over,
  });
  if (!out || !out.ok) throw new Error(`onboarding failed: ${JSON.stringify(out)}`);
  return userId;
}

const photo = (bytes = 8) => ({ images: [async () => new Uint8Array(bytes).fill(1)] });

beforeEach(() => {
  store = memoryStore();
  deps = makeDeps();
});

describe("onboarding", () => {
  it("refuses every engine call until onboarding completes", async () => {
    const { userId } = await store.upsertDeviceUser("d".repeat(40), "en");
    expect((await logPhotoMeal(deps, userId, photo())).kind).toBe("not-onboarded");
    expect((await handleText(deps, userId, { text: "hi" })).kind).toBe("not-onboarded");
  });

  it("derives the next question from the fields, not from a counter", async () => {
    const { userId } = await store.upsertDeviceUser("e".repeat(40), "en");
    const blank = (await store.getProfile(userId))!;
    expect(nextStep(blank)).toBe("goal");

    await patchProfile(deps, userId, { goal: "lose" });
    expect(nextStep((await store.getProfile(userId))!)).toBe("sex");

    await patchProfile(deps, userId, { sex: "male", birth_year: 1988, height_cm: 180 });
    expect(nextStep((await store.getProfile(userId))!)).toBe("weight_kg");
  });

  it("skips target weight and pace for a maintaining user", async () => {
    const { userId } = await store.upsertDeviceUser("f".repeat(40), "en");
    await patchProfile(deps, userId, {
      goal: "maintain", sex: "male", birth_year: 1988, height_cm: 180, weight_kg: 80,
      activity: "light",
    });
    // Neither target_weight_kg nor pace is asked; the next unanswered field is country.
    expect(nextStep((await store.getProfile(userId))!)).toBe("country");
  });

  it("REFUSES a target weight below the healthy BMI band, and says what it would accept", async () => {
    const { userId } = await store.upsertDeviceUser("g".repeat(40), "en");
    await patchProfile(deps, userId, { height_cm: 170 });
    const out = await patchProfile(deps, userId, { target_weight_kg: 42 });
    expect(out!.ok).toBe(false);
    if (!out!.ok) {
      expect(out!.rejected.reason).toBe("target-weight-below-healthy-bmi");
      expect(out!.rejected.minHealthyKg).toBe(54);
    }
    // And it did not write.
    expect((await store.getProfile(userId))!.target_weight_kg).toBeNull();
  });

  it("cannot be slipped past by sending height and target weight in the same patch", async () => {
    const { userId } = await store.upsertDeviceUser("h".repeat(40), "en");
    const out = await patchProfile(deps, userId, { height_cm: 170, target_weight_kg: 42 });
    expect(out!.ok).toBe(false);
  });

  it("refuses an under-16 rather than clamping them to an adult target", async () => {
    const { userId } = await store.upsertDeviceUser("i".repeat(40), "en");
    const out = await patchProfile(deps, userId, { birth_year: new Date().getUTCFullYear() - 14 });
    expect(out!.ok).toBe(false);
    if (!out!.ok) expect(out!.rejected.reason).toBe("age-below-minimum");
  });

  it("drops restriction tags outside the closed vocabulary instead of 422-ing", async () => {
    const userId = await onboard({ restrictions: ["ldl", "wizardry", "kidneys"] });
    expect((await store.getProfile(userId))!.restrictions).toEqual(["ldl", "kidneys"]);
  });

  it("will not complete onboarding without a goal and a bodyweight", async () => {
    const { userId } = await store.upsertDeviceUser("j".repeat(40), "en");
    const out = await patchProfile(deps, userId, { sex: "male", complete_onboarding: true });
    expect(out!.ok).toBe(false);
  });

  it("surfaces the floor through the profile view", async () => {
    // A small, older, sedentary woman on the fastest pace — the shape that produced the
    // incumbent's 569 kcal review.
    const userId = await onboard({
      sex: "female", birth_year: 1958, height_cm: 152, weight_kg: 48, target_weight_kg: 45,
      activity: "sedentary", pace: "push", goal: "lose",
    });
    const view = (await profileView(deps, userId))!;
    expect(view.targets.kcal).toBe(1200);
    expect(view.basis.floorApplied).toBe(true);
  });

  it("tells the client THIS server's limits, so the two cannot disagree", async () => {
    // Both are env-configured and differ per environment. The app renders as many photo slots as
    // `limits.maxPhotosPerMeal` allows; if it used its own compiled constant instead, a user on an
    // instance with a lower limit would pick photos and only then be refused.
    const userId = await onboard();
    const view = (await profileView(deps, userId))!;
    expect(view.limits.maxPhotosPerMeal).toBe(CONFIG.maxPhotosPerMeal);
    expect(view.limits.maxUploadBytes).toBe(CONFIG.maxUploadBytes);

    // And it tracks the config rather than a constant that happens to match today.
    const tighter = { ...deps, config: { ...CONFIG, maxPhotosPerMeal: 1 } };
    expect((await profileView(tighter, userId))!.limits.maxPhotosPerMeal).toBe(1);
  });
});

describe("photo logging", () => {
  it("logs a meal and returns totals for its own date", async () => {
    const userId = await onboard();
    const res = await logPhotoMeal(deps, userId, photo());
    expect(res.kind).toBe("logged");
    if (!isMeal(res)) throw new Error("expected a meal");
    expect(res.analysis.items.length).toBeGreaterThan(0);
    expect(res.totals.kcal).toBe(res.analysis.kcal);
    expect(res.date).toBe(localDate("Europe/Berlin"));
  });

  it("returns not-food without writing anything", async () => {
    const llm: LlmPorts = {
      ...demoPorts(),
      analyzePhoto: async () => ({
        isFood: false, items: [], kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, satfat_g: 0,
        fiber_g: 0, sugar_g: 0, sodium_mg: 0, verdicts: {}, confidence: "high",
        notes: "a cat",
      }),
    };
    const userId = await onboard();
    const res = await logPhotoMeal(makeDeps({}, llm), userId, photo());
    expect(res.kind).toBe("not-food");
    expect((await day(deps, userId))!.meals).toHaveLength(0);
  });

  it("turns an analyzer failure into a refusal, never an exception", async () => {
    const llm: LlmPorts = {
      ...demoPorts(),
      analyzePhoto: async () => { throw new Error("upstream exploded"); },
    };
    const userId = await onboard();
    expect((await logPhotoMeal(makeDeps({}, llm), userId, photo())).kind).toBe("analysis-failed");
  });

  it("charges the cap even when the model call fails", async () => {
    // A cap that only counts successes is a cap a retry loop walks straight through.
    const llm: LlmPorts = {
      ...demoPorts(),
      analyzePhoto: async () => { throw new Error("nope"); },
    };
    const d = makeDeps({}, llm);
    const userId = await onboard();
    await logPhotoMeal(d, userId, photo());
    expect(await store.countUserPhotos(userId, localDate("Europe/Berlin"))).toBe(1);
  });

  it("never reads image bytes when the cap already refused", async () => {
    const userId = await onboard();
    const d = makeDeps({ userDailyPhotoCap: 1 });
    await logPhotoMeal(d, userId, photo());

    let read = false;
    const res = await logPhotoMeal(d, userId, {
      images: [async () => { read = true; return new Uint8Array(4); }],
    });
    expect(res.kind).toBe("cap-exceeded");
    expect(read).toBe(false); // thunks exist precisely for this
  });

  it("distinguishes the user cap from the global cap", async () => {
    const a = await onboard();
    const perUser = makeDeps({ userDailyPhotoCap: 1, globalDailyAnalysisCap: 100 });
    await logPhotoMeal(perUser, a, photo());
    const mine = await logPhotoMeal(perUser, a, photo());
    expect(mine).toEqual({ kind: "cap-exceeded", scope: "user" });

    const b = await onboard();
    const global = makeDeps({ userDailyPhotoCap: 100, globalDailyAnalysisCap: 1 });
    const theirs = await logPhotoMeal(global, b, photo());
    expect(theirs).toEqual({ kind: "cap-exceeded", scope: "global" });
  });

  // The freemium mechanic. What a paid account buys is a bigger per-user cap — never an exemption
  // from the global one, which is the instance budget rather than a fairness rule.
  it("gives a paid account the paid cap and a free one the free cap", async () => {
    const free = await onboard();
    const paid = await onboard();
    await store.putEntitlement(paid, {
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      productId: "ieat_pro_yearly",
      eventAt: new Date().toISOString(),
    });

    const d = makeDeps({ userDailyPhotoCap: 1, paidDailyPhotoCap: 3, globalDailyAnalysisCap: 100 });

    await logPhotoMeal(d, free, photo());
    expect(await logPhotoMeal(d, free, photo())).toEqual({ kind: "cap-exceeded", scope: "user" });

    for (let i = 0; i < 3; i++) await logPhotoMeal(d, paid, photo());
    expect(await logPhotoMeal(d, paid, photo())).toEqual({ kind: "cap-exceeded", scope: "user" });
  });

  // A subscription that lapsed an hour ago must stop working an hour ago. The entitlement is read
  // per request rather than carried in the session, which lives for up to 180 days.
  it("drops a lapsed account back to the free cap", async () => {
    const userId = await onboard();
    await store.putEntitlement(userId, {
      expiresAt: new Date(Date.now() - 1000).toISOString(),
      productId: "ieat_pro_yearly",
      eventAt: new Date().toISOString(),
    });
    const d = makeDeps({ userDailyPhotoCap: 1, paidDailyPhotoCap: 50, globalDailyAnalysisCap: 100 });
    await logPhotoMeal(d, userId, photo());
    expect(await logPhotoMeal(d, userId, photo())).toEqual({ kind: "cap-exceeded", scope: "user" });
  });

  // The instance budget is not something a subscription can buy past.
  it("still refuses a paid account when the instance budget is spent", async () => {
    const userId = await onboard();
    await store.putEntitlement(userId, {
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      productId: "ieat_pro_yearly",
      eventAt: new Date().toISOString(),
    });
    const d = makeDeps({ userDailyPhotoCap: 1, paidDailyPhotoCap: 500, globalDailyAnalysisCap: 1 });
    await logPhotoMeal(d, userId, photo());
    expect(await logPhotoMeal(d, userId, photo())).toEqual({ kind: "cap-exceeded", scope: "global" });
  });

  it("hints at correction, and says so louder when confidence is low", async () => {
    const userId = await onboard();
    const low: LlmPorts = {
      ...demoPorts(),
      analyzePhoto: async (i) => ({ ...(await demoPorts().analyzePhoto(i)), confidence: "low" }),
    };
    const res = await logPhotoMeal(makeDeps({}, low), userId, photo());
    if (!isMeal(res) || res.kind !== "logged") throw new Error("expected logged");
    expect(res.hint).toBe("lowConfidence");
  });
});

describe("verdict gating", () => {
  it("emits no medical verdict for a user who declared none", async () => {
    const userId = await onboard({ restrictions: [] });
    const res = await logPhotoMeal(deps, userId, photo());
    if (!isMeal(res)) throw new Error("expected a meal");
    expect(res.analysis.verdicts.ldl).toBeUndefined();
    expect(res.analysis.verdicts.kidneys).toBeUndefined();
    expect(res.analysis.verdicts.weight).toBeDefined();
  });

  it("emits only the declared dimension", async () => {
    const userId = await onboard({ restrictions: ["ldl"] });
    const res = await logPhotoMeal(deps, userId, photo());
    if (!isMeal(res)) throw new Error("expected a meal");
    expect(res.analysis.verdicts.ldl).toBeDefined();
    expect(res.analysis.verdicts.kidneys).toBeUndefined();
  });

  it("ignores verdicts the analyzer tried to author", async () => {
    const llm: LlmPorts = {
      ...demoPorts(),
      analyzePhoto: async (i) => ({
        ...(await demoPorts().analyzePhoto(i)),
        // A model doing what eait observed models doing in production.
        verdicts: { weight: "good", ldl: "good", kidneys: "good" },
      }),
    };
    const userId = await onboard({ restrictions: [] });
    const res = await logPhotoMeal(makeDeps({}, llm), userId, photo());
    if (!isMeal(res)) throw new Error("expected a meal");
    expect(res.analysis.verdicts).toEqual({ weight: res.analysis.verdicts.weight! });
  });
});

describe("editing the answer", () => {
  async function logged(userId: string) {
    const res = await logPhotoMeal(deps, userId, photo());
    if (res.kind !== "logged") throw new Error("expected logged");
    return res;
  }

  it("applies a manual edit, flags it corrected, and recomputes totals", async () => {
    const userId = await onboard();
    const meal = await logged(userId);
    const out = await editMeal(deps, userId, meal.mealId, { kcal: 250, protein_g: 12 });
    expect(out.kind).toBe("updated");
    if (out.kind !== "updated") throw new Error("expected updated");
    expect(out.analysis.kcal).toBe(250);
    expect(out.totals.kcal).toBe(250);
    expect(out.via).toBe("manual");
    expect((await store.getMeal(userId, meal.mealId))!.corrected).toBe(true);
  });

  it("recomputes the verdict after an edit rather than leaving a stale one", async () => {
    // The whole reason verdicts are computed and not stored from the model: an edit changes the
    // numbers, and a verdict beside them must change too or it is describing something else.
    const userId = await onboard({ restrictions: ["ldl"] });
    const meal = await logged(userId);
    const before = (await store.getMeal(userId, meal.mealId))!.verdicts.ldl;
    const out = await editMeal(deps, userId, meal.mealId, { satfat_g: 40 });
    if (out.kind !== "updated") throw new Error("expected updated");
    expect(out.analysis.verdicts.ldl).toBe("bad");
    expect(out.analysis.verdicts.ldl).not.toBe(before);
  });

  it("leaves unspecified fields alone", async () => {
    const userId = await onboard();
    const meal = await logged(userId);
    const out = await editMeal(deps, userId, meal.mealId, { kcal: 111 });
    if (out.kind !== "updated") throw new Error("expected updated");
    expect(out.analysis.protein_g).toBe(meal.analysis.protein_g);
  });

  it("cannot edit another user's meal", async () => {
    const a = await onboard();
    const b = await onboard();
    const meal = await logged(a);
    const out = await editMeal(deps, b, meal.mealId, { kcal: 1 });
    // Indistinguishable from a deleted meal — a probe learns nothing about whether it exists.
    expect(out).toEqual({ kind: "target-gone", on: "correction" });
    expect((await store.getMeal(a, meal.mealId))!.kcal).toBe(meal.analysis.kcal);
  });

  it("reports target-gone when the meal was deleted first", async () => {
    const userId = await onboard();
    const out = await editMeal(deps, userId, crypto.randomUUID(), { kcal: 1 });
    expect(out).toEqual({ kind: "target-gone", on: "correction" });
  });

  it("applies a natural-language correction through the same write path", async () => {
    const userId = await onboard();
    const meal = await logged(userId);
    const half: MealAnalysis = { ...meal.analysis, kcal: Math.round(meal.analysis.kcal / 2) };
    const out = await applyCorrection(deps, userId, meal.mealId, half);
    if (out.kind !== "updated") throw new Error("expected updated");
    expect(out.via).toBe("nl");
    expect(out.analysis.kcal).toBe(half.kcal);
    expect((await store.getMeal(userId, meal.mealId))!.corrected).toBe(true);
  });

  it("routes a correction from chat when a meal is in focus", async () => {
    const userId = await onboard();
    const meal = await logged(userId);
    const res = await handleText(deps, userId, { text: "half that", focusMealId: meal.mealId });
    expect(res.kind).toBe("updated");
    if (res.kind !== "updated") throw new Error("expected updated");
    expect(res.analysis.kcal).toBeLessThan(meal.analysis.kcal);
  });

  it("does not let a focusMealId reach another user's meal", async () => {
    const a = await onboard();
    const b = await onboard();
    const meal = await logged(a);
    // b names a's meal. It resolves to nothing, so no correction is available and the turn
    // degrades to an ordinary answer — a's row is untouched.
    const res = await handleText(deps, b, { text: "half that", focusMealId: meal.mealId });
    expect(res.kind).not.toBe("updated");
    expect((await store.getMeal(a, meal.mealId))!.kcal).toBe(meal.analysis.kcal);
  });
});

describe("chat", () => {
  it("answers a question from the diary without logging anything", async () => {
    const userId = await onboard();
    await logPhotoMeal(deps, userId, photo());
    const res = await handleText(deps, userId, { text: "how much protein have I had?" });
    expect(res.kind).toBe("answered");
    expect((await day(deps, userId))!.meals).toHaveLength(1);
  });

  it("proposes a text meal instead of writing it, and names the date", async () => {
    const userId = await onboard();
    const res = await handleText(deps, userId, { text: "two eggs and toast" });
    expect(res.kind).toBe("proposed");
    if (res.kind !== "proposed") throw new Error("expected proposed");
    expect(res.date).toBe(localDate("Europe/Berlin"));
    expect((await day(deps, userId))!.meals).toHaveLength(0);
  });

  it("computes the proposal's verdicts rather than shipping the analyzer's output raw", async () => {
    const userId = await onboard();
    const res = await handleText(deps, userId, { text: "two eggs and toast" });
    if (res.kind !== "proposed") throw new Error("expected proposed");

    // An analyzer is NEVER asked for verdicts, so its output has no such field. Every other result
    // repairs that before it reaches a client — `logged` and `updated` overwrite it, the day view
    // reads it from a column that defaults to `{}`. `proposed` did not, and it is the ONE analysis
    // the app renders straight from the model. `VerdictRow` then indexed into `undefined`, which in
    // a Release build is a process abort rather than a red box.
    expect(res.analysis.verdicts).toBeDefined();
    expect(res.analysis.verdicts.weight).toBeDefined();

    // The stored pending carries them too, so the card the user confirms describes the same
    // judgement as the card they were shown.
    const confirmed = await confirmPendingMeal(deps, userId, res.pendingId);
    if (confirmed.kind !== "logged") throw new Error("expected logged");
    expect(confirmed.analysis.verdicts.weight).toBeDefined();
  });

  it("writes only on confirm, and confirm is idempotent-safe", async () => {
    const userId = await onboard();
    const res = await handleText(deps, userId, { text: "two eggs and toast" });
    if (res.kind !== "proposed") throw new Error("expected proposed");

    const ok = await confirmPendingMeal(deps, userId, res.pendingId);
    expect(ok.kind).toBe("logged");
    expect((await day(deps, userId))!.meals).toHaveLength(1);

    // The pending is dropped with the write, so a duplicate confirm cannot log the meal twice.
    const again = await confirmPendingMeal(deps, userId, res.pendingId);
    expect(again.kind).toBe("expired");
    expect((await day(deps, userId))!.meals).toHaveLength(1);
  });

  it("cancels a proposal without writing", async () => {
    const userId = await onboard();
    const res = await handleText(deps, userId, { text: "a bowl of pasta" });
    if (res.kind !== "proposed") throw new Error("expected proposed");
    expect((await cancelPendingMeal(deps, userId, res.pendingId)).kind).toBe("cancelled");
    expect((await day(deps, userId))!.meals).toHaveLength(0);
  });

  it("cannot confirm another user's pending meal", async () => {
    const a = await onboard();
    const b = await onboard();
    const res = await handleText(deps, a, { text: "a bowl of pasta" });
    if (res.kind !== "proposed") throw new Error("expected proposed");
    expect((await confirmPendingMeal(deps, b, res.pendingId)).kind).toBe("expired");
  });

  it("back-dates a proposal when the user said yesterday", async () => {
    const userId = await onboard();
    const res = await handleText(deps, userId, { text: "I had ramen yesterday" });
    if (res.kind !== "proposed") throw new Error("expected proposed");
    expect(res.date).not.toBe(localDate("Europe/Berlin"));
  });

  it("moves a logged meal to another day, macros untouched", async () => {
    const userId = await onboard();
    const meal = await logPhotoMeal(deps, userId, photo());
    if (meal.kind !== "logged") throw new Error("expected logged");
    const res = await handleText(deps, userId, { text: "move to yesterday", focusMealId: meal.mealId });
    expect(res.kind).toBe("redated");
    if (res.kind !== "redated") throw new Error("expected redated");
    expect(res.analysis.kcal).toBe(meal.analysis.kcal);
    expect((await day(deps, userId))!.meals).toHaveLength(0); // no longer today's
  });

  it("charges chat against the global budget but not the per-user photo allowance", async () => {
    const userId = await onboard();
    const d = makeDeps({ userDailyPhotoCap: 1, globalDailyAnalysisCap: 100 });
    await handleText(d, userId, { text: "how am I doing?" });
    await handleText(d, userId, { text: "and yesterday?" });
    // Chat did not eat the photo the user could still log.
    expect((await logPhotoMeal(d, userId, photo())).kind).toBe("logged");
  });
});

describe("diary", () => {
  it("sums a day and reports the user's targets alongside", async () => {
    const userId = await onboard();
    await logPhotoMeal(deps, userId, photo(8));
    await logPhotoMeal(deps, userId, photo(16));
    const view = (await day(deps, userId))!;
    expect(view.meals).toHaveLength(2);
    expect(view.totals.kcal).toBe(view.meals.reduce((n, m) => n + m.kcal, 0));
    expect(view.targets.kcal).toBeGreaterThan(0);
  });

  it("never shows one user another's meals", async () => {
    const a = await onboard();
    const b = await onboard();
    await logPhotoMeal(deps, a, photo());
    expect((await day(deps, b))!.meals).toHaveLength(0);
  });

  it("returns per-day sums for the week", async () => {
    const userId = await onboard();
    await logPhotoMeal(deps, userId, photo());
    const days = (await week(deps, userId, 7))!;
    expect(days).toHaveLength(1);
    expect(days[0]!.date).toBe(localDate("Europe/Berlin"));
  });
});

describe("erasure", () => {
  it("deletes everything, not a flag", async () => {
    const userId = await onboard();
    await logPhotoMeal(deps, userId, photo());
    await store.deleteUser(userId);
    expect(await store.getProfile(userId)).toBeNull();
    expect(await store.mealsForDate(userId, localDate("Europe/Berlin"))).toHaveLength(0);
  });
});
