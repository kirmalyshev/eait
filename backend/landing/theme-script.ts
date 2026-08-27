// The only JavaScript on this site, and the reason the Content-Security-Policy now names a
// `script-src` at all.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// WHAT IT COSTS, STATED PLAINLY
//
// Before this file the policy was `default-src 'none'; style-src 'self'` with NO `script-src`,
// which was not a restriction on the page but a description of it. That sentence is no longer
// true. `script-src 'self'` is the smallest change that makes a remembered theme possible: one
// same-origin file, no inline execution, no third party, nothing fetched.
//
// It is a real trade and it was made deliberately, because a toggle that forgets is not a setting.
// Everything else about the policy is unchanged: no connect-src, no frame-src, no eval.
//
// NOTHING IS SENT ANYWHERE. The choice lives in this browser's localStorage under one key and is
// read by this file only. There is no request, no cookie, and nothing for a server to log — which
// matters on a page whose pitch is that we do not keep anything of yours.
//
// IT MUST BE A BLOCKING SCRIPT IN THE HEAD. Deferred or at the end of the body, the browser paints
// the default theme first and the stored one lands a frame later: a white flash on every page load
// for the people who chose dark, which is the exact population that notices. It is ~400 bytes and
// same-origin, so the parser pause is not measurable.
//
// NO BUILD STEP. It is emitted verbatim beside the page, in a syntax old enough that no transpiler
// is warranted for four statements.
// ─────────────────────────────────────────────────────────────────────────────────────────────

/** The localStorage key. Namespaced so it cannot collide on a shared origin. */
export const THEME_KEY = "ieat.theme";

export const themeScript = `(function () {
  var KEY = ${JSON.stringify(THEME_KEY)};
  var root = document.documentElement;

  // Reading localStorage throws outright in a browser set to block site data, and in Safari's
  // private mode on older versions. A page that fails to render because it could not remember a
  // colour is a worse outcome than a page in the default colour.
  function stored() {
    try { var v = localStorage.getItem(KEY); return v === "dark" || v === "light" ? v : null; }
    catch (e) { return null; }
  }

  // No stored choice means NO data-theme attribute, which is what lets the media query in the
  // stylesheet decide. Writing "light" here instead would override the OS preference of every
  // visitor who has never touched the toggle.
  function paint(theme) {
    if (theme) root.setAttribute("data-theme", theme);
    else root.removeAttribute("data-theme");
    var dark = theme ? theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    var buttons = document.querySelectorAll("[data-theme-toggle]");
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].setAttribute("aria-pressed", dark ? "true" : "false");
      buttons[i].setAttribute("aria-label", dark ? "Switch to the light theme" : "Switch to the dark theme");
    }
  }

  paint(stored());

  // The buttons do not exist yet — this runs in the head, before the body is parsed — so the
  // listener goes on the document and the button is found on the way up. One listener, and it
  // works for however many toggles a page carries.
  document.addEventListener("click", function (e) {
    var button = e.target && e.target.closest && e.target.closest("[data-theme-toggle]");
    if (!button) return;
    var next = root.getAttribute("data-theme") === "dark" ? "light"
      : root.getAttribute("data-theme") === "light" ? "dark"
      : matchMedia("(prefers-color-scheme: dark)").matches ? "light" : "dark";
    paint(next);
    try { localStorage.setItem(KEY, next); } catch (e2) { /* see stored() */ }
  });

  // A visitor who never chose follows their OS, including when they change it with the page open.
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () {
    if (!stored()) paint(null);
  });

  document.addEventListener("DOMContentLoaded", function () { paint(stored()); });
})();
`;
