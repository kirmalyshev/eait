// The browser suite for the WEB app — `/start`, its sign-in and its chat.
//
// It is the web's counterpart to Maestro: the flows there drive the iPhone app, and nothing drove
// this surface in a real browser at all. It runs on Linux, which the simulator suite cannot, so it
// is the only end-to-end coverage this repo has that a laptop without Xcode can produce.
//
// TWO MODES, ONE ENTRY POINT. `EAIT_WEB_E2E_LLM=demo` (the default) starts the backend with the
// canned model: every assertion is then about this product — the routing, the rendering, the
// scoping, the refusals — and is deterministic enough to gate on. `EAIT_WEB_E2E_LLM=real` starts
// the same server with `--llm real`, and the specs tagged `@model` are the ones that only mean
// something there: whether the coach stays on topic, refuses medical advice, and holds its
// instructions against somebody trying to talk it out of them. Those calls are BILLED.
//
// `channel: "chrome"` uses the Chrome already on the machine rather than downloading a browser.

import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.EAIT_WEB_E2E_PORT ?? 8899);
const MODE = process.env.EAIT_WEB_E2E_LLM === "real" ? "real" : "demo";
const BASE = `http://localhost:${PORT}`;
// The web APPLICATION (#423) is its own process, on the next port. It forwards everything it does
// not serve itself — `/start`, `/api` — to the backend above, the way the edge does in production,
// so a spec driving it reaches the API through one origin exactly as a browser does.
const APP_PORT = PORT + 1;
const APP = `http://localhost:${APP_PORT}`;
// And the backend BEHIND it is a deployment that HAS a web application (`publicWebUrl` set), which is
// what production is and what the one above deliberately is not: `/start/chat` sends people to the
// web application's chat there (#499), and keeps its own page here, where `chat.pw.ts` drives it.
const APP_BACKEND_PORT = PORT + 2;

export default defineConfig({
  testDir: "./backend/web/browser",
  // NOT `*.spec.ts` or `*.test.ts`: bun's own runner claims both, and `bun test ./backend`
  // would then try to run these as unit tests and fail on the first `page` fixture.
  testMatch: /.*\.pw\.ts$/,
  // PARALLEL, and safe to be: one server holds every test, but each test signs in as its OWN
  // subject, so the accounts they touch are disjoint — the only shared state is the store's own
  // sequence counter, which nothing asserts on. The demo config's rate limits are effectively
  // unbounded, so workers do not throttle each other.
  //
  // Fewer workers against a REAL model, deliberately: those turns are billed and go to one
  // provider, and twenty concurrent completions is a way to meet its rate limit rather than a way
  // to finish sooner. `EAIT_WEB_E2E_WORKERS` overrides both.
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  // THE `@model` SPECS DO NOT RUN AGAINST THE DEMO MODEL AT ALL (#297). A `test.skip` inside the
  // body still paid for the `signedIn` fixture first: six sign-ins per demo run for nothing, all of
  // them in the cold start where the one unexplained fixture timeout happened.
  grepInvert: MODE === "real" ? undefined : /@model/,
  workers: Number(process.env.EAIT_WEB_E2E_WORKERS ?? (MODE === "real" ? 3 : 6)),
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  // A real model takes seconds per turn, and a billed timeout is worse than a slow test.
  timeout: MODE === "real" ? 180_000 : 30_000,
  expect: { timeout: MODE === "real" ? 90_000 : 10_000 },
  use: {
    baseURL: BASE,
    ...devices["Desktop Chrome"],
    channel: "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    // `/start` and its forms, served by the backend on its own port.
    { name: "start", testIgnore: /\/app-[^/]*\.pw\.ts$/ },
    // The web application at `/` (#493), on ITS origin. Anchored to the file name: a worktree path
    // may itself contain "app-".
    { name: "app", testMatch: /\/app-[^/]*\.pw\.ts$/, use: { baseURL: APP } },
  ],
  webServer: [{
    // ONE ENTRY POINT, the mode named on it. `--demo` is the in-memory store and the demo sign-in;
    // `--llm` decides only which answers come back.
    command: `bun backend/index.ts --demo --llm ${MODE}`,
    url: `${BASE}/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      EAIT__BACKEND__PORT: String(PORT),
      EAIT__BACKEND__HOST: "127.0.0.1",
      // THIS SUITE DRIVES THE BACKEND ALONE, so it says so.
      //
      // bun loads `.env` from the working directory, and since #423 `make env` writes this
      // worktree's WEB APPLICATION port into it — a different application on a different port.
      // Inherited here, the backend would answer every `/start` navigation with a 301 to that port,
      // where nothing this suite started is listening. Empty means "the browser's origin is my own",
      // which is what a single server on 8899 is.
      EAIT__BACKEND__PUBLIC_WEB_URL: "",
    },
  }, {
    // The `app` project's backend: the same demo server, told the web application is its browser origin.
    command: `bun backend/index.ts --demo --llm ${MODE}`,
    url: `http://localhost:${APP_BACKEND_PORT}/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      EAIT__BACKEND__PORT: String(APP_BACKEND_PORT),
      EAIT__BACKEND__HOST: "127.0.0.1",
      EAIT__BACKEND__PUBLIC_WEB_URL: APP,
    },
  }, {
    // BUILT FIRST: with no bundle on disk the shell answers 404, by design (`server/index.ts`).
    command: "bun run --cwd web build && bun web/server/index.ts",
    url: `${APP}/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      EAIT__WEB__PORT: String(APP_PORT),
      EAIT__WEB__HOST: "127.0.0.1",
      EAIT__WEB__BACKEND_ORIGIN: `http://127.0.0.1:${APP_BACKEND_PORT}`,
    },
  }],
});
