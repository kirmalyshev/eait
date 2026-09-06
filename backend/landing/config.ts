// What the landing page cannot know about itself.
//
// Everything here differs between a laptop, a preview container and production — the canonical origin, whether
// the App Store listing exists yet, which bot the secondary action points at. Per the repo rule,
// that makes each one an environment variable rather than a constant, and this file is the single
// place they are read and checked.
//
// The checks are the point. `scripts/preflight-release.ts` refuses a mobile build that cannot work;
// this refuses a landing build that cannot work, for the same reason — a page that ships with a
// dead primary button looks fine to every other check we have and is broken for every visitor.

/** Where the built page will actually live, and what it links to. */
import { FREE_ANALYSES } from "@eait/shared";

export interface LandingConfig {
  /** Canonical origin, no trailing slash. Used for `<link rel=canonical>` and og:url. */
  siteUrl: string;
  /** The App Store listing. Absent until the app is actually published — see `primaryCta`. */
  appStoreUrl: string | null;
  /** The Telegram bot. The zero-install surface; carries the CTA while the listing does not exist. */
  telegramUrl: string | null;
  /**
   * Where somebody can onboard without installing anything — the backend's `/start`.
   *
   * Absent means this page says nothing about it, which is the correct rendering of a backend that
   * has no Google web client configured: the surface answers 404 there, and a page linking to a 404
   * is worse than a page with one fewer option.
   */
  startUrl: string | null;
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
   * A second host serves the same page on a real, publicly resolvable, certificate-bearing name. Left
   * alone it gets crawled — and then the product has two indexed copies of its own landing page,
   * one of them on a hostname made of an IP address, competing with the domain it is trying to
   * rank. Undoing that costs weeks and a `noindex` nobody can force a crawler to re-read promptly.
   *
   * So indexing is opt-in per environment rather than something a second box has to remember to
   * switch off. Production sets it; nothing else does.
   */
  indexable: boolean;
  /**
   * The IndexNow key, or null. Absent means no key file and no submission.
   *
   * IndexNow is a push: instead of waiting to be crawled, the deploy tells the engines which URLs
   * changed. Bing, Yandex, Naver and Seznam act on it; **Google does not and has said so**, so this
   * buys nothing on the engine that matters most and is worth having anyway — a domain with no
   * authority is crawled by Bing rarely enough that "rarely" and "never" are hard to tell apart.
   *
   * A key, not a secret. It is published at `/<key>.txt` on this very origin, which is the whole
   * verification mechanism: only somebody who can write to the site can prove the key is theirs.
   */
  indexNowKey: string | null;
  /**
   * The API origin the subscribe form posts to. Absent means the page renders no form at all.
   *
   * Separate from everything else here because it is the one value that makes the page do
   * something rather than say something — and a form whose action is wrong fails silently, in the
   * one place a visitor has already decided to give you their address.
   */
  apiUrl: string | null;
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
/**
 * The sample size THIS instance serves, validated. Called by `loadLandingConfig`, so a bad value
 * fails the build the same one-line way every other check in this file does.
 *
 * The copy quoted a compile-time constant while the server enforces `config.freeAnalyses`, read
 * from `EAIT__BACKEND__FREE_ANALYSES` — the documented knob `.env.prod.example` carries and
 * `e2e-paywall.sh` pins to 1. Set it to 1 on a host that also serves this page and the same origin
 * promised fifteen analyses while refusing the second, past the claims gate. AGENTS.md: "A limit the
 * server enforces is SENT to the client, never compiled into both."
 *
 * The page is a BUILD ARTIFACT, so "sent" means the build is given the value: the compose service
 * passes it as a build arg and `Dockerfile.landing` puts it in the environment this reads. Unset —
 * a laptop, a test — is the shipped default, which is what an unconfigured server would also serve.
 *
 * A value that is not a positive integer FAILS THE BUILD, like every other check in this file: a
 * page quoting NaN is worse than one that did not build.
 */
export function sampleAnalyses(env: Record<string, string | undefined> = process.env): number {
  const raw = env.EAIT__BACKEND__FREE_ANALYSES?.trim();
  if (!raw) return FREE_ANALYSES;
  const n = Number(raw);
  // `< 1`, NOT `< 0`. Zero is a legitimate BACKEND value — `int()` accepts it and it means an
  // instance that hands out no free analyses at all — but there is no honest way to write this
  // page for it: every sentence promises a visitor something, and "The first 0 answers are yours"
  // rendered in the refusal copy, both FAQs and the Google snippet. A host that wants no sample
  // does not want this page.
  if (!Number.isInteger(n) || n < 1) {
    throw new LandingConfigError(
      `EAIT__BACKEND__FREE_ANALYSES is "${raw}", which is not a number of analyses this page can `
        + "promise anybody. It quotes the value as what a visitor gets before the app asks for money.",
    );
  }
  return n;
}

/**
 * The same value, never throwing — for the module-level constant the copy is written against.
 *
 * `content.ts` reads this while it is being IMPORTED, which is before `build.ts` has entered the
 * try/catch that turns a `LandingConfigError` into one line an operator can act on. A throw there
 * escaped as a raw stack trace ending inside a copy file. So the validation lives in
 * `sampleAnalyses` above, which `loadLandingConfig` calls from inside that try, and this one falls
 * back rather than exploding: whenever the build proceeds, the two have read the same variable and
 * agree.
 */
export function configuredSample(env: Record<string, string | undefined> = process.env): number {
  try {
    return sampleAnalyses(env);
  } catch {
    return FREE_ANALYSES;
  }
}

export function loadLandingConfig(env: Record<string, string | undefined>): LandingConfig {
  const siteRaw = env.EAIT__BACKEND__LANDING_SITE_URL?.trim();
  if (!siteRaw) {
    throw new LandingConfigError(
      "EAIT__BACKEND__LANDING_SITE_URL is not set. There is no default: a canonical URL guessed wrong is worse " +
        "than one missing, because it is silently wrong in every search result and share card.",
    );
  }
  const siteUrl = requireUrl("EAIT__BACKEND__LANDING_SITE_URL", siteRaw);

  const storeRaw = env.EAIT__BACKEND__LANDING_APP_STORE_URL?.trim();
  const appStoreUrl = storeRaw
    ? requireUrl("EAIT__BACKEND__LANDING_APP_STORE_URL", storeRaw, { hosts: [APP_STORE_HOST] })
    : null;

  const telegramRaw = env.EAIT__BACKEND__LANDING_TELEGRAM_URL?.trim();
  const telegramUrl = telegramRaw
    ? requireUrl("EAIT__BACKEND__LANDING_TELEGRAM_URL", telegramRaw, { hosts: TELEGRAM_HOSTS })
    : null;

  // Any host, unlike the two above: this one points at our own API, whose hostname differs per
  // environment and is not a fixed third party we can name a list of.
  const startRaw = env.EAIT__BACKEND__LANDING_START_URL?.trim();
  const startUrl = startRaw ? requireUrl("EAIT__BACKEND__LANDING_START_URL", startRaw) : null;

  // No API, no form. Rendering one that posts nowhere would be worse than not asking: it collects
  // an address, loses it, and shows an error to somebody who had already agreed.
  const apiRaw = env.EAIT__BACKEND__LANDING_API_URL?.trim();
  const apiUrl = apiRaw ? requireUrl("EAIT__BACKEND__LANDING_API_URL", apiRaw) : null;

  // The whole job of this page is one tap. Without a destination for it there is nothing to build.
  // The subscribe form counts: while nothing is released, leaving an address IS the product action.
  if (!appStoreUrl && !telegramUrl && !apiUrl) {
    throw new LandingConfigError(
      "None of EAIT__BACKEND__LANDING_APP_STORE_URL, EAIT__BACKEND__LANDING_API_URL or EAIT__BACKEND__LANDING_TELEGRAM_URL is set, so the page " +
        "would render with no working call to action. Set at least one.",
    );
  }

  const supportEmail = env.EAIT__BACKEND__LANDING_SUPPORT_EMAIL?.trim() || "lets@eait.fit";
  if (!supportEmail.includes("@")) {
    throw new LandingConfigError(`EAIT__BACKEND__LANDING_SUPPORT_EMAIL is not an address: ${supportEmail}`);
  }

  const updatedAt = env.EAIT__BACKEND__LANDING_UPDATED?.trim() || DEFAULT_UPDATED_AT;
  if (!DATE_RE.test(updatedAt)) {
    throw new LandingConfigError(`EAIT__BACKEND__LANDING_UPDATED must be YYYY-MM-DD (got ${updatedAt})`);
  }

  // Only the exact string "true" opts in. Not "1", not "yes", not a typo that happens to be
  // non-empty — the failure this guards against is a second box quietly becoming indexable
  // because a variable was set to something truthy-looking, and that failure is discovered by
  // finding its hostname in a search result.
  const indexable = env.EAIT__BACKEND__LANDING_INDEXABLE?.trim().toLowerCase() === "true";

  // Refused rather than sanitised, like every other value here. The key becomes a FILENAME on this
  // origin, so a value carrying a slash or a dot writes somewhere nobody intended; and IndexNow
  // itself requires 8–128 characters of `[A-Za-z0-9-]`, so a rejected key is a submission that
  // fails at the engine with a 403 nobody is watching for.
  const indexNowRaw = env.EAIT__BACKEND__LANDING_INDEXNOW_KEY?.trim();
  if (indexNowRaw && !/^[A-Za-z0-9-]{8,128}$/.test(indexNowRaw)) {
    throw new LandingConfigError(
      "EAIT__BACKEND__LANDING_INDEXNOW_KEY must be 8-128 characters of A-Z, a-z, 0-9 or '-'. It " +
        "becomes a filename on this origin and IndexNow rejects anything else.",
    );
  }
  const indexNowKey = indexNowRaw || null;

  return {
    siteUrl, appStoreUrl, telegramUrl, startUrl, supportEmail, updatedAt, indexable, apiUrl,
    indexNowKey,
  };
}

/**
 * Bumped by hand when the copy changes. See `LandingConfig.updatedAt` for why it is not a clock.
 *
 * It is a hand-bumped date precisely so that it can be WRONG, and it was: the title, the meta
 * description and the two shared pages' descriptions all changed while this still read
 * `2026-08-02`, which put a stale `dateModified` on the page and a stale `lastmod` in the sitemap
 * on the one day the copy had actually moved. Changing public words and not touching this line is
 * the mistake to watch for.
 */
export const DEFAULT_UPDATED_AT = "2026-09-06";

/**
 * Attribution codes, appended to the bot link as `?start=<code>`.
 *
 * `eait-marketer` gives every published asset a unique `t.me/eait_bot?start=<code>` so a view can
 * be traced to the post that produced it — `tt_*` TikTok, `ig_*` Instagram, `cr_*` creators, `rs_*`
 * and `ro_*` Reddit. This page had neither, so every visitor it converted landed in the organic
 * bucket and the page could not be judged at all. `web_*` is a new prefix in that scheme; record it
 * in that repo's convention when you next touch it.
 *
 * One code per ask, because the difference between them is the only cheap read available on whether
 * the page's argument is doing any work: a tap at the top is the headline converting, a tap at the
 * bottom is someone who read 1,200 words first, and the three in between say WHICH argument did it.
 * That last part is why the page repeats the ask rather than keeping two — a convinced reader used
 * to have to scroll past every proof block to reach a form, and nothing recorded that they had.
 *
 * Telegram accepts `[A-Za-z0-9_-]{1,64}` as a start payload; all of these are well inside it.
 */
export const START_CODES = {
  hero: "web_hero",
  steps: "web_step",
  floor: "web_floor",
  faq: "web_faq",
  footer: "web_foot",
} as const;
export type CtaPlacement = keyof typeof START_CODES;

/**
 * Appends the start code, and ONLY to a Telegram link.
 *
 * An App Store URL takes campaign attribution through `pt`/`ct` provider tokens instead, which are
 * account-specific and not ours to invent here — so a store link goes out untouched rather than
 * carrying a query parameter Apple ignores.
 */
function withStartCode(href: string, placement: CtaPlacement): string {
  if (!TELEGRAM_HOSTS.includes(new URL(href).hostname)) return href;
  return `${href}?start=${START_CODES[placement]}`;
}

/**
 * What the page's one action IS.
 *
 * The store wins whenever it exists. Before then the email form is the action — Telegram was the
 * proof of concept and the page no longer sends anybody there; the bot branch survives only for an
 * environment that configures no API at all, where a bot link is still better than a dead page.
 */
export type PrimaryAction = "store" | "form" | "telegram";
export function primaryAction(config: LandingConfig): PrimaryAction {
  if (config.appStoreUrl) return "store";
  if (config.apiUrl) return "form";
  return "telegram";
}

/**
 * Which button gets the accent.
 *
 * The app's own rule is that the accent colour marks exactly one thing per screen — the primary
 * action (`src/mobile/lib/theme.ts`). The page keeps that rule, so it needs to know which of the two
 * destinations is primary. The App Store wins whenever it exists; before then the bot is not a
 * consolation link, it is the only thing a visitor can actually do.
 */
export function primaryCta(
  config: LandingConfig,
  placement: CtaPlacement,
): { href: string; label: string; note: string | null } {
  if (config.appStoreUrl) {
    return {
      href: withStartCode(config.appStoreUrl, placement),
      label: "Get eait for iPhone",
      note: "See it work before you give a card. Your photo stays with the meal and leaves with your account.",
    };
  }
  return {
    href: withStartCode(config.telegramUrl!, placement),
    // Not "Open the Telegram bot". A button that names the destination spends itself on navigation;
    // this one names what happens next, and the note under it carries the destination.
    label: "Send your first meal",
    // NO NOTE. It said "Nothing to install. Send a photo to a Telegram chat and read the answer",
    // which spent three lines explaining the destination the button had deliberately stopped
    // naming — and told a reader who has just been offered one action to think about a second
    // product. Cut on Kirill's instruction; the store variant keeps its note, which is about the
    // card rather than about the plumbing.
    note: null,
  };
}

/**
 * The other one, if there is another one.
 *
 * THE WEB SIGN-UP OUTRANKS THE BOT wherever it exists, and the reason is what each one produces. The
 * bot is a demonstration; `/start` creates the ACCOUNT — the same account the app opens into, with
 * the plan already computed and, where a checkout is configured, already paid for. A visitor who
 * cannot install an iPhone app today is exactly who this link is for.
 */
export function secondaryCta(
  config: LandingConfig,
  placement: CtaPlacement,
): { href: string; label: string } | null {
  if (config.startUrl) {
    // WITH THE PLACEMENT CODE, like the bot link beside it. The two codes exist to answer the one
    // cheap question this page can be asked — did the headline convert, or did somebody read 1,200
    // words first — and a CTA that carries neither is a CTA whose performance is unreadable. The
    // read here is the API's own access log rather than eait-marketer's, because this destination
    // is ours. `URL` rather than a string append: the origin may already carry a query.
    const to = new URL(config.startUrl);
    to.searchParams.set("start", START_CODES[placement]);
    return { href: to.toString(), label: "or set up your plan on the web" };
  }
  if (config.appStoreUrl && config.telegramUrl) {
    return { href: withStartCode(config.telegramUrl, placement), label: "or try it in Telegram first" };
  }
  return null;
}

/**
 * The one sentence that stops the page describing a product the button does not open.
 *
 * Until the listing exists, this page argues for an iPhone app — "Sign in with Apple", "the app",
 * an FAQ answering whether there is an Android version — and its only button opens Telegram. A
 * visitor forms one model of what they are getting and is handed another, on a page whose entire
 * argument is that we do not do sneaky things. Saying it plainly costs one line and is the only
 * honest option: the app is not released, and pretending the mismatch is not there is the thing
 * the rest of the page promises we would not do.
 *
 * Returns null once the store link exists, at which point there is nothing to explain.
 */
export function surfaceNote(config: LandingConfig): string | null {
  if (config.appStoreUrl) return null;
  if (primaryAction(config) === "form") {
    return "iOS app coming soon.";
  }
  return "The iPhone app is not out yet. The Telegram bot does the same job today, on any phone, from a chat.";
}
