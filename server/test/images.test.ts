import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, expect, test } from "vitest";
import { createDiskCache } from "../src/cache.js";
import { createImageRenderer } from "../src/images.js";
import { createLimiter } from "../src/limit.js";
import { fakeB2 } from "./fakeB2.js";

const raw = "yeast/b/raw/cell_1.tiff";
const tiff = Buffer.from("tiff-bytes");
const png = Buffer.from("png-bytes");
let convertCalls = 0;
let cacheDir = "";

beforeEach(async () => {
  convertCalls = 0;
  cacheDir = await mkdtemp(path.join(os.tmpdir(), "b2gui-img-"));
});

function render(objects: Record<string, Buffer>) {
  return createImageRenderer({
    b2: fakeB2(objects),
    cache: createDiskCache(cacheDir),
    limit: createLimiter(4),
    convert: async (_input: Buffer, maxSide: number) => {
      convertCalls++;
      return Buffer.from(`jpeg:${maxSide}`);
    },
  });
}

test("thumb uses .cache thumbnail as PNG, no conversion", async () => {
  const r = await render({ [raw]: tiff, "yeast/b/raw/.cache/cell_1.thumbnail.png": png })(raw, "thumb");
  expect(r).toEqual({ body: png, contentType: "image/png" });
  expect(convertCalls).toBe(0);
});

test("preview converts .cache png at 1600", async () => {
  const r = await render({ [raw]: tiff, "yeast/b/raw/.cache/cell_1.png": png })(raw, "preview");
  expect(r.body.toString()).toBe("jpeg:1600");
  expect(r.contentType).toBe("image/jpeg");
});

test("no .cache: converts TIFF at 256, second call served from disk", async () => {
  const r = render({ [raw]: tiff });
  expect((await r(raw, "thumb")).body.toString()).toBe("jpeg:256");
  await r(raw, "thumb");
  expect(convertCalls).toBe(1);
});

test("variant files never look for .cache", async () => {
  const variant = "yeast/b/preprocessing/denoise/cell_1.tiff";
  const r = await render({
    [variant]: tiff,
    "yeast/b/preprocessing/denoise/.cache/cell_1.thumbnail.png": png,
  })(variant, "thumb");
  expect(r.body.toString()).toBe("jpeg:256");
});

test("missing TIFF is 404", async () => {
  await expect(render({})(raw, "thumb")).rejects.toMatchObject({ status: 404 });
});

test("a stalled B2 download fails with 502 instead of hanging", async () => {
  const r = createImageRenderer({
    b2: fakeB2({ [raw]: tiff }, { hang: true, timeoutMs: 50 }),
    cache: createDiskCache(cacheDir),
    limit: createLimiter(4),
    convert: async () => Buffer.from("jpeg"),
  });
  await expect(r(raw, "thumb")).rejects.toMatchObject({ status: 502 });
});

test("a source above the size limit is refused", async () => {
  const r = createImageRenderer({
    b2: fakeB2({ [raw]: tiff }),
    cache: createDiskCache(cacheDir),
    limit: createLimiter(4),
    convert: async () => Buffer.from("jpeg"),
    maxSourceBytes: tiff.length - 1,
  });
  await expect(r(raw, "preview")).rejects.toMatchObject({ status: 422 });
});

test("two requests for the same image at once convert it only once", async () => {
  const r = render({ [raw]: tiff });
  const [a, b] = await Promise.all([r(raw, "preview"), r(raw, "preview")]);
  expect(a.body.toString()).toBe("jpeg:1600");
  expect(b.body.toString()).toBe("jpeg:1600");
  expect(convertCalls).toBe(1);
});

test("a failing cache write still returns the rendered image", async () => {
  const r = createImageRenderer({
    b2: fakeB2({ [raw]: tiff }),
    cache: { get: async () => null, put: async () => { throw new Error("EPERM: rename"); } },
    limit: createLimiter(4),
    convert: async () => Buffer.from("jpeg"),
  });
  expect((await r(raw, "thumb")).body.toString()).toBe("jpeg");
});
