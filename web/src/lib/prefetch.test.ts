import { expect, test } from "vitest";
import type { FileEntry } from "../types";
import { previewNeighbours } from "./prefetch";

const files = ["a", "b", "c", "d", "e"].map((key) => ({ key }) as FileEntry);
const keys = (list: FileEntry[]) => list.map((f) => f.key);

test("two ahead and one behind, in visible order", () => {
  expect(keys(previewNeighbours(files, "c"))).toEqual(["d", "e", "b"]);
});

test("stops at the first and the last file", () => {
  expect(keys(previewNeighbours(files, "a"))).toEqual(["b", "c"]);
  expect(keys(previewNeighbours(files, "e"))).toEqual(["d"]);
});

test("a file that is not visible has no neighbours", () => {
  expect(previewNeighbours(files, "zz")).toEqual([]);
});
