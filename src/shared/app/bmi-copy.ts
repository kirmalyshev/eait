// The BMI card's words (#118's card, drawn on Progress's board #95) — its label, the one line of
// method under the "?", and the four band labels.
//
// Their own table, not a section of `scores-copy.ts`: that table reads `verdictNoun`, which is
// Lingui, and a Lingui edge in the graph is a word the browser bundle cannot carry
// (`frontend/test/imports.ts` fails the reach, by name). Everything here imports only `lang.ts`,
// so both halves — the web's Progress and the server-side score surfaces — read the one wording.

import { numbers, t, type Localized } from "../lang.ts";
import type { BmiRange } from "../scores.ts";
import type { Lang } from "../types.ts";

export interface BmiCopy {
  /** The card's label — the acronym, spelled the way the language spells it. */
  bmi: string;
  /** The one line explaining BMI. */
  bmiExplainer: string;
  /**
   * Range templates — `{n}` / `{low}`/`{high}` are the band's own bounds, formatted by `numbers`.
   * THE RANGE LABELS ARE NUMBERS, NEVER WORDS: a band is "below 18.5" / "18.5–24.9" /
   * "25–29.9" / "30 and above", never "underweight"/"normal"/"overweight" — the classification
   * words are the medical claim the design board ruled out.
   */
  bmiBelow: string;
  bmiBetween: string;
  bmiAbove: string;
}

export const BMI_COPY: Localized<BmiCopy> = {
  en: {
    bmi: "BMI",
    bmiExplainer: "Weight in kg divided by height in metres, squared.",
    bmiBelow: "below {n}",
    bmiBetween: "{low}–{high}",
    bmiAbove: "{n} and above",
  },
  fr: {
    bmi: "IMC",
    bmiExplainer: "Poids en kg divisé par la taille en mètres, au carré.",
    bmiBelow: "moins de {n}",
    bmiBetween: "{low}–{high}",
    bmiAbove: "{n} et plus",
  },
  de: {
    bmi: "BMI",
    bmiExplainer: "Gewicht in kg geteilt durch die Körpergröße in Metern zum Quadrat.",
    bmiBelow: "unter {n}",
    bmiBetween: "{low}–{high}",
    bmiAbove: "{n} und mehr",
  },
  it: {
    bmi: "IMC",
    bmiExplainer: "Peso in kg diviso per l'altezza in metri, al quadrato.",
    bmiBelow: "sotto {n}",
    bmiBetween: "{low}–{high}",
    bmiAbove: "{n} e oltre",
  },
  es: {
    bmi: "IMC",
    bmiExplainer: "Peso en kg dividido por la altura en metros, al cuadrado.",
    bmiBelow: "por debajo de {n}",
    bmiBetween: "{low}–{high}",
    bmiAbove: "{n} y más",
  },
  vi: {
    bmi: "BMI",
    bmiExplainer: "Cân nặng tính bằng kg chia cho chiều cao tính bằng mét, bình phương.",
    bmiBelow: "dưới {n}",
    bmiBetween: "{low}–{high}",
    bmiAbove: "từ {n} trở lên",
  },
  id: {
    bmi: "IMT",
    bmiExplainer: "Berat badan dalam kg dibagi tinggi badan dalam meter, dikuadratkan.",
    bmiBelow: "di bawah {n}",
    bmiBetween: "{low}–{high}",
    bmiAbove: "{n} ke atas",
  },
  ru: {
    bmi: "ИМТ",
    bmiExplainer: "Вес в кг, делённый на рост в метрах в квадрате.",
    bmiBelow: "ниже {n}",
    bmiBetween: "{low}–{high}",
    bmiAbove: "{n} и выше",
  },
  te: {
    bmi: "BMI",
    bmiExplainer: "kgలో బరువును, మీటర్లలో ఎత్తు వర్గంతో భాగించగా వచ్చేది.",
    bmiBelow: "{n} కంటే తక్కువ",
    bmiBetween: "{low}–{high}",
    bmiAbove: "{n}, అంతకంటే ఎక్కువ",
  },
  ta: {
    bmi: "BMI",
    bmiExplainer: "kg-இல் எடையை, மீட்டரில் உயரத்தின் வர்க்கத்தால் வகுத்தது.",
    bmiBelow: "{n}-க்குக் கீழ்",
    bmiBetween: "{low}–{high}",
    bmiAbove: "{n} மற்றும் அதற்கு மேல்",
  },
  pa: {
    bmi: "BMI",
    bmiExplainer: "kg ਵਿੱਚ ਭਾਰ, ਮੀਟਰ ਵਿੱਚ ਕੱਦ ਦੇ ਵਰਗ ਨਾਲ ਭਾਗ।",
    bmiBelow: "{n} ਤੋਂ ਘੱਟ",
    bmiBetween: "{low}–{high}",
    bmiAbove: "{n} ਅਤੇ ਇਸ ਤੋਂ ਵੱਧ",
  },
  or: {
    bmi: "BMI",
    bmiExplainer: "kg ରେ ଓଜନକୁ ମିଟରରେ ଉଚ୍ଚତାର ବର୍ଗ ଦ୍ୱାରା ଭାଗ।",
    bmiBelow: "{n} ରୁ କମ୍",
    bmiBetween: "{low}–{high}",
    bmiAbove: "{n} ଓ ତାହାଠାରୁ ଅଧିକ",
  },
  mr: {
    bmi: "BMI",
    bmiExplainer: "kg मधील वजन भागिले मीटरमधील उंचीचा वर्ग.",
    bmiBelow: "{n} पेक्षा कमी",
    bmiBetween: "{low}–{high}",
    bmiAbove: "{n} आणि त्याहून जास्त",
  },
  ml: {
    bmi: "BMI",
    bmiExplainer: "kg-ലെ ഭാരത്തെ മീറ്ററിലെ ഉയരത്തിന്റെ വർഗം കൊണ്ട് ഹരിച്ചത്.",
    bmiBelow: "{n} എന്നതിൽ താഴെ",
    bmiBetween: "{low}–{high}",
    bmiAbove: "{n} അല്ലെങ്കിൽ അതിനു മുകളിൽ",
  },
  kn: {
    bmi: "BMI",
    bmiExplainer: "kg ನಲ್ಲಿನ ತೂಕವನ್ನು ಮೀಟರ್‌ಗಳಲ್ಲಿನ ಎತ್ತರದ ವರ್ಗದಿಂದ ಭಾಗಿಸಿದ್ದು.",
    bmiBelow: "{n} ಕ್ಕಿಂತ ಕಡಿಮೆ",
    bmiBetween: "{low}–{high}",
    bmiAbove: "{n} ಮತ್ತು ಹೆಚ್ಚು",
  },
  gu: {
    bmi: "BMI",
    bmiExplainer: "kg માં વજનને મીટરમાં ઊંચાઈના વર્ગ વડે ભાગ્યું.",
    bmiBelow: "{n} થી ઓછું",
    bmiBetween: "{low}–{high}",
    bmiAbove: "{n} અને તેથી વધુ",
  },
  bn: {
    bmi: "BMI",
    bmiExplainer: "kg-তে ওজনকে মিটারে উচ্চতার বর্গ দিয়ে ভাগ।",
    bmiBelow: "{n}-এর নিচে",
    bmiBetween: "{low}–{high}",
    bmiAbove: "{n} ও তার বেশি",
  },
  "pt-PT": {
    bmi: "IMC",
    bmiExplainer: "Peso em kg dividido pela altura em metros ao quadrado.",
    bmiBelow: "abaixo de {n}",
    bmiBetween: "{low}–{high}",
    bmiAbove: "{n} ou mais",
  },
  ms: {
    bmi: "BMI",
    bmiExplainer: "Berat dalam kg dibahagi dengan kuasa dua ketinggian dalam meter.",
    bmiBelow: "bawah {n}",
    bmiBetween: "{low}–{high}",
    bmiAbove: "{n} dan ke atas",
  },
  ca: {
    bmi: "IMC",
    bmiExplainer: "El pes en kg dividit per l'alçada en metres al quadrat.",
    bmiBelow: "menys de {n}",
    bmiBetween: "{low}–{high}",
    bmiAbove: "{n} o més",
  },
  sl: {
    bmi: "ITM",
    bmiExplainer: "Teža v kg, deljena s kvadratom višine v metrih.",
    bmiBelow: "pod {n}",
    bmiBetween: "{low}–{high}",
    bmiAbove: "{n} in več",
  },
  hr: {
    bmi: "BMI",
    bmiExplainer: "Težina u kg podijeljena s kvadratom visine u metrima.",
    bmiBelow: "ispod {n}",
    bmiBetween: "{low}–{high}",
    bmiAbove: "{n} i više",
  },
  sk: {
    bmi: "BMI",
    bmiExplainer: "Váha v kg delená druhou mocninou výšky v metroch.",
    bmiBelow: "pod {n}",
    bmiBetween: "{low}–{high}",
    bmiAbove: "{n} a viac",
  },
  no: {
    bmi: "KMI",
    bmiExplainer: "Vekt i kg delt på høyden i meter i andre.",
    bmiBelow: "under {n}",
    bmiBetween: "{low}–{high}",
    bmiAbove: "{n} og over",
  },
  fi: {
    bmi: "BMI",
    bmiExplainer: "Paino kilogrammoina jaettuna pituuden neliöllä metreinä.",
    bmiBelow: "alle {n}",
    bmiBetween: "{low}–{high}",
    bmiAbove: "{n} ja yli",
  },
  da: {
    bmi: "BMI",
    bmiExplainer: "Vægt i kg divideret med højden i meter i anden.",
    bmiBelow: "under {n}",
    bmiBetween: "{low}–{high}",
    bmiAbove: "{n} og derover",
  },
  hu: {
    bmi: "BMI",
    bmiExplainer: "A testsúly kg-ban osztva a testmagasság méterben vett négyzetével.",
    bmiBelow: "{n} alatt",
    bmiBetween: "{low}–{high}",
    bmiAbove: "{n} és felette",
  },
  el: {
    bmi: "ΔΜΣ",
    bmiExplainer: "Βάρος σε kg διά το ύψος σε μέτρα στο τετράγωνο.",
    bmiBelow: "κάτω από {n}",
    bmiBetween: "{low}–{high}",
    bmiAbove: "{n} και πάνω",
  },
  ro: {
    bmi: "IMC",
    bmiExplainer: "Greutatea în kg împărțită la pătratul înălțimii în metri.",
    bmiBelow: "sub {n}",
    bmiBetween: "{low}–{high}",
    bmiAbove: "{n} și peste",
  },
  cs: {
    bmi: "BMI",
    bmiExplainer: "Váha v kg vydělená druhou mocninou výšky v metrech.",
    bmiBelow: "pod {n}",
    bmiBetween: "{low}–{high}",
    bmiAbove: "{n} a víc",
  },
  hi: {
    bmi: "BMI",
    bmiExplainer: "kg में वज़न, मीटर में लंबाई के वर्ग से भाग।",
    bmiBelow: "{n} से कम",
    bmiBetween: "{low}–{high}",
    bmiAbove: "{n} और उससे ज़्यादा",
  },
  th: {
    bmi: "BMI",
    bmiExplainer: "น้ำหนักเป็นกิโลกรัม หารด้วยส่วนสูงเป็นเมตรยกกำลังสอง",
    bmiBelow: "ต่ำกว่า {n}",
    bmiBetween: "{low}–{high}",
    bmiAbove: "{n} ขึ้นไป",
  },
  sv: {
    bmi: "BMI",
    bmiExplainer: "Vikt i kg delad med längd i meter i kvadrat.",
    bmiBelow: "under {n}",
    bmiBetween: "{low}–{high}",
    bmiAbove: "{n} och över",
  },
  uk: {
    bmi: "ІМТ",
    bmiExplainer: "Вага в кг, поділена на квадрат зросту в метрах.",
    bmiBelow: "нижче {n}",
    bmiBetween: "{low}–{high}",
    bmiAbove: "{n} і вище",
  },
  nl: {
    bmi: "BMI",
    bmiExplainer: "Gewicht in kg gedeeld door lengte in meters, in het kwadraat.",
    bmiBelow: "onder {n}",
    bmiBetween: "{low}–{high}",
    bmiAbove: "{n} en hoger",
  },
  pl: {
    bmi: "BMI",
    bmiExplainer: "Waga w kg podzielona przez kwadrat wzrostu w metrach.",
    bmiBelow: "poniżej {n}",
    bmiBetween: "{low}–{high}",
    bmiAbove: "{n} i więcej",
  },
  tr: {
    bmi: "VKİ",
    bmiExplainer: "Kilogram cinsinden kilonun, metre cinsinden boyunun karesine bölümü.",
    bmiBelow: "{n} altı",
    bmiBetween: "{low}–{high}",
    bmiAbove: "{n} ve üzeri",
  },
  "zh-Hant": {
    bmi: "BMI",
    bmiExplainer: "體重（公斤）除以身高（公尺）的平方。",
    bmiBelow: "低於 {n}",
    bmiBetween: "{low}–{high}",
    bmiAbove: "{n} 以上",
  },
  "zh-Hans": {
    bmi: "BMI",
    bmiExplainer: "体重（公斤）除以身高（米）的平方。",
    bmiBelow: "低于 {n}",
    bmiBetween: "{low}–{high}",
    bmiAbove: "{n} 及以上",
  },
  ko: {
    bmi: "BMI",
    bmiExplainer: "체중(kg)을 키(m)의 제곱으로 나눈 값이에요.",
    bmiBelow: "{n} 미만",
    bmiBetween: "{low}–{high}",
    bmiAbove: "{n} 이상",
  },
  ja: {
    bmi: "BMI",
    bmiExplainer: "体重（kg）を身長（m）の2乗で割った値です。",
    bmiBelow: "{n}未満",
    bmiBetween: "{low}–{high}",
    bmiAbove: "{n}以上",
  },
  "pt-BR": {
    bmi: "IMC",
    bmiExplainer: "Peso em kg dividido pela altura em metros ao quadrado.",
    bmiBelow: "abaixo de {n}",
    bmiBetween: "{low}–{high}",
    bmiAbove: "{n} ou mais",
  },
};

export const bmiCopy = (lang: Lang): BmiCopy => t(lang)(BMI_COPY);

/**
 * A BMI range as its own numbers — "below 18.5", "18.5–24.9", "30 and above". The bounds are read
 * out of the range ID ITSELF, so the label and the boundary `bmiRange` tests can never disagree,
 * and `numbers(lang)` moves the decimal separator with the language.
 */
export function bmiRangeLabel(range: BmiRange, lang: Lang): string {
  const copy = t(lang)(BMI_COPY);
  const n = numbers(lang);
  if (range.startsWith("below-")) return copy.bmiBelow.replace("{n}", n(Number(range.slice(6))));
  if (range.endsWith("-plus")) return copy.bmiAbove.replace("{n}", n(Number(range.slice(0, -5))));
  const [lo, hi] = range.split("-") as [string, string];
  return copy.bmiBetween.replace("{low}", n(Number(lo))).replace("{high}", n(Number(hi)));
}
