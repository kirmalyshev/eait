// The page, as a function of its content and its config.
//
// Plain string templating and no framework, for the same reason there is no JavaScript in the
// output: this is one static document, and every dependency added here is a dependency that has to
// be patched for the rest of the product's life in exchange for markup we can write directly.
//
// Two rules hold throughout:
//   • Every interpolated value goes through `esc`. The copy contains apostrophes and quotation
//     marks and one day it will contain an ampersand, and a landing page that renders `&` as a
//     broken entity is a landing page nobody trusts with their photographs.
//   • The primary action appears exactly twice — top and bottom — and nothing else on the page is
//     accent-coloured. That is the app's own rule about the accent, applied here.

import {
  accuracySection, brand, closing, faqSection, faqs, floorSection, footer, hero, privacySection,
  founder, outcomes, refusals, refusalsSection, sample, steps, stepsSection, subscribeSection,
} from "./content.ts";
import {
  primaryCta, secondaryCta, surfaceNote, START_CODES, type CtaPlacement, type LandingConfig,
} from "./config.ts";
import { color } from "./tokens.ts";
import { spudSvg, type LandingMood } from "./mascot.ts";
import { OG_HEIGHT, OG_WIDTH } from "./images.ts";

export function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const n = (value: number) => value.toLocaleString("en-GB");

/**
 * The app mark, as the browser-tab icon.
 *
 * Same two shapes and the same coordinates as `scripts/make-icons.ts` — the letter "i" read as a
 * plate: a heavy ring seen from above with a dot above it. That script rasterises them for the
 * home screen; here they stay vector, which is 300 bytes and sharp at any tab size.
 *
 * Emitting it matters for a smaller reason too: without an explicit icon link a browser requests
 * `/favicon.ico`, and nginx answers 404 on every first visit.
 */
export function iconSvg(): string {
  const ring = { cx: 512, cy: 600, r: (300 + 228) / 2, width: 300 - 228 };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
<rect width="1024" height="1024" rx="224" fill="${color.bg}"/>
<circle cx="${ring.cx}" cy="${ring.cy}" r="${ring.r}" fill="none" stroke="${color.accent}" stroke-width="${ring.width}"/>
<circle cx="512" cy="190" r="76" fill="${color.accent}"/>
</svg>
`;
}

function metaDescription(): string {
  return `${hero.headline} ${brand.tagline} No card, no trial, and photos are never stored.`;
}

function heroInstrument(): string {
  const { target, meal } = sample;
  const pills = meal.verdicts
    .map(
      // `pill-${i + 1}` carries the stagger. It is a CLASS, not a `style` attribute, because the
      // page is served under `style-src 'self'` — see `derivedRules()` in styles.ts.
      (v, i) => `
            <span class="pill pill-${v.verdict} pill-${i + 1}">
              <span class="pill-dot"></span>${esc(v.label)}
            </span>`,
    )
    .join("");

  const macros = meal.macros
    .map(
      (m) => `
            <div>
              <span class="macro-value num">${esc(m.value)}</span>
              <span class="macro-label">${esc(m.label)}</span>
            </div>`,
    )
    .join("");

  // The figure is decorative in the sense that the page reads without it — but it is the only place
  // a visitor sees what the product outputs, so it gets a caption a screen reader can use.
  return `
      <figure class="device" role="img" aria-label="${esc(
        `A daily target of ${n(target.kcal)} kilocalories with the ${n(target.floorKcal)} ` +
          `kilocalorie floor marked below it, and one logged meal — ${meal.title}, ` +
          `${n(meal.kcal)} kilocalories — carrying three separate verdicts: ` +
          meal.verdicts.map((v) => `${v.label} ${v.verdict}`).join(", ") + ".",
      )}">
        <div class="device-inner">
          <div class="device-bar"></div>

          <div class="card deal deal-1">
            <span class="tcard-label">${esc(target.label)}</span>
            <div class="tcard-figure">
              <span class="tcard-kcal num">${n(target.kcal)}</span>
              <span class="tcard-unit">kcal / day</span>
            </div>
            <div class="scale">
              <div class="scale-line"></div>
              <div class="scale-tick scale-tick-target"></div>
              <div class="scale-label scale-label-target">target</div>
              <div class="scale-tick scale-tick-floor"></div>
              <div class="scale-label scale-label-floor">${esc(target.floorLabel)} ${n(
                target.floorKcal,
              )}</div>
            </div>
            <p class="tcard-basis">${esc(target.basis)}</p>
          </div>

          <div class="card deal deal-2">
            <div class="mcard-head">
              <p class="mcard-title">${esc(meal.title)}</p>
              <span class="mcard-kcal num">${n(meal.kcal)}<span class="mcard-kcal-unit">kcal</span></span>
            </div>
            <div class="macros">${macros}
            </div>
            <div class="pills">${pills}
            </div>
            <p class="mcard-note">${esc(meal.note)}</p>
          </div>
        </div>
      </figure>`;
}

function ctaBlock(config: LandingConfig, placement: CtaPlacement): string {
  const primary = primaryCta(config, placement);
  const secondary = secondaryCta(config, placement);
  return `
      <div class="cta-row">
        <a class="cta" href="${esc(primary.href)}">${esc(primary.label)}</a>${
          secondary
            ? `
        <a class="cta-alt" href="${esc(secondary.href)}">${esc(secondary.label)}</a>`
            : ""
        }
      </div>
      <p class="cta-note">${esc(primary.note)}</p>`;
}

/**
 * Spud with a line, as he appears in the app: a potato and something he is saying.
 *
 * `id` makes the gradient's id unique. Two inline SVGs sharing one `<linearGradient id>` in a single
 * document is not a duplicate-id warning, it is a second potato with no fill.
 */
function spud(mood: LandingMood, id: string, says: string): string {
  return `
      <div class="spud-says">
        ${spudSvg(mood, id)}
        <p class="spud-line">${esc(says)}</p>
      </div>`;
}

/**
 * The subscribe form, or nothing.
 *
 * A plain `<form method="post">`, because the page carries no JavaScript and this is the only
 * submit that works without any. The browser navigates to the response, so the API answers 303 and
 * sends it back here — to /check-your-email, /not-subscribed or /try-later, which are static pages
 * in this same bundle. /subscribed is not one of the form's destinations any more: it belongs to
 * the confirmation link, because until that link is followed nobody is on any list.
 *
 * `source` travels with it so a subscription can be told from a bare visit later, using the same
 * code the CTA carries.
 */
function subscribeForm(config: LandingConfig): string {
  if (!config.apiUrl) return "";
  return `
  <section class="section">
    <div class="wrap">
      <div class="section-head">
        <p class="eyebrow">${esc(subscribeSection.eyebrow)}</p>
        <h2 class="section-title">${esc(subscribeSection.headline)}</h2>
        <p class="section-intro">${esc(subscribeSection.body)}</p>
      </div>
      <form class="subscribe" method="post" action="${esc(config.apiUrl)}/v1/subscribe">
        <input type="hidden" name="source" value="${esc(START_CODES.footer)}">
        <label class="subscribe-label" for="email">${esc(subscribeSection.label)}</label>
        <div class="subscribe-row">
          <input class="subscribe-input" id="email" type="email" name="email" required
                 autocomplete="email" inputmode="email" spellcheck="false"
                 placeholder="${esc(subscribeSection.placeholder)}">
          <button class="subscribe-button" type="submit">${esc(subscribeSection.button)}</button>
        </div>
        <div class="honeypot" aria-hidden="true">
          <label for="company">${esc(subscribeSection.honeypotLabel)}</label>
          <input id="company" name="company" type="text" tabindex="-1" autocomplete="off">
        </div>
        <p class="subscribe-note">${esc(subscribeSection.note)}</p>
      </form>
${spud("wave", "spud-subscribe", subscribeSection.mascot)}
    </div>
  </section>
`;
}

/**
 * A landing outcome page — the three the form's redirects land on.
 *
 * The same shell and the same stylesheet as the page, so somebody who just handed over an address
 * does not land on something that looks like a different site. No form, no CTA, one way back.
 */
export function renderOutcome(
  config: LandingConfig,
  outcome: { title: string; body: string; mascot: LandingMood },
): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(`${outcome.title} — ${brand.name}`)}</title>
<meta name="robots" content="noindex">
<meta name="theme-color" content="${esc(color.bg)}">
<link rel="icon" href="/favicon.ico" sizes="64x64">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/styles.css">
</head>
<body>
<header class="masthead">
  <div class="wrap masthead-row">
    <a class="wordmark" href="/"><span class="wordmark-dot"></span>${esc(brand.name)}</a>
    <nav class="masthead-links" aria-label="Legal and support">
      <a href="/privacy">Privacy</a>
      <a href="/support">Support</a>
    </nav>
  </div>
</header>
<main class="outcome">
  <div class="wrap">
    ${spudSvg(outcome.mascot, "spud-outcome")}
    <h1 class="outcome-title">${esc(outcome.title)}</h1>
    <p class="outcome-body">${esc(outcome.body)}</p>
    <p class="outcome-back"><a href="/">Back to the page</a></p>
  </div>
</main>
</body>
</html>
`;
}

/**
 * Every one of them, by the path the API redirects to.
 *
 * Adding a redirect target here is half the job — `deploy/nginx/templates/landing.conf.template`
 * needs the extensionless location too, or the browser follows a 303 into a 404 at the worst
 * possible moment.
 */
export function outcomePages(config: LandingConfig): Record<string, string> {
  return {
    "subscribed.html": renderOutcome(config, outcomes.subscribed),
    "check-your-email.html": renderOutcome(config, outcomes.checkYourEmail),
    "not-subscribed.html": renderOutcome(config, outcomes.notSubscribed),
    "try-later.html": renderOutcome(config, outcomes.tryLater),
    "unsubscribed.html": renderOutcome(config, outcomes.unsubscribed),
  };
}

/**
 * The `robots` meta, present only when a build must NOT be indexed.
 *
 * Emitted as well as `robots.txt` rather than instead of it, because the two do different jobs: the
 * file asks a crawler not to fetch the page, and a page it never fetched is a page whose meta tag
 * it never read — but a URL discovered from a link elsewhere can still be indexed without being
 * fetched. `noindex` in the document is what removes it once it has been.
 */
function robotsMeta(config: LandingConfig): string {
  return config.indexable ? "" : '<meta name="robots" content="noindex, nofollow">\n';
}

export function renderLanding(config: LandingConfig): string {
  const privacyHref = "/privacy";
  const supportHref = "/support";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(brand.title)}</title>
<meta name="description" content="${esc(metaDescription())}">
<meta name="theme-color" content="${esc(color.bg)}">
<link rel="canonical" href="${esc(config.siteUrl)}/">
${robotsMeta(config)}<link rel="icon" href="/favicon.ico" sizes="64x64">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="stylesheet" href="/styles.css">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(brand.name)}">
<meta property="og:locale" content="en_GB">
<meta property="og:title" content="${esc(brand.title)}">
<meta property="og:description" content="${esc(metaDescription())}">
<meta property="og:url" content="${esc(config.siteUrl)}/">
<meta property="og:image" content="${esc(config.siteUrl)}/og.png">
<meta property="og:image:width" content="${OG_WIDTH}">
<meta property="og:image:height" content="${OG_HEIGHT}">
<meta property="og:image:alt" content="${esc(`The ${brand.name} mark: a plate seen from above.`)}">
<meta name="twitter:card" content="summary_large_image">
</head>
<body>

<header class="masthead">
  <div class="wrap masthead-row">
    <a class="wordmark" href="/">
      <span class="wordmark-dot"></span>${esc(brand.name)}
    </a>
    <nav class="masthead-links" aria-label="Legal and support">
      <a href="${privacyHref}">Privacy</a>
      <a href="${supportHref}">Support</a>
    </nav>
  </div>
</header>

<main>

  <section class="hero">
    <div class="wrap hero-grid">
      <div>
        <p class="eyebrow">${esc(hero.eyebrow)}</p>
        <h1 class="hero-title">${esc(hero.headline)}</h1>
        <p class="hero-sub">${esc(hero.sub)}</p>${
          surfaceNote(config)
            ? `
        <p class="hero-surface">${esc(surfaceNote(config)!)}</p>`
            : ""
        }
${ctaBlock(config, 'hero')}
      </div>
${heroInstrument()}
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="section-head">
        <p class="eyebrow">${esc(refusalsSection.eyebrow)}</p>
        <h2 class="section-title">${esc(refusalsSection.headline)}</h2>
      </div>
      <div class="refusals">
${refusals
  .map(
    (r) => `        <div class="refusal">
          <h3 class="refusal-title">${esc(r.title)}</h3>
          <p class="refusal-body">${esc(r.body)}</p>
          <p class="refusal-proof">${esc(r.proof)}</p>
        </div>`,
  )
  .join("\n")}
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="section-head">
        <p class="eyebrow">${esc(stepsSection.eyebrow)}</p>
        <h2 class="section-title">${esc(stepsSection.headline)}</h2>
      </div>
      <div class="steps">
${steps
  .map(
    (s) => `        <div class="step">
          <span class="step-ordinal">${esc(s.ordinal)}</span>
          <h3 class="step-title">${esc(s.title)}</h3>
          <p class="step-body">${esc(s.body)}</p>
        </div>`,
  )
  .join("\n")}
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="section-head">
        <p class="eyebrow">${esc(accuracySection.eyebrow)}</p>
        <h2 class="section-title">${esc(accuracySection.headline)}</h2>
        <p class="section-intro">${esc(accuracySection.intro)}</p>
      </div>
      <div class="prose">
${accuracySection.body.map((p) => `        <p>${esc(p)}</p>`).join("\n")}
      </div>
      <div class="measured">
        <p class="measured-label">${esc(accuracySection.proof.label)}</p>
        <p class="measured-body">${esc(accuracySection.proof.body)}</p>
      </div>
    </div>
  </section>

  <section class="section floor-section">
    <div class="wrap">
      <div class="section-head">
        <p class="eyebrow">${esc(floorSection.eyebrow)}</p>
        <h2 class="section-title">${esc(floorSection.headline)}</h2>
        <p class="section-intro">${esc(floorSection.intro)}</p>
      </div>
      <div class="guards">
${floorSection.guards
  .map(
    (g) => `        <div class="guard">
          <h3 class="guard-title">${esc(g.title)}</h3>
          <p class="guard-body">${esc(g.body)}</p>
        </div>`,
  )
  .join("\n")}
      </div>
      <p class="floor-outro">${esc(floorSection.outro)}</p>
${spud("care", "spud-floor", floorSection.mascot)}
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="section-head">
        <p class="eyebrow">${esc(privacySection.eyebrow)}</p>
        <h2 class="section-title">${esc(privacySection.headline)}</h2>
      </div>
      <div class="facts">
${privacySection.facts
  .map(
    (f) => `        <div>
          <h3 class="fact-title">${esc(f.title)}</h3>
          <p class="fact-body">${esc(f.body)}</p>
        </div>`,
  )
  .join("\n")}
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="section-head">
        <p class="eyebrow">${esc(faqSection.eyebrow)}</p>
        <h2 class="section-title">${esc(faqSection.headline)}</h2>
      </div>
      <div class="faq">
${faqs
  .map(
    (f) => `        <details class="faq-item">
          <summary class="faq-q">${esc(f.q)}</summary>
          <p class="faq-a">${esc(f.a)}</p>
        </details>`,
  )
  .join("\n")}
      </div>
    </div>
  </section>

${subscribeForm(config)}
  <section class="closing">
    <div class="wrap">
      <figure class="founder">
        <blockquote class="founder-line">${esc(founder.line)}</blockquote>
        <figcaption class="founder-by">${esc(founder.by)}</figcaption>
      </figure>
      <h2 class="closing-title">${esc(closing.headline)}</h2>
      <p class="closing-sub">${esc(closing.sub)}</p>
${ctaBlock(config, 'footer')}
    </div>
  </section>

</main>

<footer class="footer">
  <div class="wrap footer-row">
    <p class="footer-note">${esc(footer.note)}</p>
    <nav class="footer-links" aria-label="Footer">
      <a href="${privacyHref}">Privacy</a>
      <a href="${supportHref}">Support</a>
      <a href="mailto:${esc(config.supportEmail)}">${esc(config.supportEmail)}</a>
      <span>Reviewed ${esc(config.updatedAt)}</span>
    </nav>
  </div>
</footer>

</body>
</html>
`;
}
