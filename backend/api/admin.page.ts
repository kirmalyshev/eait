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
  :root {
    --bg: #0B0B0C; --surface: #141517; --raised: #1C1E21; --border: #26292E;
    --text: #F4F4F5; --muted: #9BA1AA; --faint: #6B7178;
    --accent: #C8F751; --accent-text: #10130A; --bad: #F87171; --care: #7DD3FC;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg); color: var(--text);
    font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  }
  .wrap { max-width: 900px; margin: 0 auto; padding: 24px 16px 96px; }
  h1 { font-size: 22px; letter-spacing: -0.4px; margin: 0 0 4px; }
  h2 { font-size: 17px; margin: 32px 0 12px; }
  p.sub { color: var(--muted); margin: 0 0 24px; }
  .card {
    background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
    padding: 16px; margin-bottom: 12px;
  }
  .card header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
  .card header .id { font-weight: 700; letter-spacing: -0.2px; }
  .card header .grow { flex: 1; }
  label { display: block; font-size: 12px; color: var(--muted); margin: 10px 0 4px; }
  input[type=text], textarea, select {
    width: 100%; background: var(--raised); color: var(--text);
    border: 1px solid var(--border); border-radius: 8px; padding: 9px 10px;
    font: inherit; font-size: 14px;
  }
  textarea { min-height: 60px; resize: vertical; }
  input:focus, textarea:focus, select:focus { outline: 2px solid var(--accent); outline-offset: -1px; }
  .row { display: flex; gap: 10px; }
  .row > * { flex: 1; min-width: 0; }
  button {
    background: var(--raised); color: var(--text); border: 1px solid var(--border);
    border-radius: 8px; padding: 8px 12px; font: inherit; font-size: 13px; cursor: pointer;
  }
  button:hover { border-color: var(--faint); }
  button.primary { background: var(--accent); color: var(--accent-text); border-color: var(--accent); font-weight: 600; }
  button.small { padding: 4px 8px; font-size: 12px; }
  .options { border-top: 1px solid var(--border); margin-top: 14px; padding-top: 10px; }
  .opt { display: flex; gap: 10px; align-items: center; margin-bottom: 6px; }
  .opt code { color: var(--care); font-size: 12px; min-width: 84px; }
  .bar {
    position: fixed; left: 0; right: 0; bottom: 0; background: var(--surface);
    border-top: 1px solid var(--border); padding: 12px 16px;
    display: flex; gap: 10px; align-items: center; justify-content: flex-end;
  }
  .bar .status { margin-right: auto; color: var(--muted); font-size: 13px; }
  .errors { border: 1px solid var(--bad); background: rgba(248,113,113,0.08); border-radius: 10px; padding: 12px; margin-bottom: 16px; }
  .errors ul { margin: 6px 0 0; padding-left: 18px; }
  .errors li { color: var(--bad); font-size: 13px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .line { display: flex; gap: 10px; padding: 6px 0; border-bottom: 1px solid var(--border); font-size: 13px; }
  .line:last-child { border-bottom: 0; }
  .line .who { flex: 0 0 52px; color: var(--muted); }
  .line .when { margin-left: auto; color: var(--faint); white-space: nowrap; }
  .line.them .who { color: var(--care); }
  img.shot { max-width: 260px; border-radius: 8px; margin: 8px 8px 0 0; vertical-align: top; }
  th, td { text-align: right; padding: 7px 8px; border-bottom: 1px solid var(--border); }
  th:first-child, td:first-child { text-align: left; }
  th { color: var(--muted); font-weight: 500; }
  td.drop { color: var(--bad); }
  .pill { font-size: 11px; color: var(--faint); border: 1px solid var(--border); border-radius: 999px; padding: 2px 8px; }
  .gate { max-width: 420px; margin: 15vh auto; }
  .hidden { display: none; }
  .muted { color: var(--muted); font-size: 13px; }
/* WAS AN INLINE style="" ATTRIBUTE, and a nonce does not cover one: a nonce authorises <style>
   and <script> ELEMENTS, never a style attribute, so the browser refused it and the error text
   rendered unstyled. Found by driving real Chrome — the unit tests assert the policy string and
   cannot see what it forbids. */
.gate-error { color: var(--bad); font-size: 13px; }
</style>
</head>
<body>

<div class="wrap gate" id="gate">
  <h1>eait admin</h1>
  <p class="sub">Sign in with the account that holds the admin role. There is no separate password.</p>
  <p id="gate-error" class="hidden gate-error"></p>
  <p><a class="primary" id="signin" href="/start">Sign in</a></p>
</div>

<div class="wrap hidden" id="app">
  <h1>Onboarding</h1>
  <p class="sub">
    Every word Spud says to POSE a question, plus the option labels, the front door and the plan.
    The <em>questions</em> are fixed in code — they feed the calorie target — and so is their order,
    and so are Spud's replies and the support cards, which carry citations. Saving bumps the content
    version, which is what the funnel below is grouped by.
  </p>

  <h2>The numbers <span class="pill" id="metrics-window"></span></h2>
  <p class="muted" id="metrics-summary">Loading…</p>
  <table id="metrics">
    <thead>
      <tr><th>Day</th><th>Signups</th><th>Activated</th><th>Analyses</th><th>Spend</th></tr>
    </thead>
    <tbody></tbody>
  </table>
  <p class="muted">
    <strong>Analyses, not money.</strong> Nothing records what a model call cost, so this counts
    calls and states the cap in the same units — the instance's budget is a count too. Came back
    means <em>logged something</em> on that day, which is narrower than opening the app and is the
    only version of it this database can answer about a day in the past.
  </p>

  <h2>Funnel <span class="pill" id="funnel-window"></span></h2>
  <p class="muted" id="funnel-summary">Loading…</p>
  <table id="funnel">
    <thead>
      <tr><th>Screen</th><th>Views</th><th>Answers</th><th>Drop</th><th>Back</th><th>Refused</th><th>Median</th></tr>
    </thead>
    <tbody></tbody>
  </table>
  <p class="muted">
    Drop is views minus answers on that screen: the people who saw the question and did not answer it.
    Median is how long an answer took.
  </p>

  <div id="errors" class="errors hidden"><strong>Not saved.</strong><ul></ul></div>

  <h2>The welcome screen</h2>
  <p class="muted">
    The first thing anyone sees. The lines under the title are what we do NOT ask for — do not name a
    competitor there, do not write "free", and do not promise away the card, the trial or the
    cancelling: the app sells a subscription behind a seven-day trial, so those are no longer true.
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

  <h2>Notifications</h2>
  <p class="muted">
    The three messages this product is allowed to send: the two trial reminders, which the phone
    fires itself, and the 20:30 line, which the server composes and pushes. One a day — a reminder
    day sends the reminder <em>instead of</em> the evening line, never as well. The braces are
    filled in by the server; you may move them, but you may not remove one or invent another, and
    <code>Nothing logged</code> is the body for a day with no meals. A health claim is refused here
    the same way it is on the landing page.
  </p>
  <div id="notify-errors" class="errors hidden"><strong>Not saved.</strong><ul></ul></div>
  <div id="notifications"></div>
  <p>
    <button id="notify-reset">Restore defaults</button>
    <button class="primary" id="notify-save">Save notifications</button>
    <span class="status" id="notify-status"></span>
  </p>

  <h2>Accounts</h2>
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
    <p class="muted" id="users-status">Loading…</p>
  </div>
  <table id="users">
    <thead>
      <tr><th>Account</th><th>Signed up</th><th>Via</th><th>Paid</th><th>Sample</th><th>Today</th><th>Last seen</th></tr>
    </thead>
    <tbody></tbody>
  </table>
  <p>
    <button id="users-more" class="hidden">Load more</button>
  </p>

  <h2>Thread <span class="pill" id="chat-who"></span></h2>
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
  <h2>Diary <span class="pill" id="diary-who"></span></h2>
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
  <table id="diary">
    <thead>
      <tr><th>When</th><th>What</th><th>kcal</th><th>Verdicts</th><th>Model</th><th>Confidence</th><th>Photos</th></tr>
    </thead>
    <tbody></tbody>
  </table>
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

<div class="bar hidden" id="bar">
  <span class="status" id="status"></span>
  <button id="reload">Reload</button>
  <button id="reset">Restore defaults</button>
  <button class="primary" id="save">Save</button>
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
  var content = null;
  var meta = null;
  var notify = null;
  var notifyMeta = null;

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
        var parsed = text ? JSON.parse(text) : {};
        if (!res.ok) { var err = new Error(parsed.error || res.status); err.body = parsed; err.status = res.status; throw err; }
        return parsed;
      });
    });
  }

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
      pill.className = "pill";
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

  // What the provider priced — a floor while any analysis that day went unpriced (#484).
  function spend(d) {
    var usd = d.costUsd === null ? "—" : "$" + d.costUsd.toFixed(4);
    return d.unpriced ? usd + " · " + d.unpriced + " unpriced" : usd;
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
        + " · on day 7 " + m.d7.returned + "/" + m.d7.eligible + " (" + pct(m.d7.returned, m.d7.eligible) + ")";
      var body = $("metrics").querySelector("tbody");
      body.textContent = "";
      // Newest first on screen; the server sends oldest first because that is the order a window is.
      m.days.slice().reverse().forEach(function (d) {
        var tr = document.createElement("tr");
        [d.date, String(d.signups), String(d.activations), String(d.analyses), spend(d)].forEach(function (t, i) {
          var td = document.createElement("td");
          td.textContent = t;
          // The one number that can hit a wall, marked when it is at it.
          if (i === 3 && m.dailyAnalysisCap && d.analyses >= m.dailyAnalysisCap) td.className = "drop";
          tr.appendChild(td);
        });
        body.appendChild(tr);
      });
    }).catch(function (e) { $("metrics-summary").textContent = "failed: " + e.message; });
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
          var td = document.createElement("td");
          td.textContent = text;
          if (i === 3 && drop > 0) td.className = "drop";
          tr.appendChild(td);
        });
        body.appendChild(tr);
      });
    });
  }

  // ── Notifications ──────────────────────────────────────────────────────────────────────────

  var NOTIFY_LABELS = {
    "trial-day5": "Two days before the trial ends (sent by the phone)",
    "trial-day6": "The day before the trial ends (sent by the phone)",
    "evening": "The 20:30 line (composed and pushed by the server)"
  };

  function holes(at) {
    var declared = (notifyMeta.placeholders || {})[at] || [];
    return declared.length ? "  ·  fills in: {" + declared.join("}  {") + "}" : "  ·  no braces here";
  }

  function notifyCard(id) {
    var m = notify[id];
    var card = document.createElement("div");
    card.className = "card";
    var head = document.createElement("header");
    var name = document.createElement("span");
    name.className = "id";
    name.textContent = id;
    head.appendChild(name);
    var what = document.createElement("span");
    what.className = "muted";
    what.textContent = NOTIFY_LABELS[id] || "";
    head.appendChild(what);
    card.appendChild(head);

    field(card, "Title" + holes(id + ".title"), m.title, function (v) { m.title = v; });
    field(card, "Body" + holes(id + ".body"), m.body, function (v) { m.body = v; }, true);
    if (id === "evening") {
      field(card, "Body when nothing was logged" + holes(id + ".emptyBody"), m.emptyBody,
        function (v) { m.emptyBody = v; }, true);
    }
    return card;
  }

  function renderNotify() {
    var host = $("notifications");
    host.textContent = "";
    notifyMeta.ids.forEach(function (id) { host.appendChild(notifyCard(id)); });
  }

  function notifyErrors(list) {
    var box = $("notify-errors");
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

  function loadNotify() {
    return api("GET", "/admin/api/notifications").then(function (res) {
      notify = res.copy;
      notifyMeta = res.meta;
      renderNotify();
    });
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

  function userRow(u) {
    var tr = document.createElement("tr");
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
    }).catch(function (e) { $("users-status").textContent = "failed: " + e.message; });
  }

  $("users-search").addEventListener("click", function () { usersCursor = null; loadUsers(false); });
  $("users-q").addEventListener("keydown", function (e) {
    if (e.key === "Enter") { usersCursor = null; loadUsers(false); }
  });
  $("users-more").addEventListener("click", function () { loadUsers(true); });

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
    // "speaker" is the whole of who answered: null is Spud, so every line from before Gabie stays
    // his rather than becoming hers.
    who.textContent = e.role === "user" ? "them"
      : (e.kind === "meal" ? "card" : (e.speaker || "spud"));
    row.appendChild(who);
    var body = document.createElement("span");
    if (e.kind === "meal") {
      body.textContent = e.meal
        ? (e.event || "logged") + ": " + (e.meal.items || []).map(function (i) { return i.name; }).join(", ")
          + " — " + Math.round(e.meal.kcal) + " kcal"
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
        ? " · plan today: " + Math.round(view.targets.kcal) + " kcal, "
          + Math.round(view.targets.protein_g) + " g protein"
        : " · not onboarded";
      $("diary-status").textContent = view.meals.length === 0
        ? "Nothing logged in that window." + plan
        : view.meals.length + " meals" + plan;
    }).catch(function (e) { $("diary-status").textContent = "failed: " + e.message; });
  }

  $("diary-load").addEventListener("click", function () { loadDiary(null); });

  // ── Wiring ─────────────────────────────────────────────────────────────────────────────────

  function load() {
    return api("GET", "/admin/api/content").then(function (res) {
      content = res.content;
      meta = res.meta;
      render();
      return loadNotify().then(loadMetrics).then(loadFunnel)
        .then(function () { return loadUsers(false); });
    });
  }

  function enter() {
    // Trade the /start session cookie for a bearer. A POST, because SameSite=Lax withholds the
    // cookie from a cross-site POST and that is what guards it; the token comes back in the body,
    // never in a URL.
    // redirect: "manual", and it is the difference between two very different messages. With no
    // session the route answers 303 to /start; fetch FOLLOWS that by default, gets 200 HTML back,
    // and res.ok is true — so the JSON parse threw and the catch below told an administrator their
    // account could not administer this instance. An opaque redirect is a signed-out browser.
    return fetch("/start/session/token", { method: "POST", redirect: "manual" }).then(function (res) {
      if (res.type === "opaqueredirect" || res.status === 0 || res.status === 303) throw new Error("signed-out");
      if (!res.ok) throw new Error("signed-out");
      return res.json();
    }).then(function (body) {
      token = body.token;
      return load();
    }).then(function () {
      $("gate").classList.add("hidden");
      $("app").classList.remove("hidden");
      $("bar").classList.remove("hidden");
    }).catch(function (e) {
      token = "";
      var msg = $("gate-error");
      // 404 is what an account without the role gets, and it is deliberately the same answer an
      // instance with no admin at all gives. Say the one true thing rather than guessing which.
      msg.textContent = e.message === "signed-out"
        ? ""
        : "That account cannot administer this instance.";
      if (msg.textContent) msg.classList.remove("hidden");
    });
  }

  // Try on load: somebody arriving here from /start is already signed in, and asking them to press
  // a button to discover that is a button with no question behind it.
  enter();

  $("save").addEventListener("click", function () {
    status("saving…");
    api("PUT", "/admin/api/content", { content: content }).then(function (res) {
      content = res.content;
      showErrors(null);
      render();
      status("saved — version " + content.version);
      return loadFunnel();
    }).catch(function (e) {
      showErrors((e.body && e.body.errors) || [e.message]);
      status("not saved");
    });
  });

  $("reset").addEventListener("click", function () {
    if (!confirm("Restore the copy the app ships with? Your edits are replaced.")) return;
    api("POST", "/admin/api/content/reset", {}).then(function (res) {
      content = res.content;
      showErrors(null);
      render();
      status("restored — version " + content.version);
    }).catch(function (e) { status("failed: " + e.message); });
  });

  $("notify-save").addEventListener("click", function () {
    $("notify-status").textContent = "saving…";
    api("PUT", "/admin/api/notifications", { copy: notify }).then(function (res) {
      notify = res.copy;
      notifyErrors(null);
      renderNotify();
      $("notify-status").textContent = "saved";
    }).catch(function (e) {
      notifyErrors((e.body && e.body.errors) || [e.message]);
      $("notify-status").textContent = "not saved";
    });
  });

  $("notify-reset").addEventListener("click", function () {
    if (!confirm("Restore the three messages the app ships with? Your edits are replaced.")) return;
    api("POST", "/admin/api/notifications/reset", {}).then(function (res) {
      notify = res.copy;
      notifyErrors(null);
      renderNotify();
      $("notify-status").textContent = "restored";
    }).catch(function (e) { $("notify-status").textContent = "failed: " + e.message; });
  });

  $("reload").addEventListener("click", function () {
    load().then(function () { status("reloaded — version " + content.version); });
  });

})();
</script>
</body>
</html>
`;
