import { mkdtemp, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, test } from "vitest";
import { createFileSource, createGitHubSource, createRegistry, parseSplitTags, type RegistrySource } from "../src/registry.js";

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

const GITHUB = { token: "ghp_secret", repo: "Nanoscout/data-registry", ref: "v1", path: "catalog/yeast/images.csv" };

/** Fake fetch that records each request and answers with the next queued response. */
function fakeFetch(...responses: Response[]) {
  const calls: { url: string; headers: Headers }[] = [];
  const fetchFn = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), headers: new Headers(init?.headers) });
    const next = responses.shift();
    if (!next) throw new Error("no more fake responses");
    return next;
  };
  return { fetchFn: fetchFn as typeof fetch, calls };
}

test("GitHub source: fetches the raw file at the branch with the token, version = ETag", async () => {
  const { fetchFn, calls } = fakeFetch(new Response(csv(), { status: 200, headers: { ETag: '"abc"' } }));
  const result = await createGitHubSource(GITHUB, fetchFn).load(null);

  expect(result).toEqual({ version: '"abc"', text: csv() });
  expect(calls[0].url).toBe(
    "https://api.github.com/repos/Nanoscout/data-registry/contents/catalog/yeast/images.csv?ref=v1",
  );
  expect(calls[0].headers.get("authorization")).toBe("Bearer ghp_secret");
  expect(calls[0].headers.get("accept")).toBe("application/vnd.github.raw+json");
  expect(calls[0].headers.get("if-none-match")).toBeNull();
});

test("GitHub source: sends the last ETag and treats 304 as unchanged", async () => {
  const { fetchFn, calls } = fakeFetch(new Response(null, { status: 304 }));
  expect(await createGitHubSource(GITHUB, fetchFn).load('"abc"')).toBe("unchanged");
  expect(calls[0].headers.get("if-none-match")).toBe('"abc"');
});

test("GitHub source: an error status becomes a clear Registry error without the token", async () => {
  const { fetchFn } = fakeFetch(new Response("Not Found", { status: 404 }));
  const reg = createRegistry(createGitHubSource(GITHUB, fetchFn), 0);
  await reg.refresh();
  const { error } = reg.status();
  expect(error).toMatch(/not found on GitHub/);
  expect(error).not.toContain("ghp_secret");
});

test("GitHub source: a rejected token says so", async () => {
  const { fetchFn } = fakeFetch(new Response("Bad credentials", { status: 401 }));
  await expect(createGitHubSource(GITHUB, fetchFn).load(null)).rejects.toThrow(/token rejected/);
});

const TAGS = "split,tag\nb1,10-3\nb1,10-3\nb1,ctrl\nb2,10-5\nb3,\n";

test("parseSplitTags groups tags by split, drops blanks and repeats, keeps file order", () => {
  const m = parseSplitTags(TAGS);
  expect(m.get("b1")).toEqual(["10-3", "ctrl"]);
  expect(m.get("b2")).toEqual(["10-5"]);
  expect(m.has("b3")).toBe(false);
});

test("parseSplitTags rejects a file without split and tag columns", () => {
  expect(() => parseSplitTags("name,label\nb1,10-3\n")).toThrow("split_tags.csv needs split and tag columns");
});

test("tagsFor reads the tags source on refresh; unknown splits have no tags", async () => {
  const reg = createRegistry(memorySource(csv()).source, 0, memorySource(TAGS).source);
  await reg.refresh();
  expect(reg.tagsFor("b1")).toEqual(["10-3", "ctrl"]);
  expect(reg.tagsFor("nope")).toEqual([]);
});

test("a failing tags source keeps images.csv metadata and the last good tags", async () => {
  const tags = memorySource(TAGS);
  const reg = createRegistry(memorySource(csv()).source, 0, tags.source);
  await reg.refresh();
  tags.state.fail = true;
  tags.state.version = 2;
  await reg.refresh();
  expect(reg.tagsFor("b2")).toEqual(["10-5"]);
  expect(reg.lookup(RAW)?.imageId).toBe("img_1");
  expect(reg.status().error).toBeNull();
});

test("a missing tags source from the start means no tags, metadata still loads", async () => {
  const missing: RegistrySource = { name: "missing", load: async () => Promise.reject(new Error("Registry file not found")) };
  const reg = createRegistry(memorySource(csv()).source, 0, missing);
  await reg.refresh();
  expect(reg.tagsFor("b1")).toEqual([]);
  expect(reg.lookup(RAW)).not.toBeNull();
});

test("a split_tags.csv with a wrong header and no rows keeps the last good tags", async () => {
  expect(() => parseSplitTags("name,label\n")).toThrow("split_tags.csv needs split and tag columns");
  const tags = memorySource(TAGS);
  const reg = createRegistry(memorySource(csv()).source, 0, tags.source);
  await reg.refresh();
  tags.state.text = "name,label\n";
  tags.state.version = 2;
  await reg.refresh();
  expect(reg.tagsFor("b1")).toEqual(["10-3", "ctrl"]);
});
