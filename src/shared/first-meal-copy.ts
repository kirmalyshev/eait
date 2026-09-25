// The free meal's sentences (v5, #42): the one meal on us after the plan, its verdict, and the ask
// after it. ONE SOURCE, read two ways: the phone through `chatCopyFor(lang).firstMeal`, which IS
// this table's entry, and the browser by importing this module by path. It lives apart from the
// eight-language chat table because a module the browser imports ships whole — that table is
// ~100 KB of a web bundle for seven sentences. So this file imports types and nothing else, and a
// test in `first-meal-copy.test.ts` holds it to that.

import type { Lang } from "./types.ts";

export interface FirstMealCopy {
  /** Spud's question, and the beat before it. */
  ask: string;
  react: string;
  /** The phone's camera button. The browser uploads instead and words its own button. */
  photo: string;
  tell: string;
  /** The first verdict's two actions. */
  keepGoing: string;
  correct: string;
  /** The line over the offer that holds. */
  afterAsk: string;
}

export const FIRST_MEAL_COPY: Record<Lang, FirstMealCopy> = {
  en: {
    ask: "One meal on me. Photo, or just tell me?",
    react: "No problem. Try me first",
    photo: "Take a photo",
    tell: "Tell Spud what you ate",
    keepGoing: "Keep going",
    correct: "Correct meal",
    afterAsk: "That was one. Want this for every meal?",
  },
  fr: {
    ask: "Un repas offert. Une photo, ou tu me racontes ?",
    react: "Pas de souci. Essaie-moi d'abord",
    photo: "Prendre une photo",
    tell: "Raconter ton repas à Spud",
    keepGoing: "Continuer",
    correct: "Corriger le repas",
    afterAsk: "Ça, c'était un repas. Tu veux ça pour chaque repas ?",
  },
  de: {
    ask: "Eine Mahlzeit geht auf mich. Foto, oder erzählst du's mir?",
    react: "Kein Problem. Probier mich erst aus",
    photo: "Foto machen",
    tell: "Spud erzählen, was du gegessen hast",
    keepGoing: "Weiter",
    correct: "Mahlzeit korrigieren",
    afterAsk: "Das war eine. Willst du das für jede Mahlzeit?",
  },
  it: {
    ask: "Un pasto lo offro io. Foto, o me lo racconti?",
    react: "Nessun problema. Prima provami",
    photo: "Scatta una foto",
    tell: "Racconta a Spud cosa hai mangiato",
    keepGoing: "Avanti",
    correct: "Correggi il pasto",
    afterAsk: "Questo era uno. Lo vuoi per ogni pasto?",
  },
  es: {
    ask: "Una comida la invito yo. ¿Foto, o me lo cuentas?",
    react: "Sin problema. Pruébame primero",
    photo: "Hacer una foto",
    tell: "Contarle a Spud qué comiste",
    keepGoing: "Seguir",
    correct: "Corregir la comida",
    afterAsk: "Esa fue una. ¿La quieres para cada comida?",
  },
  vi: {
    ask: "Một bữa mình mời. Chụp ảnh, hay kể cho mình nghe?",
    react: "Không sao. Cứ thử mình trước",
    photo: "Chụp ảnh",
    tell: "Kể cho Spud bạn đã ăn gì",
    keepGoing: "Tiếp tục",
    correct: "Sửa bữa ăn",
    afterAsk: "Vừa rồi là một bữa. Muốn vậy cho mọi bữa không?",
  },
  id: {
    ask: "Satu makanan aku yang traktir. Foto, atau ceritakan saja?",
    react: "Tidak apa-apa. Coba aku dulu",
    photo: "Ambil foto",
    tell: "Ceritakan ke Spud apa yang kamu makan",
    keepGoing: "Lanjut",
    correct: "Koreksi makanan",
    afterAsk: "Itu satu. Mau begini untuk setiap makanan?",
  },
  ru: {
    ask: "Один приём пищи — за мой счёт. Фото или просто расскажешь?",
    react: "Без проблем. Сначала попробуй меня",
    photo: "Сделать фото",
    tell: "Рассказать Spud, что было на тарелке",
    keepGoing: "Дальше",
    correct: "Исправить",
    afterAsk: "Это был один. Хочешь так для каждого приёма пищи?",
  },
};
