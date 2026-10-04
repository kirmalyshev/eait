// The browser's outbox (#708): a photo or a message that could not reach the server, kept in
// IndexedDB until it can, then sent under the id it was first sent with.
//
// INDEXEDDB, NOT localStorage: a photo is a Blob, and localStorage holds strings. What is kept is the
// turn and nothing that authenticates it — the bearer stays in `api.ts`'s closure, so a queued turn
// waits for a session exactly like everything else here. The photos are health data at rest: they
// go the moment the server has the turn, when the person discards it, and on sign-out.
//
// The order, the holds and what counts as "try again later" are `src/shared/outbox.ts`, by RELATIVE
// path for the reason `main.ts` gives for `stream.ts`.

import { createOutbox, type Outbox, type Queued } from "../shared/outbox.ts";
import {
  PHOTO_MODEL_CALLS, SERVER_LLM_TIMEOUT_MS, TEXT_MODEL_CALLS, clientModelTimeoutMs,
} from "../shared/contract.ts";
import type { RefusedTurn } from "../shared/results.ts";
import type { IDEMPOTENCY_KEY, MessageRequest, MessageResponse, OUTCOME_UNKNOWN, PhotoLast, ROUTES } from "@eait/shared/contract";
import { ApiError, Unauthenticated, api, apiStream } from "./api.ts";

type Under<P extends string> = P extends `/v1${infer R}` ? R : never;
const PHOTO: Under<typeof ROUTES.photo> = "/meals/photo";
const MESSAGES: Under<typeof ROUTES.messages> = "/messages";
const UNKNOWN: typeof OUTCOME_UNKNOWN = "outcome-unknown";
/** The header the server reads a turn's id from before its body — see `IDEMPOTENCY_KEY`. */
const IDEMPOTENCY: typeof IDEMPOTENCY_KEY = "idempotency-key";

/** A photo turn keeps its files; a text turn keeps none. */
export type WebQueued = Queued<File>;

/**
 * The per-call model budget the RUNNING server has — `Limits.modelCallTimeoutMs` once a profile
 * has landed (`setModelCallTimeout` below), the shared default before. It sizes how long the
 * drain's deadline gives one send, so a request the server could still be working on is never
 * called unknown early.
 */
let modelCallTimeoutMs = SERVER_LLM_TIMEOUT_MS;
export const setModelCallTimeout = (ms: number): void => { modelCallTimeoutMs = ms; };

/**
 * How long ONE send may go unanswered before it is called unknown (#327) — the wait its route can
 * legitimately take: the running server's per-call budget spent by the calls that route makes,
 * plus the round trip (`clientModelTimeoutMs`). Past it, an entry the drain owns is held as the
 * unknown it is and the drain moves on; a LIVE send that outlives it is kept held the same way.
 */
export const sendDeadlineMs = (entry: WebQueued): number =>
  clientModelTimeoutMs(modelCallTimeoutMs, entry.kind === "photo" ? PHOTO_MODEL_CALLS : TEXT_MODEL_CALLS);

/**
 * ONE SEND, live and queued alike. A refusal the stream carries in-band is thrown as the `ApiError`
 * the JSON path throws, so a caller has one catch for everything that is not a result. `signal` is
 * the drain's deadline (#327): reaching the fetch is what frees the connection it bounds.
 */
export async function sendTurn(entry: WebQueued, onLine?: (line: unknown) => void, signal?: AbortSignal): Promise<MessageResponse | PhotoLast> {
  if (entry.kind === "photo") {
    const form = new FormData();
    for (const f of entry.photos) form.append("photo", f);
    if (entry.text) form.append("caption", entry.text);
    form.append("clientId", entry.id);
    form.append("capturedAt", entry.capturedAt);
    const r = await apiStream<PhotoLast>(PHOTO, { method: "POST", body: form, signal: signal ?? null, headers: { [IDEMPOTENCY]: entry.id } }, onLine);
    if (r.kind !== "logged") throw new ApiError(200, { error: r.kind, ...("scope" in r ? { scope: r.scope } : {}) }, `photo: ${r.kind}`);
    return r;
  }
  const body: MessageRequest = {
    text: entry.text ?? "", clientId: entry.id, capturedAt: entry.capturedAt,
    ...(entry.focusMealId ? { focusMealId: entry.focusMealId } : {}),
  };
  // Streamed like the photo send: a routed turn can be silent for tens of seconds (#70), the
  // server's keepalives hold it open, and its progress lines reach `onLine` as they arrive.
  return await apiStream<MessageResponse>(MESSAGES, {
    method: "POST", headers: { "content-type": "application/json", [IDEMPOTENCY]: entry.id }, body: JSON.stringify(body), signal: signal ?? null,
  }, onLine);
}

/**
 * Whether a thrown value means the turn got NO ANSWER, which is the one thing worth sending again
 * on its own: `fetch` refusing (offline, a reset connection — a `TypeError`, and so is a body that
 * dies mid-stream), or an edge 5xx with no body of ours in it. A stream that closed with no last
 * line is NOT this: the server answered with a 200 and then could not finish, which is the unknown
 * a replay would only repeat.
 */
export const noAnswer = (err: unknown): boolean =>
  err instanceof TypeError || (err instanceof ApiError && err.status >= 500 && typeof err.body?.error !== "string");

export function failureOf(err: unknown): RefusedTurn {
  // No session yet is not an answer either: the entry waits for one, like everything else here.
  if (noAnswer(err) || err instanceof Unauthenticated) return { kind: "offline" };
  if (err instanceof ApiError && typeof err.body?.error === "string") {
    return { kind: err.body.error, ...(typeof err.body.scope === "string" ? { scope: err.body.scope } : {}) };
  }
  return { kind: UNKNOWN };
}

const DB = "eait";
const STORE = "outbox";
const KEY = "entries";

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB, 1);
    open.onupgradeneeded = () => { open.result.createObjectStore(STORE); };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
}

async function idb<T>(mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await database();
  try {
    // On the TRANSACTION's completion, not the request's success: a write is durable only then, and
    // a reload in between would come back to the list as it was.
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = op(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result as T);
      tx.onerror = tx.onabort = () => reject(tx.error ?? req.error);
    });
  } finally {
    db.close();
  }
}

export const outbox: Outbox<File> = createOutbox<File>({
  load: async () => (await idb<WebQueued[] | undefined>("readonly", (s) => s.get(KEY))) ?? [],
  save: async (entries) => { await idb("readwrite", (s) => s.put(entries, KEY)); },
  send: (entry, signal) => sendTurn(entry, undefined, signal),
  sendDeadlineMs,
  failureOf,
  // The Blobs are IN the record, so saving the list without the entry is what lets go of them.
  release: () => {},
  uid: () => crypto.randomUUID(),
  // Every tab of this origin writes the one list: one write at a time across all of them, or a tab
  // saving its own stale copy drops the photo another tab just kept.
  ...(typeof navigator !== "undefined" && navigator.locks
    ? { exclusive: <T>(fn: () => Promise<T>) => navigator.locks.request("eait-outbox", fn) as Promise<T> }
    : {}),
});
