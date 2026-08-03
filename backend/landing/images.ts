// The page's raster images, drawn from the same two shapes as the app icon.
//
// `scripts/make-icons.ts` generates the home-screen icon from `theme.ts` so the icon cannot drift
// from the accent the app renders. This is the same argument one surface further out: a tab icon
// and a share card that were exported from a design file once, in 2026, are the two images most
// likely to still be the old brand in a year.
//
// WHY RASTER AT ALL, when `render.ts` already emits an SVG favicon:
//
//   • `/favicon.ico` — a browser handed an explicit `<link rel="icon">` does not request it, but a
//     bookmark, an RSS reader, a link unfurler and every "add to home screen" path still do.
//   • `apple-touch-icon.png` — iOS ignores SVG here, and this page's entire audience is on iPhone.
//   • `og.png` — no social platform renders an SVG share card. Declaring `summary_large_image`
//     with no image, which is what this page did until now, produces a blank card: the one place
//     the link is seen by people who have not decided to visit yet.
//
// Text is deliberately absent from the share card. Drawing type would need a font rasteriser, and
// the alternative — a card whose words are baked in — goes stale the moment the copy changes while
// `og:title` and `og:description` next to it do not.

import { encodePng, type Rgb } from "../../../scripts/png.ts";
import { color } from "./tokens.ts";

function rgb(hex: string): Rgb {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

const BG = rgb(color.bg);
const ACCENT = rgb(color.accent);

/**
 * Coverage of the mark at one point, in 0..1, for a mark of `size` drawn at (`ox`, `oy`).
 *
 * The geometry is `scripts/make-icons.ts` verbatim — a heavy ring seen from above with a dot above
 * it, the letter "i" read as a plate — authored at 1024 and scaled. Supersampled rather than
 * rasterised, because `SS × SS` point-in-shape tests per pixel is what gives the ring a clean edge
 * and is cheaper than carrying an image library for two circles.
 */
const SS = 4;

function coverage(px: number, py: number, size: number, ox = 0, oy = 0): number {
  const u = size / 1024;
  const ringCx = ox + 512 * u, ringCy = oy + 600 * u, ringOuter = 300 * u, ringInner = 228 * u;
  const dotCx = ox + 512 * u, dotCy = oy + 190 * u, dotR = 76 * u;

  let hits = 0;
  for (let sy = 0; sy < SS; sy++) {
    for (let sx = 0; sx < SS; sx++) {
      const x = px + (sx + 0.5) / SS;
      const y = py + (sy + 0.5) / SS;
      const dr = Math.hypot(x - ringCx, y - ringCy);
      if (dr <= ringOuter && dr >= ringInner) { hits++; continue; }
      if (Math.hypot(x - dotCx, y - dotCy) <= dotR) hits++;
    }
  }
  return hits / (SS * SS);
}

/** The mark on the page background, filling a square. Opaque — no alpha channel anywhere here. */
export function markPng(size: number): Uint8Array {
  const out = new Uint8Array(size * size * 3);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const a = coverage(x, y, size);
      const i = (y * size + x) * 3;
      out[i] = Math.round(BG.r + (ACCENT.r - BG.r) * a);
      out[i + 1] = Math.round(BG.g + (ACCENT.g - BG.g) * a);
      out[i + 2] = Math.round(BG.b + (ACCENT.b - BG.b) * a);
    }
  }
  return encodePng(size, size, 3, out);
}

/** The Open Graph card: 1200×630, the mark centred, nothing else. */
export function ogPng(): Uint8Array {
  const W = 1200, H = 630, MARK = 300;
  const ox = (W - MARK) / 2;
  // Optically centred rather than geometrically: the mark's ink sits low in its own square (the
  // ring's centre is at y=600 of 1024), so centring the BOX leaves it looking dropped.
  const oy = (H - MARK) / 2 - MARK * 0.06;

  const out = new Uint8Array(W * H * 3);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const inside = x >= ox && x < ox + MARK && y >= oy && y < oy + MARK;
      const a = inside ? coverage(x, y, MARK, ox, oy) : 0;
      const i = (y * W + x) * 3;
      out[i] = Math.round(BG.r + (ACCENT.r - BG.r) * a);
      out[i + 1] = Math.round(BG.g + (ACCENT.g - BG.g) * a);
      out[i + 2] = Math.round(BG.b + (ACCENT.b - BG.b) * a);
    }
  }
  return encodePng(W, H, 3, out);
}

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

/**
 * A `.ico` containing one PNG.
 *
 * The ICO container is a six-byte header, one sixteen-byte directory entry, and the image. The
 * image may be a BMP or — since Vista, and in every browser this page will ever be opened in — a
 * PNG, which is why the whole file is thirty bytes of preamble around `markPng`.
 *
 * 64×64 rather than 32: the entry's width and height fields are single BYTES, so 256 is encoded as
 * 0 and anything above that cannot be expressed at all. 64 is large enough for a bookmark bar on a
 * retina display and small enough to stay under a kilobyte.
 */
export function faviconIco(): Uint8Array {
  const SIZE = 64;
  const png = markPng(SIZE);
  const out = new Uint8Array(6 + 16 + png.length);
  const view = new DataView(out.buffer);

  view.setUint16(0, 0, true);          // reserved
  view.setUint16(2, 1, true);          // 1 = icon (2 would be a cursor)
  view.setUint16(4, 1, true);          // one image in this file

  out[6] = SIZE;                       // width  — 0 would mean 256
  out[7] = SIZE;                       // height
  out[8] = 0;                          // palette size; 0 for truecolour
  out[9] = 0;                          // reserved
  view.setUint16(10, 1, true);         // colour planes
  view.setUint16(12, 24, true);        // bits per pixel — markPng is RGB, no alpha
  view.setUint32(14, png.length, true);
  view.setUint32(18, 22, true);        // the image starts immediately after this entry

  out.set(png, 22);
  return out;
}
