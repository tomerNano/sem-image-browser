import { expect, test } from "vitest";
import { createLimiter } from "../src/limit.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

test("runs at most 4 tasks at once and keeps result order", async () => {
  const limit = createLimiter(4);
  let active = 0;
  let maxActive = 0;
  const results = await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      limit(async () => {
        active++;
        maxActive = Math.max(maxActive, active);
        await sleep(10);
        active--;
        return i;
      }),
    ),
  );
  expect(maxActive).toBe(4);
  expect(results).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
});

test("a failing task rejects only its own promise", async () => {
  const limit = createLimiter(1);
  const bad = limit(async () => {
    throw new Error("boom");
  });
  const good = limit(async () => "ok");
  await expect(bad).rejects.toThrow("boom");
  await expect(good).resolves.toBe("ok");
});
