// Containment for user text that gets interpolated INTO the analyzer prompt AND rendered into the
// plain-text /settings and /me cards.
//
// Every such value (a country, a limitation) lands inside a quoted, single-line span in the prompt,
// and unescaped into a card. Closing the hazards in one place is the point of this file:
// `country.ts` and `limitations.ts` had the same normalization copy-pasted, which is how
// `parseCountry` once ended up without the control-character pass `parseLimitations` needed.
//
// Callers keep their own CAP POLICY — a country over its limit is a typo and gets rejected; a
// limitations list over its limit is plausible and gets truncated. Only the normalization is shared.

// C0 and C1. JS `\s` covers neither range, and a raw newline would let the value escape its
// line in the prompt and read as its own instruction.
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/g;

// Invisible and direction-controlling characters that are removed outright — they carry no width to
// preserve and several are actively dangerous:
//   U+200B         zero-width space (would store as a non-empty, entirely invisible value)
//   U+200E-U+200F  LTR/RTL marks
//   U+202A-U+202E  bidi embedding and override — U+202E reverses everything after it, which
//                  Telegram honours, so one in a stored value scrambles the rest of the card
//   U+2060-U+2064  word joiner and invisible math operators
//   U+2066-U+2069  bidi isolates (the modern successor to the U+202x overrides)
//   U+FEFF         BOM / zero-width no-break space
// DELIBERATELY NOT stripped: U+200C ZWNJ and U+200D ZWJ. Those are meaningful joiners — ZWJ builds
// emoji sequences (family, profession), ZWNJ is orthographic in Persian/Arabic — and neither can
// reverse text or break a line, so removing them would silently mutate legitimate input for no
// safety gain. Only U+FEFF is in JS `\s`, so the whitespace collapse cannot be relied on here.
const INVISIBLE_CHARS = /[\u200b\u200e\u200f\u202a-\u202e\u2060-\u2064\u2066-\u2069\ufeff]/g;

// A high surrogate not followed by a low one, or a low one not preceded by a high one. A hand-edited
// DB row can carry one (Telegram input is always valid UTF-8, so bot-written values cannot); left in,
// it is UTF-8-unencodable and Telegram rejects the whole message. Stripping it here makes the
// "contained" set actually complete, so a display sink can trust the value the same way the prompt does.
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

/**
 * Normalizes user text into something safe to interpolate into the prompt AND to render into a card:
 * no lone surrogates, no dangerous invisibles/bidi, no control characters, no double quotes (the
 * value sits inside a quoted span — a bare `"` would close it early), and a single collapsed line.
 * Returns "" when nothing survives; callers decide whether that means null. Idempotent — running it
 * on an already-normalized value is a no-op, which is why the display sinks can re-apply it cheaply.
 */
export function normalizePromptText(text: string): string {
  return text
    .replace(LONE_SURROGATE, "")
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
