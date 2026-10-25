import { createHash, randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rename, rm, stat, utimes, writeFile } from "node:fs/promises";
import path from "node:path";

export type DiskCache = {
  get(name: string): Promise<Buffer | null>;
  put(name: string, data: Buffer): Promise<void>;
};

/** When the cache grows past its limit, it is trimmed down to this share of the limit. */
const TRIM_TO = 0.9;

/** File name for one rendered image. A new ETag (changed object) gives a new name, so stale files are never served. */
export function cacheName(key: string, size: "thumb" | "preview", etag: string, ext: "jpg" | "png"): string {
  return createHash("sha256").update(`${key}|${size}|${etag}`).digest("hex") + "." + ext;
}

type CacheFile = { name: string; size: number; usedMs: number };

/** Finished cache files with their size and last use. `.tmp` files are writes in progress and are skipped. */
async function listFiles(dir: string): Promise<CacheFile[]> {
  const files: CacheFile[] = [];
  for (const name of await readdir(dir)) {
    if (name.endsWith(".tmp")) continue;
    try {
      const info = await stat(path.join(dir, name));
      if (info.isFile()) files.push({ name, size: info.size, usedMs: info.mtimeMs });
    } catch {
      // Deleted between readdir and stat: nothing to count.
    }
  }
  return files;
}

/**
 * A folder of cached files. It can be deleted at any time; files are rebuilt on demand.
 * When it holds more than maxBytes, the least recently used files are deleted.
 */
export function createDiskCache(dir: string, maxBytes = Infinity): DiskCache {
  const ready = mkdir(dir, { recursive: true });
  // Bytes in the folder. Unknown until the first trim scans it; put keeps it up to date after that.
  let totalBytes: number | null = null;
  let trimming: Promise<void> | null = null;

  async function trim(): Promise<void> {
    const files = await listFiles(dir);
    totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    if (totalBytes <= maxBytes) return;
    files.sort((a, b) => a.usedMs - b.usedMs);
    for (const file of files) {
      if (totalBytes <= maxBytes * TRIM_TO) break;
      await rm(path.join(dir, file.name), { force: true });
      totalBytes -= file.size;
    }
  }

  return {
    async get(name) {
      await ready;
      const file = path.join(dir, name);
      try {
        const data = await readFile(file);
        // The modified time doubles as "last used", so trimming keeps the images people still view.
        const now = new Date();
        utimes(file, now, now).catch(() => {});
        return data;
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw err;
      }
    },

    async put(name, data) {
      await ready;
      // Write to a temporary file first, then rename: a reader never sees a half-written file.
      const tmp = path.join(dir, `${name}.${randomUUID()}.tmp`);
      await writeFile(tmp, data);
      await rename(tmp, path.join(dir, name));

      if (totalBytes !== null) totalBytes += data.length;
      if (maxBytes === Infinity || trimming || (totalBytes !== null && totalBytes <= maxBytes)) return;
      trimming = trim().finally(() => {
        trimming = null;
      });
      await trimming;
    },
  };
}
