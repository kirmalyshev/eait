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

  // ── THE SAME FOUR FAMILIES, IN EVERY OTHER LANGUAGE (#358, #2206) ──────────────────────────
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
  { name: "guarantee", re: /(?:resultados?|perda\s+de\s+peso|sucesso|kg)(?:\s+\S+){0,2}\s+garant\p{L}*|(?<!\p{L})garant\p{L}*(?:\s+\S+){0,2}\s+(?:resultados?|perda\s+de\s+peso|sucesso|kg)/giu },
  { name: "guarantee", re: /(?:resulta(?:at|ten)|gewichtsverlies|succes|afvallen|kg)(?:\s+\S+){0,2}\s+(?:ge)?garan[dt]\p{L}*|(?<!\p{L})(?:ge)?garan[dt]\p{L}*(?:\s+\S+){0,2}\s+(?:resulta(?:at|ten)|gewichtsverlies|succes|afvallen|kg)|(?<!\p{L})(?:succes|resultaat)garantie/giu },
  { name: "guarantee", re: /(?:rezultat\p{L}*|efekt\p{L}*|sukces\p{L}*|utrat\p{L}*\s+wagi|kg)(?:\s+\S+){0,2}\s+gwaran\p{L}*|(?<!\p{L})gwaran\p{L}*(?:\s+\S+){0,2}\s+(?:rezultat\p{L}*|efekt\p{L}*|sukces\p{L}*|utrat\p{L}*\s+wagi|schud\p{L}*|kg)/giu },
  { name: "guarantee", re: /(?:sonu[çc]\p{L}*|kilo\s+kayb\p{L}*|ba[şs]ar[ıi]\p{L}*|kg)(?:\s+\S+){0,2}\s+garanti\p{L}*|(?<!\p{L})garanti\p{L}*(?:\s+\S+){0,2}\s+(?:sonu[çc]\p{L}*|kilo\s+kayb\p{L}*|ba[şs]ar[ıi]\p{L}*|kg)/giu },
  // ja / zh / ko have no spaces to count words by, so the outcome sits directly beside the stem —
  // and the honest denial ("結果を保証するものではありません", "不保证效果", "보장하지 않습니다")
  // is excluded by name, because it is the sentence this product's own voice writes.
  { name: "guarantee", re: /(?:結果|成果|効果|減量|痩せる|やせる|\d+\s*(?:kg|キロ))(?:を|が|は|も)?(?:必ず|確実に)?保証(?!(?:する|される|できる)?(?:もの|わけ)?(?:で|じゃ)?は(?:ありません|ない)|しません|しない|いたしません|できません|できない|されません|されない)|保証(?:付き|つき)の?(?:結果|成果|効果|減量)/gu },
  { name: "guarantee", re: /(?<![不无無能法])(?:保[证證]|[担擔]保)(?:你|您)?(?:的)?(?:效果|[结結]果|成功|[减減]重|[减減]肥|瘦|[减減]掉)|(?:效果|[结結]果|[减減]重)保[证證]|包瘦/gu },
  { name: "guarantee", re: /(?:결과|효과|감량|성공|\d+\s*(?:kg|킬로))(?:를|을|가|이|는|은)?\s*보장(?!하지|할\s*수\s*없|되지|은\s*없|이\s*없|하는\s*것은\s*아니)|보장된\s*(?:결과|효과|감량|성공)/gu },
  // Wave 2. The negation right before the stem ("не гарантуємо", "není zaručen", "nem
  // garantált") is excluded by lookbehind: it is the honest denial, not a claim.
  { name: "guarantee", re: /(?<!\p{L})(?:результат\p{L}*|схудн\p{L}*|ваг[аиу]|кг)(?:\s+\S+){0,2}\s+(?<!не\s)гарант\p{L}*|(?<!\p{L}|не\s)гарант\p{L}*(?:\s+\S+){0,2}\s+(?:результат\p{L}*|схудн\p{L}*|ваг[аиу]|кг)/giu },
  // Wave 3 reads Danish and Norwegian here too, and the Scandinavian main clause puts the
  // negation AFTER the verb (`Vi garanterer ikke resultater`), so it is excluded on both sides.
  { name: "guarantee", re: /(?<!\p{L})(?:resultat\p{L}*|viktnedgång\p{L}*|viktminskning\p{L}*|vægttab\p{L}*|vekttap\p{L}*|framgång|succes|suksess|kg)(?:\s+\S+){0,2}\s+(?<!(?:inte|ikke)\s)garant\p{L}*|(?<!\p{L}|(?:inte|ikke)\s)garant\p{L}*(?!\p{L}|\s+(?:inte|ikke)(?!\p{L}))(?:\s+\S+){0,2}\s+(?:resultat\p{L}*|viktnedgång|viktminskning|vægttab|vekttap|framgång|succes|suksess|kg)|(?<!\p{L})resultatgaranti/giu },
  // Czech and, from wave 3, Slovak: `úspech`, `schudnúť`, and `nie je`/`nie sú` as the denial.
  { name: "guarantee", re: /(?<!\p{L})(?:výsled\p{L}*|úsp[eě]ch\p{L}*|úbyt\p{L}*\s+(?:váhy|hmotnosti)|kg)(?:\s+\S+){0,2}\s+(?<!není\s|nejsou\s|nie\s(?:je|sú)\s)(?:garant|zaruč|záruk)\p{L}*|(?<!\p{L}|není\s|nejsou\s|nie\s(?:je|sú)\s)(?:garant|zaruč|záruk)\p{L}*(?:\s+\S+){0,2}\s+(?:výsled\p{L}*|úsp[eě]ch\p{L}*|úbyt\p{L}*|zhubn\p{L}*|schudn\p{L}*|kg)/giu },
  // `nije`/`nisu`/`niso` too: Croatian and Slovenian write `garantirani` as well, and their
  // denial must not trip a Romanian rule.
  { name: "guarantee", re: /(?<!\p{L})(?:rezultat\p{L}*|slăbire\p{L}*|pierder\p{L}*\s+în\s+greutate|succes\p{L}*|kg)(?:\s+\S+){0,2}\s+(?<!nu\s(?:sunt\s|este\s|e\s)?|ni(?:je|su|so)?\s)garant\p{L}*|(?<!\p{L}|nu\s(?:sunt\s|este\s|e\s)?|ni(?:je|su|so)?\s)garant\p{L}*(?:\s+\S+){0,2}\s+(?:rezultat\p{L}*|slăbire\p{L}*|pierder\p{L}*\s+în\s+greutate|succes\p{L}*|kg)/giu },
  { name: "guarantee", re: /(?<!\p{L})(?:αποτελ[εέ]σμ\p{L}*|απ[ωώ]λει\p{L}*\s+β[αά]ρους|επιτυχ\p{L}*|κιλ\p{L}*|kg)(?:\s+\S+){0,2}\s+(?<!δεν\s(?:είναι\s)?)εγγυ\p{L}*|(?<!\p{L}|δεν\s(?:είναι\s)?)εγγυ\p{L}*(?:\s+\S+){0,2}\s+(?:αποτελ[εέ]σμ\p{L}*|απ[ωώ]λει\p{L}*\s+β[αά]ρους|επιτυχ\p{L}*|κιλ\p{L}*|kg)/giu },
  { name: "guarantee", re: /(?<!\p{L})(?:eredmény\p{L}*|fogyás\p{L}*|siker\p{L}*|kg)(?:\s+\S+){0,2}\s+(?<!nem\s)garant\p{L}*|(?<!\p{L}|nem\s)garant\p{L}*(?:\s+\S+){0,2}\s+(?:eredmény\p{L}*|fogyás\p{L}*|siker\p{L}*|kg)|(?<!\p{L})(?:eredmény|siker|fogyás)garanci\p{L}*/giu },
  // Thai has no spaces and `ผล` also opens ผลิตภัณฑ์ (product — the warranty a store page writes)
  // and ผลไม้ (fruit), so the outcome is spelled out rather than prefixed. SARA AM (ำ) is written
  // `ํา` in every Thai rule: NFKC splits it, so a literal `น้ำ` never matches.
  { name: "guarantee", re: /(?<!ไม่\s?|ไม่ได้\s?|ไม่มีการ\s?|ไม่สามารถ\s?)(?:รับประกัน|การันตี)(?:ว่า)?\s*(?:จะ)?\s*(?:ผล(?![ิไ])|ลดน้ําหนัก|น้ําหนัก|ลด\s*\d|ผอม|ความสําเร็จ)|(?:ผลลัพธ์|ลดน้ําหนัก|\d+\s*(?:กก|กิโล|kg))\s*(?:ที่)?(?:ได้รับการ)?(?:รับประกัน|การันตี)/gu },
  // Hindi is verb-final: "नतीजों की गारंटी" is the claim, "गारंटी नहीं" the denial.
  { name: "guarantee", re: /(?:नतीज\S*|परिणाम\S*|रिज़?ल्ट\S*|वज़?न|\d+\s*(?:kg|किलो))(?:\s+\S+){0,2}\s+गार(?:ं|ण्)टी(?!\S*\s+नहीं)|गार(?:ं|ण्)टी\S*(?:\s+\S+){0,2}\s+(?:नतीज|परिणाम|रिज़?ल्ट|वज़?न|\d+\s*(?:kg|किलो))/gu },
  // Wave 3. da/no ride the Swedish rule, sk the Czech one, and ms the Indonesian `jamin`;
  // `resultats garantits` is French's rule already. What is left is the stems those cannot read.
  // Finnish negates with an auxiliary before the verb (`ei`, `emme`, `eivät ole`).
  { name: "guarantee", re: /(?<!\p{L})(?:tulo(?:s|ks|kse)\p{L}*|painonpudotu\p{L}*|laihtumi\p{L}*|kg)(?:\s+\S+){0,2}\s+(?<!(?:ei|eivät|emme|en|et|ette)\s(?:ole\s)?)(?:taat|takaa|takuu)\p{L}*|(?<!\p{L}|(?:ei|eivät|emme|en|et|ette)\s)(?:taat|takaa)\p{L}*(?:\s+\S+){0,2}\s+(?:tulo(?:s|ks|kse)\p{L}*|painonpudotu\p{L}*|laihtumi\p{L}*|kg)|(?<!\p{L})tulostakuu\p{L}*/giu },
  // Croatian and Slovenian. `zagotoviti` is also "make sure" and `zagotovo` is "certainly", so
  // only the guarantee's participle and imperfective stems count, and only beside an outcome.
  // Their `garantirani` is the Romanian rule's, which reads `rezultat` already.
  { name: "guarantee", re: /(?<!\p{L})(?:rezultat\p{L}*|uspj?eh\p{L}*|mršavljenj\p{L}*|hujšanj\p{L}*|gubit\p{L}*\s+težin\p{L}*|izgub\p{L}*\s+teže|kg)(?:\s+\S+){0,2}\s+(?<!(?:ne|ni|nije|nisu|niso)\s)(?:(?:za)?jamč|jamstv|zagotovlj|zagotavlj)\p{L}*|(?<!\p{L}|(?:ne|ni|nije|nisu|niso)\s)(?:(?:za)?jamč|zagotovlj|zagotavlj)\p{L}*(?:\s+\S+){0,2}\s+(?:rezultat\p{L}*|uspj?eh\p{L}*|mršavljenj\p{L}*|hujšanj\p{L}*|gubit\p{L}*\s+težin\p{L}*|izgub\p{L}*\s+teže|kg)/giu },
  { name: "guarantee", re: /(?<!\p{L})(?:resultats?|pèrdua\s+de\s+pes|èxit|kg)(?:\s+\S+){0,2}\s+(?<!no\s(?:estan\s|està\s|és\s|són\s)?)garant\p{L}*|(?<!\p{L}|no\s)garant\p{L}*(?:\s+\S+){0,2}\s+(?:l['’])?(?:resultats?|pèrdua\s+de\s+pes|èxit|kg)(?!\p{L})/giu },
  // Malay `keputusan` is also "decision", so it counts only beside `jamin`.
  { name: "guarantee", re: /(?<!\p{L})(?:keputusan|kejayaan|penurunan\s+berat\s+badan)(?:\s+\S+){0,2}\s+(?<!tidak\s)(?:di|ter)?jamin\p{L}*|(?<!\p{L}|tidak\s)(?:men|di|ter)?jamin\p{L}*(?:\s+\S+){0,2}\s+(?:keputusan|kejayaan)|(?<!\p{L})jaminan\s+keputusan/giu },

  // weight-promise — the stems, and DELIBERATELY NOT the progressive.
  //
  // `Estás adelgazando a 0,5kg por semana` and `Stai dimagrendo` describe what is happening;
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
  // `emagrecendo`, `aan het afvallen`, `chudniesz`, `kilo veriyorsun`, `痩せています`: the
  // progressive again, and again left alone.
  // The bare imperative (`kilo ver`, `schudnij`) is left alone as English's `lose twice as much
  // weight` is: the shipped, cited `twice.title` says exactly that in every language.
  // `{kg} afvallen` is a TEMPLATE whose number is the user's own goal, and passes for the reason
  // English `lose {kg}` does: `\d+` cannot read a placeholder. Filled, `6 kg afvallen` is refused.
  // pt-PT's progressive is `estás a emagrecer`, built on the very infinitive that promises.
  { name: "weight-promise", re: /(?<!(?:estou|estás|está|estamos|estão|ando|andas|anda|andamos|andam)\s+a\s)(?:(?<!\p{L})(?:perder|perca|percam|perder[áa]s?)\s+(?:peso|\d+\s*(?:kg|quilos?))(?!\p{L})|(?<!\p{L})emagre(?:cer|ça|çam|cerá|cimento)(?!\p{L}))|(?<!\p{L})perda\s+de\s+peso(?!\p{L})/giu },
  { name: "weight-promise", re: /(?<!\bhet\s+|\}\s*)(?<!\p{L})afvallen(?!\p{L})|(?<!\p{L})gewichtsverlies(?!\p{L})|(?<!\p{L})val\s+\d+\s*(?:kg|kilo)\s+af(?!\p{L})|(?<!\p{L})afslank\p{L}*|(?<!\p{L})vermager\p{L}*/giu },
  { name: "weight-promise", re: /(?<!\p{L})schud(?:nąć|niesz|niecie|nie)(?!\p{L})|(?<!\p{L})utrat\p{L}*\s+wagi(?!\p{L})|(?<!\p{L})zrzu(?:ć|cić|cisz|cicie)\s+(?:\d+\s*(?:kg|kilo\p{L}*)|wag\p{L}*)/giu },
  { name: "weight-promise", re: /(?<!\p{L})\d+\s*(?:kg|kilo)\s+ver(?:mek|in|iniz|eceksin(?:iz)?|ebilirsin(?:iz)?)?(?!\p{L})|(?<!\p{L})kilo\s+ver(?:mek|in|iniz|eceksin(?:iz)?|ebilirsin(?:iz)?)(?!\p{L})|(?<!\p{L})kilo\s+kayb\p{L}*|(?<!\p{L})zay[ıi]fla(?:mak|y[ıi]n|yacaks[ıi]n(?:[ıi]z)?)?(?!\p{L})/giu },
  { name: "weight-promise", re: /(?:体重|\d+\s*(?:kg|キロ))\s*を?\s*(?:減らす|減らせ|減らそう|減らしましょう|落とす|落とそう|落としましょう)|\d+\s*(?:kg|キロ)\s*(?:痩せ|やせ|減量)|(?:痩|や)せ(?:る|られる|られます|ます|ましょう|よう)/gu },
  { name: "weight-promise", re: /[减減](?:掉|去)\s*\d+\s*(?:公斤|斤|kg|千克)|[减減]掉(?:体重|體重)|[减減]肥|瘦\s*\d+\s*(?:公斤|斤|kg)/gu },
  { name: "weight-promise", re: /\d+\s*(?:kg|킬로)\s*(?:감량|빼)|체중\s*감량|살(?:을)?\s*빼(?:기|세요|자|요|는|고)?/gu },
  // Wave 2, on the same lines: the stem and the perfective (`схуднеш`, `zhubneš`, `να χάσω`)
  // promise, the imperfective present (`худнеш`, `hubneš`, `χάνεις`, `fogysz`) describes, and the
  // bare imperative `twice.title` ships (`Скидай`, `Zhubni`, `Slăbește`, `Χάσε`, `Fogyj`, `वज़न
  // घटाएँ`) is left alone. Swedish `gå ner i vikt` is English's `lose weight` — adjacent only, so
  // `Gå ner dubbelt så mycket i vikt` passes as `Lose twice as much weight` does.
  { name: "weight-promise", re: /(?<!\p{L})(?:схудн(?:ути|еш|ете|е|ення)|с(?:кинути|кинеш|кинете)\s+(?:\d+\s*кг|ваг\p{L}*|зайв\p{L}*\s+ваг\p{L}*)|втрат\p{L}*\s+ваги|зниженн\p{L}*\s+ваги|мінус\s+\d+\s*кг)(?!\p{L})/giu },
  { name: "weight-promise", re: /(?<!\p{L})(?:gå|går)\s+ner\s+(?:i\s+vikt|\d+\s*(?:kg|kilo))(?!\p{L})|(?<!\p{L})tappa\s+(?:vikt|\d+\s*(?:kg|kilo))(?!\p{L})|(?<!\p{L})vikt(?:nedgång|minskning)\p{L}*|(?<!\p{L})banta(?!\p{L})/giu },
  // Thai `ลดน้ำหนัก` is the only word the language has and `twice.title` ships it, as Vietnamese
  // `giảm cân` would be if its title used it: the number is what makes it a promise here.
  { name: "weight-promise", re: /ลด(?:น้ําหนัก)?\s*(?:ได้)?\s*\d+\s*(?:กก|กิโล|kg)|ลดความอ้วน/gu },
  // Devanagari's vowel signs are \p{M}, not \p{L}, so the boundary reads both. The nukta (ज़) is
  // split off by NFKC, so it is optional here.
  { name: "weight-promise", re: /\d+\s*(?:kg|किलो\S*)\s+(?:वज़?न\s+)?(?:घटा|कम\s+कर)\S*|(?<![\p{L}\p{M}])वज़?न\s+(?:घटाना|कम\s+करना|घटेगा|कम\s+होगा)(?![\p{L}\p{M}])|वेट\s*लॉस/gu },
  { name: "weight-promise", re: /(?<!\p{L})zhubn(?:out|eš|ete|e)(?!\p{L})|(?<!\p{L})shod(?:it|íš|íte)\s+(?:\d+\s*(?:kg|kil\p{L}*)|váh\p{L}*|kil\p{L}*)|(?<!\p{L})mínus\s+\d+\s*kg/giu },
  { name: "weight-promise", re: /(?<!\p{L})slăb\p{L}*\s+\d+\s*(?:kg|kilo\p{L}*)|(?<!\p{L})(?:vei|veți|a)\s+slăbi(?!\p{L})|(?<!\p{L})pierd\p{L}*\s+(?:în\s+greutate|\d+\s*(?:kg|kilo\p{L}*))|(?<!\p{L})slăbire\p{L}*/giu },
  { name: "weight-promise", re: /(?<!\p{L})χ[αά]σ\p{L}*\s+(?:\d+\s*(?:kg|κιλ\p{L}*)|β[αά]ρος|κιλ\p{L}*)|(?<!\p{L})απ[ωώ]λει\p{L}*\s+β[αά]ρους|(?<!\p{L})αδυν[αά]τ[ιί]σ\p{L}*/giu },
  // `−6 kg` is Russian's `минус 6кг` with the word replaced by the sign, and it is how seven of the
  // wave-2 plan headlines say the goal. Whole numbers only — `−0,5 kg` is a pace, not a promise —
  // and nothing alphanumeric before the sign, so a range (`5-10 kg`) is not a minus.
  { name: "weight-promise", re: /(?<![\p{L}\p{N}])[−-]\s?\d+\s*(?:kg|кг|κιλ\p{L}*|kil[óo]\p{L}*|กก|กิโล|किलो)(?![\p{L}\d])/giu },
  // `elfogyott` (ran out) is everywhere in the Hungarian copy, so `fogy` is never bare.
  { name: "weight-promise", re: /(?<![\p{L}\d.,])\d+\s*(?:kg|kil[óo])\p{L}*\s+fogy\p{L}*|(?<!\p{L})(?:fogy|ad)\p{L}*\s+le\s+\d+\s*(?:kg|kil[óo])|(?<!\p{L})lefogy\p{L}*|(?<!\p{L})mínusz\s+\d+\s*(?:kg|kil[óo])/giu },
  // Wave 3, on the same lines. Every `twice.title` is a bare imperative with `twice as much`
  // between the verb and the weight (`Tab dobbelt så meget i vægt`, `Laihdu kaksi kertaa
  // enemmän`, `Schudni`, `Smršavi`, `Izgubi dvakrat več teže`, `Perd el doble de pes`, `Turun
  // berat dua kali`, `Perde o dobro do peso`), so the verb counts only ADJACENT to the weight or
  // the number, and the imperative alone is never a stem.
  // Danish and Norwegian: `gå ned i vægt/vekt` is Swedish's `gå ner i vikt`; `tabe sig` is
  // Danish's other `lose weight`.
  { name: "weight-promise", re: /(?<!\p{L})(?:gå|går)\s+ned\s+(?:i\s+v(?:æg|ek)t|\d+\s*(?:kg|kilo))(?!\p{L})|(?<!\p{L})tab(?:e|er)?\s+(?:sig\s+)?(?:i\s+vægt|\d+\s*(?:kg|kilo))(?!\p{L})|(?<!\p{L})tabe\s+sig(?!\p{L})|(?<!\p{L})mist(?:e|er)\s+(?:vekt|\d+\s*(?:kg|kilo))(?!\p{L})|(?<!\p{L})v(?:ægttab|ekttap)\p{L}*/giu },
  // Finnish has no aspect to split on, so the infinitive and the nouns promise, a number beside
  // any form of the verb promises, and the present (`laihdut`, `laihtuvat`) describes.
  { name: "weight-promise", re: /(?<!\p{L})laihtua(?!\p{L})|(?<!\p{L})(?:laih(?:du|tu)|pudot)\p{L}*\s+\d+\s*(?:kg|kilo\p{L}*)|(?<!\p{L})painonpudotu\p{L}*|(?<!\p{L})laihdutu\p{L}*/giu },
  // Slovak is Czech's split: `schudnúť`, `schudneš` promise, `chudneš` describes. `schudnú` (the
  // third plural `twice.sub` writes) and the imperative `Schudni` are not stems.
  { name: "weight-promise", re: /(?<!\p{L})schudn(?:úť|eš|ete|e)(?!\p{L})|(?<!\p{L})zhod(?:iť|íš|íte)\s+(?:\d+\s*(?:kg|kil\p{L}*)|váh\p{L}*|kil\p{L}*)/giu },
  // Croatian: `smršavjeti` and the perfective present promise, `mršaviš` describes, and
  // `smršavite` is left alone because it is also the plural imperative.
  { name: "weight-promise", re: /(?<!\p{L})smršav(?:jeti|iti|iš|(?:je|i)t\s+(?:ćeš|ćete|ćemo))(?!\p{L})|(?<!\p{L})(?:izgub|skin)\p{L}*\s+\d+\s*(?:kg|kil\p{L}*)|(?<!\p{L})gubit(?:ak|ka|ku)\s+težin\p{L}*/giu },
  // Slovenian: `shujšati`, `shujšaš` promise, `hujšaš` describes.
  { name: "weight-promise", re: /(?<!\p{L})shujša(?:ti|š|te)(?!\p{L})|(?<!\p{L})izgub\p{L}*\s+(?:težo|teže)(?!\p{L})/giu },
  // Catalan: `perdre pes`, `aprimar-se`; `estàs perdent pes` and `t'estàs aprimant` describe.
  { name: "weight-promise", re: /(?<!\p{L})(?:perdre|perd|perds|perdràs|perdrà|perdreu|perdeu)\s+(?:pes|\d+\s*(?:kg|quilos?))(?!\p{L})|(?<!\p{L})pèrdua\s+de\s+pes(?!\p{L})|(?<!\p{L})aprima(?:r|ràs|ment)(?:-(?:se|te|vos))?(?!\p{L})/giu },
  // Malay keeps Indonesian's `menurunkan berat badan` (read above) and adds its own verbs. Bare
  // `turun berat badan` stays out: it is Indonesian's shipped `twice.title`.
  { name: "weight-promise", re: /(?<!\p{L})(?:meng)?kurangkan\s+berat\s+badan(?!\p{L})|(?<!\p{L})(?:meng)?kuruskan\s+badan(?!\p{L})|(?<!\p{L})pengurangan\s+berat\s+badan(?!\p{L})|(?<!\p{L})(?:(?:meng)?hilangkan|buang|membuang)\s+\d+\s*(?:kg|kilo)(?!\p{L})/giu },
  // pt-PT on top of the shared Portuguese rule: the `tu` forms and `descer`.
  { name: "weight-promise", re: /(?<!\p{L})(?:perde|perdes|perdemos)\s+(?:peso|\d+\s*(?:kg|quilos?))(?!\p{L})|(?<!\p{L})desce[rs]?\s+\d+\s*(?:kg|quilos?)(?!\p{L})|(?<!\p{L})emagrecer(?:ás|ão|emos|ei)(?!\p{L})/giu },

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
  { name: "lowers-marker", re: /(?<!\p{L})(?:faz\s+)?(?:baixar?|reduz(?:ir)?|diminuir?|abaixar?)\s+(?:o\s+|a\s+|seu\s+|sua\s+)?(?:colesterol|glicemia|a[çc][úu]car\s+no\s+sangue|press[ãa]o\s+arterial)(?!\p{L})/giu },
  { name: "lowers-marker", re: /(?<!\p{L})verla(?:agt|ag|gen)\s+(?:je\s+|uw\s+|het\s+|de\s+)?(?:cholesterol\p{L}*|bloedsuiker\p{L}*|bloeddruk)|(?:cholesterol\p{L}*|bloedsuiker\p{L}*|bloeddruk)(?:\s+\S+){0,3}\s+(?:te\s+)?verlagen(?!\p{L})/giu },
  // `cukier` and `ciśnienie` alone are the food and ordinary pressure, as `сахар` is.
  { name: "lowers-marker", re: /(?<!\p{L})obni[żz]\p{L}*\s+(?:(?:twój|twoje|twoją|poziom)\s+)?(?:cholesterol\p{L}*|cuk(?:ier|r\p{L}*)\s+we\s+krwi|ciśnieni\p{L}*\s+(?:krwi|tętnicze))/giu },
  { name: "lowers-marker", re: /(?<!\p{L})(?:kolesterol\p{L}*|kan\s+şeker\p{L}*|tansiyon\p{L}*|kan\s+bas[ıi]nc\p{L}*)(?:\s+\S+){0,2}\s+düşür\p{L}*/giu },
  { name: "lowers-marker", re: /(?:コレステロール|血糖値?|血圧)(?:値)?\s*(?:を|が)?\s*(?:下げ|低下させ|減らす|減らし)/gu },
  { name: "lowers-marker", re: /(?:降低|[减減]少|[减減]低|降)(?:你的|您的)?(?:胆固醇|膽固醇|血糖|血压|血壓|血脂)/gu },
  { name: "lowers-marker", re: /(?:콜레스테롤|혈당|혈압)(?:\s*수치)?\s*(?:을|를|이|가)?\s*(?:낮추|낮춰|낮춥|떨어뜨|감소시)/gu },
  // Wave 2. Sugar is `в крові` / `v krvi` / `din sânge` / `blod-`, and pressure is arterial,
  // wherever the bare noun is also the food or the everyday word.
  { name: "lowers-marker", re: /(?<!\p{L})зни[жз]\p{L}*\s+(?:(?:рівень|ваш|твій)\s+)?(?:холестерин\p{L}*|тиск\p{L}*|цук(?:ор|ру)\s+в\s+крові)|(?<!\p{L})(?:холестерин|тиск)\p{L}*\s+зни[жз]\p{L}*/giu },
  { name: "lowers-marker", re: /(?<!\p{L})sänk(?:er|a|s|t)?\s+(?:ditt\s+|din\s+|ert\s+|er\s+)?(?:kolesterol\p{L}*|blodsocker\p{L}*|blodtryck\p{L}*)|(?<!\p{L})(?:kolesterol|blodsocker|blodtryck)\p{L}*(?:\s+\S+){0,2}\s+sänk\p{L}*/giu },
  { name: "lowers-marker", re: /ลด(?:ระดับ)?\s*(?:(?:คอ|โค)เลสเตอรอล|ไขมันในเลือด|น้ําตาลในเลือด|ความดัน)/gu },
  { name: "lowers-marker", re: /(?:कोलेस्ट्र\S*|ब्लड\s+शुगर|ब्लड\s+प्रेशर|रक्त\s*(?:चाप|शर्करा))(?:\s+\S+){0,2}\s+(?:कम\s+कर|घटा)\S*/gu },
  { name: "lowers-marker", re: /(?<!\p{L})(?:sniž|sníž)\p{L}*\s+(?:(?:hladinu|váš|tvůj|vaši|tvoji)\s+)?(?:cholesterol\p{L}*|glykémi\p{L}*|krevní\s+tlak|cukr\p{L}*\s+v\s+krvi|hladin\p{L}*\s+cukru\s+v\s+krvi)|(?<!\p{L})(?:cholesterol\p{L}*|krevní\s+tlak)(?:\s+\S+){0,2}\s+(?:sniž|sníž)\p{L}*/giu },
  { name: "lowers-marker", re: /(?<!\p{L})(?:scad|scăd|reduc|diminu)\p{L}*\s+(?:nivelul\s+(?:de\s+)?)?(?:colesterol\p{L}*|glicemi\p{L}*|zahăr\p{L}*\s+din\s+sânge|tensiun\p{L}*\s+arterial\p{L}*)/giu },
  { name: "lowers-marker", re: /(?<!\p{L})(?:μει[ωώ]ν|ρ[ιί]χν|κατεβ[αά]ζ)\p{L}*\s+(?:(?:τη[νς]?|το|τα)\s+)?(?:χοληστερ\p{L}*|σ[αά]κχαρ\p{L}*|αρτηριακ\p{L}*\s+π[ιί]εση)/giu },
  { name: "lowers-marker", re: /(?<!\p{L})(?:koleszterin\p{L}*|vércukor\p{L}*|vérnyomás\p{L}*)(?:\s+\S+){0,2}\s+(?:le)?(?:csökkent|szorít)\p{L}+|(?<!\p{L})(?:le)?csökkent\p{L}+\s+(?:a\s+)?(?:koleszterin\p{L}*|vércukor\p{L}*|vérnyomás\p{L}*)/giu },
  // Wave 3. Every language here has a compound or a `blood` qualifier for sugar and pressure,
  // and the bare noun (`sukker`, `sokeri`, `cukor`, `šećer`, `sladkor`, `sucre`, `gula`, `tlak`)
  // stays the food or the everyday word.
  { name: "lowers-marker", re: /(?<!\p{L})(?:s[æe]nk|reduc[ae]r|reduser)\p{L}*\s+(?:(?:dit|ditt|din|jeres|deres)\s+)?(?:kolesterol\p{L}*|blodsukker\p{L}*|blodtryk\p{L}*)|(?<!\p{L})(?:kolesterol|blodsukker|blodtryk)\p{L}*(?:\s+\S+){0,2}\s+s[æe]nk\p{L}*/giu },
  { name: "lowers-marker", re: /(?<!\p{L})(?:alen|lask|madal)\p{L}*\s+(?:veren\s+)?(?:kolesterol\p{L}*|verensokeri\p{L}*|verenpaine\p{L}*)|(?<!\p{L})(?:kolesterol|verensokeri|verenpaine)\p{L}*(?:\s+\S+)?\s+(?:alen|lask|madal)\p{L}*/giu },
  { name: "lowers-marker", re: /(?<!\p{L})(?:zniž|zníž)\p{L}*\s+(?:(?:hladinu|váš|tvoj|vašu|tvoju)\s+)?(?:cholesterol\p{L}*|glykémi\p{L}*|krvn\p{L}*\s+tlak\p{L}*|cuk(?:or|ru)\s+v\s+krvi|hladin\p{L}*\s+cukru\s+v\s+krvi)|(?<!\p{L})(?:cholesterol\p{L}*|krvn\p{L}*\s+tlak)(?:\s+\S+){0,2}\s+(?:zniž|zníž)\p{L}*/giu },
  { name: "lowers-marker", re: /(?<!\p{L})(?:sniž|sniz|smanj)\p{L}*\s+(?:(?:razinu|vaš|tvoj|vašu|tvoju)\s+)?(?:kolesterol\p{L}*|krvn\p{L}*\s+tlak\p{L}*|(?:šećer\p{L}*|glukoz\p{L}*)\s+u\s+krvi|razin\p{L}*\s+šećera\s+u\s+krvi)|(?<!\p{L})(?:kolesterol\p{L}*|krvn\p{L}*\s+tlak\p{L}*)(?:\s+\S+){0,2}\s+(?:sniž|sniz|smanj)\p{L}*/giu },
  { name: "lowers-marker", re: /(?<!\p{L})(?:zniž|zmanjš)\p{L}*\s+(?:(?:raven|vaš|tvoj|vašo|tvojo)\s+)?(?:holesterol\p{L}*|krvn\p{L}*\s+(?:tlak|sladkor)\p{L}*|(?:sladkor\p{L}*|glukoz\p{L}*)\s+v\s+krvi)|(?<!\p{L})(?:holesterol\p{L}*|krvn\p{L}*\s+tlak\p{L}*)(?:\s+\S+){0,2}\s+(?:zniž|zmanjš)\p{L}*/giu },
  { name: "lowers-marker", re: /(?<!\p{L})(?:fa\s+)?(?:baixar?|redueix(?:en)?|reduir|disminueix(?:en)?|disminuir)\s+(?:el\s+|la\s+)?(?:teu\s+|teva\s+|vostre\s+|vostra\s+)?(?:colesterol|glucèmia|glucosa(?:\s+en\s+sang)?|sucre\s+en\s+sang|pressió\s+arterial)(?!\p{L})/giu },
  { name: "lowers-marker", re: /(?<!\p{L})(?:menurunkan|merendahkan|mengurangkan|turunkan|rendahkan|kurangkan)\s+(?:paras\s+)?(?:kolesterol|gula\s+(?:dalam\s+)?darah|tekanan\s+darah)(?!\p{L})/giu },
  // pt-PT says `tensão arterial` and `o teu`, neither of which the shared Portuguese rule reads.
  { name: "lowers-marker", re: /(?<!\p{L})(?:faz\s+)?(?:baixar?|reduz(?:ir)?|diminuir?|abaixar?)\s+(?:o\s+|a\s+)?(?:teu\s+|tua\s+|vosso\s+|vossa\s+)?(?:colesterol|glicemia|a[çc][úu]car\s+no\s+sangue|press[ãa]o\s+arterial|tens[ãa]o\s+arterial)(?!\p{L})/giu },

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
  // `detox`, `detoks` and `desintoxic` already read pt-BR, pl, tr and nl's loanword.
  { name: "detox", re: /(?<!\p{L})elimin\p{L}*\s+(?:as\s+)?toxinas|(?<!\p{L})limpeza\s+do\s+organismo/giu },
  { name: "detox", re: /(?<!\p{L})ontgift\p{L}*|(?<!\p{L})ontslak\p{L}*/giu },
  { name: "detox", re: /(?<!\p{L})oczyszcz\p{L}*\s+organizm\p{L}*|(?<!\p{L})usuw\p{L}*\s+toksyn\p{L}*/giu },
  { name: "detox", re: /(?<!\p{L})toksin\p{L}*\s+(?:at|arın)\p{L}*|(?<!\p{L})vücud\p{L}*\s+arındır\p{L}*/giu },
  { name: "detox", re: /デトックス|디톡스|해독|排毒|解毒/gu },
  // Wave 2. `detox` reads cs/ro/sv/hu's loanword already; `avgift` alone is Swedish for a FEE.
  { name: "detox", re: /(?<!\p{L})(?:детокс\p{L}*|очищ\p{L}*\s+організм\p{L}*|вив(?:од|ед|ест)\p{L}*\s+токсин\p{L}*)/giu },
  { name: "detox", re: /(?<!\p{L})avgift(?:a|ar|as|ad|ning\p{L}*)(?!\p{L})|(?<!\p{L})rensa\p{L}*\s+kroppen/giu },
  { name: "detox", re: /ดีท[็๊]?อ[กค]ซ์|ล้างพิษ|ขับ(?:สาร)?พิษ/gu },
  { name: "detox", re: /ड[िी]टॉक्स|विषहरण|(?:विषाक्त\s+पदार्थ|टॉक्सिन\S*)(?:\s+\S+){0,2}\s+(?:बाहर\s+)?निकाल/gu },
  { name: "detox", re: /(?<!\p{L})(?:očist|pročist)\p{L}*\s+(?:tělo|těla|organism\p{L}*)|(?<!\p{L})(?:vyplav|odstra[nň])\p{L}*\s+toxin\p{L}*/giu },
  { name: "detox", re: /(?<!\p{L})(?:elimin|îndepărt)\p{L}*\s+toxin\p{L}*|(?<!\p{L})(?:curăț|curăţ|purific)\p{L}*\s+organism\p{L}*/giu },
  { name: "detox", re: /(?<!\p{L})(?:ντετ[οό]ξ|αποτοξ[ιί]ν)\p{L}*|(?<!\p{L})(?:αποβ[αά]λ|αποβολ|απομακρ[υύ]ν)\p{L}*\s+(?:τις\s+|των\s+)?τοξιν\p{L}*/giu },
  { name: "detox", re: /(?<!\p{L})méregtelenít\p{L}*|(?<!\p{L})salaktalanít\p{L}*|(?<!\p{L})toxin\p{L}*\s+(?:ki)?(?:ürít|tisztít)\p{L}*/giu },
  // Wave 3. `detox`/`detoks` and `desintoxic` already read every one of the nine's loanword, and
  // Norwegian `avgiftning` is the Swedish rule's. Danish `afgift` alone is a FEE, as `avgift` is.
  { name: "detox", re: /(?<!\p{L})afgiftning\p{L}*|(?<!\p{L})(?:udrens|rens)\p{L}*\s+(?:af\s+)?kroppen/giu },
  { name: "detox", re: /(?<!\p{L})puhdist\p{L}*\s+(?:elimistö\p{L}*|keho\p{L}*)|(?<!\p{L})(?:poist|pois)\p{L}*\s+(?:\p{L}+\s+)?(?:kuona-ain|myrk|toksiin)\p{L}*|(?<!\p{L})(?:kuona-ain|myrk|toksiin)\p{L}*\s+(?:pois|poist)\p{L}*/giu },
  { name: "detox", re: /(?<!\p{L})(?:očist|prečist)\p{L}*\s+(?:telo|tela|organizm\p{L}*)|(?<!\p{L})(?:vyplav|odstr[aá]n)\p{L}*\s+toxín\p{L}*/giu },
  { name: "detox", re: /(?<!\p{L})(?:očist|pročist|čišćenj|čiščenj)\p{L}*\s+(?:organiz(?:am|m)\p{L}*|tijel\p{L}*|telo|telesa)|(?<!\p{L})(?:izbac|uklanj|uklon|odstran|izloč)\p{L}*\s+(?:\p{L}+\s+)?toksin\p{L}*|(?<!\p{L})razstruplj\p{L}*/giu },
  { name: "detox", re: /(?<!\p{L})elimin\p{L}*\s+(?:les\s+)?toxines|(?<!\p{L})(?:depur|purific|netej)\p{L}*\s+(?:el\s+teu\s+|l['’])?organisme(?!\p{L})/giu },
  { name: "detox", re: /(?<!\p{L})nyahtoks\p{L}*|(?<!\p{L})(?:buang|membuang|singkirkan|menyingkirkan|keluarkan|mengeluarkan)\s+toksin/giu },
  { name: "detox", re: /(?<!\p{L})(?:depur|purific|limp)\p{L}*\s+o\s+(?:teu\s+|seu\s+)?organismo(?!\p{L})/giu },

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
 * THE ONE EXEMPTION, published (S6; Kirill's decision, DIRECTION §"the plan as a graph").
 *
 * The plan graph draws "Goal: lose 6kg by January 2027" — the user's own stated goal, restated
 * with the plan's own `projectGoal` month. `weight-promise` cannot tell that from a marketing
 * claim, and the sentence ships by name, so this map names the single field it may appear under:
 * `CHAT_COPY.planGoal`, which `planHeadline` (`onboarding-chat.ts`) fills — and only that key.
 * The same words under any other field name are still refused: the landing stays gated, the rest
 * of `PAGE_COPY` stays gated, notifications and `WEB_COPY` stay gated.
 *
 * Keyed by a QUALIFIED name — `TABLE.key` — on purpose: a bare `planGoal` in some other table
 * must not drift under an exemption written for this one, and every other rule still reads the
 * exempted field (a "Goal: lose 6kg, guaranteed" is still refused).
 */
export const CLAIM_EXEMPTIONS: Readonly<Record<string, readonly string[]>> = {
  "CHAT_COPY.planGoal": ["weight-promise"],
};

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
    const exempt = CLAIM_EXEMPTIONS[field];
    for (const rule of rules) {
      if (exempt !== undefined && exempt.includes(rule.name)) continue;
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
