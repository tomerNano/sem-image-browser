import { expect, test } from "vitest";
import { scaleBar } from "./scale";

test("picks a round length near the target width", () => {
  // 100 µm across 1250 px: 0.08 µm per px, so 150 px is 12 µm and 10 µm (125 px) is closest.
  expect(scaleBar(100, 1250)).toEqual({ px: 125, label: "10 µm" });
});

test("zooming in shortens the bar's length, not its size on screen", () => {
  // 8x zoom: 100 µm across 10,000 px, so 150 px is 1.5 µm; 1 µm and 2 µm tie, the shorter wins.
  const bar = scaleBar(100, 1250 * 8)!;
  expect(bar.label).toBe("1 µm");
  expect(bar.px).toBeCloseTo(100);
});

test("below 1 µm the label is in nm", () => {
  expect(scaleBar(5, 1000)?.label).toBe("500 nm");
});

test("no field width, no bar", () => {
  expect(scaleBar(null, 1000)).toBeNull();
  expect(scaleBar(100, 0)).toBeNull();
});
