// Every Field the browser can show, sort or filter by, in one table (see GLOSSARY.md).
// Adding a Field is one entry in FIELDS: the Details columns, the sort menu, the filter panel and
// the preview pane all read this table. Values come from /api/list, never from the image itself.
import type { FileEntry, FolderEntry, ImageMeta } from "../types";
import { compareNames, formatSize } from "./rows";

export type FieldId =
  | "name"
  | "date"
  | "size"
  | "acquired"
  | "fieldWidth"
  | "fieldHeight"
  | "pixelSize"
  | "resolution"
  | "instrument"
  | "detector"
  | "voltage"
  | "workingDistance"
  | "dwellTime"
  | "spotSize"
  | "integrations"
  | "gold"
  | "experiment"
  | "source"
  | "variant"
  | "imageId"
  | "uploaded";

export type SortDir = "asc" | "desc";

/** Preview pane groups, in display order. Every group but "file" comes from the Registry. */
export const PREVIEW_GROUPS = ["file", "image", "microscope", "dataset"] as const;
export type PreviewGroup = (typeof PREVIEW_GROUPS)[number];

export type Field = {
  id: FieldId;
  label: string;
  /** Raw value for sorting and range filters; null = missing (sorts last in both directions). */
  value(file: FileEntry): string | number | null;
  /** The one display text: Details cell, preview row and choice-filter option. */
  format(file: FileEntry): string;
  /** A Details column and a sort menu entry. `cell` is the column's text style. */
  column?: { cell: "text" | "mono" | "num" };
  /** What a folder row shows in this column; folders show nothing for most Fields. */
  folder?(folder: FolderEntry): string;
  /** Preview pane group. "file" always shows; the Registry groups only for files with a Registry row. */
  preview?: PreviewGroup;
  /** `choice` options default to the values found in the current folder. */
  filter?: { kind: "choice"; options?: string[] } | { kind: "range"; unit: string };
};

/** Display text for a missing value, everywhere. */
export const MISSING = "—";

/** A number with at most 2 decimals: 10.004 -> "10", 0.256 -> "0.26". */
const round2 = (n: number) => String(Math.round(n * 100) / 100);

/** ISO timestamp as local "YYYY-MM-DD HH:MM": short enough for a table column. */
function localDateTime(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 100.0000002 -> "100.0 µm". */
const microns = (um: number | null | undefined) => (um == null ? MISSING : `${um.toFixed(1)} µm`);

/** Field that reads one Registry number, shown with at most 2 decimals and its unit ("" = none). */
function registryNumber(
  id: FieldId,
  label: string,
  pick: (m: ImageMeta) => number | null,
  unit: string,
  extra: Partial<Field> = {},
): Field {
  const value = (f: FileEntry) => (f.meta ? pick(f.meta) : null);
  return {
    id,
    label,
    value,
    format: (f) => {
      const n = value(f);
      if (n === null) return MISSING;
      return unit ? `${round2(n)} ${unit}` : round2(n);
    },
    ...extra,
  };
}

/** Field that reads one Registry text; an empty text counts as missing. */
function registryText(id: FieldId, label: string, pick: (m: ImageMeta) => string, extra: Partial<Field> = {}): Field {
  const value = (f: FileEntry) => (f.meta && pick(f.meta)) || null;
  return {
    id,
    label,
    value,
    format: (f) => value(f) ?? MISSING,
    ...extra,
  };
}

const pixels = (m: ImageMeta) => (m.widthPx !== null && m.heightPx !== null ? m.widthPx * m.heightPx : null);
const GOLD_TEXT: Record<ImageMeta["gold"], string> = { true: "Yes", false: "No", unknown: "Unknown" };

/** All Fields. This order is the Details column order and the preview row order. */
export const FIELDS: Field[] = [
  {
    id: "name",
    label: "Name",
    value: (f) => f.name,
    format: (f) => f.name,
    column: { cell: "text" },
    folder: (d) => d.name,
  },
  {
    id: "date",
    label: "Date",
    value: (f) => f.date,
    format: (f) => f.date ?? MISSING,
    column: { cell: "mono" },
    folder: (d) => d.date ?? MISSING,
    preview: "file",
  },
  {
    id: "size",
    label: "Size",
    value: (f) => f.size,
    format: (f) => formatSize(f.size),
    column: { cell: "num" },
    preview: "file",
  },
  registryText("acquired", "Acquired", (m) => m.acquiredAt?.replace("T", " ") ?? "", { preview: "image" }),
  {
    ...registryNumber("fieldWidth", "Field width", (m) => m.fieldWidthUm, "µm", { preview: "image" }),
    format: (f) => microns(f.meta?.fieldWidthUm),
    column: { cell: "num" },
    filter: { kind: "range", unit: "µm" },
  },
  {
    ...registryNumber("fieldHeight", "Field height", (m) => m.fieldHeightUm, "µm", { preview: "image" }),
    format: (f) => microns(f.meta?.fieldHeightUm),
  },
  {
    // Stored in µm; nm reads better at SEM scale: 0.0520833 -> "52.08 nm".
    ...registryNumber("pixelSize", "Pixel size", (m) => m.pixelSizeUm, "µm", { preview: "image" }),
    format: (f) => (f.meta?.pixelSizeUm == null ? MISSING : `${(f.meta.pixelSizeUm * 1000).toFixed(2)} nm`),
    column: { cell: "num" },
  },
  {
    // Sorts by total pixel count: 7680 × 5100 above 1920 × 1275.
    id: "resolution",
    label: "Resolution",
    value: (f) => (f.meta ? pixels(f.meta) : null),
    format: (f) => (f.meta && pixels(f.meta) !== null ? `${f.meta.widthPx} × ${f.meta.heightPx}` : MISSING),
    column: { cell: "num" },
    preview: "image",
    filter: { kind: "choice" },
  },
  registryText("instrument", "Instrument", (m) => m.instrument, { column: { cell: "text" }, preview: "microscope", filter: { kind: "choice" } }),
  registryText("detector", "Detector", (m) => m.detector, { column: { cell: "text" }, preview: "microscope", filter: { kind: "choice" } }),
  registryNumber("voltage", "Voltage", (m) => m.voltageKv, "kV", { preview: "microscope", filter: { kind: "choice" } }),
  registryNumber("workingDistance", "Working distance", (m) => m.workingDistanceMm, "mm", { preview: "microscope" }),
  registryNumber("dwellTime", "Dwell time", (m) => m.dwellTimeNs, "ns", { preview: "microscope" }),
  registryNumber("spotSize", "Spot size", (m) => m.spotSize, "", { preview: "microscope" }),
  registryNumber("integrations", "Integrations", (m) => m.integrations, "", { preview: "microscope" }),
  {
    id: "gold",
    label: "Gold",
    value: (f) => f.meta?.gold ?? null,
    format: (f) => (f.meta ? GOLD_TEXT[f.meta.gold] : MISSING),
    column: { cell: "text" },
    preview: "dataset",
    filter: { kind: "choice", options: Object.values(GOLD_TEXT) },
  },
  registryText("experiment", "Experiment", (m) => m.experiment, { preview: "dataset" }),
  registryText("source", "Source", (m) => m.source, { preview: "dataset", filter: { kind: "choice" } }),
  registryText("variant", "Variant", (m) => m.variant, { preview: "dataset", filter: { kind: "choice" } }),
  registryText("imageId", "Image ID", (m) => m.imageId, { preview: "dataset" }),
  {
    id: "uploaded",
    label: "Uploaded",
    value: (f) => Date.parse(f.uploaded),
    format: (f) => localDateTime(f.uploaded),
    column: { cell: "mono" },
  },
];

const BY_ID = new Map(FIELDS.map((f) => [f.id, f]));

export function field(id: FieldId): Field {
  return BY_ID.get(id)!;
}

/**
 * Files sorted by one Field. Files without a value come last in both directions; ties fall back
 * to the name, so the order is stable and predictable.
 */
export function sortFiles(files: FileEntry[], id: FieldId, dir: SortDir): FileEntry[] {
  const f = field(id);
  const sign = dir === "asc" ? 1 : -1;
  return [...files].sort((a, b) => {
    const x = f.value(a);
    const y = f.value(b);
    if (x !== null && y === null) return -1;
    if (x === null && y !== null) return 1;
    const byValue = x === null || y === null ? 0 : typeof x === "number" ? x - (y as number) : compareNames(x, String(y));
    return sign * byValue || compareNames(a.name, b.name);
  });
}

/** A choice filter's chosen text, or a range filter's bounds. "" = no limit. */
export type FilterValue = string | { min: string; max: string };
/** Filters set in the filter panel, by Field id. They stay set while browsing other folders. */
export type Filters = Partial<Record<FieldId, FilterValue>>;
export const NO_FILTERS: Filters = {};

function isSet(v: FilterValue | undefined): boolean {
  if (v === undefined) return false;
  return typeof v === "string" ? v !== "" : v.min.trim() !== "" || v.max.trim() !== "";
}

/** How many Field filters are set. A range counts once, whichever bounds are set. */
export function activeFilterCount(filters: Filters): number {
  return Object.values(filters).filter(isSet).length;
}

/** Inclusive numeric bounds; an empty or non-numeric bound is no limit. */
function inRange(n: number | null, min: string, max: string): boolean {
  const lo = min.trim() === "" ? NaN : Number(min);
  const hi = max.trim() === "" ? NaN : Number(max);
  if (Number.isNaN(lo) && Number.isNaN(hi)) return true;
  if (n === null) return false;
  return !(Number.isFinite(lo) && n < lo) && !(Number.isFinite(hi) && n > hi);
}

/**
 * Whether a file passes the filters. No filter set: everything passes. With any filter set, a
 * file without a Registry row is hidden (same rule as undated folders and the date filter).
 * Choice filters compare the Field's display text, exactly what the dropdown showed.
 */
export function matchesFilters(file: FileEntry, filters: Filters): boolean {
  if (activeFilterCount(filters) === 0) return true;
  if (!file.meta) return false;
  for (const [id, v] of Object.entries(filters) as [FieldId, FilterValue][]) {
    if (!isSet(v)) continue;
    const f = field(id);
    if (typeof v === "string") {
      if (f.format(file) !== v) return false;
    } else {
      const value = f.value(file);
      if (!inRange(typeof value === "number" ? value : null, v.min, v.max)) return false;
    }
  }
  return true;
}

/**
 * Options of a choice filter: its fixed options, or the distinct values in `files` (natural order).
 * The chosen value is always kept, so it never disappears from its own list.
 */
export function choices(f: Field, files: FileEntry[], chosen: string): string[] {
  let values: string[];
  if (f.filter?.kind === "choice" && f.filter.options) {
    values = f.filter.options;
  } else {
    const found = new Set<string>();
    for (const file of files) {
      const v = f.format(file);
      if (v !== MISSING) found.add(v);
    }
    values = [...found].sort(compareNames);
  }
  return chosen && !values.includes(chosen) ? [chosen, ...values] : values;
}

/**
 * Short text for one set filter, for its chip under the toolbar: "sed", "50–100 µm",
 * "≥ 50 µm", "≤ 100 µm". Null when the filter is not set.
 */
export function filterSummary(f: Field, v: FilterValue | undefined): string | null {
  if (!isSet(v)) return null;
  if (typeof v === "string") return v;
  const unit = f.filter?.kind === "range" ? ` ${f.filter.unit}` : "";
  const min = v!.min.trim();
  const max = v!.max.trim();
  if (min && max) return `${min}–${max}${unit}`;
  return min ? `≥ ${min}${unit}` : `≤ ${max}${unit}`;
}
