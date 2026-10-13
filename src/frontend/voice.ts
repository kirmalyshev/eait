// The composer's mic (#570): the browser's own speech recognition.
//
// The button exists wherever `SpeechRecognition || webkitSpeechRecognition` exists (Kirill, 13 Oct:
// Chrome too). The audio goes to the browser vendor — Google in Chrome, Apple in Safari — which the
// privacy page says. Where the API is absent the composer is the plain one, no button, no hint.
//
// The words land in the composer's own field and go out only when she presses Send; the mic never
// sends. A stopped or interrupted transcript stays in the field. Two switches below keep Kirill's
// open questions (#570) one-line flips.
import { shellCopyFor } from "../shared/app/shell-copy.ts";
import { LANG_TAG } from "../shared/lang.ts";
import { el, lang } from "./shell.ts";

/** Where the mic sits: in the send round's slot while the field is empty, or beside Send always. */
export const MIC_SLOT: "replaces-send" | "beside-send" = "replaces-send";
/** `true` withholds the button from Chromium-engine browsers (their audio goes to Google). Off by Kirill's call. */
export const MIC_SAFARI_ONLY = false;

interface Recognition {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void;
}

function recognizer(): (new () => Recognition) | null {
  const w = window as unknown as Record<string, (new () => Recognition) | undefined>;
  const ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
  if (ctor === null) return null;
  // MIC_SAFARI_ONLY: every Chromium-engine UA carries "Chrome", "Edg", "OPR", "Android" or "FxiOS"; Safari's has none.
  if (MIC_SAFARI_ONLY && /chrome|chromium|crios|fxios|edg|opr|android/i.test(navigator.userAgent)) return null;
  return ctor;
}

/**
 * Add the mic to a composer whose `send` sits in `field` (the chat's `sendInside` row).
 * `armed()` is true when Send has something to send (words or attachments) — the mic then gives
 * the slot back; `onChange` is the caller's own redraw (it must call `sync`). Returns `sync`, to
 * call whenever `armed()` changes; `null` when there is no mic.
 */
export function attachMic(o: {
  form: HTMLElement; field: HTMLElement; words: HTMLInputElement | HTMLTextAreaElement; send: HTMLButtonElement;
  armed: () => boolean; onChange: () => void;
}): { sync: () => void; start: () => void } | null {
  const Ctor = recognizer();
  if (Ctor === null) return null;
  const { form, field, words, send } = o;
  const t = () => shellCopyFor(lang);
  const mic = el("button", "ib vmic") as HTMLButtonElement;
  mic.type = "button";
  const glyph = el("i", "ico i-mic");
  mic.append(glyph);
  const dot = el("i", "vmic-dot");
  dot.hidden = true;
  const note = el("div", "comp-note vmic-note");
  note.setAttribute("role", "status");
  note.hidden = true;
  field.append(dot, mic);
  field.classList.toggle("beside", MIC_SLOT === "beside-send");
  form.append(note);

  const placeholder = words.placeholder;
  let rec: Recognition | null = null;
  let denied = false;
  let heard = "";

  const say = (line: string | null): void => { note.textContent = line ?? ""; note.hidden = line === null; };
  const sync = (): void => {
    const listening = rec !== null;
    if (MIC_SLOT === "replaces-send") {
      const sending = !listening && o.armed();
      mic.hidden = sending;
      send.hidden = !sending;
    }
    mic.classList.toggle("p", listening);
    glyph.className = `ico i-${listening ? "stop" : denied ? "mic-off" : "mic"}`;
    mic.setAttribute("aria-label", listening ? t().composerMicStop : denied ? t().composerMicBlocked : t().composerMic);
    dot.hidden = !listening;
    field.classList.toggle("listening", listening);
    words.placeholder = listening && words.value === "" ? t().composerListening : placeholder;
  };
  const stop = (): void => { rec?.stop(); };
  const start = (): void => {
    say(null);
    const r = new Ctor();
    r.lang = LANG_TAG[lang];
    r.interimResults = true;
    r.continuous = false;
    heard = "";
    r.onresult = (e) => {
      heard = Array.from(e.results, (x) => x[0]?.transcript ?? "").join("").trim();
      words.value = heard;
      o.onChange();
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed") { denied = true; say(t().composerMicDenied); }
      else if (e.error === "no-speech") say(t().composerMicNothing);
      else if (e.error !== "aborted") say(t().composerMicUnavailable); // network, audio-capture, service-not-allowed
    };
    r.onend = () => {
      rec = null;
      if (heard === "" && note.hidden && !denied) say(t().composerMicNothing);
      o.onChange();
    };
    rec = r;
    denied = false;
    sync();
    try { r.start(); } catch { rec = null; sync(); }
  };

  mic.addEventListener("click", () => (rec === null ? start() : stop()));
  // Typing stops listening and keeps what is there; any keystroke clears the line under the composer.
  words.addEventListener("input", () => { say(null); stop(); });
  words.addEventListener("keydown", (e) => { if ((e as KeyboardEvent).key === "Escape") stop(); });
  sync();
  return { sync, start: () => { if (rec === null) start(); } };
}
