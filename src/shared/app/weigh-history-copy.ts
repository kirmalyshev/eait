// The weigh-in history's words (ieat-app#891): the Weight changes card and the "All weigh-ins"
// list, per `product/design/gen/src/boards/parity_w3.rs` §#891 on ieat-app main. The figures are
// numbers the client formats ({n} through `decimalNumbers`); "Delete" and "Log weight" are the
// existing `chat-copy` / `you-copy` words, not repeated here.
//
// A table of its own, over every language. `en` and `ru` are the approved copy; the other languages are the localizer pass
// (`~/eait-fleet/loc-891-{a,b}.md`). A language must not be missing: the typecheck names the one that is.

import { t } from "../lang.ts";
import type { Lang } from "../types.ts";
import type { UnitSystem } from "../ui/units.ts";

export interface WeighHistoryCopy {
  changesTitle: string;
  /** The row labels: 3, 7, 14, 30 and 90 days, and everything since the first weigh-in. */
  change3: string;
  change7: string;
  change14: string;
  change30: string;
  change90: string;
  changeAll: string;
  /** The list's title, and the link to it under the weight card. */
  historyTitle: string;
  sourceHealth: string;
  sourceYou: string;
  historyEmptyTitle: string;
  historyEmptyNote: string;
  /** A weight with its unit word, `{n}` already formatted (signed for a change). */
  rowWeight: Record<UnitSystem, string>;
}

const EN: WeighHistoryCopy = {
  changesTitle: "Weight changes",
  change3: "3 days", change7: "7 days", change14: "14 days", change30: "30 days", change90: "90 days", changeAll: "All",
  historyTitle: "All weigh-ins",
  sourceHealth: "From Apple Health",
  sourceYou: "You",
  historyEmptyTitle: "No weigh-ins yet",
  historyEmptyNote: "Apple Health's weigh-ins show here too.",
  rowWeight: { metric: "{n} kg", imperial: "{n} lb" },
};

const RU: WeighHistoryCopy = {
  changesTitle: "Изменение веса",
  change3: "3 дня", change7: "7 дней", change14: "14 дней", change30: "30 дней", change90: "90 дней", changeAll: "Всё время",
  historyTitle: "Все взвешивания",
  sourceHealth: "Из «Здоровья»",
  sourceYou: "Ты",
  historyEmptyTitle: "Пока нет взвешиваний",
  historyEmptyNote: "Взвешивания из «Здоровья» тоже появятся здесь.",
  rowWeight: { metric: "{n} кг", imperial: "{n} фунт." },
};

const DE: WeighHistoryCopy = {
  changesTitle: "Gewichtsveränderung",
  change3: "3 Tage", change7: "7 Tage", change14: "14 Tage", change30: "30 Tage", change90: "90 Tage", changeAll: "Gesamt",
  historyTitle: "Alle Gewichtseinträge",
  sourceHealth: "Aus der Health-App",
  sourceYou: "Du",
  historyEmptyTitle: "Noch keine Gewichtseinträge",
  historyEmptyNote: "Gewichtseinträge aus der Health-App erscheinen auch hier.",
  rowWeight: { metric: "{n} kg", imperial: "{n} lb" },
};

const FR: WeighHistoryCopy = {
  changesTitle: "Évolution du poids",
  change3: "3 jours", change7: "7 jours", change14: "14 jours", change30: "30 jours", change90: "90 jours", changeAll: "Depuis le début",
  historyTitle: "Toutes les pesées",
  sourceHealth: "Depuis l'app Santé",
  sourceYou: "Toi",
  historyEmptyTitle: "Aucune pesée pour l'instant",
  historyEmptyNote: "Les pesées de l'app Santé s'affichent aussi ici.",
  rowWeight: { metric: "{n} kg", imperial: "{n} lb" },
};

const IT: WeighHistoryCopy = {
  changesTitle: "Variazioni di peso",
  change3: "3 giorni", change7: "7 giorni", change14: "14 giorni", change30: "30 giorni", change90: "90 giorni", changeAll: "Da sempre",
  historyTitle: "Tutte le pesate",
  sourceHealth: "Dall'app Salute",
  sourceYou: "Tu",
  historyEmptyTitle: "Ancora nessuna pesata",
  historyEmptyNote: "Qui compaiono anche le pesate dell'app Salute.",
  rowWeight: { metric: "{n} kg", imperial: "{n} lb" },
};

const ES: WeighHistoryCopy = {
  changesTitle: "Cambios de peso",
  change3: "3 días", change7: "7 días", change14: "14 días", change30: "30 días", change90: "90 días", changeAll: "Desde el inicio",
  historyTitle: "Todos los pesajes",
  sourceHealth: "De la app Salud",
  sourceYou: "Tú",
  historyEmptyTitle: "Aún no hay pesajes",
  historyEmptyNote: "Los pesajes de la app Salud también aparecen aquí.",
  rowWeight: { metric: "{n} kg", imperial: "{n} lb" },
};

const PT_BR: WeighHistoryCopy = {
  changesTitle: "Variação de peso",
  change3: "3 dias", change7: "7 dias", change14: "14 dias", change30: "30 dias", change90: "90 dias", changeAll: "Desde o início",
  historyTitle: "Todas as pesagens",
  sourceHealth: "Do app Saúde",
  sourceYou: "Você",
  historyEmptyTitle: "Nenhuma pesagem ainda",
  historyEmptyNote: "As pesagens do app Saúde também aparecem aqui.",
  rowWeight: { metric: "{n} kg", imperial: "{n} lb" },
};

const PT_PT: WeighHistoryCopy = {
  changesTitle: "Variação de peso",
  change3: "3 dias", change7: "7 dias", change14: "14 dias", change30: "30 dias", change90: "90 dias", changeAll: "Desde o início",
  historyTitle: "Todas as pesagens",
  sourceHealth: "Da app Saúde",
  sourceYou: "Tu",
  historyEmptyTitle: "Ainda sem pesagens",
  historyEmptyNote: "As pesagens da app Saúde também aparecem aqui.",
  rowWeight: { metric: "{n} kg", imperial: "{n} lb" },
};

const NL: WeighHistoryCopy = {
  changesTitle: "Gewichtsverandering",
  change3: "3 dagen", change7: "7 dagen", change14: "14 dagen", change30: "30 dagen", change90: "90 dagen", changeAll: "Sinds het begin",
  historyTitle: "Alle wegingen",
  sourceHealth: "Uit de Gezondheid-app",
  sourceYou: "Jij",
  historyEmptyTitle: "Nog geen wegingen",
  historyEmptyNote: "Wegingen uit de Gezondheid-app verschijnen hier ook.",
  rowWeight: { metric: "{n} kg", imperial: "{n} lb" },
};

const CA: WeighHistoryCopy = {
  changesTitle: "Canvis de pes",
  change3: "3 dies", change7: "7 dies", change14: "14 dies", change30: "30 dies", change90: "90 dies", changeAll: "Des del principi",
  historyTitle: "Totes les pesades",
  sourceHealth: "De l'app Salut",
  sourceYou: "Tu",
  historyEmptyTitle: "Encara no hi ha pesades",
  historyEmptyNote: "Les pesades de l'app Salut també apareixen aquí.",
  rowWeight: { metric: "{n} kg", imperial: "{n} lb" },
};

const RO: WeighHistoryCopy = {
  changesTitle: "Variația greutății",
  change3: "3 zile", change7: "7 zile", change14: "14 zile", change30: "30 de zile", change90: "90 de zile", changeAll: "De la început",
  historyTitle: "Toate cântăririle",
  sourceHealth: "Din aplicația Sănătate",
  sourceYou: "Tu",
  historyEmptyTitle: "Încă nu ai cântăriri",
  historyEmptyNote: "Cântăririle din aplicația Sănătate apar și aici.",
  rowWeight: { metric: "{n} kg", imperial: "{n} lb" },
};

const PL: WeighHistoryCopy = {
  changesTitle: "Zmiany wagi",
  change3: "3 dni", change7: "7 dni", change14: "14 dni", change30: "30 dni", change90: "90 dni", changeAll: "Od początku",
  historyTitle: "Wszystkie ważenia",
  sourceHealth: "Z aplikacji Zdrowie",
  sourceYou: "Ty",
  historyEmptyTitle: "Brak ważeń",
  historyEmptyNote: "Tu pojawią się też ważenia z aplikacji Zdrowie.",
  rowWeight: { metric: "{n} kg", imperial: "{n} lb" },
};

const CS: WeighHistoryCopy = {
  changesTitle: "Změny hmotnosti",
  change3: "3 dny", change7: "7 dní", change14: "14 dní", change30: "30 dní", change90: "90 dní", changeAll: "Od začátku",
  historyTitle: "Všechna vážení",
  sourceHealth: "Z aplikace Zdraví",
  sourceYou: "Ty",
  historyEmptyTitle: "Zatím žádná vážení",
  historyEmptyNote: "Vážení z aplikace Zdraví se zobrazí i tady.",
  rowWeight: { metric: "{n} kg", imperial: "{n} lb" },
};

const SK: WeighHistoryCopy = {
  changesTitle: "Zmeny hmotnosti",
  change3: "3 dni", change7: "7 dní", change14: "14 dní", change30: "30 dní", change90: "90 dní", changeAll: "Od začiatku",
  historyTitle: "Všetky váženia",
  sourceHealth: "Z aplikácie Zdravie",
  sourceYou: "Ty",
  historyEmptyTitle: "Zatiaľ žiadne váženia",
  historyEmptyNote: "Váženia z aplikácie Zdravie sa zobrazia aj tu.",
  rowWeight: { metric: "{n} kg", imperial: "{n} lb" },
};

const SL: WeighHistoryCopy = {
  changesTitle: "Spremembe teže",
  change3: "3 dnevi", change7: "7 dni", change14: "14 dni", change30: "30 dni", change90: "90 dni", changeAll: "Od začetka",
  historyTitle: "Vsa tehtanja",
  sourceHealth: "Iz aplikacije Zdravje",
  sourceYou: "Ti",
  historyEmptyTitle: "Še ni tehtanj",
  historyEmptyNote: "Tehtanja iz aplikacije Zdravje se prikažejo tudi tukaj.",
  rowWeight: { metric: "{n} kg", imperial: "{n} lb" },
};

const HR: WeighHistoryCopy = {
  changesTitle: "Promjene težine",
  change3: "3 dana", change7: "7 dana", change14: "14 dana", change30: "30 dana", change90: "90 dana", changeAll: "Od početka",
  historyTitle: "Sva vaganja",
  sourceHealth: "Iz aplikacije Zdravlje",
  sourceYou: "Ti",
  historyEmptyTitle: "Još nema vaganja",
  historyEmptyNote: "Vaganja iz aplikacije Zdravlje prikazuju se i ovdje.",
  rowWeight: { metric: "{n} kg", imperial: "{n} lb" },
};

const HU: WeighHistoryCopy = {
  changesTitle: "Súlyváltozás",
  change3: "3 nap", change7: "7 nap", change14: "14 nap", change30: "30 nap", change90: "90 nap", changeAll: "Kezdettől",
  historyTitle: "Összes mérés",
  sourceHealth: "Az Egészség appból",
  sourceYou: "Te",
  historyEmptyTitle: "Még nincs mérés",
  historyEmptyNote: "Az Egészség app méréseit is itt látod.",
  rowWeight: { metric: "{n} kg", imperial: "{n} lb" },
};

const EL: WeighHistoryCopy = {
  changesTitle: "Μεταβολές βάρους",
  change3: "3 ημέρες", change7: "7 ημέρες", change14: "14 ημέρες", change30: "30 ημέρες", change90: "90 ημέρες", changeAll: "Από την αρχή",
  historyTitle: "Όλες οι ζυγίσεις",
  sourceHealth: "Από την εφαρμογή Υγεία",
  sourceYou: "Εσύ",
  historyEmptyTitle: "Δεν υπάρχουν ακόμα ζυγίσεις",
  historyEmptyNote: "Οι ζυγίσεις από την εφαρμογή Υγεία εμφανίζονται κι εδώ.",
  rowWeight: { metric: "{n} kg", imperial: "{n} lb" },
};

const UK: WeighHistoryCopy = {
  changesTitle: "Зміна ваги",
  change3: "3 дні", change7: "7 днів", change14: "14 днів", change30: "30 днів", change90: "90 днів", changeAll: "За весь час",
  historyTitle: "Усі зважування",
  sourceHealth: "Зі «Здоров’я»",
  sourceYou: "Ти",
  historyEmptyTitle: "Поки немає зважувань",
  historyEmptyNote: "Зважування зі «Здоров’я» теж з’являться тут.",
  rowWeight: { metric: "{n} кг", imperial: "{n} фунт." },
};

const TR: WeighHistoryCopy = {
  changesTitle: "Kilo değişimi",
  change3: "3 gün", change7: "7 gün", change14: "14 gün", change30: "30 gün", change90: "90 gün", changeAll: "Tüm zamanlar",
  historyTitle: "Tüm tartılmalar",
  sourceHealth: "Sağlık uygulamasından",
  sourceYou: "Sen",
  historyEmptyTitle: "Henüz tartılma yok",
  historyEmptyNote: "Sağlık uygulamasındaki tartılmalar da burada görünür.",
  rowWeight: { metric: "{n} kg", imperial: "{n} lb" },
};

const DA: WeighHistoryCopy = {
  changesTitle: "Vægtændringer",
  change3: "3 dage", change7: "7 dage", change14: "14 dage", change30: "30 dage", change90: "90 dage", changeAll: "Fra start",
  historyTitle: "Alle vejninger",
  sourceHealth: "Fra Sundhed-appen",
  sourceYou: "Du",
  historyEmptyTitle: "Ingen vejninger endnu",
  historyEmptyNote: "Vejninger fra Sundhed-appen vises også her.",
  rowWeight: { metric: "{n} kg", imperial: "{n} lb" },
};

const NO: WeighHistoryCopy = {
  changesTitle: "Vektendringer",
  change3: "3 dager", change7: "7 dager", change14: "14 dager", change30: "30 dager", change90: "90 dager", changeAll: "Fra start",
  historyTitle: "Alle veiinger",
  sourceHealth: "Fra Helse-appen",
  sourceYou: "Du",
  historyEmptyTitle: "Ingen veiinger ennå",
  historyEmptyNote: "Veiinger fra Helse-appen vises også her.",
  rowWeight: { metric: "{n} kg", imperial: "{n} lb" },
};

const SV: WeighHistoryCopy = {
  changesTitle: "Viktförändringar",
  change3: "3 dagar", change7: "7 dagar", change14: "14 dagar", change30: "30 dagar", change90: "90 dagar", changeAll: "Från start",
  historyTitle: "Alla vägningar",
  sourceHealth: "Från appen Hälsa",
  sourceYou: "Du",
  historyEmptyTitle: "Inga vägningar än",
  historyEmptyNote: "Vägningar från appen Hälsa visas också här.",
  rowWeight: { metric: "{n} kg", imperial: "{n} lb" },
};

const FI: WeighHistoryCopy = {
  changesTitle: "Painon muutokset",
  change3: "3 päivää", change7: "7 päivää", change14: "14 päivää", change30: "30 päivää", change90: "90 päivää", changeAll: "Alusta asti",
  historyTitle: "Kaikki punnitukset",
  sourceHealth: "Terveys-apista",
  sourceYou: "Sinä",
  historyEmptyTitle: "Ei vielä punnituksia",
  historyEmptyNote: "Terveys-apin punnitukset näkyvät myös täällä.",
  rowWeight: { metric: "{n} kg", imperial: "{n} lb" },
};

const HI: WeighHistoryCopy = {
  changesTitle: "वज़न में बदलाव",
  change3: "3 दिन", change7: "7 दिन", change14: "14 दिन", change30: "30 दिन", change90: "90 दिन", changeAll: "अब तक",
  historyTitle: "वज़न के सभी रिकॉर्ड",
  sourceHealth: "स्वास्थ्य ऐप से",
  sourceYou: "आप",
  historyEmptyTitle: "अभी कोई वज़न दर्ज नहीं",
  historyEmptyNote: "स्वास्थ्य ऐप के वज़न भी यहाँ दिखेंगे।",
  rowWeight: { metric: "{n} किग्रा", imperial: "{n} पाउंड" },
};

const BN: WeighHistoryCopy = {
  changesTitle: "ওজনের পরিবর্তন",
  change3: "3 দিন", change7: "7 দিন", change14: "14 দিন", change30: "30 দিন", change90: "90 দিন", changeAll: "এ পর্যন্ত",
  historyTitle: "ওজনের সব রেকর্ড",
  sourceHealth: "Apple Health থেকে",
  sourceYou: "আপনি",
  historyEmptyTitle: "এখনও কোনো ওজনের রেকর্ড নেই",
  historyEmptyNote: "Apple Health-এর ওজনের রেকর্ডও এখানে দেখা যাবে।",
  rowWeight: { metric: "{n} কেজি", imperial: "{n} পাউন্ড" },
};

const GU: WeighHistoryCopy = {
  changesTitle: "વજનમાં ફેરફાર",
  change3: "3 દિવસ", change7: "7 દિવસ", change14: "14 દિવસ", change30: "30 દિવસ", change90: "90 દિવસ", changeAll: "અત્યાર સુધી",
  historyTitle: "વજનની બધી નોંધો",
  sourceHealth: "Apple Health માંથી",
  sourceYou: "તમે",
  historyEmptyTitle: "હજી વજનની કોઈ નોંધ નથી",
  historyEmptyNote: "Apple Health ની વજનની નોંધો પણ અહીં દેખાશે.",
  rowWeight: { metric: "{n} કિગ્રા", imperial: "{n} પાઉન્ડ" },
};

const KN: WeighHistoryCopy = {
  changesTitle: "ತೂಕದ ಬದಲಾವಣೆ",
  change3: "3 ದಿನಗಳು", change7: "7 ದಿನಗಳು", change14: "14 ದಿನಗಳು", change30: "30 ದಿನಗಳು", change90: "90 ದಿನಗಳು", changeAll: "ಇಲ್ಲಿಯವರೆಗೆ",
  historyTitle: "ಎಲ್ಲಾ ತೂಕ ದಾಖಲೆಗಳು",
  sourceHealth: "Apple Health ನಿಂದ",
  sourceYou: "ನೀವು",
  historyEmptyTitle: "ಇನ್ನೂ ಯಾವುದೇ ತೂಕ ದಾಖಲಾಗಿಲ್ಲ",
  historyEmptyNote: "Apple Health ನ ತೂಕ ದಾಖಲೆಗಳೂ ಇಲ್ಲಿ ಕಾಣಿಸುತ್ತವೆ.",
  rowWeight: { metric: "{n} ಕೆಜಿ", imperial: "{n} ಪೌಂಡ್" },
};

const ML: WeighHistoryCopy = {
  changesTitle: "ഭാരത്തിലെ മാറ്റം",
  change3: "3 ദിവസം", change7: "7 ദിവസം", change14: "14 ദിവസം", change30: "30 ദിവസം", change90: "90 ദിവസം", changeAll: "ഇതുവരെ",
  historyTitle: "എല്ലാ ഭാര രേഖകളും",
  sourceHealth: "Apple Health-ൽ നിന്ന്",
  sourceYou: "നിങ്ങൾ",
  historyEmptyTitle: "ഇതുവരെ ഭാരം രേഖപ്പെടുത്തിയിട്ടില്ല",
  historyEmptyNote: "Apple Health-ലെ ഭാര രേഖകളും ഇവിടെ കാണാം.",
  rowWeight: { metric: "{n} കി.ഗ്രാം", imperial: "{n} പൗണ്ട്" },
};

const MR: WeighHistoryCopy = {
  changesTitle: "वजनातील बदल",
  change3: "3 दिवस", change7: "7 दिवस", change14: "14 दिवस", change30: "30 दिवस", change90: "90 दिवस", changeAll: "आतापर्यंत",
  historyTitle: "वजनाच्या सर्व नोंदी",
  sourceHealth: "Apple Health मधून",
  sourceYou: "तुम्ही",
  historyEmptyTitle: "अजून वजनाची नोंद नाही",
  historyEmptyNote: "Apple Health मधील वजनाच्या नोंदीही इथे दिसतील.",
  rowWeight: { metric: "{n} किलो", imperial: "{n} पाउंड" },
};

const OR: WeighHistoryCopy = {
  changesTitle: "ଓଜନରେ ପରିବର୍ତ୍ତନ",
  change3: "3 ଦିନ", change7: "7 ଦିନ", change14: "14 ଦିନ", change30: "30 ଦିନ", change90: "90 ଦିନ", changeAll: "ଏଯାବତ୍",
  historyTitle: "ସମସ୍ତ ଓଜନ ରେକର୍ଡ",
  sourceHealth: "Apple Health ରୁ",
  sourceYou: "ଆପଣ",
  historyEmptyTitle: "ଏପର୍ଯ୍ୟନ୍ତ କୌଣସି ଓଜନ ରେକର୍ଡ ନାହିଁ",
  historyEmptyNote: "Apple Health ର ଓଜନ ରେକର୍ଡ ମଧ୍ୟ ଏଠାରେ ଦେଖାଯିବ।",
  rowWeight: { metric: "{n} କିଗ୍ରା", imperial: "{n} ପାଉଣ୍ଡ" },
};

const PA: WeighHistoryCopy = {
  changesTitle: "ਭਾਰ ਵਿੱਚ ਬਦਲਾਅ",
  change3: "3 ਦਿਨ", change7: "7 ਦਿਨ", change14: "14 ਦਿਨ", change30: "30 ਦਿਨ", change90: "90 ਦਿਨ", changeAll: "ਹੁਣ ਤੱਕ",
  historyTitle: "ਭਾਰ ਦੇ ਸਾਰੇ ਰਿਕਾਰਡ",
  sourceHealth: "Apple Health ਤੋਂ",
  sourceYou: "ਤੁਸੀਂ",
  historyEmptyTitle: "ਅਜੇ ਕੋਈ ਭਾਰ ਦਰਜ ਨਹੀਂ",
  historyEmptyNote: "Apple Health ਦੇ ਭਾਰ ਦੇ ਰਿਕਾਰਡ ਵੀ ਇੱਥੇ ਦਿਖਣਗੇ।",
  rowWeight: { metric: "{n} ਕਿਲੋ", imperial: "{n} ਪੌਂਡ" },
};

const TA: WeighHistoryCopy = {
  changesTitle: "எடை மாற்றங்கள்",
  change3: "3 நாட்கள்", change7: "7 நாட்கள்", change14: "14 நாட்கள்", change30: "30 நாட்கள்", change90: "90 நாட்கள்", changeAll: "இதுவரை",
  historyTitle: "அனைத்து எடை பதிவுகள்",
  sourceHealth: "Apple Health-இலிருந்து",
  sourceYou: "நீங்கள்",
  historyEmptyTitle: "இன்னும் எடை பதிவுகள் இல்லை",
  historyEmptyNote: "Apple Health எடை பதிவுகளும் இங்கே தெரியும்.",
  rowWeight: { metric: "{n} கி.கி", imperial: "{n} பவுண்ட்" },
};

const TE: WeighHistoryCopy = {
  changesTitle: "బరువులో మార్పులు",
  change3: "3 రోజులు", change7: "7 రోజులు", change14: "14 రోజులు", change30: "30 రోజులు", change90: "90 రోజులు", changeAll: "ఇప్పటివరకు",
  historyTitle: "అన్ని బరువు నమోదులు",
  sourceHealth: "Apple Health నుండి",
  sourceYou: "మీరు",
  historyEmptyTitle: "ఇంకా బరువు నమోదులు లేవు",
  historyEmptyNote: "Apple Health బరువు నమోదులు కూడా ఇక్కడ కనిపిస్తాయి.",
  rowWeight: { metric: "{n} కి.గ్రా", imperial: "{n} పౌండ్లు" },
};

const JA: WeighHistoryCopy = {
  changesTitle: "体重の変化",
  change3: "3日間", change7: "7日間", change14: "14日間", change30: "30日間", change90: "90日間", changeAll: "全期間",
  historyTitle: "すべての体重記録",
  sourceHealth: "ヘルスケアから",
  sourceYou: "手入力",
  historyEmptyTitle: "まだ体重の記録はありません",
  historyEmptyNote: "ヘルスケアの体重記録もここに表示されます。",
  rowWeight: { metric: "{n} kg", imperial: "{n} lb" },
};

const KO: WeighHistoryCopy = {
  changesTitle: "체중 변화",
  change3: "3일", change7: "7일", change14: "14일", change30: "30일", change90: "90일", changeAll: "전체 기간",
  historyTitle: "모든 체중 기록",
  sourceHealth: "건강 앱에서",
  sourceYou: "직접 입력",
  historyEmptyTitle: "아직 체중 기록이 없어요",
  historyEmptyNote: "건강 앱의 체중 기록도 여기에 표시돼요.",
  rowWeight: { metric: "{n}kg", imperial: "{n}lb" },
};

const ZH_HANS: WeighHistoryCopy = {
  changesTitle: "体重变化",
  change3: "3天", change7: "7天", change14: "14天", change30: "30天", change90: "90天", changeAll: "全部",
  historyTitle: "全部体重记录",
  sourceHealth: "来自“健康”",
  sourceYou: "手动输入",
  historyEmptyTitle: "还没有体重记录",
  historyEmptyNote: "“健康”中的体重记录也会显示在这里。",
  rowWeight: { metric: "{n} 公斤", imperial: "{n} 磅" },
};

const ZH_HANT: WeighHistoryCopy = {
  changesTitle: "體重變化",
  change3: "3天", change7: "7天", change14: "14天", change30: "30天", change90: "90天", changeAll: "全部",
  historyTitle: "全部體重紀錄",
  sourceHealth: "來自「健康」",
  sourceYou: "手動輸入",
  historyEmptyTitle: "還沒有體重紀錄",
  historyEmptyNote: "「健康」中的體重紀錄也會顯示在這裡。",
  rowWeight: { metric: "{n} 公斤", imperial: "{n} 磅" },
};

const TH: WeighHistoryCopy = {
  changesTitle: "การเปลี่ยนแปลงน้ำหนัก",
  change3: "3 วัน", change7: "7 วัน", change14: "14 วัน", change30: "30 วัน", change90: "90 วัน", changeAll: "ทั้งหมด",
  historyTitle: "บันทึกน้ำหนักทั้งหมด",
  sourceHealth: "จากแอปสุขภาพ",
  sourceYou: "คุณ",
  historyEmptyTitle: "ยังไม่มีบันทึกน้ำหนัก",
  historyEmptyNote: "บันทึกน้ำหนักจากแอปสุขภาพจะแสดงที่นี่ด้วย",
  rowWeight: { metric: "{n} กก.", imperial: "{n} ปอนด์" },
};

const VI: WeighHistoryCopy = {
  changesTitle: "Thay đổi cân nặng",
  change3: "3 ngày", change7: "7 ngày", change14: "14 ngày", change30: "30 ngày", change90: "90 ngày", changeAll: "Tất cả",
  historyTitle: "Tất cả lần cân",
  sourceHealth: "Từ ứng dụng Sức khỏe",
  sourceYou: "Bạn",
  historyEmptyTitle: "Chưa có lần cân nào",
  historyEmptyNote: "Các lần cân từ ứng dụng Sức khỏe cũng hiện ở đây.",
  rowWeight: { metric: "{n} kg", imperial: "{n} lb" },
};

const ID: WeighHistoryCopy = {
  changesTitle: "Perubahan berat badan",
  change3: "3 hari", change7: "7 hari", change14: "14 hari", change30: "30 hari", change90: "90 hari", changeAll: "Semua",
  historyTitle: "Semua catatan berat",
  sourceHealth: "Dari app Kesehatan",
  sourceYou: "Kamu",
  historyEmptyTitle: "Belum ada catatan berat",
  historyEmptyNote: "Catatan berat dari app Kesehatan juga muncul di sini.",
  rowWeight: { metric: "{n} kg", imperial: "{n} lb" },
};

const MS: WeighHistoryCopy = {
  changesTitle: "Perubahan berat badan",
  change3: "3 hari", change7: "7 hari", change14: "14 hari", change30: "30 hari", change90: "90 hari", changeAll: "Semua",
  historyTitle: "Semua rekod berat",
  sourceHealth: "Daripada app Kesihatan",
  sourceYou: "Kamu",
  historyEmptyTitle: "Belum ada rekod berat",
  historyEmptyNote: "Rekod berat daripada app Kesihatan juga dipaparkan di sini.",
  rowWeight: { metric: "{n} kg", imperial: "{n} lb" },
};

export const WEIGH_HISTORY_COPY: Record<Lang, WeighHistoryCopy> = {
  "en": EN,
  "fr": FR,
  "de": DE,
  "it": IT,
  "es": ES,
  "vi": VI,
  "id": ID,
  "ru": RU,
  "pt-BR": PT_BR,
  "ja": JA,
  "ko": KO,
  "zh-Hans": ZH_HANS,
  "zh-Hant": ZH_HANT,
  "tr": TR,
  "pl": PL,
  "nl": NL,
  "uk": UK,
  "sv": SV,
  "th": TH,
  "hi": HI,
  "cs": CS,
  "ro": RO,
  "el": EL,
  "hu": HU,
  "da": DA,
  "fi": FI,
  "no": NO,
  "sk": SK,
  "hr": HR,
  "sl": SL,
  "ca": CA,
  "ms": MS,
  "pt-PT": PT_PT,
  "bn": BN,
  "gu": GU,
  "kn": KN,
  "ml": ML,
  "mr": MR,
  "or": OR,
  "pa": PA,
  "ta": TA,
  "te": TE,
};
export const weighHistoryCopyFor = (lang: Lang): WeighHistoryCopy => t(lang)(WEIGH_HISTORY_COPY);
