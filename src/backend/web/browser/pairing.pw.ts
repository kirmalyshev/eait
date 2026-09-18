// Pairing, in a real browser — issue #209.
//
// This is the ONE flow on this surface whose other half is not a browser at all: the code is minted
// by an app session over the API, and what a person then does is type eight characters into a form
// on a machine that has never seen the account. Both halves are driven here, neither is faked, and
// the browser starts with an empty cookie jar every time.
//
// TWO SPECS, NOT ONE PER ROUTE. `start.test.ts` drives every one of these routes with `Request`
// objects — single use, the TTL, the missing GET, the rate limit, the refusal copy — and repeating
// those here would be the same assertions at four times the cost. What is here is what a `Request`
// cannot show:
//
//  - a REAL BROWSER accepting `Path=/start; HttpOnly; SameSite=Lax` and sending it back on the next
//    navigation. A unit test asserts the Set-Cookie string; a typo in that path passes it and
//    breaks every user.
//  - the invariant, re-proven through the form the page actually renders. That duplication is
//    deliberate and is this repo's own pattern: `security.pw.ts` re-proves cross-account scoping
//    and no-session writes that `start.test.ts` also covers.
import { expect, test } from "./fixtures.ts";
import type { APIRequestContext, Browser } from "@playwright/test";

/** A device id the way the phone makes one: opaque, client-generated, at least 32 characters. */
const deviceId = () => crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");

/**
 * The app's half: a device-anonymous account, onboarded, with a bearer token.
 *
 * No provider, no identity but `device` — which is the whole point of the ticket. This account
 * cannot be reached by any sign-in button on the front door, because there is nothing to sign in
 * with; before pairing, a browser could not open it at all.
 */
async function appAccount(request: APIRequestContext): Promise<{ token: string; userId: string }> {
  const auth = await request.post("/v1/auth/device", { data: { deviceId: deviceId(), locale: "en" } });
  expect(auth.status()).toBe(200);
  const { token, userId } = await auth.json() as { token: string; userId: string };
  const profile = await request.patch("/v1/profile", {
    headers: { authorization: `Bearer ${token}` },
    data: {
      goal: "lose", sex: "male", birth_year: 1988, height_cm: 182, weight_kg: 98,
      target_weight_kg: 92, activity: "moderate", pace: "steady", country: "de",
      restrictions: [], complete_onboarding: true,
    },
  });
  expect(profile.status()).toBe(200);
  return { token, userId };
}

/** What the app would put on the screen. */
async function mint(request: APIRequestContext, token: string): Promise<string> {
  const res = await request.post("/v1/auth/pair", { headers: { authorization: `Bearer ${token}` } });
  expect(res.status()).toBe(200);
  const { code, expiresAt } = await res.json() as { code: string; expiresAt: string };
  expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{8}$/);
  // The deadline is SENT rather than compiled into the client, so the app can count down against
  // the same number the server will refuse on.
  expect(Date.parse(expiresAt)).toBeGreaterThan(Date.now());
  return code;
}

/** A browser that has never seen this account: no cookies, no history, nothing. */
async function stranger(browser: Browser) {
  const context = await browser.newContext();
  return { context, page: await context.newPage() };
}

test("a device-anonymous account opens its own thread in a browser, and it is ONE thread", async ({ browser, request }) => {
  const { token, userId } = await appAccount(request);
  const code = await mint(request, token);

  const { context, page } = await stranger(browser);
  await page.goto("/start");
  // Typed the way a person types it off a phone screen: lower case, with a dash they added.
  await page.getByPlaceholder("Your pairing code").fill(`${code.slice(0, 4)}-${code.slice(4)}`.toLowerCase());
  await page.getByRole("button", { name: "Connect this browser" }).click();

  await expect(page).toHaveURL(/\/start\/chat/);
  await expect(page.getByRole("heading", { name: "Your chat" })).toBeVisible();

  // A turn, sent from the browser.
  await page.getByPlaceholder("What did you eat?").fill("two boiled eggs and a slice of rye");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.locator("p.bubble.you").last()).toContainText("two boiled eggs");

  // ONE THREAD, and this is the assertion the whole ticket is about: the APP's own API, on the
  // app's own bearer, sees the line the browser just wrote — on the same account, which no sign-in
  // ever touched.
  const thread = await request.get("/v1/messages", { headers: { authorization: `Bearer ${token}` } });
  expect(thread.status()).toBe(200);
  const { entries } = await thread.json() as { entries: { text: string | null }[] };
  expect(entries.some((e) => (e.text ?? "").includes("two boiled eggs"))).toBe(true);

  // Still anonymous: pairing linked no identity and merged nothing.
  const identities = await request.get("/v1/auth/identities", { headers: { authorization: `Bearer ${token}` } });
  const { identities: linked } = await identities.json() as { identities: { provider: string }[] };
  expect(linked.map((i) => i.provider)).toEqual(["device"]);
  expect(userId).toBeTruthy();
  await context.close();
});

test("the form cannot name the account it lands in", async ({ browser, request }) => {
  // THE INVARIANT: `userId` comes out of the store, by the hash of the code. A crafted field is a
  // field nobody reads — asserted here through the page's own form, posted as a browser posts it.
  const victim = await appAccount(request);
  const attacker = await appAccount(request);
  const code = await mint(request, attacker.token);

  const { context, page } = await stranger(browser);
  const res = await context.request.post("/start/pair", {
    form: { code, userId: victim.userId },
    maxRedirects: 0,
  });
  expect(res.status()).toBe(303);
  expect(res.headers()["location"]).toBe("/start/chat");

  // The session that came back is the MINTER's, not the one the form named. Proved by what the
  // thread holds: a line written here is visible to the attacker's bearer and not to the victim's.
  await page.goto("/start/chat");
  await page.getByPlaceholder("What did you eat?").fill("landed in the minting account");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.locator("p.bubble.you").last()).toContainText("landed in the minting account");

  const seenBy = async (token: string) => {
    const res = await request.get("/v1/messages", { headers: { authorization: `Bearer ${token}` } });
    const { entries } = await res.json() as { entries: { text: string | null }[] };
    return entries.some((e) => (e.text ?? "").includes("landed in the minting account"));
  };
  expect(await seenBy(attacker.token)).toBe(true);
  expect(await seenBy(victim.token)).toBe(false);
  await context.close();
});
