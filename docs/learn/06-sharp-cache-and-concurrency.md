# 06 — Images: sharp, a disk cache, and a concurrency limit

What was built: `GET /api/thumb` (about 256 px) and `GET /api/preview` (about 1600 px).
Files: `server/src/convert.ts` (TIFF to JPEG), `images.ts` (which source to use), `cache.ts`
(disk cache), `limit.ts` (at most 4 conversions at once).

## Which source is used

```
thumb   : raw/.cache/<stem>.thumbnail.png exists?  -> send it as is (PNG, no work)
preview : raw/.cache/<stem>.png exists?            -> resize it to 1600 px JPEG
otherwise                                          -> convert the TIFF itself
```

The ns-lab batches have those `.cache` PNGs (the pipeline uploads them), so their thumbnails cost one
B2 download and no CPU. termo batches and `preprocessing/<variant>` files always go through `sharp`.

## sharp and the "black image" problem

SEM TIFFs are often 16-bit greyscale (values 0..65535), but the real signal sits in a narrow band, for
example 800..5000. A JPEG has 8 bits (0..255). A plain conversion divides by 256, so 5000 becomes 19:
almost black. `normalise()` stretches the darkest real pixel to 0 and the brightest to 255 first.

`server/test/convert.test.ts` proves it with a generated dark 16-bit TIFF: with `normalise()` the
brightest pixel is above 200; with the line removed the test fails with `expected 19 to be greater
than 200`. (sharp cannot write 16-bit TIFFs here, so `server/test/tiff16.ts` writes a minimal one by
hand: a TIFF is a small header, a table of tags, and raw pixel bytes.)

## Buffers (compare: `bytes`)

A Node `Buffer` is a byte array, like Python `bytes`. `b2.getBytes()` returns the whole TIFF as a
Buffer, sharp takes a Buffer and returns a Buffer, and Express sends it.

## Why a concurrency limit

Opening a folder in Large icons view asks for dozens of thumbnails at once. Each one holds a full TIFF
(several MB) in memory while converting. `createLimiter(4)` lets 4 run and queues the rest:

```ts
const limit = createLimiter(4);
await limit(() => convert(bytes, 256));   // waits if 4 are already running
```

It is about 20 lines: a counter and a queue of waiting `resolve` functions. This is the Node version of
an `asyncio.Semaphore(4)`. Node runs your JavaScript on one thread, but I/O and sharp's work happen in
the background, so many requests really are in flight together.

## The disk cache

The cache file name is `sha256(sourceKey | size | ETag)`. The ETag is B2's fingerprint of the object,
so a changed file gets a new name and an old picture is never served. `put` writes a temporary file
and renames it, so a reader never sees a half-written file. The folder (`CACHE_DIR`) can be deleted any
time; it fills again on demand. In the browser check, the first preview took about 60 ms and the
second about 6 ms (from disk).

Each answer also says `Cache-Control: private, max-age=86400`, so the browser keeps images for a day
and does not ask again while you scroll back and forth.
