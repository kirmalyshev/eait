import { describe, expect, it } from "bun:test";
import { OUTCOME_UNKNOWN } from "./contract.ts";
import { attemptOf, createOutbox, heldAhead, joinsQueue, type OutboxEvent, type OutboxPorts, type Queued } from "./outbox.ts";
import { UNANSWERED, type RefusedTurn } from "./results.ts";

/** Thrown by the fake transport, carrying what the client's extractor would have read off it. */
class Failed extends Error { constructor(readonly turn: RefusedTurn) { super(turn.kind); } }

/** Storage, which two outboxes may share: two browser tabs over one IndexedDB. */
type Disk = { entries: Queued<string>[]; failNextSave?: boolean };

function harness(saved: Queued<string>[] | Disk = []) {
  const store: Disk = Array.isArray(saved) ? { entries: structuredClone(saved) } : saved;
  const sent: string[] = [];
  const released: string[] = [];
  let answer: (e: Queued<string>) => Promise<{ kind: string }> = async () => ({ kind: "logged" });
  let ids = 0;
  const ports: OutboxPorts<string> = {
    load: async () => structuredClone(store.entries),
    save: async (entries) => {
      if (store.failNextSave) { store.failNextSave = false; throw new Error("quota"); }
      store.entries = structuredClone(entries);
    },
    send: (e) => { sent.push(e.id); return answer(e); },
    failureOf: (e) => (e instanceof Failed ? e.turn : { kind: "offline" }),
    release: (e) => { released.push(...e.photos); },
    uid: () => `new-${++ids}`,
  };
  const box = createOutbox(ports);
  const events: OutboxEvent<string>[] = [];
  box.subscribe((ev) => { if (ev) events.push(ev); });
  return {
    box, sent, released, events, disk: () => store.entries, store,
    answer: (fn: typeof answer) => { answer = fn; },
  };
}

const photo = (id: string, userId = "u1"): Queued<string> =>
  ({ id, userId, kind: "photo", text: null, photos: [`${id}.jpg`], capturedAt: "2026-09-17T08:00:00.000Z" });
const text = (id: string, words: string, userId = "u1"): Queued<string> =>
  ({ id, userId, kind: "text", text: words, photos: [], capturedAt: "2026-09-17T08:00:00.000Z" });

describe("what an attempt says about a queued turn", () => {
  it("retries only what never got an answer, and holds everything the server said", () => {
    expect(attemptOf({ kind: "offline" })).toBe("retry");
    expect(attemptOf({ kind: UNANSWERED })).toBe("retry");
    for (const kind of ["subscription-required", "cap-exceeded", "analysis-failed", "not-food", "unsupported-image", OUTCOME_UNKNOWN, "internal"]) {
      expect(attemptOf({ kind })).toBe("hold");
    }
  });
});

describe("the outbox", () => {
  it("survives a restart: what was added is what the next process loads", async () => {
    const h = harness();
    await h.box.ready;
    await h.box.add(photo("a"));
    await h.box.add(text("b", "two eggs"));
    const again = harness(h.disk());
    await again.box.ready;
    expect(again.box.entries.map((e) => e.id)).toEqual(["a", "b"]);
  });

  it("sends in order, once each, and lets go of a photo only once the server has it", async () => {
    const h = harness([photo("a"), text("b", "two eggs"), photo("c")]);
    await h.box.ready;
    await h.box.drain("u1");
    expect(h.sent).toEqual(["a", "b", "c"]);
    expect(h.released).toEqual(["a.jpg", "c.jpg"]);
    expect(h.box.entries).toEqual([]);
    expect(h.disk()).toEqual([]);
    expect(h.events.map((e) => e.kind === "sent" && e.entry.id)).toEqual(["a", "b", "c"]);
  });

  it("stops at the first turn that still cannot get through, and keeps it and everything after", async () => {
    const h = harness([photo("a"), photo("b")]);
    await h.box.ready;
    h.answer(async () => { throw new Failed({ kind: "offline" }); });
    await h.box.drain("u1");
    expect(h.sent).toEqual(["a"]);
    expect(h.box.entries.map((e) => e.id)).toEqual(["a", "b"]);
    expect(h.released).toEqual([]);
    // Back online: the same ids go, so a turn that DID reach the server is answered from it.
    h.answer(async () => ({ kind: "logged" }));
    await h.box.drain("u1");
    expect(h.sent).toEqual(["a", "a", "b"]);
  });

  it("holds a refused turn where it is, with the refusal, and waits behind it", async () => {
    const h = harness([text("a", "a banana"), photo("b")]);
    await h.box.ready;
    h.answer(async () => { throw new Failed({ kind: "cap-exceeded", scope: "user" }); });
    await h.box.drain("u1");
    expect(h.box.entries[0]).toMatchObject({ id: "a", held: { kind: "cap-exceeded", scope: "user" } });
    expect(h.disk()[0]!.held).toEqual({ kind: "cap-exceeded", scope: "user" });
    h.answer(async () => ({ kind: "logged" }));
    await h.box.drain("u1");
    // Nothing jumped the queue.
    expect(h.sent).toEqual(["a"]);
  });

  it("asks again after a hold under a NEW id — the old one is the turn that was refused", async () => {
    const h = harness([photo("a"), photo("b")]);
    await h.box.ready;
    h.answer(async () => { throw new Failed({ kind: "subscription-required" }); });
    await h.box.drain("u1");
    h.answer(async () => ({ kind: "logged" }));
    // Not awaited by `resend` — a caller holding its controls must not hold them for a whole drain.
    await h.box.resend("a", "u1");
    await h.box.drain("u1");
    expect(h.sent).toEqual(["a", "new-1", "b"]);
    expect(h.box.entries).toEqual([]);
  });

  it("discards a turn and its photos", async () => {
    const h = harness([photo("a"), photo("b")]);
    await h.box.ready;
    await h.box.discard("a");
    expect(h.released).toEqual(["a.jpg"]);
    expect(h.disk().map((e) => e.id)).toEqual(["b"]);
  });

  it("sends nothing of another account's, and moves a merged account's turns to the survivor", async () => {
    const h = harness([photo("a", "anon"), photo("b", "real")]);
    await h.box.ready;
    await h.box.drain("real");
    expect(h.sent).toEqual(["b"]);
    await h.box.retag("anon", "real");
    await h.box.drain("real");
    expect(h.sent).toEqual(["b", "a"]);
  });

  it("drains one at a time however often it is asked", async () => {
    const h = harness([photo("a"), photo("b")]);
    await h.box.ready;
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    h.answer(async () => { await gate; return { kind: "logged" }; });
    const one = h.box.drain("u1");
    const two = h.box.drain("u1");
    release();
    await Promise.all([one, two]);
    expect(h.sent).toEqual(["a", "b"]);
  });

  it("forgets everything, photos included, on sign-out", async () => {
    const h = harness([photo("a"), text("b", "hi")]);
    await h.box.ready;
    await h.box.clear();
    expect(h.released).toEqual(["a.jpg"]);
    expect(h.disk()).toEqual([]);
  });

  it("believes nothing it could not save, so a turn its caller was told was not kept is never sent", async () => {
    const h = harness();
    await h.box.ready;
    h.store.failNextSave = true;
    await expect(h.box.add(photo("a"))).rejects.toThrow("quota");
    expect(h.box.entries).toEqual([]);
    await h.box.drain("u1");
    expect(h.sent).toEqual([]);
  });

  it("writes against what storage holds now, so a second tab's turn is not overwritten", async () => {
    const shared: Disk = { entries: [] };
    const a = harness(shared);
    const b = harness(shared);
    await Promise.all([a.box.ready, b.box.ready]);
    await a.box.add(photo("from-a"));
    // B loaded before A wrote; its own add must not replace A's entry with its stale list.
    await b.box.add(text("from-b", "a pear"));
    expect(shared.entries.map((e) => e.id)).toEqual(["from-a", "from-b"]);
    await a.box.drain("u1");
    expect(a.sent).toEqual(["from-a", "from-b"]);
    expect(shared.entries).toEqual([]);
  });

  it("keeps the order of writes made together", async () => {
    const h = harness();
    await h.box.ready;
    await Promise.all([h.box.add(photo("a")), h.box.add(photo("b")), h.box.add(photo("c"))]);
    expect(h.disk().map((e) => e.id)).toEqual(["a", "b", "c"]);
  });

  it("holds a refused turn as it is NOW, so a merge that moved it while it was out is not undone", async () => {
    const h = harness([photo("a", "anon")]);
    await h.box.ready;
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    h.answer(async () => { await gate; throw new Failed({ kind: "subscription-required" }); });
    const draining = h.box.drain("anon");
    // Once it is out, not before: a retag queued ahead of the pick simply moves it first.
    while (h.box.sending !== "a") await new Promise((r) => setTimeout(r, 0));
    await h.box.retag("anon", "real");
    release();
    await draining;
    expect(h.disk()[0]).toMatchObject({ id: "a", userId: "real", held: { kind: "subscription-required" } });
  });

  it("takes a new turn at the end whenever something of the account's is waiting anywhere in it", () => {
    const held = { ...photo("a"), held: { kind: "subscription-required" } };
    // Waiting, even behind a held head: a turn said now goes after it, or it lands first and the
    // waiting one's estimate replaces it later.
    expect(joinsQueue([photo("a")], "u1")).toBe(true);
    expect(joinsQueue([held, photo("b")], "u1")).toBe(true);
    // Only held: nothing will go on its own before a decision, so a turn said now goes now.
    expect(joinsQueue([held], "u1")).toBe(false);
    expect(joinsQueue([photo("a", "other")], "u1")).toBe(false);
    expect(joinsQueue([], "u1")).toBe(false);
    // And whether a turn at the end waits on somebody's decision rather than on a connection.
    expect(heldAhead([held, photo("b")], "u1")).toBe(true);
    expect(heldAhead([photo("b")], "u1")).toBe(false);
  });

  it("will not discard the turn on its way, and says it is on its way until it is gone", async () => {
    const h = harness([photo("a")]);
    await h.box.ready;
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    h.answer(async () => { await gate; return { kind: "logged" }; });
    const draining = h.box.drain("u1");
    await new Promise((r) => setTimeout(r, 0));
    expect(await h.box.discard("a")).toBe(false);
    const seen: (string | null)[] = [];
    h.box.subscribe(() => { seen.push(h.box.entries.length > 0 ? h.box.sending : "gone"); });
    release();
    await draining;
    // Never "waiting" again with the entry still there: sending clears only once it is gone.
    expect(seen).not.toContain(null);
    expect(h.sent).toEqual(["a"]);
  });

  it("says which turn is on its way, so it is not offered for discarding as though it were not", async () => {
    const h = harness([photo("a")]);
    await h.box.ready;
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    h.answer(async () => { await gate; return { kind: "logged" }; });
    expect(h.box.sending).toBeNull();
    const draining = h.box.drain("u1");
    await new Promise((r) => setTimeout(r, 0));
    expect(h.box.sending).toBe("a");
    release();
    await draining;
    expect(h.box.sending).toBeNull();
  });

  it("never both sends a turn and reports it discarded, however the two interleave", async () => {
    const h = harness([photo("a")]);
    await h.box.ready;
    // Discard's write is out (read, then save); a drain started now must not read storage behind it.
    const discarding = h.box.discard("a");
    const draining = h.box.drain("u1");
    const gone = await discarding;
    await draining;
    expect(gone && h.sent.includes("a")).toBe(false);
  });
});

