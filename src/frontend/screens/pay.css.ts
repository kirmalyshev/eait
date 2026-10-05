// The pay screen's own styles (#263) — the pay-plans board's .split frame, inside `wmain`.
// The plan rows themselves are the kit's (`payCss`, in kitCss() — one copy with `/start`).

export const payCss = `
/* The board widens the main like the log's grid does. */
.wmain:has(.pay) { max-width: 1160px; }
.pay { flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 0; min-height: 0; }
.pay .hero { min-height: 320px; border-radius: var(--r-card); overflow: hidden; }
.pay .hero img { width: 100%; height: 100%; object-fit: cover; display: block; }
.pay .pane { position: relative; display: flex; flex-direction: column; justify-content: center;
  padding: 0 48px 0 96px; }
.pay .x { position: absolute; right: 16px; top: 4px; }
.pay .pcol { display: flex; flex-direction: column; gap: 12px; max-width: 420px; }
.pay .pcol h1 { margin: 0 0 10px; }
.pay .pcol .cta { margin-top: 10px; }
.pay .pcol .t12 { text-align: center; margin: 0; }
.pay .paylinks a { color: inherit; text-decoration: underline; }
.pay .plan:nth-child(2) { --d: .1s; }
/* pay-exit (#451): the offer card the plans swap to on the first decline — the board's own
   measurements, radii included (16, not --r-card's 12). */
.pay .pcol h1.d28 { margin: 0 0 6px; }
.pay .offer { background: var(--surface); border-radius: 16px; box-shadow: var(--shadow);
  text-align: center; padding: 24px; }
.pay .offer .off { font-size: 52px; font-weight: 700; letter-spacing: -.03em; line-height: 1; }
.pay .offer .hr { margin: 18px 0 14px; }
.pay .offer .price { display: flex; justify-content: center; align-items: baseline; gap: 12px;
  font-size: 22px; font-weight: 600; }
.pay .offer .price s { color: var(--muted); font-weight: 500; font-size: 18px;
  text-decoration-thickness: 2px; }
.pay .offer .per { margin: 8px 0 0; font-weight: 500; }
.pay .pcol .cta.g { margin-top: -6px; }
@media (max-width: 960px) {
  .pay .pane { padding: 0 24px; }
}
@media (max-width: 760px) {
  /* One column under the board's split — the plate shrinks to a banner over the pane, the same
     give-it-up the phone's 120 pt floor takes. The × leaves the overlay it sits in at split
     widths and joins the column instead, or it covers the headline. */
  .pay { grid-template-columns: 1fr; }
  .pay .hero { min-height: 0; height: 160px; }
  .pay .pane { padding: 20px 0; }
  .pay .x { position: static; align-self: flex-end; }
  .pay .pcol { max-width: none; }
}
`;
