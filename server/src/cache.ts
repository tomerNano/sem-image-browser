import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export type DiskCache = {
  get(name: string): Promise<Buffer | null>;
  put(name: string, data: Buffer): Promise<void>;
};

/** File name for one rendered image. A new ETag (changed object) gives a new name, so stale files are never served. */
export function cacheName(key: string, size: "thumb" | "preview", etag: string, ext: "jpg" | "png"): string {
  return createHash("sha256").update(`${key}|${size}|${etag}`).digest("hex") + "." + ext;
}

/** A folder of cached files. It can be deleted at any time; files are rebuilt on demand. */
export function createDiskCache(dir: string): DiskCache {
  const ready = mkdir(dir, { recursive: true });

  return {
    async get(name) {
      await ready;
      try {
        return await readFile(path.join(dir, name));
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
    },
  };
}
