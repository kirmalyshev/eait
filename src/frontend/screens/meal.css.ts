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
/* display:flex above beats the UA's [hidden] rule — without this the menu arrived open (#172). */
.mpopup[hidden]{display:none}
.mi{display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;border:0;background:none;
  font:inherit;font-size:14px;font-weight:500;color:var(--ink);border-radius:var(--r-ctl);
  cursor:pointer;text-align:left}
.mi .ico{width:18px;height:18px;background:var(--muted)}
.mi:hover{background:var(--bg)}
.mi.bad{color:var(--bad)} .mi.bad .ico{background:var(--bad)}
.mi:disabled{opacity:.5;cursor:default}

/* The overlays — the score breakdown at 36 % ink, the delete ask at 42 %, both boards' own dims. */
.mscrim{position:fixed;inset:0;background:color-mix(in srgb, var(--ink) 36%, transparent);display:flex;align-items:center;
  justify-content:center;z-index:50}
.mscrim.hard{background:color-mix(in srgb, var(--ink) 42%, transparent)}
.mscore{width:440px;max-width:calc(100vw - 32px);max-height:80vh;overflow:auto;padding:24px;
  margin:0;display:flex;flex-direction:column}
.mscore .mnote{margin:6px 0 10px}
.mscore .cta{margin-top:16px}
.mdel{width:380px;padding:24px;text-align:center;margin:0}
.mdel p{margin:8px 0 18px}
.mdel .mrow{gap:10px}
.mdel .cta.danger{background:var(--bad);color:var(--accent-ink);white-space:nowrap}
.mdel .cta.danger:hover{filter:none}

/* The gone state — a deleted, moved or foreign meal id reads the same way. */
.mgone{padding:36px 24px;text-align:center;display:flex;flex-direction:column;align-items:center}
.mgone p{margin:8px 0 18px}
.mgone .cta{max-width:260px}

/* The Cal-AI panels (#188) — the fix sheet and the ingredient editor on the shared scrim, the
   boards' 480px card: 18/22 padding, 14px between the rows. */
.mfix,.ming{width:480px;max-width:calc(100vw - 32px);padding:18px 22px 22px;margin:0;
  display:flex;flex-direction:column;gap:14px}
.mfix .card,.ming .card{margin:0}
.fixtitle{gap:10px;align-items:center}
.fixtitle .ico{width:28px;height:28px}
.fixmeal{gap:10px;align-items:center}
.fixthumb{width:40px;height:40px;flex:0 0 40px;border-radius:8px;overflow:hidden;
  background:var(--accent-tint);display:flex;align-items:center;justify-content:center}
.fixthumb img{width:100%;height:100%;object-fit:cover}
.fixthumb.chat .ico{width:22px;height:22px;background:var(--accent)}
.fixfield{min-height:96px;padding:14px 16px;border:0;border-radius:var(--r-card);resize:vertical;
  background:var(--surface);box-shadow:0 0 0 1.5px var(--ink);font:inherit;font-size:15px;
  color:var(--ink)}
.fixfield::placeholder{color:var(--faint)}
.fixex{padding:14px 16px;background:var(--hair);box-shadow:none;font-size:15px;line-height:1.45}

/* The recomputed detail's one tinted line (meal-fixed.html) — the change, named. */
.chgline{display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:10px;
  background:var(--accent-tint);font-size:14px;font-weight:600}
.chgdot{width:8px;height:8px;flex:0 0 8px;border-radius:50%;background:var(--accent)}

/* The ingredient rows open their editor — a button wrapping the kit's .ing row. */
button.ingbtn{display:block;width:100%;border:0;background:none;padding:0;font:inherit;
  color:inherit;cursor:pointer;text-align:left;border-radius:var(--r-ctl)}
button.ingbtn:hover .ing{background:var(--bg)}
button.ingbtn:focus-visible{outline:2px solid var(--accent);outline-offset:2px}

/* The ingredient editor's rows: the label 600, the amount pill an editable figure. */
.ming .amlab{font-weight:600}
.amtpill{display:inline-flex;align-items:center;gap:8px;padding:10px 16px;border-radius:12px;
  box-shadow:0 0 0 1.5px var(--ink);font-weight:700;cursor:text}
.amtpill .ico{width:16px;height:16px}
.amtin{border:0;background:none;padding:0;font:inherit;font-weight:700;color:var(--ink);
  text-align:right;min-width:2ch}
.amtin:focus-visible{outline:none}
.amtpill:focus-within{box-shadow:0 0 0 2px var(--accent)}
.ingwas{align-self:flex-end;margin-top:-6px}
.ingkcal{padding:16px 18px}
.ingkrow{gap:8px;margin-top:2px}
.ingkrow .ico{width:26px;height:26px}
.ingmeal{padding:14px 16px}
.ingmeal .hr{margin:10px 0}

/* Narrow screens: the pair stacks, the photo over the sheet. */
@media (max-width:960px){
  .mdetail{grid-template-columns:1fr}
  .msplit{grid-template-columns:1fr}
}
`;
