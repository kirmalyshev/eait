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
};

export const mailCopyFor = (lang: Lang): MailCopy => t(lang)(MAIL_COPY);
