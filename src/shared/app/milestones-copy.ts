// Milestones' words (ieat-app#1395, part 3): the wall, the streak card's four states, the Badge
// Unlocked dialog and Profile › Milestones. THE BOARDS: `product/design/web/milestones*.html` on
// ieat-app main (built by `gen/src/boards/milestones.rs`).
//
// WHAT IS NOT HERE: the badge NAMES and CRITERIA — `BADGES` in `../milestones.ts`, Cal AI's own
// words until Kirill rules otherwise (open question on #1395) — and every number, which the
// caller fills (`{n}`, `{total}`, `{floor}`, `{day}`, `{next}`).
//
// A `lead` is the bold first sentence of a streak line; `rest` follows it, quiet. They are two
// strings because the client sets text with `textContent` only — no markup travels in copy.

import { dateMinus } from "../dates.ts";
import type { DaysResponse } from "../contract.ts";
import { LANG_TAG, fill, numbers, t, type CountForms, type Localized } from "../lang.ts";
import type { Lang } from "../types.ts";

export interface StreakLine { lead: string; rest?: string }

export interface MilestonesCopy {
  title: string;
  back: string;
  dayStreak: string;
  badgesEarned: string;
  /** "{n} days" under the flame, with the "longest streak" caption. */
  longestDays: CountForms;
  longestLabel: string;
  /** "{n}/{total} badges". */
  badgesOf: string;
  earned: string;
  locked: string;
  streak: {
    /** The big figure's caption — a count's noun, so plural forms (no `{n}`: the figure is drawn apart). */
    dayStreak: CountForms;
    dayStreakHeld: CountForms;
    /** The ended card's caption under "0". */
    days: CountForms;
    longest: string;
    /** The small word under a dashed dot whose day was under the calorie floor. */
    floor: string;
    /** Holding, today not yet logged — "{n}" is the figure it would reach. */
    logToday: string;
    /** Holding with no streak at all yet. */
    logToStart: string;
    /** Bent by a missed day that the next day held: `{day}` slipped, `{next}` held. */
    bentMissed: StreakLine;
    /** Bent by a day under the floor: `{day}` and `{next}` as above, `{floor}` the kcal figure. */
    bentFloor: StreakLine;
    /** The bent day is yesterday and today is not logged yet. */
    bentYesterday: StreakLine;
    bentFloorYesterday: StreakLine;
    /** The same two once today has counted: yesterday bent it, today held it. */
    bentYesterdayHeld: StreakLine;
    bentFloorYesterdayHeld: StreakLine;
    ended: StreakLine;
  };
  unlock: {
    heading: string;
    share: string;
    viewAll: string;
    notEnjoying: string;
    close: string;
  };
  settings: {
    celebrations: string;
    celebrationsSub: string;
    streakOnHome: string;
    streakOnHomeSub: string;
    note: string;
    saveFailed: string;
  };
}

const EN: MilestonesCopy = {
  title: "Milestones",
  back: "Back",
  dayStreak: "Day Streak",
  badgesEarned: "Badges earned",
  longestDays: { one: "{n} day", other: "{n} days" },
  longestLabel: "longest streak",
  badgesOf: "{n}/{total} badges",
  earned: "earned",
  locked: "locked",
  streak: {
    dayStreak: { other: "day streak" },
    dayStreakHeld: { other: "day streak, held" },
    days: { one: "day", other: "days" },
    longest: "Longest",
    floor: "floor",
    logToday: "Log today to make it {n}.",
    logToStart: "Log today to start your streak.",
    bentMissed: {
      lead: "{day} slipped; {next} held it.",
      rest: "One missed day bends the streak, two in a row end it. A bent day adds nothing, so it stays at {n}.",
    },
    bentFloor: {
      lead: "{day} stayed under {floor}, your floor.",
      rest: "A day under it does not count toward the streak or a badge, so it bent the streak like a missed day. {next} held it.",
    },
    bentYesterday: {
      lead: "Yesterday slipped; log today to hold it.",
      rest: "One missed day bends the streak, two in a row end it.",
    },
    bentFloorYesterday: { lead: "Yesterday stayed under {floor}kcal, your floor; log today to hold it." },
    bentYesterdayHeld: { lead: "Yesterday slipped; today held it." },
    bentFloorYesterdayHeld: { lead: "Yesterday stayed under {floor}kcal, your floor; today held it." },
    ended: {
      lead: "The streak ended at {n},",
      rest: "after two days in a row without a log. Your {n} days still count toward your badges. Log today to start again.",
    },
  },
  unlock: {
    heading: "Badge Unlocked",
    share: "Share Your Badge",
    viewAll: "View All Badges",
    notEnjoying: "Not enjoying badge celebrations?",
    close: "Close",
  },
  settings: {
    celebrations: "Badge celebrations",
    celebrationsSub: "A screen when you unlock a badge.",
    streakOnHome: "Streak on Home",
    streakOnHomeSub: "The flame and the count by the brand.",
    note: "Both are on by default. With celebrations off, badges still count on Milestones; nothing pops up. \"Not enjoying badge celebrations?\" opens this page.",
    saveFailed: "Couldn't save that. Try again.",
  },
};

const FR: MilestonesCopy = {
  title: "Étapes",
  back: "Retour",
  dayStreak: "Série de jours",
  badgesEarned: "Badges obtenus",
  longestDays: { one: "{n} jour", other: "{n} jours" },
  longestLabel: "plus longue série",
  badgesOf: "{n}/{total} badges",
  earned: "obtenu",
  locked: "verrouillé",
  streak: {
    dayStreak: { other: "jours de série" },
    dayStreakHeld: { other: "jours de série, maintenue" },
    days: { one: "jour", other: "jours" },
    longest: "Record",
    floor: "plancher",
    logToday: "Enregistre un repas aujourd'hui pour atteindre {n}.",
    logToStart: "Enregistre un repas aujourd'hui pour lancer ta série.",
    bentMissed: {
      lead: "{day} a flanché ; {next} l'a sauvée.",
      rest: "Un jour manqué plie la série, deux de suite la terminent. Un jour plié n'ajoute rien, elle reste à {n}.",
    },
    bentFloor: {
      lead: "{day} est resté sous {floor}, ton plancher.",
      rest: "Un jour en dessous ne compte ni pour la série ni pour un badge : il a plié la série comme un jour manqué. {next} l'a sauvée.",
    },
    bentYesterday: {
      lead: "Hier a flanché ; enregistre un repas aujourd'hui pour la sauver.",
      rest: "Un jour manqué plie la série, deux de suite la terminent.",
    },
    bentFloorYesterday: { lead: "Hier est resté sous {floor}, ton plancher ; enregistre un repas aujourd'hui pour la sauver." },
    bentYesterdayHeld: { lead: "Hier a flanché ; aujourd'hui l'a sauvée." },
    bentFloorYesterdayHeld: { lead: "Hier est resté sous {floor}, ton plancher ; aujourd'hui l'a sauvée." },
    ended: {
      lead: "La série s'est arrêtée à {n},",
      rest: "après deux jours de suite sans enregistrement. Tes {n} jours comptent toujours pour tes badges. Enregistre un repas aujourd'hui pour recommencer.",
    },
  },
  unlock: {
    heading: "Badge débloqué",
    share: "Partager mon badge",
    viewAll: "Voir tous les badges",
    notEnjoying: "Les célébrations de badges ne te plaisent pas ?",
    close: "Fermer",
  },
  settings: {
    celebrations: "Célébrations de badges",
    celebrationsSub: "Un écran quand tu débloques un badge.",
    streakOnHome: "Série sur l'accueil",
    streakOnHomeSub: "La flamme et le compteur à côté de la marque.",
    note: "Les deux sont activés par défaut. Sans célébrations, les badges comptent toujours dans Étapes ; rien ne s'affiche. « Les célébrations de badges ne te plaisent pas ? » ouvre cette page.",
    saveFailed: "Impossible d'enregistrer. Réessaie.",
  },
};

const DE: MilestonesCopy = {
  title: "Meilensteine",
  back: "Zurück",
  dayStreak: "Tage in Folge",
  badgesEarned: "Verdiente Abzeichen",
  longestDays: { one: "{n} Tag", other: "{n} Tage" },
  longestLabel: "längste Serie",
  badgesOf: "{n}/{total} Abzeichen",
  earned: "verdient",
  locked: "gesperrt",
  streak: {
    dayStreak: { other: "Tage in Folge" },
    dayStreakHeld: { other: "Tage in Folge, gehalten" },
    days: { one: "Tag", other: "Tage" },
    longest: "Längste",
    floor: "Untergrenze",
    logToday: "Trag heute etwas ein, dann sind es {n}.",
    logToStart: "Trag heute etwas ein, um deine Serie zu starten.",
    bentMissed: {
      lead: "{day} ist ausgefallen; {next} hat die Serie gehalten.",
      rest: "Ein verpasster Tag biegt die Serie, zwei hintereinander beenden sie. Ein gebogener Tag zählt nicht, die Serie bleibt bei {n}.",
    },
    bentFloor: {
      lead: "{day} lag unter {floor}, deiner Untergrenze.",
      rest: "Ein Tag darunter zählt weder für die Serie noch für ein Abzeichen, er hat die Serie wie ein verpasster Tag gebogen. {next} hat sie gehalten.",
    },
    bentYesterday: {
      lead: "Gestern ist ausgefallen; trag heute etwas ein, um die Serie zu halten.",
      rest: "Ein verpasster Tag biegt die Serie, zwei hintereinander beenden sie.",
    },
    bentFloorYesterday: { lead: "Gestern lag unter {floor}, deiner Untergrenze; trag heute etwas ein, um die Serie zu halten." },
    bentYesterdayHeld: { lead: "Gestern ist ausgefallen; heute hat die Serie gehalten." },
    bentFloorYesterdayHeld: { lead: "Gestern lag unter {floor}, deiner Untergrenze; heute hat die Serie gehalten." },
    ended: {
      lead: "Die Serie endete bei {n},",
      rest: "nach zwei Tagen hintereinander ohne Eintrag. Deine {n} Tage zählen weiter für deine Abzeichen. Trag heute etwas ein, um neu zu beginnen.",
    },
  },
  unlock: {
    heading: "Abzeichen freigeschaltet",
    share: "Abzeichen teilen",
    viewAll: "Alle Abzeichen ansehen",
    notEnjoying: "Gefallen dir die Abzeichen-Feiern nicht?",
    close: "Schließen",
  },
  settings: {
    celebrations: "Abzeichen-Feiern",
    celebrationsSub: "Ein Bildschirm, wenn du ein Abzeichen freischaltest.",
    streakOnHome: "Serie auf Start",
    streakOnHomeSub: "Die Flamme und die Zahl neben der Marke.",
    note: "Beides ist standardmäßig an. Ohne Feiern zählen Abzeichen weiter unter Meilensteine; nichts poppt auf. „Gefallen dir die Abzeichen-Feiern nicht?“ öffnet diese Seite.",
    saveFailed: "Das ließ sich nicht speichern. Versuch es noch einmal.",
  },
};

const IT: MilestonesCopy = {
  title: "Traguardi",
  back: "Indietro",
  dayStreak: "Giorni di fila",
  badgesEarned: "Badge ottenuti",
  longestDays: { one: "{n} giorno", other: "{n} giorni" },
  longestLabel: "serie più lunga",
  badgesOf: "{n}/{total} badge",
  earned: "ottenuto",
  locked: "bloccato",
  streak: {
    dayStreak: { other: "giorni di fila" },
    dayStreakHeld: { other: "giorni di fila, mantenuta" },
    days: { one: "giorno", other: "giorni" },
    longest: "Record",
    floor: "soglia",
    logToday: "Registra qualcosa oggi per arrivare a {n}.",
    logToStart: "Registra qualcosa oggi per iniziare la serie.",
    bentMissed: {
      lead: "{day} è saltato; {next} l'ha tenuta.",
      rest: "Un giorno saltato piega la serie, due di fila la chiudono. Un giorno piegato non aggiunge nulla, quindi resta a {n}.",
    },
    bentFloor: {
      lead: "{day} è rimasto sotto {floor}, la tua soglia.",
      rest: "Un giorno sotto la soglia non conta per la serie né per un badge, quindi ha piegato la serie come un giorno saltato. {next} l'ha tenuta.",
    },
    bentYesterday: {
      lead: "Ieri è saltato; registra qualcosa oggi per tenerla.",
      rest: "Un giorno saltato piega la serie, due di fila la chiudono.",
    },
    bentFloorYesterday: { lead: "Ieri è rimasto sotto {floor}, la tua soglia; registra qualcosa oggi per tenerla." },
    bentYesterdayHeld: { lead: "Ieri è saltato; oggi l'ha tenuta." },
    bentFloorYesterdayHeld: { lead: "Ieri è rimasto sotto {floor}, la tua soglia; oggi l'ha tenuta." },
    ended: {
      lead: "La serie è finita a {n},",
      rest: "dopo due giorni di fila senza registrazioni. I tuoi {n} giorni contano ancora per i badge. Registra qualcosa oggi per ricominciare.",
    },
  },
  unlock: {
    heading: "Badge sbloccato",
    share: "Condividi il badge",
    viewAll: "Vedi tutti i badge",
    notEnjoying: "Non ti piacciono le celebrazioni dei badge?",
    close: "Chiudi",
  },
  settings: {
    celebrations: "Celebrazioni dei badge",
    celebrationsSub: "Una schermata quando sblocchi un badge.",
    streakOnHome: "Serie nella Home",
    streakOnHomeSub: "La fiamma e il conteggio accanto al marchio.",
    note: "Entrambe sono attive di default. Con le celebrazioni spente, i badge contano comunque in Traguardi; non compare nulla. «Non ti piacciono le celebrazioni dei badge?» apre questa pagina.",
    saveFailed: "Non è stato possibile salvare. Riprova.",
  },
};

const ES: MilestonesCopy = {
  title: "Hitos",
  back: "Atrás",
  dayStreak: "Días de racha",
  badgesEarned: "Insignias logradas",
  longestDays: { one: "{n} día", other: "{n} días" },
  longestLabel: "racha más larga",
  badgesOf: "{n}/{total} insignias",
  earned: "lograda",
  locked: "bloqueada",
  streak: {
    dayStreak: { other: "días de racha" },
    dayStreakHeld: { other: "días de racha, mantenida" },
    days: { one: "día", other: "días" },
    longest: "Mejor",
    floor: "mínimo",
    logToday: "Registra algo hoy para llegar a {n}.",
    logToStart: "Registra algo hoy para empezar tu racha.",
    bentMissed: {
      lead: "{day} falló; {next} la sostuvo.",
      rest: "Un día perdido dobla la racha, dos seguidos la terminan. Un día doblado no suma, así que se queda en {n}.",
    },
    bentFloor: {
      lead: "{day} se quedó por debajo de {floor}, tu mínimo.",
      rest: "Un día por debajo no cuenta para la racha ni para una insignia, así que dobló la racha como un día perdido. {next} la sostuvo.",
    },
    bentYesterday: {
      lead: "Ayer falló; registra algo hoy para sostenerla.",
      rest: "Un día perdido dobla la racha, dos seguidos la terminan.",
    },
    bentFloorYesterday: { lead: "Ayer se quedó por debajo de {floor}, tu mínimo; registra algo hoy para sostenerla." },
    bentYesterdayHeld: { lead: "Ayer falló; hoy la sostuvo." },
    bentFloorYesterdayHeld: { lead: "Ayer se quedó por debajo de {floor}, tu mínimo; hoy la sostuvo." },
    ended: {
      lead: "La racha terminó en {n},",
      rest: "tras dos días seguidos sin registro. Tus {n} días siguen contando para tus insignias. Registra algo hoy para empezar de nuevo.",
    },
  },
  unlock: {
    heading: "Insignia desbloqueada",
    share: "Compartir tu insignia",
    viewAll: "Ver todas las insignias",
    notEnjoying: "¿No te gustan las celebraciones de insignias?",
    close: "Cerrar",
  },
  settings: {
    celebrations: "Celebraciones de insignias",
    celebrationsSub: "Una pantalla cuando desbloqueas una insignia.",
    streakOnHome: "Racha en Inicio",
    streakOnHomeSub: "La llama y la cuenta junto a la marca.",
    note: "Ambas vienen activadas. Con las celebraciones apagadas, las insignias siguen contando en Hitos; no aparece nada. «¿No te gustan las celebraciones de insignias?» abre esta página.",
    saveFailed: "No se pudo guardar. Inténtalo de nuevo.",
  },
};

const VI: MilestonesCopy = {
  title: "Cột mốc",
  back: "Quay lại",
  dayStreak: "Chuỗi ngày",
  badgesEarned: "Huy hiệu đã nhận",
  longestDays: { other: "{n} ngày" },
  longestLabel: "chuỗi dài nhất",
  badgesOf: "{n}/{total} huy hiệu",
  earned: "đã nhận",
  locked: "đang khóa",
  streak: {
    dayStreak: { other: "ngày liên tiếp" },
    dayStreakHeld: { other: "ngày liên tiếp, vẫn giữ" },
    days: { other: "ngày" },
    longest: "Dài nhất",
    floor: "mức sàn",
    logToday: "Ghi bữa ăn hôm nay để lên {n}.",
    logToStart: "Ghi bữa ăn hôm nay để bắt đầu chuỗi.",
    bentMissed: {
      lead: "{day} bị lỡ; {next} đã giữ chuỗi.",
      rest: "Lỡ một ngày làm chuỗi bị cong, lỡ hai ngày liên tiếp thì chuỗi kết thúc. Ngày bị cong không được cộng thêm, nên chuỗi vẫn là {n}.",
    },
    bentFloor: {
      lead: "{day} thấp hơn {floor}, mức sàn của bạn.",
      rest: "Ngày dưới mức này không tính vào chuỗi hay huy hiệu, nên nó làm chuỗi cong như một ngày bị lỡ. {next} đã giữ chuỗi.",
    },
    bentYesterday: {
      lead: "Hôm qua bị lỡ; hãy ghi bữa ăn hôm nay để giữ chuỗi.",
      rest: "Lỡ một ngày làm chuỗi bị cong, lỡ hai ngày liên tiếp thì chuỗi kết thúc.",
    },
    bentFloorYesterday: { lead: "Hôm qua thấp hơn {floor}, mức sàn của bạn; hãy ghi bữa ăn hôm nay để giữ chuỗi." },
    bentYesterdayHeld: { lead: "Hôm qua bị lỡ; hôm nay đã giữ chuỗi." },
    bentFloorYesterdayHeld: { lead: "Hôm qua thấp hơn {floor}, mức sàn của bạn; hôm nay đã giữ chuỗi." },
    ended: {
      lead: "Chuỗi đã kết thúc ở {n},",
      rest: "sau hai ngày liên tiếp không ghi gì. {n} ngày của bạn vẫn được tính cho huy hiệu. Hãy ghi bữa ăn hôm nay để bắt đầu lại.",
    },
  },
  unlock: {
    heading: "Đã mở khóa huy hiệu",
    share: "Chia sẻ huy hiệu",
    viewAll: "Xem tất cả huy hiệu",
    notEnjoying: "Không thích màn chúc mừng huy hiệu?",
    close: "Đóng",
  },
  settings: {
    celebrations: "Chúc mừng huy hiệu",
    celebrationsSub: "Một màn hình khi bạn mở khóa huy hiệu.",
    streakOnHome: "Chuỗi ngày ở Trang chủ",
    streakOnHomeSub: "Ngọn lửa và số đếm cạnh thương hiệu.",
    note: "Cả hai đều bật sẵn. Khi tắt chúc mừng, huy hiệu vẫn được tính trong Cột mốc; không có gì hiện lên. \"Không thích màn chúc mừng huy hiệu?\" mở trang này.",
    saveFailed: "Không lưu được. Hãy thử lại.",
  },
};

const ID: MilestonesCopy = {
  title: "Pencapaian",
  back: "Kembali",
  dayStreak: "Hari beruntun",
  badgesEarned: "Lencana diraih",
  longestDays: { other: "{n} hari" },
  longestLabel: "rekor terpanjang",
  badgesOf: "{n}/{total} lencana",
  earned: "diraih",
  locked: "terkunci",
  streak: {
    dayStreak: { other: "hari beruntun" },
    dayStreakHeld: { other: "hari beruntun, bertahan" },
    days: { other: "hari" },
    longest: "Terpanjang",
    floor: "batas bawah",
    logToday: "Catat hari ini agar jadi {n}.",
    logToStart: "Catat hari ini untuk memulai rangkaianmu.",
    bentMissed: {
      lead: "{day} terlewat; {next} menjaganya.",
      rest: "Satu hari terlewat membengkokkan rangkaian, dua hari berturut-turut mengakhirinya. Hari yang bengkok tidak menambah apa pun, jadi tetap {n}.",
    },
    bentFloor: {
      lead: "{day} di bawah {floor}, batas bawahmu.",
      rest: "Hari di bawah batas itu tidak dihitung untuk rangkaian atau lencana, jadi ia membengkokkan rangkaian seperti hari yang terlewat. {next} menjaganya.",
    },
    bentYesterday: {
      lead: "Kemarin terlewat; catat hari ini untuk menjaganya.",
      rest: "Satu hari terlewat membengkokkan rangkaian, dua hari berturut-turut mengakhirinya.",
    },
    bentFloorYesterday: { lead: "Kemarin di bawah {floor}, batas bawahmu; catat hari ini untuk menjaganya." },
    bentYesterdayHeld: { lead: "Kemarin terlewat; hari ini menjaganya." },
    bentFloorYesterdayHeld: { lead: "Kemarin di bawah {floor}, batas bawahmu; hari ini menjaganya." },
    ended: {
      lead: "Rangkaian berakhir di {n},",
      rest: "setelah dua hari berturut-turut tanpa catatan. {n} harimu tetap dihitung untuk lencana. Catat hari ini untuk memulai lagi.",
    },
  },
  unlock: {
    heading: "Lencana terbuka",
    share: "Bagikan lencana",
    viewAll: "Lihat semua lencana",
    notEnjoying: "Tidak suka perayaan lencana?",
    close: "Tutup",
  },
  settings: {
    celebrations: "Perayaan lencana",
    celebrationsSub: "Satu layar saat kamu membuka lencana.",
    streakOnHome: "Rangkaian di Beranda",
    streakOnHomeSub: "Api dan hitungannya di samping merek.",
    note: "Keduanya aktif secara bawaan. Saat perayaan mati, lencana tetap dihitung di Pencapaian; tidak ada yang muncul. \"Tidak suka perayaan lencana?\" membuka halaman ini.",
    saveFailed: "Tidak bisa menyimpan. Coba lagi.",
  },
};

const RU: MilestonesCopy = {
  title: "Достижения",
  back: "Назад",
  dayStreak: "Дней подряд",
  badgesEarned: "Получено значков",
  longestDays: { one: "{n} день", few: "{n} дня", many: "{n} дней", other: "{n} дня" },
  longestLabel: "самая длинная серия",
  badgesOf: "{n}/{total} значков",
  earned: "получен",
  locked: "закрыт",
  streak: {
    dayStreak: { one: "день подряд", few: "дня подряд", many: "дней подряд", other: "дня подряд" },
    dayStreakHeld: { one: "день подряд, серия держится", few: "дня подряд, серия держится", many: "дней подряд, серия держится", other: "дня подряд, серия держится" },
    days: { one: "день", few: "дня", many: "дней", other: "дня" },
    longest: "Рекорд",
    floor: "минимум",
    logToday: "Запиши что-нибудь сегодня, чтобы стало {n}.",
    logToStart: "Запиши что-нибудь сегодня, чтобы начать серию.",
    bentMissed: {
      lead: "{day} пропущен; {next} серию удержал.",
      rest: "Один пропущенный день сгибает серию, два подряд её обрывают. Согнутый день ничего не добавляет, поэтому серия остаётся на {n}.",
    },
    bentFloor: {
      lead: "{day} не дотянул до {floor}, твоего минимума.",
      rest: "День ниже минимума не считается ни в серию, ни в значок, поэтому он согнул серию как пропущенный. {next} серию удержал.",
    },
    bentYesterday: {
      lead: "Вчера пропущено; запиши что-нибудь сегодня, чтобы удержать серию.",
      rest: "Один пропущенный день сгибает серию, два подряд её обрывают.",
    },
    bentFloorYesterday: { lead: "Вчера не дотянуло до {floor}, твоего минимума; запиши что-нибудь сегодня, чтобы удержать серию." },
    bentYesterdayHeld: { lead: "Вчера пропущено; сегодня серия удержана." },
    bentFloorYesterdayHeld: { lead: "Вчера не дотянуло до {floor}, твоего минимума; сегодня серия удержана." },
    ended: {
      lead: "Серия закончилась на {n},",
      rest: "после двух дней подряд без записей. Твои {n} дней по-прежнему идут в зачёт значков. Запиши что-нибудь сегодня, чтобы начать заново.",
    },
  },
  unlock: {
    heading: "Значок открыт",
    share: "Поделиться значком",
    viewAll: "Все значки",
    notEnjoying: "Не нравятся праздники значков?",
    close: "Закрыть",
  },
  settings: {
    celebrations: "Праздники значков",
    celebrationsSub: "Экран, когда ты открываешь значок.",
    streakOnHome: "Серия на главной",
    streakOnHomeSub: "Огонёк и число рядом с логотипом.",
    note: "Оба включены по умолчанию. Если праздники выключены, значки всё равно считаются в Достижениях; ничего не всплывает. «Не нравятся праздники значков?» открывает эту страницу.",
    saveFailed: "Не удалось сохранить. Попробуй ещё раз.",
  },
};

const NL: MilestonesCopy = {
  title: "Mijlpalen",
  back: "Terug",
  dayStreak: "Dagen op rij",
  badgesEarned: "Verdiende badges",
  longestDays: { one: "{n} dag", other: "{n} dagen" },
  longestLabel: "langste reeks",
  badgesOf: "{n}/{total} badges",
  earned: "verdiend",
  locked: "vergrendeld",
  streak: {
    dayStreak: { other: "dagen op rij" },
    dayStreakHeld: { other: "dagen op rij, vastgehouden" },
    days: { one: "dag", other: "dagen" },
    longest: "Langste",
    floor: "ondergrens",
    logToday: "Log vandaag om er {n} van te maken.",
    logToStart: "Log vandaag om je reeks te starten.",
    bentMissed: {
      lead: "{day} ging mis; {next} hield hem vast.",
      rest: "Eén gemiste dag buigt de reeks, twee op rij beëindigen hem. Een gebogen dag telt niet mee, dus hij blijft op {n}.",
    },
    bentFloor: {
      lead: "{day} bleef onder {floor}, je ondergrens.",
      rest: "Een dag daaronder telt niet mee voor de reeks of een badge, dus hij boog de reeks net als een gemiste dag. {next} hield hem vast.",
    },
    bentYesterday: {
      lead: "Gisteren ging mis; log vandaag om hem vast te houden.",
      rest: "Eén gemiste dag buigt de reeks, twee op rij beëindigen hem.",
    },
    bentFloorYesterday: { lead: "Gisteren bleef onder {floor}kcal, je ondergrens; log vandaag om hem vast te houden." },
    bentYesterdayHeld: { lead: "Gisteren ging mis; vandaag hield hem vast." },
    bentFloorYesterdayHeld: { lead: "Gisteren bleef onder {floor}kcal, je ondergrens; vandaag hield hem vast." },
    ended: {
      lead: "De reeks eindigde op {n},",
      rest: "na twee dagen op rij zonder log. Je {n} dagen tellen nog steeds mee voor je badges. Log vandaag om opnieuw te beginnen.",
    },
  },
  unlock: {
    heading: "Badge ontgrendeld",
    share: "Deel je badge",
    viewAll: "Bekijk alle badges",
    notEnjoying: "Geen fan van badgevieringen?",
    close: "Sluit",
  },
  settings: {
    celebrations: "Badgevieringen",
    celebrationsSub: "Een scherm als je een badge ontgrendelt.",
    streakOnHome: "Reeks op Home",
    streakOnHomeSub: "De vlam en het aantal naast het logo.",
    note: "Beide staan standaard aan. Met vieringen uit tellen badges nog steeds mee bij Mijlpalen; er springt niets op. “Geen fan van badgevieringen?” opent deze pagina.",
    saveFailed: "Opslaan lukte niet. Probeer het opnieuw.",
  },
};

const PL: MilestonesCopy = {
  title: "Osiągnięcia",
  back: "Wstecz",
  dayStreak: "Dni z rzędu",
  badgesEarned: "Zdobyte odznaki",
  longestDays: { one: "{n} dzień", other: "{n} dni" },
  longestLabel: "najdłuższa seria",
  badgesOf: "Odznaki: {n}/{total}",
  earned: "zdobyta",
  locked: "zablokowana",
  streak: {
    dayStreak: { other: "dni z rzędu" },
    dayStreakHeld: { other: "dni z rzędu, seria trwa" },
    days: { one: "dzień", other: "dni" },
    longest: "Rekord",
    floor: "minimum",
    logToday: "Zapisz coś dziś, aby było {n}.",
    logToStart: "Zapisz coś dziś, aby zacząć serię.",
    bentMissed: {
      lead: "{day} — przerwa; {next} — seria utrzymana.",
      rest: "Jeden pominięty dzień nagina serię, dwa z rzędu ją kończą. Nagięty dzień nic nie dodaje, więc seria zostaje na {n}.",
    },
    bentFloor: {
      lead: "{day} — poniżej {floor}, twojego minimum.",
      rest: "Dzień poniżej minimum nie liczy się do serii ani do odznaki, więc nagiął serię jak dzień pominięty. {next} — seria utrzymana.",
    },
    bentYesterday: {
      lead: "Wczoraj — przerwa; zapisz coś dziś, aby utrzymać serię.",
      rest: "Jeden pominięty dzień nagina serię, dwa z rzędu ją kończą.",
    },
    bentFloorYesterday: { lead: "Wczoraj poniżej {floor}kcal, twojego minimum; zapisz coś dziś, aby utrzymać serię." },
    bentYesterdayHeld: { lead: "Wczoraj — przerwa; dziś seria utrzymana." },
    bentFloorYesterdayHeld: { lead: "Wczoraj poniżej {floor}kcal, twojego minimum; dziś seria utrzymana." },
    ended: {
      lead: "Seria zakończyła się na {n},",
      rest: "po dwóch dniach z rzędu bez zapisu. Twoje {n} dni nadal liczą się do odznak. Zapisz coś dziś, aby zacząć od nowa.",
    },
  },
  unlock: {
    heading: "Odznaka odblokowana",
    share: "Udostępnij odznakę",
    viewAll: "Zobacz wszystkie odznaki",
    notEnjoying: "Nie lubisz świętowania odznak?",
    close: "Zamknij",
  },
  settings: {
    celebrations: "Świętowanie odznak",
    celebrationsSub: "Ekran po odblokowaniu odznaki.",
    streakOnHome: "Seria na ekranie głównym",
    streakOnHomeSub: "Płomień i licznik obok logo.",
    note: "Oba są domyślnie włączone. Gdy świętowanie jest wyłączone, odznaki nadal liczą się w Osiągnięciach; nic nie wyskakuje. „Nie lubisz świętowania odznak?” otwiera tę stronę.",
    saveFailed: "Nie udało się zapisać. Spróbuj ponownie.",
  },
};

const TR: MilestonesCopy = {
  title: "Kilometre taşları",
  back: "Geri",
  dayStreak: "Günlük Seri",
  badgesEarned: "Kazanılan rozetler",
  longestDays: { one: "{n} gün", other: "{n} gün" },
  longestLabel: "en uzun seri",
  badgesOf: "{n}/{total} rozet",
  earned: "kazanıldı",
  locked: "kilitli",
  streak: {
    dayStreak: { other: "günlük seri" },
    dayStreakHeld: { other: "günlük seri, korundu" },
    days: { one: "gün", other: "gün" },
    longest: "En uzun",
    floor: "alt sınır",
    logToday: "Bugün kayıt yap, seri {n} olsun.",
    logToStart: "Serini başlatmak için bugün kayıt yap.",
    bentMissed: {
      lead: "{day} kaçtı; seriyi {next} korudu.",
      rest: "Kaçırılan bir gün seriyi büker, art arda iki gün bitirir. Bükülen gün bir şey eklemez, bu yüzden seri {n} olarak kalır.",
    },
    bentFloor: {
      lead: "{day}, alt sınırın olan {floor} altında kaldı.",
      rest: "Alt sınırın altında kalan bir gün seriye ya da rozete sayılmaz, bu yüzden seriyi kaçırılan bir gün gibi büktü. Seriyi {next} korudu.",
    },
    bentYesterday: {
      lead: "Dün kaçtı; seriyi korumak için bugün kayıt yap.",
      rest: "Kaçırılan bir gün seriyi büker, art arda iki gün bitirir.",
    },
    bentFloorYesterday: { lead: "Dün, alt sınırın olan {floor}kcal altında kaldı; seriyi korumak için bugün kayıt yap." },
    bentYesterdayHeld: { lead: "Dün kaçtı; seriyi bugün korudu." },
    bentFloorYesterdayHeld: { lead: "Dün, alt sınırın olan {floor}kcal altında kaldı; seriyi bugün korudu." },
    ended: {
      lead: "Seri {n} günde sona erdi,",
      rest: "çünkü art arda iki gün kayıt yapılmadı. {n} günün rozetlerin için hâlâ sayılıyor. Yeniden başlamak için bugün kayıt yap.",
    },
  },
  unlock: {
    heading: "Rozet Açıldı",
    share: "Rozetini Paylaş",
    viewAll: "Tüm Rozetleri Gör",
    notEnjoying: "Rozet kutlamalarını sevmedin mi?",
    close: "Kapat",
  },
  settings: {
    celebrations: "Rozet kutlamaları",
    celebrationsSub: "Bir rozet açtığında gösterilen ekran.",
    streakOnHome: "Ana ekranda seri",
    streakOnHomeSub: "Logonun yanındaki alev ve sayı.",
    note: "İkisi de varsayılan olarak açık. Kutlamalar kapalıyken rozetler Kilometre taşları'nda sayılmaya devam eder; hiçbir şey açılmaz. \"Rozet kutlamalarını sevmedin mi?\" bu sayfayı açar.",
    saveFailed: "Kaydedilemedi. Tekrar dene.",
  },
};

const ZH_HANT: MilestonesCopy = {
  title: "里程碑",
  back: "返回",
  dayStreak: "連續天數",
  badgesEarned: "已獲得的徽章",
  longestDays: { one: "{n} 天", other: "{n} 天" },
  longestLabel: "最長連續紀錄",
  badgesOf: "{n}/{total} 個徽章",
  earned: "已獲得",
  locked: "未解鎖",
  streak: {
    dayStreak: { other: "天連續紀錄" },
    dayStreakHeld: { other: "天連續紀錄，已保住" },
    days: { one: "天", other: "天" },
    longest: "最長",
    floor: "下限",
    logToday: "今天記錄就能達到 {n} 天。",
    logToStart: "今天記錄，開始你的連續紀錄。",
    bentMissed: {
      lead: "{day}漏記了；{next}保住了連續紀錄。",
      rest: "漏記一天，連續紀錄會出現缺口；連續漏記兩天就會中斷。有缺口的那天不計入，所以維持在 {n}。",
    },
    bentFloor: {
      lead: "{day}低於你的下限 {floor}。",
      rest: "低於下限的那天不計入連續紀錄或徽章，所以它和漏記一天一樣，讓連續紀錄出現缺口。{next}保住了它。",
    },
    bentYesterday: {
      lead: "昨天漏記了；今天記錄就能保住連續紀錄。",
      rest: "漏記一天，連續紀錄會出現缺口；連續漏記兩天就會中斷。",
    },
    bentFloorYesterday: { lead: "昨天低於你的下限 {floor} 大卡；今天記錄就能保住連續紀錄。" },
    bentYesterdayHeld: { lead: "昨天漏記了；今天保住了連續紀錄。" },
    bentFloorYesterdayHeld: { lead: "昨天低於你的下限 {floor} 大卡；今天保住了連續紀錄。" },
    ended: {
      lead: "連續紀錄停在 {n}，",
      rest: "因為連續兩天沒有記錄。這 {n} 天仍會計入你的徽章。今天記錄就能重新開始。",
    },
  },
  unlock: {
    heading: "徽章已解鎖",
    share: "分享你的徽章",
    viewAll: "查看所有徽章",
    notEnjoying: "不喜歡徽章慶祝畫面？",
    close: "關閉",
  },
  settings: {
    celebrations: "徽章慶祝畫面",
    celebrationsSub: "解鎖徽章時顯示一個畫面。",
    streakOnHome: "在首頁顯示連續紀錄",
    streakOnHomeSub: "品牌名稱旁的火焰和天數。",
    note: "兩者預設都是開啟。關閉慶祝畫面後，徽章仍會計入「里程碑」，只是不會跳出畫面。「不喜歡徽章慶祝畫面？」會打開這個頁面。",
    saveFailed: "無法儲存，請再試一次。",
  },
};

const ZH_HANS: MilestonesCopy = {
  title: "里程碑",
  back: "返回",
  dayStreak: "连续天数",
  badgesEarned: "已获得徽章",
  longestDays: { one: "{n} 天", other: "{n} 天" },
  longestLabel: "最长连续",
  badgesOf: "{n}/{total} 枚徽章",
  earned: "已获得",
  locked: "未解锁",
  streak: {
    dayStreak: { other: "天连续记录" },
    dayStreakHeld: { other: "天连续记录，已保住" },
    days: { one: "天", other: "天" },
    longest: "最长",
    floor: "下限",
    logToday: "今天记录一下，就能到 {n}。",
    logToStart: "今天记录一下，开始你的连续记录。",
    bentMissed: {
      lead: "{day}漏掉了；{next}把它保住了。",
      rest: "漏掉一天，连续记录会弯折；连续漏掉两天，就会中断。弯折的那天不计数，所以仍停在 {n}。",
    },
    bentFloor: {
      lead: "{day}低于你的下限 {floor}。",
      rest: "低于下限的一天不计入连续记录和徽章，所以它像漏掉的一天一样让连续记录弯折了。{next}把它保住了。",
    },
    bentYesterday: {
      lead: "昨天漏掉了；今天记录一下就能保住。",
      rest: "漏掉一天，连续记录会弯折；连续漏掉两天，就会中断。",
    },
    bentFloorYesterday: { lead: "昨天低于你的下限 {floor}千卡；今天记录一下就能保住。" },
    bentYesterdayHeld: { lead: "昨天漏掉了；今天把它保住了。" },
    bentFloorYesterdayHeld: { lead: "昨天低于你的下限 {floor}千卡；今天把它保住了。" },
    ended: {
      lead: "连续记录停在了 {n}，",
      rest: "因为连续两天没有记录。你的 {n} 天仍然计入徽章。今天记录一下，重新开始。",
    },
  },
  unlock: {
    heading: "徽章已解锁",
    share: "分享你的徽章",
    viewAll: "查看所有徽章",
    notEnjoying: "不喜欢徽章庆祝？",
    close: "关闭",
  },
  settings: {
    celebrations: "徽章庆祝",
    celebrationsSub: "解锁徽章时显示一个页面。",
    streakOnHome: "在首页显示连续记录",
    streakOnHomeSub: "品牌标志旁的火焰和天数。",
    note: "两项默认都开启。关闭庆祝后，徽章仍会在里程碑中计数，只是不会弹出。“不喜欢徽章庆祝？”会打开这个页面。",
    saveFailed: "没能保存。再试一次。",
  },
};

const KO: MilestonesCopy = {
  title: "업적",
  back: "뒤로",
  dayStreak: "연속 일수",
  badgesEarned: "획득한 배지",
  longestDays: { one: "{n}일", other: "{n}일" },
  longestLabel: "최장 연속 기록",
  badgesOf: "배지 {n}/{total}개",
  earned: "획득",
  locked: "잠김",
  streak: {
    dayStreak: { other: "일 연속" },
    dayStreakHeld: { other: "일 연속, 유지 중" },
    days: { one: "일", other: "일" },
    longest: "최장 기록",
    floor: "최솟값",
    logToday: "오늘 기록하면 {n}일이 돼요.",
    logToStart: "오늘 기록하고 연속 기록을 시작해 보세요.",
    bentMissed: {
      lead: "{day}은(는) 놓쳤지만 {next}에 다시 이어졌어요.",
      rest: "하루를 놓치면 연속 기록이 흔들리고, 이틀 연속 놓치면 끝나요. 흔들린 날은 더해지지 않아서 {n}일에 머물러 있어요.",
    },
    bentFloor: {
      lead: "{day}은(는) 최솟값인 {floor}에 못 미쳤어요.",
      rest: "최솟값보다 낮은 날은 연속 기록이나 배지에 포함되지 않아서, 놓친 날처럼 연속 기록이 흔들렸어요. {next}에 다시 이어졌어요.",
    },
    bentYesterday: {
      lead: "어제는 놓쳤어요. 오늘 기록하면 이어져요.",
      rest: "하루를 놓치면 연속 기록이 흔들리고, 이틀 연속 놓치면 끝나요.",
    },
    bentFloorYesterday: { lead: "어제는 최솟값인 {floor}kcal에 못 미쳤어요. 오늘 기록하면 이어져요." },
    bentYesterdayHeld: { lead: "어제는 놓쳤지만 오늘 이어졌어요." },
    bentFloorYesterdayHeld: { lead: "어제는 최솟값인 {floor}kcal에 못 미쳤지만 오늘 이어졌어요." },
    ended: {
      lead: "연속 기록이 {n}일에서 끝났어요.",
      rest: "이틀 연속 기록이 없었기 때문이에요. 그동안의 {n}일은 배지에 계속 반영돼요. 오늘 기록하고 다시 시작해 보세요.",
    },
  },
  unlock: {
    heading: "배지 획득",
    share: "배지 공유하기",
    viewAll: "모든 배지 보기",
    notEnjoying: "배지 축하 화면이 별로인가요?",
    close: "닫기",
  },
  settings: {
    celebrations: "배지 축하",
    celebrationsSub: "배지를 얻으면 축하 화면이 떠요.",
    streakOnHome: "홈에 연속 기록 표시",
    streakOnHomeSub: "로고 옆의 불꽃과 숫자예요.",
    note: "둘 다 기본으로 켜져 있어요. 축하를 꺼도 배지는 업적에 계속 쌓이고, 화면만 뜨지 않아요. \"배지 축하 화면이 별로인가요?\"를 누르면 이 페이지가 열려요.",
    saveFailed: "저장하지 못했어요. 다시 시도해 주세요.",
  },
};

const JA: MilestonesCopy = {
  title: "マイルストーン",
  back: "戻る",
  dayStreak: "連続記録",
  badgesEarned: "獲得したバッジ",
  longestDays: { one: "{n}日", other: "{n}日" },
  longestLabel: "最長連続記録",
  badgesOf: "バッジ {n}/{total}",
  earned: "獲得済み",
  locked: "未獲得",
  streak: {
    dayStreak: { other: "日連続" },
    dayStreakHeld: { other: "日連続（キープ）" },
    days: { one: "日", other: "日" },
    longest: "最長",
    floor: "下限",
    logToday: "今日記録すると{n}日になります。",
    logToStart: "今日記録して、連続記録をスタートしましょう。",
    bentMissed: {
      lead: "{day}は記録が途切れましたが、{next}でつなぎました。",
      rest: "1日抜けると連続記録は「曲がり」、2日続けて抜けると途切れます。曲がった日はカウントされないため、{n}のままです。",
    },
    bentFloor: {
      lead: "{day}は下限の{floor}を下回りました。",
      rest: "下限を下回った日は連続記録にもバッジにもカウントされないため、記録がない日と同じく連続記録が曲がりました。{next}でつなぎました。",
    },
    bentYesterday: {
      lead: "昨日は記録が途切れました。今日記録してつなぎましょう。",
      rest: "1日抜けると連続記録は「曲がり」、2日続けて抜けると途切れます。",
    },
    bentFloorYesterday: { lead: "昨日は下限の{floor}kcalを下回りました。今日記録してつなぎましょう。" },
    bentYesterdayHeld: { lead: "昨日は記録が途切れましたが、今日でつなぎました。" },
    bentFloorYesterdayHeld: { lead: "昨日は下限の{floor}kcalを下回りましたが、今日でつなぎました。" },
    ended: {
      lead: "連続記録は{n}日で途切れました。",
      rest: "2日続けて記録がなかったためです。これまでの{n}日はバッジにカウントされます。今日記録して、また始めましょう。",
    },
  },
  unlock: {
    heading: "バッジを獲得しました",
    share: "バッジをシェア",
    viewAll: "すべてのバッジを見る",
    notEnjoying: "バッジのお祝い表示が気になりますか？",
    close: "閉じる",
  },
  settings: {
    celebrations: "バッジのお祝い",
    celebrationsSub: "バッジを獲得したときに画面を表示します。",
    streakOnHome: "ホームに連続記録を表示",
    streakOnHomeSub: "ロゴの横に炎と日数を表示します。",
    note: "どちらも初期設定でオンです。お祝いをオフにしても、バッジはマイルストーンでカウントされ、何も表示されなくなるだけです。「バッジのお祝い表示が気になりますか？」からこのページを開けます。",
    saveFailed: "保存できませんでした。もう一度お試しください。",
  },
};

const PT_BR: MilestonesCopy = {
  title: "Marcos",
  back: "Voltar",
  dayStreak: "Sequência de dias",
  badgesEarned: "Selos conquistados",
  longestDays: { one: "{n} dia", other: "{n} dias" },
  longestLabel: "maior sequência",
  badgesOf: "{n}/{total} selos",
  earned: "conquistado",
  locked: "bloqueado",
  streak: {
    dayStreak: { other: "dias de sequência" },
    dayStreakHeld: { other: "dias de sequência, mantida" },
    days: { one: "dia", other: "dias" },
    longest: "Recorde",
    floor: "piso",
    logToday: "Registre hoje para chegar a {n}.",
    logToStart: "Registre hoje para começar sua sequência.",
    bentMissed: {
      lead: "{day} falhou; {next} a segurou.",
      rest: "Um dia perdido entorta a sequência, dois seguidos a encerram. Um dia entortado não soma nada, então ela fica em {n}.",
    },
    bentFloor: {
      lead: "{day} ficou abaixo de {floor}, seu piso.",
      rest: "Um dia abaixo dele não conta para a sequência nem para um selo, então entortou a sequência como um dia perdido. {next} a segurou.",
    },
    bentYesterday: {
      lead: "Ontem falhou; registre hoje para segurar a sequência.",
      rest: "Um dia perdido entorta a sequência, dois seguidos a encerram.",
    },
    bentFloorYesterday: { lead: "Ontem ficou abaixo de {floor}kcal, seu piso; registre hoje para segurar a sequência." },
    bentYesterdayHeld: { lead: "Ontem falhou; hoje segurou a sequência." },
    bentFloorYesterdayHeld: { lead: "Ontem ficou abaixo de {floor}kcal, seu piso; hoje segurou a sequência." },
    ended: {
      lead: "A sequência terminou em {n},",
      rest: "depois de dois dias seguidos sem registro. Seus {n} dias continuam contando para seus selos. Registre hoje para começar de novo.",
    },
  },
  unlock: {
    heading: "Selo desbloqueado",
    share: "Compartilhar seu selo",
    viewAll: "Ver todos os selos",
    notEnjoying: "Não curte as comemorações de selos?",
    close: "Fechar",
  },
  settings: {
    celebrations: "Comemorações de selos",
    celebrationsSub: "Uma tela quando você desbloqueia um selo.",
    streakOnHome: "Sequência no Início",
    streakOnHomeSub: "A chama e a contagem ao lado da marca.",
    note: "As duas vêm ativadas por padrão. Com as comemorações desativadas, os selos continuam contando em Marcos; nada aparece na tela. “Não curte as comemorações de selos?” abre esta página.",
    saveFailed: "Não deu para salvar. Tente de novo.",
  },
};

export const MILESTONES_COPY: Localized<MilestonesCopy> = {
  en: EN, fr: FR, de: DE, it: IT, es: ES, vi: VI, id: ID, ru: RU, nl: NL, pl: PL, tr: TR, "zh-Hant": ZH_HANT, "zh-Hans": ZH_HANS, ko: KO, ja: JA, "pt-BR": PT_BR,
};

export const milestonesCopyFor = (lang: Lang): MilestonesCopy => t(lang)(MILESTONES_COPY);

/**
 * The one honest line under the streak card (`web/milestones-streak.html`, `phone/milestones-streak.html`):
 * which day bent it and why, or what to do next. `lead` is the bold first sentence, `rest` the quiet
 * one; null where the card says nothing. `floor` is the account's floor already formatted with its
 * unit — this file formats no kcal. Both clients draw this, so the two cannot word a state apart.
 */
export function streakCardLine(
  d: DaysResponse,
  c: MilestonesCopy["streak"],
  lang: Lang,
  floor: string,
): { lead?: string; rest?: string } | null {
  const n = numbers(lang);
  const tag = LANG_TAG[lang];
  const weekday = (date: string): string =>
    new Intl.DateTimeFormat(tag, { weekday: "long", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
  const cap = (w: string): string => w.charAt(0).toLocaleUpperCase(tag) + w.slice(1);
  const line = (l: StreakLine, lead: Record<string, string>, rest: Record<string, string>) => ({
    lead: fill(l.lead, lead),
    ...(l.rest !== undefined ? { rest: fill(l.rest, rest) } : {}),
  });
  const today = d.days.find((x) => x.when === "today");
  if (d.streakState === "ended") {
    const at = n(d.streakEndedAt);
    return line(c.ended, { n: at }, { n: at });
  }
  if (d.streakState === "bent") {
    const bent = [...d.days].reverse().find((x) => x.streak === "bent");
    if (bent === undefined) return { rest: fill(c.bentMissed.rest ?? "", { n: n(d.streak) }) };
    if (today !== undefined && bent.date === dateMinus(today.date, 1)) {
      const held = today.streak === "counted";
      const l = bent.underFloor
        ? (held ? c.bentFloorYesterdayHeld : c.bentFloorYesterday)
        : (held ? c.bentYesterdayHeld : c.bentYesterday);
      return line(l, { floor }, { n: n(d.streak) });
    }
    const next = weekday(dateMinus(bent.date, -1));
    return line(bent.underFloor ? c.bentFloor : c.bentMissed, { day: cap(weekday(bent.date)), next, floor }, { next: cap(next), n: n(d.streak) });
  }
  if (d.streak === 0) return { rest: c.logToStart };
  if (today?.streak === "pending") return { rest: fill(c.logToday, { n: n(d.streak + 1) }) };
  return null;
}
