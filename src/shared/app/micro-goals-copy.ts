// The Nutrition goals page's words (ieat-app#914). BOARD: `parity_w3.rs` › `micros_page`. The
// macro names (Fibre, Sugar, Sodium) and the unit figures come from `home-copy.ts` — one spelling
// across Home and this page — so only the page's own sentences are here. `{v}` is a figure the
// caller already formatted with its unit ("25 g"), so the word order stays the language's.
//
// EVERY LANGUAGE, ALWAYS: a `Record<Lang, …>`, so `typecheck` names the language that lacks an
// entry — there is no English fallback to hide behind. en + ru are the board's words (Kirill's);
// the rest are drafts for the localizer pass (`~/eait-fleet/strings-914.md`).

import type { Lang } from "../types.ts";

export interface MicroGoalsCopy {
  title: string;
  label: string;
  atLeast: string;
  atMost: string;
  kidneyNote: string;
  foot: string;
}

export const MICRO_GOALS_COPY: Record<Lang, MicroGoalsCopy> = {
  en: {
    title: "Nutrition goals",
    label: "Micronutrients",
    atLeast: "at least {v}",
    atMost: "at most {v}",
    kidneyNote: "Your kidney restriction sets this. A goal can't raise it.",
    foot: "Shown on Home's second page. No verdict comes from these.",
  },
  fr: {
    title: "Objectifs nutritionnels",
    label: "Micronutriments",
    atLeast: "au moins {v}",
    atMost: "au plus {v}",
    kidneyNote: "Votre restriction rénale fixe cette valeur. Un objectif ne peut pas la dépasser.",
    foot: "Affiché sur la deuxième page d'Accueil. Aucun verdict n'en découle.",
  },
  de: {
    title: "Nährstoffziele",
    label: "Mikronährstoffe",
    atLeast: "mindestens {v}",
    atMost: "höchstens {v}",
    kidneyNote: "Deine Nierenbeschränkung legt diesen Wert fest. Ein Ziel kann ihn nicht erhöhen.",
    foot: "Wird auf der zweiten Seite von Start angezeigt. Daraus entsteht keine Bewertung.",
  },
  it: {
    title: "Obiettivi nutrizionali",
    label: "Micronutrienti",
    atLeast: "almeno {v}",
    atMost: "al massimo {v}",
    kidneyNote: "Questo valore è fissato dalla tua restrizione renale. Un obiettivo non può superarlo.",
    foot: "Mostrati nella seconda pagina di Home. Nessun giudizio deriva da questi valori.",
  },
  es: {
    title: "Objetivos de nutrición",
    label: "Micronutrientes",
    atLeast: "al menos {v}",
    atMost: "como máximo {v}",
    kidneyNote: "Tu restricción renal fija este valor. Un objetivo no puede superarlo.",
    foot: "Se muestra en la segunda página de Inicio. Estos valores no generan ninguna valoración.",
  },
  vi: {
    title: "Mục tiêu dinh dưỡng",
    label: "Vi chất dinh dưỡng",
    atLeast: "ít nhất {v}",
    atMost: "tối đa {v}",
    kidneyNote: "Hạn chế về thận của bạn quy định mức này. Mục tiêu không thể vượt quá mức đó.",
    foot: "Hiển thị ở trang thứ hai của Trang chủ. Các chỉ số này không tạo ra đánh giá nào.",
  },
  id: {
    title: "Target nutrisi",
    label: "Mikronutrien",
    atLeast: "minimal {v}",
    atMost: "maksimal {v}",
    kidneyNote: "Batasan ginjal Anda menentukan nilai ini. Target tidak bisa menaikkannya.",
    foot: "Ditampilkan di halaman kedua Beranda. Tidak ada penilaian dari angka ini.",
  },
  ru: {
    title: "Цели по питанию",
    label: "Микронутриенты",
    atLeast: "не менее {v}",
    atMost: "не более {v}",
    kidneyNote: "Это значение задаёт ограничение по почкам. Цель не может его превысить.",
    foot: "Показывается на второй странице «Главной». Оценок по ним нет.",
  },
  "pt-BR": {
    title: "Metas de nutrição",
    label: "Micronutrientes",
    atLeast: "no mínimo {v}",
    atMost: "no máximo {v}",
    kidneyNote: "Sua restrição renal define este valor. Uma meta não pode aumentá-lo.",
    foot: "Aparece na segunda página do Início. Nenhuma avaliação vem destes valores.",
  },
  ja: {
    title: "栄養目標",
    label: "微量栄養素",
    atLeast: "{v}以上",
    atMost: "{v}以下",
    kidneyNote: "腎臓の制限によりこの値が決まります。目標でこれを引き上げることはできません。",
    foot: "ホームの2ページ目に表示されます。これらから判定は出ません。",
  },
  ko: {
    title: "영양 목표",
    label: "미량 영양소",
    atLeast: "최소 {v}",
    atMost: "최대 {v}",
    kidneyNote: "신장 제한이 이 값을 정합니다. 목표로 이 값을 높일 수는 없습니다.",
    foot: "홈의 두 번째 페이지에 표시됩니다. 이 값으로 평가가 내려지지 않습니다.",
  },
  "zh-Hans": {
    title: "营养目标",
    label: "微量营养素",
    atLeast: "至少 {v}",
    atMost: "至多 {v}",
    kidneyNote: "此值由你的肾脏限制设定，目标不能将其调高。",
    foot: "显示在首页的第二页。这些数值不会产生任何评判。",
  },
  "zh-Hant": {
    title: "營養目標",
    label: "微量營養素",
    atLeast: "至少 {v}",
    atMost: "至多 {v}",
    kidneyNote: "此數值由你的腎臟限制設定，目標無法將其調高。",
    foot: "顯示於首頁的第二頁。這些數值不會產生任何評判。",
  },
  tr: {
    title: "Beslenme hedefleri",
    label: "Mikro besinler",
    atLeast: "en az {v}",
    atMost: "en fazla {v}",
    kidneyNote: "Bu değeri böbrek kısıtlamanız belirler. Bir hedef onu yükseltemez.",
    foot: "Ana Sayfa'nın ikinci sayfasında gösterilir. Bunlardan bir değerlendirme çıkmaz.",
  },
  pl: {
    title: "Cele żywieniowe",
    label: "Mikroskładniki",
    atLeast: "co najmniej {v}",
    atMost: "najwyżej {v}",
    kidneyNote: "Tę wartość ustala Twoje ograniczenie dotyczące nerek. Cel nie może jej podnieść.",
    foot: "Widoczne na drugiej stronie ekranu Start. Nie wynika z nich żadna ocena.",
  },
  nl: {
    title: "Voedingsdoelen",
    label: "Micronutriënten",
    atLeast: "minstens {v}",
    atMost: "hooguit {v}",
    kidneyNote: "Je nierbeperking bepaalt deze waarde. Een doel kan hem niet verhogen.",
    foot: "Te zien op de tweede pagina van Home. Hieruit volgt geen oordeel.",
  },
};

export const microGoalsCopyFor = (lang: Lang): MicroGoalsCopy => MICRO_GOALS_COPY[lang];
