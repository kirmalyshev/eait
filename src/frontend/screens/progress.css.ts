// Progress's own styles — the two-column board, the weight card's segmented range, the goal bar,
// the week and streak cards and the BMI bar (web/progress.html; W8 #95).
//
// Everything is scoped under `.prog` so the shell's primitives and the kit's `.pgraph`/`card`
// styles keep meaning what they mean elsewhere — `.lab` here is the board's quiet lowercase
// label, not the shell's uppercase one, and the cards inside the columns take their spacing from
// `.wcol`'s gap rather than `.card`'s own margin.

export const progressCss = `
/* The board's shape: two even columns 24px apart inside a 1000px wmain, one column under 761px. */
.wmain:has(.prog) { max-width: 1000px; }
.prog { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
.prog .card { margin-bottom: 0; padding: 18px 20px; }
@media (max-width: 760px) { .prog { grid-template-columns: 1fr; } }

/* The cards' shared words, scoped — lower than the shell's .lab (the board writes labels quiet
   and lowercase), and the figures/notes the cards set. */
.prog .row { display: flex; align-items: center; gap: 8px; }
.prog .between { justify-content: space-between; }
.prog .lab { font-size: 12px; font-weight: 600; letter-spacing: 0; text-transform: none; color: var(--muted); }
.prog .m { color: var(--muted); }
.prog .t12 { font-size: 12px; }
.prog .d { font-weight: 700; letter-spacing: -.02em; line-height: 1.1; }
.prog .d28 { font-size: 28px; }
.prog .est { font-size: 12px; color: var(--muted); }

/* The big figure line: the number in the display weight, the unit (and "· date") quiet beside it. */
.prog .wnum { margin-top: 6px; }
.prog .wnum .uw { color: var(--muted); font-weight: 600; }
.prog .wchart { margin-top: 8px; }
.prog svg.pgraph { display: block; }

/* The range chips — the board's .seg: a quiet pill row on the paper ground. .card button's
   house rule hands every button a 44px pill; the chips are small controls, so the rule is
   answered back, scoped. */
.prog .seg { display: flex; gap: 2px; background: var(--bg); border-radius: 999px; padding: 3px; width: 190px; }
.prog .seg button { flex: 1; border: 0; background: none; border-radius: 999px; font: inherit;
  font-size: 13px; font-weight: 600; color: var(--muted); padding: 7px 0; min-height: 0; margin: 0;
  cursor: pointer; }
.prog .seg button.on { background: var(--surface); color: var(--ink);
  box-shadow: 0 1px 2px color-mix(in srgb, var(--ink) 8%, transparent); }

/* The empty states' link — the board's quiet accent action, the same door You's "Log weight" takes. */
.prog .plink { display: inline-block; margin-top: 10px; color: var(--accent); font-size: 13px;
  font-weight: 600; text-decoration: none; }
.prog .plink:hover { text-decoration: underline; }
.prog .wempty { margin: 10px 0 0; font-size: 12px; color: var(--muted); }

/* The goal bar — the board's .bar drawn as a native progress (the share is a VALUE, never a
   style: the nonce policy allows attributes, it refuses inline style). */
.prog progress.gbar { display: block; width: 100%; height: 8px; margin: 12px 0 8px;
  appearance: none; border: 0; border-radius: 4px; overflow: hidden; background: var(--hair); }
.prog progress.gbar::-webkit-progress-bar { background: transparent; }
.prog progress.gbar::-webkit-progress-value { background: var(--accent); border-radius: 4px; }
.prog progress.gbar::-moz-progress-bar { background: var(--accent); border-radius: 4px; }
.prog .gline { font-weight: 600; }

/* The streak dots — a logged day is the accent disc with the shared check; an unlogged one is
   the hairline ring. The weekday letter sits under each, weekdayLetters's own. */
.prog .stk { margin-top: 12px; }
.prog .sd { display: flex; flex-direction: column; align-items: center; gap: 5px; }
.prog .sd .sdl { font-size: 12px; color: var(--muted); }
.prog .sdot { width: 30px; height: 30px; border-radius: 50%; display: inline-flex;
  align-items: center; justify-content: center; font-style: normal; }
.prog .sdot:not(.on) { box-shadow: inset 0 0 0 1px var(--line); }
.prog .sdot.on { background: var(--accent); }
.prog .sdot.on .ico { width: 16px; height: 16px; color: var(--accent-ink); }

/* The BMI card — the "?" button, the four-segment bar (the segment rects are one svg, so the
   tick's position is a NUMBER in an attribute, not a style the CSP would refuse) and the
   numbered labels, the current band picked out in ink. */
.prog .bmihelp { min-height: 0; padding: 0; margin: 0; border: 0; background: none;
  color: var(--muted); cursor: pointer; width: 28px; height: 28px; border-radius: 50%;
  display: inline-flex; align-items: center; justify-content: center; }
.prog .bmihelp .ico { width: 18px; height: 18px; }
.prog .bmibar { display: block; margin-top: 8px; }
.prog .bmil { display: flex; justify-content: space-between; gap: 4px; margin-top: 6px; }
.prog .bmil span { font-size: 11px; color: var(--muted); }
.prog .bmil span.on { color: var(--ink); font-weight: 600; }
.prog .bmis { margin-top: 10px; }
.prog .bmix { margin-top: 8px; }

/* The five cards rise in the board's stagger — the delays are custom properties on classes,
   because the nonce policy has no room for a style= attribute. */
.prog .rc-0 { --d: 0s; }
.prog .rc-1 { --d: .06s; }
.prog .rc-2 { --d: .12s; }
.prog .rc-3 { --d: .18s; }
.prog .rc-4 { --d: .24s; }
`;
