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
/* Fixed, as the boards' .web is: a screen's column scrolls INSIDE wcol (the thread scrolls itself
   when it can), never the document — the composer and the bar stay put at every content length. */
#app { height: 100dvh; display: flex; flex-direction: column; overflow: hidden; }
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
/* The date row a screen's bar side draws (the boards' wtop right: "‹ Thursday 24 September ›") —
   the chevrons are 32px icon buttons, the label 14/500 between them. One row for Home and You
   (#175): the shell owns it because the day a column shows is the frame's, not a surface's. */
.drow { display: flex; align-items: center; gap: 8px; margin-left: 14px; }
.drow .dlabel { font-weight: 500; white-space: nowrap; }
.darrow { width: 32px; height: 32px; flex: 0 0 32px; border: 0; border-radius: 50%;
  background: var(--surface); box-shadow: 0 0 0 1px var(--hair); display: inline-flex;
  align-items: center; justify-content: center; cursor: pointer; color: var(--ink);
  font: inherit; padding: 0; }
.darrow:disabled { opacity: .4; cursor: default; }
.darrow:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.darrow .ico { width: 18px; height: 18px; }
/* THE COLUMN: pro.css's wmain verbatim — a grid, because W4's Home draws a second 360px column;
   one is the single-column form every surface takes until then. wcol's 16px gap is the board's
   spacing between a screen's ROOT blocks; inside a screen, the blocks' own margins still space
   them, as they did. */
.wmain { flex: 1; display: grid; grid-template-columns: 1fr 360px; gap: 24px;
  padding: 28px 40px; max-width: 1160px; width: 100%; margin: 0 auto; overflow: hidden; }
.wmain.one { grid-template-columns: 1fr; max-width: 820px; }
/* The meal's board puts its 400px|1fr columns INSIDE the main — the screen's own .mdetail grid —
   so the route's main is one column at the full width, not the .one variant's 820px. */
.wmain.meal { grid-template-columns: 1fr; }
.wcol { display: flex; flex-direction: column; gap: 16px; min-width: 0; min-height: 0; overflow-y: auto; }
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

/* pro.css's type helpers and the hairline — the boards' own class names, so a screen transcribes
   a board without re-measuring a type step. */
.d { font-weight: 700; letter-spacing: -.02em; line-height: 1.1; }
.d34 { font-size: 34px; } .d28 { font-size: 28px; } .d22 { font-size: 22px; }
.d17 { font-size: 17px; letter-spacing: -.01em; }
.t13 { font-size: 13px; } .t12 { font-size: 12px; }
.m { color: var(--muted); } .f { color: var(--faint); }
.hr { height: 1px; background: var(--hair); }

/* THE ONE COMPOSER (pro.css ".compose"), on Chat and on Today alike: the camera round, the pill
   field, the send round. ".ib" is the boards' 36 px icon button; the composer wears it at 44 —
   the tap floor. The ".box" is the boards' field as a real input — at 16 px, not the board's 15:
   the floor that keeps iOS from zooming on focus (the a11y gate measures the box). */
.comp { margin-top: 14px; position: sticky; bottom: 0; background: var(--bg); padding: 6px 0 4px; }
.compose { display: flex; gap: 10px; align-items: center; }
.ib { width: 36px; height: 36px; flex: 0 0 36px; border-radius: 50%; display: flex; align-items: center;
  justify-content: center; background: var(--surface); box-shadow: 0 0 0 1px var(--hair);
  border: 0; padding: 0; cursor: pointer; color: var(--ink); }
.ib .ico { width: 18px; height: 18px; }
.ib:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.compose .ib { width: 44px; height: 44px; flex-basis: 44px; }
.compose .ib .ico { width: 20px; height: 20px; }
.compose .ib.p { background: var(--accent); box-shadow: none; color: var(--accent-ink); }
.compose .box { flex: 1; min-width: 0; min-height: 48px; border-radius: 24px; background: var(--surface);
  box-shadow: 0 0 0 1px var(--hair); border: 0; padding: 0 16px; font: inherit; font-size: 16px;
  color: var(--ink); }
/* The wrapping field (composerRow's multiline): vertically padded like the input, sized by its
   text where the engine knows field-sizing, scrollable where it does not. */
.compose textarea.box { padding: 13px 16px; line-height: 22px; resize: none;
  field-sizing: content; border-radius: 24px; }
.compose .box::placeholder { color: var(--faint); }
.compose .box:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.comp-note { display: flex; align-items: center; gap: 6px; padding-top: 6px; }
.comp-note .count { font-size: 12px; color: var(--muted); white-space: nowrap; }
/* The composer's cancel is the same small text button a thread line's actions wear. */
.act { background: none; border: 0; color: var(--muted); cursor: pointer;
  font: 700 12.5px var(--display); padding: 4px 10px; min-width: 44px; min-height: 44px; }

/* The coach answer's macro bar (pro.css's .mb/.bar): the number row, the track with the target
   tick at its right end, the fill growing once on arrival — the grow verb is motionCss's. */
.bar { height: 6px; background: var(--hair); border-radius: 1px; overflow: hidden; }
.bar i { display: block; height: 100%; background: var(--accent); }
.bar i.grow { transform-origin: left center; }
.mb .row { font-size: 13px; font-weight: 600; }
.mb .row span:last-child { color: var(--muted); font-weight: 500; }
.mb .bar { margin-top: 5px; position: relative; overflow: visible; }
.mb .bar::after { content: ""; position: absolute; right: 0; top: -3px; width: 2px; height: 12px;
  background: var(--ink); }

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
