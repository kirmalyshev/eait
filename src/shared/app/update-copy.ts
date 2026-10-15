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
  hu: {
    steps: {
      ingredients: ["Változtatás mentése · 1/2", "Tápértékek újraszámolása · 2/2"],
      note: ["Megjegyzés olvasása · 1/3", "Étkezés módosítása · 2/3", "Tápértékek újraszámolása · 3/3"],
      reread: ["Fotó újraolvasása · 1/3", "Adagok becslése · 2/3", "Tápértékek számolása · 3/3"],
    },
    failedTitle: "Nem sikerült alkalmazni a változtatást", failedBody: "Az étkezésed változatlan maradt.", failedNote: "A megjegyzésed itt van: szerkeszd, vagy küldd el újra.", reasons: { timeout: "Túl sokáig tartott, ezért leállítottam. Semmi nem lett rögzítve.", error: "Valami hiba történt nálam. Semmi nem lett rögzítve.", "worker-lost": "Feldolgozás közben elvesztettem a fonalat. Semmi nem lett rögzítve.", expired: "Erre már nem jutottam el. Semmi nem lett rögzítve." },
    restore: "Szöveg visszahozása", editStructured: "Szerkesztés hozzávalónként",
    refusedTitle: "Ezt a változtatást nem tudtam elvégezni",
    refusedOtherMeal: "A megjegyzés egy másik étkezést rögzítene. Javítsd ezt, vagy rögzítsd a másikat külön.",
    mealUpdating: "Ez az étkezés éppen frissül", deleteStops: "A törlés leállítja a frissítést, és törli az étkezést.",
    waiting: "Várakozás a kapcsolatra. Magától elküldi.",
    discard: "Elvetés", ok: "OK", push: "{names} frissítve · {kcal} (korábban {was})",
  },
  el: {
    steps: {
      ingredients: ["Αποθήκευση της αλλαγής σου · 1 από 2", "Επανυπολογισμός θρεπτικών στοιχείων · 2 από 2"],
      note: ["Ανάγνωση της σημείωσής σου · 1 από 3", "Προσαρμογή του γεύματος · 2 από 3", "Επανυπολογισμός θρεπτικών στοιχείων · 3 από 3"],
      reread: ["Νέα ανάγνωση της φωτογραφίας · 1 από 3", "Εκτίμηση μερίδων · 2 από 3", "Υπολογισμός θρεπτικών στοιχείων · 3 από 3"],
    },
    failedTitle: "Η αλλαγή σου δεν εφαρμόστηκε", failedBody: "Το γεύμα σου έμεινε όπως ήταν.", failedNote: "Η σημείωσή σου είναι εδώ: επεξεργάσου την ή στείλε την ξανά.", reasons: { timeout: "Άργησε πολύ, οπότε σταμάτησα. Δεν καταγράφηκε τίποτα.", error: "Κάτι πήγε στραβά από τη μεριά μου. Δεν καταγράφηκε τίποτα.", "worker-lost": "Το έχασα στη μέση της δουλειάς. Δεν καταγράφηκε τίποτα.", expired: "Δεν πρόλαβα να ασχοληθώ με αυτό. Δεν καταγράφηκε τίποτα." },
    restore: "Ανάκτηση κειμένου", editStructured: "Επεξεργασία ανά συστατικά",
    refusedTitle: "Δεν μπόρεσα να κάνω αυτή την αλλαγή",
    refusedOtherMeal: "Η σημείωση ζητούσε να καταγραφεί άλλο γεύμα. Διόρθωσε αυτό ή κατάγραψε το άλλο ξεχωριστά.",
    mealUpdating: "Το γεύμα ενημερώνεται", deleteStops: "Η διαγραφή σταματά την ενημέρωση και διαγράφει το γεύμα.",
    waiting: "Αναμονή για σύνδεση. Θα σταλεί αυτόματα.",
    discard: "Απόρριψη", ok: "OK", push: "Ενημέρωση: {names} · {kcal} (πριν {was})",
  },
  ro: {
    steps: {
      ingredients: ["Se salvează modificarea · 1 din 2", "Se recalculează nutrienții · 2 din 2"],
      note: ["Se citește nota · 1 din 3", "Se ajustează masa · 2 din 3", "Se recalculează nutrienții · 3 din 3"],
      reread: ["Se recitește fotografia · 1 din 3", "Se estimează porțiile · 2 din 3", "Se calculează nutrienții · 3 din 3"],
    },
    failedTitle: "Modificarea nu a putut fi aplicată", failedBody: "Masa ta a rămas cum era.", failedNote: "Nota ta e aici: editeaz-o sau trimite-o din nou.", reasons: { timeout: "A durat prea mult, așa că m-am oprit. Nu s-a înregistrat nimic.", error: "Ceva n-a mers bine la mine. Nu s-a înregistrat nimic.", "worker-lost": "Am pierdut firul cu asta în timp ce lucram. Nu s-a înregistrat nimic.", expired: "N-am mai apucat să mă ocup de asta. Nu s-a înregistrat nimic." },
    restore: "Recuperează textul", editStructured: "Editează după ingrediente",
    refusedTitle: "Modificarea nu a fost posibilă",
    refusedOtherMeal: "Nota cerea înregistrarea altei mese. Corectează-o pe aceasta sau înregistrează-o separat pe cealaltă.",
    mealUpdating: "Masa se actualizează", deleteStops: "Ștergerea oprește actualizarea și șterge masa.",
    waiting: "Se așteaptă conexiunea. Se trimite automat.",
    discard: "Renunță", ok: "OK", push: "Actualizare: {names} · {kcal} (înainte {was})",
  },
  cs: {
    steps: {
      ingredients: ["Ukládám změnu · 1 ze 2", "Přepočítávám živiny · 2 ze 2"],
      note: ["Čtu poznámku · 1 ze 3", "Upravuji jídlo · 2 ze 3", "Přepočítávám živiny · 3 ze 3"],
      reread: ["Znovu čtu fotku · 1 ze 3", "Odhaduji porce · 2 ze 3", "Počítám živiny · 3 ze 3"],
    },
    failedTitle: "Změnu se nepodařilo použít", failedBody: "Jídlo zůstalo, jak bylo.", failedNote: "Tvoje poznámka je tady: uprav ji, nebo ji pošli znovu.", reasons: { timeout: "Trvalo to příliš dlouho, takže se to zastavilo. Nic se nezapsalo.", error: "Na mé straně se něco pokazilo. Nic se nezapsalo.", "worker-lost": "Během zpracování se mi tohle ztratilo. Nic se nezapsalo.", expired: "Na tohle už nedošlo. Nic se nezapsalo." },
    restore: "Vrátit text", editStructured: "Upravit podle ingrediencí",
    refusedTitle: "Tuhle změnu nešlo provést",
    refusedOtherMeal: "Poznámka chtěla zapsat jiné jídlo. Oprav tohle, nebo zapiš to druhé zvlášť.",
    mealUpdating: "Toto jídlo se upravuje", deleteStops: "Smazání zastaví úpravu a smaže jídlo.",
    waiting: "Čekám na připojení. Odešle se samo.",
    discard: "Zahodit", ok: "OK", push: "{names}: upraveno · {kcal} (předtím {was})",
  },
  hi: {
    steps: {
      ingredients: ["आपका बदलाव सेव हो रहा है · 2 में से 1", "पोषक तत्व दोबारा गिने जा रहे हैं · 2 में से 2"],
      note: ["आपका नोट पढ़ा जा रहा है · 3 में से 1", "भोजन में बदलाव हो रहा है · 3 में से 2", "पोषक तत्व दोबारा गिने जा रहे हैं · 3 में से 3"],
      reread: ["फ़ोटो फिर से पढ़ी जा रही है · 3 में से 1", "मात्रा का अनुमान लग रहा है · 3 में से 2", "पोषक तत्व गिने जा रहे हैं · 3 में से 3"],
    },
    failedTitle: "आपका बदलाव लागू नहीं हो सका", failedBody: "आपका भोजन पहले जैसा ही है।", failedNote: "आपका नोट यहीं है: इसे बदलें या फिर से भेजें।", reasons: { timeout: "इसमें बहुत देर लग रही थी, इसलिए मैंने इसे रोक दिया। कुछ भी दर्ज नहीं हुआ।", error: "मेरी तरफ़ से कुछ गड़बड़ हो गई। कुछ भी दर्ज नहीं हुआ।", "worker-lost": "इस पर काम करते समय यह बीच में छूट गया। कुछ भी दर्ज नहीं हुआ।", expired: "इसकी बारी आई ही नहीं। कुछ भी दर्ज नहीं हुआ।" },
    restore: "टेक्स्ट वापस लाएँ", editStructured: "सामग्री के हिसाब से बदलें",
    refusedTitle: "यह बदलाव नहीं हो सका",
    refusedOtherMeal: "नोट में कोई दूसरा भोजन दर्ज करने को कहा गया था। इसे सुधारें, या दूसरे को अलग से दर्ज करें।",
    mealUpdating: "यह भोजन अपडेट हो रहा है", deleteStops: "डिलीट करने से अपडेट रुक जाएगा और भोजन डिलीट हो जाएगा।",
    waiting: "कनेक्शन का इंतज़ार है। यह अपने-आप भेज दिया जाएगा।",
    discard: "छोड़ दें", ok: "OK", push: "{names} अपडेट हुआ · {kcal} (पहले {was})",
  },
  th: {
    steps: {
      ingredients: ["กำลังบันทึกการแก้ไข · 1 จาก 2", "กำลังคำนวณสารอาหารใหม่ · 2 จาก 2"],
      note: ["กำลังอ่านโน้ตของคุณ · 1 จาก 3", "กำลังปรับมื้ออาหาร · 2 จาก 3", "กำลังคำนวณสารอาหารใหม่ · 3 จาก 3"],
      reread: ["กำลังอ่านรูปใหม่ · 1 จาก 3", "กำลังประเมินปริมาณ · 2 จาก 3", "กำลังคำนวณสารอาหาร · 3 จาก 3"],
    },
    failedTitle: "แก้ไขไม่สำเร็จ", failedBody: "มื้อของคุณยังเหมือนเดิม", failedNote: "โน้ตของคุณอยู่ตรงนี้: แก้ไข หรือส่งอีกครั้ง", reasons: { timeout: "ใช้เวลานานเกินไป เราเลยหยุดไว้ ยังไม่มีอะไรถูกจด", error: "มีบางอย่างผิดพลาดฝั่งเรา ยังไม่มีอะไรถูกจด", "worker-lost": "เราหลุดการติดตามรายการนี้ระหว่างทำงาน ยังไม่มีอะไรถูกจด", expired: "เราไม่ทันได้ทำรายการนี้ ยังไม่มีอะไรถูกจด" },
    restore: "เอาข้อความกลับมา", editStructured: "แก้ไขตามวัตถุดิบ",
    refusedTitle: "แก้ไขแบบนั้นไม่ได้",
    refusedOtherMeal: "โน้ตขอให้จดมื้ออื่น แก้มื้อนี้ให้ถูก หรือจดอีกมื้อแยกต่างหาก",
    mealUpdating: "มื้อนี้กำลังอัปเดต", deleteStops: "การลบจะหยุดการอัปเดตและลบมื้อนี้",
    waiting: "กำลังรอการเชื่อมต่อ แล้วจะส่งเอง",
    discard: "ทิ้ง", ok: "OK", push: "อัปเดต {names} แล้ว · {kcal} (เดิม {was})",
  },
  sv: {
    steps: {
      ingredients: ["Sparar din ändring · 1 av 2", "Räknar om näringsvärden · 2 av 2"],
      note: ["Läser din anteckning · 1 av 3", "Justerar måltiden · 2 av 3", "Räknar om näringsvärden · 3 av 3"],
      reread: ["Läser av fotot igen · 1 av 3", "Väger portioner · 2 av 3", "Räknar näringsvärden · 3 av 3"],
    },
    failedTitle: "Kunde inte genomföra ändringen", failedBody: "Måltiden är som den var.", failedNote: "Din anteckning finns kvar här: redigera den eller skicka den igen.", reasons: { timeout: "Det tog för lång tid, så jag avbröt. Inget loggades.", error: "Något gick fel hos mig. Inget loggades.", "worker-lost": "Jag tappade bort den här medan jag jobbade med den. Inget loggades.", expired: "Jag hann aldrig till den här. Inget loggades." },
    restore: "Hämta tillbaka texten", editStructured: "Redigera via ingredienser",
    refusedTitle: "Kunde inte göra den ändringen",
    refusedOtherMeal: "Anteckningen bad om att logga en annan måltid. Korrigera den här, eller logga den andra separat.",
    mealUpdating: "Måltiden uppdateras", deleteStops: "Radera stoppar uppdateringen och raderar måltiden.",
    waiting: "Väntar på anslutning. Skickas automatiskt.",
    discard: "Släng", ok: "OK", push: "{names} uppdaterades · {kcal} (förut {was})",
  },
  uk: {
    steps: {
      ingredients: ["Зберігаємо зміну · 1 з 2", "Перераховуємо поживні речовини · 2 з 2"],
      note: ["Читаємо нотатку · 1 з 3", "Коригуємо прийом їжі · 2 з 3", "Перераховуємо поживні речовини · 3 з 3"],
      reread: ["Знову розглядаємо фото · 1 з 3", "Оцінюємо порції · 2 з 3", "Рахуємо поживні речовини · 3 з 3"],
    },
    failedTitle: "Не вдалося застосувати зміну", failedBody: "Прийом їжі залишився як був.", failedNote: "Твоя нотатка тут: зміни її або надішли ще раз.", reasons: { timeout: "Це забрало забагато часу, тож обробку зупинено. Нічого не записано.", error: "Щось пішло не так з мого боку. Нічого не записано.", "worker-lost": "Цей запис перервався під час обробки. Нічого не записано.", expired: "До цього запису черга так і не дійшла. Нічого не записано." },
    restore: "Повернути текст", editStructured: "Редагувати за інгредієнтами",
    refusedTitle: "Не вдалося внести цю зміну",
    refusedOtherMeal: "Нотатка просила записати інший прийом їжі. Виправ цей або запиши інший окремо.",
    mealUpdating: "Цей прийом їжі оновлюється", deleteStops: "Видалення зупинить оновлення й видалить прийом їжі.",
    waiting: "Чекаємо на з'єднання. Надішлеться саме.",
    discard: "Відкинути", ok: "OK", push: "{names}: оновлено · {kcal} (було {was})",
  },
  nl: {
    reasons: { timeout: "Dat duurde te lang, dus ik ben gestopt. Er is niets gelogd.", error: "Er ging aan mijn kant iets mis. Er is niets gelogd.", "worker-lost": "Ik ben deze kwijtgeraakt terwijl ik eraan werkte. Er is niets gelogd.", expired: "Hier ben ik nooit aan toegekomen. Er is niets gelogd." },
    restore: "Herstel tekst", editStructured: "Wijzig per ingrediënt",
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
    reasons: { timeout: "Trwało to za długo, więc zostało przerwane. Nic nie zostało zapisane.", error: "Coś poszło nie tak po mojej stronie. Nic nie zostało zapisane.", "worker-lost": "Ten wpis przepadł w trakcie przetwarzania. Nic nie zostało zapisane.", expired: "Ten wpis nie doczekał się przetworzenia. Nic nie zostało zapisane." },
    restore: "Przywróć tekst", editStructured: "Edytuj składniki",
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
    reasons: { timeout: "Çok uzun sürdü, o yüzden durdurdum. Hiçbir şey kaydedilmedi.", error: "Benim tarafımda bir şeyler ters gitti. Hiçbir şey kaydedilmedi.", "worker-lost": "Bunu işlerken izini kaybettim. Hiçbir şey kaydedilmedi.", expired: "Buna hiç sıra gelmedi. Hiçbir şey kaydedilmedi." },
    restore: "Metni geri getir", editStructured: "Malzemeler üzerinden düzenle",
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
    reasons: { timeout: "花了太久，所以我停止了。沒有記錄任何內容。", error: "我這邊發生錯誤。沒有記錄任何內容。", "worker-lost": "處理到一半，我跟丟了這則。沒有記錄任何內容。", expired: "這則一直沒輪到處理。沒有記錄任何內容。" },
    restore: "還原文字", editStructured: "按食材編輯",
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
    reasons: { timeout: "耗时太久，我停下了。什么都没有记录。", error: "我这边出了点问题。什么都没有记录。", "worker-lost": "处理这条时我跟丢了。什么都没有记录。", expired: "这条一直没轮到处理。什么都没有记录。" },
    restore: "恢复文字", editStructured: "按食材编辑",
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
    reasons: { timeout: "시간이 너무 오래 걸려서 중단했어요. 아무것도 기록되지 않았어요.", error: "제 쪽에서 문제가 생겼어요. 아무것도 기록되지 않았어요.", "worker-lost": "처리하는 도중에 이 항목을 놓쳤어요. 아무것도 기록되지 않았어요.", expired: "이 항목은 끝내 처리하지 못했어요. 아무것도 기록되지 않았어요." },
    restore: "텍스트 복원", editStructured: "재료별로 편집",
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
    reasons: { timeout: "時間がかかりすぎたため中止しました。何も記録されていません。", error: "こちら側で問題が発生しました。何も記録されていません。", "worker-lost": "処理の途中でこの件を見失いました。何も記録されていません。", expired: "この件には手が回りませんでした。何も記録されていません。" },
    restore: "テキストを元に戻す", editStructured: "食材ごとに編集",
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
    reasons: { timeout: "Demorou demais, então parei. Nada foi registrado.", error: "Algo deu errado do meu lado. Nada foi registrado.", "worker-lost": "Perdi esta no meio do caminho. Nada foi registrado.", expired: "Nunca cheguei a esta. Nada foi registrado." },
    restore: "Restaurar texto", editStructured: "Editar por ingredientes",
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
