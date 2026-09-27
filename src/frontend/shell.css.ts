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
  font: 15px/1.5 var(--display); }
/* FOCUS IS VISIBLE (#53): a 2px ring in the text ink, offset 2px so it stands clear of the
   control's own border. --text on these grounds is far past the 3:1 a focus indicator needs —
   and on the accent surfaces, the offset puts the ring on the light around them. */
:is(a, button, input, select, textarea):focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }
/* NUMBERS IN THE ONE FACE, tabular so a column of them holds still. The third face is gone: the
   boards set figures in the main face and so does this page. The unit still sits OUTSIDE the span —
   its space is the face's own. */
.num { font-variant-numeric: tabular-nums; }

/* THE FRAME (the boards' web layout, #52): a slim top bar — the mark, then the one row the app
   navigates by — over a single quiet column the width a chat reads best at, the 38.75rem /start
   already centres on. At a phone's width the column fills the viewport. */
#app { min-height: 100vh; display: flex; flex-direction: column; }
.wbar { display: flex; align-items: center; gap: 12px; padding: 0 26px; min-height: 60px;
  font: 700 17px var(--display); letter-spacing: -.02em; }
.wbar .mark { display: flex; align-items: center; gap: 8px; }
.wbar .mark svg { width: 30px; height: 24px; display: block; }
.wnav { display: flex; gap: 6px; margin-left: auto; }
.wcol { width: 100%; max-width: 38.75rem; margin: 0 auto; flex: 1; padding: 18px 20px 30px;
  background: var(--surface); border-radius: 26px 26px 0 0;
  box-shadow: 0 -1px 0 var(--hair), 0 20px 50px -30px color-mix(in srgb, var(--ink) 40%, transparent); }
.body { min-width: 0; }
/* The centred title the boards draw above each screen's own column. */
.top { text-align: center; padding: 6px 0 12px; }
.top .tt { margin: 0; font-size: 19px; }

h1, h2 { margin: 0 0 .5rem; font-weight: 800; letter-spacing: -.02em; }
h2 { font-size: 17px; }
.muted { color: var(--muted); }
.lab { font-size: 12px; font-weight: 700; letter-spacing: .13em; text-transform: uppercase; color: var(--muted); }
.big { margin: .25rem 0 0; display: flex; align-items: baseline; gap: 8px; }
.hero { font-size: 44px; font-weight: 800; letter-spacing: -1.5px; line-height: 1.05; }
.big.warn .hero { color: var(--warn); }
/* THE GUESS, AND NOTHING ELSE IS EVER THIS COLOUR. Immediately before the figure it governs, and
   outside the figure's own span. */
.about { color: var(--warn); font-weight: 700; }
/* THE FLOOR, AND NOTHING ELSE. Once per screen, as text, and never a tick on a scale. */
.floor { font-size: 12px; font-weight: 700; letter-spacing: .09em; text-transform: uppercase; color: var(--care); }

/* The boards' panel: a light surface one step up from the ground, with the hairline and the soft
   shadow /start's card already carries. */
.card { padding: 1rem 1.1rem; background: var(--surface); border: 1px solid var(--hair);
  border-radius: 18px; margin-bottom: 14px;
  box-shadow: 0 1px 2px color-mix(in srgb, var(--ink) 4%, transparent); }

/* PILLS: every button, tab and chip is a 999px capsule — the shape the boards draw and /start's own
   controls already take. The three tabs never wrap onto a second row. */
.tab { color: var(--muted); text-decoration: none; padding: 8px 14px; border-radius: 999px; font-weight: 700; font-size: 14px; white-space: nowrap;
  /* A nav item is a tap target: the pill keeps its shape, the box grows to 44px (#53). */
  display: inline-flex; align-items: center; min-height: 44px; }
.tab.on { color: var(--accent); background: var(--surface); }

.primary { display: inline-block; margin-top: .75rem; padding: 0 18px; height: 44px; line-height: 44px;
  border-radius: 999px; background: var(--accent); color: var(--accent-ink); text-decoration: none;
  font-size: 13px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }

.error, .notice { color: var(--bad); }
.notice { margin: 1rem 0 0; }

/* THE ONE COMPOSER, on Chat and on Today alike: "Add a photo" in front of the native input, the
   field, the round send. It stays at the foot of the column while the thread scrolls under it. */
.comp { margin-top: 14px; position: sticky; bottom: 0; background: var(--surface); padding: 10px 0 4px; }
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
.stat-cell { flex: 1; background: var(--surface); border-radius: 12px; padding: 10px 12px; }
.stat-num { font-size: 18px; font-weight: 800; margin-top: 2px; }
.pills { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
.pill { display: inline-flex; align-items: center; min-height: 30px; padding: 0 12px; border-radius: 999px;
  font-size: 12.5px; font-weight: 800; }
.pill.good { background: color-mix(in srgb, var(--good) 14%, transparent); color: var(--good); }
.pill.warn { background: color-mix(in srgb, var(--warn) 16%, transparent); color: var(--warn); }
.pill.bad { background: color-mix(in srgb, var(--bad) 14%, transparent); color: var(--bad); }
.rowline { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 0; }
.rowline + .rowline { border-top: 1px solid var(--hair); }
.rowline .when { font-weight: 700; }
`;
