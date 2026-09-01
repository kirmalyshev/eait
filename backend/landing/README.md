# `src/backend/landing/`

The marketing page at the app's own domain. One static HTML file, one stylesheet, no JavaScript.

```sh
make landing                     # build it and serve it on http://localhost:4173
bun test ./src/backend/landing   # the claims gate, the config refusals, the palette check
```

> **`make landing` is a preview, not a rehearsal.** It serves the files with no headers, and the
> headers are part of the page: a `style-src 'self'` policy drops every inline `style` attribute,
> silently, which is exactly how the hero's floor mark ended up stacked at the left edge of the card
> on the deployed host while localhost looked perfect. To check it the way production serves it, build
> `deploy/Dockerfile.landing` and run that container, or deploy and look.

## What it is

A generator, not a page. `build.ts` renders `render.ts(config)` into a directory, and the deploy
serves that directory with nginx. There is no framework and no runtime: the output is 15 KB of HTML
and 9 KB of CSS, the single animated moment is a CSS keyframe, and the FAQ is `<details>`.

That is not minimalism for its own sake. A page whose whole argument is "we keep nothing of
yours" has no business loading anything from a third party — and it doesn't: the one typeface
(Space Grotesk, 22KB, headlines only) is self-hosted under `font-src 'self'`, with its OFL licence
beside it, and everything else is the system stack.

| File | |
|---|---|
| `content.ts` | Every word. The header explains which research each section came from and what may not appear. |
| `assets/` | The three screenshots the page shows, resized once from `docs/screenshots/` and committed. `build.ts` copies them to `/assets/` and throws if one is missing. |
| `config.ts` | What the page cannot know about itself: origin, store link, bot link. Refuses a build it cannot make work. |
| `render.ts` | Content + config → HTML. |
| `styles.ts` | The stylesheet, as a string. |
| `tokens.ts` | The app's palette, transcribed from `src/mobile/lib/theme.ts`. A test fails if it drifts. |
| `claims.ts` | The health-claims and exclusivity gate. Fails the build; does not warn. |
| `build.ts` | Validate → render → lint → write. Nothing is written until all three pass. |
| `images.ts` | The favicon, touch icon and share card, drawn from the app icon's own coordinates. |

## The three things that changed after the teardown

**The ask is repeated, not multiplied.** `START_CODES` in `config.ts` is the list of places the page
asks: the hero, after *How it works*, after *The floor*, after the FAQ, and at the foot. Every one
renders the SAME action with the same words — `askBand()` — and differs only by its start code, so a
report can say which argument converted without a reader seeing five different offers. It was two,
top and bottom, across eight thousand pixels: a reader convinced by the third of eight sections had
to scroll past the other five to act on it. Adding a band without a code, or a code without a band,
fails a test.

**Emphasis is `**like this**`, once per block.** `emphasis()` in `render.ts` escapes first and marks
up second, so copy cannot put a tag on the page. The convention exists because 1,600 words of even
grey read as an essay and this page is read standing in a kitchen. A block with two emphasised spans
has none, and a test enforces it.

**The screenshots are the app, and three of the ten cannot be used.** `docs/screenshots/06`–`08`
carry "Demo analyzer — these numbers are canned" in shot, and `06` shows a card that does not match
what was typed into it. `docs/RELEASE.md` states all ten were reshot against a real analyzer and
that none of them carries that line; the committed pixels disagree. Until they are reshot, the page
shows only frames that never reach the analyzer — a test names the three that are barred.

## The rules this page is written under

**Positioning is not taste.** `../../../marketing/research/` is where every section comes
from, and `content.ts` cites which document for which. The lead sells judgement rather than
measurement because a 163-ad scrape of the category found nobody selling it. The first refusal is
about billing because that is the largest complaint cluster in an 864-review corpus, four times the
size of accuracy, and a category tax rather than one vendor's mistake.

**The claims gate blocks the build.** Health claims (`lose weight`, `guaranteed`, `lowers
cholesterol`, `detox`…) and exclusivity claims (`the only app`, `every other app`) fail
`bun run check` and fail `docker build`. FTC substantiation is per claim; an unsubstantiated "the
only" is an *Alleinstellungsbehauptung* under §5 UWG and actionable by any competitor. The rule set
is a deliberate copy of `eait-marketer/src/claims.ts` — see the header of `claims.ts` for why, and
change both if you change either.

**Numbers on the page are numbers in the code.** The floor section quotes `KCAL_FLOOR` from
`@eait/shared`, and a test fails if the copy and the constant disagree. The whole legitimacy of that
section is that it describes what actually runs.

**Copy is fetched by nobody at runtime.** Unlike the onboarding content, this is baked at build
time. There is no admin for it, and there should not be: a marketing page is reviewed before it
ships, not edited live.

## Being found — by search engines and by answer engines

All of it is opt-in per environment, behind `EAIT__BACKEND__LANDING_INDEXABLE`, for the reason in
`config.ts`: a second host serving this same page on a real certificate is a duplicate competing
with the domain, and undoing that costs weeks.

| Emitted | What it is for |
|---|---|
| `<title>`, `description`, `rel=canonical` | The result itself. The canonical is the configured origin — never guessed. |
| `og:*` + `twitter:card` | The share card. `og:image` is absolute; a relative one silently unfurls with no image. |
| `robots.txt` + `sitemap.xml` | `Disallow: /` unless this is the build that should be found. `lastmod` is the copy-review date, not the build clock. |
| `<meta name=robots>` | Only on a build nobody may index. It does the job `robots.txt` cannot: a URL discovered elsewhere is indexable without ever being fetched. |
| `llms.txt` | The page's facts in the shape llmstxt.org proposes, assembled from the SAME constants the page renders. Through the claims gate, because copy for machines is quoted back to people verbatim. **A hedge, not a channel** — see below. |
| JSON-LD | `Organization`, `Person` (the founder), `WebSite`, `WebPage`, `FAQPage`, and — once the listing exists — `MobileApplication`. |
| `apple-itunes-app` | Safari's Smart App Banner. The id is read out of the store URL, so there is no second copy to keep in agreement. |

**Two of these buy less than they look like they buy, and both are worth keeping anyway.**
`FAQPage` earns no rich result and has not since **7 May 2026**, when Google retired the feature for
every site (it had been restricted to authoritative government and health domains since August
2023). It stays because its other job is real: it hands a retrieval system five questions with
self-contained answers, already separated from the page's prose. And `llms.txt` is read by no
production answer engine that has said so — Google has stated plainly that no Search system acts on
it, and no major lab had committed to it as of early 2026. It costs one generated file assembled
from constants that already exist, developer tooling genuinely reads it, and being right early is
free. Plan nothing on either.

**The title carries the category and the brand comes last**, because for an unknown product the
reverse is a page findable only by people who already know the name. The rendered copy uses
`nutrition`, `macro`, `calorie counter` and `food tracker` a combined zero times; the title is the
one element where that is not survivable. `photo calorie tracker` is how the category is searched
and `with a verdict` is the positioning — neither is a health claim, so `claims.ts` permits both.

**A `Person` node names the founder, and carries no address.** It is a health-adjacent page, the
category where who stands behind the words counts most, and the competitors that get cited invest
heavily here (Lose It! declares dietitian authorship inside its own `llms.txt`). We cannot claim
that and must not. What is true is that a named person builds this and is already the named data
controller. The postal address in the privacy policy stays there: the law requires it of a natural
person, and repeating it in JSON-LD would publish a home address in the format built for harvesting.

**Three things are deliberately absent.** No `offers` and no `aggregateRating`: the price is
per-territory and lives in App Store Connect, and a rating we have not received is a fabricated
one — a test fails if either appears. No `MobileApplication` node and no install banner until
`EAIT__BACKEND__LANDING_APP_STORE_URL` is set, because structured data for an app nobody can
install is the machine-readable form of the mismatch `surfaceNote` confesses in prose; `llms.txt`
carries that same sentence under **Availability** while it applies. And no `User-agent` block
naming individual AI crawlers: `Allow: /` already permits every one of them, and the opt-out
tokens (`Google-Extended`, `Applebot-Extended`) mean *allowed* by absence.

**The two shared pages are served from two hostnames, so the build gives them a canonical.**
`privacy.html` and `support.html` are the same bytes on the landing host and on the API domain —
App Store Connect requires both URLs. `canonicalised()` injects `rel=canonical` naming the landing
origin on the way out (injected, not written into the file, because the origin is configuration),
and `deploy/Caddyfile` answers the API host's copies with `X-Robots-Tag: noindex` plus a
`Disallow: /` robots.txt for that domain — which otherwise has none at all, the backend answering
404 for it.

## The mailing list

The one place this product holds an email address, and the reason it can go on saying the app does
not. `EAIT__BACKEND__LANDING_API_URL` renders the form; unset renders none, because a form whose action is missing
collects an address at the moment somebody decided to give you one and loses it.

It is a plain `<form method="post">` — the page has no JavaScript, so that is the only submit
available. The browser navigates to the response, so `POST /v1/subscribe` answers **303** and sends
it back to `/subscribed`, `/not-subscribed` or `/unsubscribed`, which are static pages in this same
bundle. The API needs `EAIT__BACKEND__LANDING_URL` for that; without it the routes answer JSON.

Anti-spam is a honeypot field plus a global daily cap. Not a CAPTCHA: that is a third-party script
on a page whose argument is that it loads none.

**The list is deliberately not joined to accounts.** `subscribers` has no foreign key to `users`,
which is what keeps "the app never stores your email" literally true — and means deleting an account
does not leave the list. That is stated on the page and in the privacy policy rather than left to be
discovered.

## Configuration

Everything environment-specific is an environment variable read by `config.ts`, which refuses rather
than guesses:

| Variable | | Refused when |
|---|---|---|
| `EAIT__BACKEND__LANDING_SITE_URL` | Canonical origin | Unset, or cleartext for anything but `localhost` |
| `EAIT__BACKEND__LANDING_APP_STORE_URL` | The listing, once it exists | Not an `apps.apple.com` URL |
| `EAIT__BACKEND__LANDING_TELEGRAM_URL` | The bot | Not a `t.me` URL |
| `EAIT__BACKEND__LANDING_SUPPORT_EMAIL` | Footer `mailto:` | Not an address |
| `EAIT__BACKEND__LANDING_UPDATED` | Copy-review date | Not `YYYY-MM-DD` |
| `EAIT__BACKEND__LANDING_INDEXABLE` | `"true"` opts this build into search indexing | Anything else means no |
| `EAIT__BACKEND__LANDING_API_URL` | Where the subscribe form posts | Unset renders no form at all |

**With neither the store link nor the bot link set, the build fails.** A landing page whose only
button goes nowhere is worse than no landing page. While the store link is empty the bot becomes the
primary action — a real thing a visitor can do — rather than a greyed-out "coming soon", and the two
swap places by themselves on the day `EAIT__BACKEND__LANDING_APP_STORE_URL` is set.

## How it is served

```
internet → Caddy (TLS, ACME)  →  nginx (static, caching, CSP)
             deploy/Caddyfile        deploy/nginx/
             + caddy/conf.d/*.caddy  deploy/Dockerfile.landing
```

Caddy keeps TLS because it already has it and because a second ACME client on the box reintroduces
the renewal that silently stopped working — the failure mode `deploy/Caddyfile` exists to avoid.
nginx owns the bytes: cache headers, gzip, the per-path Content-Security-Policy, and a `444` for any
Host it was not configured for.

The nginx service sits behind a compose **profile**, so it starts only under `--profile landing`.
That is what lets one description of the stack cover a host that serves the marketing site and a
host that serves only the API.

Ansible drives all three from one variable. `eait_landing_enabled` decides whether the profile is
passed, whether Caddy gets a site block, and whether the environment file carries the values the
image is built from; `roles/eait_app/tasks/landing.yml` is where they are kept in agreement, and it
removes the site block when the flag goes back to false so turning the page off is not an edit
somebody has to remember to revert.

### Caddy does not wait for the backend to be healthy

`depends_on` is `service_started`, not `service_healthy`, and that matters: a backend that never
comes up would otherwise take the landing page down with it — along with the privacy policy the App
Store listing points at, and the ACME challenge, so the certificate would quietly stop renewing with
nothing running to notice. The cost is a few seconds of 502 on the API during a cold boot, which is
what a deploy looks like anyway.
