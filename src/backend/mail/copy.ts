// The sign-in mail's words, in every language the product speaks.
//
// A `Localized` table like every other copy table, registered in `copy.i18n.test.ts` — the mail
// is a user-facing surface even though it leaves the building. Each language's body is ONE
// template with `{code}` inside it, never a code spliced between sentences, for the reason
// `shared/AGENTS.md` states: a translator moves a placeholder, never a rule.

import { t, type Lang, type Localized } from "@eait/shared";

export interface MailCopy {
  /** The subject. `{code}` inside it — it is the one line a lock screen shows. */
  subject: string;
  /** The whole plain-text body: the code, the ten minutes, and "ignore it if it wasn't you". */
  text: string;
  /**
   * The whole minimal-HTML body, same placeholders. "Minimal" means a code the size a person can
   * read off a watch and no chrome: a sign-in mail is glanced at, not browsed.
   */
  html: string;
}

export const MAIL_COPY: Localized<MailCopy> = {
  en: {
    subject: "{code} is your eait sign-in code",
    text: "Your eait sign-in code is {code}.\n\nIt works for 10 minutes.\n\nIf you didn't ask for this email, ignore it.",
    html: "<p>Your eait sign-in code:</p><p style=\"font-size:32px;font-weight:700;letter-spacing:6px\">{code}</p><p>It works for 10 minutes.</p><p>If you didn't ask for this email, ignore it.</p>",
  },
  fr: {
    subject: "{code} est ton code de connexion eait",
    text: "Ton code de connexion eait est {code}.\n\nIl fonctionne pendant 10 minutes.\n\nSi tu n'as pas demandé cet e-mail, ignore-le.",
    html: "<p>Ton code de connexion eait :</p><p style=\"font-size:32px;font-weight:700;letter-spacing:6px\">{code}</p><p>Il fonctionne pendant 10 minutes.</p><p>Si tu n'as pas demandé cet e-mail, ignore-le.</p>",
  },
  de: {
    subject: "{code} ist dein eait-Anmeldecode",
    text: "Dein eait-Anmeldecode ist {code}.\n\nEr ist 10 Minuten gültig.\n\nWenn du diese E-Mail nicht angefordert hast, ignoriere sie.",
    html: "<p>Dein eait-Anmeldecode:</p><p style=\"font-size:32px;font-weight:700;letter-spacing:6px\">{code}</p><p>Er ist 10 Minuten gültig.</p><p>Wenn du diese E-Mail nicht angefordert hast, ignoriere sie.</p>",
  },
  it: {
    subject: "{code} è il tuo codice di accesso eait",
    text: "Il tuo codice di accesso eait è {code}.\n\nFunziona per 10 minuti.\n\nSe non hai richiesto questa email, ignorala.",
    html: "<p>Il tuo codice di accesso eait:</p><p style=\"font-size:32px;font-weight:700;letter-spacing:6px\">{code}</p><p>Funziona per 10 minuti.</p><p>Se non hai richiesto questa email, ignorala.</p>",
  },
  es: {
    subject: "{code} es tu código de acceso a eait",
    text: "Tu código de acceso a eait es {code}.\n\nFunciona durante 10 minutos.\n\nSi no has pedido este correo, ignóralo.",
    html: "<p>Tu código de acceso a eait:</p><p style=\"font-size:32px;font-weight:700;letter-spacing:6px\">{code}</p><p>Funciona durante 10 minutos.</p><p>Si no has pedido este correo, ignóralo.</p>",
  },
  vi: {
    subject: "{code} là mã đăng nhập eait của bạn",
    text: "Mã đăng nhập eait của bạn là {code}.\n\nMã có hiệu lực trong 10 phút.\n\nNếu bạn không yêu cầu email này, hãy bỏ qua nó.",
    html: "<p>Mã đăng nhập eait của bạn:</p><p style=\"font-size:32px;font-weight:700;letter-spacing:6px\">{code}</p><p>Mã có hiệu lực trong 10 phút.</p><p>Nếu bạn không yêu cầu email này, hãy bỏ qua nó.</p>",
  },
  id: {
    subject: "{code} adalah kode masuk eait-mu",
    text: "Kode masuk eait-mu adalah {code}.\n\nKode ini berlaku selama 10 menit.\n\nKalau kamu tidak meminta email ini, abaikan saja.",
    html: "<p>Kode masuk eait-mu:</p><p style=\"font-size:32px;font-weight:700;letter-spacing:6px\">{code}</p><p>Kode ini berlaku selama 10 menit.</p><p>Kalau kamu tidak meminta email ini, abaikan saja.</p>",
  },
  ru: {
    subject: "{code} — твой код для входа в eait",
    text: "Твой код для входа в eait: {code}.\n\nОн действует 10 минут.\n\nЕсли письмо пришло по ошибке, просто удали его.",
    html: "<p>Твой код для входа в eait:</p><p style=\"font-size:32px;font-weight:700;letter-spacing:6px\">{code}</p><p>Он действует 10 минут.</p><p>Если письмо пришло по ошибке, просто удали его.</p>",
  },
  te: {
    subject: "{code} మీ eait సైన్-ఇన్ కోడ్",
    text: "మీ eait సైన్-ఇన్ కోడ్: {code}.\n\nఇది 10 నిమిషాల పాటు పనిచేస్తుంది.\n\nమీరు ఈ ఈమెయిల్‌ను అడగకపోతే, దీన్ని పట్టించుకోకండి.",
    html: "<p>మీ eait సైన్-ఇన్ కోడ్:</p><p style=\"font-size:32px;font-weight:700;letter-spacing:6px\">{code}</p><p>ఇది 10 నిమిషాల పాటు పనిచేస్తుంది.</p><p>మీరు ఈ ఈమెయిల్‌ను అడగకపోతే, దీన్ని పట్టించుకోకండి.</p>",
  },
  ta: {
    subject: "{code} — உங்கள் eait உள்நுழைவுக் குறியீடு",
    text: "உங்கள் eait உள்நுழைவுக் குறியீடு: {code}.\n\nஇது 10 நிமிடங்கள் செல்லுபடியாகும்.\n\nஇந்த மின்னஞ்சலை நீங்கள் கோரவில்லை என்றால், இதைப் புறக்கணிக்கவும்.",
    html: "<p>உங்கள் eait உள்நுழைவுக் குறியீடு:</p><p style=\"font-size:32px;font-weight:700;letter-spacing:6px\">{code}</p><p>இது 10 நிமிடங்கள் செல்லுபடியாகும்.</p><p>இந்த மின்னஞ்சலை நீங்கள் கோரவில்லை என்றால், இதைப் புறக்கணிக்கவும்.</p>",
  },
  pa: {
    subject: "{code} ਤੁਹਾਡਾ eait ਸਾਈਨ-ਇਨ ਕੋਡ ਹੈ",
    text: "ਤੁਹਾਡਾ eait ਸਾਈਨ-ਇਨ ਕੋਡ {code} ਹੈ।\n\nਇਹ 10 ਮਿੰਟ ਤੱਕ ਕੰਮ ਕਰਦਾ ਹੈ।\n\nਜੇ ਤੁਸੀਂ ਇਹ ਈਮੇਲ ਨਹੀਂ ਮੰਗੀ ਸੀ, ਤਾਂ ਇਸ ਨੂੰ ਅਣਡਿੱਠਾ ਕਰੋ।",
    html: "<p>ਤੁਹਾਡਾ eait ਸਾਈਨ-ਇਨ ਕੋਡ:</p><p style=\"font-size:32px;font-weight:700;letter-spacing:6px\">{code}</p><p>ਇਹ 10 ਮਿੰਟ ਤੱਕ ਕੰਮ ਕਰਦਾ ਹੈ।</p><p>ਜੇ ਤੁਸੀਂ ਇਹ ਈਮੇਲ ਨਹੀਂ ਮੰਗੀ ਸੀ, ਤਾਂ ਇਸ ਨੂੰ ਅਣਡਿੱਠਾ ਕਰੋ।</p>",
  },
  or: {
    subject: "{code} ହେଉଛି ଆପଣଙ୍କ eait ସାଇନ୍-ଇନ୍ କୋଡ୍",
    text: "ଆପଣଙ୍କ eait ସାଇନ୍-ଇନ୍ କୋଡ୍ ହେଉଛି {code}।\n\nଏହା 10 ମିନିଟ୍ ପର୍ଯ୍ୟନ୍ତ କାମ କରେ।\n\nଯଦି ଆପଣ ଏହି ଇମେଲ୍ ମାଗି ନାହାନ୍ତି, ତେବେ ଏହାକୁ ଅଣଦେଖା କରନ୍ତୁ।",
    html: "<p>ଆପଣଙ୍କ eait ସାଇନ୍-ଇନ୍ କୋଡ୍:</p><p style=\"font-size:32px;font-weight:700;letter-spacing:6px\">{code}</p><p>ଏହା 10 ମିନିଟ୍ ପର୍ଯ୍ୟନ୍ତ କାମ କରେ।</p><p>ଯଦି ଆପଣ ଏହି ଇମେଲ୍ ମାଗି ନାହାନ୍ତି, ତେବେ ଏହାକୁ ଅଣଦେଖା କରନ୍ତୁ।</p>",
  },
  mr: {
    subject: "{code} हा तुमचा eait साइन-इन कोड आहे",
    text: "तुमचा eait साइन-इन कोड {code} आहे.\n\nतो 10 मिनिटे चालेल.\n\nहा ईमेल तुम्ही मागितला नसेल, तर त्याकडे दुर्लक्ष करा.",
    html: "<p>तुमचा eait साइन-इन कोड:</p><p style=\"font-size:32px;font-weight:700;letter-spacing:6px\">{code}</p><p>तो 10 मिनिटे चालेल.</p><p>हा ईमेल तुम्ही मागितला नसेल, तर त्याकडे दुर्लक्ष करा.</p>",
  },
  ml: {
    subject: "{code} ആണ് നിങ്ങളുടെ eait സൈൻ ഇൻ കോഡ്",
    text: "നിങ്ങളുടെ eait സൈൻ ഇൻ കോഡ്: {code}.\n\n10 മിനിറ്റ് വരെ ഇത് പ്രവർത്തിക്കും.\n\nഈ ഇമെയിൽ നിങ്ങൾ ആവശ്യപ്പെട്ടതല്ലെങ്കിൽ, അവഗണിക്കൂ.",
    html: "<p>നിങ്ങളുടെ eait സൈൻ ഇൻ കോഡ്:</p><p style=\"font-size:32px;font-weight:700;letter-spacing:6px\">{code}</p><p>10 മിനിറ്റ് വരെ ഇത് പ്രവർത്തിക്കും.</p><p>ഈ ഇമെയിൽ നിങ്ങൾ ആവശ്യപ്പെട്ടതല്ലെങ്കിൽ, അവഗണിക്കൂ.</p>",
  },
  kn: {
    subject: "{code} ನಿಮ್ಮ eait ಸೈನ್ ಇನ್ ಕೋಡ್",
    text: "ನಿಮ್ಮ eait ಸೈನ್ ಇನ್ ಕೋಡ್ {code}.\n\nಇದು 10 ನಿಮಿಷ ಮಾನ್ಯವಾಗಿರುತ್ತದೆ.\n\nನೀವು ಈ ಇಮೇಲ್ ಕೇಳದಿದ್ದರೆ, ಇದನ್ನು ನಿರ್ಲಕ್ಷಿಸಿ.",
    html: "<p>ನಿಮ್ಮ eait ಸೈನ್ ಇನ್ ಕೋಡ್:</p><p style=\"font-size:32px;font-weight:700;letter-spacing:6px\">{code}</p><p>ಇದು 10 ನಿಮಿಷ ಮಾನ್ಯವಾಗಿರುತ್ತದೆ.</p><p>ನೀವು ಈ ಇಮೇಲ್ ಕೇಳದಿದ್ದರೆ, ಇದನ್ನು ನಿರ್ಲಕ್ಷಿಸಿ.</p>",
  },
  gu: {
    subject: "{code} તમારો eait સાઇન-ઇન કોડ છે",
    text: "તમારો eait સાઇન-ઇન કોડ {code} છે.\n\nતે 10 મિનિટ સુધી કામ કરે છે.\n\nજો તમે આ ઇમેઇલ માંગ્યો ન હોય, તો તેને અવગણો.",
    html: "<p>તમારો eait સાઇન-ઇન કોડ:</p><p style=\"font-size:32px;font-weight:700;letter-spacing:6px\">{code}</p><p>તે 10 મિનિટ સુધી કામ કરે છે.</p><p>જો તમે આ ઇમેઇલ માંગ્યો ન હોય, તો તેને અવગણો.</p>",
  },
  bn: {
    subject: "{code} আপনার eait সাইন-ইন কোড",
    text: "আপনার eait সাইন-ইন কোড {code}।\n\nএটি 10 মিনিট কাজ করবে।\n\nআপনি এই ইমেইল না চেয়ে থাকলে এটি উপেক্ষা করুন।",
    html: "<p>আপনার eait সাইন-ইন কোড:</p><p style=\"font-size:32px;font-weight:700;letter-spacing:6px\">{code}</p><p>এটি 10 মিনিট কাজ করবে।</p><p>আপনি এই ইমেইল না চেয়ে থাকলে এটি উপেক্ষা করুন।</p>",
  },
  "pt-PT": {
    subject: "{code} é o teu código de início de sessão do eait",
    text: "O teu código de início de sessão do eait é {code}.\n\nÉ válido durante 10 minutos.\n\nSe não pediste este e-mail, ignora-o.",
    html: "<p>O teu código de início de sessão do eait:</p><p style=\"font-size:32px;font-weight:700;letter-spacing:6px\">{code}</p><p>É válido durante 10 minutos.</p><p>Se não pediste este e-mail, ignora-o.</p>",
  },
  ms: {
    subject: "{code} ialah kod daftar masuk eait anda",
    text: "Kod daftar masuk eait anda ialah {code}.\n\nIa sah selama 10 minit.\n\nJika anda tidak meminta e-mel ini, abaikannya.",
    html: "<p>Kod daftar masuk eait anda:</p><p style=\"font-size:32px;font-weight:700;letter-spacing:6px\">{code}</p><p>Ia sah selama 10 minit.</p><p>Jika anda tidak meminta e-mel ini, abaikannya.</p>",
  },
  ca: {
    subject: "{code} és el teu codi d'inici de sessió d'eait",
    text: "El teu codi d'inici de sessió d'eait és {code}.\n\nFunciona durant 10 minuts.\n\nSi no has demanat aquest correu, ignora'l.",
    html: "<p>El teu codi d'inici de sessió d'eait:</p><p style=\"font-size:32px;font-weight:700;letter-spacing:6px\">{code}</p><p>Funciona durant 10 minuts.</p><p>Si no has demanat aquest correu, ignora'l.</p>",
  },
  sl: {
    subject: "{code} je tvoja koda za prijavo v eait",
    text: "Tvoja koda za prijavo v eait je {code}.\n\nVelja 10 minut.\n\nČe to e-sporočilo ni namenjeno tebi, ga prezri.",
    html: "<p>Tvoja koda za prijavo v eait:</p><p style=\"font-size:32px;font-weight:700;letter-spacing:6px\">{code}</p><p>Velja 10 minut.</p><p>Če to e-sporočilo ni namenjeno tebi, ga prezri.</p>",
  },
  hr: {
    subject: "{code} je tvoj kod za prijavu u eait",
    text: "Tvoj kod za prijavu u eait je {code}.\n\nVrijedi 10 minuta.\n\nAko ova poruka nije zatražena, zanemari je.",
    html: "<p>Tvoj kod za prijavu u eait:</p><p style=\"font-size:32px;font-weight:700;letter-spacing:6px\">{code}</p><p>Vrijedi 10 minuta.</p><p>Ako ova poruka nije zatražena, zanemari je.</p>",
  },
  sk: {
    subject: "{code} je tvoj prihlasovací kód do eait",
    text: "Tvoj prihlasovací kód do eait je {code}.\n\nPlatí 10 minút.\n\nAk tento e-mail nečakáš, ignoruj ho.",
    html: "<p>Tvoj prihlasovací kód do eait:</p><p style=\"font-size:32px;font-weight:700;letter-spacing:6px\">{code}</p><p>Platí 10 minút.</p><p>Ak tento e-mail nečakáš, ignoruj ho.</p>",
  },
  no: {
    subject: "{code} er påloggingskoden din for eait",
    text: "Påloggingskoden din for eait er {code}.\n\nDen virker i 10 minutter.\n\nHvis du ikke ba om denne e-posten, kan du se bort fra den.",
    html: "<p>Påloggingskoden din for eait:</p><p style=\"font-size:32px;font-weight:700;letter-spacing:6px\">{code}</p><p>Den virker i 10 minutter.</p><p>Hvis du ikke ba om denne e-posten, kan du se bort fra den.</p>",
  },
  fi: {
    subject: "{code} on eait-kirjautumiskoodisi",
    text: "eait-kirjautumiskoodisi on {code}.\n\nSe on voimassa 10 minuuttia.\n\nJos et pyytänyt tätä sähköpostia, voit jättää sen huomiotta.",
    html: "<p>eait-kirjautumiskoodisi:</p><p style=\"font-size:32px;font-weight:700;letter-spacing:6px\">{code}</p><p>Se on voimassa 10 minuuttia.</p><p>Jos et pyytänyt tätä sähköpostia, voit jättää sen huomiotta.</p>",
  },
  da: {
    subject: "{code} er din loginkode til eait",
    text: "Din loginkode til eait er {code}.\n\nDen virker i 10 minutter.\n\nHvis du ikke har bedt om denne e-mail, kan du ignorere den.",
    html: "<p>Din loginkode til eait:</p><p style=\"font-size:32px;font-weight:700;letter-spacing:6px\">{code}</p><p>Den virker i 10 minutter.</p><p>Hvis du ikke har bedt om denne e-mail, kan du ignorere den.</p>",
  },
  hu: {
    subject: "{code} – az eait bejelentkezési kódod",
    text: "Az eait bejelentkezési kódod: {code}.\n\n10 percig érvényes.\n\nHa nem te kérted ezt az e-mailt, hagyd figyelmen kívül.",
    html: "<p>Az eait bejelentkezési kódod:</p><p style=\"font-size:32px;font-weight:700;letter-spacing:6px\">{code}</p><p>10 percig érvényes.</p><p>Ha nem te kérted ezt az e-mailt, hagyd figyelmen kívül.</p>",
  },
  el: {
    subject: "{code}: ο κωδικός σύνδεσής σου στο eait",
    text: "Ο κωδικός σύνδεσής σου στο eait είναι {code}.\n\nΙσχύει για 10 λεπτά.\n\nΑν δεν ζήτησες αυτό το email, αγνόησέ το.",
    html: "<p>Ο κωδικός σύνδεσής σου στο eait:</p><p style=\"font-size:32px;font-weight:700;letter-spacing:6px\">{code}</p><p>Ισχύει για 10 λεπτά.</p><p>Αν δεν ζήτησες αυτό το email, αγνόησέ το.</p>",
  },
  ro: {
    subject: "{code} este codul tău de conectare eait",
    text: "Codul tău de conectare eait este {code}.\n\nE valabil 10 minute.\n\nDacă nu ai cerut acest e-mail, ignoră-l.",
    html: "<p>Codul tău de conectare eait:</p><p style=\"font-size:32px;font-weight:700;letter-spacing:6px\">{code}</p><p>E valabil 10 minute.</p><p>Dacă nu ai cerut acest e-mail, ignoră-l.</p>",
  },
  cs: {
    subject: "{code} je tvůj přihlašovací kód do eait",
    text: "Tvůj přihlašovací kód do eait je {code}.\n\nPlatí 10 minut.\n\nPokud tento e-mail nečekáš, ignoruj ho.",
    html: "<p>Tvůj přihlašovací kód do eait:</p><p style=\"font-size:32px;font-weight:700;letter-spacing:6px\">{code}</p><p>Platí 10 minut.</p><p>Pokud tento e-mail nečekáš, ignoruj ho.</p>",
  },
  hi: {
    subject: "{code} आपका eait साइन-इन कोड है",
    text: "आपका eait साइन-इन कोड {code} है।\n\nयह 10 मिनट तक काम करता है।\n\nअगर आपने यह ईमेल नहीं माँगा था, तो इसे अनदेखा करें।",
    html: "<p>आपका eait साइन-इन कोड:</p><p style=\"font-size:32px;font-weight:700;letter-spacing:6px\">{code}</p><p>यह 10 मिनट तक काम करता है।</p><p>अगर आपने यह ईमेल नहीं माँगा था, तो इसे अनदेखा करें।</p>",
  },
  th: {
    subject: "{code} คือรหัสลงชื่อเข้าใช้ eait ของคุณ",
    text: "รหัสลงชื่อเข้าใช้ eait ของคุณคือ {code}\n\nรหัสใช้ได้ 10 นาที\n\nหากคุณไม่ได้ขออีเมลนี้ ไม่ต้องสนใจ",
    html: "<p>รหัสลงชื่อเข้าใช้ eait ของคุณ:</p><p style=\"font-size:32px;font-weight:700;letter-spacing:6px\">{code}</p><p>รหัสใช้ได้ 10 นาที</p><p>หากคุณไม่ได้ขออีเมลนี้ ไม่ต้องสนใจ</p>",
  },
  sv: {
    subject: "{code} är din inloggningskod för eait",
    text: "Din inloggningskod för eait är {code}.\n\nDen gäller i 10 minuter.\n\nOm du inte bad om det här mejlet kan du ignorera det.",
    html: "<p>Din inloggningskod för eait:</p><p style=\"font-size:32px;font-weight:700;letter-spacing:6px\">{code}</p><p>Den gäller i 10 minuter.</p><p>Om du inte bad om det här mejlet kan du ignorera det.</p>",
  },
  uk: {
    subject: "{code} — твій код для входу в eait",
    text: "Твій код для входу в eait: {code}.\n\nВін діє 10 хвилин.\n\nЯкщо цей лист прийшов помилково, просто проігноруй його.",
    html: "<p>Твій код для входу в eait:</p><p style=\"font-size:32px;font-weight:700;letter-spacing:6px\">{code}</p><p>Він діє 10 хвилин.</p><p>Якщо цей лист прийшов помилково, просто проігноруй його.</p>",
  },
  nl: {
    subject: "{code} is je inlogcode voor eait",
    text: "Je inlogcode voor eait is {code}.\n\nHij werkt 10 minuten.\n\nHeb je deze e-mail niet aangevraagd? Negeer hem dan.",
    html: "<p>Je inlogcode voor eait:</p><p style=\"font-size:32px;font-weight:700;letter-spacing:6px\">{code}</p><p>Hij werkt 10 minuten.</p><p>Heb je deze e-mail niet aangevraagd? Negeer hem dan.</p>",
  },
  pl: {
    subject: "{code} to twój kod logowania do eait",
    text: "Twój kod logowania do eait to {code}.\n\nDziała przez 10 minut.\n\nJeśli to nie ty o niego prosisz, zignoruj tę wiadomość.",
    html: "<p>Twój kod logowania do eait:</p><p style=\"font-size:32px;font-weight:700;letter-spacing:6px\">{code}</p><p>Działa przez 10 minut.</p><p>Jeśli to nie ty o niego prosisz, zignoruj tę wiadomość.</p>",
  },
  tr: {
    subject: "eait giriş kodun: {code}",
    text: "eait giriş kodun: {code}.\n\nKod 10 dakika geçerli.\n\nBu e-postayı sen istemediysen görmezden gel.",
    html: "<p>eait giriş kodun:</p><p style=\"font-size:32px;font-weight:700;letter-spacing:6px\">{code}</p><p>Kod 10 dakika geçerli.</p><p>Bu e-postayı sen istemediysen görmezden gel.</p>",
  },
  "zh-Hant": {
    subject: "{code} 是你的 eait 登入驗證碼",
    text: "你的 eait 登入驗證碼是 {code}。\n\n10 分鐘內有效。\n\n如果你沒有要求這封郵件，請忽略它。",
    html: "<p>你的 eait 登入驗證碼：</p><p style=\"font-size:32px;font-weight:700;letter-spacing:6px\">{code}</p><p>10 分鐘內有效。</p><p>如果你沒有要求這封郵件，請忽略它。</p>",
  },
  "zh-Hans": {
    subject: "{code} 是你的 eait 登录验证码",
    text: "你的 eait 登录验证码是 {code}。\n\n10 分钟内有效。\n\n如果你没有请求这封邮件，忽略即可。",
    html: "<p>你的 eait 登录验证码：</p><p style=\"font-size:32px;font-weight:700;letter-spacing:6px\">{code}</p><p>10 分钟内有效。</p><p>如果你没有请求这封邮件，忽略即可。</p>",
  },
  ko: {
    subject: "eait 로그인 코드: {code}",
    text: "eait 로그인 코드: {code}\n\n코드는 10분 동안 유효해요.\n\n이 이메일을 요청하지 않았다면 무시해 주세요.",
    html: "<p>eait 로그인 코드:</p><p style=\"font-size:32px;font-weight:700;letter-spacing:6px\">{code}</p><p>코드는 10분 동안 유효해요.</p><p>이 이메일을 요청하지 않았다면 무시해 주세요.</p>",
  },
  ja: {
    subject: "{code}はあなたのeaitサインインコードです",
    text: "eaitのサインインコードは{code}です。\n\n有効期限は10分です。\n\nこのメールに心当たりがない場合は、無視してください。",
    html: "<p>eaitのサインインコード：</p><p style=\"font-size:32px;font-weight:700;letter-spacing:6px\">{code}</p><p>有効期限は10分です。</p><p>このメールに心当たりがない場合は、無視してください。</p>",
  },
  "pt-BR": {
    subject: "{code} é seu código de login do eait",
    text: "Seu código de login do eait é {code}.\n\nEle vale por 10 minutos.\n\nSe você não pediu este e-mail, ignore-o.",
    html: "<p>Seu código de login do eait:</p><p style=\"font-size:32px;font-weight:700;letter-spacing:6px\">{code}</p><p>Ele vale por 10 minutos.</p><p>Se você não pediu este e-mail, ignore-o.</p>",
  },
};

export const mailCopyFor = (lang: Lang): MailCopy => t(lang)(MAIL_COPY);
