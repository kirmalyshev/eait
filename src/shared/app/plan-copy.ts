// The plan reveal's own words (#402); the rest is `summary.*` and `youCopyFor(lang).phone`, and `{kg}` arrives unit-formatted.

import { t, type Localized } from "../lang.ts";
import type { Lang } from "../types.ts";

export interface PlanCopy {
  /** The journey card's title. */
  goalLine: string;
  /** The maintain card's title. */
  goalStay: string;
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
}

export const PLAN_COPY: Localized<PlanCopy> = {
  en: {
    goalLine: "Goal: {kg}, around {month}", goalStay: "Goal: stay around {kg}",
    satFat: "sat fat", yourPlan: "Your plan", youBurn: "You burn",
    building: "Building your plan", today: "Today",
    method: "Your plan starts from the Mifflin–St Jeor equation, using your age, height, weight, sex and activity. Each new weigh-in recalculates it.",
    methodSource: "Source: Mifflin et al., Am J Clin Nutr, 1990",
  },
  fr: {
    goalLine: "Objectif : {kg}, vers {month}", goalStay: "Objectif : rester autour de {kg}",
    satFat: "graisses sat.", yourPlan: "Ton plan", youBurn: "Tu brûles",
    building: "Création de ton plan", today: "Aujourd’hui",
    method: "Ton plan part de l’équation de Mifflin–St Jeor, avec ton âge, ta taille, ton poids, ton sexe et ton activité. Chaque nouvelle pesée le recalcule.",
    methodSource: "Source : Mifflin et al., Am J Clin Nutr, 1990",
  },
  de: {
    goalLine: "Ziel: {kg}, etwa {month}", goalStay: "Ziel: bei etwa {kg} bleiben",
    satFat: "ges. Fett", yourPlan: "Dein Plan", youBurn: "Du verbrennst",
    building: "Dein Plan entsteht", today: "Heute",
    method: "Dein Plan beruht auf der Mifflin-St-Jeor-Formel, mit deinem Alter, deiner Größe, deinem Gewicht, Geschlecht und deiner Aktivität. Jedes neue Wiegen berechnet ihn neu.",
    methodSource: "Quelle: Mifflin et al., Am J Clin Nutr, 1990",
  },
  it: {
    goalLine: "Obiettivo: {kg}, intorno a {month}", goalStay: "Obiettivo: restare intorno a {kg}",
    satFat: "grassi sat.", yourPlan: "Il tuo piano", youBurn: "Bruci",
    building: "Creo il tuo piano", today: "Oggi",
    method: "Il tuo piano parte dall’equazione di Mifflin–St Jeor, con età, altezza, peso, sesso e attività. Ogni nuova pesata lo ricalcola.",
    methodSource: "Fonte: Mifflin et al., Am J Clin Nutr, 1990",
  },
  es: {
    goalLine: "Objetivo: {kg}, hacia {month}", goalStay: "Objetivo: mantenerte en torno a {kg}",
    satFat: "grasa sat.", yourPlan: "Tu plan", youBurn: "Quemas",
    building: "Creando tu plan", today: "Hoy",
    method: "Tu plan parte de la ecuación de Mifflin–St Jeor, con tu edad, altura, peso, sexo y actividad. Cada nuevo pesaje lo recalcula.",
    methodSource: "Fuente: Mifflin et al., Am J Clin Nutr, 1990",
  },
  vi: {
    goalLine: "Mục tiêu: {kg}, khoảng {month}", goalStay: "Mục tiêu: giữ quanh {kg}",
    satFat: "chất béo bão hòa", yourPlan: "Kế hoạch của bạn", youBurn: "Bạn tiêu hao",
    building: "Đang tạo kế hoạch", today: "Hôm nay",
    method: "Kế hoạch của bạn dựa trên công thức Mifflin–St Jeor, từ tuổi, chiều cao, cân nặng, giới tính và mức vận động của bạn. Mỗi lần cân mới, kế hoạch được tính lại.",
    methodSource: "Nguồn: Mifflin et al., Am J Clin Nutr, 1990",
  },
  id: {
    goalLine: "Target: {kg}, sekitar {month}", goalStay: "Target: tetap di sekitar {kg}",
    satFat: "lemak jenuh", yourPlan: "Rencanamu", youBurn: "Kamu membakar",
    building: "Menyusun rencanamu", today: "Hari ini",
    method: "Rencanamu dihitung dari rumus Mifflin–St Jeor, dengan usia, tinggi, berat, jenis kelamin, dan aktivitasmu. Setiap timbangan baru menghitungnya ulang.",
    methodSource: "Sumber: Mifflin et al., Am J Clin Nutr, 1990",
  },
  ru: {
    goalLine: "Цель: {kg} · ориентир — {month}", goalStay: "Цель: держаться около {kg}",
    satFat: "насыщ. жиры", yourPlan: "Твой план", youBurn: "Ты сжигаешь",
    building: "Составляю твой план", today: "Сегодня",
    method: "Твой план строится на формуле Миффлина — Сан Жеора: возраст, рост, вес, пол и активность. Каждое новое взвешивание пересчитывает его.",
    methodSource: "Источник: Mifflin et al., Am J Clin Nutr, 1990",
  },
};

export const planCopyFor = (lang: Lang): PlanCopy => t(lang)(PLAN_COPY);
