// A photo meal, or a change to a logged one, as a job (ieat-app#1318, #1347); the id is the turn's `clientId`, so `turns` keeps the outcome.

import {
  MEAL_UPDATE_STEPS, OUTCOME_UNKNOWN, PHOTO_MODEL_CALLS, UNIT_KCAL, explainTargets, kcalNumbers, queuedPushCopy, streamCopyFor,
  updateCopyFor, fill,
  type Lang, type MealItem, type MealLogged, type MealUpdateKind, type MealUpdateLast, type MealUpdateRequest,
  type MealUpdated, type PhotoJob, type PhotoJobStep, type PhotoLast, type PhotoQueuedResponse,
} from "@eait/shared";
import type { EngineDeps } from "./deps.ts";
import { deleteMealById } from "./lines.ts";
import { editMeal, logPhotoMeal, reanalyzeMeal, type LogPhotoInput } from "./meals.ts";
import { handleText } from "./text.ts";
import { once } from "./turns.ts";

interface Running {
  lang: Lang;
  step: PhotoJobStep;
  items: MealItem[];
  removed: boolean;
  /** Set on a meal update: its kind and meal, which pick the step words. */
  update?: { kind: MealUpdateKind; mealId: string; steps: number };
  watchers: Set<(job: PhotoJob) => void>;
}

// ponytail: one process holds the progress; a restart keeps the outcome (in `turns`) and loses the step.
const running = new Map<string, Running>();
/** When this process came up: a claim older than it, with no outcome and no job here, belongs to a process that is gone. */
const bootedAt = Date.now();
/** Every job's whole run, wrapped up included, so a shutdown can wait for them. */
const inflight = new Set<Promise<void>>();
const keyOf = (userId: string, jobId: string) => `${userId}\u0000${jobId}`;

const snapshot = (jobId: string, r: Running): PhotoJob => r.removed
  ? { kind: "removed", jobId }
  : {
    kind: "running", jobId, step: r.step, items: r.items,
    line: (r.update ? updateCopyFor(r.lang).steps[r.update.kind] : streamCopyFor(r.lang).queue)[r.step - 1]!,
    ...(r.update ? { update: r.update } : {}),
  };

const tell = (jobId: string, r: Running) => {
  const job = snapshot(jobId, r);
  for (const w of r.watchers) w(job);
};

/** Run `work` under the job's id; `landed` does what the outcome owes (the push, a removal) before the watchers are told. */
function launch<R extends PhotoLast | MealUpdateLast>(
  userId: string, jobId: string, r: Running, work: () => Promise<R>, landed: (result: R) => Promise<void>,
): void {
  const key = keyOf(userId, jobId);
  running.set(key, r);
  const whole: Promise<void> = work().catch((e: unknown): R => {
    console.error(`[eait] queued job failed: ${(e as Error)?.message ?? e}`);
    return { kind: OUTCOME_UNKNOWN } as R;
  }).then(async (result: R) => {
    running.delete(key);
    await landed(result);
    const last: PhotoJob = r.removed ? { kind: "removed", jobId } : { kind: "settled", jobId, result };
    for (const w of r.watchers) w(last);
  }).catch((e: unknown) => console.error(`[eait] queued job not wrapped up: ${(e as Error)?.message ?? e}`))
    .finally(() => inflight.delete(whole));
  inflight.add(whole);
}

/** Shutdown: wait up to `ms` for the jobs running here, returning the moment none is left; any still running at the cap settle as lost, so their users are told at once. */
export async function drainJobs(deps: EngineDeps, ms: number): Promise<void> {
  if (inflight.size === 0) return;
  console.log(`[eait] waiting up to ${ms}ms for ${inflight.size} queued job(s)`);
  let cap: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([Promise.allSettled([...inflight]), new Promise((r) => { cap = setTimeout(r, ms); })]);
  clearTimeout(cap);
  await Promise.all([...running.keys()].map((key) => {
    const [userId, jobId] = key.split("\u0000") as [string, string];
    return deps.store.settleTurn(userId, jobId, { kind: OUTCOME_UNKNOWN }).catch((e: unknown) =>
      console.error(`[eait] lost job not settled: ${(e as Error)?.message ?? e}`));
  }));
}

/** True when this id is already a job here or a claimed turn. */
const known = async (deps: EngineDeps, userId: string, jobId: string): Promise<boolean> =>
  running.has(keyOf(userId, jobId)) || (await deps.store.getTurn(userId, jobId)) !== null;

/** Start the job, or answer for the one already under this id. Never waits for the analysis. */
export async function queuePhoto(
  deps: EngineDeps, userId: string, input: LogPhotoInput & { clientId: string },
): Promise<PhotoQueuedResponse> {
  const jobId = input.clientId;
  const queued = { kind: "queued", jobId } as const;
  if (await known(deps, userId, jobId)) return queued;

  const lang = (await deps.store.getProfile(userId))?.lang ?? "en";
  const r: Running = { lang, step: 2, items: [], removed: false, watchers: new Set() };

  launch(userId, jobId, r, () => logPhotoMeal(deps, userId, input, (e) => {
    if (e.kind !== "item") return;
    // An `index: 0` after others is the analyzer starting over.
    r.items = [...r.items.slice(0, e.index), e.item];
    r.step = 3;
    tell(jobId, r);
  }, () => { r.step = 4; tell(jobId, r); }), async (result: PhotoLast) => {
    if (result.kind !== "logged") return;
    if (r.removed) await deleteMealById(deps, userId, result.mealId);
    else if (r.watchers.size === 0) await pushCounted(deps, userId, result);
  });

  return queued;
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

/** Start a change to a logged meal under the photo's job machinery: an ingredient edit, a chat correction or a re-read. */
export async function queueMealUpdate(
  deps: EngineDeps, userId: string, input: MealUpdateRequest,
): Promise<PhotoQueuedResponse> {
  const jobId = input.clientId;
  const queued = { kind: "queued", jobId } as const;
  if (await known(deps, userId, jobId)) return queued;

  const lang = (await deps.store.getProfile(userId))?.lang ?? "en";
  const was = await deps.store.getMeal(userId, input.mealId);
  const r: Running = {
    lang, step: 1, items: [], removed: false, watchers: new Set(),
    update: { kind: input.kind, mealId: input.mealId, steps: MEAL_UPDATE_STEPS[input.kind] },
  };
  const to = (step: PhotoJobStep) => () => { r.step = step; tell(jobId, r); };

  const work = (): Promise<MealUpdateLast> => {
    switch (input.kind) {
      case "ingredients":
        return once(deps, userId, jobId, PHOTO_MODEL_CALLS, (d) => { to(2)(); return editMeal(d, userId, input.mealId, input.edit); });
      case "reread":
        return once(deps, userId, jobId, PHOTO_MODEL_CALLS, (d) =>
          reanalyzeMeal(d, userId, input.mealId, (e) => { if (e.kind === "item") to(2)(); }, to(3)));
      case "note":
        // The router's answer is step 2's start, the stored write step 3's.
        return handleText({
          ...deps, llm: after(deps.llm, "routeText", to(2)), store: after(deps.store, "updateMeal", to(3)),
        }, userId, { text: input.text, focusMealId: input.mealId, clientId: jobId, ...(input.capturedAt ? { capturedAt: input.capturedAt } : {}) });
    }
  };

  launch(userId, jobId, r, work, async (result) => {
    if (result.kind === "updated" && !r.removed && r.watchers.size === 0 && was) await pushUpdated(deps, userId, result, was.kcal);
  });

  return queued;
}

/** The job as it stands, or null when this account has none under that id. */
export async function photoJob(deps: EngineDeps, userId: string, jobId: string): Promise<PhotoJob | null> {
  const r = running.get(keyOf(userId, jobId));
  if (r) return snapshot(jobId, r);
  const turn = await deps.store.getTurn(userId, jobId);
  if (!turn) return null;
  if (turn.outcome) return { kind: "settled", jobId, result: turn.outcome as PhotoLast };
  // Claimed before this process booted and not running here: a restart killed it. Settle now, retryable, rather than at the bound.
  if (turn.claimedAt < bootedAt) {
    const lost = { kind: OUTCOME_UNKNOWN } as const;
    await deps.store.settleTurn(userId, jobId, lost).catch((e: unknown) =>
      console.error(`[eait] lost job not settled: ${(e as Error)?.message ?? e}`));
    return { kind: "settled", jobId, result: lost };
  }
  // Claimed and not running here: another request's turn still inside its budget.
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
    const whole = kcalNumbers(profile.lang);
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
    const tickets = await deps.push.send(devices.map((d) => ({ to: d.token, title, body: "", data: { mealId: updated.mealId } })));
    for (const t of tickets) if (t.error === "device-not-registered") await deps.store.dropPushToken(userId, t.token);
  } catch (e) {
    console.error(`[eait] queued update push failed: ${(e as Error)?.message ?? e}`);
  }
}
