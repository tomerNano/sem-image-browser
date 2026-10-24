import { mkdtemp, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, test } from "vitest";
import { createFileSource, createRegistry, type RegistrySource } from "../src/registry.js";

const HEADER = "image_id,b2_key,image_key,gold,instrument_model,field_width_um,pixel_size_um,magnification,acquired_at";
const RAW = "yeast/b1/raw/cell_1.tiff";
const PRE = "yeast/b1/preprocessing/v1/cell_1.tiff";
const csv = (gold = "true") => `${HEADER}\nimg_1,${RAW},${PRE},${gold},Phenom Pharos,100.0,0.052,,2026-10-12T11:09:45\n`;

/** In-memory source whose text can change; `fail` makes the next load throw. */
function memorySource(text: string) {
  const state = { text, version: 1, fail: false, loads: 0 };
  const source: RegistrySource = {
    name: "memory",
    async load(since) {
      state.loads++;
      if (state.fail) throw new Error("boom");
      if (since === String(state.version)) return "unchanged";
      return { version: String(state.version), text: state.text };
    },
  };
  return { source, state };
}

test("indexes a row under its raw key and its preprocessed key, with typed fields", async () => {
  const reg = createRegistry(memorySource(csv()).source, 0);
  await reg.refresh();
  const meta = reg.lookup(RAW);
  expect(meta).toMatchObject({ imageId: "img_1", gold: "true", instrument: "Phenom Pharos", fieldWidthUm: 100 });
  expect(meta?.pixelSizeUm).toBeCloseTo(0.052);
  expect(meta?.acquiredAt).toBe("2026-10-12T11:09:45");
  expect(reg.lookup(PRE)).toEqual(meta);
  expect(reg.lookup("yeast/b1/raw/other.tiff")).toBeNull();
  expect(reg.status()).toMatchObject({ configured: true, loaded: true, rows: 1, error: null });
});

test("empty numbers become null and odd gold values become unknown", async () => {
  const text = `${HEADER}\nimg_2,${RAW},,maybe,XL3,,,,\n`;
  const reg = createRegistry(memorySource(text).source, 0);
  await reg.refresh();
  expect(reg.lookup(RAW)).toMatchObject({ gold: "unknown", fieldWidthUm: null, pixelSizeUm: null, acquiredAt: null });
});

test("re-parses only after the source changes", async () => {
  const { source, state } = memorySource(csv("true"));
  const reg = createRegistry(source, 0);
  await reg.refresh();
  await reg.refresh();
  expect(reg.lookup(RAW)?.gold).toBe("true");
  state.text = csv("false");
  state.version = 2;
  await reg.refresh();
  expect(reg.lookup(RAW)?.gold).toBe("false");
});

test("a failed reload keeps the last good data and reports the error", async () => {
  const { source, state } = memorySource(csv());
  const reg = createRegistry(source, 0);
  await reg.refresh();
  state.fail = true;
  await reg.refresh();
  expect(reg.lookup(RAW)?.gold).toBe("true");
  expect(reg.status()).toMatchObject({ loaded: true, error: "boom" });
});

test("checks the source at most once per interval", async () => {
  const { source, state } = memorySource(csv());
  const reg = createRegistry(source, 60_000);
  await reg.refresh();
  await reg.refresh();
  expect(state.loads).toBe(1);
});

test("no source: lookups return null and status says not configured", async () => {
  const reg = createRegistry(null);
  await reg.refresh();
  expect(reg.lookup(RAW)).toBeNull();
  expect(reg.status()).toMatchObject({ configured: false, loaded: false, error: "Registry not configured" });
});

test("file source: missing file is an error, a newer file time reloads", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "registry-"));
  const file = path.join(dir, "images.csv");
  const reg = createRegistry(createFileSource(file), 0);

  await reg.refresh();
  expect(reg.status()).toMatchObject({ loaded: false, error: "Registry file not found" });

  await writeFile(file, csv("true"));
  await utimes(file, new Date("2026-10-20T10:00:00Z"), new Date("2026-10-20T10:00:00Z"));
  await reg.refresh();
  expect(reg.lookup(RAW)?.gold).toBe("true");

  await writeFile(file, csv("false"));
  await utimes(file, new Date("2026-10-21T10:00:00Z"), new Date("2026-10-21T10:00:00Z"));
  await reg.refresh();
  expect(reg.lookup(RAW)?.gold).toBe("false");
  expect(reg.status().version).toBe("2026-10-21T10:00:00.000Z");
});
