// Renders the landing page to a directory nginx can serve.
//
//   LANDING_SITE_URL=https://eait.fit \
//   LANDING_TELEGRAM_URL=https://t.me/eait_bot \
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
import { loadLandingConfig } from "./config.ts";
import { iconSvg, renderLanding } from "./render.ts";
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

  await write("index.html", html);
  await write("styles.css", styles);
  await write("icon.svg", iconSvg());
  await write("robots.txt", robots(config.siteUrl));
  await write("sitemap.xml", sitemap(config));

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

function robots(siteUrl: string): string {
  return `User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`;
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
