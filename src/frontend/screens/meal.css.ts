// The meal surface's styles (Register P's W6, #93) — web/meal.html's master-detail pair and the
// delete board's header row, dialog and menu drawn over it. Only what the kit doesn't already
// carry: the two columns, the split card, the popped menu, the overlays, the gone state.

export const mealCss = `
/* The master-detail pair — the day's list at 400 px, the meal card in the wider column, over the
   shell's one-column main. */
.mdetail{display:grid;grid-template-columns:400px minmax(0,1fr);gap:24px;align-items:start}
.mdetail .wcol{min-width:0}
.mdetail .lab{display:block;margin-bottom:12px}
.mlist .meal.sel{margin-left:-12px;margin-right:-12px;padding-left:12px;padding-right:12px;
  background:var(--accent-tint);border-radius:var(--r-card)}

/* The detail card: padding 0, the header row across the top, then photo | sheet at 1fr 1fr. */
.mdet{padding:0;overflow:hidden;display:flex;flex-direction:column}
.mhead{display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid var(--hair)}
.mhead .ib{width:32px;height:32px;flex-basis:32px}
.mhead .mh{flex:1;min-width:0;text-align:center}
.mhead .mh b{display:block;font-size:15px;font-weight:600}
.mhead .mh small{display:block;font-size:12px;color:var(--muted);font-weight:500}
.msplit{display:grid;grid-template-columns:1fr 1fr;min-height:0}
.msplit .hero{min-height:320px}
.msplit .mnoimg{display:flex;align-items:center;justify-content:center;background:var(--accent-tint)}
.msplit .mnoimg .ico{width:44px;height:44px;background:var(--accent)}
.msheet{padding:22px;display:flex;flex-direction:column;gap:12px;min-width:0}
.msheet .kfig{gap:6px;flex:none}
.msheet .kfig .ico{width:30px;height:30px}
.msheet .mmeta{margin-top:4px}
.msheet .cta{margin-top:auto}

/* The "…" menu — popped under its trigger, the phone menu's items in order, delete last and bad. */
.mwrap{position:relative}
.mpopup{position:absolute;right:0;top:calc(100% + 8px);z-index:30;min-width:220px;background:var(--surface);
  border-radius:var(--r-card);box-shadow:var(--shadow);padding:6px;display:flex;flex-direction:column}
.mi{display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;border:0;background:none;
  font:inherit;font-size:14px;font-weight:500;color:var(--ink);border-radius:var(--r-ctl);
  cursor:pointer;text-align:left}
.mi .ico{width:18px;height:18px;background:var(--muted)}
.mi:hover{background:var(--bg)}
.mi.bad{color:var(--bad)} .mi.bad .ico{background:var(--bad)}
.mi:disabled{opacity:.5;cursor:default}

/* The overlays — the score breakdown at 36 % ink, the delete ask at 42 %, both boards' own dims. */
.mscrim{position:fixed;inset:0;background:rgba(23,25,28,.36);display:flex;align-items:center;
  justify-content:center;z-index:50}
.mscrim.hard{background:rgba(23,25,28,.42)}
.mscore{width:440px;max-height:80vh;overflow:auto;padding:24px;margin:0;display:flex;
  flex-direction:column}
.mscore .mnote{margin:6px 0 10px}
.mscore .cta{margin-top:16px}
.mdel{width:380px;padding:24px;text-align:center;margin:0}
.mdel p{margin:8px 0 18px}
.mdel .mrow{gap:10px}
.mdel .cta.danger{background:var(--bad);color:#fff;white-space:nowrap}
.mdel .cta.danger:hover{filter:none}

/* The gone state — a deleted, moved or foreign meal id reads the same way. */
.mgone{padding:36px 24px;text-align:center;display:flex;flex-direction:column;align-items:center}
.mgone p{margin:8px 0 18px}
.mgone .cta{max-width:260px}

/* Narrow screens: the pair stacks, the photo over the sheet. */
@media (max-width:960px){
  .mdetail{grid-template-columns:1fr}
  .msplit{grid-template-columns:1fr}
}
`;
