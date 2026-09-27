// `/start/chat` on a deployment that HAS a web application (#499): one chat on the web, the web
// application's. The `app` project's backend is that deployment (`playwright.config.ts`); the `start`
// project's has no web application, and `chat.pw.ts` still drives `/start/chat` there as it always did.
//
// What tells the two chats apart on screen: the web application draws its tabs ("Home", "Chat") and
// `/start/chat` draws a heading, "Your chat".
import { expect, test } from "./fixtures.ts";

test("the old chat's address opens the web application's chat", async ({ inWebApp: page }) => {
  await page.goto("/#/");
  await page.goto("/start/chat");
  await expect(page).toHaveURL(/\/#\/chat$/);
  await expect(page.getByRole("link", { name: "Home" })).toBeVisible();
  await expect(page.getByPlaceholder("Tell Spud what you ate, or ask anything")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your chat" })).toHaveCount(0);
});

test("so does the short link", async ({ inWebApp: page }) => {
  await page.goto("/#/");
  await page.goto("/chat");
  await expect(page).toHaveURL(/\/#\/chat$/);
  await expect(page.getByRole("link", { name: "Home" })).toBeVisible();
});

test("the plan offers no chat link — the sign-up is its one way on; the old address still opens the app's", async ({ inWebApp: page }) => {
  // W3 (#90): the plan's Continue is the consent screen and nothing else links a conversation —
  // the app's chat is reached through the handoff, not a button on the plan.
  await page.goto("/start/plan");
  await expect(page.getByRole("link", { name: "Open the chat" })).toHaveCount(0);
  await page.goto("/start/chat");
  await expect(page).toHaveURL(/\/#\/chat$/);
  await expect(page.getByRole("link", { name: "Home" })).toBeVisible();
});
