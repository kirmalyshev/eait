// Chat's own styles — the boards' transcript (`web/chat*.html`, `states-*.html`; pro.css's
// `.thread`/`.me`/`.them`/`.ts`/`.mb` measurements verbatim). What the boards share — the
// composer row, `.ib`, `.bar`, the type helpers, `.card` — is `shell.css.ts`'s; the kit's `.say`,
// `.gabie`, `.gname`, `.macs`, `.vs`, `.opt`, `.card.flat`, `.hero`, `.stamp` arrive from
// `kitCss()`; the verbs (`rise`, `grow`) are `motionCss`'s.

export const chatCss = `
/* The column: the thread scrolls under a bottom-anchored stack — \`li:first-child\`'s margin is
   the reliable bottom-anchor (a scrolling flex container's justify-content:flex-end strands the
   top). The boards stagger the lines' rise by .1s; the generated classes carry the delay. */
.chat { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.thread-holder { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.thread { list-style: none; margin: 0; padding: 0; flex: 1; min-height: 0; overflow-y: auto;
  display: flex; flex-direction: column; gap: 12px; }
.thread > li:first-child { margin-top: auto; }
${Array.from({ length: 14 }, (_, i) => `.thread .dly-${i} { --d: ${(i * 0.1).toFixed(1)}s; }`).join("\n")}

/* The lines: mine right in the accent tint, the app's left — and a photo's own bubble is the
   hero, corners 12/9 px, its stamp inside. */
.me { align-self: flex-end; max-width: 78%; background: var(--accent-tint); color: var(--ink);
  border-radius: 14px; border-bottom-right-radius: 4px; padding: 10px 14px; font-weight: 500; }
.me .ts { text-align: right; }
.me.dim { opacity: .55; }
.me.pic { padding: 4px; border-radius: 12px; }
.me.pic .hero { width: min(200px, 58vw); aspect-ratio: 4 / 3; border-radius: 9px; }
.me.pic .cap { margin: 0; padding: 6px 10px 4px; font-size: 14px; }
.them { align-self: flex-start; max-width: 86%; }
.them .card { padding: 14px; margin-bottom: 0; }
.them p { margin: 0; }
.ts { font-size: 12px; color: var(--muted); font-weight: 500; margin-top: 4px; }

/* Gabie's say block: the spacer keeps the words' column where no disc is asked for. */
.say > div { flex: 1; min-width: 0; }
.say .saygap { width: 28px; flex: 0 0 28px; }
.say .say-p { margin: 0; }
.say .say-hi { font-size: 19px; }
.say .saytitle { font-weight: 600; font-size: 15px; line-height: 1.35; margin: 0; }
.say .row { gap: 6px; }
.say .t13 { margin-top: 3px; }

/* The proposal ("chat-proposal"): aligned with the say column, the question over the card. */
.prop-li { align-self: flex-start; width: 100%; max-width: 560px; margin-left: 38px; }
.prop .pl-lead { font-weight: 600; margin: 0 0 6px 2px; }
.prop .pl-expired { margin: 10px 0 0 2px; font-weight: 500; }
.prop .card { margin-bottom: 0; }
.prop .pl-macs { margin-top: 10px; }
.prop .pl-actions { gap: 8px; margin-top: 10px; }
.prop .cta { min-height: 46px; font-size: 15px; }
.prop .pl-name { font-weight: 600; }
.prop .num.row { gap: 5px; }
.prop .num.row .ico { width: 18px; height: 18px; }

/* The starter and suggestion rows — the boards' .card.flat of .opt rows, indented to the
   say column, each with its icon and the chevron where .opt's check disc would sit. */
.opts, .sug { align-self: flex-start; width: 100%; max-width: 560px; margin-left: 38px; }
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
.f-thumb { width: 52px; height: 52px; flex: 0 0 52px; border-radius: 8px; object-fit: cover;
  background: var(--hair); margin-right: 4px; }
.frow { display: flex; gap: 10px; align-items: flex-start; }
.fcol { flex: 1; min-width: 0; }

/* The load failure ("states-chat-failed"): Gabie's line centred in the column's room. */
.chatfail { flex: 1; display: flex; align-items: center; justify-content: center; }
`;
