// The admin's on/off switches (#563). The store holds an append-only history; this file is the
// default, the read-per-request, and the admin's view and write.

import { SWITCH_KEYS, type SwitchFlip, type SwitchKey } from "../store.ts";
import type { EngineDeps } from "./deps.ts";

/**
 * What a never-set switch means. The grounding switches default ON — a fresh database behaves
 * exactly as before they existed. `prompt.photo-lean` (#607) defaults OFF: it is an experiment,
 * and a database that says nothing has said nothing.
 */
export const SWITCH_DEFAULT: Record<SwitchKey, boolean> = {
  "grounding.photo": true,
  "grounding.text": true,
  "prompt.photo-lean": false,
};

export async function switchOn(deps: EngineDeps, key: SwitchKey): Promise<boolean> {
  try {
    return (await deps.store.switchEnabled(key)) ?? SWITCH_DEFAULT[key];
  } catch {
    // Logged without detail, and the default taken: a switch must never fail a meal.
    console.error(`[eait] switch read failed: ${key}`);
    return SWITCH_DEFAULT[key];
  }
}

export interface SwitchView {
  key: SwitchKey;
  enabled: boolean;
  /** Who flipped it last and when; null while it has never been set (the default applies). */
  setBy: string | null;
  setAt: string | null;
}

const RECENT = 20;

export async function adminSwitches(deps: EngineDeps): Promise<{ switches: SwitchView[]; recent: SwitchFlip[] }> {
  // One read, wide enough to hold the newest flip of every key as well as the page's list.
  const history = await deps.store.switchHistory(Math.max(RECENT, 200));
  const switches = await Promise.all(SWITCH_KEYS.map(async (key): Promise<SwitchView> => {
    const last = history.find((f) => f.key === key);
    return { key, enabled: (await deps.store.switchEnabled(key)) ?? SWITCH_DEFAULT[key], setBy: last?.set_by ?? null, setAt: last?.set_at ?? null };
  }));
  return { switches, recent: history.slice(0, RECENT) };
}

export type SwitchSave = { ok: true } | { ok: false; errors: string[] };

export async function saveSwitch(deps: EngineDeps, key: unknown, enabled: unknown, adminId: string): Promise<SwitchSave> {
  if (typeof key !== "string" || !(SWITCH_KEYS as readonly string[]).includes(key)) return { ok: false, errors: ["unknown switch"] };
  if (typeof enabled !== "boolean") return { ok: false, errors: ["enabled must be true or false"] };
  await deps.store.setSwitch(key as SwitchKey, enabled, adminId);
  return { ok: true };
}
