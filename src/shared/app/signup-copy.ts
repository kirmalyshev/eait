// The welcome and sign-up screen's words (#110): the welcome's two doors, then the sign-up
// screen's headline, consent boxes and error. Moved out of `PAGE_COPY` (S8 put them in
// `src/backend/web/copy.ts`, which is backend-only) because the phone's sign-up — M3,
// ieat-app#922 — draws the same screen and would otherwise write its own eight-language copy.
// The web-only pairing card's words stay in `PAGE_COPY`; `chatRefusalIdentity` stays too — it is
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
  /**
   * A provider button's label: "Continue with Apple", "Continue with Google". `{provider}`
   * holds the brand, because a language puts it where its grammar needs it — moved out of
   * `PAGE_COPY` for the phone, whose sign-up screen draws the same buttons (ieat-app#922).
   * Apple renders its own system label on iOS; only Google reads this there.
   */
  continueWith: string;
  /**
   * The required box's label. `{terms}` and `{privacy}` hold the two document names, so a
   * translation puts them wherever its grammar needs them rather than reordering a sentence that
   * was written in English.
   */
  termsLabel: string;
  /** The document names inside `termsLabel` — "Terms" has no published page, only "Privacy" links. */
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
    signUpHeading: "Photograph what you eat, get an honest answer",
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
    signUpHeading: "Photographie ce que tu manges, reçois une réponse honnête",
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
    signUpHeading: "Fotografier, was du isst, und bekomm eine ehrliche Antwort",
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
    signUpHeading: "Fotografa quello che mangi, ricevi una risposta onesta",
    termsLabel: "Accetto i {terms} e la {privacy} di eait",
    termsLink: "Termini",
    privacyLink: "Informativa sulla privacy",
    consentMarketing: "Inviami consigli e novità da eait",
    errorTerms: "Accetta i Termini e l'Informativa sulla privacy per continuare.",
  },
  es: {
    startCta: "Crear mi plan",
    haveAccountCta: "Ya tengo una cuenta",
    continueWith: "Continuar con {provider}",
    signUpHeading: "Fotografía lo que comes, recibe una respuesta honesta",
    termsLabel: "Acepto los {terms} y la {privacy} de eait",
    termsLink: "Términos",
    privacyLink: "Política de privacidad",
    consentMarketing: "Envíame consejos y novedades de eait",
    errorTerms: "Acepta los Términos y la Política de privacidad para continuar.",
  },
  vi: {
    startCta: "Tạo kế hoạch cho tôi",
    haveAccountCta: "Tôi đã có tài khoản",
    continueWith: "Tiếp tục với {provider}",
    signUpHeading: "Chụp món bạn ăn, nhận câu trả lời thẳng thắn",
    termsLabel: "Tôi đồng ý với {terms} và {privacy} của eait",
    termsLink: "Điều khoản",
    privacyLink: "Chính sách bảo mật",
    consentMarketing: "Gửi cho tôi mẹo và tính năng mới từ eait",
    errorTerms: "Đồng ý với Điều khoản và Chính sách bảo mật để tiếp tục.",
  },
  id: {
    startCta: "Buat rencanaku",
    haveAccountCta: "Saya sudah punya akun",
    continueWith: "Lanjutkan dengan {provider}",
    signUpHeading: "Foto makananmu, dapatkan jawaban jujur",
    termsLabel: "Saya menyetujui {terms} dan {privacy} eait",
    termsLink: "Ketentuan",
    privacyLink: "Kebijakan Privasi",
    consentMarketing: "Kirimi saya tips dan fitur baru dari eait",
    errorTerms: "Setujui Ketentuan dan Kebijakan Privasi untuk melanjutkan.",
  },
  ru: {
    startCta: "Собрать мой план",
    haveAccountCta: "У меня уже есть аккаунт",
    continueWith: "Продолжить с {provider}",
    signUpHeading: "Сфотографируй еду — получи честный ответ",
    termsLabel: "Я принимаю {terms} и {privacy} eait",
    termsLink: "Условия",
    privacyLink: "Политику конфиденциальности",
    consentMarketing: "Присылай мне советы и новинки eait",
    errorTerms: "Чтобы продолжить, прими Условия и Политику конфиденциальности.",
  },
};

export const signupCopyFor = (lang: Lang): SignupCopy => t(lang)(SIGNUP_COPY);
