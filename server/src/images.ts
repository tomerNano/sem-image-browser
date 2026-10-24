import type { B2 } from "./b2.js";
import { cacheName, type DiskCache } from "./cache.js";
import { toJpeg } from "./convert.js";
import { HttpError } from "./errors.js";
import { cacheSources } from "./keys.js";
import type { Limiter } from "./limit.js";

export type ImageSize = "thumb" | "preview";
export type RenderedImage = { body: Buffer; contentType: "image/jpeg" | "image/png" };
export type ImageRenderer = (key: string, size: ImageSize) => Promise<RenderedImage>;

const MAX_SIDE: Record<ImageSize, number> = { thumb: 256, preview: 1600 };

type Deps = { b2: B2; cache: DiskCache; limit: Limiter; convert?: typeof toJpeg };

/**
 * Thumbnail or preview of one TIFF. Uses the pipeline's ready-made PNGs in raw/.cache/ when
 * they exist (thumbnail served as is, full PNG resized); otherwise converts the TIFF itself.
 * Results are cached on disk by source key, size and ETag.
 */
export function createImageRenderer({ b2, cache, limit, convert = toJpeg }: Deps): ImageRenderer {
  // Renders in progress, by cache name: a second request for the same image waits for the first
  // (a double-click asks for the same preview from the preview pane and the viewer at once).
  const inFlight = new Map<string, Promise<Buffer>>();

  return async (key, size) => {
    let sourceKey = key;
    let meta: { etag: string } | null = null;
    let passthrough = false;

    const sources = cacheSources(key);
    if (sources) {
      const candidate = size === "thumb" ? sources.thumb : sources.png;
      meta = await b2.head(candidate);
      if (meta) {
        sourceKey = candidate;
        passthrough = size === "thumb";
      }
    }
    if (!meta) {
      meta = await b2.head(key);
      if (!meta) throw new HttpError(404, "Not found");
    }

    const contentType = passthrough ? "image/png" : "image/jpeg";
    const name = cacheName(sourceKey, size, meta.etag, passthrough ? "png" : "jpg");
    const cached = await cache.get(name);
    if (cached) return { body: cached, contentType };

    let pending = inFlight.get(name);
    if (!pending) {
      pending = render(sourceKey, size, passthrough, name).finally(() => inFlight.delete(name));
      inFlight.set(name, pending);
    }
    return { body: await pending, contentType };
  };

  async function render(sourceKey: string, size: ImageSize, passthrough: boolean, name: string): Promise<Buffer> {
    // Download and conversion both hold the whole image in memory, so both are limited.
    const body = await limit(async () => {
      const bytes = await b2.getBytes(sourceKey);
      if (passthrough) return bytes;
      try {
        return await convert(bytes, MAX_SIDE[size]);
      } catch (err) {
        throw new HttpError(500, "Cannot convert this image", { cause: err });
      }
    });
    try {
      await cache.put(name, body);
    } catch (err) {
      // The image is good; only the cache copy failed (full disk, locked file). Serve it anyway.
      console.error(`Cache write failed for ${sourceKey}:`, err);
    }
    return body;
  }
}
