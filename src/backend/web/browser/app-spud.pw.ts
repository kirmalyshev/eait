// The web application in the Spud design (#52): the boards' transcript, its one composer, its
// navigation row and its diary rows — pinned by classes, accessible names and computed styles,
// never by screenshots.

import type { DayResponse } from "@eait/shared/contract";
import { renderableVerdicts, verdictPillLabel } from "@eait/shared";
import { expect, logMeal, sessionToken, test } from "./fixtures.ts";

test("the chat asks its one question, and the photo input lives behind a labelled button", async ({ inWebApp: page }) => {
  await page.goto("/#/chat");
  await expect(page.getByPlaceholder("What did you eat?")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add a photo" })).toBeVisible();
  // The native input is never shown — it is the labelled round button that drives it.
  const box = await page.locator('input[type="file"]').boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeLessThanOrEqual(1);
  expect(box!.height).toBeLessThanOrEqual(1);
});

test("Gabie's disc sits beside her newest line only, and mine are right-side lines", async ({ inWebApp: page }) => {
  const words = page.locator(".compose .box");
  await page.goto("/#/chat");
  await words.fill("how did my week go?");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.locator(".thread li.them .say-p")).toHaveCount(1);
  await words.fill("and today?");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.locator(".thread li.them .say-p")).toHaveCount(2);

  // One disc, on the LAST of her lines — the older one keeps her column's spacer in its place.
  await expect(page.locator(".thread .gabie")).toHaveCount(1);
  await expect(page.locator(".thread li.them:has(.say)").last().locator(".gabie")).toHaveCount(1);
  await expect(page.locator(".thread .saygap")).toHaveCount(1);
  // And her name above the FIRST of them — the boards' rule (design-pro, #94).
  await expect(page.locator(".thread li.them .gname").first()).toHaveText("Gabie · nutritionist");
  await expect(page.locator(".thread .gname")).toHaveCount(1);
  // Mine are right-side lines in the accent tint, not full-width blocks.
  const mine = page.locator(".thread li.me").first();
  await expect(mine).toBeVisible();
  const row = await mine.evaluate((n) => {
    const r = n.getBoundingClientRect();
    return { right: r.right, colRight: n.closest("ul")!.getBoundingClientRect().right };
  });
  expect(Math.abs(row.right - row.colRight)).toBeLessThan(22);
});

test("a line's Delete is a small text button with a name and a 44px hit area", async ({ inWebApp: page }) => {
  await page.goto("/#/chat");
  await page.locator(".compose .box").fill("how did my week go?");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  const del = page.locator(".thread li .act", { hasText: "Delete" });
  await expect(del).toBeVisible();
  // Named for its line, so a reader never hears a bare "Delete".
  await expect(del).toHaveAttribute("aria-label", /Delete: how did my week go\?/);
  const box = await del.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
});

test("Home · Chat · Profile hold ONE row at 390px, and the account's controls live in Profile", async ({ inWebApp: page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#/chat");
  // Three links, one row: same top edge for all of them, and nothing else in the row.
  const nav = page.locator(".wnav");
  const tops: number[] = [];
  for (const name of ["Home", "Chat", "Profile"]) {
    const link = nav.getByRole("link", { name });
    await expect(link).toBeVisible();
    tops.push((await link.boundingBox())!.y);
  }
  expect(new Set(tops).size).toBe(1);
  await expect(nav.getByRole("button")).toHaveCount(0);
  await expect(nav.getByRole("link")).toHaveCount(3);

  // Profile carries the language picker and Sign out — and the language one, in Profile, is the
  // same PATCH /v1/profile the picker always used. The screen's h1 is visually hidden (the web
  // boards draw no centred title), so it is asserted PRESENT, not painted.
  await page.goto("/#/you");
  await expect(page.getByRole("heading", { name: "Profile" })).toHaveCount(1);
  await expect(page.getByLabel("Language")).toHaveValue("en");
  await expect(page.getByLabel("Language").locator("option")).toHaveCount(8);
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
});

test("a diary row wears the meal's own verdict pills, and the composer at the bottom logs one", async ({ inWebApp: page }) => {
  await logMeal(page);
  await page.goto("/#/");
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();

  // The pills are READ BACK from the server — the meal's own computed verdicts, never recomputed
  // on the page. Asserted against the API's copy of the day, not a guess at it.
  const res = await page.request.get("/api/v1/diary/day", {
    headers: { authorization: `Bearer ${await sessionToken(page)}` },
  });
  const day = await res.json() as DayResponse;
  const meal = day.meals[0]!;
  const dims = renderableVerdicts(meal.verdicts);
  expect(dims.length).toBeGreaterThan(0);
  const pills = page.locator(".meals tbody tr").first().locator(".pill");
  await expect(pills).toHaveCount(dims.length);
  for (const [i, d] of dims.entries()) {
    await expect(pills.nth(i)).toHaveText(verdictPillLabel(d, meal.verdicts[d]!, "en"));
    await expect(pills.nth(i)).toHaveClass(new RegExp(`\\bpill ${meal.verdicts[d]!}\\b`));
  }

  // The same composer the chat has, at the bottom of Today — a typed meal proposes, and Log it
  // lands it as a row.
  await page.getByPlaceholder("Tell Spud what you ate, or drop a photo").fill("a handful of almonds");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("button", { name: "Log it" })).toBeVisible();
  await page.getByRole("button", { name: "Log it" }).click();
  await expect(page.locator(".meals tbody tr")).toHaveCount(2);
});
