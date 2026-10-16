// The Nutrition goals page's words (ieat-app#914). BOARD: `parity_w3.rs` › `micros_page`. The
// macro names (Fibre, Sugar, Sodium) and the unit figures come from `home-copy.ts` — one spelling
// across Home and this page — so only the page's own sentences are here. `{v}` is a figure the
// caller already formatted with its unit ("25 g"), so the word order stays the language's.
//
// en + ru from the board; every other language falls back to en until the localizer pass
// (`~/eait-fleet/strings-914.md`).

import { t, type Lang, type Localized } from "../lang.ts";

export interface MicroGoalsCopy {
  title: string;
  label: string;
  atLeast: string;
  atMost: string;
  kidneyNote: string;
  foot: string;
}

export const MICRO_GOALS_COPY: Localized<MicroGoalsCopy> = {
  en: {
    title: "Nutrition goals",
    label: "Micronutrients",
    atLeast: "at least {v}",
    atMost: "at most {v}",
    kidneyNote: "Your kidney restriction sets this. A goal can't raise it.",
    foot: "Shown on Home's second page. No verdict comes from these.",
  },
  ru: {
    title: "Цели по питанию",
    label: "Микронутриенты",
    atLeast: "не менее {v}",
    atMost: "не более {v}",
    kidneyNote: "Это значение задаёт ограничение по почкам. Цель не может его превысить.",
    foot: "Показывается на второй странице главной. Оценок по ним нет.",
  },
};

export const microGoalsCopyFor = (lang: Lang): MicroGoalsCopy => t(lang)(MICRO_GOALS_COPY);
