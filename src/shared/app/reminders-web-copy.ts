// The Profile reminders rows' words about the BROWSER half of the per-meal reminders
// (ieat-app#2149). The iPhone reminders are local notifications; the browser's are web push sent by
// the server, which needs this browser to be subscribed. Three sentences:
//   note   - shown once this browser IS subscribed: reminders reach the phone and the browser.
//   prompt - the line over the button, while it is not.
//   button - the button: asks the browser's permission, subscribes, turns Notifications on.
// A browser that has BLOCKED notifications reads `you.web.offInBrowser`, which already exists in
// every language, so there is no fourth string.
//
// EVERY LANGUAGE, ALWAYS: a `Record<Lang, ...>`, so `typecheck` names the language that lacks an
// entry. The words are drafts for the localizer pass (`~/eait-fleet/strings-2149.md`).

import type { Lang } from "../types.ts";

export interface RemindersWebCopy {
  note: string;
  prompt: string;
  button: string;
}

export const REMINDERS_WEB_COPY: Record<Lang, RemindersWebCopy> = {
  en: { note: "Reminders arrive on your iPhone and in this browser.", prompt: "Get these reminders in this browser", button: "Turn on notifications" },
  fr: { note: "Les rappels arrivent sur ton iPhone et dans ce navigateur.", prompt: "Recevoir ces rappels dans ce navigateur", button: "Activer les notifications" },
  de: { note: "Erinnerungen kommen auf deinem iPhone und in diesem Browser an.", prompt: "Diese Erinnerungen in diesem Browser erhalten", button: "Benachrichtigungen aktivieren" },
  it: { note: "I promemoria arrivano sul tuo iPhone e in questo browser.", prompt: "Ricevi questi promemoria in questo browser", button: "Attiva le notifiche" },
  es: { note: "Los recordatorios llegan a tu iPhone y a este navegador.", prompt: "Recibe estos recordatorios en este navegador", button: "Activar notificaciones" },
  vi: { note: "Lời nhắc sẽ được gửi đến iPhone của bạn và trình duyệt này.", prompt: "Nhận các lời nhắc này trên trình duyệt này", button: "Bật thông báo" },
  id: { note: "Pengingat masuk ke iPhone-mu dan browser ini.", prompt: "Terima pengingat ini di browser ini", button: "Aktifkan notifikasi" },
  ru: { note: "Напоминания приходят на твой iPhone и в этот браузер.", prompt: "Получать эти напоминания в браузере", button: "Включить уведомления" },
  "pt-BR": { note: "Os lembretes chegam ao seu iPhone e a este navegador.", prompt: "Receber estes lembretes neste navegador", button: "Ativar notificações" },
  ja: { note: "リマインダーはiPhoneとこのブラウザに届きます。", prompt: "このブラウザでリマインダーを受け取る", button: "通知をオンにする" },
  ko: { note: "리마인더가 iPhone과 이 브라우저로 와요.", prompt: "이 브라우저에서도 리마인더 받기", button: "알림 켜기" },
  "zh-Hans": { note: "提醒会发送到你的 iPhone 和此浏览器。", prompt: "在此浏览器中接收这些提醒", button: "开启通知" },
  "zh-Hant": { note: "提醒會傳送到你的 iPhone 和此瀏覽器。", prompt: "在此瀏覽器中接收這些提醒", button: "開啟通知" },
  tr: { note: "Hatırlatmalar iPhone'una ve bu tarayıcıya gelir.", prompt: "Bu hatırlatmaları bu tarayıcıda al", button: "Bildirimleri aç" },
  pl: { note: "Przypomnienia przychodzą na iPhone'a i do tej przeglądarki.", prompt: "Otrzymuj te przypomnienia w tej przeglądarce", button: "Włącz powiadomienia" },
  nl: { note: "Herinneringen komen aan op je iPhone en in deze browser.", prompt: "Ontvang deze herinneringen in deze browser", button: "Meldingen aanzetten" },
  uk: { note: "Нагадування приходять на твій iPhone і в цей браузер.", prompt: "Отримувати ці нагадування в браузері", button: "Увімкнути сповіщення" },
  sv: { note: "Påminnelserna kommer på din iPhone och i den här webbläsaren.", prompt: "Få de här påminnelserna i webbläsaren", button: "Slå på notiser" },
  th: { note: "การแจ้งเตือนจะส่งไปที่ iPhone ของคุณและเบราว์เซอร์นี้", prompt: "รับการเตือนเหล่านี้ในเบราว์เซอร์นี้", button: "เปิดการแจ้งเตือน" },
  hi: { note: "रिमाइंडर आपके iPhone और इस ब्राउज़र में आते हैं।", prompt: "ये रिमाइंडर इस ब्राउज़र में पाएँ", button: "सूचनाएँ चालू करें" },
  cs: { note: "Připomenutí chodí na tvůj iPhone i do tohoto prohlížeče.", prompt: "Dostávat tato připomenutí v tomto prohlížeči", button: "Zapnout oznámení" },
  ro: { note: "Mementourile ajung pe iPhone-ul tău și în acest browser.", prompt: "Primește aceste mementouri în acest browser", button: "Activează notificările" },
  el: { note: "Οι υπενθυμίσεις φτάνουν στο iPhone σου και σε αυτό το πρόγραμμα περιήγησης.", prompt: "Λάβε αυτές τις υπενθυμίσεις σε αυτό το πρόγραμμα περιήγησης", button: "Ενεργοποίηση ειδοποιήσεων" },
  hu: { note: "Az emlékeztetők az iPhone-odra és ebbe a böngészőbe érkeznek.", prompt: "Kapd meg ezeket az emlékeztetőket ebben a böngészőben", button: "Értesítések bekapcsolása" },
  da: { note: "Påmindelserne kommer på din iPhone og i denne browser.", prompt: "Få disse påmindelser i denne browser", button: "Slå notifikationer til" },
  fi: { note: "Muistutukset tulevat iPhoneesi ja tähän selaimeen.", prompt: "Saa nämä muistutukset tässä selaimessa", button: "Ota ilmoitukset käyttöön" },
  no: { note: "Påminnelsene kommer på iPhonen din og i denne nettleseren.", prompt: "Få disse påminnelsene i denne nettleseren", button: "Slå på varslinger" },
  sk: { note: "Pripomienky chodia na tvoj iPhone aj do tohto prehliadača.", prompt: "Dostávať tieto pripomienky v tomto prehliadači", button: "Zapnúť upozornenia" },
  hr: { note: "Podsjetnici stižu na tvoj iPhone i u ovaj preglednik.", prompt: "Primaj ove podsjetnike u ovom pregledniku", button: "Uključi obavijesti" },
  sl: { note: "Opomniki prispejo na tvoj iPhone in v ta brskalnik.", prompt: "Prejemaj te opomnike v tem brskalniku", button: "Vklopi obvestila" },
  ca: { note: "Els recordatoris arriben al teu iPhone i a aquest navegador.", prompt: "Rep aquests recordatoris en aquest navegador", button: "Activa les notificacions" },
  ms: { note: "Peringatan dihantar ke iPhone anda dan pelayar ini.", prompt: "Terima peringatan ini dalam pelayar ini", button: "Hidupkan pemberitahuan" },
  "pt-PT": { note: "Os lembretes chegam ao teu iPhone e a este navegador.", prompt: "Receber estes lembretes neste navegador", button: "Ativar notificações" },
  bn: { note: "রিমাইন্ডার আপনার iPhone-এ এবং এই ব্রাউজারে আসে।", prompt: "এই ব্রাউজারে এই রিমাইন্ডার পান", button: "বিজ্ঞপ্তি চালু করুন" },
  gu: { note: "રિમાઇન્ડર તમારા iPhone પર અને આ બ્રાઉઝરમાં આવે છે.", prompt: "આ રિમાઇન્ડર આ બ્રાઉઝરમાં મેળવો", button: "સૂચનાઓ ચાલુ કરો" },
  kn: { note: "ರಿಮೈಂಡರ್‌ಗಳು ನಿಮ್ಮ iPhone ಮತ್ತು ಈ ಬ್ರೌಸರ್‌ಗೆ ಬರುತ್ತವೆ.", prompt: "ಈ ರಿಮೈಂಡರ್‌ಗಳನ್ನು ಈ ಬ್ರೌಸರ್‌ನಲ್ಲಿ ಪಡೆಯಿರಿ", button: "ಅಧಿಸೂಚನೆಗಳನ್ನು ಆನ್ ಮಾಡಿ" },
  ml: { note: "റിമൈൻഡറുകൾ നിങ്ങളുടെ iPhone-ലും ഈ ബ്രൗസറിലും എത്തും.", prompt: "ഈ റിമൈൻഡറുകൾ ഈ ബ്രൗസറിൽ നേടുക", button: "അറിയിപ്പുകൾ ഓണാക്കുക" },
  mr: { note: "रिमाइंडर तुमच्या iPhone वर आणि या ब्राउझरमध्ये येतात.", prompt: "हे रिमाइंडर या ब्राउझरमध्ये मिळवा", button: "सूचना चालू करा" },
  or: { note: "ରିମାଇଣ୍ଡର୍ ଆପଣଙ୍କ iPhone ଓ ଏହି ବ୍ରାଉଜରରେ ଆସେ।", prompt: "ଏହି ରିମାଇଣ୍ଡର୍ ଏହି ବ୍ରାଉଜରରେ ପାଆନ୍ତୁ", button: "ବିଜ୍ଞପ୍ତି ଚାଲୁ କରନ୍ତୁ" },
  pa: { note: "ਰੀਮਾਈਂਡਰ ਤੁਹਾਡੇ iPhone ਅਤੇ ਇਸ ਬ੍ਰਾਊਜ਼ਰ ਵਿੱਚ ਆਉਂਦੇ ਹਨ।", prompt: "ਇਹ ਰੀਮਾਈਂਡਰ ਇਸ ਬ੍ਰਾਊਜ਼ਰ ਵਿੱਚ ਪਾਓ", button: "ਸੂਚਨਾਵਾਂ ਚਾਲੂ ਕਰੋ" },
  ta: { note: "நினைவூட்டல்கள் உங்கள் iPhone-க்கும் இந்த உலாவிக்கும் வரும்.", prompt: "இந்த நினைவூட்டல்களை இந்த உலாவியில் பெறுங்கள்", button: "அறிவிப்புகளை இயக்கவும்" },
  te: { note: "రిమైండర్‌లు మీ iPhoneకు మరియు ఈ బ్రౌజర్‌కు వస్తాయి.", prompt: "ఈ రిమైండర్‌లను ఈ బ్రౌజర్‌లో పొందండి", button: "నోటిఫికేషన్‌లను ఆన్ చేయండి" },
};

export const remindersWebCopyFor = (lang: Lang): RemindersWebCopy => REMINDERS_WEB_COPY[lang];
