import { expect, test } from "vitest";
import type { FileEntry, ImageMeta } from "../types";
import { formatPixelSize, matchesFilters, NO_FILTERS, sortFiles } from "./rows";

const meta = (m: Partial<ImageMeta>): ImageMeta =>
  ({ gold: "unknown", instrument: "", detector: "", fieldWidthUm: null, pixelSizeUm: null, ...m }) as ImageMeta;
const file = (name: string, m: ImageMeta | null): FileEntry => ({
  name,
  key: `r/${name}`,
  size: 1,
  uploaded: "2026-10-19T09:00:00Z",
  date: null,
  meta: m,
});

test("no filter keeps everything, also files without metadata", () => {
  expect(matchesFilters(null, NO_FILTERS)).toBe(true);
});

test("any filter hides files without metadata", () => {
  expect(matchesFilters(null, { ...NO_FILTERS, gold: "true" })).toBe(false);
});

test("gold, instrument and inclusive field width range", () => {
  const m = meta({ gold: "true", instrument: "XL3", fieldWidthUm: 50 });
  expect(matchesFilters(m, { ...NO_FILTERS, gold: "true", instrument: "XL3" })).toBe(true);
  expect(matchesFilters(m, { ...NO_FILTERS, gold: "false" })).toBe(false);
  expect(matchesFilters(m, { ...NO_FILTERS, fieldWidthMin: "50", fieldWidthMax: "50" })).toBe(true);
  expect(matchesFilters(m, { ...NO_FILTERS, fieldWidthMax: "49.9" })).toBe(false);
  expect(matchesFilters(meta({ fieldWidthUm: null }), { ...NO_FILTERS, fieldWidthMin: "1" })).toBe(false);
});

test("source, variant, resolution and voltage match their shown values", () => {
  const m = meta({ source: "termo", variant: "raw", widthPx: 1920, heightPx: 1275, voltageKv: 10 });
  expect(matchesFilters(m, { ...NO_FILTERS, source: "termo", variant: "raw" })).toBe(true);
  expect(matchesFilters(m, { ...NO_FILTERS, resolution: "1920 × 1275", voltage: "10 kV" })).toBe(true);
  expect(matchesFilters(m, { ...NO_FILTERS, resolution: "1920 × 1200" })).toBe(false);
  expect(matchesFilters(meta({ voltageKv: null }), { ...NO_FILTERS, voltage: "8 kV" })).toBe(false);
});

test("resolution sorts by total pixel count", () => {
  const files = [
    file("small", meta({ widthPx: 1920, heightPx: 1200 })),
    file("none", meta({ widthPx: null, heightPx: null })),
    file("big", meta({ widthPx: 7680, heightPx: 5100 })),
  ];
  expect(sortFiles(files, "resolution", "desc").map((f) => f.name)).toEqual(["big", "small", "none"]);
});

test("metadata columns sort by value, files without a value last in both directions", () => {
  const files = [file("a", meta({ fieldWidthUm: 100 })), file("b", null), file("c", meta({ fieldWidthUm: 20 }))];
  expect(sortFiles(files, "fieldWidth", "asc").map((f) => f.name)).toEqual(["c", "a", "b"]);
  expect(sortFiles(files, "fieldWidth", "desc").map((f) => f.name)).toEqual(["a", "c", "b"]);
});

test("pixel size shows in nm", () => {
  expect(formatPixelSize(0.052083333)).toBe("52.08 nm");
  expect(formatPixelSize(null)).toBe("—");
});
