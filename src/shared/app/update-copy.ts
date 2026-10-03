// A meal update as a queued job (ieat-app#1347): the step lines the server sends, the failed and refused rows, the one push.

import { t, type Localized } from "../lang.ts";
import type { Lang } from "../types.ts";

export interface UpdateCopy {
  /** Per kind, one line a step, each counting its own total — the server sends the line worded. */
  steps: { ingredients: readonly string[]; note: readonly string[]; reread: readonly string[] };
  failedTitle: string;
  failedBody: string;
  /** A failed note job: the note is back in the field (`failedBody` stays for the other kinds). */
  failedNote: string;
  refusedTitle: string;
  discard: string;
  ok: string;
  /** The one push, a single line: `{names}` the meal, `{kcal}` and `{was}` with their unit. */
  push: string;
}

export const UPDATE_COPY: Localized<UpdateCopy> = {
  en: {
    steps: {
      ingredients: ["Saving your change · 1 of 2", "Recounting nutrients · 2 of 2"],
      note: ["Reading your note · 1 of 3", "Adjusting the meal · 2 of 3", "Recounting nutrients · 3 of 3"],
      reread: ["Re-reading the photo · 1 of 3", "Weighing portions · 2 of 3", "Counting nutrients · 3 of 3"],
    },
    failedTitle: "Couldn't apply your change", failedBody: "Your meal is as it was.", failedNote: "Your note is here: edit it, or send it again.", refusedTitle: "Couldn't make that change",
    discard: "Discard", ok: "OK", push: "{names} updated · {kcal} (was {was})",
  },
  fr: {
    steps: {
      ingredients: ["Enregistrement de ta modification · 1 sur 2", "Recalcul des nutriments · 2 sur 2"],
      note: ["Lecture de ta note · 1 sur 3", "Ajustement du repas · 2 sur 3", "Recalcul des nutriments · 3 sur 3"],
      reread: ["Nouvelle lecture de la photo · 1 sur 3", "Pesée des portions · 2 sur 3", "Calcul des nutriments · 3 sur 3"],
    },
    failedTitle: "Modification impossible à appliquer", failedBody: "Ton repas n'a pas changé.", failedNote: "Ta note est là : modifie-la, ou renvoie-la.", refusedTitle: "Cette modification n'a pas pu être faite",
    discard: "Abandonner", ok: "OK", push: "{names} mis à jour · {kcal} (avant : {was})",
  },
  de: {
    steps: {
      ingredients: ["Änderung wird gespeichert · 1 von 2", "Nährwerte werden neu berechnet · 2 von 2"],
      note: ["Notiz wird gelesen · 1 von 3", "Mahlzeit wird angepasst · 2 von 3", "Nährwerte werden neu berechnet · 3 von 3"],
      reread: ["Foto wird neu gelesen · 1 von 3", "Portionen werden geschätzt · 2 von 3", "Nährwerte werden gezählt · 3 von 3"],
    },
    failedTitle: "Änderung nicht übernommen", failedBody: "Deine Mahlzeit ist wie vorher.", failedNote: "Deine Notiz ist hier: Bearbeite sie oder schick sie noch einmal.", refusedTitle: "Diese Änderung war nicht möglich",
    discard: "Verwerfen", ok: "OK", push: "{names} aktualisiert · {kcal} (vorher {was})",
  },
  it: {
    steps: {
      ingredients: ["Salvataggio della modifica · 1 di 2", "Ricalcolo dei nutrienti · 2 di 2"],
      note: ["Lettura della nota · 1 di 3", "Modifica del pasto · 2 di 3", "Ricalcolo dei nutrienti · 3 di 3"],
      reread: ["Nuova lettura della foto · 1 di 3", "Stima delle porzioni · 2 di 3", "Conteggio dei nutrienti · 3 di 3"],
    },
    failedTitle: "Impossibile applicare la modifica", failedBody: "Il pasto è rimasto com'era.", failedNote: "La tua nota è qui: modificala, o inviala di nuovo.", refusedTitle: "Non è stato possibile fare questa modifica",
    discard: "Scarta", ok: "OK", push: "{names} aggiornato · {kcal} (prima {was})",
  },
  es: {
    steps: {
      ingredients: ["Guardando tu cambio · 1 de 2", "Recalculando nutrientes · 2 de 2"],
      note: ["Leyendo tu nota · 1 de 3", "Ajustando la comida · 2 de 3", "Recalculando nutrientes · 3 de 3"],
      reread: ["Releyendo la foto · 1 de 3", "Pesando las porciones · 2 de 3", "Contando nutrientes · 3 de 3"],
    },
    failedTitle: "No se pudo aplicar el cambio", failedBody: "Tu comida sigue como estaba.", failedNote: "Tu nota está aquí: edítala o envíala otra vez.", refusedTitle: "No se pudo hacer ese cambio",
    discard: "Descartar", ok: "OK", push: "Actualizado: {names} · {kcal} (antes {was})",
  },
  vi: {
    steps: {
      ingredients: ["Đang lưu thay đổi · 1/2", "Đang tính lại dinh dưỡng · 2/2"],
      note: ["Đang đọc ghi chú · 1/3", "Đang chỉnh bữa ăn · 2/3", "Đang tính lại dinh dưỡng · 3/3"],
      reread: ["Đang đọc lại ảnh · 1/3", "Đang ước lượng khẩu phần · 2/3", "Đang tính dinh dưỡng · 3/3"],
    },
    failedTitle: "Không áp dụng được thay đổi", failedBody: "Bữa ăn vẫn như cũ.", failedNote: "Ghi chú của bạn ở đây: chỉnh lại, hoặc gửi lại.", refusedTitle: "Không thể thực hiện thay đổi này",
    discard: "Bỏ", ok: "OK", push: "{names} đã cập nhật · {kcal} (trước đó {was})",
  },
  id: {
    steps: {
      ingredients: ["Menyimpan perubahanmu · 1 dari 2", "Menghitung ulang nutrisi · 2 dari 2"],
      note: ["Membaca catatanmu · 1 dari 3", "Menyesuaikan makanan · 2 dari 3", "Menghitung ulang nutrisi · 3 dari 3"],
      reread: ["Membaca ulang foto · 1 dari 3", "Menimbang porsi · 2 dari 3", "Menghitung nutrisi · 3 dari 3"],
    },
    failedTitle: "Perubahan tidak bisa diterapkan", failedBody: "Makananmu tetap seperti semula.", failedNote: "Catatanmu ada di sini: ubah, atau kirim lagi.", refusedTitle: "Perubahan itu tidak bisa dibuat",
    discard: "Buang", ok: "OK", push: "{names} diperbarui · {kcal} (sebelumnya {was})",
  },
  ru: {
    steps: {
      ingredients: ["Сохраняем изменение · 1 из 2", "Пересчитываем КБЖУ · 2 из 2"],
      note: ["Читаем заметку · 1 из 3", "Корректируем приём пищи · 2 из 3", "Пересчитываем КБЖУ · 3 из 3"],
      reread: ["Перечитываем фото · 1 из 3", "Оцениваем порции · 2 из 3", "Считаем КБЖУ · 3 из 3"],
    },
    failedTitle: "Не удалось применить изменение", failedBody: "Приём пищи остался как был.", failedNote: "Твоя заметка здесь: измени её или отправь ещё раз.", refusedTitle: "Не удалось внести это изменение",
    discard: "Отменить", ok: "OK", push: "{names}: обновлено · {kcal} (было {was})",
  },
};

export const updateCopyFor = (lang: Lang): UpdateCopy => t(lang)(UPDATE_COPY);
