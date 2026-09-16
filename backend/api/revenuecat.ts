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

/** How long the misconfiguration warning stays quiet after a delivery matched. */
const QUIET_AFTER_MATCH_MS = 60 * 60 * 1000;

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

/** The `event` object of a delivery, or null if the body is not shaped like one. */
const eventOf = (body: unknown): Record<string, unknown> | null => {
  if (typeof body !== "object" || body === null) return null;
  const event = (body as { event?: unknown }).event;
  if (typeof event !== "object" || event === null) return null;
  return event as Record<string, unknown>;
};

/** The ids in one `transferred_*` array that this server issued. Others are counted, never printed. */
function accounts(v: unknown): string {
  const all = Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  const ours = all.filter((x) => UUID.test(x));
  const other = all.length - ours.length;
  return [...ours, ...(other > 0 ? [`${other} not ours`] : [])].join(", ") || "none";
}

/**
 * A TRANSFER named for the log, or null if this delivery is not one.
 *
 * A transfer is refused for a STRUCTURAL reason — no `app_user_id`, and no product or expiry to
 * grant from either — and logging that as "unreadable" made it indistinguishable from a malformed
 * body, which is how it went unnoticed beside a sign-in (#682). The accounts are what a person
 * repairing a stranded entitlement by hand needs; ours are the only ids printed.
 */
export function describeTransfer(body: unknown): string | null {
  const e = eventOf(body);
  if (e === null || e.type !== "TRANSFER") return null;
  return `from ${accounts(e.transferred_from)} to ${accounts(e.transferred_to)}`;
}

/**
 * A delivery, narrowed to the six fields this server acts on, or null if it is not one.
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
  const e = eventOf(body);
  if (e === null) return null;

  const appUserId = e.app_user_id;
  if (typeof appUserId !== "string" || !UUID.test(appUserId)) return null;

  // The store's own clock, and the ordering key for everything downstream. A delivery without one
  // cannot be ordered against what is already stored, so it is not a delivery this server can act
  // on at all.
  const eventTimestampMs = epochMs(e.event_timestamp_ms);
  if (eventTimestampMs === null) return null;

  // ABSENT AND NONSENSE ARE NOT THE SAME FIELD. Absent is meaningful — it is what a non-consumable
  // sends, and it is how the lifetime unlock is recognised. A value that is present but cannot be a
  // date is a provider bug, and reading it as absent would turn it into a lifetime grant, or into
  // the refund of one. Refuse the delivery instead: it answers 200 and is logged as unreadable,
  // which is the same treatment every other malformed field gets.
  if (e.expiration_at_ms !== undefined && e.expiration_at_ms !== null && epochMs(e.expiration_at_ms) === null) {
    return null;
  }

  const ids = Array.isArray(e.entitlement_ids)
    ? e.entitlement_ids.filter((x): x is string => typeof x === "string")
    : typeof e.entitlement_id === "string" ? [e.entitlement_id] : [];

  return {
    appUserId,
    // Absent is a valid parse, not a refusal: the type only ever decides what a NO-EXPIRY event
    // means, and "" falls through to changing nothing, which is the safe reading of a delivery
    // this server does not recognise.
    type: typeof e.type === "string" ? e.type : "",
    entitlementIds: ids,
    expirationAtMs: epochMs(e.expiration_at_ms),
    productId: typeof e.product_id === "string" ? e.product_id : "",
    // TRIAL is the free week; NORMAL is a paid period, and INTRO/PROMOTIONAL are discounted paid
    // ones. Only the first is what step 15 sold and what the two reminders are addressed at.
    trial: e.period_type === "TRIAL",
    eventTimestampMs,
    sandbox: e.environment === "SANDBOX",
  };
}

/**
 * Handle one delivery.
 *
 * Nothing about the PURCHASE reaches a log line. The payload names what a person bought, and a log
 * aggregator is not where that belongs; what is logged is whether an entitlement changed, plus the
 * two account ids of a refused transfer, which name the accounts rather than the purchase.
 */
/**
 * Build the webhook handler.
 *
 * A FACTORY because of the one piece of state below. Per SERVER, not per process and not per
 * module: a fresh router gets a fresh answer to "has this server ever seen a purchase it
 * recognised", which is what the question means, and is also what stops one test's state from
 * deciding the next one's.
 */
export function createRevenueCatWebhook(): (req: Request, deps: EngineDeps) => Promise<Response> {
  /**
   * When the warning below goes quiet until.
   *
   * TIME-BOXED, NOT PERMANENT, and the difference is the whole point. A project is allowed more
   * than one entitlement — a legacy plan, an internal comp — so warning on every event for those
   * would turn a line meant to be rare into a standing false alarm. But a permanent latch blinds
   * the case the warning exists for: a rename in the RevenueCat dashboard, which somebody can do
   * without touching this repo, and which on a server that has already taken one successful
   * purchase would then produce total silence until the process restarted. An hour of quiet after
   * each match keeps the anti-spam property and still surfaces a rename within the hour.
   */
  let quietUntil = 0;
  return (req, deps) => revenueCatWebhook(req, deps, {
    matched: () => Date.now() < quietUntil,
    markMatched: () => { quietUntil = Date.now() + QUIET_AFTER_MATCH_MS; },
  });
}

/** The quiet period, injected so the handler itself stays a plain function of its inputs. */
interface MatchLatch {
  /** True while the warning is suppressed by a recent match. */
  matched(): boolean;
  markMatched(): void;
}

export async function revenueCatWebhook(
  req: Request,
  deps: EngineDeps,
  latch: MatchLatch = { matched: () => false, markMatched: () => {} },
): Promise<Response> {
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
    const transfer = describeTransfer(body);
    console.warn(transfer === null
      ? "[eait] revenuecat: unreadable delivery ignored"
      : `[eait] revenuecat: a transfer was refused, ${transfer} — the payload carries no product ` +
        `or expiry, so no entitlement moved (#682)`);
    return json({ ok: true, applied: false });
  }

  const outcome = await applyRevenueCatEvent(deps, event);
  if (outcome.applied) {
    console.log("[eait] revenuecat: entitlement updated");
    latch.markMatched();
  }
  // THE ONE REFUSAL THAT IS ALMOST NEVER ORDINARY.
  //
  // A LIVE event that granted entitlements, none of which is the one this server checks, is what a
  // wrong `EAIT__BACKEND__REVENUECAT_ENTITLEMENT_ID` looks like from in here — and it looks like it
  // on every single real purchase, while every customer is charged and gets nothing. It is also
  // what a rename in the RevenueCat dashboard looks like, which is a thing somebody can do without
  // touching this repo at all.
  //
  // Silence was the actual failure mode: the identifier was wrong for a day and nothing said so,
  // because an ignored event and a misconfigured one were the same non-event in the log. Found by
  // auditing the live dashboard by hand, which is not a control.
  //
  // Narrow on purpose. Events that grant NOTHING (a dashboard test ping, a transfer, an alias) are
  // silent, and so is anything from sandbox, or a staging server would warn all day. The payload
  // still reaches no log line: what is printed is our own configured identifier and the fact of a
  // mismatch, never what anybody bought.
  else if (
    outcome.reason === "other-entitlement" && !event.sandbox &&
    event.entitlementIds.length > 0 && !latch.matched()
  ) {
    console.warn(
      `[eait] revenuecat: a live purchase granted no entitlement this server knows — ` +
      `expected ${deps.config.revenueCatEntitlementId}. Check the RevenueCat dashboard.`,
    );
  }
  return json({ ok: true, applied: outcome.applied });
}
