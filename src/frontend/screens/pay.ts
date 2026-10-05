// The plans (#263): `#/pay` — the web's pay-plans board (W9), Monthly and Yearly only (#928).
//
// Everything sellable arrives in `ProfileResponse.paywall` (#77): the plans' checkout links with
// this account's id already filled, the prices formatted in its language, and the footer's
// Terms/Privacy hrefs. The screen computes no price and builds no link — a null plan is a plan
// the host does not sell and never draws. A decline (the ×) swaps the plans for the exit offer
// in place, once per account (web/pay-exit, #451); a host with no offer configured, or an
// account that has already met it, closes to Home.
//
// The plan rows are `payPlansEl`'s — ONE composition with the first-meal offer, and the same
// `payPlans` markup `/start`'s offer interpolates: the plan shown is the plan the click buys.

import { fill } from "../../shared/lang.ts";
import { paywallPercent } from "../../shared/paywall.ts";
import { payCopyFor } from "../../shared/app/pay-copy.ts";
import { ico, payPlans as payPlansMarkup } from "../../shared/ui/kit.ts";
import { COPY, el, lang, type Frame } from "../shell.ts";
import { kitEl, payPlansEl } from "../kit.ts";

/** The image the boards' hero draws — served by the backend off shared/assets/img, same origin. */
const HERO_SRC = "/start/assets/img/salmon.webp";

/** The exit offer's once-per-account flag, keyed by the account id — a second account on this
    browser still gets its one show. Not the bearer: a flag authenticates nothing. A read that
    fails is "not seen" — the in-memory `offered` below still bounds it to once a visit. */
const SEEN = "eait:exit-offer:";
const offerSeen = (uid: string): boolean => {
  try { return localStorage.getItem(SEEN + uid) !== null; } catch { return false; }
};
const markOfferSeen = (uid: string): void => {
  try { localStorage.setItem(SEEN + uid, "1"); } catch { /* a storage that refuses shows it again */ }
};

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
    go.textContent = pay.startTrial;
    note.textContent = COPY.offerCheckoutHint;
  } else {
    const update = (): void => {
      const sel = plans.picked();
      if (sel === null) return;
      go.href = sel.plan.checkoutUrl;
      // The phone's wording (#928): the trial words only while the YEARLY card is picked — monthly
      // is billed at once, so its CTA and its note name the renewal instead of a free week.
      if (sel.value === "yearly" && w.trialDays > 0) {
        go.textContent = pay.startTrial;
        note.textContent = fill(pay.trialNote, { days: String(w.trialDays), price: sel.plan.price });
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
  // here by webhook. Both states of the column draw it, so it is built on demand.
  const legal = (): HTMLElement | null => {
    const links: [words: string, href: string][] = [];
    if ((w?.termsUrl ?? "") !== "") links.push([pay.termsLink, w!.termsUrl]);
    if ((w?.privacyUrl ?? "") !== "") links.push([pay.privacyLink, w!.privacyUrl]);
    if (links.length === 0) return null;
    const foot = el("p", "t12 m paylinks");
    links.forEach(([words, href], i) => {
      if (i > 0) foot.append(" · ");
      const a = el("a", "", words) as HTMLAnchorElement;
      a.href = href;
      a.target = "_blank";
      a.rel = "noopener";
      foot.append(a);
    });
    return foot;
  };
  const plansFoot = legal();
  if (plansFoot !== null) col.append(plansFoot);

  // The exit offer (web/pay-exit, #451): the first decline of the plans swaps them for it in
  // place — the regular yearly struck through, the offer price, per month — rather than closing.
  // `offered` keeps the second × (and the ones after it) a plain close for the rest of this
  // mount; the stored flag does the same across visits.
  let offered = false;
  close.addEventListener("click", (ev) => {
    const offer = w?.exitOffer ?? null;
    const uid = frame.me?.profile.user_id;
    if (offered || offer === null || uid === undefined || offerSeen(uid)) return;
    ev.preventDefault();
    offered = true;
    markOfferSeen(uid);
    const card = el("div", "offer pop");
    card.append(
      el("div", "off num", fill(pay.offerOff, { percent: paywallPercent(offer.percentOff, lang) })),
      el("div", "hr"),
    );
    const price = el("div", "price num");
    price.append(
      el("s", "", offer.regularPrice),
      el("span", "", fill(pay.offerPrice, { price: offer.price })),
    );
    card.append(price, el("p", "t13 m num per", fill(pay.offerPerMonth, { price: offer.perMonth })));
    const claim = el("a", "cta p", pay.offerClaim) as HTMLAnchorElement;
    claim.href = offer.checkoutUrl;
    const decline = el("a", "cta g", pay.offerDecline) as HTMLAnchorElement;
    decline.href = "#/";
    const parts = [el("h1", "d d28", pay.offerTitle), card, claim, decline, el("p", "t12 m", pay.offerNote)];
    const foot = legal();
    if (foot !== null) parts.push(foot);
    col.replaceChildren(...parts);
  });

  pane.append(close, col);
  box.append(hero, pane);
  return box;
}
