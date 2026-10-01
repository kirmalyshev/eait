// A photo meal as a job (ieat-app#1318); the id is the turn's `clientId`, so `turns` keeps the outcome.

import {
  OUTCOME_UNKNOWN, PHOTO_MODEL_CALLS, explainTargets, queuedPushCopy, streamCopyFor, wholeNumbers,
  type Lang, type MealItem, type MealLogged, type PhotoJob, type PhotoJobStep, type PhotoLast,
  type PhotoQueuedResponse,
} from "@eait/shared";
import type { EngineDeps } from "./deps.ts";
import { deleteMealById } from "./lines.ts";
import { logPhotoMeal, type LogPhotoInput } from "./meals.ts";

interface Running {
  lang: Lang;
  step: PhotoJobStep;
  items: MealItem[];
  removed: boolean;
  watchers: Set<(job: PhotoJob) => void>;
}

// ponytail: one process holds the progress; a restart keeps the outcome (in `turns`) and loses the step.
const running = new Map<string, Running>();
const keyOf = (userId: string, jobId: string) => `${userId}\u0000${jobId}`;

const snapshot = (jobId: string, r: Running): PhotoJob => r.removed
  ? { kind: "removed", jobId }
  : { kind: "running", jobId, step: r.step, line: streamCopyFor(r.lang).queue[r.step - 1]!, items: r.items };

const tell = (jobId: string, r: Running) => {
  const job = snapshot(jobId, r);
  for (const w of r.watchers) w(job);
};

/** Start the job, or answer for the one already under this id. Never waits for the analysis. */
export async function queuePhoto(
  deps: EngineDeps, userId: string, input: LogPhotoInput & { clientId: string },
): Promise<PhotoQueuedResponse> {
  const jobId = input.clientId;
  const key = keyOf(userId, jobId);
  const queued = { kind: "queued", jobId } as const;
  if (running.has(key) || (await deps.store.getTurn(userId, jobId)) !== null) return queued;

  const lang = (await deps.store.getProfile(userId))?.lang ?? "en";
  const r: Running = { lang, step: 2, items: [], removed: false, watchers: new Set() };
  running.set(key, r);

  void logPhotoMeal(deps, userId, input, (e) => {
    if (e.kind !== "item") return;
    // An `index: 0` after others is the analyzer starting over.
    r.items = [...r.items.slice(0, e.index), e.item];
    r.step = 3;
    tell(jobId, r);
  }, () => { r.step = 4; tell(jobId, r); }).catch((e: unknown): PhotoLast => {
    console.error(`[eait] queued photo failed: ${(e as Error)?.message ?? e}`);
    return { kind: OUTCOME_UNKNOWN };
  }).then(async (result: PhotoLast) => {
    running.delete(key);
    if (result.kind === "logged") {
      if (r.removed) await deleteMealById(deps, userId, result.mealId);
      else if (r.watchers.size === 0) await pushCounted(deps, userId, result);
    }
    const last: PhotoJob = r.removed ? { kind: "removed", jobId } : { kind: "settled", jobId, result };
    for (const w of r.watchers) w(last);
  }).catch((e: unknown) => console.error(`[eait] queued photo not wrapped up: ${(e as Error)?.message ?? e}`));

  return queued;
}

/** The job as it stands, or null when this account has none under that id. */
export async function photoJob(deps: EngineDeps, userId: string, jobId: string): Promise<PhotoJob | null> {
  const r = running.get(keyOf(userId, jobId));
  if (r) return snapshot(jobId, r);
  const turn = await deps.store.getTurn(userId, jobId);
  if (!turn) return null;
  if (turn.outcome) return { kind: "settled", jobId, result: turn.outcome as PhotoLast };
  // Claimed and not running here: another request's turn still inside its budget, or one a restart lost.
  const bound = PHOTO_MODEL_CALLS * deps.config.llmTimeoutMs + 10_000;
  return Date.now() > turn.claimedAt + bound
    ? { kind: "settled", jobId, result: { kind: OUTCOME_UNKNOWN } }
    : { kind: "running", jobId, step: 2, line: streamCopyFor((await deps.store.getProfile(userId))?.lang ?? "en").queue[1]!, items: [] };
}

/** Follow the job: a snapshot per change, the last one returned; a follower means no push until `signal` aborts. */
export async function followPhotoJob(
  deps: EngineDeps, userId: string, jobId: string, send: (job: PhotoJob) => void, signal?: AbortSignal,
): Promise<PhotoJob | null> {
  const r = running.get(keyOf(userId, jobId));
  if (!r) return photoJob(deps, userId, jobId);
  return new Promise<PhotoJob>((resolve) => {
    const watch = (job: PhotoJob) => {
      if (job.kind === "running") return send(job);
      r.watchers.delete(watch);
      resolve(job);
    };
    r.watchers.add(watch);
    signal?.addEventListener("abort", () => r.watchers.delete(watch), { once: true });
    send(snapshot(jobId, r));
  });
}

/** Remove: a running job's meal goes when it lands, a logged one's goes now. */
export async function removePhotoJob(deps: EngineDeps, userId: string, jobId: string): Promise<PhotoJob | null> {
  const r = running.get(keyOf(userId, jobId));
  if (r) {
    r.removed = true;
    tell(jobId, r);
    return { kind: "removed", jobId };
  }
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
    const whole = wholeNumbers(profile.lang);
    const names = logged.analysis.items.map((i) => i.name);
    const rest = explainTargets(profile).targets.kcal - logged.totals.kcal;
    const copy = queuedPushCopy(profile.lang, {
      names: names.slice(0, 2).join(", ") + (names.length > 2 ? ` +${names.length - 2}` : ""),
      kcal: whole(logged.analysis.kcal),
      left: rest >= 0 ? whole(rest) : null,
      over: rest < 0 ? whole(-rest) : null,
    });
    const tickets = await deps.push.send(devices.map((d) => ({ to: d.token, ...copy, data: { mealId: logged.mealId } })));
    for (const t of tickets) if (t.error === "device-not-registered") await deps.store.dropPushToken(userId, t.token);
  } catch (e) {
    console.error(`[eait] queued photo push failed: ${(e as Error)?.message ?? e}`);
  }
}
