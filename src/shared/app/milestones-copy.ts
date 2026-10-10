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

export const MILESTONES_COPY: Localized<MilestonesCopy> = {
  en: EN, fr: FR, de: DE, it: IT, es: ES, vi: VI, id: ID, ru: RU,
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
