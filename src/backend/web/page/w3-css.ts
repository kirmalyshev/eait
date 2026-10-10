// The screens W3 owns (issue #90): the plan reveal (#402), the
// sign-up (`pay-signin`), the country (`16-country`). Board classes, the values pro.css's —
// tokens come from `.ob`'s scope in board-css.ts (`--r-card`, `--r-cta`, `--shadow`), so no
// colour, radius or shadow is retyped here. Scoped under `main.ob`, like BOARD_CSS.

import { PLAN_TIMELINE } from "@eait/shared";

export const W3_CSS = `
/* The walk's .wcol form { flex: 1; min-height: 0 } is for its one-form screens — it would
   shrink these pages' forms under their content and let a sibling draw over the overflow. */
.ob .pln form, .ob .sup form, .ob .cty form { flex: none; }

/* ── the plan reveal (#402): three cards, and the count that holds the button's place ── */
@keyframes k-up { from { transform: scaleY(0); } }
@keyframes k-fade { from { filter: opacity(0); } }
@keyframes k-gone { to { filter: opacity(0); visibility: hidden; } }
@keyframes k-draw1 { from { stroke-dashoffset: 1; } }
.ob .pln .draw1 { stroke-dasharray: 1; animation: k-draw1 ${PLAN_TIMELINE.curve.duration}s var(--ease) both; animation-delay: var(--d, 0s); }
.ob .pln .gy { transform-box: fill-box; transform-origin: 50% 100%; animation: k-up .4s var(--ease) both; animation-delay: var(--d, 0s); }
.ob .pln .gy.dn { transform-origin: 50% 0; }
.ob .pln .gx { transform-box: fill-box; transform-origin: 0 50%; animation: k-grow .5s var(--ease) both; animation-delay: var(--d, 0s); }
.ob .pln .fade { animation: k-fade .4s var(--ease) both; animation-delay: var(--d, 0s); }
.ob .pln .gone { animation: k-gone .2s var(--ease) forwards; animation-delay: var(--d, 0s); }
/* Reduce Motion: the final state crossfades in over 150 ms, and the count never shows. */
@media (prefers-reduced-motion: reduce) {
  .ob .pln.rv { animation: k-fade .15s linear both !important; }
  .ob .pln .slot .gone { display: none; }
}
.ob .wmain.pw { max-width: 1000px; }
.ob .pln form { flex: none; }
.ob .pln { width: 100%; display: flex; flex-direction: column; row-gap: 16px; }
.ob .pln h1 { font-size: 28px; margin-top: 4px; }
.ob .pln .pgrid { display: grid; grid-template-columns: 1.15fr 1fr; gap: 16px; align-items: start; }
.ob .pln .pgrid.solo { grid-template-columns: minmax(0, 520px); justify-content: center; }
.ob .pln .pcol { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.ob .pln .pgraph { display: block; overflow: visible; }
.ob .pln .pgraph .ln { stroke: var(--accent); stroke-width: 3; }
.ob .pln .jc { padding: 20px 24px; }
.ob .pln .jg { margin: 28px 8px 8px; }
.ob .pln .ink15 { fill: var(--ink); font-size: 15px; font-weight: 700; }
.ob .pln .pill { fill: #fff; font-size: 15px; font-weight: 700; }
.ob .pln .ax { font-weight: 600; }
.ob .pln .ax.end { fill: var(--ink); font-weight: 700; }
.ob .pln .oc { padding: 16px 16px 14px; }
.ob .pln .pmeth { margin: 0 4px; line-height: 1.45; }
.ob .pln .oc .top { align-items: flex-end; }
.ob .pln .oc .r { text-align: right; }
.ob .pln .oc .r .row { justify-content: flex-end; gap: 6px; }
.ob .pln .oc .row { gap: 8px; }
.ob .pln .oc .big { width: 28px; height: 28px; }
.ob .pln .oc .pic { width: 22px; height: 22px; }
.ob .pln .oc .kfig { font-size: 44px; line-height: 1; font-weight: 700; letter-spacing: -.02em; }
.ob .pln .oc .top .t13 { margin-top: 4px; }
.ob .pln .hr { height: 1px; background: var(--hair); margin: 12px 0 10px; }
.ob .pln .mrow { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.ob .pln .mfig { gap: 5px; font-size: 17px; font-weight: 700; }
.ob .pln .mfig .ico { width: 16px; height: 16px; }
.ob .pln .wc { padding: 16px; }
.ob .pln .wg { margin-top: 16px; }
.ob .pln .fig { font-weight: 700; font-size: 13px; }
.ob .pln .fig.big { font-size: 15px; }
.ob .pln .bal { position: relative; margin-top: 16px; display: flex; flex-direction: column; gap: 6px; }
.ob .pln .bal .semi:last-of-type { margin-top: 8px; }
.ob .pln .brow { display: flex; gap: 2px; height: 34px; }
.ob .pln .brow i { display: flex; align-items: center; height: 100%; padding: 0 10px; font-style: normal;
  font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; }
.ob .pln .brow .rest { background: var(--line); border-radius: 8px 0 0 8px; }
.ob .pln .brow .days { background: color-mix(in srgb, var(--accent) 32%, transparent); color: var(--accent); border-radius: 0 8px 8px 0; }
.ob .pln .brow .plan { background: var(--accent); color: #fff; border-radius: 8px; justify-content: flex-end; }
.ob .pln .bal .tick { position: absolute; top: 20px; bottom: -4px; width: 3px; margin-left: -1px; border-radius: 2px; background: var(--ink); }
.ob .pln .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.ob .pln .pfoot { width: 360px; max-width: 100%; align-self: flex-end; }
.ob .pln .slot { position: relative; min-height: 56px; }
.ob .pln .gone { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; gap: 8px;
  font-size: 15px; font-weight: 600; }
.ob .pln .lbar { height: 6px; border-radius: 3px; background: var(--hair); overflow: hidden; }
.ob .pln .lbar i { display: block; height: 100%; background: var(--accent); transform-origin: left; animation: k-grow linear both; }
.ob .pln .cta { max-width: none; }
.ob .pln h2 { margin-top: 24px; }
@media (max-width: 720px) {
  .ob .pln .pgrid { grid-template-columns: 1fr; }
  .ob .pln .pfoot { width: 100%; }
}

/* ── the sign-up (pay-signin): the app icon, the two provider buttons, the pairing card ── */
.ob .sup { max-width: 560px; margin: 0 auto; width: 100%; display: flex; flex-direction: column; gap: 18px; }
.ob .sup .hero { display: flex; justify-content: center; }
.ob .sup .hero img { width: 96px; height: 96px; border-radius: 22%; box-shadow: var(--shadow); display: block; }
.ob .sup h1 { font-size: 34px; font-weight: 700; letter-spacing: -.02em; line-height: 1.12; margin: 0; }
.ob .sup form { display: flex; flex-direction: column; gap: 8px; }
.ob .sup .cta svg { width: 20px; height: 20px; }
/* Apple's own button is black; Google's is the surface card the board draws (.cta s). */
.ob .sup .cta.apple { background: #000; color: #fff; }
.ob .sup .cta.s { background: var(--surface); box-shadow: 0 0 0 1px var(--line); height: 56px; }
.ob .sup .paircard { background: var(--surface); border-radius: var(--r-card); box-shadow: var(--shadow);
  padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.ob .sup .paircard .row-between { display: flex; align-items: center; justify-content: space-between;
  gap: 10px; flex-wrap: wrap; }
.ob .sup .paircard small { color: var(--muted); font-size: 12px; font-weight: 500; }
.ob .sup .paircard form { flex-direction: row; gap: 10px; }
.ob .sup .paircard input { flex: 1; min-width: 0; height: 48px; border-radius: var(--r-ctl);
  border: 0; box-shadow: 0 0 0 1px var(--line); padding: 0 14px; letter-spacing: .3em;
  font-family: var(--sans); font-size: 15px; font-weight: 600; color: var(--ink);
  font-variant-numeric: tabular-nums; background: var(--surface); }
.ob .sup .paircard .cta { width: auto; min-height: 48px; height: 48px; padding: 0 18px; font-size: 15px; }
.ob .sup .consent { display: flex; flex-direction: column; gap: 10px; }
.ob .sup .consent label { display: flex; gap: 10px; align-items: flex-start; font-size: 13px;
  line-height: 1.35; color: var(--muted); font-weight: 500; cursor: pointer; }
.ob .sup .consent input { flex: 0 0 20px; width: 20px; height: 20px; margin: 1px 0 0;
  appearance: none; -webkit-appearance: none; border-radius: 5px;
  box-shadow: inset 0 0 0 1.5px var(--line); background: transparent; cursor: pointer; }
.ob .sup .consent input:checked { background: var(--accent); box-shadow: none;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'><path d='M5 13l4 4 10-10'/></svg>");
  background-size: 13px; background-position: center; background-repeat: no-repeat; }
.ob .sup .consent a, .ob .sup .consent u { color: inherit; }

/* ── email sign-in (#569): the address and code pages. The boards draw the address field, the
   six digit boxes and the resend row; what is drawn here is ONE field per page, because a page
   with no JavaScript cannot auto-advance six boxes or tick a countdown — the rest is the board
   verbatim: 52px and 56px pills, inset hairlines, the t13 note pair. */
.ob .eml { max-width: 520px; margin: 0 auto; width: 100%; display: flex; flex-direction: column; gap: 16px; }
.ob .eml h1 { font-size: 34px; font-weight: 700; letter-spacing: -.02em; line-height: 1.12; margin: 0; }
.ob .eml p.m { margin: 0; }
.ob .eml p.m b { color: var(--ink); font-weight: 700; }
.ob .eml form { display: flex; flex-direction: column; gap: 8px; }
.ob .eml input { height: 52px; margin: 0; padding: 0 16px; border: 0; border-radius: var(--r-ctl);
  box-shadow: inset 0 0 0 1.5px var(--line); font-size: 17px; color: var(--ink);
  background: transparent; }
.ob .eml input:focus { box-shadow: inset 0 0 0 1.5px var(--ink); }
/* The code field reads like the boards' six boxes read: centred, spaced, bold. The .45em of
   letter-spacing leaves the last glyph's space hanging, so it is padded the same amount on the
   left to sit centred. */
.ob .eml input.codein { height: 56px; padding: 0 0 0 .45em; text-align: center;
  font-size: 24px; font-weight: 700; letter-spacing: .45em; font-variant-numeric: tabular-nums; }
.ob .eml input.codein.bad { box-shadow: inset 0 0 0 1.5px var(--bad); }
.ob .eml .eml-note { font-size: 13px; font-weight: 600; margin: 0; }
.ob .eml .eml-note.bad { color: var(--bad); }
.ob .eml .eml-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.ob .eml .eml-row form { display: contents; }
.ob .eml .t13.faint { color: var(--faint); font-weight: 600; }
.ob .eml a.t13 { color: var(--accent); font-weight: 600; }
/* A submit dressed as the boards' t13 line — a link is a GET, and a resend is a write. */
.ob .eml button.t13 { background: none; border: 0; padding: 0; margin: 0; width: auto;
  color: var(--accent); font-size: 13px; font-weight: 600; cursor: pointer; text-align: left; }
.ob .sup .notice { color: var(--warn); background: var(--warn-tint); padding: 10px 14px;
  border-radius: var(--r-ctl); font-size: 14px; line-height: 1.45; }

/* ── the country (16-country): search over the flag grid ── */
.ob .cty { max-width: 720px; margin: 0 auto; width: 100%; display: flex; flex-direction: column; gap: 18px; }
.ob .cty .srch { display: flex; align-items: center; gap: 10px; height: 48px;
  border-radius: var(--r-ctl); box-shadow: 0 0 0 1px var(--line); background: var(--surface);
  padding: 0 14px; }
.ob .cty .srch .ico { color: var(--muted); width: 18px; height: 18px; }
/* The magnifier is the search's submit — a GET on the same form, so the pick rides along.
   shell.ts's base button style is a full-width pill; this one is the icon's size and no more. */
.ob .cty .srch .srchgo { border: 0; background: none; padding: 0; margin: 0; cursor: pointer;
  color: var(--muted); display: inline-flex; width: auto; font: inherit; border-radius: 0; }
.ob .cty .srch input { flex: 1; border: 0; background: none; font: inherit; color: var(--ink);
  font-size: 15px; outline: none; }
.ob .cty form { display: flex; flex-direction: column; gap: 14px; }
.ob .cty .opts { grid-template-columns: repeat(3, 1fr); }
.ob .cty .opt { padding: 14px; font-size: 15px; }
.ob .cty .opt .flag { font-size: 22px; width: 28px; flex: 0 0 28px; text-align: center; }
.ob .cty .opt .flag.any { color: var(--muted); font-weight: 600; }
.ob .cty .opt.hide { display: none; }
.ob .cty .cta { max-width: 360px; align-self: center; }
/* The account-split note — a small muted caption under the pick, not a paragraph block. */
.ob .cty .note { margin: 0; font-size: 13px; color: var(--muted); }
@media (max-width: 720px) { .ob .cty .opts { grid-template-columns: 1fr 1fr; } }
@media (max-width: 480px) { .ob .cty .opts { grid-template-columns: 1fr; } }
`;
