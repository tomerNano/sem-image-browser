// App-wide state as module-level signals: every component imports what it needs.
// createRoot gives these long-lived computations an owner (they live as long as the page).
import { createMemo, createResource, createRoot, createSignal } from "solid-js";
import { getRegistryStatus, listFolder } from "./api";
import {
  inDateRange,
  matchesFilters,
  matchesSearch,
  NO_FILTERS,
  sortFiles,
  sortFolders,
  type MetaFilters,
  type SortColumn,
  type SortDir,
} from "./lib/rows";
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
  // Folders keep the server's order (batches newest first) until the user clicks a header.
  const [userSorted, setUserSorted] = createSignal(false);
  const [viewerKey, setViewerKey] = createSignal<string | null>(null);
  // Registry filters stay set while browsing other folders, like the date filter.
  const [filters, setFilters] = createSignal<MetaFilters>(NO_FILTERS);

  // An empty prefix (before init) means "nothing to load yet".
  const [listing] = createResource(() => currentPrefix() || false, listFolder);
  // Asked once per page load; the server re-reads the Registry file by itself when it changes.
  const [registry] = createResource(getRegistryStatus);

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
    setUserSorted(true);
    if (sortColumn() === column) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortColumn(column);
      setSortDir("asc");
    }
  }

  /** Sort menu: set column and direction at once. */
  function setSort(column: SortColumn, dir: SortDir) {
    setUserSorted(true);
    setSortColumn(column);
    setSortDir(dir);
  }

  /** How many filters are set (dates and Registry fields), for the badge on the filter button. */
  const activeFilterCount = () =>
    [dateFrom(), dateTo(), ...Object.values(filters())].filter((v) => v !== "").length;

  function clearAllFilters() {
    setDateFrom("");
    setDateTo("");
    setFilters(NO_FILTERS);
  }

  const visibleFolders = createMemo<FolderEntry[]>(() => {
    const folders = listing.error ? [] : (listing()?.folders ?? []);
    const atRoot = currentPrefix() === root().prefix;
    const shown = folders.filter(
      (f) => matchesSearch(f.name, search()) && (!atRoot || inDateRange(f.date, dateFrom(), dateTo())),
    );
    return userSorted() ? sortFolders(shown, sortColumn(), sortDir()) : shown;
  });

  const folderFiles = createMemo<FileEntry[]>(() => (listing.error ? [] : (listing()?.files ?? [])));

  const visibleFiles = createMemo<FileEntry[]>(() => {
    const shown = folderFiles().filter((f) => matchesSearch(f.name, search()) && matchesFilters(f.meta, filters()));
    return sortFiles(shown, sortColumn(), sortDir());
  });

  /** Files of this folder that the Registry filters hide (search hides are not counted). */
  const hiddenByFilters = createMemo(() => folderFiles().filter((f) => !matchesFilters(f.meta, filters())).length);

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
    setSort,
    visibleFolders,
    visibleFiles,
    folderFiles,
    hiddenByFilters,
    filters,
    setFilter: <K extends keyof MetaFilters>(name: K, value: MetaFilters[K]) => setFilters((f) => ({ ...f, [name]: value })),
    activeFilterCount,
    clearAllFilters,
    registry,
  };
}

export const store = createRoot(createStore);

/** True when the item with this folder prefix or file key is the selected one. */
export function isSelected(id: string): boolean {
  const s = store.selected();
  return s !== null && (s.kind === "folder" ? s.entry.prefix : s.entry.key) === id;
}
