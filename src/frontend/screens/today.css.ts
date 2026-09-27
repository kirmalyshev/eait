// Home's own styles (W4, #91) — the boards' two-column `wmain` is the shell's; what is here is
// this surface: the streak chip and the date nav in the bar, the calorie card's two forms, the
// macro-card pages and their dot switcher, the health-score row and the per-day score modal,
// the empty/failed day cards, the proposal card, and the in-diary composer.

export const todayCss = `
/* The top bar's right side: the streak chip, then the date with its day arrows (today.html's
   wtop). frame.bar is a flex row already; these only size its parts. */
.homebar { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 500;
  margin-left: 14px; }
.homebar .dlabel { font-weight: 500; white-space: nowrap; }
.darrow { width: 32px; height: 32px; flex: 0 0 32px; border: 0; border-radius: 50%;
  background: var(--surface); box-shadow: 0 0 0 1px var(--hair); display: inline-flex;
  align-items: center; justify-content: center; cursor: pointer; color: var(--ink);
  font: inherit; padding: 0; }
.darrow:disabled { opacity: .4; cursor: default; }
.darrow:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.darrow .ico { width: 18px; height: 18px; }

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
.kcard.over .kfig { color: var(--bad); }
.kcard .klab { font-size: 13px; font-weight: 600; color: var(--muted); }
.kcard .klab .caret { display: inline-block; margin-left: 2px; }
.kcard .mring { margin: 0; }

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

/* The health-score row — a compact link card with the score bar, opening the per-day board. */
.hsr { display: flex; flex-direction: column; gap: 8px; padding: 12px 14px;
  border-radius: 12px; box-shadow: 0 0 0 1px var(--hair); background: var(--surface);
  color: var(--ink); text-decoration: none; font: inherit; text-align: left; cursor: pointer;
  border: 0; width: 100%; }
.hsr .hline { display: flex; align-items: center; justify-content: space-between; }
.hsr .hscore { font-weight: 600; }
.hsr .hnum { font-size: 17px; font-weight: 700; font-variant-numeric: tabular-nums; }
.hsr .chev .ico { width: 16px; height: 16px; color: var(--muted); }
.hsb { height: 6px; border-radius: 3px; background: var(--hair); overflow: hidden; }
.hsb i { display: block; height: 100%; background: var(--ink); border-radius: 3px; }
.hsr .hfrom { font-size: 12px; color: var(--muted); }

/* The per-day score modal — the boards' 440 px card over a dimmed page. */
.scorewrap { position: fixed; inset: 0; background: rgba(23,25,28,.36); display: flex;
  align-items: center; justify-content: center; z-index: 40; }
.scorecard { width: 440px; max-width: calc(100vw - 32px); padding: 24px; display: flex;
  flex-direction: column; gap: 4px; }
.scorecard .stitle { display: flex; align-items: center; justify-content: space-between; }
.scorecard .stitle b { font-size: 22px; font-weight: 700; letter-spacing: -.02em; }
.scorecard .stitle .snum { font-size: 28px; font-weight: 700; font-variant-numeric: tabular-nums; }
.scorecard .sline { font-size: 13px; color: var(--muted); margin: 2px 0 4px; }
.hsp { display: flex; align-items: center; gap: 12px; padding: 11px 0;
  border-top: 1px solid var(--hair); font-size: 15px; font-weight: 500; color: inherit;
  text-decoration: none; }
.hsp small { display: block; font-size: 12px; font-weight: 500; color: var(--muted);
  margin-top: 1px; }
.hsp .pts { margin-left: auto; font-weight: 700; font-variant-numeric: tabular-nums; }
.hsp .chev .ico { width: 16px; height: 16px; color: var(--muted); }
.scorecard .cta { margin-top: 14px; }

/* The day column's label ("Thursday 24 September" over the meal card). */
.daylab { font-size: 12px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase;
  color: var(--muted); }

/* The meal list's section title ("Recently uploaded"). */
.mealtitle { font-size: 17px; font-weight: 700; letter-spacing: -.01em; }

/* The empty day — a dashed card holding the plate mark and Spud's line. */
.emptycard { height: 420px; display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 16px; background: none; box-shadow: none;
  border: 1.5px dashed var(--line); border-radius: var(--r-card); }
.emptycard .plate { width: 56px; height: 56px; border-radius: 50%;
  box-shadow: inset 0 0 0 1.5px var(--faint); position: relative; }
.emptycard .plate::after { content: ""; position: absolute; inset: 16px; border-radius: 50%;
  box-shadow: inset 0 0 0 1.5px var(--faint); }
.emptycard .say { align-items: center; }
.emptycard .say p { font-weight: 600; font-size: 17px; margin: 0; }

/* The couldn't-load day — Spud cares, one line, one retry. */
.failcard { display: flex; justify-content: center; padding: 56px 16px; }
.failcard p { font-weight: 600; font-size: 15px; line-height: 1.35; margin: 0; }
.failcard .cta { width: auto; display: inline-flex; min-height: 40px; padding: 0 16px;
  font-size: 14px; margin-top: 10px; }

/* THE PROPOSAL CARD (today-logging): ink-ringed, the lead, the name with its kcal, each item
   with its grams and its kcal, the macro chips with a sat-fat fourth, the verdict lines, and
   Log it / No. The message's own time rides at the right of the verdict row — only when the
   tab knows it. */
.prop { box-shadow: 0 0 0 2px var(--ink); }
.prop .pname { display: flex; align-items: center; justify-content: space-between;
  margin: 8px 0 10px; }
.prop .pname b { font-size: 19px; font-weight: 700; letter-spacing: -.02em; }
.prop .pname .num { display: flex; align-items: baseline; gap: 4px; }
.prop .pname .num .ico { width: 14px; height: 14px; align-self: center; }
.prop .pname .num b { font-size: 28px; }
.prop .pname .num span { font-size: 13px; color: var(--muted); }
.prop .pitem { display: flex; align-items: center; justify-content: space-between;
  padding: 8px 0; border-top: 1px solid var(--hair); font-weight: 500; }
.prop .pitem .ig { color: var(--muted); font-weight: 400; margin-left: 6px; }
.prop .pitem .pk { font-weight: 600; font-variant-numeric: tabular-nums; }
.prop .hr { height: 1px; background: var(--hair); margin: 12px 0; }
.prop .vts { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.prop .vts .t12 { margin-left: auto; font-size: 12px; color: var(--muted); }
.prop .pact { display: flex; gap: 10px; margin-top: 14px; }
.prop .pact .cta.p { flex: 1; }
.prop .pact .cta.s { flex: 0 0 120px; }

/* The in-diary composer (today-logging): the round-cornered field and the round accent send —
   text only; a photo enters through "Upload a photo". */
.tcompose { display: flex; gap: 10px; align-items: center; }
.tcompose .box { flex: 1; min-height: 48px; border: 0; border-radius: 24px;
  background: var(--surface); box-shadow: 0 0 0 1px var(--hair); padding: 0 16px;
  font: inherit; font-size: 15px; color: var(--ink); }
.tcompose .box::placeholder { color: var(--faint); }
.tcompose .ib { width: 44px; height: 44px; flex: 0 0 44px; border-radius: 50%; border: 0;
  display: inline-flex; align-items: center; justify-content: center; cursor: pointer;
  background: var(--accent); color: var(--accent-ink); padding: 0; }
.tcompose .ib .ico { width: 18px; height: 18px; }
.tcompose .ib:disabled { opacity: .45; cursor: default; }
.tcompose .ib:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
`;
