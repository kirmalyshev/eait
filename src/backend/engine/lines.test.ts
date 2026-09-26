import { beforeEach, describe, expect, it } from "bun:test";
import { localDate, OUTCOME_UNKNOWN, type ChatEntry, type PhotoEvent } from "@eait/shared";
import { configDefaults, type Config } from "../config.ts";
import { demoPorts } from "../llm/demo.ts";
import type { LlmPorts, PhotoInput } from "../llm/port.ts";
import { memoryStore } from "../store.memory.ts";
import type { Store } from "../store.ts";
import { fakeMailer } from "../mail/fake.ts";
import { fakePush } from "../push/fake.ts";
import { chatHistory, confirmPendingMeal, deleteLine, deleteMealById, editLine, handleText, logPhotoMeal, patchProfile, sumTotals, type EngineDeps } from "./index.ts";

const CONFIG: Config = {
  ...configDefaults(),
  port: 0, databaseUrl: "memory://test",
  llmProvider: "demo", llmModel: "demo", llmApiKey: "unused",
  freeAnalyses: 100, globalDailyAnalysisCap: 10, maxPhotosPerMeal: 2,
  appleAudiences: ["com.eait.fit.ios"], googleAudiences: ["test.apps.googleusercontent.com"],
};
let store: Store;
let deps: EngineDeps;
function makeDeps(over: Partial<Config> = {}, llm: LlmPorts = demoPorts()): EngineDeps {
  return { store, config: { ...CONFIG, ...over }, llm, mailer: fakeMailer(), push: fakePush() };
}
async function onboard(): Promise<string> {
  const { userId } = await store.upsertDeviceUser(crypto.randomUUID() + crypto.randomUUID(), "en");
  const out = await patchProfile(deps, userId, {
    goal: "lose", sex: "female", birth_year: 1990, height_cm: 165, weight_kg: 70,
    target_weight_kg: 65, activity: "moderate", pace: "steady", country: "de",
    restrictions: [], complete_onboarding: true,
  });
  if (!out || !out.ok) throw new Error(`onboarding failed: ${JSON.stringify(out)}`);
  return userId;
}
const jpeg = (bytes = 8) => { const b = new Uint8Array(2 + bytes).fill(1); b[0] = 0xff; b[1] = 0xd8; return b; };
const heic = () => new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63, 1, 1, 1, 1]);
const photo = (caption?: string) => ({ images: [async () => jpeg()], ...(caption ? { caption } : {}) });
const thread = async (d: EngineDeps, userId: string) => (await chatHistory(d, userId, {})).entries;
/** Every way a line can name a meal: a photo line's and a card's `mealId`, a typed line's `pendingId`. */
const namesMeal = (e: ChatEntry, mealId: string): boolean =>
  ((e.kind === "photo" || e.kind === "meal") && e.mealId === mealId) ||
  (e.role === "user" && e.kind === "text" && e.pendingId === mealId);
/** The user's photo line and its card, after one photo turn. */
async function loggedPhoto(d: EngineDeps, userId: string, caption?: string) {
  const res = await logPhotoMeal(d, userId, photo(caption));
  if (res.kind !== "logged") throw new Error(res.kind);
  const entries = await thread(d, userId);
  const line = entries.find((e) => e.role === "user" && e.kind === "photo" && e.mealId === res.mealId);
  if (!line) throw new Error("no photo line");
  return { mealId: res.mealId, lineId: line.id, date: res.date };
}
/** A text line the router accepted (an answered question), so the thread holds a user text line. */
async function saidText(d: EngineDeps, userId: string, text: string) {
  await handleText(d, userId, { text });
  const line = (await thread(d, userId)).findLast((e) => e.role === "user" && e.kind === "text");
  if (!line) throw new Error("no text line");
  return line;
}

beforeEach(() => { store = memoryStore(); deps = makeDeps(); });

describe("deleteLine", () => {
  it("another user's line id is target-gone", async () => {
    const a = await onboard(); const b = await onboard();
    const { lineId } = await loggedPhoto(deps, a);
    expect(await deleteLine(deps, b, lineId)).toEqual({ kind: "target-gone", on: "correction" });
    expect((await thread(deps, a)).some((e) => e.id === lineId)).toBe(true);
  });

  it("a photo line takes the meal, its photos, its cards and the day's totals with it", async () => {
    const userId = await onboard();
    const { mealId, lineId, date } = await loggedPhoto(deps, userId);
    expect(sumTotals(await store.mealsForDate(userId, date)).kcal).toBeGreaterThan(0);
    const out = await deleteLine(deps, userId, lineId);
    expect(out).toEqual({ kind: "deleted", mealId, date });
    expect(await store.getMeal(userId, mealId)).toBeNull();
    expect(await store.getPhotos(userId, mealId)).toEqual([]);
    const after = await thread(deps, userId);
    expect(after.some((e) => e.id === lineId)).toBe(false);
    expect(after.some((e) => e.kind === "meal" && e.mealId === mealId)).toBe(false);
    expect(sumTotals(await store.mealsForDate(userId, date)).kcal).toBe(0);
  });

  it("a photo line whose meal is already gone goes alone", async () => {
    const userId = await onboard();
    const { mealId, lineId } = await loggedPhoto(deps, userId);
    await store.deleteMeal(userId, mealId);
    expect(await deleteLine(deps, userId, lineId)).toEqual({ kind: "deleted", mealId: null, date: null });
  });

  it("a text line goes alone, and a proposal it holds is dropped", async () => {
    const userId = await onboard();
    // The demo router proposes a meal for a described one; its user line carries the pendingId.
    await handleText(deps, userId, { text: "two eggs and toast" });
    const entries = await thread(deps, userId);
    const line = entries.findLast((e) => e.role === "user" && e.kind === "text" && e.pendingId !== null);
    if (!line || line.role !== "user" || line.kind !== "text" || !line.pendingId) throw new Error("no proposal line");
    const others = entries.filter((e) => e.id !== line.id).map((e) => e.id);
    expect(await deleteLine(deps, userId, line.id)).toEqual({ kind: "deleted", mealId: null, date: null });
    expect(await store.getPending(userId, line.pendingId)).toBeNull();
    expect((await thread(deps, userId)).map((e) => e.id)).toEqual(others);
  });

  it("a text line whose proposal was LOGGED takes the meal with it, like a photo line (#608: a line is its meal)", async () => {
    // Review recording, 13 Sep 2026: long-press on the typed meal bubble offered "Remove this
    // message? Numbers stay." and left the 388 kcal yogurt in the diary. The confirmed meal carries
    // the proposal's id, so the line names its meal exactly as a photo line does.
    const userId = await onboard();
    await handleText(deps, userId, { text: "two eggs and toast" });
    const line = (await thread(deps, userId)).findLast((e) => e.role === "user" && e.kind === "text" && e.pendingId !== null);
    if (!line || line.role !== "user" || line.kind !== "text" || !line.pendingId) throw new Error("no proposal line");
    const logged = await confirmPendingMeal(deps, userId, line.pendingId);
    if (logged.kind !== "logged") throw new Error(`not logged: `);
    expect(await deleteLine(deps, userId, line.id)).toEqual({ kind: "deleted", mealId: logged.mealId, date: logged.date });
    expect(await store.getMeal(userId, logged.mealId)).toBeNull();
    const after = await thread(deps, userId);
    expect(after.some((e) => e.id === line.id)).toBe(false);
    expect(after.some((e) => e.kind === "meal" && e.mealId === logged.mealId)).toBe(false);
    expect(sumTotals(await store.mealsForDate(userId, logged.date)).kcal).toBe(0);
  });

  it("an assistant line is bad-request", async () => {
    const userId = await onboard();
    await loggedPhoto(deps, userId);
    const card = (await thread(deps, userId)).find((e) => e.role === "assistant");
    expect(await deleteLine(deps, userId, card!.id)).toEqual({ kind: "bad-request" });
  });
});

// #61. The meal screen's delete: the same semantics as deleting the line that carried it, for a
// caller that holds a meal id and no line id.
describe("deleteMealById", () => {
  it("deletes the caller's meal with its photos, its cards and the photo line that carried it", async () => {
    const userId = await onboard();
    const { mealId, lineId, date } = await loggedPhoto(deps, userId);
    expect(sumTotals(await store.mealsForDate(userId, date)).kcal).toBeGreaterThan(0);
    expect(await deleteMealById(deps, userId, mealId)).toEqual({ kind: "deleted", mealId, date });
    expect(await store.getMeal(userId, mealId)).toBeNull();
    expect(await store.getPhotos(userId, mealId)).toEqual([]);
    const after = await thread(deps, userId);
    expect(after.some((e) => e.id === lineId)).toBe(false);
    expect(after.some((e) => namesMeal(e, mealId))).toBe(false);
    expect(sumTotals(await store.mealsForDate(userId, date)).kcal).toBe(0);
  });

  it("takes the typed line whose confirmed proposal became the meal", async () => {
    const userId = await onboard();
    await handleText(deps, userId, { text: "two eggs and toast" });
    const line = (await thread(deps, userId)).findLast((e) => e.role === "user" && e.kind === "text" && e.pendingId !== null);
    if (!line || line.role !== "user" || line.kind !== "text" || !line.pendingId) throw new Error("no proposal line");
    const logged = await confirmPendingMeal(deps, userId, line.pendingId);
    if (logged.kind !== "logged") throw new Error("not logged");
    expect(await deleteMealById(deps, userId, logged.mealId)).toEqual({ kind: "deleted", mealId: logged.mealId, date: logged.date });
    expect(await store.getMeal(userId, logged.mealId)).toBeNull();
    const after = await thread(deps, userId);
    expect(after.some((e) => e.id === line.id)).toBe(false);
    expect(after.some((e) => namesMeal(e, logged.mealId))).toBe(false);
    expect(sumTotals(await store.mealsForDate(userId, logged.date)).kcal).toBe(0);
  });

  it("another account's meal id is target-gone, and deletes nothing of theirs", async () => {
    const a = await onboard(); const b = await onboard();
    const { mealId, lineId } = await loggedPhoto(deps, a);
    expect(await deleteMealById(deps, b, mealId)).toEqual({ kind: "target-gone", on: "correction" });
    expect(await store.getMeal(a, mealId)).not.toBeNull();
    const after = await thread(deps, a);
    expect(after.some((e) => e.id === lineId)).toBe(true);
    expect(after.some((e) => namesMeal(e, mealId))).toBe(true);
  });

  it("an unknown id is target-gone", async () => {
    const userId = await onboard();
    expect(await deleteMealById(deps, userId, crypto.randomUUID())).toEqual({ kind: "target-gone", on: "correction" });
  });
});

describe("editLine", () => {
  it("another user's line id is target-gone", async () => {
    const a = await onboard(); const b = await onboard();
    const { lineId } = await loggedPhoto(deps, a);
    expect((await editLine(deps, b, lineId, { text: "x", images: [] })).kind).toBe("target-gone");
  });

  it("re-reads ALL photos with the new caption, updates numbers and text in place, appends nothing, corrected: false", async () => {
    const seen: PhotoInput[] = [];
    const llm: LlmPorts = { ...demoPorts(), analyzePhoto: async (input, onDelta) => { seen.push(input); return demoPorts().analyzePhoto(input, onDelta); } };
    const d = makeDeps({}, llm);
    const userId = await onboard();
    const { mealId, lineId } = await loggedPhoto(d, userId, "rice");
    const before = await thread(d, userId);
    const events: PhotoEvent[] = [];
    const out = await editLine(d, userId, lineId, { text: "rice, and an egg", images: [async () => jpeg(9)] }, (e) => events.push(e));
    expect(out.kind).toBe("updated");
    expect(seen).toHaveLength(2);
    expect(seen[1]!.caption).toBe("rice, and an egg");
    expect(seen[1]!.images).toHaveLength(2);
    const meal = await store.getMeal(userId, mealId);
    expect(meal?.corrected).toBe(false);
    expect(meal?.photos).toBe(2);
    expect((await store.getLine(userId, lineId))?.text).toBe("rice, and an egg");
    const after = await thread(d, userId);
    expect(after.map((e) => e.id)).toEqual(before.map((e) => e.id));
    expect(events.some((e) => e.kind === "item")).toBe(true);
  });

  it("an empty text is a re-read with no note", async () => {
    const seen: (string | undefined)[] = [];
    const llm: LlmPorts = { ...demoPorts(), analyzePhoto: async (input, onDelta) => { seen.push(input.caption); return demoPorts().analyzePhoto(input, onDelta); } };
    const d = makeDeps({}, llm);
    const userId = await onboard();
    const { lineId } = await loggedPhoto(d, userId, "rice");
    expect((await editLine(d, userId, lineId, { text: "", images: [] })).kind).toBe("updated");
    expect(seen[1]).toBeUndefined();
    expect((await store.getLine(userId, lineId))?.text).toBeNull();
  });

  it("a cap refusal changes neither text nor numbers and charges nothing past the cap", async () => {
    const d = makeDeps({ globalDailyAnalysisCap: 1 });
    const userId = await onboard();
    const { mealId, lineId } = await loggedPhoto(d, userId, "rice");
    const kcal = (await store.getMeal(userId, mealId))!.kcal;
    const out = await editLine(d, userId, lineId, { text: "changed", images: [] });
    expect(out.kind).toBe("cap-exceeded");
    expect((await store.getLine(userId, lineId))?.text).toBe("rice");
    expect((await store.getMeal(userId, mealId))!.kcal).toBe(kcal);
  });

  it("a capped account's angle is never read", async () => {
    const d = makeDeps({ globalDailyAnalysisCap: 1 });
    const userId = await onboard();
    const { lineId } = await loggedPhoto(d, userId);
    let read = false;
    const out = await editLine(d, userId, lineId, { text: "x", images: [async () => { read = true; return jpeg(); }] });
    expect(out.kind).toBe("cap-exceeded");
    expect(read).toBe(false);
  });

  it("a text line is bad-request", async () => {
    const userId = await onboard();
    const line = await saidText(deps, userId, "what is a good breakfast?");
    expect(await editLine(deps, userId, line.id, { text: "x", images: [] })).toEqual({ kind: "bad-request" });
  });

  it("a HEIC angle is unsupported-image, before the charge", async () => {
    const userId = await onboard();
    const { lineId } = await loggedPhoto(deps, userId);
    const before = await store.countUserPhotos(userId, localDate(CONFIG.timezone));
    expect((await editLine(deps, userId, lineId, { text: "x", images: [async () => heic()] })).kind).toBe("unsupported-image");
    expect(await store.countUserPhotos(userId, localDate(CONFIG.timezone))).toBe(before);
  });

  it("more angles than the meal may hold is too-many, before the charge", async () => {
    const userId = await onboard();
    const { lineId } = await loggedPhoto(deps, userId);
    const out = await editLine(deps, userId, lineId, { text: "x", images: [async () => jpeg(), async () => jpeg()] });
    expect(out).toEqual({ kind: "too-many", limit: 2 });
  });

  it("a photo line whose meal is gone is target-gone", async () => {
    const userId = await onboard();
    const { mealId, lineId } = await loggedPhoto(deps, userId);
    await store.deleteMeal(userId, mealId);
    expect((await editLine(deps, userId, lineId, { text: "x", images: [] })).kind).toBe("target-gone");
  });
});
