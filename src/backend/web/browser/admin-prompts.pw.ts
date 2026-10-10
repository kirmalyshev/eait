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
  NOTIFICATION_PLACEHOLDERS, ONBOARDING_SCREENS, PUSH_TEMPLATE_VARIANTS, SCREEN_FIELDS, SCREEN_OPTIONS,
  notificationCopyFor, pushRowsFromCopy, screenIsOptional,
} from "@eait/shared";
import { adminPage } from "../../api/admin.page.ts";

const NONCE = "pw-nonce";

/** The policy `adminRoutes` serves the page under. Copied so a CSP violation still fails here. */
const CSP =
  `default-src 'none'; style-src 'nonce-${NONCE}'; script-src 'nonce-${NONCE}'; `
  + "connect-src 'self'; font-src 'self'; img-src data: blob:; base-uri 'none'; form-action 'none'; "
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
  { key: "route", text: "Sort the message in two words.", version: 4, source: "admin", updated_at: "2026-09-18T11:00:00.000Z", shipped: "You are the text side of a nutrition tracker." },
  { key: "text_meal", text: "You estimate from a description.", version: 1, source: "shipped", updated_at: "2026-09-18T10:00:00.000Z", shipped: "You estimate from a description." },
  { key: "text_correction", text: "You correct a meal already logged.", version: 1, source: "shipped", updated_at: "2026-09-18T10:00:00.000Z", shipped: "You correct a meal already logged." },
  { key: "coach", text: "You are Spud.", version: 1, source: "shipped", updated_at: "2026-09-18T10:00:00.000Z", shipped: "You are Spud." },
];

/** The shipped copy as the template listing the server would answer, every row reviewed. */
const PUSH_ROWS = LANGS.flatMap((lang) => pushRowsFromCopy(lang, notificationCopyFor(lang)).map((t) => ({
  ...t, status: "reviewed", reviewed_by: "migration", reviewed_at: "2026-10-08T00:00:00.000Z",
  updated_at: "2026-10-08T00:00:00.000Z",
})));
const pushListing = (rows: typeof PUSH_ROWS) => ({
  rows, langs: LANGS, meta: { placeholders: NOTIFICATION_PLACEHOLDERS },
  keys: NOTIFICATION_IDS.map((key) => ({
    key, variants: PUSH_TEMPLATE_VARIANTS[key],
    gaps: LANGS.flatMap((l) => PUSH_TEMPLATE_VARIANTS[key]
      .filter((v) => rows.find((r) => r.key === key && r.lang === l && r.variant === v)?.status !== "reviewed")
      .map((v) => `${l}/${v}`)),
  })),
});

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
  let pushRows = PUSH_ROWS;
  await page.route("**/admin/api/push-templates**", (r) => {
    if (r.request().method() === "PUT") {
      const { template, status } = r.request().postDataJSON() as { template: (typeof PUSH_ROWS)[number]; status: string };
      if (over.pushRefuse) return r.fulfill(json({ errors: [over.pushRefuse] }, 422));
      pushRows = pushRows.map((x) => x.key === template.key && x.lang === template.lang && x.variant === template.variant
        ? { ...x, title: template.title, body: template.body, status } : x);
      return r.fulfill(json({ row: template }));
    }
    return r.fulfill(json(pushListing(pushRows)));
  });
  const campaignCalls = (over.campaignCalls ?? []) as { method: string; path: string; body: unknown }[];
  let campaignKilled = false;
  const campaignRows: Record<string, unknown>[] = [
    { id: "c-1", name: "Win-back, German", templateKey: "campaign:win-back", segment: { langs: ["de"], sinceLog: ["lapsed"] }, status: "running",
      localSendTime: "18:30", rolloutPct: 40, promotional: true, createdBy: "a", createdAt: "2026-10-08T00:00:00.000Z",
      updatedAt: "2026-10-08T00:00:00.000Z", variants: 2, holdoutPct: 10,
      report: {
        sent: 120, accepted: 118, dead: 2, dry: 0, opened: 18, test: 1, held: 13,
        groups: [
          { group: "b", users: 60, opened: 9, converted: 24 },
          { group: "default", users: 60, opened: 9, converted: 18 },
          { group: "holdout", users: 13, opened: 0, converted: 2 },
        ],
      },
      effect: {
        treated: { n: 120, x: 42 }, holdout: { n: 13, x: 2 },
        comparison: { treatedRate: 0.35, holdoutRate: 2 / 13, diff: 0.35 - 2 / 13, lo: 0.07, hi: 0.3, significant: true },
      } },
    { id: "c-2", name: "Staff check", templateKey: "campaign:staff-check", segment: { staffOnly: true }, status: "draft",
      localSendTime: "09:00", rolloutPct: 100, promotional: false, createdBy: "a", createdAt: "2026-10-08T00:00:00.000Z",
      updatedAt: "2026-10-08T00:00:00.000Z", variants: 1, holdoutPct: 0,
      report: { sent: 0, accepted: 0, dead: 0, dry: 3, opened: 0, test: 0, held: 0, groups: [] }, effect: null },
  ];
  await page.route("**/admin/api/campaigns**", (r) => {
    const req = r.request();
    const path = new URL(req.url()).pathname;
    const body = req.postDataJSON?.() ?? null;
    if (req.method() !== "GET") campaignCalls.push({ method: req.method(), path, body });
    if (req.method() === "GET") {
      return r.fulfill(json({
        killed: campaignKilled, campaigns: campaignRows,
        copy: [
          { key: "campaign:staff-check", rows: [], gaps: LANGS.map((l) => `${l}/default`) },
          { key: "campaign:win-back", gaps: [], rows: LANGS.map((lang) => ({
            key: "campaign:win-back", lang, variant: "default", title: `Hi ${lang}`, body: `Body ${lang}`, status: "reviewed",
            reviewed_by: "a", reviewed_at: "2026-10-08T00:00:00.000Z", updated_at: "2026-10-08T00:00:00.000Z",
          })) },
        ],
        options: {
          langs: LANGS, variants: ["default", "b", "c", "d"], statuses: ["draft", "scheduled", "running", "paused", "done", "killed"],
          entitlement: ["active", "trial", "none"], streakBands: ["none", "building"],
          sinceLog: ["today", "recent", "lapsing", "lapsed", "never"], staffCount: 1,
        },
      }));
    }
    if (path.endsWith("/kill")) { campaignKilled = (body as { killed: boolean }).killed; return r.fulfill(json({ killed: campaignKilled })); }
    if (path.endsWith("/dry-run")) return r.fulfill(json({ ok: true, wouldSend: 3, heldOut: 1 }));
    if (path.endsWith("/test")) return r.fulfill(json({ ok: false, reason: "not-staff" }, 409));
    if (over.campaignRefuse) return r.fulfill(json({ errors: [over.campaignRefuse] }, 422));
    return r.fulfill(json({ row: campaignRows[0] }));
  });
  await page.route("**/admin/api/metrics**", (r) => r.fulfill(json({
    days: [], dailyAnalysisCap: 0, headroom: 0,
    d1: { returned: 0, eligible: 0 }, d7: { returned: 0, eligible: 0 },
    latency: { n: 0, queue: { p50: null, p95: null }, firstItem: { p50: null, p95: null }, total: { p50: null, p95: null } },
  })));
  await page.route("**/admin/api/push/stats**", (r) => r.fulfill(json({ days: 14, timezone: "UTC", rows: [] })));
  await page.route("**/admin/api/referrals**", (r) => r.fulfill(json({
    window: 7, timezone: "UTC",
    days: [{ day: new Date().toISOString().slice(0, 10), shared: 6, opened: 9, joined: 2, paid: 1 }],
    via: [{ via: "messages", shares: 4 }, { via: "web-share", shares: 2 }],
    refusals: { unknown: 6, own: 1, already: 2, paid: 1 }, sharers: 21, sharersJoined: 9,
    paidMonthly: 1, paidYearly: 0, daysGranted: 7,
  })));
  await page.route("**/admin/api/funnel**", (r) => r.fulfill(json({
    days: 30, contentVersion: 1, sessions: 0, completed: 0, rows: [],
  })));
  await page.route("**/admin/api/users**", (r) => r.fulfill(json({
    users: [], nextCursor: null, defaultFreeAnalyses: 15,
  })));
  // The grounding switches (#563): a stub with memory, so a PUT is followed by a re-read that shows it.
  const switchCalls = (over.switchCalls ?? []) as { path: string; body: unknown }[];
  const flips: { key: string; enabled: boolean; set_by: string; set_at: string }[] = [];
  const switchView = () => ({
    switches: ["grounding.photo", "grounding.text"].map((key) => {
      const last = flips.find((f) => f.key === key);
      return { key, enabled: last?.enabled ?? true, setBy: last?.set_by ?? null, setAt: last?.set_at ?? null };
    }),
    recent: flips.slice(0, 20),
  });
  await page.route("**/admin/api/switches**", (r) => {
    const req = r.request();
    if (req.method() === "PUT") {
      const path = new URL(req.url()).pathname;
      const body = req.postDataJSON() as { enabled: boolean };
      switchCalls.push({ path, body });
      flips.unshift({ key: path.split("/").pop()!, enabled: body.enabled, set_by: "admin-1", set_at: "2026-10-10T11:00:00.000Z" });
    }
    return r.fulfill(json(switchView()));
  });
  await page.route("**/admin/api/prompts/*/revisions", (r) => r.fulfill(json({
    key: "route",
    revisions: [
      { key: "route", version: 4, source: "admin", text: "Name the plate in five words.", updated_at: "2026-09-18T11:00:00.000Z" },
      { key: "route", version: 1, source: "shipped", text: "You are the text side of a nutrition tracker.", updated_at: "2026-09-18T10:00:00.000Z" },
    ],
  })));
  await page.route("**/admin/api/prompts", (r) => {
    if (r.request().method() === "PUT") return r.fulfill((over.put as never) ?? json({ key: "route", version: 5 }));
    return r.fulfill(json({ prompts: PROMPTS }));
  });
}

/** The panel lives behind the gate and then behind a route, so every test waits to be let in and opens its view. */
async function openAdmin(page: import("@playwright/test").Page, view: string) {
  await page.goto(`/admin#${view}`);
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
  await openAdmin(page, "prompts");

  const panel = page.locator("#prompts");
  // Five prompts — the glance was retired in #216 and PROMPT_KEYS no longer carries it.
  await expect(panel.locator(".card")).toHaveCount(5);

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

test("the food database switches show the default, PUT a flip, and re-render from the re-read", async ({ page }) => {
  const errors = watchConsole(page);
  const switchCalls: { path: string; body: unknown }[] = [];
  await stubAdmin(page, { switchCalls });
  await openAdmin(page, "food");

  const photo = page.locator('#switches [data-switch="grounding.photo"]');
  const text = page.locator('#switches [data-switch="grounding.text"]');
  await expect(photo.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  await expect(photo).toContainText("default");
  await expect(text).toContainText("default");

  await photo.getByRole("switch").click();
  await expect(photo.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  await expect(photo).toContainText(/changed by admin-1 at \d+ \w{3} \d\d:\d\d/);
  // The other switch is untouched, and the flip is listed.
  await expect(text).toContainText("default");
  await expect(page.locator("#switch-recent")).toContainText("Photo off");
  expect(switchCalls).toEqual([{ path: "/admin/api/switches/grounding.photo", body: { enabled: false } }]);
  expect(errors).toEqual([]);
});

test("History opens the revisions, newest first, with the whole text of each", async ({ page }) => {
  const errors = watchConsole(page);
  await stubAdmin(page);
  await openAdmin(page, "prompts");

  const card = page.locator("#prompts .card").filter({ hasText: "route" }).first();
  await card.getByRole("button", { name: "History" }).click();

  const history = page.locator("#prompt-history");
  await expect(history.getByText("version 4", { exact: true })).toBeVisible();
  await expect(history.getByText(/shipped · /)).toBeVisible();
  // The append-only table's whole point: the superseded text is still readable.
  await history.locator("details").last().locator("summary").click();
  await expect(history.getByText("You are the text side of a nutrition tracker.")).toBeVisible();
  expect(errors).toEqual([]);
});

test("saving asks first, and an unchanged prompt is not a save at all", async ({ page }) => {
  const errors = watchConsole(page);
  await stubAdmin(page);
  await openAdmin(page, "prompts");

  const card = page.locator("#prompts .card").filter({ hasText: "route" }).first();
  // Untouched: the button refuses without a dialog, because there is nothing to confirm.
  await card.getByRole("button", { name: "Save route" }).click();
  await expect(card.getByText("no change")).toBeVisible();

  // Changed: it confirms, and says what a save costs — every analysis after it.
  let asked = "";
  page.on("dialog", (d) => { asked = d.message(); void d.accept(); });
  await card.locator("textarea").fill("Two words, no more.");
  await card.getByRole("button", { name: "Save route" }).click();
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
  await openAdmin(page, "prompts");

  page.on("dialog", (d) => void d.accept());
  const card = page.locator("#prompts .card").filter({ hasText: "route" }).first();
  await card.locator("textarea").fill("Two words, no more.");
  await card.getByRole("button", { name: "Save route" }).click();

  await expect(card.getByText(/somebody else saved this prompt a moment ago/)).toBeVisible();
  await expect(page.locator("#prompt-errors")).toHaveClass(/hidden/);
  expect(errors).toEqual([]);
});

test("the push grid lists every key x language, edits a cell, and shows the gate's refusal", async ({ page }) => {
  const errors = watchConsole(page, /Failed to load resource/);
  await stubAdmin(page, { pushRefuse: 'body: "Guaranteed weight loss" is a guarantee claim' });
  await openAdmin(page, "templates");

  const grid = page.locator("#push-grid");
  await page.locator("#push-f-all").click();
  // trial-end, evening x2, nudge, and three triggers x four variants: sixteen rows of eight reviewed cells, every key sendable.
  await expect(grid.locator("tr")).toHaveCount(17);
  await expect(grid.locator("button.cell.reviewed")).toHaveCount(128);
  await expect(grid.getByText("sendable")).toHaveCount(6);

  await grid.locator("tr").filter({ hasText: "nudge" }).locator("button.cell").nth(0).click();
  const edit = page.locator("#push-edit");
  await expect(edit.locator("textarea")).toHaveValue(/Log what you ate today/);
  await edit.locator("textarea").fill("Guaranteed weight loss");
  await edit.getByRole("button", { name: "Save as reviewed" }).click();
  await expect(page.locator("#push-errors")).toBeVisible();
  await expect(page.locator("#push-errors")).toContainText("guarantee claim");
  expect(errors).toEqual([]);
});

test("a draft turns its key into blocked", async ({ page }) => {
  const errors = watchConsole(page);
  await stubAdmin(page);
  await openAdmin(page, "templates");
  await page.locator("#push-f-all").click();
  const row = page.locator("#push-grid tr").filter({ hasText: "nudge" });
  await row.locator("button.cell").nth(7).click(); // ru
  await page.locator("#push-edit").getByRole("button", { name: "Save as draft" }).click();
  await expect(page.locator("#push-grid").getByText("blocked: 1 missing")).toBeVisible();
  await expect(row.locator("button.cell.draft")).toHaveCount(1);
  expect(errors).toEqual([]);
});

for (const [name, width, height] of [["390", 390, 844], ["1440", 1440, 900]] as const) {
  test(`food database panel at ${name}px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await stubAdmin(page);
    await openAdmin(page, "food");
    const panel = page.locator("#switches");
    await panel.getByRole("switch").first().click();
    await expect(panel.locator('[aria-checked="false"]')).toHaveCount(1);
    await panel.evaluate((el) => el.scrollIntoView({ block: "center" }));
    // The page as a whole may scroll for other panels; this one must not.
    for (const id of ["#switches", "#switch-recent"]) {
      expect(await page.locator(id).evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    }
    await page.screenshot({ path: `/tmp/fd563-switches-${name}.png` });
  });
}

for (const [name, width, height] of [["390", 390, 844], ["1440", 1440, 900]] as const) {
  test(`push templates panel at ${name}px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await stubAdmin(page);
    await openAdmin(page, "templates");
    await page.locator("#push-f-all").click();
    await page.locator("#push-grid tr").filter({ hasText: "evening / empty" }).locator("button.cell").nth(3).click();
    await page.locator("#push-grid").evaluate((el) => el.scrollIntoView({ block: "start" }));
    await page.screenshot({ path: `/tmp/p2-push-admin-${name}.png` });
  });
}

test("the campaigns panel lists campaigns, creates a draft from the form, and says what a refusal was", async ({ page }) => {
  const errors = watchConsole(page, /422/);
  const calls: { method: string; path: string; body: unknown }[] = [];
  await stubAdmin(page, { campaignCalls: calls });
  await openAdmin(page, "campaigns");
  const list = page.locator("#camp-list");
  const detail = page.locator("#camp-detail");
  await expect(list.locator("button")).toHaveCount(2);
  await expect(detail.getByText("lang: de")).toBeVisible();
  await expect(detail.getByText("last log: lapsed")).toBeVisible();
  await expect(detail.getByText("promotional")).toBeVisible();
  await expect(detail).toContainText("2 arms · 10% held out");
  const arms = detail;
  await expect(arms.locator("tr").filter({ hasText: "holdout (not sent)" })).toContainText("13");
  await expect(arms.locator("tr").filter({ hasText: /^default/ })).toContainText("30%");
  await expect(arms).toContainText("Treated minus holdout conversion: 19.6 pts (95% CI 7.0 pts to 30.0 pts) — the interval excludes zero.");
  await expect(page.getByRole("button", { name: "Stop all campaigns" })).toBeVisible();

  await page.getByRole("button", { name: "New campaign" }).click();
  await page.locator("#campaign-form input[placeholder=Name]").fill("Spring");
  await page.locator("#campaign-form input[placeholder='campaign:spring-win-back']").fill("campaign:spring");
  await page.locator('#campaign-form [data-name=langs] input[value=fr]').check();
  await page.locator('#campaign-form [data-name=staffOnly]').getByRole("button", { name: "yes" }).click();
  await page.locator("#campaign-form input[type=number]").nth(1).fill("3");
  await page.locator("#campaign-form input[type=number]").nth(2).fill("5");
  await page.getByRole("button", { name: "Create draft" }).click();
  await expect.poll(() => calls.find((c) => c.method === "POST" && c.path === "/admin/api/campaigns")).toBeTruthy();
  expect(calls.find((c) => c.path === "/admin/api/campaigns")!.body).toMatchObject({
    name: "Spring", templateKey: "campaign:spring", segment: { langs: ["fr"], staffOnly: true }, localSendTime: "18:30", rolloutPct: 10, promotional: true, variants: 3, holdoutPct: 5,
  });

  await list.getByRole("button", { name: /Staff check/ }).click();
  await detail.getByRole("button", { name: "More actions" }).click();
  await detail.getByRole("button", { name: "Dry run" }).click();
  await expect(detail).toContainText("Dry run: would reach 3 account(s), hold out 1. Nothing was sent.");

  await list.getByRole("button", { name: /Win-back/ }).click();
  await detail.getByRole("button", { name: "More actions" }).click();
  await detail.getByRole("button", { name: "Test send" }).click();
  await page.locator("#confirm-input").fill("staff-1");
  await page.locator("#confirm").getByRole("button", { name: "Test send" }).click();
  await expect(page.locator("#campaign-errors")).toContainText("not-staff");
  expect(errors.filter((e) => !/409/.test(e))).toEqual([]);
});

test("the campaign copy editor loads a saved language and saves a draft and a reviewed row", async ({ page }) => {
  const errors = watchConsole(page);
  const calls: { method: string; path: string; body: unknown }[] = [];
  await stubAdmin(page, { campaignCalls: calls });
  await page.route("**/admin/api/push-templates", (r) => r.request().method() === "PUT"
    ? (calls.push({ method: "PUT", path: "/admin/api/push-templates", body: r.request().postDataJSON() }), r.fulfill({ status: 200, contentType: "application/json", body: "{\"row\":{}}" }))
    : r.fallback());
  await openAdmin(page, "templates");
  await expect(page.locator("#campaign-copy tbody tr")).toHaveCount(2);
  await expect(page.locator("#campaign-copy")).toContainText("campaign:win-back");
  await expect(page.locator("#campaign-copy")).toContainText("complete");
  await expect(page.locator("#campaign-copy")).toContainText("en/default, fr/default");
  await page.getByRole("button", { name: "New campaign copy" }).click();
  const form = page.locator("#campaign-copy-form");
  await form.locator("input[placeholder='campaign:spring-win-back']").fill("campaign:win-back");
  await form.locator("select").nth(0).selectOption("de");
  await form.locator("select").nth(1).selectOption("b");
  await form.locator("input[placeholder='campaign:spring-win-back']").dispatchEvent("change");
  await expect(form.locator("input[placeholder=Title]")).toHaveValue("");
  await form.locator("select").nth(1).selectOption("default");
  await expect(form.locator("input[placeholder=Title]")).toHaveValue("Hi de");
  await form.locator("select").nth(1).selectOption("b");
  await form.locator("input[placeholder=Title]").fill("Hallo");
  await form.locator("textarea").fill("Ein Satz für alle.");
  await form.getByRole("button", { name: "Save as reviewed" }).click();
  await expect.poll(() => calls.find((c) => c.method === "PUT")).toBeTruthy();
  expect(calls.find((c) => c.method === "PUT")!.body).toEqual({
    template: { key: "campaign:win-back", lang: "de", variant: "b", title: "Hallo", body: "Ein Satz für alle." }, status: "reviewed",
  });
  expect(errors).toEqual([]);
});

test("the campaigns panel stops everything behind a confirm, and a 422 is shown in its box", async ({ page }) => {
  const errors = watchConsole(page, /42[22]/);
  const calls: { method: string; path: string; body: unknown }[] = [];
  await stubAdmin(page, { campaignCalls: calls, campaignRefuse: "unknown predicate: sql" });
  await openAdmin(page, "campaigns");
  await page.getByRole("button", { name: "Stop all campaigns" }).click();
  await page.locator("#confirm").getByRole("button", { name: "Stop all campaigns" }).click();
  await expect(page.locator("#campaigns-state")).toContainText("All campaigns are stopped");
  await expect(page.getByRole("button", { name: "Resume all campaigns" })).toBeVisible();
  await page.getByRole("button", { name: "New campaign" }).click();
  await page.getByRole("button", { name: "Create draft" }).click();
  await expect(page.locator("#campaign-errors")).toContainText("unknown predicate: sql");
  expect(errors).toEqual([]);
});

for (const [name, width, height] of [["390", 390, 844], ["1440", 1440, 900]] as const) {
  test(`campaigns panel at ${name}px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await stubAdmin(page);
    await openAdmin(page, "campaigns");
    await expect(page.locator("#camp-list button")).toHaveCount(2);
    // The page never scrolls sideways, and Kill is one click inside the menu.
    expect(await page.locator("html").evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.locator("#camp-detail").getByRole("button", { name: "More actions" }).click();
    await expect(page.locator("#camp-detail").getByRole("button", { name: "Kill" })).toBeVisible();
    await page.screenshot({ path: `/tmp/p5-campaigns-admin-${name}.png` });
    await page.locator("#campaign-form").evaluate((el) => el.scrollIntoView({ block: "start" }));
    await page.screenshot({ path: `/tmp/p5-campaigns-admin-form-${name}.png` });
  });
}

// #899: the Operate view after Campaigns — four counts, the days, the channels, the refusals.
test("the referrals view draws the counts the server sent and names nobody", async ({ page }) => {
  const errors = watchConsole(page);
  await stubAdmin(page);
  await openAdmin(page, "referrals");
  const kpis = page.locator("#referrals-kpi");
  await expect(kpis).toContainText("Shared · 7 days");
  await expect(kpis).toContainText("1.5 per share");
  await expect(kpis).toContainText("22% of opens · a week each");
  await expect(kpis).toContainText("1 monthly · 0 yearly · 1 week to referrers");
  await expect(page.locator("#referrals-days tbody tr")).toHaveCount(7);
  await expect(page.locator("#referrals-days tfoot")).toContainText("7 days");
  await expect(page.locator("#referrals-via")).toContainText("Browser share sheet");
  await expect(page.locator("#referrals-refused tr").filter({ hasText: "No such link" })).toContainText("6");
  await expect(page.locator("#referrals-refused tr").filter({ hasText: "Had already paid" })).toContainText("1");
  await expect(page.locator("#referrals-sharers")).toContainText("… with a friend who joined");
  expect(errors).toEqual([]);
});
