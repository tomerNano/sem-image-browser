import { expect, test } from "vitest";
import type { FolderEntry } from "../types";
import { hasTag, sortFolders, tagChoices } from "./rows";

const f = (name: string, date: string | null, tags: string[] = []): FolderEntry => ({ name, prefix: `r/${name}/`, date, tags });
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

test("hasTag: empty choice passes everything; otherwise any tag matches", () => {
  expect(hasTag([], "")).toBe(true);
  expect(hasTag(["10-3", "ctrl"], "ctrl")).toBe(true);
  expect(hasTag([], "10-3")).toBe(false);
});

test("tagChoices: distinct tags in natural order, chosen kept when absent", () => {
  expect(tagChoices([f("a", null, ["10-5"]), f("b", null, ["10-3", "10-5"]), f("c", null)], "")).toEqual(["10-3", "10-5"]);
  expect(tagChoices([f("a", null, ["10-3"])], "10-4")).toEqual(["10-4", "10-3"]);
});

test("sortFolders by tag: first tag order, untagged last", () => {
  const out = sortFolders([f("a", null), f("b", null, ["10-5"]), f("c", null, ["10-3"])], "tag", "asc");
  expect(out.map((x) => x.name)).toEqual(["c", "b", "a"]);
});
