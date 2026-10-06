// The one inline script every onboarding page carries — hashed into the CSP by `shell.ts`.
//
// It UPGRADES, it never supplies: every answer the script drives also arrives through a plain
// `<input>` the server rendered (`/start` works with the script blocked — the e2e suite runs it).
// What it drives:
//   - `main.js`             reveals the drag controls the boards draw (`[data-ctl]`), hides the
//                           plain number fields they replace.
//   - `[data-ctl=ruler]`    the horizontal rulers (weight, target) and the vertical one (height):
//                           pointer drag, wheel nudge, arrow keys — the same `answer` input either
//                           way, labels repainted from `data-*` pitches (`shared/ui/units.ts`).
//   - `[data-ctl=wheel]`    the age wheel: a scroll-snap column writing the same input.
//   - `[data-ctl=slider]`   the pace slider: three stops wired to the real radios, swapping the
//                           three server-computed preview blocks.
//   - `input[value=none]`   medical's exclusive choice clears the rest (and vice-versa) — the
//                           server applies the same rule, this is only the row staying honest.
//   - `form.seg`            the unit toggle carries the current draft across the POST.
//   - `.vdemo video`        the welcome loop: paused under prefers-reduced-motion (the CSS swap
//                           already shows its last frame; this just stops it drawing).
//
// Readability beats brevity here — one script, no build step, so it is plain ES5-ish and says
// what it does. Every `data-` attribute is read as untrusted text the server wrote: all of them
// parse to a number or they are ignored.

export const CONTROL_SCRIPT = `(function () {
  var main = document.querySelector("main.ob");
  if (!main) return;
  main.classList.add("js");

  var RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var vid = document.querySelector(".vdemo video");
  if (vid) { if (RM) vid.pause(); else { try { vid.play().catch(function () {}); } catch (e) {} } }

  // The imperial-height fallback is two fields; when the ruler drives, only answer (total
  // inches) may post — a stale ft/in pair beside it would win instead of it.
  main.querySelectorAll("input[data-alt]").forEach(function (i) { i.disabled = true; });

  function num(s, d) { var n = parseFloat(s); return isFinite(n) ? n : d; }
  // Display numbers are the document's language, never the wire's — a German ruler reads 73,5.
  // The INPUT the same script writes stays an ASCII number, which is what the server parses.
  var NF = new Intl.NumberFormat(document.documentElement.lang || "en",
    { maximumFractionDigits: 1 });
  function fmtN(v) { return NF.format(Math.round(v * 10) / 10); }

  // The label text for a ruler value: plain integer, or feet′inches″.
  function fmtVal(fmt, v) {
    v = Math.round(v);
    if (fmt === "ftin") return Math.floor(v / 12) + "′" + (v % 12) + "″";
    return String(v);
  }
  function bigSet(ctl, fmt, v) {
    var bv = ctl.querySelector(".bv");
    if (!bv) return;
    if (fmt === "ftin") {
      v = Math.round(v);
      bv.textContent = Math.floor(v / 12) + "′";
      var bi = ctl.querySelector(".bv2");
      if (bi) bi.textContent = (v % 12) + "″";
      // the bign's own text still carries the unit word for screen readers via the smalls
      return;
    }
    bv.textContent = fmtN(v);
  }

  // ── rulers (horizontal + vertical) ──────────────────────────────────────────────────────────
  main.querySelectorAll("[data-ctl='ruler']").forEach(function (ctl) {
    var el = ctl.querySelector(".vruler") || ctl.querySelector(".ruler");
    var inp = ctl.closest("form").querySelector("input[name='answer']");
    if (!el || !inp) return;
    var vert = !!ctl.querySelector(".vruler");
    var min = num(ctl.dataset.min, 0), max = num(ctl.dataset.max, 100);
    var px = num(ctl.dataset.px, 9), every = num(ctl.dataset.every, 5);
    var step = num(ctl.dataset.step, 1), fmt = ctl.dataset.fmt || "int";
    var major = num(ctl.dataset.major, 5);
    var floor = num(ctl.dataset.floor, NaN), nowV = num(ctl.dataset.now, NaN);
    var dnT = ctl.dataset.dn || "", upT = ctl.dataset.up || "";
    var val = num(ctl.dataset.val, min);
    var lbls = ctl.querySelector(".lbls"), tint = ctl.querySelector(".tint");
    var lo = ctl.querySelector(".lbl.lo"), hi = ctl.querySelector(".lbl.hi"), live = ctl.querySelector(".live");
    var mg = ctl.querySelector(".lbl.mg");

    function snap(v) { return Math.min(max, Math.max(min, Math.round(v / step) * step)); }
    function pxAt(v, size) { return size / 2 + (vert ? (val - v) : (v - val)) * px; }

    function paint() {
      var size = vert ? el.clientHeight : el.clientWidth;
      // Two layers, two periods: the short ticks shift by the unit pitch, the long ones by
      // their own — a shared phase would drift the majors off the numbers they mark.
      var raw = size / 2 - val * px;
      var phase = ((raw % px) + px) % px;
      var mp = px * major, phaseM = ((raw % mp) + mp) % mp;
      el.style.backgroundPosition = vert ? "100% " + phase + "px,100% " + phaseM + "px"
                                         : phase + "px 100%," + phaseM + "px 100%";
      // The window is a VALUE range — half a ruler of units each side of val — walked upward.
      // pxAt places it; walking by position would never end on a vertical ruler, where bigger
      // values sit at SMALLER offsets.
      var out = "", v = Math.ceil((val - size / 2 / px) / every) * every;
      for (; v <= val + size / 2 / px; v += every) {
        var at = pxAt(v, size);
        if (at < -4 || at > size + 4) continue;
        out += '<span class="lbl" style="' + (vert ? "top:" : "left:") + at + 'px">' + fmtVal(fmt, v) + "</span>";
      }
      if (lbls) lbls.innerHTML = out;
      if (tint && !isNaN(floor)) tint.style.width = Math.max(0, pxAt(floor, size)) + "px";
      // ieat-app#1201 — the needle is a marker too: every label keeps 6px from
      // the line, hugging the far side of its own mark — ends at mark - 6 when
      // anchored left of the needle, starts at mark + 6 on or right of it
      // (rulerMarkerBox, re-derived because a hashed literal cannot import it).
      var nX = size / 2;
      function mbox(x, w) { return x < nX ? [x - 6 - w, x - 6] : [x + 6, x + 6 + w]; }
      var loB = lo && !isNaN(floor) ? mbox(pxAt(floor, size), lo.offsetWidth) : null;
      var hiB = hi && !isNaN(nowV) ? mbox(pxAt(nowV, size), hi.offsetWidth) : null;
      // The ruler's mask fades its outer 60px and the needle is a wall a label never crosses
      // (#473): a marker's box clamps into the clear band on its own side of the line — 64px in
      // from the fade, 6px off the needle. When even that leaves no room — a mark near the edge
      // on a narrow ruler — the label steps down to the bare value ("62kg") rather than cross
      // the needle or sit in the fade.
      var padL = 64;
      var uw = ctl.dataset.unitword || "";
      function place(lbl, x, short) {
        // The full words come back every paint — a drag that gives the band room restores them.
        if (lbl.dataset.full === undefined) lbl.dataset.full = lbl.textContent;
        lbl.textContent = lbl.dataset.full;
        var w = lbl.offsetWidth, b = mbox(x, w);
        var loLim = x < nX ? padL : nX + 6;
        var hiLim = x < nX ? nX - 6 - w : size - padL - w;
        if (hiLim < loLim && short !== null) {
          lbl.textContent = short;
          w = lbl.offsetWidth; b = mbox(x, w);
          hiLim = x < nX ? nX - 6 - w : size - padL - w;
        }
        if (hiLim < loLim) {
          // Even the bare value has no band — the unclamped mark-side box, which mbox already
          // keeps on the far side of the needle.
          lbl.textContent = lbl.dataset.full;
          return b[0];
        }
        return Math.min(Math.max(b[0], loLim), hiLim);
      }
      var loL = null, hiL = null;
      if (loB) { loL = place(lo, pxAt(floor, size), fmtN(floor) + uw); lo.style.left = loL + "px"; }
      if (hiB) { hiL = place(hi, pxAt(nowV, size), fmtN(nowV) + uw); hi.style.left = hiL + "px"; }
      if (mg && loB && hiB) {
        // rulerMarkerLayout, re-derived the same way: marks within one tick
        // merge into .mg; the resolved boxes under 8px apart drop the floor
        // label to .r2; apart, both stay on the band's row.
        var merged = Math.abs(pxAt(floor, size) - pxAt(nowV, size)) <= px;
        var loR = loL + lo.offsetWidth, hiR = hiL + hi.offsetWidth;
        var stacked = !merged && loR + 8 > hiL && hiR + 8 > loL;
        mg.style.left = place(mg, pxAt(floor, size), fmtN(floor) + uw) + "px";
        mg.style.visibility = merged ? "visible" : "hidden";
        lo.style.visibility = hi.style.visibility = merged ? "hidden" : "visible";
        lo.className = "lbl lo" + (stacked ? " r2" : "");
      }
      if (live && !isNaN(nowV)) {
        var d = Math.round((val - nowV) * 10) / 10;
        var tpl = d < 0 ? dnT : d > 0 ? upT : null;
        live.style.display = tpl ? "" : "none";
        if (tpl) live.textContent = tpl.replace("{weight}", fmtN(Math.abs(d)) + (ctl.dataset.unitword || ""));
        live.className = "live" + (d < 0 ? " dn" : d > 0 ? " up" : "");
      }
      bigSet(ctl, fmt, val);
      inp.value = String(Math.round(val * 10) / 10);
      el.setAttribute("aria-valuenow", String(Math.round(val * 10) / 10));
    }

    var dragging = false, x0 = 0, v0 = 0;
    el.addEventListener("pointerdown", function (e) {
      dragging = true; x0 = vert ? e.clientY : e.clientX; v0 = val;
      el.setPointerCapture(e.pointerId); e.preventDefault();
    });
    el.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      var d = (vert ? e.clientY : e.clientX) - x0;
      // Vertical values grow upward: dragging down reveals the larger numbers above.
      val = snap(vert ? v0 + d / px : v0 - d / px);
      paint();
    });
    el.addEventListener("pointerup", function () { dragging = false; });
    el.addEventListener("wheel", function (e) {
      e.preventDefault();
      val = snap(val + (e.deltaY < 0 ? step : -step));
      paint();
    }, { passive: false });
    el.addEventListener("keydown", function (e) {
      var up = e.key === "ArrowUp" || e.key === "ArrowRight";
      var dn = e.key === "ArrowDown" || e.key === "ArrowLeft";
      if (!up && !dn) return;
      e.preventDefault(); val = snap(val + (up ? step : -step)); paint();
    });
    paint();
  });

  // ── the age wheel ────────────────────────────────────────────────────────────────────────────
  main.querySelectorAll("[data-ctl='wheel']").forEach(function (ctl) {
    var el = ctl.querySelector(".wheel");
    var inp = ctl.closest("form").querySelector("input[name='answer']");
    if (!el || !inp) return;
    var min = num(ctl.dataset.min, 10), val = num(ctl.dataset.val, min);
    var rows = el.children, H = 44;
    function idx() { return Math.round(el.scrollTop / H); }
    function sync(i) {
      for (var k = 0; k < rows.length; k++) rows[k].className = "wr" + (k === i ? " on" : "");
      val = min + i; inp.value = String(val);
      var bv = ctl.querySelector(".bv"); if (bv) bv.textContent = fmtN(val);
    }
    function toVal(v) { el.scrollTop = (v - min) * H; }
    toVal(val);
    var t;
    el.addEventListener("scroll", function () {
      clearTimeout(t);
      t = setTimeout(function () {
        var i = Math.max(0, Math.min(rows.length - 1, idx()));
        el.scrollTo({ top: i * H, behavior: RM ? "auto" : "smooth" });
        sync(i);
      }, 90);
    });
    el.addEventListener("click", function (e) {
      var r = e.target.closest ? e.target.closest(".wr") : null;
      if (!r) return;
      var i = Array.prototype.indexOf.call(rows, r);
      el.scrollTo({ top: i * H, behavior: RM ? "auto" : "smooth" });
      sync(i);
    });
    sync(Math.max(0, Math.min(rows.length - 1, val - min)));
  });

  // ── the pace slider ─────────────────────────────────────────────────────────────────────────
  main.querySelectorAll("[data-ctl='slider']").forEach(function (ctl) {
    var form = ctl.closest("form");
    var stops = ctl.querySelectorAll(".stops > div");
    var vars = ctl.querySelectorAll(".pacevar"), res = ctl.querySelectorAll(".paceres");
    var radios = form.querySelectorAll("input[name='answer']");
    var track = ctl.querySelector(".slider"), fill = ctl.querySelector(".slider i"), knob = ctl.querySelector(".slider b");
    if (!track || !radios.length) return;
    function pick(i) {
      i = Math.max(0, Math.min(stops.length - 1, i));
      for (var k = 0; k < stops.length; k++) {
        stops[k].className = k === i ? "on" : "";
        if (vars[k]) vars[k].className = "pacevar" + (k === i ? " on" : "");
        if (res[k]) res[k].className = "paceres" + (k === i ? " on" : "");
      }
      if (radios[i]) radios[i].checked = true;
      var x = track.clientWidth * i / (stops.length - 1);
      knob.style.left = x + "px";
      fill.style.width = x + "px";
    }
    for (var i = 0; i < stops.length; i++) (function (i) {
      stops[i].addEventListener("click", function () { pick(i); });
    })(i);
    var drag = false;
    function atX(e) {
      var r = track.getBoundingClientRect();
      var f = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
      pick(Math.round(f * (stops.length - 1)));
    }
    track.addEventListener("pointerdown", function (e) {
      drag = true; track.setPointerCapture(e.pointerId); atX(e);
    });
    track.addEventListener("pointermove", function (e) { if (drag) atX(e); });
    track.addEventListener("pointerup", function () { drag = false; });
    pick(num(ctl.dataset.val, 1));
  });

  // ── "none" clears the rest (medical) — the server applies the same rule on the wire ─────────
  var nones = main.querySelectorAll("input[type='checkbox'][name='answer'][value='none']");
  nones.forEach(function (none) {
    var box = none.closest("form");
    none.addEventListener("change", function () {
      if (!none.checked) return;
      box.querySelectorAll("input[name='answer']").forEach(function (c) {
        if (c !== none) c.checked = false;
      });
    });
    box.querySelectorAll("input[name='answer']").forEach(function (c) {
      if (c === none) return;
      c.addEventListener("change", function () { if (c.checked) none.checked = false; });
    });
  });

  // ── the country's live filter (16-country) — the GET ?q= does the same with no script ──────
  var ctySrch = main.querySelector(".cty .srch input");
  if (ctySrch) {
    var ctyRows = Array.prototype.slice.call(main.querySelectorAll(".cty .opt"));
    var fold = function (s) {
      // The backslash is doubled because this IS a template literal — the page's own JS regex
      // must read \p{M}, and an uncooked \p would reach the browser as plain p.
      return (s || "").toLowerCase().normalize("NFD").replace(/\\p{M}/gu, "");
    };
    ctySrch.addEventListener("input", function () {
      var q = fold(ctySrch.value).trim();
      ctyRows.forEach(function (row) {
        var code = row.querySelector("input[name='answer']").value;
        // "Somewhere else" stays: a filter that hid it would dead-end a real place. A hidden
        // checked row still posts its answer — hiding is not unchecking.
        var match = q === "" || code === "other" ||
          fold(row.textContent).indexOf(q) !== -1;
        row.classList.toggle("hide", !match);
      });
    });
  }

  // ── the unit toggle carries the draft across its POST ───────────────────────────────────────
  main.querySelectorAll("form.seg").forEach(function (seg) {
    seg.addEventListener("submit", function () {
      var q = main.querySelector("form.qform");
      var draft = seg.querySelector("input[name='draft']");
      var ans = q && q.querySelector("input[name='answer']");
      if (draft && ans) draft.value = ans.value;
      // The qform's hidden "units" is NOT touched: this POST navigates away, and a restored page
      // must keep the field at the system its toggle still shows.
    });
  });
})();`;
