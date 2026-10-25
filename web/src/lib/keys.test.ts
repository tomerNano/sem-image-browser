import { expect, test } from "vitest";
import { moveIndex } from "./keys";

test("grid: left and right step one item, up and down one row, stopping at the edges", () => {
  // 10 items in 4 columns: rows 0-3, 4-7, 8-9.
  expect(moveIndex("ArrowRight", 5, 10, 4)).toBe(6);
  expect(moveIndex("ArrowLeft", 0, 10, 4)).toBe(0);
  expect(moveIndex("ArrowDown", 5, 10, 4)).toBe(9);
  expect(moveIndex("ArrowDown", 7, 10, 4)).toBe(7);
  expect(moveIndex("ArrowUp", 2, 10, 4)).toBe(2);
  expect(moveIndex("ArrowRight", 9, 10, 4)).toBe(9);
});

test("table: up and down move one row; left and right do nothing", () => {
  expect(moveIndex("ArrowDown", 3, 10, 1)).toBe(4);
  expect(moveIndex("ArrowUp", 0, 10, 1)).toBe(0);
  expect(moveIndex("ArrowRight", 3, 10, 1)).toBe(3);
});

test("nothing selected: any move selects the first item; Home and End jump to the ends", () => {
  expect(moveIndex("ArrowDown", -1, 10, 4)).toBe(0);
  expect(moveIndex("End", 2, 10, 4)).toBe(9);
  expect(moveIndex("Home", 7, 10, 4)).toBe(0);
  expect(moveIndex("Enter", 2, 10, 4)).toBeNull();
  expect(moveIndex("ArrowDown", -1, 0, 4)).toBeNull();
});
