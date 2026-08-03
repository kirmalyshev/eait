// What the landing page cannot know about itself.
//
// Everything here differs between a laptop, staging and production — the canonical origin, whether
// the App Store listing exists yet, which bot the secondary action points at. Per the repo rule,
// that makes each one an environment variable rather than a constant, and this file is the single
// place they are read and checked.
//
// The checks are the point. `scripts/preflight-release.ts` refuses a mobile build that cannot work;
// this refuses a landing build that cannot work, for the same reason — a page that ships with a
// dead primary button looks fine to every other check we have and is broken for every visitor.

/** Where the built page will actually live, and what it links to. */
export interface LandingConfig {
  /** Canonical origin, no trailing slash. Used for `<link rel=canonical>` and og:url. */
  siteUrl: string;
  /** The App Store listing. Absent until the app is actually published — see `primaryCta`. */
  appStoreUrl: string | null;
  /** The Telegram bot. The zero-install surface; carries the CTA while the listing does not exist. */
  telegramUrl: string | null;
  /** Where support mail goes. Rendered as a mailto:, never as a raw string anywhere else. */
  supportEmail: string;
  /**
   * The date the copy was last reviewed, `YYYY-MM-DD`. NOT the build date: a page rebuilt by a
   * deploy that changed nothing must not claim its wording was reviewed that morning, and a
   * build-stamped date makes the output non-reproducible for no benefit.
   */
  updatedAt: string;
  /**
   * Whether search engines may index this build. **Defaults to false**, and the default is the
   * whole point.
   *
   * Staging serves the same page on a real, publicly resolvable, certificate-bearing name. Left
   * alone it gets crawled — and then the product has two indexed copies of its own landing page,
   * one of them on a hostname made of an IP address, competing with the domain it is trying to
   * rank. Undoing that costs weeks and a `noindex` nobody can force a crawler to re-read promptly.
   *
   * So indexing is opt-in per environment rather than something a staging box has to remember to
   * switch off. Production sets it; nothing else does.
   */
  indexable: boolean;
}

export class LandingConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LandingConfigError";
  }
}

const APP_STORE_HOST = "apps.apple.com";
const TELEGRAM_HOSTS = ["t.me", "telegram.me"];

function requireUrl(name: string, raw: string, opts: { hosts?: string[] } = {}): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new LandingConfigError(`${name} is not a URL: ${raw}`);
  }
  // http is allowed only for a local preview. Anything reachable by a stranger is https, because a
  // page served over http is a page an ISP can rewrite, and this one exists to be trusted.
  const localhost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && localhost)) {
    throw new LandingConfigError(`${name} must be https (got ${url.protocol}//${url.host})`);
  }
  if (opts.hosts && !opts.hosts.includes(url.hostname)) {
    throw new LandingConfigError(
      `${name} must point at ${opts.hosts.join(" or ")} (got ${url.hostname})`,
    );
  }
  return url.toString().replace(/\/$/, "");
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Reads the config from an environment.
 *
 * Takes the environment as an argument rather than reaching for `process.env`, so a test can prove
 * the refusals without mutating the process it runs in.
 */
export function loadLandingConfig(env: Record<string, string | undefined>): LandingConfig {
  const siteRaw = env.LANDING_SITE_URL?.trim();
  if (!siteRaw) {
    throw new LandingConfigError(
      "LANDING_SITE_URL is not set. There is no default: a canonical URL guessed wrong is worse " +
        "than one missing, because it is silently wrong in every search result and share card.",
    );
  }
  const siteUrl = requireUrl("LANDING_SITE_URL", siteRaw);

  const storeRaw = env.LANDING_APP_STORE_URL?.trim();
  const appStoreUrl = storeRaw
    ? requireUrl("LANDING_APP_STORE_URL", storeRaw, { hosts: [APP_STORE_HOST] })
    : null;

  const telegramRaw = env.LANDING_TELEGRAM_URL?.trim();
  const telegramUrl = telegramRaw
    ? requireUrl("LANDING_TELEGRAM_URL", telegramRaw, { hosts: TELEGRAM_HOSTS })
    : null;

  // The whole job of this page is one tap. Without a destination for it there is nothing to build.
  if (!appStoreUrl && !telegramUrl) {
    throw new LandingConfigError(
      "Neither LANDING_APP_STORE_URL nor LANDING_TELEGRAM_URL is set, so the page would render " +
        "with no working call to action. Set at least one.",
    );
  }

  const supportEmail = env.LANDING_SUPPORT_EMAIL?.trim() || "lets@eait.fit";
  if (!supportEmail.includes("@")) {
    throw new LandingConfigError(`LANDING_SUPPORT_EMAIL is not an address: ${supportEmail}`);
  }

  const updatedAt = env.LANDING_UPDATED?.trim() || DEFAULT_UPDATED_AT;
  if (!DATE_RE.test(updatedAt)) {
    throw new LandingConfigError(`LANDING_UPDATED must be YYYY-MM-DD (got ${updatedAt})`);
  }

  // Only the exact string "true" opts in. Not "1", not "yes", not a typo that happens to be
  // non-empty — the failure this guards against is a staging box quietly becoming indexable
  // because a variable was set to something truthy-looking, and that failure is discovered by
  // finding the staging hostname in a search result.
  const indexable = env.LANDING_INDEXABLE?.trim().toLowerCase() === "true";

  return { siteUrl, appStoreUrl, telegramUrl, supportEmail, updatedAt, indexable };
}

/** Bumped by hand when the copy changes. See `LandingConfig.updatedAt` for why it is not a clock. */
export const DEFAULT_UPDATED_AT = "2026-08-02";

/**
 * Which button gets the accent.
 *
 * The app's own rule is that the accent colour marks exactly one thing per screen — the primary
 * action (`src/mobile/lib/theme.ts`). The page keeps that rule, so it needs to know which of the two
 * destinations is primary. The App Store wins whenever it exists; before then the bot is not a
 * consolation link, it is the only thing a visitor can actually do.
 */
export function primaryCta(config: LandingConfig): { href: string; label: string; note: string } {
  if (config.appStoreUrl) {
    return {
      href: config.appStoreUrl,
      label: "Get eait for iPhone",
      note: "No card. No trial. Photos are deleted once they have been read.",
    };
  }
  return {
    href: config.telegramUrl!,
    label: "Open the Telegram bot",
    note: "Nothing to install. Send a photo to a chat and read the answer.",
  };
}

/** The other one, if there is another one. */
export function secondaryCta(config: LandingConfig): { href: string; label: string } | null {
  if (config.appStoreUrl && config.telegramUrl) {
    return { href: config.telegramUrl, label: "or try it in Telegram first" };
  }
  return null;
}
