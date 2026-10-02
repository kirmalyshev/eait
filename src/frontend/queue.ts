// The photo queue (#1318): a photo joins at the top of today's list and reads itself server-side.
// A meal update (#1347) is the same job: its meal's row turns into the queued row in place.

import { homeCopyFor } from "../shared/app/home-copy.ts";
import { updateCopyFor } from "../shared/app/update-copy.ts";
import { mealCopyFor } from "../shared/app/meal-copy.ts";
import { UNIT_KCAL, kcalNumbers } from "../shared/lang.ts";
import type { MealItem, MealRecord } from "@eait/shared";
import { MEAL_UPDATE_STEPS } from "../shared/contract.ts";
import type { DayResponse, MealUpdateKind, MealUpdateBody, MealUpdateLast, PhotoJob, PhotoLast } from "@eait/shared/contract";
import { ApiError, api, apiBlob, apiStream } from "./api.ts";
import { fillCopy as fill } from "./copy.ts";
import { blobSrc } from "./kit.ts";
import { el, lang, names, redrawScreen, refusalWords } from "./shell.ts";
import { shrinkPhotos } from "./photo.ts";

type State = "reading" | "waiting" | "question" | "refused" | "failed";

/** What a job that changes a logged meal carries: the meal as it stood, and the body that is sent again on Try again. */
interface Update {
  kind: MealUpdateKind;
  mealId: string;
  steps: number;
  body: MealUpdateBody;
  name: string;
  kcal: number;
}


/** Where the photo was chosen — the point (drop) or element rect (button, composer) it flies from. */
export interface FlyFrom { x: number; y: number; w: number; h: number }
/** `FlyFrom` stamped at enqueue, so a landing whose row never mounted goes stale instead of flying late. */
type FlyAt = FlyFrom & { at: number }

interface Job {
  id: string;
  photos: File[];
  thumb: string;
  capturedAt: string;
  step: 1 | 2 | 3 | 4;
  line: string | null;
  items: MealItem[];
  state: State;
  words: string | null;
  mealId: string | null;
  kcal: number | null;
  // Landing move owed to this row (#1354): its photo stays hidden until the flyer lands.
  flyFrom: FlyAt | null;
  update: Update | null;
}

// ponytail: rows live in this tab; the server finishes a closed tab's photo and it lands as a meal.
let jobs: Job[] = [];
const views = new Set<() => void>();
const changed = () => { for (const v of views) v(); };

const RANGES = [[0, 15], [15, 45], [45, 80], [80, 99]] as const;
const percent = (j: Job): number => {
  // An update splits 0–100 evenly by its kind's steps; the ring sits mid-step, never ahead of the server.
  if (j.update) return Math.round(((j.step - 0.5) / j.update.steps) * 100);
  const [from, to] = RANGES[j.step - 1]!;
  return Math.min(to - 1, from + j.items.length * 6);
};
const photoJobs = (): Job[] => jobs.filter((j) => j.update === null);

const dataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result));
  r.onerror = () => reject(r.error);
  r.readAsDataURL(file);
});

/** Photos (angles of one meal) join the queue; `from` is where the image flies in from, omitted = the row just arrives. */
export async function enqueue(files: File[], from?: FlyFrom): Promise<void> {
  const photos = await shrinkPhotos(files.filter((f) => f.type.startsWith("image/")));
  if (photos.length === 0) return;
  const job: Job = {
    id: crypto.randomUUID(), photos, thumb: await dataUrl(photos[0]!), capturedAt: new Date().toISOString(),
    step: 1, line: null, items: [], state: "reading", words: null, mealId: null, kcal: null,
    flyFrom: from === undefined ? null : { ...from, at: Date.now() }, update: null,
  };
  jobs = [job, ...jobs];
  changed();
  redrawScreen();
  void run(job);
}

const drop = (job: Job) => {
  flyers.get(job)?.cancel();
  jobs = jobs.filter((j) => j !== job);
  changed();
};

/** A change to a logged meal joins the queue (#1347); its row stays where the meal is. */
export function enqueueUpdate(meal: MealRecord, body: MealUpdateBody): void {
  const job: Job = {
    id: crypto.randomUUID(), photos: [], thumb: "", capturedAt: new Date().toISOString(),
    step: 1, line: null, items: [], state: "reading", words: null, mealId: null, kcal: null, flyFrom: null,
    update: { kind: body.kind, mealId: meal.id, steps: MEAL_UPDATE_STEPS[body.kind], body, name: names(meal.items), kcal: meal.kcal },
  };
  jobs = [job, ...jobs];
  if ((meal.photos ?? 0) > 0) {
    void apiBlob(`/meals/${encodeURIComponent(meal.id)}/photos/0`).then(blobSrc).then((src) => { job.thumb = src; changed(); }).catch(() => {});
  }
  changed();
  redrawScreen();
  void run(job);
}


/** A meal's row that turns into its queued row in place while it has a job, and back to `plain()` when it has none. */
export function inPlace(mealId: string, plain: () => Element): HTMLElement {
  const slot = el("div", "uslot");
  let shown: "plain" | "job" | null = null;
  const draw = () => {
    if (!slot.isConnected && shown !== null) { views.delete(draw); return; }
    const job = updateFor(mealId);
    if (job === undefined && shown === "plain") return;
    slot.replaceChildren(job !== undefined ? updateRowEl(job) : plain());
    shown = job !== undefined ? "job" : "plain";
  };
  views.add(draw);
  draw();
  return slot;
}

/** The meal screen's updating state: the kind's steps with the server's step lit, and a bar that never runs ahead. */
export function updateBannerEl(mealId: string): HTMLElement {
  const box = el("div", "mupd");
  const draw = () => {
    if (!box.isConnected && box.childElementCount > 0) { views.delete(draw); return; }
    const job = updateFor(mealId);
    if (job === undefined) { box.replaceChildren(); return; }
    const waiting = job.state === "waiting";
    const list = el("ol", "msteps");
    updateCopyFor(lang).steps[job.update!.kind].forEach((line, i) => {
      list.append(el("li", waiting || i + 1 > job.step ? "next" : i + 1 === job.step ? "now" : "done", line));
    });
    const bar = el("i", "mbar");
    bar.style.width = `${waiting ? 0 : percent(job)}%`;
    box.replaceChildren(...(waiting ? [el("span", "qstep still", homeCopyFor(lang).queue.waiting)] : []), list, bar);
    box.setAttribute("role", "status");
  };
  views.add(draw);
  draw();
  return box;
}

// What a failed correction sent: Correct this meal opens with it in the field, once (no lost input).
let sentNote: { mealId: string; text: string } | null = null;
export function takeSentNote(mealId: string): string {
  const text = sentNote?.mealId === mealId ? sentNote.text : "";
  sentNote = null;
  return text;
}

/** The meal's job, while it has one. */
export const updateFor = (mealId: string): Job | undefined => jobs.find((j) => j.update?.mealId === mealId);
/** Called on every change of any job; returns the way to stop. */
export const watchJobs = (fn: () => void): (() => void) => { views.add(fn); return () => views.delete(fn); };
export const updateWords = (job: Job): { title: string; line: string; pct: number } => ({
  title: job.update!.name, line: job.line ?? updateCopyFor(lang).steps[job.update!.kind][0]!, pct: percent(job),
});

async function run(job: Job): Promise<void> {
  const form = new FormData();
  for (const p of job.photos) form.append("photo", p);
  form.append("clientId", job.id);
  form.append("capturedAt", job.capturedAt);
  try {
    if (job.update) {
      await api(`/meals/update/queue`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...job.update.body, mealId: job.update.mealId, clientId: job.id, capturedAt: job.capturedAt }),
      });
    } else await api(`/meals/photo/queue`, { method: "POST", body: form });
  } catch (e) {
    if (e instanceof ApiError) return settle(job, null, refusalWords(e));
    job.state = "waiting";
    changed();
    addEventListener("online", () => { job.state = "reading"; changed(); void run(job); }, { once: true });
    return;
  }
  job.step = 2;
  changed();
  await follow(job);
}

async function follow(job: Job): Promise<void> {
  for (;;) {
    try {
      const last = await apiStream<PhotoJob>(`/meals/photo/queue/${encodeURIComponent(job.id)}`, {}, (line) => {
        const s = line as PhotoJob;
        if (s.kind !== "running" || !jobs.includes(job)) return;
        job.step = s.step;
        job.line = s.line;
        job.items = s.items;
        changed();
      });
      if (last.kind === "running") {
        if (jobs.includes(job)) { job.step = last.step; job.line = last.line; job.items = last.items; changed(); }
        continue;
      }
      if (last.kind === "removed") return drop(job);
      return settle(job, last.result, null);
    } catch (e) {
      if (!jobs.includes(job)) return;
      if (e instanceof ApiError) return settle(job, null, refusalWords(e));
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

/** An update lands as the meal's new numbers; anything else keeps the meal as it was. */
function settleUpdate(job: Job, result: PhotoLast | MealUpdateLast | null, words: string | null): void {
  if (result?.kind === "updated" || result?.kind === "target-gone") { drop(job); redrawScreen(); return; }
  const failed = result === null || result.kind === "outcome-unknown" || result.kind === "analysis-failed";
  job.state = failed ? "failed" : "refused";
  job.words = result === null ? words
    : result.kind === "answered" ? result.text
    : failed ? null : refusalWords(new ApiError(0, { error: result.kind }, result.kind));
  changed();
}

async function settle(job: Job, result: PhotoLast | MealUpdateLast | null, words: string | null): Promise<void> {
  if (!jobs.includes(job)) return;
  if (job.update) return settleUpdate(job, result, words);
  if (result?.kind === "logged") {
    if (result.question) {
      Object.assign(job, { state: "question", mealId: result.mealId, kcal: result.analysis.kcal, items: result.analysis.items });
      changed();
    } else drop(job);
    redrawScreen();
    return;
  }
  // ponytail: an unknown outcome is checked against today's meals by capture time; a meal landed then is the answer.
  if (result?.kind === "outcome-unknown") {
    const day = await api<DayResponse>(`/diary/day`).catch(() => null);
    const at = Date.parse(job.capturedAt);
    if (day?.meals.some((m) => Math.abs(Date.parse(m.ts) - at) < 6 * 60_000 && !jobs.some((j) => j.mealId === m.id))) {
      drop(job);
      redrawScreen();
      return;
    }
  }
  job.state = result?.kind === "not-food" ? "refused" : "failed";
  job.words = result === null || result.kind === "not-food" || result.kind === "analysis-failed" || result.kind === "outcome-unknown"
    ? words : refusalWords(new ApiError(0, { error: result.kind }, result.kind));
  changed();
}

function remove(job: Job): void {
  drop(job);
  void api(`/meals/photo/queue/${encodeURIComponent(job.id)}`, { method: "DELETE" }).catch(() => {}).then(redrawScreen);
}

function retry(job: Job): void {
  Object.assign(job, { id: crypto.randomUUID(), step: 1, line: null, items: [], state: "reading", words: null });
  changed();
  void run(job);
}

/** Meal ids a question row stands for, so the list does not draw them twice. */
export const queuedMealIds = (): Set<string> => new Set(jobs.flatMap((j) => j.mealId ?? []));
export const queueLength = (): number => photoJobs().length;

const SVG = "http://www.w3.org/2000/svg";
const svg = (tag: string, attrs: Record<string, string>): SVGElement => {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
};
const RING = 2 * Math.PI * 17;
const glyph = (d: string): SVGElement => {
  const g = svg("svg", { viewBox: "0 0 24 24" });
  if (d !== "cloud") g.append(svg("circle", { cx: "12", cy: "12", r: "9" }));
  g.append(svg("path", { d: d === "cloud"
    ? "M3 3l18 18M8.5 8.6A5 5 0 0 0 6 18h11M17.5 12.6A3.5 3.5 0 0 1 19.4 17M12 7a5 5 0 0 1 4.8 3.6"
    : d === "?" ? "M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.4M12 17v.01" : "M12 7.5v5.5M12 16.5v.01" }));
  return g;
};
const skeleton = (w: string, h: string): HTMLElement => {
  const s = el("i", "sk");
  s.style.width = w;
  s.style.height = h;
  return s;
};

// Jobs with a flyer in the air: a redraw starts no second one.
const flying = new Set<Job>();
const flyers = new Map<Job, Animation>();

/** The landing move (#1354): the chosen image flies into the row's 56px thumbnail in 350 ms; Reduce Motion skips it. */
function fly(job: Job, box: HTMLElement): void {
  const from = job.flyFrom!;
  const end = () => { job.flyFrom = null; flying.delete(job); flyers.delete(job); changed(); };
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || Date.now() - from.at > 900) { end(); return; }
  // Poll a few frames for the slot: a redraw builds the box detached.
  let tries = 0;
  const place = (): void => {
    const i = photoJobs().indexOf(job);
    const th = i >= 0 ? box.children[i]?.querySelector(".qth") : null;
    if (th instanceof HTMLElement && box.isConnected && th.getBoundingClientRect().width > 0) {
      const sc = th.closest(".wcol");
      if (sc instanceof HTMLElement) sc.scrollTop = 0;
      const to = th.getBoundingClientRect();
      const side = 96;
      const cx = from.x + from.w / 2;
      const cy = from.y + from.h / 2;
      const img = document.createElement("img");
      img.src = job.thumb;
      img.alt = "";
      img.className = "qfly";
      Object.assign(img.style, { left: `${cx - side / 2}px`, top: `${cy - side / 2}px`, width: `${side}px`, height: `${side}px` });
      document.body.append(img);
      const anim = img.animate([
        { left: `${cx - side / 2}px`, top: `${cy - side / 2}px`, width: `${side}px`, height: `${side}px`, borderRadius: "12px" },
        { left: `${to.left}px`, top: `${to.top}px`, width: `${to.width}px`, height: `${to.height}px`, borderRadius: "var(--r-thumb)" },
      ], { duration: 350, easing: "cubic-bezier(.2,.7,.2,1)" });
      flyers.set(job, anim);
      anim.onfinish = anim.oncancel = () => { img.remove(); end(); };
      return;
    }
    if (!jobs.includes(job) || ++tries > 30) { flying.delete(job); job.flyFrom = null; return; }
    requestAnimationFrame(place);
  };
  requestAnimationFrame(place);
}

/** The ring over a veiled thumbnail: the percentage when reading, a dashed ring and the cloud while waiting. */
function ringInto(th: HTMLElement, job: Job): void {
  const ring = svg("svg", { class: "qr", viewBox: "0 0 40 40" });
  ring.append(svg("circle", { cx: "20", cy: "20", r: "17", stroke: "rgba(255,255,255,.35)", "stroke-width": "3",
    ...(job.state === "waiting" ? { "stroke-dasharray": "2 4" } : {}) }));
  if (job.state === "reading") {
    ring.append(svg("circle", { cx: "20", cy: "20", r: "17", stroke: "#fff", "stroke-width": "3", "stroke-linecap": "round",
      "stroke-dasharray": `${(RING * percent(job)) / 100} ${RING}`, transform: "rotate(-90 20 20)" }));
    th.append(ring, el("b", "", `${percent(job)}%`));
  } else th.append(ring, glyph("cloud"));
}

/** The meal's own row, turned into the queued row in place (#1347): its name, the kind's step, the old kcal and a skeleton for the new. */
export function updateRowEl(job: Job): HTMLElement {
  const Q = homeCopyFor(lang).queue;
  const U = updateCopyFor(lang);
  const u = job.update!;
  const row = el("div", "meal q");
  const th = el("div", "qth");
  if (job.thumb !== "") {
    const img = document.createElement("img");
    img.src = job.thumb;
    img.alt = "";
    th.append(img);
  }
  const veil = el("i", "veil");
  veil.style.background = `rgba(23,25,28,${job.state === "reading" || job.state === "waiting" ? ".45" : ".55"})`;
  th.append(veil);
  const mm = el("div", "mm");
  mm.append(el("b", "", u.name));
  if (job.state === "reading" || job.state === "waiting") {
    ringInto(th, job);
    mm.append(el("span", `qstep${job.state === "waiting" ? " still" : ""}`, job.state === "waiting" ? Q.waiting : job.line ?? U.steps[u.kind][0]!));
    const kc = el("div", "qold");
    kc.append(el("span", "num", kcalNumbers(lang)(u.kcal)), el("i", "", "→"), skeleton("34px", "14px"));
    row.append(th, mm, kc);
    row.setAttribute("aria-busy", "true");
    return row;
  }
  th.append(glyph("!"));
  const failed = job.state === "failed";
  mm.append(el("span", "qstep still ink", failed ? U.failedTitle : U.refusedTitle),
    el("span", "qstep still", failed ? U.failedBody : job.words ?? U.failedBody));
  const act = el("div", "qact");
  const button = (text: string, on: () => void) => { const b = el("button", "", text); b.addEventListener("click", on); act.append(b); };
  if (failed) {
    button(homeCopyFor(lang).tryAgain, () => retry(job));
    if (u.kind !== "reread") {
      button(mealCopyFor(lang).phoneEdit, () => {
        if (u.body.kind === "note") sentNote = { mealId: u.mealId, text: u.body.text };
        drop(job);
        location.hash = `#/meal/${encodeURIComponent(u.mealId)}${u.kind === "note" ? "?fix" : ""}`;
      });
    }
    button(U.discard, () => { drop(job); redrawScreen(); });
  } else button(U.ok, () => { drop(job); redrawScreen(); });
  mm.append(act);
  row.append(th, mm);
  return row;
}

function rowEl(job: Job): HTMLElement {
  const Q = homeCopyFor(lang).queue;
  // The landing row arrives `qnew`, photo hidden until the flyer lands; any other row keeps `rise`.
  const row = el("div", `meal q ${job.flyFrom ? "qnew" : "rise"}`);
  const th = el("div", "qth");
  const img = document.createElement("img");
  img.src = job.thumb;
  img.alt = "";
  if (job.flyFrom) img.style.opacity = "0";
  const veil = el("i", "veil");
  veil.style.background = `rgba(23,25,28,${job.state === "refused" || job.state === "failed" ? ".55" : job.state === "question" ? ".35" : ".45"})`;
  th.append(img, veil);
  const mm = el("div", "mm");
  const step = (text: string, still = false, ink = false) => el("span", `qstep${still ? " still" : ""}${ink ? " ink" : ""}`, text);
  const actions = (first: string, act: () => void): HTMLElement => {
    const a = el("div", "qact");
    const one = el("button", "", first);
    const two = el("button", "", Q.remove);
    one.addEventListener("click", act);
    two.addEventListener("click", () => remove(job));
    a.append(one, two);
    return a;
  };

  if (job.state === "reading" || job.state === "waiting") {
    ringInto(th, job);
    if (job.items.length > 0) mm.append(el("b", "", names(job.items)));
    else { const t = el("div", "qtitle"); t.append(skeleton("62%", "12px")); mm.append(t); }
    mm.append(job.state === "waiting" ? step(Q.waiting, true) : step(job.step === 1 ? Q.uploading : job.line ?? Q.uploading));
    if (job.step === 3 && job.items.length > 0) {
      const chips = el("div", "qchips");
      for (const i of job.items) chips.append(el("span", "", i.name));
      mm.append(chips);
    }
    row.append(th, mm);
    if (job.state === "reading") {
      const kc = el("div", "qkc");
      kc.append(skeleton("40px", "14px"), skeleton("26px", "8px"));
      row.append(kc);
    }
    row.setAttribute("aria-busy", "true");
    return row;
  }
  if (job.state === "question") {
    th.append(glyph("?"));
    const kcal = kcalNumbers(lang)(job.kcal ?? 0);
    const pill = el("a", "qpill", Q.answer) as HTMLAnchorElement;
    pill.href = `#/meal/${encodeURIComponent(job.mealId!)}`;
    pill.addEventListener("click", () => drop(job));
    mm.append(el("b", "", names(job.items)), step(fill(Q.question, { kcal }), true), pill);
    const kc = el("div", "kc num", `≈${kcal}`);
    kc.append(el("small", "", UNIT_KCAL[lang]));
    row.append(th, mm, kc);
    return row;
  }
  th.append(glyph("!"));
  const refused = job.state === "refused";
  mm.append(
    el("b", "", refused ? Q.notMeal : Q.unread),
    step(job.words !== null && !refused ? job.words : Q.nothingCounted, true, true),
    refused
      ? actions(Q.retake, () => { remove(job); location.hash = "#/log"; })
      : actions(homeCopyFor(lang).tryAgain, () => retry(job)),
  );
  row.append(th, mm);
  return row;
}

/** Today's queued rows, redrawn in place as the jobs move; empty when nothing is queued. */
export function queueEl(): HTMLElement {
  const box = el("div", "queue");
  const draw = () => {
    if (!box.isConnected && box.childElementCount > 0) { views.delete(draw); return; }
    box.replaceChildren(...photoJobs().map(rowEl));
    // A job still owed its landing move starts it here, where its slot now exists.
    for (const j of photoJobs()) {
      if (j.flyFrom !== null && !flying.has(j)) { flying.add(j); fly(j, box); }
    }
  };
  views.add(draw);
  draw();
  return box;
}

/** A photo dropped anywhere on the page joins the queue (#1318); the overlay says it will. */
export function acceptDrops(): void {
  const Q = () => homeCopyFor(lang).queue;
  let overlay: HTMLElement | null = null;
  const hide = () => { overlay?.remove(); overlay = null; };
  const hasFiles = (e: DragEvent) => [...e.dataTransfer?.types ?? []].includes("Files");
  addEventListener("dragover", (e) => {
    if (!hasFiles(e) || document.querySelector(".drop")) return;
    e.preventDefault();
    if (overlay !== null) return;
    overlay = el("div", "qdrop");
    const inner = el("div", "");
    inner.append(el("b", "", Q().dropTitle), el("small", "", Q().dropSub));
    overlay.append(inner);
    document.body.append(overlay);
  });
  addEventListener("dragleave", (e) => { if (e.relatedTarget === null) hide(); });
  addEventListener("drop", (e) => {
    if (overlay === null) return;
    e.preventDefault();
    hide();
    const files = [...e.dataTransfer?.files ?? []];
    if (files.length === 0) return;
    void enqueue(files, { x: e.clientX, y: e.clientY, w: 0, h: 0 });
    if (location.hash !== "" && location.hash !== "#/") location.hash = "#/";
  });
}
