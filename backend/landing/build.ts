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
// the API host serve the same bytes. Two copies of a privacy policy diverge, and the one that
// diverges silently is the one nobody is reading.

import { mkdir, copyFile, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { assertClean, copyFromHtml } from "./claims.ts";
import { loadLandingConfig, type LandingConfig } from "./config.ts";
import {
  accuracySection, brand, faqs, forSection, hero, measured, refusals, steps,
} from "./content.ts";
import { faviconIco, markPng, ogPng } from "./images.ts";
import { iconSvg, outcomePages, renderLanding } from "./render.ts";
import { styles } from "./styles.ts";

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

  // A sitemap for a build nobody may index would be an invitation contradicting the two refusals
  // beside it. Emitted only when the build is the one that should be found.
  if (config.indexable) await write("sitemap.xml", sitemap(config));

  // llms.txt for answer engines, under the same opt-in as the sitemap and the same claims gate as
  // the page — it is public copy, and copy for machines is quoted back to people verbatim.
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
    await copyFile(source, join(outDir, page));
    files.push(page);
  }

  return { outDir, files, bytes };
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
  return `User-agent: *\nAllow: /\nSitemap: ${config.siteUrl}/sitemap.xml\n`;
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
  const lines: string[] = [
    `# ${brand.name}`,
    "",
    `> ${brand.tagline} ${hero.headline} No card, no trial, and photos are never stored.`,
    "",
    hero.sub,
    "",
    hero.audience,
    "",
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
  lines.push("");
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
