// The typed-numbers form's words (#2088): the + chooser's Numbers tile, the search screen's "Enter
// numbers" row and the form both clients draw. A table in shared for the reason `shell-copy.ts` is
// one. Nutrient names are the plain consumer word; units come from `spellUnit`/`UNIT_KCAL`. No
// macro-vs-kcal hint exists, by decision (Kirill, 14 Oct 00:05).

import { t, type Localized } from "../lang.ts";
import type { Lang } from "../types.ts";

export interface NumbersCopy {
  /** The + chooser's Numbers tile. */
  plusNumbers: string;
  /** The form's title and the search row's title. */
  enter: string;
  /** The search row's second line with an empty field. */
  rowEmpty: string;
  /** `{q}` — the same line once she has typed a query. */
  rowNamed: string;
  /** The name field's placeholder and accessible name. */
  name: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  /** The heading over the four optional rows. */
  optional: string;
  satfat: string;
  fibre: string;
  sugar: string;
  sodium: string;
  /** The form's button. */
  cta: string;
  /** Under the form when a required number is missing. */
  needed: string;
  /** Under the form when the save did not land; the numbers stay. */
  failed: string;
}

export const NUMBERS_COPY: Localized<NumbersCopy> = {
  en: {
    plusNumbers: "Numbers",
    enter: "Enter numbers",
    rowEmpty: "Name, calories and macros, typed.",
    rowNamed: "“{q}”, with its numbers typed in.",
    name: "Name",
    calories: "Calories",
    protein: "Protein",
    carbs: "Carbs",
    fat: "Fat",
    optional: "Optional",
    satfat: "Saturated fat",
    fibre: "Fibre",
    sugar: "Sugar",
    sodium: "Sodium",
    cta: "Log it",
    needed: "Calories, protein, carbs and fat are needed to log it.",
    failed: "Couldn't log that. Your numbers are still here — try again.",
  },
  de: {
    plusNumbers: "Zahlen",
    enter: "Zahlen eingeben",
    rowEmpty: "Name, Kalorien und Makros, eingetippt.",
    rowNamed: "„{q}“, mit eingetippten Zahlen.",
    name: "Name",
    calories: "Kalorien",
    protein: "Eiweiß",
    carbs: "Kohlenhydrate",
    fat: "Fett",
    optional: "Optional",
    satfat: "Gesättigte Fettsäuren",
    fibre: "Ballaststoffe",
    sugar: "Zucker",
    sodium: "Natrium",
    cta: "Eintragen",
    needed: "Zum Eintragen brauchst du Kalorien, Eiweiß, Kohlenhydrate und Fett.",
    failed: "Eintragen hat nicht geklappt. Deine Eingaben sind noch da — versuch es nochmal.",
  },
  fr: {
    plusNumbers: "Chiffres",
    enter: "Saisir les chiffres",
    rowEmpty: "Nom, calories et macros, saisis à la main.",
    rowNamed: "« {q} », avec ses chiffres saisis.",
    name: "Nom",
    calories: "Calories",
    protein: "Protéines",
    carbs: "Glucides",
    fat: "Lipides",
    optional: "Facultatif",
    satfat: "Graisses saturées",
    fibre: "Fibres",
    sugar: "Sucres",
    sodium: "Sodium",
    cta: "Enregistrer",
    needed: "Calories, protéines, glucides et lipides sont nécessaires pour enregistrer.",
    failed: "Impossible d’enregistrer. Ce que tu as saisi est toujours là — réessaie.",
  },
  it: {
    plusNumbers: "Numeri",
    enter: "Inserisci i numeri",
    rowEmpty: "Nome, calorie e macro, scritti a mano.",
    rowNamed: "«{q}», con i numeri scritti a mano.",
    name: "Nome",
    calories: "Calorie",
    protein: "Proteine",
    carbs: "Carboidrati",
    fat: "Grassi",
    optional: "Facoltativo",
    satfat: "Grassi saturi",
    fibre: "Fibre",
    sugar: "Zuccheri",
    sodium: "Sodio",
    cta: "Registra",
    needed: "Servono calorie, proteine, carboidrati e grassi per registrare.",
    failed: "Impossibile registrare. Quello che hai inserito è ancora qui — riprova.",
  },
  es: {
    plusNumbers: "Números",
    enter: "Escribir números",
    rowEmpty: "Nombre, calorías y macros, que escribes tú.",
    rowNamed: "«{q}», con los números que escribas.",
    name: "Nombre",
    calories: "Calorías",
    protein: "Proteínas",
    carbs: "Carbohidratos",
    fat: "Grasas",
    optional: "Opcional",
    satfat: "Grasas saturadas",
    fibre: "Fibra",
    sugar: "Azúcar",
    sodium: "Sodio",
    cta: "Registrar",
    needed: "Se necesitan calorías, proteínas, carbohidratos y grasas para registrar.",
    failed: "No se pudo registrar. Lo que escribiste sigue aquí — inténtalo de nuevo.",
  },
  ru: {
    plusNumbers: "Цифры",
    enter: "Ввести цифры",
    rowEmpty: "Название, калории и БЖУ — вручную.",
    rowNamed: "«{q}», цифры вручную.",
    name: "Название",
    calories: "Калории",
    protein: "Белки",
    carbs: "Углеводы",
    fat: "Жиры",
    optional: "Необязательно",
    satfat: "Насыщенные жиры",
    fibre: "Клетчатка",
    sugar: "Сахар",
    sodium: "Натрий",
    cta: "Записать",
    needed: "Для записи нужны калории, белки, углеводы и жиры.",
    failed: "Не удалось записать. Всё введённое на месте — попробуй ещё раз.",
  },
  id: {
    plusNumbers: "Angka",
    enter: "Masukkan angka",
    rowEmpty: "Nama, kalori, dan makro, diketik sendiri.",
    rowNamed: "“{q}”, dengan angka yang diketik.",
    name: "Nama",
    calories: "Kalori",
    protein: "Protein",
    carbs: "Karbohidrat",
    fat: "Lemak",
    optional: "Opsional",
    satfat: "Lemak jenuh",
    fibre: "Serat",
    sugar: "Gula",
    sodium: "Natrium",
    cta: "Catat",
    needed: "Kalori, protein, karbohidrat, dan lemak diperlukan untuk mencatat.",
    failed: "Tidak bisa dicatat. Isianmu masih ada — coba lagi.",
  },
  vi: {
    plusNumbers: "Số liệu",
    enter: "Nhập số liệu",
    rowEmpty: "Tên, calo và macro, tự nhập.",
    rowNamed: "“{q}”, tự nhập số liệu.",
    name: "Tên",
    calories: "Calo",
    protein: "Chất đạm",
    carbs: "Carb",
    fat: "Chất béo",
    optional: "Không bắt buộc",
    satfat: "Chất béo bão hòa",
    fibre: "Chất xơ",
    sugar: "Đường",
    sodium: "Natri",
    cta: "Ghi lại",
    needed: "Cần có calo, chất đạm, carb và chất béo để ghi lại.",
    failed: "Không ghi lại được. Những gì bạn nhập vẫn còn — hãy thử lại.",
  },
};

export const numbersCopyFor = (lang: Lang): NumbersCopy => t(lang)(NUMBERS_COPY);
