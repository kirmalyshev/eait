// The outbound-message budget, as vocabulary both sides read.
//
// R1 is one outbound message per user per LOCAL day. `push_slot` (backend) is the lock that
// enforces it; this file is the rank that says who wins when several senders want the same day,
// and the states a `send_log` row moves through. Rank lives here once so no sender carries a copy.

/** Highest priority first. A lower kind never evicts a higher one. */
export const PUSH_KINDS = ["trial", "streak", "onboarding", "campaign"] as const;
export type PushKind = (typeof PUSH_KINDS)[number];

/**
 * What a `send_log` row may be about: any slot kind, plus the reply to the user's own action
 * ("photo counted"), which is logged and never claims the slot.
 */
export type SendKind = PushKind | "transactional";

export const SEND_STATES = ["queued", "accepted", "refused", "delivered-to-apns", "dead", "dry"] as const;
export type SendState = (typeof SEND_STATES)[number];

/** True when `a` takes the day over `b`. Equal kinds do not outrank each other. */
export function outranks(a: PushKind, b: PushKind): boolean {
  return PUSH_KINDS.indexOf(a) < PUSH_KINDS.indexOf(b);
}

// `Intl.supportedValuesOf` omits "UTC" in some runtimes; it is a zone `localDate` accepts.
const ZONES = new Set<string>([...Intl.supportedValuesOf("timeZone"), "UTC"]);

/** An IANA zone name this runtime can date with. The app sends its own on app open. */
export function isTimezone(v: unknown): v is string {
  return typeof v === "string" && ZONES.has(v);
}
