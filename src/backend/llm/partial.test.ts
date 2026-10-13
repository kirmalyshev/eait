import { describe, expect, test } from "bun:test";
import type { MealItem } from "@eait/shared";
import { itemScanner } from "./partial.ts";

const ITEM = (name: string) =>
  `{"name":"${name}","name_en":"${name.toLowerCase()}","grams":100,"kcal":150,"protein_g":10,"carbs_g":5,"fat_g":8,"kcal_per_100g":150}`;
/** The `prompt.photo-lean` shape (#607): the model gives grams and a density, nothing else per item. */
const LEAN_ITEM = (name: string, grams: number, per100: number) =>
  `{"name":"${name}","name_en":"${name.toLowerCase()}","grams":${grams},"kcal_per_100g":${per100}}`;
const DOC = `{"isFood":true,"scale":{"reference":"plate","plate_diameter_cm":27},"items":[${ITEM("Rice")},${ITEM("Chicken")}],"kcal":300,"protein_g":20,"carbs_g":10,"fat_g":16,"satfat_g":2,"fiber_g":1,"sugar_g":0,"sodium_mg":200,"confidence":"high","notes":"a { brace } in [ notes ]","question":{"text":"Oil?","options":["Yes","No"]}}`;

function run(chunks: string[]) {
  const got: [number, string][] = [];
  const feed = itemScanner((i, it) => got.push([i, it.name]));
  for (const c of chunks) feed(c);
  return got;
}

describe("itemScanner", () => {
  test("emits each item as it closes, in one chunk", () => {
    expect(run([DOC])).toEqual([[0, "Rice"], [1, "Chicken"]]);
  });

  test("survives chunk boundaries inside a string, a number and an escape", () => {
    const doc = DOC.replace('"Rice"', '"Ri\\"ce"');
    for (const size of [1, 3, 7, 40]) {
      const chunks: string[] = [];
      for (let i = 0; i < doc.length; i += size) chunks.push(doc.slice(i, i + size));
      expect(run(chunks)).toEqual([[0, 'Ri"ce'], [1, "Chicken"]]);
    }
  });

  test("ignores scale, question.options and braces inside strings", () => {
    expect(run([DOC]).length).toBe(2);
  });

  test("skips an item that is not a MealItem and keeps counting the valid ones", () => {
    const doc = `{"items":[{"grams":"x"},${ITEM("Egg")}]}`;
    expect(run([doc])).toEqual([[1, "Egg"]]);
  });

  test("an items key nested deeper than the top level is not the items array", () => {
    const doc = `{"scale":{"items":[${ITEM("Nope")}]},"items":[${ITEM("Yes")}]}`;
    expect(run([doc])).toEqual([[0, "Yes"]]);
  });

  test("a second document restarts the index", () => {
    expect(run([`{"items":[${ITEM("A")}]}`, `{"items":[${ITEM("B")}]}`])).toEqual([[0, "A"], [0, "B"]]);
  });

  test("a lean item emits too (#607): kcal from grams × kcal_per_100g, macros absent", () => {
    const doc = `{"isFood":true,"scale":{"reference":"plate"},"items":[${LEAN_ITEM("Rice", 200, 130)},${LEAN_ITEM("Chicken", 150, 165)}],"kcal":500,"protein_g":30,"carbs_g":40,"fat_g":20,"confidence":"high","notes":"","question":null}`;
    const got: [number, MealItem][] = [];
    const feed = itemScanner((i, it) => got.push([i, it]));
    for (let i = 0; i < doc.length; i += 7) feed(doc.slice(i, i + 7));
    expect(got.map(([i, it]) => [i, it.name, it.kcal])).toEqual([[0, "Rice", 260], [1, "Chicken", 248]]);
    expect(got[0]![1]).not.toHaveProperty("protein_g");
  });

  test("a lean item with a role mark keeps it", () => {
    const oil = `{"name":"Olive oil (cooking)","name_en":"cooking oil","grams":10,"kcal_per_100g":884,"role":"cooking-fat"}`;
    const got: MealItem[] = [];
    const feed = itemScanner((_i, it) => got.push(it));
    feed(`{"items":[${oil}]}`);
    expect(got[0]).toMatchObject({ role: "cooking-fat", kcal: 88 });
  });
});
