// The W2 walk (`#89`), driven in a real browser.
//
// What is here is only what a browser can prove: the recorded welcome loop plays and stops at its
// still under reduced motion, the seg toggle really re-renders the ruler in the other system, a
// pick on a card checks the radio inside it, and a browser with no script at all still reaches
// the plan. Markup and arithmetic are unit-tested in `start.test.ts`.

import { expect, onboard, sessionToken, signIn, test } from "./fixtures.ts";

test.describe("the welcome", () => {
  test("plays the recorded loop, muted, inline, from this origin", async ({ page }) => {
    await page.goto("/start");
    const vid = page.locator(".vdemo video");
    await expect(vid).toBeVisible();
    await expect(vid).toHaveAttribute("src", "/start/assets/welcome/demo.mp4");
    await expect(vid).toHaveAttribute("poster", "/start/assets/welcome/still.webp");
    await expect(vid).toHaveAttribute("muted", "");
    await expect(vid).toHaveAttribute("loop", "");
    await expect(vid).toHaveAttribute("playsinline", "");
    // Autoplay is a state, not an attribute to trust — the paused flag is what a browser knows.
    await expect(async () => {
      expect(await vid.evaluate((v: { paused: boolean; ended: boolean }) => !v.paused && !v.ended)).toBe(true);
    }).toPass();
    // And both halves of the pair are actually served.
    for (const asset of ["demo.mp4", "still.webp"]) {
      const res = await page.request.get(`/start/assets/welcome/${asset}`);
      expect(res.status(), asset).toBe(200);
    }
  });

  // THE ONE animation test the surface is allowed: under prefers-reduced-motion the video is
  // hidden and the loop's LAST FRAME stands in its place — the end state, not the animation.
  test("under reduced motion the loop is the still, not a playing video", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto("/start");
    const vid = page.locator(".vdemo video");
    await expect(vid).toBeHidden();
    await expect(page.locator(".vdemo img")).toBeVisible();
    await expect(page.locator(".vdemo img")).toHaveAttribute(
      "src", "/start/assets/welcome/still.webp",
    );
    expect(await vid.evaluate((v: { paused: boolean }) => v.paused)).toBe(true);
    await ctx.close();
  });
});

test.describe("the walk", () => {
  test("metric, by clicking what a person clicks, ends on the plan", async ({ page }) => {
    await page.goto("/start");
    await page.locator("a.cta").first().click();
    await expect(page).toHaveURL(/\/start\/q/);
    // The goal cards: clicking the card's label checks the radio inside it.
    await page.locator('label.opt:has(input[value="lose"])').click();
    await expect(page.locator('input[value="lose"]')).toBeChecked();
    await page.locator('button[type="submit"]').last().click();
    // The how-it-works card follows the goal — the POST redirects to `?show=`.
    await expect(page).toHaveURL(/show=how/);
    await expect(page.locator(".cards .card")).toHaveCount(3);
    await onboard(page);
  });

  test("imperial: the toggle redraws the ruler and the answer stores metric", async ({ page }) => {
    await signIn(page, `pw-imperial-${Date.now()}`);
    // To the height screen in metric…
    for (const [id, answer] of Object.entries({ goal: "lose", sex: "male", birth_year: "35" })) {
      // Past an interstitial first, if the redirect left us on one.
      const cta = page.locator("a.cta");
      if (!await page.locator('input[name="prompt"]').count() && await cta.count()) await cta.first().click();
      const openEl = page.locator('input[name="prompt"]').first();
      const open = (await openEl.count()) ? await openEl.getAttribute("value") : null;
      expect(open).toBe(id);
      const row = page.locator(`label.opt:has(input[name="answer"][value="${answer}"])`);
      if (await row.count()) {
        await row.click();
      } else {
        const field = page.locator('input[name="answer"]').first();
        if (await field.isVisible()) await field.fill(answer);
        else await field.evaluate((el, v) => { (el as { value: string }).value = String(v); }, answer);
      }
      await page.locator('button[type="submit"]').last().click();
    }
    // The cm ruler is up; switching to ft,in redraws the same height the other way.
    await expect(page.locator('input[name="prompt"]')).toHaveAttribute("value", "height_cm");
    await page.locator('form.seg button', { hasText: "ft, in" }).click();
    await expect(page.locator(".bign .bv").first()).toContainText("′");
    // The wire is inches now — 68″ is the 172 cm the store keeps.
    await page.locator('input[name="answer"]').first()
      .evaluate((el) => { (el as { value: string }).value = "68"; });
    await page.locator('button[type="submit"]').last().click();
    // The choice carries: the weight ruler opens in pounds without being asked again.
    await expect(page.locator('input[name="prompt"]')).toHaveAttribute("value", "weight_kg");
    await expect(page.locator(".bign small").first()).toContainText("lb");
    await page.locator('input[name="answer"]').first()
      .evaluate((el) => { (el as { value: string }).value = "163"; });
    await page.locator('button[type="submit"]').last().click();
    // … and the stored values are metric, because every unit here is display-only.
    const res = await page.request.get("/v1/profile", {
      headers: { authorization: `Bearer ${await sessionToken(page)}` },
    });
    const body = await res.json();
    expect(Math.abs((body.height_cm ?? body.profile?.height_cm) - 172)).toBeLessThan(1.5);
    expect(Math.abs((body.weight_kg ?? body.profile?.weight_kg) - 73.9)).toBeLessThan(0.6);
  });

  test("the under-16 answer stops the walk and deletes the account", async ({ page }) => {
    await signIn(page, `pw-under16-${Date.now()}`);
    for (const [id, answer] of Object.entries({ goal: "lose", sex: "male", birth_year: "14" })) {
      const cta = page.locator("a.cta");
      if (!await page.locator('input[name="prompt"]').count() && await cta.count()) await cta.first().click();
      const row = page.locator(`label.opt:has(input[name="answer"][value="${answer}"])`);
      if (await row.count()) await row.click();
      else {
        const field = page.locator('input[name="answer"]').first();
        if (await field.isVisible()) await field.fill(answer);
        else await field.evaluate((el, v) => { (el as { value: string }).value = String(v); }, answer);
      }
      await page.locator('button[type="submit"]').last().click();
    }
    // The token before the stop — after the delete it must resolve nothing.
    const token = await sessionToken(page);
    // 14 is the stop: the confirm is offered once, then the card says nothing was kept.
    await page.getByRole("button", { name: /16 and over|Yes, delete|I'm under/i }).or(
      page.locator('button[name="confirm"]'),
    ).first().click();
    await expect(page.getByText(/16 and over/)).toBeVisible();
    await expect(page.locator('input[name="prompt"]')).toHaveCount(0);
    // The stop is the account deleted, not a screen shown: the session token resolves nothing.
    const res = await page.request.get("/v1/profile", {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(401);
  });

  test("no script at all still reaches the plan", async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await signIn(page, `pw-nojs-${Date.now()}`);
    await onboard(page);
    await ctx.close();
  });
});

// The walk's numbers are spoken in the units on screen — en-GB pins metric (98 kg,
// not 98 lb), so the answers below are metric numbers and the floors hold.
test.use({ locale: "en-GB" });

