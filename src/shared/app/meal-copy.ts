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
// component (W4). "A change, named" — the board's "Rice 150 → 200g: 540 → 605kcal. Both still
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
  /** The three macro tiles' labels (web + phone `meal.html`), under each figure. */
  macroProtein: string;
  macroCarbs: string;
  macroFat: string;

  /**
   * The coach's name line above his line on the correct sheet (web + phone
   * `meal-{edit,edited}.html`): just the name, no role — "Spud", not a credential (#1041).
   * `{coach}` is `THREAD_COPY`'s `coach.name`, never a literal.
   */
  coachLine: string;
  /**
   * Her opening line when "Correct" is tapped (web + phone `meal-{edit,edited}.html`).
   * `{items}` is the meal's ingredient list formatted by the caller — "150g of rice and 140g
   * of salmon" — each item a `correctItem` and the parts joined by `Intl.ListFormat`.
   */
  correctOpener: string;
  /**
   * One item inside `correctOpener`'s `{items}` — "{amount} of {item}", "150g of rice", with
   * `{amount}` already spelled ("150g"). The caller joins the parts with `Intl.ListFormat`'s
   * conjunction — which word does the joining is CLDR's, not a literal here.
   */
  itemAmount: string;
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
  /** The totals card's label on the keypad. */
  phoneThisMeal: string;
  /** The keypad's commit button. */
  phoneSaveRecheck: string;
  /**
   * The keypad's backspace key's accessible name (`phone/meal-keypad.html`) — the key is a glyph,
   * so the label is the words, and "Delete" is the menu's destructive row, not this.
   */
  phoneKeypadBackspace: string;

  /**
   * The fix screen (`phone/meal-fix.html`, `web/meal-fix.html`): one field + "Update". Its title is
   * `phoneCorrectTitle`; `phoneFixMeal` is its meal line — "{name} · {kcal} · {time}", `{kcal}`
   * spelled with its unit ("540kcal") — the worked example beside the field, drawn as
   * `<b>{phoneFixExampleLead}</b> {phoneFixExample}` — and the commit button.
   */
  phoneFixMeal: string;
  phoneFixExampleLead: string;
  phoneFixExample: string;
  phoneUpdate: string;
  /**
   * The ingredient editor (`phone/meal-ingredient.html`, `web/meal-ingredient.html`): the title,
   * the "Amount" row's label, and the bin's accessible name — the glyph itself is silent. The
   * calories card's label is `CHAT_SCREEN_COPY.macroLabels.kcal`, the top buttons' `phoneGone*`'s
   * siblings and the shared back word.
   */
  phoneIngredientTitle: string;
  phoneAmount: string;
  phoneRemoveIngredient: string;
  /**
   * The pre-edit figure the editor draws once the typed amount moves off the stored one —
   * "was {amount}" under the grams row and beside the live kcal figure on both boards
   * (`phone/meal-ingredient.html`, `web/meal-ingredient.html`). `{amount}` is the stored figure
   * spelled through its own join — grams via `phoneGrams` ("was 150g"), kcal bare ("was 195").
   */
  phoneWasAmount: string;
  /**
   * The joins a grams figure and a moving total take — "{n}g" for the amount pill (and inside
   * `phoneWasAmount`'s "{amount}"), "{from} → {to}kcal" for the meal's total answering. Templates,
   * not spans, so a language can reorder them.
   */
  phoneGrams: string;
  /** A failed ingredient save: `{grams}` is what was typed, still in the editor. */
  phoneIngredientKept: string;
  /**
   * The source card on Edit ingredient (ieat-app #1954, board `meal-source-item`): "From the food
   * table" over the row's own name, or "Estimate" for an item no row grounded; `{amount}` is a
   * grams figure through `phoneGrams` — "Per 100g", "For 140g". No sentence explains either one.
   */
  phoneSourceFromTable: string;
  phoneSourceEstimate: string;
  phoneSourcePer: string;
  phoneSourceFor: string;
  /** Correct this meal, answer never came: the note is back in the field. */
  phoneNoAnswer: string;
  phoneMealMove: string;

  /** The gone state (`phone/meal-gone.html`) — a deleted, moved or foreign meal id. */
  phoneGoneTitle: string;
  phoneGoneBody: string;
  phoneGoneBack: string;
  /**
   * The web's gone state — the same state the phone's `phoneGone*` covers, worded for a surface
   * with no "today" header to name. A deleted, moved away or FOREIGN id lands here: the detail
   * never renders somebody else's meal.
   */
  webGoneTitle: string;
  webGoneBody: string;
  webGoneBack: string;
  /** The "…" menu button's accessible name — the glyph itself is silent. */
  menuButton: string;

  /**
   * "A change, named" (web + phone `meal-edited.html`), built from parts — only the server
   * composes it (#119). `changeItem` is one changed item's clause — "Rice 150 → 200g" — with
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
    macroProtein: "protein",
    macroCarbs: "carbs",
    macroFat: "fat",
    coachLine: "{coach}",
    correctOpener: "I read {items}. Tell me what I got wrong.",
    itemAmount: "{amount} of {item}",
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
    phoneCorrectTitle: "Correct this meal",
    phoneSheetMeal: "{meal} · {time}",
    phoneThisMeal: "This meal",
    phoneSaveRecheck: "Save and recheck",
    phoneKeypadBackspace: "Backspace",
        phoneFixMeal: "{name} · {kcal} · {time}",
    phoneFixExampleLead: "For example:",
        phoneFixExample: "the rice was about 200g, and there was no sauce.",
    phoneUpdate: "Update",
    phoneIngredientTitle: "Edit ingredient",
    phoneAmount: "Amount",
    phoneRemoveIngredient: "Remove ingredient",
    phoneWasAmount: "was {amount}",
    phoneGrams: "{n}g",
    phoneIngredientKept: "That didn't go through. Your {grams} is still here. Done saves it again.",
    phoneSourceFromTable: "From the food table",
    phoneSourceEstimate: "Estimate",
    phoneSourcePer: "Per {amount}",
    phoneSourceFor: "For {amount}",
    phoneNoAnswer: "That one reached me, but the answer didn't. It's here, send it again.",
    phoneMealMove: "{from} → {to}kcal",
    phoneGoneTitle: "Not on today’s diary",
    phoneGoneBody: "Deleted, or moved to another day.",
    phoneGoneBack: "Back to today",
    webGoneTitle: "This meal is gone.",
    webGoneBody: "It was deleted, or it was never yours.",
    webGoneBack: "Back to the diary",
    menuButton: "Meal actions",
    changeItem: "{item} {before} → {after}{unit}",
    changeTotal: "{kcalBefore} → {kcalAfter}{kcal}.",
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
    macroProtein: "protéines",
    macroCarbs: "glucides",
    macroFat: "lipides",
    coachLine: "{coach}",
    correctOpener: "J’ai lu {items}. Dis-moi ce que j’ai raté.",
    itemAmount: "{item} : {amount}",
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
    phoneCorrectTitle: "Corriger ce repas",
    phoneSheetMeal: "{meal} · {time}",
    phoneThisMeal: "Ce repas",
    phoneSaveRecheck: "Enregistrer et recalculer",
    phoneKeypadBackspace: "Effacer",
        phoneFixMeal: "{name} · {kcal} · {time}",
    phoneFixExampleLead: "Par exemple :",
        phoneFixExample: "le riz pesait environ 200g, et il n’y avait pas de sauce.",
    phoneUpdate: "Mettre à jour",
    phoneIngredientTitle: "Modifier un ingrédient",
    phoneAmount: "Quantité",
    phoneRemoveIngredient: "Supprimer l’ingrédient",
    phoneWasAmount: "avant : {amount}",
    phoneGrams: "{n}g",
    phoneIngredientKept: "Ça n'est pas passé. Ton {grams} est toujours là. Terminé l'enregistre à nouveau.",
    phoneSourceFromTable: "Depuis la table des aliments",
    phoneSourceEstimate: "Estimation",
    phoneSourcePer: "Pour {amount}",
    phoneSourceFor: "Pour {amount}",
    phoneNoAnswer: "Ton message m'est bien arrivé, mais la réponse n'est pas arrivée. Il est là, renvoie-le.",
    phoneMealMove: "{from} → {to}kcal",
    phoneGoneTitle: "Pas dans le journal d’aujourd’hui",
    phoneGoneBody: "Supprimé, ou déplacé à un autre jour.",
    phoneGoneBack: "Retour à aujourd’hui",
    webGoneTitle: "Ce repas n’existe plus.",
    webGoneBody: "Il a été supprimé, ou il n’a jamais été à toi.",
    webGoneBack: "Retour au journal",
    menuButton: "Actions du repas",
    changeItem: "{item} {before} → {after}{unit}",
    changeTotal: "{kcalBefore} → {kcalAfter}{kcal}.",
    changeWithItems: "{items} : {total}",
    changeStillHighOne: "{dim} toujours au-dessus pour un repas.",
    changeStillHighTwo: "Les deux toujours au-dessus pour un repas.",
    changeStillHighAll: "Tout est toujours au-dessus pour un repas.",
    changeToPlan: "{dim} maintenant dans le plan.",
    changeToHigh: "{dim} maintenant au-dessus pour un repas.",
    changeToVeryHigh: "{dim} : maintenant bien au-dessus pour un repas.",
    changeAllOnPlan: "Tout est dans le plan maintenant.",
  },
  de: {
    metaPhoto: "{day} · {time} · von einem Foto",
    sheetWhen: "{day} · {time}",
    macroProtein: "Protein",
    macroCarbs: "Kohlenhydrate",
    macroFat: "Fett",
    coachLine: "{coach}",
    correctOpener: "Ich habe {items} erkannt. Sag mir, was ich falsch erkannt habe.",
    itemAmount: "{amount} {item}",
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
    phoneMenuReread: "Foto neu analysieren",
    phoneMenuMoveYesterday: "Auf gestern verschieben",
    phoneCorrectTitle: "Diese Mahlzeit korrigieren",
    phoneSheetMeal: "{meal} · {time}",
    phoneThisMeal: "Diese Mahlzeit",
    phoneSaveRecheck: "Speichern und neu prüfen",
    phoneKeypadBackspace: "Löschen",
        phoneFixMeal: "{name} · {kcal} · {time}",
    phoneFixExampleLead: "Zum Beispiel:",
        phoneFixExample: "der Reis war etwa 200g, und es gab keine Sauce.",
    phoneUpdate: "Aktualisieren",
    phoneIngredientTitle: "Zutat bearbeiten",
    phoneAmount: "Menge",
    phoneRemoveIngredient: "Zutat entfernen",
    phoneWasAmount: "vorher {amount}",
    phoneGrams: "{n}g",
    phoneIngredientKept: "Das ist nicht durchgegangen. Deine {grams} sind noch da. Mit Fertig wird es erneut gespeichert.",
    phoneSourceFromTable: "Aus der Nährwerttabelle",
    phoneSourceEstimate: "Schätzung",
    phoneSourcePer: "Pro {amount}",
    phoneSourceFor: "Für {amount}",
    phoneNoAnswer: "Die ist angekommen, aber die Antwort kam nicht an. Sie steht wieder im Eingabefeld, schick sie noch einmal.",
    phoneMealMove: "{from} → {to}kcal",
    phoneGoneTitle: "Nicht im heutigen Tagebuch",
    phoneGoneBody: "Gelöscht oder auf einen anderen Tag verschoben.",
    phoneGoneBack: "Zurück zu heute",
    webGoneTitle: "Diese Mahlzeit ist weg.",
    webGoneBody: "Sie wurde gelöscht, oder sie war nie deine.",
    webGoneBack: "Zurück zum Tagebuch",
    menuButton: "Aktionen zur Mahlzeit",
    changeItem: "{item} {before} → {after}{unit}",
    changeTotal: "{kcalBefore} → {kcalAfter}{kcal}.",
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
    macroProtein: "proteine",
    macroCarbs: "carboidrati",
    macroFat: "grassi",
    coachLine: "{coach}",
    correctOpener: "Ho letto {items}. Dimmi cosa ho sbagliato.",
    itemAmount: "{amount} di {item}",
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
    phoneCorrectTitle: "Correggi questo pasto",
    phoneSheetMeal: "{meal} · {time}",
    phoneThisMeal: "Questo pasto",
    phoneSaveRecheck: "Salva e ricontrolla",
    phoneKeypadBackspace: "Elimina",
        phoneFixMeal: "{name} · {kcal} · {time}",
    phoneFixExampleLead: "Per esempio:",
        phoneFixExample: "il riso era circa 200g e non c’era salsa.",
    phoneUpdate: "Aggiorna",
    phoneIngredientTitle: "Modifica ingrediente",
    phoneAmount: "Quantità",
    phoneRemoveIngredient: "Rimuovi ingrediente",
    phoneWasAmount: "era {amount}",
    phoneGrams: "{n}g",
    phoneIngredientKept: "Non è andata a buon fine. I tuoi {grams} sono ancora qui. Con Fatto si salva di nuovo.",
    phoneSourceFromTable: "Dalla tabella alimentare",
    phoneSourceEstimate: "Stima",
    phoneSourcePer: "Per {amount}",
    phoneSourceFor: "Per {amount}",
    phoneNoAnswer: "Il messaggio mi è arrivato, ma la risposta no. È qui, invialo di nuovo.",
    phoneMealMove: "{from} → {to}kcal",
    phoneGoneTitle: "Non è nel diario di oggi",
    phoneGoneBody: "Eliminato, o spostato a un altro giorno.",
    phoneGoneBack: "Torna a oggi",
    webGoneTitle: "Questo pasto non c’è più.",
    webGoneBody: "È stato eliminato, o non è mai stato tuo.",
    webGoneBack: "Torna al diario",
    menuButton: "Azioni sul pasto",
    changeItem: "{item} {before} → {after}{unit}",
    changeTotal: "{kcalBefore} → {kcalAfter}{kcal}.",
    changeWithItems: "{items}: {total}",
    changeStillHighOne: "{dim}: ancora sopra soglia per un pasto.",
    changeStillHighTwo: "Entrambi ancora sopra soglia per un pasto.",
    changeStillHighAll: "Tutti ancora sopra soglia per un pasto.",
    changeToPlan: "{dim}: ora in linea.",
    changeToHigh: "{dim}: ora sopra soglia per un pasto.",
    changeToVeryHigh: "{dim}: ora molto sopra soglia per un pasto.",
    changeAllOnPlan: "Ora è tutto in linea.",
  },
  es: {
    metaPhoto: "{day} · {time} · de una foto",
    sheetWhen: "{day} · {time}",
    macroProtein: "proteína",
    macroCarbs: "carbohidratos",
    macroFat: "grasas",
    coachLine: "{coach}",
    correctOpener: "Leí {items}. Dime en qué me equivoqué.",
    itemAmount: "{amount} de {item}",
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
    phoneCorrectTitle: "Corregir esta comida",
    phoneSheetMeal: "{meal} · {time}",
    phoneThisMeal: "Esta comida",
    phoneSaveRecheck: "Guardar y revisar",
    phoneKeypadBackspace: "Borrar",
        phoneFixMeal: "{name} · {kcal} · {time}",
    phoneFixExampleLead: "Por ejemplo:",
        phoneFixExample: "el arroz era unos 200g, y no había salsa.",
    phoneUpdate: "Actualizar",
    phoneIngredientTitle: "Editar ingrediente",
    phoneAmount: "Cantidad",
    phoneRemoveIngredient: "Eliminar ingrediente",
    phoneWasAmount: "antes {amount}",
    phoneGrams: "{n}g",
    phoneIngredientKept: "Eso no se completó. Tus {grams} siguen aquí. Con Listo se guarda de nuevo.",
    phoneSourceFromTable: "De la tabla de alimentos",
    phoneSourceEstimate: "Estimación",
    phoneSourcePer: "Por {amount}",
    phoneSourceFor: "Para {amount}",
    phoneNoAnswer: "Me llegó, pero la respuesta no. Está aquí, envíalo otra vez.",
    phoneMealMove: "{from} → {to}kcal",
    phoneGoneTitle: "No está en el diario de hoy",
    phoneGoneBody: "Eliminada, o movida a otro día.",
    phoneGoneBack: "Volver a hoy",
    webGoneTitle: "Esta comida ya no existe.",
    webGoneBody: "Se ha eliminado, o nunca fue tuya.",
    webGoneBack: "Volver al diario",
    menuButton: "Acciones de la comida",
    changeItem: "{item} {before} → {after}{unit}",
    changeTotal: "{kcalBefore} → {kcalAfter}{kcal}.",
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
    macroProtein: "đạm",
    macroCarbs: "tinh bột",
    macroFat: "chất béo",
    coachLine: "{coach}",
    correctOpener: "Mình đọc được {items}. Hãy nói mình sai chỗ nào.",
    itemAmount: "{amount} {item}",
    composeHint: "Nói xem chỗ nào chưa đúng",
    deleteTitle: "Xóa bữa này?",
    deleteBody: "Bữa này sẽ ra khỏi nhật ký hôm nay. Không thể hòan tác.",
    deleteCta: "Xóa bữa này",
    cancelCta: "Hủy",
    webCorrect: "Sửa bữa này",
    webLoggedPhoto: "Đã ghi từ một bức ảnh",
    phoneCorrect: "Sửa",
    phoneDone: "Xong",
    phoneEdit: "Chỉnh sửa",
    phoneMenuReread: "Đọc lại ảnh",
    phoneMenuMoveYesterday: "Chuyển sang hôm qua",
    phoneCorrectTitle: "Sửa bữa này",
    phoneSheetMeal: "{meal} · {time}",
    phoneThisMeal: "Bữa này",
    phoneSaveRecheck: "Lưu và kiểm tra lại",
    phoneKeypadBackspace: "Xóa",
        phoneFixMeal: "{name} · {kcal} · {time}",
    phoneFixExampleLead: "Ví dụ:",
        phoneFixExample: "cơm khoảng 200g, và không có sốt.",
    phoneUpdate: "Cập nhật",
    phoneIngredientTitle: "Sửa nguyên liệu",
    phoneAmount: "Lượng",
    phoneRemoveIngredient: "Bỏ nguyên liệu",
    phoneWasAmount: "trước: {amount}",
    phoneGrams: "{n}g",
    phoneIngredientKept: "Chưa được. {grams} của bạn vẫn còn đây. Bấm Xong để lưu lại.",
    phoneSourceFromTable: "Từ bảng thành phần thực phẩm",
    phoneSourceEstimate: "Ước tính",
    phoneSourcePer: "Mỗi {amount}",
    phoneSourceFor: "Cho {amount}",
    phoneNoAnswer: "Tin đã tới mình, nhưng câu trả lời chưa tới. Tin vẫn ở đây, gửi lại nhé.",
    phoneMealMove: "{from} → {to}kcal",
    phoneGoneTitle: "Không có trong nhật ký hôm nay",
    phoneGoneBody: "Đã xóa, hoặc đã chuyển sang ngày khác.",
    phoneGoneBack: "Về hôm nay",
    webGoneTitle: "Bữa này không còn nữa.",
    webGoneBody: "Đã bị xóa, hoặc chưa bao giờ là của bạn.",
    webGoneBack: "Về nhật ký",
    menuButton: "Thao tác bữa ăn",
    changeItem: "{item} {before} → {after}{unit}",
    changeTotal: "{kcalBefore} → {kcalAfter}{kcal}.",
    changeWithItems: "{items}: {total}",
    changeStillHighOne: "{dim} vẫn cao so với một bữa.",
    changeStillHighTwo: "Cả hai vẫn cao so với một bữa.",
    changeStillHighAll: "Tất cả vẫn cao so với một bữa.",
    changeToPlan: "{dim} đã đúng kế hoạch.",
    changeToHigh: "{dim} giờ đã cao so với một bữa.",
    changeToVeryHigh: "{dim} giờ đã rất cao so với một bữa.",
    changeAllOnPlan: "Giờ tất cả đúng kế hoạch.",
  },
  id: {
    metaPhoto: "{day} · {time} · dari foto",
    sheetWhen: "{day} · {time}",
    macroProtein: "protein",
    macroCarbs: "karbohidrat",
    macroFat: "lemak",
    coachLine: "{coach}",
    correctOpener: "Aku membaca {items}. Beri tahu apa yang aku lewatkan.",
    itemAmount: "{amount} {item}",
    composeHint: "Bilang apa yang keliru",
    deleteTitle: "Hapus makanan ini?",
    deleteBody: "Makanan ini dihapus dari buku harian hari ini. Tidak bisa dibatalkan.",
    deleteCta: "Hapus makanan ini",
    cancelCta: "Batal",
    webCorrect: "Koreksi makanan ini",
    webLoggedPhoto: "Dicatat dari foto",
    phoneCorrect: "Koreksi",
    phoneDone: "Selesai",
    phoneEdit: "Ubah",
    phoneMenuReread: "Baca ulang foto",
    phoneMenuMoveYesterday: "Pindahkan ke kemarin",
    phoneCorrectTitle: "Koreksi makanan ini",
    phoneSheetMeal: "{meal} · {time}",
    phoneThisMeal: "Makanan ini",
    phoneSaveRecheck: "Simpan dan periksa lagi",
    phoneKeypadBackspace: "Hapus",
        phoneFixMeal: "{name} · {kcal} · {time}",
    phoneFixExampleLead: "Misalnya:",
        phoneFixExample: "nasinya sekitar 200g, dan tidak ada saus.",
    phoneUpdate: "Perbarui",
    phoneIngredientTitle: "Ubah bahan",
    phoneAmount: "Jumlah",
    phoneRemoveIngredient: "Hapus bahan",
    phoneWasAmount: "tadinya {amount}",
    phoneGrams: "{n}g",
    phoneIngredientKept: "Itu belum berhasil. {grams} milikmu masih di sini. Ketuk Selesai untuk menyimpan lagi.",
    phoneSourceFromTable: "Dari tabel pangan",
    phoneSourceEstimate: "Perkiraan",
    phoneSourcePer: "Per {amount}",
    phoneSourceFor: "Untuk {amount}",
    phoneNoAnswer: "Yang itu sampai padaku, tapi jawabannya tidak. Ada di sini, kirim lagi.",
    phoneMealMove: "{from} → {to}kcal",
    phoneGoneTitle: "Tidak ada di buku harian hari ini",
    phoneGoneBody: "Dihapus, atau dipindah ke hari lain.",
    phoneGoneBack: "Kembali ke hari ini",
    webGoneTitle: "Makanan ini sudah hilang.",
    webGoneBody: "Sudah dihapus, atau tidak pernah jadi milikmu.",
    webGoneBack: "Kembali ke buku harian",
    menuButton: "Opsi makanan",
    changeItem: "{item} {before} → {after}{unit}",
    changeTotal: "{kcalBefore} → {kcalAfter}{kcal}.",
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
    macroProtein: "белок",
    macroCarbs: "углеводы",
    macroFat: "жиры",
    coachLine: "{coach}",
    correctOpener: "Я вижу: {items}. Скажи, где я ошибся.",
    itemAmount: "{item}: {amount}",
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
    phoneThisMeal: "Этот приём пищи",
    phoneSaveRecheck: "Сохранить и перепроверить",
    phoneKeypadBackspace: "Стереть",
        phoneFixMeal: "{name} · {kcal} · {time}",
    phoneFixExampleLead: "Например:",
        phoneFixExample: "риса было примерно 200г, и соуса не было.",
    phoneUpdate: "Обновить",
    phoneIngredientTitle: "Редактировать ингредиент",
    phoneAmount: "Количество",
    phoneRemoveIngredient: "Удалить ингредиент",
    phoneWasAmount: "было {amount}",
    phoneGrams: "{n}г",
    phoneIngredientKept: "Не получилось. Твои {grams} всё ещё здесь. «Готово» сохранит их снова.",
    phoneSourceFromTable: "Из таблицы продуктов",
    phoneSourceEstimate: "Оценка",
    phoneSourcePer: "На {amount}",
    phoneSourceFor: "Для {amount}",
    phoneNoAnswer: "Оно дошло до меня, а ответ — нет. Оно здесь, отправь ещё раз.",
    phoneMealMove: "{from} → {to}ккал",
    phoneGoneTitle: "Нет в дневнике за сегодня",
    phoneGoneBody: "Удалён или перенесён на другой день.",
    phoneGoneBack: "К сегодняшнему дню",
    webGoneTitle: "Этого приёма пищи больше нет.",
    webGoneBody: "Его удалили — или он был не твой.",
    webGoneBack: "Назад к дневнику",
    menuButton: "Действия с приёмом пищи",
    changeItem: "{item} {before} → {after}{unit}",
    changeTotal: "{kcalBefore} → {kcalAfter}{kcal}.",
    changeWithItems: "{items}: {total}",
    changeStillHighOne: "{dim} — всё ещё много для одного приёма пищи.",
    changeStillHighTwo: "Того и другого — всё ещё много для одного приёма пищи.",
    changeStillHighAll: "Всего по-прежнему много для одного приёма пищи.",
    changeToPlan: "{dim} теперь в норме.",
    changeToHigh: "{dim} — теперь много для одного приёма пищи.",
    changeToVeryHigh: "{dim} — теперь очень много для одного приёма пищи.",
    changeAllOnPlan: "Теперь всё в норме.",
  },
};

export const mealCopyFor = (lang: Lang): MealCopy => t(lang)(MEAL_COPY);
