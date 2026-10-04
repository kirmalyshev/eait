// The first-meal flow's own styles (#42) — moved whole out of `server/index.ts`'s style block
// (#87); the register's own boards for it are W5's.

export const firstMealCss = `
/* The one-meal flow — the v5 boards, in the diary's place while the account has never logged: one
   centred column, the width a chat reads best at (styles_spec_v5_web). */
.flow { max-width: 620px; margin: 0 auto; }
.spk { display: flex; gap: 14px; align-items: flex-start; margin: 22px 0 18px; }
.spk .av { flex: 0 0 46px; width: 46px; height: 46px; border-radius: 50%; overflow: hidden; }
.spk .av svg { display: block; width: 100%; height: 100%; }
.spk-col { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.beat { border-left: 3px solid var(--accent); padding-left: 12px; color: var(--good);
  font-weight: 700; font-size: 13.5px; }
.spk .them { color: var(--muted); line-height: 1.55; }
.ask { font-size: 21px; line-height: 1.25; font-weight: 800; letter-spacing: -.02em; margin: 0; }
.step { display: flex; flex-direction: column; }
.step .card input[type="text"], .step .card select { display: block; width: 100%; box-sizing: border-box;
  font: inherit; font-size: 16px; min-height: 44px; padding: .55rem .8rem; border-radius: 999px; color: var(--ink); background: var(--surface);
  border: 1px solid var(--hair); margin: .4rem 0 0; }
.step .card .lab + .lab { margin-top: .9rem; }
.step-foot { display: flex; flex-direction: column; gap: 10px; margin-top: 14px; }
/* The .cta on this screen is the kit's (#88) — kitCss() owns it; the local copy was the
   pre-register one (pill radius, 800 weight). */
.drop { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
  min-height: 150px; border: 1.5px dashed var(--line); border-radius: 16px; color: var(--muted);
  cursor: pointer; text-align: center; padding: 16px; }
.drop.over, .drop:focus-within { border-color: var(--accent); color: var(--ink); }
/* The input inside is clipped, so the ring goes on the zone — the visible thing focus lands in. */
.drop:focus-within { outline: 2px solid var(--ink); outline-offset: 2px; }
.drop .drop-lead { font-weight: 700; color: var(--ink); overflow-wrap: anywhere; }
.drop small { color: var(--faint); }
.perks { display: flex; flex-direction: column; gap: 10px; margin: 2px 0 14px; }
.perk { display: flex; align-items: center; gap: 10px; font-weight: 700; }
.perk .tick { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px;
  border-radius: 50%; background: var(--accent); color: var(--accent-ink); font-size: 13px; flex: 0 0 22px; }
/* The plan rows are the kit's now — payCss() in kitCss() owns .plans/.plan (#263). */
.hint { color: var(--muted); font-size: 13px; text-align: center; margin: 2px 0 0; }
@media (max-width: 760px) { .flow { max-width: none; } }
`;
