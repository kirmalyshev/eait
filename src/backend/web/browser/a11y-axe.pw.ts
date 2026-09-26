// axe over the /start pages — the other half of #53's done check, parked: this file's project
// drives the backend surface, which the /start half of #53 owns. Every test is fixme until that
// lands; the findings they collected when written are in that commit's message, and un-marking
// one turns it into the gate it is meant to be.
import { AxeBuilder } from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, onboardFast, signIn, test } from "./fixtures.ts";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

const axeFindings = async (page: Page): Promise<string[]> =>
  (await new AxeBuilder({ page }).withTags(TAGS).analyze())
    .violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s) — ${v.help}`);

for (const [width, height] of [[390, 844], [1440, 900]] as const) {
  test.fixme(`/start has no axe violations at ${width}px — enabled by the /start half of #53`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/start");
    // The welcome page, drawn — an axe run against a page that never rendered finds nothing.
    await expect(page.getByRole("link", { name: /continue with/i }).first()).toBeVisible();
    expect(await axeFindings(page)).toEqual([]);
  });

  test.fixme(`/start/q has no axe violations at ${width}px — enabled by the /start half of #53`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await signIn(page, `pw-axe-${width}-${Date.now()}`);
    await expect(page).toHaveURL(/\/start\/q/);
    expect(await axeFindings(page)).toEqual([]);
  });

  test.fixme(`/start/plan has no axe violations at ${width}px — enabled by the /start half of #53`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await signIn(page, `pw-axe-plan-${width}-${Date.now()}`);
    await onboardFast(page);
    await page.goto("/start/plan");
    await expect(page).toHaveURL(/\/start\/plan/);
    expect(await axeFindings(page)).toEqual([]);
  });
}
