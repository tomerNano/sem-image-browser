// App-wide state as module-level signals: every component imports what it needs.
// createRoot gives these long-lived computations an owner (they live as long as the page).
import { createMemo, createResource, createRoot, createSignal } from "solid-js";
import { listFolder } from "./api";
import { inDateRange, matchesSearch, sortFiles, type SortColumn, type SortDir } from "./lib/rows";
import type { FileEntry, FolderEntry } from "./types";

/** Where browsing starts, told by the server (GET /api/root), e.g. { prefix: "SEM-DATA/yeast/", name: "yeast" }. */
export type Root = { prefix: string; name: string };

export type Selection = { kind: "folder"; entry: FolderEntry } | { kind: "file"; entry: FileEntry };
export type ViewMode = "icons" | "details";

/** "yeast/a/raw/" -> "yeast/a/" (never above the root). */
export function parentPrefix(prefix: string, rootPrefix: string): string {
  if (prefix === rootPrefix) return rootPrefix;
  const parts = prefix.split("/").filter(Boolean);
  return parts.slice(0, -1).join("/") + "/";
}

function createStore() {
  const [root, setRoot] = createSignal<Root>({ prefix: "", name: "" });
  const [currentPrefix, setCurrentPrefix] = createSignal("");
  const [history, setHistory] = createSignal<string[]>([]);
  const [selected, select] = createSignal<Selection | null>(null);
  const [view, setView] = createSignal<ViewMode>("icons");
  const [search, setSearch] = createSignal("");
  const [dateFrom, setDateFrom] = createSignal("");
  const [dateTo, setDateTo] = createSignal("");
  const [sortColumn, setSortColumn] = createSignal<SortColumn>("name");
  const [sortDir, setSortDir] = createSignal<SortDir>("asc");
  const [viewerKey, setViewerKey] = createSignal<string | null>(null);

  // An empty prefix (before init) means "nothing to load yet".
  const [listing] = createResource(() => currentPrefix() || false, listFolder);

  /** Called once at startup with the server's root. */
  function init(r: Root) {
    setRoot(r);
    setCurrentPrefix(r.prefix);
  }

  function go(prefix: string) {
    setCurrentPrefix(prefix);
    select(null);
    setSearch("");
  }

  function navigate(prefix: string) {
    if (prefix === currentPrefix()) return;
    setHistory((h) => [...h, currentPrefix()]);
    go(prefix);
  }

  function back() {
    const h = history();
    if (h.length === 0) return;
    setHistory(h.slice(0, -1));
    go(h[h.length - 1]);
  }

  function up() {
    navigate(parentPrefix(currentPrefix(), root().prefix));
  }

  /** Click on a header: same column flips the direction, a new column starts ascending. */
  function sortBy(column: SortColumn) {
    if (sortColumn() === column) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortColumn(column);
      setSortDir("asc");
    }
  }

  const visibleFolders = createMemo<FolderEntry[]>(() => {
    const folders = listing.error ? [] : (listing()?.folders ?? []);
    const atRoot = currentPrefix() === root().prefix;
    return folders.filter(
      (f) => matchesSearch(f.name, search()) && (!atRoot || inDateRange(f.date, dateFrom(), dateTo())),
    );
  });

  const visibleFiles = createMemo<FileEntry[]>(() => {
    const files = listing.error ? [] : (listing()?.files ?? []);
    return sortFiles(files.filter((f) => matchesSearch(f.name, search())), sortColumn(), sortDir());
  });

  /** Full-screen viewer on one file; the file also becomes the selection. */
  function openViewer(key: string) {
    const file = visibleFiles().find((f) => f.key === key);
    if (!file) return;
    select({ kind: "file", entry: file });
    setViewerKey(key);
  }

  return {
    root,
    init,
    viewerKey,
    openViewer,
    closeViewer: () => setViewerKey(null),
    currentPrefix,
    navigate,
    back,
    up,
    canBack: () => history().length > 0,
    canUp: () => currentPrefix() !== root().prefix,
    listing,
    selected,
    select,
    view,
    setView,
    search,
    setSearch,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    sortColumn,
    sortDir,
    sortBy,
    visibleFolders,
    visibleFiles,
  };
}

export const store = createRoot(createStore);

/** True when the item with this folder prefix or file key is the selected one. */
export function isSelected(id: string): boolean {
  const s = store.selected();
  return s !== null && (s.kind === "folder" ? s.entry.prefix : s.entry.key) === id;
}
