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
  PROMPT_DEFAULTS, PROMPT_KEYS, type PromptKey, type PromptSource, validateStoredPrompt,
} from "../llm/prompt.ts";
import type { EngineDeps } from "./deps.ts";
import type { PromptRevision } from "../store.ts";

/** One prompt as the admin sees it: what is live, and whether anybody put it there. */
export interface PromptView {
  key: PromptKey;
  text: string;
  /**
   * The live revision's number. Normally 1 or more — every store comes up holding the shipped text
   * — and 0 only when the store could not be read at all and these are the compiled-in constants.
   */
  version: number;
  updated_at: string | null;
  /** Who wrote the live text: the shipper, or a person editing it. */
  source: PromptSource;
  /**
   * What THIS BUILD was written with, whatever is live.
   *
   * Sent on every view so the editor can offer "restore shipped" without a second round trip, and
   * so an admin looking at their own edit can see what it replaced. It is also the only way to tell
   * that a deploy has moved the constant underneath a row somebody owns — the two differ and
   * nothing else would say so.
   */
  shipped: string;
}

export type PromptSave =
  | { ok: true; key: PromptKey; version: number }
  /**
   * `conflict` means another save landed between this one's read and its write, NOT that the prose
   * was unacceptable — the route answers 409 rather than 422, because telling somebody their
   * writing was refused when a plain retry succeeds sends them to rewrite a prompt that was fine.
   */
  | { ok: false; errors: string[]; conflict?: boolean };

/**
 * Every prompt this server sends, with whatever the store has laid over it.
 *
 * Reads the store ONCE and answers for all six, so a caller cannot be handed a half-refreshed set.
 * A store that throws is the compiled-in list with `version: 0`, because a listing that will not
 * answer during a database incident is a listing that is missing exactly when it is wanted — and
 * `version: 0` is not a lie there: no revision is live, and the transport is falling back to those
 * same constants.
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
    const shipped = PROMPT_DEFAULTS[key];
    return usable
      ? { key, text: usable.text, version: usable.row.version, updated_at: usable.row.updated_at, source: usable.row.source, shipped }
      : { key, text: shipped, version: 0, updated_at: null, source: "shipped", shipped };
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
    // `"admin"` is what protects this text from the next deploy: `syncShippedPrompts` rewrites a
    // row the shipper wrote and never one a person wrote.
    const version = await deps.store.putPrompt(result.key, result.text, "admin");
    // The one line that says a prompt changed, and the only record outside the table itself. The
    // text is NOT logged: it is long, and the row is where it lives.
    console.log(`[eait] prompt "${result.key}" saved as version ${version}`);
    return { ok: true, key: result.key, version };
  } catch (e) {
    console.error(`[eait] prompt "${result.key}" could not be saved: ${(e as Error)?.message ?? e}`);
    // `putPrompt` computes its own version inside the insert, so two saves of one key racing both
    // compute N and the loser violates the primary key. That is the store's guard working, and the
    // answer to it is "try again", which is a different sentence from "your prompt is invalid".
    if (isVersionConflict(e)) {
      return {
        ok: false,
        conflict: true,
        errors: ["somebody else saved this prompt a moment ago — reload it and apply your change on top"],
      };
    }
    return { ok: false, errors: ["this prompt could not be saved — the store refused the write"] };
  }
}

/**
 * A unique-violation on `(key, version)`, however the driver reports it.
 *
 * Both forms are checked because only one of them is guaranteed: Postgres sends SQLSTATE 23505 and
 * `Bun.sql` may surface it as `code` or fold it into the message, and the memory store throws a
 * plain `Error`. Guessing wrong here costs an admin a 422 they cannot act on, so it errs toward
 * reading an ambiguous failure as the generic one.
 */
function isVersionConflict(e: unknown): boolean {
  const err = e as { code?: unknown; message?: unknown };
  if (String(err?.code) === "23505") return true;
  const message = String(err?.message ?? "").toLowerCase();
  return message.includes("duplicate key") || message.includes("unique constraint");
}

/**
 * Every revision of one prompt, newest first — what was being sent, and when it started being sent.
 *
 * The reason the table is append-only, finally readable: "which words produced this analysis" is
 * answered by reading down this list to the revision live on the day. It is the admin's view, so it
 * carries the whole text of each revision rather than a summary — a diff nobody can open is a diff
 * nobody reads.
 */
export async function promptHistory(deps: EngineDeps, key: unknown): Promise<PromptRevision[] | null> {
  if (!PROMPT_KEYS.includes(key as PromptKey)) return null;
  return await deps.store.promptRevisions(key as PromptKey).catch((e: unknown) => {
    console.error(`[eait] could not read the revisions of "${String(key)}": ${(e as Error)?.message ?? e}`);
    return [];
  });
}
