// `/r/<code>` — the page a friend's invite link opens (#899). Served here, by the backend, because
// opening it is counted, and counting reads the code against every account.
//
// UNAUTHENTICATED AND COOKIELESS: whoever opens it has no account yet, and the page sets nothing.
// It reads one header, the user agent, and only to leave a link-preview fetch uncounted; what is
// counted is the referrer's code and the instant (`referral_events`), never the visitor.

import { acceptLang, normalizeReferralCode } from "@eait/shared";
import { openInvite, referralLink, type EngineDeps } from "../engine/index.ts";
import { html, invite } from "./page.ts";
import { START_PREFIX } from "./start.ts";

const INVITE_PATH = /^\/r\/([^/]{1,64})\/?$/;

export const isInvitePath = (pathname: string): boolean => INVITE_PATH.test(pathname);

/**
 * `hasStart`: this host signs people up on the web, so "Start on the web" goes somewhere.
 * `mayCount`: this address is inside its allowance — the page needs no login, so the row it
 * writes is bounded per address; past the allowance the page still renders and counts nothing.
 */
export async function inviteRoute(
  req: Request, url: URL, deps: EngineDeps, hasStart: boolean, mayCount: () => boolean,
): Promise<Response> {
  if (req.method !== "GET" && req.method !== "HEAD") return new Response(null, { status: 405, headers: { allow: "GET, HEAD" } });
  const raw = INVITE_PATH.exec(url.pathname)![1]!;
  const code = normalizeReferralCode(raw);
  // A HEAD is a checker, not a person.
  if (req.method === "GET" && mayCount()) await openInvite(deps, raw, req.headers.get("user-agent"));
  const link = code === null ? null : referralLink(deps.config, code);
  const store = deps.config.appStoreUrl;
  return html(invite({
    link,
    shown: link?.replace(/^https?:\/\//, "") ?? null,
    appStore: store === "" ? null : `${store}${store.includes("?") ? "&" : "?"}ct=referral`,
    start: hasStart ? `${START_PREFIX}${code === null ? "" : `?ref=${code}`}` : null,
    lang: acceptLang(req.headers.get("accept-language")),
  }), code === null ? 404 : 200);
}
