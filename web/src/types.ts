// Copy of the server's API types (server/src/listing.ts, server/src/registry.ts). Keep both in sync.
export type FolderEntry = { name: string; prefix: string; date: string | null };

/** One row of the Registry's images.csv. Numbers are null when the Registry has no value. */
export type ImageMeta = {
  imageId: string;
  experiment: string;
  source: string;
  split: string;
  variant: string;
  gold: "true" | "false" | "unknown";
  instrument: string;
  detector: string;
  acquiredAt: string | null;
  widthPx: number | null;
  heightPx: number | null;
  pixelSizeUm: number | null;
  fieldWidthUm: number | null;
  fieldHeightUm: number | null;
  voltageKv: number | null;
  workingDistanceMm: number | null;
  dwellTimeNs: number | null;
  spotSize: number | null;
  integrations: number | null;
};

/** `uploaded` is an ISO 8601 timestamp. `meta` is null when the Registry has no row for the file. */
export type FileEntry = {
  name: string;
  key: string;
  size: number;
  uploaded: string;
  date: string | null;
  meta: ImageMeta | null;
};
export type ListResult = { folders: FolderEntry[]; files: FileEntry[] };

export type RegistryStatus = {
  configured: boolean;
  loaded: boolean;
  rows: number;
  version: string | null;
  error: string | null;
};
