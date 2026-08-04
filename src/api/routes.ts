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
  applyPendingEdit, cancelPendingEdit, dropPendingEdit, resolveMealChoice,
  advanceOnboarding, openSettings, applySettingsAction, submitSettingsInput, setUserLanguage,
  deleteAccount,
  MAX_WINDOW_DAYS, type EngineDeps, type UserId,
  type HandleTextResult, type Refusal, type TargetGone, type SettingsResult,
} from "../engine/index.ts";
import { resolveLang, translatorFor } from "../i18n/index.ts";
import { isPendingInput } from "../settings.ts";
import type { OnboardingInput } from "../onboarding.ts";

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

/**
 * Compile-time exhaustiveness guard. Reached only if a `HandleTextResult` success kind has no case
 * above, and the argument's type is then no longer `never` — a build error, not a runtime surprise.
 * Throws anyway, because `tsc` is not in the request path at 3am.
 */
function assertNever(x: never): never {
  throw new Error(`api: unhandled engine result ${JSON.stringify(x)}`);
}

/**
 * A client-supplied onboarding input, validated into the engine's union or rejected.
 *
 * Narrow rather than cast: `step()` re-prompts on unrecognised callback data, so a wrong-SHAPED
 * input would not crash — it would silently look like a stale tap and the client would never learn
 * its request was malformed. `command` is checked against the one member it has for the same reason.
 */
function parseOnboardingInput(v: unknown): OnboardingInput | null {
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  if (o.type === "command" && o.command === "start") {
    // A payload is optional; anything non-string is dropped rather than stringified, and the
    // engine's grammar check is still the thing that decides whether it is stored.
    return typeof o.payload === "string"
      ? { type: "command", command: "start", payload: o.payload }
      : { type: "command", command: "start" };
  }
  if (o.type === "callback" && typeof o.data === "string") return { type: "callback", data: o.data };
  if (o.type === "text" && typeof o.text === "string") return { type: "text", text: o.text };
  return null;
}

/**
 * A settings/onboarding view as JSON.
 *
 * `text` and `buttons` are copy, rendered server-side in the user's own language — the deliberate
 * trade recorded in `engine/AGENTS.md`. A client renders `text` and turns each button into a
 * tappable control that POSTs its `data` back as `action`; the string is an app-level action id,
 * not a Telegram type.
 */
const viewJson = (r: SettingsResult): Response =>
  r.kind === "view"
    ? json({ text: r.view.text, buttons: r.view.buttons ?? [], awaitInput: r.view.awaitInput ?? null })
    : json({ error: r.kind }, r.kind === "not-onboarded" ? 403 : 409);

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
        // Exhaustiveness, done so it actually FIRES. The previous version cast `result` to a union
        // of four success kinds and assigned that to a variable typed `Exclude<HandleTextResult,
        // Refusal | TargetGone>` — narrow into wide, which TypeScript accepts, so adding a kind
        // could never error. It didn't: `edit-proposed` and `choose-meal` were added and this file
        // compiled clean while serving 200s no client could act on.
        //
        // A switch over `kind` with an `assertNever` default has no such escape: a new member of
        // the union reaches the default with a type that is no longer `never` (verified by removing
        // a case and watching tsc fail).
        const ok = result as Exclude<HandleTextResult, Refusal | TargetGone>;
        switch (ok.kind) {
          case "answered":
          case "proposed":
          case "updated":
          case "redated":
          case "edit-proposed":
          case "choose-meal":
            return json(ok);
          default:
            return assertNever(ok);
        }
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

      // The other half of chat-targeted editing, for the same reason the pending-meal routes exist:
      // `/v1/messages` can answer `edit-proposed` with a pendingId, and without these the client
      // holds an id it can do nothing with.
      const edit = /^\/v1\/edits\/pending\/([^/]+)\/(apply|cancel)$/.exec(url.pathname);
      if (req.method === "POST" && edit) {
        const [, rawId, action] = edit;
        const id = decodeURIComponent(rawId!);
        if (action === "cancel") {
          const res = await cancelPendingEdit(deps, userId, id);
          return res.kind === "cancelled" ? json(res) : json({ error: "expired" }, 410);
        }
        const res = await applyPendingEdit(deps, userId, id);
        if (res.kind === "expired") return json({ error: "expired" }, 410);
        if (res.kind === "target-gone") return json({ error: "target-gone", on: res.on }, 409);
        if (res.kind !== "updated" && res.kind !== "redated") {
          return json({ error: res.kind }, REFUSAL_STATUS[res.kind as keyof typeof REFUSAL_STATUS]);
        }
        // Same collapse as the pending-meal confirm: this response IS the delivery, so there is no
        // window in which the edit is applied and the caller has seen nothing.
        await dropPendingEdit(deps, userId, id);
        return json(res);
      }

      // Picking a candidate after `choose-meal`. It applies nothing on its own — it replays the
      // user's original message with the chosen meal in focus, exactly as the Telegram tap does, so
      // the second pass is an ordinary unambiguous edit. That costs a second router call and a cap
      // draw, which is why it is a POST rather than something a client might fire speculatively.
      const choice = /^\/v1\/edits\/pending\/([^/]+)\/choose\/(\d+)$/.exec(url.pathname);
      if (req.method === "POST" && choice) {
        const [, rawId, index] = choice;
        const id = decodeURIComponent(rawId!);
        const picked = await resolveMealChoice(deps, userId, id, Number(index));
        if (!picked) return json({ error: "expired" }, 410);
        await dropPendingEdit(deps, userId, id);
        const replay = await handleText(deps, userId, { text: picked.text, focusMealId: picked.mealId });
        if (replay.kind === "target-gone") return json({ error: "target-gone", on: replay.on }, 409);
        if (replay.kind in REFUSAL_STATUS) {
          return json({ error: replay.kind, ...("scope" in replay ? { scope: replay.scope } : {}) },
            REFUSAL_STATUS[replay.kind as keyof typeof REFUSAL_STATUS]);
        }
        return json(replay);
      }

      if (req.method === "GET" && url.pathname === "/v1/diary/week") {
        const days = Number(url.searchParams.get("days") ?? 7);
        if (!Number.isInteger(days) || days < 1 || days > MAX_WINDOW_DAYS) {
          return json({ error: `days must be an integer in [1, ${MAX_WINDOW_DAYS}]` }, 400);
        }
        const totals = await week(deps, userId, days);
        return totals ? json({ days: totals }) : json({ error: "not-onboarded" }, 403);
      }

      // Signup. Without this the API could log meals for a user it had no way to create, which made
      // "both front ends are peers" true only for the half of the product that comes after signup.
      if (req.method === "POST" && url.pathname === "/v1/onboarding") {
        const body = (await req.json()) as { input?: unknown; username?: unknown };
        const input = parseOnboardingInput(body.input);
        if (!input) return json({ error: "input required" }, 400);
        const r = await advanceOnboarding(
          deps, userId,
          {
            input,
            username: typeof body.username === "string" ? body.username : null,
            // The surface negotiates the locale, the engine stores it: `Accept-Language` is this
            // protocol's version of Telegram's `language_code`, and neither is the engine's business.
            langHint: resolveLang(req.headers.get("accept-language")),
          },
          translatorFor,
        );
        return json({
          state: r.nextState, text: r.reply, buttons: r.buttons ?? [],
        });
      }

      if (req.method === "GET" && url.pathname === "/v1/settings") {
        return viewJson(await openSettings(deps, userId, translatorFor));
      }

      if (req.method === "POST" && url.pathname === "/v1/settings") {
        const body = (await req.json()) as { action?: unknown; field?: unknown; text?: unknown };
        // Two shapes, because the settings machine has two kinds of step: tapping a control, and
        // answering the text prompt a control opened. `field` is required on the second so the
        // engine can check it against the prompt actually armed rather than trusting the client.
        if (typeof body.action === "string") {
          return viewJson(await applySettingsAction(deps, userId, body.action, translatorFor));
        }
        if (typeof body.text === "string" && isPendingInput(body.field)) {
          return viewJson(
            await submitSettingsInput(deps, userId, body.field, body.text, translatorFor),
          );
        }
        return json({ error: "action, or field + text, required" }, 400);
      }

      // Erasure. DELETE and nothing else: the method IS the safeguard, because a GET or a form
      // POST can be provoked cross-site by an <img> or a hidden form and this route is
      // unrecoverable. Idempotent, so a client retrying a timed-out request is not told that
      // completed work failed.
      if (req.method === "DELETE" && url.pathname === "/v1/account") {
        await deleteAccount(deps, userId);
        return json({ kind: "deleted" });
      }

      if (req.method === "POST" && url.pathname === "/v1/language") {
        const body = (await req.json()) as { lang?: unknown };
        const r = await setUserLanguage(deps, userId, typeof body.lang === "string" ? body.lang : "");
        return r.kind === "ok" ? json(r) : json({ error: r.kind }, 400);
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
