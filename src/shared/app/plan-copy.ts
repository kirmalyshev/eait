// The plan reveal's own words (#402); the rest is `summary.*` and `youCopyFor(lang).phone`, and `{kg}` arrives unit-formatted.

import { t, type CountForms, type Localized } from "../lang.ts";
import type { Lang } from "../types.ts";

export interface PlanCopy {
  /** The journey card's title. */
  goalLine: string;
  /** The "Your weight" card's title (#2046, Cal AI's order). */
  weightTitle: string;
  /** The daily-targets card's title: "Every day". */
  everyDay: string;
  /** Under `everyDay`: "You can change this anytime". */
  changeAnytime: string;
  /** The answers card's title: "Your info". */
  infoTitle: string;
  /** The maintain card's title. */
  goalStay: string;
  /** The maintain card's band under its title (#1694); `{range}` is `maintainRange`'s "78–82kg". */
  goalRange: string;
  /** The declared saturated-fat limit's column label, beside its "≤ 13g". */
  satFat: string;
  /** The waterfall's last bar. */
  yourPlan: string;
  /** The maintain card's first bar. */
  youBurn: string;
  /** The button slot's label while the screen settles. */
  building: string;
  /** The date axis' first tick. */
  today: string;
  /** The note under the cards: what the target is computed from, and only what the engine does (#1692). */
  method: string;
  /** The note's source line. */
  methodSource: string;
  /** The plan's headline for lose and gain (#2050): "Goal: lose {kg} by {month}". `{kg}` is the distance. */
  goalLose: string;
  goalGain: string;
  /** The answers card's rows (#2050). */
  startWeight: string;
  goalWeight: string;
  activity: string;
  target: string;
  /** The `target` row's value: "lose {kg} by {month}". */
  targetLose: string;
  targetGain: string;
  /** The steps card (#2050): its title and its four rows; `{kcal}` is the day's target, formatted. */
  reachTitle: string;
  stepPhoto: string;
  stepKcal: string;
  stepBalance: string;
  stepWeigh: string;
  /** The fold that holds the waterfall and the method note. */
  howCalc: string;
  /** The loader's goal caption (17, ieat-app#2050): "Your goal · −6kg by January 2027". */
  yourGoal: string;
  loaderLose: string;
  loaderGain: string;
  /** Under "Your info" (18b): "Based on your answers". */
  basedOn: string;
  /** The declared saturated-fat limit's row (18b): "Saturated fat · you asked: ≤ 13g a day"; `{g}` is formatted. */
  satFatAsked: string;
  satFatPerDay: string;
  /** The loader's people counter, `{n}` from `OnboardingContentResponse.peopleBuilding`; drawn only for n > 0. */
  people: CountForms;
}

export const PLAN_COPY: Localized<PlanCopy> = {
  en: {
    goalLine: "Goal: {kg}, around {month}", goalStay: "Goal: stay around {kg}", goalRange: "Range: {range}",
    weightTitle: "Your weight", everyDay: "Every day", changeAnytime: "You can change this anytime", infoTitle: "Your info",
    satFat: "sat fat", yourPlan: "Your plan", youBurn: "You burn",
    building: "Building your plan", today: "Today",
    method: "Your plan starts from the Mifflin–St Jeor equation, using your age, height, weight, sex and activity. Each new weigh-in recalculates it.",
    methodSource: "Source: Mifflin et al., Am J Clin Nutr, 1990",
    goalLose: "Goal: lose {kg} by {month}", goalGain: "Goal: gain {kg} by {month}", startWeight: "Starting weight", goalWeight: "Goal weight", activity: "Activity", target: "Target",
    targetLose: "lose {kg} by {month}", targetGain: "gain {kg} by {month}", reachTitle: "How to reach your goal", stepPhoto: "Photograph every meal",
    stepKcal: "Stay within {kcal} kcal a day", stepBalance: "Balance protein, carbs and fat", stepWeigh: "Weigh in once a week", howCalc: "How we calculate your plan",
    yourGoal: "Your goal", loaderLose: "−{kg} by {month}", loaderGain: "+{kg} by {month}",
    basedOn: "Based on your answers", satFatAsked: "Saturated fat · you asked", satFatPerDay: "≤ {g} a day",
    people: { one: "{n} person is building their plan with eait", other: "{n} people are building their plan with eait" },
  },
  fr: {
    goalLine: "Objectif : {kg}, vers {month}", goalStay: "Objectif : rester autour de {kg}", goalRange: "Fourchette : {range}",
    weightTitle: "Ton poids", everyDay: "Chaque jour", changeAnytime: "Tu peux changer ça quand tu veux", infoTitle: "Tes infos",
    satFat: "graisses sat.", yourPlan: "Ton plan", youBurn: "Tu brûles",
    building: "Création de ton plan", today: "Aujourd’hui",
    method: "Ton plan part de l’équation de Mifflin–St Jeor, avec ton âge, ta taille, ton poids, ton sexe et ton activité. Chaque nouvelle pesée le recalcule.",
    methodSource: "Source : Mifflin et al., Am J Clin Nutr, 1990",
    goalLose: "Objectif : −{kg} d’ici {month}", goalGain: "Objectif : +{kg} d’ici {month}", startWeight: "Poids de départ", goalWeight: "Poids visé", activity: "Activité", target: "Objectif",
    targetLose: "−{kg} d’ici {month}", targetGain: "+{kg} d’ici {month}", reachTitle: "Comment atteindre ton objectif", stepPhoto: "Photographie chaque repas",
    stepKcal: "Reste sous {kcal} kcal par jour", stepBalance: "Équilibre protéines, glucides et lipides", stepWeigh: "Pèse-toi une fois par semaine", howCalc: "Comment on calcule ton plan",
    yourGoal: "Ton objectif", loaderLose: "−{kg} d’ici {month}", loaderGain: "+{kg} d’ici {month}",
    basedOn: "D’après tes réponses", satFatAsked: "Graisses saturées · ta demande", satFatPerDay: "≤ {g} par jour",
    people: { one: "{n} personne crée son plan avec eait", other: "{n} personnes créent leur plan avec eait" },
  },
  de: {
    goalLine: "Ziel: {kg}, etwa {month}", goalStay: "Ziel: bei etwa {kg} bleiben", goalRange: "Bereich: {range}",
    weightTitle: "Dein Gewicht", everyDay: "Jeden Tag", changeAnytime: "Du kannst das jederzeit ändern", infoTitle: "Deine Angaben",
    satFat: "ges. Fett", yourPlan: "Dein Plan", youBurn: "Du verbrennst",
    building: "Dein Plan entsteht", today: "Heute",
    method: "Dein Plan beruht auf der Mifflin-St-Jeor-Formel, mit deinem Alter, deiner Größe, deinem Gewicht, Geschlecht und deiner Aktivität. Jedes neue Wiegen berechnet ihn neu.",
    methodSource: "Quelle: Mifflin et al., Am J Clin Nutr, 1990",
    goalLose: "Ziel: −{kg} bis {month}", goalGain: "Ziel: +{kg} bis {month}", startWeight: "Startgewicht", goalWeight: "Zielgewicht", activity: "Aktivität", target: "Ziel",
    targetLose: "−{kg} bis {month}", targetGain: "+{kg} bis {month}", reachTitle: "So erreichst du dein Ziel", stepPhoto: "Fotografiere jede Mahlzeit",
    stepKcal: "Bleib unter {kcal} kcal am Tag", stepBalance: "Achte auf Eiweiß, Kohlenhydrate und Fett", stepWeigh: "Wiege dich einmal pro Woche", howCalc: "So berechnen wir deinen Plan",
    yourGoal: "Dein Ziel", loaderLose: "−{kg} bis {month}", loaderGain: "+{kg} bis {month}",
    basedOn: "Basierend auf deinen Antworten", satFatAsked: "Gesättigte Fette · dein Wunsch", satFatPerDay: "≤ {g} am Tag",
    people: { one: "{n} Person erstellt gerade ihren Plan mit eait", other: "{n} Personen erstellen gerade ihren Plan mit eait" },
  },
  it: {
    goalLine: "Obiettivo: {kg}, intorno a {month}", goalStay: "Obiettivo: restare intorno a {kg}", goalRange: "Intervallo: {range}",
    weightTitle: "Il tuo peso", everyDay: "Ogni giorno", changeAnytime: "Puoi cambiarlo quando vuoi", infoTitle: "I tuoi dati",
    satFat: "grassi sat.", yourPlan: "Il tuo piano", youBurn: "Bruci",
    building: "Creo il tuo piano", today: "Oggi",
    method: "Il tuo piano parte dall’equazione di Mifflin–St Jeor, con età, altezza, peso, sesso e attività. Ogni nuova pesata lo ricalcola.",
    methodSource: "Fonte: Mifflin et al., Am J Clin Nutr, 1990",
    goalLose: "Obiettivo: −{kg} entro {month}", goalGain: "Obiettivo: +{kg} entro {month}", startWeight: "Peso di partenza", goalWeight: "Peso obiettivo", activity: "Attività", target: "Obiettivo",
    targetLose: "−{kg} entro {month}", targetGain: "+{kg} entro {month}", reachTitle: "Come raggiungere il tuo obiettivo", stepPhoto: "Fotografa ogni pasto",
    stepKcal: "Resta entro {kcal} kcal al giorno", stepBalance: "Bilancia proteine, carboidrati e grassi", stepWeigh: "Pesati una volta a settimana", howCalc: "Come calcoliamo il tuo piano",
    yourGoal: "Il tuo obiettivo", loaderLose: "−{kg} entro {month}", loaderGain: "+{kg} entro {month}",
    basedOn: "In base alle tue risposte", satFatAsked: "Grassi saturi · la tua richiesta", satFatPerDay: "≤ {g} al giorno",
    people: { one: "{n} persona sta creando il suo piano con eait", other: "{n} persone stanno creando il loro piano con eait" },
  },
  es: {
    goalLine: "Objetivo: {kg}, hacia {month}", goalStay: "Objetivo: mantenerte en torno a {kg}", goalRange: "Rango: {range}",
    weightTitle: "Tu peso", everyDay: "Cada día", changeAnytime: "Puedes cambiarlo cuando quieras", infoTitle: "Tus datos",
    satFat: "grasa sat.", yourPlan: "Tu plan", youBurn: "Quemas",
    building: "Creando tu plan", today: "Hoy",
    method: "Tu plan parte de la ecuación de Mifflin–St Jeor, con tu edad, altura, peso, sexo y actividad. Cada nuevo pesaje lo recalcula.",
    methodSource: "Fuente: Mifflin et al., Am J Clin Nutr, 1990",
    goalLose: "Objetivo: −{kg} para {month}", goalGain: "Objetivo: +{kg} para {month}", startWeight: "Peso inicial", goalWeight: "Peso objetivo", activity: "Actividad", target: "Objetivo",
    targetLose: "−{kg} para {month}", targetGain: "+{kg} para {month}", reachTitle: "Cómo llegar a tu objetivo", stepPhoto: "Fotografía cada comida",
    stepKcal: "Quédate en {kcal} kcal al día", stepBalance: "Equilibra proteínas, carbohidratos y grasas", stepWeigh: "Pésate una vez por semana", howCalc: "Cómo calculamos tu plan",
    yourGoal: "Tu objetivo", loaderLose: "−{kg} para {month}", loaderGain: "+{kg} para {month}",
    basedOn: "Según tus respuestas", satFatAsked: "Grasas saturadas · lo que pediste", satFatPerDay: "≤ {g} al día",
    people: { one: "{n} persona está creando su plan con eait", other: "{n} personas están creando su plan con eait" },
  },
  vi: {
    goalLine: "Mục tiêu: {kg}, khoảng {month}", goalStay: "Mục tiêu: giữ quanh {kg}", goalRange: "Khoảng: {range}",
    weightTitle: "Cân nặng của bạn", everyDay: "Mỗi ngày", changeAnytime: "Bạn có thể đổi bất cứ lúc nào", infoTitle: "Thông tin của bạn",
    satFat: "chất béo bão hòa", yourPlan: "Kế hoạch của bạn", youBurn: "Bạn tiêu hao",
    building: "Đang tạo kế hoạch", today: "Hôm nay",
    method: "Kế hoạch của bạn dựa trên công thức Mifflin–St Jeor, từ tuổi, chiều cao, cân nặng, giới tính và mức vận động của bạn. Mỗi lần cân mới, kế hoạch được tính lại.",
    methodSource: "Nguồn: Mifflin et al., Am J Clin Nutr, 1990",
    goalLose: "Mục tiêu: −{kg} trước {month}", goalGain: "Mục tiêu: +{kg} trước {month}", startWeight: "Cân nặng ban đầu", goalWeight: "Cân nặng mục tiêu", activity: "Mức vận động", target: "Mục tiêu",
    targetLose: "−{kg} trước {month}", targetGain: "+{kg} trước {month}", reachTitle: "Cách đạt mục tiêu", stepPhoto: "Chụp ảnh mọi bữa ăn",
    stepKcal: "Giữ trong {kcal} kcal mỗi ngày", stepBalance: "Cân bằng đạm, tinh bột và chất béo", stepWeigh: "Cân mỗi tuần một lần", howCalc: "Cách chúng tôi tính kế hoạch",
    yourGoal: "Mục tiêu của bạn", loaderLose: "−{kg} trước {month}", loaderGain: "+{kg} trước {month}",
    basedOn: "Dựa trên câu trả lời của bạn", satFatAsked: "Chất béo bão hòa · bạn yêu cầu", satFatPerDay: "≤ {g} mỗi ngày",
    people: { other: "{n} người đang lập kế hoạch với eait" },
  },
  id: {
    goalLine: "Target: {kg}, sekitar {month}", goalStay: "Target: tetap di sekitar {kg}", goalRange: "Rentang: {range}",
    weightTitle: "Berat badanmu", everyDay: "Setiap hari", changeAnytime: "Kamu bisa mengubahnya kapan saja", infoTitle: "Data dirimu",
    satFat: "lemak jenuh", yourPlan: "Rencanamu", youBurn: "Kamu membakar",
    building: "Menyusun rencanamu", today: "Hari ini",
    method: "Rencanamu dihitung dari rumus Mifflin–St Jeor, dengan usia, tinggi, berat, jenis kelamin, dan aktivitasmu. Setiap timbangan baru menghitungnya ulang.",
    methodSource: "Sumber: Mifflin et al., Am J Clin Nutr, 1990",
    goalLose: "Target: −{kg} sebelum {month}", goalGain: "Target: +{kg} sebelum {month}", startWeight: "Berat awal", goalWeight: "Berat target", activity: "Aktivitas", target: "Target",
    targetLose: "−{kg} sebelum {month}", targetGain: "+{kg} sebelum {month}", reachTitle: "Cara mencapai targetmu", stepPhoto: "Foto setiap makanan",
    stepKcal: "Tetap di bawah {kcal} kkal sehari", stepBalance: "Seimbangkan protein, karbohidrat, dan lemak", stepWeigh: "Timbang sekali seminggu", howCalc: "Cara kami menghitung rencanamu",
    yourGoal: "Tujuanmu", loaderLose: "−{kg} sebelum {month}", loaderGain: "+{kg} sebelum {month}",
    basedOn: "Berdasarkan jawabanmu", satFatAsked: "Lemak jenuh · permintaanmu", satFatPerDay: "≤ {g} sehari",
    people: { other: "{n} orang sedang menyusun rencana dengan eait" },
  },
  ru: {
    goalLine: "Цель: {kg} · ориентир — {month}", goalStay: "Цель: держаться около {kg}", goalRange: "Диапазон: {range}",
    weightTitle: "Твой вес", everyDay: "Каждый день", changeAnytime: "Это можно изменить в любой момент", infoTitle: "Твои данные",
    satFat: "насыщ. жиры", yourPlan: "Твой план", youBurn: "Ты сжигаешь",
    building: "Составляю твой план", today: "Сегодня",
    method: "Твой план строится на формуле Миффлина — Сан Жеора: возраст, рост, вес, пол и активность. Каждое новое взвешивание пересчитывает его.",
    methodSource: "Источник: Mifflin et al., Am J Clin Nutr, 1990",
    goalLose: "Цель: −{kg} · ориентир — {month}", goalGain: "Цель: +{kg} · ориентир — {month}", startWeight: "Начальный вес", goalWeight: "Целевой вес", activity: "Активность", target: "Цель",
    targetLose: "−{kg} · ориентир — {month}", targetGain: "+{kg} · ориентир — {month}", reachTitle: "Как прийти к цели", stepPhoto: "Фотографировать каждый приём пищи",
    stepKcal: "Держаться в пределах {kcal} ккал в день", stepBalance: "Соблюдать баланс белков, углеводов и жиров", stepWeigh: "Взвешиваться раз в неделю", howCalc: "Как мы считаем твой план",
    yourGoal: "Твоя цель", loaderLose: "−{kg} · ориентир — {month}", loaderGain: "+{kg} · ориентир — {month}",
    basedOn: "По твоим ответам", satFatAsked: "Насыщенные жиры · твой запрос", satFatPerDay: "≤ {g} в день",
    people: { one: "{n} человек составляет свой план с eait", few: "{n} человека составляют свой план с eait", many: "{n} человек составляют свой план с eait", other: "{n} человека составляют свой план с eait" },
  },
  hu: {
    goalLine: "Cél: {kg}, nagyjából {month}", goalStay: "Cél: {kg} körül maradni", goalRange: "Tartomány: {range}",
    weightTitle: "A súlyod", everyDay: "Minden nap", changeAnytime: "Ezt bármikor módosíthatod", infoTitle: "Az adataid",
    satFat: "tel. zsír", yourPlan: "A terved", youBurn: "Ennyit égetsz el",
    building: "A terved készül", today: "Ma",
    method: "A terved a Mifflin–St Jeor-egyenletből indul ki az életkorod, magasságod, súlyod, nemed és aktivitásod alapján. Minden új mérés újraszámolja.",
    methodSource: "Forrás: Mifflin et al., Am J Clin Nutr, 1990",
    goalLose: "Cél: −{kg} · határidő: {month}", goalGain: "Cél: +{kg} · határidő: {month}", startWeight: "Kezdő súly", goalWeight: "Célsúly", activity: "Aktivitás", target: "Célérték",
    targetLose: "−{kg} · határidő: {month}", targetGain: "+{kg} · határidő: {month}", reachTitle: "Így éred el a célodat", stepPhoto: "Fotózz le minden étkezést",
    stepKcal: "Maradj napi {kcal} kcal-on belül", stepBalance: "Tartsd egyensúlyban a fehérjét, a szénhidrátot és a zsírt", stepWeigh: "Mérd meg magad hetente egyszer", howCalc: "Így számoljuk a tervedet",
    yourGoal: "A célod", loaderLose: "−{kg} · határidő: {month}", loaderGain: "+{kg} · határidő: {month}",
    basedOn: "A válaszaid alapján", satFatAsked: "Telített zsír · te kérted", satFatPerDay: "≤ {g} naponta",
    people: { one: "{n} ember készíti a tervét az eait-tel", other: "{n} ember készíti a tervét az eait-tel" },
  },
  el: {
    goalLine: "Στόχος: {kg} · περίπου {month}", goalStay: "Στόχος: να μείνεις γύρω στα {kg}", goalRange: "Εύρος: {range}",
    weightTitle: "Το βάρος σου", everyDay: "Κάθε μέρα", changeAnytime: "Μπορείς να το αλλάξεις όποτε θες", infoTitle: "Τα στοιχεία σου",
    satFat: "κορ. λιπαρά", yourPlan: "Το πλάνο σου", youBurn: "Καις",
    building: "Το πλάνο σου ετοιμάζεται", today: "Σήμερα",
    method: "Το πλάνο σου ξεκινά από την εξίσωση Mifflin–St Jeor, με βάση την ηλικία, το ύψος, το βάρος, το φύλο και τη δραστηριότητά σου. Κάθε νέα ζύγιση το υπολογίζει ξανά.",
    methodSource: "Πηγή: Mifflin et al., Am J Clin Nutr, 1990",
    goalLose: "Στόχος: −{kg} · {month}", goalGain: "Στόχος: +{kg} · {month}", startWeight: "Αρχικό βάρος", goalWeight: "Βάρος-στόχος", activity: "Δραστηριότητα", target: "Στόχος",
    targetLose: "−{kg} · {month}", targetGain: "+{kg} · {month}", reachTitle: "Πώς θα φτάσεις τον στόχο σου", stepPhoto: "Φωτογράφιζε κάθε γεύμα",
    stepKcal: "Μείνε εντός {kcal} kcal την ημέρα", stepBalance: "Ισορρόπησε πρωτεΐνη, υδατάνθρακες και λιπαρά", stepWeigh: "Ζυγίσου μία φορά την εβδομάδα", howCalc: "Πώς υπολογίζουμε το πλάνο σου",
    yourGoal: "Ο στόχος σου", loaderLose: "−{kg} · {month}", loaderGain: "+{kg} · {month}",
    basedOn: "Με βάση τις απαντήσεις σου", satFatAsked: "Κορεσμένα λιπαρά · το ζήτησες", satFatPerDay: "≤ {g} την ημέρα",
    people: { one: "{n} άτομο φτιάχνει το πλάνο του με το eait", other: "{n} άτομα φτιάχνουν το πλάνο τους με το eait" },
  },
  ro: {
    goalLine: "Obiectiv: {kg}, pe la {month}", goalStay: "Obiectiv: să rămâi în jur de {kg}", goalRange: "Interval: {range}",
    weightTitle: "Greutatea ta", everyDay: "În fiecare zi", changeAnytime: "Poți schimba asta oricând", infoTitle: "Datele tale",
    satFat: "grăsimi sat.", yourPlan: "Planul tău", youBurn: "Arzi",
    building: "Îți construim planul", today: "Azi",
    method: "Planul tău pornește de la ecuația Mifflin–St Jeor, folosind vârsta, înălțimea, greutatea, sexul și activitatea ta. Fiecare cântărire nouă îl recalculează.",
    methodSource: "Sursa: Mifflin et al., Am J Clin Nutr, 1990",
    goalLose: "Obiectiv: −{kg} până în {month}", goalGain: "Obiectiv: +{kg} până în {month}", startWeight: "Greutatea de pornire", goalWeight: "Greutatea țintă", activity: "Activitate", target: "Țintă",
    targetLose: "−{kg} până în {month}", targetGain: "+{kg} până în {month}", reachTitle: "Cum să-ți atingi obiectivul", stepPhoto: "Fotografiază fiecare masă",
    stepKcal: "Încadrează-te în {kcal} kcal pe zi", stepBalance: "Echilibrează proteinele, carbohidrații și grăsimile", stepWeigh: "Cântărește-te o dată pe săptămână", howCalc: "Cum îți calculăm planul",
    yourGoal: "Obiectivul tău", loaderLose: "−{kg} până în {month}", loaderGain: "+{kg} până în {month}",
    basedOn: "Pe baza răspunsurilor tale", satFatAsked: "Grăsimi saturate · la cererea ta", satFatPerDay: "≤ {g} pe zi",
    people: { one: "{n} persoană își face planul cu eait", other: "Oameni care își fac planul cu eait: {n}" },
  },
  cs: {
    goalLine: "Cíl: {kg} · orientačně {month}", goalStay: "Cíl: držet se kolem {kg}", goalRange: "Rozmezí: {range}",
    weightTitle: "Tvoje váha", everyDay: "Každý den", changeAnytime: "Tohle můžeš kdykoli změnit", infoTitle: "Tvoje údaje",
    satFat: "nas. tuky", yourPlan: "Tvůj plán", youBurn: "Tvůj výdej",
    building: "Sestavuju tvůj plán", today: "Dnes",
    method: "Tvůj plán vychází z rovnice Mifflin–St Jeor podle tvého věku, výšky, váhy, pohlaví a aktivity. Každé nové vážení ho přepočítá.",
    methodSource: "Zdroj: Mifflin et al., Am J Clin Nutr, 1990",
    goalLose: "Cíl: −{kg} · orientačně {month}", goalGain: "Cíl: +{kg} · orientačně {month}", startWeight: "Počáteční váha", goalWeight: "Cílová váha", activity: "Aktivita", target: "Cíl",
    targetLose: "−{kg} · orientačně {month}", targetGain: "+{kg} · orientačně {month}", reachTitle: "Jak dosáhnout cíle", stepPhoto: "Fotit každé jídlo",
    stepKcal: "Držet se do {kcal} kcal denně", stepBalance: "Vyvážit bílkoviny, sacharidy a tuky", stepWeigh: "Vážit se jednou týdně", howCalc: "Jak počítáme tvůj plán",
    yourGoal: "Tvůj cíl", loaderLose: "−{kg} · orientačně {month}", loaderGain: "+{kg} · orientačně {month}",
    basedOn: "Podle tvých odpovědí", satFatAsked: "Nasycené tuky · na tvoje přání", satFatPerDay: "≤ {g} denně",
    people: { one: "{n} člověk si s eait sestavuje plán", other: "Lidé, kteří si s eait sestavují plán: {n}" },
  },
  hi: {
    goalLine: "लक्ष्य: {kg}, लगभग {month} तक", goalStay: "लक्ष्य: लगभग {kg} पर बने रहें", goalRange: "दायरा: {range}",
    weightTitle: "आपका वज़न", everyDay: "हर दिन", changeAnytime: "इसे कभी भी बदला जा सकता है", infoTitle: "आपकी जानकारी",
    satFat: "सैच. फ़ैट", yourPlan: "आपका प्लान", youBurn: "आपकी खपत",
    building: "आपका प्लान बन रहा है", today: "आज",
    method: "आपका प्लान Mifflin–St Jeor समीकरण से शुरू होता है, जिसमें आपकी उम्र, लंबाई, वज़न, लिंग और गतिविधि ली जाती है। हर नया वज़न माप इसे फिर से कैलकुलेट करता है।",
    methodSource: "स्रोत: Mifflin et al., Am J Clin Nutr, 1990",
    goalLose: "लक्ष्य: −{kg} · {month} तक", goalGain: "लक्ष्य: +{kg} · {month} तक", startWeight: "शुरुआती वज़न", goalWeight: "लक्ष्य वज़न", activity: "गतिविधि", target: "लक्ष्य",
    targetLose: "−{kg} · {month} तक", targetGain: "+{kg} · {month} तक", reachTitle: "अपने लक्ष्य तक कैसे पहुँचें", stepPhoto: "हर भोजन की फ़ोटो लें",
    stepKcal: "रोज़ {kcal} kcal के भीतर रहें", stepBalance: "प्रोटीन, कार्ब्स और फ़ैट में संतुलन रखें", stepWeigh: "हफ़्ते में एक बार वज़न लें", howCalc: "हम आपका प्लान कैसे कैलकुलेट करते हैं",
    yourGoal: "आपका लक्ष्य", loaderLose: "−{kg} · {month} तक", loaderGain: "+{kg} · {month} तक",
    basedOn: "आपके जवाबों के आधार पर", satFatAsked: "सैचुरेटेड फ़ैट · आपके कहने पर", satFatPerDay: "≤ {g} प्रति दिन",
    people: { one: "{n} व्यक्ति eait के साथ अपना प्लान बना रहा है", other: "{n} लोग eait के साथ अपना प्लान बना रहे हैं" },
  },
  th: {
    goalLine: "เป้าหมาย: {kg} ราว {month}", goalStay: "เป้าหมาย: คงไว้ราว {kg}", goalRange: "ช่วง: {range}",
    weightTitle: "น้ำหนักของคุณ", everyDay: "ทุกวัน", changeAnytime: "เปลี่ยนได้ทุกเมื่อ", infoTitle: "ข้อมูลของคุณ",
    satFat: "ไขมันอิ่มตัว", yourPlan: "แผนของคุณ", youBurn: "คุณเผาผลาญ",
    building: "กำลังสร้างแผนของคุณ", today: "วันนี้",
    method: "แผนของคุณเริ่มจากสมการ Mifflin–St Jeor โดยใช้อายุ ส่วนสูง น้ำหนัก เพศ และระดับกิจกรรมของคุณ ทุกครั้งที่ชั่งน้ำหนักใหม่ แผนจะคำนวณใหม่",
    methodSource: "ที่มา: Mifflin et al., Am J Clin Nutr, 1990",
    goalLose: "เป้าหมาย: −{kg} ภายใน {month}", goalGain: "เป้าหมาย: +{kg} ภายใน {month}", startWeight: "น้ำหนักเริ่มต้น", goalWeight: "น้ำหนักเป้าหมาย", activity: "กิจกรรม", target: "เป้า",
    targetLose: "−{kg} ภายใน {month}", targetGain: "+{kg} ภายใน {month}", reachTitle: "วิธีไปให้ถึงเป้าหมาย", stepPhoto: "ถ่ายรูปทุกมื้อ",
    stepKcal: "อยู่ในกรอบ {kcal} kcal ต่อวัน", stepBalance: "จัดสมดุลโปรตีน คาร์บ และไขมัน", stepWeigh: "ชั่งน้ำหนักสัปดาห์ละครั้ง", howCalc: "เราคำนวณแผนของคุณอย่างไร",
    yourGoal: "เป้าหมายของคุณ", loaderLose: "−{kg} ภายใน {month}", loaderGain: "+{kg} ภายใน {month}",
    basedOn: "จากคำตอบของคุณ", satFatAsked: "ไขมันอิ่มตัว · ตามที่คุณขอ", satFatPerDay: "≤ {g} ต่อวัน",
    people: { one: "{n} คนกำลังสร้างแผนกับ eait", other: "{n} คนกำลังสร้างแผนกับ eait" },
  },
  sv: {
    goalLine: "Mål: {kg}, runt {month}", goalStay: "Mål: ligga kvar runt {kg}", goalRange: "Intervall: {range}",
    weightTitle: "Din vikt", everyDay: "Varje dag", changeAnytime: "Du kan ändra det när du vill", infoTitle: "Dina uppgifter",
    satFat: "mättat fett", yourPlan: "Din plan", youBurn: "Du förbränner",
    building: "Din plan byggs", today: "I dag",
    method: "Din plan utgår från Mifflin–St Jeor-ekvationen, med din ålder, längd, vikt, ditt kön och din aktivitet. Varje ny vägning räknar om den.",
    methodSource: "Källa: Mifflin et al., Am J Clin Nutr, 1990",
    goalLose: "Mål: −{kg} till {month}", goalGain: "Mål: +{kg} till {month}", startWeight: "Startvikt", goalWeight: "Målvikt", activity: "Aktivitet", target: "Mål",
    targetLose: "−{kg} till {month}", targetGain: "+{kg} till {month}", reachTitle: "Så når du ditt mål", stepPhoto: "Fotografera varje måltid",
    stepKcal: "Håll dig inom {kcal} kcal per dag", stepBalance: "Balansera protein, kolhydrater och fett", stepWeigh: "Väg dig en gång i veckan", howCalc: "Så räknar vi fram din plan",
    yourGoal: "Ditt mål", loaderLose: "−{kg} till {month}", loaderGain: "+{kg} till {month}",
    basedOn: "Utifrån dina svar", satFatAsked: "Mättat fett · du bad om det", satFatPerDay: "≤ {g} per dag",
    people: { one: "{n} person bygger sin plan med eait", other: "{n} personer bygger sin plan med eait" },
  },
  uk: {
    goalLine: "Мета: {kg}, орієнтир — {month}", goalStay: "Мета: триматися близько {kg}", goalRange: "Діапазон: {range}",
    weightTitle: "Твоя вага", everyDay: "Щодня", changeAnytime: "Це можна змінити будь-коли", infoTitle: "Твої дані",
    satFat: "нас. жири", yourPlan: "Твій план", youBurn: "Ти спалюєш",
    building: "Складаю твій план", today: "Сьогодні",
    method: "Твій план базується на формулі Міффліна — Сан Жеора: вік, зріст, вага, стать і активність. Кожне нове зважування перераховує його.",
    methodSource: "Джерело: Mifflin et al., Am J Clin Nutr, 1990",
    goalLose: "Мета: −{kg} · орієнтир — {month}", goalGain: "Мета: +{kg} · орієнтир — {month}", startWeight: "Початкова вага", goalWeight: "Бажана вага", activity: "Активність", target: "Ціль",
    targetLose: "−{kg} · орієнтир — {month}", targetGain: "+{kg} · орієнтир — {month}", reachTitle: "Як дійти до мети", stepPhoto: "Фотографувати кожен прийом їжі",
    stepKcal: "Триматися в межах {kcal} ккал на день", stepBalance: "Збалансувати білок, вуглеводи й жири", stepWeigh: "Зважуватися раз на тиждень", howCalc: "Як ми рахуємо твій план",
    yourGoal: "Твоя мета", loaderLose: "−{kg} · орієнтир — {month}", loaderGain: "+{kg} · орієнтир — {month}",
    basedOn: "За твоїми відповідями", satFatAsked: "Насичені жири · твій запит", satFatPerDay: "≤ {g} на день",
    people: { one: "{n} людина складає свій план з eait", other: "Складають свій план з eait: {n}" },
  },
  nl: {
    goalLine: "Doel: {kg}, rond {month}", goalStay: "Doel: rond {kg} blijven", goalRange: "Bereik: {range}",
    weightTitle: "Je gewicht", everyDay: "Elke dag", changeAnytime: "Je kunt dit altijd aanpassen", infoTitle: "Je gegevens",
    satFat: "verz. vet", yourPlan: "Je plan", youBurn: "Je verbrandt",
    building: "Je plan wordt gemaakt", today: "Vandaag",
    method: "Je plan begint bij de Mifflin-St Jeor-formule, met je leeftijd, lengte, gewicht, geslacht en activiteit. Elke nieuwe weging rekent het opnieuw uit.",
    methodSource: "Bron: Mifflin et al., Am J Clin Nutr, 1990",
    goalLose: "Doel: {kg} afvallen vóór {month}", goalGain: "Doel: {kg} aankomen vóór {month}", startWeight: "Startgewicht", goalWeight: "Streefgewicht", activity: "Activiteit", target: "Doel",
    targetLose: "{kg} afvallen vóór {month}", targetGain: "{kg} aankomen vóór {month}", reachTitle: "Zo bereik je je doel", stepPhoto: "Maak een foto van elke maaltijd",
    stepKcal: "Blijf binnen {kcal} kcal per dag", stepBalance: "Breng eiwit, koolhydraten en vet in balans", stepWeigh: "Weeg jezelf één keer per week", howCalc: "Zo berekenen we je plan",
    yourGoal: "Je doel", loaderLose: "−{kg} vóór {month}", loaderGain: "+{kg} vóór {month}",
    basedOn: "Op basis van je antwoorden", satFatAsked: "Verzadigd vet · op jouw verzoek", satFatPerDay: "≤ {g} per dag",
    people: { one: "{n} persoon stelt een plan op met eait", other: "{n} mensen stellen hun plan op met eait" },
  },
  pl: {
    goalLine: "Cel: {kg} · orientacyjnie {month}", goalStay: "Cel: utrzymać około {kg}", goalRange: "Zakres: {range}",
    weightTitle: "Twoja waga", everyDay: "Każdego dnia", changeAnytime: "Możesz to zmienić w dowolnej chwili", infoTitle: "Twoje dane",
    satFat: "tł. nasycone", yourPlan: "Twój plan", youBurn: "Spalasz",
    building: "Układam twój plan", today: "Dziś",
    method: "Twój plan wychodzi od równania Mifflina–St Jeora, na podstawie twojego wieku, wzrostu, wagi, płci i aktywności. Każde nowe ważenie go przelicza.",
    methodSource: "Źródło: Mifflin et al., Am J Clin Nutr, 1990",
    goalLose: "Cel: −{kg} · orientacyjnie {month}", goalGain: "Cel: +{kg} · orientacyjnie {month}", startWeight: "Waga początkowa", goalWeight: "Waga docelowa", activity: "Aktywność", target: "Cel",
    targetLose: "−{kg} · orientacyjnie {month}", targetGain: "+{kg} · orientacyjnie {month}", reachTitle: "Jak dojść do celu", stepPhoto: "Fotografuj każdy posiłek",
    stepKcal: "Mieść się w {kcal} kcal dziennie", stepBalance: "Równoważ białko, węglowodany i tłuszcz", stepWeigh: "Waż się raz w tygodniu", howCalc: "Jak liczymy twój plan",
    yourGoal: "Twój cel", loaderLose: "−{kg} · orientacyjnie {month}", loaderGain: "+{kg} · orientacyjnie {month}",
    basedOn: "Na podstawie twoich odpowiedzi", satFatAsked: "Tłuszcze nasycone · na twoją prośbę", satFatPerDay: "≤ {g} dziennie",
    people: { one: "{n} osoba układa swój plan z eait", other: "Osoby układające plan z eait: {n}" },
  },
  tr: {
    goalLine: "Hedef: {kg}, {month} civarı", goalStay: "Hedef: {kg} civarında kalmak", goalRange: "Aralık: {range}",
    weightTitle: "Kilon", everyDay: "Her gün", changeAnytime: "Bunu istediğin zaman değiştirebilirsin", infoTitle: "Bilgilerin",
    satFat: "doymuş yağ", yourPlan: "Planın", youBurn: "Yaktığın",
    building: "Planın hazırlanıyor", today: "Bugün",
    method: "Planın; yaşın, boyun, kilon, cinsiyetin ve aktiviten kullanılarak Mifflin–St Jeor denkleminden başlar. Her yeni tartılma onu yeniden hesaplar.",
    methodSource: "Kaynak: Mifflin et al., Am J Clin Nutr, 1990",
    goalLose: "Hedef: {month} tarihine kadar {kg} vermek", goalGain: "Hedef: {month} tarihine kadar {kg} almak", startWeight: "Başlangıç kilosu", goalWeight: "Hedef kilo", activity: "Aktivite", target: "Hedef",
    targetLose: "{month} tarihine kadar {kg} vermek", targetGain: "{month} tarihine kadar {kg} almak", reachTitle: "Hedefine nasıl ulaşırsın", stepPhoto: "Her öğünün fotoğrafını çek",
    stepKcal: "Günde {kcal} kcal içinde kal", stepBalance: "Protein, karbonhidrat ve yağı dengele", stepWeigh: "Haftada bir tartıl", howCalc: "Planını nasıl hesaplıyoruz",
    yourGoal: "Hedefin", loaderLose: "−{kg} · {month}", loaderGain: "+{kg} · {month}",
    basedOn: "Yanıtlarına göre", satFatAsked: "Doymuş yağ · senin isteğin", satFatPerDay: "günde ≤ {g}",
    people: { one: "{n} kişi eait ile planını oluşturuyor", other: "{n} kişi eait ile planını oluşturuyor" },
  },
  "zh-Hant": {
    goalLine: "目標：{kg}，約在 {month}", goalStay: "目標：維持在 {kg} 左右", goalRange: "範圍：{range}",
    weightTitle: "你的體重", everyDay: "每天", changeAnytime: "你可以隨時更改", infoTitle: "你的資料",
    satFat: "飽和脂肪", yourPlan: "你的計畫", youBurn: "你消耗",
    building: "正在建立你的計畫", today: "今天",
    method: "你的計畫以 Mifflin–St Jeor 公式為基礎，使用你的年齡、身高、體重、性別和活動量。每次新的體重紀錄都會重新計算。",
    methodSource: "來源：Mifflin et al., Am J Clin Nutr, 1990",
    goalLose: "目標：{month}前減少 {kg}", goalGain: "目標：{month}前增加 {kg}", startWeight: "起始體重", goalWeight: "目標體重", activity: "活動量", target: "目標",
    targetLose: "{month}前減少 {kg}", targetGain: "{month}前增加 {kg}", reachTitle: "如何達成你的目標", stepPhoto: "每一餐都拍照",
    stepKcal: "每天不超過 {kcal} 大卡", stepBalance: "均衡攝取蛋白質、碳水和脂肪", stepWeigh: "每週量一次體重", howCalc: "我們如何計算你的計畫",
    yourGoal: "你的目標", loaderLose: "{month}前 −{kg}", loaderGain: "{month}前 +{kg}",
    basedOn: "根據你的回答", satFatAsked: "飽和脂肪 · 依你的要求", satFatPerDay: "每天 ≤ {g}",
    people: { one: "{n} 人正在用 eait 建立自己的計畫", other: "{n} 人正在用 eait 建立自己的計畫" },
  },
  "zh-Hans": {
    goalLine: "目标：{kg}，约在{month}", goalStay: "目标：保持在 {kg} 左右", goalRange: "范围：{range}",
    weightTitle: "你的体重", everyDay: "每天", changeAnytime: "你可以随时更改", infoTitle: "你的信息",
    satFat: "饱和脂肪", yourPlan: "你的计划", youBurn: "你的消耗",
    building: "正在制定你的计划", today: "今天",
    method: "你的计划以 Mifflin–St Jeor 公式为起点，用到你的年龄、身高、体重、性别和活动量。每次新的称重都会重新计算。",
    methodSource: "来源：Mifflin et al., Am J Clin Nutr, 1990",
    goalLose: "目标：减 {kg}，预计{month}", goalGain: "目标：增 {kg}，预计{month}", startWeight: "起始体重", goalWeight: "目标体重", activity: "活动量", target: "目标",
    targetLose: "减 {kg}，预计{month}", targetGain: "增 {kg}，预计{month}", reachTitle: "如何达成目标", stepPhoto: "每一餐都拍照",
    stepKcal: "每天控制在 {kcal}千卡以内", stepBalance: "平衡蛋白质、碳水和脂肪", stepWeigh: "每周称重一次", howCalc: "我们如何计算你的计划",
    yourGoal: "你的目标", loaderLose: "−{kg}，预计{month}", loaderGain: "+{kg}，预计{month}",
    basedOn: "基于你的回答", satFatAsked: "饱和脂肪 · 按你的要求", satFatPerDay: "每天 ≤ {g}",
    people: { one: "{n} 人正在用 eait 制定计划", other: "{n} 人正在用 eait 制定计划" },
  },
  ko: {
    goalLine: "목표: {kg}, {month}쯤", goalStay: "목표: {kg} 정도 유지", goalRange: "범위: {range}",
    weightTitle: "내 체중", everyDay: "매일", changeAnytime: "언제든 바꿀 수 있어요", infoTitle: "내 정보",
    satFat: "포화 지방", yourPlan: "내 플랜", youBurn: "소모 칼로리",
    building: "플랜을 만드는 중", today: "오늘",
    method: "플랜은 나이, 키, 체중, 성별, 활동량을 바탕으로 Mifflin–St Jeor 공식에서 시작해요. 체중을 새로 기록할 때마다 다시 계산돼요.",
    methodSource: "출처: Mifflin et al., Am J Clin Nutr, 1990",
    goalLose: "목표: {month}까지 {kg} 감량", goalGain: "목표: {month}까지 {kg} 증량", startWeight: "시작 체중", goalWeight: "목표 체중", activity: "활동량", target: "목표",
    targetLose: "{month}까지 {kg} 감량", targetGain: "{month}까지 {kg} 증량", reachTitle: "목표에 다가가는 방법", stepPhoto: "모든 식사 사진 찍기",
    stepKcal: "하루 {kcal}kcal 이내로 먹기", stepBalance: "단백질, 탄수화물, 지방 균형 맞추기", stepWeigh: "일주일에 한 번 체중 재기", howCalc: "플랜 계산 방식",
    yourGoal: "내 목표", loaderLose: "{month}까지 −{kg}", loaderGain: "{month}까지 +{kg}",
    basedOn: "내 답변을 바탕으로", satFatAsked: "포화 지방 · 요청한 항목", satFatPerDay: "하루 {g} 이하",
    people: { one: "{n}명이 eait에서 플랜을 만들고 있어요", other: "{n}명이 eait에서 플랜을 만들고 있어요" },
  },
  ja: {
    goalLine: "目標：{kg}、{month}ごろ", goalStay: "目標：{kg}前後をキープ", goalRange: "範囲：{range}",
    weightTitle: "あなたの体重", everyDay: "毎日", changeAnytime: "いつでも変更できます", infoTitle: "あなたの情報",
    satFat: "飽和脂肪酸", yourPlan: "あなたのプラン", youBurn: "消費カロリー",
    building: "プランを作成中", today: "今日",
    method: "プランは、年齢、身長、体重、性別、活動量をもとにMifflin–St Jeor式で算出します。体重を記録するたびに再計算されます。",
    methodSource: "出典：Mifflin et al., Am J Clin Nutr, 1990",
    goalLose: "目標：{month}までに{kg}減", goalGain: "目標：{month}までに{kg}増", startWeight: "開始時の体重", goalWeight: "目標体重", activity: "活動量", target: "目標",
    targetLose: "{month}までに{kg}減", targetGain: "{month}までに{kg}増", reachTitle: "目標達成のために", stepPhoto: "毎回の食事を撮影する",
    stepKcal: "1日{kcal}kcal以内に収める", stepBalance: "タンパク質、炭水化物、脂質のバランスをとる", stepWeigh: "週に1回体重を測る", howCalc: "プランの計算方法",
    yourGoal: "あなたの目標", loaderLose: "{month}までに−{kg}", loaderGain: "{month}までに+{kg}",
    basedOn: "あなたの回答にもとづいています", satFatAsked: "飽和脂肪酸 · ご希望により", satFatPerDay: "1日{g}以下",
    people: { one: "{n}人がeaitでプランを作成中です", other: "{n}人がeaitでプランを作成中です" },
  },
  "pt-BR": {
    goalLine: "Meta: {kg}, por volta de {month}", goalStay: "Meta: ficar em torno de {kg}", goalRange: "Faixa: {range}",
    weightTitle: "Seu peso", everyDay: "Todo dia", changeAnytime: "Você pode mudar isso quando quiser", infoTitle: "Seus dados",
    satFat: "gord. saturada", yourPlan: "Seu plano", youBurn: "Você queima",
    building: "Montando seu plano", today: "Hoje",
    method: "Seu plano parte da equação de Mifflin–St Jeor, usando sua idade, altura, peso, sexo e atividade. Cada nova pesagem o recalcula.",
    methodSource: "Fonte: Mifflin et al., Am J Clin Nutr, 1990",
    goalLose: "Meta: perder {kg} até {month}", goalGain: "Meta: ganhar {kg} até {month}", startWeight: "Peso inicial", goalWeight: "Peso-meta", activity: "Atividade", target: "Meta",
    targetLose: "perder {kg} até {month}", targetGain: "ganhar {kg} até {month}", reachTitle: "Como chegar à sua meta", stepPhoto: "Fotografe cada refeição",
    stepKcal: "Fique dentro de {kcal} kcal por dia", stepBalance: "Equilibre proteína, carboidratos e gordura", stepWeigh: "Pese-se uma vez por semana", howCalc: "Como calculamos seu plano",
    yourGoal: "Sua meta", loaderLose: "−{kg} até {month}", loaderGain: "+{kg} até {month}",
    basedOn: "Com base nas suas respostas", satFatAsked: "Gordura saturada · você pediu", satFatPerDay: "≤ {g} por dia",
    people: { one: "{n} pessoa está montando o plano com o eait", other: "{n} pessoas estão montando o plano com o eait" },
  },
};

export const planCopyFor = (lang: Lang): PlanCopy => t(lang)(PLAN_COPY);
