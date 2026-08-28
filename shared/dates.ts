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
