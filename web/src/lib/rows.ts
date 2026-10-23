import type { FileEntry } from "../types";

export type SortColumn = "name" | "date" | "size" | "uploaded";
export type SortDir = "asc" | "desc";

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

export function sortFiles(files: FileEntry[], column: SortColumn, dir: SortDir): FileEntry[] {
  const sign = dir === "asc" ? 1 : -1;
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

export function itemCount(n: number): string {
  return n === 1 ? "1 item" : `${n} items`;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
