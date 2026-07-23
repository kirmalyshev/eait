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

/** Prompt-input ceiling, matching the caption cap — past this is noise or an injection attempt. */
export const LIMITATIONS_MAX_LEN = 300;

/** Summary-line ceiling for the /settings root and /me, where the value shares a line with a label. */
export const LIMITATIONS_DISPLAY_LEN = 60;

// C0 (\u0000-\u001f, incl. NUL and the ASCII newline family) and C1 (\u007f-\u009f, incl. DEL
// and NEL \u0085). JS `\s` covers neither range fully — U+0085 in particular reads as whitespace
// to a human but is not matched by `\s` — so control characters get their own pass first.
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/g;

/**
 * Free text -> a value safe to store and to interpolate into the prompt, or null when nothing
 * survives. Control characters become spaces, double quotes are dropped (the value sits inside a
 * quoted span at the model — a bare `"` would break out of it, exactly the reason parseCountry
 * does the same), whitespace runs collapse to single spaces, and the result is capped.
 *
 * Over-length input is TRUNCATED, not rejected: unlike a country name, a limitations list is
 * plausibly long, and answering a genuine attempt with "invalid" would be hostile. The second trim
 * catches a cap that lands mid-space.
 */
export function parseLimitations(text: string): string | null {
  const cleaned = text
    .replace(CONTROL_CHARS, " ")
    .replace(/"/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, LIMITATIONS_MAX_LEN)
    .trim();
  return cleaned.length ? cleaned : null;
}

/** A stored value shortened for a summary line; shorter values pass through untouched. */
export function limitationsDisplay(value: string): string {
  return value.length > LIMITATIONS_DISPLAY_LEN
    ? `${value.slice(0, LIMITATIONS_DISPLAY_LEN)}…`
    : value;
}
