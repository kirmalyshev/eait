import { describe, expect, it } from "bun:test";
import { createChatCore, type ChatClient, type ChatCore, type Failure } from "./chat-core.ts";
import type { ChatEntry, ChatHistoryResponse, ProfileResponse } from "./contract.ts";
import type { HandleTextResult } from "./results.ts";
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
} = {}) {
  const fake = { pages: o.pages ?? [], refreshes: 0 };
  const client: ChatClient = {
    chatHistory: () => Promise.resolve(fake.pages.shift() ?? page()),
    sendMessage: o.send ?? (() => Promise.resolve({ kind: "answered", text: "ok" })),
    confirmPending: () => Promise.reject(new Error("not in these tests")),
    cancelPending: () => Promise.resolve({ kind: "cancelled" }),
  };
  const profile = o.profile ?? null;
  let n = 0;
  const core = createChatCore({
    client: () => client,
    profile: () => profile,
    refreshProfile: async () => { fake.refreshes++; return profile; },
    today: () => TODAY,
    // The fake rejects with the classification itself; the app's adapter derives it from `ApiError`.
    failureOf: (e) => e as Failure,
    cache: { putChat: () => {}, putMeals: () => {} },
    seed: null,
    uid: () => `c${++n}`,
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
