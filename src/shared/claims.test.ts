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
    fr: ["Perte de poids garantie.", "Résultats garantis."],
    de: ["Garantierter Gewichtsverlust.", "Erfolg garantiert."],
    it: ["Perdita di peso garantita.", "Risultati garantiti."],
    es: ["Pérdida de peso garantizada.", "Resultados garantizados."],
    vi: ["Cam kết giảm cân.", "Đảm bảo kết quả trong một tuần."],
    id: ["Dijamin turun berat badan.", "Hasil terjamin."],
    ru: ["Гарантированное похудение.", "Результат гарантирован."],
  },
  "weight-promise": {
    en: ["Lose weight fast.", "Lose 5 kg this month."],
    fr: ["Perdez du poids vite.", "Perdre 5 kg ce mois-ci."],
    de: ["Nimm 5 kg ab.", "Gewicht verlieren, schnell."],
    it: ["Perdi peso in fretta.", "Dimagrire di 5 kg."],
    es: ["Pierde peso rápido.", "Adelgazar 5 kg."],
    vi: ["Giảm cân nhanh.", "Giảm 5 kg trong tháng này."],
    id: ["Turunkan berat badan dengan cepat."],
    ru: ["Похудей быстро.", "Сбросить 5 кг за месяц."],
  },
  "lowers-marker": {
    en: ["Lowers cholesterol."],
    fr: ["Fait baisser le cholestérol."],
    de: ["Senkt den Cholesterinspiegel.", "Senkt den Blutdruck."],
    it: ["Abbassa il colesterolo."],
    es: ["Baja el colesterol."],
    vi: ["Giảm cholesterol."],
    id: ["Menurunkan kolesterol."],
    ru: ["Снижает холестерин.", "Снижает давление."],
  },
  detox: {
    en: ["A detox week."],
    fr: ["Une semaine détox."],
    de: ["Eine Woche Entgiftung."],
    it: ["Una settimana disintossicante."],
    es: ["Una semana de desintoxicación."],
    vi: ["Một tuần thải độc."],
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
