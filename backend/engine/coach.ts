// The coach: Spud answering a question, with the user's data behind tools.
//
// The router decided the message was a question (`handleText`); this builds what the agent needs
// and runs it. THE TOOLS ARE BUILT HERE, AS CLOSURES OVER ONE USER ID, so the port that runs the
// loop never sees an account and cannot reach a row on its own — the same rule every store read
// follows, kept where the model is closest to the data. A tool that could take a user id from
// the model would be the one place in this codebase a model output chose whose rows to read.

import {
  explainTargets, HEALTH_FIELDS, isCalendarDate, localTime, projectGoal, projectionMonth,
  windowStart, type Answered, type MealRecord, type Profile,
} from "@eait/shared";
import type { ChatMessage } from "../store.ts";
import type { CoachContext, CoachHistoryLine, CoachTools } from "../llm/port.ts";
import { COACH_HEALTH_DAYS, COACH_MEALS_LIMIT, COACH_MEALS_WINDOW_DAYS } from "../llm/port.ts";
import type { EngineDeps } from "./deps.ts";
import { toAnalysis } from "./meals.ts";

/** Thread lines replayed to the coach, and the few of them the router sees. */
export const COACH_HISTORY_LINES = 20;
export const ROUTER_RECENT_LINES = 6;

export interface CoachTurnInput {
  text: string;
  profile: Profile;
  focus: MealRecord | null;
  todayRows: MealRecord[];
  week: { date: string; kcal: number; protein_g: number }[];
  /** Oldest first — what `recentLines` returned for this turn. */
  history: CoachHistoryLine[];
  /** The caller's date for the turn — the one the analysis was charged to, never re-derived. */
  today: string;
}

/**
 * The thread's tail as the coach reads it: oldest first, at most `limit` lines, the newest
 * excluded when it is the message being answered (it is not stored yet — `keep` writes it after
 * the turn — so nothing here has to skip it). A card becomes a one-line note about the meal AS IT
 * IS NOW, the way `chatHistory` resolves it on read; a photo bubble is its caption.
 */
export async function recentLines(deps: EngineDeps, userId: string, limit = COACH_HISTORY_LINES): Promise<CoachHistoryLine[]> {
  const rows = (await deps.store.chatBefore(userId, null, limit)).reverse();
  const ids = [...new Set(rows.flatMap((m) => (m.kind === "meal" && m.mealId ? [m.mealId] : [])))];
  const meals = new Map((ids.length > 0 ? await deps.store.getMeals(userId, ids) : []).map((m) => [m.id, m]));
  const out: CoachHistoryLine[] = [];
  for (const m of rows) {
    const text = noteFor(m, meals);
    if (text !== null) out.push({ role: m.role, text });
  }
  return out;
}

function noteFor(m: ChatMessage, meals: Map<string, MealRecord>): string | null {
  if (m.kind === "photo") return m.text ? `[photo] ${m.text}` : "[photo]";
  if (m.kind === "text") return m.text && m.text.trim() !== "" ? m.text : null;
  const meal = m.mealId ? meals.get(m.mealId) : undefined;
  if (!meal) return "[a meal that was later deleted]";
  const what = meal.items.map((i) => i.name).join(", ") || "a meal";
  const verb = m.event === "updated" ? "meal updated" : m.event === "redated" ? "meal moved" : "logged";
  return `[${verb}: ${what} — ${Math.round(meal.kcal)} kcal, ${Math.round(meal.protein_g)} g protein, ${meal.date}]`;
}

/**
 * One question, answered. Throws when the coach could not answer — the caller falls back to the
 * router's own sentence, so a coach outage is today's chat rather than a refusal.
 */
export async function coachTurn(deps: EngineDeps, userId: string, input: CoachTurnInput): Promise<Answered> {
  const zone = deps.config.timezone;
  const { today } = input;
  const { targets, basis } = explainTargets(input.profile);
  const projected = projectGoal(input.profile, basis);
  const context: CoachContext = {
    profile: input.profile, targets, basis, today, localTime: localTime(zone),
    todayMeals: input.todayRows.map((m) => ({ items: m.items.map((i) => i.name), kcal: m.kcal, protein_g: m.protein_g })),
    week: input.week,
    ...(input.focus ? { focusMeal: toAnalysis(input.focus) } : {}),
    projection: projected === null ? null
      : projected.beyondHorizon ? "in more than two years at this pace"
      : `around ${projectionMonth(new Date(), projected.weeks)}`,
  };
  const out = await deps.llm.coach({ text: input.text, context, history: input.history }, coachTools(deps, userId, today));
  return { kind: "answered", text: out.reply, suggestions: out.suggestions };
}

/**
 * The tools, scoped. Each validates its own arguments and answers a refusal as `{ error }` rather
 * than throwing, so the model can read why and ask again — the port turns a throw into the same
 * shape, but a bound stated in words is one the model can respect on the next call.
 */
export function coachTools(deps: EngineDeps, userId: string, today: string): CoachTools {
  return {
    async get_meals(args) {
      const from = typeof args.from === "string" ? args.from : "";
      const to = typeof args.to === "string" ? args.to : "";
      if (!isCalendarDate(from) || !isCalendarDate(to)) return { error: "from and to must be YYYY-MM-DD" };
      if (from > to) return { error: "from must not be after to" };
      if (windowStart(to, COACH_MEALS_WINDOW_DAYS) > from) {
        return { error: `the window is at most ${COACH_MEALS_WINDOW_DAYS} days` };
      }
      const rows = await deps.store.mealsSince(userId, from, to, COACH_MEALS_LIMIT);
      return rows.map((m) => ({
        date: m.date, time: localTime(deps.config.timezone, new Date(m.ts)),
        items: m.items.map((i) => ({ name: i.name, grams: i.grams })),
        kcal: Math.round(m.kcal), protein_g: Math.round(m.protein_g), carbs_g: Math.round(m.carbs_g),
        fat_g: Math.round(m.fat_g), satfat_g: Math.round(m.satfat_g), fiber_g: Math.round(m.fiber_g),
        sugar_g: Math.round(m.sugar_g), sodium_mg: Math.round(m.sodium_mg),
        verdicts: m.verdicts, confidence: m.confidence, corrected: m.corrected,
      }));
    },
    async get_health(args) {
      const asked = Number(args.days);
      const days = Number.isFinite(asked) ? Math.min(COACH_HEALTH_DAYS, Math.max(1, Math.floor(asked))) : 30;
      const rows = await deps.store.healthDaysSince(userId, windowStart(today, days));
      // Only the readings a day carries, and only days that carry one: a row of nulls is noise the
      // model pays for by the token, and the definition promises it is not sent.
      const out: Record<string, unknown>[] = [];
      for (const d of rows) {
        const row: Record<string, unknown> = { date: d.date };
        for (const f of HEALTH_FIELDS) if (typeof d[f.key] === "number") row[f.key] = d[f.key];
        if (Object.keys(row).length > 1) out.push(row);
      }
      return out;
    },
  };
}
