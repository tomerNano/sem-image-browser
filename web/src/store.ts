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
import { hasTag, inDateRange, matchesSearch, sortFolders } from "./lib/rows";
import type { FileEntry, FolderEntry, ListResult, RegistryStatus, SplitImages } from "./types";

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
  getSplitImages(): Promise<SplitImages>;
};

/** How many of a split's Registry images pass the Field filters. */
export type SplitMatch = { matched: number; total: number };

/**
 * Items per page (folders first, then files). A page bounds the DOM and the thumbnail requests;
 * sort, search, filters and selection still cover the whole folder.
 */
export const PAGE_SIZE = 200;

export type StoreOptions = { pageSize?: number };

/** "yeast/a/raw/" -> "yeast/a/" (never above the root). */
export function parentPrefix(prefix: string, rootPrefix: string): string {
  if (prefix === rootPrefix) return rootPrefix;
  const parts = prefix.split("/").filter(Boolean);
  return parts.slice(0, -1).join("/") + "/";
}

/** Must run inside a reactive owner (createRoot). */
export function createStore(api: StoreApi, { pageSize = PAGE_SIZE }: StoreOptions = {}) {
  const [root, setRoot] = createSignal<Root>({ prefix: "", name: "" });
  const [currentPrefix, setCurrentPrefix] = createSignal("");
  // Ids of the selected items: folder prefixes (end with "/") and file keys.
  const [selectedIds, setSelectedIds] = createSignal<ReadonlySet<string>>(new Set());
  // Where a Shift range starts (the last plain or Ctrl click), and where the arrow keys move from.
  const [anchorId, setAnchorId] = createSignal<string | null>(null);
  const [focusId, setFocusId] = createSignal<string | null>(null);
  const [view, setView] = createSignal<ViewMode>("icons");
  const [search, setSearch] = createSignal("");
  const [dateFrom, setDateFrom] = createSignal("");
  const [dateTo, setDateTo] = createSignal("");
  // Split tag chosen in the filter panel ("" = any). Like the dates, it hides batch folders only.
  const [tagFilter, setTagFilter] = createSignal("");
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
    select(null);
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

  /** How many filters are set (each date bound, the tag, each Field filter), for the badge on the filter button. */
  const activeFilterCount = () =>
    [dateFrom(), dateTo(), tagFilter()].filter((v) => v !== "").length + fieldFilterCount(filters());

  function clearAllFilters() {
    setDateFrom("");
    setDateTo("");
    setTagFilter("");
    setFilters(NO_FILTERS);
  }

  /** Every folder of the current listing, before search and filters (the tag filter options read it). */
  const listedFolders = createMemo<FolderEntry[]>(() => (listing.error ? [] : (listing()?.folders ?? [])));

  const atRoot = () => currentPrefix() !== "" && currentPrefix() === root().prefix;

  // Registry images of every split, loaded once per page: the Field filters hide splits with no
  // matching image (top-level list and tree). A failed load leaves the splits unfiltered.
  const [splitImages] = createResource(() => root().prefix || false, () => api.getSplitImages());

  /** Split images as file entries, so the Field filters and their choices treat them like files. */
  const splitFiles = createMemo<Record<string, FileEntry[]>>(() => {
    const data = splitImages.error ? undefined : splitImages();
    const bySplit: Record<string, FileEntry[]> = {};
    for (const [split, images] of Object.entries(data ?? {})) {
      bySplit[split] = images.map(({ key, meta }) => ({
        name: key.slice(key.lastIndexOf("/") + 1),
        key,
        size: 0,
        uploaded: "",
        date: null,
        meta,
        tags: [],
      }));
    }
    return bySplit;
  });

  /**
   * How many of the split's images pass the Field filters; null when no Field filter is set or
   * the split images have not loaded (then the Field filters hide no split).
   */
  function splitMatch(split: string): SplitMatch | null {
    if (fieldFilterCount(filters()) === 0 || splitImages.error || !splitImages()) return null;
    const images = splitFiles()[split] ?? [];
    return { matched: images.filter((f) => matchesFilters(f, filters())).length, total: images.length };
  }

  /** Whether a split (top-level folder) passes the batch date, the tag and the Field filters. */
  function passesBatchFilters(folder: FolderEntry): boolean {
    const match = splitMatch(folder.name);
    return (
      inDateRange(folder.date, dateFrom(), dateTo()) &&
      hasTag(folder.tags, tagFilter()) &&
      (match === null || match.matched > 0)
    );
  }

  const visibleFolders = createMemo<FolderEntry[]>(() => {
    const shown = listedFolders().filter((f) => matchesSearch(f.name, search()) && (!atRoot() || passesBatchFilters(f)));
    return userSorted() ? sortFolders(shown, sortColumn(), sortDir()) : shown;
  });

  const folderFiles = createMemo<FileEntry[]>(() => (listing.error ? [] : (listing()?.files ?? [])));

  /** Where the Field filter choices come from: every split's images at the top level, else this folder's files. */
  const filterFiles = createMemo<FileEntry[]>(() => (atRoot() ? Object.values(splitFiles()).flat() : folderFiles()));

  const visibleFiles = createMemo<FileEntry[]>(() => {
    const shown = folderFiles().filter((f) => matchesSearch(f.name, search()) && matchesFilters(f, filters()));
    return sortFiles(shown, sortColumn(), sortDir());
  });

  /**
   * Items the Field filters hide (search hides are not counted): splits with no matching image at
   * the top level, else files of this folder.
   */
  const hiddenByFilters = createMemo(() =>
    atRoot()
      ? listedFolders().filter((f) => splitMatch(f.name)?.matched === 0).length
      : folderFiles().filter((f) => !matchesFilters(f, filters())).length,
  );

  /** Ids of the visible items in display order: folders first, then files. */
  const visibleIds = createMemo(() => [...visibleFolders().map((f) => f.prefix), ...visibleFiles().map((f) => f.key)]);

  // The page number remembers which visibleIds() list it was set for. A new list (another folder,
  // search, filter or sort) is a new array, so the page falls back to the first one by itself.
  const [pageState, setPageState] = createSignal<{ ids: string[] | null; page: number }>({ ids: null, page: 0 });

  const pageCount = createMemo(() => Math.max(1, Math.ceil(visibleIds().length / pageSize)));

  /** Current page, counted from 0. */
  const page = createMemo(() => {
    const state = pageState();
    const wanted = state.ids === visibleIds() ? state.page : 0;
    return Math.min(Math.max(wanted, 0), pageCount() - 1);
  });

  function setPage(n: number) {
    setPageState({ ids: visibleIds(), page: n });
  }

  /** Open the page that holds this item (keyboard and viewer moves can leave the current page). */
  function showPageOf(id: string) {
    const index = visibleIds().indexOf(id);
    if (index >= 0) setPage(Math.floor(index / pageSize));
  }

  /** The visible folders on the current page. */
  const pageFolders = createMemo(() => visibleFolders().slice(page() * pageSize, (page() + 1) * pageSize));

  /** The visible files on the current page (after the page's folders). */
  const pageFiles = createMemo(() => {
    const folderCount = visibleFolders().length;
    const start = Math.max(0, page() * pageSize - folderCount);
    const end = Math.max(0, (page() + 1) * pageSize - folderCount);
    return visibleFiles().slice(start, end);
  });

  /**
   * The selected items that are visible, in display order: a filter or a search that hides an
   * item takes it out of the selection, and clearing them puts it back.
   */
  const selection = createMemo<Selection[]>(() => {
    const ids = selectedIds();
    if (ids.size === 0) return [];
    return [
      ...visibleFolders()
        .filter((f) => ids.has(f.prefix))
        .map((entry) => ({ kind: "folder" as const, entry })),
      ...visibleFiles()
        .filter((f) => ids.has(f.key))
        .map((entry) => ({ kind: "file" as const, entry })),
    ];
  });

  /** The selected item when exactly one is selected (and visible); null for none or several. */
  const selected = createMemo<Selection | null>(
    () => {
      const items = selection();
      return items.length === 1 ? items[0] : null;
    },
    null,
    { equals: (a, b) => a?.entry === b?.entry },
  );

  /** The selected files that are visible (selected folders are left out). */
  const selectedFiles = createMemo<FileEntry[]>(() =>
    selection().flatMap((s) => (s.kind === "file" ? [s.entry] : [])),
  );

  /** Select one item (folder prefix or file key) and nothing else; null clears the selection. */
  function select(id: string | null) {
    setSelectedIds(new Set(id === null ? [] : [id]));
    setAnchorId(id);
    setFocusId(id);
    if (id !== null) showPageOf(id);
  }

  /** Ctrl+click: add the item to the selection, or take it out. */
  function toggleSelect(id: string) {
    const ids = new Set(selectedIds());
    if (ids.has(id)) ids.delete(id);
    else ids.add(id);
    setSelectedIds(ids);
    setAnchorId(id);
    setFocusId(id);
  }

  /**
   * Shift+click or Shift+arrow: every visible item from the anchor to `id`. `add` (Ctrl+Shift)
   * keeps what was selected before. With no visible anchor it selects only `id`.
   */
  function selectRange(id: string, add = false) {
    const ids = visibleIds();
    const from = ids.indexOf(anchorId() ?? "");
    const to = ids.indexOf(id);
    if (from < 0 || to < 0) {
      select(id);
      return;
    }
    const range = ids.slice(Math.min(from, to), Math.max(from, to) + 1);
    setSelectedIds(new Set(add ? [...selectedIds(), ...range] : range));
    setFocusId(id);
    showPageOf(id);
  }

  /** A click on an item, with whether Ctrl (or Cmd) and Shift were held. */
  function clickItem(id: string, keys: { toggle: boolean; range: boolean }) {
    if (keys.range) selectRange(id, keys.toggle);
    else if (keys.toggle) toggleSelect(id);
    else select(id);
  }

  /** Ctrl+A: every visible item. */
  function selectAll() {
    setSelectedIds(new Set(visibleIds()));
  }

  /** Where the arrow keys move from: the last clicked or moved-to item, while it is visible. */
  const focused = () => {
    const id = focusId();
    return id !== null && visibleIds().includes(id) ? id : null;
  };

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
    select(key);
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
    selection,
    selectedFiles,
    select,
    selectRange,
    clickItem,
    selectAll,
    focused,
    visibleIds,
    pageSize,
    page,
    pageCount,
    setPage,
    pageFolders,
    pageFiles,
    /** True when the item with this folder prefix or file key is selected. */
    isSelected: (id: string) => selectedIds().has(id),
    view,
    setView,
    search,
    setSearch,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    tagFilter,
    setTagFilter,
    listedFolders,
    sortColumn,
    sortDir,
    sortBy,
    setSort,
    visibleFolders,
    visibleFiles,
    folderFiles,
    filterFiles,
    splitMatch,
    passesBatchFilters,
    hiddenByFilters,
    filters,
    setFilter: (id: FieldId, value: FilterValue) => setFilters((f) => ({ ...f, [id]: value })),
    activeFilterCount,
    clearAllFilters,
    registry,
  };
}

export const store = createRoot(() => createStore(http));
