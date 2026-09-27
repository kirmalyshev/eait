// The web application's meal detail — `#/meal/:id` (Register P's W6, #93).
//
// The board is master-detail: the day's meals stay in a column on the left while the card on the
// right carries the photo, the kcal, the three macro tiles, the ingredients with their own kcal,
// the computed score row, the verdict dots and the one fix — "Correct this meal", which opens the
// conversation. The "…" menu holds Edit, Re-read the photo, Move to yesterday and Delete, which
// asks first. A deleted, moved-away or FOREIGN id reads as gone, never as somebody else's meal.

import { execSync } from "node:child_process";
import type { Page } from "@playwright/test";
import type { DayResponse } from "@eait/shared/contract";
import { expect, logMeal, onboardFast, sessionToken, signIn, test } from "./fixtures.ts";

// The review shots (#93's gate). `test-results/` is gitignored; the names carry the sha instead
// of the files living in the tree — and they wait out the boards' rise delays so a card is not
// caught mid-fade.
const SHA = execSync("git rev-parse --short HEAD").toString().trim();
const shot = async (page: Page, name: string): Promise<void> => {
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `test-results/shots/w6-${SHA}-${name}.png`, fullPage: true });
};

/** Today's day, fetched under this page's session. */
async function day(page: Page, date = ""): Promise<DayResponse> {
  const res = await page.request.get(`/v1/diary/day${date ? `?date=${date}` : ""}`, {
    headers: { authorization: `Bearer ${await sessionToken(page)}` },
  });
  expect(res.status()).toBe(200);
  return (await res.json()) as DayResponse;
}

/** One photo meal on the page's account, opened at its detail. */
async function openMeal(page: Page): Promise<{ id: string; date: string }> {
  await logMeal(page);
  const d = await day(page);
  const id = d.meals[0]!.id;
  await page.goto(`/#/meal/${id}`);
  await expect(page.locator(".hsr")).toBeVisible();
  return { id, date: d.date };
}

test("the meal opens: photo, kcal, macro tiles, ingredients, verdicts, score", async ({ inWebApp: page }) => {
  const { id } = await openMeal(page);
  // The day's row stays in view on the left; the detail carries the figures and the one fix.
  await expect(page.locator(".meal").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Correct this meal" })).toBeVisible();
  // The health score row is drawn from the server's MealRecord.healthScore, never computed here.
  const score = (await day(page)).meals.find((m) => m.id === id)!.healthScore!;
  await expect(page.locator(".hsr")).toContainText(`${score.score}/10`);
  // The macro tiles name their macros; the ingredient rows carry grams and their own kcal.
  await expect(page.locator(".mcards .mcard")).toHaveCount(3);
  await expect(page.locator(".ing").first()).toBeVisible();
  await expect(page.locator(".ing").first()).toContainText(" g");
  await expect(page.locator(".ing b").first()).toBeVisible();
  await shot(page, "detail");
});

test("the score row opens the breakdown, and Done closes it", async ({ inWebApp: page }) => {
  await openMeal(page);
  await page.locator(".hsr").click();
  // The overlay names every part: the start, the five nutrients, each with its points.
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Health score", { exact: true })).toBeVisible();
  await expect(dialog.locator(".hsp")).toHaveCount(6);
  await shot(page, "score");
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("Correct opens the conversation on this meal; the change line is the server's", async ({ inWebApp: page }) => {
  const { id } = await openMeal(page);
  const before = (await day(page)).meals[0]!.kcal;
  await page.getByRole("link", { name: "Correct this meal" }).click();
  await expect(page).toHaveURL(new RegExp(`#\\/chat\\?focus=${id}`));
  // Gabie's opener names what she read; the composer asks what was wrong.
  await expect(page.getByText(/I read .* Tell me what I got wrong\./)).toBeVisible();
  await page.getByPlaceholder("Say what was wrong").fill("actually only half that");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  // The recomputed card and the server's "a change, named" line land in the thread.
  await expect(page.locator("p.bub", { hasText: "→" }).first()).toBeVisible();
  await expect(page.locator("p.bub", { hasText: "→" }).first()).toContainText(`${Math.round(before / 2)}`);
  await shot(page, "chat-focus");
  // Back on the detail, the diary row and the card carry the new number.
  await page.goto(`/#/meal/${id}`);
  await expect(page.locator(".meal .kc").first()).toContainText(`${Math.round(before / 2)}`);
});

test("the menu: re-read recomputes in place, and delete asks first", async ({ inWebApp: page }) => {
  const { id } = await openMeal(page);
  await page.locator(".mdetail .ib").last().click();
  const menu = page.locator(".mpopup");
  await shot(page, "menu");
  await expect(menu.getByText("Edit")).toBeVisible();
  await expect(menu.getByText("Re-read the photo")).toBeVisible();
  await expect(menu.getByText("Move to yesterday")).toBeVisible();
  await expect(menu.getByText("Delete this meal")).toBeVisible();

  // Re-read hits the analyzer again and the meal is redrawn from the answer.
  const reread = page.waitForResponse((r) => r.url().includes(`/v1/meals/${id}/reanalyze`) && r.ok());
  await menu.getByText("Re-read the photo").click();
  expect(((await (await reread).json()) as { kind: string }).kind).toBe("updated");
  await expect(page.locator(".hsr")).toBeVisible();

  // Delete asks first; cancelling keeps the meal.
  await page.locator(".mdetail .ib").last().click();
  await page.locator(".mpopup").getByText("Delete this meal").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await shot(page, "delete");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(page.locator(".hsr")).toBeVisible();

  // Confirming deletes it: the detail reads gone, the row is off the day.
  await page.locator(".mdetail .ib").last().click();
  await page.locator(".mpopup").getByText("Delete this meal").click();
  await dialog.getByRole("button", { name: "Delete this meal" }).click();
  await expect(page.locator(".mgone")).toBeVisible();
  expect((await day(page)).meals).toHaveLength(0);
});

test("Move to yesterday puts the meal on yesterday's diary", async ({ inWebApp: page }) => {
  const { id, date } = await openMeal(page);
  await page.locator(".mdetail .ib").last().click();
  const moved = page.waitForResponse((r) => r.url().endsWith("/v1/messages") && r.request().method() === "POST" && r.ok());
  await page.locator(".mpopup").getByText("Move to yesterday").click();
  const result = (await (await moved).json()) as { kind: string; date?: string };
  expect(result.kind).toBe("redated");
  const yesterday = result.date!;
  expect(yesterday).not.toBe(date);
  // The detail follows the meal onto yesterday, and today's list no longer holds the row.
  await expect(page).toHaveURL(new RegExp(`#\\/meal\\/${id}\\?d=${yesterday}`));
  await expect(page.locator(".hsr")).toBeVisible();
  expect((await day(page, yesterday)).meals.map((m) => m.id)).toContain(id);
  expect((await day(page)).meals).toHaveLength(0);
});

test("another user's meal id resolves to the gone state, never to their meal", async ({ inWebApp: page, browser }) => {
  // A second account logs a meal; this page asks for its id.
  const other = await browser.newContext();
  try {
    const page2 = await other.newPage();
    await signIn(page2, `pw-foreign-${Date.now()}`);
    await onboardFast(page2);
    await logMeal(page2);
    const foreignId = (await day(page2)).meals[0]!.id;
    await page.goto(`/#/meal/${foreignId}`);
    await expect(page.locator(".mgone")).toBeVisible();
    await expect(page.locator(".hsr")).toHaveCount(0);
    await shot(page, "gone");
  } finally {
    await other.close();
  }
});

test("an id that was never a meal reads gone the same way", async ({ inWebApp: page }) => {
  await logMeal(page);
  await page.goto(`/#/meal/${crypto.randomUUID()}`);
  await expect(page.locator(".mgone")).toBeVisible();
});

test("reduced motion: the detail is at its end state with nothing running", async ({ inWebApp: page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openMeal(page);
  await expect(page.locator(".mcards .mcard")).toHaveCount(3);
  expect(await page.evaluate<number>("document.getAnimations().length")).toBe(0);
});
