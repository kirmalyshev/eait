// Spud, on the web.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// WHERE HE IS ALLOWED TO BE, AND WHY IT IS STILL NOT EVERYWHERE
//
// `src/mobile/lib/components/mascot.tsx` states his rule in the app: he makes a questionnaire
// about your body feel asked by someone, he says "roughly is fine", and he tells you when the
// app refused something and why. The category's failure mode is REWARD THEATRE — the loudest
// complaint in the incumbent's review corpus is "a noisy, badge collecting, pop up heavy game
// that happens to involve some food tracking" — and a landing page that sprinkled a cartoon
// potato over every section would be exactly that, on the surface where a skeptic decides
// whether this is a serious instrument.
//
// The rule is therefore not a count (it was "three times and no more" until 2026-08-31, when the
// owner asked for the mascot's variations). EVERY APPEARANCE IS A JOB HE ALREADY DOES IN THE APP,
// and an appearance that cannot name its job does not ship:
//
//   • `idle`, INSIDE the hero instrument — the correction note under the meal card is his line
//     in the product, so the drawn phone shows who does the talking there.
//   • `think`, beside ACCURACY — being corrected is his job; the section is about arguing with him.
//   • `care`, beside THE FLOOR — naming a refusal and why is his actual role.
//   • `wave`, beside THE FORM — the page's one question, and making a question feel asked by
//     someone is the reason he exists.
//   • `wave`/`happy`/`think`/`care` on the outcome pages — a human moment, no product claim.
//
// Still banned: `cheer` (he never congratulates — sparkles and both arms up is reward theatre
// in one drawing, and its sparkles are accent-coloured on a page that spends the accent once),
// and any appearance whose only job is "this section felt bare". Beside the instrument in the
// hero grid he is still out: inside the device he is the product's own voice; pasted next to
// it he is a mascot on an instrument.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// WHY THE GEOMETRY IS COPIED RATHER THAN IMPORTED
//
// `mascot.tsx` is a React Native component: it imports `react-native-svg` and `reanimated`, and the
// backend workspace has no business resolving either. So the paths are transcribed — and a test
// reads that file and fails if the body outline, the sprout or any mood's mouth has drifted from
// it, the same guard `tokens.ts` has against the palette. A potato that is subtly the wrong potato
// on the page immediately before the App Store screenshots is worse than no potato.

/** The moods this page uses. The app has six; the one still missing is `cheer`, on purpose. */
export type LandingMood = "care" | "wave" | "think" | "idle" | "happy";

const SKIN_LIGHT = "#E8BE83";
const SKIN_DARK = "#C08B4E";
const SKIN_SPOT = "#9E6B34";
const FACE = "#3A2612";
const LEAF = "#86C96B";
const LEAF_DARK = "#5DA24F";
const BLUSH = "#EF8B6B";

/**
 * The potato's outline. Verbatim from `mascot.tsx`.
 *
 * WIDER THAN TALL, AND LUMPY — that file's note is worth repeating because it is the thing that
 * breaks: the first version was near-circular and everyone read it as a peach, because the leaf did
 * the work an apple stem does.
 */
export const BODY =
  "M8 60 C8 44 16 34 30 31 C42 28 54 29 66 28 C84 26 100 33 105 46 " +
  "C110 58 110 68 106 76 C100 87 88 95 74 96 C58 97 44 96 34 92 C18 85 8 74 8 60 Z";

/** Top-left sheen. Sells "rounded object" more cheaply than a radial gradient does. */
export const SHEEN =
  "M26 46 C32 36 44 32 55 33 C42 36 32 43 28 53 C25 60 25 65 26 70 C21 62 22 53 26 46 Z";

export const MOUTHS: Record<LandingMood, string> = {
  care: "M51 75 Q59 80 67 75",
  wave: "M46 71 Q59 84 72 71",
  think: "M52 77 Q59 72 68 76",
  // The resting face and the warm one. `happy` is `wave`'s mouth without the arm — that is how the
  // app itself defines it — and both take the default eyes: no lids, no brows, no pupil offset.
  idle: "M50 73 Q59 80 68 73",
  happy: "M46 71 Q59 84 72 71",
};

/**
 * Each mood's eyes.
 *
 * `soft` is lowered lids, and three points of eyelid is the whole difference between "kind" and
 * "wary" — which is the difference between the floor reading as care and as a scold.
 */
function eyes(mood: LandingMood): string {
  const dx = mood === "think" ? -1.6 : 0;
  const dy = mood === "think" ? -2.2 : 0;
  const ry = mood === "care" ? 5.4 : 6.6;
  const lids =
    mood === "care"
      ? `<g stroke="${FACE}" stroke-width="2.6" stroke-linecap="round" fill="none" opacity=".85">` +
        `<path d="M40 51 Q47 48 54 51"/><path d="M64 51 Q71 48 78 51"/></g>`
      : "";
  // Grouped so the stylesheet can blink him — the app blinks on a 4.2s timer (mascot.tsx), and a
  // scaleY squash on the whole eye group is the closest a page with no script can come to its two
  // discrete frames. Care's lids squash with the eyes, which reads fine at these sizes.
  return (
    `<g class="spud-eyes">` +
    `<ellipse cx="47" cy="57" rx="6.2" ry="${ry}" fill="${FACE}"/>` +
    `<ellipse cx="71" cy="57" rx="6.2" ry="${ry}" fill="${FACE}"/>` +
    `<circle cx="${49 + dx}" cy="${54.6 + dy}" r="2.1" fill="#FFFFFF" opacity=".92"/>` +
    `<circle cx="${73 + dx}" cy="${54.6 + dy}" r="2.1" fill="#FFFFFF" opacity=".92"/>` +
    lids +
    `</g>`
  );
}

/**
 * Spud, as inline SVG.
 *
 * Inline rather than an `<img>`, for two reasons: the CSP is `img-src 'self'` and an inline element
 * is not subject to it at all, and a mascot drawn in the document recolours with the page instead of
 * being a bitmap that has to be regenerated when the palette moves.
 *
 * `aria-hidden`, always. He is decoration beside copy that already says everything he does — a
 * screen reader announcing "smiling potato" between a heading and its paragraph is noise, not
 * access. The one thing he must never be is the only carrier of a piece of information.
 */
export function spudSvg(mood: LandingMood, gradientId: string): string {
  // The wave arm goes BEHIND the body, so a stubby limb reads as attached rather than pasted on.
  const arm =
    mood === "wave"
      ? `<path d="M102 58 C114 52 119 39 115 31" stroke="${SKIN_DARK}" stroke-width="9" ` +
        `stroke-linecap="round" fill="none"/>`
      : "";

  const brows =
    mood === "think"
      ? `<g stroke="${FACE}" stroke-width="2.8" stroke-linecap="round" fill="none" opacity=".9">` +
        `<path d="M39 45 Q47 40 55 44"/><path d="M63 44 Q71 39 79 43"/></g>`
      : "";

  return (
    `<svg class="spud" viewBox="0 0 120 120" aria-hidden="true" focusable="false" ` +
    `xmlns="http://www.w3.org/2000/svg">` +
    `<defs><linearGradient id="${gradientId}" x1="0" y1="0" x2="0.6" y2="1">` +
    `<stop offset="0" stop-color="${SKIN_LIGHT}"/><stop offset="1" stop-color="${SKIN_DARK}"/>` +
    `</linearGradient></defs>` +
    arm +
    // The sprout. One leaf and a stem — any more and he reads as a turnip.
    `<path d="M60 31 C60 22 64 17 71 16" stroke="${LEAF_DARK}" stroke-width="3" fill="none" stroke-linecap="round"/>` +
    `<path d="M61 27 C68 16 83 15 88 20 C84 29 69 34 61 27 Z" fill="${LEAF}"/>` +
    `<path d="M61 27 C69 24 79 22 88 20" stroke="${LEAF_DARK}" stroke-width="1.4" fill="none" opacity=".7"/>` +
    `<path d="${BODY}" fill="url(#${gradientId})"/>` +
    `<path d="${SHEEN}" fill="#FFFFFF" opacity=".16"/>` +
    // Potato eyes — the dimples, not the face's. Off-centre so they read as texture.
    `<g fill="${SKIN_SPOT}" opacity=".32">` +
    `<ellipse cx="24" cy="50" rx="3.4" ry="2.4"/>` +
    `<ellipse cx="92" cy="78" rx="3" ry="2.1"/>` +
    `<ellipse cx="52" cy="88" rx="2.6" ry="1.8"/></g>` +
    brows +
    `<ellipse cx="31" cy="72" rx="8" ry="4.6" fill="${BLUSH}" opacity=".34"/>` +
    `<ellipse cx="87" cy="72" rx="8" ry="4.6" fill="${BLUSH}" opacity=".34"/>` +
    eyes(mood) +
    `<path d="${MOUTHS[mood]}" fill="none" stroke="${FACE}" stroke-width="3.6" stroke-linecap="round"/>` +
    `</svg>`
  );
}

/** The file the geometry is transcribed from, relative to the repository root. */
export const MASCOT_SOURCE = "src/mobile/lib/components/mascot.tsx";
