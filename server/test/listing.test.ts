import { expect, test } from "vitest";
import { mapListing } from "../src/listing.js";

const d = new Date("2026-10-19T09:00:00Z");

test("root: dated batches newest first, undated last", () => {
  const r = mapListing("yeast/", "yeast", {
    prefixes: ["yeast/2026-08-30_a_termo_b001/", "yeast/old/", "yeast/2026-10-06_b_ns-lab_b001/"],
    objects: [],
  });
  expect(r.folders.map((f) => f.name)).toEqual(["2026-10-06_b_ns-lab_b001", "2026-08-30_a_termo_b001", "old"]);
  expect(r.folders[2].date).toBeNull();
});

test("raw folder: hides .cache and non-TIFF, natural sort, carries batch date", () => {
  const p = "yeast/2026-10-06_b_ns-lab_b001/raw/";
  const r = mapListing(p, "yeast", {
    prefixes: [p + ".cache/"],
    objects: [
      { key: p, size: 0, lastModified: d },
      { key: p + "cell_10.tiff", size: 5, lastModified: d },
      { key: p + "cell_2.TIF", size: 5, lastModified: d },
      { key: p + "notes.txt", size: 5, lastModified: d },
    ],
  });
  expect(r.folders).toEqual([]);
  expect(r.files.map((f) => f.name)).toEqual(["cell_2.TIF", "cell_10.tiff"]);
  expect(r.files[0]).toEqual({
    name: "cell_2.TIF",
    key: p + "cell_2.TIF",
    size: 5,
    uploaded: d.toISOString(),
    date: "2026-10-06",
    meta: null,
    tags: [],
  });
});

test("root folders and files carry their split's tags; sub-folders have none", () => {
  const tagsFor = (s: string) => (s === "2026-10-06_b_ns-lab_b001" ? ["10-3"] : []);
  const root = mapListing("yeast/", "yeast", { prefixes: ["yeast/2026-10-06_b_ns-lab_b001/", "yeast/old/"], objects: [] }, undefined, tagsFor);
  expect(root.folders.map((f) => f.tags)).toEqual([["10-3"], []]);
  const p = "yeast/2026-10-06_b_ns-lab_b001/";
  const inside = mapListing(p, "yeast", { prefixes: [p + "raw/"], objects: [{ key: p + "cell_1.tiff", size: 1, lastModified: d }] }, undefined, tagsFor);
  expect(inside.folders[0].tags).toEqual([]);
  expect(inside.files[0].tags).toEqual(["10-3"]);
});
