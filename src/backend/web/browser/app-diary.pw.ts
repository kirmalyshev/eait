// The web APPLICATION's diary says where the weight behind today's target came from (#609).
//
// The phone syncs a weight from Apple Health on every launch and a newer one moves the target this
// page shows. The profile already carries the weight and when it was weighed; these read them back.
// What the demo server cannot be made to hold on demand — a weighing days old, no weight at all —
// is answered at the network, in the profile's own shape.
import type { Page } from "@playwright/test";
import type { DayResponse, ProfileResponse } from "@eait/shared/contract";
import { expect, logMeal, sessionToken, test } from "./fixtures.ts";

/** The diary, drawn fresh from a profile edited on its way to the page. */
async function diaryWith(page: Page, edit: (p: ProfileResponse["profile"]) => void): Promise<void> {
  // A diary these specs may read exists only once a meal does — before any, `/#/` is the
  // first-meal flow (#42).
  await logMeal(page);
  await page.route("**/api/v1/profile", async (route) => {
    const res = await route.fetch();
    const body = (await res.json()) as ProfileResponse;
    edit(body.profile);
    await route.fulfill({ response: res, json: body });
  });
  await page.goto("/#/");
  // The profile is memoised per tab, so the edited one arrives with a fresh page.
  await page.reload();
}

test("the diary names the weight behind the target, and when it was weighed", async ({ inWebApp: page }) => {
  await logMeal(page);
  await page.goto("/#/");
  // `onboardFast` typed 98 kg a moment ago, which the server stamps as weighed now.
  await expect(page.getByText("Weight 98 kg, updated today.")).toBeVisible();
  // Nothing on the server says where a weight came from, so the page does not guess.
  await expect(page.locator(".card").first()).not.toContainText("Apple Health");
});

test("an older weighing is dated in days", async ({ inWebApp: page }) => {
  await diaryWith(page, (p) => {
    p.weight_kg = 72.349;
    p.weight_measured_at = new Date(Date.now() - 3 * 86_400_000).toISOString();
  });
  await expect(page.getByText("Weight 72.3 kg, updated 3 days ago.")).toBeVisible();
});

test("an unreadable weighing drops the date, not the diary", async ({ inWebApp: page }) => {
  await diaryWith(page, (p) => {
    p.weight_measured_at = "not a time";
  });
  await expect(page.getByText("Weight 98 kg.", { exact: true })).toBeVisible();
});

test("no weight: the diary says how to keep one current", async ({ inWebApp: page }) => {
  await diaryWith(page, (p) => {
    p.weight_kg = null;
    p.weight_measured_at = null;
  });
  await expect(
    page.getByText("Connect Apple Health in the eait iPhone app and your weight keeps this target current."),
  ).toBeVisible();
});

/** Today's diary, with what was eaten set to `target + delta` on its way to the page. */
async function dayAt(page: Page, delta: number): Promise<number> {
  // Same reason as `diaryWith`: no meal on the account and `/#/` is the first-meal flow.
  await logMeal(page);
  let target = 0;
  await page.route("**/api/v1/diary/day*", async (route) => {
    const res = await route.fetch();
    const body = (await res.json()) as DayResponse;
    target = body.targets.kcal;
    body.totals.kcal = target + delta;
    await route.fulfill({ response: res, json: body });
  });
  await page.goto("/#/");
  await page.reload();
  await expect(page.locator(".big")).toBeVisible();
  return target;
}

test("the headline is what is LEFT today, with eaten and target under it", async ({ inWebApp: page }) => {
  const target = await dayAt(page, -550);
  await expect(page.locator(".big")).toHaveText("550 kcal left");
  await expect(page.locator(".big")).not.toHaveClass(/warn/);
  // GROUPED THE READER'S WAY (#358): "1,896 of 2,446 kcal eaten" in English, "1.896 von 2.446" in
  // German. The account here is English, so the expectation is built with the same formatter the
  // page uses rather than with string interpolation — which is what it was, and what made the page
  // and the test agree only for targets under a thousand.
  const n = (x: number) => new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(x);
  await expect(page.getByText(`${n(target - 550)} of ${n(target)} kcal eaten`)).toBeVisible();
});

test("the diary is grouped and worded in the account's language, not the browser's", async ({ inWebApp: page }) => {
  // The picker writes `profile.lang` and every string on the page reads it. Asserted through the
  // PROFILE rather than through the picker, because what is being checked is that the language
  // reaches the render — the picker's own write is covered by `copy.i18n.test.ts` and by the unit
  // tests around `PATCH /v1/profile`.
  await page.route("**/api/v1/profile", async (route) => {
    const res = await route.fetch();
    const body = (await res.json()) as { profile: { lang: string } };
    body.profile.lang = "de";
    await route.fulfill({ response: res, json: body });
  });
  const target = await dayAt(page, -550);
  await expect(page.locator(".big")).toHaveText("550 kcal übrig");
  const de = (x: number) => new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(x);
  await expect(page.getByText(`${de(target - 550)} von ${de(target)} kcal gegessen`, { exact: false })).toBeVisible();
  // And the document says which language it is in, because a screen reader picks a voice from it.
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  // The picker lives on You since #52, showing the language being read — and in it.
  await page.goto("/#/you");
  await expect(page.locator("select.pick")).toHaveValue("de");
});

test("over target says by how much, as a warning rather than a negative number", async ({ inWebApp: page }) => {
  await dayAt(page, 310);
  await expect(page.locator(".big")).toHaveText("310 kcal over");
  await expect(page.locator(".big")).toHaveClass(/warn/);
});

// ── The date switcher and the macro counters (#71) ────────────────────────────────────────────

/** The full date as the page writes it, for a `YYYY-MM-DD` — midday UTC, like `dateText`. */
const fullDate = (d: string): string => new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC", weekday: "long", day: "numeric", month: "long",
}).format(new Date(`${d}T12:00:00Z`));

/** Today's `YYYY-MM-DD` on the account's own calendar — the server sends its zone in the profile. */
async function serverToday(page: Page): Promise<string> {
  const res = await page.request.get("/api/v1/profile", {
    headers: { authorization: `Bearer ${await sessionToken(page)}` },
  });
  const me = (await res.json()) as ProfileResponse;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: me.timezone, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

test("the date is written once: the switcher's name, and the date as a quiet sub-line", async ({ inWebApp: page }) => {
  await logMeal(page);
  const date = fullDate(await serverToday(page));
  await page.goto("/#/");
  const bar = page.locator(".daybar");
  await expect(bar).toBeVisible();
  await expect(bar.locator(".dayname")).toHaveText("Today");
  await expect(bar.locator(".daysub")).toHaveText(date);
  // Nowhere else on the screen repeats it.
  await expect(page.getByText(date, { exact: true })).toHaveCount(1);
});

test("the switcher walks back days; a day that is already a date shows it alone", async ({ inWebApp: page }) => {
  await logMeal(page);
  const today = await serverToday(page);
  await page.goto("/#/");
  const bar = page.locator(".daybar");
  // Chevrons at the two ends of a raised bar, the centred label between them — and no tomorrow.
  await expect(bar.locator("button.daybtn")).toHaveCount(2);
  await expect(bar.locator(".daylabel")).toHaveCSS("text-align", "center");
  await expect(page.getByRole("button", { name: "Next day" })).toBeDisabled();
  await page.getByRole("button", { name: "Previous day" }).click();
  await expect(bar.locator(".dayname")).toHaveText("Yesterday");
  await page.getByRole("button", { name: "Previous day" }).click();
  // Two days back the label is already the date, so nothing prints twice — no sub-line.
  const twoBack = new Date(`${today}T12:00:00Z`);
  twoBack.setUTCDate(twoBack.getUTCDate() - 2);
  await expect(bar.locator(".dayname")).toHaveText(fullDate(twoBack.toISOString().slice(0, 10)));
  await expect(bar.locator(".daysub")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Next day" })).toBeEnabled();
});

test("the protein and saturated-fat counters wear their tone, never plain black", async ({ inWebApp: page }) => {
  await logMeal(page);
  await page.route("**/api/v1/diary/day*", async (route) => {
    const res = await route.fetch();
    const body = (await res.json()) as DayResponse;
    body.totals.protein_g = 10; // under the target → care
    body.targets.satfat_g = 20; // declared cap
    body.totals.satfat_g = 30; // over it → bad
    await route.fulfill({ response: res, json: body });
  });
  await page.goto("/#/");
  await page.reload();
  const counters = page.locator(".macros");
  await expect(counters.locator(".macro", { hasText: "Protein" }).locator(".stat-num")).toHaveClass(/tone-care/);
  await expect(counters.locator(".macro", { hasText: "Saturated fat" }).locator(".stat-num")).toHaveClass(/tone-bad/);
});

test("protein reached is good, under a cap is good — and no 'tap a meal' caption exists", async ({ inWebApp: page }) => {
  await logMeal(page);
  await page.route("**/api/v1/diary/day*", async (route) => {
    const res = await route.fetch();
    const body = (await res.json()) as DayResponse;
    body.totals.protein_g = 9_999; // past the target → good
    body.targets.satfat_g = 40;
    body.totals.satfat_g = 5; // under the cap → good
    await route.fulfill({ response: res, json: body });
  });
  await page.goto("/#/");
  await page.reload();
  await expect(page.locator(".macros .macro", { hasText: "Protein" }).locator(".stat-num")).toHaveClass(/tone-good/);
  await expect(page.locator(".macros .macro", { hasText: "Saturated fat" }).locator(".stat-num")).toHaveClass(/tone-good/);
  // The phone's "Tap a meal to check or fix the numbers" line never existed here, and stays absent.
  await expect(page.getByText(/tap a meal/i)).toHaveCount(0);
});

test("a tab change while the first draw is still loading draws one page, not two", async ({ inWebApp: page }) => {
  // A meal first, so the draw this interrupts is the diary's rather than the first-meal flow's.
  await logMeal(page);
  // The first draw waits on the profile. A hash change in that window starts a second draw, and
  // both used to append their nav and body when they resumed: two tab bars, two screens.
  let release = () => {};
  const held = new Promise<void>((r) => { release = r; });
  await page.route("**/api/v1/profile", async (route) => {
    await held;
    await route.continue();
  });
  const asked = page.waitForRequest("**/api/v1/profile");
  await page.reload();
  await asked;
  await page.evaluate(`location.hash = "#/"`);
  release();

  await expect(page.locator(".big")).toBeVisible();
  await expect(page.locator("nav")).toHaveCount(1);
  await expect(page.locator(".body")).toHaveCount(1);
});
