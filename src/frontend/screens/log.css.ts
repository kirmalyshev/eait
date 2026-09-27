// The log surface's own styles — `#/log` (W5, #92). The frame, tokens, motion verbs and the W1
// kit classes are generated or shared; what is here is this surface's geometry: the two-column
// result views the boards draw at 1fr·360/400 px, the centred upload and refusal columns, the
// drop zone's height and the type sizes the boards set in one-off styles.

export const logCss = `
/* The centred states — the upload column at 640 px and the refusal at 560, held mid-height the
   way the boards centre them (align-content:center on the wmain). */
.log { display: flex; flex-direction: column; gap: 18px; min-width: 0; }
/* The board's upload main is narrower (wmain one at 640 — the column is 560): a column-flex
   child's margin:auto suppresses stretch AND centres on both axes, so the width has to be
   explicit or the column shrink-wraps to its content (#171). */
.wmain:has(.log.centre) { max-width: 640px; }
.log.centre { width: 100%; margin: auto; }
.log.refused { text-align: center; }
.log h1 { margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -.02em; }

/* The drop zone — the shell's .drop gains this surface's height and radius. */
.log .drop { min-height: 300px; gap: 10px; border-radius: var(--r-card); background: var(--surface); }
.log .drop .ico { font-size: 44px; color: var(--ink); }
.log .drop .drop-lead { font-size: 17px; }
/* The note is the boards' .box restyled for this column — hairline shadow, no border, no
   vertical padding inside the 48px row. */
.log .lognote { width: 100%; box-sizing: border-box; font: inherit; font-size: 15px;
  min-height: 48px; padding: 0 16px; border: 0; box-shadow: 0 0 0 1px var(--hair);
  border-radius: 10px; background: var(--surface); color: var(--ink); }

/* The two-column results — the photo on the left, the card column on the right at the boards'
   widths; the photo's height is the surface's (the kit draws none). */
.loggrid { display: grid; grid-template-columns: 1fr 360px; gap: 24px; align-items: start; }
.loggrid.wide { grid-template-columns: 1fr 400px; }
.logcol { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
.log .hero { height: 600px; border-radius: var(--r-card); }
.log .hero.reading { height: 560px; }
.log .logcol.tall { height: 560px; }
.log .logpush { flex: 1; }

/* The meal card — name at 19 px, the kcal figure with its icon at the register's display size. */
.log .mealname { font-size: 19px; font-weight: 600; letter-spacing: -.02em; }
.log .kcalrow { display: flex; gap: 4px; align-items: baseline; }
.log .kcalrow .ico { font-size: 18px; align-self: center; }
.log .kcalrow b { font-size: 28px; font-weight: 700; letter-spacing: -.02em; }
.log .kcalrow span { font-size: 13px; color: var(--muted); }
.log .hr { height: 1px; background: var(--hair); margin: 12px 0; }
.log .logsay p { font-weight: 600; font-size: 15px; line-height: 1.35; margin: 0; }
.log .logsay.q p { font-size: 20px; }
/* The rough-guess mark is the care colour's only use on the card — "this is an estimate". */
.log .rough { display: flex; align-items: center; gap: 6px; margin-top: 10px;
  font-size: 13px; font-weight: 600; color: var(--care); }
.log .rough .ico { font-size: 16px; }
.log .logday { font-size: 13px; color: var(--muted); text-align: center; font-variant-numeric: tabular-nums; }
.log .logbtns { display: flex; gap: 10px; margin-top: 8px; }
.log .dayrow { display: flex; justify-content: space-between; font-size: 13px; }
.log .dayrow .num b { font-size: 15px; }
.log .bar { height: 6px; border-radius: 3px; background: var(--hair); margin-top: 10px; overflow: hidden; }
.log .bar i { display: block; height: 100%; background: var(--accent); }

/* The refusal's empty plate — the box is drawn, never a photo. */
.log .plate { height: 300px; border-radius: var(--r-card); box-shadow: inset 0 0 0 1px var(--line);
  display: flex; align-items: center; justify-content: center; }
.log .plate .ico { font-size: 64px; color: var(--muted); }

@media (max-width: 760px) {
  .loggrid, .loggrid.wide { grid-template-columns: 1fr; }
  .log .hero, .log .hero.reading { height: 320px; }
  .log .logcol.tall { height: auto; }
}
`;
