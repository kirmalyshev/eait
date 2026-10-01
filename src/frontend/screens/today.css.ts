// Home's own styles (W4, #91; the F layout, #335) — the boards' two-column `wmain` is the
// shell's; what is here is this surface: the calendar button in the bar, the week strip's
// three-week clip, the F day card (the hero, the hairline, the bar rows, the dots inside),
// the diary column's list/empty/failed states and the day note, the per-day score modal, the
// photo queue (#1318), and the in-diary composer.

export const todayCss = `
/* The top bar's right side: the streak chip, then the boards' calendar button (.calb — 36 px,
   radius 10, the hairline ring). The ‹ › arrows are gone — the week moves by strip drag, wheel
   and keys (F, #335). */
.calb { width: 36px; height: 36px; border: 0; border-radius: 10px; box-shadow: 0 0 0 1px var(--hair);
  display: flex; align-items: center; justify-content: center; background: var(--surface);
  cursor: pointer; }
.calb .ico { width: 18px; height: 18px; color: var(--ink); }
.calb:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

/* THE WEEK STRIP — the boards' flat-tint row, the kit's .week/.wtint inside a one-week clip.
   The strip mounts once: .wtrack carries previous|current|next so a drag pulls the neighbour
   in — the translateX is in column-widths (-100% is the current week); under the finger the
   transition is off, past 40 px the 260 ms ease-out slides the week home, short of it the same
   transition springs back. .rest on a rebuilt week silences the rings' draw-in. */
.weekwrap { margin: 0 -16px; overflow: hidden; flex-shrink: 0;
  touch-action: pan-y; -webkit-touch-callout: none; user-select: none; }
.wtrack { display: flex; transform: translateX(-100%); transition: transform .26s var(--ease); }
.wtrack > .week { flex: 0 0 100%; box-sizing: border-box; }
.wtrack > .week.rest .fg { animation: none; }

/* THE DAY CARD — one card, two pages in its own clip (the boards' .dayc): the 128 px hero, the
   hairline, the fixed 160 px row area, the dots inside. */
.dayw { position: relative; flex-shrink: 0; }
.dayc { background: var(--surface); border-radius: var(--r-card); box-shadow: var(--shadow);
  overflow: hidden; touch-action: pan-y; }
.dtrack { display: flex; transition: transform .26s var(--ease); }
.dpage { flex: 0 0 100%; min-width: 0; box-sizing: border-box; }

/* The kcal hero — 128 px, the figure and the label beside the 96 px ring. The whole band is a
   button only on today-with-meals (the swap arrows in the label toggle left↔eaten, the 150 ms
   crossfade on the figure block). Over reads in --over, the unread day dashes. */
.hk { height: 128px; display: flex; align-items: center; justify-content: space-between;
  padding: 0 20px; width: 100%; border: 0; background: none; font: inherit; text-align: left; }
button.hk { cursor: pointer; }
.hk > div { min-width: 0; transition: filter .15s ease; }
.hk > div.xfd { filter: opacity(0); }
.hk .fig { display: block; font-size: 48px; font-weight: 700; letter-spacing: -.02em;
  line-height: 1.05; font-variant-numeric: tabular-nums; }
.hk .lbl { display: flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 600;
  color: var(--muted); margin-top: 2px; }
.hk .lbl svg { width: 12px; height: 12px; }
.hk.over .fig, .hk.over .lbl { color: var(--over); }
.hk.dash .fig { color: var(--line); }
.hk:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.kr { position: relative; width: 96px; height: 96px; flex: 0 0 96px; display: flex;
  align-items: center; justify-content: center; }
.kr svg.r { position: absolute; inset: 0; transform: rotate(-90deg); }
.kr svg.r circle { fill: none; }
.kr .fl { color: var(--ink); }
.hk.over .kr .fl { color: var(--over); }
.hk.dash .kr .fl { color: var(--line); }

/* The score hero — page 2's 128 px band: "Day score · {n}/10 ›" over the ink bar; a real
   button while the day has a score — it opens the breakdown sheet (the score row is gone). */
.hsc { height: 128px; display: flex; flex-direction: column; justify-content: center; gap: 10px;
  padding: 0 20px; width: 100%; border: 0; background: none; font: inherit; text-align: left; }
button.hsc { cursor: pointer; }
.hsc .hrow { display: flex; align-items: center; justify-content: space-between; }
.hsc .hsct { font-size: 15px; font-weight: 600; }
.hsc .fig { font-size: 34px; font-weight: 700; letter-spacing: -.02em;
  font-variant-numeric: tabular-nums; }
.hsc .fig small { font-size: 15px; font-weight: 600; color: var(--muted); }
.hsc.dash .fig { color: var(--line); }
.hsc:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.hsb { height: 6px; border-radius: 3px; background: var(--hair); overflow: hidden; }
.hsb i { display: block; height: 100%; background: var(--ink); border-radius: 3px; }

/* The hairline between the hero and the rows. */
.dayc .hl { height: 1px; background: var(--hair); margin: 0 20px; }

/* The row area — fixed 160 px, three or four rows share it evenly, so a page pan never moves
   the dots or anything under the card. */
.rows { height: 160px; padding: 16px 20px; display: flex; flex-direction: column;
  justify-content: space-between; }
.mrow { display: block; width: 100%; border: 0; background: none; padding: 0; font: inherit;
  text-align: left; border-radius: 8px; }
.mrow .h { display: flex; align-items: center; gap: 8px; font-size: 13px; }
.mrow .h .ico { width: 16px; height: 16px; flex: 0 0 16px; }
.mrow .h > span { flex: 1; font-weight: 600; }
.mrow .h b { font-weight: 700; font-variant-numeric: tabular-nums; }
.mrow .h b small { font-size: 13px; font-weight: 400; color: var(--muted); }
.mrow.ov .h b small { font-weight: 600; color: var(--ink); }
.mrow .bar { display: block; margin-top: 6px; height: 6px; border-radius: 1px;
  background: var(--hair); overflow: hidden; }
.mrow .bar i { display: block; height: 6px; border-radius: 1px; }
/* A tippable row takes the hovered pill while its tip is shut; open it wears none. */
.mrow.tip { cursor: pointer; }
.mrow.tip:not(.open):hover { background: var(--hair); margin: -4px -8px; padding: 4px 8px; }
.mrow.tip:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }

/* The macro tip — the boards' .tipa: an inline panel INSIDE the row under its bar, the macro's
   tint (--t; the neutral kcal tint when .ov). .rows.open drops the fixed height and the JS-set
   gap keeps the closed rows' spacing; the panel expands in 220 ms, its sentence fades over
   150 ms, and reduced motion makes both instant (the global reduce block). */
.rows.open { height: auto; justify-content: flex-start; }
.tipa { display: grid; grid-template-rows: 0fr; margin-top: 0;
  transition: grid-template-rows .22s var(--ease), margin-top .22s var(--ease); }
.tipa.on { grid-template-rows: 1fr; margin-top: 10px; }
.tipa-i { display: block; overflow: hidden; min-height: 0; }
.tipa-c { display: block; background: var(--t); border-radius: 10px; padding: 10px 12px;
  font-size: 13px; line-height: 18px; font-weight: 400; color: var(--ink); opacity: 0;
  transition: opacity .15s ease; }
.tipa.on .tipa-c { opacity: 1; }

/* The dots inside the card — two 6 px dots, the active one ink; .none keeps the space on the
   failed read (the card's height never changes) while the switcher stays out of the tab order. */
.dayc .dots { display: flex; justify-content: center; gap: 12px; padding: 0 0 14px; }
.dayc .dots button { width: 24px; height: 24px; border: 0; background: none; padding: 0;
  display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
.dayc .dots i { width: 6px; height: 6px; border-radius: 3px; background: var(--line);
  pointer-events: none; }
.dayc .dots button.on i { background: var(--ink); }
.dayc .dots button:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.dayc .dots.none { visibility: hidden; }

/* THE DIARY COLUMN — the boards' .hsec title, the .dlist meal card, the .hnote line, the
   .hempty panel (solid, the log-a-meal door), the .herr retry. The column is a 16-gap flex
   stack; .home is the element the wcol holds. */
.home { display: flex; flex-direction: column; gap: 16px; }
.hsec { font-size: 17px; font-weight: 700; letter-spacing: -.01em; }
.dlist { background: var(--surface); border-radius: var(--r-card); box-shadow: var(--shadow);
  padding: 4px 16px; }
/* Inside the card's own 4 px the rows keep their 12 px — the kit's first/last padding
   collapse would clip them otherwise (the boards' dlist .meal set). */
.dlist .meal, .dlist .meal:first-child, .dlist .meal:last-child { padding: 12px 0; }
/* The queue box is a child of the list: empty it collapses, and the first meal under it
   draws no separator over nothing. */
.dlist .queue:empty { display: none; }
.dlist .queue:empty + .meal { border-top: 0; }
.hnote { margin-top: -4px; padding: 0 4px; font-size: 13px; line-height: 18px; color: var(--muted); }
.hempty { background: var(--surface); border-radius: var(--r-card); box-shadow: var(--shadow);
  padding: 28px 16px; display: flex; flex-direction: column; align-items: center; gap: 12px;
  font-size: 15px; font-weight: 600; color: var(--muted); text-decoration: none; }
.hempty:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.hempty .plate { width: 64px; height: 64px; }
.herr { margin-top: 16px; display: flex; flex-direction: column; align-items: center; gap: 12px;
  font-size: 15px; font-weight: 600; }
.herr button { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--line);
  border-radius: 999px; padding: 9px 18px; background: none; font: inherit; font-size: 14px;
  font-weight: 600; color: var(--ink); cursor: pointer; }
.herr button .ico { width: 16px; height: 16px; }
.herr button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

/* The diary column's spinner — the boards' .spin while a day switch fetches. */
.spin { display: flex; justify-content: center; padding: 28px 0; }
.spin i { width: 24px; height: 24px; border-radius: 50%; border: 2.5px solid var(--hair);
  border-top-color: var(--muted); animation: k-spin .9s linear infinite; }
@keyframes k-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .spin i { animation-duration: 1.6s; } }

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

/* The proposal the day holds is the SHELL's card (.prop, styled where every surface reads
   it, in chat.css) — the boards' logging state draws the ink ring ON the card, where it
   follows the card's radius; on .prop itself it renders as two straight rules (#301). */
.home .prop .card { box-shadow: 0 0 0 2px var(--ink); }

/* The photo queue's row (#1318, web/log-queue-rows): a meal row's frame, the photo under a veil. */
.qth { position: relative; width: 56px; height: 56px; flex: 0 0 56px; border-radius: var(--r-thumb); overflow: hidden; }
.qth img { width: 56px; height: 56px; object-fit: cover; display: block; }
.qth .veil { position: absolute; inset: 0; transition: background 200ms ease-out; }
.qth .qr { position: absolute; left: 8px; top: 8px; width: 40px; height: 40px; fill: none; }
.qth .qr circle { transition: stroke-dasharray 600ms ease-out; }
.qth b { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: #fff; }
.qth > svg:not(.qr) { position: absolute; left: 17px; top: 17px; width: 22px; height: 22px; fill: none; stroke: #fff; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.qth .qr + svg { left: 18px; top: 18px; width: 20px; height: 20px; }
.meal.q .mm b { display: block; }
.qtitle { padding: 3px 0 5px; }
.sk { display: block; border-radius: 5px; background: linear-gradient(90deg, var(--hair) 0%, var(--surface) 50%, var(--hair) 100%); background-size: 200% 100%; animation: k-shim 1.4s linear infinite; }
.qstep { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--muted); margin-top: 2px; }
.qstep::before { content: ""; width: 6px; height: 6px; border-radius: 3px; background: var(--accent); flex: 0 0 6px; animation: k-pulse 1.2s ease-in-out infinite; }
.qstep.still::before { display: none; }
.qstep.ink { color: var(--ink); }
.qchips { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 5px; }
.qchips span { font-size: 11px; font-weight: 600; background: var(--macro-kcal-t); border-radius: 6px; padding: 2px 6px; animation: k-rise 180ms ease-out; }
.qact { display: flex; gap: 14px; margin-top: 6px; }
.card .qact button:not(.opt) { font: inherit; font-size: 13px; font-weight: 600; color: var(--accent); background: none; border: 0; margin: 0; padding: 6px 0; min-height: 0; border-radius: 0; box-shadow: none; cursor: pointer; }
.card .qact button:not(.opt) + button:not(.opt) { color: var(--muted); }
.dlist .qact button { font: inherit; font-size: 13px; font-weight: 600; color: var(--accent); background: none; border: 0; margin: 0; padding: 6px 0; min-height: 0; border-radius: 0; box-shadow: none; cursor: pointer; }
.dlist .qact button + button { color: var(--muted); }
.qpill { display: inline-block; margin-top: 6px; font-size: 12px; font-weight: 600; color: var(--accent); background: var(--accent-tint); border-radius: 999px; padding: 3px 9px; text-decoration: none; }
.qkc { width: 44px; display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
/* The landing move (#1354): the row grows in while the fixed flyer carries the image into its thumbnail. */
.meal.q.qnew { overflow: hidden; animation: k-qnew .22s var(--ease) both; }
@keyframes k-qnew { from { max-height: 0; padding-top: 0; padding-bottom: 0; filter: opacity(0); }
  to { max-height: 120px; } }
.qfly { position: fixed; z-index: 60; object-fit: cover; border-radius: var(--r-thumb); pointer-events: none; }
.qdrop { position: fixed; inset: 12px; z-index: 50; border: 3px dashed var(--accent); border-radius: 16px; background: color-mix(in srgb, var(--accent-tint) 72%, transparent); display: flex; align-items: center; justify-content: center; text-align: center; color: var(--accent); pointer-events: none; }
.qdrop b { display: block; font-size: 20px; font-weight: 700; }
.qdrop small { display: block; font-size: 14px; color: var(--muted); margin-top: 4px; }
@keyframes k-shim { from { background-position: 200% 0; } to { background-position: 0 0; } }
@keyframes k-pulse { 50% { opacity: .3; } }
@media (prefers-reduced-motion: reduce) { .sk, .qstep::before, .qchips span { animation: none; } }
`;
