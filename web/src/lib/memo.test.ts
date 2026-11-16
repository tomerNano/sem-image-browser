import { expect, test } from "vitest";
import { memoByKey } from "./memo";

/** A loader that counts its calls; `fail` makes the next call reject. */
function counting() {
  const state = { calls: 0, fail: false };
  const load = async (key: string) => {
    state.calls++;
    if (state.fail) throw new Error("down");
    return `value of ${key}`;
  };
  return { state, load };
}

test("the same key within the time limit loads once, also when asked at the same moment", async () => {
  const { state, load } = counting();
  let now = 0;
  const get = memoByKey(load, 1000, () => now);
  const [a, b] = await Promise.all([get("x"), get("x")]);
  now = 999;
  const c = await get("x");
  expect([a, b, c]).toEqual(["value of x", "value of x", "value of x"]);
  expect(state.calls).toBe(1);
});

test("other keys and expired answers load again", async () => {
  const { state, load } = counting();
  let now = 0;
  const get = memoByKey(load, 1000, () => now);
  await get("x");
  await get("y");
  now = 1000;
  await get("x");
  expect(state.calls).toBe(3);
});

test("a failed load is not remembered", async () => {
  const { state, load } = counting();
  const get = memoByKey(load, 1000, () => 0);
  state.fail = true;
  await expect(get("x")).rejects.toThrow("down");
  state.fail = false;
  expect(await get("x")).toBe("value of x");
  expect(state.calls).toBe(2);
});
