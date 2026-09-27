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
.kcard .kfig .about { font-size: 14px; font-weight: 600; letter-spacing: 0; color: var(--muted);
  margin-right: 4px; }
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

/* The health-score row — the DAY board's columnar form of the kit's hsr (the meal sheet's is
   a single row; kitCss lands after this file, so the variant scopes itself to .hsr.day). */
.hsr.day { flex-direction: column; align-items: stretch; gap: 8px; padding: 12px 14px; }
.hsr.day .hline { display: flex; align-items: center; justify-content: space-between; }
.hsr.day .hscore { font-weight: 600; }
.hsr.day .hnum { font-size: 17px; font-weight: 700; font-variant-numeric: tabular-nums; }
.hsr.day .chev .ico { width: 16px; height: 16px; color: var(--muted); }
.hsr.day .hfrom { font-size: 12px; color: var(--muted); }
.hsb { height: 6px; border-radius: var(--r-bar); background: var(--hair); overflow: hidden; }
.hsb i { display: block; height: 100%; background: var(--ink); border-radius: var(--r-bar); }

/* The per-day score modal — the boards' 440 px card over a dimmed page. */
.scorewrap { position: fixed; inset: 0; background: color-mix(in srgb, var(--ink) 36%, transparent); display: flex;
  align-items: center; justify-content: center; z-index: 40; }
.scorecard { width: 440px; max-width: calc(100vw - 32px); padding: 24px; display: flex;
  flex-direction: column; gap: 4px; }
.scorecard .stitle { display: flex; align-items: center; justify-content: space-between; }
.scorecard .stitle b { font-size: 22px; font-weight: 700; letter-spacing: -.02em; }
.scorecard .stitle .snum { font-size: 28px; font-weight: 700; font-variant-numeric: tabular-nums; }
.scorecard .sline { font-size: 13px; color: var(--muted); margin: 2px 0 4px; }
a.hsp { color: inherit; text-decoration: none; }
.hsp .chev .ico { width: 16px; height: 16px; color: var(--muted); }
.scorecard .cta { margin-top: 14px; }

/* The meal list's column title ("Recently uploaded" — today.html's d17 over the card). */
.mealtitle { font-size: 17px; font-weight: 700; letter-spacing: -.01em; }
.meals .meal:first-of-type { border-top: 0; }

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

/* The proposal the day holds is the SHELL's card (.prop, styled where every surface reads
   it, in chat.css) — the boards' logging state gives it the ink ring, scoped to Home. */
.home .prop { box-shadow: 0 0 0 2px var(--ink); }
`;
