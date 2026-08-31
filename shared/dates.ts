// Calendar dates in a named timezone.
//
// Dates are computed in the configured zone (Europe/Berlin by default), NOT in UTC. A daily total
// whose midnight boundary is UTC rolls over at 01:00 or 02:00 local, so a late dinner lands on
// tomorrow and the user's day looks empty when they open the app before bed.
//
// THIS LIVES IN SHARED BECAUSE BOTH SIDES COMPUTE DATES NOW. It used to be backend-only, which was
// correct while the server was the only thing that decided what day a number belonged to. Apple
// Health changed that: the phone aggregates raw samples into days before sending them. If it used
// the DEVICE's zone while the server used its configured one, a day's meals and that same day's
// health metrics would describe different twenty-four-hour windows — invisibly, only for people who
// travel, and never reproducibly for whoever goes looking. The server sends its zone in
// `ProfileResponse.timezone` and the phone aggregates in that.

/** `YYYY-MM-DD` for an instant, in the given IANA zone. */
export function localDate(zone: string, at: Date = new Date()): string {
  // `en-CA` formats as YYYY-MM-DD, which is the format we want and avoids hand-assembling parts.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(at);
}

/** `HH:MM` for an instant, in the given zone. Fed to the analyzer so it can infer the meal type. */
export function localTime(zone: string, at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: zone, hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(at);
}

/**
 * Shift a stored `YYYY-MM-DD` by whole days — CALENDAR subtraction, DST-safe.
 *
 * Never `localDate(new Date(Date.now() - n * 86_400_000))`: subtracting fixed 24-hour spans and
 * re-deriving a local date is off by one across a DST transition near midnight, which is a bug that
 * appears twice a year and is never reproducible when someone looks for it.
 */
export function dateMinus(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const shifted = new Date(Date.UTC(y, m - 1, d - days));
  return shifted.toISOString().slice(0, 10);
}

/** The wall clock `zone` shows for an instant, re-read as if it were UTC. Its distance from the real instant is the zone's offset. */
function wallClockAsUtc(zone: string, at: Date): number {
  const p: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat("en-US", {
    timeZone: zone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(at)) p[part.type] = part.value;
  return Date.UTC(+p.year!, +p.month! - 1, +p.day!, +p.hour!, +p.minute!, +p.second!);
}

/**
 * The instant a calendar day BEGINS in `zone`.
 *
 * The other direction from `localDate`, and needed for the same reason it exists: the phone reads
 * its health store from "the start of the oldest day the server keeps", and that start is the
 * server's midnight, not the device's. A read that began at the device's midnight — or seven times
 * twenty-four hours before now — takes a partial first day and upserts it over a complete one.
 *
 * Found by offset: midnight UTC of the date, shifted by what the zone's clock shows at that instant,
 * then checked once more at the answer in case the offset changed in between — which it does on the
 * two days a year the clocks move, and those are exactly the days a fixed offset gets wrong.
 */
export function zonedMidnight(zone: string, date: string): Date {
  const utc = Date.parse(`${date}T00:00:00Z`);
  let at = utc - (wallClockAsUtc(zone, new Date(utc)) - utc);
  const offsetAtAnswer = wallClockAsUtc(zone, new Date(at)) - at;
  if (at + offsetAtAnswer !== utc) at = utc - offsetAtAnswer;
  return new Date(at);
}

/** `YYYY-MM-DD`, and a real calendar date — `2026-02-31` parses as a string and is not a day. */
export function isCalendarDate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/**
 * How a stored `YYYY-MM-DD` is spoken to a person.
 *
 * An ISO date is a machine's format. "Logging to 2026-08-27 — look right?" asks the user to parse a
 * timestamp in order to answer a yes/no question about their lunch, and the diary's own header said
 * the same thing.
 *
 * Sentence form ("today", not "Today"), because most uses here are mid-sentence; a heading applies
 * `textTransform: "capitalize"` rather than this returning two shapes.
 */
export function dayLabel(date: string, today: string): string {
  if (date === today) return "today";
  if (date === dateMinus(today, 1)) return "yesterday";
  // Midday UTC, so the label cannot slip a day on either side of the date line while formatting a
  // value that carries no time at all.
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC", weekday: "short", day: "numeric", month: "short",
  }).format(new Date(`${date}T12:00:00Z`)).replace(",", "");
}

// ── Months ───────────────────────────────────────────────────────────────────────────────────
//
// The diary's date picker needs a month at a time. All of it is pure calendar arithmetic on a
// `YYYY-MM` — no zone is involved once "today" has been resolved in one, which `localDate` does.
// It lives here rather than in the component because a grid that silently drops 29 February, or
// puts a month's first day in the wrong column, is wrong in a way nobody notices by looking.

/** The `YYYY-MM` a stored date falls in. */
export function monthOf(date: string): string {
  return date.slice(0, 7);
}

/** Step whole months. Negative goes back. Crosses the year without special-casing it. */
export function monthShift(month: string, months: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  // Month index arithmetic rather than +/- on the number: `Date.UTC` normalises month 12 to
  // January of the next year and month -1 to the previous December, which is the whole problem.
  const at = new Date(Date.UTC(y, m - 1 + months, 1));
  return at.toISOString().slice(0, 7);
}

/**
 * Every date the picker draws for a month: whole weeks, Monday first.
 *
 * It runs from the Monday on or before the 1st to the Sunday on or after the last day, so each
 * column is one weekday and the rows are contiguous days. The cells outside the month are real
 * dates and are drawn muted rather than blank — a blank is a hole the eye has to step over, and
 * tapping one is a reasonable thing to want.
 *
 * MONDAY, not Sunday: this app's zone is Europe/Berlin and ISO-8601 weeks start on Monday.
 */
export function monthGrid(month: string): string[] {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const first = new Date(Date.UTC(y, m - 1, 1));
  // getUTCDay is 0 for Sunday; shift so Monday is 0 and Sunday is 6.
  const lead = (first.getUTCDay() + 6) % 7;
  const start = new Date(Date.UTC(y, m - 1, 1 - lead));
  // ALWAYS SIX ROWS, padded rather than fitted. Five rows suit some months and six others, and a
  // card that changes height as you page months reads as a glitch rather than as a shorter month.
  // Six is the most any month can need — a 31-day month starting on a Sunday spans 37 cells — so
  // this never truncates.
  const cells = 6 * 7;
  return Array.from({ length: cells }, (_, i) =>
    new Date(Date.UTC(
      start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + i,
    )).toISOString().slice(0, 10));
}

/** How a `YYYY-MM` is spoken to a person. */
export function monthLabel(month: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC", month: "long", year: "numeric",
  }).format(new Date(`${month}-01T12:00:00Z`));
}
