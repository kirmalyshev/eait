// Home's own styles (W4, #91) — the boards' two-column `wmain` is the shell's; what is here is
// this surface: the streak chip and the date nav in the bar, the calorie card's two forms, the
// paged card track and its dot switcher, the health-score row and the per-day score modal,
// the empty/failed day cards, the proposal card, and the in-diary composer.

import { MOTION } from "../../shared/design.ts";

export const todayCss = `
/* The top bar's right side: the streak chip, then the shared date row (.drow/.darrow are
   the shell's — Home and You both draw them, #175). frame.bar is a flex row already. */

/* The week's strip sits edge to edge in its column (the boards' margin:-16px bleeds). */
.weekwrap { margin: 0 -16px; }

/* THE CALORIE CARD. Two forms: the 104 px toggle card only on today with meals logged (tap
   flips left↔eaten), the 96 px detail card everywhere else. The past-over form colours the
   figure --bad and reads "kcal over" — the week's rule, said in words. */
.kcard { display: flex; align-items: center; justify-content: space-between;
  padding: 18px 20px; }
.kcard .ktg { display: inline-flex; align-items: center; gap: 3px; border: 0; background: none;
  padding: 0; font: inherit; font-size: 13px; font-weight: 600; color: var(--muted);
  cursor: pointer; }
.kcard .ktg .ico { width: 14px; height: 14px; }
.kcard .ktg:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.kcard .kfig { font-size: 44px; font-weight: 700; letter-spacing: -.03em; display: block;
  line-height: 1.05; }
/* The boards' two figure sizes: 48 on today's toggle card, 44 on the 96 px detail form. */
.kcard .kfig.big { font-size: 48px; }
.kcard.over .kfig { color: var(--bad); }
.kcard .klab { font-size: 13px; font-weight: 600; color: var(--muted); }
.kcard .klab .caret { display: inline-block; margin-left: 2px; }
.kcard .mring { margin: 0; }

/* THE PAGED TRACK (#1025). Page 1 is the calorie card over the macro set, page 2 the nutrient
   set and the day's score — BOTH mounted in one clipped row, so the row's height is the taller
   page's and a turn moves nothing below it. The track is one clip-width wide and translateX
   pans it one page; the pan runs the settle duration on the register's easing, and the
   generated reduced-motion block settles it instantly. mpage is a wcol-shaped column so a
   card inside it keeps the spacing it had as a root child. */
.mclip { overflow: hidden; }
/* The side column scrolls; its blocks keep their height rather than shrink into it (a clip's
   overflow drops its min-height to zero, and page 1 was cut mid-card at phone width). */
.wcol > .mclip, .wcol > .mcards, .wcol > .kcard, .wcol > .weekwrap { flex-shrink: 0; }
/* The strip swipes and holds: vertical scroll stays the browser's, the long press is ours. */
.weekwrap { touch-action: pan-y; -webkit-touch-callout: none; user-select: none; }
.mtrack { display: flex; transition: transform ${MOTION.settle / 1000}s var(--ease); }
.mpage { flex: 0 0 100%; min-width: 0; display: flex; flex-direction: column; gap: 16px; }
/* The pages share the taller one's height, so the shorter one's card row grows to the same
   bottom edge (#1241): the grid's single row stretches and the cards with it, and the slack
   lands between the caption and the ring, which stays pinned to the card's bottom. With no
   slack — the taller page — the auto margin is zero and nothing moves. */
.mpage > .mcards { flex: 1; }
.mpage .mcard > small { margin-bottom: auto; }

/* The macro cards: page 1's left-aligned set, page 2's four-up nutrient set, and the compact
   centred form the empty/logging/past boards draw. mcards.p2 is the four-column page. */
.mcards.p2 { grid-template-columns: repeat(4, 1fr); gap: 8px; }
/* The dot switcher — two 6 px dots on 44 px hit areas; the active one is ink. */
.dots { display: flex; justify-content: center; gap: 6px; margin-top: -2px; }
.dots button { width: 44px; height: 44px; border: 0; background: none; padding: 0;
  display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
.dots i { width: 6px; height: 6px; border-radius: 50%; background: var(--line);
  pointer-events: none; }
.dots button.on i { background: var(--ink); }
.dots button:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }

/* The health-score row — the DAY board's columnar form of the kit's hsr (the meal sheet's is
   a single row; kitCss lands after this file, so the variant scopes itself to .hsr.day). */
.hsr.day { flex-direction: column; align-items: stretch; gap: 8px; padding: 12px 14px; }
.hsr.day .hline { display: flex; align-items: center; justify-content: space-between; }
.hsr.day .hscore { font-weight: 600; }
.hsr.day .hnum { font-size: 17px; font-weight: 700; font-variant-numeric: tabular-nums; }
.hsr.day .chev .ico { width: 16px; height: 16px; color: var(--muted); }
.hsr.day .hfrom { font-size: 12px; color: var(--muted); }
/* flex:none — the kit's .hsr .hsb{flex:1} is a row form; in this column a basis of 0% left the
   track 0 px tall (#170). */
.hsr.day .hsb { flex: none; }
.hsb { height: 6px; border-radius: var(--r-bar); background: var(--hair); overflow: hidden; }
.hsb i { display: block; height: 100%; background: var(--ink); border-radius: var(--r-bar); }

/* The per-day score modal — the boards' 440 px card over a dimmed page. */
.scorewrap { position: fixed; inset: 0; background: color-mix(in srgb, var(--ink) 36%, transparent); display: flex;
  align-items: center; justify-content: center; z-index: 40; }
.scorecard { width: 440px; max-width: calc(100vw - 32px); padding: 24px; display: flex;
  flex-direction: column; gap: 4px; }
.scorecard .stitle { display: flex; align-items: center; justify-content: space-between; }
.scorecard .stitle b { font-size: 22px; font-weight: 700; letter-spacing: -.02em; }
.scorecard .stitle .snum { font-size: 28px; font-weight: 700; font-variant-numeric: tabular-nums; }
.scorecard .sline { font-size: 13px; color: var(--muted); margin: 2px 0 4px; }
a.hsp { color: inherit; text-decoration: none; }
.hsp .chev .ico { width: 16px; height: 16px; color: var(--muted); }
.scorecard .cta { margin-top: 14px; }

/* The meal list's column title ("Recently uploaded" — today.html's d17 over the card). */
.mealtitle { font-size: 17px; font-weight: 700; letter-spacing: -.01em; }
.meals .meal:first-of-type { border-top: 0; }

/* The empty day — a dashed panel, the plate over one line, centred; the whole panel logs a meal. */
.emptycard { min-height: 240px; flex: 1 0 auto; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 16px; background: none; box-shadow: none;
  border: 1.5px dashed var(--line); border-radius: var(--r-card); color: var(--ink);
  text-decoration: none; text-align: center; padding: 24px; cursor: pointer; }
.emptycard:hover { border-color: var(--faint); }
.emptycard:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.emptycard .plate { width: 56px; height: 56px; border-radius: 50%;
  box-shadow: inset 0 0 0 1.5px var(--faint); position: relative; }
.emptycard .plate::after { content: ""; position: absolute; inset: 16px; border-radius: 50%;
  box-shadow: inset 0 0 0 1.5px var(--faint); }
.emptycard p { font-weight: 600; font-size: 17px; margin: 0; }

/* The couldn't-load day — Spud cares, one line, one retry. The retry is the chat's \`.cta.s.sm\`;
   a \`.failcard\`-scoped rule cannot out-rank \`.card button.cta\` (#304). */
.failcard { display: flex; justify-content: center; padding: 56px 16px; }
.failcard p { font-weight: 600; font-size: 15px; line-height: 1.35; margin: 0; }

/* The proposal the day holds is the SHELL's card (.prop, styled where every surface reads
   it, in chat.css) — the boards' logging state draws the ink ring ON the card, where it
   follows the card's radius; on .prop itself it renders as two straight rules (#301). */
.home .prop .card { box-shadow: 0 0 0 2px var(--ink); }
`;
