// How Spud's onboarding lines are typed out, one character at a time.
//
// The pace is a product number, not a taste one: a line that lands whole is read as pasted and
// skipped, and the onboarding is fifteen of them. Both clients draw from this one schedule — the
// phone's bubble and the web page's — so the two never disagree about how long a sentence takes.
// Every caller passes elapsed wall-clock time and reads back the prefix to show; nothing here
// keeps a clock of its own, which is what makes it testable and the two clients identical.

/** One character per beat. ChatGPT's stream is about this; slower reads as a typewriter effect. */
export const TYPE_MS_PER_CHAR = 14;

/** Code points, not UTF-16 units — an emoji is one character and never shows half-drawn. */
const chars = (text: string): string[] => Array.from(text);

/** How long the whole line takes to type. */
export function typingMs(text: string): number {
  return chars(text).length * TYPE_MS_PER_CHAR;
}

/** The part of the line on screen `elapsedMs` after it started typing. */
export function typedPrefix(text: string, elapsedMs: number): string {
  const all = chars(text);
  const n = Math.min(all.length, Math.max(0, Math.floor(elapsedMs / TYPE_MS_PER_CHAR)));
  return all.slice(0, n).join("");
}
