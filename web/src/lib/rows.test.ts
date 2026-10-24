import { expect, test } from "vitest";
import type { FolderEntry } from "../types";
import { sortFolders } from "./rows";

const f = (name: string, date: string | null): FolderEntry => ({ name, prefix: `r/${name}/`, date });
const batches = [f("2026-10-06_b", "2026-10-06"), f("old", null), f("2026-10-19_a", "2026-10-19")];

test("folders sort by date both ways, undated always last", () => {
  expect(sortFolders(batches, "date", "asc").map((x) => x.name)).toEqual(["2026-10-06_b", "2026-10-19_a", "old"]);
  expect(sortFolders(batches, "date", "desc").map((x) => x.name)).toEqual(["2026-10-19_a", "2026-10-06_b", "old"]);
});

test("folders sort by name both ways, natural order", () => {
  const names = [f("raw", null), f("preprocessing", null), f("b10", null), f("b2", null)];
  expect(sortFolders(names, "name", "asc").map((x) => x.name)).toEqual(["b2", "b10", "preprocessing", "raw"]);
  expect(sortFolders(names, "name", "desc").map((x) => x.name)).toEqual(["raw", "preprocessing", "b10", "b2"]);
});

test("size and uploaded have no folder value, so folders keep name order", () => {
  expect(sortFolders(batches, "size", "desc").map((x) => x.name)).toEqual(["2026-10-06_b", "2026-10-19_a", "old"]);
});
