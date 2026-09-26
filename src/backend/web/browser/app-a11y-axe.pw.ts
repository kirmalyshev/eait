// axe over the web APPLICATION — #53's done check, enforced now: diary, chat, You and the offer,
// at a phone's width and a desktop's, failing on any wcag2a/aa or wcag21a/aa violation. The /start
// pages are the same check in a11y-axe.pw.ts, fixme'd until the /start half lands.
import { AxeBuilder } from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures.ts";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const FIXTURE = "src/backend/web/browser/fixture-meal.png";

/** The page's violations as one line each — the list IS the failure message. */
const axeFindings = async (page: Page): Promise<string[]> =>
  (await new AxeBuilder({ page }).withTags(TAGS).analyze())
    .violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s) — ${v.help}`);

for (const [width, height] of [[390, 844], [1440, 900]] as const) {
  test(`the diary, the chat, You and the offer have no axe violations at ${width}px`, async ({ inWebApp: page }) => {
    await page.setViewportSize({ width, height });

    // The offer is the first-meal flow's last step, reached the way app-first-meal.pw.ts reaches
    // it — and reaching it LOGS the meal that turns `/#/` into the diary for the last check.
    await page.goto("/#/");
    await page.getByRole("button", { name: "Upload a photo" }).click();
    await page.locator('input[type="file"]').setInputFiles(FIXTURE);
    await page.getByRole("button", { name: "Analyse my meal" }).click();
    await expect(page.getByText("Your first verdict")).toBeVisible();
    await page.getByRole("button", { name: "Keep going" }).click();
    await expect(page.getByText("Every meal, like that one")).toBeVisible();
    expect(await axeFindings(page), "offer").toEqual([]);

    await page.goto("/#/chat");
    await expect(page.getByRole("button", { name: "Send" })).toBeVisible();
    expect(await axeFindings(page), "chat").toEqual([]);

    await page.goto("/#/you");
    await expect(page.locator("select.pick")).toBeVisible();
    expect(await axeFindings(page), "you").toEqual([]);

    await page.goto("/#/");
    await expect(page.locator(".big")).toBeVisible();
    expect(await axeFindings(page), "diary").toEqual([]);
  });
}
