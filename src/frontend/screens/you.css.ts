// You's own styles — the two-column account board (web/you.html, W10 #97): the identity card,
// the weight card with its inline weigh-in, the plan card with its inline editor, the flat
// account rows, and the today column (week strip, kcal hero, macro cards, page dots).
//
// Scoped under `.you` like every surface's sheet — the classes that name kit components
// (.opt/.macs/.mcard/.week) are kitCss's own; what lives here is the board's arrangement of them
// plus the words-only helpers (`.lab`, `.est`, `.d`) that are not the kit's.

export const youCss = `
/* The board's two columns, 1000px wide — one column under the phone-width breakpoint. */
.wmain:has(.you) { max-width: 1000px; }
.you .ygrid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
@media (max-width: 760px) { .you .ygrid { grid-template-columns: 1fr; } }
.you .card { margin-bottom: 0; padding: 18px 20px; }

/* The quiet words — the board's lowercase labels and small notes, not the shell's caps. */
.you .lab { font-size: 12px; font-weight: 600; color: var(--muted); }
.you .t12 { font-size: 12px; }
.you .t13 { font-size: 13px; }
.you .m { color: var(--muted); }
.you .d { font-weight: 700; letter-spacing: -.02em; line-height: 1.1; }
.you .d22 { font-size: 22px; }
.you .est { font-size: 12px; font-weight: 600; color: var(--muted); }

/* The identity card — the tinted disc (48px, the person mark inside) beside the fact line. */
.you .idcard { display: flex; align-items: center; gap: 14px; }
.you .av { width: 48px; height: 48px; flex: 0 0 48px; border-radius: 50%; background: var(--accent-tint);
  display: inline-flex; align-items: center; justify-content: center; }
.you .av .ico { width: 24px; height: 24px; color: var(--accent); }
.you .facts { font-size: 15px; font-weight: 500; }

/* Card actions drawn as text, not pills — "Log weight" is the accent link, "edit" the quiet one. */
.you .card button.plink, .you .card button.elink { border: 0; background: none; padding: 0;
  margin: 0; min-height: 0; border-radius: 0; font-size: 13px; font-weight: 600; cursor: pointer; }
.you .card button.plink { color: var(--accent); }
.you .card button.elink { color: var(--muted); }
.you .card button.plink:hover, .you .card button.elink:hover { text-decoration: underline; }

/* The weight chart's own tempo (the board's, not the Progress card's): the line draws, then the
   points pop at .9/1.0/1.1/1.2 — pd-N is the kit's delay class, re-timed here for this board. */
.you .wchart { margin-top: 8px; }
.you .pgraph.wl circle.pd-0 { animation-delay: .9s; }
.you .pgraph.wl circle.pd-1 { animation-delay: 1s; }
.you .pgraph.wl circle.pd-2 { animation-delay: 1.1s; }
.you .pgraph.wl circle.pd-3 { animation-delay: 1.2s; }
.you .pgraph.wl circle { animation-delay: 1.2s; }

/* The inline editors — the weigh-in and the plan edit sit inside their card, rows of
   label + control like the flat card's rows. */
.you .wedit, .you .editrow { display: flex; align-items: center; gap: 10px; }
.you .wedit { flex-direction: column; align-items: stretch; margin-top: 12px; }
.you .wrow { display: flex; align-items: center; gap: 8px; }
.you .editrow { padding: 8px 0; }
.you .editrow .lab { flex: 1; }
.you .wedit input, .you .editrow input { font: inherit; font-size: 16px; padding: 8px 12px;
  border: 1px solid var(--line); border-radius: var(--r-ctl); background: var(--surface);
  color: var(--ink); width: 120px; min-height: 40px; }
.you .weditbtns { display: flex; gap: 8px; margin-top: 10px; }
.you .weditbtns .cta { width: auto; min-height: 40px; padding: 0 18px; font-size: 14px; }

/* The flat card — hairline-separated rows, label then a quiet value or a control. The kit's
   .opt keeps the check-disc/vars for the forms; here it is a plain row, 15px. */
.you .card.flat { box-shadow: 0 0 0 1px var(--hair); }
.you .urows .opt { padding: 13px 0; font-size: 15px; font-weight: 500; }
.you .urows .opt .ov { margin-left: auto; font-size: 13px; color: var(--muted); }
.you .urows button.opt { cursor: pointer; color: inherit; text-align: left; }
.you .urows .pick { margin-left: auto; font: inherit; font-size: 14px; font-weight: 500;
  padding: 6px 10px; border-radius: 999px; min-height: 36px;
  border: 1px solid var(--line); background: var(--surface); color: var(--ink); }
.you .editrow .pick { font: inherit; font-size: 14px; padding: 8px 12px; min-height: 40px;
  border: 1px solid var(--line); border-radius: var(--r-ctl); background: var(--surface);
  color: var(--ink); }

/* The top bar's date row (wtop's right side): the chevrons are 32px icon buttons, the date is
   14/500 between them — the bar itself is the shell's .wr. */
.wtop .wr .barbtn { width: 32px; height: 32px; flex: 0 0 32px; border-radius: 50%; border: 0;
  background: var(--surface); box-shadow: 0 0 0 1px var(--hair); color: var(--ink);
  cursor: pointer; font: inherit; font-size: 16px; line-height: 1; }
.wtop .wr .barbtn:disabled { opacity: .4; cursor: default; }
.wtop .wr .bardate { white-space: nowrap; }

/* The today column — the strip bleeds to the column edges (the board's -16px), the hero is the
   48px figure with the 104 ring beside it, then the three macro cards and the page dots. */
.you .weekbleed { margin: 0 -16px; }
.you .dayhero { display: flex; align-items: center; justify-content: space-between; }
.you .dayhero .hnum { font-size: 48px; display: block; }
.you .dayhero .mring { margin-top: 0; }
.you .pdots { display: flex; justify-content: center; gap: 6px; }
.you .pdot { width: 6px; height: 6px; border-radius: 50%; background: var(--line); }
.you .pdot.on { background: var(--ink); }

/* The stagger the board draws — rise delays as classes, because the nonce policy has no style=. */
.you .rc-1 { --d: .06s; }
.you .rc-2 { --d: .12s; }
.you .rc-3 { --d: .18s; }
`;
