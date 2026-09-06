// The flow itself: sign in, onboard, land in the chat.
import { expect, onboard, signIn, test } from "./fixtures.ts";

test("a person signs in, answers the questions, and reaches their plan", async ({ page }) => {
  await signIn(page, `pw-smoke-${Date.now()}`);
  await onboard(page);
  await expect(page.getByRole("heading", { name: "Your plan" })).toBeVisible();
  // The plan page is the way into the conversation.
  await page.getByRole("link", { name: "Open the chat" }).click();
  await expect(page).toHaveURL(/\/start\/chat/);
});

test("the chat is empty for a new account, and the composer is there", async ({ signedIn }) => {
  await expect(signedIn.getByRole("heading", { name: "Your chat" })).toBeVisible();
  await expect(signedIn.getByPlaceholder("What did you eat?")).toBeVisible();
});
