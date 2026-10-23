import { mkdtemp } from "node:fs/promises";
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
