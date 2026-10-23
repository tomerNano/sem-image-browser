import { expect, test } from "vitest";
import { batchDate, cacheSources, isTiff, validateKey, validatePrefix } from "../src/keys.js";

test.each([
  "yeast/b/raw/cell_1.tiff",
  "yeast/2026-10-07_miluda_5b_termo_b001/raw/Mil 5B 10^1_gold_1.tiff",
])("accepts %s", (k) => expect(validateKey(k, "yeast")).toBe(k));

test.each([
  undefined,
  ["a"],
  "",
  "other/x.tif",
  "/yeast/x.tif",
  "yeast/../secret",
  "yeast\\x.tif",
  "yeast/a/",
  "yeastx/a.tif",
])("rejects key %j", (k) =>
  expect(() => validateKey(k, "yeast")).toThrow(expect.objectContaining({ status: 400 })),
);

test("prefix rules", () => {
  expect(validatePrefix("yeast/", "yeast")).toBe("yeast/");
  expect(() => validatePrefix("yeast/b", "yeast")).toThrow(expect.objectContaining({ status: 400 }));
  expect(() => validatePrefix("yeast/../", "yeast")).toThrow(expect.objectContaining({ status: 400 }));
});

test("batchDate", () => {
  expect(batchDate("yeast/2026-10-06_miluda_5_ns-lab_b001/raw/cell_1.tiff", "yeast")).toBe("2026-10-06");
  expect(batchDate("yeast/2026-10-06_miluda_5_ns-lab_b001/", "yeast")).toBe("2026-10-06");
  expect(batchDate("yeast/old_batch/raw/a.tif", "yeast")).toBeNull();
  expect(batchDate("yeast/2026-13-40_x/", "yeast")).toBeNull();
});

test("isTiff", () => {
  expect(isTiff("a.TIF")).toBe(true);
  expect(isTiff("a.tiff")).toBe(true);
  expect(isTiff("manifest.csv")).toBe(false);
});

test("cacheSources", () => {
  expect(cacheSources("yeast/b/raw/cell_10.tiff")).toEqual({
    thumb: "yeast/b/raw/.cache/cell_10.thumbnail.png",
    png: "yeast/b/raw/.cache/cell_10.png",
  });
  expect(cacheSources("yeast/b/preprocessing/denoise/cell_10.tiff")).toBeNull();
});
