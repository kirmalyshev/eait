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

import { lightVars } from "../../shared/palette.ts";

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
<style nonce="${nonce}">
/* THE TOKENS COME FROM shared/palette.ts, not from this file. The app, the landing page and the
   /start flow all draw from that one copy, and a fourth set of hexes here is a fourth thing to
   keep in step. Imported by RELATIVE path, like dayBudget and copy.ts (#608). */
:root { ${lightVars}
  /* The same pair /start declares (backend/web/page.ts): the system stack under the one display
     face, so a fallback reads like a fallback and not like a second design. */
  --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, Roboto, Helvetica, Arial, sans-serif;
  --display: "Space Grotesk", var(--sans);
}
/* LIGHT, ALWAYS — the landing's rule, settled for this surface too (spud-web, #825): both surfaces
   are light and neither consults the OS, so there is no dark half of this stylesheet to keep in
   step. The tokens' dark block stays in shared/palette.ts for the app, not for this page. */
/* THE ONE TYPEFACE is /start's own, from /start's own route: the backend serves the landing's file
   at FONT_PATH (backend/web/page.ts), and the edge puts /start/* on this same origin — so
   font-src 'self' is all the CSP needs and nothing is fetched from anyone else. */
@font-face {
  font-family: "Space Grotesk";
  src: url("/start/assets/space-grotesk-latin.woff2") format("woff2");
  font-weight: 300 700;
  font-display: swap;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--ink); color: var(--text);
  font: 15px/1.5 var(--display); }
/* NUMBERS IN THE ONE FACE, tabular so a column of them holds still. The third face is gone: the
   boards set figures in the main face and so does this page. The unit still sits OUTSIDE the span —
   its space is the face's own. */
.num { font-variant-numeric: tabular-nums; }

/* THE FRAME (the boards' web layout, #52): a slim top bar — the mark, then the one row the app
   navigates by — over a single quiet column the width a chat reads best at, the 38.75rem /start
   already centres on. At a phone's width the column fills the viewport. */
#app { min-height: 100vh; display: flex; flex-direction: column; }
.wbar { display: flex; align-items: center; gap: 12px; padding: 0 26px; min-height: 60px;
  font: 700 17px var(--display); letter-spacing: -.02em; }
.wbar .mark { display: flex; align-items: center; gap: 8px; }
.wbar .mark svg { width: 30px; height: 24px; display: block; }
.wnav { display: flex; gap: 6px; margin-left: auto; }
.wcol { width: 100%; max-width: 38.75rem; margin: 0 auto; flex: 1; padding: 18px 20px 30px;
  background: var(--panel); border-radius: 26px 26px 0 0;
  box-shadow: 0 -1px 0 var(--line), 0 20px 50px -30px color-mix(in srgb, var(--text) 40%, transparent); }
.body { min-width: 0; }
/* The centred title the boards draw above each screen's own column. */
.top { text-align: center; padding: 6px 0 12px; }
.top .tt { margin: 0; font-size: 19px; }

h1, h2 { margin: 0 0 .5rem; font-weight: 800; letter-spacing: -.02em; }
h2 { font-size: 17px; }
.muted { color: var(--muted); }
.lab { font-size: 10.5px; font-weight: 700; letter-spacing: .13em; text-transform: uppercase; color: var(--muted); }
.big { margin: .25rem 0 0; display: flex; align-items: baseline; gap: 8px; }
.hero { font-size: 44px; font-weight: 800; letter-spacing: -1.5px; line-height: 1.05; }
.big.warn .hero { color: var(--warn); }
/* THE GUESS, AND NOTHING ELSE IS EVER THIS COLOUR. Immediately before the figure it governs, and
   outside the figure's own span. */
.about { color: var(--warn); font-weight: 700; }
/* THE FLOOR, AND NOTHING ELSE. Once per screen, as text, and never a tick on a scale. */
.floor { font-size: 10.5px; font-weight: 700; letter-spacing: .09em; text-transform: uppercase; color: var(--care); }

progress { display: block; width: 100%; height: 4px; margin: .5rem 0 .25rem; appearance: none; border: 0;
  border-radius: 3px; overflow: hidden; background: var(--line-strong); }
progress::-webkit-progress-bar { background: transparent; }
progress::-webkit-progress-value { background: var(--accent); border-radius: 3px; }
progress::-moz-progress-bar { background: var(--accent); border-radius: 3px; }
.big.warn + progress::-webkit-progress-value { background: var(--warn); }
.big.warn + progress::-moz-progress-bar { background: var(--warn); }

/* The boards' panel: a light surface one step up from the ground, with the hairline and the soft
   shadow /start's card already carries. */
.card { padding: 1rem 1.1rem; background: var(--raised); border: 1px solid var(--line);
  border-radius: 18px; margin-bottom: 14px;
  box-shadow: 0 1px 2px color-mix(in srgb, var(--text) 4%, transparent); }
/* A 52px STRIP, not a hero region: at 1360 wide a full-height wash is a wall of green, and every
   word on it has to be near-black. */
.day-card { padding: 0; overflow: hidden; }
.day-wash { margin: 0; height: 52px; display: flex; align-items: center; padding: 0 18px; color: var(--accent-ink);
  font-size: 12px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase;
  background: linear-gradient(180deg, var(--accent) 0%, var(--wash-mid) 40%, var(--wash-deep) 76%, var(--raised) 100%); }
.day-body { padding: 16px 18px 18px; }
.stat { display: flex; align-items: center; justify-content: space-between; margin-top: 10px; }

/* PILLS: every button, tab and chip is a 999px capsule — the shape the boards draw and /start's own
   controls already take. The three tabs never wrap onto a second row. */
.tab { color: var(--muted); text-decoration: none; padding: 8px 14px; border-radius: 999px; font-weight: 700; font-size: 14px; white-space: nowrap; }
.tab.on { color: var(--accent); background: var(--raised); }
/* You — the account's rows: label and control, a hairline between. */
.you > * + * { border-top: 1px solid var(--line); }
.you .rowline { padding: 12px 2px; }
.you .pick { font: inherit; font-weight: 700; padding: 10px 14px; border-radius: 999px; max-width: 62%;
  border: 1px solid var(--line-strong); background: var(--raised); color: var(--text); }
.you-act { display: flex; align-items: center; justify-content: space-between; width: 100%;
  padding: 14px 2px; background: none; border: 0; font: inherit; font-weight: 700; color: var(--text);
  cursor: pointer; text-align: left; }
.you-act::after { content: "›"; color: var(--muted); font-size: 18px; }
.primary { display: inline-block; margin-top: .75rem; padding: 0 18px; height: 44px; line-height: 44px;
  border-radius: 999px; background: var(--accent); color: var(--accent-ink); text-decoration: none;
  font-size: 13px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }

/* THE TABLE IS THE SECOND THING THIS WINDOW DOES. A phone can show four rows and a total; this can
   show the one guess sitting in a list of measured things, which is the strongest statement of the
   mechanism anywhere in the product. */
.meals { width: 100%; border-collapse: collapse; }
.meals th { text-align: left; font-size: 10.5px; font-weight: 700; letter-spacing: .11em; text-transform: uppercase;
  color: var(--dim); padding: 0 12px 10px; border-bottom: 1px solid var(--line-strong); }
.meals td { padding: 11px 12px; border-bottom: 1px solid var(--line); }
.meals tr:last-child td { border-bottom: 0; }
.meals .num { text-align: right; white-space: nowrap; }
/* The guessed row, and the only colour in the list. */
.meals tr.guessed td { background: color-mix(in srgb, var(--warn) 7%, transparent); }
.meals tr.guessed td:first-child { border-left: 1.5px solid color-mix(in srgb, var(--warn) 45%, transparent); }
/* The row's verdict pills sit under the meal's name, smaller than a card's (#52). */
.meals .pills { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
.meals .pill { min-height: 22px; padding: 0 9px; font-size: 11.5px; }

/* THE TRANSCRIPT (the boards' chat, #52): a quiet column — my words right in the accent green,
   Spud's left and pale, and his face beside only his NEWEST turn. No bubble runs the column's
   width, and the line's actions are small TEXT buttons on a 44px hit area. */
.thread { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 9px; }
.line { display: flex; flex-direction: column; align-items: flex-start; }
.line .bub { margin: 0; padding: .55rem .9rem; width: fit-content; max-width: 86%; border-radius: 18px;
  border-bottom-left-radius: 6px; background: var(--raised); border: 1px solid var(--line); }
.line.mine { align-items: flex-end; }
.line.mine .bub { background: var(--accent); color: var(--accent-ink); border-color: var(--accent);
  border-bottom-left-radius: 18px; border-bottom-right-radius: 6px; max-width: 80%; }
.line.buddy { flex-direction: row; gap: 10px; }
.line .av { flex: 0 0 40px; width: 40px; height: 40px; border-radius: 50%; overflow: hidden;
  background: var(--raised); border: 1px solid var(--line);
  display: flex; align-items: center; justify-content: center; }
.line .av svg { width: 30px; height: 30px; display: block; }
.line.buddy .col { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: flex-start; }
.line .note { font-size: 11.5px; color: var(--faint); font-weight: 600; }
.acts { display: flex; gap: 2px; }
.act { background: none; border: 0; color: var(--muted); cursor: pointer;
  font: 700 12.5px var(--display); padding: 4px 10px; min-width: 44px; min-height: 44px; }
.error, .notice { color: var(--bad); }
.notice { margin: 1rem 0 0; }
/* THE ONE COMPOSER, on Chat and on Today alike: "Add a photo" in front of the native input, the
   field, the round send. It stays at the foot of the column while the thread scrolls under it. */
.comp { margin-top: 14px; position: sticky; bottom: 0; background: var(--panel); padding: 10px 0 4px; }
.comp-row { display: flex; align-items: center; gap: 8px; }
.comp .add { flex: 0 0 auto; min-height: 44px; padding: 0 16px; border-radius: 999px; cursor: pointer;
  border: 1px solid var(--line-strong); background: var(--raised); color: var(--text);
  font: 700 13px var(--display); }
.comp .fld { flex: 1 1 8rem; min-width: 0; font: inherit; padding: 11px 16px; border-radius: 999px;
  border: 1px solid var(--line-strong); color: var(--text); background: var(--raised); }
.comp .send { flex: 0 0 44px; width: 44px; height: 44px; border-radius: 50%; border: 0; cursor: pointer;
  background: var(--accent); color: var(--accent-ink); font: inherit; font-size: 18px; font-weight: 700;
  display: inline-flex; align-items: center; justify-content: center; }
.comp-note { display: flex; align-items: center; gap: 6px; }
.comp-note .count { font-size: 12px; color: var(--muted); white-space: nowrap; }
.card button { padding: 0 16px; height: 38px; border-radius: 999px; cursor: pointer; font: inherit;
  font-weight: 700; color: var(--text); background: var(--raised); border: 1px solid var(--line);
  margin: .5rem .5rem 0 0; }
.card button.primary { background: var(--accent); color: var(--accent-ink); }
input:disabled, button:disabled { opacity: .5; cursor: default; }
/* The one-meal flow (#42) — the v5 boards, in the diary's place while the account has never
   logged: one centred column, the width a chat reads best at (styles_spec_v5_web). */
.flow { max-width: 620px; margin: 0 auto; }
.spk { display: flex; gap: 14px; align-items: flex-start; margin: 22px 0 18px; }
.spk .av { flex: 0 0 46px; width: 46px; height: 46px; border-radius: 50%; overflow: hidden; }
.spk .av svg { display: block; width: 100%; height: 100%; }
.spk-col { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.beat { border-left: 3px solid var(--accent); padding-left: 12px; color: var(--good);
  font-weight: 700; font-size: 13.5px; }
.spk .them { color: var(--muted); line-height: 1.55; }
.ask { font-size: 21px; line-height: 1.25; font-weight: 800; letter-spacing: -.02em; }
.step { display: flex; flex-direction: column; }
.step .card input[type="text"], .step .card select { display: block; width: 100%; box-sizing: border-box;
  font: inherit; padding: .55rem .8rem; border-radius: 999px; color: var(--text); background: var(--raised);
  border: 1px solid var(--line); margin: .4rem 0 0; }
.step .card .lab + .lab { margin-top: .9rem; }
.step-foot { display: flex; flex-direction: column; gap: 10px; margin-top: 14px; }
.cta { display: flex; align-items: center; justify-content: center; min-height: 52px; padding: 0 18px;
  border: 0; border-radius: 999px; font: inherit; font-weight: 800; text-decoration: none; cursor: pointer; }
.cta.p { background: var(--accent); color: var(--accent-ink); }
.cta.s { background: var(--raised); color: var(--text); border: 1px solid var(--line); }
.cta.g { background: none; color: var(--muted); min-height: 40px; }
.visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0);
  white-space: nowrap; }
.drop { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
  min-height: 150px; border: 1.5px dashed var(--line-strong); border-radius: 16px; color: var(--muted);
  cursor: pointer; text-align: center; padding: 16px; }
.drop.over, .drop:focus-within { border-color: var(--accent); color: var(--text); }
.drop .drop-lead { font-weight: 700; color: var(--text); overflow-wrap: anywhere; }
.drop small { color: var(--faint); }
.stats { display: flex; gap: 10px; margin-top: 12px; }
.stat-cell { flex: 1; background: var(--panel); border-radius: 12px; padding: 10px 12px; }
.stat-num { font-size: 18px; font-weight: 800; margin-top: 2px; }
.pills { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
.pill { display: inline-flex; align-items: center; min-height: 30px; padding: 0 12px; border-radius: 999px;
  font-size: 12.5px; font-weight: 800; }
.pill.good { background: color-mix(in srgb, var(--good) 14%, transparent); color: var(--good); }
.pill.warn { background: color-mix(in srgb, var(--warn) 16%, transparent); color: var(--warn); }
.pill.bad { background: color-mix(in srgb, var(--bad) 14%, transparent); color: var(--bad); }
.perks { display: flex; flex-direction: column; gap: 10px; margin: 2px 0 14px; }
.perk { display: flex; align-items: center; gap: 10px; font-weight: 700; }
.perk .tick { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px;
  border-radius: 50%; background: var(--accent); color: var(--accent-ink); font-size: 13px; flex: 0 0 22px; }
.rowline { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 0; }
.rowline + .rowline { border-top: 1px solid var(--line); }
.rowline .when { font-weight: 700; }
/* The plan rows are real radios — the input is native, so the keyboard works without a shim. */
.plans { padding-top: 4px; padding-bottom: 4px; margin-bottom: 14px; }
.plan { display: flex; align-items: center; gap: 12px; padding: 12px 2px; font-weight: 700; cursor: pointer; }
.plan input[type="radio"] { width: 20px; height: 20px; margin: 0; flex: 0 0 20px;
  accent-color: var(--accent); cursor: pointer; }
.hint { color: var(--muted); font-size: 13px; text-align: center; margin: 2px 0 0; }
@media (max-width: 760px) { .flow { max-width: none; } }
</style>
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
              // Space Grotesk comes off the backend's own /start/assets route — same origin here.
              "font-src 'self'",
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
