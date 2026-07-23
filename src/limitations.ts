// Free-text personal limitations — the open-ended companion to the closed `restrictions` tag
// vocabulary in targets.ts.
//
// The split is deliberate: a RESTRICTION is one of four known tags that drives a numeric cap in
// `targetsFor` and a structured verdict dimension the analyzer schema knows about. A LIMITATION is
// whatever else the user needs the model to respect ("no peanuts", "low FODMAP", "gastritis —
// nothing spicy") — prompt-only, no caps, no new verdict keys.
//
// Everything here is pure. The value is interpolated INSIDE a quoted span in the analyzer prompt,
// so `parseLimitations` is also the containment boundary: single line, no quotes, bounded length.

import { normalizePromptText, truncateCodePoints } from "./prompt_text.ts";

/** Prompt-input ceiling, matching the caption cap — past this is noise or an injection attempt. */
export const LIMITATIONS_MAX_LEN = 300;

/** Summary-line ceiling for the /settings root and /me, where the value shares a line with a label. */
export const LIMITATIONS_DISPLAY_LEN = 60;

/**
 * Free text -> a value safe to store and to interpolate into the prompt, or null when nothing
 * survives. Normalization (invisibles, control characters, quotes, whitespace) is shared with
 * parseCountry via prompt_text.ts — the two fields land in the same quoted prompt span and face
 * the same hazards.
 *
 * Over-length input is TRUNCATED, not rejected: unlike a country name, a limitations list is
 * plausibly long, and answering a genuine attempt with "invalid" would be hostile. The trim
 * after truncation catches a cut that lands mid-space.
 */
export function parseLimitations(text: string): string | null {
  const cleaned = truncateCodePoints(normalizePromptText(text), LIMITATIONS_MAX_LEN).trim();
  return cleaned.length ? cleaned : null;
}

/**
 * A stored value shortened for a summary line; shorter values pass through untouched. Truncation
 * is by CODE POINT — a `.slice()` here would halve an emoji and emit a lone surrogate, which
 * Telegram rejects outright ("strings must be encoded in UTF-8"), taking /settings and /me down
 * for that user via a field only reachable through /settings.
 */
export function limitationsDisplay(value: string): string {
  const cut = truncateCodePoints(value, LIMITATIONS_DISPLAY_LEN);
  return cut === value ? value : `${cut}…`;
}
