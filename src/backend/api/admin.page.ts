// The admin page, as one self-contained string.
//
// No build step, no bundler, no CDN. A backend admin that needs its own toolchain is a backend
// admin that stops working the first time nobody has run `npm install` in eight months — and the
// content-security-policy this is served under blocks external anything on purpose.
//
// TWO RULES IN THE SCRIPT BELOW, both of which have teeth:
//
//  - Server data reaches the DOM through `.value` and `.textContent`, NEVER `innerHTML`. The thing
//    being edited here is copy that a previous admin typed; rendering it as markup would make this
//    page a stored-XSS sink pointed at the one browser session holding the admin token.
//  - The token lives in `sessionStorage`, not `localStorage`. It should not outlive the tab.
//
// String concatenation rather than template literals inside the script, because this whole file is
// a template literal and nesting them is how a page ends up half-evaluated on the server.

/**
 * The page, under a nonce.
 *
 * A FUNCTION SINCE #391b, and the reason is the credential it now holds. This page used to take a
 * string somebody typed; it now obtains a BEARER for an account, on an origin that also serves the
 * web application and the API. A script injected here is therefore worth every credential at once,
 * so the policy on the response is `default-src 'none'` with a per-request nonce and NO
 * `'unsafe-inline'` — and a nonce cannot come from a constant.
 */
import { ADMIN_PUSH_MAX_RECIPIENTS, LANG_LABEL, PUSH_ROUTES } from "@eait/shared";
import { fontFaces } from "@eait/shared/design";
import { lightVars } from "@eait/shared/palette";
import { brandSvg } from "@eait/shared/ui/icons";

export const adminPage = (nonce: string): string => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>eait — onboarding admin</title>
<!-- Empty data: icon. An anonymous request for an unknown path on this origin is answered 401
     by resolveUserId before anything can 404 it, so /favicon.ico logged a console error on every
     page load. A console that always has an error in it is a console nobody reads. -->
<link rel="icon" href="data:,">
<style nonce="${nonce}">
/* THE TOKENS COME FROM shared/palette.ts, and the typeface from shared/design.ts, exactly as the
   web application takes them (frontend/server/index.ts): Register P, one copy. The hand-rolled dark
   set this page carried was a second palette to keep in step with the first, and it was the one
   that did not match anything the product ships. Light only, like the other web surfaces. The
   typeface files are served by /start (public, whitelisted by name), so font-src 'self' is all the
   CSP adds. */
:root { ${lightVars}
  --sans: "Montserrat", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, Roboto, Helvetica, Arial, sans-serif;
  --r-card: 12px; --r-ctl: 10px; --r-btn: 8px;
  --shadow: 0 1px 2px rgba(23,25,28,.06), 0 8px 24px -16px rgba(23,25,28,.18);
}
${fontFaces("/start/assets/fonts")}
* { box-sizing: border-box; }
html, body { margin: 0; background: var(--bg); color: var(--ink); }
body { font: 400 13px/1.4 var(--sans); -webkit-font-smoothing: antialiased; }
h1 { font-size: 22px; font-weight: 700; letter-spacing: -0.02em; margin: 0; }
h2 { font-size: 15px; font-weight: 700; letter-spacing: -0.01em; margin: 28px 0 8px; }
h3 { font-size: 13px; font-weight: 700; margin: 20px 0 8px; }
a { color: inherit; }
code { font-size: 12px; }
.hidden { display: none !important; }
.muted { color: var(--muted); font-size: 13px; }
p.muted { max-width: 78ch; margin: 0 0 10px; }
.status { color: var(--muted); font-size: 13px; }

/* ── the shell: a left nav on a desk, a switcher on a phone ── */
.adm { display: flex; min-height: 100vh; }
.anav {
  width: 216px; flex: 0 0 216px; background: var(--surface); border-right: 1px solid var(--hair);
  padding: 18px 12px; display: flex; flex-direction: column; gap: 2px;
  position: sticky; top: 0; height: 100vh; overflow-y: auto;
}
.brand { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 15px; letter-spacing: -0.02em; }
.appicon { display: block; flex: 0 0 auto; }
.brand small { font-weight: 600; font-size: 11px; color: var(--muted); letter-spacing: .06em; text-transform: uppercase; }
.anav .brand { padding: 0 10px 14px; }
.anav h6 { margin: 14px 10px 4px; font-size: 11px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
.anav a {
  display: flex; align-items: center; justify-content: space-between; height: 32px; padding: 0 10px;
  border-radius: 8px; color: var(--ink); font-weight: 500; text-decoration: none;
}
.anav a:hover { background: var(--bg); }
.anav a.on { background: var(--accent-tint); color: var(--accent); font-weight: 600; }
.anav a b { font-size: 11px; font-weight: 600; color: var(--warn); background: var(--warn-tint); border-radius: 9px; padding: 1px 7px; }
.anav .who { margin-top: auto; padding: 10px; font-size: 12px; color: var(--muted); border-top: 1px solid var(--hair); }
.atop {
  display: none; align-items: center; gap: 10px; height: 52px; padding: 0 14px; background: var(--surface);
  border-bottom: 1px solid var(--hair); position: sticky; top: 0; z-index: 2;
}
.atop select { width: auto; margin-left: auto; font-weight: 600; max-width: 60%; }
.amain { flex: 1; min-width: 0; }
.ahead { display: flex; align-items: center; gap: 12px; padding: 20px 28px 14px; }
.abody { padding: 0 28px 28px; }
.view > .vbody > :first-child { margin-top: 0; }
@media (max-width: 760px) {
  .adm { flex-direction: column; }
  .anav { display: none; }
  .atop { display: flex; }
  .ahead { padding: 14px 14px 10px; }
  .ahead h1 { font-size: 20px; }
  .abody { padding: 0 14px 20px; }
}

/* ── the gate and the denied card: one card, centred ── */
.center { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 16px; }
.gatecard { width: 100%; max-width: 420px; padding: 28px; margin: 0; display: flex; flex-direction: column; gap: 12px; }
.gatecard .brand { font-size: 17px; }
.gatecard h2 { margin: 0; font-size: 17px; }
.gatecard p { margin: 0; color: var(--muted); }
.gatecard .actions { margin-top: 4px; }
.gate-error { color: var(--bad); font-size: 13px; }

/* ── the primitives ── */
/* Cards, and a card that is only a frame for a table. */
.card {
  background: var(--surface); border-radius: var(--r-card); box-shadow: 0 0 0 1px var(--hair);
  padding: 16px; margin-bottom: 12px; min-width: 0;
}
.card.flush { padding: 0; overflow: hidden; }
.card header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
.card header .id { font-weight: 700; letter-spacing: -0.01em; }
.card header .grow { flex: 1; }

/* Buttons: default, primary, danger. A link that acts like one wears .btn. */
button, a.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 32px; padding: 0 12px;
  border: 0; border-radius: var(--r-btn); background: var(--surface); color: var(--ink);
  box-shadow: 0 0 0 1px var(--line); font: 600 13px var(--sans); white-space: nowrap; cursor: pointer; text-decoration: none;
}
button:hover, a.btn:hover { box-shadow: 0 0 0 1px var(--muted); }
button.primary, a.btn.primary { background: var(--accent); color: var(--accent-ink); box-shadow: none; }
button.primary:hover, a.btn.primary:hover { filter: brightness(1.08); }
button.danger { color: var(--bad); box-shadow: 0 0 0 1px var(--bad); }
button.small { height: 26px; padding: 0 9px; font-size: 12px; }
a.btn.big { height: 40px; padding: 0 20px; }
button:disabled { opacity: .45; cursor: default; }
button:focus-visible, a:focus-visible, select:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

/* Status chip. Neutral by default; g is on plan, w needs a look, b is wrong. */
.chip {
  display: inline-flex; align-items: center; gap: 6px; height: 22px; padding: 0 8px; border-radius: 11px;
  font-size: 12px; font-weight: 600; background: var(--bg); color: var(--muted); box-shadow: 0 0 0 1px var(--hair); white-space: nowrap;
}
.chip::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.chip.n::before { display: none; }
.chip:empty { display: none; }
.chip.g { background: var(--accent-tint); color: var(--accent); box-shadow: none; }
.chip.w { background: var(--warn-tint); color: var(--warn); box-shadow: none; }
.chip.b { background: var(--bad-tint); color: var(--bad); box-shadow: none; }

/* Inputs. */
label { display: block; font-size: 12px; font-weight: 600; color: var(--muted); margin: 10px 0 4px; }
input:not([type=checkbox]), textarea, select {
  width: 100%; min-width: 0; height: 32px; padding: 0 10px; border: 0; border-radius: var(--r-btn);
  background: var(--surface); color: var(--ink); box-shadow: inset 0 0 0 1px var(--line); font: 400 13px var(--sans);
}
textarea { height: auto; min-height: 64px; padding: 8px 10px; line-height: 1.45; resize: vertical; }
input::placeholder, textarea::placeholder { color: var(--faint); }
input:focus, textarea:focus, select:focus { outline: 2px solid var(--accent); outline-offset: -1px; }
input[type=checkbox] { width: auto; accent-color: var(--accent); }
.checks { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 13px; }
.checks label { display: flex; gap: 4px; align-items: center; margin: 0; font-weight: 500; color: var(--ink); }
.row { display: flex; gap: 10px; margin-bottom: 8px; }
.row > * { flex: 1; min-width: 0; }
.row > button { flex: 0 0 auto; }
.row.flexwrap { flex-wrap: wrap; align-items: flex-start; align-content: flex-start; }
.row.flexwrap > * { flex: 1 1 140px; }
.row.flexwrap > button { flex: 0 0 auto; }

/* Tables live in a card and scroll INSIDE it: the page never scrolls sideways. */
.scrollx { overflow-x: auto; max-width: 100%; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th { text-align: left; font-size: 11px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--muted); padding: 8px 12px; border-bottom: 1px solid var(--hair); white-space: nowrap; background: var(--surface); }
td { padding: 9px 12px; border-bottom: 1px solid var(--hair); white-space: nowrap; }
tr:last-child td { border-bottom: 0; }
th.r, td.r { text-align: right; font-variant-numeric: tabular-nums; }
td.drop { color: var(--bad); }
td.empty { white-space: normal; text-align: center; color: var(--muted); padding: 28px 12px; }
#users tbody tr, #diary tbody tr { cursor: pointer; }
#users tbody tr:hover td, #diary tbody tr:hover td { background: var(--bg); }
/* ── Campaigns: the list on the left, the open campaign on the right ── */
.hacts { margin-left: auto; display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
.hacts .wide { display: inline; }
.camps { display: flex; align-items: flex-start; gap: 16px; margin-bottom: 12px; }
.camps-l { flex: 0 0 440px; min-width: 0; }
.camps-r { flex: 1 1 auto; min-width: 0; margin-bottom: 0; }
.alist { margin-bottom: 0; }
.alist button.citem {
  display: flex; width: 100%; height: auto; justify-content: flex-start; gap: 10px; padding: 11px 14px; border-radius: 0;
  box-shadow: none; background: transparent; border-bottom: 1px solid var(--hair); text-align: left; white-space: normal; font-weight: 400;
}
.alist button.citem:last-child { border-bottom: 0; }
.alist button.citem:hover { background: var(--bg); box-shadow: none; }
.alist button.citem.on, .alist button.citem.on:hover { background: var(--accent-tint); }
.alist button.citem:focus-visible { outline-offset: -2px; }
.citem .t { flex: 1; min-width: 0; }
.citem .t b { display: block; font-weight: 600; overflow-wrap: anywhere; }
.citem .t > span { font-size: 12px; color: var(--muted); }
.abar { height: 6px; border-radius: 3px; background: var(--hair); overflow: hidden; width: 64px; flex: 0 0 64px; }
.abar i { display: block; height: 100%; background: var(--accent); }
.ph { display: flex; align-items: center; gap: 10px; padding: 14px 16px; border-bottom: 1px solid var(--hair); }
.ph b { font-size: 15px; min-width: 0; overflow-wrap: anywhere; }
.ph .grow { flex: 1; }
.ph .hint { font-size: 12px; color: var(--muted); }
.pb { padding: 14px 16px; display: flex; flex-direction: column; gap: 14px; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.cmeta { display: flex; flex-wrap: wrap; gap: 4px 18px; color: var(--muted); }
.cmeta b { color: var(--ink); }
.pb p, .pb .card { margin: 0; }
.cfine { font-size: 12px; color: var(--muted); }
.aerr.ok { background: var(--accent-tint); color: var(--accent); }
.mwrap { position: relative; }
.amenu {
  position: absolute; right: 0; top: 38px; z-index: 2; min-width: 200px; padding: 4px; display: flex; flex-direction: column;
  background: var(--surface); border-radius: 10px; box-shadow: 0 0 0 1px var(--hair), 0 12px 32px -12px rgba(23,25,28,.3);
}
.amenu button { width: 100%; justify-content: flex-start; height: 32px; padding: 0 10px; border-radius: 6px; box-shadow: none; background: transparent; font-weight: 500; }
.amenu button:hover { background: var(--bg); box-shadow: none; }
.amenu button.d { color: var(--bad); }
.amenu hr { border: 0; border-top: 1px solid var(--hair); margin: 4px 0; width: 100%; }
button.dd { background: var(--bad); color: #fff; box-shadow: none; }
button.dd:hover { filter: brightness(1.08); box-shadow: none; }
.cnew { max-width: 900px; }
.cgrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.cform label { margin: 0 0 4px; }
.cform .grp { font-size: 12px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
.cform .flags { display: flex; flex-wrap: wrap; gap: 12px 16px; }
.cform .field { display: flex; flex-direction: column; min-width: 0; }
.cform .cfoot { display: flex; align-items: center; justify-content: flex-end; gap: 8px; }
.checks .cchip {
  position: relative; display: inline-flex; align-items: center; height: 22px; padding: 0 8px; border-radius: 11px; margin: 0; cursor: pointer;
  font-size: 12px; font-weight: 600; background: var(--bg); color: var(--muted); box-shadow: 0 0 0 1px var(--hair);
}
.cchip input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: pointer; }
.checks .cchip:has(input:checked) { background: var(--accent-tint); color: var(--accent); box-shadow: none; }
.checks .cchip:has(input:focus-visible) { outline: 2px solid var(--accent); outline-offset: 2px; }
.cform .promo { display: flex; align-items: center; gap: 8px; }
@media (max-width: 760px) {
  .camps { flex-direction: column; align-items: stretch; gap: 10px; }
  .camps-l { flex: none; }
  .alist { max-height: 300px; overflow-y: auto; }
  .cgrid { grid-template-columns: 1fr; }
}
@media (max-width: 600px) { .hacts .wide { display: none; } .hacts button { height: 26px; padding: 0 9px; font-size: 12px; } }
/* Push templates: the grid, filtered to what needs a look, with the editor beside it. */
#push-grid { scroll-padding-left: 120px; }
#push-grid table td, #push-grid table th { padding: 8px 6px; text-align: center; white-space: nowrap; }
#push-grid table td:first-child, #push-grid table th:first-child { text-align: left; padding-left: 14px; }
#push-grid td:first-child, #push-grid th:first-child { position: sticky; left: 0; background: var(--surface); white-space: normal; min-width: 150px; max-width: 190px; }
#push-grid td:first-child .chip { margin: 3px 4px 0 0; height: 20px; font-size: 11px; }
.cell { height: 22px; padding: 0 8px; border-radius: 11px; font-size: 11px; font-weight: 600; box-shadow: none; background: transparent; color: var(--muted); }
.cell:hover { box-shadow: 0 0 0 1px var(--muted); }
.cell.reviewed { padding: 0 6px; font-size: 13px; }
.cell.draft { background: var(--warn-tint); color: var(--warn); }
.cell.missing { background: var(--bad-tint); color: var(--bad); }
.cell.sel { outline: 2px solid var(--accent); outline-offset: 2px; }
.bh { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-bottom: 1px solid var(--hair); }
.bh .grow { flex: 1; }
#push-edit .pb { gap: 4px; }
#push-edit .pb label { margin: 8px 0 0; }
#push-edit .btns { margin-top: 10px; }
.pane-note { font-size: 12px; color: var(--muted); }

/* The three states every view can be in besides its content: loading, empty, error. */
.sk { background: var(--surface); border-radius: var(--r-card); box-shadow: 0 0 0 1px var(--hair); overflow: hidden; }
.sk-row { display: flex; gap: 14px; padding: 13px 14px; border-bottom: 1px solid var(--hair); }
.sk-row:last-child { border-bottom: 0; }
.sk-row i { display: block; height: 10px; border-radius: 5px; background: var(--hair); width: 90px; }
.sk-row i:nth-child(2) { width: 40px; }
.sk-row i:nth-child(3) { width: 56px; }
.sk-row i:nth-child(4) { width: 64px; }
.astate { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 40px 20px; text-align: center; color: var(--muted); }
.astate b { color: var(--ink); font-size: 14px; }
.aerr { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: var(--bad-tint); color: var(--bad); font-weight: 500; border-radius: var(--r-ctl); }
.aerr .sp { flex: 1; }
.aerr button { color: var(--ink); }
.errors { background: var(--bad-tint); color: var(--bad); border-radius: var(--r-ctl); padding: 12px 14px; margin-bottom: 14px; }
.errors ul { margin: 6px 0 0; padding-left: 18px; }
.errors li { font-size: 13px; }

/* Parts of the views that are still the old panels, in the new vocabulary. */
.options { border-top: 1px solid var(--hair); margin-top: 14px; padding-top: 10px; }
.opt { display: flex; gap: 10px; align-items: center; margin-bottom: 6px; }
.opt code { color: var(--care); min-width: 84px; }
.opt input { flex: 1; }
.line { display: flex; flex-wrap: wrap; gap: 4px 10px; padding: 6px 0; border-bottom: 1px solid var(--hair); font-size: 13px; }
.line:last-child { border-bottom: 0; }
.line .who { flex: 0 0 52px; color: var(--muted); }
.line .when { margin-left: auto; color: var(--faint); white-space: nowrap; }
.line .how { color: var(--faint); white-space: nowrap; }
.line.them .who { color: var(--care); }
img.shot { max-width: min(260px, 100%); border-radius: 8px; margin: 8px 8px 0 0; vertical-align: top; }
#composer .row { flex-wrap: wrap; align-items: center; }
#composer .row > * { flex: 1 1 160px; }
#composer .row > button { flex: 0 0 auto; }
@media (max-width: 600px) {
  #composer .row > *, #composer .row > button { flex: 1 1 100%; }
}
pre { overflow-x: auto; max-width: 100%; }

/* ── Accounts: the list, and the pane that opens beside it (a second screen on a phone) ── */
.split { display: flex; gap: 16px; align-items: flex-start; }
.split > .acol { flex: 1; min-width: 0; }
.sbar { display: flex; gap: 8px; padding: 10px 14px; border-bottom: 1px solid var(--hair); }
.sbar input { flex: 1; }
.foot { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-top: 1px solid var(--hair); font-size: 12px; color: var(--muted); }
.foot.flat { padding: 10px 0 0; border-top: 0; }
.foot .grow { flex: 1; }
.card.flush > .astate { border: 0; }
#users input[type=checkbox] { width: 16px; height: 16px; margin: 0; }
#users tbody tr.on td { background: var(--accent-tint); }
.apane {
  flex: 0 0 420px; width: 420px; background: var(--surface); border-radius: var(--r-card); box-shadow: 0 0 0 1px var(--hair);
  overflow: hidden; position: sticky; top: 12px; min-width: 0;
}
.apane > .ph .t { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.amono { font: 12px ui-monospace, SFMono-Regular, Menlo, monospace; }
.aseg { display: inline-flex; align-self: flex-start; max-width: 100%; padding: 2px; border-radius: 9px; background: var(--bg); box-shadow: inset 0 0 0 1px var(--hair); }
.aseg button { height: 28px; padding: 0 10px; border-radius: 7px; background: transparent; box-shadow: none; font-size: 12px; color: var(--muted); }
.aseg button:hover { box-shadow: none; color: var(--ink); }
.aseg button.on { background: var(--surface); color: var(--ink); box-shadow: 0 1px 2px rgba(23,25,28,.08); }
.tab { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.kvs { display: flex; flex-direction: column; gap: 6px; }
.kv { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.kv > span:last-child { text-align: right; min-width: 0; overflow-wrap: anywhere; }
.sect { display: flex; flex-direction: column; gap: 6px; border-top: 1px solid var(--hair); padding-top: 10px; margin-top: 10px; }
.sect.kv { flex-direction: row; }
.sect p { margin: 0; }
.sect .row { margin: 0; }
.muted.warn { color: var(--warn); margin: 0; font-size: 12px; }
button.quiet { box-shadow: none; color: var(--muted); }
.ahead .back { margin-left: auto; }
.asw { width: 34px; height: 20px; padding: 0; border-radius: 10px; background: var(--line); box-shadow: none; position: relative; flex: 0 0 34px; }
.asw:hover { box-shadow: none; }
.asw::after { content: ""; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.2); }
.asw.on { background: var(--accent); }
.asw.on::after { left: 16px; }
/* ── Numbers, Pushes, Funnel, Food database: KPI cards over a box, the boards' admin-numbers family ── */
.nv { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.nv > .card, .nv > p.muted { margin: 0; }
.nv > p.muted { font-size: 12px; }
.ahead .aseg { margin-left: auto; }
.akpi { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; min-width: 0; }
.akpi.k3 { grid-template-columns: repeat(3, 1fr); }
.akpi > div { background: var(--surface); border-radius: var(--r-card); box-shadow: 0 0 0 1px var(--hair); padding: 12px 14px; min-width: 0; }
.akpi .k { font-size: 12px; color: var(--muted); font-weight: 500; }
.akpi .v2 { font-size: 22px; font-weight: 700; letter-spacing: -.02em; font-variant-numeric: tabular-nums; margin-top: 2px; }
.akpi .v2 small { font-size: 13px; font-weight: 400; letter-spacing: 0; color: var(--muted); }
.akpi .dl { font-size: 12px; font-weight: 600; color: var(--muted); }
.akpi .dl.up { color: var(--accent); }
.akpi .dl.dn { color: var(--bad); }
.akpi .dl.warn { color: var(--warn); }
.akpi i { display: block; height: 12px; width: 60%; border-radius: 6px; background: var(--hair); }
.akpi i + i { width: 40%; margin-top: 10px; }
tr.tot td { font-weight: 600; background: var(--bg); }
.abar.wide { width: 160px; flex-basis: 160px; }
#funnel.slim .x { display: none; }
.srow { display: flex; align-items: center; gap: 10px; padding: 11px 14px; border-bottom: 1px solid var(--hair); }
.srow:last-child { border-bottom: 0; }
.srow .t { flex: 1; min-width: 0; }
.srow .t b { display: block; font-weight: 600; }
.srow .t > span { font-size: 12px; color: var(--muted); }
.nv.food { max-width: 720px; }
.pb.flips { gap: 6px; }
@media (max-width: 760px) { #head-window { display: none; } .abar.wide { width: 72px; flex-basis: 72px; } #view-numbers .ph b, #view-pushes .ph b, #view-funnel .ph b { white-space: nowrap; } #funnel-hint, #pushes-zone { display: none; } }
@media (max-width: 760px) { #metrics th, #metrics td, #pushes th, #pushes td, #funnel th, #funnel td { padding: 8px 10px; } }
@media (max-width: 760px) { .akpi:not(.k3) { grid-template-columns: 1fr 1fr; gap: 8px; } .akpi { gap: 8px; } }
.btns { display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px; }
#composer .result { background: var(--accent-tint); color: var(--accent); border-radius: var(--r-ctl); padding: 10px 14px; margin: 10px 0 0; font-weight: 500; }
#composer ul { margin: 8px 0 0; padding-left: 18px; font-size: 12px; }
#composer p.muted { margin: 8px 0 0; font-size: 12px; }
.ascrim { position: fixed; inset: 0; background: rgba(23,25,28,.36); z-index: 5; display: flex; align-items: center; justify-content: center; padding: 16px; }
.adlg { background: var(--surface); border-radius: 14px; padding: 20px; width: 420px; max-width: 100%; display: flex; flex-direction: column; gap: 12px; box-shadow: 0 24px 60px -20px rgba(23,25,28,.4); }
.adlg h2 { margin: 0; font-size: 17px; }
.adlg p { margin: 0; }
@media (max-width: 760px) {
  .split { flex-direction: column; align-items: stretch; }
  .apane { flex: 0 0 auto; width: auto; position: static; }
  .split.open > .acol { display: none; }
  #pane-close { display: none; }
}

/* The save bar belongs to the onboarding copy and sits at the foot of that view alone. */
.bar {
  position: sticky; bottom: 12px; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: flex-end;
  background: var(--surface); border-radius: var(--r-card); padding: 12px 14px; box-shadow: 0 0 0 1px var(--hair), var(--shadow);
}
.bar .status { margin-right: auto; }
.bar .status.warn { color: var(--warn); }
.ahead select { width: auto; margin-left: auto; }
#copy-new { margin-left: auto; }

/* Onboarding copy: a sub-nav across its four sections, one section at a time. */
.obsplit { display: flex; gap: 16px; align-items: flex-start; }
.obsplit > .acol { flex: 1; min-width: 0; }
.subnav { flex: 0 0 220px; width: 220px; background: var(--surface); border-radius: var(--r-card); box-shadow: 0 0 0 1px var(--hair); overflow: hidden; position: sticky; top: 12px; }
.subnav button { display: flex; flex-direction: column; align-items: flex-start; justify-content: center; gap: 1px; width: 100%; height: auto; min-height: 40px; padding: 8px 14px; border-radius: 0; box-shadow: none; border-bottom: 1px solid var(--hair); text-align: left; }
.subnav button:last-child { border-bottom: 0; }
.subnav button:hover { background: var(--bg); box-shadow: none; }
.subnav button.on { background: var(--accent-tint); color: var(--accent); }
.subnav small { font-weight: 400; font-size: 12px; color: var(--muted); }
#body-onboarding textarea { min-height: 48px; }
details.how { margin-bottom: 14px; }
details.how summary { cursor: pointer; font-weight: 600; color: var(--muted); }
details.how p { margin-top: 8px; }
@media (max-width: 760px) {
  .obsplit { flex-direction: column; align-items: stretch; }
  .subnav { flex: 0 0 auto; width: auto; position: static; display: flex; overflow-x: auto; }
  .subnav button { width: auto; flex: 0 0 auto; border-bottom: 0; border-right: 1px solid var(--hair); white-space: nowrap; }
  .subnav small { display: none; }
}

/* System prompts: a card each, and one history pane beside them. */
.pcol { display: flex; gap: 16px; align-items: flex-start; }
.pcol > .acol { flex: 1; min-width: 0; }
.pcard header { margin-bottom: 10px; flex-wrap: nowrap; align-items: baseline; }
.pcard header .id { font: 700 13px ui-monospace, SFMono-Regular, Menlo, monospace; }
.pcard header .muted { font-size: 12px; font-weight: 500; flex: 1; min-width: 0; }
.pcard textarea { min-height: 150px; font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; }
.pact { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 8px; margin-top: 10px; }
.pact .status { margin-right: auto; min-width: 0; }
.status.bad { color: var(--bad); }
#prompt-history { flex: 0 0 360px; width: 360px; }
#prompt-history details { border-bottom: 1px solid var(--hair); }
#prompt-history summary { padding: 10px 16px; cursor: pointer; display: flex; flex-direction: column; }
#prompt-history summary small { font-size: 12px; color: var(--muted); }
#prompt-history pre { margin: 0; padding: 0 16px 12px; white-space: pre-wrap; overflow-wrap: anywhere; font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; }
@media (max-width: 760px) {
  .pcol { flex-direction: column; align-items: stretch; }
  #prompt-history { flex: 0 0 auto; width: auto; }
  .pcard header { flex-wrap: wrap; }
}
</style>
</head>
<body>

<div class="center" id="gate">
  <div class="card gatecard">
    <div class="brand">${brandSvg("eait", { size: 20, class: "appicon" })}eait admin</div>
    <p>Sign in with a staff account.</p>
    <p id="gate-error" class="hidden gate-error"></p>
    <div class="actions"><a class="btn primary big" id="signin" href="/start">Sign in</a></div>
  </div>
</div>

<div class="center hidden" id="denied">
  <div class="card gatecard">
    <div class="brand">${brandSvg("eait", { size: 20, class: "appicon" })}eait admin</div>
    <h2>That account cannot administer this instance.</h2>
    <p>It is signed in, but it is not staff. Ask a staff member to make this account staff, or sign in with another.</p>
    <div class="actions"><button id="other-account">Sign in with another account</button></div>
  </div>
</div>

<div class="adm hidden" id="app">
  <nav class="anav" aria-label="Admin">
    <span class="brand">${brandSvg("eait", { size: 20, class: "appicon" })}eait <small>admin</small></span>
    <h6>Operate</h6>
    <a href="#numbers" data-nav="numbers">Numbers</a>
    <a href="#pushes" data-nav="pushes">Pushes</a>
    <a href="#funnel" data-nav="funnel">Funnel</a>
    <a href="#campaigns" data-nav="campaigns">Campaigns</a>
    <a href="#accounts" data-nav="accounts">Accounts</a>
    <h6>Content</h6>
    <a href="#onboarding" data-nav="onboarding">Onboarding copy</a>
    <a href="#templates" data-nav="templates">Push templates<b id="templates-badge" class="hidden"></b></a>
    <a href="#prompts" data-nav="prompts">System prompts</a>
    <h6>System</h6>
    <a href="#food" data-nav="food">Food database</a>
    <div class="who">Signed in · staff</div>
  </nav>
  <div class="atop">
    <span class="brand">eait admin</span>
    <select id="switcher" aria-label="View">
      <optgroup label="Operate">
        <option value="numbers">Numbers</option>
        <option value="pushes">Pushes</option>
        <option value="funnel">Funnel</option>
        <option value="campaigns">Campaigns</option>
        <option value="accounts">Accounts</option>
      </optgroup>
      <optgroup label="Content">
        <option value="onboarding">Onboarding copy</option>
        <option value="templates">Push templates</option>
        <option value="prompts">System prompts</option>
      </optgroup>
      <optgroup label="System">
        <option value="food">Food database</option>
      </optgroup>
    </select>
  </div>

  <div class="amain">
    <div class="ahead"><h1 id="view-title">Numbers</h1><span class="aseg hidden" id="head-window"></span><button class="small quiet back hidden" id="view-back">‹ All accounts</button><select id="lang" class="hidden" aria-label="Language"></select><button class="hidden" id="copy-new">New campaign copy</button></div>
    <div class="abody">

<!-- ONE VIEW AT A TIME. Each section is a state box (loading or error) and a body that is shown
     once the view's own data has arrived. A view loads the first time it is opened, and a failure
     stays inside it: the gate and the denied card come from the session check and nothing else. -->

<section class="view hidden" id="view-numbers">
  <div id="state-numbers"></div>
  <div class="vbody hidden" id="body-numbers"><div class="nv">
    <div class="akpi" id="numbers-kpi"></div>
    <div class="card flush">
      <div class="ph"><b id="numbers-title"></b><span class="grow"></span><button class="small quiet" id="numbers-more"></button></div>
      <div class="scrollx"><table id="metrics">
        <thead>
          <tr><th>Day</th><th class="r">Signups</th><th class="r">Activated</th><th class="r">Analyses</th><th class="r">Spend</th></tr>
        </thead>
        <tbody></tbody>
      </table></div>
    </div>
    <p class="muted"><strong>Analyses, not money.</strong> Spend is what the provider billed; an unpriced call shows its count.</p>
  </div></div>
</section>

<section class="view hidden" id="view-pushes">
  <div id="state-pushes"></div>
  <div class="vbody hidden" id="body-pushes"><div class="nv">
    <div class="akpi" id="pushes-kpi"></div>
    <div class="card flush">
      <div class="ph"><b>By day and template</b><span class="grow"></span><span class="hint" id="pushes-zone"></span><button class="small quiet" id="pushes-more"></button></div>
      <div class="scrollx"><table id="pushes">
        <thead>
          <tr><th>Day</th><th>Kind</th><th>Template</th><th class="r">Sent</th><th class="r">Accepted</th><th class="r">Dead</th><th class="r">Delivered</th><th class="r">Opened</th><th class="r">Converted</th></tr>
        </thead>
        <tbody></tbody>
      </table></div>
    </div>
  </div></div>
</section>

<section class="view hidden" id="view-funnel">
  <div id="state-funnel"></div>
  <div class="vbody hidden" id="body-funnel"><div class="nv">
      <div class="akpi k3" id="funnel-kpi"></div>
    <div class="card flush">
      <div class="ph"><b>Where people leave</b><span class="grow"></span><span class="hint" id="funnel-hint">Back and Refused in the full table</span><button class="small quiet" id="funnel-more">Show all columns</button></div>
      <div class="scrollx"><table id="funnel" class="slim">
        <thead>
          <tr><th>Screen</th><th></th><th class="r">Views</th><th class="r">Answers</th><th class="r">Drop</th><th class="r x">Back</th><th class="r x">Refused</th><th class="r">Median</th></tr>
        </thead>
        <tbody></tbody>
      </table></div>
    </div>
  </div></div>
</section>

<section class="view hidden" id="view-campaigns">
  <div id="state-campaigns"></div>
  <div class="vbody hidden" id="body-campaigns">
    <div class="aerr hidden" id="campaigns-state">All campaigns are stopped. Resume all campaigns starts them where they stopped.</div>
    <div id="campaign-errors" class="errors hidden"><strong>Not done.</strong><ul></ul></div>
    <div id="camp-list-mode">
      <div id="campaigns-empty" class="card flush hidden">
        <div class="astate"><b>No campaigns yet.</b><span>A campaign starts as a draft; nothing sends until you schedule it.</span>
          <button class="primary" id="campaign-new">New campaign</button></div>
      </div>
      <div class="camps" id="camps">
        <div class="camps-l"><div class="card flush alist" id="camp-list"></div></div>
        <div class="card flush camps-r" id="camp-detail"></div>
      </div>
      <datalist id="campaign-keys"></datalist>
    </div>
    <div id="camp-new-mode" class="hidden">
      <div class="card flush cnew">
        <div class="ph"><b>New campaign</b><span class="hint">starts as a draft; Schedule sends it</span></div>
        <div class="pb cform" id="campaign-form"></div>
      </div>
    </div>
  </div>
</section>

<section class="view hidden" id="view-accounts">
  <div id="state-accounts"></div>
  <div class="vbody hidden" id="body-accounts">
    <div class="split" id="split">
      <div class="acol">
        <div class="card flush">
          <div class="sbar">
            <input type="text" id="users-q" placeholder="email address, or the start of a user id"
                   autocomplete="off" spellcheck="false" aria-label="Search accounts">
            <button id="users-search">Search</button>
          </div>
          <div class="scrollx" id="users-wrap"><table id="users">
            <thead>
              <tr><th>Push</th><th>Account</th><th>Signed up</th><th>Via</th><th>Paid</th><th class="r">Sample</th><th class="r">Today</th><th class="r">Last seen</th></tr>
            </thead>
            <tbody></tbody>
          </table></div>
          <div class="astate hidden" id="users-empty"><b id="users-empty-title"></b><span id="users-empty-note"></span></div>
          <div class="foot hidden" id="users-foot">
            <span id="users-status"></span>
            <span class="grow"></span>
            <button class="small hidden" id="users-more">Load more</button>
          </div>
        </div>
      </div>

      <aside class="apane hidden" id="pane" aria-label="Account">
        <div class="ph">
          <span class="t"><b id="pane-name"></b><br><span class="amono muted" id="pane-id"></span></span>
          <button class="small quiet" id="pane-close">Close</button>
        </div>
        <div class="pb">
          <span class="aseg" id="tabs">
            <button class="on" data-tab="profile">Profile</button>
            <button data-tab="thread">Thread</button>
            <button data-tab="diary">Diary</button>
            <button data-tab="push">Send a push</button>
          </span>

          <div id="tab-profile" class="tab">
            <div id="pane-state"></div>
            <div class="hidden" id="pane-body">
              <div class="kvs">
                <div class="kv"><span class="muted">Signed up</span><span id="p-signup"></span></div>
                <div class="kv"><span class="muted">Plan</span><span id="p-plan"></span></div>
                <div class="kv"><span class="muted">Language</span><span id="p-lang"></span></div>
                <div class="kv"><span class="muted">Subscription</span><span class="chip n" id="p-sub"></span></div>
                <div class="kv"><span class="muted">Streak</span><span id="p-streak"></span></div>
              </div>
              <div class="kv sect">
                <span><b>Staff</b><br><span class="muted">Can open /admin and receive test pushes</span></span>
                <button class="asw" id="staff-switch" role="switch" aria-checked="false" aria-label="Staff"></button>
              </div>
              <p class="aerr hidden" id="staff-error"></p>
              <div class="sect">
                <b>Analyses before the paywall</b>
                <p class="muted" id="cap-status"></p>
                <div class="row">
                  <input type="text" id="cap-n" inputmode="numeric" placeholder="instance default" aria-label="Analyses before the paywall">
                  <button class="primary" id="cap-save">Save</button>
                </div>
              </div>
              <div class="sect">
                <b>Pushes a day</b>
                <p class="muted" id="pushmax-status">The most this account is sent in one local day, across every sender. Empty: no limit.</p>
                <div class="row">
                  <input type="text" id="pushmax-n" inputmode="numeric" placeholder="no limit" aria-label="Pushes a day">
                  <button class="primary" id="pushmax-save">Save</button>
                </div>
              </div>
            </div>
          </div>

          <div id="tab-thread" class="tab hidden">
            <p class="muted warn">Medical free text: read only what the question needs. There is no way to write here, deliberately.</p>
            <div id="thread-state"></div>
            <div class="hidden" id="thread-body">
              <div id="chat"></div>
              <div class="foot flat">
                <span id="chat-status"></span>
                <span class="grow"></span>
                <button class="small hidden" id="chat-older">Older</button>
              </div>
            </div>
          </div>

          <div id="tab-diary" class="tab hidden">
            <div id="diary-state"></div>
            <div class="hidden" id="diary-body">
              <div class="row">
                <input type="text" id="diary-from" placeholder="from (YYYY-MM-DD)" autocomplete="off" spellcheck="false" aria-label="From">
                <input type="text" id="diary-to" placeholder="to (YYYY-MM-DD)" autocomplete="off" spellcheck="false" aria-label="To">
                <button id="diary-load">Load</button>
              </div>
              <div class="card flush"><div class="scrollx"><table id="diary">
                <thead>
                  <tr><th>When</th><th>What</th><th class="r">kcal</th><th class="r">Photos</th></tr>
                </thead>
                <tbody></tbody>
              </table></div></div>
              <p class="muted" id="diary-status"></p>
              <div id="photos"></div>
            </div>
          </div>

          <div id="tab-push" class="tab hidden">
            <div id="composer">
              <label for="composer-template">Template</label>
              <select id="composer-template"></select>
              <label for="composer-route">Opens</label>
              <select id="composer-route"></select>
              <label for="composer-image">Image</label>
              <input type="text" id="composer-image" placeholder="optional image URL on this server's own host" autocomplete="off" spellcheck="false">
              <div class="btns">
                <button id="composer-test">Send test push</button>
                <button class="primary" id="composer-send">Send</button>
              </div>
              <p class="result hidden" id="composer-status"></p>
              <ul id="composer-results"></ul>
              <p class="muted" id="composer-count"></p>
              <p class="muted">A test goes to this account only and needs it to be staff. Send goes to the ticked accounts and skips those with tips and offers off.</p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  </div>
</section>

<div class="ascrim hidden" id="confirm">
  <div class="adlg" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
    <h2 id="confirm-title"></h2>
    <p class="muted" id="confirm-text"></p>
    <input class="hidden" id="confirm-input" autocomplete="off">
    <div class="btns">
      <button id="confirm-cancel">Cancel</button>
      <button class="primary" id="confirm-ok"></button>
    </div>
  </div>
</div>

<section class="view hidden" id="view-onboarding">
  <div id="state-onboarding"></div>
  <div class="vbody hidden" id="body-onboarding">
    <div class="obsplit">
      <nav class="subnav" id="ob-nav" aria-label="Onboarding sections"></nav>
      <div class="acol">
        <details class="how">
          <summary>How saving works</summary>
          <p class="muted">
            Every word Spud says to POSE a question, plus the option labels, the front door and the plan.
            The <em>questions</em> are fixed in code — they feed the calorie target — and so is their order,
            and so are Spud's replies and the support cards, which carry citations. Saving bumps the content
            version, which is what the funnel is grouped by.
          </p>
          <p class="muted">
            One language at a time. A save replaces the language in the picker and nothing beside it, and
            takes the next version number — one counter across all eight, so no two revisions ever share
            one and the funnel can still say which words it counted. The eight shipped revisions are
            one editorial revision and share a number; they stop sharing it the first time anybody saves.
            A language nobody has saved serves the copy the app ships with, in that language — never
            English, because half an onboarding in English is worse than none of it.
          </p>
        </details>

        <div id="errors" class="errors hidden"><strong>Not saved.</strong><ul></ul></div>

        <div id="ob-welcome" data-sec="welcome">
          <p class="muted">
            The first thing anyone sees. The lines under the title are what we do NOT ask for — do not name a
            competitor there, do not write "free", and do not promise away the card, the trial or the
            cancelling: the app sells a subscription behind a free trial, so those are no longer true.
            Nor is "no email" — signing in asks Apple and Google for the address. What is still true is that
            the whole app works without an account at all.
          </p>
          <div id="welcome"></div>
        </div>

        <div id="ob-screens" data-sec="screens">
          <div id="screens"></div>
        </div>

        <div id="ob-building" data-sec="building">
          <p class="muted">
            Labels only. Every figure beside them is computed from the person's own answers and cannot be
            edited here.
          </p>
          <div id="building"></div>
        </div>

        <div id="ob-summary" data-sec="summary">
          <p class="muted">
            <code>{weeks}</code> and <code>{month}</code> are substituted into the projection line. It is
            hidden entirely for anyone the arithmetic cannot honestly project.
          </p>
          <div id="summary"></div>
        </div>

        <div class="bar" id="bar">
          <span class="status" id="status"></span>
          <button id="reload">Reload</button>
          <button id="reset">Restore defaults</button>
          <button class="primary" id="save">Save</button>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="view hidden" id="view-templates">
  <div id="state-templates"></div>
  <div class="vbody hidden" id="body-templates">
    <p class="muted">
      The words of every push, per language, and the only place they live. The <code>trial-end</code>
      line is <em>local</em>: the phone sends it, so the server never reads it, but it is reviewed here
      like the rest. A message is sent only when <strong>all eight
      languages</strong> have a <em>reviewed</em> row for each of its variants; one draft or gap in
      any language stops that message for everybody. Marking a row reviewed runs the claims gate
      (no health claims, no health values); a refusal is shown below in the gate's own words. The
      braces are filled by the server and a plural block needs exactly the categories its language has.
    </p>
    <div id="push-errors" class="errors hidden"><strong>Not saved.</strong><ul></ul></div>
    <div class="split">
      <div class="acol">
        <div class="card flush">
          <div class="bh">
            <span class="aseg" id="push-filter">
              <button id="push-f-need" class="on"></button>
              <button id="push-f-all"></button>
            </span>
            <span class="grow"></span>
            <span class="muted">✓ reviewed</span>
          </div>
          <div id="push-grid" class="scrollx"></div>
        </div>
      </div>
      <div class="apane hidden" id="push-edit"></div>
    </div>
    <h2>Campaign copy</h2>
    <p class="muted">
      A campaign sends its own words, one title and one body per language, with no placeholders: everybody
      gets the same sentence. A key is campaign:, then lowercase words joined by hyphens. It can be
      scheduled only when all eight languages are reviewed, and a save is refused by the same claims and
      gender checks as every other push text.
    </p>
    <div class="card flush"><div class="scrollx"><table id="campaign-copy">
      <thead><tr><th>Key</th><th>Missing or draft</th></tr></thead>
      <tbody></tbody>
    </table></div></div>
  </div>
</section>

<section class="view hidden" id="view-prompts">
  <div id="state-prompts"></div>
  <div class="vbody hidden" id="body-prompts">
    <p class="muted">
      <strong>These go straight to a model.</strong> Nothing here is typechecked and nothing is
      reviewed — what you save is what the next analysis is asked. The five are what the server sends:
      the photo analyzer, the text router and the two prompts behind it, and
      the coach. They are stored as rows, so a save takes effect on the next request with no deploy.
    </p>
    <p class="muted">
      A prompt marked <em>shipped</em> is the text this build was written with, and a deploy keeps it
      current. The moment you save one it becomes <em>yours</em>, and no later deploy will touch it —
      including to carry across a change made in the code. <strong>Restore shipped</strong> puts the
      build's text back, and is itself a save. Nothing is overwritten: every version is kept, and
      <strong>History</strong> shows what was being sent and from when.
    </p>
    <div id="prompt-errors" class="errors hidden"><strong>Not saved.</strong><ul></ul></div>
    <div class="pcol">
      <div class="acol"><div id="prompts"></div></div>
      <div class="apane hidden" id="prompt-history"></div>
    </div>
  </div>
</section>

<section class="view hidden" id="view-food">
  <div id="state-food"></div>
  <div class="vbody hidden" id="body-food"><div class="nv food">
    <div class="card flush" id="switches"></div>
    <div class="card flush">
      <div class="ph"><b>Recent flips</b><span class="grow"></span><span class="status" id="switch-status"></span></div>
      <div class="pb flips" id="switch-recent"></div>
    </div>
    <p class="muted">A flip applies to the next analysis. Nothing already logged changes.</p>
  </div></div>
</section>

    </div>
  </div>
</div>

<script nonce="${nonce}">
(function () {
  "use strict";

  // NOT IN sessionStorage ANY MORE (#391b). What this holds is a bearer for a real account rather
  // than a shared string, and one in storage survives the tab and is readable by any script that
  // ever runs on this origin — an origin that now also serves the web application. A variable in
  // this closure is gone when the tab is; the cost is one round trip after a reload, which is the
  // correct price. /start/session/token is where it comes from, and the HttpOnly session cookie
  // set by /start is what authorises that call.
  //
  // (No backticks anywhere inside this page: the whole document is one template literal, and a
  // backtick ends it. The failure is a TypeScript parse error a hundred lines away.)
  var token = "";
  // The language every copy call is about. It rides the query string rather than the body so that
  // GET, PUT and reset all say it the same way, and so a bookmark opens the page it was left on.
  var lang = "en";
  var langs = [];
  var labels = {};
  var content = null;
  var meta = null;

  var $ = function (id) { return document.getElementById(id); };

  function api(method, path, body) {
    return fetch(path, {
      method: method,
      headers: body
        ? { authorization: "Bearer " + token, "content-type": "application/json" }
        : { authorization: "Bearer " + token },
      body: body ? JSON.stringify(body) : undefined
    }).then(function (res) {
      return res.text().then(function (text) {
        // A 500 from a proxy is HTML, and a view's error must say 500 rather than "Unexpected token".
        var parsed = {};
        try { parsed = text ? JSON.parse(text) : {}; } catch (_) { if (res.ok) throw new Error("unreadable answer"); }
        if (!res.ok) { var err = new Error(parsed.error || res.status); err.body = parsed; err.status = res.status; throw err; }
        return parsed;
      });
    });
  }

  /** A copy path with the language on it. Every read and write of copy goes through this. */
  // ASKED, not lang: while a switch is in flight the two differ, and every request of that load
  // must carry the language being loaded rather than the one still on screen.
  var asked = lang;
  function atLang(path) { return path + (path.indexOf("?") === -1 ? "?" : "&") + "lang=" + encodeURIComponent(asked); }

  function status(msg) { var el = $("status"); el.textContent = msg; el.classList.remove("warn"); }

  // ── Building the editor ────────────────────────────────────────────────────────────────────

  function field(parent, labelText, value, onInput, multiline) {
    var l = document.createElement("label");
    l.textContent = labelText;
    var input = document.createElement(multiline ? "textarea" : "input");
    if (!multiline) input.type = "text";
    input.value = value == null ? "" : value;
    input.addEventListener("input", function () { onInput(input.value); });
    parent.appendChild(l);
    parent.appendChild(input);
    return input;
  }

  function screenCard(screen) {
    var info = meta.screens.filter(function (s) { return s.id === screen.id; })[0] || { options: [], optional: false };
    var card = document.createElement("div");
    card.className = "card";

    var head = document.createElement("header");
    var id = document.createElement("span");
    id.className = "id";
    id.textContent = screen.id;
    head.appendChild(id);

    if (info.optional) {
      var toggle = document.createElement("label");
      toggle.style.cssText = "margin:0;display:flex;align-items:center;gap:6px;color:var(--muted)";
      var box = document.createElement("input");
      box.type = "checkbox";
      box.style.width = "auto";
      box.checked = screen.enabled !== false;
      box.addEventListener("change", function () { screen.enabled = box.checked; });
      toggle.appendChild(box);
      toggle.appendChild(document.createTextNode("shown"));
      head.appendChild(toggle);
    } else {
      var pill = document.createElement("span");
      pill.className = "chip n";
      pill.textContent = "required — feeds the target";
      head.appendChild(pill);
    }

    var grow = document.createElement("span");
    grow.className = "grow";
    head.appendChild(grow);
    card.appendChild(head);

    // What Spud SAYS to ask each field. One box per bubble: the flow is a conversation, so a
    // question can be one sentence or three, and each entry is one thing he sends.
    screen.asks = screen.asks || {};
    info.fields.forEach(function (fieldName) {
      var ask = screen.asks[fieldName] = screen.asks[fieldName] || { lines: [""] };
      if (!Array.isArray(ask.lines) || !ask.lines.length) ask.lines = [""];
      var block = document.createElement("div");
      block.className = "options";
      var name = document.createElement("div");
      name.className = "muted";
      name.textContent = "Asks " + fieldName;
      block.appendChild(name);
      ask.lines.forEach(function (line, i) {
        field(block, "Bubble " + (i + 1), line, function (v) { ask.lines[i] = v; }, true);
      });
      if (ask.lines.length < 4) {
        var add = document.createElement("button");
        add.className = "small";
        add.textContent = "+ bubble";
        add.addEventListener("click", function () { ask.lines.push(""); render(); });
        block.appendChild(add);
      }
      if (ask.lines.length > 1) {
        var drop = document.createElement("button");
        drop.className = "small";
        drop.textContent = "− bubble";
        drop.addEventListener("click", function () { ask.lines.pop(); render(); });
        block.appendChild(drop);
      }
      field(block, "Placeholder (optional — typed answers only)", ask.placeholder, function (v) {
        if (v) ask.placeholder = v; else delete ask.placeholder;
      });
      card.appendChild(block);
    });

    if (info.options.length) {
      var opts = document.createElement("div");
      opts.className = "options";
      var head2 = document.createElement("div");
      head2.className = "muted";
      head2.textContent = "Options — the values are fixed; the words are yours.";
      opts.appendChild(head2);

      info.options.forEach(function (key) {
        screen.options = screen.options || {};
        screen.options[key] = screen.options[key] || { label: "" };
        var o = screen.options[key];
        var line = document.createElement("div");
        line.className = "opt";
        var code = document.createElement("code");
        code.textContent = key;
        var label = document.createElement("input");
        label.type = "text";
        label.placeholder = "label";
        label.value = o.label || "";
        label.addEventListener("input", function () { o.label = label.value; });
        var hint = document.createElement("input");
        hint.type = "text";
        hint.placeholder = "hint (optional)";
        hint.value = o.hint || "";
        hint.addEventListener("input", function () {
          if (hint.value) o.hint = hint.value; else delete o.hint;
        });
        line.appendChild(code);
        line.appendChild(label);
        line.appendChild(hint);
        opts.appendChild(line);
      });
      card.appendChild(opts);
    }

    return card;
  }

  function sectionHead(card, text) {
    var head = document.createElement("header");
    var id = document.createElement("span");
    id.className = "id";
    id.textContent = text;
    head.appendChild(id);
    card.appendChild(head);
  }

  function welcomeCard() {
    var w = content.welcome;
    var card = document.createElement("div");
    card.className = "card";
    sectionHead(card, "Welcome screen");
    // Rendered from the array each time, so removing a bubble is emptying its box rather than
    // hunting for a delete control. The validator refuses an empty list, which is the guard.
    w.lines.forEach(function (line, i) {
      field(card, "Bubble " + (i + 1), line, function (v) { w.lines[i] = v; }, true);
    });
    if (w.lines.length < 4) {
      var add = document.createElement("button");
      add.textContent = "Add a bubble";
      add.addEventListener("click", function () { w.lines.push(""); render(); });
      card.appendChild(add);
    }
    field(card, "Quick reply that starts the flow", w.cta, function (v) { w.cta = v; });
    return card;
  }

  function buildingCard() {
    var b = content.building;
    var card = document.createElement("div");
    card.className = "card";
    sectionHead(card, "Working out the number");
    b.lines.forEach(function (line, i) {
      field(card, "Bubble " + (i + 1), line, function (v) { b.lines[i] = v; }, true);
    });
    field(card, "Resting burn", b.restLabel, function (v) { b.restLabel = v; });
    field(card, "With activity", b.activityLabel, function (v) { b.activityLabel = v; });
    field(card, "Pace adjustment", b.paceLabel, function (v) { b.paceLabel = v; });
    field(card, "Safety floor", b.floorLabel, function (v) { b.floorLabel = v; });
    field(card, "Floor card title — {floor} is the number", b.floorTitle, function (v) { b.floorTitle = v; });
    field(card, "Floor card body", b.floorBody, function (v) { b.floorBody = v; }, true);
    return card;
  }

  function summaryCard() {
    var s = content.summary;
    var card = document.createElement("div");
    card.className = "card";
    sectionHead(card, "Plan screen");
    s.lines.forEach(function (line, i) {
      field(card, "Bubble " + (i + 1), line, function (v) { s.lines[i] = v; }, true);
    });
    field(card, "Under the number", s.kcalLabel, function (v) { s.kcalLabel = v; });
    field(card, "Protein row", s.proteinLabel, function (v) { s.proteinLabel = v; });
    field(card, "Button label", s.cta, function (v) { s.cta = v; });
    field(card, "Projection — {weeks} {month} {target}", s.projection, function (v) { s.projection = v; });
    field(card, "Projection past two years", s.projectionFar, function (v) { s.projectionFar = v; });
    field(card, "Capped pace note — {share} is the percentage", s.capNote, function (v) { s.capNote = v; }, true);
    field(card, "Disclaimer", s.disclaimer, function (v) { s.disclaimer = v; }, true);
    return card;
  }

  // The four sections take turns beside a sub-nav; the save bar below them is for all four.
  var obSec = "welcome";
  var OB_SECS = [["welcome", "Welcome screen"], ["screens", "Screens"], ["building", "Working out the number"], ["summary", "Plan screen"]];

  function renderObNav() {
    var nav = $("ob-nav");
    nav.textContent = "";
    OB_SECS.forEach(function (sec) {
      var b = document.createElement("button");
      b.textContent = sec[1];
      if (sec[0] === "screens") {
        var n = document.createElement("small");
        n.textContent = content.screens.length + " questions";
        b.appendChild(n);
      }
      b.classList.toggle("on", sec[0] === obSec);
      if (sec[0] === obSec) b.setAttribute("aria-current", "true");
      b.addEventListener("click", function () { obSec = sec[0]; renderObNav(); });
      nav.appendChild(b);
    });
    Array.prototype.forEach.call(document.querySelectorAll("#body-onboarding [data-sec]"), function (el) {
      el.classList.toggle("hidden", el.getAttribute("data-sec") !== obSec);
    });
  }

  // What is on screen against what was last loaded or saved: the number of fields that differ.
  var saved = null;
  function diffCount(a, b) {
    if (a !== null && b !== null && typeof a === "object" && typeof b === "object") {
      var keys = {}, n = 0;
      Object.keys(a).concat(Object.keys(b)).forEach(function (k) { keys[k] = 1; });
      Object.keys(keys).forEach(function (k) { n += diffCount(a[k], b[k]); });
      return n;
    }
    return a === b ? 0 : 1;
  }
  function unsaved() {
    var n = saved ? diffCount(saved, content) : 0;
    var el = $("status");
    el.classList.toggle("warn", n > 0);
    el.textContent = n > 0 ? n + " unsaved change" + (n === 1 ? "" : "s") : "version " + content.version;
  }
  $("body-onboarding").addEventListener("input", unsaved);
  $("body-onboarding").addEventListener("change", unsaved);

  // fresh: the content was just loaded, saved or restored, so it is the new baseline. The cards
  // fill in missing parts of the document as they draw, so the baseline is taken after the draw.
  function render(fresh) {
    var host = $("screens");
    host.textContent = "";
    content.screens.forEach(function (s) { host.appendChild(screenCard(s)); });
    var one = function (id, build) {
      var host = $(id);
      host.textContent = "";
      host.appendChild(build());
    };
    one("welcome", welcomeCard);
    one("building", buildingCard);
    one("summary", summaryCard);
    renderObNav();
    if (fresh) saved = JSON.parse(JSON.stringify(content));
    unsaved();
  }

  function showErrors(list) {
    var box = $("errors");
    var ul = box.querySelector("ul");
    ul.textContent = "";
    if (!list || !list.length) { box.classList.add("hidden"); return; }
    list.forEach(function (e) {
      var li = document.createElement("li");
      li.textContent = e;
      ul.appendChild(li);
    });
    box.classList.remove("hidden");
    box.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // ── Funnel ─────────────────────────────────────────────────────────────────────────────────

  function pct(part, whole) {
    return whole ? Math.round((part / whole) * 100) + "%" : "—";
  }

  // Milliseconds as seconds, "—" for a leg nothing in the window carried.
  function secs(ms) { return ms == null ? "—" : (ms / 1000).toFixed(1) + " s"; }

  // What the provider priced — a floor while any analysis that day went unpriced (#484).
  function spend(d) {
    var usd = d.costUsd === null ? "—" : "$" + d.costUsd.toFixed(4);
    return d.unpriced ? usd + " · " + d.unpriced + " unpriced" : usd;
  }

  // A cell, right-aligned from column "from" on: numbers read down a column, words read across.
  function td(tr, text, i, from) {
    var c = document.createElement("td");
    c.textContent = String(text);
    if (i >= from) c.classList.add("r");
    tr.appendChild(c);
    return c;
  }

  // The empty state of a table: one row that says so, in the table's own width.
  function emptyRow(body, cols, text) {
    if (body.childElementCount) return;
    var tr = document.createElement("tr");
    var c = document.createElement("td");
    c.colSpan = cols;
    c.className = "empty";
    c.textContent = text;
    tr.appendChild(c);
    body.appendChild(tr);
  }

  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // "2026-10-10" as "Sat 10 Oct". The date is a calendar day, not an instant, so it is read in UTC.
  function dayLabel(s) {
    var p = String(s).split("-");
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    return isNaN(d.getTime()) ? String(s) : WEEKDAYS[d.getUTCDay()] + " " + d.getUTCDate() + " " + MONTHS[d.getUTCMonth()];
  }

  // An instant as "8 Oct 10:02", in the browser's own zone.
  function atLabel(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    var two = function (n) { return (n < 10 ? "0" : "") + n; };
    return d.getDate() + " " + MONTHS[d.getMonth()] + " " + two(d.getHours()) + ":" + two(d.getMinutes());
  }

  function sum(list, f) {
    var n = 0;
    list.forEach(function (x) { n += f(x); });
    return n;
  }

  function pct1(part, whole) {
    return whole ? (Math.round((part / whole) * 1000) / 10).toFixed(1) + "%" : "—";
  }

  // One KPI card: label, value (with an optional small suffix), and a line under it. tone is
  // "up", "dn" or "warn", or empty for the muted default.
  function kpi(host, label, value, suffix, sub, tone) {
    var card = document.createElement("div");
    card.appendChild(el("div", "k", label));
    var v = el("div", "v2", value);
    if (suffix) { v.appendChild(document.createTextNode(" ")); v.appendChild(el("small", null, suffix)); }
    card.appendChild(v);
    // sub is one line, or a list of them; tone colours the first.
    [].concat(sub || []).forEach(function (line, i) { card.appendChild(el("div", tone && !i ? "dl " + tone : "dl", line)); });
    host.appendChild(card);
  }

  // The Show-all control of a box: hidden when there is nothing more to show.
  function moreButton(btn, total, shown, all, noun) {
    btn.classList.toggle("hidden", total <= shown);
    btn.textContent = all ? "Show last " + shown + " " + noun : "Show all " + total + " " + noun;
  }

  // The window each reporting view reads over, picked in the header: 7, 30 or 90 days.
  var windows = { numbers: 7, pushes: 7, funnel: 7 };

  function drawWindow(id) {
    var seg = $("head-window");
    seg.classList.toggle("hidden", !(id in windows));
    seg.textContent = "";
    if (!(id in windows)) return;
    [7, 30, 90].forEach(function (n) {
      var b = el("button", n === windows[id] ? "on" : "", n + " days");
      b.addEventListener("click", function () {
        if (n === windows[id]) return;
        windows[id] = n;
        run(id);
        drawWindow(id);
      });
      seg.appendChild(b);
    });
  }

  var numData = null;       // the last /admin/api/metrics answer, oldest day first
  var numAgg = null;        // the same read over exactly the selected window: retention and latency
  var numAll = false;       // the table shows every day, not the last seven

  function renderNumbers() {
    var m = numData;
    var days = m.days.slice().reverse();   // newest first on screen; the server's order is a window's
    var today = days[0] || { analyses: 0 };
    var N = windows.numbers;
    var week = days.slice(0, N), before = days.slice(N, 2 * N);
    var kp = $("numbers-kpi");
    kp.textContent = "";
    if (m.dailyAnalysisCap) {
      kpi(kp, "Analyses today", String(today.analyses), "of " + m.dailyAnalysisCap, m.headroom + " left", today.analyses >= m.dailyAnalysisCap ? "dn" : "");
    } else {
      kpi(kp, "Analyses today", String(today.analyses), "", "no instance cap");
    }
    var signups = sum(week, function (d) { return d.signups; });
    var prior = sum(before, function (d) { return d.signups; });
    if (before.length === N && prior > 0) {
      var change = Math.round(((signups - prior) / prior) * 100);
      kpi(kp, "Signups · " + week.length + " days", String(signups), "", (change >= 0 ? "+" : "") + change + "% on the " + (N === 7 ? "week" : N + " days") + " before", change >= 0 ? "up" : "dn");
    } else {
      kpi(kp, "Signups · " + week.length + " days", String(signups), "", "");
    }
    // These three cover the selected window itself, which is why they come from their own read.
    var a = numAgg;
    kpi(kp, "Came back next day", pct(a.d1.returned, a.d1.eligible), "", [
      a.d1.returned + " of " + a.d1.eligible,
      "on day 7 " + a.d7.returned + " of " + a.d7.eligible + " (" + pct(a.d7.returned, a.d7.eligible) + ")"
    ]);
    kpi(kp, "Photo turn, p50", secs(a.latency.total.p50), "", [
      "p95 " + secs(a.latency.total.p95) + " · n=" + a.latency.n,
      secs(a.latency.queue.p50) + " to the call · " + secs(a.latency.firstItem.p50) + " to first item"
    ]);

    var all = days.slice(0, Math.max(N, 30));
    var shown = numAll ? all : days.slice(0, 7);
    $("numbers-title").textContent = "Last " + shown.length + " days";
    moreButton($("numbers-more"), all.length, 7, numAll, "days");
    var body = $("metrics").querySelector("tbody");
    body.textContent = "";
    shown.forEach(function (d) {
      var tr = document.createElement("tr");
      [dayLabel(d.date), String(d.signups), String(d.activations), String(d.analyses), spend(d)].forEach(function (t, i) {
        var c = td(tr, t, i, 1);
        // The one number that can hit a wall, marked when it is at it.
        if (i === 3 && m.dailyAnalysisCap && d.analyses >= m.dailyAnalysisCap) c.classList.add("drop");
      });
      body.appendChild(tr);
    });
    emptyRow(body, 5, "No days to show yet.");
    if (shown.length) {
      var priced = shown.filter(function (d) { return d.costUsd !== null; });
      var tot = document.createElement("tr");
      tot.className = "tot";
      [shown.length + " days",
        String(sum(shown, function (d) { return d.signups; })),
        String(sum(shown, function (d) { return d.activations; })),
        String(sum(shown, function (d) { return d.analyses; })),
        spend({ costUsd: priced.length ? sum(priced, function (d) { return d.costUsd; }) : null, unpriced: sum(shown, function (d) { return d.unpriced; }) })
      ].forEach(function (t, i) { td(tot, t, i, 1); });
      body.appendChild(tot);
    }
  }

  function loadMetrics() {
    var n = windows.numbers, wide = Math.max(30, 2 * n);
    return Promise.all([
      api("GET", "/admin/api/metrics?days=" + wide),
      n === wide ? null : api("GET", "/admin/api/metrics?days=" + n)
    ]).then(function (r) {
      var m = r[0];
      numAgg = r[1] || m;
      numData = m;
      renderNumbers();
    });
  }

  $("numbers-more").addEventListener("click", function () { numAll = !numAll; renderNumbers(); });

  var pushData = null;      // the last /admin/api/push/stats answer
  var pushAll = false;      // every day of the window, not the last seven

  // Today's calendar day in the zone the instance counts push days in.
  function dayInZone(tz) {
    try { return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date()); }
    catch (e) { return new Date().toISOString().slice(0, 10); }
  }

  function renderPushes() {
    var v = pushData;
    var today = Date.parse(dayInZone(v.timezone) + "T00:00:00Z");
    var cutOf = function (n) { return new Date(today - (n - 1) * 86400000).toISOString().slice(0, 10); };
    var cut = cutOf(windows.pushes);
    var rows = v.rows.slice().sort(function (a, b) { return a.day < b.day ? 1 : a.day > b.day ? -1 : 0; });
    var week = rows.filter(function (r) { return r.day >= cut; });
    var sent = sum(week, function (r) { return r.sent; });
    var delivered = sum(week, function (r) { return r.delivered; });
    var opened = sum(week, function (r) { return r.opened; });
    var dead = sum(week, function (r) { return r.dead; });
    var kp = $("pushes-kpi");
    kp.textContent = "";
    kpi(kp, "Sent · " + windows.pushes + " days", String(sent), "", "");
    kpi(kp, "Delivered", String(delivered), "", pct(delivered, sent));
    kpi(kp, "Opened", String(opened), "", pct1(opened, delivered) + " of delivered");
    kpi(kp, "Dead tokens", String(dead), "", dead ? "dropped when found dead" : "", dead ? "warn" : "");
    $("pushes-zone").textContent = v.timezone;
    moreButton($("pushes-more"), v.days, 7, pushAll, "days");
    var last7 = cutOf(7);
    var body = $("pushes").querySelector("tbody");
    body.textContent = "";
    (pushAll ? rows : rows.filter(function (r) { return r.day >= last7; })).forEach(function (r) {
      var tr = document.createElement("tr");
      [dayLabel(r.day), r.kind, r.templateKey, r.sent, r.accepted, r.dead, r.delivered, r.opened, r.converted].forEach(function (t, i) {
        td(tr, t, i, 3);
      });
      body.appendChild(tr);
    });
    emptyRow(body, 9, "Nothing has been sent in this window.");
  }

  function loadPushes() {
    return api("GET", "/admin/api/push/stats?days=" + Math.max(14, windows.pushes)).then(function (v) {
      pushData = v;
      renderPushes();
    });
  }

  $("pushes-more").addEventListener("click", function () { pushAll = !pushAll; renderPushes(); });

  // ── Campaigns (ieat-app#1761) ──────────────────────────────────────────────────────────────
  var campaignOptions = null;
  var campData = null;      // the last /admin/api/campaigns answer
  var campSel = null;       // id of the open campaign
  var campNote = null;      // { id, text }: the dry run or test send line of one campaign
  var campMode = "list";    // "list" or "new"
  var campTestUser = "";

  function campaignErrors(e) {
    var box = $("campaign-errors");
    var list = box.querySelector("ul");
    list.textContent = "";
    var msgs = e && e.body && e.body.errors ? e.body.errors : e && e.body && e.body.reason ? [e.body.reason] : e ? [e.message] : [];
    msgs.forEach(function (m) { var li = document.createElement("li"); li.textContent = m; list.appendChild(li); });
    box.classList.toggle("hidden", msgs.length === 0);
  }

  var SEG_LABEL = { langs: "lang", entitlement: "subscription", streakBand: "streak", sinceLog: "last log" };
  var SEG_FLAG = { onboarded: ["onboarded", "not onboarded"], tipsConsent: ["tips and offers on", "tips and offers off"], staffOnly: ["staff only", "not staff only"] };
  function segmentChips(c) {
    var out = [];
    Object.keys(c.segment).forEach(function (k) {
      var v = c.segment[k];
      if (SEG_FLAG[k]) out.push(SEG_FLAG[k][v ? 0 : 1]);
      else out.push((SEG_LABEL[k] || k) + ": " + (Array.isArray(v) ? v.join(", ") : String(v)));
    });
    if (!out.length) out.push("everyone");
    if (c.promotional) out.push("promotional");
    return out;
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function checks(name, values) {
    var wrap = el("div", "checks");
    wrap.dataset.name = name;
    values.forEach(function (v) {
      var l = el("label", "cchip");
      var box = document.createElement("input");
      box.type = "checkbox";
      box.value = v;
      l.appendChild(box);
      l.appendChild(document.createTextNode(v));
      wrap.appendChild(l);
    });
    return wrap;
  }

  function campaignField(labelText, control) {
    var wrap = el("div", "field");
    wrap.appendChild(el("label", null, labelText));
    wrap.appendChild(control);
    return wrap;
  }

  // any / yes / no, one of three, read from dataset.value ("" is any).
  function triState(name) {
    var seg = el("span", "aseg");
    seg.dataset.name = name;
    seg.dataset.value = "";
    [["", "any"], ["true", "yes"], ["false", "no"]].forEach(function (o) {
      var b = el("button", o[0] === "" ? "on" : "", o[1]);
      b.addEventListener("click", function () {
        seg.dataset.value = o[0];
        Array.prototype.forEach.call(seg.children, function (x) { x.classList.toggle("on", x === b); });
      });
      seg.appendChild(b);
    });
    return seg;
  }

  function buildCampaignForm(o) {
    var host = $("campaign-form");
    host.textContent = "";
    var name = document.createElement("input"); name.placeholder = "Name";
    var tpl = document.createElement("input"); tpl.placeholder = "campaign:spring-win-back"; tpl.setAttribute("list", "campaign-keys");
    var time = document.createElement("input"); time.type = "time"; time.value = "18:30";
    var pctIn = document.createElement("input"); pctIn.type = "number"; pctIn.min = "0"; pctIn.max = "100"; pctIn.value = "10";
    var variants = document.createElement("input"); variants.type = "number"; variants.min = "1"; variants.max = "4"; variants.value = "1";
    var holdout = document.createElement("input"); holdout.type = "number"; holdout.min = "0"; holdout.max = "10"; holdout.value = "0";
    var promo = el("button", "asw");
    promo.setAttribute("role", "switch"); promo.setAttribute("aria-label", "Promotional"); promo.setAttribute("aria-checked", "true"); promo.classList.add("on");
    promo.addEventListener("click", function () { var on = promo.getAttribute("aria-checked") !== "true"; promo.setAttribute("aria-checked", String(on)); promo.classList.toggle("on", on); });
    var langs = checks("langs", o.langs);
    var ent = checks("entitlement", o.entitlement);
    var streak = checks("streakBand", o.streakBands);
    var since = checks("sinceLog", o.sinceLog);
    var onboarded = triState("onboarded");
    var tips = triState("tipsConsent");
    var staff = triState("staffOnly");
    var grid = el("div", "cgrid");
    [campaignField("Name", name), campaignField("Copy key (written below)", tpl), campaignField("Local send time", time), campaignField("Rollout %", pctIn), campaignField("Variants (1-4)", variants), campaignField("Holdout % (0-10)", holdout)].forEach(function (f) { grid.appendChild(f); });
    host.appendChild(grid);
    host.appendChild(el("span", "grp", "Who gets it · none ticked = all"));
    host.appendChild(campaignField("Languages", langs));
    host.appendChild(campaignField("Subscription", ent));
    host.appendChild(campaignField("Streak", streak));
    host.appendChild(campaignField("Days since the last log", since));
    var flags = el("div", "flags");
    [campaignField("Onboarded", onboarded), campaignField("Tips and offers consent", tips), campaignField("Staff allowlist only", staff)].forEach(function (f) { flags.appendChild(f); });
    host.appendChild(flags);
    var pr = el("div", "promo");
    pr.appendChild(promo);
    pr.appendChild(el("span", null, "Promotional — only accounts with tips and offers on"));
    host.appendChild(pr);
    var foot = el("div", "cfoot");
    var cancel = el("button", null, "Cancel");
    cancel.addEventListener("click", function () { campaignErrors(null); campMode = "list"; renderCampaigns(); });
    var create = el("button", "primary", "Create draft");
    create.addEventListener("click", function () {
      var seg = {};
      [langs, ent, streak, since].forEach(function (g) {
        var on = Array.prototype.filter.call(g.querySelectorAll("input"), function (i) { return i.checked; }).map(function (i) { return i.value; });
        if (on.length) seg[g.dataset.name] = on;
      });
      [onboarded, tips, staff].forEach(function (sel) { if (sel.dataset.value !== "") seg[sel.dataset.name] = sel.dataset.value === "true"; });
      campaignErrors(null);
      api("POST", "/admin/api/campaigns", {
        name: name.value, templateKey: tpl.value, segment: seg, localSendTime: time.value,
        rolloutPct: Number(pctIn.value), promotional: promo.getAttribute("aria-checked") === "true",
        variants: Number(variants.value), holdoutPct: Number(holdout.value)
      }).then(function (r) {
        campMode = "list";
        if (r && r.row && r.row.id) campSel = r.row.id;
        return loadCampaigns();
      }).catch(campaignErrors);
    });
    foot.appendChild(cancel);
    foot.appendChild(create);
    host.appendChild(foot);
  }

  function campMenusClose() {
    Array.prototype.forEach.call(document.querySelectorAll("#camp-detail .amenu"), function (m) { m.classList.add("hidden"); });
  }
  document.addEventListener("click", function (e) { if (!e.target.closest || !e.target.closest(".mwrap")) campMenusClose(); });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    campMenusClose();
  });

  // One action on one campaign: clear the line, run it, read the list again. A refusal is shown
  // in the errors box and the list is read again anyway, so the screen never lies about the state.
  function campRun(run) {
    campaignErrors(null);
    campNote = null;
    return run().then(function () { return loadCampaigns(); }, function (e) { campaignErrors(e); return loadCampaigns(); }).catch(campaignErrors);
  }

  function campStatus(c, to) {
    return function () { return api("POST", "/admin/api/campaigns/" + c.id + "/status", { status: to }); };
  }

  var CHIP_TONE = { running: "g", scheduled: "", paused: "w", killed: "b", done: "n", draft: "n" };
  function statusChip(status) { return el("span", ("chip " + (CHIP_TONE[status] || "n")).trim(), status); }

  function renderList(v) {
    var host = $("camp-list");
    host.textContent = "";
    v.campaigns.forEach(function (c) {
      var b = el("button", c.id === campSel ? "citem on" : "citem");
      if (c.id === campSel) b.setAttribute("aria-current", "true");
      var t = el("span", "t");
      t.appendChild(el("b", null, c.name));
      t.appendChild(el("span", null, c.report.sent + " sent · rollout " + c.rolloutPct + "%"));
      var bar = el("div", "abar");
      var fill = document.createElement("i");
      fill.style.width = Math.max(0, Math.min(100, c.rolloutPct)) + "%";
      bar.appendChild(fill);
      b.appendChild(t);
      b.appendChild(bar);
      b.appendChild(statusChip(c.status));
      b.addEventListener("click", function () {
        campSel = c.id;
        campNote = null;
        campaignErrors(null);
        renderCampaigns();
      });
      host.appendChild(b);
    });
  }

  function armsTable(c) {
    var frame = el("div", "card flush");
    var wrap = el("div", "scrollx");
    var t = document.createElement("table");
    var head = document.createElement("tr");
    ["Arm", "Accounts", "Opened", "Converted", "Conversion"].forEach(function (x, i) { var th = el("th", i ? "r" : "", x); head.appendChild(th); });
    var thead = document.createElement("thead"); thead.appendChild(head); t.appendChild(thead);
    var tbody = document.createElement("tbody");
    c.report.groups.forEach(function (g) {
      var tr = document.createElement("tr");
      [g.group === "holdout" ? "holdout (not sent)" : g.group, g.users, g.group === "holdout" ? "—" : g.opened + " (" + pct(g.opened, g.users) + ")", g.converted, pct(g.converted, g.users)].forEach(function (x, i) { td(tr, x, i, 1); });
      tbody.appendChild(tr);
    });
    t.appendChild(tbody);
    wrap.appendChild(t);
    frame.appendChild(wrap);
    return frame;
  }

  function renderDetail(v) {
    var host = $("camp-detail");
    host.textContent = "";
    var c = v.campaigns.filter(function (x) { return x.id === campSel; })[0];
    if (!c) return;
    var ph = el("div", "ph");
    ph.appendChild(el("b", null, c.name));
    ph.appendChild(statusChip(c.status));
    ph.appendChild(el("span", "grow"));
    var next = c.status === "draft" ? ["Schedule", "scheduled"] : c.status === "paused" ? ["Resume", "scheduled"] : c.status === "scheduled" || c.status === "running" ? ["Pause", "paused"] : null;
    if (next) {
      var main = el("button", "primary", next[0]);
      main.addEventListener("click", function () { campRun(campStatus(c, next[1])); });
      ph.appendChild(main);
    }
    if (c.status !== "done" && c.status !== "killed") {
      var mw = el("div", "mwrap");
      var more = el("button", null, "⋯");
      more.setAttribute("aria-label", "More actions");
      more.setAttribute("aria-haspopup", "true");
      var menu = el("div", "amenu hidden");
      var item = function (label, cls, fn) {
        var b = el("button", cls, label);
        b.addEventListener("click", function () { menu.classList.add("hidden"); fn(); });
        menu.appendChild(b);
      };
      item("Raise rollout", "", function () {
        campRun(function () {
          var to = Number(prompt("New rollout % (now " + c.rolloutPct + ")", String(Math.min(100, c.rolloutPct + 10))));
          if (!(to >= 0 && to <= 100)) return Promise.resolve();
          return api("PATCH", "/admin/api/campaigns/" + c.id, { rolloutPct: Math.round(to) });
        });
      });
      item("Dry run", "", function () {
        campRun(function () {
          return api("POST", "/admin/api/campaigns/" + c.id + "/dry-run").then(function (r) {
            campNote = { id: c.id, text: "Dry run: would reach " + r.wouldSend + " account(s), hold out " + r.heldOut + ". Nothing was sent." };
          });
        });
      });
      item("Test send", "", function () {
        askConfirm("Test send " + c.name, "Sends this campaign's text to one staff account's devices. Nobody else gets it.", "Test send", function (who) {
          campTestUser = who.trim();
          campRun(function () {
            return api("POST", "/admin/api/campaigns/" + c.id + "/test", { userId: campTestUser })
              .then(function (r) { campNote = { id: c.id, text: "Test send: " + r.sent + " device(s)." }; });
          });
        }, { input: campTestUser, placeholder: "Staff account id" });
      });
      menu.appendChild(document.createElement("hr"));
      item("Done", "", function () {
        askConfirm("Mark " + c.name + " done?", "It stops sending for good.", "Done", function () { campRun(campStatus(c, "done")); });
      });
      item("Kill", "d", function () {
        askConfirm("Kill " + c.name + "?", "It stops now and cannot be resumed. Pause stops it and keeps Resume.", "Kill", function () { campRun(campStatus(c, "killed")); }, { danger: true });
      });
      more.addEventListener("click", function () {
        var open = menu.classList.contains("hidden");
        campMenusClose();
        menu.classList.toggle("hidden", !open);
      });
      mw.appendChild(more);
      mw.appendChild(menu);
      ph.appendChild(mw);
    }
    host.appendChild(ph);

    var pb = el("div", "pb");
    if (campNote && campNote.id === c.id) pb.appendChild(el("div", "aerr ok", campNote.text));
    var chips = el("div", "chips");
    segmentChips(c).forEach(function (t) { chips.appendChild(el("span", "chip n", t)); });
    pb.appendChild(chips);
    var meta = el("div", "cmeta");
    var send = el("span", null, "Send at ");
    send.appendChild(el("b", null, c.localSendTime + " local"));
    var roll = el("span", null, "Rollout ");
    roll.appendChild(el("b", null, c.rolloutPct + "%"));
    meta.appendChild(send);
    meta.appendChild(roll);
    meta.appendChild(el("span", null, c.variants + (c.variants === 1 ? " arm" : " arms") + (c.holdoutPct ? " · " + c.holdoutPct + "% held out" : "")));
    pb.appendChild(meta);
    if (c.report.groups.length) {
      pb.appendChild(armsTable(c));
      var e = c.effect;
      var p;
      if (!e) p = el("p", "cfine", "No treated-minus-holdout figure yet: it needs sent accounts and a holdout.");
      else {
        var pp = function (x) { return (x * 100).toFixed(1) + " pts"; };
        p = el("p", null, "Treated minus holdout conversion: " + pp(e.comparison.diff) + " (95% CI " + pp(e.comparison.lo) + " to " + pp(e.comparison.hi) + ") — " +
          (e.comparison.significant ? "the interval excludes zero." : "not distinguishable from zero."));
      }
      pb.appendChild(p);
    }
    var copy = v.copy.filter(function (k) { return k.key === c.templateKey; })[0];
    pb.appendChild(el("span", "cfine", "Copy: " + c.templateKey + " · " +
      (!copy ? "nothing written yet" : copy.gaps.length ? "missing or draft: " + copy.gaps.join(", ") : "complete in " + v.options.langs.length + " languages")));
    host.appendChild(pb);
  }

  // The header's right side belongs to the open view, so it is built once and shown for #campaigns.
  var headActs = el("div", "hacts hidden");
  var stopAll = el("button");
  var newCamp = el("button", "primary", "New");
  newCamp.appendChild(el("span", "wide", " campaign"));
  headActs.appendChild(stopAll);
  headActs.appendChild(newCamp);
  document.querySelector(".ahead").appendChild(headActs);
  function openNewCampaign() {
    campaignErrors(null);
    buildCampaignForm(campaignOptions);
    campMode = "new";
    renderCampaigns();
    window.scrollTo(0, 0);
  }
  newCamp.addEventListener("click", openNewCampaign);
  $("campaign-new").addEventListener("click", openNewCampaign);
  stopAll.addEventListener("click", function () {
    var killed = campData.killed;
    var go = function () {
      campaignErrors(null);
      api("POST", "/admin/api/campaigns/kill", { killed: !killed }).then(function () { return loadCampaigns(); }).catch(campaignErrors);
    };
    if (killed) go();
    else askConfirm("Stop every campaign now?", "Runs stop between two sends. Resume all campaigns starts them where they stopped.", "Stop all campaigns", go, { danger: true });
  });
  function syncHead() {
    var none = !campData || campData.campaigns.length === 0;
    headActs.classList.toggle("hidden", location.hash !== "#campaigns" || !campData || campMode !== "list");
    newCamp.classList.toggle("hidden", none);
  }
  window.addEventListener("hashchange", syncHead);

  function renderCampaigns() {
    var v = campData;
    var none = v.campaigns.length === 0;
    $("camp-list-mode").classList.toggle("hidden", campMode !== "list");
    $("camp-new-mode").classList.toggle("hidden", campMode !== "new");
    $("campaigns-state").classList.toggle("hidden", !v.killed);
    $("campaigns-empty").classList.toggle("hidden", !none);
    $("camps").classList.toggle("hidden", none);
    stopAll.textContent = v.killed ? "Resume all campaigns" : "Stop all campaigns";
    if (!v.campaigns.some(function (c) { return c.id === campSel; })) campSel = none ? null : v.campaigns[0].id;
    if (!none) { renderList(v); renderDetail(v); }
    syncHead();
  }

  function loadCampaigns() {
    return api("GET", "/admin/api/campaigns").then(function (v) {
      if (!campaignOptions) campaignOptions = v.options;
      campData = v;
      copyKeys(v.copy);
      renderCampaigns();
    });
  }


  function loadFunnel() {
    return api("GET", "/admin/api/funnel?days=" + windows.funnel).then(function (f) {
      var kp = $("funnel-kpi");
      kp.textContent = "";
      kpi(kp, "Runs started", String(f.sessions), "", "");
      kpi(kp, "Finished", String(f.completed), "", "");
      kpi(kp, "Completion", pct1(f.completed, f.sessions), "", "content v" + f.contentVersion);
      var body = $("funnel").querySelector("tbody");
      body.textContent = "";
      f.rows.forEach(function (r) {
        var tr = document.createElement("tr");
        var drop = r.views - r.answers;
        td(tr, r.place, 0, 99);
        // How far the run got: the people who answered this screen, of everyone who started.
        var cell = document.createElement("td");
        var bar = el("div", "abar wide");
        var fill = document.createElement("i");
        fill.style.width = (f.sessions ? Math.min(100, (r.answers / f.sessions) * 100) : 0).toFixed(1) + "%";
        bar.appendChild(fill);
        cell.appendChild(bar);
        tr.appendChild(cell);
        [String(r.views), String(r.answers), drop > 0 && r.views ? drop + " (" + pct1(drop, r.views) + ")" : r.views ? "0" : "—", String(r.backs), String(r.rejects), secs(r.medianMs)].forEach(function (text, i) {
          var c = td(tr, text, i, 0);
          if (i === 2 && drop > 0) c.classList.add("drop");
          if (i === 3 || i === 4) c.classList.add("x");
        });
        body.appendChild(tr);
      });
      emptyRow(body, 8, "No onboarding runs in this window.");
    });
  }

  $("funnel-more").addEventListener("click", function () {
    var slim = $("funnel").classList.toggle("slim");
    $("funnel-more").textContent = slim ? "Show all columns" : "Show fewer columns";
    $("funnel-hint").classList.toggle("hidden", !slim);
  });

  // ── Push templates ─────────────────────────────────────────────────────────────────────────
  //
  // A key x language x variant grid, one editor under it. Everything is the server's: it lists the
  // rows, says which keys are sendable, and the gate refuses on save, so this only draws.

  var push = null;
  var pushSel = null;

  function pushRow(key, lang, variant) {
    return push.rows.filter(function (r) {
      return r.key === key && r.lang === lang && r.variant === variant;
    })[0];
  }

  function pushErrors(list) {
    var box = $("push-errors");
    var ul = box.querySelector("ul");
    ul.textContent = "";
    if (!list || !list.length) { box.classList.add("hidden"); return; }
    list.forEach(function (e) {
      var li = document.createElement("li");
      li.textContent = e;
      ul.appendChild(li);
    });
    box.classList.remove("hidden");
  }

  // The grid shows what needs a look. A row (key x variant) needs one when the server lists a gap
  // for that variant: a language still a draft or not written at all. "All" is one press away.
  var pushAll = false;
  var pushMsg = "";
  var pushNote = null;

  function gapVariant(g) { return g.slice(g.indexOf("/") + 1); }
  function needsReview(k, variant) {
    return k.gaps.some(function (g) { return gapVariant(g) === variant; });
  }
  function pushCounts() {
    var need = 0, all = 0;
    push.keys.forEach(function (k) {
      k.variants.forEach(function (variant) { all++; if (needsReview(k, variant)) need++; });
    });
    return { need: need, all: all };
  }

  function pushCell(k, l, variant) {
    var td = document.createElement("td");
    var row = pushRow(k.key, l, variant);
    var status = row ? row.status : "missing";
    var b = document.createElement("button");
    b.className = "cell " + status;
    if (pushSel && pushSel.key === k.key && pushSel.lang === l && pushSel.variant === variant) b.className += " sel";
    b.textContent = status === "reviewed" ? "✓" : status;
    b.setAttribute("aria-label", k.key + " / " + variant + " / " + l + ": " + status);
    b.addEventListener("click", function () {
      pushSel = { key: k.key, lang: l, variant: variant };
      copyOpen = false;
      pushMsg = "";
      pushErrors(null);
      renderPush();
    });
    td.appendChild(b);
    return td;
  }

  function renderPush() {
    var counts = pushCounts();
    $("push-f-need").textContent = "Needs review · " + counts.need;
    $("push-f-all").textContent = "All · " + counts.all;
    $("push-f-need").classList.toggle("on", !pushAll);
    $("push-f-all").classList.toggle("on", pushAll);
    var grid = $("push-grid");
    grid.textContent = "";
    var table = document.createElement("table");
    var thead = document.createElement("thead");
    var head = document.createElement("tr");
    var corner = document.createElement("th");
    corner.textContent = "message";
    head.appendChild(corner);
    push.langs.forEach(function (l) {
      var th = document.createElement("th");
      th.textContent = l;
      head.appendChild(th);
    });
    thead.appendChild(head);
    table.appendChild(thead);
    var tbody = document.createElement("tbody");
    push.keys.forEach(function (k) {
      var first = true;
      k.variants.forEach(function (variant) {
        if (!pushAll && !needsReview(k, variant)) return;
        var tr = document.createElement("tr");
        var name = document.createElement("td");
        var label = document.createElement("b");
        label.textContent = k.key + " / " + variant;
        name.appendChild(label);
        if (first) {
          first = false;
          name.appendChild(document.createElement("br"));
          if (k.key === "trial-end") {
            var loc = document.createElement("span");
            loc.className = "chip n";
            loc.textContent = "local";
            name.appendChild(loc);
          }
          var pill = document.createElement("span");
          pill.className = k.gaps.length ? "chip w" : "chip g";
          pill.textContent = k.gaps.length ? "blocked: " + k.gaps.length + " missing" : "sendable";
          name.appendChild(pill);
        }
        tr.appendChild(name);
        push.langs.forEach(function (l) { tr.appendChild(pushCell(k, l, variant)); });
        tbody.appendChild(tr);
      });
    });
    emptyRow(tbody, push.langs.length + 1, "Nothing needs review. Every message is reviewed in every language.");
    table.appendChild(tbody);
    grid.appendChild(table);
    renderPushEdit();
  }

  $("push-f-need").addEventListener("click", function () { pushAll = false; if (push) renderPush(); });
  $("push-f-all").addEventListener("click", function () { pushAll = true; if (push) renderPush(); });

  // The campaign copy: one title and one body per language, for the keys campaigns name. Read from
  // the campaigns endpoint, which is where the server says which keys are in use and how complete.
  var copyData = null;
  var copyOpen = false;

  function copyKeys(list) {
    var keys = $("campaign-keys");
    keys.textContent = "";
    list.forEach(function (c) {
      var opt = document.createElement("option");
      opt.value = c.key;
      keys.appendChild(opt);
    });
  }

  function loadCopy() {
    var body = $("campaign-copy").querySelector("tbody");
    return api("GET", "/admin/api/campaigns").then(function (v) {
      copyData = v;
      copyKeys(v.copy);
      body.textContent = "";
      v.copy.forEach(function (c) {
        var tr = document.createElement("tr");
        [c.key, c.gaps.length ? c.gaps.join(", ") : "complete"].forEach(function (t, i) { td(tr, t, i, 99); });
        body.appendChild(tr);
      });
      emptyRow(body, 2, "No campaign has written any copy yet.");
      if (copyOpen) renderPushEdit();
    }, function () {
      copyData = null;
      body.textContent = "";
      emptyRow(body, 2, "Couldn't load the campaign copy.");
    });
  }

  function renderCopyForm(pane) {
    var head = document.createElement("div");
    head.className = "ph";
    var name = document.createElement("b");
    name.textContent = "New campaign copy";
    head.appendChild(name);
    pane.appendChild(head);
    var host = document.createElement("div");
    host.className = "pb";
    host.id = "campaign-copy-form";
    pane.appendChild(host);
    var rows = [];
    ((copyData && copyData.copy) || []).forEach(function (c) { rows = rows.concat(c.rows); });
    var variants = (copyData && copyData.options && copyData.options.variants) || ["default"];
    var key = document.createElement("input"); key.placeholder = "campaign:spring-win-back"; key.setAttribute("list", "campaign-keys");
    var lang = document.createElement("select");
    push.langs.forEach(function (l) { var opt = document.createElement("option"); opt.value = l; opt.textContent = l; lang.appendChild(opt); });
    var variant = document.createElement("select");
    variants.forEach(function (v) { var opt = document.createElement("option"); opt.value = v; opt.textContent = v; variant.appendChild(opt); });
    var title = document.createElement("input"); title.placeholder = "Title";
    var body = document.createElement("textarea"); body.placeholder = "Body";
    var row = document.createElement("div"); row.className = "row flexwrap";
    [campaignField("Key", key), campaignField("Language", lang), campaignField("Variant", variant), campaignField("Title", title)].forEach(function (f) { row.appendChild(f); });
    host.appendChild(row);
    host.appendChild(campaignField("Body", body));
    // Picking a key and language shows what is saved there.
    var fill = function () {
      var hit = rows.filter(function (r) { return r.key === key.value.trim() && r.lang === lang.value && r.variant === variant.value; })[0];
      title.value = hit ? hit.title : "";
      body.value = hit ? hit.body : "";
    };
    key.addEventListener("change", fill);
    lang.addEventListener("change", fill);
    variant.addEventListener("change", fill);
    var save = function (status) {
      return function () {
        pushErrors(null);
        pushSay("saving…");
        api("PUT", "/admin/api/push-templates", {
          template: { key: key.value.trim(), lang: lang.value, variant: variant.value, title: title.value, body: body.value },
          status: status
        }).then(function () {
          pushSay(status === "reviewed" ? "saved and reviewed" : "saved as draft");
          return loadPush().then(loadCopy);
        }).catch(function (e) {
          pushErrors((e.body && e.body.errors) || [e.message]);
          pushSay("not saved");
        });
      };
    };
    var btns = document.createElement("div");
    btns.className = "btns";
    var draft = document.createElement("button"); draft.textContent = "Save as draft"; draft.addEventListener("click", save("draft"));
    var rev = document.createElement("button"); rev.className = "primary"; rev.textContent = "Save as reviewed"; rev.addEventListener("click", save("reviewed"));
    btns.appendChild(draft);
    btns.appendChild(rev);
    host.appendChild(btns);
    var msg = document.createElement("span");
    msg.className = "pane-note";
    msg.textContent = pushMsg;
    pushNote = msg;
    host.appendChild(msg);
  }

  $("copy-new").addEventListener("click", function () {
    copyOpen = true;
    pushSel = null;
    pushMsg = "";
    pushErrors(null);
    if (push) renderPush();
    $("push-edit").scrollIntoView({ block: "nearest" });
  });

  function pushSave(draft, status) {
    pushSay("saving…");
    api("PUT", "/admin/api/push-templates", { template: draft, status: status }).then(function () {
      pushErrors(null);
      pushSay(status === "reviewed" ? "saved and reviewed" : "saved as draft");
      return loadPush();
    }).catch(function (e) {
      pushErrors((e.body && e.body.errors) || [e.message]);
      pushSay("not saved");
    });
  }

  function pushSay(text) {
    pushMsg = text;
    if (pushNote) pushNote.textContent = text;
  }

  function renderPushEdit() {
    var pane = $("push-edit");
    pane.textContent = "";
    pane.classList.toggle("hidden", !pushSel && !copyOpen);
    if (!pushSel) { if (copyOpen) renderCopyForm(pane); return; }
    var row = pushRow(pushSel.key, pushSel.lang, pushSel.variant);
    var draft = {
      key: pushSel.key, lang: pushSel.lang, variant: pushSel.variant,
      title: row ? row.title : "", body: row ? row.body : ""
    };
    var head = document.createElement("div");
    head.className = "ph";
    var name = document.createElement("b");
    name.textContent = draft.key + " / " + draft.variant + " / " + draft.lang;
    var who = document.createElement("span");
    who.className = "muted";
    who.textContent = row && row.reviewed_at ? "reviewed " + row.reviewed_at.slice(0, 10) : "not reviewed";
    head.appendChild(name);
    head.appendChild(who);
    pane.appendChild(head);
    var card = document.createElement("div");
    card.className = "pb";
    var at = draft.key + "." + (draft.variant === "empty" ? "emptyBody" : "body");
    // Only the default variant has a title: the others are sent under it.
    if (draft.variant === "default") {
      field(card, "Title" + holes2(draft.key + ".title"), draft.title, function (v) { draft.title = v; });
    }
    field(card, "Body" + holes2(at), draft.body, function (v) { draft.body = v; }, true);
    var p = document.createElement("div");
    p.className = "btns";
    var d = document.createElement("button");
    d.textContent = "Save as draft";
    d.addEventListener("click", function () { pushSave(draft, "draft"); });
    var r = document.createElement("button");
    r.className = "primary";
    r.textContent = "Save as reviewed";
    r.addEventListener("click", function () { pushSave(draft, "reviewed"); });
    p.appendChild(d);
    p.appendChild(r);
    card.appendChild(p);
    var msg = document.createElement("span");
    msg.className = "pane-note";
    msg.textContent = pushMsg;
    pushNote = msg;
    card.appendChild(msg);
    // What the reviewer is translating from, for every language but English itself.
    var en = draft.lang === "en" ? null : pushRow(draft.key, "en", draft.variant);
    if (en && en.body) {
      var ref = document.createElement("span");
      ref.className = "pane-note";
      ref.textContent = "English: \u201c" + en.body + "\u201d";
      card.appendChild(ref);
    }
    pane.appendChild(card);
  }

  function holes2(at) {
    var declared = (push.meta.placeholders || {})[at] || [];
    return declared.length ? "  ·  fills in: {" + declared.join("}  {") + "}" : "  ·  no braces here";
  }

  function loadPush() {
    return api("GET", "/admin/api/push-templates").then(function (res) {
      push = res;
      badge();
      renderPush();
    });
  }

  // ── System prompts ─────────────────────────────────────────────────────────────────────────
  //
  // The one editable surface here whose audience is a MODEL. Every other panel on this page is
  // read by a person, who notices a broken sentence; a broken prompt is every analysis after it,
  // and the only thing that shows is worse answers. So this one states provenance on every card,
  // never hides that a save outranks the deploy, and keeps History one click away.

  var prompts = [];

  function promptErrors(list) {
    var box = $("prompt-errors");
    var ul = box.querySelector("ul");
    ul.textContent = "";
    if (!list || !list.length) { box.classList.add("hidden"); return; }
    list.forEach(function (e) {
      var li = document.createElement("li");
      li.textContent = e;
      ul.appendChild(li);
    });
    box.classList.remove("hidden");
    box.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function promptStamp(p) {
    if (p.source === "admin") {
      return "yours — version " + p.version
        + (p.updated_at ? ", saved " + new Date(p.updated_at).toLocaleString() : "")
        + ". A deploy will not change it."
        // The one thing an owner of a prompt cannot otherwise see: the build moved on without them.
        + (p.text !== p.shipped && p.shipped !== undefined
            ? " The build has since shipped different text — Restore shipped takes it."
            : "");
    }
    if (p.version === 0) return "the build's text — the store could not be read, so this is what is being sent.";
    return "shipped — version " + p.version + ". A deploy keeps this current.";
  }

  function promptCard(p) {
    var card = document.createElement("div");
    card.className = "card pcard";

    var head = document.createElement("header");
    var name = document.createElement("span");
    name.className = "id";
    name.textContent = p.key;
    var stamp = document.createElement("span");
    stamp.className = "muted";
    stamp.textContent = promptStamp(p);
    var history = document.createElement("button");
    history.className = "small quiet";
    history.textContent = "History";
    head.appendChild(name);
    head.appendChild(stamp);
    head.appendChild(history);
    card.appendChild(head);

    var box = document.createElement("textarea");
    box.rows = 10;
    box.spellcheck = false;
    box.value = p.text;
    card.appendChild(box);

    var actions = document.createElement("div");
    actions.className = "pact";
    var status = document.createElement("span");
    status.className = "status";
    var restore = document.createElement("button");
    restore.textContent = "Restore shipped";
    var save = document.createElement("button");
    save.className = "primary";
    save.textContent = "Save " + p.key;
    actions.appendChild(status);
    actions.appendChild(restore);
    actions.appendChild(save);
    card.appendChild(actions);

    function say(text, bad) {
      status.textContent = text;
      status.classList.toggle("bad", !!bad);
    }

    function put(text, verb) {
      say("saving…");
      api("PUT", "/admin/api/prompts", { key: p.key, text: text }).then(function () {
        promptErrors(null);
        closeHistory();
        return loadPrompts();
      }).then(function () {
        say(verb);
      }).catch(function (e) {
        // A 409 is not a rejected prompt — the words were fine and somebody else simply got there
        // first. It belongs beside the button that has to be pressed again, not in the error box
        // at the top of a page the person has scrolled away from.
        var msgs = (e.body && e.body.errors) || [e.message];
        if (e.status === 409) { say(msgs[0], true); return; }
        promptErrors(msgs);
        say("not saved", true);
      });
    }

    save.addEventListener("click", function () {
      if (box.value === p.text) { say("no change"); return; }
      if (!confirm("Save " + p.key + "? Every analysis after this is asked the new text, and no later deploy will change it back.")) return;
      put(box.value, "saved");
    });

    restore.addEventListener("click", function () {
      if (!confirm("Put the build's own " + p.key + " prompt back? It is saved as a new version; nothing is lost.")) return;
      put(p.shipped, "restored");
    });

    history.addEventListener("click", function () {
      var pane = $("prompt-history");
      if (historyOf === p.key && !pane.classList.contains("hidden")) { closeHistory(); return; }
      say("loading…");
      api("GET", "/admin/api/prompts/" + encodeURIComponent(p.key) + "/revisions").then(function (res) {
        historyOf = p.key;
        pane.textContent = "";
        var ph = document.createElement("div");
        ph.className = "ph";
        var title = document.createElement("b");
        title.textContent = p.key + " · history";
        var sp = document.createElement("span");
        sp.className = "muted";
        sp.textContent = res.revisions.length + " version(s)";
        ph.appendChild(title);
        ph.appendChild(sp);
        pane.appendChild(ph);
        res.revisions.forEach(function (r) {
          var item = document.createElement("details");
          var sum = document.createElement("summary");
          var v = document.createElement("b");
          v.textContent = "version " + r.version;
          var sub = document.createElement("small");
          sub.textContent = (r.source === "admin" ? "yours" : r.source) + " · " + new Date(r.updated_at).toLocaleString();
          sum.appendChild(v);
          sum.appendChild(sub);
          var pre = document.createElement("pre");
          pre.textContent = r.text;
          item.appendChild(sum);
          item.appendChild(pre);
          pane.appendChild(item);
        });
        pane.classList.remove("hidden");
        pane.scrollIntoView({ block: "nearest" });
        say("");
      }).catch(function (e) { say("failed: " + e.message, true); });
    });

    return card;
  }

  // One history pane for the view, whichever prompt opened it.
  var historyOf = null;
  function closeHistory() {
    historyOf = null;
    var pane = $("prompt-history");
    pane.classList.add("hidden");
    pane.textContent = "";
  }

  function renderPrompts() {
    var host = $("prompts");
    host.textContent = "";
    prompts.forEach(function (p) { host.appendChild(promptCard(p)); });
  }

  function loadPrompts() {
    return api("GET", "/admin/api/prompts").then(function (res) {
      prompts = res.prompts;
      renderPrompts();
    });
  }

  // ── Food database switches (#563) ──────────────────────────────────────────────────────────

  var SWITCH_LABELS = { "grounding.photo": "Photo", "grounding.text": "Text" };
  var SWITCH_WHAT = { "grounding.photo": "ground photo analyses in the food catalog", "grounding.text": "ground typed meals in the food catalog" };

  function switchWhen(by, at) {
    return at ? "changed by " + by + " at " + atLabel(at) : "default";
  }

  function renderSwitches(res) {
    var host = $("switches");
    host.textContent = "";
    res.switches.forEach(function (sw) {
      var row = el("div", "srow");
      row.setAttribute("data-switch", sw.key);
      var t = el("span", "t");
      t.appendChild(el("b", null, SWITCH_LABELS[sw.key] || sw.key));
      t.appendChild(el("span", null, (SWITCH_WHAT[sw.key] || sw.key) + " · " + switchWhen(sw.setBy, sw.setAt)));
      var toggle = el("button", sw.enabled ? "asw on" : "asw");
      toggle.setAttribute("role", "switch");
      toggle.setAttribute("aria-checked", sw.enabled ? "true" : "false");
      toggle.setAttribute("aria-label", SWITCH_LABELS[sw.key] || sw.key);
      toggle.addEventListener("click", function () {
        toggle.disabled = true;
        $("switch-status").textContent = "saving…";
        api("PUT", "/admin/api/switches/" + encodeURIComponent(sw.key), { enabled: !sw.enabled }).then(loadSwitches, function (e) {
          toggle.disabled = false;
          $("switch-status").textContent = "failed: " + e.message;
        });
      });
      row.appendChild(t);
      row.appendChild(el("span", sw.enabled ? "chip g" : "chip n", sw.enabled ? "on" : "off"));
      row.appendChild(toggle);
      host.appendChild(row);
    });
    var recent = $("switch-recent");
    recent.textContent = "";
    res.recent.forEach(function (f) {
      recent.appendChild(el("span", null, (SWITCH_LABELS[f.key] || f.key) + " " + (f.enabled ? "on" : "off") + " — " + f.set_by + " at " + atLabel(f.set_at)));
    });
    if (!res.recent.length) recent.appendChild(el("span", "muted", "No flips yet."));
    $("switch-status").textContent = "";
  }

  function loadSwitches() {
    return api("GET", "/admin/api/switches").then(renderSwitches);
  }

  // ── Accounts (#374, #571) ──────────────────────────────────────────────────────────────────
  //
  // A READ, and the widest one in the product: every account, with the address on it. The server
  // checks the role on every request under /admin, so nothing here is a permission — it is a table.
  // A row opens the detail pane: profile (with the staff switch and the per-account sample),
  // thread, diary, and the push composer. Every value reaches the DOM through textContent: an
  // address somebody typed at a provider is still somebody's text.

  var usersCursor = null;
  var sel = null;            // the account whose pane is open
  var loadedTab = {};        // tab -> user id it was last loaded for
  var tab = "profile";
  var picked = new Map();    // ticked rows: user id -> pushOffers
  var langLabel = ${JSON.stringify(LANG_LABEL)};
  var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var provNames = { apple: "Apple", google: "Google" };

  function shortId(id) { return id.slice(0, 8); }
  function dmon(iso) { var d = iso.slice(0, 10).split("-"); return Number(d[2]) + " " + months[Number(d[1]) - 1]; }
  function via(u) { return (u.providers || []).map(function (p) { return provNames[p] || p; }).join(", ") || "—"; }

  function ago(iso) {
    if (!iso) return "never";
    var days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (days <= 0) return "today";
    if (days === 1) return "yesterday";
    return days + "d ago";
  }

  // The Paid chip and the Subscription line say the same thing, so one function says it.
  function paidOf(u) {
    if (u.entitled) {
      var trial = !!(u.entitlement && u.entitlement.trial);
      var ends = u.entitlement && u.entitlement.expiresAt && !u.entitlement.lifetimeProductId
        ? " · ends " + dmon(u.entitlement.expiresAt) : "";
      return { cls: trial ? "w" : "g", text: trial ? "trial" : "paid", long: (trial ? "trial" : "paid") + ends };
    }
    var t = u.onboardedAt ? "free" : "not onboarded";
    return { cls: "n", text: t, long: t };
  }

  function hasId(tr, id) { return tr.getAttribute("data-id") === id; }

  function markRows() {
    Array.prototype.forEach.call($("users").querySelectorAll("tbody tr"), function (tr) {
      tr.classList.toggle("on", !!sel && hasId(tr, sel.userId));
    });
  }

  // On a phone the list and the pane take turns, and the header says which one it is.
  var phone = window.matchMedia("(max-width: 760px)");
  function setHead() {
    var inPane = !!sel && phone.matches && !$("view-accounts").classList.contains("hidden");
    $("split").classList.toggle("open", !!sel);
    if (!$("view-accounts").classList.contains("hidden")) $("view-title").textContent = inPane ? "Account" : "Accounts";
    $("view-back").classList.toggle("hidden", !inPane);
  }
  phone.addEventListener("change", setHead);

  function closePane() {
    sel = null;
    releasePhotos();
    $("pane").classList.add("hidden");
    markRows();
    setHead();
  }
  $("pane-close").addEventListener("click", closePane);
  $("view-back").addEventListener("click", closePane);

  function selectUser(u) {
    sel = u;
    loadedTab = {};
    chatUser = null;
    diaryUser = null;
    releasePhotos();
    $("chat").textContent = "";
    $("diary").querySelector("tbody").textContent = "";
    $("diary-from").value = "";
    $("diary-to").value = "";
    $("composer-status").classList.add("hidden");
    $("composer-results").textContent = "";
    $("pane-name").textContent = u.email || shortId(u.userId);
    $("pane-id").textContent = u.userId;
    $("pane").classList.remove("hidden");
    markRows();
    showPicked();
    setHead();
    showTab("profile");
  }

  // ── The tabs ───────────────────────────────────────────────────────────────────────────────

  var TABS = {
    profile: function () { return loadProfile(); },
    thread: function () { return loadChat(false); },
    diary: function () { return loadDiary(true); },
    push: function () {}
  };

  function showTab(t) {
    tab = t;
    Array.prototype.forEach.call(document.querySelectorAll("#tabs [data-tab]"), function (b) {
      b.classList.toggle("on", b.getAttribute("data-tab") === t);
    });
    Object.keys(TABS).forEach(function (k) { $("tab-" + k).classList.toggle("hidden", k !== t); });
    if (sel && loadedTab[t] !== sel.userId) { loadedTab[t] = sel.userId; TABS[t](); }
  }
  Array.prototype.forEach.call(document.querySelectorAll("#tabs [data-tab]"), function (b) {
    b.addEventListener("click", function () { showTab(b.getAttribute("data-tab")); });
  });

  // ── Profile ────────────────────────────────────────────────────────────────────────────────

  function capPath(id) { return "/admin/api/users/" + encodeURIComponent(id) + "/cap"; }

  function showCap(c, prefix) {
    $("cap-n").value = c.freeAnalyses === null ? "" : String(c.freeAnalyses);
    $("cap-status").textContent = (prefix || "") + c.spent + " spent of " + c.effective
      + (c.freeAnalyses === null ? " (instance default)" : "");
  }

  function paintStaff(on) {
    $("staff-switch").classList.toggle("on", on);
    $("staff-switch").setAttribute("aria-checked", on ? "true" : "false");
  }

  function fillProfile(s, cap) {
    $("p-signup").textContent = dmon(s.createdAt) + " · " + via(s);
    var t = s.targets;
    $("p-plan").textContent = !t ? "not onboarded"
      : Math.round(t.kcal) + " kcal a day · " + (t.goal === "maintain" ? "maintain"
        : t.goal + " " + Math.abs(t.paceKgPerWeek) + " kg/week");
    $("p-lang").textContent = (langLabel[s.lang] || s.lang) + (s.timezone ? " · " + s.timezone : "");
    var paid = paidOf(s);
    var chip = $("p-sub");
    chip.className = "chip " + paid.cls;
    chip.textContent = paid.long;
    $("p-streak").textContent = s.streakDays + (s.streakDays === 1 ? " day" : " days");
    paintStaff(s.staff);
    $("staff-error").classList.add("hidden");
    showCap(cap);
    $("pushmax-n").value = sel.pushDailyMax === null || sel.pushDailyMax === undefined ? "" : String(sel.pushDailyMax);
  }

  function loadProfile() {
    var u = sel;
    paintBox($("pane-state"), $("pane-body"), "loading");
    var base = "/admin/api/users/" + encodeURIComponent(u.userId);
    return Promise.all([api("GET", base), api("GET", capPath(u.userId))]).then(function (r) {
      if (sel !== u) return;
      u.staff = r[0].staff;
      fillProfile(r[0], r[1]);
      paintBox($("pane-state"), $("pane-body"), "ready");
    }, function (e) {
      if (sel !== u) return;
      loadedTab.profile = null;
      paintBox($("pane-state"), $("pane-body"), "error", e, "this account", loadProfile, true);
    });
  }

  // A privilege change is asked about first, both ways: staff can open this page and change every
  // setting on it, and taking it away from the wrong account locks somebody out.
  var onConfirm = null;
  // opts.danger paints the button red; opts.input (a string, the first value) adds one text field
  // and hands what was typed to ok.
  function askConfirm(title, text, okLabel, ok, opts) {
    opts = opts || {};
    $("confirm-title").textContent = title;
    $("confirm-text").textContent = text;
    $("confirm-ok").textContent = okLabel;
    $("confirm-ok").className = opts.danger ? "dd" : "primary";
    var field = $("confirm-input");
    field.classList.toggle("hidden", typeof opts.input !== "string");
    field.value = opts.input || "";
    field.placeholder = opts.placeholder || "";
    onConfirm = ok;
    $("confirm").classList.remove("hidden");
    (typeof opts.input === "string" ? field : $("confirm-cancel")).focus();
  }
  function closeConfirm() { onConfirm = null; $("confirm").classList.add("hidden"); }
  $("confirm-cancel").addEventListener("click", closeConfirm);
  $("confirm-ok").addEventListener("click", function () { var go = onConfirm; var typed = $("confirm-input").value; closeConfirm(); if (go) go(typed); });
  $("confirm-input").addEventListener("keydown", function (e) { if (e.key === "Enter") $("confirm-ok").click(); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !$("confirm").classList.contains("hidden")) closeConfirm();
  });

  $("staff-switch").addEventListener("click", function () {
    var u = sel;
    var next = !u.staff;
    var who = u.email || shortId(u.userId);
    askConfirm(
      (next ? "Make " : "Remove staff from ") + who + (next ? " staff?" : "?"),
      next ? "Staff can open /admin, change every setting here and receive test pushes."
        : "They lose access to /admin and stop receiving test pushes.",
      next ? "Make staff" : "Remove staff",
      function () {
        api("PUT", "/admin/api/users/" + encodeURIComponent(u.userId) + "/staff", { staff: next }).then(function (r) {
          u.staff = r.staff;
          if (sel === u) { paintStaff(u.staff); $("staff-error").classList.add("hidden"); }
        }).catch(function (err) {
          if (sel !== u) return;
          $("staff-error").textContent = "Staff change failed: " + err.message;
          $("staff-error").classList.remove("hidden");
        });
      }
    );
  });

  function capFailed(e) {
    $("cap-status").textContent = (e.body && e.body.errors && e.body.errors[0]) || "failed: " + e.message;
  }
  $("cap-save").addEventListener("click", function () {
    var u = sel;
    var raw = $("cap-n").value.trim();
    api("PUT", capPath(u.userId), { freeAnalyses: raw === "" ? null : Number(raw) })
      .then(function (c) { if (sel === u) showCap(c, "saved — "); }).catch(function (e) { if (sel === u) capFailed(e); });
  });

  $("pushmax-save").addEventListener("click", function () {
    var u = sel;
    var raw = $("pushmax-n").value.trim();
    api("PUT", "/admin/api/users/" + encodeURIComponent(u.userId) + "/push-cap", { pushDailyMax: raw === "" ? null : Number(raw) })
      .then(function (r) { u.pushDailyMax = r.pushDailyMax; if (sel === u) $("pushmax-status").textContent = "saved — " + (r.pushDailyMax === null ? "no limit" : r.pushDailyMax + " a day"); })
      .catch(function (e) { if (sel === u) $("pushmax-status").textContent = "failed: " + e.message; });
  });

  // ── The push composer ──────────────────────────────────────────────────────────────────────

  function showPicked() {
    $("composer-count").textContent = picked.size + " account(s) ticked (at most ${ADMIN_PUSH_MAX_RECIPIENTS})";
  }
  ${JSON.stringify(PUSH_ROUTES)}.forEach(function (r) {
    var o = document.createElement("option"); o.value = r; o.textContent = r; $("composer-route").appendChild(o);
  });
  function say(text) { var p = $("composer-status"); p.textContent = text; p.classList.remove("hidden"); }

  $("composer-test").addEventListener("click", function () {
    var u = sel;
    var image = $("composer-image").value.trim();
    var base = "/admin/api/users/" + encodeURIComponent(u.userId);
    var body = { route: $("composer-route").value };
    if (image) body.imageUrl = image;
    say("Sending…");
    api("POST", base + "/push-test", body).then(function (r) {
      // The send log is where the push's state is kept; the newest row is this one.
      return api("GET", base + "/push-log").then(function (log) {
        var row = log.sends[0];
        return row ? " · send_log " + shortId(row.id) + " " + row.state : "";
      }, function () { return ""; }).then(function (tail) {
        say("Test push: sent to " + r.sent + (r.sent === 1 ? " device" : " devices") + tail);
      });
    }).catch(function (e) { say("Test push refused: " + ((e.body && e.body.reason) || e.message)); });
  });

  // The sendable campaign copy, for the composer. Fetched with the Accounts view, once; the
  // composer is a secondary control there, so a failure leaves its list empty and nothing else.
  function loadComposerTemplates() {
    return api("GET", "/admin/api/campaigns").then(function (c) {
      c.copy.filter(function (t) { return t.gaps.length === 0; }).forEach(function (t) {
        var o = document.createElement("option"); o.value = t.key; o.textContent = t.key; $("composer-template").appendChild(o);
      });
    }).catch(function () {});
  }

  $("composer-send").addEventListener("click", function () {
    var ids = Array.from(picked.keys());
    var noOffers = Array.from(picked.values()).filter(function (v) { return !v; }).length;
    var key = $("composer-template").value;
    if (!ids.length || !key) { say("Tick accounts in the list and pick a template."); return; }
    if (!window.confirm("Send " + key + " to " + ids.length + " account(s), opening " + $("composer-route").value
      + "?\\n" + noOffers + " of them have offers off and will be skipped (no offers consent).")) return;
    api("POST", "/admin/api/push/send", {
      userIds: ids, templateKey: key, route: $("composer-route").value,
      confirmCount: ids.length,
      imageUrl: $("composer-image").value.trim() || undefined
    }).then(function (r) {
      var sent = r.results.filter(function (x) { return x.sent !== undefined; }).length;
      say(sent + " sent, " + (r.results.length - sent) + " skipped");
      var list = $("composer-results"); list.textContent = "";
      r.results.forEach(function (x) {
        var li = document.createElement("li");
        li.textContent = shortId(x.userId) + ": " + (x.skipped ? x.skipped : "sent to " + x.sent + " device(s)");
        list.appendChild(li);
      });
    }).catch(function (e) { say("failed: " + ((e.body && e.body.errors) ? e.body.errors.join("; ") : e.message)); });
  });

  // ── The list ───────────────────────────────────────────────────────────────────────────────

  function userRow(u) {
    var tr = document.createElement("tr");
    tr.setAttribute("data-id", u.userId);
    if (sel && sel.userId === u.userId) tr.className = "on";
    var tick = document.createElement("td");
    var box = document.createElement("input");
    box.type = "checkbox";
    box.setAttribute("aria-label", "Include " + (u.email || shortId(u.userId)) + " in the push");
    box.checked = picked.has(u.userId);
    box.addEventListener("click", function (e) {
      e.stopPropagation();
      if (box.checked) picked.set(u.userId, u.pushOffers); else picked.delete(u.userId);
      showPicked();
    });
    tick.appendChild(box);
    tr.appendChild(tick);
    var paid = paidOf(u);
    var chip = document.createElement("span");
    chip.className = "chip " + paid.cls;
    chip.textContent = paid.text;
    var cells = [
      u.email || shortId(u.userId),
      dmon(u.createdAt),
      via(u),
      chip,
      // The number that is actually enforced: "effective" is what checkCaps refuses with, and the
      // panel must not compute a second answer.
      u.spent + " / " + u.effective,
      String(u.analysesToday),
      ago(u.lastSeen)
    ];
    cells.forEach(function (c, i) {
      var td = document.createElement("td");
      if (typeof c === "string") td.textContent = c; else td.appendChild(c);
      if (i >= 4) td.className = "r";
      if (i === 0) td.title = u.userId;
      tr.appendChild(td);
    });
    tr.addEventListener("click", function () { selectUser(u); });
    return tr;
  }

  function loadUsers(append) {
    var q = $("users-q").value.trim();
    var path = "/admin/api/users?limit=50";
    if (q) path += "&q=" + encodeURIComponent(q);
    if (append && usersCursor) path += "&cursor=" + encodeURIComponent(usersCursor);
    return api("GET", path).then(function (page) {
      var body = $("users").querySelector("tbody");
      if (!append) body.textContent = "";
      page.users.forEach(function (u) { body.appendChild(userRow(u)); });
      usersCursor = page.nextCursor;
      var n = body.childElementCount;
      $("users-more").classList.toggle("hidden", !page.nextCursor);
      $("users-wrap").classList.toggle("hidden", n === 0);
      $("users-empty").classList.toggle("hidden", n !== 0);
      $("users-foot").classList.toggle("hidden", n === 0);
      $("users-empty-title").textContent = q ? "Nothing matches that." : "No accounts yet.";
      $("users-empty-note").textContent = q ? "It takes a whole address, or the start of an id." : "";
      $("users-status").textContent = n + " shown · sample is out of " + page.defaultFreeAnalyses + " by default";
    });
  }

  // The first load is the view's, and its failure is the view's error state. A search or a page
  // after that fails beside the box that asked.
  function usersAgain(append) {
    if (!append) usersCursor = null;
    loadUsers(append).catch(function (e) {
      $("users-foot").classList.remove("hidden");
      $("users-status").textContent = "failed: " + e.message;
    });
  }
  $("users-search").addEventListener("click", function () { usersAgain(false); });
  $("users-q").addEventListener("keydown", function (e) {
    if (e.key === "Enter") usersAgain(false);
  });
  $("users-more").addEventListener("click", function () { usersAgain(true); });

  // ── One account's thread (#376) ────────────────────────────────────────────────────────────
  //
  // The same entries "GET /v1/messages" returns, so what is read here is what the person saw. Every
  // sentence goes through textContent like everything else on this page: the thread holds words the
  // model wrote and words somebody typed, and neither is markup.
  //
  // NO WRITE, and no control that could become one. The admin does not send a message as the coach.

  var chatUser = null;
  var chatBefore = null;

  function chatLine(e) {
    var row = document.createElement("div");
    row.className = "line " + (e.role === "user" ? "them" : "us");
    var who = document.createElement("span");
    who.className = "who";
    // "speaker" is the whole of who answered: null is the app's own voice — every line from
    // before the coach existed stays unlabelled rather than becoming his.
    who.textContent = e.role === "user" ? "them"
      : (e.kind === "meal" ? "card" : (e.speaker || "spud"));
    row.appendChild(who);
    var body = document.createElement("span");
    if (e.kind === "meal") {
      body.textContent = e.meal
        ? (e.event || "logged") + ": " + (e.meal.items || []).map(function (i) { return i.name; }).join(", ")
          + " — " + Math.round(e.meal.kcal) + "kcal"
        : (e.event || "logged") + ": (the meal is gone)";
    } else if (e.kind === "photo") {
      body.textContent = e.text || "(a photograph)";
    } else {
      body.textContent = e.text || "";
    }
    row.appendChild(body);
    var when = document.createElement("span");
    when.className = "when";
    when.textContent = e.ts.slice(0, 16).replace("T", " ");
    row.appendChild(when);
    // How the line was produced (#486): the router's intent on words it read, the model on words a
    // model wrote. Blank on a scripted line, and on every line from before either was kept.
    [e.intent, e.model].forEach(function (t) {
      if (!t) return;
      var how = document.createElement("span");
      how.className = "how";
      how.textContent = t;
      row.appendChild(how);
    });
    // What the turn cost (#525), on the line that opened it — and "analysis gone" when the row it
    // names does not exist any more, which is never a cost of zero.
    if (e.analysisId) {
      var cost = document.createElement("span");
      cost.className = "how";
      cost.textContent = e.cost ? spend({ costUsd: e.cost.usd, unpriced: e.cost.unpricedCalls }) : "analysis gone";
      row.appendChild(cost);
    }
    return row;
  }

  function loadChat(older) {
    var userId = sel && sel.userId;
    if (!userId) return Promise.resolve();
    if (!older) { chatUser = userId; chatBefore = null; paintBox($("thread-state"), $("thread-body"), "loading"); }
    var path = "/admin/api/users/" + chatUser + "/chat?limit=50";
    if (older && chatBefore) path += "&before=" + chatBefore;
    return api("GET", path).then(function (view) {
      if (!sel || sel.userId !== userId) return;
      var host = $("chat");
      if (!older) host.textContent = "";
      var frag = document.createDocumentFragment();
      view.entries.forEach(function (e) { frag.appendChild(chatLine(e)); });
      // An older page goes on TOP, because the thread reads oldest-first downwards.
      if (older) host.insertBefore(frag, host.firstChild); else host.appendChild(frag);
      chatBefore = view.before;
      $("chat-older").classList.toggle("hidden", !view.before);
      $("chat-status").textContent = host.childElementCount === 0
        ? "Nothing said yet."
        : host.childElementCount + " lines";
      paintBox($("thread-state"), $("thread-body"), "ready");
    }).catch(function (e) {
      if (!sel || sel.userId !== userId) return;
      if (older) { $("chat-status").textContent = "failed: " + e.message; return; }
      loadedTab.thread = null;
      paintBox($("thread-state"), $("thread-body"), "error", e, "the thread", function () { loadedTab.thread = userId; loadChat(false); }, true);
    });
  }

  $("chat-older").addEventListener("click", function () { loadChat(true); });
  // ── One account's diary, and the pictures behind a meal (#375) ─────────────────────────────
  //
  // READ-ONLY, and rendered rather than recomputed: the verdicts drawn here are the ones the row
  // carries, which are the ones the person saw. Computing our own would show a verdict that never
  // existed, on the one screen whose whole purpose is seeing what they saw.
  //
  // THE PHOTOGRAPHS ARE FETCHED, NEVER LINKED. An <img src> cannot carry the bearer, and the
  // alternative — a signed URL — is a second credential for the most sensitive bytes this product
  // holds, travelling in a query string. So the bytes come back through the same api() call
  // everything else uses and become a blob: URL that exists only in this tab.

  var diaryUser = null;
  var photoUrls = [];

  function releasePhotos() {
    photoUrls.forEach(function (u) { URL.revokeObjectURL(u); });
    photoUrls = [];
    $("photos").textContent = "";
  }

  function photoBytes(mealId, n) {
    return fetch("/admin/api/users/" + diaryUser + "/meals/" + mealId + "/photos/" + n, {
      headers: { authorization: "Bearer " + token }
    }).then(function (res) { return res.ok ? res.blob() : null; });
  }

  function showPhotos(meal) {
    releasePhotos();
    var count = meal.photos || 0;
    if (!count) { $("photos").textContent = ""; return; }
    var box = document.createElement("div");
    box.className = "card";
    var note = document.createElement("p");
    note.className = "muted";
    note.textContent = "What they photographed — " + count + (count === 1 ? " picture" : " pictures") + ".";
    box.appendChild(note);
    $("photos").appendChild(box);
    for (var n = 0; n < count; n++) {
      (function (position) {
        photoBytes(meal.id, position).then(function (blob) {
          if (!blob) return;
          var url = URL.createObjectURL(blob);
          photoUrls.push(url);
          var img = document.createElement("img");
          img.className = "shot";
          img.alt = "Photograph " + (position + 1) + " of a meal logged on " + meal.date;
          img.src = url;
          box.appendChild(img);
        });
      })(n);
    }
  }

  function mealRow(m) {
    var tr = document.createElement("tr");
    var names = (m.items || []).map(function (i) { return i.name; }).join(", ");
    var verdicts = Object.keys(m.verdicts || {}).map(function (k) {
      return k + ": " + m.verdicts[k];
    }).join(", ");
    // What the model said about the meal rides under its name, so the table keeps the board's four
    // columns and nothing that answers "the analysis was wrong" is dropped.
    var detail = [m.model, m.confidence, verdicts].filter(Boolean).join(" · ");
    var cells = [
      dmon(m.ts) + " " + m.ts.slice(11, 16),
      (names || (m.isFood ? "Meal" : "Not food")) + (m.corrected ? " (corrected)" : ""),
      m.isFood ? String(Math.round(m.kcal)) : "—",
      String(m.photos || 0)
    ];
    cells.forEach(function (text, i) {
      var td = document.createElement("td");
      td.textContent = text;
      if (i >= 2) td.className = "r";
      if (i === 1 && detail) {
        var sub = document.createElement("div");
        sub.className = "muted";
        sub.textContent = detail;
        td.appendChild(sub);
      }
      tr.appendChild(td);
    });
    tr.addEventListener("click", function () { showPhotos(m); });
    return tr;
  }

  function loadDiary(first) {
    var userId = sel && sel.userId;
    if (!userId) return Promise.resolve();
    diaryUser = userId;
    releasePhotos();
    var path = "/admin/api/users/" + diaryUser + "/meals";
    var from = $("diary-from").value.trim();
    var to = $("diary-to").value.trim();
    var query = [];
    if (from) query.push("from=" + encodeURIComponent(from));
    if (to) query.push("to=" + encodeURIComponent(to));
    if (query.length) path += "?" + query.join("&");
    if (first) paintBox($("diary-state"), $("diary-body"), "loading");
    return api("GET", path).then(function (view) {
      if (!sel || sel.userId !== userId) return;
      var body = $("diary").querySelector("tbody");
      body.textContent = "";
      view.meals.forEach(function (m) { body.appendChild(mealRow(m)); });
      $("diary-from").value = view.from;
      $("diary-to").value = view.to;
      // The plan the verdicts were judged by. Recomputed from the profile as it is NOW, which is
      // said out loud rather than left for somebody to assume it was stored per meal.
      var plan = view.targets
        ? " · plan today: " + Math.round(view.targets.kcal) + "kcal, "
          + Math.round(view.targets.protein_g) + "g protein"
        : " · not onboarded";
      $("diary-status").textContent = view.meals.length === 0
        ? "Nothing logged in that window." + plan
        : view.meals.length + " meals" + plan;
      paintBox($("diary-state"), $("diary-body"), "ready");
    }).catch(function (e) {
      if (!sel || sel.userId !== userId) return;
      if (!first) { $("diary-status").textContent = "failed: " + e.message; return; }
      loadedTab.diary = null;
      paintBox($("diary-state"), $("diary-body"), "error", e, "the diary", function () { loadedTab.diary = userId; loadDiary(true); }, true);
    });
  }

  $("diary-load").addEventListener("click", function () { loadDiary(false); });

  // ── Wiring ─────────────────────────────────────────────────────────────────────────────────

  // The onboarding copy, and nothing else: every other view loads its own data.
  function loadOnboarding(which) {
    asked = which || lang;
    return api("GET", atLang("/admin/api/content")).then(function (res) {
      content = res.content;
      meta = res.meta;
      // The server decides which language it served — an unknown code is answered with English
      // rather than an error, and the picker has to show what actually came back.
      // DEFENSIVE, because this page outlives the server it was built against — the same drift
      // usableContent exists for, one floor down. A server that predates the picker sends none of
      // these three, and calling forEach on an undefined list does not degrade the picker: it
      // throws inside the load, and the view shows an error for a select box.
      //
      // NO BACKTICKS ANYWHERE IN THIS FILE: it is one template literal, and one in a comment ends
      // it. The server then fails to start, which is how this comment learned its own rule.
      lang = res.lang || asked || "en";
      asked = lang;
      langs = res.langs || [];
      labels = res.labels || {};
      renderLangs();
      render(true);
    });
  }

  function renderLangs() {
    var select = $("lang");
    // Nothing to offer is not an error: an older server sends no language list, and one language
    // is not a choice. Either way the picker is hidden rather than drawn empty.
    select.hidden = langs.length < 2;
    if (langs.length === 0) return;
    if (select.options.length !== langs.length) {
      select.textContent = "";
      langs.forEach(function (code) {
        var option = document.createElement("option");
        option.value = code;
        // The endonym, which is the one label somebody looking for their own language can read.
        option.textContent = labels[code] || code;
        select.appendChild(option);
      });
    }
    select.value = lang;
  }

  $("lang").addEventListener("change", function () {
    // THE GLOBAL IS NOT TOUCHED UNTIL THE LOAD RESOLVES, and the controls are dead while it runs.
    //
    // A full reload rather than a swap of the content object, because the notification copy is per
    // language too and two half-loaded editors on one page is how an admin saves German into
    // Italian. But assigning "lang" first left exactly that window open the other way round:
    // "content" still held the previous language for six round trips, and Save reads both globals,
    // so a press in that window PUT the German document at ?lang=it. It passes every gate below —
    // the payload is a valid OnboardingContent — so it lands, versions, and serves German to every
    // Italian phone. Worse, a rejected load left "lang" moved and "content" stale for good.
    var next = $("lang").value;
    var was = lang;
    disable(true);
    status("loading " + (labels[next] || next) + "…");
    loadOnboarding(next).then(function () {
      status(labels[lang] || lang);
    }).catch(function (e) {
      // Put BOTH back where the data still is, or the page lies about what Save would write.
      asked = was;
      $("lang").value = was;
      status("failed: " + e.message);
    }).then(function () { disable(false); });
  });

  /** Everything that reads "lang" and "content" together, off while the two can disagree. */
  function disable(off) {
    var ids = ["lang", "save", "reset", "reload", "save-notify", "reset-notify"];
    for (var i = 0; i < ids.length; i++) {
      var el = $(ids[i]);
      if (el) el.disabled = off;
    }
  }

  // ── The shell ──────────────────────────────────────────────────────────────────────────────
  //
  // One view at a time, chosen by the hash. A view fetches its own data the first time it is
  // opened and says so in its own box: loading, or an error with a way to try again. Nothing on
  // this side of the session check can produce the gate or the denied card, so a 500 from one
  // endpoint is a message in one view and every other view still works.

  var VIEWS = {
    numbers: { title: "Numbers", load: loadMetrics, kpis: true },
    pushes: { title: "Pushes", load: loadPushes },
    funnel: { title: "Funnel", load: loadFunnel },
    campaigns: { title: "Campaigns", load: loadCampaigns },
    accounts: { title: "Accounts", load: function () { loadComposerTemplates(); usersCursor = null; return loadUsers(false); } },
    onboarding: { title: "Onboarding copy", load: function () { return loadOnboarding(); } },
    // The shell already read the templates to count what needs review, so the first open draws
    // from that answer instead of asking twice.
    templates: { title: "Push templates", load: function () { return (push ? Promise.resolve(renderPush()) : loadPush()).then(loadCopy); } },
    prompts: { title: "System prompts", load: loadPrompts },
    food: { title: "Food database", load: loadSwitches }
  };

  // view id -> "loading" | "ready". Absent: never opened, failed, or stale and due a read.
  var state = {};

  // kpis: the view opens on KPI cards (Numbers), so its skeleton draws them above the rows.
  function skeleton(kpis) {
    var wrap = document.createElement("div");
    wrap.className = "nv";
    if (kpis) {
      var cards = document.createElement("div");
      cards.className = "akpi";
      for (var k = 0; k < 4; k++) {
        var card = document.createElement("div");
        card.appendChild(document.createElement("i"));
        card.appendChild(document.createElement("i"));
        cards.appendChild(card);
      }
      wrap.appendChild(cards);
    }
    var box = document.createElement("div");
    box.className = "sk";
    for (var r = 0; r < 7; r++) {
      var row = document.createElement("div");
      row.className = "sk-row";
      for (var c = 0; c < 4; c++) row.appendChild(document.createElement("i"));
      box.appendChild(row);
    }
    wrap.appendChild(box);
    return wrap;
  }

  // One state box and the body it stands in for: loading, error with a way to try again, or the
  // body itself. The views and the account pane both draw theirs through this.
  function paintBox(box, body, kind, err, what, retry, inner, kpis) {
    box.textContent = "";
    body.classList.toggle("hidden", kind !== "ready");
    if (kind === "loading") box.appendChild(skeleton(kpis));
    if (kind !== "error") return;
    var bar = document.createElement("div");
    bar.className = "aerr";
    var msg = document.createElement("span");
    msg.textContent = "Couldn't load " + what + ". "
      + (err && err.status ? "The server answered " + err.status + "." : "The request did not get an answer.");
    var sp = document.createElement("span");
    sp.className = "sp";
    var again = document.createElement("button");
    again.textContent = "Try again";
    again.addEventListener("click", retry);
    bar.appendChild(msg);
    bar.appendChild(sp);
    bar.appendChild(again);
    box.appendChild(bar);
    var note = document.createElement("p");
    note.className = "muted";
    note.textContent = inner ? "Only this part failed. The rest of the account is unaffected." : "Only this view failed. The others load on their own.";
    box.appendChild(note);
  }

  function paint(id, kind, err) {
    paintBox($("state-" + id), $("body-" + id), kind, err, VIEWS[id].title.toLowerCase(), function () { run(id); }, false, VIEWS[id].kpis);
  }

  function run(id) {
    state[id] = "loading";
    paint(id, "loading");
    VIEWS[id].load().then(function () {
      state[id] = "ready";
      paint(id, "ready");
    }, function (e) {
      delete state[id];
      paint(id, "error", e);
    });
  }

  function badge() {
    var n = 0;
    if (push && push.keys) n = pushCounts().need;
    var el = $("templates-badge");
    el.textContent = String(n);
    el.classList.toggle("hidden", n === 0);
  }

  function show(id) {
    Object.keys(VIEWS).forEach(function (v) { $("view-" + v).classList.toggle("hidden", v !== id); });
    $("view-title").textContent = VIEWS[id].title;
    $("lang").classList.toggle("hidden", id !== "onboarding");
    $("copy-new").classList.toggle("hidden", id !== "templates");
    document.title = "eait admin — " + VIEWS[id].title;
    Array.prototype.forEach.call(document.querySelectorAll("[data-nav]"), function (a) {
      var on = a.getAttribute("data-nav") === id;
      a.classList.toggle("on", on);
      if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    $("switcher").value = id;
    drawWindow(id);
    setHead();
    window.scrollTo(0, 0);
    if (!state[id]) run(id);
  }

  function route() {
    var id = location.hash.replace("#", "");
    show(VIEWS[id] ? id : "numbers");
  }

  window.addEventListener("hashchange", function () { if (token) route(); });
  $("switcher").addEventListener("change", function () { location.hash = $("switcher").value; });

  // Trade the /start session cookie for a bearer, then ask the one question that decides whether
  // this account is let in: the push templates, which the shell needs anyway for its badge. The
  // role check is the server's — 404 is what an account without the role gets, the same answer an
  // instance with no admin gives — and it is the ONLY way to reach the denied card.
  function enter() {
    // A POST, because SameSite=Lax withholds the cookie from a cross-site POST and that is what
    // guards it; the token comes back in the body, never in a URL.
    // redirect: "manual", and it is the difference between two very different messages. With no
    // session the route answers 303 to /start; fetch FOLLOWS that by default, gets 200 HTML back,
    // and res.ok is true — so an opaque redirect is a signed-out browser.
    return fetch("/start/session/token", { method: "POST", redirect: "manual" }).then(function (res) {
      if (res.type === "opaqueredirect" || res.status === 0 || res.status === 303) throw new Error("signed-out");
      if (!res.ok) throw new Error("signed-out");
      return res.json();
    }).then(function (body) {
      token = body.token;
      return api("GET", "/admin/api/push-templates").then(function (res) { push = res; }, function (e) {
        if (e.status === 404) throw new Error("denied");
        if (e.status === 401) throw new Error("signed-out");
        // Anything else is that view's to report when it is opened; the shell still comes up.
      });
    }).then(function () {
      badge();
      $("gate").classList.add("hidden");
      $("denied").classList.add("hidden");
      $("app").classList.remove("hidden");
      route();
    }).catch(function (e) {
      token = "";
      if (e.message === "denied") {
        $("gate").classList.add("hidden");
        $("denied").classList.remove("hidden");
        return;
      }
      var msg = $("gate-error");
      msg.textContent = e.message === "signed-out" ? "" : "Could not reach the server. Reload to try again.";
      msg.classList.toggle("hidden", !msg.textContent);
    });
  }

  $("other-account").addEventListener("click", function () {
    fetch("/start/session/signout", { method: "POST", redirect: "manual" }).catch(function () {}).then(function () {
      location.assign("/start");
    });
  });

  // Try on load: somebody arriving here from /start is already signed in, and asking them to press
  // a button to discover that is a button with no question behind it.
  enter();

  $("save").addEventListener("click", function () {
    status("saving…");
    api("PUT", atLang("/admin/api/content"), { content: content }).then(function (res) {
      content = res.content;
      showErrors(null);
      render(true);
      status("saved — version " + content.version);
      // The funnel is grouped by content version, and this just made a new one: read it again
      // the next time that view is opened.
      delete state.funnel;
    }).catch(function (e) {
      showErrors((e.body && e.body.errors) || [e.message]);
      status("not saved");
    });
  });

  $("reset").addEventListener("click", function () {
    askConfirm(
      "Restore the " + (labels[lang] || lang) + " defaults?",
      "Every word on every onboarding screen goes back to the build's text. Saved changes are lost.",
      "Restore defaults",
      function () {
        api("POST", atLang("/admin/api/content/reset"), {}).then(function (res) {
          content = res.content;
          showErrors(null);
          render(true);
          status("restored — version " + content.version);
        }).catch(function (e) { status("failed: " + e.message); });
      },
      { danger: true }
    );
  });

  $("reload").addEventListener("click", function () {
    loadOnboarding().then(function () { status("reloaded — version " + content.version); })
      .catch(function (e) { status("failed: " + e.message); });
  });

})();
</script>
</body>
</html>
`;
