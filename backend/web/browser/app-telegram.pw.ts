// Connect Telegram in the web APPLICATION: drawn only while the server names a bot, and the tap mints
// a pairing code at that moment and goes to the bot with it.
//
// A demo server never runs the connector, so the bot's name is answered at the network, in the
// profile's own shape. The code is the real one, minted by the demo server's own `POST /v1/auth/pair`.
import type { ProfileResponse } from "@eait/shared/contract";
import { expect, test } from "./fixtures.ts";

test("no bot named, no link", async ({ inWebApp: page }) => {
  await page.goto("/#/");
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect Telegram" })).toHaveCount(0);
});

test("a named bot draws the link, and the tap goes to that bot with a fresh code", async ({ inWebApp: page }) => {
  await page.route("**/api/v1/profile", async (route) => {
    const res = await route.fetch();
    const body = (await res.json()) as ProfileResponse;
    body.telegramBot = "eait_test_bot";
    await route.fulfill({ response: res, json: body });
  });
  let landed = "";
  await page.route("https://t.me/**", async (route) => {
    landed = route.request().url();
    await route.fulfill({ contentType: "text/html", body: "<title>t.me</title>" });
  });
  await page.goto("/#/");
  // The profile is memoised per tab, so the edited one arrives with a fresh page.
  await page.reload();

  await page.getByRole("button", { name: "Connect Telegram" }).click();
  await expect.poll(() => landed).toMatch(/^https:\/\/t\.me\/eait_test_bot\?start=[0-9A-HJKMNP-TV-Z]{8}$/);
});
