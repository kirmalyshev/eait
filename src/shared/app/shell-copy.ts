// The app shell's words — the one navigation both clients draw (#87): the boards' `eait` wordmark,
// then Home · Progress · Chat · Profile, with the round "+" between them that logs a meal.
//
// A TABLE IN shared rather than in a client's own copy, because the phone and the browser offer
// the same tabs by the same names and two tables would drift into two products. This is the first
// of the `app/*-copy.ts` surface tables (the plan's §B puts every surface's strings here): a
// record of words, `lang.ts` for the `Localized`/`t` plumbing, and nothing else, so the module a
// browser bundles by relative path stays small.

import { t, type Localized } from "../lang.ts";
import type { Lang } from "../types.ts";

export interface ShellCopy {
  /** The tabs, in the boards' order: Home · Progress · Chat · Profile. */
  navHome: string;
  navProgress: string;
  navChat: string;
  navProfile: string;
  /** The round "+" that logs a meal — its accessible name; the button itself is a glyph. */
  logMeal: string;
  /**
   * The coach's name, for every `{coach}` placeholder the surface tables carry. This is
   * `THREAD_COPY`'s `coach.name` — "Gabie" in all eight until S9 names the others — duplicated
   * here because the catalog is not on the browser bundle and a `{coach}` left unfilled prints
   * as a raw placeholder.
   */
  coachName: string;
}

export const SHELL_COPY: Localized<ShellCopy> = {
  en: {
    navHome: "Home",
    navProgress: "Progress",
    navChat: "Chat",
    navProfile: "Profile",
    logMeal: "Log a meal",
    coachName: "Gabie",
  },
  fr: {
    navHome: "Accueil",
    navProgress: "Progrès",
    navChat: "Chat",
    navProfile: "Profil",
    logMeal: "Enregistrer un repas",
    coachName: "Gabie",
  },
  de: {
    navHome: "Start",
    navProgress: "Fortschritt",
    navChat: "Chat",
    navProfile: "Profil",
    logMeal: "Mahlzeit eintragen",
    coachName: "Gabie",
  },
  it: {
    navHome: "Home",
    navProgress: "Progressi",
    navChat: "Chat",
    navProfile: "Profilo",
    logMeal: "Registra un pasto",
    coachName: "Gabie",
  },
  es: {
    navHome: "Inicio",
    navProgress: "Progreso",
    navChat: "Chat",
    navProfile: "Perfil",
    logMeal: "Registrar una comida",
    coachName: "Gabie",
  },
  vi: {
    navHome: "Trang chủ",
    navProgress: "Tiến độ",
    navChat: "Chat",
    navProfile: "Hồ sơ",
    logMeal: "Ghi một bữa ăn",
    coachName: "Gabie",
  },
  id: {
    navHome: "Beranda",
    navProgress: "Progres",
    navChat: "Chat",
    navProfile: "Profil",
    logMeal: "Catat makanan",
    coachName: "Gabie",
  },
  ru: {
    navHome: "Главная",
    navProgress: "Прогресс",
    navChat: "Чат",
    navProfile: "Профиль",
    logMeal: "Записать приём пищи",
    coachName: "Gabie",
  },
};

export const shellCopyFor = (lang: Lang): ShellCopy => t(lang)(SHELL_COPY);
