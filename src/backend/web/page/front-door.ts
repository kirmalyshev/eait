import type { Lang, OnboardingWelcomeContent } from "@eait/shared";
import { fill, wholeNumbers } from "@eait/shared";
import { pageCopyFor } from "../copy.ts";
import { ctaLink, wtop } from "./board.ts";
import { escape, shell } from "./shell.ts";

/** The recorded demo's files, served by the route beside `FONT_URL_DIR`. */
export const WELCOME_URL_DIR = "/start/assets/welcome";
export const WELCOME_FILES = ["demo.mp4", "still.webp"] as const;

/** The verdict figure the recorded demo lands on — the alt text's "{kcal}" reads it (#141). */
export const WELCOME_DEMO_KCAL = 281;

/**
 * The front door — `onboarding/web/00-welcome.html`: the product's loop (a recorded run of the
 * board's demo — `assets/welcome/demo.mp4`, muted, looping), the headline, and the two doors.
 *
 * The loop is a VIDEO, not a CSS port: the board's `demo.css` animation was recorded once and the
 * file is what ships, so the page carries no choreography of its own. Under
 * `prefers-reduced-motion` the video hides and its last frame stands still — the verdict card,
 * which is the state that makes the claim, not an empty viewfinder.
 */
export function frontDoor(
  welcome: OnboardingWelcomeContent,
  hrefs: { q: string; signup: string },
  lang: Lang,
): string {
  const PAGE_COPY = pageCopyFor(lang);
  const alt = escape(fill(PAGE_COPY.welcomeDemoAlt, { kcal: wholeNumbers(lang)(WELCOME_DEMO_KCAL) }));
  return shell(PAGE_COPY.titleStart, `
${wtop()}
<div class="wcenter"><div class="wdemo">
  <div class="vdemo" role="img" aria-label="${alt}">
    <video src="${WELCOME_URL_DIR}/demo.mp4" poster="${WELCOME_URL_DIR}/still.webp"
           muted loop playsinline autoplay preload="auto" aria-hidden="true"></video>
    <img class="still" src="${WELCOME_URL_DIR}/still.webp" alt="" aria-hidden="true">
  </div>
  <div class="whead">
    <h1>${escape(welcome.lines.join(" "))}</h1>
    ${ctaLink(hrefs.q, welcome.cta)}
    ${ctaLink(hrefs.signup, welcome.signin, "s")}
  </div>
</div></div>
`, lang, "ob");
}
