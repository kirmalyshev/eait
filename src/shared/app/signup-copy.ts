// The welcome and sign-up screen's words (#110): the welcome's two doors, then the sign-up
// screen's headline, consent boxes and error. Moved out of `PAGE_COPY` (S8 put them in
// `src/backend/web/copy.ts`, which is backend-only) because the phone's sign-up — M3,
// ieat-app#922 — draws the same screen and would otherwise write its own eight-language copy.
// `chatRefusalIdentity` stays in `PAGE_COPY` — it is
// the chat surface's `identity-required` refusal, not a word this screen owns.

import { t, type Localized } from "../lang.ts";
import type { Lang } from "../types.ts";

export interface SignupCopy {
  /** The welcome's primary — into the questions, which is where the session account is born. */
  startCta: string;
  /** The welcome's secondary — for somebody whose account already exists. */
  haveAccountCta: string;
  /** The sign-up screen's headline — the product's promise, said once. */
  signUpHeading: string;
  /** The heading when the person arrives from their plan (19, ieat-app#2050): "Save your progress". */
  saveHeading: string;
  /**
   * A provider button's label: "Continue with Apple", "Continue with Google". `{provider}`
   * holds the brand, because a language puts it where its grammar needs it — moved out of
   * `PAGE_COPY` for the phone, whose sign-up screen draws the same buttons (ieat-app#922).
   * Apple renders its own system label on iOS; only Google reads this there.
   */
  continueWith: string;
  /**
   * The third provider's label (#569): "Continue with email" — email is a WORD here, not a
   * brand, so it is its own translated key rather than `{provider}` filled with one.
   */
  continueEmail: string;
  /**
   * The required box's label. `{terms}` and `{privacy}` hold the two document names, so a
   * translation puts them wherever its grammar needs them rather than reordering a sentence that
   * was written in English.
   */
  termsLabel: string;
  /** The document names inside `termsLabel` — each links where the operator published it. */
  termsLink: string;
  privacyLink: string;
  /** The optional box. Unticked means nothing is recorded — the stamp is a date, not a boolean. */
  consentMarketing: string;
  /** What a sign-up POST without the terms tick comes back to. */
  errorTerms: string;
}

export const SIGNUP_COPY: Localized<SignupCopy> = {
  en: {
    startCta: "Build my plan",
    haveAccountCta: "I already have an account",
    continueWith: "Continue with {provider}",
    continueEmail: "Continue with email",
    signUpHeading: "Photograph what you eat, get an honest answer",
    saveHeading: "Save your progress",
    termsLabel: "I agree to eait's {terms} and {privacy}",
    termsLink: "Terms",
    privacyLink: "Privacy Policy",
    consentMarketing: "Send me tips and new features from eait",
    errorTerms: "Agree to the Terms and Privacy Policy to continue.",
  },
  fr: {
    startCta: "Créer mon plan",
    haveAccountCta: "J'ai déjà un compte",
    continueWith: "Continuer avec {provider}",
    continueEmail: "Continuer par e-mail",
    signUpHeading: "Photographie ce que tu manges, reçois une réponse honnête",
    saveHeading: "Sauvegarde ta progression",
    termsLabel: "J'accepte les {terms} et la {privacy} d'eait",
    termsLink: "Conditions",
    privacyLink: "Politique de confidentialité",
    consentMarketing: "Envoie-moi des conseils et les nouveautés d'eait",
    errorTerms: "Accepte les Conditions et la Politique de confidentialité pour continuer.",
  },
  de: {
    startCta: "Meinen Plan erstellen",
    haveAccountCta: "Ich habe schon ein Konto",
    continueWith: "Weiter mit {provider}",
    continueEmail: "Weiter per E-Mail",
    signUpHeading: "Fotografier, was du isst, und bekomm eine ehrliche Antwort",
    saveHeading: "Speichere deinen Fortschritt",
    termsLabel: "Ich stimme den {terms} und der {privacy} von eait zu",
    termsLink: "Nutzungsbedingungen",
    privacyLink: "Datenschutzerklärung",
    consentMarketing: "Schick mir Tipps und neue Funktionen von eait",
    errorTerms: "Stimm den Nutzungsbedingungen und der Datenschutzerklärung zu, um weiterzumachen.",
  },
  it: {
    startCta: "Crea il mio piano",
    haveAccountCta: "Ho già un account",
    continueWith: "Continua con {provider}",
    continueEmail: "Continua con l'email",
    signUpHeading: "Fotografa quello che mangi, ricevi una risposta onesta",
    saveHeading: "Salva i tuoi progressi",
    termsLabel: "Accetto i {terms} e l’{privacy} di eait",
    termsLink: "Termini",
    privacyLink: "Informativa sulla privacy",
    consentMarketing: "Inviami consigli e novità da eait",
    errorTerms: "Accetta i Termini e l'Informativa sulla privacy per continuare.",
  },
  es: {
    startCta: "Crear mi plan",
    haveAccountCta: "Ya tengo una cuenta",
    continueWith: "Continuar con {provider}",
    continueEmail: "Continuar con el correo",
    signUpHeading: "Fotografía lo que comes, recibe una respuesta honesta",
    saveHeading: "Guarda tu progreso",
    termsLabel: "Acepto los {terms} y la {privacy} de eait",
    termsLink: "Términos",
    privacyLink: "Política de privacidad",
    consentMarketing: "Envíame consejos y novedades de eait",
    errorTerms: "Acepta los Términos y la Política de privacidad para continuar.",
  },
  vi: {
    startCta: "Lập kế hoạch cho mình",
    haveAccountCta: "Mình đã có tài khoản",
    continueWith: "Tiếp tục với {provider}",
    continueEmail: "Tiếp tục bằng email",
    signUpHeading: "Chụp món bạn ăn, nhận câu trả lời thẳng thắn",
    saveHeading: "Lưu tiến trình của bạn",
    termsLabel: "Mình đồng ý với {terms} và {privacy} của eait",
    termsLink: "Điều khoản",
    privacyLink: "Chính sách quyền riêng tư",
    consentMarketing: "Gửi cho mình mẹo và tính năng mới từ eait",
    errorTerms: "Đồng ý với Điều khoản và Chính sách quyền riêng tư để tiếp tục.",
  },
  id: {
    startCta: "Buat rencanaku",
    haveAccountCta: "Aku sudah punya akun",
    continueWith: "Lanjutkan dengan {provider}",
    continueEmail: "Lanjutkan dengan email",
    signUpHeading: "Foto makananmu, dapatkan jawaban jujur",
    saveHeading: "Simpan progresmu",
    termsLabel: "Aku menyetujui {terms} dan {privacy} eait",
    termsLink: "Ketentuan",
    privacyLink: "Kebijakan Privasi",
    consentMarketing: "Kirimi aku tips dan fitur baru dari eait",
    errorTerms: "Setujui Ketentuan dan Kebijakan Privasi untuk melanjutkan.",
  },
  ru: {
    startCta: "Составить мой план",
    haveAccountCta: "У меня уже есть аккаунт",
    continueWith: "Продолжить через {provider}",
    continueEmail: "Продолжить через e-mail",
    signUpHeading: "Сфотографируй еду — получи честный ответ",
    saveHeading: "Сохрани свой прогресс",
    termsLabel: "Я принимаю {terms} и {privacy} eait",
    termsLink: "Условия",
    privacyLink: "Политику конфиденциальности",
    consentMarketing: "Присылать мне советы и новинки eait",
    errorTerms: "Чтобы продолжить, прими Условия и Политику конфиденциальности.",
  },
  hu: {
    startCta: "Kérem a tervemet",
    haveAccountCta: "Már van fiókom",
    continueWith: "Folytatás ezzel: {provider}",
    continueEmail: "Folytatás e-maillel",
    signUpHeading: "Fotózd le, amit eszel, és kapj őszinte választ",
    saveHeading: "Mentsd el a haladásodat",
    termsLabel: "Elfogadom az eait {terms} és {privacy}",
    termsLink: "Felhasználási feltételeit",
    privacyLink: "Adatvédelmi irányelveit",
    consentMarketing: "Kérek tippeket és újdonságokat az eait-től",
    errorTerms: "A folytatáshoz fogadd el a Felhasználási feltételeket és az Adatvédelmi irányelveket.",
  },
  el: {
    startCta: "Φτιάξε το πλάνο μου",
    haveAccountCta: "Έχω ήδη λογαριασμό",
    continueWith: "Συνέχεια με {provider}",
    continueEmail: "Συνέχεια με email",
    signUpHeading: "Φωτογράφισε ό,τι τρως, πάρε μια ειλικρινή απάντηση",
    saveHeading: "Αποθήκευσε την πρόοδό σου",
    termsLabel: "Αποδέχομαι τους {terms} και την {privacy} του eait",
    termsLink: "Όρους χρήσης",
    privacyLink: "Πολιτική απορρήτου",
    consentMarketing: "Στείλε μου συμβουλές και νέες λειτουργίες από το eait",
    errorTerms: "Αποδέξου τους Όρους χρήσης και την Πολιτική απορρήτου για να συνεχίσεις.",
  },
  ro: {
    startCta: "Construiește-mi planul",
    haveAccountCta: "Am deja un cont",
    continueWith: "Continuă cu {provider}",
    continueEmail: "Continuă cu e-mail",
    signUpHeading: "Fotografiază ce mănânci, primește un răspuns onest",
    saveHeading: "Salvează-ți progresul",
    termsLabel: "Sunt de acord cu {terms} și cu {privacy} eait",
    termsLink: "Termenii",
    privacyLink: "Politica de confidențialitate",
    consentMarketing: "Trimite-mi sfaturi și noutăți de la eait",
    errorTerms: "Acceptă Termenii și Politica de confidențialitate ca să continui.",
  },
  cs: {
    startCta: "Sestavit můj plán",
    haveAccountCta: "Už mám účet",
    continueWith: "Pokračovat přes {provider}",
    continueEmail: "Pokračovat přes e-mail",
    signUpHeading: "Vyfoť, co jíš, a dostaneš poctivou odpověď",
    saveHeading: "Ulož si svůj pokrok",
    termsLabel: "Souhlasím: {terms} a {privacy} eait",
    termsLink: "Podmínky",
    privacyLink: "Zásady ochrany osobních údajů",
    consentMarketing: "Chci dostávat tipy a novinky od eait",
    errorTerms: "Pro pokračování odsouhlas Podmínky a Zásady ochrany osobních údajů.",
  },
  hi: {
    startCta: "मेरा प्लान बनाएँ",
    haveAccountCta: "मेरा पहले से अकाउंट है",
    continueWith: "{provider} के साथ जारी रखें",
    continueEmail: "ईमेल के साथ जारी रखें",
    signUpHeading: "अपने खाने की फ़ोटो लें, ईमानदार जवाब पाएँ",
    saveHeading: "अपनी प्रगति सेव करें",
    termsLabel: "मैं eait की {terms} और {privacy} से सहमत हूँ",
    termsLink: "शर्तों",
    privacyLink: "गोपनीयता नीति",
    consentMarketing: "मुझे eait से सुझाव और नए फ़ीचर भेजें",
    errorTerms: "जारी रखने के लिए शर्तों और गोपनीयता नीति से सहमति दें।",
  },
  th: {
    startCta: "สร้างแผนของฉัน",
    haveAccountCta: "ฉันมีบัญชีอยู่แล้ว",
    continueWith: "ดำเนินการต่อด้วย {provider}",
    continueEmail: "ดำเนินการต่อด้วยอีเมล",
    signUpHeading: "ถ่ายรูปสิ่งที่คุณกิน แล้วรับคำตอบที่ตรงไปตรงมา",
    saveHeading: "บันทึกความคืบหน้าของคุณ",
    termsLabel: "ฉันยอมรับ{terms}และ{privacy}ของ eait",
    termsLink: "ข้อกำหนด",
    privacyLink: "นโยบายความเป็นส่วนตัว",
    consentMarketing: "ส่งเคล็ดลับและฟีเจอร์ใหม่จาก eait ให้ฉัน",
    errorTerms: "ยอมรับข้อกำหนดและนโยบายความเป็นส่วนตัวเพื่อดำเนินการต่อ",
  },
  sv: {
    startCta: "Bygg min plan",
    haveAccountCta: "Jag har redan ett konto",
    continueWith: "Fortsätt med {provider}",
    continueEmail: "Fortsätt med e-post",
    signUpHeading: "Fotografera det du äter, få ett ärligt svar",
    saveHeading: "Spara dina framsteg",
    termsLabel: "Jag godkänner eaits {terms} och {privacy}",
    termsLink: "Villkor",
    privacyLink: "Integritetspolicy",
    consentMarketing: "Skicka mig tips och nya funktioner från eait",
    errorTerms: "Godkänn villkoren och integritetspolicyn för att fortsätta.",
  },
  uk: {
    startCta: "Скласти мій план",
    haveAccountCta: "У мене вже є акаунт",
    continueWith: "Продовжити з {provider}",
    continueEmail: "Продовжити з е-поштою",
    signUpHeading: "Фотографуй, що їси, — отримуй чесну відповідь",
    saveHeading: "Збережи свій прогрес",
    termsLabel: "Я приймаю {terms} і {privacy} eait",
    termsLink: "Умови",
    privacyLink: "Політику конфіденційності",
    consentMarketing: "Надсилати мені поради та новинки eait",
    errorTerms: "Щоб продовжити, прийми Умови та Політику конфіденційності.",
  },
  nl: {
    startCta: "Maak mijn plan",
    haveAccountCta: "Ik heb al een account",
    continueWith: "Doorgaan met {provider}",
    continueEmail: "Doorgaan met e-mail",
    signUpHeading: "Fotografeer wat je eet, krijg een eerlijk antwoord",
    saveHeading: "Bewaar je voortgang",
    termsLabel: "Ik ga akkoord met de {terms} en het {privacy} van eait",
    termsLink: "Voorwaarden",
    privacyLink: "Privacybeleid",
    consentMarketing: "Stuur me tips en nieuwe functies van eait",
    errorTerms: "Ga akkoord met de Voorwaarden en het Privacybeleid om door te gaan.",
  },
  pl: {
    startCta: "Stwórz mój plan",
    haveAccountCta: "Mam już konto",
    continueWith: "Kontynuuj z {provider}",
    continueEmail: "Kontynuuj przez e-mail",
    signUpHeading: "Zrób zdjęcie tego, co jesz, i dostań rzetelną odpowiedź",
    saveHeading: "Zapisz swoje postępy",
    termsLabel: "Akceptuję zasady eait: {terms} i {privacy}",
    termsLink: "Regulamin",
    privacyLink: "Polityka prywatności",
    consentMarketing: "Wysyłaj mi wskazówki i nowości od eait",
    errorTerms: "Zaakceptuj Regulamin i Politykę prywatności, aby kontynuować.",
  },
  tr: {
    startCta: "Planımı oluştur",
    haveAccountCta: "Zaten bir hesabım var",
    continueWith: "{provider} ile devam et",
    continueEmail: "E-posta ile devam et",
    signUpHeading: "Yediğinin fotoğrafını çek, dürüst bir yanıt al",
    saveHeading: "İlerlemeni kaydet",
    termsLabel: "eait'in {terms} ve {privacy} metinlerini kabul ediyorum",
    termsLink: "Koşullar",
    privacyLink: "Gizlilik Politikası",
    consentMarketing: "Bana eait'ten ipuçları ve yeni özellikler gönder",
    errorTerms: "Devam etmek için Koşullar'ı ve Gizlilik Politikası'nı kabul et.",
  },
  "zh-Hant": {
    startCta: "建立我的計畫",
    haveAccountCta: "我已經有帳號了",
    continueWith: "使用 {provider} 繼續",
    continueEmail: "使用電子郵件繼續",
    signUpHeading: "拍下你吃的東西，得到誠實的答案",
    saveHeading: "儲存你的進度",
    termsLabel: "我同意 eait 的 {terms} 和 {privacy}",
    termsLink: "使用條款",
    privacyLink: "隱私權政策",
    consentMarketing: "寄給我 eait 的小技巧和新功能",
    errorTerms: "請同意使用條款和隱私權政策以繼續。",
  },
  "zh-Hans": {
    startCta: "制定我的计划",
    haveAccountCta: "我已有账户",
    continueWith: "通过{provider}继续",
    continueEmail: "通过邮箱继续",
    signUpHeading: "拍下你吃的东西，获得如实的答案",
    saveHeading: "保存你的进度",
    termsLabel: "我同意 eait 的{terms}和{privacy}",
    termsLink: "条款",
    privacyLink: "隐私政策",
    consentMarketing: "向我发送 eait 的小贴士和新功能",
    errorTerms: "同意条款和隐私政策后即可继续。",
  },
  ko: {
    startCta: "내 플랜 만들기",
    haveAccountCta: "이미 계정이 있어요",
    continueWith: "{provider}로 계속하기",
    continueEmail: "이메일로 계속하기",
    signUpHeading: "먹는 음식을 찍으면 솔직한 답을 드려요",
    saveHeading: "진행 상황을 저장하세요",
    termsLabel: "eait의 {terms} 및 {privacy}에 동의해요",
    termsLink: "이용약관",
    privacyLink: "개인정보 처리방침",
    consentMarketing: "eait의 팁과 새 기능 소식을 받을게요",
    errorTerms: "계속하려면 이용약관과 개인정보 처리방침에 동의해 주세요.",
  },
  ja: {
    startCta: "プランを作る",
    haveAccountCta: "アカウントをお持ちの方",
    continueWith: "{provider}で続ける",
    continueEmail: "メールで続ける",
    signUpHeading: "食べたものを撮るだけで、正直な答えを",
    saveHeading: "進捗を保存しましょう",
    termsLabel: "eaitの{terms}と{privacy}に同意します",
    termsLink: "利用規約",
    privacyLink: "プライバシーポリシー",
    consentMarketing: "eaitからヒントや新機能のお知らせを受け取る",
    errorTerms: "続けるには利用規約とプライバシーポリシーに同意してください。",
  },
  "pt-BR": {
    startCta: "Montar meu plano",
    haveAccountCta: "Já tenho uma conta",
    continueWith: "Continuar com {provider}",
    continueEmail: "Continuar com e-mail",
    signUpHeading: "Fotografe o que você come e receba uma resposta honesta",
    saveHeading: "Salve seu progresso",
    termsLabel: "Concordo com os {terms} e a {privacy} do eait",
    termsLink: "Termos",
    privacyLink: "Política de Privacidade",
    consentMarketing: "Quero receber dicas e novidades do eait",
    errorTerms: "Aceite os Termos e a Política de Privacidade para continuar.",
  },
};

export const signupCopyFor = (lang: Lang): SignupCopy => t(lang)(SIGNUP_COPY);
