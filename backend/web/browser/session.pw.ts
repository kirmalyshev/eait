// `/start/session/token` and `/start/session/signout`, asked the way `web/api.ts` asks them.
//
// #457. Every anonymous load of app.eait.fit left a red line in the console: this route answered a
// browser with no session with a 303, `api.ts` does not follow it (`redirect: "manual"`), and Chrome
// records the target it was told not to follow as a failed request. The sign-in screen was right;
// the console was not, and a console that always has an error in it is one nobody reads. No unit
// test can see this — only a browser records it.
import { expect, test } from "./fixtures.ts";

// The front door carries no JavaScript, so its CSP allows no `fetch` at all. The web app's page
// allows `connect-src 'self'`, which is what these calls get in production; lifting the front
// door's policy is how a spec makes them from this origin. It changes nothing Chrome logs.
test.use({ bypassCSP: true });

test("a browser with no session asks for a bearer, and nothing goes red", async ({ page }) => {
  const red: string[] = [];
  page.on("requestfailed", (r) => red.push(`failed ${new URL(r.url()).pathname}: ${r.failure()?.errorText}`));
  page.on("console", (m) => { if (m.type() === "error") red.push(`console: ${m.text()}`); });
  await page.goto("/start");
  // The exact calls `api.ts` makes, from this origin, with no session cookie.
  const answers = await page.evaluate(() => Promise.all(["token", "signout"].map(async (route) => {
    const res = await fetch(`/start/session/${route}`, { method: "POST", redirect: "manual" });
    return res.type === "opaqueredirect" ? "a redirect" : await res.json();
  })));
  expect(answers).toEqual([{ token: null }, { token: null }]);
  expect(red).toEqual([]);
});
