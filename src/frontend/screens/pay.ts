// The plans (#263): `#/pay` — the web's pay-plans board (W9), Monthly and Yearly only (#928).
//
// Everything sellable arrives in `ProfileResponse.paywall` (#77): the plans' checkout links with
// this account's id already filled, the prices formatted in its language, and the footer's
// Terms/Privacy hrefs. The screen computes no price and builds no link — a null plan is a plan
// the host does not sell and never draws, and a decline (the ×) goes Home: the exit offer's own
// surface is a follow-up, so `?plan=exit` stays unlinked here.
//
// The plan rows are `payPlansEl`'s — ONE composition with the first-meal offer, and the same
// `payPlans` markup `/start`'s offer interpolates: the plan shown is the plan the click buys.

import { fill } from "../../shared/lang.ts";
import { payCopyFor } from "../../shared/app/pay-copy.ts";
import { ico, payPlans as payPlansMarkup } from "../../shared/ui/kit.ts";
import { COPY, el, lang, type Frame } from "../shell.ts";
import { kitEl, payPlansEl } from "../kit.ts";

/** The image the boards' hero draws — served by the backend off shared/assets/img, same origin. */
const HERO_SRC = "/start/assets/img/salmon.webp";

export function payScreen(frame: Frame): HTMLElement {
  const box = el("section", "pay");
  const pay = payCopyFor(lang);
  const w = frame.me?.paywall;
  // An account already entitled has no plans left to draw: the fallthrough lands Home, as an
  // unbound route does. A host that sells nothing still shows the offer the flow always drew —
  // one named, checked radio and the `/start/checkout` route, which is a 404 on exactly such a
  // host — the shape the offer had before the plans learned prices and selection.
  if (frame.me?.entitlement?.active === true) {
    location.hash = "#/";
    return box;
  }
  const plans = w === undefined ? null : payPlansEl(w, COPY.offerPlans);

  const hero = el("div", "hero");
  const img = el("img", "") as HTMLImageElement;
  img.src = HERO_SRC;
  img.alt = pay.plansHeroAlt;
  hero.append(img);

  const pane = el("div", "pane");
  const close = el("a", "ib x") as HTMLAnchorElement;
  close.href = "#/";
  close.setAttribute("aria-label", pay.closeLabel);
  close.append(kitEl(ico("x")));

  const col = el("div", "pcol");
  col.append(el("h1", "d d34", pay.plansTitle));

  const go = el("a", "cta p") as HTMLAnchorElement;
  const note = el("p", "t12 m");
  if (w === undefined || plans === null) {
    col.append(kitEl(payPlansMarkup(
      [{ value: "monthly", name: pay.planMonthly, checked: true }], COPY.offerPlans)));
    go.href = "/start/checkout";
    // No paywall config means nothing about a trial is known — Continue, not a promise of one.
    go.textContent = pay.continueCta;
    note.textContent = "";
  } else {
    const update = (): void => {
      const sel = plans.picked();
      if (sel === null) return;
      go.href = sel.plan.checkoutUrl;
      // ieat-app#1591: the trial is on BOTH plans — the trial words ride whichever card is picked,
      // and `{renewal}` names THAT plan's price and cadence off the same templates the rows carry.
      if (w.trialDays > 0) {
        go.textContent = fill(pay.startTrial, { days: String(w.trialDays) });
        note.textContent = fill(pay.trialNote, {
          days: String(w.trialDays),
          renewal: fill(sel.value === "yearly" ? pay.pricePerYear : pay.pricePerMonth,
            { price: sel.plan.price }),
        });
      } else {
        go.textContent = pay.continueCta;
        note.textContent = fill(
          sel.value === "yearly" ? pay.renewNoteYearly : pay.renewNoteMonthly,
          { price: sel.plan.price });
      }
    };
    plans.group.addEventListener("change", update);
    update();
    col.append(plans.group);
  }
  col.append(go, note);
  // The footer's legal links — only the ones the operator publishes (`WebPaywall` carries "" for
  // a link it does not have). No Restore: the web has no store to restore from; a purchase lands
  // here by webhook.
  const links: [words: string, href: string][] = [];
  if ((w?.termsUrl ?? "") !== "") links.push([pay.termsLink, w!.termsUrl]);
  if ((w?.privacyUrl ?? "") !== "") links.push([pay.privacyLink, w!.privacyUrl]);
  if (links.length > 0) {
    const foot = el("p", "t12 m paylinks");
    links.forEach(([words, href], i) => {
      if (i > 0) foot.append(" · ");
      const a = el("a", "", words) as HTMLAnchorElement;
      a.href = href;
      a.target = "_blank";
      a.rel = "noopener";
      foot.append(a);
    });
    col.append(foot);
  }

  pane.append(close, col);
  box.append(hero, pane);
  return box;
}
