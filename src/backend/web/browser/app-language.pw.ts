// The web APPLICATION's language picker, driven the way a person drives it.
//
// Its own file because `playwright.config.ts` splits the projects by FILE NAME: `app-*.pw.ts`
// runs against the application's origin, everything else against `/start`. `language.pw.ts`
// covers the `/start` picker, which is a different implementation on a different surface.

import { expect, test } from "./fixtures.ts";

// THE WEB APPLICATION's picker, driven the way a person drives it.
//
// `/start`'s is covered above. This one is a different implementation on a different surface —
// `frontend/main.ts` PATCHes the profile and then reloads the whole SPA rather than re-rendering,
// because a language read by forty render functions cannot change underneath them. No test at any
// level touched it: not a unit test of `PATCH /v1/profile { lang }`, and no spec in the app
// project ever calls `selectOption`. And it is the surface where a language OTHER than German has
// never been rendered in a browser at all.
test("the web app's own picker writes the account and comes back translated", async ({ inWebApp: page }) => {
  // Since #52 the picker's home is You — Diary · Chat · You is the whole of the top row.
  await page.goto("/#/you");
  const picker = page.getByLabel("Language");
  await expect(picker).toHaveValue("en");

  await picker.selectOption("ru");
  // The reload is the mechanism, so wait for the page to actually come back rather than for a
  // repaint that a re-render would also produce.
  await expect(page.locator("html")).toHaveAttribute("lang", "ru", { timeout: 15_000 });
  await expect(page.getByLabel("Язык")).toHaveValue("ru");

  // And it is the ACCOUNT, not this view: another route, rendered by other functions, in Russian.
  await page.goto("/#/chat");
  await expect(page.getByPlaceholder("Расскажи Spud, что было на тарелке, или спроси о чём угодно")).toBeVisible();
});
