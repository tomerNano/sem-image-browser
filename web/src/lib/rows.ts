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
 * Tag filter for split folders: no chosen tag passes everything; otherwise the split needs at
 * least one of the chosen tags (a split usually has one tag, so "all of them" would match nothing).
 */
export function hasTag(tags: string[], chosen: string[]): boolean {
  return chosen.length === 0 || chosen.some((tag) => tags.includes(tag));
}

/** Tag filter options: the distinct tags of `folders` plus the chosen ones, in natural order. */
export function tagChoices(folders: FolderEntry[], chosen: string[]): string[] {
  const found = new Set<string>(chosen);
  for (const folder of folders) {
    for (const tag of folder.tags) found.add(tag);
  }
  return [...found].sort(compareNames);
}

/**
 * Folders follow the same header clicks as files. Name, Date and Tag apply; folders have no other
 * Field, so other columns keep them in name order. Undated and untagged folders stay last either way.
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
    if (column === "tag") {
      const x = a.tags[0];
      const y = b.tags[0];
      if (x && !y) return -1;
      if (!x && y) return 1;
      const byTag = x && y ? sign * compareNames(x, y) : 0;
      return byTag || compareNames(a.name, b.name);
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

/**
 * Text shown while a preview is being made: the original's size (big files take longer), then the
 * whole seconds waited so far, so the user sees the wait is moving.
 *
 * Args:
 *   sizeBytes: Size of the original file.
 *   elapsedMs: Time since the preview was asked for.
 *
 * Returns:
 *   For example "Preparing preview · 78.0 MB original · 12 s".
 */
export function preparingLabel(sizeBytes: number, elapsedMs: number): string {
  const seconds = Math.floor(elapsedMs / 1000);
  const base = `Preparing preview · ${formatSize(sizeBytes)} original`;
  return seconds >= 1 ? `${base} · ${seconds} s` : base;
}
