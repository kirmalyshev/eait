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
  await expect(page.getByText(`${target - 550} of ${target} kcal eaten`)).toBeVisible();
});

test("over target says by how much, as a warning rather than a negative number", async ({ inWebApp: page }) => {
  await dayAt(page, 310);
  await expect(page.locator(".big")).toHaveText("310 kcal over");
  await expect(page.locator(".big")).toHaveClass(/warn/);
});
