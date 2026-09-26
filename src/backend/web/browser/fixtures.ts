// What every spec here starts from: a signed-in, onboarded account, reached the way a person
// reaches it — through the front door and the provider button.
//
// NOTHING IS BYPASSED. The demo server serves both ends of the sign-in (`--demo` wires
// `demoProviders` and a verifier that trusts `demo:<provider>:<subject>`), so the state cookie, the
// callback, the exchange and the session mint are all the real ones. That is the only way this flow
// can be driven on a laptop at all: Apple refuses every origin a laptop has, and Google refuses all
// but loopback.

import { readFileSync } from "node:fs";
import { expect, test as base, type Page } from "@playwright/test";

export const REAL_MODEL = process.env.EAIT_WEB_E2E_LLM === "real";

/** The fixture plate, as bytes — the demo analyzer seeds its answer from them. */
const MEAL_PHOTO = readFileSync("src/backend/web/browser/fixture-meal.png");

/**
 * One meal logged on this page's account, through the photo route the app itself uses.
 *
 * What every spec that lands on `#/` needs now that an account which has never logged meets the
 * first-meal flow there instead of the diary (#42): a spec that IS about the diary seeds one meal
 * first, the way a returning account arrives with one. Nothing is bypassed — this is a real photo
 * turn against the demo analyzer, under the session's own bearer.
 */
export async function logMeal(page: Page) {
  const res = await page.request.post("/v1/meals/photo", {
    headers: { authorization: `Bearer ${await sessionToken(page)}` },
    multipart: {
      photo: { name: "meal.png", mimeType: "image/png", buffer: MEAL_PHOTO },
      clientId: crypto.randomUUID(),
      capturedAt: new Date().toISOString(),
    },
  });
  expect(res.status(), await res.text()).toBe(200);
}

/** The answers the ten onboarding questions take, by the prompt id the page names. */
const ANSWERS: Record<string, string> = {
  goal: "lose",
  sex: "male",
  birth_year: "1988",
  height_cm: "182",
  weight_kg: "98",
  target_weight_kg: "92",
  pace: "steady",
  activity: "moderate",
  country: "de",
};

/** Sign in through the front door, as a person does. `subject` is the account: two are two people. */
export async function signIn(page: Page, subject: string, provider: "apple" | "google" = "google") {
  await page.goto("/start");
  await page.getByRole("link", { name: new RegExp(`Continue with ${provider}`, "i") }).click();
  // The demo authorize screen, standing where Apple's or Google's would be.
  await page.getByRole("textbox").fill(subject);
  await page.getByRole("button").click();
  await expect(page).toHaveURL(/\/start\/q/);
}

/** Answer whatever question is open until the plan appears. */
export async function onboard(page: Page) {
  for (let i = 0; i < 20; i++) {
    if (/\/start\/plan/.test(page.url())) return;
    const prompt = await page.locator('input[name="prompt"]').first().getAttribute("value");
    if (!prompt) break;
    const answer = ANSWERS[prompt];
    if (answer === undefined) {
      // The questions with no entry above: the chips, which are checkboxes and are answered by
      // choosing nothing, and any free-text one, which takes an empty line. Both submit the same way.
      const text = page.locator('input[type="text"][name="answer"], input[type="number"][name="answer"]');
      if (await text.count()) await text.first().fill("0");
      await page.locator('button[type="submit"]').last().click();
      continue;
    }
    const button = page.locator(`button[name="answer"][value="${answer}"]`);
    if (await button.count()) {
      await button.first().click();
    } else {
      await page.locator('input[type="text"][name="answer"], input[type="number"][name="answer"]').first().fill(answer);
      await page.locator('button[type="submit"]').last().click();
    }
  }
  await expect(page).toHaveURL(/\/start\/plan/);
}

/** Ask something in the chat and wait for the answer that follows it. */
export async function ask(page: Page, text: string): Promise<string> {
  const before = await page.locator("p.bubble").count();
  await page.getByPlaceholder("What did you eat?").fill(text);
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.locator("p.bubble")).not.toHaveCount(before);
  return (await page.locator("p.bubble").last().innerText()).trim();
}

/**
 * The ten questions, answered in ONE request instead of ten form posts.
 *
 * The same decision the Maestro suite made — eleven of its flows start from a seeded account rather
 * than replaying onboarding, because a test that is not about onboarding should not pay for it. The
 * SIGN-IN is still driven through the front door, because that is the thing worth proving; what is
 * skipped is the questionnaire behind it, written through the same profile route the page uses.
 *
 * The session cookie IS a session token, so the API takes it as a bearer. Nothing is bypassed: this
 * is the account that just signed in, writing its own profile.
 */
export async function onboardFast(page: Page) {
  const res = await page.request.patch("/v1/profile", {
    headers: { authorization: `Bearer ${await sessionToken(page)}`, "content-type": "application/json" },
    data: {
      goal: "lose", sex: "male", birth_year: 1988, height_cm: 182, weight_kg: 98,
      target_weight_kg: 92, activity: "moderate", pace: "steady", country: "de",
      restrictions: [], complete_onboarding: true,
    },
  });
  expect(res.status()).toBe(200);
}

/** The signed-in account's session cookie, which IS a session token — see `onboardFast`. */
export async function sessionToken(page: Page): Promise<string> {
  const jar = await page.context().cookies();
  const token = jar.find((c) => c.name === "eait_web")?.value;
  if (!token) throw new Error("no session cookie: sign in first");
  return token;
}

export const test = base.extend<{ signedIn: Page; inWebApp: Page }>({
  /** A fresh account per test: the subject is unique, so nothing leaks between them. */
  signedIn: async ({ page }, use, testInfo) => {
    await signIn(page, `pw-${testInfo.testId}-${Date.now()}`);
    await onboardFast(page);
    await page.goto("/start/chat");
    await use(page);
  },
  /** The same, landed in the web APPLICATION's chat rather than `/start`'s. The `app` project's specs. */
  inWebApp: async ({ page }, use, testInfo) => {
    await signIn(page, `pw-${testInfo.testId}-${Date.now()}`);
    await onboardFast(page);
    await page.goto("/#/chat");
    await use(page);
  },
});

export { expect };
