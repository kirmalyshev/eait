// The web APPLICATION's chat (#493) — the SPA at `/`, not `/start/chat`. W7 (#94) drew it
// Register P: the thread column, Spud's say lines, the proposal card, the coach bar, the
// kept turns' dimmed photo with Send again — all of it under the shared composer.
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
import type { DayResponse, ProfileResponse } from "@eait/shared/contract";
import { REAL_MODEL, expect, logMeal, sessionToken, test } from "./fixtures.ts";

const FIXTURE = "src/backend/web/browser/fixture-meal.png";
/** The empty thread's prompt — `composerAsk`; a populated one reads `composerThread`. */
const ASK = "What did you eat?";

test("first open draws Spud's greeting and the three starters, in the struggles' order", async ({ inWebApp: page }) => {
  // An empty stored thread is the boards' `chat-empty`: the greeting is her first AND newest line.
  await expect(page.locator(".thread .say .gname")).toHaveText("Spud");
  await expect(page.locator(".thread")).toContainText("Tell me what you ate, or ask me anything.");
  await expect(page.locator(".thread .spud")).toHaveCount(1);
  const starters = page.locator(".opts .opt .ot");
  await expect(starters).toHaveText([
    "How's my week going?", "What's a lighter swap for dinner?", "Am I getting enough protein?",
  ]);
  // Each row carries its struggle's icon — the boards' pairing, named rather than "an icon" (#158).
  const icons = page.locator(".opts .opt .ico:not(.chv)");
  await expect(icons).toHaveClass([/i-consistency/, /i-habits/, /i-protein/]);
});

test("the starters follow the account's struggles, its own first", async ({ inWebApp: page }) => {
  await page.request.patch("/v1/profile", {
    headers: { authorization: `Bearer ${await sessionToken(page)}`, "content-type": "application/json" },
    data: { struggles: ["busy", "ideas"] },
  });
  await page.reload();
  await expect(page.locator(".opts .opt .ot")).toHaveText([
    "I'll just tell you what I ate", "What should I eat tonight?", "How's my week going?",
  ]);
});

test("a starter tapped is sent as the words, and the card is gone once the thread has lines", async ({ inWebApp: page }) => {
  await page.locator(".opts .opt", { hasText: "week" }).click();
  await expect(page.locator(".thread li.me")).toContainText("How's my week going?");
  // The stored thread is no longer empty, so the starters' card does not come back.
  await expect(page.locator(".opts")).toHaveCount(0);
});

test("a photograph logs a meal, with its caption in the thread", async ({ inWebApp: page }) => {
  await page.locator('input[type="file"]').setInputFiles(FIXTURE);
  await page.getByPlaceholder(ASK).fill("lunch at the desk");
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
  // The box, not its placeholder: the prompt text itself changes once a line is in the thread.
  const words = page.locator(".compose .box");
  await words.fill("two boiled eggs and a slice of rye bread");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  // Confirm-first: a meal nobody photographed is one we inferred. The boards' card leads with
  // "Logging to today — look right?" and answers No / Log it.
  await expect(page.locator(".prop")).toContainText("Logging to today — look right?");
  // The card carries its own numbers — the name, the d22 kcal, the dots.
  await expect(page.locator(".prop .card")).toContainText("kcal");
  await expect(page.getByRole("button", { name: "No" })).toBeVisible();
  await expect(words).toHaveValue("");
  await page.getByRole("button", { name: "Log it" }).click();
  await expect(page.getByRole("button", { name: "Log it" })).toHaveCount(0);
  // The card, by its own shape — name, the d22 kcal, and the verdict dots under the hairline.
  await expect(page.locator(".thread li.them .card")).toContainText("kcal");
  await expect(page.locator(".thread li.them .card .vs")).toBeVisible();
  // And it LANDED: Today reads one meal, carrying the server's own verdicts (#158).
  const day = await page.request.get("/api/v1/diary/day", {
    headers: { authorization: `Bearer ${await sessionToken(page)}` },
  });
  const logged = ((await day.json()) as DayResponse).meals;
  expect(logged).toHaveLength(1);
  expect(logged[0]!.verdicts?.weight).toBeTruthy();
});

test("a proposal's No resolves the card and logs nothing", async ({ inWebApp: page }) => {
  await page.getByPlaceholder(ASK).fill("a banana");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("button", { name: "No" })).toBeVisible();
  await page.getByRole("button", { name: "No" }).click();
  await expect(page.locator(".prop")).toHaveCount(0);
  // Nothing was logged: no meal card in the thread, and the day — the server's own answer, not
  // the drawn one — stays empty.
  await expect(page.locator(".thread li.them .card")).toHaveCount(0);
  const day = await page.request.get("/api/v1/diary/day", {
    headers: { authorization: `Bearer ${await sessionToken(page)}` },
  });
  expect(((await day.json()) as DayResponse).meals).toHaveLength(0);
});

test("a question is answered by Spud, with his face on the newest line", async ({ inWebApp: page }) => {
  await page.getByPlaceholder(ASK).fill("how did my week go?");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  const answer = page.locator(".thread li.them", { hasText: "Demo answer" });
  await expect(answer).toBeVisible();
  await expect(answer.locator(".say")).toBeVisible();
  // Her disc sits beside her newest line — the one just answered; her name was on the first.
  await expect(answer.locator(".spud")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Log it" })).toHaveCount(0);
});

test("the protein question draws the day's bar from the server, a week question draws none", async ({ inWebApp: page }) => {
  // The demo coach names the nutrient; the engine fills the figures — the bar shows the profile's
  // protein target against the day's eaten total, and no other answer carries one.
  await logMeal(page);
  const res = await page.request.get("/api/v1/profile", {
    headers: { authorization: `Bearer ${await sessionToken(page)}` },
  });
  const { targets } = await res.json() as ProfileResponse;
  const dayRes = await page.request.get("/api/v1/diary/day", {
    headers: { authorization: `Bearer ${await sessionToken(page)}` },
  });
  const { totals } = await dayRes.json() as DayResponse;
  // The open screen's own draw may have read `/messages` before the seed landed (#239): re-open
  // the chat the way a returning account arrives, and the pic line is the thread saying it has
  // the meal — which is also what makes the box read `composerThread`, not the ask.
  await page.reload();
  await expect(page.locator(".thread li.me.pic")).toHaveCount(1);
  await page.getByPlaceholder("Tell Spud what you ate, or ask").fill("Am I getting enough protein?");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  const bar = page.locator(".thread .mb");
  await expect(bar).toBeVisible();
  await expect(bar).toContainText("Protein");
  await expect(bar).toContainText(`of ${targets.protein_g}`);
  // The fill is the day's own share — eaten/target, drawn, never a shape that merely exists:
  // a number over target reads true but never overflows the track.
  const fillStyle = await page.locator(".mb .bar i").getAttribute("style");
  const drawn = parseFloat(fillStyle!.match(/width:\s*([\d.]+)%/)![1]!);
  const expected = Math.min(100, (totals.protein_g / targets.protein_g) * 100);
  expect(Math.abs(drawn - expected)).toBeLessThan(0.6);
  await page.getByPlaceholder("Tell Spud what you ate, or ask").fill("how did my week go?");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.locator(".thread li.them", { hasText: "Demo answer" }).last()).toBeVisible();
  // The bar is the LIVE answer's own (`focus` is live-only, like `suggestions` — the stored line
  // keeps the sentence): a newer answer retires it, and a week answer draws none of its own.
  await expect(page.locator(".thread .mb")).toHaveCount(0);
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
  await page.getByPlaceholder(ASK).fill("second lunch");
  await page.getByRole("button", { name: "Send the photo" }).click();
  // LOG_COPY's wording since #231 — the same refusal the phone would read.
  await expect(page.locator(".notice")).toHaveText("Your daily allowance is spent. It resets at midnight — chat still works.");
  // Refused, so the words stay for when it is allowed again.
  await expect(page.getByPlaceholder(ASK)).toHaveValue("second lunch");
});

test("a spent sample says where to subscribe, and keeps the words", async ({ inWebApp: page }) => {
  // A browser has no RevenueCat sheet, so the 402 is words of its own.
  await page.route("**/api/v1/messages", (r) => r.request().method() !== "POST" ? r.fallback() : r.fulfill({
    status: 402, contentType: "application/json", body: JSON.stringify({ error: "subscription-required" }),
  }));
  const words = page.getByPlaceholder(ASK);
  await words.fill("a banana");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.locator(".notice")).toHaveText(
    "This account's free sample is used up. Start your free week to carry on.",
  );
  await expect(words).toHaveValue("a banana");
});

test("a proposal the server no longer holds stops offering Log it", async ({ inWebApp: page }) => {
  await page.getByPlaceholder(ASK).fill("a banana");
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
  await page.getByPlaceholder(ASK).fill("a banana");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("button", { name: "Log it" })).toBeVisible();
  // The page's memory is gone; the server holds the proposal until it expires.
  await page.reload();
  await expect(page.getByRole("button", { name: "Log it" })).toBeVisible();
  await page.getByRole("button", { name: "Log it" }).click();
  await expect(page.getByRole("button", { name: "Log it" })).toHaveCount(0);
  await expect(page.locator(".thread li.them .card")).toContainText("kcal");
});

test("dropping a proposal the server no longer holds is what was asked, and says nothing", async ({ inWebApp: page }) => {
  await page.getByPlaceholder(ASK).fill("a banana");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("button", { name: "No" })).toBeVisible();
  await page.route("**/api/v1/meals/pending/*/cancel", (r) => r.fulfill({
    status: 410, contentType: "application/json", body: JSON.stringify({ error: "expired" }),
  }));
  await page.getByRole("button", { name: "No" }).click();
  await expect(page.getByRole("button", { name: "No" })).toHaveCount(0);
  // Nothing is logged, which is the outcome they asked for; "say it again" would be the wrong advice.
  await expect(page.locator(".notice")).toBeHidden();
});

test("a turn whose answer never arrived keeps the photo and offers Send again", async ({ inWebApp: page }) => {
  // The connection went with the turn still running: the server may have logged it. Since #708 the
  // page keeps the photo — dimmed, under Spud's "Couldn't reach eait." with the resend beside it.
  await page.route("**/api/v1/meals/photo", (r) => r.abort("connectionreset"));
  await page.locator('input[type="file"]').setInputFiles(FIXTURE);
  await page.getByRole("button", { name: "Send the photo" }).click();
  await expect(page.locator(".notice")).toHaveText(KEPT);
  await expect(page.locator(".thread li.me.dim")).toHaveCount(1);
  await expect(page.locator(".thread li.me.dim .hero")).toBeVisible();
  await expect(page.locator(".thread li.them")).toContainText("Couldn't reach eait.");
  await expect(page.locator(".thread li.them")).toContainText("Nothing was logged.");
  await expect(page.getByRole("button", { name: "Send again" })).toBeVisible();
});

test("Send again re-sends the kept photo, and the meal is logged exactly once", async ({ inWebApp: page }) => {
  // The connection died before the server ever saw it — never `r.fetch()` on a file-backed
  // multipart (Playwright truncates the body; the count-asserting spec in app-offline says why).
  // Send again drains it under the same client id, so one card is the whole proof.
  await page.route("**/api/v1/meals/photo", (r) => r.abort("connectionreset"));
  await page.locator('input[type="file"]').setInputFiles(FIXTURE);
  await page.getByRole("button", { name: "Send the photo" }).click();
  await expect(page.locator(".thread li.me.dim")).toHaveCount(1);
  await page.unroute("**/api/v1/meals/photo");
  // force: the kept line is still rising when it can be pressed, and the outbox's own redraw
  // swaps the node under the click — the tap is the point, the stagger is decoration.
  await page.getByRole("button", { name: "Send again" }).click({ force: true });
  await expect(page.locator(".thread li.me.dim")).toHaveCount(0);
  await expect(page.locator(".thread li.them .card")).toContainText("kcal");
  await expect(page.locator(".thread li.them .card")).toHaveCount(1);
});

test("a thread that cannot be loaded says so, and Try again asks again", async ({ inWebApp: page }) => {
  await page.route("**/api/v1/messages?*", (r) => r.fulfill({
    status: 500, contentType: "application/json", body: JSON.stringify({ error: "internal" }),
  }));
  await page.reload();
  await expect(page.locator(".chatfail")).toBeVisible();
  await expect(page.locator(".chatfail")).toContainText("Couldn't load the conversation.");
  await expect(page.locator(".chatfail .gname")).toHaveText("Spud");
  await page.unroute("**/api/v1/messages?*");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.locator(".chatfail")).toHaveCount(0);
  await expect(page.locator(".thread")).toContainText("Tell me what you ate, or ask me anything.");
});

test("an account the server holds no profile for still gets its chat", async ({ inWebApp: page }) => {
  // The thread and the composer need no profile. The photo checks read the limits off it, and
  // without one they step aside: the server is their authority either way.
  await page.route("**/api/v1/profile", (r) => r.fulfill({
    status: 403, contentType: "application/json", body: JSON.stringify({ error: "not-onboarded" }),
  }));
  await page.reload();
  await expect(page.getByPlaceholder(ASK)).toBeVisible();
});

const MAYBE_LANDED = "No answer came back, and it may still have gone through. Reload to check before sending it again.";
const KEPT = "Saved on this device. It goes on its own as soon as it can.";

test("a Log it whose answer never arrived keeps the card, because pressing it again is safe", async ({ inWebApp: page }) => {
  await page.getByPlaceholder(ASK).fill("a banana");
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
  await expect(page.locator(".thread li.them .card")).toContainText("kcal");
  await expect(page.locator(".notice")).toBeHidden();
});

test("a Log it after the session ended goes to the sign-in, not to 'press it again'", async ({ inWebApp: page }) => {
  await page.getByPlaceholder(ASK).fill("a banana");
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

test("#/chat?focus= opens the meal's correction — its card, her opener, the words as the answer", async ({ inWebApp: page }) => {
  // W5's logged card and W6's "…" both hand a mealId here (`web/meal-edit.html` is the board).
  await logMeal(page);
  const day = await page.request.get("/api/v1/diary/day", {
    headers: { authorization: `Bearer ${await sessionToken(page)}` },
  });
  const mealId = ((await day.json()) as DayResponse).meals[0]!.id;
  await page.goto(`/#/chat?focus=${mealId}`);
  // The meal's card first — thumb, name, kcal, dots — then Spud naming what he read.
  const card = page.locator(".thread li.focus-meal .card");
  await expect(card).toBeVisible();
  await expect(card).toContainText("kcal");
  await expect(page.locator(".thread")).toContainText("Tell me what I got wrong.");
  await expect(page.getByPlaceholder("Say what was wrong")).toBeVisible();
  // A send is a CORRECTION — the body names the meal it corrects, and the thread gets the update.
  const sent = page.waitForRequest((r) => r.method() === "POST" && r.url().endsWith("/messages"));
  await page.getByPlaceholder("Say what was wrong").fill("half that");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  expect((await sent).postDataJSON()).toMatchObject({ focusMealId: mealId });
  await expect(page.locator(".thread li.me", { hasText: "half that" })).toBeVisible();
});

test("a proposal past its clock stands with the timed-out line and no offers", async ({ inWebApp: page }) => {
  // `chat-expired`'s draw: the card stays, its buttons are gone, the line says why. The read-back
  // is stubbed to a proposal already past its expiresAt — what the server would answer a reload.
  await page.route("**/api/v1/meals/pending", (r) => r.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ proposals: [{
      kind: "proposed", pendingId: "p1", date: "2026-09-27",
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
      analysis: { isFood: true, kcal: 214, protein_g: 9, carbs_g: 34, fat_g: 5, satfat_g: 3,
        fiber_g: 2, sugar_g: 12, sodium_mg: 80,
        items: [{ name: "Flat white", grams: 250, confidence: "high" }, { name: "banana", grams: 100, confidence: "high" }],
        verdicts: {}, score: null },
      verdictLabels: [{ tone: "good", label: "Calories on plan" }],
      verdictInline: "Calories on plan",
    }] }),
  }));
  // inWebApp already sits on #/chat — reload so the read-back goes through the route.
  await page.reload();
  await expect(page.locator(".prop .card")).toContainText("Flat white, banana");
  await expect(page.locator(".prop")).toContainText("That one timed out. Describe it again and I'll re-read it.");
  await expect(page.getByRole("button", { name: "Log it", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "No", exact: true })).toHaveCount(0);
});

test("#/chat?focus= sends a picked photo onto that meal's own photos", async ({ inWebApp: page }) => {
  // Angles, not a new turn (#304): the focus sheet's upload attaches to the meal it corrects.
  await logMeal(page);
  const day = await page.request.get("/api/v1/diary/day", {
    headers: { authorization: `Bearer ${await sessionToken(page)}` },
  });
  const mealId = ((await day.json()) as DayResponse).meals[0]!.id;
  await page.goto(`/#/chat?focus=${mealId}`);
  const sent = page.waitForRequest((r) => r.method() === "POST" && r.url().endsWith(`/meals/${mealId}/photos`));
  await page.locator('input[type="file"]').setInputFiles(FIXTURE);
  await page.getByRole("button", { name: "Send the photo" }).click();
  await sent;
});

test("reduced motion: the thread arrives at its end state, nothing still animating", async ({ inWebApp: page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByPlaceholder(ASK).fill("two boiled eggs");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.locator(".prop .card")).toBeVisible();
  // With reduce on, rise/grow run to the end instantly — nothing is left mid-flight and every line
  // is fully drawn: no running or pending animation, and the new lines are already opaque.
  // Strings, because this file is typechecked without the DOM: the browser is where it runs.
  const animating = await page.evaluate<number>(
    `document.getAnimations().filter((a) => a.playState !== "finished").length`);
  expect(animating).toBe(0);
  const opacity = await page.evaluate<string>(
    `getComputedStyle(document.querySelector(".thread li.me")).opacity`);
  expect(opacity).toBe("1");
});
