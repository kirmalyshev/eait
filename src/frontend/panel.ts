// The boards' panels — Profile's pages drawn as centred cards over the 36 % ink scrim
// (web/you-profile.html, web/you-weight.html, DIRECTION § Web: "Profile's pages are panels over
// Profile, replacing web's inline forms"), and the dark "saved" toast (web/you-saved.html).
//
// THEY STACK: the editor's Weight row opens the weigh-in OVER the editor, the way the phone
// pushes /you/weight over /you/profile — so this is a stack, not the meal screen's one-at-a-time
// `overlay`. Esc, a scrim tap and the × close the TOP panel only. Focus moves into a panel on
// open and back to whatever opened it on close — a keyboard path ends where it started.

import { COPY, el } from "./shell.ts";
import { kitEl } from "./kit.ts";
import { ico } from "../shared/ui/kit.ts";

interface OpenPanel {
  scrim: HTMLElement;
  restore: Element | null;
}

const stack: OpenPanel[] = [];

const drop = (entry: OpenPanel): void => {
  stack.splice(stack.indexOf(entry), 1);
  entry.scrim.remove();
  if (entry.restore instanceof HTMLElement && entry.restore.isConnected) entry.restore.focus();
};

/** Close the topmost panel, if one is open. */
export function closePanel(): void {
  const top = stack.at(-1);
  if (top !== undefined) drop(top);
}

/** Close every open panel — for the moments a screen tears down under them (sign-out, a redraw). */
export function closeAllPanels(): void {
  while (stack.length > 0) closePanel();
}

// One listener for every panel — it takes the key only while a panel is up, and captures it so a
// screen's own Esc handling does not fire under one that is open.
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape" || stack.length === 0) return;
  e.stopPropagation();
  closePanel();
}, true);

// Panels sit on document.body, outside the screen's wrap — a render does not take them, so a
// navigation does: the app is hash-routed, and a panel over a different screen is a wrong panel.
window.addEventListener("hashchange", closeAllPanels);

/** Put a card on the scrim stack — focus moves to `focus`, Esc/scrim-tap close the top only. */
function present(card: HTMLElement, focus: HTMLElement): { close: () => void } {
  const scrim = el("div", "scrim");
  scrim.append(card);
  const entry: OpenPanel = { scrim, restore: document.activeElement };
  scrim.addEventListener("click", (e) => { if (e.target === scrim) drop(entry); });
  stack.push(entry);
  document.body.append(scrim);
  focus.focus();
  return { close: () => drop(entry) };
}

/**
 * Open a panel: × | title | spacer, then the caller's rows in `body`.
 *
 * `aria-label` carries the title because the visible one is a span, not a heading — the screen's
 * one h1 stays the screen's.
 */
export function openPanel(title: string): { body: HTMLElement; close: () => void } {
  const card = el("div", "card panel rise");
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-modal", "true");
  card.setAttribute("aria-label", title);
  const close = el("button", "ib") as HTMLButtonElement;
  close.type = "button";
  close.setAttribute("aria-label", COPY.cancel);
  close.append(kitEl(ico("x")));
  const spacer = el("span", "ib");
  spacer.setAttribute("aria-hidden", "true");
  spacer.style.visibility = "hidden";
  const head = el("div", "row between phead");
  head.append(close, el("span", "d d17", title), spacer);
  const body = el("div", "pbody");
  card.append(head, body);
  return { body, ...present(card, close) };
}

/**
 * The narrow confirm card (web/you-delete.html) — 400px and NO panel head: the question is the
 * body's first line and the caller's buttons are the way out. Esc and the scrim still dismiss it
 * and it stacks like a panel (the board draws it OVER the account one). Focus lands on the card
 * itself — the caller moves it onto the safe button once its rows exist.
 */
export function openDialog(label: string): { card: HTMLElement; close: () => void } {
  const card = el("div", "card panel rise dlg");
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-modal", "true");
  card.setAttribute("aria-label", label);
  card.tabIndex = -1;
  return { card, ...present(card, card) };
}

/** The dark pill the saved boards draw at the top — a few seconds, then it goes on its own. */
export function toast(text: string): void {
  const t = el("div", "toast", text);
  t.setAttribute("role", "status");
  document.body.append(t);
  setTimeout(() => t.remove(), 3600);
}
