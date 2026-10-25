import type { FolderEntry } from "../types";
import type { FieldId, SortDir } from "./fields";

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

/**
 * Folders follow the same header clicks as files. Name and Date apply; folders have no other
 * Field, so other columns keep them in name order. Undated folders stay last either way.
 */
export function sortFolders(folders: FolderEntry[], column: FieldId, dir: SortDir): FolderEntry[] {
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

export function itemCount(n: number): string {
  return n === 1 ? "1 item" : `${n} items`;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
