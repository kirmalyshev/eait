// The only thing here that talks to the server.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// THREE RULES, AND THEY ARE THE REASON THIS FILE EXISTS RATHER THAN `fetch` AT EVERY CALL SITE.
//
//  1. RELATIVE, ALWAYS. Every request goes to `/api/v1/...` on the origin this page was served
//     from — never to `api.eait.fit`, never to an absolute URL. The backend has no CORS headers
//     anywhere and must not gain any: the moment a cross-origin call is attempted, the fix that
//     suggests itself is `Access-Control-Allow-Origin`, and that is a door this product does not
//     need open. A relative path cannot have that problem.
//  2. THE BEARER LIVES IN THIS MODULE AND NOWHERE ELSE. Not in `localStorage`, not in
//     `sessionStorage`, not on `window`. A token in storage survives the tab, survives a reload
//     and is readable by any script that ever manages to run on this origin; one in a closure is
//     gone when the tab is. The cost is one round trip to `/start/session/token` after a reload,
//     which is the correct price.
//  3. NO COOKIES ON THE API. `credentials: "omit"` is stated rather than left to the default,
//     because the default is `same-origin` and this page IS the same origin as the API now. The
//     server ignores cookies on `/v1/*` deliberately; sending them anyway would make that
//     dependence invisible the day somebody changes it.
// ─────────────────────────────────────────────────────────────────────────────────────────────

import type { ErrorResponse, NDJSON } from "@eait/shared/contract";

let bearer: string | null = null;

export class Unauthenticated extends Error {}

/**
 * A request the server ANSWERED with something other than a 2xx, carrying the body it said it with.
 *
 * The status alone cannot word a refusal: a 429 is a spent day, a spent instance budget or a busy
 * network, and only `error` and `scope` in the body say which (`refusal()` in `api/routes.ts`).
 * Null when the body was not JSON.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly body: ErrorResponse | null;
  constructor(status: number, body: ErrorResponse | null, message: string) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

/**
 * Trade the `/start` session cookie for a bearer this script may hold.
 *
 * The cookie is `HttpOnly`, so this is the only way a browser's JavaScript can address the API at
 * all. A POST, because `SameSite=Lax` withholds the cookie from a cross-site POST and that is what
 * guards it.
 */
export async function signIn(): Promise<void> {
  const res = await fetch("/start/session/token", { method: "POST", redirect: "manual" });
  if (!res.ok) throw new Unauthenticated();
  // No session is a 200 with no token in it (#457): a redirect or a 401 here was a red line in
  // every anonymous visitor's console. `redirect: "manual"` stays for a server that still sends one.
  const { token } = await res.json() as { token: string | null };
  if (token === null) throw new Unauthenticated();
  bearer = token;
}

export const signedIn = (): boolean => bearer !== null;

/**
 * End the session — on the SERVER, and then here.
 *
 * Forgetting the bearer is not signing out. The `/start` session cookie is HttpOnly, so this script
 * cannot clear it and it stays valid; the next press of "Sign in" would answer 303 to the diary and
 * mint a fresh bearer from the same session. On a shared browser that is the next person reading
 * the last person's diary. The route revokes every token on the account and clears the cookie.
 */
export async function signOut(): Promise<void> {
  try {
    await fetch("/start/session/signout", { method: "POST", redirect: "manual" });
  } finally {
    // Local state goes either way. A network failure must not leave the page believing it is still
    // signed in when the person has asked not to be.
    bearer = null;
  }
}

/** Drop only what this tab holds — for a 401, where the credential is already dead. */
export const forget = (): void => { bearer = null; };

const send = (path: string, init: RequestInit): Promise<Response> => fetch(`/api/v1${path}`, {
  ...init,
  credentials: "omit",
  headers: { ...init.headers, authorization: `Bearer ${bearer}` },
});

/**
 * One call, and ONE retry behind a bearer that expired.
 *
 * The bearer lives `BROWSER_SESSION_TTL_MS` — twelve hours — while the `/start` session cookie
 * behind it lives as long as this browser is open. So the ordinary end of a bearer's life is a 401
 * on a page whose person is still signed in, and the honest answer to that is another token rather
 * than a sign-in screen: without the retry, a tab left open overnight sends its owner to `/start`,
 * a server-rendered flow that ends on the plan page instead of back in the app they were using.
 *
 * REPLAYING THE CALL IS SAFE, and only because of where the refusal happens: `resolveUserId` is the
 * gate, so a 401 is a request that reached no handler and wrote nothing. (It also means the body
 * has to be replayable — every call here sends a string, a `FormData` or nothing, and `fetch`
 * serializes a `FormData` afresh on every send. A stream would not be.)
 *
 * ONE re-mint and no more. A session that is genuinely over answers 401 again with the new token,
 * and retrying on that is an endless pair of requests against a server that has already said no.
 */
async function call(path: string, init: RequestInit): Promise<Response> {
  if (bearer === null) throw new Unauthenticated();
  let res = await send(path, init);
  if (res.status === 401) {
    try {
      await signIn();
    } catch (e) {
      // No session either — the browser was closed and reopened, or signed out elsewhere. That IS a
      // sign-in screen, and `signIn` says so itself (#505). ANYTHING ELSE IS THE NETWORK and stays
      // the network (#529): read as signed out, it showed "Sign in" over a live session and wiped a
      // held proposal. The expired bearer is kept, so the next call asks for a fresh one again.
      if (e instanceof Unauthenticated) forget();
      throw e;
    }
    res = await send(path, init);
    if (res.status === 401) { forget(); throw new Unauthenticated(); }
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null) as ErrorResponse | null;
    throw new ApiError(res.status, body, `${init.method ?? "GET"} ${path}: ${res.status}`);
  }
  return res;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  return await (await call(path, init)).json() as T;
}

/**
 * A stored photo, as something an `<img>` can point at.
 *
 * AN `<img src>` CANNOT FETCH IT. This API is bearer-only — `resolveUserId` reads no cookie, which
 * is the whole reason another origin cannot post to it on a signed-in browser — and an `<img>`
 * sends no Authorization header. A meal's photo has to come through this function, which holds the
 * bearer and re-mints it like every other call, and then be handed to the element.
 *
 * A `data:` URL rather than `blob:`, and that is the CSP's decision: the shell allows
 * `img-src 'self' data:`, so a blob would need the policy widened for one picture.
 *
 * ponytail: the whole photo is base64 in memory for as long as the screen is up, bounded by
 * `limits.maxUploadBytes`. `blob:` plus one more source in `img-src` is the upgrade if a meal ever
 * carries more than one shown at a time.
 */
export async function apiImage(path: string): Promise<string> {
  const res = await call(path, {});
  const type = res.headers.get("content-type") ?? "image/jpeg";
  const bytes = new Uint8Array(await res.arrayBuffer());
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return `data:${type};base64,${btoa(binary)}`;
}

/** The streamed shape, spelled as the contract spells it — a type import, so nothing is bundled. */
const STREAM: typeof NDJSON = "application/x-ndjson";

/**
 * A call answered as a STREAM of JSON lines, whose answer is the LAST line.
 *
 * `POST /v1/meals/photo` streams when asked, and the phone asks. It writes a blank line every few
 * seconds while the analyzer is silent (`STREAM_KEEPALIVE_MS` in `api/routes.ts`), which keeps every
 * hop between the browser and the server from calling a quiet turn dead. (Bun's own 10 s idle cut is
 * not one of those hops for this route on Bun 1.4.0: it cuts a request with no body to read, not a
 * POST whose body was read. Measured 2026-09-10, #508.) Read to the end, the last line is the result
 * — refusals included, because the 200 went out with the first byte.
 *
 * Every line before the last goes to `onLine` AS IT ARRIVES (#608): the glance and the rows,
 * which the phone has drawn since #508 and this page now draws under the composer. Read with the
 * body's reader rather than `text()`, or nothing arrives until everything has.
 */
export async function apiStream<T>(path: string, init: RequestInit = {}, onLine?: (line: unknown) => void): Promise<T> {
  const res = await call(path, { ...init, headers: { ...init.headers, accept: STREAM } });
  const reader = res.body?.getReader();
  if (!reader) throw new Error(`${init.method ?? "GET"} ${path}: no body`);
  const decoder = new TextDecoder();
  let carry = "";
  let last: string | undefined;
  const take = (line: string) => {
    if (line.trim() === "") return;
    if (last !== undefined) onLine?.(JSON.parse(last));
    last = line;
  };
  // RELEASED WHATEVER HAPPENS: a thrown `onLine` (bad JSON, a callback that throws) or an aborted
  // read must not leave the stream's reader locked — the next call to this same response's body
  // would find it still held and hang rather than fail.
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      carry += decoder.decode(value, { stream: true });
      const lines = carry.split("\n");
      carry = lines.pop() ?? "";
      for (const line of lines) take(line);
    }
    carry += decoder.decode();
    if (carry.trim() !== "") take(carry);
  } finally {
    reader.releaseLock();
  }
  // Closed with no result: the turn may have run to the end anyway, which is a transport failure's
  // wording, not a refusal's.
  if (last === undefined) throw new Error(`${init.method ?? "GET"} ${path}: the stream ended with no answer`);
  return JSON.parse(last) as T;
}
