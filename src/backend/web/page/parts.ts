// The fragments more than one screen draws: Spud's mark, his typed lines, the slim top bar.

import { spudSvg } from "@eait/shared/mascot";
import type { Lang } from "@eait/shared";
import { pageCopyFor, type PageCopy } from "../copy.ts";
import { escape } from "./shell.ts";

export const spud = (lang: Lang): string =>
  `<div class="spud" role="img" aria-label="${escape(pageCopyFor(lang).spudAlt)}">${spudSvg("wave", "spud-start")}</div>`;

export const bubbles = (lines: readonly string[]): string =>
  lines.map((line) => `<p class="bubble typed">${escape(line)}</p>`).join("");

/** A question's lines, the last — the question itself — as the page's one h1 (#53). */
export const askBubbles = (lines: readonly string[]): string =>
  lines.map((line, i) => i === lines.length - 1
    ? `<h1 class="bubble typed">${escape(line)}</h1>`
    : `<p class="bubble typed">${escape(line)}</p>`).join("");

/** The design's slim top bar: the wordmark, and the reassurance that the phone can take over. */
export const topBar = (PAGE_COPY: PageCopy): string =>
  `<div class="wbar"><strong>eait</strong><small>${escape(PAGE_COPY.topBarNote)}</small></div>`;
