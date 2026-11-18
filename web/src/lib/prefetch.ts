import { previewUrl } from "../api";
import type { FileEntry } from "../types";

/** Neighbours whose previews load in the background: two ahead, one behind. */
const PREVIEW_PREFETCH = [1, 2, -1];

/** The visible files around `key` at the PREVIEW_PREFETCH offsets; none past the first or last file. */
export function previewNeighbours(files: FileEntry[], key: string): FileEntry[] {
  const index = files.findIndex((f) => f.key === key);
  if (index < 0) return [];
  const neighbours: FileEntry[] = [];
  for (const delta of PREVIEW_PREFETCH) {
    const file = files[index + delta];
    if (file) neighbours.push(file);
  }
  return neighbours;
}

/**
 * Asks for the neighbours' previews now, so stepping with the arrow keys finds them in the browser
 * cache. Measured on localhost: a cold preview takes 1 to 2 s, a prefetched one shows at once.
 */
export function prefetchPreviews(files: FileEntry[], key: string): void {
  for (const file of previewNeighbours(files, key)) {
    new Image().src = previewUrl(file.key, file.uploaded);
  }
}
