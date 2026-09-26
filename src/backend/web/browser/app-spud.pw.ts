// The web application in the Spud design (#52): the boards' transcript, its one composer, its
// navigation row and its diary rows — pinned by classes, accessible names and computed styles,
// never by screenshots.

import type { DayResponse } from "@eait/shared/contract";
import { renderableVerdicts, verdictPillLabel } from "@eait/shared";
import { expect, logMeal, sessionToken, test } from "./fixtures.ts";

test("the chat asks its one question, and the photo input lives behind a labelled button", async ({ inWebApp: page }) => {
  await page.goto("/#/chat");
  await expect(page.getByPlaceholder("Tell Spud what you ate, or ask anything")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add a photo" })).toBeVisible();
  // The native input is never shown — it is the labelled button that drives it.
  const picker = page.locator('input[type="file"]');
  const box = await picker.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeLessThanOrEqual(1);
  expect(box!.height).toBeLessThanOrEqual(1);
});

test("Spud's face sits beside his newest turn only, and mine are right-side bubbles", async ({ inWebApp: page }) => {
  const words = page.getByPlaceholder("Tell Spud what you ate, or ask anything");
  await page.goto("/#/chat");
  await words.fill("how did my week go?");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.locator(".thread li")).toHaveCount(2);
  await words.fill("and today?");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.locator(".thread li")).toHaveCount(4);

  // One avatar, on the LAST of his lines — not one per line.
  await expect(page.locator(".thread li.buddy")).toHaveCount(1);
  await expect(page.locator(".thread li.theirs").last()).toHaveClass(/buddy/);
  await expect(page.locator(".thread li.buddy .av svg")).toHaveCount(1);
  // Mine are bubbles aligned right; his are not full-width blocks.
  const mine = page.locator(".thread li.mine .bub").first();
  await expect(mine).toBeVisible();
  const row = await mine.evaluate((n) => {
    const r = n.getBoundingClientRect();
    return { right: r.right, colRight: n.closest("li")!.getBoundingClientRect().right };
  });
  expect(Math.abs(row.right - row.colRight)).toBeLessThan(2);
});

test("a line's Delete is a small text button with a name and a 44px hit area", async ({ inWebApp: page }) => {
  await page.goto("/#/chat");
  await page.getByPlaceholder("Tell Spud what you ate, or ask anything").fill("how did my week go?");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  const del = page.locator(".thread li .act", { hasText: "Delete" });
  await expect(del).toBeVisible();
  // Named for its line, so a reader never hears a bare "Delete".
  await expect(del).toHaveAttribute("aria-label", /Delete: how did my week go\?/);
  const box = await del.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
});

test("Diary · Chat · You hold ONE row at 390px, and the account's controls live in You", async ({ inWebApp: page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#/chat");
  // Three links, one row: same top edge for all of them, and nothing else in the row.
  const nav = page.locator(".wnav");
  const tops: number[] = [];
  for (const name of ["Diary", "Chat", "You"]) {
    const link = nav.getByRole("link", { name });
    await expect(link).toBeVisible();
    tops.push((await link.boundingBox())!.y);
  }
  expect(new Set(tops).size).toBe(1);
  await expect(nav.getByRole("button")).toHaveCount(0);
  await expect(nav.getByRole("link")).toHaveCount(3);

  // You carries the language picker and Sign out — and the language one, in You, is the same
  // PATCH /v1/profile the picker always used.
  await page.goto("/#/you");
  await expect(page.getByRole("heading", { name: "You" })).toBeVisible();
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
