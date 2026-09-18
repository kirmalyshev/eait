// The web APPLICATION's chat (#493) — the SPA at `/`, not `/start/chat`.
//
// It only read the thread until this: no photo picker, no text box, no send. These drive its
// composer the way a person does, on the SPA's own origin, which reaches the API through the same
// forward the edge makes in production.
//
// What the demo server cannot be made to do on demand — spend a sample or a day, expire a proposal,
// drop a connection — is answered at the network, in the shape the server uses: an HTTP status
// for what a route refuses before the engine runs, and the LAST LINE of the stream for what the
// engine refuses on the photo route, whose 200 went out with the first byte. What is under test
// there is what the page does with the answer, not the cap behind it.
import type { ProfileResponse } from "@eait/shared/contract";
import { REAL_MODEL, expect, sessionToken, test } from "./fixtures.ts";

const FIXTURE = "src/backend/web/browser/fixture-meal.png";

test("a photograph logs a meal, with its caption in the thread", async ({ inWebApp: page }) => {
  await page.locator('input[type="file"]').setInputFiles(FIXTURE);
  await page.getByPlaceholder("Anything I should know? (optional)").fill("lunch at the desk");
  const sent = page.waitForRequest((r) => r.url().endsWith("/meals/photo"));
  await page.getByRole("button", { name: "Send the photo" }).click();
  // THE STREAM, as the phone asks for it: a blank line every few seconds keeps every hop between the
  // browser and the server from calling a silent turn dead. (Bun's own 10 s idle cut is not that hop
  // for this route on Bun 1.4.0: it cuts a request with no body to read, not a POST whose body was
  // read. Measured 2026-09-10, #508.)
  expect((await sent).headers()["accept"]).toContain("application/x-ndjson");
  if (REAL_MODEL) {
    // A synthetic fixture is not food, and the real analyzer says so: the refusal, in words.
    await expect(page.locator("#app")).toContainText(/kcal|did not look like food/);
    return;
  }
  await expect(page.locator(".thread")).toContainText("lunch at the desk");
  await expect(page.locator(".thread")).toContainText("kcal");
});

test("a meal in words is proposed first, and Log it puts it in the thread", async ({ inWebApp: page }) => {
  const words = page.getByPlaceholder("What did you eat?");
  await words.fill("two boiled eggs and a slice of rye bread");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  // Confirm-first: a meal nobody photographed is one we inferred.
  await expect(page.getByRole("button", { name: "Not this" })).toBeVisible();
  await expect(words).toHaveValue("");
  await page.getByRole("button", { name: "Log it" }).click();
  await expect(page.getByRole("button", { name: "Log it" })).toHaveCount(0);
  // The card, by its own shape. Not the LAST line: a first meal is followed by Spud's introductions.
  await expect(page.locator(".thread li", { hasText: / — \d+ kcal$/ })).toHaveCount(1);
});

test("a question is answered in the thread and proposes nothing", async ({ inWebApp: page }) => {
  await page.getByPlaceholder("What did you eat?").fill("how did my week go?");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.locator(".thread li")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Log it" })).toHaveCount(0);
});

test("a file that is not a JPEG, PNG or WebP is refused in words, out loud", async ({ inWebApp: page }) => {
  // What an iPhone's library hands a browser. `accept=` on the input transcodes nothing.
  await page.locator('input[type="file"]').setInputFiles({
    name: "IMG_0001.HEIC", mimeType: "image/heic", buffer: Buffer.from("not a jpeg, png or webp"),
  });
  await page.getByRole("button", { name: "Send the photo" }).click();
  // An alert, so a screen reader says it: a refusal only the sighted can see is silence to the rest.
  await expect(page.getByRole("alert")).toHaveText("That file is not a photo this can read. JPEG, PNG or WebP.");
});

test("more photos than one meal takes are refused before anything is sent", async ({ inWebApp: page }) => {
  // The number the SERVER reports, never one compiled into this spec or the page.
  const res = await page.request.get("/api/v1/profile", {
    headers: { authorization: `Bearer ${await sessionToken(page)}` },
  });
  const { limits } = await res.json() as ProfileResponse;
  let posted = 0;
  page.on("request", (r) => { if (r.url().endsWith("/meals/photo")) posted++; });
  await page.locator('input[type="file"]').setInputFiles(Array(limits.maxPhotosPerMeal + 1).fill(FIXTURE));
  await page.getByRole("button", { name: "Send the photo" }).click();
  await expect(page.locator(".notice")).toHaveText(`One meal takes up to ${limits.maxPhotosPerMeal} photos.`);
  expect(posted).toBe(0);
});

test("a spent day, refused in the stream, is a sentence and logs nothing", async ({ inWebApp: page }) => {
  await page.route("**/api/v1/meals/photo", (r) => r.fulfill({
    status: 200, contentType: "application/x-ndjson",
    body: `\n${JSON.stringify({ kind: "cap-exceeded", scope: "user" })}\n`,
  }));
  await page.locator('input[type="file"]').setInputFiles(FIXTURE);
  await page.getByPlaceholder("Anything I should know? (optional)").fill("second lunch");
  await page.getByRole("button", { name: "Send the photo" }).click();
  await expect(page.locator(".notice")).toHaveText("That was your last one today — your daily allowance resets at midnight.");
  // Refused, so the words stay for when it is allowed again.
  await expect(page.getByPlaceholder("Anything I should know? (optional)")).toHaveValue("second lunch");
});

test("a spent sample says where to subscribe, and keeps the words", async ({ inWebApp: page }) => {
  // A browser has no RevenueCat sheet, so the 402 is words of its own.
  await page.route("**/api/v1/messages", (r) => r.request().method() !== "POST" ? r.fallback() : r.fulfill({
    status: 402, contentType: "application/json", body: JSON.stringify({ error: "subscription-required" }),
  }));
  const words = page.getByPlaceholder("What did you eat?");
  await words.fill("a banana");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.locator(".notice")).toHaveText(
    "The analyses this account came with are used up. Subscribe in the eait app to carry on.",
  );
  await expect(words).toHaveValue("a banana");
});

test("a proposal the server no longer holds stops offering Log it", async ({ inWebApp: page }) => {
  await page.getByPlaceholder("What did you eat?").fill("a banana");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("button", { name: "Log it" })).toBeVisible();
  await page.route("**/api/v1/meals/pending/*/confirm", (r) => r.fulfill({
    status: 410, contentType: "application/json", body: JSON.stringify({ error: "expired" }),
  }));
  await page.getByRole("button", { name: "Log it" }).click();
  await expect(page.locator(".notice")).toHaveText("That one is no longer being held. Say it again.");
  // Every further press would be another 410: a dead button is worse than none.
  await expect(page.getByRole("button", { name: "Log it" })).toHaveCount(0);
});

test("a held proposal survives a reload, and Log it still logs it (#530)", async ({ inWebApp: page }) => {
  await page.getByPlaceholder("What did you eat?").fill("a banana");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("button", { name: "Log it" })).toBeVisible();
  // The page's memory is gone; the server holds the proposal until it expires.
  await page.reload();
  await expect(page.getByRole("button", { name: "Log it" })).toBeVisible();
  await page.getByRole("button", { name: "Log it" }).click();
  await expect(page.getByRole("button", { name: "Log it" })).toHaveCount(0);
  await expect(page.locator(".thread li", { hasText: / — \d+ kcal$/ })).toHaveCount(1);
});

test("dropping a proposal the server no longer holds is what was asked, and says nothing", async ({ inWebApp: page }) => {
  await page.getByPlaceholder("What did you eat?").fill("a banana");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("button", { name: "Not this" })).toBeVisible();
  await page.route("**/api/v1/meals/pending/*/cancel", (r) => r.fulfill({
    status: 410, contentType: "application/json", body: JSON.stringify({ error: "expired" }),
  }));
  await page.getByRole("button", { name: "Not this" }).click();
  await expect(page.getByRole("button", { name: "Not this" })).toHaveCount(0);
  // Nothing is logged, which is the outcome they asked for; "say it again" would be the wrong advice.
  await expect(page.locator(".notice")).toBeHidden();
});

test("a turn whose answer never arrived is kept and sent again, never asked for twice", async ({ inWebApp: page }) => {
  // The connection went with the turn still running: the server may have logged it. Since #708 the
  // page keeps the photo and re-sends it under the same id, which the server answers from the first
  // attempt — so the person is not asked to check and send it again. `app-offline.pw.ts` proves once.
  await page.route("**/api/v1/meals/photo", (r) => r.abort("connectionreset"));
  await page.locator('input[type="file"]').setInputFiles(FIXTURE);
  await page.getByRole("button", { name: "Send the photo" }).click();
  await expect(page.locator(".notice")).toHaveText(KEPT);
  await expect(page.locator(".thread li", { hasText: "Waiting to send" })).toHaveCount(1);
});

test("an account the server holds no profile for still gets its chat", async ({ inWebApp: page }) => {
  // The thread and the composer need no profile. The photo checks read the limits off it, and
  // without one they step aside: the server is their authority either way.
  await page.route("**/api/v1/profile", (r) => r.fulfill({
    status: 403, contentType: "application/json", body: JSON.stringify({ error: "not-onboarded" }),
  }));
  await page.reload();
  await expect(page.getByPlaceholder("What did you eat?")).toBeVisible();
});

const MAYBE_LANDED = "No answer came back, and it may still have gone through. Reload to check before sending it again.";
const KEPT = "Saved on this device. It goes on its own as soon as it can.";

test("a Log it whose answer never arrived keeps the card, because pressing it again is safe", async ({ inWebApp: page }) => {
  await page.getByPlaceholder("What did you eat?").fill("a banana");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("button", { name: "Log it" })).toBeVisible();
  // The confirm REACHES the server and logs the meal; only its answer is lost on the way back.
  await page.route("**/api/v1/meals/pending/*/confirm", async (r) => { await r.fetch(); await r.abort("connectionreset"); });
  await page.getByRole("button", { name: "Log it" }).click();
  // "Reload to check" would wipe the card, which lives only in this page, and describing the meal
  // again is a second paid analysis. A repeated confirm is answered with the meal it already logged.
  await expect(page.locator(".notice")).toHaveText("No answer came back. Press Log it again: it cannot log the meal twice.");
  await page.unroute("**/api/v1/meals/pending/*/confirm");
  await page.getByRole("button", { name: "Log it" }).click();
  // Pressed twice, logged once, and nothing left to say.
  await expect(page.getByRole("button", { name: "Log it" })).toHaveCount(0);
  await expect(page.locator(".thread li", { hasText: / — \d+ kcal$/ })).toHaveCount(1);
  await expect(page.locator(".notice")).toBeHidden();
});

test("a Log it after the session ended goes to the sign-in, not to 'press it again'", async ({ inWebApp: page }) => {
  await page.getByPlaceholder("What did you eat?").fill("a banana");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("button", { name: "Log it" })).toBeVisible();
  // Signed out everywhere from another tab: every token revoked, and the cookie with them — so the
  // API answers 401 and the re-mint finds no session.
  await page.route("**/api/v1/meals/pending/*/confirm", (r) => r.fulfill({
    status: 401, contentType: "application/json", body: JSON.stringify({ error: "unauthenticated" }),
  }));
  await page.route("**/start/session/token", (r) => r.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ token: null }),
  }));
  await page.getByRole("button", { name: "Log it" }).click();
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
});

test("a proposal whose confirm landed without its answer is not offered again after the next turn", async ({ inWebApp: page }) => {
  await page.getByPlaceholder("What did you eat?").fill("a banana");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("button", { name: "Log it" })).toBeVisible();
  await page.route("**/api/v1/meals/pending/*/confirm", async (r) => { await r.fetch(); await r.abort("connectionreset"); });
  await page.getByRole("button", { name: "Log it" }).click();
  await expect(page.locator(".notice")).not.toBeHidden();
  await page.unroute("**/api/v1/meals/pending/*/confirm");
  // The next turn redraws the thread, and the thread now carries that proposal's card: the meal takes
  // the proposal's id when confirmed (`ChatEntry`, contract.ts), so the offer is over.
  const words = page.getByPlaceholder("What did you eat?");
  await words.fill("how did my week go?");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(words).toHaveValue("");
  await expect(page.getByRole("button", { name: "Send", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Log it" })).toHaveCount(0);
  await expect(page.locator(".thread li", { hasText: / — \d+ kcal$/ })).toHaveCount(1);
});

test("a stream the server could not finish may still have landed, so it is not worded as a failure", async ({ inWebApp: page }) => {
  // The route writes this for a throw that can come after the meal was logged (#514).
  await page.route("**/api/v1/meals/photo", (r) => r.fulfill({
    status: 200, contentType: "application/x-ndjson", body: `${JSON.stringify({ kind: "outcome-unknown" })}\n`,
  }));
  await page.locator('input[type="file"]').setInputFiles(FIXTURE);
  await page.getByRole("button", { name: "Send the photo" }).click();
  // An answer DID come back, so not "no answer came back": the doubt is whether it was logged.
  await expect(page.locator(".notice")).toHaveText(
    "That did not finish cleanly, and it may still have been logged. Reload to check before sending it again.",
  );
});

test("an analysis the stream calls failed is a failed analysis, and says so", async ({ inWebApp: page }) => {
  // Since #514 the route writes `analysis-failed` for the engine's own refusal and nothing else:
  // charged, nothing logged, so trying again is safe.
  await page.route("**/api/v1/meals/photo", (r) => r.fulfill({
    status: 200, contentType: "application/x-ndjson", body: `${JSON.stringify({ kind: "analysis-failed" })}\n`,
  }));
  await page.locator('input[type="file"]').setInputFiles(FIXTURE);
  await page.getByRole("button", { name: "Send the photo" }).click();
  await expect(page.locator(".notice")).toHaveText("That did not come back. Try it again.");
});

test("Not this on an estimate that was already logged says so", async ({ inWebApp: page }) => {
  await page.getByPlaceholder("What did you eat?").fill("a banana");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("button", { name: "Not this" })).toBeVisible();
  // What `cancelPendingMeal` answers when a confirm got there first (trimmed to what the page reads).
  await page.route("**/api/v1/meals/pending/*/cancel", (r) => r.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ kind: "logged", mealId: "m1", date: "2026-09-10" }),
  }));
  await page.getByRole("button", { name: "Not this" }).click();
  await expect(page.locator(".notice")).toHaveText("That one was already logged.");
  await expect(page.getByRole("button", { name: "Not this" })).toHaveCount(0);
});

test("an estimate past the moment the server stops holding it is not offered", async ({ inWebApp: page }) => {
  // `expiresAt` is sent so a surface stops offering a confirm it cannot honour (#367).
  await page.route("**/api/v1/messages", (r) => r.request().method() !== "POST" ? r.fallback() : r.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({
      kind: "proposed", pendingId: "p-gone", date: "2026-09-10", expiresAt: "2000-01-01T00:00:00.000Z",
      analysis: { items: [{ name: "banana", grams: 120 }], kcal: 107 },
    }),
  }));
  const words = page.getByPlaceholder("What did you eat?");
  await words.fill("a banana");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(words).toHaveValue("");
  // The controls come back in `turn()`'s `finally`, after the thread was redrawn: the moment a card
  // could exist. Asserting its absence before that passes with or without the expiry check.
  await expect(page.getByRole("button", { name: "Send", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Log it" })).toHaveCount(0);
});

test("an edge that answers 5xx with nothing in it got no answer of ours, so the photo is kept for later", async ({ inWebApp: page }) => {
  await page.route("**/api/v1/meals/photo", (r) => r.fulfill({ status: 502, body: "" }));
  await page.locator('input[type="file"]').setInputFiles(FIXTURE);
  await page.getByRole("button", { name: "Send the photo" }).click();
  await expect(page.locator(".notice")).toHaveText(KEPT);
});

test("a stream that ends with no answer reads as a turn that may have landed", async ({ inWebApp: page }) => {
  await page.route("**/api/v1/meals/photo", (r) => r.fulfill({
    status: 200, contentType: "application/x-ndjson", body: "\n\n",
  }));
  await page.locator('input[type="file"]').setInputFiles(FIXTURE);
  await page.getByRole("button", { name: "Send the photo" }).click();
  await expect(page.locator(".notice")).toHaveText(MAYBE_LANDED);
});

test("a turn still out when the screen is rebuilt offers no second send, and its answer reaches the new screen", async ({ inWebApp: page }) => {
  // The tabs and Back stay live while a turn is out, and rebuilding the chat drew a fresh composer:
  // a second photo of the same meal, a second paid analysis, and the first one's answer on a screen
  // nobody could see any more (#529).
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  await page.route("**/api/v1/meals/photo", async (r) => {
    await gate;
    await r.fulfill({ status: 200, contentType: "application/x-ndjson", body: `${JSON.stringify({ kind: "not-food" })}\n` });
  });
  await page.locator('input[type="file"]').setInputFiles(FIXTURE);
  await page.getByRole("button", { name: "Send the photo" }).click();
  await page.getByRole("link", { name: "Diary" }).click();
  await page.getByRole("link", { name: "Chat" }).click();
  await expect(page.getByRole("button", { name: "Send the photo" })).toHaveCount(0);
  release();
  await expect(page.locator(".notice")).toHaveText("That did not look like food.");
  await expect(page.getByRole("button", { name: "Send the photo" })).toBeEnabled();
});

test("a Not this whose answer never arrived drops the card, because nothing is logged without a confirm", async ({ inWebApp: page }) => {
  await page.getByPlaceholder("What did you eat?").fill("a banana");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("button", { name: "Not this" })).toBeVisible();
  await page.route("**/api/v1/meals/pending/*/cancel", async (r) => { await r.fetch(); await r.abort("connectionreset"); });
  await page.getByRole("button", { name: "Not this" }).click();
  // Pressed or not, landed or not, the outcome is the one asked for; offering the card again would
  // put it back under the server's own "Dropped it.".
  await expect(page.getByRole("button", { name: "Not this" })).toHaveCount(0);
  await expect(page.locator(".notice")).toBeHidden();
});

test("a re-mint that loses the network reads as a lost answer, not as signed out", async ({ inWebApp: page }) => {
  await page.getByPlaceholder("What did you eat?").fill("a banana");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("button", { name: "Log it" })).toBeVisible();
  // The bearer has lapsed (12 hours) and the connection drops as the page asks for another: the
  // session behind it is still alive, so the sign-in screen would be a lie that wipes the card.
  await page.route("**/api/v1/meals/pending/*/confirm", (r) => r.fulfill({
    status: 401, contentType: "application/json", body: JSON.stringify({ error: "unauthenticated" }),
  }));
  await page.route("**/start/session/token", (r) => r.abort("connectionreset"));
  await page.getByRole("button", { name: "Log it" }).click();
  await expect(page.locator(".notice")).toHaveText("No answer came back. Press Log it again: it cannot log the meal twice.");
  await expect(page.getByRole("link", { name: "Sign in" })).toHaveCount(0);
});

test("a confirm that worked leaves no card offering it, even when the redraw after it fails", async ({ inWebApp: page }) => {
  await page.getByPlaceholder("What did you eat?").fill("a banana");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("button", { name: "Log it" })).toBeVisible();
  await page.route((url) => url.pathname.endsWith("/api/v1/messages") && url.searchParams.has("limit"),
    (r) => r.request().method() === "GET" ? r.abort("connectionreset") : r.fallback());
  await page.getByRole("button", { name: "Log it" }).click();
  await expect(page.locator(".notice")).toHaveText("Sent. Reload to see the conversation.");
  await expect(page.getByRole("button", { name: "Log it" })).toHaveCount(0);
});
