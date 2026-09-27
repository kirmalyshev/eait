// Chat's own styles — the transcript. Moved whole out of `server/index.ts`'s style block (#87);
// the register's own look of this surface is W7's.

export const chatCss = `
/* THE TRANSCRIPT (the boards' chat, #52): a quiet column — my words right in the accent green,
   Spud's left and pale, and his face beside only his NEWEST turn. No bubble runs the column's
   width, and the line's actions are small TEXT buttons on a 44px hit area. */
.thread { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 9px; }
.line { display: flex; flex-direction: column; align-items: flex-start; }
.line .bub { margin: 0; padding: .55rem .9rem; width: fit-content; max-width: 86%; border-radius: 18px;
  border-bottom-left-radius: 6px; background: var(--surface); border: 1px solid var(--hair); }
.line.mine { align-items: flex-end; }
.line.mine .bub { background: var(--accent); color: var(--accent-ink); border-color: var(--accent);
  border-bottom-left-radius: 18px; border-bottom-right-radius: 6px; max-width: 80%; }
.line.buddy { flex-direction: row; gap: 10px; }
.line .av { flex: 0 0 40px; width: 40px; height: 40px; border-radius: 50%; overflow: hidden;
  background: var(--surface); border: 1px solid var(--hair);
  display: flex; align-items: center; justify-content: center; }
.line .av svg { width: 30px; height: 30px; display: block; }
.line.buddy .col { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: flex-start; }
.line .note { font-size: 12px; color: var(--faint); font-weight: 600; }
.acts { display: flex; gap: 2px; }
`;
