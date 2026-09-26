// The web application's accessibility pins (#53), measured in a real browser at a phone's width
// because they are LAYOUT facts: the one <main> and the one h1 per page, the 44px hit area on
// every control the spec names, and the 12px type floor with 16px on form controls — the number
// that keeps iOS from zooming on focus. None of this is visible to a unit test.
import type { Locator, Page } from "@playwright/test";
import { expect, logMeal, test } from "./fixtures.ts";

test.use({ viewport: { width: 390, height: 844 } });

const FIXTURE = "src/backend/web/browser/fixture-meal.png";

/** One <main> landmark, and inside it exactly one h1 — the heading a screen reader lands on. */
async function landmark(page: Page) {
  await expect(page.getByRole("main")).toHaveCount(1);
  await expect(page.locator("main h1")).toHaveCount(1);
}

/** A box a finger can hit: no edge under 44px. */
async function tapTarget(loc: Locator) {
  const box = await loc.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
}

/** No rendered text under 12px, measured computed — not the stylesheet, the page. */
async function typeFloor(page: Page) {
  // A string, because this file is typechecked without the DOM: the browser is where it runs.
  const tooSmall = await page.evaluate<string[]>(`(() => {
    const hits = [];
    for (const n of document.querySelectorAll("body *")) {
      // An element that OWNS the text (a parent's font-size is not its text), and is drawn.
      const own = [...n.childNodes].some((c) => c.nodeType === Node.TEXT_NODE && c.textContent.trim() !== "");
      if (!own || n.getClientRects().length === 0) continue;
      const px = parseFloat(getComputedStyle(n).fontSize);
      if (px < 12) hits.push(n.tagName.toLowerCase() + "." + n.className + " " + px + "px");
    }
    return hits;
  })()`);
  expect(tooSmall).toEqual([]);
}

/** The first match's computed font-size — as a string, same reason as `typeFloor`. */
const fontPx = (page: Page, selector: string) =>
  page.evaluate<number>(`parseFloat(getComputedStyle(document.querySelector(${JSON.stringify(selector)})).fontSize)`);

test("the diary: one main with one h1, 44px nav and Send, and the type floor", async ({ inWebApp: page }) => {
  // A meal first: a fresh account's `/#/` is the first-meal flow, not the diary.
  await logMeal(page);
  await page.goto("/#/");
  await expect(page.locator(".big")).toBeVisible();
  await landmark(page);
  for (const tab of await page.locator(".wnav a").all()) await tapTarget(tab);
  await tapTarget(page.getByRole("button", { name: "Send" }));
  await typeFloor(page);
  // The composer's field is a form control: 16px, or iOS zooms the page on focus.
  expect(await fontPx(page, ".fld")).toBeGreaterThanOrEqual(16);
});

test("the chat: one h1, and Send and a line's Delete both at 44px", async ({ inWebApp: page }) => {
  await page.goto("/#/chat");
  await landmark(page);
  await tapTarget(page.getByRole("button", { name: "Send" }));
  await page.getByPlaceholder("Tell Spud what you ate, or ask anything").fill("how did my week go?");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  const del = page.locator(".thread li .act", { hasText: "Delete" });
  await expect(del).toBeVisible();
  await tapTarget(del);
});

test("You: one h1, and the language select at 44px with 16px type", async ({ inWebApp: page }) => {
  await page.goto("/#/you");
  await landmark(page);
  const pick = page.locator("select.pick");
  await tapTarget(pick);
  expect(await fontPx(page, "select.pick")).toBeGreaterThanOrEqual(16);
});

test("the offer: one h1, and Correct meal / Not now at 44px", async ({ inWebApp: page }) => {
  // The offer is the first-meal flow's last step — driven, the way app-first-meal.pw.ts drives it.
  await page.goto("/#/");
  await page.getByRole("button", { name: "Upload a photo" }).click();
  await page.locator('input[type="file"]').setInputFiles(FIXTURE);
  await page.getByRole("button", { name: "Analyse my meal" }).click();
  await expect(page.getByText("Your first verdict")).toBeVisible();
  await tapTarget(page.getByRole("button", { name: "Correct meal" }));
  await page.getByRole("button", { name: "Keep going" }).click();
  await expect(page.getByText("Every meal, like that one")).toBeVisible();
  await landmark(page);
  await tapTarget(page.getByRole("button", { name: "Not now" }));
});
