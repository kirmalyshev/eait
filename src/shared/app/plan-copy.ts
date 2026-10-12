// The plan reveal's own words (#402); the rest is `summary.*` and `youCopyFor(lang).phone`, and `{kg}` arrives unit-formatted.

import { t, type Localized } from "../lang.ts";
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
  },
};

export const planCopyFor = (lang: Lang): PlanCopy => t(lang)(PLAN_COPY);
