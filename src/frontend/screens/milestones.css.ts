// Milestones' own styles — the wall, the streak card's marks, Badge Unlocked and the settings page
// (web/milestones*.html, ieat-app#1395). The board's rules, scoped so nothing else moves.

export const milestonesCss = `
.wmain:has(.mls) { max-width: 1180px; }
.mls { display: grid; grid-template-columns: 340px 1fr; gap: 24px; }
@media (max-width: 760px) { .mls { grid-template-columns: 1fr; } }
.mls .mcol { display: flex; flex-direction: column; gap: 12px; }
.mls .mtop { display: flex; align-items: center; gap: 8px; }
.mls .mhd { display: grid; grid-template-columns: 1fr 1fr; text-align: center; }
.mls .mhd img { width: 96px; height: 96px; object-fit: contain; display: block; margin: 0 auto; }
.mls .mhd b { display: block; font-weight: 600; font-size: 16px; }
.mls .mst { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.mls .mst > div { display: flex; gap: 8px; align-items: center; background: var(--surface); border-radius: 16px;
  padding: 10px; box-shadow: 0 0 0 1px var(--line); }
.mls .mst img { width: 28px; height: 28px; object-fit: contain; }
.mls .mst p { margin: 0; font-size: 12px; color: var(--muted); line-height: 1.3; flex: 1; }
.mls .mst b { color: var(--ink); font-size: 14px; }
.mls .mprog { display: block; height: 5px; border-radius: 3px; background: var(--hair); overflow: hidden; margin-top: 4px; }
.mls .mprog i { display: block; height: 100%; background: var(--ink); border-radius: 3px; }
.mls .mwall { overflow: hidden; }
.bwall { display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px 6px; }
@media (max-width: 760px) { .bwall { grid-template-columns: repeat(3, 1fr); } }
.bdg { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 8px 4px 10px; border-radius: 18px; }
.bdg .medal { display: block; width: 92%; aspect-ratio: 1; object-fit: contain; }
.bdg.got { background: var(--accent-tint); }
.bdg.lk .medal, .mlk { filter: grayscale(1) brightness(1.12) contrast(.6); opacity: .55; }
.bdg b { font-size: 14px; font-weight: 500; line-height: 1.2; margin-top: 4px; }
.bdg small { font-size: 12px; color: var(--muted); line-height: 1.25; margin-top: 2px; }

a.chiplink { display: contents; color: inherit; text-decoration: none; }

/* The streak card (Progress) — the flame and the figure, the week's marks, the sentence. */
.msk { display: flex; align-items: center; gap: 12px; }
.msk img { width: 44px; height: 44px; object-fit: contain; }
.msk .big { font-size: 40px; font-weight: 700; letter-spacing: -.03em; line-height: 1; }
.msk.off img { filter: grayscale(1); opacity: .4; }
.marks { display: flex; justify-content: space-between; margin-top: 14px; }
.marks > div { display: flex; flex-direction: column; align-items: center; gap: 5px; font-size: 11px; font-weight: 600; color: var(--muted); }
.marks i { width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  box-shadow: inset 0 0 0 1.5px var(--line); font-style: normal; }
.marks i.ok { background: var(--accent); box-shadow: none; }
.marks i.ok .ico { width: 16px; height: 16px; color: #fff; }
.marks i.bent { box-shadow: none; border: 2px dashed var(--warn); }
.marks i.today { box-shadow: inset 0 0 0 2px var(--ink); }
.marks small { font-size: 11px; font-weight: 600; color: var(--warn); margin-top: -2px; }
.sline { font-size: 13px; color: var(--muted); margin-top: 12px; line-height: 1.4; }
.sline b { color: var(--ink); font-weight: 600; }
a.mrow { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 12px; padding-top: 12px;
  border-top: 1px solid var(--hair); color: var(--ink); text-decoration: none; font-weight: 600; }
a.mrow span { display: inline-flex; align-items: center; gap: 4px; font-weight: 400; font-size: 13px; color: var(--muted); }
a.mrow .ico { width: 18px; height: 18px; }

/* Badge Unlocked — the board's 420px card, green washing to the surface. */
.panel.mu { width: 420px; min-height: 560px; display: flex; flex-direction: column; padding: 24px 28px; position: relative;
  background: linear-gradient(160deg, #1E6B3C 0%, #5BB37E 38%, var(--surface) 62%); }
.mu .mux { position: absolute; top: 16px; right: 16px; }
.mu .ul { display: flex; flex-direction: column; align-items: center; text-align: center; }
.mu .ul img { width: 250px; height: 250px; object-fit: contain; }
.mu .ul .cap { font-size: 14px; color: var(--muted); margin-top: 6px; }
.mu .ul .nm { font-size: 28px; font-weight: 700; letter-spacing: -.01em; margin-top: 2px; }
.mu .ul .cr { font-size: 14px; color: var(--muted); margin-top: 2px; }
.mu .ulb { display: flex; flex-direction: column; gap: 10px; width: 100%; margin-top: auto; padding-top: 24px; }
.mu .ulb button { display: flex; justify-content: center; align-items: center; gap: 8px; height: 54px; border-radius: 27px;
  font-weight: 600; font-size: 16px; cursor: pointer; border: 0; }
.mu .ulb .b1 { background: var(--ink); color: #fff; }
.mu .ulb .b2 { background: var(--surface); box-shadow: 0 0 0 1px var(--line); color: var(--ink); }
.mu .ulb .b2 img { width: 20px; height: 20px; }
.mu .ulb .off { background: none; height: auto; font-size: 13px; font-weight: 400; color: var(--muted); }

/* Profile › Milestones — the two switches, in the You rows' own pill. */
.mset { max-width: 560px; margin: 0 auto; }
.mset .opt.sw { display: flex; align-items: center; padding: 13px 0; font-size: 15px; }
.mset .opt .sub { font-size: 12px; color: var(--muted); margin-top: 2px; }
.mset .swt { margin-left: auto; width: 51px; height: 31px; border-radius: 16px; flex: 0 0 51px; position: relative;
  background: var(--line); border: 0; padding: 0; min-height: 31px; cursor: pointer; }
.mset .swt[aria-checked="true"] { background: var(--accent); }
.mset .swt i { position: absolute; top: 2px; left: 2px; width: 27px; height: 27px; border-radius: 50%; background: #fff;
  box-shadow: 0 1px 3px rgba(0,0,0,.3); }
.mset .swt[aria-checked="true"] i { left: 22px; }
.mset .swt:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.mset .mnote { font-size: 13px; color: var(--muted); line-height: 1.4; padding: 0 4px; }
`;
