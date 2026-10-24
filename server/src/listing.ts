import { batchDate, compareNames, isTiff } from "./keys.js";
import type { ImageMeta } from "./registry.js";

export type FolderEntry = { name: string; prefix: string; date: string | null };
/** `uploaded` is an ISO 8601 timestamp. */
export type FileEntry = {
  name: string;
  key: string;
  size: number;
  uploaded: string;
  date: string | null;
  /** Registry metadata, or null when the Registry has no row for this file. */
  meta: ImageMeta | null;
};
export type ListResult = { folders: FolderEntry[]; files: FileEntry[] };

/** One level of an S3 listing, as returned by the B2 client. */
export type RawListing = {
  prefixes: string[];
  objects: { key: string; size: number; lastModified: Date }[];
};

const HIDDEN_FOLDERS = new Set([".cache"]);

/**
 * Turn one level of a raw listing into what the UI shows: hidden folders and non-TIFF files
 * are removed. Batch folders (directly under the root) are sorted newest date first, undated
 * ones last; everything else is sorted by name in natural order. `lookup` adds Registry metadata.
 */
export function mapListing(
  prefix: string,
  rawPrefix: string,
  raw: RawListing,
  lookup: (key: string) => ImageMeta | null = () => null,
): ListResult {
  const folders: FolderEntry[] = raw.prefixes
    .map((p) => ({ name: p.slice(prefix.length).replace(/\/$/, ""), prefix: p, date: batchDate(p, rawPrefix) }))
    .filter((f) => f.name !== "" && !HIDDEN_FOLDERS.has(f.name));

  if (prefix === rawPrefix + "/") {
    folders.sort((a, b) => {
      if (a.date && b.date && a.date !== b.date) return a.date < b.date ? 1 : -1;
      if (a.date && !b.date) return -1;
      if (!a.date && b.date) return 1;
      return compareNames(a.name, b.name);
    });
  } else {
    folders.sort((a, b) => compareNames(a.name, b.name));
  }

  const files: FileEntry[] = raw.objects
    .filter((o) => o.key !== prefix && isTiff(o.key))
    .map((o) => ({
      name: o.key.slice(prefix.length),
      key: o.key,
      size: o.size,
      uploaded: o.lastModified.toISOString(),
      date: batchDate(o.key, rawPrefix),
      meta: lookup(o.key),
    }))
    .sort((a, b) => compareNames(a.name, b.name));

  return { folders, files };
}
