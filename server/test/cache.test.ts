import { mkdtemp, readdir, utimes } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, test } from "vitest";
import { cacheName, createDiskCache } from "../src/cache.js";

test("cacheName depends on key, size and etag", () => {
  const a = cacheName("yeast/a.tif", "thumb", "e1", "jpg");
  expect(a).toMatch(/^[0-9a-f]{64}\.jpg$/);
  expect(cacheName("yeast/a.tif", "thumb", "e2", "jpg")).not.toBe(a);
  expect(cacheName("yeast/a.tif", "preview", "e1", "jpg")).not.toBe(a);
});

test("put then get round-trips; unknown name is null", async () => {
  const dir = path.join(await mkdtemp(path.join(os.tmpdir(), "b2gui-")), "cache");
  const cache = createDiskCache(dir);
  await cache.put("x.jpg", Buffer.from("data"));
  expect((await cache.get("x.jpg"))?.toString()).toBe("data");
  expect(await cache.get("missing.jpg")).toBeNull();
});

test("over the limit, the least recently used files are deleted down to 90%", async () => {
  const dir = path.join(await mkdtemp(path.join(os.tmpdir(), "b2gui-")), "cache");
  const cache = createDiskCache(dir, 300);
  for (const name of ["a.jpg", "b.jpg", "c.jpg"]) await cache.put(name, Buffer.alloc(100));
  // Make the use order explicit: b is oldest, then a, then c. Reading a file counts as a use.
  await utimes(path.join(dir, "b.jpg"), 1, 1);
  await utimes(path.join(dir, "a.jpg"), 2, 2);

  await cache.put("d.jpg", Buffer.alloc(100));

  // 400 bytes > 300: delete b (300 left, still above 270), then a (200 left).
  expect((await readdir(dir)).sort()).toEqual(["c.jpg", "d.jpg"]);
});

test("get marks a file as used, so trimming keeps it", async () => {
  const dir = path.join(await mkdtemp(path.join(os.tmpdir(), "b2gui-")), "cache");
  const cache = createDiskCache(dir, 300);
  for (const name of ["a.jpg", "b.jpg", "c.jpg"]) await cache.put(name, Buffer.alloc(100));
  await utimes(path.join(dir, "a.jpg"), 1, 1);
  await utimes(path.join(dir, "b.jpg"), 2, 2);
  await utimes(path.join(dir, "c.jpg"), 3, 3);
  await cache.get("a.jpg");
  await new Promise((resolve) => setTimeout(resolve, 50)); // get updates the time in the background

  await cache.put("d.jpg", Buffer.alloc(100));

  // Use order is now b, c, a: b and c go, a stays.
  expect((await readdir(dir)).sort()).toEqual(["a.jpg", "d.jpg"]);
});
