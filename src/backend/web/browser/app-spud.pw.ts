// The web application in the Spud design (#52): the boards' transcript, its one composer, its
// navigation row and its diary rows — pinned by classes, accessible names and computed styles,
// never by screenshots.

import type { DayResponse } from "@eait/shared/contract";
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

test("Spud's disc sits beside his newest line only, and mine are right-side lines", async ({ inWebApp: page }) => {
  const words = page.locator(".compose .box");
  await page.goto("/#/chat");
  await words.fill("how did my week go?");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.locator(".thread li.them .say-p")).toHaveCount(1);
  await words.fill("and today?");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.locator(".thread li.them .say-p")).toHaveCount(2);

  // One disc, on the LAST of her lines — the older one keeps her column's spacer in its place.
  // #1520: his face on the last of each RUN — her line between his two answers ends the first run.
  await expect(page.locator(".thread .spud")).toHaveCount(2);
  await expect(page.locator(".thread li.them:has(.say)").last().locator(".spud")).toHaveCount(1);
  await expect(page.locator(".thread .saygap")).toHaveCount(0);
  // And her name above the FIRST of them — the boards' rule (design-pro, #94).
  await expect(page.locator(".thread .gname")).toHaveCount(0);
  // Mine are right-side lines in the accent tint, not full-width blocks.
  const mine = page.locator(".thread li.me").first();
  await expect(mine).toBeVisible();
  const row = await mine.evaluate((n) => {
    const r = n.getBoundingClientRect();
    return { right: r.right, colRight: n.closest("ul")!.getBoundingClientRect().right };
  });
  expect(Math.abs(row.right - row.colRight)).toBeLessThan(22);
});

// A thread line carries no action row since #173 — an edit is the meal detail's Correct, a
// delete its menu — so the spec that pinned the Delete button's shape died with the control.

test("Home · Progress · Chat · Profile hold ONE row at 390px, and the account's controls live in Profile", async ({ inWebApp: page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#/chat");
  // Four links, one row: same top edge for all of them, and nothing else in the row.
  const nav = page.locator(".wnav");
  const tops: number[] = [];
  for (const name of ["Home", "Progress", "Chat", "Profile"]) {
    const link = nav.getByRole("link", { name });
    await expect(link).toBeVisible();
    tops.push((await link.boundingBox())!.y);
  }
  expect(new Set(tops).size).toBe(1);
  await expect(nav.getByRole("button")).toHaveCount(0);
  await expect(nav.getByRole("link")).toHaveCount(4);

  // Profile carries the language picker and Sign out — and the language one, in Profile, is the
  // same PATCH /v1/profile the picker always used. The screen's h1 is visually hidden (the web
  // boards draw no centred title), so it is asserted PRESENT, not painted.
  await page.goto("/#/you");
  await expect(page.getByRole("heading", { name: "Profile" })).toHaveCount(1);
  await expect(page.getByLabel("Language")).toHaveValue("en");
  await expect(page.getByLabel("Language").locator("option")).toHaveCount(8);
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
});

test("a diary row wears the meal's own verdict line, and the composer on Home logs one", async ({ inWebApp: page }) => {
  // An OFF-PLAN meal — the row's `.v` line exists only for one (an on-plan meal's `verdictInline`
  // is empty by design). The `ldl` declaration sets the saturated-fat cap, and the fixture plate's
  // sat fat is past its warn share — declared before the log so the engine computes it.
  const patched = await page.request.patch("/v1/profile", {
    headers: { authorization: `Bearer ${await sessionToken(page)}`, "content-type": "application/json" },
    data: { medical: ["ldl"] },
  });
  expect(patched.status()).toBe(200);
  await logMeal(page);
  await page.goto("/#/");
  await expect(page.getByRole("heading", { name: "Home" })).toBeAttached();

  // The line is READ BACK from the server — the meal's own `verdictInline`, never recomputed on
  // the page. Asserted against the API's copy of the day, not a guess at it.
  const res = await page.request.get("/api/v1/diary/day", {
    headers: { authorization: `Bearer ${await sessionToken(page)}` },
  });
  const day = await res.json() as DayResponse;
  const meal = day.meals[0]!;
  expect(meal.verdictInline).toBeTruthy();
  const row = page.locator(".dlist a.meal").first();
  await expect(row.locator(".v")).toHaveText(meal.verdictInline!);
  // The tone is the day's worst verdict — the same rule `verdictRow` draws it by.
  const bad = (meal.verdictLabels ?? []).some((v) => v.tone === "bad");
  await expect(row.locator(".v")).toHaveClass(new RegExp(`\\bv ${bad ? "bad" : "warn"}\\b`));
  await expect(row).toHaveAttribute("href", `#/meal/${meal.id}?d=${day.date}`);

  // The same composer the chat has, on Home — a typed meal proposes, and Log it lands it as a row.
  await page.getByPlaceholder("Tell Spud what you ate, or drop a photo").fill("a handful of almonds");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("button", { name: "Log it" })).toBeVisible();
  await page.getByRole("button", { name: "Log it" }).click();
  await expect(page.locator(".dlist a.meal")).toHaveCount(2);
});
