import type { FileEntry, FolderEntry, ImageMeta } from "../types";

/** Columns from Registry metadata. Files without a value always sort last, in both directions. */
export type MetaColumn = "fieldWidth" | "pixelSize" | "resolution" | "instrument" | "detector" | "gold";
export type SortColumn = "name" | "date" | "size" | "uploaded" | MetaColumn;
export type SortDir = "asc" | "desc";

/** Sortable columns in display order: the Details headers and the sort menu. */
export const SORT_COLUMNS: { id: SortColumn; label: string }[] = [
  { id: "name", label: "Name" },
  { id: "date", label: "Date" },
  { id: "size", label: "Size" },
  { id: "fieldWidth", label: "Field width" },
  { id: "pixelSize", label: "Pixel" },
  { id: "resolution", label: "Resolution" },
  { id: "instrument", label: "Instrument" },
  { id: "detector", label: "Detector" },
  { id: "gold", label: "Gold" },
  { id: "uploaded", label: "Uploaded" },
];

const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

/** Natural order, same rule as the server: "cell_2" before "cell_10", case-insensitive. */
export function compareNames(a: string, b: string): number {
  return collator.compare(a, b);
}

/**
 * Date-range filter for batch folders. No bounds: everything passes. With any bound set,
 * an undated folder is hidden. Bounds are inclusive "YYYY-MM-DD" strings ("" = open).
 */
export function inDateRange(date: string | null, from: string, to: string): boolean {
  if (!from && !to) return true;
  if (date === null) return false;
  return (!from || date >= from) && (!to || date <= to);
}

/** Case-insensitive substring match; an empty query matches everything. */
export function matchesSearch(name: string, q: string): boolean {
  return name.toLowerCase().includes(q.trim().toLowerCase());
}

function metaValue(meta: ImageMeta | null, column: MetaColumn): string | number | null {
  if (!meta) return null;
  switch (column) {
    case "fieldWidth":
      return meta.fieldWidthUm;
    case "pixelSize":
      return meta.pixelSizeUm;
    case "resolution":
      // Total pixel count: 7680 × 5100 sorts above 1920 × 1275.
      return meta.widthPx !== null && meta.heightPx !== null ? meta.widthPx * meta.heightPx : null;
    case "instrument":
      return meta.instrument || null;
    case "detector":
      return meta.detector || null;
    case "gold":
      return meta.gold;
  }
}

function isMetaColumn(column: SortColumn): column is MetaColumn {
  return ["fieldWidth", "pixelSize", "resolution", "instrument", "detector", "gold"].includes(column);
}

export function sortFiles(files: FileEntry[], column: SortColumn, dir: SortDir): FileEntry[] {
  const sign = dir === "asc" ? 1 : -1;
  if (isMetaColumn(column)) {
    return [...files].sort((a, b) => {
      const x = metaValue(a.meta, column);
      const y = metaValue(b.meta, column);
      if (x !== null && y === null) return -1;
      if (x === null && y !== null) return 1;
      const byValue = x === null || y === null ? 0 : typeof x === "number" ? x - (y as number) : compareNames(x, String(y));
      return sign * byValue || compareNames(a.name, b.name);
    });
  }
  const byColumn = (a: FileEntry, b: FileEntry): number => {
    switch (column) {
      case "size":
        return a.size - b.size;
      case "uploaded":
        return a.uploaded.localeCompare(b.uploaded);
      case "date":
        return (a.date ?? "").localeCompare(b.date ?? "");
      default:
        return compareNames(a.name, b.name);
    }
  };
  // Ties fall back to the name, so the order is stable and predictable.
  return [...files].sort((a, b) => sign * byColumn(a, b) || compareNames(a.name, b.name));
}

/**
 * Folders follow the same header clicks as files. Name and Date apply; folders have no size or
 * upload time, so those columns keep them in name order. Undated folders stay last either way.
 */
export function sortFolders(folders: FolderEntry[], column: SortColumn, dir: SortDir): FolderEntry[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...folders].sort((a, b) => {
    if (column === "date") {
      if (a.date && !b.date) return -1;
      if (!a.date && b.date) return 1;
      const byDate = sign * (a.date ?? "").localeCompare(b.date ?? "");
      return byDate || compareNames(a.name, b.name);
    }
    if (column === "name") return sign * compareNames(a.name, b.name);
    return compareNames(a.name, b.name);
  });
}

/** Registry filters for the files of the current folder. "" = no limit. */
export type MetaFilters = {
  gold: "" | ImageMeta["gold"];
  source: string;
  variant: string;
  instrument: string;
  detector: string;
  /** As shown by `resolution()`, e.g. "1920 × 1200". */
  resolution: string;
  /** As shown by `voltage()`, e.g. "8 kV". */
  voltage: string;
  fieldWidthMin: string;
  fieldWidthMax: string;
};

export const NO_FILTERS: MetaFilters = {
  gold: "",
  source: "",
  variant: "",
  instrument: "",
  detector: "",
  resolution: "",
  voltage: "",
  fieldWidthMin: "",
  fieldWidthMax: "",
};

/** Image size in pixels, "1920 × 1200", or "" when unknown. Also the resolution filter's value. */
export function resolution(meta: ImageMeta): string {
  return meta.widthPx !== null && meta.heightPx !== null ? `${meta.widthPx} × ${meta.heightPx}` : "";
}

/** Beam voltage, "8 kV", or "" when unknown. Also the voltage filter's value. */
export function voltage(meta: ImageMeta): string {
  return meta.voltageKv === null ? "" : `${meta.voltageKv} kV`;
}

export function filtersActive(f: MetaFilters): boolean {
  return Object.values(f).some((v) => v !== "");
}

/**
 * Registry filter for one file. No filter set: everything passes. With any filter set, a file
 * without Registry metadata is hidden (same rule as undated folders and the date filter).
 * Field width bounds are inclusive, in µm.
 */
export function matchesFilters(meta: ImageMeta | null, f: MetaFilters): boolean {
  if (!filtersActive(f)) return true;
  if (!meta) return false;
  if (f.gold && meta.gold !== f.gold) return false;
  if (f.source && meta.source !== f.source) return false;
  if (f.variant && meta.variant !== f.variant) return false;
  if (f.instrument && meta.instrument !== f.instrument) return false;
  if (f.detector && meta.detector !== f.detector) return false;
  if (f.resolution && resolution(meta) !== f.resolution) return false;
  if (f.voltage && voltage(meta) !== f.voltage) return false;
  const min = f.fieldWidthMin.trim() === "" ? null : Number(f.fieldWidthMin);
  const max = f.fieldWidthMax.trim() === "" ? null : Number(f.fieldWidthMax);
  if (min !== null || max !== null) {
    const w = meta.fieldWidthUm;
    if (w === null) return false;
    if (min !== null && Number.isFinite(min) && w < min) return false;
    if (max !== null && Number.isFinite(max) && w > max) return false;
  }
  return true;
}

/** Sorted, distinct, non-empty values of one text field, for a filter's choices. */
export function distinctValues(files: FileEntry[], pick: (m: ImageMeta) => string): string[] {
  const values = new Set<string>();
  for (const f of files) {
    const v = f.meta ? pick(f.meta) : "";
    if (v) values.add(v);
  }
  return [...values].sort(compareNames);
}

/** 100.0000002 -> "100.0 µm". */
export function formatMicrons(um: number | null): string {
  return um === null ? "—" : `${um.toFixed(1)} µm`;
}

/** Pixel size is stored in µm; nm reads better at SEM scale: 0.0520833 -> "52.08 nm". */
export function formatPixelSize(um: number | null): string {
  return um === null ? "—" : `${(um * 1000).toFixed(2)} nm`;
}

export function formatGold(gold: ImageMeta["gold"] | undefined): string {
  if (gold === "true") return "Yes";
  if (gold === "false") return "No";
  return gold === "unknown" ? "Unknown" : "—";
}

export function itemCount(n: number): string {
  return n === 1 ? "1 item" : `${n} items`;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
