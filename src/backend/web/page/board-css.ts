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
.ob .wtop { display: flex; align-items: center; gap: 18px; height: 72px; padding: 0 48px; }
.ob .brand { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 17px; letter-spacing: -.02em; }
.ob .wm { display: inline-flex; width: 20px; height: 20px; border-radius: 50%; background: var(--accent-tint); align-items: center; justify-content: center; }
.ob .wm svg { width: 75%; height: 75%; display: block; }
.ob .sp { flex: 1; }
.ob .wmain { flex: 1; display: flex; }
.ob .wmain.one { justify-content: center; }
.ob .wcol { display: flex; flex-direction: column; gap: 18px; width: 100%; min-height: 0; padding: 8px 40px 40px; }
.ob .wcol form { display: flex; flex-direction: column; gap: 18px; flex: 1; min-height: 0; }
.ob .wcol .cta { max-width: 360px; align-self: center; }
.ob .qcol { display: flex; flex-direction: column; gap: 18px; align-items: center; margin: auto 0; }

/* Back (#53): the boards draw no arrow; the walk keeps a quiet labelled link instead */
.ob .wback { display: inline-flex; align-items: center; gap: 6px; margin: 10px 0 4px;
             color: var(--muted); font-size: 13px; font-weight: 500; text-decoration: none;
             width: fit-content; min-height: 32px; }
.ob .wback:hover { color: var(--ink); }
.ob .wback .ico { width: 16px; height: 16px; }

/* ── the dash — one lit segment per answered place, the current one the wider dash ── */
.ob .dash { display: flex; gap: 5px; }
.ob .dash i { height: 4px; flex: 1; border-radius: 999px; background: var(--line); }
.ob .dash i.on { background: var(--ink); }
.ob .dash i.now { background: var(--accent); flex: 1.7; }

/* ── the ask ── */
.ob .say { display: flex; gap: 12px; align-items: flex-start; }
.ob .spud { flex: 0 0 28px; width: 28px; height: 28px; border-radius: 50%; background: var(--accent-tint);
            display: inline-flex; align-items: center; justify-content: center; margin-top: 2px; }
.ob .spud svg { width: 78%; height: 78%; display: block; }
.ob .q { font-size: 22px; font-weight: 700; letter-spacing: -.02em; line-height: 1.15; }
.ob .notice { color: var(--warn); background: var(--warn-tint); padding: 10px 14px; border-radius: var(--r-ctl);
              font-size: 14px; line-height: 1.45; }

/* ── the primary button / secondary link ── */
.ob .cta { display: flex; align-items: center; justify-content: center; height: 56px; padding: 0 32px;
           border-radius: var(--r-cta); font-weight: 600; font-size: 16px; border: 0; cursor: pointer;
           font-family: var(--sans); width: 100%; }
.ob .cta.p { background: var(--ink); color: #fff; }
.ob .cta.s { background: none; color: var(--ink); height: 44px; }
.ob .cta.p[disabled] { opacity: .45; cursor: default; }

/* ── the unit toggle ── */
.ob .seg { display: flex; background: var(--surface); box-shadow: 0 0 0 1px var(--hair); border-radius: 12px;
           padding: 3px; align-self: center; }
.ob .seg button { border: 0; padding: 7px 18px; border-radius: 9px; font-size: 13px; font-weight: 600;
                  color: var(--muted); background: none; cursor: pointer; font-family: var(--sans); }
.ob .seg button.on { background: var(--ink); color: #fff; }

/* ── option rows ── */
.ob .opts { display: grid; gap: 10px; }
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
.ob .opts.c3 .opt { flex-direction: column; align-items: flex-start; gap: 8px; padding: 18px; }
.ob .opts.c3 .opt .ck { margin-left: 0; align-self: flex-end; }

/* ── the big number + pickers ── */
.ob .bign { font-size: 56px; font-weight: 700; letter-spacing: -.03em; line-height: 1; display: flex;
            align-items: baseline; gap: 6px; justify-content: center; }
.ob .bign small { font-size: 17px; font-weight: 500; letter-spacing: 0; color: var(--muted); }
.ob .vpick { display: flex; gap: 28px; align-items: center; justify-content: center; }

/* the age wheel: a scrollable column, snap-centred — the script drives it, the rows are real */
.ob .wheelbox { position: relative; }
.ob .wheelbox::after { content: ""; position: absolute; left: 0; right: 0; top: 50%; height: 44px;
  transform: translateY(-50%); border-top: 1px solid var(--hair);
  border-bottom: 1px solid var(--hair); pointer-events: none; }
.ob .wheel { height: 308px; width: 140px; overflow-y: auto; scroll-snap-type: y mandatory;
  padding: 132px 0; box-sizing: content-box;
  -webkit-mask: linear-gradient(transparent, #000 22%, #000 78%, transparent);
  mask: linear-gradient(transparent, #000 22%, #000 78%, transparent);
             scrollbar-width: none; -webkit-mask-image: linear-gradient(180deg, transparent, #000 38px, #000 calc(100% - 38px), transparent);
             mask-image: linear-gradient(180deg, transparent, #000 38px, #000 calc(100% - 38px), transparent); }
.ob .wheel::-webkit-scrollbar { display: none; }
.ob .wheel .wr { height: 44px; display: flex; align-items: center; justify-content: center;
                 scroll-snap-align: center; font-size: 17px; color: var(--muted); }
.ob .wheel .wr.on { font-size: 28px; font-weight: 700; color: var(--ink); }

/* the vertical ruler (height) */
.ob .vruler { width: 150px; height: 380px; position: relative;
              -webkit-mask-image: linear-gradient(180deg, transparent, #000 60px, #000 calc(100% - 60px), transparent);
              mask-image: linear-gradient(180deg, transparent, #000 60px, #000 calc(100% - 60px), transparent);
              touch-action: none; cursor: ns-resize; }
.ob .vruler .now { position: absolute; left: 0; right: 0; top: 50%; transform: translateY(-50%);
                   border-top: 2px solid var(--accent); }
.ob .vruler .lbl { position: absolute; left: 0; top: 50%; transform: translateY(-50%); font-size: 13px;
                   font-weight: 600; color: var(--ink); }

/* the horizontal ruler (weight, target) */
.ob .ruler { height: 64px; position: relative; width: 100%; max-width: 630px; margin: 0 auto;
             -webkit-mask-image: linear-gradient(90deg, transparent, #000 60px, #000 calc(100% - 60px), transparent);
             mask-image: linear-gradient(90deg, transparent, #000 60px, #000 calc(100% - 60px), transparent);
             touch-action: pan-y; cursor: ew-resize; }
.ob .ruler .now { position: absolute; left: 50%; top: 0; width: 2px; height: 26px; background: var(--ink);
                  transform: translateX(-50%); }
.ob .ruler .lbl { position: absolute; bottom: 0; transform: translateX(-50%); font-size: 12px;
                  color: var(--muted); white-space: nowrap; }
.ob .ruler .lbl.lo { color: var(--warn); font-weight: 600; }
.ob .ruler .lbl.hi { color: var(--ink); font-weight: 600; }
.ob .ruler .tint { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 8px 0 0 8px;
                   background: linear-gradient(90deg, var(--bad-tint), transparent); pointer-events: none; }

/* the live delta card under the target ruler */
.ob .live { position: relative; margin: 0 auto; background: var(--surface); box-shadow: var(--shadow);
            border-radius: var(--r-ctl); padding: 8px 14px; font-size: 15px; font-weight: 700; }
.ob .live.up { color: var(--good); } .ob .live.dn { color: var(--bad); }

/* ── pace: the three stops, the slider, the result ── */
.ob .stops { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; text-align: center;
             font-size: 13px; font-weight: 600; color: var(--muted); width: 100%; max-width: 480px; margin: 0 auto; }
.ob .stops > div { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.ob .stops > div.on { color: var(--ink); }
.ob .stops .ico { width: 26px; height: 26px; }
.ob .slider { position: relative; height: 30px; width: 100%; max-width: 480px; margin: 6px auto 0; }
.ob .slider::before { content: ""; position: absolute; left: 12px; right: 12px; top: 50%; height: 2px;
                      background: var(--line); transform: translateY(-50%); }
.ob .slider i { position: absolute; left: 12px; top: 50%; height: 2px; background: var(--ink); transform: translateY(-50%); }
.ob .slider b { position: absolute; top: 50%; width: 22px; height: 22px; border-radius: 50%;
                background: var(--ink); border: 3px solid var(--bg); transform: translate(-50%, -50%);
                cursor: ew-resize; }
.ob .est { color: var(--muted); font-size: 13px; display: block; }
.ob .paceres { text-align: center; }
.ob .paceres .res { color: var(--muted); font-size: 15px; }
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
.ob .card { background: var(--surface); border-radius: var(--r-card); box-shadow: var(--shadow); padding: 16px; }
.ob .cards { display: grid; gap: 12px; }
.ob .cards.c3 { grid-template-columns: repeat(3, 1fr); }
.ob .pict { height: 150px; border-radius: var(--r-ctl); background: var(--bg); margin-bottom: 12px;
            display: flex; align-items: center; justify-content: center; position: relative;
            overflow: hidden; }
.ob .pict .n { position: absolute; left: 12px; bottom: 10px; width: 24px; height: 24px; border-radius: 50%;
               background: var(--ink); color: #fff; font-size: 12px; font-weight: 700;
               display: flex; align-items: center; justify-content: center; }
.ob .pt { font-size: 15px; font-weight: 600; }
.ob .hero { width: 100%; height: 100%; object-fit: cover; display: block; }
.ob .vf { position: absolute; inset: 0; }
.ob .vf i { position: absolute; width: 22px; height: 22px; border: 2px solid #fff; }
.ob .vf i:nth-child(1) { top: 14px; left: 14px; border-right: 0; border-bottom: 0; }
.ob .vf i:nth-child(2) { top: 14px; right: 14px; border-left: 0; border-bottom: 0; }
.ob .vf i:nth-child(3) { bottom: 14px; left: 14px; border-right: 0; border-top: 0; }
.ob .vf i:nth-child(4) { bottom: 14px; right: 14px; border-left: 0; border-top: 0; }
.ob .macs { display: flex; gap: 6px; margin-top: 6px; }
.ob .mac { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600;
           color: var(--macro-ink, var(--ink)); background: var(--macro-tint, var(--bg));
           padding: 4px 9px; border-radius: 8px; }
.ob .mac .ico { width: 13px; height: 13px; }
.ob .mac.m-protein { --macro-ink: var(--macro-protein); --macro-tint: var(--macro-protein-t); }
.ob .mac.m-carbs { --macro-ink: var(--macro-carbs); --macro-tint: var(--macro-carbs-t); }
.ob .mac.m-fat { --macro-ink: var(--macro-fat); --macro-tint: var(--macro-fat-t); }
.ob .v { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 500; color: var(--muted); }
.ob .v i { width: 8px; height: 8px; border-radius: 50%; flex: 0 0 8px; }
.ob .v.good i { background: var(--good); } .ob .v.warn i { background: var(--warn); } .ob .v.bad i { background: var(--bad); }
.ob .tagx { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700;
            letter-spacing: .08em; text-transform: uppercase; color: var(--muted);
            background: var(--bg); padding: 5px 10px; border-radius: 999px; }
.ob .pgraph text { fill: var(--muted); font-size: 12px; font-family: var(--sans); }
.ob .pgraph .ln { stroke: var(--ink); stroke-width: 3; fill: none; stroke-linecap: round; }
.ob .ptick { position: relative; height: 30px; margin-top: 6px; }
.ob .ptick span { position: absolute; top: 0; transform: translateX(-50%); font-size: 11px;
                  font-weight: 600; background: var(--ink); color: #fff; padding: 4px 8px;
                  border-radius: 999px; white-space: nowrap; }
.ob .ptick span::after { content: ""; position: absolute; left: 50%; top: -8px; width: 1.5px; height: 8px;
                         background: var(--ink); }

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
.ob.js .numalt { display: none; }
.ob.js .pacerows { display: none; }
.ob.js .pacesel { display: block; }
.ob .pacesel { display: none; }

/* ── the welcome (00) ── */
.ob .wcenter { flex: 1; display: flex; align-items: center; justify-content: center; padding-bottom: 60px; }
.ob .wdemo { display: flex; align-items: center; justify-content: center; gap: 72px; }
.ob .vdemo { width: 290px; border-radius: 24px; overflow: hidden; box-shadow: var(--shadow);
             background: var(--surface); display: block; }
.ob .vdemo video, .ob .vdemo img { display: block; width: 100%; height: auto; aspect-ratio: 9/19.5; object-fit: cover; }
.ob .vdemo .still { display: none; }
.ob .whead { max-width: 420px; display: flex; flex-direction: column; gap: 22px; }
.ob .whead h1 { font-size: 52px; font-weight: 700; letter-spacing: -.03em; line-height: 1.1; margin: 0; }
.ob .whead .cta { max-width: 300px; }
.ob .whead .cta.s { max-width: 300px; }
@media (max-width: 940px) { .ob .wdemo { flex-direction: column; gap: 28px; } .ob .whead h1 { font-size: 34px; } .ob .wcenter { padding-bottom: 0; } }
@media (prefers-reduced-motion: reduce) {
  .ob .vdemo video { display: none; }
  .ob .vdemo .still { display: block; }
}

/* ── the stop (under-16) ── */
.ob .stopcard { max-width: 460px; margin: 0 auto; }

@media (max-width: 720px) {
  .ob .wtop { padding: 0 20px; height: 56px; }
  .ob .wcol { padding: 4px 20px 28px; }
  .ob .opts.c3 { grid-template-columns: 1fr; }
  .ob .opts.c3 .opt { flex-direction: row; align-items: center; }
  .ob .opts.c3 .opt .ck { align-self: center; }
  .ob .cards.c3 { grid-template-columns: 1fr; }
  .ob .vpick { flex-direction: column; gap: 12px; }
  .ob .vruler { height: 300px; }
  .ob .q { font-size: 20px; }
}
${iconCss()}
`;
