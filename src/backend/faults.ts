// The `--demo` fault-injection hook (ieat-app#1178).
//
// WHY IT EXISTS. The error-state boards cannot be drawn against a healthy server: `states-*`
// needs a 5xx or a malformed body MID-SESSION — stopping the backend only produces the offline
// state, which the sweep could already reach — `chat-busy` is a window too short to catch by
// hand, and `chat-expired` is a proposal that has to arrive already dead. So the demo server
// arms a fault and lets the next request spend it.
//
// WIRED ONLY UNDER `--demo`, in `index.ts`, beside `/demo/authorize` and `/demo/user-id` — the
// same gating the canned verifier (the server half of AUTH_FAKE) has: a production process does
// not route `/demo/*` at all, and `loadConfig` is never asked about any of this, so there is no
// variable for a release check to refuse. The route not existing is the whole of the guard.
//
// WHAT CAN BE ARMED, over `POST /demo/fault`:
//
//   { "kind": "answer",  "status": 503, "body": {} }                    — a 5xx. With a body
//     carrying `error` the turn is a designed refusal ("unsupported-image" → states-format,
//     "analysis-failed" → states-failed, "internal" → states-unknown); without one it is the
//     edge answering a restart — "offline" to the outbox on either client.
//   { "kind": "answer",  "status": 200, "body": { …wrong shape… } }    — a well-formed answer
//     the contract never wrote; or "text" instead of "body" for a raw, non-JSON one.
//   { "kind": "malformed" }                                             — a 200 whose JSON is
//     truncated. The stream's "ended with no answer" / a GET that cannot be read.
//   { "kind": "slow",    "ms": 30000 }                                  — the request hangs for
//     `ms` and then gets the REAL answer. `chat-busy` is a 150 ms window on a healthy server;
//     this holds it open for the shot, and is the window a runner kills the backend inside.
//   { "kind": "expired" }                                               — the request's
//     proposals are written with a TTL of zero, so the card comes back already timed out
//     (`chat-expired`). The server's own `pendingTtlMs` is restored when the request ends.
//
//   "path" filters by contract path prefix ("/v1/messages" matches both "/v1/messages" and the
//   web client's "/api/v1/messages"); absent, the fault takes the next request whatever it was.
//   "method" filters the same way — a POST fault is not spent by the thread's own GET. "/demo/*"
//   is the control channel and can never be spent. "once": false keeps the fault armed until
//   `DELETE /demo/fault`, for a window of several failed requests rather than one.
//
//   GET /demo/fault answers the armed list; DELETE /demo/fault clears it.
//
// WHAT IT DOES NOT DO, AND WHERE THOSE BOARDS COME FROM.
//   `health-unavailable` / `health-notice`: Apple Health's availability and write access are DEVICE
//   answers — `healthSource()` resolves a HealthKit, canned or absent port without asking this
//   process. The app's canned source takes them: build with
//   `EXPO_PUBLIC_EAIT__FRONTEND__HEALTH_FAKE=unavailable` or `=denied` (mobile `lib/health/index.ts`;
//   `preflight-release.ts` refuses any value). Refusing `/v1/health/*` here IS this server's half.
//   `pay-reminder`: a trial is a stored entitlement, so post the RevenueCat delivery
//   `src/mobile/e2e/paywall-webhook.js` posts, with `period_type: "TRIAL"` and
//   `expiration_at_ms` two days out, to `/v1/revenuecat/webhook` — Home then draws the trial card.

type DemoFaultBase = { path: string; method: string | null; once: boolean };

/** An armed fault. `path` is a contract-path prefix; the empty string matches every request. */
export type DemoFault = DemoFaultBase & (
  | { kind: "answer"; status: number; body: unknown; text?: string }
  | { kind: "malformed" }
  | { kind: "slow"; ms: number }
  | { kind: "expired" }
);

const KINDS = ["answer", "malformed", "slow", "expired"] as const;

let armed: DemoFault[] = [];

export const demoFaults = (): readonly DemoFault[] => armed;
export const clearDemoFaults = (): void => { armed = []; };

/**
 * The arm request's body → a fault, or the reason it was refused — a string, because the caller
 * is a shell script and its author reads the 400.
 */
export function parseDemoFault(input: unknown): DemoFault | string {
  if (input === null || typeof input !== "object") return "a JSON object was expected";
  const o = input as Record<string, unknown>;
  if (typeof o.kind !== "string" || !(KINDS as readonly string[]).includes(o.kind)) {
    return `kind must be one of ${KINDS.join(", ")}`;
  }
  if (o.path !== undefined && typeof o.path !== "string") return "path must be a string";
  if (o.method !== undefined && typeof o.method !== "string") return "method must be a string";
  if (o.once !== undefined && typeof o.once !== "boolean") return "once must be a boolean";
  const base: DemoFaultBase = {
    path: (o.path as string | undefined) ?? "",
    method: typeof o.method === "string" ? o.method.toUpperCase() : null,
    once: o.once !== false,
  };
  switch (o.kind) {
    case "answer": {
      const status = o.status === undefined ? 500 : o.status;
      if (typeof status !== "number" || !Number.isInteger(status) || status < 100 || status > 599) {
        return "status must be an integer 100–599";
      }
      if (o.text !== undefined && typeof o.text !== "string") return "text must be a string";
      return {
        ...base, kind: "answer", status,
        body: o.body ?? { error: "internal" },
        ...(typeof o.text === "string" ? { text: o.text } : {}),
      };
    }
    case "malformed":
      return { ...base, kind: "malformed" };
    case "slow": {
      const ms = o.ms === undefined ? 30_000 : o.ms;
      if (typeof ms !== "number" || !Number.isInteger(ms) || ms <= 0) return "ms must be a positive integer";
      return { ...base, kind: "slow", ms };
    }
    case "expired":
      return { ...base, kind: "expired" };
    default:
      return `kind must be one of ${KINDS.join(", ")}`;
  }
}

export function armDemoFault(fault: DemoFault): void {
  armed.push(fault);
}

/**
 * The first armed fault matching `pathname`, consumed when `once`. The `/api` rename is undone
 * the way `api/routes.ts` undoes it, so a `path` is always a CONTRACT path whichever spelling the
 * client used — and `/demo/*` never matches, because the control channel must always answer.
 */
export function takeDemoFault(pathname: string, method: string): DemoFault | null {
  const contract = pathname.startsWith("/api/") ? pathname.slice("/api".length) : pathname;
  if (contract.startsWith("/demo/")) return null;
  const i = armed.findIndex((f) =>
    contract.startsWith(f.path) && (f.method === null || f.method === method));
  if (i < 0) return null;
  const [fault] = armed.splice(i, 1);
  if (!fault!.once) armed.splice(i, 0, fault!);
  return fault!;
}

/** The canned answer for `answer` and `malformed`; `slow` and `expired` are the caller's to apply. */
export function demoFaultResponse(fault: DemoFault): Response {
  if (fault.kind === "malformed") {
    // Unterminated JSON: a client that parses it fails, which is the "bad body" the boards need.
    return new Response('{"error":', {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
  if (fault.kind !== "answer") throw new Error(`demoFaultResponse: ${fault.kind} has no canned answer`);
  return typeof fault.text === "string"
    ? new Response(fault.text, { status: fault.status, headers: { "content-type": "text/plain; charset=utf-8" } })
    : Response.json(fault.body, { status: fault.status });
}
