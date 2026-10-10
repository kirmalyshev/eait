// The outbound-message vocabulary, as both sides read it.
//
// There is NO cross-sender daily cap (ieat-app#1965). `push_claim` (backend) is keyed by (account,
// LOCAL day, sender): each sender sends at most once a day for its own reason, which is what makes
// a per-minute tick idempotent. The only bound is the account's `push_daily_max` (and the optional
// instance default), enforced in the one claim every sender goes through.

/** The kinds a `send_log` / `push_claim` row may carry. The tick sends one scheduled message of the first four. */
export const PUSH_KINDS = ["trial", "streak", "evening", "onboarding", "campaign"] as const;
export type PushKind = (typeof PUSH_KINDS)[number];

/**
 * Who a claim belongs to. Every scheduled kind is the tick's ONE scheduled message (a trigger or the
 * evening line, never both); a campaign is its `ref` (a campaign id, `admin:<id>`, `admin-test`).
 */
export function pushSenderOf(kind: PushKind, ref: string | null): string {
  return kind === "campaign" ? `campaign:${ref ?? ""}` : "scheduled";
}

/**
 * What a `send_log` row may be about: any slot kind, plus the reply to the user's own action
 * ("photo counted"), which is logged and never claims the slot.
 */
export type SendKind = PushKind | "transactional";

/**
 * `expired`: accepted by the push service, and its receipt never came within a day. Terminal.
 * `would_have_sent`: a campaign's holdout. The account was due the message and was kept out of it on
 * purpose; nothing went to any push service and no slot was claimed. It exists so the report has a
 * control group with a send time to measure conversion from.
 */
export const SEND_STATES = ["queued", "accepted", "refused", "delivered-to-apns", "dead", "dry", "expired", "would_have_sent"] as const;
export type SendLogState = (typeof SEND_STATES)[number];

/**
 * An IANA zone name this runtime can date with. The app sends its own on app open.
 *
 * Asked of `Intl.DateTimeFormat` itself, the thing `localDate` dates with, rather than checked
 * against `Intl.supportedValuesOf("timeZone")`: that list is canonical names only and, in bun 1.4,
 * leaves out names a phone really reports (Asia/Kolkata, Asia/Ho_Chi_Minh, Europe/Kyiv, Etc/UTC).
 */
export function isTimezone(v: unknown): v is string {
  if (typeof v !== "string" || v.length === 0 || v.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: v });
    return true;
  } catch {
    return false;
  }
}
