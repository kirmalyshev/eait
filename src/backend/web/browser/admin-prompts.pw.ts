// The prompts panel in /admin, driven in a real browser.
//
// WHY THIS FILE EXISTS AT ALL: the admin page is one TypeScript template literal, so `tsc` never
// looks inside its script and `bun test` never runs it. Every other gate this repo has is blind to
// a `null` dereference in that code. The panel it now carries edits the text a MODEL is sent, which
// is the last surface here that should ship on the strength of "it looked right in the diff".
//
// IT DOES NOT SIGN IN. Reaching /admin for real needs an Apple or Google round trip and an account
// holding the role, which is the app's e2e problem and not this panel's. The page is served without
// a credential — it is where you sign in — so the markup and its script are fetched from the real
// server, and only the four `/admin/api/*` calls are answered here. What is under test is the code
// in the page: does it render six cards from a response, does it read `source`, does History open,
// does a 409 land beside the button instead of in the error box. Those are exactly the things the
// unit tests on the routes cannot see.

import { expect, test } from "@playwright/test";

const PROMPTS = [
  { key: "analysis", text: "You estimate the nutritional content of a meal from photographs.", version: 1, source: "shipped", updated_at: "2026-09-18T10:00:00.000Z", shipped: "You estimate the nutritional content of a meal from photographs." },
  { key: "route", text: "You are the text side of a nutrition tracker.", version: 1, source: "shipped", updated_at: "2026-09-18T10:00:00.000Z", shipped: "You are the text side of a nutrition tracker." },
  { key: "text_meal", text: "You estimate from a description.", version: 1, source: "shipped", updated_at: "2026-09-18T10:00:00.000Z", shipped: "You estimate from a description." },
  { key: "text_correction", text: "You correct a meal already logged.", version: 1, source: "shipped", updated_at: "2026-09-18T10:00:00.000Z", shipped: "You correct a meal already logged." },
  { key: "glance", text: "Name the plate in five words.", version: 4, source: "admin", updated_at: "2026-09-18T11:00:00.000Z", shipped: "You name what is on the plate." },
  { key: "coach", text: "You are Gabie.", version: 1, source: "shipped", updated_at: "2026-09-18T10:00:00.000Z", shipped: "You are Gabie." },
];

/** Answer the page's own calls, and hand it a bearer so it gets past `enter()`. */
async function stubAdmin(page: import("@playwright/test").Page, over: Record<string, unknown> = {}) {
  const json = (body: unknown, status = 200) =>
    ({ status, contentType: "application/json", body: JSON.stringify(body) });

  await page.route("**/start/session/token", (r) => r.fulfill(json({ token: "pw-not-a-real-bearer" })));
  await page.route("**/admin/api/content", (r) => r.fulfill(json({
    content: { version: 1, welcome: { title: "", lines: [] }, asks: {}, building: {}, summary: {} },
    meta: { screens: [] },
  })));
  await page.route("**/admin/api/notifications", (r) => r.fulfill(json({ copy: {}, meta: { ids: [], placeholders: {} } })));
  await page.route("**/admin/api/metrics**", (r) => r.fulfill(json({ days: [] })));
  await page.route("**/admin/api/funnel**", (r) => r.fulfill(json({ sessions: 0, completed: 0, rows: [] })));
  await page.route("**/admin/api/users**", (r) => r.fulfill(json({ users: [], total: 0 })));
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

/** Console errors are a failure, not noise: this page has no build step to catch them first. */
function watchConsole(page: import("@playwright/test").Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  return errors;
}

test("the panel renders one card per prompt, and says who wrote each", async ({ page }) => {
  const errors = watchConsole(page);
  await stubAdmin(page);
  await page.goto("/admin");

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
  await page.goto("/admin");

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
  await page.goto("/admin");

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
  const errors = watchConsole(page);
  // A lost race is not a rejected prompt: the words were fine and somebody else got there first.
  // It has to appear next to the button that must be pressed again, not in a box at the top of a
  // page the person has scrolled away from.
  await stubAdmin(page, {
    put: { status: 409, contentType: "application/json", body: JSON.stringify({ errors: ["somebody else saved this prompt a moment ago — reload it and apply your change on top"] }) },
  });
  await page.goto("/admin");

  page.on("dialog", (d) => void d.accept());
  const glance = page.locator("#prompts .card").filter({ hasText: "glance" }).first();
  await glance.locator("textarea").fill("Two words, no more.");
  await glance.getByRole("button", { name: "Save glance" }).click();

  await expect(glance.getByText(/somebody else saved this prompt a moment ago/)).toBeVisible();
  await expect(page.locator("#prompt-errors")).toHaveClass(/hidden/);
  expect(errors).toEqual([]);
});
