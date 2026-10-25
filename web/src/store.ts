// App-wide state as module-level signals: every component imports what it needs.
// createRoot gives these long-lived computations an owner (they live as long as the page).
import { createMemo, createResource, createRoot, createSignal } from "solid-js";
import * as http from "./api";
import {
  activeFilterCount as fieldFilterCount,
  matchesFilters,
  NO_FILTERS,
  sortFiles,
  type FieldId,
  type Filters,
  type FilterValue,
  type SortDir,
} from "./lib/fields";
import { inDateRange, matchesSearch, sortFolders } from "./lib/rows";
import type { FileEntry, FolderEntry, ListResult, RegistryStatus } from "./types";

/** Where browsing starts, told by the server (GET /api/root), e.g. { prefix: "SEM-DATA/yeast/", name: "yeast" }. */
export type Root = { prefix: string; name: string };

export type Selection = { kind: "folder"; entry: FolderEntry } | { kind: "file"; entry: FileEntry };
export type ViewMode = "icons" | "details";

/** The file shown in the full-screen viewer and its place among the visible files. */
export type ViewerState = {
  file: FileEntry;
  index: number;
  count: number;
  /** The visible file `delta` places away (-1 = previous), or undefined past either end. */
  at(delta: number): FileEntry | undefined;
};

/** What the store asks the server. The page passes api.ts; tests pass an in-memory listing. */
export type StoreApi = {
  listFolder(prefix: string): Promise<ListResult>;
  getRegistryStatus(): Promise<RegistryStatus>;
};

/** "yeast/a/raw/" -> "yeast/a/" (never above the root). */
export function parentPrefix(prefix: string, rootPrefix: string): string {
  if (prefix === rootPrefix) return rootPrefix;
  const parts = prefix.split("/").filter(Boolean);
  return parts.slice(0, -1).join("/") + "/";
}

/** Must run inside a reactive owner (createRoot). */
export function createStore(api: StoreApi) {
  const [root, setRoot] = createSignal<Root>({ prefix: "", name: "" });
  const [currentPrefix, setCurrentPrefix] = createSignal("");
  // The selected item's id: a folder prefix (ends with "/") or a file key.
  const [selectedId, setSelectedId] = createSignal<string | null>(null);
  const [view, setView] = createSignal<ViewMode>("icons");
  const [search, setSearch] = createSignal("");
  const [dateFrom, setDateFrom] = createSignal("");
  const [dateTo, setDateTo] = createSignal("");
  const [sortColumn, setSortColumn] = createSignal<FieldId>("name");
  const [sortDir, setSortDir] = createSignal<SortDir>("asc");
  // Folders keep the server's order (batches newest first) until the user clicks a header.
  const [userSorted, setUserSorted] = createSignal(false);
  const [viewerKey, setViewerKey] = createSignal<string | null>(null);
  // Field filters stay set while browsing other folders, like the date filter.
  const [filters, setFilters] = createSignal<Filters>(NO_FILTERS);

  // An empty prefix (before init) means "nothing to load yet".
  const [listing] = createResource(() => currentPrefix() || false, (p) => api.listFolder(p));
  // Asked once per page load; the server re-reads the Registry file by itself when it changes.
  const [registry] = createResource(() => api.getRegistryStatus());

  /**
   * Called once at startup with the server's root, and the folder to open first (from the
   * page address); a start outside the root opens the root.
   */
  function init(r: Root, start: string = r.prefix) {
    setRoot(r);
    setCurrentPrefix(start.startsWith(r.prefix) && start.endsWith("/") ? start : r.prefix);
  }

  /**
   * Open a folder: clears the selection and the search. Back and forward are the browser's
   * own history (see history.ts), so the store keeps no back list.
   */
  function navigate(prefix: string) {
    if (prefix === currentPrefix()) return;
    setCurrentPrefix(prefix);
    setSelectedId(null);
    setSearch("");
  }

  function up() {
    navigate(parentPrefix(currentPrefix(), root().prefix));
  }

  /** Click on a header: same column flips the direction, a new column starts ascending. */
  function sortBy(column: FieldId) {
    setUserSorted(true);
    if (sortColumn() === column) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortColumn(column);
      setSortDir("asc");
    }
  }

  /** Sort menu: set column and direction at once. */
  function setSort(column: FieldId, dir: SortDir) {
    setUserSorted(true);
    setSortColumn(column);
    setSortDir(dir);
  }

  /** How many filters are set (each date bound, each Field filter), for the badge on the filter button. */
  const activeFilterCount = () => [dateFrom(), dateTo()].filter((v) => v !== "").length + fieldFilterCount(filters());

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
    const shown = folderFiles().filter((f) => matchesSearch(f.name, search()) && matchesFilters(f, filters()));
    return sortFiles(shown, sortColumn(), sortDir());
  });

  /** Files of this folder that the Field filters hide (search hides are not counted). */
  const hiddenByFilters = createMemo(() => folderFiles().filter((f) => !matchesFilters(f, filters())).length);

  /**
   * The selected item, only while it is visible: a filter or a search that hides it leaves
   * nothing selected, and clearing them selects it again.
   */
  const selected = createMemo<Selection | null>(
    () => {
      const id = selectedId();
      if (id === null) return null;
      if (id.endsWith("/")) {
        const entry = visibleFolders().find((f) => f.prefix === id);
        return entry ? { kind: "folder", entry } : null;
      }
      const entry = visibleFiles().find((f) => f.key === id);
      return entry ? { kind: "file", entry } : null;
    },
    null,
    { equals: (a, b) => a?.entry === b?.entry },
  );

  /** The viewer's file and position among the visible files; null when closed or the file is hidden. */
  const viewer = createMemo<ViewerState | null>(() => {
    const key = viewerKey();
    if (key === null) return null;
    const files = visibleFiles();
    const index = files.findIndex((f) => f.key === key);
    if (index < 0) return null;
    return { file: files[index], index, count: files.length, at: (delta) => files[index + delta] };
  });

  /** Full-screen viewer on one visible file; the file also becomes the selection. */
  function openViewer(key: string) {
    if (!visibleFiles().some((f) => f.key === key)) return;
    setSelectedId(key);
    setViewerKey(key);
  }

  /** Next (+1) or previous (-1) visible file; stops at the first and the last. */
  function stepViewer(delta: number) {
    const next = viewer()?.at(delta);
    if (next) openViewer(next.key);
  }

  return {
    root,
    init,
    viewer,
    openViewer,
    stepViewer,
    closeViewer: () => setViewerKey(null),
    currentPrefix,
    navigate,
    up,
    canUp: () => currentPrefix() !== root().prefix,
    listing,
    selected,
    /** Select a folder (by prefix) or a file (by key); null clears the selection. */
    select: (id: string | null) => setSelectedId(id),
    /** True when the item with this folder prefix or file key is the selected one. */
    isSelected: (id: string) => selectedId() === id,
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
    setFilter: (id: FieldId, value: FilterValue) => setFilters((f) => ({ ...f, [id]: value })),
    activeFilterCount,
    clearAllFilters,
    registry,
  };
}

export const store = createRoot(() => createStore(http));
