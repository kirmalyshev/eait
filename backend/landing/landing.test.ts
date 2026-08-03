import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { assertClean, ClaimsError, copyFromHtml, lintCopy } from "./claims.ts";
import {
  loadLandingConfig, LandingConfigError, primaryCta, secondaryCta, surfaceNote, START_CODES,
} from "./config.ts";
import { iconSvg, renderLanding } from "./render.ts";
import { buildLanding } from "./build.ts";
import { faviconIco, ogPng, OG_HEIGHT, OG_WIDTH } from "./images.ts";
import { color, TOKEN_SOURCE } from "./tokens.ts";
import { styles } from "./styles.ts";
import { refusals, floorSection, sample } from "./content.ts";
import { KCAL_FLOOR } from "@ieat/shared";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

const ENV = {
  LANDING_SITE_URL: "https://eait.fit",
  LANDING_APP_STORE_URL: "https://apps.apple.com/app/id0000000000",
  LANDING_TELEGRAM_URL: "https://t.me/eait_bot",
};

const config = loadLandingConfig(ENV);
const html = renderLanding(config);

describe("config", () => {
  test("refuses a build with no canonical origin", () => {
    expect(() => loadLandingConfig({ LANDING_TELEGRAM_URL: ENV.LANDING_TELEGRAM_URL })).toThrow(
      LandingConfigError,
    );
  });

  test("refuses a page with nothing to tap", () => {
    expect(() => loadLandingConfig({ LANDING_SITE_URL: ENV.LANDING_SITE_URL })).toThrow(
      /no working call to action/,
    );
  });

  test("refuses cleartext for anything a stranger can reach", () => {
    expect(() => loadLandingConfig({ ...ENV, LANDING_SITE_URL: "http://eait.fit" })).toThrow(
      /must be https/,
    );
  });

  test("allows http for a local preview", () => {
    const local = loadLandingConfig({ ...ENV, LANDING_SITE_URL: "http://localhost:4173" });
    expect(local.siteUrl).toBe("http://localhost:4173");
  });

  test("refuses a store link that does not point at the store", () => {
    // The failure this prevents: a shortener or a marketing redirect in the one link that has to
    // open the App Store app rather than a browser tab.
    expect(() =>
      loadLandingConfig({ ...ENV, LANDING_APP_STORE_URL: "https://eait.fit/download" }),
    ).toThrow(/apps\.apple\.com/);
  });

  test("refuses a bot link that is not a Telegram link", () => {
    expect(() => loadLandingConfig({ ...ENV, LANDING_TELEGRAM_URL: "https://t.me.evil/eait" }))
      .toThrow(/t\.me/);
  });

  test("the trailing slash is normalised away, so canonical URLs cannot double it", () => {
    const trailing = loadLandingConfig({ ...ENV, LANDING_SITE_URL: "https://eait.fit/" });
    expect(trailing.siteUrl).toBe("https://eait.fit");
  });

  test("the store link is primary when it exists", () => {
    // The store link goes out untouched: Apple takes campaign attribution through pt/ct provider
    // tokens, not a query string of ours.
    expect(primaryCta(config, "hero").href).toBe(ENV.LANDING_APP_STORE_URL);
    expect(secondaryCta(config, "hero")?.href).toBe(`${ENV.LANDING_TELEGRAM_URL}?start=web_hero`);
  });

  test("before the listing exists the bot is primary, not a consolation link", () => {
    const preLaunch = loadLandingConfig({
      LANDING_SITE_URL: ENV.LANDING_SITE_URL,
      LANDING_TELEGRAM_URL: ENV.LANDING_TELEGRAM_URL,
    });
    expect(primaryCta(preLaunch, "hero").href).toBe(`${ENV.LANDING_TELEGRAM_URL}?start=web_hero`);
    expect(secondaryCta(preLaunch, "hero")).toBeNull();
  });

  test("a copy-review date is a date", () => {
    expect(() => loadLandingConfig({ ...ENV, LANDING_UPDATED: "yesterday" })).toThrow(/YYYY-MM-DD/);
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
    // `eait-marketer/DECISIONS.md` 2026-07-26 retired a caption for exactly this class: an
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

  test("the hero's sample target sits above its own floor", () => {
    // A hero that draws the target mark to the left of the floor mark would illustrate the exact
    // thing the page says cannot happen.
    expect(sample.target.kcal).toBeGreaterThan(sample.target.floorKcal);
  });
});

describe("palette", () => {
  test("every token matches src/mobile/lib/theme.ts", () => {
    const theme = readFileSync(resolve(REPO_ROOT, TOKEN_SOURCE), "utf8");
    for (const [name, value] of Object.entries(color)) {
      const declared = theme.match(new RegExp(`\\b${name}:\\s*"(#[0-9A-Fa-f]{6})"`));
      expect(declared, `${name} is not declared in ${TOKEN_SOURCE}`).not.toBeNull();
      expect(declared![1]!.toUpperCase()).toBe(value.toUpperCase());
    }
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
    // The app's rule, kept on the page. `--accent` may be defined once and used by `.cta`; any
    // third use means something else on the page is competing with the button.
    const uses = [...styles.matchAll(/var\(--accent\)/g)].length;
    expect(uses).toBeLessThanOrEqual(3);
    expect(styles).toContain(".cta {");
  });
});

describe("the rendered page", () => {
  test("has exactly one h1", () => {
    expect([...html.matchAll(/<h1\b/g)]).toHaveLength(1);
  });

  test("carries no script at all, which is what lets the CSP forbid one", () => {
    expect(html).not.toContain("<script");
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
    // A staging box becoming indexable because a variable was set to something truthy-looking is
    // discovered by finding the staging hostname in a search result, weeks later.
    expect(loadLandingConfig({ ...ENV, LANDING_INDEXABLE: "true" }).indexable).toBe(true);
    expect(loadLandingConfig({ ...ENV, LANDING_INDEXABLE: "TRUE" }).indexable).toBe(true);
    for (const value of ["1", "yes", "on", "", "ture", undefined]) {
      expect(loadLandingConfig({ ...ENV, LANDING_INDEXABLE: value }).indexable).toBe(false);
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
    const indexed = renderLanding(loadLandingConfig({ ...ENV, LANDING_INDEXABLE: "true" }));
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
    const result = await buildLanding({ ...ENV, LANDING_INDEXABLE: "true" }, dir);
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
    await expect(buildLanding({ ...ENV, LANDING_SITE_URL: "not-a-url" }, dir)).rejects.toThrow();
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
      LANDING_SITE_URL: ENV.LANDING_SITE_URL,
      LANDING_TELEGRAM_URL: ENV.LANDING_TELEGRAM_URL,
    });
    expect(surfaceNote(preLaunch)).toContain("not out yet");
    expect(renderLanding(preLaunch)).toContain("hero-surface");
  });

  test("once it exists there is nothing to explain", () => {
    expect(surfaceNote(config)).toBeNull();
    expect(html).not.toContain("hero-surface");
  });
});
