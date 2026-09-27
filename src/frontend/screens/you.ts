// You — the account's screen (`#/you`), moved whole out of `main.ts` (#87): language, Telegram when
// the server names a bot, Sign out. The boards' Profile surface is W10's.

import { shellCopyFor } from "../../shared/app/shell-copy.ts";
import { LANGS_READY, LANG_LABEL } from "../../shared/lang.ts";
import type { Lang } from "../../shared/types.ts";
import type { PairCodeResponse, PatchProfileRequest, ProfileResponse } from "@eait/shared/contract";
import { api, signOut } from "../api.ts";
import { outbox } from "../outbox.ts";
import {
  COPY, el, forgetProfile, lang, render, setHeldProposal, setLastThread,
} from "../shell.ts";

/**
 * THE PICKER, on You — this client has no Settings screen, and You is the one the boards draw for
 * the account's controls. It writes through `PATCH /v1/profile`, the one path any surface uses, and
 * then RELOADS rather than re-rendering: `lang` is read by forty render functions and by
 * `profileCache`, and a reload is the one way to be sure none of them kept the old one.
 *
 * Only `LANGS_READY` is offered. A language whose every screen would fall back to English is one
 * where choosing it looks like a bug rather than like a missing translation.
 */
function languagePicker(): HTMLSelectElement {
  const picker = document.createElement("select");
  picker.className = "pick";
  picker.setAttribute("aria-label", COPY.language);
  for (const code of LANGS_READY) {
    const option = document.createElement("option");
    option.value = code;
    // The endonym, never translated: a list of languages written in the one you are leaving is the
    // one list you cannot read.
    option.textContent = LANG_LABEL[code];
    option.selected = code === lang;
    picker.append(option);
  }
  picker.addEventListener("change", () => {
    const chosen = picker.value as Lang;
    picker.disabled = true;
    void api<ProfileResponse>("/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lang: chosen } satisfies PatchProfileRequest),
    })
      .then(() => { location.reload(); })
      .catch((err: unknown) => {
        console.error(err);
        // Put the control back where the server still has it, so it never claims a language the
        // account does not hold.
        picker.value = lang;
        picker.disabled = false;
      });
  });
  return picker;
}

/** You (#52): the account's screen — language, Telegram when the server names a bot, Sign out. */
export function youScreen(me: ProfileResponse | null): HTMLElement {
  const wrap = el("section", "");
  // One h1 per page, and the boards draw no centred title on web — clipped, for the landmark.
  wrap.append(el("h1", "visually-hidden", shellCopyFor(lang).navProfile));
  const card = el("div", "card you");
  const lrow = el("div", "rowline");
  lrow.append(el("span", "when", COPY.language), languagePicker());
  card.append(lrow);
  const bot = me?.telegramBot ?? null;
  if (bot !== null) {
    // The code is minted at the TAP, not when the page is drawn: it lives five minutes, and the bot
    // has to receive it inside them. A navigation, so no CSP directive is involved in leaving.
    const tg = el("button", "you-act", COPY.connectTelegram) as HTMLButtonElement;
    tg.addEventListener("click", () => {
      tg.disabled = true;
      void api<PairCodeResponse>("/auth/pair", { method: "POST" })
        .then(({ code }) => { location.assign(`https://t.me/${bot}?start=${code}`); })
        .catch((err: unknown) => { console.error(err); tg.textContent = COPY.telegramFailed; })
        .finally(() => { tg.disabled = false; });
    });
    card.append(tg);
  }
  const out = el("button", "you-act", COPY.signOut) as HTMLButtonElement;
  out.addEventListener("click", () => {
    void (async () => {
      // The turns this browser was keeping are the account's, photos included: they do not stay
      // behind for whoever uses it next. First, so a sign-out the network refuses still takes them.
      // A storage that refuses (blocked, corrupt) must not keep the person signed in.
      await outbox.clear().catch(() => {});
      await signOut();
      forgetProfile();
      setHeldProposal(null);
      setLastThread([]);
      location.hash = "#/";
      await render();
    })();
  });
  card.append(out);
  wrap.append(card);
  return wrap;
}
