// The chat composer's mic (#570): through the browser's own speech recognition, wherever it has one.
// The button is hidden without the API; with a stubbed recognizer a result lands in the field and
// is NOT sent, from the round or from the + menu's Voice tile.
import { expect, test } from "./fixtures.ts";

const SAFARI = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const STUB = `
  window.SpeechRecognition = window.webkitSpeechRecognition = class {
    start() { setTimeout(() => {
      this.onresult({ results: [[{ transcript: "chicken salad and orange juice" }]] });
      this.onend();
    }, 20); }
    stop() { this.onend(); }
  };`;

test.describe("without the API", () => {
  test.use({ userAgent: SAFARI });
  test("no mic is drawn", async ({ inWebApp: page }) => {
    await page.addInitScript("delete window.SpeechRecognition; delete window.webkitSpeechRecognition;");
    await page.reload();
    await expect(page.locator(".thread, .chat").first()).toBeVisible();
    await expect(page.locator(".cfield .vmic")).toHaveCount(0);
  });
});

test.describe("with a recognizer", () => {
  test("the words land in the field and nothing is sent", async ({ inWebApp: page }) => {
    await page.addInitScript(STUB);
    await page.reload();
    const mic = page.getByRole("button", { name: "Speak instead of typing" });
    await mic.click();
    await expect(page.locator(".cfield textarea.box")).toHaveValue("chicken salad and orange juice");
    await expect(page.getByRole("button", { name: "Send" })).toBeVisible();
    await expect(page.locator(".thread li.me")).toHaveCount(0);
  });

  test("the + menu's Voice tile starts listening", async ({ inWebApp: page }) => {
    await page.addInitScript(STUB);
    await page.reload();
    await page.getByRole("button", { name: "Log a meal" }).click();
    await page.getByRole("menuitem", { name: "Voice" }).click();
    await expect(page.locator(".cfield textarea.box")).toHaveValue("chicken salad and orange juice");
    await expect(page.locator(".thread li.me")).toHaveCount(0);
  });
});
