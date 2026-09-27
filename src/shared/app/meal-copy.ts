// The meal surface's words (W6 #93, mobile M6): the `#/meal/:id` detail, correct-as-chat with the
// coach, the phone's "…" menu and keypad correction, the delete sheet, and the gone state.
//
// Boards (ieat-app `product/design/pro/`, main at 3d2b4357): `web/meal.html`, `web/meal-edit.html`,
// `web/meal-edited.html`, `web/meal-delete.html`, and `phone/meal.html`, `phone/meal-edit.html`,
// `phone/meal-edited.html`, `phone/meal-keypad.html`, `phone/meal-menu.html`, `phone/meal-delete.html`,
// `phone/meal-gone.html`. Keys shown by both clients are plain; keys only one client draws carry
// `web`/`phone` (the claim rule on #93).
//
// WHAT IS NOT HERE, and whose table it is instead: the nav labels are `SHELL_COPY`; the verdict
// lines ("Calories high") are `verdicts.ts`'s, computed and never reworded per surface; the coach's
// NAME fills `{coach}` from `THREAD_COPY`'s `coach.name` (S9); the unit beside a figure is
// `UNIT_KCAL`/`spellUnit`; and the diary rows drawn behind the detail are the Home surface's
// component (W4). "A change, named" — the board's "Rice 150 → 200 g: 540 → 605 kcal. Both still
// high for one meal." — IS here as the `change*` templates: the server composes it from them
// (#119), joining several `changeItem` parts with `Intl.ListFormat(lang, {type: "conjunction"})`
// and filling `{dim}` from `verdicts.ts` in its sentence-start form; nothing writes it freehand,
// and no client or engine changes the dimension's case itself (German nouns).

import { t, type Localized } from "../lang.ts";
import type { Lang } from "../types.ts";

export interface MealCopy {
  /**
   * The detail's subtitle under the meal's name (web + phone `meal.html`): "{day} · {time} ·
   * from a photo". `{day}` is a localized day name, `{time}` the meal's own.
   */
  metaPhoto: string;
  /**
   * The sheet headers that carry no provenance — "{day} · {time}" on `web/meal-delete.html` and
   * `phone/meal-{menu,delete,edit,edited}.html`.
   */
  sheetWhen: string;
  /**
   * A typed meal's provenance where "from a photo" would lie (`web/meal.html` draws it on the
   * diary row behind the detail).
   */
  roughEstimate: string;

  /** The three macro tiles' labels (web + phone `meal.html`), under each figure. */
  macroProtein: string;
  macroCarbs: string;
  macroFat: string;

  /**
   * The coach's signature above her line on the correct sheet (web + phone
   * `meal-{edit,edited}.html`): "{coach} · nutritionist". `{coach}` is `THREAD_COPY`'s
   * `coach.name`, never a literal.
   */
  coachLine: string;
  /**
   * Her opening line when "Correct" is tapped (web + phone `meal-{edit,edited}.html`).
   * `{items}` is the meal's ingredient list formatted by the caller — "150 g of rice and 140 g
   * of salmon".
   */
  correctOpener: string;
  /** The composer's placeholder on the same sheets. */
  composeHint: string;

  /** The delete sheet (web + phone `meal-delete.html`): the question, the consequence, the pair. */
  deleteTitle: string;
  deleteBody: string;
  /** Also the phone menu's last row (`phone/meal-menu.html`) — the same two words. */
  deleteCta: string;
  cancelCta: string;

  /** The detail's fix button on web (`web/meal.html`); the phone's is shorter, below. */
  webCorrect: string;
  /** The web sheet's second header line under `{day} · {time}` (`web/meal-delete.html`). */
  webLoggedPhoto: string;

  /** The phone detail's footer pair (`phone/meal.html`) and its "Edit" affordance. */
  phoneCorrect: string;
  phoneDone: string;
  /** The "Edit" row of the "…" menu and the foot button behind it (`phone/meal-menu.html`). */
  phoneEdit: string;
  /** The remaining "…" menu rows (`phone/meal-menu.html`); Delete is `deleteCta`. */
  phoneMenuReread: string;
  phoneMenuMoveYesterday: string;

  /** The correct sheet's title on the phone (`phone/meal-{edit,edited}.html`); web shows none. */
  phoneCorrectTitle: string;
  /** The keypad's subtitle under the ingredient name — "{meal} · {time}" (`phone/meal-keypad.html`). */
  phoneSheetMeal: string;
  /** Under the keypad's big number — "was {amount}", with `{amount}` the previous grams ("150 g"). */
  phoneWasAmount: string;
  /** The totals card's label on the keypad. */
  phoneThisMeal: string;
  /** The keypad's commit button. */
  phoneSaveRecheck: string;

  /** The gone state (`phone/meal-gone.html`) — a deleted, moved or foreign meal id. */
  phoneGoneTitle: string;
  phoneGoneBody: string;
  phoneGoneBack: string;

  /**
   * "A change, named" (web + phone `meal-edited.html`), built from parts — only the server
   * composes it (#119). `changeItem` is one changed item's clause — "Rice 150 → 200 g" — with
   * `{unit}` the amount's symbol (g, ml); `changeTotal` is the meal's kcal before → after, once,
   * with `{kcal}` as `UNIT_KCAL`; `changeWithItems` joins them — "{items}: {total}" — where
   * `{items}` is the `changeItem` parts through `Intl.ListFormat`. A kcal-only edit is
   * `changeTotal` alone.
   */
  changeItem: string;
  changeTotal: string;
  changeWithItems: string;
  /**
   * The outcome tails — WHOLE sentences, one per dimension whose verdict changed and one for the
   * high ones that stayed (one / two / three). `{dim}` is the verdict dimension's name from
   * `verdicts.ts`, already in sentence-start form.
   */
  changeStillHighOne: string;
  changeStillHighTwo: string;
  changeStillHighAll: string;
  changeToPlan: string;
  changeToHigh: string;
  changeToVeryHigh: string;
  changeAllOnPlan: string;
}

export const MEAL_COPY: Localized<MealCopy> = {
  en: {
    metaPhoto: "{day} · {time} · from a photo",
    sheetWhen: "{day} · {time}",
    roughEstimate: "rough estimate",
    macroProtein: "protein",
    macroCarbs: "carbs",
    macroFat: "fat",
    coachLine: "{coach} · nutritionist",
    correctOpener: "I read {items}. Tell me what I got wrong.",
    composeHint: "Say what was wrong",
    deleteTitle: "Delete this meal?",
    deleteBody: "It comes off today’s diary. This can’t be undone.",
    deleteCta: "Delete this meal",
    cancelCta: "Cancel",
    webCorrect: "Correct this meal",
    webLoggedPhoto: "Logged from a photo",
    phoneCorrect: "Correct",
    phoneDone: "Done",
    phoneEdit: "Edit",
    phoneMenuReread: "Re-read the photo",
    phoneMenuMoveYesterday: "Move to yesterday",
    phoneCorrectTitle: "Correct the meal",
    phoneSheetMeal: "{meal} · {time}",
    phoneWasAmount: "was {amount}",
    phoneThisMeal: "This meal",
    phoneSaveRecheck: "Save and recheck",
    phoneGoneTitle: "Not on today’s diary",
    phoneGoneBody: "Deleted, or moved to another day.",
    phoneGoneBack: "Back to today",
    changeItem: "{item} {before} → {after} {unit}",
    changeTotal: "{kcalBefore} → {kcalAfter} {kcal}.",
    changeWithItems: "{items}: {total}",
    changeStillHighOne: "{dim} still high for one meal.",
    changeStillHighTwo: "Both still high for one meal.",
    changeStillHighAll: "All still high for one meal.",
    changeToPlan: "{dim} now on plan.",
    changeToHigh: "{dim} now high for one meal.",
    changeToVeryHigh: "{dim} now very high for one meal.",
    changeAllOnPlan: "All on plan now.",
  },
  fr: {
    metaPhoto: "{day} · {time} · d’après une photo",
    sheetWhen: "{day} · {time}",
    roughEstimate: "estimation approximative",
    macroProtein: "protéines",
    macroCarbs: "glucides",
    macroFat: "lipides",
    coachLine: "{coach} · nutritionniste",
    correctOpener: "J’ai lu {items}. Dis-moi ce que j’ai raté.",
    composeHint: "Dis ce qui n’allait pas",
    deleteTitle: "Supprimer ce repas ?",
    deleteBody: "Il disparaît du journal d’aujourd’hui. C’est définitif.",
    deleteCta: "Supprimer ce repas",
    cancelCta: "Annuler",
    webCorrect: "Corriger ce repas",
    webLoggedPhoto: "Enregistré d’après une photo",
    phoneCorrect: "Corriger",
    phoneDone: "Terminé",
    phoneEdit: "Modifier",
    phoneMenuReread: "Relire la photo",
    phoneMenuMoveYesterday: "Déplacer à hier",
    phoneCorrectTitle: "Corriger le repas",
    phoneSheetMeal: "{meal} · {time}",
    phoneWasAmount: "était {amount}",
    phoneThisMeal: "Ce repas",
    phoneSaveRecheck: "Enregistrer et revérifier",
    phoneGoneTitle: "Pas dans le journal d’aujourd’hui",
    phoneGoneBody: "Supprimé, ou déplacé à un autre jour.",
    phoneGoneBack: "Retour à aujourd’hui",
    changeItem: "{item} {before} → {after} {unit}",
    changeTotal: "{kcalBefore} → {kcalAfter} {kcal}.",
    changeWithItems: "{items}: {total}",
    changeStillHighOne: "{dim} toujours au-dessus pour un repas.",
    changeStillHighTwo: "Les deux toujours au-dessus pour un repas.",
    changeStillHighAll: "Tout est toujours au-dessus pour un repas.",
    changeToPlan: "{dim} maintenant dans le plan.",
    changeToHigh: "{dim} maintenant au-dessus pour un repas.",
    changeToVeryHigh: "{dim} maintenant trop haut pour un repas.",
    changeAllOnPlan: "Tout est dans le plan maintenant.",
  },
  de: {
    metaPhoto: "{day} · {time} · von einem Foto",
    sheetWhen: "{day} · {time}",
    roughEstimate: "grobe Schätzung",
    macroProtein: "Protein",
    macroCarbs: "Kohlenhydrate",
    macroFat: "Fett",
    coachLine: "{coach} · Ernährungsberaterin",
    correctOpener: "Ich habe {items} gelesen. Sag mir, was ich falsch erkannt habe.",
    composeHint: "Sag, was nicht stimmte",
    deleteTitle: "Diese Mahlzeit löschen?",
    deleteBody: "Sie verschwindet aus dem heutigen Tagebuch. Das lässt sich nicht rückgängig machen.",
    deleteCta: "Diese Mahlzeit löschen",
    cancelCta: "Abbrechen",
    webCorrect: "Diese Mahlzeit korrigieren",
    webLoggedPhoto: "Aus einem Foto eingetragen",
    phoneCorrect: "Korrigieren",
    phoneDone: "Fertig",
    phoneEdit: "Bearbeiten",
    phoneMenuReread: "Foto neu lesen",
    phoneMenuMoveYesterday: "Auf gestern verschieben",
    phoneCorrectTitle: "Mahlzeit korrigieren",
    phoneSheetMeal: "{meal} · {time}",
    phoneWasAmount: "vorher {amount}",
    phoneThisMeal: "Diese Mahlzeit",
    phoneSaveRecheck: "Speichern und neu prüfen",
    phoneGoneTitle: "Nicht im heutigen Tagebuch",
    phoneGoneBody: "Gelöscht oder auf einen anderen Tag verschoben.",
    phoneGoneBack: "Zurück zu heute",
    changeItem: "{item} {before} → {after} {unit}",
    changeTotal: "{kcalBefore} → {kcalAfter} {kcal}.",
    changeWithItems: "{items}: {total}",
    changeStillHighOne: "{dim} immer noch hoch für eine Mahlzeit.",
    changeStillHighTwo: "Beide immer noch hoch für eine Mahlzeit.",
    changeStillHighAll: "Alles immer noch hoch für eine Mahlzeit.",
    changeToPlan: "{dim} jetzt im Plan.",
    changeToHigh: "{dim} jetzt hoch für eine Mahlzeit.",
    changeToVeryHigh: "{dim} jetzt sehr hoch für eine Mahlzeit.",
    changeAllOnPlan: "Jetzt alles im Plan.",
  },
  it: {
    metaPhoto: "{day} · {time} · da una foto",
    sheetWhen: "{day} · {time}",
    roughEstimate: "stima approssimativa",
    macroProtein: "proteine",
    macroCarbs: "carboidrati",
    macroFat: "grassi",
    coachLine: "{coach} · nutrizionista",
    correctOpener: "Ho letto {items}. Dimmi cosa ho sbagliato.",
    composeHint: "Dimmi cosa non andava",
    deleteTitle: "Eliminare questo pasto?",
    deleteBody: "Sparisce dal diario di oggi. Non si può annullare.",
    deleteCta: "Elimina questo pasto",
    cancelCta: "Annulla",
    webCorrect: "Correggi questo pasto",
    webLoggedPhoto: "Registrato da una foto",
    phoneCorrect: "Correggi",
    phoneDone: "Fatto",
    phoneEdit: "Modifica",
    phoneMenuReread: "Rileggi la foto",
    phoneMenuMoveYesterday: "Sposta a ieri",
    phoneCorrectTitle: "Correggi il pasto",
    phoneSheetMeal: "{meal} · {time}",
    phoneWasAmount: "era {amount}",
    phoneThisMeal: "Questo pasto",
    phoneSaveRecheck: "Salva e ricontrolla",
    phoneGoneTitle: "Non è nel diario di oggi",
    phoneGoneBody: "Eliminato, o spostato a un altro giorno.",
    phoneGoneBack: "Torna a oggi",
    changeItem: "{item} {before} → {after} {unit}",
    changeTotal: "{kcalBefore} → {kcalAfter} {kcal}.",
    changeWithItems: "{items}: {total}",
    changeStillHighOne: "{dim} ancora sopra per un pasto.",
    changeStillHighTwo: "Entrambi ancora sopra per un pasto.",
    changeStillHighAll: "Tutto ancora sopra per un pasto.",
    changeToPlan: "{dim} ora nel piano.",
    changeToHigh: "{dim} ora sopra per un pasto.",
    changeToVeryHigh: "{dim} ora molto sopra per un pasto.",
    changeAllOnPlan: "Ora tutto nel piano.",
  },
  es: {
    metaPhoto: "{day} · {time} · de una foto",
    sheetWhen: "{day} · {time}",
    roughEstimate: "estimación aproximada",
    macroProtein: "proteína",
    macroCarbs: "carbohidratos",
    macroFat: "grasa",
    coachLine: "{coach} · nutricionista",
    correctOpener: "Leí {items}. Dime en qué me equivoqué.",
    composeHint: "Di qué estaba mal",
    deleteTitle: "¿Eliminar esta comida?",
    deleteBody: "Sale del diario de hoy. No se puede deshacer.",
    deleteCta: "Eliminar esta comida",
    cancelCta: "Cancelar",
    webCorrect: "Corregir esta comida",
    webLoggedPhoto: "Registrado desde una foto",
    phoneCorrect: "Corregir",
    phoneDone: "Listo",
    phoneEdit: "Editar",
    phoneMenuReread: "Releer la foto",
    phoneMenuMoveYesterday: "Mover a ayer",
    phoneCorrectTitle: "Corregir la comida",
    phoneSheetMeal: "{meal} · {time}",
    phoneWasAmount: "antes {amount}",
    phoneThisMeal: "Esta comida",
    phoneSaveRecheck: "Guardar y revisar",
    phoneGoneTitle: "No está en el diario de hoy",
    phoneGoneBody: "Eliminada, o movida a otro día.",
    phoneGoneBack: "Volver a hoy",
    changeItem: "{item} {before} → {after} {unit}",
    changeTotal: "{kcalBefore} → {kcalAfter} {kcal}.",
    changeWithItems: "{items}: {total}",
    changeStillHighOne: "{dim} sigue por encima para una comida.",
    changeStillHighTwo: "Los dos siguen por encima para una comida.",
    changeStillHighAll: "Todo sigue por encima para una comida.",
    changeToPlan: "{dim} ahora en el plan.",
    changeToHigh: "{dim} ahora por encima para una comida.",
    changeToVeryHigh: "{dim} ahora muy por encima para una comida.",
    changeAllOnPlan: "Todo en el plan ahora.",
  },
  vi: {
    metaPhoto: "{day} · {time} · từ một bức ảnh",
    sheetWhen: "{day} · {time}",
    roughEstimate: "ước tính gần đúng",
    macroProtein: "đạm",
    macroCarbs: "tinh bột",
    macroFat: "chất béo",
    coachLine: "{coach} · chuyên gia dinh dưỡng",
    correctOpener: "Tôi đọc được {items}. Hãy nói tôi sai chỗ nào.",
    composeHint: "Nói xem chỗ nào chưa đúng",
    deleteTitle: "Xoá bữa này?",
    deleteBody: "Bữa này sẽ ra khỏi nhật ký hôm nay. Không thể hoàn tác.",
    deleteCta: "Xoá bữa này",
    cancelCta: "Huỷ",
    webCorrect: "Sửa bữa này",
    webLoggedPhoto: "Đã ghi từ một bức ảnh",
    phoneCorrect: "Sửa",
    phoneDone: "Xong",
    phoneEdit: "Chỉnh",
    phoneMenuReread: "Đọc lại ảnh",
    phoneMenuMoveYesterday: "Chuyển sang hôm qua",
    phoneCorrectTitle: "Sửa bữa ăn",
    phoneSheetMeal: "{meal} · {time}",
    phoneWasAmount: "trước là {amount}",
    phoneThisMeal: "Bữa này",
    phoneSaveRecheck: "Lưu và kiểm tra lại",
    phoneGoneTitle: "Không có trong nhật ký hôm nay",
    phoneGoneBody: "Đã xoá, hoặc đã chuyển sang ngày khác.",
    phoneGoneBack: "Về hôm nay",
    changeItem: "{item} {before} → {after} {unit}",
    changeTotal: "{kcalBefore} → {kcalAfter} {kcal}.",
    changeWithItems: "{items}: {total}",
    changeStillHighOne: "{dim} vẫn cao cho một bữa.",
    changeStillHighTwo: "Cả hai vẫn cao cho một bữa.",
    changeStillHighAll: "Tất cả vẫn cao cho một bữa.",
    changeToPlan: "{dim} đã đúng kế hoạch.",
    changeToHigh: "{dim} giờ cao cho một bữa.",
    changeToVeryHigh: "{dim} giờ rất cao cho một bữa.",
    changeAllOnPlan: "Giờ tất cả đúng kế hoạch.",
  },
  id: {
    metaPhoto: "{day} · {time} · dari foto",
    sheetWhen: "{day} · {time}",
    roughEstimate: "perkiraan kasar",
    macroProtein: "protein",
    macroCarbs: "karbohidrat",
    macroFat: "lemak",
    coachLine: "{coach} · ahli gizi",
    correctOpener: "Saya membaca {items}. Beri tahu apa yang saya lewatkan.",
    composeHint: "Bilang apa yang keliru",
    deleteTitle: "Hapus makanan ini?",
    deleteBody: "Makanan ini hilang dari catatan hari ini. Tidak bisa dibatalkan.",
    deleteCta: "Hapus makanan ini",
    cancelCta: "Batal",
    webCorrect: "Koreksi makanan ini",
    webLoggedPhoto: "Dicatat dari foto",
    phoneCorrect: "Koreksi",
    phoneDone: "Selesai",
    phoneEdit: "Ubah",
    phoneMenuReread: "Baca ulang foto",
    phoneMenuMoveYesterday: "Pindahkan ke kemarin",
    phoneCorrectTitle: "Koreksi makanan",
    phoneSheetMeal: "{meal} · {time}",
    phoneWasAmount: "tadinya {amount}",
    phoneThisMeal: "Makanan ini",
    phoneSaveRecheck: "Simpan dan periksa lagi",
    phoneGoneTitle: "Tidak ada di catatan hari ini",
    phoneGoneBody: "Dihapus, atau dipindah ke hari lain.",
    phoneGoneBack: "Kembali ke hari ini",
    changeItem: "{item} {before} → {after} {unit}",
    changeTotal: "{kcalBefore} → {kcalAfter} {kcal}.",
    changeWithItems: "{items}: {total}",
    changeStillHighOne: "{dim} masih tinggi untuk satu kali makan.",
    changeStillHighTwo: "Keduanya masih tinggi untuk satu kali makan.",
    changeStillHighAll: "Semua masih tinggi untuk satu kali makan.",
    changeToPlan: "{dim} kini sesuai rencana.",
    changeToHigh: "{dim} kini tinggi untuk satu kali makan.",
    changeToVeryHigh: "{dim} kini sangat tinggi untuk satu kali makan.",
    changeAllOnPlan: "Semua sesuai rencana sekarang.",
  },
  ru: {
    metaPhoto: "{day} · {time} · по фото",
    sheetWhen: "{day} · {time}",
    roughEstimate: "примерная оценка",
    macroProtein: "белок",
    macroCarbs: "углеводы",
    macroFat: "жиры",
    coachLine: "{coach} · нутрициолог",
    correctOpener: "Я прочитала {items}. Скажи, где я ошиблась.",
    composeHint: "Напиши, что не так",
    deleteTitle: "Удалить этот приём пищи?",
    deleteBody: "Он исчезнет из дневника за сегодня. Отменить нельзя.",
    deleteCta: "Удалить приём пищи",
    cancelCta: "Отмена",
    webCorrect: "Исправить приём пищи",
    webLoggedPhoto: "Записано по фото",
    phoneCorrect: "Исправить",
    phoneDone: "Готово",
    phoneEdit: "Изменить",
    phoneMenuReread: "Перечитать фото",
    phoneMenuMoveYesterday: "Перенести на вчера",
    phoneCorrectTitle: "Исправить приём пищи",
    phoneSheetMeal: "{meal} · {time}",
    phoneWasAmount: "было {amount}",
    phoneThisMeal: "Этот приём пищи",
    phoneSaveRecheck: "Сохранить и перепроверить",
    phoneGoneTitle: "Нет в дневнике за сегодня",
    phoneGoneBody: "Удалён или перенесён на другой день.",
    phoneGoneBack: "Назад к сегодня",
    changeItem: "{item} {before} → {after} {unit}",
    changeTotal: "{kcalBefore} → {kcalAfter} {kcal}.",
    changeWithItems: "{items}: {total}",
    changeStillHighOne: "{dim} всё ещё много для одного приёма пищи.",
    changeStillHighTwo: "Оба всё ещё много для одного приёма пищи.",
    changeStillHighAll: "Всё по-прежнему много для одного приёма пищи.",
    changeToPlan: "{dim} теперь в норме.",
    changeToHigh: "{dim} теперь много для одного приёма пищи.",
    changeToVeryHigh: "{dim} теперь очень много для одного приёма пищи.",
    changeAllOnPlan: "Теперь всё в норме.",
  },
};

export const mealCopyFor = (lang: Lang): MealCopy => t(lang)(MEAL_COPY);
