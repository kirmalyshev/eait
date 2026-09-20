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
import { lintCopy } from "./claims.ts";
import { LANGS } from "./types.ts";
import { NOTIFICATION_COPY } from "./notifications.ts";
import { ONBOARDING_CONTENT } from "./onboarding-content.ts";

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
  },
  "weight-promise": {
    en: ["Lose weight fast.", "Lose 5 kg this month."],
    fr: ["Perdez du poids vite.", "Perdre 5 kg ce mois-ci.", "Tu perdras du poids.",
      "Maigrir sans effort.", "Mincir durablement.", "Amincissement rapide."],
    de: ["Nimm 5 kg ab.", "Gewicht verlieren, schnell.",
      // `\bab\b` has no boundary inside `abnehmen`, so only the SEPARABLE form fired.
      "Mit eait 5 kg abnehmen.", "Gewichtsabnahme ohne Hunger."],
    it: ["Perdi peso in fretta.", "Dimagrire di 5 kg.", "Perderai peso.",
      "Perdi 5 kg in un mese."],
    es: ["Pierde peso rápido.", "Adelgazar 5 kg.", "Perderás peso.",
      "Baja de peso sin esfuerzo.", "Pierde 5 kg en un mes."],
    vi: ["Giảm cân nhanh.", "Giảm 5 kg trong tháng này.", "Giảm 5 ký trong tháng này."],
    id: ["Turunkan berat badan dengan cepat.",
      // me- ASSIMILATES the t, so `menurunkan` contains no `turun` at all — and this is the
      // standard Indonesian phrase AND the shipped goal button.
      "Menurunkan berat badan dengan cepat.", "Penurunan berat badan terjamin."],
    ru: ["Похудей быстро.", "Сбросить 5 кг за месяц.",
      // The standard Russian marketing noun. `потеря веса` is the calque nobody writes.
      "Снижение веса за месяц.", "Скинуть вес быстро.", "Минус 10 кг за месяц."],
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
  "1.100 von 1.900 kcal heute. Morgen startet wieder bei 1.900.",
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
  "Estás adelgazando a 0,5 kg por semana.",
  "Stai dimagrendo di 0,5 kg a settimana.",
];

// ── The number grammar (#28) ──────────────────────────────────────────────────────────────────
//
// Not a claim in the legal sense and in this file anyway, because the mechanism is the one that
// fits: two of the surfaces the gate covers are typed by an admin, and a range on a lock screen is
// a range nobody reviewed. Kept in its own pair of tables rather than folded into `BANNED`/`FINE`
// — those are keyed by language and this family is mostly language-free.

/** Every shape of "a number and its error" the gate must refuse. */
const RANGES = [
  "620 ±90 kcal today.",
  "620 +/-90 kcal today.",
  "Somewhere between 530 and 710 kcal.",
  "Between {low} and {high} kcal.",
  "1 400–1 800 kcal a day.",
  "1400—1800 kcal a day.",
  "About 530 to 710 kcal on this plate.",
  // The same grammar in another language still carries the sign and the dash.
  "Zwischen 1 400–1 800 kcal am Tag.",
];

/** And the sentences around it that must keep passing, or the gate gets switched off. */
const NOT_RANGES = [
  // The grammar this replaces it with: one number, its precision carrying the confidence.
  "Take 600 as a rough guess and check the grams before you trust the total.",
  "About 950 of your 1,454 left today.",
  "We will not write a plan under 1,500 kcal.",
  // A hyphen is a date, an id and a compound — never a range.
  "Logging this for 2026-09-20 — look right?",
  "Question 3 of 8",
  // An em dash that is not between two figures, which is most of this product's prose.
  "Updated — 306 kcal. 1,148 of your 1,454 left today.",
  "Порог — 1500 ккал.",
  // "to" and "and" with no figure in front of them.
  "Two days before the free week ends.",
  "It takes about three minutes.",
  "Photograph a meal in this browser and read the answer, on the same account.",
];

describe("the number grammar", () => {
  it("refuses a number and its error, however it is spelled", () => {
    for (const text of RANGES) {
      const hits = lintCopy({ body: text });
      expect(hits.map((h) => h.pattern), `"${text}" was not refused`).toContain("number-range");
    }
  });

  it("lets one number per thing through, and every hyphen that is a date", () => {
    for (const text of NOT_RANGES) {
      expect(lintCopy({ body: text }).map((h) => `${h.pattern}: ${h.span}`), text).toEqual([]);
    }
  });
});

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
});
