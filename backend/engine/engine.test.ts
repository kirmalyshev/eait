import { beforeEach, describe, expect, it, spyOn } from "bun:test";
import { DEFAULT_ONBOARDING_CONTENT, MAX_APPEND_LINES_PER_BATCH, MEET_GABIE, MAX_PROFILE_TEXT, MAX_USER_LINE, RESTRICTION_TAGS, explainTargets, isMeal, proposalLive, runningLine, type MealAnalysis, type MealLogged, type MealUpdated, type PhotoEvent } from "@eait/shared";
import { configDefaults, type Config } from "../config.ts";
import { demoPorts } from "../llm/demo.ts";
import type { AnalyzedMeal, LlmPorts, TextInput } from "../llm/port.ts";
import { GatewayRefusal } from "../llm/port.ts";
import { memoryStore } from "../store.memory.ts";
import type { Store } from "../store.ts";
import { dateMinus, localDate } from "@eait/shared";
import { fakeMailer } from "../mail/fake.ts";
import { fakePush } from "../push/fake.ts";
import { remember } from "./chat.ts";
import { charge } from "./caps.ts";
import {
  appendLines, applyCorrection, attachPhotos, cancelPendingMeal, chatHistory, confirmPendingMeal, day, editMeal, handleText,
  logPhotoMeal, patchProfile, profileView, reanalyzeMeal, stepApplies, week, type EngineDeps,
} from "./index.ts";

const CONFIG: Config = {
  ...configDefaults(),
  port: 0, databaseUrl: "memory://test",
  llmProvider: "demo", llmModel: "demo", llmApiKey: "unused",
  // Most tests chain several analyses on one account; the sample rule has its own describe.
  freeAnalyses: 100, globalDailyAnalysisCap: 10,
  appleAudiences: ["com.eait.fit.ios"], googleAudiences: ["test.apps.googleusercontent.com"],
};

let store: Store;
let deps: EngineDeps;

function makeDeps(over: Partial<Config> = {}, llm: LlmPorts = demoPorts()): EngineDeps {
  return { store, config: { ...CONFIG, ...over }, llm, mailer: fakeMailer(), push: fakePush() };
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

const photo = (bytes = 8) => ({ images: [async () => jpeg(bytes)] });
/** JPEG by magic bytes, which is what the engine now insists on. */
const jpeg = (bytes = 8) => { const b = new Uint8Array(2 + bytes).fill(1); b[0] = 0xff; b[1] = 0xd8; return b; };
/** `ftypheic` — what an iPhone set to High Efficiency captures. */
const heic = () => new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63, 1, 1, 1, 1]);

/** A live entitlement, as the RevenueCat webhook would have written it. Each call is a newer event. */
let eventSeq = 0;
async function entitle(userId: string, expiresInMs = 86_400_000): Promise<void> {
  await store.putEntitlement(userId, {
    expiresAt: new Date(Date.now() + expiresInMs).toISOString(),
    productId: "com.eait.fit.ios.yearly",
    eventAt: new Date(Date.now() + ++eventSeq * 1000).toISOString(),
  });
}

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

  it("writes each answer, so the question to ask next is derived from the fields", async () => {
    // The conversation picks its next question with `resumeAt` over the PROFILE — never a counter —
    // so what the engine owes it is that a patch lands on exactly the fields it names.
    const { userId } = await store.upsertDeviceUser("e".repeat(40), "en");
    const blank = (await store.getProfile(userId))!;
    expect(blank.goal).toBeNull();

    await patchProfile(deps, userId, { goal: "lose" });
    expect((await store.getProfile(userId))!.goal).toBe("lose");
    expect((await store.getProfile(userId))!.sex).toBeNull();

    await patchProfile(deps, userId, { sex: "male", birth_year: 1988, height_cm: 180 });
    const p = (await store.getProfile(userId))!;
    expect([p.sex, p.birth_year, p.height_cm]).toEqual(["male", 1988, 180]);
    expect(p.weight_kg).toBeNull();
  });

  it("leaves target weight and pace unset for a maintaining user", async () => {
    const { userId } = await store.upsertDeviceUser("f".repeat(40), "en");
    await patchProfile(deps, userId, {
      goal: "maintain", sex: "male", birth_year: 1988, height_cm: 180, weight_kg: 80,
      activity: "light",
    });
    // `stepApplies` is what drops both questions from the conversation; nothing writes them here.
    const p = (await store.getProfile(userId))!;
    expect(stepApplies("target_weight_kg", p)).toBe(false);
    expect(stepApplies("pace", p)).toBe(false);
    expect(p.target_weight_kg).toBeNull();
    expect(p.pace).toBeNull();
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

  it("derives the year from a typed age with the server's own clock", async () => {
    // The device's clock can sit across a UTC year boundary from the server's; the server is the
    // authority, so the app sends the AGE and the subtraction happens here.
    const { userId } = await store.upsertDeviceUser("j".repeat(40), "en");
    const out = await patchProfile(deps, userId, { age: 36 });
    expect(out!.ok).toBe(true);
    expect((await store.getProfile(userId))!.birth_year).toBe(new Date().getUTCFullYear() - 36);
    const under = await patchProfile(deps, userId, { age: 15 });
    expect(under!.ok).toBe(false);
    if (!under!.ok) expect(under!.rejected.reason).toBe("age-below-minimum");
    const junk = await patchProfile(deps, userId, { age: 36.5 });
    expect(junk!.ok).toBe(false);
  });

  it("drops restriction tags outside the closed vocabulary instead of 422-ing", async () => {
    const userId = await onboard({ restrictions: ["ldl", "wizardry", "kidneys"] });
    expect((await store.getProfile(userId))!.restrictions).toEqual(RESTRICTION_TAGS.filter((t) => t === "ldl" || t === "kidneys"));
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

  it("refuses HEIC before the sample is charged, so the next JPEG still goes through", async () => {
    const userId = await onboard();
    const d = makeDeps({ freeAnalyses: 1 });
    expect((await logPhotoMeal(d, userId, { images: [async () => heic()] })).kind).toBe("unsupported-image");
    expect((await logPhotoMeal(d, userId, { images: [async () => jpeg(), async () => heic()] })).kind).toBe("unsupported-image");
    expect((await logPhotoMeal(d, userId, photo())).kind).toBe("logged");
  });

  it("charges the cap even when the model call fails", async () => {
    // A cap that only counts successes is a cap a retry loop walks straight through.
    const llm: LlmPorts = {
      ...demoPorts(),
      analyzePhoto: async () => { throw new Error("nope"); },
    };
    const d = makeDeps({ freeAnalyses: 1 }, llm);
    const userId = await onboard();
    await logPhotoMeal(d, userId, photo());
    expect(await store.countUserPhotos(userId, localDate("Europe/Berlin"))).toBe(1);
    // The sample too: a failed first call is the sample spent, not a free retry.
    expect((await logPhotoMeal(makeDeps({ freeAnalyses: 1 }), userId, photo())).kind).toBe("subscription-required");
  });

  it("never reads image bytes when the cap already refused", async () => {
    const userId = await onboard();
    const d = makeDeps({ freeAnalyses: 1 });
    await logPhotoMeal(d, userId, photo());

    let read = false;
    const res = await logPhotoMeal(d, userId, {
      images: [async () => { read = true; return new Uint8Array(4); }],
    });
    expect(res.kind).toBe("subscription-required");
    expect(read).toBe(false); // thunks exist precisely for this
  });

  it("refuses an entitled account only at the global cap", async () => {
    const userId = await onboard();
    await entitle(userId);
    const d = makeDeps({ paidDailyPhotoCap: 100, globalDailyAnalysisCap: 1 });
    await logPhotoMeal(d, userId, photo());
    expect(await logPhotoMeal(d, userId, photo())).toEqual({ kind: "cap-exceeded", scope: "global" });
  });

  it("gives an entitled account the paid daily cap, photos only", async () => {
    const userId = await onboard();
    await entitle(userId);
    const d = makeDeps({ paidDailyPhotoCap: 2, globalDailyAnalysisCap: 100 });
    await logPhotoMeal(d, userId, photo());
    await logPhotoMeal(d, userId, photo());
    expect(await logPhotoMeal(d, userId, photo())).toEqual({ kind: "cap-exceeded", scope: "user" });
    // A question is not a photo: the paid cap is a photo allowance, chat still answers.
    expect((await handleText(d, userId, { text: "how much protein so far?" })).kind).not.toBe("cap-exceeded");
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

// ONE closed question, and only AFTER the estimate is on screen. The model is never allowed to
// withhold the numbers for something it would rather know first, so this is a continuation of a
// card the user already has — which is also why every condition below is about whether asking
// could possibly help, not about whether the model wanted to.
describe("the question after the card", () => {
  const QUESTION = { text: "Cooked in oil, or dry?", options: ["In oil", "Dry"] };

  /** An analyzer that asks on every plate. `over` bends one field of the answer. */
  const asks = (over: Partial<AnalyzedMeal> = {}): LlmPorts => ({
    ...demoPorts(),
    analyzePhoto: async (i) => ({
      ...(await demoPorts().analyzePhoto(i)), confidence: "low", question: QUESTION, ...over,
    }),
  });

  /** Log one photo past the account's first, and hand back what the second answered. */
  async function second(d: EngineDeps, userId: string) {
    await logPhotoMeal(d, userId, photo(4));
    const res = await logPhotoMeal(d, userId, photo(8));
    if (!isMeal(res) || res.kind !== "logged") throw new Error(`expected logged, got ${res.kind}`);
    return res;
  }

  it("asks it, stores it on the meal, and puts it in the thread under the card", async () => {
    const userId = await onboard();
    const d = makeDeps({}, asks());
    const res = await second(d, userId);
    expect(res.question).toEqual(QUESTION);
    // On the ROW, because the answer arrives as a separate turn and has to find the question again.
    expect((await store.getMeal(userId, res.mealId))!.question).toEqual(QUESTION);
    // Last in the thread, after this meal's card: the estimate is delivered before it is queried.
    // The day's standing sits between them (#306) — this is a second meal, so it earns that line,
    // and it is part of delivering the estimate rather than part of querying it.
    const { entries } = await chatHistory(d, userId, { limit: 10 });
    const last = entries[entries.length - 1]!;
    const standing = entries[entries.length - 2]!;
    const beforeIt = entries[entries.length - 3]!;
    expect(last).toMatchObject({ role: "assistant", kind: "text", text: QUESTION.text, speaker: null });
    expect(standing).toMatchObject({ role: "assistant", kind: "text" });
    expect(standing.kind === "text" ? standing.text : "").toMatch(/ left today, /);
    expect(beforeIt).toMatchObject({ role: "assistant", kind: "meal", mealId: res.mealId });
  });

  it("says nothing on the account's first meal", async () => {
    // The first card is the introduction — copy.md gives it Spud's verdict, and a question on top
    // of that is an interrogation before the product has shown what it does.
    const userId = await onboard();
    const d = makeDeps({}, asks());
    const res = await logPhotoMeal(d, userId, photo());
    if (!isMeal(res) || res.kind !== "logged") throw new Error("expected logged");
    expect(res.question).toBeUndefined();
    expect((await store.getMeal(userId, res.mealId))!.question).toBeNull();
    expect((await chatHistory(d, userId, { limit: 10 })).entries.some((e) => "text" in e && e.text === QUESTION.text)).toBe(false);
  });

  it("never asks somebody who could not afford to answer", async () => {
    // A reply is a billed correction. With the sample spent by this very photo, chips would open
    // onto a 402 — a question Spud asked and then refused to hear the answer to.
    const userId = await onboard();
    const res = await second(makeDeps({ freeAnalyses: 2 }, asks()), userId);
    expect(res.question).toBeUndefined();
  });

  it("asks only about a plate it is unsure of", async () => {
    for (const confidence of ["medium", "high"] as const) {
      const userId = await onboard();
      const res = await second(makeDeps({}, asks({ confidence })), userId);
      expect(res.question).toBeUndefined();
    }
  });

  it("normalizes the question and its options before either becomes a line", async () => {
    // Model prose, on its way into the thread and back out into a later prompt. Same sink as every
    // other free text this app puts in front of a model.
    const userId = await onboard();
    const llm = asks({ question: { text: `Two "plates"?\nOr one?`, options: [`  In "oil" `, "Dry"] } });
    const res = await second(makeDeps({}, llm), userId);
    expect(res.question).toEqual({ text: "Two 'plates'? Or one?", options: ["In 'oil'", "Dry"] });
  });

  /** An analyzer that asks, plus a router that answers whatever it is given and keeps its input. */
  function watched(seen: TextInput[]): LlmPorts {
    return {
      ...asks(),
      routeText: async (i) => { seen.push(i); return { intent: "answer", text: "Noted." }; },
    };
  }

  it("frames the turn that answers it — and only that turn", async () => {
    // THE FRAMING IS THE DANGEROUS HALF. "The user's message is the answer; treat it as a
    // correction" standing over every later message would turn "how much protein have I had
    // today?" into a silent edit of their lunch. A chip sends its option verbatim, so the message
    // being one of the options IS the test — case and stray whitespace aside.
    const userId = await onboard();
    const seen: TextInput[] = [];
    const d = makeDeps({}, watched(seen));
    const res = await second(d, userId);
    await handleText(d, userId, { text: "how much protein have I had today?", focusMealId: res.mealId });
    expect(seen[0]!.question).toBeUndefined();
    // Unanswered, so it still stands: a message that was not the answer must not spend it either.
    expect((await store.getMeal(userId, res.mealId))!.question).toEqual(QUESTION);

    await handleText(d, userId, { text: "  IN   OIL ", focusMealId: res.mealId });
    expect(seen[1]!.question).toEqual(QUESTION);
  });

  it("spends the question on the framed turn, whatever the router made of it", async () => {
    // The intent must not decide this. `editMeal` clears it on a correction, but a chip answer the
    // router read as a plain answer would otherwise leave the framing standing for good.
    const userId = await onboard();
    const seen: TextInput[] = [];
    const d = makeDeps({}, watched(seen));
    const res = await second(d, userId);
    expect((await handleText(d, userId, { text: "Dry", focusMealId: res.mealId })).kind).toBe("answered");
    expect((await store.getMeal(userId, res.mealId))!.question).toBeNull();
    // And the turn after it is an ordinary turn again.
    await handleText(d, userId, { text: "In oil", focusMealId: res.mealId });
    expect(seen[1]!.question).toBeUndefined();
  });

  it("clears the question once a correction lands, so it is asked exactly once", async () => {
    const userId = await onboard();
    const d = makeDeps({}, asks());
    const res = await second(d, userId);
    // The demo router reads "half" as a correction, which is `applyCorrection` — the same write a
    // manual edit makes, which is why one `question: null` in `editMeal` covers both. Not an
    // option, so nothing framed it; the write that changed the numbers is what spent it.
    expect((await handleText(d, userId, { text: "half of that", focusMealId: res.mealId })).kind).toBe("updated");
    expect((await store.getMeal(userId, res.mealId))!.question).toBeNull();
  });
});

// No free tier. An account gets ONE analysis — photo, library or typed — and every later one is
// refused until the RevenueCat webhook has written an entitlement. The sheet in the app renders
// this refusal; it never decides it.
describe("the sample", () => {
  let one: EngineDeps;
  beforeEach(() => { one = makeDeps({ freeAnalyses: 1 }); });

  it("refuses the second analysis of an unentitled account, photo and typed alike", async () => {
    const userId = await onboard();
    expect((await logPhotoMeal(one, userId, photo())).kind).toBe("logged");
    expect(await logPhotoMeal(one, userId, photo())).toEqual({ kind: "subscription-required" });
    expect(await handleText(one, userId, { text: "chicken rice bowl" })).toEqual({ kind: "subscription-required" });
  });

  it("counts a typed meal as the sample", async () => {
    const userId = await onboard();
    expect((await handleText(one, userId, { text: "two eggs on toast" })).kind).not.toBe("subscription-required");
    expect(await logPhotoMeal(one, userId, photo())).toEqual({ kind: "subscription-required" });
  });

  it("takes the account's own sample size over the instance default, and reports the same number", async () => {
    const userId = await onboard();
    await store.setFreeAnalyses(userId, 1);
    const d = makeDeps({ freeAnalyses: 15 });
    expect((await profileView(d, userId))!.limits.sampleRemaining).toBe(1);
    expect((await logPhotoMeal(d, userId, photo())).kind).toBe("logged");
    expect(await logPhotoMeal(d, userId, photo())).toEqual({ kind: "subscription-required" });
    expect((await profileView(d, userId))!.limits).toMatchObject({ sampleUsed: true, sampleRemaining: 0 });
  });

  it("is sized by config, so a demo instance can switch it off without a second code path", async () => {
    const userId = await onboard();
    const d = makeDeps({ freeAnalyses: 3 });
    for (let i = 0; i < 3; i++) expect((await logPhotoMeal(d, userId, photo())).kind).toBe("logged");
    expect(await logPhotoMeal(d, userId, photo())).toEqual({ kind: "subscription-required" });
  });

  it("opens the account once an entitlement is written, and closes it again when it lapses", async () => {
    const userId = await onboard();
    await logPhotoMeal(one, userId, photo());
    await entitle(userId);
    expect((await logPhotoMeal(one, userId, photo())).kind).toBe("logged");
    await entitle(userId, -1000);
    expect(await logPhotoMeal(one, userId, photo())).toEqual({ kind: "subscription-required" });
  });

  // Issue #32: this happened, in production, to the first real user — an expired OpenRouter balance
  // answered 402 seconds after they finished onboarding, and the account was paywalled forever
  // having never seen one analysis. The sample IS the funnel: there is no free tier, so an upstream
  // outage otherwise converts every account created during it into permanent churn.
  it("gives the analysis back when the gateway refused before generating anything", async () => {
    const refused = makeDeps({ freeAnalyses: 1 }, {
      ...demoPorts(),
      analyzePhoto: async () => { throw new GatewayRefusal(402, "llm http 402: out of credits"); },
      routeText: async () => { throw new GatewayRefusal(503, "llm http 503: no provider"); },
    });
    const userId = await onboard();
    expect((await logPhotoMeal(refused, userId, photo())).kind).toBe("analysis-failed");
    expect((await handleText(refused, userId, { text: "two eggs on toast" })).kind).toBe("analysis-failed");
    // Nothing spent, by either route, so the app shows "try again" rather than the paywall.
    expect((await profileView(one, userId))!.limits.sampleUsed).toBe(false);
    // The count the app words its sentences from. One read of `countUserAnalyses` produces both,
    // so "spent" can never render beside "1 left".
    expect((await profileView(one, userId))!.limits.sampleRemaining).toBe(1);
    // And the sample is still there to be spent on an analysis that works.
    expect((await logPhotoMeal(one, userId, photo())).kind).toBe("logged");
    expect((await profileView(one, userId))!.limits.sampleUsed).toBe(true);
  });

  it("still words the failure when the refund itself cannot be written", async () => {
    // The refund runs inside the catch that turns a failed analysis into a refusal the screen can
    // word. A store that cannot delete must not escalate that into a 500 — the app would show
    // "couldn't reach eait" over an upstream that answered — and must not eat the log line either.
    const brokenStore: Store = {
      ...store,
      undoAnalysis: async () => { throw new Error("delete failed"); },
    };
    const refused: EngineDeps = {
      ...makeDeps({ freeAnalyses: 1 }, {
        ...demoPorts(),
        analyzePhoto: async () => { throw new GatewayRefusal(402, "llm http 402: out of credits"); },
      }),
      store: brokenStore,
    };
    const userId = await onboard();
    expect((await logPhotoMeal(refused, userId, photo())).kind).toBe("analysis-failed");
    // Nothing was given back, so the charge stands — the safe direction when the store is the thing
    // that is broken.
    expect((await profileView(one, userId))!.limits.sampleUsed).toBe(true);
  });

  it("tells the app whether the sample is spent, beside the entitlement", async () => {
    const userId = await onboard();
    expect((await profileView(one, userId))!.limits.sampleUsed).toBe(false);
    await handleText(one, userId, { text: "an apple" });
    expect((await profileView(one, userId))!.limits.sampleUsed).toBe(true);
    // Still true after subscribing: the app pairs it with `entitlement.active` to decide the sheet.
    await entitle(userId);
    const view = (await profileView(one, userId))!;
    expect(view.limits.sampleUsed).toBe(true);
    expect(view.limits.dailyPhotoCap).toBe(one.config.paidDailyPhotoCap);
  });
});

describe("profile free text", () => {
  it("refuses the medical free text past its bound, on the server too", async () => {
    const userId = await onboard();
    const out = await patchProfile(deps, userId, { medical_limitations: "x".repeat(MAX_PROFILE_TEXT + 1) });
    expect(out && !out.ok && out.rejected.field).toBe("medical_limitations");
    const ok = await patchProfile(deps, userId, { medical_limitations: "x".repeat(MAX_PROFILE_TEXT) });
    expect(ok && ok.ok).toBe(true);
  });

  it("refuses a non-string in the medical free text: a body is a cast, not a validation", async () => {
    const userId = await onboard();
    const shaped = await patchProfile(deps, userId, { medical_limitations: ["x".repeat(5000)] as unknown as string });
    expect(shaped && !shaped.ok && shaped.rejected.field).toBe("medical_limitations");
    const cleared = await patchProfile(deps, userId, { medical_limitations: null });
    expect(cleared && cleared.ok).toBe(true);
  });

  it("refuses a non-number where a number belongs, and a non-array of restrictions", async () => {
    const userId = await onboard();
    const field = async (req: Record<string, unknown>) => {
      const out = await patchProfile(deps, userId, req as never);
      return out && !out.ok ? out.rejected.field : "accepted";
    };
    // NaN passes both sides of a range check; these must be refused, not stored or thrown on.
    expect(await field({ height_cm: "abc" })).toBe("height_cm");
    expect(await field({ target_weight_kg: {} })).toBe("target_weight_kg");
    expect(await field({ country: 5 })).toBe("country");
    expect(await field({ country: "x".repeat(65) })).toBe("country");
    expect(await field({ restrictions: "vegan" })).toBe("restrictions");
  });

  it("stores restrictions as the closed vocabulary's subset: deduped, canonical order, bounded", async () => {
    const userId = await onboard({ restrictions: ["kidneys", "ldl", "kidneys", ...Array.from({ length: 1000 }, () => "ldl")] });
    expect((await store.getProfile(userId))!.restrictions).toEqual(RESTRICTION_TAGS.filter((t) => t === "ldl" || t === "kidneys"));
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

// The items are the working the model showed. A total that disagrees loudly with them is a card
// whose rows add up to one number under a header saying another — and the diary agrees with the
// header, so the whole day is wrong from a plate the user could see was right.
describe("reconciling what the model answered", () => {
  /** Itemised correctly, then totalled as something else. The rows come to 557 kcal. */
  const DISAGREEING: AnalyzedMeal = {
    isFood: true,
    items: [
      { name: "Basmati rice", grams: 200, kcal: 260, protein_g: 5, carbs_g: 56, fat_g: 0.6, kcal_per_100g: 130 },
      { name: "Grilled chicken", grams: 180, kcal: 297, protein_g: 56, carbs_g: 0, fat_g: 6.5, kcal_per_100g: 165 },
    ],
    kcal: 1100, protein_g: 90, carbs_g: 120, fat_g: 40,
    satfat_g: 4, fiber_g: 3, sugar_g: 2, sodium_mg: 500,
    confidence: "high", notes: "",
  };

  it("stores a photo meal at the sum of its items, and says it is less sure", async () => {
    const llm: LlmPorts = { ...demoPorts(), analyzePhoto: async () => DISAGREEING };
    const userId = await onboard();
    const res = await logPhotoMeal(makeDeps({}, llm), userId, photo());
    if (res.kind !== "logged") throw new Error("expected logged");
    expect(res.analysis.kcal).toBe(557);
    expect(res.analysis.protein_g).toBe(61);
    // The row the diary reads, not just the one the camera drew.
    expect((await store.getMeal(userId, res.mealId))!.kcal).toBe(557);
    expect(res.analysis.confidence).toBe("medium");
  });

  it("proposes a typed meal at the sum of its items", async () => {
    const llm: LlmPorts = {
      ...demoPorts(),
      routeText: async () => ({ intent: "meal", analysis: DISAGREEING, dayOffset: 0 }),
    };
    const userId = await onboard();
    const res = await handleText(makeDeps({}, llm), userId, { text: "rice and chicken" });
    if (res.kind !== "proposed") throw new Error("expected proposed");
    expect(res.analysis.kcal).toBe(557);
  });

  it("leaves a demo correction alone when its items carry no numbers to sum", async () => {
    // `--demo`'s correction maps over the STORED items, so an item that never carried a kcal comes
    // back without one. Summed as zero, halving a 320 kcal soup would delete its calories instead.
    const bare: LlmPorts = {
      ...demoPorts(),
      analyzePhoto: async () => ({ ...DISAGREEING, items: [{ name: "Soup", grams: 400 }], kcal: 320 }),
    };
    const userId = await onboard();
    const first = await logPhotoMeal(makeDeps({}, bare), userId, photo());
    if (first.kind !== "logged") throw new Error("expected logged");
    expect(first.analysis.kcal).toBe(320);

    const res = await handleText(deps, userId, { text: "half that", focusMealId: first.mealId });
    if (res.kind !== "updated") throw new Error("expected updated");
    expect(res.analysis.kcal).toBe(160);
  });

  it("applies a correction at the sum of its items", async () => {
    const userId = await onboard();
    const first = await logPhotoMeal(deps, userId, photo());
    if (first.kind !== "logged") throw new Error("expected logged");
    const llm: LlmPorts = {
      ...demoPorts(),
      routeText: async () => ({ intent: "correction", analysis: DISAGREEING }),
    };
    const res = await handleText(makeDeps({}, llm), userId, { text: "half that", focusMealId: first.mealId });
    if (res.kind !== "updated") throw new Error("expected updated");
    expect(res.analysis.kcal).toBe(557);
    expect((await store.getMeal(userId, first.mealId))!.kcal).toBe(557);
  });
});

// The repertoire is an IDENTIFICATION prior — the twenty things this person actually eats, handed
// to the model so "rice" can become "the bulgur he has four times a week".
describe("the repertoire", () => {
  const FATTY: AnalyzedMeal = {
    isFood: true,
    items: [
      { name: "Basmati rice", name_en: "basmati rice", grams: 200, kcal: 260, protein_g: 5, carbs_g: 56, fat_g: 0.6, kcal_per_100g: 130 },
      { name: "Olive oil (cooking)", name_en: "cooking oil", grams: 10, kcal: 88, protein_g: 0, carbs_g: 0, fat_g: 10, kcal_per_100g: 884, role: "cooking-fat" },
    ],
    kcal: 348, protein_g: 5, carbs_g: 56, fat_g: 10.6,
    satfat_g: 2, fiber_g: 1, sugar_g: 1, sodium_mg: 200,
    confidence: "high", notes: "",
  };

  it("never offers cooking fat back as something this person eats", async () => {
    // Fat inferred from a sheen is in every meal by construction and in none of them because the
    // user chose it. Fed back as a frequent food it becomes the most-eaten thing on the list, and
    // the prior starts arguing for oil on plates that have none.
    const userId = await onboard();
    await logPhotoMeal(makeDeps({}, { ...demoPorts(), analyzePhoto: async () => FATTY }), userId, photo());

    let seen: readonly string[] | undefined;
    const spy: LlmPorts = {
      ...demoPorts(),
      analyzePhoto: async (i) => { seen = i.repertoire; return FATTY; },
    };
    await logPhotoMeal(makeDeps({}, spy), userId, photo(9));
    expect(seen).toContain("basmati rice");
    expect(seen).not.toContain("cooking oil");
  });
});

// A window under a constant named N must be N days long, and nothing asserted that until now —
// which is exactly how `CONTEXT_DAYS = 7` came to produce eight and `buildRepertoire`'s thirty to
// produce thirty-one. Both feed a prompt: the router's and coach's context, and the analyzer's
// identification prior. The assertion is on the LENGTH rather than on the expression, because the
// expression is the thing that was wrong.
describe("the windows a prompt sees are as long as their constants say", () => {
  /** Days from `since` to `today` inclusive — what "a seven-day window" means to anyone reading it. */
  function windowDays(since: string, today: string): number {
    for (let n = 1; n <= 400; n++) if (dateMinus(today, n - 1) === since) return n;
    throw new Error(`${since} is not within 400 days of ${today}`);
  }

  /** Every `since` the engine asks the store for, in order. */
  function watchTotalsSince(): string[] {
    const seen: string[] = [];
    const real = store.totalsSince.bind(store);
    store.totalsSince = async (userId, since) => { seen.push(since); return real(userId, since); };
    return seen;
  }

  it("hands the router and the coach seven days of context, not eight", async () => {
    const userId = await onboard();
    const seen = watchTotalsSince();
    await handleText(deps, userId, { text: "how much protein have I had today?" });
    expect(seen.length).toBe(1);
    expect(windowDays(seen[0]!, localDate(CONFIG.timezone))).toBe(7);
  });

  it("builds the repertoire from thirty days, not thirty-one", async () => {
    const userId = await onboard();
    const seen = watchTotalsSince();
    await logPhotoMeal(deps, userId, photo());
    expect(seen.length).toBe(1);
    expect(windowDays(seen[0]!, localDate(CONFIG.timezone))).toBe(30);
  });
});

// Every edit to an item's grams is a measurement: this person's portion against the model's first
// read of it. Recorded on the way past, summarised as a median, and handed back to the analyzer.
describe("the correction-learned portion prior", () => {
  const PLATE: AnalyzedMeal = {
    isFood: true,
    items: [
      { name: "Basmati rice", name_en: "basmati rice", grams: 100, kcal: 130, protein_g: 2.7, carbs_g: 28, fat_g: 0.3, kcal_per_100g: 130 },
      { name: "Olive oil (cooking)", name_en: "cooking oil", grams: 10, kcal: 88, protein_g: 0, carbs_g: 0, fat_g: 10, kcal_per_100g: 884, role: "cooking-fat" },
    ],
    kcal: 218, protein_g: 2.7, carbs_g: 28, fat_g: 10.3,
    satfat_g: 2, fiber_g: 1, sugar_g: 1, sodium_mg: 200,
    confidence: "high", notes: "",
  };
  const rice = PLATE.items[0]!;
  const oil = PLATE.items[1]!;

  /** That plate, logged. A fixed analysis, so the grams a correction is measured against are known. */
  async function plated(userId: string, bytes = 8) {
    const res = await logPhotoMeal(
      makeDeps({}, { ...demoPorts(), analyzePhoto: async () => PLATE }), userId, photo(bytes));
    if (res.kind !== "logged") throw new Error("expected logged");
    return res;
  }

  it("records the ratio for an item whose grams the user changed", async () => {
    const userId = await onboard();
    const meal = await plated(userId);
    await editMeal(deps, userId, meal.mealId, { items: [{ ...rice, grams: 150 }, oil] });
    // Read at minCount 1: the evidence bar belongs to the prior, not to the recording.
    expect(await store.portionPriors(userId, 1)).toEqual([{ name: "basmati rice", ratio: 1.5, n: 1 }]);
  });

  it("records the cooking fat the user took off, which is the rate worth watching", async () => {
    // Fat inferred from a sheen is the item most often wrong and the one a user is most likely to
    // zero. A prior that never learned that would keep adding it to plates that have none.
    const userId = await onboard();
    const meal = await plated(userId);
    await editMeal(deps, userId, meal.mealId, { items: [rice, { ...oil, grams: 0 }] });
    expect(await store.portionPriors(userId, 1)).toEqual([{ name: "cooking oil", ratio: 0, n: 1 }]);
  });

  it("matches on the display name when an item carries no canonical one", async () => {
    const userId = await onboard();
    const bare: AnalyzedMeal = {
      ...PLATE, items: [{ name: "Soup", grams: 400, kcal: 320, protein_g: 5, carbs_g: 30, fat_g: 10, kcal_per_100g: 80 }],
      kcal: 320, protein_g: 5, carbs_g: 30, fat_g: 10,
    };
    const res = await logPhotoMeal(
      makeDeps({}, { ...demoPorts(), analyzePhoto: async () => bare }), userId, photo());
    if (res.kind !== "logged") throw new Error("expected logged");
    await editMeal(deps, userId, res.mealId, { items: [{ ...bare.items[0]!, grams: 200 }] });
    expect(await store.portionPriors(userId, 1)).toEqual([{ name: "Soup", ratio: 0.5, n: 1 }]);
  });

  it("records nothing for the items an edit left alone", async () => {
    const userId = await onboard();
    const meal = await plated(userId);
    await editMeal(deps, userId, meal.mealId, { items: [{ ...rice, grams: 150 }, oil] });
    expect(await store.portionPriors(userId, 1)).toHaveLength(1);
  });

  it("learns nothing from a natural-language correction, which is another estimator", async () => {
    // "no oil" comes back as a whole re-analysis from the TEXT model, against a plate the PHOTO
    // model read. The oil going to zero is the user; the rice moving 100 -> 115 g in the same reply
    // is one estimator disagreeing with the other, and stored as a portion it would teach the
    // prompt to move grams that nobody ever weighed.
    const userId = await onboard();
    const meal = await plated(userId);
    await applyCorrection(deps, userId, meal.mealId, {
      ...PLATE,
      items: [{ ...rice, grams: 115 }, { ...oil, grams: 0 }],
    });
    expect(await store.portionPriors(userId, 1)).toEqual([]);
    // The correction itself still landed.
    expect((await store.getMeal(userId, meal.mealId))!.items[0]!.grams).toBe(115);
  });

  it("records nothing when the edit does not touch the items at all", async () => {
    // The manual editor sends the numbers it changed. A kcal correction says nothing about a
    // portion, and counting it as one would teach the prior from an edit that never weighed
    // anything.
    const userId = await onboard();
    const meal = await plated(userId);
    await editMeal(deps, userId, meal.mealId, { kcal: 300 });
    expect(await store.portionPriors(userId, 1)).toEqual([]);
  });

  it("hands the analyzer what this person's corrections say, once there are enough of them", async () => {
    const userId = await onboard();
    let seen: readonly { name: string; ratio: number; n: number }[] | undefined;
    const spy: LlmPorts = {
      ...demoPorts(),
      analyzePhoto: async (i) => { seen = i.portionPriors; return PLATE; },
    };

    // Two corrections is not yet evidence, and the prompt says nothing about the food.
    for (const bytes of [1, 2]) {
      const meal = await plated(userId, bytes);
      await editMeal(deps, userId, meal.mealId, { items: [{ ...rice, grams: 150 }, oil] });
    }
    await logPhotoMeal(makeDeps({}, spy), userId, photo(3));
    expect(seen).toEqual([]);

    const third = await plated(userId, 4);
    await editMeal(deps, userId, third.mealId, { items: [{ ...rice, grams: 150 }, oil] });
    await logPhotoMeal(makeDeps({}, spy), userId, photo(5));
    expect(seen).toEqual([{ name: "basmati rice", ratio: 1.5, n: 3 }]);
  });

  it("still applies the correction when the measurement cannot be stored", async () => {
    // The edit is what the user asked for; the measurement is what we get out of it. Losing the
    // second must never cost the first.
    const userId = await onboard();
    const meal = await plated(userId);
    const failing = { ...store, recordPortionCorrections: async () => { throw new Error("boom"); } };

    const lines: string[] = [];
    const err = console.error;
    console.error = (...args: unknown[]) => { lines.push(args.join(" ")); };
    let out;
    try {
      out = await editMeal({ ...deps, store: failing }, userId, meal.mealId, {
        items: [{ ...rice, grams: 150 }, oil],
      });
    } finally {
      console.error = err;
    }
    expect(out.kind).toBe("updated");
    expect(lines.join("\n")).toContain("portion correction not recorded");
    expect((await store.getMeal(userId, meal.mealId))!.items[0]!.grams).toBe(150);
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

  it("tells the client when the estimate dies, so the card stops offering a button it cannot honour", async () => {
    // #367: the TTL is a limit the SERVER enforces, so the moment travels rather than being
    // compiled into both sides — the same rule `PairCodeResponse.expiresAt` states, and for the
    // same reason: a client carrying its own copy of the number eventually disagrees with the one
    // doing the refusing.
    const userId = await onboard();
    const before = Date.now();
    const res = await handleText(deps, userId, { text: "two eggs and toast" });
    if (res.kind !== "proposed") throw new Error("expected proposed");
    const at = Date.parse(res.expiresAt);
    expect(at).toBeGreaterThanOrEqual(before + deps.config.pendingTtlMs);
    expect(at).toBeLessThanOrEqual(Date.now() + deps.config.pendingTtlMs);
    expect(proposalLive(res.expiresAt, Date.now())).toBe(true);

    // And it is the configured moment, not a constant: the one the store was given to refuse by.
    const gone = await handleText(makeDeps({ pendingTtlMs: -1 }), userId, { text: "a banana" });
    if (gone.kind !== "proposed") throw new Error("expected proposed");
    expect(proposalLive(gone.expiresAt, Date.now())).toBe(false);
    expect((await confirmPendingMeal(deps, userId, gone.pendingId)).kind).toBe("expired");
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

    // The pending is dropped with the write, so a duplicate confirm cannot log the meal twice — it
    // answers with the meal already logged (the meal took the proposal's id), never "expired".
    const again = await confirmPendingMeal(deps, userId, res.pendingId);
    expect(again.kind).toBe("logged");
    if (again.kind === "logged") expect(again.mealId).toBe(res.pendingId);
    expect((await day(deps, userId))!.meals).toHaveLength(1);
  });

  it("attaches another angle of a meal already logged, without charging for it (#304)", async () => {
    // The pending screen's second photo cannot join the request that is already on the wire, so it
    // arrives after the card. Storing it costs nothing — the analyzer is not asked again — and the
    // numbers do not move under the user. Re-reading them is the meal screen's existing "Re-read",
    // which is charged, says so, and is the user's own deliberate tap.
    const userId = await onboard();
    const meal = await logPhotoMeal(deps, userId, photo());
    if (meal.kind !== "logged") throw new Error("expected logged");
    const spent = await store.countUserAnalyses(userId);

    const res = await attachPhotos(deps, userId, meal.mealId, [jpeg(9)]);
    expect(res).toEqual({ kind: "attached", mealId: meal.mealId, photos: 2 });
    expect((await store.getPhotos(userId, meal.mealId))).toHaveLength(2);
    // Not a single analysis more, and the meal's numbers are exactly what they were.
    expect(await store.countUserAnalyses(userId)).toBe(spent);
    const after = (await store.getMeal(userId, meal.mealId))!;
    expect(after.kcal).toBe(meal.analysis.kcal);
    expect(after.corrected).toBe(false);
  });

  it("refuses a photo that is not one, and never past the meal's limit", async () => {
    const userId = await onboard();
    const meal = await logPhotoMeal(deps, userId, photo());
    if (meal.kind !== "logged") throw new Error("expected logged");
    // The sniff that already guards the charge guards this too: a HEIC never reaches the store.
    expect((await attachPhotos(deps, userId, meal.mealId, [heic()])).kind).toBe("unsupported-image");
    expect(await store.getPhotos(userId, meal.mealId)).toHaveLength(1);
    // Counted against what is ALREADY stored, which is the whole reason the server decides it.
    const limit = deps.config.maxPhotosPerMeal;
    expect(await attachPhotos(deps, userId, meal.mealId, Array.from({ length: limit }, () => jpeg(9))))
      .toEqual({ kind: "too-many", limit });
    expect(await store.getPhotos(userId, meal.mealId)).toHaveLength(1);
  });

  it("cannot attach to another user's meal, or to one that is gone", async () => {
    const a = await onboard();
    const b = await onboard();
    const meal = await logPhotoMeal(deps, a, photo());
    if (meal.kind !== "logged") throw new Error("expected logged");
    // The scoping rule, asserted rather than assumed: another account's id resolves to nothing.
    expect(await attachPhotos(deps, b, meal.mealId, [jpeg(9)])).toEqual({ kind: "target-gone", on: "correction" });
    expect(await store.getPhotos(a, meal.mealId)).toHaveLength(1);
    expect(await attachPhotos(deps, a, "no-such-meal", [jpeg(9)])).toEqual({ kind: "target-gone", on: "correction" });
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
    await entitle(userId);
    const d = makeDeps({ paidDailyPhotoCap: 1, globalDailyAnalysisCap: 100 });
    await handleText(d, userId, { text: "how am I doing?" });
    await handleText(d, userId, { text: "and yesterday?" });
    // Chat did not eat the photo the user could still log.
    expect((await logPhotoMeal(d, userId, photo())).kind).toBe("logged");
  });
});

// The conversation is stored on the server. The Chat tab is its continuation — the onboarding's
// verdict, every question, every meal since, from any device — so the app never has a thread the
// server does not, and a reinstall does not open on an empty screen.
describe("the thread", () => {
  const thread = async (userId: string) => (await chatHistory(deps, userId, {})).entries;
  const text = (e: { kind: string }) => ("text" in e ? (e as { text: string | null }).text : null);

  it("keeps a question and its answer, oldest first", async () => {
    const userId = await onboard();
    await handleText(deps, userId, { text: "how much protein have I had?" });
    const t = await thread(userId);
    expect(t.map((e) => [e.role, e.kind])).toEqual([["user", "text"], ["assistant", "text"]]);
    expect(text(t[0]!)).toBe("how much protein have I had?");
    expect(text(t[1]!)!.length).toBeGreaterThan(0);
  });

  it("keeps a photo as a bubble without bytes, and its verdict as the meal itself", async () => {
    const userId = await onboard();
    const res = await logPhotoMeal(deps, userId, { ...photo(), caption: "with extra rice" });
    if (res.kind !== "logged") throw new Error("expected logged");
    const t = await thread(userId);
    expect(t[0]).toMatchObject({ role: "user", kind: "photo", text: "with extra rice" });
    expect(t[1]).toMatchObject({ role: "assistant", kind: "meal", event: "logged" });
    const card = t[1];
    if (!card || card.kind !== "meal") throw new Error("expected meal");
    expect(card.meal?.id).toBe(res.mealId);
    expect(card.meal?.kcal).toBe(res.analysis.kcal);
    expect(JSON.stringify(t)).not.toContain("image");
  });

  it("keeps the words when they are said, and the meal when it is confirmed — in that order", async () => {
    const userId = await onboard();
    const res = await handleText(deps, userId, { text: "two eggs and toast" });
    if (res.kind !== "proposed") throw new Error("expected proposed");
    expect((await thread(userId)).map((e) => [e.role, e.kind])).toEqual([["user", "text"]]);
    // A question asked while the card sits lands AFTER the words that produced the card.
    await handleText(deps, userId, { text: "how much protein today?" });
    await confirmPendingMeal(deps, userId, res.pendingId);
    const t = await thread(userId);
    expect(t.map((e) => [e.role, e.kind])).toEqual([
      ["user", "text"], ["user", "text"], ["assistant", "text"], ["assistant", "meal"], ["assistant", "text"], ["assistant", "text"], ["assistant", "text"],
    ]);
    expect(text(t[0]!)).toBe("two eggs and toast");
    expect(text(t[4]!)).toContain("Typed, not photographed");
    // The first verdict ends by introducing the coach, in Spud's voice, with his face.
    expect(t[6]).toMatchObject({ kind: "text", text: MEET_GABIE, speaker: null });
  });

  it("names its proposal on the user line, and a racing confirm answers with the meal the other one logged", async () => {
    const userId = await onboard();
    const res = await handleText(deps, userId, { text: "two eggs and toast" });
    if (res.kind !== "proposed") throw new Error("expected proposed");
    expect((await thread(userId))[0]).toMatchObject({ role: "user", pendingId: res.pendingId });
    // The card names its meal by id, beside the record: the id is what "was it logged" reads.
    await confirmPendingMeal(deps, userId, res.pendingId);
    expect((await thread(userId)).find((e) => e.kind === "meal")).toMatchObject({ mealId: res.pendingId });
    // A FRESH proposal whose insert reports "already there": the last guard on one id, two rows.
    const second = await handleText(deps, userId, { text: "a banana" });
    if (second.kind !== "proposed") throw new Error("expected proposed");
    const beaten: Store = { ...store, insertMeal: async () => false };
    const again = await confirmPendingMeal({ ...deps, store: beaten }, userId, second.pendingId);
    expect(again.kind).toBe("expired");
    expect((await thread(userId)).filter((e) => e.kind === "meal")).toHaveLength(1);
  });

  it("does not put a proposal back when the meal is already there and only the answer failed", async () => {
    // The restore is right for "nothing was written"; a meal that IS logged must not get a live
    // proposal again, or a later "no" would write "Dropped it." beside it.
    const userId = await onboard();
    const res = await handleText(deps, userId, { text: "two eggs and toast" });
    if (res.kind !== "proposed") throw new Error("expected proposed");
    const beaten: Store = {
      ...store,
      insertMeal: async () => false,
      getMeal: async () => { throw new Error("connection reset"); },
    };
    await expect(confirmPendingMeal({ ...deps, store: beaten }, userId, res.pendingId)).rejects.toThrow("connection reset");
    expect(await store.getPending(userId, res.pendingId)).toBeNull();
  });

  it("puts a claimed proposal back when its write fails, so the retry the screen offers can log it", async () => {
    const userId = await onboard();
    const res = await handleText(deps, userId, { text: "two eggs and toast" });
    if (res.kind !== "proposed") throw new Error("expected proposed");
    let once = true;
    const flaky: Store = {
      ...store,
      insertMeal: async (r) => { if (once) { once = false; throw new Error("connection reset"); } return store.insertMeal(r); },
    };
    await expect(confirmPendingMeal({ ...deps, store: flaky }, userId, res.pendingId)).rejects.toThrow("connection reset");
    const retry = await confirmPendingMeal(deps, userId, res.pendingId);
    expect(retry.kind).toBe("logged");
    expect((await day(deps, userId))!.meals).toHaveLength(1);
  });

  it("proposes a typed meal as a rough one: the portions are a guess, and the card says so", async () => {
    const userId = await onboard();
    const res = await handleText(deps, userId, { text: "two eggs and toast" });
    if (res.kind !== "proposed") throw new Error("expected proposed");
    expect(res.analysis.confidence).toBe("low");
  });

  it("confirms the same proposal twice without logging twice — a lost response is answered again", async () => {
    const userId = await onboard();
    const res = await handleText(deps, userId, { text: "two eggs and toast" });
    if (res.kind !== "proposed") throw new Error("expected proposed");
    const first = await confirmPendingMeal(deps, userId, res.pendingId);
    const second = await confirmPendingMeal(deps, userId, res.pendingId);
    if (first.kind !== "logged" || second.kind !== "logged") throw new Error("expected logged twice");
    expect(second.mealId).toBe(first.mealId);
    expect((await day(deps, userId))!.meals).toHaveLength(1);
    // Nothing new in the thread either: the second answer is a repeat, not a turn.
    expect((await thread(userId)).filter((e) => e.kind === "meal")).toHaveLength(1);
  });

  it("answers a 'no' after a lost confirm response with the meal it logged, not 'expired'", async () => {
    const userId = await onboard();
    const res = await handleText(deps, userId, { text: "two eggs and toast" });
    if (res.kind !== "proposed") throw new Error("expected proposed");
    const logged = await confirmPendingMeal(deps, userId, res.pendingId);
    const no = await cancelPendingMeal(deps, userId, res.pendingId);
    expect(no.kind).toBe("logged");
    if (no.kind === "logged" && logged.kind === "logged") expect(no.mealId).toBe(logged.mealId);
    expect((await day(deps, userId))!.meals).toHaveLength(1);
    expect((await thread(userId)).some((e) => e.kind === "text" && e.text === "Dropped it.")).toBe(false);
  });

  it("lets a confirm and a cancel race to ONE outcome: never a logged meal beside 'Dropped it.'", async () => {
    const userId = await onboard();
    const res = await handleText(deps, userId, { text: "two eggs and toast" });
    if (res.kind !== "proposed") throw new Error("expected proposed");
    const [yes, no] = await Promise.all([
      confirmPendingMeal(deps, userId, res.pendingId),
      cancelPendingMeal(deps, userId, res.pendingId),
    ]);
    const logged = (await day(deps, userId))!.meals.length;
    const dropped = (await thread(userId)).some((e) => e.kind === "text" && e.text === "Dropped it.");
    if (yes.kind === "logged") {
      expect(logged).toBe(1);
      expect(dropped).toBe(false);
      expect(no.kind).not.toBe("cancelled");
    } else {
      expect(no.kind).toBe("cancelled");
      expect(logged).toBe(0);
      expect(dropped).toBe(true);
    }
  });

  it("keeps a cancelled proposal as the words and 'Dropped it.'; an expired one keeps only the words", async () => {
    const userId = await onboard();
    const res = await handleText(deps, userId, { text: "two eggs and toast" });
    if (res.kind !== "proposed") throw new Error("expected proposed");
    await cancelPendingMeal(deps, userId, res.pendingId);
    expect((await thread(userId)).map(text)).toEqual(["two eggs and toast", "Dropped it."]);

    const gone = await handleText(makeDeps({ pendingTtlMs: -1 }), userId, { text: "a banana" });
    if (gone.kind !== "proposed") throw new Error("expected proposed");
    // Cancel and confirm agree about an expired proposal, and neither writes a line for it.
    expect((await cancelPendingMeal(deps, userId, gone.pendingId)).kind).toBe("expired");
    expect((await confirmPendingMeal(deps, userId, gone.pendingId)).kind).toBe("expired");
    expect((await thread(userId)).map(text)).toEqual(["two eggs and toast", "Dropped it.", "a banana"]);
  });

  it("keeps a manual edit from the editor as an updated card, like a correction from chat", async () => {
    const userId = await onboard();
    const meal = await logPhotoMeal(deps, userId, photo());
    if (meal.kind !== "logged") throw new Error("expected logged");
    await editMeal(deps, userId, meal.mealId, { kcal: 100 });
    const cards = (await thread(userId)).flatMap((e) => (e.kind === "meal" ? [e] : []));
    expect(cards.map((c) => c.event)).toEqual(["logged", "updated"]);
    expect(cards[1]!.meal!.kcal).toBe(100);
  });

  it("never fails the turn when even the release fails: logged, not thrown", async () => {
    const userId = await onboard();
    await expect(remember(deps, userId, async () => ({ lines: [], undo: async () => { throw new Error("x"); } }))).resolves.toBeUndefined();
  });

  it("hands a claim back when the thunk built nothing to write", async () => {
    // Every early exit of `remember` returns what the thunk claimed; a thunk that claims and yields
    // no lines must not burn the one greeting silently.
    const userId = await onboard();
    let released = 0;
    await remember(deps, userId, async () => ({ lines: [], undo: async () => { released++; } }));
    expect(released).toBe(1);
    expect(await thread(userId)).toHaveLength(0);
  });

  it("speaks the first verdict once, in the design's words, and never again", async () => {
    const userId = await onboard();
    // The demo analyzer derives confidence from the bytes; pin it, or this asserts a file size.
    const sure: LlmPorts = { ...demoPorts(), analyzePhoto: async (i) => ({ ...(await demoPorts().analyzePhoto(i)), confidence: "high" }) };
    const d = makeDeps({}, sure);
    const first = await logPhotoMeal(d, userId, photo());
    if (first.kind !== "logged") throw new Error("expected logged");
    const t = await thread(userId);
    expect(t.map((e) => [e.role, e.kind])).toEqual([["user", "photo"], ["assistant", "meal"], ["assistant", "text"], ["assistant", "text"], ["assistant", "text"]]);
    expect(text(t[2]!)).toMatch(/^First one in\. [\d,]+ kcal — /);
    expect(text(t[3]!)).toContain("If anything's off");
    expect(text(t[4]!)).toBe(MEET_GABIE);
    // The VERDICT is never said again — but the day's standing is, on every meal past the first
    // (#306), which is the one line the greeting's own arithmetic stands in for.
    const second = await logPhotoMeal(d, userId, photo());
    if (second.kind !== "logged") throw new Error("expected logged");
    const after = await thread(userId);
    expect(after.slice(5).map((e) => e.kind)).toEqual(["photo", "meal", "text"]);
    expect(text(after.at(-1)!)).not.toMatch(/^First one in\./);
    expect(text(after.at(-1)!)).toMatch(/ left today, [\d,]+ of the [\d,]+ g protein\.$/);
  });

  it("does not fail a turn because the thread could not be written — nor because its lines could not be built", async () => {
    const userId = await onboard();
    const broken: Store = { ...store, appendChat: async () => { throw new Error("disk full"); } };
    const res = await logPhotoMeal({ ...deps, store: broken }, userId, photo());
    expect(res.kind).toBe("logged");
    expect((await day(deps, userId))!.meals).toHaveLength(1);

    // The first verdict needs a claim and a profile; a store that fails THOSE must not fail the meal either.
    const flaky: Store = { ...store, claimFirstVerdict: async () => { throw new Error("timeout"); } };
    expect((await logPhotoMeal({ ...deps, store: flaky }, userId, photo())).kind).toBe("logged");
    const typed = await handleText(deps, userId, { text: "an apple" });
    if (typed.kind !== "proposed") throw new Error("expected proposed");
    expect((await confirmPendingMeal({ ...deps, store: flaky }, userId, typed.pendingId)).kind).toBe("logged");
  });

  it("keeps a correction's words, its card, and the design's 'Updated —' line, from chat and from the editor alike", async () => {
    const userId = await onboard();
    const meal = await logPhotoMeal(deps, userId, photo());
    if (meal.kind !== "logged") throw new Error("expected logged");
    await handleText(deps, userId, { text: "half that", focusMealId: meal.mealId });
    let t = await thread(userId);
    expect(t.slice(-3).map((e) => [e.role, e.kind])).toEqual([["user", "text"], ["assistant", "meal"], ["assistant", "text"]]);
    expect(text(t.at(-1)!)).toMatch(/^Updated — [\d,]+ kcal\. .* of the [\d,]+ g protein\.$/);
    await editMeal(deps, userId, meal.mealId, { kcal: 100 });
    t = await thread(userId);
    expect(t.slice(-2).map((e) => [e.role, e.kind])).toEqual([["assistant", "meal"], ["assistant", "text"]]);
    expect(text(t.at(-1)!)).toMatch(/^Updated — 100 kcal\./);
  });

  it("says where the day stands after EVERY landed meal, not only after a correction (#306)", async () => {
    // The account's first meal spends the greeting, which already carries the arithmetic; the
    // second had a card and then silence, so two consecutive meals read as two different features.
    const userId = await onboard();
    const first = await logPhotoMeal(deps, userId, photo());
    if (first.kind !== "logged") throw new Error("expected logged");
    const greeted = await thread(userId);
    // Not said twice on the first meal: the verdict's own clause is the day's arithmetic.
    expect(greeted.filter((e) => (text(e) ?? "").startsWith(String(first.totals.kcal)))).toHaveLength(0);

    const second = await logPhotoMeal(deps, userId, photo());
    if (second.kind !== "logged") throw new Error("expected logged");
    const t = await thread(userId);
    expect(t.slice(-2).map((e) => [e.role, e.kind])).toEqual([["assistant", "meal"], ["assistant", "text"]]);
    const profile = (await deps.store.getProfile(userId))!;
    expect(text(t.at(-1)!)).toBe(runningLine({
      targets: explainTargets(profile).targets,
      eatenToday: { kcal: second.totals.kcal, protein_g: second.totals.protein_g },
    }));

    // A confirmed text meal is a landed meal too, and reads the same.
    const typed = await handleText(deps, userId, { text: "an apple" });
    if (typed.kind !== "proposed") throw new Error("expected proposed");
    const third = await confirmPendingMeal(deps, userId, typed.pendingId);
    if (third.kind !== "logged") throw new Error("expected logged");
    const after = await thread(userId);
    expect(after.slice(-2).map((e) => [e.role, e.kind])).toEqual([["assistant", "meal"], ["assistant", "text"]]);
    expect(text(after.at(-1)!)).toBe(runningLine({
      targets: explainTargets(profile).targets,
      eatenToday: { kcal: third.totals.kcal, protein_g: third.totals.protein_g },
    }));
  });

  it("says nothing about today for a meal logged to another day", async () => {
    // The sentence is "left TODAY". A back-dated meal has nothing to say about it — the same
    // guard `afterCorrection` has, and the reason a re-dated correction writes no line either.
    const userId = await onboard();
    await logPhotoMeal(deps, userId, photo()); // spends the greeting
    const back = await handleText(deps, userId, { text: "a banana yesterday" });
    if (back.kind !== "proposed") throw new Error("expected proposed");
    expect(back.date).not.toBe(localDate("Europe/Berlin"));
    const logged = await confirmPendingMeal(deps, userId, back.pendingId);
    expect(logged.kind).toBe("logged");
    const t = await thread(userId);
    expect(t.at(-1)!.kind).toBe("meal");
  });

  it("says nothing about today for a meal that is not today's", async () => {
    const userId = await onboard();
    const meal = await logPhotoMeal(deps, userId, photo());
    if (meal.kind !== "logged") throw new Error("expected logged");
    const moved = await handleText(deps, userId, { text: "that was yesterday", focusMealId: meal.mealId });
    expect(moved.kind).toBe("redated");
    await handleText(deps, userId, { text: "half that", focusMealId: meal.mealId });
    const t = await thread(userId);
    // words, updated card — and no "left today" line about yesterday's budget.
    expect(t.slice(-2).map((e) => [e.role, e.kind])).toEqual([["user", "text"], ["assistant", "meal"]]);
  });

  it("saves the first verdict for the first meal that IS today's, and still says it once", async () => {
    const userId = await onboard();
    const back = await handleText(deps, userId, { text: "a burger yesterday" });
    if (back.kind !== "proposed") throw new Error("expected proposed");
    await confirmPendingMeal(deps, userId, back.pendingId);
    expect((await thread(userId)).filter((e) => e.kind === "text" && e.role === "assistant")).toHaveLength(0);
    const sure: LlmPorts = { ...demoPorts(), analyzePhoto: async (i) => ({ ...(await demoPorts().analyzePhoto(i)), confidence: "high" }) };
    await logPhotoMeal(makeDeps({}, sure), userId, photo());
    const spoken = (await thread(userId)).filter((e) => e.kind === "text" && e.role === "assistant");
    expect(text(spoken[0]!)).toMatch(/^First one in\./);
    await logPhotoMeal(makeDeps({}, sure), userId, photo());
    // One more line, and it is the day's standing rather than the verdict again (#306).
    const now = (await thread(userId)).filter((e) => e.kind === "text" && e.role === "assistant");
    expect(now).toHaveLength(spoken.length + 1);
    expect(text(now.at(-1)!)).toMatch(/ left today, [\d,]+ of the [\d,]+ g protein\.$/);
    expect(now.filter((e) => (text(e) ?? "").startsWith("First one in."))).toHaveLength(1);
  });

  it("keeps a full thread from growing on ANY path, and never fails the turn for it", async () => {
    const userId = await onboard();
    const full: Store = { ...store, countUserChat: async () => 10_000 };
    const before = (await thread(userId)).length;
    expect((await logPhotoMeal({ ...deps, store: full }, userId, photo())).kind).toBe("logged");
    expect(await thread(userId)).toHaveLength(before);
    // The editor's PATCH is the path behind no cap and no limiter; the bound holds there too.
    const meal = await logPhotoMeal(deps, userId, photo());
    if (meal.kind !== "logged") throw new Error("expected logged");
    const after = (await thread(userId)).length;
    expect((await editMeal({ ...deps, store: full }, userId, meal.mealId, { kcal: 100 })).kind).toBe("updated");
    expect(await thread(userId)).toHaveLength(after);
  });

  it("refuses to grow a thread past its bound, and says which refusal it is", async () => {
    const userId = await onboard();
    const full: Store = { ...store, countUserChat: async () => 10_000 };
    expect(await appendLines({ ...deps, store: full }, userId, [{ role: "user", text: "one more" }])).toEqual({ appended: 0, reason: "thread-full" });
    expect(await appendLines(deps, userId, [{ role: "user", text: "x".repeat(MAX_USER_LINE + 1) }])).toEqual({ appended: 0, reason: "bad-line" });
  });

  it("does not spend the greeting on a write that failed", async () => {
    const userId = await onboard();
    const sure: LlmPorts = { ...demoPorts(), analyzePhoto: async (i) => ({ ...(await demoPorts().analyzePhoto(i)), confidence: "high" }) };
    const broken: Store = { ...store, appendChat: async () => { throw new Error("disk full"); } };
    expect((await logPhotoMeal({ ...makeDeps({}, sure), store: broken }, userId, photo())).kind).toBe("logged");
    await logPhotoMeal(makeDeps({}, sure), userId, photo());
    const spoken = (await thread(userId)).filter((e) => e.role === "assistant" && e.kind === "text");
    expect(text(spoken[0]!)).toMatch(/^First one in\./);
  });

  it("still proposes when the sweep of expired proposals fails — housekeeping never fails a billed turn", async () => {
    const userId = await onboard();
    const stuck: Store = { ...store, pruneExpiredPendings: async () => { throw new Error("deadlock detected"); } };
    const res = await handleText({ ...deps, store: stuck }, userId, { text: "two eggs and toast" });
    expect(res.kind).toBe("proposed");
  });

  it("keeps nothing of a correction routed with no meal in focus, and refuses it as target-gone", async () => {
    const userId = await onboard();
    // Never an empty 200: the analysis is charged by now, and a turn that renders nothing leaves
    // the user with a spent sample and no idea why. The thread must not carry it either.
    const before = (await thread(userId)).length;
    const empty: LlmPorts = { ...demoPorts(), routeText: async (i) => ({ ...(await demoPorts().routeText(i)), intent: "correction" as const, analysis: (await demoPorts().analyzePhoto({ images: [], profile: i.profile, targets: i.targets, localTime: "12:00", repertoire: [] })) }) };
    const res = await handleText(makeDeps({}, empty), userId, { text: "half that" });
    expect(res).toEqual({ kind: "target-gone", on: "correction" });
    expect(await thread(userId)).toHaveLength(before);
  });

  it("echoes the phone's id for a turn on the stored user line, and drops an over-long one", async () => {
    const userId = await onboard();
    await handleText(deps, userId, { text: "how much protein?", clientId: "phone-1" });
    const t = await thread(userId);
    expect(t[0]).toMatchObject({ role: "user", kind: "text", clientId: "phone-1" });
    expect(t[1]).toMatchObject({ role: "assistant", kind: "text" });
    await handleText(deps, userId, { text: "and carbs?" });
    expect((await thread(userId))[2]).toMatchObject({ role: "user", clientId: null });
  });

  it("keeps nothing when the meal a correction named is gone", async () => {
    const userId = await onboard();
    const meal = await logPhotoMeal(deps, userId, photo());
    if (meal.kind !== "logged") throw new Error("expected logged");
    const before = (await thread(userId)).length;
    const gone: Store = { ...store, updateMeal: async () => null };
    const res = await handleText({ ...deps, store: gone }, userId, { text: "half that", focusMealId: meal.mealId });
    expect(res.kind).toBe("target-gone");
    expect(await thread(userId)).toHaveLength(before);
  });

  it("appends the user's own words and a scripted line by id, never assistant prose from the client", async () => {
    const userId = await onboard();
    expect(await appendLines(deps, userId, [
      { role: "user", text: "Lose weight" },
      { role: "assistant", scripted: "camera-closed" },
    ])).toEqual({ appended: 2 });
    const t = await thread(userId);
    expect(t.map(text)).toEqual(["Lose weight", expect.stringContaining("No rush.")]);
    expect(await appendLines(deps, userId, [{ role: "assistant", scripted: "not-a-line" } as never])).toEqual({ appended: 0, reason: "bad-line" });
    expect(await appendLines(deps, userId, [{ role: "assistant", text: "prose" } as never])).toEqual({ appended: 0, reason: "bad-line" });
    expect(await appendLines(deps, userId, [{ role: "user", text: "   " }])).toEqual({ appended: 0, reason: "bad-line" });
    // Parameters are the one place client text reaches an assistant line: only declared keys, short.
    expect(await appendLines(deps, userId, [{ role: "assistant", scripted: "trial-started", params: { price: "€39.99 a year" } }])).toEqual({ appended: 1 });
    expect(await appendLines(deps, userId, [{ role: "assistant", scripted: "trial-started", params: { price: "x".repeat(65) } }])).toEqual({ appended: 0, reason: "bad-line" });
    expect(await appendLines(deps, userId, [{ role: "assistant", scripted: "camera-closed", params: { price: "prose" } }])).toEqual({ appended: 0, reason: "bad-line" });
    expect(await appendLines(deps, userId, Array.from({ length: MAX_APPEND_LINES_PER_BATCH + 1 }, () => ({ role: "user" as const, text: "x" })))).toEqual({ appended: 0, reason: "bad-line" });
    expect(await thread(userId)).toHaveLength(3);
  });

  it("appends an onboarding question by coordinate, worded from the server's own copy", async () => {
    // The chat flow asks in the app; the thread has to hold the same conversation, and the phone
    // still may not send prose. So it names a prompt and a bubble index, and the words come from
    // here — which also means an admin edit lands in the thread rather than a stale app's cache.
    const userId = await onboard();
    expect(await appendLines(deps, userId, [
      { role: "assistant", ask: { prompt: "goal", line: 0 } },
      { role: "user", text: "Lose weight" },
    ])).toEqual({ appended: 2 });
    const t = await thread(userId);
    expect(t.map(text)).toEqual([
      DEFAULT_ONBOARDING_CONTENT.screens.find((x) => x.id === "goal")!.asks.goal!.lines[0]!,
      "Lose weight",
    ]);

    // A coordinate that does not exist is a client and a server that disagree about the copy, and
    // guessing which sentence was meant would put a question in the thread nobody was asked.
    for (const ref of [{ prompt: "goal", line: 9 }, { prompt: "nope", line: 0 }, { prompt: "goal", line: -1 }, { prompt: "goal", line: 1.5 }]) {
      expect(await appendLines(deps, userId, [{ role: "assistant", ask: ref } as never]))
        .toEqual({ appended: 0, reason: "bad-line" });
    }
    expect(await thread(userId)).toHaveLength(2);
  });

  it("words the goal-weight question for the goal that was chosen", async () => {
    // Rule 1 of copy.md's context model, enforced on the STORED line too: "faster isn't better" is
    // a warning about losing weight, and the thread must not show it to somebody who is gaining.
    const userId = await onboard();
    await patchProfile(deps, userId, { goal: "gain" });
    await appendLines(deps, userId, [{ role: "assistant", ask: { prompt: "target_weight_kg", line: 0 } }]);
    const stored = (await thread(userId)).map(text).join(" ");
    expect(stored).toContain("Where would you like to be");
    expect(stored).not.toContain("Faster isn't better");
    expect(stored).not.toContain("{loseTail}");
  });

  it("keeps a correction as an updated card, and both cards read the meal as it is now", async () => {
    const userId = await onboard();
    const meal = await logPhotoMeal(deps, userId, photo());
    if (meal.kind !== "logged") throw new Error("expected logged");
    await handleText(deps, userId, { text: "half that", focusMealId: meal.mealId });
    const cards = (await thread(userId)).flatMap((e) => (e.kind === "meal" ? [e] : []));
    expect(cards.map((c) => c.event)).toEqual(["logged", "updated"]);
    // One meal, two moments, read on request: a stored verdict would describe numbers since changed.
    expect(cards[0]!.meal!.kcal).toBe(cards[1]!.meal!.kcal);
    expect(cards[0]!.meal!.kcal).toBeLessThan(meal.analysis.kcal);
  });

  it("keeps nothing from a refused turn", async () => {
    const userId = await onboard();
    const one = makeDeps({ freeAnalyses: 1 });
    await handleText(one, userId, { text: "how much protein?" });
    expect((await handleText(one, userId, { text: "and carbs?" })).kind).toBe("subscription-required");
    expect(await thread(userId)).toHaveLength(2);
    // The verdict prose is the design's; an ordinary question gets the model's answer and no more.
    expect((await thread(userId)).map((e) => e.kind)).toEqual(["text", "text"]);
  });

  it("is scoped, and erased with the account", async () => {
    const a = await onboard();
    const b = await onboard();
    await handleText(deps, a, { text: "how much protein?" });
    expect(await thread(b)).toEqual([]);
    await store.deleteUser(a);
    expect(await thread(a)).toEqual([]);
  });

  it("pages backwards from the newest, and says when the start is reached", async () => {
    const userId = await onboard();
    for (const q of ["how much one?", "how much two?", "how much three?"]) {
      await handleText(deps, userId, { text: q });
    }
    const last = await chatHistory(deps, userId, { limit: 4 });
    expect(last.entries).toHaveLength(4);
    expect(text(last.entries[0]!)).toBe("how much two?");
    expect(last.before).not.toBeNull();
    const older = await chatHistory(deps, userId, { before: last.before!, limit: 4 });
    expect(older.entries.map((e) => e.role)).toEqual(["user", "assistant"]);
    expect(text(older.entries[0]!)).toBe("how much one?");
    expect(older.before).toBeNull();
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

describe("the streamed photo turn", () => {
  it("streams the glance and every item to onEvent before returning the result", async () => {
    const userId = await onboard();
    const events: PhotoEvent[] = [];
    const res = await logPhotoMeal(deps, userId, photo(), (e) => events.push(e));
    expect(res.kind).toBe("logged");
    const kinds = events.map((e) => e.kind);
    expect(kinds).toContain("glance");
    expect(kinds.filter((k) => k === "item").length).toBe((res as MealLogged).analysis.items.length);
    // The streamed rows are the rows the card carries, in order.
    const streamed = events.flatMap((e) => (e.kind === "item" ? [e.item.name] : []));
    expect(streamed).toEqual((res as MealLogged).analysis.items.map((i) => i.name));
    // The glance is live-turn only: not in the meal, not in the thread.
    const glance = events.find((e) => e.kind === "glance") as { text: string };
    const thread = await chatHistory(deps, userId, {});
    expect(JSON.stringify(thread)).not.toContain(glance.text);
    expect(JSON.stringify(res)).not.toContain(glance.text);
  });

  it("makes no glance call without onEvent", async () => {
    const userId = await onboard();
    let called = 0;
    const llm: LlmPorts = { ...demoPorts(), glancePhoto: async () => { called++; return "x"; } };
    await logPhotoMeal(makeDeps({}, llm), userId, photo());
    expect(called).toBe(0);
  });

  it("makes no glance call when no glance model is configured", async () => {
    const userId = await onboard();
    let called = 0;
    const llm: LlmPorts = { ...demoPorts(), glancePhoto: async () => { called++; return "x"; } };
    await logPhotoMeal(makeDeps({ llmGlanceModel: "" }, llm), userId, photo(), () => {});
    expect(called).toBe(0);
  });

  it("a glance that hangs does not hold the result back", async () => {
    const userId = await onboard();
    const llm: LlmPorts = { ...demoPorts(), glancePhoto: () => new Promise(() => {}) };
    const t0 = Date.now();
    const res = await logPhotoMeal(makeDeps({}, llm), userId, photo(), () => {});
    expect(res.kind).toBe("logged");
    // The demo analyzer streams in about a second; a result gated on the glance never returns.
    expect(Date.now() - t0).toBeLessThan(5_000);
  });

  it("a glance that throws does not fail the turn", async () => {
    const userId = await onboard();
    const llm: LlmPorts = { ...demoPorts(), glancePhoto: async () => { throw new Error("boom"); } };
    const events: PhotoEvent[] = [];
    const res = await logPhotoMeal(makeDeps({}, llm), userId, photo(), (e) => events.push(e));
    expect(res.kind).toBe("logged");
    expect(events.some((e) => e.kind === "glance")).toBe(false);
  });

  it("a refused turn emits nothing", async () => {
    const userId = await onboard();
    const events: PhotoEvent[] = [];
    const res = await logPhotoMeal(deps, userId, photo(), (e) => events.push(e));
    expect(res.kind).toBe("logged");
    const refused = await logPhotoMeal(makeDeps({ freeAnalyses: 1 }), userId, photo(), (e) => events.push(e));
    expect(refused.kind).toBe("subscription-required");
    expect(events.filter((e) => e.kind === "glance").length).toBe(1);
  });
});

describe("photo storage", () => {
  it("keeps a logged meal's photos, in order, and puts the meal id on the photo bubble", async () => {
    const userId = await onboard();
    const res = await logPhotoMeal(deps, userId, { images: [async () => jpeg(8), async () => jpeg(12)] });
    expect(res.kind).toBe("logged");
    const mealId = (res as MealLogged).mealId;
    const stored = await store.getPhotos(userId, mealId);
    expect(stored.map((p) => p.position)).toEqual([0, 1]);
    expect(stored[0]!.mime).toBe("image/jpeg");
    expect(stored[1]!.bytes.byteLength).toBe(14);
    expect((await store.getMeal(userId, mealId))?.photos).toBe(2);
    const { entries } = await chatHistory(deps, userId, {});
    const bubble = entries.find((e) => e.role === "user" && e.kind === "photo");
    expect(bubble && bubble.role === "user" && bubble.kind === "photo" ? bubble.mealId : null).toBe(mealId);
  });

  it("stores nothing when the analysis is not food or fails", async () => {
    const userId = await onboard();
    const base = demoPorts();
    const notFood: LlmPorts = { ...base, analyzePhoto: async (i, d) => ({ ...(await base.analyzePhoto(i, d)), isFood: false }) };
    expect((await logPhotoMeal(makeDeps({}, notFood), userId, photo())).kind).toBe("not-food");
    const failing: LlmPorts = { ...base, analyzePhoto: async () => { throw new Error("boom"); } };
    expect((await logPhotoMeal(makeDeps({}, failing), userId, photo())).kind).toBe("analysis-failed");
    const today = localDate(deps.config.timezone);
    expect(await store.mealsForDate(userId, today)).toEqual([]);
  });

  it("still logs the meal when the photo store fails", async () => {
    const userId = await onboard();
    const broken: Store = { ...store, putPhotos: async () => { throw new Error("disk full"); } };
    const res = await logPhotoMeal({ ...deps, store: broken }, userId, photo());
    expect(res.kind).toBe("logged");
    expect((await store.getMeal(userId, (res as MealLogged).mealId))?.photos ?? 0).toBe(0);
    // And the bubble names no meal, so the app draws no frame for a photo that is not there.
    const { entries } = await chatHistory(deps, userId, {});
    const bubble = entries.find((e) => e.role === "user" && e.kind === "photo");
    expect(bubble && bubble.role === "user" && bubble.kind === "photo" ? bubble.mealId : "missing").toBeNull();
  });
});

describe("corrections re-see the photo", () => {
  it("hands the stored photos to the router for a correction, and nothing for a text meal", async () => {
    const userId = await onboard();
    const seen: (Uint8Array[] | undefined)[] = [];
    const spy: LlmPorts = { ...demoPorts(), routeText: async (i) => { seen.push(i.loadFocusImages ? await i.loadFocusImages() : undefined); return demoPorts().routeText(i); } };
    const d = makeDeps({}, spy);
    const logged = await logPhotoMeal(d, userId, photo(8)) as MealLogged;
    await handleText(d, userId, { text: "half that", focusMealId: logged.mealId });
    expect(seen[0]?.length).toBe(1);
    expect(seen[0]?.[0]?.byteLength).toBe(10);

    const proposed = await handleText(d, userId, { text: "a bowl of rice" });
    const textMeal = await confirmPendingMeal(d, userId, (proposed as { pendingId: string }).pendingId) as MealLogged;
    await handleText(d, userId, { text: "half that", focusMealId: textMeal.mealId });
    expect(seen[2]).toBeUndefined();
  });
});

describe("re-analysis", () => {
  it("re-reads the stored photo, charged like a photo, and replaces the numbers without marking a correction", async () => {
    const userId = await onboard();
    const logged = await logPhotoMeal(deps, userId, photo(8)) as MealLogged;
    await editMeal(deps, userId, logged.mealId, { kcal: 999 });
    expect((await store.getMeal(userId, logged.mealId))!.corrected).toBe(true);

    const res = await reanalyzeMeal(makeDeps({ llmModel: "demo-2" }), userId, logged.mealId);
    expect(res.kind).toBe("updated");
    expect((res as MealUpdated).via).toBe("reanalysis");
    const after = (await store.getMeal(userId, logged.mealId))!;
    expect(after.kcal).not.toBe(999);
    expect(after.corrected).toBe(false);
    expect(after.model).toBe("demo-2");
    expect(after.photos).toBe(1);
    const { entries } = await chatHistory(deps, userId, {});
    const last = entries.at(-1);
    expect(last && last.role === "assistant" && last.kind === "meal" ? last.event : null).toBe("updated");
  });

  it("is charged before the call: the sample is spent by it", async () => {
    const userId = await onboard();
    const d = makeDeps({ freeAnalyses: 2 });
    const logged = await logPhotoMeal(d, userId, photo(8)) as MealLogged;
    expect((await reanalyzeMeal(d, userId, logged.mealId)).kind).toBe("updated");
    expect((await reanalyzeMeal(d, userId, logged.mealId)).kind).toBe("subscription-required");
  });

  it("refuses a meal with no photo and another user's meal", async () => {
    const userId = await onboard();
    const proposed = await handleText(deps, userId, { text: "a bowl of rice" });
    const textMeal = await confirmPendingMeal(deps, userId, (proposed as { pendingId: string }).pendingId) as MealLogged;
    expect((await reanalyzeMeal(deps, userId, textMeal.mealId)).kind).toBe("no-photo");

    const other = await onboard();
    const logged = await logPhotoMeal(deps, userId, photo(8)) as MealLogged;
    expect((await reanalyzeMeal(deps, other, logged.mealId)).kind).toBe("target-gone");
  });

  it("leaves the meal alone when the analyzer fails or sees no food", async () => {
    const userId = await onboard();
    const logged = await logPhotoMeal(deps, userId, photo(8)) as MealLogged;
    const before = (await store.getMeal(userId, logged.mealId))!;
    const base = demoPorts();
    const failing: LlmPorts = { ...base, analyzePhoto: async () => { throw new Error("boom"); } };
    expect((await reanalyzeMeal(makeDeps({}, failing), userId, logged.mealId)).kind).toBe("analysis-failed");
    const notFood: LlmPorts = { ...base, analyzePhoto: async (i, d) => ({ ...(await base.analyzePhoto(i, d)), isFood: false }) };
    expect((await reanalyzeMeal(makeDeps({}, notFood), userId, logged.mealId)).kind).toBe("not-food");
    expect((await store.getMeal(userId, logged.mealId))!.kcal).toBe(before.kcal);
  });

  it("replaces the confidence with the new read's, so the pill describes the numbers on the card", async () => {
    const userId = await onboard();
    const base = demoPorts();
    const logged = await logPhotoMeal(deps, userId, photo(8)) as MealLogged;
    const unsure: LlmPorts = { ...base, analyzePhoto: async (i, d) => ({ ...(await base.analyzePhoto(i, d)), confidence: "low" }) };
    expect((await reanalyzeMeal(makeDeps({}, unsure), userId, logged.mealId)).kind).toBe("updated");
    expect((await store.getMeal(userId, logged.mealId))!.confidence).toBe("low");
  });

  it("gives the analysis back when the gateway refused before routing", async () => {
    const userId = await onboard();
    const d = makeDeps({ freeAnalyses: 2 });
    const logged = await logPhotoMeal(d, userId, photo(8)) as MealLogged;
    const refused: LlmPorts = { ...demoPorts(), analyzePhoto: async () => { throw new GatewayRefusal(402, "llm http 402: out of credits"); } };
    expect((await reanalyzeMeal(makeDeps({ freeAnalyses: 2 }, refused), userId, logged.mealId)).kind).toBe("analysis-failed");
    // Refunded: the second of two analyses is still available.
    expect((await reanalyzeMeal(d, userId, logged.mealId)).kind).toBe("updated");
    expect((await reanalyzeMeal(d, userId, logged.mealId)).kind).toBe("subscription-required");
  });
});

// ── What each analysis cost (#484) ───────────────────────────────────────────────────────────

describe("what each analysis cost", () => {
  const spend = async () => {
    const zone = deps.config.timezone;
    return (await store.adminMetrics({ days: 1, today: localDate(zone), timezone: zone })).days[0]!;
  };

  it("adds every call a photo turn made to the analysis it charged", async () => {
    const userId = await onboard();
    const llm: LlmPorts = {
      ...demoPorts(),
      analyzePhoto: async (i) => { i.onCost?.(0.25); i.onCost?.(0.5); return await demoPorts().analyzePhoto(i); },
    };
    expect((await logPhotoMeal(makeDeps({}, llm), userId, photo())).kind).toBe("logged");
    const d = await spend();
    expect(d.analyses).toBe(1);
    expect(d.costUsd).toBeCloseTo(0.75, 9);
    expect(d.unpriced).toBe(0);
  });

  it("prices a question as the router's calls and the coach's, on one analysis", async () => {
    const userId = await onboard();
    const llm: LlmPorts = {
      ...demoPorts(),
      routeText: async (i) => { i.onCost?.(0.25); return { intent: "answer", text: "From the router." }; },
      coach: async (i) => { i.onCost?.(0.5); return { reply: "From the coach.", suggestions: [] }; },
    };
    expect((await handleText(makeDeps({}, llm), userId, { text: "how is my week?" })).kind).toBe("answered");
    const d = await spend();
    expect(d.analyses).toBe(1);
    expect(d.costUsd).toBeCloseTo(0.75, 9);
  });

  it("keeps a failed turn charged, and its cost marked as a floor", async () => {
    const userId = await onboard();
    const llm: LlmPorts = {
      ...demoPorts(),
      analyzePhoto: async (i) => { i.onCost?.(0.25); i.onCost?.(null); throw new Error("llm timeout after 90000ms"); },
    };
    expect((await logPhotoMeal(makeDeps({}, llm), userId, photo())).kind).toBe("analysis-failed");
    const d = await spend();
    expect(d.analyses).toBe(1);
    expect(d.costUsd).toBeCloseTo(0.25, 9);
    expect(d.unpriced).toBe(1);
  });

  it("charges the glance to the photo it glanced at", async () => {
    const userId = await onboard();
    const llm: LlmPorts = { ...demoPorts(), glancePhoto: async (i) => { i.onCost?.(0.125); return "Eggs."; } };
    await logPhotoMeal(makeDeps({ llmGlanceModel: "glance" }, llm), userId, photo(), () => {});
    const d = await spend();
    expect(d.analyses).toBe(1);
    expect(d.costUsd).toBeCloseTo(0.125, 9);
  });

  it("says so in the log when a cost finds no analysis left to land on", async () => {
    const userId = await onboard();
    const today = localDate(deps.config.timezone);
    const onCost = await charge(deps, userId, today, "photo");
    // Refunded while a call was still out — the glance beside a refused analyzer, or a merge.
    await store.undoAnalysis(userId, today, "photo");
    const errors = spyOn(console, "error").mockImplementation(() => {});
    try {
      onCost(0.125);
      await new Promise((r) => setTimeout(r, 0));
      expect(errors).toHaveBeenCalledTimes(1);
      expect(String(errors.mock.calls[0]![0])).toContain("cost not recorded");
    } finally {
      errors.mockRestore();
    }
  });

  it("prices a re-read like the photo it re-reads", async () => {
    const userId = await onboard();
    const logged = await logPhotoMeal(deps, userId, photo()) as MealLogged;
    const llm: LlmPorts = { ...demoPorts(), analyzePhoto: async (i) => { i.onCost?.(0.5); return await demoPorts().analyzePhoto(i); } };
    expect((await reanalyzeMeal(makeDeps({}, llm), userId, logged.mealId)).kind).toBe("updated");
    const d = await spend();
    expect(d.analyses).toBe(2);
    expect(d.costUsd).toBeCloseTo(0.5, 9);
  });
});
