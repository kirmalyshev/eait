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
