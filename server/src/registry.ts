import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { parseCsv } from "./csv.js";

/** What the GUI shows for one image, taken from one row of the Registry's images.csv. */
export type ImageMeta = {
  imageId: string;
  experiment: string;
  source: string;
  split: string;
  variant: string;
  gold: "true" | "false" | "unknown";
  instrument: string;
  detector: string;
  /** Local time from the microscope, ISO 8601 without zone (e.g. "2026-10-12T11:09:45"). */
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

export type RegistryStatus = {
  configured: boolean;
  loaded: boolean;
  rows: number;
  /** Version of the loaded data (file time for a local file), or null before the first load. */
  version: string | null;
  error: string | null;
};

/**
 * Where images.csv comes from. `load` returns "unchanged" when the content still matches `since`,
 * so callers can check often and only re-parse after a change. Two sources: a local file
 * (createFileSource, for development) and GitHub with a read-only token (createGitHubSource).
 */
export type RegistrySource = {
  name: string;
  load(since: string | null): Promise<{ version: string; text: string } | "unchanged">;
};

const GITHUB_API_URL = "https://api.github.com";
const GITHUB_API_VERSION = "2022-11-28";
// GitHub refuses API requests without a User-Agent; a generic app name is enough.
const GITHUB_USER_AGENT = "b2-gui";
const GITHUB_TIMEOUT_MS = 10_000;

export type GitHubFile = { token: string; repo: string; ref: string; path: string };

/** Error text for a failed GitHub answer. Never includes the token. */
function gitHubError(status: number): Error {
  if (status === 401) return new Error("GitHub token rejected (401)");
  if (status === 403 || status === 429) {
    return new Error(`GitHub refused the request (${status}): check the token's repository access or the rate limit`);
  }
  if (status === 404) {
    return new Error("Registry file not found on GitHub (404): check repo, branch, path and the token's repository access");
  }
  return new Error(`GitHub answered ${status}`);
}

/**
 * Reads images.csv through the GitHub contents API (raw media type, files up to 100 MB).
 * Version = the ETag; sending it back as If-None-Match gives a 304 that costs no rate limit.
 * `fetchFn` is replaceable for tests.
 */
export function createGitHubSource(file: GitHubFile, fetchFn: typeof fetch = fetch): RegistrySource {
  const encodedPath = file.path.split("/").map(encodeURIComponent).join("/");
  const url = `${GITHUB_API_URL}/repos/${file.repo}/contents/${encodedPath}?ref=${encodeURIComponent(file.ref)}`;
  return {
    name: `${file.repo}@${file.ref}:${file.path} (GitHub)`,
    async load(since) {
      const headers: Record<string, string> = {
        Accept: "application/vnd.github.raw+json",
        Authorization: `Bearer ${file.token}`,
        "User-Agent": GITHUB_USER_AGENT,
        "X-GitHub-Api-Version": GITHUB_API_VERSION,
      };
      if (since) headers["If-None-Match"] = since;

      let res: Response;
      try {
        res = await fetchFn(url, { headers, signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS) });
      } catch (err) {
        throw new Error("GitHub unreachable", { cause: err });
      }
      if (res.status === 304) return "unchanged";
      if (!res.ok) throw gitHubError(res.status);
      // Without an ETag every check re-downloads; the load time still marks the version.
      const version = res.headers.get("etag") ?? new Date().toISOString();
      return { version, text: await res.text() };
    },
  };
}

/** Reads images.csv from a local clone of the Registry. Version = the file's modified time. */
export function createFileSource(filePath: string): RegistrySource {
  return {
    name: `${path.basename(filePath)} (local file)`,
    async load(since) {
      let info;
      try {
        info = await stat(filePath);
      } catch (err) {
        throw new Error("Registry file not found", { cause: err });
      }
      const version = info.mtime.toISOString();
      if (version === since) return "unchanged";
      return { version, text: await readFile(filePath, "utf8") };
    },
  };
}

function num(text: string | undefined): number | null {
  if (!text?.trim()) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

/** One CSV record into ImageMeta. Empty or non-numeric numbers become null. */
export function toImageMeta(r: Record<string, string>): ImageMeta {
  const gold = r.gold === "true" || r.gold === "false" ? r.gold : "unknown";
  return {
    imageId: r.image_id ?? "",
    experiment: r.experiment ?? "",
    source: r.source ?? "",
    split: r.current_split ?? "",
    variant: r.image_variant ?? "",
    gold,
    instrument: r.instrument_model ?? "",
    detector: r.detector ?? "",
    acquiredAt: r.acquired_at || null,
    widthPx: num(r.width_px),
    heightPx: num(r.height_px),
    pixelSizeUm: num(r.pixel_size_um),
    fieldWidthUm: num(r.field_width_um),
    fieldHeightUm: num(r.field_height_um),
    voltageKv: num(r.voltage_kv),
    workingDistanceMm: num(r.working_distance_mm),
    dwellTimeNs: num(r.dwell_time_ns),
    spotSize: num(r.spot_size),
    integrations: num(r.integrations),
  };
}

/** The Registry file with each split's tags, in the same directory as images.csv. */
export const SPLIT_TAGS_FILE = "split_tags.csv";

/**
 * split_tags.csv (columns `split,tag`, one row per tag) into tags by split, in file order.
 * Blank cells and repeated tags are dropped. Throws when the columns are missing.
 */
export function parseSplitTags(text: string): Map<string, string[]> {
  // Check the header line itself: a file cut down to a wrong header must fail, not load as "no tags".
  const header = text.replace(/^﻿/, "").split(/\r?\n/, 1)[0].split(",");
  const columns = header.map((h) => h.trim().replace(/^"(.*)"$/, "$1"));
  if (!columns.includes("split") || !columns.includes("tag")) {
    throw new Error("split_tags.csv needs split and tag columns");
  }
  const records = parseCsv(text);
  const bySplit = new Map<string, string[]>();
  for (const r of records) {
    const split = (r.split ?? "").trim();
    const tag = (r.tag ?? "").trim();
    if (!split || !tag) continue;
    const tags = bySplit.get(split) ?? [];
    if (!tags.includes(tag)) tags.push(tag);
    bySplit.set(split, tags);
  }
  return bySplit;
}

export type Registry = {
  /** Metadata for one B2 key, or null when the Registry has no row for it. */
  lookup(key: string): ImageMeta | null;
  /** Tags of one split (a batch folder name), from split_tags.csv; [] when it has none. */
  tagsFor(split: string): string[];
  /** Re-reads the source if it changed. Never throws: a failure keeps the last good data. */
  refresh(): Promise<void>;
  status(): RegistryStatus;
};

/**
 * In-memory index of images.csv by B2 key. Each row is indexed under its raw file (`b2_key`) and,
 * when present, its preprocessed variant (`image_key`), so both files show the same metadata.
 * `checkEveryMs` limits how often refresh() asks the source (0 = every call).
 * `tagsSource` (split_tags.csv) is read in the same refresh; its failures never touch the
 * images.csv data or `status().error`.
 */
export function createRegistry(
  source: RegistrySource | null,
  checkEveryMs = 5000,
  tagsSource: RegistrySource | null = null,
): Registry {
  let byKey = new Map<string, ImageMeta>();
  let rows = 0;
  let version: string | null = null;
  let error: string | null = source ? null : "Registry not configured";
  let tagsBySplit = new Map<string, string[]>();
  let tagsVersion: string | null = null;
  let tagsError: string | null = null;
  let lastCheck = -Infinity;
  let inFlight: Promise<void> | null = null;

  async function reloadTags(s: RegistrySource): Promise<void> {
    try {
      const result = await s.load(tagsVersion);
      if (result !== "unchanged") {
        tagsBySplit = parseSplitTags(result.text);
        tagsVersion = result.version;
        console.log(`Registry tags loaded: ${tagsBySplit.size} splits from ${s.name}`);
      }
      tagsError = null;
    } catch (err) {
      const message = (err as Error).message;
      // Log a failure once, not on every listing request while it lasts.
      if (message !== tagsError) console.error(`Registry tags ${s.name}: ${message}`, (err as Error).cause ?? "");
      tagsError = message;
    }
  }

  async function reload(s: RegistrySource): Promise<void> {
    try {
      const result = await s.load(version);
      if (result !== "unchanged") {
        const records = parseCsv(result.text);
        const next = new Map<string, ImageMeta>();
        for (const r of records) {
          const meta = toImageMeta(r);
          if (r.b2_key) next.set(r.b2_key, meta);
          if (r.image_key) next.set(r.image_key, meta);
        }
        byKey = next;
        rows = records.length;
        version = result.version;
        console.log(`Registry loaded: ${rows} rows from ${s.name}`);
      }
      error = null;
    } catch (err) {
      const message = (err as Error).message;
      // Log a failure once, not on every listing request while it lasts.
      if (message !== error) console.error(`Registry ${s.name}: ${message}`, (err as Error).cause ?? "");
      error = message;
    }
  }

  return {
    lookup: (key) => byKey.get(key) ?? null,
    tagsFor: (split) => tagsBySplit.get(split) ?? [],
    async refresh() {
      if (!source && !tagsSource) return;
      if (inFlight) return inFlight;
      if (Date.now() - lastCheck < checkEveryMs) return;
      lastCheck = Date.now();
      // Each load catches its own errors, so one file never blocks the other.
      inFlight = Promise.all([source && reload(source), tagsSource && reloadTags(tagsSource)])
        .then(() => undefined)
        .finally(() => (inFlight = null));
      return inFlight;
    },
    status: () => ({ configured: source !== null, loaded: version !== null, rows, version, error }),
  };
}
