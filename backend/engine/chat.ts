// The thread: the conversation as the server kept it.
//
// Written by the engine functions that produce a turn — `handleText`, `logPhotoMeal`,
// `confirmPendingMeal`, `cancelPendingMeal`, `editMeal` — and by `appendLines` for what the app may
// add without a model turn: the user's own words and Spud's scripted lines by id. Read by
// `chatHistory`. The Chat tab is this thread's continuation, so nothing the app shows in it is
// something the server does not have. A refused turn writes nothing: there was no turn.

import {
  type AppendLine, type AppendLinesResponse, type ChatEntry, type ChatHistoryResponse, type MealRecord, type Profile,
  type DailyTotals, MAX_APPEND_LINES_PER_BATCH, MAX_USER_LINE, askLines, correctionLine, explainTargets, firstVerdictLines,
  isScriptedLineId, localDate, promptById, scriptedLine, scriptedParams,
} from "@eait/shared";
import type { ChatAppend, ChatMessage } from "../store.ts";
import type { EngineDeps } from "./deps.ts";
import { onboardingContent } from "./onboarding.ts";

const PAGE_DEFAULT = 50;
const PAGE_MAX = 100;
/** Lines one account may hold. Append-only rows on a box that is dumped nightly; refused, never trimmed. */
const MAX_THREAD_LINES = 10_000;

/** What a thunk builds: the lines, and how to undo anything it claimed if they cannot be written. */
export interface Remembered {
  lines: ChatAppend[];
  undo?: () => Promise<void>;
}

// The only claim an `undo` hands back is the once-per-account greeting: a release that fails
// spends it with nothing written, so it is the one failure here worth a line in the log.
const release = (e: unknown) => console.error(`[eait] claim release failed: ${(e as Error)?.message ?? e}`);

/**
 * Append lines in order. NEVER fails the turn that called it: the meal is written by then, and a
 * failed thread write must not make the client retry a meal it already has. Logged, so a store
 * that drops lines is visible in the one place anybody debugging this would look.
 */
export async function remember(
  deps: EngineDeps,
  userId: string,
  // A thunk when BUILDING the lines touches the store too (the first verdict takes a claim, a
  // correction reads the profile): that work must sit inside the same guard as the write.
  lines: ChatAppend[] | (() => Promise<ChatAppend[] | Remembered>),
): Promise<void> {
  let undo: (() => Promise<void>) | undefined;
  try {
    const built = typeof lines === "function" ? await lines() : lines;
    const r: Remembered = Array.isArray(built) ? { lines: built } : built;
    undo = r.undo;
    // Nothing to write is an exit like any other: whatever the thunk claimed goes back.
    if (r.lines.length === 0) { await undo?.().catch(release); return; }
    // The bound is a property of the thread, so it holds on every path that writes one — the
    // editor's PATCH sits behind no cap and no limiter, and would otherwise grow it without end.
    // ponytail: count-then-write, so two concurrent turns can overshoot by one batch. The bound is
    // against runaway growth, not a quota; a count under the account lock if exactness ever matters.
    if ((await deps.store.countUserChat(userId)) + r.lines.length > MAX_THREAD_LINES) {
      console.error(`[eait] thread full for one account; ${r.lines.length} line(s) not kept`);
      await undo?.().catch(release);
      return;
    }
    await deps.store.appendChat(userId, r.lines);
  } catch (e) {
    console.error(`[eait] thread write failed: ${(e as Error)?.message ?? e}`);
    // The one thing a failed write must not keep: a claim on words that never landed.
    await undo?.().catch(release);
  }
}

/** copy.md § Step 17's "Updated — …" line, after a correction. Null when the profile is unreadable. */
export async function afterCorrection(
  deps: EngineDeps,
  userId: string,
  meal: MealRecord,
  totals: DailyTotals,
): Promise<ChatAppend[]> {
  // The line says "left today". A meal re-dated to another day has nothing to say about today.
  if (meal.date !== localDate(deps.config.timezone)) return [];
  const profile = await deps.store.getProfile(userId);
  if (!profile) return [];
  const { targets } = explainTargets(profile);
  return [{
    role: "assistant", kind: "text",
    text: correctionLine({ targets, meal: { kcal: meal.kcal }, eatenToday: { kcal: totals.kcal, protein_g: totals.protein_g } }),
  }];
}

/**
 * Spud's first verdict, as lines for the thread — copy.md § Step 17. Spoken on the account's FIRST
 * meal only; every later meal is the card. `totals` are the day's after the meal.
 */
export async function firstVerdict(
  deps: EngineDeps,
  userId: string,
  profile: Profile,
  meal: MealRecord,
  totals: DailyTotals,
  via: "photo" | "text",
  caption: string | null = null,
): Promise<Remembered> {
  // "for the rest of today" — a first meal typed as "pizza yesterday" gets the card and no speech,
  // and does NOT spend the greeting: the claim below is taken only for a meal that can be spoken about.
  if (meal.date !== localDate(deps.config.timezone)) return { lines: [] };
  // Built BEFORE the claim: `remember` can only hand a claim back once it holds `undo`, so a throw
  // between claiming and returning would spend the greeting on words nobody ever read.
  const { targets } = explainTargets(profile);
  const lines: ChatAppend[] = firstVerdictLines({
    goal: profile.goal ?? "maintain", targets, via, verdicts: meal.verdicts, caption,
    meal: { kcal: meal.kcal, confidence: meal.confidence },
    eatenToday: { kcal: totals.kcal, protein_g: totals.protein_g },
  }).map((text) => ({ role: "assistant", kind: "text", text }));
  if (!(await deps.store.claimFirstVerdict(userId))) return { lines: [] };
  // Spent only when the greeting lands; a failed write hands it back for the next meal.
  return { lines, undo: () => deps.store.releaseFirstVerdict(userId) };
}

/**
 * What the APP may append: the user's own words, and Spud's scripted lines by id. All-or-nothing,
 * and never assistant prose — the client names a line, the server owns the words.
 */
export async function appendLines(deps: EngineDeps, userId: string, lines: AppendLine[]): Promise<AppendLinesResponse> {
  const bad = { appended: 0, reason: "bad-line" } as const;
  if (lines.length > MAX_APPEND_LINES_PER_BATCH) return bad;
  if (lines.length > 0 && (await deps.store.countUserChat(userId)) + lines.length > MAX_THREAD_LINES) {
    return { appended: 0, reason: "thread-full" };
  }
  // Looked up ONCE, and only when a batch actually names an onboarding question — the notification
  // primer and the camera lines are the common case and must not pay for a profile read.
  const needsAsk = lines.some((l) => typeof l === "object" && l !== null && l.role === "assistant" && "ask" in l);
  const asked = needsAsk ? await askResolver(deps, userId) : null;

  const out: ChatAppend[] = [];
  for (const l of lines) {
    if (typeof l !== "object" || l === null) return bad;
    if (l.role === "user" && typeof l.text === "string" && l.text.trim() !== "" && l.text.length <= MAX_USER_LINE) {
      out.push({ role: "user", kind: "text", text: l.text });
    } else if (l.role === "assistant" && "scripted" in l && isScriptedLineId(l.scripted)) {
      // Parameters are the one place client text reaches an assistant line: declared keys only,
      // short, or the whole batch is refused.
      const params = scriptedParams(l.scripted, l.params ?? {});
      if (params === null) return bad;
      out.push({ role: "assistant", kind: "text", text: scriptedLine(l.scripted, params) });
    } else if (l.role === "assistant" && "ask" in l && asked) {
      // A coordinate, not a sentence. The words come from THIS server's copy of the onboarding
      // content, so nothing the phone sends can reach the thread as prose.
      const text = asked(l.ask);
      if (text === null) return bad;
      out.push({ role: "assistant", kind: "text", text });
    } else {
      return bad;
    }
  }
  if (out.length > 0) await deps.store.appendChat(userId, out);
  return { appended: out.length };
}

/**
 * Resolve an onboarding question's coordinate into the sentence this server would ask.
 *
 * `askLines` is the SAME function the app renders from — shared, so the thread holds the question
 * as this server words it rather than as a phone claims it was worded. The two agree on every
 * revision both sides have; they can differ for the few hundred milliseconds before the fetched
 * content reaches the app, which renders its compiled-in copy first by design. Both sentences are
 * legitimate copy for the same question, and the alternative — trusting the phone's text — is the
 * thing this route exists to prevent.
 *
 * It reads the profile for the one substitution the shipped copy has (`{loseTail}`, the pace
 * warning that belongs only to somebody losing weight), which is why the profile is fetched here
 * rather than assumed — and why `switchGoal` drains the queue before it patches the goal.
 *
 * Returns null for anything out of range, and the caller refuses the whole batch: a line index past
 * the end of an ask is a client and a server that disagree about the copy, and guessing which
 * sentence was meant would put a question in the thread that nobody was asked.
 */
async function askResolver(
  deps: EngineDeps,
  userId: string,
): Promise<(ref: { prompt: string; line: number }) => string | null> {
  const [profile, content] = await Promise.all([
    deps.store.getProfile(userId),
    onboardingContent(deps),
  ]);
  return (ref) => {
    if (!profile) return null;
    if (typeof ref !== "object" || ref === null) return null;
    if (!Number.isInteger(ref.line) || ref.line < 0) return null;
    const prompt = promptById(ref.prompt as never);
    if (!prompt) return null;
    return askLines(prompt, content, profile)[ref.line] ?? null;
  };
}

/**
 * A page of the thread, oldest first, plus the cursor for the page before it.
 *
 * Meal cards are resolved on READ — one batched lookup per page — so the card shows the meal as it
 * is now and a verdict never outlives the numbers it described.
 */
export async function chatHistory(
  deps: EngineDeps,
  userId: string,
  opts: { before?: number | null; limit?: number },
): Promise<ChatHistoryResponse> {
  const limit = Math.min(PAGE_MAX, Math.max(1, opts.limit ?? PAGE_DEFAULT));
  // One more than asked, to know whether an older page exists without a second query.
  const rows = await deps.store.chatBefore(userId, opts.before ?? null, limit + 1);
  const more = rows.length > limit;
  const page = rows.slice(0, limit).reverse();
  const ids = [...new Set(page.flatMap((m) => (m.kind === "meal" && m.mealId ? [m.mealId] : [])))];
  const meals = new Map((await deps.store.getMeals(userId, ids)).map((m) => [m.id, m]));
  return {
    entries: page.map((m) => toEntry(m, meals)),
    before: more && page.length > 0 ? page[0]!.seq : null,
  };
}

function toEntry(m: ChatMessage, meals: Map<string, MealRecord>): ChatEntry {
  const base = { id: m.id, seq: m.seq, ts: m.ts };
  if (m.role === "user") {
    return m.kind === "photo"
      ? { ...base, role: "user", kind: "photo", text: m.text }
      : { ...base, role: "user", kind: "text", text: m.text ?? "", clientId: m.clientId, pendingId: m.pendingId };
  }
  if (m.kind === "meal") {
    return {
      ...base, role: "assistant", kind: "meal", event: m.event ?? "logged", mealId: m.mealId,
      meal: (m.mealId && meals.get(m.mealId)) || null,
    };
  }
  return { ...base, role: "assistant", kind: "text", text: m.text ?? "" };
}
