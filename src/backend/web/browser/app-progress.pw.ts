// The Progress surface in a real browser (#95's Playwright list): the range chips switch what the
// chart draws, a typed weigh-in lands on it, a fresh account draws the one-dot state (onboarding
// writes the first weigh-in, so "a trend needs two points" — design-pro's ruling on the issue),
// reduced motion leaves every animated element at its end state, and at 390 px the four tabs hold
// one line with no scroll, axe-clean.

import { AxeBuilder } from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { dateMinus, emptyHealthDay, localDate } from "@eait/shared";
import { expect, sessionToken, test } from "./fixtures.ts";

const TODAY = () => localDate("Europe/Berlin"); // the demo server's own zone.

/** A weigh-in on a past date, through the health-sync route the phone itself uses. */
const seedWeight = async (page: Page, daysAgo: number, kg: number) => {
  const day = emptyHealthDay(dateMinus(TODAY(), daysAgo));
  day.weight_kg = kg;
  const res = await page.request.post("/v1/health/days", {
    headers: { authorization: `Bearer ${await sessionToken(page)}` },
    data: { days: [day] },
  });
  expect(res.status(), await res.text()).toBe(200);
};

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

test("the weight card's ranges switch what the chart draws", async ({ inWebApp: page }) => {
  // −100d sits outside 90D, −20d inside; onboarding's own weigh-in is today's.
  await seedWeight(page, 100, 76.5);
  await seedWeight(page, 20, 74.6);
  await page.goto("/#/progress");

  const dots = page.locator(".pgraph.wl circle");
  // No dots on the line since #1068 — only a lone weigh-in keeps its one.
  await expect(dots).toHaveCount(0);
  const all = page.getByRole("button", { name: "All" });
  await all.click();
  await expect(dots).toHaveCount(0);
  await expect(all).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "90D" }).click();
  await expect(dots).toHaveCount(0);
});

test("a weigh-in typed on Progress lands on the chart", async ({ inWebApp: page }) => {
  await seedWeight(page, 20, 74.6);
  await page.goto("/#/progress");
  await expect(page.locator(".prog .wnum .d28").first()).toHaveText("98");

  // The write path, driven the way a person drives it (#155): the weight card's "Log weight"
  // opens the inline field, Save writes the weigh-in — `PATCH /v1/profile` under it either way —
  // and the card redraws with it (ieat-app#1518: weight lives on Progress only).
  await page.getByRole("button", { name: "Log weight" }).click();
  await page.getByRole("spinbutton", { name: "Weight" }).fill("80");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.locator(".prog .wnum .d28").first()).toHaveText("80");
  await expect(page.locator(".pgraph.wl circle")).toHaveCount(0);
});

test("an account whose log is empty draws the empty card — a dash, not a phantom trend", async ({ inWebApp: page }) => {
  // `empty` is unreachable on an onboarded account — the typed weigh-in IS a log row (#84) — so
  // the state is answered at the wire: the shape `/v1/weights` gives an account with nothing
  // (#155's missing browser cover for `weightCard`'s `empty` branch).
  await page.route("**/api/v1/weights?*", (r) => r.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ weights: [], latest: null, projection: null, bmi: null }),
  }));
  await page.goto("/#/progress");
  await expect(page.locator(".prog .wnum .d28").first()).toHaveText("—");
  // The frame draws, and not one dot is invented.
  await expect(page.locator(".pgraph.wl")).toBeVisible();
  await expect(page.locator(".pgraph.wl circle")).toHaveCount(0);
  await page.getByRole("button", { name: "Log a weight to see your trend" }).click();
  await expect(page.getByRole("spinbutton", { name: "Weight" })).toBeVisible();
  // The weigh-in is a scrim panel since #474 — Esc closes it before the BMI card's door opens it.
  await page.keyboard.press("Escape");
  await expect(page.locator(".scrim")).toHaveCount(0);
  // The BMI card's own empty half reads the same invitation.
  await page.getByRole("button", { name: "Log a weight to see your BMI" }).click();
  await expect(page.getByRole("spinbutton", { name: "Weight" })).toBeVisible();
});

test("a fresh account draws the one-dot card — no invented trend", async ({ inWebApp: page }) => {
  await page.goto("/#/progress");
  await expect(page.locator(".prog .wnum .d28").first()).toHaveText("98");
  // The onboarding weigh-in is the single point: its dot and date, the frame's hairlines, and the
  // line inviting the second — never a line drawn through one point.
  await expect(page.locator(".pgraph.wl circle")).toHaveCount(1);
  await expect(page.locator(".pgraph.wl path")).toHaveCount(0);
  await page.getByRole("button", { name: "Log another weight to see your trend" }).click();
  await expect(page.getByRole("spinbutton", { name: "Weight" })).toBeVisible();
});

test("under reduced motion every animated element is already at its end state", async ({ inWebApp: page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await seedWeight(page, 20, 74.6);
  await seedWeight(page, 10, 74.0);
  await page.goto("/#/progress");
  await expect(page.locator(".pgraph.wl circle")).toHaveCount(0);

  // DOM names inside evaluate go in as strings — this file typechecks without the dom lib.
  const states = JSON.parse(await page.evaluate(
    `JSON.stringify([...document.querySelectorAll(".prog .rise, .prog .pop, .prog .draw")]
      .map((e) => [getComputedStyle(e).animationName, getComputedStyle(e).opacity]))`,
  )) as [string, string][];
  expect(states.length).toBeGreaterThan(0);
  for (const [animationName, opacity] of states) {
    expect(animationName).toBe("none");
    expect(opacity).toBe("1"); // at the end state, not waiting at the from-state
  }
  const offset = await page.evaluate(
    `getComputedStyle(document.querySelector(".pgraph.wl path")).strokeDashoffset`,
  );
  expect(["0", "0px"]).toContain(offset);
});

test("at 390px the four tabs hold one line and the page is axe-clean", async ({ inWebApp: page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#/progress");
  const tabs = page.locator(".wnav a");
  await expect(tabs).toHaveCount(4);

  // One row, every tab inside the viewport, and the document itself never scrolls sideways.
  const boxes = await Promise.all((await tabs.all()).map((t) => t.boundingBox()));
  const ys = new Set(boxes.map((b) => Math.round(b!.y)));
  expect(ys.size).toBe(1);
  for (const b of boxes) {
    expect(b!.x).toBeGreaterThanOrEqual(0);
    expect(b!.x + b!.width).toBeLessThanOrEqual(390);
  }
  expect(await page.evaluate(`document.documentElement.scrollWidth`)).toBeLessThanOrEqual(390);

  const findings = (await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze())
    .violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s) — ${v.help}`);
  expect(findings).toEqual([]);
});
