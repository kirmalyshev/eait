// Instance administration: the global spend cap and the runtime allowlist.
//
// Extracted from `tg_bot/bot.ts`'s `processCap` / `allowlistGate` / `processAllow` / `processDeny` /
// `processAllowed`. Cap ENFORCEMENT was already in the engine (`caps.ts`); cap ADMINISTRATION was
// not, so the numbers a surface could read and change lived one layer above the rule that uses them.
// The allowlist rules that matter — "closing an open bot must auto-include the admin", "the admin
// can never be denied" — were transport code too, and both are the kind of rule whose second
// implementation is the one that locks somebody out of their own instance.
//
// Results are typed unions; every string a user sees is still resolved by the surface.

import { berlinDate, clearSetting, deleteUser, llmCallCountToday, setSetting } from "../db.ts";
import { CAP_KEY, effectiveGlobalCap } from "./caps.ts";
import type { Allowlist } from "../allowlist.ts";
import type { EngineDeps, UserId } from "./deps.ts";

/**
 * Why an admin action produced nothing.
 *
 * The two are kept apart because they call for DIFFERENT surface behaviour, and collapsing them
 * would leak the fact that a command exists: with no admin configured the bot stays silent (an
 * answer advertises the command to whoever guessed it), while a configured instance tells a
 * non-admin plainly that they are not one.
 */
export type AdminRefusal = { kind: "not-admin" } | { kind: "no-admin-configured" };

const isRefusal = (r: { kind: string }): r is AdminRefusal =>
  r.kind === "not-admin" || r.kind === "no-admin-configured";

/** Null when the caller IS the admin. Never exported as a boolean — the two refusals differ. */
function adminGate(deps: EngineDeps, userId: UserId): AdminRefusal | null {
  if (deps.config.adminUserId === null) return { kind: "no-admin-configured" };
  return deps.config.adminUserId === userId ? null : { kind: "not-admin" };
}

// ---------- global spend cap ----------

/** The cap in force and what has been spent against it today. */
export interface CapStatus {
  kind: "status";
  /** null = unlimited. */
  cap: number | null;
  /**
   * The ENFORCED basis: `llm_calls` rows, not stored meals. A not-food photo and a Q&A each draw
   * the cap without adding a meal, and this readout exists to watch spend.
   */
  usedToday: number;
}

export type CapChange =
  | { kind: "set"; cap: number }
  | { kind: "off" }
  /** Back to the configured default, which the surface names so the admin sees what it fell to. */
  | { kind: "reset"; cap: number | null }
  | { kind: "invalid" };

export async function readCap(
  deps: EngineDeps,
  userId: UserId,
): Promise<CapStatus | AdminRefusal> {
  const refusal = adminGate(deps, userId);
  if (refusal) return refusal;
  return {
    kind: "status",
    cap: await effectiveGlobalCap(deps.db, deps.config),
    usedToday: await llmCallCountToday(deps.db, berlinDate(new Date(), deps.config.tz)),
  };
}

/** `<n>` | `off` | `reset`. The argument is parsed here so both front ends agree on what is valid. */
export async function setCap(
  deps: EngineDeps,
  userId: UserId,
  arg: string,
): Promise<CapChange | AdminRefusal> {
  const refusal = adminGate(deps, userId);
  if (refusal) return refusal;

  const a = arg.trim().toLowerCase();
  if (a === "off") {
    await setSetting(deps.db, CAP_KEY, "off");
    return { kind: "off" };
  }
  if (a === "reset") {
    await clearSetting(deps.db, CAP_KEY);
    return { kind: "reset", cap: deps.config.globalDailyAnalysisCap };
  }
  const n = Number(a);
  // Number.isSafeInteger rejects 1.5, -5, and values past 2^53 that would round on the way in.
  if (!Number.isSafeInteger(n) || n < 0) return { kind: "invalid" };
  await setSetting(deps.db, CAP_KEY, String(n));
  console.log(`[eait] global daily cap set to ${n} by admin`);
  return { kind: "set", cap: n };
}

// ---------- runtime allowlist ----------

export type AllowlistResult =
  /** The bot was open and is now closed. `count` includes the admin, auto-added. */
  | { kind: "started"; id: number; count: number }
  | { kind: "added"; id: number; count: number }
  | { kind: "already"; id: number }
  | { kind: "removed"; id: number; count: number }
  | { kind: "not-listed"; id: number }
  /** The bot admits everyone; there is no list to read or remove from. */
  | { kind: "open" }
  | { kind: "list"; ids: number[] }
  | { kind: "cant-deny-admin" }
  | { kind: "invalid-id" }
  /** Built without runtime access control — a static env list only. */
  | { kind: "unavailable" }
  | AdminRefusal;

/** Admin gate + "is there a list to operate on at all", shared by the three allowlist actions. */
function allowlistGate(
  deps: EngineDeps,
  userId: UserId,
  allowlist: Allowlist | undefined,
): AllowlistResult | null {
  const refusal = adminGate(deps, userId);
  if (refusal) return refusal;
  return allowlist ? null : { kind: "unavailable" };
}

const parseUserId = (arg: string): number | null => {
  const n = Number(arg.trim());
  return Number.isSafeInteger(n) && n > 0 ? n : null;
};

/**
 * Admit a user with no restart. On an OPEN bot this starts an allowlist and auto-includes the
 * admin: closing the bot must never lock out the person closing it.
 */
export async function allowUser(
  deps: EngineDeps,
  userId: UserId,
  allowlist: Allowlist | undefined,
  arg: string,
): Promise<AllowlistResult> {
  const blocked = allowlistGate(deps, userId, allowlist);
  if (blocked) return blocked;
  const al = allowlist!;
  const id = parseUserId(arg);
  if (id === null) return { kind: "invalid-id" };

  if (al.isOpen()) {
    await al.add(userId); // the admin; past the gate userId === config.adminUserId
    await al.add(id);
    console.log(`[eait] allowlist started by admin: ${al.list()!.length} user(s)`);
    return { kind: "started", id, count: al.list()!.length };
  }
  if (al.has(id)) return { kind: "already", id };
  await al.add(id);
  console.log(`[eait] allowlist: admin allowed user=${id}`);
  return { kind: "added", id, count: al.list()!.length };
}

/**
 * Remove a user. Refuses to remove the admin: the access check has no admin exemption, so denying
 * them would lock them out of every command — including the `allow` that would undo it.
 */
export async function denyUser(
  deps: EngineDeps,
  userId: UserId,
  allowlist: Allowlist | undefined,
  arg: string,
): Promise<AllowlistResult> {
  const blocked = allowlistGate(deps, userId, allowlist);
  if (blocked) return blocked;
  const al = allowlist!;
  const id = parseUserId(arg);
  if (id === null) return { kind: "invalid-id" };
  if (al.isOpen()) return { kind: "open" };
  if (id === deps.config.adminUserId) return { kind: "cant-deny-admin" };
  if (!al.has(id)) return { kind: "not-listed", id };
  await al.remove(id);
  console.log(`[eait] allowlist: admin denied user=${id}`);
  return { kind: "removed", id, count: al.list()!.length };
}

/** The current list, or `open` when the bot admits everyone. */
export async function listAllowed(
  deps: EngineDeps,
  userId: UserId,
  allowlist: Allowlist | undefined,
): Promise<AllowlistResult> {
  const blocked = allowlistGate(deps, userId, allowlist);
  if (blocked) return blocked;
  const ids = allowlist!.list();
  return ids === null ? { kind: "open" } : { kind: "list", ids };
}

export { isRefusal as isAdminRefusal };

// ---------- erasure ----------

/**
 * Delete everything stored about one user.
 *
 * Not admin-gated: it is the user's own account, and the promise the confirm prompt makes is total.
 * It lives in the engine rather than in a handler because the erasure has to be the SAME operation
 * whichever front end asks for it — a second implementation is how a table gets missed, and a
 * missed table is a deletion that quietly did not happen.
 *
 * Idempotent: deleting an account that is already gone is a success, not an error, so a client
 * retrying a timed-out request is not told its completed work failed.
 *
 * `onAccountDeleted` then lets each surface drop its own in-memory state. It runs AFTER the
 * database work and its throw is swallowed: the rows are already gone, and reporting a failure at
 * that point would invite a retry of a deletion that has, in every sense that matters, happened.
 */
export async function deleteAccount(deps: EngineDeps, userId: UserId): Promise<void> {
  await deleteUser(deps.db, userId);
  try {
    deps.onAccountDeleted?.(userId);
  } catch (e) {
    console.error(`[eait] account ${userId} erased, surface purge hook failed: ${(e as Error)?.message ?? e}`);
  }
}
