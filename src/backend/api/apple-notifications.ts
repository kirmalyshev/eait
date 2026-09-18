// Apple's server-to-server notifications. The URL that goes in the App ID configuration.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// Apple posts here when a user revokes Sign in with Apple in Settings, or deletes their Apple
// Account. Without it, someone who withdrew consent keeps a live session on this server, and an
// account nobody can ever reach again keeps the medical free text in it.
//
// FOUR RULES, ALL OF THEM SECURITY
//
//  1. OFF BY DEFAULT. No `EAIT__BACKEND__APPLE_AUDIENCES` and this path answers 404 — not 403,
//     because "there is an endpoint here that ends sessions" is information, and with no audience
//     there is nothing to check a token against. Same shape as /admin and the purchase webhook.
//  2. THE SIGNATURE IS THE CREDENTIAL. There is no shared secret to check before the body, because
//     the message itself is what proves who sent it: signature, issuer and audience, against the
//     same JWKS sign-in uses. See `auth/verify.ts`.
//  3. NO USER ID FROM A REQUEST — except this one, which is the whole point of the route. The
//     subject inside `events` names the account, exactly as `app_user_id` does in the RevenueCat
//     webhook, and it is safe for the same two reasons: it arrives inside a message this server
//     has verified, and the worst a valid-but-unknown one can do is match no row.
//  4. THE ANSWER IS THE SAME EITHER WAY. Every readable delivery gets `{ok:true}` — known subject
//     or not. A route that answered differently would tell any caller who can forge nothing at all
//     whether a given Apple user has an account here, which is a question this server should not
//     be able to be asked.
//
// It answers 200 to everything it is willing to read, including events it deliberately ignores. A
// non-2xx makes Apple retry, and retrying a message that will never parse any differently means
// being told the same unreadable thing all day.
// ─────────────────────────────────────────────────────────────────────────────────────────────

import { AuthError, type AppleNotificationVerifier } from "../auth/verify.ts";
import { revokeAppleIdentity, type EngineDeps } from "../engine/index.ts";

export const APPLE_NOTIFICATIONS_PATH = "/v1/apple/notifications";

/**
 * The largest delivery this route will read.
 *
 * Apple's are a couple of kilobytes. Unlike the purchase webhook there is no credential that can
 * be checked before the body — the signature is inside it — so this bound is the only thing
 * standing between an anonymous caller and a large allocation, and it is enforced on the read
 * itself rather than on what the caller says the size is. See `readCapped`.
 */
const MAX_BODY_BYTES = 64 * 1024;

/**
 * The body as text, or null when it is larger than `max`.
 *
 * Read in chunks and abandoned the moment it goes over, rather than buffered and then measured. A
 * size limit applied after the read has already spent the memory it exists to refuse — and the
 * declared length cannot stand in for it, because a caller who omits `Content-Length`, or puts
 * something that is not a number in it, would pass the check that an honest one fails.
 */
async function readCapped(req: Request, max: number): Promise<string | null> {
  const reader = req.body?.getReader();
  if (reader === undefined) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** The two types that mean "this identity can never authenticate here again". */
const REVOCATIONS = new Set(["consent-revoked", "account-delete"]);

/**
 * The floor for a usable `event_time`, in epoch milliseconds: 2001-09-09.
 *
 * Apple sends milliseconds. If a delivery ever carried SECONDS, reading them as milliseconds would
 * date every event to 1970 — every revocation would look older than the link it names, and the
 * endpoint would ignore all of them while answering 200. A value below this floor is treated as no
 * time at all, which means the event is applied: unorderable, never ignored.
 */
const MIN_PLAUSIBLE_EVENT_MS = 1e12;
/** What a `Date` can represent. Beyond it, arithmetic on the value is meaningless rather than late. */
const MAX_EPOCH_MS = 8.64e15;

/**
 * One event, narrowed to the three fields this server acts on, or null if it is not one.
 *
 * `events` IS A JSON-ENCODED STRING, not an object — that is Apple's format, and reading it as an
 * object is the mistake this parser exists to make impossible to make silently. Anything else is
 * null, and null is answered 200: the signature was Apple's and only the shape was not, so there
 * is nothing a retry could improve.
 */
export function parseAppleEvent(
  events: unknown,
): { type: string; subject: string; eventTimeMs: number | null } | null {
  if (typeof events !== "string") return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(events);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const e = parsed as Record<string, unknown>;
  if (typeof e.type !== "string" || e.type === "") return null;
  if (typeof e.sub !== "string" || e.sub === "") return null;

  const at = e.event_time;
  const usable = typeof at === "number" && Number.isFinite(at)
    && at >= MIN_PLAUSIBLE_EVENT_MS && at <= MAX_EPOCH_MS;
  return { type: e.type, subject: e.sub, eventTimeMs: usable ? at : null };
}

/**
 * Handle one delivery.
 *
 * The subject never reaches a log line. It is a stable per-app identifier for a person, and this
 * server's whole account model is built on it — a log aggregator is not where it belongs. What is
 * logged is the type and what happened, which is all anybody debugging this needs.
 */
export async function appleNotifications(
  req: Request,
  deps: EngineDeps,
  verifier: AppleNotificationVerifier,
): Promise<Response> {
  // Unconfigured means the surface does not exist. Before anything else is considered.
  if (deps.config.appleAudiences.length === 0) return json({ error: "not found" }, 404);
  if (req.method !== "POST") return json({ error: "not found" }, 404);

  // The declared length first, when there is one: it refuses before a byte is read and costs
  // nothing. It is a fast path and not the guarantee — see `readCapped`, which is.
  if (Number(req.headers.get("content-length")) > MAX_BODY_BYTES) {
    return json({ error: "too large" }, 413);
  }
  const raw = await readCapped(req, MAX_BODY_BYTES);
  if (raw === null) return json({ error: "too large" }, 413);

  let body: { payload?: unknown } | null = null;
  try {
    body = JSON.parse(raw) as { payload?: unknown };
  } catch {
    body = null;
  }
  const payload = typeof body?.payload === "string" ? body.payload : "";

  let events: unknown;
  try {
    events = await verifier.verifyAppleNotification(payload);
  } catch (e) {
    // The reason is logged and never returned: it can echo the token. 401 rather than 200 because
    // a message this server cannot attribute to Apple is one it should be sent again if it really
    // was Apple's and something here was momentarily wrong.
    console.warn(`[eait] apple: notification rejected (${e instanceof AuthError ? e.reason : "unreadable"})`);
    return json({ error: "unauthorized" }, 401);
  }

  const event = parseAppleEvent(events);
  if (event === null) {
    console.warn("[eait] apple: unreadable notification ignored");
    return json({ ok: true });
  }

  // `email-disabled` and `email-enabled` land here and do nothing. Since issue #95 an Apple
  // address IS stored, and these say whether the private relay in front of it still forwards — so
  // the signal is real and is deliberately not acted on yet. Nothing reads the address column at
  // all: the first outreach round is a person running a query, and a person reading a bounce
  // learns the same thing.
  // ponytail: dropped signal, and the ceiling is that a disabled relay is indistinguishable from a
  // typo or a full mailbox. Store a deliverability flag against the identity when outreach becomes
  // something a program does — Apple tells us for free and months earlier, so it is worth having
  // then, and it is a feature with no reader now.
  //
  // An unknown future type does nothing for the same reason it is acknowledged: this server acts
  // on what it understands and stops being told the rest.
  if (REVOCATIONS.has(event.type)) {
    const outcome = await revokeAppleIdentity(deps, event.subject, event.eventTimeMs);
    console.log(`[eait] apple: ${event.type} → ${outcome}`);
  }

  return json({ ok: true });
}
