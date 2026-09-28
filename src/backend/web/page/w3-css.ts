// The screens W3 owns (issue #90): the reveal (`ob-building`), the plan (`15-plan`), the
// sign-up (`pay-signin`), the country (`16-country`). Board classes, the values pro.css's —
// tokens come from `.ob`'s scope in board-css.ts (`--r-card`, `--r-cta`, `--shadow`), so no
// colour, radius or shadow is retyped here. Scoped under `main.ob`, like BOARD_CSS.

import { PLAN_REVEAL } from "@eait/shared";

export const W3_CSS = `
/* The walk's .wcol form { flex: 1; min-height: 0 } is for its one-form screens — it would
   shrink these pages' forms under their content and let a sibling draw over the overflow. */
.ob .bld form, .ob .pln form, .ob .sup form, .ob .cty form { flex: none; }

/* ── the reveal (ob-building): the count, the bar, the row ticks — all PLAN_REVEAL's data ── */
.ob .bld { text-align: center; padding-top: 2rem; }
.ob .bld .pct { font-size: 72px; font-weight: 700; letter-spacing: -.04em; line-height: 1; }
/* The sign is the page's data-sign — Intl's percentSign for the reader's language, so this
   stylesheet holds no glyph of its own. */
.ob .bld .pct::after { content: attr(data-sign); font-size: 28px; font-weight: 600; margin-left: 4px; }
.ob .bld .count { animation-duration: ${PLAN_REVEAL.durationMs / 1000}s; animation-timing-function: linear; }
.ob .bld .bld-line { font-size: 22px; font-weight: 700; letter-spacing: -.02em; line-height: 1.15; margin: 12px 0 0; }
.ob .bld .lbar { height: 6px; border-radius: 3px; background: var(--hair); overflow: hidden; margin: 18px 0 26px; }
.ob .bld .lbar i { display: block; height: 100%; background: var(--accent);
  transform-origin: left; animation: k-grow ${PLAN_REVEAL.durationMs / 1000}s linear both; }
.ob .bld .card { text-align: left; }
/* A row waits dimmed for its tick and fades up — timed by rowTicksMs, not a motion token. */
@keyframes k-tick { from { opacity: .3; } to { opacity: 1; } }
.ob .bld .chk { display: flex; align-items: center; gap: 12px; padding: 12px 0;
  border-top: 1px solid var(--hair); font-weight: 500;
  animation: k-tick ${PLAN_REVEAL.rowFadeMs / 1000}s var(--ease) both; animation-delay: var(--d, 0s); }
.ob .bld .chk:first-of-type { border-top: 0; }
.ob .bld .chk > i { width: 22px; height: 22px; border-radius: 50%; flex: 0 0 22px;
  background: var(--accent); position: relative; }
.ob .bld .chk > i::after { content: ""; position: absolute; left: 7px; top: 3px; width: 6px;
  height: 11px; border: solid #fff; border-width: 0 2px 2px 0; transform: rotate(45deg); }
.ob .bld .chk b { margin-left: auto; font-weight: 600; font-variant-numeric: tabular-nums; }
.ob .bld .go { max-width: 360px; margin: 1.5rem auto 0; }

/* ── the plan (15-plan) ── */
.ob .pln { max-width: 720px; margin: 0 auto; width: 100%; }
.ob .pln .goal { font-size: 20px; font-weight: 700; line-height: 1.25; margin: 0 0 4px; }
.ob .pln .tagx { display: inline-flex; align-items: center; gap: 5px; background: var(--surface);
  border-radius: 999px; padding: 3px 9px 3px 4px; font-size: 12px; font-weight: 600;
  letter-spacing: 0; text-transform: none; color: var(--ink);
  box-shadow: 0 1px 3px rgb(23 25 28 / .16); white-space: nowrap; }
.ob .pln .tagx .wm { width: 18px; height: 18px; }
.ob .pln .pgraph { display: block; overflow: visible; }
.ob .pln .pgraph .ln { stroke: var(--accent); stroke-width: 2.5; }
.ob .pln .kgrid { display: grid; grid-template-columns: 1.6fr repeat(4, 1fr); gap: 10px; }
.ob .pln .kcal { display: flex; flex-direction: column; justify-content: center; gap: 6px; }
.ob .pln .kcal .big { display: flex; align-items: center; gap: 8px; }
.ob .pln .kcal .big b { font-size: 28px; font-weight: 700; letter-spacing: -.02em; }
.ob .pln .kcal .big .ico { color: var(--accent); }
.ob .pln .est-more { margin-top: 4px; }
.ob .pln .est-more > summary { cursor: pointer; list-style: none; }
.ob .pln .est-more > summary::-webkit-details-marker { display: none; }
.ob .pln .est-note { font-size: 12px; color: var(--muted); line-height: 1.4; margin: .4rem 0 0; }
.ob .pln .est-foot { font-size: 12px; font-weight: 600; margin-top: 10px; }
.ob .pln .est-foot > span:first-child { color: var(--muted); }
.ob .pln .mcard { background: var(--surface); border-radius: var(--r-card); box-shadow: var(--shadow);
  padding: 14px; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.ob .pln .mcard .ico { width: 20px; height: 20px; }
.ob .pln .mcard b { font-size: 17px; font-weight: 700; font-variant-numeric: tabular-nums; }
.ob .pln .mcard small { font-size: 12px; color: var(--muted); font-weight: 500; }
.ob .pln .mcard .i-protein { color: var(--macro-protein); }
.ob .pln .mcard .i-carbs { color: var(--macro-carbs); }
.ob .pln .mcard .i-fat, .ob .pln .mcard .i-satfat { color: var(--macro-fat); }
@media (max-width: 720px) { .ob .pln .kgrid { grid-template-columns: 1fr 1fr; } }

/* ── the sign-up (pay-signin): the plate, the two provider buttons, the pairing card ── */
.ob .sup { max-width: 560px; margin: 0 auto; width: 100%; display: flex; flex-direction: column; gap: 18px; }
.ob .sup .hero { border-radius: var(--r-card); overflow: hidden; box-shadow: var(--shadow);
  aspect-ratio: 16 / 10; background: var(--hair); }
.ob .sup .hero img { width: 100%; height: 100%; object-fit: cover; display: block; }
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
