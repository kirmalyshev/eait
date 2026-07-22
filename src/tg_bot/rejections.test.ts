import { expect, test } from "bun:test";
import { RejectionLog } from "./rejections.ts";

test("remembers per user, evicts FIFO past 20, no cross-user hits", () => {
  const log = new RejectionLog();
  log.add(1, 100);
  expect(log.has(1, 100)).toBe(true);
  expect(log.has(2, 100)).toBe(false);
  for (let i = 0; i < 20; i++) log.add(1, 200 + i);
  expect(log.has(1, 100)).toBe(false); // evicted by the 20-entry bound
  expect(log.has(1, 219)).toBe(true);
});
