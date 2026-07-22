// Runtime allowlist: who may use the bot, changeable via admin /allow · /deny without a
// restart. The env value (ALLOWED_USER_IDS) is only the SEED — the first runtime change
// materializes a list into the settings table, and from then on that stored list owns access
// (an env edit no longer resurrects a denied id). Semantics mirror isAllowed in bot.ts:
// `null` list = open bot; an empty list admits nobody; there is no admin exemption.
//
// `has()` is synchronous on an in-memory Set so the access-control middleware — which runs
// on EVERY update, before dedupe — never pays a query. Mutations persist first, then update
// the Set, so a crash between the two can only under-admit, never over-admit.

import { getSetting, setSetting, type Db } from "./db.ts";

const KEY = "allowed_user_ids";

export interface Allowlist {
  /** Whether this sender may use the bot. Open bot admits everyone, even unidentifiable senders. */
  has(id: number | undefined): boolean;
  /** True when no list exists anywhere — the original open-bot behaviour. */
  isOpen(): boolean;
  /** The current effective list, ascending, or null when open. */
  list(): number[] | null;
  add(id: number): Promise<void>;
  remove(id: number): Promise<void>;
}

export async function loadAllowlist(
  db: Db,
  config: { allowedUserIds: number[] | null },
): Promise<Allowlist> {
  const stored = parseStored(await getSetting(db, KEY));
  // Stored list (even empty) wins; corrupt/absent falls back to the env seed. Falling back
  // to OPEN on corruption would turn a bad row into an unauthenticated, billable bot.
  let current: Set<number> | null =
    stored !== undefined ? new Set(stored) : config.allowedUserIds ? new Set(config.allowedUserIds) : null;

  const persist = async (next: Set<number>): Promise<void> => {
    await setSetting(db, KEY, JSON.stringify([...next].sort((a, b) => a - b)));
    current = next;
  };

  return {
    has: (id) => (current === null ? true : id !== undefined && current.has(id)),
    isOpen: () => current === null,
    list: () => (current === null ? null : [...current].sort((a, b) => a - b)),
    add: async (id) => {
      const next = new Set(current ?? []);
      next.add(id);
      await persist(next);
    },
    remove: async (id) => {
      if (current === null) return; // nothing to remove from an open bot — and never close it as a side effect
      const next = new Set(current);
      next.delete(id);
      await persist(next);
    },
  };
}

/** undefined = nothing usable stored (absent or corrupt); [] is a real, closed, empty list. */
function parseStored(raw: string | null): number[] | undefined {
  if (raw === null) return undefined;
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return undefined;
    return v.filter((x): x is number => typeof x === "number" && Number.isSafeInteger(x));
  } catch {
    return undefined;
  }
}
