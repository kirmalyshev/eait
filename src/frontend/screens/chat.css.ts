// Chat's own styles — the boards' transcript (`web/chat*.html`, `states-*.html`; pro.css's
// `.thread`/`.me`/`.them`/`.ts`/`.mb` measurements verbatim). What the boards share — the
// composer row, `.ib`, `.bar`, the type helpers, `.card` — is `shell.css.ts`'s; the kit's `.say`,
// `.spud`, `.gname`, `.macs`, `.vs`, `.opt`, `.card.flat`, `.hero`, `.stamp` arrive from
// `kitCss()`; the verbs (`rise`, `grow`) are `motionCss`'s.

import { MOTION } from "../../shared/design.ts";

export const chatCss = `
/* The column: the thread scrolls under a bottom-anchored stack — \`li:first-child\`'s margin is
   the reliable bottom-anchor (a scrolling flex container's justify-content:flex-end strands the
   top). The boards stagger the lines' rise by .1s; the generated classes carry the delay. */
.chat { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.thread-holder { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.thread { list-style: none; margin: 0; padding: 0; flex: 1; min-height: 0; overflow-y: auto;
  display: flex; flex-direction: column; gap: 12px; }
.thread > li:first-child { margin-top: auto; }
${Array.from({ length: 14 }, (_, i) => `.thread .dly-${i} { --d: ${i * MOTION.stagger}ms; }`).join("\n")}

/* #1520 — Telegram's bubbles on the kit's tokens. Both sides are bubbles: hers on the accent tint at
   the right, Spud's on --chat-bubble at the left, radius 17. A run of one side's lines is a group:
   2 px apart (8 when the side changes), inner corners 6, the tail and his face on the run's LAST
   line only — drawn from the siblings, so a row never needs to know its neighbours. The time sits
   inside, bottom-right, sharing the last line when it fits. Starter and suggestion cards are not
   bubbles and do not break his run's face. */
.chat { background: var(--chat-ground); }
.thread { gap: 2px; padding: 8px 12px 4px; }
.thread > li.me + li.them, .thread > li.them + li.me { margin-top: 8px; }
.thread > li.me { display: block; }
.me { align-self: flex-end; max-width: min(78%, 480px); background: var(--accent-tint); color: var(--ink);
  border-radius: 17px; padding: 6px 12px 7px; font-weight: 500; position: relative; --muted: var(--me-muted);
  box-shadow: 0 1px 1px rgba(23, 25, 28, .10); }
.me .said { display: inline; margin: 0; }
.me.mealb, .me.failed, .me.refused, .me.pending { width: min(80%, 360px); }
.me.mealb .card { width: auto; background: none; box-shadow: none; padding: 6px 0 0; margin: 0; }
.me .hero { display: block; width: auto; aspect-ratio: 4 / 3; margin: -3px -9px 6px; border-radius: 14px 14px 6px 6px;
  overflow: hidden; background: var(--hair); }
.me .hero img { width: 100%; height: 100%; object-fit: cover; display: block; }
.me .cap { margin: 0; font-size: 15px; }
.them { align-self: flex-start; max-width: min(86%, 560px); }
.them p { margin: 0; }
.say { display: flex; gap: 6px; align-items: flex-end; }
.say > .bub { flex: 1; min-width: 0; background: var(--chat-bubble); border-radius: 17px; padding: 6px 12px 7px;
  position: relative; box-shadow: 0 1px 1px rgba(23, 25, 28, .07); }
.say .spud { width: 28px; height: 28px; flex: 0 0 28px; }
.say .say-p, .say .saytitle { display: inline; }
.say .say-hi { font-size: 19px; }
.say .saytitle { font-weight: 400; font-size: inherit; }
.ts { font-size: 11px; color: var(--muted); font-weight: 500; float: right; line-height: 20px;
  margin: 0 -2px 0 10px; position: relative; top: 5px; }
.me .ts { color: var(--accent); }
.me.mealb .ts, .me.failed .ts, .me.refused .ts, .me.pending .ts, .them .mb + .say-p + .ts { float: none; top: 0; margin: 4px 0 0; text-align: right; }

/* the run: inner corners, his face only on the last of his bubbles, the tails */
.thread > li.me:has(+ li.me) { border-bottom-right-radius: 6px; }
.thread > li.me + li.me { border-top-right-radius: 6px; }
.thread > li.them:has(+ li.them:not(.opts, .sug)) .bub { border-bottom-left-radius: 6px; }
.thread > li.them + li.them .bub { border-top-left-radius: 6px; }
.thread > li.them:has(+ li.them:not(.opts, .sug)) .spud { visibility: hidden; }
.thread > li.me:not(:has(+ li.me)) { border-bottom-right-radius: 0; }
.thread > li.me:not(:has(+ li.me))::after { content: ""; position: absolute; right: -7px; bottom: 0; width: 8px; height: 14px;
  background: inherit; mask: radial-gradient(8px 14px at 100% 0, transparent 98%, #000 100%); }
.thread > li.them:not(:has(+ li.them:not(.opts, .sug))) .bub { border-bottom-left-radius: 0; }
.thread > li.them:not(:has(+ li.them:not(.opts, .sug))) .bub::after { content: ""; position: absolute; left: -7px; bottom: 0;
  width: 8px; height: 14px; background: inherit; mask: radial-gradient(8px 14px at 0 0, transparent 98%, #000 100%); }

/* what happened to her send, on her bubble: pending is a clock, refused the reason inside, failed
   the red ! beside it (a 44 px button, 22 px face) whose popover is Resend / Delete */
.me .dl { display: flex; gap: 5px; align-items: center; font-size: 12px; font-weight: 600; color: var(--bad); margin-top: 6px; }
.me.pending .dl { color: var(--muted); }
.me .dl .ico { width: 14px; height: 14px; }
.me .act { display: flex; align-items: flex-end; gap: 8px; margin-top: 8px; }
.me .act > .ts { margin: 0 0 0 auto; }
.me .act .cta { margin: 0; }
.me.mealb .card > .row.between > b:empty { display: none; }
.me .cta.s { background: var(--surface); }
.bangw { position: absolute; left: -44px; top: 50%; transform: translateY(-50%); }
.bang { width: 44px; height: 44px; border: 0; background: none; padding: 11px; cursor: pointer; font: 700 14px/22px inherit;
  color: var(--chat-ground); }
.bang::before { content: "!"; display: block; width: 22px; height: 22px; border-radius: 50%; background: var(--bad);
  color: var(--chat-ground); font-weight: 700; font-size: 14px; text-align: center; line-height: 22px; }
.bang { font-size: 0; }
.failmenu { border: 0; border-radius: 14px; padding: 8px; background: var(--surface); box-shadow: var(--shadow, 0 8px 24px rgba(0,0,0,.2));
  display: none; gap: 8px; flex-direction: column; min-width: 220px; }
.failmenu:popover-open { display: flex; }
.failmenu .cta.bad { color: var(--bad); }

/* focus mode: her meal, with the × that leaves it */
.focus-meal .fx { position: absolute; right: 6px; top: 6px; width: 44px; height: 44px; background: none; box-shadow: none; }

/* the composer, Telegram's three: the paperclip bare, the field a pill whose prompt ends in an
   ellipsis instead of wrapping, send a filled circle */
.chat .compose .ib:first-child { background: none; box-shadow: none; }
.chat .compose .ib:first-child .ico { color: var(--muted); }
.chat .compose textarea.box::placeholder { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* The proposal ("chat-proposal"): aligned with the say column, the question over the card. */
.prop .pl-lead { font-weight: 600; margin: 0 0 6px 2px; }
.prop .pl-expired { margin: 10px 0 0 2px; font-weight: 500; }
.prop .card { margin-bottom: 0; }
.prop .pl-macs { margin-top: 10px; }
.prop .pl-actions { gap: 8px; margin-top: 10px; }
.prop .cta { min-height: 46px; font-size: 15px; }
.prop .pl-name { font-weight: 600; }
.prop .num.row { gap: 5px; }
.prop .num.row .ico { width: 18px; height: 18px; }

/* The diary's proposal (web/today-logging, #260): the card IS the offer — the question is its
   .lab inside it, a hairline row per ingredient under the name, the sat-fat chip joins the macro
   row as plain muted text, the turn's time rides the verdicts row, and the answers sit inside. */
.prop.day .card > .lab { display: block; }
.prop.day .pl-head { margin: 8px 0 10px; }
.prop.day .pl-title { font-size: 19px; }
.prop.day .pl-ing { padding: 8px 0; border-top: 1px solid var(--hair); font-weight: 500; }
.prop.day .pl-ing .m { font-weight: 400; }
.prop.day .pl-igk { font-weight: 600; }
.prop.day .mac.m { font-weight: 500; }
.prop.day .pl-when { margin-left: auto; }
.prop.day .pl-expired { margin-left: 0; }
.prop.day .pl-actions { gap: 10px; margin-top: 14px; }
.prop.day .pl-actions .cta.s { flex: 0 0 120px; }
.prop.day .pl-actions .cta.p { flex: 1; }

/* The starter and suggestion rows — the boards' .card.flat of .opt rows, indented to the
   say column, each with its icon and the chevron where .opt's check disc would sit. */
.opts, .sug { align-self: flex-start; width: calc(100% - 38px); max-width: 560px; margin-left: 38px; }
.opts .card.flat, .sug .card.flat { padding: 2px 16px; margin-bottom: 0; }
.opts .opt, .sug .opt { font-size: 15px; padding: 13px 0; gap: 12px; }
.opts .opt .ico, .sug .opt .ico { width: 20px; height: 20px; }
.opts .opt .chv, .sug .opt .chv { width: 18px; height: 18px; margin-left: auto; color: var(--faint); }
.opts .opt .ck, .sug .opt .ck { display: none; }

/* The coach bar's own spacing: name row at 13/600, the eaten figure at 17/700. */
.mb .mb-name { gap: 6px; }
.mb .mb-num b { color: var(--ink); font-weight: 700; font-size: 17px; }
.est { color: var(--warn); font-weight: 600; }

/* The kept line's resend — the boards' small secondary, inline under the words. The board draws
   40 px; the app's tap floor is 44 (the a11y gate measures the box), so the floor wins the pixel. */
.cta.s.sm { width: auto; display: inline-flex; min-height: 44px; padding: 0 16px; font-size: 14px;
  margin-top: 10px; gap: 6px; }
.cta.s.sm .ico { width: 16px; height: 16px; }

/* The focus sheet's card thumbnail (web/meal-edit.html): the meal's own photo at 52px. */
.f-thumb { width: 52px; height: 52px; flex: 0 0 52px; border-radius: var(--r-thumb); object-fit: cover;
  background: var(--hair); margin-right: 4px; }
.frow { display: flex; gap: 10px; align-items: flex-start; }
.fcol { flex: 1; min-width: 0; }

/* The load failure ("states-chat-failed"): the coach's line centred in the column's room. */
.chatfail { flex: 1; display: flex; align-items: center; justify-content: center; }
`;
