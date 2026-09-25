// #708: a photo or a message sent with no connection is KEPT — in IndexedDB, in the order it was
// taken — shown as waiting, and sent when the connection is back, once. And a turn that reached the
// server and lost only its answer is sent again under the same id and answered from the first, so
// the meal is logged once and the analysis charged once.
//
// What is counted is the SERVER's thread and diary, read through the API with this account's own
// session — not what the page draws, which could show one line for two meals.

import { readFileSync } from "node:fs";
import type { ChatHistoryResponse, DayResponse, ProfileResponse } from "@eait/shared/contract";
import type { Page } from "@playwright/test";
import { expect, logMeal, sessionToken, test } from "./fixtures.ts";

const FIXTURE = "src/backend/web/browser/fixture-meal.png";
const KEPT = "Saved on this device. It goes on its own as soon as it can.";
const BEHIND = "Saved on this device. It goes once the message above that is waiting for you has been sent again or discarded.";

async function server<T>(page: Page, path: string): Promise<T> {
  const res = await page.request.get(`/api/v1${path}`, { headers: { authorization: `Bearer ${await sessionToken(page)}` } });
  expect(res.status()).toBe(200);
  return await res.json() as T;
}

/** The user's own lines on the server, as `kind: text`. */
async function userLines(page: Page): Promise<string[]> {
  const { entries } = await server<ChatHistoryResponse>(page, "/messages?limit=50");
  return entries.flatMap((e) => (e.role === "user" ? [`${e.kind}:${e.text ?? ""}`] : []));
}

async function photo(page: Page, caption: string) {
  await page.locator('input[type="file"]').setInputFiles(FIXTURE);
  await page.getByPlaceholder("Anything I should know? (optional)").fill(caption);
  await page.getByRole("button", { name: "Send the photo" }).click();
}

async function say(page: Page, words: string) {
  await page.getByPlaceholder("What did you eat?").fill(words);
  await page.getByRole("button", { name: "Send", exact: true }).click();
}

const waiting = (page: Page) => page.locator(".thread li", { hasText: "Waiting to send" });

test("a photo and a message sent offline wait in the thread, and go once, in order, when the connection is back", async ({ inWebApp: page }) => {
  await expect(page.getByRole("button", { name: "Send the photo" })).toBeEnabled();
  await page.context().setOffline(true);

  await photo(page, "offline lunch");
  await expect(page.locator(".notice")).toHaveText(KEPT);
  // Not an error, and not "nothing was logged": the photo is kept and says it is waiting.
  await expect(waiting(page)).toHaveCount(1);
  await expect(page.getByPlaceholder("Anything I should know? (optional)")).toHaveValue("");
  await say(page, "and a coffee with milk");
  await expect(waiting(page)).toHaveCount(2);
  await expect(waiting(page).first()).toContainText("offline lunch");

  const posts: string[] = [];
  page.on("request", (r) => { if (r.method() === "POST" && /\/(meals\/photo|messages)$/.test(r.url())) posts.push(new URL(r.url()).pathname); });
  await page.context().setOffline(false);

  await expect(waiting(page)).toHaveCount(0);
  await expect(page.locator(".thread")).toContainText("offline lunch");
  // The message was a described meal: its estimate is offered, like a live one.
  await expect(page.getByRole("button", { name: "Log it" })).toBeVisible();
  expect(posts).toEqual(["/api/v1/meals/photo", "/api/v1/messages"]);
  expect(await userLines(page)).toEqual(["photo:offline lunch", "text:and a coffee with milk"]);
  expect((await server<DayResponse>(page, "/diary/day")).meals).toHaveLength(1);
});

/** Analyses this account has left of its sample: the server's own count of what was charged. */
const remaining = async (page: Page) => (await server<ProfileResponse>(page, "/profile")).limits.sampleRemaining;

test("a message whose answer was lost after the server ran it is sent again, and answered once", async ({ inWebApp: page }) => {
  const before = await remaining(page);
  let posts = 0;
  await page.route("**/api/v1/messages", async (r) => {
    if (r.request().method() !== "POST") return r.fallback();
    // The first one REACHES the server and runs to the end; only its answer never arrives.
    if (++posts === 1) { await r.fetch(); await r.abort("connectionreset"); return; }
    await r.fallback();
  });
  await say(page, "two boiled eggs");
  await expect(page.getByRole("button", { name: "Log it" })).toBeVisible();
  await expect(waiting(page)).toHaveCount(0);
  expect(posts).toBe(2);
  expect(await userLines(page)).toEqual(["text:two boiled eggs"]);
  expect(await remaining(page)).toBe(before - 1);
});

test("a photo the server already logged under its id is not logged again when the page sends it", async ({ inWebApp: page }) => {
  // NOT `route.fetch()`, which is what the message above uses: Playwright hands a route only the
  // first few hundred bytes of a file-backed multipart body, so the photo would arrive unreadable.
  // The server cannot tell who sent the first attempt, so this test sends it — under the id the page
  // is about to use — and the page's own attempt is then the re-send of a turn whose answer it never had.
  const id = crypto.randomUUID();
  await page.evaluate((fixed) => { crypto.randomUUID = () => fixed as ReturnType<Crypto["randomUUID"]>; }, id);
  const before = await remaining(page);
  const first = await page.request.post("/api/v1/meals/photo", {
    headers: { authorization: `Bearer ${await sessionToken(page)}` },
    multipart: {
      photo: { name: "m.png", mimeType: "image/png", buffer: readFileSync(FIXTURE) },
      caption: "one lunch, once", clientId: id, capturedAt: new Date().toISOString(),
    },
  });
  expect(first.status()).toBe(200);
  expect(await remaining(page)).toBe(before - 1);

  let posts = 0;
  await page.route("**/api/v1/meals/photo", (r) => (++posts === 1 ? r.abort("connectionreset") : r.fallback()));
  await photo(page, "one lunch, once");
  await expect(page.locator(".thread")).toContainText("kcal");
  await expect(waiting(page)).toHaveCount(0);
  expect(posts).toBe(2);
  expect(await userLines(page)).toEqual(["photo:one lunch, once"]);
  expect((await server<DayResponse>(page, "/diary/day")).meals).toHaveLength(1);
  expect(await remaining(page)).toBe(before - 1);
});

test("what is kept survives a reload, and goes when the page has a session again", async ({ inWebApp: page }) => {
  await expect(page.getByRole("button", { name: "Send the photo" })).toBeEnabled();
  await page.context().setOffline(true);
  await say(page, "how did my week go?");
  await expect(waiting(page)).toHaveCount(1);

  // Online, but the message route still refuses to answer: the page reloads with the turn unsent.
  await page.route("**/api/v1/messages", (r) => (r.request().method() === "POST" ? r.abort("connectionreset") : r.fallback()));
  await page.context().setOffline(false);
  await page.reload();
  await expect(waiting(page)).toHaveCount(1);
  await expect(waiting(page)).toContainText("how did my week go?");

  await page.unroute("**/api/v1/messages");
  await page.reload();
  // Polled on the SERVER: straight after a reload "no line is waiting" is also true of a page that
  // has not drawn anything yet.
  await expect.poll(() => userLines(page)).toEqual(["text:how did my week go?"]);
  await expect(page.locator(".thread")).toContainText("how did my week go?");
  await expect(waiting(page)).toHaveCount(0);
});

test("a refusal that comes back when the queue drains is worded against the kept turn, which waits for a decision", async ({ inWebApp: page }) => {
  await expect(page.getByRole("button", { name: "Send the photo" })).toBeEnabled();
  await page.context().setOffline(true);
  await say(page, "a banana");
  await say(page, "and an apple");
  await expect(waiting(page)).toHaveCount(2);

  let refused = true;
  await page.route("**/api/v1/messages", (r) => (r.request().method() === "POST" && refused
    ? r.fulfill({ status: 402, contentType: "application/json", body: JSON.stringify({ error: "subscription-required" }) })
    : r.fallback()));
  await page.context().setOffline(false);

  const banana = page.locator(".thread li", { hasText: "a banana" });
  await expect(banana).toContainText("The analyses this account came with are used up. Subscribe in the eait app to carry on.");
  // The apple was told it goes on its own; once the banana ahead of it is held, that is no longer true.
  await expect(page.locator(".notice")).toHaveText(BEHIND);
  // Held, not retried on its own, and the one behind it waits rather than jumping the queue.
  await expect(waiting(page)).toHaveCount(1);
  await expect(waiting(page)).toContainText("and an apple");
  // A turn said now joins them — sent live, its estimate would be replaced by the apple's — and says
  // what it is waiting on, which is a decision, not a connection.
  await say(page, "and some toast");
  await expect(page.locator(".notice")).toHaveText(BEHIND);
  await expect(waiting(page)).toHaveCount(2);

  refused = false;
  await banana.getByRole("button", { name: "Send again" }).click();
  await expect(page.locator(".thread li", { hasText: "Waiting to send" })).toHaveCount(0);
  await expect(page.locator(".thread li", { hasText: "Send again" })).toHaveCount(0);
  await expect.poll(() => userLines(page)).toEqual(["text:a banana", "text:and an apple", "text:and some toast"]);
});

test("a kept turn can be discarded, and nothing is sent for it", async ({ inWebApp: page }) => {
  await expect(page.getByRole("button", { name: "Send the photo" })).toBeEnabled();
  await page.context().setOffline(true);
  await say(page, "a pear");
  await expect(waiting(page)).toHaveCount(1);
  await page.route("**/api/v1/messages", (r) => (r.request().method() === "POST"
    ? r.fulfill({ status: 429, contentType: "application/json", body: JSON.stringify({ error: "cap-exceeded", scope: "global" }) })
    : r.fallback()));
  await page.context().setOffline(false);
  const pear = page.locator(".thread li", { hasText: "a pear" });
  await expect(pear.getByRole("button", { name: "Discard" })).toBeVisible();
  await page.unroute("**/api/v1/messages");
  await pear.getByRole("button", { name: "Discard" }).click();
  await expect(page.locator(".thread li", { hasText: "a pear" })).toHaveCount(0);
  await page.reload();
  await expect(page.getByPlaceholder("What did you eat?")).toBeVisible();
  await expect(page.locator(".thread li", { hasText: "a pear" })).toHaveCount(0);
  expect(await userLines(page)).toEqual([]);
});

test("signing out takes the kept turns with it", async ({ inWebApp: page }) => {
  await expect(page.getByRole("button", { name: "Send the photo" })).toBeEnabled();
  await page.context().setOffline(true);
  await photo(page, "not for the next person");
  await expect(waiting(page)).toHaveCount(1);
  await page.context().setOffline(false);
  await page.route("**/api/v1/meals/photo", (r) => r.abort("connectionreset"));
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  // A string, because this file is typechecked without the DOM: the browser is where it runs.
  const kept = await page.evaluate<number>(`new Promise((resolve, reject) => {
    const open = indexedDB.open("eait", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("outbox");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const req = open.result.transaction("outbox").objectStore("outbox").get("entries");
      req.onsuccess = () => resolve((req.result || []).length);
      req.onerror = () => reject(req.error);
    };
  })`);
  expect(kept).toBe(0);
});

test("the chat opens offline, from another tab, with what it last had and a composer that keeps", async ({ inWebApp: page }) => {
  // Round 1 of #708's review: the first draw rethrew its failed read, so Chat was an error screen
  // offline unless it was already open.
  // A meal first: with none logged, the Diary tap below lands on the first-meal flow (#42). The
  // thread then holds that turn's lines too, so the counts below are read RELATIVE to it — and the
  // reload is because the chat drew before the seeded turn landed.
  await logMeal(page);
  await page.reload();
  await expect(page.locator(".thread li").first()).toBeVisible();
  const before = await page.locator(".thread li").count();
  await say(page, "how did my week go?");
  await expect(page.locator(".thread li")).toHaveCount(before + 2);
  await page.getByRole("link", { name: "Diary" }).click();
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
  await page.context().setOffline(true);
  await page.getByRole("link", { name: "Chat" }).click();
  await expect(page.getByPlaceholder("What did you eat?")).toBeVisible();
  await expect(page.locator(".thread")).toContainText("how did my week go?");
  await say(page, "a slice of rye bread");
  await expect(waiting(page)).toHaveCount(1);
  await page.context().setOffline(false);
  await expect(waiting(page)).toHaveCount(0);
  expect((await userLines(page)).slice(-2)).toEqual(["text:how did my week go?", "text:a slice of rye bread"]);
});

test("a kept turn of an account that is no longer signed in here is not kept for the next one", async ({ page }, testInfo) => {
  const { signIn, onboardFast } = await import("./fixtures.ts");
  await signIn(page, `pw-a-${testInfo.testId}-${Date.now()}`);
  await onboardFast(page);
  await page.goto("/#/chat");
  await expect(page.getByRole("button", { name: "Send the photo" })).toBeEnabled();
  await page.context().setOffline(true);
  await photo(page, "somebody else's lunch");
  await expect(waiting(page)).toHaveCount(1);
  // Before going online, so A's photo cannot slip out and the discard is what empties the store.
  await page.route("**/api/v1/meals/photo", (r) => r.abort("connectionreset"));
  const tokenA = await sessionToken(page);
  await page.context().setOffline(false);
  // The browser closes without Sign out: the session ends, and another person signs in here.
  await page.context().clearCookies();
  await signIn(page, `pw-b-${testInfo.testId}-${Date.now()}`);
  await onboardFast(page);
  await page.goto("/#/chat");
  await expect(page.getByPlaceholder("What did you eat?")).toBeVisible();
  await expect.poll(() => page.evaluate<number>(`new Promise((resolve, reject) => {
    const open = indexedDB.open("eait", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("outbox");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const req = open.result.transaction("outbox").objectStore("outbox").get("entries");
      req.onsuccess = () => resolve((req.result || []).length);
      req.onerror = () => reject(req.error);
    };
  })`)).toBe(0);
  await expect(page.getByText("somebody else's lunch")).toHaveCount(0);
  // Discarded, not sent: A's diary has no meal.
  const dayA = await page.request.get("/api/v1/diary/day", { headers: { authorization: `Bearer ${tokenA}` } });
  expect(((await dayA.json()) as DayResponse).meals).toHaveLength(0);
});

test("a turn said while kept ones still wait joins their end, so the server gets them in order", async ({ inWebApp: page }) => {
  await expect(page.getByRole("button", { name: "Send the photo" })).toBeEnabled();
  await page.context().setOffline(true);
  await say(page, "a bowl of porridge");
  await expect(waiting(page)).toHaveCount(1);
  // Back online, but the kept turn cannot get through yet (the server is restarting, say). Only IT is
  // refused: a live coffee would get through, so a coffee POST while the porridge waits is the bug.
  let porridge: string | undefined;
  const early: string[] = [];
  let blocked = true;
  await page.route("**/api/v1/messages", async (r) => {
    if (r.request().method() !== "POST") return r.fallback();
    const key = await r.request().headerValue("idempotency-key");
    porridge ??= key ?? undefined;
    if (key === porridge && blocked) return r.abort("connectionreset");
    if (blocked) early.push(key ?? "");
    return r.fallback();
  });
  await page.context().setOffline(false);
  await expect.poll(() => porridge).toBeDefined();
  await say(page, "and a coffee");
  await expect(waiting(page)).toHaveCount(2);
  expect(early).toEqual([]);
  blocked = false;
  await page.reload();
  await expect.poll(() => userLines(page)).toEqual(["text:a bowl of porridge", "text:and a coffee"]);
});

