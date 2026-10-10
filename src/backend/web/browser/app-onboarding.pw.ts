// The W3 flow (#90), driven end to end in a real browser on the web application's origin:
// the questions → the plan → the sign-up → the country → the first meal, and
// back: a returning account's "I already have an account" lands on the app, not the questions.
//
// This spec runs in the `app` project because the last leg IS the app: the country POST's 303
// to `/` is the handoff, and the first-meal screen is what `/#/` draws for an account that has
// never logged.

import { expect, onboard, sessionToken, test } from "./fixtures.ts";

test("the whole W3 walk: plan, sign-up, country, first meal — and back", async ({ page, browser }) => {
  await page.goto("/start");
  await page.getByRole("link", { name: "Build my plan" }).click();

  // ── Answers → the plan ──────────────────────────────────────────────────────────────────
  // High cholesterol declared at the medical chips, so the outcome card draws the sat-fat limit.
  await onboard(page, { medical: ["ldl"] });

  // ── The plan ────────────────────────────────────────────────────────────────────────────
  await expect(page).toHaveURL(/\/start\/plan/);
  await expect(page.locator(".pln .goal")).toContainText("Goal:");
  await expect(page.locator(".pgraph .draw1")).toBeVisible();
  await expect(page.locator(".pln .oc")).toContainText("kcal a day");
  await expect(page.locator(".pln .mrow")).toContainText("sat fat");

  // ── The sign-up: terms required, marketing optional ─────────────────────────────────────
  await page.getByRole("link", { name: "Continue", exact: true }).click();
  await expect(page).toHaveURL(/\/start\/signup/);
  await expect(page.locator(".hero img")).toHaveAttribute("src", "/start/assets/img/icon.webp");
  await expect(page.locator('input[name="terms"]')).not.toBeChecked();
  await expect(page.locator('input[name="marketing"]')).not.toBeChecked();
  // Unticked goes nowhere.
  await page.getByRole("button", { name: /Continue with Google/i }).click();
  await expect(page).toHaveURL(/\/start\/signup/);
  // Both boxes ticked — the marketing one is what the engine stamps onto the account
  // (identity.test.ts asserts `marketing_consent_at`; here the tick rides the real submit).
  await page.locator('input[name="terms"]').check();
  await page.locator('input[name="marketing"]').check();
  // The tick is read back on the wire (#162): `form.get("marketing")` on the kickoff POST is what
  // mints the consent cookie's "m" segment, and the callback turns it into `marketing_consent_at`
  // — `identity.test.ts` owns the stamp; this proves the tick left the page.
  const kickoff = page.waitForRequest((r) => r.method() === "POST" && r.url().includes("/start/auth/google"));
  await page.getByRole("button", { name: /Continue with Google/i }).click();
  expect((await kickoff).postData() ?? "").toContain("marketing");
  const subject = `pw-w3-${Date.now()}`;
  await page.getByRole("textbox").fill(subject);
  await page.getByRole("button").click();

  // ── The country, then the product ───────────────────────────────────────────────────────
  await expect(page).toHaveURL(/\/start\/country/);
  await expect(page.locator(".cty .srch input")).toBeVisible();
  // The hint is drawn preselected, in place — one checked radio, and `other` last.
  await expect(page.locator('.cty .opt input[checked]')).toHaveCount(1);
  expect(await page.locator('.cty .opt input').last().getAttribute("value")).toBe("other");
  // Search narrows live — "mex" leaves Mexico and the sentinel, "zzz" leaves only the sentinel.
  await page.locator(".cty .srch input").fill("mex");
  await expect(page.locator(".cty .opt:not(.hide)")).toHaveCount(2);
  // A unique match is picked as it appears, and the sentinel never counts as one.
  await expect(page.locator('.cty .opt input[value="mx"]')).toBeChecked();
  // Enter on several matches checks the first visible one and stays on the page.
  await page.locator(".cty .srch input").fill("an");
  await page.locator(".cty .srch input").press("Enter");
  await expect(page).toHaveURL(/\/start\/country$/);
  await expect(page.locator(".cty .opt:not(.hide) input").first()).toBeChecked();
  await page.locator(".cty .srch input").fill("zzz");
  await expect(page.locator(".cty .opt:not(.hide)")).toHaveCount(1);
  await page.locator(".cty .srch input").fill("");
  await page.locator('.cty .opt:has(input[value="de"])').click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  // ── The friend's link (#899): optional, and Skip stores nothing ─────────────────────────
  await expect(page).toHaveURL(/\/start\/referral$/);
  await page.getByRole("link", { name: "Skip", exact: true }).click();

  // ── The first meal, in the app ──────────────────────────────────────────────────────────
  await expect(page.getByRole("button", { name: "Upload a photo" })).toBeVisible();

  // The answers live on the account — the profile, read back over the session's own bearer.
  const me = await page.request.get("/api/v1/profile", {
    headers: { authorization: `Bearer ${await sessionToken(page)}` },
  });
  const body = await me.json();
  expect(body.profile.goal).toBe("lose");
  expect(body.profile.sex).toBe("male");
  expect(body.profile.country).toBe("de");
  expect(body.profile.onboarded_at).not.toBeNull();

  // ── And back: a returning account signs in and lands on the app, no onboarding ──────────
  const other = await browser.newContext({ baseURL: new URL(page.url()).origin });
  const returning = await other.newPage();
  await returning.goto("/start");
  await returning.getByRole("link", { name: /already have an account/i }).click();
  await returning.locator('input[name="terms"]').check();
  await returning.getByRole("button", { name: /Continue with Google/i }).click();
  await returning.getByRole("textbox").fill(subject); // the same identity
  await returning.getByRole("button").click();
  // Home — `/#/` — with no question, no reveal, no country. The account is where it was, and the
  // app's own chrome is the assertion: the Home tab is on screen.
  await returning.waitForURL(/\/($|#)/);
  await expect(returning.getByRole("link", { name: "Home" })).toBeVisible();
  await expect(returning.locator('input[name="prompt"]')).toHaveCount(0);
  await other.close();
});

// The walk's numbers are spoken in the units on screen — en-GB pins metric (98 kg,
// not 98 lb), so the answers below are metric numbers and the floors hold.
test.use({ locale: "en-GB" });
