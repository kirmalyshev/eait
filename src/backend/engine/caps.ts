// Spend caps. The only thing standing between a public app and an unbounded model bill.
//
// The per-user caps are fairness/abuse limits. What bounds the whole instance's spend is the
// per-address limiting in `api/ratelimit.ts` — which is what makes it safe to run without an
// allowlist, because the funnel this app sits at the end of requires strangers to be able to
// use it without gatekeeping.

import type { Refusal } from "@eait/shared";
import type { EngineDeps } from "./deps.ts";
import { GatewayRefusal, type OnCall, type OnCost } from "../llm/port.ts";
import { dailyPhotoCap, entitlementFor, freeAnalysesFor } from "./entitlement.ts";
import { isAnonymous } from "./identity.ts";

export type CapScope = "photo" | "text";

/**
 * THE paywall rule, once: an account with no live entitlement has the sample and nothing else.
 * `"entitled"` means the paid tier's own limits apply; null is a free account with sample left;
 * a refusal is a free account whose sample is spent. Read per request, never cached.
 */
async function paywall(deps: EngineDeps, userId: string): Promise<Refusal | null | "entitled"> {
  if ((await entitlementFor(deps, userId)).active) return "entitled";
  const spent = await deps.store.countUserAnalyses(userId);
  return spent >= (await freeAnalysesFor(deps, userId)) ? { kind: "subscription-required" } : null;
}

/**
 * The gate for a log that costs no model call (a catalog food): behind the paywall like a photo,
 * but it never spends the sample. Same identity rule and the same refusal as `checkCaps`.
 */
export async function checkFreeLog(deps: EngineDeps, userId: string): Promise<Refusal | null> {
  if (await isAnonymous(deps, userId)) return { kind: "identity-required" };
  const gate = await paywall(deps, userId);
  return gate === "entitled" ? null : gate;
}

/**
 * Null when the request may proceed, a refusal when it may not.
 *
 * Without an entitlement the account has the SAMPLE and nothing else: `freeAnalysesFor`
 * analyses over its lifetime, photo or text alike — a sentence must not be the free way
 * around the ask. With one, photos meet the paid daily cap and text turns meet no per-user cap
 * at all: charging a question against the photo allowance would mean asking "how much protein
 * have I had" costs the user a meal they could have logged, which quietly teaches people not to
 * use the chat.
 */
export async function checkCaps(
  deps: EngineDeps,
  userId: string,
  date: string,
  scope: CapScope,
): Promise<Refusal | null> {
  const { store, config } = deps;

  // No identity, no analysis (S8): sign-up comes before the first meal, so an account carrying no
  // Apple or Google identity is refused here — ahead of every cap and therefore ahead of the
  // charge, which is what keeps the free sample unspent anonymously. `charge` writes
  // `recordAnalysis` below this, so a refusal returned now has spent nothing.
  if (await isAnonymous(deps, userId)) return { kind: "identity-required" };

  // Read from the store on every request rather than carried in the session, and that is the
  // point: a subscription that lapsed an hour ago must stop working an hour ago. An entitlement
  // cached for the life of a bearer token would be cached for up to 180 days.
  const gate = await paywall(deps, userId);
  if (gate !== "entitled") return gate;

  // The paid tier is a BIGGER per-user cap — a subscription buys a larger daily photo allowance.
  if (scope === "photo") {
    const cap = dailyPhotoCap(config);
    if (cap > 0) {
      // Photos only — `countUserPhotos` excludes text turns, which is the half of this rule that a
      // shared counter silently broke until a test caught it.
      const mine = await store.countUserPhotos(userId, date);
      if (mine >= cap) return { kind: "cap-exceeded", scope: "user" };
    }
  }

  return null;
}

/**
 * The `kind` an `llm_calls` row carries, off the transport's own name for the call (#602). A
 * `meal_analysis` is not in the map: its kind is the CALLER's word — `photo` or `reread` —
 * which `charge` is told below.
 */
const LLM_CALL_KIND: Record<string, string> = {
  route: "route",
  "text-meal": "text_meal",
  "text-correction": "correction",
  coach: "coach",
};

/**
 * Charge one analysis, BEFORE the model is asked, and return its id — the line that opens the turn
 * names it (#525) — and where its calls report their cost.
 *
 * The cost arrives after the charge and is ADDED to it, because one charge pays for several calls
 * — a schema retry, the router's second call, the coach's rounds — each reporting whenever it
 * lands. A write that fails is a log line: the turn is paid for either way (#484).
 *
 * `onCall` is the same shape one level down (#602): ONE llm_calls ROW PER PROVIDER CALL, metrics
 * only, fired and forgotten like the cost — a row that cannot land is a log line, never a failed
 * turn. `photoKind` is what a `meal_analysis` call is FOR at this callsite — the photo turn
 * or a meal's re-read.
 */
export async function charge(
  deps: EngineDeps, userId: string, date: string, scope: CapScope,
  photoKind: "photo" | "reread" = "photo",
): Promise<{ analysisId: string; onCost: OnCost; onCall: OnCall }> {
  const id = await deps.store.recordAnalysis(userId, date, scope);
  return { analysisId: id, onCost: (usd) => {
    void deps.store.addCost(userId, id, usd).then(
      // Refunded or merged away while a call was still out — a schema retry beside a refund, or a merge.
      (landed) => { if (!landed) console.error(`[eait] cost not recorded: analysis ${id} is gone (${usd ?? "unpriced"})`); },
      (e: unknown) => { console.error(`[eait] cost not recorded: ${(e as Error)?.message ?? e}`); },
    );
  }, onCall: (m) => {
    const { call, ...metric } = m;
    void deps.store.recordLlmCall(userId, {
      ...metric, analysisId: id,
      kind: call === "meal_analysis" ? photoKind : (LLM_CALL_KIND[call] ?? call),
    }).then(
      (landed) => { if (!landed) console.error(`[eait] call metric not recorded: analysis ${id} is gone (${call})`); },
      (e: unknown) => { console.error(`[eait] call metric not recorded: ${(e as Error)?.message ?? e}`); },
    );
  } };
}

/**
 * Take a turn that delivered nothing out of the SAMPLE, and leave its charge standing.
 *
 * THE SAMPLE COUNTS VALUE DELIVERED, NOT ATTEMPTS — the principal's decision (#44). A timeout, a
 * provider error, an answer that failed validation or a photo that was not food may all have been
 * billed, so the analysis row stays: its cost and the paid daily cap still see
 * it. What changes is only whether it spent the person's free meal, and a turn that put no verdict
 * in front of them did not. The pre-call charge still counts while the turn runs, so two requests
 * racing for one free meal cannot both pass `checkCaps`.
 *
 * Never throws, for `refundGatewayRefusal`'s reason; a release that cannot be written leaves the
 * sample spent, the safe direction when the store is the thing that is broken.
 */
export async function releaseSample(deps: EngineDeps, userId: string, analysisId: string): Promise<void> {
  await deps.store.releaseSample(userId, analysisId).catch((x: unknown) => {
    console.error(`[eait] sample release failed: ${(x as Error)?.message ?? x}`);
  });
}

/**
 * The other half of charging before the call: give the analysis back when the gateway refused
 * before generating anything, and only then.
 *
 * Lives beside `checkCaps` because it is the same rule read backwards, and because both charge
 * sites must answer it identically — a typed first meal that burns a sample a photo would have kept
 * is the bug this exists to prevent. Anything that is not a `GatewayRefusal` may have cost real
 * money and stays charged.
 *
 * Never throws. The caller is already inside a catch, handling a failure it is about to word for
 * the user; a store that cannot delete must not turn that handled failure into a 500 — and must not
 * swallow the log line the caller writes after it.
 */
export async function refundGatewayRefusal(
  deps: EngineDeps,
  userId: string,
  analysisId: string,
  e: unknown,
): Promise<boolean> {
  if (!(e instanceof GatewayRefusal)) return false;
  return await deps.store.undoAnalysis(userId, analysisId).catch((x: unknown) => {
    console.error(`[eait] refund failed: ${(x as Error)?.message ?? x}`);
    return false;
  });
}
