// The backend admin: edit onboarding copy, read the funnel.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// FOUR RULES, ALL OF THEM SECURITY
//
// Rewritten in #391b, when the admin stopped being a shared secret typed into a box and became a
// ROLE AN ACCOUNT CARRIES. Three of the four changed meaning and one was retired outright; the
// replacements are not weaker, and saying which is which is the point of writing them down.
//
//  1. OFF UNLESS SOMEBODY HOLDS THE ROLE. `store.hasAdmin()` is false and every path here answers
//     404 — not 403, because "there is an admin and you cannot have it" is information. This is
//     stronger than the variable it replaces: deleting the last admin account switches the surface
//     off, which no environment variable could do.
//  2. THE ROLE IS GRANTED OUT OF BAND, AND ONLY OUT OF BAND. Nothing reachable over HTTP writes
//     `users.role`. It is set at boot from `EAIT__BACKEND__ADMIN_BOOTSTRAP_USER_ID` — a user id,
//     never a provider subject, because `identities` is keyed (provider, subject) and a device
//     identity's subject is any string a client chose. It is not on `Profile`, so `patchProfile`
//     cannot reach it in either store implementation; it is not in the column list `mergeUsers`
//     copies, so an anonymous session cannot carry a grant into somebody else's account.
//  3. THE CHECK IS `=== "admin"`, NEVER `!== "user"`. The negative form reads a missing role as an
//     admin, and a missing role is what a new field, a new store or a bad migration produces.
//     (This replaces the constant-time comparison, which had nothing left to compare: a bearer is
//     looked up by SHA-256 in `auth/tokens.ts`, and that lookup is the timing-safe one now.)
//  4. VALIDATED ON THE WRITE. Unchanged. `saveOnboardingContent` refuses copy the app cannot
//     render. Broken content that reached a phone is a broken onboarding for that user until the
//     next fetch, and no amount of client tolerance recovers the screen they were on.
//
// WHAT THIS COST, STATED RATHER THAN DISCOVERED LATER: the admin used to be independent of user
// authentication entirely. It is now exactly as strong as Apple/Google verification plus the token
// store plus the merge logic — and `EAIT__BACKEND__APPLE_AUDIENCES` accepts the preview and dev
// bundle ids, so a development build signed in as the admin's Apple ID is the admin. That is the
// same person today. It stops being acceptable on the day real users' data is on this host, which
// is the day the audience list is meant to be revisited anyway.
//
// An ANONYMOUS request gets 401 and an ordinary SIGNED-IN one gets 404. The page below is public
// and already proves the route exists, so confusing the person who is allowed in buys nothing —
// but an identified ordinary user learning "there is an admin here and you are not it" is the one
// piece of information worth withholding.
//
// The page itself is served without a credential — it holds no data, it only offers a way in.
// ─────────────────────────────────────────────────────────────────────────────────────────────

import {
  NOTIFICATION_IDS, NOTIFICATION_PLACEHOLDERS, ONBOARDING_SCREENS, SCREEN_FIELDS, SCREEN_OPTIONS,
  screenIsOptional,
} from "@eait/shared";
import {
  adminUsers, notificationCopy, onboardingContent, onboardingFunnel, resetNotificationCopy,
  resetOnboardingContent, saveNotificationCopy, saveOnboardingContent, setUserCap, userCap,
  type EngineDeps,
} from "../engine/index.ts";
import { adminPage } from "./admin.page.ts";

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const notFound = () => json({ error: "not found" }, 404);

/**
 * What the editor needs in order to render the right controls for each group.
 *
 * `fields` is the list the editor draws an ask box for, and it comes from `SCREEN_FIELDS` rather
 * than from whatever the stored copy happens to carry — so a question added in code shows up in the
 * admin as an empty box to fill rather than as a save that is refused for a reason nobody can see.
 */
function editorMeta() {
  return {
    screens: ONBOARDING_SCREENS.map((id) => ({
      id,
      optional: screenIsOptional(id),
      fields: SCREEN_FIELDS[id],
      options: SCREEN_OPTIONS[id] ?? [],
    })),
  };
}

/**
 * @param userId The account behind the request's bearer, or null if there is no valid one.
 *   Resolved by `routes.ts` — this module never reads a credential itself, and there is no second
 *   path from a request to an identity in this process.
 */
export async function adminRoutes(
  req: Request,
  url: URL,
  deps: EngineDeps,
  userId: string | null,
): Promise<Response> {
  // Rule 1. Nobody holds the role, so there is no such feature here.
  if (!await deps.store.hasAdmin()) return notFound();

  const { pathname } = url;

  // The page. No data on it, so no credential needed to fetch it.
  if (req.method === "GET" && (pathname === "/admin" || pathname === "/admin/")) {
    const nonce = crypto.randomUUID();
    return new Response(adminPage(nonce), {
      headers: {
        "content-type": "text/html; charset=utf-8",
        // The page is inline-only and talks to its own origin. Saying so means a future edit that
        // reaches for a CDN fails loudly here rather than quietly shipping a third party an admin
        // token typed into this form.
        // A NONCE, NOT 'unsafe-inline' (#391b). This page holds a bearer for a real account now,
        // on an origin that also serves the web application and the API, so an injected script here
        // is worth every credential at once. The policy names the same nonce the page's one script
        // and one style carry, and nothing else can run.
        "content-security-policy":
          `default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'; `
          // `img-src data:` for the empty favicon in the head and nothing else — without it
          // `default-src 'none'` refuses even that, which is one console error per page load.
          + "connect-src 'self'; img-src data:; base-uri 'none'; form-action 'none'; "
          + "frame-ancestors 'none'",
        "referrer-policy": "no-referrer",
        "x-frame-options": "DENY",
      },
    });
  }

  // ── Rules 2 and 3 ─────────────────────────────────────────────────────────────────────────
  //
  // No credential at all: 401, with no hint about what was wrong. The route exists — the page above
  // proves that much — so hiding it here would only confuse the person who is allowed in.
  if (userId === null) return json({ error: "unauthorized" }, 401);

  // A credential that names an ordinary account: 404, the same answer an instance with no admin
  // gives. This person is IDENTIFIED, and "there is an admin here and you are not it" is the one
  // thing worth withholding from them.
  //
  // `=== "admin"` and never `!== "user"`: the negative form reads a missing role as an admin, and a
  // missing role is what a new field, a new store or a bad migration produces.
  if (await deps.store.roleOf(userId) !== "admin") return notFound();

  if (req.method === "GET" && pathname === "/admin/api/content") {
    return json({ content: await onboardingContent(deps), meta: editorMeta() });
  }

  if (req.method === "PUT" && pathname === "/admin/api/content") {
    const body = await req.json() as { content?: unknown };
    const result = await saveOnboardingContent(deps, body?.content);
    // 422 and the whole list, not the first failure: an editor that reports one problem per save
    // is an editor that takes six saves to fix six typos.
    return result.ok ? json({ content: result.content }) : json({ errors: result.errors }, 422);
  }

  if (req.method === "POST" && pathname === "/admin/api/content/reset") {
    return json({ content: await resetOnboardingContent(deps) });
  }

  // ── Notification copy ──────────────────────────────────────────────────────────────────────
  //
  // The same three verbs as the onboarding copy above, on the same credential, and validated the
  // same way: on the WRITE. A template with a placeholder nothing fills renders a literal {plan} on
  // somebody's lock screen, and by then the message has already been delivered.
  if (req.method === "GET" && pathname === "/admin/api/notifications") {
    return json({
      copy: await notificationCopy(deps),
      meta: { ids: NOTIFICATION_IDS, placeholders: NOTIFICATION_PLACEHOLDERS },
    });
  }

  if (req.method === "PUT" && pathname === "/admin/api/notifications") {
    const body = await req.json() as { copy?: unknown };
    const result = await saveNotificationCopy(deps, body?.copy);
    return result.ok ? json({ copy: result.content }) : json({ errors: result.errors }, 422);
  }

  if (req.method === "POST" && pathname === "/admin/api/notifications/reset") {
    return json({ copy: await resetNotificationCopy(deps) });
  }

  if (req.method === "GET" && pathname === "/admin/api/funnel") {
    const raw = Number(url.searchParams.get("days") ?? 30);
    // Clamped rather than rejected. This is a dashboard control, and a silly number in a query
    // string should show a sensible window, not an error page.
    const days = Number.isFinite(raw) ? Math.min(365, Math.max(1, Math.round(raw))) : 30;
    return json(await onboardingFunnel(deps, days));
  }

  // ── The accounts ───────────────────────────────────────────────────────────────────────────
  //
  // #374, and it is THE WIDEST READ IN THE PRODUCT: every account, with the address on it. What
  // stands between it and any signed-in phone is the role checked above, and nothing else — which
  // is why the store method it calls is named for what it does rather than being a relaxed `WHERE`
  // on something the app already calls.
  //
  // READ-ONLY. A list is a read; deleting an account or granting an entitlement is a separate
  // decision with a separate blast radius, and neither has been made. There is no method here but
  // GET, so the four others fall through to the 404 at the bottom of this function.
  if (req.method === "GET" && pathname === "/admin/api/users") {
    const raw = Number(url.searchParams.get("limit") ?? 50);
    // Clamped rather than rejected, the same way the funnel's `days` is: this is a dashboard
    // control, and a silly number in a query string should show a sensible page.
    const limit = Number.isFinite(raw) ? Math.min(200, Math.max(1, Math.round(raw))) : 50;
    const q = url.searchParams.get("q") ?? "";
    const cursor = url.searchParams.get("cursor") ?? "";
    return json(await adminUsers(deps, {
      limit,
      ...(q === "" ? {} : { q }),
      ...(cursor === "" ? {} : { cursor }),
    }));
  }

  // ── Per-account sample ─────────────────────────────────────────────────────────────────────
  //
  // One account's own sample size over the instance default; null in the body puts it back. The
  // id must look like one before it reaches Postgres, or a typo is a cast error and a 500.
  const cap = pathname.match(/^\/admin\/api\/users\/([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})\/cap$/);
  if (cap) {
    const userId = cap[1]!;
    if (req.method === "GET") {
      const view = await userCap(deps, userId);
      return view ? json(view) : notFound();
    }
    if (req.method === "PUT") {
      const body = await req.json().catch(() => null) as { freeAnalyses?: unknown } | null;
      const n = body?.freeAnalyses;
      // Bounded by the column: `free_analyses integer`, and a number past it is a cast error.
      if (n !== null && !(Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 2_147_483_647)) {
        return json({ errors: ["freeAnalyses must be a whole number of analyses, or null for the instance default"] }, 422);
      }
      const view = await setUserCap(deps, userId, n as number | null);
      return view ? json(view) : notFound();
    }
  }

  return notFound();
}
