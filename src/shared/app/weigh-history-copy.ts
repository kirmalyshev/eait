// The weigh-in history's words (ieat-app#891): the Weight changes card and the "All weigh-ins"
// list, per `product/design/gen/src/boards/parity_w3.rs` §#891 on ieat-app main. The figures are
// numbers the client formats ({n} through `decimalNumbers`); "Delete" and "Log weight" are the
// existing `chat-copy` / `you-copy` words, not repeated here.
//
// A table of its own, not a block of `PROGRESS_COPY`: a language not listed here falls back to
// English whole (`t()`), so the localizer pass fills them in without touching Progress's tables.

import { t, type Localized } from "../lang.ts";
import type { Lang } from "../types.ts";
import type { UnitSystem } from "../ui/units.ts";

export interface WeighHistoryCopy {
  changesTitle: string;
  /** The row labels: 3, 7, 14, 30 and 90 days, and everything since the first weigh-in. */
  change3: string;
  change7: string;
  change14: string;
  change30: string;
  change90: string;
  changeAll: string;
  /** The list's title, and the link to it under the weight card. */
  historyTitle: string;
  sourceHealth: string;
  sourceYou: string;
  historyEmptyTitle: string;
  historyEmptyNote: string;
  /** A weight with its unit word, `{n}` already formatted (signed for a change). */
  rowWeight: Record<UnitSystem, string>;
}

const EN: WeighHistoryCopy = {
  changesTitle: "Weight changes",
  change3: "3 days", change7: "7 days", change14: "14 days", change30: "30 days", change90: "90 days", changeAll: "All",
  historyTitle: "All weigh-ins",
  sourceHealth: "From Apple Health",
  sourceYou: "You",
  historyEmptyTitle: "No weigh-ins yet",
  historyEmptyNote: "Apple Health's weigh-ins show here too.",
  rowWeight: { metric: "{n} kg", imperial: "{n} lb" },
};

const RU: WeighHistoryCopy = {
  changesTitle: "Изменение веса",
  change3: "3 дня", change7: "7 дней", change14: "14 дней", change30: "30 дней", change90: "90 дней", changeAll: "Всё время",
  historyTitle: "Все взвешивания",
  sourceHealth: "Из Apple Health",
  sourceYou: "Ты",
  historyEmptyTitle: "Пока нет взвешиваний",
  historyEmptyNote: "Взвешивания из Apple Health тоже появятся здесь.",
  rowWeight: { metric: "{n} кг", imperial: "{n} фунт." },
};

export const WEIGH_HISTORY_COPY: Localized<WeighHistoryCopy> = { en: EN, ru: RU };
export const weighHistoryCopyFor = (lang: Lang): WeighHistoryCopy => t(lang)(WEIGH_HISTORY_COPY);
