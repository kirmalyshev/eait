import { expect, test } from "bun:test";
import { AlbumBuffer } from "./albums.ts";

test("flushes all parts once after the quiet period, keyed independently", async () => {
  const flushed: Array<[string, number[]]> = [];
  const buf = new AlbumBuffer<number>(20, (k, parts) => { flushed.push([k, parts]); });
  buf.add("u1:g1", 1);
  buf.add("u1:g1", 2);
  buf.add("u2:g9", 7);
  await new Promise((r) => setTimeout(r, 60));
  expect(flushed).toContainEqual(["u1:g1", [1, 2]]);
  expect(flushed).toContainEqual(["u2:g9", [7]]);
  expect(flushed.length).toBe(2);
});

test("a part arriving inside the window extends it", async () => {
  const flushed: number[][] = [];
  const buf = new AlbumBuffer<number>(30, (_k, p) => { flushed.push(p); });
  buf.add("k", 1);
  await new Promise((r) => setTimeout(r, 15));
  buf.add("k", 2); // re-arms the timer
  await new Promise((r) => setTimeout(r, 15));
  expect(flushed.length).toBe(0); // still open — the second part extended the window
  await new Promise((r) => setTimeout(r, 30));
  expect(flushed).toEqual([[1, 2]]);
});

test("a key can be reused after its flush (a second album from the same user)", async () => {
  const flushed: number[][] = [];
  const buf = new AlbumBuffer<number>(10, (_k, p) => { flushed.push(p); });
  buf.add("k", 1);
  await new Promise((r) => setTimeout(r, 30));
  buf.add("k", 2);
  await new Promise((r) => setTimeout(r, 30));
  expect(flushed).toEqual([[1], [2]]);
});

test("a synchronously-throwing onFlush cannot crash the process", async () => {
  const buf = new AlbumBuffer<number>(10, () => {
    throw new Error("sync boom");
  });
  buf.add("k", 1);
  await new Promise((r) => setTimeout(r, 40)); // an uncaughtException here would fail the run
  expect(true).toBe(true);
});

test("a rejecting async onFlush is caught, not an unhandled rejection", async () => {
  const buf = new AlbumBuffer<number>(10, async () => {
    throw new Error("async boom");
  });
  buf.add("k", 1);
  await new Promise((r) => setTimeout(r, 40));
  expect(true).toBe(true);
});

test("a group flushes early at the Telegram album cap (10 parts) without waiting for the timer", async () => {
  const flushed: number[][] = [];
  const buf = new AlbumBuffer<number>(10_000, (_k, p) => { flushed.push(p); }); // timer would take 10s
  for (let i = 1; i <= 10; i++) buf.add("k", i);
  await new Promise((r) => setTimeout(r, 20));
  expect(flushed).toEqual([[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]]);
});
