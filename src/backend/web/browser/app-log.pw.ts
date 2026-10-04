// #92 — the log surface, `#/log`, in a real browser. The upload view (pick and drop), the
// reading scan, the logged card and its verdicts, the rough-guess question, the account's first
// verdict, the no-food refusal, and a failed analysis keeping its photo and handing it to Chat.
// Everything asserted is a server's answer or a computed value — the spec never derives a verdict.

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import type { DayResponse, ProfileResponse } from "@eait/shared/contract";
import { expect, logMeal, sessionToken, test } from "./fixtures.ts";

const FIXTURE = "src/backend/web/browser/fixture-meal.png";

// The screenshots this spec leaves are named for the commit they were taken on — the PR head
// (#92's review gate). `test-results/` is gitignored; the names carry the sha instead of the
// files living in the tree.
const SHA = execSync("git rev-parse --short HEAD").toString().trim();
const shot = async (page: Page, name: string) => {
  // The boards' rise delays end inside a second — a shot taken earlier catches a card mid-fade.
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `test-results/shots/w5-${SHA}-${name}.png`, fullPage: true });
};

async function server<T>(page: Page, path: string): Promise<T> {
  const res = await page.request.get(`/api/v1${path}`, { headers: { authorization: `Bearer ${await sessionToken(page)}` } });
  expect(res.status()).toBe(200);
  return await res.json() as T;
}

const uploadView = async (page: Page) => {
  await page.goto("/#/log");
  await expect(page.getByRole("heading", { name: "A photo of the meal" })).toBeVisible();
  await expect(page.getByText("Drop a photo here")).toBeVisible();
};

const pick = async (page: Page, note = "") => {
  await page.locator('input[type="file"]').setInputFiles(FIXTURE);
  if (note !== "") await page.getByPlaceholder(/Anything I can.?t see/).fill(note);
  await page.getByRole("button", { name: "Analyse" }).click();
};

test("a picked photo lands on the account's first verdict", async ({ inWebApp: page }) => {
  await uploadView(page);
  await shot(page, "log-upload");
  await pick(page);

  await expect(page.getByText("Your first macros")).toBeVisible();
  // Callouts are the analyzer's grams — two or more on the demo plate, each naming an item.
  await expect(page.locator(".hero .co").first()).toBeVisible();
  expect(await page.locator(".hero .co").count()).toBeGreaterThanOrEqual(2);
  // The card: meal name, kcal, the three macro chips, the computed verdict lines.
  await expect(page.locator(".card")).toContainText("kcal");
  await expect(page.locator(".vs .v").first()).toBeVisible();
  // Correct opens the meal's own fix panel — the meal's own id in the href, not a pattern (#148).
  const logged = (await server<DayResponse>(page, "/diary/day")).meals;
  await expect(page.getByRole("link", { name: "Correct" }))
    .toHaveAttribute("href", `#/meal/${logged.at(-1)!.id}?fix`);
  await shot(page, "log-first-verdict");

  // Continue leads to the plans paywall — W9's route (#96). Until it binds, the hash is where the
  // intent is recorded and the fallthrough keeps the shell.
  await page.getByRole("link", { name: "Continue" }).click();
  await expect(page).toHaveURL(/#\/pay/);
  expect((await server<DayResponse>(page, "/diary/day")).meals).toHaveLength(1);
});

test("a second photo draws the logged card, and Agree goes Home", async ({ inWebApp: page }) => {
  await logMeal(page);
  await uploadView(page);
  await pick(page);

  await expect(page.getByText(/Logged ·/)).toBeVisible();
  await expect(page.locator(".card").first()).toContainText("kcal");
  await expect(page.locator(".vs .v").first()).toBeVisible();
  // The day counter is the server's own totals: "… of 1,434 kcal" and "… left".
  await expect(page.getByText(/of [\d.,]+ ?kcal/)).toBeVisible();
  await expect(page.getByText(/left$/)).toBeVisible();
  // Edit is the meal's fix panel — `#/meal/<id>?fix`, this meal's own id (#148).
  const second = (await server<DayResponse>(page, "/diary/day")).meals[0]!.id;
  await expect(page.getByRole("link", { name: "Correct" })).toHaveAttribute("href", `#/meal/${second}?fix`);
  await shot(page, "log-logged");

  await page.getByRole("link", { name: "Agree" }).click();
  await expect(page).toHaveURL(/#\/$/);
  expect((await server<DayResponse>(page, "/diary/day")).meals).toHaveLength(2);
});

test("a photo dropped onto the zone is analysed like a picked one", async ({ inWebApp: page }) => {
  await logMeal(page);
  await uploadView(page);
  const b64 = readFileSync(FIXTURE).toString("base64");
  await page.evaluate(`(() => {
    const bytes = Uint8Array.from(atob(${JSON.stringify(b64)}), (c) => c.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], "dropped.png", { type: "image/png" }));
    const zone = document.querySelector(".drop");
    zone.dispatchEvent(new DragEvent("dragover", { bubbles: true, dataTransfer: dt }));
    zone.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer: dt }));
  })()`);
  await expect(page.locator(".drop")).toContainText("dropped.png");
  await page.getByRole("button", { name: "Analyse" }).click();
  await expect(page.getByText(/Logged ·/)).toBeVisible();
  expect((await server<DayResponse>(page, "/diary/day")).meals).toHaveLength(2);
});

test("the rough-guess card asks the server's question and chips correct the meal", async ({ inWebApp: page }) => {
  await logMeal(page);
  await uploadView(page);
  // "my lunch" is the demo caption whose seed lands confidence "low" — the engine then attaches
  // its MealQuestion ("Was it cooked in oil, or dry?" / In oil · Dry) to the logged result.
  await pick(page, "my lunch");

  await expect(page.getByText("Was it cooked in oil, or dry?")).toBeVisible();
  await expect(page.getByRole("button", { name: "In oil" })).toBeVisible();
  await shot(page, "log-rough");

  const mealId = (await server<DayResponse>(page, "/diary/day")).meals[0]!.id;
  const sent = page.waitForRequest((r) => r.method() === "POST" && r.url().includes("/api/v1/messages"));
  await page.getByRole("button", { name: "In oil" }).click();
  const req = await sent;
  const body = req.postDataJSON() as { text?: string; focusMealId?: string };
  // The chip is the one correction path — a text turn with THIS meal in focus, never a PATCH.
  expect(body.focusMealId).toBe(mealId);
  expect(body.text).toBe("In oil");
});

test("a photo with no food is refused, and that is not a failure", async ({ inWebApp: page }) => {
  await uploadView(page);
  await pick(page, "no food in this one");

  await expect(page.getByRole("heading", { name: "No food in that one" })).toBeVisible();
  await shot(page, "log-refused");
  // Refused means refused: nothing is logged, and the day is the server's to say it — this one
  // runs the REAL analyzer, so the empty day is its answer rather than a mock's (#148).
  expect((await server<DayResponse>(page, "/diary/day")).meals).toHaveLength(0);
  // Uncharged: the sample is still the account's to spend.
  expect((await server<ProfileResponse>(page, "/profile")).limits.sampleUsed).toBe(false);
  await page.getByRole("button", { name: "Try another photo" }).click();
  await expect(page.getByText("Drop a photo here")).toBeVisible();
});

test("a failed analysis keeps the photo and hands it to Chat", async ({ inWebApp: page }) => {
  await page.route("**/api/v1/meals/photo", (r) => r.fulfill({
    status: 200,
    contentType: "application/x-ndjson",
    body: JSON.stringify({ kind: "analysis-failed" }) + "\n",
  }));
  await uploadView(page);
  await pick(page, "a lunch that fails");

  // The state lives on Chat (states-failed is W7's drawing): the photo is kept, worded as the
  // refusal the server answered, with the send-again action beside it.
  await expect(page).toHaveURL(/#\/chat/);
  await expect(page.locator(".thread")).toContainText("a lunch that fails");
  await expect(page.locator(".thread li.me.failed")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Resend", exact: true })).toBeVisible();
  await shot(page, "log-failed-kept");
  // What the mocked stream CAN prove is the keep: the turn is in the outbox, held, its failure
  // marked. "Nothing logged" is the server's word — the real-refusal spec above reads it.
  // A string, because this file is typechecked without the DOM: the browser is where it runs.
  const kept = await page.evaluate<number>(`new Promise((resolve) => {
    const open = indexedDB.open("eait");
    open.onsuccess = () => {
      const get = open.result.transaction("outbox").objectStore("outbox").get("entries");
      get.onsuccess = () => resolve(Array.isArray(get.result) ? get.result.length : 0);
    };
    open.onerror = () => resolve(-1);
  })`);
  expect(kept).toBe(1);
});

test("with reduced motion the surface lands on its end state", async ({ inWebApp: page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await uploadView(page);
  await pick(page);
  // The scan is never part of the page while the photo is read — absent, not parked (#148).
  expect(await page.locator(".scan").count()).toBe(0);
  await expect(page.getByText("Your first macros")).toBeVisible();

  // The scan does not run and nothing animates: every element sits at its end state.
  const animating = await page.evaluate<string[]>(`(() =>
    [...document.querySelectorAll(".rise, .co, .pop, .grow, .draw, .settle, .count, .scan")]
      .filter((el) => getComputedStyle(el).animationName !== "none")
      .map((el) => el.className + ":" + getComputedStyle(el).animationName))()`);
  expect(animating).toEqual([]);
  await expect(page.locator(".hero .co").first()).toBeVisible();
  await shot(page, "log-first-verdict-reduced");
});

test("the grams question's chips send its text with the meal in focus", async ({ inWebApp: page }) => {
  await logMeal(page);
  await uploadView(page);
  // "about the grams" is the canned question's other shape — a number where the oil one is an
  // either/or (DEMO_GRAMS_QUESTION, the caption being the only channel a blind fake has).
  await pick(page, "about the grams");
  await expect(page.getByText("Was the rice about 250g?")).toBeVisible();
  await expect(page.getByRole("button", { name: "Half that" })).toBeVisible();

  const mealId = (await server<DayResponse>(page, "/diary/day")).meals[0]!.id;
  const sent = page.waitForRequest((r) => r.method() === "POST" && r.url().includes("/api/v1/messages"));
  await page.getByRole("button", { name: "Half that" }).click();
  expect((await sent).postDataJSON()).toMatchObject({ text: "Half that", focusMealId: mealId });
});

test("a plate over its declared cap says the detail under the card", async ({ inWebApp: page }) => {
  // The line lives on the logged-state card, so the account's first verdict is already done.
  await logMeal(page);
  // An `ldl` declaration sets the 13 g saturated-fat cap; the fixture plate measures 7.8 — a
  // share past BAD_SHARE, so the `verdictDetail` line owes the numbers it names.
  const res = await page.request.patch("/v1/profile", {
    headers: { authorization: `Bearer ${await sessionToken(page)}`, "content-type": "application/json" },
    data: { medical: ["ldl"] },
  });
  expect(res.status()).toBe(200);
  // The profile the log surface caches was fetched before the patch — reload so `me` reads it.
  await page.reload();
  await uploadView(page);
  await pick(page);
  await expect(page.getByText(/Saturated fat is high for one meal/)).toBeVisible();
});

test("an outcome the server does not name is kept, not dropped", async ({ inWebApp: page }) => {
  await page.route("**/api/v1/meals/photo", (r) => r.fulfill({
    status: 200,
    contentType: "application/x-ndjson",
    body: JSON.stringify({ kind: "outcome-unknown" }) + "\n",
  }));
  await uploadView(page);
  await pick(page, "a lunch that may have gone");
  // states-unknown (W7's card): the doubt worded as doubt, the turn held with a way out.
  await expect(page).toHaveURL(/#\/chat/);
  await expect(page.locator(".thread")).toContainText("a lunch that may have gone");
  await expect(page.locator(".thread li.me.failed")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Resend", exact: true })).toBeVisible();
});

test("a refused photo is not kept — the cap and the unreadable image are words, not drafts", async ({ inWebApp: page }) => {
  for (const [last, words] of [
    // LOG_COPY's wording since #231 — one sentence for both clients.
    [{ kind: "cap-exceeded", scope: "user" }, "Your daily allowance is spent. It resets at midnight — chat still works."],
    [{ kind: "unsupported-image" }, "That file is not a photo this can read. JPEG, PNG or WebP."],
  ] as const) {
    await page.route("**/api/v1/meals/photo", (r) => r.fulfill({
      status: 200,
      contentType: "application/x-ndjson",
      body: JSON.stringify(last) + "\n",
    }));
    await uploadView(page);
    await pick(page);
    // Words on the upload view — kept turns would land on Chat instead, and nothing does.
    await expect(page).toHaveURL(/#\/log/);
    await expect(page.locator(".notice")).toHaveText(words);
    await page.unroute("**/api/v1/meals/photo");
    await page.goto("/#/chat");
    await expect(page.getByRole("button", { name: "Send again" })).toHaveCount(0);
  }
});

test("more photos than a meal may hold are refused before upload", async ({ inWebApp: page }) => {
  await uploadView(page);
  // Five files against the four the server sent on `limits` — the tell is the bound's own words.
  await page.locator('input[type="file"]').setInputFiles(
    Array.from({ length: 5 }, (_, i) => ({
      name: `angle-${i}.png`, mimeType: "image/png", buffer: readFileSync(FIXTURE),
    })),
  );
  await expect(page.locator(".notice")).toHaveText("One meal takes up to 4 photos.");
});
