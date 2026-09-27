// The You surface in a real browser (#97, Register P · web/you.html): the header's fact line,
// the weight card whose "Log weight" writes the S7 row, the plan card whose edit recomputes
// through the server's own answer, the flat account rows (Subscription, Account, Units, Language,
// Sign out), and the today column the board draws beside them.

import { expect, sessionToken, test } from "./fixtures.ts";

test("You draws the board: facts, weight, plan, the account rows and the today column", async ({ inWebApp: page }) => {
  await page.goto("/#/you");

  // The header: the fact line — age, height, nothing declared (onboardFast declares no medical).
  // onboardFast is 1988 / 182 cm, so the height reads in cm on a metric account.
  await expect(page.locator(".you .facts")).toContainText("182 cm");

  // The weight card, the plan card, the flat rows.
  await expect(page.getByRole("button", { name: "Log weight" })).toBeVisible();
  await expect(page.locator(".you .planfig .d22")).toContainText("kcal");
  await expect(page.getByRole("button", { name: "edit", exact: true })).toBeVisible();
  await expect(page.locator(".you .urows .opt")).toContainText(["Subscription", "Account"]);
  await expect(page.getByLabel("Units")).toHaveValue("metric");
  await expect(page.getByLabel("Language")).toHaveValue("en");
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();

  // The today column: the week strip's seven days, the kcal-left hero, the three macro cards.
  await expect(page.locator(".you .week .dy")).toHaveCount(7);
  await expect(page.locator(".you .dayhero")).toContainText("kcal left");
  await expect(page.locator(".you .mcard")).toHaveCount(3);
});

test("Log weight writes the weigh-in, and it lands on Progress", async ({ inWebApp: page }) => {
  await page.goto("/#/you");
  await page.getByRole("button", { name: "Log weight" }).click();
  await page.getByLabel("Weight").fill("96");
  await page.getByRole("button", { name: "Save" }).click();

  // The card redraws off the server's answer: today's weigh-in is the chart's last point.
  await expect(page.locator(".you .pgraph.wl text")).toContainText(["96"]);

  // And it is the row Progress draws — the "appears on Progress" gate (#97).
  await page.goto("/#/progress");
  await expect(page.locator(".prog .wnum .d28").first()).toHaveText("96");
  // Onboarding wrote the first weigh-in; the typed one makes two.
  await expect(page.locator(".pgraph.wl circle")).toHaveCount(2);
});

test("editing the plan recomputes the card off the server's answer", async ({ inWebApp: page }) => {
  await page.goto("/#/you");
  const before = await page.locator(".you .planfig .d22").innerText();

  await page.getByRole("button", { name: "edit", exact: true }).click();
  await page.getByLabel("Exercise frequency").selectOption("many");
  await page.getByRole("button", { name: "Save" }).click();

  // The figure is the one the PATCH answered with — read back from the API, never guessed.
  const res = await page.request.get("/v1/profile", {
    headers: { authorization: `Bearer ${await sessionToken(page)}` },
  });
  const { targets } = await res.json() as { targets: { kcal: number } };
  const shown = await page.locator(".you .planfig .d22").innerText();
  expect(shown).not.toBe(before);
  expect(shown).toContain(new Intl.NumberFormat("en-GB").format(targets.kcal));
});

test("the Units row relabels every measurement on the surface, and writes the account", async ({ inWebApp: page }) => {
  await page.goto("/#/you");
  await expect(page.locator(".you .facts")).toContainText("182 cm");
  // The chart's first label is the onboarding weigh-in: 98 kg.
  await expect(page.locator(".you .pgraph.wl text").first()).toHaveText("98");

  await page.getByLabel("Units").selectOption("imperial");

  // Height in ft/in, the weigh-ins and the target in lb — nothing still reads metric.
  await expect(page.locator(".you .facts")).toContainText("6′0″");
  await expect(page.locator(".you .pgraph.wl text").first()).toHaveText("216"); // 98 kg ≈ 216 lb
  await expect(page.locator(".you .pgraph.wl")).toContainText("lb · target");

  const res = await page.request.get("/v1/profile", {
    headers: { authorization: `Bearer ${await sessionToken(page)}` },
  });
  expect((await res.json() as { profile: { units: string } }).profile.units).toBe("imperial");
});

test("under reduced motion every animated element is already at its end state", async ({ inWebApp: page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#/you");
  await expect(page.locator(".you .week .dy")).toHaveCount(7);

  const states = JSON.parse(await page.evaluate(
    `JSON.stringify([...document.querySelectorAll(".you .rise, .you .pop, .you .draw, .you .mring .fg, .you .week .fg")]
      .map((e) => [getComputedStyle(e).animationName, getComputedStyle(e).opacity]))`,
  )) as [string, string][];
  expect(states.length).toBeGreaterThan(0);
  for (const [animationName, opacity] of states) {
    expect(animationName).toBe("none");
    expect(opacity).toBe("1");
  }
});
