import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { assertClean, ClaimsError, copyFromHtml, lintCopy } from "./claims.ts";
import {
  DEFAULT_UPDATED_AT, loadLandingConfig, LandingConfigError, primaryAction, primaryCta, secondaryCta,
  surfaceNote, START_CODES,
} from "./config.ts";
import { emphasis, esc, iconSvg, outcomePages, renderLanding } from "./render.ts";
import { buildLanding } from "./build.ts";
import { faviconIco, ogPng, OG_HEIGHT, OG_WIDTH } from "./images.ts";
import { color, dark, light, TOKEN_SOURCE } from "./tokens.ts";
import { BODY, MASCOT_SOURCE, MOUTHS, SHEEN } from "./mascot.ts";
import { styles } from "./styles.ts";
import {
  brand, faqs, figures, figuresSection, founder, measured, refusals, floorSection, sample,
  screensSection, shots, subscribeSection,
} from "./content.ts";
import { BAD_SHARE, FREE_ANALYSES, KCAL_FLOOR, MAX_DEFICIT_SHARE, WARN_SHARE } from "@eait/shared";

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

  test("the web sign-up is the second action wherever it exists, and outranks the bot", () => {
    const withStart = loadLandingConfig({ ...ENV, EAIT__BACKEND__LANDING_START_URL: "https://api.eait.fit/start" });
    // Not the bot, even though the bot is configured: `/start` creates the ACCOUNT the app opens
    // into, and the bot is a demonstration.
    // Carrying its placement code, like the bot link does: the difference between a tap at the top
    // and one at the bottom is the only cheap read on whether the page's argument is doing any work.
    expect(secondaryCta(withStart, "hero")?.href).toBe("https://api.eait.fit/start?start=web_hero");
    expect(secondaryCta(withStart, "footer")?.href).toBe("https://api.eait.fit/start?start=web_foot");
    expect(renderLanding(withStart)).toContain("https://api.eait.fit/start?start=web_hero");
    // And the primary is untouched — the store still wins the accent.
    expect(primaryCta(withStart, "hero").href).toBe(ENV.EAIT__BACKEND__LANDING_APP_STORE_URL);
  });

  test("offers the web sign-up in a FORM build too, where it is the only way in", () => {
    // The configuration production is in today: no listing, so the hero renders the mailing-list
    // form instead of `ctaBlock` — which is what carries `secondaryCta`. The link vanished here,
    // in exactly the build where `/start` is the only place anybody can onboard at all.
    const preLaunch = loadLandingConfig({
      EAIT__BACKEND__LANDING_SITE_URL: ENV.EAIT__BACKEND__LANDING_SITE_URL,
      EAIT__BACKEND__LANDING_API_URL: "https://api.eait.fit",
      EAIT__BACKEND__LANDING_START_URL: "https://api.eait.fit/start",
    });
    expect(primaryAction(preLaunch)).toBe("form");
    const page = renderLanding(preLaunch);
    expect(page).toContain("https://api.eait.fit/start?start=web_hero");
    // ONCE. The repetition on this page is one offer asked five times; a second offer beside each
    // of them is a different page.
    expect(page.match(/api\.eait\.fit\/start/g)).toHaveLength(1);
  });

  test("says nothing about a web sign-up that is not configured", () => {
    expect(secondaryCta(config, "hero")?.href).not.toContain("/start");
    expect(html).not.toContain("set up your plan on the web");
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

  test("it catches the negative-universal form, which slipped it once", () => {
    // "Nobody in this category publishes anything" reached the deployed page: same
    // Alleinstellungsbehauptung as "the only app", in a shape the regexes did not cover. A
    // red-team pass caught it, not the build — this is the regression test for the gate hole.
    expect(() => assertClean({ body: "nobody in this category publishes anything" })).toThrow(/exclusivity/);
    expect(() => assertClean({ body: "no one else in the category does this" })).toThrow(/exclusivity/);
    // The floor outro's "a guard nobody is told about" is ordinary language, not a market claim.
    expect(lintCopy({ body: "A guard nobody is told about protects no one." })).toEqual([]);
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
    // "No trial" is the version of the same promise that survived three edits — it was in the CTA
    // note under the button and in the meta description search results show, neither of which reads
    // like copy while you are editing the sections. There IS a trial; it is a week long.
    expect(html.toLowerCase()).not.toContain("no trial");
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
    // the document is either relative, a mailto, or one of the configured destinations — one per
    // ask, and the screenshots are same-origin files under /assets like everything else.
    const urls = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]!);
    const external = [...new Set(urls.filter((u) => /^[a-z]+:\/\//i.test(u)))];
    expect(external.sort()).toEqual(
      [
        config.appStoreUrl!,
        `${config.siteUrl}/`,
        ...Object.values(START_CODES).map((code) => `${config.telegramUrl!}?start=${code}`),
      ].sort(),
    );
  });

  test("the primary action appears once per ask, and every one of them resolves", () => {
    // It was two — the hero and the foot — across eight thousand pixels, so a reader convinced by
    // the third of eight sections had to scroll past the other five to act on it. There is one ask
    // per placement now, and START_CODES is the list: adding a band without a code, or a code
    // without a band, fails here rather than in an attribution report three weeks later.
    const ctas = [...html.matchAll(/class="cta"/g)];
    expect(ctas).toHaveLength(Object.keys(START_CODES).length);
    for (const placement of Object.keys(START_CODES) as (keyof typeof START_CODES)[]) {
      expect(html).toContain(`href="${primaryCta(config, placement).href}"`);
    }
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

  test("the production build refuses nothing and asks for a large image preview", () => {
    // It used to carry no `robots` meta at all, which is not the same as carrying a permissive
    // one: absent means Google's default, and the default serves a STANDARD image preview, which
    // is what disqualifies a page from Discover's large-image treatment. The share card is already
    // 1200×630, so the size bar was met and the format forfeited on a missing directive.
    const indexed = renderLanding(loadLandingConfig({ ...ENV, EAIT__BACKEND__LANDING_INDEXABLE: "true" }));
    expect(indexed).toContain('<meta name="robots" content="max-image-preview:large, max-snippet:-1">');
    expect(indexed).not.toContain("noindex");
  });
});

describe("the build output", () => {
  const outDir = () => mkdtempSync(join(tmpdir(), "landing-"));

  test("no rendered output still promises that photos are never stored", async () => {
    const dir = outDir();
    await buildLanding({ ...ENV, EAIT__BACKEND__LANDING_INDEXABLE: "true" }, dir);
    const gone = /never stored|deleted once|no bytes behind|no photographs|analysed, dropped/i;
    expect(html).not.toMatch(gone);
    expect(readFileSync(join(dir, "llms.txt"), "utf8")).not.toMatch(gone);
    rmSync(dir, { recursive: true, force: true });
  });

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
    // The answer engines are named because group matching is EXCLUSIVE (RFC 9309 §2.2.1): a bot
    // that finds its own group ignores `*`. Naming them is what stops a later `Disallow:` under
    // `*` taking them out of every AI answer as a side effect nobody meant.
    for (const bot of ["GPTBot", "ClaudeBot", "PerplexityBot", "OAI-SearchBot", "Google-Extended"]) {
      expect(robots).toContain(`User-agent: ${bot}\nAllow: /`);
    }
    // Every group ends up allowed, and there is exactly one Sitemap line for all of them.
    expect(robots.match(/^Disallow:/m)).toBeNull();
    // BINGBOT MUST NOT BE NAMED. The exclusivity that protects the answer engines would exempt a
    // general crawler from a `Disallow:` added to `*` later, and Bing is the name here with real
    // index volume. It reads the `*` group, where `Allow: /` already covers it. It was listed for
    // one commit.
    expect(robots).not.toContain("Bingbot");
    expect(robots.match(/Sitemap:/g)!.length).toBe(1);
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
    const codes = Object.values(START_CODES);
    expect(bot.length).toBeGreaterThanOrEqual(codes.length);
    for (const href of bot) expect(codes).toContain(href.split("?start=")[1] as never);
    // One distinct code per ask. Two bands sharing a code is a report that cannot tell which
    // argument converted, which is the only reason the codes exist.
    expect(new Set(bot).size).toBe(codes.length);
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

  test("every appearance is a job, and the count is the job list", () => {
    // The count doctrine changed on the owner's instruction (2026-08-31: use the mascot's
    // variations) — but the anti-reward-theatre rule underneath it did not. Four appearances on
    // the page, each one a thing he already does in the product: the correction note inside the
    // drawn phone, being argued with at accuracy, the refusal at the floor, the question at the
    // form. A fifth needs a JOB, not a gap it could decorate.
    expect([...withApi.matchAll(/class="spud"/g)]).toHaveLength(4);
    for (const id of ["spud-hero", "spud-accuracy", "spud-floor", "spud-subscribe"]) {
      expect(withApi).toContain(`<linearGradient id="${id}"`);
    }
  });

  test("in the hero he is INSIDE the instrument, speaking the note — not pasted beside it", () => {
    // The old rule was "never in the hero", to keep the page from reading as a game with a mascot
    // stapled on. What replaced it is narrower: he may appear where the app itself would show him,
    // and in the drawn phone that is the correction note under the card.
    const device = withApi.slice(withApi.indexOf('class="device"'), withApi.indexOf("</figure>"));
    expect(device).toContain("spud-hero");
    const heroOutsideDevice =
      withApi.slice(withApi.indexOf('class="hero"'), withApi.indexOf('class="device"'));
    expect(heroOutsideDevice).not.toContain('class="spud"');
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
    // The rule from mascot.tsx, kept THROUGH the variations instruction: `cheer` is the mood with
    // sparkles and both arms up, its sparkles are accent-coloured on a page that spends the accent
    // once, and it is reward theatre in one drawing. Five moods now, and still not that one.
    const moods: string[] = Object.keys(MOUTHS);
    expect(moods).not.toContain("cheer");
    expect(moods.sort()).toEqual(["care", "happy", "idle", "think", "wave"]);
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

  /** The graph, parsed, for whichever config is asked about. */
  const graphOf = (env: Record<string, string | undefined>) => {
    const doc = renderLanding(loadLandingConfig(env));
    const block = doc.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)![1]!;
    return (JSON.parse(block) as { "@graph": Array<Record<string, unknown>> })["@graph"];
  };

  test("the title sells the category, not only the brand", () => {
    // The failure this replaces: `eait — will this meal fit your day?`, which is the brand voice
    // and two phrases nobody types. A title is the highest-weighted text on the page, and spending
    // all of it on an unknown name means the page can only be found by people who know the name.
    expect(brand.title.length).toBeLessThanOrEqual(60);
    expect(brand.title.toLowerCase()).toContain("calorie");
    expect(brand.title.toLowerCase()).toContain("tracker");
    // Still ours: the differentiator and the brand both survive the rewrite.
    expect(brand.title.toLowerCase()).toContain("verdict");
    expect(brand.title).toContain(brand.name);
    expect(html).toContain(`<title>${brand.title}</title>`);
  });

  test("the description is snippet-length and says what the thing is", () => {
    const description = html.match(/<meta name="description" content="([^"]+)">/)![1]!;
    // Google truncates around 155 on desktop; a snippet cut mid-clause is a wasted one.
    expect(description.length).toBeGreaterThan(120);
    expect(description.length).toBeLessThanOrEqual(160);
    // `The meal-verdict app` was in here: a category of one, invented on this page, searched for
    // by nobody. The words that replaced it are the ones a search engine can bold.
    expect(description).not.toContain("meal-verdict");
    for (const word of ["Photograph", "calories", "protein"]) expect(description).toContain(word);
    // og: and the JSON-LD descriptions are the same string, never a second copy.
    expect(html).toContain(`<meta property="og:description" content="${description}">`);
  });

  test("a named person stands behind a health-adjacent page", () => {
    // The one E-E-A-T claim this page can make honestly. Competitors that get cited invest here —
    // Lose It! declares dietitian authorship in its own llms.txt — and we cannot claim that. What
    // is true is that a named person builds it and is already the named data controller.
    const person = graphOf(ENV).find((node) => node["@type"] === "Person") as
      | { name: string; description: string }
      | undefined;
    expect(person).toBeDefined();
    expect(person!.name).toBe("Kirill");
    expect(person!.description).toBe(founder.line);
    const org = graphOf(ENV).find((node) => node["@type"] === "Organization")!;
    expect(org.founder).toEqual({ "@id": "https://eait.fit/#founder" });
    // NO POSTAL ADDRESS. The privacy policy carries one because the law requires it of a natural
    // person; JSON-LD would publish a home address in the format built for harvesting.
    expect(JSON.stringify(graphOf(ENV))).not.toContain("Lisa-Fittko");
    expect(JSON.stringify(graphOf(ENV))).not.toContain("address");
  });

  test("the page node carries the copy-review date, not the build clock", () => {
    // Answer engines weight recency, so this is the one date on the page — and it must be the
    // date the WORDS changed. A nightly redeploy that changed nothing must not read as news.
    // Same value, same reason, as the sitemap's `lastmod`.
    const page = graphOf(ENV).find((node) => node["@type"] === "WebPage")!;
    expect(page.dateModified).toBe(DEFAULT_UPDATED_AT);
    expect(page.dateModified).toBe(loadLandingConfig(ENV).updatedAt);
  });

  test("the app's structured data and its install banner appear only once the listing does", () => {
    // A `MobileApplication` for an app nobody can install is the machine-readable version of the
    // mismatch `surfaceNote` confesses in prose — and it would be read back to somebody by an
    // answer engine as a recommendation to go and install it. Both switch on with the store URL.
    const withStore = graphOf(ENV);
    const app = withStore.find((node) => node["@type"] === "MobileApplication") as
      | { operatingSystem: string; installUrl: string; screenshot: string[] }
      | undefined;
    expect(app).toBeDefined();
    expect(app!.operatingSystem).toBe("iOS");
    expect(app!.installUrl).toBe(ENV.EAIT__BACKEND__LANDING_APP_STORE_URL);
    expect(app!.screenshot.length).toBe(shots.length);
    expect(html).toContain('<meta name="apple-itunes-app" content="app-id=0000000000">');

    const preLaunch = { ...ENV, EAIT__BACKEND__LANDING_APP_STORE_URL: undefined };
    expect(graphOf(preLaunch).map((node) => node["@type"])).not.toContain("MobileApplication");
    expect(renderLanding(loadLandingConfig(preLaunch))).not.toContain("apple-itunes-app");
  });

  test("no price and no rating are ever asserted", () => {
    // The price is per-territory and lives in App Store Connect (content.ts header); a rating we
    // have not received is a fabricated one. Both are penalised in rich results and both are the
    // kind of claim `claims.ts` exists to keep off this page.
    const serialised = JSON.stringify(graphOf(ENV));
    expect(serialised).not.toContain("aggregateRating");
    expect(serialised).not.toContain("offers");
    expect(serialised).not.toContain("priceCurrency");
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

  test("llms.txt says whether the app can actually be installed yet", async () => {
    // Everything under it describes an iPhone app. Read by an answer engine while that app is
    // unreleased, the sections alone tell somebody to go and install it — the same mismatch
    // `surfaceNote` exists to confess on the page, in the file a model quotes verbatim.
    const dir = outDir();
    const preLaunch = {
      EAIT__BACKEND__LANDING_SITE_URL: ENV.EAIT__BACKEND__LANDING_SITE_URL,
      EAIT__BACKEND__LANDING_TELEGRAM_URL: ENV.EAIT__BACKEND__LANDING_TELEGRAM_URL,
      EAIT__BACKEND__LANDING_INDEXABLE: "true",
    };
    const text = readFileSync(
      join((await buildLanding(preLaunch, dir)).outDir, "llms.txt"),
      "utf8",
    );
    expect(text).toContain("## Availability");
    expect(text).toContain(surfaceNote(loadLandingConfig(preLaunch))!);
    expect(text).toContain(`Last reviewed: ${DEFAULT_UPDATED_AT}`);
    rmSync(dir, { recursive: true, force: true });

    const launched = outDir();
    const shipped = readFileSync(
      join((await buildLanding({ ...ENV, EAIT__BACKEND__LANDING_INDEXABLE: "true" }, launched)).outDir, "llms.txt"),
      "utf8",
    );
    expect(shipped).not.toContain("## Availability");
    rmSync(launched, { recursive: true, force: true });
  });

  test("the IndexNow key file is written only where a submission would be legitimate", async () => {
    // The file at `/<key>.txt` is the whole verification mechanism: publishing it is what proves
    // the key belongs to whoever submits URLs for this host. A preview container publishing one
    // could push URLs on the real domain's behalf, so it is gated on `indexable` like the sitemap,
    // and written by the build because `rm(outDir)` deletes anything placed by hand.
    const key = "eait-indexnow-abc123";
    const dir = outDir();
    const built = await buildLanding(
      { ...ENV, EAIT__BACKEND__LANDING_INDEXABLE: "true", EAIT__BACKEND__LANDING_INDEXNOW_KEY: key },
      dir,
    );
    expect(built.files).toContain(`${key}.txt`);
    expect(readFileSync(join(dir, `${key}.txt`), "utf8")).toBe(key);
    rmSync(dir, { recursive: true, force: true });

    const preview = outDir();
    const hidden = await buildLanding({ ...ENV, EAIT__BACKEND__LANDING_INDEXNOW_KEY: key }, preview);
    expect(hidden.files).not.toContain(`${key}.txt`);
    rmSync(preview, { recursive: true, force: true });
  });

  test("a key that would become a bad filename is refused, not sanitised", () => {
    // It becomes a filename on this origin, so a slash or a dot writes somewhere nobody intended —
    // and IndexNow itself only accepts 8-128 of [A-Za-z0-9-], so a bad key is a submission that
    // fails at the engine with a 403 nobody is watching for.
    for (const bad of ["short", "has/slash", "has.dot", "has space", "a".repeat(129)]) {
      expect(() => loadLandingConfig({ ...ENV, EAIT__BACKEND__LANDING_INDEXNOW_KEY: bad })).toThrow(
        LandingConfigError,
      );
    }
    expect(loadLandingConfig({ ...ENV, EAIT__BACKEND__LANDING_INDEXNOW_KEY: "abcd-1234" }).indexNowKey)
      .toBe("abcd-1234");
    expect(loadLandingConfig(ENV).indexNowKey).toBeNull();
  });

  test("the two shared pages name the landing host as their canonical copy", async () => {
    // `privacy.html` and `support.html` are served here AND on the API domain (deploy/Caddyfile) —
    // App Store Connect requires both URLs and there is exactly one copy of the bytes. Without
    // this the product has each of its legal pages indexed twice on two hostnames, competing:
    // the failure `EAIT__BACKEND__LANDING_INDEXABLE` prevents for the marketing page.
    const dir = outDir();
    await buildLanding({ ...ENV, EAIT__BACKEND__LANDING_INDEXABLE: "true" }, dir);
    for (const [page, path] of [["privacy.html", "/privacy"], ["support.html", "/support"]]) {
      const doc = readFileSync(join(dir, page!), "utf8");
      expect(doc).toContain(`<link rel="canonical" href="https://eait.fit${path}">`);
      // The path the sitemap and the page's own footer link to — extensionless, as nginx serves it.
      expect(readFileSync(join(dir, "sitemap.xml"), "utf8")).toContain(`https://eait.fit${path}<`);
      // A description, because these two are indexable pages and a search result with none is a
      // snippet the engine writes for you out of the first sentence it finds.
      expect(doc).toMatch(/<meta name="description" content="[^"]{80,}">/);
    }
    rmSync(dir, { recursive: true, force: true });
  });

  test("the API host lets a crawler IN so it can read the noindex", () => {
    // The trap this is the regression test for. A bare `Disallow: /` on that host looks stricter
    // and is strictly worse: the crawler never fetches, so it never reads `X-Robots-Tag` or the
    // canonical, while the URL can still be indexed title-only from a link elsewhere — and App
    // Store Connect publishes exactly these two URLs, so that link exists. The `Allow:` lines
    // must precede the `Disallow:`, and the header must still be set on the pages they open up.
    const caddyfile = readFileSync(join(REPO_ROOT, "deploy/Caddyfile"), "utf8");
    expect(caddyfile).toContain("handle /robots.txt");
    const robots = caddyfile.slice(caddyfile.indexOf("handle /robots.txt"));
    const allowPrivacy = robots.indexOf("Allow: /privacy");
    const allowSupport = robots.indexOf("Allow: /support");
    const disallow = robots.indexOf("Disallow: /\n");
    expect(allowPrivacy).toBeGreaterThan(0);
    expect(allowSupport).toBeGreaterThan(0);
    expect(disallow).toBeGreaterThan(allowPrivacy);
    expect(disallow).toBeGreaterThan(allowSupport);
    expect(caddyfile).toContain('X-Robots-Tag "noindex"');
    // An exact-path matcher, never a prefix: a prefix answered 200 for `/privacyanything`, which
    // is unbounded duplicate URL space on a host that is now deliberately crawlable there.
    expect(caddyfile).toContain("@legal path /privacy /privacy.html /support /support.html");
    // Asserted on the DIRECTIVES rather than on the string, which also appears in prose above.
    const directives = caddyfile.split("\n").filter((line) => !line.trim().startsWith("#"));
    expect(directives.some((line) => /^\s*handle\s+\/(privacy|support)\*/.test(line))).toBe(false);
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

  test("five forms on one page do not share input ids", () => {
    // The id is derived from the placement rather than listed, so a sixth ask cannot be added
    // without one. Duplicate ids break the label-for pairing exactly where a screen reader needs it.
    for (const placement of Object.keys(START_CODES)) {
      expect(formHtml).toContain(`id="email-${placement}"`);
    }
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

describe("emphasis", () => {
  test("escapes before it marks up, so copy cannot smuggle a tag onto the page", () => {
    // The order is the whole safety property. Mark up first and a `<script>` in a content string
    // would survive into the document; escape first and the only tag this can ever emit is the one
    // it writes itself.
    expect(emphasis("a **strong** b")).toBe("a <strong>strong</strong> b");
    expect(emphasis("**<script>alert(1)</script>**")).toBe(
      "<strong>&lt;script&gt;alert(1)&lt;/script&gt;</strong>",
    );
    expect(emphasis("2 * 3 * 4")).toBe("2 * 3 * 4");
  });

  test("every marker in the copy resolves, and no marker reaches the page", () => {
    // A stray `**` is a typo that renders as two asterisks in the middle of a marketing sentence.
    expect(html).not.toContain("**");
    expect(html).toContain("<strong>");
  });

  test("no block carries more than one emphasised span", () => {
    // Two is none: the point is that a reader skimming can lift the load-bearing sentence out of
    // each block, and a block with half of it bold gives them nothing to lift.
    for (const [, inner] of html.matchAll(/<p class="(?:(?:fact|refusal|step|shot)-body|section-intro)">(.*?)<\/p>/gs)) {
      expect([...inner!.matchAll(/<strong>/g)].length).toBeLessThanOrEqual(1);
    }
  });
});

describe("the typeface", () => {
  test("is self-hosted, preloaded, and travels with its licence", () => {
    // The one deliberate CSP widening of the design pass: font-src 'self'. The font must exist,
    // the stylesheet may reference nothing but same-origin urls, and the OFL's licence text has to
    // ship beside the file — that is a term of the licence, not a courtesy.
    for (const name of ["space-grotesk-latin.woff2", "OFL.txt"]) {
      expect(existsSync(resolve(REPO_ROOT, "src/backend/landing/assets/fonts", name))).toBe(true);
    }
    expect(html).toContain('rel="preload" href="/assets/fonts/space-grotesk-latin.woff2"');
    for (const [, url] of styles.matchAll(/url\(["']?([^)"']+)["']?\)/g)) {
      expect(url!.startsWith("/")).toBe(true);
    }
  });
});

describe("the screenshots", () => {
  test("every shot named in the copy is a file that exists", () => {
    // The build throws on a missing one, but it throws at deploy time. This says so here.
    for (const shot of shots) {
      expect(existsSync(resolve(REPO_ROOT, "src/backend/landing/assets", shot.file))).toBe(true);
    }
  });

  test("each is same-origin, sized, lazy and described", () => {
    // Dimensions so the box is reserved before the bytes land and nothing below jumps; alt text
    // because these are the only images on the page carrying an argument.
    for (const shot of shots) {
      expect(html).toContain(`src="/assets/${shot.file}"`);
      expect(html).toContain(`width="${shot.width}" height="${shot.height}"`);
      expect(html).toContain(`alt="${shot.alt.replace(/"/g, "&quot;")}"`);
    }
    expect([...html.matchAll(/<img class="shot-img"/g)]).toHaveLength(shots.length);
    expect([...html.matchAll(/loading="lazy"/g)]).toHaveLength(shots.length);
  });

  test("every shot is the frame that was audited, byte for byte", () => {
    // THE ASSET IS A COPY, AND A COPY OF A FILE THAT IS REGULARLY RESHOT. `03` and `05` were
    // reshot with new in-app copy while `app-chat.webp` and `app-plan.webp` were left alone, so the
    // page published "You see your plan before anything is asked" while the app and the App Store
    // listing said something else about when you pay. The old test asserted the source EXISTED,
    // which that passes.
    //
    // It is also what forces a re-audit. The bar below, the figures in `body` and `alt`, and the
    // dates recorded in `scripts/store-frames.ts` are all statements about specific pixels; a
    // reshoot replaces them and nothing else in this suite can tell.
    for (const shot of shots) {
      const file = resolve(REPO_ROOT, "docs/screenshots", shot.source);
      expect(existsSync(file)).toBe(true);
      const actual = createHash("sha256").update(readFileSync(file)).digest("hex");
      if (actual !== shot.sourceSha256) {
        throw new Error(
          `docs/screenshots/${shot.source} is not the frame ${shot.file} was audited against.\n` +
            `  audited ${shot.sourceSha256}\n  on disk  ${actual}\n` +
            "If it was reshot: look at the new frame, check it carries no demo disclaimer and that\n" +
            "the numbers in its title/body/alt still match the card, then regenerate the asset\n" +
            "(src/backend/landing/README.md has the one command) and paste the new hash into\n" +
            "content.ts in the same commit.",
        );
      }
    }
  });

  test("the shot grid is not pinned to a number of shots", () => {
    // `.shots` was `repeat(3, 1fr)` and the array grew to four, which put the diary frame alone on
    // a second row in the left third of the page, under a headline that says "in four screens".
    // The count test below binds the headline to the array; nothing bound the layout, so it is
    // written to take whatever the array holds.
    // AGAINST THE `.shots` RULE ITSELF. `expect(styles).toContain("repeat(auto-fit")` was true of a
    // stylesheet holding eight other grid rules, so `.shots` could go back to a fixed column count
    // with any one of them supplying the substring.
    const rule = styles.match(/\.shots \{ grid-template-columns: ([^}]+); \}/);
    expect(rule).not.toBeNull();
    expect(rule![1]).toMatch(/^repeat\(auto-fit, minmax\(\d+(\.\d+)?rem, 1fr\)\)$/);
  });

  test("none of the analyzer frames is on the page", () => {
    // `docs/screenshots/07`–`08` carry "Demo analyzer — these numbers are canned" in shot.
    // docs/RELEASE.md says otherwise; the committed pixels are what this trusts. `06` was in this
    // bar until 2026-09-06, when it was reshot against the production analyzer and stopped
    // carrying the line — which is the only thing that lifts the bar on one of these.
    //
    // CHECKED AGAINST THE SOURCE FRAME, not the asset name. `app-chat.webp` cannot begin with a
    // digit, so the version of this that read `s.file` could not fail whatever was put behind it —
    // it would have passed a page carrying all three barred frames. Resolving the source on disk is
    // also what stops the bar being answered with a name nothing produced.
    for (const shot of shots) {
      expect(existsSync(resolve(REPO_ROOT, "docs/screenshots", shot.source))).toBe(true);
      expect(shot.source).not.toMatch(/^0[78]-/);
    }
  });
});

describe("counts typed in headlines", () => {
  test("the spelled-out counts match the arrays they describe", () => {
    // "Four figures…" and "…in four screens." are numbers in public copy, and the rule is that
    // such a number is read from the code that produces it. The words cannot be, so this binds
    // them: add a shot or a figure and the headline goes red here instead of lying on the page.
    const words = ["zero", "one", "two", "three", "four", "five", "six"] as const;
    expect(figuresSection.headline.toLowerCase()).toContain(words[figures.length]!);
    expect(screensSection.headline.toLowerCase()).toContain(words[shots.length]!);
  });
});

describe("the numbers set large", () => {
  test("every figure is read from the code that produces it", () => {
    // The repo's rule, and a band of large numbers is the worst place to break it. A figure typed
    // by hand here is a public claim with nothing holding it to the product.
    const values = figures.map((f) => f.value);
    expect(values).toContain(KCAL_FLOOR.female.toLocaleString("en-GB"));
    // The men's floor is in the label rather than the figure, and it is still read from the code.
    expect(figures.map((f) => f.label).join(" ")).toContain(KCAL_FLOOR.male.toLocaleString("en-GB"));
    expect(values).toContain(`${Math.round(MAX_DEFICIT_SHARE * 100)}%`);
    expect(values).toContain(`${measured.medianErrorPct}%`);
    expect(figures.find((f) => f.value === `${measured.medianErrorPct}%`)!.unit)
      .toContain(String(measured.dishes));
    for (const figure of figures) expect(html).toContain(figure.value);
  });
});

describe("the hero says what the verdict is", () => {
  test("the kcal it says are left is the target minus the meal", () => {
    // The card promised photo → numbers → verdict and ended on three coloured chips. The sentence
    // that fixes that quotes arithmetic, in the hero, which is the worst possible place for a
    // stale number — so it is computed here rather than read.
    const left = sample.target.kcal - sample.meal.kcal;
    expect(sample.meal.verdict).toContain(left.toLocaleString("en-GB"));
    expect(html).toContain(`<p class="mcard-verdict">${sample.meal.verdict}</p>`);
  });

  test("the hero's Calories pill is the verdict the engine would compute", () => {
    // The hero card TYPES its three verdicts, which is the one place in this product a verdict is
    // not derived — and the sentence under them summarises what they say. That is how the summary
    // came to read "Fits your day" beside a Calories pill reading `warn`. Reconciling the typed
    // pill against `WARN_SHARE`/`BAD_SHARE` is what stops the marketing page showing a judgement
    // the engine would never produce.
    const share = sample.meal.kcal / sample.target.kcal;
    const computed = share > BAD_SHARE ? "bad" : share > WARN_SHARE ? "warn" : "good";
    expect(sample.meal.verdicts.find((v) => v.label === "Calories")!.verdict).toBe(computed as never);
    // And the summary says so in words. `warn` on calories means the meal took more than
    // WARN_SHARE of the day, which is the fact the sentence states.
    expect(WARN_SHARE).toBe(1 / 3);
    expect(sample.meal.verdict).toContain("third");
  });

  test("a screen reader gets the sentence too, not just the chips", () => {
    const label = html.match(/class="device" role="img" aria-label="([^"]+)"/)![1]!;
    expect(label).toContain(esc(sample.meal.verdict));
  });
});

describe("the repeated ask", () => {
  const botOnly = renderLanding(
    loadLandingConfig({
      EAIT__BACKEND__LANDING_SITE_URL: ENV.EAIT__BACKEND__LANDING_SITE_URL,
      EAIT__BACKEND__LANDING_TELEGRAM_URL: ENV.EAIT__BACKEND__LANDING_TELEGRAM_URL,
    }),
  );
  // No store URL: the store wins whenever it exists, and this fixture is the build eait.fit
  // actually runs — the form is the primary action while the listing does not exist.
  const withApi = renderLanding(
    loadLandingConfig({
      EAIT__BACKEND__LANDING_SITE_URL: ENV.EAIT__BACKEND__LANDING_SITE_URL,
      EAIT__BACKEND__LANDING_API_URL: "https://api.eait.fit",
    }),
  );

  test("there are three bands, between the blocks that do the convincing", () => {
    expect([...html.matchAll(/<aside class="ask">/g)]).toHaveLength(3);
  });

  test("the band says what it is actually asking for", () => {
    // The form line beside a button that opens Telegram would be the page describing an ask its own
    // button does not make — which is the exact failure `surfaceNote` exists to prevent elsewhere.
    expect(withApi).toContain(subscribeSection.bandLine.form);
    expect(withApi).not.toContain(subscribeSection.bandLine.action);
    expect(botOnly).toContain(subscribeSection.bandLine.action);
    expect(botOnly).not.toContain(subscribeSection.bandLine.form);
  });
});
