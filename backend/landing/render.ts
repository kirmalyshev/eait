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
//   • There is exactly ONE action on this page, and it appears five times: the hero, after how it
//     works, after the floor, after the questions, and at the foot. Nothing else is accent-coloured
//     — that is the app's own rule about the accent, and repeating one ask does not break it the way
//     a second, different ask would. It was two for a long while, top and bottom, which meant a
//     reader convinced by the third of eight sections had to scroll past the other five to act.

import {
  accuracySection, brand, closing, faqSection, faqs, figures, figuresSection, floorSection, footer,
  forSection, hero, privacySection, founder, outcomes, refusals, refusalsSection, sample,
  screensSection, shots, steps, stepsSection, subscribeSection,
} from "./content.ts";
import {
  primaryAction, primaryCta, secondaryCta, surfaceNote, START_CODES, type CtaPlacement,
  type LandingConfig,
} from "./config.ts";
import { color, dark, light } from "./tokens.ts";
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

/**
 * Copy with its one emphasised span, as HTML.
 *
 * ESCAPE FIRST, THEN MARK UP — never the other way round. `esc` runs over the whole string, so any
 * `<` a writer types is already `&lt;` by the time the marker is looked for, and the only tag that
 * can reach the page is the one this function writes. The convention (`**like this**`, at most once
 * per block) and the reason for it are in the header of content.ts.
 */
export function emphasis(value: string): string {
  return esc(value).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

/**
 * The theme control.
 *
 * A BUTTON with `aria-pressed`, not a checkbox and not a link: it changes the appearance of the
 * page it is on, which is what a toggle button is for. The label and the pressed state are written
 * by `theme.js` on load, because only the browser knows whether an unset preference currently
 * resolves to dark. The static markup carries the light-theme answer so a visitor with JavaScript
 * off still gets a labelled control rather than an unnamed square — it will not do anything, which
 * is the honest state of a remembered setting with no script to remember it.
 *
 * `type="button"` because one of the pages that carries it also carries a form, and a bare button
 * inside a form submits it.
 */
const themeToggle = (): string => `
      <button class="theme-toggle" type="button" data-theme-toggle
              aria-pressed="false" aria-label="Switch to the dark theme">
        <span class="theme-toggle-mark" aria-hidden="true"></span>
      </button>`;

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
  return `${hero.headline} ${brand.tagline} Your first analysis needs no card, and photos are never stored.`;
}

/**
 * Structured data for search and answer engines: the organisation, the site, and the FAQ — the one
 * section of the page already written as questions with self-contained answers.
 *
 * A data block, not a script — CSP's `script-src` governs execution and this never executes — but
 * it still lives inside a `<script>` element, so a literal `<` in an answer could end the element
 * mid-JSON. Every `<` is serialised as an escape instead.
 */
function jsonLd(config: LandingConfig): string {
  const site = config.siteUrl;
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${site}/#org`,
        name: brand.name,
        url: `${site}/`,
        logo: `${site}/apple-touch-icon.png`,
        email: config.supportEmail,
      },
      {
        "@type": "WebSite",
        "@id": `${site}/#website`,
        url: `${site}/`,
        name: brand.name,
        description: metaDescription(),
        publisher: { "@id": `${site}/#org` },
      },
      {
        "@type": "FAQPage",
        "@id": `${site}/#faq`,
        mainEntity: faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };
  return `<script type="application/ld+json">${JSON.stringify(graph).replace(/</g, "\\u003c")}</script>`;
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
          meal.verdicts.map((v) => `${v.label} ${v.verdict}`).join(", ") +
          `. The card's answer reads: ${meal.verdict} ` +
          // The figure is role="img", which hides its inner text from assistive technology, so the
          // one line rendered outside the cards has to travel in the label too.
          `Beneath the card, a note: ${meal.note}`,
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
            <p class="mcard-verdict">${esc(meal.verdict)}</p>
          </div>
${spud("idle", "spud-hero", meal.note)}
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
 * IT IS A SPEECH BUBBLE, and that is the whole of the fix. He was a 72-pixel potato beside a run of
 * grey body text, twice on a page of eight sections — which reads as a stray emoji somebody left
 * behind rather than as the character who does the talking in the product. In the app he is always
 * an avatar to the left of a white bubble (`lib/components/bubble.tsx`, and the screenshots on this
 * page show it), so the page now draws him the same way. Nothing about how OFTEN he appears
 * changed: the rule in mascot.ts is that he shows up for a refusal and for a question and nowhere
 * else, because the category's failure mode is reward theatre and a potato in every section IS it.
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
 * The ask, repeated mid-page.
 *
 * Rendered after each of the three blocks that actually do the convincing — how it works, the
 * floor, and the questions — because until this existed the page asked twice in eight thousand
 * pixels and a reader convinced by the third section had to scroll past four more to act on it.
 *
 * It is the SAME ask, deliberately: whichever action is primary for this build, with the same
 * words, the same field and the same button. A band that invented its own wording per position
 * would be five offers rather than one asked five times, and the start code is what makes the
 * positions distinguishable afterwards without changing anything a reader can see.
 */
function askBand(config: LandingConfig, placement: CtaPlacement): string {
  const isForm = primaryAction(config) === "form";
  const body = isForm ? subscribeFormEl(config, placement) : ctaBlock(config, placement);
  const line = isForm ? subscribeSection.bandLine.form : subscribeSection.bandLine.action;
  // The body is wrapped, because `ctaBlock` returns TWO elements — the row and its note — and two
  // children in a two-column grid puts the note in the next row's first column, under the sentence
  // it is not about.
  return `
  <aside class="ask">
    <div class="wrap ask-row">
      <p class="ask-line">${esc(line)}</p>
      <div class="ask-body">${body}</div>
    </div>
  </aside>
`;
}

/**
 * The screenshots: the app, photographed, at the three moments the page has been describing.
 *
 * `loading="lazy"` and explicit dimensions on every one — the width and height are in `shots` and
 * come from the files, so the browser reserves the box before the bytes arrive and nothing below
 * jumps. They are same-origin under `img-src 'self'`, like everything else here.
 */
function screens(): string {
  return `
  <section class="section screens-section">
    <div class="wrap">
      <p class="eyebrow">${esc(screensSection.eyebrow)}</p>
      <div class="section-head">
        <h2 class="section-title">${esc(screensSection.headline)}</h2>
        <p class="section-intro">${esc(screensSection.intro)}</p>
      </div>
      <div class="shots">
${shots
  .map(
    (s) => `        <figure class="shot">
          <div class="shot-frame">
            <img class="shot-img" src="/assets/${esc(s.file)}" width="${s.width}" height="${s.height}"
                 loading="lazy" decoding="async" alt="${esc(s.alt)}">
          </div>
          <figcaption class="shot-caption">
            <h3 class="shot-title">${esc(s.title)}</h3>
            <p class="shot-body">${emphasis(s.body)}</p>
          </figcaption>
        </figure>`,
  )
  .join("\n")}
      </div>
    </div>
  </section>
`;
}

/** The four numbers, set large. Every value is read from the code that produces it — see content.ts. */
function figuresBand(): string {
  return `
  <section class="section figures-section">
    <div class="wrap">
      <p class="eyebrow">${esc(figuresSection.eyebrow)}</p>
      <div class="section-head">
        <h2 class="section-title">${esc(figuresSection.headline)}</h2>
      </div>
      <dl class="figures">
${figures
  .map(
    (f) => `        <div class="figure">
          <dt class="figure-value num">${esc(f.value)}<span class="figure-unit">${esc(f.unit)}</span></dt>
          <dd class="figure-label">${esc(f.label)}</dd>
        </div>`,
  )
  .join("\n")}
      </dl>
    </div>
  </section>
`;
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
function subscribeFormEl(config: LandingConfig, placement: CtaPlacement): string {
  // FIVE placements render on one page, so ids are suffixed per placement — duplicate ids break the
  // label-for pairing exactly where a screen reader needs it, and the version that suffixed only
  // the hero was already one form short of being wrong. Derived from the placement rather than
  // listed, so a sixth ask cannot be added without its own id.
  const suf = `-${placement}`;
  // When the form IS the page's primary action it wears the accent — the same one-accent rule the
  // CTA followed. The error line is CSS-revealed on :user-invalid, so a typo is named inline, in
  // this page's voice, before the browser's own bubble gets involved.
  const formClass = primaryAction(config) === "form" ? "subscribe subscribe-primary" : "subscribe";
  return `<form class="${formClass}" method="post" action="${esc(config.apiUrl!)}/v1/subscribe">
        <input type="hidden" name="source" value="${esc(START_CODES[placement])}">
        <label class="subscribe-label" for="email${suf}">${esc(subscribeSection.label)}</label>
        <div class="subscribe-row">
          <input class="subscribe-input" id="email${suf}" type="email" name="email" required
                 autocomplete="email" inputmode="email" spellcheck="false"
                 placeholder="${esc(subscribeSection.placeholder)}">
          <button class="subscribe-button" type="submit">${esc(subscribeSection.button)}</button>
          <span class="subscribe-error">${esc(subscribeSection.invalidHint)}</span>
        </div>
        <div class="honeypot" aria-hidden="true">
          <label for="company${suf}">${esc(subscribeSection.honeypotLabel)}</label>
          <input id="company${suf}" name="company" type="text" tabindex="-1" autocomplete="off">
        </div>
      </form>`;
}

function subscribeForm(config: LandingConfig): string {
  if (!config.apiUrl) return "";
  return `
  <section class="section">
    <div class="wrap">
      <p class="eyebrow">${esc(subscribeSection.eyebrow)}</p>
      <div class="section-head">
        <h2 class="section-title">${esc(subscribeSection.headline)}</h2>
        <p class="section-intro">${esc(subscribeSection.body)}</p>
      </div>
      ${subscribeFormEl(config, "footer")}
      <p class="subscribe-note">${esc(subscribeSection.note)}</p>
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
<meta name="theme-color" content="${esc(light.bg)}">
<link rel="icon" href="/favicon.ico" sizes="64x64">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="preload" href="/assets/fonts/space-grotesk-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/styles.css">
<script src="/theme.js"></script>
</head>
<body>
<header class="masthead">
  <div class="wrap masthead-row">
    <a class="wordmark" href="/"><span class="wordmark-dot"></span>${esc(brand.name)}</a>
    <nav class="masthead-links" aria-label="Legal and support">
      <a href="/privacy">Privacy</a>
      <a href="/support">Support</a>
    </nav>${themeToggle()}
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
<meta name="theme-color" content="${esc(light.bg)}">
<link rel="canonical" href="${esc(config.siteUrl)}/">
${robotsMeta(config)}<link rel="icon" href="/favicon.ico" sizes="64x64">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preload" href="/assets/fonts/space-grotesk-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/styles.css">
<script src="/theme.js"></script>
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
${jsonLd(config)}
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
    </nav>${themeToggle()}
  </div>
</header>

<main>

  <section class="hero">
    <div class="wrap hero-grid">
      <div>
        <p class="eyebrow">${esc(hero.eyebrow)}</p>
        <h1 class="hero-title">${esc(hero.headline)}</h1>
        <p class="hero-sub">${esc(hero.sub)}</p>
        <p class="hero-audience">${esc(hero.audience)}</p>${
          surfaceNote(config)
            ? `
        <p class="hero-surface">${esc(surfaceNote(config)!)}</p>`
            : ""
        }
${
          primaryAction(config) === "form"
            ? `      ${subscribeFormEl(config, "hero")}
      <p class="cta-note">${esc(subscribeSection.heroNote)}</p>${
                // THE ONE PLACE THE WEB SIGN-UP APPEARS IN A FORM BUILD, and it has to appear
                // somewhere: `ctaBlock` is what carries `secondaryCta`, and a build with no store
                // listing renders the form instead of it — so the link vanished in exactly the
                // configuration where `/start` is the only place anybody can onboard at all.
                //
                // Once, in the hero, rather than under all five asks. The repetition on this page
                // is ONE offer asked five times; a second offer beside each of them is a different
                // page, and the argument for the repetition would stop being true.
                secondaryCta(config, "hero")
                  ? `
      <p class="cta-note"><a class="cta-alt-inline" href="${esc(secondaryCta(config, "hero")!.href)}">${esc(secondaryCta(config, "hero")!.label)}</a></p>`
                  : ""
              }`
            : ctaBlock(config, "hero")
        }
      </div>
${heroInstrument()}
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <p class="eyebrow">${esc(forSection.eyebrow)}</p>
      <div class="section-head">
        <h2 class="section-title">${esc(forSection.headline)}</h2>
      </div>
      <div class="facts">
${forSection.rows
  .map(
    (r) => `        <div>
          <h3 class="fact-title">${esc(r.title)}</h3>
          <p class="fact-body">${emphasis(r.body)}</p>
        </div>`,
  )
  .join("\n")}
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <p class="eyebrow">${esc(refusalsSection.eyebrow)}</p>
      <div class="section-head">
        <h2 class="section-title">${esc(refusalsSection.headline)}</h2>
      </div>
      <div class="refusals">
${refusals
  .map(
    (r) => `        <div class="refusal">
          <h3 class="refusal-title">${esc(r.title)}</h3>
          <p class="refusal-body">${emphasis(r.body)}</p>
          <p class="refusal-proof">${esc(r.proof)}</p>
        </div>`,
  )
  .join("\n")}
      </div>
    </div>
  </section>

${figuresBand()}
  <section class="section">
    <div class="wrap">
      <p class="eyebrow">${esc(stepsSection.eyebrow)}</p>
      <div class="section-head">
        <h2 class="section-title">${esc(stepsSection.headline)}</h2>
      </div>
      <div class="steps">
${steps
  .map(
    (s) => `        <div class="step">
          <span class="step-ordinal">${esc(s.ordinal)}</span>
          <h3 class="step-title">${esc(s.title)}</h3>
          <p class="step-body">${emphasis(s.body)}</p>
        </div>`,
  )
  .join("\n")}
      </div>
    </div>
  </section>

${screens()}
${askBand(config, "steps")}
  <section class="section">
    <div class="wrap">
      <p class="eyebrow">${esc(accuracySection.eyebrow)}</p>
      <div class="section-head">
        <h2 class="section-title">${esc(accuracySection.headline)}</h2>
        <p class="section-intro">${emphasis(accuracySection.intro)}</p>
      </div>
      <div class="prose">
${accuracySection.body.map((p) => `        <p>${esc(p)}</p>`).join("\n")}
      </div>
      <div class="measured">
        <p class="measured-label">${esc(accuracySection.proof.label)}</p>
        <p class="measured-body">${esc(accuracySection.proof.body)}</p>
      </div>
      <figure class="founder">
        <blockquote class="founder-line">${esc(founder.line)}</blockquote>
        <figcaption class="founder-by">${esc(founder.by)}</figcaption>
      </figure>
${spud("think", "spud-accuracy", accuracySection.mascot)}
    </div>
  </section>

  <section class="section floor-section">
    <div class="wrap">
      <p class="eyebrow">${esc(floorSection.eyebrow)}</p>
      <div class="section-head">
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

${askBand(config, "floor")}
  <section class="section">
    <div class="wrap">
      <p class="eyebrow">${esc(privacySection.eyebrow)}</p>
      <div class="section-head">
        <h2 class="section-title">${esc(privacySection.headline)}</h2>
      </div>
      <div class="facts">
${privacySection.facts
  .map(
    (f) => `        <div>
          <h3 class="fact-title">${esc(f.title)}</h3>
          <p class="fact-body">${emphasis(f.body)}</p>
        </div>`,
  )
  .join("\n")}
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <p class="eyebrow">${esc(faqSection.eyebrow)}</p>
      <div class="section-head">
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

${askBand(config, "faq")}
  <section class="closing">
    <div class="wrap">
      <h2 class="closing-title">${esc(closing.headline)}</h2>
      <p class="closing-sub">${esc(closing.sub)}</p>${
        // In form mode the ask under this headline is the subscribe SECTION, which now follows the
        // closing instead of preceding it — the design review found the page's last screen was a
        // dead end: quote, title, sub, footer, and nothing to do. In the other modes the CTA
        // renders here as before.
        primaryAction(config) === "form" ? "" : `\n${ctaBlock(config, "footer")}`
      }
    </div>
  </section>
${subscribeForm(config)}
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
