// The turns a client could not get to the server, kept until it can (#708).
//
// A photo of a meal already eaten cannot be taken again, and the words typed about it are gone once
// the app is killed. So a billed turn whose request fails before an answer comes back is kept —
// its photos on disk, its words beside them — and sent again when there is a connection, in the
// order it was captured, under the SAME client id. The server answers a re-sent id from the first
// attempt (`engine/turns.ts`), which is what makes sending again safe when the first attempt did
// get there and only its answer was lost.
//
// SHAPED LIKE `chat-core.ts`: what it talks to is an argument. The phone keeps entries in a file and
// photos as file URIs; the browser keeps both in IndexedDB. The order, the holds and what counts as
// "try again later" are decided here once, where `bun test` reaches them.

import { UNANSWERED, type RefusedTurn } from "./results.ts";

export interface Queued<Photo> {
  /** The turn's client id: the server's idempotency key, and this entry's id. */
  id: string;
  /** The account it was captured under. It is never sent under another. */
  userId: string;
  kind: "photo" | "text";
  /** A photo's note, or the message. */
  text: string | null;
  /** The angles of one meal — a file URI on the phone, a Blob in the browser. Empty for text. */
  photos: Photo[];
  /** When the photo was taken or the words typed: the meal is dated by it, not by the send. */
  capturedAt: string;
  /** The meal a queued correction was about, as it was when typed. */
  focusMealId?: string;
  /**
   * The server answered, and not with a result: a refusal, a failed analysis, a turn it could not
   * finish. Worded against this entry the way a live refusal is, kept until the person sends it
   * again or discards it — never retried on its own, because the same id is answered the same way —
   * and the entries behind it wait.
   */
  held?: RefusedTurn;
}

/** A queued turn's attempt: try later (nothing answered it), or hold it (something did). */
export type Attempt = "retry" | "hold";

/**
 * `offline` and `UNANSWERED` are the transport's words for a request that got no answer — the
 * second may have run on the server, and is exactly what a re-send under the same id is for.
 * Anything else was answered.
 */
export const attemptOf = (failure: RefusedTurn): Attempt =>
  failure.kind === "offline" || failure.kind === UNANSWERED ? "retry" : "hold";

/**
 * Whether a turn said now joins the END of `userId`'s queue rather than going out live: whenever
 * anything of the account's is WAITING anywhere in it, held head or not. Sent live, it would reach the
 * server first, and the waiting turn's estimate would later replace the one just asked for. With only
 * held turns there, nothing goes on its own before a decision, so a new turn goes now.
 */
export const joinsQueue = (entries: readonly Queued<unknown>[], userId: string): boolean =>
  entries.some((e) => e.userId === userId && e.held === undefined);

/** Whether `userId`'s queue is stopped on a held turn: a turn at its end waits on a decision, not a connection. */
export const heldAhead = (entries: readonly Queued<unknown>[], userId: string): boolean =>
  entries.find((e) => e.userId === userId)?.held !== undefined;

export type OutboxEvent<Photo> =
  | { kind: "sent"; entry: Queued<Photo>; result: { kind: string } }
  | { kind: "held"; entry: Queued<Photo> };

export interface OutboxPorts<Photo> {
  load(): Promise<Queued<Photo>[]>;
  /** Throws when it could not: nothing is believed that was not saved. */
  save(entries: Queued<Photo>[]): Promise<void>;
  /** One attempt. Resolves with the server's result; throws whatever else happened, refusals included. */
  send(entry: Queued<Photo>): Promise<{ kind: string }>;
  /** What a thrown value was, in the client's vocabulary: `offline`, `UNANSWERED`, or what the server said. */
  failureOf(e: unknown): RefusedTurn;
  /** Delete what the entry keeps at rest: its photos. Called once the server has the turn, or it is discarded. */
  release(entry: Queued<Photo>): Promise<void> | void;
  uid(): string;
  /**
   * Run one read-modify-write with nobody else writing. The browser passes a Web Lock: two tabs share
   * one IndexedDB, and a tab writing its own stale list over another's drops that tab's photo.
   * Absent, writes are one at a time within this process, which is all the phone has.
   */
  exclusive?<T>(fn: () => Promise<T>): Promise<T>;
}

export interface Outbox<Photo> {
  readonly entries: readonly Queued<Photo>[];
  /** The id of the turn on its way to the server right now, if any: it can no longer be taken back. */
  readonly sending: string | null;
  /** Loaded from where the last process left them. Every method waits for it. */
  readonly ready: Promise<void>;
  /** Called on every change; with an event when a turn was answered. */
  subscribe(listener: (event?: OutboxEvent<Photo>) => void): () => void;
  /** Throws when it could not be kept, and then nothing of it is. */
  add(entry: Queued<Photo>): Promise<void>;
  /** Send `userId`'s entries in order until one cannot get through or is held. One drain at a time. */
  drain(userId: string): Promise<void>;
  /**
   * Ask again after a hold, under a NEW id — the old one is the turn that was refused — and start a
   * drain, NOT awaited: a caller holding its controls must not hold them for every turn behind it.
   */
  resend(id: string, userId: string): Promise<void>;
  /** False, and nothing done, for the turn on its way: its upload runs on, and it would be logged anyway. */
  discard(id: string): Promise<boolean>;
  /** Everything goes, photos included: the account on this device is ending. */
  clear(): Promise<void>;
  /** An anonymous account merged into a real one: its turns are the survivor's now. */
  retag(from: string, to: string): Promise<void>;
}

export function createOutbox<Photo>(ports: OutboxPorts<Photo>): Outbox<Photo> {
  let entries: Queued<Photo>[] = [];
  const listeners = new Set<(event?: OutboxEvent<Photo>) => void>();
  const notify = (event?: OutboxEvent<Photo>) => { for (const l of listeners) l(event); };
  const ready = ports.load().then((loaded) => { entries = loaded; }, () => { entries = []; });

  let writes: Promise<unknown> = ready;
  /**
   * ONE WRITE AT A TIME, AGAINST WHAT STORAGE HOLDS NOW, SAVED BEFORE IT IS BELIEVED. Read fresh,
   * because another tab may have written since this one loaded; saved first, because an entry kept
   * only in memory after its save failed is sent later under an id its caller was told was not kept
   * — and a person who then types it again has logged it twice.
   */
  const change = <T>(edit: (prev: Queued<Photo>[]) => { next: Queued<Photo>[]; out: T; event?: OutboxEvent<Photo> }): Promise<T> => {
    const run = writes.then(() => (ports.exclusive ?? ((fn) => fn()))(async () => {
      const { next, out, event } = edit(await ports.load());
      await ports.save(next);
      entries = next;
      notify(event);
      return out;
    }));
    writes = run.catch(() => {});
    return run;
  };

  let sending: string | null = null;
  const sendingNow = (id: string | null) => { sending = id; notify(); };
  /**
   * The next turn to send, CHOSEN AND MARKED SENDING IN THE WRITE CHAIN: a discard is one of those
   * writes, so the two are ordered — a turn is either discarded before it is picked, or picked and
   * then refused a discard. Read outside the chain, a drain could pick a turn whose discard was
   * already saving, send it, and the discard report it gone.
   */
  const pick = (userId: string): Promise<Queued<Photo> | undefined> => {
    const run = writes.then(() => (ports.exclusive ?? ((fn) => fn()))(async () => {
      const next = (await ports.load()).find((e) => e.userId === userId);
      if (next && !next.held) sendingNow(next.id);
      return next;
    }));
    writes = run.catch(() => {});
    return run;
  };
  let draining: Promise<void> | null = null;
  const drain = (userId: string): Promise<void> => (draining ??= (async () => {
    try {
      await ready;
      for (;;) {
        // What storage holds now: a turn another tab kept goes too, and one it sent does not go twice.
        const next = await pick(userId);
        if (!next || next.held) return;
        let result: { kind: string };
        try {
          result = await ports.send(next);
        } catch (e) {
          const failure = ports.failureOf(e);
          if (attemptOf(failure) === "retry") { sendingNow(null); return; }
          // Onto the entry as storage holds it NOW, not the copy sent: a merge may have moved it meanwhile.
          await change((prev) => {
            const now = prev.find((x) => x.id === next.id);
            const held = { ...(now ?? next), held: failure };
            return { next: prev.map((x) => (x.id === next.id ? held : x)), out: undefined, ...(now ? { event: { kind: "held", entry: held } as const } : {}) };
          });
          sendingNow(null);
          return;
        }
        // Answered: the entry goes, then its photos. A save that fails here keeps the entry, and the
        // next drain sends it again under the same id, which the server answers from this turn.
        // The event carries the entry as it is NOW: a merge may have moved it to another account
        // meanwhile. `sending` clears only AFTER, or the answered turn is offered for discarding again.
        await change((prev) => ({
          next: prev.filter((x) => x.id !== next.id), out: undefined,
          event: { kind: "sent", entry: prev.find((x) => x.id === next.id) ?? next, result },
        }));
        sendingNow(null);
        await ports.release(next);
      }
    } catch {
      // Storage failed under the drain: the next one starts from what is saved.
    } finally {
      if (sending !== null) sendingNow(null);
      draining = null;
    }
  })());

  return {
    get entries() { return entries; },
    get sending() { return sending; },
    ready,
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    add: (entry) => change((prev) => ({ next: [...prev, entry], out: undefined })),
    drain,
    async resend(id, userId) {
      const uid = ports.uid();
      await change((prev) => ({
        next: prev.map((e) => {
          if (e.id !== id) return e;
          const { held: _refused, ...rest } = e;
          return { ...rest, id: uid };
        }),
        out: undefined,
      }));
      void drain(userId);
    },
    async discard(id) {
      if (id === sending) return false;
      const gone = await change((prev) => (id === sending
        ? { next: prev, out: undefined }
        : { next: prev.filter((e) => e.id !== id), out: prev.find((e) => e.id === id) }));
      if (gone) await ports.release(gone);
      return gone !== undefined;
    },
    async clear() {
      const gone = await change((prev) => ({ next: [], out: prev }));
      for (const e of gone) await ports.release(e);
    },
    retag: (from, to) => change((prev) => ({ next: prev.map((e) => (e.userId === from ? { ...e, userId: to } : e)), out: undefined })),
  };
}
