// The RevenueCat webhook. The ONLY way an account becomes paid.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// FOUR RULES, ALL OF THEM SECURITY
//
//  1. OFF BY DEFAULT. No `EAIT__BACKEND__REVENUECAT_WEBHOOK_TOKEN` and this path answers 404 — not
//     403, because "there is a purchase webhook here" is information. Same shape as /admin.
//  2. ITS OWN CREDENTIAL, checked BEFORE the body is read. A user's bearer token is worthless
//     here and this token is worthless on the user API. What is behind it is the ability to write
//     "has paid" onto any account whose id you can name, and account ids are given to clients.
//  3. CONSTANT-TIME COMPARISON, for the same reason the admin token gets one.
//  4. NO USER ID FROM A REQUEST — except this one, which is the whole point of the route and is
//     therefore the one place it must be argued for. See `parseRevenueCatEvent`.
//
// It answers 200 to everything it is willing to read, including events it deliberately ignores. A
// non-2xx makes RevenueCat retry, and retrying an event that was correctly ignored means being
// told the same irrelevant thing all day.
// ─────────────────────────────────────────────────────────────────────────────────────────────

import { applyRevenueCatEvent, type EngineDeps, type RevenueCatEvent } from "../engine/index.ts";
import { timingSafeEqual } from "../auth/timingsafe.ts";

export const REVENUECAT_WEBHOOK_PATH = "/v1/revenuecat/webhook";

/**
 * The largest delivery this route will read.
 *
 * RevenueCat's payloads are a few kilobytes. The credential is checked before the body is touched,
 * so this is not the thing standing between the server and a flood — it is the bound that stops a
 * caller who HAS the credential, or a provider having a very bad day, from handing this process an
 * unbounded allocation.
 */
const MAX_BODY_BYTES = 64 * 1024;

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Our account ids are `crypto.randomUUID()`. Anything else was never issued by this server. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Epoch milliseconds a `Date` can actually represent — ±100,000,000 days from the epoch.
 *
 * `Number.isFinite` is not enough. `1e20` is finite, and `new Date(1e20).toISOString()` THROWS a
 * RangeError — which from inside the handler is a 500, and a 500 is what makes RevenueCat retry.
 * So one malformed field would become a delivery redelivered forever, each time producing a stack
 * trace and never producing an entitlement.
 */
const MAX_EPOCH_MS = 8.64e15;
const epochMs = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= MAX_EPOCH_MS ? v : null;

/**
 * A delivery, narrowed to the five fields this server acts on, or null if it is not one.
 *
 * THE `app_user_id` QUESTION. Every other route in this API resolves a user from credentials and
 * would be broken by taking one from a body. This one takes it from the body because that is
 * literally what the message is: a third party reporting a purchase made by an account it names.
 * What makes it safe is not the shape of the id, it is the shared secret checked before this
 * function runs — and the fact that the worst a valid-but-wrong id can do is fail to match a row.
 * `putEntitlement` never creates a user.
 *
 * The id must still LOOK like one of ours. RevenueCat has ids of its own for a device that never
 * identified itself (`$RCAnonymousID:…`), and those reach a uuid column as a cast error, which is
 * a 500 and a retry, forever, for a delivery that was always going to be ignored.
 *
 * `entitlement_ids` is the current field and `entitlement_id` the deprecated singular; both are
 * still sent, depending on the event. Reading only the plural would silently drop purchases.
 */
export function parseRevenueCatEvent(body: unknown): RevenueCatEvent | null {
  if (typeof body !== "object" || body === null) return null;
  const event = (body as { event?: unknown }).event;
  if (typeof event !== "object" || event === null) return null;
  const e = event as Record<string, unknown>;

  const appUserId = e.app_user_id;
  if (typeof appUserId !== "string" || !UUID.test(appUserId)) return null;

  // The store's own clock, and the ordering key for everything downstream. A delivery without one
  // cannot be ordered against what is already stored, so it is not a delivery this server can act
  // on at all.
  const eventTimestampMs = epochMs(e.event_timestamp_ms);
  if (eventTimestampMs === null) return null;

  const ids = Array.isArray(e.entitlement_ids)
    ? e.entitlement_ids.filter((x): x is string => typeof x === "string")
    : typeof e.entitlement_id === "string" ? [e.entitlement_id] : [];

  return {
    appUserId,
    entitlementIds: ids,
    // A value out of range is treated as ABSENT, not as a refusal of the whole delivery: an event
    // with a nonsense expiry still carries a real entitlement id and a real timestamp, and
    // `applyRevenueCatEvent` handles "no expiry" by leaving the stored state alone.
    expirationAtMs: epochMs(e.expiration_at_ms),
    productId: typeof e.product_id === "string" ? e.product_id : "",
    eventTimestampMs,
    sandbox: e.environment === "SANDBOX",
  };
}

/**
 * Handle one delivery.
 *
 * Nothing about the event reaches a log line. The payload names a person's purchase, and a log
 * aggregator is not where that belongs; what is logged is whether an entitlement changed, which is
 * the only part anybody debugging this actually needs.
 */
export async function revenueCatWebhook(req: Request, deps: EngineDeps): Promise<Response> {
  const expected = deps.config.revenueCatWebhookToken;
  // Unset means the surface does not exist. 404, before anything else is considered.
  if (expected === "") return json({ error: "not found" }, 404);
  if (req.method !== "POST") return json({ error: "not found" }, 404);

  // BEFORE the body. An unauthenticated caller must not be able to make this process read
  // anything, and a header comparison costs nothing.
  const presented = req.headers.get("authorization") ?? "";
  if (!timingSafeEqual(presented, expected)) return json({ error: "unauthorized" }, 401);

  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return json({ error: "too large" }, 413);

  const body = await req.json().catch(() => null);
  const event = parseRevenueCatEvent(body);
  // A delivery this server cannot read is still a delivery it should stop being sent. 200, because
  // a 400 buys retries of a message that will never parse any differently.
  if (!event) {
    console.warn("[ieat] revenuecat: unreadable delivery ignored");
    return json({ ok: true, applied: false });
  }

  const outcome = await applyRevenueCatEvent(deps, event);
  if (outcome.applied) console.log("[ieat] revenuecat: entitlement updated");
  return json({ ok: true, applied: outcome.applied });
}
