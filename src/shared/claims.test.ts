// The claims gate, in eight languages.
//
// WHY THIS FILE EXISTS NOW. The rule set was English patterns, and until #358 that was the whole
// of the exposure: one language of public copy, and it was the one the gate reads. `?lang=` gave
// an admin seven more revisions to type into, on two surfaces that are stored per host and
// outlive the binary — and one of them is a push notification, which arrives unasked on a lock
// screen with no review and no recall.
//
// THE ASYMMETRY THAT DECIDED THE SCOPE. The gate's own rationale in `claims.ts` cites §5 UWG and
// the Alleinstellungsbehauptung, which are GERMAN doctrine, and HWG governs a weight-loss claim in
// the same jurisdiction. German was one of the seven languages it could not read.
//
// WHAT IS PINNED HERE, in both directions. Every banned phrase must be REFUSED — that is the
// point. Every legitimate sentence must PASS, which is the harder half and the one that decides
// whether this survives: `claims.ts` says a linter that flags "sweet treats" gets disabled within
// a week, and a disabled linter protects nothing. The last test is the real guard — every string
// this product ships, in all eight, run through the gate its own surface uses.

import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { lintCopy } from "./claims.ts";
import { LANGS } from "./types.ts";
import { NOTIFICATION_COPY } from "./notifications.ts";
import { HEALTH_SCREEN_COPY } from "./health-copy.ts";
import { ONBOARDING_CONTENT } from "./onboarding-content.ts";
import { chatCopyFor } from "./onboarding-chat-copy.ts";
import { projectionMonth } from "./projection.ts";
import { PLAN_COPY } from "./app/plan-copy.ts";

/** Every phrase the gate must refuse, by family and by language. */
const BANNED: Record<string, Partial<Record<(typeof LANGS)[number], string[]>>> = {
  guarantee: {
    en: ["Guaranteed results in a week."],
    fr: ["Perte de poids garantie.", "Résultats garantis.",
      "Nous te garantissons des résultats.", "Cette appli garantit tes résultats."],
    de: ["Garantierter Gewichtsverlust.", "Erfolg garantiert.",
      // German puts the verb at the end, and builds nouns: neither is an inflection.
      "Wir garantieren dir Erfolg.", "Erfolgsgarantie inklusive."],
    it: ["Perdita di peso garantita.", "Risultati garantiti.", "Ti garantiamo risultati."],
    es: ["Pérdida de peso garantizada.", "Resultados garantizados.",
      "Te garantizamos resultados."],
    vi: ["Cam kết giảm cân.", "Đảm bảo kết quả trong một tuần.", "Bảo đảm giảm cân."],
    id: ["Dijamin turun berat badan.", "Hasil terjamin.", "Kami menjamin hasilnya."],
    ru: ["Гарантированное похудение.", "Результат гарантирован."],
    "pt-BR": ["Resultados garantidos.", "Garantimos a perda de peso."],
    nl: ["Gegarandeerd resultaat.", "Succes gegarandeerd."],
    pl: ["Gwarantowane efekty.", "Gwarantujemy efekty w miesiąc."],
    tr: ["Garantili sonuçlar.", "Kilo kaybı garantisi."],
    ja: ["結果を保証します。", "効果保証付き。"],
    "zh-Hans": ["保证效果。", "包瘦。"],
    "zh-Hant": ["保證減重。"],
    ko: ["결과를 보장합니다.", "보장된 감량."],
    uk: ["Гарантований результат.", "Гарантуємо схуднення за місяць."],
    sv: ["Garanterat resultat.", "Vi garanterar resultat."],
    th: ["รับประกันผลลัพธ์ภายในหนึ่งเดือน", "การันตีลดน้ำหนัก 5 กก."],
    hi: ["नतीजों की गारंटी।", "गारंटीड नतीजे।"],
    cs: ["Zaručené výsledky.", "Garantujeme úspěch."],
    ro: ["Rezultate garantate.", "Garantăm slăbire rapidă."],
    el: ["Εγγυημένα αποτελέσματα.", "Τα αποτελέσματα είναι εγγυημένα."],
    hu: ["Garantált eredmény.", "Sikergarancia minden ügyfélnek."],
    da: ["Garanteret resultat.", "Vi garanterer vægttab."],
    no: ["Garantert resultat.", "Vi garanterer vekttap på en måned."],
    fi: ["Taatut tulokset.", "Takaamme tuloksen kuukaudessa.", "Tulostakuu kaikille."],
    sk: ["Zaručené výsledky.", "Garantujeme úspech."],
    hr: ["Zajamčeni rezultati.", "Jamčimo uspjeh za mjesec dana."],
    sl: ["Zagotovljeni rezultati.", "Jamčimo uspeh v enem mesecu."],
    ca: ["Pèrdua de pes garantida.", "Garantim l'èxit."],
    ms: ["Keputusan dijamin.", "Kami menjamin kejayaan anda."],
    "pt-PT": ["Resultados garantidos.", "Garantimos a perda de peso."],
    bn: ["ফলাফলের গ্যারান্টি।", "আমরা ওজন কমানোর গ্যারান্টি দিচ্ছি।"],
    gu: ["પરિણામની ગેરંટી.", "અમે વજન ઘટાડવાની ગેરંટી આપીએ છીએ."],
    kn: ["ಫಲಿತಾಂಶದ ಗ್ಯಾರಂಟಿ.", "ತೂಕ ಇಳಿಕೆಗೆ ಖಾತರಿ ನೀಡುತ್ತೇವೆ."],
    ml: ["ഫലം ഉറപ്പ്!", "ഭാരം കുറയ്ക്കുന്നതിന് ഗ്യാരന്റി."],
    mr: ["निकालाची हमी.", "वजन कमी होण्याची गॅरंटी."],
    or: ["ଫଳାଫଳର ଗ୍ୟାରେଣ୍ଟି।", "ଓଜନ କମିବାର ଗ୍ୟାରେଣ୍ଟି।"],
    pa: ["ਨਤੀਜਿਆਂ ਦੀ ਗਾਰੰਟੀ।", "ਭਾਰ ਘਟਾਉਣ ਦੀ ਗਾਰੰਟੀ।"],
    ta: ["முடிவுகளுக்கு உத்தரவாதம்.", "எடை குறைப்புக்கு உத்தரவாதம் தருகிறோம்."],
    te: ["ఫలితాలకు హామీ.", "బరువు తగ్గడానికి గ్యారంటీ."],
  },
  "weight-promise": {
    en: ["Lose weight fast.", "Lose 5kg this month."],
    fr: ["Perdez du poids vite.", "Perdre 5kg ce mois-ci.", "Tu perdras du poids.",
      "Maigrir sans effort.", "Mincir durablement.", "Amincissement rapide."],
    de: ["Nimm 5kg ab.", "Gewicht verlieren, schnell.",
      // `\bab\b` has no boundary inside `abnehmen`, so only the SEPARABLE form fired.
      "Mit eait 5kg abnehmen.", "Gewichtsabnahme ohne Hunger."],
    it: ["Perdi peso in fretta.", "Dimagrire di 5kg.", "Perderai peso.",
      "Perdi 5kg in un mese."],
    es: ["Pierde peso rápido.", "Adelgazar 5kg.", "Perderás peso.",
      "Baja de peso sin esfuerzo.", "Pierde 5kg en un mes."],
    vi: ["Giảm cân nhanh.", "Giảm 5kg trong tháng này.", "Giảm 5 ký trong tháng này."],
    id: ["Turunkan berat badan dengan cepat.",
      // me- ASSIMILATES the t, so `menurunkan` contains no `turun` at all — and this is the
      // standard Indonesian phrase AND the shipped goal button.
      "Menurunkan berat badan dengan cepat.", "Penurunan berat badan terjamin."],
    ru: ["Похудей быстро.", "Сбросить 5кг за месяц.",
      // The standard Russian marketing noun. `потеря веса` is the calque nobody writes.
      "Снижение веса за месяц.", "Скинуть вес быстро.", "Минус 10кг за месяц."],
    "pt-BR": ["Perca peso rápido.", "Emagrecer sem esforço.", "Perder 5 kg em um mês."],
    nl: ["Afvallen zonder honger.", "Val 5 kg af in een maand."],
    pl: ["Schudniesz szybko.", "Schudnąć 5 kg w miesiąc.", "Zrzuć 5 kg."],
    tr: ["Hızlı kilo verin.", "Bir ayda 5kg vermek.", "Zayıflamak hiç bu kadar kolay olmadı."],
    ja: ["1か月で5kg痩せる。", "体重を減らす近道。"],
    "zh-Hans": ["一个月减掉5公斤。", "轻松减肥。"],
    "zh-Hant": ["一個月減掉 5 公斤。"],
    ko: ["한 달에 5kg 감량.", "쉽게 살 빼기."],
    uk: ["Схуднути без зусиль.", "Скинути 5 кг за місяць.", "Мінус 10 кг за місяць.", "−10 кг за місяць!"],
    sv: ["Gå ner i vikt snabbt.", "Gå ner 5 kg på en månad.", "Snabb viktnedgång."],
    th: ["ลด 5 กก. ในเดือนเดียว", "ลดน้ำหนัก 5 กิโลใน 1 เดือน", "ลดความอ้วนแบบง่ายๆ"],
    hi: ["एक महीने में 5 किलो वज़न घटाएँ।", "वज़न घटाना अब आसान।", "तेज़ वेट लॉस।"],
    cs: ["Zhubnout bez hladovění.", "Zhubneš 5 kg za měsíc.", "Shodit 5 kg za měsíc."],
    ro: ["Slăbești 5 kg într-o lună.", "Vei slăbi rapid.", "Pierde în greutate fără efort.", "Slăbire rapidă."],
    el: ["Χάσε βάρος γρήγορα.", "Θα χάσεις 5 κιλά σε έναν μήνα.", "Απώλεια βάρους χωρίς πείνα.", "−5 κιλά σε έναν μήνα."],
    hu: ["Fogyj le 5 kilót egy hónap alatt.", "5 kg fogyás egy hónap alatt.", "Lefogysz nyárra.", "−10 kg egy hónap alatt!"],
    da: ["Gå ned i vægt hurtigt.", "Tab 5 kg på en måned.", "Hurtigt vægttab.", "Tabe sig uden sult."],
    no: ["Gå ned i vekt raskt.", "Gå ned 5 kg på en måned.", "Raskt vekttap.", "Miste 5 kg på en måned."],
    fi: ["Laihtua ilman nälkää.", "Laihdut 5 kg kuukaudessa.", "Nopea painonpudotus.", "−5 kg kuukaudessa."],
    sk: ["Schudnúť bez hladovania.", "Schudneš 5 kg za mesiac.", "Zhodiť 5 kg za mesiac."],
    hr: ["Smršavjeti bez gladovanja.", "Smršavit ćeš brzo.", "Izgubi 5 kg za mjesec dana.", "Brzi gubitak težine."],
    sl: ["Shujšati brez lakote.", "Shujšaš 5 kg v enem mesecu.", "Izgubi težo hitro."],
    ca: ["Perdre pes sense esforç.", "Perdràs 5 kg en un mes.", "Aprimar-se sense passar gana.", "Pèrdua de pes ràpida."],
    ms: ["Kurangkan berat badan dengan cepat.", "Hilangkan 5 kg dalam sebulan.", "Menurunkan berat badan dengan cepat."],
    "pt-PT": ["Perde peso rapidamente.", "Vais emagrecer sem esforço.", "Emagrecerás 5 kg num mês.", "Desce 5 kg num mês."],
    // A number in the script's own digits (`৫`, `५`), a nukta letter typed precomposed (`ਜ਼`), and
    // Malayalam's older chillu (`ന്‍`, whose ZWJ `normalizeForMatch` strips) are each refused.
    bn: ["এক মাসে 5 কেজি ওজন কমান।", "ওজন কমানো এখন সহজ।", "দ্রুত ওয়েট লস।", "এক মাসে ৫ কেজি ওজন কমান।"],
    gu: ["એક મહિનામાં 5 કિલો વજન ઘટાડો.", "વજન ઘટાડવું હવે સરળ.", "ઝડપી વેઇટ લોસ."],
    kn: ["ಒಂದು ತಿಂಗಳಲ್ಲಿ 5 ಕೆಜಿ ತೂಕ ಇಳಿಸಿ.", "ತೂಕ ಇಳಿಸುವುದು ಈಗ ಸುಲಭ."],
    ml: ["ഒരു മാസത്തിൽ 5 കിലോ ഭാരം കുറയ്ക്കൂ.", "ഭാരം കുറയ്ക്കാൻ എളുപ്പവഴി.", "ഭാരം കുറയ്ക്കാന\u0D4D\u200D എളുപ്പവഴി."],
    mr: ["एका महिन्यात 5 किलो वजन कमी करा.", "वजन कमी करणे आता सोपे.", "−५ किलो एका महिन्यात!"],
    or: ["ଗୋଟିଏ ମାସରେ 5 କିଲୋ ଓଜନ କମାନ୍ତୁ।", "ଓଜନ କମାଇବା ଏବେ ସହଜ।"],
    pa: ["ਇੱਕ ਮਹੀਨੇ ਵਿੱਚ 5 ਕਿਲੋ ਭਾਰ ਘਟਾਓ।", "ਭਾਰ ਘਟਾਉਣਾ ਹੁਣ ਆਸਾਨ।", "ਵ\u0A5Bਨ ਘਟਾਉਣਾ ਹੁਣ ਆਸਾਨ।"],
    ta: ["ஒரு மாதத்தில் 5 கிலோ எடையைக் குறையுங்கள்.", "எடை குறைப்பது இப்போது எளிது.", "−5 கிலோ ஒரு மாதத்தில்!"],
    te: ["ఒక నెలలో 5 కిలోల బరువు తగ్గండి.", "బరువు తగ్గడం ఇప్పుడు సులభం."],
  },
  "lowers-marker": {
    en: ["Lowers cholesterol."],
    fr: ["Fait baisser le cholestérol.", "Réduit le cholestérol.",
      "Diminue la tension artérielle.", "Baisse ton cholestérol."],
    de: ["Senkt den Cholesterinspiegel.", "Senkt den Blutdruck.",
      "Hilft, den Cholesterinspiegel zu senken."],
    it: ["Abbassa il colesterolo.", "Riduce il colesterolo.", "Fa scendere la glicemia.",
      "Abbassa il tuo colesterolo."],
    es: ["Baja el colesterol.", "Reduce el colesterol.", "Hace bajar la glucosa.",
      "Baja tu colesterol."],
    vi: ["Giảm cholesterol.", "Hạ đường huyết.", "Giảm mỡ máu."],
    id: ["Menurunkan kolesterol."],
    ru: ["Снижает холестерин.", "Снижает давление.",
      // The PERFECTIVE is how a promise is phrased, and `сниж[а-яё]*` matched only the ж stem.
      "Снизит холестерин.", "Снизить давление за месяц."],
    "pt-BR": ["Reduz o colesterol.", "Baixa a pressão arterial."],
    nl: ["Verlaagt je cholesterol.", "Helpt de bloeddruk te verlagen."],
    pl: ["Obniża cholesterol.", "Obniża poziom cukru we krwi."],
    tr: ["Kolesterolü düşürür.", "Kan şekerini düşürür."],
    ja: ["コレステロールを下げる。", "血糖値を下げます。"],
    "zh-Hans": ["降低胆固醇。", "降血压。"],
    "zh-Hant": ["降低膽固醇。"],
    ko: ["콜레스테롤을 낮춥니다.", "혈당을 낮춰요."],
    uk: ["Знижує холестерин.", "Знизить тиск за місяць."],
    sv: ["Sänker kolesterolet.", "Sänker ditt blodtryck."],
    th: ["ลดคอเลสเตอรอล", "ช่วยลดน้ำตาลในเลือด"],
    hi: ["कोलेस्ट्रॉल कम करता है।", "ब्लड शुगर को घटाता है।"],
    cs: ["Snižuje cholesterol.", "Sníží krevní tlak."],
    ro: ["Scade colesterolul.", "Reduce glicemia."],
    el: ["Μειώνει τη χοληστερίνη.", "Ρίχνει το σάκχαρο."],
    hu: ["Csökkenti a koleszterint.", "A vérnyomást csökkenti."],
    da: ["Sænker kolesterolet.", "Sænker dit blodtryk."],
    no: ["Senker kolesterolet.", "Reduserer blodsukkeret."],
    fi: ["Alentaa kolesterolia.", "Laskee verenpainetta.", "Verensokeria alentava."],
    sk: ["Znižuje cholesterol.", "Zníži krvný tlak."],
    hr: ["Snižava kolesterol.", "Smanjuje šećer u krvi."],
    sl: ["Znižuje holesterol.", "Zmanjša krvni tlak."],
    ca: ["Redueix el colesterol.", "Fa baixar la pressió arterial."],
    ms: ["Merendahkan kolesterol.", "Mengurangkan paras gula dalam darah."],
    "pt-PT": ["Baixa a tensão arterial.", "Reduz o teu colesterol."],
    bn: ["কোলেস্টেরল কমায়।", "রক্তে শর্করা কমাতে সাহায্য করে।"],
    gu: ["કોલેસ્ટ્રોલ ઘટાડે છે.", "બ્લડ પ્રેશર ઓછું કરે છે."],
    kn: ["ಕೊಲೆಸ್ಟ್ರಾಲ್ ಅನ್ನು ಕಡಿಮೆ ಮಾಡುತ್ತದೆ.", "ರಕ್ತದೊತ್ತಡವನ್ನು ಇಳಿಸುತ್ತದೆ."],
    ml: ["കൊളസ്ട്രോൾ കുറയ്ക്കുന്നു.", "രക്തസമ്മർദ്ദം കുറയ്ക്കും."],
    mr: ["कोलेस्टेरॉल कमी करते.", "रक्तदाब कमी करतो."],
    or: ["କୋଲେଷ୍ଟେରଲ କମାଏ।", "ରକ୍ତଚାପ ହ୍ରାସ କରେ।"],
    pa: ["ਕੋਲੈਸਟ੍ਰੋਲ ਘਟਾਉਂਦਾ ਹੈ।", "ਬਲੱਡ \u0A36ੂਗਰ ਘੱਟ ਕਰਦਾ ਹੈ।"],
    ta: ["கொலஸ்ட்ராலைக் குறைக்கிறது.", "இரத்த அழுத்தத்தைக் குறைக்கும்."],
    te: ["కొలెస్ట్రాల్‌ను తగ్గిస్తుంది.", "రక్తపోటును తగ్గిస్తుంది."],
  },
  detox: {
    en: ["A detox week."],
    fr: ["Une semaine détox.", "Élimine les toxines.", "Purifie ton organisme."],
    de: ["Eine Woche Entgiftung."],
    it: ["Una settimana disintossicante.", "Elimina le tossine."],
    es: ["Una semana de desintoxicación.", "Elimina las toxinas.", "Depura tu organismo."],
    vi: ["Một tuần thải độc.", "Một tuần giải độc."],
    id: ["Seminggu detoksifikasi."],
    ru: ["Неделя детокса."],
    "pt-BR": ["Uma semana de desintoxicação.", "Elimina as toxinas."],
    nl: ["Een week ontgiften."],
    pl: ["Tydzień detoksu.", "Oczyszcza organizm."],
    tr: ["Bir hafta detoks.", "Vücudu arındırır."],
    ja: ["1週間のデトックス。"],
    "zh-Hans": ["一周排毒。"],
    "zh-Hant": ["一週排毒。"],
    ko: ["일주일 디톡스."],
    uk: ["Тиждень детоксу.", "Очищує організм."],
    sv: ["En vecka detox.", "Avgifta kroppen."],
    th: ["ดีท็อกซ์หนึ่งสัปดาห์", "ล้างพิษลำไส้"],
    hi: ["एक हफ़्ते का डिटॉक्स।"],
    cs: ["Týden detoxikace.", "Očistí tělo."],
    ro: ["O săptămână de detoxifiere.", "Elimină toxinele."],
    el: ["Μια εβδομάδα αποτοξίνωσης.", "Ντετόξ μιας εβδομάδας."],
    hu: ["Egy hét méregtelenítés."],
    da: ["En uges detox.", "Afgiftning af kroppen."],
    no: ["En uke med detox.", "Avgiftning på en uke.", "Rens kroppen."],
    fi: ["Viikon detox.", "Puhdistaa elimistön.", "Poistaa kuona-aineet."],
    sk: ["Týždeň detoxikácie.", "Očistí telo.", "Vyplaví toxíny."],
    hr: ["Tjedan detoksikacije.", "Očisti organizam.", "Izbacuje toksine."],
    sl: ["Teden razstrupljanja.", "Očisti telo.", "Odstrani toksine."],
    ca: ["Una setmana de desintoxicació.", "Elimina les toxines.", "Depura l'organisme."],
    ms: ["Seminggu detoks.", "Nyahtoksik badan anda.", "Buang toksin."],
    "pt-PT": ["Uma semana de desintoxicação.", "Depura o organismo."],
    bn: ["এক সপ্তাহের ডিটক্স।"],
    gu: ["એક અઠવાડિયાનું ડિટોક્સ."],
    kn: ["ಒಂದು ವಾರದ ಡಿಟಾಕ್ಸ್.", "ವಿಷಕಾರಿ ಅಂಶಗಳನ್ನು ಹೊರಹಾಕುತ್ತದೆ."],
    ml: ["ഒരാഴ്ചത്തെ ഡിറ്റോക്സ്."],
    mr: ["एका आठवड्याचा डिटॉक्स.", "विषारी पदार्थ बाहेर काढते."],
    or: ["ଏକ ସପ୍ତାହର ଡିଟକ୍ସ।"],
    pa: ["ਇੱਕ ਹਫ਼ਤੇ ਦਾ ਡੀਟੌਕਸ।"],
    ta: ["ஒரு வாரம் டிடாக்ஸ்.", "ஒரு வாரத்தில் நச்சு நீக்கம்."],
    te: ["ఒక వారం డిటాక్స్.", "విష పదార్థాలను బయటకు పంపుతుంది."],
  },
};

/**
 * Sentences that must PASS, and every one is a real shape this product writes.
 *
 * A gate that refuses these is a gate somebody turns off. `weight-promise` is the family that
 * makes this hard: "Lose weight" is a GOAL somebody picks, so the onboarding surface opts out of
 * that rule by name (`ONBOARDING_CLAIM_RULES`) — these are the sentences that must survive the
 * FULL rule set, which is what the notification copy is held to.
 */
const FINE = [
  // Naming the plan, not promising an outcome.
  "1.100 von 1.900kcal heute. Morgen startet wieder bei 1.900.",
  "Твой профицит ограничен примерно 20% сверх того, что тело сжигает за день.",
  "Il tuo obiettivo è al minimo che questa app possa proporre.",
  // `guarantee`'s neighbours: a warranty-free promise about behaviour, not about a result.
  "Wir versprechen dir nichts, was die Zahlen nicht hergeben.",
  // Vietnamese `đảm bảo` in its ordinary sense — "make sure there is enough protein" — which is
  // why the pattern needs the outcome beside it rather than the verb alone.
  "Đảm bảo đủ đạm mỗi ngày là việc ứng dụng theo dõi giúp bạn.",
  // Indonesian `jaminan` as a noun about the floor, not about a result.
  "Ini batas bawah, bukan hasil hitungan.",
  // `lowers-marker`'s neighbours: the app lowers a TARGET, not a biomarker.
  "Das Ziel senkt sich nicht unter diese Grenze.",
  "Снижать цель ниже этого порога мы не будем.",
  // `сахар` alone is the food. English `blood sugar` disambiguates and Russian does not, so the
  // marker pattern needs `в крови` beside it — otherwise ordinary dietary advice is a claim.
  "Снижай сахар постепенно, а не за один день.",
  // THE ONE THAT WOULD HAVE GOT THIS SWITCHED OFF. A paid iOS app writes the consumer-law noun,
  // and this product's own voice is the honest denial — both are the guarantee STEM with no
  // outcome anywhere near it, which is why every language's pattern is outcome-bound.
  "Garantie légale de conformité : deux ans.",
  "Garanzia legale di conformità: due anni.",
  "Garantía legal de conformidad: dos años.",
  "Rien n'est garanti ici — ce sont des estimations.",
  "Niente è garantito qui — sono stime.",
  "Nada está garantizado aquí — son estimaciones.",
  // A marker verb on something that is not a marker. Spanish `baja` is also an instruction and
  // `tensión` is also stress; `pressione`/`tension` are also pressure of the ordinary kind.
  "Baja el azúcar del desayuno y verás la diferencia.",
  "Baisse la tension du quotidien : mange sans te presser.",
  "Abbassa la pressione del lavoro, non quella del sangue.",
  // Describing what is happening, not promising it. The progressive is the descriptive form in
  // both, which is why the stems stop short of it.
  "Estás adelgazando a 0,5kg por semana.",
  "Stai dimagrendo di 0,5kg a settimana.",
  "Você está emagrecendo 0,5 kg por semana.",
  "Je bent aan het afvallen, 0,5 kg per week.",
  "Haftada 0,5 kg veriyorsun.",
  // The honest denial, where the outcome sits right beside the stem because nothing separates them.
  "結果を保証するものではありません。",
  "我们不保证效果，这些都是估算。",
  "결과를 보장하지 않습니다.",
  // The app lowers a TARGET; `cukier` alone is the food.
  "Verlaag je doel niet onder deze grens.",
  "Obniż cukier w śniadaniu.",
  // Wave 2: the honest denial, the warranty noun, the descriptive present at a pace, and a
  // marker verb on the food rather than the blood.
  "Нічого тут не гарантовано — це оцінки.",
  "Ми не гарантуємо результат.",
  "Ти худнеш на 0,5 кг на тиждень.",
  "Знижуй цукор поступово.",
  "Inget är garanterat här — det är uppskattningar.",
  "Du går ner 0,5 kg i veckan.",
  "Sänk inte målet under den här gränsen.",
  "ไม่รับประกันผลลัพธ์ ตัวเลขทั้งหมดเป็นการประมาณ",
  "รับประกันผลิตภัณฑ์ตามกฎหมาย 2 ปี",
  "हम नतीजों की गारंटी नहीं देते — ये अनुमान हैं।",
  "चीनी धीरे-धीरे कम करें।",
  "Nic tu není zaručené — jsou to odhady.",
  "Výsledek není zaručen.",
  "Zákonná záruka: dva roky.",
  "Hubneš 0,5 kg týdně.",
  "Snižuj cukr postupně.",
  "Nimic nu e garantat aici — sunt estimări.",
  "Rezultatele nu sunt garantate.",
  "Garanția legală de conformitate: doi ani.",
  "Scade zahărul de la micul dejun.",
  "Τίποτα δεν είναι εγγυημένο εδώ — είναι εκτιμήσεις.",
  "Τα αποτελέσματα δεν είναι εγγυημένα.",
  "Χάνεις 0,5 kg την εβδομάδα.",
  "Μείωσε τη ζάχαρη στο πρωινό.",
  "Itt semmi sem garantált — ezek becslések.",
  "A fogyás üteme nem garantált.",
  "Hetente 0,5 kg-ot fogysz.",
  "Csökkentsd a cukrot fokozatosan.",
  "A napi kereted elfogyott.",
  // A sign that is a range or a pace, not a goal.
  "Темп: −0,5 кг на тиждень.",
  "Rozumné tempo je 5-10 kg za půl roku.",
  // Wave 3: the honest denial (in the order each language negates), the warranty noun, the
  // descriptive present at a pace, the twice.title shape with a weight that is not adjacent, and
  // a marker verb on the food rather than the blood.
  "Intet her er garanteret — det er skøn.",
  "Vi garanterer ikke resultater.",
  "Resultaterne er ikke garanteret.",
  "Du taber 0,5 kg om ugen.",
  "Sænk sukkeret til morgenmad.",
  "Ingenting her er garantert — det er anslag.",
  "Resultatene er ikke garantert.",
  "Du går ned 0,5 kg i uka.",
  "Senk ikke målet under denne grensen.",
  "Mitään ei taata — nämä ovat arvioita.",
  "Tuloksia ei taata.",
  "Emme takaa tuloksia.",
  "Takuu: kaksi vuotta.",
  "Laihdut 0,5 kg viikossa.",
  "Vähennä sokeria vähitellen.",
  "Nič tu nie je zaručené — sú to odhady.",
  "Výsledky nie sú zaručené.",
  "Zákonná záruka: dva roky.",
  "Chudneš 0,5 kg týždenne.",
  "Znižuj cukor postupne.",
  "Ovdje ništa nije zajamčeno — to su procjene.",
  "Rezultati nisu zajamčeni.",
  "Rezultati nisu garantirani.",
  "Zakonsko jamstvo: dvije godine.",
  "Mršaviš 0,5 kg tjedno.",
  "Smanji šećer postupno.",
  "Tu ni nič zagotovljeno — to so ocene.",
  "Rezultati niso zagotovljeni.",
  "Zagotovi dovolj beljakovin vsak dan.",
  "Hujšaš 0,5 kg na teden.",
  "Zmanjšaj sladkor postopoma.",
  "Aquí no hi ha res garantit — són estimacions.",
  "Estàs perdent 0,5 kg per setmana.",
  "Baixa el sucre de l'esmorzar.",
  "Tiada apa-apa yang dijamin di sini — ini anggaran.",
  "Keputusan tidak dijamin.",
  "Anda sedang turun berat badan 0.5 kg seminggu.",
  "Kurangkan gula secara beransur-ansur.",
  "Nada aqui é garantido — são estimativas.",
  "Estás a emagrecer 0,5 kg por semana.",
  "Estás a perder peso ao teu ritmo.",
  "Reduz o açúcar ao pequeno-almoço.",
  // Each twice.title: a bare imperative with `twice as much` between the verb and the weight.
  "Tab dobbelt så meget i vægt", "Gå ned dobbelt så mye i vekt", "Laihdu kaksi kertaa enemmän",
  "Schudni dvakrát viac", "Smršavi dvostruko više", "Izgubi dvakrat več teže",
  "Perd el doble de pes", "Turun berat dua kali lebih banyak", "Perde o dobro do peso",
  // Wave 4: the honest denial (the negation after the stem, separate or fused), the warranty
  // noun, a pace that is a decimal, a marker verb on the food rather than the blood, the verb
  // `ensure` beside a guarantee-shaped noun, and "poison-free" vegetables.
  "আমরা ফলাফলের গ্যারান্টি দিই না — এগুলো অনুমান।", "কোনো গ্যারান্টি নেই, ফলাফল অনুমান মাত্র।",
  "আইনি গ্যারান্টি: দুই বছর।", "আপনি সপ্তাহে 0.5 kg কমাচ্ছেন।", "চিনি ধীরে ধীরে কমান।", "বিষমুক্ত সবজি খান।",
  "અમે પરિણામની ગેરંટી આપતા નથી — આ અંદાજ છે.", "તમે અઠવાડિયે 0.5 kg ઘટાડી રહ્યા છો.",
  "ખાંડ ધીમે ધીમે ઓછી કરો.", "તમારું વજન ખાતરી કરો.",
  "ನಾವು ಫಲಿತಾಂಶಗಳಿಗೆ ಖಾತರಿ ನೀಡುವುದಿಲ್ಲ — ಇವು ಅಂದಾಜುಗಳು.", "ನೀವು ವಾರಕ್ಕೆ 0.5 kg ಇಳಿಸುತ್ತಿದ್ದೀರಿ.",
  "ಸಕ್ಕರೆಯನ್ನು ಕ್ರಮೇಣ ಕಡಿಮೆ ಮಾಡಿ.",
  "ഫലങ്ങൾക്ക് ഞങ്ങൾ ഗ്യാരന്റി നൽകുന്നില്ല — ഇവ കണക്കുകൂട്ടലുകളാണ്.", "ഫലം ഉറപ്പില്ല — ഇത് ഒരു കണക്ക് മാത്രം.",
  "ദിവസവും ആവശ്യത്തിന് പ്രോട്ടീൻ ഉറപ്പാക്കുക.", "ആഴ്ചയിൽ 0.5 kg കുറയ്ക്കുന്നു.", "പഞ്ചസാര പതുക്കെ കുറയ്ക്കൂ.",
  // Marathi's denial is `नाही`, and its `गारंटी` is also what the HINDI rule reads.
  "आम्ही परिणामांची हमी देत नाही — हे अंदाज आहेत.", "आम्ही परिणामांची गारंटी देत नाही.",
  "तुम्ही आठवड्याला 0.5 kg कमी करत आहात.", "साखर हळूहळू कमी करा.", "विषमुक्त भाजीपाला.",
  "ଆମେ ଫଳାଫଳର ଗ୍ୟାରେଣ୍ଟି ଦେଉନାହୁଁ।", "ଆପଣ ସପ୍ତାହରେ 0.5 kg କମାଉଛନ୍ତି।", "ଚିନି ଧୀରେ ଧୀରେ କମାନ୍ତୁ।",
  "ਅਸੀਂ ਨਤੀਜਿਆਂ ਦੀ ਗਾਰੰਟੀ ਨਹੀਂ ਦਿੰਦੇ — ਇਹ ਅੰਦਾਜ਼ੇ ਹਨ।", "ਤੁਸੀਂ ਹਫ਼ਤੇ ਵਿੱਚ 0.5 kg ਘਟਾ ਰਹੇ ਹੋ।",
  "ਖੰਡ ਹੌਲੀ-ਹੌਲੀ ਘਟਾਓ।",
  "முடிவுகளுக்கு நாங்கள் உத்தரவாதம் அளிக்கவில்லை — இவை மதிப்பீடுகள்.", "வாரத்திற்கு 0.5 kg குறைக்கிறீர்கள்.",
  "சர்க்கரையைப் படிப்படியாகக் குறைக்கவும்.",
  "ఫలితాలకు మేము హామీ ఇవ్వలేము — ఇవి అంచనాలు.", "మీరు వారానికి 0.5 kg తగ్గుతున్నారు.", "చక్కెరను క్రమంగా తగ్గించండి.",
  // Each twice.title is the bare imperative with the weight ADJACENT, and three twice.sub lines
  // are the habitual present; and `possible.lose` puts the number beside the word for LESS.
  "দ্বিগুণ ওজন কমান", "બમણું વજન ઘટાડો", "ಎರಡು ಪಟ್ಟು ತೂಕ ಇಳಿಸಿ", "ഇരട്ടി ഭാരം കുറയ്ക്കൂ", "दुप्पट वजन कमी करा",
  "ଦୁଇଗୁଣ ଓଜନ କମାନ୍ତୁ", "ਦੁੱਗਣਾ ਭਾਰ ਘਟਾਓ", "இரு மடங்கு எடையைக் குறையுங்கள்", "రెట్టింపు బరువు తగ్గండి",
  "ತಾವು ತಿನ್ನುವುದನ್ನು ಬರೆದಿಡುವ ಜನರು ಎರಡು ಪಟ್ಟು ತೂಕ ಇಳಿಸುತ್ತಾರೆ",
  "കഴിക്കുന്നത് എഴുതിവയ്ക്കുന്നവർക്ക് ഇരട്ടി ഭാരം കുറയുന്നു",
  "తాము తినేదాన్ని రాసుకునేవారు రెట్టింపు బరువు తగ్గుతారు",
  "6kg কম?", "6kg ઓછું?", "6kg ಕಡಿಮೆ?", "6kg കുറവ്?", "6kg कमी?", "6kg କମ୍?", "6kg ਘੱਟ?", "6kg குறைவா?", "6kg తక్కువా?",
];

describe("the claims gate reads all eight languages", () => {
  for (const [family, byLang] of Object.entries(BANNED)) {
    it(`refuses a ${family} claim in every language that has one`, () => {
      for (const [lang, phrases] of Object.entries(byLang)) {
        for (const text of phrases) {
          const hits = lintCopy({ body: text });
          expect(hits.length, `${lang}: "${text}" was not refused`).toBeGreaterThan(0);
          expect(hits.map((h) => h.pattern), `${lang}: "${text}"`).toContain(family);
        }
      }
    });
  }

  it("lets the product's own sentences through, or it gets switched off", () => {
    for (const text of FINE) {
      expect(lintCopy({ body: text }).map((h) => `${h.pattern}: ${h.span}`), text).toEqual([]);
    }
  });
});

describe("every sentence this product ships", () => {
  // THE REAL GUARD. The tables above are hand-written examples; this is the corpus. A pattern that
  // is too broad fails HERE, on a language nobody was thinking about, which is the failure mode
  // that matters — an over-eager rule is discovered by the person it blocks, at the moment they
  // are trying to fix something else.

  it("passes the claims gate over the Apple Health screens, in all eight", () => {
    // `HEALTH_SCREEN_COPY` is code, not admin-edited — but a weight surface's words are exactly
    // where a "you will lose" sneaks in ("on pace" is one word away from a promise). The whole
    // table walks `lintCopy`, the same way the notification table does.
    for (const lang of LANGS) {
      const copy = HEALTH_SCREEN_COPY[lang];
      if (!copy) continue;
      const fields: Record<string, string> = {};
      const walk = (node: unknown, at: string): void => {
        if (typeof node === "string") { fields[at] = node; return; }
        if (typeof node !== "object" || node === null) return;
        for (const [k, v] of Object.entries(node)) walk(v, at === "" ? k : `${at}.${k}`);
      };
      walk(copy, "");
      expect(lintCopy(fields).map((v) => `${v.field}: ${v.pattern} "${v.span}"`), lang).toEqual([]);
    }
  });

  it("passes the claims gate over the plan reveal's own words, in all eight (#1692)", () => {
    // The methodology note names an equation and a source at the moment of decision — exactly
    // where a health claim would do the most harm, so the whole table walks the full set.
    for (const lang of LANGS) {
      const copy = PLAN_COPY[lang];
      if (!copy) continue;
      expect(lintCopy({ ...copy }).map((v) => `${v.field}: ${v.pattern} "${v.span}"`), lang).toEqual([]);
    }
  });

  it("passes the notification gate, in all eight — that copy is push and is admin-editable", () => {
    for (const lang of LANGS) {
      const copy = NOTIFICATION_COPY[lang];
      if (!copy) continue;
      const fields: Record<string, string> = {};
      for (const [id, m] of Object.entries(copy)) {
        for (const [k, v] of Object.entries(m)) if (typeof v === "string") fields[`${id}.${k}`] = v;
      }
      expect(lintCopy(fields).map((v) => `${v.field}: ${v.pattern} "${v.span}"`), lang).toEqual([]);
    }
  });

  // WHY `CHAT_COPY` AND `onboarding-chat-copy.ts` ARE NOT SWEPT HERE, and must not be added
  // without changing the patterns first.
  //
  // Both reviewers measured it: running the FULL set over them goes red on ten lines, every one
  // legitimate — `Giảm cân` and `Похудеть` are `options.lose.label`, the goal button, plus the
  // switch-goal lines and two citation strings. Vietnamese and Russian have no neutral/promissory
  // split for "lose weight"; it is the one word either language has. So those strings are exactly
  // where English's `lose weight` is: undecidable on a surface that carries the user's own goal,
  // which is why `ONBOARDING_CLAIM_RULES` exists at all.
  //
  // They are also CODE — reviewed in a pull request, not typed into a text box by an admin — so
  // the gate is not what stands between them and a user. Adding them to this sweep would force
  // the `weight-promise` patterns to be narrowed until they stopped catching a marketer, which is
  // the trade this file exists to refuse.

  it("passes the onboarding gate, in all eight, under the rules that surface opts into", () => {
    // NOT the full set: "Lose weight" is a goal a user picks and "Diabetes" is a restriction they
    // declare. `claims.ts` says why the narrower list exists, and this proves the narrowing holds
    // in every language rather than only in the one the rules were written for.
    for (const lang of LANGS) {
      const content = ONBOARDING_CONTENT[lang];
      if (!content) continue;
      const fields: Record<string, string> = {};
      const walk = (node: unknown, at: string): void => {
        if (typeof node === "string") { fields[at] = node; return; }
        if (typeof node !== "object" || node === null) return;
        for (const [k, v] of Object.entries(node)) walk(v, at === "" ? k : `${at}.${k}`);
      };
      walk(content, "");
      expect(lintCopy(fields, ["retired-no-email"]).map((v) => `${v.field}: ${v.span}`), lang)
        .toEqual([]);
    }
  });

  it("the W2 surface's own words pass the gate — the plan beats, the units word, the pace tail", () => {
    // The table's gate-shaped exceptions are the fields that quote the user (`options.lose`) and
    // the S6 plan headline; the copy the redesign ADDS is ordinary prose and must not grow one.
    for (const lang of LANGS) {
      const copy = chatCopyFor(lang);
      expect(lintCopy({
        "baseline.what": copy.baseline.what,
        "prelim.title": copy.prelim.title,
        "prelim.keepTitle": copy.prelim.keepTitle,
        "units.years": copy.units.years,
        "pace.rateSuffix": copy.pace.rateSuffix,
        "pace.echo": copy.pace.echo,
        // W3's chart words too — the accessible name is a template, and a claim in it reads the
        // same out loud as on the page.
        "chart.estimateAria": copy.chart.estimateAria,
        "chart.estimatedProgress": copy.chart.estimatedProgress,
        "chart.byEait": copy.chart.byEait,
      }).map((v) => `${v.field}: ${v.span}`), lang).toEqual([]);
    }
  });
});

// ── The one exemption (S6) ───────────────────────────────────────────────────────────────────
//
// "Goal: lose 6kg by January 2027" is drawn above the plan graph — the user's own stated goal,
// restated with the plan's own projection. `weight-promise` cannot tell it from a marketing
// claim, so `claims.ts` exempts exactly one field name, `CHAT_COPY.planGoal`, and these tests
// prove both halves: the key passes, and the same words anywhere else are still refused.

describe("the plan headline's claims exemption", () => {
  const SEP_24 = new Date("2026-09-24T12:00:00Z");
  const KEY = "CHAT_COPY.planGoal";

  /** The sentence the plan graph draws, filled the way `planHeadline` fills it (6kg ≈ 13lb). */
  const filled = (lang: (typeof LANGS)[number], units: "metric" | "imperial"): string =>
    chatCopyFor(lang).planGoal[units]
      .replace("{n}", units === "metric" ? "6" : "13")
      .replace("{month}", projectionMonth(SEP_24, 16, lang));

  it("passes under its own name, in all eight languages and both units", () => {
    for (const lang of LANGS) {
      for (const units of ["metric", "imperial"] as const) {
        expect(lintCopy({ [KEY]: filled(lang, units) }), `${lang}/${units}`).toEqual([]);
      }
    }
  });

  it("applies weight-promise alone — every other rule still reads the field", () => {
    expect(lintCopy({ [KEY]: "Goal: lose 6kg by January 2027, guaranteed results" })
      .map((v) => v.pattern)).toContain("guarantee");
  });

  it("refuses the same sentence under any other name — the landing, PAGE_COPY, notifications, WEB_COPY", () => {
    for (const lang of LANGS) {
      const sentence = filled(lang, "metric");
      // The sentence must BE a claim, or a pass under another name would prove nothing.
      expect(lintCopy({ anything: sentence }).map((v) => v.pattern), lang)
        .toContain("weight-promise");
      for (const field of [
        "PAGE_COPY.planHeading", "WEB_COPY.tagline", "notification.daily.title", "landing.hero",
      ]) {
        expect(lintCopy({ [field]: sentence }).map((v) => v.pattern), `${lang}:${field}`)
          .toContain("weight-promise");
      }
    }
    // Imperial too, where the word trips: English "lbs" is a banned unit word, "lb" is not one
    // the other languages' patterns read.
    expect(lintCopy({ "PAGE_COPY.planHeading": filled("en", "imperial") })
      .map((v) => v.pattern)).toContain("weight-promise");
  });

  it("pins who may publish it — the gate reads strings, not call sites", () => {
    // lintCopy cannot see WHICH surface renders the sentence; decision 4 allows the onboarding
    // plan screen alone. So the non-test files that call `planHeadline` or read `planGoal` are
    // enumerated here: today the helper's own module only, and W3's /start plan renderer adds
    // itself to this list in its own PR. A file joining this list that is not the plan screen is
    // a promise being published where it was not approved — this test, not the gate, sees it.
    const root = join(import.meta.dir, "..", "..");
    const SKIP_DIRS = new Set([".git", "node_modules", "dist"]);
    const callers: string[] = [];
    const walk = (dir: string): void => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (e.isDirectory()) {
          if (!SKIP_DIRS.has(e.name)) walk(join(dir, e.name));
          continue;
        }
        if (!e.name.endsWith(".ts") || e.name.endsWith(".test.ts") || e.name.endsWith(".pw.ts")) continue;
        const file = join(dir, e.name);
        const src = readFileSync(file, "utf8");
        // `"CHAT_COPY.planGoal"` is the exemption NAMING the key, not a read of it — the lookbehind
        // keeps `claims.ts` itself out of a list about callers.
        if (/\bplanHeadline\s*\(/.test(src) || /(?<!CHAT_COPY)\.planGoal\b/.test(src)) {
          callers.push(relative(root, file));
        }
      }
    };
    walk(root);
    expect(callers.sort()).toEqual([
      "src/shared/onboarding-chat.ts",
    ]);
  });

  it("sweeps the key's own templates with every rule except the one it is exempt from", () => {
    // Under the qualified name the exemption applies, so what runs here is the full set minus
    // `weight-promise` — which is what makes a guarantee or a detox in a translation still fail.
    for (const lang of LANGS) {
      const key = chatCopyFor(lang).planGoal;
      expect(lintCopy({ [KEY]: key.metric }), `${lang}.metric`).toEqual([]);
      expect(lintCopy({ [KEY]: key.imperial }), `${lang}.imperial`).toEqual([]);
    }
  });
});
