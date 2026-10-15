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

const TE: MilestonesCopy = {
  title: "మైలురాళ్ళు",
  back: "వెనుకకు",
  dayStreak: "రోజుల స్ట్రీక్",
  badgesEarned: "లభించిన బ్యాడ్జ్‌లు",
  longestDays: { one: "{n} రోజు", other: "{n} రోజులు" },
  longestLabel: "అతి పొడవైన స్ట్రీక్",
  badgesOf: "{n}/{total} బ్యాడ్జ్‌లు",
  earned: "లభించింది",
  locked: "లాక్ అయింది",
  streak: {
    dayStreak: { other: "రోజుల స్ట్రీక్" },
    dayStreakHeld: { other: "రోజుల స్ట్రీక్, నిలిచింది" },
    days: { one: "రోజు", other: "రోజులు" },
    longest: "అతి పొడవైనది",
    floor: "కనీస పరిమితి",
    logToday: "దీన్ని {n} చేయడానికి ఈరోజు నమోదు చేయండి.",
    logToStart: "మీ స్ట్రీక్ మొదలుపెట్టడానికి ఈరోజు నమోదు చేయండి.",
    bentMissed: {
      lead: "{day} తప్పిపోయింది; {next} దాన్ని నిలబెట్టింది.",
      rest: "ఒక రోజు తప్పితే స్ట్రీక్ వంగుతుంది, వరుసగా రెండు రోజులు తప్పితే ముగుస్తుంది. వంగిన రోజు ఏమీ జోడించదు, కాబట్టి అది {n} వద్దే ఉంటుంది.",
    },
    bentFloor: {
      lead: "{day} మీ కనీస పరిమితి {floor} కంటే తక్కువగా ఉంది.",
      rest: "దానికంటే తక్కువ ఉన్న రోజు స్ట్రీక్‌లో గానీ బ్యాడ్జ్‌లో గానీ లెక్కకు రాదు, కాబట్టి అది తప్పిన రోజులాగే స్ట్రీక్‌ను వంచింది. {next} దాన్ని నిలబెట్టింది.",
    },
    bentYesterday: {
      lead: "నిన్న తప్పిపోయింది; దాన్ని నిలబెట్టడానికి ఈరోజు నమోదు చేయండి.",
      rest: "ఒక రోజు తప్పితే స్ట్రీక్ వంగుతుంది, వరుసగా రెండు రోజులు తప్పితే ముగుస్తుంది.",
    },
    bentFloorYesterday: { lead: "నిన్న మీ కనీస పరిమితి {floor} kcal కంటే తక్కువగా ఉంది; దాన్ని నిలబెట్టడానికి ఈరోజు నమోదు చేయండి." },
    bentYesterdayHeld: { lead: "నిన్న తప్పిపోయింది; ఈరోజు దాన్ని నిలబెట్టింది." },
    bentFloorYesterdayHeld: { lead: "నిన్న మీ కనీస పరిమితి {floor} kcal కంటే తక్కువగా ఉంది; ఈరోజు దాన్ని నిలబెట్టింది." },
    ended: {
      lead: "స్ట్రీక్ {n} వద్ద ముగిసింది,",
      rest: "వరుసగా రెండు రోజులు ఏమీ నమోదు కాకపోవడంతో. మీ {n} రోజులు ఇప్పటికీ మీ బ్యాడ్జ్‌లకు లెక్కిస్తాయి. మళ్ళీ మొదలుపెట్టడానికి ఈరోజు నమోదు చేయండి.",
    },
  },
  unlock: {
    heading: "బ్యాడ్జ్ అన్‌లాక్ అయింది",
    share: "మీ బ్యాడ్జ్‌ను షేర్ చేయండి",
    viewAll: "అన్ని బ్యాడ్జ్‌లను చూడండి",
    notEnjoying: "బ్యాడ్జ్ సంబరాలు నచ్చడం లేదా?",
    close: "మూసివేయండి",
  },
  settings: {
    celebrations: "బ్యాడ్జ్ సంబరాలు",
    celebrationsSub: "బ్యాడ్జ్ అన్‌లాక్ అయినప్పుడు ఒక స్క్రీన్.",
    streakOnHome: "హోమ్‌లో స్ట్రీక్",
    streakOnHomeSub: "బ్రాండ్ పక్కన జ్వాల, లెక్క.",
    note: "రెండూ డిఫాల్ట్‌గా ఆన్‌లో ఉంటాయి. సంబరాలు ఆఫ్ చేసినా, మైలురాళ్ళలో బ్యాడ్జ్‌లు లెక్కిస్తాయి; ఏదీ పాప్ అప్ కాదు. \"బ్యాడ్జ్ సంబరాలు నచ్చడం లేదా?\" ఈ పేజీని తెరుస్తుంది.",
    saveFailed: "సేవ్ చేయడం కుదరలేదు. మళ్ళీ ప్రయత్నించండి.",
  },
};

const TA: MilestonesCopy = {
  title: "மைல்கற்கள்",
  back: "பின்செல்",
  dayStreak: "நாள் ஸ்ட்ரீக்",
  badgesEarned: "பெற்ற பேட்ஜ்கள்",
  longestDays: { one: "{n} நாள்", other: "{n} நாட்கள்" },
  longestLabel: "மிக நீண்ட ஸ்ட்ரீக்",
  badgesOf: "{n}/{total} பேட்ஜ்கள்",
  earned: "பெற்றது",
  locked: "பூட்டப்பட்டது",
  streak: {
    dayStreak: { other: "நாள் ஸ்ட்ரீக்" },
    dayStreakHeld: { other: "நாள் ஸ்ட்ரீக், தக்கவைக்கப்பட்டது" },
    days: { one: "நாள்", other: "நாட்கள்" },
    longest: "மிக நீண்டது",
    floor: "குறைந்தபட்ச வரம்பு",
    logToday: "அதை {n} ஆக்க இன்று பதிவுசெய்யவும்.",
    logToStart: "உங்கள் ஸ்ட்ரீக்கைத் தொடங்க இன்று பதிவுசெய்யவும்.",
    bentMissed: {
      lead: "{day} தவறியது; {next} அதைத் தக்கவைத்தது.",
      rest: "ஒரு நாள் தவறினால் ஸ்ட்ரீக் வளையும், தொடர்ந்து இரண்டு நாள் தவறினால் முடியும். வளைந்த நாள் எதையும் சேர்க்காது, எனவே எண்ணிக்கை {n} ஆகவே இருக்கும்.",
    },
    bentFloor: {
      lead: "{day}: உங்கள் குறைந்தபட்ச வரம்பு {floor}, அதற்குக் கீழே இருந்தது.",
      rest: "அதற்குக் கீழான நாள் ஸ்ட்ரீக்கிலோ பேட்ஜிலோ கணக்கிடப்படாது, எனவே தவறிய நாளைப் போல ஸ்ட்ரீக்கை வளைத்தது. {next} அதைத் தக்கவைத்தது.",
    },
    bentYesterday: {
      lead: "நேற்று தவறியது; அதைத் தக்கவைக்க இன்று பதிவுசெய்யவும்.",
      rest: "ஒரு நாள் தவறினால் ஸ்ட்ரீக் வளையும், தொடர்ந்து இரண்டு நாள் தவறினால் முடியும்.",
    },
    bentFloorYesterday: { lead: "நேற்று {floor} kcal என்ற உங்கள் குறைந்தபட்ச வரம்புக்குக் கீழே இருந்தது; அதைத் தக்கவைக்க இன்று பதிவுசெய்யவும்." },
    bentYesterdayHeld: { lead: "நேற்று தவறியது; இன்று அதைத் தக்கவைத்தது." },
    bentFloorYesterdayHeld: { lead: "நேற்று {floor} kcal என்ற உங்கள் குறைந்தபட்ச வரம்புக்குக் கீழே இருந்தது; இன்று அதைத் தக்கவைத்தது." },
    ended: {
      lead: "ஸ்ட்ரீக் {n} என்ற எண்ணிக்கையில் முடிந்தது,",
      rest: "தொடர்ந்து இரண்டு நாட்கள் பதிவு இல்லாததால். உங்கள் {n} நாட்கள் இன்னும் உங்கள் பேட்ஜ்களுக்குக் கணக்கிடப்படும். மீண்டும் தொடங்க இன்று பதிவுசெய்யவும்.",
    },
  },
  unlock: {
    heading: "பேட்ஜ் திறக்கப்பட்டது",
    share: "உங்கள் பேட்ஜைப் பகிர்",
    viewAll: "அனைத்து பேட்ஜ்களையும் பார்",
    notEnjoying: "பேட்ஜ் கொண்டாட்டங்கள் பிடிக்கவில்லையா?",
    close: "மூடு",
  },
  settings: {
    celebrations: "பேட்ஜ் கொண்டாட்டங்கள்",
    celebrationsSub: "பேட்ஜைத் திறக்கும்போது ஒரு திரை.",
    streakOnHome: "முகப்பில் ஸ்ட்ரீக்",
    streakOnHomeSub: "பிராண்ட் பெயருக்கு அருகில் தீச்சுடரும் எண்ணிக்கையும்.",
    note: "இரண்டும் இயல்பாக ஆன் நிலையில் இருக்கும். கொண்டாட்டங்கள் ஆஃப் ஆனாலும், பேட்ஜ்கள் மைல்கற்களில் கணக்கிடப்படும்; எதுவும் திரையில் தோன்றாது. \"பேட்ஜ் கொண்டாட்டங்கள் பிடிக்கவில்லையா?\" இந்தப் பக்கத்தைத் திறக்கும்.",
    saveFailed: "சேமிக்க முடியவில்லை. மீண்டும் முயலவும்.",
  },
};

const PA: MilestonesCopy = {
  title: "ਪੜਾਅ",
  back: "ਵਾਪਸ",
  dayStreak: "ਦਿਨਾਂ ਦੀ ਸਟ੍ਰੀਕ",
  badgesEarned: "ਮਿਲੇ ਬੈਜ",
  longestDays: { one: "{n} ਦਿਨ", other: "{n} ਦਿਨ" },
  longestLabel: "ਸਭ ਤੋਂ ਲੰਮੀ ਸਟ੍ਰੀਕ",
  badgesOf: "{n}/{total} ਬੈਜ",
  earned: "ਮਿਲਿਆ",
  locked: "ਲੌਕ",
  streak: {
    dayStreak: { other: "ਦਿਨਾਂ ਦੀ ਸਟ੍ਰੀਕ" },
    dayStreakHeld: { other: "ਦਿਨਾਂ ਦੀ ਸਟ੍ਰੀਕ, ਬਣੀ ਹੋਈ" },
    days: { one: "ਦਿਨ", other: "ਦਿਨ" },
    longest: "ਸਭ ਤੋਂ ਲੰਮੀ",
    floor: "ਘੱਟੋ-ਘੱਟ ਸੀਮਾ",
    logToday: "ਇਸ ਨੂੰ {n} ਬਣਾਉਣ ਲਈ ਅੱਜ ਦਰਜ ਕਰੋ।",
    logToStart: "ਆਪਣੀ ਸਟ੍ਰੀਕ ਸ਼ੁਰੂ ਕਰਨ ਲਈ ਅੱਜ ਦਰਜ ਕਰੋ।",
    bentMissed: {
      lead: "{day} ਖੁੰਝ ਗਿਆ; {next} ਨੇ ਇਸ ਨੂੰ ਸੰਭਾਲ ਲਿਆ।",
      rest: "ਇੱਕ ਖੁੰਝਿਆ ਦਿਨ ਸਟ੍ਰੀਕ ਨੂੰ ਝੁਕਾ ਦਿੰਦਾ ਹੈ, ਲਗਾਤਾਰ ਦੋ ਦਿਨ ਇਸ ਨੂੰ ਖ਼ਤਮ ਕਰ ਦਿੰਦੇ ਹਨ। ਝੁਕਿਆ ਦਿਨ ਕੁਝ ਨਹੀਂ ਜੋੜਦਾ, ਇਸ ਲਈ ਇਹ {n} 'ਤੇ ਹੀ ਰਹਿੰਦੀ ਹੈ।",
    },
    bentFloor: {
      lead: "{day} {floor} ਤੋਂ ਹੇਠਾਂ ਰਿਹਾ, ਜੋ ਤੁਹਾਡੀ ਘੱਟੋ-ਘੱਟ ਸੀਮਾ ਹੈ।",
      rest: "ਉਸ ਤੋਂ ਹੇਠਾਂ ਵਾਲਾ ਦਿਨ ਨਾ ਸਟ੍ਰੀਕ ਵਿੱਚ ਗਿਣਿਆ ਜਾਂਦਾ ਹੈ, ਨਾ ਕਿਸੇ ਬੈਜ ਵਿੱਚ, ਇਸ ਲਈ ਉਸ ਨੇ ਖੁੰਝੇ ਦਿਨ ਵਾਂਗ ਸਟ੍ਰੀਕ ਨੂੰ ਝੁਕਾ ਦਿੱਤਾ। {next} ਨੇ ਇਸ ਨੂੰ ਸੰਭਾਲ ਲਿਆ।",
    },
    bentYesterday: {
      lead: "ਕੱਲ੍ਹ ਖੁੰਝ ਗਿਆ; ਇਸ ਨੂੰ ਬਣਾਈ ਰੱਖਣ ਲਈ ਅੱਜ ਦਰਜ ਕਰੋ।",
      rest: "ਇੱਕ ਖੁੰਝਿਆ ਦਿਨ ਸਟ੍ਰੀਕ ਨੂੰ ਝੁਕਾ ਦਿੰਦਾ ਹੈ, ਲਗਾਤਾਰ ਦੋ ਦਿਨ ਇਸ ਨੂੰ ਖ਼ਤਮ ਕਰ ਦਿੰਦੇ ਹਨ।",
    },
    bentFloorYesterday: { lead: "ਕੱਲ੍ਹ {floor} kcal ਤੋਂ ਹੇਠਾਂ ਰਿਹਾ, ਜੋ ਤੁਹਾਡੀ ਘੱਟੋ-ਘੱਟ ਸੀਮਾ ਹੈ; ਇਸ ਨੂੰ ਬਣਾਈ ਰੱਖਣ ਲਈ ਅੱਜ ਦਰਜ ਕਰੋ।" },
    bentYesterdayHeld: { lead: "ਕੱਲ੍ਹ ਖੁੰਝ ਗਿਆ; ਅੱਜ ਨੇ ਇਸ ਨੂੰ ਸੰਭਾਲ ਲਿਆ।" },
    bentFloorYesterdayHeld: { lead: "ਕੱਲ੍ਹ {floor} kcal ਤੋਂ ਹੇਠਾਂ ਰਿਹਾ, ਜੋ ਤੁਹਾਡੀ ਘੱਟੋ-ਘੱਟ ਸੀਮਾ ਹੈ; ਅੱਜ ਨੇ ਇਸ ਨੂੰ ਸੰਭਾਲ ਲਿਆ।" },
    ended: {
      lead: "ਸਟ੍ਰੀਕ {n} 'ਤੇ ਖ਼ਤਮ ਹੋਈ,",
      rest: "ਲਗਾਤਾਰ ਦੋ ਦਿਨ ਬਿਨਾਂ ਕੁਝ ਦਰਜ ਕੀਤੇ। ਤੁਹਾਡੇ {n} ਦਿਨ ਅਜੇ ਵੀ ਤੁਹਾਡੇ ਬੈਜਾਂ ਵਿੱਚ ਗਿਣੇ ਜਾਂਦੇ ਹਨ। ਦੁਬਾਰਾ ਸ਼ੁਰੂ ਕਰਨ ਲਈ ਅੱਜ ਦਰਜ ਕਰੋ।",
    },
  },
  unlock: {
    heading: "ਬੈਜ ਅਨਲੌਕ ਹੋਇਆ",
    share: "ਆਪਣਾ ਬੈਜ ਸ਼ੇਅਰ ਕਰੋ",
    viewAll: "ਸਾਰੇ ਬੈਜ ਦੇਖੋ",
    notEnjoying: "ਬੈਜ ਦੇ ਜਸ਼ਨ ਪਸੰਦ ਨਹੀਂ ਆ ਰਹੇ?",
    close: "ਬੰਦ ਕਰੋ",
  },
  settings: {
    celebrations: "ਬੈਜ ਦੇ ਜਸ਼ਨ",
    celebrationsSub: "ਬੈਜ ਅਨਲੌਕ ਹੋਣ 'ਤੇ ਇੱਕ ਸਕ੍ਰੀਨ।",
    streakOnHome: "ਹੋਮ 'ਤੇ ਸਟ੍ਰੀਕ",
    streakOnHomeSub: "ਬ੍ਰਾਂਡ ਦੇ ਕੋਲ ਲਾਟ ਅਤੇ ਗਿਣਤੀ।",
    note: "ਦੋਵੇਂ ਡਿਫ਼ੌਲਟ ਤੌਰ 'ਤੇ ਚਾਲੂ ਹਨ। ਜਸ਼ਨ ਬੰਦ ਹੋਣ 'ਤੇ ਵੀ ਬੈਜ ਪੜਾਅ ਵਿੱਚ ਗਿਣੇ ਜਾਂਦੇ ਹਨ; ਬੱਸ ਕੁਝ ਪੌਪ ਅੱਪ ਨਹੀਂ ਹੁੰਦਾ। \"ਬੈਜ ਦੇ ਜਸ਼ਨ ਪਸੰਦ ਨਹੀਂ ਆ ਰਹੇ?\" ਇਹੀ ਪੇਜ ਖੋਲ੍ਹਦਾ ਹੈ।",
    saveFailed: "ਸੇਵ ਨਹੀਂ ਹੋ ਸਕਿਆ। ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।",
  },
};

const OR: MilestonesCopy = {
  title: "ମାଇଲଷ୍ଟୋନ୍",
  back: "ପଛକୁ",
  dayStreak: "ଦିନର ଷ୍ଟ୍ରିକ୍",
  badgesEarned: "ମିଳିଥିବା ବ୍ୟାଜ୍",
  longestDays: { one: "{n} ଦିନ", other: "{n} ଦିନ" },
  longestLabel: "ସବୁଠୁ ଲମ୍ବା ଷ୍ଟ୍ରିକ୍",
  badgesOf: "{n}/{total} ବ୍ୟାଜ୍",
  earned: "ମିଳିଛି",
  locked: "ଲକ୍",
  streak: {
    dayStreak: { other: "ଦିନର ଷ୍ଟ୍ରିକ୍" },
    dayStreakHeld: { other: "ଦିନର ଷ୍ଟ୍ରିକ୍, ବଜାୟ ଅଛି" },
    days: { one: "ଦିନ", other: "ଦିନ" },
    longest: "ସବୁଠୁ ଲମ୍ବା",
    floor: "ସର୍ବନିମ୍ନ ସୀମା",
    logToday: "ଏହାକୁ {n} କରିବାକୁ ଆଜି ଲଗ୍ କରନ୍ତୁ।",
    logToStart: "ଆପଣଙ୍କ ଷ୍ଟ୍ରିକ୍ ଆରମ୍ଭ କରିବାକୁ ଆଜି ଲଗ୍ କରନ୍ତୁ।",
    bentMissed: {
      lead: "{day} ଛୁଟିଗଲା; {next} ଏହାକୁ ବଜାୟ ରଖିଲା।",
      rest: "ଗୋଟିଏ ଛୁଟିଥିବା ଦିନ ଷ୍ଟ୍ରିକ୍‌କୁ ବଙ୍କା କରେ, ଲଗାତାର ଦୁଇଟି ଏହାକୁ ଶେଷ କରେ। ବଙ୍କା ଦିନ କିଛି ଯୋଡ଼େ ନାହିଁ, ତେଣୁ ଏହା {n} ରେ ରହେ।",
    },
    bentFloor: {
      lead: "{day} {floor} ତଳେ ରହିଲା, ଯାହା ଆପଣଙ୍କ ସର୍ବନିମ୍ନ ସୀମା।",
      rest: "ଏହା ତଳର ଦିନ ଷ୍ଟ୍ରିକ୍ କିମ୍ବା ବ୍ୟାଜ୍‌ରେ ଗଣାଯାଏ ନାହିଁ, ତେଣୁ ଏହା ଛୁଟିଥିବା ଦିନ ପରି ଷ୍ଟ୍ରିକ୍‌କୁ ବଙ୍କା କଲା। {next} ଏହାକୁ ବଜାୟ ରଖିଲା।",
    },
    bentYesterday: {
      lead: "ଗତକାଲି ଛୁଟିଗଲା; ଏହାକୁ ବଜାୟ ରଖିବାକୁ ଆଜି ଲଗ୍ କରନ୍ତୁ।",
      rest: "ଗୋଟିଏ ଛୁଟିଥିବା ଦିନ ଷ୍ଟ୍ରିକ୍‌କୁ ବଙ୍କା କରେ, ଲଗାତାର ଦୁଇଟି ଏହାକୁ ଶେଷ କରେ।",
    },
    bentFloorYesterday: { lead: "ଗତକାଲି {floor} kcal ତଳେ ରହିଲା, ଯାହା ଆପଣଙ୍କ ସର୍ବନିମ୍ନ ସୀମା; ଏହାକୁ ବଜାୟ ରଖିବାକୁ ଆଜି ଲଗ୍ କରନ୍ତୁ।" },
    bentYesterdayHeld: { lead: "ଗତକାଲି ଛୁଟିଗଲା; ଆଜି ଏହାକୁ ବଜାୟ ରଖିଲା।" },
    bentFloorYesterdayHeld: { lead: "ଗତକାଲି {floor} kcal ତଳେ ରହିଲା, ଯାହା ଆପଣଙ୍କ ସର୍ବନିମ୍ନ ସୀମା; ଆଜି ଏହାକୁ ବଜାୟ ରଖିଲା।" },
    ended: {
      lead: "ଷ୍ଟ୍ରିକ୍ {n} ରେ ଶେଷ ହେଲା,",
      rest: "ଲଗାତାର ଦୁଇ ଦିନ କିଛି ଲଗ୍ ନହେବା ପରେ। ଆପଣଙ୍କ {n} ଦିନ ଏବେ ବି ବ୍ୟାଜ୍‌ରେ ଗଣାଯାଏ। ପୁଣି ଆରମ୍ଭ କରିବାକୁ ଆଜି ଲଗ୍ କରନ୍ତୁ।",
    },
  },
  unlock: {
    heading: "ବ୍ୟାଜ୍ ଅନଲକ୍ ହେଲା",
    share: "ଆପଣଙ୍କ ବ୍ୟାଜ୍ ସେୟାର୍ କରନ୍ତୁ",
    viewAll: "ସବୁ ବ୍ୟାଜ୍ ଦେଖନ୍ତୁ",
    notEnjoying: "ବ୍ୟାଜ୍ ଉତ୍ସବ ଭଲ ଲାଗୁନାହିଁ?",
    close: "ବନ୍ଦ କରନ୍ତୁ",
  },
  settings: {
    celebrations: "ବ୍ୟାଜ୍ ଉତ୍ସବ",
    celebrationsSub: "ବ୍ୟାଜ୍ ଅନଲକ୍ ହେଲେ ଏକ ସ୍କ୍ରିନ୍।",
    streakOnHome: "ହୋମ୍‌ରେ ଷ୍ଟ୍ରିକ୍",
    streakOnHomeSub: "ବ୍ରାଣ୍ଡ ପାଖରେ ଶିଖା ଓ ଗଣନା।",
    note: "ଦୁଇଟିଯାକ ଡିଫଲ୍ଟ ଭାବେ ଚାଲୁ। ଉତ୍ସବ ବନ୍ଦ ଥିଲେ ବି ବ୍ୟାଜ୍ ମାଇଲଷ୍ଟୋନ୍‌ରେ ଗଣାଯାଏ; କିଛି ପପ୍ ଅପ୍ ହୁଏ ନାହିଁ। \"ବ୍ୟାଜ୍ ଉତ୍ସବ ଭଲ ଲାଗୁନାହିଁ?\" ଏହି ପେଜ୍ ଖୋଲେ।",
    saveFailed: "ସେଭ୍ ହୋଇପାରିଲା ନାହିଁ। ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।",
  },
};

const MR: MilestonesCopy = {
  title: "टप्पे",
  back: "मागे",
  dayStreak: "दिवसांचा स्ट्रीक",
  badgesEarned: "मिळालेले बॅज",
  longestDays: { one: "{n} दिवस", other: "{n} दिवस" },
  longestLabel: "सर्वात मोठा स्ट्रीक",
  badgesOf: "{n}/{total} बॅज",
  earned: "मिळाला",
  locked: "लॉक",
  streak: {
    dayStreak: { other: "दिवसांचा स्ट्रीक" },
    dayStreakHeld: { other: "दिवसांचा स्ट्रीक, टिकून आहे" },
    days: { one: "दिवस", other: "दिवस" },
    longest: "सर्वात मोठा",
    floor: "किमान मर्यादा",
    logToday: "आज जेवण नोंदवा म्हणजे तो {n} होईल.",
    logToStart: "तुमचा स्ट्रीक सुरू करण्यासाठी आज जेवण नोंदवा.",
    bentMissed: {
      lead: "{day} चुकला; पण {next} रोजी स्ट्रीक टिकला.",
      rest: "एक दिवस चुकला तर स्ट्रीक वाकतो, सलग दोन चुकले तर संपतो. वाकलेला दिवस काहीही जोडत नाही, म्हणून तो {n} वर राहतो.",
    },
    bentFloor: {
      lead: "{day}: {floor} पेक्षा कमी, तुमच्या किमान मर्यादेखाली.",
      rest: "त्याखालचा दिवस स्ट्रीक किंवा बॅजसाठी मोजला जात नाही, म्हणून चुकलेल्या दिवसासारखा स्ट्रीक वाकला. {next} रोजी तो टिकला.",
    },
    bentYesterday: {
      lead: "काल चुकला; स्ट्रीक टिकवण्यासाठी आज जेवण नोंदवा.",
      rest: "एक दिवस चुकला तर स्ट्रीक वाकतो, सलग दोन चुकले तर संपतो.",
    },
    bentFloorYesterday: { lead: "काल {floor} kcal पेक्षा कमी राहिले, तुमच्या किमान मर्यादेखाली; स्ट्रीक टिकवण्यासाठी आज जेवण नोंदवा." },
    bentYesterdayHeld: { lead: "काल चुकला; आज स्ट्रीक टिकला." },
    bentFloorYesterdayHeld: { lead: "काल {floor} kcal पेक्षा कमी राहिले, तुमच्या किमान मर्यादेखाली; आज स्ट्रीक टिकला." },
    ended: {
      lead: "स्ट्रीक {n} वर संपला,",
      rest: "कारण सलग दोन दिवस काहीही नोंदवले नाही. तुमचे {n} दिवस अजूनही बॅजसाठी मोजले जातात. पुन्हा सुरू करण्यासाठी आज जेवण नोंदवा.",
    },
  },
  unlock: {
    heading: "बॅज अनलॉक झाला",
    share: "तुमचा बॅज शेअर करा",
    viewAll: "सर्व बॅज पहा",
    notEnjoying: "बॅज सेलिब्रेशन आवडत नाही?",
    close: "बंद करा",
  },
  settings: {
    celebrations: "बॅज सेलिब्रेशन",
    celebrationsSub: "बॅज अनलॉक झाल्यावर एक स्क्रीन.",
    streakOnHome: "होमवर स्ट्रीक",
    streakOnHomeSub: "ब्रँडशेजारी ज्योत आणि संख्या.",
    note: "दोन्ही डीफॉल्टने सुरू आहेत. सेलिब्रेशन बंद असले तरी बॅज टप्पे पेजवर मोजले जातात; काहीही पॉप अप होत नाही. \"बॅज सेलिब्रेशन आवडत नाही?\" हे पेज उघडते.",
    saveFailed: "सेव्ह झाले नाही. पुन्हा प्रयत्न करा.",
  },
};

const ML: MilestonesCopy = {
  title: "നാഴികക്കല്ലുകൾ",
  back: "തിരികെ",
  dayStreak: "ദിവസ സ്ട്രീക്ക്",
  badgesEarned: "നേടിയ ബാഡ്ജുകൾ",
  longestDays: { one: "{n} ദിവസം", other: "{n} ദിവസം" },
  longestLabel: "ഏറ്റവും നീണ്ട സ്ട്രീക്ക്",
  badgesOf: "{n}/{total} ബാഡ്ജുകൾ",
  earned: "നേടി",
  locked: "ലോക്ക് ചെയ്തത്",
  streak: {
    dayStreak: { other: "ദിവസ സ്ട്രീക്ക്" },
    dayStreakHeld: { other: "ദിവസ സ്ട്രീക്ക്, നിലനിർത്തി" },
    days: { one: "ദിവസം", other: "ദിവസം" },
    longest: "ഏറ്റവും നീണ്ടത്",
    floor: "മിനിമം",
    logToday: "ഇത് {n} ആക്കാൻ ഇന്ന് രേഖപ്പെടുത്തൂ.",
    logToStart: "നിങ്ങളുടെ സ്ട്രീക്ക് തുടങ്ങാൻ ഇന്ന് രേഖപ്പെടുത്തൂ.",
    bentMissed: {
      lead: "{day} വിട്ടുപോയി; {next} അത് പിടിച്ചുനിർത്തി.",
      rest: "ഒരു ദിവസം വിട്ടുപോയാൽ സ്ട്രീക്ക് വളയും, തുടർച്ചയായി രണ്ട് ദിവസം വിട്ടാൽ അത് അവസാനിക്കും. വളഞ്ഞ ദിവസം ഒന്നും കൂട്ടില്ല, അതിനാൽ എണ്ണം {n} ആയി തുടരും.",
    },
    bentFloor: {
      lead: "{day} നിങ്ങളുടെ മിനിമത്തിന് താഴെയായിരുന്നു: {floor}.",
      rest: "അതിന് താഴെയുള്ള ദിവസം സ്ട്രീക്കിലോ ബാഡ്ജിലോ എണ്ണില്ല, അതിനാൽ വിട്ടുപോയ ദിവസം പോലെ അത് സ്ട്രീക്കിനെ വളച്ചു. {next} അത് പിടിച്ചുനിർത്തി.",
    },
    bentYesterday: {
      lead: "ഇന്നലെ വിട്ടുപോയി; അത് നിലനിർത്താൻ ഇന്ന് രേഖപ്പെടുത്തൂ.",
      rest: "ഒരു ദിവസം വിട്ടുപോയാൽ സ്ട്രീക്ക് വളയും, തുടർച്ചയായി രണ്ട് ദിവസം വിട്ടാൽ അത് അവസാനിക്കും.",
    },
    bentFloorYesterday: { lead: "ഇന്നലെ നിങ്ങളുടെ മിനിമമായ {floor} kcal-ന് താഴെയായിരുന്നു; അത് നിലനിർത്താൻ ഇന്ന് രേഖപ്പെടുത്തൂ." },
    bentYesterdayHeld: { lead: "ഇന്നലെ വിട്ടുപോയി; ഇന്ന് അത് പിടിച്ചുനിർത്തി." },
    bentFloorYesterdayHeld: { lead: "ഇന്നലെ നിങ്ങളുടെ മിനിമമായ {floor} kcal-ന് താഴെയായിരുന്നു; ഇന്ന് അത് പിടിച്ചുനിർത്തി." },
    ended: {
      lead: "സ്ട്രീക്ക് അവസാനിച്ചു, എണ്ണം {n},",
      rest: "തുടർച്ചയായി രണ്ട് ദിവസം ഒന്നും രേഖപ്പെടുത്താത്തതിനാൽ. നിങ്ങളുടെ {n} ദിവസങ്ങൾ ഇപ്പോഴും ബാഡ്ജുകളിലേക്ക് എണ്ണും. വീണ്ടും തുടങ്ങാൻ ഇന്ന് രേഖപ്പെടുത്തൂ.",
    },
  },
  unlock: {
    heading: "ബാഡ്ജ് അൺലോക്ക് ചെയ്തു",
    share: "നിങ്ങളുടെ ബാഡ്ജ് പങ്കിടുക",
    viewAll: "എല്ലാ ബാഡ്ജുകളും കാണുക",
    notEnjoying: "ബാഡ്ജ് ആഘോഷങ്ങൾ ഇഷ്ടമല്ലേ?",
    close: "അടയ്ക്കുക",
  },
  settings: {
    celebrations: "ബാഡ്ജ് ആഘോഷങ്ങൾ",
    celebrationsSub: "ബാഡ്ജ് അൺലോക്ക് ചെയ്യുമ്പോൾ ഒരു സ്ക്രീൻ.",
    streakOnHome: "ഹോമിൽ സ്ട്രീക്ക്",
    streakOnHomeSub: "ബ്രാൻഡിന് അരികിൽ ജ്വാലയും എണ്ണവും.",
    note: "രണ്ടും ഡിഫോൾട്ടായി ഓണാണ്. ആഘോഷങ്ങൾ ഓഫാക്കിയാലും ബാഡ്ജുകൾ നാഴികക്കല്ലുകളിൽ എണ്ണും; ഒന്നും പോപ്പ് അപ്പ് ആകില്ല. \"ബാഡ്ജ് ആഘോഷങ്ങൾ ഇഷ്ടമല്ലേ?\" ഈ പേജ് തുറക്കും.",
    saveFailed: "സംരക്ഷിക്കാനായില്ല. വീണ്ടും ശ്രമിക്കൂ.",
  },
};

const KN: MilestonesCopy = {
  title: "ಮೈಲಿಗಲ್ಲುಗಳು",
  back: "ಹಿಂದೆ",
  dayStreak: "ದಿನದ ಸ್ಟ್ರೀಕ್",
  badgesEarned: "ಗಳಿಸಿದ ಬ್ಯಾಡ್ಜ್‌ಗಳು",
  longestDays: { one: "{n} ದಿನ", other: "{n} ದಿನ" },
  longestLabel: "ಅತಿ ಉದ್ದದ ಸ್ಟ್ರೀಕ್",
  badgesOf: "{n}/{total} ಬ್ಯಾಡ್ಜ್‌ಗಳು",
  earned: "ಗಳಿಸಲಾಗಿದೆ",
  locked: "ಲಾಕ್ ಆಗಿದೆ",
  streak: {
    dayStreak: { other: "ದಿನದ ಸ್ಟ್ರೀಕ್" },
    dayStreakHeld: { other: "ದಿನದ ಸ್ಟ್ರೀಕ್, ಮುಂದುವರಿದಿದೆ" },
    days: { one: "ದಿನ", other: "ದಿನ" },
    longest: "ಅತಿ ಉದ್ದ",
    floor: "ಕನಿಷ್ಠ ಮಿತಿ",
    logToday: "{n} ತಲುಪಲು ಇಂದು ದಾಖಲಿಸಿ.",
    logToStart: "ನಿಮ್ಮ ಸ್ಟ್ರೀಕ್ ಆರಂಭಿಸಲು ಇಂದು ದಾಖಲಿಸಿ.",
    bentMissed: {
      lead: "{day} ತಪ್ಪಿತು; {next} ಸ್ಟ್ರೀಕ್ ಮುಂದುವರಿಸಿತು.",
      rest: "ಒಂದು ದಿನ ತಪ್ಪಿದರೆ ಸ್ಟ್ರೀಕ್ ಬಾಗುತ್ತದೆ, ಸತತ ಎರಡು ದಿನ ತಪ್ಪಿದರೆ ಕೊನೆಯಾಗುತ್ತದೆ. ಬಾಗಿದ ದಿನ ಏನನ್ನೂ ಸೇರಿಸುವುದಿಲ್ಲ, ಹಾಗಾಗಿ ಅದು {n} ನಲ್ಲೇ ಇರುತ್ತದೆ.",
    },
    bentFloor: {
      lead: "{day} ನಿಮ್ಮ ಕನಿಷ್ಠ ಮಿತಿ {floor} ಕ್ಕಿಂತ ಕೆಳಗೆ ಇತ್ತು.",
      rest: "ಅದಕ್ಕಿಂತ ಕೆಳಗಿನ ದಿನ ಸ್ಟ್ರೀಕ್ ಅಥವಾ ಬ್ಯಾಡ್ಜ್‌ಗೆ ಎಣಿಕೆಯಾಗುವುದಿಲ್ಲ, ಹಾಗಾಗಿ ತಪ್ಪಿದ ದಿನದಂತೆ ಅದು ಸ್ಟ್ರೀಕ್ ಅನ್ನು ಬಾಗಿಸಿತು. {next} ಸ್ಟ್ರೀಕ್ ಮುಂದುವರಿಸಿತು.",
    },
    bentYesterday: {
      lead: "ನಿನ್ನೆ ತಪ್ಪಿತು; ಸ್ಟ್ರೀಕ್ ಮುಂದುವರಿಸಲು ಇಂದು ದಾಖಲಿಸಿ.",
      rest: "ಒಂದು ದಿನ ತಪ್ಪಿದರೆ ಸ್ಟ್ರೀಕ್ ಬಾಗುತ್ತದೆ, ಸತತ ಎರಡು ದಿನ ತಪ್ಪಿದರೆ ಕೊನೆಯಾಗುತ್ತದೆ.",
    },
    bentFloorYesterday: { lead: "ನಿನ್ನೆ ನಿಮ್ಮ ಕನಿಷ್ಠ ಮಿತಿ {floor} kcal ಗಿಂತ ಕೆಳಗೆ ಇತ್ತು; ಸ್ಟ್ರೀಕ್ ಮುಂದುವರಿಸಲು ಇಂದು ದಾಖಲಿಸಿ." },
    bentYesterdayHeld: { lead: "ನಿನ್ನೆ ತಪ್ಪಿತು; ಇಂದು ಸ್ಟ್ರೀಕ್ ಮುಂದುವರಿಯಿತು." },
    bentFloorYesterdayHeld: { lead: "ನಿನ್ನೆ ನಿಮ್ಮ ಕನಿಷ್ಠ ಮಿತಿ {floor} kcal ಗಿಂತ ಕೆಳಗೆ ಇತ್ತು; ಇಂದು ಸ್ಟ್ರೀಕ್ ಮುಂದುವರಿಯಿತು." },
    ended: {
      lead: "ಸ್ಟ್ರೀಕ್ {n} ನಲ್ಲಿ ಕೊನೆಯಾಯಿತು,",
      rest: "ಸತತ ಎರಡು ದಿನ ದಾಖಲಿಸದ ಕಾರಣ. ನಿಮ್ಮ {n} ದಿನಗಳು ಇನ್ನೂ ನಿಮ್ಮ ಬ್ಯಾಡ್ಜ್‌ಗಳಿಗೆ ಎಣಿಕೆಯಾಗುತ್ತವೆ. ಮತ್ತೆ ಆರಂಭಿಸಲು ಇಂದು ದಾಖಲಿಸಿ.",
    },
  },
  unlock: {
    heading: "ಬ್ಯಾಡ್ಜ್ ಅನ್‌ಲಾಕ್ ಆಗಿದೆ",
    share: "ನಿಮ್ಮ ಬ್ಯಾಡ್ಜ್ ಹಂಚಿಕೊಳ್ಳಿ",
    viewAll: "ಎಲ್ಲಾ ಬ್ಯಾಡ್ಜ್‌ಗಳನ್ನು ನೋಡಿ",
    notEnjoying: "ಬ್ಯಾಡ್ಜ್ ಸಂಭ್ರಮ ಇಷ್ಟವಾಗುತ್ತಿಲ್ಲವೇ?",
    close: "ಮುಚ್ಚಿ",
  },
  settings: {
    celebrations: "ಬ್ಯಾಡ್ಜ್ ಸಂಭ್ರಮಗಳು",
    celebrationsSub: "ಬ್ಯಾಡ್ಜ್ ಅನ್‌ಲಾಕ್ ಮಾಡಿದಾಗ ಒಂದು ಪರದೆ.",
    streakOnHome: "ಹೋಮ್‌ನಲ್ಲಿ ಸ್ಟ್ರೀಕ್",
    streakOnHomeSub: "ಬ್ರ್ಯಾಂಡ್ ಪಕ್ಕದಲ್ಲಿ ಜ್ವಾಲೆ ಮತ್ತು ಎಣಿಕೆ.",
    note: "ಎರಡೂ ಡೀಫಾಲ್ಟ್ ಆಗಿ ಆನ್ ಆಗಿವೆ. ಸಂಭ್ರಮಗಳು ಆಫ್ ಆಗಿದ್ದರೂ ಬ್ಯಾಡ್ಜ್‌ಗಳು ಮೈಲಿಗಲ್ಲುಗಳಲ್ಲಿ ಎಣಿಕೆಯಾಗುತ್ತವೆ; ಏನೂ ಪಾಪ್ ಅಪ್ ಆಗುವುದಿಲ್ಲ. \"ಬ್ಯಾಡ್ಜ್ ಸಂಭ್ರಮ ಇಷ್ಟವಾಗುತ್ತಿಲ್ಲವೇ?\" ಈ ಪುಟವನ್ನು ತೆರೆಯುತ್ತದೆ.",
    saveFailed: "ಉಳಿಸಲಾಗಲಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
  },
};

const GU: MilestonesCopy = {
  title: "માઇલસ્ટોન",
  back: "પાછા",
  dayStreak: "દિવસની સ્ટ્રીક",
  badgesEarned: "મળેલા બેજ",
  longestDays: { one: "{n} દિવસ", other: "{n} દિવસ" },
  longestLabel: "સૌથી લાંબી સ્ટ્રીક",
  badgesOf: "{n}/{total} બેજ",
  earned: "મળ્યો",
  locked: "લૉક",
  streak: {
    dayStreak: { other: "દિવસની સ્ટ્રીક" },
    dayStreakHeld: { other: "દિવસની સ્ટ્રીક, ટકી રહી" },
    days: { one: "દિવસ", other: "દિવસ" },
    longest: "સૌથી લાંબી",
    floor: "ન્યૂનતમ મર્યાદા",
    logToday: "તેને {n} બનાવવા માટે આજે નોંધો.",
    logToStart: "તમારી સ્ટ્રીક શરૂ કરવા માટે આજે નોંધો.",
    bentMissed: {
      lead: "{day} ચૂકાયો; {next} એ તેને ટકાવી રાખી.",
      rest: "એક ચૂકેલો દિવસ સ્ટ્રીકને વાળે છે, સળંગ બે દિવસ તેને પૂરી કરે છે. વળેલો દિવસ કંઈ ઉમેરતો નથી, તેથી તે {n} પર જ રહે છે.",
    },
    bentFloor: {
      lead: "{day} તમારી ન્યૂનતમ મર્યાદા {floor} થી નીચે રહ્યો.",
      rest: "તેનાથી નીચેનો દિવસ ન સ્ટ્રીકમાં ગણાય છે, ન કોઈ બેજમાં, તેથી તેણે ચૂકેલા દિવસની જેમ સ્ટ્રીકને વાળી. {next} એ તેને ટકાવી રાખી.",
    },
    bentYesterday: {
      lead: "ગઈકાલ ચૂકાઈ; તેને ટકાવવા માટે આજે નોંધો.",
      rest: "એક ચૂકેલો દિવસ સ્ટ્રીકને વાળે છે, સળંગ બે દિવસ તેને પૂરી કરે છે.",
    },
    bentFloorYesterday: { lead: "ગઈકાલ તમારી ન્યૂનતમ મર્યાદા {floor} kcal થી નીચે રહી; તેને ટકાવવા માટે આજે નોંધો." },
    bentYesterdayHeld: { lead: "ગઈકાલ ચૂકાઈ; આજે તેને ટકાવી રાખી." },
    bentFloorYesterdayHeld: { lead: "ગઈકાલ તમારી ન્યૂનતમ મર્યાદા {floor} kcal થી નીચે રહી; આજે તેને ટકાવી રાખી." },
    ended: {
      lead: "સ્ટ્રીક {n} પર પૂરી થઈ,",
      rest: "કારણ કે સળંગ બે દિવસ કંઈ નોંધાયું નહીં. તમારા {n} દિવસ હજી તમારા બેજમાં ગણાય છે. ફરી શરૂ કરવા માટે આજે નોંધો.",
    },
  },
  unlock: {
    heading: "બેજ અનલૉક થયો",
    share: "તમારો બેજ શેર કરો",
    viewAll: "બધા બેજ જુઓ",
    notEnjoying: "બેજની ઉજવણી પસંદ નથી આવતી?",
    close: "બંધ કરો",
  },
  settings: {
    celebrations: "બેજની ઉજવણી",
    celebrationsSub: "બેજ અનલૉક થાય ત્યારે એક સ્ક્રીન.",
    streakOnHome: "હોમ પર સ્ટ્રીક",
    streakOnHomeSub: "બ્રાન્ડની બાજુમાં જ્યોત અને ગણતરી.",
    note: "બંને ડિફૉલ્ટ રૂપે ચાલુ છે. ઉજવણી બંધ હોય ત્યારે પણ બેજ માઇલસ્ટોનમાં ગણાય છે; બસ કંઈ પૉપ અપ થતું નથી. \"બેજની ઉજવણી પસંદ નથી આવતી?\" આ જ પેજ ખોલે છે.",
    saveFailed: "સેવ થઈ શક્યું નહીં. ફરી પ્રયાસ કરો.",
  },
};

const BN: MilestonesCopy = {
  title: "মাইলফলক",
  back: "ফিরে যান",
  dayStreak: "দিনের স্ট্রিক",
  badgesEarned: "পাওয়া ব্যাজ",
  longestDays: { one: "{n} দিন", other: "{n} দিন" },
  longestLabel: "দীর্ঘতম স্ট্রিক",
  badgesOf: "{n}/{total} ব্যাজ",
  earned: "পাওয়া গেছে",
  locked: "লক করা",
  streak: {
    dayStreak: { other: "দিনের স্ট্রিক" },
    dayStreakHeld: { other: "দিনের স্ট্রিক, টিকে আছে" },
    days: { one: "দিন", other: "দিন" },
    longest: "দীর্ঘতম",
    floor: "ন্যূনতম সীমা",
    logToday: "আজ লগ করুন, তাহলে {n} হবে।",
    logToStart: "স্ট্রিক শুরু করতে আজ লগ করুন।",
    bentMissed: {
      lead: "{day} বাদ পড়েছিল; {next} সেটি ধরে রেখেছে।",
      rest: "একদিন বাদ পড়লে স্ট্রিক বেঁকে যায়, পরপর দুদিন বাদ পড়লে শেষ হয়ে যায়। বাঁকা দিন কিছু যোগ করে না, তাই এটি {n}-এ থাকে।",
    },
    bentFloor: {
      lead: "{day} আপনার ন্যূনতম সীমা {floor}-এর নিচে ছিল।",
      rest: "এর নিচের দিন স্ট্রিক বা ব্যাজে গণনা হয় না, তাই বাদ পড়া দিনের মতো এটি স্ট্রিক বাঁকিয়ে দিয়েছে। {next} সেটি ধরে রেখেছে।",
    },
    bentYesterday: {
      lead: "গতকাল বাদ পড়েছে; ধরে রাখতে আজ লগ করুন।",
      rest: "একদিন বাদ পড়লে স্ট্রিক বেঁকে যায়, পরপর দুদিন বাদ পড়লে শেষ হয়ে যায়।",
    },
    bentFloorYesterday: { lead: "গতকাল আপনার ন্যূনতম সীমা {floor} kcal-এর নিচে ছিল; ধরে রাখতে আজ লগ করুন।" },
    bentYesterdayHeld: { lead: "গতকাল বাদ পড়েছে; আজ সেটি ধরে রেখেছে।" },
    bentFloorYesterdayHeld: { lead: "গতকাল আপনার ন্যূনতম সীমা {floor} kcal-এর নিচে ছিল; আজ সেটি ধরে রেখেছে।" },
    ended: {
      lead: "স্ট্রিক {n}-এ শেষ হয়েছে,",
      rest: "পরপর দুদিন কিছু লগ না করায়। আপনার {n} দিন এখনও ব্যাজে গণনা হয়। আবার শুরু করতে আজ লগ করুন।",
    },
  },
  unlock: {
    heading: "ব্যাজ আনলক হয়েছে",
    share: "আপনার ব্যাজ শেয়ার করুন",
    viewAll: "সব ব্যাজ দেখুন",
    notEnjoying: "ব্যাজ উদযাপন ভালো লাগছে না?",
    close: "বন্ধ করুন",
  },
  settings: {
    celebrations: "ব্যাজ উদযাপন",
    celebrationsSub: "ব্যাজ আনলক হলে একটি স্ক্রিন।",
    streakOnHome: "হোমে স্ট্রিক",
    streakOnHomeSub: "ব্র্যান্ডের পাশে শিখা ও সংখ্যা।",
    note: "দুটোই ডিফল্টভাবে চালু। উদযাপন বন্ধ থাকলেও মাইলফলকে ব্যাজ গণনা হয়; শুধু কিছু পপ আপ হয় না। \"ব্যাজ উদযাপন ভালো লাগছে না?\" এই পেজটি খোলে।",
    saveFailed: "সেভ করা যায়নি। আবার চেষ্টা করুন।",
  },
};

const PT_PT: MilestonesCopy = {
  title: "Marcos",
  back: "Voltar",
  dayStreak: "Sequência de dias",
  badgesEarned: "Medalhas conquistadas",
  longestDays: { one: "{n} dia", other: "{n} dias" },
  longestLabel: "sequência mais longa",
  badgesOf: "{n}/{total} medalhas",
  earned: "conquistada",
  locked: "bloqueada",
  streak: {
    dayStreak: { other: "dias de sequência" },
    dayStreakHeld: { other: "dias de sequência, mantida" },
    days: { one: "dia", other: "dias" },
    longest: "Recorde",
    floor: "mínimo",
    logToday: "Regista hoje para chegar a {n}.",
    logToStart: "Regista hoje para começar a tua sequência.",
    bentMissed: {
      lead: "{day} falhou; {next} manteve a sequência.",
      rest: "Um dia falhado verga a sequência; dois seguidos terminam-na. Um dia vergado não soma nada, por isso ela fica em {n}.",
    },
    bentFloor: {
      lead: "{day} ficou abaixo de {floor}, o teu mínimo.",
      rest: "Um dia abaixo dele não conta para a sequência nem para uma medalha, por isso vergou a sequência como um dia falhado. {next} manteve-a.",
    },
    bentYesterday: {
      lead: "Ontem falhou; regista hoje para manter a sequência.",
      rest: "Um dia falhado verga a sequência; dois seguidos terminam-na.",
    },
    bentFloorYesterday: { lead: "Ontem ficou abaixo de {floor} kcal, o teu mínimo; regista hoje para manter a sequência." },
    bentYesterdayHeld: { lead: "Ontem falhou; hoje manteve a sequência." },
    bentFloorYesterdayHeld: { lead: "Ontem ficou abaixo de {floor} kcal, o teu mínimo; hoje manteve a sequência." },
    ended: {
      lead: "A sequência terminou em {n},",
      rest: "após dois dias seguidos sem registo. Os teus {n} dias continuam a contar para as tuas medalhas. Regista hoje para recomeçar.",
    },
  },
  unlock: {
    heading: "Medalha desbloqueada",
    share: "Partilhar a tua medalha",
    viewAll: "Ver todas as medalhas",
    notEnjoying: "Não gostas das celebrações de medalhas?",
    close: "Fechar",
  },
  settings: {
    celebrations: "Celebrações de medalhas",
    celebrationsSub: "Um ecrã quando desbloqueias uma medalha.",
    streakOnHome: "Sequência no Início",
    streakOnHomeSub: "A chama e a contagem junto à marca.",
    note: "Ambas estão ativadas por predefinição. Com as celebrações desativadas, as medalhas continuam a contar em Marcos; nada aparece no ecrã. \"Não gostas das celebrações de medalhas?\" abre esta página.",
    saveFailed: "Não foi possível guardar. Tenta novamente.",
  },
};

const MS: MilestonesCopy = {
  title: "Pencapaian",
  back: "Kembali",
  dayStreak: "Rentetan Hari",
  badgesEarned: "Lencana diperoleh",
  longestDays: { one: "{n} hari", other: "{n} hari" },
  longestLabel: "rentetan terpanjang",
  badgesOf: "{n}/{total} lencana",
  earned: "diperoleh",
  locked: "berkunci",
  streak: {
    dayStreak: { other: "hari berturut-turut" },
    dayStreakHeld: { other: "hari berturut-turut, dipertahankan" },
    days: { one: "hari", other: "hari" },
    longest: "Terpanjang",
    floor: "had minimum",
    logToday: "Catat hari ini untuk menjadikannya {n}.",
    logToStart: "Catat hari ini untuk memulakan rentetan anda.",
    bentMissed: {
      lead: "{day} terlepas; {next} mempertahankannya.",
      rest: "Satu hari terlepas membengkokkan rentetan, dua hari berturut-turut menamatkannya. Hari yang bengkok tidak menambah apa-apa, jadi ia kekal pada {n}.",
    },
    bentFloor: {
      lead: "{day} kekal di bawah {floor}, had minimum anda.",
      rest: "Hari di bawahnya tidak dikira untuk rentetan atau lencana, jadi ia membengkokkan rentetan seperti hari yang terlepas. {next} mempertahankannya.",
    },
    bentYesterday: {
      lead: "Semalam terlepas; catat hari ini untuk mempertahankannya.",
      rest: "Satu hari terlepas membengkokkan rentetan, dua hari berturut-turut menamatkannya.",
    },
    bentFloorYesterday: { lead: "Semalam kekal di bawah {floor} kcal, had minimum anda; catat hari ini untuk mempertahankannya." },
    bentYesterdayHeld: { lead: "Semalam terlepas; hari ini mempertahankannya." },
    bentFloorYesterdayHeld: { lead: "Semalam kekal di bawah {floor} kcal, had minimum anda; hari ini mempertahankannya." },
    ended: {
      lead: "Rentetan tamat pada {n},",
      rest: "selepas dua hari berturut-turut tanpa catatan. {n} hari anda masih dikira untuk lencana anda. Catat hari ini untuk bermula semula.",
    },
  },
  unlock: {
    heading: "Lencana Dibuka Kunci",
    share: "Kongsi Lencana Anda",
    viewAll: "Lihat Semua Lencana",
    notEnjoying: "Tidak suka sambutan lencana?",
    close: "Tutup",
  },
  settings: {
    celebrations: "Sambutan lencana",
    celebrationsSub: "Satu skrin apabila anda membuka kunci lencana.",
    streakOnHome: "Rentetan di Utama",
    streakOnHomeSub: "Api dan kiraan di sebelah jenama.",
    note: "Kedua-duanya hidup secara lalai. Jika sambutan dimatikan, lencana masih dikira dalam Pencapaian; tiada apa yang muncul. \"Tidak suka sambutan lencana?\" membuka halaman ini.",
    saveFailed: "Tidak dapat menyimpannya. Cuba lagi.",
  },
};

const CA: MilestonesCopy = {
  title: "Fites",
  back: "Enrere",
  dayStreak: "Ratxa de dies",
  badgesEarned: "Insígnies aconseguides",
  longestDays: { one: "{n} dia", other: "{n} dies" },
  longestLabel: "ratxa més llarga",
  badgesOf: "{n}/{total} insígnies",
  earned: "aconseguida",
  locked: "bloquejada",
  streak: {
    dayStreak: { other: "dies de ratxa" },
    dayStreakHeld: { other: "dies de ratxa, mantinguda" },
    days: { one: "dia", other: "dies" },
    longest: "Rècord",
    floor: "mínim",
    logToday: "Registra avui per arribar a {n}.",
    logToStart: "Registra avui per començar la ratxa.",
    bentMissed: {
      lead: "{day} va fallar; {next} la va mantenir.",
      rest: "Un dia perdut doblega la ratxa; dos seguits l'acaben. Un dia doblegat no hi suma res, així que es queda en {n}.",
    },
    bentFloor: {
      lead: "{day} va quedar per sota de {floor}, el teu mínim.",
      rest: "Un dia per sota no compta per a la ratxa ni per a cap insígnia, així que la va doblegar com un dia perdut. {next} la va mantenir.",
    },
    bentYesterday: {
      lead: "Ahir va fallar; registra avui per mantenir-la.",
      rest: "Un dia perdut doblega la ratxa; dos seguits l'acaben.",
    },
    bentFloorYesterday: { lead: "Ahir va quedar per sota de {floor} kcal, el teu mínim; registra avui per mantenir-la." },
    bentYesterdayHeld: { lead: "Ahir va fallar; avui l'ha mantinguda." },
    bentFloorYesterdayHeld: { lead: "Ahir va quedar per sota de {floor} kcal, el teu mínim; avui l'ha mantinguda." },
    ended: {
      lead: "La ratxa es va acabar en {n},",
      rest: "després de dos dies seguits sense registrar res. Els teus {n} dies continuen comptant per a les insígnies. Registra avui per tornar a començar.",
    },
  },
  unlock: {
    heading: "Insígnia desbloquejada",
    share: "Comparteix la insígnia",
    viewAll: "Veure totes les insígnies",
    notEnjoying: "No t'agraden les celebracions d'insígnies?",
    close: "Tanca",
  },
  settings: {
    celebrations: "Celebracions d'insígnies",
    celebrationsSub: "Una pantalla quan desbloqueges una insígnia.",
    streakOnHome: "Ratxa a l'inici",
    streakOnHomeSub: "La flama i el comptador al costat de la marca.",
    note: "Totes dues opcions estan activades per defecte. Sense celebracions, les insígnies continuen comptant a Fites; no apareix res. «No t'agraden les celebracions d'insígnies?» obre aquesta pàgina.",
    saveFailed: "No s'ha pogut desar. Torna-ho a provar.",
  },
};

const SL: MilestonesCopy = {
  title: "Mejniki",
  back: "Nazaj",
  dayStreak: "Dni zapored",
  badgesEarned: "Pridobljene značke",
  longestDays: { one: "{n} dan", other: "{n} dni" },
  longestLabel: "najdaljši niz",
  badgesOf: "{n}/{total} značk",
  earned: "pridobljena",
  locked: "zaklenjena",
  streak: {
    dayStreak: { other: "dni zapored" },
    dayStreakHeld: { other: "dni zapored, niz zdrži" },
    days: { one: "dan", other: "dni" },
    longest: "Najdaljši",
    floor: "spodnja meja",
    logToday: "Zabeleži danes in niz bo {n}.",
    logToStart: "Zabeleži danes in začni svoj niz.",
    bentMissed: {
      lead: "Izpuščen dan: {day}; z dnem {next} je niz ohranjen.",
      rest: "En izpuščen dan niz upogne, dva zapored ga končata. Upognjen dan ne doda ničesar, zato niz ostane pri {n}.",
    },
    bentFloor: {
      lead: "Dan {day} je ostal pod {floor}, tvojo spodnjo mejo.",
      rest: "Dan pod njo se ne šteje v niz ali značko, zato je niz upognil kot izpuščen dan. Dan {next} ga je zadržal.",
    },
    bentYesterday: {
      lead: "Včeraj je izpadlo; zabeleži danes, da niz zadržiš.",
      rest: "En izpuščen dan niz upogne, dva zapored ga končata.",
    },
    bentFloorYesterday: { lead: "Včerajšnji dan je ostal pod {floor} kcal, tvojo spodnjo mejo; zabeleži danes, da niz zadržiš." },
    bentYesterdayHeld: { lead: "Včeraj je izpadlo; danes je niz zadržan." },
    bentFloorYesterdayHeld: { lead: "Včerajšnji dan je ostal pod {floor} kcal, tvojo spodnjo mejo; danes je niz zadržan." },
    ended: {
      lead: "Niz se je končal pri {n},",
      rest: "po dveh zaporednih dneh brez vnosa. Tvojih {n} dni se še vedno šteje k značkam. Zabeleži danes in začni znova.",
    },
  },
  unlock: {
    heading: "Značka odklenjena",
    share: "Deli svojo značko",
    viewAll: "Vse značke",
    notEnjoying: "Ti praznovanja značk niso všeč?",
    close: "Zapri",
  },
  settings: {
    celebrations: "Praznovanja značk",
    celebrationsSub: "Zaslon, ko odkleneš značko.",
    streakOnHome: "Niz na začetnem zaslonu",
    streakOnHomeSub: "Plamen in število ob logotipu.",
    note: "Oboje je privzeto vklopljeno. Ko so praznovanja izklopljena, se značke še vedno štejejo v Mejnikih; nič se ne prikaže. »Ti praznovanja značk niso všeč?« odpre to stran.",
    saveFailed: "Shranjevanje ni uspelo. Poskusi znova.",
  },
};

const HR: MilestonesCopy = {
  title: "Prekretnice",
  back: "Natrag",
  dayStreak: "Niz dana",
  badgesEarned: "Osvojene značke",
  longestDays: { one: "{n} dan", other: "{n} dana" },
  longestLabel: "najduži niz",
  badgesOf: "{n}/{total} znački",
  earned: "osvojeno",
  locked: "zaključano",
  streak: {
    dayStreak: { other: "dana zaredom" },
    dayStreakHeld: { other: "dana zaredom, niz održan" },
    days: { one: "dan", other: "dana" },
    longest: "Najduži",
    floor: "donja granica",
    logToday: "Zabilježi danas i bit će {n}.",
    logToStart: "Zabilježi danas i započni niz.",
    bentMissed: {
      lead: "{day}: propušteno; {next}: niz održan.",
      rest: "Jedan propušten dan savija niz, dva zaredom ga prekidaju. Savijen dan ne dodaje ništa, pa niz ostaje na {n}.",
    },
    bentFloor: {
      lead: "{day}: ispod donje granice od {floor}.",
      rest: "Dan ispod nje ne računa se ni za niz ni za značku, pa je savio niz kao propušten dan. {next}: niz održan.",
    },
    bentYesterday: {
      lead: "Jučer je propušteno; zabilježi danas da održiš niz.",
      rest: "Jedan propušten dan savija niz, dva zaredom ga prekidaju.",
    },
    bentFloorYesterday: { lead: "Jučer je bilo ispod donje granice od {floor} kcal; zabilježi danas da održiš niz." },
    bentYesterdayHeld: { lead: "Jučer je propušteno; danas je niz održan." },
    bentFloorYesterdayHeld: { lead: "Jučer je bilo ispod donje granice od {floor} kcal; danas je niz održan." },
    ended: {
      lead: "Niz je završio na {n},",
      rest: "nakon dva dana zaredom bez bilježenja. Dani iz tog niza ({n}) i dalje se računaju za značke. Zabilježi danas i kreni ispočetka.",
    },
  },
  unlock: {
    heading: "Značka otključana",
    share: "Podijeli značku",
    viewAll: "Pogledaj sve značke",
    notEnjoying: "Ne sviđaju ti se proslave znački?",
    close: "Zatvori",
  },
  settings: {
    celebrations: "Proslave znački",
    celebrationsSub: "Zaslon kad otključaš značku.",
    streakOnHome: "Niz na Početnoj",
    streakOnHomeSub: "Plamen i broj uz logotip.",
    note: "Oboje je zadano uključeno. Kad su proslave isključene, značke se i dalje broje u Prekretnicama; ništa ne iskače. „Ne sviđaju ti se proslave znački?” otvara ovu stranicu.",
    saveFailed: "Spremanje nije uspjelo. Pokušaj ponovno.",
  },
};

const SK: MilestonesCopy = {
  title: "Míľniky",
  back: "Späť",
  dayStreak: "Séria dní",
  badgesEarned: "Získané odznaky",
  longestDays: { one: "{n} deň", other: "{n} d." },
  longestLabel: "najdlhšia séria",
  badgesOf: "Odznaky: {n}/{total}",
  earned: "získaný",
  locked: "zamknutý",
  streak: {
    dayStreak: { other: "séria dní" },
    dayStreakHeld: { other: "séria dní, udržaná" },
    days: { one: "deň", other: "d." },
    longest: "Najdlhšia",
    floor: "minimum",
    logToday: "Zapíš dnes a bude to {n}.",
    logToStart: "Zapíš dnes a začni sériu.",
    bentMissed: {
      lead: "{day}: vynechané; {next}: séria udržaná.",
      rest: "Jeden vynechaný deň sériu ohne, dva za sebou ju ukončia. Ohnutý deň nič nepridá, takže zostáva na {n}.",
    },
    bentFloor: {
      lead: "{day}: pod {floor}, pod tvojím minimom.",
      rest: "Deň pod ním sa nepočíta do série ani do odznaku, takže sériu ohol ako vynechaný deň. {next}: séria udržaná.",
    },
    bentYesterday: {
      lead: "Včera vynechané; dnes zapíš a séria vydrží.",
      rest: "Jeden vynechaný deň sériu ohne, dva za sebou ju ukončia.",
    },
    bentFloorYesterday: { lead: "Včera pod {floor} kcal, pod tvojím minimom; dnes zapíš a séria vydrží." },
    bentYesterdayHeld: { lead: "Včera vynechané; dnes je séria udržaná." },
    bentFloorYesterdayHeld: { lead: "Včera pod {floor} kcal, pod tvojím minimom; dnes je séria udržaná." },
    ended: {
      lead: "Séria skončila na {n},",
      rest: "po dvoch dňoch za sebou bez zápisu. Dni ({n}) sa stále počítajú do odznakov. Zapíš dnes a začni odznova.",
    },
  },
  unlock: {
    heading: "Odznak odomknutý",
    share: "Zdieľať odznak",
    viewAll: "Zobraziť všetky odznaky",
    notEnjoying: "Nebavia ťa oslavy odznakov?",
    close: "Zavrieť",
  },
  settings: {
    celebrations: "Oslavy odznakov",
    celebrationsSub: "Obrazovka, keď odomkneš odznak.",
    streakOnHome: "Séria na obrazovke Domov",
    streakOnHomeSub: "Plamienok a počet pri logu.",
    note: "Obe sú predvolene zapnuté. S vypnutými oslavami sa odznaky stále počítajú v Míľnikoch; nič nevyskočí. „Nebavia ťa oslavy odznakov?“ otvorí túto stránku.",
    saveFailed: "Nepodarilo sa uložiť. Skús to znova.",
  },
};

const NO: MilestonesCopy = {
  title: "Milepæler",
  back: "Tilbake",
  dayStreak: "Dager på rad",
  badgesEarned: "Merker opptjent",
  longestDays: { one: "{n} dag", other: "{n} dager" },
  longestLabel: "lengste rekke",
  badgesOf: "{n}/{total} merker",
  earned: "opptjent",
  locked: "låst",
  streak: {
    dayStreak: { other: "dager på rad" },
    dayStreakHeld: { other: "dager på rad, holdt" },
    days: { one: "dag", other: "dager" },
    longest: "Lengste",
    floor: "nedre grense",
    logToday: "Logg i dag for å gjøre den til {n}.",
    logToStart: "Logg i dag for å starte rekken din.",
    bentMissed: {
      lead: "{day} glapp; {next} holdt rekken.",
      rest: "Én tapt dag bøyer rekken, to på rad avslutter den. En bøyd dag legger ikke til noe, så den står på {n}.",
    },
    bentFloor: {
      lead: "{day} havnet under {floor}, den nedre grensen din.",
      rest: "En dag under den teller ikke mot rekken eller et merke, så den bøyde rekken som en tapt dag. {next} holdt rekken.",
    },
    bentYesterday: {
      lead: "Gårsdagen glapp; logg i dag for å holde rekken.",
      rest: "Én tapt dag bøyer rekken, to på rad avslutter den.",
    },
    bentFloorYesterday: { lead: "Gårsdagen havnet under {floor} kcal, den nedre grensen din; logg i dag for å holde rekken." },
    bentYesterdayHeld: { lead: "Gårsdagen glapp; dagen i dag holdt rekken." },
    bentFloorYesterdayHeld: { lead: "Gårsdagen havnet under {floor} kcal, den nedre grensen din; dagen i dag holdt rekken." },
    ended: {
      lead: "Rekken sluttet på {n},",
      rest: "etter to dager på rad uten logging. Dine {n} dager teller fortsatt mot merkene dine. Logg i dag for å starte på nytt.",
    },
  },
  unlock: {
    heading: "Merke låst opp",
    share: "Del merket ditt",
    viewAll: "Se alle merker",
    notEnjoying: "Liker du ikke merkefeiringer?",
    close: "Lukk",
  },
  settings: {
    celebrations: "Merkefeiringer",
    celebrationsSub: "En skjerm når du låser opp et merke.",
    streakOnHome: "Rekke på Hjem",
    streakOnHomeSub: "Flammen og tallet ved logoen.",
    note: "Begge er på som standard. Med feiringer av teller merkene fortsatt under Milepæler; ingenting dukker opp. «Liker du ikke merkefeiringer?» åpner denne siden.",
    saveFailed: "Kunne ikke lagre det. Prøv igjen.",
  },
};

const FI: MilestonesCopy = {
  title: "Virstanpylväät",
  back: "Takaisin",
  dayStreak: "Päiväputki",
  badgesEarned: "Ansaitut merkit",
  longestDays: { one: "{n} päivä", other: "{n} päivää" },
  longestLabel: "pisin putki",
  badgesOf: "{n}/{total} merkkiä",
  earned: "ansaittu",
  locked: "lukittu",
  streak: {
    dayStreak: { other: "päivän putki" },
    dayStreakHeld: { other: "päivän putki, pidetty" },
    days: { one: "päivä", other: "päivää" },
    longest: "Pisin",
    floor: "alaraja",
    logToday: "Kirjaa tänään, niin lukema on {n}.",
    logToStart: "Kirjaa tänään aloittaaksesi putken.",
    bentMissed: {
      lead: "{day} jäi väliin; {next} piti putken.",
      rest: "Yksi väliin jäänyt päivä taivuttaa putken, kaksi peräkkäin katkaisee sen. Taivutettu päivä ei lisää mitään, joten lukema on yhä {n}.",
    },
    bentFloor: {
      lead: "{day} jäi alle alarajasi ({floor}).",
      rest: "Alarajan alittava päivä ei kerrytä putkea eikä merkkiä, joten se taivutti putken kuin väliin jäänyt päivä. {next} piti sen.",
    },
    bentYesterday: {
      lead: "Eilinen jäi väliin; kirjaa tänään pitääksesi putken.",
      rest: "Yksi väliin jäänyt päivä taivuttaa putken, kaksi peräkkäin katkaisee sen.",
    },
    bentFloorYesterday: { lead: "Eilinen jäi alle alarajasi ({floor} kcal); kirjaa tänään pitääksesi putken." },
    bentYesterdayHeld: { lead: "Eilinen jäi väliin; tämä päivä piti putken." },
    bentFloorYesterdayHeld: { lead: "Eilinen jäi alle alarajasi ({floor} kcal); tämä päivä piti putken." },
    ended: {
      lead: "Putki päättyi lukemaan {n},",
      rest: "kun kahtena päivänä peräkkäin ei ollut kirjauksia. Putken päivät ({n}) lasketaan yhä merkkeihisi. Kirjaa tänään aloittaaksesi alusta.",
    },
  },
  unlock: {
    heading: "Merkki avattu",
    share: "Jaa merkkisi",
    viewAll: "Näytä kaikki merkit",
    notEnjoying: "Etkö pidä merkkijuhlista?",
    close: "Sulje",
  },
  settings: {
    celebrations: "Merkkijuhlat",
    celebrationsSub: "Näkymä, kun avaat merkin.",
    streakOnHome: "Putki Koti-näkymässä",
    streakOnHomeSub: "Liekki ja lukema logon vieressä.",
    note: "Molemmat ovat oletuksena päällä. Kun juhlat ovat pois päältä, merkit lasketaan yhä Virstanpylväissä, mutta mitään ei ponnahda esiin. ”Etkö pidä merkkijuhlista?” avaa tämän sivun.",
    saveFailed: "Tallennus ei onnistunut. Yritä uudelleen.",
  },
};

const DA: MilestonesCopy = {
  title: "Milepæle",
  back: "Tilbage",
  dayStreak: "Dage i træk",
  badgesEarned: "Optjente mærker",
  longestDays: { one: "{n} dag", other: "{n} dage" },
  longestLabel: "længste stime",
  badgesOf: "{n}/{total} mærker",
  earned: "optjent",
  locked: "låst",
  streak: {
    dayStreak: { other: "dage i træk" },
    dayStreakHeld: { other: "dage i træk, holdt" },
    days: { one: "dag", other: "dage" },
    longest: "Længste",
    floor: "bundgrænse",
    logToday: "Registrér i dag for at nå {n}.",
    logToStart: "Registrér i dag for at starte din stime.",
    bentMissed: {
      lead: "{day} gled; {next} holdt den.",
      rest: "Én manglende dag bøjer stimen, to i træk afslutter den. En bøjet dag tæller ikke med, så den bliver på {n}.",
    },
    bentFloor: {
      lead: "{day} blev under {floor}, din bundgrænse.",
      rest: "En dag under den tæller hverken med i stimen eller til et mærke, så den bøjede stimen som en manglende dag. {next} holdt den.",
    },
    bentYesterday: {
      lead: "I går gled; registrér i dag for at holde den.",
      rest: "Én manglende dag bøjer stimen, to i træk afslutter den.",
    },
    bentFloorYesterday: { lead: "I går blev under {floor} kcal, din bundgrænse; registrér i dag for at holde den." },
    bentYesterdayHeld: { lead: "I går gled; i dag holdt den." },
    bentFloorYesterdayHeld: { lead: "I går blev under {floor} kcal, din bundgrænse; i dag holdt den." },
    ended: {
      lead: "Stimen sluttede ved {n},",
      rest: "efter to dage i træk uden registrering. Dine {n} dage tæller stadig med til dine mærker. Registrér i dag for at starte forfra.",
    },
  },
  unlock: {
    heading: "Mærke låst op",
    share: "Del dit mærke",
    viewAll: "Se alle mærker",
    notEnjoying: "Bryder du dig ikke om mærkefejringer?",
    close: "Luk",
  },
  settings: {
    celebrations: "Mærkefejringer",
    celebrationsSub: "En skærm, når du låser et mærke op.",
    streakOnHome: "Stime på Hjem",
    streakOnHomeSub: "Flammen og tallet ved logoet.",
    note: "Begge er slået til som standard. Med fejringer slået fra tæller mærker stadig under Milepæle; intet dukker op. »Bryder du dig ikke om mærkefejringer?« åbner denne side.",
    saveFailed: "Det kunne ikke gemmes. Prøv igen.",
  },
};

const HU: MilestonesCopy = {
  title: "Mérföldkövek",
  back: "Vissza",
  dayStreak: "Napos sorozat",
  badgesEarned: "Megszerzett jelvények",
  longestDays: { one: "{n} nap", other: "{n} nap" },
  longestLabel: "leghosszabb sorozat",
  badgesOf: "{n}/{total} jelvény",
  earned: "megszerezve",
  locked: "zárolva",
  streak: {
    dayStreak: { other: "napos sorozat" },
    dayStreakHeld: { other: "napos sorozat, megtartva" },
    days: { one: "nap", other: "nap" },
    longest: "Leghosszabb",
    floor: "alsó határ",
    logToday: "Rögzíts ma valamit, és {n} napos lesz.",
    logToStart: "Rögzíts ma valamit, és elindul a sorozatod.",
    bentMissed: {
      lead: "{day} kimaradt; {next} megtartotta.",
      rest: "Egy kihagyott nap meghajlítja a sorozatot, két egymást követő véget vet neki. A meghajlott nap nem ad hozzá semmit, így a sorozat {n} marad.",
    },
    bentFloor: {
      lead: "{day} az alsó határod ({floor}) alatt maradt.",
      rest: "Az alsó határ alatti nap nem számít bele sem a sorozatba, sem jelvénybe, ezért kihagyott napként meghajlította a sorozatot. {next} megtartotta.",
    },
    bentYesterday: {
      lead: "A tegnap kimaradt; rögzíts ma valamit, hogy megtartsd.",
      rest: "Egy kihagyott nap meghajlítja a sorozatot, két egymást követő véget vet neki.",
    },
    bentFloorYesterday: { lead: "A tegnap az alsó határod ({floor} kcal) alatt maradt; rögzíts ma valamit, hogy megtartsd." },
    bentYesterdayHeld: { lead: "A tegnap kimaradt; a mai nap megtartotta." },
    bentFloorYesterdayHeld: { lead: "A tegnap az alsó határod ({floor} kcal) alatt maradt; a mai nap megtartotta." },
    ended: {
      lead: "A sorozat {n} napnál véget ért,",
      rest: "két egymást követő, rögzítés nélküli nap után. Az eddigi {n} napod továbbra is beleszámít a jelvényeidbe. Rögzíts ma valamit, és kezdd újra.",
    },
  },
  unlock: {
    heading: "Jelvény feloldva",
    share: "Jelvény megosztása",
    viewAll: "Összes jelvény",
    notEnjoying: "Nem tetszik a jelvényünneplés?",
    close: "Bezárás",
  },
  settings: {
    celebrations: "Jelvényünneplés",
    celebrationsSub: "Egy képernyő, amikor feloldasz egy jelvényt.",
    streakOnHome: "Sorozat a Kezdőlapon",
    streakOnHomeSub: "A láng és a szám a logó mellett.",
    note: "Alapból mindkettő be van kapcsolva. Kikapcsolt ünnepléssel a jelvények a Mérföldkövekben továbbra is számítanak; semmi sem ugrik fel. A „Nem tetszik a jelvényünneplés?” ezt az oldalt nyitja meg.",
    saveFailed: "Nem sikerült menteni. Próbáld újra.",
  },
};

const EL: MilestonesCopy = {
  title: "Ορόσημα",
  back: "Πίσω",
  dayStreak: "Σερί ημερών",
  badgesEarned: "Σήματα που κέρδισες",
  longestDays: { one: "{n} ημέρα", other: "{n} ημέρες" },
  longestLabel: "μεγαλύτερο σερί",
  badgesOf: "{n}/{total} σήματα",
  earned: "κερδισμένο",
  locked: "κλειδωμένο",
  streak: {
    dayStreak: { other: "ημ. σερί" },
    dayStreakHeld: { other: "ημ. σερί, διατηρήθηκε" },
    days: { one: "ημέρα", other: "ημέρες" },
    longest: "Μεγαλύτερο",
    floor: "κατώτατο όριο",
    logToday: "Κατάγραψε κάτι σήμερα για να γίνει {n}.",
    logToStart: "Κατάγραψε κάτι σήμερα για να ξεκινήσεις το σερί σου.",
    bentMissed: {
      lead: "{day}: χωρίς καταγραφή· {next}: το σερί κρατήθηκε.",
      rest: "Μία χαμένη μέρα λυγίζει το σερί, δύο στη σειρά το τερματίζουν. Μια λυγισμένη μέρα δεν προσθέτει τίποτα, οπότε το σερί μένει στο {n}.",
    },
    bentFloor: {
      lead: "{day}: κάτω από {floor}, το κατώτατο όριό σου.",
      rest: "Μια μέρα κάτω από αυτό δεν μετράει για το σερί ή για σήμα, οπότε λύγισε το σερί όπως μια χαμένη μέρα. {next}: το σερί κρατήθηκε.",
    },
    bentYesterday: {
      lead: "Χθες χωρίς καταγραφή· κατάγραψε κάτι σήμερα για να κρατήσεις το σερί.",
      rest: "Μία χαμένη μέρα λυγίζει το σερί, δύο στη σειρά το τερματίζουν.",
    },
    bentFloorYesterday: { lead: "Χθες: κάτω από {floor} kcal, το κατώτατο όριό σου· κατάγραψε κάτι σήμερα για να κρατήσεις το σερί." },
    bentYesterdayHeld: { lead: "Χθες χωρίς καταγραφή· σήμερα το σερί κρατήθηκε." },
    bentFloorYesterdayHeld: { lead: "Χθες: κάτω από {floor} kcal, το κατώτατο όριό σου· σήμερα το σερί κρατήθηκε." },
    ended: {
      lead: "Το σερί τελείωσε στο {n},",
      rest: "μετά από δύο συνεχόμενες μέρες χωρίς καταγραφή. Οι {n} ημέρες σου μετράνε ακόμη για τα σήματά σου. Κατάγραψε κάτι σήμερα για να ξεκινήσεις ξανά.",
    },
  },
  unlock: {
    heading: "Νέο σήμα ξεκλειδώθηκε",
    share: "Κοινοποίησε το σήμα σου",
    viewAll: "Δες όλα τα σήματα",
    notEnjoying: "Δεν σου αρέσουν οι γιορτές για τα σήματα;",
    close: "Κλείσιμο",
  },
  settings: {
    celebrations: "Γιορτές για τα σήματα",
    celebrationsSub: "Μια οθόνη όταν ξεκλειδώνεις ένα σήμα.",
    streakOnHome: "Σερί στην Αρχική",
    streakOnHomeSub: "Η φλόγα και ο αριθμός δίπλα στο λογότυπο.",
    note: "Και τα δύο είναι ενεργά από προεπιλογή. Με τις γιορτές ανενεργές, τα σήματα μετράνε κανονικά στα Ορόσημα· δεν εμφανίζεται τίποτα. Το «Δεν σου αρέσουν οι γιορτές για τα σήματα;» ανοίγει αυτή τη σελίδα.",
    saveFailed: "Η αποθήκευση απέτυχε. Δοκίμασε ξανά.",
  },
};

const RO: MilestonesCopy = {
  title: "Repere",
  back: "Înapoi",
  dayStreak: "Serie de zile",
  badgesEarned: "Insigne câștigate",
  longestDays: { one: "{n} zi", other: "Zile: {n}" },
  longestLabel: "cea mai lungă serie",
  badgesOf: "{n}/{total} insigne",
  earned: "câștigată",
  locked: "blocată",
  streak: {
    dayStreak: { other: "zile la rând" },
    dayStreakHeld: { other: "zile la rând, serie menținută" },
    days: { one: "zi", other: "zile" },
    longest: "Record",
    floor: "prag",
    logToday: "Înregistrează azi ca seria să ajungă la {n}.",
    logToStart: "Înregistrează azi ca să-ți începi seria.",
    bentMissed: {
      lead: "{day} a scăpat; {next} a ținut-o.",
      rest: "O zi ratată îndoaie seria, două la rând o încheie. O zi îndoită nu adaugă nimic, așa că rămâne la {n}.",
    },
    bentFloor: {
      lead: "{day} a rămas sub {floor}, pragul tău.",
      rest: "O zi sub prag nu contează pentru serie sau pentru o insignă, așa că a îndoit seria ca o zi ratată. {next} a ținut-o.",
    },
    bentYesterday: {
      lead: "Ieri a scăpat; înregistrează azi ca s-o menții.",
      rest: "O zi ratată îndoaie seria, două la rând o încheie.",
    },
    bentFloorYesterday: { lead: "Ieri a rămas sub {floor} kcal, pragul tău; înregistrează azi ca s-o menții." },
    bentYesterdayHeld: { lead: "Ieri a scăpat; azi a ținut-o." },
    bentFloorYesterdayHeld: { lead: "Ieri a rămas sub {floor} kcal, pragul tău; azi a ținut-o." },
    ended: {
      lead: "Seria s-a încheiat la {n},",
      rest: "după două zile la rând fără înregistrări. Zilele tale ({n}) contează în continuare pentru insigne. Înregistrează azi ca s-o iei de la capăt.",
    },
  },
  unlock: {
    heading: "Insignă deblocată",
    share: "Distribuie insigna",
    viewAll: "Vezi toate insignele",
    notEnjoying: "Nu-ți plac celebrările insignelor?",
    close: "Închide",
  },
  settings: {
    celebrations: "Celebrări pentru insigne",
    celebrationsSub: "Un ecran când deblochezi o insignă.",
    streakOnHome: "Seria pe Acasă",
    streakOnHomeSub: "Flacăra și numărul de lângă logo.",
    note: "Ambele sunt activate implicit. Cu celebrările dezactivate, insignele se numără în continuare în Repere; nu apare nimic. „Nu-ți plac celebrările insignelor?” deschide această pagină.",
    saveFailed: "Nu am putut salva. Încearcă din nou.",
  },
};

const CS: MilestonesCopy = {
  title: "Milníky",
  back: "Zpět",
  dayStreak: "Série dní",
  badgesEarned: "Získané odznaky",
  longestDays: { one: "{n} den", other: "{n} d" },
  longestLabel: "nejdelší série",
  badgesOf: "Odznaky: {n}/{total}",
  earned: "získáno",
  locked: "zamčeno",
  streak: {
    dayStreak: { other: "d v řadě" },
    dayStreakHeld: { other: "d v řadě, udrženo" },
    days: { one: "den", other: "d" },
    longest: "Nejdelší",
    floor: "minimum",
    logToday: "Zapiš dnes a bude jich {n}.",
    logToStart: "Zapiš dnes a začni svou sérii.",
    bentMissed: {
      lead: "{day}: vynecháno; {next}: série udržena.",
      rest: "Jeden vynechaný den sérii ohne, dva v řadě ji ukončí. Ohnutý den nic nepřidá, takže zůstává na {n}.",
    },
    bentFloor: {
      lead: "{day}: pod {floor}, tvým minimem.",
      rest: "Den pod minimem se nepočítá do série ani do odznaku, takže sérii ohnul jako vynechaný den. {next}: série udržena.",
    },
    bentYesterday: {
      lead: "Včera vynecháno; zapiš dnes a sérii udržíš.",
      rest: "Jeden vynechaný den sérii ohne, dva v řadě ji ukončí.",
    },
    bentFloorYesterday: { lead: "Včera pod {floor} kcal, tvým minimem; zapiš dnes a sérii udržíš." },
    bentYesterdayHeld: { lead: "Včera vynecháno; dnešek sérii udržel." },
    bentFloorYesterdayHeld: { lead: "Včera pod {floor} kcal, tvým minimem; dnešek sérii udržel." },
    ended: {
      lead: "Série skončila na {n},",
      rest: "po dvou dnech v řadě bez zápisu. Dny série ({n}) se pořád počítají do odznaků. Zapiš dnes a začni znovu.",
    },
  },
  unlock: {
    heading: "Odznak odemčen",
    share: "Sdílej svůj odznak",
    viewAll: "Zobrazit všechny odznaky",
    notEnjoying: "Oslavy odznaků tě nebaví?",
    close: "Zavřít",
  },
  settings: {
    celebrations: "Oslavy odznaků",
    celebrationsSub: "Obrazovka, když odemkneš odznak.",
    streakOnHome: "Série na Domů",
    streakOnHomeSub: "Plamínek a počet vedle loga.",
    note: "Obojí je ve výchozím stavu zapnuté. S vypnutými oslavami se odznaky v Milnících pořád počítají; jen nic nevyskakuje. „Oslavy odznaků tě nebaví?“ otevře tuto stránku.",
    saveFailed: "Nepodařilo se uložit. Zkus to znovu.",
  },
};

const HI: MilestonesCopy = {
  title: "पड़ाव",
  back: "वापस",
  dayStreak: "दिन की स्ट्रीक",
  badgesEarned: "मिले बैज",
  longestDays: { one: "{n} दिन", other: "{n} दिन" },
  longestLabel: "सबसे लंबी स्ट्रीक",
  badgesOf: "{n}/{total} बैज",
  earned: "मिला",
  locked: "लॉक",
  streak: {
    dayStreak: { other: "दिन की स्ट्रीक" },
    dayStreakHeld: { other: "दिन की स्ट्रीक, बनी हुई" },
    days: { one: "दिन", other: "दिन" },
    longest: "सबसे लंबी",
    floor: "न्यूनतम सीमा",
    logToday: "इसे {n} बनाने के लिए आज दर्ज करें।",
    logToStart: "अपनी स्ट्रीक शुरू करने के लिए आज दर्ज करें।",
    bentMissed: {
      lead: "{day} छूट गया; {next} ने उसे थाम लिया।",
      rest: "एक छूटा दिन स्ट्रीक को झुका देता है, लगातार दो दिन उसे खत्म कर देते हैं। झुका हुआ दिन कुछ नहीं जोड़ता, इसलिए यह {n} पर ही रहती है।",
    },
    bentFloor: {
      lead: "{day} {floor} से नीचे रहा, जो आपकी न्यूनतम सीमा है।",
      rest: "उससे नीचे का दिन न स्ट्रीक में गिना जाता है, न किसी बैज में, इसलिए उसने छूटे दिन की तरह स्ट्रीक को झुका दिया। {next} ने उसे थाम लिया।",
    },
    bentYesterday: {
      lead: "कल छूट गया; इसे बनाए रखने के लिए आज दर्ज करें।",
      rest: "एक छूटा दिन स्ट्रीक को झुका देता है, लगातार दो दिन उसे खत्म कर देते हैं।",
    },
    bentFloorYesterday: { lead: "कल {floor} kcal से नीचे रहा, जो आपकी न्यूनतम सीमा है; इसे बनाए रखने के लिए आज दर्ज करें।" },
    bentYesterdayHeld: { lead: "कल छूट गया; आज ने इसे थाम लिया।" },
    bentFloorYesterdayHeld: { lead: "कल {floor} kcal से नीचे रहा, जो आपकी न्यूनतम सीमा है; आज ने इसे थाम लिया।" },
    ended: {
      lead: "स्ट्रीक {n} पर खत्म हुई,",
      rest: "लगातार दो दिन बिना कुछ दर्ज किए। आपके {n} दिन अब भी आपके बैज में गिने जाते हैं। फिर से शुरू करने के लिए आज दर्ज करें।",
    },
  },
  unlock: {
    heading: "बैज अनलॉक हुआ",
    share: "अपना बैज शेयर करें",
    viewAll: "सभी बैज देखें",
    notEnjoying: "बैज के जश्न पसंद नहीं आ रहे?",
    close: "बंद करें",
  },
  settings: {
    celebrations: "बैज के जश्न",
    celebrationsSub: "बैज अनलॉक होने पर एक स्क्रीन।",
    streakOnHome: "होम पर स्ट्रीक",
    streakOnHomeSub: "ब्रैंड के पास लौ और गिनती।",
    note: "दोनों डिफ़ॉल्ट रूप से चालू हैं। जश्न बंद होने पर भी बैज पड़ाव में गिने जाते हैं; बस कुछ पॉप अप नहीं होता। \"बैज के जश्न पसंद नहीं आ रहे?\" यही पेज खोलता है।",
    saveFailed: "सेव नहीं हो पाया। फिर से कोशिश करें।",
  },
};

const TH: MilestonesCopy = {
  title: "หมุดหมาย",
  back: "กลับ",
  dayStreak: "วันในสตรีค",
  badgesEarned: "เหรียญที่ได้รับ",
  longestDays: { one: "{n} วัน", other: "{n} วัน" },
  longestLabel: "สตรีคที่ยาวที่สุด",
  badgesOf: "{n}/{total} เหรียญ",
  earned: "ได้รับแล้ว",
  locked: "ล็อกอยู่",
  streak: {
    dayStreak: { other: "วันในสตรีค" },
    dayStreakHeld: { other: "วันในสตรีค รักษาไว้ได้" },
    days: { one: "วัน", other: "วัน" },
    longest: "ยาวที่สุด",
    floor: "ขั้นต่ำ",
    logToday: "จดวันนี้เพื่อให้เป็น {n}",
    logToStart: "จดวันนี้เพื่อเริ่มสตรีคของคุณ",
    bentMissed: {
      lead: "{day} พลาดไป แต่ {next} รักษาสตรีคไว้ได้",
      rest: "พลาด 1 วัน สตรีคจะสะดุด พลาด 2 วันติดกัน สตรีคจะจบ วันที่สะดุดไม่นับเพิ่ม สตรีคจึงคงอยู่ที่ {n}",
    },
    bentFloor: {
      lead: "{day} ต่ำกว่า {floor} ซึ่งเป็นขั้นต่ำของคุณ",
      rest: "วันที่ต่ำกว่าขั้นต่ำไม่นับรวมในสตรีคหรือเหรียญ สตรีคจึงสะดุดเหมือนวันที่พลาด {next} รักษาไว้ได้",
    },
    bentYesterday: {
      lead: "เมื่อวานพลาดไป จดวันนี้เพื่อรักษาสตรีคไว้",
      rest: "พลาด 1 วัน สตรีคจะสะดุด พลาด 2 วันติดกัน สตรีคจะจบ",
    },
    bentFloorYesterday: { lead: "เมื่อวานต่ำกว่า {floor} kcal ซึ่งเป็นขั้นต่ำของคุณ จดวันนี้เพื่อรักษาสตรีคไว้" },
    bentYesterdayHeld: { lead: "เมื่อวานพลาดไป แต่วันนี้รักษาสตรีคไว้ได้" },
    bentFloorYesterdayHeld: { lead: "เมื่อวานต่ำกว่า {floor} kcal ซึ่งเป็นขั้นต่ำของคุณ แต่วันนี้รักษาสตรีคไว้ได้" },
    ended: {
      lead: "สตรีคจบที่ {n}",
      rest: "หลังจากไม่ได้จด 2 วันติดกัน {n} วันของคุณยังนับรวมในเหรียญ จดวันนี้เพื่อเริ่มใหม่",
    },
  },
  unlock: {
    heading: "ปลดล็อกเหรียญแล้ว",
    share: "แชร์เหรียญของคุณ",
    viewAll: "ดูเหรียญทั้งหมด",
    notEnjoying: "ไม่ชอบการฉลองเหรียญใช่ไหม?",
    close: "ปิด",
  },
  settings: {
    celebrations: "ฉลองเหรียญ",
    celebrationsSub: "แสดงหน้าจอเมื่อคุณปลดล็อกเหรียญ",
    streakOnHome: "สตรีคในหน้าหลัก",
    streakOnHomeSub: "เปลวไฟและตัวเลขข้างโลโก้",
    note: "ทั้งสองอย่างเปิดไว้เป็นค่าเริ่มต้น ถ้าปิดการฉลอง เหรียญยังนับในหมุดหมาย แค่ไม่มีอะไรเด้งขึ้นมา “ไม่ชอบการฉลองเหรียญใช่ไหม?” จะเปิดหน้านี้",
    saveFailed: "บันทึกไม่สำเร็จ ลองอีกครั้ง",
  },
};

const SV: MilestonesCopy = {
  title: "Milstolpar",
  back: "Tillbaka",
  dayStreak: "Dagar i rad",
  badgesEarned: "Intjänade märken",
  longestDays: { one: "{n} dag", other: "{n} dagar" },
  longestLabel: "längsta svit",
  badgesOf: "{n}/{total} märken",
  earned: "intjänat",
  locked: "låst",
  streak: {
    dayStreak: { other: "dagar i rad" },
    dayStreakHeld: { other: "dagar i rad, håller" },
    days: { one: "dag", other: "dagar" },
    longest: "Längsta",
    floor: "lägsta gräns",
    logToday: "Logga i dag så blir det {n}.",
    logToStart: "Logga i dag för att starta din svit.",
    bentMissed: {
      lead: "{day} föll bort; {next} höll den.",
      rest: "En missad dag böjer sviten, två i rad avslutar den. En böjd dag lägger inte till något, så den stannar på {n}.",
    },
    bentFloor: {
      lead: "{day} låg under {floor}, din lägsta gräns.",
      rest: "En dag under den räknas inte till sviten eller ett märke, så den böjde sviten som en missad dag. {next} höll den.",
    },
    bentYesterday: {
      lead: "Gårdagen föll bort; logga i dag för att hålla den.",
      rest: "En missad dag böjer sviten, två i rad avslutar den.",
    },
    bentFloorYesterday: { lead: "Gårdagen låg under {floor} kcal, din lägsta gräns; logga i dag för att hålla den." },
    bentYesterdayHeld: { lead: "Gårdagen föll bort; i dag höll den." },
    bentFloorYesterdayHeld: { lead: "Gårdagen låg under {floor} kcal, din lägsta gräns; i dag höll den." },
    ended: {
      lead: "Sviten slutade på {n},",
      rest: "efter två dagar i rad utan loggning. Dina {n} dagar räknas fortfarande till dina märken. Logga i dag för att börja om.",
    },
  },
  unlock: {
    heading: "Märke upplåst",
    share: "Dela ditt märke",
    viewAll: "Visa alla märken",
    notEnjoying: "Gillar du inte märkesfirandet?",
    close: "Stäng",
  },
  settings: {
    celebrations: "Märkesfirande",
    celebrationsSub: "En skärm när du låser upp ett märke.",
    streakOnHome: "Svit på Hem",
    streakOnHomeSub: "Lågan och antalet vid logotypen.",
    note: "Båda är på som standard. Med firandet av räknas märken fortfarande under Milstolpar; inget dyker upp. ”Gillar du inte märkesfirandet?” öppnar den här sidan.",
    saveFailed: "Det gick inte att spara. Försök igen.",
  },
};

const UK: MilestonesCopy = {
  title: "Віхи",
  back: "Назад",
  dayStreak: "Днів поспіль",
  badgesEarned: "Отримано значків",
  longestDays: { one: "{n} день", other: "{n} дн." },
  longestLabel: "найдовша серія",
  badgesOf: "Значки: {n}/{total}",
  earned: "отримано",
  locked: "закрито",
  streak: {
    dayStreak: { other: "дн. поспіль" },
    dayStreakHeld: { other: "дн. поспіль, серія тримається" },
    days: { one: "день", other: "дн." },
    longest: "Рекорд",
    floor: "нижня межа",
    logToday: "Запиши щось сьогодні, щоб стало {n}.",
    logToStart: "Запиши щось сьогодні, щоб почати серію.",
    bentMissed: {
      lead: "{day}: пропуск; {next}: серію втримано.",
      rest: "Один пропущений день згинає серію, два поспіль — обривають її. Зігнутий день нічого не додає, тому серія лишається на {n}.",
    },
    bentFloor: {
      lead: "{day}: нижче {floor} — твоєї нижньої межі.",
      rest: "День нижче нижньої межі не зараховується ні до серії, ні до значка, тож він зігнув серію, як пропущений день. {next}: серію втримано.",
    },
    bentYesterday: {
      lead: "Учора — пропуск; запиши щось сьогодні, щоб утримати серію.",
      rest: "Один пропущений день згинає серію, два поспіль — обривають її.",
    },
    bentFloorYesterday: { lead: "Учора було нижче {floor} ккал — твоєї нижньої межі; запиши щось сьогодні, щоб утримати серію." },
    bentYesterdayHeld: { lead: "Учора — пропуск; сьогодні серію втримано." },
    bentFloorYesterdayHeld: { lead: "Учора було нижче {floor} ккал — твоєї нижньої межі; сьогодні серію втримано." },
    ended: {
      lead: "Серія завершилася на {n},",
      rest: "після двох днів поспіль без записів. Твої {n} дн. і далі зараховуються до значків. Запиши щось сьогодні, щоб почати знову.",
    },
  },
  unlock: {
    heading: "Значок відкрито",
    share: "Поділитися значком",
    viewAll: "Усі значки",
    notEnjoying: "Не подобаються святкування значків?",
    close: "Закрити",
  },
  settings: {
    celebrations: "Святкування значків",
    celebrationsSub: "Екран, коли ти відкриваєш значок.",
    streakOnHome: "Серія на головній",
    streakOnHomeSub: "Вогник і число біля логотипа.",
    note: "Обидва ввімкнено за замовчуванням. Якщо святкування вимкнено, значки й далі зараховуються у Віхах; нічого не спливає. «Не подобаються святкування значків?» відкриває цю сторінку.",
    saveFailed: "Не вдалося зберегти. Спробуй ще раз.",
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
    bentFloorYesterday: { lead: "Gisteren bleef onder {floor} kcal, je ondergrens; log vandaag om hem vast te houden." },
    bentYesterdayHeld: { lead: "Gisteren ging mis; vandaag hield hem vast." },
    bentFloorYesterdayHeld: { lead: "Gisteren bleef onder {floor} kcal, je ondergrens; vandaag hield hem vast." },
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
    bentFloorYesterday: { lead: "Wczoraj poniżej {floor} kcal, twojego minimum; zapisz coś dziś, aby utrzymać serię." },
    bentYesterdayHeld: { lead: "Wczoraj — przerwa; dziś seria utrzymana." },
    bentFloorYesterdayHeld: { lead: "Wczoraj poniżej {floor} kcal, twojego minimum; dziś seria utrzymana." },
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
    bentFloorYesterday: { lead: "Dün, alt sınırın olan {floor} kcal altında kaldı; seriyi korumak için bugün kayıt yap." },
    bentYesterdayHeld: { lead: "Dün kaçtı; seriyi bugün korudu." },
    bentFloorYesterdayHeld: { lead: "Dün, alt sınırın olan {floor} kcal altında kaldı; seriyi bugün korudu." },
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
  badgesOf: "{n}／{total} 個徽章",
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
  longestLabel: "最长连续记录",
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
    bentFloorYesterday: { lead: "Ontem ficou abaixo de {floor} kcal, seu piso; registre hoje para segurar a sequência." },
    bentYesterdayHeld: { lead: "Ontem falhou; hoje segurou a sequência." },
    bentFloorYesterdayHeld: { lead: "Ontem ficou abaixo de {floor} kcal, seu piso; hoje segurou a sequência." },
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
  en: EN, fr: FR, de: DE, it: IT, es: ES, vi: VI, id: ID, ru: RU, te: TE, ta: TA, pa: PA, or: OR, mr: MR, ml: ML, kn: KN, gu: GU, bn: BN, "pt-PT": PT_PT, ms: MS, ca: CA, sl: SL, hr: HR, sk: SK, no: NO, fi: FI, da: DA, hu: HU, el: EL, ro: RO, cs: CS, hi: HI, th: TH, sv: SV, uk: UK, nl: NL, pl: PL, tr: TR, "zh-Hant": ZH_HANT, "zh-Hans": ZH_HANS, ko: KO, ja: JA, "pt-BR": PT_BR,
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
