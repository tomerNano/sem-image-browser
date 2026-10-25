import { describe, expect, test } from "vitest";
import type { FileEntry, ImageMeta } from "../types";
import { activeFilterCount, choices, field, FIELDS, matchesFilters, MISSING, NO_FILTERS, sortFiles, type FieldId } from "./fields";

const SAMPLE: ImageMeta = {
  imageId: "img_1",
  experiment: "exp_a",
  source: "termo",
  split: "train",
  variant: "raw",
  gold: "true",
  instrument: "XL3",
  detector: "ETD",
  acquiredAt: "2026-10-12T11:09:45",
  widthPx: 1920,
  heightPx: 1275,
  pixelSizeUm: 0.052083333,
  fieldWidthUm: 100.0000002,
  fieldHeightUm: 66.4,
  voltageKv: 10.004,
  workingDistanceMm: 5.256,
  dwellTimeNs: 300,
  spotSize: 3.5,
  integrations: 4,
};

const meta = (m: Partial<ImageMeta> = {}): ImageMeta => ({ ...SAMPLE, ...m });
const file = (name: string, m: ImageMeta | null, extra: Partial<FileEntry> = {}): FileEntry => ({
  name,
  key: `r/${name}`,
  size: 2048,
  uploaded: "2026-10-19T09:00:00Z",
  date: "2026-10-12",
  meta: m,
  ...extra,
});

describe("each Field formats a sample file and a file without a Registry row", () => {
  const expected: Record<FieldId, [string, string]> = {
    name: ["cell_1.tiff", "cell_1.tiff"],
    date: ["2026-10-12", "2026-10-12"],
    size: ["2.0 KB", "2.0 KB"],
    acquired: ["2026-10-12 11:09:45", MISSING],
    fieldWidth: ["100.0 µm", MISSING],
    fieldHeight: ["66.4 µm", MISSING],
    pixelSize: ["52.08 nm", MISSING],
    resolution: ["1920 × 1275", MISSING],
    instrument: ["XL3", MISSING],
    detector: ["ETD", MISSING],
    voltage: ["10 kV", MISSING],
    workingDistance: ["5.26 mm", MISSING],
    dwellTime: ["300 ns", MISSING],
    spotSize: ["3.5", MISSING],
    integrations: ["4", MISSING],
    gold: ["Yes", MISSING],
    experiment: ["exp_a", MISSING],
    source: ["termo", MISSING],
    variant: ["raw", MISSING],
    imageId: ["img_1", MISSING],
    uploaded: [new Date("2026-10-19T09:00:00Z").toLocaleString(), new Date("2026-10-19T09:00:00Z").toLocaleString()],
  };
  test.each(FIELDS.map((f) => f.id))("%s", (id) => {
    const [withMeta, withoutMeta] = expected[id];
    expect(field(id).format(file("cell_1.tiff", meta()))).toBe(withMeta);
    expect(field(id).format(file("cell_1.tiff", null))).toBe(withoutMeta);
  });
});

test("an empty Registry text and a missing date show as missing", () => {
  expect(field("instrument").format(file("a", meta({ instrument: "" })))).toBe(MISSING);
  expect(field("date").format(file("a", null, { date: null }))).toBe(MISSING);
});

test("no filter keeps everything, also files without metadata", () => {
  expect(matchesFilters(file("a", null), NO_FILTERS)).toBe(true);
});

test("any filter hides files without metadata", () => {
  expect(matchesFilters(file("a", null), { gold: "Yes" })).toBe(false);
});

test("choice filters compare the shown value", () => {
  const f = file("a", meta());
  expect(matchesFilters(f, { gold: "Yes", instrument: "XL3", source: "termo", variant: "raw" })).toBe(true);
  expect(matchesFilters(f, { resolution: "1920 × 1275", voltage: "10 kV" })).toBe(true);
  expect(matchesFilters(f, { gold: "No" })).toBe(false);
  expect(matchesFilters(f, { resolution: "1920 × 1200" })).toBe(false);
  expect(matchesFilters(file("b", meta({ voltageKv: null })), { voltage: "8 kV" })).toBe(false);
});

test("field width range is inclusive and hides files without a width", () => {
  const f = file("a", meta({ fieldWidthUm: 50 }));
  expect(matchesFilters(f, { fieldWidth: { min: "50", max: "50" } })).toBe(true);
  expect(matchesFilters(f, { fieldWidth: { min: "", max: "49.9" } })).toBe(false);
  expect(matchesFilters(file("b", meta({ fieldWidthUm: null })), { fieldWidth: { min: "1", max: "" } })).toBe(false);
});

test("a range counts as one filter; empty values count as none", () => {
  expect(activeFilterCount({ fieldWidth: { min: "1", max: "9" }, gold: "Yes" })).toBe(2);
  expect(activeFilterCount({ fieldWidth: { min: " ", max: "" }, gold: "" })).toBe(0);
});

test("choices: fixed options, or distinct shown values in natural order, keeping the chosen one", () => {
  const files = [file("a", meta({ instrument: "XL10" })), file("b", meta({ instrument: "XL3" })), file("c", null)];
  expect(choices(field("instrument"), files, "")).toEqual(["XL3", "XL10"]);
  expect(choices(field("instrument"), files, "Quanta")).toEqual(["Quanta", "XL3", "XL10"]);
  expect(choices(field("gold"), [], "")).toEqual(["Yes", "No", "Unknown"]);
});

test("resolution sorts by total pixel count", () => {
  const files = [
    file("small", meta({ widthPx: 1920, heightPx: 1200 })),
    file("none", meta({ widthPx: null, heightPx: null })),
    file("big", meta({ widthPx: 7680, heightPx: 5100 })),
  ];
  expect(sortFiles(files, "resolution", "desc").map((f) => f.name)).toEqual(["big", "small", "none"]);
});

test("files without a value sort last in both directions", () => {
  const files = [file("a", meta({ fieldWidthUm: 100 })), file("b", null), file("c", meta({ fieldWidthUm: 20 }))];
  expect(sortFiles(files, "fieldWidth", "asc").map((f) => f.name)).toEqual(["c", "a", "b"]);
  expect(sortFiles(files, "fieldWidth", "desc").map((f) => f.name)).toEqual(["a", "c", "b"]);
});

test("name sorts in natural order; ties on other Fields fall back to the name", () => {
  const files = [file("cell_10", null), file("cell_2", null), file("cell_1", null)];
  expect(sortFiles(files, "name", "asc").map((f) => f.name)).toEqual(["cell_1", "cell_2", "cell_10"]);
  expect(sortFiles(files, "size", "desc").map((f) => f.name)).toEqual(["cell_1", "cell_2", "cell_10"]);
});
