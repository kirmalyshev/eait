// The claims rule set — the words public copy may not contain.
//
// PROVENANCE. Ported from `eait-marketer/src/claims.ts`, which encodes the compliance pass in that
// repo's `docs/research/2026-07-21-content-factory-stack.md` §5, plus the two comparative rules
// this repo added for a page sitting on a domain we own. It is a copy across repositories on
// purpose — separate products, separate release cadences, and a landing build must not depend on a
// marketing checkout being present. Change one, change both.
//
// IT LIVES IN SHARED BECAUSE TWO SURFACES PUBLISH COPY NOW. The landing page was the first
// (`src/landing/claims.ts` renders HTML, lints the rendered text, and only then writes);
// the notification copy is the second, and it is admin-editable, so its gate runs on the WRITE.
// A third copy of the word list inside `shared` would be the one that drifts.
//
// WHY IT BLOCKS RATHER THAN WARNS. FTC substantiation applies per claim, at up to $50,120 per
// violation, and EU Reg 1924/2006 treats marketing copy about food much like a product label. A
// reviewer's memory is not a control.
//
// The patterns are deliberately narrow, for the reason the original gives: a linter that flags
// "sweet treats" gets disabled within a week, and a disabled linter protects nothing.

export interface ClaimViolation {
  field: string;
  pattern: string;
  span: string;
  index: number;
}

interface Rule {
  name: string;
  re: RegExp;
}

const RULES: readonly Rule[] = [
  // Disease verbs. Word-bounded on both ends for the ones that are common prefixes of ordinary
  // words ("healthy", "preventable", "reversible"); "cure" has no such collision so its trailing
  // boundary is dropped, which is what catches a delimiter-free "#curesacne".
  {
    name: "disease-verb",
    re: /\b(?:prevents?|prevented|preventing|heals?|healed|healing|reverses?|reversed|reversing)\b/gi,
  },
  { name: "disease-verb", re: /\b(?:cures?|cured|curing)/gi },
  { name: "treats-disease", re: /\btreats?\s+(diabetes|cancer|obesity|hypertension|disease|illness)\b/gi },
  { name: "lowers-marker", re: /\blowers?\s+(cholesterol|blood\s+sugar|blood\s+pressure)\b/gi },
  { name: "detox", re: /\bdetox(?:ification|ifying|ifies|ify|ing|es)?/gi },
  { name: "burns-fat", re: /\b(?:burns?|burning)\s*fat\b|\bfat\s*burn(?:s|ing)?\b/gi },
  { name: "disease-term", re: /\b(diabetes|cancer|hypertension|heart\s+disease)/gi },
  { name: "guarantee", re: /\bguarantee(?:d|s|ing)?\b/gi },
  { name: "weight-promise", re: /\blose\s*\d+\s*(?:kg|kilos?|pounds?|lbs)\b|\blose\s*weight/gi },

  // ── Added here, not present in the marketing repo's version ─────────────────────────────────
  //
  // That linter guards social assets, where the risk is a health claim. A page on a domain we own —
  // and a notification sitting on a lock screen — carry a second class of risk: comparative and
  // exclusivity claims about competitors, durable and attributable.
  //
  // An Alleinstellungsbehauptung — "the only", "the first", "no other app" — is actionable under
  // §5 UWG by any competitor or by the Wettbewerbszentrale, and an Abmahnung with costs is the
  // standard response. `marketing/DECISIONS.md` (2026-07-26) retired a caption for exactly
  // this after the repo's own research disproved it.
  { name: "exclusivity", re: /\bthe\s+only\s+(?:app|tracker|one)\b|\bno\s+other\s+app\b/gi },
  // The negative-universal form of the same claim — "nobody in this category publishes anything" —
  // slipped this gate on the landing page and was caught by a red-team pass, not by the build.
  // Falsifiable by one counterexample, actionable the same way; "we could not find one who does"
  // is the version that survives. Tight on purpose: "a guard nobody is told about" must not match.
  { name: "exclusivity", re: /\b(?:nobody|no\s*one)\s+(?:else\s+)?in\s+(?:this|the)\s+category\b/gi },
  { name: "superiority", re: /\bevery\s+other\s+app\b|\bbetter\s+than\s+(?:any|every|all)\b/gi },

  // ── A promise the product stopped keeping ───────────────────────────────────────────────────
  //
  // "No email, no name" was true until issue #95, when sign-in started asking Apple and Google for
  // the address. It is here rather than in a test because the copy this guards is EDITABLE: the
  // onboarding welcome is stored per host, so a host whose admin saved the old wording goes on
  // serving it after the binary that retired it has shipped, and an admin can type it back in at
  // any time. A false privacy promise is the one claim this product can least afford, on a page
  // that argues privacy is the product.
  //
  // Deliberately narrow. It matches the claim, not the subject: "we email you" and "your email
  // address" are the true sentences that replaced it and must keep passing.
  { name: "retired-no-email", re: /\bno\s+e-?mail\b|\bnever\s+asks?\s+for\s+(?:your\s+|an\s+)?e-?mail\b/gi },

  // ── THE SAME FOUR FAMILIES, IN THE OTHER SEVEN LANGUAGES (#358) ─────────────────────────────
  //
  // WHY ONLY FOUR. These are the ones the root AGENTS.md names, and they are the ones a
  // translator or an admin actually reaches for. The rest stay English-only ON PURPOSE and it is
  // written down below, because a rule set that looks complete and is not is worse than one whose
  // edges are stated.
  //
  // WHY THEY NEED NO LANGUAGE ARGUMENT. Every pattern here is run over every string, exactly as
  // `genderedRussian` is: `garantiert` cannot match English and `guaranteed` cannot match German,
  // so the sets do not interfere. It also means an admin who types German into the English slot is
  // still caught, which threading the language would have missed.
  //
  // NOT `\b` ON CYRILLIC OR VIETNAMESE. JavaScript's word boundary is ASCII, so `\bгарантия`
  // never fires — the same trap `genderedRussian` fell into. Lookarounds, or nothing.
  //
  // NARROW WHERE THE VERB IS ORDINARY. Vietnamese `đảm bảo` is "make sure" — "đảm bảo đủ đạm" is
  // a sentence this product legitimately writes — so the guarantee pattern requires an OUTCOME
  // beside it. Same reason `senkt` alone is not `lowers-marker`: the app lowers a target, and only
  // a biomarker beside the verb makes it a claim.

  // guarantee — OUTCOME-BOUND IN EVERY LANGUAGE, and that is the whole design of this family.
  //
  // The bare stem is the consumer-law noun a paid iOS app has to write ("Garantie légale de
  // conformité : deux ans") and it is also this product's own voice ("Rien n'est garanti ici — ce
  // sont des estimations"). Both were refused by the first version, which is precisely the
  // sentence that gets a linter switched off. So the stem only counts with a RESULT beside it,
  // within two words, either side — because German puts "Erfolg" first and French puts
  // "résultats" last.
  { name: "guarantee", re: /(?:r[ée]sultats?|perte\s+de\s+poids|succ[èe]s|kg)(?:\s+\S+){0,2}\s+garanti\w*|garanti\w*(?:\s+\S+){0,2}\s+(?:r[ée]sultats?|perte\s+de\s+poids|succ[èe]s|kg)/gi },
  { name: "guarantee", re: /(?:erfolg|ergebnis\w*|gewichtsverlust|gewichtsabnahme|abnehmen|kg)(?:\s+\S+){0,2}\s+garanti\w*|garanti\w*(?:\s+\S+){0,2}\s+(?:erfolg|ergebnis\w*|gewichtsverlust|gewichtsabnahme|abnehmen|kg)|\berfolgsgarantie\b/gi },
  { name: "guarantee", re: /(?:risultat\w*|perdita\s+di\s+peso|successo|kg)(?:\s+\S+){0,2}\s+garanti\w*|garanti\w*(?:\s+\S+){0,2}\s+(?:risultat\w*|perdita\s+di\s+peso|successo|kg)/gi },
  { name: "guarantee", re: /(?:resultados?|p[ée]rdida\s+de\s+peso|[ée]xito|kg)(?:\s+\S+){0,2}\s+garantiz\w*|garantiz\w*(?:\s+\S+){0,2}\s+(?:resultados?|p[ée]rdida\s+de\s+peso|[ée]xito|kg)/gi },
  { name: "guarantee", re: /(?:cam kết|đảm bảo|bảo đảm)\s+(?:giảm cân|kết quả|thành công|hiệu quả)/giu },
  { name: "guarantee", re: /\b(?:men|di|ter)?jamin\w*(?:\s+\S+){0,2}\s+(?:hasil\w*|berat\s+badan|sukses)|(?:hasil\w*|berat\s+badan|sukses)(?:\s+\S+){0,2}\s+(?:di|ter)?jamin\w*|\bgaransi\s+hasil\b/gi },
  { name: "guarantee", re: /(?<![а-яё])(?:результат[а-яё]*|похуден[а-яё]*|вес|кг)(?:\s+\S+){0,2}\s+гаранти[а-яё]*|(?<![а-яё])гаранти[а-яё]*(?:\s+\S+){0,2}\s+(?:результат[а-яё]*|похуден[а-яё]*|вес|кг)/giu },

  // weight-promise — the stems, and DELIBERATELY NOT the progressive.
  //
  // `Estás adelgazando a 0,5 kg por semana` and `Stai dimagrendo` describe what is happening;
  // `adelgazar` and `dimagrire` promise it. That line is the best either language offers, and it
  // is the same undecidability English has — which is why this family is the one the onboarding
  // surface opts out of by name. A goal button says "Perdre du poids" and must keep saying it.
  { name: "weight-promise", re: /\bperd(?:re|ez|s|ons|ras|rez)\s+(?:du\s+poids|\d+\s*kg)|\bperte\s+de\s+poids\b|\bmaigrir\b|\bmincir\b|\bamincissement\b/gi },
  { name: "weight-promise", re: /\bgewicht\s+(?:zu\s+)?verlieren\b|\bgewichts(?:verlust|abnahme)\b|\d+\s*(?:kg|kilo\w*|pfund)\s+ab(?:nehmen|zunehmen)?\b/gi },
  { name: "weight-promise", re: /\bperd(?:ere|i|e|erai|erete)\s+(?:peso|\d+\s*kg)\b|\bperdita\s+di\s+peso\b|\bdimagri\w*/gi },
  { name: "weight-promise", re: /\b(?:pierd(?:e|es|a)|perder[áa]s?|bajar?)\s+(?:de\s+)?(?:peso|\d+\s*kg)\b|\bp[ée]rdida\s+de\s+peso\b|\badelgazar?\b|\badelgaza\b/gi },
  { name: "weight-promise", re: /giảm\s+cân|giảm\s+\d+\s*(?:kg|ký)/giu },
  { name: "weight-promise", re: /\b(?:me)?nurunkan\s+berat\s+badan\b|\b(?:di)?turunkan?\s+berat\s+badan\b|\bpenurunan\s+berat\s+badan\b|\bturun\s+\d+\s*kg\b/gi },
  { name: "weight-promise", re: /(?<![а-яё])(?:похуде[а-яё]*|снижение\s+веса|с(?:брос|кинут)[а-яё]*\s+(?:вес|\d+\s*кг)|потеря\s+веса|минус\s+\d+\s*кг)/giu },

  // lowers-marker — the MARKER decides, never the verb.
  //
  // Spanish `baja` is also an instruction and `tensión` is also stress; `pressione` and `tension`
  // are ordinary pressure; Russian `сахар` is the food. English `blood sugar` disambiguates
  // itself and these do not, so the qualified form is required where the bare noun is ambiguous.
  { name: "lowers-marker", re: /\b(?:fait\s+)?(?:baisse[rz]?|r[ée]du(?:it|ire)|diminue[rz]?)\s+(?:l[ae]\s+|du\s+|ton\s+|ta\s+|votre\s+)?(?:cholest[ée]rol|glyc[ée]mie|tension\s+art[ée]rielle)\b/gi },
  { name: "lowers-marker", re: /\bsenkt\s+(?:den\s+|das\s+|die\s+|deinen\s+)?(?:cholesterin\w*|blutzucker|blutdruck)\b|\b(?:cholesterin\w*|blutzucker|blutdruck)(?:\s+\S+){0,3}\s+(?:zu\s+)?senken\b/gi },
  { name: "lowers-marker", re: /\b(?:abbassa|riduce|ridurre|fa\s+scendere)\s+(?:il\s+|la\s+|il\s+tuo\s+|la\s+tua\s+)?(?:colesterolo|glicemia|pressione\s+sanguigna)\b/gi },
  { name: "lowers-marker", re: /\b(?:baja|reduce|reducir|hace\s+bajar)\s+(?:el\s+|la\s+|tu\s+)?(?:colesterol|glucosa|az[úu]car\s+en\s+sangre|tensi[óo]n\s+arterial)\b/gi },
  { name: "lowers-marker", re: /(?:giảm|hạ)\s+(?:cholesterol|đường\s+huyết|huyết\s+áp|mỡ\s+máu)/giu },
  { name: "lowers-marker", re: /\bmenurunkan\s+(?:kolesterol|gula\s+darah|tekanan\s+darah)\b/gi },
  { name: "lowers-marker", re: /(?<![а-яё])сни[жз][а-яё]*\s+(?:холестерин[а-яё]*|давлени[а-яё]*|сахар[а-яё]*\s+в\s+крови)|(?<![а-яё])(?:холестерин|давление)\s+сни[жз][а-яё]*/giu },

  // detox — the Latin word is the one a Romance marketer does not need.
  { name: "detox", re: /\bd[ée]tox\w*/gi },
  { name: "detox", re: /\bentgift\w*/gi },
  { name: "detox", re: /\bdisintossic\w*|\belimina\s+le\s+tossine\b/gi },
  { name: "detox", re: /\bdesintoxic\w*|\belimina\s+las\s+toxinas\b|\bdepura\w*\s+(?:tu\s+|el\s+)?organismo\b|\blimpieza\s+de\s+colon\b/gi },
  // NOT `\b[ée]limine`: a leading `É` is not an ASCII word character, so the boundary never
  // matches at the start of a sentence. Third time that trap has appeared in this branch.
  { name: "detox", re: /(?<![a-zà-ÿ])[ée]limine\s+les\s+toxines|\bpurifie\w*\s+(?:ton\s+|l['’])?organisme\b/giu },
  { name: "detox", re: /thải\s+độc|giải\s+độc/giu },
  { name: "detox", re: /\bdetoks\w*/gi },
  { name: "detox", re: /(?<![а-яё])детокс[а-яё]*/giu },

  // ── WHAT IS STILL ENGLISH-ONLY, and why ─────────────────────────────────────────────────────
  //
  // `disease-verb`, `treats-disease`, `disease-term`, `burns-fat`, `exclusivity`, `superiority`
  // and `retired-no-email`. Two of those deserve naming rather than a list: `disease-verb`
  // ("heilt", "guérit", "лечит") is the sharpest HWG exposure there is, and `exclusivity` is the
  // Alleinstellungsbehauptung this file's own comment cites §5 UWG for — so both are German-shaped
  // risks with no German pattern. They are out because each needs a native reading to write
  // narrowly, and a pattern guessed at is the kind that fires on ordinary prose and gets the
  // linter switched off. The four above were reviewed; these have not been.
];

/**
 * Normalizes an invisible-character bypass before matching — a zero-width space or soft hyphen
 * splits a banned token for the regex while the rendered text shows the word intact. NFKC first,
 * then every Unicode format character.
 */
export function normalizeForMatch(text: string): string {
  return text.normalize("NFKC").replace(/\p{Cf}/gu, "");
}

/**
 * Returns every violation across every field. Never throws.
 *
 * `only` narrows the rule set BY NAME, and exists for one surface: the onboarding copy, whose own
 * legitimate answers are "Lose weight" and "Diabetes". `weight-promise` and `disease-term` cannot
 * tell those from a claim — the root AGENTS.md says so, and it is why the web gate covers
 * `PAGE_COPY` rather than the rendered page — so that surface opts into the rules that ARE
 * decidable there rather than being handed the marketing set. Omitted means every rule.
 */
export function lintCopy(
  fields: Record<string, string>,
  only?: readonly string[],
): ClaimViolation[] {
  const violations: ClaimViolation[] = [];
  const rules = only === undefined ? RULES : RULES.filter((r) => only.includes(r.name));
  for (const [field, rawText] of Object.entries(fields)) {
    const text = normalizeForMatch(rawText);
    for (const rule of rules) {
      // Fresh regex per scan: a /g regex carries lastIndex between calls.
      const re = new RegExp(rule.re.source, rule.re.flags);
      let match: RegExpExecArray | null;
      while ((match = re.exec(text)) !== null) {
        violations.push({ field, pattern: rule.name, span: match[0]!, index: match.index });
      }
    }
  }
  return violations;
}
