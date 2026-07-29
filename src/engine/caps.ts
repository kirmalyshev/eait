// Spend metering. This lives in the ENGINE, not in the Telegram layer, and that move is the point:
// caps enforced by a transport are caps every other transport bypasses. A mobile client calling the
// same engine draws from the same pool automatically, because there is no other way in.

import { getSetting, llmCallCountToday, llmCallsToday, logEvent, type Db } from "../db.ts";
import type { Config } from "../config.ts";
import type { EngineDeps, UserId } from "./deps.ts";

/** Key in the settings table holding the admin's runtime override. */
export const CAP_KEY = "global_cap";

/**
 * The cap actually in force: a stored override if the admin set one, else the `.env` value.
 *
 * Read per request rather than cached, so `/cap` takes effect on the very next message with no
 * restart — the whole point, since the moment you need to change a spend cap is while traffic is
 * arriving and you are holding a phone.
 *
 * A stored `"off"` means unlimited, deliberately distinct from having no override. Anything
 * unparseable falls back to the configured value rather than to unlimited: a corrupt row must not
 * silently remove the spend bound.
 */
export async function effectiveGlobalCap(db: Db, config: Config): Promise<number | null> {
  const raw = await getSetting(db, CAP_KEY);
  if (raw === null) return config.globalDailyAnalysisCap;
  if (raw === "off") return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : config.globalDailyAnalysisCap;
}

/**
 * Both cap checks, in the order that matters.
 *
 * Caps meter LLM CALLS, not stored meals: a not-food photo and a Q&A are billed even though no meal
 * row appears, so each draws one. A per-call policy, not a token-cost model.
 *
 * The GLOBAL check runs before any billed call, never after. The per-user cap bounds one account,
 * but a publicly linked bot has unbounded accounts — a global cap enforced after the call would
 * cost exactly as much as no cap at all.
 */
export async function checkCaps(
  deps: EngineDeps,
  userId: UserId,
  date: string,
): Promise<{ scope: "user" | "global" } | null> {
  const { db, config } = deps;
  if ((await llmCallsToday(db, userId, date)) >= config.perUserDailyPhotoCap) {
    return { scope: "user" };
  }
  const cap = await effectiveGlobalCap(db, config);
  if (cap !== null && (await llmCallCountToday(db, date)) >= cap) {
    console.warn(`[eait] global daily cap ${cap} reached`);
    await logEvent(db, userId, "cap_hit");
    return { scope: "global" };
  }
  return null;
}
