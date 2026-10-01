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
}

export const PLAN_COPY: Localized<PlanCopy> = {
  en: {
    goalLine: "Goal: {kg}, around {month}", goalStay: "Goal: stay around {kg}",
    satFat: "sat fat", yourPlan: "Your plan", youBurn: "You burn",
    building: "Building your plan", today: "Today",
  },
  fr: {
    goalLine: "Objectif : {kg}, vers {month}", goalStay: "Objectif : rester autour de {kg}",
    satFat: "gr. saturées", yourPlan: "Ton plan", youBurn: "Tu brûles",
    building: "Création de ton plan", today: "Aujourd’hui",
  },
  de: {
    goalLine: "Ziel: {kg}, etwa {month}", goalStay: "Ziel: bei etwa {kg} bleiben",
    satFat: "ges. Fett", yourPlan: "Dein Plan", youBurn: "Du verbrennst",
    building: "Dein Plan entsteht", today: "Heute",
  },
  it: {
    goalLine: "Obiettivo: {kg}, verso {month}", goalStay: "Obiettivo: restare intorno a {kg}",
    satFat: "grassi sat.", yourPlan: "Il tuo piano", youBurn: "Bruci",
    building: "Creo il tuo piano", today: "Oggi",
  },
  es: {
    goalLine: "Meta: {kg}, hacia {month}", goalStay: "Meta: mantenerte en torno a {kg}",
    satFat: "grasa sat.", yourPlan: "Tu plan", youBurn: "Quemas",
    building: "Creando tu plan", today: "Hoy",
  },
  vi: {
    goalLine: "Mục tiêu: {kg}, khoảng {month}", goalStay: "Mục tiêu: giữ quanh {kg}",
    satFat: "béo bão hòa", yourPlan: "Kế hoạch của bạn", youBurn: "Bạn đốt",
    building: "Đang tạo kế hoạch", today: "Hôm nay",
  },
  id: {
    goalLine: "Target: {kg}, sekitar {month}", goalStay: "Target: tetap di sekitar {kg}",
    satFat: "lemak jenuh", yourPlan: "Rencanamu", youBurn: "Kamu membakar",
    building: "Menyusun rencanamu", today: "Hari ini",
  },
  ru: {
    goalLine: "Цель: {kg}, примерно {month}", goalStay: "Цель: держаться около {kg}",
    satFat: "насыщ. жиры", yourPlan: "Твой план", youBurn: "Ты сжигаешь",
    building: "Составляю твой план", today: "Сегодня",
  },
};

export const planCopyFor = (lang: Lang): PlanCopy => t(lang)(PLAN_COPY);
