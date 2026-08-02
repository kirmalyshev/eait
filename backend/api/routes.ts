// HTTP over the engine.
//
// Every handler is the same three steps: authenticate to a userId, call ONE engine function, encode
// the result. There is no product logic here, and a reviewer should be able to confirm that by
// noting this file never imports the store and never touches a meal row directly.
//
// FOUR RULES THIS LAYER ENFORCES:
//  - `userId` NEVER comes from the request body. It is resolved from credentials and passed to the
//    engine as an argument. `focusMealId` and `mealId` may come from the request, and that is safe
//    only because every engine read is user-scoped — asserted by test, not assumed.
//  - Errors are logged, never returned. An error string from deep in the stack can carry a query, a
//    path, or a model's echo of the user's medical free text. The client gets `{"error":"internal"}`.
//  - Uploads stay in memory and are bounded. No disk write, no staging directory.
//  - Refusal→status mapping is imported from the shared contract, so the client's decoder and this
//    encoder cannot drift.

import {
  REFUSAL_STATUS, ROUTES,
  type AuthDeviceRequest, type AuthDeviceResponse, type AuthProviderRequest,
  type AuthProviderResponse, type EditMealRequest, type IdentitiesResponse, type Lang,
  type MessageRequest, type OnboardingContentResponse, type OnboardingEventsRequest,
  type OnboardingEventsResponse, type PatchProfileRequest, isRefusal,
} from "@ieat/shared";
import { LANGS } from "@ieat/shared";
import { AuthError, type IdentityVerifier } from "../auth/verify.ts";
import { isCalendarDate } from "../dates.ts";
import type { Store } from "../store.ts";
import {
  MAX_WINDOW_DAYS, cancelPendingMeal, confirmPendingMeal, day, editMeal, handleText, identitiesFor,
  logPhotoMeal, onboardingContent, patchProfile, profileView, recordOnboardingEvents,
  signInWithProvider, week, type EngineDeps,
} from "../engine/index.ts";
import { adminRoutes } from "./admin.ts";

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** A refusal, encoded once. `scope` rides along for `cap-exceeded` so the app can word it right. */
function refusal(r: { kind: string; scope?: string }): Response {
  const status = REFUSAL_STATUS[r.kind as keyof typeof REFUSAL_STATUS] ?? 500;
  return json({ error: r.kind, ...(r.scope ? { scope: r.scope } : {}) }, status);
}

/** Narrow a client-supplied locale to a supported language. Unknown falls back to `en`. */
function toLang(locale: string | undefined): Lang {
  const head = (locale ?? "en").slice(0, 2).toLowerCase();
  return (LANGS as readonly string[]).includes(head) ? (head as Lang) : "en";
}

export function createRouter(deps: EngineDeps, store: Store, verifier: IdentityVerifier) {
  const bearer = (req: Request): string | null => {
    const header = req.headers.get("authorization");
    return header?.startsWith("Bearer ") ? header.slice(7) : null;
  };

  /** The ONLY path from a request to a userId. */
  async function resolveUserId(req: Request): Promise<string | null> {
    const token = bearer(req);
    return token === null ? null : store.userIdForToken(token);
  }

  return async function handle(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const { pathname } = url;

    // Unauthenticated, deliberately: a liveness probe that requires a session cannot tell a dead
    // process from an expired token.
    if (pathname === ROUTES.health) return json({ ok: true });

    try {
      // The admin, on its OWN credential.
      //
      // Handled before `resolveUserId` and never reachable with a user's bearer token — the two
      // are separate authorities, and an admin surface that accepts an ordinary session token is
      // an admin surface every user has. Off entirely unless `ADMIN_TOKEN` is set.
      if (pathname === "/admin" || pathname.startsWith("/admin/")) {
        return await adminRoutes(req, url, deps);
      }

      // Also unauthenticated — this is where a token comes from.
      if (req.method === "POST" && pathname === ROUTES.authDevice) {
        const body = await req.json() as AuthDeviceRequest;
        // Length is a real check, not decoration: a short device id is guessable, and guessing one
        // is impersonating its owner.
        if (typeof body.deviceId !== "string" || body.deviceId.length < 32) {
          return json({ error: "deviceId must be at least 32 characters" }, 400);
        }
        const { userId, created } = await store.upsertDeviceUser(body.deviceId, toLang(body.locale));
        const token = await store.issueToken(userId);
        return json({ token, userId, created } satisfies AuthDeviceResponse);
      }

      // Sign in with Apple / Google.
      //
      // OPTIONALLY authenticated, and that is the whole feature: a bearer token here means "link
      // this identity to the account I am already using" rather than "create a new one", which is
      // what lets someone try the app anonymously and keep the meals they logged.
      if (req.method === "POST" && (pathname === ROUTES.authApple || pathname === ROUTES.authGoogle)) {
        const provider = pathname === ROUTES.authApple ? "apple" : "google";
        const body = await req.json() as AuthProviderRequest;
        if (typeof body.idToken !== "string" || !body.idToken) {
          return json({ error: "idToken required" }, 400);
        }
        const current = await resolveUserId(req);
        try {
          const result = await signInWithProvider(
            deps, verifier, provider, body.idToken,
            typeof body.nonce === "string" ? body.nonce : undefined,
            current,
          );
          return json(result satisfies AuthProviderResponse);
        } catch (e) {
          if (e instanceof AuthError) {
            // The reason is logged, never returned — it can quote the token.
            console.error(`[ieat] ${provider} sign-in rejected: ${e.reason}`);
            return json({ error: "sign-in-failed" }, 401);
          }
          throw e;
        }
      }

      const userId = await resolveUserId(req);
      if (userId === null) return json({ error: "unauthenticated" }, 401);

      // Sign OUT — drops this token only. Not account deletion; the data is untouched, and every
      // other device stays signed in.
      if (req.method === "POST" && pathname === ROUTES.authSignOut) {
        const token = bearer(req);
        if (token) await store.revokeToken(token);
        return json({ signedOut: true });
      }

      if (req.method === "GET" && pathname === ROUTES.identities) {
        return json({ identities: await identitiesFor(deps, userId) } satisfies IdentitiesResponse);
      }

      // ── Profile ───────────────────────────────────────────────────────────────────────────
      if (pathname === ROUTES.profile) {
        if (req.method === "GET") {
          const view = await profileView(deps, userId);
          return view ? json(view) : json({ error: "not-onboarded" }, 403);
        }
        if (req.method === "PATCH") {
          const body = await req.json() as PatchProfileRequest;
          const out = await patchProfile(deps, userId, body);
          if (out === null) return json({ error: "not-onboarded" }, 403);
          // 422, and the app re-asks the question. A rejected target weight is the anorexia guard;
          // it must not be expressible as a warning the user can dismiss.
          return out.ok ? json(out.view) : json(out.rejected, 422);
        }
      }

      // ── Onboarding ────────────────────────────────────────────────────────────────────────
      if (req.method === "GET" && pathname === ROUTES.onboarding) {
        return json({ content: await onboardingContent(deps) } satisfies OnboardingContentResponse);
      }

      // Funnel events. Authenticated, because they are stored against the caller's account and
      // erased with it — but deliberately forgiving about their contents: the engine drops what it
      // does not recognise rather than 400ing, since a rejected batch means an app that retries
      // forever and a funnel that is missing exactly the users on bad connections.
      if (req.method === "POST" && pathname === ROUTES.onboardingEvents) {
        const body = await req.json() as OnboardingEventsRequest;
        const accepted = await recordOnboardingEvents(deps, userId, body?.events);
        return json({ accepted } satisfies OnboardingEventsResponse);
      }

      // ── Photo ─────────────────────────────────────────────────────────────────────────────
      if (req.method === "POST" && pathname === ROUTES.photo) {
        // Checked BEFORE parsing. `req.formData()` buffers the whole body into memory, so a size
        // check after it has run protects nothing — the allocation it was meant to prevent has
        // already happened. `maxRequestBodySize` on the server is the real backstop (a client can
        // lie about Content-Length); this is the early, cheap, honest-client rejection.
        const declared = Number(req.headers.get("content-length") ?? 0);
        if (declared > deps.config.maxUploadBytes) return json({ error: "too large" }, 413);

        const form = await req.formData();
        // flatMap rather than a filter predicate: it narrows the element type without asserting
        // one, so a string-valued "photo" field is simply dropped as the malformed input it is.
        const files = form.getAll("photo").flatMap((f) => (typeof f === "string" ? [] : [f]));
        if (files.length === 0) return json({ error: "no photo" }, 400);
        if (files.length > deps.config.maxPhotosPerMeal) return json({ error: "too many photos" }, 400);
        if (files.reduce((n, f) => n + f.size, 0) > deps.config.maxUploadBytes) {
          return json({ error: "too large" }, 413);
        }
        const caption = form.get("caption");

        const result = await logPhotoMeal(deps, userId, {
          // Several files are ANGLES OF ONE MEAL, not several meals. Thunks, so nothing is read
          // until the engine has passed the caps.
          images: files.map((f) => async () => new Uint8Array(await f.arrayBuffer())),
          ...(typeof caption === "string" && caption ? { caption } : {}),
        });
        return isRefusal(result) ? refusal(result) : json(result);
      }

      // ── Chat ──────────────────────────────────────────────────────────────────────────────
      if (req.method === "POST" && pathname === ROUTES.messages) {
        const body = await req.json() as MessageRequest;
        if (typeof body.text !== "string" || !body.text.trim()) {
          return json({ error: "text required" }, 400);
        }
        const result = await handleText(deps, userId, {
          text: body.text,
          ...(typeof body.focusMealId === "string" ? { focusMealId: body.focusMealId } : {}),
        });
        if (result.kind === "target-gone") return json({ error: "target-gone", on: result.on }, 409);
        return isRefusal(result) ? refusal(result) : json(result);
      }

      // ── Manual edit ───────────────────────────────────────────────────────────────────────
      const mealMatch = /^\/v1\/meals\/([^/]+)$/.exec(pathname);
      if (req.method === "PATCH" && mealMatch) {
        const body = await req.json() as EditMealRequest;
        const result = await editMeal(deps, userId, decodeURIComponent(mealMatch[1]!), body);
        return result.kind === "target-gone"
          ? json({ error: "target-gone", on: result.on }, 409)
          : json(result);
      }

      // ── Pending text meals ────────────────────────────────────────────────────────────────
      const pending = /^\/v1\/meals\/pending\/([^/]+)\/(confirm|cancel)$/.exec(pathname);
      if (req.method === "POST" && pending) {
        const id = decodeURIComponent(pending[1]!);
        if (pending[2] === "cancel") {
          const res = await cancelPendingMeal(deps, userId, id);
          return res.kind === "cancelled" ? json(res) : json({ error: "expired" }, 410);
        }
        const res = await confirmPendingMeal(deps, userId, id);
        if (res.kind === "expired") return json({ error: "expired" }, 410);
        return isRefusal(res) ? refusal(res) : json(res);
      }

      // ── Diary ─────────────────────────────────────────────────────────────────────────────
      if (req.method === "GET" && pathname === ROUTES.day) {
        // Validated rather than passed through: an unparseable date matches no rows, so the client
        // would get a cheerful empty day for what is actually a typo, and never learn otherwise.
        const date = url.searchParams.get("date");
        if (date !== null && !isCalendarDate(date)) {
          return json({ error: "date must be YYYY-MM-DD" }, 400);
        }
        const view = await day(deps, userId, date ?? undefined);
        return view ? json(view) : json({ error: "not-onboarded" }, 403);
      }

      if (req.method === "GET" && pathname === ROUTES.week) {
        const days = Number(url.searchParams.get("days") ?? 7);
        if (!Number.isInteger(days) || days < 1 || days > MAX_WINDOW_DAYS) {
          return json({ error: `days must be an integer in [1, ${MAX_WINDOW_DAYS}]` }, 400);
        }
        const totals = await week(deps, userId, days);
        return totals ? json({ days: totals }) : json({ error: "not-onboarded" }, 403);
      }

      // ── Erasure ───────────────────────────────────────────────────────────────────────────
      if (req.method === "DELETE" && pathname === ROUTES.account) {
        // Real deletion, not a flag. Health-related restrictions are special-category data and the
        // basis for holding them is consent, which has to be withdrawable in fact and not in prose.
        await store.deleteUser(userId);
        return json({ deleted: true });
      }

      return json({ error: "not found" }, 404);
    } catch (e) {
      console.error(`[ieat] api ${req.method} ${pathname} failed: ${(e as Error)?.message ?? e}`);
      return json({ error: "internal" }, 500);
    }
  };
}
