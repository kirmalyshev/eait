// The web APPLICATION's diary says where the weight behind today's target came from (#609).
//
// The phone syncs a weight from Apple Health on every launch and a newer one moves the target this
// page shows. The profile already carries the weight and when it was weighed; these read them back.
// What the demo server cannot be made to hold on demand — a weighing days old, no weight at all —
// is answered at the network, in the profile's own shape.
import type { Page } from "@playwright/test";
import type { DayResponse, ProfileResponse } from "@eait/shared/contract";
import { expect, test } from "./fixtures.ts";

/** The diary, drawn fresh from a profile edited on its way to the page. */
async function diaryWith(page: Page, edit: (p: ProfileResponse["profile"]) => void): Promise<void> {
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
  await page.goto("/#/");
  // `onboardFast` typed 98 kg a moment ago, which the server stamps as weighed now.
  await expect(page.getByText("Weight 98 kg, weighed today.")).toBeVisible();
  // Nothing on the server says where a weight came from, so the page does not guess.
  await expect(page.locator(".card").first()).not.toContainText("Apple Health");
});

test("an older weighing is dated in days", async ({ inWebApp: page }) => {
  await diaryWith(page, (p) => {
    p.weight_kg = 72.349;
    p.weight_measured_at = new Date(Date.now() - 3 * 86_400_000).toISOString();
  });
  await expect(page.getByText("Weight 72.3 kg, weighed 3 days ago.")).toBeVisible();
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
  // The picker is in the chrome, showing the language being read.
  await expect(page.locator("select.lang")).toHaveValue("de");
});

test("a day with a guess in it is hedged, on the headline and on the one row that is a guess (#28)", async ({ inWebApp: page }) => {
  // The rule is one number per thing and the PRECISION carries the confidence, so a guessed day
  // loses the digits it did not earn and the hedge sits immediately in front of the figure — its
  // own amber node, because the figure is not amber.
  let target = 0;
  await page.route("**/api/v1/diary/day*", async (route) => {
    const res = await route.fetch();
    const body = (await res.json()) as DayResponse;
    target = body.targets.kcal;
    body.totals.kcal = 1894;
    body.totals.guessed = true;
    // One measured row and one the analyzer could not read. Written into the RESPONSE rather than
    // logged through the API: what is under test is the rendering of a guessed row, and a demo
    // analyzer that decides its own confidence from the bytes cannot be asked for one.
    const row = (kcal: number, name: string, confidence: string) => ({
      id: crypto.randomUUID(), ts: `${body.date}T12:00:00.000Z`, date: body.date, isFood: true,
      items: [{ name, grams: 200 }], kcal, protein_g: 20, carbs_g: 50, fat_g: 10, satfat_g: 2,
      fiber_g: 3, sugar_g: 4, sodium_mg: 300, verdicts: {}, confidence, notes: "",
      corrected: false, model: "test", photos: 0,
    }) as unknown as DayResponse["meals"][number];
    body.meals = [row(712, "Kebab, chips", "low"), row(410, "Porridge, banana", "high")];
    await route.fulfill({ response: res, json: body });
  });
  await page.goto("/#/");
  await page.reload();
  // BOTH figures on the guess step, and the plan exact — 1 894 eaten reads "about 1,890", and
  // what is left of an exact plan is rounded the same way rather than to the unit.
  const n = (x: number) => new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(x);
  const step = (x: number) => Math.round(x / 10) * 10;
  await expect(page.locator(".big")).toHaveText(`about ${n(step(target - 1890))} kcal left`);
  await expect(page.locator(".big .abt")).toHaveText("about");
  await expect(page.getByText(`about ${n(1890)} of ${n(target)} kcal eaten`)).toBeVisible();
  // The row: "about 710 kcal", never "about 712" — and the measured row beside it stays silent,
  // because silence is what "read cleanly" looks like.
  await expect(page.locator(".meal-kcal").first()).toHaveText("about 710 kcal");
  await expect(page.locator(".meal-kcal").last()).toHaveText("410 kcal");
  // ONE row carries the tint and the outline, and it is that one.
  await expect(page.locator(".meal.rowsel")).toHaveCount(1);
  await expect(page.locator(".meal.rowsel .meal-name")).toHaveText("Kebab, chips");
});

test("over target says by how much, as a warning rather than a negative number", async ({ inWebApp: page }) => {
  await dayAt(page, 310);
  await expect(page.locator(".big")).toHaveText("310 kcal over");
  await expect(page.locator(".big")).toHaveClass(/warn/);
});

test("a tab change while the first draw is still loading draws one page, not two", async ({ inWebApp: page }) => {
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
