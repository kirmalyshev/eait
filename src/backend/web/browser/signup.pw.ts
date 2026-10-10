// The S8 flow, driven the way a person drives it — the ticket's whole point in one spec:
// the questions run BEFORE any sign-in on an account the first answer creates, the plan is
// shown before Apple or Google are asked for anything, the consent screen is what stands
// between the plan and the first meal, and the country question comes after the sign-up.
//
// `start.test.ts` drives every one of these routes with `Request` objects — the sessionless
// answer, the consent POST, the callback's account attach, the deferred question — so what is
// here is what only a browser can show: the COOKIE. The account the questions ran on is the
// account the sign-up attaches to, and the only carrier between the two is `eait_web` as a
// real browser holds it.
import { expect, onboard, test } from "./fixtures.ts";

test("answers before an account, the plan before the sign-up, and the first meal after it", async ({ page }) => {
  await page.goto("/start");
  // The welcome offers the questions and the sign-in — the providers are NOT here (S8): the
  // sign-up screen is where consent and the buttons live.
  await expect(page.getByRole("link", { name: "Build my plan" })).toBeVisible();
  await expect(page.getByRole("link", { name: "I already have an account" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Continue with/i })).toHaveCount(0);

  await page.getByRole("link", { name: "Build my plan" }).click();
  await expect(page).toHaveURL(/\/start\/q/);

  // The whole walk with NO sign-in — the account exists because the first answer made it.
  await onboard(page);
  await expect(page.getByRole("heading", { name: "Here is your plan" })).toBeVisible();

  // The plan's way on is the sign-up screen, which asks for the two boxes AND the provider.
  await page.getByRole("link", { name: "Continue", exact: true }).click();
  await expect(page).toHaveURL(/\/start\/signup/);
  await expect(page.locator('input[name="terms"]')).toBeVisible();
  await expect(page.locator('input[name="marketing"]')).toBeVisible();

  // A button pressed with the box unticked goes nowhere — the consent is what the kickoff checks.
  await page.getByRole("button", { name: /Continue with Google/i }).click();
  await expect(page).toHaveURL(/\/start\/signup/);

  await page.locator('input[name="terms"]').check();
  await page.getByRole("button", { name: /Continue with Google/i }).click();
  // The demo authorize screen, standing where Google's would be.
  await page.getByRole("textbox").fill(`pw-s8-${Date.now()}`);
  await page.getByRole("button").click();

  // The identity attached to the session's own account — and the country question is what a
  // signed-up, answered account is asked next, on its own screen (S8).
  await expect(page).toHaveURL(/\/start\/country/);
  // A country is a card: the label carries the radio, Continue posts it.
  await page.locator('label.opt:has(input[value="de"])').click();
  await page.locator('button[type="submit"]').last().click();
  // The friend's-link step (#899) comes after the country; nobody sent this one a link.
  await expect(page).toHaveURL(/\/start\/referral$/);
  await page.getByRole("link", { name: "Skip", exact: true }).click();

  // The handoff: this deployment has no web application, so the product's own thread is it.
  await expect(page).toHaveURL(/\/start\/chat/);
  await page.locator('input[type="file"]').setInputFiles("src/backend/web/browser/fixture-meal.png");
  await page.getByRole("button", { name: "Send the photo" }).click();
  await expect(page.locator("div.card")).toContainText("kcal");
});

// The walk's numbers are spoken in the units on screen — en-GB pins metric (98 kg,
// not 98 lb), so the answers below are metric numbers and the floors hold.
test.use({ locale: "en-GB" });

