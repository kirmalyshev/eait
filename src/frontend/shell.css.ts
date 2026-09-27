// The shell's own styles — the frame, and the primitives every surface shares.
//
// THE SPLIT (#87): `server/index.ts` keeps ONE `<style>` block, composed of this file's string
// plus each surface's `screens/<surface>.css.ts`, so the redesign's W-packages own their surface's
// styles the way they own its screen — and never queue on one stylesheet. The generated parts
// (palette tokens, the Montserrat faces, the motion vocabulary, the icon set) stay interpolations
// in `server/index.ts`: they come from `shared`, never retyped here.

export const shellCss = `
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink);
  font: 15px/1.45 var(--display); }
/* FOCUS IS VISIBLE (#53): a 2px ring in the text ink, offset 2px so it stands clear of the
   control's own border. --text on these grounds is far past the 3:1 a focus indicator needs —
   and on the accent surfaces, the offset puts the ring on the light around them. */
:is(a, button, input, select, textarea):focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }
/* NUMBERS IN THE ONE FACE, tabular so a column of them holds still. The third face is gone: the
   boards set figures in the main face and so does this page. The unit still sits OUTSIDE the span —
   its space is the face's own. */
.num { font-variant-numeric: tabular-nums; }

/* THE FRAME (Register P's web shell, web/today.html): a slim white bar on the hairline — the
   wordmark, then the one row the app navigates by — over a quiet column on the paper ground.
   wmain is the centred content; one is the single-column form every surface takes until W4
   draws Home's two. The right side of the bar is each screen's own (W4's date, W7's nothing). */
#app { min-height: 100dvh; display: flex; flex-direction: column; }
.wtop { display: flex; align-items: center; gap: 28px; padding: 0 40px; height: 64px;
  background: var(--surface); border-bottom: 1px solid var(--hair); }
/* The wordmark: eait in the register's weight, Spud at 20px on the accent tint — a signature,
   not the app icon (DIRECTION §6). */
.wtop .brand { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 17px;
  letter-spacing: -.02em; margin-right: 12px; }
.wtop .wm { width: 20px; height: 20px; border-radius: 50%; background: var(--accent-tint);
  display: flex; align-items: center; justify-content: center; }
.wtop .wm svg { width: 78%; height: 78%; display: block; }
/* The tabs are TEXT, never pills: muted at rest, ink and underlined on the screen they name. The
   link fills the bar's height — the underline lands on its bottom edge, and the box is the tap
   target (#53). */
.wnav { align-self: stretch; display: flex; gap: 22px; font-size: 14px; font-weight: 500; }
.wnav a { display: flex; align-items: center; justify-content: center;
  min-width: 44px; color: var(--muted); text-decoration: none; white-space: nowrap; }
.wnav a.on { color: var(--ink); font-weight: 600; }
/* The label in its own span, stretched to the link's height: the underline it carries spans the
   WORD, not the link's 44px box — the boards underline the label, and a box-wide rule overhangs it. */
.wnav a .lbl { position: relative; align-self: stretch; display: flex; align-items: center; }
.wnav a.on .lbl::after { content: ""; position: absolute; left: 0; right: 0; bottom: -2px; height: 2px;
  /* The boards' mark: the accent covers the header's bottom hairline and runs 1px below it
     (pro.css's a.on::after), so the active tab reads as a cut in the line, not a line above it. */
  background: var(--accent); }
/* Each screen's own right side of the bar — W4's date with its arrows on Home, nothing on Chat.
   The shell provides the slot; a screen fills frame.bar or leaves it empty. */
.wtop .wr { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 500; }
.wtop .wr:empty { display: none; }
.wtop .sp { flex: 1; }
/* THE COLUMN: pro.css's wmain verbatim — a grid, because W4's Home draws a second 360px column;
   one is the single-column form every surface takes until then. wcol's 16px gap is the board's
   spacing between a screen's ROOT blocks; inside a screen, the blocks' own margins still space
   them, as they did. */
.wmain { flex: 1; display: grid; grid-template-columns: 1fr 360px; gap: 24px;
  padding: 28px 40px; max-width: 1160px; width: 100%; margin: 0 auto; overflow: hidden; }
.wmain.one { grid-template-columns: 1fr; max-width: 820px; }
.wcol { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
@media (max-width: 760px) {
  .wtop { padding: 0 16px; gap: 16px; }
  .wtop .brand { margin-right: 0; }
  .wnav { gap: 14px; }
  .wmain { padding: 20px 16px 32px; grid-template-columns: 1fr; }
}

h1, h2 { margin: 0 0 .5rem; font-weight: 700; letter-spacing: -.02em; }
h2 { font-size: 17px; }
.muted { color: var(--muted); }
.lab { font-size: 12px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
.big { margin: .25rem 0 0; display: flex; align-items: baseline; gap: 8px; }
.hero { font-size: 44px; font-weight: 700; letter-spacing: -1.5px; line-height: 1.05; }
.big.warn .hero { color: var(--warn); }
/* THE GUESS, AND NOTHING ELSE IS EVER THIS COLOUR. Immediately before the figure it governs, and
   outside the figure's own span. */
.about { color: var(--warn); font-weight: 700; }
/* THE FLOOR, AND NOTHING ELSE. Once per screen, as text, and never a tick on a scale. */
.floor { font-size: 12px; font-weight: 700; letter-spacing: .09em; text-transform: uppercase; color: var(--care); }

/* The register's card, token by token (pro.css): a white surface on the paper, r-card, the shared
   shadow — the hairline is not drawn; a surface that still needs one is .card.flat there. The
   margin-bottom stays: the column's gap spaces a screen's ROOT children, and a screen's own cards
   still space each other the way they did. */
.card { padding: 16px; background: var(--surface); border-radius: var(--r-card); margin-bottom: 14px;
  box-shadow: var(--shadow); }

.primary { display: inline-block; margin-top: .75rem; padding: 0 18px; height: 44px; line-height: 44px;
  border-radius: 999px; background: var(--accent); color: var(--accent-ink); text-decoration: none;
  font-size: 13px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }

.error, .notice { color: var(--bad); }
.notice { margin: 1rem 0 0; }

/* THE ONE COMPOSER, on Chat and on Today alike: "Add a photo" in front of the native input, the
   field, the round send. It stays at the foot of the column while the thread scrolls under it —
   paper behind it now that the column is the paper. */
.comp { margin-top: 14px; position: sticky; bottom: 0; background: var(--bg); padding: 10px 0 4px; }
.comp-row { display: flex; align-items: center; gap: 8px; }
.comp .add { flex: 0 0 auto; min-height: 44px; padding: 0 16px; border-radius: 999px; cursor: pointer;
  border: 1px solid var(--line); background: var(--surface); color: var(--ink);
  font: 700 13px var(--display); }
.comp .fld { flex: 1 1 8rem; min-width: 0; font: inherit; font-size: 16px; padding: 11px 16px; border-radius: 999px;
  min-height: 44px;
  border: 1px solid var(--line); color: var(--ink); background: var(--surface); }
.comp .send { flex: 0 0 44px; width: 44px; height: 44px; border-radius: 50%; border: 0; cursor: pointer;
  background: var(--accent); color: var(--accent-ink); font: inherit; font-size: 18px; font-weight: 700;
  display: inline-flex; align-items: center; justify-content: center; }
.comp-note { display: flex; align-items: center; gap: 6px; }
.comp-note .count { font-size: 12px; color: var(--muted); white-space: nowrap; }
/* The composer's cancel is the same small text button a thread line's actions wear. */
.act { background: none; border: 0; color: var(--muted); cursor: pointer;
  font: 700 12.5px var(--display); padding: 4px 10px; min-width: 44px; min-height: 44px; }

.card button { padding: 0 16px; min-height: 44px; border-radius: 999px; cursor: pointer; font: inherit;
  font-weight: 700; color: var(--ink); background: var(--surface); border: 1px solid var(--hair);
  margin: .5rem .5rem 0 0; }
.card button.primary { background: var(--accent); color: var(--accent-ink); }
input:disabled, button:disabled { opacity: .5; cursor: default; }
.visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0);
  white-space: nowrap; }

/* The figure blocks the surfaces share: the stat tiles, the verdict pills, the label/value row. */
.stats { display: flex; gap: 10px; margin-top: 12px; }
.stat-cell { flex: 1; background: var(--surface); border-radius: var(--r-card); padding: 10px 12px;
  box-shadow: var(--shadow); }
.stat-num { font-size: 18px; font-weight: 700; margin-top: 2px; }
.pills { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
.pill { display: inline-flex; align-items: center; min-height: 30px; padding: 0 12px; border-radius: 999px;
  font-size: 12.5px; font-weight: 700; }
.pill.good { background: color-mix(in srgb, var(--good) 14%, transparent); color: var(--good); }
.pill.warn { background: color-mix(in srgb, var(--warn) 16%, transparent); color: var(--warn); }
.pill.bad { background: color-mix(in srgb, var(--bad) 14%, transparent); color: var(--bad); }
.rowline { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 0; }
.rowline + .rowline { border-top: 1px solid var(--hair); }
.rowline .when { font-weight: 700; }
`;
