// When a picture stops being true.
//
// Some committed screenshots bake a claim with a date in it: `05-your-target-and-why.png` prints
// "On this pace you'd be at 88 kg around November 2026", computed by `targets.ts` from the profile
// the capture walk drives. Nothing else in this repository can see it — no linter reads an image,
// and `claims.ts` reads text. So the sentence expires silently, on two surfaces at once: the App
// Store listing and the landing page.
//
// BOTH SURFACES REFUSE, AND THAT IS WHY THIS IS ITS OWN FILE. The first version guarded only the
// iOS release (`scripts/preflight-release.ts`), so on the expiry date a release build would stop
// while `make landing` and every ansible deploy went on publishing the same frame to eait.fit
// indefinitely — on the one surface whose entire purpose is a claims gate. `build.ts` reads these
// too, and `scripts/store-frames.ts` reads them for the frames that never reach the page.

/** `YYYY-MM-DD`, and nothing else. */
const SHAPE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The instant a dated claim stops being true, as UTC midnight of that day.
 *
 * THROWS ON A MALFORMED DATE RATHER THAN RETURNING NaN. `Date.parse("2026-12-1")` and
 * `Date.parse("2026/12/01")` both give NaN, every comparison against NaN is false, and a gate whose
 * comparison is always false is a gate that is switched off — silently, by a typo, on the one check
 * standing between a stale claim and the App Store. The round-trip catches a well-shaped date that
 * is not a real day: `2026-02-31` parses in some engines and is not 31 February anywhere.
 */
export function expiryMs(expires: string): number {
  if (!SHAPE.test(expires)) {
    throw new Error(`expiry "${expires}" is not YYYY-MM-DD, so nothing would ever be reported stale`);
  }
  const ms = Date.parse(`${expires}T00:00:00Z`);
  if (!Number.isFinite(ms)) throw new Error(`expiry "${expires}" is not a real date`);
  if (new Date(ms).toISOString().slice(0, 10) !== expires) {
    throw new Error(`expiry "${expires}" is not a real calendar day`);
  }
  return ms;
}

/** True from the first instant of the named day onward. */
export function hasExpired(expires: string, now: number): boolean {
  return now >= expiryMs(expires);
}

/**
 * Whole days remaining, rounded UP, so the answer is 1 for any part of the day before and 0 or less
 * only once the day has arrived.
 *
 * `Math.floor` was wrong here in a way that reads as correct: half a day before the expiry it
 * returned 0, which every caller treated as expired, so a release was refused a full day before the
 * date the table names.
 */
export function daysLeft(expires: string, now: number): number {
  return Math.ceil((expiryMs(expires) - now) / 86_400_000);
}
