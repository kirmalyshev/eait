// #708: a billed turn sent again under the same client id is answered from the first, never run
// twice — the phone's offline queue replays whatever lost its answer, and a replay that logged or
// charged again would make the queue the way to double-log a meal.

import { beforeEach, describe, expect, it } from "bun:test";
import { dateMinus, localDate, type LogPhotoResult } from "@eait/shared";
import { configDefaults, type Config } from "../config.ts";
import { demoPorts } from "../llm/demo.ts";
import type { LlmPorts } from "../llm/port.ts";
import { memoryStore } from "../store.memory.ts";
import type { Store } from "../store.ts";
import { fakeMailer } from "../mail/fake.ts";
import { fakePush } from "../push/fake.ts";
import { handleText, logPhotoMeal, patchProfile, type EngineDeps } from "./index.ts";
import { TURN_OUTCOME_TTL_MS, TurnUnsettled, eatenAt } from "./turns.ts";

const CONFIG: Config = {
  ...configDefaults(),
  port: 0, databaseUrl: "memory://test",
  llmProvider: "demo", llmModel: "demo", llmApiKey: "unused",
  freeAnalyses: 100, globalDailyAnalysisCap: 10,
};
const ZONE = CONFIG.timezone;

let store: Store;
const makeDeps = (llm: LlmPorts = demoPorts(), over: Partial<Config> = {}): EngineDeps =>
  ({ store, config: { ...CONFIG, ...over }, llm, mailer: fakeMailer(), push: fakePush() });

async function onboard(): Promise<string> {
  const { userId } = await store.upsertDeviceUser(crypto.randomUUID() + crypto.randomUUID(), "en");
  const out = await patchProfile(makeDeps(), userId, {
    goal: "lose", sex: "female", birth_year: 1990, height_cm: 165, weight_kg: 70,
    target_weight_kg: 65, activity: "moderate", pace: "steady", country: "de",
    restrictions: [], complete_onboarding: true,
  });
  if (!out || !out.ok) throw new Error("onboarding failed");
  return userId;
}

const jpeg = () => { const b = new Uint8Array(10).fill(1); b[0] = 0xff; b[1] = 0xd8; return b; };
const photo = (over: Record<string, unknown> = {}) => ({ images: [async () => jpeg()], ...over });

/** The demo ports, with the analyzer counted — "ran once" is the claim under test. */
function counted(): { llm: LlmPorts; calls: () => number } {
  const base = demoPorts();
  let n = 0;
  return {
    llm: {
      ...base,
      analyzePhoto: (input, onDelta) => { n++; return base.analyzePhoto(input, onDelta); },
      routeText: (input) => { n++; return base.routeText(input); },
    },
    calls: () => n,
  };
}

beforeEach(() => { store = memoryStore(); });

describe("a replayed turn", () => {
  it("logs a photo once, charges it once, and answers the replay with the first result", async () => {
    const userId = await onboard();
    const { llm, calls } = counted();
    const d = makeDeps(llm);
    const clientId = crypto.randomUUID();
    const first = await logPhotoMeal(d, userId, photo({ clientId }));
    const again = await logPhotoMeal(d, userId, photo({ clientId }));
    expect(first.kind).toBe("logged");
    expect(again).toEqual(first);
    expect(calls()).toBe(1);
    expect(await store.countUserAnalyses(userId)).toBe(1);
    expect(await store.mealsForDate(userId, localDate(ZONE))).toHaveLength(1);
    const thread = await store.chatBefore(userId, null, 50);
    expect(thread.filter((m) => m.role === "user")).toHaveLength(1);
  });

  it("runs a typed turn once and keeps one line for it", async () => {
    const userId = await onboard();
    const { llm, calls } = counted();
    const d = makeDeps(llm);
    const clientId = crypto.randomUUID();
    const first = await handleText(d, userId, { text: "two eggs and toast", clientId });
    const again = await handleText(d, userId, { text: "two eggs and toast", clientId });
    expect(first.kind).toBe("proposed");
    expect(again).toEqual(first);
    expect(calls()).toBe(1);
    expect(await store.countUserAnalyses(userId)).toBe(1);
    const lines = (await store.chatBefore(userId, null, 50)).filter((m) => m.role === "user");
    expect(lines.map((m) => m.role === "user" && m.kind === "text" ? m.clientId : null)).toEqual([clientId]);
  });

  it("waits for a first attempt still running, and answers with what it did", async () => {
    const userId = await onboard();
    const base = demoPorts();
    let started!: () => void;
    const running = new Promise<void>((r) => { started = r; });
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    let n = 0;
    const llm: LlmPorts = {
      ...base,
      analyzePhoto: async (input, onDelta) => { n++; started(); await gate; return base.analyzePhoto(input, onDelta); },
    };
    const d = makeDeps(llm);
    const clientId = crypto.randomUUID();
    const first = logPhotoMeal(d, userId, photo({ clientId }));
    await running;
    // The connection dropped mid-analysis and the phone sent it again.
    const replay = logPhotoMeal(d, userId, photo({ clientId }));
    release();
    const [a, b] = await Promise.all([first, replay]);
    expect(b).toEqual(a);
    expect(n).toBe(1);
    expect(await store.countUserAnalyses(userId)).toBe(1);
  });

  it("answers a refusal with the refusal, and a new id is a new turn", async () => {
    const userId = await onboard();
    const d = makeDeps(demoPorts(), { freeAnalyses: 0 });
    const clientId = crypto.randomUUID();
    expect((await logPhotoMeal(d, userId, photo({ clientId }))).kind).toBe("subscription-required");
    // Bought in between: the SAME id is still the turn that was refused — the phone asks again
    // with a new one, which is a deliberate second turn rather than a replay.
    const paid = makeDeps(demoPorts(), { freeAnalyses: 5 });
    expect((await logPhotoMeal(paid, userId, photo({ clientId }))).kind).toBe("subscription-required");
    expect((await logPhotoMeal(paid, userId, photo({ clientId: crypto.randomUUID() }))).kind).toBe("logged");
  });

  it("is an unknown, never a rerun, when the first attempt failed mid-turn", async () => {
    const userId = await onboard();
    const { llm, calls } = counted();
    const d = makeDeps(llm);
    const clientId = crypto.randomUUID();
    const insert = store.insertMeal;
    store.insertMeal = async () => { throw new Error("disk full"); };
    await expect(logPhotoMeal(d, userId, photo({ clientId }))).rejects.toThrow("disk full");
    store.insertMeal = insert;
    await expect(logPhotoMeal(d, userId, photo({ clientId }))).rejects.toBeInstanceOf(TurnUnsettled);
    expect(calls()).toBe(1);
    expect(await store.mealsForDate(userId, localDate(ZONE))).toHaveLength(0);
  });

  it("is an unknown once a claim has stood unanswered past the turn's own budget", async () => {
    // A process that died mid-turn (a deploy) leaves a claim with no answer. The replay must not
    // wait forever, and must not run the turn: the first one may have logged the meal.
    const tenMinutesAgo = Date.now() - 10 * 60_000;
    store = memoryStore({ now: () => tenMinutesAgo });
    const userId = await onboard();
    const clientId = crypto.randomUUID();
    await store.claimTurn(userId, clientId);
    const { llm, calls } = counted();
    await expect(logPhotoMeal(makeDeps(llm), userId, photo({ clientId }))).rejects.toBeInstanceOf(TurnUnsettled);
    expect(calls()).toBe(0);
  });

  it("is an unknown once the answer is older than it is kept for, even before the sweep forgot it", async () => {
    // The sweep runs daily, so an answer can sit a day past its time; it is not served past it.
    let now = Date.now();
    store = memoryStore({ now: () => now });
    const userId = await onboard();
    const clientId = crypto.randomUUID();
    const { llm, calls } = counted();
    now -= TURN_OUTCOME_TTL_MS + 60_000;
    expect((await logPhotoMeal(makeDeps(llm), userId, photo({ clientId }))).kind).toBe("logged");
    await expect(logPhotoMeal(makeDeps(llm), userId, photo({ clientId }))).rejects.toBeInstanceOf(TurnUnsettled);
    expect(calls()).toBe(1);
  });

  it("runs as before without an id", async () => {
    const userId = await onboard();
    const { llm, calls } = counted();
    const d = makeDeps(llm);
    await logPhotoMeal(d, userId, photo());
    await logPhotoMeal(d, userId, photo());
    expect(calls()).toBe(2);
  });
});

describe("a turn captured earlier", () => {
  const at = (date: string, hhmm: string): string => {
    // The instant that reads `date hhmm` in the server's zone, found by walking UTC hours.
    for (let h = -14; h <= 14; h++) {
      const probe = new Date(`${date}T${hhmm}:00Z`);
      probe.setUTCHours(probe.getUTCHours() + h);
      if (localDate(ZONE, probe) === date && new Intl.DateTimeFormat("en-GB", { timeZone: ZONE, hour: "2-digit", minute: "2-digit", hour12: false }).format(probe) === hhmm) {
        return probe.toISOString();
      }
    }
    throw new Error("no such instant");
  };

  it("dates the meal when it was eaten, and charges the day it was sent", async () => {
    const userId = await onboard();
    const today = localDate(ZONE);
    const yesterday = dateMinus(today, 1);
    const base = demoPorts();
    let told = "";
    const llm: LlmPorts = { ...base, analyzePhoto: (input, onDelta) => { told = input.localTime ?? ""; return base.analyzePhoto(input, onDelta); } };
    const res = await logPhotoMeal(makeDeps(llm), userId, photo({ capturedAt: at(yesterday, "20:15") })) as LogPhotoResult;
    if (res.kind !== "logged") throw new Error(res.kind);
    expect(res.date).toBe(yesterday);
    expect(told).toBe("20:15");
    const [meal] = await store.mealsForDate(userId, yesterday);
    expect(localDate(ZONE, new Date(meal!.ts))).toBe(yesterday);
    // The cap is today's: a backdated capture must not be a way around a daily allowance.
    expect(await store.countUserPhotos(userId, today)).toBe(1);
    expect(await store.countUserPhotos(userId, yesterday)).toBe(0);
  });

  it("resolves a typed meal against the day it was typed", async () => {
    const userId = await onboard();
    const yesterday = dateMinus(localDate(ZONE), 1);
    const res = await handleText(makeDeps(), userId, { text: "porridge with berries", capturedAt: at(yesterday, "08:30") });
    if (res.kind !== "proposed") throw new Error(res.kind);
    expect(res.date).toBe(yesterday);
    const said = await handleText(makeDeps(), userId, { text: "a banana yesterday", capturedAt: at(yesterday, "08:30") });
    if (said.kind !== "proposed") throw new Error(said.kind);
    expect(said.date).toBe(dateMinus(yesterday, 1));
  });

  it("reads an unusable capture time as now", () => {
    const now = Date.parse("2026-09-17T12:00:00Z");
    expect(eatenAt(undefined, now).getTime()).toBe(now);
    expect(eatenAt("not a date", now).getTime()).toBe(now);
    // A phone clock ahead of the server's is not a meal in the future.
    expect(eatenAt("2026-09-18T12:00:00Z", now).getTime()).toBe(now);
    expect(eatenAt("1970-01-01T00:00:00Z", now).getTime()).toBe(now);
    expect(eatenAt("2026-09-16T19:00:00Z", now).toISOString()).toBe("2026-09-16T19:00:00.000Z");
  });

  it("reads a capture time within a few minutes of now as now, so a slow phone clock moves no live meal", () => {
    // 00:01 on the server, a phone two minutes slow: the snack is today's, not yesterday's.
    const now = Date.parse("2026-09-17T22:01:00Z");
    expect(eatenAt("2026-09-17T21:59:00Z", now).getTime()).toBe(now);
    expect(eatenAt("2026-09-17T22:04:00Z", now).getTime()).toBe(now);
    expect(eatenAt("2026-09-17T21:40:00Z", now).toISOString()).toBe("2026-09-17T21:40:00.000Z");
  });
});
