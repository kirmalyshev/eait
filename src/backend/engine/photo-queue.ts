// A photo meal, or a change to a logged one, as a durable job (ieat-app#1318, #1347, #414); the id is
// the turn's `clientId`, so `turns` keeps the outcome and the pg-boss job (`job_rows`) what is needed to run and show it.

import { hostname } from "node:os";
import {
  MEAL_UPDATE_STEPS, OUTCOME_UNKNOWN, PHOTO_MODEL_CALLS, TEXT_MODEL_CALLS, UNIT_KCAL, explainTargets, kcalNumbers, queuedPushCopy,
  streamCopyFor, updateCopyFor, fill,
  type JobEntry, type JobKind, type JobsFilter, type JobsResponse, type Lang, type MealItem, type MealLogged, type MealUpdateLast,
  type MealUpdateRequest, type MealUpdated, type PhotoJob, type PhotoJobStep, type PhotoLast, type PhotoQueuedResponse,
} from "@eait/shared";
import { imageMime } from "../llm/port.ts";
import type { JobRecord } from "../store.ts";
import { releaseSample } from "./caps.ts";
import type { EngineDeps } from "./deps.ts";
import { deleteMealById } from "./lines.ts";
import { editMeal, logPhotoTurn, reanalyzeMeal, type LogPhotoInput } from "./meals.ts";
import { textTurn } from "./text.ts";
import { bounded } from "./turns.ts";
import { sendLogged } from "./notify.ts";

const LEASE_MS = 30_000;
const HEARTBEAT_MS = 10_000;
/** The claim's poll, in case a notification is missed. */
const CLAIM_POLL_MS = 5_000;
/** A follower's re-read when no notification came: a reconnecting listener can miss one. */
const FOLLOW_POLL_MS = 2_000;
const FOLLOW_HEARTBEAT_MS = 10_000;
const FOLLOWED_MS = 15_000;
const JOBS_PAGE = 50;

/** Whose lease a job is under while this process runs it: host, pid and boot, so a recycled pid on the same host is still a different owner. */
const owner = `${hostname()}:${process.pid}:${Date.now()}`;

type Outcome = PhotoLast | MealUpdateLast;
interface JobHandler {
  /** The highest `request_version` this build reads. */
  version: number;
  calls(job: JobRecord): number;
  /** Whether a job whose worker died may run again. */
  retryable(job: JobRecord): boolean;
  run(
    deps: EngineDeps, job: JobRecord, progress: (step: PhotoJobStep, items?: MealItem[]) => void, lost: () => Error,
  ): Promise<{ result: Outcome; land: (deps: EngineDeps) => Promise<void> }>;
}

/** `port` with `name` reporting once it has answered. */
const after = <T extends object>(port: T, name: keyof T, done: () => void): T =>
  new Proxy(port, {
    get: (target, prop) => {
      const fn = Reflect.get(target, prop);
      if (prop !== name || typeof fn !== "function") return fn;
      return async (...args: unknown[]) => {
        const out = await (fn as (...a: unknown[]) => Promise<unknown>).apply(target, args);
        done();
        return out;
      };
    },
  });

type PhotoRequest = Pick<LogPhotoInput, "caption" | "capturedAt" | "receivedAt">;

const HANDLERS: Record<JobKind, JobHandler> = {
  photo: {
    version: 1,
    calls: () => PHOTO_MODEL_CALLS,
    // The meal insert and `meal_id` share a transaction, so a job with no meal has logged none.
    retryable: (job) => job.mealId === null,
    async run(deps, job, progress, lost) {
      const { userId, clientId } = job;
      // A dead attempt delivered nothing: its charge stays on the ledger, its sample is the user's again.
      if (job.attempts > 1 && job.analysisId !== null) await releaseSample(deps, userId, job.analysisId);
      const photos = await deps.store.jobPhotos(userId, clientId);
      let items: MealItem[] = [];
      const result = await logPhotoTurn(deps, userId, {
        ...(job.request as PhotoRequest),
        images: photos.map((p) => async () => p.bytes), clientId, job: { owner, lost },
      }, (e) => {
        if (e.kind !== "item") return;
        // An `index: 0` after others is the analyzer starting over.
        items = [...items.slice(0, e.index), e.item];
        progress(3, items);
      }, () => progress(4, items));
      return {
        result,
        land: async (d) => {
          if (result.kind !== "logged") return;
          if ((await d.store.getJob(userId, clientId))?.removedAt != null) await deleteMealById(d, userId, result.mealId);
          else if (await d.store.claimPush(userId, clientId)) await pushCounted(d, userId, result);
        },
      };
    },
  },
  "meal-update": {
    version: 1,
    calls: (job) => (job.request as MealUpdateRequest).kind === "note" ? TEXT_MODEL_CALLS : PHOTO_MODEL_CALLS,
    // `ingredients` and `reread` overwrite the meal; a note writes chat lines that a second run would repeat.
    retryable: (job) => (job.request as MealUpdateRequest).kind !== "note",
    async run(deps, job, progress) {
      const { userId, clientId } = job;
      const input = job.request as MealUpdateRequest;
      const was = await deps.store.getMeal(userId, input.mealId);
      const to = (step: PhotoJobStep) => () => progress(step);
      let result: MealUpdateLast;
      switch (input.kind) {
        case "ingredients":
          to(2)();
          result = await editMeal(deps, userId, input.mealId, input.edit);
          break;
        case "reread":
          result = await reanalyzeMeal(deps, userId, input.mealId, (e) => { if (e.kind === "item") to(2)(); }, to(3));
          break;
        case "note":
          // The router's answer is step 2's start, the stored write step 3's.
          result = await textTurn({
            ...deps, llm: after(deps.llm, "routeText", to(2)), store: after(deps.store, "updateMeal", to(3)),
          }, userId, { text: input.text, focusMealId: input.mealId, clientId, ...(input.capturedAt ? { capturedAt: input.capturedAt } : {}) });
      }
      return {
        result,
        land: async (d) => {
          if (result.kind === "updated" && was && await d.store.claimPush(userId, clientId)) await pushUpdated(d, userId, result, was.kcal);
        },
      };
    },
  },
};
const REGISTRY = Object.entries(HANDLERS).map(([kind, h]) => ({ kind, version: h.version }));

const keyOf = (userId: string, jobId: string) => `${userId}\u0000${jobId}`;
/** Every job this process holds the lease on, by key. */
const held = new Map<string, Promise<void>>();
let stopping = false;
let wake = (): void => {};
let timers: ReturnType<typeof setInterval>[] = [];
/** The followers on this replica, by job key; a notification for that key wakes them to re-read. */
const followers = new Map<string, Set<() => void>>();
let unlisten: (() => Promise<void>) | null = null;

const failed = (what: string) => (e: unknown) => console.error(`[eait] ${what}: ${(e as Error)?.message ?? e}`);

/** One claimed job, start to settle. Every write carries the lease; a lost one ends the attempt with nothing more written. */
async function runJob(deps: EngineDeps, job: JobRecord): Promise<void> {
  const h = HANDLERS[job.kind as JobKind];
  const { userId, clientId } = job;
  const settle = (outcome: object) => deps.store.settleJob(userId, clientId, owner, outcome).catch((e: unknown) => {
    failed("job not settled")(e);
    return false;
  });
  if (job.attempts > 1 && !h.retryable(job)) {
    await settle({ kind: OUTCOME_UNKNOWN });
    return;
  }
  const { result } = bounded(deps, h.calls(job), (d, lost) => {
    // In order, so a late item never moves the step back.
    let writes = Promise.resolve();
    const progress = (step: PhotoJobStep, items: MealItem[] = []) => {
      writes = writes.then(async () => {
        if (!(await deps.store.jobProgress(userId, clientId, owner, step, items))) lost();
      }).catch(failed("job progress not written"));
    };
    return h.run(d, job, progress, lost);
  });
  let out: Awaited<typeof result>;
  try {
    out = await result;
  } catch (e) {
    failed("queued job failed")(e);
    await settle({ kind: OUTCOME_UNKNOWN });
    return;
  }
  if (await settle(out.result)) await out.land(deps).catch(failed("queued job not wrapped up"));
}

/** Start this process's worker: claim what this build can run, up to `jobConcurrency` at once, and settle what nobody can. */
export function startJobs(deps: EngineDeps): void {
  stopping = false;
  let busy = false;
  let again = false;
  const tick = async (): Promise<void> => {
    if (busy) { again = true; return; }
    busy = true;
    try {
      do {
        again = false;
        const expired = await deps.store.expireJobs(Date.now() - deps.config.jobMaxQueuedMs, { kind: OUTCOME_UNKNOWN })
          .catch((e: unknown) => { failed("job expiry failed")(e); return []; });
        if (expired.length > 0) console.log(`[eait] job-unclaimed: ${expired.length} job(s) settled ${OUTCOME_UNKNOWN}`);
        while (!stopping && held.size < deps.config.jobConcurrency) {
          const job = await deps.store.claimJob(owner, REGISTRY, LEASE_MS)
            .catch((e: unknown) => { failed("job claim failed")(e); return null; });
          if (!job) break;
          const key = keyOf(job.userId, job.clientId);
          held.set(key, runJob(deps, job).finally(() => { held.delete(key); wake(); }));
        }
      } while (again && !stopping);
    } finally {
      busy = false;
    }
  };
  wake = () => { if (!stopping) void tick(); };
  timers = [
    setInterval(wake, CLAIM_POLL_MS),
    setInterval(() => {
      if (held.size > 0) void deps.store.heartbeatJobs(owner, LEASE_MS).catch(failed("job heartbeat failed"));
    }, HEARTBEAT_MS),
  ];
  for (const t of timers) t.unref?.();
  void deps.store.onJobNotify({
    job: (userId, clientId) => { for (const f of followers.get(keyOf(userId, clientId)) ?? []) f(); },
    enqueued: () => wake(),
  }).then((off) => {
    if (stopping) void off();
    else unlisten = off;
  }, failed("job listener not started"));
  wake();
}

/** Shutdown: stop claiming, wait up to `ms` for the jobs running here, and hand any still running back to the queue for another replica. */
export async function drainJobs(deps: EngineDeps, ms: number): Promise<void> {
  stopping = true;
  for (const t of timers) clearInterval(t);
  // Every follower here ends its stream now rather than at its next re-read.
  for (const fs of followers.values()) for (const f of fs) f();
  if (held.size > 0) {
    console.log(`[eait] waiting up to ${ms}ms for ${held.size} queued job(s)`);
    let cap: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([Promise.allSettled([...held.values()]), new Promise((r) => { cap = setTimeout(r, ms); })]);
    clearTimeout(cap);
  }
  const released = await deps.store.releaseJobs(owner).catch((e: unknown) => { failed("jobs not released")(e); return 0; });
  if (released > 0) console.log(`[eait] released ${released} queued job(s) to another replica`);
  const off = unlisten;
  unlisten = null;
  await off?.().catch(failed("job listener not stopped"));
}

/** Store the job and its photos; the worker runs it. Never waits for the analysis. */
export async function queuePhoto(
  deps: EngineDeps, userId: string, input: LogPhotoInput & { clientId: string },
): Promise<PhotoQueuedResponse> {
  const photos = (await Promise.all(input.images.map((r) => r())))
    .map((bytes) => ({ mime: imageMime(bytes) ?? "application/octet-stream", bytes }));
  const request: PhotoRequest = {
    ...(input.caption !== undefined ? { caption: input.caption } : {}),
    ...(input.capturedAt !== undefined ? { capturedAt: input.capturedAt } : {}),
    ...(input.receivedAt !== undefined ? { receivedAt: input.receivedAt } : {}),
  };
  if (await deps.store.enqueueJob(userId, { clientId: input.clientId, kind: "photo", requestVersion: HANDLERS.photo.version, request, step: 2, photos })) wake();
  return { kind: "queued", jobId: input.clientId };
}

/** Store a change to a logged meal as a job: an ingredient edit, a chat correction or a re-read. */
export async function queueMealUpdate(
  deps: EngineDeps, userId: string, input: MealUpdateRequest,
): Promise<PhotoQueuedResponse> {
  const job = { clientId: input.clientId, kind: "meal-update", requestVersion: HANDLERS["meal-update"].version, request: input, step: 1, photos: [] };
  if (await deps.store.enqueueJob(userId, job)) wake();
  return { kind: "queued", jobId: input.clientId };
}

const langOf = async (deps: EngineDeps, userId: string): Promise<Lang> => (await deps.store.getProfile(userId))?.lang ?? "en";

/** The row as the client sees it; the one function both the single read and the list go through. */
function snapshotOf(job: JobRecord, lang: Lang): PhotoJob {
  const jobId = job.clientId;
  if (job.removedAt !== null) return { kind: "removed", jobId };
  if (job.state === "settled") return { kind: "settled", jobId, result: (job.outcome ?? { kind: OUTCOME_UNKNOWN }) as Outcome };
  const step = job.step as PhotoJobStep;
  const r = job.request as MealUpdateRequest;
  const update = job.kind === "meal-update" ? { kind: r.kind, mealId: r.mealId, steps: MEAL_UPDATE_STEPS[r.kind] } : null;
  return {
    kind: "running", jobId, step, items: job.items as MealItem[],
    line: (update ? updateCopyFor(lang).steps[update.kind] : streamCopyFor(lang).queue)[step - 1]!,
    ...(update ? { update } : {}),
  };
}

/** The job as it stands, or null when this account has none under that id. */
export async function photoJob(deps: EngineDeps, userId: string, jobId: string): Promise<PhotoJob | null> {
  const job = await deps.store.getJob(userId, jobId);
  if (job) return snapshotOf(job, await langOf(deps, userId));
  // No job row: a turn the pre-jobs version accepted — its claim and answer outlive the queue's
  // rows, so the kept outcome is still the answer, and a claim with none is past the bound that
  // would have run it (a worker writes its job row with the claim, so "no row" means no runner).
  const turn = await deps.store.getTurn(userId, jobId);
  if (!turn) return null;
  return { kind: "settled", jobId, result: (turn.outcome ?? { kind: OUTCOME_UNKNOWN }) as PhotoLast };
}

/** The caller's jobs, newest change first, each the same snapshot as its single read. */
export async function listJobs(
  deps: EngineDeps, userId: string, opts: { state: JobsFilter; since: number | null; cursor: string | null },
): Promise<JobsResponse> {
  const page = await deps.store.listJobs(userId, { ...opts, limit: JOBS_PAGE });
  const lang = await langOf(deps, userId);
  return {
    jobs: page.jobs.map((j) => ({
      jobId: j.clientId, jobKind: j.kind, createdAt: new Date(j.createdAt).toISOString(), updatedAt: new Date(j.updatedAt).toISOString(),
      state: snapshotOf(j, lang),
    }) as JobEntry),
    cursor: page.cursor,
  };
}

/** Follow the job: a snapshot per change, the last one returned; a follower means no push until `signal` aborts. */
export async function followPhotoJob(
  deps: EngineDeps, userId: string, jobId: string, send: (job: PhotoJob) => void, signal?: AbortSignal,
): Promise<PhotoJob | null> {
  let job = await deps.store.getJob(userId, jobId);
  if (!job || job.state === "settled") return photoJob(deps, userId, jobId);
  const lang = await langOf(deps, userId);
  let sent = "";
  let followed = 0;
  // Re-read on a notification for this key, on abort, or after FOLLOW_POLL_MS; one that lands mid-read re-reads at once.
  const key = keyOf(userId, jobId);
  let dirty = false;
  let poke = (): void => {};
  const ping = () => { dirty = true; poke(); };
  const mine = followers.get(key) ?? new Set();
  followers.set(key, mine.add(ping));
  signal?.addEventListener("abort", ping, { once: true });
  try {
    for (;;) {
      const now = snapshotOf(job, lang);
      // A draining replica ends the stream; the client follows again through another one.
      if (now.kind !== "running" || stopping) return now;
      if (signal?.aborted) {
        await deps.store.followJob(userId, jobId, Date.now()).catch(failed("follower not cleared"));
        return now;
      }
      if (Date.now() - followed >= FOLLOW_HEARTBEAT_MS) {
        followed = Date.now();
        await deps.store.followJob(userId, jobId, followed + FOLLOWED_MS).catch(failed("follower not recorded"));
      }
      const line = JSON.stringify(now);
      if (line !== sent) { send(now); sent = line; }
      if (!dirty) {
        await new Promise<void>((r) => {
          const t = setTimeout(r, FOLLOW_POLL_MS);
          poke = () => { clearTimeout(t); r(); };
        });
      }
      dirty = false;
      poke = () => {};
      job = await deps.store.getJob(userId, jobId);
      if (!job) return photoJob(deps, userId, jobId);
    }
  } finally {
    signal?.removeEventListener("abort", ping);
    mine.delete(ping);
    if (mine.size === 0 && followers.get(key) === mine) followers.delete(key);
  }
}

/** Remove: a running job's meal goes when it lands, a logged one's goes now. */
export async function removePhotoJob(deps: EngineDeps, userId: string, jobId: string): Promise<PhotoJob | null> {
  if (await deps.store.removeJob(userId, jobId)) return { kind: "removed", jobId };
  const job = await photoJob(deps, userId, jobId);
  if (!job) return null;
  if (job.kind === "settled" && job.result.kind === "logged") await deleteMealById(deps, userId, job.result.mealId);
  return { kind: "removed", jobId };
}

/** The one push: "Salmon fillet, White rice · 540kcal" / "Counted. 360kcal left today." A tap opens the meal. */
async function pushCounted(deps: EngineDeps, userId: string, logged: MealLogged): Promise<void> {
  try {
    const devices = await deps.store.pushTokensFor(userId);
    const profile = await deps.store.getProfile(userId);
    if (devices.length === 0 || !profile) return;
    const whole = kcalNumbers(profile.lang);
    const names = logged.analysis.items.map((i) => i.name);
    const rest = explainTargets(profile).targets.kcal - logged.totals.kcal;
    const copy = queuedPushCopy(profile.lang, {
      names: names.slice(0, 2).join(", ") + (names.length > 2 ? ` +${names.length - 2}` : ""),
      kcal: whole(logged.analysis.kcal),
      left: rest >= 0 ? whole(rest) : null,
      over: rest < 0 ? whole(-rest) : null,
    });
    // A reply to the user's own action: logged, never claims the slot (R1 counts outbound only).
    await sendLogged(
      deps, userId, devices,
      { kind: "transactional", ref: logged.mealId, templateKey: "photo-counted", lang: profile.lang },
      copy, { mealId: logged.mealId },
    );
  } catch (e) {
    console.error(`[eait] queued photo push failed: ${(e as Error)?.message ?? e}`);
  }
}

/** The one push for an update: "Salmon, rice, greens updated · 480kcal (was 540kcal)". A tap opens the meal. */
async function pushUpdated(deps: EngineDeps, userId: string, updated: MealUpdated, wasKcal: number): Promise<void> {
  try {
    const devices = await deps.store.pushTokensFor(userId);
    const profile = await deps.store.getProfile(userId);
    if (devices.length === 0 || !profile) return;
    const whole = kcalNumbers(profile.lang);
    const unit = UNIT_KCAL[profile.lang];
    const title = fill(updateCopyFor(profile.lang).push, {
      names: updated.analysis.items.map((i) => i.name).slice(0, 2).join(", "),
      kcal: `${whole(updated.analysis.kcal)}${unit}`, was: `${whole(wasKcal)}${unit}`,
    });
    await sendLogged(
      deps, userId, devices,
      { kind: "transactional", ref: updated.mealId, templateKey: "meal-updated", lang: profile.lang },
      { title, body: "" }, { mealId: updated.mealId },
    );
  } catch (e) {
    console.error(`[eait] queued update push failed: ${(e as Error)?.message ?? e}`);
  }
}
