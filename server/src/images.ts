import type { B2 } from "./b2.js";
import { cacheName, type DiskCache } from "./cache.js";
import { toJpeg } from "./convert.js";
import { HttpError } from "./errors.js";
import { cacheSources } from "./keys.js";
import type { Limiter } from "./limit.js";
import { log, sizeText } from "./log.js";

export type ImageSize = "thumb" | "preview";
export type RenderedImage = { body: Buffer; contentType: "image/jpeg" | "image/png" };
export type ImageRenderer = (key: string, size: ImageSize) => Promise<RenderedImage>;

const MAX_SIDE: Record<ImageSize, number> = { thumb: 256, preview: 1600 };

/**
 * Largest source file this server downloads into memory to render. A 7680 x 5100 16-bit SEM TIFF
 * is about 78 MB; with 4 renders at a time this keeps memory bounded. Downloads are not limited.
 */
export const MAX_SOURCE_BYTES = 512 * 1024 * 1024;

/**
 * How long a B2 HEAD answer (ETag and size, or "missing") is reused. Without it, every thumbnail
 * request asks B2 before it can use the disk cache: a folder of 200 images is 200 to 400 round
 * trips. A file replaced in B2 shows its old image for at most this long.
 */
export const HEAD_TTL_MS = 5 * 60_000;

/** A render slower than this is logged at INFO (always visible), faster ones only at DEBUG. */
const SLOW_RENDER_MS = 5_000;

/** Most HEAD answers kept in memory; above it, all are dropped and asked again. */
const MAX_HEAD_ENTRIES = 50_000;

type Head = { etag: string; size: number } | null;

type Deps = {
  b2: B2;
  cache: DiskCache;
  limit: Limiter;
  convert?: typeof toJpeg;
  maxSourceBytes?: number;
  headTtlMs?: number;
};

/**
 * Thumbnail or preview of one TIFF. Uses the pipeline's ready-made PNGs in raw/.cache/ when
 * they exist (thumbnail served as is, full PNG resized); otherwise converts the TIFF itself.
 * Results are cached on disk by source key, size and ETag.
 */
export function createImageRenderer({
  b2,
  cache,
  limit,
  convert = toJpeg,
  maxSourceBytes = MAX_SOURCE_BYTES,
  headTtlMs = HEAD_TTL_MS,
}: Deps): ImageRenderer {
  // Renders in progress, by cache name: a second request for the same image waits for the first
  // (a double-click asks for the same preview from the preview pane and the viewer at once).
  const inFlight = new Map<string, Promise<Buffer>>();
  // Recent HEAD answers by key, including "missing" (most raw TIFFs have no .cache PNG).
  const heads = new Map<string, { head: Head; expires: number }>();

  /**
   * b2.head(), answered from memory when asked less than headTtlMs ago.
   *
   * Args:
   *   key: Object key in the bucket.
   *
   * Returns:
   *   ETag and size, or null when the object does not exist.
   */
  async function head(key: string): Promise<Head> {
    const remembered = heads.get(key);
    if (remembered && remembered.expires > Date.now()) {
      log.debug(`HEAD ${key}: reused from memory (${remembered.head ? "found" : "missing"})`);
      return remembered.head;
    }
    const answer = await b2.head(key);
    if (heads.size >= MAX_HEAD_ENTRIES) heads.clear();
    heads.set(key, { head: answer, expires: Date.now() + headTtlMs });
    return answer;
  }

  return async (key, size) => {
    let sourceKey = key;
    let meta: Head = null;
    let passthrough = false;

    const sources = cacheSources(key);
    if (sources) {
      const candidate = size === "thumb" ? sources.thumb : sources.png;
      meta = await head(candidate);
      if (meta) {
        sourceKey = candidate;
        passthrough = size === "thumb";
      }
    }
    if (!meta) {
      meta = await head(key);
      if (!meta) throw new HttpError(404, "Not found");
    }

    const contentType = passthrough ? "image/png" : "image/jpeg";
    const name = cacheName(sourceKey, size, meta.etag, passthrough ? "png" : "jpg");
    const cached = await cache.get(name);
    if (cached) {
      log.debug(`${size} ${key}: disk cache hit (${sizeText(cached.length)})`);
      return { body: cached, contentType };
    }

    if (meta.size > maxSourceBytes) {
      log.warn(`${size} ${key}: source ${sizeText(meta.size)} is above the ${sizeText(maxSourceBytes)} limit, no preview`);
      throw new HttpError(422, "Image too large to preview");
    }

    let pending = inFlight.get(name);
    if (pending) {
      log.debug(`${size} ${key}: same render already running, waiting for it`);
    } else {
      pending = render(sourceKey, size, passthrough, name, meta.size).finally(() => inFlight.delete(name));
      inFlight.set(name, pending);
    }
    return { body: await pending, contentType };
  };

  async function render(
    sourceKey: string,
    size: ImageSize,
    passthrough: boolean,
    name: string,
    sourceBytes: number,
  ): Promise<Buffer> {
    const queued = Date.now();
    let started = queued;
    let downloaded = queued;
    // Download and conversion both hold the whole image in memory, so both are limited.
    const body = await limit(async () => {
      started = Date.now();
      const bytes = await b2.getBytes(sourceKey);
      downloaded = Date.now();
      if (passthrough) return bytes;
      try {
        return await convert(bytes, MAX_SIDE[size]);
      } catch (err) {
        throw new HttpError(500, "Cannot convert this image", { cause: err });
      }
    });
    const done = Date.now();
    // Where the time went: waiting for one of the render slots, the B2 download, the conversion.
    const line =
      `${size} ${sourceKey}: rendered ${sizeText(sourceBytes)} source in ${done - queued} ms ` +
      `(wait ${started - queued}, download ${downloaded - started}, convert ${done - downloaded})`;
    if (done - queued >= SLOW_RENDER_MS) log.info(`Slow ${line}`);
    else log.debug(line);
    try {
      await cache.put(name, body);
    } catch (err) {
      // The image is good; only the cache copy failed (full disk, locked file). Serve it anyway.
      log.error(`Cache write failed for ${sourceKey}`, err);
    }
    return body;
  }
}
