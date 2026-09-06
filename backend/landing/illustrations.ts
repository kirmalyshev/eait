// The three drawings above THE PROBLEM, one per row.
//
// Drawn in the page's own language rather than illustrated: the plate seen from above (the app
// icon), the meal card the hero phone shows, and a target line with a week of bars under it. Each
// one is the row's sentence with the words taken out, so a reader who scrolls gets the argument
// from the pictures alone.
//
// INLINE, LIKE SPUD, for the same two reasons: `img-src 'self'` does not govern an inline element,
// and a drawing in the document takes its colours from the stylesheet — every fill and stroke here
// is a CLASS resolved in styles.ts to a token, so the three recolour with the theme and never carry
// a literal the palette test would have to know about. No accent anywhere in them: the accent is
// the one action's, and a drawing that borrowed it would be a second thing on the page in the
// button's colour.
//
// `aria-hidden`, always. Each sits above a title and a paragraph that say everything it does.

const SVG_OPEN = (id: string) =>
  `<svg class="ill ill-${id}" viewBox="0 0 240 150" aria-hidden="true" focusable="false" ` +
  `xmlns="http://www.w3.org/2000/svg">`;

/**
 * Portions are a guess: a plate, one serving on it, the larger serving it might have been drawn
 * as a ghost around it, and the question the diary never answers.
 */
function portions(): string {
  return (
    SVG_OPEN("portions") +
    // The plate, from above — the app's own mark.
    `<circle cx="104" cy="78" r="58" class="ill-fill ill-line"/>` +
    `<circle cx="104" cy="78" r="46" class="ill-line ill-thin"/>` +
    // The serving as logged, sitting off-centre the way food does.
    `<path d="M78 84 C74 64 92 52 110 56 C126 60 132 76 126 92 C118 108 86 106 78 84 Z" class="ill-food"/>` +
    // What it might have been: one ghost, a size up and pushed to the rim.
    `<path d="M70 86 C64 62 92 48 114 52 C134 56 140 76 132 94 C122 112 82 110 70 86 Z" class="ill-line ill-dash"/>` +
    // The question, on a tag.
    `<rect x="164" y="54" width="54" height="30" rx="15" class="ill-fill ill-line"/>` +
    `<text x="191" y="75" text-anchor="middle" class="ill-text ill-label">150 g?</text>` +
    `</svg>`
  );
}

/**
 * The judging is left to you: the meal card as a diary writes it — a number, then nothing. The
 * three slots where the verdict pills sit on eait's card are drawn empty.
 */
function judging(): string {
  return (
    SVG_OPEN("judging") +
    `<rect x="44" y="22" width="152" height="106" rx="16" class="ill-fill ill-line"/>` +
    `<text x="62" y="60" class="ill-text ill-num">640</text>` +
    `<text x="126" y="60" class="ill-muted ill-label">kcal</text>` +
    `<line x1="62" y1="76" x2="178" y2="76" class="ill-line ill-thin"/>` +
    // The verdict slots, empty: this is the whole picture.
    `<rect x="62" y="90" width="40" height="18" rx="9" class="ill-line ill-dash ill-thin"/>` +
    `<rect x="108" y="90" width="40" height="18" rx="9" class="ill-line ill-dash ill-thin"/>` +
    `<rect x="154" y="90" width="24" height="18" rx="9" class="ill-line ill-dash ill-thin"/>` +
    `</svg>`
  );
}

/**
 * One guessed dinner costs the week: seven days under a target line, six of them fine and the
 * sixth over it. The bars sit on the same scale the hero card draws the floor on.
 */
function week(): string {
  const target = 72;
  const heights = [40, 46, 38, 44, 42, 96, 36];
  const bars = heights
    .map((h, i) => {
      const x = 40 + i * 24;
      const over = h > target;
      return `<rect x="${x}" y="${130 - h}" width="14" height="${h}" rx="4" class="${over ? "ill-over" : "ill-bar"}"/>`;
    })
    .join("");
  return (
    SVG_OPEN("week") +
    bars +
    `<line x1="30" y1="${130 - target}" x2="210" y2="${130 - target}" class="ill-target ill-dash"/>` +
    `<text x="30" y="${130 - target - 7}" class="ill-muted ill-label">target</text>` +
    `</svg>`
  );
}

/** The drawing for a row of THE PROBLEM, by position. Rows beyond the third get nothing. */
export function problemIllustration(index: number): string {
  return [portions, judging, week][index]?.() ?? "";
}
