// Refer a friend in the web APPLICATION (#899): the card above the settings list, one Share link
// button — the browser's share sheet where there is one, else the clipboard — and the share is
// counted only once it finished.
import { expect, test } from "./fixtures.ts";

test("the card shares the account's link and counts the share when the sheet finishes", async ({ inWebApp: page }) => {
  // Strings, not functions: this suite typechecks without the DOM library.
  await page.addInitScript("window.shared = []; navigator.share = async (data) => { window.shared.push(data); };");
  await page.goto("/#/you");
  await page.reload();
  const card = page.getByLabel("Refer a friend");
  await expect(card).toContainText("You get a free week when they buy Monthly, and 2 if they buy Yearly.");
  const counted = page.waitForRequest((r) => r.url().endsWith("/api/v1/referral/shared") && r.method() === "POST");
  await card.getByRole("button", { name: "Share link" }).click();
  expect((await counted).postDataJSON()).toEqual({ via: "web-share" });
  const shared = await page.evaluate("window.shared") as { text: string }[];
  expect(shared[0]!.text).toMatch(/^A week of eait free: \S+\/r\/[A-HJ-NP-Z2-9]{6}$/);
});

test("without a share sheet it copies the link instead, and says so", async ({ inWebApp: page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.addInitScript("delete Navigator.prototype.share;");
  await page.goto("/#/you");
  await page.reload();
  const counted = page.waitForRequest((r) => r.url().endsWith("/api/v1/referral/shared"));
  await page.getByLabel("Refer a friend").getByRole("button", { name: "Share link" }).click();
  expect((await counted).postDataJSON()).toEqual({ via: "copy" });
  await expect(page.getByText("Link copied")).toBeVisible();
  expect(await page.evaluate("navigator.clipboard.readText()")).toMatch(/\/r\/[A-HJ-NP-Z2-9]{6}$/);
});

// Review of #600: what the referral weeks mean for this account, drawn from the server's numbers —
// the bank while a subscription runs, the date while the bonus is what keeps the account in.
const withProfile = async (page: import("@playwright/test").Page, edit: (p: Record<string, any>) => void) => {
  await page.route("**/api/v1/profile", async (route) => {
    const res = await route.fetch();
    const body = await res.json() as Record<string, any>;
    edit(body);
    await route.fulfill({ response: res, json: body });
  });
  await page.goto("/#/you");
  await page.reload();
};

test("a paying referrer is told the whole weeks banked behind the subscription", async ({ inWebApp: page }) => {
  await withProfile(page, (p) => { p.referral.bankedDays = 14; });
  await expect(page.getByLabel("Refer a friend")).toContainText("Free weeks banked: 2. Used if you stop.");
});

test("a bank that is not whole weeks is told in days", async ({ inWebApp: page }) => {
  await withProfile(page, (p) => { p.referral.bankedDays = 10; });
  await expect(page.getByLabel("Refer a friend")).toContainText("Free days banked: 10. Used if you stop.");
});

test("while the bonus keeps the account in, the card says until when", async ({ inWebApp: page }) => {
  await withProfile(page, (p) => {
    p.entitlement.active = true;
    p.entitlement.bonusUntil = "2026-10-31T12:00:00.000Z";
  });
  await expect(page.getByLabel("Refer a friend")).toContainText("eait is yours until 31 Oct.");
});

// The board's status lines, with real plurals (#600 review).
test("a friend on their free week reads as the board draws it", async ({ inWebApp: page }) => {
  await withProfile(page, (p) => { Object.assign(p.referral, { joined: 1, subscribed: 0, weeksEarned: 0 }); });
  await expect(page.getByLabel("Refer a friend")).toContainText("1 friend joined · on their free week");
});

test("earned weeks and the counts read as the board draws them", async ({ inWebApp: page }) => {
  await withProfile(page, (p) => { Object.assign(p.referral, { joined: 2, subscribed: 1, weeksEarned: 2 }); });
  const card = page.getByLabel("Refer a friend");
  await expect(card).toContainText("2 free weeks earned");
  await expect(card).toContainText("2 friends joined · 1 subscribed");
});
