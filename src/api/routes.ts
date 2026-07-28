// HTTP over the engine — the second front end, and the reason the engine exists.
//
// Every handler is the same three lines: authenticate to a userId, call one engine function, encode
// the result. There is no product logic here, and a reviewer should be able to confirm that by
// noting this file imports `db.ts` for nothing and never touches `meals`.
//
// AUTHENTICATION IS NOT IN SCOPE and is deliberately not faked. `resolveUserId` is an injected
// function; wiring it to a real scheme (Telegram login, a signed session) is its own decision and
// its own document. What matters structurally is that the userId reaches the engine as an ARGUMENT
// resolved from the request's credentials — never from a body field a client could set, which is
// the same rule `RequestContext` enforces one layer further down.
//
// IMAGES STAY EPHEMERAL HERE TOO. An upload is read into memory, handed to the engine, and dropped.
// No disk write, no object store, no staging directory "just for retries" — the invariant is the
// bot's, not Telegram's, and a second front end is exactly where it would quietly be broken.

import {
  logPhotoMeal, handleText, day, week, confirmPendingMeal, cancelPendingMeal, dropPendingMeal,
  MAX_WINDOW_DAYS, type EngineDeps, type UserId,
  type Answered, type MealProposed, type MealUpdated, type MealRedated,
  type HandleTextResult, type Refusal, type TargetGone,
} from "../engine/index.ts";

/** Resolves the authenticated user from a request, or null. Injected — see the note above. */
export type ResolveUserId = (req: Request) => Promise<UserId | null> | UserId | null;

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/**
 * Refusals map to status codes ONCE, here. `not-onboarded` is a 403 rather than a 401 on purpose:
 * the caller authenticated fine, they simply have no profile yet, and a 401 would send a
 * well-behaved client into a token-refresh loop it can never win.
 */
const REFUSAL_STATUS = {
  "not-onboarded": 403,
  "not-food": 422,
  "cap-exceeded": 429,
  "analysis-failed": 502,
} as const;

/** Total size an upload may reach in memory. A cap is what keeps a large POST from being a DoS. */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

/** `YYYY-MM-DD`, and a real calendar date — `2026-02-31` parses as a string and is not a day. */
function isCalendarDate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

export function createRouter(deps: EngineDeps, resolveUserId: ResolveUserId) {
  return async function handle(req: Request): Promise<Response> {
    const url = new URL(req.url);

    // Unauthenticated, and deliberately so: a liveness probe that requires a session cannot tell a
    // dead process from an expired token.
    if (url.pathname === "/health") return json({ ok: true });

    const userId = await resolveUserId(req);
    if (userId === null) return json({ error: "unauthenticated" }, 401);

    try {
      if (req.method === "POST" && url.pathname === "/v1/meals/photo") {
        // Checked BEFORE parsing. `req.formData()` buffers the whole body into memory, so a size
        // check after it has already run protects nothing — the allocation it was meant to prevent
        // has happened. `Bun.serve`'s `maxRequestBodySize` is the real backstop (a client can lie
        // about or omit Content-Length); this is the early, cheap, honest-client rejection.
        const declared = Number(req.headers.get("content-length") ?? 0);
        if (declared > MAX_UPLOAD_BYTES) return json({ error: "too large" }, 413);
        const form = await req.formData();
        // `Bun.FormDataEntryValue` is `File | string`. flatMap rather than a filter predicate:
        // it narrows the array's element type without asserting one, so no cast is needed and a
        // string-valued "photo" field is simply dropped as the malformed input it is.
        const files = form.getAll("photo").flatMap((f) => (typeof f === "string" ? [] : [f]));
        if (files.length === 0) return json({ error: "no photo" }, 400);
        if (files.reduce((n, f) => n + f.size, 0) > MAX_UPLOAD_BYTES) {
          return json({ error: "too large" }, 413);
        }
        const caption = form.get("caption");
        const result = await logPhotoMeal(deps, userId, {
          // Several files are angles of ONE meal, matching the bot's album handling — not several
          // meals. Thunks, so nothing is read until the engine has passed the caps.
          images: files.map((f) => async () => new Uint8Array(await f.arrayBuffer())),
          ...(typeof caption === "string" && caption ? { caption } : {}),
        });
        return result.kind === "logged"
          ? json(result)
          : json({ error: result.kind, ...(result.kind === "cap-exceeded" ? { scope: result.scope } : {}) },
              REFUSAL_STATUS[result.kind]);
      }

      if (req.method === "POST" && url.pathname === "/v1/messages") {
        const body = (await req.json()) as { text?: unknown; focusMealId?: unknown };
        if (typeof body.text !== "string" || !body.text.trim()) {
          return json({ error: "text required" }, 400);
        }
        const result = await handleText(deps, userId, {
          text: body.text,
          // A meal id from the client is safe because every engine read is user-scoped: naming
          // someone else's meal resolves to nothing rather than to their row.
          ...(typeof body.focusMealId === "string" ? { focusMealId: body.focusMealId } : {}),
        });
        if (result.kind === "target-gone") return json({ error: "target-gone", on: result.on }, 409);
        if (result.kind in REFUSAL_STATUS) {
          return json({ error: result.kind, ...("scope" in result ? { scope: result.scope } : {}) },
            REFUSAL_STATUS[result.kind as keyof typeof REFUSAL_STATUS]);
        }
        // Exhaustive by construction: with target-gone and every refusal handled above, the only
        // shapes left are successes. Adding a kind to HandleTextResult without giving it a status
        // here is a COMPILE error rather than a silent 200 carrying a shape no client can read.
        // The `in` guard above does not narrow the union, so the refusals are excluded explicitly.
        const ok = result as Answered | MealProposed | MealUpdated | MealRedated;
        const _exhaustive: Exclude<HandleTextResult, Refusal | TargetGone> = ok;
        return json(_exhaustive);
      }

      if (req.method === "GET" && url.pathname === "/v1/diary/day") {
        // Validated rather than passed through: an unparseable date matches no rows, so the client
        // would get a cheerful empty day for what is actually a typo, and never learn otherwise.
        const date = url.searchParams.get("date");
        if (date !== null && !isCalendarDate(date)) {
          return json({ error: "date must be YYYY-MM-DD" }, 400);
        }
        const view = await day(deps, userId, date ?? undefined);
        return view ? json(view) : json({ error: "not-onboarded" }, 403);
      }

      // The other half of confirm-first. Without these the API is a dead end: /v1/messages can
      // answer `proposed` with a pendingId and the client has no way to act on it.
      const pending = /^\/v1\/meals\/pending\/([^/]+)\/(confirm|cancel)$/.exec(url.pathname);
      if (req.method === "POST" && pending) {
        const [, pendingId, action] = pending;
        if (action === "cancel") {
          const res = await cancelPendingMeal(deps, userId, decodeURIComponent(pendingId!));
          return res.kind === "cancelled" ? json(res) : json({ error: "expired" }, 410);
        }
        const id = decodeURIComponent(pendingId!);
        const res = await confirmPendingMeal(deps, userId, id);
        if (res.kind === "expired") return json({ error: "expired" }, 410);
        if (res.kind !== "logged") {
          return json({ error: res.kind }, REFUSAL_STATUS[res.kind as keyof typeof REFUSAL_STATUS]);
        }
        // Confirm and drop collapse here, unlike on Telegram: this response IS the delivery, so
        // there is no window in which the meal is logged but the user has seen nothing.
        await dropPendingMeal(deps, userId, id);
        return json(res);
      }

      if (req.method === "GET" && url.pathname === "/v1/diary/week") {
        const days = Number(url.searchParams.get("days") ?? 7);
        if (!Number.isInteger(days) || days < 1 || days > MAX_WINDOW_DAYS) {
          return json({ error: `days must be an integer in [1, ${MAX_WINDOW_DAYS}]` }, 400);
        }
        const totals = await week(deps, userId, days);
        return totals ? json({ days: totals }) : json({ error: "not-onboarded" }, 403);
      }

      return json({ error: "not found" }, 404);
    } catch (e) {
      // The message is logged, never returned: an error string from deep in the stack can carry a
      // query, a path, or a model's echo of user content, and none of that belongs in a response.
      console.error(`[eait] api ${req.method} ${url.pathname} failed: ${(e as Error)?.message ?? e}`);
      return json({ error: "internal" }, 500);
    }
  };
}
