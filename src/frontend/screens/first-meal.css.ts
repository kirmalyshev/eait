// The first-meal flow's own styles (#42) — moved whole out of `server/index.ts`'s style block
// (#87); the register's own boards for it are W5's. The card sits in the diary's column
// (web/today-first-meal); the verdict, the correction and the offer are sheets over Home
// (web/first-verdict, web/first-correct, web/first-offer).

export const firstMealCss = `
/* The flow's card is a child of the diary column — no width of its own; the column's is the
   card's. .fline is the .say text at the boards' 15/600 (the kit's .say is layout only). */
.fflow { display: flex; flex-direction: column; gap: 10px; }
.fflow .step { background: var(--surface); border-radius: var(--r-card); box-shadow: var(--shadow);
  padding: 20px 20px; display: flex; flex-direction: column; gap: 14px; }
.fline p { font-weight: 600; font-size: 15px; line-height: 1.35; margin: 0; }
.step { display: flex; flex-direction: column; }
.step .card input[type="text"], .step .card select,
.fsheet .card input[type="text"], .fsheet .card select { display: block; width: 100%; box-sizing: border-box;
  font: inherit; font-size: 16px; min-height: 44px; padding: .55rem .8rem; border-radius: 999px; color: var(--ink); background: var(--surface);
  border: 1px solid var(--hair); margin: .4rem 0 0; }
.step .card .lab + .lab, .fsheet .card .lab + .lab { margin-top: .9rem; }
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

/* The sheets — the verdict and the fix panel centred over Home's dimmed diary; the offer is the
   opaque page the boards draw as .wmain one. Z above the pinned composer (its own z is 20). */
.fscrim { position: fixed; inset: 0; z-index: 40; display: flex; align-items: center; justify-content: center;
  background: color-mix(in srgb, var(--ink) 36%, transparent); padding: 20px; overflow-y: auto; }
/* The offer is the page, not a dim (web/first-offer's .wmain one): it starts under the top bar —
   the top offset is set where it opens — so the bar stays live chrome above it. */
.fscrim.solid { background: var(--bg); align-items: flex-start; }
.fsheet { width: 520px; max-width: 100%; padding: 22px; display: flex; flex-direction: column; gap: 10px;
  margin: auto; }
.fsheet.fnarrow { width: 460px; }
.fsheet .fhrow { flex-direction: row; }
.fsheet .fhrow .cta { flex: 1; }
.fixtitle { gap: 8px; }
.fixtitle .ico { width: 18px; height: 18px; color: var(--accent); }
.foffer { width: min(520px, 100%); margin: 6vh auto 40px; }
.foffer .step { gap: 14px; }
.foffer .card { padding: 18px; }

/* The verdict sheet's photo block: .hero's OWN look (edge photo, corner callouts, the stamp) but
   not its name — on this sheet .hero is the kcal figure's class, read by the browser suite. */
.fhero { position: relative; overflow: hidden; border-radius: 12px; height: 170px; background: #DDD8CE; }
.fhero img { width: 100%; height: 100%; object-fit: cover; display: block; }
.fhero .co { --copad: 14px; position: absolute; display: flex; align-items: center; gap: 6px;
  background: rgba(255,255,255,.94); border-radius: 8px; padding: 6px 9px; font-size: 12px; font-weight: 600;
  box-shadow: 0 1px 2px rgba(0,0,0,.12); white-space: nowrap; animation: k-rise .5s var(--ease) both; }
.fhero .co.tl { left: var(--copad); top: var(--copad); }
.fhero .co.tr { right: var(--copad); top: var(--copad); }
.fhero .co.bl { left: var(--copad); bottom: var(--copad); }
.fhero .co.br { right: var(--copad); bottom: var(--copad); }
.fhero .co.lift { bottom: calc(var(--copad) + 38px); }
.fhero .co::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--ink); }
.fhero .co span { color: var(--muted); font-weight: 500; }
.fhero .co:nth-of-type(2) { animation-delay: .15s; }
.fhero .co:nth-of-type(3) { animation-delay: .3s; }
.fhero .stamp { position: absolute; right: 12px; bottom: 12px; background: rgba(23,25,28,.72); color: #fff;
  font-size: 12px; font-weight: 600; padding: 4px 8px; border-radius: 6px; }

@media (prefers-reduced-motion: reduce) { .fhero .co { animation: none; } }
@media (max-width: 760px) {
  /* The 390 boards: the sheet fills the width and settles at the bottom. */
  .fscrim { padding: 12px; align-items: flex-end; }
  .fscrim.solid { align-items: flex-start; }
  .fsheet { width: 100%; }
  .foffer { margin-top: 12px; }
}
`;
