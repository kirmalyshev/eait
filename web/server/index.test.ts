// The web application's own server, and the policy that is the whole reason it generates its page.
//
// This suite is `backend/web/app.test.ts` moved: the shell, its nonce and the bundle used to be
// served by the BACKEND process, and #423 made this workspace an application of its own with its
// own port — the shape the landing page has had all along. What is asserted here is unchanged from
// that file apart from the import; what is NEW is the dev proxy and `/health` at the bottom.
//
// One ORIGIN still carries the application, its API and the admin — Caddy composes them, which is
// why the page can call `/api/v1/*` relative. That concentration is what makes the
// Content-Security-Policy load-bearing rather than hygiene: a script that manages to run on this
// page can read the bearer this page holds, call the API with it, and — the admin being a role
// since #391b — do so as an administrator.

import { afterAll, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BUNDLE_PATH, HEALTH_PATH, SHELL_PATH, createWebApp } from "./index.ts";

const dir = mkdtempSync(join(tmpdir(), "eait-web-"));
const bundlePath = join(dir, "main.js");
writeFileSync(bundlePath, "console.log('bundle')\n");
afterAll(() => rmSync(dir, { recursive: true, force: true }));

/** Bound to a bundle this file wrote, so the suite says the same thing on every machine. */
const built = createWebApp({ bundlePath: new URL(`file://${bundlePath}`) });
/** Bound to a path that does not exist — a deployment that never built the web app. */
const unbuilt = createWebApp({ bundlePath: new URL(`file://${join(dir, "absent.js")}`) });

const get = (app: ReturnType<typeof createWebApp>, path: string) =>
  app.fetch(new Request(`https://app.eait.fit${path}`));

describe("a deployment with no bundle has no web application", () => {
  it("answers 404 on the shell and on the bundle", async () => {
    // 404 rather than 500 or an empty page, and the same shape `/admin` and the purchase webhook
    // take when they are not configured: a surface that does not exist rather than a broken one.
    expect((await get(unbuilt, SHELL_PATH)).status).toBe(404);
    expect((await get(unbuilt, BUNDLE_PATH)).status).toBe(404);
  });

  it("is still alive, which is what its container is asked", async () => {
    // The healthcheck proves the PROCESS answers, never that a build happened. Conflating the two
    // gives you a container that restarts forever over a missing file, which reads as a crash.
    expect((await get(unbuilt, HEALTH_PATH)).status).toBe(200);
  });
});

describe("the shell", () => {
  it("carries a nonce and never allows inline script", async () => {
    const res = await get(built, SHELL_PATH);
    const csp = res.headers.get("content-security-policy")!;
    expect(csp).toContain("default-src 'none'");
    expect(csp).not.toContain("unsafe-inline");
    expect(csp).not.toContain("unsafe-eval");

    // The nonce in the policy is the nonce on the tags, or the page does not run at all.
    const nonce = /script-src 'nonce-([^']+)'/.exec(csp)![1]!;
    const html = await res.text();
    expect(html).toContain(`<script nonce="${nonce}"`);
    expect(html).toContain(`<style nonce="${nonce}">`);
  });

  it("uses a different nonce every time", async () => {
    // A nonce that repeats is a nonce an injected script can be written against, which is the
    // whole of what it defends. This is also why the shell cannot be a static file — and therefore
    // why this workspace ships a server rather than a directory for `file_server` to hand out.
    const one = (await get(built, SHELL_PATH)).headers.get("content-security-policy")!;
    const two = (await get(built, SHELL_PATH)).headers.get("content-security-policy")!;
    expect(one).not.toBe(two);
  });

  it("permits calls to its own origin and no other", async () => {
    // `connect-src 'self'` is what makes "the bundle calls /api relative, never api.eait.fit" a
    // rule the browser enforces. The backend has no CORS headers anywhere and must not gain any;
    // an attempt to call the other origin should fail in the browser rather than prompt somebody
    // to add `Access-Control-Allow-Origin`.
    const csp = (await get(built, SHELL_PATH)).headers.get("content-security-policy")!;
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("has no inline handler in it at all", async () => {
    // The nonce covers <script> and <style>. It does NOT cover an `onclick=` attribute — those are
    // refused outright under a nonce policy — so one added here is a control that silently stops
    // working rather than a policy violation somebody sees.
    const html = await (await get(built, SHELL_PATH)).text();
    expect(html).not.toMatch(/\son[a-z]+=/);
  });
});

describe("the bundle", () => {
  it("is served as JavaScript and is not cached across deploys", async () => {
    const res = await get(built, BUNDLE_PATH);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/javascript");
    // The filename carries no hash yet, so a cached copy would outlive the API it was built
    // against — a page that fails in ways nobody can reproduce.
    expect(res.headers.get("cache-control")).toBe("no-cache");
    expect(await res.text()).toContain("console.log('bundle')");
  });

  it("is served to every request that arrives before the first read of it has finished", async () => {
    const fresh = createWebApp({ bundlePath: new URL(`file://${bundlePath}`) });
    const res = await Promise.all([get(fresh, SHELL_PATH), get(fresh, SHELL_PATH), get(fresh, BUNDLE_PATH)]);
    expect(res.map((r) => r.status)).toEqual([200, 200, 200]);
  });

  it("answers nothing but GET", async () => {
    const res = await built.fetch(new Request("https://app.eait.fit/app.js", { method: "POST" }));
    expect(res.status).toBe(404);
  });
});

describe("this process serves the web application and nothing else", () => {
  it("refuses every other path, because Caddy sends it none of them", async () => {
    // Deliberately not a catch-all shell: `/admin`, `/start` and `/api` are tenants of the SAME
    // hostname, served by the backend, and the edge is what routes between the two containers.
    // A greedy route here would only ever mask an edge that stopped doing its job.
    for (const p of ["/admin", "/start", "/api/v1/profile", "/robots.txt", "/anything"]) {
      expect(`${p}: ${(await get(built, p)).status}`).toBe(`${p}: 404`);
    }
  });
});

describe("the development proxy, which production does not have", () => {
  // There is no Caddy on a laptop, so without this the page loads from :8788 and every relative
  // `/api/v1/*` call it makes goes to :8788 as well, where there is no API. The alternatives are
  // both worse: an absolute URL to :8787 makes the client cross-origin, which is what
  // `connect-src 'self'` and the absent CORS headers exist to forbid, and running Caddy locally
  // makes `./dev up` need Docker to show a page.
  //
  // UNSET IN PRODUCTION, where the edge composes the origin and this branch is dead code.

  it("is off unless an origin is named", async () => {
    expect((await get(built, "/api/v1/profile")).status).toBe(404);
  });

  it("forwards the path, the method, the body and the answer", async () => {
    const seen: { url: string; method: string; body: string; auth: string | null }[] = [];
    const upstream = Bun.serve({
      port: 0,
      async fetch(req) {
        seen.push({
          url: req.url,
          method: req.method,
          body: await req.text(),
          auth: req.headers.get("authorization"),
        });
        return new Response(JSON.stringify({ ok: true }), {
          status: 201,
          headers: { "content-type": "application/json" },
        });
      },
    });
    try {
      const app = createWebApp({
        bundlePath: new URL(`file://${bundlePath}`),
        backendOrigin: `http://127.0.0.1:${upstream.port}`,
      });
      const res = await app.fetch(new Request("http://127.0.0.1:8788/api/v1/meals?day=2026-09-09", {
        method: "POST",
        headers: { authorization: "Bearer t0ken", "content-type": "application/json" },
        body: '{"note":"soup"}',
      }));
      expect(res.status).toBe(201);
      expect(await res.json()).toEqual({ ok: true });
      expect(seen).toHaveLength(1);
      expect(seen[0]!.method).toBe("POST");
      expect(seen[0]!.body).toBe('{"note":"soup"}');
      expect(seen[0]!.auth).toBe("Bearer t0ken");
      expect(new URL(seen[0]!.url).pathname + new URL(seen[0]!.url).search)
        .toBe("/api/v1/meals?day=2026-09-09");
    } finally {
      upstream.stop(true);
    }
  });

  it("keeps the browser's Host, so the backend does not redirect the browser to itself", async () => {
    // NOT COSMETIC, AND MEASURED. `routes.ts` answers `/start` with a 301 to
    // `EAIT__BACKEND__PUBLIC_WEB_URL` whenever the request arrived on a DIFFERENT host — which is
    // how `api.eait.fit/start` sends a phone to the browser's name. Rewriting the Host to the
    // backend's own port here makes that condition true on every proxied request: the backend
    // redirects to :8788, the browser comes back, and the two bounce until Chrome gives up with
    // ERR_TOO_MANY_REDIRECTS. Caddy forwards the original Host, so this does too.
    const seen: { host: string | null } = { host: null };
    const upstream = Bun.serve({
      port: 0,
      fetch(req) {
        seen.host = req.headers.get("host");
        return new Response("ok");
      },
    });
    try {
      const app = createWebApp({
        bundlePath: new URL(`file://${bundlePath}`),
        backendOrigin: `http://127.0.0.1:${upstream.port}`,
      });
      await app.fetch(new Request("http://127.0.0.1:8788/start"));
      expect(seen.host).toBe("127.0.0.1:8788");
    } finally {
      upstream.stop(true);
    }
  });

  it("hands a redirect back to the browser rather than following it", async () => {
    // `/start` ends in a 303 to `/`. A proxy that follows redirects itself turns it into a page the
    // browser never navigated to, and loses the Set-Cookie the hop carried.
    const upstream = Bun.serve({
      port: 0,
      fetch: () => new Response(null, {
        status: 303,
        headers: { location: "/", "set-cookie": "eait_web=abc; Path=/start; HttpOnly" },
      }),
    });
    try {
      const app = createWebApp({
        bundlePath: new URL(`file://${bundlePath}`),
        backendOrigin: `http://127.0.0.1:${upstream.port}`,
      });
      const res = await app.fetch(new Request("http://127.0.0.1:8788/start/q"));
      expect(res.status).toBe(303);
      expect(res.headers.get("location")).toBe("/");
      expect(res.headers.get("set-cookie")).toContain("eait_web=abc");
    } finally {
      upstream.stop(true);
    }
  });

  it("still serves its own two paths, which are never the backend's", async () => {
    const app = createWebApp({
      bundlePath: new URL(`file://${bundlePath}`),
      // A port nothing is listening on: if the shell or the bundle were proxied, this throws.
      backendOrigin: "http://127.0.0.1:1",
    });
    expect((await app.fetch(new Request("http://127.0.0.1:8788/"))).status).toBe(200);
    expect((await app.fetch(new Request("http://127.0.0.1:8788/app.js"))).status).toBe(200);
    expect((await app.fetch(new Request("http://127.0.0.1:8788/health"))).status).toBe(200);
  });
});
