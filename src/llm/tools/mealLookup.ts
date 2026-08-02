import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { berlinDate, berlinDateMinus, mealsInWindow } from "../../db.ts";
import { requireUserId } from "../context.ts";
import type { Db } from "../../db.ts";

/**
 * `find_meals` — the retrieve half of retrieve-then-select, pointed at the user's own diary
 * (design: `docs/design/2026-08-02-chat-targeted-meal-editing.md`).
 *
 * It exists so an edit no longer needs a Telegram reply. "The pasta was 200g, not 150" arrives with
 * no focus meal at all; this hands the agent the candidate meals, and the agent — holding the
 * sentence the user actually wrote — picks which one they meant and passes its `mealId` to
 * `submit_correction` or `submit_redate`. When more than one fits, it asks with `ask_which_meal`
 * rather than guessing.
 *
 * THE USER ID IS NOT IN THE INPUT SCHEMA, and here that rule is doing real work rather than being
 * free as it is for `search_food_db`. The food table is reference data identical for everyone; this
 * reads private rows. A model that could name whose diary to search would be one prompt injection
 * away from reading somebody else's. So the id comes from the `RequestContext` the CALLER bound
 * (`llm/context.ts`), and `requireUserId` throws rather than defaulting when it is missing — a
 * lookup with no bound user is a wiring bug, not an anonymous request. This is the first tool in
 * the codebase to read it; `mealsInWindow` then re-applies `WHERE user_id = ?` in SQL, so the scope
 * is enforced twice and neither layer trusts the other.
 *
 * THE CLOCK IS CLOSED OVER, not passed in by the model. An earlier draft took `today` as an input
 * field, which let a model widen its own window by lying about the date — harmless for the user's
 * own rows, but it also meant the window silently depended on model output. The factory takes the
 * timezone and a `now` provider instead; tests pin it, production passes the real clock.
 */

/** How far back a chat-targeted edit can reach. Matches the router's week context and `MAX_DAY_OFFSET`. */
export const FIND_MEALS_WINDOW_DAYS = 7;

/**
 * Hard cap on rows per lookup, applied AFTER the model's own `limit`.
 *
 * This runs inside a turn the user is waiting on and every row is paid for in prompt tokens, so the
 * model does not get to decide how much of the diary to load. A model asking for 999 gets this.
 */
export const FIND_MEALS_MAX_ROWS = 20;

export interface FindMealsDeps {
  tz: string;
  /** Injected so tests can pin "now"; production passes the real clock. */
  now?: () => Date;
}

/** One meal as the agent sees it: enough to describe it back to the user, plus the id to act on. */
interface FoundMeal {
  mealId: string;
  date: string;
  time: string;
  items: string[];
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

/** The time of day a meal was logged, for telling two same-named meals apart in a question. */
function timeOf(ts: string, tz: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(d);
}

export function makeFindMealsTool(db: Db, deps: FindMealsDeps) {
  const now = deps.now ?? (() => new Date());
  return createTool({
    id: "find_meals",
    description:
      "Search the user's OWN recent meal diary to find which logged meal a message is about. Use " +
      "this whenever the user refers to a meal without replying to it — to correct it, to move it " +
      "to another day, or to answer a question about what they ate. Pass the food words from " +
      "their message as queries; pass none to list everything recent. Returns each meal's id, " +
      `which submit_correction and submit_redate take as mealId. Covers the last ` +
      `${FIND_MEALS_WINDOW_DAYS} days. If several meals match, do NOT guess — call ask_which_meal.`,
    inputSchema: z.object({
      // Loose element type for the reason `dayOffset` is loose in `submit_meal`: under Mastra a
      // schema violation is not a throw but an error-shaped result fed back for a retry, so a
      // stricter type here costs a round trip rather than failing cleanly. Normalized below.
      queries: z
        .array(z.string())
        .optional()
        .describe(
          "Food words from the user's message, e.g. [\"pasta\"]. A meal matches when any of its " +
            "item names contains any query. Omit to list all recent meals.",
        ),
      limit: z
        .unknown()
        .optional()
        .describe(`Maximum meals to return (default and maximum ${FIND_MEALS_MAX_ROWS}).`),
    }),
    execute: async (inputData, { requestContext }): Promise<{ meals: FoundMeal[] }> => {
      // Bound by the caller from the authenticated Telegram user — never from anything the model
      // produced. Throws rather than defaulting; see the note above.
      const userId = requireUserId(requestContext);

      const { queries, limit } = inputData as { queries?: string[]; limit?: unknown };
      const today = berlinDate(now(), deps.tz);
      const from = berlinDateMinus(today, FIND_MEALS_WINDOW_DAYS);

      // The model's limit narrows, never widens: `Math.min` against the hard cap, and any junk
      // (null, "5", NaN — all shapes models actually emit) falls back to the cap rather than
      // rejecting the call and costing a retry.
      const asked = typeof limit === "number" && Number.isFinite(limit) && limit >= 1
        ? Math.trunc(limit)
        : FIND_MEALS_MAX_ROWS;
      const rows = await mealsInWindow(db, userId, from, today, Math.min(asked, FIND_MEALS_MAX_ROWS));

      // Filtering in memory rather than SQL: `items` is a JSON blob, the row set is already capped
      // at 20, and a substring match over a handful of food names is not worth a jsonb query whose
      // behaviour would then differ from the repertoire code that reads the same column.
      const needles = (queries ?? [])
        .filter((q): q is string => typeof q === "string" && q.trim() !== "")
        .map((q) => q.trim().toLowerCase());
      const matches = (m: (typeof rows)[number]) =>
        needles.length === 0 ||
        m.items.some((it) => {
          const name = `${it.name} ${it.name_en ?? ""}`.toLowerCase();
          return needles.some((n) => name.includes(n));
        });

      return {
        meals: rows.filter(matches).map((m) => ({
          mealId: m.id,
          date: m.date,
          time: timeOf(m.ts, deps.tz),
          items: m.items.map((it) => it.name),
          kcal: m.kcal,
          protein_g: m.protein_g,
          carbs_g: m.carbs_g,
          fat_g: m.fat_g,
        })),
      };
    },
  });
}
