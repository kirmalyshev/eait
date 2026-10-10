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
import { ADMIN_PUSH_MAX_RECIPIENTS, PUSH_ROUTES } from "@eait/shared";
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
#campaigns { min-width: 760px; }
#campaigns th, #campaigns td { vertical-align: top; }
#campaigns td { white-space: normal; }
#campaigns td:first-child, #campaigns th:first-child { position: sticky; left: 0; background: var(--surface); min-width: 100px; max-width: 130px; white-space: normal; }
.acts { display: flex; flex-wrap: wrap; gap: 4px; justify-content: flex-end; min-width: 220px; max-width: 300px; margin-left: auto; }
#push-grid { scroll-padding-left: 120px; }
#push-grid table td, #push-grid table th { padding: 4px 6px; text-align: center; white-space: nowrap; }
#push-grid table td:first-child, #push-grid table th:first-child { text-align: left; }
#push-grid td:first-child, #push-grid th:first-child { position: sticky; left: 0; background: var(--surface); white-space: normal; min-width: 100px; max-width: 120px; }
.cell { height: 22px; padding: 0 8px; border-radius: 11px; font-size: 11px; font-weight: 600; box-shadow: 0 0 0 1px var(--hair); background: transparent; color: var(--muted); }
.cell.reviewed { background: var(--accent-tint); color: var(--accent); box-shadow: none; }
.cell.draft { background: var(--warn-tint); color: var(--warn); box-shadow: none; }
.cell.sel { outline: 2px solid var(--accent); }

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

/* The save bar belongs to the onboarding copy and sits at the foot of that view alone. */
.bar {
  position: sticky; bottom: 12px; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: flex-end;
  background: var(--surface); border-radius: var(--r-card); padding: 12px 14px; box-shadow: 0 0 0 1px var(--hair), var(--shadow);
}
.bar .status { margin-right: auto; }
.bar select { width: auto; }
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
    <div class="ahead"><h1 id="view-title">Numbers</h1></div>
    <div class="abody">

<!-- ONE VIEW AT A TIME. Each section is a state box (loading or error) and a body that is shown
     once the view's own data has arrived. A view loads the first time it is opened, and a failure
     stays inside it: the gate and the denied card come from the session check and nothing else. -->

<section class="view hidden" id="view-numbers">
  <div id="state-numbers"></div>
  <div class="vbody hidden" id="body-numbers">
    <p class="muted"><span class="chip n" id="metrics-window"></span> <span id="metrics-summary"></span></p>
    <div class="card flush"><div class="scrollx"><table id="metrics">
      <thead>
        <tr><th>Day</th><th class="r">Signups</th><th class="r">Activated</th><th class="r">Analyses</th><th class="r">Spend</th></tr>
      </thead>
      <tbody></tbody>
    </table></div></div>
    <p class="muted">
      <strong>Analyses, not money.</strong> Spend is what the provider billed; an unpriced call shows its count.
      Came back means <em>logged something</em> on that day, which is narrower than opening the app and is the
      only version of it this database can answer about a day in the past.
    </p>
  </div>
</section>

<section class="view hidden" id="view-pushes">
  <div id="state-pushes"></div>
  <div class="vbody hidden" id="body-pushes">
    <p class="muted"><span class="chip n" id="pushes-window"></span> <span id="pushes-summary"></span></p>
    <div class="card flush"><div class="scrollx"><table id="pushes">
      <thead>
        <tr><th>Day</th><th>Kind</th><th>Template</th><th class="r">Sent</th><th class="r">Accepted</th><th class="r">Dead</th><th class="r">Delivered</th><th class="r">Opened</th><th class="r">Converted</th></tr>
      </thead>
      <tbody></tbody>
    </table></div></div>
    <p class="muted">
      Per day the message went out, in the instance's zone. <strong>Opened</strong> is a send the phone
      reported opened; <strong>converted</strong> is a send followed by a meal from the same account
      within 24 hours, whether or not it was opened. Counts only: no account is named here.
    </p>
  </div>
</section>

<section class="view hidden" id="view-funnel">
  <div id="state-funnel"></div>
  <div class="vbody hidden" id="body-funnel">
    <p class="muted"><span class="chip n" id="funnel-window"></span> <span id="funnel-summary"></span></p>
    <div class="card flush"><div class="scrollx"><table id="funnel">
      <thead>
        <tr><th>Screen</th><th class="r">Views</th><th class="r">Answers</th><th class="r">Drop</th><th class="r">Back</th><th class="r">Refused</th><th class="r">Median</th></tr>
      </thead>
      <tbody></tbody>
    </table></div></div>
    <p class="muted">
      Drop is views minus answers on that screen: the people who saw the question and did not answer it.
      Median is how long an answer took. The runs are grouped by the content version they saw, which a
      save in Onboarding copy bumps.
    </p>
  </div>
</section>

<section class="view hidden" id="view-campaigns">
  <div id="state-campaigns"></div>
  <div class="vbody hidden" id="body-campaigns">
    <p class="muted"><span class="chip n" id="campaigns-state"></span> <span id="campaigns-summary"></span></p>
    <p class="muted">
      A campaign is one reviewed template sent once to each account in its segment, at the account's own
      local time, behind the one-message-a-day rule: an account that already had today's message is tried
      again tomorrow, never sent a second. A promotional campaign reaches only accounts with tips and
      offers on. The segment is a fixed list of choices; there is no free-form query.
    </p>
    <div class="row flexwrap" id="campaigns-tools">
      <button id="campaigns-kill" class="small danger"></button>
      <input id="campaigns-test-user" placeholder="Staff account id for test sends" autocomplete="off">
    </div>
    <p class="muted" id="campaign-note"></p>
    <div id="campaign-errors" class="errors hidden"><strong>Not done.</strong><ul></ul></div>
    <div id="campaigns-empty" class="card hidden">
      <div class="astate"><b>No campaigns yet.</b><span>A campaign starts as a draft; nothing sends until you schedule it.</span>
        <button class="primary" id="campaign-new">New campaign</button></div>
    </div>
    <div class="card flush"><div class="scrollx"><table id="campaigns">
      <thead>
        <tr><th>Name</th><th>Status</th><th>Segment</th><th>Send at</th><th>Rollout</th><th>Arms</th><th>Sent</th><th>Opened</th><th>Dry</th><th></th></tr>
      </thead>
      <tbody></tbody>
    </table></div></div>
    <div id="campaign-reports"></div>
    <p class="muted">
      Sent and opened count real sends only; a dry run (who it would reach, nothing sent), a test send and the
      holdout are counted apart. Raising the rollout only adds accounts. Killing a campaign stops it between two sends.
    </p>
    <h2>New campaign</h2>
    <div class="card" id="campaign-form"></div>
    <h2>Campaign copy</h2>
    <p class="muted">
      A campaign sends its own words, one title and one body per language, with no placeholders: everybody
      gets the same sentence. A key is campaign:, then lowercase words joined by hyphens. It can be
      scheduled only when all eight languages are reviewed, and a save is refused by the same claims and
      gender checks as every other push text.
    </p>
    <datalist id="campaign-keys"></datalist>
    <div class="card flush"><div class="scrollx"><table id="campaign-copy">
      <thead><tr><th>Key</th><th>Missing or draft</th></tr></thead>
      <tbody></tbody>
    </table></div></div>
    <div class="card" id="campaign-copy-form"></div>
  </div>
</section>

<section class="view hidden" id="view-accounts">
  <div id="state-accounts"></div>
  <div class="vbody hidden" id="body-accounts">
    <p class="muted">
      <strong>These are real people.</strong> Every row is somebody's account and the address they
      signed in with. Read it to answer a question somebody asked you, and close it afterwards.
      Search takes a whole email address or the beginning of a user id — nothing else matches.
    </p>
    <div class="card">
      <div class="row">
        <input type="text" id="users-q" placeholder="email address, or the start of a user id"
               autocomplete="off" spellcheck="false">
        <button id="users-search">Search</button>
      </div>
      <p class="muted" id="users-status"></p>
    </div>
    <div class="card" id="composer">
      <strong>Send a push</strong>
      <p class="muted" id="composer-count">Tick accounts below.</p>
      <div class="row">
        <select id="composer-template"></select>
        <select id="composer-route"></select>
        <button class="primary" id="composer-send">Send</button>
      </div>
      <div class="row">
        <select id="composer-test-route"></select>
        <button id="composer-test">Send test push to the one picked account</button>
      </div>
      <input type="text" id="composer-image" placeholder="optional image URL on this server's own host" autocomplete="off" spellcheck="false">
      <p class="muted" id="composer-status"></p>
      <ul id="composer-results"></ul>
    </div>
    <div class="card flush"><div class="scrollx"><table id="users">
      <thead>
        <tr><th>Push</th><th>Staff</th><th>Account</th><th>Signed up</th><th>Via</th><th>Paid</th><th>Sample</th><th>Today</th><th>Last seen</th></tr>
      </thead>
      <tbody></tbody>
    </table></div></div>
    <p>
      <button id="users-more" class="hidden">Load more</button>
    </p>

    <h2>Thread <span class="chip n" id="chat-who"></span></h2>
    <p class="muted">
      <strong>This is somebody's conversation, and onboarding collects medical free text.</strong>
      Read it to answer a question about a reply that was wrong, and nothing else. It is what they
      saw, rendered the way their app renders it. There is no way to write here, deliberately.
    </p>
    <div class="card">
      <div id="chat"></div>
      <p>
        <button id="chat-older" class="hidden">Older</button>
        <span class="status" id="chat-status">Choose an account above.</span>
      </p>
    </div>

    <h2>Diary <span class="chip n" id="diary-who"></span></h2>
    <p class="muted">
      <strong>This shows a real person's photographs and what they ate.</strong> It is here so that
      "the analysis was wrong" can be answered, and for nothing else. Choose an account above; a meal
      row opens the pictures behind it.
    </p>
    <div class="card">
      <div class="row">
        <input type="text" id="diary-from" placeholder="from (YYYY-MM-DD)" autocomplete="off" spellcheck="false">
        <input type="text" id="diary-to" placeholder="to (YYYY-MM-DD)" autocomplete="off" spellcheck="false">
        <button id="diary-load">Load</button>
      </div>
      <p class="muted" id="diary-status">Choose an account above.</p>
    </div>
    <div class="card flush"><div class="scrollx"><table id="diary">
      <thead>
        <tr><th>When</th><th>What</th><th>kcal</th><th>Verdicts</th><th>Model</th><th>Confidence</th><th>Photos</th></tr>
      </thead>
      <tbody></tbody>
    </table></div></div>
    <div id="photos"></div>

    <h2>Per-account sample</h2>
    <p class="muted">
      How many analyses ONE account gets before the paywall, instead of the instance default. Save with
      the box empty to put the account back on the default.
    </p>
    <div class="card">
      <div class="row">
        <input type="text" id="cap-user" placeholder="user id" autocomplete="off" spellcheck="false">
        <button id="cap-load">Load</button>
      </div>
      <label for="cap-n">Analyses before the paywall</label>
      <div class="row">
        <input type="text" id="cap-n" inputmode="numeric" placeholder="instance default">
        <button class="primary" id="cap-save">Save</button>
      </div>
      <p class="muted" id="cap-status"></p>
    </div>
  </div>
</section>

<section class="view hidden" id="view-onboarding">
  <div id="state-onboarding"></div>
  <div class="vbody hidden" id="body-onboarding">
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

    <div id="errors" class="errors hidden"><strong>Not saved.</strong><ul></ul></div>

    <h2>The welcome screen</h2>
    <p class="muted">
      The first thing anyone sees. The lines under the title are what we do NOT ask for — do not name a
      competitor there, do not write "free", and do not promise away the card, the trial or the
      cancelling: the app sells a subscription behind a free trial, so those are no longer true.
      Nor is "no email" — signing in asks Apple and Google for the address. What is still true is that
      the whole app works without an account at all.
    </p>
    <div id="welcome"></div>

    <h2>Screens</h2>
    <div id="screens"></div>

    <h2>Working out the number</h2>
    <p class="muted">
      Labels only. Every figure beside them is computed from the person's own answers and cannot be
      edited here.
    </p>
    <div id="building"></div>

    <h2>The plan screen</h2>
    <p class="muted">
      <code>{weeks}</code> and <code>{month}</code> are substituted into the projection line. It is
      hidden entirely for anyone the arithmetic cannot honestly project.
    </p>
    <div id="summary"></div>

    <div class="bar" id="bar">
      <span class="status" id="status"></span>
      <select id="lang" aria-label="Language"></select>
      <button id="reload">Reload</button>
      <button id="reset">Restore defaults</button>
      <button class="primary" id="save">Save</button>
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
    <div class="card flush"><div id="push-grid" class="scrollx"></div></div>
    <div id="push-edit"></div>
    <span class="status" id="push-status"></span>
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
    <div id="prompts"></div>
  </div>
</section>

<section class="view hidden" id="view-food">
  <div id="state-food"></div>
  <div class="vbody hidden" id="body-food">
    <p class="muted">
      When on, the items a model recognises are matched against the food catalog and take its numbers.
      Off, the analysis keeps the model's own. A switch takes effect on the next request with no
      deploy, and every flip is kept below.
    </p>
    <div id="switches"></div>
    <span class="status" id="switch-status"></span>
    <div id="switch-recent" class="muted"></div>
  </div>
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

  function status(msg) { $("status").textContent = msg; }

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

  function welcomeCard() {
    var w = content.welcome;
    var card = document.createElement("div");
    card.className = "card";
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

  function render() {
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
    status("version " + content.version);
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
  function secs(ms) { return ms === null ? "—" : (ms / 1000).toFixed(1) + "s"; }

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

  function loadMetrics() {
    return api("GET", "/admin/api/metrics?days=30").then(function (m) {
      $("metrics-window").textContent = "last " + m.days.length + " days";
      var today = m.days[m.days.length - 1] || { analyses: 0 };
      var budget = m.dailyAnalysisCap
        ? today.analyses + " of " + m.dailyAnalysisCap + " analyses today · " + m.headroom + " left"
        : today.analyses + " analyses today · no instance cap";
      $("metrics-summary").textContent = budget
        + " · came back next day " + m.d1.returned + "/" + m.d1.eligible + " (" + pct(m.d1.returned, m.d1.eligible) + ")"
        + " · on day 7 " + m.d7.returned + "/" + m.d7.eligible + " (" + pct(m.d7.returned, m.d7.eligible) + ")"
        + " · photo turn p50 " + secs(m.latency.queue.p50) + " to the call"
        + ", " + secs(m.latency.firstItem.p50) + " to first item"
        + ", " + secs(m.latency.total.p50) + " done (p95 " + secs(m.latency.total.p95) + ", n=" + m.latency.n + ")";
      var body = $("metrics").querySelector("tbody");
      body.textContent = "";
      // Newest first on screen; the server sends oldest first because that is the order a window is.
      m.days.slice().reverse().forEach(function (d) {
        var tr = document.createElement("tr");
        [d.date, String(d.signups), String(d.activations), String(d.analyses), spend(d)].forEach(function (t, i) {
          var c = td(tr, t, i, 1);
          // The one number that can hit a wall, marked when it is at it.
          if (i === 3 && m.dailyAnalysisCap && d.analyses >= m.dailyAnalysisCap) c.classList.add("drop");
        });
        body.appendChild(tr);
      });
      emptyRow(body, 5, "No days to show yet.");
    });
  }

  function loadPushes() {
    return api("GET", "/admin/api/push/stats?days=14").then(function (v) {
      $("pushes-window").textContent = "last " + v.days + " days · " + v.timezone;
      var sent = 0, opened = 0;
      v.rows.forEach(function (r) { sent += r.sent; opened += r.opened; });
      $("pushes-summary").textContent = sent + " sent · " + opened + " opened (" + pct(opened, sent) + ")";
      var body = $("pushes").querySelector("tbody");
      body.textContent = "";
      v.rows.forEach(function (r) {
        var tr = document.createElement("tr");
        [r.day, r.kind, r.templateKey, r.sent, r.accepted, r.dead, r.delivered, r.opened, r.converted].forEach(function (t, i) {
          td(tr, t, i, 3);
        });
        body.appendChild(tr);
      });
      emptyRow(body, 9, "Nothing has been sent in this window.");
    });
  }

  // ── Campaigns (ieat-app#1761) ──────────────────────────────────────────────────────────────
  var campaignOptions = null;

  function campaignErrors(e) {
    var box = $("campaign-errors");
    var list = box.querySelector("ul");
    list.textContent = "";
    var msgs = e && e.body && e.body.errors ? e.body.errors : e && e.body && e.body.reason ? [e.body.reason] : e ? [e.message] : [];
    msgs.forEach(function (m) { var li = document.createElement("li"); li.textContent = m; list.appendChild(li); });
    box.classList.toggle("hidden", msgs.length === 0);
  }

  function segmentText(seg) {
    var parts = [];
    Object.keys(seg).forEach(function (k) {
      var v = seg[k];
      parts.push(k + ": " + (Array.isArray(v) ? v.join("/") : String(v)));
    });
    return parts.length ? parts.join(" · ") : "everyone";
  }

  function campaignAction(label, run, confirmText, danger) {
    var b = document.createElement("button");
    b.className = danger ? "small danger" : "small";
    b.textContent = label;
    b.addEventListener("click", function () {
      if (confirmText && !confirm(confirmText)) return;
      campaignErrors(null);
      run().then(loadCampaigns).catch(function (e) { campaignErrors(e); loadCampaigns(); });
    });
    return b;
  }

  function checks(name, values) {
    var wrap = document.createElement("div");
    wrap.className = "checks";
    wrap.dataset.name = name;
    values.forEach(function (v) {
      var l = document.createElement("label");
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
    var wrap = document.createElement("div");
    var l = document.createElement("label");
    l.textContent = labelText;
    wrap.appendChild(l);
    wrap.appendChild(control);
    return wrap;
  }

  function triState(name) {
    var sel = document.createElement("select");
    sel.dataset.name = name;
    [["", "any"], ["true", "yes"], ["false", "no"]].forEach(function (o) {
      var opt = document.createElement("option");
      opt.value = o[0];
      opt.textContent = o[1];
      sel.appendChild(opt);
    });
    return sel;
  }

  function buildCampaignForm(o) {
    var host = $("campaign-form");
    host.textContent = "";
    var name = document.createElement("input"); name.placeholder = "Name";
    var tpl = document.createElement("input"); tpl.placeholder = "campaign:spring-win-back"; tpl.setAttribute("list", "campaign-keys");
    var time = document.createElement("input"); time.type = "time"; time.value = "18:30";
    var pctIn = document.createElement("input"); pctIn.type = "number"; pctIn.min = "0"; pctIn.max = "100"; pctIn.value = "10";
    var promo = document.createElement("input"); promo.type = "checkbox"; promo.checked = true; promo.style.width = "auto";
    var variants = document.createElement("input"); variants.type = "number"; variants.min = "1"; variants.max = "4"; variants.value = "1";
    var holdout = document.createElement("input"); holdout.type = "number"; holdout.min = "0"; holdout.max = "10"; holdout.value = "0";
    var langs = checks("langs", o.langs);
    var ent = checks("entitlement", o.entitlement);
    var streak = checks("streakBand", o.streakBands);
    var since = checks("sinceLog", o.sinceLog);
    var onboarded = triState("onboarded");
    var tips = triState("tipsConsent");
    var staff = triState("staffOnly");
    var row1 = document.createElement("div"); row1.className = "row flexwrap";
    [campaignField("Name", name), campaignField("Copy key (written below)", tpl), campaignField("Local send time", time), campaignField("Rollout %", pctIn), campaignField("Variants (1-4)", variants), campaignField("Holdout % (0-10)", holdout)].forEach(function (f) { row1.appendChild(f); });
    host.appendChild(row1);
    host.appendChild(campaignField("Promotional — only accounts with tips and offers on", promo));
    host.appendChild(campaignField("Languages (none ticked = all)", langs));
    host.appendChild(campaignField("Subscription (none ticked = all)", ent));
    host.appendChild(campaignField("Streak (none ticked = all)", streak));
    host.appendChild(campaignField("Days since the last log (none ticked = all)", since));
    var row2 = document.createElement("div"); row2.className = "row flexwrap";
    [campaignField("Onboarded", onboarded), campaignField("Tips and offers consent", tips), campaignField("Staff allowlist only", staff)].forEach(function (f) { row2.appendChild(f); });
    host.appendChild(row2);
    var create = document.createElement("button");
    create.className = "primary";
    create.textContent = "Create draft";
    create.addEventListener("click", function () {
      var seg = {};
      [langs, ent, streak, since].forEach(function (g) {
        var on = Array.prototype.filter.call(g.querySelectorAll("input"), function (i) { return i.checked; }).map(function (i) { return i.value; });
        if (on.length) seg[g.dataset.name] = on;
      });
      [onboarded, tips, staff].forEach(function (sel) { if (sel.value !== "") seg[sel.dataset.name] = sel.value === "true"; });
      campaignErrors(null);
      api("POST", "/admin/api/campaigns", {
        name: name.value, templateKey: tpl.value, segment: seg, localSendTime: time.value,
        rolloutPct: Number(pctIn.value), promotional: promo.checked,
        variants: Number(variants.value), holdoutPct: Number(holdout.value)
      }).then(function () { name.value = ""; return loadCampaigns(); }).catch(campaignErrors);
    });
    host.appendChild(create);
  }


  function buildCopyForm(o) {
    var host = $("campaign-copy-form");
    host.textContent = "";
    var key = document.createElement("input"); key.placeholder = "campaign:spring-win-back"; key.setAttribute("list", "campaign-keys");
    var lang = document.createElement("select");
    o.langs.forEach(function (l) { var opt = document.createElement("option"); opt.value = l; opt.textContent = l; lang.appendChild(opt); });
    var variant = document.createElement("select");
    o.variants.forEach(function (v) { var opt = document.createElement("option"); opt.value = v; opt.textContent = v; variant.appendChild(opt); });
    var title = document.createElement("input"); title.placeholder = "Title";
    var body = document.createElement("textarea"); body.placeholder = "Body";
    var row = document.createElement("div"); row.className = "row flexwrap";
    [campaignField("Key", key), campaignField("Language", lang), campaignField("Variant", variant), campaignField("Title", title)].forEach(function (f) { row.appendChild(f); });
    host.appendChild(row);
    host.appendChild(campaignField("Body", body));
    // Picking a key and language shows what is saved there.
    var fill = function () {
      var hit = (copyRows || []).filter(function (r) { return r.key === key.value.trim() && r.lang === lang.value && r.variant === variant.value; })[0];
      title.value = hit ? hit.title : "";
      body.value = hit ? hit.body : "";
    };
    key.addEventListener("change", fill);
    lang.addEventListener("change", fill);
    variant.addEventListener("change", fill);
    var save = function (status) {
      return function () {
        campaignErrors(null);
        api("PUT", "/admin/api/push-templates", {
          template: { key: key.value.trim(), lang: lang.value, variant: variant.value, title: title.value, body: body.value },
          status: status
        }).then(function () { return loadCampaigns(); }).catch(campaignErrors);
      };
    };
    var draft = document.createElement("button"); draft.textContent = "Save as draft"; draft.addEventListener("click", save("draft"));
    var rev = document.createElement("button"); rev.className = "primary"; rev.textContent = "Save as reviewed"; rev.addEventListener("click", save("reviewed"));
    host.appendChild(draft);
    host.appendChild(rev);
  }

  var copyRows = [];

  function renderReports(campaigns) {
    var host = $("campaign-reports");
    host.textContent = "";
    campaigns.forEach(function (c) {
      if (!c.report.groups.length) return;
      var h = document.createElement("h3"); h.textContent = c.name + " — by arm"; host.appendChild(h);
      var frame = document.createElement("div"); frame.className = "card flush";
      var wrap = document.createElement("div"); wrap.className = "scrollx";
      var t = document.createElement("table");
      var head = document.createElement("tr");
      ["Arm", "Accounts", "Opened", "Converted", "Conversion"].forEach(function (x, i) { var th = document.createElement("th"); th.textContent = x; if (i) th.className = "r"; head.appendChild(th); });
      t.appendChild(head);
      c.report.groups.forEach(function (g) {
        var tr = document.createElement("tr");
        [g.group === "holdout" ? "holdout (not sent)" : g.group, g.users, g.group === "holdout" ? "—" : g.opened + " (" + pct(g.opened, g.users) + ")", g.converted, pct(g.converted, g.users)].forEach(function (x, i) { td(tr, x, i, 1); });
        t.appendChild(tr);
      });
      wrap.appendChild(t); frame.appendChild(wrap); host.appendChild(frame);
      var p = document.createElement("p"); p.className = "muted";
      var e = c.effect;
      if (!e) p.textContent = "No treated-minus-holdout figure yet: it needs sent accounts and a holdout.";
      else {
        var pp = function (x) { return (x * 100).toFixed(1) + " pts"; };
        p.textContent = "Treated minus holdout conversion: " + pp(e.comparison.diff) + " (95% CI " + pp(e.comparison.lo) + " to " + pp(e.comparison.hi) + ") — " +
          (e.comparison.significant ? "the interval excludes zero." : "not distinguishable from zero.");
      }
      host.appendChild(p);
    });
  }

  var STATUS_TONE = { running: "g", scheduled: "w", paused: "w", killed: "b", done: "n", draft: "n" };

  function loadCampaigns() {
    return api("GET", "/admin/api/campaigns").then(function (v) {
      if (!campaignOptions) { campaignOptions = v.options; buildCampaignForm(v.options); buildCopyForm(v.options); }
      copyRows = [];
      var keys = $("campaign-keys"); keys.textContent = "";
      var copyBody = $("campaign-copy").querySelector("tbody"); copyBody.textContent = "";
      v.copy.forEach(function (c) {
        copyRows = copyRows.concat(c.rows);
        var opt = document.createElement("option"); opt.value = c.key; keys.appendChild(opt);
        var tr = document.createElement("tr");
        [c.key, c.gaps.length ? c.gaps.join(", ") : "complete"].forEach(function (t, i) { td(tr, t, i, 99); });
        copyBody.appendChild(tr);
      });
      $("campaigns-state").textContent = v.killed ? "ALL CAMPAIGNS STOPPED" : "running normally";
      $("campaigns-state").className = v.killed ? "chip b" : "chip g";
      $("campaigns-summary").textContent =
        v.campaigns.length + " campaign(s) · " + v.options.staffCount + " staff account(s) on the env bootstrap list";
      var kill = $("campaigns-kill");
      kill.textContent = v.killed ? "Resume all campaigns" : "Stop all campaigns";
      kill.onclick = function () {
        if (!v.killed && !confirm("Stop every campaign now? Runs stop between two sends.")) return;
        campaignErrors(null);
        api("POST", "/admin/api/campaigns/kill", { killed: !v.killed }).then(loadCampaigns).catch(campaignErrors);
      };
      renderReports(v.campaigns);
      var body = $("campaigns").querySelector("tbody");
      body.textContent = "";
      v.campaigns.forEach(function (c) {
        var tr = document.createElement("tr");
        [c.name, c.status, segmentText(c.segment) + (c.promotional ? " · promotional" : ""), c.localSendTime,
         c.rolloutPct + "%", c.variants + (c.holdoutPct ? " · " + c.holdoutPct + "% held out" : ""), c.report.sent, c.report.opened + " (" + pct(c.report.opened, c.report.sent) + ")", c.report.dry
        ].forEach(function (t) {
          var cellTd = td(tr, t, 0, 99);
          // The status is the one cell that is a verdict, so it wears the chip.
          if (cellTd === tr.children[1]) {
            cellTd.textContent = "";
            var chip = document.createElement("span");
            chip.className = "chip " + (STATUS_TONE[c.status] || "n");
            chip.textContent = c.status;
            cellTd.appendChild(chip);
          }
        });
        var cell = document.createElement("td");
        var act = document.createElement("div");
        act.className = "acts";
        cell.appendChild(act);
        var set = function (to) { return function () { return api("POST", "/admin/api/campaigns/" + c.id + "/status", { status: to }); }; };
        if (c.status === "draft" || c.status === "paused") act.appendChild(campaignAction(c.status === "draft" ? "Schedule" : "Resume", set("scheduled")));
        if (c.status === "scheduled" || c.status === "running") act.appendChild(campaignAction("Pause", set("paused")));
        if (c.status !== "done" && c.status !== "killed") {
          act.appendChild(campaignAction("Raise rollout", function () {
            var next = Number(prompt("New rollout % (now " + c.rolloutPct + ")", String(Math.min(100, c.rolloutPct + 10))));
            if (!(next >= 0 && next <= 100)) return Promise.resolve();
            return api("PATCH", "/admin/api/campaigns/" + c.id, { rolloutPct: Math.round(next) });
          }));
          act.appendChild(campaignAction("Dry run", function () {
            return api("POST", "/admin/api/campaigns/" + c.id + "/dry-run").then(function (r) { $("campaign-note").textContent = "Dry run: would reach " + r.wouldSend + " account(s), hold out " + r.heldOut + ". Nothing was sent."; });
          }));
          act.appendChild(campaignAction("Test send", function () {
            return api("POST", "/admin/api/campaigns/" + c.id + "/test", { userId: $("campaigns-test-user").value.trim() })
              .then(function (r) { $("campaign-note").textContent = "Test send: " + r.sent + " device(s)."; });
          }));
          act.appendChild(campaignAction("Done", set("done"), "Mark " + c.name + " done? It stops sending for good."));
          act.appendChild(campaignAction("Kill", set("killed"), "Kill " + c.name + "? It stops now and cannot be resumed.", true));
        }
        tr.appendChild(cell);
        body.appendChild(tr);
      });
      // Nothing yet is a state with a way forward, not an empty table.
      $("campaigns-empty").classList.toggle("hidden", v.campaigns.length > 0);
      $("campaigns").parentNode.parentNode.classList.toggle("hidden", v.campaigns.length === 0);
    });
  }

  function loadFunnel() {
    return api("GET", "/admin/api/funnel?days=30").then(function (f) {
      $("funnel-window").textContent = "last " + f.days + " days · content v" + f.contentVersion;
      var rate = f.sessions ? Math.round((f.completed / f.sessions) * 100) : 0;
      $("funnel-summary").textContent =
        f.sessions + " runs started · " + f.completed + " finished · " + rate + "% completion";
      var body = $("funnel").querySelector("tbody");
      body.textContent = "";
      f.rows.forEach(function (r) {
        var tr = document.createElement("tr");
        var drop = r.views - r.answers;
        var cells = [
          r.place,
          String(r.views),
          String(r.answers),
          r.views ? drop + " (" + Math.round((drop / r.views) * 100) + "%)" : "—",
          String(r.backs),
          String(r.rejects),
          r.medianMs == null ? "—" : (r.medianMs / 1000).toFixed(1) + "s"
        ];
        cells.forEach(function (text, i) {
          var c = td(tr, text, i, 1);
          if (i === 3 && drop > 0) c.classList.add("drop");
        });
        body.appendChild(tr);
      });
      emptyRow(body, 7, "No onboarding runs in this window.");
    });
  }

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

  function renderPush() {
    var grid = $("push-grid");
    grid.textContent = "";
    var table = document.createElement("table");
    var head = document.createElement("tr");
    var corner = document.createElement("th");
    corner.textContent = "message";
    head.appendChild(corner);
    push.langs.forEach(function (l) {
      var th = document.createElement("th");
      th.textContent = l;
      head.appendChild(th);
    });
    table.appendChild(head);
    push.keys.forEach(function (k) {
      k.variants.forEach(function (variant, i) {
        var tr = document.createElement("tr");
        var name = document.createElement("td");
        name.textContent = k.key + " / " + variant;
        if (i === 0) {
          var pill = document.createElement("span");
          pill.className = k.gaps.length ? "chip w" : "chip g";
          pill.textContent = k.gaps.length ? "blocked: " + k.gaps.length + " missing" : "sendable";
          if (k.key === "trial-end") {
            var loc = document.createElement("span");
            loc.className = "chip n";
            loc.textContent = "local";
            name.appendChild(document.createTextNode(" "));
            name.appendChild(loc);
          }
          name.appendChild(document.createTextNode(" "));
          name.appendChild(pill);
        }
        tr.appendChild(name);
        push.langs.forEach(function (l) {
          var td = document.createElement("td");
          var row = pushRow(k.key, l, variant);
          var b = document.createElement("button");
          b.className = "cell " + (row ? row.status : "draft");
          if (pushSel && pushSel.key === k.key && pushSel.lang === l && pushSel.variant === variant) b.className += " sel";
          b.textContent = row ? row.status : "missing";
          b.addEventListener("click", function () {
            pushSel = { key: k.key, lang: l, variant: variant };
            pushErrors(null);
            renderPush();
          });
          td.appendChild(b);
          tr.appendChild(td);
        });
        table.appendChild(tr);
      });
    });
    grid.appendChild(table);
    renderPushEdit();
  }

  function pushSave(draft, status) {
    $("push-status").textContent = "saving…";
    api("PUT", "/admin/api/push-templates", { template: draft, status: status }).then(function () {
      pushErrors(null);
      $("push-status").textContent = status === "reviewed" ? "saved and reviewed" : "saved as draft";
      return loadPush();
    }).catch(function (e) {
      pushErrors((e.body && e.body.errors) || [e.message]);
      $("push-status").textContent = "not saved";
    });
  }

  function renderPushEdit() {
    var host = $("push-edit");
    host.textContent = "";
    if (!pushSel) return;
    var row = pushRow(pushSel.key, pushSel.lang, pushSel.variant);
    var draft = {
      key: pushSel.key, lang: pushSel.lang, variant: pushSel.variant,
      title: row ? row.title : "", body: row ? row.body : ""
    };
    var card = document.createElement("div");
    card.className = "card";
    var head = document.createElement("header");
    var name = document.createElement("span");
    name.className = "id";
    name.textContent = draft.key + " / " + draft.variant + " / " + draft.lang;
    head.appendChild(name);
    var who = document.createElement("span");
    who.className = "muted";
    who.textContent = row && row.reviewed_at ? "reviewed " + row.reviewed_at.slice(0, 10) : "not reviewed";
    head.appendChild(who);
    card.appendChild(head);
    var at = draft.key + "." + (draft.variant === "empty" ? "emptyBody" : "body");
    // Only the default variant has a title: the others are sent under it.
    if (draft.variant === "default") {
      field(card, "Title" + holes2(draft.key + ".title"), draft.title, function (v) { draft.title = v; });
    }
    field(card, "Body" + holes2(at), draft.body, function (v) { draft.body = v; }, true);
    var p = document.createElement("p");
    var d = document.createElement("button");
    d.textContent = "Save as draft";
    d.addEventListener("click", function () { pushSave(draft, "draft"); });
    var r = document.createElement("button");
    r.className = "primary";
    r.textContent = "Save and mark reviewed";
    r.addEventListener("click", function () { pushSave(draft, "reviewed"); });
    p.appendChild(d);
    p.appendChild(document.createTextNode(" "));
    p.appendChild(r);
    card.appendChild(p);
    host.appendChild(card);
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
    card.className = "card";

    var head = document.createElement("div");
    head.className = "row";
    var name = document.createElement("strong");
    name.textContent = p.key;
    var stamp = document.createElement("span");
    stamp.className = "muted";
    stamp.textContent = promptStamp(p);
    head.appendChild(name);
    head.appendChild(stamp);
    card.appendChild(head);

    var box = document.createElement("textarea");
    box.rows = 14;
    box.spellcheck = false;
    box.value = p.text;
    box.style.width = "100%";
    box.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, monospace";
    card.appendChild(box);

    var actions = document.createElement("p");
    var save = document.createElement("button");
    save.className = "primary";
    save.textContent = "Save " + p.key;
    var restore = document.createElement("button");
    restore.textContent = "Restore shipped";
    var history = document.createElement("button");
    history.textContent = "History";
    var status = document.createElement("span");
    status.className = "status";
    actions.appendChild(save);
    actions.appendChild(restore);
    actions.appendChild(history);
    actions.appendChild(status);
    card.appendChild(actions);

    var log = document.createElement("div");
    log.className = "hidden";
    card.appendChild(log);

    function put(text, verb) {
      status.textContent = "saving…";
      api("PUT", "/admin/api/prompts", { key: p.key, text: text }).then(function () {
        promptErrors(null);
        return loadPrompts();
      }).then(function () {
        status.textContent = verb;
      }).catch(function (e) {
        // A 409 is not a rejected prompt — the words were fine and somebody else simply got there
        // first. It belongs beside the button that has to be pressed again, not in the error box
        // at the top of a page the person has scrolled away from.
        var msgs = (e.body && e.body.errors) || [e.message];
        if (e.status === 409) { status.textContent = msgs[0]; return; }
        promptErrors(msgs);
        status.textContent = "not saved";
      });
    }

    save.addEventListener("click", function () {
      if (box.value === p.text) { status.textContent = "no change"; return; }
      if (!confirm("Save " + p.key + "? Every analysis after this is asked the new text, and no later deploy will change it back.")) return;
      put(box.value, "saved");
    });

    restore.addEventListener("click", function () {
      if (!confirm("Put the build's own " + p.key + " prompt back? It is saved as a new version; nothing is lost.")) return;
      put(p.shipped, "restored");
    });

    history.addEventListener("click", function () {
      if (!log.classList.contains("hidden")) { log.classList.add("hidden"); return; }
      status.textContent = "loading…";
      api("GET", "/admin/api/prompts/" + encodeURIComponent(p.key) + "/revisions").then(function (res) {
        log.textContent = "";
        res.revisions.forEach(function (r) {
          var item = document.createElement("details");
          var sum = document.createElement("summary");
          sum.textContent = "version " + r.version + " — " + r.source
            + " — " + new Date(r.updated_at).toLocaleString();
          var pre = document.createElement("pre");
          pre.textContent = r.text;
          pre.style.whiteSpace = "pre-wrap";
          item.appendChild(sum);
          item.appendChild(pre);
          log.appendChild(item);
        });
        log.classList.remove("hidden");
        status.textContent = res.revisions.length + " version(s)";
      }).catch(function (e) { status.textContent = "failed: " + e.message; });
    });

    return card;
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

  function switchWhen(by, at) {
    return at ? "changed by " + by + " at " + at : "default";
  }

  function renderSwitches(res) {
    var host = $("switches");
    host.textContent = "";
    res.switches.forEach(function (sw) {
      var card = document.createElement("div");
      card.className = "card";
      card.setAttribute("data-switch", sw.key);
      var head = document.createElement("div");
      head.style.cssText = "display:flex;flex-wrap:wrap;align-items:center;gap:10px";
      var name = document.createElement("strong");
      name.style.minWidth = "60px";
      name.textContent = SWITCH_LABELS[sw.key] || sw.key;
      var state = document.createElement("span");
      state.className = sw.enabled ? "chip g" : "chip n";
      state.textContent = sw.enabled ? "on" : "off";
      var when = document.createElement("span");
      when.className = "muted";
      when.style.flex = "1 1 160px";
      when.textContent = switchWhen(sw.setBy, sw.setAt);
      var toggle = document.createElement("button");
      toggle.textContent = sw.enabled ? "Turn off" : "Turn on";
      toggle.addEventListener("click", function () {
        $("switch-status").textContent = "saving…";
        api("PUT", "/admin/api/switches/" + encodeURIComponent(sw.key), { enabled: !sw.enabled }).then(loadSwitches, function (e) {
          $("switch-status").textContent = "failed: " + e.message;
        });
      });
      head.appendChild(name);
      head.appendChild(state);
      head.appendChild(when);
      head.appendChild(toggle);
      card.appendChild(head);
      host.appendChild(card);
    });
    var recent = $("switch-recent");
    recent.textContent = "";
    res.recent.forEach(function (f) {
      var line = document.createElement("div");
      line.textContent = (SWITCH_LABELS[f.key] || f.key) + " " + (f.enabled ? "on" : "off") + " — " + f.set_by + " at " + f.set_at;
      recent.appendChild(line);
    });
    $("switch-status").textContent = "";
  }

  function loadSwitches() {
    return api("GET", "/admin/api/switches").then(renderSwitches);
  }

  // ── Per-account sample ─────────────────────────────────────────────────────────────────────

  function capPath() {
    return "/admin/api/users/" + encodeURIComponent($("cap-user").value.trim()) + "/cap";
  }
  function capFailed(e) {
    $("cap-status").textContent = (e.body && e.body.errors && e.body.errors[0])
      || (e.status === 404 ? "No such account." : "failed: " + e.message);
  }
  function showCap(c, prefix) {
    $("cap-n").value = c.freeAnalyses === null ? "" : String(c.freeAnalyses);
    $("cap-status").textContent = (prefix || "") + c.spent + " spent of " + c.effective
      + (c.freeAnalyses === null ? " (instance default)" : "");
  }
  $("cap-load").addEventListener("click", function () {
    api("GET", capPath()).then(function (c) { showCap(c); }).catch(capFailed);
  });
  $("cap-save").addEventListener("click", function () {
    var raw = $("cap-n").value.trim();
    api("PUT", capPath(), { freeAnalyses: raw === "" ? null : Number(raw) })
      .then(function (c) { showCap(c, "saved — "); }).catch(capFailed);
  });

  // ── Accounts (#374) ────────────────────────────────────────────────────────────────────────
  //
  // A READ, and the widest one in the product: every account, with the address on it. The server
  // checks the role on every request under /admin, so nothing here is a permission — it is a table.
  //
  // Every value reaches the DOM through textContent, like everything else on this page. An address
  // somebody typed at a provider is still somebody's text.

  var usersCursor = null;

  function shortId(id) { return id.slice(0, 8); }

  function ago(iso) {
    if (!iso) return "never";
    var days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (days <= 0) return "today";
    if (days === 1) return "yesterday";
    return days + "d ago";
  }

  var picked = new Map();
  function showPicked() {
    $("composer-count").textContent = picked.size + " account(s) picked (at most ${ADMIN_PUSH_MAX_RECIPIENTS})";
  }
  var none = document.createElement("option"); none.value = ""; none.textContent = "no target"; $("composer-test-route").appendChild(none);
  ${JSON.stringify(PUSH_ROUTES)}.forEach(function (r) {
    ["composer-route", "composer-test-route"].forEach(function (id) {
      var o = document.createElement("option"); o.value = r; o.textContent = "opens " + r; $(id).appendChild(o);
    });
  });
  $("composer-test").addEventListener("click", function () {
    if (picked.size !== 1) { $("composer-status").textContent = "Pick exactly one account for a test push."; return; }
    var route = $("composer-test-route").value;
    api("POST", "/admin/api/users/" + encodeURIComponent(Array.from(picked.keys())[0]) + "/push-test", route ? { route: route } : {})
      .then(function (r) { $("composer-status").textContent = "Test push: " + r.sent + " device(s)."; })
      .catch(function (e) { $("composer-status").textContent = "Test push refused: " + ((e.body && e.body.reason) || e.message); });
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
    if (!ids.length || !key) { $("composer-status").textContent = "Pick accounts and a template."; return; }
    if (!window.confirm("Send " + key + " to " + ids.length + " account(s), opening " + $("composer-route").value
      + "?\\n" + noOffers + " of them have offers off and will be skipped (no offers consent).")) return;
    api("POST", "/admin/api/push/send", {
      userIds: ids, templateKey: key, route: $("composer-route").value,
      confirmCount: ids.length,
      imageUrl: $("composer-image").value.trim() || undefined
    }).then(function (r) {
      var sent = r.results.filter(function (x) { return x.sent !== undefined; }).length;
      $("composer-status").textContent = sent + " sent, " + skipped.length + " skipped";
      var list = $("composer-results"); list.textContent = "";
      r.results.forEach(function (x) {
        var li = document.createElement("li");
        li.textContent = shortId(x.userId) + ": " + (x.skipped ? x.skipped + (x.heldBy ? " (held by " + x.heldBy + ")" : "") : "sent to " + x.sent + " device(s)");
        list.appendChild(li);
      });
    }).catch(function (e) { $("composer-status").textContent = "failed: " + ((e.body && e.body.errors) ? e.body.errors.join("; ") : e.message); });
  });

  function userRow(u) {
    var tr = document.createElement("tr");
    var tick = document.createElement("td");
    var box = document.createElement("input");
    box.type = "checkbox";
    box.checked = picked.has(u.userId);
    box.addEventListener("click", function (e) {
      e.stopPropagation();
      if (box.checked) picked.set(u.userId, u.pushOffers); else picked.delete(u.userId);
      showPicked();
    });
    tick.appendChild(box);
    tr.appendChild(tick);
    var staffTd = document.createElement("td");
    var staffBtn = document.createElement("button");
    var paintStaff = function () { staffBtn.textContent = u.staff ? "staff ✓" : "make staff"; };
    paintStaff();
    staffBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      api("PUT", "/admin/api/users/" + encodeURIComponent(u.userId) + "/staff", { staff: !u.staff })
        .then(function (r) { u.staff = r.staff; paintStaff(); })
        .catch(function (err) { $("users-status").textContent = "staff failed: " + err.message; });
    });
    staffTd.appendChild(staffBtn);
    tr.appendChild(staffTd);
    var cells = [
      u.email || shortId(u.userId),
      u.createdAt.slice(0, 10),
      (u.providers || []).join(", ") || "—",
      u.entitled ? "yes" : (u.onboardedAt ? "no" : "not onboarded"),
      // The number that is actually enforced, with the account's own beside it when it has one:
      // "effective" is what checkCaps refuses with, and the panel must not compute a second answer.
      u.spent + " / " + u.effective + (u.freeAnalyses === null ? " (default)" : ""),
      String(u.analysesToday),
      ago(u.lastSeen)
    ];
    cells.forEach(function (text, i) {
      var td = document.createElement("td");
      td.textContent = text;
      if (i === 0) td.title = u.userId;
      tr.appendChild(td);
    });
    // The id is what the sample box below takes, and typing a uuid off a screen is how a typo
    // becomes a cap set on a stranger.
    tr.addEventListener("click", function () {
      $("cap-user").value = u.userId;
      api("GET", capPath()).then(function (c) { showCap(c); }).catch(capFailed);
      // AND the thread, because #376's point is that you reach it from the list rather than by
      // typing a uuid off a screen.
      loadChat(u.userId, false);
      $("chat-who").scrollIntoView({ block: "center" });
      // AND the diary, because #375's whole point is that you reach it from the list rather than
      // by typing a uuid off a screen.
      $("diary-from").value = "";
      $("diary-to").value = "";
      loadDiary(u.userId);
      // ONE scroll, to the thread above: two would fight, and the diary sits right below it.
    });
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
      $("users-more").classList.toggle("hidden", !page.nextCursor);
      $("users-status").textContent = body.childElementCount === 0
        ? (q ? "Nothing matches that. It takes a whole address, or the start of an id." : "No accounts yet.")
        : body.childElementCount + " shown · sample is out of " + page.defaultFreeAnalyses + " by default";
    });
  }

  // The first load is the view's, and its failure is the view's error state. A search or a page
  // after that fails beside the box that asked.
  function usersAgain(append) {
    if (!append) usersCursor = null;
    loadUsers(append).catch(function (e) { $("users-status").textContent = "failed: " + e.message; });
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

  function loadChat(userId, older) {
    if (userId) { chatUser = userId; chatBefore = null; }
    if (!chatUser) { $("chat-status").textContent = "Choose an account above."; return Promise.resolve(); }
    var path = "/admin/api/users/" + chatUser + "/chat?limit=50";
    if (older && chatBefore) path += "&before=" + chatBefore;
    $("chat-who").textContent = chatUser.slice(0, 8);
    return api("GET", path).then(function (view) {
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
    }).catch(function (e) { $("chat-status").textContent = "failed: " + e.message; });
  }

  $("chat-older").addEventListener("click", function () { loadChat(null, true); });
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
    var cells = [
      m.ts.slice(0, 16).replace("T", " "),
      (names || (m.isFood ? "Meal" : "Not food")) + (m.corrected ? " (corrected)" : ""),
      String(Math.round(m.kcal)),
      verdicts || "—",
      m.model || "—",
      m.confidence || "—",
      String(m.photos || 0)
    ];
    cells.forEach(function (text) {
      var td = document.createElement("td");
      td.textContent = text;
      tr.appendChild(td);
    });
    tr.addEventListener("click", function () { showPhotos(m); });
    return tr;
  }

  function loadDiary(userId) {
    if (userId) diaryUser = userId;
    if (!diaryUser) { $("diary-status").textContent = "Choose an account above."; return Promise.resolve(); }
    releasePhotos();
    var path = "/admin/api/users/" + diaryUser + "/meals";
    var from = $("diary-from").value.trim();
    var to = $("diary-to").value.trim();
    var query = [];
    if (from) query.push("from=" + encodeURIComponent(from));
    if (to) query.push("to=" + encodeURIComponent(to));
    if (query.length) path += "?" + query.join("&");
    $("diary-who").textContent = diaryUser.slice(0, 8);
    return api("GET", path).then(function (view) {
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
    }).catch(function (e) { $("diary-status").textContent = "failed: " + e.message; });
  }

  $("diary-load").addEventListener("click", function () { loadDiary(null); });

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
      render();
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
    numbers: { title: "Numbers", load: loadMetrics },
    pushes: { title: "Pushes", load: loadPushes },
    funnel: { title: "Funnel", load: loadFunnel },
    campaigns: { title: "Campaigns", load: loadCampaigns },
    accounts: { title: "Accounts", load: function () { loadComposerTemplates(); return loadUsers(false); } },
    onboarding: { title: "Onboarding copy", load: function () { return loadOnboarding(); } },
    // The shell already read the templates to count what needs review, so the first open draws
    // from that answer instead of asking twice.
    templates: { title: "Push templates", load: function () { return push ? Promise.resolve(renderPush()) : loadPush(); } },
    prompts: { title: "System prompts", load: loadPrompts },
    food: { title: "Food database", load: loadSwitches }
  };

  // view id -> "loading" | "ready". Absent: never opened, failed, or stale and due a read.
  var state = {};

  function skeleton() {
    var box = document.createElement("div");
    box.className = "sk";
    for (var r = 0; r < 7; r++) {
      var row = document.createElement("div");
      row.className = "sk-row";
      for (var c = 0; c < 4; c++) row.appendChild(document.createElement("i"));
      box.appendChild(row);
    }
    return box;
  }

  function paint(id, kind, err) {
    var box = $("state-" + id);
    box.textContent = "";
    $("body-" + id).classList.toggle("hidden", kind !== "ready");
    if (kind === "loading") box.appendChild(skeleton());
    if (kind !== "error") return;
    var bar = document.createElement("div");
    bar.className = "aerr";
    var msg = document.createElement("span");
    msg.textContent = "Couldn't load " + VIEWS[id].title.toLowerCase() + ". "
      + (err && err.status ? "The server answered " + err.status + "." : "The request did not get an answer.");
    var sp = document.createElement("span");
    sp.className = "sp";
    var again = document.createElement("button");
    again.textContent = "Try again";
    again.addEventListener("click", function () { run(id); });
    bar.appendChild(msg);
    bar.appendChild(sp);
    bar.appendChild(again);
    box.appendChild(bar);
    var note = document.createElement("p");
    note.className = "muted";
    note.textContent = "Only this view failed. The others load on their own.";
    box.appendChild(note);
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
    if (push && push.keys) push.keys.forEach(function (k) { n += k.gaps.length; });
    var el = $("templates-badge");
    el.textContent = String(n);
    el.classList.toggle("hidden", n === 0);
  }

  function show(id) {
    Object.keys(VIEWS).forEach(function (v) { $("view-" + v).classList.toggle("hidden", v !== id); });
    $("view-title").textContent = VIEWS[id].title;
    document.title = "eait admin — " + VIEWS[id].title;
    Array.prototype.forEach.call(document.querySelectorAll("[data-nav]"), function (a) {
      var on = a.getAttribute("data-nav") === id;
      a.classList.toggle("on", on);
      if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    $("switcher").value = id;
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
      render();
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
    if (!confirm("Restore the copy the app ships with? Your edits are replaced.")) return;
    api("POST", atLang("/admin/api/content/reset"), {}).then(function (res) {
      content = res.content;
      showErrors(null);
      render();
      status("restored — version " + content.version);
    }).catch(function (e) { status("failed: " + e.message); });
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
