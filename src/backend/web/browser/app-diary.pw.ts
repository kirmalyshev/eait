// The web application's Home — the W4 board (#91, built under #164): the week strip, the calorie
// card with its left/eaten toggle, the macro cards the dots page between, and the meal rows that
// open `#/meal/:id`. All of it drawn from the server's day read.
//
// What the pre-redesign diary pinned that no longer exists: the `.big` headline is the card's
// `.kfig` over its `.klab` label, the `.daybar` is the top bar's `.drow`, the `.macros .stat-num`
// counters are `.mcard`s, and the weight-source line (#609) is not on this board at all — W4
// dropped it, so its four specs went with it rather than re-assert a sentence nobody draws.
import type { Page } from "@playwright/test";
import type { DayResponse, ProfileResponse } from "@eait/shared/contract";
import { expect, logMeal, sessionToken, test } from "./fixtures.ts";

/** Grouped the reader's way — "1,896" in English, "1.896" in German — same formatter the page uses. */
const n = (tag: string) => (x: number) => new Intl.NumberFormat(tag, { maximumFractionDigits: 0 }).format(x);

/**
 * Today's diary, with what was eaten set to `target + delta` on its way to the page.
 *
 * THE GLOB IS ANCHORED AT THE QUERY — `day?*`, not `day*`: the week strip reads `/diary/days`
 * (`DaysResponse`, no `targets`/`totals`) in the same draw, and the unanchored pattern used to
 * catch it and throw inside this helper's own edit (#168).
 */
async function dayAt(page: Page, delta: number): Promise<number> {
  // No meal on the account and `/#/` is the first-meal flow (#42), not the diary.
  await logMeal(page);
  let target = 0;
  await page.route("**/api/v1/diary/day?*", async (route) => {
    const res = await route.fetch();
    const body = (await res.json()) as DayResponse;
    target = body.targets.kcal;
    body.totals.kcal = target + delta;
    await route.fulfill({ response: res, json: body });
  });
  await page.goto("/#/");
  await page.reload();
  await expect(page.locator(".dayc .hk .fig")).toBeVisible();
  return target;
}

test("the calorie card says what is LEFT today, and a tap turns it to what was eaten", async ({ inWebApp: page }) => {
  const target = await dayAt(page, -550);
  const card = page.locator(".dayc .hk");
  await expect(card).not.toHaveClass(/over/);
  // The board's pair: the figure over its label — "550" over "kcal left", not one sentence.
  await expect(card.locator(".fig")).toHaveText("550");
  const toggle = card.locator(".lbl");
  await expect(toggle).toHaveText(/kcal left/);
  // The toggle's other face is the eaten figure under "kcal eaten".
  await toggle.click();
  await expect(card.locator(".fig")).toHaveText(n("en-GB")(target - 550));
  await expect(toggle).toHaveText(/kcal eaten/);
});

test("a past day draws the compact card — the figure over 'eaten of plan', no toggle", async ({ inWebApp: page }) => {
  // A meal moved to yesterday is a REAL past day: `Move to yesterday` is the re-date route.
  await logMeal(page);
  const first = await page.request.get("/api/v1/diary/day", {
    headers: { authorization: `Bearer ${await sessionToken(page)}` },
  });
  const today = (await first.json()) as DayResponse;
  const mealId = today.meals[0]!.id;
  const moved = await page.request.post(`/v1/meals/${mealId}/redate`, {
    headers: { authorization: `Bearer ${await sessionToken(page)}`, "content-type": "application/json" },
    data: { dayOffset: 1 },
  });
  const yesterday = ((await moved.json()) as { date: string }).date;

  await page.goto("/#/");
  if (await page.locator(`.week [data-date="${yesterday}"]`).count() === 0) await page.keyboard.press("Shift+ArrowLeft");
  await page.locator(`.week [data-date="${yesterday}"]`).click();
  await expect(page.locator(`.week .dy.now[data-date="${yesterday}"]`)).toBeVisible();

  const res = await page.request.get(`/api/v1/diary/day?date=${yesterday}`, {
    headers: { authorization: `Bearer ${await sessionToken(page)}` },
  });
  const day = (await res.json()) as DayResponse;
  const card = page.locator(".dayc .hk");
  const en = n("en-GB");
  // F reads a finished day as what was EATEN — the figure over "kcal eaten", the plan in the label.
  await expect(card.locator(".fig")).toHaveText(en(Math.round(day.totals.kcal)));
  await expect(card.locator(".lbl")).toHaveText("kcal eaten");
  await expect(card).toHaveAttribute("aria-label", `kcal eaten · ${en(day.totals.kcal)} of ${en(day.targets.kcal)}`);
  // The left/eaten toggle exists only on today-with-meals — a finished day has nothing left to spend.
  await expect(page.locator("button.hk")).toHaveCount(0);
});

test("the diary is grouped and worded in the account's language, not the browser's", async ({ inWebApp: page }) => {
  // The picker writes `profile.lang` and every string on the page reads it. Asserted through the
  // PROFILE rather than through the picker, because what is being checked is that the language
  // reaches the render — the picker's own write is covered by `copy.i18n.test.ts` and by the unit
  // tests around `PATCH /v1/profile`.
  await page.route("**/api/v1/profile", async (route) => {
    const res = await route.fetch();
    const body = (await res.json()) as { profile: { lang: string } };
    body.profile.lang = "de";
    await route.fulfill({ response: res, json: body });
  });
  const target = await dayAt(page, -550);
  await expect(page.locator(".dayc .hk .fig")).toHaveText("550");
  await expect(page.locator(".dayc .hk .lbl")).toHaveText(/kcal übrig/);
  const de = n("de-DE");
  await page.locator(".dayc .hk .lbl").click();
  await expect(page.locator(".dayc .hk .fig")).toHaveText(de(target - 550));
  await expect(page.locator(".dayc .hk .lbl")).toHaveText(/kcal gegessen/);
  // The bar names the viewed day in the account's language too — "Montag 28 September".
  await expect(page.locator(".week .dy.now")).toHaveAttribute("aria-label",
    new Intl.DateTimeFormat("de-DE", {
      timeZone: "UTC", dateStyle: "full",
    }).format(new Date(`${await serverToday(page)}T12:00:00Z`)),
  );
  // And the document says which language it is in, because a screen reader picks a voice from it.
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  // The picker lives on You since #52, showing the language being read — and in it.
  await page.goto("/#/you");
  await expect(page.locator("select.pick")).toHaveValue("de");
});

test("over target says by how much, as a warning rather than a negative number", async ({ inWebApp: page }) => {
  await dayAt(page, 310);
  // The over day's figure is the OVERAGE under "kcal over", the card carrying the warn state.
  await expect(page.locator(".dayc .hk .fig")).toHaveText("310");
  await expect(page.locator(".dayc .hk .lbl")).toHaveText(/kcal over/);
  await expect(page.locator(".dayc .hk")).toHaveClass(/over/);
});

// ── The bar's date row and the week strip (#71, #164) ─────────────────────────────────────────

/** The full date as the page writes it, for a `YYYY-MM-DD` — midday UTC, like `dateText`. */
const fullDate = (d: string): string => new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC", weekday: "long", day: "numeric", month: "long",
}).format(new Date(`${d}T12:00:00Z`));

/** Today's `YYYY-MM-DD` on the account's own calendar — the server sends its zone in the profile. */
async function serverToday(page: Page): Promise<string> {
  const res = await page.request.get("/api/v1/profile", {
    headers: { authorization: `Bearer ${await sessionToken(page)}` },
  });
  const me = (await res.json()) as ProfileResponse;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: me.timezone, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

test("the bar names the viewed day in full, and today has no 'next'", async ({ inWebApp: page }) => {
  await logMeal(page);
  const date = fullDate(await serverToday(page));
  await page.goto("/#/");
  // F: no bar arrows — the strip's raised cell names today, and the days after it are disabled.
  await expect(page.locator(`.week .dy.now[data-date="${await serverToday(page)}"]`)).toBeVisible();
  await expect(page.locator(".week button.dy[data-date]").first()).toBeEnabled();
  await expect(page.locator(".week .dy.fut").first()).toBeDisabled();
  // On today-with-meals the left column is "Recent" — the date is written once.
  await expect(page.getByText("Recent", { exact: true })).toBeVisible();
  await expect(page.getByText(date, { exact: true })).toHaveCount(0);
});

test("the switcher and the week strip both move the viewed day", async ({ inWebApp: page }) => {
  await logMeal(page);
  const today = await serverToday(page);
  await page.goto("/#/");

  // While the week slides in, the old and the new strip are both in the DOM: name the date.
  const label = (d: string) => page.locator(`.week .dy.now[data-date="${d}"]`);
  await expect(label(today)).toBeVisible();
  await page.keyboard.press("Shift+ArrowLeft");
  const oneBack = new Date(`${today}T12:00:00Z`);
  oneBack.setUTCDate(oneBack.getUTCDate() - 7);
  const d1 = oneBack.toISOString().slice(0, 10);
  await expect(label(d1)).toBeVisible();
  // The strip's raised cell follows the day being looked at.
  await expect(page.locator(`.week .dy.now[data-date="${d1}"]`)).toBeVisible();

  // The strip's own cell is the other door — tap a day and the whole board follows it. The cell
  // is read, not computed: the strip always holds the VIEWED week, so "yesterday" is not always
  // in it (a Monday's is not), but a past sibling of the raised cell always is.
  await page.keyboard.press("Shift+ArrowRight");
  await expect(label(today)).toBeVisible();
  // There is no next week past today: the key stays on today.
  await page.keyboard.press("Shift+ArrowRight");
  await expect(label(today)).toBeVisible();
  const cell = label(today).locator("xpath=..").locator("button.dy[data-date]").first(); // the strip of the viewed week
  const picked = (await cell.getAttribute("data-date"))!;
  await cell.click();
  await expect(label(picked)).toBeVisible();
  await expect(page.locator(`.week .dy.now[data-date="${picked}"]`)).toBeVisible();
});

// ── The macro cards and their page dots ───────────────────────────────────────────────────────

test("a macro under its target reads 'left', over its cap reads 'over' — ringed in its own tone", async ({ inWebApp: page }) => {
  await logMeal(page);
  let proteinTarget = 0;
  await page.route("**/api/v1/diary/day?*", async (route) => {
    const res = await route.fetch();
    const body = (await res.json()) as DayResponse;
    proteinTarget = body.targets.protein_g;
    body.totals.protein_g = 10; // under the target → "{n} g" over "Protein left"
    body.targets.satfat_g = 20; // declared cap
    body.totals.satfat_g = 30; // over it → "Sat fat over"
    await route.fulfill({ response: res, json: body });
  });
  await page.goto("/#/");
  await page.reload();

  // Page 1 is protein/carbs/fat: an under-target row prints what's left and fills its bar in
  // the macro's own colour — never plain black. The figure's expectation is built once the mocked
  // draw is up: `proteinTarget` is the handler's own read of the answer it edited.
  const protein = page.locator(".mrow", { hasText: "protein" });
  await expect(protein.locator("b")).toBeVisible();
  await expect(protein.locator("b")).toHaveText(`${n("en-GB")(Math.round(proteinTarget) - 10)} g left`);
  await expect(protein.locator(".bar i")).toHaveAttribute("style", /var\(--macro-protein\)/);

  // Page 2 — saturated fat, fibre, sugar, sodium — sits behind the second dot. Sat fat past its
  // cap reads "over" and fills ink, the row's over state.
  await page.getByRole("button", { name: "Page 2 of 2" }).click();
  const satfat = page.locator(".mrow.ov", { hasText: "sat fat" });
  await expect(satfat.locator("b")).toHaveText("10 g over"); // the overage, not the total
  await expect(satfat.locator(".bar i")).toHaveAttribute("style", /var\(--ink\)/);
});

test("a macro past its target reads 'over', under a cap reads 'left' — and no 'tap a meal' caption exists", async ({ inWebApp: page }) => {
  await logMeal(page);
  await page.route("**/api/v1/diary/day?*", async (route) => {
    const res = await route.fetch();
    const body = (await res.json()) as DayResponse;
    body.totals.protein_g = 9_999; // past the target → "Protein over", ring closed
    body.targets.satfat_g = 40;
    body.totals.satfat_g = 5; // under the cap → "Sat fat left"
    await route.fulfill({ response: res, json: body });
  });
  await page.goto("/#/");
  await page.reload();
  const protein = page.locator(".mrow.ov", { hasText: "protein" });
  await expect(protein.locator("b")).toHaveText(/ g over$/);
  await page.getByRole("button", { name: "Page 2 of 2" }).click();
  await expect(page.locator(".mrow", { hasText: "sat fat" }).locator("b")).toHaveText("35 g left");
  // The phone's "Tap a meal to check or fix the numbers" line never existed here, and stays absent.
  await expect(page.getByText(/tap a meal/i)).toHaveCount(0);
});

test("a meal row opens its own detail on the viewed day", async ({ inWebApp: page }) => {
  await logMeal(page);
  const res = await page.request.get("/api/v1/diary/day", {
    headers: { authorization: `Bearer ${await sessionToken(page)}` },
  });
  const day = (await res.json()) as DayResponse;
  const id = day.meals[0]!.id;
  await page.goto("/#/");
  const row = page.locator(".dlist a.meal").first();
  await expect(row).toHaveAttribute("href", `#/meal/${id}?d=${day.date}`);
  await row.click();
  await expect(page).toHaveURL(new RegExp(`#\\/meal\\/${id}`));
});

test("a tab change while the first draw is still loading draws one page, not two", async ({ inWebApp: page }) => {
  // A meal first, so the draw this interrupts is the diary's rather than the first-meal flow's.
  await logMeal(page);
  // The first draw waits on the profile. A hash change in that window starts a second draw, and
  // both used to append their nav and body when they resumed: two tab bars, two screens.
  let release = () => {};
  const held = new Promise<void>((r) => { release = r; });
  await page.route("**/api/v1/profile", async (route) => {
    await held;
    await route.continue();
  });
  const asked = page.waitForRequest("**/api/v1/profile");
  await page.reload();
  await asked;
  await page.evaluate(`location.hash = "#/"`);
  release();

  await expect(page.locator(".dayc .hk .fig")).toBeVisible();
  await expect(page.locator("nav")).toHaveCount(1);
  // The column IS the main landmark since #87's split — `.wcol`, the class `main` carries.
  await expect(page.locator("main.wcol")).toHaveCount(1);
});
