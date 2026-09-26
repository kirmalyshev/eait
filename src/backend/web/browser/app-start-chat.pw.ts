// `/start/chat` on a deployment that HAS a web application (#499): one chat on the web, the web
// application's. The `app` project's backend is that deployment (`playwright.config.ts`); the `start`
// project's has no web application, and `chat.pw.ts` still drives `/start/chat` there as it always did.
//
// What tells the two chats apart on screen: the web application draws its tabs ("Diary", "Chat") and
// `/start/chat` draws a heading, "Your chat".
import { expect, test } from "./fixtures.ts";

test("the old chat's address opens the web application's chat", async ({ inWebApp: page }) => {
  await page.goto("/#/");
  await page.goto("/start/chat");
  await expect(page).toHaveURL(/\/#\/chat$/);
  await expect(page.getByRole("link", { name: "Diary" })).toBeVisible();
  await expect(page.getByPlaceholder("Tell Spud what you ate, or ask anything")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your chat" })).toHaveCount(0);
});

test("so does the short link", async ({ inWebApp: page }) => {
  await page.goto("/#/");
  await page.goto("/chat");
  await expect(page).toHaveURL(/\/#\/chat$/);
  await expect(page.getByRole("link", { name: "Diary" })).toBeVisible();
});

test("the plan page's way into the conversation is the web application's chat", async ({ inWebApp: page }) => {
  await page.goto("/start/plan");
  await page.getByRole("link", { name: "Open the chat" }).click();
  await expect(page).toHaveURL(/\/#\/chat$/);
  await expect(page.getByRole("link", { name: "Diary" })).toBeVisible();
});
