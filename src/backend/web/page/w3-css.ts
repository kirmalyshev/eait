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
/* Reduce Motion: the final state crossfades in over 150 ms, and the count never shows. */
@media (prefers-reduced-motion: reduce) {
  .ob .pln.rv { animation: k-fade .15s linear both !important; }
  .ob .ld { display: none !important; }
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
.ob .pln .cta { max-width: none; }
.ob .pln h2 { margin-top: 24px; }
/* ── 18 / 18b (ieat-app#2050): the tick, the goal said as a sentence, the four cards ── */
.ob .pln.ldg, .ob .pln.ldg * { animation-delay: calc(var(--d, 0s) + var(--ld)) !important; }
/* The fold's contents start animating when it opens, long after the loader: no offset there. */
.ob .pln.ldg .howc * { animation-delay: var(--d, 0s) !important; }
.ob .pln .ok { width: 40px; height: 40px; border-radius: 50%; background: var(--accent); display: grid; place-items: center; margin: 8px auto 0; }
.ob .pln .ok svg { width: 22px; height: 22px; stroke: #fff; stroke-width: 3; fill: none; }
.ob .pln h1.hd { text-align: center; font-size: 28px; line-height: 1.15; font-weight: 700; letter-spacing: -.03em; margin: 4px 0; text-wrap: balance; }
.ob .pln .ct { font-size: 17px; font-weight: 700; margin: 0 0 4px; }
.ob .pln .cs { font-size: 13px; color: var(--muted); margin: 0 0 12px; }
.ob .pln .card:not(.jc):not(.wc) { padding: 18px 20px; }
.ob .pln .kcb { display: flex; align-items: center; gap: 14px; padding: 14px 16px; border-radius: 16px; background: var(--bg); }
.ob .pln .kcb .tile { width: 48px; height: 48px; flex: none; border-radius: 50%; background: #FBEFD9; display: grid; place-items: center; }
.ob .pln .kcb .tile .ico { width: 26px; height: 26px; color: #D48A1C; }
.ob .pln .kcb b { display: block; font-size: 40px; font-weight: 700; letter-spacing: -.04em; line-height: 1; }
.ob .pln .kcb span, .ob .pln .mt span { font-size: 13px; color: var(--muted); }
.ob .pln .mt { display: flex; gap: 10px; margin-top: 10px; }
.ob .pln .mt div { flex: 1; padding: 12px; border-radius: 16px; background: var(--bg); }
.ob .pln .mt .ico { width: 22px; height: 22px; }
.ob .pln .mt b { display: block; margin-top: 6px; font-size: 20px; font-weight: 700; }
.ob .pln .pib { padding: 14px 16px; border-radius: 16px; background: var(--bg); display: flex; flex-direction: column; gap: 12px; margin-top: 8px; }
.ob .pln .pir { display: flex; align-items: flex-start; gap: 10px; font-size: 16px; line-height: 1.35; }
.ob .pln .pir .pg { width: 20px; flex: 0 0 20px; text-align: center; }
.ob .pln .pir span { color: var(--muted); }
.ob .pln .st { display: flex; flex-direction: column; gap: 10px; margin-top: 8px; }
.ob .pln .st .sr { position: static; width: auto; height: auto; overflow: visible; clip-path: none; white-space: normal;
  display: flex; align-items: center; gap: 14px; padding: 12px 14px; border-radius: 16px; background: var(--bg); font-size: 16px; font-weight: 600; }
.ob .pln .st .ti { width: 44px; height: 44px; flex: 0 0 44px; border-radius: 12px; background: var(--surface); display: grid; place-items: center; overflow: hidden; }
.ob .pln .st .ti img { width: 100%; height: 100%; object-fit: cover; }
.ob .pln .st .ti .ico { width: 22px; height: 22px; }
.ob .pln .tri { display: flex; gap: 1px; }
.ob .pln .tri .ico { width: 14px !important; height: 14px !important; }
.ob .pln .howc summary { list-style: none; cursor: pointer; text-align: center; padding: 6px 0; font-size: 15px; }
.ob .pln .howc summary::-webkit-details-marker { display: none; }
.ob .pln .howc[open] summary { margin-bottom: 12px; }
.ob .pln .howc .pmeth { margin-top: 12px; }

/* ── 17, the loader: the ring fills while the computed numbers roll under it, then lifts ── */
@keyframes k-ring { from { stroke-dashoffset: 408; } to { stroke-dashoffset: 0; } }
@keyframes k-lift { to { opacity: 0; visibility: hidden; } }
@keyframes k-roll { to { transform: translateY(calc(-28px * (var(--rows) - 1))); } }
.ob .ld { position: fixed; inset: 0; z-index: 20; background: var(--bg); display: flex; flex-direction: column;
  align-items: center; justify-content: center; padding: 0 18px; animation: k-lift .35s var(--ease) var(--t) forwards; }
.ob .ld .ring { position: relative; width: 226px; height: 226px; }
.ob .ld svg { width: 226px; height: 226px; transform: rotate(-90deg); }
.ob .ld circle { fill: none; stroke-width: 12; stroke-linecap: round; }
.ob .ld .t { stroke: var(--accent-tint); }
.ob .ld .f { stroke: var(--accent); stroke-dasharray: 408; animation: k-ring var(--t) cubic-bezier(.4,.1,.6,.9) both; }
.ob .ld .pct { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  font-size: 56px; font-weight: 700; letter-spacing: -.04em; color: var(--accent); }
.ob .ld .pct .count { animation-duration: var(--t); animation-timing-function: cubic-bezier(.4,.1,.6,.9); }
.ob .ld .pct small { font-size: 30px; font-weight: 500; margin-left: 2px; }
.ob .ld h2 { margin: 44px 0 0; font-size: 26px; font-weight: 700; letter-spacing: -.035em; text-align: center; }
.ob .ld .cap { margin-top: 22px; height: 56px; overflow: hidden;
  -webkit-mask: linear-gradient(#000 50%, transparent 95%); mask: linear-gradient(#000 50%, transparent 95%); }
.ob .ld .cap div { animation: k-roll var(--t) both; }
.ob .ld .cap p { margin: 0; height: 28px; line-height: 28px; text-align: center; font-size: 19px; color: var(--muted); font-variant-numeric: tabular-nums; }
.ob .ld .cap b { color: var(--ink); font-weight: 600; opacity: .75; }
@media (max-width: 720px) {
  .ob .pln .pgrid { grid-template-columns: 1fr; }
  .ob .pln .pfoot { width: 100%; }
}

/* ── the sign-up (19): the heading, the provider buttons, the consent ── */
/* 19 is one 400px column: heading, buttons and consent share its edges. */
.ob .sup { max-width: 400px; margin: 0 auto; width: 100%; display: flex; flex-direction: column; gap: 18px; }
.ob .sup h1 { font-size: 34px; font-weight: 700; letter-spacing: -.02em; line-height: 1.12; margin: 0; }
/* With no bar above it (the returning person's sign-in) the heading keeps the bar's room. */
.ob .sup > h1:first-child { margin-top: 40px; }
.ob .sup form { display: flex; flex-direction: column; gap: 8px; }
.ob .sup .cta { max-width: none; align-self: stretch; }
.ob .sup .cta svg { width: 20px; height: 20px; }
/* Apple's own button is black; Google's is the surface card the board draws (.cta s). */
.ob .sup .cta.apple { background: #000; color: #fff; }
.ob .sup .cta.s { background: var(--surface); box-shadow: 0 0 0 1px var(--line); height: 56px; }
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
/* Refer a friend (#899): the invite page and the friend's-link step — ob-referral-*.html. */
.ob .ref { max-width: 420px; margin: 0 auto; width: 100%; display: flex; flex-direction: column; gap: 14px; }
.ob .ref form { display: flex; flex-direction: column; gap: 10px; }
.ob .ref .wctas { flex-direction: column; gap: 6px; margin-top: 10px; }
.ob .ref .wctas .cta { width: 100%; }
.ob .ref input { font: inherit; font-size: 17px; height: 54px; padding: 0 16px; border: 1.5px solid var(--ink);
  border-radius: 14px; background: var(--surface); color: var(--ink); }
.ob .ref .note { font-size: 13px; color: var(--muted); text-align: center; margin: 0; }
.ob .ref .note[role=status] { color: var(--accent); font-weight: 600; text-align: left; }
.ob .ref .notice { font-size: 13px; font-weight: 600; color: var(--bad); margin: 0; }
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
