// The icon set — every icon the Register P boards draw, in the workspace both clients implement.
//
// THE GEOMETRY IS TRANSCRIBED, NOT AUTHORED. The sources are `product/design/pro/` on ieat-app main
// (d3fe6ef8): the `.i-*` masks in `icons.css` — where the LAST definition of each name wins — the
// `ic-*` tab icons in `pro.css`, and the inline glyphs of `boards.py` and every board page. If the
// boards move, this file moves; do not redraw here. Where one icon was drawn twice at trivially
// different geometry (the two `x` and `send` paths, today's plate at r5 and r4.5), the dominant
// drawing stands; the slashed plates of `meal-gone` and `log-refused` are one `no-food`.
// The macro set went from the filled set to the line glyphs of ieat-app#1291's F — protein's
// drumstick, carbs' grain ear, the fat drop (satfat adds its level line) and sugar's candy are
// transcribed from that page ahead of its icons.css edit landing in the design PR.
//
// EVERY ICON IS A SINGLE-COLOUR SHAPE. Nothing here bakes a hex: the colour arrives through
// `iconSvg(name, { color })` — from the macro tokens on a macro chip, `currentColor` everywhere
// else. "line" icons are Lucide v1.48.0 path data — ISC, and the chevrons, x, search, plus and
// upload among them are Feather-derived and MIT, credited the way `img/LICENSES.md` in the design
// folder credits them — stroked at 1.75 with round caps and joins. "solid" icons are the boards'
// filled artwork (the streak chip's flame, `dots`). Brand marks are the companies'
// artwork in `BRAND_ICONS`, a separate group, never redrawn as line icons.
//
// SATURATED FAT WEARS THE FAT GLYPH. `satfat` is the fat drop plus its level line, so a caller
// rendering the saturated-fat figure does not re-encode that rule.
//
// THE SAME DATA SERVES `react-native-svg` ON THE PHONE: `iconSvg` returns a complete `<svg>` string
// (react-native-svg's `SvgXml` parses it directly); pass `color` — `currentColor` means nothing off
// the web.
//
// NO RENDERER. The only import is `palette.ts` — one of the dependency-free token modules the
// `src/shared/ui/` rule allows — and only `iconCss` reads it, for the chip colours.

import { macro, type MacroName } from "../palette.ts";

export type IconStyle = "line" | "solid";

export interface IconSpec {
  /** Inner SVG markup, verbatim from the board sheets. `currentColor` is the colour parameter. */
  body: string;
  style: IconStyle;
  viewBox: string;
}

const V = "0 0 24 24";

const line = (body: string): IconSpec => ({ body, style: "line", viewBox: V });
const solid = (body: string): IconSpec => ({ body, style: "solid", viewBox: V });
const spec = (body: string, viewBox: string): IconSpec => ({ body, style: "solid", viewBox });

// The fat drop, once — saturated fat wears it under its level line (F, ieat-app#1291).
const FAT = line(
  '<path d="M12 5.5c0 0-5.5 6-5.5 9.5a5.5 5.5 0 0 0 11 0c0-3.5-5.5-9.5-5.5-9.5z"/>',
);

// The Cal AI flame, once — a flame.fill-style glyph: an outer body with the second tongue cut
// out of it (evenodd), not a second colour. The kcal card's icon and the streak chip wear it.
const FLAME = solid(
  '<path fill="currentColor" fill-rule="evenodd" d="M13.9 1.8c2.1 3 4.7 6.1 5.2 10.1.4 3.6-2.1 7.4-6.1 9.1-.4.2-.8.3-1.3.3-4.1-.2-7.3-2.9-7.3-6.9 0-2 .8-3.8 2.1-5.2 1-1 1.7-2.1 1.9-3.9-.2 1.5.1 3 1.1 4.5 1.3-2.4 2.7-5.2 4.4-8z' +
    'M12.2 11.9c1.5 1.8 2.6 3.4 2.5 5 0 1.7-1.4 2.8-3.1 2.8-1.8 0-2.8-1.3-2.7-2.8.1-1.2.8-2.3 1.6-3.2-.1.8.1 1.6.7 2.2-.3-1.4.2-2.8 1-4z"/>',
);

export const ICONS = {
  // ── The macro set — line glyphs drawn in the macro's own ink (F, ieat-app#1291). No tint
  //    disc and no progress ring on the glyph itself; the surface frames it.
  kcal: FLAME,
  // A drumstick: the meat, the bone, and the two-lobed knuckle it needs to not read as a loupe.
  protein: line(
    '<path d="M10.4 13.6c-1.1-1.1-1.2-3.6.2-5.4 1.6-2 4.8-2.2 6.3-.7s1 4.5-1.1 5.9c-1.8 1.2-4.3 1.3-5.4.2z"/>' +
      '<path d="M10.4 13.6 8.5 15.5"/><circle cx="7.3" cy="15.3" r="1.2"/><circle cx="8.7" cy="16.7" r="1.2"/>',
  ),
  // A grain ear: the stalk with two pairs of looped grains.
  carbs: line(
    '<path d="M12 19V8"/>' +
      '<path d="M12 9Q9 9.5 9 7.5Q9 5.5 12 6.5Q12 8 12 9"/><path d="M12 9Q15 9.5 15 7.5Q15 5.5 12 6.5Q12 8 12 9"/>' +
      '<path d="M12 13Q9 13.5 9 11.5Q9 9.5 12 10.5Q12 12 12 13"/><path d="M12 13Q15 13.5 15 11.5Q15 9.5 12 10.5Q12 12 12 13"/>',
  ),
  fat: FAT,
  // Saturated fat is the fat drop with a level line across its lower third — no longer the bare
  // alias, so its spec is the drop's body plus the stroke.
  satfat: line(FAT.body + '<path d="M8.8 16.5h6.4"/>'),

  // The F hero's flame — the boards' `.fl`: a LINE flame inside the day ring, stroked like the
  // macro set so `over`/`line` can recolour it. `kcal`/`streak` stay the solid Cal AI flame.
  flame: line(
    '<path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4"/>',
  ),

  // ── The streak chip's flame (Today, the health-sync board) — the Cal AI flame ──
  streak: FLAME,

  // ── Sex ──
  male: line('<path d="M16 3h5v5"/><path d="m21 3-6.75 6.75"/><circle cx="10" cy="14" r="6"/>'),
  female: line('<path d="M12 15v7"/><path d="M9 19h6"/><circle cx="12" cy="9" r="6"/>'),
  other: line('<path d="M12 2v10"/><path d="m8.5 4 7 4"/><path d="m8.5 8 7-4"/><circle cx="12" cy="17" r="5"/>'),

  // ── Activity — armchair · dumbbell · trophy ──
  few: line(
    '<path d="M19 9V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3"/>' +
      '<path d="M3 16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v1.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5V11a2 2 0 0 0-4 0z"/>' +
      '<path d="M5 18v2"/><path d="M19 18v2"/>',
  ),
  some: line(
    '<path d="M17.596 12.768a2 2 0 1 0 2.829-2.829l-1.768-1.767a2 2 0 0 0 2.828-2.829l-2.828-2.828a2 2 0 0 0-2.829 2.828l-1.767-1.768a2 2 0 1 0-2.829 2.829z"/>' +
      '<path d="m2.5 21.5 1.4-1.4"/><path d="m20.1 3.9 1.4-1.4"/>' +
      '<path d="M5.343 21.485a2 2 0 1 0 2.829-2.828l1.767 1.768a2 2 0 1 0 2.829-2.829l-6.364-6.364a2 2 0 1 0-2.829 2.829l1.768 1.767a2 2 0 0 0-2.828 2.829z"/>' +
      '<path d="m9.6 14.4 4.8-4.8"/>',
  ),
  many: line(
    '<path d="M10 14.66V17a1 1 0 0 1-1 1 2 2 0 0 0-2 2v2"/><path d="M14 14.66V17a1 1 0 0 0 1 1 2 2 0 0 1 2 2v2"/>' +
      '<path d="M17.916 10H19.5A2.5 2.5 0 0 0 22 7.5V5a1 1 0 0 0-1-1h-3"/><path d="M4 22h16"/>' +
      '<path d="M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z"/><path d="M6.084 10H4.5A2.5 2.5 0 0 1 2 7.5V5a1 1 0 0 1 1-1h3"/>',
  ),

  // ── Pace — walk · bike · car ──
  slow: line(
    '<path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z"/>' +
      '<path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z"/>' +
      '<path d="M16 17h4"/><path d="M4 13h4"/>',
  ),
  steady: line(
    '<circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/>' +
      '<path d="M12 17.5V14l-3-3 4-3 2 3h2"/>',
  ),
  fast: line(
    '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>' +
      '<circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
  ),

  // ── Struggles ──
  consistency: line(
    '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  ),
  habits: line(
    '<path d="M11 17h.01"/>' +
      '<path d="M11.496 2c.324-.016.558.292.529.615a4 4 0 004.235 4.368.713.713 0 01.758.757 4 4 0 004.366 4.237c.323-.03.63.204.614.527a10 10 0 01-2.915 6.566A1 1 0 114.93 4.918 10 10 0 0111.496 2"/>' +
      '<path d="M12 12h.01"/><path d="M16 16h.01"/><path d="M16 3h.01"/><path d="M21 4h.01"/><path d="M21 8h.01"/><path d="M7 14h.01"/><path d="M9 8h.01"/>',
  ),
  support: line(
    '<path d="M11 14h2a2 2 0 0 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 16"/>' +
      '<path d="m14.45 13.39 5.05-4.694C20.196 8 21 6.85 21 5.75a2.75 2.75 0 0 0-4.797-1.837.276.276 0 0 1-.406 0A2.75 2.75 0 0 0 11 5.75c0 1.2.802 2.248 1.5 2.946L16 11.95"/>' +
      '<path d="m2 15 6 6"/>' +
      '<path d="m7 20 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a1 1 0 0 0-2.75-2.91"/>',
  ),
  busy: line(
    '<path d="M16 14v2.2l1.6 1"/><path d="M16 2v3"/>' +
      '<path d="M21 7.338V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h2.338"/>' +
      '<path d="M3 9h5.859"/><path d="M8 2v3"/><circle cx="16" cy="16" r="6"/>',
  ),
  ideas: line(
    '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/>' +
      '<path d="M9 18h6"/><path d="M10 22h4"/>',
  ),

  // ── Diets ──
  balanced: line(
    '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/>' +
      '<path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
  ),
  wholefood: line(
    '<path d="M15 16a1 1 0 0 0-7-7q-4 4-5.987 12.385a.5.5 0 0 0 .602.602Q11 20 15 16l-3-3"/>' +
      '<path d="M15 9q4 4 7 0-3-4-7 0 4-4 0-7-4 3 0 7"/><path d="m8 15-2.58-2.58"/>',
  ),
  mediterranean: line(
    '<path d="M21.66 17.67a1.08 1.08 0 0 1-.04 1.6A12 12 0 0 1 4.73 2.38a1.1 1.1 0 0 1 1.61-.04z"/>' +
      '<path d="M19.65 15.66A8 8 0 0 1 8.35 4.34"/><path d="m14 10-5.5 5.5"/><path d="M14 17.85V10H6.15"/>',
  ),
  flexitarian: line(
    '<path d="M7 21h10"/><path d="M12 21a9 9 0 0 0 9-9H3a9 9 0 0 0 9 9Z"/>' +
      '<path d="M11.38 12a2.4 2.4 0 0 1-.4-4.77 2.4 2.4 0 0 1 3.2-2.77 2.4 2.4 0 0 1 3.47-.63 2.4 2.4 0 0 1 3.37 3.37 2.4 2.4 0 0 1-1.1 3.7 2.51 2.51 0 0 1 .03 1.1"/>' +
      '<path d="m13 12 4-4"/><path d="M10.9 7.25A3.99 3.99 0 0 0 4 10c0 .73.2 1.41.54 2"/>',
  ),
  pescatarian: line(
    '<path d="M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.47-3.44 6-7 6s-7.56-2.53-8.5-6Z"/>' +
      '<path d="M18 12v.5"/><path d="M16 17.93a9.77 9.77 0 0 1 0-11.86"/>' +
      '<path d="M7 10.67C7 8 5.58 5.97 2.73 5.5c-1 1.5-1 5 .23 6.5-1.24 1.5-1.24 5-.23 6.5C5.58 18.03 7 16 7 13.33"/>' +
      '<path d="M10.46 7.26C10.2 5.88 9.17 4.24 8 3h5.8a2 2 0 0 1 1.98 1.67l.23 1.4"/>' +
      '<path d="m16.01 17.93-.23 1.4A2 2 0 0 1 13.8 21H9.5a5.96 5.96 0 0 0 1.49-3.98"/>',
  ),
  vegetarian: line('<path d="M12 2C8 2 4 8 4 14a8 8 0 0 0 16 0c0-6-4-12-8-12"/>'),
  vegan: line(
    '<path d="M16 8q6 0 6-6-6 0-6 6"/><path d="M17.41 3.59a10 10 0 1 0 3 3"/>' +
      '<path d="M2 2a26.6 26.6 0 0 1 10 20c.9-6.82 1.5-9.5 4-14"/>',
  ),

  // ── Medical limits ──
  health: line(
    '<path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"/>' +
      '<path d="M3.22 13H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27"/>',
  ),
  none: line('<circle cx="12" cy="12" r="10"/><line x1="9" x2="15" y1="15" y2="9"/>'),

  // ── The Health score — Home page 2 and a meal's "why this score" sheet ──
  /** Lucide leafy-green. */
  fibre: line(
    '<path d="M2 22c1.25-.987 2.27-1.975 3.9-2.2a5.56 5.56 0 0 1 3.8 1.5 4 4 0 0 0 6.187-2.353 3.5 3.5 0 0 0 3.69-5.116A3.5 3.5 0 0 0 20.95 8 3.5 3.5 0 1 0 16 3.05a3.5 3.5 0 0 0-5.831 1.373 3.5 3.5 0 0 0-5.116 3.69 4 4 0 0 0-2.348 6.155C3.499 15.42 4.409 16.712 4.2 18.1 3.926 19.743 3.014 20.732 2 22"/>' +
      '<path d="M2 22 17 7"/>',
  ),
  /** The wrapped candy (F, ieat-app#1291) — the plain version; the striped one does not read at 13 px. */
  sugar: line(
    '<rect x="7" y="8" width="10" height="8" rx="4"/>' +
      '<path d="M7 12 2.5 8.2v7.6z"/><path d="M17 12l4.5-3.8v7.6z"/>',
  ),
  /** Lucide circle-question-mark. */
  help: line('<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>'),
  /** eait's own shaker, drawn in the same style. */
  salt: line(
    '<path d="M8.5 10h7l-1 10.2a1 1 0 0 1-1 .8h-3a1 1 0 0 1-1-.8z"/>' +
      '<path d="M8.5 10a3.5 3.5 0 0 1 7 0"/>' +
      '<path d="M11 6.2v.01M13 6.2v.01M12 4.8v.01"/>',
  ),

  // ── Apple Health ──
  sync: line(
    '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>' +
      '<path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  ),

  // ── Goal rows ──
  lose: line('<path d="M3 7l6 6 4-4 8 8M15 17h6v-6"/>'),
  keep: line('<path d="M3 12h18"/><circle cx="12" cy="12" r="2.5"/>'),
  gain: line('<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>'),

  // ── Tabs ──
  home: line('<path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>'),
  progress: line('<path d="M4 19h16"/><path d="M5 15l4-4 3 3 6-7"/>'),
  chat: line('<path d="M4 6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H9l-5 4z"/>'),
  you: line('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>'),

  // ── UI chrome ──
  camera: line('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
  "camera-off": line('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/><path d="M3 3l18 18"/>'),
  "camera-switch": line('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><path d="M9 13a3 3 0 0 1 5.2-2M15 13a3 3 0 0 1-5.2 2"/>'),
  images: line('<rect x="3" y="7" width="14" height="14" rx="2"/><path d="M7 3h12a2 2 0 0 1 2 2v12"/><path d="M3 17l4-4 4 4 2-2 4 4"/>'),
  "image-off": line(
    '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-8 9"/><path d="M3 3l18 18"/>',
  ),
  upload: line('<path d="M12 16V4M6 10l6-6 6 6M4 20h16"/>'),
  "chevron-left": line('<path d="M15 5l-7 7 7 7"/>'),
  "chevron-right": line('<path d="M9 5l7 7-7 7"/>'),
  "chevron-down": line('<path d="M6 9l6 6 6-6"/>'),
  "chevron-up": line('<path d="M6 15l6-6 6 6"/>'),
  /** The F kcal hero's ring centre — the boards' stroked flame, not the Cal-AI filled one. */
  flame: line('<path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4"/>'),
  /** The kcal hero's toggle (F, ieat-app#1291): an up-arrow beside a down-arrow — "this swaps". */
  swap: line('<path d="M7 4v16M7 4 3.5 7.5M7 4l3.5 3.5M17 20V4M17 20l-3.5-3.5M17 20l3.5-3.5"/>'),
  x: line('<path d="M6 6l12 12M18 6L6 18"/>'),
  dots: solid(
    '<circle cx="6" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="18" cy="12" r="1.2" fill="currentColor"/>',
  ),
  send: line('<path d="M12 19V5M5 12l7-7 7 7"/>'),
  back: line('<path d="M19 12H5M11 5l-7 7 7 7"/>'),
  plus: line('<path d="M12 5v14M5 12h14"/>'),
  search: line('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  check: line('<path d="M5 12l5 5 9-10"/>'),
  retry: line('<path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5"/>'),
  sparkle: line('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>'),
  pencil: line('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>'),
  trash: line('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
  backspace: line('<path d="M9 6h11v12H9l-6-6z"/><path d="M12 10l4 4M16 10l-4 4"/>'),
  calendar: line('<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
  "calendar-back": line(
    '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4M14 15.5h-5M11 13l-2.5 2.5L11 18"/>',
  ),

  // ── States ──
  clock: line('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  info: line('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.01"/>'),
  "alert-circle": line('<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.01"/>'),
  /** The empty day and the past day draw a plate as two rings. */
  target: line('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/>'),
  /** "No food in that one" and a deleted meal: the plate, crossed. */
  "no-food": line('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5.5"/><path d="M4 20L20 4"/>'),
  /** The "Sending" arc while a chat turn is in flight. */
  spinner: line('<path d="M12 4a8 8 0 1 1-8 8"/>'),

  // ── Health and You ──
  /** You · basis, "At rest". */
  rest: line('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>'),
  /** You · basis, "Your days". */
  pulse: line('<path d="M3 12h4l3-7 4 14 3-7h4"/>'),
  /** Health → Body. */
  person: line('<circle cx="12" cy="5" r="2.5"/><path d="M12 8.5v6M7.5 11h9M9 21l3-6.5 3 6.5"/>'),
  /** Health → Compare. */
  bars: line('<path d="M3 20h18M6 16v-5M11 16V6M16 16v-8"/>'),
  /** Health connect: what Apple Health reads in. */
  download: line('<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>'),
  /** Health connect: what it writes out. */
  export: line('<path d="M12 21V9M7 14l5-5 5 5M5 3h14"/>'),
  /** Health connect: "Only your weight moves your plan". */
  scale: line('<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M8 10a4 4 0 0 1 8 0"/><path d="M12 10l1.6-2.2"/>'),
  heart: line(
    '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  ),
  "heart-off": line(
    '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="M3 3l18 18"/>',
  ),

  // ── Landing and pay ──
  moon: line('<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>'),
  mail: line('<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7"/>'),
  card: line('<rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20"/>'),
  lock: line('<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'),
  code: line('<path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/>'),
} satisfies Record<string, IconSpec>;

export type IconName = keyof typeof ICONS;

/**
 * The macro chip — the tinted circle a macro glyph sits on. The tint and the glyph's colour are the
 * S1 macro tokens; this is the one place the CHIP's geometry is defined, so the phone, the web
 * surfaces and the landing draw the same circle: 1.6 em across, the glyph at 58 % of it.
 */
export const MACRO_CHIP = {
  /** The chip's diameter, in em. */
  sizeEm: 1.6,
  /** The glyph's share of the chip (icons.css `center/58%`). */
  glyphShare: 0.58,
} as const;

/**
 * The companies' own marks — official artwork, kept as drawn and never rebuilt as a line icon.
 * `apple` and `github` are single-colour marks (their `currentColor` is the parameter, as with
 * icons); `google` carries its four brand colours and ignores `color`. iOS keeps its native Apple
 * button regardless.
 */
export const BRAND_ICONS = {
  /** The sign-in silhouette (`pay-signin`). */
  apple: spec(
    '<path fill="currentColor" d="M16.7 12.9c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.2-2.8.9-3.5.9-.7 0-1.9-.9-3.1-.9-1.6 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7c1.2 0 2-1.1 2.8-2.3.9-1.3 1.2-2.5 1.3-2.6 0 0-2.4-.9-2.4-3.4zM15 5.4c.6-.8 1-1.9.9-3-1 0-2.1.7-2.8 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.7 2.9-1.5z"/>',
    V,
  ),
  /** The denser mark inside the App Store badge (the landing boards). */
  "apple-badge": spec(
    '<path fill="currentColor" d="M16.4 12.6c0-2.4 2-3.6 2.1-3.7-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9s-1.9-.9-3.2-.8c-1.6 0-3.1 1-4 2.4-1.7 3-.4 7.3 1.2 9.7.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.2-.8s1.9.8 3.2.8c1.3 0 2.2-1.2 3-2.4.9-1.3 1.3-2.6 1.3-2.7 0 0-2.6-1-2.6-3.9zM14 5.4c.7-.8 1.1-1.9 1-3-1 0-2.1.7-2.8 1.5-.6.7-1.2 1.8-1 2.9 1.1.1 2.2-.6 2.8-1.4z"/>',
    V,
  ),
  /** The "G" at its native 48-box (the landing's sign-in). */
  google: spec(
    '<path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>' +
      '<path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>' +
      '<path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>' +
      '<path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>',
    "0 0 48 48",
  ),
  /** The compact "G" the paywall's sign-in draws at 24-box. */
  "google-signin": spec(
    '<path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.1h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.7 2.9c2.2-2.1 3.7-5.1 3.7-8.6z"/>' +
      '<path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.7-2.9c-1 .7-2.4 1.2-4.2 1.2-3.2 0-5.9-2.1-6.8-5l-3.9 3C3.3 21.3 7.3 24 12 24z"/>' +
      '<path fill="#FBBC05" d="M5.2 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.7.4-2.4l-3.9-3C.5 8.2 0 10 0 12s.5 3.8 1.3 5.4l3.9-3z"/>' +
      '<path fill="#EA4335" d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C17.9 1.1 15.2 0 12 0 7.3 0 3.3 2.7 1.3 6.6l3.9 3c.9-2.7 3.6-4.9 6.8-4.9z"/>',
    V,
  ),
  /** The landing's source link. */
  github: spec(
    '<path fill="currentColor" d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"/>',
    "0 0 16 16",
  ),
  /** eait's own mark: the app icon's bowl on its green tile, as the landing favicon draws it (#1139). */
  eait: spec(
    '<rect width="1024" height="1024" rx="224" fill="#1E6B3C"/>' +
      '<g transform="matrix(1.4 0 0 1.4 -241.2 -196.4)">' +
      '<circle cx="410" cy="506" r="92" fill="#5BB37E"/><circle cx="614" cy="500" r="96" fill="#D9483F"/><circle cx="512" cy="456" r="104" fill="#D48A1C"/>' +
      '<path d="M292 536H732A220 204 0 0 1 292 536Z" fill="#FFFFFF"/><rect x="432" y="728" width="160" height="34" rx="17" fill="#FFFFFF"/>' +
      '<path d="M560 420L740 262M600 438L772 300" stroke="#1E6B3C" stroke-width="50" stroke-linecap="round"/>' +
      '<path d="M560 420L740 262M600 438L772 300" stroke="#FFFFFF" stroke-width="22" stroke-linecap="round"/></g>',
    "0 0 1024 1024",
  ),
} satisfies Record<string, IconSpec>;

export type BrandName = keyof typeof BRAND_ICONS;

export interface IconOpts {
  /** Both dimensions in px. Unset, the svg carries none and the stylesheet sizes it. */
  size?: number;
  /**
   * The colour a line icon strokes and a `currentColor` fill takes. Off the web `currentColor`
   * means nothing — pass it. `google` carries its own brand colours and ignores this.
   */
  color?: string;
  /** An extra class on the `<svg>`. */
  class?: string;
  /**
   * The stroke weight of a line icon — 1.75 at text size. The boards draw the big state glyphs
   * lighter (1.25–1.5 at 44–64 px) so they stay light; this is how they get there. Ignored by
   * solid icons, whose artwork carries no scalable stroke.
   */
  strokeWidth?: number;
  /**
   * When the icon IS the content — a button that is only an icon — the accessible name goes here,
   * and the element is exposed (`role="img"`) instead of hidden. Decorative beside labelled text is
   * the default, the same rule `spudSvg` keeps: never the only carrier of a piece of information.
   */
  label?: string;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

function svg(spec: IconSpec, opts: IconOpts): string {
  const attrs =
    (spec.style === "line"
      ? ` fill="none" stroke="currentColor" stroke-width="${Number(opts.strokeWidth ?? 1.75)}" stroke-linecap="round" stroke-linejoin="round"`
      : ``) +
    (opts.size !== undefined ? ` width="${Number(opts.size)}" height="${Number(opts.size)}"` : "") +
    (opts.class ? ` class="${esc(opts.class)}"` : "") +
    (opts.label
      ? ` role="img" aria-label="${esc(opts.label)}"`
      : ` aria-hidden="true" focusable="false"`);
  const out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${spec.viewBox}"${attrs}>${spec.body}</svg>`;
  return opts.color ? out.replaceAll("currentColor", esc(opts.color)) : out;
}

/**
 * One icon as an `<svg>` string — the boards' markup, so a page, `/start`, the landing and the
 * phone's `SvgXml` all draw the same glyph.
 */
export function iconSvg(name: IconName, opts: IconOpts = {}): string {
  return svg(ICONS[name], opts);
}

/** A brand mark as an `<svg>` string — the companies' artwork, recolouring NOT offered. */
export function brandSvg(name: BrandName, opts: Omit<IconOpts, "color" | "strokeWidth"> = {}): string {
  return svg(BRAND_ICONS[name], opts);
}

// ── The web classes ─────────────────────────────────────────────────────────────────────────────
// The boards' own mechanism (icons.css): an `.ico` element paints `currentColor` through a mask
// whose shape is this icon's data, and a macro chip is the glyph drawn in its ink on a circle in
// its tint. The classes are GENERATED here from the same ICONS, because two web surfaces (/start
// and the app shell) interpolate one string — hand-writing them per surface is the duplication
// this issue exists to remove. The colours come from `palette.macro` (S1): baked ink would be a
// second copy, and dark mode's inks differ.

// Which chip wears which macro's ink and tint. Saturated fat wears fat's — the alias is the rule.
const CHIPS = { kcal: "kcal", protein: "protein", carbs: "carbs", fat: "fat", satfat: "fat" } as const satisfies Record<
  string,
  MacroName
>;

const uri = (s: string) => `url("data:image/svg+xml,${encodeURIComponent(s)}")`;

/**
 * One glyph as a standalone `<svg>` for a mask or a chip. A mask reads only the alpha channel, so
 * an unset colour stays `currentColor` (black in an image document, the shape opaque either way);
 * a chip passes its macro ink.
 */
const glyphSvg = (spec: IconSpec, color?: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${spec.viewBox}"${
    spec.style === "line"
      ? ` fill="none" stroke="${color ?? "currentColor"}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"`
      : ""
  }>${color ? spec.body.replaceAll("currentColor", color) : spec.body}</svg>`;

const chipRule = (name: string, ink: string, tint: string): string =>
  `.ico.i-${name}{-webkit-mask:none;mask:none;background:${tint} ${uri(glyphSvg(ICONS[name as IconName], ink))} center/${
    MACRO_CHIP.glyphShare * 100
  }% no-repeat;border-radius:50%;width:${MACRO_CHIP.sizeEm}em;height:${MACRO_CHIP.sizeEm}em;vertical-align:-.45em}`;

/**
 * The boards' icon CSS as one string: `.ico` plus an `.i-<name>` mask class for every icon, and
 * the five macro chips — light values unscoped, dark under the same `:root[data-theme="dark"]`
 * the surfaces' `darkVars` live under. Interpolated by `/start` and the web shell, and nowhere
 * else written.
 */
export function iconCss(): string {
  const rules = [
    `.ico{display:inline-block;width:1em;height:1em;flex:0 0 auto;vertical-align:-.14em;background:currentColor;-webkit-mask:var(--ic) center/contain no-repeat;mask:var(--ic) center/contain no-repeat}`,
  ];
  for (const name of Object.keys(ICONS) as IconName[]) {
    rules.push(`.i-${name}{--ic:${uri(glyphSvg(ICONS[name]))}}`);
  }
  for (const [name, m] of Object.entries(CHIPS)) {
    rules.push(chipRule(name, macro.light[m].ink, macro.light[m].tint));
  }
  for (const [name, m] of Object.entries(CHIPS)) {
    rules.push(`:root[data-theme="dark"] ${chipRule(name, macro.dark[m].ink, macro.dark[m].tint)}`);
  }
  return rules.join("\n");
}
