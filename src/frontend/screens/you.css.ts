// You's own styles — the account's rows. Moved whole out of `server/index.ts`'s style block (#87);
// the register's own Profile surface is W10's.

export const youCss = `
/* You — the account's rows: label and control, a hairline between. */
.you > * + * { border-top: 1px solid var(--hair); }
.you .rowline { padding: 12px 2px; }
.you .pick { font: inherit; font-size: 16px; font-weight: 700; padding: 10px 14px; border-radius: 999px; max-width: 62%;
  min-height: 44px;
  border: 1px solid var(--line); background: var(--surface); color: var(--ink); }
.you-act { display: flex; align-items: center; justify-content: space-between; width: 100%;
  padding: 14px 2px; background: none; border: 0; font: inherit; font-weight: 700; color: var(--ink);
  cursor: pointer; text-align: left; }
.you-act::after { content: "›"; color: var(--muted); font-size: 18px; }
`;
