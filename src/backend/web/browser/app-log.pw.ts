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
const shot = (page: Page, name: string) =>
  page.screenshot({ path: `test-results/shots/w5-${SHA}-${name}.png`, fullPage: true });

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

  await expect(page.getByText("Your first verdict")).toBeVisible();
  // Callouts are the analyzer's grams — two or more on the demo plate, each naming an item.
  await expect(page.locator(".hero .co").first()).toBeVisible();
  expect(await page.locator(".hero .co").count()).toBeGreaterThanOrEqual(2);
  // The card: meal name, kcal, the three macro chips, the computed verdict lines.
  await expect(page.locator(".card")).toContainText("kcal");
  await expect(page.locator(".vs .v").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Correct" })).toHaveAttribute("href", /#\/chat\?focus=.+/);
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
  await expect(page.getByText(/of [\d.,]+ kcal/)).toBeVisible();
  await expect(page.getByText(/left$/)).toBeVisible();
  // Edit is the chat-with-focus handoff — `#/chat?focus=<mealId>`, the meal's own id.
  await expect(page.getByRole("link", { name: "Edit" })).toHaveAttribute("href", /#\/chat\?focus=.+/);
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

  await expect(page.getByText("Rough guess")).toBeVisible();
  await expect(page.getByText("Was it cooked in oil, or dry?")).toBeVisible();
  await expect(page.getByRole("button", { name: "In oil" })).toBeVisible();
  await shot(page, "log-rough");

  const sent = page.waitForRequest((r) => r.method() === "POST" && r.url().includes("/api/v1/messages"));
  await page.getByRole("button", { name: "In oil" }).click();
  const req = await sent;
  const body = req.postDataJSON() as { text?: string; focusMealId?: string };
  // The chip is the one correction path — a text turn with this meal in focus, never a PATCH.
  expect(body.focusMealId).toBeTruthy();
  expect(body.text).toBe("In oil");
});

test("a photo with no food is refused, and that is not a failure", async ({ inWebApp: page }) => {
  await uploadView(page);
  await pick(page, "no food in this one");

  await expect(page.getByRole("heading", { name: "No food in that one" })).toBeVisible();
  await shot(page, "log-refused");
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
  await expect(page.locator(".thread")).toContainText("That did not come back. Try it again.");
  await expect(page.getByRole("button", { name: "Send again" })).toBeVisible();
  await shot(page, "log-failed-kept");
  // Nothing was logged and the sample was given back — a failed free meal is a free retry.
  expect((await server<DayResponse>(page, "/diary/day")).meals).toHaveLength(0);
  expect((await server<ProfileResponse>(page, "/profile")).limits.sampleUsed).toBe(false);
});

test("with reduced motion the surface lands on its end state", async ({ inWebApp: page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await uploadView(page);
  await pick(page);
  await expect(page.getByText("Your first verdict")).toBeVisible();

  // The scan does not run and nothing animates: every element sits at its end state.
  const animating = await page.evaluate<string[]>(`(() =>
    [...document.querySelectorAll(".rise, .co, .pop, .grow, .draw, .settle, .count, .scan")]
      .filter((el) => getComputedStyle(el).animationName !== "none")
      .map((el) => el.className + ":" + getComputedStyle(el).animationName))()`);
  expect(animating).toEqual([]);
  await expect(page.locator(".hero .co").first()).toBeVisible();
  await shot(page, "log-first-verdict-reduced");
});
