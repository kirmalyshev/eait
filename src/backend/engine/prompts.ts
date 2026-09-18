// The system prompts an admin can edit, and the gate they pass on the way in.
//
// The text itself still lives in `llm/prompt.ts` — these functions decide what may REPLACE it. The
// split is the one `engine/onboarding.ts` already draws: the store writes what it is given, the
// engine is what validates, and the route is four lines that call one function here.
//
// VALIDATION IS ON THE WRITE, AND IT HAS TO BE. A stored prompt never meets `tsc`, never meets a
// reviewer, and never meets a test — it goes from a text box to a model. The write is the last
// place anything can say no, which is why `savePrompt` refuses rather than repairs: silently
// deleting a character from somebody's prompt changes what the model was asked without telling
// them, and they would go looking for the change in the model.

import {
  PROMPT_DEFAULTS, PROMPT_KEYS, type PromptKey, validateStoredPrompt,
} from "../llm/prompt.ts";
import type { EngineDeps } from "./deps.ts";

/** One prompt as the admin sees it: what is live, and whether anybody put it there. */
export interface PromptView {
  key: PromptKey;
  text: string;
  /** The stored revision's number, or 0 when the compiled-in prompt is what is live. */
  version: number;
  updated_at: string | null;
  /** False when `text` is the constant from `llm/prompt.ts`. */
  stored: boolean;
}

export type PromptSave =
  | { ok: true; key: PromptKey; version: number }
  | { ok: false; errors: string[] };

/**
 * Every prompt this server sends, with whatever the store has laid over it.
 *
 * Reads the store ONCE and answers for all six, so a caller cannot be handed a half-refreshed set.
 * A store that throws is the compiled-in list with `version: 0`, because a listing that will not
 * answer during a database incident is a listing that is missing exactly when it is wanted — and
 * `version: 0` is not a lie there: the transport is falling back to those same constants.
 */
export async function livePrompts(deps: EngineDeps): Promise<PromptView[]> {
  const stored = await deps.store.getPrompts().catch((e: unknown) => {
    console.error(`[eait] could not list the stored prompts: ${(e as Error)?.message ?? e}`);
    return [];
  });
  return PROMPT_KEYS.map((key) => {
    const row = stored.find((r) => r.key === key);
    // The same guard the read side runs: a row that would not pass the gate is not shown as live,
    // because it is not what the model is being sent. And what IS shown is the gate's OWN text
    // rather than the column's — a hand-edited row with CRLF line endings is canonicalised before
    // it is sent, so showing the raw column would display something the server does not use.
    const checked = row ? validateStoredPrompt(key, row.text) : undefined;
    const usable = checked?.ok ? { row: row!, text: checked.text } : undefined;
    return usable
      ? { key, text: usable.text, version: usable.row.version, updated_at: usable.row.updated_at, stored: true }
      : { key, text: PROMPT_DEFAULTS[key], version: 0, updated_at: null, stored: false };
  });
}

/**
 * Save an edited prompt, after validating it.
 *
 * The version is assigned by the STORE, in the statement that inserts the row, for the reason
 * `saveOnboardingContent` assigns its own: two admins saving at once must not end up sharing a
 * number that is supposed to identify which words a model was sent.
 */
export async function savePrompt(deps: EngineDeps, key: unknown, text: unknown): Promise<PromptSave> {
  const result = validateStoredPrompt(key, text);
  if (!result.ok) return result;
  try {
    const version = await deps.store.putPrompt(result.key, result.text);
    // The one line that says a prompt changed, and the only record outside the table itself. The
    // text is NOT logged: it is long, and the row is where it lives.
    console.log(`[eait] prompt "${result.key}" saved as version ${version}`);
    return { ok: true, key: result.key, version };
  } catch (e) {
    console.error(`[eait] prompt "${result.key}" could not be saved: ${(e as Error)?.message ?? e}`);
    return { ok: false, errors: ["this prompt could not be saved — the store refused the write"] };
  }
}
