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
  /** Why a queued job ended unknown (`OutcomeUnknown.why`, ieat-app#2187): the row's reason line, on photo rows too. */
  reasons: { timeout: string; error: string; "worker-lost": string; expired: string };
  /** A failed note's actions: its words back in the composer, and the ingredient-by-ingredient editor. */
  restore: string;
  editStructured: string;
  refusedTitle: string;
  /** A refused `note` job that the router read as a NEW meal (`proposed`): the reason line. */
  refusedOtherMeal: string;
  /** The focused chat's composer while its meal has a job running. */
  mealUpdating: string;
  /** The line under Delete in the updating meal's menu. */
  deleteStops: string;
  /** The offline row: the outbox holds the change until it can send. */
  waiting: string;
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
    failedTitle: "Couldn't apply your change", failedBody: "Your meal is as it was.", failedNote: "Your note is here: edit it, or send it again.", reasons: { timeout: "That took too long, so I stopped. Nothing was logged.", error: "Something went wrong on my side. Nothing was logged.", "worker-lost": "I lost track of this one while working on it. Nothing was logged.", expired: "I never got to this one. Nothing was logged." },
    restore: "Restore text", editStructured: "Edit by ingredients",
    refusedTitle: "Couldn't make that change",
    refusedOtherMeal: "The note asked to log a different meal. Correct this one, or log the other on its own.",
    mealUpdating: "This meal is updating", deleteStops: "Delete stops the update and deletes the meal.",
    waiting: "Waiting for connection. It sends itself.",
    discard: "Discard", ok: "OK", push: "{names} updated · {kcal} (was {was})",
  },
  fr: {
    steps: {
      ingredients: ["Enregistrement de ta modification · 1 sur 2", "Recalcul des nutriments · 2 sur 2"],
      note: ["Lecture de ta note · 1 sur 3", "Ajustement du repas · 2 sur 3", "Recalcul des nutriments · 3 sur 3"],
      reread: ["Nouvelle lecture de la photo · 1 sur 3", "Estimation des portions · 2 sur 3", "Calcul des nutriments · 3 sur 3"],
    },
    failedTitle: "Modification impossible à appliquer", failedBody: "Ton repas n'a pas changé.", failedNote: "Ta note est là : modifie-la, ou renvoie-la.", reasons: { timeout: "Cela a pris trop de temps : j'ai interrompu. Rien n'a été enregistré.", error: "Un problème est survenu de mon côté. Rien n'a été enregistré.", "worker-lost": "J'ai perdu le fil de celui-ci en cours de traitement. Rien n'a été enregistré.", expired: "Je n'ai jamais pu m'en occuper. Rien n'a été enregistré." },
    restore: "Remettre mon texte", editStructured: "Modifier par ingrédients",
    refusedTitle: "Cette modification n'a pas pu être faite",
    refusedOtherMeal: "Ta note demande à enregistrer un autre repas. Corrige celui-ci, ou enregistre l'autre à part.",
    mealUpdating: "Ce repas est en cours de mise à jour", deleteStops: "Supprimer arrête la mise à jour et supprime le repas.",
    waiting: "En attente de connexion. Ça partira tout seul.",
    discard: "Abandonner", ok: "OK", push: "{names} mis à jour · {kcal} (avant : {was})",
  },
  de: {
    steps: {
      ingredients: ["Änderung wird gespeichert · 1 von 2", "Nährwerte werden neu berechnet · 2 von 2"],
      note: ["Notiz wird gelesen · 1 von 3", "Mahlzeit wird angepasst · 2 von 3", "Nährwerte werden neu berechnet · 3 von 3"],
      reread: ["Foto wird neu gelesen · 1 von 3", "Portionen werden geschätzt · 2 von 3", "Nährwerte werden gezählt · 3 von 3"],
    },
    failedTitle: "Änderung nicht übernommen", failedBody: "Deine Mahlzeit ist wie vorher.", failedNote: "Deine Notiz ist hier: Bearbeite sie oder schick sie noch einmal.", reasons: { timeout: "Das hat zu lange gedauert, deshalb habe ich abgebrochen. Es wurde nichts gespeichert.", error: "Bei mir ist etwas schiefgelaufen. Es wurde nichts gespeichert.", "worker-lost": "Ich habe den Faden bei diesem Eintrag verloren. Es wurde nichts gespeichert.", expired: "Dieser Eintrag ist bei mir nicht mehr drangekommen. Es wurde nichts gespeichert." },
    restore: "Meinen Text zurückholen", editStructured: "Nach Zutaten bearbeiten",
    refusedTitle: "Diese Änderung war nicht möglich",
    refusedOtherMeal: "Die Notiz möchte eine andere Mahlzeit eintragen. Korrigiere diese, oder trage die andere separat ein.",
    mealUpdating: "Diese Mahlzeit wird gerade aktualisiert", deleteStops: "Löschen stoppt die Aktualisierung und löscht die Mahlzeit.",
    waiting: "Warten auf Verbindung. Wird von selbst gesendet.",
    discard: "Verwerfen", ok: "OK", push: "{names} aktualisiert · {kcal} (vorher {was})",
  },
  it: {
    steps: {
      ingredients: ["Salvataggio della modifica · 1 di 2", "Ricalcolo dei nutrienti · 2 di 2"],
      note: ["Lettura della nota · 1 di 3", "Modifica del pasto · 2 di 3", "Ricalcolo dei nutrienti · 3 di 3"],
      reread: ["Nuova lettura della foto · 1 di 3", "Stima delle porzioni · 2 di 3", "Conteggio dei nutrienti · 3 di 3"],
    },
    failedTitle: "Impossibile applicare la modifica", failedBody: "Il pasto è rimasto com'era.", failedNote: "La tua nota è qui: modificala, o inviala di nuovo.", reasons: { timeout: "Ci ho messo troppo: ho interrotto tutto. Non è stato registrato nulla.", error: "Qualcosa è andato storto da parte mia. Non è stato registrato nulla.", "worker-lost": "Ho perso il filo di questa richiesta mentre ci lavoravo. Non è stato registrato nulla.", expired: "Questa richiesta non è mai arrivata al mio turno. Non è stato registrato nulla." },
    restore: "Rimetti il mio testo", editStructured: "Modifica per ingredienti",
    refusedTitle: "Non è stato possibile fare questa modifica",
    refusedOtherMeal: "La nota chiede di registrare un altro pasto. Correggi questo, oppure registra l'altro da solo.",
    mealUpdating: "Questo pasto è in aggiornamento", deleteStops: "Elimina interrompe l'aggiornamento ed elimina il pasto.",
    waiting: "In attesa di connessione. Parte da solo.",
    discard: "Scarta", ok: "OK", push: "Aggiornato: {names} · {kcal} (prima {was})",
  },
  es: {
    steps: {
      ingredients: ["Guardando tu cambio · 1 de 2", "Recalculando nutrientes · 2 de 2"],
      note: ["Leyendo tu nota · 1 de 3", "Ajustando la comida · 2 de 3", "Recalculando nutrientes · 3 de 3"],
      reread: ["Releyendo la foto · 1 de 3", "Pesando las raciones · 2 de 3", "Contando nutrientes · 3 de 3"],
    },
    failedTitle: "No se pudo aplicar el cambio", failedBody: "Tu comida sigue como estaba.", failedNote: "Tu nota está aquí: edítala o envíala otra vez.", reasons: { timeout: "Tardó demasiado, así que lo detuve. No se registró nada.", error: "Algo salió mal por mi parte. No se registró nada.", "worker-lost": "Perdí el hilo de esta mientras trabajaba en ella. No se registró nada.", expired: "No llegué a ocuparme de esta. No se registró nada." },
    restore: "Recuperar mi texto", editStructured: "Editar por ingredientes",
    refusedTitle: "No se pudo hacer ese cambio",
    refusedOtherMeal: "La nota pide registrar otra comida. Corrige esta, o registra la otra por separado.",
    mealUpdating: "Esta comida se está actualizando", deleteStops: "Eliminar detiene la actualización y elimina la comida.",
    waiting: "Esperando conexión. Se envía solo.",
    discard: "Descartar", ok: "OK", push: "Actualizado: {names} · {kcal} (antes {was})",
  },
  vi: {
    steps: {
      ingredients: ["Đang lưu thay đổi · 1/2", "Đang tính lại dinh dưỡng · 2/2"],
      note: ["Đang đọc ghi chú · 1/3", "Đang chỉnh bữa ăn · 2/3", "Đang tính lại dinh dưỡng · 3/3"],
      reread: ["Đang đọc lại ảnh · 1/3", "Đang ước lượng khẩu phần · 2/3", "Đang tính dinh dưỡng · 3/3"],
    },
    failedTitle: "Không áp dụng được thay đổi", failedBody: "Bữa ăn vẫn như cũ.", failedNote: "Ghi chú của bạn ở đây: chỉnh lại, hoặc gửi lại.", reasons: { timeout: "Việc này mất quá nhiều thời gian nên mình đã dừng lại. Chưa có gì được ghi lại.", error: "Có lỗi xảy ra từ phía mình. Chưa có gì được ghi lại.", "worker-lost": "Mình bị mất dấu mục này khi đang xử lý. Chưa có gì được ghi lại.", expired: "Mình chưa kịp xử lý mục này. Chưa có gì được ghi lại." },
    restore: "Khôi phục nội dung đã nhập", editStructured: "Sửa theo nguyên liệu",
    refusedTitle: "Không thể thực hiện thay đổi này",
    refusedOtherMeal: "Ghi chú muốn ghi một bữa ăn khác. Sửa bữa này, hoặc ghi bữa kia riêng.",
    mealUpdating: "Bữa ăn này đang cập nhật", deleteStops: "Xóa sẽ dừng cập nhật và xóa bữa ăn.",
    waiting: "Đang chờ kết nối. Sẽ tự gửi.",
    discard: "Bỏ", ok: "OK", push: "{names} đã cập nhật · {kcal} (trước đó {was})",
  },
  id: {
    steps: {
      ingredients: ["Menyimpan perubahanmu · 1 dari 2", "Menghitung ulang nutrisi · 2 dari 2"],
      note: ["Membaca catatanmu · 1 dari 3", "Menyesuaikan makanan · 2 dari 3", "Menghitung ulang nutrisi · 3 dari 3"],
      reread: ["Membaca ulang foto · 1 dari 3", "Menimbang porsi · 2 dari 3", "Menghitung nutrisi · 3 dari 3"],
    },
    failedTitle: "Perubahan tidak bisa diterapkan", failedBody: "Makananmu tetap seperti semula.", failedNote: "Catatanmu ada di sini: ubah, atau kirim lagi.", reasons: { timeout: "Terlalu lama, jadi aku berhenti. Tidak ada yang dicatat.", error: "Ada masalah di sisiku. Tidak ada yang dicatat.", "worker-lost": "Aku kehilangan jejak catatan ini saat memprosesnya. Tidak ada yang dicatat.", expired: "Aku belum sempat memproses catatan ini. Tidak ada yang dicatat." },
    restore: "Kembalikan tulisanku", editStructured: "Edit per bahan",
    refusedTitle: "Perubahan itu tidak bisa dibuat",
    refusedOtherMeal: "Catatanmu meminta mencatat makanan lain. Perbaiki yang ini, atau catat yang lain secara terpisah.",
    mealUpdating: "Makanan ini sedang diperbarui", deleteStops: "Hapus menghentikan pembaruan dan menghapus makanan.",
    waiting: "Menunggu koneksi. Terkirim sendiri.",
    discard: "Buang", ok: "OK", push: "{names} diperbarui · {kcal} (sebelumnya {was})",
  },
  ru: {
    steps: {
      ingredients: ["Сохраняем изменение · 1 из 2", "Пересчитываем КБЖУ · 2 из 2"],
      note: ["Читаем заметку · 1 из 3", "Корректируем приём пищи · 2 из 3", "Пересчитываем КБЖУ · 3 из 3"],
      reread: ["Перечитываем фото · 1 из 3", "Оцениваем порции · 2 из 3", "Считаем КБЖУ · 3 из 3"],
    },
    failedTitle: "Не удалось применить изменение", failedBody: "Приём пищи остался как был.", failedNote: "Твоя заметка здесь: измени её или отправь ещё раз.", reasons: { timeout: "Это заняло слишком много времени, обработка остановлена. Ничего не записано.", error: "С моей стороны что-то пошло не так. Ничего не записано.", "worker-lost": "Эта запись прервалась во время обработки. Ничего не записано.", expired: "До этой записи очередь так и не дошла. Ничего не записано." },
    restore: "Вернуть мой текст", editStructured: "Править по ингредиентам",
    refusedTitle: "Не удалось внести это изменение",
    refusedOtherMeal: "Заметка предлагает записать другой приём пищи. Исправь этот, или запиши тот отдельно.",
    mealUpdating: "Этот приём пищи обновляется", deleteStops: "Удаление остановит обновление и удалит приём пищи.",
    waiting: "Ждём соединения. Отправится само.",
    discard: "Отменить", ok: "OK", push: "{names}: обновлено · {kcal} (было {was})",
  },
  nl: {
    steps: {
      ingredients: ["Je wijziging opslaan · 1 van 2", "Voedingsstoffen opnieuw tellen · 2 van 2"],
      note: ["Je notitie lezen · 1 van 3", "De maaltijd aanpassen · 2 van 3", "Voedingsstoffen opnieuw tellen · 3 van 3"],
      reread: ["De foto opnieuw lezen · 1 van 3", "Porties inschatten · 2 van 3", "Voedingsstoffen tellen · 3 van 3"],
    },
    failedTitle: "Je wijziging kon niet worden toegepast", failedBody: "Je maaltijd is ongewijzigd.", failedNote: "Je notitie staat hier: pas hem aan of stuur hem opnieuw.", refusedTitle: "Die wijziging lukte niet",
    refusedOtherMeal: "De notitie vroeg om een andere maaltijd te loggen. Corrigeer deze, of log de andere apart.",
    mealUpdating: "Deze maaltijd wordt bijgewerkt", deleteStops: "Verwijderen stopt de update en verwijdert de maaltijd.",
    waiting: "Wachten op verbinding. Het wordt vanzelf verstuurd.",
    discard: "Weggooien", ok: "OK", push: "{names} bijgewerkt · {kcal} (was {was})",
  },
  pl: {
    steps: {
      ingredients: ["Zapisywanie zmiany · 1 z 2", "Przeliczanie wartości odżywczych · 2 z 2"],
      note: ["Czytanie notatki · 1 z 3", "Dopasowywanie posiłku · 2 z 3", "Przeliczanie wartości odżywczych · 3 z 3"],
      reread: ["Ponowne czytanie zdjęcia · 1 z 3", "Szacowanie porcji · 2 z 3", "Liczenie wartości odżywczych · 3 z 3"],
    },
    failedTitle: "Nie udało się wprowadzić zmiany", failedBody: "Posiłek pozostał bez zmian.", failedNote: "Twoja notatka jest tutaj: popraw ją albo wyślij ponownie.", refusedTitle: "Nie da się wprowadzić tej zmiany",
    refusedOtherMeal: "Notatka dotyczyła innego posiłku. Popraw ten albo zapisz tamten osobno.",
    mealUpdating: "Ten posiłek się aktualizuje", deleteStops: "Usunięcie przerwie aktualizację i skasuje posiłek.",
    waiting: "Czekam na połączenie. Wyśle się samo.",
    discard: "Odrzuć", ok: "OK", push: "{names}: zaktualizowano · {kcal} (było {was})",
  },
  tr: {
    steps: {
      ingredients: ["Değişikliğin kaydediliyor · 1/2", "Besin değerleri yeniden hesaplanıyor · 2/2"],
      note: ["Notun okunuyor · 1/3", "Öğün düzenleniyor · 2/3", "Besin değerleri yeniden hesaplanıyor · 3/3"],
      reread: ["Fotoğraf yeniden okunuyor · 1/3", "Porsiyonlar ölçülüyor · 2/3", "Besin değerleri hesaplanıyor · 3/3"],
    },
    failedTitle: "Değişikliğin uygulanamadı", failedBody: "Öğünün olduğu gibi duruyor.", failedNote: "Notun burada: düzenle ya da tekrar gönder.", refusedTitle: "Bu değişiklik yapılamadı",
    refusedOtherMeal: "Not, başka bir öğünü kaydetmeyi istedi. Bunu düzelt ya da diğerini ayrıca kaydet.",
    mealUpdating: "Bu öğün güncelleniyor", deleteStops: "Silmek güncellemeyi durdurur ve öğünü siler.",
    waiting: "Bağlantı bekleniyor. Kendiliğinden gönderilecek.",
    discard: "At", ok: "OK", push: "{names} güncellendi · {kcal} (önceden {was})",
  },
  "zh-Hant": {
    steps: {
      ingredients: ["正在儲存變更 · 1／2", "正在重算營養素 · 2／2"],
      note: ["正在讀取你的備註 · 1／3", "正在調整餐點 · 2／3", "正在重算營養素 · 3／3"],
      reread: ["正在重新讀取照片 · 1／3", "正在估算份量 · 2／3", "正在計算營養素 · 3／3"],
    },
    failedTitle: "無法套用你的變更", failedBody: "你的餐點維持原樣。", failedNote: "你的備註還在：編輯它，或再傳送一次。", refusedTitle: "無法進行這項變更",
    refusedOtherMeal: "這則備註要求記錄另一餐。請修正這一餐，或另外記錄那一餐。",
    mealUpdating: "這餐正在更新", deleteStops: "刪除會停止更新並刪除這餐。",
    waiting: "等待連線中，連上後會自動傳送。",
    discard: "捨棄", ok: "OK", push: "{names} 已更新 · {kcal}（原為 {was}）",
  },
  "zh-Hans": {
    steps: {
      ingredients: ["正在保存你的修改 · 1/2", "正在重新计算营养 · 2/2"],
      note: ["正在读取你的备注 · 1/3", "正在调整这一餐 · 2/3", "正在重新计算营养 · 3/3"],
      reread: ["正在重新识别照片 · 1/3", "正在估算份量 · 2/3", "正在计算营养 · 3/3"],
    },
    failedTitle: "无法应用你的修改", failedBody: "这一餐保持原样。", failedNote: "你的备注还在：可以修改，或重新发送。", refusedTitle: "无法进行这项修改",
    refusedOtherMeal: "这条备注要求记录另一餐。请修正这一餐，或单独记录另一餐。",
    mealUpdating: "这一餐正在更新", deleteStops: "删除将停止更新并删除这一餐。",
    waiting: "正在等待网络连接，连接后会自动发送。",
    discard: "丢弃", ok: "OK", push: "{names}已更新 · {kcal}（原为{was}）",
  },
  ko: {
    steps: {
      ingredients: ["변경 사항 저장 중 · 1/2", "영양소 다시 계산 중 · 2/2"],
      note: ["메모 읽는 중 · 1/3", "식사 조정 중 · 2/3", "영양소 다시 계산 중 · 3/3"],
      reread: ["사진 다시 읽는 중 · 1/3", "양 가늠하는 중 · 2/3", "영양소 계산 중 · 3/3"],
    },
    failedTitle: "변경 사항을 적용하지 못했어요", failedBody: "식사는 이전 그대로예요.", failedNote: "메모는 여기 있어요. 수정하거나 다시 보내세요.", refusedTitle: "그렇게 바꿀 수 없어요",
    refusedOtherMeal: "메모가 다른 식사를 기록하려고 해요. 이 식사를 수정하거나, 다른 식사는 따로 기록하세요.",
    mealUpdating: "이 식사를 업데이트하고 있어요", deleteStops: "삭제하면 업데이트가 중지되고 식사가 삭제돼요.",
    waiting: "연결을 기다리는 중이에요. 자동으로 전송돼요.",
    discard: "버리기", ok: "OK", push: "{names} 업데이트됨 · {kcal} (이전 {was})",
  },
  ja: {
    steps: {
      ingredients: ["変更を保存中 · 1/2", "栄養素を再計算中 · 2/2"],
      note: ["メモを読んでいます · 1/3", "食事を調整中 · 2/3", "栄養素を再計算中 · 3/3"],
      reread: ["写真を読み直しています · 1/3", "量を見積もり中 · 2/3", "栄養素を計算中 · 3/3"],
    },
    failedTitle: "変更を反映できませんでした", failedBody: "食事は元のままです。", failedNote: "メモは残っています。編集するか、もう一度送信してください。", refusedTitle: "その変更はできませんでした",
    refusedOtherMeal: "メモが別の食事の記録を求めていました。この食事を修正するか、別の食事は個別に記録してください。",
    mealUpdating: "この食事は更新中です", deleteStops: "削除すると更新が止まり、食事も削除されます。",
    waiting: "接続を待っています。つながれば自動で送信されます。",
    discard: "破棄", ok: "OK", push: "{names}を更新 · {kcal}（以前は{was}）",
  },
  "pt-BR": {
    steps: {
      ingredients: ["Salvando sua alteração · 1 de 2", "Recalculando nutrientes · 2 de 2"],
      note: ["Lendo sua nota · 1 de 3", "Ajustando a refeição · 2 de 3", "Recalculando nutrientes · 3 de 3"],
      reread: ["Relendo a foto · 1 de 3", "Estimando as porções · 2 de 3", "Calculando nutrientes · 3 de 3"],
    },
    failedTitle: "Não foi possível aplicar sua alteração", failedBody: "Sua refeição continua como estava.", failedNote: "Sua nota está aqui: edite ou envie de novo.", refusedTitle: "Não foi possível fazer essa alteração",
    refusedOtherMeal: "A nota pedia para registrar outra refeição. Corrija esta ou registre a outra separadamente.",
    mealUpdating: "Esta refeição está sendo atualizada", deleteStops: "Apagar interrompe a atualização e apaga a refeição.",
    waiting: "Aguardando conexão. O envio é automático.",
    discard: "Descartar", ok: "OK", push: "Atualização: {names} · {kcal} (antes: {was})",
  },
};

export const updateCopyFor = (lang: Lang): UpdateCopy => t(lang)(UPDATE_COPY);
