// Containment for user text that gets interpolated INTO the analyzer prompt.
//
// Every such value (a country, a limitation) lands inside a quoted, single-line span. Three
// separate hazards have to be closed before it goes in, and closing them in one place is the
// point of this file: `country.ts` and `limitations.ts` had the same three-line normalization
// copy-pasted, which is how `parseCountry` ended up without the control-character pass that
// `parseLimitations` correctly identified as necessary.
//
// Callers keep their own CAP POLICY — a country over its limit is a typo and gets rejected; a
// limitations list over its limit is plausible and gets truncated. Only the normalization is shared.

// C0 and C1. JS `\s` covers neither range, and a raw newline would let the value escape its
// line in the prompt and read as its own instruction.
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/g;

// Invisible and direction-controlling characters. Removed outright rather than spaced, because
// they carry no width to preserve:
//   U+200B-U+200F  zero-width space/non-joiner/joiner, LTR/RTL marks
//   U+202A-U+202E  bidi embedding and override — U+202E reverses everything after it, which
//                  Telegram honours, so one of these in a stored value scrambles the rest of
//                  the /settings and /me cards
//   U+2060-U+2064  word joiner and invisible operators
//   U+2066-U+2069  bidi isolates
//   U+FEFF         BOM / zero-width no-break space
// Of these only U+FEFF is in JS `\s`, so the whitespace collapse cannot be relied on for any
// of the rest — a lone U+200B would otherwise store as a non-empty, entirely invisible value.
const INVISIBLE_CHARS = /[\u200b-\u200f\u202a-\u202e\u2060-\u2064\u2066-\u2069\ufeff]/g;

/**
 * Normalizes user text into something safe to interpolate: no invisibles, no control characters,
 * no double quotes (the value sits inside a quoted span — a bare `"` would close it early), and
 * a single line with collapsed whitespace. Returns "" when nothing survives; callers decide
 * whether that means null.
 */
export function normalizePromptText(text: string): string {
  return text
    .replace(INVISIBLE_CHARS, "")
    .replace(CONTROL_CHARS, " ")
    .replace(/"/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Truncates to `max` CODE POINTS, not UTF-16 code units.
 *
 * A plain `.slice(max)` cuts astral characters (emoji, and every non-BMP script) in half, leaving
 * a lone surrogate. That is not cosmetic: the value is UTF-8 encoded on its way to Postgres and to
 * Telegram, a lone surrogate is not encodable, and the Bot API rejects the whole message with
 * "strings must be encoded in UTF-8" — which would take out /settings and /me for that user until
 * the field was cleared, via a field only reachable through /settings.
 */
export function truncateCodePoints(text: string, max: number): string {
  const points = [...text];
  return points.length <= max ? text : points.slice(0, max).join("");
}
