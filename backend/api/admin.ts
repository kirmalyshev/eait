// The backend admin: edit onboarding copy, read the funnel.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// FOUR RULES, ALL OF THEM SECURITY
//
//  1. OFF BY DEFAULT. No `EAIT__BACKEND__ADMIN_TOKEN` in the environment and every path here answers 404 — not
//     403, because "there is an admin and you cannot have it" is information. A deployment that
//     never sets the variable has no admin surface at all.
//  2. ITS OWN CREDENTIAL. A user's bearer token is worthless here. `routes.ts` reaches this before
//     it resolves a user, precisely so the two authorities cannot be confused.
//  3. CONSTANT-TIME COMPARISON. A `===` on a secret leaks its prefix to anyone patient enough to
//     time the answers.
//  4. VALIDATED ON THE WRITE. `saveOnboardingContent` refuses copy the app cannot render. Broken
//     content that reached a phone is a broken onboarding for that user until the next fetch, and
//     no amount of client tolerance recovers the screen they were on.
//
// The page itself is served without a token — it holds no data, it only asks for one. Serving it
// behind auth would mean an admin needs a token to see the box that asks for the token.
// ─────────────────────────────────────────────────────────────────────────────────────────────

import {
  MASCOT_MOODS, ONBOARDING_SCREENS, SCREEN_OPTIONS, screenIsOptional,
} from "@ieat/shared";
import {
  onboardingContent, onboardingFunnel, resetOnboardingContent, saveOnboardingContent,
  type EngineDeps,
} from "../engine/index.ts";
import { ADMIN_PAGE } from "./admin.page.ts";
import { timingSafeEqual } from "../auth/timingsafe.ts";

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const notFound = () => json({ error: "not found" }, 404);

/** What the editor needs in order to render the right controls for each screen. */
function editorMeta() {
  return {
    moods: MASCOT_MOODS,
    screens: ONBOARDING_SCREENS.map((id) => ({
      id,
      optional: screenIsOptional(id),
      options: SCREEN_OPTIONS[id] ?? [],
    })),
  };
}

export async function adminRoutes(req: Request, url: URL, deps: EngineDeps): Promise<Response> {
  const configured = deps.config.adminToken !== "";
  if (!configured) return notFound();

  const { pathname } = url;

  // The page. No data on it, so no token needed to fetch it.
  if (req.method === "GET" && (pathname === "/admin" || pathname === "/admin/")) {
    return new Response(ADMIN_PAGE, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        // The page is inline-only and talks to its own origin. Saying so means a future edit that
        // reaches for a CDN fails loudly here rather than quietly shipping a third party an admin
        // token typed into this form.
        "content-security-policy":
          "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'",
        "referrer-policy": "no-referrer",
        "x-frame-options": "DENY",
      },
    });
  }

  const presented = req.headers.get("x-admin-token") ?? "";
  if (!timingSafeEqual(presented, deps.config.adminToken)) {
    // 401 with no hint about what was wrong. The route exists — the page above proves that much —
    // so hiding it here would only confuse the person who is allowed in.
    return json({ error: "unauthorized" }, 401);
  }

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

  if (req.method === "GET" && pathname === "/admin/api/funnel") {
    const raw = Number(url.searchParams.get("days") ?? 30);
    // Clamped rather than rejected. This is a dashboard control, and a silly number in a query
    // string should show a sensible window, not an error page.
    const days = Number.isFinite(raw) ? Math.min(365, Math.max(1, Math.round(raw))) : 30;
    return json(await onboardingFunnel(deps, days));
  }

  return notFound();
}
