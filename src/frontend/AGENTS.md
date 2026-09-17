# AGENTS.md — web

The web application. The third workspace, the only one whose code runs in somebody's browser, and
since #423 an application of its own rather than a bundle the backend hands out.

Root `AGENTS.md` covers the repo; this covers this directory. `src/backend/AGENTS.md` owns the API this talks
to, and `shared` is the contract both implement.

## What this is

`app.eait.fit` — the browser's front door, and its own process. `server/index.ts` generates the page
with a per-response CSP nonce and serves the bundle beside it; `deploy/Dockerfile.web` is its image
and `web` is its compose service, publishing nothing. Three applications on this box, three deploys:
this one, the API, and the landing page.

**ONE ORIGIN, COMPOSED AT THE EDGE — and that is the property to protect.** Caddy's `@app` block
sends `/` and `/app.js` here; `/api/v1/*`, `/start` and `/admin` go to the backend on the same
hostname. That is what lets this client call its API with a relative path under `connect-src 'self'`
and no CORS header anywhere. Splitting the two applications did not split the origin, and a change
that makes the browser talk to a second one undoes the whole arrangement.

There is no Caddy on a laptop, so `server/index.ts` forwards what is not its own to the backend when
`EAIT__FRONTEND__BACKEND_ORIGIN` is set — the standard dev-server proxy, and unset in production.

```
bun run demo                                   # the backend, in memory, on :8787
bun run web:build                              # → src/frontend/dist/main.js, served at /app.js
EAIT__FRONTEND__BACKEND_ORIGIN=http://127.0.0.1:8787 bun run web   # this app on :8788, API proxied
bun run check                                  # typecheck (all three halves) + the build + tests
bun run web:e2e                                # the browser suite, against the demo model
```

## Two halves, two tsconfigs

`server/` runs under bun. Everything else here runs in a browser. `tsconfig.json` gives the browser
half `types: []` and excludes `server/` and `test/`; `server/tsconfig.json` and `test/tsconfig.json`
are the opposite pair. **A `Bun.file`
that typechecks in client code is a `Bun.file` that ships to a page and is undefined**, which is why
the exclude is written so a new file in this directory is browser code by default.

## Hard rules

- **No framework, and no dependency that is not `@eait/shared`.** This repo already ships a working
  client-side application written this way — `src/backend/api/admin.page.ts` — so the idiom exists
  and costs nothing. Five screens that each re-render a container do not need reconciling. If you
  reach for React, you are adding a build toolchain and two packages to avoid writing
  `replaceChildren`.
- **`@eait/shared` is imported for TYPES only.** `import type`, always. A value import pulls that
  workspace's runtime code into a browser bundle, and `targets.ts` is server arithmetic. It is also
  what lets both images skip `bun install` entirely: a type import is erased before anything is
  resolved.
- **Every request goes through `api.ts`, and every path is RELATIVE.** Never `https://api.eait.fit`,
  and never the backend's own port. The backend has no CORS headers anywhere and must not gain any;
  the moment a cross-origin call is attempted the fix that suggests itself is
  `Access-Control-Allow-Origin`, which is a door this product does not need open. `connect-src
  'self'` in the shell's CSP makes the browser enforce it, and the edge — or the dev proxy — is what
  makes it work.
- **The bearer lives in a closure in `api.ts` and nowhere else.** Not `localStorage`, not
  `sessionStorage`, not on `window`. A token in storage survives the tab and is readable by any
  script that ever runs on this origin — and this origin also carries the admin. The cost of the
  closure is one round trip to `/start/session/token` after a reload, which is the right price.
- **`textContent`, never `innerHTML`.** Everything on these screens came from a server response or
  from a person, and the shell's CSP has no `'unsafe-inline'` to fall back on: an injected `<script>`
  would not run, but an injected `<img onerror>` is a defence you are relying on rather than a
  defence you built. `el()` in `main.ts` is the only node constructor.
- **No inline handler, ever — `addEventListener` only.** The page is served under a nonce policy,
  which refuses `onclick=` attributes outright. One added here is a control that silently stops
  working rather than an error somebody sees.

## Signing in

There is one way, and it is not in this workspace: `/start` is a server-rendered flow **on the
backend**, reached through the edge on this same origin, that ends by setting an `HttpOnly` session
cookie. This app then POSTs to `/start/session/token` and gets a SECOND bearer token back in the
body — the cookie's own value never enters JavaScript, and the two can be revoked apart. It is a
POST because `SameSite=Lax` withholds the cookie from a cross-site POST, which is what guards it, and
the token is in the body because a bearer in a URL lands in history, in a `Referer` and in every log
between here and the browser.

**That bearer lives twelve hours, and the cookie behind it lives as long as the browser is open**
(`BROWSER_SESSION_TTL_MS`). The phone's six idle months are for a Keychain on the same device for
years; a token minted per page view, on the origin that also serves the admin, would leave a working
credential behind for every tab anybody opened. What makes the short lifetime invisible is `api.ts`:
a 401 re-mints ONCE and replays the call — safe because `resolveUserId` refuses before any handler
runs, so a 401 wrote nothing — and a second 401 is a session that is genuinely over. Never retry
twice: that is an endless pair of requests against a server that has already said no.

## Where to add things

- A new screen → a function returning an element in `main.ts`, plus a route in `render()`. Screens
  stay thin; anything shared goes beside `el()`.
- A new server call → a method in `api.ts`. If the endpoint does not exist yet, it goes in
  `src/shared/contract.ts` first, then the backend, then here — the order the root `AGENTS.md` sets.
- Styling → the `<style>` block in `server/index.ts`. It is one stylesheet under the nonce; a second
  one is a second thing to keep under a policy.
- A new path this process answers → a branch in `server/index.ts` AND the `@app` matcher in
  `app.caddy.j2`, in the same commit. The edge sends this container two exact paths; a third one
  added here alone is a route only a laptop ever reaches.
