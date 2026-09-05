// A walker over the analyzer's JSON as it streams: when an object directly inside the top-level
// `items` array closes, that object is parsed on its own and handed out. Nothing else is parsed.
//
// Lives in `llm/` and not in the port because two ports feed it — OpenRouter's deltas and the
// demo's chunks — and the engine consumes it. It is not a JSON parser: it tracks string state,
// escapes and depth, and knows the key `items` at depth 1. That is enough, and a real streaming
// parser is a dependency for one field.

import type { MealItem } from "@eait/shared";
import { MealItemSchema } from "./prompt.ts";

export function itemScanner(onItem: (index: number, item: MealItem) => void): (delta: string) => void {
  let depth = 0;
  let inString = false;
  let escaped = false;
  /** The string currently open; read back as a key when it closes at depth 1. */
  let str = "";
  /** The last string closed at depth 1 — the key an array or object at depth 1 belongs to. */
  let key = "";
  let inItems = false;
  /** The item object being accumulated, or null between items. */
  let item: string | null = null;
  let index = 0;

  return (delta) => {
    for (const ch of delta) {
      if (item !== null) item += ch;
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === '"') { inString = false; if (depth === 1) key = str; }
        else str += ch;
        continue;
      }
      switch (ch) {
        case '"':
          inString = true; str = "";
          break;
        case "{":
          // A new document: a schema retry re-streams from the top and the index starts over.
          if (depth === 0) { index = 0; inItems = false; item = null; }
          if (inItems && depth === 2) item = "{";
          depth++;
          break;
        case "}":
          depth--;
          if (inItems && depth === 2 && item !== null) {
            let value: unknown = null;
            try { value = JSON.parse(item); } catch { /* the model's own bytes; the full parse decides */ }
            const parsed = value === null ? null : MealItemSchema.safeParse(value);
            if (parsed?.success) onItem(index, parsed.data);
            index++;
            item = null;
          }
          break;
        case "[":
          if (depth === 1 && key === "items") inItems = true;
          depth++;
          break;
        case "]":
          depth--;
          if (inItems && depth === 1) inItems = false;
          break;
      }
    }
  };
}
