// The onboarding boards' stylesheet — `product/design/pro/pro.css` ported for the pages W2 owns.
//
// SCOPE: every selector hangs under `main.ob` (the pages `question`/`frontDoor`/`stopped` ask
// `shell` for). The surfaces W3 and later still draw from the stylesheet above this one — `.card`,
// `.row`, `.lab` — so nothing here lands unscoped and nothing old is rewritten in place. The token
// values themselves are never retyped: `lightVars` (palette.ts) is the block, emitted here inside
// `.ob` rather than at `:root`, so the older screens keep reading the root block they know.

import { lightVars } from "@eait/shared/palette";
import { iconCss } from "@eait/shared/ui/icons";

export const BOARD_CSS = `
.ob {
  ${lightVars}
  --r-card: 12px; --r-ctl: 10px; --r-cta: 14px;
  --shadow: 0 1px 2px rgb(23 25 28 / .04), 0 8px 24px rgb(23 25 28 / .06);
  display: flex; flex-direction: column; min-height: 100svh; max-width: none; margin: 0;
  padding: 0; width: 100%; background: var(--bg);
  font-family: var(--sans);
}
.ob * { box-sizing: border-box; }
.ob h1, .ob p, .ob figure { margin: 0; font-size: 15px; font-weight: 400; }
.ob b { font-weight: 700; }
.ob a { color: inherit; text-decoration: none; }
.ob .num, .ob .bign { font-feature-settings: "tnum" 1; }
.ob .m { color: var(--muted); } .ob .f { color: var(--faint); }
.ob .t12 { font-size: 12px; } .ob .t13 { font-size: 13px; }
.ob .d  { font-weight: 700; letter-spacing: -.02em; }
.ob .d17 { font-size: 17px; } .ob .d22 { font-size: 22px; } .ob .d28 { font-size: 28px; }
.ob .d34 { font-size: 34px; } .ob .d52 { font-size: 52px; letter-spacing: -.03em; }
.ob .row { display: flex; align-items: center; gap: 10px; }
.ob .row.between { justify-content: space-between; }
.ob .lab { font-size: 12px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
.ob .muted-sub { color: var(--muted); font-size: 15px; line-height: 1.45; }

/* ── the frame ── */
/* The top bar is the app shell's (main.css .wtop): a white bar on the hairline, the app icon
   as the brand mark (DIRECTION §6 — Spud is a signature beside his line, never the mark). */
.ob .wtop { display: flex; align-items: center; gap: 28px; height: 64px; padding: 0 40px;
            background: var(--surface); border-bottom: 1px solid var(--hair); }
.ob .brand { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 17px; letter-spacing: -.02em; }
.ob .appicon { display: block; flex: 0 0 auto; }
.ob .sp { flex: 1; }
/* The boards' own centring: the ~700px column sits centred on every step, not pinned left. */
.ob .wmain { flex: 1; display: flex; width: 100%; margin: 0 auto; }
.ob .wmain.one { justify-content: center; }
/* The question column — the boards' own max-width on wmain one, named (#141). */
.ob .wmain.q { max-width: 720px; }
.ob .wcol.mid { justify-content: center; }
.ob .mt6 { margin-top: 6px; }
.ob .cen { text-align: center; }
.ob .semi { font-weight: 600; }
.ob .wcol { display: flex; flex-direction: column; gap: 18px; width: 100%; min-height: 0; padding: 8px 40px 40px; }
.ob .wcol form { display: flex; flex-direction: column; gap: 18px; flex: 1; min-height: 0; }
.ob .wcol .cta { max-width: 360px; align-self: center; }

/* ── the top row: back arrow + one continuous bar, filling from the place before to this one ── */
.ob .wbar { display: flex; align-items: center; gap: 16px; min-height: 32px; }
.ob .wback { display: inline-grid; place-items: center; width: 32px; height: 32px; margin-left: -6px;
             color: var(--ink); text-decoration: none; border-radius: 50%; flex: none; }
.ob .wback:hover { background: var(--hair); }
.ob .wback .ico { width: 22px; height: 22px; }
.ob .dash { flex: 1; height: 8px; border-radius: 4px; background: var(--accent-tint); overflow: hidden; }
.ob .dash i { display: block; height: 100%; width: var(--to); border-radius: 4px; background: var(--accent);
              animation: k-fill .45s var(--ease) .1s both; }
@keyframes k-fill { from { width: var(--from); } }

/* ── the ask ── */
.ob .say { display: flex; gap: 12px; align-items: flex-start; }
.ob .qecho { margin: -14px 0 0 40px; }
.ob .spud { flex: 0 0 28px; width: 28px; height: 28px; border-radius: 50%; background: var(--accent-tint);
            display: inline-flex; align-items: center; justify-content: center; margin-top: 2px; }
.ob .spud svg { width: 78%; height: 78%; display: block; }
.ob .q { font-size: 22px; font-weight: 700; letter-spacing: -.02em; line-height: 1.15; }
.ob .notice { color: var(--warn); background: var(--warn-tint); padding: 10px 14px; border-radius: var(--r-ctl);
              font-size: 14px; line-height: 1.45; }

/* ── the primary button / secondary link ── */
.ob .cta { display: flex; align-items: center; justify-content: center; gap: 8px; height: 56px; padding: 0 32px;
           border-radius: var(--r-cta); font-weight: 600; font-size: 16px; border: 0; cursor: pointer;
           font-family: var(--sans); width: 100%; }
.ob .cta.p { background: var(--accent); color: var(--accent-ink); }
.ob .cta.s { background: none; color: var(--ink); height: 44px; }
.ob .cta.p[disabled] { opacity: .45; cursor: default; }

/* ── the unit toggle ── */
.ob .seg { display: flex; background: var(--hair); border-radius: 10px;
           padding: 3px; gap: 2px; width: 150px; align-self: center; }
/* .wcol form stacks and stretches every form for the one-form screens — the toggle is a row
   the size of its two options, so the column rule is taken back where it would apply. */
.ob .wcol .seg { flex-direction: row; flex: none; gap: 2px; }
.ob .seg button { flex: 1; border: 0; padding: 6px 0; border-radius: 8px; font-size: 13px; font-weight: 600;
                  text-align: center; color: var(--muted); background: none; cursor: pointer; font-family: var(--sans); }
.ob .seg button.on { background: var(--surface); color: var(--ink); box-shadow: 0 1px 2px rgba(0,0,0,.08); }

/* ── option rows ── */
.ob .opts { display: grid; gap: 10px; }
.ob .opts.c4 { grid-template-columns: repeat(4, 1fr); }
.ob .opts.c3 { grid-template-columns: repeat(3, 1fr); }
.ob .opts.c2 { grid-template-columns: repeat(2, 1fr); }
.ob .opt { background: var(--surface); border-radius: var(--r-card); box-shadow: 0 0 0 1px var(--hair);
           padding: 18px; display: flex; align-items: center; gap: 12px; cursor: pointer;
           font-size: 17px; font-weight: 500; color: var(--ink); border: 0; text-align: left;
           font-family: var(--sans); width: 100%; }
.ob .opt input { position: absolute; opacity: 0; pointer-events: none; width: 1px; height: 1px; }
.ob .opt:has(input:checked) { box-shadow: 0 0 0 2px var(--ink); font-weight: 600; }
.ob .opt .ck { margin-left: auto; flex: 0 0 22px; width: 22px; height: 22px; border-radius: 50%;
               box-shadow: 0 0 0 1.5px var(--line); display: inline-flex; align-items: center;
               justify-content: center; }
.ob .opt:has(input:checked) .ck { box-shadow: none; background: var(--ink); }
.ob .opt .ck .ico { width: 12px; height: 12px; color: #fff; opacity: 0; }
.ob .opt:has(input:checked) .ck .ico { opacity: 1; }
.ob .opt:focus-within { box-shadow: 0 0 0 2px var(--ink); }
.ob .opt .tile { width: 44px; height: 44px; border-radius: 12px; background: var(--bg); flex: 0 0 44px;
                 display: flex; align-items: center; justify-content: center; }
.ob .opt .tile .ico { width: 24px; height: 24px; }
.ob .opt small { display: block; font-size: 13px; color: var(--muted); font-weight: 400; }
.ob .opt:has(input:checked) small { color: var(--muted); font-weight: 400; }
.ob .ico { display: inline-flex; width: 22px; height: 22px; flex: 0 0 auto; }
.ob .opts.c3 .opt, .ob .opts.c4 .opt { flex-direction: column; align-items: flex-start; gap: 8px; padding: 18px; }
.ob .opts.c3 .opt .ck, .ob .opts.c4 .opt .ck { margin-left: 0; align-self: flex-end; }

/* ── the big number + pickers ── */
.ob .bign { font-size: 56px; font-weight: 700; letter-spacing: -.03em; line-height: 1; display: flex;
            align-items: baseline; gap: 6px; justify-content: center; }
.ob .bign small { font-size: 17px; font-weight: 500; letter-spacing: 0; color: var(--muted); }
.ob .vpick { display: flex; gap: 56px; align-items: center; justify-content: center; }

/* the age wheel: a scrollable column, snap-centred — the script drives it, the rows are real */
.ob .wheelbox { position: relative; }
.ob .wheelbox::after { content: ""; position: absolute; left: 0; right: 0; top: 50%; height: 44px;
  transform: translateY(-50%); border-top: 1px solid var(--hair);
  border-bottom: 1px solid var(--hair); pointer-events: none; }
.ob .wheel { height: 308px; width: 140px; overflow-y: auto; scroll-snap-type: y mandatory;
  padding: 132px 0; box-sizing: border-box;
  -webkit-mask: linear-gradient(transparent, #000 22%, #000 78%, transparent);
  mask: linear-gradient(transparent, #000 22%, #000 78%, transparent);
             scrollbar-width: none; -webkit-mask-image: linear-gradient(180deg, transparent, #000 38px, #000 calc(100% - 38px), transparent);
             mask-image: linear-gradient(180deg, transparent, #000 38px, #000 calc(100% - 38px), transparent); }
.ob .wheel::-webkit-scrollbar { display: none; }
.ob .wheel .wr { height: 44px; display: flex; align-items: center; justify-content: center;
                 scroll-snap-align: center; font-size: 17px; color: var(--muted); }
.ob .wheel .wr.on { font-size: 28px; font-weight: 700; color: var(--ink); }

/* the vertical ruler (height) */
.ob .vruler { width: 88px; height: 380px; position: relative;
              -webkit-mask-image: linear-gradient(180deg, transparent, #000 60px, #000 calc(100% - 60px), transparent);
              mask-image: linear-gradient(180deg, transparent, #000 60px, #000 calc(100% - 60px), transparent);
              touch-action: none; cursor: ns-resize; }
.ob .vruler .now { position: absolute; left: 0; right: 0; top: 50%; height: 2px; background: var(--accent);
                   transform: translateY(-1px); }
.ob .vruler .now::before { content: ""; position: absolute; left: -2px; top: -5px; width: 12px; height: 12px;
                           border-radius: 50%; background: var(--accent); }
.ob .vruler .lbl { position: absolute; right: 48px; top: 50%; transform: translateY(-50%); font-size: 13px;
                   font-weight: 500; color: var(--muted); }

/* the horizontal ruler (weight, target) */
.ob .ruler { height: 72px; position: relative; width: 100%; max-width: 630px; margin: 22px auto 0;
             -webkit-mask-image: linear-gradient(90deg, transparent, #000 60px, #000 calc(100% - 60px), transparent);
             mask-image: linear-gradient(90deg, transparent, #000 60px, #000 calc(100% - 60px), transparent);
             touch-action: pan-y; cursor: ew-resize; }
.ob .ruler .now { position: absolute; left: 50%; top: 0; width: 2px; height: 100%; background: var(--accent);
                  transform: translateX(-1px); }
.ob .ruler .now::before { content: ""; position: absolute; left: -5px; top: -2px; width: 12px; height: 12px;
                          border-radius: 50%; background: var(--accent); }
.ob .ruler .lbl { position: absolute; bottom: 44px; transform: translateX(-50%); font-size: 12px;
                  font-weight: 500; color: var(--muted); white-space: nowrap; }
/* #1201 — .lo/.mg/.hi position by computed box (left is the box's own edge): the
 * transforms and mark-side paddings the alignment used to live in are the
 * script's mbox now, so the classes carry only the look. */
/* The refused zone is NEUTRAL, not red — red is "very high" only (ieat-app#1610): the floor and
   merged labels stay the ruler's muted ink, the zone itself the board's faint hatch. */
.ob .ruler .lbl.lo { transform: none; }
/* the floor label's second row, 16px under the band's own. */
.ob .ruler .lbl.lo.r2 { bottom: 28px; }
/* the merged floor/now label. */
.ob .ruler .lbl.mg { transform: none; }
.ob .ruler .lbl.hi { transform: none; color: var(--ink); font-weight: 600; }
.ob .ruler .tint { position: absolute; left: 0; bottom: 0; height: 38px;
                   background: repeating-linear-gradient(135deg,
                     color-mix(in srgb, var(--faint) 55%, transparent) 0 2px,
                     transparent 2px 8px); pointer-events: none; }

/* the live delta pill under the target ruler — clear of the tick band, not flush on it (#473) */
.ob .live { position: relative; width: fit-content; margin: 12px auto 0; background: var(--accent-tint);
            border-radius: var(--r-card); padding: 14px 28px; font-size: 28px; font-weight: 700;
            letter-spacing: -.02em; color: var(--ink); }

/* ── pace: the three stops, the slider, the result (10-pace) — 110px stops spread the column,
   a hairline track inset half a stop, a white thumb, the bold computed line under it ── */
.ob .pacevarbox { margin-bottom: 24px; }
.ob .pacevar .bign { font-size: 72px; }
.ob .pacevar .bign small { font-size: 22px; font-weight: 600; letter-spacing: -.01em; color: var(--ink); }
.ob .stops { display: flex; justify-content: space-between; text-align: center;
             font-size: 13px; font-weight: 500; color: var(--muted); width: 100%; }
.ob .stops > div { width: 110px; display: flex; flex-direction: column; align-items: center; gap: 6px; }
.ob .stops > div.on { color: var(--accent); font-weight: 600; }
.ob .stops .ico { width: 48px; height: 48px; }
.ob .slider { position: relative; height: 6px; background: var(--hair); border-radius: 3px;
              margin: 18px 55px 0; touch-action: pan-y; }
.ob .slider i { position: absolute; left: 0; top: 0; height: 100%; background: var(--ink); border-radius: 3px; }
.ob .slider b { position: absolute; top: 50%; width: 28px; height: 28px; border-radius: 50%;
                background: #fff; box-shadow: 0 1px 4px rgb(0 0 0 / .25); transform: translate(-50%, -50%);
                cursor: ew-resize; }
.ob .est { color: var(--muted); font-size: 12px; font-weight: 600; display: block; }
.ob .paceres { text-align: center; }
.ob .paceresbox { margin-top: 24px; }
.ob .cap { text-align: center; }
.ob .cap summary { list-style: none; cursor: pointer; display: inline-block; }
.ob .cap summary::-webkit-details-marker { display: none; }
.ob .cap .est::after { content: ""; }
.ob .cap p { max-width: 420px; margin: 8px auto 0; font-size: 13px; color: var(--muted); line-height: 1.45; }

/* the goal cards: icon on top, name below, the check pinned to the corner */
.ob .opt.big { flex-direction: column; align-items: flex-start; gap: 18px; padding: 20px 18px;
               position: relative; }
.ob .opt.big .ico { width: 32px; height: 32px; }
.ob .opt.big .ck { position: absolute; top: 16px; right: 16px; margin-left: 0; }

/* the pace screen's swappable halves — one variant per computed pace */
.ob .pacevar, .ob .paceres { display: none; }
.ob .pacevar.on, .ob .paceres.on { display: block; }
.ob .pacesel { display: none; text-align: center; }
.ob.js .pacesel { display: block; }
.ob .pacerows .opt { flex-wrap: wrap; }
.ob .pacerows .opt small { display: block; width: 100%; }
.ob.js .pacerows { display: none; }

/* ── cards & chips (how / ontrack) ── */
/* The interstitials' own frame: the boards pad the top 24 (the wcol's 8 plus this) and centre the
   say + figure + button as ONE group, so the ask travels with the cards (#291). how runs the
   boards' 1080 — the three cards need it; ontrack keeps the question column's 720. */
.ob .wmain.mom { padding-top: 16px; margin: 0 auto; width: 100%; }
.ob .wmain.wide { max-width: 1080px; }
.ob .igroup { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 24px;
              min-height: 0; }
.ob .card { background: var(--surface); border-radius: var(--r-card); box-shadow: var(--shadow); padding: 16px; }
.ob .cards { display: grid; gap: 16px; align-items: start; }
.ob .cards.c3 { grid-template-columns: repeat(3, 1fr); }
.ob .cards .card { padding: 14px 14px 12px; display: flex; flex-direction: column; gap: 10px; }
/* The step's head — the badge sits in the card's header row beside its name, never over the
   figure (#291: an absolute badge once covered the verdict it was numbering). */
.ob .chead .n { width: 24px; height: 24px; flex: 0 0 24px; border-radius: 50%;
                background: var(--ink); color: #fff; font-size: 13px; font-weight: 700;
                display: flex; align-items: center; justify-content: center; }
.ob .pict { height: 230px; border-radius: var(--r-ctl); background: #DDD8CE;
            position: relative; overflow: hidden; }
/* The step cards' drawn contents sit in the boards' hairline box (#141). */
.ob .mbox { border-radius: var(--r-ctl); box-shadow: 0 0 0 1px var(--hair); padding: 10px 12px; }
.ob .mbox.chart { padding-bottom: 6px; }
.ob .mimg { width: 44px; height: 44px; flex: 0 0 44px; border-radius: 8px; object-fit: cover; }
.ob .grow { flex: 1; min-width: 0; }
.ob .mname { font-size: 14px; font-weight: 600; }
.ob .mkcal { font-size: 18px; }
.ob .mbox .est { font-size: 12px; font-weight: 600; }
.ob .pgraph { display: block; overflow: visible; }
.ob .pgraph .ink { fill: var(--ink); font-weight: 600; font-size: 11px; }
/* the on-track card (12-cards): the board's own padding, and the tag anchored to the chart so
   it rides just above the axis' right end at any width (the board's bottom:84 card-relative
   is this calc at the board's size) */
.ob .card.rel { position: relative; padding: 24px 28px; }
.ob .chartw { position: relative; }
.ob .tagx.pos { position: absolute; right: 2px; bottom: calc(17.65% + 5px); }
.ob .mom .muted-sub.cen { font-weight: 500; margin: -8px 4px 0; }
.ob .hero { width: 100%; height: 100%; object-fit: cover; display: block; }
.ob .vf { position: absolute; inset: 14% 22%; }
.ob .vf i { position: absolute; width: 22px; height: 22px; border: 3px solid #fff; border-radius: 5px; }
.ob .vf i:nth-child(1) { top: 0; left: 0; border-right: 0; border-bottom: 0; }
.ob .vf i:nth-child(2) { top: 0; right: 0; border-left: 0; border-bottom: 0; }
.ob .vf i:nth-child(3) { bottom: 0; left: 0; border-right: 0; border-top: 0; }
.ob .vf i:nth-child(4) { bottom: 0; right: 0; border-left: 0; border-top: 0; }
.ob .macs { display: flex; gap: 14px; flex-wrap: wrap; font-size: 14px; margin-top: 4px; }
.ob .mac { display: inline-flex; align-items: center; gap: 5px; font-weight: 600;
           font-variant-numeric: tabular-nums; white-space: nowrap; }
/* The verdict — a dot and a line, never a pill; the tone colours the words too (the board's .v). */
.ob .vs { display: flex; gap: 14px; flex-wrap: wrap; margin-top: 8px; }
.ob .v { display: flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 500; color: var(--muted); }
.ob .v::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: var(--accent); flex: 0 0 8px; }
.ob .v.good { color: var(--accent); }
.ob .v.warn { color: var(--warn); } .ob .v.warn::before { background: var(--warn); }
.ob .v.bad { color: var(--bad); } .ob .v.bad::before { background: var(--bad); }
.ob .tagx { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600;
            color: var(--ink); background: var(--surface); padding: 3px 9px 3px 4px;
            border-radius: 999px; box-shadow: 0 1px 3px rgb(23 25 28 / .16); white-space: nowrap; }
.ob .tagx .appicon { flex: 0 0 auto; }
.ob .pgraph text { fill: var(--muted); font-size: 12px; font-family: var(--sans); }
.ob .pgraph .ln { stroke: var(--accent); stroke-width: 3; fill: none; stroke-linecap: round; }

/* ── the no-script number fields (the boards' rulers need the script; the field is the same answer) ── */
.ob .numalt { display: flex; gap: 10px; align-items: center; justify-content: center; }
.ob .numalt input[type="number"], .ob .numalt input[type="text"] {
  font-family: var(--sans); font-size: 20px; font-weight: 600; color: var(--ink); width: 110px;
  padding: 10px 14px; border-radius: var(--r-ctl); border: 1px solid var(--hair); background: var(--surface);
  text-align: center; }
.ob .numalt .uname { font-size: 13px; color: var(--muted); font-weight: 600; }
.ob .altline { text-align: center; color: var(--muted); font-size: 13px; }

/* the controls the script drives — hidden until it runs, so a blocked script never draws a dead one */
.ob .ctl { display: none; }
.ob.js .ctl { display: block; }
.ob.js .numalt, .ob.js .altline { display: none; }
.ob.js .pacerows { display: none; }
.ob.js .pacesel { display: block; }
.ob .pacesel { display: none; }

/* ── the welcome (00) ── */
.ob .wcenter { flex: 1; display: flex; align-items: center; justify-content: center; padding: 0 80px 60px; }
.ob .wdemo { display: flex; align-items: center; justify-content: center; gap: 88px; }
/* 01 (ieat-app#2050): the photo, the viewfinder, the shutter and scan once, then the four chips */
.ob .whero { position: relative; width: 390px; height: 560px; flex: none; border-radius: 28px; overflow: hidden; box-shadow: var(--shadow); }
.ob .whero .ph { position: absolute; inset: 0; background: url("/start/assets/img/hero.webp") center 48%/cover; animation: k-wzoom 1.1s cubic-bezier(.25,.8,.25,1) both; }
@keyframes k-wzoom { from { transform: scale(1.1); } }
.ob .whero .vf { position: absolute; left: 8%; right: 8%; top: 17%; height: 63%; animation: k-win .35s var(--ease) .15s both; }
@keyframes k-win { from { opacity: 0; transform: scale(1.06); } }
.ob .whero .vf i { position: absolute; width: 34px; height: 34px; border: 4px solid #fff; border-radius: 3px; }
.ob .whero .vf i:nth-child(1) { left: 0; top: 0; border-right: 0; border-bottom: 0; border-top-left-radius: 14px; }
.ob .whero .vf i:nth-child(2) { right: 0; top: 0; border-left: 0; border-bottom: 0; border-top-right-radius: 14px; }
.ob .whero .vf i:nth-child(3) { left: 0; bottom: 0; border-right: 0; border-top: 0; border-bottom-left-radius: 14px; }
.ob .whero .vf i:nth-child(4) { right: 0; bottom: 0; border-left: 0; border-top: 0; border-bottom-right-radius: 14px; }
.ob .whero .sh { position: absolute; left: 50%; top: 84%; width: 64px; height: 64px; margin-left: -32px; border-radius: 50%; background: #fff;
  box-shadow: 0 0 0 5px rgba(255,255,255,.4); opacity: 0; animation: k-wsh 1.1s var(--ease) .45s both; }
@keyframes k-wsh { 0% { opacity: 0; transform: scale(.8); } 25% { opacity: 1; transform: none; } 50% { transform: scale(.82); } 70% { transform: none; opacity: 1; } 100% { opacity: 0; } }
.ob .whero .fl { position: absolute; inset: 0; background: #fff; opacity: 0; animation: k-wfl .45s linear 1.05s both; }
@keyframes k-wfl { 0% { opacity: 0; } 20% { opacity: .85; } 100% { opacity: 0; } }
.ob .whero .sw { position: absolute; left: 0; right: 0; height: 160px; top: -160px; opacity: 0;
  background: linear-gradient(rgba(255,255,255,0), rgba(255,255,255,.55) 50%, rgba(255,255,255,0)); animation: k-wsw .9s linear 1.3s both; }
@keyframes k-wsw { 0% { opacity: 1; top: -160px; } 100% { opacity: 1; top: 100%; } }
.ob .wchip { position: absolute; display: flex; align-items: center; gap: 10px; padding: 8px 14px 8px 8px; border-radius: 16px;
  background: rgba(255,255,255,.88); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
  box-shadow: 0 4px 14px -6px rgba(23,25,28,.3); animation: k-wchip .4s cubic-bezier(.22,1,.36,1) both; animation-delay: var(--d); }
@keyframes k-wchip { from { opacity: 0; transform: scale(.6); } }
.ob .wchip .tile { width: 36px; height: 36px; flex: 0 0 36px; border-radius: 10px; display: grid; place-items: center; color: #17191C; background: #EEEDE9; }
.ob .wchip .tile .ico { width: 20px; height: 20px; }
.ob .wchip .tile.p { color: #D9483F; background: #FBE6E4; }
.ob .wchip .tile.c { color: #D48A1C; background: #FBEFD9; }
.ob .wchip .tile.f { color: #3B7BD4; background: #E3EDFA; }
.ob .wchip span { display: block; font-size: 12px; color: var(--muted); line-height: 1.2; }
.ob .wchip b { display: block; font-size: 19px; font-weight: 700; letter-spacing: -.02em; line-height: 1.15; color: var(--ink); }
.ob .wchip b small { font-size: 12px; font-weight: 600; color: var(--muted); margin-left: 2px; }
.ob .wlink { align-self: center; font-size: 15px; color: var(--muted); text-decoration: underline; text-underline-offset: 3px; padding: 10px; }
.ob .whead { max-width: 440px; display: flex; flex-direction: column; gap: 26px; }
.ob .whead h1 { font-size: 48px; font-weight: 700; letter-spacing: -.02em; line-height: 1.05; text-wrap: balance; margin: 0; }
/* The two doors sit side by side, the secondary an outlined button — the board's .row
   of .cta p + .cta s; on a narrow screen they stack, and .wdemo keeps the side gutter
   .wtop and .wcol use at the same widths. */
.ob .wctas { display: flex; gap: 12px; flex-wrap: wrap; }
.ob .wctas .cta { width: auto; padding: 0 28px; }
.ob .wctas .cta.s { padding: 0 22px; height: 56px; background: var(--surface); color: var(--ink);
                    box-shadow: 0 0 0 1px var(--line); }
@media (max-width: 940px) {
  .ob .wcenter { padding: 0; align-items: flex-start; }
  .ob .wdemo { flex-direction: column; gap: 24px; padding: 0 0 32px !important; width: 100%; }
  .ob .whero { width: 100%; height: 560px; border-radius: 0; box-shadow: none;
    -webkit-mask: linear-gradient(#000 78%, transparent); mask: linear-gradient(#000 78%, transparent); }
  .ob .whead { padding: 0 24px; align-items: stretch; text-align: center; max-width: none; }
  .ob .whead h1 { font-size: 30px; }
  .ob .wctas { flex-direction: column; }
}
@media (prefers-reduced-motion: reduce) { .ob .whero .sh, .ob .whero .fl, .ob .whero .sw { display: none; } }

/* ── the stop (under-16) ── */
.ob .stopcard { max-width: 460px; margin: 0 auto; }

@media (max-width: 720px) {
  .ob .wtop { padding: 0 20px; height: 56px; }
  .ob .wcol { padding: 4px 20px 28px; }
  .ob .wdemo { padding: 0 20px; }
  .ob .opts.c3 { grid-template-columns: 1fr; }
  .ob .opts.c3 .opt { flex-direction: row; align-items: center; }
  .ob .opts.c3 .opt .ck { align-self: center; }
  /* Long labels ("Unhealthy eating habits") can't halve — two columns overflow the viewport. */
  .ob .opts.c2 { grid-template-columns: 1fr; }
  /* Four tiles stay tiles on a phone — 2×2 rather than a column of rows. */
  .ob .opts.c4 { grid-template-columns: repeat(2, 1fr); }
  .ob .cards.c3 { grid-template-columns: 1fr; }
  .ob .vpick { flex-direction: column; gap: 12px; }
  .ob .vruler { height: 300px; }
  .ob .q { font-size: 20px; }
}
/* The three beats between the questions: twice, baseline, possible. */
.ob .twice { display: flex; gap: 28px; justify-content: center; margin-top: 28px; }
.ob .twice figure { width: 150px; text-align: center; }
.ob .twice .em { display: block; font-size: 40px; line-height: 1; margin-bottom: 10px; }
.ob .twice .col { height: 230px; border-radius: 22px; background: var(--surface); box-shadow: 0 0 0 1px var(--hair); overflow: hidden; display: flex; align-items: flex-end; }
.ob .twice .bar { width: 100%; border-radius: 22px; display: flex; align-items: center; justify-content: center; }
.ob .twice .a .bar { height: 70px; background: #E3E1DC; }
.ob .twice .b .bar { height: 180px; background: var(--accent); color: #fff; font-size: 40px; font-weight: 700; }
.ob .twice figcaption { margin-top: 14px; font-size: 17px; font-weight: 600; }
.ob .src { margin-top: 16px; font-size: 12px; color: var(--muted); }
.ob .bmeter { margin-top: 22px; padding: 20px; }
.ob .bm-r { display: flex; justify-content: space-between; align-items: center; font-size: 17px; font-weight: 600; }
.ob .bm-v { padding: 4px 12px; border-radius: 12px; background: #F4C47A; color: #fff; font-weight: 700; font-feature-settings: "tnum" 1; }
.ob .bm-sc { position: relative; height: 12px; margin-top: 18px; border-radius: 6px; background: linear-gradient(90deg, #6FA8F0 0%, #6FCB7C 14%, #6FCB7C 37%, #F2C230 43%, #F59A3E 58%, #F36464 68%, #F36464 100%); }
.ob .bm-k { position: absolute; top: 50%; width: 26px; height: 26px; margin: -13px 0 0 -13px; border-radius: 50%; background: #fff; box-shadow: 0 0 0 3px #F4C47A, 0 2px 6px rgb(0 0 0 / .2); }
.ob .bm-w { margin-top: 12px; text-align: center; font-size: 14px; font-weight: 600; letter-spacing: .12em; color: var(--faint); }
.ob .bverdict { margin-top: 14px; padding: 14px 18px; border-radius: 16px; background: #FDF1DE; }
.ob .bverdict b { display: block; font-size: 16px; }
.ob .bverdict span { font-size: 14px; color: var(--muted); }
.ob .brow { display: flex; align-items: center; gap: 14px; padding: 14px 18px; margin-top: 14px; }
.ob .brow .bt { width: 44px; height: 44px; border-radius: 12px; background: var(--accent-tint); display: grid; place-items: center; font-size: 22px; }
.ob .brow span:not(.bt) { display: block; font-size: 13px; color: var(--muted); }
.ob .brow b { font-size: 17px; }
${iconCss()}
`;
