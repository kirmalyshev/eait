// What a meal is called on one line — the web's rows and cards, the phone's rows, sheets and chat cards.

/**
 * The first two item names, " +N" for the rest, the first character upper-cased (a typed meal's
 * items carry the user's own casing). Empty for no items; the caller supplies its untitled word.
 */
export const mealNames = (items: readonly { name: string }[]): string => {
  const shown = items.slice(0, 2).map((i) => i.name).join(", ");
  const more = items.length > 2 ? ` +${items.length - 2}` : "";
  return shown.charAt(0).toUpperCase() + shown.slice(1) + more;
};
