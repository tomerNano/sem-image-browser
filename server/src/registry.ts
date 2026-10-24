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
 * so callers can check often and only re-parse after a change. Today: a local file (FileSource).
 * Later: GitHub with a read-only token, using the ETag as the version.
 */
export type RegistrySource = {
  name: string;
  load(since: string | null): Promise<{ version: string; text: string } | "unchanged">;
};

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

export type Registry = {
  /** Metadata for one B2 key, or null when the Registry has no row for it. */
  lookup(key: string): ImageMeta | null;
  /** Re-reads the source if it changed. Never throws: a failure keeps the last good data. */
  refresh(): Promise<void>;
  status(): RegistryStatus;
};

/**
 * In-memory index of images.csv by B2 key. Each row is indexed under its raw file (`b2_key`) and,
 * when present, its preprocessed variant (`image_key`), so both files show the same metadata.
 * `checkEveryMs` limits how often refresh() asks the source (0 = every call).
 */
export function createRegistry(source: RegistrySource | null, checkEveryMs = 5000): Registry {
  let byKey = new Map<string, ImageMeta>();
  let rows = 0;
  let version: string | null = null;
  let error: string | null = source ? null : "Registry not configured";
  let lastCheck = -Infinity;
  let inFlight: Promise<void> | null = null;

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
    async refresh() {
      if (!source) return;
      if (inFlight) return inFlight;
      if (Date.now() - lastCheck < checkEveryMs) return;
      lastCheck = Date.now();
      inFlight = reload(source).finally(() => (inFlight = null));
      return inFlight;
    },
    status: () => ({ configured: source !== null, loaded: version !== null, rows, version, error }),
  };
}
