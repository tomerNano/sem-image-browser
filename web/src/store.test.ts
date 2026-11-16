import { createRoot } from "solid-js";
import { afterEach, expect, test } from "vitest";
import { createStore } from "./store";
import type { FileEntry, FolderEntry, ImageMeta, ListResult, SplitGroups } from "./types";

const folder = (name: string, tags: string[] = []): FolderEntry => ({ name, prefix: `yeast/${name}/`, date: null, tags });
const file = (name: string, gold: ImageMeta["gold"]): FileEntry => ({
  name,
  key: `yeast/b/raw/${name}`,
  size: 1,
  uploaded: "2026-10-19T09:00:00Z",
  date: null,
  meta: { gold } as ImageMeta,
  tags: [],
});

const LISTINGS: Record<string, ListResult> = {
  "yeast/": { folders: [folder("alpha", ["10-3"]), folder("beta", ["10-5"])], files: [] },
  "yeast/b/raw/": {
    folders: [],
    files: [file("cell_1.tiff", "true"), file("cell_2.tiff", "false"), file("cell_3.tiff", "true")],
  },
  // 2 folders + 5 files: with 3 items per page, pages are [a, b, cell_1] [cell_2..cell_4] [cell_5].
  "yeast/big/": {
    folders: [folder("a"), folder("b")],
    files: ["cell_1", "cell_2", "cell_3", "cell_4", "cell_5"].map((n) => ({
      ...file(n + ".tiff", n === "cell_2" ? "false" : "true"),
      key: `yeast/big/${n}.tiff`,
    })),
  },
};

// Registry image groups by split: alpha has 1 gold and 2 non-gold images, beta 4 non-gold ones.
const SPLIT_GROUPS: SplitGroups = {
  alpha: [
    { meta: { gold: "true", split: "alpha" } as ImageMeta, count: 1 },
    { meta: { gold: "false", split: "alpha" } as ImageMeta, count: 2 },
  ],
  beta: [{ meta: { gold: "false", split: "beta" } as ImageMeta, count: 4 }],
};

let dispose = () => {};
afterEach(() => dispose());

/** A fresh store on the in-memory listing, opened at `prefix` with its listing loaded. */
async function storeAt(prefix: string, pageSize?: number) {
  const s = createRoot((d) => {
    dispose = d;
    return createStore({
      listFolder: async (p) => LISTINGS[p] ?? { folders: [], files: [] },
      getRegistryStatus: async () => ({ configured: false, loaded: false, rows: 0, version: null, error: null }),
      getSplitGroups: async () => SPLIT_GROUPS,
    }, { pageSize });
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
  s.navigate("yeast/");
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

test("init opens the start folder from the address, or the root when it is not inside it", () => {
  const s = createRoot((d) => {
    dispose = d;
    return createStore({
      listFolder: async () => ({ folders: [], files: [] }),
      getRegistryStatus: async () => ({ configured: false, loaded: false, rows: 0, version: null, error: null }),
      getSplitGroups: async () => ({}),
    });
  });
  s.init({ prefix: "yeast/", name: "yeast" }, raw);
  expect(s.currentPrefix()).toBe(raw);
  s.init({ prefix: "yeast/", name: "yeast" }, "other/");
  expect(s.currentPrefix()).toBe("yeast/");
});

test("Ctrl+click adds and removes items; selected() is only set for exactly one item", async () => {
  const s = await storeAt(raw);
  s.clickItem(key("cell_1.tiff"), { toggle: false, range: false });
  s.clickItem(key("cell_3.tiff"), { toggle: true, range: false });
  expect(s.selection().map((i) => i.entry.name)).toEqual(["cell_1.tiff", "cell_3.tiff"]);
  expect(s.selected()).toBeNull();
  s.clickItem(key("cell_1.tiff"), { toggle: true, range: false });
  expect(s.selected()?.entry.name).toBe("cell_3.tiff");
});

test("Shift+click selects the visible range from the anchor; Ctrl+Shift keeps the old selection", async () => {
  const s = await storeAt(raw);
  s.select(key("cell_3.tiff"));
  s.clickItem(key("cell_1.tiff"), { toggle: false, range: true });
  expect(s.selectedFiles().map((f) => f.name)).toEqual(["cell_1.tiff", "cell_2.tiff", "cell_3.tiff"]);
  // The anchor stays on cell_3, so a second Shift+click shrinks the range.
  s.clickItem(key("cell_2.tiff"), { toggle: false, range: true });
  expect(s.selectedFiles().map((f) => f.name)).toEqual(["cell_2.tiff", "cell_3.tiff"]);

  s.select(key("cell_1.tiff"));
  s.clickItem(key("cell_3.tiff"), { toggle: true, range: false });
  s.clickItem(key("cell_2.tiff"), { toggle: true, range: true });
  expect(s.selectedFiles().map((f) => f.name)).toEqual(["cell_1.tiff", "cell_2.tiff", "cell_3.tiff"]);
});

test("a range skips hidden files, and select all takes only visible items", async () => {
  const s = await storeAt(raw);
  s.setFilter("gold", "Yes");
  s.select(key("cell_1.tiff"));
  s.selectRange(key("cell_3.tiff"));
  expect(s.selectedFiles().map((f) => f.name)).toEqual(["cell_1.tiff", "cell_3.tiff"]);
  s.select(null);
  s.selectAll();
  expect(s.selection()).toHaveLength(2);
  s.clearAllFilters();
  expect(s.isSelected(key("cell_2.tiff"))).toBe(false);
});

test("selected folders are not selected files, and going to another folder clears everything", async () => {
  const s = await storeAt("yeast/");
  s.selectAll();
  expect(s.selection()).toHaveLength(2);
  expect(s.selectedFiles()).toEqual([]);
  s.navigate(raw);
  await loaded();
  expect(s.selection()).toEqual([]);
  expect(s.focused()).toBeNull();
});

const big = "yeast/big/";
const names = (s: Awaited<ReturnType<typeof storeAt>>) => [
  ...s.pageFolders().map((f) => f.name),
  ...s.pageFiles().map((f) => f.name),
];

test("pages slice folders first, then files; the last page holds the rest", async () => {
  const s = await storeAt(big, 3);
  expect(s.pageCount()).toBe(3);
  expect(names(s)).toEqual(["a", "b", "cell_1.tiff"]);
  s.setPage(1);
  expect(names(s)).toEqual(["cell_2.tiff", "cell_3.tiff", "cell_4.tiff"]);
  s.setPage(2);
  expect(names(s)).toEqual(["cell_5.tiff"]);
  s.setPage(9);
  expect(s.page()).toBe(2);
});

test("a folder that fits on one page has one page", async () => {
  const s = await storeAt(raw);
  expect(s.pageCount()).toBe(1);
  expect(s.pageFiles()).toHaveLength(3);
});

test("search, filters, sort and another folder go back to the first page", async () => {
  const s = await storeAt(big, 3);
  s.setPage(2);
  s.setFilter("gold", "Yes");
  expect(s.page()).toBe(0);
  s.setPage(1);
  s.setSearch("cell");
  expect(s.page()).toBe(0);
  s.setPage(1);
  s.sortBy("name");
  expect(s.page()).toBe(0);
});

test("Ctrl+A and the viewer still cover every page", async () => {
  const s = await storeAt(big, 3);
  s.selectAll();
  expect(s.selection()).toHaveLength(7);
  s.openViewer(big + "cell_1.tiff");
  expect(s.viewer()).toMatchObject({ index: 0, count: 5 });
});

test("the page follows the focus: selecting or viewing an item on another page opens that page", async () => {
  const s = await storeAt(big, 3);
  s.select(big + "cell_2.tiff");
  expect(s.page()).toBe(1);
  s.openViewer(big + "cell_4.tiff");
  s.stepViewer(1);
  expect(s.page()).toBe(2);
  s.selectRange(big + "cell_1.tiff");
  expect(s.page()).toBe(0);
});

test("the tag filter hides other splits at the root, counts as a filter and stays set inside a split", async () => {
  const s = await storeAt("yeast/");
  s.toggleTag("10-3");
  expect(s.visibleFolders().map((f) => f.name)).toEqual(["alpha"]);
  expect(s.activeFilterCount()).toBe(1);
  s.navigate(raw);
  await loaded();
  expect(s.visibleFiles()).toHaveLength(3);
  s.navigate("yeast/");
  await loaded();
  expect(s.visibleFolders().map((f) => f.name)).toEqual(["alpha"]);
  s.clearAllFilters();
  expect(s.visibleFolders()).toHaveLength(2);
});

test("at the top level a Field filter shows only splits with a matching image, with the match count", async () => {
  const s = await storeAt("yeast/");
  expect(s.splitMatch("alpha")).toBeNull();
  expect(s.visibleFolders().map((f) => f.name)).toEqual(["alpha", "beta"]);
  s.setFilter("gold", "Yes");
  expect(s.visibleFolders().map((f) => f.name)).toEqual(["alpha"]);
  expect(s.splitMatch("alpha")).toEqual({ matched: 1, total: 3 });
  expect(s.hiddenByFilters()).toBe(1);
});

test("at the top level the filter choices come from every split's images", async () => {
  const s = await storeAt("yeast/");
  expect(s.filterFiles().map((f) => f.meta?.gold).sort()).toEqual(["false", "false", "true"]);
  s.navigate(raw);
  await loaded();
  expect(s.filterFiles().map((f) => f.name)).toEqual(["cell_1.tiff", "cell_2.tiff", "cell_3.tiff"]);
});

test("several chosen tags show every split that has any of them; each tag counts as one filter", async () => {
  const s = await storeAt("yeast/");
  s.toggleTag("10-3");
  expect(s.visibleFolders().map((f) => f.name)).toEqual(["alpha"]);
  s.toggleTag("10-5");
  expect(s.visibleFolders().map((f) => f.name)).toEqual(["alpha", "beta"]);
  expect(s.activeFilterCount()).toBe(2);
  s.toggleTag("10-3");
  expect(s.tagFilter()).toEqual(["10-5"]);
  expect(s.visibleFolders().map((f) => f.name)).toEqual(["beta"]);
});
