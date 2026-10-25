import { For, Match, onCleanup, onMount, Show, Switch } from "solid-js";
import { moveIndex } from "../lib/keys";
import { store, type Selection } from "../store";
import DetailsView from "./DetailsView";
import IconsView from "./IconsView";

const idOf = (s: Selection) => (s.kind === "folder" ? s.entry.prefix : s.entry.key);

/** Grey frames in the shape of the contact sheet while a folder loads. */
function Skeleton() {
  return (
    <div class="icons" aria-hidden="true">
      <For each={Array.from({ length: 12 })}>
        {() => (
          <div class="tile">
            <div class="frame skeleton" />
            <div class="caption skeleton" />
          </div>
        )}
      </For>
    </div>
  );
}

/**
 * The folder's items as large icons or a table, plus its loading, error, empty and
 * "nothing matches" states. Keyboard: arrows move the selection, Enter or Space opens it,
 * Backspace goes up a folder.
 */
export default function FileArea() {
  let area!: HTMLElement;
  const total = () => (store.listing()?.folders.length ?? 0) + store.folderFiles().length;
  const shown = () => store.visibleFolders().length + store.visibleFiles().length;

  /** Columns of the current layout: the contact sheet's grid tracks, or 1 for the table. */
  const columns = () => {
    if (store.view() === "details") return 1;
    const grid = area.querySelector<HTMLElement>(".icons");
    return grid ? getComputedStyle(grid).gridTemplateColumns.split(" ").length : 1;
  };

  function open(s: Selection) {
    if (s.kind === "folder") store.navigate(s.entry.prefix);
    else store.openViewer(s.entry.key);
  }

  function onKey(e: KeyboardEvent) {
    if (store.viewer() || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    const target = e.target instanceof Element ? e.target : document.body;
    if (target.closest("input, select, textarea, [contenteditable], .popover-panel")) return;

    const selected = store.selected();
    if (e.key === "Enter" || e.key === " ") {
      // A focused button or link handles its own Enter and Space.
      if (!selected || target.closest("button, a")) return;
      e.preventDefault();
      open(selected);
      return;
    }
    if (e.key === "Backspace") {
      e.preventDefault();
      store.up();
      return;
    }

    const ids = [...store.visibleFolders().map((f) => f.prefix), ...store.visibleFiles().map((f) => f.key)];
    const index = selected ? ids.indexOf(idOf(selected)) : -1;
    const next = moveIndex(e.key, index, ids.length, columns());
    if (next === null) return;
    e.preventDefault();
    store.select(ids[next]);
    area.querySelector(`[data-id="${CSS.escape(ids[next])}"]`)?.scrollIntoView({ block: "nearest" });
  }
  onMount(() => window.addEventListener("keydown", onKey));
  onCleanup(() => window.removeEventListener("keydown", onKey));

  return (
    <section class="file-area" ref={area} onClick={() => store.select(null)}>
      <Switch>
        <Match when={store.listing.error}>
          <p class="error">Could not load this folder: {(store.listing.error as Error).message}</p>
        </Match>
        <Match when={store.listing.loading}>
          <Show when={store.view() === "icons"} fallback={<p class="loading">Loading…</p>}>
            <Skeleton />
          </Show>
        </Match>
        <Match when={total() === 0}>
          <p class="empty">This folder is empty.</p>
        </Match>
        <Match when={shown() === 0}>
          <div class="empty">
            <p>No items match.</p>
            <p class="empty-detail">
              {store.search() ? "The search" : "The filters"} hide all {total()} items in this folder.
            </p>
            <div class="empty-actions" onClick={(e) => e.stopPropagation()}>
              <Show when={store.search()}>
                <button class="action" onClick={() => store.setSearch("")}>
                  Clear search
                </button>
              </Show>
              <Show when={store.activeFilterCount() > 0}>
                <button class="action primary" onClick={() => store.clearAllFilters()}>
                  Clear filters
                </button>
              </Show>
            </div>
          </div>
        </Match>
        <Match when={true}>
          <Show when={store.view() === "icons"} fallback={<DetailsView />}>
            <IconsView />
          </Show>
        </Match>
      </Switch>
    </section>
  );
}
