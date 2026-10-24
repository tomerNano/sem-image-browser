import { expect, test } from "vitest";
import { parseCsv } from "../src/csv.js";

test("reads rows keyed by the header", () => {
  expect(parseCsv("a,b\n1,2\n3,4\n")).toEqual([
    { a: "1", b: "2" },
    { a: "3", b: "4" },
  ]);
});

test("handles quotes, commas, doubled quotes and line breaks inside a field", () => {
  const rows = parseCsv('name,note\r\n"x, y","say ""hi""\nnext line"\r\n');
  expect(rows).toEqual([{ name: "x, y", note: 'say "hi"\nnext line' }]);
});

test("keeps empty fields, fills short rows, skips blank lines, strips a BOM", () => {
  expect(parseCsv("﻿a,b,c\n1,,3\n\n4\n")).toEqual([
    { a: "1", b: "", c: "3" },
    { a: "4", b: "", c: "" },
  ]);
});

test("last row without a trailing newline still counts", () => {
  expect(parseCsv("a\n1")).toEqual([{ a: "1" }]);
});

test("empty text gives no rows", () => {
  expect(parseCsv("")).toEqual([]);
});
