// The web application, as its own process on its own port.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// #423. This used to live in the backend (`backend/web/app.ts`), which served the page and the
// bundle alongside its API. The reason given was the nonce below — a strict Content-Security-Policy
// needs a value that differs on every response, and only something generating the response can
// produce one. That argument rules out Caddy's `file_server`; it never said the generator had to be
// the API. The landing page has been its own image, its own container and its own port since it
// existed, and this is the same shape: three applications, three deploys, one origin composed at
// the edge.
//
// WHAT THIS PROCESS SERVES, IN FULL: `/` (the shell), `/app.js` (the bundle), `/health`. Caddy's
// `@app` matcher sends it those and nothing else — `/api`, `/start` and `/admin` are the backend's
// on the same hostname — so everything else here answers 404 rather than a catch-all shell that
// would mask an edge which had stopped routing.
//
// OFF UNLESS BUILT. No bundle on disk means the shell and the bundle answer 404, the same shape
// `/admin`, `/start` and the purchase webhook take when they are not configured. `/health` still
// answers, because it is asked whether this PROCESS is alive; a healthcheck that also demanded a
// build would restart the container forever over a missing file and read as a crash.
//
// The bundle is read ONCE, at first request, and kept. It is one file that changes only when the
// image does.
// ─────────────────────────────────────────────────────────────────────────────────────────────

import { STYLESHEET } from "../design.ts";

/** Where `bun run build` in this workspace puts the bundle. The only default; tests pass their own. */
export const DEFAULT_BUNDLE_PATH = new URL("../dist/main.js", import.meta.url);

export const SHELL_PATH = "/";
export const BUNDLE_PATH = "/app.js";
export const HEALTH_PATH = "/health";

/** Slot 0's port. Every other slot derives its own — `src/scripts/dev-env.ts` owns that arithmetic. */
export const DEFAULT_PORT = 8485;

const notFound = () => new Response(JSON.stringify({ error: "not found" }), {
  status: 404,
  headers: { "content-type": "application/json" },
});

/**
 * The page.
 *
 * No inline script and no inline event handler — every line of behaviour is in the bundle, which is
 * a separate request carrying the same nonce. The one inline `<style>` carries it too, so the
 * policy never needs `'unsafe-inline'` for either.
 *
 * THE STYLESHEET IS `design.ts`, NOT THIS FILE. It is still ONE stylesheet under the nonce — that
 * rule is about how many documents the browser has to trust, and it is unchanged. What moved is
 * where the values live: eleven hexes used to sit inline here, and a colour that means one thing
 * ("amber is the guess and nothing else") cannot be enforced from eleven places. A test below
 * fails if a hex that is not one of that module's tokens ever appears in this page again.
 */
function shell(nonce: string): string {
  return `<!doctype html>
<!-- The shell ships as "en" and the client rewrites it the moment the profile lands
     (document.documentElement.lang). It cannot be right here: this file is static and is served
     before anybody is identified. What matters is that it does not STAY wrong — a screen reader
     picks a voice from this attribute. -->
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>eait</title>
<!-- An empty data: icon, so the browser does not ask for /favicon.ico on every page load. It is
     not that the icon is missing: an anonymous request for an unknown path on this origin is
     answered 401 by resolveUserId before anything can 404 it, so every load logged "Failed to
     load resource: 401" in the console - four of them in one walk. A console that always has an
     error in it is a console nobody reads. Found by driving a browser; no unit test saw it.
     (No backticks in this file's HTML: the document is one template literal.) -->
<link rel="icon" href="data:,">
<style nonce="${nonce}">${STYLESHEET}</style>
</head>
<body>
<div id="app"></div>
<script nonce="${nonce}" src="${BUNDLE_PATH}" type="module"></script>
</body>
</html>`;
}

export interface WebAppOptions {
  /** The bundle this process serves. A test points at one it wrote. */
  bundlePath?: URL;
  /**
   * DEVELOPMENT ONLY, and unset in production.
   *
   * On a laptop there is no Caddy, so this origin is two ports rather than one: the page comes from
   * here and every relative `/api/v1/*` call it makes would arrive here too, where there is no API.
   * With this set, everything that is not one of the three paths above is forwarded to the backend,
   * which is exactly what the edge does in production — including keeping the browser's Host, see
   * `proxy` below.
   *
   * The alternatives are both worse. An absolute `http://127.0.0.1:8484` in the client makes it
   * cross-origin, which is what `connect-src 'self'` and the absent CORS headers exist to forbid,
   * and it would be a second code path that only development ever runs. Running Caddy locally makes
   * `./dev up` need Docker before it can show a page.
   */
  backendOrigin?: string;
}

/**
 * The web application, bound to one bundle on disk.
 *
 * A FACTORY RATHER THAN A MODULE-LEVEL CACHE, so a test can point at a bundle it wrote instead of
 * depending on whether somebody ran a build first — which would make the same test assert two
 * different things on two machines. The file is read once, on the first request that needs it, and
 * kept: it is one file that changes only when the image does.
 */
export function createWebApp(options: WebAppOptions = {}) {
  const bundlePath = options.bundlePath ?? DEFAULT_BUNDLE_PATH;
  const backendOrigin = (options.backendOrigin ?? "").replace(/\/$/, "");
  let loaded: Promise<string | null> | undefined;

  const bundle = (): Promise<string | null> => loaded ??= (async () => {
    const file = Bun.file(bundlePath);
    return await file.exists() ? await file.text() : null;
  })();

  /**
   * Forward a request the backend owns, the way the edge does.
   *
   * THE HOST HEADER IS PASSED THROUGH, and that is the load-bearing line. `routes.ts` answers
   * `/start` with a 301 to `EAIT__BACKEND__PUBLIC_WEB_URL` whenever the request arrived on a
   * different host — which is how the API's name sends a phone to the browser's name. Rewriting
   * the Host to the backend's own port makes that condition true on every proxied request, so the
   * backend redirects to this port, the browser comes back, and the two bounce until Chrome gives
   * up. Caddy forwards the original Host; so does this.
   *
   * `redirect: "manual"` because `/start` ends in a 303 the BROWSER has to take, carrying the
   * Set-Cookie of the hop before it. `accept-encoding` is dropped because this hop would decompress
   * a response and forward the header claiming otherwise.
   *
   * The body is buffered rather than streamed. That is a development-only cost on a request whose
   * ceiling is one meal's photos, and `duplex: "half"` is the alternative — a flag whose support
   * differs between runtimes for a code path production never executes.
   */
  const proxy = async (req: Request, url: URL): Promise<Response> => {
    const headers = new Headers(req.headers);
    // Stated rather than inherited. `Bun.serve` builds `req.url` FROM the Host header, so on a real
    // request this writes back the value that is already there; without it, `fetch` supplies the
    // backend's own address and the redirect above fires.
    headers.set("host", url.host);
    headers.delete("accept-encoding");
    const method = req.method;
    const body = method === "GET" || method === "HEAD" ? undefined : await req.arrayBuffer();
    return await fetch(`${backendOrigin}${url.pathname}${url.search}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body }),
      redirect: "manual",
    });
  };

  const fetchHandler = async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const { pathname } = url;

    // First, and independent of whether anything was ever built: this answers for the PROCESS.
    if (pathname === HEALTH_PATH) return new Response("ok\n", {
      headers: { "content-type": "text/plain; charset=utf-8" },
    });

    if (pathname === SHELL_PATH || pathname === BUNDLE_PATH) {
      const js = await bundle();
      if (js === null) return notFound();

      if (req.method === "GET" && pathname === BUNDLE_PATH) {
        return new Response(js, {
          headers: {
            "content-type": "text/javascript; charset=utf-8",
            // No hash in the filename yet, so it may not be cached across deploys. A stale bundle
            // against a moved API is a page that fails in ways nobody can reproduce.
            "cache-control": "no-cache",
          },
        });
      }

      if (req.method === "GET" && pathname === SHELL_PATH) {
        const nonce = crypto.randomUUID();
        return new Response(shell(nonce), {
          headers: {
            "content-type": "text/html; charset=utf-8",
            // `default-src 'none'` and then only what this page actually uses. NO `'unsafe-inline'`:
            // the whole reason the shell is generated rather than served from disk is to be able to
            // say that. `connect-src` is `self` alone, which is what makes the "call /api relative,
            // never api.eait.fit" rule enforced by the browser rather than by good intentions.
            "content-security-policy": [
              "default-src 'none'",
              `script-src 'nonce-${nonce}'`,
              `style-src 'nonce-${nonce}'`,
              "img-src 'self' data:",
              "connect-src 'self'",
              "base-uri 'none'",
              // Nothing here posts a form. `/start` does, and it is a different document.
              "form-action 'none'",
              "frame-ancestors 'none'",
            ].join("; "),
            "referrer-policy": "no-referrer",
            "x-frame-options": "DENY",
          },
        });
      }

      return notFound();
    }

    if (backendOrigin !== "") return await proxy(req, url);
    return notFound();
  };

  return { fetch: fetchHandler };
}

if (import.meta.main) {
  const port = Number(process.env.EAIT__FRONTEND__PORT ?? DEFAULT_PORT);
  // 127.0.0.1 on a laptop; the container sets 0.0.0.0, which inside one means "reachable by the
  // other containers on this network", not "reachable by the internet" — compose publishes no port
  // for this service and Caddy is the only route in.
  const hostname = process.env.EAIT__FRONTEND__HOST ?? "127.0.0.1";
  const app = createWebApp({ backendOrigin: process.env.EAIT__FRONTEND__BACKEND_ORIGIN ?? "" });
  const server = Bun.serve({ port, hostname, fetch: app.fetch });
  console.log(`[eait-web] ${server.url}`);
}
