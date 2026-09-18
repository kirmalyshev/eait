// The language picker on `/start`, driven the way a person drives it (#358).
//
// The unit tests prove the tables are complete and that `plan()` renders the right options; what
// only a browser can prove is that pressing Save actually changes the page a person is looking at —
// the write, the redirect, and every renderer past it reading the account rather than a constant.

import { expect, onboard, signIn, test } from "./fixtures.ts";

test("picking a language changes the page, and the page says which language it is", async ({ page }) => {
  await signIn(page, `pw-lang-${Date.now()}`);
  await onboard(page);
  await expect(page.getByRole("heading", { name: "Your plan" })).toBeVisible();
  // English until somebody says otherwise: `Accept-Language` seeded it and nothing has overruled it.
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  const picker = page.getByLabel("Language");
  await expect(picker).toHaveValue("en");
  await picker.selectOption("de");
  await page.getByRole("button", { name: "Save" }).click();

  // The plan page comes back in German — heading, lead, and the picker itself, which is now
  // labelled in German and still shows the language being read.
  await expect(page.getByRole("heading", { name: "Dein Plan" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  await expect(page.getByLabel("Sprache")).toHaveValue("de");

  // And it is the ACCOUNT that changed, not this page: the chat, rendered by a different function
  // from a different route, comes back in German too.
  await page.getByRole("link", { name: "Chat öffnen" }).click();
  await expect(page).toHaveURL(/\/start\/chat/);
  await expect(page.getByRole("heading", { name: "Dein Chat" })).toBeVisible();
  await expect(page.getByPlaceholder("Was hast du gegessen?")).toBeVisible();
});

test("the endonyms are what the picker offers, never a translated list", async ({ page }) => {
  await signIn(page, `pw-lang-names-${Date.now()}`);
  await onboard(page);
  // A list of languages written in the language somebody is trying to LEAVE is the one list they
  // cannot read, so each option is that language's name in itself — on every page, in every
  // language. Checked after a switch, which is where a translated list would show itself.
  const names = ["English", "Français", "Deutsch", "Italiano", "Español", "Tiếng Việt", "Bahasa Indonesia", "Русский"];
  for (const name of names) await expect(page.getByLabel("Language").getByText(name)).toBeAttached();
  await page.getByLabel("Language").selectOption("ru");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { name: "Твой план" })).toBeVisible();
  for (const name of names) await expect(page.getByLabel("Язык").getByText(name)).toBeAttached();
});
