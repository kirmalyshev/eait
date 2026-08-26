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

export const ADMIN_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ieat — onboarding admin</title>
<style>
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
  th, td { text-align: right; padding: 7px 8px; border-bottom: 1px solid var(--border); }
  th:first-child, td:first-child { text-align: left; }
  th { color: var(--muted); font-weight: 500; }
  td.drop { color: var(--bad); }
  .pill { font-size: 11px; color: var(--faint); border: 1px solid var(--border); border-radius: 999px; padding: 2px 8px; }
  .gate { max-width: 420px; margin: 15vh auto; }
  .hidden { display: none; }
  .muted { color: var(--muted); font-size: 13px; }
</style>
</head>
<body>

<div class="wrap gate" id="gate">
  <h1>ieat admin</h1>
  <p class="sub">Paste the admin token. It stays in this tab and is not written to disk.</p>
  <input type="password" id="token" placeholder="admin token" autocomplete="off">
  <p id="gate-error" class="hidden" style="color:var(--bad);font-size:13px"></p>
  <p><button class="primary" id="unlock">Unlock</button></p>
</div>

<div class="wrap hidden" id="app">
  <h1>Onboarding</h1>
  <p class="sub">
    Every word the app shows during onboarding. The <em>questions</em> are fixed in code — they feed
    the calorie target — but the wording, the order, the mascot lines and the option labels are all
    from here. Saving bumps the content version, which is what the funnel below is grouped by.
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
    "No email, no name" is, and always will be.
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
</div>

<div class="bar hidden" id="bar">
  <span class="status" id="status"></span>
  <button id="reload">Reload</button>
  <button id="reset">Restore defaults</button>
  <button class="primary" id="save">Save</button>
</div>

<script>
(function () {
  "use strict";

  var TOKEN_KEY = "ieat.admin.token";
  var token = sessionStorage.getItem(TOKEN_KEY) || "";
  var content = null;
  var meta = null;
  var notify = null;
  var notifyMeta = null;

  var $ = function (id) { return document.getElementById(id); };

  function api(method, path, body) {
    return fetch(path, {
      method: method,
      headers: body
        ? { "x-admin-token": token, "content-type": "application/json" }
        : { "x-admin-token": token },
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

  function moodSelect(parent, value, onChange) {
    var l = document.createElement("label");
    l.textContent = "Mascot mood";
    var sel = document.createElement("select");
    meta.moods.forEach(function (m) {
      var o = document.createElement("option");
      o.value = m;
      o.textContent = m;
      if (m === value) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener("change", function () { onChange(sel.value); });
    parent.appendChild(l);
    parent.appendChild(sel);
  }

  function screenCard(screen, index) {
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

    var up = document.createElement("button");
    up.className = "small";
    up.textContent = "↑";
    up.disabled = index === 0;
    up.addEventListener("click", function () { move(index, -1); });
    var down = document.createElement("button");
    down.className = "small";
    down.textContent = "↓";
    down.disabled = index === content.screens.length - 1;
    down.addEventListener("click", function () { move(index, 1); });
    head.appendChild(up);
    head.appendChild(down);
    card.appendChild(head);

    field(card, "Title", screen.title, function (v) { screen.title = v; });
    field(card, "Subtitle (optional)", screen.subtitle, function (v) {
      if (v) screen.subtitle = v; else delete screen.subtitle;
    });

    var row = document.createElement("div");
    row.className = "row";
    var left = document.createElement("div");
    var right = document.createElement("div");
    moodSelect(left, screen.mascot.mood, function (v) { screen.mascot.mood = v; });
    field(right, "Mascot line", screen.mascot.line, function (v) { screen.mascot.line = v; });
    row.appendChild(left);
    row.appendChild(right);
    card.appendChild(row);

    field(card, "Why we ask (optional)", screen.why, function (v) {
      if (v) screen.why = v; else delete screen.why;
    }, true);
    field(card, "Button label (optional)", screen.cta, function (v) {
      if (v) screen.cta = v; else delete screen.cta;
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

  function move(index, delta) {
    var next = index + delta;
    if (next < 0 || next >= content.screens.length) return;
    var tmp = content.screens[index];
    content.screens[index] = content.screens[next];
    content.screens[next] = tmp;
    render();
  }

  /** Mood on the left, the line it says on the right — the pairing every card uses. */
  function mascotRow(card, m) {
    var row = document.createElement("div");
    row.className = "row";
    var left = document.createElement("div");
    var right = document.createElement("div");
    moodSelect(left, m.mood, function (v) { m.mood = v; });
    field(right, "Mascot line", m.line, function (v) { m.line = v; });
    row.appendChild(left);
    row.appendChild(right);
    card.appendChild(row);
  }

  function welcomeCard() {
    var w = content.welcome;
    var card = document.createElement("div");
    card.className = "card";
    field(card, "Title", w.title, function (v) { w.title = v; });
    field(card, "Subtitle (optional)", w.subtitle, function (v) {
      if (v.trim() === "") delete w.subtitle; else w.subtitle = v;
    });
    mascotRow(card, w.mascot);
    // Rendered from the array each time, so removing a line is emptying its box rather than
    // hunting for a delete control. The validator refuses an empty list, which is the guard.
    w.points.forEach(function (pt, i) {
      field(card, "Line " + (i + 1), pt, function (v) { w.points[i] = v; });
    });
    if (w.points.length < 4) {
      var add = document.createElement("button");
      add.textContent = "Add a line";
      add.addEventListener("click", function () { w.points.push(""); render(); });
      card.appendChild(add);
    }
    field(card, "Button label", w.cta, function (v) { w.cta = v; });
    return card;
  }

  function buildingCard() {
    var b = content.building;
    var card = document.createElement("div");
    card.className = "card";
    field(card, "Title", b.title, function (v) { b.title = v; });
    mascotRow(card, b.mascot);
    field(card, "Resting burn", b.restLabel, function (v) { b.restLabel = v; });
    field(card, "With activity", b.activityLabel, function (v) { b.activityLabel = v; });
    field(card, "Pace adjustment", b.paceLabel, function (v) { b.paceLabel = v; });
    field(card, "Safety floor", b.floorLabel, function (v) { b.floorLabel = v; });
    field(card, "Button label", b.cta, function (v) { b.cta = v; });
    return card;
  }

  function summaryCard() {
    var s = content.summary;
    var card = document.createElement("div");
    card.className = "card";
    field(card, "Title", s.title, function (v) { s.title = v; });
    mascotRow(card, s.mascot);
    field(card, "Button label", s.cta, function (v) { s.cta = v; });
    field(card, "Projection", s.projection, function (v) { s.projection = v; });
    field(card, "Projection past two years", s.projectionFar, function (v) { s.projectionFar = v; });
    field(card, "Disclaimer", s.disclaimer, function (v) { s.disclaimer = v; }, true);
    return card;
  }

  function render() {
    var host = $("screens");
    host.textContent = "";
    content.screens.forEach(function (s, i) { host.appendChild(screenCard(s, i)); });
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

  // ── Wiring ─────────────────────────────────────────────────────────────────────────────────

  function load() {
    return api("GET", "/admin/api/content").then(function (res) {
      content = res.content;
      meta = res.meta;
      render();
      return loadNotify().then(loadFunnel);
    });
  }

  function unlock() {
    token = $("token").value.trim();
    if (!token) return;
    load().then(function () {
      sessionStorage.setItem(TOKEN_KEY, token);
      $("gate").classList.add("hidden");
      $("app").classList.remove("hidden");
      $("bar").classList.remove("hidden");
    }).catch(function (e) {
      var msg = $("gate-error");
      msg.textContent = e.status === 401 ? "That token was not accepted." : "Could not load: " + e.message;
      msg.classList.remove("hidden");
      sessionStorage.removeItem(TOKEN_KEY);
    });
  }

  $("unlock").addEventListener("click", unlock);
  $("token").addEventListener("keydown", function (e) { if (e.key === "Enter") unlock(); });

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

  if (token) {
    $("token").value = token;
    unlock();
  }
})();
</script>
</body>
</html>
`;
