import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { assertClean, ClaimsError, copyFromHtml, lintCopy } from "./claims.ts";
import {
  loadLandingConfig, LandingConfigError, primaryAction, primaryCta, secondaryCta, surfaceNote, START_CODES,
} from "./config.ts";
import { iconSvg, outcomePages, renderLanding } from "./render.ts";
import { buildLanding } from "./build.ts";
import { faviconIco, ogPng, OG_HEIGHT, OG_WIDTH } from "./images.ts";
import { color, dark, light, TOKEN_SOURCE } from "./tokens.ts";
import { BODY, MASCOT_SOURCE, MOUTHS, SHEEN } from "./mascot.ts";
import { styles } from "./styles.ts";
import { faqs, founder, measured, refusals, floorSection, sample } from "./content.ts";
import { FREE_ANALYSES, KCAL_FLOOR } from "@ieat/shared";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

const ENV = {
  EAIT__BACKEND__LANDING_SITE_URL: "https://eait.fit",
  EAIT__BACKEND__LANDING_APP_STORE_URL: "https://apps.apple.com/app/id0000000000",
  EAIT__BACKEND__LANDING_TELEGRAM_URL: "https://t.me/eait_bot",
};

const config = loadLandingConfig(ENV);
const html = renderLanding(config);

describe("config", () => {
  test("refuses a build with no canonical origin", () => {
    expect(() => loadLandingConfig({ EAIT__BACKEND__LANDING_TELEGRAM_URL: ENV.EAIT__BACKEND__LANDING_TELEGRAM_URL })).toThrow(
      LandingConfigError,
    );
  });

  test("refuses a page with nothing to tap", () => {
    expect(() => loadLandingConfig({ EAIT__BACKEND__LANDING_SITE_URL: ENV.EAIT__BACKEND__LANDING_SITE_URL })).toThrow(
      /no working call to action/,
    );
  });

  test("refuses cleartext for anything a stranger can reach", () => {
    expect(() => loadLandingConfig({ ...ENV, EAIT__BACKEND__LANDING_SITE_URL: "http://eait.fit" })).toThrow(
      /must be https/,
    );
  });

  test("allows http for a local preview", () => {
    const local = loadLandingConfig({ ...ENV, EAIT__BACKEND__LANDING_SITE_URL: "http://localhost:4173" });
    expect(local.siteUrl).toBe("http://localhost:4173");
  });

  test("refuses a store link that does not point at the store", () => {
    // The failure this prevents: a shortener or a marketing redirect in the one link that has to
    // open the App Store app rather than a browser tab.
    expect(() =>
      loadLandingConfig({ ...ENV, EAIT__BACKEND__LANDING_APP_STORE_URL: "https://eait.fit/download" }),
    ).toThrow(/apps\.apple\.com/);
  });

  test("refuses a bot link that is not a Telegram link", () => {
    expect(() => loadLandingConfig({ ...ENV, EAIT__BACKEND__LANDING_TELEGRAM_URL: "https://t.me.evil/eait" }))
      .toThrow(/t\.me/);
  });

  test("the trailing slash is normalised away, so canonical URLs cannot double it", () => {
    const trailing = loadLandingConfig({ ...ENV, EAIT__BACKEND__LANDING_SITE_URL: "https://eait.fit/" });
    expect(trailing.siteUrl).toBe("https://eait.fit");
  });

  test("the store link is primary when it exists", () => {
    // The store link goes out untouched: Apple takes campaign attribution through pt/ct provider
    // tokens, not a query string of ours.
    expect(primaryCta(config, "hero").href).toBe(ENV.EAIT__BACKEND__LANDING_APP_STORE_URL);
    expect(secondaryCta(config, "hero")?.href).toBe(`${ENV.EAIT__BACKEND__LANDING_TELEGRAM_URL}?start=web_hero`);
  });

  test("before the listing exists the bot is primary, not a consolation link", () => {
    const preLaunch = loadLandingConfig({
      EAIT__BACKEND__LANDING_SITE_URL: ENV.EAIT__BACKEND__LANDING_SITE_URL,
      EAIT__BACKEND__LANDING_TELEGRAM_URL: ENV.EAIT__BACKEND__LANDING_TELEGRAM_URL,
    });
    expect(primaryCta(preLaunch, "hero").href).toBe(`${ENV.EAIT__BACKEND__LANDING_TELEGRAM_URL}?start=web_hero`);
    expect(secondaryCta(preLaunch, "hero")).toBeNull();
  });

  test("a copy-review date is a date", () => {
    expect(() => loadLandingConfig({ ...ENV, EAIT__BACKEND__LANDING_UPDATED: "yesterday" })).toThrow(/YYYY-MM-DD/);
  });
});

describe("claims gate", () => {
  test("the shipped copy passes", () => {
    expect(lintCopy(copyFromHtml(html))).toEqual([]);
  });

  test("it catches a health claim in body copy", () => {
    expect(() => assertClean({ body: "eait helps you lose weight" })).toThrow(ClaimsError);
    expect(() => assertClean({ body: "lowers cholesterol in 30 days" })).toThrow(ClaimsError);
    expect(() => assertClean({ body: "guaranteed results" })).toThrow(ClaimsError);
  });

  test("it catches an exclusivity claim, which the health rules do not cover", () => {
    // `marketing/DECISIONS.md` 2026-07-26 retired a caption for exactly this class: an
    // unsubstantiated "the only" is actionable under §5 UWG regardless of how true it feels.
    expect(() => assertClean({ h1: "the only app that judges your meal" })).toThrow(/exclusivity/);
    expect(() => assertClean({ h1: "Every other app just counts." })).toThrow(/superiority/);
  });

  test("it does not fire on the vocabulary this product legitimately needs", () => {
    // A linter that flags "saturated fat" on a nutrition page gets deleted in a week.
    expect(
      lintCopy({
        copy:
          "saturated fat gets its own verdict, sweet treats are fine, a lower-calorie lunch, " +
          "reaching your target weight, healthy BMI, preventable is an ordinary word",
      }),
    ).toEqual([]);
  });

  test("it sees through an invisible-character split", () => {
    expect(() => assertClean({ body: "det​ox your body" })).toThrow(/detox/);
  });

  test("it reads attributes, where alt text and the meta description live", () => {
    const withClaim = html.replace(
      '<meta name="twitter:card" content="summary_large_image">',
      '<meta name="description" content="guaranteed to work">',
    );
    expect(() => assertClean(copyFromHtml(withClaim))).toThrow(ClaimsError);
  });

  test("it does not read the stylesheet link or scripts as copy", () => {
    const decorated = html.replace("</head>", "<style>.x{content:'cure'}</style></head>");
    expect(lintCopy(copyFromHtml(decorated))).toEqual([]);
  });
});

describe("the numbers on the page are the numbers in the code", () => {
  test("the floor quoted in the copy is KCAL_FLOOR", () => {
    // The whole legitimacy of the floor section rests on it describing what actually runs. If
    // `src/shared/targets.ts` changes its floor, this fails rather than the page lying.
    const floorCopy = refusals.map((r) => r.body).join(" ") + floorSection.guards.map((g) => g.body).join(" ");
    expect(floorCopy).toContain(KCAL_FLOOR.female.toLocaleString("en-GB"));
    expect(floorCopy).toContain(KCAL_FLOOR.male.toLocaleString("en-GB"));
    expect(sample.target.floorKcal).toBe(KCAL_FLOOR.female);
  });

  test("the sample the copy promises is the sample the server gives", () => {
    // The first refusal and the cost question both describe what an account gets before the app
    // asks for money. That number is `EAIT__BACKEND__FREE_ANALYSES`, and it used to be described by
    // three sentences saying there was no paid tier at all — which stayed on the page after the
    // paywall shipped. Quoting the constant is what stops the copy outliving the product a second
    // time, exactly as the floor section quotes KCAL_FLOOR.
    expect(FREE_ANALYSES).toBe(1);
    const billing = refusals[0]!.body + " " + faqs.map((f) => f.a).join(" ");
    expect(billing).toContain("That first answer is yours");
    // And the claim that replaced it has to still be true of the product: a card is asked for, but
    // only after that first answer, and never by this page.
    expect(billing).not.toContain("no paid tier");
  });

  test("the hero's sample target sits above its own floor", () => {
    // A hero that draws the target mark to the left of the floor mark would illustrate the exact
    // thing the page says cannot happen.
    expect(sample.target.kcal).toBeGreaterThan(sample.target.floorKcal);
  });
});

describe("palette", () => {
  /**
   * The two palettes as `theme.ts` declares them, split on the `const DARK` line.
   *
   * Split rather than one regex over the file, because every token name now appears TWICE and a
   * first match would silently check the light value against both copies — passing while the dark
   * page rendered whatever it liked.
   */
  const themeBlocks = (): { light: string; dark: string } => {
    const source = readFileSync(resolve(REPO_ROOT, TOKEN_SOURCE), "utf8");
    const at = source.indexOf("const DARK = {");
    expect(at, `${TOKEN_SOURCE} no longer declares a DARK palette`).toBeGreaterThan(0);
    return { light: source.slice(0, at), dark: source.slice(at) };
  };

  for (const [theme, expected] of Object.entries({ light, dark })) {
    test(`every ${theme} token matches src/mobile/lib/theme.ts`, () => {
      const block = themeBlocks()[theme as "light" | "dark"];
      for (const [name, value] of Object.entries(expected)) {
        const declared = block.match(new RegExp(`\\b${name}:\\s*"(#[0-9A-Fa-f]{6})"`));
        expect(declared, `${name} is not declared in the ${theme} palette of ${TOKEN_SOURCE}`).not.toBeNull();
        expect(declared![1]!.toUpperCase()).toBe(value.toUpperCase());
      }
    });
  }

  test("the two palettes name exactly the same tokens", () => {
    // A name in one and not the other is a CSS variable that keeps its light value on the dark
    // page — invisible in the theme it was authored in, which is the one it gets looked at in.
    expect(Object.keys(dark)).toEqual(Object.keys(light));
    expect(Object.keys(color)).toEqual(Object.keys(light));
  });

  test("the app's faintest text colour is never used on this page", () => {
    // 4.0:1 on the page background — under AA for text below 24px, and this page's small type is
    // the small print under the button and the whole footer. `--dim` is the raised replacement;
    // see the comment on it. `--faint` stays DEFINED so the token block still mirrors the app.
    const usesOutsideDefinition = styles
      .split("\n")
      .filter((line) => line.includes("var(--faint)"));
    expect(usesOutsideDefinition).toEqual([]);
    expect(styles).toContain("--faint:");
  });

  test("the accent is spent on the primary action and nothing else", () => {
    // The app's rule, kept on the page. Two rule blocks may spend it — `.cta` (store mode) and
    // `.subscribe-primary` (form mode), which are never both accented in one build — plus the
    // wordmark dot. Anything else on the page competing with the primary action is a regression.
    const spenders = styles
      .split("}")
      .filter((block) => block.includes("var(--accent)"))
      .filter(
        (block) =>
          !block.includes(".cta") &&
          !block.includes(".subscribe-primary") &&
          !block.includes(".wordmark-dot"),
      );
    expect(spenders).toEqual([]);
    expect(styles).toContain(".cta {");
    expect(styles).toContain(".subscribe-primary .subscribe-button");
  });
});

describe("the rendered page", () => {
  test("has exactly one h1", () => {
    expect([...html.matchAll(/<h1\b/g)]).toHaveLength(1);
  });

  test("runs one same-origin script and nothing else, which is what the CSP allows", () => {
    // This page carried NO executable script until the theme toggle, and the policy said so:
    // `default-src 'none'` with no `script-src` at all. A remembered choice needs somewhere to
    // remember it, so the policy is now `script-src 'self'` and this test is what keeps that
    // sentence exactly as narrow as it was written.
    //
    // Two shapes are allowed and no third. The JSON-LD block is DATA — `application/ld+json` is
    // read by a crawler, never run by a browser, and `script-src` does not govern it. `/theme.js`
    // is our own file, same origin, no attributes beyond its src.
    //
    // Everything else stays forbidden, and the two assertions at the bottom are the ones that
    // matter most: an inline handler or a `javascript:` href would need `unsafe-inline`, which is
    // the thing `script-src 'self'` exists to avoid.
    const scripts = [...html.matchAll(/<script\b[^>]*>/g)].map((m) => m[0]);
    for (const tag of scripts) {
      const allowed = tag.includes('type="application/ld+json"') || tag === '<script src="/theme.js">';
      expect(allowed, `unexpected script tag: ${tag}`).toBe(true);
    }
    expect(scripts.filter((s) => s.includes("theme.js"))).toHaveLength(1);
    expect(html).not.toMatch(/\son[a-z]+=/i);
    expect(html).not.toContain("javascript:");
  });

  test("carries no inline style attribute, because the CSP forbids one", () => {
    // This is the test that was missing. `style-src` governs the `style` ATTRIBUTE as well as the
    // `<style>` element, so under `style-src 'self'` every inline style is dropped by the browser —
    // silently, with no console error that a build would see. The page looked right on a local
    // static server that sends no policy and was wrong the moment nginx served it: the floor and
    // target marks stacked at the left edge of the hero card.
    //
    // Everything that used one is static, so it lives in the stylesheet now. See `derivedRules()`.
    expect(html).not.toMatch(/\sstyle="/i);
  });

  test("the positions the CSP would have dropped are in the stylesheet instead", () => {
    // 1,200 of 2,400 and 1,780 of 2,400 — the floor and the target on the hero scale.
    expect(styles).toContain(".scale-tick-floor, .scale-label-floor { left: 50.0%; }");
    expect(styles).toContain(".scale-tick-target, .scale-label-target { left: 74.2%; }");
    // One rule per verdict pill, so adding a fourth dimension cannot leave it un-staggered.
    expect(styles).toContain(".pill-3 { animation-delay: 740ms; }");
    expect(html).toContain('class="pill pill-bad pill-3"');
  });

  test("loads nothing from another origin", () => {
    // A page that promises no third-party anything must not fetch a font from a CDN. Every URL in
    // the document is either relative, a mailto, or one of the two configured destinations.
    const urls = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]!);
    const external = [...new Set(urls.filter((u) => /^[a-z]+:\/\//i.test(u)))];
    expect(external.sort()).toEqual(
      [
        config.appStoreUrl!,
        `${config.siteUrl}/`,
        `${config.telegramUrl!}?start=web_hero`,
        `${config.telegramUrl!}?start=web_foot`,
      ].sort(),
    );
  });

  test("the primary action appears twice — top and bottom — and always resolves", () => {
    const ctas = [...html.matchAll(/class="cta"/g)];
    expect(ctas).toHaveLength(2);
    expect(html).toContain(`href="${primaryCta(config, "hero").href}"`);
  });

  test("privacy and support are reachable from the page", () => {
    expect(html).toContain('href="/privacy"');
    expect(html).toContain('href="/support"');
  });

  test("copy with an apostrophe is escaped rather than emitted raw", () => {
    expect(html).not.toMatch(/<p class="hero-sub">[^<]*'/);
  });

  test("the canonical URL is the configured origin, with no doubled slash", () => {
    expect(html).toContain('<link rel="canonical" href="https://eait.fit/">');
  });

  test("the hero figure is labelled for a screen reader", () => {
    const label = html.match(/class="device" role="img" aria-label="([^"]+)"/);
    expect(label).not.toBeNull();
    expect(label![1]).toContain("1,780");
    expect(label![1]).toContain("Sodium bad");
  });
});

describe("the browser-tab icon", () => {
  test("is linked, so no visit starts with a 404 for /favicon.ico", () => {
    expect(html).toContain('<link rel="icon" href="/icon.svg" type="image/svg+xml">');
  });

  test("is the app's own mark, in the app's own accent", () => {
    // The same two shapes `scripts/make-icons.ts` rasterises for the home screen: a ring seen from
    // above at (512, 600) and a dot at (512, 190).
    const svg = iconSvg();
    expect(svg).toContain(`stroke="${color.accent}"`);
    expect(svg).toContain('cx="512" cy="190" r="76"');
    expect(svg).toContain(`fill="${color.bg}"`);
  });
});

describe("indexing is opt-in per environment", () => {
  test("only the exact string \"true\" opts in", () => {
    // A second box becoming indexable because a variable was set to something truthy-looking is
    // discovered by finding its hostname in a search result, weeks later.
    expect(loadLandingConfig({ ...ENV, EAIT__BACKEND__LANDING_INDEXABLE: "true" }).indexable).toBe(true);
    expect(loadLandingConfig({ ...ENV, EAIT__BACKEND__LANDING_INDEXABLE: "TRUE" }).indexable).toBe(true);
    for (const value of ["1", "yes", "on", "", "ture", undefined]) {
      expect(loadLandingConfig({ ...ENV, EAIT__BACKEND__LANDING_INDEXABLE: value }).indexable).toBe(false);
    }
    expect(loadLandingConfig(ENV).indexable).toBe(false);
  });

  test("a build nobody may index says so in the document as well as in robots.txt", () => {
    // Both, because they do different jobs: robots.txt asks a crawler not to FETCH, and a page it
    // never fetched is a page whose meta it never read — but a URL found on someone else's site can
    // be indexed without being fetched. `noindex` is what removes it once it has been.
    expect(html).toContain('<meta name="robots" content="noindex, nofollow">');
  });

  test("the production build carries no such meta", () => {
    const indexed = renderLanding(loadLandingConfig({ ...ENV, EAIT__BACKEND__LANDING_INDEXABLE: "true" }));
    expect(indexed).not.toContain('name="robots"');
  });
});

describe("the build output", () => {
  const outDir = () => mkdtempSync(join(tmpdir(), "landing-"));

  test("a non-indexable build disallows crawlers and ships no sitemap", async () => {
    const dir = outDir();
    const result = await buildLanding(ENV, dir);
    expect(readFileSync(join(dir, "robots.txt"), "utf8")).toContain("Disallow: /");
    expect(result.files).not.toContain("sitemap.xml");
    rmSync(dir, { recursive: true, force: true });
  });

  test("an indexable build invites them and ships one", async () => {
    const dir = outDir();
    const result = await buildLanding({ ...ENV, EAIT__BACKEND__LANDING_INDEXABLE: "true" }, dir);
    const robots = readFileSync(join(dir, "robots.txt"), "utf8");
    expect(robots).toContain("Allow: /");
    expect(robots).toContain("Sitemap: https://eait.fit/sitemap.xml");
    expect(result.files).toContain("sitemap.xml");
    rmSync(dir, { recursive: true, force: true });
  });

  test("nothing is written when the copy fails the claims gate", async () => {
    // The ordering that matters: validate, render, lint, THEN write. A deploy that races a failing
    // build must serve the last good page rather than half of a new one.
    const dir = outDir();
    rmSync(dir, { recursive: true, force: true });
    await expect(buildLanding({ ...ENV, EAIT__BACKEND__LANDING_SITE_URL: "not-a-url" }, dir)).rejects.toThrow();
    expect(existsSync(dir)).toBe(false);
  });
});

describe("the images", () => {
  test("favicon.ico is a real ICO, not a PNG with the wrong extension", () => {
    const ico = faviconIco();
    // ICONDIR: reserved 0, type 1 (icon), count 1.
    expect([ico[0], ico[1], ico[2], ico[3], ico[4], ico[5]]).toEqual([0, 0, 1, 0, 1, 0]);
    // Then the entry says 64×64 and points past itself at a PNG signature.
    expect(ico[6]).toBe(64);
    expect(ico[7]).toBe(64);
    expect([...ico.slice(22, 26)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  test("the share card is the size the meta tags claim", () => {
    // A mismatch here is not a broken image, it is a card that unfurls cropped — which is worse,
    // because it looks deliberate.
    const png = ogPng();
    const view = new DataView(png.buffer, png.byteOffset);
    expect(view.getUint32(16)).toBe(OG_WIDTH);   // IHDR width
    expect(view.getUint32(20)).toBe(OG_HEIGHT);  // IHDR height
    expect(html).toContain(`<meta property="og:image:width" content="${OG_WIDTH}">`);
    expect(html).toContain(`<meta property="og:image:height" content="${OG_HEIGHT}">`);
  });

  test("the share card is an absolute URL", () => {
    // Every unfurler requires it. A relative og:image silently produces a card with no image.
    expect(html).toContain(`<meta property="og:image" content="${config.siteUrl}/og.png">`);
  });
});

describe("attribution", () => {
  test("every bot link carries a start code, and they differ by placement", () => {
    // Without these the page converts into the organic bucket and cannot be judged at all —
    // which is the one thing `eait-marketer` built an attribution convention to avoid.
    const bot = [...html.matchAll(/https:\/\/t\.me\/[^"]*/g)].map((m) => m[0]);
    expect(bot.length).toBeGreaterThanOrEqual(2);
    for (const href of bot) expect(href).toMatch(/\?start=web_(hero|foot)$/);
    expect(new Set(bot).size).toBe(2);
  });

  test("start codes are payloads Telegram will accept", () => {
    // `[A-Za-z0-9_-]{1,64}`. A code Telegram rejects is a link that opens the bot with no /start
    // payload at all — which looks like it worked and records nothing.
    for (const code of Object.values(START_CODES)) expect(code).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
  });
});

describe("the page describes the surface its button opens", () => {
  test("before the listing exists, it says the app is not out", () => {
    // The page argues for an iPhone app and its only button opens Telegram. Saying so is the only
    // option consistent with the rest of it.
    const preLaunch = loadLandingConfig({
      EAIT__BACKEND__LANDING_SITE_URL: ENV.EAIT__BACKEND__LANDING_SITE_URL,
      EAIT__BACKEND__LANDING_TELEGRAM_URL: ENV.EAIT__BACKEND__LANDING_TELEGRAM_URL,
    });
    expect(surfaceNote(preLaunch)).toContain("not out yet");
    expect(renderLanding(preLaunch)).toContain("hero-surface");
  });

  test("once it exists there is nothing to explain", () => {
    expect(surfaceNote(config)).toBeNull();
    expect(html).not.toContain("hero-surface");
  });
});

describe("the measured numbers are the ones we actually measured", () => {
  const doc = readFileSync(resolve(REPO_ROOT, "docs/ACCURACY.md"), "utf8");

  test("the sample size on the page is the sample size in the eval", () => {
    // n is part of the claim. A page quoting an error rate without it is doing the thing this
    // section exists to refuse.
    const n = doc.match(/\*\*n = (\d+)\.\*\*/);
    expect(n).not.toBeNull();
    expect(measured.dishes as number).toBe(Number(n![1]));
  });

  test("the median and signed errors round to what the eval reports", () => {
    // Rounded on purpose: docs/ACCURACY.md warns that one-decimal comparisons between runs are
    // noise at this sample size, so the page must not borrow a precision the run does not have.
    const median = doc.match(/median absolute error \| ([\d.]+)%/);
    const signed = doc.match(/mean signed error \| \+([\d.]+)%/);
    expect(median).not.toBeNull();
    expect(signed).not.toBeNull();
    expect(measured.medianErrorPct as number).toBe(Math.round(Number(median![1])));
    expect(measured.meanSignedErrorPct as number).toBe(Math.round(Number(signed![1])));
  });

  test("the page states the sample size next to the number", () => {
    expect(html).toContain(`${measured.dishes} reference dishes`);
    expect(html).toContain("smoke test rather than a study");
  });
});

describe("the founder line", () => {
  test("is on the page and attributed", () => {
    expect(html).toContain(founder.line.replace(/ /g, " ").slice(0, 40));
    expect(html).toContain("founder-by");
  });

  test("claims a result for nobody but its author", () => {
    // The line that would have to be refused: anything promising the READER an outcome. This one
    // is a first-person statement of fact, which is why the claims gate lets it through.
    expect(lintCopy({ founder: founder.line })).toEqual([]);
    expect(founder.line).toMatch(/^I /);
  });
});

describe("the mailing list on the page", () => {
  const withApi = loadLandingConfig({ ...ENV, EAIT__BACKEND__LANDING_API_URL: "https://api.eait.fit" });
  const withForm = renderLanding(withApi);

  test("no API means no form, rather than a form that posts nowhere", () => {
    // The failure this prevents is the expensive one: collecting an address at the exact moment
    // somebody decided to give you one, and losing it.
    expect(config.apiUrl).toBeNull();
    expect(html).not.toContain("<form");
  });

  test("the form posts to the API's subscribe route and carries a source", () => {
    expect(withForm).toContain('action="https://api.eait.fit/v1/subscribe"');
    expect(withForm).toContain('method="post"');
    expect(withForm).toContain(`value="${START_CODES.footer}"`);
  });

  test("the honeypot is present, off-screen and out of the tab order", () => {
    // Hidden from people three ways: positioned off-screen in CSS, tabindex -1, aria-hidden on the
    // wrapper. Not display:none, which some bots skip.
    expect(withForm).toContain('name="company"');
    expect(withForm).toContain('tabindex="-1"');
    expect(withForm).toContain('aria-hidden="true"');
    expect(styles).toContain(".honeypot {");
    expect(styles).not.toContain(".honeypot { display: none");
  });

  test("the submit button does not take the accent", () => {
    // One accent per screen, on one action. A second lime button asks for two things at once.
    expect(styles).toContain(".subscribe-button {");
    const rule = styles.slice(styles.indexOf(".subscribe-button {"));
    expect(rule.slice(0, rule.indexOf("}"))).not.toContain("var(--accent)");
  });

  test("every redirect target is built, so none of them 404s", () => {
    const pages = outcomePages(withApi);
    // `try-later` is the fourth and it exists because of a real defect: a submission refused by the
    // daily cap used to land on `subscribed`, so the person was told they were on a list they were
    // not on, and the address was gone. An outcome without a page is an outcome that lies.
    expect(Object.keys(pages).sort()).toEqual([
      "check-your-email.html", "not-subscribed.html", "subscribed.html", "try-later.html",
      "unsubscribed.html",
    ]);
    for (const page of Object.values(pages)) {
      expect(lintCopy(copyFromHtml(page))).toEqual([]);
      expect(page).toContain('<meta name="robots" content="noindex">');
      expect(page).not.toContain("<form");
    }
  });

  test("the privacy copy no longer claims the product holds no address anywhere", () => {
    // The old sentence — "there is no address here to leak" — stopped being true the moment a form
    // existed. The claim has to name which half it is about.
    expect(html).toContain("The app never asks for your email");
    expect(html).not.toContain("no address here to leak");
  });

  test("the page says out loud that deleting an account does not leave the list", () => {
    // The surprising consequence of keeping them separate. Burying it is how a privacy promise
    // becomes a complaint.
    expect(withForm).toContain("Deleting an eait account does not remove an address from this list");
  });
});

describe("Spud", () => {
  const mascotSource = readFileSync(resolve(REPO_ROOT, MASCOT_SOURCE), "utf8");
  const withApi = renderLanding(loadLandingConfig({ ...ENV, EAIT__BACKEND__LANDING_API_URL: "https://api.eait.fit" }));

  test("the potato on the web is the potato in the app", () => {
    // A subtly different potato on the page immediately before the App Store screenshots is worse
    // than none. The outline is the piece that breaks: the first version was near-circular and
    // everybody read it as a peach.
    //
    // `joined` splices adjacent string literals back together first — the body path is authored in
    // that file as two quoted halves and a `+`, so a naive substring search never finds it and the
    // guard would pass by never matching anything.
    const joined = mascotSource.replace(/"\s*\+\s*"/g, "");
    expect(joined).toContain(BODY);
    expect(joined).toContain(SHEEN);
  });

  test("the drift guard would actually catch a drift", () => {
    // The failure this test exists for: a guard that greps a file for a string it can never find,
    // reports green forever, and is the reason nobody noticed the potato changed.
    const joined = mascotSource.replace(/"\s*\+\s*"/g, "");
    expect(joined).not.toContain(BODY.replace("M8 60", "M9 61"));
  });

  test("every mood's mouth matches the app's", () => {
    for (const mouth of Object.values(MOUTHS)) expect(mascotSource).toContain(mouth);
  });

  test("he appears exactly three times, and never in the hero", () => {
    // His rule in the app is one place only, because the category's failure is reward theatre and
    // a potato sprinkled over every section IS that. Three jobs here: a refusal, a question, and a
    // greeting on the page after the form.
    expect([...withApi.matchAll(/class="spud"/g)]).toHaveLength(2);
    const hero = withApi.slice(withApi.indexOf('class="hero"'), withApi.indexOf('class="section"'));
    expect(hero).not.toContain('class="spud"');
  });

  test("he is beside the floor and beside the form, which are his two jobs here", () => {
    const floor = withApi.slice(withApi.indexOf("floor-outro"), withApi.indexOf("floor-outro") + 2000);
    expect(floor).toContain("spud-floor");
    expect(withApi).toContain("spud-subscribe");
  });

  test("each appearance has its own gradient id", () => {
    // Two inline SVGs sharing one linearGradient id is not a warning, it is a second potato with
    // no fill.
    const ids = [...withApi.matchAll(/<linearGradient id="([^"]+)"/g)].map((m) => m[1]!);
    expect(ids.length).toBeGreaterThan(1);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("he is hidden from assistive technology, and never the only carrier of anything", () => {
    // A screen reader announcing "smiling potato" between a heading and its paragraph is noise.
    // Every line he says is decoration beside copy that already states it.
    for (const svg of withApi.matchAll(/<svg class="spud"[^>]*>/g)) {
      expect(svg[0]).toContain('aria-hidden="true"');
      expect(svg[0]).toContain('focusable="false"');
    }
  });

  test("he never congratulates anyone", () => {
    // The rule from mascot.tsx, kept. `cheer` is the mood with sparkles and both arms up; it has
    // no job on this page and is not one of the moods this module can even draw.
    const moods: string[] = Object.keys(MOUTHS);
    expect(moods).not.toContain("cheer");
    expect(moods.sort()).toEqual(["care", "think", "wave"]);
  });
});

describe("search and LLM engines", () => {
  const outDir = () => mkdtempSync(join(tmpdir(), "landing-"));

  test("the page carries JSON-LD that parses, and its FAQ matches the page's", () => {
    const match = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
    expect(match).not.toBeNull();
    // `<` must not appear raw inside the block — "</script>" in an answer would end the element
    // mid-JSON. Serialised as < instead.
    expect(match![1]!).not.toContain("<");
    const graph = JSON.parse(match![1]!) as { "@graph": Array<Record<string, unknown>> };
    const types = graph["@graph"].map((node) => node["@type"]);
    expect(types).toContain("Organization");
    expect(types).toContain("WebSite");
    expect(types).toContain("FAQPage");
    const faqNode = graph["@graph"].find((node) => node["@type"] === "FAQPage") as {
      mainEntity: Array<{ name: string }>;
    };
    expect(faqNode.mainEntity.length).toBe(faqs.length);
    expect(faqNode.mainEntity[0]!.name).toBe(faqs[0]!.q);
  });

  test("an indexable build ships llms.txt; a private one does not", async () => {
    const dir = outDir();
    const result = await buildLanding({ ...ENV, EAIT__BACKEND__LANDING_INDEXABLE: "true" }, dir);
    expect(result.files).toContain("llms.txt");
    const text = readFileSync(join(dir, "llms.txt"), "utf8");
    // The floor is the page's central safety fact; a summary for machines that omits it is a
    // summary that misrepresents the product. Localised, exactly as the page prints it.
    expect(text).toContain(KCAL_FLOOR.female.toLocaleString("en-GB"));
    expect(text).toContain(KCAL_FLOOR.male.toLocaleString("en-GB"));
    expect(text).toContain("https://eait.fit/privacy");
    rmSync(dir, { recursive: true, force: true });

    const dark = outDir();
    const hidden = await buildLanding(ENV, dark);
    expect(hidden.files).not.toContain("llms.txt");
    rmSync(dark, { recursive: true, force: true });
  });
});

describe("the email form is the primary action while nothing else exists", () => {
  // Telegram was the proof of concept; the page no longer sends anybody there. With no store
  // listing either, the ONE thing a visitor can do is leave an address — so the form is the
  // primary action, in the hero, not a section they have to find.
  const FORM_ENV = {
    EAIT__BACKEND__LANDING_SITE_URL: "https://eait.fit",
    EAIT__BACKEND__LANDING_API_URL: "https://api.eait.fit",
  };
  const formConfig = loadLandingConfig(FORM_ENV);
  const formHtml = renderLanding(formConfig);

  test("a live form counts as a working call to action", () => {
    expect(primaryAction(formConfig)).toBe("form");
    expect(() => loadLandingConfig(FORM_ENV)).not.toThrow();
  });

  test("with nothing at all — no store, no bot, no form — the build still refuses", () => {
    expect(() => loadLandingConfig({ EAIT__BACKEND__LANDING_SITE_URL: "https://eait.fit" })).toThrow(
      /no working call to action/,
    );
  });

  test("the hero carries the form, attributed as the hero action", () => {
    const hero = formHtml.slice(0, formHtml.indexOf("</section>"));
    expect(hero).toContain('action="https://api.eait.fit/v1/subscribe"');
    expect(hero).toContain(`value="${START_CODES.hero}"`);
  });

  test("two forms on one page do not share input ids", () => {
    expect(formHtml).toContain('id="email-hero"');
    expect(formHtml).toContain('id="email"');
    const ids = [...formHtml.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("no link on the page points at Telegram", () => {
    expect(formHtml).not.toContain("t.me");
    expect(formHtml).not.toContain("Telegram");
  });

  test("the store link still wins outright when it exists", () => {
    const launched = loadLandingConfig({
      ...FORM_ENV,
      EAIT__BACKEND__LANDING_APP_STORE_URL: "https://apps.apple.com/app/id0000000000",
    });
    expect(primaryAction(launched)).toBe("store");
  });
});

describe("the form looks like the primary action when it is one", () => {
  const FORM_ENV = { EAIT__BACKEND__LANDING_SITE_URL: "https://eait.fit", EAIT__BACKEND__LANDING_API_URL: "https://api.eait.fit" };
  const formHtml = renderLanding(loadLandingConfig(FORM_ENV));

  test("form mode dresses the submit button as the accent; store mode does not", () => {
    // The old comment in styles.ts said the accent belongs to the CTA. In form mode the form IS
    // the CTA, so it inherits the accent — and in store mode it yields it back to the store button.
    expect(formHtml).toContain("subscribe-primary");
    expect(html).not.toContain("subscribe-primary");
    expect(styles).toContain(".subscribe-primary .subscribe-button");
  });

  test("an invalid address is flagged inline, in the page's own voice, before the browser bubble", () => {
    expect(formHtml).toContain("subscribe-error");
    expect(formHtml).toContain("you@example.com");
    expect(styles).toContain(":user-invalid");
  });
});
