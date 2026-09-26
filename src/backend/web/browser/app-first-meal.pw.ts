// The web application's FIRST meal (#42): "one meal on us" — the flow that stands where the diary
// will, while the account has never logged. Ask → photo or words → the verdict the server
// computed → the manual correction (PATCH, uncharged — the sample is ONE analysis, so a text
// correction would be a billed 402) → the offer that holds.
//
// Driven against the demo model like the rest of the `app` project: the verdicts asserted are the
// server's, read off the responses, never recomputed in the test.
import type { DayResponse, EditMealRequest } from "@eait/shared/contract";
import { expect, sessionToken, test } from "./fixtures.ts";

const FIXTURE = "src/backend/web/browser/fixture-meal.png";

test("a photo reaches the first verdict, a manual edit the recheck, and Keep going the offer", async ({ inWebApp: page }) => {
  // The gate: nothing logged yet, so `/#/` is the ask rather than the diary.
  await page.goto("/#/");
  await expect(page.getByText("One meal on me. Photo, or just tell me?")).toBeVisible();
  // The web never showed an offer before this, so there is no reaction beat above the ask (#50).
  await expect(page.getByText("Try me first")).toHaveCount(0);

  await page.getByRole("button", { name: "Upload a photo" }).click();
  await page.locator('input[type="file"]').setInputFiles(FIXTURE);
  const sent = page.waitForRequest((r) => r.method() === "POST" && r.url().endsWith("/meals/photo"));
  await page.getByRole("button", { name: "Analyse my meal" }).click();
  // The streamed turn, as the phone asks for it.
  expect((await sent).headers()["accept"]).toContain("application/x-ndjson");

  // The verdict: the meal's card, its kcal, and the verdict pills the SERVER computed — read back
  // off the server's own diary, so what is asserted is what was stored.
  await expect(page.getByText("Your first verdict")).toBeVisible();
  const kcal = Number(await page.locator(".hero").innerText());
  const diary = await page.request.get("/api/v1/diary/day", {
    headers: { authorization: `Bearer ${await sessionToken(page)}` },
  }).then((r) => r.json()) as DayResponse;
  expect(diary.meals).toHaveLength(1);
  expect(kcal).toBe(diary.meals[0]!.kcal);
  const grams0 = diary.meals[0]!.items[0]!.grams;
  await expect(page.locator(".pill").first()).toBeVisible();
  // #49: Spud only, and the pills' verdict is what he says — never a line the pills contradict.
  await expect(page.getByText(/gabie/i)).toHaveCount(0);
  if ((await page.locator(".pill.warn, .pill.bad").count()) > 0) await expect(page.getByText("On plan.")).toHaveCount(0);

  // "Correct meal" is the manual edit. What it was prefills with the WHOLE meal (#49).
  await page.getByRole("button", { name: "Correct meal" }).click();
  await expect(page.locator("#fm-what")).toHaveValue(diary.meals[0]!.items.map((i) => i.name).join(", "));
  await page.locator("#fm-portion").selectOption("large");
  const patched = page.waitForRequest((r) => r.method() === "PATCH" && /\/api\/v1\/meals\/[^/]+$/.test(r.url()));
  await page.getByRole("button", { name: "Save and recheck" }).click();
  const body = (await patched).postDataJSON() as EditMealRequest;
  // Items plus totals, scaled the same — Large is ×1.25 — and never a verdict: the client may not
  // send what only the server computes.
  expect("verdicts" in body).toBe(false);
  expect(body.items?.length).toBe(diary.meals[0]!.items.length);
  expect(body.items?.[0]?.grams).toBe(Math.round(grams0 * 1.25));
  expect(body.kcal).toBe(Math.round(kcal * 1.25));

  // The recheck is a new card drawn from what the PATCH returned — including its recomputed verdicts.
  await expect(page.getByText("Your first verdict")).toBeVisible();
  await expect(page.locator(".hero")).toHaveText(`${Math.round(kcal * 1.25)}`);
  await expect(page.locator(".pill").first()).toBeVisible();
  // The WHOLE card is the new one: the old figure is nowhere on the page (#49).
  await expect(page.getByText(new RegExp(`\\b${kcal}\\b`))).toHaveCount(0);
  await expect(page.getByText(/gabie/i)).toHaveCount(0);

  // Keep going → the offer that holds: named plans, the trial timeline, no invented price, and the
  // way out is the server's own checkout page.
  await page.getByRole("button", { name: "Keep going" }).click();
  await expect(page.getByText("Every meal, like that one")).toBeVisible();
  await expect(page.getByText("Free for 7 days")).toBeVisible();
  await expect(page.getByText("Day 8")).toBeVisible();
  const cta = page.getByRole("link", { name: "Start my free week" });
  await expect(cta).toHaveAttribute("href", "/start/checkout");
});

test("a meal told in words reaches the same first verdict", async ({ inWebApp: page }) => {
  await page.goto("/#/");
  await page.getByRole("button", { name: "Tell Spud what you ate" }).click();
  await page.getByPlaceholder("What did you eat?").fill("a bowl of pasta and a salad");
  // A typed meal is proposed and this screen IS the confirmation — the confirm lands on its own.
  const confirmed = page.waitForRequest((r) => r.method() === "POST" && /\/meals\/pending\/[^/]+\/confirm$/.test(r.url()));
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await confirmed;
  await expect(page.getByText("Your first verdict")).toBeVisible();
  await expect(page.locator(".hero")).toContainText(/\d/);
  await expect(page.locator(".pill").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Correct meal" })).toBeVisible();
});
