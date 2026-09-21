// The web application's MEAL screen and the settle flow (#28).
//
// The day says a plate is a guess; this is where somebody does something about it. What is driven
// here is the whole loop and not a rendering: a real photo is logged through the real route, the
// analyzer's question is answered by tapping the option, the answer goes to `POST /v1/messages`
// with `focusMealId` exactly as the phone's chip does, and the figure is checked again afterwards
// — on this screen AND on the day above it, because one write has to settle both.
//
// THE ANALYZER IS ASKED FOR THE QUESTION, not handed one. An earlier draft of this spec injected
// the question into the day response instead, and it passed every assertion up to the tap and
// then did nothing: `handleText` frames a turn as an answer only when the question is on the
// STORED meal, so a client-side one settles nothing. The photograph below is sized to land on the
// fifth of plates the demo analyzer genuinely asks about.
import { readFileSync } from "node:fs";
import { expect, test } from "./fixtures.ts";

/**
 * A photograph the demo analyzer reads BADLY, and therefore asks about.
 *
 * NOTHING HERE IS FAKED. `demo.ts` derives its confidence and its one question from
 * `hash(caption + images.length + bytes.length)` — the fifth where `seed % 5 === 0` is a plate it
 * could not read, and that is the plate it puts a question on, "which is what makes the chips
 * reachable from `--demo` and from the E2E suite" in its own words. So the spec chooses a LENGTH
 * that lands there rather than intercepting the day and inventing a question the server has never
 * heard of: the settle below only works because `handleText` finds the question on the STORED
 * meal, and an injected one would make this pass while the real flow did nothing.
 *
 * A PNG header and then padding: `imageMime` sniffs the magic bytes and the analyzer reads only
 * the length, so this is the smallest honest photograph for the purpose.
 */
const FIXTURE = "src/backend/web/browser/fixture-meal.png";
/**
 * The checked-in photograph, padded to a length the demo analyzer reads BADLY.
 *
 * `demo.ts` derives both its confidence and its one question from
 * `hash(caption + images.length + bytes.length)`, and the fifth where `seed % 5 === 0` is the
 * plate it could not read — the plate it puts a question on, "which is what makes the chips
 * reachable from `--demo` and from the E2E suite" in its own words. Three bytes after the PNG's
 * IEND move the length onto that fifth and every decoder ignores them, so this is a REAL image
 * that the analyzer is genuinely unsure about.
 *
 * NOT AN INJECTED QUESTION. An earlier draft of this spec put one into the day response instead;
 * it passed every assertion up to the tap and then settled nothing, because `handleText` frames a
 * turn as an answer only when the question is on the STORED meal.
 */
const GUESSED_LENGTH = 6958;
const guessedPhoto = () => {
  const bytes = readFileSync(FIXTURE);
  return {
    name: "plate.png",
    mimeType: "image/png",
    buffer: Buffer.concat([bytes, Buffer.alloc(GUESSED_LENGTH - bytes.length)]),
  };
};

/**
 * Log an ordinary plate, then the guessed one — both through the real route.
 *
 * TWO, BECAUSE THE FIRST MEAL IS NEVER ASKED ABOUT. `mayAsk` refuses a question on an account's
 * first analysis: copy.md gives that card Spud's verdict, and an interrogation on top of the one
 * screen that has to show what this product does is one screen doing two jobs. A spec that logs
 * one photo and waits for a question waits forever.
 */
async function logTheGuess(page: import("@playwright/test").Page): Promise<void> {
  // TWO ANALYSES AND A SIGN-IN do not fit the default 30 s budget: the demo analyzer writes its
  // JSON in six pieces with a beat between them, on purpose, so the pending card is visible under
  // every flow. Marked slow rather than shortened — the choreography is the thing being driven.
  test.slow();
  const picker = page.locator('input[type="file"]');
  for (const file of [FIRST, guessedPhoto()]) {
    await picker.setInputFiles(file);
    // WAIT FOR THE TURN, not for the word "kcal" in the thread: after the first meal that text is
    // already there, so a second iteration keyed on it returns at once and the navigation below
    // races a photo still being analysed.
    const done = page.waitForResponse((r) => r.url().endsWith("/meals/photo"), { timeout: 30_000 });
    await page.getByRole("button", { name: "Send the photo" }).click();
    await done;
    // AND THEN FOR THE CLIENT'S OWN TAIL. The composer clears the picker AFTER the response, so
    // setting the next file the moment the response lands hands it to a handler that is about to
    // empty it — the second send then answered "Choose a photo first." and no request went out.
    await expect(picker).toHaveValue("");
  }
  await expect(page.locator(".thread li")).not.toHaveCount(0);
}

/** The plate before it. Nothing about this one matters except that it is not the guessed one. */
const FIRST = FIXTURE;

test("a guessed day names the one thing worth fixing, and it leads to the meal", async ({ inWebApp: page }) => {
  await logTheGuess(page);
  await page.goto("/#/");

  // ONE worded flag on the screen, and it is the amber one. The question itself is the reason —
  // nothing here writes a second sentence explaining what the model already said.
  await expect(page.locator(".note .lab.amber")).toHaveText("One thing worth fixing");
  await expect(page.locator(".note")).toContainText("Was it cooked in oil, or dry?");
  await expect(page.locator(".lab.amber")).toHaveCount(1);

  await page.getByRole("button", { name: "Settle it" }).click();
  await expect(page).toHaveURL(/#\/meal\//);
});

test("the meal screen shows what it was read as, and settling it makes the number exact", async ({ inWebApp: page }) => {
  await logTheGuess(page);
  await page.goto("/#/");
  // ONE row carries the tint and the outline, and it is the one whose figure is hedged. Located
  // BY that class rather than by position: which of the two plates is the guess is the analyzer's
  // decision, and a spec that assumes an order is asserting the sort.
  await expect(page.locator(".meal.rowsel")).toHaveCount(1);
  const row = page.locator(".meal.rowsel");
  await expect(row.locator(".abt")).toHaveText("about");
  await row.click();

  // THE MEAL. What it was read as, item by item, with the figures right-aligned and tabular.
  await expect(page).toHaveURL(/#\/meal\//);
  await expect(page.locator("h3")).toBeVisible();
  await expect(page.locator(".card").first()).toContainText("A guess");
  await expect(page.locator("table tr")).not.toHaveCount(0);
  await expect(page.locator("table td.num.mono").first()).toBeVisible();
  // The macros, and the one with a target gets the bar. Fat and carbs have no target in this
  // product, so they print what was eaten and no bar rather than an invented denominator.
  await expect(page.locator(".tile")).toHaveCount(3);
  await expect(page.locator(".tile .bar")).toHaveCount(1);

  // THE PHOTOGRAPH, fetched with the bearer rather than pointed at. An `<img src>` to this API
  // sends no Authorization header and comes back 401, which renders as a broken image over the
  // hatch — so this asserts the picture actually arrived.
  const shot = page.locator("img.ph");
  await expect(shot).toBeVisible();
  expect(await shot.getAttribute("src")).toMatch(/^data:image\//);
  // DECODED, not merely present: a 401 renders as a broken image with the alt text over the hatch,
  // and so does a data: URL built from something that is not an image.
  // Spelled without a DOM type: these specs typecheck under the backend's config, which has none.
  const decoded = await shot.evaluate((i) => (i as unknown as { naturalWidth: number }).naturalWidth);
  expect(decoded).toBeGreaterThan(0);

  // THE SETTLE FLOW. Option rows, and the answer is the ordinary turn.
  await expect(page.locator(".opt")).toHaveCount(2);
  const sent = page.waitForRequest((r) => r.url().endsWith("/v1/messages") && r.method() === "POST");
  await page.getByRole("button", { name: "In oil" }).click();
  // `focusMealId` is what makes it a correction rather than a second plate: the server frames the
  // turn with the question the meal is standing on, and only then is the text an answer.
  const body = JSON.parse((await sent).postData() ?? "{}") as { text: string; focusMealId?: string };
  expect(body.text).toBe("In oil");
  expect(typeof body.focusMealId).toBe("string");

  // AFTERWARDS: the question is gone, the meal says so once, and the hedge has left the figure.
  await expect(page.locator(".settled")).toHaveText("Answered — these numbers are exact now.");
  await expect(page.locator(".opt")).toHaveCount(0);
  await expect(page.locator(".abt")).toHaveCount(0);

  // AND THE DAY ABOVE IT, from the same write: no flag, no hedge, no tinted row.
  await page.getByRole("link", { name: "Back to the day" }).click();
  await expect(page.locator(".big")).toBeVisible();
  await expect(page.locator(".lab.amber")).toHaveCount(0);
  await expect(page.locator(".abt")).toHaveCount(0);
  await expect(page.locator(".meal.rowsel")).toHaveCount(0);
});

test("the thread's own meal card carries the grammar, and leads to the meal", async ({ inWebApp: page }) => {
  // THE SAME PERSON MEETS BOTH SURFACES. A card in the thread used to be a sentence with an exact
  // figure in it, whatever the analyzer thought of the plate — so the one screen a guess is most
  // likely to be read on was the one screen that did not say it was a guess. And the settle flow
  // was reachable only from the day, while the question arrives here.
  await logTheGuess(page);
  const card = page.locator(".thread .meal-card.rowsel");
  await expect(card).toHaveCount(1);
  await expect(card.locator(".abt")).toHaveText("about");
  // The measured plate beside it keeps every digit and carries no tint.
  await expect(page.locator(".thread .meal-card")).toHaveCount(2);
  await expect(page.locator(".thread .meal-card:not(.rowsel) .abt")).toHaveCount(0);

  await card.click();
  await expect(page).toHaveURL(/#\/meal\//);
  await expect(page.locator(".opt")).toHaveCount(2);
});

test("a meal id that names nothing says so rather than throwing", async ({ inWebApp: page }) => {
  await page.goto(`/#/meal/${crypto.randomUUID()}`);
  await expect(page.getByText("A meal that is no longer logged")).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to the day" })).toBeVisible();
});

test("entry is the arrival, with the wash and the three steps", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".entry")).toBeVisible();
  await expect(page.locator(".entry .wash")).toBeVisible();
  // What happens, in order, before anything is asked for — the design's arrival says the steps
  // rather than selling, and nothing is paid for until there is something on the screen.
  await expect(page.locator(".srow")).toHaveCount(3);
  await expect(page.locator(".srow").first()).toContainText("Answer eight things");
  await expect(page.getByRole("link", { name: "Sign in" })).toHaveClass(/btn/);
});
