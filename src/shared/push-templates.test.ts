import { describe, expect, test } from "bun:test";
import { LANGS, type Lang } from "./types.ts";
import { NOTIFICATION_IDS, notificationCopyFor } from "./notifications.ts";
import {
  PUSH_TEMPLATE_VARIANTS, isCampaignTemplateKey, pickVariant, pluralCategories, pushClaimErrors, pushKeyGaps,
  pushRowsFromCopy, copyFromPushRows, validatePushTemplate, validatePushText,
  type PushTemplateRow,
} from "./push-templates.ts";

const stamp = "2026-10-08T00:00:00.000Z";
const reviewedRows = (): PushTemplateRow[] =>
  LANGS.flatMap((lang) =>
    pushRowsFromCopy(lang, notificationCopyFor(lang)).map((r) => ({
      ...r, status: "reviewed" as const, reviewed_by: "t", reviewed_at: stamp, updated_at: stamp,
    })),
  );

describe("plural categories", () => {
  const want: Record<Lang, string[]> = {
    en: ["one", "other"], de: ["one", "other"],
    fr: ["one", "many", "other"], it: ["one", "many", "other"], es: ["one", "many", "other"],
    ru: ["one", "few", "many", "other"], id: ["other"], vi: ["other"],
  };
  for (const lang of LANGS) {
    test(`${lang} requires exactly ${want[lang].join("/")}`, () => {
      expect([...pluralCategories(lang)].sort()).toEqual([...want[lang]].sort());
    });
  }

  const block = (cats: string[]) =>
    `In {days, plural, ${cats.map((c) => `${c} {x}`).join(" ")}}`;

  test("a block with every category its language needs passes", () => {
    for (const lang of LANGS) expect(validatePushText(block(want[lang]), lang, ["days"])).toEqual([]);
  });
  test("ru without few is refused, naming it", () => {
    const errs = validatePushText(block(["one", "many", "other"]), "ru", ["days"]);
    expect(errs.join()).toContain("few");
  });
  test("en with a category English never uses is refused", () => {
    expect(validatePushText(block(["one", "few", "other"]), "en", ["days"]).join()).toContain("few");
  });
  test("a block with no other is refused", () => {
    expect(validatePushText("{days, plural, one {x}}", "en", ["days"]).join()).toContain("other");
  });
  test("a plural argument nothing fills is refused", () => {
    expect(validatePushText(block(want.en), "en", []).join()).toContain("days");
  });
});

describe("template validation", () => {
  const ok = { key: "nudge", lang: "en", variant: "default", title: "Today's meals", body: "Log what you ate." };
  test("a well-formed template passes", () => expect(validatePushTemplate(ok)).toEqual({ ok: true }));
  test("unknown key and variant are refused", () => {
    expect(validatePushTemplate({ ...ok, key: "spam" }).ok).toBe(false);
    expect(validatePushTemplate({ ...ok, variant: "empty" }).ok).toBe(false);
  });
  test("a placeholder nothing fills is refused, and a required one may not be dropped", () => {
    expect(validatePushTemplate({ ...ok, body: "Hi {name}" }).ok).toBe(false);
    const ev = { key: "evening", lang: "en", variant: "default", title: "T", body: "{eaten} {plan} {tomorrow}" };
    expect(validatePushTemplate(ev)).toEqual({ ok: true });
    expect(validatePushTemplate({ ...ev, body: "{eaten} {plan}" }).ok).toBe(false);
  });
  test("over-long body is refused", () => {
    expect(validatePushTemplate({ ...ok, body: "x".repeat(241) }).ok).toBe(false);
  });
});

describe("claims gate", () => {
  test("a health claim is refused", () => {
    expect(pushClaimErrors("Hi", "Guaranteed weight loss in a week").length).toBeGreaterThan(0);
    expect(pushClaimErrors("Hi", "Garantierter Gewichtsverlust").length).toBeGreaterThan(0);
  });
  test("a literal health value is refused", () => {
    expect(pushClaimErrors("Hi", "You ate 1800 kcal today").length).toBeGreaterThan(0);
    expect(pushClaimErrors("Hi", "Du wiegst 82 kg").length).toBeGreaterThan(0);
  });
  test("a placeholder is not a value", () => {
    expect(pushClaimErrors("Today", "{eaten} of your {plan}kcal today. {tomorrow}")).toEqual([]);
  });
});

describe("health values in eight languages", () => {
  const bad = [
    "You ate 1800 kcal", "You ate 1,800 calories", "Du hast 1.800 Kalorien", "Tu as mangé 1800 calories",
    "Hai mangiato 1800 calorie", "Has comido 1800 calorías", "Bạn đã ăn 1800 calo", "Kamu makan 1800 kalori",
    "Ты съел 1800 калорий", "Ты съел 1800 ккал", "Du wiegst 82 kg", "Du wiegst 82 Kilo", "Tu pèses 82 kilos",
    "Pesas 82 kilogramos", "Ты весишь 82 кг", "Ты весишь 82 килограмма", "You had 30 g of protein",
    "Du hattest 30 Gramm", "Tu as pris 30 grammes", "Hai preso 30 grammi", "Comiste 30 gramos",
    "Bạn ăn 30 gram", "Kamu makan 30 gram", "Ты съел 30 г белка", "Ты съел 30 грамм", "You weigh 180 lbs",
    "You weigh 180 pounds", "Pesas 180 libras", "Du wiegst 180 Pfund", "Ты весишь 180 фунтов",
    "Your BP is 120 mmHg", "Glucose 5 mmol", "Heart rate 60 bpm", "You are at 25%",
  ];
  for (const text of bad) test(`refuses "${text}"`, () => expect(pushClaimErrors("Hi", text).join()).toContain("health value"));
  const fine = ["Log your 3 meals", "Take 5 minutes", "Du hast 3 Mahlzeiten", "Tomorrow in 2 days", "Dans 3 gâteaux", "Wähle 1 gut", "{eaten} von {plan}kcal"];
  for (const text of fine) test(`allows "${text}"`, () => expect(pushClaimErrors("Hi", text)).toEqual([]));
});

describe("Russian gender guard", () => {
  test("a past-tense line to the reader is refused, a neutral one is not", () => {
    expect(pushClaimErrors("Вечер", "Что ты ел? {eaten} из {plan}ккал.").join()).toContain("gender");
    expect(pushClaimErrors("Вечер", "Запиши сегодняшнюю еду — хватит одного фото.")).toEqual([]);
  });
});

describe("the empty-day variant has no title of its own", () => {
  test("a title on it is refused, none is required", () => {
    const base = { key: "evening", lang: "en", variant: "empty", body: "Nothing — {plan} {tomorrow}" };
    expect(validatePushTemplate({ ...base, title: "" })).toEqual({ ok: true });
    expect(validatePushTemplate({ ...base, title: "Edited" }).ok).toBe(false);
  });
});

describe("completeness", () => {
  test("shipped copy, all eight languages reviewed, is complete for every key", () => {
    const rows = reviewedRows();
    for (const key of NOTIFICATION_IDS) expect(pushKeyGaps(rows, key)).toEqual([]);
  });
  test("a missing language names itself and the variant", () => {
    const rows = reviewedRows().filter((r) => !(r.key === "evening" && r.lang === "ru" && r.variant === "empty"));
    expect(pushKeyGaps(rows, "evening")).toEqual(["ru/empty"]);
    expect(pushKeyGaps(rows, "nudge")).toEqual([]);
  });
  test("a draft row does not count", () => {
    const rows = reviewedRows().map((r) =>
      r.key === "nudge" && r.lang === "vi" ? { ...r, status: "draft" as const } : r);
    expect(pushKeyGaps(rows, "nudge")).toEqual(["vi/default"]);
  });
  test("the variants table covers every id", () => {
    expect(Object.keys(PUSH_TEMPLATE_VARIANTS).sort()).toEqual([...NOTIFICATION_IDS].sort());
  });
});

describe("existing copy round-trips unchanged", () => {
  for (const lang of LANGS) {
    test(lang, () => {
      const rows = reviewedRows().filter((r) => r.lang === lang);
      expect(copyFromPushRows(rows, lang, notificationCopyFor("en"))).toEqual(notificationCopyFor(lang));
    });
    test(`${lang} passes validation and the gate`, () => {
      for (const r of pushRowsFromCopy(lang, notificationCopyFor(lang))) {
        expect(validatePushTemplate(r)).toEqual({ ok: true });
        expect(pushClaimErrors(r.title, r.body)).toEqual([]);
      }
    });
  }
});

describe("rotation", () => {
  const day = 86_400_000;
  const now = Date.UTC(2026, 9, 8);
  test("skips a variant used in the last 7 days", () => {
    expect(pickVariant(["a", "b", "c"], [{ variant: "a", sentAt: now - 2 * day }], now)).toBe("b");
  });
  test("a use older than 7 days does not count", () => {
    expect(pickVariant(["a", "b"], [{ variant: "a", sentAt: now - 8 * day }], now)).toBe("a");
  });
  test("all used: the least recently used wins", () => {
    const used = [{ variant: "a", sentAt: now - 1 * day }, { variant: "b", sentAt: now - 5 * day }];
    expect(pickVariant(["a", "b"], used, now)).toBe("b");
  });
});

describe("campaign template keys", () => {
  const row = (key: string, lang: string, over: Record<string, unknown> = {}) =>
    ({ key, lang, variant: "default", title: "Hello", body: "Plain words for everyone.", ...over });

  test("accept campaign:<slug>, one default variant", () => {
    expect(validatePushTemplate(row("campaign:win-back", "en")).ok).toBe(true);
    expect(validatePushTemplate(row("campaign:win-back", "en", { variant: "empty" })).ok).toBe(false);
  });
  test("refuse a placeholder: a campaign is the same words for everybody", () => {
    const r = validatePushTemplate(row("campaign:win-back", "en", { body: "You ate {eaten} today." }));
    expect(r.ok).toBe(false);
  });
  test("reserve the system names, with or without the prefix", () => {
    for (const k of ["campaign:evening", "campaign:nudge", "campaign:trial-end", "campaign:streak", "campaign:onboarding", "campaign:campaign", "campaign:Bad"]) {
      expect(isCampaignTemplateKey(k)).toBe(false);
      expect(validatePushTemplate(row(k, "en")).ok).toBe(false);
    }
    expect(isCampaignTemplateKey("campaign:win-back-2")).toBe(true);
  });
  test("complete only when all eight languages are reviewed", () => {
    const reviewed = LANGS.map((lang) => ({ ...row("campaign:win-back", lang), status: "reviewed", reviewed_by: "a", reviewed_at: "x", updated_at: "x" }));
    expect(pushKeyGaps(reviewed as never, "campaign:win-back")).toEqual([]);
    const missing = reviewed.filter((r) => r.lang !== "ru");
    expect(pushKeyGaps(missing as never, "campaign:win-back")).toEqual(["ru/default"]);
  });
});
