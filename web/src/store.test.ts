import { createRoot } from "solid-js";
import { afterEach, expect, test } from "vitest";
import { createStore } from "./store";
import type { FileEntry, FolderEntry, ImageMeta, ListResult } from "./types";

const folder = (name: string): FolderEntry => ({ name, prefix: `yeast/${name}/`, date: null });
const file = (name: string, gold: ImageMeta["gold"]): FileEntry => ({
  name,
  key: `yeast/b/raw/${name}`,
  size: 1,
  uploaded: "2026-10-19T09:00:00Z",
  date: null,
  meta: { gold } as ImageMeta,
});

const LISTINGS: Record<string, ListResult> = {
  "yeast/": { folders: [folder("alpha"), folder("beta")], files: [] },
  "yeast/b/raw/": {
    folders: [],
    files: [file("cell_1.tiff", "true"), file("cell_2.tiff", "false"), file("cell_3.tiff", "true")],
  },
};

let dispose = () => {};
afterEach(() => dispose());

/** A fresh store on the in-memory listing, opened at `prefix` with its listing loaded. */
async function storeAt(prefix: string) {
  const s = createRoot((d) => {
    dispose = d;
    return createStore({
      listFolder: async (p) => LISTINGS[p] ?? { folders: [], files: [] },
      getRegistryStatus: async () => ({ configured: false, loaded: false, rows: 0, version: null, error: null }),
    });
  });
  s.init({ prefix: "yeast/", name: "yeast" });
  s.navigate(prefix);
  await loaded();
  return s;
}

/** Let the listing resource resolve. */
const loaded = () => new Promise((resolve) => setTimeout(resolve, 0));

const raw = "yeast/b/raw/";
const key = (name: string) => raw + name;

test("a filter that hides the selected file leaves nothing selected; clearing it selects the file again", async () => {
  const s = await storeAt(raw);
  s.select(key("cell_2.tiff"));
  expect(s.selected()?.entry.name).toBe("cell_2.tiff");
  s.setFilter("gold", "Yes");
  expect(s.selected()).toBeNull();
  s.clearAllFilters();
  expect(s.selected()?.entry.name).toBe("cell_2.tiff");
});

test("a search that hides the selected folder leaves nothing selected", async () => {
  const s = await storeAt("yeast/");
  s.select("yeast/beta/");
  expect(s.selected()?.kind).toBe("folder");
  s.setSearch("alp");
  expect(s.selected()).toBeNull();
});

test("going to another folder clears the selection", async () => {
  const s = await storeAt(raw);
  s.select(key("cell_1.tiff"));
  s.back();
  await loaded();
  s.navigate(raw);
  await loaded();
  expect(s.selected()).toBeNull();
});

test("the viewer steps through visible files and stops at both ends", async () => {
  const s = await storeAt(raw);
  s.openViewer(key("cell_1.tiff"));
  expect(s.viewer()).toMatchObject({ index: 0, count: 3 });
  s.stepViewer(-1);
  expect(s.viewer()?.file.name).toBe("cell_1.tiff");
  s.stepViewer(1);
  s.stepViewer(1);
  expect(s.viewer()?.file.name).toBe("cell_3.tiff");
  expect(s.viewer()?.at(1)).toBeUndefined();
  s.stepViewer(1);
  expect(s.viewer()?.file.name).toBe("cell_3.tiff");
  expect(s.selected()?.entry.name).toBe("cell_3.tiff");
});

test("the viewer skips files a filter hides, and closes when its own file is hidden", async () => {
  const s = await storeAt(raw);
  s.setFilter("gold", "Yes");
  s.openViewer(key("cell_1.tiff"));
  s.stepViewer(1);
  expect(s.viewer()).toMatchObject({ index: 1, count: 2 });
  expect(s.viewer()?.file.name).toBe("cell_3.tiff");
  s.setFilter("gold", "No");
  expect(s.viewer()).toBeNull();
});

test("the viewer does not open on a hidden file", async () => {
  const s = await storeAt(raw);
  s.setFilter("gold", "Yes");
  s.openViewer(key("cell_2.tiff"));
  expect(s.viewer()).toBeNull();
  expect(s.selected()).toBeNull();
});
