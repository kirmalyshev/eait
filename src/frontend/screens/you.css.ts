// You's own styles — the two-column account board (web/you.html): the identity card and the plan
// card on the left, the flat account rows and the sign-out card on the right. The editor and the
// weigh-in are panels now (#474), so their styles live with the shared `.panel` rules in
// shell.css.ts, not here.
//
// Scoped under `.you` like every surface's sheet — the classes that name kit components
// (.opt/.macs) are kitCss's own; what lives here is the board's arrangement of them plus the
// words-only helpers (`.lab`, `.d`) that are not the kit's.

export const youCss = `
/* The board's two columns, 1fr | 360px — one column in the phone's order under 761px. */
.wmain:has(.you) { max-width: 1000px; }
.you .ygrid { display: grid; grid-template-columns: 1fr 360px; gap: 24px; }
@media (max-width: 760px) { .you .ygrid { grid-template-columns: 1fr; } }

/* The narrow board (phone/web-you-narrow) puts the streak chip and the calendar button in the
   body as its first row, not in the two-row bar the shell gives .wr at this width — so the bar's
   own set (.youwr) hides here and this strip draws them instead: chip left, calb right. */
.you .youbar { display: none; }
@media (max-width: 760px) {
  .you .youbar { display: flex; align-items: center; }
  .you .youbar .calb { margin-left: auto; }
  .wtop .wr.youwr { display: none; }
}
.you .card { margin-bottom: 0; padding: 18px 20px; }

/* The quiet words — the board's lowercase labels and small notes, not the shell's caps. */
.you .lab { font-size: 12px; font-weight: 600; color: var(--muted); }
.you .t12 { font-size: 12px; }
.you .t13 { font-size: 13px; }
.you .m { color: var(--muted); }
.you .d { font-weight: 700; letter-spacing: -.02em; line-height: 1.1; }
.you .d22 { font-size: 22px; }
/* The identity card — the tinted disc (48px, the person mark inside; the board's lettered avatar
   was fixture data — no name is stored) beside the fact line, drawn the board's t13-muted way. */
.you .idcard { display: flex; align-items: center; gap: 14px; }
.you .av { width: 48px; height: 48px; flex: 0 0 48px; border-radius: 50%; background: var(--accent-tint);
  display: inline-flex; align-items: center; justify-content: center; }
.you .av .ico { width: 24px; height: 24px; color: var(--accent); }
.you .facts { font-size: 13px; color: var(--muted); }

/* Card actions drawn as text, not pills — "edit" is the quiet one. */
.you .card button.elink { border: 0; background: none; padding: 0;
  margin: 0; min-height: 0; border-radius: 0; font-size: 13px; font-weight: 600; cursor: pointer; }
.you .card button.elink { color: var(--muted); }
.you .card button.elink:hover { text-decoration: underline; }

/* The plan card's figure block is a button — the door to "How we got there" (you-basis), the
   same tap the phone's plan card takes. All button chrome off so the figures draw unchanged. */
.you .card button.planhit { display: block; width: 100%; margin: 0; padding: 0; min-height: 0;
  border: 0; border-radius: 0; background: none; box-shadow: none; font: inherit; color: inherit;
  text-align: left; cursor: pointer; }
.you .card button.planhit:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px;
  border-radius: var(--r-ctl); }

/* The flat card — hairline-separated rows, label then a quiet value and the chevron where the
   row opens something (the boards' "padding:13px 0; font-size:15px" rows). */
.you .card.flat { box-shadow: 0 0 0 1px var(--hair); padding: 4px 16px; }
.you .urows .opt { padding: 13px 0; font-size: 15px; font-weight: 500; }
.you .urows .opt .ov { margin-left: auto; font-size: 13px; color: var(--muted); }
/* The Support row's provider links (#200) — quiet, and each one reachable on its own (44px). */
.you .urows .opt .ov a { color: var(--accent); text-decoration: none; padding: 6px 0; }
.you .urows button.opt { cursor: pointer; color: inherit; text-align: left; width: 100%;
  background: none; border: 0; font: inherit; }
.you .urows .opt .ico { width: 16px; height: 16px; flex: 0 0 16px; color: var(--muted);
  margin-left: 8px; }

/* The two push switches (web/you-notifs-*): the board's 51x31 pill, a button so it takes focus. */
.you .urows [hidden] { display: none; }
.you .urows .opt.sw { align-items: center; }
.you .urows .opt .sub { font-size: 12px; color: var(--muted); margin-top: 2px; }
.you .urows .swt { margin-left: auto; width: 51px; height: 31px; border-radius: 16px; flex: 0 0 51px;
  position: relative; background: var(--line); border: 0; padding: 0; cursor: pointer; }
.you .urows .swt[aria-checked="true"] { background: var(--accent); }
.you .urows .swt i { position: absolute; top: 2px; left: 2px; width: 27px; height: 27px; border-radius: 50%;
  background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.3); }
.you .urows .swt[aria-checked="true"] i { left: 22px; }
.you .urows .swt:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

/* The stagger the board draws — rise delays as classes, because the nonce policy has no style=. */
.you .rc-1 { --d: .06s; }
.you .rc-2 { --d: .12s; }
.you .rc-3 { --d: .18s; }
`;
