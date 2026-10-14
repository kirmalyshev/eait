// The food search's words (#909): the + chooser's Search tile and the search screen both clients
// draw — the field, Cancel/Done, the "Logging to" line, a row's names, the failure lines and the
// "Tell {coach}" row. A table in shared for the same reason `shell-copy.ts` is one: the phone and
// the browser ask the same thing by the same words. `{coach}` is the coach's own name from
// `threadCopyFor(lang).coach.name`, never typed here, and a sentence is one template per language.

import { t, type Localized } from "../lang.ts";
import type { FoodRef } from "../foods.ts";
import type { Lang } from "../types.ts";
import { FOOD_LOG_DEFAULT_GRAMS } from "../foods.ts";

export interface FoodSearchCopy {
  /** The + chooser's Search tile. */
  plusSearch: string;
  /** The field's placeholder, and its accessible name. */
  placeholder: string;
  clear: string;
  cancel: string;
  /** Replaces Cancel once something was logged. */
  done: string;
  /** `{day}` (today's word or a short date) and `{left}` kcal — the line under the field. */
  logging: string;
  today: string;
  /** `{name}` — a row's round + (accessible name). */
  log: string;
  /** `{name}` — the same round once it logged. */
  logged: string;
  /** `{label}` the serving ("1 medium · 118 g") and `{kcal}` — a row's second line. */
  serving: string;
  /** The serving's label when the source names none. */
  hundredGrams: string;
  /** The red line under a row whose + did not land. */
  logFailed: string;
  /** The search failed; the field keeps the words. Followed by the `retry` link. */
  searchFailed: string;
  retry: string;
  /** `{q}` — the muted line when the catalog has nothing. */
  noMatch: string;
  /** `{coach}` and `{q}` — the last row, always there. */
  tell: string;
  /** `{coach}` — the row's second line. */
  tellSub: string;
}

export const FOOD_SEARCH_COPY: Localized<FoodSearchCopy> = {
  en: {
    plusSearch: "Search",
    placeholder: "Search or describe a meal",
    clear: "Clear",
    cancel: "Cancel",
    done: "Done",
    logging: "Logging to {day} · {left} kcal left",
    today: "today",
    log: "Log {name}",
    logged: "Logged: {name}",
    serving: "{label} · {kcal} kcal",
    hundredGrams: "100 g",
    logFailed: "Couldn't log that. Tap + to try again.",
    searchFailed: "Couldn't search. Your words are still here —",
    retry: "Try again",
    noMatch: "Nothing in the food list for “{q}”.",
    tell: "Tell {coach}: “{q}”",
    tellSub: "{coach} works out what's in it, in Chat.",
  },
  de: {
    plusSearch: "Suchen",
    placeholder: "Suchen oder eine Mahlzeit beschreiben",
    clear: "Löschen",
    cancel: "Abbrechen",
    done: "Fertig",
    logging: "Eintrag für {day} · noch {left} kcal",
    today: "heute",
    log: "{name} eintragen",
    logged: "Eingetragen: {name}",
    serving: "{label} · {kcal} kcal",
    hundredGrams: "100 g",
    logFailed: "Das hat nicht geklappt. Tippe auf +, um es noch einmal zu versuchen.",
    searchFailed: "Die Suche hat nicht geklappt. Deine Worte stehen noch da —",
    retry: "Nochmal versuchen",
    noMatch: "Nichts in der Lebensmittelliste für „{q}“.",
    tell: "{coach} fragen: „{q}“",
    tellSub: "{coach} findet heraus, was drin ist – im Chat.",
  },
  fr: {
    plusSearch: "Chercher",
    placeholder: "Cherche ou décris un repas",
    clear: "Effacer",
    cancel: "Annuler",
    done: "Terminé",
    logging: "Ajout à {day} · encore {left} kcal",
    today: "aujourd’hui",
    log: "Ajouter {name}",
    logged: "Ajouté : {name}",
    serving: "{label} · {kcal} kcal",
    hundredGrams: "100 g",
    logFailed: "Impossible de l’ajouter. Touche + pour réessayer.",
    searchFailed: "Recherche impossible. Tes mots sont toujours là —",
    retry: "Réessayer",
    noMatch: "Rien dans la liste d’aliments pour « {q} ».",
    tell: "Dis à {coach} : « {q} »",
    tellSub: "{coach} trouve ce qu’il y a dedans, dans le Chat.",
  },
  it: {
    plusSearch: "Cerca",
    placeholder: "Cerca o descrivi un pasto",
    clear: "Cancella",
    cancel: "Annulla",
    done: "Fine",
    logging: "Registro su {day} · restano {left} kcal",
    today: "oggi",
    log: "Aggiungi {name}",
    logged: "Aggiunto: {name}",
    serving: "{label} · {kcal} kcal",
    hundredGrams: "100 g",
    logFailed: "Non è stato possibile aggiungerlo. Tocca + per riprovare.",
    searchFailed: "Ricerca non riuscita. Le tue parole sono ancora qui —",
    retry: "Riprova",
    noMatch: "Niente nell’elenco degli alimenti per “{q}”.",
    tell: "Dillo a {coach}: “{q}”",
    tellSub: "{coach} scopre cosa c’è dentro, in Chat.",
  },
  es: {
    plusSearch: "Buscar",
    placeholder: "Busca o describe una comida",
    clear: "Borrar",
    cancel: "Cancelar",
    done: "Listo",
    logging: "Registrando en {day} · te quedan {left} kcal",
    today: "hoy",
    log: "Añadir {name}",
    logged: "Añadido: {name}",
    serving: "{label} · {kcal} kcal",
    hundredGrams: "100 g",
    logFailed: "No se pudo añadir. Toca + para intentarlo de nuevo.",
    searchFailed: "No se pudo buscar. Tus palabras siguen aquí —",
    retry: "Reintentar",
    noMatch: "No hay nada en la lista de alimentos para «{q}».",
    tell: "Cuéntaselo a {coach}: «{q}»",
    tellSub: "{coach} averigua qué lleva, en el Chat.",
  },
  vi: {
    plusSearch: "Tìm",
    placeholder: "Tìm hoặc mô tả một bữa ăn",
    clear: "Xóa",
    cancel: "Hủy",
    done: "Xong",
    logging: "Ghi vào {day} · còn {left} kcal",
    today: "hôm nay",
    log: "Ghi {name}",
    logged: "Đã ghi: {name}",
    serving: "{label} · {kcal} kcal",
    hundredGrams: "100 g",
    logFailed: "Không ghi được. Chạm + để thử lại.",
    searchFailed: "Không tìm được. Lời bạn gõ vẫn còn đây —",
    retry: "Thử lại",
    noMatch: "Không có gì trong danh sách thực phẩm cho “{q}”.",
    tell: "Nói với {coach}: “{q}”",
    tellSub: "{coach} tìm hiểu bên trong có gì, trong Chat.",
  },
  id: {
    plusSearch: "Cari",
    placeholder: "Cari atau jelaskan makanan",
    clear: "Hapus",
    cancel: "Batal",
    done: "Selesai",
    logging: "Dicatat ke {day} · sisa {left} kcal",
    today: "hari ini",
    log: "Catat {name}",
    logged: "Tercatat: {name}",
    serving: "{label} · {kcal} kcal",
    hundredGrams: "100 g",
    logFailed: "Tidak bisa dicatat. Ketuk + untuk coba lagi.",
    searchFailed: "Pencarian gagal. Kata-katamu masih di sini —",
    retry: "Coba lagi",
    noMatch: "Tidak ada di daftar makanan untuk “{q}”.",
    tell: "Beri tahu {coach}: “{q}”",
    tellSub: "{coach} mencari tahu isinya, di Chat.",
  },
  ru: {
    plusSearch: "Поиск",
    placeholder: "Найди или опиши приём пищи",
    clear: "Очистить",
    cancel: "Отмена",
    done: "Готово",
    logging: "Запись на {day} · осталось {left} ккал",
    today: "сегодня",
    log: "Записать: {name}",
    logged: "Записано: {name}",
    serving: "{label} · {kcal} ккал",
    hundredGrams: "100 г",
    logFailed: "Не получилось записать. Нажми +, чтобы попробовать ещё раз.",
    searchFailed: "Поиск не удался. Твои слова на месте —",
    retry: "Ещё раз",
    noMatch: "В списке продуктов нет «{q}».",
    tell: "Скажи {coach}: «{q}»",
    tellSub: "{coach} разберётся, что там, в Чате.",
  },
};

export const foodSearchCopyFor = (lang: Lang): FoodSearchCopy => t(lang)(FOOD_SEARCH_COPY);

/** A catalog row the app may offer: the server logs a row only when all four macros are present. */
export const isLoggableFood = (f: FoodRef): boolean =>
  f.kcal_per_100g !== null && f.protein_g_per_100g !== null && f.carbs_g_per_100g !== null && f.fat_g_per_100g !== null;

/**
 * What one tap logs: the source's first NAMED serving, else 100 g. `label` is the source's own
 * words for it (null on the 100 g fallback — the client says "100 g" in its language), `kcal` is
 * `per-100 g × grams` rounded ONCE, which is the figure the server then writes.
 */
export function foodLogChoice(f: FoodRef): { grams: number; label: string | null; kcal: number } {
  const p = f.portions.find((x) => x.grams > 0);
  const grams = p ? Math.max(1, Math.round(p.grams)) : FOOD_LOG_DEFAULT_GRAMS;
  return { grams, label: p ? `${p.label} · ${grams} g` : null, kcal: Math.round(((f.kcal_per_100g ?? 0) * grams) / 100) };
}
