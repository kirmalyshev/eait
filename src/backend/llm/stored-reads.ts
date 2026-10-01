// Three frozen production reads (qwen3-vl-235b, #1158) the demo analyzer replays for the store capture.
// A locale changes item names and notes only — every number stays the read's own.

import type { Lang } from "@eait/shared";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AnalyzedMeal } from "./port.ts";

export type Meal = "grainbowl" | "eggs" | "salmon";
// Read on the first replay, which only `demoPorts()` can make — never at import.
let reads: Record<Meal, AnalyzedMeal> | undefined;
const READS = (): Record<Meal, AnalyzedMeal> => (reads ??= JSON.parse(readFileSync(join(import.meta.dir, "stored-reads.json"), "utf8")));

/** The licensed photos by the size the phone sends them at (768 px long edge, the monorepo's
 * `lib/capture.ts`): 933x1400 and 1400x788. Their bytes are re-encoded, so never known. */
const PHOTOS: Record<string, Meal> = { "512x768": "grainbowl", "768x433": "salmon" };

/** The capture's typed meal, in each language the walk types it in. */
export const SENTENCES: Partial<Record<Lang, string>> = {
  en: "Two boiled eggs and a slice of rye bread",
  de: "Zwei gekochte Eier und eine Scheibe Roggenbrot",
  fr: "Deux œufs durs et une tranche de pain de seigle",
  it: "Due uova sode e una fetta di pane di segale",
  es: "Dos huevos duros y una rebanada de pan de centeno",
};

/** The notes, localised like the names: the model's meaning and figures, nothing added. */
const NOTES: Partial<Record<Lang, Record<Meal, string>>> = {
  de: {
    grainbowl: "Tellerdurchmesser auf 26cm geschätzt. Portionsgrößen nach Augenmaß skaliert. Olivenöl aus dem Glanz auf dem Gemüse geschlossen.",
    eggs: "Übliche gekochte Eier und eine typische deutsche Scheibe Roggenbrot (40g) angenommen. Kein zusätzliches Fett und keine Beläge erwähnt.",
    salmon: "Der Teller ist ein Standard-Speiseteller von 26cm. Die Glasur auf dem Lachs und der Brokkoli deuten auf etwas Öl beim Anbraten hin. Portionsgrößen aus Tellerbedeckung und Höhe geschätzt.",
  },
  fr: {
    grainbowl: "Diamètre de l'assiette estimé à 26cm. Portions évaluées visuellement. Huile d'olive déduite de la brillance des légumes.",
    eggs: "On suppose des œufs durs standard et une tranche typique de pain de seigle allemand (40g). Aucune matière grasse ni garniture ajoutée n'est mentionnée.",
    salmon: "L'assiette est une assiette plate standard de 26cm. Le glaçage du saumon et le brocoli suggèrent un peu d'huile pour faire sauter. Portions estimées d'après la surface couverte et l'épaisseur.",
  },
  it: {
    grainbowl: "Diametro del piatto stimato in 26cm. Porzioni valutate a occhio. Olio d'oliva dedotto dalla lucentezza delle verdure.",
    eggs: "Si presumono uova sode standard e una tipica fetta di pane di segale tedesco (40g). Nessun grasso aggiunto o condimento indicato.",
    salmon: "Il piatto è un piatto piano standard da 26cm. La glassa del salmone e i broccoli suggeriscono un po' di olio per la saltatura. Porzioni stimate dalla superficie occupata e dallo spessore.",
  },
  es: {
    grainbowl: "Diámetro del plato estimado en 26cm. Raciones calculadas a ojo. Aceite de oliva deducido del brillo de las verduras.",
    eggs: "Se suponen huevos duros estándar y una rebanada típica de pan de centeno alemán (40g). No se mencionan grasas añadidas ni ingredientes extra.",
    salmon: "El plato es un plato llano estándar de 26cm. El glaseado del salmón y el brócoli sugieren un poco de aceite al saltear. Raciones estimadas por la superficie cubierta y la altura.",
  },
};

/** Names-only localisation, in the read's item order; numbers and `name_en` stay the read's. */
const NAMES: Partial<Record<Lang, Record<Meal, readonly string[]>>> = {
  de: {
    grainbowl: ["Quinoa", "Brokkoli", "Rote Paprika", "Gurke", "Karotte", "Tomate", "Staudensellerie", "Olivenöl (Dressing)"],
    eggs: ["Zwei gekochte Eier", "Scheibe Roggenbrot"],
    salmon: ["Lachsfilet", "Weißer Reis", "Brokkoliröschen", "Sojasoße (Glasur)", "Sesamöl (zum Braten)"],
  },
  fr: {
    grainbowl: ["Quinoa", "Brocoli", "Poivron rouge", "Concombre", "Carotte", "Tomate", "Céleri", "Huile d'olive (assaisonnement)"],
    eggs: ["Deux œufs durs", "Tranche de pain de seigle"],
    salmon: ["Filet de saumon", "Riz blanc", "Fleurettes de brocoli", "Sauce soja (glaçage)", "Huile de sésame (cuisson)"],
  },
  it: {
    grainbowl: ["Quinoa", "Broccoli", "Peperone rosso", "Cetriolo", "Carota", "Pomodoro", "Sedano", "Olio d'oliva (condimento)"],
    eggs: ["Due uova sode", "Fetta di pane di segale"],
    salmon: ["Filetto di salmone", "Riso bianco", "Cimette di broccoli", "Salsa di soia (glassa)", "Olio di sesamo (cottura)"],
  },
  es: {
    grainbowl: ["Quinoa", "Brócoli", "Pimiento rojo", "Pepino", "Zanahoria", "Tomate", "Apio", "Aceite de oliva (aliño)"],
    eggs: ["Dos huevos duros", "Rebanada de pan de centeno"],
    salmon: ["Filete de salmón", "Arroz blanco", "Ramilletes de brócoli", "Salsa de soja (glaseado)", "Aceite de sésamo (para cocinar)"],
  },
};

export function storedRead(meal: Meal, lang: Lang): AnalyzedMeal {
  const read = structuredClone(READS()[meal]);
  const names = NAMES[lang]?.[meal];
  if (names) read.items = read.items.map((item, i) => ({ ...item, name: names[i] ?? item.name }));
  const notes = NOTES[lang]?.[meal];
  if (notes) read.notes = notes;
  return read;
}

/** Width × height from a baseline or progressive JPEG header — what the phone uploads; null otherwise. */
export function imageSize(bytes: Uint8Array): string | null {
  const be = (i: number, n: number) => bytes.slice(i, i + n).reduce((v, b) => v * 256 + b, 0);
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  for (let i = 2; i + 9 < bytes.length;) {
    if (bytes[i] !== 0xff) return null;
    const marker = bytes[i + 1]!;
    if (marker === 0xc0 || marker === 0xc2) return `${be(i + 7, 2)}x${be(i + 5, 2)}`;
    i += 2 + be(i + 2, 2);
  }
  return null;
}

export function storedPhotoRead(images: readonly Uint8Array[], lang: Lang): AnalyzedMeal | null {
  const meal = images.length === 1 ? PHOTOS[imageSize(images[0]!) ?? ""] : undefined;
  return meal ? storedRead(meal, lang) : null;
}

export function storedTextRead(text: string, lang: Lang): AnalyzedMeal | null {
  return text.trim() === SENTENCES[lang] ? storedRead("eggs", lang) : null;
}
