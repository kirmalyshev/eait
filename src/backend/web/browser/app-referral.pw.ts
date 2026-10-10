// Refer a friend in the web APPLICATION (#899): the card above the settings list, one Share link
// button — the browser's share sheet where there is one, else the clipboard — and the share is
// counted only once it finished.
import { expect, test } from "./fixtures.ts";

test("the card shares the account's link and counts the share when the sheet finishes", async ({ inWebApp: page }) => {
  await page.addInitScript(() => {
    (window as unknown as { shared: unknown[] }).shared = [];
    navigator.share = async (data) => { (window as unknown as { shared: unknown[] }).shared.push(data); };
  });
  await page.goto("/#/you");
  await page.reload();
  const card = page.getByLabel("Refer a friend");
  await expect(card).toContainText("You get a free week when they buy Monthly, and 2 if they buy Yearly.");
  const counted = page.waitForRequest((r) => r.url().endsWith("/api/v1/referral/shared") && r.method() === "POST");
  await card.getByRole("button", { name: "Share link" }).click();
  expect((await counted).postDataJSON()).toEqual({ via: "web-share" });
  const shared = await page.evaluate(() => (window as unknown as { shared: { text: string }[] }).shared);
  expect(shared[0]!.text).toMatch(/^A week of eait free: \S+\/r\/[A-HJ-NP-Z2-9]{6}$/);
});

test("without a share sheet it copies the link instead, and says so", async ({ inWebApp: page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.addInitScript(() => { delete (Navigator.prototype as { share?: unknown }).share; });
  await page.goto("/#/you");
  await page.reload();
  const counted = page.waitForRequest((r) => r.url().endsWith("/api/v1/referral/shared"));
  await page.getByLabel("Refer a friend").getByRole("button", { name: "Share link" }).click();
  expect((await counted).postDataJSON()).toEqual({ via: "copy" });
  await expect(page.getByText("Link copied")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/\/r\/[A-HJ-NP-Z2-9]{6}$/);
});
