import { describe, expect, it } from "bun:test";
import { createChatCore, type ChatClient, type ChatCore, type Failure, type QueuedTurn } from "./chat-core.ts";
import type { ChatEntry, ChatHistoryResponse, DeleteLineResponse, ProfileResponse } from "./contract.ts";
import type { HandleTextResult, TargetGone } from "./results.ts";
import type { ThreadEntry } from "./thread.ts";

// The Chat screen's async half (#381), driven with a fake client and no renderer: the four ways a
// turn fails, the race the synchronous read in `send`'s catch exists for, and the page that lands
// while a bubble is on its way out. None of it was reachable by `bun test` while it lived in the
// screen; `04-chat` was the only witness.

const TODAY = "2026-09-10";
let seq = 0;
const base = () => ({ id: `s${++seq}`, seq, ts: `${TODAY}T12:00:00.000Z` });
const userLine = (text: string, o: { clientId?: string; pendingId?: string } = {}): ChatEntry =>
  ({ ...base(), role: "user", kind: "text", text, clientId: o.clientId ?? null, pendingId: o.pendingId ?? null });
const said = (text: string): ChatEntry => ({ ...base(), role: "assistant", kind: "text", text, speaker: null });
const page = (entries: ChatEntry[] = []): ChatHistoryResponse => ({ entries, before: null });

const deferred = <T>() => {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};
/** Every microtask the core has queued, run out. */
const settle = () => new Promise((r) => setTimeout(r, 0));

/** What a thrown value WAS, in the terms the app's `ApiError` reports it. */
const refused = (kind: string, scope?: string): Failure => ({ kind, ...(scope ? { scope } : {}), refusal: true });
const offline: Failure = { kind: "offline", refusal: false };

/** The sample spent and nothing bought: what `sampleSpent` reads, and nothing else. */
const SPENT = { limits: { sampleUsed: true }, entitlement: { active: false } } as ProfileResponse;

function harness(o: {
  send?: () => Promise<HandleTextResult>;
  pages?: (ChatHistoryResponse | Promise<ChatHistoryResponse>)[];
  profile?: ProfileResponse | null;
  del?: (id: string) => Promise<DeleteLineResponse | TargetGone>;
  enqueue?: (turn: QueuedTurn) => Promise<void>;
  waiting?: () => boolean;
  profileFn?: () => ProfileResponse | null;
} = {}) {
  const fake = { pages: o.pages ?? [], refreshes: 0, cancelled: [] as string[] };
  const client: ChatClient = {
    chatHistory: () => Promise.resolve(fake.pages.shift() ?? page()),
    sendMessage: o.send ?? (() => Promise.resolve({ kind: "answered", text: "ok" })),
    confirmPending: () => Promise.reject(new Error("not in these tests")),
    cancelPending: (id) => { fake.cancelled.push(id); return Promise.resolve({ kind: "cancelled" }); },
    deleteLine: o.del ?? (() => Promise.reject(new Error("not in these tests"))),
  };
  const profile = o.profile ?? null;
  let n = 0;
  const core = createChatCore({
    client: () => client,
    profile: o.profileFn ?? (() => profile),
    refreshProfile: async () => { fake.refreshes++; return profile; },
    today: () => TODAY,
    // The fake rejects with the classification itself; the app's adapter derives it from `ApiError`.
    failureOf: (e) => e as Failure,
    cache: { putChat: () => {}, putMeals: () => {} },
    seed: null,
    uid: () => `c${++n}`,
    ...(o.enqueue ? { enqueue: o.enqueue } : {}),
    ...(o.waiting ? { waiting: o.waiting } : {}),
  });
  return { core, fake };
}

const user = (core: ChatCore, id: string) =>
  core.state.entries.find((e): e is ThreadEntry & { role: "user" } => e.id === id && e.role === "user");
const errors = (core: ChatCore) => core.state.entries.filter((e) => e.role === "error");

describe("send's four failure branches", () => {
  it("a refusal the user can answer keeps its words, marked refused, across the next page", async () => {
    const { core } = harness({ send: () => Promise.reject(refused("subscription-required")) });
    await core.send("two eggs and toast");
    expect(user(core, "c1")).toMatchObject({ text: "two eggs and toast", refused: true });
    expect(errors(core)).toEqual([{ id: "c2", role: "error", kind: "subscription-required", for: "c1" }]);
    // The server keeps no line for a refused turn, and the words and the ask under them outlive it:
    // after a purchase they are what gets sent, not something to type again (#261).
    core.refresh(); await settle();
    expect(user(core, "c1")?.refused).toBe(true);
    expect(errors(core)).toHaveLength(1);
  });

  it("a refusal that is final leaves the words plain, and the next page takes them and the notice", async () => {
    const { core } = harness({ send: () => Promise.reject(refused("cap-exceeded", "user")) });
    await core.send("a banana");
    const bubble = user(core, "c1")!;
    expect(bubble.failed).toBeUndefined();
    expect(bubble.refused).toBeUndefined();
    expect(errors(core)).toEqual([{ id: "c2", role: "error", kind: "cap-exceeded", scope: "user" }]);
    core.refresh(); await settle();
    expect(core.state.entries).toEqual([]);
  });

  it("analysis-failed marks the words not sent, and says the sample went, from a profile fetched then", async () => {
    const { core, fake } = harness({ send: () => Promise.reject(refused("analysis-failed")), profile: SPENT });
    await core.send("a banana");
    expect(fake.refreshes).toBe(1);
    expect(user(core, "c1")?.failed).toBe(true);
    expect(errors(core)).toEqual([{ id: "c2", role: "error", kind: "analysis-failed", scope: "sample" }]);
  });

  it("a turn that never landed is marked not sent, and survives a page that does not carry it", async () => {
    const { core } = harness({ send: () => Promise.reject(offline) });
    await core.send("a banana");
    expect(user(core, "c1")?.failed).toBe(true);
    expect(errors(core)).toEqual([{ id: "c2", role: "error", kind: "offline" }]);
    core.refresh(); await settle();
    // The words live in exactly one place until the user taps them back into the box.
    expect(user(core, "c1")?.failed).toBe(true);
  });
});

describe("a page that lands while the turn is out", () => {
  // THE RACE THE SYNCHRONOUS READ EXISTS FOR. A page drains the in-flight id the moment it
  // reconciles, before anything has rendered, and `send`'s catch reads that set to decide whether
  // its bubble was superseded. As reducer state the read would see a stale value and mark the words
  // "not sent" over a line the server already has.
  it("supersedes the bubble, and a lost answer after it says only that the card never came", async () => {
    const turn = deferred<HandleTextResult>();
    const { core, fake } = harness({ send: () => turn.promise });
    const sending = core.send("two eggs")!;
    // The server wrote the words and proposed a meal; its answer is what went missing.
    const landed = userLine("two eggs", { clientId: "c1", pendingId: "p1" });
    fake.pages.push(page([landed]));
    core.refresh(); await settle();
    expect(core.state.entries.map((e) => e.id)).toEqual([landed.id]);

    turn.reject(offline);
    await sending;
    expect(core.state.entries.map((e) => e.id)).toEqual([landed.id, "unanswered:c1"]);
    expect(user(core, "c1")).toBeUndefined();
    expect(errors(core).map((e) => e.role === "error" && e.kind)).toEqual(["unanswered"]);
  });

  it("says nothing at all when the landed turn proposed nothing", async () => {
    const turn = deferred<HandleTextResult>();
    const { core, fake } = harness({ send: () => turn.promise, profile: SPENT });
    const sending = core.send("how was my week?")!;
    const landed = userLine("how was my week?", { clientId: "c1" });
    fake.pages.push(page([landed, said("A good one.")]));
    core.refresh(); await settle();

    turn.reject(offline);
    await sending;
    expect(core.state.entries.map((e) => e.id)).toEqual([landed.id, expect.stringMatching(/^s/)]);
    expect(errors(core)).toEqual([]);
    // No profile round trip for a turn with nothing to say.
    expect(fake.refreshes).toBe(0);
  });

  it("keeps a bubble that went out after the page was asked for and before it landed", async () => {
    // The screen reconciled against the list as last RENDERED, so the bubble was dropped until the
    // next focus. The core reads its own list, which is the latest one.
    const gate = deferred<ChatHistoryResponse>();
    const turn = deferred<HandleTextResult>();
    const { core } = harness({ send: () => turn.promise, pages: [gate.promise] });
    core.refresh();
    await settle();
    void core.send("a banana");
    gate.resolve(page([said("earlier")]));
    await settle();
    expect(user(core, "c1")?.text).toBe("a banana");
  });
});

describe("one turn at a time", () => {
  it("is busy while a send is out, and refuses a second send until it lands", async () => {
    const turn = deferred<HandleTextResult>();
    const { core } = harness({ send: () => turn.promise });
    const first = core.send("one")!;
    expect(core.state.busy).toBe(true);
    expect(core.send("two")).toBeUndefined();
    turn.resolve({ kind: "answered", text: "hi" });
    await first;
    expect(core.state.busy).toBe(false);
    expect(core.state.entries.map((e) => e.role)).toEqual(["user", "assistant"]);
  });

  it("sends nothing for words that are only whitespace", () => {
    const { core } = harness();
    expect(core.send("   ")).toBeUndefined();
    expect(core.state.entries).toEqual([]);
  });
});

describe("the store", () => {
  it("tells no one when a page changes nothing, and keeps the same snapshot", async () => {
    // `useSyncExternalStore` compares snapshots by identity, so a fresh object holding the same
    // values is a whole-screen render — on every focus — for nothing.
    const hi = said("hi");
    const { core } = harness({ pages: [page([hi]), page([hi])] });
    core.refresh(); await settle();
    const before = core.state;
    let told = 0;
    core.subscribe(() => { told++; });
    core.refresh(); await settle();
    expect(told).toBe(0);
    expect(core.state).toBe(before);
  });
});

describe("the composer can turn into the ask", () => {
  // The screen swaps the camera and the composer for "Subscribe" once the profile says the sample is
  // spent, and nothing re-reads the profile when a turn SUCCEEDS — so the turn that may have spent
  // the last analysis re-reads it here, or the next thing the user met would be a refusal.
  const lastOne = { limits: { sampleUsed: false, sampleRemaining: 1 }, entitlement: { active: false } } as ProfileResponse;
  const plenty = { limits: { sampleUsed: false, sampleRemaining: 9 }, entitlement: { active: false } } as ProfileResponse;

  it("a turn that may have spent the last of the sample re-reads the profile", async () => {
    const { core, fake } = harness({ profile: lastOne });
    await core.send("two eggs and toast"); await settle();
    expect(fake.refreshes).toBe(1);
  });

  it("a turn with analyses to spare does not", async () => {
    const { core, fake } = harness({ profile: plenty });
    await core.send("two eggs and toast"); await settle();
    expect(fake.refreshes).toBe(0);
  });

  it("a subscription-required refusal re-reads it, so the ask replaces the composer", async () => {
    const { core, fake } = harness({ profile: plenty, send: () => Promise.reject(refused("subscription-required")) });
    await core.send("two eggs and toast"); await settle();
    expect(fake.refreshes).toBe(1);
  });
});

// #608. A delete is a server write and a local removal: the line goes, its meal's cards go, the
// composer waits while it is out, and a line the server no longer has goes just the same.
describe("deleteLine", () => {
  const meal = { id: "m1", user_id: "u", ts: "2026-09-11T10:00:00.000Z", date: TODAY, isFood: true, items: [], kcal: 1, protein_g: 0, carbs_g: 0, fat_g: 0, satfat_g: 0, fiber_g: 0, sugar_g: 0, sodium_mg: 0, verdicts: {}, confidence: "high" as const, notes: "", corrected: false, model: "t" };
  const seeded = (): ChatHistoryResponse => ({ before: null, entries: [
    { id: "p1", seq: 1, ts: meal.ts, role: "user", kind: "photo", text: "rice", mealId: "m1" },
    { id: "c1", seq: 2, ts: meal.ts, role: "assistant", kind: "meal", event: "logged", mealId: "m1", meal },
    { id: "t1", seq: 3, ts: meal.ts, role: "user", kind: "text", text: "hi", clientId: null, pendingId: null },
  ] });

  it("a photo line: the line and its card go, and the day is the answer", async () => {
    const asked: string[] = [];
    const { core } = harness({ pages: [seeded()], del: async (id) => { asked.push(id); return { kind: "deleted", mealId: "m1", date: TODAY }; } });
    core.refresh(); await settle();
    expect(await core.deleteLine("p1")).toBe(TODAY);
    expect(asked).toEqual(["p1"]);
    expect(core.state.entries.map((e) => e.id)).toEqual(["t1"]);
    expect(core.state.busy).toBe(false);
  });

  it("a text line goes alone and answers null", async () => {
    const { core } = harness({ pages: [seeded()], del: async () => ({ kind: "deleted", mealId: null, date: null }) });
    core.refresh(); await settle();
    expect(await core.deleteLine("t1")).toBeNull();
    expect(core.state.entries.map((e) => e.id)).toEqual(["p1", "c1"]);
  });

  it("target-gone: the line was already gone elsewhere, so it goes here too", async () => {
    const { core } = harness({ pages: [seeded()], del: async () => ({ kind: "target-gone", on: "correction" }) });
    core.refresh(); await settle();
    expect(await core.deleteLine("t1")).toBeNull();
    expect(core.state.entries.map((e) => e.id)).toEqual(["p1", "c1"]);
  });

  it("a failure is a bubble, and the line stays", async () => {
    const { core } = harness({ pages: [seeded()], del: async () => { throw { kind: "offline" }; } });
    core.refresh(); await settle();
    expect(await core.deleteLine("t1")).toBeNull();
    // The minted error-bubble id follows the harness's own `uid` counter (`c${++n}`), not the
    // brief's `c4` — nothing else in this test calls `uid()` before the failed delete.
    expect(core.state.entries.map((e) => e.id)).toEqual(["p1", "c1", "t1", "c1"]);
    expect(core.state.entries.at(-1)).toMatchObject({ role: "error", kind: "offline" });
  });
});

describe("the outbox (#708)", () => {
  const proposed = (pendingId: string): HandleTextResult => ({
    kind: "proposed", pendingId, date: TODAY, expiresAt: "2099-01-01T00:00:00.000Z",
    analysis: {
      isFood: true, items: [], kcal: 100, protein_g: 1, carbs_g: 1, fat_g: 1, satfat_g: 0, fiber_g: 0,
      sugar_g: 0, sodium_mg: 0, verdicts: {}, confidence: "low", notes: "",
    },
  });

  it("a turn that never landed goes to the outbox under its own id, and its bubble is the outbox's now", async () => {
    const queued: QueuedTurn[] = [];
    const { core } = harness({ send: () => Promise.reject(offline), enqueue: async (t) => { queued.push(t); } });
    await core.send("a banana");
    expect(queued).toEqual([{ id: "c1", userId: null, text: "a banana", capturedAt: expect.any(String) }]);
    expect(Number.isNaN(Date.parse(queued[0]!.capturedAt))).toBe(false);
    expect(core.state.entries).toEqual([]);
    expect(core.state.busy).toBe(false);
    core.refresh(); await settle();
    expect(core.state.entries).toEqual([]);
  });

  it("a turn the server answered but could not finish is not queued: a re-send is answered the same way", async () => {
    const queued: QueuedTurn[] = [];
    const { core } = harness({ send: () => Promise.reject({ kind: "outcome-unknown", refusal: false }), enqueue: async (t) => { queued.push(t); } });
    await core.send("half that");
    expect(queued).toEqual([]);
    expect(user(core, "c1")?.failed).toBe(true);
  });

  it("an outbox that cannot keep it leaves the bubble not sent, as before", async () => {
    const { core } = harness({ send: () => Promise.reject(offline), enqueue: async () => { throw new Error("disk full"); } });
    await core.send("a banana");
    expect(user(core, "c1")?.failed).toBe(true);
  });

  it("a queued turn that landed as a proposal is offered like a live one, and retires the older offer", async () => {
    const { core, fake } = harness({ send: async () => proposed("p1") });
    await core.send("two eggs");
    fake.pages.push(page([userLine("toast", { clientId: "q1", pendingId: "p2" })]));
    await core.landed(proposed("p2"));
    expect(fake.cancelled).toEqual(["p1"]);
    const offers = core.state.entries.flatMap((e) => (e.role === "assistant" && e.result.kind === "proposed" ? [e.result.pendingId] : []));
    expect(offers).toEqual(["p2"]);
    expect(core.state.entries.some((e) => e.role === "user" && e.clientId === "q1")).toBe(true);
  });

  it("a queued turn that landed as anything else is read back from the thread", async () => {
    const { core, fake } = harness();
    fake.pages.push(page([userLine("how much protein?", { clientId: "q1" }), said("About 40 g.")]));
    await core.landed({ kind: "answered", text: "About 40 g." });
    expect(core.state.entries.map((e) => e.role)).toEqual(["user", "assistant"]);
    expect(core.state.entries.every((e) => "stored" in e && e.stored)).toBe(true);
  });

  it("a new turn joins the end of a queue that is still waiting, rather than reaching the server first", async () => {
    const queued: QueuedTurn[] = [];
    let sent = 0;
    const { core } = harness({
      send: async () => { sent++; return { kind: "answered", text: "ok" }; },
      enqueue: async (t) => { queued.push(t); }, waiting: () => true,
    });
    await core.send("and a beer");
    expect(sent).toBe(0);
    expect(queued.map((t) => t.text)).toEqual(["and a beer"]);
    expect(core.state.entries).toEqual([]);
  });

  it("the bubble stays until the outbox has the turn — the row with its id takes over without a gap — and is marked if it cannot", async () => {
    const seen: string[][] = [];
    let core!: ChatCore;
    ({ core } = harness({
      send: () => Promise.reject(offline),
      enqueue: async () => { seen.push(core.state.entries.map((e) => e.id)); throw new Error("disk full"); },
    }));
    await core.send("a banana");
    expect(seen).toEqual([["c1"]]);
    expect(user(core, "c1")?.failed).toBe(true);
  });

  it("keeps a turn for the account it was said under, not whichever is signed in when it fails", async () => {
    const queued: QueuedTurn[] = [];
    const turn = deferred<HandleTextResult>();
    let profile: ProfileResponse | null = { profile: { user_id: "a" } } as ProfileResponse;
    const { core } = harness({ send: () => turn.promise, enqueue: async (t) => { queued.push(t); }, profileFn: () => profile });
    const sending = core.send("a banana")!;
    profile = { profile: { user_id: "b" } } as ProfileResponse;
    turn.reject(offline);
    await sending;
    expect(queued.map((t) => t.userId)).toEqual(["a"]);
  });

  it("a queued correction whose meal is gone says so, like a live one", async () => {
    const { core } = harness();
    await core.landed({ kind: "target-gone", on: "correction" });
    expect(core.state.entries.some((e) => e.role === "assistant" && e.result.kind === "target-gone")).toBe(true);
  });
});

