import { HttpError } from "./errors.js";

/** Common rules for keys and prefixes: inside rawPrefix, relative, no "..", no backslash. */
function checkPath(value: unknown, rawPrefix: string, what: string): string {
  if (typeof value !== "string" || value === "") {
    throw new HttpError(400, `Missing ${what}`);
  }
  if (
    !value.startsWith(rawPrefix + "/") ||
    value.startsWith("/") ||
    value.includes("\\") ||
    value.split("/").includes("..")
  ) {
    throw new HttpError(400, `Invalid ${what}`);
  }
  return value;
}

/** Validate an object key (a file, so it must not end with "/"). Throws HttpError(400). */
export function validateKey(value: unknown, rawPrefix: string): string {
  const key = checkPath(value, rawPrefix, "key");
  if (key.endsWith("/")) {
    throw new HttpError(400, "Invalid key");
  }
  return key;
}

/** Validate a folder prefix (must end with "/"; the root "yeast/" itself is allowed). Throws HttpError(400). */
export function validatePrefix(value: unknown, rawPrefix: string): string {
  const prefix = checkPath(value, rawPrefix, "prefix");
  if (!prefix.endsWith("/")) {
    throw new HttpError(400, "Invalid prefix");
  }
  return prefix;
}

/**
 * Acquisition date of the batch a path belongs to: the YYYY-MM-DD at the start of the
 * segment right after "<rawPrefix>/", only if it is a real calendar date.
 */
export function batchDate(path: string, rawPrefix: string): string | null {
  const batch = path.slice(rawPrefix.length + 1).split("/")[0];
  const match = /^(\d{4})-(\d{2})-(\d{2})_/.exec(batch ?? "");
  if (!match) {
    return null;
  }
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const real = date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
  return real ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

export function isTiff(name: string): boolean {
  return /\.tiff?$/i.test(name);
}

/** Ready-made PNGs the pipeline stores for raw images: raw/.cache/<stem>.thumbnail.png and <stem>.png. */
export function cacheSources(key: string): { thumb: string; png: string } | null {
  const parts = key.split("/");
  const filename = parts.pop()!;
  if (parts[parts.length - 1] !== "raw") {
    return null;
  }
  const dot = filename.lastIndexOf(".");
  const stem = dot > 0 ? filename.slice(0, dot) : filename;
  const folder = parts.join("/") + "/.cache/";
  return { thumb: `${folder}${stem}.thumbnail.png`, png: `${folder}${stem}.png` };
}

const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

/** Natural order: "cell_2" before "cell_10", case-insensitive. */
export function compareNames(a: string, b: string): number {
  return collator.compare(a, b);
}
