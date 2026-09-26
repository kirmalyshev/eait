// Spud, as inline SVG — the one drawing every web surface shares.
//
// WHY THE GEOMETRY IS COPIED RATHER THAN IMPORTED. `src/mobile/lib/components/mascot.tsx` is a React
// Native component: it imports `react-native-svg` and `reanimated`, and no server has any business
// resolving either. So the paths are transcribed here, in the workspace both sides implement, and a
// test that owns the mobile file reads it and fails if the body outline, the sprout or any mood's
// mouth has drifted from it. A potato that is subtly the wrong potato on the page immediately
// before the App Store screenshots is worse than no potato.
//
// Where he is allowed to appear, and why not everywhere, is each surface's own rule — the landing
// states its in `src/landing/mascot.ts`.

/**
 * The moods the web surfaces draw. `cheer` is deliberately not one of them — sparkles and both
 * arms up is reward theatre in one drawing. `joy` (v5) IS one: it is the same wide open smile the
 * app's `cheer` draws, with default eyes and none of the theatre.
 */
export type MascotMood = "care" | "wave" | "think" | "idle" | "happy" | "joy";

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

export const MOUTHS: Record<MascotMood, string> = {
  care: "M51 75 Q59 80 67 75",
  wave: "M46 71 Q59 84 72 71",
  think: "M52 77 Q59 72 68 76",
  // The resting face and the warm one. `happy` is `wave`'s mouth without the arm — that is how the
  // app itself defines it — and both take the default eyes: no lids, no brows, no pupil offset.
  idle: "M50 73 Q59 80 68 73",
  happy: "M46 71 Q59 84 72 71",
  // The wide open smile — verbatim `mascot.tsx`'s `cheer` mouth. It is a FILLED shape, not a
  // stroke: the only mood whose mouth is drawn that way, which is what `MOUTH_FILLED` says.
  joy: "M45 69 Q59 89 73 69 Q59 76 45 69 Z",
};

/** The mouths drawn filled rather than stroked — the open smile. */
const MOUTH_FILLED = new Set<MascotMood>(["joy"]);

/**
 * Each mood's eyes.
 *
 * `soft` is lowered lids, and three points of eyelid is the whole difference between "kind" and
 * "wary" — which is the difference between the floor reading as care and as a scold.
 */
function eyes(mood: MascotMood): string {
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
export function spudSvg(mood: MascotMood, gradientId: string): string {
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
    (MOUTH_FILLED.has(mood)
      ? `<path d="${MOUTHS[mood]}" fill="${FACE}"/>`
      : `<path d="${MOUTHS[mood]}" fill="none" stroke="${FACE}" stroke-width="3.6" stroke-linecap="round"/>`) +
    `</svg>`
  );
}
