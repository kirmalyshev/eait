// The prompts panel in /admin, driven in a real browser.
//
// WHY THIS FILE EXISTS AT ALL: the admin page is one TypeScript template literal, so `tsc` never
// looks inside its script and `bun test` never runs it. Every other gate this repo has is blind to
// a `null` dereference in that code. The panel it now carries edits the text a MODEL is sent, which
// is the last surface here that should ship on the strength of "it looked right in the diff".
//
// IT SERVES THE PAGE ITSELF rather than asking the server for it, and that is not a shortcut around
// the auth — it is what makes the test about the panel. Reaching /admin for real needs an account
// holding the role, and the demo server this suite runs against has none, so the route answers 404
// exactly as it would on an instance where nobody is an admin. Fulfilling the navigation with
// `adminPage()` puts the REAL markup and the REAL script in a real browser, under the REAL
// content-security-policy, and leaves only the `/admin/api/*` answers to this file. What is under
// test is the page's own JavaScript: does it render a card per prompt, does it read `source`, does
// History open, does a 409 land beside the button instead of in the error box.
//
// The stubs answer with the SHIPPED defaults where there are any, because `render()` runs before
// the prompts panel does and a shape it cannot read would leave the gate shut and every assertion
// below timing out against a hidden page — which is how the first version of this file failed.

import { expect, test } from "@playwright/test";
import {
  DEFAULT_NOTIFICATION_COPY, DEFAULT_ONBOARDING_CONTENT, LANGS, LANG_LABEL, NOTIFICATION_IDS,
  NOTIFICATION_PLACEHOLDERS, ONBOARDING_SCREENS, SCREEN_FIELDS, SCREEN_OPTIONS, screenIsOptional,
} from "@eait/shared";
import { adminPage } from "../../api/admin.page.ts";

const NONCE = "pw-nonce";

/** The policy `adminRoutes` serves the page under. Copied so a CSP violation still fails here. */
const CSP =
  `default-src 'none'; style-src 'nonce-${NONCE}'; script-src 'nonce-${NONCE}'; `
  + "connect-src 'self'; img-src data: blob:; base-uri 'none'; form-action 'none'; "
  + "frame-ancestors 'none'";

/** `editorMeta()` in `api/admin.ts`, which is not exported. Same constants, same shape. */
const EDITOR_META = {
  screens: ONBOARDING_SCREENS.map((id) => ({
    id,
    optional: screenIsOptional(id),
    fields: SCREEN_FIELDS[id],
    options: SCREEN_OPTIONS[id as keyof typeof SCREEN_OPTIONS] ?? [],
  })),
};

const PROMPTS = [
  { key: "analysis", text: "You estimate the nutritional content of a meal from photographs.", version: 1, source: "shipped", updated_at: "2026-09-18T10:00:00.000Z", shipped: "You estimate the nutritional content of a meal from photographs." },
  { key: "route", text: "You are the text side of a nutrition tracker.", version: 1, source: "shipped", updated_at: "2026-09-18T10:00:00.000Z", shipped: "You are the text side of a nutrition tracker." },
  { key: "text_meal", text: "You estimate from a description.", version: 1, source: "shipped", updated_at: "2026-09-18T10:00:00.000Z", shipped: "You estimate from a description." },
  { key: "text_correction", text: "You correct a meal already logged.", version: 1, source: "shipped", updated_at: "2026-09-18T10:00:00.000Z", shipped: "You correct a meal already logged." },
  { key: "glance", text: "Name the plate in five words.", version: 4, source: "admin", updated_at: "2026-09-18T11:00:00.000Z", shipped: "You name what is on the plate." },
  { key: "coach", text: "You are Gabie.", version: 1, source: "shipped", updated_at: "2026-09-18T10:00:00.000Z", shipped: "You are Gabie." },
];

/** Serve the real page, and answer the calls it makes on the way up. */
async function stubAdmin(page: import("@playwright/test").Page, over: Record<string, unknown> = {}) {
  const json = (body: unknown, status = 200) =>
    ({ status, contentType: "application/json", body: JSON.stringify(body) });

  // Most-recently-registered wins in Playwright, so the document route goes on FIRST: `**/admin`
  // ends at /admin and cannot swallow /admin/api/... , but registering it last would still put it
  // ahead of the API routes for any URL both matched.
  await page.route("**/admin", (r) => r.fulfill({
    status: 200,
    contentType: "text/html; charset=utf-8",
    headers: { "content-security-policy": CSP },
    body: adminPage(NONCE),
  }));

  await page.route("**/start/session/token", (r) => r.fulfill(json({ token: "pw-not-a-real-bearer" })));
  // TRAILING `**` ON BOTH, like the metrics and funnel stubs below: the copy routes carry `?lang=`
  // since #358, and a glob that ends at the path stops matching the moment a query is added — which
  // reads on this page as "that account cannot administer this instance", because the throw lands
  // inside `load` and `enter` catches it.
  await page.route("**/admin/api/content**", (r) => r.fulfill(json({
    content: DEFAULT_ONBOARDING_CONTENT,
    lang: "en",
    langs: LANGS,
    labels: LANG_LABEL,
    meta: EDITOR_META,
  })));
  await page.route("**/admin/api/notifications**", (r) => r.fulfill(json({
    copy: DEFAULT_NOTIFICATION_COPY,
    lang: "en",
    meta: { ids: NOTIFICATION_IDS, placeholders: NOTIFICATION_PLACEHOLDERS },
  })));
  await page.route("**/admin/api/metrics**", (r) => r.fulfill(json({
    days: [], dailyAnalysisCap: 0, headroom: 0,
    d1: { returned: 0, eligible: 0 }, d7: { returned: 0, eligible: 0 },
  })));
  await page.route("**/admin/api/funnel**", (r) => r.fulfill(json({
    days: 30, contentVersion: 1, sessions: 0, completed: 0, rows: [],
  })));
  await page.route("**/admin/api/users**", (r) => r.fulfill(json({
    users: [], nextCursor: null, defaultFreeAnalyses: 15,
  })));
  await page.route("**/admin/api/prompts/*/revisions", (r) => r.fulfill(json({
    key: "glance",
    revisions: [
      { key: "glance", version: 4, source: "admin", text: "Name the plate in five words.", updated_at: "2026-09-18T11:00:00.000Z" },
      { key: "glance", version: 1, source: "shipped", text: "You name what is on the plate.", updated_at: "2026-09-18T10:00:00.000Z" },
    ],
  })));
  await page.route("**/admin/api/prompts", (r) => {
    if (r.request().method() === "PUT") return r.fulfill((over.put as never) ?? json({ key: "glance", version: 5 }));
    return r.fulfill(json({ prompts: PROMPTS }));
  });
}

/** The panel lives behind the gate, so every test waits for the page to be let in first. */
async function openAdmin(page: import("@playwright/test").Page) {
  await page.goto("/admin");
  await expect(page.locator("#app")).toBeVisible();
}

/**
 * Console errors are a failure, not noise: this page has no build step to catch them first.
 *
 * `allow` exists for ONE thing, and it is not a general escape hatch: a test that deliberately
 * stubs a non-2xx answer makes Chrome log the response itself ("Failed to load resource: … 409"),
 * which is the browser reporting the fixture rather than the page misbehaving. Anything the PAGE
 * throws is still counted, because `pageerror` is never filtered.
 */
function watchConsole(page: import("@playwright/test").Page, allow?: RegExp): string[] {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    if (allow && allow.test(m.text())) return;
    errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));
  return errors;
}

test("the panel renders one card per prompt, and says who wrote each", async ({ page }) => {
  const errors = watchConsole(page);
  await stubAdmin(page);
  await openAdmin(page);

  const panel = page.locator("#prompts");
  await expect(panel.locator(".card")).toHaveCount(6);

  // The shipped ones say a deploy keeps them current.
  await expect(panel.getByText("shipped — version 1. A deploy keeps this current.").first()).toBeVisible();
  // The edited one says the opposite, and warns that the build has moved on without it — the one
  // fact an owner of a prompt cannot otherwise discover.
  await expect(panel.getByText(/yours — version 4/)).toBeVisible();
  await expect(panel.getByText(/The build has since shipped different text/)).toBeVisible();

  // The text is editable, not a rendering of it.
  await expect(panel.locator("textarea").first()).toHaveValue(/You estimate the nutritional content/);
  expect(errors).toEqual([]);
});

test("History opens the revisions, newest first, with the whole text of each", async ({ page }) => {
  const errors = watchConsole(page);
  await stubAdmin(page);
  await openAdmin(page);

  const glance = page.locator("#prompts .card").filter({ hasText: "glance" }).first();
  await glance.getByRole("button", { name: "History" }).click();

  await expect(glance.getByText(/version 4 — admin/)).toBeVisible();
  await expect(glance.getByText(/version 1 — shipped/)).toBeVisible();
  // The append-only table's whole point: the superseded text is still readable.
  await glance.locator("details").last().click();
  await expect(glance.getByText("You name what is on the plate.")).toBeVisible();
  expect(errors).toEqual([]);
});

test("saving asks first, and an unchanged prompt is not a save at all", async ({ page }) => {
  const errors = watchConsole(page);
  await stubAdmin(page);
  await openAdmin(page);

  const glance = page.locator("#prompts .card").filter({ hasText: "glance" }).first();
  // Untouched: the button refuses without a dialog, because there is nothing to confirm.
  await glance.getByRole("button", { name: "Save glance" }).click();
  await expect(glance.getByText("no change")).toBeVisible();

  // Changed: it confirms, and says what a save costs — every analysis after it.
  let asked = "";
  page.on("dialog", (d) => { asked = d.message(); void d.accept(); });
  await glance.locator("textarea").fill("Two words, no more.");
  await glance.getByRole("button", { name: "Save glance" }).click();
  await expect.poll(() => asked).toContain("Every analysis after this is asked the new text");
  expect(errors).toEqual([]);
});

test("a 409 lands beside the button, not in the page's error box", async ({ page }) => {
  // The stubbed 409 is logged by the browser as a failed resource, which is the fixture and not a
  // defect. Everything else still counts, and a page-level throw counts whatever it says.
  const errors = watchConsole(page, /Failed to load resource/);
  // A lost race is not a rejected prompt: the words were fine and somebody else got there first.
  // It has to appear next to the button that must be pressed again, not in a box at the top of a
  // page the person has scrolled away from.
  await stubAdmin(page, {
    put: { status: 409, contentType: "application/json", body: JSON.stringify({ errors: ["somebody else saved this prompt a moment ago — reload it and apply your change on top"] }) },
  });
  await openAdmin(page);

  page.on("dialog", (d) => void d.accept());
  const glance = page.locator("#prompts .card").filter({ hasText: "glance" }).first();
  await glance.locator("textarea").fill("Two words, no more.");
  await glance.getByRole("button", { name: "Save glance" }).click();

  await expect(glance.getByText(/somebody else saved this prompt a moment ago/)).toBeVisible();
  await expect(page.locator("#prompt-errors")).toHaveClass(/hidden/);
  expect(errors).toEqual([]);
});
