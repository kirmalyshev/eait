// Renders the landing page to a directory nginx can serve.
//
//   EAIT__BACKEND__LANDING_SITE_URL=https://eait.fit \
//   EAIT__BACKEND__LANDING_TELEGRAM_URL=https://t.me/eait_bot \
//   bun src/backend/landing/build.ts --out .build/landing
//
// Order matters and is the whole design of this file: config is validated, the page is rendered,
// the RENDERED TEXT is put through the claims gate, and only then is anything written. A build that
// fails leaves the previous output untouched rather than half-replacing it, so a deploy that races
// a failing build serves the last good page instead of a broken one.
//
// The two static pages App Store Connect requires — `deploy/public/privacy.html` and
// `support.html` — are copied in beside the index rather than re-authored, so the landing host and
// the API host serve the same words. Two copies of a privacy policy diverge, and the one that
// diverges silently is the one nobody is reading. The one thing added on the way through is a
// canonical URL, which is the one fact a file served from two hostnames cannot state itself —
// `canonicalised()`.

import { mkdir, copyFile, readFile, stat, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { assertClean, copyFromHtml } from "./claims.ts";
import { loadLandingConfig, surfaceNote, type LandingConfig } from "./config.ts";
import {
  accuracySection, brand, faqs, forSection, hero, measured, refusals, shots, steps,
} from "./content.ts";
import { faviconIco, markPng, ogPng } from "./images.ts";
import { iconSvg, outcomePages, renderLanding } from "./render.ts";
import { styles } from "./styles.ts";
import { themeScript } from "./theme-script.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
/** Repository root: src/backend/landing → src/backend → src → root. */
const REPO_ROOT = resolve(HERE, "../../..");

/** Pages that exist once and are served from wherever they are needed. */
const SHARED_PAGES = ["privacy.html", "support.html"] as const;

export interface BuildResult {
  outDir: string;
  files: string[];
  bytes: number;
}

export async function buildLanding(
  env: Record<string, string | undefined>,
  outDir: string,
): Promise<BuildResult> {
  const config = loadLandingConfig(env);
  const html = renderLanding(config);

  // The gate runs on what a reader sees, not on the source strings — see `copyFromHtml`.
  assertClean(copyFromHtml(html));

  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const files: string[] = [];
  let bytes = 0;

  const write = async (name: string, contents: string) => {
    await writeFile(join(outDir, name), contents, "utf8");
    files.push(name);
    bytes += Buffer.byteLength(contents, "utf8");
  };

  const writeBinary = async (name: string, contents: Uint8Array) => {
    await writeFile(join(outDir, name), contents);
    files.push(name);
    bytes += contents.length;
  };

  await write("index.html", html);
  await write("styles.css", styles);
  await write("theme.js", themeScript);
  await write("robots.txt", robots(config));

  // The three pages the subscribe form's redirects land on. Built whenever the form is — a form
  // that posts to a redirect target that 404s is worse than no form.
  if (config.apiUrl) {
    for (const [name, page] of Object.entries(outcomePages(config))) {
      assertClean(copyFromHtml(page));
      await write(name, page);
    }
  }

  // Drawn, not exported from a design file — see images.ts. `apple-touch-icon` is 180 because that
  // is what iOS asks for; anything else is resampled by the phone.
  await write("icon.svg", iconSvg());
  await writeBinary("favicon.ico", faviconIco());
  await writeBinary("apple-touch-icon.png", markPng(180));
  await writeBinary("og.png", ogPng());

  // The screenshots, copied rather than generated: they are `docs/screenshots/` resized once and
  // committed under `assets/`, so the page and the App Store listing show the same frames.
  //
  // LOUD WHEN ONE IS MISSING, like the shared pages below. An `<img>` whose file was never written
  // is a broken frame in the middle of the section that exists to prove the app is real, and it
  // fails at exactly the moment nobody is looking — a deploy — rather than here.
  await mkdir(join(outDir, "assets"), { recursive: true });
  for (const shot of shots) {
    const source = join(HERE, "assets", shot.file);
    if (!existsSync(source)) {
      throw new Error(
        `src/backend/landing/assets/${shot.file} is missing, and the page renders an <img> for it.`,
      );
    }
    await copyFile(source, join(outDir, "assets", shot.file));
    files.push(`assets/${shot.file}`);
    bytes += (await stat(source)).size;
  }

  // The one typeface, and its licence — the OFL requires the licence text to travel with the font.
  await mkdir(join(outDir, "assets/fonts"), { recursive: true });
  for (const name of ["space-grotesk-latin.woff2", "OFL.txt"] as const) {
    const source = join(HERE, "assets/fonts", name);
    if (!existsSync(source)) throw new Error(`src/backend/landing/assets/fonts/${name} is missing.`);
    await copyFile(source, join(outDir, "assets/fonts", name));
    files.push(`assets/fonts/${name}`);
    bytes += (await stat(source)).size;
  }

  // A sitemap for a build nobody may index would be an invitation contradicting the two refusals
  // beside it. Emitted only when the build is the one that should be found.
  if (config.indexable) await write("sitemap.xml", sitemap(config));

  // The IndexNow key file, under the same opt-in and for a stronger reason than the sitemap's: the
  // file at this path is what PROVES the key belongs to whoever submits it, so a non-canonical host
  // publishing one could push URLs on this domain's behalf. Written HERE rather than placed by hand
  // because `rm(outDir)` above deletes anything a person put in the directory.
  if (config.indexable && config.indexNowKey) {
    await write(`${config.indexNowKey}.txt`, config.indexNowKey);
  }

  // llms.txt, under the same opt-in as the sitemap and the same claims gate as the page: it is
  // public copy, and copy for machines is quoted back to people verbatim.
  //
  // IT IS A HEDGE, NOT A CHANNEL, and nothing downstream should be planned as though it were.
  // Google has said plainly that no Search system reads or acts on it, and as of early 2026 no
  // major lab has committed to acting on it in production either; crawlers have been observed
  // fetching it occasionally, which is not the same as it changing an answer. It costs one
  // generated file assembled from constants that already exist, it is genuinely read by developer
  // tooling pointed at a domain, and it is free to be right early. That is the whole case.
  if (config.indexable) {
    const text = llmsTxt(config);
    assertClean({ "llms.txt": text });
    await write("llms.txt", text);
  }

  for (const page of SHARED_PAGES) {
    const source = join(REPO_ROOT, "deploy/public", page);
    if (!existsSync(source)) {
      // Loud rather than silent. A landing page whose Privacy link 404s is an App Store rejection
      // and, more to the point, a page making promises with a broken link to the document that
      // states them.
      throw new Error(
        `deploy/public/${page} is missing. The landing serves the same file the API host does; ` +
          `it is not optional and there is no fallback copy.`,
      );
    }
    await write(page, canonicalised(await readFile(source, "utf8"), config, page));
  }

  return { outDir, files, bytes };
}

/**
 * The two shared pages, given the one thing a file served from two hostnames cannot carry: which
 * of them is the address of record.
 *
 * `deploy/public/privacy.html` and `support.html` are served BOTH here and, by Caddy, on the API
 * domain — App Store Connect requires the URLs and there must be exactly one copy of the bytes
 * (`docs/RELEASE.md`). Two hostnames serving identical documents is a duplicate the domain has to
 * compete with, which is the failure `LandingConfig.indexable` exists to prevent for the landing
 * page itself; a canonical is that same fix for these two. It is INJECTED rather than written into
 * the file because the origin is configuration — a canonical guessed wrong is silently wrong in
 * every search result, so the source file states no origin at all and the build states the one it
 * was given.
 *
 * The API host's copies are additionally answered with `X-Robots-Tag: noindex` (deploy/Caddyfile),
 * because a crawler that never indexes them never has to be told which one wins.
 */
function canonicalised(html: string, config: LandingConfig, page: string): string {
  if (!html.includes("</head>")) {
    throw new Error(`deploy/public/${page} has no </head>, so the canonical URL cannot be added.`);
  }
  const path = `/${page.replace(/\.html$/, "")}`;
  return html.replace("</head>", `<link rel="canonical" href="${config.siteUrl}${path}">\n</head>`);
}

/**
 * `robots.txt`, and it says the opposite thing everywhere but production.
 *
 * A second host serves this page on a real, publicly resolvable name with a real certificate. Left to the
 * default it gets crawled, and the product then has two indexed copies of its own landing page
 * competing with each other — one of them on a hostname made of an IP address. `Disallow: /` is the
 * default for that reason, and production is the environment that opts in.
 */
function robots(config: LandingConfig): string {
  if (!config.indexable) {
    return "# Not the canonical deployment of this page. See EAIT__BACKEND__LANDING_INDEXABLE.\nUser-agent: *\nDisallow: /\n";
  }
  // The answer engines are named, and it is NOT decoration. robots.txt group matching is
  // exclusive: a crawler obeys the most specific `User-agent` group that names it and IGNORES the
  // `*` group entirely (RFC 9309 §2.2.1). So while `Allow: /` under `*` permits all of these
  // today, a later `Disallow:` added to `*` — a template, a WAF's "block AI bots" toggle, a path
  // somebody wants out of search — would silently take them with it. These groups are what make
  // that a deliberate act rather than a side effect. Safe to keep exclusive because the whole site
  // is three public URLs and there is nothing here to hide from a reader.
  //
  // `Google-Extended` and `Applebot-Extended` are opt-OUT tokens rather than crawlers: absence
  // already means allowed. They are listed anyway, so that the decision has one home.
  const answerEngines = [
    "GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "Claude-User",
    "PerplexityBot", "Perplexity-User", "Google-Extended", "Applebot-Extended", "CCBot",
    "meta-externalagent",
  ];
  // BINGBOT IS DELIBERATELY NOT IN THAT LIST, and it was for one commit. The exclusivity that
  // protects the answer engines is the same exclusivity that would exempt a general search
  // crawler from a `Disallow:` added to `*` later, and Bing is the one name here with real index
  // volume behind it — the worst possible place to lose a rule silently. It reads the `*` group,
  // where `Allow: /` already covers it.
  const groups = ["User-agent: *", "Allow: /", ""];
  for (const bot of answerEngines) groups.push(`User-agent: ${bot}`, "Allow: /", "");
  return `${groups.join("\n")}\nSitemap: ${config.siteUrl}/sitemap.xml\n`;
}

/**
 * `llms.txt` — the page's facts in the shape an answer engine ingests (llmstxt.org: an H1, a
 * one-line summary, then linked sections).
 *
 * Assembled from the SAME constants the page renders, never re-written here: a second authoring of
 * the floor or the measured numbers is a second thing that can drift, and this file is the one a
 * model quotes verbatim to somebody who never opens the page.
 */
function llmsTxt(config: LandingConfig): string {
  const availability = surfaceNote(config);
  const lines: string[] = [
    `# ${brand.name}`,
    "",
    `> ${brand.tagline} ${hero.headline} Your first analysis needs no card, and a photo stays with the meal it logged.`,
    "",
    hero.sub,
    "",
    hero.audience,
    "",
    // The one fact a model gets wrong for free. Everything below describes an iPhone app; while
    // that app is unreleased, an answer engine reading only the sections would tell somebody to go
    // and install it. `surfaceNote` is the same sentence the page prints for the same reason, and
    // it returns null on the day the listing exists.
    ...(availability ? ["## Availability", "", availability, ""] : []),
    "## Who it is for",
    "",
    ...forSection.rows.map((r) => `- ${r.title} ${r.body}`),
    "",
    "## How it works",
    "",
    ...steps.map((s) => `- ${s.title} ${s.body}`),
    "",
    "## What it will not do",
    "",
    ...refusals.map((r) => `- ${r.title} ${r.body}`),
    "",
    "## Measured accuracy",
    "",
    accuracySection.proof.body,
    "",
    `Sample: ${measured.dishes} reference dishes with weighed ingredients; median error about ` +
      `${measured.medianErrorPct}%; mean signed error +${measured.meanSignedErrorPct}%.`,
    "",
    "## Questions",
    "",
    ...faqs.map((f) => `- ${f.q} ${f.a}`),
    "",
    "## Pages",
    "",
    `- [Home](${config.siteUrl}/): what ${brand.name} does, and what it refuses to do`,
    `- [Privacy](${config.siteUrl}/privacy): the privacy policy`,
    `- [Support](${config.siteUrl}/support): support and contact`,
  ];
  if (config.telegramUrl) {
    lines.push(`- [Telegram bot](${config.telegramUrl}): usable today, nothing to install`);
  }
  if (config.appStoreUrl) {
    lines.push(`- [iPhone app](${config.appStoreUrl}): on the App Store`);
  }
  // Recency is a ranking input for answer engines, and this is the honest date: when the copy was
  // last reviewed, not when the container was last rebuilt. Same value as the sitemap's `lastmod`.
  lines.push("", `Last reviewed: ${config.updatedAt}`, "");
  return lines.join("\n");
}

/**
 * Three URLs, because there are three pages. `lastmod` is the copy-review date rather than the
 * build clock, for the reason given on `LandingConfig.updatedAt`: a nightly redeploy that changed
 * nothing must not tell a crawler the page is new every morning.
 */
function sitemap(config: { siteUrl: string; updatedAt: string }): string {
  const url = (path: string) =>
    `  <url><loc>${config.siteUrl}${path}</loc><lastmod>${config.updatedAt}</lastmod></url>`;
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    url("/"),
    url("/privacy"),
    url("/support"),
    "</urlset>",
    "",
  ].join("\n");
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const outFlag = args.indexOf("--out");
  const outDir = resolve(
    REPO_ROOT,
    outFlag >= 0 && args[outFlag + 1] ? args[outFlag + 1]! : ".build/landing",
  );

  try {
    const result = await buildLanding(process.env, outDir);
    console.log(
      `landing → ${result.outDir}\n  ${result.files.join(", ")}\n  ${result.bytes} bytes rendered`,
    );
  } catch (error) {
    // The message carries the whole diagnosis for both failure classes — a config that cannot work
    // and copy that must not ship — so a stack trace would only bury it.
    console.error(`landing build failed:\n${(error as Error).message}`);
    process.exit(1);
  }
}
